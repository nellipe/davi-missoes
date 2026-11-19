"""Record browser-driven microadventures with a disposable SQLite database."""
import argparse
import os
from pathlib import Path
import subprocess
import tempfile
import threading

from playwright.sync_api import sync_playwright
from record_worlds import ROOT, SCRATCH, BROWSERS, VIDEO_SIZES, activate, challenge_control, perform_challenge

OUTPUT = ROOT / 'docs/evidencias-etapa9-2'
PASSWORD = 'Synthetic-worlds-92'
SCREEN = {'praia':'desktop', 'dinossauros':'mobile', 'inventores':'mobile'}
FINALE = {'praia':'chest-song','dinossauros':'skeleton','inventores':'machine'}


class Session:
    def __init__(self,browser,origin,key,scratch,parent,parent_headers):
        self.key=key
        self.endpoint='/api/worlds/'+key
        self.touch=SCREEN[key]=='mobile'
        screen=SCREEN[key]
        self.context=browser.new_context(base_url=origin,viewport=BROWSERS[screen],
            record_video_dir=scratch,record_video_size=VIDEO_SIZES[screen],is_mobile=self.touch,has_touch=self.touch,
            device_scale_factor=1 if self.touch else .75)
        self.client=self.context.request
        code=parent.request.post('/api/devices/code', data={}, headers=parent_headers).json()['code']
        self.send('/api/pair','POST',{'code':code}, {'Origin':origin})
        self.headers={'Origin':origin,'X-CSRF-Token':self.client.get('/api/me').json()['csrf']}
        self.send('/api/worlds/selection','PUT',{'world':key})
        self.places={p['id']:p for p in self.snapshot()['layout']['places']}
        self.page=self.context.new_page()
        self.errors=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('console',lambda line:self.errors.append(line.text) if line.type=='error' else None)
        self.page.add_init_script("""
            localStorage.setItem('davi-forest-quality','low');
            window.__notes=[];
            const original=AudioContext.prototype.createOscillator;
            AudioContext.prototype.createOscillator=function(){
              const sound=original.call(this),play=sound.start;
              sound.start=function(...args){window.__notes.push(sound.frequency.value);return play.apply(this,args);};
              return sound;
            };
        """)

    def send(self,path,method,value,headers=None):
        response=self.client.fetch(path,method=method,data=value,headers=headers or self.headers)
        assert response.ok,(path,response.status,response.text())
        return response.json()

    def snapshot(self):
        return self.client.get(self.endpoint).json()

    def visit(self,ident,offset=0):
        place=self.places[ident]
        self.send(self.endpoint+'/move','PUT',{'x':place['x']+offset,'z':place['z']})
        self.page.goto('/')
        self.page.locator(f'.trail-shell[data-world="{self.key}"] [data-ready="true"]').wait_for(timeout=45000)
        assert self.page.evaluate('() => DaviForest.diagnostics().navigationValid')
        return self.open(ident)

    def open(self,ident):
        activate(self.page.locator(f'#forestInteract[data-place="{ident}"]'),self.touch)
        dialog=self.page.locator('#forestDialog[open]')
        dialog.get_by_role('heading',name=self.places[ident]['title'],exact=True).wait_for()
        return dialog

    def act(self,dialog,action,choice=None,key=None):
        perform_challenge(self.page,dialog,action,choice,touch=self.touch,keyboard=key)
        self.page.wait_for_timeout(180)

    def ordinary(self,dialog,action):
        activate(dialog.locator(f'[data-action="forest-{action}"]'),self.touch)
        self.page.locator('#content[aria-busy="true"]').wait_for(state='hidden')

    def revealed(self,ident,seconds=900):
        self.page.locator('#forestDialog').wait_for(state='hidden')
        self.page.locator('#forestMessage.world-discovery-message').wait_for()
        self.page.wait_for_timeout(seconds)
        assert ident in self.snapshot()['progress']

    def shot(self,name):
        self.page.screenshot(path=OUTPUT/f'{self.key}-{name}.jpg',type='jpeg',quality=89,scale='css')

    def finish(self):
        assert not self.errors,self.errors
        video=self.page.video
        self.context.close()
        subprocess.run(['ffmpeg','-v','error','-y','-threads','2','-i',str(video.path()),'-an','-vf','fps=24',
                        '-c:v','libx264','-threads','2','-preset','fast','-crf','27','-pix_fmt','yuv420p','-movflags','faststart',
                        str(OUTPUT/f'{self.key}.mp4')],check=True)


def praia(s):
    for ident,note in [('shell-rose',392),('shell-gold',523),('shell-blue',659)]:
        panel=s.visit(ident)
        assert panel.locator('.qa-staff').count()==1
        assert challenge_control(panel,'listen',ident).is_disabled()
        s.act(panel,'sound',key='Enter')
        s.act(panel,'listen',ident,key='Enter')
        assert s.page.evaluate('window.__notes')==[note]
        if ident=='shell-rose':
            s.shot('pista')
        s.act(panel,'sound',key='Enter')
        s.ordinary(panel,'collect')
        s.revealed(ident,420)
    panel=s.visit('chest-song',1.2)
    s.act(panel,'start',key='Enter')
    s.page.keyboard.press('Tab')
    assert s.page.evaluate('document.activeElement.dataset.choice')=='shell-blue'
    for ident in ('shell-blue','shell-rose','shell-gold'):
        s.act(panel,'step',ident,key='Space')
    s.act(panel,'check',key='Enter')
    assert panel.locator('.qa-response').is_visible()
    s.act(panel,'hint',key='Enter')
    s.act(panel,'undo',key='Enter')
    assert panel.locator('.qa-filled').count()==2
    s.act(panel,'reset',key='Enter')
    for ident in ('shell-rose','shell-gold','shell-blue'):
        s.act(panel,'step',ident,key='Space')
    assert s.page.evaluate('window.__notes')==[]
    s.shot('melodia')
    s.act(panel,'check',key='Enter')
    s.revealed('chest-song',1500)
    s.shot('desfecho')
    panel=s.open('chest-song')
    assert challenge_control(panel,'start').inner_text()=='Jogar de novo'
    s.act(panel,'start',key='Enter')
    assert panel.locator('.qa-filled').count()==0 and 'chest-song' in s.snapshot()['progress']


def dinossauros(s):
    for ident in ('fossil-head','fossil-ribs','fossil-tail'):
        panel=s.visit(ident)
        s.act(panel,'start')
        s.act(panel,'step',2)
        assert panel.locator('[data-clear="true"]').count()==1
        if ident=='fossil-head':
            s.shot('escavacao')
            s.page.keyboard.press('Escape')
            s.page.reload()
            panel=s.open(ident)
            s.act(panel,'start')
            assert panel.locator('[data-clear="true"]').count()==1
        s.act(panel,'step',0,key='Space' if ident=='fossil-ribs' else None)
        s.act(panel,'step',1)
        s.revealed(ident,430)
    panel=s.visit('skeleton',1.2)
    s.act(panel,'start')
    s.act(panel,'pick','head')
    s.act(panel,'fit','tail')
    assert panel.locator('.qa-response').is_visible()
    for _ in range(3):
        s.act(panel,'hint')
    assert challenge_control(panel,'fit','head').get_attribute('data-suggested')=='true'
    s.act(panel,'fit','head')
    s.act(panel,'pick','ribs')
    s.act(panel,'fit','ribs')
    s.shot('encaixes')
    s.act(panel,'pick','tail')
    s.act(panel,'fit','tail')
    s.revealed('skeleton',1600)
    s.shot('desfecho')


def inventores(s):
    panel=s.visit('pressure')
    s.act(panel,'start')
    s.act(panel,'check')
    assert panel.locator('.qa-response').is_visible()
    s.act(panel,'step',1,key='Enter')
    s.act(panel,'step',1)
    assert panel.get_by_role('meter').get_attribute('aria-valuenow')=='3'
    s.shot('valvula')
    s.act(panel,'check')
    s.revealed('pressure',580)

    panel=s.visit('coil')
    s.act(panel,'start')
    s.act(panel,'step','left')
    s.ordinary(panel,'close')
    panel=s.open('coil')
    s.act(panel,'start')
    assert panel.locator('.qa-circuit').get_attribute('data-left')=='true'
    s.act(panel,'step','right')
    assert panel.locator('.qa-circuit[data-connected="true"]').is_visible()
    s.shot('bobina')
    s.act(panel,'check')
    s.revealed('coil',700)

    panel=s.visit('commands')
    s.act(panel,'start')
    s.act(panel,'hint')
    for ident in ('power','steps','dance'):
        s.act(panel,'step',ident)
    s.shot('comandos')
    s.act(panel,'check')
    s.revealed('commands',580)
    panel=s.visit('machine',1.1)
    s.ordinary(panel,'collect')
    s.revealed('machine',1600)
    s.shot('desfecho')

    s.page.set_viewport_size({'width':360,'height':800})
    activate(s.page.locator('[data-action=forest-options]'),True)
    s.page.locator('#forestMotion').select_option('reduced')
    activate(s.page.locator('[data-action=forest-fallback]'),True)
    s.page.locator('#worldMap[data-ready=true]').wait_for()
    assert s.page.evaluate('() => DaviForest.diagnostics().motion.reduced')
    panel=s.visit('pressure')
    s.act(panel,'start')
    assert challenge_control(panel,'motion').get_attribute('aria-pressed')=='true'
    s.act(panel,'step',1)
    s.act(panel,'step',1)
    s.act(panel,'check')
    s.revealed('pressure',500)
    s.shot('repeticao-2d')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium',required=True)
    activities={'praia':praia,'dinossauros':dinossauros,'inventores':inventores}
    parser.add_argument('--world',choices=activities)
    args=parser.parse_args()
    OUTPUT.mkdir(parents=True,exist_ok=True)
    SCRATCH.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='microadventures-',dir=SCRATCH) as scratch:
        os.environ['DAVI_DATA_DIR']=str(Path(scratch)/'sqlite')
        import server
        from lan_security import Config
        server.initialize()
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
                    headers={'Origin':origin,'X-CSRF-Token':parent.request.get('/api/me').json()['csrf']}
                    for world in ([args.world] if args.world else activities):
                        s=Session(browser,origin,world,Path(scratch),parent,headers)
                        print(f'{world}: início',flush=True)
                        activities[world](s)
                        saved=s.snapshot()
                        assert len(saved['progress'])==4 and FINALE[world] in saved['progress']
                        assert saved['economy']['stars']==0 and not saved['economy']['inventory']
                        s.finish()
                        print(f'{world}: conclusão, progresso e gravação verificados',flush=True)
                    browser.close()
            finally:
                http.shutdown()
                thread.join()


if __name__=='__main__':
    main()
