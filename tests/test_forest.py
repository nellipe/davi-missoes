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
  self.assertTrue(forest.trail_walkable(0,10))
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
  c=http.client.HTTPConnection('127.0.0.1',self.port)
  try:
   c.request('GET','/assets/forest/fonts/fredoka-latin.woff2')
   response=c.getresponse()
   self.assertEqual((response.status,response.getheader('Content-Type')),(200,'font/woff2'))
   self.assertEqual(response.read()[:4],b'wOF2')
  finally:
   c.close()

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

 def test_continuous_map_resumes_old_positions_and_connects_all_regions_without_bridge(self):
  endpoint='/api/forest/map'
  old={'x':-9,'z':1.4}
  self.assertEqual(self.child.request('/api/forest/trail/move','PUT',old)[0],200)
  self.assertEqual(self.child.request(endpoint+'?resume=trail')[1]['position'],{'x':19,'z':1.4})
  self.assertEqual(self.child.request(endpoint)[1]['position'],self.child.request('/api/forest')[1]['position'])
  self.assertEqual(self.child.request(endpoint+'/move','PUT',{'x':0,'z':-3})[0],400)
  for x,z in [(31,18),(32.76,-7.58),(21.96,.08),(37.87,-12.24),(47.74,-9.81),(48.10,-7.95)]:
   self.assertEqual(self.child.request(endpoint+'/move','PUT',{'x':x,'z':z})[0],400)
  before=self.child.request('/api/world')[1]
  position={'x':46.5,'z':-5.3}
  self.assertEqual(self.child.request(endpoint+'/move','PUT',position)[0],200)
  self.assertEqual(self.parent.request(endpoint+'?resume=trail')[1]['position'],position)
  self.assertEqual(self.child.request('/api/world')[1],before)
  self.assertEqual(self.child.request('/api/forest/trail')[1]['position'],old)

 def test_old_invalid_checkpoint_recovers_nearby_without_rewriting_progress(self):
  from math import hypot
  endpoint='/api/forest/map'
  checkpoint='{"x":32.76,"z":-7.58}'
  with server.db() as c:
   c.execute("INSERT INTO settings(key,value) VALUES('forest_position',?)", (checkpoint,))
  position=self.child.request(endpoint)[1]['position']
  self.assertTrue(forest.map_walkable(position['x'],position['z'],[]))
  self.assertLess(hypot(position['x']-32.76,position['z']+7.58),2.5)
  with server.db() as c:
   self.assertEqual(c.execute("SELECT value FROM settings WHERE key='forest_position'").fetchone()[0],checkpoint)
  grass={'x':28,'z':10}
  self.assertEqual(self.child.request(endpoint+'/move','PUT',grass)[0],200)
  self.assertEqual(self.parent.request(endpoint)[1]['position'],grass)

 def test_diagnostics_requires_parent_and_contains_only_build_identity(self):
  status,public,_=self.child.request('/api/build')
  self.assertEqual(status,200)
  self.assertEqual(set(public),{'version','commit'})
  self.assertRegex(public['commit'],r'^[0-9a-f]{40}$')
  self.assertEqual(self.child.request('/api/forest/diagnostics')[0],403)
  self.assertEqual(self.parent.request('/api/forest/diagnostics')[:2],(200,public))
