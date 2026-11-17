"""Etapa A: integração HTTP, migração, backup e preservação só em SQLite TEMP."""
from contextlib import closing
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from test_lan import Client, HttpFixture
from lan_security import AuthStore, Config
from maintenance import backup, integrity, restore
import missions
import server


class MissionApiTests(HttpFixture):
    def setUp(self):
        super().setUp()
        server.CONFIG=Config({'DAVI_PORT':str(self.port),'DAVI_PROXY_KEY':'p'*48,
            'DAVI_ORIGINS':'https://aventuras.davi.costa','DAVI_CHILD_AUTO':'1'})
        self.parent=Client(self.port,'https://aventuras.davi.costa',True)
        self.child=Client(self.port,'https://aventuras.davi.costa',True)
        self.parent.request('/api/me')
        self.parent.login()
        self.child.request('/api/me')
        self.event=dict(title='Taekwondo sintético',time='08:00',start_date='2026-11-16',recurrence='daily')
        self.eid=self.parent.request('/api/events','POST',self.event)[1]['id']
        self.route=f'/api/events/{self.eid}/mission'

    def link(self, ident='taekwondo', date=''):
        response=self.parent.request(self.route,'PUT',{'date':date,'template_id':ident})
        self.assertEqual(response[0],200,response)

    def occurrence(self, date='2026-11-17'):
        status,result,_=self.child.request(self.route+'?date='+date)
        self.assertEqual(status,200,result)
        return result['mission']

    def confirm(self, mission, index=0, done=True, client=None):
        return (client or self.child).request(self.route+'/steps/'+mission['steps'][index]['id'],'PUT',
            {'date':mission['date'],'template_id':mission['id'],'revision':mission['revision'],'done':done})

    def test_seed_explicit_link_and_automatic_child_progress_not_completion(self):
        templates=self.parent.request('/api/missions')[1]['templates']
        self.assertEqual(len(templates),13)
        self.assertIsNone(self.occurrence())
        self.link()
        mission=self.occurrence()
        self.assertFalse(mission['started'])
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM mission_runs').fetchone()[0],0)
        for index in range(len(mission['steps'])):
            status,progress,_=self.confirm(mission,index)
            self.assertEqual(status,200,progress)
        self.assertEqual(progress['confirmed'],len(mission['steps']))
        other=self.occurrence('2026-11-18')
        self.assertEqual(other['confirmed'],0)
        self.assertNotEqual(other['run_id'],progress['run_id'])
        calendar=self.child.request('/api/calendar?start=2026-11-17&end=2026-11-17')[1]['events']
        self.assertTrue(calendar[0]['has_mission'])
        self.assertFalse(calendar[0]['done'])
        # Confirmação repetida é idempotente para o histórico.
        self.confirm(mission)
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM mission_history').fetchone()[0],len(mission['steps']))
            self.assertEqual(c.execute('SELECT COUNT(*) FROM completions').fetchone()[0],0)
        self.assertEqual(self.confirm(mission,done=False)[1]['confirmed'],len(mission['steps'])-1)
        self.assertEqual(self.parent.request(f'/api/events/{self.eid}/done','POST',{'date':'2026-11-17'})[0],200)
        self.assertEqual(self.occurrence()['confirmed'],len(mission['steps'])-1)

    def test_template_edit_snapshot_new_occurrence_and_conflict(self):
        self.link()
        before=self.occurrence()
        self.confirm(before)
        template=self.parent.request('/api/missions/taekwondo')[1]
        old_ids=[s['id'] for s in template['steps']]
        template['steps'].reverse()
        template['steps'][0]['instruction']='Guarde a bolsa no armário combinado.'
        template['steps'].pop(1)
        template['steps'].append({'title':'Nova etapa','instruction':'Peça apoio ao adulto.','phase':'return','hint':'Sem pressa.'})
        changed=self.parent.request('/api/missions/taekwondo','PUT',template)
        self.assertEqual(changed[0],200,changed)
        self.assertEqual(changed[1]['revision'],2)
        self.assertEqual(self.parent.request('/api/missions/taekwondo','PUT',template)[0],409)
        started=self.occurrence()
        self.assertEqual(started['revision'],1)
        self.assertEqual([s['id'] for s in started['steps']],old_ids)
        self.assertTrue(started['steps'][0]['done'])
        next_day=self.occurrence('2026-11-18')
        self.assertEqual(next_day['revision'],2)
        self.assertEqual(next_day['steps'][0]['id'],old_ids[-1])
        self.assertEqual(self.confirm({**before,'date':'2026-11-18'})[0],409)
        self.assertEqual(self.confirm(started)[0],200)
        server.initialize()
        self.assertEqual(self.occurrence()['confirmed'],1)
        self.assertEqual(self.parent.request('/api/missions/taekwondo')[1]['revision'],2)

    def test_occurrence_override_no_template_and_inherit_without_erasing_started(self):
        self.link('escola')
        self.link('futsal','2026-11-17')
        self.assertEqual(self.occurrence()['id'],'futsal')
        self.assertEqual(self.occurrence('2026-11-18')['id'],'escola')
        self.link(None,'2026-11-18')
        self.assertIsNone(self.occurrence('2026-11-18'))
        self.parent.request(self.route+'?date=2026-11-18','DELETE')
        self.assertEqual(self.occurrence('2026-11-18')['id'],'escola')
        started=self.occurrence()
        self.confirm(started)
        self.link(None,'2026-11-17')
        self.assertEqual(self.occurrence()['id'],'futsal')
        self.assertEqual(self.occurrence()['confirmed'],1)

    def test_auth_csrf_origin_validation_and_archiving(self):
        self.link()
        mission=self.occurrence()
        draft=self.parent.request('/api/missions/taekwondo')[1]
        for path,method,body in [('/api/missions','GET',None),('/api/missions/history','GET',None),
             ('/api/missions/taekwondo','GET',None),('/api/missions','POST',draft),
             ('/api/missions/taekwondo','PUT',draft),('/api/missions/taekwondo/archive','PUT',{'archived':True,'revision':1}),
             (self.route,'PUT',{'template_id':'escola'}),(self.route,'DELETE',None), (self.route,'GET',None)]:
            self.assertEqual(self.child.request(path,method,body)[0],403,(path,method))
        for headers in ({'Origin':'http://aventuras.davi.costa'},{'Origin':''},{'Host':'attacker.test'},
                        {'X-CSRF-Token':''},{'Cookie':''},{'X-Davi-Proxy':'forged'}):
            self.assertEqual(self.parent.request('/api/missions','POST',draft,**headers)[0],403,headers)
            self.assertEqual(self.child.request(self.route+'/steps/'+mission['steps'][0]['id'],'PUT',
                {'date':mission['date'],'template_id':mission['id'],'revision':1,'done':True},**headers)[0],403,headers)
        for broken in ({'steps':[]},{'steps':draft['steps']*2}, {'name':' '*5},
                       {'steps':[{'id':'foreign','title':'x','instruction':'x'}]}):
            self.assertEqual(self.parent.request('/api/missions/taekwondo','PUT',{**draft,**broken})[0],400)
        self.assertEqual(self.parent.request(self.route,'PUT',{'date':None,'template_id':'escola'})[0],400)
        self.assertEqual(self.parent.request('/api/missions/taekwondo/archive','PUT',{'archived':True,'revision':1})[0],200)
        self.assertEqual(self.occurrence()['id'],'taekwondo')
        self.assertEqual(self.parent.request(self.route,'PUT',{'template_id':'taekwondo'})[0],400)
        self.assertEqual(self.parent.request('/api/missions/taekwondo/archive','PUT',{'archived':False,'revision':2})[0],200)

    def test_invalid_excluded_dates_and_missing_mission_have_no_side_effects(self):
        self.link()
        mission=self.occurrence()
        self.assertEqual(self.parent.request(f'/api/events/{self.eid}/skip','POST',{'date':'2026-11-18'})[0],200)
        for date in ('2026-11-15','2026-11-18','2026-02-30','2026-11-17T00:00'):
            self.assertEqual(self.child.request(self.route+'?date='+date)[0],400,date)
            self.assertEqual(self.confirm({**mission,'date':date})[0],400,date)
        self.assertEqual(self.child.request(self.route+'/steps/unknown','PUT',
            {'date':'2026-11-17','template_id':'taekwondo','revision':1,'done':True})[0],400)
        self.assertEqual(self.confirm(mission,done='true')[0],400)
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM mission_runs').fetchone()[0],0)

    def test_backup_restore_includes_steps_and_deleted_event_history(self):
        self.link()
        mission=self.occurrence()
        self.confirm(mission)
        snapshot=backup(server.DB,self.data/'test-backups')
        self.confirm(mission,done=False)
        restore(snapshot,server.DB,confirm_stopped=True)
        self.child.request('/api/me')
        self.assertEqual(self.occurrence()['confirmed'],1)
        self.parent.login()
        self.assertEqual(self.parent.request(f'/api/events/{self.eid}','DELETE')[0],200)
        history=self.parent.request('/api/missions/history')[1]['history']
        self.assertEqual(len(history),1)
        self.assertEqual(history[0]['confirmed'],1)
        self.assertTrue(history[0]['mission']['steps'][0]['done'])
        integrity(server.DB)

    def test_two_devices_confirm_same_occurrence_without_duplicate_runs(self):
        self.link()
        mission=self.occurrence()
        other=Client(self.port,self.child.origin,True)
        other.request('/api/me')
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures=[pool.submit(self.confirm,mission,0,True,self.child),pool.submit(self.confirm,mission,1,True,other)]
            replies=[f.result() for f in futures]
        self.assertTrue(all(r[0]==200 for r in replies),replies)
        self.assertEqual(replies[0][1]['run_id'],replies[1][1]['run_id'])
        self.assertEqual(self.occurrence()['confirmed'],2)
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM mission_runs').fetchone()[0],1)

    def test_new_template_ids_and_validation(self):
        draft={'name':'Roteiro sintético','icon':'⭐','steps':[{'title':'Combine a tarefa','instruction':'Converse com o responsável.'}]}
        status,created,_=self.parent.request('/api/missions','POST',draft)
        self.assertEqual(status,201,created)
        self.assertTrue(created['steps'][0]['id'])
        bad={**draft,'steps':[{'id':'bad/id','title':'Tarefa','instruction':'Orientação'}]}
        self.assertEqual(self.parent.request('/api/missions','POST',bad)[0],400)

    def test_reused_legacy_event_id_cannot_inherit_deleted_event_progress(self):
        self.link()
        self.confirm(self.occurrence())
        old_run=self.occurrence()['run_id']
        self.parent.request(f'/api/events/{self.eid}','DELETE')
        created=self.parent.request('/api/events','POST',{**self.event,'title':'Outra atividade sintética'})[1]['id']
        self.assertEqual(created,self.eid)  # SQLite legado reutiliza o maior ID excluído.
        self.assertIsNone(self.occurrence())
        self.link('escola')
        self.assertEqual(self.occurrence()['confirmed'],0)
        self.confirm(self.occurrence())
        self.assertNotEqual(self.occurrence()['run_id'],old_run)
        self.assertEqual(len(self.parent.request('/api/missions/history')[1]['history']),2)


class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='davi-migration-synthetic-')
        self.data=Path(self.temp.name)
        self.old=server.DATA,server.DB,server.AUTH
        server.DATA,server.DB,server.AUTH=self.data,self.data/'agenda.sqlite3',AuthStore(self.data)
        server.initialize()
        with server.db() as c:
            for table in ('mission_history','step_progress','mission_runs','event_missions','mission_event_keys','mission_steps','mission_templates','mission_schema'):
                c.execute('DROP TABLE '+table)
            salt=b'synthetic-salt!!'
            encoded=salt.hex()+'$'+hashlib.pbkdf2_hmac('sha256',b'Synthetic-password-123',salt,310_000).hex()
            c.execute("INSERT INTO settings VALUES('password',?)",(encoded,))
            c.execute("INSERT INTO events(id,title,time,start_date,recurrence,mission) VALUES(1,'Sintético','08:00','2026-11-16','daily','missão legada')")
            c.execute("INSERT INTO exceptions VALUES(1,'2026-11-18')")
            c.execute("INSERT INTO completions VALUES(1,'2026-11-17','synthetic-time')")
        server.AUTH.create_session('parent')
        self.before=self.legacy()
        self.auth_hash=hashlib.sha256(server.AUTH.path.read_bytes()).hexdigest()

    def tearDown(self):
        server.DATA,server.DB,server.AUTH=self.old
        self.temp.cleanup()

    def legacy(self, path=None):
        with closing(sqlite3.connect(path or server.DB)) as c:
            return {t:{'schema':c.execute('SELECT sql FROM sqlite_master WHERE name=?',(t,)).fetchone()[0],
                       'rows':c.execute('SELECT * FROM '+t+' ORDER BY 1,2').fetchall()} for t in ('settings','events','exceptions','completions')}

    def test_additive_idempotent_backup_and_original_catalog_exact(self):
        server.initialize()
        self.assertEqual(self.legacy(),self.before)
        self.assertEqual(hashlib.sha256(server.AUTH.path.read_bytes()).hexdigest(),self.auth_hash)
        snapshots=list((self.data/'antes-v06').glob('*.sqlite3'))
        self.assertEqual(len(snapshots),1)
        self.assertEqual(self.legacy(snapshots[0]),self.before)
        with server.db() as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM mission_templates').fetchone()[0],13)
            self.assertEqual(c.execute('SELECT COUNT(*) FROM event_missions').fetchone()[0],0)
            draft=missions.template(c,'dentes')
            draft['name']='Personalizado'
            missions.save_template(c,draft,'dentes')
        server.initialize()
        with server.db() as c:
            self.assertEqual(missions.template(c,'dentes')['name'],'Personalizado')
        self.assertEqual(len(list((self.data/'antes-v06').glob('*.sqlite3'))),1)
        # Os dez roteiros do catálogo correspondem literalmente ao protótipo original.
        source=(Path(server.ROOT)/'index.html').read_text(encoding='utf-8')
        originals=json.loads((Path(server.ROOT)/'mission_catalog.json').read_text(encoding='utf-8'))[:10]
        for item in originals:
            self.assertIn('id:"'+item['id']+'",name:"'+item['name']+'"',source)
            for step in item['steps']:
                self.assertIn(json.dumps([step['icon'],step['title'],step['instruction']],ensure_ascii=False,separators=(',',':')),source)

    def test_migration_failure_rolls_back_ddl_and_preserves_legacy(self):
        save=missions.save_template
        calls=[]
        def fail_after_first(connection,body):
            if calls: raise RuntimeError('synthetic migration failure')
            calls.append(body['id'])
            return save(connection,body)
        with patch('missions.save_template',side_effect=fail_after_first):
            with self.assertRaises(RuntimeError): server.initialize()
        self.assertEqual(len(calls),1)
        self.assertEqual(self.legacy(),self.before)
        with server.db() as c:
            self.assertFalse(c.execute("SELECT 1 FROM sqlite_master WHERE name='mission_schema'").fetchone())
        self.assertEqual(hashlib.sha256(server.AUTH.path.read_bytes()).hexdigest(),self.auth_hash)

    def test_backup_failure_prevents_migration(self):
        before=hashlib.sha256(server.DB.read_bytes()).hexdigest()
        with patch('maintenance.backup',side_effect=PermissionError('synthetic disk failure')):
            with self.assertRaises(PermissionError): server.initialize()
        self.assertEqual(hashlib.sha256(server.DB.read_bytes()).hexdigest(),before)

    def test_backup_and_migration_with_committed_wal(self):
        with closing(sqlite3.connect(server.DB)) as writer:
            writer.execute('PRAGMA journal_mode=WAL')
            writer.execute("UPDATE settings SET value='Nome sintético WAL' WHERE key='name'")
            writer.commit()
            expected=self.legacy()
            server.initialize()
            snapshots=list((self.data/'antes-v06').glob('*.sqlite3'))
            self.assertEqual(len(snapshots),1)
            self.assertEqual(self.legacy(snapshots[0]),expected)
            self.assertEqual(self.legacy(),expected)
            integrity(snapshots[0])


if __name__=='__main__': unittest.main()
