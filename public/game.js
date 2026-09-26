// KUSH QUEST - Road to the Farm
// A cozy retro co-op platformer for up to 4 friends online.
// Plain JavaScript + <canvas>, no engine. All art is drawn in code as pixel arrays.
'use strict';
(() => {

const W = 320, H = 192, T = 16, ROWS = 12;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
function fit() {
  let s = Math.min(innerWidth / W, innerHeight / H);
  if (s >= 1) s = Math.floor(s);
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
}
addEventListener('resize', fit); fit();

// ============================================================
//  BITMAP FONT (3x5)
// ============================================================
const FONT = {};
Object.assign(FONT, {"A": "010101111101101", "B": "110101110101110", "C": "011100100100011", "D": "110101101101110", "E": "111100110100111", "F": "111100110100100", "G": "011100101101011", "H": "101101111101101", "I": "111010010010111", "J": "001001001101010", "K": "101101110101101", "L": "100100100100111", "M": "101111111101101", "N": "110101101101101", "O": "010101101101010", "P": "110101110100100", "Q": "010101101110011", "R": "110101110101101", "S": "011100010001110", "T": "111010010010010", "U": "101101101101111", "V": "101101101101010", "W": "101101111111101", "X": "101101010101101", "Y": "101101010010010", "Z": "111001010100111", "0": "111101101101111", "1": "010110010010111", "2": "110001010100111", "3": "110001010001110", "4": "101101111001001", "5": "111100110001110", "6": "011100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001110", " ": "000000000000000", "!": "010010010000010", ":": "000010000010000", "-": "000000111000000", ".": "000000000000010", "?": "110001010000010", "/": "001001010100100", "+": "000010111010000", "'": "010010000000000", "#": "101111101111101", "x": "000101010101000", ",": "000000000010100", "(": "010100100100010", ")": "010001001001010", "%": "101001010100101"});
function drawStr(s, x, y, col, sc) {
  ctx.fillStyle = col;
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]]; if (!g) continue;
    for (let j = 0; j < 15; j++) if (g[j] === '1') ctx.fillRect(x + i * 4 * sc + (j % 3) * sc, y + Math.floor(j / 3) * sc, sc, sc);
  }
}
function text(str, x, y, col = '#fff', sc = 1, align = 'left') {
  str = String(str).toUpperCase().replace(/[^A-Z0-9 !:\-.?/+'#,()%]/g, ' ');
  const w = str.length * 4 * sc - sc;
  if (align === 'center') x -= Math.floor(w / 2); else if (align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  drawStr(str, x + sc, y + sc, '#2a1838', sc); drawStr(str, x, y, col, sc);
}

// ============================================================
//  SOUND (tiny chiptune synth)
// ============================================================
let AC = null, master = null, musicOn = true, noiseBuf = null;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.6; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
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
function noise(dur, vol, when, freq = 6000) {
  if (!AC) return;
  const s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  s.connect(f).connect(g).connect(master); s.start(when); s.stop(when + dur);
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const SFX = {
  jump: () => tone(360, 0.14, 'square', 0.045, 0, 1.8),
  flap: () => { tone(520, 0.08, 'triangle', 0.07, 0, 1.4); if (AC) noise(0.06, 0.03, AC.currentTime, 2000); },
  coin: (c = 0) => { const k = Math.pow(2, Math.min(c, 12) / 12); tone(988 * k, 0.05, 'square', 0.04); tone(1319 * k, 0.14, 'square', 0.04, 0.05); },
  nug: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.12, 'square', 0.045, i * 0.06)),
  ring: () => tone(880, 0.15, 'triangle', 0.08, 0, 1.5),
  stomp: () => tone(220, 0.12, 'square', 0.08, 0, 0.4),
  hit: () => tone(300, 0.07, 'square', 0.06, 0, 0.6),
  bump: () => tone(120, 0.08, 'triangle', 0.1),
  hurt: () => tone(400, 0.35, 'sawtooth', 0.05, 0, 0.25),
  steal: () => [1200, 900, 600].forEach((f, i) => tone(f, 0.07, 'square', 0.04, i * 0.05)),
  karen: () => tone(700, 0.25, 'sawtooth', 0.03, 0, 1.3),
  exhale: () => { if (AC) noise(0.25, 0.08, AC.currentTime, 800); tone(300, 0.2, 'triangle', 0.06, 0, 0.5); },
  attack: k => { if (!AC) return; if (k === 0) noise(0.18, 0.06, AC.currentTime, 1200); else if (k === 1) noise(0.2, 0.08, AC.currentTime, 400); else if (k === 2) tone(900, 0.08, 'sine', 0.08, 0, 0.5); else if (k === 3) tone(500, 0.2, 'triangle', 0.06, 0, 2); else tone(200, 0.3, 'sawtooth', 0.04, 0, 3); },
  munch: () => [392, 523, 659, 523, 784].forEach((f, i) => tone(f, 0.08, 'triangle', 0.1, i * 0.05)),
  power: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.1, 'square', 0.045, i * 0.07)),
  star: () => [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, 'square', 0.045, i * 0.05)),
  flag: () => [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.045, i * 0.09)),
  cp: () => { tone(784, 0.1, 'square', 0.05); tone(1047, 0.2, 'square', 0.05, 0.1); },
  tick: () => tone(660, 0.03, 'square', 0.04),
  buy: () => { tone(1047, 0.08, 'square', 0.05); tone(1568, 0.2, 'square', 0.05, 0.08); },
};
// bouncy, cozy loop (C - Am - F - G) with a dreamy melody
function startMusic() {
  const step = 60 / 96 / 2;
  const chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];
  const bass = [[48, -1, 55, -1, 48, 52, 55, 52], [45, -1, 52, -1, 45, 48, 52, 48], [41, -1, 48, -1, 41, 45, 48, 45], [43, -1, 50, -1, 43, 47, 50, 53]];
  const mel = [[76, -1, 79, 76, 72, -1, 74, 76], [72, -1, -1, 69, 72, -1, 76, -1], [77, -1, 76, 74, 72, -1, 69, 72], [74, -1, 71, -1, 67, -1, -1, -1]];
  let next = AC.currentTime + 0.1, i = 0;
  setInterval(() => {
    while (next < AC.currentTime + 0.3) {
      if (musicOn) {
        const bar = Math.floor(i / 8) % 4, s = i % 8, section = Math.floor(i / 32) % 2, dt = next - AC.currentTime;
        if (bass[bar][s] > 0) tone(midi(bass[bar][s]), step * 0.9, 'triangle', 0.12, dt);
        if (s % 2 === 1) chords[bar].forEach(n => tone(midi(n), step * 0.4, 'square', 0.014, dt));
        noise(s % 2 ? 0.04 : 0.02, s % 2 ? 0.04 : 0.015, next);
        if (section === 1 && mel[bar][s] > 0) tone(midi(mel[bar][s]), step * 1.3, 'square', 0.022, dt);
      }
      next += step; i++;
    }
  }, 50);
}

// ============================================================
//  INPUT
// ============================================================
const K = { left: false, right: false, up: false, down: false, jump: false, run: false, attack: false, enter: false };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'jump', KeyZ: 'jump', KeyL: 'jump',
  ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'attack', KeyJ: 'attack', KeyK: 'attack', Enter: 'enter'
};
function press(k, down) {
  if (down && !K[k]) { if (k === 'jump') K.jumpPressed = true; if (k === 'enter') K.enterPressed = true; if (k === 'attack') K.attackPressed = true; }
  K[k] = down;
}
addEventListener('keydown', e => {
  if (!running) return;
  const c = e.code;
  if (c === 'ArrowUp' || c === 'KeyW') K.upPressed = true;
  if (c === 'ArrowDown' || c === 'KeyS') K.downPressed = true;
  if (state === 'results' && (c === 'ArrowUp' || c === 'ArrowDown' || c === 'KeyW' || c === 'KeyS' || c === 'Space')) { e.preventDefault(); if (c === 'Space') press('jump', true); return; }
  if (c === 'KeyM') { musicOn = !musicOn; return; }
  if ((c === 'KeyP' || c === 'Escape') && !Net.online && state !== 'results') { paused = !paused; return; }
  if ((c === 'KeyI' || c === 'Tab') && state !== 'results') { e.preventDefault(); invOpen = !invOpen; return; }
  if (state === 'play') {
    if (/^Digit[1-5]$/.test(c)) { selectWeapon(+c[5] - 1); return; }
    if (c === 'KeyQ') { cycleWeapon(1); return; }
    if (c === 'KeyC') { useMunchies(); return; }
    const em = { Digit7: 0, Digit8: 1, Digit9: 2, Digit0: 3 }[c]; if (em !== undefined) { emote(em); return; }
  }
  const k = KEYMAP[c]; if (!k) return;
  e.preventDefault(); press(k, true);
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) press(k, false); });
addEventListener('blur', () => { for (const k in K) K[k] = false; });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (k === 'inv') { invOpen = !invOpen; return; }
    if (state === 'results') { if (k === 'left' || k === 'up') K.upPressed = true; else if (k === 'right' || k === 'down') K.downPressed = true; else K.enterPressed = true; return; }
    if (state === 'sitting' && k === 'jump') K.enterPressed = true;
    press(k, true);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { if (k !== 'inv') press(k, false); }));
});

// ============================================================
//  PALETTE + PIXEL ART
// ============================================================
const P = {
  k:'#2a1838', s:'#ffd9b8', S:'#e8a888', g:'#3fae5a', G:'#7fe07a', L:'#c8ffa0', y:'#ffd84a', Y:'#fff6b0',
  O:'#d8961a', r:'#ff5a6a', R:'#c83048', o:'#ff9a3a', w:'#ffffff', W:'#e8e4f4', d:'#3a6ad8', D:'#28448e',
  E:'#8a8aa8', e:'#5a5a78', p:'#c070ff', q:'#8a40c8', n:'#9a6a42', N:'#6a4428', m:'#b0a8c0', M:'#7a7290',
  c:'#ff9ab8', h:'#f0d060', H:'#c8a030', t:'#c87a3a', T:'#8a5024', u:'#ffb8d8', v:'#7ac8ff'
};
function sprite(rows, pal = P) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const col = pal[r[i]]; if (col) { g.fillStyle = col; g.fillRect(i, j, 1, 1); } } });
  return c;
}
// white silhouette of a sprite (hit flash)
function flashOf(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  return c;
}

// --- players: the homies (chibi stoner dudes, a different look per player slot) ---
const C16 = s => { const pad = 16 - s.length, l = Math.floor(pad / 2); return '.'.repeat(l) + s + '.'.repeat(pad - l); };
const LOOKS = [
  { name: 'RASTA', pal: { s: '#b87a4a', S: '#8a5530', b: '#3fae5a', B: '#2a7a3a', d: '#3a3a5a', h: '#2a1838' },
    hat: ['kkkkkk', 'kggyyrrk', 'kgggyyyrrk', 'kkkkkkkkkkkk'], side: 'h' },
  { name: 'SNAPBACK', pal: { s: '#ffd9b8', S: '#e0a888', b: '#ffffff', B: '#c8c4d8', d: '#3a6ad8', h: '#6a4428' },
    hat: ['kkkkkk', 'krrrrrrk', 'krrrrwrrrk', 'kkkkkkkkkkkkkk'], side: null },
  { name: 'BUCKET', pal: { s: '#e8a878', S: '#c07a50', b: '#ff9ab8', B: '#c070ff', d: '#3a3a5a', h: '#9a6a42' },
    hat: ['kkkkkk', 'kppppppk', 'kppGppppk', 'kkppppppppppkk'], side: null },
  { name: 'AFRO', pal: { s: '#7a4a2a', S: '#5a3018', b: '#ff9a3a', B: '#c86a1a', d: '#2a1838', h: '#2a1838', E: '#8a8aa8' },
    hat: ['hhhhhh', 'hhhhhhhhhh', 'hhhhhhhhhhhh', 'hhhhhhhhhhhh'], side: 'E' },
];
const SHIRTS = LOOKS.map(l => l.pal.b === '#ffffff' ? '#ff5a6a' : l.pal.b);
function homieRows(look, pose) {
  const side = look.side, wrap = (inner, sd = side) => C16(sd ? sd + 'k' + inner + 'k' + sd : 'k' + inner + 'k');
  const face = [wrap('ssssssss'), wrap('sSssssSs'), wrap('skssssks'), wrap('ssskksss', null), C16('kssssssk')];
  let body = [C16('kbbbbbbk'), C16('kbbbbbbbbk'), C16('ksbbbbbbbbsk'), C16('ksbBbbbbBbsk'), C16('kbbbbbbbbk')];
  if (pose === 'jump') body = [C16('kbbbbbbk'), C16('skbbbbbbbbks'), C16('kbbbbbbbbk'), C16('kbBbbbbBbk'), C16('kbbbbbbbbk')];
  if (pose === 'attack') body[2] = '..ksbbbbbbbbksss';
  const legs = {
    stand: [C16('kddddddk'), C16('kddkkddk'), C16('kdk..kdk'), C16('kkk..kkk')],
    walk1: [C16('kddddddk'), C16('kddk..kddk'), C16('kdk....kdk'), C16('kkk....kkk')],
    walk2: [C16('kddddddk'), C16('kddddk'), C16('kdkkdk'), C16('kkkkkk')],
    jump: [C16('kddddddk'), C16('kdk..kdk'), C16('kk....kk'), C16('')],
  }[pose === 'attack' || pose === 'float' ? 'stand' : pose];
  return [...look.hat.map(C16), ...face, ...body, ...legs];
}
// frames: 0 stand, 1 walk, 2 walk2, 3 jump, 4 float (drawn on a smoke cloud), 5 attack
const PLAYER = LOOKS.map(look => {
  const pal = { ...P, ...look.pal };
  return ['stand', 'walk1', 'walk2', 'jump', 'float', 'attack'].map(pose => sprite(homieRows(look, pose), pal));
});
const BODY_COLORS = LOOKS;

// --- enemies ---
const COP_ROWS = [
  '....kkkkkkk.....',
  '...kdddddddk....',
  '..kdddyydddk....',
  '.kkkkkkkkkkkkk..',
  '..kssssssssk....',
  '..kskkssskksk...',
  '..ksssssssssk...',
  '..kssNNNNNssk...',
  '...kssssssk.....',
  '....kkkkkk......',
  '..kkdddddddkk...',
  '.kddddyddddddk..',
  '.kdkdddddddkdk..',
  '.kskdddddddksk..',
  '..kkDDDDDDDkk...',
  '...kDDk.kDDk....',
  '...kDDk.kDDk....',
  '..kkkkk.kkkkk...',
];
const COP_BATON = COP_ROWS.map((r, i) => i === 12 ? '.kdkdddddddkdkkk' : i === 13 ? '.kskdddddddkskEk' : i === 11 ? '.kddddyddddddkkE' : r);
const KAREN_ROWS = [
  '....kkkkkkk.....',
  '..kkhhhhhhhkk...',
  '.khhhhhhhhhhhk..',
  '.khhhHhhhhhhhhk.',
  '.khhkssssssshhk.',
  '.khkkskkskkskhk.',
  '.khskskkskksshk.',
  '..kssssssssshk..',
  '..kssskkkksshk..',
  '...ksssssssk....',
  '....kkkkkkk.....',
  '...kppppppppk...',
  '..kpppqpppppk...',
  '..kpkppppppkpk..',
  '..kskppppppksk..',
  '...kpppppppk....',
  '....kmk.kmk.....',
  '...kkkk.kkkk....',
];
const MOUSE_ROWS = [
  '.kk.........',
  'kuuk..kk....',
  'kukkkkmmk...',
  '.kmmmmmmmk..',
  'kwkmmmmmmmk.',
  'kkmmmmmmmmkk',
  '.kMMkkkMMkk.k',
  '..kk...kk..k.',
];
const SQUIRREL_ROWS = [
  '.........kkk..',
  '..kk....kttTk.',
  '.kttk..kttttTk',
  'kttwkk.kttttTk',
  'kttkttk.ktttTk',
  'kyttttk.ktttk.',
  '.kttttkkttttk.',
  '..kttyytttk...',
  '..ktyyyttk....',
  '...ktttttk....',
  '..kTk..kTk....',
  '..kk...kk.....',
];
const ENEMY_IMG = {
  cop: [sprite(COP_ROWS), sprite(COP_BATON)],
  karen: [sprite(KAREN_ROWS), sprite(KAREN_ROWS.map((r, i) => i === 13 ? '.kkpkppppppkpk..' : i === 14 ? '.ksk.ppppppksk..' : r))],
  mouse: [sprite(MOUSE_ROWS), sprite(MOUSE_ROWS.map((r, i) => i === 6 ? '.kMMkkMMkkk.k' : i === 7 ? '...kk.kk...k.' : r))],
  squirrel: [sprite(SQUIRREL_ROWS), sprite(SQUIRREL_ROWS.map((r, i) => i === 10 ? '.kTk....kTk...' : i === 11 ? '.kk.....kk....' : r))],
};
const ENEMY_FLASH = {};
for (const k in ENEMY_IMG) ENEMY_FLASH[k] = ENEMY_IMG[k].map(flashOf);

// --- pickups & icons ---
const COIN = sprite([
  '..kkkkkk..',
  '.kYyyyyyk.',
  'kYyOyOyyyk',
  'kyOOOOOyyk',
  'kyyOyOyyOk',
  'kyOOOOOyOk',
  'kyyOyOyyOk',
  '.kyyyyyOk.',
  '..kkkkkk..',
]);
const NUG = sprite([
  '....G....',
  '...GgGk..',
  '..GgoGGk.',
  '.GGpGgoGk',
  '.gGGoGpGk',
  '.GoGgGGgk',
  '..gGGpGk.',
  '...kggk..',
  '....kk...',
]);
const RING = sprite([
  '..WWWW..',
  '.W....W.',
  'W......W',
  'W......W',
  '.W....W.',
  '..WWWW..',
], { W: 'rgba(255,255,255,.85)' });
const MUNCHIE = sprite([
  'kkkkkkkkk',
  'kNNNNNNNk',
  '.kyryyyk.',
  '.kyyyryk.',
  '..kryyk..',
  '..kyyyk..',
  '...kyk...',
  '...kk....',
]);
const HEART = sprite(['.kk.kk.', 'krrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']);
const HEART_E = sprite(['.kk.kk.', 'keekeek', 'keeeeek', '.keeek.', '..kek..', '...k...']);
const HEART_A = sprite(['.kk.kk.', 'kvvkvvk', 'kvvvvvk', '.kvvvk.', '..kvk..', '...k...']);
const LEAF_ROWS = [
  '......G......',
  '.....GLG.....',
  '..G..GLG..G..',
  '..GG.GLG.GG..',
  '...GGGLGGG...',
  'G...GGLGG...G',
  'GGG..GLG..GGG',
  '.GGGGGLGGGGG.',
  '...GGGgGGG...',
  '.....GgG.....',
  '......g......',
  '......g......',
  '......g......',
];
const PLANT = sprite(LEAF_ROWS, { ...P, G: '#58b85a', L: '#98e080', g: '#327a3a' });
const LEAF_ICON = sprite(['...G...', '..GLG..', 'G.GLG.G', 'GGGLGGG', '.GGLGG.', '...g...', '...g...']);
const GOLD_LEAF = sprite(['....G....', '...GLG...', 'G..GLG..G', 'GG.GLG.GG', '.GGGLGGG.', '..GGLGG..', 'GGGGgGGGG', '....g....', '....g....'], { ...P, G: '#ffd84a', L: '#fff6b0', g: '#d8961a' });
const CHEST = sprite([
  '..kkkkkkkkkk..',
  '.kttttttttttk.',
  'ktTTTTTTTTTTtk',
  'kkkkkkyykkkkkk',
  'kttttkYykttttk',
  'kttttkkkkttttk',
  'ktttttttttttTk',
  'kTTTTTTTTTTTTk',
  '.kkkkkkkkkkkk.',
]);
const CHEST_OPEN = sprite([
  '.kkkkkkkkkkkk.',
  'kTTTTTTTTTTTTk',
  'kkkkkkkkkkkkkk',
  '..............',
  'kkkkkkkkkkkkkk',
  'kttttttttttttk',
  'ktttttttttttTk',
  'kTTTTTTTTTTTTk',
  '.kkkkkkkkkkkk.',
]);
const ICONS = {
  puff: sprite(['...kkk....', '..kwwwk...', '.kwwwwwkk.', 'kwwwwwwwwk', 'kwwWwwwwwk', '.kwwwWwwk.', '..kkkkkk..']),
  lighter: sprite(['....o.....', '...oyo....', '...oyo....', '....k.....', '..kkkkk...', '..kEEEk...', '..krrrk...', '..krrrk...', '..krrrk...', '..kkkkk...']),
  bong: sprite(['...kk.....', '...kvk....', '...kvk.kk.', '...kvkkEk.', '..kvvvkk..', '.kvGGGvk..', '.kvGGGvk..', '..kkkkk...']),
  boomer: sprite(['kkkkkkkkk.', 'kwwwwwwwk.', 'kwWwWwWwk.', 'kwwwwwwwk.', 'kkkkkkkkk.']),
  grinder: sprite(['..kkkkk...', '.kGGGGGk..', 'kGkGkGkGk.', 'kmmmmmmmk.', 'kMkMkMkMk.', 'kmmmmmmmk.', '.kkkkkkk..']),
  hoodie: sprite(['..kkkkk...', '.kgggggk..', 'kggkkkggk.', 'kgGgggGgk.', 'kgggggggk.', 'kgGGkGGgk.', 'kgggggggk.', '.kkkkkkk..']),
  vest: sprite(['.kk...kk..', 'kpok.kyrk.', 'kGyrkpGok.', 'kopGyroyk.', 'kyrpoGpok.', 'kGoyrpyGk.', '.kkkkkkk..']),
  crown: sprite(['k..k..k...', 'kk.k.kk...', 'krkkkykk..', 'kryyyGGk..', 'kGGrryyk..', '.kkkkkkk..']),
  pouch: sprite(['..kkkk....', '.kNkkNk...', 'kttttttk..', 'kttyyttk..', 'ktyOOytk..', 'kttyyttk..', '.kkkkkk...']),
  munchie: MUNCHIE,
  preroll: sprite(['........o.', '.......oy.', 'kkkkkkkkk.', 'kwwwwwwwk.', 'kkkkkkkkk.']),
  gold: GOLD_LEAF,
  farm: sprite(['....kk......', '...krrk.....', '..krrrrk....', '.krrrrrrk...', 'kkkkkkkkkk..', '.kwwkkwwk...', '.kwwkNkwk...', '.kkkkNkkk...', 'GLGLGLGLGL..', 'gGgGgGgGgG..']),
};

// --- oversized held weapons ---
const HELD = {
  puff: sprite([ // giant joint
    '....................kk..',
    '..................kkook.',
    'kkkkkkkkkkkkkkkkkkoyyrk.',
    'kWwwwwwwwwwwwwwwwwwoyrk.',
    'kwwwwwwwwwwwwwwwwwwyyrk.',
    'kkkkkkkkkkkkkkkkkkkoork.',
    '..................kkkk..',
  ]),
  lighter: sprite([
    '...kkk...',
    '..kEEEk..',
    '..kEkEk..',
    'kkkkkkkkk',
    'krrrrrrRk',
    'krwrrrrRk',
    'krwrrrrRk',
    'krrrrrrRk',
    'krrrrrrRk',
    'krrrrrrRk',
    'krrrrrrRk',
    'kkkkkkkkk',
  ]),
  bong: sprite([
    '..kkkk......',
    '..kvvk......',
    '..kvvk......',
    '..kvvk......',
    '..kvvk.kk...',
    '..kvvk.kEk..',
    '..kvvkkEk...',
    '.kvvvvvkk...',
    'kvvvvvvvk...',
    'kvGGGGGvk...',
    'kvGLGGGvk...',
    'kvGGGGGvk...',
    '.kkkkkkk....',
  ], { ...P, v: '#bfe8ff' }),
  dab: sprite([
    '..........................kk',
    'kkkkkkkkkkkkkkkkkkkkkkkkkkEk',
    'kEEEEEEEEEEEEEEEEEEWWWWWWEk.',
    'kkkkkkkkkkkkkkkkkkkkkkkkkk..',
  ], { ...P, E: '#b8b8d0', W: '#ffffff' }),
  grinder: sprite([
    '...kkkkkk...',
    '..kGGGGGGk..',
    '.kGLGGGGGGk.',
    'kGGkGGkGGkGk',
    'kkkkkkkkkkkk',
    'kmmmmmmmmmmk',
    'kMkMkMkMkMkk',
    'kmmmmmmmmmmk',
    '.kkkkkkkkkk.',
  ]),
};
ICONS.joint = sprite(['.........k', 'kkkkkkkkoy', 'kwwwwwwwyr', 'kkkkkkkkoo']);
ICONS.dab = sprite(['........kk', 'kkkkkkkkEk', 'kEEEEEWWk.', 'kkkkkkkk..'], { ...P, E: '#b8b8d0', W: '#ffffff' });
// --- weapons, armor, shop ---
const WEAPONS = [
  { id: 'puff', name: 'GIANT JOINT', icon: 'joint', dmg: 1, cd: 18, price: 0, desc: 'FREE. SWING A HUGE JOINT. LEAVES SMOKE' },
  { id: 'lighter', name: 'GIANT LIGHTER', icon: 'lighter', dmg: 2, cd: 14, price: 90, desc: 'FLICK IT FOR A FLAME BURST' },
  { id: 'bong', name: 'MEGA BONG', icon: 'bong', dmg: 2, cd: 22, price: 160, desc: 'BIG SMASH + BUBBLE SHOT' },
  { id: 'dab', name: 'DAB TOOL', icon: 'dab', dmg: 2, cd: 10, price: 200, desc: 'LONG FAST STABS' },
  { id: 'grinder', name: 'GIANT GRINDER', icon: 'grinder', dmg: 3, cd: 36, price: 280, desc: 'SPIN IT ALL AROUND YOU' },
];
const ARMORS = [
  { id: 'hoodie', name: 'COMFY HOODIE', icon: 'hoodie', hp: 1, price: 70, desc: '+1 MAX HEART' },
  { id: 'vest', name: 'TIE-DYE VEST', icon: 'vest', hp: 2, price: 170, desc: '+2 MAX HEARTS' },
  { id: 'crown', name: 'RASTA CROWN', icon: 'crown', hp: 3, price: 300, desc: '+3 MAX HEARTS' },
];
const FARM_PRICE = 1500, SPOTS_TO_FARM = 6;
const SHOP = [
  ...WEAPONS.slice(1).map(w => ({ kind: 'weapon', ...w })),
  ...ARMORS.map(a => ({ kind: 'armor', ...a })),
  { kind: 'item', id: 'pouch', name: 'STASH POUCH', icon: 'pouch', price: 130, desc: 'MICE + SQUIRRELS CANT STEAL' },
  { kind: 'use', id: 'munchie', name: 'MUNCHIES', icon: 'munchie', price: 25, desc: 'HEAL 2 HEARTS - PRESS C (MAX 3)' },
  { kind: 'use', id: 'preroll', name: 'PRE-ROLL', icon: 'preroll', price: 40, desc: 'START NEXT MISSION 40% COOKED' },
  { kind: 'use', id: 'gold', name: 'GOLDEN LEAF', icon: 'gold', price: 75, desc: 'START NEXT MISSION INVINCIBLE' },
  { kind: 'farm', id: 'farm', name: 'THE POT FARM', icon: 'farm', price: FARM_PRICE, desc: 'THE DREAM. REACH ' + SPOTS_TO_FARM + ' SMOKE SPOTS' },
];
// rare bonus pickups: coins + a special effect
const EXTRAS = {
  shatter: { name: 'SHATTER', coins: 25, buff: 'speed', time: 600, desc: 'ZOOMIES! SPEED BOOST', img: sprite(['...kkk...', '..kYyOk..', '.kYyyyOk.', 'kYyYyyyOk', 'kyyyyOyyk', '.kyOyyyk.', '..kOyyk..', '...kkk...'], { ...P, y: '#ffb84a', Y: '#fff0b0', O: '#d8801a' }) },
  diamond: { name: 'DIAMONDS', coins: 50, cooked: 20, desc: '+50 COINS +20% COOKED', img: sprite(['..kkkkk..', '.kwvvvwk.', 'kvwvvvwvk', '.kvvwvvk.', '..kvvvk..', '...kvk...', '....k....'], { ...P, v: '#9ae8ff', w: '#ffffff' }) },
  kief: { name: 'KIEF', coins: 10, buff: 'magnet', time: 720, desc: 'COIN MAGNET', img: sprite(['.........', '....y....', '...yYy...', '..yYyYy..', '.yyYyyYy.', 'kkkkkkkkk', 'kNNNNNNNk', '.kkkkkkk.'], { ...P, y: '#e8d070', Y: '#fff6c0' }) },
  hash: { name: 'HASH', coins: 20, buff: 'power', time: 720, desc: 'HASH POWER! +1 ATTACK DMG', img: sprite(['.kkkkkkk.', 'kNtNtNtNk', 'ktNtNtNtk', 'kNtNtNtNk', 'ktNtNtNtk', '.kkkkkkk.'], { ...P, t: '#a8703a', N: '#7a4a24' }) },
};
// legendary stoners (original characters) who hang out at checkpoints and share their wisdom + a boost
const LEGEND_PAL = [
  { a: '#6a4428', b: '#ffd84a', c: '#3fae5a' }, { a: '#e8e4f4', b: '#ff9ab8', c: '#7ac8ff' },
  { a: '#2a1838', b: '#c070ff', c: '#ff9a3a' }, { a: '#ffd84a', b: '#7fe07a', c: '#ff5a6a' },
];
const LEGEND_ROWS = [
  '....kkkkkk....',
  '...kcccccck...',
  '..kcbbccbbck..',
  '..kkkkkkkkkk..',
  '..kaassssaak..',
  '..kasksskask..',
  '..kaassssaak..',
  '..kaasSSsaak..',
  '..kaaassaaak..',
  '...kaaaaaak...',
  '....kkkkkk....',
  '...kbbbbbbk...',
  '..kbbccbbbbk..',
  '..kbbbbccbbk..',
  '..ksbbbbbbsk..',
  '...kddddddk...',
  '...kdk..kdk...',
  '..kkkk..kkkk..',
];
const LEGENDS = [
  { name: 'UNCLE HAZE', tip: 'SLOW DOWN LITTLE BUD. THE FARM AINT GOING NOWHERE', gift: 'cooked' },
  { name: 'GRANDMA KUSH', tip: 'EAT SOMETHING HONEY. YOU LOOK THIN', gift: 'heal' },
  { name: 'PROFESSOR BONG', tip: 'TAP JUMP IN THE AIR TO FLOAT. ITS SCIENCE', gift: 'coins' },
  { name: 'CAPTAIN COUCH', tip: 'KARENS HATE WHEN YOU SHOOT THEIR PURSES DOWN', gift: 'cooked' },
  { name: 'DJ DANK', tip: 'CALL THE CREW WITH ENTER AT THE SMOKE SPOT', gift: 'coins' },
  { name: 'COUCH BROS', tip: 'DUDE... WHERE DID WE PARK THE COUCH?', gift: 'heal' },
].map((l, i) => ({ ...l, img: sprite(LEGEND_ROWS, { ...P, ...LEGEND_PAL[i % LEGEND_PAL.length] }) }));
const EMOTES = ['420!', 'NICE!', 'HELP!', 'LOL'];
// ============================================================
//  TILES + THEMES (pastel, rounded, bold outlines)
// ============================================================
const EMPTY = 0, TOP = 1, FILL = 2, BLOCK = 3, BOX = 4, USED = 5, PTL = 6, PTR = 7, PL = 8, PR = 9, GOLDBOX = 10, BOX_NUG = 11;
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
function tileCanvas(fn) { const c = document.createElement('canvas'); c.width = c.height = T; fn(c.getContext('2d')); return c; }
function makeTiles(c) {
  const t = [];
  const fill = g => {
    R(g, c.dirt, 0, 0, 16, 16);
    [[2, 7], [9, 4], [12, 11], [4, 13], [7, 9]].forEach(([x, y]) => { R(g, c.dirtDark, x, y, 2, 2); });
    [[5, 3], [13, 7], [1, 12]].forEach(([x, y]) => R(g, c.dirtLight, x, y, 1, 1));
  };
  t[FILL] = tileCanvas(fill);
  t[TOP] = tileCanvas(g => {
    fill(g);
    R(g, c.top, 0, 0, 16, 6); R(g, c.topLight, 0, 0, 16, 2);
    // scalloped rounded edge
    for (let x = 0; x < 16; x += 4) { R(g, c.top, x, 6, 3, 1); R(g, P.k, x + 3, 6, 1, 1); R(g, P.k, x, 7, 3, 1); }
    R(g, c.topLight, 2, 1, 2, 1); R(g, c.topLight, 10, 1, 3, 1);
  });
  const block = (g, face, light, dark) => {
    R(g, P.k, 1, 0, 14, 16); R(g, P.k, 0, 1, 16, 14);
    R(g, face, 1, 1, 14, 14); R(g, light, 2, 1, 12, 2); R(g, light, 1, 2, 2, 11);
    R(g, dark, 2, 13, 12, 2); R(g, dark, 13, 3, 2, 11);
  };
  t[BLOCK] = tileCanvas(g => { block(g, c.block, c.blockLight, c.blockDark); R(g, c.blockLight, 6, 6, 4, 4); R(g, c.block, 7, 7, 2, 2); });
  t[BOX] = tileCanvas(g => { block(g, '#ffd84a', '#fff6b0', '#d8961a'); g.drawImage(LEAF_ICON, 4, 4); });
  t[BOX_NUG] = t[BOX];
  t[GOLDBOX] = tileCanvas(g => { block(g, '#ffe88a', '#ffffff', '#e0a010'); g.drawImage(GOLD_LEAF, 3, 3); });
  t[USED] = tileCanvas(g => block(g, '#b89a7a', '#d8c0a0', '#8a6a4a'));
  const pipe = (g, left, topPart) => {
    R(g, P.k, 0, 0, 16, 16);
    if (left) { R(g, c.pipe, 2, 0, 14, 16); R(g, c.pipeLight, 4, 0, 3, 16); }
    else { R(g, c.pipe, 0, 0, 14, 16); R(g, c.pipeDark, 8, 0, 6, 16); }
    if (topPart) {
      R(g, P.k, 0, 0, 16, 10);
      if (left) { R(g, c.pipe, 1, 1, 15, 8); R(g, c.pipeLight, 3, 1, 3, 8); } else { R(g, c.pipe, 0, 1, 15, 8); R(g, c.pipeDark, 8, 1, 7, 8); }
    }
  };
  t[PL] = tileCanvas(g => pipe(g, true, false)); t[PR] = tileCanvas(g => pipe(g, false, false));
  t[PTL] = tileCanvas(g => pipe(g, true, true)); t[PTR] = tileCanvas(g => pipe(g, false, true));
  return t;
}
function layer(fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d')); return c; }
const TAU = Math.PI * 2;
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function gradient(g, bands) { const h = Math.ceil(H / bands.length); bands.forEach((c, i) => R(g, c, 0, i * h, W, h)); }
function puffCloud(g, cx, cy, s, col, shade) {
  g.fillStyle = col;
  for (const [dx, dy, r] of [[0, 4, 5], [6, 0, 7], [14, 2, 6], [20, 5, 5], [9, 6, 6]]) {
    const R2 = r * s / 3;
    for (let y = -R2; y <= R2; y++) { const w = Math.sqrt(R2 * R2 - y * y); g.fillRect(Math.round(cx + dx * s / 3 - w), Math.round(cy + dy * s / 3 + y), Math.round(w * 2), 1); }
  }
  if (shade) { g.fillStyle = shade; g.fillRect(cx - 2, Math.round(cy + 9 * s / 3), Math.round(24 * s / 3), 1); }
}
function roundHills(g, base, amp, freq, col, light, outline) {
  for (let x = 0; x < W; x++) {
    const h = base + amp * Math.abs(Math.sin(TAU * x / W * freq));
    R(g, outline, x, H - h - 1, 1, 1); R(g, col, x, H - h, 1, h); R(g, light, x, H - h, 1, 2);
  }
}
const THEMES = {};
// ---- THE PARK (dreamy pastel day) ----
THEMES.park = {
  name: 'THE PARK',
  tiles: makeTiles({ top: '#7fe07a', topLight: '#c8ffa0', dirt: '#e8b888', dirtDark: '#c89060', dirtLight: '#fff0d0', block: '#ff9ab8', blockLight: '#ffd0e0', blockDark: '#d06088', pipe: '#7ac8ff', pipeLight: '#c8ecff', pipeDark: '#4a90d8' }),
  sky: layer(g => { gradient(g, ['#9ad8ff', '#aee0ff', '#c2e8ff', '#d6eeff', '#e8f0ff', '#f6ecfa', '#ffe4f0', '#ffdcea']); }),
  clouds: layer(g => { puffCloud(g, 20, 20, 3, '#ffffff', '#e0e8ff'); puffCloud(g, 140, 44, 2, '#ffffff', '#e0e8ff'); puffCloud(g, 240, 16, 4, '#ffffff', '#e0e8ff'); }),
  far: layer(g => roundHills(g, 60, 26, 2, '#b8e8c8', '#d8f8e0', '#8ac8a0')),
  near: layer(g => {
    roundHills(g, 30, 16, 3, '#8ad890', '#b0f0a8', '#4a9a5a');
    for (let i = 0; i < 5; i++) { // lollipop trees
      const x = 30 + i * 64, y = H - 58 - (i % 2) * 8;
      R(g, '#8a5a3a', x + 7, y + 14, 3, 30);
      g.fillStyle = '#2a1838'; for (let yy = -9; yy <= 9; yy++) { const w = Math.floor(Math.sqrt(90 - yy * yy)); g.fillRect(x + 8 - w, y + 8 + yy, w * 2, 1); }
      g.fillStyle = i % 2 ? '#ffb0d0' : '#98e888'; for (let yy = -8; yy <= 8; yy++) { const w = Math.floor(Math.sqrt(72 - yy * yy)); g.fillRect(x + 8 - w, y + 8 + yy, w * 2, 1); }
      R(g, '#ffffff', x + 4, y + 3, 3, 2);
    }
  }),
  enemies: ['mouse', 'squirrel', 'squirrel', 'karen'],
};
// ---- SUBURBIA (sunset) ----
THEMES.suburb = {
  name: 'SUBURBIA',
  tiles: makeTiles({ top: '#9ae07a', topLight: '#d0ffa8', dirt: '#c8c0d8', dirtDark: '#a098b8', dirtLight: '#f0ecf8', block: '#ffb86a', blockLight: '#ffe0b0', blockDark: '#d07a30', pipe: '#e8e0f0', pipeLight: '#ffffff', pipeDark: '#b0a8c8' }),
  sky: layer(g => {
    gradient(g, ['#6a5ac8', '#8a64c8', '#b070c0', '#d880b0', '#f09aa0', '#ffb890', '#ffd08a', '#ffe0a0']);
    g.fillStyle = '#fff0b0'; for (let y = -16; y <= 16; y++) { const w = Math.floor(Math.sqrt(256 - y * y)); g.fillRect(240 - w, 130 + y, w * 2, 1); }
  }),
  clouds: layer(g => { puffCloud(g, 40, 30, 3, '#ffc8d8', '#f0a0c0'); puffCloud(g, 190, 50, 2, '#ffd8e0', '#f0a0c0'); }),
  far: layer(g => { // house silhouettes
    let x = 0; seed = 5;
    while (x < W) {
      let w = 26 + Math.floor(rnd() * 16); if (x + w > W - 10) w = W - x;
      const h = 26 + Math.floor(rnd() * 16), top = H - 20 - h;
      R(g, '#8a5a9a', x + 2, top, w - 4, h + 20);
      for (let i = 0; i < w / 2; i++) R(g, '#6a4080', x + i, top - i * .6 + 2, w - i * 2, 1);
      if (rnd() < .8) R(g, '#ffd84a', x + 8, top + 8, 4, 4);
      if (rnd() < .6) R(g, '#ffd84a', x + w - 14, top + 8, 4, 4);
      x += w;
    }
  }),
  near: layer(g => {
    R(g, '#ffffff', 0, H - 40, W, 2);
    for (let x = 0; x < W; x += 8) { R(g, '#2a1838', x, H - 46, 5, 30); R(g, '#fff6f0', x + 1, H - 45, 3, 29); }
    for (let i = 0; i < 6; i++) { const x = i * 56 + 10; g.fillStyle = '#5aa86a'; for (let yy = -7; yy <= 7; yy++) { const w = Math.floor(Math.sqrt(49 - yy * yy) * 1.6); g.fillRect(x + 11 - w, H - 24 + yy, w * 2, 1); } }
  }),
  enemies: ['karen', 'karen', 'squirrel', 'mouse', 'cop'],
};
// ---- DOWNTOWN (night) ----
function skyline(g, base, minH, maxH, col, winCol, neon) {
  let x = 0;
  while (x < W) {
    let w = 12 + Math.floor(rnd() * 22); if (x + w > W - 8) w = W - x;
    const h = minH + Math.floor(rnd() * (maxH - minH)), top = H - base - h;
    R(g, col, x, top, w, h + base);
    for (let wy = top + 4; wy < H - base; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rnd() < .35) R(g, winCol, wx, wy, 2, 2);
    if (neon && rnd() < .5) R(g, rnd() < .5 ? '#ff5ad2' : '#7fe07a', x, top, w, 1);
    x += w + (rnd() < .5 ? 2 : 0);
  }
}
THEMES.city = {
  name: 'DOWNTOWN',
  tiles: makeTiles({ top: '#a8a0c8', topLight: '#dcd8f0', dirt: '#4a3a70', dirtDark: '#382a58', dirtLight: '#ffd84a', block: '#7a6ad8', blockLight: '#b0a4ff', blockDark: '#4a3aa0', pipe: '#ff7ac8', pipeLight: '#ffc0e8', pipeDark: '#c84898' }),
  sky: layer(g => {
    seed = 21;
    gradient(g, ['#140c2e', '#1c1038', '#261442', '#32184c', '#401c56', '#52205c', '#6a2a62', '#8a3a66']);
    for (let i = 0; i < 60; i++) R(g, rnd() < .3 ? '#fff6b0' : '#d4c8f8', Math.floor(rnd() * W), Math.floor(rnd() * 110), 1, 1);
    g.fillStyle = '#fff6d0'; for (let y = -12; y <= 12; y++) { const w = Math.floor(Math.sqrt(144 - y * y)); g.fillRect(60 - w, 40 + y, w * 2, 1); }
  }),
  clouds: layer(g => { g.fillStyle = 'rgba(192,112,255,.14)'; for (let i = 0; i < 5; i++) g.fillRect(i * 70, 90 + (i % 2) * 14, 60, 6); }),
  far: layer(g => { seed = 31; skyline(g, 20, 40, 100, '#2a1d4c', 'rgba(255,216,74,.45)', false); }),
  near: layer(g => { seed = 41; skyline(g, 0, 20, 60, '#1f1438', 'rgba(255,216,74,.8)', true); }),
  enemies: ['cop', 'cop', 'mouse', 'karen', 'mouse'],
};
const THEME_ORDER = ['park', 'suburb', 'city'];
function drawLayer(img, factor, camX, drift = 0, yOff = 0) {
  const off = ((camX * factor + drift) % W + W) % W;
  ctx.drawImage(img, -Math.floor(off), yOff); ctx.drawImage(img, W - Math.floor(off), yOff);
}
// ============================================================
//  STAGES (beat-em-up streets: walk left/right AND up/down)
// ============================================================
const FLOOR_Y = 110, ZMAX = 66;                 // screen y of the back edge of the street, depth of the street
const sy = (z, h = 0) => FLOOR_Y + z - h;        // world (z,h) -> screen y (feet)
const MISSION_LOOT = ['lighter', 'hoodie', 'dab', 'vest', 'pouch', 'crown', 'bong', 'grinder'];
function missionName(n) {
  const th = THEMES[THEME_ORDER[n % 3]];
  return ['MISSION ' + (n + 1), th.name + (n >= 3 ? ' REMIX' : '')];
}
let LEN = 0;
function buildLevel(n) {
  const themeKey = THEME_ORDER[n % 3], theme = THEMES[themeKey];
  const diff = Math.min(n, 8);
  let s = 1000 + n * 7919; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rand() * a.length)];
  const rz = () => 6 + Math.floor(rand() * (ZMAX - 12));

  const zoneCount = 5 + Math.min(3, Math.floor(diff / 2));
  LEN = 300 + zoneCount * 430 + 420;
  const items = [], props = [], enemies = [], zones = [], deco = [];
  const item = (kind, x, z, h = 0, sub) => items.push({ id: 'i' + items.length, kind, x, z, h, sub, taken: false });
  const prop = (kind, x, z, drops) => props.push({ id: 'p' + props.length, kind, x, z, hp: kind === 'chest' ? 3 : 2, broken: false, drops, flash: 0 });
  const coinLine = (x, z, k) => { for (let i = 0; i < k; i++) item('coin', x + i * 14, z); };
  const coinArc = (x, z, k) => { for (let i = 0; i < k; i++) item('coin', x + i * 14, z, Math.round(Math.sin(i / (k - 1) * Math.PI) * 26)); };

  // opening stretch
  coinLine(90, 30, 5); prop('crate', 200, 14, ['coin', 'coin', 'coin']);
  item('ring', 250, 40, 10);
  let nugCount = 0;
  for (let zi = 0; zi < zoneCount; zi++) {
    const x0 = 300 + zi * 430;
    const count = 3 + Math.floor(diff * 0.6) + Math.floor(zi / 2) + (zi === zoneCount - 1 ? 2 : 0);
    const ids = [];
    for (let k = 0; k < count; k++) {
      const kind = pick(theme.enemies);
      const hp = { cop: 5 + Math.floor(diff / 3), karen: 3, mouse: 1, squirrel: 2 }[kind];
      ids.push(enemies.length);
      enemies.push({ id: enemies.length, kind, zone: zi, hp, maxHp: hp, x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, dir: -1, state: 0, t: 0, cd: 60 + Math.floor(rand() * 60), flash: 0, spawned: false, alive: true, stolen: 0, tx: 0, tz: 0, th: 0 });
    }
    zones.push({ x0, ids, started: false, cleared: false });
    // stuff inside each fight area
    prop(rand() < .5 ? 'crate' : 'trash', x0 + 60 + Math.floor(rand() * 180), rz(), [pick(['coin', 'coin', 'munchie', 'nug']), 'coin', 'coin']);
    if (zi === 2) prop('chest', x0 + 150, 20, ['loot']);
    if (zi === 3) prop('crate', x0 + 220, 40, ['gold']);
    // the walk to the next fight: coins, nugs, rings, bonuses
    const gx = x0 + W + 10;
    coinArc(gx, rz(), 5);
    item('nug', gx + 60, rz(), 6); nugCount++;
    item('ring', gx + 30, rz(), 12);
    if (zi % 2 === 1) { item('nug', gx + 90, rz(), 6); nugCount++; }
    if (zi === 1 || zi === 3 || zi === 5) item('extra', gx + 40, rz(), 8, ['shatter', 'diamond', 'kief', 'hash'][(zi + n) % 4]);
    deco.push(x0 - 30, x0 + 120, x0 + 260);
  }
  while (nugCount < 7) { item('nug', 320 + nugCount * 300, rz(), 6); nugCount++; }
  const midGap = zones[Math.floor(zoneCount / 2)].x0 + W + 90;
  const legend = { x: midGap, z: 8, who: n % LEGENDS.length, met: false };
  const endX = zones[zoneCount - 1].x0 + W;
  coinLine(endX + 30, 34, 6); item('ring', endX + 130, 20, 10); item('ring', endX + 150, 44, 10);
  const spot = { x: LEN - 150, w: 60 };

  return {
    n, themeKey, theme, name: missionName(n), items, props, enemies, zones, deco, legend, spot,
    zi: -1, locked: false, spawn: { x: 40, z: 30 }, eshots: []
  };
}

// ============================================================
//  SAVE DATA (each player keeps their own stash + gear)
// ============================================================
const SAVE_KEY = 'kq_save_v2';
function defaultSave() { return { coins: 0, spots: 0, weapons: ['puff'], armor: [], pouch: false, munchie: 1, preroll: 0, gold: 0, weapon: 'puff', farm: false }; }
let save = defaultSave();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') save = { ...defaultSave(), ...s }; } catch (e) {}
save.weapons = save.weapons.map(w => w === 'boomer' ? 'dab' : w); if (save.weapon === 'boomer') save.weapon = 'dab';
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
const maxHp = () => 5 + ARMORS.reduce((m, a) => save.armor.includes(a.id) ? Math.max(m, a.hp) : m, 0);
const weaponDef = () => WEAPONS.find(w => w.id === save.weapon) || WEAPONS[0];

// ============================================================
//  WORLD STATE
// ============================================================
let lvl, me, camX = 0, state = 'play', frame = 0, running = false, paused = false, invOpen = false;
let particles = [], popups = [], shots = [], banner = null, shake = 0, hitstop = 0;
let finInfo = null, hurryT = 0, results = null, shopSel = 0, readyInfo = null;
const remotes = new Map();
const isHost = () => !Net.online || Net.hostId === Net.id;

function makePlayer() {
  return {
    x: lvl.spawn.x, z: lvl.spawn.z, h: 0, vx: 0, vz: 0, vh: 0, face: 1, w: 10,
    puffed: false, flaps: 0, jumpBuf: 0, inv: 60, walkT: 0, sq: 0, star: 0,
    hp: maxHp(), cooked: 0, combo: 0, comboT: 0, best: 0, atkCd: 0, atkT: 0, chain: 0, chainT: 0,
    earned: 0, lost: 0, kills: 0, nugs: 0, buffs: { speed: 0, magnet: 0, power: 0 }, legendT: 0,
    color: Net.color, name: Net.name, emote: null, stealCd: {}
  };
}
function startLevel(n) {
  lvl = buildLevel(n);
  me = makePlayer();
  camX = 0; state = 'play'; particles = []; popups = []; shots = [];
  finInfo = null; hurryT = 0; results = null; readyInfo = null; invOpen = false;
  banner = { t: 200, a: lvl.name[0] + ' - ' + lvl.name[1], b: 'BEAT THE BUZZKILLS, GET COOKED, FIND THE SMOKE SPOT' };
  if (save.preroll > 0) { save.preroll--; me.cooked = 40; popup(me.x, sy(me.z) - 30, 'PRE-ROLL! 40%', '#c8ffa0'); }
  if (save.gold > 0) { save.gold--; me.star = 720; }
  persist();
  for (const r of remotes.values()) { r.tx = -1000; r.x = -1000; }
  for (const c of Net.pendingCollected) applyCollected(c.id, c.l);
  Net.pendingCollected = [];
}

// ============================================================
//  GAMEPLAY HELPERS
// ============================================================
function puff(x, y, n, cols, spd = 1, g = 0.02) {
  for (let i = 0; i < n; i++) particles.push({
    x, y, vx: (Math.random() - .5) * 2 * spd, vy: (Math.random() - .8) * 1.5 * spd, life: 20 + Math.random() * 20,
    col: cols[Math.floor(Math.random() * cols.length)], s: 1 + Math.floor(Math.random() * 3), g
  });
}
function popup(x, y, str, col = '#fff') { popups.push({ x, y, str, col, t: 60 }); }
function collect(id) { Net.send({ t: 'col', id, l: lvl.n }); }
const ultra = () => me.cooked >= 100;
function addCombo(x, y) {
  me.combo++; me.comboT = 120; me.best = Math.max(me.best, me.combo);
  if (me.combo === 5 || me.combo === 10 || me.combo === 20) {
    tone(784, 0.1, 'square', 0.05); tone(1175, 0.25, 'square', 0.05, 0.1);
    puff(me.x, sy(me.z) - 10, 18, ['#c8ffa0', '#7fe07a', '#e4b3ff', '#ffffff'], 1.6);
    const bonus = me.combo * 2; addCoins(bonus); popup(x, y - 10, 'COMBO BONUS +' + bonus, '#c8ffa0');
  }
}
function addCoins(k) { save.coins += k; me.earned += k; }
function addCooked(k) {
  const was = me.cooked; me.cooked = Math.max(0, Math.min(100, me.cooked + k));
  if (k > 0 && was < 50 && me.cooked >= 50) { banner = { t: 120, a: 'YOU ARE COOKED!', b: 'THE SMOKE SPOT IS OPEN - KEEP GOING FOR ULTRA' }; SFX.power(); }
  if (k > 0 && was < 100 && me.cooked >= 100) { banner = { t: 160, a: 'ULTRA COOKED!!', b: 'STRONGER HITS + INFINITE FLOAT + x2 COINS AT THE SPOT' }; SFX.power(); shake = 8; puff(me.x, sy(me.z) - 20, 40, ['#c070ff', '#c8ffa0', '#ffffff', '#ff9ab8'], 2.4); }
}
function spawnDrops(p) {
  p.drops.forEach((d, k) => {
    const id = 'd' + p.id + '_' + k;
    if (d === 'loot') return;
    lvl.items.push({ id, kind: d, x: p.x - 10 + k * 12, z: Math.min(ZMAX, p.z + (k % 2) * 6), h: 16, vh: 1.5, taken: false });
  });
}
function breakProp(p, remote) {
  if (p.broken) return;
  p.broken = true; p.flash = 0;
  puff(p.x, sy(p.z) - 8, 14, p.kind === 'chest' ? ['#ffd84a', '#fff6b0', '#ffffff'] : ['#c87a3a', '#8a5024', '#ffffff'], 1.6);
  spawnDrops(p);
  if (!remote) { SFX.stomp(); collect(p.id); }
  if (p.kind === 'chest') openChest(p);
}
function openChest(c) {
  const loot = MISSION_LOOT[lvl.n % MISSION_LOOT.length];
  SFX.power(); shake = 5;
  const def = [...WEAPONS, ...ARMORS, { id: 'pouch', name: 'STASH POUCH' }].find(i => i.id === loot);
  const owned = save.weapons.includes(loot) || save.armor.includes(loot) || (loot === 'pouch' && save.pouch);
  if (owned) { addCoins(30); banner = { t: 140, a: 'TREASURE CHEST!', b: 'ALREADY HAVE ' + def.name + ' - TOOK 30 COINS' }; }
  else {
    if (WEAPONS.some(w => w.id === loot)) { save.weapons.push(loot); save.weapon = loot; }
    else if (loot === 'pouch') save.pouch = true;
    else { save.armor.push(loot); me.hp = maxHp(); }
    banner = { t: 180, a: 'FOUND: ' + def.name + '!', b: WEAPONS.some(w => w.id === loot) ? 'EQUIPPED - X TO SWING, Q TO SWITCH' : 'CHECK YOUR INVENTORY WITH I' };
  }
  persist();
}
function applyCollected(id, l) {
  if (!lvl || !running) { Net.pendingCollected.push({ id, l }); return; }
  if (l !== undefined && l !== lvl.n) return;
  if (id[0] === 'p') { const p = lvl.props.find(p => p.id === id); if (p) breakProp(p, true); }
  else { const it = lvl.items.find(i => i.id === id); if (it) it.taken = true; else if (id[0] === 'd') lvl.pendingTaken = (lvl.pendingTaken || []).concat(id); }
}
function pickUp(it) {
  it.taken = true; collect(it.id);
  const x = it.x, y = sy(it.z, it.h) - 10;
  if (it.kind === 'coin') { addCoins(1); SFX.coin(me.combo); puff(x, y, 5, ['#fff6b0', '#ffd84a', '#ffffff']); }
  else if (it.kind === 'nug') { me.nugs++; SFX.nug(); addCooked(15); popup(x - 12, y - 6, '+15% COOKED', '#c8ffa0'); puff(x, y, 14, ['#7fe07a', '#c070ff', '#ff9a3a', '#c8ffa0'], 1.4); }
  else if (it.kind === 'ring') { addCooked(4); SFX.ring(); popup(x - 4, y - 6, '+4%', '#e4b3ff'); puff(x, y, 6, ['#ffffff', '#e4b3ff']); }
  else if (it.kind === 'munchie') {
    SFX.munch();
    if (me.hp < maxHp()) { me.hp = Math.min(maxHp(), me.hp + 2); popup(x - 12, y - 6, 'MUNCHIES! +2', '#ff9ab8'); }
    else { save.munchie = Math.min(3, save.munchie + 1); popup(x - 12, y - 6, 'SAVED FOR LATER', '#ff9ab8'); }
  }
  else if (it.kind === 'gold') { me.star = 540; SFX.star(); shake = 6; banner = { t: 150, a: 'GOLDEN LEAF!', b: 'UNSTOPPABLE - RUN INTO ENEMIES' }; }
  else if (it.kind === 'extra') {
    const d = EXTRAS[it.sub];
    addCoins(d.coins); if (d.cooked) addCooked(d.cooked); if (d.buff) me.buffs[d.buff] = d.time;
    SFX.star(); shake = 4;
    banner = { t: 110, a: d.name + '!', b: '+' + d.coins + ' COINS - ' + d.desc };
    puff(x, y, 22, ['#ffd84a', '#9ae8ff', '#ffffff', '#ffb84a'], 1.8);
  }
}
function hurt(dmg = 1, cookedLoss = 0, fromX) {
  if (me.inv > 0 || me.star > 0 || state !== 'play') return;
  me.hp -= dmg; me.inv = 70; me.vx = (fromX !== undefined ? Math.sign(me.x - fromX) || -me.face : -me.face) * 2.2; me.vh = 2;
  me.puffed = false; me.combo = 0; shake = 10; hitstop = 4;
  if (cookedLoss) { addCooked(-cookedLoss); popup(me.x - 16, sy(me.z) - 34, 'BUZZKILL -' + cookedLoss + '%', '#ff8a8a'); }
  SFX.hurt(); puff(me.x, sy(me.z, me.h) - 10, 10, ['#ff5a6a', '#ffffff']);
  if (me.hp <= 0) knockedOut();
}
function knockedOut() {
  const loss = Math.min(save.coins, Math.max(5, Math.floor(save.coins * 0.1)));
  save.coins -= loss; me.lost += loss;
  me.hp = maxHp(); me.x = camX + W / 2; me.z = ZMAX / 2; me.h = 140; me.vx = me.vz = me.vh = 0; me.inv = 150; me.combo = 0; me.puffed = false;
  banner = { t: 140, a: 'YOU GOT BEAT UP!', b: 'DROPPED ' + loss + ' HASH COINS - BACK IN THE FIGHT' };
  SFX.hurt();
}
function emote(i) { me.emote = { e: i, t: 120 }; Net.send({ t: 'emote', e: i }); tone(660, 0.08, 'square', 0.04); tone(880, 0.1, 'square', 0.04, 0.08); }
function useMunchies() {
  if (save.munchie <= 0 || me.hp >= maxHp() || state !== 'play') return;
  save.munchie--; me.hp = Math.min(maxHp(), me.hp + 2); SFX.munch(); persist();
  popup(me.x - 12, sy(me.z) - 34, 'MUNCHIES! +2', '#ff9ab8');
}
function cycleWeapon(dir) {
  const owned = WEAPONS.filter(w => save.weapons.includes(w.id));
  const i = owned.findIndex(w => w.id === save.weapon);
  save.weapon = owned[(i + dir + owned.length) % owned.length].id; persist();
  popup(me.x - 16, sy(me.z) - 34, weaponDef().name, '#fff6b0');
}
function selectWeapon(i) {
  const w = WEAPONS[i]; if (!w) return;
  if (!save.weapons.includes(w.id)) { popup(me.x - 16, sy(me.z) - 34, 'DONT HAVE IT YET', '#ff8a8a'); return; }
  save.weapon = w.id; persist(); popup(me.x - 16, sy(me.z) - 34, w.name, '#fff6b0');
}

// ============================================================
//  COMBAT
// ============================================================
const REACH = { puff: 30, lighter: 30, bong: 26, dab: 42, grinder: 30 };
// my hit landed on an enemy: the host applies it, everyone else asks the host
function hitEnemy(e, dmg, dir, strong) {
  if (!e.alive || e.state === 5) return;
  e.flash = 8; hitstop = 3; shake = Math.max(shake, strong ? 5 : 3);
  puff(e.x, sy(e.z, e.h) - 12, 6, ['#ffffff', '#fff6b0', '#ff9ab8'], 1.2);
  SFX.hit();
  if (isHost()) damageEnemy(e, dmg, dir, strong, Net.id);
  else Net.send({ t: 'hit', i: e.id, d: dmg, dir, s: strong ? 1 : 0, l: lvl.n });
}
function damageEnemy(e, dmg, dir, strong, by) { // host only
  if (!e.alive || e.state === 5) return;
  e.hp -= dmg; e.flash = 8;
  if (e.hp <= 0) {
    e.state = 5; e.t = 50; e.vx = dir * 2.6; e.vh = 3;
    Net.send({ t: 'kill', i: e.id, by, l: lvl.n });
    onKill(e, by);
  } else {
    e.state = 4; e.t = strong ? 26 : 16; e.vx = dir * (strong ? 3 : 1.4); if (strong) e.vh = 2.2;
  }
}
function onKill(e, by) { // everyone: death effect; the one who landed it gets the goods
  e.state = 5; e.t = Math.max(e.t, 40);
  puff(e.x, sy(e.z) - 10, 12, ['#ffffff', '#e8e4f4', '#c8ffa0', '#ff9ab8'], 1.4);
  if (by !== Net.id) return;
  const reward = { cop: 8, karen: 6, mouse: 2, squirrel: 3 }[e.kind] + e.stolen;
  addCoins(reward); addCooked(3); me.kills++; addCombo(e.x, sy(e.z) - 30); SFX.stomp();
  popup(e.x - 14, sy(e.z) - 34, { cop: 'COP DOWN!', karen: 'KAREN DENIED!', mouse: 'SQUEAK!', squirrel: 'NUTS!' }[e.kind] + ' +' + reward, '#ffffff');
  e.stolen = 0;
}
function attack() {
  if (me.atkCd > 0 || state !== 'play') return;
  const w = weaponDef(), wi = WEAPONS.indexOf(w);
  if (me.puffed) { // exhale a smoke blast from the cloud
    me.puffed = false; me.flaps = 0; SFX.exhale(); me.atkCd = 16; me.atkT = 10;
    shots.push({ mine: true, x: me.x + me.face * 10, z: me.z, h: me.h + 8, vx: me.face * 3.6, life: 26, dmg: 2, kind: 5, hit: new Set() });
    Net.send({ t: 'fx', k: 5, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
    return;
  }
  me.chain = me.chainT > 0 ? (me.chain + 1) % 3 : 0;
  const strong = me.chain === 2;
  me.atkCd = Math.round(w.cd * (strong ? 1.3 : 0.75)); me.atkT = 12; me.chainT = me.atkCd + 16;
  SFX.attack(wi);
  const dmg = w.dmg + (ultra() ? 1 : 0) + (me.buffs.power > 0 ? 1 : 0) + (strong ? 1 : 0);
  const reach = REACH[w.id] || 30;
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive || e.state === 5) continue;
    const dx = e.x - me.x, dz = Math.abs(e.z - me.z);
    const inFront = w.id === 'grinder' ? Math.abs(dx) < reach : dx * me.face > -6 && Math.abs(dx) < reach;
    if (inFront && dz < 10 && Math.abs(e.h - me.h) < 24) hitEnemy(e, dmg, Math.sign(dx) || me.face, strong);
  }
  for (const p of lvl.props) {
    if (p.broken) continue;
    const dx = p.x - me.x;
    if ((w.id === 'grinder' ? Math.abs(dx) < reach : dx * me.face > -6 && Math.abs(dx) < reach) && Math.abs(p.z - me.z) < 12) {
      p.hp--; p.flash = 6; SFX.bump(); if (p.hp <= 0) breakProp(p);
    }
  }
  if (w.id === 'bong') shots.push({ mine: true, x: me.x + me.face * 12, z: me.z, h: me.h + 10, vx: me.face * 4.2, life: 40, dmg: 1, kind: 6, hit: new Set() });
  if (w.id === 'lighter') for (let i = 0; i < 8; i++) particles.push({ x: me.x + me.face * (10 + i * 3), y: sy(me.z, me.h) - 12 + (Math.random() - .5) * 8, vx: me.face * (1 + Math.random()), vy: -0.3, life: 14, col: ['#ff5a6a', '#ff9a3a', '#ffd84a'][i % 3], s: 3, g: -0.02 });
  if (w.id === 'puff') puff(me.x + me.face * 26, sy(me.z, me.h) - 16, 5, ['#ffffff', '#e8e4f4'], .6, -0.02);
  Net.send({ t: 'fx', k: wi, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
}
function updateShots() {
  for (const s of shots) {
    s.x += s.vx; s.life--; if (s.kind === 5) s.vx *= 0.95;
    if (!s.mine) continue;
    for (const e of lvl.enemies) {
      if (!e.spawned || !e.alive || e.state === 5 || s.hit.has(e)) continue;
      if (Math.abs(e.x - s.x) < 12 && Math.abs(e.z - s.z) < 10) { s.hit.add(e); hitEnemy(e, s.dmg + (ultra() ? 1 : 0), Math.sign(s.vx), s.kind === 5); s.life = 0; }
    }
  }
  shots = shots.filter(s => s.life > 0);
  // purses thrown by Karens (simulated on every screen, each player checks themselves)
  for (const s of lvl.eshots) {
    s.x += s.vx; s.life--; s.spin++;
    if (state === 'play' && Math.abs(s.x - me.x) < 10 && Math.abs(s.z - me.z) < 8 && me.h < 22) { s.life = 0; hurt(1, 8, s.x); }
    for (const p of shots) if (p.mine && Math.abs(p.x - s.x) < 10 && Math.abs(p.z - s.z) < 10) { s.life = 0; puff(s.x, sy(s.z, 14), 5, ['#ff7ac8', '#ffffff']); }
  }
  lvl.eshots = lvl.eshots.filter(s => s.life > 0);
}

// ============================================================
//  UPDATE
// ============================================================
function update() {
  if (paused) return;
  frame++;
  if (banner && --banner.t <= 0) banner = null;
  if (hitstop > 0) { hitstop--; return; }

  if (state === 'play' && !(invOpen && !Net.online)) updatePlayer();
  else if (state === 'sitting') {
    me.vx = me.vz = 0;
    if (frame % 8 === 0) puff(lvl.spot.x + 40, sy(-2) - 14, 1, ['#ffffff', '#e8e4f4', '#d4c8f8'], .3, -0.03);
    if (!Net.online && finInfo && --finInfo.t <= 0) toResults();
    if (Net.online && K.enterPressed && !finInfo.hurried) { Net.send({ t: 'hurry' }); finInfo.hurried = true; }
  } else if (state === 'results') updateShop();
  if (hurryT > 0 && --hurryT === 0) Net.send({ t: 'timeup' });
  K.jumpPressed = false; K.enterPressed = false; K.attackPressed = false;
  if (me.emote && --me.emote.t <= 0) me.emote = null;

  if (isHost()) hostUpdate(); else clientEnemies();
  updateShots();
  for (const e of lvl.enemies) if (e.flash > 0) e.flash--;

  for (const r of remotes.values()) {
    if (r.tx < -500) continue;
    if (Math.abs(r.tx - r.x) > 100) { r.x = r.tx; r.z = r.tz; r.h = r.th; }
    r.x += (r.tx - r.x) * 0.35; r.z += (r.tz - r.z) * 0.35; r.h += (r.th - r.h) * 0.35;
    if (r.emote && --r.emote.t <= 0) r.emote = null;
    if (r.atkT > 0) r.atkT--;
  }
  // items that pop out of crates settle onto the ground
  for (const it of lvl.items) if (it.vh !== undefined && (it.h > 0 || it.vh > 0)) { it.vh -= 0.2; it.h = Math.max(0, it.h + it.vh); if (it.h === 0) it.vh = 0; }
  if (lvl.pendingTaken) { lvl.pendingTaken = lvl.pendingTaken.filter(id => { const it = lvl.items.find(i => i.id === id); if (it) { it.taken = true; return false; } return true; }); }
  for (const p of lvl.props) if (p.flash > 0) p.flash--;
  particles = particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += p.g; return --p.life > 0; });
  popups = popups.filter(p => { p.y -= 0.4; return --p.t > 0; });

  // camera: follow me, but stay put while a fight area is locked
  const z = lvl.zones[lvl.zi];
  let target = me.x - W * 0.4;
  if (lvl.locked && z) target = z.x0;
  camX += (target - camX) * 0.1;
  camX = Math.max(0, Math.min(camX, LEN - W));
  if (lvl.locked && z) camX = Math.max(z.x0 - 40, Math.min(camX, z.x0 + 40));

  if (Net.online && frame % 3 === 0 && (state === 'play' || state === 'sitting')) {
    Net.send({ t: 's', x: Math.round(me.x), y: Math.round(me.z), h: Math.round(me.h), l: lvl.n, a: animFrame(me), f: me.face, b: (me.star > 0 ? 1 : 0) | (ultra() ? 2 : 0) | (state === 'sitting' ? 4 : 0), w: WEAPONS.indexOf(weaponDef()), c: Math.round(me.cooked) });
  }
}
function animFrame(p) {
  if (p.atkT > 0) return 5;
  if (p.puffed) return 4;
  if (p.h > 0) return 3;
  if (Math.abs(p.vx) + Math.abs(p.vz) > 0.2) return 1 + Math.floor(p.walkT / 6) % 2;
  return 0;
}

function updatePlayer() {
  const p = me, spd = p.buffs.speed > 0 ? 1.45 : 1;
  const mx = (K.run ? 2.1 : 1.3) * spd, mz = (K.run ? 1.3 : 0.9) * spd;
  let ix = (K.right ? 1 : 0) - (K.left ? 1 : 0), iz = (K.down ? 1 : 0) - (K.up ? 1 : 0);
  if (p.atkT > 6 && p.h === 0) { ix = 0; iz = 0; } // plant your feet while swinging
  if (ix) p.face = ix;
  if (p.inv > 55) { /* knockback */ } else { p.vx += (ix * mx - p.vx) * 0.3; p.vz += (iz * mz - p.vz) * 0.3; }
  if (p.puffed) { p.vx *= 0.9; p.vz *= 0.9; }

  if (K.jumpPressed) p.jumpBuf = 6; else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.jumpBuf > 0) {
    if (p.h === 0) { p.vh = 3.7; p.jumpBuf = 0; p.sq = 6; SFX.jump(); }
    else if (p.flaps < (ultra() ? 99 : 5)) { p.puffed = true; p.flaps++; p.vh = 1.9; p.jumpBuf = 0; SFX.flap(); puff(p.x, sy(p.z, p.h), 3, ['#ffffff', '#e8e4f4'], .6); }
  }
  if (p.h > 0 || p.vh > 0) {
    p.vh -= p.puffed ? 0.09 : 0.2;
    if (p.puffed) p.vh = Math.max(p.vh, -0.8);
    p.h += p.vh;
    if (p.h <= 0) { p.h = 0; p.vh = 0; p.puffed = false; p.flaps = 0; p.sq = 5; puff(p.x, sy(p.z), 3, ['#ffffff', '#f0e8ff'], .5); }
  }
  p.x += p.vx; p.z += p.vz;
  p.z = Math.max(0, Math.min(ZMAX, p.z));
  const zn = lvl.zones[lvl.zi];
  const left = lvl.locked && zn ? zn.x0 + 8 : camX + 8, right = lvl.locked && zn ? zn.x0 + W - 8 : LEN - 8;
  p.x = Math.max(left, Math.min(right, p.x));
  if (!lvl.locked) { // can't run past the next fight until it's started
    const next = lvl.zones.find(z => !z.cleared);
    if (next && next.started && p.x > next.x0 + W - 8) p.x = next.x0 + W - 8;
  }

  if (K.attackPressed) attack();
  if (p.atkCd > 0) p.atkCd--;
  if (p.atkT > 0) p.atkT--;
  if (p.chainT > 0) p.chainT--;
  if (Math.abs(p.vx) + Math.abs(p.vz) > 0.2 && p.h === 0) p.walkT += 1; else p.walkT = 0;
  if (p.sq > 0) p.sq--;
  if (p.inv > 0) p.inv--;
  if (p.star > 0) {
    p.star--;
    if (frame % 3 === 0) puff(p.x + (Math.random() - .5) * 12, sy(p.z, p.h) - Math.random() * 17, 1, ['#ffd84a', '#fff6b0', '#c8ffa0', '#e4b3ff'], .3);
    for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - p.x) < 14 && Math.abs(e.z - p.z) < 8 && !(e.starHit > frame)) { e.starHit = frame + 20; hitEnemy(e, 9, Math.sign(e.x - p.x) || 1, true); }
  }
  if (ultra() && frame % 5 === 0) puff(p.x, sy(p.z, p.h) - 18, 1, ['#c070ff', '#e4b3ff', '#c8ffa0'], .4, -0.03);
  if (p.h === 0 && Math.abs(p.vx) > 1.8 && frame % 4 === 0) puff(p.x - p.face * 6, sy(p.z) - 1, 1, ['#ffffff', '#e8e0d0'], .4);
  if (p.comboT > 0 && --p.comboT === 0) p.combo = 0;
  for (const k in p.buffs) if (p.buffs[k] > 0) p.buffs[k]--;

  // pick things up
  for (const it of lvl.items) {
    if (it.taken) continue;
    if (p.buffs.magnet > 0 && it.kind === 'coin') { const dx = p.x - it.x, dz = p.z - it.z, d = Math.hypot(dx, dz); if (d < 90) { it.x += dx / d * 3; it.z += dz / d * 3; } }
    if (Math.abs(it.x - p.x) < 11 && Math.abs(it.z - p.z) < 8 && Math.abs((it.h || 0) - p.h) < 18) pickUp(it);
  }
  // thieves
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive || (e.kind !== 'mouse' && e.kind !== 'squirrel') || e.state !== 0) continue;
    if (Math.abs(e.x - p.x) < 10 && Math.abs(e.z - p.z) < 7 && p.h < 10 && !(p.stealCd[e.id] > frame)) {
      p.stealCd[e.id] = frame + 120;
      const k = save.pouch ? 0 : Math.min(save.coins, e.kind === 'mouse' ? 5 : 8);
      if (save.pouch) popup(e.x - 16, sy(e.z) - 24, 'POUCH LOCKED!', '#ffd84a');
      else { save.coins -= k; p.lost += k; popup(p.x - 16, sy(p.z) - 36, k ? '-' + k + ' STOLEN!' : 'NOTHING TO STEAL', '#ff8a8a'); if (k) SFX.steal(); }
      if (isHost()) thiefFlee(e, k); else Net.send({ t: 'steal', i: e.id, k, l: lvl.n });
    }
  }
  // enemy attacks that reach me
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive || e.state !== 2 || e.kind !== 'cop') continue;
    if (e.hitMe === e.strikeN) continue;
    const dx = p.x - e.x;
    if (dx * e.dir > -4 && Math.abs(dx) < 28 && Math.abs(e.z - p.z) < 8 && p.h < 14) { e.hitMe = e.strikeN; hurt(1, 0, e.x); }
  }
  // legend
  const lg = lvl.legend;
  if (lg && !lg.met && Math.abs(p.x - lg.x) < 20 && Math.abs(p.z - lg.z) < 14) {
    lg.met = true; const L = LEGENDS[lg.who]; SFX.power();
    if (L.gift === 'cooked') { addCooked(20); lg.gift = '+20% COOKED'; }
    else if (L.gift === 'heal') { p.hp = maxHp(); lg.gift = 'FULL HEARTS'; }
    else { addCoins(40); lg.gift = '+40 HASH COINS'; }
    p.legendT = 300;
  }
  if (p.legendT > 0) p.legendT--;
  // the smoke spot
  const spot = lvl.spot;
  if (p.x > spot.x && p.x < spot.x + spot.w + 20) {
    if (p.cooked >= 50) sitDown();
    else if (!p.spotWarnT || frame > p.spotWarnT) {
      p.spotWarnT = frame + 120;
      banner = { t: 100, a: 'NOT COOKED ENOUGH!', b: 'YOU NEED 50% - GRAB NUGS, RINGS, KNOCK OUT BUZZKILLS' };
    }
    if (p.cooked < 50) { p.x = spot.x - 2; p.vx = -1.5; }
  }
}
function sitDown() {
  state = 'sitting'; me.vx = me.vz = 0; me.puffed = false; me.h = 0;
  me.x = lvl.spot.x + 20 + (Net.color % 2) * 14; me.z = 2;
  SFX.flag(); shake = 4;
  puff(lvl.spot.x + 30, sy(0) - 16, 30, ['#ffffff', '#c8ffa0', '#e4b3ff', '#ffd84a'], 2);
  finInfo = { t: 150, n: 1, of: remotes.size + 1, hurried: false };
  Net.send({ t: 'fin', l: lvl.n });
}
function toResults() {
  if (state === 'results') return;
  const made = state === 'sitting';
  const ultraBonus = made && ultra() ? me.earned : 0;
  const spotBonus = made ? 50 + lvl.n * 10 : 0;
  addCoins(ultraBonus + spotBonus);
  if (made) save.spots = Math.max(save.spots, lvl.n + 1);
  persist();
  results = { made, earned: me.earned, lost: me.lost, spotBonus, ultraBonus, cooked: Math.round(me.cooked), kills: me.kills, best: me.best, nugs: me.nugs };
  state = 'results'; shopSel = 0; hurryT = 0; banner = null;
}

// ============================================================
//  ENEMY AI (runs on the host's screen, synced to the crew)
// ============================================================
function playersList() {
  const list = [{ id: Net.id, x: me.x, z: me.z, h: me.h, ok: state === 'play' && me.inv < 60 }];
  for (const [id, r] of remotes) if (r.l === lvl.n && r.tx > -500 && !(r.b & 4)) list.push({ id, x: r.x, z: r.z, h: r.h, ok: true });
  return list;
}
function thiefFlee(e, k) { e.stolen += k; e.state = 6; e.t = 0; }
function hostUpdate() {
  const players = playersList();
  // fight areas: start when someone walks in, clear when everyone's down
  const nz = lvl.zones.findIndex(z => !z.cleared);
  if (nz >= 0) {
    const z = lvl.zones[nz];
    if (!z.started && players.some(p => p.x > z.x0 + 70)) {
      z.started = true; lvl.zi = nz; lvl.locked = true; z.spawnT = 0;
      banner = { t: 70, a: 'HERE THEY COME!', b: '' }; SFX.karen();
    }
    if (z.started && !z.cleared) {
      const alive = z.ids.map(i => lvl.enemies[i]).filter(e => e.alive);
      const onScreen = alive.filter(e => e.spawned).length;
      const waiting = alive.filter(e => !e.spawned);
      if (waiting.length && onScreen < 4 && --z.spawnT <= 0) {
        const e = waiting[0], fromLeft = e.id % 3 === 0;
        e.spawned = true; e.x = fromLeft ? z.x0 - 20 : z.x0 + W + 20; e.z = 6 + (e.id * 23) % (ZMAX - 12); e.dir = fromLeft ? 1 : -1;
        z.spawnT = 50;
      }
      if (!alive.length) { z.cleared = true; lvl.locked = false; banner = { t: 90, a: 'GO GO GO!', b: '' }; SFX.cp(); }
    }
  }
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive) continue;
    if (e.state === 5) { // knocked out, flying back
      e.vh -= 0.2; e.h = Math.max(0, e.h + e.vh); e.x += e.vx; e.vx *= 0.95;
      if (--e.t <= 0) e.alive = false;
      continue;
    }
    // target the closest homie
    let tgt = null, best = 1e9;
    for (const p of players) { if (!p.ok) continue; const d = Math.abs(p.x - e.x) + Math.abs(p.z - e.z) * 2; if (d < best) { best = d; tgt = p; } }
    if (!tgt) tgt = players[0];
    const dx = tgt.x - e.x, dz = tgt.z - e.z;
    e.vh -= 0.2; e.h = Math.max(0, e.h + e.vh); if (e.h === 0) e.vh = 0;
    if (e.state === 4) { e.x += e.vx; e.vx *= 0.85; if (--e.t <= 0) e.state = 0; continue; }
    let sx = 0, sz = 0;
    if (e.state === 6) { // running off with your coins
      e.dir = e.dir || 1; sx = e.dir * 2.6;
      if (e.x < camX - 60 || e.x > camX + W + 60) { e.alive = false; e.gone = true; }
    } else if (e.kind === 'cop') {
      if (e.state === 0) {
        e.dir = Math.sign(dx) || 1;
        const wantX = tgt.x - e.dir * 20;
        sx = Math.sign(wantX - e.x) * Math.min(0.9, Math.abs(wantX - e.x)); sz = Math.sign(dz) * Math.min(0.6, Math.abs(dz));
        if (Math.abs(dx) < 26 && Math.abs(dz) < 5 && tgt.h < 14) { e.state = 1; e.t = 22; }
      } else if (e.state === 1) { if (--e.t <= 0) { e.state = 2; e.t = 8; e.strikeN = (e.strikeN || 0) + 1; SFX.hit(); } }
      else if (e.state === 2) { if (--e.t <= 0) { e.state = 3; e.t = 34; } }
      else if (e.state === 3) { if (--e.t <= 0) e.state = 0; }
    } else if (e.kind === 'karen') {
      if (e.state === 0) {
        const side = e.x < tgt.x ? -1 : 1, wantX = tgt.x + side * 80;
        e.dir = Math.sign(dx) || 1;
        sx = Math.sign(wantX - e.x) * Math.min(0.7, Math.abs(wantX - e.x)); sz = Math.sign(dz) * Math.min(0.6, Math.abs(dz));
        if (--e.cd <= 0 && Math.abs(dz) < 10) { e.state = 1; e.t = 16; }
      } else if (e.state === 1) {
        if (--e.t <= 0) {
          e.state = 3; e.t = 30; e.cd = 110 + (e.id * 17) % 60;
          const shot = { x: e.x + e.dir * 8, z: e.z, vx: e.dir * 2.1, life: 150, spin: 0 };
          lvl.eshots.push(shot); Net.send({ t: 'eshot', x: Math.round(shot.x), z: Math.round(shot.z), vx: shot.vx, l: lvl.n });
          if (e.id % 2) popup(e.x - 18, sy(e.z) - 36, e.id % 4 === 1 ? 'MANAGER!!' : 'UNACCEPTABLE!', '#ffb0b0');
          SFX.karen();
        }
      } else if (e.state === 3) { if (--e.t <= 0) e.state = 0; }
    } else if (e.kind === 'mouse') {
      e.dir = Math.sign(dx) || 1; sx = Math.sign(dx) * Math.min(1.8, Math.abs(dx)); sz = Math.sign(dz) * Math.min(1.1, Math.abs(dz));
    } else if (e.kind === 'squirrel') {
      if (e.h === 0) { if (--e.cd <= 0) { e.cd = 24 + (e.id * 7) % 20; e.vh = 2.6; e.dir = Math.sign(dx) || 1; e.hx = Math.sign(dx) * 1.7; e.hz = Math.sign(dz) * Math.min(1, Math.abs(dz) / 10); } }
      else { sx = e.hx || 0; sz = e.hz || 0; }
    }
    e.x += sx; e.z = Math.max(0, Math.min(ZMAX, e.z + sz));
  }
  // don't let enemies stack into one blob
  const act = lvl.enemies.filter(e => e.spawned && e.alive && e.state !== 5);
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j], dx = b.x - a.x, dz = b.z - a.z;
    if (Math.abs(dx) < 12 && Math.abs(dz) < 6) { const push = dx >= 0 ? 0.4 : -0.4; a.x -= push; b.x += push; a.z -= Math.sign(dz || 1) * 0.2; b.z += Math.sign(dz || 1) * 0.2; }
  }
  if (Net.online && frame % 4 === 0) {
    Net.send({
      t: 'es', l: lvl.n, zi: lvl.zi, lk: lvl.locked ? 1 : 0, zc: lvl.zones.filter(z => z.cleared).length,
      e: lvl.enemies.filter(e => e.spawned).map(e => [e.id, Math.round(e.x), Math.round(e.z), Math.round(e.h), e.alive ? e.state : 7, e.dir, e.hp, e.strikeN || 0])
    });
  }
}
function clientEnemies() {
  for (const e of lvl.enemies) {
    if (!e.spawned) continue;
    e.x += (e.tx - e.x) * 0.3; e.z += (e.tz - e.z) * 0.3; e.h += (e.th - e.h) * 0.4;
    if (e.state === 5 && --e.t <= 0) e.alive = false;
  }
}
function applySnapshot(m) {
  if (!lvl || m.l !== lvl.n) return;
  lvl.zi = m.zi; lvl.locked = !!m.lk;
  lvl.zones.forEach((z, i) => { z.started = i <= m.zi; z.cleared = i < m.zc; });
  for (const [id, x, z, h, st, dir, hp, sn] of m.e) {
    const e = lvl.enemies[id]; if (!e) continue;
    if (!e.spawned) { e.spawned = true; e.x = x; e.z = z; e.h = h; }
    e.tx = x; e.tz = z; e.th = h; e.dir = dir; e.hp = hp; e.strikeN = sn;
    if (st === 7) { if (e.state !== 5) e.alive = false; }
    else if (!(e.state === 5 && e.alive)) e.state = st;
  }
}
// ============================================================
//  DRAW
// ============================================================
function draw_(img, x, y, flip) {
  x = Math.round(x - camX); y = Math.round(y);
  if (x > W || x + img.width < 0) return;
  if (flip) { ctx.save(); ctx.translate(x + img.width, y); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); }
  else ctx.drawImage(img, x, y);
}
function bubble(str, cx, y) {
  const w = str.length * 4 + 5, x = Math.round(cx - camX - w / 2);
  ctx.fillStyle = P.k; ctx.fillRect(x - 1, y - 1, w + 2, 11); ctx.fillRect(x + w / 2 - 1, y + 10, 3, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, 9);
  drawStr(str, x + 3, y + 2, '#3fae5a', 1);
}
function drawPlayer(x, y, face, anim, color, sq, inv, emote, name, star, ult, sitting, wi = 0, atkT = 0) {
  if (inv > 0 && Math.floor(inv / 4) % 2) return;
  const img = PLAYER[color][anim];
  if (anim === 4) { // riding a little smoke cloud while floating
    const cx = Math.round(x - camX + 5), cy = Math.round(y + 18 + Math.sin(frame / 5));
    ctx.fillStyle = P.k; circle(cx - 5, cy, 5); circle(cx + 5, cy, 5); circle(cx, cy - 2, 6);
    ctx.fillStyle = '#ffffff'; circle(cx - 5, cy, 4); circle(cx + 5, cy, 4); circle(cx, cy - 2, 5);
  }
  if (star) ctx.filter = 'hue-rotate(' + (frame * 24 % 360) + 'deg) saturate(2) brightness(1.15)';
  else if (ult) ctx.filter = 'drop-shadow(0 0 2px #c070ff)';
  if (sq > 0 && anim !== 4) {
    const sx = Math.round(x - camX - 4), sy = Math.round(y + 1);
    ctx.save(); ctx.translate(sx + (face < 0 ? 18 : 0), sy); ctx.scale(face < 0 ? -1 : 1, 1); ctx.drawImage(img, 0, 0, 18, 17); ctx.restore();
  } else draw_(img, x - 3, y - 2, face < 0);
  ctx.filter = 'none';
  if (!sitting) drawHeld(x, y, face, wi, atkT, anim);
  if (sitting && frame % 40 < 30) text('Z', x + 12 - camX, y - 8 - (frame % 40) / 8, '#e4b3ff');
  if (emote) bubble(EMOTES[emote.e], x + 5, y - (name ? 24 : 14));
  if (name) text(name, x + 5 - camX, y - 10, SHIRTS[color], 1, 'center');
}
function drawHeld(x, y, face, wi, atkT, anim) {
  const w = WEAPONS[wi] || WEAPONS[0], img = HELD[w.id]; if (!img || anim === 4) return;
  const hx = Math.round(x - camX + 5 + face * 5), hy = Math.round(y + 11);
  const p = atkT > 0 ? 1 - atkT / 12 : 0; // swing progress
  ctx.save(); ctx.translate(hx, hy); ctx.scale(face, 1);
  if (w.id === 'puff' || w.id === 'bong') ctx.rotate(atkT > 0 ? -1.6 + p * 2.4 : -0.5);
  else if (w.id === 'dab') ctx.translate(atkT > 0 ? Math.sin(p * Math.PI) * 10 : 0, 0), ctx.rotate(atkT > 0 ? 0 : -0.25);
  else if (w.id === 'grinder') ctx.rotate(atkT > 0 ? p * 12 : 0);
  else if (w.id === 'lighter') ctx.rotate(atkT > 0 ? 0.2 : -0.1);
  if (w.id === 'puff') ctx.drawImage(img, -2, -4);
  else if (w.id === 'dab') ctx.drawImage(img, -2, -2);
  else if (w.id === 'grinder') ctx.drawImage(img, -6, -5);
  else ctx.drawImage(img, -3, -img.height + 3);
  ctx.restore();
  if (w.id === 'puff' && frame % 14 === 0) puff(x + 5 + face * 26, y + 6, 1, ['#ffffff', '#e8e4f4'], .2, -0.03);
}
function circle(cx, cy, r) { for (let y = -r; y <= r; y++) { const w = Math.sqrt(r * r - y * y); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), Math.round(w * 2), 1); } }

function shadow(x, z, h, w = 7) {
  const X = Math.round(x - camX), Y = sy(z);
  ctx.globalAlpha = Math.max(0.12, 0.3 - h / 200); ctx.fillStyle = '#2a1838';
  ctx.fillRect(X - w, Y - 1, w * 2, 3); ctx.fillRect(X - w + 2, Y - 2, w * 2 - 4, 5);
  ctx.globalAlpha = 1;
}
function drawSpot() {
  const s = lvl.spot, x = Math.round(s.x - camX), y = sy(-2);
  if (x > W + 10 || x + 80 < 0) return;
  R(ctx, P.k, x + 2, y - 50, 2, 50); R(ctx, P.k, x - 6, y - 58, 40, 12); R(ctx, '#ffe0a0', x - 5, y - 57, 38, 10);
  drawStr('SMOKE SPOT', x - 3, y - 54, '#6a4428', 1);
  R(ctx, P.k, x + 10, y - 22, 44, 22); R(ctx, '#c070ff', x + 11, y - 21, 42, 20);
  R(ctx, '#e0a8ff', x + 11, y - 21, 42, 3); R(ctx, P.k, x + 14, y - 11, 36, 1); R(ctx, '#8a40c8', x + 11, y - 3, 42, 2);
  R(ctx, P.k, x + 7, y - 15, 5, 15); R(ctx, '#a050e8', x + 8, y - 14, 3, 13); R(ctx, P.k, x + 52, y - 15, 5, 15); R(ctx, '#a050e8', x + 53, y - 14, 3, 13);
  R(ctx, '#6a4428', x + 62, y - 3, 12, 3);
  const fl = frame % 12 < 6;
  R(ctx, '#ff5a6a', x + 64, y - 9, 8, 6); R(ctx, '#ff9a3a', x + 65, y - (fl ? 12 : 11), 6, 8); R(ctx, '#ffd84a', x + 67, y - 8, 2, 3);
  if (frame % 10 === 0) puff(s.x + 68, y - 14, 1, ['#ffffff', '#e8e4f4', '#d4c8f8'], .3, -0.03);
}
function drawEnemyB(e) {
  const imgs = e.flash > 0 && e.flash % 2 ? ENEMY_FLASH[e.kind] : ENEMY_IMG[e.kind];
  let f = Math.floor(frame / (e.state === 6 ? 5 : 10)) % 2;
  if ((e.kind === 'cop' && (e.state === 2)) || (e.kind === 'karen' && e.state === 1)) f = 1;
  if (e.kind === 'cop' && e.state === 1) f = 0;
  const img = imgs[f], x = e.x - img.width / 2, y = sy(e.z, e.h) - img.height;
  if (e.state === 5 && e.t < 20 && frame % 4 < 2) return;
  const flip = e.kind === 'mouse' || e.kind === 'squirrel' ? e.dir > 0 : e.dir < 0;
  if (e.state === 5) { ctx.save(); ctx.translate(Math.round(e.x - camX), Math.round(sy(e.z, e.h) - 4)); ctx.rotate(e.dir * -1.4); ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore(); return; }
  draw_(img, x, y, flip);
  if (e.kind === 'cop' && e.state === 1 && frame % 6 < 3) text('!', e.x - camX, y - 8, '#ff5a6a', 1, 'center');
  if (e.stolen > 0 && frame % 30 < 20) draw_(COIN, e.x - 5, y - 11);
  if (e.hp < e.maxHp && e.state !== 5) { R(ctx, P.k, Math.round(e.x - camX - 8), Math.round(y - 4), 16, 3); R(ctx, '#ff5a6a', Math.round(e.x - camX - 7), Math.round(y - 3), Math.round(14 * e.hp / e.maxHp), 1); }
}
function drawProp(p) {
  if (p.broken) return;
  const x = Math.round(p.x - camX), y = sy(p.z);
  if (p.flash % 2) ctx.filter = 'brightness(2)';
  if (p.kind === 'chest') ctx.drawImage(CHEST, x - 7, y - 10);
  else if (p.kind === 'trash') {
    R(ctx, P.k, x - 7, y - 18, 14, 18); R(ctx, '#9aa0b8', x - 6, y - 17, 12, 16); R(ctx, '#c8ccdc', x - 6, y - 17, 3, 16);
    R(ctx, P.k, x - 8, y - 20, 16, 3); R(ctx, '#7a8098', x - 7, y - 19, 14, 1); R(ctx, P.k, x - 4, y - 12, 8, 1);
  } else {
    R(ctx, P.k, x - 8, y - 16, 16, 16); R(ctx, '#c87a3a', x - 7, y - 15, 14, 14); R(ctx, '#e8a060', x - 7, y - 15, 14, 2);
    R(ctx, P.k, x - 7, y - 9, 14, 1); R(ctx, P.k, x - 1, y - 15, 1, 14); R(ctx, '#8a5024', x - 7, y - 2, 14, 1);
  }
  ctx.filter = 'none';
}
function drawItem(it) {
  const bob = it.kind === 'ring' || it.kind === 'extra' || it.kind === 'nug' ? Math.sin(frame / 10 + it.x) * 2 : 0;
  const y = sy(it.z, it.h) + bob;
  if (it.kind === 'coin') {
    const w = Math.max(2, Math.round(10 * Math.abs(Math.cos(frame / 12 + it.x * .05))));
    ctx.drawImage(COIN, Math.round(it.x - camX - w / 2), Math.round(y - 10), w, 9);
  }
  else if (it.kind === 'nug') draw_(NUG, it.x - 4, y - 10);
  else if (it.kind === 'ring') draw_(RING, it.x - 4, y - 7);
  else if (it.kind === 'munchie') draw_(MUNCHIE, it.x - 4, y - 9);
  else if (it.kind === 'gold') draw_(GOLD_LEAF, it.x - 4, y - 10);
  else if (it.kind === 'extra') { draw_(EXTRAS[it.sub].img, it.x - 4, y - 10); if (frame % 20 === 0) puff(it.x, y - 8, 1, ['#ffffff', '#fff6b0', '#9ae8ff'], .4); }
}

function draw() {
  const th = lvl.theme;
  ctx.save();
  if (shake > 0) { ctx.translate(Math.round((Math.random() - .5) * shake), Math.round((Math.random() - .5) * shake)); shake *= 0.85; if (shake < 0.5) shake = 0; }
  ctx.drawImage(th.sky, 0, 0);
  drawLayer(th.clouds, 0.08, camX, frame * 0.1, 0);
  drawLayer(th.far, 0.2, camX, 0, -78);
  drawLayer(th.near, 0.45, camX, 0, -80);
  // the street
  const tiles = th.tiles, t0 = Math.floor(camX / T);
  for (let tx = t0; tx <= t0 + Math.ceil(W / T) + 1; tx++) {
    const X = Math.round(tx * T - camX);
    ctx.drawImage(tiles[TOP], X, FLOOR_Y - 12);
    for (let y = FLOOR_Y + 4; y < H; y += T) ctx.drawImage(tiles[FILL], X, y);
  }
  if (lvl.themeKey === 'city') for (let x = -((camX * 1) % 40); x < W; x += 40) R(ctx, '#ffd84a', Math.round(x), FLOOR_Y + 40, 20, 2);
  if (lvl.themeKey === 'suburb') R(ctx, '#e8e0f0', 0, FLOOR_Y + 2, W, 1);
  for (const x of lvl.deco) draw_(PLANT, x, FLOOR_Y - 24);
  drawSpot();
  // fight area edges
  const zn = lvl.zones[lvl.zi];
  if (lvl.locked && zn && frame % 30 < 20) { R(ctx, 'rgba(255,90,106,.5)', Math.round(zn.x0 + W - 4 - camX), FLOOR_Y, 3, ZMAX + 10); R(ctx, 'rgba(255,90,106,.5)', Math.round(zn.x0 + 2 - camX), FLOOR_Y, 3, ZMAX + 10); }

  // everything standing on the street, back to front
  const list = [];
  for (const it of lvl.items) if (!it.taken && Math.abs(it.x - camX - W / 2) < W) list.push({ z: it.z, d: () => { shadow(it.x, it.z, it.h || 0, 4); drawItem(it); } });
  for (const p of lvl.props) if (!p.broken) list.push({ z: p.z, d: () => { shadow(p.x, p.z, 0, 8); drawProp(p); } });
  for (const e of lvl.enemies) if (e.spawned && e.alive) list.push({ z: e.z, d: () => { shadow(e.x, e.z, e.h, e.kind === 'mouse' ? 5 : 7); drawEnemyB(e); } });
  const lg = lvl.legend;
  if (lg) list.push({ z: lg.z, d: () => {
    const L = LEGENDS[lg.who]; shadow(lg.x, lg.z, 0);
    draw_(L.img, lg.x - 7, sy(lg.z) - 18 + (frame % 60 < 30 ? 0 : 1), me.x < lg.x);
    text(L.name, lg.x - camX, sy(lg.z) - 28, '#ffd84a', 1, 'center');
    if (!lg.met && frame % 80 < 60) text('!', lg.x - camX, sy(lg.z) - 36, '#ffffff', 1, 'center');
    if (frame % 12 === 0) puff(lg.x + 5, sy(lg.z) - 12, 1, ['#ffffff', '#e8e4f4'], .3, -0.03);
  } });
  for (const r of remotes.values()) {
    if (r.tx < -500 || r.l !== lvl.n) continue;
    list.push({ z: r.z, d: () => { shadow(r.x, r.z, r.h); drawPlayer(r.x - 5, sy(r.z, r.h) - 17, r.f || 1, r.a, r.color, 0, 0, r.emote, r.name, r.b & 1, r.b & 2, r.b & 4, r.w, r.atkT || 0); } });
  }
  list.push({ z: me.z + 0.01, d: () => { shadow(me.x, me.z, me.h); drawPlayer(me.x - 5, sy(me.z, me.h) - 17, me.face, animFrame(me), me.color, me.sq, me.inv, me.emote, Net.online ? me.name : '', me.star > 0, ultra(), state === 'sitting', WEAPONS.indexOf(weaponDef()), me.atkT); } });
  for (const s of lvl.eshots) list.push({ z: s.z, d: () => {
    shadow(s.x, s.z, 14, 4); const x = Math.round(s.x - camX), y = sy(s.z, 14);
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.spin * 0.3); R(ctx, P.k, -4, -4, 8, 8); R(ctx, '#ff7ac8', -3, -3, 6, 6); R(ctx, '#ffd84a', -1, -5, 2, 2); ctx.restore();
  } });
  for (const s of shots) list.push({ z: s.z, d: () => {
    const x = Math.round(s.x - camX), y = sy(s.z, s.h);
    if (s.kind === 6) { ctx.fillStyle = P.k; circle(x, y, 4.5); ctx.fillStyle = '#7ac8ff'; circle(x, y, 3.5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 3, 2, 2); }
    else { ctx.globalAlpha = Math.min(1, s.life / 8); ctx.fillStyle = P.k; circle(x, y, 8); ctx.fillStyle = '#ffffff'; circle(x, y, 7); ctx.fillStyle = '#e8e4f4'; circle(x + 2, y + 2, 3); ctx.globalAlpha = 1; }
  } });
  list.sort((a, b) => a.z - b.z).forEach(o => o.d());

  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 15); ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x - camX), Math.round(p.y), p.s, p.s); ctx.globalAlpha = 1;
  }
  for (const p of popups) text(p.str, p.x - camX, p.y, p.col);
  if (lg && lg.met && me.legendT > 0 && state === 'play') {
    const L = LEGENDS[lg.who];
    ctx.fillStyle = 'rgba(42,24,56,.9)'; ctx.fillRect(10, 30, W - 20, 26);
    text(L.name + ':', 16, 34, '#ffd84a'); wrap('"' + L.tip + '"', 16, 43, 72, '#ffffff'); text('GIFT: ' + lg.gift, W - 16, 34, '#c8ffa0', 1, 'right');
  }
  ctx.restore();

  if (ultra() && state === 'play') { ctx.fillStyle = 'rgba(192,112,255,' + (0.06 + Math.sin(frame / 20) * 0.03) + ')'; ctx.fillRect(0, 0, W, H); }
  // GO arrow after clearing a fight
  const next = lvl.zones.find(z => !z.cleared);
  if (state === 'play' && !lvl.locked && frame % 40 < 26 && (!next || me.x < next.x0 + 40)) {
    text('GO', W - 30, 60, '#ffd84a', 2); R(ctx, '#ffd84a', W - 12, 62, 4, 6); R(ctx, '#ffd84a', W - 8, 64, 2, 2);
  }
  drawHUD();
  if (invOpen) drawInventory();
  if (state === 'results') drawShop();
}
function drawHUD() {
  if (state === 'results') return;
  ctx.fillStyle = 'rgba(42,24,56,.6)'; ctx.fillRect(0, 0, W, 17);
  const mh = maxHp();
  for (let i = 0; i < mh; i++) ctx.drawImage(i < me.hp ? (i >= 4 ? HEART_A : HEART) : HEART_E, 3 + i * 8, 3);
  ctx.drawImage(COIN, 3, 10 - 1, 7, 6); text(save.coins, 12, 10, '#ffd84a');
  // cooked meter
  const mx = 72, c = Math.round(me.cooked);
  ctx.drawImage(LEAF_ICON, mx, 2);
  R(ctx, P.k, mx + 9, 3, 62, 7); R(ctx, '#4a3a60', mx + 10, 4, 60, 5);
  R(ctx, c >= 100 ? ['#c070ff', '#c8ffa0', '#ff9ab8', '#ffd84a'][Math.floor(frame / 5) % 4] : c >= 50 ? '#7fe07a' : '#c8b890', mx + 10, 4, Math.round(60 * c / 100), 5);
  R(ctx, '#ffffff', mx + 40, 3, 1, 7);
  text(c >= 100 ? 'ULTRA COOKED!' : c >= 50 ? 'COOKED ' + c + '%' : 'SOBER-ISH ' + c + '%', mx + 9, 11, c >= 100 ? '#e4b3ff' : c >= 50 ? '#c8ffa0' : '#d8c8b0');
  // weapon + items
  const w = weaponDef();
  R(ctx, P.k, 146, 2, 14, 14); R(ctx, '#4a3a60', 147, 3, 12, 12); ctx.drawImage(ICONS[w.icon], 148, 4);
  if (me.atkCd > 0) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(147, 3, 12, Math.round(12 * me.atkCd / w.cd)); }
  if (save.munchie > 0) { ctx.drawImage(MUNCHIE, 164, 4); text('x' + save.munchie, 174, 6, '#ff9ab8'); }
  let bx = 212;
  for (const [k, ex] of [['speed', 'shatter'], ['magnet', 'kief'], ['power', 'hash']]) if (me.buffs[k] > 0 && (me.buffs[k] > 120 || frame % 10 < 6)) { ctx.drawImage(EXTRAS[ex].img, bx, 4); bx += 11; }
  if (me.star > 0) { ctx.drawImage(GOLD_LEAF, 188, 4); R(ctx, '#ffd84a', 198, 8, Math.ceil(me.star / 540 * 20), 3); }
  text(lvl.name[0], W - 4, 3, '#ffffff', 1, 'right');
  text(lvl.name[1], W - 4, 10, '#b0a8c0', 1, 'right');
  if (Net.online) { text('ROOM ' + Net.code + '  ' + (remotes.size + 1) + '/4', W - 4, 20, '#e4b3ff', 1, 'right'); }
  else if (Net.reconnecting) text('RECONNECTING...', W - 4, 20, '#ff8a8a', 1, 'right');
  if (!musicOn) text('MUSIC OFF', 4, 20, '#b0a8c0');

  if (me.combo >= 3) {
    const col = me.combo >= 10 ? ['#c8ffa0', '#e4b3ff', '#ffd84a', '#ffffff'][Math.floor(frame / 4) % 4] : '#fff';
    text(me.combo + 'x COMBO', W / 2, 22, col, 1, 'center');
    if (me.combo >= 10) text('BLAZED!', W / 2, 30, col, 2, 'center');
  }
  if (banner) {
    ctx.globalAlpha = Math.min(1, banner.t / 20);
    ctx.fillStyle = 'rgba(42,24,56,.75)'; ctx.fillRect(0, 62, W, banner.b ? 34 : 22);
    text(banner.a, W / 2, 68, '#c8ffa0', 2, 'center');
    if (banner.b) text(banner.b, W / 2, 84, '#fff', 1, 'center');
    ctx.globalAlpha = 1;
  }
  if (state === 'sitting') {
    ctx.fillStyle = 'rgba(42,24,56,.75)'; ctx.fillRect(40, 110, W - 80, 36);
    text('CHILLING AT THE SMOKE SPOT', W / 2, 115, '#c8ffa0', 1, 'center');
    if (Net.online) {
      text((finInfo ? finInfo.n : 1) + '/' + (remotes.size + 1) + ' OF THE CREW MADE IT', W / 2, 125, '#ffffff', 1, 'center');
      text(hurryT > 0 ? 'CREW HAS ' + Math.ceil(hurryT / 60) + 'S TO GET HERE' : finInfo && finInfo.hurried ? 'CALLED THE CREW...' : 'ENTER = CALL THE CREW (20S TIMER)', W / 2, 135, '#e4b3ff', 1, 'center');
    }
  } else if (hurryT > 0 && state === 'play') {
    ctx.fillStyle = 'rgba(42,24,56,.75)'; ctx.fillRect(60, 24, W - 120, 20);
    text('THE CREW IS WAITING! ' + Math.ceil(hurryT / 60) + 'S', W / 2, 28, '#ffd84a', 1, 'center');
    text('GET TO THE SMOKE SPOT', W / 2, 36, '#ffffff', 1, 'center');
  }
  if (paused) { ctx.fillStyle = 'rgba(42,24,56,.6)'; ctx.fillRect(0, 0, W, H); text('PAUSED', W / 2, 80, '#c8ffa0', 3, 'center'); text('P OR ESC TO RESUME', W / 2, 104, '#fff', 1, 'center'); }
}

function drawInventory() {
  ctx.fillStyle = '#2a1838'; ctx.fillRect(16, 20, W - 32, H - 34);
  R(ctx, '#c8ffa0', 16, 20, W - 32, 1);
  text('INVENTORY', W / 2, 25, '#c8ffa0', 2, 'center');
  text('WEAPONS  (1-5 OR Q TO SWITCH)', 26, 42, '#ffd84a');
  WEAPONS.forEach((w, i) => {
    const has = save.weapons.includes(w.id), sel = save.weapon === w.id, x = 28 + i * 54;
    R(ctx, sel ? '#c8ffa0' : P.k, x - 2, 51, 16, 16); R(ctx, '#4a3a60', x - 1, 52, 14, 14);
    ctx.globalAlpha = has ? 1 : .25; ctx.drawImage(ICONS[w.icon], x + 1, 54); ctx.globalAlpha = 1;
    text((i + 1) + '', x + 16, 52, '#b0a8c0');
    text(has ? w.name.split(' ').pop() : '???', x + 6, 70, has ? '#fff' : '#6a6080', 1, 'center');
  });
  text('ARMOR', 26, 84, '#ffd84a');
  [...ARMORS, { id: 'pouch', name: 'STASH POUCH', icon: 'pouch' }].forEach((a, i) => {
    const has = a.id === 'pouch' ? save.pouch : save.armor.includes(a.id), x = 28 + i * 70;
    ctx.globalAlpha = has ? 1 : .25; ctx.drawImage(ICONS[a.icon], x, 93); ctx.globalAlpha = 1;
    text(has ? a.name : '???', x + 12, 95, has ? '#fff' : '#6a6080');
  });
  text('ITEMS', 26, 112, '#ffd84a');
  ctx.drawImage(ICONS.munchie, 28, 120); text('MUNCHIES x' + save.munchie + ' (C)', 40, 122, '#fff');
  ctx.drawImage(ICONS.preroll, 130, 121); text('PRE-ROLL x' + save.preroll, 142, 122, '#fff');
  ctx.drawImage(ICONS.gold, 212, 119); text('GOLD LEAF x' + save.gold, 224, 122, '#fff');
  text('FARM FUND  ' + save.coins + ' / ' + FARM_PRICE + '    SMOKE SPOTS ' + Math.min(save.spots, SPOTS_TO_FARM) + ' / ' + SPOTS_TO_FARM, W / 2, 140, '#c8ffa0', 1, 'center');
  R(ctx, P.k, 40, 150, W - 80, 6); R(ctx, '#ffd84a', 41, 151, Math.round((W - 82) * Math.min(1, save.coins / FARM_PRICE)), 4);
  text('I - CLOSE', W / 2, 164, '#b0a8c0', 1, 'center');
}

function drawMap(y) {
  const n = SPOTS_TO_FARM, x0 = 36, dx = (W - 90) / n;
  R(ctx, '#6a6080', x0, y + 5, dx * n, 2);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * dx, done = i < save.spots;
    R(ctx, P.k, x - 5, y, 12, 12); R(ctx, done ? '#7fe07a' : '#4a3a60', x - 4, y + 1, 10, 10);
    if (done) R(ctx, '#ffffff', x - 1, y + 2, 4, 3);
    text((i + 1) + '', x + 1, y + 14, done ? '#c8ffa0' : '#6a6080', 1, 'center');
  }
  ctx.drawImage(ICONS.farm, x0 + n * dx - 4, y - 1);
  const pos = Math.min(save.spots, n);
  ctx.drawImage(PLAYER[me.color][0], x0 + Math.max(0, pos - 1) * dx - 7 + (pos ? 0 : -12), y - 20);
}
// ============================================================
//  RESULTS + SHOP (between missions)
// ============================================================
function shopEntries() { return [...SHOP, { kind: 'ready', name: Net.online ? 'READY FOR NEXT MISSION' : 'NEXT MISSION', icon: 'puff', price: 0, desc: 'LETS GO' }]; }
function itemStatus(it) {
  if (it.kind === 'weapon' && save.weapons.includes(it.id)) return 'OWNED';
  if (it.kind === 'armor' && save.armor.includes(it.id)) return 'OWNED';
  if (it.kind === 'item' && save.pouch) return 'OWNED';
  if (it.kind === 'use' && save[it.id] >= 3) return 'MAX 3';
  if (it.kind === 'farm') { if (save.farm) return 'YOURS!'; if (save.spots < SPOTS_TO_FARM) return 'LOCKED'; }
  if (it.kind === 'ready') return readyInfo && readyInfo.me ? 'WAITING ' + readyInfo.n + '/' + readyInfo.of : '';
  return null;
}
function updateShop() {
  if (results.farmScene) { if (K.enterPressed || K.jumpPressed) results.farmScene = false; return; }
  const list = shopEntries();
  if (K.upPressed) { shopSel = (shopSel - 1 + list.length) % list.length; SFX.tick(); }
  if (K.downPressed) { shopSel = (shopSel + 1) % list.length; SFX.tick(); }
  K.upPressed = K.downPressed = false;
  if (!(K.enterPressed || K.jumpPressed || K.attackPressed)) return;
  const it = list[shopSel];
  if (it.kind === 'ready') {
    if (Net.online) { if (!readyInfo || !readyInfo.me) { Net.send({ t: 'ready' }); readyInfo = { me: true, n: 1, of: remotes.size + 1 }; SFX.cp(); } }
    else startLevel(results.made ? lvl.n + 1 : lvl.n);
    return;
  }
  const st = itemStatus(it);
  if (st) { SFX.bump(); results.msg = st === 'LOCKED' ? 'REACH ' + SPOTS_TO_FARM + ' SMOKE SPOTS FIRST' : 'CANT BUY THAT'; return; }
  if (save.coins < it.price) { SFX.bump(); results.msg = 'NEED ' + (it.price - save.coins) + ' MORE HASH COINS'; return; }
  save.coins -= it.price;
  if (it.kind === 'weapon') { save.weapons.push(it.id); save.weapon = it.id; }
  else if (it.kind === 'armor') save.armor.push(it.id);
  else if (it.kind === 'item') save.pouch = true;
  else if (it.kind === 'use') save[it.id]++;
  else if (it.kind === 'farm') { save.farm = true; results.farmScene = true; SFX.flag(); }
  persist(); SFX.buy(); results.msg = 'BOUGHT ' + it.name + '!';
}
function drawShop() {
  ctx.fillStyle = '#1e122c'; ctx.fillRect(0, 0, W, H);
  if (results.farmScene) {
    const g = ctx; R(g, '#9ad8ff', 0, 0, W, 120); R(g, '#7fe07a', 0, 120, W, 72);
    for (let i = 0; i < 14; i++) g.drawImage(PLANT, 8 + i * 22, 110 + (i % 2) * 8);
    g.drawImage(ICONS.farm, W / 2 - 6, 60);
    text('YOU BOUGHT THE POT FARM!', W / 2, 20, '#2a1838', 2, 'center');
    text('THE CREW NEVER HAS TO WORRY AGAIN', W / 2, 40, '#2a1838', 1, 'center');
    text('(KEEP PLAYING FOR MORE COINS + GEAR)', W / 2, 172, '#2a1838', 1, 'center');
    ctx.drawImage(PLAYER[me.color][0], W / 2 - 8, 100);
    return;
  }
  const r = results;
  text(r.made ? 'SMOKE SPOT ' + (lvl.n + 1) + ' REACHED!' : 'MISSION OVER', W / 2, 4, r.made ? '#c8ffa0' : '#ff8a8a', 2, 'center');
  text('COINS +' + r.earned + '   STOLEN/LOST -' + r.lost + '   COOKED ' + r.cooked + '%   KOS ' + r.kills + (r.ultraBonus ? '   ULTRA x2!' : ''), W / 2, 18, '#ffffff', 1, 'center');
  drawMap(44);
  // shop list
  text('HEAD SHOP', 8, 66, '#ffd84a', 1);
  text('YOUR STASH: ' + save.coins, W - 8, 66, '#ffd84a', 1, 'right');
  const list = shopEntries(), rows = 10, start = Math.max(0, Math.min(shopSel - 4, list.length - rows));
  for (let i = start; i < Math.min(list.length, start + rows); i++) {
    const it = list[i], y = 76 + (i - start) * 10, sel = i === shopSel, st = itemStatus(it);
    if (sel) { R(ctx, '#4a3a60', 4, y - 1, 190, 10); R(ctx, '#c8ffa0', 4, y - 1, 2, 10); }
    if (it.kind !== 'ready') ctx.drawImage(ICONS[it.icon], 8, y - 1, 9, 9);
    text(it.name, it.kind === 'ready' ? 10 : 20, y + 1, it.kind === 'ready' ? '#c8ffa0' : st ? '#8a809a' : '#ffffff');
    if (it.kind !== 'ready') text(st || it.price, 192, y + 1, st ? '#8a809a' : save.coins >= it.price ? '#ffd84a' : '#ff8a8a', 1, 'right');
    else if (st) text(st, 192, y + 1, '#e4b3ff', 1, 'right');
  }
  const it = list[shopSel];
  R(ctx, '#4a3a60', 202, 76, 112, 96);
  if (it.kind !== 'ready') ctx.drawImage(ICONS[it.icon], 246, 80, 20, 20);
  wrap(it.desc, 206, 106, 26, '#ffffff');
  if (r.msg) wrap(r.msg, 206, 142, 26, '#ffd84a');
  text('UP/DOWN PICK   ENTER BUY', W / 2, 183, '#8a809a', 1, 'center');
}
function wrap(str, x, y, width, col) {
  const words = String(str).split(' '); let line = '';
  for (const w of words) { if ((line + w).length > width) { text(line, x, y, col); y += 8; line = ''; } line += w + ' '; }
  if (line) text(line, x, y, col);
}
// ============================================================
//  MAIN LOOP (fixed 60 updates / second)
// ============================================================
let last = 0, acc = 0;
function loop(t) {
  if (!last) last = t;
  acc += Math.min(100, t - last); last = t;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(loop);
}

// ============================================================
//  NETWORK
// ============================================================
const Net = {
  ws: null, online: false, reconnecting: false, id: 'me', hostId: 'me', code: '', color: 0, name: 'STONER', level: 0, phase: 'play', pendingCollected: [],
  send(o) { if (this.online && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },
  connect(first) {
    return new Promise((resolve, reject) => {
      if (location.protocol === 'file:') return reject(new Error('Online play needs the server. Run start.bat, then open localhost:3000'));
      let ws;
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
      catch (e) { return reject(new Error('Could not reach the game server')); }
      const timer = setTimeout(() => { ws.close(); reject(new Error('Server did not answer')); }, 9000);
      ws.onopen = () => ws.send(JSON.stringify(first));
      ws.onerror = () => { clearTimeout(timer); reject(new Error('Could not reach the game server')); };
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.t === 'err') { clearTimeout(timer); ws.close(); reject(new Error(m.msg)); return; }
        if (m.t !== 'joined') return;
        clearTimeout(timer);
        this.ws = ws; this.online = true; this.reconnecting = false;
        this.code = m.code; this.color = m.color; this.level = m.level; this.phase = m.phase; this.id = m.id; this.hostId = m.host;
        remotes.clear(); m.players.forEach(addRemote);
        ws.onmessage = e2 => { try { onNet(JSON.parse(e2.data)); } catch (err) { console.error(err); } };
        ws.onerror = null;
        ws.onclose = () => { if (this.ws === ws) this.lost(); };
        if (running) {
          me.color = m.color;
          if (m.level !== lvl.n) startLevel(m.level);
          m.collected.forEach(id => applyCollected(id, m.level));
          banner = { t: 90, a: 'RECONNECTED!', b: '' };
        } else this.pendingCollected = m.collected.map(id => ({ id, l: m.level }));
        resolve();
      };
    });
  },
  lost() {
    this.online = false; this.ws = null; remotes.clear(); this.hostId = this.id;
    if (this.reconnecting) return;
    this.reconnecting = true;
    banner = { t: 120, a: 'CONNECTION LOST', b: 'TRYING TO RECONNECT...' };
    let tries = 0;
    const attempt = () => {
      if (this.online) return;
      if (++tries > 30) { this.reconnecting = false; banner = { t: 600, a: 'DISCONNECTED', b: 'REFRESH THE PAGE TO REJOIN' }; return; }
      this.connect({ t: 'join', code: this.code, name: this.name }).catch(() => setTimeout(attempt, 2500));
    };
    setTimeout(attempt, 1000);
  }
};
function addRemote(p) { remotes.set(p.id, { name: p.name, color: p.color, x: -1000, z: 30, h: 0, tx: -1000, tz: 30, th: 0, f: 1, a: 0, b: 0, l: -1, w: 0, c: 0, atkT: 0, emote: null }); }
function onNet(m) {
  switch (m.t) {
    case 's': { const r = remotes.get(m.id); if (!r) return; if (r.tx < -500 || r.l !== m.l) { r.x = m.x; r.z = m.y; r.h = m.h; } Object.assign(r, { tx: m.x, tz: m.y, th: m.h, f: m.f, a: m.a, b: m.b, l: m.l, w: m.w, c: m.c }); break; }
    case 'fx': {
      const r = remotes.get(m.id); if (!r || r.l !== lvl.n) break;
      r.atkT = 12;
      if (m.k === 5) shots.push({ mine: false, x: m.x + m.f * 10, z: m.y, h: m.h + 8, vx: m.f * 3.6, life: 26, kind: 5 });
      if (m.k === 2) shots.push({ mine: false, x: m.x + m.f * 12, z: m.y, h: m.h + 10, vx: m.f * 4.2, life: 40, kind: 6 });
      break;
    }
    case 'es': if (!isHost()) applySnapshot(m); break;
    case 'hit': if (isHost() && m.l === lvl.n) { const e = lvl.enemies[m.i]; if (e && e.spawned) damageEnemy(e, m.d, m.dir, !!m.s, m.id); } break;
    case 'kill': if (m.l === lvl.n) { const e = lvl.enemies[m.i]; if (e) onKill(e, m.by); } break;
    case 'eshot': if (m.l === lvl.n) lvl.eshots.push({ x: m.x, z: m.z, vx: m.vx, life: 150, spin: 0 }); break;
    case 'steal': if (isHost() && m.l === lvl.n) { const e = lvl.enemies[m.i]; if (e) thiefFlee(e, m.k); } break;
    case 'host': Net.hostId = m.id; if (m.id === Net.id) popup(camX + W / 2 - 40, 50, 'YOU ARE NOW HOSTING', '#e4b3ff'); break;
    case 'pj': addRemote(m); popup(camX + W / 2 - 30, 60, m.name + ' JOINED!', '#c8ffa0'); SFX.cp(); break;
    case 'pl': { const r = remotes.get(m.id); if (r) popup(camX + W / 2 - 30, 60, r.name + ' LEFT', '#b0a8c0'); remotes.delete(m.id); break; }
    case 'col': applyCollected(m.id, m.l); break;
    case 'fin': {
      if (finInfo) finInfo.n = m.n;
      const r = remotes.get(m.id); if (r && m.id !== undefined) popup(camX + W / 2 - 40, 50, r.name + ' MADE IT TO THE SPOT!', '#c8ffa0');
      break;
    }
    case 'hurry': hurryT = 20 * 60; banner = { t: 120, a: m.name + ' CALLED THE CREW!', b: '20 SECONDS TO REACH THE SMOKE SPOT' }; SFX.karen(); break;
    case 'allfin': toResults(); break;
    case 'ready': if (readyInfo) { readyInfo.n = m.n; readyInfo.of = m.of; } else readyInfo = { me: false, n: m.n, of: m.of }; break;
    case 'level': startLevel(m.n); break;
    case 'emote': { const r = remotes.get(m.id); if (r) r.emote = { e: m.e % EMOTES.length, t: 120 }; break; }
  }
}

// ============================================================
//  MENU
// ============================================================
const $ = id => document.getElementById(id);
try { $('name').value = localStorage.getItem('kq_name') || ''; } catch (e) {}
function getName() {
  const n = ($('name').value || 'STONER').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').slice(0, 10) || 'STONER';
  try { localStorage.setItem('kq_name', n); } catch (e) {}
  return n;
}
function showSave() {
  $('save').textContent = save.spots || save.coins ? 'YOUR STASH: ' + save.coins + ' HASH COINS · SMOKE SPOTS ' + Math.min(save.spots, SPOTS_TO_FARM) + '/' + SPOTS_TO_FARM + (save.farm ? ' · FARM OWNER' : '') : 'NEW GAME - SAVE UP ' + FARM_PRICE + ' HASH COINS FOR YOUR OWN POT FARM';
}
showSave();
function startGame() {
  initAudio();
  $('menu').style.display = 'none';
  document.body.classList.add('playing');
  running = true;
  startLevel(Net.online ? Net.level : Math.min(save.spots, 99));
  if (Net.online) {
    banner = { t: 260, a: 'ROOM CODE: ' + Net.code, b: 'SEND THIS CODE (OR LINK) TO YOUR CREW' };
    if (Net.phase === 'shop') { results = { made: false, earned: 0, lost: 0, spotBonus: 0, ultraBonus: 0, cooked: 0, kills: 0, best: 0, msg: 'CREW IS SHOPPING - JOIN THEM' }; state = 'results'; }
  }
  requestAnimationFrame(loop);
}
function busy(on) { ['solo', 'create', 'join'].forEach(id => $(id).disabled = on); }
async function goOnline(msg) {
  $('err').textContent = 'CONNECTING...'; busy(true);
  try { await Net.connect(msg); startGame(); }
  catch (e) { $('err').textContent = e.message.toUpperCase(); busy(false); }
}
$('solo').onclick = () => { Net.name = getName(); startGame(); };
$('create').onclick = () => { Net.name = getName(); goOnline({ t: 'create', name: Net.name, level: Math.min(save.spots, 99) }); };
$('join').onclick = () => {
  const code = $('code').value.trim().toUpperCase();
  if (code.length < 5) { $('err').textContent = 'ENTER THE 5-LETTER ROOM CODE'; return; }
  Net.name = getName(); goOnline({ t: 'join', code, name: Net.name });
};
$('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('join').click(); });
$('reset').onclick = () => { if ($('reset').dataset.sure) { save = defaultSave(); persist(); showSave(); $('reset').textContent = 'SAVE RESET'; delete $('reset').dataset.sure; } else { $('reset').dataset.sure = 1; $('reset').textContent = 'CLICK AGAIN TO WIPE YOUR SAVE'; } };
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) { $('code').value = urlRoom.toUpperCase().slice(0, 5); $('err').textContent = 'ENTER YOUR NAME AND PRESS JOIN'; }

lvl = buildLevel(0); me = makePlayer(); camX = 0; draw();
window.__KQ = { get me() { return me; }, get lvl() { return lvl; }, get state() { return state; }, get save() { return save; }, K, remotes, Net, startLevel, toResults };
})();
