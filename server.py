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
import missions
import world
import schedule_window as timing

ROOT = Path(__file__).resolve().parent
APP_VERSION = '0.7A-1'
DATA = Path(os.environ.get("DAVI_DATA_DIR", ROOT / "dados")).resolve()
DB = DATA / "agenda.sqlite3"
CONFIG = Config()
HOST, PORT = CONFIG.host, CONFIG.port
AUTH = AuthStore(DATA)
TZ = timing.TZ
LOCK = RLock()
MAX_BODY = 100_000
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
WEEKDAYS = {0, 1, 2, 3, 4, 5, 6}

def today():
    return timing.now().astimezone(TZ).date()

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
    # Antes de qualquer DDL: snapshot SQLite consistente, inclusive WAL, uma vez.
    if DB.exists():
        from contextlib import closing
        from maintenance import readonly, backup
        with closing(readonly(DB)) as existing:
            pending = missions.needs_migration(existing) or world.needs_migration(existing) or timing.needs_migration(existing)
        if pending:
            backup(DB, DATA / 'antes-v06', keep=14)
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
        missions.initialize(c)
        world.initialize(c)
        timing.initialize(c)

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
    with db() as c:
        links = {(r['event_id'],r['date']):r['template_id'] for r in c.execute('SELECT * FROM event_missions')}
        runs = {(r['event_id'],r['date']) for r in c.execute('''SELECT r.event_id,r.date FROM mission_runs r
            JOIN mission_event_keys k ON k.identity=r.event_key WHERE r.date BETWEEN ? AND ?''', (start.isoformat(),end.isoformat()))}
    instant=timing.now()
    with db() as c:
        for item in result: item['window']=timing.window(c,item,item['date'],instant)
    for item in result:
        key=(item['id'],item['date'])
        item['has_mission'] = key in runs or bool(links.get(key, links.get((item['id'],''))))
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

def mission_event(c, event_id, date=''):
    if not isinstance(date,str): raise ValueError('Data inválida.')
    event=c.execute('SELECT * FROM events WHERE id=?',(event_id,)).fetchone()
    if not event: raise ValueError('Atividade não encontrada.')
    if date:
        day=parse_date(date)
        if not matches(event,day) or c.execute('SELECT 1 FROM exceptions WHERE event_id=? AND date=?',(event_id,date)).fetchone():
            raise ValueError('Ocorrência não encontrada ou excluída.')
    return event

class Handler(BaseHTTPRequestHandler):
    server_version="DaviLocal/0.6"
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
        if session and session['role']=='lan-child' and not CONFIG.auto_child:
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
            if path in ('/','/app.js','/app.css','/game.js','/game.css','/world.js','/world.css'):
                name='app.html' if path=='/' else path[1:]
                kind='text/html; charset=utf-8' if name.endswith('.html') else 'text/javascript; charset=utf-8' if name.endswith('.js') else 'text/css; charset=utf-8'
                return self.send(200,(ROOT/name).read_bytes(),kind)
            if path=="/api/me":
                session=self.session()
                extra={}
                if CONFIG.auto_child and not session:
                    # Sessão automática mantém CSRF sem pareamento ou senha infantil.
                    token,age=AUTH.create_session('lan-child')
                    session=AUTH.session(token)
                    extra['Set-Cookie']=self.session_cookie(token,age)
                info={"parent":bool(session and session['role']=='parent'),
                      "authorized":bool(session), "configured":bool(get_setting("password")),
                      "simple_lan":CONFIG.auto_child,
                      "today":today().isoformat(),"timezone":"America/Sao_Paulo","version":APP_VERSION,"server_now":timing.now().astimezone(TZ).isoformat()}
                if session: info.update(name=get_setting("name"), csrf=session['csrf'])
                return self.send(200,info,extra=extra)
            if path.startswith('/api/') and not (self.session() or (
                    CONFIG.auto_child and path in ('/api/calendar','/api/holidays'))):
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
            if path=='/api/schedule/config':
                if not self.is_parent(): return self.fail('Acesso do responsável necessário.',403)
                with db() as c: return self.send(200,{'after_minutes':timing.tolerance(c)})
            if path.startswith('/api/missions'):
                if not self.is_parent(): return self.fail('Acesso do responsável necessário.',403)
                with db() as c:
                    if path=='/api/missions': return self.send(200,{'templates':missions.templates(c)})
                    if path=='/api/missions/history':
                        rows=[dict(r) for r in c.execute('''SELECT r.id,r.event_id,r.date,r.snapshot,
                            (SELECT COUNT(*) FROM step_progress p WHERE p.run_id=r.id AND p.done=1) AS confirmed
                            FROM mission_runs r ORDER BY r.date DESC,r.event_id LIMIT 200''')]
                        for row in rows:
                            row['mission']=json.loads(row.pop('snapshot'))
                            progress={p['step_id']:bool(p['done']) for p in c.execute('SELECT step_id,done FROM step_progress WHERE run_id=?',(row['id'],))}
                            for step in row['mission']['steps']: step['done']=progress.get(step['id'],False)
                        return self.send(200,{'history':rows})
                    match=re.fullmatch(r'/api/missions/([a-zA-Z0-9_-]{1,80})',path)
                    if match: return self.send(200,missions.template(c,match.group(1)))
            if path.startswith('/api/world'):
                with db() as c:
                    if path=='/api/world': return self.send(200,world.scene(c))
                    if path=='/api/world/config':
                        if not self.is_parent(): return self.fail('Acesso do responsável necessário.',403)
                        return self.send(200,world.config(c))
                    match=re.fullmatch(r'/api/world/practice/([a-f0-9]{48})',path)
                    if match: return self.send(200,world.practice(c,match.group(1)))
            match=re.fullmatch(r'/api/events/(\d+)/mission',path)
            if match:
                date=parse_qs(url.query).get('date',[''])[0]
                if not date and not self.is_parent(): return self.fail('Acesso do responsável necessário.',403)
                with db() as c:
                    event=mission_event(c,int(match.group(1)),date)
                    if date:
                        mission=missions.occurrence(c,event['id'],date)
                        if mission: mission['window']=timing.window(c,event,date)
                        return self.send(200,{'mission':mission,'title':event['title']})
                    links=[dict(r) for r in c.execute('SELECT date,template_id FROM event_missions WHERE event_id=? ORDER BY date',(event['id'],))]
                    return self.send(200,{'links':links,'title':event['title']})
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
            if path=='/api/schedule/config' and method=='PUT':
                if not self.is_parent(): return self.fail('Acesso do responsável necessário.',403)
                with LOCK, db() as c: result=timing.configure(c,body)
                return self.send(200,result)
            if path.startswith('/api/world'):
                if path in ('/api/world/config','/api/world/revoke','/api/world/inventory') and not self.is_parent(): return self.fail('Acesso do responsável necessário.',403)
                with LOCK, db() as c:
                    c.execute('BEGIN IMMEDIATE')
                    if path=='/api/world/buy' and method=='POST': result=world.buy(c,body)
                    elif path=='/api/world/equip' and method=='PUT': result=world.equip(c,body)
                    elif path=='/api/world/move' and method=='PUT': result=world.move(c,body)
                    elif path=='/api/world/config' and method=='PUT': result=world.configure(c,body)
                    elif path=='/api/world/revoke' and method=='POST': result=world.revoke(c,body)
                    elif path=='/api/world/inventory' and method=='PUT': result=world.inventory_control(c,body)
                    elif path=='/api/world/real' and method=='POST':
                        event=mission_event(c,body.get('event_id'),body.get('date'))
                        if self.is_parent() and timing.window(c,event,body['date'])['state']!='open':
                            result={'delta':0,'stars':world.balance(c),'reason':'correction','message':'Correção do responsável não concede estrelas.'}
                        else:
                            timing.require_open(c,event,body['date'])
                            result=world.real_reward(c,body,mission_event)
                    elif path=='/api/world/practice' and method=='POST': result=world.start(c,body,mission_event)
                    elif (match:=re.fullmatch(r'/api/world/practice/([a-f0-9]{48})/(advance|answer|hint)',path)) and method=='POST':
                        result=world.practice_action(c,match.group(1),match.group(2),body,mission_event)
                    else: return self.fail('Rota não encontrada.',404)
                return self.send(200,result)
            if path.startswith('/api/missions'):
                if not self.is_parent(): return self.fail('Acesso do responsável necessário.',403)
                with LOCK, db() as c:
                    c.execute('BEGIN IMMEDIATE')
                    if path=='/api/missions' and method=='POST':
                        # IDs de novos roteiros são gerados no servidor.
                        body.pop('id',None)
                        result=missions.save_template(c,body)
                        status=201
                    elif (match:=re.fullmatch(r'/api/missions/([a-zA-Z0-9_-]{1,80})(/archive)?',path)) and method=='PUT':
                        if match.group(2):
                            missions.archive(c,match.group(1),body.get('archived'),body.get('revision'))
                            result={'ok':True}
                        else: result=missions.save_template(c,body,match.group(1))
                        status=200
                    else: return self.fail('Rota não encontrada.',404)
                return self.send(status,result)
            mission_match=re.fullmatch(r'/api/events/(\d+)/mission(?:/steps/([a-zA-Z0-9_-]{1,80}))?',path)
            if mission_match:
                event_id=int(mission_match.group(1)); step_id=mission_match.group(2)
                if not step_id and not self.is_parent(): return self.fail('Acesso do responsável necessário.',403)
                date=body.get('date','') if method!='DELETE' else parse_qs(urlsplit(self.path).query).get('date',[''])[0]
                with LOCK, db() as c:
                    c.execute('BEGIN IMMEDIATE')
                    event=mission_event(c,event_id,date)
                    if step_id and method=='PUT':
                        if not date: raise ValueError('Informe a data da ocorrência.')
                        if not self.is_parent(): timing.require_open(c,event,date)
                        result=missions.confirm_step(c,event_id,date,step_id,body,session['role'])
                        result['window']=timing.window(c,event,date)
                        if self.is_parent():
                            timing.correction(c,event_id,date,'step:'+step_id+':'+str(body['done']))
                            result['correction']='Correção do responsável; estrelas não alteradas.'
                    elif not step_id and method=='PUT':
                        if 'template_id' not in body: raise ValueError('Informe roteiro ou null para nenhum.')
                        missions.assign(c,event_id,date,body['template_id'])
                        result={'ok':True}
                    elif not step_id and method=='DELETE':
                        c.execute('DELETE FROM event_missions WHERE event_id=? AND date=?',(event_id,date))
                        result={'ok':True}
                    else: return self.fail('Rota não encontrada.',404)
                return self.send(200,result)
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
                with LOCK, db() as c:
                    c.execute("BEGIN IMMEDIATE")
                    if c.execute("SELECT 1 FROM exceptions WHERE event_id=? AND date=?",(id,day.isoformat())).fetchone():return self.fail("Ocorrência excluída.",404)
                    if not self.is_parent(): timing.require_open(c,event,day.isoformat())
                    else: timing.correction(c,id,day.isoformat(),"completion:"+method)
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
        except missions.Conflict as e:return self.fail(str(e),409)
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
