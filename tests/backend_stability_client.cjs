// Test client for the synthetic HTTPS/HTTP2 reverse proxy on loopback.
const { connect } = require('node:http2');
const fs = require('node:fs');

const [port, caFile, slot, rounds, width] = process.argv.slice(2);
const origin = 'https://davi-stability.home.arpa:' + port;
const {cookie, day} = JSON.parse(fs.readFileSync(slot, 'utf8'));
const paths = ['/', '/forest.js', '/app.js', '/forest.css', '/api/build',
  '/assets/forest/chibi.mjs', '/assets/forest/sight.mjs', '/assets/forest/navigation.mjs',
  '/assets/forest/companion.mjs', '/assets/forest/trail.mjs', '/vendor/three/three.module.min.js',
  '/api/me', '/api/forest/map', '/api/world', '/api/calendar?start='+day+'&end='+day];
const ca = fs.readFileSync(caFile);
const transport = connect(origin, {ca, lookup: (_host, options, done) => options.all
  ? done(null,[{address:'127.0.0.1',family:4}]) : done(null,'127.0.0.1',4)});
const failed = [];
let requests = 0;
let protocol;
transport.on('connect', () => { protocol=transport.socket.alpnProtocol; });
transport.on('error', error => failed.push({error:error.code}));

function get(path) {
  return new Promise(resolve => {
    let status;
    const request = transport.request({':path':path, cookie});
    request.on('response', headers => { status = headers[':status']; });
    request.on('error', error => { failed.push({path:path.split('?')[0],error:error.code}); resolve(); });
    request.on('end', () => {
      requests++;
      if (status !== 200) failed.push({path:path.split('?')[0],status});
      resolve();
    });
    request.setTimeout(8000, () => request.destroy(new Error('request timeout')));
    request.resume();
    request.end();
  });
}

(async () => {
  try {
    for (let i=0;i<Number(rounds);i++)
      await Promise.all(Array.from({length:Number(width)},(_,j)=>get(paths[j%paths.length])));
    console.log(JSON.stringify({requests,failed,protocol}));
  } finally { transport.close(); }
})().catch(error => {
  console.error(error.code || error.name);
  process.exitCode=1;
  transport.destroy();
});
