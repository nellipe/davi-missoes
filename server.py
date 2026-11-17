#!/usr/bin/env python3
"""Aventuras do Davi: servidor local, SQLite e sessão de responsável (biblioteca padrão)."""
import calendar
from contextlib import contextmanager
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import RLock, Thread, Event
from urllib.parse import urlsplit, parse_qs
from lan_security import Config, AuthStore

ROOT = Path(__file__).resolve().parent
DATA = Path(os.environ.get("DAVI_DATA_DIR", ROOT / "dados")).resolve()
DB = DATA / "agenda.sqlite3"
CONFIG = Config()
HOST, PORT = CONFIG.host, CONFIG.port
AUTH = AuthStore(DATA)
TZ = dt.timezone(dt.timedelta(hours=-3), "America/Sao_Paulo")
LOCK = RLock()
MAX_BODY = 100_000
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
WEEKDAYS = {0, 1, 2, 3, 4, 5, 6}

def today():
    return dt.datetime.now(TZ).date()

def parse_date(s):
    if not isinstance(s, str) or not DATE.fullmatch(s):
        raise ValueError("Data inválida.")
    return dt.date.fromisoformat(s)

@contextmanager
def db():
    """Transação que também encerra a conexão, inclusive em caso de erro.

    sqlite3.Connection.__exit__ sozinho não fecha o arquivo no Windows.
    """
    connection = sqlite3.connect(DB, timeout=10)
    try:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        with connection:
            yield connection
    finally:
        connection.close()

def initialize():
    DATA.mkdir(parents=True, exist_ok=True)
    AUTH.initialize()
    with db() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS events(
          id INTEGER PRIMARY KEY, title TEXT NOT NULL, time TEXT NOT NULL,
          duration INTEGER NOT NULL DEFAULT 30, icon TEXT NOT NULL DEFAULT '⭐',
          notes TEXT NOT NULL DEFAULT '', start_date TEXT NOT NULL,
          end_date TEXT, recurrence TEXT NOT NULL DEFAULT 'none',
          weekdays TEXT NOT NULL DEFAULT '[]', skip_weekends INTEGER NOT NULL DEFAULT 0,
          skip_holidays INTEGER NOT NULL DEFAULT 0, mission TEXT NOT NULL DEFAULT '',
          created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS exceptions(
          event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          date TEXT NOT NULL, PRIMARY KEY(event_id,date));
        CREATE TABLE IF NOT EXISTS completions(
          event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          date TEXT NOT NULL, completed_at TEXT NOT NULL,
          PRIMARY KEY(event_id,date));
        """)
        c.execute("INSERT OR IGNORE INTO settings VALUES('name','Davi')")

def set_setting(k, v):
    with LOCK, db() as c:
        c.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (k, v))

def get_setting(k):
    with db() as c:
        r = c.execute("SELECT value FROM settings WHERE key=?", (k,)).fetchone()
    return r["value"] if r else None

def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
    return "pbkdf2_sha256$600000$" + salt.hex() + "$" + key.hex()

def verify_password(password, encoded):
    try:
        parts = encoded.split("$")
        if len(parts) == 2:
            salt_hex, key_hex = parts
            iterations = 310_000  # Compatibilidade com senhas existentes, sem regravar a agenda.
        else:
            algorithm, count, salt_hex, key_hex = parts
            if algorithm != 'pbkdf2_sha256' or count != '600000': return False
            iterations = int(count)
        test = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt_hex), iterations).hex()
        return hmac.compare_digest(test, key_hex)
    except (ValueError, AttributeError):
        return False

def easter(year):
    a=year%19; b=year//100; c=year%100; d=b//4; e=b%4
    f=(b+8)//25; g=(b-f+1)//3; h=(19*a+b-d-g+15)%30
    i=c//4; k=c%4; l=(32+2*e+2*i-h-k)%7
    m=(a+11*h+22*l)//451
    month=(h+l-7*m+114)//31
    day=(h+l-7*m+114)%31+1
    return dt.date(year,month,day)

def holiday_map(year):
    p=easter(year)
    fixed = {
      (1,1):("Confraternização Universal","nacional"),
      (4,21):("Tiradentes","nacional"),
      (5,1):("Dia do Trabalho","nacional"),
      (9,7):("Independência do Brasil","nacional"),
      (10,12):("Nossa Senhora Aparecida","nacional"),
      (11,2):("Finados","nacional"),
      (11,15):("Proclamação da República","nacional"),
      (11,20):("Dia Nacional de Zumbi e da Consciência Negra","nacional"),
      (12,25):("Natal","nacional"),
      (3,23):("Emancipação de Florianópolis","municipal")
    }
    result={dt.date(year,m,d).isoformat():{"name":n,"kind":k} for (m,d),(n,k) in fixed.items()}
    result[(p-dt.timedelta(days=2)).isoformat()]={"name":"Sexta-feira Santa","kind":"municipal"}
    result[(p+dt.timedelta(days=60)).isoformat()]={"name":"Corpus Christi","kind":"municipal"}
    return result

def matches(event, day):
    start = parse_date(event["start_date"])
    if day < start or (event["end_date"] and day>parse_date(event["end_date"])):
        return False
    frequency = event["recurrence"]
    delta=(day-start).days
    weekdays=json.loads(event["weekdays"])
    if frequency=="none" and day!=start: return False
    if frequency=="daily":
        pass
    elif frequency=="weekdays":
        if day.weekday()>4: return False
    elif frequency=="weekly":
        if day.weekday() not in weekdays: return False
    elif frequency=="monthly":
        if day.day!=start.day: return False
    elif frequency=="none":
        pass
    else:
        return False
    if event["skip_weekends"] and day.weekday()>4: return False
    if event["skip_holidays"] and day.isoformat() in holiday_map(day.year): return False
    return True

def occurrences(start, end):
    if (end-start).days<0 or (end-start).days>93:
        raise ValueError("O intervalo deve ter até 94 dias.")
    with db() as c:
        events=c.execute("SELECT * FROM events WHERE start_date<=? AND (end_date IS NULL OR end_date>=?) ORDER BY time,id",(end.isoformat(),start.isoformat())).fetchall()
        exceptions={(x["event_id"],x["date"]) for x in c.execute("SELECT event_id,date FROM exceptions WHERE date BETWEEN ? AND ?",(start.isoformat(),end.isoformat()))}
        complete={(x["event_id"],x["date"]) for x in c.execute("SELECT event_id,date FROM completions WHERE date BETWEEN ? AND ?",(start.isoformat(),end.isoformat()))}
    result=[]
    day=start
    while day<=end:
        iso=day.isoformat()
        for e in events:
            if matches(e,day) and (e["id"],iso) not in exceptions:
                obj={key:e[key] for key in ("id","title","time","duration","icon","notes","start_date","end_date","recurrence","skip_weekends","skip_holidays","mission")}
                obj["date"]=iso
                obj["done"]=(e["id"],iso) in complete
                result.append(obj)
        day+=dt.timedelta(days=1)
    return sorted(result,key=lambda x:(x["date"],x["time"],x["id"]))

def validate_event(body):
    if not isinstance(body,dict): raise ValueError("Atividade inválida.")
    title=str(body.get("title","")).strip()
    if not 1<=len(title)<=100: raise ValueError("Título deve ter de 1 a 100 caracteres.")
    time=str(body.get("time",""))
    if not TIME.fullmatch(time): raise ValueError("Horário inválido.")
    start=parse_date(body.get("start_date"))
    end=parse_date(body["end_date"]) if body.get("end_date") else None
    if end and end<start: raise ValueError("Data final anterior à inicial.")
    recurrence=body.get("recurrence","none")
    if recurrence not in ("none","daily","weekdays","weekly","monthly"): raise ValueError("Recorrência inválida.")
    weekdays=body.get("weekdays",[])
    if not isinstance(weekdays,list) or any(not isinstance(x,int) or x not in WEEKDAYS for x in weekdays):
        raise ValueError("Dias da semana inválidos.")
    weekdays=sorted(set(weekdays))
    if recurrence=="weekly" and not weekdays: raise ValueError("Escolha ao menos um dia da semana.")
    try: duration=int(body.get("duration",30))
    except (ValueError,TypeError): raise ValueError("Duração inválida.")
    if not 1<=duration<=480: raise ValueError("Duração entre 1 e 480 minutos.")
    return (title,time,duration,str(body.get("icon","⭐"))[:12],str(body.get("notes",""))[:800],
            start.isoformat(),end.isoformat() if end else None,recurrence,json.dumps(weekdays),
            int(bool(body.get("skip_weekends",False))),int(bool(body.get("skip_holidays",False))),
            str(body.get("mission",""))[:80])

FIELDS="title,time,duration,icon,notes,start_date,end_date,recurrence,weekdays,skip_weekends,skip_holidays,mission"
def event_by_id(id):
    with db() as c: return c.execute("SELECT * FROM events WHERE id=?", (id,)).fetchone()

class Handler(BaseHTTPRequestHandler):
    server_version="DaviLocal/0.4"
    def setup(self):
        super().setup()
        self.connection.settimeout(15)
    def log_message(self, fmt, *args):
        pass  # Sem URL, IP, cookie, código de autorização ou dados da agenda nos logs.
    def send(self,status=200,body=None,content_type="application/json; charset=utf-8",extra=None):
        raw=json.dumps(body,ensure_ascii=False).encode() if content_type.startswith("application/json") else body
        self.send_response(status)
        self.send_header("Content-Type",content_type)
        self.send_header("Content-Length",str(len(raw)))
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.send_header("Referrer-Policy","no-referrer")
        for k,v in (extra or {}).items(): self.send_header(k,v)
        self.end_headers()
        self.wfile.write(raw)
    def fail(self,msg,status=400): self.send(status,{"error":msg})
    def payload(self):
        size=int(self.headers.get("Content-Length","0"))
        if size<0 or size>MAX_BODY: raise ValueError("Tamanho de requisição inválido.")
        body = json.loads(self.rfile.read(size) or b"{}")
        if not isinstance(body, dict): raise ValueError('Objeto JSON obrigatório.')
        return body
    def session_token(self):
        cookies=SimpleCookie()
        try: cookies.load(self.headers.get("Cookie",""))
        except Exception: return ""
        token=cookies.get("davi_session")
        return token.value if token else ""
    def session(self):
        session=AUTH.session(self.session_token())
        if session and session['role']=='lan-child' and not CONFIG.simple_lan:
            return None
        return session
    def is_parent(self):
        session=self.session()
        return bool(session and session['role']=='parent')
    def origin_ok(self):
        return self.headers.get("Origin") in CONFIG.origins
    def request_ok(self):
        return CONFIG.client(self) is not None
    def session_cookie(self, token, age):
        return f"davi_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={age}" + ("; Secure" if CONFIG.secure else "")
    def do_GET(self):
        if not self.request_ok(): return self.fail("Acesso não autorizado.",403)
        try:
            url=urlsplit(self.path); path=url.path
            if path=="/" or path=="/app.js" or path=="/app.css":
                name={"/":"app.html","/app.js":"app.js","/app.css":"app.css"}[path]
                kind={"app.html":"text/html; charset=utf-8","app.js":"text/javascript; charset=utf-8","app.css":"text/css; charset=utf-8"}[name]
                return self.send(200,(ROOT/name).read_bytes(),kind)
            if path=="/api/me":
                session=self.session()
                extra={}
                if CONFIG.simple_lan and not session:
                    # Sessão automática mantém CSRF sem pareamento ou senha infantil.
                    token,age=AUTH.create_session('lan-child')
                    session=AUTH.session(token)
                    extra['Set-Cookie']=self.session_cookie(token,age)
                info={"parent":bool(session and session['role']=='parent'),
                      "authorized":bool(session), "configured":bool(get_setting("password")),
                      "simple_lan":CONFIG.simple_lan,
                      "today":today().isoformat(),"timezone":"America/Sao_Paulo"}
                if session: info.update(name=get_setting("name"), csrf=session['csrf'])
                return self.send(200,info,extra=extra)
            if path.startswith('/api/') and not (self.session() or (
                    CONFIG.simple_lan and path in ('/api/calendar','/api/holidays'))):
                return self.fail("Autorize este dispositivo com o responsável.",403)
            if path=="/api/holidays":
                year=int(parse_qs(url.query).get("year",[str(today().year)])[0])
                if not 2000<=year<=2100: raise ValueError("Ano fora do intervalo.")
                return self.send(200,{"year":year,"holidays":holiday_map(year)})
            if path=="/api/calendar":
                query=parse_qs(url.query)
                start=parse_date(query.get("start",[today().isoformat()])[0])
                end=parse_date(query.get("end",[start.isoformat()])[0])
                return self.send(200,{"events":occurrences(start,end)})
            if path=="/api/events":
                if not self.is_parent(): return self.fail("Acesso do responsável necessário.",403)
                with db() as c: result=[dict(x) for x in c.execute("SELECT * FROM events ORDER BY time,id")]
                for x in result:x["weekdays"]=json.loads(x["weekdays"])
                return self.send(200,{"events":result})
            return self.fail("Não encontrado.",404)
        except (ValueError,TypeError,OverflowError) as e: return self.fail(str(e))
        except Exception: print("Erro interno GET.");return self.fail("Erro interno.",500)
    def do_POST(self): self.mutate("POST")
    def do_PUT(self): self.mutate("PUT")
    def do_DELETE(self): self.mutate("DELETE")
    def mutate(self,method):
        if not self.request_ok() or not self.origin_ok(): return self.fail("Origem não autorizada.",403)
        if method in ('POST','PUT') and self.headers.get_content_type() != 'application/json':
            return self.fail("Envie JSON.",415)
        session=self.session()
        if session and not secrets.compare_digest(self.headers.get('X-CSRF-Token',''), session['csrf']):
            return self.fail("Recarregue a página para renovar a sessão.",403)
        try:
            path=urlsplit(self.path).path
            body=self.payload() if method in ("POST","PUT") else {}
            if path in ('/api/login','/api/pair') and method=='POST':
                if AUTH.limited(CONFIG.client(self)):
                    return self.fail("Muitas tentativas. Aguarde 15 minutos.",429)
                if path=='/api/login':
                    password=body.get('password','')
                    encoded=get_setting('password')
                    if not encoded or not isinstance(password,str) or len(password)>256 or not verify_password(password,encoded):
                        return self.fail("Senha incorreta.",401)
                    role='parent'
                else:
                    code=body.get('code','')
                    if not isinstance(code,str) or not AUTH.redeem(code):
                        return self.fail("Código inválido ou expirado.",401)
                    role='child'
                AUTH.revoke(self.session_token())
                token,age=AUTH.create_session(role)
                return self.send(200,{"ok":True},extra={"Set-Cookie":self.session_cookie(token,age)})
            if not session: return self.fail("Autorização necessária.",403)
            if path=="/api/logout" and method=="POST":
                AUTH.revoke(self.session_token())
                return self.send(200,{"ok":True},extra={"Set-Cookie":self.session_cookie('',0)})
            if path in ('/api/devices/code','/api/devices/revoke') and method=='POST':
                if not self.is_parent(): return self.fail("Acesso do responsável necessário.",403)
                if path.endswith('/code'): return self.send(200,{"code":AUTH.pair_code(),"expires_in":600})
                AUTH.revoke_children()
                return self.send(200,{"ok":True})
            match=re.fullmatch(r"/api/events/(\d+)(?:/(skip|done))?",path)
            if match and match.group(2)=="done" and method in ("POST","DELETE"):
                id=int(match.group(1));day=parse_date(body.get("date") if method=="POST" else parse_qs(urlsplit(self.path).query).get("date",[""])[0])
                event=event_by_id(id)
                if not event or not matches(event,day): return self.fail("Ocorrência não encontrada.",404)
                with db() as c:
                    if c.execute("SELECT 1 FROM exceptions WHERE event_id=? AND date=?",(id,day.isoformat())).fetchone():return self.fail("Ocorrência excluída.",404)
                    if method=="POST":c.execute("INSERT OR IGNORE INTO completions VALUES(?,?,?)",(id,day.isoformat(),dt.datetime.now(TZ).isoformat()))
                    else:c.execute("DELETE FROM completions WHERE event_id=? AND date=?",(id,day.isoformat()))
                return self.send(200,{"ok":True})
            if path.startswith("/api/events") or path=="/api/settings":
                if not self.is_parent(): return self.fail("Acesso do responsável necessário.",403)
                if path=="/api/settings" and method=="PUT":
                    name=body.get("name","")
                    if not isinstance(name,str) or not 1<=len(name.strip())<=35: raise ValueError("Nome inválido.")
                    set_setting("name",name.strip());return self.send(200,{"ok":True})
                if path=="/api/events" and method=="POST":
                    values=validate_event(body)
                    with db() as c: cur=c.execute(f"INSERT INTO events({FIELDS}) VALUES({','.join('?'*12)})",values)
                    return self.send(201,{"id":cur.lastrowid})
                if match:
                    id=int(match.group(1))
                    if not event_by_id(id):return self.fail("Atividade não encontrada.",404)
                    if match.group(2)=="skip" and method=="POST":
                        day=parse_date(body.get("date"))
                        event=event_by_id(id)
                        if not matches(event,day):return self.fail("Ocorrência inválida.",400)
                        with db() as c:c.execute("INSERT OR IGNORE INTO exceptions VALUES(?,?)",(id,day.isoformat()))
                        return self.send(200,{"ok":True})
                    if match.group(2) is None and method=="DELETE":
                        with db() as c:c.execute("DELETE FROM events WHERE id=?",(id,))
                        return self.send(200,{"ok":True})
                    if match.group(2) is None and method=="PUT":
                        values=validate_event(body)
                        with db() as c:
                            c.execute("UPDATE events SET "+",".join(x+"=?" for x in FIELDS.split(","))+" WHERE id=?",(*values,id))
                            c.execute("DELETE FROM exceptions WHERE event_id=?",(id,))
                            c.execute("DELETE FROM completions WHERE event_id=?",(id,))
                        return self.send(200,{"ok":True})
            return self.fail("Rota não encontrada.",404)
        except (ValueError,TypeError,KeyError,json.JSONDecodeError) as e:return self.fail(str(e))
        except Exception:print("Erro interno de escrita.");return self.fail("Erro interno.",500)

def main():
    initialize()
    if CONFIG.simple_lan:
        print(f"Aventuras do Davi: http://{HOST}:{PORT} (somente 192.168.2.0/24). Ctrl+C para encerrar.", flush=True)
    else:
        print("Aventuras do Davi: acesso autenticado; use a origem configurada.", flush=True)
    stop=Event()
    if CONFIG.secure:
        from maintenance import scheduled_backup
        Thread(target=scheduled_backup, args=(DB, DATA / 'backups', stop), daemon=True).start()
    httpd=ThreadingHTTPServer((HOST,PORT),Handler)
    httpd.daemon_threads=True
    try: httpd.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        stop.set()
        httpd.server_close()

if __name__=="__main__": main()
