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
