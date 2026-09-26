// Kush Quest - multiplayer game server
// Zero dependencies: just run `node server.js` (Node 18+).
// Serves the game from /public and relays player updates over WebSockets.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.json': 'application/json',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg'
};

// ---------- static files ----------
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (url === '/health') {
    // v1.2 fix (Step 1.7): report room/player counts, not just a bare "ok" - useful for Render's health
    // check dashboard and for eyeballing server load without SSHing in.
    let players = 0; for (const r of rooms.values()) players += r.players.size;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size, players, connections: clients.size, uptime: Math.round(process.uptime()) }));
  }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- minimal WebSocket implementation ----------
function frame(data, op = 1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = payload.length;
  let head;
  if (len < 126) { head = Buffer.alloc(2); head[1] = len; }
  else if (len < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  head[0] = 0x80 | op;
  return Buffer.concat([head, payload]);
}

let nextId = 1;
const clients = new Set();
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || !(req.url || '').startsWith('/ws')) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);

  const client = {
    id: 'p' + (nextId++), room: null, socket, seen: Date.now(),
    send(obj) { if (!socket.destroyed) socket.write(frame(JSON.stringify(obj))); }
  };

  let buf = Buffer.alloc(0);
  clients.add(client);
  socket.on('data', chunk => {
    client.seen = Date.now();
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f, masked = buf[1] & 0x80, fin = buf[0] & 0x80;
      if (!masked || !fin) { socket.end(frame(Buffer.from([0x03, 0xea]), 8)); return; } // 1002: protocol error
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (len > 65536) { socket.destroy(); return; }
      const maskOff = off; if (masked) off += 4;
      if (buf.length < off + len) return;
      let payload = Buffer.from(buf.subarray(off, off + len));
      if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= buf[maskOff + (i & 3)];
      buf = buf.subarray(off + len);
      if (op === 8) { socket.end(frame(Buffer.alloc(0), 8)); return; }
      if (op === 9) { socket.write(frame(payload, 10)); continue; }
      if (op === 1) {
        const now = Date.now(); if (now - (client.rt || 0) > 1000) { client.rt = now; client.rn = 0; }
        if (++client.rn > 120) continue; // max 120 messages/sec per player
        let msg; try { msg = JSON.parse(payload.toString()); } catch { continue; } handle(client, msg);
      }
    }
  });
  socket.on('close', () => { clients.delete(client); leave(client); });
  socket.on('error', () => { clients.delete(client); leave(client); });
});

// ---------- rooms ----------
// room: { players: Map(id -> {name,color,client}), collected:Set, level, phase:'play'|'shop', fin:Set, ready:Set, hurried, emptySince }
const rooms = new Map();
const MAX_PLAYERS = 4, MAX_ROOMS = 500, MAX_LEVEL = 99;

function makeCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s; do { s = ''; for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)]; } while (rooms.has(s));
  return s;
}
const cleanName = n => (String(n || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, 10)) || 'STONER';

function broadcast(room, obj, except) {
  for (const [id, p] of room.players) if (id !== except) p.client.send(obj);
}

function enter(client, code, name, wantColor) {
  const room = rooms.get(code);
  if (room.players.size >= MAX_PLAYERS) return client.send({ t: 'err', msg: 'Room is full (4 max)' });
  const used = new Set([...room.players.values()].map(p => p.color));
  let color = (Number.isInteger(wantColor) && wantColor >= 0 && wantColor <= 3 && !used.has(wantColor)) ? wantColor : 0;
  while (used.has(color)) color++;
  room.players.set(client.id, { name, color, client });
  room.emptySince = 0;
  if (!room.host || !room.players.has(room.host)) room.host = client.id;
  client.room = code;
  client.send({
    t: 'joined', code, id: client.id, host: room.host, color, level: room.level, phase: room.phase,
    players: [...room.players].filter(([id]) => id !== client.id).map(([id, p]) => ({ id, name: p.name, color: p.color })),
    collected: [...room.collected],
    transit: room.transit || null // v1.2 fix (Step 2.3): a ride in progress when this player (re)joins
  });
  broadcast(room, { t: 'pj', id: client.id, name, color }, client.id);
  checkProgress(room);
}

function startLevel(room, n) {
  room.level = Math.max(0, Math.min(MAX_LEVEL, n | 0));
  room.phase = 'play'; room.fin.clear(); room.ready.clear(); room.collected.clear(); room.hurried = false; clearTimeout(room.hurryTimer);
  broadcast(room, { t: 'level', n: room.level });
}

// everyone at the smoke spot? everyone ready in the shop?
function checkProgress(room) {
  const total = room.players.size;
  if (!total) return;
  if (room.phase === 'play' && room.fin.size > 0 && [...room.players.keys()].every(id => room.fin.has(id))) {
    room.phase = 'shop';
    broadcast(room, { t: 'allfin' });
  } else if ((room.phase === 'shop' || room.phase === 'lobby') && [...room.players.keys()].every(id => room.ready.has(id))) {
    room.phase = 'map'; room.ready.clear();
    broadcast(room, { t: 'map' });
  }
}

function handle(client, m) {
  if (!m || typeof m !== 'object') return;
  const room = client.room && rooms.get(client.room);
  switch (m.t) {
    case 'create': {
      if (client.room) return;
      if (rooms.size >= MAX_ROOMS) return client.send({ t: 'err', msg: 'Server is full, try again later' });
      const code = makeCode();
      rooms.set(code, { players: new Map(), collected: new Set(), level: Math.max(0, Math.min(MAX_LEVEL, m.level | 0)), phase: 'lobby', fin: new Set(), ready: new Set(), hurried: false, emptySince: 0 });
      enter(client, code, cleanName(m.name), m.color | 0);
      break;
    }
    case 'join': {
      if (client.room) return;
      const code = String(m.code || '').toUpperCase().trim();
      if (!rooms.has(code)) return client.send({ t: 'err', msg: 'No room ' + code + ' - check the code, or ask your friend for the invite link (their ESC menu)' });
      enter(client, code, cleanName(m.name), m.color | 0);
      break;
    }
    case 's': // player state, relayed to the rest of the room
      if (room) broadcast(room, { t: 's', id: client.id, x: +m.x || 0, y: +m.y || 0, h: +m.h || 0, a: m.a | 0, f: m.f | 0, b: m.b | 0, l: m.l | 0, w: m.w | 0, c: m.c | 0, hp: Math.max(0, Math.min(20, m.hp | 0)), mh: Math.max(1, Math.min(20, m.mh | 0)) }, client.id);
      break;
    case 'fx': { // visual-only effects (attacks)
      if (!room) return;
      // v1.2 fix (Step 1.7): fx-specific rate limit. Legit combat can fire these fairly often (an attack
      // per swing), so this is generous compared to chat's, but still catches a client blasting far more
      // fx than any real attack cadence could produce.
      const now = Date.now();
      if (now - (client.fxWinAt || 0) > 1000) { client.fxWinAt = now; client.fxWin = 0; }
      if (++client.fxWin > 40) return;
      broadcast(room, { t: 'fx', id: client.id, k: m.k | 0, x: +m.x || 0, y: +m.y || 0, h: +m.h || 0, f: m.f | 0 }, client.id);
      break;
    }
    case 'col': { // something was collected / defeated: first one wins
      if (!room || (m.l | 0) !== room.level) return;
      const id = String(m.id).slice(0, 20);
      if (!/^[pid][\w]{0,15}$/.test(id) || room.collected.size > 3000 || room.collected.has(id)) return;
      room.collected.add(id);
      broadcast(room, { t: 'col', id, l: room.level }, client.id);
      break;
    }
    case 'fin': // reached the smoke spot
      if (!room || room.phase !== 'play' || (m.l | 0) !== room.level) return;
      room.fin.add(client.id);
      broadcast(room, { t: 'fin', id: client.id, n: room.fin.size, of: room.players.size });
      checkProgress(room);
      break;
    case 'hurry': // someone at the spot calls the crew: 20s countdown for everyone
      if (!room || room.phase !== 'play' || room.hurried || !room.fin.has(client.id)) return;
      room.hurried = true;
      broadcast(room, { t: 'hurry', name: room.players.get(client.id).name });
      { const lvlAt = room.level; clearTimeout(room.hurryTimer); room.hurryTimer = setTimeout(() => { if (room.phase === 'play' && room.level === lvlAt) { room.phase = 'shop'; broadcast(room, { t: 'allfin' }); } }, 20500); }
      break;
    case 'timeup': break; // the server runs the countdown itself now
    case 'ready':
      if (!room || (room.phase !== 'shop' && room.phase !== 'lobby')) return;
      room.ready.add(client.id);
      broadcast(room, { t: 'ready', n: room.ready.size, of: room.players.size, who: client.id });
      checkProgress(room);
      break;
    case 'start': // host forces the lobby straight into the map, ready or not
      if (!room || room.phase !== 'lobby' || client.id !== room.host) return;
      room.phase = 'map'; room.ready.clear();
      broadcast(room, { t: 'map' });
      break;
    case 'kick': { // host removes a player from the lobby
      if (!room || room.phase !== 'lobby' || client.id !== room.host) return;
      const targetId = String(m.id || '');
      const target = room.players.get(targetId);
      if (!target || targetId === room.host) return;
      target.client.send({ t: 'kicked' });
      room.players.delete(targetId); room.ready.delete(targetId);
      target.client.room = null;
      broadcast(room, { t: 'pl', id: targetId });
      break;
    }
    // beat-em-up sync: the host runs the enemies, everyone else reports hits/thefts to it
    case 'es': // enemy snapshot from the host only
      if (room && client.id === room.host && Array.isArray(m.e) && m.e.length <= 400)
        broadcast(room, { t: 'es', l: m.l | 0, zi: m.zi | 0, lk: m.lk | 0, zc: m.zc | 0, sk: Array.isArray(m.sk) ? m.sk.slice(0, 400).map(n => n | 0) : [], e: m.e.map(a => Array.isArray(a) ? a.slice(0, 10).map(n => +n || 0) : []) }, client.id);
      break;
    case 'boss': if (room && client.id === room.host) broadcast(room, { t: 'boss', i: m.i | 0, l: m.l | 0 }, client.id); break;
    // v1.1 A5: crew-lives system. Host is authoritative on the shared life count and on level restarts
    // when it hits 0, so every client agrees on both without a full state-sync protocol.
    case 'lives': if (room && client.id === room.host) broadcast(room, { t: 'lives', n: Math.max(0, Math.min(9, m.n | 0)), l: m.l | 0 }, client.id); break;
    case 'wipe': if (room && client.id === room.host) broadcast(room, { t: 'wipe', l: m.l | 0, n: Math.max(0, Math.min(9, m.n | 0)) }, client.id); break;
    // v1.1 A6: eshot/kill widened with a few extra whitelisted fields for the new world-specific enemy tricks (thrown sand/pinecone kind + arc height, HQ robot-mouse explosion)
    case 'eshot': if (room && client.id === room.host) broadcast(room, { t: 'eshot', x: +m.x || 0, z: +m.z || 0, vx: Math.max(-4, Math.min(4, +m.vx || 0)), l: m.l | 0, k: String(m.k || '').slice(0, 12), h: Math.max(0, Math.min(60, +m.h || 0)), vh: Math.max(-6, Math.min(6, +m.vh || 0)) }, client.id); break;
    case 'kill': if (room && client.id === room.host) broadcast(room, { t: 'kill', i: m.i | 0, by: String(m.by).slice(0, 12), st: m.st | 0, l: m.l | 0, ex: m.ex ? 1 : 0, exx: Math.round(+m.exx || 0), exz: Math.round(+m.exz || 0) }, client.id); break;
    // v1.1 A6: WOODS essential-oil diffuser cloud + SUBURBIA mousetraps - both host-authoritative, not tied to a player id
    case 'cloud': if (room && client.id === room.host) broadcast(room, { t: 'cloud', x: +m.x || 0, z: +m.z || 0, l: m.l | 0 }, client.id); break;
    case 'trap': if (room && client.id === room.host) broadcast(room, { t: 'trap', i: m.i | 0, l: m.l | 0, who: String(m.who || '').slice(0, 12) }, client.id); break;
    case 'hit': case 'steal': case 'rev': case 'pass': {
      if (!room) return;
      const out = { t: m.t, id: client.id, i: m.i | 0, l: m.l | 0, d: Math.max(0, Math.min(12, m.d | 0)), dir: Math.sign(+m.dir || 0), s: m.s ? 1 : 0, k: Math.max(0, Math.min(20, m.k | 0)), who: String(m.who || '').slice(0, 12),
        b: Math.max(0, Math.min(8, m.b | 0)), sp: m.sp ? 1 : 0, st: Math.max(0, Math.min(150, m.st | 0)), bl: Math.max(0, Math.min(8, m.bl | 0)), kb: Math.max(0, Math.min(5, +m.kb || 1)), hr: m.hr ? 1 : 0 };
      if (m.t === 'rev' || m.t === 'pass') broadcast(room, out, client.id);
      else { const h = room.players.get(room.host); if (h && room.host !== client.id) h.client.send(out); }
      break;
    }
    case 'pick': // the host picks a level on the world map
      if (!room || room.phase !== 'map' || client.id !== room.host) return;
      startLevel(room, m.n);
      break;
    case 'mapsel': // host's cursor on the world map, so the crew can watch
      if (room && client.id === room.host) broadcast(room, { t: 'mapsel', i: m.i | 0, w: m.w | 0 }, client.id);
      break;
    // v1.2 fix (Step 2.3): host-only. Tracked on the room so a player who (re)joins mid-ride sees it in
    // their `joined` payload (below) and waits instead of dropping into the map underneath the crew.
    case 'transit-start':
      if (!room || client.id !== room.host) return;
      room.transit = { k: String(m.k || '').slice(0, 8), from: m.from | 0, to: m.to | 0, w: m.w | 0 };
      broadcast(room, { t: 'transit-start', k: room.transit.k, from: room.transit.from, to: room.transit.to, w: room.transit.w }, client.id);
      break;
    case 'transit-end':
      if (!room || client.id !== room.host) return;
      room.transit = null;
      broadcast(room, { t: 'transit-end' }, client.id);
      break;
    case 'chat': {
      if (!room) return;
      // v1.2 fix (Step 1.7): dedicated chat rate limit (separate from the blanket 120msg/sec socket-level
      // limit above, which is generous enough that a spam client could still flood the room with chat alone).
      const now = Date.now();
      if (now - (client.chatAt || 0) < 800) return;
      client.chatAt = now;
      const msg = String(m.msg || '').replace(/[^\x20-\x7E]/g, '').trim().slice(0, 60);
      if (msg) broadcast(room, { t: 'chat', id: client.id, msg }, client.id);
      break;
    }
    case 'emote':
      if (room) broadcast(room, { t: 'emote', id: client.id, e: m.e | 0 }, client.id);
      break;
    case 'd': { // transit mini-game relay (Hotbox Highway + the 5 brief-v1.1 transit games): {t:'d', k, p, to?}
      if (!room) return;
      const out = { t: 'd', k: String(m.k || '').slice(0, 24), p: m.p, id: client.id };
      if (m.to) { const target = room.players.get(String(m.to)); if (target) target.client.send(out); }
      else broadcast(room, out, client.id);
      break;
    }
  }
}

function leave(client) {
  if (!client.room) return;
  const room = rooms.get(client.room);
  client.room = null;
  if (!room) return;
  room.players.delete(client.id); room.fin.delete(client.id); room.ready.delete(client.id);
  broadcast(room, { t: 'pl', id: client.id });
  if (room.host === client.id && room.players.size) { room.host = room.players.keys().next().value; broadcast(room, { t: 'host', id: room.host }); }
  // v1.2 fix (Step 2.3): if the host bails mid-ride, nobody will ever send transit-end - clear it so a
  // future joiner doesn't get stuck waiting forever, and free any live waiters immediately.
  if (room.transit) { room.transit = null; broadcast(room, { t: 'transit-end' }); }
  if (room.players.size === 0) room.emptySince = Date.now(); // kept 2 min so people can reconnect
  else checkProgress(room);
}

// keep connections alive through hosting proxies + clean up
setInterval(() => {
  const now = Date.now();
  for (const c of clients) {
    if (now - c.seen > 75000) { c.socket.destroy(); continue; }
    if (!c.socket.destroyed) c.socket.write(frame(Buffer.alloc(0), 9)); // ping; browsers answer with pong
  }
  for (const [code, r] of rooms) if (r.players.size === 0 && r.emptySince && now - r.emptySince > 120000) rooms.delete(code);
}, 25000);

// v1.2 fix (Step 1.7): keep the process alive on an unexpected error instead of letting one bad
// message/client take the whole server (and every room on it) down. Just logs and carries on.
process.on('uncaughtException', err => { console.error('[uncaughtException]', err && err.stack || err); });
process.on('unhandledRejection', err => { console.error('[unhandledRejection]', err && err.stack || err); });

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  KUSH QUEST server running!');
  console.log('  Open  http://localhost:' + PORT + '  in your browser.\n');
});
