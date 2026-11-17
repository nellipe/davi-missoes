"""Mundos: bancos temporários, nenhuma alteração na instalação Windows."""
from test_lan import Client, HttpFixture
import server
import realms


class RealmTests(HttpFixture):
    def setUp(self):
        super().setUp();self.parent.login()
        code=self.parent.request('/api/devices/code','POST')[1]['code']
        self.child.request('/api/pair','POST',{'code':code});self.child.request('/api/me')

    def config(self):return self.parent.request('/api/realms/config')[1]

    def test_five_worlds_travel_move_reload_second_device_and_no_currency_change(self):
        original=self.child.request('/api/world')[1]
        for ident,_,_ in realms.INITIAL:
            reply=self.child.request('/api/realms/travel','POST',{'world_id':ident})
            self.assertEqual(reply[0],200,reply);self.assertEqual(reply[1]['current'],ident)
            self.assertEqual(self.child.request('/api/realms/move','PUT',{'world_id':ident,'x':1,'z':2})[0],200)
        server.initialize()
        other=Client(self.port);other.cookie=self.child.cookie;other.csrf=self.child.csrf
        state=other.request('/api/realms')[1]
        self.assertEqual(state['current'],'crystal');self.assertEqual(len(state['worlds']),5)
        for w in state['worlds']:
            self.assertEqual(w['progress']['x'],1);self.assertEqual(w['progress']['z'],2)
            for ch in w['challenges']:self.assertNotIn('answer',ch)
        self.assertEqual(original,other.request('/api/world')[1])
        self.assertEqual(other.request('/api/realms/move','PUT',{'world_id':'forest','x':0,'z':0})[0],409)
        self.assertEqual(other.request('/api/realms/move','PUT',{'world_id':'crystal','x':1000,'z':0})[0],400)

    def test_editor_links_activity_creates_challenge_and_checks_access(self):
        eid=self.parent.request('/api/events','POST',{'title':'Atividade sintética','time':'11:00','start_date':'2026-11-17'})[1]['id']
        body={'name':'Novo mundo sintético','preset':'clouds','color':'#bbccdd','description':'Uma nova aventura.','available':True,'event_ids':[eid],'challenges':[{'title':'Lógica sintética','prompt':'Qual ilumina?','kind':'logic','choices':['Luz','Bola'],'answer':['Luz'],'x':4,'z':-4}]}
        self.assertEqual(self.child.request('/api/realms/config')[0],403)
        self.assertEqual(self.child.request('/api/realms/config','PUT',body)[0],403)
        self.assertEqual(self.parent.request('/api/realms/config','PUT',body,**{'X-CSRF-Token':''})[0],403)
        reply=self.parent.request('/api/realms/config','PUT',body);self.assertEqual(reply[0],200,reply)
        ident=reply[1]['id'];realm=next(w for w in reply[1]['worlds'] if w['id']==ident)
        self.assertEqual(realm['event_ids'],[eid])
        ch=realm['challenges'][0]
        self.assertEqual(self.child.request('/api/realms/challenge','POST',{'challenge_id':ch['id'],'selected':['Luz']})[0],409)
        self.child.request('/api/realms/travel','POST',{'world_id':ident})
        self.assertFalse(self.child.request('/api/realms/challenge','POST',{'challenge_id':ch['id'],'selected':['Bola']})[1]['correct'])
        for _ in range(2):self.assertTrue(self.child.request('/api/realms/challenge','POST',{'challenge_id':ch['id'],'selected':['Luz']})[1]['correct'])
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM realm_completed').fetchone()[0],1)
            self.assertEqual(c.execute('SELECT COUNT(*) FROM world_ledger').fetchone()[0],0)
        edited={**realm,'name':'Editado','available':True,'challenges':[]}
        self.assertEqual(self.parent.request('/api/realms/config','PUT',edited)[0],200)
        self.assertEqual(self.parent.request('/api/realms/config','PUT',edited)[0],409)
        self.assertEqual(self.child.request('/api/realms/challenge','POST',{'challenge_id':ch['id'],'selected':['Luz']})[0],400)
        with server.db() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM realm_completed').fetchone()[0],1)

    def test_unlock_bridge_ownership_hidden_current_fallback_and_validation(self):
        forest=self.config()['worlds'][0]
        self.assertEqual(self.child.request('/api/realms/move','PUT',{'world_id':'forest','x':18,'z':-3})[0],400)
        with server.db() as c:c.execute("INSERT INTO world_inventory(item_id) VALUES('bridge')")
        self.assertEqual(self.child.request('/api/realms/move','PUT',{'world_id':'forest','x':18,'z':-3})[0],200)
        self.parent.request('/api/world/inventory','PUT',{'item_id':'bridge','active':False})
        self.assertEqual(self.child.request('/api/realms')[1]['worlds'][0]['progress']['x'],0)
        self.assertEqual(self.parent.request('/api/realms/config','PUT',{**forest,'available':False})[0],200)
        state=self.child.request('/api/realms')[1]
        self.assertEqual(state['current'],'clouds');self.assertEqual(state['stored_current'],'forest')
        self.assertEqual(self.child.request('/api/realms/travel','POST',{'world_id':'forest'})[0],400)
        clouds=self.config()['worlds'][1]
        self.assertEqual(self.parent.request('/api/realms/config','PUT',{**clouds,'available':True,'unlock_item':'hat'})[0],200)
        self.assertEqual(self.child.request('/api/realms/travel','POST',{'world_id':'clouds'})[0],400)
        with server.db() as c:c.execute("INSERT INTO world_inventory(item_id) VALUES('hat')")
        self.assertEqual(self.child.request('/api/realms/travel','POST',{'world_id':'clouds'})[0],200)
        self.assertEqual(self.parent.request('/api/realms/config','PUT',{'name':'X','preset':'invalid','color':'#ffffff','available':True})[0],400)

    def test_exploration_nearby_and_migration_backup_preserves_original_economy(self):
        self.assertFalse(self.child.request('/api/realms/challenge','POST',{'challenge_id':'forest-0'})[1]['correct'])
        with server.db() as c:c.execute("INSERT INTO world_inventory(item_id) VALUES('bridge')")
        self.child.request('/api/realms/move','PUT',{'world_id':'forest','x':18,'z':-.5})
        self.assertTrue(self.child.request('/api/realms/challenge','POST',{'challenge_id':'forest-0'})[1]['correct'])
        forest=self.config()['worlds'][0]
        changed=self.parent.request('/api/realms/config','PUT',{**forest,'preset':'clouds','available':True})
        self.assertEqual(changed[0],200,changed)
        updated=changed[1]['worlds'][0]
        self.assertEqual(updated['challenges'][0]['x'],4)
        self.assertTrue(updated['challenges'][0]['completed'])
        with server.db() as c:
            old={t:[tuple(r) for r in c.execute('SELECT * FROM '+t)] for t in ('world_state','world_ledger','world_inventory','events')}
            for table in ('realms','realm_player','realm_progress','realm_events','realm_challenges','realm_completed'):c.execute('DROP TABLE '+table)
        server.initialize();server.initialize()
        with server.db() as c:
            self.assertEqual(old,{t:[tuple(r) for r in c.execute('SELECT * FROM '+t)] for t in old})
            self.assertEqual(c.execute('SELECT COUNT(*) FROM realms').fetchone()[0],5)
        self.assertTrue(list((self.data/'antes-v06').glob('*.sqlite3')))

    def test_every_preset_has_connected_explorable_paths(self):
        from collections import deque
        for preset,model in realms.PRESETS.items():
            start=tuple(round(v*2) for v in model['spawn']);seen={start};queue=deque([start])
            while queue:
                x,z=queue.popleft()
                for dx,dz in ((1,0),(-1,0),(0,1),(0,-1)):
                    point=(x+dx,z+dz)
                    if point not in seen and realms.walkable(preset,point[0]/2,point[1]/2,realms.world.CATALOG):
                        seen.add(point);queue.append(point)
            for x,z,_ in model['islands']:
                self.assertIn((round(x*2),round(z*2)),seen,preset)
