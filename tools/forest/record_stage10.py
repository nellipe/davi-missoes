"""Validate the unified maps in Chromium with a synthetic agenda, and capture evidence."""
import argparse
import datetime as dt
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from unittest.mock import patch

from playwright.sync_api import sync_playwright
from record_worlds import ROOT, SCRATCH, PASSWORD, activate, verify_width

EVIDENCE = ROOT / 'docs/evidencias-etapa10'
WORLDS = ('forest', 'praia', 'dinossauros', 'inventores')
READY = {'3d':'#forestCanvas[data-ready=true]', '2d':'#worldMap[data-ready=true]'}
PREPARE = """(() => {
    localStorage.setItem('davi-forest-quality','low');
    localStorage.setItem('davi-forest-motion-mode','reduced');
})()"""


def headers(context, origin):
    return {'Origin':origin,'X-CSRF-Token':context.request.get('/api/me').json()['csrf']}


def paired(browser, origin, parent, **options):
    context = browser.new_context(base_url=origin, **options)
    code = parent.request.post('/api/devices/code',data={},headers=headers(parent,origin)).json()['code']
    assert context.request.post('/api/pair',data={'code':code},headers={'Origin':origin}).ok
    context.add_init_script(PREPARE)
    return context


def event_fixture(parent, origin):
    request = parent.request
    authenticated = headers(parent, origin)
    today = request.get('/api/me').json()['today']
    tomorrow = (dt.date.fromisoformat(today)+dt.timedelta(days=1)).isoformat()
    for i in range(18):
        event = {'title':f'Compromisso sintético {i+1:02}', 'time':f'{7+i//3:02}:{i%3*20:02}',
                 'duration':15, 'start_date':today}
        result = request.post('/api/events',data=event,headers=authenticated)
        assert result.status == 201, result.text()
    assert request.put('/api/events/2/mission',data={'template_id':'taekwondo'},headers=authenticated).ok
    tomorrow_event = {'title':'Compromisso de amanhã','time':'08:00','duration':15,'start_date':tomorrow}
    result = request.post('/api/events',data=tomorrow_event,headers=authenticated)
    assert result.status == 201
    return today


def wait_ready(page, mode, world=None):
    selector = READY[mode]
    if world:
        selector = f'.trail-shell[data-world="{world}"] {selector}'
    page.locator(selector).wait_for(timeout=45000)


def use_world(page, world, mode, touch=False):
    activate(page.locator('[data-action=world-picker]'),touch)
    assert page.locator('.world-picker [data-world]').evaluate_all('(xs)=>xs.map(x=>x.dataset.world)') == list(WORLDS)
    activate(page.locator(f'.world-picker [data-world="{world}"]'),touch)
    wait_ready(page,mode,world)


def switch_view(page, mode, touch=False):
    activate(page.get_by_role('button',name='Vista '+mode.upper(),exact=True),touch)
    wait_ready(page,mode)


def snapshot(page):
    return page.evaluate('() => DaviForest.diagnostics()')


def activity_points(state):
    return {f['id']:(f['x'],f['z'],f['sector']) for f in state['features'] if f['id'].startswith('activity-')}


def distance(a,b):
    return math.hypot(a[0]-b[0],a[2]-b[2])


def label_boxes(page, limit):
    boxes = page.locator('.forest-label:not([hidden])').evaluate_all('xs=>xs.map(x=>x.getBoundingClientRect().toJSON())')
    assert len(boxes) <= limit
    for i,a in enumerate(boxes):
        assert not any(a['left']<b['right'] and b['left']<a['right'] and
                       a['top']<b['bottom'] and b['top']<a['bottom'] for b in boxes[:i]), boxes


def audit_placement(page):
    check = page.evaluate("""async () => {
        const {createNavigation,route}=await import('/assets/forest/navigation.mjs');
        const world=document.querySelector('.trail-shell').dataset.world;
        const data=await (await fetch(world==='forest'?'/api/forest/map':'/api/worlds/'+world)).json();
        const spawn=data.spawn??data.layout.spawn;
        const features=DaviForest.diagnostics().features;
        const signs=features.filter(f=>f.id.startsWith('activity-'));
        const landmarks=features.filter(f=>!f.id.startsWith('activity-'));
        const spacing=Math.min(...signs.flatMap((a,i)=>signs.slice(i+1).map(b=>Math.hypot(a.x-b.x,a.z-b.z))));
        const occupied=Math.min(...signs.flatMap(a=>landmarks.map(b=>Math.hypot(a.x-b.x,a.z-b.z))));
        const failed=[];
        for(const inventory of [[],['bridge','house','portal']]){
          const nav=createNavigation(data.map,data.collision,inventory);
          for(const {id,x,z} of signs)if(!route(spawn,{x,z},nav,data.map.bounds).length)failed.push(id);
        }
        return {count:signs.length,spacing,occupied,failed,sectors:[...new Set(signs.map(s=>s.sector))]};
    }""")
    assert check['count']==18 and check['spacing']>=4 and check['occupied']>=2.5, check
    assert not check['failed'] and len(check['sectors'])>=3, check
    return check


def save_map(page, world):
    page.evaluate("""() => {
        const svg=document.querySelector('#worldMap').cloneNode(true);
        svg.id='comparison';
        svg.setAttribute('viewBox','-17 -14 67 31');
        svg.style.cssText='display:block;position:fixed;left:20px;top:20px;width:1005px;height:465px;z-index:2000;background:#223f37;border-radius:8px';
        document.body.append(svg);
    }""")
    page.locator('#comparison').screenshot(path=EVIDENCE/f'{world}-depois-2d.jpg',type='jpeg',quality=89,scale='css')
    page.locator('#comparison').evaluate('(element)=>element.remove()')


def desktop(browser, origin, parent, server):
    context = paired(browser,origin,parent,viewport={'width':1366,'height':820},device_scale_factor=.75)
    api = context.request
    authenticated = headers(context,origin)
    assert api.put('/api/world/move',data={'x':505,'y':455},headers=authenticated).ok
    old = api.get('/api/world').json()['avatar']
    server.set_setting('selected_world',json.dumps('island'))
    page = context.new_page()
    issues = []
    page.on('pageerror',lambda error:issues.append(str(error)))
    page.goto(origin)
    wait_ready(page,'2d','forest')
    assert page.evaluate("localStorage.getItem('davi-forest-mode')")=='2d'
    assert api.get('/api/world').json()['avatar']==old
    assert api.get('/api/forest/map').json()['position']=={'x':0.0,'z':7.5}
    assert len(api.get('/api/worlds').json()['worlds'])==4
    switch_view(page,'3d')
    results = {}
    for world in WORLDS:
        if world!='forest':
            use_world(page,world,'3d')
        page.wait_for_function("() => DaviForest.telemetry().frames>2")
        original=snapshot(page)
        assert original['quality']=='low' and original['motion']['reduced']
        label_boxes(page,5)
        page.screenshot(path=EVIDENCE/f'{world}-depois-3d.jpg',type='jpeg',quality=89,scale='css')
        results[world]=audit_placement(page)
        page.locator('[data-action=forest-rotate][data-turn="1"]').click()
        original_angle=snapshot(page)['angle']
        assert abs(original_angle-original['angle'])>.4
        for i in range(6 if world=='inventores' else 8):
            original=snapshot(page)
            mode='2d' if original['view']=='3d' else '3d'
            switch_view(page,mode)
            restored=snapshot(page)
            assert activity_points(restored)==activity_points(original)
            assert distance(original['position'],restored['position'])<.05
            assert distance(original['pipoPosition'],restored['pipoPosition'])<.28
            assert restored['navigationValid'] and restored['pipoNavigationValid']
            if mode=='3d':
                assert original_angle==restored['angle']
            elif i==0:
                assert page.locator('#worldMap [data-activity-id]').count()==18
                save_map(page,world)
        page.reload()
        wait_ready(page,'3d',world)
        assert activity_points(snapshot(page))==activity_points(original)
        assert not issues, issues
        print(world, results[world], flush=True)
    context.close()
    return results


def paths(page, touch=False):
    activate(page.locator('[data-action=forest-paths]'),touch)
    return page.locator('#forestDialog[open]')


def click_action(page, action, touch=False, qualifier=''):
    activate(page.locator(f'[data-action="{action}"]{qualifier}'),touch)


def walk_to_event(page, touch=False):
    initial = snapshot(page)
    dialog = paths(page,touch)
    first = dialog.locator('.f-activity-list article').first
    assert '07:00' in first.inner_text() and 'Encerrada' in first.inner_text()
    activate(first.locator('[data-action=forest-travel]'),touch)
    sign = page.locator('#forestInteract[data-place="activity-1"]')
    sign.wait_for(timeout=30000)
    after = snapshot(page)
    assert distance(initial['position'],after['position'])>.6
    assert after['navigationValid'] and after['pipoNavigationValid']
    page.wait_for_function("""() => {
        const d=DaviForest.diagnostics();
        return Math.hypot(d.position[0]-d.pipoPosition[0],d.position[2]-d.pipoPosition[2])<2.5;
    }""")
    if touch:
        sign.tap()
    else:
        page.keyboard.press('e')
    page.get_by_role('heading',name='Compromisso sintético 01',exact=True).wait_for()
    page.wait_for_timeout(620)


def agenda_from_event(page, today, touch=False):
    click_action(page,'forest-calendar',touch,'[data-id="1"]')
    card = page.locator(f'#dailyAgenda [data-activity="1"][data-date="{today}"]')
    card.wait_for()
    assert card.evaluate('(el)=>el===document.activeElement')


def gameplay_video(page, name):
    video=page.video
    page.close()
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','2','-i',video.path(),
                    '-vf','scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=24','-an','-c:v','libx264',
                    '-threads','2','-preset','fast','-crf','26','-pix_fmt','yuv420p','-movflags',
                    '+faststart',str(EVIDENCE/f'{name}.mp4')],check=True)


def change_day(page, positions):
    click_action(page,'childnext')
    page.locator('#dailyAgenda').get_by_text('Compromisso de amanhã',exact=True).wait_for()
    click_action(page,'world-home')
    wait_ready(page,'2d','forest')
    assert list(activity_points(snapshot(page)))==['activity-19']
    click_action(page,'forest-calendar')
    click_action(page,'childtoday')
    click_action(page,'world-home')
    wait_ready(page,'2d','forest')
    assert activity_points(snapshot(page))==positions


def touch_ground(page):
    initial=snapshot(page)['position']
    point=page.evaluate("""async () => {
        const {createNavigation}=await import('/assets/forest/navigation.mjs');
        const data=await (await fetch('/api/forest/map')).json();
        const walkable=createNavigation(data.map,data.collision,data.economy.inventory);
        const [x,,z]=DaviForest.diagnostics().position;
        for(const [dx,dz] of [[1.5,0],[-1.5,0],[0,1.5],[0,-1.5]]){
          if(!walkable.segmentClear({x,z},{x:x+dx,z:z+dz}))continue;
          const screen=DaviForest.project(x+dx,z+dz);
          if(screen.groundVisible&&document.elementFromPoint(screen.x,screen.y)?.closest('#worldMap'))return screen;
        }
    }""")
    assert point, initial
    page.touchscreen.tap(point['x'],point['y'])
    page.wait_for_function("""([x,,z]) => {
        const [a,,b]=DaviForest.diagnostics().position;
        return Math.hypot(a-x,b-z)>.8;
    }""",arg=initial)


def economy_and_wardrobe(page, parent, origin, positions):
    assert not page.evaluate('DaviForest.walkable(0,-5.4)')
    assert parent.request.put('/api/world/balance',data={'stars':10000},headers=headers(parent,origin)).ok
    page.locator('#forestBalance strong').filter(has_text='10000').wait_for(timeout=20000)
    click_action(page,'forest-shop',True)
    for item in ('bridge','house','portal','hat','cape','buddy'):
        button=page.locator(f'[data-action=forest-buy][data-id="{item}"]')
        button.tap()
        button.wait_for(state='detached')
    click_action(page,'forest-close',True)
    assert page.evaluate('DaviForest.walkable(0,-5.4)')
    assert activity_points(snapshot(page))==positions
    verify_width(page,360,'[data-action=forest-wardrobe]')
    click_action(page,'forest-wardrobe',True)
    page.get_by_role('heading',name='Seu jeito de explorar').wait_for()
    click_action(page,'forest-color',True,'[data-color="sky"]')
    page.locator('[data-action=forest-color][data-color=sky][aria-pressed=true]').wait_for()
    for item in ('hat','cape','buddy'):
        equip=page.locator(f'[data-action=forest-equip][data-id="{item}"]')
        equip.tap()
        equip.filter(has_text='Tirar').wait_for()
    page.screenshot(path=EVIDENCE/'forest-360-personagem.jpg',type='jpeg',quality=90)
    click_action(page,'forest-close',True)
    assert page.locator('#worldMap [data-accessory="buddy"]').get_attribute('visibility')=='visible'
    assert page.locator('#worldMap [data-clothes]').get_attribute('fill')=='#477de0'
    assert page.locator('#forest2dBridge').evaluate('(el)=>getComputedStyle(el).visibility')=='visible'
    for item in ('house','portal'):
        assert page.locator(f'#worldMap [data-owned-mark="{item}"]').get_attribute('opacity')=='1'
    switch_view(page,'3d',True)
    assert snapshot(page)['pipoScarfVisible']
    assert page.evaluate('DaviForest.walkable(0,-5.4)')
    assert activity_points(snapshot(page))==positions
    assert set(page.request.get('/api/world').json()['inventory'])=={'bridge','house','portal','hat','cape','buddy'}
    dialog=paths(page,True)
    dialog.locator('[data-action=forest-travel][data-id="bridge"]').tap()
    page.locator('#forestInteract[data-place="bridge"]').tap(timeout=30000)
    click_action(page,'forest-cross',True)
    page.wait_for_function('() => DaviForest.diagnostics().position[2]<-5.2',timeout=30000)
    page.wait_for_function('() => DaviForest.diagnostics().pipoPosition[2]<-2.1',timeout=12000)
    switch_view(page,'2d',True)
    assert snapshot(page)['position'][2]<-5.2 and snapshot(page)['navigationValid']
    previous=page.request.get('/api/world').json()
    assert parent.request.put('/api/world/balance',data={'stars':0},headers=headers(parent,origin)).ok
    assert parent.request.put('/api/world/balance',data={'stars':10000},headers=headers(parent,origin)).ok
    restored=page.request.get('/api/world').json()
    assert restored['stars']==10000 and restored['inventory']==previous['inventory'] and restored['avatar']==previous['avatar']


def interaction(browser,origin,parent,server,today,scratch):
    desktop_context=paired(browser,origin,parent,viewport={'width':1366,'height':820},
        device_scale_factor=.75,record_video_dir=scratch,record_video_size={'width':854,'height':512})
    server.set_setting('selected_world',json.dumps('forest'))
    page=desktop_context.new_page()
    page.goto(origin)
    wait_ready(page,'3d','forest')
    page.locator(READY['3d']).focus()
    origin_position=snapshot(page)['position']
    page.keyboard.down('d')
    page.wait_for_timeout(580)
    page.keyboard.up('d')
    assert distance(origin_position,snapshot(page)['position'])>.12
    click_action(page,'forest-rotate',qualifier='[data-turn="1"]')
    walk_to_event(page)
    agenda_from_event(page,today)
    page.wait_for_timeout(660)
    click_action(page,'world-home')
    wait_ready(page,'3d','forest')
    switch_view(page,'2d')
    positions=activity_points(snapshot(page))
    page.wait_for_timeout(710)
    gameplay_video(page,'percurso-desktop')
    desktop_context.close()
    print('Desktop: teclado, caminhada até a placa, foco na agenda e troca 3D/2D',flush=True)

    mobile=paired(browser,origin,parent,viewport={'width':390,'height':844},has_touch=True,is_mobile=True,
        record_video_dir=scratch,record_video_size={'width':390,'height':844})
    mobile.add_init_script("""(() => {
        if(!localStorage.getItem('davi-forest-mode')) localStorage.setItem('davi-forest-mode','island');
    })()""")
    server.set_setting('selected_world',json.dumps('praia'))
    page=mobile.new_page()
    page.goto(origin)
    wait_ready(page,'2d','forest')
    use_world(page,'praia','2d',True)
    label_boxes(page,3)
    page.screenshot(path=EVIDENCE/'praia-390-vista-2d.jpg',type='jpeg',quality=90)
    for world in WORLDS[1:]:
        if world!='praia':
            use_world(page,world,'2d',True)
        walk_to_event(page,touch=True)
        agenda_from_event(page,today,touch=True)
        click_action(page,'world-home',True)
        wait_ready(page,'2d',world)
    use_world(page,'forest','2d',True)
    page.wait_for_timeout(630)
    gameplay_video(page,'percurso-toque-390')
    mobile.close()
    print('390 px: preferência legada local, toque, três rotas e agenda exata',flush=True)

    small=paired(browser,origin,parent,viewport={'width':360,'height':800},has_touch=True,is_mobile=True)
    small.add_init_script("localStorage.setItem('davi-forest-mode','2d')")
    page=small.new_page()
    page.goto(origin)
    wait_ready(page,'2d','forest')
    touch_ground(page)
    click_action(page,'child-now',True)
    page.get_by_role('heading',name='Agora',exact=True).wait_for()
    click_action(page,'world-home',True)
    wait_ready(page,'2d','forest')
    click_action(page,'forest-calendar',True)
    change_day(page,positions)
    dialog=paths(page,True)
    activate(dialog.locator('[data-action=forest-activity-details][data-id="activity-2"]'),True)
    dialog.get_by_role('heading',name='Compromisso sintético 02',exact=True).wait_for()
    click_action(page,'forest-mission',True,'[data-id="2"]')
    page.get_by_text('Compromisso sintético 02',exact=True).first.wait_for()
    page.goto(origin)
    wait_ready(page,'2d','forest')
    economy_and_wardrobe(page,parent,origin,positions)
    small.close()
    print('360 px: Agora, mudança de data, roteiro correto, compras e guarda-roupa',flush=True)

    fallback=paired(browser,origin,parent,viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    fallback.add_init_script("""(() => {
        const get=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(type,...args){
            return /webgl/.test(type)?null:get.call(this,type,...args);
        };
    })()""")
    page=fallback.new_page()
    page.goto(origin)
    wait_ready(page,'2d','forest')
    for world in WORLDS[1:]:
        use_world(page,world,'2d')
        assert page.locator('#worldMap [data-activity-id]').count()==18
    page.route('**/forest.js',lambda route:route.abort())
    page.reload()
    page.locator('#dailyAgenda [data-activity]').first.wait_for()
    assert page.locator('#dailyAgenda [data-activity]').count()==18
    fallback.close()
    print('Fallback 2D nos quatro mundos e agenda quando o módulo está indisponível',flush=True)


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--chromium', required=True)
    cli.add_argument('--section', choices=('desktop','interaction','all'), default='all')
    args=cli.parse_args()
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    SCRATCH.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='stage10-',dir=SCRATCH) as scratch:
        os.environ['DAVI_DATA_DIR']=str(Path(scratch)/'synthetic')
        import schedule_window
        import server
        from lan_security import Config
        server.Handler.log_message=lambda *_:None
        server.initialize()
        server.set_setting('password',server.hash_password(PASSWORD))
        morning=dt.datetime(2026,11,19,8,10,tzinfo=schedule_window.TZ)
        with patch.object(schedule_window,'now',return_value=morning), server.DaviHTTPServer(('127.0.0.1',0),server.Handler) as http:
            server.CONFIG=Config({'DAVI_PORT':str(http.server_port)})
            origin=f'http://127.0.0.1:{http.server_port}'
            thread=threading.Thread(target=http.serve_forever,daemon=True)
            thread.start()
            try:
                with sync_playwright() as runtime:
                    browser=runtime.chromium.launch(executable_path=args.chromium,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
                    parent=browser.new_context(base_url=origin)
                    assert parent.request.post('/api/login',data={'password':PASSWORD},headers={'Origin':origin}).ok
                    today=event_fixture(parent,origin)
                    if args.section in ('desktop','all'):
                        results=desktop(browser,origin,parent,server)
                        (SCRATCH/'stage10-after.json').write_text(json.dumps(results,ensure_ascii=False),encoding='utf-8')
                    if args.section in ('interaction','all'):
                        interaction(browser,origin,parent,server,today,Path(scratch))
                    browser.close()
            finally:
                http.shutdown()
                thread.join()


if __name__=='__main__':
    main()
