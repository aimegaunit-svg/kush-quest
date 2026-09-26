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
const K = { left: false, right: false, jump: false, run: false, attack: false, enter: false };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump',
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
    if (state === 'results') { if (k === 'left') K.upPressed = true; else if (k === 'right') K.downPressed = true; else K.enterPressed = true; return; }
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

// --- players: round "Budlings" with a leaf sprout (Kirby-ish styling, original characters) ---
const BODY_COLORS = [
  { b: '#8ef0b0', B: '#4fc47e', f: '#2f8e5a', name: 'MINT' },
  { b: '#ffc49a', B: '#e88a5a', f: '#b0502e', name: 'PEACH' },
  { b: '#d4b4ff', B: '#9a74e8', f: '#6040b0', name: 'GRAPE' },
  { b: '#9ad4ff', B: '#5a9ae8', f: '#2e62b0', name: 'SKY' },
];
const SHIRTS = BODY_COLORS.map(c => c.B);
const BUD_TOP = [
  '.......GG.......',
  '......GLGG......',
  '.......g........',
  '.....kkkkkk.....',
  '...kkbbbbbbkk...',
  '..kbbbbbbbbbbk..',
  '..kbBBbbbbBBbk..',
  '.kbbbkbbbbkbbbk.',
  '.kbcckbbbbkccbk.',
];
const BUD_MOUTH = '.kbbbbbkkbbbbbk.';
const BUD_MOUTH_OPEN = '.kbbbbkRRkbbbbk.';
const BUD_LOW = [
  '.kbbbbbbbbbbbbk.',
  '..kbbbbbbbbbbk..',
  '..kBbbbbbbbbBk..',
  '...kkBBBBBBkk...',
];
const FEET_STAND = ['..kffk....kffk..', '..kkkk....kkkk..'];
const FEET_WALK = ['.kffk......kffk.', '.kkkk......kkk..'];
const FEET_WALK2 = ['...kffk..kffk...', '...kkkk..kkkk...'];
const FEET_JUMP = ['....kffkkffk....', '.....kk..kk.....'];
const PUFF_ROWS = [
  '........GG........',
  '.......GLGG.......',
  '........g.........',
  '.....kkkkkkkk.....',
  '...kkbbbbbbbbkk...',
  '..kbbbbbbbbbbbbk..',
  '.kbbbbbbbbbbbbbbk.',
  '.kbbBBbbbbbbBBbbk.',
  'kbbbbkbbbbbbkbbbbk',
  'kbcccbbbbbbbbcccbk',
  'kbcccbbbbkbbbcccbk',
  'kbbbbbbbkkkbbbbbbk',
  '.kbbbbbbbkbbbbbbk.',
  '.kBbbbbbbbbbbbbBk.',
  '..kkBBBBBBBBBBkk..',
  '...kffk....kffk...',
  '...kkkk....kkkk...',
];
// frames: 0 stand, 1 walk, 2 walk2, 3 jump, 4 puffed, 5 attack
const PLAYER = BODY_COLORS.map(col => {
  const pal = { ...P, b: col.b, B: col.B, f: col.f };
  const f = (mouth, feet) => sprite([...BUD_TOP, mouth, ...BUD_LOW, ...feet], pal);
  return [f(BUD_MOUTH, FEET_STAND), f(BUD_MOUTH, FEET_WALK), f(BUD_MOUTH, FEET_WALK2), f(BUD_MOUTH, FEET_JUMP), sprite(PUFF_ROWS, pal), f(BUD_MOUTH_OPEN, FEET_STAND)];
});

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

// --- weapons, armor, shop ---
const WEAPONS = [
  { id: 'puff', name: 'SMOKE PUFF', icon: 'puff', dmg: 1, cd: 22, price: 0, desc: 'FREE. SHORT PUFF OF SMOKE' },
  { id: 'lighter', name: 'LIGHTER', icon: 'lighter', dmg: 2, cd: 12, price: 90, desc: 'CLOSE FLAME BURST' },
  { id: 'bong', name: 'BONG BLASTER', icon: 'bong', dmg: 1, cd: 11, price: 160, desc: 'FAST LONG RANGE BUBBLES' },
  { id: 'boomer', name: 'PAPER BOOMERANG', icon: 'boomer', dmg: 2, cd: 30, price: 200, desc: 'FLIES OUT AND COMES BACK' },
  { id: 'grinder', name: 'GRINDER SPIN', icon: 'grinder', dmg: 3, cd: 40, price: 280, desc: 'SPIN ATTACK ALL AROUND' },
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
function drawLayer(img, factor, camX, drift = 0) {
  const off = ((camX * factor + drift) % W + W) % W;
  ctx.drawImage(img, -Math.floor(off), 0); ctx.drawImage(img, W - Math.floor(off), 0);
}
// ============================================================
//  MISSIONS (built from hand-made chunks, same seed = same level for everyone)
// ============================================================
let COLS = 0;
const MISSION_LOOT = ['lighter', 'hoodie', 'boomer', 'vest', 'pouch', 'crown', 'bong', 'grinder'];
function missionName(n) {
  const th = THEMES[THEME_ORDER[n % 3]];
  return ['MISSION ' + (n + 1), th.name + (n >= 3 ? ' REMIX' : '')];
}

function buildLevel(n) {
  const themeKey = THEME_ORDER[n % 3], theme = THEMES[themeKey];
  const diff = Math.min(n, 8);
  let s = 1000 + n * 7919; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rand() * a.length)];

  COLS = 230;
  const m = [...Array(ROWS)].map(() => new Array(230).fill(EMPTY));
  const coins = [], nugs = [], rings = [], munchies = [], enemies = [], chests = [], deco = [];
  const set = (x, y, t) => { if (m[y] && x >= 0 && x < COLS) m[y][x] = t; };
  const ground = (x0, x1) => { for (let x = x0; x <= x1; x++) { set(x, 10, TOP); set(x, 11, FILL); } };
  const plat = (x, y, len, t = BLOCK) => { for (let i = 0; i < len; i++) set(x + i, y, t); };
  const pipe = (x, h) => { for (let i = 0; i < h; i++) { const y = 9 - i, top = i === h - 1; set(x, y, top ? PTL : PL); set(x + 1, y, top ? PTR : PR); } };
  const coin = (x, y) => coins.push({ x: x * T + 3, y: y * T + 3, id: 'c' + coins.length, taken: false });
  const row = (x, y, k) => { for (let i = 0; i < k; i++) coin(x + i, y); };
  const arc = (x, y, k) => { for (let i = 0; i < k; i++) coin(x + i, y - Math.round(Math.sin(i / Math.max(1, k - 1) * Math.PI) * 2)); };
  const nug = (x, y) => nugs.push({ x: x * T + 3, y: y * T + 3, id: 'n' + nugs.length, taken: false });
  const ring = (x, y) => rings.push({ x: x * T + 4, y: y * T + 5, id: 'r' + rings.length, taken: false });
  const foe = (x, y = 9, kind = null) => {
    kind = kind || pick(theme.enemies);
    const size = { cop: [14, 18], karen: [14, 18], mouse: [12, 8], squirrel: [12, 12] }[kind];
    const hp = { cop: 3 + (diff > 3 ? 1 : 0), karen: 2, mouse: 1, squirrel: 1 }[kind];
    enemies.push({ kind, id: 'e' + enemies.length, x: x * T + 1, y: (y + 1) * T - size[1], w: size[0], h: size[1], hp, vx: 0, vy: 0, dir: -1, alive: true, dead: 0, flash: 0, onGround: false, active: false, cd: 60 + Math.floor(rand() * 60), state: 'patrol', stolen: 0 });
  };
  const extras = [];
  const extra = (x, y, kind) => extras.push({ x: x * T + 3, y: y * T + 4, kind, id: 'x' + extras.length, taken: false });
  const plant = x => deco.push({ x: x * T + 1, y: 10 * T - 13 });

  // ---- chunk library: each takes x and returns its width ----
  const CH = {
    flat: x => { ground(x, x + 9); row(x + 3, 8, 4); if (rand() < .5) plant(x + 1); foe(x + 7); return 10; },
    gap: x => {
      const g = 2 + Math.floor(rand() * 3);
      ground(x, x + 2); ground(x + 3 + g, x + 7 + g);
      arc(x + 2, 7, g + 2); if (rand() < .6) nug(x + 3 + Math.floor(g / 2), 3);
      return 8 + g;
    },
    platforms: x => {
      ground(x, x + 11); plat(x + 2, 7, 4); plat(x + 7, 4, 4);
      row(x + 2, 6, 4); nug(x + 8, 3); ring(x + 10, 3); foe(x + 9);
      return 12;
    },
    stairs: x => {
      ground(x, x + 11);
      for (let i = 0; i < 4; i++) for (let j = 0; j <= i; j++) { set(x + 2 + i, 9 - j, BLOCK); set(x + 9 - i, 9 - j, BLOCK); }
      row(x + 5, 4, 2); ring(x + 5, 2); ring(x + 6, 2);
      return 12;
    },
    boxes: x => {
      ground(x, x + 9);
      set(x + 3, 6, BOX); set(x + 4, 6, BLOCK); set(x + 5, 6, rand() < .5 ? BOX_NUG : BOX); set(x + 6, 6, BLOCK); set(x + 7, 6, BOX);
      row(x + 3, 4, 5); foe(x + 8);
      return 10;
    },
    pipes: x => {
      ground(x, x + 11); pipe(x + 2, 2 + Math.floor(rand() * 2)); pipe(x + 8, 3 + Math.floor(rand() * 2));
      row(x + 5, 8, 2); ring(x + 5, 5); ring(x + 6, 5); foe(x + 5);
      return 12;
    },
    highroad: x => {
      ground(x, x + 13); plat(x + 2, 3, 10);
      row(x + 3, 2, 8); nug(x + 11, 1); extra(x + 2, 1, pick(['diamond', 'shatter'])); foe(x + 5); foe(x + 10);
      ring(x + 1, 6); ring(x + 12, 6);
      return 14;
    },
    pit: x => { // wide gap with floating blocks (float over it)
      ground(x, x + 1); plat(x + 4, 7, 2); plat(x + 9, 6, 2); ground(x + 13, x + 15);
      arc(x + 2, 5, 12); nug(x + 9, 3); extra(x + 4, 4, pick(['kief', 'hash']));
      return 16;
    },
    gang: x => { ground(x, x + 13); row(x + 2, 9, 10); foe(x + 4); foe(x + 8); foe(x + 11); plant(x + 1); return 14; },
  };
  const pool = ['flat', 'gap', 'platforms', 'stairs', 'boxes', 'pipes', 'highroad', 'pit', 'gang'];

  // ---- assemble ----
  let x = 0;
  ground(0, 11); row(6, 8, 4); plant(2); x = 12;             // safe start
  let cpX = 0, chestDone = false, legend = null;
  while (x < 170) {
    if (!cpX && x >= 88) { ground(x, x + 7); cpX = x + 3; legend = { x: (x + 5) * T, y: 10 * T - 18, who: n % LEGENDS.length, met: false }; x += 8; continue; } // checkpoint area
    if (!chestDone && x >= 60) { // loot chest on a little ledge
      ground(x, x + 9); plat(x + 3, 7, 4); chests.push({ x: (x + 4) * T + 1, y: 7 * T - 9, id: 'k0', open: false, loot: MISSION_LOOT[n % MISSION_LOOT.length] });
      munchies.push({ x: (x + 8) * T + 3, y: 8 * T + 4, id: 'm0', taken: false }); foe(x + 1); chestDone = true; x += 10; continue;
    }
    let k = pick(pool);
    if (diff < 1 && (k === 'gang' || k === 'pit')) k = 'flat';
    x += CH[k](x);
    if (rand() < 0.15 + diff * 0.04) foe(x - 2);                  // more enemies as missions go on
  }
  // gold box somewhere in the middle
  for (let gx = 40; gx < 150; gx++) if (m[10][gx] === TOP && m[6][gx] === EMPTY && m[9][gx] === EMPTY && m[7][gx] === EMPTY && gx % 7 === (n % 7)) { set(gx, 6, GOLDBOX); break; }
  // make sure there are enough nugs to get cooked
  // at least 3 bonus pickups per mission
  const bonusKinds = ['shatter', 'diamond', 'kief', 'hash'];
  for (let bx = 30; extras.length < 3 && bx < 160; bx += 37) extra(bx, 4, bonusKinds[(bx + n) % 4]);
  while (nugs.length < 6) nug(20 + nugs.length * 25, 5);
  // final stretch + the smoke spot
  const endX = x; ground(endX, COLS - 1);
  row(endX + 2, 8, 6); ring(endX + 9, 7); ring(endX + 10, 6); ring(endX + 11, 7);
  const spot = { x: (endX + 16) * T, y: 10 * T, w: 48 };
  COLS = endX + 24;

  return {
    n, themeKey, theme, name: missionName(n), map: m, coins, nugs, rings, munchies, enemies, chests, deco, extras, legend, bumps: [], drops: [],
    cp: { x: cpX * T, y: 10, active: false }, spot, spawn: { x: 2 * T, y: 9 * T - 13 }
  };
}
// ============================================================
//  SAVE DATA (each player keeps their own stash + gear)
// ============================================================
const SAVE_KEY = 'kq_save_v2';
function defaultSave() { return { coins: 0, spots: 0, weapons: ['puff'], armor: [], pouch: false, munchie: 1, preroll: 0, gold: 0, weapon: 'puff', farm: false }; }
let save = defaultSave();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') save = { ...defaultSave(), ...s }; } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
const maxHp = () => 4 + ARMORS.reduce((m, a) => save.armor.includes(a.id) ? Math.max(m, a.hp) : m, 0);
const weaponDef = () => WEAPONS.find(w => w.id === save.weapon) || WEAPONS[0];

// ============================================================
//  WORLD STATE
// ============================================================
let lvl, me, camX = 0, state = 'play', frame = 0, running = false, paused = false, invOpen = false;
let particles = [], popups = [], shots = [], enemyShots = [], banner = null, shake = 0;
let finInfo = null, hurryT = 0, results = null, shopSel = 0, readyInfo = null;
const remotes = new Map();

function makePlayer() {
  return {
    x: lvl.spawn.x, y: lvl.spawn.y, w: 12, h: 13, vx: 0, vy: 0, onGround: false, face: 1,
    puffed: false, flaps: 0, coyote: 0, jumpBuf: 0, cut: false, inv: 60, walkT: 0, sq: 0, star: 0,
    hp: maxHp(), cooked: 0, buffs: { speed: 0, magnet: 0, power: 0 }, legendT: 0, combo: 0, comboT: 0, best: 0, atkCd: 0, atkT: 0,
    earned: 0, lost: 0, kills: 0, nugs: 0,
    resX: lvl.spawn.x, resY: lvl.spawn.y, trail: [], color: Net.color, name: Net.name, emote: null
  };
}

function startLevel(n) {
  lvl = buildLevel(n);
  me = makePlayer();
  camX = 0; state = 'play'; particles = []; popups = []; shots = []; enemyShots = [];
  finInfo = null; hurryT = 0; results = null; readyInfo = null; invOpen = false;
  banner = { t: 200, a: lvl.name[0] + ' - ' + lvl.name[1], b: 'GET COOKED, THEN REACH THE SMOKE SPOT' };
  // power-ups bought in the shop kick in now
  if (save.preroll > 0) { save.preroll--; me.cooked = 40; popup(me.x, me.y - 20, 'PRE-ROLL! 40%', '#c8ffa0'); }
  if (save.gold > 0) { save.gold--; me.star = 720; }
  persist();
  for (const r of remotes.values()) { r.tx = r.ty = -100; r.x = r.y = -100; r.trail = []; }
  for (const c of Net.pendingCollected) applyCollected(c.id, c.l);
  Net.pendingCollected = [];
}

// ============================================================
//  PHYSICS
// ============================================================
function tileAt(tx, ty) {
  if (tx < 0 || tx >= COLS) return BLOCK;
  if (ty < 0 || ty >= ROWS) return EMPTY;
  return lvl.map[ty][tx];
}
const solid = (tx, ty) => tileAt(tx, ty) !== EMPTY;
function moveBody(b, onHead) {
  b.hitWall = false;
  b.x += b.vx;
  const top = Math.floor(b.y / T), bot = Math.floor((b.y + b.h - 0.01) / T);
  if (b.vx > 0) {
    const tx = Math.floor((b.x + b.w - 0.01) / T);
    for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { b.x = tx * T - b.w; b.vx = 0; b.hitWall = true; break; }
  } else if (b.vx < 0) {
    const tx = Math.floor(b.x / T);
    for (let ty = top; ty <= bot; ty++) if (solid(tx, ty)) { b.x = (tx + 1) * T; b.vx = 0; b.hitWall = true; break; }
  }
  b.y += b.vy;
  b.onGround = false;
  const l = Math.floor(b.x / T), r = Math.floor((b.x + b.w - 0.01) / T);
  if (b.vy > 0) {
    const ty = Math.floor((b.y + b.h - 0.01) / T);
    for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { b.y = ty * T - b.h; b.vy = 0; b.onGround = true; break; }
  } else if (b.vy < 0) {
    const ty = Math.floor(b.y / T), mid = Math.floor((b.x + b.w / 2) / T);
    let hit = -1;
    if (solid(mid, ty)) hit = mid; else for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { hit = tx; break; }
    if (hit >= 0 && ty >= 0) { b.y = (ty + 1) * T; b.vy = 0; if (onHead) onHead(hit, ty); }
  }
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

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

function addCombo(x, y, base) {
  me.combo++; me.comboT = 110; me.best = Math.max(me.best, me.combo);
  if (me.combo === 5 || me.combo === 10 || me.combo === 20) {
    tone(784, 0.1, 'square', 0.05); tone(1175, 0.25, 'square', 0.05, 0.1);
    puff(me.x + 6, me.y + 7, 18, ['#c8ffa0', '#7fe07a', '#e4b3ff', '#ffffff'], 1.6);
    const bonus = me.combo * 2; addCoins(bonus); popup(x, y - 10, 'COMBO BONUS +' + bonus, '#c8ffa0');
  }
}
function addCoins(k) { save.coins += k; me.earned += k; }
function getCoin(x, y, k = 1) { addCoins(k); SFX.coin(me.combo); addCombo(x, y, 1); puff(x + 5, y + 4, 5, ['#fff6b0', '#ffd84a', '#ffffff']); }
function addCooked(k, x, y) {
  const was = me.cooked; me.cooked = Math.max(0, Math.min(100, me.cooked + k));
  if (k > 0 && was < 50 && me.cooked >= 50) { banner = { t: 120, a: 'YOU ARE COOKED!', b: 'THE SMOKE SPOT IS OPEN - KEEP GOING FOR ULTRA' }; SFX.power(); }
  if (k > 0 && was < 100 && me.cooked >= 100) { banner = { t: 160, a: 'ULTRA COOKED!!', b: 'INFINITE FLOAT + STRONGER ATTACKS + x2 COINS AT THE SPOT' }; SFX.power(); shake = 8; puff(me.x + 6, me.y, 40, ['#c070ff', '#c8ffa0', '#ffffff', '#ff9ab8'], 2.4); }
}
function getNug(x, y) { me.nugs++; SFX.nug(); addCombo(x, y, 1); addCooked(15); puff(x + 4, y + 4, 14, ['#7fe07a', '#c070ff', '#ff9a3a', '#c8ffa0'], 1.4); popup(x - 6, y - 10, '+15% COOKED', '#c8ffa0'); }

function headHit(tx, ty) {
  const t = lvl.map[ty][tx];
  lvl.bumps.push({ tx, ty, t: 8 });
  const x = tx * T + 3, y = ty * T - 10;
  if (t === GOLDBOX) {
    lvl.map[ty][tx] = USED; collect('b' + tx + '_' + ty);
    particles.push({ x, y, vx: 0, vy: -2.5, life: 26, img: GOLD_LEAF, g: 0.12 });
    me.star = 540; SFX.star(); shake = 6;
    banner = { t: 150, a: 'GOLDEN LEAF!', b: 'UNSTOPPABLE - RUN INTO ENEMIES' };
  } else if (t === BOX || t === BOX_NUG) {
    lvl.map[ty][tx] = USED; collect('b' + tx + '_' + ty);
    if (t === BOX_NUG) getNug(x, y); else getCoin(x, y, 5);
    particles.push({ x, y, vx: 0, vy: -2.5, life: 22, img: t === BOX_NUG ? NUG : COIN, g: 0.15 });
    for (const e of lvl.enemies) if (e.alive && Math.abs(e.x + e.w / 2 - (tx * T + 8)) < 14 && Math.abs(e.y + e.h - ty * T) < 3) damageEnemy(e, 5);
  } else SFX.bump();
}

function damageEnemy(e, dmg, fromX) {
  if (!e.alive) return;
  e.hp -= dmg; e.flash = 8;
  e.vx = 0; e.y -= 1; e.vy = -1.5; e.kb = (fromX !== undefined ? Math.sign(e.x - fromX) : -e.dir) * 1.5;
  if (e.hp <= 0) killEnemy(e); else SFX.hit();
}
function killEnemy(e, remote) {
  if (!e.alive) return;
  e.alive = false; e.dead = 36;
  puff(e.x + e.w / 2, e.y + e.h / 2, 12, ['#ffffff', '#e8e4f4', '#c8ffa0', '#ff9ab8'], 1.4);
  if (remote) return;
  SFX.stomp(); collect(e.id); shake = Math.max(shake, 4); me.kills++;
  const reward = { cop: 8, karen: 6, mouse: 2, squirrel: 3 }[e.kind];
  // thieves drop what they stole
  const drop = reward + e.stolen;
  const pieces = Math.min(8, drop);
  for (let i = 0; i < pieces; i++) lvl.drops.push({ x: e.x + e.w / 2, y: e.y, vx: (Math.random() - .5) * 3, vy: -2 - Math.random() * 2, v: Math.floor(drop / pieces) + (i === 0 ? drop % pieces : 0), t: 0 });
  e.stolen = 0;
  addCombo(e.x, e.y - 4, 5);
  popup(e.x - 4, e.y - 10, { cop: 'COP DOWN!', karen: 'KAREN DENIED!', mouse: 'SQUEAK!', squirrel: 'NUTS!' }[e.kind], '#ffffff');
}
function applyCollected(id, l) {
  if (!lvl || !running) { Net.pendingCollected.push({ id, l }); return; }
  if (l !== undefined && l !== lvl.n) return;
  const find = arr => arr.find(o => o.id === id);
  if (id[0] === 'c') { const c = find(lvl.coins); if (c) c.taken = true; }
  else if (id[0] === 'n') { const c = find(lvl.nugs); if (c) c.taken = true; }
  else if (id[0] === 'r') { const c = find(lvl.rings); if (c) c.taken = true; }
  else if (id[0] === 'x') { const c = find(lvl.extras); if (c) c.taken = true; }
  else if (id[0] === 'm') { const c = find(lvl.munchies); if (c) c.taken = true; }
  else if (id[0] === 'e') { const e = find(lvl.enemies); if (e) killEnemy(e, true); }
  else if (id[0] === 'b') { const [tx, ty] = id.slice(1).split('_').map(Number); const t = lvl.map[ty] && lvl.map[ty][tx]; if (t === BOX || t === BOX_NUG || t === GOLDBOX) { lvl.map[ty][tx] = USED; lvl.bumps.push({ tx, ty, t: 8 }); } }
}

function hurt(dmg = 1, cookedLoss = 0, fromX) {
  if (me.inv > 0 || me.star > 0 || state !== 'play') return;
  me.hp -= dmg; me.inv = 90; me.vy = -2.8; me.vx = (fromX !== undefined ? Math.sign(me.x - fromX) || -me.face : -me.face) * 1.8;
  me.puffed = false; me.combo = 0; shake = 10;
  if (cookedLoss) { addCooked(-cookedLoss); popup(me.x - 8, me.y - 18, 'BUZZKILL -' + cookedLoss + '%', '#ff8a8a'); }
  SFX.hurt(); puff(me.x + 6, me.y + 7, 10, ['#ff5a6a', '#ffffff']);
  if (me.hp <= 0) knockedOut();
}
function knockedOut() {
  const loss = Math.min(save.coins, Math.max(5, Math.floor(save.coins * 0.1)));
  save.coins -= loss; me.lost += loss;
  me.hp = maxHp(); me.x = me.resX; me.y = me.resY; me.vx = me.vy = 0; me.inv = 120; me.combo = 0; me.trail = []; me.puffed = false;
  banner = { t: 140, a: 'YOU GOT BEAT UP!', b: 'DROPPED ' + loss + ' HASH COINS - BACK TO THE ' + (lvl.cp.active ? 'CHECKPOINT' : 'START') };
  SFX.hurt();
}
function steal(e) {
  if (save.pouch) { popup(e.x - 10, e.y - 12, 'POUCH LOCKED!', '#ffd84a'); e.state = 'flee'; e.dir = Math.sign(e.x - me.x) || 1; return; }
  const k = Math.min(save.coins, e.kind === 'mouse' ? 5 : 8);
  save.coins -= k; me.lost += k; e.stolen += k;
  e.state = 'flee'; e.dir = Math.sign(e.x - me.x) || 1;
  popup(me.x - 10, me.y - 16, k ? '-' + k + ' STOLEN!' : 'NOTHING TO STEAL', '#ff8a8a');
  if (k) { SFX.steal(); puff(me.x + 6, me.y + 4, 6, ['#ffd84a', '#fff6b0']); }
}
function emote(i) {
  me.emote = { e: i, t: 120 }; Net.send({ t: 'emote', e: i });
  tone(660, 0.08, 'square', 0.04); tone(880, 0.1, 'square', 0.04, 0.08);
}
function useMunchies() {
  if (save.munchie <= 0 || me.hp >= maxHp() || state !== 'play') return;
  save.munchie--; me.hp = Math.min(maxHp(), me.hp + 2); SFX.munch(); persist();
  popup(me.x - 10, me.y - 16, 'MUNCHIES! +2', '#ff9ab8');
}
function cycleWeapon(dir) {
  const owned = WEAPONS.filter(w => save.weapons.includes(w.id));
  const i = owned.findIndex(w => w.id === save.weapon);
  save.weapon = owned[(i + dir + owned.length) % owned.length].id; persist();
  popup(me.x - 10, me.y - 16, weaponDef().name, '#fff6b0');
}
function selectWeapon(i) {
  const w = WEAPONS[i]; if (!w) return;
  if (!save.weapons.includes(w.id)) { popup(me.x - 10, me.y - 16, 'DONT HAVE IT YET', '#ff8a8a'); return; }
  save.weapon = w.id; persist(); popup(me.x - 10, me.y - 16, w.name, '#fff6b0');
}

// ============================================================
//  ATTACKS
// ============================================================
function spawnShot(kind, x, y, f, mine) {
  const base = { kind, f, mine, t: 0, hit: new Set() };
  if (kind === 0) Object.assign(base, { x: x + f * 8, y: y + 2, w: 10, h: 10, vx: f * 3, vy: 0, life: 20, dmg: 1 });           // smoke puff
  if (kind === 1) Object.assign(base, { x: x + (f > 0 ? 12 : -22), y: y - 2, w: 22, h: 16, vx: 0, vy: 0, life: 12, dmg: 2 });   // flame
  if (kind === 2) Object.assign(base, { x: x + f * 8, y: y + 3, w: 7, h: 7, vx: f * 4.5, vy: 0, life: 40, dmg: 1 });           // bubble
  if (kind === 3) Object.assign(base, { x: x + f * 8, y: y + 2, w: 10, h: 6, vx: f * 4, vy: 0, life: 70, dmg: 2, back: false }); // boomerang
  if (kind === 4) Object.assign(base, { x: x - 10, y: y - 6, w: 34, h: 26, vx: 0, vy: 0, life: 22, dmg: 3 });                  // grinder spin
  if (kind === 5) Object.assign(base, { x: x + f * 8, y: y, w: 12, h: 12, vx: f * 3.5, vy: 0, life: 22, dmg: 2 });             // exhale (from float)
  shots.push(base);
}
function attack() {
  if (me.atkCd > 0 || state !== 'play') return;
  let kind;
  if (me.puffed) { kind = 5; me.puffed = false; me.flaps = 0; SFX.exhale(); }
  else { const w = weaponDef(); kind = WEAPONS.indexOf(w); me.atkCd = w.cd; SFX.attack(kind); }
  if (kind === 5) me.atkCd = 14;
  me.atkT = 12;
  spawnShot(kind, me.x, me.y, me.face, true);
  Net.send({ t: 'fx', k: kind, x: Math.round(me.x), y: Math.round(me.y), f: me.face });
}
function updateShots() {
  for (const s of shots) {
    s.t++; s.life--;
    if (s.kind === 0 || s.kind === 5) { s.vx *= 0.93; }
    if (s.kind === 1 && s.mine) { s.x = me.x + (s.f > 0 ? 12 : -22); s.y = me.y - 2; }
    if (s.kind === 4 && s.mine) { s.x = me.x - 11; s.y = me.y - 7; }
    if (s.kind === 3) {
      if (!s.back && s.t > 22) s.back = true;
      if (s.back && s.mine) { const dx = me.x - s.x, dy = me.y - s.y, d = Math.hypot(dx, dy) || 1; s.vx = dx / d * 4.2; s.vy = dy / d * 4.2; if (d < 10) s.life = 0; }
    }
    s.x += s.vx; s.y += s.vy;
    if ((s.kind === 0 || s.kind === 2 || s.kind === 5) && solid(Math.floor((s.x + s.w / 2) / T), Math.floor((s.y + s.h / 2) / T))) { s.life = 0; puff(s.x + s.w / 2, s.y + s.h / 2, 4, ['#ffffff', '#e8e4f4']); }
    if (s.kind === 1 && frame % 2 === 0) puff(s.x + Math.random() * s.w, s.y + Math.random() * s.h, 1, ['#ff9a3a', '#ffd84a', '#ff5a6a'], .5, -0.02);
    if (!s.mine) continue;
    for (const e of lvl.enemies) {
      if (!e.alive || s.hit.has(e) || !overlap(s, e)) continue;
      s.hit.add(e); damageEnemy(e, s.dmg + (ultra() ? 1 : 0) + (me.buffs.power > 0 ? 1 : 0), me.x);
      if (s.kind === 0 || s.kind === 2 || s.kind === 5) s.life = 0;
    }
  }
  shots = shots.filter(s => s.life > 0);

  for (const s of enemyShots) {
    s.vy += 0.12; s.x += s.vx; s.y += s.vy; s.life--;
    if (solid(Math.floor((s.x + 4) / T), Math.floor((s.y + 4) / T))) s.life = 0;
    if (state === 'play' && overlap(s, me)) { s.life = 0; hurt(1, 5, s.x); }
    for (const p of shots) if (p.mine && overlap(p, s)) s.life = 0; // you can shoot purses down
  }
  enemyShots = enemyShots.filter(s => s.life > 0);
}
// ============================================================
//  UPDATE
// ============================================================
function update() {
  if (paused) return;
  frame++;
  if (banner && --banner.t <= 0) banner = null;

  if (state === 'play' && !(invOpen && !Net.online)) updatePlayer();
  else if (state === 'sitting') {
    me.vx = 0; me.puffed = false;
    if (frame % 8 === 0) puff(lvl.spot.x + 30, lvl.spot.y - 10, 1, ['#ffffff', '#e8e4f4', '#d4c8f8'], .3, -0.03);
    if (!Net.online && finInfo && --finInfo.t <= 0) toResults();
    if (Net.online && K.enterPressed && !finInfo.hurried) { Net.send({ t: 'hurry' }); finInfo.hurried = true; }
  } else if (state === 'results') updateShop();
  if (hurryT > 0 && --hurryT === 0) { Net.send({ t: 'timeup' }); if (state === 'play') { popup(me.x - 20, me.y - 20, 'TIME UP!', '#ff8a8a'); } }
  K.jumpPressed = false; K.enterPressed = false; K.attackPressed = false;
  if (me.emote && --me.emote.t <= 0) me.emote = null;

  updateEnemies();
  updateShots();

  for (const r of remotes.values()) {
    if (r.tx < -50) continue;
    if (Math.abs(r.tx - r.x) > 80 || Math.abs(r.ty - r.y) > 80) { r.x = r.tx; r.y = r.ty; }
    r.x += (r.tx - r.x) * 0.35; r.y += (r.ty - r.y) * 0.35;
    if (r.emote && --r.emote.t <= 0) r.emote = null;
  }

  // loose coins (dropped by thieves & enemies)
  for (const d of lvl.drops) {
    d.t++; d.vy = Math.min(d.vy + 0.2, 4); d.x += d.vx; d.y += d.vy; d.vx *= 0.97;
    if (solid(Math.floor((d.x + 4) / T), Math.floor((d.y + 9) / T))) { d.y = Math.floor((d.y + 9) / T) * T - 9; d.vy = -d.vy * 0.4; if (Math.abs(d.vy) < 0.5) d.vy = 0; }
    if (d.t > 20 && state === 'play' && overlap({ x: d.x, y: d.y, w: 9, h: 9 }, me)) { d.taken = true; getCoin(d.x, d.y, d.v); }
    if (d.y > H + 20 || d.t > 900) d.taken = true;
  }
  lvl.drops = lvl.drops.filter(d => !d.taken);

  lvl.bumps = lvl.bumps.filter(b => --b.t > 0);
  particles = particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += p.g; return --p.life > 0; });
  popups = popups.filter(p => { p.y -= 0.4; return --p.t > 0; });

  const target = me.x + me.w / 2 - W / 2 + me.face * 24;
  camX += (target - camX) * 0.08;
  camX = Math.max(0, Math.min(camX, COLS * T - W));

  if (Net.online && frame % 3 === 0 && (state === 'play' || state === 'sitting')) {
    Net.send({ t: 's', x: Math.round(me.x), y: Math.round(me.y), l: lvl.n, a: animFrame(me), f: me.face, b: (me.star > 0 ? 1 : 0) | (ultra() ? 2 : 0) | (state === 'sitting' ? 4 : 0), w: WEAPONS.indexOf(weaponDef()), c: Math.round(me.cooked) });
  }
}
function animFrame(p) {
  if (p.atkT > 0) return 5;
  if (p.puffed) return 4;
  if (!p.onGround && state === 'play') return 3;
  if (Math.abs(p.vx) > 0.2) return 1 + Math.floor(p.walkT / 6) % 2;
  return 0;
}

function updatePlayer() {
  const p = me;
  // Kirby-style: floaty jump, tap jump in the air to puff up and flap
  const spd = p.buffs.speed > 0 ? 1.45 : 1;
  const max = (p.puffed ? 1.1 : (K.run ? 2.3 : 1.4)) * spd, acc = p.onGround ? 0.14 : 0.1;
  if (K.left && !K.right) { p.vx = Math.max(p.vx - acc, -max); p.face = -1; }
  else if (K.right && !K.left) { p.vx = Math.min(p.vx + acc, max); p.face = 1; }
  else { p.vx *= p.onGround ? 0.8 : 0.95; if (Math.abs(p.vx) < 0.05) p.vx = 0; }
  if (Math.abs(p.vx) > max) p.vx *= 0.94;

  if (K.jumpPressed) p.jumpBuf = 7; else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.onGround) { p.coyote = 6; p.puffed = false; p.flaps = 0; } else if (p.coyote > 0) p.coyote--;
  const maxFlaps = ultra() ? 99 : 7;
  if (p.jumpBuf > 0) {
    if (p.coyote > 0) {
      p.vy = -4.7 - Math.abs(p.vx) * 0.2; p.coyote = 0; p.jumpBuf = 0; p.cut = true; p.sq = 8; SFX.jump();
    } else if (p.flaps < maxFlaps) {
      p.puffed = true; p.flaps++; p.vy = -2.5; p.jumpBuf = 0; p.cut = false; SFX.flap();
      puff(p.x + 6 - p.face * 8, p.y + 10, 3, ['#ffffff', '#e8e4f4'], .6);
    }
  }
  if (p.cut && !K.jump && p.vy < -1.8) { p.vy = -1.8; p.cut = false; }
  if (p.puffed) p.vy = Math.min(p.vy + 0.12, 0.9);
  else p.vy = Math.min(p.vy + 0.22, 4);

  if (K.attackPressed) attack();
  if (p.atkCd > 0) p.atkCd--;
  if (p.atkT > 0) p.atkT--;

  const wasGround = p.onGround, prevBottom = p.y + p.h;
  moveBody(p, headHit);
  // stand on your friends' heads
  if (p.vy >= 0 && !p.onGround) for (const r of remotes.values()) {
    if (r.tx < -50 || r.l !== lvl.n) continue;
    if (p.x + p.w > r.x + 1 && p.x < r.x + 11 && prevBottom <= r.y + 2 && p.y + p.h >= r.y) { p.y = r.y - p.h; p.vy = 0; p.onGround = true; p.puffed = false; p.flaps = 0; break; }
  }
  if (!wasGround && p.onGround) { p.sq = 6; puff(p.x + 6, p.y + 13, 3, ['#ffffff', '#f0e8ff'], .5); }
  if (p.onGround && Math.abs(p.vx) > 0.2) p.walkT += Math.abs(p.vx) / 1.4; else p.walkT = 0;
  if (p.sq > 0) p.sq--;
  if (p.inv > 0) p.inv--;
  if (p.star > 0) { p.star--; if (frame % 3 === 0) puff(p.x + Math.random() * 12, p.y + Math.random() * 13, 1, ['#ffd84a', '#fff6b0', '#c8ffa0', '#e4b3ff'], .3); }
  if (ultra() && frame % 5 === 0) puff(p.x + 6, p.y + 2, 1, ['#c070ff', '#e4b3ff', '#c8ffa0'], .4, -0.03);
  if (p.onGround && Math.abs(p.vx) > 2 && frame % 4 === 0) puff(p.x + 6 - p.face * 6, p.y + 12, 1, ['#ffffff', '#e8e0d0'], .4);
  if (p.comboT > 0 && --p.comboT === 0) p.combo = 0;
  p.trail.unshift({ x: p.x, y: p.y }); if (p.trail.length > 20) p.trail.pop();

  if (p.y > H + 30) { // fell in a pit
    hurt(1); p.inv = 90;
    if (p.hp > 0) { p.x = p.resX; p.y = p.resY; p.vx = p.vy = 0; p.trail = []; banner = { t: 70, a: 'WHOA, CAREFUL!', b: '' }; }
    return;
  }

  const box = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (const c of lvl.coins) if (!c.taken && overlap(box, { x: c.x, y: c.y, w: 10, h: 9 })) { c.taken = true; collect(c.id); getCoin(c.x, c.y); }
  for (const n of lvl.nugs) if (!n.taken && overlap(box, { x: n.x, y: n.y, w: 9, h: 9 })) { n.taken = true; collect(n.id); getNug(n.x, n.y); }
  for (const r of lvl.rings) if (!r.taken && overlap(box, { x: r.x, y: r.y, w: 8, h: 6 })) { r.taken = true; collect(r.id); addCooked(4); SFX.ring(); puff(r.x + 4, r.y + 3, 6, ['#ffffff', '#e4b3ff']); popup(r.x - 4, r.y - 8, '+4%', '#e4b3ff'); }
  for (const u of lvl.munchies) if (!u.taken && overlap(box, { x: u.x, y: u.y, w: 9, h: 8 })) {
    u.taken = true; collect(u.id); SFX.munch();
    if (p.hp < maxHp()) { p.hp = Math.min(maxHp(), p.hp + 2); popup(u.x - 8, u.y - 8, 'MUNCHIES! +2', '#ff9ab8'); }
    else { save.munchie = Math.min(3, save.munchie + 1); popup(u.x - 8, u.y - 8, 'SAVED FOR LATER', '#ff9ab8'); }
  }
  for (const x of lvl.extras) if (!x.taken && overlap(box, { x: x.x, y: x.y, w: 9, h: 9 })) {
    x.taken = true; collect(x.id); const d = EXTRAS[x.kind];
    addCoins(d.coins); if (d.cooked) addCooked(d.cooked); if (d.buff) p.buffs[d.buff] = d.time;
    SFX.star(); shake = 4; addCombo(x.x, x.y, 1);
    banner = { t: 110, a: d.name + '!', b: '+' + d.coins + ' COINS - ' + d.desc };
    puff(x.x + 4, x.y + 4, 22, ['#ffd84a', '#9ae8ff', '#ffffff', '#ffb84a'], 1.8);
  }
  for (const k in p.buffs) if (p.buffs[k] > 0) p.buffs[k]--;
  if (p.buffs.magnet > 0) for (const c of lvl.coins) if (!c.taken) { const dx = p.x + 6 - c.x - 5, dy = p.y + 6 - c.y - 4, d = Math.hypot(dx, dy); if (d < 80) { c.x += dx / d * 3; c.y += dy / d * 3; } }
  const lg = lvl.legend;
  if (lg && !lg.met && Math.abs(p.x - lg.x) < 20 && Math.abs(p.y - lg.y) < 30) {
    lg.met = true; const L = LEGENDS[lg.who]; SFX.power();
    if (L.gift === 'cooked') { addCooked(20); lg.gift = '+20% COOKED'; }
    else if (L.gift === 'heal') { p.hp = maxHp(); lg.gift = 'FULL HEARTS'; }
    else { addCoins(40); lg.gift = '+40 HASH COINS'; }
    p.legendT = 300;
  }
  if (p.legendT > 0) p.legendT--;
  for (const c of lvl.chests) if (!c.open && overlap(box, { x: c.x, y: c.y, w: 14, h: 9 })) openChest(c);

  for (const e of lvl.enemies) {
    if (!e.alive || !overlap(box, e)) continue;
    if (p.star > 0) { damageEnemy(e, 9); continue; }
    if (p.vy > 0 && prevBottom - e.y < 8) { // bounce on their head
      damageEnemy(e, 1 + (ultra() ? 1 : 0), p.x); p.vy = K.jump ? -4.8 : -3.4; p.cut = false; p.flaps = 0; p.puffed = false; continue;
    }
    if (e.kind === 'mouse' || e.kind === 'squirrel') { if (e.state !== 'flee') steal(e); }
    else if (e.kind === 'cop') hurt(1, 0, e.x);
    else hurt(1, 10, e.x);
  }

  if (!lvl.cp.active && lvl.cp.x && p.x > lvl.cp.x) {
    lvl.cp.active = true; p.resX = lvl.cp.x; p.resY = lvl.cp.y * T - p.h - 2; SFX.cp();
    popup(lvl.cp.x - 10, lvl.cp.y * T - 40, 'CHECKPOINT!', '#c8ffa0');
  }

  // the smoke spot
  const spot = lvl.spot;
  if (p.x + p.w > spot.x && p.x < spot.x + spot.w) {
    if (p.cooked >= 50) sitDown();
    else if (frame % 90 === 0 || !p.spotWarned) {
      p.spotWarned = true;
      banner = { t: 100, a: 'NOT COOKED ENOUGH!', b: 'YOU NEED 50% - GRAB NUGS + SMOKE RINGS' };
      p.x = spot.x - p.w - 1; p.vx = -1.5;
    }
  }
}

function openChest(c) {
  c.open = true; SFX.power(); shake = 5;
  const def = [...WEAPONS, ...ARMORS, { id: 'pouch', name: 'STASH POUCH' }].find(i => i.id === c.loot);
  const owned = save.weapons.includes(c.loot) || save.armor.includes(c.loot) || (c.loot === 'pouch' && save.pouch);
  if (owned) { addCoins(30); banner = { t: 140, a: 'TREASURE CHEST!', b: 'ALREADY HAVE ' + def.name + ' - TOOK 30 COINS' }; }
  else {
    if (WEAPONS.some(w => w.id === c.loot)) { save.weapons.push(c.loot); save.weapon = c.loot; }
    else if (c.loot === 'pouch') save.pouch = true;
    else save.armor.push(c.loot);
    if (ARMORS.some(a => a.id === c.loot)) me.hp = maxHp();
    banner = { t: 180, a: 'FOUND: ' + def.name + '!', b: WEAPONS.some(w => w.id === c.loot) ? 'EQUIPPED - PRESS X TO USE, Q TO SWITCH' : 'CHECK YOUR INVENTORY WITH I' };
  }
  persist();
  puff(c.x + 7, c.y, 24, ['#ffd84a', '#fff6b0', '#ffffff', '#c8ffa0'], 1.8);
}

function sitDown() {
  state = 'sitting'; me.vx = 0; me.puffed = false;
  me.x = lvl.spot.x + 18; me.y = lvl.spot.y - me.h - 6;
  SFX.flag(); shake = 4;
  puff(lvl.spot.x + 24, lvl.spot.y - 10, 30, ['#ffffff', '#c8ffa0', '#e4b3ff', '#ffd84a'], 2);
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
//  ENEMY AI
// ============================================================
function updateEnemies() {
  for (const e of lvl.enemies) {
    if (!e.alive) { if (e.dead > 0) e.dead--; continue; }
    if (!e.active) {
      let near = e.x < camX + W + 24;
      for (const r of remotes.values()) if (r.l === lvl.n && e.x < r.x + W / 2 + 40) near = true;
      if (near) e.active = true; else continue;
    }
    if (e.flash > 0) e.flash--;
    const dx = me.x - e.x, adx = Math.abs(dx), sameLevel = Math.abs(me.y - e.y) < 30, playing = state === 'play';
    let speed = 0.4;
    if (e.kb) { e.vx = e.kb; e.kb *= 0.85; if (Math.abs(e.kb) < 0.2) e.kb = 0; }
    else if (e.kind === 'cop') {
      if (playing && adx < 110 && sameLevel) { e.dir = Math.sign(dx) || 1; speed = 1.25; e.state = 'chase'; } else e.state = 'patrol';
      e.vx = e.dir * speed;
    } else if (e.kind === 'karen') {
      if (playing && adx < 130 && Math.abs(me.y - e.y) < 60) {
        e.dir = Math.sign(dx) || 1; e.vx = 0;
        if (--e.cd <= 0) {
          e.cd = 110; e.throwT = 14;
          enemyShots.push({ x: e.x + 5, y: e.y + 4, w: 8, h: 8, vx: e.dir * (0.8 + adx / 90), vy: -2.6, life: 120 });
          if (Math.random() < .5) popup(e.x - 12, e.y - 12, Math.random() < .5 ? 'MANAGER!!' : 'UNACCEPTABLE!', '#ffb0b0');
          SFX.karen();
        }
      } else e.vx = e.dir * 0.4;
      if (e.throwT > 0) e.throwT--;
    } else if (e.kind === 'mouse') {
      if (e.state === 'flee') e.vx = e.dir * 2.6;
      else if (playing && adx < 130 && sameLevel) { e.dir = Math.sign(dx) || 1; e.vx = e.dir * 1.9; }
      else e.vx = e.dir * 0.6;
    } else if (e.kind === 'squirrel') {
      if (e.onGround) {
        if (--e.cd <= 0) {
          e.cd = e.state === 'flee' ? 8 : 26 + Math.floor(Math.random() * 20);
          if (e.state !== 'flee' && playing && adx < 150) e.dir = Math.sign(dx) || 1;
          e.vy = -3.2; e.hopVx = e.dir * (e.state === 'flee' ? 2.6 : adx < 150 ? 1.6 : 0.7);
        }
        e.vx = 0;
      } else e.vx = e.hopVx || 0;
    }
    e.vy = Math.min(e.vy + 0.22, 5);
    moveBody(e);
    if (e.hitWall && !e.kb) { e.dir *= -1; if (e.kind === 'squirrel') e.hopVx = -e.hopVx; }
    // turn around at ledges (thieves on the run don't care)
    if (e.onGround && e.state !== 'flee' && e.state !== 'chase' && e.kind !== 'squirrel') {
      const ax = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
      if (!solid(Math.floor(ax / T), Math.floor((e.y + e.h + 2) / T))) e.dir *= -1;
    }
    if (e.y > H + 40 || (e.state === 'flee' && Math.abs(e.x - me.x) > W * 1.2)) { e.alive = false; e.dead = 0; } // got away with your coins
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
function drawPlayer(x, y, face, anim, color, sq, inv, emote, name, star, ult, sitting) {
  if (inv > 0 && Math.floor(inv / 4) % 2) return;
  const img = PLAYER[color][anim];
  const ox = anim === 4 ? -3 : -2, oy = anim === 4 ? -4 : -3;
  if (star) ctx.filter = 'hue-rotate(' + (frame * 24 % 360) + 'deg) saturate(2) brightness(1.15)';
  else if (ult) ctx.filter = 'drop-shadow(0 0 2px #c070ff)';
  if (sq > 0 && anim !== 4) {
    const sx = Math.round(x - camX - 3), sy = Math.round(y);
    ctx.save(); ctx.translate(sx + (face < 0 ? 18 : 0), sy); ctx.scale(face < 0 ? -1 : 1, 1); ctx.drawImage(img, 0, -1, 18, 14); ctx.restore();
  } else draw_(img, x + ox, y + oy, face < 0);
  ctx.filter = 'none';
  if (sitting && frame % 40 < 30) text('Z', x + 12 - camX, y - 8 - (frame % 40) / 8, '#e4b3ff');
  if (emote) bubble(EMOTES[emote.e], x + 6, y - (name ? 26 : 16));
  if (name) text(name, x + 6 - camX, y - 12, SHIRTS[color], 1, 'center');
}
function drawSpot() {
  const s = lvl.spot, x = Math.round(s.x - camX), y = s.y;
  if (x > W + 10 || x + 60 < 0) return;
  // sign
  R(ctx, P.k, x + 2, y - 44, 2, 44); R(ctx, P.k, x - 6, y - 52, 40, 12); R(ctx, '#ffe0a0', x - 5, y - 51, 38, 10);
  drawStr('SMOKE SPOT', x - 3, y - 48, '#6a4428', 1);
  // couch
  R(ctx, P.k, x + 10, y - 20, 34, 20); R(ctx, '#c070ff', x + 11, y - 19, 32, 18);
  R(ctx, '#e0a8ff', x + 11, y - 19, 32, 3); R(ctx, P.k, x + 14, y - 10, 26, 1); R(ctx, '#8a40c8', x + 11, y - 3, 32, 2);
  R(ctx, P.k, x + 8, y - 14, 5, 14); R(ctx, '#a050e8', x + 9, y - 13, 3, 12); R(ctx, P.k, x + 41, y - 14, 5, 14); R(ctx, '#a050e8', x + 42, y - 13, 3, 12);
  // little campfire + rising smoke
  R(ctx, '#6a4428', x + 48, y - 3, 10, 3);
  const fl = frame % 12 < 6;
  R(ctx, '#ff5a6a', x + 50, y - 8, 6, 5); R(ctx, '#ff9a3a', x + 51, y - (fl ? 10 : 9), 4, 6); R(ctx, '#ffd84a', x + 52, y - 7, 2, 3);
  if (frame % 10 === 0) puff(s.x + 53, y - 12, 1, ['#ffffff', '#e8e4f4', '#d4c8f8'], .3, -0.03);
}
function drawEnemy(e) {
  const imgs = e.flash > 0 && e.flash % 2 ? ENEMY_FLASH[e.kind] : ENEMY_IMG[e.kind];
  let f = Math.floor(frame / (e.state === 'flee' || e.state === 'chase' ? 6 : 12)) % 2;
  if (e.kind === 'karen' && e.throwT > 0) f = 1;
  if (e.kind === 'squirrel') f = e.onGround ? 0 : 1;
  const img = imgs[f];
  draw_(img, e.x + (e.w - img.width) / 2, e.y + e.h - img.height, e.kind === 'mouse' || e.kind === 'squirrel' ? e.dir > 0 : e.dir < 0);
  if (e.stolen > 0 && frame % 30 < 20) draw_(COIN, e.x + 1, e.y - 11);
}
function drawShot(s) {
  const x = Math.round(s.x - camX), y = Math.round(s.y);
  if (s.kind === 0 || s.kind === 5) {
    const r = s.kind === 5 ? 7 : 5 + (s.t / 6);
    ctx.globalAlpha = Math.min(1, s.life / 8);
    ctx.fillStyle = P.k; circle(x + s.w / 2, y + s.h / 2, r + 1);
    ctx.fillStyle = '#ffffff'; circle(x + s.w / 2, y + s.h / 2, r);
    ctx.fillStyle = '#e8e4f4'; circle(x + s.w / 2 + 2, y + s.h / 2 + 2, r / 2);
    ctx.globalAlpha = 1;
  } else if (s.kind === 1) {
    for (let i = 0; i < 6; i++) { ctx.fillStyle = ['#ff5a6a', '#ff9a3a', '#ffd84a'][i % 3]; ctx.fillRect(x + (i * 4 + s.t * 2) % s.w, y + 4 + ((i * 5 + s.t) % 9), 4, 4); }
  } else if (s.kind === 2) {
    ctx.fillStyle = P.k; circle(x + 3.5, y + 3.5, 4.5); ctx.fillStyle = '#7ac8ff'; circle(x + 3.5, y + 3.5, 3.5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 2, y + 1, 2, 2);
  } else if (s.kind === 3) {
    ctx.save(); ctx.translate(x + 5, y + 3); ctx.rotate(s.t * 0.5); ctx.drawImage(ICONS.boomer, -5, -3); ctx.restore();
  } else if (s.kind === 4) {
    ctx.strokeStyle = '#c8ffa0'; ctx.lineWidth = 2; ctx.beginPath();
    ctx.arc(x + s.w / 2, y + s.h / 2, 14, s.t * 0.6, s.t * 0.6 + 4.2); ctx.stroke();
    ctx.drawImage(ICONS.grinder, x + s.w / 2 - 5 + Math.cos(s.t * .6) * 14, y + s.h / 2 - 4 + Math.sin(s.t * .6) * 14);
  }
}
function circle(cx, cy, r) { for (let y = -r; y <= r; y++) { const w = Math.sqrt(r * r - y * y); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), Math.round(w * 2), 1); } }

function draw() {
  const th = lvl.theme;
  ctx.save();
  if (shake > 0) { ctx.translate(Math.round((Math.random() - .5) * shake), Math.round((Math.random() - .5) * shake)); shake *= 0.85; if (shake < 0.5) shake = 0; }
  ctx.drawImage(th.sky, 0, 0);
  drawLayer(th.clouds, 0.08, camX, frame * 0.1);
  drawLayer(th.far, 0.18, camX);
  drawLayer(th.near, 0.4, camX);
  for (const d of lvl.deco) draw_(PLANT, d.x, d.y);

  const tiles = th.tiles;
  const c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(COLS - 1, c0 + Math.ceil(W / T) + 1);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = c0; tx <= c1; tx++) {
    const t = lvl.map[ty][tx]; if (!t) continue;
    const b = lvl.bumps.find(b => b.tx === tx && b.ty === ty);
    ctx.drawImage(tiles[t], Math.round(tx * T - camX), ty * T + Math.round(b ? -Math.sin(b.t / 8 * Math.PI) * 5 : 0));
  }
  // checkpoint flag
  if (lvl.cp.x) {
    const gx = Math.round(lvl.cp.x - camX), base = lvl.cp.y * T;
    R(ctx, P.k, gx - 1, base - 34, 4, 34); R(ctx, '#ffffff', gx, base - 33, 2, 33);
    R(ctx, lvl.cp.active ? '#7fe07a' : '#b0a8c0', gx + 2, base - (lvl.cp.active ? 33 : 14) + Math.round(Math.sin(frame / 10)), 12, 8);
  }
  drawSpot();

  const spin = Math.abs(Math.cos(frame / 12));
  for (const c of lvl.coins) {
    if (c.taken) continue; const x = Math.round(c.x - camX); if (x < -12 || x > W) continue;
    const w = Math.max(2, Math.round(10 * spin)); ctx.drawImage(COIN, x + Math.round((10 - w) / 2), c.y, w, 9);
  }
  for (const d of lvl.drops) draw_(COIN, d.x, d.y);
  for (const r of lvl.rings) if (!r.taken) draw_(RING, r.x, r.y + Math.sin(frame / 14 + r.x) * 2);
  for (const n of lvl.nugs) if (!n.taken) draw_(NUG, n.x, n.y + Math.sin(frame / 10 + n.x) * 2);
  for (const x of lvl.extras) if (!x.taken) {
    draw_(EXTRAS[x.kind].img, x.x, x.y + Math.sin(frame / 8 + x.x) * 2);
    if (frame % 20 === 0) puff(x.x + 4, x.y + 2, 1, ['#ffffff', '#fff6b0', '#9ae8ff'], .4);
  }
  if (lvl.legend) {
    const lg = lvl.legend, L = LEGENDS[lg.who];
    draw_(L.img, lg.x, lg.y + (frame % 60 < 30 ? 0 : 1), me.x < lg.x);
    text(L.name, lg.x + 7 - camX, lg.y - 9, '#ffd84a', 1, 'center');
    if (!lg.met && frame % 80 < 60) text('!', lg.x + 7 - camX, lg.y - 17, '#ffffff', 1, 'center');
    if (frame % 12 === 0) puff(lg.x + 12, lg.y + 6, 1, ['#ffffff', '#e8e4f4'], .3, -0.03);
    if (lg.met && me.legendT > 0 && state === 'play') {
      ctx.fillStyle = 'rgba(42,24,56,.9)'; ctx.fillRect(10, 30, W - 20, 26);
      text(L.name + ':', 16, 34, '#ffd84a'); wrap('"' + L.tip + '"', 16, 43, 72, '#ffffff'); text('GIFT: ' + lg.gift, W - 16, 34, '#c8ffa0', 1, 'right');
    }
  }
  for (const u of lvl.munchies) if (!u.taken) draw_(MUNCHIE, u.x, u.y + Math.sin(frame / 9 + u.x) * 1.5);
  for (const c of lvl.chests) {
    draw_(c.open ? CHEST_OPEN : CHEST, c.x, c.y);
    if (!c.open && frame % 50 < 6) puff(c.x + Math.random() * 14, c.y, 1, ['#fff6b0', '#ffffff'], .3);
  }

  for (const e of lvl.enemies) {
    if (!e.alive) {
      if (e.dead > 0) { const img = ENEMY_IMG[e.kind][0]; ctx.globalAlpha = e.dead / 36; ctx.drawImage(img, Math.round(e.x - camX), Math.round(e.y + e.h - img.height / 3), img.width, Math.ceil(img.height / 3)); ctx.globalAlpha = 1; }
      continue;
    }
    drawEnemy(e);
  }
  for (const s of enemyShots) { const x = Math.round(s.x - camX), y = Math.round(s.y); R(ctx, P.k, x, y, 8, 8); R(ctx, '#ff7ac8', x + 1, y + 1, 6, 6); R(ctx, '#ffd84a', x + 3, y, 2, 2); }
  for (const s of shots) drawShot(s);

  for (const r of remotes.values()) {
    if (r.tx < -50 || r.l !== lvl.n) continue;
    drawPlayer(r.x, r.y, r.f || 1, r.a, r.color, 0, 0, r.emote, r.name, r.b & 1, r.b & 2, r.b & 4);
  }
  drawPlayer(me.x, me.y, me.face, animFrame(me), me.color, me.sq, me.inv, me.emote, Net.online ? me.name : '', me.star > 0, ultra(), state === 'sitting');

  for (const p of particles) {
    if (p.img) { draw_(p.img, p.x, p.y); continue; }
    ctx.globalAlpha = Math.min(1, p.life / 15); ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x - camX), Math.round(p.y), p.s, p.s); ctx.globalAlpha = 1;
  }
  for (const p of popups) text(p.str, p.x - camX, p.y, p.col);
  ctx.restore();

  // ultra cooked haze
  if (ultra() && state === 'play') { ctx.fillStyle = 'rgba(192,112,255,' + (0.06 + Math.sin(frame / 20) * 0.03) + ')'; ctx.fillRect(0, 0, W, H); }

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
    text(has ? w.name.split(' ')[w.name.split(' ').length - 1] : '???', x + 6, 70, has ? '#fff' : '#6a6080', 1, 'center');
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
  ctx.drawImage(PLAYER[me.color][0], x0 + Math.max(0, pos - 1) * dx - 7 + (pos ? 0 : -12), y - 18);
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
  ws: null, online: false, reconnecting: false, code: '', color: 0, name: 'STONER', level: 0, phase: 'play', pendingCollected: [],
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
        this.code = m.code; this.color = m.color; this.level = m.level; this.phase = m.phase;
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
    this.online = false; this.ws = null; remotes.clear();
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
function addRemote(p) { remotes.set(p.id, { name: p.name, color: p.color, x: -100, y: -100, tx: -100, ty: -100, f: 1, a: 0, b: 0, l: -1, w: 0, c: 0, trail: [], emote: null }); }
function onNet(m) {
  switch (m.t) {
    case 's': { const r = remotes.get(m.id); if (!r) return; if (r.tx < -50 || r.l !== m.l) { r.x = m.x; r.y = m.y; } Object.assign(r, { tx: m.x, ty: m.y, f: m.f, a: m.a, b: m.b, l: m.l, w: m.w, c: m.c }); break; }
    case 'fx': { const r = remotes.get(m.id); if (r && r.l === lvl.n) spawnShot(m.k, m.x, m.y, m.f, false); break; }
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
