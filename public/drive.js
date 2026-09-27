// drive.js — HOTBOX HIGHWAY (brief v1.0 Part 1; one per world after the mini-boss per brief v1.1 B2).
// A co-op pseudo-3D driving mini-game (OutRun-style segment road). Self-contained renderer, physics,
// audio and HUD; shares only the save object, the room connection and the transit.js contract.
//
// Contract (same as the other transit games):
//   Drive.start({ from, to, world, cooked, crew, save, net, onDone, mount, scale, spectate }) -> { cleanup() }
//     world: 'park'|'beach'|'suburb'|'city'|'woods'|'hq'  (theme, night drives, world-only swap events)
//     crew: int or [{id,name,color}] in join order. net: the game's live Net object ({id, hostId, send}) or null.
//     spectate: true for a player who drops in mid-drive (follows the driver's view, no seat).
//     onDone({ coins, cooked, snacksLeft, munchies, buff, score, awards, heatCaught, route })
//   Drive.needsDrive(save, fromIdx, toIdx, isShopOrFarm) -> 'drive' | 'ask' | 'none'
//   Incoming relay: route every {t:'d', k:'dr'} message to Drive._deliver(m.id, m.p)
//     (or just hand any room message to Drive.onNet(m) - it also understands 'pl' and 'host').
//
// Online model: the current DRIVER's game runs the sim and sends snapshots 10x/s. Havoc seats send inputs.
// The road comes from a shared seed. Seat swap = full-state handoff to the new driver. If the driver goes
// silent for 2.5s (or 'pl' says they left) the room host's game takes over the wheel.
// Wire payloads (all under k:'dr'): {k:'vote'|'start'|'in'|'st'|'swap'|'end'|'take', ...}
'use strict';
(() => {
const W = 320, H = 192;

// ---------------- canvas (overlays the main game canvas) ----------------
let cv, ctx, tv, tctx, mountEl, maxScale = 99;
function makeCanvas(mount, scale) {
  mountEl = mount || document.body;
  maxScale = scale || 99;
  cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.tabIndex = 0;
  cv.style.cssText = 'display:block;image-rendering:pixelated;image-rendering:crisp-edges;background:#000;outline:none;touch-action:none';
  ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  tv = document.createElement('canvas');
  tv.style.cssText = 'position:fixed;pointer-events:none;z-index:9999';
  tctx = tv.getContext('2d');
  mountEl.appendChild(cv); document.body.appendChild(tv);
  fit(); addEventListener('resize', fit);
  try { cv.focus(); } catch (e) {}
}
function fit() {
  if (!cv) return;
  const s = Math.min(innerWidth / W, innerHeight / H, mountEl === document.body ? 99 : 99);
  cv.style.width = Math.round(W * s) + 'px'; cv.style.height = Math.round(H * s) + 'px';
}
function destroyCanvas() {
  removeEventListener('resize', fit);
  cv && cv.remove(); tv && tv.remove(); cv = tv = null;
}

// ---------------- text (same approach as game.js: VT323 overlay, outlined) ----------------
const TQ = [];
function text(str, x, y, col = '#fff', sc = 1, align = 'left') {
  str = String(str).toUpperCase();
  const w = str.length * 4 * sc - sc;
  if (align === 'center') x -= Math.floor(w / 2); else if (align === 'right') x -= w;
  TQ.push({ str, x, y, w, sc, col, a: ctx.globalAlpha });
}
function flushText() {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const pw = Math.round(r.width * dpr), ph = Math.round(r.height * dpr);
  if (tv.width !== pw || tv.height !== ph) { tv.width = pw; tv.height = ph; }
  tv.style.left = r.left + 'px'; tv.style.top = r.top + 'px'; tv.style.width = r.width + 'px'; tv.style.height = r.height + 'px';
  const k = pw / W;
  tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, pw, ph); tctx.lineJoin = 'round';
  for (const q of TQ) {
    const fs = 8.4 * q.sc * k;
    tctx.font = fs + 'px VT323, "Courier New", monospace';
    const mw = tctx.measureText(q.str).width || 1, sx = Math.min(1.25, (q.w + q.sc) * k / mw);
    tctx.save(); tctx.globalAlpha = q.a; tctx.translate(q.x * k, (q.y + 5.6 * q.sc) * k); tctx.scale(sx, 1);
    tctx.lineWidth = Math.max(2, 0.9 * q.sc * k); tctx.strokeStyle = '#1a1026'; tctx.strokeText(q.str, 0, 0);
    tctx.fillStyle = q.col; tctx.fillText(q.str, 0, 0); tctx.restore();
  }
  TQ.length = 0;
}

// ---------------- audio (same tiny synth style) ----------------
let AC = null, master = null, noiseBuf = null, engine = null, musicT = 0, musicStep = 0;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.3, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(freq, dur, type = 'square', vol = 0.06, when = 0, slide = 0) {
  if (!AC) return;
  const t = AC.currentTime + when, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, when = 0, freq = 6000) {
  if (!AC) return;
  const t = AC.currentTime + when;
  const s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
  s.buffer = noiseBuf; s.loop = true; f.type = 'highpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur);
}
function engineStart() {
  if (!AC || engine) return;
  const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.value = 40; f.type = 'lowpass'; f.frequency.value = 400; g.gain.value = 0.025;
  o.connect(f).connect(g).connect(master); o.start(); engine = { o, g, f };
}
function engineSet(sp) { if (engine) { engine.o.frequency.value = 38 + sp * 70; engine.f.frequency.value = 300 + sp * 500; } }
function engineStop() { if (engine) { try { engine.o.stop(); } catch (e) {} engine = null; } }
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const SFX = {
  coin: () => { tone(988, 0.05, 'square', 0.04); tone(1319, 0.12, 'square', 0.04, 0.05); },
  crash: () => { noise(0.4, 0.2, 0, 300); tone(90, 0.3, 'sawtooth', 0.08, 0, 0.5); },
  splat: () => { noise(0.12, 0.12, 0, 1500); tone(200, 0.1, 'triangle', 0.08, 0, 0.5); },
  throw: () => tone(500, 0.08, 'triangle', 0.05, 0, 1.8),
  cough: () => { [0, 0.18, 0.34].forEach(w => noise(0.12, 0.15, w, 800)); },
  horn: () => { tone(415, 0.35, 'square', 0.05); tone(523, 0.35, 'square', 0.04); },
  siren: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, 0.18, 'square', 0.025, i * 0.18); },
  backfire: () => { noise(0.15, 0.35, 0, 100); tone(60, 0.2, 'square', 0.12, 0, 0.3); },
  pickup: () => [523, 659, 784].forEach((f, i) => tone(f, 0.08, 'square', 0.04, i * 0.05)),
  caught: () => [440, 370, 311, 220].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.05, i * 0.15)),
  banner: () => [262, 330, 392, 523, 392, 523].forEach((f, i) => tone(f, 0.1, 'square', 0.05, i * 0.07)),
  sel: () => tone(660, 0.06, 'square', 0.04),
};
// music: van = upbeat loop, shitbox = its one song, ultra = filtered trippy (triangle, detuned)
const SONGS = {
  van: { bpm: 150, bass: [45, 45, 52, 45, 48, 48, 43, 43], lead: [69, 0, 72, 74, 76, 0, 74, 72, 69, 0, 67, 69, 72, 0, 0, 0] },
  shitbox: { bpm: 132, bass: [40, 40, 47, 47, 45, 45, 43, 42], lead: [64, 64, 67, 0, 69, 67, 64, 0, 62, 62, 64, 0, 59, 0, 0, 0] },
};
function musicTick(dt, key, ultra) {
  if (!AC) return;
  const s = SONGS[key]; musicT -= dt;
  if (musicT > 0) return;
  musicT += 60 / s.bpm / 2;
  const i = musicStep++;
  const typ = ultra ? 'triangle' : 'square';
  if (i % 2 === 0) tone(midi(s.bass[(i / 2 | 0) % s.bass.length]), 0.18, 'triangle', 0.05);
  const n = s.lead[i % s.lead.length];
  if (n) { tone(midi(n), 0.14, typ, 0.025); if (ultra) tone(midi(n) * 1.01, 0.3, 'sine', 0.02); }
}

// ---------------- input ----------------
const keys = {}, pressed = {};
let mouse = { x: 0, y: 0, click: false };
function kd(e) {
  e.stopPropagation(); // the drive owns the keyboard while it runs (keeps e.g. the results SPACE from reaching the map)
  const k = e.key.toLowerCase(); if (!keys[k]) pressed[k] = true; keys[k] = true;
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ', 'tab'].includes(k)) e.preventDefault();
  initAudio();
}
function ku(e) { keys[e.key.toLowerCase()] = false; }
function md(e) {
  initAudio();
  const r = cv.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) / r.width * W; mouse.y = (e.clientY - r.top) / r.height * H; mouse.click = true;
}
function ts(e) {
  e.preventDefault(); initAudio();
  const r = cv.getBoundingClientRect();
  for (const t of e.changedTouches) {
    const x = (t.clientX - r.left) / r.width * W, y = (t.clientY - r.top) / r.height * H;
    mouse.x = x; mouse.y = y;
    const driving = S && S.mode === 'drive' && mySeat() === 0;
    if (driving && x < W / 3) { keys.a = true; }
    else if (driving && x > W * 2 / 3) { keys.d = true; }
    else { mouse.click = true; if (driving) keys.w = true; }
  }
}
function te(e) { e.preventDefault(); if (!e.touches.length) { keys.a = keys.d = keys.w = false; } }
function mm(e) { if (!cv) return; const r = cv.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width * W; mouse.y = (e.clientY - r.top) / r.height * H; }
const hit = k => { const v = pressed[k]; pressed[k] = false; return v; };
const any = (...ks) => ks.some(k => keys[k]);
const anyHit = (...ks) => ks.map(hit).some(Boolean);

// ---------------- themes ----------------
const THEMES = {
  park:     { sky: ['#6ec6ff', '#bfe9ff'], grass: ['#3fae5a', '#36994e'], rumble: ['#fff', '#d33'], road: ['#666', '#626262'], lane: '#fff', hill: '#2d7a3e', props: ['tree', 'bush', 'sign'] },
  woods:    { sky: ['#ff9a5a', '#ffd08a'], grass: ['#2a6b33', '#245c2c'], rumble: ['#eee', '#654'], road: ['#5a5a5a', '#555'], lane: '#ffd23f', hill: '#1c4a24', props: ['pine', 'pine', 'sign'] },
  city: { sky: ['#150a2a', '#3a1a5a'], grass: ['#333', '#2c2c2c'], rumble: ['#ffd23f', '#222'], road: ['#3a3a44', '#35353e'], lane: '#ffd23f', hill: '#20102e', props: ['lamp', 'bldg', 'sign'] },
  hq:       { sky: ['#0a0a14', '#2a0a1a'], grass: ['#2a2a2a', '#222'], rumble: ['#f33', '#222'], road: ['#303038', '#2b2b33'], lane: '#f55', hill: '#1a0a14', props: ['lamp', 'fence', 'sign'] },
};
THEMES.beach = { sky: ['#5ac8ff', '#bff0ff'], grass: ['#e8d38a', '#dcc47a'], rumble: ['#fff', '#2a9adf'], road: ['#666', '#606060'], lane: '#fff', hill: '#3a8ad0', props: ['palm', 'palm', 'sign'] };
THEMES.suburb = { sky: ['#8ab8ff', '#d8e8ff'], grass: ['#6ab04c', '#5f9f44'], rumble: ['#fff', '#888'], road: ['#5a5a62', '#55555c'], lane: '#fff', hill: '#4a7a3a', props: ['house', 'bush', 'sign'] };
THEMES.downtown = THEMES.city;
const SIGNS = ['TACO BONG', 'CIRCLE HAY', "DUNKIN' DOOBIES", 'BUZZKILL CORP: COMING SOON', 'SPEED LIMIT 42.0', 'MUNCHIE MART', 'BLAZE-N-GLAZE DONUTS', 'KEEP IT MELLOW'];

// ---------------- swap events ----------------
// solo: scrambles controls ~3s. tags restrict where they fire.
const EVENTS = [
  ['THE MOOSE', { world: 'woods' }], ['THE SPEED BUMP'], ['THE POTHOLE'], ['THE TRAIN CROSSING', { world: 'city' }],
  ['THE GOOSE ATTACK', { world: 'park' }], ['THE RUNAWAY SHOPPING CART'], ['THE ICE PATCH', { night: true }],
  ['THE DROPPED JOINT'], ['THE COUGHING FIT'], ['HOTBOX WHITEOUT'], ['THE PARANOIA'], ['"DUDE, WATCH THIS"'], ['THE ZONE-OUT'], ['THE WRONG SNACK'],
  ['THE MUNCHIE EMERGENCY'], ['THE PIZZA BOX'], ['THE SODA EXPLOSION'],
  ['THE BEE'], ['THE SPIDER'], ['THE PHONE CALL'], ['THE UFO'], ['THE STALL'], ['THE LOST LIGHTER'],
  ['THE DOOR FALLS OFF', { car: 'shitbox' }], ['THE SEAT BELT SNAPS', { car: 'shitbox' }], ['THE BACKFIRE BLAST', { car: 'shitbox' }],
  ['THE CHECK ENGINE LIGHT', { car: 'shitbox' }], ['THE SUNROOF', { car: 'shitbox' }],
];
const EVENT_FX = { // visual flavour key: shake | smoke | spin | splat | flash | feathers
  'THE POTHOLE': 'shake', 'THE SPEED BUMP': 'shake', 'THE RUNAWAY SHOPPING CART': 'shake', 'THE MOOSE': 'shake', 'THE TRAIN CROSSING': 'flash',
  'THE ICE PATCH': 'spin', 'HOTBOX WHITEOUT': 'smoke', 'THE COUGHING FIT': 'smoke', 'THE PIZZA BOX': 'splat', 'THE SODA EXPLOSION': 'splat',
  'THE UFO': 'flash', 'THE GOOSE ATTACK': 'feathers', 'THE BACKFIRE BLAST': 'flash', 'THE CHECK ENGINE LIGHT': 'flash',
};
function drawEvent(save, world, night, car) {
  const ok = e => { const t = e[1] || {}; return (!t.world || t.world === world) && (!t.night || night) && (!t.car || t.car === car); };
  save.driveDeck = Array.isArray(save.driveDeck) ? save.driveDeck : [];
  let idx = save.driveDeck.findIndex(n => ok(EVENTS.find(e => e[0] === n) || ['?', { world: 'none' }]));
  if (idx < 0) { // reshuffle the whole pool (no repeats until used up)
    const names = EVENTS.map(e => e[0]);
    for (let i = names.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [names[i], names[j]] = [names[j], names[i]]; }
    save.driveDeck = names;
    idx = save.driveDeck.findIndex(n => ok(EVENTS.find(e => e[0] === n)));
  }
  return save.driveDeck.splice(idx, 1)[0];
}

// ---------------- seeded rng (road is identical on every client from one seed) ----------------
let rng = Math.random;
function seeded(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------- road building ----------------
const SEG = 200, RUMBLE = 3, DRAW = 140, ROADW = 2000, CAMH = 1000, FOV = 100;
const CAMD = 1 / Math.tan(FOV / 2 * Math.PI / 180);
const MAXSP = SEG / (1 / 60);
let S; // drive state

function buildRoad(len) {
  const segs = [];
  let y = 0;
  const add = (n, curve, hill) => {
    const y0 = y;
    for (let i = 0; i < n; i++) {
      const t = i / n, e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const ny = y0 + hill * e;
      segs.push({ i: segs.length, curve: curve * Math.sin(t * Math.PI), y1: segs.length ? segs[segs.length - 1].y2 : 0, y2: ny, props: [], items: [] });
      y = ny;
    }
  };
  add(40, 0, 0);
  while (segs.length < len) {
    const n = 30 + (rng() * 60 | 0);
    const c = rng() < 0.3 ? 0 : (rng() * 6 - 3);
    const h = rng() < 0.4 ? 0 : (rng() * 3000 - 1500);
    add(n, c, h);
  }
  add(40, 0, -y);
  return segs;
}

// ---------------- seats ----------------
// seat index: 0 driver, 1 right window, 2 rear window, 3 left window
const SEAT_NAMES = ['DRIVER', 'RIGHT WINDOW', 'REAR WINDOW', 'LEFT WINDOW'];
const SEAT_SHORT = ['DRV', 'RGT', 'REAR', 'LFT'];
const driveCount = {}; // session: how many times each id has driven (brief 1.5)
function layoutSeats(ids) {
  const s = [null, null, null, null];
  const order = ids.length === 2 ? [0, 1] : ids.length === 3 ? [0, 1, 3] : [0, 1, 2, 3];
  ids.forEach((id, i) => { s[order[i]] = id; });
  return s;
}
function rotateSeats(seats) { // driver->right->rear->left->driver, skipping empty
  const occ = [0, 1, 2, 3].filter(i => seats[i] != null);
  const ids = occ.map(i => seats[i]);
  const out = [null, null, null, null];
  occ.forEach((si, k) => { out[occ[(k + 1) % occ.length]] = ids[k]; });
  return out;
}
function pickDriver(crew, hostId) {
  const firstEver = !Object.keys(driveCount).length;
  if (firstEver) return hostId;
  let best = crew[0].id;
  for (const p of crew) if ((driveCount[p.id] || 0) < (driveCount[best] || 0)) best = p.id;
  return best;
}
const nameOf = id => { const p = S.crew.find(c => c.id === id); if (p) { (S.names = S.names || {})[id] = p.name; return p.name; } return (S.names && S.names[id]) || '?'; };
const mySeat = () => S.seats ? S.seats.indexOf(S.me) : 0;

// ---------------- net ----------------
// every drive payload rides the transit relay as {t:'d', k:'dr', p:{k:<kind>, ...}, to?}
function nsend(k, p, to) {
  if (!S || !S.net) return;
  const o = { t: 'd', k: 'dr', p: Object.assign({ k }, p) };
  if (to != null) o.to = to;
  try { S.net.send(o); } catch (e) {}
}
function onNet(m) {
  if (!S || !m) return;
  if (m.t === 'pl') return playerLeft(m.id);
  if (m.t === 'host') return; // S.net is the game's live Net object, so hostId is already current
  if (m.t === 'd' && m.k === 'dr') deliver(m.id, m.p);
}
function deliver(from, p) {
  if (!S || !p) return;
  S.heard[from] = S.t;
  switch (p.k) {
    case 'vote': if (S.mode === 'pick') S.votes[from] = p.car === 'shitbox' ? 'shitbox' : 'van'; break;
    case 'start': if (S.mode === 'pick' || S.mode === 'card' || S.mode === 'wait') applyStart(p); break;
    case 'in': if (S.auth) S.inq.push(Object.assign({ id: from }, p)); break;
    case 'st':
      if (S.mode === 'wait' && p.hdr) { applyStart(p.hdr); setupDrive(); S.auth = false; S.spectating = true; }
      if (!S.auth && S.mode === 'drive') { S.lastSt = S.t; S.stFrom = from; applyState(p); }
      break;
    case 'swap': if (S.mode === 'drive') applySwap(p); break;
    case 'take': if (S.mode === 'drive') { S.seats = p.seats; S.auth = S.seats[0] === S.me; S.lastSt = S.t; banner('DRIVER BAILED!', 'NEW DRIVER: ' + nameOf(S.seats[0]), '#ff6b6b', 2); } break;
    case 'end': if (S.mode === 'drive') { S.res = p.res; endDrive(false, p.res); } break;
  }
}
const isNetHost = () => !S.net || S.net.hostId === S.me;
function playerLeft(id) {
  const i = S.crew.findIndex(c => c.id === id);
  if (i < 0) return;
  S.crew.splice(i, 1);
  if (S.mode === 'pick') { delete S.votes[id]; return; }
  if (!S.seats) return;
  if (S.seats[0] === id) { S.lastSt = -99; return; } // driver gone: the host's takeover check handles it
  S.seats = S.seats.map(x => x === id ? null : x);
  S.solo = S.crew.length === 1;
}
// room host takes over when the driver goes quiet (disconnect / tab closed / crashed)
function takeoverCheck() {
  if (S.auth || S.mode !== 'drive' || !S.net || S.spectating && !S.seats.includes(S.me)) return;
  if (S.t - (S.lastSt || 0) < 2.5 || !isNetHost()) return;
  const gone = S.seats[0];
  S.crew = S.crew.filter(c => c.id !== gone);
  const ids = [S.me, ...S.seats.filter(x => x != null && x !== gone && x !== S.me)];
  S.seats = layoutSeats(ids); S.solo = S.crew.length <= 1;
  S.auth = true; S.inq = []; S.tgt = null;
  if (!S.drivers[1] && S.swapped) S.drivers[1] = S.me;
  nsend('take', { seats: S.seats });
  banner('DRIVER BAILED!', 'NEW DRIVER: ' + nameOf(S.me), '#ff6b6b', 2);
}

// ---------------- start ----------------
function start(opts) {
  opts = opts || {};
  if (S) stop();
  const save = opts.save || {};
  const net = opts.net && opts.net.id != null && typeof opts.net.send === 'function' ? opts.net : null;
  let crew = opts.crew;
  if (!Array.isArray(crew) || !crew.length) crew = [{ id: net ? net.id : 'me', name: 'YOU' }];
  crew = crew.slice(0, 4).map((c, i) => ({ id: c && c.id != null ? c.id : 'p' + i, name: String((c && c.name) || 'P' + (i + 1)).toUpperCase().slice(0, 10), color: c && c.color }));
  const online = !!net && (crew.length > 1 || opts.spectate);
  if (!online) crew = [crew.find(c => net && c.id === net.id) || crew[0]];
  S = {
    opts, save, net: online ? net : null, me: online ? net.id : crew[0].id, world: opts.world || 'park', night: !!opts.night || ['city', 'downtown', 'hq'].includes(opts.world),
    crew, cooked0: Math.max(0, Math.min(100, +opts.cooked || 0)),
    mode: 'pick', car: opts.vehicle || save.lastRide || 'van', pickSel: (opts.vehicle || save.lastRide) === 'shitbox' ? 1 : 0,
    votes: {}, voteT: 5, voted: false, t: 0, shake: 0, heard: {},
  };
  S.solo = crew.length === 1;
  if (opts.spectate && online) S.mode = 'wait';
  else {
    if (opts.vehicle && !online) { S.mode = 'card'; soloSeats(); }
    if (opts.vehicle && !online && !save.testDrive && !opts.noTestDrive) beginPractice(); // ride already chosen -> straight to the test drive
    if (opts.vehicle && online && isNetHost()) hostStart(opts.vehicle);
  }
  makeCanvas(opts.mount, opts.scale);
  addEventListener('keydown', kd, true); addEventListener('keyup', ku); cv.addEventListener('mousedown', md); addEventListener('mousemove', mm);
  cv.addEventListener('touchstart', ts, { passive: false }); cv.addEventListener('touchend', te, { passive: false });
  last = performance.now(); raf = requestAnimationFrame(loop);
  const handle = { cleanup: () => { if (S && S.handle === handle) stop(); }, _deliver: deliver };
  S.handle = handle;
  return handle;
}
// GARAGE (Step 9.4): the car's upgrades + cosmetics. Online the HOST's garage is used for everyone (sent in
// 'start'), so every client sees the same car and a mid-drive handoff keeps the same handling.
//   save.vanUp = { tires: 0-2, engine: 0-2, stash: 0-2 }   (affects both cars)
//   save.vanPaint = 'tiedye' | 'flames' | 'leaf' | null      (van only)
//   save.shitboxDeco = { dice: bool, fresh: bool }           (Taylor's Shitbox: fuzzy dice, new air freshener)
function garageOf(save) {
  const u = (save && save.vanUp) || {}, lv = v => Math.max(0, Math.min(2, v | 0));
  const d = (save && save.shitboxDeco) || {};
  const paint = save && ['tiedye', 'flames', 'leaf'].includes(save.vanPaint) ? save.vanPaint : null;
  return { up: { tires: lv(u.tires), engine: lv(u.engine), stash: lv(u.stash) }, paint, deco: { dice: !!d.dice, fresh: !!d.fresh } };
}
function beginPractice() { S.afterPractice = 'card'; soloSeats(); S.practice = true; setupDrive(); }
function soloSeats() { S.seats = [S.me, null, null, null]; S.seed = (Math.random() * 1e9) | 0; }
function hostStart(forceCar) {
  let car = forceCar;
  if (!car) {
    const v = Object.values(S.votes), sb = v.filter(x => x === 'shitbox').length, vn = v.filter(x => x === 'van').length;
    car = sb > vn ? 'shitbox' : 'van'; // no votes or a tie -> van
  }
  const drv = pickDriver(S.crew, S.net.hostId);
  const ids = [drv, ...S.crew.map(c => c.id).filter(id => id !== drv)];
  const p = { car, seats: layoutSeats(ids), seed: (Math.random() * 1e9) | 0, crew: S.crew, look: garageOf(S.save) };
  nsend('start', p); applyStart(p);
}
function applyStart(p) {
  S.car = p.car; S.seats = p.seats; S.seed = p.seed; if (p.look) S.look = p.look;
  if (p.crew) { S.names = S.names || {}; for (const c of p.crew) S.names[c.id] = c.name; }
  if (p.crew) S.crew = p.crew;
  S.mode = 'card'; S.cardT = 4;
}

function setupDrive() {
  rng = seeded(S.seed || 1);
  if (!S.look) S.look = garageOf(S.save);
  const up = S.look.up;
  const shit = S.car === 'shitbox';
  const len = S.practice ? 700 : S.solo ? 1400 : 1900;
  // GAS MONEY: every real drive costs coins up front (paid from the save, so a bad drive is a net loss).
  // A clean run earns it back and a bit more; a messy one doesn't.
  if (!S.practice && S.gas == null) {
    const tier = Math.max(0, ['park', 'beach', 'suburb', 'city', 'downtown', 'woods', 'hq'].indexOf(S.world));
    const cost = 12 + tier * 3, have = Math.max(0, Math.floor(+S.save.coins || 0));
    S.gas = Math.min(cost, have); S.gasCost = cost;
    if (S.gas > 0) { S.save.coins = have - S.gas; try { if (typeof S.save.__persist === 'function') S.save.__persist(); } catch (e) {} }
  }
  S.segs = buildRoad(len);
  S.trackLen = S.segs.length * SEG;
  S.forkAt = Math.floor(S.segs.length * 0.25);
  S.swapAt = Math.floor(S.segs.length * (0.4 + rng() * 0.2));
  S.theme = THEMES[S.world] || THEMES.park;
  for (const sg of S.segs) {
    if (sg.i % 4 === 2) sg.props.push({ k: 'post', x: rng() < 0.5 ? -1.22 : 1.22 });
    if (sg.i % 3 === 1) sg.props.push({ k: ['tuft', 'tuft', 'flower', 'rock'][rng() * 4 | 0], x: (rng() < 0.5 ? -1 : 1) * (1.5 + rng() * 2) });
    if (sg.i % 97 === 50) sg.props.push({ k: 'mile', x: 1.35, n: 42 - Math.floor(sg.i / 97) });
    if (sg.i % 8 === 0) sg.props.push({ k: S.theme.props[rng() * S.theme.props.length | 0], x: (rng() < 0.5 ? -1 : 1) * (1.4 + rng() * 1.2), sign: SIGNS[rng() * SIGNS.length | 0] });
    if (!S.practice && sg.i > 60 && sg.i < S.segs.length - 60) {
      if (sg.i % 120 === 0) { const lx = rng() * 1.4 - 0.7; for (let j = 0; j < 4; j++) S.segs[sg.i + j * 3].items.push({ k: 'coin', x: lx }); }
      else if (sg.i % 173 === 0) sg.items.push({ k: 'snacks', x: rng() * 1.4 - 0.7 });
      else if (sg.i % 211 === 0) sg.items.push({ k: rng() < 0.5 ? 'incense' : 'fresh', x: rng() * 1.4 - 0.7 });
      else if (sg.i % 257 === 0) sg.items.push({ k: 'nug', x: rng() * 1.4 - 0.7 });
    }
  }
  if (!S.practice) S.segs[S.forkAt - 30].props.push({ k: 'fork', x: -1.6 }, { k: 'fork', x: 1.6, right: true });
  rng = Math.random;
  const pc = {}; for (const c of S.crew) pc[c.id] = S.cooked0;
  Object.assign(S, {
    mode: 'drive', auth: S.seats[0] === S.me, pos: 0, x: 0, speed: 0, dist: 0, maxSp: MAXSP * (shit ? 1.12 : 1) * (1 + 0.06 * (up.engine || 0)),
    accel: MAXSP / (shit ? 4 : 5), grip: shit ? 1.25 : 1, tireLv: up.tires || 0,
    snacks: 20 + 12 * (S.crew.length - 1) + 10 * (up.stash || 0), coins: 0, heat: 0, lockT: 0, caught: 0, crashes: [0, 0], shaken: [0, 0], dists: [0, 0],
    cops: [], traffic: [], shots: [], fx: [], route: null, swapped: false, scramble: 0, freeze: 0, banner: null,
    hitCd: 0, throwCd: 0, drift: 0, sway: 0, blur: 0, siren: 0, damage: shit ? 3 : 0, sirensSlow: 0, backfireT: 5 + Math.random() * 8,
    nextCop: 4, nextTraffic: 2, nextBlock: 25, nextHaz: 6, lost: 0, lastSteer: 0, pc, stats: {}, got: [], extra: [], allGot: [], allExtra: [], out: [], inq: [], stT: 0, lastSt: S.t,
    drivers: [S.seats[0], null],
  });
  driveCount[S.seats[0]] = (driveCount[S.seats[0]] || 0) + 1;
  if (S.auth && !S.practice) for (let i = 0; i < 6; i++) spawnTraffic(400 + i * 60);
  S.pstep = 0; S.pT = 0;
  engineStart(); musicStep = 0; musicT = 0;
  if (S.car === 'shitbox' && !S.save.shitboxSeen) { S.save.shitboxSeen = true; banner("TAYLOR'S SHITBOX:", 'IT RUNS. MOSTLY.', '#ffd23f', 2.5); }
}
function stat(id) { return S.stats[id] || (S.stats[id] = { thr: 0, hitc: 0, hits: 0, grabs: 0, taps: 0 }); }
// banner + sound helpers: run locally and, on the authority, get forwarded to the crew in the next snapshot
function banner(txt, sub, col, t = 1.5, soft) {
  if (soft && S.banner) return;
  S.banner = { txt, sub, col, t };
  if (S.auth && S.net) S.out.push(['b', txt, sub || '', col, t]);
}
function sfx(k) { SFX[k] && SFX[k](); if (S.auth && S.net) S.out.push(['s', k]); }

function spawnTraffic(segAhead) {
  const z = (S.pos + segAhead * SEG) % S.trackLen;
  S.traffic.push({ z, x: [-0.6, 0, 0.6][Math.random() * 3 | 0], sp: MAXSP * (0.3 + Math.random() * 0.25), col: ['#3a7bd5', '#e0e0e0', '#c94', '#6a4', '#a4a'][Math.random() * 5 | 0] });
}
function spawnCop() {
  const later = (S.save.drivesDone || 0) >= 3;
  const r = Math.random();
  const type = later && r < 0.2 ? 'suv' : r < 0.55 ? 'moto' : 'cruiser';
  const hp = { cruiser: 2, moto: 1, suv: 5 }[type];
  S.cops.push({ type, hp, rel: -900 - Math.random() * 500, x: Math.random() < 0.5 ? -0.5 : 0.5, side: 0, stage: 'tail', t: 0, blind: 0, wob: Math.random() * 6 });
  sfx('siren');
}
function addItem(seg, k, x) { S.segs[seg % S.segs.length].items.push({ k, x }); if (S.auth) { S.extra.push([seg, k, x]); S.allExtra.push([seg, k, x]); } }
function takeItem(seg, idx) { const it = S.segs[seg].items[idx]; if (!it || it.got) return false; it.got = true; S.got.push([seg, idx]); S.allGot.push([seg, idx]); return true; }

// ---------------- helpers ----------------
const segAt = z => S.segs[Math.floor(z / SEG) % S.segs.length];
function avgCooked() { const v = Object.values(S.pc || {}); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : S.cooked0; }
function bakedLevel() { const c = avgCooked(); return c >= 99.5 ? 3 : c >= 90 ? 2 : c >= 40 ? 1 : 0; }
const coinMul = () => [1, 1, 1.5, 2][bakedLevel()];
const BAKED = ['SOBER-ISH', 'BAKED', 'COOKED', 'ASTRAL HIGHWAY'];
function addHeat(n) { S.heat = Math.max(0, Math.min(100, S.heat + n)); }
function half() { return S.swapped ? 1 : 0; }
function puff(x, y, n, col = '#ddd', vy = -10) { for (let i = 0; i < n; i++) S.fx.push({ x: x + Math.random() * 10 - 5, y: y + Math.random() * 6, vx: Math.random() * 20 - 10, vy: vy - Math.random() * 10, t: 0.8 + Math.random() * 0.6, col, r: 2 + Math.random() * 3 }); }
// which cop a throw from this seat goes at. aim: -1 left, 1 right, 0 rear (mirror), null = seat default
function pickTarget(seat, aim) {
  const n = S.crew.length;
  let dir = aim;
  if (dir == null) dir = seat === 1 ? 1 : seat === 3 ? -1 : 0;
  const pool = S.cops.filter(c => {
    if (S.solo || (n === 2 && seat === 1)) return true; // solo / lone window covers everything
    if (dir === 0) return c.stage === 'tail';
    return c.stage !== 'tail' && c.side === dir;
  });
  let best = null;
  for (const c of pool) if (!best || Math.abs(c.rel) < Math.abs(best.rel)) best = c;
  return best;
}

// ---------------- main loop ----------------
let raf = 0, last = 0;
function loop(now) {
  if (!S) return;
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  S.t += dt;
  if (S.mode === 'pick') updatePick(dt);
  else if (S.mode === 'card') {
    if (S.net) { S.cardT -= dt; if (S.cardT <= 0) setupDrive(); }
    else if (anyHit(' ', 'enter', 'j') || mouse.click) setupDrive();
  }
  else if (S.mode === 'drive') { if (S.auth) updateDrive(dt); else updateRemote(dt); }
  else if (S.mode === 'wait') { /* drop-in: waiting for the driver's next snapshot header */ }
  else if (S.mode === 'results') { if (S.t - S.resT > 1 && (anyHit(' ', 'enter', 'j') || mouse.click)) finish(); }
  mouse.click = false;
  for (const k in pressed) pressed[k] = false;
  if (!S) return;
  draw();
  raf = requestAnimationFrame(loop);
}
function updatePick(dt) {
  const prev = S.pickSel;
  if (anyHit('a', 'arrowleft')) S.pickSel = 0;
  if (anyHit('d', 'arrowright')) S.pickSel = 1;
  let go = anyHit(' ', 'enter', 'j');
  if (mouse.click) { S.pickSel = mouse.x < W / 2 ? 0 : 1; go = true; }
  if (prev !== S.pickSel) SFX.sel();
  const car = S.pickSel ? 'shitbox' : 'van';
  if (!S.net) {
    if (go) { S.car = car; S.save.lastRide = car; soloSeats(); S.mode = 'card'; SFX.pickup(); if (!S.save.testDrive && !S.opts.noTestDrive) beginPractice(); }
    return;
  }
  // online: everyone votes, 5 second timer, host tallies (no votes / tie -> van)
  if (go && !S.voted) { S.voted = true; S.votes[S.me] = car; S.save.lastRide = car; nsend('vote', { car }); SFX.pickup(); }
  S.voteT -= dt;
  if (isNetHost() && (S.voteT <= 0 || Object.keys(S.votes).length >= S.crew.length)) hostStart();
}

// ---------------- non-authority: send inputs, follow snapshots ----------------
function localInputs(send) {
  const seat = mySeat();
  if (hit('h')) send({ a: 'hit' });
  if (seat > 0) {
    let aim = null;
    if (mouse.click) {
      const mx = W / 2 - 32, inMirror = mouse.x > mx && mouse.x < mx + 64 && mouse.y < 26;
      aim = inMirror ? 0 : mouse.x < W / 2 ? -1 : 1;
      if (S.crew.length >= 3 && aim !== 0) aim = seat === 1 ? 1 : seat === 3 ? -1 : 0; // windows throw out their own side
    }
    if (hit('j') || mouse.click) send({ a: 'throw', aim });
    if (hit('k')) send({ a: 'grab' });
    if (anyHit('a', 'd', 'arrowleft', 'arrowright')) send({ a: 'tap' }); // backseat driving
  }
}
function updateRemote(dt) {
  takeoverCheck();
  if (S.auth) return;
  if (hit('escape')) S.paused = !S.paused;
  if (mySeat() >= 0) localInputs(p => nsend('in', p, S.seats[0]));
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
  if (S.freeze > 0) S.freeze -= dt;
  musicTick(dt, S.car, bakedLevel() === 3);
  // dead-reckon between snapshots
  const sd = S.freeze > 0 ? 0.1 : 1;
  S.pos += S.speed * dt * sd;
  if (S.tgt) {
    const d = S.tgt.p - S.pos;
    if (Math.abs(d) > SEG * 6) S.pos = S.tgt.p; else S.pos += d * Math.min(1, dt * 4);
    S.x += (S.tgt.x - S.x) * Math.min(1, dt * 10);
    S.lastSteer += (S.tgt.ls - S.lastSteer) * Math.min(1, dt * 10);
  }
  for (const c of S.traffic) { c.z += c.sp * dt * sd; c.rel = c.z - S.pos; }
  for (const c of S.cops) { c.t += dt; c.wob += dt; }
  const lvl = bakedLevel();
  S.sway = [0, 3, 7, 10][lvl];
  for (const s of S.shots) s.t += dt; S.shots = S.shots.filter(s => s.t < 0.5);
  commonFx(dt);
  engineSet(S.speed / S.maxSp);
}
function applyState(p) {
  S.tgt = p;
  S.speed = p.v; S.heat = p.h; S.lockT = p.l; S.coins = p.c; S.snacks = p.s; S.pc = p.pc; S.damage = p.dm; S.sirensSlow = p.ss;
  S.caught = p.cg; S.route = p.r; S.trackLen = p.tl; S.siren = p.si;
  S.cops = p.cops.map(a => ({ type: a[0], hp: a[1], rel: a[2], x: a[3], side: a[4], stage: a[5], t: a[6], blind: a[7], wob: 0 }));
  S.traffic = p.tr.map(a => ({ z: a[0], x: a[1], sp: a[2], col: a[3] }));
  S.seenEx = S.seenEx || {};
  for (const e of p.ex) { const key = e.join(','); if (S.seenEx[key]) continue; S.seenEx[key] = 1; S.segs[e[0] % S.segs.length].items.push({ k: e[1], x: e[2] }); }
  for (const g of p.g) { const it = S.segs[g[0]] && S.segs[g[0]].items[g[1]]; if (it) it.got = true; }
  for (const ev of p.o) {
    if (ev[0] === 'b') S.banner = { txt: ev[1], sub: ev[2], col: ev[3], t: ev[4] };
    else if (ev[0] === 's') SFX[ev[1]] && SFX[ev[1]]();
    else if (ev[0] === 'shot') S.shots.push({ t: 0, x0: W / 2, y0: 150, side: ev[1] });
    else if (ev[0] === 'puff') puff(W / 2 + 34, 150, 14, '#cfcfcf');
    else if (ev[0] === 'pop') S.fx.push({ x: W / 2, y: 130, vx: 0, vy: -30, t: 1, col: ev[2], txt: ev[1] });
  }
}
function snapshot() {
  return {
    p: S.pos, x: S.x, ls: S.lastSteer, v: S.speed, h: S.heat, l: S.lockT, c: S.coins, s: S.snacks, pc: S.pc, dm: S.damage, ss: S.sirensSlow,
    cg: S.caught, r: S.route, tl: S.trackLen, si: S.siren,
    cops: S.cops.map(c => [c.type, c.hp, Math.round(c.rel), +c.x.toFixed(2), c.side, c.stage, +c.t.toFixed(2), +c.blind.toFixed(2)]),
    tr: S.traffic.map(c => [Math.round(c.z), c.x, Math.round(c.sp), c.col]),
    ex: S.hdrT % 10 === 0 ? S.allExtra.slice() : S.extra.splice(0), g: S.hdrT % 10 === 0 ? S.allGot.slice() : S.got.splice(0), o: S.out.splice(0),
    hdr: (S.hdrT = (S.hdrT || 0) + 1) % 10 === 1 ? { car: S.car, seats: S.seats, seed: S.seed, crew: S.crew, look: S.look } : undefined,
  };
}
// full state for the seat-swap handoff (brief 1.6): the new driver's game takes over from exactly this
const FULL_KEYS = ['allExtra', 'allGot', 'pos', 'x', 'speed', 'heat', 'lockT', 'coins', 'snacks', 'pc', 'damage', 'sirensSlow', 'caught', 'route', 'trackLen', 'crashes', 'shaken', 'dists', 'stats', 'nextCop', 'nextTraffic', 'nextBlock', 'swapped', 'event', 'drivers', 'secret', 'lockCd'];
function fullState() {
  const f = {}; for (const k of FULL_KEYS) f[k] = S[k];
  f.cops = S.cops; f.traffic = S.traffic;
  return JSON.parse(JSON.stringify(f));
}
function loadFull(f) { for (const k of FULL_KEYS) if (f[k] !== undefined) S[k] = f[k]; S.cops = f.cops || []; S.traffic = f.traffic || []; }

// ---------------- swap event (brief 1.9) ----------------
function triggerSwap() {
  const name = drawEvent(S.save, S.world, S.night, S.car);
  if (S.solo) { S.swapped = true; S.event = name; eventFx(name); S.scramble = 3; banner(name, 'CONTROLS SCRAMBLED!', '#ffd23f', 3); return; }
  const seats = rotateSeats(S.seats);
  S.swapped = true; S.event = name;
  const p = { ev: name, seats, full: fullState() };
  nsend('swap', p); applySwap(p);
}
function applySwap(p) {
  S.swapped = true; S.event = p.ev; S.seats = p.seats;
  driveCount[p.seats[0]] = (driveCount[p.seats[0]] || 0) + 1;
  eventFx(p.ev);
  const mine = p.seats[0] === S.me;
  S.banner = { txt: p.ev, sub: 'NEW DRIVER: ' + nameOf(p.seats[0]), col: '#ffd23f', t: 3 };
  if (mine) { loadFull(p.full); S.youDrive = 2.5; }
  S.swapped = true; S.drivers = [S.drivers[0], p.seats[0]];
  S.auth = mine; S.inq = []; S.out = []; S.tgt = null; S.lastSt = S.t; // fresh silence timer for the new driver
}
function eventSound(name) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  const base = 200 + (Math.abs(h) % 12) * 40, types = ['square', 'sawtooth', 'triangle'];
  for (let i = 0; i < 5; i++) tone(base * [1, 1.25, 1.5, 1.2, 2][(i + Math.abs(h >> 3)) % 5], 0.12, types[(Math.abs(h) >> i) % 3], 0.05, i * 0.09, (h >> i) & 1 ? 1.6 : 0.7);
  if (/SIREN|PARANOIA/.test(name)) SFX.siren();
  if (/BACKFIRE|STALL|POTHOLE|BUMP/.test(name)) noise(0.3, 0.2, 0.1, 200);
}
function eventFx(name) {
  eventSound(name);
  S.eventFx = EVENT_FX[name] || 'shake';
  S.freeze = 1; SFX.banner();
  if (S.eventFx === 'shake') S.shake = 6;
  if (S.eventFx === 'smoke') S.blur = 2.5;
  if (S.eventFx === 'flash') S.flash = 0.6;
  if (S.eventFx === 'splat') S.splat = 3;
  if (S.eventFx === 'feathers') for (let i = 0; i < 40; i++) S.fx.push({ x: Math.random() * W, y: Math.random() * 60, vx: Math.random() * 40 - 20, vy: 20 + Math.random() * 20, t: 2.5, col: '#fff', r: 2 });
  if (S.eventFx === 'spin') S.spin = 1.2;
  if (name === 'THE BACKFIRE BLAST') { SFX.backfire(); for (const c of S.cops) c.rel -= 400; }
}
function commonFx(dt) {
  if (S.flash > 0) S.flash -= dt;
  if (S.splat > 0) S.splat -= dt;
  if (S.spectating && !S.seats.includes(S.me)) text('SPECTATING - YOU JOIN AT THE NEXT LEVEL', W / 2, H - 22, '#9f8fc0', 1, 'center');
  if (S.youDrive > 0) S.youDrive -= dt;
  for (const p of S.fx) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; p.t -= dt; }
  S.fx = S.fx.filter(p => p.t > 0);
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 8);
  if (S.blur > 0) S.blur -= dt;
}

// ---------------- authority update (the driver's game runs the drive) ----------------
function doHit(id) {
  const st = stat(id);
  if ((st.hitCd || 0) > S.t) return;
  st.hitCd = S.t + 8; st.hits++;
  S.pc[id] = Math.min(100, (S.pc[id] || 0) + 10);
  sfx('cough'); puff(W / 2 + 34, 150, 14, '#cfcfcf'); if (S.net) S.out.push(['puff']);
  addHeat(3); S.blur = Math.max(S.blur, 0.6);
}
function doThrow(id, seat, aim) {
  const st = stat(id);
  if ((st.thrCd || 0) > S.t || S.snacks <= 0) return;
  st.thrCd = S.t + 0.35; st.thr++;
  const tgt = pickTarget(seat, aim);
  S.snacks--; sfx('throw');
  const side = tgt ? (tgt.stage === 'tail' ? 0 : tgt.side) : (aim || 1);
  S.shots.push({ tgt, t: 0, x0: W / 2, y0: 150, side, by: id });
  if (S.net) S.out.push(['shot', side]);
}
function doGrab(id) { stat(id).grabT = S.t + 0.6; } // K opens a short grab window
function grabTick(id) {
  const segIdx = Math.floor(S.pos / SEG);
  for (let i = segIdx; i < segIdx + 3; i++) {
    const sg = S.segs[i % S.segs.length];
    sg.items.forEach((it, j) => { if (!it.got && it.k === 'coin' && Math.abs(it.x - S.x) < 1.1 && takeItem(sg.i, j)) { S.coins += coinMul(); pop("GRAB +" + coinMul(), "#ffd23f"); stat(id).grabs++; sfx('coin'); } });
  }
}
function updateDrive(rdt) {
  if (hit('escape')) { S.paused = !S.paused; }
  if (S.paused && !S.net) { if (hit('q')) endDrive(true); return; }
  if (S.banner) { S.banner.t -= rdt; if (S.banner.t <= 0) S.banner = null; }
  if (S.freeze > 0) { S.freeze -= rdt; rdt *= 0.1; }
  const ultra = bakedLevel() === 3;
  const dt = rdt * (ultra ? 0.85 : 1) * (S.sirensSlow > 0 ? 0.6 : 1);
  musicTick(rdt, S.car, ultra);

  // ---- inputs: mine + the crew's ----
  const seat = mySeat();
  if (hit('h')) doHit(S.me);
  if (S.solo) { if (hit('j') || mouse.click) doThrow(S.me, 0, null); if (hit('k')) doGrab(S.me); }
  else if (seat > 0) localInputs(p => S.inq.push(Object.assign({ id: S.me }, p)));
  for (const q of S.inq.splice(0)) {
    const qs = S.seats.indexOf(q.id);
    if (qs < 0) continue;
    if (q.a === 'hit') doHit(q.id);
    else if (q.a === 'throw' && qs > 0) doThrow(q.id, qs, q.aim);
    else if (q.a === 'grab' && qs > 0) doGrab(q.id);
    else if (q.a === 'tap') stat(q.id).taps++;
  }
  for (const id in S.stats) if (S.stats[id].grabT > S.t) grabTick(id);
  // cooked fades for everyone
  for (const id in S.pc) S.pc[id] = Math.max(0, S.pc[id] - dt * 0.5);

  // ---- steering (baked lag/drift/sway) ----
  const lvl = bakedLevel();
  let steer = (any('a', 'arrowleft') ? -1 : 0) + (any('d', 'arrowright') ? 1 : 0);
  if (S.scramble > 0) { S.scramble -= dt; steer = -steer + Math.sin(S.t * 9) * 0.6; }
  const lag = [0, 0.1, 0.18, 0.22][lvl] * Math.max(0.4, 1 - 0.25 * S.tireLv);
  S.lastSteer += (steer - S.lastSteer) * Math.min(1, dt / (0.02 + lag));
  S.drift = [0, 0.18, 0.35, 0.4][lvl] * Math.sin(S.t * 0.7) * Math.max(0.4, 1 - 0.25 * S.tireLv);
  S.sway = [0, 3, 7, 10][lvl];

  const boost = any('w', 'arrowup', ' '), brake = any('s', 'arrowdown');
  const spPct = S.speed / S.maxSp;
  const sg = segAt(S.pos);
  const offroad = Math.abs(S.x) > 1;
  const top = S.maxSp * (boost ? 1 : 0.8) * (offroad ? 0.45 : 1) * (S.sirensSlow > 0 ? 0.5 : 1);
  if (brake) S.speed -= S.accel * 2.5 * dt;
  else if (S.speed < top) S.speed += S.accel * (boost ? 1.3 : 1) * dt;
  else S.speed -= S.accel * 1.5 * dt;
  S.speed = Math.max(0, Math.min(S.maxSp * 1.05, S.speed));
  S.x += (S.lastSteer * 2.2 * S.grip * (0.4 + spPct) + S.drift * 0.6) * dt;
  S.x -= sg.curve * spPct * spPct * 0.9 * dt;
  S.x = Math.max(-2.2, Math.min(2.2, S.x));
  if (offroad && S.speed > S.maxSp * 0.3) S.shake = Math.max(S.shake, 1.5);
  S.lastBoost = boost;
  if (spPct > 0.9) addHeat(dt * 2.2);

  const dz = S.speed * dt;
  S.pos += dz; S.dist += dz; S.dists[half()] += dz;
  const segIdx = Math.floor(S.pos / SEG);

  if (S.practice && practiceStep(dt, segIdx, boost, brake)) return;
  // ---- fork at 25% ----
  if (!S.practice && !S.route && segIdx >= S.forkAt) {
    S.route = S.x < 0 ? 'fast' : 'scenic';
    banner(S.route === 'fast' ? 'FAST ROUTE' : 'SCENIC ROUTE', S.route === 'fast' ? 'SHORTER. MORE COPS.' : 'LONGER. MORE COINS.', '#8ef0b0', 2);
    if (S.route === 'fast') S.trackLen = Math.floor(S.segs.length * 0.88) * SEG;
    else {
      for (let i = segIdx + 20; i < S.segs.length - 60; i += 100) { const lx = Math.random() * 1.4 - 0.7; for (let j = 0; j < 4; j++) addItem(i + j * 3, 'coin', lx); }
      addItem(Math.floor(S.segs.length * 0.7), 'secret', 0);
    }
  }

  // ---- swap event (40-60%) ----
  if (!S.practice && !S.swapped && segIdx >= S.swapAt) { triggerSwap(); if (!S.auth) return; }
  if (S.spin > 0) { S.spin -= rdt; S.x += Math.sin(S.spin * 12) * dt * 2; }

  // ---- pickups ----
  // coin magnet: coins just ahead drift toward the car so driving "through" a coin line always feels right
  for (let i = segIdx + 1; i < segIdx + 6; i++) for (const it of S.segs[i % S.segs.length].items) if (it.k === 'coin' && !it.got && Math.abs(it.x - S.x) < 0.8) it.x += (S.x - it.x) * Math.min(1, dt * 5);
  for (let i = segIdx; i < segIdx + 2; i++) {
    const s2 = S.segs[i % S.segs.length];
    s2.items.forEach((it, j) => {
      if (it.got || HAZ[it.k] || Math.abs(it.x - S.x) > (it.k === 'coin' ? 0.5 : 0.35)) return;
      if (!takeItem(s2.i, j)) return;
      if (it.k === 'coin') { const v = coinMul(); S.coins += v; stat(S.seats[0]).grabs++; sfx('coin'); pop('+' + v, '#ffd23f'); }
      else if (it.k === 'snacks') { S.snacks += 8; sfx('pickup'); banner('+8 SNACKS', '', '#ffd23f', 1, true); }
      else if (it.k === 'incense') { addHeat(-25); sfx('pickup'); banner('INCENSE: HEAT DOWN', '', '#b45cff', 1, true); }
      else if (it.k === 'fresh') { addHeat(-15); sfx('pickup'); banner('AIR FRESHENER', '', '#8ef0b0', 1, true); }
      else if (it.k === 'nug') { for (const id in S.pc) S.pc[id] = Math.min(100, S.pc[id] + 15); sfx('pickup'); }
      else if (it.k === 'secret') { S.coins += 15; S.secret = true; sfx('banner'); banner('SECRET STASH!', '+15 COINS', '#ffd23f', 2); }
    });
  }
  // hazards: roadblocks, cones, potholes, oil
  for (let i = segIdx; i < segIdx + 2; i++) {
    const si = i % S.segs.length;
    S.segs[si].items.forEach((c, j) => {
      const hz = HAZ[c.k]; if (!hz || c.got || Math.abs(c.x - S.x) > hz.w || !takeItem(si, j)) return;
      if (c.k === 'block') { crash(null, 'ROADBLOCK!'); loseCoins(6); addHeat(10); }
      else if (c.k === 'cone') { S.shake = Math.max(S.shake, 2); S.speed *= 0.85; loseCoins(2); sfx('splat'); for (let k = 0; k < 6; k++) S.fx.push({ x: W / 2 + Math.random() * 20 - 10, y: 150, vx: Math.random() * 160 - 80, vy: -80 - Math.random() * 60, g: 260, t: 0.9, col: k % 2 ? '#f80' : '#fff', r: 4 }); }
      else if (c.k === 'pothole') { S.shake = 5; S.speed *= 0.6; S.damage++; loseCoins(3); sfx('crash'); banner('POTHOLE!', '', '#ff6b6b', 0.8, true); }
      else if (c.k === 'oil') { S.spin = 1.1; sfx('horn'); banner('OIL SLICK!', 'HOLD ON...', '#b45cff', 1, true); }
    });
  }
  // off-road: trees, lamps, houses hurt
  if (Math.abs(S.x) > 1.25 && S.speed > S.maxSp * 0.25) for (const pr of sg.props) if (!SOFT[pr.k] && Math.abs(pr.x - S.x) < 0.35) { crash(null, 'OUCH! STAY ON THE ROAD'); loseCoins(3); S.x *= 0.8; }
  S.nextHaz -= dt;
  if (!S.practice && S.nextHaz <= 0 && segIdx < S.segs.length - 100) {
    S.nextHaz = 2.5 + Math.random() * 3 / (1 + 0.3 * bakedLevel());
    const k = ['cone', 'cone', 'pothole', 'oil'][Math.random() * 4 | 0], bi = segIdx + 70 + (Math.random() * 20 | 0);
    if (k === 'cone') { const lx = [-0.6, 0, 0.6][Math.random() * 3 | 0]; for (let q = 0; q < 3; q++) addItem(bi + q * 2, 'cone', lx + (q - 1) * 0.12); }
    else addItem(bi, k, Math.random() * 1.4 - 0.7);
  }

  // ---- traffic ----
  S.nextTraffic -= dt;
  if (S.nextTraffic <= 0 && !S.practice) { S.nextTraffic = 1.2 + Math.random() * 2; spawnTraffic(120 + Math.random() * 20); }
  for (const c of S.traffic) {
    c.z += c.sp * dt;
    c.rel = c.z - S.pos;
    const dx = Math.abs(c.x - S.x);
    if (c.rel > -SEG * 0.3 && c.rel < SEG * 0.8 && dx < 0.38) { crash(c, 'CRASH!'); loseCoins(4 + Math.floor(S.coins * 0.15)); }
    else if (!c.passed && c.rel < 0 && dx < 0.7 && S.speed > S.maxSp * 0.6) { c.passed = true; if ((S.ccCd || 0) <= S.t) { S.ccCd = S.t + 4; S.coins += 1; sfx('sel'); pop('CLOSE CALL +1', '#8ef0b0'); } }
    if (c.rel < -SEG) c.passed = true;
  }
  S.traffic = S.traffic.filter(c => c.rel > -SEG * 4 && c.rel < SEG * DRAW);

  // ---- cops ----
  const copRate = (S.route === 'fast' ? 0.7 : 1) * (S.solo ? 1.3 : 1);
  S.nextCop -= dt;
  const maxCops = S.solo ? 2 : 1 + S.crew.length;
  if (!S.practice && S.nextCop <= 0 && S.cops.length < maxCops && segIdx < S.segs.length - 80) { S.nextCop = (7 + Math.random() * 7) * copRate / (S.solo ? 1 : 0.6 + 0.2 * S.crew.length); spawnCop(); }
  S.nextBlock -= dt;
  if (!S.practice && S.nextBlock <= 0 && segIdx < S.segs.length - 100) {
    S.nextBlock = 25 + Math.random() * 15;
    const bi = segIdx + 90, gap = [-0.66, 0, 0.66][Math.random() * 3 | 0];
    for (const bx of [-0.66, 0, 0.66]) if (bx !== gap) addItem(bi, 'block', bx);
    banner('ROADBLOCK AHEAD!', 'FIND THE GAP', '#ff6b6b', 1.5, true);
  }
  S.siren = 0;
  for (const c of S.cops) {
    c.t += dt; c.wob += dt;
    if (c.blind > 0) { c.blind -= dt; c.rel -= 250 * dt; continue; }
    const want = c.type === 'moto' ? 1.1 : c.type === 'suv' ? 0.85 : 1;
    const closing = (220 * want * (S.lockT > 0 ? 1.6 : 1) + (S.maxSp - S.speed) * 0.4 - (S.lastBoost ? 60 : 0)) * dt;
    if (c.stage === 'tail') {
      c.rel += closing;
      if (c.rel > -60) {
        c.stage = 'side'; c.t = 0; sfx('horn');
        // pick the side with fewer cops so both windows get work
        const l = S.cops.filter(o => o.side === -1 && o.stage !== 'tail').length, r = S.cops.filter(o => o.side === 1 && o.stage !== 'tail').length;
        c.side = l === r ? (Math.random() < 0.5 ? -1 : 1) : l < r ? -1 : 1;
      }
    } else if (c.stage === 'side') {
      c.rel = -20 + Math.sin(c.t * 2) * 10;
      addHeat(dt * 2);
      if (c.t > (S.solo ? 5 : 3.5)) { c.stage = 'ram'; c.t = 0; }
    } else if (c.stage === 'ram') {
      if (c.t > 0.4 && !c.rammed) { c.rammed = true; S.shake = 5; S.damage++; loseCoins(5); addHeat(8); pop('RAMMED!', '#ff3b3b'); sfx('crash'); S.x += c.side * -0.4; }
      if (c.t > 1.5) { c.stage = 'side'; c.t = 0; c.rammed = false; }
    }
    S.siren = Math.max(S.siren, Math.max(0, 1 + c.rel / 900));
  }
  // shots land
  for (const s of S.shots) {
    s.t += dt;
    if (s.t > 0.35 && !s.done) {
      s.done = true;
      const c = s.tgt;
      if (c && S.cops.includes(c)) {
        c.hp--; c.blind = 0.8; stat(s.by).hitc++; sfx('splat');
        if (c.hp <= 0) { S.cops.splice(S.cops.indexOf(c), 1); S.shaken[half()]++; addHeat(-10); banner('COP SHAKEN!', '', '#8ef0b0', 1, true); }
      }
    }
  }
  S.shots = S.shots.filter(s => s.t < 0.5);
  if (S.car === 'shitbox') { S.backfireT -= dt; if (S.backfireT <= 0) { S.backfireT = 6 + Math.random() * 10; sfx('backfire'); puff(W / 2, 170, 8, '#555', 0); for (const c of S.cops) if (c.stage !== 'tail') { c.stage = 'tail'; c.rel = -500; } } }
  S.cops = S.cops.filter(c => { if (c.rel < -1800) { S.shaken[half()]++; return false; } return true; });

  // ---- heat: locked on / busted ----
  if (!S.practice && S.heat >= 100 && S.lockT <= 0) {
    S.lockT = 5; banner('LOCKED ON!', 'BOOST, SWERVE OR PELT IT', '#ff3b3b', 1.5); sfx('siren');
    if (!S.cops.length) spawnCop();
    S.cops[0].stage = 'side'; S.cops[0].side = S.cops[0].side || 1; S.cops[0].t = 0;
  }
  if (S.lockT > 0) {
    S.lockT -= dt;
    if (!S.cops.length) { S.lockT = 0; S.heat = 60; banner('SHOOK THEM!', '', '#8ef0b0', 1.5); }
    else if (S.lockT <= 0) {
      S.caught++; loseCoins(10 + Math.floor(S.coins * 0.3)); S.sirensSlow = 3; S.heat = 50; S.cops.length = 0;
      sfx('caught'); banner('BUSTED!', 'COINS CONFISCATED. SIRENS...', '#ff3b3b', 2.5);
    }
  }
  if (S.sirensSlow > 0) S.sirensSlow -= dt;
  S.heat = Math.max(0, S.heat - dt * 0.6);
  commonFx(dt);
  engineSet(S.speed / S.maxSp);

  if (S.net) { S.stT -= rdt; if (S.stT <= 0) { S.stT = 0.1; nsend('st', snapshot()); } }
  if (S.practice) { if (S.pos >= S.trackLen - SEG * 60) S.pos = SEG * 40; }
  else if (S.pos >= S.trackLen - SEG * 40) endDrive(false);
}
const SOFT = { bush: 1, tuft: 1, flower: 1, rock: 1, post: 1, mile: 1 };
const HAZ = { block: { w: 0.4 }, cone: { w: 0.3 }, pothole: { w: 0.3 }, oil: { w: 0.35 } };
// floating text popup above the car
function pop(txt, col) { S.fx.push({ x: W / 2 + Math.random() * 16 - 8, y: 130, vx: 0, vy: -30, t: 1, col, txt }); if (S.auth && S.net) S.out.push(['pop', txt, col]); }
// lose coins: they spray out of the windows, and about half land on the road ahead so you can win them back
function loseCoins(n) {
  n = Math.min(Math.floor(S.coins), n); if (n <= 0) return;
  S.coins -= n; S.lost += n; pop('-' + n + ' COINS', '#ff6b6b');
  for (let i = 0; i < Math.min(14, n * 2); i++) S.fx.push({ x: W / 2 + Math.random() * 30 - 15, y: 150, vx: Math.random() * 200 - 100, vy: -90 - Math.random() * 80, g: 300, t: 1.1, col: '#ffd23f', r: 4 });
  if (!S.practice) { const si = Math.floor(S.pos / SEG) + 25, lx = Math.random() * 1.2 - 0.6; for (let j = 0; j < Math.floor(n / 3); j++) addItem(si + j * 3, 'coin', lx + Math.sin(j) * 0.2); }
}
function crash(car, why) {
  if (S.crashCd > S.t) return;
  S.crashCd = S.t + 1.2; if (why) banner(why, '', '#ff6b6b', 0.8, true);
  S.speed *= 0.35; S.shake = 4; S.damage++; S.crashes[half()]++; addHeat(12); sfx('crash');
  if (car) { car.z += SEG * 2; car.x += (car.x > S.x ? 1 : -1) * 0.3; }
  puff(W / 2, 150, 10, '#888');
}


// ---------------- test drive (brief 1.13): first time only, solo, skippable ----------------
const PSTEPS = [
  ['STEER', 'A / D  OR  LEFT / RIGHT'],
  ['BOOST AND BRAKE', 'HOLD W OR SPACE, THEN TAP S'],
  ['THROW A SNACK', 'J OR CLICK AT THE CONE-COP'],
  ['GRAB COINS', 'DRIVE THROUGH THE COIN LINE'],
  ['TAKE A HIT', 'PRESS H. FEEL THE WOBBLE.'],
  ['SEAT SWAP DEMO', 'HALFWAY THROUGH EVERY DRIVE SOMETHING HAPPENS...'],
];
function practiceStep(dt, segIdx, boost, brake) {
  if (hit('tab')) { endPractice(); return true; }
  S.pT += dt;
  const st = S.pstep;
  let ok = false;
  if (st === 0) { S.pSteer = (S.pSteer || 0) + Math.abs(S.lastSteer) * dt; ok = S.pSteer > 0.6; }
  else if (st === 1) { if (boost && S.speed > S.maxSp * 0.7) S.pBoost = true; ok = S.pBoost && brake; }
  else if (st === 2) {
    ok = (stat(S.me).hitc || 0) > 0;
    if (!ok && !S.cops.length) S.cops.push({ type: 'cone', hp: 1, rel: -20, x: 0, side: 1, stage: 'side', t: -99, blind: 0, wob: 0 });
    for (const c of S.cops) c.t = -99; // cone-cop never rams
  }
  else if (st === 3) {
    if (!S.pCoin || S.pT > 4) { S.pT = 0; S.pCoin = true; const lx = Math.max(-0.7, Math.min(0.7, S.x + 0.4)); for (let j = 0; j < 4; j++) addItem(segIdx + 12 + j * 2, 'coin', lx); }
    ok = (stat(S.me).grabs || 0) > 0;
  }
  else if (st === 4) ok = (stat(S.me).hits || 0) > 0 && S.pT > 1.5;
  else if (st === 5) {
    if (!S.pSwap) { S.pSwap = true; S.pT = 0; eventFx('THE POTHOLE'); S.scramble = 3; banner('THE POTHOLE', 'SOLO: CONTROLS SCRAMBLE. ONLINE: EVERYONE SWAPS SEATS!', '#ffd23f', 3); }
    ok = S.pT > 4;
  }
  if (ok) {
    S.pstep++; S.pT = 0; SFX.pickup();
    if (S.pstep >= PSTEPS.length) { endPractice(); return true; }
    if (S.pstep !== 5) banner('NICE!', '', '#8ef0b0', 0.8);
  }
  return false;
}
function endPractice() {
  S.save.testDrive = true;
  engineStop();
  const keep = { opts: S.opts, save: S.save, net: S.net, me: S.me, world: S.world, night: S.night, crew: S.crew, cooked0: S.cooked0, votes: {}, voteT: 5, t: S.t, shake: 0 };
  const back = S.afterPractice, handle = S.handle;
  for (const k in S) delete S[k];
  Object.assign(S, keep, { handle, heard: {}, solo: true });
  S.car = keep.opts.vehicle || keep.save.lastRide || 'van'; S.pickSel = S.car === 'shitbox' ? 1 : 0;
  try { if (typeof keep.save.__persist === 'function') keep.save.__persist(); } catch (e) {}
  S.mode = 'card'; soloSeats();
}

// ---------------- end / results ----------------
function computeResults(quit) {
  const score = Math.max(0, Math.round(S.coins * 10 + (S.shaken[0] + S.shaken[1]) * 50 - S.caught * 100 - (S.crashes[0] + S.crashes[1]) * 15 + (S.secret ? 200 : 0) + (quit ? -300 : 300)));
  const awards = [];
  const best = k => { let id = null, v = 0; for (const i in S.stats) if (S.stats[i][k] > v) { v = S.stats[i][k]; id = i; } return id; };
  const nm = id => S.solo ? '' : ': ' + nameOf(id);
  const [c0, c1] = S.crashes;
  if (!S.solo && S.drivers[1] != null) {
    const smooth = c0 <= c1 ? 0 : 1, worst = 1 - smooth;
    awards.push('SMOOTHEST DRIVER' + nm(S.drivers[smooth]));
    if (Math.max(c0, c1) >= 3) awards.push('WORST DRIVER' + nm(S.drivers[worst]));
  } else if (c0 + c1 <= 1) awards.push('SMOOTHEST DRIVER'); else if (c0 + c1 >= 5) awards.push('WORST DRIVER');
  const sn = best('hitc'); if (sn != null && S.stats[sn].hitc >= 3) awards.push('SNACK SNIPER' + nm(sn));
  const pa = best('hits'); if (pa != null && S.stats[pa].hits >= 2) awards.push('MOST PARANOID' + nm(pa));
  const cg = best('grabs'); if (cg != null && S.stats[cg].grabs >= 3) awards.push('COIN GOBLIN' + nm(cg));
  const bs = best('taps'); if (bs != null && S.stats[bs].taps >= 5) awards.push('BACKSEAT DRIVER' + nm(bs));
  if (S.car === 'shitbox' && S.caught === 0) awards.push('TAYLOR WOULD BE PROUD');
  if (!awards.length) awards.push('MADE IT. BARELY.');
  return {
    score, awards: awards.slice(0, 4), coins: Math.floor(S.coins), caught: S.caught, shaken: S.shaken, crashes: S.crashes, route: S.route || 'fast',
    snacks: S.snacks, munchies: Math.min(2, Math.floor(S.snacks / 5)), buff: score >= 800 ? (Math.random() < 0.5 ? 'cooked10' : 'soda10') : null,
    drivers: S.drivers.map(id => id == null ? '' : nameOf(id)), secret: !!S.secret, gas: S.gas || 0, lost: S.lost || 0,
  };
}
function endDrive(quit, res) {
  engineStop();
  if (!res) { res = computeResults(quit); if (S.auth && S.net) nsend('end', { res }); }
  S.res = res; S.mode = 'results'; S.resT = S.t;
  SFX.banner();
}
function finish() {
  const save = S.save, r = S.res;
  save.drives = save.drives || {};
  if (S.opts.from != null && S.opts.to != null) save.drives[driveKey(S.opts.from, S.opts.to)] = true;
  try { if (typeof save.__persist === 'function') save.__persist(); } catch (e) {}
  save.drivesDone = (save.drivesDone || 0) + 1;
  const myCooked = Math.round(S.pc ? (S.pc[S.me] != null ? S.pc[S.me] : avgCooked()) : S.cooked0);
  const out = { coins: r.coins, snacksLeft: r.snacks, score: r.score, awards: r.awards, heatCaught: r.caught, cooked: myCooked, munchies: r.munchies, buff: r.buff, route: r.route };
  const cb = S.opts.onDone;
  stop();
  cb && cb(out);
}
function stop() {
  engineStop(); cancelAnimationFrame(raf);
  removeEventListener('keydown', kd, true); removeEventListener('keyup', ku); removeEventListener('mousemove', mm);
  for (const k in keys) keys[k] = false;
  destroyCanvas(); S = null;
}

// ---------------- rendering ----------------
function project(p, camX, camY, camZ) {
  const cx = p.x - camX, cy = p.y - camY, cz = p.z - camZ;
  const sc = CAMD / cz;
  return { x: Math.round(W / 2 + sc * cx * W / 2), y: Math.round(H / 2 - sc * cy * H / 2), w: Math.round(sc * ROADW * W / 2), sc };
}
function shade(hex, k) { const n = parseInt(hex.slice(1, 7).padEnd(6, '0'), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); if (hex.length === 4) { const r = parseInt(hex[1] + hex[1], 16), g = parseInt(hex[2] + hex[2], 16), b = parseInt(hex[3] + hex[3], 16); return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; } return 'rgb(' + f(n >> 16) + ',' + f(n >> 8 & 255) + ',' + f(n & 255) + ')'; }
function poly(x1, y1, w1, x2, y2, w2, col) {
  ctx.fillStyle = col; ctx.beginPath();
  ctx.moveTo(x1 - w1, y1); ctx.lineTo(x2 - w2, y2); ctx.lineTo(x2 + w2, y2); ctx.lineTo(x1 + w1, y1); ctx.closePath(); ctx.fill();
}
const hue = (h, s = 90, l = 55) => `hsl(${h | 0},${s}%,${l}%)`;

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  if (S.mode === 'wait') { ctx.fillStyle = '#1e1030'; ctx.fillRect(0, 0, W, H); text('THE CREW IS ON THE HIGHWAY', W / 2, 80, '#8ef0b0', 2, 'center'); text('HOPPING IN THE BACK...', W / 2, 100, '#fff', 1, 'center'); return flushText(); }
  if (S.mode === 'pick') return drawPick(), flushText();
  if (S.mode === 'card') return drawCard(), flushText();
  if (S.mode === 'results') return drawResults(), flushText();
  const th = S.theme, lvl = bakedLevel(), ultra = lvl === 3;
  const sh = S.shake;
  ctx.translate(Math.round((Math.random() - 0.5) * sh * 2), Math.round((Math.random() - 0.5) * sh * 2));
  // sky
  const wob = lvl ? Math.sin(S.t * 1.3) * S.sway * 0.4 : 0;
  const g = ctx.createLinearGradient(0, 0, 0, H / 2);
  g.addColorStop(0, ultra ? hue(S.t * 60) : th.sky[0]); g.addColorStop(1, ultra ? hue(S.t * 60 + 120) : th.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(-4, -4, W + 8, H + 8);
  if (S.night) { ctx.fillStyle = '#fff'; for (let i = 0; i < 30; i++) ctx.fillRect((i * 97) % W, (i * 53) % 70, 1, 1); }
  // parallax hills
  const cur = segAt(S.pos);
  S.bgX = (S.bgX || 0) + cur.curve * (S.speed / MAXSP) * 0.8;
  // clouds (slow parallax) + far skyline
  if (!S.night) { ctx.fillStyle = ultra ? hue(S.t * 60 + 200, 60, 85) : '#ffffffcc'; for (let i = 0; i < 6; i++) { const cx = ((i * 71 - S.bgX * 0.3 - S.t * 3) % (W + 80) + W + 80) % (W + 80) - 40, cy = 14 + (i * 37) % 40; ctx.fillRect(cx, cy, 34, 6); ctx.fillRect(cx + 6, cy - 4, 20, 5); ctx.fillRect(cx + 14, cy - 7, 10, 4); } }
  const city = ['city', 'downtown', 'hq'].includes(S.world);
  ctx.fillStyle = city ? (S.night ? '#140a24' : '#3a3050') : shade(th.hill, 0.55);
  if (!city) for (let x = -4; x < W + 4; x += 2) { const u = x + S.bgX * 0.5, hh = 26 + Math.sin(u * 0.02) * 12 + Math.sin(u * 0.047) * 5; ctx.fillRect(x, H / 2 - hh + wob, 2, hh + 4); }
  else for (let x = -12; x < W + 12; x += 12) {
    const off = ((S.bgX * 0.5) % 12 + 12) % 12, k = Math.floor((x + S.bgX * 0.5) / 12);
    const hh = 18 + (Math.abs(Math.sin(k * 12.9898) * 43758) % 1) * 30;
    ctx.fillRect(x - off, H / 2 - hh + wob, 11, hh + 4);
    if (S.night && k % 2) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - off + 3, H / 2 - hh + 6 + wob, 2, 2); ctx.fillStyle = '#140a24'; }
  }
  ctx.fillStyle = th.hill;
  for (let x = -4; x < W + 4; x += 2) { const hh = 14 + Math.sin((x + S.bgX) * 0.03) * 8 + Math.sin((x + S.bgX) * 0.011) * 10; ctx.fillRect(x, H / 2 - hh + wob, 2, hh + 4); }

  // road
  const base = segAt(S.pos), basePct = (S.pos % SEG) / SEG;
  const pl = S.x * ROADW;
  const camY = CAMH + (base.y1 + (base.y2 - base.y1) * basePct);
  let dx = -base.curve * basePct, xacc = 0, maxY = H;
  const list = [];
  for (let n = 0; n < DRAW; n++) {
    const s = S.segs[(base.i + n) % S.segs.length];
    const loop = (base.i + n) >= S.segs.length ? S.trackLen : 0;
    const swayX = S.sway * Math.sin(S.t * 1.1 + n * 0.05) * 20;
    const p1 = project({ x: 0, y: s.y1, z: s.i * SEG + loop }, pl - xacc + swayX, camY, S.pos);
    const p2 = project({ x: 0, y: s.y2, z: (s.i + 1) * SEG + loop }, pl - xacc - dx + swayX, camY, S.pos);
    xacc += dx; dx += s.curve;
    s.clip = maxY; s.p = p1;
    if (p1.sc <= 0 || p2.y >= maxY || p2.y >= p1.y) { list.push(s); continue; }
    const alt = Math.floor(s.i / RUMBLE) % 2;
    const y1 = p1.y + wob, y2 = p2.y + wob;
    ctx.fillStyle = ultra ? hue(s.i * 8 + S.t * 90, 70, alt ? 35 : 30) : th.grass[alt]; ctx.fillRect(-4, y2, W + 8, y1 - y2 + 1);
    if (!ultra) poly(p1.x, y1, p1.w * 1.4, p2.x, y2, p2.w * 1.4, shade(th.grass[alt], 0.8)); // dirt shoulder
    poly(p1.x, y1, p1.w * 1.15, p2.x, y2, p2.w * 1.15, ultra ? hue(s.i * 12, 90, 70) : th.rumble[alt]);
    poly(p1.x, y1, p1.w, p2.x, y2, p2.w, ultra ? hue(s.i * 5 + S.t * 40, 50, alt ? 32 : 28) : th.road[alt]);
    const hs = (Math.imul(s.i, 2654435761) >>> 0);
    if (!ultra) {
      for (const ex of [-0.94, 0.94]) poly(p1.x + p1.w * ex, y1, p1.w * 0.018, p2.x + p2.w * ex, y2, p2.w * 0.018, '#eee'); // edge lines
      if (hs % 17 === 0) poly(p1.x + p1.w * ((hs >> 8) % 100 / 100 - 0.5), y1, p1.w * 0.22, p2.x + p2.w * ((hs >> 8) % 100 / 100 - 0.5), y2, p2.w * 0.22, shade(th.road[0], 0.78)); // tar patch
      if (hs % 29 === 3) { const cx = (hs >> 5) % 120 / 100 - 0.6; poly(p1.x + p1.w * cx, y1, p1.w * 0.01, p2.x + p2.w * (cx + 0.05), y2, p2.w * 0.01, shade(th.road[0], 0.55)); } // crack
      if (hs % 53 === 7) for (const o of [-0.08, 0.08]) poly(p1.x + p1.w * (o + 0.2), y1, p1.w * 0.03, p2.x + p2.w * (o + 0.22), y2, p2.w * 0.03, shade(th.road[0], 0.6)); // skid marks
      if (s.i % 60 === 30) poly(p1.x, y1, p1.w * 0.8, p2.x, y2, p2.w * 0.8, alt ? '#ddd' : th.road[alt]); // crosswalk-ish stripe band
    }
    if (Math.floor(s.i / 3) % 2) for (const lx of [-1 / 3, 1 / 3]) poly(p1.x + p1.w * lx, y1, p1.w * 0.02, p2.x + p2.w * lx, y2, p2.w * 0.02, th.lane);
    if (!S.route && s.i > S.forkAt - 5 && s.i < S.forkAt) poly(p1.x, y1, p1.w * 0.03, p2.x, y2, p2.w * 0.03, '#ff3b3b');
    maxY = p2.y;
    list.push(s);
  }
  // sprites back to front
  for (let n = list.length - 1; n > 0; n--) {
    const s = list[n]; if (!s.p || s.p.sc <= 0) continue;
    const p = s.p, y = p.y + wob;
    for (const pr of s.props) drawProp(pr, p.x + p.w * pr.x, y, p.w / 140, s.clip);
    for (const it of s.items) if (!it.got) drawItem(it, p.x + p.w * it.x, y, p.w / 140);
    for (const c of S.traffic) { const ci = Math.floor(c.z / SEG); if (ci === s.i) drawCar(p.x + p.w * c.x, y, p.w / 140, c.col, false); }
  }
  // cops alongside (screen space, beside the van)
  for (const c of S.cops) if (c.stage !== 'tail') {
    const sx = W / 2 + c.side * 70 + (c.stage === 'ram' ? -c.side * Math.min(1, c.t * 3) * 30 : 0);
    drawCop(c, sx, 172, 1.05);
    text(c.side < 0 ? '<' : '>', c.side < 0 ? 6 : W - 10, 120, '#ff3b3b', 3);
  }
  // aim marker: which cop your next throw hits
  if (S.mode === 'drive' && S.cops.length && (S.solo || mySeat() > 0)) {
    const tg = pickTarget(S.solo ? 0 : mySeat(), null);
    if (tg && tg.stage !== 'tail') { const tx = W / 2 + tg.side * 70, ty = 176, b = Math.floor(S.t * 6) % 2 ? 2 : 0; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1; ctx.strokeRect(tx - 34 - b, ty - 58 - b, 68 + b * 2, 58 + b * 2); text('J', tx, ty - 70, '#ffd23f', 1, 'center'); }
  }
  // van (blinks while recovering from a crash)
  if (!(S.crashCd > S.t && Math.floor(S.t * 12) % 2)) drawPlayer();
  // shots
  for (const s of S.shots) {
    const tx = s.side === 0 ? W / 2 : W / 2 + s.side * 70, ty = s.side === 0 ? 14 : 160;
    const k = Math.min(1, s.t / 0.35);
    ctx.fillStyle = '#e8a33a'; ctx.fillRect(s.x0 + (tx - s.x0) * k - 2, s.y0 + (ty - s.y0) * k - 10 * Math.sin(k * Math.PI) - 2, 4, 4);
  }
  // fx
  for (const p of S.fx) { ctx.globalAlpha = Math.min(1, p.t); if (p.txt) { text(p.txt, p.x, p.y, p.col, 1, 'center'); continue; } ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, p.r, p.r); }
  ctx.globalAlpha = 1;
  // siren wash
  if (S.siren > 0.2) { ctx.globalAlpha = 0.12 * S.siren; ctx.fillStyle = Math.floor(S.t * 6) % 2 ? '#f00' : '#03f'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (lvl >= 2) { ctx.globalAlpha = 0.08 * lvl; ctx.fillStyle = hue(S.t * 50); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (S.blur > 0) { ctx.globalAlpha = Math.min(0.7, S.blur * 0.4); ctx.fillStyle = '#ddd'; for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.arc((i * 47 + S.t * 20) % W, 80 + Math.sin(i + S.t) * 30, 30, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
  if (S.splat > 0) { ctx.globalAlpha = Math.min(1, S.splat); ctx.fillStyle = S.event === 'THE PIZZA BOX' ? '#e8b04a' : '#8a3'; ctx.beginPath(); ctx.arc(120, 70, 40, 0, 7); ctx.arc(200, 90, 30, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  if (S.flash > 0) { ctx.globalAlpha = S.flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  if (S.sirensSlow > 0 && Math.floor(S.t * 4) % 2) { ctx.globalAlpha = 0.2; ctx.fillStyle = '#f00'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHUD();
  flushText();
}

function drawProp(pr, x, y, sc, clip) {
  const s = Math.max(0.05, sc);
  const k = pr.k;
  const box = (ox, oy, w, h, col) => { const yy = y - (oy + h) * s; if (yy > clip) return; ctx.fillStyle = col; ctx.fillRect(Math.round(x + ox * s), Math.round(yy), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))); };
  if (k === 'tree') { box(-4, 0, 8, 30, '#6b4226'); box(-20, 25, 40, 35, '#2d8a3e'); box(-14, 50, 28, 20, '#3fae5a'); }
  else if (k === 'pine') { box(-3, 0, 6, 20, '#5a3a20'); box(-18, 15, 36, 20, '#1d5a28'); box(-12, 32, 24, 18, '#236a30'); box(-6, 48, 12, 14, '#2a7a38'); }
  else if (k === 'palm') { box(-3, 0, 6, 50, '#8a6a3a'); box(-22, 44, 44, 8, '#2a9a4a'); box(-14, 50, 28, 8, '#3fbf5a'); }
  else if (k === 'house') { box(-34, 0, 68, 36, '#e8d8b0'); box(-38, 34, 76, 14, '#a33'); box(-8, 0, 14, 20, '#6a4'); box(-26, 14, 12, 10, '#9cf'); box(14, 14, 12, 10, '#9cf'); }
  else if (k === 'bush') { box(-16, 0, 32, 14, '#2d8a3e'); box(-10, 10, 20, 8, '#3fae5a'); }
  else if (k === 'tuft') { box(-6, 0, 3, 7, '#2a7a38'); box(-1, 0, 3, 10, '#36994e'); box(4, 0, 3, 6, '#2a7a38'); }
  else if (k === 'flower') { box(-1, 0, 2, 8, '#2a7a38'); box(-3, 8, 6, 4, ['#ff6bb0', '#ffd23f', '#fff'][Math.abs(Math.round(pr.x * 10)) % 3]); }
  else if (k === 'rock') { box(-8, 0, 16, 7, '#8a8a8a'); box(-5, 7, 9, 3, '#a8a8a8'); }
  else if (k === 'post') { box(-1.5, 0, 3, 14, '#eee'); box(-1.5, 11, 3, 3, pr.x < 0 ? '#f33' : '#ffa000'); }
  else if (k === 'mile') { box(-1, 0, 2, 18, '#555'); box(-7, 16, 14, 12, '#1d6b2c'); if (s > 0.5) { const yy = y - 26 * s; if (yy < clip) text(String(pr.n), x, yy, '#fff', 1, 'center'); } }
  else if (k === 'lamp') { box(-2, 0, 4, 70, '#555'); box(-8, 66, 16, 4, '#ffd23f'); }
  else if (k === 'bldg') { box(-40, 0, 80, 120, '#2a1f3a'); for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) if ((i + j) % 3) box(-32 + i * 18, 10 + j * 18, 8, 8, '#ffd84a'); }
  else if (k === 'fence') { box(-30, 0, 60, 20, '#444'); box(-30, 18, 60, 2, '#888'); }
  else if (k === 'sign' || k === 'fork') {
    const lbl = k === 'fork' ? (pr.right ? 'SCENIC >' : '< FAST') : pr.sign;
    box(-2, 0, 4, 30, '#555');
    const w = Math.max(40, lbl.length * 6);
    box(-w / 2, 28, w, 16, k === 'fork' ? '#1d6b2c' : '#7a2fc0');
    if (s > 0.35) { const yy = y - 42 * s; if (yy < clip) text(lbl, x, yy + 3 * s, '#fff', Math.max(1, Math.min(2, s * 1.4)), 'center'); }
  }
}
function drawItem(it, x, y, sc) {
  const s = Math.max(0.1, sc);
  const r = (ox, oy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + ox * s), Math.round(y - (oy + h) * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))); };
  const bob = Math.sin(S.t * 5 + x) * 2;
  if (it.k === 'coin') { r(-6, 8 + bob, 12, 12, '#ffd23f'); r(-2, 11 + bob, 4, 6, '#d99a12'); }
  else if (it.k === 'snacks') { r(-12, 0, 24, 18, '#b5651d'); r(-12, 14, 24, 4, '#8a4a10'); r(-4, 4, 8, 8, '#ffd23f'); }
  else if (it.k === 'incense') { r(-1, 6, 2, 22, '#7a2fc0'); r(-4, 0, 8, 6, '#553'); r(-2, 28 + bob, 4, 4, '#ddd'); }
  else if (it.k === 'fresh') { r(-6, 6 + bob, 12, 16, '#3fae5a'); r(-1, 22 + bob, 2, 6, '#fff'); }
  else if (it.k === 'nug') { r(-7, 6 + bob, 14, 12, '#8ef0b0'); r(-4, 9 + bob, 4, 4, '#3fae5a'); }
  else if (it.k === 'secret') { r(-10, 4 + bob, 20, 16, '#b45cff'); r(-4, 8 + bob, 8, 8, '#ffd23f'); }
  else if (it.k === 'cone') { r(-7, 0, 14, 3, '#f60'); r(-5, 3, 10, 5, '#f80'); r(-4, 8, 8, 3, '#fff'); r(-3, 11, 6, 5, '#f80'); r(-1, 16, 2, 2, '#f80'); }
  else if (it.k === 'pothole') { r(-24, 0, 48, 5, '#1a1a1a'); r(-18, 1, 36, 3, '#000'); r(-26, 4, 6, 2, '#777'); r(20, 4, 6, 2, '#777'); }
  else if (it.k === 'oil') { const sh = Math.floor(S.t * 4) % 3; r(-26, 0, 52, 5, '#111'); r(-16, 1, 30, 3, ['#6a2a8a', '#2a6a8a', '#2a8a4a'][sh]); r(-6, 1, 8, 2, '#c8c'); }
  else if (it.k === 'block') { r(-40, 0, 80, 20, '#fff'); for (let i = 0; i < 4; i++) r(-40 + i * 20, 0, 10, 20, '#d33'); r(-4, 20, 8, 6, Math.floor(S.t * 6) % 2 ? '#f00' : '#03f'); }
}
function drawCar(x, y, sc, col, cop) {
  const s = Math.max(0.1, sc);
  const r = (ox, oy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + ox * s), Math.round(y - (oy + h) * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))); };
  r(-44, 0, 88, 8, '#111'); r(-40, 6, 80, 22, col); r(-40, 6, 80, 3, '#0005'); r(-30, 26, 60, 16, col); r(-26, 28, 52, 12, '#223'); r(-22, 36, 16, 3, '#446');
  r(-38, 12, 10, 5, '#f33'); r(28, 12, 10, 5, '#f33'); r(-8, 10, 16, 6, '#eee');
  if (cop) { r(-12, 42, 12, 5, Math.floor(S.t * 8) % 2 ? '#f00' : '#600'); r(0, 42, 12, 5, Math.floor(S.t * 8) % 2 ? '#006' : '#03f'); }
}
function drawCop(c, x, y, sc) {
  if (c.type === 'cone') { ctx.fillStyle = '#f80'; ctx.beginPath(); ctx.moveTo(x, y - 40); ctx.lineTo(x - 14, y); ctx.lineTo(x + 14, y); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x - 8, y - 20, 16, 4); ctx.fillStyle = '#03f'; ctx.fillRect(x - 4, y - 46, 8, 5); text('COP', x, y - 56, '#fff', 1, 'center'); return; }
  const r = (ox, oy, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x + ox * sc), Math.round(y - (oy + h) * sc), Math.max(1, Math.round(w * sc)), Math.max(1, Math.round(h * sc))); };
  const fl = Math.floor(S.t * 8) % 2, red = fl ? '#ff2a2a' : '#6a0000', blu = fl ? '#10206a' : '#2a6aff';
  const face = c.side || 1; // which way the cop leans (toward the van)
  const rage = c.stage === 'ram';
  if (c.type === 'moto') {
    // bike, rear 3/4
    r(-5, 0, 10, 12, '#111'); r(-3, 2, 6, 8, '#333');                // rear wheel
    r(-9, 10, 18, 8, '#e8e8f0'); r(-9, 10, 18, 2, '#1a3a8a');         // fairing + stripe
    r(-11, 14, 4, 3, red); r(7, 14, 4, 3, blu);                       // saddlebag lights
    r(-3, 18, 6, 3, '#f33');                                          // tail light
    // rider
    r(-7, 20, 14, 14, '#1a2a5a'); r(-7, 28, 14, 2, '#ffd23f');        // jacket + badge stripe
    r(face > 0 ? -12 : 7, 24, 5, 3, '#1a2a5a');                       // arm pointing
    r(-6, 34, 12, 10, '#f0f0f0'); r(-6, 37, 12, 4, '#222');           // helmet + visor
    r(-2, 44, 4, 2, blu);
  } else {
    const suv = c.type === 'suv';
    const body = suv ? '#161618' : '#f0f0f4', trim = suv ? '#b00' : '#111', wide = suv ? 48 : 44;
    r(-wide, 0, wide * 2, 8, '#0c0c0c');                              // tyres/shadow
    r(-wide + 3, 3, 8, 6, '#222'); r(wide - 11, 3, 8, 6, '#222');
    r(-wide + 2, 6, wide * 2 - 4, 20, body);                          // lower body
    r(-wide + 2, 12, wide * 2 - 4, 7, trim);                          // door band (black&white / red stripe)
    r(-12, 8, 24, 7, '#f6f0c0'); text(suv ? 'BUZZKILL' : 'BUZZ PD', x, y - 14 * sc, suv ? '#fff' : '#111', 1, 'center');
    r(-wide + 4, 20, 10, 5, '#f33'); r(wide - 14, 20, 10, 5, '#f33'); // tail lights
    r(-wide + 10, 26, wide * 2 - 20, suv ? 20 : 16, body);            // cabin
    r(-wide + 14, 28, wide * 2 - 28, suv ? 14 : 11, '#1c2a3c');       // rear window
    // cop in the window, leaning out on the van's side
    r(face > 0 ? wide - 22 : -wide + 14, 30, 8, 8, '#e0a878'); r(face > 0 ? wide - 22 : -wide + 14, 36, 8, 3, '#1a2a5a');
    r(face > 0 ? wide - 20 : -wide + 16, 33, 2, 1, '#000'); r(face > 0 ? wide - 16 : -wide + 20, 33, 2, 1, '#000');
    if (rage) r(face > 0 ? wide - 21 : -wide + 15, 30, 6, 1, '#600');
    // light bar
    const lb = suv ? 26 : 22, top = suv ? 46 : 42;
    r(-lb, top, lb * 2, 3, '#333'); r(-lb, top + 3, lb - 2, 4, red); r(2, top + 3, lb - 2, 4, blu);
    if (fl) { ctx.globalAlpha = 0.25; ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(x - lb / 2 * sc, y - (top + 5) * sc, 14 * sc, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
    else { ctx.globalAlpha = 0.25; ctx.fillStyle = '#26f'; ctx.beginPath(); ctx.arc(x + lb / 2 * sc, y - (top + 5) * sc, 14 * sc, 0, 7); ctx.fill(); ctx.globalAlpha = 1; }
  }
  if (c.blind > 0) { ctx.fillStyle = '#e8a33a'; ctx.fillRect(x - 16, y - 40 * sc, 32, 10); ctx.fillStyle = '#b5651d'; ctx.fillRect(x - 6, y - 38 * sc, 4, 4); }
  if (rage && Math.floor(S.t * 10) % 2) text('!', x, y - 70 * sc, '#ff3b3b', 2, 'center');
  for (let i = 0; i < c.hp; i++) { ctx.fillStyle = '#f33'; ctx.fillRect(x - c.hp * 3 + i * 6, y - 60 * sc, 4, 3); }
}
function drawPlayer() {
  const shit = S.car === 'shitbox';
  const steer = S.lastSteer;
  const x = W / 2 + steer * 4, y = 184 + (Math.abs(S.x) > 1 ? (Math.random() * 2 | 0) : 0) + Math.sin(S.t * 20) * (S.speed > 10 ? 0.6 : 0);
  const r = (ox, oy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + ox), Math.round(y - oy - h), w, h); };
  const look = S.look || garageOf(S.save), paint = look.paint;
  if (!shit) {
    const body = paint === 'tiedye' ? hue(S.t * 40, 70, 55) : paint === 'flames' ? '#222' : '#7fb0d8';
    r(-36, 0, 72, 6, '#111');
    r(-34, 4, 68, 34, body); r(-30, 36, 60, 6, body);
    r(-28, 20, 56, 16, '#2a3a50'); r(-2, 20, 4, 16, body); // rear windows
    r(-34, 8, 8, 6, '#f33'); r(26, 8, 8, 6, '#f33');
    r(-10, 4, 20, 6, '#ddd');
    if (paint === 'flames') { r(-34, 4, 68, 6, '#f60'); r(-30, 10, 6, 6, '#fd0'); r(0, 10, 8, 5, '#fd0'); }
    if (paint === 'leaf') { r(10, 12, 6, 6, '#3fae5a'); r(-18, 12, 6, 6, '#3fae5a'); }
    if (S.mode === 'drive' && avgCooked() >= 40) { ctx.globalAlpha = 0.4; r(-28, 20, 56, 16, '#ddd'); ctx.globalAlpha = 1; }
  } else {
    r(-38, 0, 76, 6, '#111');
    r(-36, 4, 72, 16, '#8a1c1c'); r(-28, 18, 56, 14, '#8a1c1c'); r(-24, 20, 48, 10, '#2a3a50');
    r(12, 4, 20, 14, '#5a5a8a'); // mismatched door
    r(-36, 4, 30, 4, '#c8c8a0'); r(-20, 4, 4, 4, '#bbb'); // taped bumper
    r(-36, 8, 8, 5, '#f33'); r(28, 8, 8, 5, '#ff8'); r(-8, 8, 16, 4, '#ddd');
    r(22, -2, 10, 8, '#222'); // spare
    if (look.deco.dice) { const sw = Math.sin(S.t * 6) * 1.5; r(-6 + sw, 24, 4, 4, '#fff'); r(1 + sw, 23, 4, 4, '#fff'); r(-5 + sw, 25, 1, 1, '#111'); r(2 + sw, 24, 1, 1, '#111'); }
    if (look.deco.fresh) { r(8, 23, 1, 3, '#ddd'); r(6, 19, 5, 5, '#3fae5a'); }
  }
  // damage (cosmetic)
  const d = Math.min(6, S.damage);
  if (d >= 1) r(-20, 10, 6, 4, '#333');
  if (d >= 2) r(14, 14, 8, 3, '#333');
  if (d >= 3) { r(-30, 0, 20, 3, '#777'); }
  if (d >= 4 && Math.random() < 0.5) S.fx.push({ x: x + Math.random() * 30 - 15, y: y - 44, vx: 0, vy: -20, t: 0.6, col: '#666', r: 3 });
  if (d >= 5) { ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x - 20, y - 34); ctx.lineTo(x - 8, y - 26); ctx.lineTo(x - 14, y - 22); ctx.stroke(); }
  // exhaust
  if (S.speed > 0 && Math.random() < 0.3) S.fx.push({ x: x - 26, y: y - 2, vx: -10, vy: 5, t: 0.4, col: '#999', r: 2 });
}

function bar(x, y, w, h, pct, col, bg = '#1a1026') {
  ctx.fillStyle = bg; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = col; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, pct))), h);
}
function drawHUD() {
  // top-left: snacks + coins
  text('SNACKS ' + S.snacks, 4, 4, '#ffd23f');
  const netc = Math.floor(S.coins) - (S.gas || 0);
  text('COINS ' + Math.floor(S.coins) + (S.gas != null ? '  NET ' + (netc >= 0 ? '+' : '') + netc : ''), 4, 12, netc >= 0 || S.gas == null ? '#ffd23f' : '#ff9a6b');
  const hc = ((S.stats[S.me] || {}).hitCd || 0) - S.t; text('H: HIT ' + (hc > 0 ? Math.ceil(hc) : 'READY'), 4, 20, hc > 0 ? '#888' : '#8ef0b0');
  // heat
  text('HEAT', 4, 32, '#ff6b6b'); bar(22, 32, 50, 5, S.heat / 100, S.heat >= 100 ? (Math.floor(S.t * 8) % 2 ? '#f00' : '#fff') : '#ff6b6b');
  if (S.lockT > 0) text('LOCKED ' + S.lockT.toFixed(1), 4, 40, '#ff3b3b');
  // cooked
  const lvl = bakedLevel();
  text('COOKED', W - 74, 4, '#8ef0b0'); bar(W - 48, 4, 44, 5, avgCooked() / 100, lvl === 3 ? hue(S.t * 90) : '#8ef0b0');
  text(BAKED[lvl] + (lvl ? ' x' + coinMul() : ''), W - 4, 12, lvl === 3 ? hue(S.t * 90) : '#c8ffa0', 1, 'right');
  // distance bar with ??? swap marker
  const pct = S.pos / (S.trackLen - SEG * 40);
  bar(80, H - 7, 160, 3, pct, '#8ef0b0');
  if (!S.swapped) text('???', 80 + 160 * 0.5, H - 15, '#ffd23f', 1, 'center');
  if (S.opts.toName) text('TO ' + S.opts.toName, 244, H - 8, '#fff');
  // rear-view mirror
  const mx = W / 2 - 30, my = 3;
  ctx.fillStyle = '#222'; ctx.fillRect(mx - 2, my - 2, 64, 24);
  ctx.fillStyle = S.theme.road[0]; ctx.fillRect(mx, my, 60, 20);
  ctx.fillStyle = S.theme.grass[0]; ctx.fillRect(mx, my, 60, 6);
  for (const c of S.cops) if (c.stage === 'tail') {
    const k = Math.max(0.15, 1 + c.rel / 1500);
    const cx = mx + 30 + c.x * 20, cy = my + 8 + k * 10;
    ctx.fillStyle = c.type === 'suv' ? '#222' : '#eee'; ctx.fillRect(cx - 8 * k, cy - 4 * k, 16 * k, 8 * k);
    ctx.fillStyle = Math.floor(S.t * 8) % 2 ? '#f00' : '#03f'; ctx.fillRect(cx - 3 * k, cy - 6 * k, 6 * k, 2 * k);
  }
  // seats
  const occ = [0, 1, 2, 3].filter(i => S.seats[i] != null);
  occ.forEach((si, k) => { const id = S.seats[si]; text(SEAT_SHORT[si] + ' ' + nameOf(id) + (id === S.me ? ' <' : ''), 4, H - 10 - (occ.length - 1 - k) * 8, si === 0 ? '#ffd23f' : id === S.me ? '#fff' : '#c8ffa0'); });
  if (S.mode === 'drive' && mySeat() === 0 && !S.practice && S.dist < SEG * 400) text('A/D STEER  W BOOST  S BRAKE' + (S.solo ? '  J/CLICK THROW' : '') + '  DRIVE THROUGH COINS', W / 2, 50, '#fff', 1, 'center');
  if (S.youDrive > 0) text("YOU'RE DRIVING NOW!", W / 2, 100, Math.floor(S.t * 6) % 2 ? '#ffd23f' : '#fff', 2, 'center');
  if (!S.solo && mySeat() > 0 && S.mode === 'drive') text('YOU: ' + SEAT_NAMES[mySeat()] + '  J/CLICK THROW  K GRAB  H HIT', W / 2, H - 22, '#9f8fc0', 1, 'center');
  // banner
  if (S.banner) {
    ctx.globalAlpha = Math.min(1, S.banner.t * 2);
    ctx.fillStyle = '#1a1026'; ctx.fillRect(0, 60, W, S.banner.sub ? 32 : 20);
    text(S.banner.txt, W / 2, 64, S.banner.col, 2, 'center');
    if (S.banner.sub) text(S.banner.sub, W / 2, 80, '#fff', 1, 'center');
    ctx.globalAlpha = 1;
  }
  if (S.practice && S.pstep < PSTEPS.length) {
    ctx.fillStyle = 'rgba(26,16,38,0.85)'; ctx.fillRect(40, 30, W - 80, 26);
    text('TEST DRIVE ' + (S.pstep + 1) + '/' + PSTEPS.length + ': ' + PSTEPS[S.pstep][0], W / 2, 33, '#8ef0b0', 1, 'center');
    text(PSTEPS[S.pstep][1], W / 2, 43, '#fff', 1, 'center');
    text('TAB: SKIP TEST DRIVE', W - 4, H - 16, '#9f8fc0', 1, 'right');
  }
  if (S.scramble > 0) text('CONTROLS SCRAMBLED ' + S.scramble.toFixed(1), W / 2, 96, '#ff3b3b', 1, 'center');
  if (S.paused && !S.net) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    text('PAUSED', W / 2, 70, '#fff', 3, 'center'); text('ESC: RESUME   Q: BAIL OUT OF DRIVE', W / 2, 100, '#ffd23f', 1, 'center');
  }
}

function drawPick() {
  ctx.fillStyle = '#1e1030'; ctx.fillRect(0, 0, W, H);
  text('PICK YOUR RIDE', W / 2, 10, '#8ef0b0', 3, 'center');
  const opts = [
    ['THE HOTBOX', 'CREW VAN. STEADY.', 'HANDLES OK WHEN BAKED.'],
    ["TAYLOR'S SHITBOX", "'95 ACURA TL. FASTER,", 'TWITCHY. BACKFIRES.'],
  ];
  opts.forEach((o, i) => {
    const x = 20 + i * 150, sel = S.pickSel === i;
    ctx.fillStyle = sel ? '#3a2a58' : '#2a1f40'; ctx.fillRect(x, 40, 130, 120);
    if (sel) { ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, 41, 128, 118); }
    const saveCar = S.car; S.car = i ? 'shitbox' : 'van';
    const oldT = S.t; S.speed = 0; S.x = 0; S.lastSteer = 0; S.damage = i ? 3 : 0; S.fx = [];
    ctx.save(); ctx.translate(x + 65 - W / 2, 110 - 184); drawPlayer(); ctx.restore();
    S.car = saveCar; S.t = oldT;
    text(o[0], x + 65, 120, sel ? '#ffd23f' : '#fff', 1, 'center');
    text(o[1], x + 65, 134, '#c8c8e0', 1, 'center'); text(o[2], x + 65, 142, '#c8c8e0', 1, 'center');
  });
  if (!S.net) text('A/D OR CLICK TO PICK   SPACE TO GO', W / 2, 172, '#9f8fc0', 1, 'center');
  else {
    const v = Object.entries(S.votes).map(([id, c]) => nameOf(id) + ':' + (c === 'shitbox' ? 'SHITBOX' : 'VAN')).join('  ');
    text(S.voted ? 'VOTED! ' + v : 'VOTE: A/D + SPACE OR CLICK   ' + Math.max(0, Math.ceil(S.voteT)) + 'S', W / 2, 168, S.voted ? '#8ef0b0' : '#ffd23f', 1, 'center');
    text('NO VOTES OR A TIE = THE VAN', W / 2, 178, '#9f8fc0', 1, 'center');
  }
}
function drawCard() {
  ctx.fillStyle = '#1e1030'; ctx.fillRect(0, 0, W, H);
  text('HOTBOX HIGHWAY', W / 2, 10, '#8ef0b0', 3, 'center');
  text((S.car === 'shitbox' ? "TAYLOR'S SHITBOX" : 'THE HOTBOX') + '  -  ' + (S.world || '').toUpperCase(), W / 2, 34, '#ffd23f', 1, 'center');
  const seat = mySeat();
  const lines = seat === 0 ? [
    S.solo ? 'YOU ARE DRIVING (SOLO)' : 'YOU ARE DRIVING!',
    'A/D  STEER      W/SPACE  BOOST     S  BRAKE',
    S.solo ? 'J/CLICK  THROW SNACK AT NEAREST COP' : 'YOUR CREW THROWS SNACKS. YOU DRIVE.',
    'DRIVE THROUGH COINS. CRASHES SPILL THEM!',
    S.solo ? 'CARS, CONES, POTHOLES, OIL + COPS COST COINS' : 'SEATS SWAP HALFWAY. BE READY.',
    'H  TAKE A HIT (+COOKED, WOBBLIER, COINS WORTH MORE)',
    'ESC  PAUSE',
    '',
    'GAS MONEY: ' + (12 + 3 * Math.max(0, ['park', 'beach', 'suburb', 'city', 'downtown', 'woods', 'hq'].indexOf(S.world))) + ' COINS. EARN IT BACK OR LOSE OUT.',
  ] : [
    'YOU: ' + SEAT_NAMES[seat] + '   DRIVER: ' + nameOf(S.seats[0]),
    'J OR CLICK  THROW SNACKS AT COPS ON YOUR SIDE',
    seat === 2 ? 'YOU AIM THROUGH THE REAR-VIEW MIRROR' : S.crew.length === 2 ? 'YOU COVER BOTH SIDES + THE MIRROR (CLICK TO AIM)' : S.crew.length === 3 ? 'CLICK THE MIRROR TO HIT COPS BEHIND' : 'WATCH FOR ARROWS ON YOUR SIDE',
    'K  GRAB COINS THE DRIVER MISSES (WIDE REACH)',
    'H  TAKE A HIT (+COOKED FOR YOU)',
    '',
    'SEATS SWAP HALFWAY. YOU MIGHT END UP DRIVING.',
  ];
  lines.forEach((l, i) => text(l, W / 2, 56 + i * 12, i === 0 ? '#8ef0b0' : '#fff', 1, 'center'));
  text(S.net ? 'STARTING IN ' + Math.max(1, Math.ceil(S.cardT)) : 'PRESS SPACE TO START', W / 2, 170, Math.floor(S.t * 3) % 2 ? '#ffd23f' : '#fff', 1, 'center');
}
function drawResults() {
  const r = S.res;
  ctx.fillStyle = '#1e1030'; ctx.fillRect(0, 0, W, H);
  text('DRIVE COMPLETE', W / 2, 8, '#8ef0b0', 3, 'center');
  const rows = [
    ['CREW SCORE', r.score], ['GAS MONEY', '-' + (r.gas || 0)], ['EARNED (EACH)', '+' + r.coins + (r.lost ? '  (SPILLED ' + r.lost + ')' : '')], ['NET', ((r.coins - (r.gas || 0)) >= 0 ? '+' : '') + (r.coins - (r.gas || 0))], ['COPS SHAKEN', r.shaken[0] + r.shaken[1]], ['TIMES BUSTED', r.caught],
    ['ROUTE', r.route.toUpperCase() + (r.secret ? ' + SECRET' : '')], ['SNACKS LEFT', r.snacks + ' -> ' + r.munchies + ' MUNCHIES'],
  ];
  rows.forEach((x, i) => { const net = x[0] === 'NET'; text(x[0], 40, 30 + i * 9, '#c8c8e0'); text(String(x[1]), 180, 30 + i * 9, net ? (String(x[1])[0] === '+' ? '#8ef0b0' : '#ff6b6b') : '#fff'); });
  const d0 = r.drivers[0] ? ' (' + r.drivers[0] + ')' : '', d1 = r.drivers[1] ? ' (' + r.drivers[1] + ')' : '';
  text('1ST HALF' + d0 + '  CRASH ' + r.crashes[0] + '  SHAKEN ' + r.shaken[0], 40, 106, '#9f8fc0');
  text('2ND HALF' + d1 + '  CRASH ' + r.crashes[1] + '  SHAKEN ' + r.shaken[1], 40, 114, '#9f8fc0');
  r.awards.forEach((a, i) => text('* ' + a, W / 2, 126 + i * 8, '#ffd23f', 1, 'center'));
  if (r.buff) text('HIGH SCORE BUFF: ' + (r.buff === 'cooked10' ? '+10% COOKED' : '10S SODA SPEED'), W / 2, 162, '#8ef0b0', 1, 'center');
  if (S.t - S.resT > 1) text('SPACE TO CONTINUE', W / 2, 180, '#fff', 1, 'center');
}

// ---------------- public ----------------
function driveKey(a, b) { return Math.min(a, b) + '-' + Math.max(a, b); }
function needsDrive(save, from, to, isShopOrFarm) {
  if (isShopOrFarm) return 'none';
  const d = (save && save.drives) || {};
  return d[driveKey(from, to)] ? 'ask' : 'drive';
}
window.Drive = { _debug: () => S, onNet, _deliver: (from, p) => deliver(from, p), playerLeft: id => S && playerLeft(id), start, stop: () => S && stop(), isRunning: () => !!S, needsDrive };

// NET messages (all { t:'d', k, p }; server relays + stamps id; 'to' = send to one player):
//   vote {car}            everyone -> host, during PICK YOUR RIDE (5s, no votes/tie = van)
//   start {car,seats,seed,crew}  host -> all. Road is generated from seed, so it's identical everywhere.
//   in {a:'throw'|'grab'|'hit'|'tap', aim}   havoc player -> current driver (to)
//   st {...snapshot}      driver -> all, 10x per second
//   swap {ev,seats,full}  driver -> all at the mid-drive swap; the new driver loads 'full' and takes over
//   end {res}             driver -> all
// Also pass the room's 'pl' (player left) and 'host' messages to Drive.onNet.
})();
