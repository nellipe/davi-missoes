"""Economia e prática: SQLite temporário, sem dados da família."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from unittest.mock import patch
from test_lan import Client, HttpFixture
import server


class WorldTests(HttpFixture):
    def setUp(self):
        super().setUp();self.parent.login()
        import datetime as dt, schedule_window
        self.clock_mock.return_value=dt.datetime(2026,11,17,11,15,tzinfo=schedule_window.TZ)
        code=self.parent.request('/api/devices/code','POST')[1]['code']
        self.child.request('/api/pair','POST',{'code':code});self.child.request('/api/me')
        self.eid=self.parent.request('/api/events','POST',{'title':'Taekwondo sintético','time':'11:00','start_date':'2026-11-17','recurrence':'daily'})[1]['id']
        self.parent.request(f'/api/events/{self.eid}/mission','PUT',{'template_id':'taekwondo'})

    def start(self,mode='learn',date='2026-11-17'):
        response=self.child.request('/api/world/practice','POST',{'event_id':self.eid,'date':date,'mode':mode,'size':3})
        self.assertEqual(response[0],200,response);return response[1]

    def finish(self,mode='learn',date='2026-11-17'):
        session=self.start(mode,date);result=None
        if mode=='learn':
            for step in session['mission']['steps']:
                result=self.child.request('/api/world/practice/'+session['id']+'/advance','POST',{'step_id':step['id']})
        else:
            with server.db() as c:
                rounds=json.loads(c.execute('SELECT rounds FROM practice_sessions WHERE id=?',(session['id'],)).fetchone()[0])
            for i,round_ in enumerate(rounds):
                result=self.child.request('/api/world/practice/'+session['id']+'/answer','POST',{'round':i,'selected':round_['goal']})
        self.assertEqual(result[0],200,result);return session,result[1]

    def test_credit_once_validation_daily_cap_and_edit_does_not_duplicate(self):
        session=self.start()
        self.assertEqual(self.child.request('/api/world/practice/'+session['id']+'/advance','POST',{'step_id':session['mission']['steps'][-1]['id']})[0],400)
        _,result=self.finish();self.assertEqual(result['reward']['delta'],1)
        _,again=self.finish();self.assertEqual(again['reward']['delta'],0)
        template=self.parent.request('/api/missions/taekwondo')[1];template['name']='Roteiro editado'
        self.parent.request('/api/missions/taekwondo','PUT',template)
        self.assertEqual(self.finish()[1]['reward']['delta'],0)
        config=self.parent.request('/api/world/config')[1]
        body={**config['settings'],'daily_limit':2,'catalog':config['world']['catalog']}
        self.assertEqual(self.parent.request('/api/world/config','PUT',body)[0],200)
        self.assertEqual(self.finish('order')[1]['reward']['delta'],1)
        self.assertEqual(self.finish('bag')[1]['reward']['delta'],0)
        self.assertEqual(self.child.request('/api/world')[1]['stars'],2)

    def test_games_never_complete_tasks_and_real_undo_has_no_second_award(self):
        bad=self.start('order')
        self.assertFalse(self.child.request('/api/world/practice/'+bad['id']+'/answer','POST',{'round':0,'selected':[],'delta':99})[1]['correct'])
        self.finish('order');self.finish('bag')
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM step_progress').fetchone()[0],0)
            self.assertEqual(c.execute('SELECT COUNT(*) FROM completions').fetchone()[0],0)
        mission=self.child.request(f'/api/events/{self.eid}/mission?date=2026-11-17')[1]['mission']
        for step in mission['steps']:
            self.child.request(f"/api/events/{self.eid}/mission/steps/{step['id']}",'PUT',{'date':'2026-11-17','template_id':mission['id'],'revision':mission['revision'],'done':True})
        claim={'event_id':self.eid,'date':'2026-11-17'}
        self.assertEqual(self.child.request('/api/world/real','POST',claim)[1]['delta'],2)
        step=mission['steps'][0]
        for done in (False,True):self.child.request(f"/api/events/{self.eid}/mission/steps/{step['id']}",'PUT',{'date':'2026-11-17','template_id':mission['id'],'revision':mission['revision'],'done':done})
        self.assertEqual(self.child.request('/api/world/real','POST',claim)[1]['delta'],0)
        with server.db() as c:c.execute("UPDATE events SET title='Medicação essencial sintética' WHERE id=?",(self.eid,))
        self.assertEqual(self.child.request('/api/world/real','POST',claim)[1]['reason'],'care')

    def test_atomic_purchase_avatar_and_second_device_persistence(self):
        self.finish();self.finish('order');self.finish('bag')
        self.assertEqual(self.child.request('/api/world/buy','POST',{'item_id':'portal'})[0],400)
        other=Client(self.port);other.cookie=self.child.cookie;other.csrf=self.child.csrf
        with ThreadPoolExecutor(max_workers=2) as pool:
            replies=list(pool.map(lambda client:client.request('/api/world/buy','POST',{'item_id':'bridge'}),[self.child,other]))
        self.assertEqual(sorted(r[1]['charged'] for r in replies),[0,4])
        self.assertEqual(other.request('/api/world')[1]['stars'],1)
        self.assertIn('bridge',other.request('/api/world')[1]['inventory'])
        self.assertEqual(self.child.request('/api/world/equip','PUT',{'color':'sky','hat':'hat'})[0],400)
        config=self.parent.request('/api/world/config')[1];next(i for i in config['world']['catalog'] if i['id']=='hat')['price']=1
        self.parent.request('/api/world/config','PUT',{**config['settings'],'catalog':config['world']['catalog']})
        self.assertEqual(self.child.request('/api/world/buy','POST',{'item_id':'hat'})[0],200)
        self.assertEqual(self.child.request('/api/world/equip','PUT',{'color':'sky','hat':'hat'})[0],200)
        server.initialize()
        saved=other.request('/api/world')[1]
        self.assertEqual(saved['avatar']['hat'],'hat');self.assertEqual(saved['avatar']['color'],'sky')
        self.assertEqual(saved['stars'],0)

    def test_parent_only_settings_and_additive_backup(self):
        self.assertEqual(self.child.request('/api/world/config')[0],403)
        self.assertEqual(self.child.request('/api/world/config','PUT',{})[0],403)
        self.assertEqual(self.child.request('/api/world/buy','POST',{'item_id':'bridge'},**{'X-CSRF-Token':''})[0],403)
        with server.db() as c:
            legacy={t:[tuple(r) for r in c.execute('SELECT * FROM '+t)] for t in ('events','settings','mission_templates','mission_steps','step_progress')}
            for table in ('practice_sessions','world_inventory','world_ledger','world_state','world_catalog','world_settings'):c.execute('DROP TABLE '+table)
        auth=hashlib.sha256(server.AUTH.path.read_bytes()).hexdigest()
        server.initialize();server.initialize()
        with server.db() as c:
            self.assertEqual(legacy,{t:[tuple(r) for r in c.execute('SELECT * FROM '+t)] for t in legacy})
        self.assertEqual(hashlib.sha256(server.AUTH.path.read_bytes()).hexdigest(),auth)
        self.assertEqual(len(list((self.data/'antes-v06').glob('*.sqlite3'))),1)

    def test_revoke_spent_credit_once_and_block_regrant_and_new_purchase(self):
        self.finish();self.finish('order');self.finish('bag')
        self.assertEqual(self.child.request('/api/world/buy','POST',{'item_id':'bridge'})[1]['charged'],4)
        config=self.parent.request('/api/world/config')[1]
        credit=next(h for h in config['history'] if h['context'].get('mode')=='order')
        self.assertEqual(credit['context']['activity'],'Taekwondo sintético')
        body={'id':credit['id'],'reason':'Confirmação sintética indevida'}
        for _ in range(2):
            response=self.parent.request('/api/world/revoke','POST',body)
            self.assertEqual(response[0],200,response)
            self.assertEqual(response[1]['world']['stars'],-1)
            self.assertIn('bridge',response[1]['world']['inventory'])
        self.assertEqual(self.finish('order')[1]['reward']['delta'],0)
        self.assertEqual(self.child.request('/api/world/buy','POST',{'item_id':'hat'})[0],400)
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM world_ledger WHERE id=?',('revoke:'+credit['id'],)).fetchone()[0],1)
            self.assertEqual(c.execute('SELECT delta FROM world_ledger WHERE id=?',(credit['id'],)).fetchone()[0],2)
        import datetime as dt, schedule_window
        self.clock_mock.return_value=dt.datetime(2026,11,18,11,15,tzinfo=schedule_window.TZ)
        self.finish('learn','2026-11-18')
        self.assertEqual(self.child.request('/api/world')[1]['stars'],0)
        self.assertEqual(self.parent.request('/api/world/revoke','POST',{'id':'buy:bridge'})[0],400)

    def test_parent_inventory_idempotent_no_refund_or_charge_and_paths_reset(self):
        self.finish();self.finish('order');self.finish('bag')
        self.child.request('/api/world/buy','POST',{'item_id':'bridge'})
        self.child.request('/api/world/move','PUT',{'x':185,'y':345})
        for active in (False,False,True,True):
            response=self.parent.request('/api/world/inventory','PUT',{'item_id':'bridge','active':active})
            self.assertEqual(response[0],200,response)
            self.assertEqual(response[1]['world']['stars'],1)
            self.assertEqual('bridge' in response[1]['world']['inventory'],active)
            self.assertEqual(response[1]['world']['avatar']['x'],530)
            if not active:
                self.assertEqual(self.child.request('/api/world/buy','POST',{'item_id':'bridge'})[0],400)
                self.assertEqual(self.child.request('/api/world/move','PUT',{'x':185,'y':345})[0],400)
        self.assertEqual(self.child.request('/api/world/buy','POST',{'item_id':'bridge'})[1]['charged'],0)
        with server.db() as c:
            self.assertEqual(c.execute("SELECT COUNT(*) FROM world_ledger WHERE id LIKE 'inventory:%'").fetchone()[0],2)

    def test_controls_parent_only_csrf_and_separate_occurrence_corrections(self):
        for path,method in (('/api/world/revoke','POST'),('/api/world/inventory','PUT')):
            self.assertEqual(self.child.request(path,method,{})[0],403)
            self.assertEqual(self.parent.request(path,method,{},**{'X-CSRF-Token':''})[0],403)
        self.finish()
        mission=self.parent.request(f'/api/events/{self.eid}/mission?date=2026-11-17')[1]['mission']
        step=mission['steps'][0]
        for done in (True,False):
            response=self.parent.request(f"/api/events/{self.eid}/mission/steps/{step['id']}",'PUT',{'date':'2026-11-17','template_id':mission['id'],'revision':mission['revision'],'done':done})
            self.assertEqual(response[0],200,response)
        self.parent.request(f'/api/events/{self.eid}/done','POST',{'date':'2026-11-17'})
        self.parent.request(f'/api/events/{self.eid}/done?date=2026-11-17','DELETE')
        self.assertEqual(self.child.request('/api/world')[1]['stars'],1)
        events=self.child.request('/api/calendar?start=2026-11-17&end=2026-11-18')[1]['events']
        self.assertFalse(events[0]['done'])
        self.assertFalse(self.parent.request(f'/api/events/{self.eid}/mission?date=2026-11-17')[1]['mission']['steps'][0]['done'])
        self.assertEqual(self.parent.request('/api/me')[1]['version'],server.APP_VERSION)

    def test_upgrade_previous_world_preserves_ledger_inventory_and_legacy_credit(self):
        self.finish()
        with server.db() as c:
            c.execute('ALTER TABLE world_ledger DROP COLUMN context')
            c.execute('ALTER TABLE world_inventory DROP COLUMN active')
        server.initialize();server.initialize()
        config=self.parent.request('/api/world/config')[1]
        self.assertEqual(config['world']['stars'],1)
        self.assertEqual(config['history'][0]['context']['activity'],'Taekwondo sintético')
        self.assertEqual(self.parent.request('/api/world/revoke','POST',{'id':config['history'][0]['id']})[1]['world']['stars'],0)
        self.assertEqual(self.finish()[1]['reward']['delta'],0)
        self.assertTrue(list((self.data/'antes-v06').glob('*.sqlite3')))
