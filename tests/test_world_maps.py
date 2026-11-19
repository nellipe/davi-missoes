"""World selection and activities against a synthetic SQLite database over HTTP."""
from test_lan import Client, HttpFixture
import json
import server
import world_maps


SOLUTIONS = {
    'chest-song': (['shell-rose', 'shell-gold', 'shell-blue'], True),
    'fossil-head': ([0, 2, 1], False),
    'fossil-ribs': ([0, 2, 1], False),
    'fossil-tail': ([0, 2, 1], False),
    'skeleton': ([['head','head'], ['ribs','ribs'], ['tail','tail']], False),
    'pressure': ([1, 1], True),
    'coil': (['left','right'], True),
    'commands': (['power','steps','dance'], True),
}


class WorldMapTests(HttpFixture):
    def setUp(self):
        super().setUp()
        self.parent.login()
        self.authorize(self.child)

    def authorize(self, client):
        code = self.parent.request('/api/devices/code', 'POST')[1]['code']
        self.assertEqual(client.request('/api/pair', 'POST', {'code': code})[0], 200)
        client.request('/api/me')

    def play(self, endpoint, ident, client=None):
        client = client or self.child
        choices, confirm = SOLUTIONS[ident]
        status, result, _ = client.request(endpoint+'/interact', 'POST', {'place': ident, 'action': 'start'})
        self.assertEqual(status, 200, result)
        for value in choices:
            status, result, _ = self.challenge(endpoint, ident, result, 'step', value, client)
            self.assertEqual(status, 200, result)
        if confirm:
            status, result, _ = self.challenge(endpoint, ident, result, 'check', client=client)
            self.assertEqual(status, 200, result)
        self.assertEqual(result['outcome'], 'solved')
        return result

    def challenge(self, endpoint, ident, state, action, value=None, client=None):
        client = client or self.child
        return client.request(endpoint+'/interact', 'POST', {
            'place':ident, 'action':action, 'revision':state['round']['revision'], 'value':value,
        })

    def test_free_entry_and_checkpoints_survive_switching_and_reopening(self):
        initial = self.child.request('/api/world')[1]
        self.assertEqual(initial['stars'], 0)
        self.assertEqual(initial['inventory'], [])
        self.assertEqual(self.child.request('/api/worlds')[1]['selected'], 'forest')
        forest_checkpoint = {'x': 28, 'z': 10}
        self.assertEqual(self.child.request('/api/forest/map/move', 'PUT', forest_checkpoint)[0], 200)
        self.assertEqual(self.child.request('/api/world')[1]['avatar'], initial['avatar'])
        island_checkpoint = {'x': 505, 'y': 455}
        self.assertEqual(self.child.request('/api/world/move', 'PUT', island_checkpoint)[0], 200)

        checkpoints = {}
        for key, layout in world_maps.LAYOUTS.items():
            with self.subTest(world=key):
                endpoint = f'/api/worlds/{key}'
                self.assertEqual(self.child.request('/api/worlds/selection','PUT',{'world':key})[1]['selected'], key)
                status, scene, _ = self.child.request(endpoint)
                self.assertEqual(status, 200)
                self.assertEqual(scene['position'], layout['spawn'])
                self.assertEqual(scene['map']['bounds'], [-17, 50, -14, 17])
                self.assertEqual(scene['economy']['stars'], 0)
                solid = layout['props'][0]
                for blocked in ({'x': solid[1], 'z': solid[2]}, {'x': -30, 'z': 0}, {'x': True, 'z': 4}):
                    self.assertEqual(self.child.request(endpoint+'/move', 'PUT', blocked)[0], 400)
                place = layout['places'][-1]
                checkpoints[key] = {'x': place['x'], 'z': place['z']}
                self.assertEqual(self.child.request(endpoint+'/move', 'PUT', checkpoints[key])[0], 200)

        server.initialize()
        other = Client(self.port)
        self.authorize(other)
        self.assertEqual(other.request('/api/worlds')[1]['selected'], 'inventores')
        for key, position in checkpoints.items():
            self.assertEqual(other.request('/api/worlds/'+key)[1]['position'], position)
        self.assertEqual(other.request('/api/forest/map')[1]['position'], forest_checkpoint)
        avatar = other.request('/api/world')[1]['avatar']
        self.assertEqual({key: avatar[key] for key in ('x','y')}, island_checkpoint)
        self.assertEqual(other.request('/api/worlds/selection','PUT',{'world':'sintetico'})[0], 400)
        self.assertEqual(other.request('/api/worlds/selection','PUT',{'world':'forest'},**{'X-CSRF-Token':''})[0], 403)
        self.assertEqual(Client(self.port).request('/api/worlds/praia')[0], 403)

    def test_discoveries_require_proximity_and_save_without_awarding_stars(self):
        for key, layout in world_maps.LAYOUTS.items():
            with self.subTest(world=key):
                endpoint = f'/api/worlds/{key}'
                finale = next(p for p in layout['places'] if 'requires' in p)
                payload = {'place': finale['id']}
                if finale['id'] in SOLUTIONS:
                    payload['action'] = 'start'
                self.assertEqual(self.child.request(endpoint+'/interact', 'POST', payload)[0], 400)
                self.assertEqual(self.child.request(endpoint+'/move', 'PUT', {'x': finale['x'], 'z': finale['z']})[0], 200)
                self.assertEqual(self.child.request(endpoint+'/interact', 'POST', payload)[0], 400)
                for ident in [*finale['requires'], finale['id']]:
                    place = next(p for p in layout['places'] if p['id'] == ident)
                    self.assertEqual(self.child.request(endpoint+'/move', 'PUT', {'x': place['x'], 'z': place['z']})[0], 200)
                    if ident in SOLUTIONS:
                        self.assertEqual(self.child.request(endpoint+'/interact', 'POST', {'place': ident, 'done':True})[0], 400)
                        result = self.play(endpoint, ident)
                    else:
                        status, result, _ = self.child.request(endpoint+'/interact', 'POST', {'place': ident})
                        self.assertEqual(status, 200)
                    self.assertEqual(result['progress'].count(ident), 1)
                self.assertEqual(self.parent.request(endpoint)[1]['progress'], [*finale['requires'], finale['id']])

        with server.db() as c:
            for table in ('world_ledger', 'world_inventory', 'step_progress', 'completions'):
                self.assertEqual(c.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0], 0)

    def test_partial_round_is_persisted_guarded_and_resumed_from_another_session(self):
        endpoint, ident = '/api/worlds/dinossauros', 'fossil-head'
        start = {'place':ident, 'action':'start'}
        p = next(p for p in world_maps.LAYOUTS['dinossauros']['places'] if p['id']==ident)
        self.assertEqual(self.child.request(endpoint+'/interact','POST',start)[0], 400)
        self.child.request(endpoint+'/move','PUT',{'x':p['x'],'z':p['z']})
        self.assertEqual(self.child.request(endpoint+'/interact','POST',start,**{'X-CSRF-Token':''})[0], 403)
        self.assertEqual(Client(self.port).request(endpoint+'/interact','POST',start)[0], 403)
        old = self.child.request(endpoint+'/interact','POST',start)[1]
        for forbidden in (True, 3, '0'):
            self.assertEqual(self.challenge(endpoint,ident,old,'step',forbidden)[0], 400)
        partial = self.challenge(endpoint,ident,old,'step',2)[1]
        self.assertEqual(partial['round']['value'], [2])
        self.assertEqual(self.challenge(endpoint,ident,old,'step',1)[1]['outcome'], 'changed')
        server.initialize()
        second = Client(self.port)
        self.authorize(second)
        self.assertEqual(second.request(endpoint+'/interact','POST',start)[1], dict(partial,outcome='ready'))
        repeated = self.challenge(endpoint,ident,partial,'step',2,second)[1]
        self.assertEqual(repeated['round']['value'], [2])
        mixed = self.challenge(endpoint,ident,repeated,'step',0,second)[1]
        final = self.challenge(endpoint,ident,mixed,'step',1,second)[1]
        self.assertEqual(final['progress'], [ident])
        self.assertEqual(final['outcome'], 'solved')

    def test_incorrect_attempts_hint_and_replay_leave_legacy_progress_and_balance_intact(self):
        completed = ['shell-rose', 'shell-blue', 'shell-gold', 'chest-song']
        with server.db() as c:
            c.execute('INSERT INTO settings(key,value) VALUES(?,?)', ('world_activity_praia', json.dumps(completed)))
        self.parent.request('/api/world/balance','PUT',{'stars':10000})
        self.assertEqual(self.child.request('/api/world/buy','POST',{'item_id':'bridge'})[0], 200)
        before = self.child.request('/api/world')[1]
        endpoint, ident = '/api/worlds/praia', 'chest-song'
        self.child.request(endpoint+'/move','PUT',{'x':6.2,'z':8.4})
        self.assertEqual(self.child.request(endpoint)[1]['progress'], completed)
        state = self.child.request(endpoint+'/interact','POST',{'place':ident,'action':'start'})[1]
        for value in ('shell-blue','shell-rose','shell-gold'):
            state = self.challenge(endpoint,ident,state,'step',value)[1]
        bad = self.challenge(endpoint,ident,state,'check')[1]
        self.assertEqual(bad['outcome'], 'incorrect')
        self.assertEqual(bad['progress'], completed)
        self.assertEqual(bad['round']['value'], ['shell-blue','shell-rose','shell-gold'])
        for level in (1,2,3,3):
            state = self.challenge(endpoint,ident,bad if level==1 else state,'hint')[1]
            self.assertEqual(state['round']['hint'], level)
        reset = self.challenge(endpoint,ident,state,'reset')[1]
        self.assertEqual(reset['round']['value'], [])
        self.assertEqual(reset['progress'], completed)
        result = self.play(endpoint, ident)
        self.assertEqual(result['progress'], completed)
        self.assertEqual(self.challenge(endpoint,ident,result,'check')[1]['outcome'], 'changed')
        self.assertEqual(self.child.request('/api/world')[1], before)
