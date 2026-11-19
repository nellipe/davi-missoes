"""Reproduce Windows upstream connection refusals on temporary loopback ports."""

import argparse
from collections import Counter
from contextlib import contextmanager
import datetime as dt
import http.client
import json
import os
from pathlib import Path
import secrets
import socket
import ssl
import subprocess
import sys
import tempfile
from threading import Event, Thread
import time


ROOT = Path(__file__).resolve().parent.parent
HOST = 'davi-stability.home.arpa'
CREATE = getattr(subprocess, 'CREATE_NO_WINDOW', 0)


def port():
    with socket.socket() as listener:
        listener.bind(('127.0.0.1', 0))
        return listener.getsockname()[1]


@contextmanager
def process(args, cwd, env, log):
    with log.open('wb') as sink:
        child = subprocess.Popen(args, cwd=cwd, env=env, stdout=sink,
                                 stderr=subprocess.STDOUT, creationflags=CREATE)
        try:
            yield child
        finally:
            if child.poll() is None:
                child.terminate()
                child.wait(timeout=8)


def tls_get(proxy, ca, path):
    context = ssl.create_default_context(cafile=str(ca))
    with context.wrap_socket(socket.create_connection(('127.0.0.1', proxy), timeout=2),
                             server_hostname=HOST) as connection:
        connection.sendall(f'GET {path} HTTP/1.1\r\nHost: {HOST}:{proxy}\r\nConnection: close\r\n\r\n'.encode())
        response = http.client.HTTPResponse(connection)
        response.begin()
        return response.status, response.read()


def browser_certificate(proxy, ca, target):
    context = ssl.create_default_context(cafile=str(ca))
    with context.wrap_socket(socket.create_connection(('127.0.0.1', proxy), timeout=2),
                             server_hostname=HOST) as connection:
        target.write_text(ssl.DER_cert_to_PEM_cert(connection.getpeercert(binary_form=True)), encoding='ascii')


def run_gate(proxy_port, ca, login, expected, env):
    certificate = login.with_name('leaf.crt')
    browser_certificate(proxy_port, ca, certificate)
    origin = [HOST, '127.0.0.1', str(proxy_port)]
    http = [sys.executable, '-B', str(ROOT / 'scripts/publicacao_revisao.py'),
            'stable', *origin, str(ca), expected, '--session-file', str(login)]
    chromium = ['node', str(ROOT / 'scripts/verificar-floresta.cjs'), *origin, expected,
                '3', str(login), str(certificate)]
    gate = {}
    for phase, args in [('https', http), ('chromium', chromium)]:
        result = subprocess.run(args, capture_output=True, text=True, encoding='utf-8',
                                env=env, timeout=100, creationflags=CREATE)
        gate[phase] = {'exit': result.returncode, 'report': json.loads(result.stdout) if result.stdout else None}
    return gate


def wait_for_build(proxy, ca, backend, backend_port, caddy):
    deadline = time.monotonic() + 12
    while time.monotonic() < deadline:
        if backend.poll() is not None or caddy.poll() is not None:
            raise RuntimeError('processo sintético encerrou antes de /api/build')
        if ca.is_file():
            try:
                with socket.create_connection(('127.0.0.1', backend_port), timeout=.12):
                    pass
                status, body = tls_get(proxy, ca, '/api/build')
                if status == 200:
                    return json.loads(body)
            except (OSError, http.client.HTTPException):
                pass
        time.sleep(.04)
    raise RuntimeError('build sintético indisponível')


def proxy_errors(log):
    errors = []
    for line in log.read_text(encoding='utf-8').splitlines():
        try:
            record = json.loads(line)
        except ValueError:
            continue
        if record.get('status') != 502:
            continue
        message = record.get('msg', '').lower()
        errors.append({
            'path': record.get('request', {}).get('uri', '').split('?')[0],
            'upstream_refused': 'refused' in message or 'winerror 10061' in message,
            'time': dt.datetime.fromtimestamp(record['ts'], dt.timezone.utc).isoformat(),
        })
    return errors


def experiment(temp, checkout, caddy_exe, backlog, rounds, width, repeats, gate):
    backend_port, proxy_port = port(), port()
    if backend_port == proxy_port:
        raise RuntimeError('portas sintéticas coincidiram')
    key = secrets.token_urlsafe(48)
    env = {k: v for k, v in os.environ.items() if not k.startswith('DAVI_')}
    env.update(DAVI_HOST='127.0.0.1', DAVI_PORT=str(backend_port),
               DAVI_DATA_DIR=str(temp / 'dados'), DAVI_ORIGINS=f'https://{HOST}:{proxy_port}',
               DAVI_PROXY_KEY=key)
    backend_config = temp / 'backend.json'
    backend_config.write_text(json.dumps({k:v for k,v in env.items() if k.startswith('DAVI_')}),
                              encoding='utf-8')
    login = temp / 'child.json'
    env['STABILITY_CHILD'] = str(login)
    seed = """import json,os,server
server.initialize()
token,_=server.AUTH.create_session('child')
with open(os.environ['STABILITY_CHILD'],'w') as f:
    json.dump(dict(cookie='davi_session='+token,day=server.today().isoformat()),f)
"""
    subprocess.run([sys.executable, '-B', '-c', seed], cwd=checkout, env=env,
                   creationflags=CREATE, check=True)
    config = temp / 'Caddyfile'
    config.write_text(f'''{{
    admin off
    auto_https disable_redirects
    skip_install_trust
    storage file_system {{
        root "{(temp / 'pki').as_posix()}"
    }}
    servers {{
        protocols h1 h2
    }}
}}
https://{HOST}:{proxy_port} {{
    bind 127.0.0.1
    tls internal
    reverse_proxy 127.0.0.1:{backend_port} {{
        header_up X-Davi-Proxy {key}
        header_up X-Davi-Client 192.168.2.2
    }}
}}
''', encoding='utf-8')
    ca = temp / 'pki' / 'pki' / 'authorities' / 'local' / 'root.crt'
    launch_args = [sys.executable, '-B', '-u', str(checkout / 'run_service.py'), str(backend_config)]
    if backlog:
        # Controlled intervention for the reproduction. All other inputs stay identical.
        bootstrap = ('import runpy, server, sys; '
                     f'getattr(server, "DaviHTTPServer", server.ThreadingHTTPServer).request_queue_size={backlog}; '
                     'script=sys.argv.pop(1); runpy.run_path(script,run_name="__main__")')
        launch_args[3:3] = ['-c', bootstrap]
    output = []
    for launch in range(repeats):
        caddy_log, backend_log = temp / f'caddy-{launch}.log', temp / f'python-{launch}.log'
        with process(launch_args, checkout, env, backend_log) as backend:
            with process([str(caddy_exe), 'run', '--config', str(config), '--adapter', 'caddyfile'],
                         checkout, env, caddy_log) as proxy:
                start = time.monotonic()
                build = wait_for_build(proxy_port, ca, backend, backend_port, proxy)
                ready_ms = round((time.monotonic()-start)*1000)
                stop = Event()
                samples = Counter()

                def watch():
                    while not stop.is_set():
                        state = 'exit' if backend.poll() is not None else 'alive'
                        with socket.socket() as connection:
                            connection.settimeout(.12)
                            try:
                                code = connection.connect_ex(('127.0.0.1', backend_port))
                            except OSError as exc:
                                code = exc.winerror if hasattr(exc,'winerror') else exc.errno
                        samples[f'{state}:{code}'] += 1
                        stop.wait(.025)

                monitor = Thread(target=watch)
                monitor.start()
                try:
                    client = subprocess.run(
                        ['node', str(ROOT / 'tests/backend_stability_client.cjs'), str(proxy_port),
                         str(ca), str(login), str(rounds), str(width)], capture_output=True,
                        text=True, check=True, timeout=100, creationflags=CREATE)
                    measured = json.loads(client.stdout)
                    if gate:
                        measured['gate'] = run_gate(proxy_port, ca, login, build['commit'], env)
                finally:
                    stop.set()
                    monitor.join()
                sustained = tls_get(proxy_port, ca, '/api/build')[0]
                output.append(dict(start=launch+1, build=build, ready_ms=ready_ms,
                                   alive=backend.poll() is None, samples=dict(samples),
                                   build_after=sustained, **measured))
        errors = proxy_errors(caddy_log)
        output[-1]['caddy_502'] = len(errors)
        output[-1]['caddy_refused'] = sum(e['upstream_refused'] for e in errors)
        output[-1]['example'] = next((e for e in errors if e['upstream_refused']), None)
        output[-1]['python_traceback'] = 'Traceback' in backend_log.read_text(encoding='utf-8')
    return output


if __name__ == '__main__':
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--caddy', type=Path, required=True)
    cli.add_argument('--checkout', type=Path, default=ROOT)
    cli.add_argument('--backlog', type=int, default=0, help='Optional experimental listen queue override')
    cli.add_argument('--rounds', type=int, default=20)
    cli.add_argument('--concurrency', type=int, default=24)
    cli.add_argument('--starts', type=int, default=3)
    cli.add_argument('--expect-stable', action='store_true')
    cli.add_argument('--gate', action='store_true', help='Also run the publisher HTTPS and Chromium gates')
    args = cli.parse_args()
    with tempfile.TemporaryDirectory(prefix='davi-stability-synthetic-') as area:
        result = experiment(Path(area), args.checkout.resolve(), args.caddy.resolve(), args.backlog,
                            args.rounds, args.concurrency, args.starts, args.gate)
        for sample in result:
            sample['failure_count'] = len(sample['failed'])
            sample['failed'] = sample['failed'][:6]
        print(json.dumps(dict(backlog_override=args.backlog, concurrency=args.concurrency,
                              runs=result), indent=2))
        if args.expect_stable and any(run['failure_count'] or run['caddy_502'] or
                                      not run['alive'] or run['python_traceback'] or
                                      run['requests'] != args.rounds*args.concurrency or
                                      run['protocol'] != 'h2' or
                                      any(gate['exit'] for gate in run.get('gate', {}).values())
                                      for run in result):
            sys.exit(1)
