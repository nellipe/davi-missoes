"""Full game restart exercised through HTTP on a filled, synthetic SQLite database."""
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import hashlib
import json

import campaign
import forest
import missions
import screen_time
import server
import world
import world_challenges
import world_maps
from test_lan import Client, HttpFixture

TODAY='2026-11-17'
TOMORROW='2026-11-18'
TAB='a'*32
RESET='/api/adventure/new-game'
FACTS=('events','exceptions','completions','schedule_corrections','mission_templates','mission_steps',
       'event_missions','mission_event_keys','mission_runs','step_progress','mission_history',
       'world_settings','world_catalog','campaign_eligible','screen_config','campaign_approvals')


def confirm_all(c, event_id, date):
    template=missions.template(c,'taekwondo')
    for step in template['steps']:
        missions.confirm_step(c,event_id,date,step['id'],
                              {'done':True,'template_id':template['id'],'revision':template['revision']},'parent')


def seed(c, instant, limits=True):
    for title in ('Taekwondo com a família','Treino de salto','Pintar um mapa'):
        values=server.validate_event({'title':title,'time':'08:00','duration':30,'start_date':TODAY,
                                      'recurrence':'daily','icon':'✦','notes':'Atividade sintética'})
        c.execute(f"INSERT INTO events({server.FIELDS}) VALUES({','.join('?'*12)})",values)
    for event_id in (1,2):
        missions.assign(c,event_id,'','taekwondo')
        confirm_all(c,event_id,TODAY)
    c.execute('INSERT INTO completions VALUES(?,?,?)',(3,TODAY,instant.isoformat()))
    c.execute('INSERT INTO exceptions VALUES(?,?)',(3,TOMORROW))
    c.execute("INSERT INTO schedule_corrections(event_id,date,action,created) VALUES(1,?,'step:fixture',?)",
              (TODAY,instant.isoformat()))
    c.execute("INSERT INTO settings VALUES('after_minutes','45')")
    c.execute('UPDATE world_settings SET daily_limit=21')
    c.execute("UPDATE world_catalog SET price=5 WHERE id='bridge'")
    assert world.real_reward(c,{'event_id':1,'date':TODAY},server.mission_event)['delta']>0
    practice=world.start(c,{'event_id':1,'date':TODAY,'mode':'bag'},server.mission_event)
    world.adjust_balance(c,{'stars':10000})
    for item in world.CATALOG:
        world.buy(c,{'item_id':item})
    world.equip(c,{'color':'sky','hat':'hat','cape':'cape','buddy':'buddy'})
    world.inventory_control(c,{'item_id':'cape','active':False})
    world.move(c,{'x':502,'y':432})
    world.adjust_balance(c,{'stars':10000})
    forest.map_move(c,{'x':28,'z':10})
    forest.write_setting(c,'trail_position','{"x":0,"z":14}')
    forest.write_setting(c,'legacy_forest_position','{"x":2,"z":7}')
    forest.shelter_leaf(c,{'leaf_up':True})
    for key, layout in world_maps.LAYOUTS.items():
        position=next(place for place in layout['places'] if 'collect' in place)
        world_maps.move(c,key,{axis:position[axis] for axis in ('x','z')})
        world_maps.save(c,'world_activity_'+key,[place['id'] for place in layout['places'] if 'collect' in place])
        for ident, kind in world_challenges.KINDS[key].items():
            world_maps.save(c,f'world_challenge_{key}_{ident}',{**world_challenges.fresh(kind,2),'done':True})
    campaign.configure(c,{'targets':[1,2,3],'eligible':{'3':'project'}})
    campaign.approve(c,server.mission_event(c,3,TODAY),TODAY,instant)
    for key in campaign.CHAPTERS:
        campaign.discover(c,key)
        c.execute('INSERT OR IGNORE INTO campaign_unlocks VALUES(1,?)',(key,))
    world_maps.select(c,{'world':'inventores'})
    screen_time.configure(c,{**screen_time.DEFAULT,'enabled':limits,'session':12,'daily':40,'pause':7,
                            'opens':'07:00','closes':'20:00'},instant.timestamp())
    c.execute('INSERT INTO screen_days VALUES(?,?)',(TODAY,130))
    c.execute('UPDATE screen_session SET used=45')
    return practice['id']


def facts(c):
    values={table:[tuple(row) for row in c.execute(f'SELECT * FROM {table} ORDER BY rowid')] for table in FACTS}
    values['settings']=[tuple(row) for row in c.execute('''SELECT * FROM settings WHERE key NOT IN
                ('forest_position','trail_position','legacy_forest_position','trail_shelter_leaf','selected_world')
                AND key NOT GLOB 'world_position_*' AND key NOT GLOB 'world_activity_*' AND key NOT GLOB 'world_challenge_*'
                ORDER BY key''')]
    return hashlib.sha256(json.dumps(values,ensure_ascii=False,sort_keys=True).encode()).hexdigest()


class GameResetTests(HttpFixture):
    def setUp(self):
        super().setUp()
        self.parent.login()
        code=self.parent.request('/api/devices/code','POST')[1]['code']
        self.child.request('/api/pair','POST',{'code':code})
        self.child.request('/api/me')
        with server.db() as c:
            self.practice=seed(c,self.clock_mock.return_value)

    def api(self, client, path, method='GET', body=None, game=1, **extra):
        return client.request(path,method,body,**{'X-Davi-Generation':str(game),'X-Davi-Play':TAB,**extra})

    def restart(self, client=None, game=1, word='RECOMEÇAR', **headers):
        return self.api(client or self.parent,RESET,'POST',{'generation':game,'confirmation':word},game,**headers)

    def auth_snapshot(self):
        with server.AUTH.db() as c:
            return tuple(c.iterdump())

    def assert_initial(self, child, game=2):
        route=self.api(child,'/api/worlds',game=game)[1]
        self.assertEqual(route['selected'],'forest')
        self.assertEqual(route['game_generation'],game)
        self.assertEqual([w['id'] for w in route['campaign']['chapters'] if w['unlocked']],['forest'])
        self.assertFalse(any(w['discovered'] for w in route['campaign']['chapters']))
        self.assertEqual(route['campaign']['count'],0)
        wallet=self.api(child,'/api/world',game=game)[1]
        self.assertEqual((wallet['stars'],wallet['inventory']),(0,[]))
        self.assertEqual(wallet['avatar'],{'id':1,'x':530.0,'y':460.0,'color':'mint','hat':None,'cape':None,'buddy':None})
        self.assertTrue(all(not item['owned'] and not item['removed'] for item in wallet['catalog']))
        self.assertEqual(self.api(child,'/api/worlds/praia',game=game)[0],403)

    def test_full_reset_preserves_facts_and_auth_and_survives_initialization(self):
        self.assertTrue(self.api(self.child,'/api/adventure/play','POST',{'tab':TAB,'action':'start'})[1]['allowed'])
        token=self.api(self.parent,'/api/adventure/validation','PUT',{'enabled':True})[1]['token']
        self.api(self.parent,'/api/forest/map/move','PUT',{'x':0,'z':8},**{'X-Davi-Validation':token})
        with server.db() as c:
            before=facts(c)
            targets=campaign.state(c)[1]
            old_ledger=[tuple(row) for row in c.execute('SELECT * FROM world_ledger ORDER BY rowid')]
            self.assertEqual(sum(len(x) for x in world_challenges.KINDS.values()),8)
        authentication=self.auth_snapshot()
        auth_file=server.AUTH.path.read_bytes()
        self.assertEqual(self.restart()[:2],(200,{'game_generation':2}))
        self.assertEqual(self.auth_snapshot(),authentication)
        self.assertEqual(server.AUTH.path.read_bytes(),auth_file)
        self.assert_initial(self.child)
        with server.db() as c:
            self.assertEqual(facts(c),before)
            self.assertEqual(campaign.state(c)[1],targets)
            self.assertEqual([tuple(row) for row in c.execute('SELECT * FROM world_ledger ORDER BY rowid')],old_ledger)
            for table in ('world_inventory','practice_sessions','screen_days','adventure_validation','adventure_preview'):
                self.assertEqual(c.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0],0)
            self.assertEqual(screen_time.row(c)['used'],0)
            self.assertEqual(screen_time.row(c)['owner'],'')
            self.assertEqual(c.execute('SELECT COUNT(*) FROM game_resets').fetchone()[0],1)
            self.assertEqual([tuple(r) for r in c.execute('SELECT * FROM world_closed_occurrences ORDER BY event_id')],
                             [(1,TODAY),(2,TODAY),(3,TODAY)])
            self.assertFalse(c.execute("""SELECT EXISTS (SELECT 1 FROM settings WHERE key GLOB 'world_position_*'
                OR key GLOB 'world_activity_*' OR key GLOB 'world_challenge_*'
                OR key IN ('forest_position','trail_position','legacy_forest_position','trail_shelter_leaf'))""").fetchone()[0])
        self.assertEqual(self.api(self.child,'/api/forest/map/move','PUT',{'x':28,'z':10})[0],409)
        self.assertEqual(self.api(self.child,'/api/adventure/play','POST',{'tab':TAB,'action':'start'})[0],409)
        self.assertEqual(self.api(self.child,'/api/forest/map?resume=trail',game=2)[0],423)
        self.assertFalse(self.api(self.parent,'/api/adventure',game=2,**{'X-Davi-Validation':token})[1]['validation'])
        server.initialize()
        self.assertEqual(self.auth_snapshot(),authentication)
        self.assertTrue(self.child.request('/api/me')[1]['authorized'])
        other=Client(self.port)
        code=self.parent.request('/api/devices/code','POST')[1]['code']
        other.request('/api/pair','POST',{'code':code})
        self.assertEqual(other.request('/api/me')[1]['game_generation'],2)
        self.assert_initial(other)
        self.assertTrue(self.api(other,'/api/adventure/play','POST',{'tab':TAB,'action':'start'},game=2)[1]['allowed'])
        scene=self.api(other,'/api/forest/map?resume=trail',game=2)[1]
        self.assertEqual(scene['position'],scene['spawn'])
        self.assertFalse(scene['leaf_up'])
        self.assertEqual(self.api(other,'/api/world/practice/'+self.practice,game=2)[0],400)
        self.assertEqual(self.api(self.parent,'/api/world/config',game=2)[1]['history'],[])
        with server.db() as c:
            self.assertEqual(facts(c),before)

    def test_archived_rewards_cannot_be_reclaimed_and_bridge_can_be_purchased_again(self):
        self.assertEqual(self.restart()[0],200)
        self.assertTrue(self.api(self.child,'/api/adventure/play','POST',{'tab':TAB,'action':'start'},game=2)[1]['allowed'])
        for event,reason in ((1,'already'),(2,'previous_game')):
            result=self.api(self.child,'/api/world/real','POST',{'event_id':event,'date':TODAY},game=2)[1]
            self.assertEqual((result['delta'],result['reason']),(0,reason))
        self.clock_mock.return_value+=dt.timedelta(days=1)
        self.assertTrue(self.api(self.child,'/api/adventure/play','POST',{'tab':TAB,'action':'start'},game=2)[1]['allowed'])
        with server.db() as c:
            confirm_all(c,1,TOMORROW)
        reward=self.api(self.child,'/api/world/real','POST',{'event_id':1,'date':TOMORROW},game=2)[1]
        self.assertGreater(reward['delta'],0)
        self.assertEqual(self.api(self.child,'/api/world/real','POST',{'event_id':1,'date':TOMORROW},game=2)[1]['delta'],0)
        self.assertEqual(self.api(self.parent,'/api/world/balance','PUT',{'stars':100},game=2)[0],200)
        for item in ('bridge','hat','cape'):
            buy=self.api(self.child,'/api/world/buy','POST',{'item_id':item},game=2)
            self.assertGreater(buy[1]['charged'],0)
            self.assertEqual(self.api(self.child,'/api/world/buy','POST',{'item_id':item},game=2)[1]['charged'],0)
        with server.db() as c:
            self.assertEqual([r[0] for r in c.execute("SELECT id FROM world_ledger WHERE id GLOB 'buy:*bridge' ORDER BY generation")],
                             ['buy:bridge','buy:2:bridge'])

    def test_protected_confirmation_preview_and_concurrent_reset(self):
        self.assertEqual(self.restart(self.child)[0],403)
        self.assertEqual(self.restart(**{'X-CSRF-Token':''})[0],403)
        self.assertEqual(self.restart(word='RECOMECAR')[0],400)
        token=self.api(self.parent,'/api/adventure/validation','PUT',{'enabled':True})[1]['token']
        self.assertEqual(self.restart(**{'X-Davi-Validation':token})[0],409)
        self.assertEqual(self.api(self.child,'/api/world')[1]['stars'],10000)
        other=Client(self.port)
        other.login()
        with ThreadPoolExecutor(max_workers=2) as workers:
            results=list(workers.map(self.restart,(self.parent,other)))
        self.assertEqual(sorted(result[0] for result in results),[200,409])
        self.assertEqual(self.restart()[0],409)
        self.assertEqual(self.api(self.parent,RESET,'POST',{'generation':1,'confirmation':'RECOMEÇAR'},game=2)[0],409)
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM game_resets').fetchone()[0],1)

    def test_failure_at_end_rolls_back_the_whole_transaction(self):
        with server.db() as c:
            before=facts(c)
            c.execute("CREATE TRIGGER fail_reset BEFORE INSERT ON game_resets BEGIN SELECT RAISE(ABORT,'synthetic'); END")
        self.assertEqual(self.restart()[0],500)
        with server.db() as c:
            self.assertEqual(facts(c),before)
            self.assertEqual(world.generation(c),1)
            self.assertEqual(world.balance(c),10000)
            self.assertEqual(screen_time.spent(c,TODAY),130)
            self.assertEqual(campaign.progress(c)['count'],1)
            self.assertEqual(c.execute("SELECT value FROM settings WHERE key='selected_world'").fetchone()[0],'"inventores"')
            self.assertEqual(c.execute('SELECT COUNT(*) FROM world_inventory').fetchone()[0],6)

    def test_updating_a_legacy_database_does_not_start_a_new_game(self):
        before=self.api(self.child,'/api/world')[1]
        with server.db() as c:
            c.execute('DROP INDEX world_ledger_game_day')
            c.execute('ALTER TABLE world_ledger DROP COLUMN generation')
            for table in ('game_state','game_resets','world_closed_occurrences'):
                c.execute(f'DROP TABLE {table}')
        server.initialize()
        self.assertEqual(self.api(self.child,'/api/world')[1],before)
        self.assertEqual(self.api(self.child,'/api/worlds')[1]['selected'],'inventores')
        self.assertTrue(all(chapter['unlocked'] for chapter in self.api(self.child,'/api/adventure')[1]['chapters']))
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM game_resets').fetchone()[0],0)
