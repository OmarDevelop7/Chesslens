// ChessLens local server: serves the app and exposes native Stockfish via /api/*
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process'), readline = require('readline');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.css': 'text/css' };

class Engine {
  constructor(exe) {
    this.proc = spawn(exe, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
    this.waiters = []; this.name = 'Stockfish';
    this.rl = readline.createInterface({ input: this.proc.stdout });
    this.rl.on('line', l => { if (l.startsWith('id name')) this.name = l.slice(8).trim(); this.waiters.slice().forEach(w => w(l)); });
    this.proc.on('exit', () => { this.dead = true; this.waiters.slice().forEach(w => w(null)); });
    const cores = os.cpus().length || 2;
    this.threads = Math.max(1, Math.min(cores - 1, 16)); this.hash = cores >= 6 ? 512 : 256;
    this.queue = Promise.resolve();
  }
  send(s) { this.proc.stdin.write(s + '\n'); }
  until(test) {
    return new Promise((res, rej) => {
      const w = l => { if (l === null) { this.waiters = this.waiters.filter(x => x !== w); return rej(new Error('engine exited')); } if (test(l)) { this.waiters = this.waiters.filter(x => x !== w); res(); } };
      this.waiters.push(w);
    });
  }
  async init() {
    const a = this.until(l => l.startsWith('uciok')); this.send('uci'); await a;
    for (const o of [`Threads value ${this.threads}`, `Hash value ${this.hash}`, 'MultiPV value 2']) this.send('setoption name ' + o);
    const b = this.until(l => l.startsWith('readyok')); this.send('isready'); await b;
  }
  analyze(fen, depth) {
    const run = () => new Promise((res, rej) => {
      const best = {};
      const w = l => {
        if (l === null) { this.waiters = this.waiters.filter(x => x !== w); return rej(new Error('engine exited')); }
        if (l.startsWith('info') && l.includes(' pv ') && !l.includes('bound')) {
          const k = +((/multipv (\d+)/.exec(l) || [0, 1])[1]), sc = /score (cp|mate) (-?\d+)/.exec(l); if (!sc) return;
          let v = +sc[2]; if (sc[1] === 'mate') v = v > 0 ? 10000 - v : -10000 - v;
          best[k] = [v, l.split(' pv ')[1].trim().split(' ')];
        } else if (l.startsWith('bestmove')) {
          this.waiters = this.waiters.filter(x => x !== w);
          const sg = fen.split(' ')[1] === 'w' ? 1 : -1, ks = Object.keys(best).sort((a, b) => a - b);
          res(ks.length ? ks.map(k => ({ cp: best[k][0] * sg, pv: best[k][1] })) : [{ cp: 0, pv: [] }]);
        }
      };
      this.waiters.push(w); this.send('position fen ' + fen); this.send('go depth ' + depth);
    });
    const p = this.queue.then(run, run); this.queue = p.catch(() => {}); return p;
  }
  close() { try { this.send('quit'); this.proc.kill(); } catch (e) {} }
}

async function start({ root, engine, port = 0 }) {
  let eng = null;
  try { if (engine && fs.existsSync(engine)) { eng = new Engine(engine); await eng.init(); } } catch (e) { console.error('Engine failed:', e.message); eng = null; }
  const json = (res, code, o) => { const b = JSON.stringify(o); res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(b); };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/info') return eng ? json(res, 200, { name: eng.name, threads: eng.threads, hash: eng.hash }) : json(res, 503, { error: 'no engine' });
    if (u.pathname === '/api/analyze' && req.method === 'POST') {
      if (!eng) return json(res, 503, { error: 'no engine' });
      let body = ''; req.on('data', c => { body += c; if (body.length > 1e5) req.destroy(); });
      req.on('end', async () => {
        try { const j = JSON.parse(body); json(res, 200, await eng.analyze(String(j.fen), Math.max(1, Math.min(+j.depth || 18, 30)))); }
        catch (e) { json(res, 500, { error: e.message }); }
      });
      return;
    }
    let p = path.normalize(path.join(root, u.pathname === '/' ? 'index.html' : decodeURIComponent(u.pathname)));
    if (!p.startsWith(path.resolve(root))) { res.writeHead(403); return res.end(); }
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(data);
    });
  });
  await new Promise(r => server.listen(port, '127.0.0.1', r));
  return { port: server.address().port, engine: eng, close() { server.close(); if (eng) eng.close(); } };
}
module.exports = { start };

if (require.main === module) {   // standalone: node server.js [engine-path]
  const exe = process.argv[2] || process.env.ENGINE_PATH;
  start({ root: path.join(__dirname, 'app'), engine: exe, port: +process.env.PORT || 8765 })
    .then(s => console.log(`ChessLens: http://127.0.0.1:${s.port}/index.html  engine=${s.engine ? s.engine.name : 'none'}`));
}
