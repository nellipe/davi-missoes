const MAX_SAMPLES = 900;

function sample() {
  const d = window.DaviForest?.telemetry();
  const frames = d?.paused ? [] : (d?.frameMs ?? []).filter(ms=>ms>0&&Number.isFinite(ms)).sort((a,b)=>a-b);
  const p = f => frames.length ? +frames[Math.ceil(f*frames.length)-1].toFixed(1) : null;
  const mean = frames.reduce((sum,ms)=>sum+ms,0) / frames.length;
  return {
    view:d?.view??'agenda', region:d?.region??null,
    requested:d?.quality??null, effective:d?.effective??null,
    fps:mean?+(1000/mean).toFixed(1):null, medianMs:p(.5), p95Ms:p(.95),
    openingMs:d?.readyMs??null, clearingModelsMs:d?.assetsMs??null, trailModelsMs:d?.trailMs??null,
    viewport:[innerWidth,innerHeight], dpr:d?.dpr??null,
    drawCalls:d?.calls??null, triangles:d?.triangles??null,
  };
}

export function beginDiagnostics(build) {
  const panel=document.createElement('details');
  panel.id='forestFamilyDiagnostics';
  panel.innerHTML='<summary>Diagnóstico em andamento</summary><output></output><div><button type="button">Baixar JSON</button> <button type="button">Encerrar</button></div>';
  const [download,close]=panel.querySelectorAll('button');
  const display=panel.querySelector('output');
  const samples=[], start=Date.now();
  let firstOpeningMs=null;
  document.body.append(panel);
  function measure() {
    if(document.hidden)return;
    const point={seconds:+((Date.now()-start)/1000).toFixed(2),...sample()};
    if(firstOpeningMs===null && point.view==='3d' && point.openingMs!==null)firstOpeningMs=point.openingMs;
    samples.push(point);
    if(samples.length>MAX_SAMPLES)samples.shift();
    display.textContent=`${point.view} · ${point.region||'—'} · ${point.fps??'—'} FPS · p95 ${point.p95Ms??'—'} ms · ${point.effective??'—'}`;
  }
  function stop() {
    clearInterval(timer);
    panel.remove();
  }
  download.onclick=()=>{
    measure();
    const report={
      build,
      device:{
        browser:navigator.userAgent, platform:navigator.userAgentData?.platform??navigator.platform,
        screen:[screen.width,screen.height], pixelRatio:devicePixelRatio
      },
      firstOpeningMs,
      contextEvents:(window.DaviForest?.telemetry().events??[]).filter(event=>event.at>=start)
        .map(event=>({type:event.type,seconds:+((event.at-start)/1000).toFixed(2)})),
      samples,
    };
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');
    a.href=url;
    a.download='floresta-diagnostico.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  close.onclick=stop;
  const timer=setInterval(measure,1000);
  measure();
  return stop;
}
