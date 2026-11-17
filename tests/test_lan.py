"""Integração HTTP com bancos sintéticos; nunca usa dados/agenda.sqlite3."""
import http.client
import json
from pathlib import Path
import socket
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server
from lan_security import AuthStore, Config
from maintenance import backup, integrity, restore
from prepare_lan import generate


class Client:
    def __init__(self, port, origin=None, proxy=False):
        self.port, self.cookie, self.csrf = port, '', ''
        self.origin = origin or f'http://127.0.0.1:{port}'
        self.proxy = proxy

    def request(self, path, method='GET', body=None, **extra):
        headers = {'Host': self.origin.split('://')[1], 'Origin': self.origin,
                   'Content-Type': 'application/json', 'Cookie': self.cookie, 'X-CSRF-Token': self.csrf}
        if self.proxy:
            headers.update({'X-Davi-Proxy': 'p' * 48, 'X-Davi-Client': '192.168.2.20'})
        headers.update(extra)
        c = http.client.HTTPConnection('127.0.0.1', self.port, timeout=5)
        c.request(method, path, json.dumps(body or {}) if method in ('POST', 'PUT') else None, headers)
        r = c.getresponse()
        cookie = r.getheader('Set-Cookie')
        if cookie: self.cookie = cookie.split(';')[0]
        data = json.loads(r.read())
        status = r.status
        c.close()
        if path == '/api/me': self.csrf = data.get('csrf', '')
        return status, data, cookie

    def login(self):
        self.request('/api/login', 'POST', {'password': 'Synthetic-password-123'})
        self.request('/api/me')


class HttpFixture(unittest.TestCase):
    def setUp(self):
        import schedule_window, datetime as dt
        self.clock=patch.object(schedule_window,'now',return_value=dt.datetime(2026,11,17,8,15,tzinfo=schedule_window.TZ))
        self.clock_mock=self.clock.start();self.addCleanup(self.clock.stop)
        self.temp = tempfile.TemporaryDirectory()
        self.data = Path(self.temp.name)
        self.old = server.DATA, server.DB, server.AUTH, server.CONFIG
        server.DATA, server.DB = self.data, self.data / 'agenda.sqlite3'
        server.AUTH = AuthStore(self.data)
        server.initialize()
        server.set_setting('password', server.hash_password('Synthetic-password-123'))
        self.httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        self.port = self.httpd.server_port
        server.CONFIG = Config({'DAVI_PORT': str(self.port)})
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        self.parent = Client(self.port)
        self.child = Client(self.port)

    def tearDown(self):
        self.httpd.shutdown()
        self.httpd.server_close()
        self.thread.join()
        server.DATA, server.DB, server.AUTH, server.CONFIG = self.old
        self.temp.cleanup()


class LanTests(HttpFixture):
    def authorize(self):
        self.parent.login()
        status, data, _ = self.parent.request('/api/devices/code', 'POST')
        self.assertEqual(status, 200)
        self.assertEqual(self.child.request('/api/pair', 'POST', {'code': data['code']})[0], 200)
        self.child.request('/api/me')
        return data['code']

    def test_anonymous_and_host_origin_guards(self):
        for path in ('/api/calendar', '/api/events', '/api/holidays'):
            self.assertEqual(self.child.request(path)[0], 403)
        info = self.child.request('/api/me')[1]
        self.assertNotIn('name', info)
        self.assertNotIn('csrf', info)
        self.assertEqual(self.child.request('/api/events/1/done', 'POST', {'date': '2026-11-17'})[0], 403)
        self.assertEqual(self.child.request('/api/me', Host='attacker.test')[0], 403)
        self.assertEqual(self.child.request('/api/login', 'POST', Origin='https://attacker.test')[0], 403)
        self.assertEqual(self.child.request('/api/login', 'POST', Origin='')[0], 403)
        self.assertEqual(self.child.request('/api/login', 'POST', **{'Content-Type': 'text/plain'})[0], 415)
        self.assertEqual(self.child.request('/api/setup', 'POST', {'password': 'takeover-password'})[0], 403)

    def test_parent_child_crud_recurrence_holiday_completion_and_logout(self):
        code = self.authorize()
        new_device = Client(self.port)
        self.assertEqual(new_device.request('/api/pair', 'POST', {'code': code})[0], 401)
        self.assertEqual(self.child.request('/api/events')[0], 403)
        self.assertEqual(self.child.request('/api/settings', 'PUT', {'name': 'x'})[0], 403)
        self.assertEqual(self.child.request('/api/devices/code', 'POST')[0], 403)
        event = dict(title='Atividade sintética', time='08:00', start_date='2026-11-16',
                     recurrence='daily', skip_holidays=True, skip_weekends=True)
        self.assertEqual(self.child.request('/api/events', 'POST', event)[0], 403)
        status, result, _ = self.parent.request('/api/events', 'POST', event)
        self.assertEqual(status, 201)
        eid = result['id']
        path = '/api/calendar?start=2026-11-16&end=2026-11-22'
        rows = self.child.request(path)[1]['events']
        self.assertEqual([x['date'] for x in rows], ['2026-11-16','2026-11-17','2026-11-18','2026-11-19'])
        done = f'/api/events/{eid}/done'
        self.assertEqual(self.child.request(done, 'POST', {'date':'2026-11-17'})[0], 200)
        self.assertTrue(self.child.request(path)[1]['events'][1]['done'])
        self.assertEqual(self.child.request(done + '?date=2026-11-17', 'DELETE')[0], 200)
        self.assertFalse(self.child.request(path)[1]['events'][1]['done'])
        event.update(time='09:00', recurrence='weekly', weekdays=[0,1])
        self.assertEqual(self.parent.request(f'/api/events/{eid}', 'PUT', event)[0], 200)
        self.assertEqual(self.parent.request(f'/api/events/{eid}/skip', 'POST', {'date':'2026-11-17'})[0], 200)
        self.assertEqual(len(self.child.request(path)[1]['events']), 1)
        self.assertEqual(self.parent.request(f'/api/events/{eid}', 'DELETE')[0], 200)
        self.assertEqual(self.child.request(path)[1]['events'], [])
        self.assertEqual(self.child.request('/api/logout','POST')[0], 200)
        self.assertEqual(self.child.request(path)[0], 403)
        self.assertEqual(self.parent.request('/api/logout','POST')[0], 200)
        self.assertEqual(self.parent.request('/api/events')[0], 403)

    def test_csrf_tamper_expiration_revoke_and_persistence(self):
        self.authorize()
        self.assertEqual(self.parent.request('/api/devices/code','POST', **{'X-CSRF-Token':''})[0], 403)
        self.assertEqual(self.parent.request('/api/devices/code','POST', **{'Cookie':'davi_session=forged'})[0], 403)
        server.AUTH = AuthStore(self.data)  # Persistência independente da instância.
        self.assertTrue(self.child.request('/api/me')[1]['authorized'])
        self.assertEqual(self.parent.request('/api/devices/revoke','POST')[0], 200)
        self.assertFalse(self.child.request('/api/me')[1]['authorized'])
        with server.AUTH.db() as c: c.execute('UPDATE sessions SET expires=0')
        self.assertEqual(self.parent.request('/api/events')[0], 403)

    def test_pair_expiration_and_rate_limit_persists(self):
        self.parent.login()
        code = self.parent.request('/api/devices/code','POST')[1]['code']
        with server.AUTH.db() as c: c.execute('UPDATE pairing SET expires=0')
        self.assertEqual(self.child.request('/api/pair','POST',{'code':code})[0], 401)
        for _ in range(3):
            self.assertEqual(self.child.request('/api/login','POST',{'password':'wrong'})[0], 401)
        server.AUTH = AuthStore(self.data)
        self.assertEqual(self.child.request('/api/login','POST',{'password':'wrong'})[0], 429)
        with patch('lan_security.time.time', return_value=time.time()+901):
            self.assertEqual(self.child.request('/api/login','POST',{'password':'wrong'})[0], 401)

    def test_simulated_lan_proxy_secure_cookie_and_boundary(self):
        server.CONFIG = Config({'DAVI_PORT': str(self.port), 'DAVI_ORIGINS':'https://davi.home.arpa,https://192.168.2.10', 'DAVI_PROXY_KEY':'p'*48})
        c = Client(self.port, 'https://davi.home.arpa', True)
        self.assertEqual(c.request('/api/calendar')[0], 403)
        status, _, cookie = c.request('/api/login','POST',{'password':'Synthetic-password-123'})
        self.assertEqual(status, 200)
        self.assertIn('; Secure', cookie)
        c.request('/api/me')
        self.assertEqual(c.request('/api/calendar')[0], 200)
        self.assertEqual(c.request('/api/me', **{'X-Davi-Proxy':'forged'})[0], 403)
        self.assertEqual(c.request('/api/me', **{'X-Davi-Client':'8.8.8.8'})[0], 403)
        self.assertEqual(c.request('/api/me', **{'X-Davi-Client':'192.168.3.1'})[0], 403)
        c.origin = 'https://192.168.2.10'
        self.assertEqual(c.request('/api/calendar')[0], 200)
        with patch.object(server.CONFIG, 'client', return_value=None):
            self.assertEqual(c.request('/api/me')[0], 403)

    def test_consistent_backup_rotation_restore_revokes_sessions(self):
        self.authorize()
        before = backup(server.DB, self.data/'backups', keep=2)
        server.set_setting('name', 'Nome sintético alterado')
        restore(before, server.DB, confirm_stopped=True)  # HTTP não está escrevendo neste teste.
        self.assertEqual(server.get_setting('name'), 'Davi')
        self.assertFalse(self.child.request('/api/me')[1]['authorized'])
        for _ in range(3): backup(server.DB, self.data/'backups', keep=2)
        self.assertEqual(len(list((self.data/'backups').glob('*.sqlite3'))), 2)
        integrity(server.DB)
        with self.assertRaises(ValueError): restore(before, server.DB)
        with self.assertRaises(sqlite3.OperationalError): backup(self.data/'missing.sqlite3', self.data/'backups')
        self.assertFalse((self.data/'missing.sqlite3').exists())

    def test_real_process_restart_on_temporary_database(self):
        self.authorize()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
        config = self.data / 'config.json'
        config.write_text(json.dumps({'DAVI_DATA_DIR':str(self.data),'DAVI_HOST':'127.0.0.1','DAVI_PORT':str(port)}))
        root=Path(__file__).resolve().parents[1]
        c=Client(port)
        c.cookie=self.child.cookie
        for _ in range(2):
            proc=subprocess.Popen([sys.executable,str(root/'run_service.py'),str(config)], cwd=root,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                ready=False
                for _ in range(100):
                    if proc.poll() is not None: self.fail('Processo terminou: '+proc.stderr.read().decode())
                    try:
                        ready=c.request('/api/me')[1]['authorized']
                        if ready: break
                    except OSError: pass
                    time.sleep(.03)
                self.assertTrue(ready)
                self.assertEqual(c.request('/api/calendar')[0],200)
            finally:
                proc.terminate(); proc.wait(timeout=10); proc.stderr.close()


class ConfigTests(unittest.TestCase):
    def test_reject_public_wildcard_and_insecure_lan(self):
        for host in ('0.0.0.0','::','8.8.8.8','192.168.3.10','192.168.2.0','192.168.2.255','192.168.2.10'):
            with self.assertRaises(ValueError, msg=host): Config({'DAVI_HOST':host})
        for origins in ('https://evil.example','http://davi.home.arpa','https://davi.home.arpa/','https://8.8.8.8','https://user:pass@davi.home.arpa'):
            with self.assertRaises(ValueError): Config({'DAVI_ORIGINS':origins,'DAVI_PROXY_KEY':'x'*48})
        config=Config({'DAVI_HOST':'192.168.2.10','DAVI_ORIGINS':'https://davi.home.arpa','DAVI_PROXY_KEY':'x'*48})
        self.assertEqual(config.host,'192.168.2.10')

    def test_prepare_only_generates_files_and_preserves_destination(self):
        with tempfile.TemporaryDirectory() as folder:
            output=Path(folder)/'publication'
            generate(output,'192.168.2.10')
            content=(output/'Caddyfile').read_text()
            self.assertIn('tls internal',content)
            self.assertIn('bind 192.168.2.10',content)
            self.assertIn('remote_ip 192.168.2.0/24',content)
            self.assertNotIn('0.0.0.0',content)
            import xml.etree.ElementTree as ET
            for name in ('DaviApp','DaviProxy'):
                xml=ET.parse(output/f'{name}.xml')
                self.assertEqual(xml.findtext('startmode'),'Automatic')
                self.assertEqual(xml.findtext('serviceaccount/domain'), 'NT AUTHORITY')
                self.assertEqual(xml.findtext('serviceaccount/user'), 'LocalService')
            with self.assertRaises(ValueError): generate(output,'192.168.2.10')
            with self.assertRaises(ValueError): generate(Path(folder)/'bad','8.8.8.8')


if __name__ == '__main__': unittest.main()
