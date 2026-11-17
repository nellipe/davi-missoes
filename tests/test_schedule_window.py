"""Relógio controlado e API real; bancos temporários."""
import datetime as dt
from unittest.mock import patch
import test_world
from test_lan import HttpFixture
import server
import schedule_window as timing


class WindowTests(HttpFixture):
    start=test_world.WorldTests.start
    finish=test_world.WorldTests.finish

    def setUp(self):
        super().setUp();self.parent.login()
        self.at('2026-11-17T11:15:00')
        code=self.parent.request('/api/devices/code','POST')[1]['code']
        self.child.request('/api/pair','POST',{'code':code});self.child.request('/api/me')
        self.eid=self.parent.request('/api/events','POST',{'title':'Treino sintético','time':'11:00','start_date':'2026-11-17','recurrence':'daily'})[1]['id']
        self.parent.request(f'/api/events/{self.eid}/mission','PUT',{'template_id':'taekwondo'})

    def at(self,value):
        self.clock_mock.return_value=dt.datetime.fromisoformat(value).replace(tzinfo=timing.TZ)

    def complete(self,client=None,date='2026-11-17',method='POST'):
        route=f'/api/events/{self.eid}/done'
        return (client or self.child).request(route if method=='POST' else route+'?date='+date,method,{'date':date,'role':'parent','now':'2026-11-17T11:00:00-03:00'})

    def test_boundaries_api_server_clock_and_undo(self):
        for instant,status in [('10:59:59',409),('11:00:00',200),('11:30:00',200),('12:00:00',200),('12:00:01',409)]:
            self.at('2026-11-17T'+instant)
            for method in ('POST','DELETE'):
                self.assertEqual(self.complete(method=method)[0],status,(instant,method))
        self.assertEqual(self.complete(date='2026-11-18')[0],409)
        self.assertEqual(self.complete(date='2026-11-16')[0],404) # before recurrence starts
        self.at('2026-11-18T11:00:00')
        self.assertEqual(self.complete()[0],409) # yesterday
        calendar=self.child.request('/api/calendar?start=2026-11-17&end=2026-11-19')[1]['events']
        self.assertEqual([e['window']['state'] for e in calendar],['expired','open','upcoming'])
        self.assertEqual(calendar[0]['window']['closes_at'],'2026-11-17T12:00:00-03:00')

    def test_steps_reward_direct_requests_parent_exception_and_free_practice(self):
        mission=self.child.request(f'/api/events/{self.eid}/mission?date=2026-11-17')[1]['mission']
        route=f"/api/events/{self.eid}/mission/steps/{mission['steps'][0]['id']}"
        body={'date':'2026-11-17','template_id':mission['id'],'revision':mission['revision'],'done':True}
        self.at('2026-11-17T10:59:59')
        self.assertEqual(self.child.request(route,'PUT',body)[0],409)
        self.assertEqual(self.child.request('/api/world/real','POST',{'event_id':self.eid,'date':'2026-11-17'})[0],409)
        self.assertEqual(self.finish()[1]['reward']['reason'],'outside_window')
        self.assertEqual(self.child.request('/api/world')[1]['stars'],0)
        response=self.parent.request(route,'PUT',body)
        self.assertEqual(response[0],200);self.assertIn('correction',response[1])
        self.assertEqual(self.complete(self.parent)[0],200)
        self.assertEqual(self.parent.request('/api/world/real','POST',{'event_id':self.eid,'date':'2026-11-17'})[1]['delta'],0)
        self.at('2026-11-17T11:00:00')
        self.assertEqual(self.finish()[1]['reward']['delta'],1)
        self.assertEqual(self.child.request(route,'PUT',{**body,'done':False})[0],200)
        self.at('2026-11-17T12:00:01')
        self.assertEqual(self.child.request(route,'PUT',{**body,'done':False})[0],409)
        with server.db() as c:self.assertEqual(c.execute('SELECT COUNT(*) FROM schedule_corrections').fetchone()[0],2)

    def test_midnight_recurrence_exception_tolerance_and_authorization(self):
        with server.db() as c:c.execute("UPDATE events SET time='23:50',duration=30 WHERE id=?",(self.eid,))
        self.at('2026-11-18T00:30:00')
        self.assertEqual(self.complete()[0],200) # still the active occurrence, not today's future one
        self.assertEqual(self.complete(date='2026-11-18')[0],409)
        self.assertEqual(self.child.request('/api/schedule/config','PUT',{'after_minutes':240})[0],403)
        self.assertEqual(self.child.request('/api/schedule/config')[0],403)
        self.assertEqual(self.parent.request('/api/schedule/config','PUT',{'after_minutes':-1})[0],400)
        self.assertEqual(self.parent.request('/api/schedule/config','PUT',{'after_minutes':True})[0],400)
        self.assertEqual(self.parent.request('/api/schedule/config','PUT',{'after_minutes':0})[0],200)
        self.assertEqual(self.complete()[0],409)
        with server.db() as c:c.execute('INSERT INTO exceptions VALUES(?,?)',(self.eid,'2026-11-17'))
        self.assertEqual(self.complete(self.parent)[0],404)

    def test_historical_dst_uses_iana_and_elapsed_minutes(self):
        event={'time':'23:30','duration':120}
        with server.db() as c:
            result=timing.window(c,event,'2018-11-03',dt.datetime(2018,11,4,4,tzinfo=dt.timezone.utc))
            self.assertEqual(result['opens_at'],'2018-11-03T23:30:00-03:00')
            self.assertEqual(result['closes_at'],'2018-11-04T03:00:00-02:00')
            self.assertEqual(result['state'],'open')
            result=timing.window(c,{'time':'00:30','duration':30},'2018-11-04')
            self.assertEqual(result['opens_at'],'2018-11-04T01:30:00-02:00')
