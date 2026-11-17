"""Mundos editáveis e exploração persistente. Economia permanece em world.py."""
import json
import math
import re
import secrets
import world
import missions

PRESETS = {
 'forest': {'label':'Floresta','sky':'#c8e6e0','ground':'#87bb78','water':'#69b9bc','rock':'#b6a17d','accent':'#f5ca75',
            'islands':[[0,0,11],[18,-3,6]],'paths':[[8,18,-4.5,-1.5]],'spawn':[0,5]},
 'clouds': {'label':'Nuvens','sky':'#c7dbf0','ground':'#e6e5f5','water':'#a9c4e5','rock':'#bdc5e0','accent':'#e8ba78',
            'islands':[[0,0,9],[-14,-6,5],[13,-10,6]],'paths':[[-14,-5,-7,-5],[4,14,-7,-5]],'spawn':[0,4]},
 'robots': {'label':'Robôs','sky':'#d3e6e8','ground':'#93bcbc','water':'#7ca4bf','rock':'#688d9a','accent':'#ffc16e',
            'islands':[[0,0,12],[0,-17,7]],'paths':[[-2,2,-18,-8]],'spawn':[0,5]},
 'treasure': {'label':'Tesouros','sky':'#f4dfbd','ground':'#eed59a','water':'#58bec3','rock':'#bd936e','accent':'#e7a36f',
            'islands':[[0,0,11],[-17,1,6]],'paths':[[-18,-8,-.5,2.5]],'spawn':[0,5]},
 'crystal': {'label':'Cristais','sky':'#d6d4f0','ground':'#c6c5e2','water':'#9aafd4','rock':'#8d8eaf','accent':'#b1e4e2',
            'islands':[[0,0,10],[15,-7,6],[-13,-13,5]],'paths':[[5,15,-8,-6],[-14,-4,-14,-12],[-5,-3,-13,-5]],'spawn':[0,4]},
}
INITIAL=[('forest','Floresta Encantada','Caminhos de folhas, uma casa nas copas e o bosque além da ponte.'),
 ('clouds','Ilhas das Nuvens','Pontes no céu e pequenos segredos para a memória.'),
 ('robots','Cidade dos Robôs','Uma cidade inventora para descobrir com o Pipo.'),
 ('treasure','Ilha dos Tesouros','Um porto ensolarado para guardar suas descobertas.'),
 ('crystal','Montanhas de Cristal','Cristais gigantes, caminhos luminosos e novas ideias.')]


def needs_migration(c):
    return not c.execute("SELECT 1 FROM sqlite_master WHERE name='realms'").fetchone()


def initialize(c):
    if not needs_migration(c): return
    for sql in (
        "CREATE TABLE realms(id TEXT PRIMARY KEY,name TEXT NOT NULL,preset TEXT NOT NULL,color TEXT NOT NULL,description TEXT NOT NULL,available INTEGER NOT NULL,unlock_item TEXT,revision INTEGER NOT NULL DEFAULT 1)",
        "CREATE TABLE realm_player(id INTEGER PRIMARY KEY,world_id TEXT NOT NULL)",
        "CREATE TABLE realm_progress(world_id TEXT PRIMARY KEY,x REAL NOT NULL,z REAL NOT NULL,visits INTEGER NOT NULL DEFAULT 1)",
        "CREATE TABLE realm_events(world_id TEXT NOT NULL,event_key TEXT NOT NULL,PRIMARY KEY(world_id,event_key))",
        "CREATE TABLE realm_challenges(id TEXT PRIMARY KEY,world_id TEXT NOT NULL,title TEXT NOT NULL,prompt TEXT NOT NULL,kind TEXT NOT NULL,choices TEXT NOT NULL,answer TEXT NOT NULL,x REAL NOT NULL,z REAL NOT NULL,available INTEGER NOT NULL DEFAULT 1)",
        "CREATE TABLE realm_completed(challenge_id TEXT PRIMARY KEY,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    ):c.execute(sql)
    for preset,name,description in INITIAL:
        c.execute('INSERT INTO realms(id,name,preset,color,description,available) VALUES(?,?,?,?,?,1)',(preset,name,preset,PRESETS[preset]['accent'],description))
        lookout={'forest':(18,-.5),'clouds':(-14,-4),'robots':(0,-14),'treasure':(-17,3),'crystal':(15,-4)}[preset]
        examples=[('explore','Mirante das descobertas','Caminhe até o farol e observe seu mundo.',[],[],*lookout),
                  ('sequence','Trilha das ideias','Observe e repita: Sol → Lua → Estrela.',['Sol','Lua','Estrela'],['Sol','Lua','Estrela'],-4,-2),
                  ('logic','Uma ideia do Pipo','Qual destes objetos ajuda a iluminar um caminho?',['Lanterna','Travesseiro','Bola'],['Lanterna'],3,3)]
        for i,(kind,title,prompt,choices,answer,x,z) in enumerate(examples):
            c.execute('INSERT INTO realm_challenges(id,world_id,title,prompt,kind,choices,answer,x,z) VALUES(?,?,?,?,?,?,?,?,?)',
                      (preset+'-'+str(i),preset,title,prompt,kind,json.dumps(choices),json.dumps(answer),x,z))
    c.execute("INSERT INTO realm_player VALUES(1,'forest')")
    c.execute("INSERT INTO realm_progress(world_id,x,z) VALUES('forest',0,5)")


def owned(c):return {r[0] for r in c.execute('SELECT item_id FROM world_inventory WHERE active=1')}


def allowed(c,realm):
    return bool(realm['available']) and (not realm['unlock_item'] or realm['unlock_item'] in owned(c))


def walkable(preset,x,z,inventory=()):
    model=PRESETS[preset]
    for i,(cx,cz,r) in enumerate(model['islands']):
        if preset=='forest' and i==1 and 'bridge' not in inventory:continue
        if (x-cx)**2+(z-cz)**2<=(r-.6)**2:return True
    if preset=='forest' and 'bridge' not in inventory:return False
    return any(a<=x<=b and d<=z<=e for a,b,d,e in model['paths'])


def listing(c,admin=False):
    current=c.execute('SELECT world_id FROM realm_player WHERE id=1').fetchone()[0]
    stored_current=current
    rows=[]
    for row in c.execute('SELECT * FROM realms ORDER BY rowid'):
        item=dict(row)
        if not admin and not item['available']:continue
        item['unlocked']=allowed(c,row)
        item['event_ids']=[r[0] for r in c.execute('SELECT k.event_id FROM realm_events e JOIN mission_event_keys k ON k.identity=e.event_key WHERE e.world_id=?',(row['id'],))]
        item['challenges']=[]
        for r in c.execute('SELECT * FROM realm_challenges WHERE world_id=? ORDER BY rowid',(row['id'],)):
            if not admin and not r['available']:continue
            challenge=dict(r);challenge['choices']=json.loads(challenge['choices'])
            challenge['completed']=bool(c.execute('SELECT 1 FROM realm_completed WHERE challenge_id=?',(r['id'],)).fetchone())
            if admin:challenge['answer']=json.loads(challenge['answer'])
            else:challenge.pop('answer')
            item['challenges'].append(challenge)
        progress=c.execute('SELECT * FROM realm_progress WHERE world_id=?',(row['id'],)).fetchone()
        item['progress']=dict(progress) if progress else {'x':0,'z':PRESETS[row['preset']]['spawn'][1],'visits':0}
        if not walkable(row['preset'],item['progress']['x'],item['progress']['z'],owned(c)):
            item['progress'].update(x=0,z=PRESETS[row['preset']]['spawn'][1])
        rows.append(item)
    if not any(r['id']==current and r['unlocked'] for r in rows):
        current=next((r['id'] for r in rows if r['unlocked']),None)
    return {'current':current,'stored_current':stored_current,'worlds':rows,'presets':PRESETS,'economy':world.scene(c)}


def travel(c,body):
    ident=body.get('world_id')
    if not isinstance(ident,str):raise ValueError('Escolha um mundo.')
    row=c.execute('SELECT * FROM realms WHERE id=?',(ident,)).fetchone()
    if not row or not allowed(c,row):raise ValueError('Este mundo ainda não está disponível. Veja o combinado com o responsável.')
    c.execute('UPDATE realm_player SET world_id=? WHERE id=1',(ident,))
    x,z=PRESETS[row['preset']]['spawn']
    c.execute('INSERT INTO realm_progress(world_id,x,z) VALUES(?,?,?) ON CONFLICT(world_id) DO UPDATE SET visits=visits+1',(ident,x,z))
    return listing(c)


def move(c,body):
    ident=body.get('world_id'); x,z=body.get('x'),body.get('z')
    if not isinstance(ident,str) or any(type(v) not in (int,float) or not math.isfinite(v) for v in (x,z)):
        raise ValueError('Posição inválida.')
    if ident!=c.execute('SELECT world_id FROM realm_player WHERE id=1').fetchone()[0]:raise missions.Conflict('O mundo mudou em outro aparelho. Reabra o mundo.')
    row=c.execute('SELECT * FROM realms WHERE id=?',(ident,)).fetchone()
    if not row or not allowed(c,row) or not walkable(row['preset'],x,z,owned(c)):raise ValueError('Fique nos caminhos deste mundo.')
    c.execute('UPDATE realm_progress SET x=?,z=? WHERE world_id=?',(x,z,ident))
    return {'ok':True}


def complete(c,body):
    ident=body.get('challenge_id'); selected=body.get('selected',[])
    if not isinstance(ident,str) or not isinstance(selected,list) or any(not isinstance(v,str) for v in selected):raise ValueError('Desafio inválido.')
    challenge=c.execute('SELECT * FROM realm_challenges WHERE id=? AND available=1',(ident,)).fetchone()
    if not challenge:raise ValueError('Desafio não encontrado.')
    row=c.execute('SELECT * FROM realms WHERE id=?',(challenge['world_id'],)).fetchone()
    current=c.execute('SELECT world_id FROM realm_player WHERE id=1').fetchone()[0]
    if current!=row['id'] or not allowed(c,row):raise missions.Conflict('Entre no mundo deste desafio primeiro.')
    if challenge['kind']=='explore':
        pos=c.execute('SELECT x,z FROM realm_progress WHERE world_id=?',(current,)).fetchone()
        correct=bool(pos and math.hypot(pos['x']-challenge['x'],pos['z']-challenge['z'])<=3)
    else:correct=selected==json.loads(challenge['answer'])
    if correct:c.execute('INSERT OR IGNORE INTO realm_completed(challenge_id) VALUES(?)',(ident,))
    return {'correct':correct,'completed':correct,'message':'Descoberta guardada neste mundo! Estrelas vêm das atividades da agenda.' if correct else 'Vamos observar mais uma vez?'}


def save(c,body):
    ident=body.get('id')
    current=None
    if ident is not None:
        if not isinstance(ident,str):raise ValueError('Mundo inválido.')
        current=c.execute('SELECT * FROM realms WHERE id=?',(ident,)).fetchone()
        if not current:raise ValueError('Mundo não encontrado.')
        if body.get('revision')!=current['revision']:raise missions.Conflict('Mundo alterado em outro aparelho. Reabra o editor.')
    else:ident=secrets.token_hex(12)
    name=missions.text(body.get('name'),'Nome',80);description=missions.text(body.get('description',''),'Descrição',400,False)
    preset=body.get('preset');color=body.get('color');available=body.get('available');unlock=body.get('unlock_item') or None
    if not isinstance(preset,str) or preset not in PRESETS or not isinstance(color,str) or not re.fullmatch(r'#[0-9a-fA-F]{6}',color) or type(available) is not bool or unlock is not None and (not isinstance(unlock,str) or unlock not in world.CATALOG):raise ValueError('Tema, cor ou disponibilidade inválidos.')
    events=body.get('event_ids',[]);challenges=body.get('challenges',[])
    if not isinstance(events,list) or len(events)>300 or any(type(v) is not int for v in events) or not isinstance(challenges,list) or len(challenges)>20:raise ValueError('Atividades ou desafios inválidos.')
    if not available and not c.execute('SELECT 1 FROM realms WHERE available=1 AND id<>?',(ident,)).fetchone():raise ValueError('Mantenha pelo menos um mundo disponível.')
    # Always retain an entry world with no item requirement.
    if (not available or unlock) and not c.execute('SELECT 1 FROM realms WHERE available=1 AND unlock_item IS NULL AND id<>?',(ident,)).fetchone():raise ValueError('Mantenha pelo menos um mundo de acesso livre.')
    checked=[];seen=set()
    for ch in challenges:
        if not isinstance(ch,dict):raise ValueError('Desafio inválido.')
        cid=ch.get('id') or secrets.token_hex(12)
        if not isinstance(cid,str) or cid in seen:raise ValueError('Identificador de desafio inválido.')
        if ch.get('id') and not c.execute('SELECT 1 FROM realm_challenges WHERE id=? AND world_id=?',(cid,ident)).fetchone():raise ValueError('Desafio de outro mundo.')
        seen.add(cid)
        title=missions.text(ch.get('title'),'Título',80);prompt=missions.text(ch.get('prompt'),'Orientação',400)
        kind=ch.get('kind');choices=ch.get('choices',[]);answer=ch.get('answer',[]);x,z=ch.get('x',4),ch.get('z',-4)
        if kind not in ('explore','sequence','logic') or not isinstance(choices,list) or not isinstance(answer,list) or len(choices)>6 or any(not isinstance(v,str) or not 1<=len(v)<=40 for v in choices+answer) or len(set(choices))!=len(choices):raise ValueError('Opções de desafio inválidas.')
        if kind!='explore' and (not choices or not answer or any(v not in choices for v in answer) or kind=='logic' and len(answer)!=1):raise ValueError('Escolha a resposta do desafio.')
        if any(type(v) not in (int,float) or not math.isfinite(v) for v in (x,z)):raise ValueError('Ponto fora dos caminhos.')
        if current and current['preset']!=preset and not walkable(preset,x,z,world.CATALOG):
            x,z=((4,-4),(-4,-2),(3,3))[len(checked)%3]
        if not walkable(preset,x,z,world.CATALOG):raise ValueError('Ponto fora dos caminhos.')
        checked.append((cid,ident,title,prompt,kind,json.dumps(choices,ensure_ascii=False),json.dumps(answer,ensure_ascii=False),x,z))
    keys=[]
    for eid in set(events):
        if not c.execute('SELECT 1 FROM events WHERE id=?',(eid,)).fetchone():raise ValueError('Atividade não encontrada.')
        keys.append(missions.ensure_event_key(c,eid))
    c.execute('INSERT INTO realms(id,name,preset,color,description,available,unlock_item) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,preset=excluded.preset,color=excluded.color,description=excluded.description,available=excluded.available,unlock_item=excluded.unlock_item,revision=realms.revision+1',(ident,name,preset,color,description,int(available),unlock))
    c.execute('DELETE FROM realm_events WHERE world_id=?',(ident,))
    c.executemany('INSERT INTO realm_events VALUES(?,?)',[(ident,k) for k in keys])
    c.execute('UPDATE realm_challenges SET available=0 WHERE world_id=?',(ident,))
    c.executemany('INSERT INTO realm_challenges(id,world_id,title,prompt,kind,choices,answer,x,z) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,prompt=excluded.prompt,kind=excluded.kind,choices=excluded.choices,answer=excluded.answer,x=excluded.x,z=excluded.z,available=1',checked)
    if current and current['preset']!=preset:
        c.execute('UPDATE realm_progress SET x=0,z=? WHERE world_id=?',(PRESETS[preset]['spawn'][1],ident))
    return {'id':ident,**listing(c,True)}
