"""Campaign and play limits through HTTP with a synthetic agenda and clock."""
import datetime as dt

import campaign
import forest
import screen_time
import server
import world_maps
from test_lan import Client, HttpFixture
from test_world_maps import SOLUTIONS

TAB = '1'*32
OTHER = '2'*32
TODAY = '2026-11-17'


class AdventureTests(HttpFixture):
    def setUp(self):
        super().setUp()
        self.parent.login()
        self.pair(self.child)

    def pair(self, client):
        code=self.parent.request('/api/devices/code','POST')[1]['code']
        self.assertEqual(client.request('/api/pair','POST',{'code':code})[0],200)
        client.request('/api/me')

    def play(self, action='start', client=None, tab=TAB):
        status, result, _=(client or self.child).request('/api/adventure/play','POST',{'tab':tab,'action':action})
        self.assertEqual(status,200,result)
        return result

    def at(self, seconds):
        self.clock_mock.return_value+=dt.timedelta(seconds=seconds)

    def limits(self, **settings):
        status,result,_=self.parent.request('/api/adventure/screen','PUT',{**screen_time.DEFAULT,**settings})
        self.assertEqual(status,200,result)

    def event(self, title, **fields):
        status,result,_=self.parent.request('/api/events','POST',
            {'title':title,'time':'08:00','start_date':TODAY,'icon':'⭐',**fields})
        self.assertEqual(status,201,result)
        return result['id']

    def configure(self, choices, targets=(1,2,3), client=None):
        return (client or self.parent).request('/api/adventure/config','PUT',{'targets':list(targets),'eligible':choices})

    def approve(self, event, date=TODAY, client=None):
        return (client or self.parent).request('/api/adventure/approve','POST',{'event_id':event,'date':date})

    def act(self, path, method='GET', body=None, client=None, tab=TAB):
        return (client or self.child).request(path,method,body,**{'X-Davi-Play':tab})

    def collect(self, world, ident):
        point=next(p for p in world_maps.LAYOUTS[world]['places'] if p['id']==ident)
        self.assertEqual(self.act(f'/api/worlds/{world}/move','PUT',{k:point[k] for k in ('x','z')})[0],200)
        endpoint=f'/api/worlds/{world}/interact'
        body={'place':ident}
        if ident not in SOLUTIONS:
            status,result,_=self.act(endpoint,'POST',body)
            self.assertEqual(status,200,result)
            return
        choices, confirm=SOLUTIONS[ident]
        result=self.act(endpoint,'POST',{**body,'action':'start'})[1]
        for value in choices:
            status,result,_=self.act(endpoint,'POST',{**body,'action':'step','value':value,'revision':result['round']['revision']})
            self.assertEqual(status,200,result)
        if confirm:
            result=self.act(endpoint,'POST',{**body,'action':'check','revision':result['round']['revision']})[1]
        self.assertEqual(result['outcome'],'solved')

    def opened(self):
        return [w['id'] for w in self.act('/api/adventure')[1]['chapters'] if w['unlocked']]

    def test_all_chapters_reset_preserves_discoveries_and_approvals(self):
        self.assertEqual(self.opened(),['forest'])
        ids=[self.event(name) for name in ('Montar quebra-cabeça','Desenhar mapa','Ler uma história')]
        self.assertEqual(self.configure({str(i):'project' for i in ids})[0],200)
        self.assertEqual(self.approve(ids[0],client=self.child)[0],403)
        self.assertTrue(self.play()['allowed'])
        for path,method,body in [('/api/worlds/praia','GET',None),('/api/worlds/selection','PUT',{'world':'praia'}),
                                 ('/api/worlds/praia/move','PUT',{'x':12,'z':8})]:
            self.assertEqual(self.act(path,method,body)[0],403)
        self.assertEqual(self.act('/api/forest/trail/shelter','PUT',{'leaf_up':True})[0],200)
        self.assertEqual(self.approve(ids[0])[1],{'recorded':True})
        self.assertEqual(self.approve(ids[0])[1],{'recorded':False})
        self.assertEqual(self.opened(),['forest'])
        point={'x':forest.OFFSET-6.59,'z':2.39}
        self.assertEqual(self.act('/api/forest/map/move','PUT',point)[0],200)
        self.act('/api/forest/trail/shelter','PUT',{'leaf_up':False})
        self.assertEqual(self.opened(),list(campaign.CHAPTERS[:2]))
        self.assertEqual(self.approve(ids[1])[0],200)
        self.assertEqual(self.opened(),list(campaign.CHAPTERS[:2]))
        for place in ('shell-rose','shell-blue','shell-gold','chest-song'):
            self.collect('praia',place)
        self.assertEqual(self.opened(),list(campaign.CHAPTERS[:3]))
        for place in ('fossil-head','fossil-ribs','fossil-tail','skeleton'):
            self.collect('dinossauros',place)
        self.assertEqual(self.opened(),list(campaign.CHAPTERS[:3]))
        self.assertEqual(self.approve(ids[2])[0],200)
        for place in ('pressure','coil','commands','machine'):
            self.collect('inventores',place)
        self.parent.request('/api/world/balance','PUT',{'stars':10000})
        self.act('/api/world/buy','POST',{'item_id':'bridge'})
        wallet=self.act('/api/world')[1]
        self.assertEqual(self.configure({},(5,6,9))[0],200)
        server.initialize()
        self.assertEqual(self.opened(),list(campaign.CHAPTERS))
        self.assertEqual(self.child.request('/api/adventure/reset','POST',{'confirmed':True})[0],403)
        self.assertEqual(self.parent.request('/api/adventure/reset','POST',{'confirmed':False})[0],400)
        self.assertEqual(self.parent.request('/api/adventure/reset','POST',{'confirmed':True})[0],200)
        self.assertEqual(self.opened(),['forest'])
        self.assertEqual(self.act('/api/world')[1],wallet)
        self.assertEqual(self.act('/api/forest/map')[1]['position'],point)
        admin=self.parent.request('/api/adventure/admin')[1]
        self.assertEqual((admin['count'],len(admin['history'])),(0,3))
        self.assertEqual(self.approve(ids[0])[1],{'recorded':False})
        with server.db() as c:
            self.assertEqual(world_maps.progress(c,'inventores'),['pressure','coil','commands','machine'])
            self.assertEqual(c.execute('SELECT COUNT(*) FROM completions').fetchone()[0],3)

    def test_optional_eligibility_retroactive_occurrences_and_missions(self):
        allowed=self.event('Ler e contar uma história',start_date='2026-11-13',recurrence='daily')
        excluded=[self.event(title) for title in ('Remédio da tarde','Escovar os dentes','Hora do almoço','Sessão de terapia')]
        linked=self.event('Encontro da tarde')
        self.assertEqual(self.parent.request(f'/api/events/{linked}/mission','PUT',{'template_id':'banheiro'})[0],200)
        self.assertEqual(self.parent.request(f'/api/events/{allowed}/mission','PUT',{'template_id':'escola'})[0],200)
        for event in excluded+[linked]:
            self.assertEqual(self.configure({str(event):'play'})[0],400)
            self.assertEqual(self.approve(event)[0],400)
        self.assertEqual(self.configure({str(allowed):'learning'},client=self.child)[0],403)
        self.assertEqual(self.configure({str(allowed):'learning'})[0],200)
        self.assertEqual(self.approve(allowed,'2026-11-18')[0],400)
        self.parent.request(f'/api/events/{allowed}/skip','POST',{'date':'2026-11-15'})
        self.assertEqual(self.approve(allowed,'2026-11-15')[0],400)
        for date in ('2026-11-13','2026-11-16'):
            self.assertEqual(self.approve(allowed,date)[1],{'recorded':True})
        self.assertEqual(self.act('/api/adventure')[1]['count'],2)
        self.assertEqual(self.act('/api/world')[1]['stars'],0)
        endpoint='/api/adventure/week?start=2026-11-13'
        self.assertEqual(self.child.request(endpoint)[0],403)
        week=self.parent.request(endpoint)[1]['events']
        self.assertNotIn('2026-11-15',[entry['date'] for entry in week])
        self.assertEqual([event['date'] for event in week if event['approved']],['2026-11-13','2026-11-16'])

    def test_time_shared_and_persistent_session_and_daily_caps(self):
        self.limits(session=1,daily=2,pause=1)
        self.assertEqual(self.act('/api/forest/map')[0],423)
        self.assertEqual(self.play()['remaining'],60)
        self.at(10)
        other=Client(self.port)
        self.pair(other)
        self.assertEqual(self.play(client=other,tab=OTHER)['reason'],'other')
        self.assertEqual(self.play(tab=OTHER)['reason'],'other')
        self.assertEqual(self.act('/api/forest/map',client=other,tab=OTHER)[0],423)
        self.play('leave')
        self.assertEqual(self.play(client=other,tab=OTHER)['remaining'],50)
        server.initialize()
        for _ in range(5):
            self.at(10)
            current=self.play(client=other,tab=OTHER)
        self.assertEqual(current['reason'],'pause')
        self.assertEqual(self.play()['reason'],'pause')
        for expected in (200,423):
            self.assertEqual(self.act('/api/forest/map/move','PUT',{'x':0,'z':7.5},other,OTHER)[0],expected)
        self.assertEqual(self.act('/api/calendar')[0],200)
        self.at(60)
        self.assertEqual(self.play()['remaining'],60)
        for _ in range(6):
            self.at(10)
            current=self.play()
        self.assertEqual(current['reason'],'daily')
        self.assertEqual(self.parent.request('/api/adventure/admin')[0],200)
        with server.db() as c:
            self.assertEqual(screen_time.spent(c,TODAY),120)

    def test_hours_idle_manual_pause_and_parent_only_validation(self):
        self.limits(opens='08:10',closes='08:16',pause=1)
        self.assertTrue(self.play()['allowed'])
        self.at(50)
        self.assertEqual(self.play()['remaining'],10)
        self.at(10)
        self.assertEqual(self.play()['reason'],'hours')
        with server.db() as c:
            self.assertEqual(screen_time.spent(c,TODAY),25)
        endpoint='/api/adventure/validation'
        self.assertEqual(self.child.request(endpoint,'PUT',{'enabled':True})[0],403)
        token=self.parent.request(endpoint,'PUT',{'enabled':True})[1]['token']
        extra={'X-Davi-Validation':token}
        self.assertEqual(self.child.request('/api/worlds/praia',**extra)[0],403)
        self.assertEqual(self.parent.request('/api/worlds/praia',**extra)[0],200)
        self.assertEqual(self.parent.request('/api/worlds/praia')[0],403)
        self.assertEqual(self.parent.request('/api/worlds/selection','PUT',{'world':'praia'},**extra)[0],200)
        self.assertEqual(self.act('/api/worlds')[1]['selected'],'forest')
        beach=next(p for p in world_maps.LAYOUTS['praia']['places'] if p['id']=='shell-rose')
        point={axis:beach[axis] for axis in ('x','z')}
        self.assertEqual(self.parent.request('/api/worlds/praia/move','PUT',point,**extra)[0],200)
        self.assertEqual(self.parent.request('/api/worlds/praia/interact','POST',{'place':'shell-rose'},**extra)[0],200)
        preview=self.parent.request('/api/worlds/praia',**extra)[1]
        self.assertEqual((preview['position'],preview['progress']),(point,['shell-rose']))
        with server.db() as c:
            self.assertEqual(world_maps.progress(c,'praia'),[])
            self.assertIsNone(forest.read_json_setting(c,'world_position_praia'))
        self.assertEqual(self.parent.request('/api/world/buy','POST',{'item_id':'bridge'},**extra)[0],403)
        self.parent.request(endpoint,'PUT',{'enabled':False},**extra)
        self.assertEqual(self.parent.request('/api/worlds/praia',**extra)[0],403)
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM adventure_preview').fetchone()[0],0)
        self.limits(opens='22:00',closes='08:30',pause=1)
        self.assertTrue(self.play()['allowed'])
        self.at(5)
        self.assertEqual(self.play('pause')['reason'],'pause')
        self.assertEqual(self.play()['reason'],'pause')
        self.at(60)
        self.assertTrue(self.play()['allowed'])

    def test_inactivity_can_end_a_session_without_returning_daily_minutes(self):
        self.limits(session=1,daily=2,pause=1)
        self.play()
        self.at(12)
        self.play('leave')
        self.at(59)
        self.assertEqual(self.play()['remaining'],48)
        self.play('leave')
        self.at(61)
        self.assertEqual(self.play()['remaining'],60)
        with server.db() as c:
            self.assertEqual(screen_time.spent(c,TODAY),12)
        self.play('leave')
        self.clock_mock.return_value=dt.datetime(2026,11,17,23,59,55,tzinfo=server.TZ)
        self.assertEqual(self.play()['lease'],5)
        self.at(6)
        self.assertTrue(self.play()['allowed'])
        with server.db() as c:
            self.assertEqual(screen_time.spent(c,TODAY),17)
            self.assertEqual(screen_time.spent(c,'2026-11-18'),0)

    def test_legacy_checkpoint_and_discoveries_unlock_travel_already_done(self):
        with server.db() as c:
            c.execute('DELETE FROM campaign_unlocks')
            c.execute('DELETE FROM campaign_state')
            world_maps.save(c,'world_position_dinossauros',{'x':12,'z':8})
            world_maps.save(c,'world_activity_praia',['chest-song'])
            world_maps.save(c,'selected_world','dinossauros')
            c.execute("INSERT INTO settings VALUES('trail_shelter_leaf','up')")
        server.initialize()
        self.assertEqual(self.opened(),list(campaign.CHAPTERS[:3]))
        self.assertTrue(self.play()['allowed'])
        self.assertEqual(self.act('/api/worlds')[1]['selected'],'dinossauros')
        self.assertEqual(self.act('/api/worlds/dinossauros')[1]['position'],{'x':12,'z':8})
        self.assertEqual(self.act('/api/worlds/praia')[1]['progress'],['chest-song'])
        values=self.act('/api/adventure')[1]['chapters']
        self.assertTrue(values[0]['discovered'] and values[1]['discovered'])
