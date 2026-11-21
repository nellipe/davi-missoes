"""Capture the full reset in a browser using only a disposable SQLite database."""
import argparse
import datetime as dt
import os
from pathlib import Path
import sys
import tempfile
import threading
from unittest.mock import patch

from playwright.sync_api import sync_playwright
from record_worlds import ROOT, SCRATCH, PASSWORD
from record_stage10 import paired, snapshot, wait_ready

sys.path.insert(0,str(ROOT/'tests'))
EVIDENCE=ROOT/'docs/evidencias-etapa11-1'


def capture(locator,name):
    locator.screenshot(path=EVIDENCE/f'{name}.jpg',type='jpeg',quality=90,scale='css')


def child_page(ctx,origin,mode,world):
    page=ctx.new_page()
    if mode=='2d':
        page.add_init_script("""if(!localStorage.getItem('davi-forest-mode'))
            localStorage.setItem('davi-forest-mode','2d')""")
    page.goto(origin)
    wait_ready(page,mode,world)
    return page


def capture_reset(browser,origin,parent,server,facts,before):
    child=paired(browser,origin,parent,viewport={'width':1366,'height':820})
    playing=child_page(child,origin,'2d','inventores')
    playing.locator('#forestBalance').get_by_text('10000',exact=True).wait_for()
    capture(playing.locator('.trail-shell'),'antes-cidade-e-saldo')
    playing.evaluate("""() => {
        localStorage.setItem('davi-forest-place','trail');
        localStorage.setItem('davi-forest-puzzle-sound','on');
    }""")

    page=child_page(parent,origin,'2d','inventores')
    page.locator('#parentTab').click()
    page.locator('[data-action=campaign-admin]').click()
    panel=page.locator('.panel').filter(has=page.get_by_role('heading',name='Recomeçar',exact=True))
    panel.get_by_role('button',name='Reiniciar somente campanha',exact=True).wait_for()
    capture(panel,'duas-opcoes')
    new_game=panel.get_by_role('button',name='Começar aventura do zero',exact=True)
    new_game.click()
    dialog=page.locator('.new-game-dialog[open]')
    keyboard=dialog.get_by_role('textbox')
    submit=dialog.get_by_role('button',name='Confirmar nova partida')
    assert submit.is_disabled()
    keyboard.fill('RECOMECAR')
    assert submit.is_disabled()
    dialog.get_by_role('button',name='Cancelar').click()
    assert parent.request.get('/api/me').json()['game_generation']==1
    new_game.click()
    keyboard.fill('RECOMEÇAR')
    assert submit.is_enabled()
    capture(dialog,'confirmacao-digitada')
    submit.click()
    page.locator('#status').get_by_text('Nova partida iniciada.',exact=False).wait_for()
    assert parent.request.get('/api/me').json()['parent']

    wait_ready(playing,'2d','forest')
    davi=snapshot(playing)
    assert davi['position'][0]==0 and davi['position'][2]==7.5,davi['position']
    assert davi['navigationValid'] and davi['pipoNavigationValid']
    assert playing.locator('#forestBalance strong').inner_text()=='0'
    assert playing.evaluate("localStorage.getItem('davi-forest-puzzle-sound')")=='on'
    assert playing.evaluate("localStorage.getItem('davi-forest-motion-mode')")=='reduced'
    assert playing.evaluate("localStorage.getItem('davi-forest-place')") is None
    capture(playing.locator('.trail-shell'),'depois-floresta-2d')
    playing.locator('[data-action=world-picker]').click()
    picker=playing.locator('.world-picker[open]')
    picker.wait_for()
    assert picker.locator('.world-choice[disabled]').count()==3
    capture(picker,'capitulos-bloqueados')
    picker.get_by_role('button',name='Fechar ×').click()
    playing.locator('[data-action=forest-calendar]').click()
    playing.locator('#dailyAgenda').wait_for()
    assert playing.locator('#dailyAgenda').get_by_text('Pintar um mapa').count()>0
    capture(playing.locator('#dailyAgenda'),'agenda-preservada')
    with server.db() as c:
        assert facts(c)==before
    child.close()


def reopen_3d(browser,origin,parent):
    other=paired(browser,origin,parent,viewport={'width':1366,'height':820},device_scale_factor=.75)
    page=child_page(other,origin,'3d','forest')
    position=snapshot(page)['position']
    assert (position[0],position[2])==(0,7.5)
    assert page.locator('#forestBalance strong').inner_text()=='0'
    assert not snapshot(page)['pipoScarfVisible']
    capture(page.locator('.trail-shell'),'depois-floresta-3d')
    other.close()


def main():
    cli=argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--chromium',required=True)
    options=cli.parse_args()
    EVIDENCE.mkdir(exist_ok=True)
    SCRATCH.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='game-reset-',dir=SCRATCH) as scratch:
        os.environ['DAVI_DATA_DIR']=str(Path(scratch)/'synthetic')
        import schedule_window
        import server
        from lan_security import Config
        from test_game_reset import seed,facts
        instant=dt.datetime(2026,11,17,8,15,tzinfo=schedule_window.TZ)
        with patch.object(schedule_window,'now',return_value=instant), server.DaviHTTPServer(('127.0.0.1',0),server.Handler) as web:
            server.initialize()
            server.set_setting('password',server.hash_password(PASSWORD))
            with server.db() as c:
                seed(c,instant,limits=False)
                before=facts(c)
            server.CONFIG=Config({'DAVI_PORT':str(web.server_port)})
            origin=f'http://127.0.0.1:{web.server_port}'
            thread=threading.Thread(target=web.serve_forever,daemon=True)
            thread.start()
            try:
                with sync_playwright() as pw:
                    with pw.chromium.launch(executable_path=options.chromium,args=['--disable-gpu']) as browser:
                        parent=browser.new_context(base_url=origin,viewport={'width':1366,'height':820})
                        assert parent.request.post('/api/login',data={'password':PASSWORD},headers={'Origin':origin}).ok
                        cookies=parent.storage_state()
                        capture_reset(browser,origin,parent,server,facts,before)
                    print('Confirmação pelo painel, sincronização em outra sessão e agenda verificadas.',flush=True)
                    server.initialize()
                    with server.db() as c:
                        assert facts(c)==before
                    with pw.chromium.launch(executable_path=options.chromium,
                            args=['--use-angle=swiftshader','--enable-unsafe-swiftshader']) as browser:
                        parent=browser.new_context(base_url=origin,storage_state=cookies)
                        reopen_3d(browser,origin,parent)
                    print('Nova sessão, processo inicializado novamente e ponto inicial em 3D verificados.',flush=True)
            finally:
                web.shutdown()
                thread.join()


if __name__=='__main__':
    main()
