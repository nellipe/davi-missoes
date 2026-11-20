"""Record real world controls against a disposable SQLite database on loopback.

Requires Playwright for Python, a Chromium executable, and ffmpeg on PATH.
"""
import argparse
import json
import os
from pathlib import Path
import statistics
import subprocess
import sys
import tempfile
import threading
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
EVIDENCE = ROOT / 'docs/evidencias-etapa9-1'
SCRATCH = ROOT / 'tests/__pycache__'
PASSWORD = 'Synthetic-worlds-91'
ITINERARIES = {
    'praia': ['nara','tide-pool','shell-gold','shell-blue','wreck','shell-rose','chest-song'],
    'dinossauros': ['trico','fossil-head','fossil-ribs','fossil-tail','amber-cave','skeleton'],
    'inventores': ['parafuso','gear-square','pressure','market','coil','commands','machine'],
}
DETOUR = {'praia':'tide-pool','dinossauros':'fossil-head','inventores':'pressure'}
BROWSERS = {'desktop':{'width':1366,'height':820}, 'mobile':{'width':390,'height':844}}
VIDEO_SIZES = {'desktop':{'width':854,'height':512}, 'mobile':BROWSERS['mobile']}


def allow_legacy_fixture(server):
    """Open the chapters for recordings that test earlier stages on synthetic data."""
    import campaign
    import screen_time
    with server.db() as connection:
        screen_time.configure(connection, {**screen_time.DEFAULT,'enabled':False},server.timing.now().timestamp())
        connection.executemany('INSERT OR IGNORE INTO campaign_unlocks VALUES(1,?)',[(world,) for world in campaign.CHAPTERS])


def set_quality(page, value):
    page.locator('[data-action=forest-options]').click()
    page.locator('#forestQuality').select_option(value)
    page.locator('#forestDialog [data-action=forest-close]').click()


def stats(page):
    page.evaluate("() => document.fonts.ready.then(() => true)")
    start = page.evaluate('() => DaviForest.telemetry().frames')
    page.wait_for_function('start => DaviForest.telemetry().frames >= start+24', arg=start, timeout=45000)
    result = page.evaluate('() => DaviForest.telemetry()')
    frames = result['frameMs'][-24:]
    return {
        'calls':result['calls'], 'triangles':result['triangles'], 'frames':len(frames),
        'median_ms':round(statistics.median(frames),1), 'peak_ms':round(max(frames),1),
    }


PLANNED_ROUTE = """async ([world,id])=>{
  const {createNavigation,route}=await import('/assets/forest/navigation.mjs');
  const data=await (await fetch('/api/worlds/'+world)).json();
  const [x0,,z0]=DaviForest.diagnostics().position;
  const from={x:x0,z:z0};
  const nav=createNavigation(data.map,data.collision,[]);
  const {x,z}=data.layout.places.find(p=>p.id===id);
  const approaches=[[x,z+1.1],[x,z-1.1],[x+1.1,z],[x-1.1,z],[x,z]]
    .filter(([a,b])=>nav(a,b))
    .sort(([a,b],[c,d])=>Math.hypot(a-x0,b-z0)-Math.hypot(c-x0,d-z0));
  for(const [a,b] of approaches){const path=route(from,{x:a,z:b},nav,data.map.bounds);if(path.length)return path.length;}
  return 0;
}"""


def activate(button, touch=False, **options):
    if touch:
        button.tap(**options)
    else:
        button.click(**options)


def challenge_control(dialog, action, choice=None):
    selector=f'[data-action="forest-puzzle-{action}"]'
    if choice is not None:
        selector+=f'[data-choice="{choice}"]'
    return dialog.locator(selector)


def perform_challenge(page, dialog, action, choice=None, *, touch=False, keyboard=None):
    control=challenge_control(dialog,action,choice)
    if keyboard:
        control.press(keyboard)
    else:
        activate(control,touch)
    page.locator('#content[aria-busy="true"]').wait_for(state='hidden')


def solve_world_challenge(page, dialog, kind, touch):
    perform_challenge(page,dialog,'start',touch=touch)
    choices={
        'melody':['shell-rose','shell-gold','shell-blue'], 'commands':['power','steps','dance'],
        'dig':[0,1,2], 'valve':[1,1], 'coil':['left','right'],
    }
    if kind=='skeleton':
        for piece in ('head','ribs','tail'):
            perform_challenge(page,dialog,'pick',piece,touch=touch)
            perform_challenge(page,dialog,'fit',piece,touch=touch)
    else:
        for step in choices[kind]:
            perform_challenge(page,dialog,'step',step,touch=touch)
        if kind!='dig':
            perform_challenge(page,dialog,'check',touch=touch)


def travel(page, world, place, touch):
    ident = place['id']
    points = page.evaluate(PLANNED_ROUTE, [world,ident])
    activate(page.locator('[data-action=forest-paths]'), touch)
    activate(page.locator(f'#forestDialog [data-action=forest-travel][data-id="{ident}"]'), touch)
    near = page.locator(f'#forestInteract[data-place="{ident}"]')
    activate(near, touch, timeout=175000)
    dialog = page.locator('#forestDialog[open]')
    dialog.get_by_role('heading', name=place['title'], exact=True).wait_for()
    diagnostics = page.evaluate('() => DaviForest.diagnostics()')
    assert diagnostics['navigationValid'] and diagnostics['pipoNavigationValid'], diagnostics['position']
    if challenge_control(dialog,'start').count():
        kind=page.request.get('/api/worlds/'+world).json()['challenges'][ident]
        solve_world_challenge(page,dialog,kind,touch)
        dialog.wait_for(state='hidden')
    elif place.get('collect') or place.get('inspect'):
        action = 'collect' if place.get('collect') else 'inspect-world'
        activate(dialog.locator(f'[data-action=forest-{action}]'), touch)
        dialog.wait_for(state='hidden')
    else:
        activate(dialog.locator('[data-action=forest-close]'), touch)
    return points


def select_in_ui(page,key):
    page.locator('[data-action=world-picker]').click()
    page.locator(f'.world-picker [data-world="{key}"]').click()


def stamp(page):
    return page.evaluate('() => DaviForest.diagnostics().position')


def verify_width(page,width,element):
    box = page.locator(element).bounding_box()
    assert box and box['x'] >= 0 and box['x']+box['width'] <= width+1, (width,element,box)


def copy_video(raw,target,device,finish_at):
    # Keep the final reveal at normal speed. Compress the walks and return.
    slow_start=max(1,finish_at-.9)
    slow_end=finish_at+3.0
    pace=min(.41,42/slow_start)
    scale = '854:-2' if device=='desktop' else '360:-2'
    vf = (f"[0:v]trim=end={slow_start},setpts={pace}*(PTS-STARTPTS)[walk];"
          f"[0:v]trim=start={slow_start}:end={slow_end},setpts=PTS-STARTPTS[finish];"
          f"[0:v]trim=start={slow_end},setpts=.83*(PTS-STARTPTS)[return];"
          f"[walk][finish][return]concat=n=3:v=1:a=0,scale={scale},fps=24")
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','2','-i',str(raw),
                    '-filter_complex_threads','2','-filter_complex',vf,
                    '-an','-c:v','libx264','-threads','2','-preset','fast','-crf','26','-pix_fmt','yuv420p',
                    '-movflags','+faststart',str(target)], check=True)


def record(browser, origin, parent, headers, device, key, scratch):
    width=BROWSERS[device]['width']
    context=browser.new_context(base_url=origin,viewport=BROWSERS[device],record_video_dir=scratch,
                                record_video_size=VIDEO_SIZES[device],is_mobile=device=='mobile',
                                has_touch=device=='mobile',device_scale_factor=.75 if device=='desktop' else 1)
    pair=parent.request.post('/api/devices/code',data={},headers=headers).json()['code']
    assert context.request.post('/api/pair',data={'code':pair},headers={'Origin':origin}).ok
    csrf=context.request.get('/api/me').json()['csrf']
    assert context.request.put('/api/worlds/selection',data={'world':key},headers={'Origin':origin,'X-CSRF-Token':csrf}).ok
    endpoint='/api/worlds/'+key
    initial=context.request.get(endpoint).json()
    assert not initial['progress'] and initial['economy']['stars']==0
    places={place['id']:place for place in initial['layout']['places']}
    page=context.new_page()
    start=time.monotonic()
    issues=[]
    page.on('pageerror', lambda error: issues.append(str(error)))
    page.on('console', lambda msg: issues.append(msg.text) if msg.type=='error' else None)
    page.add_init_script("localStorage.setItem('davi-forest-quality',localStorage.getItem('davi-forest-quality')||'low')")
    page.goto(origin)
    page.locator(f'.trail-shell[data-world="{key}"] #forestCanvas[data-ready=true]').wait_for(timeout=45000)
    verify_width(page,width,'[data-action=world-picker]')
    profile={'economy':stats(page)}
    page.screenshot(path=EVIDENCE/f'{key}-{device}.jpg',type='jpeg',quality=88,scale='css')
    if device=='desktop':
        set_quality(page,'high')
        profile['detail']=stats(page)
        set_quality(page,'low')
    detoured=False
    finish_at=None
    for ident in ITINERARIES[key]:
        place=places[ident]
        points=travel(page,key,place,device=='mobile')
        detoured |= points>1
        if ident==DETOUR[key]:print(f'{device} {key} {ident} route: {points} waypoints',flush=True)
        if place.get('collect'):
            page.locator('#forestMessage').filter(has_text=place.get('success','Descoberta guardada')).wait_for()
        if place.get('requires'):
            finish_at=time.monotonic()-start
            page.wait_for_timeout(1400)
            page.screenshot(path=EVIDENCE/f'{key}-final-{device}.jpg',type='jpeg',quality=89,scale='css')
            page.wait_for_timeout(2300)
        elif place.get('collect'):
            page.wait_for_timeout(550)
        print(device,key,ident,flush=True)
    assert detoured and finish_at is not None
    saved=context.request.get(endpoint).json()
    assert len(saved['progress'])==4
    assert saved['economy']['inventory']==initial['economy']['inventory']
    assert saved['economy']['stars']==initial['economy']['stars']
    select_in_ui(page,'forest')
    page.locator('.trail-shell[data-world="forest"] #forestCanvas[data-ready=true]').wait_for(timeout=45000)
    select_in_ui(page,key)
    page.locator('#forestCanvas[data-ready=true]').wait_for(timeout=45000)
    resumed=stamp(page)
    assert abs(resumed[0]-saved['position']['x'])<.12 and abs(resumed[2]-saved['position']['z'])<.12
    assert page.locator('#worldFinds').inner_text()=='3 de 3 achados'
    page.wait_for_timeout(1200)
    print(device,key,'checkpoint retomado',flush=True)

    video=page.video
    page.close()
    print(device,key,'gravação concluída',flush=True)
    copy_video(video.path(),EVIDENCE/f'{key}-{device}.mp4',device,finish_at)

    if device=='mobile':
        page=context.new_page()
        page.set_viewport_size({'width':360,'height':800})
        page.goto(origin)
        page.locator('#forestCanvas[data-ready=true]').wait_for(timeout=45000)
        verify_width(page,360,'#forestInteract')
        verify_width(page,360,'#worldFinds')
        page.locator('[data-action=forest-options]').click()
        page.locator('#forestMotion').select_option('reduced')
        page.locator('[data-action=forest-fallback]').click()
        page.locator('#worldMap[data-ready=true]').wait_for(timeout=45000)
        assert page.evaluate('() => DaviForest.diagnostics().motion.reduced')
        page.locator(f'#forestInteract[data-place="{ITINERARIES[key][-1]}"]').wait_for()
        page.screenshot(path=EVIDENCE/f'{key}-2d.jpg',type='jpeg',quality=88)
        page.get_by_role('button',name='Vista 3D').click()
        page.locator('#forestCanvas[data-ready=true]').wait_for(timeout=45000)
        assert page.locator('#worldFinds').inner_text()=='3 de 3 achados'

    context.close()
    assert not issues,issues
    return profile


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium',required=True)
    parser.add_argument('--device',choices=BROWSERS,required=True)
    parser.add_argument('--world',choices=ITINERARIES)
    args=parser.parse_args()
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    SCRATCH.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='worlds-91-',dir=SCRATCH) as scratch:
        os.environ['DAVI_DATA_DIR']=str(Path(scratch)/'synthetic')
        import server
        from lan_security import Config

        server.initialize()
        allow_legacy_fixture(server)
        server.set_setting('password',server.hash_password(PASSWORD))
        with server.DaviHTTPServer(('127.0.0.1',0),server.Handler) as http:
            server.CONFIG=Config({'DAVI_PORT':str(http.server_port)})
            origin=f'http://127.0.0.1:{http.server_port}'
            thread=threading.Thread(target=http.serve_forever,daemon=True)
            thread.start()
            try:
                with sync_playwright() as runtime:
                    browser=runtime.chromium.launch(executable_path=args.chromium,
                        args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
                    parent=browser.new_context(base_url=origin)
                    assert parent.request.post('/api/login',data={'password':PASSWORD},headers={'Origin':origin}).ok
                    csrf=parent.request.get('/api/me').json()['csrf']
                    headers={'Origin':origin,'X-CSRF-Token':csrf}
                    for key in ([args.world] if args.world else ITINERARIES):
                        profile=record(browser,origin,parent,headers,args.device,key,Path(scratch))
                        (SCRATCH/f'profile-{key}-{args.device}.json').write_text(json.dumps(profile),encoding='utf-8')
                        print(args.device,key,profile,flush=True)
                    browser.close()
            finally:
                http.shutdown()
                thread.join()


if __name__=='__main__':
    main()
