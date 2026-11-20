"""Record campaign approvals, playable chapters and screen-time pauses in Chromium."""
import argparse
import datetime as dt
import os
from pathlib import Path
import subprocess
import tempfile
import threading
from unittest.mock import patch

from playwright.sync_api import sync_playwright
from record_worlds import ROOT, SCRATCH, PASSWORD
from record_stage10 import headers, paired, snapshot, wait_ready

EVIDENCE = ROOT / 'docs/evidencias-etapa11'
ORIGIN_PATH = '/api/adventure'
WEEK = '2026-11-16'


def screenshot(page, name, **options):
    page.screenshot(path=EVIDENCE/f'{name}.jpg',type='jpeg',quality=89,scale='css',**options)


def button(page, action, extra=''):
    return page.locator(f'[data-action="{action}"]{extra}')


def fixture(parent, origin):
    for title,icon in [('Ler e contar uma história','📚'),('Desenhar um mapa','🎨'),('Tomar o remédio','💊')]:
        result=parent.request.post('/api/events',data={'title':title,'icon':icon,'time':'09:00',
            'duration':20,'start_date':WEEK,'recurrence':'daily'},headers=headers(parent,origin))
        assert result.status==201,result.text()


def admin_flow(parent, origin):
    page=parent.new_page()
    page.add_init_script("localStorage.setItem('davi-forest-mode','2d')")
    page.goto(origin)
    wait_ready(page,'2d','forest')
    page.locator('#parentTab').click()
    button(page,'campaign-admin').click()
    page.get_by_role('heading',name='Aventura e pausas').wait_for()
    assert page.locator('[name="eligible-3"]').is_disabled()
    for idx,value in enumerate((1,2,3)):
        page.locator('#campaignPolicy [name=target]').nth(idx).fill(str(value))
    page.locator('[name="eligible-1"]').select_option('learning')
    page.locator('[name="eligible-2"]').select_option('project')
    page.locator('#campaignPolicy [type=submit]').click()
    page.locator('#content[aria-busy=true]').wait_for(state='hidden')
    screenshot(page,'metas-responsavel')
    page.locator('#screenPolicy [name=session]').fill('1')
    page.locator('#screenPolicy [name=daily]').fill('2')
    page.locator('#screenPolicy [name=pause]').fill('1')
    page.locator('#screenPolicy [name=opens]').fill('06:00')
    page.locator('#screenPolicy [name=closes]').fill('21:00')
    screenshot(page,'limites-responsavel')
    page.locator('#screenPolicy [type=submit]').click()
    page.locator('#content[aria-busy=true]').wait_for(state='hidden')
    button(page,'campaign-week').click()
    page.get_by_role('heading',name='Quadro semanal fora da tela').wait_for()
    assert page.locator('.campaign-day').count()==7
    assert page.locator('.campaign-mark').count()==14
    assert page.get_by_text('Tomar o remédio',exact=True).count()==0
    page.emulate_media(media='print')
    assert button(page,'campaign-print').is_hidden()
    assert page.locator('.campaign-mark').first.is_visible()
    screenshot(page,'quadro-semanal-impressao',full_page=True)
    page.emulate_media(media='screen')
    button(page,'campaign-approve',f'[data-id="1"][data-date="{WEEK}"]').click()
    page.locator('.campaign-task').get_by_text('Aprovada',exact=True).wait_for()
    screenshot(page,'aprovacao-fora-da-tela')
    assert parent.request.get(ORIGIN_PATH+'/admin').json()['count']==1
    return page


def picker(page):
    page.locator('#content[aria-busy=true]').wait_for(state='hidden')
    button(page,'world-picker').click()
    dialog=page.locator('.world-picker[open]')
    dialog.wait_for()
    return dialog


def show_portal(page):
    button(page,'forest-paths').click()
    page.locator('#forestDialog [data-action=forest-travel][data-id=campaign-next]').click()
    page.locator('#forestInteract[data-place=campaign-next]').click(timeout=35000)
    page.get_by_role('heading',name='Portal dos capítulos',exact=True).wait_for()
    screenshot(page,'portal-da-floresta')
    button(page,'forest-close').click()


def portal_3d(browser, origin, parent):
    child=paired(browser,origin,parent,viewport={'width':1366,'height':820},device_scale_factor=.75)
    page=child.new_page()
    page.goto('/')
    wait_ready(page,'3d','forest')
    button(page,'forest-paths').click()
    page.locator('#forestDialog [data-action=forest-travel][data-id=campaign-next]').click()
    page.locator('#forestInteract[data-place=campaign-next]').wait_for(timeout=25000)
    screenshot(page,'portal-na-floresta-3d')
    child.close()


def run_child(page):
    page.goto('/')
    wait_ready(page,'2d','forest')
    features=snapshot(page)['features']
    assert any(f['id']=='campaign-next' for f in features)
    dialog=picker(page)
    assert dialog.locator('[data-world=praia]').is_disabled()
    screenshot(page,'capitulos-bloqueados')
    dialog.get_by_role('button',name='Fechar ×').click()
    show_portal(page)
    button(page,'forest-paths').click()
    page.locator('#forestDialog [data-action=forest-travel][data-id=leaf]').click()
    page.locator('#forestInteract[data-place=leaf]').wait_for(timeout=55000)
    page.keyboard.press('e')
    page.locator('#content[aria-busy=true]').wait_for(state='hidden')
    chapters=page.request.get('/api/adventure').json()['chapters']
    assert chapters[0]['discovered'] and chapters[1]['unlocked']
    state=snapshot(page)
    assert state['navigationValid'] and state['pipoNavigationValid']
    dialog=picker(page)
    beach=dialog.locator('[data-world=praia]')
    assert beach.is_enabled() and dialog.locator('[data-world=dinossauros]').is_disabled()
    beach.click()
    wait_ready(page,'2d','praia')
    assert any(f['id']=='campaign-next' for f in snapshot(page)['features'])
    dialog=picker(page)
    assert dialog.locator('[data-world=praia][aria-current=true]').is_enabled()
    screenshot(page,'praia-desbloqueada')
    dialog.get_by_role('button',name='Fechar ×').click()
    screenshot(page,'praia-jogavel')


def clock_flow(browser, origin, parent, child_context, page, clock, server):
    phone=paired(browser,origin,parent,viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
    phone.add_init_script("localStorage.setItem('davi-forest-mode','2d')")
    mobile=phone.new_page()
    mobile.goto('/')
    mobile.get_by_text('A aventura está aberta em outra aba ou aparelho.',exact=False).wait_for()
    mobile.get_by_role('button',name='Ver agenda').tap()
    mobile.locator('#dailyAgenda').wait_for()
    screenshot(mobile,'agenda-em-outro-aparelho')
    phone.close()

    tab=page.evaluate("DaviCampaign.headers()['X-Davi-Play']")
    authenticated=headers(child_context,origin)
    request=child_context.request
    for _ in range(5):
        current=request.post(ORIGIN_PATH+'/play',data={'tab':tab,'action':'start'},headers=authenticated)
        assert current.json()['allowed'],current.json()
        clock.return_value+=dt.timedelta(seconds=10)
    current=request.post(ORIGIN_PATH+'/play',data={'tab':tab,'action':'start'},headers=authenticated)
    assert current.json()['remaining']==10,current.json()
    page.get_by_role('status').get_by_text('Daqui a pouco',exact=False).wait_for()
    screenshot(page,'aviso-de-pausa')
    page.locator('#worldMap').focus()
    before=snapshot(page)['position']
    page.keyboard.down('ArrowRight')
    page.wait_for_timeout(440)
    page.keyboard.up('ArrowRight')
    last=snapshot(page)['position']
    assert abs(last[0]-before[0])>.1
    clock.return_value+=dt.timedelta(seconds=11)
    page.get_by_role('heading',name='Sua aventura fica guardada').wait_for(timeout=15000)
    assert 'Hora de uma pausa' in page.locator('.campaign-pause').inner_text()
    screenshot(page,'fim-da-sessao')
    button(page,'child-now-calendar').click()
    page.locator('#dailyAgenda').wait_for()
    with server.db() as c:
        import forest
        checkpoint=forest.read_json_setting(c,'world_position_praia')
        assert abs(checkpoint['x']-last[0])<.15, (checkpoint,last)


def validation_flow(page, parent):
    button(page,'campaign-admin').click()
    button(page,'campaign-validation','[data-enabled=true]').click()
    page.get_by_role('button',name='Explorar em validação').click()
    wait_ready(page,'2d')
    dialog=picker(page)
    city=dialog.locator('[data-world=inventores]')
    assert city.is_enabled()
    city.click()
    wait_ready(page,'2d','inventores')
    page.locator('#worldMap').focus()
    page.keyboard.down('ArrowRight')
    page.wait_for_timeout(470)
    page.keyboard.up('ArrowRight')
    screenshot(page,'validacao-responsavel')
    assert parent.request.get('/api/worlds').json()['selected']=='praia'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium',required=True)
    parser.add_argument('--video',action='store_true')
    parser.add_argument('--portal-3d',action='store_true')
    args=parser.parse_args()
    EVIDENCE.mkdir(exist_ok=True)
    SCRATCH.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir=SCRATCH,prefix='stage11-') as directory:
        scratch=Path(directory)
        os.environ['DAVI_DATA_DIR']=str(scratch/'synthetic')
        import schedule_window
        import server
        from lan_security import Config
        now=dt.datetime(2026,11,17,8,15,tzinfo=schedule_window.TZ)
        with patch.object(schedule_window,'now',return_value=now) as clock, server.DaviHTTPServer(('127.0.0.1',0),server.Handler) as http:
            server.initialize()
            server.set_setting('password',server.hash_password(PASSWORD))
            server.CONFIG=Config({'DAVI_PORT':str(http.server_port)})
            origin=f'http://127.0.0.1:{http.server_port}'
            thread=threading.Thread(target=http.serve_forever,daemon=True)
            thread.start()
            try:
                with sync_playwright() as running:
                    options=['--use-angle=swiftshader','--enable-unsafe-swiftshader'] if args.portal_3d else ['--disable-gpu']
                    browser=running.chromium.launch(executable_path=args.chromium,args=options)
                    parent=browser.new_context(base_url=origin,viewport={'width':1366,'height':900})
                    assert parent.request.post('/api/login',data={'password':PASSWORD},headers={'Origin':origin}).ok
                    fixture(parent,origin)
                    if args.portal_3d:
                        portal_3d(browser,origin,parent)
                        browser.close()
                        return
                    parent_page=admin_flow(parent,origin)
                    print('Painel, aprovação e impressão validados.',flush=True)
                    recording={'record_video_dir':scratch,'record_video_size':{'width':854,'height':512}} if args.video else {}
                    child=paired(browser,origin,parent,viewport={'width':1366,'height':820},**recording)
                    child.add_init_script("localStorage.setItem('davi-forest-mode','2d')")
                    page=child.new_page()
                    errors=[]
                    page.on('pageerror',lambda error:errors.append(str(error)))
                    run_child(page)
                    print('Portal, descoberta do besouro e desbloqueio da Praia validados.',flush=True)
                    clock_flow(browser,origin,parent,child,page,clock,server)
                    assert not errors,errors
                    video=page.video
                    page.close()
                    if video:
                        subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-threads','2','-i',video.path(),'-vf',
                                        'fps=24','-c:v','libx264','-threads','2','-crf','26','-pix_fmt','yuv420p',
                                        '-movflags','+faststart',str(EVIDENCE/'descoberta-e-pausa.mp4')],check=True)
                    child.close()
                    validation_flow(parent_page,parent)
                    browser.close()
                print('Aprovação, impressão, descoberta, pausa, agenda e validação passaram.',flush=True)
            finally:
                http.shutdown()
                thread.join()


if __name__=='__main__':
    main()
