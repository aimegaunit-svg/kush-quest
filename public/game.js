// KUSH QUEST - a retro co-op platformer
// Plain JavaScript + <canvas>, no engine. All art is drawn in code as pixel arrays.
'use strict';
(() => {

// ============================================================
//  SETUP
// ============================================================
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
//  PALETTE + PIXEL ART
// ============================================================
const P = {
  k:'#1a1026', s:'#f2b98a', S:'#c98a5a', g:'#2f9e44', G:'#6fd13f', L:'#b6f07a', y:'#ffd23f', Y:'#fff3a0',
  O:'#c98a0f', r:'#e03b3b', o:'#ff8a1f', w:'#ffffff', d:'#3a2f5a', D:'#9aa0b8', E:'#5a5f78', p:'#b45cff',
  q:'#7a2fc0', n:'#8a5a32', N:'#5c3a1e', b:'#3b7dd8', h:'#2a7a3a'
};
const SHIRTS = ['#3b7dd8', '#e03b3b', '#b45cff', '#ff8a1f'];
const SHIRT_NAMES = ['BLUE', 'RED', 'PURPLE', 'ORANGE'];

function sprite(rows, pal = P) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const col = pal[r[i]]; if (col) { g.fillStyle = col; g.fillRect(i, j, 1, 1); } } });
  return c;
}

// --- player (rasta beanie stoner) ---
const HEAD = [
  '................',
  '.....kkkkkk.....',
  '....kgggyyyk....',
  '...kgggyyyrrk...',
  '...kkkkkkkkkk...',
  '....kssssssk....',
  '....kSkssSkk....',
  '....kssssssk....',
  '.....kssSsk.....',
];
const BODY = ['....kbbbbbbk....', '...kbbbbbbbbk...', '...ksbbbbbbsk...', '....kbbbbbbk....'];
const BODY_UP = ['..skbbbbbbbbks..', '..kbbbbbbbbbbk..', '...kbbbbbbbbk...', '....kbbbbbbk....'];
const LEGS_STAND = ['.....kddddk.....', '.....kdkkdk.....', '....kkk..kkk....'];
const LEGS_WALK = ['....kddkkddk....', '...kddk..kddk...', '...kkk....kkk...'];
const LEGS_JUMP = ['....kddddddk....', '...kddkkkkddk...', '...kk......kk...'];
const PLAYER = SHIRTS.map(col => {
  const pal = { ...P, b: col };
  return [
    sprite([...HEAD, ...BODY, ...LEGS_STAND], pal),
    sprite([...HEAD, ...BODY, ...LEGS_WALK], pal),
    sprite([...HEAD, ...BODY_UP, ...LEGS_JUMP], pal),
  ];
});

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
const GOLD_LEAF = sprite(LEAF_ROWS_SMALL(), { ...P, G: '#ffd23f', L: '#fff3a0', g: '#c98a0f' });
function LEAF_ROWS_SMALL() { return ['....G....', '...GLG...', 'G..GLG..G', 'GG.GLG.GG', '.GGGLGGG.', '..GGLGG..', 'GGGGgGGGG', '....g....', '....g....']; }
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
const SPROUTY = [sprite([
  '....GG.GG...',
  '...GLGkGLG..',
  '....GGkGG...',
  '......k.....',
  '...kkkkkk...',
  '..kGGGGGGk..',
  '.kGLGGGGGGk.',
  '.kGkwGGkwGk.',
  '.kGGGGGGGGk.',
  '.kGGGrrGGGk.',
  '..kGGGGGGk..',
  '...kk..kk...',
]), sprite([
  '...GG...GG..',
  '..GLGGkGGLG.',
  '....GGkGG...',
  '......k.....',
  '...kkkkkk...',
  '..kGGGGGGk..',
  '.kGLGGGGGGk.',
  '.kGGGGGGGGk.',
  '.kGkkGGkkGk.',
  '.kGGGrrGGGk.',
  '..kGGGGGGk..',
  '..kk....kk..',
])];
const ENEMY_TOP = [
  '....kkkkkk....',
  '..kkDDDDDDkk..',
  '.kDDDDDDDDDDk.',
  'kDDkkkkkkkkDDk',
  'kDDkkwkkkwkDDk',
  'kDDDkkDDkkDDDk',
  'kDDDDDDDDDDDDk',
  'kDDDDkkkkDDDDk',
  'kDDDkDDDDkDDDk',
  '.kDDDDDDDDDDk.',
  '..kkkkkkkkkk..',
];
const ENEMY = [
  sprite([...ENEMY_TOP, '..kEEk..kEEk..', '..kkk....kkk..']),
  sprite([...ENEMY_TOP, '.kEEk....kEEk.', '.kkk......kkk.']),
];
const HEART = sprite(['.kk.kk.', 'krrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']);
const HEART_E = sprite(['.kk.kk.', 'kEEkEEk', 'kEEEEEk', '.kEEEk.', '..kEk..', '...k...']);
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
const PLANT = sprite(LEAF_ROWS, { ...P, G: '#3f9a3a', L: '#78c850', g: '#27622a' });
const LEAF_ICON = sprite(['...G...', '..GLG..', 'G.GLG.G', 'GGGLGGG', '.GGLGG.', '...g...', '...g...']);
const PUFFBALL = [sprite([
  '...kkk.kkk..',
  '..kwwwkwwwk.',
  '.kwwwwwwwwwk',
  'kwwwwwwwwwwk',
  'kwwkwwwwkwwk',
  'kwwkwwwwkwwk',
  'kwwwwrrwwwwk',
  '.kwwwwwwwwk.',
  '..kDwkkwDk..',
  '...kk..kk...',
]), sprite([
  '..kkk..kkk..',
  '.kwwwkkwwwk.',
  '.kwwwwwwwwwk',
  'kwwwwwwwwwwk',
  'kwwwwwwwwwwk',
  'kwkkwwwwkkwk',
  'kwwwwrrwwwwk',
  '.kwwwwwwwwk.',
  '..kDwkkwDk..',
  '..kk....kk..',
])];
const DRONE_ROWS = [
  '..kkkk..kkkk..',
  '.....k..k.....',
  '....kkkkkk....',
  '..kkDDDDDDkk..',
  '.kDDkwkkwkDDk.',
  'kEDDDDDDDDDDEk',
  '.kkkkkkkkkkkk.',
  '.....krrk.....',
  '......kk......',
];
const DRONE = [sprite(DRONE_ROWS), sprite(DRONE_ROWS.map((r, i) => i === 0 ? 'kkkk......kkkk' : i === 7 ? '.....kyyk.....' : r))];
const BUDS = ['sprouty', 'puffball'];
const BUD_IMG = { sprouty: SPROUTY, puffball: PUFFBALL };
const BUD_INFO = {
  sprouty: ['SPROUTY JOINED YOU!', 'PRESS JUMP IN THE AIR TO DOUBLE JUMP'],
  puffball: ['PUFFBALL JOINED YOU!', 'HOLD JUMP WHILE FALLING TO FLOAT'],
};
const EMOTES = ['420!', 'NICE!', 'HELP!', 'LOL'];

// ============================================================
//  TILES
// ============================================================
const EMPTY = 0, GRASS = 1, DIRT = 2, BRICK = 3, BOX = 4, USED = 5, PTL = 6, PTR = 7, PL = 8, PR = 9;
function tileCanvas(fn) { const c = document.createElement('canvas'); c.width = c.height = T; fn(c.getContext('2d')); return c; }
const R = (g, col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
function dirtFill(g) {
  R(g, '#8a5a32', 0, 0, 16, 16);
  [[2, 7], [9, 5], [13, 11], [5, 13], [11, 14], [1, 11], [7, 9]].forEach(([x, y]) => R(g, '#5c3a1e', x, y, 2, 1));
  [[4, 10], [12, 7], [8, 13]].forEach(([x, y]) => R(g, '#a8733f', x, y, 1, 1));
}
const TILES = [];
TILES[GRASS] = tileCanvas(g => {
  dirtFill(g);
  R(g, '#6fd13f', 0, 0, 16, 4); R(g, '#b6f07a', 0, 0, 16, 1); R(g, '#2f9e44', 0, 4, 16, 1);
  [1, 5, 10, 14].forEach(x => R(g, '#2f9e44', x, 5, 1, 1)); [3, 8, 12].forEach(x => R(g, '#2f9e44', x, 4, 2, 2));
});
TILES[DIRT] = tileCanvas(dirtFill);
TILES[BRICK] = tileCanvas(g => {
  R(g, '#c8642c', 0, 0, 16, 16); R(g, '#e8905a', 0, 0, 16, 1);
  R(g, '#6b2e14', 0, 7, 16, 1); R(g, '#6b2e14', 0, 15, 16, 1);
  R(g, '#6b2e14', 7, 0, 1, 7); R(g, '#6b2e14', 15, 0, 1, 7); R(g, '#6b2e14', 3, 8, 1, 7); R(g, '#6b2e14', 11, 8, 1, 7);
});
function boxBase(g, face, shade) {
  R(g, '#1a1026', 0, 0, 16, 16); R(g, face, 1, 1, 14, 14); R(g, shade, 1, 14, 14, 1); R(g, shade, 14, 1, 1, 14);
  [[2, 2], [12, 2], [2, 12], [12, 12]].forEach(([x, y]) => R(g, '#1a1026', x, y, 2, 2));
}
TILES[BOX] = tileCanvas(g => { boxBase(g, '#ffd23f', '#c98a0f'); R(g, '#fff3a0', 1, 1, 13, 1); g.drawImage(LEAF_ICON, 4, 4); });
const GOLDBOX = 13;
TILES[GOLDBOX] = tileCanvas(g => { boxBase(g, '#ffe66a', '#e0a010'); R(g, '#ffffff', 1, 1, 13, 1); g.drawImage(GOLD_LEAF, 3, 3); });
TILES[USED] = tileCanvas(g => boxBase(g, '#8a5a32', '#5c3a1e'));
function pipeBody(g, left) {
  R(g, '#1a1026', 0, 0, 16, 16);
  if (left) { R(g, '#2f9e44', 2, 0, 14, 16); R(g, '#6fd13f', 4, 0, 3, 16); R(g, '#b6f07a', 5, 0, 1, 16); }
  else { R(g, '#2f9e44', 0, 0, 14, 16); R(g, '#1d6b2c', 8, 0, 6, 16); }
}
TILES[PL] = tileCanvas(g => pipeBody(g, true));
TILES[PR] = tileCanvas(g => pipeBody(g, false));
TILES[PTL] = tileCanvas(g => { R(g, '#1a1026', 0, 0, 16, 16); R(g, '#2f9e44', 1, 1, 15, 8); R(g, '#6fd13f', 3, 1, 3, 8); R(g, '#b6f07a', 4, 2, 1, 6); R(g, '#1a1026', 0, 9, 16, 1); pipeBodyLower(g, true); });
TILES[PTR] = tileCanvas(g => { R(g, '#1a1026', 0, 0, 16, 16); R(g, '#2f9e44', 0, 1, 15, 8); R(g, '#1d6b2c', 8, 1, 7, 8); R(g, '#1a1026', 0, 9, 16, 1); pipeBodyLower(g, false); });
function pipeBodyLower(g, left) {
  if (left) { R(g, '#2f9e44', 2, 10, 14, 6); R(g, '#6fd13f', 4, 10, 3, 6); R(g, '#b6f07a', 5, 10, 1, 6); }
  else { R(g, '#2f9e44', 0, 10, 14, 6); R(g, '#1d6b2c', 8, 10, 6, 6); }
}

// city tiles (World 1-2)
const ROOF = 10, WALL = 11, WALL2 = 12;
function wallFill(g, lit) {
  R(g, '#3a2f5a', 0, 0, 16, 16);
  R(g, '#2a2046', 0, 15, 16, 1); R(g, '#2a2046', 15, 0, 1, 16);
  const on = lit ? '#ffd23f' : '#241a3a', glow = lit ? '#fff3a0' : '#2e2248';
  [[3, 4], [9, 4]].forEach(([x, y]) => { R(g, '#1a1026', x - 1, y - 1, 6, 8); R(g, on, x, y, 4, 6); R(g, glow, x, y, 4, 1); R(g, '#1a1026', x, y + 3, 4, 1); });
}
TILES[WALL] = tileCanvas(g => wallFill(g, true));
TILES[WALL2] = tileCanvas(g => wallFill(g, false));
TILES[ROOF] = tileCanvas(g => {
  wallFill(g, false); R(g, '#3a2f5a', 0, 6, 16, 10);
  R(g, '#8a8fa8', 0, 0, 16, 5); R(g, '#c0c4d8', 0, 0, 16, 1); R(g, '#5a5f78', 0, 5, 16, 1);
  R(g, '#5a5f78', 4, 2, 1, 1); R(g, '#5a5f78', 11, 3, 1, 1);
});

// ============================================================
//  PARALLAX BACKGROUND (pre-rendered, seamlessly tiling)
// ============================================================
function layer(fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d')); return c; }
const TAU = Math.PI * 2;
const SKY = layer(g => {
  const bands = ['#4aa8f0', '#5cb4f2', '#72c0f2', '#8ccbf0', '#a8d6ee', '#c4e0e6', '#e0e6d6', '#f6e6b8'];
  bands.forEach((c, i) => R(g, c, 0, i * 20, W, 20)); R(g, bands[7], 0, 160, W, 32);
  // sun
  g.fillStyle = '#fff3a0';
  for (let y = -14; y <= 14; y++) { const w = Math.floor(Math.sqrt(196 - y * y)); g.fillRect(250 - w, 50 + y, w * 2, 1); }
});
const MOUNTAINS = layer(g => {
  for (let x = 0; x < W; x++) {
    const h = 62 + 18 * Math.sin(TAU * x / W * 2) + 9 * Math.sin(TAU * x / W * 5 + 1) + 4 * Math.sin(TAU * x / W * 11);
    R(g, '#9b83d6', x, H - h - 30, 1, h + 30);
    R(g, '#b9a4ea', x, H - h - 30, 1, 2);
  }
});
const HILLS = layer(g => {
  for (let x = 0; x < W; x++) {
    const h = 34 + 12 * Math.sin(TAU * x / W * 3) + 6 * Math.sin(TAU * x / W * 7 + 2);
    R(g, '#3f9a4a', x, H - h - 16, 1, h + 16); R(g, '#62b85a', x, H - h - 16, 1, 2);
  }
  // little background ganja plants on the hills
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 53, h = 34 + 12 * Math.sin(TAU * x / W * 3) + 6 * Math.sin(TAU * x / W * 7 + 2);
    g.globalAlpha = .55; g.drawImage(PLANT, x, H - h - 16 - 12); g.globalAlpha = 1;
  }
});
const CLOUDS = layer(g => {
  const cloud = (cx, cy, s) => {
    g.fillStyle = '#ffffff';
    [[0, 4, 8 * s, 4], [2, 1, 4 * s, 7], [3 * s, 0, 3 * s, 8], [5 * s, 2, 3 * s, 6]].forEach(([x, y, w, h]) => g.fillRect(cx + x, cy + y, w, h));
    g.fillStyle = '#d8e8f8'; g.fillRect(cx, cy + 7, 8 * s, 1);
  };
  cloud(20, 20, 4); cloud(140, 38, 3); cloud(230, 14, 5);
});
function drawLayer(img, factor, camX, drift = 0) {
  const off = ((camX * factor + drift) % W + W) % W;
  ctx.drawImage(img, -Math.floor(off), 0); ctx.drawImage(img, W - Math.floor(off), 0);
}

// ---- Hempire City (night) layers ----
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const CITY_SKY = layer(g => {
  const bands = ['#140c2e', '#1a0f36', '#22123e', '#2c1648', '#381a52', '#481e5a', '#5e2660', '#7a3264'];
  bands.forEach((c, i) => R(g, c, 0, i * 20, W, 20)); R(g, bands[7], 0, 160, W, 32);
  for (let i = 0; i < 60; i++) R(g, rnd() < .3 ? '#fff3a0' : '#c9b8f0', Math.floor(rnd() * W), Math.floor(rnd() * 110), 1, 1);
  g.fillStyle = '#fff3d0';
  for (let y = -12; y <= 12; y++) { const w = Math.floor(Math.sqrt(144 - y * y)); g.fillRect(60 - w, 40 + y, w * 2, 1); }
  g.fillStyle = '#1a0f36';
  for (let y = -12; y <= 12; y++) { const w = Math.floor(Math.sqrt(144 - y * y)); g.fillRect(66 - w, 36 + y, w * 2, 1); }
});
function skyline(g, base, minH, maxH, col, winCol, neon) {
  let x = 0;
  while (x < W) {
    let w = 12 + Math.floor(rnd() * 22); if (x + w > W - 8) w = W - x;
    const h = minH + Math.floor(rnd() * (maxH - minH)), top = H - base - h;
    R(g, col, x, top, w, h + base);
    for (let wy = top + 4; wy < H - base; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (rnd() < .35) R(g, winCol, wx, wy, 2, 2);
    if (neon && rnd() < .5) R(g, rnd() < .5 ? '#ff5ad2' : '#6fd13f', x, top, w, 1);
    if (rnd() < .3) R(g, col, x + Math.floor(w / 2), top - 6, 1, 6);
    x += w + (rnd() < .5 ? 2 : 0);
  }
}
const CITY_FAR = layer(g => skyline(g, 20, 40, 100, '#2a1d4c', 'rgba(255,210,63,.45)', false));
const CITY_NEAR = layer(g => {
  skyline(g, 0, 20, 60, '#1f1438', 'rgba(255,210,63,.8)', true);
  // neon leaf sign
  g.globalAlpha = .9; g.drawImage(sprite(LEAF_ROWS, { ...P, G: '#6fd13f', L: '#d4ff9a', g: '#6fd13f' }), 150, H - 90); g.globalAlpha = 1;
});
const CITY_HAZE = layer(g => {
  g.fillStyle = 'rgba(180,92,255,.12)';
  for (let i = 0; i < 5; i++) g.fillRect(i * 70, 90 + (i % 2) * 14, 60, 6);
});
const THEMES = {
  valley: { sky: SKY, clouds: CLOUDS, far: MOUNTAINS, near: HILLS, plantY: 13 },
  city: { sky: CITY_SKY, clouds: CITY_HAZE, far: CITY_FAR, near: CITY_NEAR, plantY: 13 },
};

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
  str = String(str).toUpperCase().replace(/[^A-Z0-9 !:\-.?/+'#,()%]/g, c => c === '*' ? 'x' : ' ');
  const w = str.length * 4 * sc - sc;
  if (align === 'center') x -= Math.floor(w / 2); else if (align === 'right') x -= w;
  x = Math.round(x); y = Math.round(y);
  drawStr(str, x + sc, y + sc, '#1a1026', sc); drawStr(str, x, y, col, sc);
}

// ============================================================
//  SOUND (tiny chiptune synth)
// ============================================================
let AC = null, master = null, musicOn = true, noiseBuf = null, musicTimer = null;
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
function noise(dur, vol, when) {
  const s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
  s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 6000;
  g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  s.connect(f).connect(g).connect(master); s.start(when); s.stop(when + dur);
}
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const SFX = {
  jump: () => tone(300, 0.14, 'square', 0.05, 0, 2.2),
  dbl: () => { tone(500, 0.12, 'triangle', 0.09, 0, 1.8); tone(750, 0.12, 'triangle', 0.06, 0.06, 1.5); },
  coin: (c = 0) => { const k = Math.pow(2, Math.min(c, 12) / 12); tone(988 * k, 0.06, 'square', 0.05); tone(1319 * k, 0.18, 'square', 0.05, 0.06); },
  munch: () => [392, 523, 659, 523, 784].forEach((f, i) => tone(f, 0.08, 'triangle', 0.1, i * 0.05)),
  star: () => [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.12, 'square', 0.05, i * 0.05)),
  nug: () => [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.12, 'square', 0.05, i * 0.06)),
  stomp: () => tone(220, 0.12, 'square', 0.08, 0, 0.4),
  bump: () => tone(120, 0.08, 'triangle', 0.1),
  hurt: () => tone(400, 0.35, 'sawtooth', 0.06, 0, 0.25),
  power: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.1, 'square', 0.05, i * 0.07)),
  flag: () => [523, 587, 659, 698, 784, 880, 988, 1047].forEach((f, i) => tone(f, 0.16, 'square', 0.05, i * 0.09)),
  cp: () => { tone(784, 0.1, 'square', 0.05); tone(1047, 0.2, 'square', 0.05, 0.1); },
};
// Laid-back reggae-ish loop: Am - G - F - G, bass + offbeat skank + hats + little melody
function startMusic() {
  const step = 60 / 78 / 2; // eighth notes at 78 bpm
  const chords = [[57, 60, 64], [55, 59, 62], [53, 57, 60], [55, 59, 62]];
  const bass = [[45, -1, 45, 52, -1, 52, 50, 48], [43, -1, 43, 50, -1, 50, 47, 45], [41, -1, 41, 48, -1, 48, 45, 43], [43, -1, 43, 50, -1, 50, 52, 55]];
  const mel = [[69, -1, 72, -1, 76, -1, 74, 72], [71, -1, -1, 67, -1, -1, 69, -1], [72, -1, 69, -1, 65, -1, 67, 69], [71, -1, 74, -1, 71, -1, -1, -1]];
  let next = AC.currentTime + 0.1, i = 0;
  musicTimer = setInterval(() => {
    while (next < AC.currentTime + 0.3) {
      if (musicOn) {
        const bar = Math.floor(i / 8) % 4, s = i % 8, section = Math.floor(i / 32) % 2;
        if (bass[bar][s] > 0) tone(midi(bass[bar][s]), step * 1.6, 'triangle', 0.13, next - AC.currentTime);
        if (s % 2 === 1) chords[bar].forEach(n => tone(midi(n), step * 0.45, 'square', 0.018, next - AC.currentTime));
        noise(s % 2 ? 0.05 : 0.02, s % 2 ? 0.05 : 0.02, next);
        if (section === 1 && mel[bar][s] > 0) tone(midi(mel[bar][s]), step * 1.4, 'square', 0.025, next - AC.currentTime);
      }
      next += step; i++;
    }
  }, 50);
}

// ============================================================
//  INPUT
// ============================================================
const K = { left: false, right: false, jump: false, run: false, jumpPressed: false, enter: false };
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump', KeyZ: 'jump', KeyK: 'jump',
  ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run', KeyJ: 'run', Enter: 'enter'
};
function press(k, down) {
  if (k === 'jump' && down && !K.jump) K.jumpPressed = true;
  if (k === 'enter' && down && !K.enter) K.enterPressed = true;
  K[k] = down;
}
addEventListener('keydown', e => {
  if (!running) return;
  if (e.code === 'KeyM') { musicOn = !musicOn; return; }
  if ((e.code === 'KeyP' || e.code === 'Escape') && !Net.online) { paused = !paused; return; }
  if (/^Digit[1-4]$/.test(e.code) && state === 'play') { emote(+e.code[5] - 1); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault(); press(k, true);
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) press(k, false); });
addEventListener('blur', () => { for (const k in K) K[k] = false; });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); press(k, true); if (k === 'jump' && state === 'clear') K.enterPressed = true; });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => press(k, false)));
});

// ============================================================
//  LEVELS
// ============================================================
let COLS = 0;
const LEVEL_NAMES = [['WORLD 1-1', 'KUSH VALLEY'], ['WORLD 1-2', 'HEMPIRE CITY']];

function buildLevel(n) {
  COLS = n === 1 ? 200 : 205;
  const m = [...Array(ROWS)].map(() => new Array(COLS).fill(EMPTY));
  const coins = [], nugs = [], enemies = [], nugBoxes = new Set(), deco = [];
  const set = (x, y, t) => { if (m[y] && x >= 0 && x < COLS) m[y][x] = t; };
  const plat = (x, y, n, t = BRICK) => { for (let i = 0; i < n; i++) set(x + i, y, t); };
  const pipe = (x, h, base = 9) => { for (let i = 0; i < h; i++) { const y = base - i, top = i === h - 1; set(x, y, top ? PTL : PL); set(x + 1, y, top ? PTR : PR); } };
  const coin = (x, y) => coins.push({ x: x * T + 3, y: y * T + 3, id: 'c' + coins.length, taken: false });
  const row = (x, y, n) => { for (let i = 0; i < n; i++) coin(x + i, y); };
  const arc = (x, y, n) => { for (let i = 0; i < n; i++) coin(x + i, y - Math.round(Math.sin(i / (n - 1) * Math.PI) * 2)); };
  const nug = (x, y) => nugs.push({ x: x * T + 3, y: y * T + 3, id: 'n' + nugs.length, taken: false });
  const foe = (x, y = 9) => enemies.push({ kind: 'walker', id: 'e' + enemies.length, x: x * T + 1, y: y * T + 3, w: 14, h: 13, vx: 0, vy: 0, dir: -1, alive: true, dead: 0, onGround: false, active: false });
  const drone = (x, y, range = 40) => enemies.push({ kind: 'drone', id: 'e' + enemies.length, hx: x * T, hy: y * T, x: x * T, y: y * T, w: 14, h: 9, range, t: (x * 37) % 400, dir: 1, alive: true, dead: 0, active: false });
  const stairs = (x, h, base = 9) => { for (let i = 0; i < h; i++) for (let j = 0; j <= i; j++) set(x + i, base - j, BRICK); };
  const nugBox = (x, y) => { set(x, y, BOX); nugBoxes.add(x + ',' + y); };
  const munchies = [];
  const munchie = (x, y) => munchies.push({ x: x * T + 3, y: y * T + 4, id: 'm' + munchies.length, taken: false });
  const plant = (x, topRow) => deco.push({ x: x * T + 1, y: topRow * T - 13 });

  let bud, cp, goal, spawn, theme;

  if (n === 0) {
    // ================= 1-1 KUSH VALLEY =================
    theme = 'valley';
    const gaps = [[30, 32], [66, 69], [112, 115], [152, 155], [170, 172]];
    const isGap = x => gaps.some(g => x >= g[0] && x <= g[1]);
    for (let x = 0; x < COLS; x++) if (!isGap(x)) { m[10][x] = GRASS; m[11][x] = DIRT; }
    row(6, 9, 4);
    set(11, 6, BOX);
    plat(15, 7, 5); set(17, 7, BOX); row(15, 5, 5);
    foe(22);
    pipe(25, 2);
    arc(29, 7, 5);
    pipe(36, 3);
    plat(40, 7, 5); row(40, 6, 5);
    plat(46, 4, 5);
    foe(43);
    set(52, 6, BOX); nugBox(53, 6); set(54, 6, BOX);
    foe(56); foe(60);
    stairs(61, 4);
    arc(66, 5, 4); nug(67, 2);
    set(70, 9, BRICK); set(70, 8, BRICK); set(70, 7, BRICK); set(71, 9, BRICK); set(71, 8, BRICK); set(72, 9, BRICK);
    row(74, 9, 3);
    set(76, 6, BOX); set(77, 6, BRICK); nugBox(78, 6); set(79, 6, BRICK); set(80, 6, GOLDBOX); munchie(71, 5);
    foe(79); foe(84);
    pipe(95, 3); row(97, 6, 3); pipe(100, 4);
    plat(104, 7, 6); row(104, 6, 4); nug(109, 5);
    plat(113, 7, 2); arc(111, 5, 6);
    foe(118); foe(122);
    plat(125, 7, 3); plat(128, 3, 7); row(128, 2, 7); nug(134, 1);
    foe(130); foe(135);
    set(140, 6, BOX); nugBox(141, 6); set(142, 6, BOX); row(139, 9, 5);
    foe(145); foe(148);
    arc(151, 6, 6);
    plat(158, 7, 5); row(158, 5, 5); foe(160, 6);
    foe(165);
    arc(169, 7, 5);
    foe(176);
    stairs(180, 6);
    row(187, 5, 3);
    [5, 19, 38, 58, 74, 90, 108, 121, 138, 163, 178, 191].forEach(x => { if (!isGap(x)) plant(x, 10); });
    bud = { kind: 'sprouty', x: 48 * T + 2, y: 4 * T - 12, taken: false };
    cp = { x: 88 * T, y: 10, active: false };
    goal = { x: 196 * T + 6, y: 10 };
    spawn = { x: 2 * T, y: 9 * T - 14 };
  } else {
    // ================= 1-2 HEMPIRE CITY (rooftops at night) =================
    theme = 'city';
    let wallSeed = 3;
    const building = (x0, x1, top) => {
      for (let x = x0; x <= x1; x++) {
        set(x, top, ROOF);
        for (let y = top + 1; y < ROWS; y++) { wallSeed = (wallSeed * 7 + 3) % 11; set(x, y, wallSeed < 6 ? WALL : WALL2); }
      }
    };
    building(0, 14, 9);   row(5, 7, 5); set(10, 5, BOX); plant(2, 9);
    building(17, 26, 8);  row(18, 6, 3); foe(24, 7);
    building(30, 38, 9);  drone(34, 5); arc(27, 6, 4); plant(31, 9);
    building(43, 50, 7);  row(44, 5, 6); nugBox(47, 3); foe(48, 6);
    arc(39, 5, 4);
    building(55, 60, 9);  drone(58, 6, 30); plant(56, 9);
    arc(51, 5, 4);
    building(64, 75, 8);  set(67, 5, BOX); set(68, 5, BRICK); set(69, 5, GOLDBOX); munchie(95, 6); set(70, 5, BRICK); set(71, 5, BOX);
    foe(66, 7); foe(73, 7); pipe(74, 2, 7);
    arc(76, 6, 4); nug(78, 2);
    building(80, 86, 10); row(81, 8, 5); drone(83, 6, 36);
    building(92, 104, 8); plant(93, 8); pipe(100, 2, 7); foe(98, 7);
    arc(87, 7, 5);
    building(110, 116, 7); row(111, 5, 5); drone(108, 4, 20);
    arc(105, 5, 5);
    building(122, 130, 9); foe(125, 8); foe(128, 8); drone(126, 5, 40); plant(123, 9);
    arc(117, 4, 5); nug(119, 1);
    building(136, 140, 6); row(136, 4, 5); nugBox(138, 2);
    arc(131, 5, 5);
    building(146, 160, 8); foe(150, 7); foe(155, 7); set(152, 5, BOX); set(153, 5, BOX); plant(158, 8);
    drone(143, 5, 16);
    building(166, 172, 9); drone(169, 5, 30); row(167, 7, 5);
    arc(161, 5, 5);
    building(178, COLS - 1, 9); foe(184, 8); stairs(186, 3, 8); row(190, 7, 3); plant(180, 9);
    arc(173, 6, 5); nug(175, 2);
    bud = { kind: 'puffball', x: 22 * T + 2, y: 8 * T - 12, taken: false };
    cp = { x: 96 * T, y: 8, active: false };
    goal = { x: 194 * T + 6, y: 9 };
    spawn = { x: 2 * T, y: 8 * T };
  }

  return {
    n, theme, name: LEVEL_NAMES[n], map: m, coins, nugs, munchies, enemies, nugBoxes, deco, bumps: [],
    bud, cp, goal, spawn
  };
}

// ============================================================
//  WORLD STATE
// ============================================================
let lvl, me, camX = 0, state = 'play', frame = 0, running = false;
let particles = [], popups = [], banner = null, clearT = 0;
const remotes = new Map(); // id -> {name,color,x,y,tx,ty,f,a,b,trail,emote}

function makePlayer(keep) {
  const p = {
    x: lvl.spawn.x, y: lvl.spawn.y, w: 10, h: 14, vx: 0, vy: 0, onGround: false, face: 1,
    jumps: 0, coyote: 0, jumpBuf: 0, cut: false, inv: 60, walkT: 0, sq: 0, gliding: false, star: 0,
    coins: 0, nugs: 0, score: 0, hearts: 3, combo: 0, comboT: 0, best: 0, buds: [],
    resX: lvl.spawn.x, resY: lvl.spawn.y, trail: [], color: Net.color, name: Net.name, emote: null
  };
  if (keep) for (const k of ['coins', 'nugs', 'score', 'best', 'buds']) p[k] = keep[k];
  return p;
}
const hasBud = k => me.buds.includes(k);

// start (or restart) a level. keepStats = carry coins/score/budmons over
function startLevel(n, keepStats) {
  const old = keepStats && me ? me : null;
  lvl = buildLevel(n);
  me = makePlayer(old);
  if (me.buds.includes(lvl.bud.kind)) lvl.bud.taken = true;
  camX = 0; state = 'play'; particles = []; popups = []; clearT = 0;
  banner = { t: 180, a: lvl.name[0], b: lvl.name[1] + (n === 1 ? ' - HOLD RUN FOR BIG JUMPS' : '') };
  for (const r of remotes.values()) { r.tx = r.ty = -100; r.x = r.y = -100; r.trail = []; }
  for (const c of Net.pendingCollected) applyCollected(c.id, c.l);
  Net.pendingCollected = [];
}

// ============================================================
//  PHYSICS
// ============================================================
function tileAt(tx, ty) {
  if (tx < 0 || tx >= COLS) return BRICK; // world edges are walls
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
    const ty = Math.floor(b.y / T);
    const mid = Math.floor((b.x + b.w / 2) / T);
    let hit = -1;
    if (solid(mid, ty)) hit = mid; else for (let tx = l; tx <= r; tx++) if (solid(tx, ty)) { hit = tx; break; }
    if (hit >= 0 && ty >= 0) { b.y = (ty + 1) * T; b.vy = 0; if (onHead) onHead(hit, ty); }
  }
}
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

// ============================================================
//  GAMEPLAY HELPERS
// ============================================================
function puff(x, y, n, cols, spd = 1) {
  for (let i = 0; i < n; i++) particles.push({
    x, y, vx: (Math.random() - .5) * 2 * spd, vy: (Math.random() - .8) * 1.5 * spd, life: 20 + Math.random() * 20,
    col: cols[Math.floor(Math.random() * cols.length)], s: 1 + Math.floor(Math.random() * 3), g: 0.02
  });
}
function popup(x, y, str, col = '#fff') { popups.push({ x, y, str, col, t: 50 }); }
function collect(id) { Net.send({ t: 'col', id, l: lvl.n }); }

function addCombo(x, y, base) {
  me.combo++; me.comboT = 100;
  me.best = Math.max(me.best, me.combo);
  const pts = base * me.combo;
  me.score += pts;
  popup(x, y, me.combo > 1 ? '+' + pts + ' x' + me.combo : '+' + pts, me.combo >= 5 ? '#b6f07a' : '#fff');
  if (me.combo === 5 || me.combo === 10 || me.combo === 20) {
    tone(784, 0.1, 'square', 0.05); tone(1175, 0.25, 'square', 0.05, 0.1);
    puff(me.x + 5, me.y + 7, 18, ['#b6f07a', '#6fd13f', '#e4b3ff', '#ffffff'], 1.6);
  }
}
function getCoin(x, y) { me.coins++; SFX.coin(me.combo); addCombo(x, y - 6, 10); puff(x + 5, y + 4, 6, ['#fff3a0', '#ffd23f', '#ffffff']); }
function getNug(x, y) { me.nugs++; SFX.nug(); addCombo(x, y - 6, 100); puff(x + 4, y + 4, 14, ['#6fd13f', '#b45cff', '#ff8a1f', '#b6f07a'], 1.4); popup(x, y - 14, 'NUG!', '#b6f07a'); }

function headHit(tx, ty) {
  const t = lvl.map[ty][tx];
  lvl.bumps.push({ tx, ty, t: 8 });
  if (t === GOLDBOX) {
    lvl.map[ty][tx] = USED;
    collect('b' + tx + '_' + ty);
    particles.push({ x: tx * T + 3, y: ty * T - 10, vx: 0, vy: -2.5, life: 26, img: GOLD_LEAF, g: 0.12 });
    getStar();
  } else if (t === BOX) {
    lvl.map[ty][tx] = USED;
    collect('b' + tx + '_' + ty);
    const x = tx * T + 3, y = ty * T - 10, isNug = lvl.nugBoxes.has(tx + ',' + ty);
    if (isNug) getNug(x, y); else getCoin(x, y);
    particles.push({ x, y, vx: 0, vy: -2.5, life: 22, img: isNug ? NUG : COIN, g: 0.15 });
    // bonk enemies standing on the box
    lvl.enemies.forEach(e => { if (e.alive && e.kind === 'walker' && Math.abs(e.x + 7 - (tx * T + 8)) < 14 && Math.abs(e.y + e.h - ty * T) < 3) killEnemy(e); });
  } else SFX.bump();
}
function killEnemy(e, remote) {
  if (!e.alive) return;
  e.alive = false; e.dead = 30;
  puff(e.x + 7, e.y + 6, 10, ['#d0d0e0', '#9aa0b8', '#ffffff', '#b6f07a'], 1.2);
  if (remote) return;
  SFX.stomp(); collect(e.id); shake = Math.max(shake, 4);
  addCombo(e.x, e.y - 4, 50);
}
function applyCollected(id, l) {
  if (!lvl || !running) { Net.pendingCollected.push({ id, l }); return; }
  if (l !== undefined && l !== lvl.n) return;
  if (id[0] === 'c') { const c = lvl.coins.find(c => c.id === id); if (c) c.taken = true; }
  else if (id[0] === 'n') { const n = lvl.nugs.find(n => n.id === id); if (n) n.taken = true; }
  else if (id[0] === 'm') { const u = lvl.munchies.find(u => u.id === id); if (u) u.taken = true; }
  else if (id[0] === 'e') { const e = lvl.enemies.find(e => e.id === id); if (e) killEnemy(e, true); }
  else if (id[0] === 'b') { const [tx, ty] = id.slice(1).split('_').map(Number); if (lvl.map[ty] && (lvl.map[ty][tx] === BOX || lvl.map[ty][tx] === GOLDBOX)) { lvl.map[ty][tx] = USED; lvl.bumps.push({ tx, ty, t: 8 }); } }
}

let shake = 0;
function getStar() {
  me.star = 540; SFX.star(); shake = 6;
  banner = { t: 150, a: 'GOLDEN LEAF!', b: 'YOU ARE UNSTOPPABLE - RUN INTO ENEMIES' };
  puff(me.x + 5, me.y + 7, 30, ['#ffd23f', '#fff3a0', '#ffffff', '#b6f07a'], 2);
}
function hurt() {
  if (me.inv > 0 || me.star > 0 || state !== 'play') return;
  shake = 10;
  me.hearts--; me.inv = 100; me.vy = -3.5; me.vx = -me.face * 1.5; me.combo = 0;
  SFX.hurt(); puff(me.x + 5, me.y + 7, 10, ['#e03b3b', '#ffffff']);
  if (me.hearts <= 0) respawn('BUZZKILLED!');
}
function respawn(msg) {
  me.hearts = 3; me.x = me.resX; me.y = me.resY; me.vx = me.vy = 0; me.inv = 100; me.combo = 0; me.trail = [];
  banner = { t: 100, a: msg, b: 'BACK TO THE ' + (lvl.cp.active ? 'CHECKPOINT' : 'START') };
  SFX.hurt();
}
function emote(i) {
  me.emote = { e: i, t: 120 };
  Net.send({ t: 'emote', e: i });
  tone(660, 0.08, 'square', 0.04); tone(880, 0.1, 'square', 0.04, 0.08);
}

// ============================================================
//  UPDATE
// ============================================================
let paused = false;
function update() {
  if (paused) return;
  frame++;
  if (banner && --banner.t <= 0) banner = null;

  if (state === 'play') updatePlayer();
  else if (state === 'clear') {
    clearT++;
    if (K.enterPressed && clearT > 60) {
      const next = (lvl.n + 1) % LEVEL_NAMES.length;
      if (Net.online) Net.send({ t: 'next', n: next }); else startLevel(next, true);
    }
  }
  K.jumpPressed = false; K.enterPressed = false;
  if (me.emote && --me.emote.t <= 0) me.emote = null;

  updateEnemies();

  // remote players: smooth towards their last known position
  for (const r of remotes.values()) {
    if (r.tx < -50) continue;
    if (Math.abs(r.tx - r.x) > 80 || Math.abs(r.ty - r.y) > 80) { r.x = r.tx; r.y = r.ty; }
    r.x += (r.tx - r.x) * 0.35; r.y += (r.ty - r.y) * 0.35;
    r.trail.unshift({ x: r.x, y: r.y }); if (r.trail.length > 34) r.trail.pop();
    if (r.emote && --r.emote.t <= 0) r.emote = null;
  }

  lvl.bumps = lvl.bumps.filter(b => --b.t > 0);
  particles = particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += p.g; return --p.life > 0; });
  popups = popups.filter(p => { p.y -= 0.5; return --p.t > 0; });

  // camera
  const target = me.x + me.w / 2 - W / 2 + me.face * 24;
  camX += (target - camX) * 0.08;
  camX = Math.max(0, Math.min(camX, COLS * T - W));

  // network: send my state ~20x per second
  if (Net.online && frame % 3 === 0) {
    Net.send({
      t: 's', x: Math.round(me.x), y: Math.round(me.y), l: lvl.n,
      a: !me.onGround ? 2 : Math.abs(me.vx) > 0.2 ? (Math.floor(me.walkT / 6) % 2) : 0,
      f: me.face, b: BUDS.reduce((m, k, i) => m | (hasBud(k) ? 1 << i : 0), 0) | (me.star > 0 ? 16 : 0)
    });
  }
}

function updatePlayer() {
  const p = me;
  const max = K.run ? 2.7 : 1.7, acc = p.onGround ? 0.16 : 0.11;
  if (K.left && !K.right) { p.vx = Math.max(p.vx - acc, -max); p.face = -1; }
  else if (K.right && !K.left) { p.vx = Math.min(p.vx + acc, max); p.face = 1; }
  else { p.vx *= p.onGround ? 0.8 : 0.96; if (Math.abs(p.vx) < 0.05) p.vx = 0; }
  if (Math.abs(p.vx) > max) p.vx *= 0.97;

  if (K.jumpPressed) p.jumpBuf = 8; else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.onGround) { p.coyote = 6; p.jumps = hasBud('sprouty') ? 1 : 0; } else if (p.coyote > 0) p.coyote--;
  if (p.jumpBuf > 0) {
    if (p.coyote > 0) {
      p.vy = -5.6 - Math.abs(p.vx) * 0.25; p.coyote = 0; p.jumpBuf = 0; p.cut = true; p.sq = 8; SFX.jump();
    } else if (p.jumps > 0) {
      p.jumps--; p.vy = -5.2; p.jumpBuf = 0; p.cut = true; SFX.dbl();
      puff(p.x + 5, p.y + 14, 12, ['#ffffff', '#e0e0f0', '#b6f07a', '#c9b8f0'], 1.3);
      popup(p.x - 4, p.y + 14, 'PUFF!', '#b6f07a');
    }
  }
  if (p.cut && !K.jump && p.vy < -2.2) { p.vy = -2.2; p.cut = false; }
  p.vy = Math.min(p.vy + 0.28, 6.5);
  // Puffball glide: hold jump while falling
  p.gliding = hasBud('puffball') && K.jump && p.vy > 0.9 && !p.onGround;
  if (p.gliding) { p.vy = 0.9; if (frame % 6 === 0) puff(p.x + 5, p.y + 16, 1, ['#ffffff', '#e0e0f0'], .4); }

  const wasGround = p.onGround, prevBottom = p.y + p.h;
  moveBody(p, headHit);

  // co-op: you can stand on your friends' heads
  if (p.vy >= 0 && !p.onGround) for (const r of remotes.values()) {
    if (r.tx < -50) continue;
    const top = r.y;
    if (p.x + p.w > r.x + 1 && p.x < r.x + 9 && prevBottom <= top + 2 && p.y + p.h >= top) {
      p.y = top - p.h; p.vy = 0; p.onGround = true; break;
    }
  }

  if (!wasGround && p.onGround) { p.sq = 6; puff(p.x + 5, p.y + 14, 3, ['#e8d8b8', '#ffffff'], .5); }
  if (p.onGround && Math.abs(p.vx) > 0.2) p.walkT += Math.abs(p.vx) / 1.7; else p.walkT = 0;
  if (p.sq > 0) p.sq--;
  if (p.inv > 0) p.inv--;
  if (p.star > 0) { p.star--; if (frame % 3 === 0) puff(p.x + Math.random() * 10, p.y + Math.random() * 14, 1, ['#ffd23f', '#fff3a0', '#b6f07a', '#e4b3ff'], .3); if (p.star === 120) banner = { t: 60, a: 'WEARING OFF...', b: '' }; }
  if (p.onGround && Math.abs(p.vx) > 2.3 && frame % 4 === 0) puff(p.x + 5 - p.face * 5, p.y + 13, 1, ['#e8d8b8', '#ffffff', '#c8b898'], .4);
  if (p.comboT > 0 && --p.comboT === 0) p.combo = 0;

  p.trail.unshift({ x: p.x, y: p.y }); if (p.trail.length > 34) p.trail.pop();

  // fell in a pit
  if (p.y > H + 30) {
    p.hearts--;
    if (p.hearts <= 0) respawn('UP IN SMOKE!');
    else { p.x = p.resX; p.y = p.resY; p.vx = p.vy = 0; p.inv = 100; p.combo = 0; p.trail = []; SFX.hurt(); banner = { t: 70, a: 'WHOA, CAREFUL!', b: '' }; }
    return;
  }

  // collectibles
  const box = { x: p.x, y: p.y, w: p.w, h: p.h };
  for (const c of lvl.coins) if (!c.taken && overlap(box, { x: c.x, y: c.y, w: 10, h: 9 })) { c.taken = true; collect(c.id); getCoin(c.x, c.y); }
  for (const n of lvl.nugs) if (!n.taken && overlap(box, { x: n.x, y: n.y, w: 9, h: 9 })) { n.taken = true; collect(n.id); getNug(n.x, n.y); }
  for (const u of lvl.munchies) if (!u.taken && overlap(box, { x: u.x, y: u.y, w: 9, h: 8 })) {
    u.taken = true; collect(u.id); SFX.munch();
    if (p.hearts < 3) { p.hearts++; popup(u.x - 8, u.y - 8, 'MUNCHIES! +1', '#ff8a8a'); }
    else { p.score += 500; popup(u.x - 4, u.y - 8, '+500', '#ff8a8a'); }
    puff(u.x + 4, u.y + 4, 12, ['#ffd23f', '#e03b3b', '#ffffff'], 1.2);
  }
  const bud = lvl.bud;
  if (!bud.taken && overlap(box, { x: bud.x, y: bud.y, w: 12, h: 12 })) {
    bud.taken = true; p.buds.push(bud.kind); SFX.power();
    banner = { t: 220, a: BUD_INFO[bud.kind][0], b: BUD_INFO[bud.kind][1] };
    puff(bud.x + 6, bud.y + 6, 24, ['#6fd13f', '#b6f07a', '#ffffff', '#ffd23f'], 1.8);
  }

  // enemies
  for (const e of lvl.enemies) {
    if (!e.alive || !overlap(box, e)) continue;
    if (p.star > 0) { killEnemy(e); continue; }
    if (p.vy > 0 && p.y + p.h - e.y < 9) { killEnemy(e); p.vy = K.jump ? -6 : -4; p.cut = false; p.jumps = hasBud('sprouty') ? 1 : 0; }
    else hurt();
  }

  // checkpoint
  if (!lvl.cp.active && p.x > lvl.cp.x) {
    lvl.cp.active = true; p.resX = lvl.cp.x; p.resY = lvl.cp.y * T - p.h - 2; SFX.cp();
    popup(lvl.cp.x - 10, lvl.cp.y * T - 40, 'CHECKPOINT!', '#b6f07a');
  }
  // goal
  if (p.x + p.w > lvl.goal.x) {
    state = 'clear'; clearT = 0; banner = null; SFX.flag();
    me.score += me.hearts * 500 + me.nugs * 42;
    p.vx = 0;
    puff(lvl.goal.x, 60, 40, ['#6fd13f', '#b6f07a', '#ffd23f', '#b45cff', '#ffffff'], 2.5);
  }
}

function updateEnemies() {
  for (const e of lvl.enemies) {
    if (!e.alive) { if (e.dead > 0) e.dead--; continue; }
    if (e.kind === 'drone') {
      e.t++;
      const nx = e.hx + Math.sin(e.t / 70) * e.range;
      e.dir = nx > e.x ? 1 : -1; e.x = nx;
      e.y = e.hy + Math.sin(e.t / 18) * 6;
      continue;
    }
    if (!e.active) { // wake up when any player gets close, so friends see roughly the same thing
      let near = e.x < camX + W + 24;
      for (const r of remotes.values()) if (r.l === lvl.n && e.x < r.x + W / 2 + 40) near = true;
      if (near) e.active = true; else continue;
    }
    e.vx = e.dir * 0.45;
    e.vy = Math.min(e.vy + 0.28, 6);
    moveBody(e);
    if (e.hitWall) e.dir *= -1;
    if (e.onGround) {
      const ax = e.dir > 0 ? e.x + e.w + 1 : e.x - 1;
      if (!solid(Math.floor(ax / T), Math.floor((e.y + e.h + 2) / T))) e.dir *= -1;
    }
    if (e.y > H + 40) e.alive = false;
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
  const w = str.length * 4 + 5;
  const x = Math.round(cx - camX - w / 2);
  ctx.fillStyle = '#1a1026'; ctx.fillRect(x - 1, y - 1, w + 2, 11); ctx.fillRect(x + w / 2 - 1, y + 10, 3, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x, y, w, 9);
  drawStr(str, x + 3, y + 2, '#2f9e44', 1);
}

function drawPlayer(x, y, face, anim, buds, trail, name, color, sq, inv, emote, gliding, star) {
  // Budmons follow in a line behind you
  buds.forEach((k, i) => {
    const t = trail[Math.min(10 + i * 11, trail.length - 1)] || { x, y };
    const bx = t.x - face * 10, by = t.y - 6 + Math.sin(frame / 8 + i * 2) * 2;
    draw_(BUD_IMG[k][Math.floor(frame / 16) % 2], bx, by, face < 0);
  });
  if (gliding) draw_(PUFFBALL[0], x - 1, y - 12);
  if (!(inv > 0 && Math.floor(inv / 4) % 2)) {
    const img = PLAYER[color][anim];
    if (star) ctx.filter = 'hue-rotate(' + (frame * 24 % 360) + 'deg) saturate(2) brightness(1.2)';
    if (sq > 0) {
      const sx = Math.round(x - camX - 4), sy = Math.round(y);
      ctx.save(); ctx.translate(sx + (face < 0 ? 18 : 0), sy); ctx.scale(face < 0 ? -1 : 1, 1);
      ctx.drawImage(img, 0, 0, 18, 14); ctx.restore();
    } else draw_(img, x - 3, y - 2, face < 0);
    ctx.filter = 'none';
  }
  if (emote) bubble(EMOTES[emote.e], x + 5, y - (name ? 24 : 14));
  if (name) text(name, x + 5 - camX, y - 10, SHIRTS[color], 1, 'center');
}

function drawFlagpole(x, baseRow, active, small) {
  const gx = Math.round(x - camX), base = baseRow * T;
  const h = small ? 3 * T : 8 * T, top = base - h;
  ctx.fillStyle = '#1a1026'; ctx.fillRect(gx - 1, top - 2, 4, h + 2);
  ctx.fillStyle = '#e8e8f0'; ctx.fillRect(gx, top, 2, h);
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(gx - 2, top - 6, 6, 6);
  const wave = Math.round(Math.sin(frame / 10));
  if (small) {
    ctx.fillStyle = active ? '#6fd13f' : '#9aa0b8';
    ctx.fillRect(gx + 2, top + (active ? 0 : h - 12) + wave, 12, 8);
    return;
  }
  ctx.fillStyle = '#2f9e44'; ctx.fillRect(gx - 26, top + 2 + wave, 24, 16);
  ctx.fillStyle = '#6fd13f'; ctx.fillRect(gx - 25, top + 3 + wave, 22, 14);
  text('420', gx - 20, top + 8 + wave, '#1a1026');
}

function draw() {
  const th = THEMES[lvl.theme];
  ctx.save();
  if (shake > 0) { ctx.translate(Math.round((Math.random() - .5) * shake), Math.round((Math.random() - .5) * shake)); shake *= 0.85; if (shake < 0.5) shake = 0; }
  ctx.drawImage(th.sky, 0, 0);
  drawLayer(th.clouds, 0.08, camX, frame * 0.1);
  drawLayer(th.far, 0.18, camX);
  drawLayer(th.near, 0.4, camX);

  for (const d of lvl.deco) draw_(PLANT, d.x, d.y);

  // tiles
  const c0 = Math.max(0, Math.floor(camX / T)), c1 = Math.min(COLS - 1, c0 + Math.ceil(W / T) + 1);
  for (let ty = 0; ty < ROWS; ty++) for (let tx = c0; tx <= c1; tx++) {
    const t = lvl.map[ty][tx]; if (!t) continue;
    const b = lvl.bumps.find(b => b.tx === tx && b.ty === ty);
    const off = b ? -Math.sin(b.t / 8 * Math.PI) * 5 : 0;
    ctx.drawImage(TILES[t], Math.round(tx * T - camX), ty * T + Math.round(off));
  }

  drawFlagpole(lvl.cp.x, lvl.cp.y, lvl.cp.active, true);
  drawFlagpole(lvl.goal.x, lvl.goal.y, true, false);

  // coins (spinning) + nugs (bobbing)
  const spin = Math.abs(Math.cos(frame / 12));
  for (const c of lvl.coins) {
    if (c.taken) continue; const x = Math.round(c.x - camX); if (x < -12 || x > W) continue;
    const w = Math.max(2, Math.round(10 * spin)); ctx.drawImage(COIN, x + Math.round((10 - w) / 2), c.y, w, 9);
  }
  for (const u of lvl.munchies) if (!u.taken) draw_(MUNCHIE, u.x, u.y + Math.sin(frame / 9 + u.x) * 1.5);
  for (const n of lvl.nugs) if (!n.taken) draw_(NUG, n.x, n.y + Math.sin(frame / 10 + n.x) * 2);
  if (!lvl.bud.taken) {
    draw_(BUD_IMG[lvl.bud.kind][Math.floor(frame / 20) % 2], lvl.bud.x, lvl.bud.y + Math.sin(frame / 12) * 2);
    if (frame % 60 < 40) text('?', lvl.bud.x + 4 - camX, lvl.bud.y - 10, '#fff3a0');
  }

  // enemies
  for (const e of lvl.enemies) {
    if (!e.alive) {
      if (e.dead > 0) { const x = Math.round(e.x - camX); ctx.globalAlpha = e.dead / 30; ctx.drawImage(e.kind === 'drone' ? DRONE[0] : ENEMY[0], x, e.y + 8, 14, 5); ctx.globalAlpha = 1; }
      continue;
    }
    if (e.kind === 'drone') draw_(DRONE[Math.floor(frame / 4) % 2], e.x, e.y, false);
    else draw_(ENEMY[Math.floor(frame / 12) % 2], e.x, e.y, e.dir > 0);
  }

  // other players (only those on the same level)
  for (const r of remotes.values()) {
    if (r.tx < -50 || r.l !== lvl.n) continue;
    drawPlayer(r.x, r.y, r.f || 1, r.a, BUDS.filter((k, i) => r.b & (1 << i)), r.trail, r.name, r.color, 0, 0, r.emote, false, r.b & 16);
  }
  // me
  const anim = !me.onGround ? 2 : (Math.abs(me.vx) > 0.2 ? Math.floor(me.walkT / 6) % 2 : 0);
  drawPlayer(me.x, me.y, me.face, anim, me.buds, me.trail, Net.online ? me.name : '', me.color, me.sq, me.inv, me.emote, me.gliding, me.star > 0);

  // particles + popups
  for (const p of particles) {
    if (p.img) { draw_(p.img, p.x, p.y); continue; }
    ctx.globalAlpha = Math.min(1, p.life / 15); ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x - camX), Math.round(p.y), p.s, p.s); ctx.globalAlpha = 1;
  }
  for (const p of popups) text(p.str, p.x - camX, p.y, p.col);
  ctx.restore();

  drawHUD();
}

function drawHUD() {
  ctx.fillStyle = 'rgba(26,16,38,.55)'; ctx.fillRect(0, 0, W, 16);
  ctx.drawImage(COIN, 4, 3); text('x' + String(me.coins).padStart(3, '0'), 16, 5, '#ffd23f');
  ctx.drawImage(NUG, 50, 3); text('x' + me.nugs, 62, 5, '#b6f07a');
  for (let i = 0; i < 3; i++) ctx.drawImage(i < me.hearts ? HEART : HEART_E, 84 + i * 9, 5);
  me.buds.forEach((k, i) => ctx.drawImage(BUD_IMG[k][0], 116 + i * 14, 2));
  if (me.star > 0) { ctx.drawImage(GOLD_LEAF, 148, 4); ctx.fillStyle = '#ffd23f'; ctx.fillRect(160, 8, Math.ceil(me.star / 540 * 30), 3); }
  if (paused) { ctx.fillStyle = 'rgba(26,16,38,.6)'; ctx.fillRect(0, 0, W, H); text('PAUSED', W / 2, 80, '#b6f07a', 3, 'center'); text('P OR ESC TO RESUME', W / 2, 104, '#fff', 1, 'center'); }
  text(String(me.score).padStart(6, '0'), W - 4, 5, '#fff', 1, 'right');
  text(lvl.name[0].replace('WORLD ', ''), W - 34, 5, '#9f8fc0', 1, 'right');
  if (Net.online) {
    text('ROOM ' + Net.code, W - 4, 20, '#e4b3ff', 1, 'right');
    text((remotes.size + 1) + '/4 PLAYERS', W - 4, 28, '#9f8fc0', 1, 'right');
  } else if (Net.reconnecting) text('RECONNECTING...', W - 4, 20, '#ff8a8a', 1, 'right');
  if (!musicOn) text('MUSIC OFF', 4, 20, '#9f8fc0');

  // combo meter
  if (me.combo >= 2) {
    const blazed = me.combo >= 5;
    const col = blazed ? ['#b6f07a', '#e4b3ff', '#ffd23f', '#ffffff'][Math.floor(frame / 4) % 4] : '#fff';
    text(me.combo + 'x COMBO', W / 2, 22, col, 1, 'center');
    if (blazed) text(me.combo >= 10 ? 'HIGHER THAN EVER!' : 'BLAZED!', W / 2, 31, col, 2, 'center');
    ctx.fillStyle = '#1a1026'; ctx.fillRect(W / 2 - 25, 18, 50, 3);
    ctx.fillStyle = blazed ? '#b6f07a' : '#ffd23f'; ctx.fillRect(W / 2 - 24, 19, Math.round(48 * me.comboT / 100), 1);
  }

  if (banner) {
    ctx.globalAlpha = Math.min(1, banner.t / 20);
    ctx.fillStyle = 'rgba(26,16,38,.7)'; ctx.fillRect(0, 70, W, banner.b ? 34 : 22);
    text(banner.a, W / 2, 76, '#b6f07a', 2, 'center');
    if (banner.b) text(banner.b, W / 2, 92, '#fff', 1, 'center');
    ctx.globalAlpha = 1;
  }

  if (state === 'clear') {
    const last = lvl.n === LEVEL_NAMES.length - 1;
    ctx.fillStyle = 'rgba(26,16,38,.8)'; ctx.fillRect(40, 36, W - 80, 120);
    text(last ? 'DEMO COMPLETE!' : 'LEVEL CLEAR!', W / 2, 46, '#b6f07a', 2, 'center');
    text('HASH COINS   ' + me.coins, W / 2, 70, '#ffd23f', 1, 'center');
    text('NUGS         ' + me.nugs, W / 2, 80, '#b6f07a', 1, 'center');
    text('BEST COMBO   ' + me.best + 'x', W / 2, 90, '#e4b3ff', 1, 'center');
    text('SCORE ' + me.score, W / 2, 104, '#fff', 2, 'center');
    if (clearT > 60 && frame % 60 < 40) {
      text(last ? 'ENTER - PLAY AGAIN FROM 1-1' : 'ENTER - NEXT: ' + LEVEL_NAMES[lvl.n + 1][1], W / 2, 130, '#fff', 1, 'center');
      if (Net.online) text('WHOEVER PRESSES IT MOVES THE WHOLE CREW', W / 2, 140, '#9f8fc0', 1, 'center');
    }
  }
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
  ws: null, online: false, reconnecting: false, code: '', color: 0, name: 'STONER', level: 0, pendingCollected: [],
  send(o) { if (this.online && this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); },

  // open a socket, send create/join, resolve when the server says we're in
  connect(first) {
    return new Promise((resolve, reject) => {
      if (location.protocol === 'file:') return reject(new Error('Online play needs the server. Run start.bat, then open localhost:3000'));
      let ws;
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
      catch (e) { return reject(new Error('Could not reach the game server')); }
      const timer = setTimeout(() => { ws.close(); reject(new Error('Server did not answer')); }, 8000);
      ws.onopen = () => ws.send(JSON.stringify(first));
      ws.onerror = () => { clearTimeout(timer); reject(new Error('Could not reach the game server')); };
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.t === 'err') { clearTimeout(timer); ws.close(); reject(new Error(m.msg)); return; }
        if (m.t !== 'joined') return;
        clearTimeout(timer);
        this.ws = ws; this.online = true; this.reconnecting = false;
        this.code = m.code; this.color = m.color; this.level = m.level;
        remotes.clear();
        m.players.forEach(addRemote);
        ws.onmessage = e2 => { try { onNet(JSON.parse(e2.data)); } catch (err) { console.error(err); } };
        ws.onerror = null;
        ws.onclose = () => { if (this.ws === ws) this.lost(); };
        if (running) { // this was a reconnect
          me.color = m.color;
          if (m.level !== lvl.n) startLevel(m.level, true);
          m.collected.forEach(id => applyCollected(id, m.level));
          banner = { t: 90, a: 'RECONNECTED!', b: '' };
        } else this.pendingCollected = m.collected.map(id => ({ id, l: m.level }));
        resolve();
      };
    });
  },

  // connection dropped: keep playing, keep retrying in the background
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
function addRemote(p) { remotes.set(p.id, { name: p.name, color: p.color, x: -100, y: -100, tx: -100, ty: -100, f: 1, a: 0, b: 0, l: -1, trail: [], emote: null }); }
function onNet(m) {
  switch (m.t) {
    case 's': { const r = remotes.get(m.id); if (!r) return; if (r.tx < -50 || r.l !== m.l) { r.x = m.x; r.y = m.y; r.trail = []; } r.tx = m.x; r.ty = m.y; r.f = m.f; r.a = m.a; r.b = m.b; r.l = m.l; break; }
    case 'pj': addRemote(m); popup(camX + W / 2 - 30, 60, m.name + ' JOINED!', '#b6f07a'); SFX.cp(); break;
    case 'pl': { const r = remotes.get(m.id); if (r) popup(camX + W / 2 - 30, 60, r.name + ' LEFT', '#9f8fc0'); remotes.delete(m.id); break; }
    case 'col': applyCollected(m.id, m.l); break;
    case 'level': startLevel(m.n, true); break;
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
function startGame() {
  initAudio();
  $('menu').style.display = 'none';
  document.body.classList.add('playing');
  running = true;
  startLevel(Net.online ? Net.level : 0, false);
  if (Net.online) banner = { t: 260, a: 'ROOM CODE: ' + Net.code, b: 'SEND THIS CODE TO YOUR FRIENDS' };
  requestAnimationFrame(loop);
}
function busy(on) { ['solo', 'create', 'join'].forEach(id => $(id).disabled = on); }
async function goOnline(msg) {
  $('err').textContent = 'CONNECTING...'; busy(true);
  try { await Net.connect(msg); startGame(); }
  catch (e) { $('err').textContent = e.message.toUpperCase(); busy(false); }
}
$('solo').onclick = () => { Net.name = getName(); startGame(); };
$('create').onclick = () => { Net.name = getName(); goOnline({ t: 'create', name: Net.name }); };
$('join').onclick = () => {
  const code = $('code').value.trim().toUpperCase();
  if (code.length < 5) { $('err').textContent = 'ENTER THE 5-LETTER ROOM CODE'; return; }
  Net.name = getName(); goOnline({ t: 'join', code, name: Net.name });
};
$('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('join').click(); });
// share links: yoursite.com/?room=ABCDE fills in the code
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) { $('code').value = urlRoom.toUpperCase().slice(0, 5); $('err').textContent = 'ENTER YOUR NAME AND PRESS JOIN'; }

// draw a static preview behind the menu
lvl = buildLevel(0); me = makePlayer(); camX = 0; draw();

// debug/test hook
window.__KQ = { get me() { return me; }, get lvl() { return lvl; }, get state() { return state; }, K, remotes, Net, startLevel };
})();
