"""Gera arquivos locais de publicação, sem instalar ou iniciar componentes."""
import argparse
import ipaddress
import json
from pathlib import Path
import re
import secrets
import sys
from xml.sax.saxutils import escape
from lan_security import Config


def generate(output, address, hostname='aventuras.davi.costa', port=443, app_port=8765):
    root = Path(__file__).resolve().parent
    output = Path(output).resolve()
    if output.exists():
        raise ValueError('Destino já existe; preserve configuração e CA. Escolha pasta nova.')
    if hostname != 'aventuras.davi.costa' and not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.home\.arpa', hostname):
        raise ValueError('Use aventuras.davi.costa ou hostname simples em .home.arpa.')
    ip = ipaddress.ip_address(address)
    network = ipaddress.ip_network('192.168.2.0/24')
    if ip not in network or ip in (network.network_address, network.broadcast_address):
        raise ValueError('Informe IP utilizável da LAN 192.168.2.0/24.')
    if not 1 <= port <= 65535 or not 1024 <= app_port <= 65535 or port == app_port:
        raise ValueError('Portas inválidas ou iguais.')
    suffix = '' if port == 443 else f':{port}'
    definitive = hostname == 'aventuras.davi.costa'
    if definitive and (address != '192.168.2.10' or port != 443 or app_port != 8765):
        raise ValueError('V0.5 exige 192.168.2.10, HTTPS 443 e backend 8765.')
    origins = [f'https://{hostname}{suffix}']
    config = {'DAVI_HOST': '127.0.0.1', 'DAVI_PORT': str(app_port),
              'DAVI_DATA_DIR': str(root / 'dados'), 'DAVI_LAN_CIDR': str(network),
              'DAVI_ORIGINS': ','.join(origins), 'DAVI_PROXY_KEY': secrets.token_urlsafe(48),
              'DAVI_LAN_SIMPLE': '0', 'DAVI_CHILD_AUTO': '1' if definitive else '0'}
    Config(config)
    output.mkdir(parents=True)
    for name in ('logs', 'caddy-data', 'bin'):
        (output / name).mkdir()
    (output / 'config.json').write_text(json.dumps(config, indent=2) + '\n', encoding='utf-8')
    # Sem admin API, redirecionador HTTP, QUIC ou CA instalada automaticamente.
    caddy = f'''{{
    admin off
    auto_https disable_redirects
    skip_install_trust
    storage file_system {{
        root "{(output / 'caddy-data').as_posix()}"
    }}
    servers {{
        protocols h1 h2
    }}
}}
{', '.join(origins)} {{
    bind {address}
    tls internal
    @denied not remote_ip {network}
    respond @denied 403
    reverse_proxy 127.0.0.1:{app_port} {{
        header_up X-Davi-Proxy {config['DAVI_PROXY_KEY']}
        header_up X-Davi-Client {{remote_host}}
    }}
}}
'''
    (output / 'Caddyfile').write_text(caddy, encoding='utf-8')
    (output / 'network.json').write_text(json.dumps({'address': address, 'port': port, 'subnet': str(network), 'origins': origins}, indent=2), encoding='utf-8')

    def xml(service, executable, arguments, env, dependency=''):
        x = lambda value: escape(str(value), {'"': '&quot;'})
        return f'''<service>
  <id>{service}</id><name>{service}</name><description>Aventuras do Davi LAN</description>
  <executable>{x(executable)}</executable><arguments>{x(arguments)}</arguments>
  <workingdirectory>{x(root)}</workingdirectory><startmode>Automatic</startmode>
  <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user></serviceaccount>
  {dependency}
  <onfailure action="restart" delay="10 sec"/><stoptimeout>20 sec</stoptimeout>
  <logpath>{x(output / 'logs')}</logpath><log mode="roll-by-size"><sizeThreshold>1024</sizeThreshold><keepFiles>5</keepFiles></log>
  {''.join(f'<env name="{x(k)}" value="{x(v)}"/>' for k, v in env.items())}
</service>
'''
    (output / 'DaviApp.xml').write_text(xml('DaviApp', sys.executable,
        f'-u "{root / "run_service.py"}" "{output / "config.json"}"', {}), encoding='utf-8')
    (output / 'DaviProxy.xml').write_text(xml('DaviProxy', output / 'bin' / 'caddy.exe',
        f'run --config "{output / "Caddyfile"}" --adapter caddyfile',
        {'XDG_DATA_HOME': str(output / 'caddy-data'), 'XDG_CONFIG_HOME': str(output / 'caddy-data')},
        '<depend>DaviApp</depend>'), encoding='utf-8')
    return config


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--address', required=True)
    p.add_argument('--hostname', default='aventuras.davi.costa')
    p.add_argument('--port', type=int, default=443)
    p.add_argument('--app-port', type=int, default=8765)
    a = p.parse_args()
    generate(a.output, a.address, a.hostname, a.port, a.app_port)
    print('Preparação concluída; nenhum serviço ou regra foi aplicado. Proteja os arquivos locais.')
