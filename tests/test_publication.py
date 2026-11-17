"""Publicação V0.5; sockets loopback e dados inteiramente sintéticos."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest

from test_lan import Client, HttpFixture
from lan_security import Config
from prepare_lan import generate
import server


class PublicationTests(HttpFixture):
    def setUp(self):
        super().setUp()
        self.config = {'DAVI_PORT': str(self.port), 'DAVI_HOST': '127.0.0.1',
                       'DAVI_ORIGINS': 'https://aventuras.davi.costa',
                       'DAVI_PROXY_KEY': 'p' * 48, 'DAVI_CHILD_AUTO': '1'}
        server.CONFIG = Config(self.config)
        self.parent = Client(self.port, 'https://aventuras.davi.costa', True)
        self.child = Client(self.port, 'https://aventuras.davi.costa', True)

    def test_automatic_child_legacy_password_admin_crud_and_preservation(self):
        salt = b'synthetic-salt!!'
        encoded = salt.hex() + '$' + hashlib.pbkdf2_hmac(
            'sha256', b'Synthetic-password-123', salt, 310_000).hex()
        server.set_setting('password', encoded)
        status, info, cookie = self.child.request('/api/me')
        self.assertEqual(status, 200)
        self.assertTrue(info['authorized'])
        self.assertTrue(info['simple_lan'])  # contrato existente da interface, sem pareamento
        self.assertFalse(info['parent'])
        for flag in ('Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'):
            self.assertIn(flag, cookie)
        self.assertIsNone(self.child.request('/api/me')[2])
        self.parent.request('/api/me')
        self.assertEqual(self.parent.request('/api/login', 'POST', {'password': 'wrong'})[0], 401)
        self.parent.login()
        event = dict(title='Sintético', time='08:00', start_date='2026-11-16', recurrence='daily')
        status, result, _ = self.parent.request('/api/events', 'POST', event)
        self.assertEqual(status, 201)
        eid = result['id']
        route = f'/api/events/{eid}'
        for path, method in (('/api/events','GET'), ('/api/events','POST'),
                             (route,'PUT'), (route,'DELETE'), (route+'/skip','POST'),
                             ('/api/settings','PUT')):
            self.assertEqual(self.child.request(path, method, event)[0], 403)
        self.assertEqual(self.child.request(route+'/done','POST',{'date':'2026-11-17'})[0], 200)
        with server.db() as c:
            before = list(c.iterdump())
        server.initialize()
        with server.db() as c:
            self.assertEqual(list(c.iterdump()), before)
        rows = self.child.request('/api/calendar?start=2026-11-17&end=2026-11-17')[1]['events']
        self.assertTrue(rows[0]['done'])
        self.assertEqual(self.child.request(route+'/done?date=2026-11-17','DELETE')[0],200)
        event['time'] = '09:00'
        self.assertEqual(self.parent.request(route,'PUT',event)[0],200)
        self.assertEqual(self.parent.request('/api/settings','PUT',{'name':'Teste'})[0],200)
        self.assertEqual(self.parent.request(route,'DELETE')[0],200)
        self.assertEqual(server.get_setting('password'),encoded)
        self.assertEqual(self.parent.request('/api/logout','POST')[0],200)
        self.assertFalse(self.parent.request('/api/me')[1]['parent'])
        self.assertTrue(self.parent.request('/api/me')[1]['authorized'])

    def test_https_guards_and_sessions(self):
        self.child.request('/api/me')
        for headers in ({'Host':'attacker.test'}, {'Origin':'http://aventuras.davi.costa'},
                        {'Origin':'https://aventuras.davi.costa.attacker.test'}, {'Origin':''},
                        {'X-Davi-Proxy':'forged'}, {'X-Davi-Client':'192.168.3.1'},
                        {'X-Davi-Client':'192.168.2.0'}, {'X-Davi-Client':'192.168.2.255'},
                        {'Cookie':''}, {'X-CSRF-Token':''}, {'X-CSRF-Token':'forged'}):
            self.assertEqual(self.child.request('/api/events/1/done','POST',{'date':'2026-11-17'},**headers)[0],403,headers)
        # O backend direto é fechado, mesmo com Host correto e X-Forwarded-* forjado.
        direct = Client(self.port, 'https://aventuras.davi.costa')
        self.assertEqual(direct.request('/api/me', **{'X-Forwarded-For':'192.168.2.20'})[0],403)
        for peer in ('192.168.2.20','8.8.8.8','192.168.3.20'):
            handler=SimpleNamespace(headers={'Host':'aventuras.davi.costa',
                'X-Davi-Proxy':'p'*48,'X-Davi-Client':'192.168.2.20'},client_address=(peer,1234))
            self.assertIsNone(server.CONFIG.client(handler))

    def test_service_ignores_inherited_lan_mode_and_refuses_missing_password(self):
        config = self.data/'config.json'
        config.write_text(json.dumps({**self.config,'DAVI_DATA_DIR':str(self.data)}))
        with server.db() as c:
            c.execute("DELETE FROM settings WHERE key='password'")
        env={**os.environ,'DAVI_LAN_SIMPLE':'1','DAVI_CHILD_AUTO':'0'}
        result=subprocess.run([sys.executable,str(Path(server.ROOT)/'run_service.py'),str(config)],
                              env=env,capture_output=True,text=True,timeout=10)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Senha administrativa existente ausente',result.stderr)


class PublicationConfigTests(unittest.TestCase):
    def test_closed_automatic_mode_and_exact_origin(self):
        valid={'DAVI_CHILD_AUTO':'1','DAVI_PROXY_KEY':'p'*48,'DAVI_ORIGINS':'https://aventuras.davi.costa'}
        for changes in ({'DAVI_PROXY_KEY':''},{'DAVI_HOST':'192.168.2.10'},
                        {'DAVI_ORIGINS':'https://evil.davi.costa'},
                        {'DAVI_ORIGINS':'https://aventuras.davi.costa,https://192.168.2.10'},
                        {'DAVI_LAN_CIDR':'192.168.0.0/16'},{'DAVI_CHILD_AUTO':'yes'}):
            with self.assertRaises(ValueError): Config({**valid,**changes})

    def test_generated_publication_has_persistent_ca_and_no_ip_alias(self):
        with tempfile.TemporaryDirectory(prefix='davi config synthetic ') as folder:
            path=Path(folder)/'publication'
            config=generate(path,'192.168.2.10')
            self.assertEqual(config['DAVI_ORIGINS'],'https://aventuras.davi.costa')
            self.assertEqual(config['DAVI_CHILD_AUTO'],'1')
            self.assertEqual(config['DAVI_HOST'],'127.0.0.1')
            caddy=(path/'Caddyfile').read_text()
            self.assertIn((path/'caddy-data').as_posix(),caddy)
            self.assertIn('skip_install_trust',caddy)
            self.assertIn('auto_https disable_redirects',caddy)
            self.assertIn('protocols h1 h2',caddy)
            self.assertNotIn('https://192.168.2.10',caddy)


if __name__ == '__main__': unittest.main()
