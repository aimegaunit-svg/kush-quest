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
  let url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url === '/') url = '/index.html';
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
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
      const op = buf[0] & 0x0f, masked = buf[1] & 0x80;
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
      if (op === 1) { let msg; try { msg = JSON.parse(payload.toString()); } catch { continue; } handle(client, msg); }
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

function enter(client, code, name) {
  const room = rooms.get(code);
  if (room.players.size >= MAX_PLAYERS) return client.send({ t: 'err', msg: 'Room is full (4 max)' });
  const used = new Set([...room.players.values()].map(p => p.color));
  let color = 0; while (used.has(color)) color++;
  room.players.set(client.id, { name, color, client });
  room.emptySince = 0;
  if (!room.host || !room.players.has(room.host)) room.host = client.id;
  client.room = code;
  client.send({
    t: 'joined', code, id: client.id, host: room.host, color, level: room.level, phase: room.phase,
    players: [...room.players].filter(([id]) => id !== client.id).map(([id, p]) => ({ id, name: p.name, color: p.color })),
    collected: [...room.collected]
  });
  broadcast(room, { t: 'pj', id: client.id, name, color }, client.id);
  checkProgress(room);
}

function startLevel(room, n) {
  room.level = Math.max(0, Math.min(MAX_LEVEL, n | 0));
  room.phase = 'play'; room.fin.clear(); room.ready.clear(); room.collected.clear(); room.hurried = false;
  broadcast(room, { t: 'level', n: room.level });
}

// everyone at the smoke spot? everyone ready in the shop?
function checkProgress(room) {
  const total = room.players.size;
  if (!total) return;
  if (room.phase === 'play' && room.fin.size > 0 && [...room.players.keys()].every(id => room.fin.has(id))) {
    room.phase = 'shop';
    broadcast(room, { t: 'allfin' });
  } else if (room.phase === 'shop' && [...room.players.keys()].every(id => room.ready.has(id))) {
    startLevel(room, room.level + 1);
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
      rooms.set(code, { players: new Map(), collected: new Set(), level: Math.max(0, Math.min(MAX_LEVEL, m.level | 0)), phase: 'play', fin: new Set(), ready: new Set(), hurried: false, emptySince: 0 });
      enter(client, code, cleanName(m.name));
      break;
    }
    case 'join': {
      if (client.room) return;
      const code = String(m.code || '').toUpperCase().trim();
      if (!rooms.has(code)) return client.send({ t: 'err', msg: 'No room with code ' + code });
      enter(client, code, cleanName(m.name));
      break;
    }
    case 's': // player state, relayed to the rest of the room
      if (room) broadcast(room, { t: 's', id: client.id, x: +m.x || 0, y: +m.y || 0, h: +m.h || 0, a: m.a | 0, f: m.f | 0, b: m.b | 0, l: m.l | 0, w: m.w | 0, c: m.c | 0 }, client.id);
      break;
    case 'fx': // visual-only effects (attacks)
      if (room) broadcast(room, { t: 'fx', id: client.id, k: m.k | 0, x: +m.x || 0, y: +m.y || 0, h: +m.h || 0, f: m.f | 0 }, client.id);
      break;
    case 'col': { // something was collected / defeated: first one wins
      if (!room || (m.l | 0) !== room.level) return;
      const id = String(m.id).slice(0, 20);
      if (room.collected.has(id)) return;
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
      break;
    case 'timeup': // countdown ran out on a client: end the mission for everyone
      if (!room || room.phase !== 'play' || !room.hurried) return;
      room.phase = 'shop';
      broadcast(room, { t: 'allfin' });
      break;
    case 'ready':
      if (!room || room.phase !== 'shop') return;
      room.ready.add(client.id);
      broadcast(room, { t: 'ready', n: room.ready.size, of: room.players.size });
      checkProgress(room);
      break;
    // beat-em-up sync: the host runs the enemies, everyone else reports hits/thefts to it
    case 'es': if (room && client.id === room.host) broadcast(room, m, client.id); break;
    case 'eshot': case 'kill': if (room) broadcast(room, m, client.id); break;
    case 'hit': case 'steal': {
      if (!room) return;
      const h = room.players.get(room.host);
      if (h) h.client.send({ ...m, id: client.id });
      break;
    }
    case 'emote':
      if (room) broadcast(room, { t: 'emote', id: client.id, e: m.e | 0 }, client.id);
      break;
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

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  KUSH QUEST server running!');
  console.log('  Open  http://localhost:' + PORT + '  in your browser.\n');
});
