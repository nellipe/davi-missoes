"""LAN direta com socket HTTP loopback, IPs simulados e SQLite só temporário."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from types import SimpleNamespace
import unittest

import test_lan as legacy
from lan_security import Config
import server


Client = legacy.Client


class SimpleLanTests(legacy.HttpFixture):
    # Reutiliza a infraestrutura temporária, sem repetir os testes do modo padrão.
    def setUp(self):
        super().setUp()
        self.httpd.test_peer = '192.168.2.20'
        base = server.Handler

        class SimulatedPeer(base):
            def setup(self):
                super().setup()
                self.client_address = (self.server.test_peer, self.client_address[1])

        self.httpd.RequestHandlerClass = SimulatedPeer
        server.CONFIG = Config({'DAVI_LAN_SIMPLE': '1', 'DAVI_PORT': str(self.port)})
        self.origin = f'http://192.168.2.10:{self.port}'
        self.parent = Client(self.port, self.origin)
        self.child = Client(self.port, self.origin)

    def test_automatic_access_completion_and_parent_password(self):
        # Fixtures legadas: hash de 310 mil iterações, recorrência e exceção.
        salt = b'synthetic-salt!!'
        encoded = salt.hex() + '$' + hashlib.pbkdf2_hmac(
            'sha256', b'Synthetic-password-123', salt, 310_000).hex()
        server.set_setting('password', encoded)
        with server.db() as c:
            eid = c.execute("INSERT INTO events(title,time,start_date,recurrence) VALUES(?,?,?,?)",
                            ('Atividade sintética', '08:00', '2026-11-16', 'daily')).lastrowid
            c.execute('INSERT INTO exceptions VALUES(?,?)', (eid, '2026-11-18'))
        with server.db() as c:
            before = list(c.iterdump())
        server.initialize()  # Reinício preserva todas as linhas da agenda legada.
        with server.db() as c:
            self.assertEqual(list(c.iterdump()), before)
        path = '/api/calendar?start=2026-11-17&end=2026-11-18'
        self.assertEqual(len(self.child.request(path)[1]['events']), 1)
        status, info, cookie = self.child.request('/api/me')
        self.assertEqual(status, 200)
        self.assertTrue(info['authorized'])
        self.assertTrue(info['simple_lan'])
        self.assertFalse(info['parent'])
        for attribute in ('HttpOnly', 'SameSite=Strict', 'Path=/'):
            self.assertIn(attribute, cookie)
        self.assertNotIn('; Secure', cookie)
        for _ in range(2):
            self.assertIsNone(self.child.request('/api/me')[2])
        done = f'/api/events/{eid}/done'
        self.assertEqual(self.child.request(done, 'POST', {'date': '2026-11-17'})[0], 200)
        self.assertTrue(self.child.request(path)[1]['events'][0]['done'])
        # Um segundo aparelho entra sem código e pode desfazer a conclusão.
        other = Client(self.port, self.origin)
        other.request('/api/me')
        self.assertEqual(other.request(done + '?date=2026-11-17', 'DELETE')[0], 200)
        self.assertFalse(other.request(path)[1]['events'][0]['done'])
        for route, method in (('/api/events', 'GET'), ('/api/events', 'POST'),
                              (f'/api/events/{eid}', 'PUT'), (f'/api/events/{eid}', 'DELETE'),
                              (f'/api/events/{eid}/skip', 'POST'), ('/api/settings', 'PUT'),
                              ('/api/devices/code', 'POST'), ('/api/devices/revoke', 'POST')):
            self.assertEqual(other.request(route, method)[0], 403, (route, method))
        self.parent.request('/api/me')
        self.assertEqual(self.parent.request('/api/login', 'POST', {'password': 'wrong'})[0], 401)
        self.assertEqual(self.parent.request('/api/login', 'POST', {'password': 'Synthetic-password-123'})[0], 200)
        self.assertTrue(self.parent.request('/api/me')[1]['parent'])
        self.assertEqual(self.parent.request('/api/events')[0], 200)
        self.assertEqual(server.get_setting('password'), encoded)
        self.assertEqual(self.parent.request('/api/logout', 'POST')[0], 200)
        self.assertFalse(self.parent.request('/api/me')[1]['parent'])
        self.assertEqual(self.parent.request('/api/events')[0], 403)

    def test_csrf_origin_host_and_network_guards(self):
        self.child.request('/api/me')
        done = '/api/events/1/done'
        for headers in ({'X-CSRF-Token': ''}, {'X-CSRF-Token': 'forged'},
                        {'Cookie': ''}, {'Cookie': 'davi_session=forged'},
                        {'Origin': ''}, {'Origin': 'null'}, {'Origin': 'http://attacker.test'},
                        {'Origin': self.origin + '.attacker.test'}, {'Host': 'attacker.test'}):
            self.assertEqual(self.child.request(done, 'POST', {'date': '2026-11-17'}, **headers)[0], 403)
            self.assertEqual(self.child.request(done + '?date=2026-11-17', 'DELETE', **headers)[0], 403)
        self.assertEqual(self.child.request(done, 'POST', **{'Content-Type': 'text/plain'})[0], 415)
        for peer in ('8.8.8.8', '192.168.3.20', '127.0.0.1', '::1', '192.168.2.0', '192.168.2.255'):
            self.httpd.test_peer = peer
            forged = {'X-Davi-Client': '192.168.2.20', 'X-Forwarded-For': '192.168.2.20'}
            for route in ('/api/me', '/api/calendar', '/api/events'):
                self.assertEqual(self.child.request(route, **forged)[0], 403, peer)
            self.assertEqual(self.child.request(done, 'POST', **forged)[0], 403, peer)

    def test_parent_rate_limit_and_lan_session_disabled_with_mode(self):
        self.child.request('/api/me')
        for _ in range(5):
            self.assertEqual(self.child.request('/api/login', 'POST', {'password': 'wrong'})[0], 401)
        self.assertEqual(self.child.request('/api/login', 'POST', {'password': 'wrong'})[0], 429)
        config = Config({'DAVI_PORT': str(self.port)})
        # Só o transporte loopback é simulado nesta transição de configuração.
        self.httpd.test_peer = '127.0.0.1'
        server.CONFIG = config
        self.child.origin = f'http://127.0.0.1:{self.port}'
        self.assertFalse(self.child.request('/api/me')[1]['authorized'])
        self.assertEqual(self.child.request('/api/calendar')[0], 403)


class SimpleConfigTests(unittest.TestCase):
    @unittest.skipUnless(os.name == 'nt', 'Inicializador específico para Windows.')
    def test_launcher_uses_existing_data_path_and_scoped_environment(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='davi LAN synthetic ') as directory:
            folder = Path(directory)
            shutil.copyfile(root / 'Iniciar-Davi-LAN.bat', folder / 'Iniciar-Davi-LAN.bat')
            # Nunca chama server.py: verifica somente o contrato do inicializador.
            (folder / 'Iniciar-Davi.bat').write_text('@echo off\nset DAVI_\ncd\nexit /b 0\n')
            env = {k: v for k, v in os.environ.items() if not k.startswith('DAVI_')}
            env.update(DAVI_LAN_SIMPLE='0', DAVI_PROXY_KEY='synthetic-proxy-key', DAVI_DATA_DIR='wrong')
            result = subprocess.run(['cmd.exe', '/d', '/c',
                                     'call Iniciar-Davi-LAN.bat && echo AFTER=%DAVI_LAN_SIMPLE%'],
                                    cwd=folder, env=env, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            for setting in ('DAVI_LAN_SIMPLE=1', 'DAVI_HOST=192.168.2.10', 'DAVI_PORT=8765',
                            'DAVI_LAN_CIDR=192.168.2.0/24', 'DAVI_ORIGINS=http://192.168.2.10:8765',
                            f'DAVI_DATA_DIR={folder}\\dados', 'AFTER=0'):
                self.assertIn(setting, result.stdout)
            self.assertNotIn('DAVI_PROXY_KEY=', result.stdout)
            self.assertFalse((folder / 'dados').exists())

    def test_opt_in_and_fixed_network_origin_bind(self):
        self.assertFalse(Config({}).simple_lan)
        config = Config({'DAVI_LAN_SIMPLE': '1'})
        self.assertEqual(config.host, '192.168.2.10')
        self.assertEqual(config.origins, {'http://192.168.2.10:8765'})
        for overrides in ({'DAVI_LAN_SIMPLE': 'yes'}, {'DAVI_HOST': '0.0.0.0'},
                          {'DAVI_HOST': '192.168.3.10'}, {'DAVI_HOST': '127.0.0.1'},
                          {'DAVI_LAN_CIDR': '192.168.0.0/16'}, {'DAVI_PROXY_KEY': 'p' * 48},
                          {'DAVI_ORIGINS': 'http://attacker.test'},
                          {'DAVI_ORIGINS': 'http://192.168.2.10:8765,http://localhost:8765'}):
            with self.assertRaises(ValueError, msg=overrides):
                Config({'DAVI_LAN_SIMPLE': '1', **overrides})
        for peer in ('192.168.2.1', '192.168.2.20', '192.168.2.254'):
            handler = SimpleNamespace(headers={'Host': '192.168.2.10:8765'}, client_address=(peer, 1234))
            self.assertEqual(config.client(handler), peer)
