"""World selection and activities against a synthetic SQLite database over HTTP."""
from test_lan import Client, HttpFixture
import server
import world_maps


class WorldMapTests(HttpFixture):
    def setUp(self):
        super().setUp()
        self.parent.login()
        self.authorize(self.child)

    def authorize(self, client):
        code = self.parent.request('/api/devices/code', 'POST')[1]['code']
        self.assertEqual(client.request('/api/pair', 'POST', {'code': code})[0], 200)
        client.request('/api/me')

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
                payload = {'place': finale['id'], 'x': finale['x'], 'z': finale['z']}
                self.assertEqual(self.child.request(endpoint+'/interact', 'POST', payload)[0], 400)
                self.assertEqual(self.child.request(endpoint+'/move', 'PUT', {'x': finale['x'], 'z': finale['z']})[0], 200)
                self.assertEqual(self.child.request(endpoint+'/interact', 'POST', payload)[0], 400)
                for ident in [*finale['requires'], finale['id']]:
                    place = next(p for p in layout['places'] if p['id'] == ident)
                    self.assertEqual(self.child.request(endpoint+'/move', 'PUT', {'x': place['x'], 'z': place['z']})[0], 200)
                    for _ in range(2):
                        status, result, _ = self.child.request(endpoint+'/interact', 'POST', {'place': ident})
                        self.assertEqual(status, 200)
                        self.assertEqual(result['progress'].count(ident), 1)
                self.assertEqual(self.parent.request(endpoint)[1]['progress'], [*finale['requires'], finale['id']])

        with server.db() as c:
            for table in ('world_ledger', 'world_inventory', 'step_progress', 'completions'):
                self.assertEqual(c.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0], 0)
