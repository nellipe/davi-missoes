"""Homologação sintética isolada. Não instala serviços, CA ou regras de firewall."""
import argparse
import datetime as dt
import hashlib
import http.client
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import ssl
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
INSTANCE = ROOT / '.homologacao-floresta'
DATA = INSTANCE / 'synthetic-data'
MARKER = 'floresta-pr17-synthetic-v1'
sys.path.insert(0, str(ROOT))


def clean_env():
    return {k: v for k, v in os.environ.items() if not k.startswith('DAVI_')}


def config():
    manifest = json.loads((INSTANCE / 'instance.json').read_text())
    c = json.loads((INSTANCE / 'config.json').read_text())
    if (manifest['marker'] != MARKER or Path(c['DAVI_DATA_DIR']).resolve() != DATA.resolve()
            or c['DAVI_HOST'] != '127.0.0.1' or c['DAVI_PORT'] != '18765'
            or c['DAVI_ORIGINS'] != 'https://192.168.2.10:18443'):
        raise ValueError('Instância de teste inválida; execução recusada.')
    return c


def seed():
    os.environ.clear()
    os.environ.update({**clean_env_saved, **config()})
    import server
    import missions
    server.initialize()
    password = secrets.token_urlsafe(18)
    server.set_setting('password', server.hash_password(password))
    server.set_setting('name', 'Explorador sintético')
    now = dt.datetime.now(server.TZ)
    with server.db() as c:
        for title, instant, duration, template in [
            ('TESTE · Missão aberta', now - dt.timedelta(minutes=10), 60, 'mochila'),
            ('TESTE · Missão futura', now + dt.timedelta(hours=2), 30, 'taekwondo'),
            ('TESTE · Missão encerrada', now - dt.timedelta(hours=3), 30, 'mochila'),
            ('TESTE · História sem roteiro', now, 30, None),
        ]:
            values = server.validate_event({'title': title, 'time': instant.strftime('%H:%M'),
                'duration': duration, 'start_date': instant.date().isoformat(), 'recurrence': 'daily'})
            eid = c.execute(f'INSERT INTO events({server.FIELDS}) VALUES({",".join("?" for _ in values)})', values).lastrowid
            if template:
                missions.assign(c, eid, '', template)
        c.execute("INSERT INTO world_ledger(id,delta,label,day) VALUES('synthetic:qa',100,'Crédito exclusivamente sintético',?)", (now.date().isoformat(),))
        c.execute('UPDATE world_state SET x=530,y=424')
    (INSTANCE / 'credenciais-teste.txt').write_text('Responsável sintético: ' + password + '\n', encoding='utf-8')


def prepare(caddy):
    if INSTANCE.exists():
        raise ValueError('Instância já existe. Reutilize com run; não sobrescrevemos banco ou CA.')
    executable = Path(caddy).resolve(strict=True)
    if executable.name.lower() != 'caddy.exe':
        raise ValueError('Informe o executável Caddy.')
    INSTANCE.mkdir()
    (INSTANCE / 'logs').mkdir()
    shutil.copy2(executable, INSTANCE / 'caddy.exe')
    cfg = {'DAVI_HOST': '127.0.0.1', 'DAVI_PORT': '18765', 'DAVI_DATA_DIR': str(DATA),
        'DAVI_LAN_CIDR': '192.168.2.0/24', 'DAVI_ORIGINS': 'https://192.168.2.10:18443',
        'DAVI_PROXY_KEY': secrets.token_urlsafe(48), 'DAVI_LAN_SIMPLE': '0', 'DAVI_CHILD_AUTO': '0'}
    from lan_security import Config
    Config(cfg)
    (INSTANCE / 'config.json').write_text(json.dumps(cfg, indent=2))
    (INSTANCE / 'instance.json').write_text(json.dumps({'marker': MARKER,
        'base': '21e0aa1fa70825ababf42b81eb1a053a797b2dd5', 'created': dt.datetime.now(dt.timezone.utc).isoformat(),
        'caddySha256': hashlib.sha256((INSTANCE / 'caddy.exe').read_bytes()).hexdigest()}, indent=2))
    caddyfile = '''{
    admin off
    auto_https disable_redirects
    skip_install_trust
    storage file_system {
        root "%s"
    }
    servers {
        protocols h1 h2
    }
}
https://192.168.2.10:18443 {
    bind 192.168.2.10
    tls internal
    @denied not remote_ip 192.168.2.0/24
    respond @denied 403
    reverse_proxy 127.0.0.1:18765 {
        header_up X-Davi-Proxy %s
        header_up X-Davi-Client {remote_host}
    }
}
''' % ((INSTANCE / 'caddy-data').as_posix(), cfg['DAVI_PROXY_KEY'])
    (INSTANCE / 'Caddyfile').write_text(caddyfile)
    subprocess.run([sys.executable, str(Path(__file__)), '_seed'], env=clean_env(), check=True)
    print('Instância preparada em', INSTANCE, '\nNenhum serviço, CA ou firewall instalado.')


def run():
    config()
    processes = []
    logs = []
    # Recusa usar listeners existentes, inclusive uma segunda homologação.
    for address, port in [('127.0.0.1', 18765), ('192.168.2.10', 18443)]:
        with socket.socket() as sock:
            sock.bind((address, port))
    (INSTANCE / 'stop.request').unlink(missing_ok=True)
    env = clean_env()
    env.update({'XDG_DATA_HOME': str(INSTANCE / 'xdg-data'), 'XDG_CONFIG_HOME': str(INSTANCE / 'xdg-config')})
    try:
        for name, command in [
            ('backend', [sys.executable, '-u', str(ROOT / 'run_service.py'), str(INSTANCE / 'config.json')]),
            ('proxy', [str(INSTANCE / 'caddy.exe'), 'run', '--config', str(INSTANCE / 'Caddyfile'), '--adapter', 'caddyfile']),
        ]:
            log = (INSTANCE / 'logs' / (name + '.log')).open('ab')
            logs.append(log)
            processes.append(subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=log,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0))
        print('TESTE SINTÉTICO: https://192.168.2.10:18443/?homologacao=1', flush=True)
        while not (INSTANCE / 'stop.request').exists():
            if any(p.poll() is not None for p in processes):
                raise RuntimeError('Processo de teste encerrou. Consulte .homologacao-floresta/logs.')
            time.sleep(.5)
    except KeyboardInterrupt:
        pass
    finally:
        for p in processes:
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    p.kill()
                    p.wait()
        for log in logs:
            log.close()
        (INSTANCE / 'stop.request').unlink(missing_ok=True)


def verified_request(path, method='GET', body=None, cookie='', csrf=''):
    config()
    ca = INSTANCE / 'caddy-data/pki/authorities/local/root.crt'
    conn = http.client.HTTPSConnection('192.168.2.10', 18443, context=ssl.create_default_context(cafile=str(ca)), timeout=10)
    conn.request(method, path, json.dumps(body or {}) if body is not None else None,
        {'Origin': 'https://192.168.2.10:18443', 'Content-Type': 'application/json', 'Cookie': cookie, 'X-CSRF-Token': csrf})
    response = conn.getresponse()
    result = (response.status, json.loads(response.read()), response.getheader('Set-Cookie', '').split(';')[0])
    conn.close()
    if result[0] >= 400:
        raise RuntimeError(f'HTTPS {result[0]}: {result[1]}')
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'run', 'stop', 'status', 'pair', '_seed'])
    parser.add_argument('--caddy')
    args = parser.parse_args()
    clean_env_saved = clean_env()
    if args.action == 'prepare':
        if not args.caddy:
            parser.error('prepare exige --caddy apontando para caddy.exe')
        prepare(args.caddy)
    elif args.action == '_seed':
        config()
        if (DATA / 'agenda.sqlite3').exists():
            raise ValueError('Seed recusado: banco já existe.')
        seed()
    elif args.action == 'run':
        run()
    elif args.action == 'stop':
        config()
        (INSTANCE / 'stop.request').touch()
        print('Solicitação de parada somente para a homologação enviada.')
    elif args.action == 'status':
        print(json.dumps(verified_request('/api/me')[1], indent=2))
        print('HTTPS e cadeia da CA de teste verificados.')
    elif args.action == 'pair':
        config()
        os.environ.clear()
        os.environ.update({**clean_env_saved, **config()})
        from lan_security import AuthStore
        print('Código infantil de TESTE (uso único, 10 minutos):', AuthStore(DATA).pair_code())
