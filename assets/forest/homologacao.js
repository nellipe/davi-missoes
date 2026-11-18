/* Opt-in local diagnostics. No telemetry, network writes or personal data. */
(() => {
  const enabled = new URLSearchParams(location.search).get('homologacao');
  try {
    if (enabled === '0') sessionStorage.removeItem('forest-qa');
    if (enabled === '1') sessionStorage.setItem('forest-qa', '1');
    if (sessionStorage.getItem('forest-qa') !== '1') return;
  } catch { if (enabled !== '1') return; }
  const events = [], samples = [], loads = [];
  let lostAt = null, seenCanvas = null;
  const record = (type, message) => events.push({at: new Date().toISOString(), type, message: String(message).slice(0, 500)});
  window.addEventListener('error', e => record('error', e.message || 'Falha ao carregar recurso'), true);
  window.addEventListener('unhandledrejection', e => record('rejection', e.reason?.message || e.reason));
  for (const method of ['error', 'warn']) {
    const original = console[method].bind(console);
    console[method] = (...args) => {
      const message = args.map(String).join(' ');
      if (/WebGL|THREE|GL_INVALID|shader|Ilha 2D disponível/i.test(message)) record('webgl-' + method, message);
      original(...args);
    };
  }
  document.addEventListener('webglcontextcreationerror', e => record('webgl-creation', e.statusMessage || 'WebGL indisponível'), true);
  document.addEventListener('webglcontextlost', () => { lostAt = performance.now(); record('webgl-lost', 'Contexto perdido'); }, true);
  document.addEventListener('webglcontextrestored', () => { lostAt = null; record('webgl-restored', 'Contexto recuperado'); }, true);
  const panel = document.createElement('details');
  panel.id = 'forestQA';
  panel.style.cssText = 'position:fixed;bottom:4px;left:4px;z-index:10000;max-width:calc(100vw - 8px);width:340px;padding:6px;background:#fff;color:#182d30;border:2px solid #224c4c;border-radius:8px;font:12px system-ui;max-height:45vh;overflow:auto';
  panel.innerHTML = '<summary>TESTE SINTÉTICO · Medir desempenho</summary><p id="qaMetrics"></p><button type="button" id="qaReset">Iniciar amostra</button> <button type="button" id="qaExport">Baixar relatório</button> <button type="button" id="qa2D">Continuar em 2D</button><p>Abra durante a medição; feche para jogar. FPS mede intervalos de renderização, não consumo de bateria.</p>';
  document.body.append(panel);
  const percentile = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : null;
  function measure() {
    const active = !!document.querySelector('#forestCanvas[data-ready="true"]');
    const d = active ? window.DaviForest?.diagnostics() : null;
    const t = (d?.frameMs || []).filter(n => Number.isFinite(n) && n > 0).sort((a,b) => a-b);
    const mean = t.length ? t.reduce((a,b) => a+b, 0) / t.length : null;
    return {at: new Date().toISOString(), mode: active ? '3d' : document.querySelector('#worldMap') ? '2d' : 'missão/agenda/autorização',
      visible: !document.hidden, fps: active && !d.paused && mean ? +(1000 / mean).toFixed(1) : null,
      frameP95ms: percentile(t, .95), requestedQuality: d?.quality || null,
      effectiveQuality: active ? (d?.low ? 'econômica' : 'detalhada') : null,
      adaptiveLow: d?.adaptiveLow || false, worldReadyMs: d?.readyMs || null,
      assetLoadMs: d?.loadMs?.[0] ?? null, webgl: d?.webgl ?? null,
      renderer: d?.renderer || null, viewport: [innerWidth, innerHeight], dpr: devicePixelRatio};
  }
  function fallback() {
    if (document.querySelector('#forestCanvas')) window.DaviForest?.action('forest-fallback', {}).catch(e => record('fallback-error', e.message));
  }
  document.getElementById('qa2D').onclick = fallback;
  document.getElementById('qaReset').onclick = () => { samples.length = 0; record('sample-start', 'Nova amostra'); };
  document.getElementById('qaExport').onclick = () => {
    const navigation = performance.getEntriesByType('navigation')[0];
    const report = {synthetic: true, physicalDevice: 'PREENCHER: modelo, SO e navegador',
      userAgent: navigator.userAgent, generatedAt: new Date().toISOString(),
      documentLoadMs: navigation?.loadEventEnd || null, loads, samples, events,
      note: 'Amostras sobrepostas dos últimos 240 frames; FPS não é benchmark de GPU. Preencher avaliação física no roteiro.'};
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type:'application/json'}));
    const a = document.createElement('a'); a.href = url; a.download = 'floresta-homologacao-' + Date.now() + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  setInterval(() => {
    const s = measure();
    const c = document.querySelector('#forestCanvas[data-ready="true"]');
    if (c && c !== seenCanvas) { seenCanvas = c; loads.push(s); }
    if (!document.hidden) { samples.push(s); if (samples.length > 1800) samples.shift(); }
    document.getElementById('qaMetrics').textContent = `${s.mode} · FPS ${s.fps ?? '—'} · p95 ${s.frameP95ms?.toFixed(1) ?? '—'} ms · ${s.requestedQuality ?? '—'} → ${s.effectiveQuality ?? '—'} · abrir mundo ${s.worldReadyMs?.toFixed(0) ?? '—'} ms · WebGL ${s.webgl === null ? '—' : s.webgl ? 'OK' : 'falhou'} · falhas ${events.filter(e => /error|webgl-lost|webgl-creation|rejection/.test(e.type)).length}`;
    if (lostAt !== null && performance.now() - lostAt > 5000 && c) { lostAt = null; record('fallback', 'Contexto não recuperou em 5 s; continuando em 2D'); fallback(); }
  }, 1000);
  window.ForestQA = {measure, events, samples, loads};
})();
