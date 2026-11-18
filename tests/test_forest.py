"""Forest adapter integration: only synthetic temporary SQLite and controlled clock."""
from test_lan import HttpFixture,Client
import server
import forest
class ForestTests(HttpFixture):
 def setUp(self):
  super().setUp();self.parent.login();code=self.parent.request('/api/devices/code','POST')[1]['code'];self.child.request('/api/pair','POST',{'code':code});self.child.request('/api/me')
 def test_bridge_gate_position_shared_and_no_economy_side_effects(self):
  old=self.child.request('/api/world')[1]
  self.assertEqual(self.child.request('/api/forest/move','PUT',{'x':0,'z':-4})[0],400)
  with server.db() as c:c.execute("INSERT INTO world_inventory(item_id) VALUES('bridge')")
  self.assertEqual(self.child.request('/api/forest/move','PUT',{'x':0,'z':-4})[0],200)
  other=Client(self.port);other.cookie=self.child.cookie;other.csrf=self.child.csrf
  self.assertEqual(other.request('/api/forest')[1]['position'],{'x':0,'z':-4})
  state=other.request('/api/world')[1]
  self.assertEqual(state['stars'],old['stars']);self.assertEqual(state['avatar']['y'],322)
  self.parent.request('/api/world/inventory','PUT',{'item_id':'bridge','active':False})
  self.assertEqual(other.request('/api/forest')[1]['position'],dict(zip(('x','z'),forest.SPAWN)))
 def test_invalid_positions_guards_and_existing_time_rules(self):
  for payload in ({'x':1000,'z':0},{'x':True,'z':0},{'x':0,'z':None},{'x':-10,'z':3}):
   self.assertEqual(self.child.request('/api/forest/move','PUT',payload)[0],400)
  self.assertEqual(self.child.request('/api/forest/move','PUT',{'x':0,'z':4},**{'X-CSRF-Token':''})[0],403)
  eid=self.parent.request('/api/events','POST',{'title':'Evento sintético futuro','time':'11:00','start_date':'2026-11-18'})[1]['id']
  self.assertEqual(self.child.request(f'/api/events/{eid}/done','POST',{'date':'2026-11-18'})[0],409)
  self.assertEqual(self.parent.request(f'/api/events/{eid}/done','POST',{'date':'2026-11-18'})[0],200)
 def test_trail_checkpoint_shared_without_moving_island_or_spending(self):
  api='/api/forest/trail'
  old=self.child.request('/api/world')[1]
  scene=self.child.request(api)[1]
  self.assertEqual(scene['position'],scene['layout']['spawn'])
  for path in scene['layout']['paths']:
   for (x,z),(a,b) in zip(path['points'],path['points'][1:]):
    for step in range(11):
     self.assertTrue(forest.trail_walkable(x+(a-x)*step/10,z+(b-z)*step/10))
  position={'x':-9,'z':1.4}
  self.assertEqual(self.child.request(api+'/move','PUT',position)[0],200)
  self.assertEqual(self.parent.request(api)[1]['position'],position)
  for blocked in [{'x':0,'z':0},{'x':False,'z':14},{'x':-4,'z':-15},{'x':-1.38,'z':13}]:
   self.assertEqual(self.child.request(api+'/move','PUT',blocked)[0],400)
  self.assertEqual(self.child.request(api+'/move','PUT',position,**{'X-CSRF-Token':''})[0],403)
  self.assertEqual(self.child.request(api)[1]['position'],position)
  self.assertEqual(self.child.request('/api/world')[1],old)
 def test_assets_are_local_and_path_traversal_is_rejected(self):
  # Binary assets are read through HTTP without using Client's JSON decoder.
  import http.client
  for path,status in [('/assets/forest/davi.glb',200),('/vendor/three/addons/loaders/GLTFLoader.js',200),('/assets/forest/../../server.py',404),('/assets/forest/asset-report.json',404)]:
   c=http.client.HTTPConnection('127.0.0.1',self.port);c.request('GET',path);r=c.getresponse();self.assertEqual(r.status,status,path);r.read();c.close()

 def test_shelter_leaf_is_reversible_and_independent_of_world_progress(self):
  trail='/api/forest/trail'
  change=trail+'/shelter'
  self.assertFalse(self.child.request(trail)[1]['leaf_up'])
  before=self.child.request('/api/world')[1]
  self.assertEqual(self.child.request(change,'PUT',{'leaf_up':1})[0],400)
  self.assertEqual(self.child.request(change,'PUT',{'leaf_up':True},**{'X-CSRF-Token':''})[0],403)
  for value in (True,True,False):
   self.assertEqual(self.child.request(change,'PUT',{'leaf_up':value})[:2], (200,{'leaf_up':value}))
   self.assertIs(self.parent.request(trail)[1]['leaf_up'],value)
  self.assertEqual(self.child.request('/api/world')[1],before)
