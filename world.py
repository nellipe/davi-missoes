"""Mundo e estrelas de uma criança. Prática validada, créditos e compras atômicos."""
import datetime as dt
import json
import math
import random
import re
import secrets
import unicodedata
import missions
import schedule_window as timing

CATALOG = {
    'bridge': ('Ponte do bosque', 4, 'building', 'Um caminho novo até a ilha do bosque.'),
    'house': ('Casa na árvore', 6, 'building', 'Um esconderijo para imaginar aventuras.'),
    'portal': ('Portal das ideias', 8, 'building', 'Uma passagem luminosa para seus jogos.'),
    'hat': ('Chapéu de explorador', 3, 'hat', 'Um chapéu dourado para suas descobertas.'),
    'cape': ('Capa das estrelas', 4, 'cape', 'Uma capa violeta para o seu personagem.'),
    'buddy': ('Lenço do Pipo', 3, 'buddy', 'Seu companheiro também entra na aventura.'),
}
KITS = {'taekwondo':['dobok','belt','bottle','bag'], 'escola':['book','case','notebook','bottle'],
        'mochila':['book','case','notebook','bag'], 'futsal':['ball','bottle','shirt','bag']}
ITEMS = {'dobok':'Dobok','belt':'Faixa','bottle':'Garrafa','bag':'Mochila','book':'Livro','case':'Estojo',
         'notebook':'Caderno','ball':'Bola','shirt':'Camiseta','robot':'Robô de brinquedo',
         'controller':'Controle de jogo','plant':'Vaso de planta','pillow':'Travesseiro'}
REAL_TEMPLATES = {'taekwondo','escola','mochila','futsal','quarto','sair','brincar'}
TZ = dt.timezone(dt.timedelta(hours=-3))
RNG = random.SystemRandom()


def needs_migration(c):
    return (not c.execute("SELECT 1 FROM sqlite_master WHERE name='world_settings'").fetchone()
            or 'context' not in {r[1] for r in c.execute('PRAGMA table_info(world_ledger)')})


def initialize_base(c):
    if c.execute("SELECT 1 FROM sqlite_master WHERE name='world_settings'").fetchone():
        if needs_migration(c):
            c.execute("ALTER TABLE world_ledger ADD COLUMN context TEXT NOT NULL DEFAULT '{}'")
            c.execute('ALTER TABLE world_inventory ADD COLUMN active INTEGER NOT NULL DEFAULT 1')
        return
    for sql in (
        '''CREATE TABLE world_settings(id INTEGER PRIMARY KEY,learn INTEGER NOT NULL,memory INTEGER NOT NULL,
            real INTEGER NOT NULL,daily_limit INTEGER NOT NULL)''',
        '''CREATE TABLE world_catalog(id TEXT PRIMARY KEY,price INTEGER NOT NULL,available INTEGER NOT NULL)''',
        '''CREATE TABLE world_inventory(item_id TEXT PRIMARY KEY,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)''',
        '''CREATE TABLE world_ledger(id TEXT PRIMARY KEY,delta INTEGER NOT NULL,label TEXT NOT NULL,
            day TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)''',
        '''CREATE TABLE world_state(id INTEGER PRIMARY KEY,x REAL NOT NULL,y REAL NOT NULL,color TEXT NOT NULL,
            hat TEXT,cape TEXT,buddy TEXT)''',
        '''CREATE TABLE practice_sessions(id TEXT PRIMARY KEY,event_id INTEGER NOT NULL,event_key TEXT NOT NULL,
            date TEXT NOT NULL,mode TEXT NOT NULL,snapshot TEXT NOT NULL,rounds TEXT NOT NULL,cursor INTEGER NOT NULL DEFAULT 0,
            completed INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)''',
    ): c.execute(sql)
    c.execute('INSERT INTO world_settings VALUES(1,1,2,2,12)')
    c.execute("INSERT INTO world_state VALUES(1,530,460,'mint',NULL,NULL,NULL)")
    c.executemany('INSERT INTO world_catalog VALUES(?,?,1)',[(key,value[1]) for key,value in CATALOG.items()])
    c.execute("ALTER TABLE world_ledger ADD COLUMN context TEXT NOT NULL DEFAULT '{}'")
    c.execute('ALTER TABLE world_inventory ADD COLUMN active INTEGER NOT NULL DEFAULT 1')


def initialize(c):
    initialize_base(c)
    c.execute("""CREATE TABLE IF NOT EXISTS game_state(
        id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL)""")
    c.execute('INSERT OR IGNORE INTO game_state VALUES(1,1)')
    if 'generation' not in {r[1] for r in c.execute('PRAGMA table_info(world_ledger)')}:
        c.execute('ALTER TABLE world_ledger ADD COLUMN generation INTEGER NOT NULL DEFAULT 1')
    c.execute('CREATE INDEX IF NOT EXISTS world_ledger_game_day ON world_ledger(generation,day)')
    c.execute("""CREATE TABLE IF NOT EXISTS world_closed_occurrences(
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        date TEXT NOT NULL, PRIMARY KEY(event_id,date))""")


def generation(c):
    return c.execute('SELECT generation FROM game_state WHERE id=1').fetchone()[0]


def today(): return dt.datetime.now(TZ).date().isoformat()


def balance(c):
    return c.execute('SELECT COALESCE(SUM(delta),0) FROM world_ledger WHERE generation=?',
                     (generation(c),)).fetchone()[0]


def ledger_entry(c, key, amount, label, context=None):
    c.execute('INSERT INTO world_ledger(id,delta,label,day,context,generation) VALUES(?,?,?,?,?,?)',
              (key,amount,label,today(),json.dumps(context or {},ensure_ascii=False),generation(c)))


def adjust_balance(c, body):
    target = body.get('stars')
    if type(target) is not int or not 0 <= target <= 10000:
        raise ValueError('Escolha um saldo inteiro entre 0 e 10.000 estrelas.')
    previous = balance(c)
    ledger_entry(c,'adjust:'+secrets.token_hex(16),target-previous,'Ajuste de saldo pelo responsável',
                 {'previous_balance':previous,'new_balance':target})
    return config(c)


def scene(c):
    owned={r['item_id'] for r in c.execute('SELECT item_id FROM world_inventory WHERE active=1')}
    return {'stars':balance(c),'game_generation':generation(c),'avatar':dict(c.execute('SELECT * FROM world_state WHERE id=1').fetchone()),
            'inventory':sorted(owned), 'catalog':[{'id':r['id'],'price':r['price'],'available':bool(r['available']),
                'name':CATALOG[r['id']][0],'kind':CATALOG[r['id']][2],'description':CATALOG[r['id']][3],
                'owned':r['id'] in owned,
                'removed':bool(c.execute('SELECT 1 FROM world_inventory WHERE item_id=? AND active=0',(r['id'],)).fetchone())
                } for r in c.execute('SELECT * FROM world_catalog')]}


def grant(c, key, amount, label, context=None, *, occurrence):
    if c.execute('SELECT 1 FROM world_ledger WHERE id=?',(key,)).fetchone():
        if c.execute('SELECT 1 FROM world_ledger WHERE id=?',('revoke:'+key,)).fetchone():
            return {'delta':0,'stars':balance(c),'reason':'revoked',
                    'message':'O responsável ajustou as estrelas deste treino. Você pode continuar brincando!'}
        return {'delta':0,'stars':balance(c),'reason':'already','message':'As estrelas deste treino já foram guardadas. Você pode continuar brincando!'}
    if c.execute('SELECT 1 FROM world_closed_occurrences WHERE event_id=? AND date=?',occurrence).fetchone():
        return {'delta':0,'stars':balance(c),'reason':'previous_game',
                'message':'Esta atividade foi concluída em uma partida anterior.'}
    limit=c.execute('SELECT daily_limit FROM world_settings WHERE id=1').fetchone()[0]
    earned=c.execute("""SELECT COALESCE(SUM(delta),0) FROM world_ledger
                        WHERE generation=? AND day=? AND delta>0 AND id NOT GLOB 'adjust:*'""",
                     (generation(c),today())).fetchone()[0]
    amount=max(0,min(amount,limit-earned))
    ledger_entry(c,key,amount,label,context)
    return {'delta':amount,'stars':balance(c),'reason':'earned' if amount else 'limit',
            'message':f'Você ganhou {amount} estrela(s)!' if amount else 'Seu treino foi concluído. As estrelas de hoje já estão guardadas.'}


def buy(c, body):
    ident=body.get('item_id')
    if not isinstance(ident,str) or ident not in CATALOG: raise ValueError('Item não encontrado.')
    item=c.execute('SELECT * FROM world_catalog WHERE id=?',(ident,)).fetchone()
    if c.execute('SELECT 1 FROM world_inventory WHERE item_id=?',(ident,)).fetchone():
        if not c.execute('SELECT active FROM world_inventory WHERE item_id=?',(ident,)).fetchone()[0]:
            raise ValueError('Este item foi removido pelo responsável. Peça a ele para reativar.')
        return {'charged':0,'world':scene(c)}
    if not item['available']: raise ValueError('Este item está descansando na oficina.')
    if 'price' in body and body['price']!=item['price']: raise missions.Conflict('O preço mudou. Reabra a oficina para conferir.')
    if balance(c)<item['price']: raise ValueError('Ainda faltam estrelas. Você pode voltar quando quiser.')
    c.execute('INSERT INTO world_inventory(item_id) VALUES(?)',(ident,))
    game=generation(c)
    key='buy:'+ident if game==1 else f'buy:{game}:{ident}'
    ledger_entry(c,key,-item['price'],CATALOG[ident][0])
    return {'charged':item['price'],'world':scene(c)}


def equip(c, body):
    color=body.get('color','mint')
    if color not in ('mint','sun','sky'): raise ValueError('Cor inválida.')
    values=[]
    for slot in ('hat','cape','buddy'):
        item=body.get(slot)
        if item is not None and (item!=slot or not c.execute('SELECT 1 FROM world_inventory WHERE item_id=? AND active=1',(item,)).fetchone()):
            raise ValueError('Escolha um acessório que já é seu.')
        values.append(item)
    c.execute('UPDATE world_state SET color=?,hat=?,cape=?,buddy=? WHERE id=1',(color,*values))
    return scene(c)


def walkable(x,y,owned):
    if ((x-530)/265)**2+((y-370)/150)**2<=1: return True
    if 'bridge' in owned and (((x-185)/135)**2+((y-345)/115)**2<=1 or 240<=x<=350 and 335<=y<=390): return True
    return 'portal' in owned and (((x-930)/145)**2+((y-320)/125)**2<=1 or 735<=x<=835 and 325<=y<=385)


def move(c,body):
    x,y=body.get('x'),body.get('y')
    if type(x) not in (int,float) or type(y) not in (int,float) or not math.isfinite(x+y) or not (0<=x<=1100 and 0<=y<=650): raise ValueError('Posição inválida.')
    owned={r[0] for r in c.execute('SELECT item_id FROM world_inventory WHERE active=1')}
    if not walkable(x,y,owned): raise ValueError('Vamos ficar nos caminhos da ilha.')
    c.execute('UPDATE world_state SET x=?,y=? WHERE id=1',(x,y))
    return {'ok':True}


def credit_context(c,row):
    context=json.loads(row['context'])
    # Legacy credits retain a stable occurrence key; recover the activity when available.
    if row['id'].startswith('award:') and not context:
        _,key,date,mode=row['id'].split(':')
        event=c.execute('SELECT e.title FROM events e JOIN mission_event_keys k ON k.event_id=e.id WHERE k.identity=?',(key,)).fetchone()
        context={'activity':event['title'] if event else 'Atividade anterior','date':date,'mode':mode}
    return context


def config(c):
    history=[]
    for r in c.execute('SELECT * FROM world_ledger WHERE generation=? ORDER BY rowid DESC',(generation(c),)):
        entry=dict(r); entry['context']=credit_context(c,r)
        entry['revoked']=bool(c.execute('SELECT 1 FROM world_ledger WHERE id=?',('revoke:'+r['id'],)).fetchone())
        if r['id'].startswith('buy:'):
            item=c.execute('SELECT active FROM world_inventory WHERE item_id=?',(r['id'].rsplit(':',1)[1],)).fetchone()
            entry['context']['item_state']='Ativo' if item and item['active'] else 'Removido'
        history.append(entry)
    return {'settings':dict(c.execute('SELECT * FROM world_settings WHERE id=1').fetchone()),'world':scene(c),
            'inventory':[dict(r) for r in c.execute('SELECT * FROM world_inventory')], 'history':history}


def revoke(c,body):
    ident=body.get('id'); reason=body.get('reason','')
    if not isinstance(ident,str) or not isinstance(reason,str) or len(reason)>400:
        raise ValueError('Concessão ou motivo inválido.')
    game=generation(c)
    row=c.execute('SELECT * FROM world_ledger WHERE id=? AND generation=?',(ident,game)).fetchone()
    if not row or not ident.startswith('award:') or row['delta']<=0:
        raise ValueError('Escolha uma concessão de estrelas.')
    c.execute('INSERT OR IGNORE INTO world_ledger(id,delta,label,day,context,generation) VALUES(?,?,?,?,?,?)',
              ('revoke:'+ident,-row['delta'],'Revogação de '+row['label'],today(),
               json.dumps({**credit_context(c,row),'original_id':ident,'reason':reason.strip()},ensure_ascii=False),game))
    return config(c)


def inventory_control(c,body):
    ident=body.get('item_id'); active=body.get('active')
    if not isinstance(ident,str) or ident not in CATALOG or type(active) is not bool:
        raise ValueError('Item ou estado inválido.')
    row=c.execute('SELECT active FROM world_inventory WHERE item_id=?',(ident,)).fetchone()
    if not row: raise ValueError('Este item ainda não foi adquirido.')
    if bool(row['active'])!=active:
        c.execute('UPDATE world_inventory SET active=? WHERE item_id=?',(int(active),ident))
        if not active:
            for slot in ('hat','cape','buddy'):
                c.execute(f'UPDATE world_state SET {slot}=NULL WHERE {slot}=?',(ident,))
            # Removing a path must not strand the avatar on an inaccessible island.
            c.execute('UPDATE world_state SET x=530,y=460 WHERE id=1')
        ledger_entry(c,'inventory:'+secrets.token_hex(16),0,('Reativado: ' if active else 'Removido: ')+CATALOG[ident][0])
    return config(c)


def configure(c,body):
    values=[]
    for name,maximum in (('learn',10),('memory',10),('real',10),('daily_limit',100)):
        value=body.get(name)
        if type(value) is not int or not 0<=value<=maximum: raise ValueError('Use valores de recompensa válidos.')
        values.append(value)
    items=body.get('catalog')
    if not isinstance(items,list) or len(items)!=len(CATALOG) or {i.get('id') for i in items if isinstance(i,dict)}!=set(CATALOG):
        raise ValueError('Catálogo inválido.')
    for item in items:
        if type(item.get('price')) is not int or not 0<=item['price']<=100 or type(item.get('available')) is not bool:
            raise ValueError('Preço ou disponibilidade inválidos.')
    c.execute('UPDATE world_settings SET learn=?,memory=?,real=?,daily_limit=? WHERE id=1',values)
    c.executemany('UPDATE world_catalog SET price=?,available=? WHERE id=?',[(i['price'],int(i['available']),i['id']) for i in items])
    return config(c)


def start(c,body,validate):
    event_id,date,mode=body.get('event_id'),body.get('date'),body.get('mode')
    if type(event_id) is not int or not isinstance(date,str) or not date: raise ValueError('Informe uma ocorrência.')
    validate(c,event_id,date)
    mission=missions.occurrence(c,event_id,date)
    if not mission or mode not in ('learn','order','bag'): raise ValueError('Prática inválida.')
    size=body.get('size',3)
    if type(size) is not int or not 2<=size<=4: raise ValueError('Escolha de 2 a 4 passos.')
    rounds=[]
    if mode=='order':
        count=min(size,len(mission['steps'])); windows=len(mission['steps'])-count+1
        starts=RNG.sample(range(windows),min(2,windows))
        for i in range(2):
            goal=[s['id'] for s in mission['steps'][starts[i%len(starts)]:starts[i%len(starts)]+count]]
            choices=RNG.sample(goal,len(goal))
            if len(choices)>1 and choices==goal: choices=choices[1:]+choices[:1]
            rounds.append({'goal':goal,'choices':choices})
    if mode=='bag':
        if mission['id'] not in KITS: raise ValueError('Este roteiro tem o jogo de sequência.')
        for _ in range(2):
            goal=RNG.sample(KITS[mission['id']],min(size,len(KITS[mission['id']])))
            extras=RNG.sample([i for i in ITEMS if i not in goal],3)
            rounds.append({'goal':goal,'choices':RNG.sample(goal+extras,len(goal)+3)})
    ident=secrets.token_hex(24)
    c.execute('INSERT INTO practice_sessions(id,event_id,event_key,date,mode,snapshot,rounds) VALUES(?,?,?,?,?,?,?)',
              (ident,event_id,missions.ensure_event_key(c,event_id),date,mode,json.dumps(mission),json.dumps(rounds)))
    return practice(c,ident)


def practice(c,ident):
    row=c.execute('SELECT * FROM practice_sessions WHERE id=?',(ident,)).fetchone()
    if not row: raise ValueError('Treino não encontrado. Abra um novo jogo.')
    result={'id':row['id'],'mode':row['mode'],'cursor':row['cursor'],'completed':bool(row['completed']),
            'mission':json.loads(row['snapshot'])}
    if row['mode']!='learn' and not row['completed']:
        current=json.loads(row['rounds'])[row['cursor']]
        result['choices']=current['choices']; result['count']=len(current['goal'])
        if row['mode']=='bag': result['preview']=current['goal']
    return result


def practice_action(c,ident,action,body,validate):
    row=c.execute('SELECT * FROM practice_sessions WHERE id=?',(ident,)).fetchone()
    if not row: raise ValueError('Treino não encontrado.')
    validate(c,row['event_id'],row['date'])
    key=c.execute('SELECT identity FROM mission_event_keys WHERE event_id=?',(row['event_id'],)).fetchone()
    if not key or key['identity']!=row['event_key']: raise ValueError('Esta atividade foi substituída.')
    mission=json.loads(row['snapshot'])
    grant_key=f"award:{row['event_key']}:{row['date']}:{row['mode']}"
    event=validate(c,row['event_id'],row['date'])
    eligible=timing.window(c,event,row['date'])['state']=='open'
    no_reward={'delta':0,'stars':balance(c),'reason':'outside_window','message':'Treino livre concluído! Estrelas só são concedidas no horário da atividade.'}
    occurrence=(row['event_id'],row['date'])
    if row['completed']: return {'correct':True,'completed':True,
        'reward':grant(c,grant_key,0,'Treino repetido',occurrence=occurrence) if eligible else no_reward}
    if row['mode']=='learn':
        if action!='advance': raise ValueError('Avance um passo de cada vez.')
        step_id=body.get('step_id'); ids=[s['id'] for s in mission['steps']]
        if step_id not in ids or ids.index(step_id)>row['cursor']: raise ValueError('Veja a sequência na ordem.')
        cursor=max(row['cursor'],ids.index(step_id)+1); complete=cursor==len(ids)
    else:
        current=json.loads(row['rounds'])[row['cursor']]
        selected=body.get('selected',[])
        if not isinstance(selected,list) or any(not isinstance(i,str) or i not in current['choices'] for i in selected) or len(set(selected))!=len(selected):
            raise ValueError('Escolha os itens deste desafio.')
        if action=='hint':
            if row['mode']=='bag': message='A lista desta rodada: '+', '.join(ITEMS[i] for i in current['goal'])+'.'
            else:
                index=next((i for i,step in enumerate(current['goal']) if i>=len(selected) or selected[i]!=step),None)
                message='Sua trilha está completa. Vamos conferir?' if index is None else f"Na posição {index+1}, procure: "+next(s['title'] for s in mission['steps'] if s['id']==current['goal'][index])+'.'
            return {'message':message}
        if action!='answer' or body.get('round')!=row['cursor']: raise ValueError('Reabra o desafio atual.')
        correct=selected==current['goal'] if row['mode']=='order' else len(selected)==len(current['goal']) and set(selected)==set(current['goal'])
        if not correct: return {'correct':False,'completed':False}
        cursor=row['cursor']+1; complete=cursor==2
    c.execute('UPDATE practice_sessions SET cursor=?,completed=? WHERE id=?',(cursor,int(complete),ident))
    result={'correct':True,'completed':complete,'cursor':cursor}
    if complete and not eligible:
        result['reward']=no_reward
    if complete and eligible:
        field='learn' if row['mode']=='learn' else 'memory'
        value=c.execute(f'SELECT {field} FROM world_settings WHERE id=1').fetchone()[0]
        event=validate(c,row['event_id'],row['date'])
        result['reward']=grant(c,grant_key,value,'Aprender' if field=='learn' else 'Treino de memória',
            {'activity':event['title'],'date':row['date'],'mode':row['mode']},occurrence=occurrence)
    return result


def real_reward(c,body,validate):
    event_id,date=body.get('event_id'),body.get('date')
    if type(event_id) is not int or not isinstance(date,str) or not date: raise ValueError('Ocorrência inválida.')
    event=validate(c,event_id,date); mission=missions.occurrence(c,event_id,date)
    if not mission or mission['confirmed']!=mission['total']: raise ValueError('Os passos reais ainda não estão confirmados.')
    words=unicodedata.normalize('NFD',event['title']+' '+mission['name']+' '+' '.join(s['title']+' '+s['instruction'] for s in mission['steps'])).encode('ascii','ignore').decode().lower()
    if mission['id'] not in REAL_TEMPLATES or re.search(r'medic|remedio|higien|banh|dente|refeic|aliment|dorm|sono|banheiro',words) or event['icon'] in ('💊','🚽','🪥','🚿'):
        return {'delta':0,'stars':balance(c),'reason':'care','message':'Cuidar de você não depende de estrelas. Seu progresso está guardado.'}
    key=f"award:{missions.ensure_event_key(c,event_id)}:{date}:real"
    value=c.execute('SELECT real FROM world_settings WHERE id=1').fetchone()[0]
    return grant(c,key,value,'Esforço na missão real',{'activity':event['title'],'date':date,'mode':'real'},
                 occurrence=(event_id,date))
