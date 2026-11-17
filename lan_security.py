"""Configuração fechada por padrão; credenciais separadas da agenda legada."""
import contextlib
import hashlib
import ipaddress
import os
import secrets
import sqlite3
import time
from pathlib import Path
from urllib.parse import urlsplit


class Config:
    def __init__(self, env=None):
        e = os.environ if env is None else env
        self.host = e.get('DAVI_HOST', '127.0.0.1')
        self.port = int(e.get('DAVI_PORT', '8765'))
        if not 1 <= self.port <= 65535:
            raise ValueError('Porta inválida.')
        self.network = ipaddress.ip_network(e.get('DAVI_LAN_CIDR', '192.168.2.0/24'))
        if self.network.version != 4 or not self.network.subnet_of(ipaddress.ip_network('192.168.0.0/16')):
            raise ValueError('A sub-rede deve pertencer à faixa privada 192.168.0.0/16.')
        ip = ipaddress.ip_address(self.host)
        if ip.version != 4 or (not ip.is_loopback and (ip not in self.network or ip in (self.network.network_address, self.network.broadcast_address))):
            raise ValueError('DAVI_HOST deve ser loopback ou IP explícito da LAN autorizada.')
        self.proxy_key = e.get('DAVI_PROXY_KEY', '')
        self.origins = set(e.get('DAVI_ORIGINS', f'http://127.0.0.1:{self.port},http://localhost:{self.port}').split(','))
        for origin in self.origins:
            u = urlsplit(origin)
            if u.username or u.password or u.path or u.query or u.fragment or not u.hostname or not 1 <= (u.port or 443) <= 65535:
                raise ValueError('Origem deve ser exata, sem caminho ou credenciais.')
            if self.proxy_key:
                try:
                    valid_host = ipaddress.ip_address(u.hostname) in self.network
                except ValueError:
                    valid_host = u.hostname.endswith('.home.arpa')
                if u.scheme != 'https' or not valid_host:
                    raise ValueError('Publicação exige HTTPS e hostname .home.arpa ou IP da LAN.')
            elif u.scheme != 'http' or u.hostname not in ('127.0.0.1', 'localhost') or u.port != self.port:
                raise ValueError('Sem proxy, somente HTTP loopback é permitido.')
        if not ip.is_loopback and not self.proxy_key:
            raise ValueError('Escuta LAN exige proxy HTTPS autenticado.')
        if self.proxy_key and len(self.proxy_key) < 43:
            raise ValueError('Chave do proxy deve ter pelo menos 43 caracteres aleatórios.')
        self.secure = bool(self.proxy_key)
        self.hosts = {urlsplit(o).netloc for o in self.origins}

    def client(self, handler):
        if handler.headers.get('Host') not in self.hosts:
            return None
        peer = ipaddress.ip_address(handler.client_address[0])
        if self.secure:
            # O proxy local sobrescreve os dois cabeçalhos, inclusive vindos do cliente.
            if not (peer.is_loopback or str(peer) == self.host):
                return None
            if not secrets.compare_digest(handler.headers.get('X-Davi-Proxy', ''), self.proxy_key):
                return None
            try:
                client = ipaddress.ip_address(handler.headers.get('X-Davi-Client', ''))
            except ValueError:
                return None
            return str(client) if client in self.network else None
        return str(peer) if peer.is_loopback else None


def digest(token):
    return hashlib.sha256(token.encode()).hexdigest()


class AuthStore:
    def __init__(self, directory):
        self.path = Path(directory) / 'auth.sqlite3'

    @contextlib.contextmanager
    def db(self):
        c = sqlite3.connect(self.path, timeout=10)
        c.row_factory = sqlite3.Row
        try:
            with c:
                yield c
        finally:
            c.close()

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.db() as c:
            c.executescript('''
                CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, role TEXT NOT NULL,
                    csrf TEXT NOT NULL, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS pairing(token TEXT PRIMARY KEY, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS attempts(bucket TEXT NOT NULL, at REAL NOT NULL);
                CREATE INDEX IF NOT EXISTS attempts_bucket ON attempts(bucket,at);
            ''')

    def limited(self, client):
        now = time.time()
        with self.db() as c:
            c.execute('BEGIN IMMEDIATE')
            c.execute('DELETE FROM attempts WHERE at < ?', (now - 900,))
            count = c.execute('SELECT COUNT(*) FROM attempts WHERE bucket=?', (client,)).fetchone()[0]
            total = c.execute('SELECT COUNT(*) FROM attempts').fetchone()[0]
            if count >= 5 or total >= 50:
                return True
            c.execute('INSERT INTO attempts VALUES(?,?)', (client, now))
        return False

    def create_session(self, role):
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        age = 28800 if role == 'parent' else 90 * 86400
        with self.db() as c:
            c.execute('DELETE FROM sessions WHERE expires <= ?', (time.time(),))
            c.execute('INSERT INTO sessions VALUES(?,?,?,?)', (digest(token), role, csrf, time.time() + age))
        return token, age

    def session(self, token):
        with self.db() as c:
            row = c.execute('SELECT * FROM sessions WHERE token=? AND expires>?', (digest(token), time.time())).fetchone()
        return dict(row) if row else None

    def revoke(self, token):
        with self.db() as c:
            c.execute('DELETE FROM sessions WHERE token=?', (digest(token),))

    def pair_code(self):
        code = secrets.token_urlsafe(16)
        with self.db() as c:
            c.execute('DELETE FROM pairing')
            c.execute('INSERT INTO pairing VALUES(?,?)', (digest(code), time.time() + 600))
        return code

    def redeem(self, code):
        with self.db() as c:
            result = c.execute('DELETE FROM pairing WHERE token=? AND expires>?', (digest(code), time.time()))
            return result.rowcount == 1

    def revoke_children(self):
        with self.db() as c:
            c.execute("DELETE FROM sessions WHERE role='child'")
            c.execute('DELETE FROM pairing')
