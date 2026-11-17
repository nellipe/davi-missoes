"""Caddy real, apenas loopback e CA temporária confiada explicitamente pelo cliente."""
import http.client
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from prepare_lan import generate


@unittest.skipUnless(os.environ.get('DAVI_TEST_CADDY'), 'Defina DAVI_TEST_CADDY para executar TLS real em loopback.')
class TlsTests(unittest.TestCase):
    def test_caddy_validation_and_verified_tls(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='davi-tls-synthetic-') as directory:
            folder = Path(directory)
            def port():
                with socket.socket() as sock:
                    sock.bind(('127.0.0.1', 0))
                    return sock.getsockname()[1]
            app_port, tls_port = port(), port()
            publication = folder / 'publication'
            config = generate(publication, '192.168.2.10', port=tls_port, app_port=app_port)
            config['DAVI_DATA_DIR'] = str(folder / 'data')
            config_path = publication / 'config.json'
            config_path.write_text(json.dumps(config))
            # Bootstrap offline, exclusivamente no diretório temporário.
            env = {**os.environ, **config}
            subprocess.run([sys.executable, '-c', "import server; server.initialize(); server.set_setting('password',server.hash_password('Synthetic-password-123'))"],
                           cwd=root, env=env, check=True, capture_output=True)
            caddy = os.environ['DAVI_TEST_CADDY']
            caddy_env = {**os.environ, 'XDG_DATA_HOME':str(folder/'ca'), 'XDG_CONFIG_HOME':str(folder/'ca')}
            caddyfile = publication / 'Caddyfile'
            # Adaptar a configuração original não abre listener nem instala CA.
            result = subprocess.run([caddy,'adapt','--config',str(caddyfile),'--adapter','caddyfile'],
                                    env=caddy_env, check=True, capture_output=True)
            self.assertIn(b'192.168.2.10',result.stdout)
            # Simula origem LAN. Nenhuma interface LAN real recebe listener no teste.
            content=caddyfile.read_text().replace('bind 192.168.2.10','bind 127.0.0.1').replace('remote_ip 192.168.2.0/24','remote_ip 127.0.0.1/32').replace('X-Davi-Client {remote_host}','X-Davi-Client 192.168.2.20')
            caddyfile.write_text(content)
            processes=[]
            try:
                processes.append(subprocess.Popen([sys.executable,str(root/'run_service.py'),str(config_path)],cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL))
                processes.append(subprocess.Popen([caddy,'run','--config',str(caddyfile),'--adapter','caddyfile'],env=caddy_env,cwd=folder,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL))
                certificate=folder/'ca/caddy/pki/authorities/local/root.crt'
                for _ in range(150):
                    if certificate.exists():
                        try:
                            with socket.create_connection(('127.0.0.1',app_port),timeout=.1): pass
                            with socket.create_connection(('127.0.0.1',tls_port),timeout=.1): break
                        except OSError: pass
                    if any(p.poll() is not None for p in processes): self.fail('Processo TLS terminou inesperadamente.')
                    time.sleep(.05)
                self.assertTrue(certificate.exists())
                def request(context,path='/api/me',method='GET',body=None,cookie='',csrf=''):
                    raw=socket.create_connection(('127.0.0.1',tls_port),timeout=5)
                    try:
                        wrapped=context.wrap_socket(raw,server_hostname='davi.home.arpa')
                    except Exception:
                        raw.close()
                        raise
                    connection=http.client.HTTPConnection('davi.home.arpa',tls_port)
                    connection.sock=wrapped
                    origin=f'https://davi.home.arpa:{tls_port}'
                    connection.request(method,path,json.dumps(body or {}) if method=='POST' else None,
                        {'Origin':origin,'Content-Type':'application/json','Cookie':cookie,'X-CSRF-Token':csrf})
                    response=connection.getresponse()
                    result=response.status,json.loads(response.read()),response.getheader('Set-Cookie')
                    connection.close()
                    return result
                with self.assertRaises(ssl.SSLCertVerificationError): request(ssl.create_default_context())
                trusted=ssl.create_default_context(cafile=str(certificate))
                self.assertEqual(request(trusted)[0],200)
                self.assertEqual(request(trusted,'/api/calendar')[0],403)
                status,_,cookie=request(trusted,'/api/login','POST',{'password':'Synthetic-password-123'})
                self.assertEqual(status,200)
                self.assertIn('; Secure',cookie)
                cookie=cookie.split(';')[0]
                info=request(trusted,cookie=cookie)[1]
                self.assertTrue(info['parent'])
                self.assertEqual(request(trusted,'/api/calendar',cookie=cookie)[0],200)
                self.assertEqual(request(trusted,'/api/logout','POST',cookie=cookie,csrf=info['csrf'])[0],200)
                self.assertEqual(request(trusted,'/api/calendar',cookie=cookie)[0],403)
            finally:
                for process in reversed(processes):
                    process.terminate()
                    process.wait(timeout=15)


if __name__ == '__main__': unittest.main()
