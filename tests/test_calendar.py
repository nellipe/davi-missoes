"""Testes da agenda local. Execute: python -m unittest discover -s tests -v"""
import datetime as dt
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import server

class CalendarTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.old_db=server.DB
        self.old_data=server.DATA
        server.DATA=Path(self.temp.name)
        server.DB=server.DATA/"test.sqlite3"
        server.initialize()
    def tearDown(self):
        server.DB=self.old_db
        server.DATA=self.old_data
        self.temp.cleanup()
    def create(self,**kw):
        payload=dict(title="Escola",time="08:00",duration=60,icon="📚",notes="",start_date="2026-11-16",end_date=None,recurrence="weekdays",weekdays=[],skip_weekends=False,skip_holidays=False,mission="")
        payload.update(kw)
        values=server.validate_event(payload)
        with server.db() as c:
            return c.execute(f"INSERT INTO events({server.FIELDS}) VALUES({','.join('?'*12)})",values).lastrowid
    def test_holidays_florianopolis_2026(self):
        h=server.holiday_map(2026)
        self.assertEqual(h["2026-03-23"]["kind"],"municipal")
        self.assertEqual(h["2026-04-03"]["name"],"Sexta-feira Santa")
        self.assertEqual(h["2026-06-04"]["name"],"Corpus Christi")
        self.assertEqual(h["2026-11-20"]["kind"],"nacional")
        self.assertNotIn("2026-02-17",h) # Carnaval não é feriado nacional
    def test_holidays_2027(self):
        h=server.holiday_map(2027)
        self.assertEqual(h["2027-03-26"]["name"],"Sexta-feira Santa")
        self.assertEqual(h["2027-05-27"]["name"],"Corpus Christi")
    def test_weekdays_and_holiday_skip(self):
        self.create(start_date="2026-11-16",skip_holidays=True)
        rows=server.occurrences(dt.date(2026,11,16),dt.date(2026,11,22))
        self.assertEqual([r["date"] for r in rows],["2026-11-16","2026-11-17","2026-11-18","2026-11-19"])
    def test_weekly_selected_days(self):
        self.create(recurrence="weekly",weekdays=[1,3],start_date="2026-11-16")
        dates=[r["date"] for r in server.occurrences(dt.date(2026,11,16),dt.date(2026,11,22))]
        self.assertEqual(dates,["2026-11-17","2026-11-19"])
    def test_monthly_no_date_rollover(self):
        self.create(recurrence="monthly",start_date="2027-01-31",end_date="2027-03-31")
        dates=[r["date"] for r in server.occurrences(dt.date(2027,1,31),dt.date(2027,3,31))]
        self.assertEqual(dates,["2027-01-31","2027-03-31"])
    def test_exception_and_completion(self):
        eid=self.create(recurrence="daily")
        with server.db() as c:
            c.execute("INSERT INTO exceptions VALUES(?,?)",(eid,"2026-11-17"))
            c.execute("INSERT INTO completions VALUES(?,?,?)",(eid,"2026-11-16","2026-11-16T08:30:00-03:00"))
        rows=server.occurrences(dt.date(2026,11,16),dt.date(2026,11,18))
        self.assertEqual([r["date"] for r in rows],["2026-11-16","2026-11-18"])
        self.assertTrue(rows[0]["done"])
        self.assertFalse(rows[1]["done"])
    def test_password_hash(self):
        encoded=server.hash_password("UmaSenhaSegura123")
        self.assertTrue(server.verify_password("UmaSenhaSegura123",encoded))
        self.assertFalse(server.verify_password("OutraSenha",encoded))
        self.assertNotIn("UmaSenhaSegura123",encoded)
    def test_invalid_recurrence(self):
        with self.assertRaises(ValueError):
            server.validate_event({"title":"Teste","time":"11:00","start_date":"2026-11-17","recurrence":"weekly","weekdays":[]})
    def test_end_before_start(self):
        with self.assertRaises(ValueError):
            server.validate_event({"title":"Teste","time":"11:00","start_date":"2026-11-17","end_date":"2026-11-16"})

if __name__=="__main__": unittest.main()
