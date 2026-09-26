// KUSH QUEST - Road to the Farm
// A cozy retro co-op platformer for up to 4 friends online.
// Plain JavaScript + <canvas>, no engine. All art is drawn in code as pixel arrays.
'use strict';
(() => {

let W = 400; const H = 192, T = 16, ROWS = 12, ZW = 320, LW = 400; // W becomes the screen-fitted view width after the art is built
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
// fill the whole window: height stays 192 game pixels, width stretches to match the screen shape
function fit() {
  if (typeof TQ !== 'undefined') setTimeout(() => running && draw(), 0);
  const aspect = innerWidth / innerHeight;
  W = Math.max(300, Math.min(LW, Math.round(H * aspect)));
  if (cv.width !== W) { cv.width = W; cv.height = H; }
  ctx.imageSmoothingEnabled = false;
  const s = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = Math.round(W * s) + 'px'; cv.style.height = Math.round(H * s) + 'px';
}
addEventListener('resize', () => { fit(); if (running) draw(); });

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
// Text is drawn on a second, full-resolution canvas on top of the game with a real pixel font
// (VT323) and a dark outline, so it stays sharp and readable at any screen size.
// Layout is unchanged: every string is fitted to the same width the old 3x5 font used.
const tv = document.createElement('canvas');
tv.style.cssText = 'position:fixed;pointer-events:none;z-index:3;left:0;top:0';
document.body.appendChild(tv);
const tctx = tv.getContext('2d');
const TQ = [];
function text(str, x, y, col = '#fff', sc = 1, align = 'left') {
  str = String(str).toUpperCase();
  const w = str.length * 4 * sc - sc;
  if (align === 'center') x -= Math.floor(w / 2); else if (align === 'right') x -= w;
  const m = ctx.getTransform();
  TQ.push({ str, x: m.e + x * m.a, y: m.f + y * m.d, w: w * m.a, sc: sc * m.d, col, a: ctx.globalAlpha });
}
function flushText() {
  const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const pw = Math.round(r.width * dpr), ph = Math.round(r.height * dpr);
  if (tv.width !== pw || tv.height !== ph) { tv.width = pw; tv.height = ph; }
  tv.style.left = r.left + 'px'; tv.style.top = r.top + 'px'; tv.style.width = r.width + 'px'; tv.style.height = r.height + 'px';
  const k = pw / W;
  tctx.setTransform(1, 0, 0, 1, 0, 0); tctx.clearRect(0, 0, pw, ph);
  tctx.textBaseline = 'alphabetic'; tctx.lineJoin = 'round';
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

// ============================================================
//  SOUND (tiny chiptune synth)
// ============================================================
let AC = null, master = null, musicOn = true, noiseBuf = null;
function initAudio() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = settings.sfx; master.connect(AC.destination);
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
// ---- ADAPTIVE SOUNDTRACK ----
// map: bouncy 8-bit theme | exploring: laid-back lo-fi chiptune | fights: 8-bit + drum & bass at 174 bpm
function kick(when, vol = 0.5) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine'; o.frequency.setValueAtTime(150, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.14);
  g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
  o.connect(g).connect(master); o.start(when); o.stop(when + 0.25);
}
function snare(when, vol = 0.2) {
  const s = AC.createBufferSource(), g = AC.createGain(), f = AC.createBiquadFilter();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.16);
  s.connect(f).connect(g).connect(master); s.start(when); s.stop(when + 0.18);
  const o = AC.createOscillator(), g2 = AC.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(220, when); o.frequency.exponentialRampToValueAtTime(120, when + 0.08);
  g2.gain.setValueAtTime(vol * 0.6, when); g2.gain.exponentialRampToValueAtTime(0.001, when + 0.1); o.connect(g2).connect(master); o.start(when); o.stop(when + 0.12);
}
function reese(freq, when, dur, vol = 0.09) { // detuned saw bass through a moving filter
  const f = AC.createBiquadFilter(), g = AC.createGain();
  f.type = 'lowpass'; f.Q.value = 6; f.frequency.setValueAtTime(260, when); f.frequency.linearRampToValueAtTime(900, when + dur * 0.5); f.frequency.linearRampToValueAtTime(300, when + dur);
  g.gain.setValueAtTime(vol, when); g.gain.setValueAtTime(vol, when + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.001, when + dur);
  f.connect(g).connect(master);
  for (const d of [-9, 9]) { const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = d; o.connect(f); o.start(when); o.stop(when + dur + 0.02); }
}
const SONGS = {
  map: { bpm: 112, div: 2, steps: 8,
    chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]],
    bass: [[48, 55, 52, 55, 48, 55, 52, 55], [41, 48, 45, 48, 41, 48, 45, 48], [43, 50, 47, 50, 43, 50, 47, 50], [48, 55, 52, 55, 48, 43, 45, 47]],
    lead: [[72, -1, 76, 79, 76, -1, 72, 74], [77, -1, 81, -1, 79, 77, 76, -1], [79, -1, 74, -1, 71, 74, 79, 77], [76, 74, 72, -1, 67, -1, 72, -1]] },
  calm: { bpm: 84, div: 2, steps: 8,
    chords: [[65, 69, 72, 76], [64, 67, 71, 74], [62, 65, 69, 72], [60, 64, 67, 71]],
    bass: [[41, -1, -1, 48, -1, -1, 45, -1], [40, -1, -1, 47, -1, -1, 43, -1], [38, -1, -1, 45, -1, -1, 41, -1], [36, -1, -1, 43, -1, 40, -1, 43]],
    lead: [[76, -1, -1, 77, 76, -1, 72, -1], [74, -1, -1, -1, 71, -1, 67, -1], [72, -1, 74, -1, 76, -1, 77, -1], [79, -1, -1, -1, 76, -1, -1, -1]] },
  fight: { bpm: 174, div: 4, steps: 16,
    roots: [45, 41, 43, 40],
    arp: [[69, 72, 76, 81], [65, 69, 72, 77], [67, 71, 74, 79], [64, 68, 71, 76]] },
};
let musicMode = 'map', musicVol = 1, musicWant = 'map';
function wantedMusic() {
  if (state === 'map' || state === 'story') return 'map';
  if (state === 'play' && lvl && lvl.locked) return 'fight';
  return 'calm';
}
function startMusic() {
  let next = AC.currentTime + 0.1, i = 0, bar = 0;
  // route all music through its own bus so it can fade without touching sound effects
  const bus = AC.createGain(); bus.connect(AC.destination); bus.gain.value = settings.music;
  setInterval(() => {
    const target = wantedMusic() !== musicMode ? 0 : 1;
    musicVol += (target - musicVol) * (target ? 0.05 : 0.07); if (Math.abs(target - musicVol) < 0.01) musicVol = target;
    bus.gain.setTargetAtTime(settings.music * musicVol * (musicOn ? 1 : 0) * ((document.hidden && settings.muteHidden) ? 0 : 1), AC.currentTime, 0.05);
    const realMaster = master; master = bus;
    while (next < AC.currentTime + 0.25) {
      const song = SONGS[musicMode], step = 60 / song.bpm / song.div, s = i % song.steps, dt = next - AC.currentTime;
      if (s === 0) { // change songs only on the downbeat
        const want = wantedMusic();
        if (want !== musicMode && musicVol <= 0.05) { musicMode = want; i = 0; bar = 0; continue; }
      }
      if (musicOn) {
        const b = bar % 4;
        if (musicMode === 'fight') {
          // two-step drum & bass break
          if (s === 0 || s === 10) kick(next, 0.55);
          if (s === 4 || s === 12) snare(next, 0.22);
          if (s === 7 || s === 15) snare(next, 0.06);
          if (bar % 4 === 3 && s >= 12) snare(next, 0.12);
          noise(0.025, s % 2 ? 0.035 : 0.02, next, 8000);
          // rolling reese bass
          const root = song.roots[b];
          if (s === 0) reese(midi(root), next, step * 6, 0.1);
          if (s === 6) reese(midi(root + (b === 3 ? 3 : 7)), next, step * 4, 0.08);
          if (s === 10) reese(midi(root), next, step * 6, 0.1);
          // 8-bit arp screaming over the top
          const arp = song.arp[b];
          tone(midi(arp[s % 4] + (bar % 8 >= 4 ? 12 : 0)), step * 0.8, 'square', 0.022, dt);
          if (s % 4 === 0) tone(midi(arp[0] - 12), step * 3, 'square', 0.02, dt);
        } else {
          const calm = musicMode === 'calm';
          if (song.bass[b][s] > 0) tone(midi(song.bass[b][s]), step * (calm ? 2.4 : 0.9), 'triangle', calm ? 0.13 : 0.12, dt);
          if (calm) { if (s === 0) kick(next, 0.28); if (s === 4) snare(next, 0.07); if (s % 2 === 1) noise(0.03, 0.015, next, 7000); if (s === 2 || s === 6) song.chords[b].forEach(n => tone(midi(n), step * 1.6, 'triangle', 0.018, dt)); }
          else { if (s % 4 === 0) kick(next, 0.3); if (s % 4 === 2) snare(next, 0.08); if (s % 2 === 1) song.chords[b].forEach(n => tone(midi(n), step * 0.4, 'square', 0.015, dt)); noise(0.02, 0.02, next, 8000); }
          const lead = song.lead[b][s];
          if (lead > 0 && (!calm || bar % 8 >= 4)) tone(midi(lead), step * (calm ? 1.8 : 0.9), calm ? 'triangle' : 'square', calm ? 0.035 : 0.025, dt);
        }
      }
      next += step; i++; if (i % song.steps === 0) bar++;
    }
    master = realMaster;
  }, 40);
}

// ============================================================
//  INPUT
// ============================================================
const K = { left: false, right: false, up: false, down: false, jump: false, run: false, attack: false, enter: false };
// ---- settings (saved in this browser): volumes, toggles, custom key bindings ----
const DEFAULT_KEYS = { toke: 'KeyV', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', attack: 'KeyJ', throw: 'KeyK', run: 'ShiftLeft', munchie: 'KeyE', quick: 'KeyC', weapon: 'KeyQ', throwsel: 'KeyR', bag: 'Tab', chat: 'KeyT' };
const ACTION_NAMES = { toke: 'HIT A TOKE (SKILL)', up: 'MOVE UP', down: 'MOVE DOWN', left: 'MOVE LEFT', right: 'MOVE RIGHT', jump: 'JUMP', attack: 'SWING', throw: 'THROW', run: 'RUN', munchie: 'MUNCHIES / REVIVE', quick: 'QUICK ITEM', weapon: 'SWITCH WEAPON', throwsel: 'SWITCH THROWABLE', bag: 'BAG', chat: 'CHAT' };
let settings = { music: 0.7, sfx: 0.8, shake: true, blood: true, bigText: false, reduceFlash: false, colorblind: false, muteHidden: false, holdAttack: false, keys: { ...DEFAULT_KEYS } };
try { const st = JSON.parse(localStorage.getItem('kq_settings')); if (st) settings = { ...settings, ...st, keys: { ...DEFAULT_KEYS, ...(st.keys || {}) } }; } catch (e) {}
function saveSettings() { try { localStorage.setItem('kq_settings', JSON.stringify(settings)); } catch (e) {} if (master) master.gain.value = settings.sfx; }
const keyLabel = c => ({ Space: 'SPACE', ShiftLeft: 'L-SHIFT', ShiftRight: 'R-SHIFT', ControlLeft: 'L-CTRL', Tab: 'TAB', Enter: 'ENTER', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' }[c] || String(c).replace(/^Key|^Digit/, '').toUpperCase());
function actionOf(code) {
  for (const a in settings.keys) if (settings.keys[a] === code) return a;
  return { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', ShiftRight: 'run', Enter: 'enter', KeyI: 'bag' }[code] || null;
}
const KL = a => keyLabel(settings.keys[a]);
let rebinding = null, rebindWarn = null, chatOpen = false, touchEmoteI = -1;
function press(k, down) {
  if (down && !K[k]) { if (k === 'jump') K.jumpPressed = true; if (k === 'enter') K.enterPressed = true; if (k === 'attack') K.attackPressed = true; }
  K[k] = down;
}
addEventListener('keydown', e => {
  if (!running || chatOpen) return;
  const c = e.code;
  if (Net.rejoin && e.code === 'Enter') { Net.doRejoin(); return; }
  if (Net.kicked && e.code === 'Enter') { persist(); location.href = location.pathname; return; }
  if (rebinding) { // waiting for a key to bind
    e.preventDefault();
    if (c !== 'Escape') { const old = settings.keys[rebinding]; for (const a in settings.keys) if (a !== rebinding && settings.keys[a] === c) { settings.keys[a] = old; rebindWarn = { t: 240, m: keyLabel(c) + ' WAS ' + ACTION_NAMES[a] + ' - SWAPPED, THAT IS NOW ' + keyLabel(old) }; } settings.keys[rebinding] = c; saveSettings(); SFX.buy(); }
    rebinding = null; return;
  }
  const a = actionOf(c), nav = ['up', 'down', 'left', 'right'].includes(a) ? a : null;
  if (nav && !e.repeat) { if (K.nav) (K.navQ = K.navQ || []).push(nav); else K.nav = nav; }
  if (c === 'Escape') {
    K.escPressed = true; e.preventDefault();
    if (menu) { if (menu.page !== 'main') { menu.page = 'main'; menu.sel = 0; } else closeMenu(); return; }
    if (invOpen) { invOpen = false; return; }
    if (state === 'results' && results && results.shopOnly) { go(openMap); return; }
    if (state !== 'story') { openMenu(); return; }
  }
  const menuish = menu || state === 'map' || state === 'lobby' || state === 'story' || invOpen;
  if (menuish && !nav && (a === 'jump' || a === 'attack' || c === 'Enter') && (K.nav || (K.navQ && K.navQ.length))) { e.preventDefault(); (K.navQ = K.navQ || []).push('enter'); return; }
  if (menuish && (nav || a === 'jump' || a === 'attack' || c === 'Enter')) { e.preventDefault(); if (a === 'jump') press('jump', true); if (c === 'Enter') press('enter', true); if (a === 'attack') K.attackPressed = true; return; }
  if (a === 'chat' && Net.online) { e.preventDefault(); openChat(); return; }
  if (c === 'KeyH' && state === 'map') { K.shopPressed = true; return; }
  if ((state === 'map' || state === 'results') && (c === 'KeyQ' || c === 'BracketLeft')) { K.worldPrev = true; return; }
  if ((state === 'map' || state === 'results') && (c === 'KeyE' || c === 'BracketRight')) { K.worldNext = true; return; }
  if (a === 'up') K.upPressed = true;
  if (a === 'down') K.downPressed = true;
  if (state === 'results' && (nav || a === 'jump')) { e.preventDefault(); if (a === 'jump') press('jump', true); return; }
  if (c === 'KeyM') { musicOn = !musicOn; return; }
  if (c === 'KeyF') { toggleFullscreen(); return; }
  if (c === 'KeyP' && !Net.online && (state === 'play' || state === 'sitting' || state === 'brief')) { if (menu) closeMenu(); else openMenu(); return; }
  if (a === 'bag' && state !== 'results' && state !== 'story') { e.preventDefault(); invOpen = !invOpen; for (const k in K) if (typeof K[k] === 'boolean') K[k] = false; return; }
  if (state === 'play') {
    if (a === 'weapon') { cycleWeapon(1); return; }
    if (a === 'munchie') { K.use = true; if (![...remotes.values()].some(r => r.b & 8 && Math.abs(r.x - me.x) < 18)) useMunchies(); return; }
    if (a === 'quick') { useItem(save.quick || 'brownie'); return; }
    if (a === 'throw') { K.throwPressed = true; return; }
    if (a === 'toke') { K.toke = true; return; }
    if (a === 'throwsel') { const i = THROWS.findIndex(t => t.id === save.throwSel); save.throwSel = THROWS[(i + 1) % THROWS.length].id; persist(); popup(me.x - 20, sy(me.z) - 34, THROWS.find(t => t.id === save.throwSel).name, '#fff6b0'); return; }
    const em = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[c]; if (em !== undefined) { emote(em + (K.run ? 4 : 0)); return; }
  }
  if (['left', 'right', 'up', 'down', 'jump', 'attack', 'run', 'enter'].includes(a)) { e.preventDefault(); press(a, true); }
});
addEventListener('keyup', e => { const a = actionOf(e.code); if (a === 'munchie') K.use = false; if (a === 'toke') K.toke = false; if (['left', 'right', 'up', 'down', 'jump', 'attack', 'run', 'enter'].includes(a)) press(a, false); });
function nextNav() { const n = K.navQ && K.navQ.shift(); if (n === 'enter') { K.enterPressed = true; return null; } return n || null; }
function toggleFullscreen() { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen().catch(() => {}); }
// ---- chat (online): T to type, ENTER to send ----
const chatIn = document.createElement('input');
chatIn.maxLength = 60; chatIn.placeholder = 'SAY SOMETHING... (ENTER SEND, ESC CANCEL)';
chatIn.style.cssText = 'position:fixed;left:12px;bottom:12px;width:min(520px,70vw);z-index:6;display:none;font:18px VT323,monospace;padding:6px 10px;background:#2a1838;color:#fff;border:2px solid #c8ffa0;outline:none;text-transform:uppercase';
document.body.appendChild(chatIn);
const chatLog = [];
function openChat() { chatOpen = true; for (const k in K) if (typeof K[k] === 'boolean') K[k] = false; chatIn.style.display = 'block'; chatIn.value = ''; setTimeout(() => chatIn.focus(), 0); }
function closeChat() { chatOpen = false; chatIn.style.display = 'none'; chatIn.blur(); cv.focus && cv.focus(); }
chatIn.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Enter') { const msg = chatIn.value.trim().slice(0, 60); if (msg) { Net.send({ t: 'chat', msg }); addChat(Net.name, msg, SHIRTS[Net.color] || '#fff'); me.say = { msg, t: 300 }; } closeChat(); }
  if (e.key === 'Escape') closeChat();
});
chatIn.addEventListener('blur', () => setTimeout(() => { if (chatOpen) closeChat(); }, 0));
function addChat(name, msg, col) { chatLog.push({ name, msg: msg.toUpperCase(), col, t: 720 }); if (chatLog.length > 6) chatLog.shift(); tone(990, 0.05, 'square', 0.03); }
function drawChat() {
  let y = state === 'map' ? H - 46 : H - 30;
  for (let i = chatLog.length - 1; i >= 0 && y > 60; i--) {
    const c = chatLog[i]; if (c.t <= 0 && !chatOpen) continue;
    ctx.globalAlpha = chatOpen ? 1 : Math.min(1, c.t / 60);
    const line = c.name + ': ' + c.msg, w = line.length * 4 + 6;
    R(ctx, 'rgba(26,16,38,.7)', 4, y - 2, w, 9); text(c.name + ':', 7, y, c.col); text(c.msg, 7 + (c.name.length + 2) * 4, y, '#ffffff');
    ctx.globalAlpha = 1; y -= 10;
  }
}
addEventListener('blur', () => { for (const k in K) K[k] = false; });
cv.addEventListener('mousedown', e => {
  if (!running) return; e.preventDefault();
  const r = cv.getBoundingClientRect(), gx = (e.clientX - r.left) / r.width * W, gy = (e.clientY - r.top) / r.height * H;
  const r0 = hotAt(gx, gy); if (r0) { r0.click && r0.click(); return; }
  if (menu || state === 'results' || invOpen) return;
  if (state === 'story') { K.enterPressed = true; return; }
  if (state === 'map') { mapClick(gx, gy); return; }
  if (state === 'brief') { K.enterPressed = true; return; }
  if (e.button === 0) press('attack', true); else if (e.button === 2) K.throwPressed = true;
});
addEventListener('mouseup', e => { if (e.button === 0) press('attack', false); });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousemove', e => {
  const r = cv.getBoundingClientRect(); mouseG = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  const h = hotAt(mouseG.x, mouseG.y); if (h && h.hover) h.hover();
});
cv.addEventListener('wheel', e => { if (!running) return; e.preventDefault(); if (menu) return; if (state === 'results') { if (e.deltaY < 0) K.upPressed = true; else K.downPressed = true; } else if (state === 'play') cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: false });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (['left', 'right', 'up', 'down'].includes(k)) K.nav = k;
    if (k === 'inv') { if (state !== 'results' && state !== 'story') invOpen = !invOpen; return; }
    if (k === 'pause') { gpDispatch('Escape', true); return; }
    if (k === 'emote') { if (state === 'play') emote((touchEmoteI = (touchEmoteI + 1) % EMOTES.length)); return; }
    if (k === 'weapon' || k === 'quick' || k === 'throw') { gpDispatch(settings.keys[k === 'throw' ? 'throw' : k], true); return; }
    if (state === 'map' || state === 'lobby' || state === 'story' || invOpen) { if (k === 'jump' || k === 'attack') K.enterPressed = true; return; }
    if (state === 'results') { if (k === 'left' || k === 'up') K.upPressed = true; else if (k === 'right' || k === 'down') K.downPressed = true; else K.enterPressed = true; return; }
    if (state === 'sitting' && k === 'jump') K.enterPressed = true;
    press(k, true);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => {
    if (k === 'inv' || k === 'pause' || k === 'emote') return;
    if (k === 'weapon' || k === 'quick' || k === 'throw') { gpDispatch(settings.keys[k === 'throw' ? 'throw' : k], false); return; }
    press(k, false);
  }));
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
const CHAR_PERKS = [
  { perk: 'perkHeart', line: '+1 MAX HEART. CHILL AND STURDY.' },
  { perk: 'perkSpeed', line: '+10% MOVE SPEED. HYPE AND FAST.' },
  { perk: 'perkCoins', line: '+15% HASH COINS. PARANOID BUT LUCKY.' },
  { perk: 'perkThrow', line: '+1 THROW DAMAGE, +1 MUNCHIE CARRIED. BIG HEART, BIG APPETITE.' },
];
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
  '.kyYyyyyk.',
  'kyhtNtthyk',
  'kytNNNtTyk',
  'kyNtNtNTyk',
  'kyhtNtTTyk',
  'kytTNTTTyk',
  '.kyyyyyOk.',
  '..kkkkkk..',
], { ...P, y: '#e8b84a', Y: '#fff0b0', O: '#b88a2a', t: '#b87a3e', h: '#d89a5a', T: '#8a5428', N: '#4e2c14' });
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
  blunt: sprite([
    '....................kkkk',
    '..............kkkkkkNNNk',
    '.......kkkkkkkNNNNNNNNNk',
    'kkkkkkkNNNNNNNNNNNNNNNNk',
    'kTTTTTkNNNNNNNNNNNNNNNk.',
    'kkkkkkkkkkkkkkkkkkkkkk..',
  ], { ...P, N: '#a8703a', T: '#e8e0d0' }),
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
ICONS.blunt = sprite(['........kk', '......kkNk', '....kkNNk.', '..kkNNNk..', 'kkNNNkk...', 'kNNkk.....', 'kkk.......'], { ...P, N: '#8a5a3a' });
ICONS.brownie = sprite(['kkkkkkkk', 'kNNnNNNk', 'kNnNNnNk', 'kNNNNNNk', 'kNnNNnNk', 'kkkkkkkk'], { ...P, N: '#6a4428', n: '#9a6a42' });
ICONS.soda = sprite(['.kkkk.', 'kEEEEk', 'kGGGGk', 'kGwGGk', 'kGGGGk', 'kGwGGk', 'kGGGGk', 'kEEEEk', '.kkkk.']);
ICONS.joint = sprite(['.........k', 'kkkkkkkkoy', 'kwwwwwwwyr', 'kkkkkkkkoo']);
ICONS.dab = sprite(['........kk', 'kkkkkkkkEk', 'kEEEEEWWk.', 'kkkkkkkk..'], { ...P, E: '#b8b8d0', W: '#ffffff' });
// --- weapons, armor, shop ---
const WEAPONS = [
  { id: 'puff', name: 'GIANT JOINT', icon: 'joint', dmg: 1, cd: 16, reach: 32, zr: 12, burn: 1, price: 0, desc: 'MELEE SWING. MEDIUM REACH. HITS LEAVE A LITTLE BURN' },
  { id: 'lighter', name: 'LIGHTER BLADE', icon: 'lighter', dmg: 1, cd: 12, reach: 26, zr: 18, burn: 3, spread: 1, price: 90, desc: 'CLOSE + WIDE. BIG BURN THAT SPREADS TO NEIGHBORS' },
  { id: 'dab', name: 'DAB SABER', icon: 'dab', dmg: 2, cd: 10, reach: 46, zr: 8, crit: 0.25, pierce: 1, price: 180, desc: 'LONG + THIN + FAST. HITS THE WHOLE LINE. 25% CRITS' },
  { id: 'bong', name: 'BONG HAMMER', icon: 'bong', dmg: 3, cd: 26, reach: 30, zr: 22, stun: 60, kb: 1.6, price: 160, desc: 'SLOW + HEAVY. STUNS EVERYONE IT SMASHES' },
  { id: 'grinder', name: 'GRINDER SPIN', icon: 'grinder', dmg: 2, cd: 28, reach: 30, zr: 16, spin: 1, bleed: 2, price: 260, desc: 'SPIKY SPIN ALL AROUND YOU. MAKES THEM BLEED' },
  { id: 'blunt', name: 'BLUNT BAT', icon: 'blunt', dmg: 2, cd: 22, reach: 34, zr: 12, kb: 3, homer: 1, price: 220, desc: 'HOME RUN! LAUNCHES THEM INTO THEIR BUDDIES' },
];
const wlv = id => (save.wlv && save.wlv[id]) || 1;
const ARMORS = [
  { id: 'hoodie', name: 'COMFY HOODIE', icon: 'hoodie', hp: 1, price: 70, desc: '+1 MAX HEART' },
  { id: 'vest', name: 'TIE-DYE VEST', icon: 'vest', hp: 2, price: 170, desc: '+2 MAX HEARTS' },
  { id: 'crown', name: 'RASTA CROWN', icon: 'crown', hp: 3, price: 300, desc: '+3 MAX HEARTS' },
];
const FARM_PRICE = 1500, SPOTS_TO_FARM = 5;
const SHOP = [
  ...WEAPONS.slice(1).map(w => ({ kind: 'weapon', ...w })),
  ...ARMORS.map(a => ({ kind: 'armor', ...a })),
  { kind: 'item', id: 'pouch', name: 'STASH POUCH', icon: 'pouch', price: 130, desc: 'MICE + SQUIRRELS CANT STEAL' },
  { kind: 'ammo', id: 'papers', name: 'ROLLING PAPERS x10', icon: 'papers', price: 30, desc: 'THROWING STARS. THROW KEY OR RIGHT-CLICK' },
  { kind: 'ammo', id: 'bombs', name: 'NUG BOMBS x5', icon: 'bombs', price: 60, desc: 'LOB A SMOKY BOMB INTO A CROWD' },
];
const SHOPKEEP_LINES = [
  'WELCOME BACK, LEGEND.', "DON'T SPEND IT ALL ON PAPERS.", 'THE GRINDER SPIN SLAPS, TRUST ME.',
  'YOU SMELL LIKE A GOOD MISSION.', 'SAVE UP FOR THE FARM, HOMIE.', 'BONG HAMMER ON SALE IN MY HEART.',
  "I DON'T MAKE THE PRICES, I JUST VIBE.", 'COME BACK WHEN YOU GOT MORE COINS.',
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
const EMOTES = ['420!', 'NICE!', 'HELP!', 'LOL', 'PASS IT', 'COME HERE', 'WAIT', 'GG'];
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
  enemies: ['mouse', 'squirrel', 'squirrel', 'mouse', 'cop'],
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
// as you push through a level the light changes: [end color, max alpha]
const MOOD = { park: ['255,150,90', 0.28], beach: ['255,110,150', 0.3], suburb: ['60,30,120', 0.35], city: ['200,40,160', 0.25], woods: ['20,40,60', 0.4], hq: ['220,30,50', 0.25] };
// ---- THE BEACH ----
THEMES.beach = {
  name: 'THE BEACH',
  tiles: makeTiles({ top: '#ffe8a8', topLight: '#fff6d8', dirt: '#f0d090', dirtDark: '#d8b070', dirtLight: '#fff0c0', block: '#7ac8ff', blockLight: '#c8ecff', blockDark: '#4a90d8', pipe: '#ff9ab8', pipeLight: '#ffd0e0', pipeDark: '#d06088' }),
  sky: layer(g => {
    gradient(g, ['#5ab8ff', '#6ac4ff', '#82d0ff', '#9ad8ff', '#b4e4ff', '#cdeeff', '#e4f6ff', '#f4fbff']);
    g.fillStyle = '#fff6b0'; for (let y = -14; y <= 14; y++) { const w = Math.floor(Math.sqrt(196 - y * y)); g.fillRect(250 - w, 36 + y, w * 2, 1); }
  }),
  clouds: layer(g => { puffCloud(g, 30, 22, 3, '#ffffff', '#e0f0ff'); puffCloud(g, 170, 40, 2, '#ffffff', '#e0f0ff'); }),
  far: layer(g => { // the ocean
    R(g, '#3a9ae8', 0, H - 110, W, 110); R(g, '#5ab4f0', 0, H - 110, W, 3);
    for (let i = 0; i < 40; i++) R(g, '#c8ecff', (i * 53) % W, H - 104 + (i * 17) % 60, 6 + (i % 3) * 3, 1);
    R(g, '#ffffff', 60, H - 96, 14, 5); R(g, '#ff5a6a', 66, H - 104, 2, 8); // little sailboat
  }),
  near: layer(g => { // palm trees + a lifeguard tower
    for (let i = 0; i < 3; i++) {
      const x = 40 + i * 110, base = H - 30;
      for (let y = 0; y < 50; y++) R(g, '#9a6a42', x + Math.round(Math.sin(y / 14) * 4), base - y, 4, 1);
      g.fillStyle = '#3fae5a';
      for (const [dx, dy] of [[-16, -2], [12, -2], [-10, -8], [8, -8], [0, -6]]) for (let k = 0; k < 14; k++) R(g, '#3fae5a', x + dx + (dx > 0 ? k : -k) / 2, base - 52 + dy + Math.abs(k - 7) / 2, 6, 2);
    }
    R(g, '#ffffff', 200, H - 70, 26, 14); R(g, '#ff5a6a', 200, H - 70, 26, 4); R(g, '#9a6a42', 203, H - 56, 2, 26); R(g, '#9a6a42', 221, H - 56, 2, 26);
  }),
  floor: null, floorKey: 'beach',
  enemies: ['mouse', 'cop', 'squirrel', 'mouse', 'cop'],
};
// ---- MISTY WOODS ----
THEMES.woods = {
  name: 'MISTY WOODS',
  tiles: makeTiles({ top: '#5aa860', topLight: '#8ad890', dirt: '#8a6a4a', dirtDark: '#6a4a30', dirtLight: '#b08a60', block: '#9a6a42', blockLight: '#c89a6a', blockDark: '#6a4428', pipe: '#6a8a5a', pipeLight: '#9ac080', pipeDark: '#4a6a3a' }),
  sky: layer(g => gradient(g, ['#3a5a7a', '#4a6a88', '#5a7a94', '#6e8ca0', '#86a0b0', '#a0b8c0', '#b8ccc8', '#cad8cc'])),
  clouds: layer(g => { g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 6; i++) g.fillRect(i * 55, 70 + (i % 3) * 10, 70, 8); }),
  far: layer(g => { for (let x = 0; x < W; x += 12) { const h = 50 + ((x * 7) % 30); for (let y = 0; y < h; y++) R(g, '#4a6a5a', x + 6 - Math.floor(y / 4 * ((h - y) / h)), H - 30 - y, Math.max(1, Math.floor((h - y) / 4)), 1); R(g, '#4a6a5a', x, H - 30, 12, 30); } }),
  near: layer(g => {
    for (let i = 0; i < 7; i++) {
      const x = i * 48 + 8, h = 60 + (i % 3) * 12, base = H - 20;
      R(g, '#5a3a24', x + 9, base - 16, 4, 16);
      for (let y = 0; y < h; y++) { const w = Math.floor((y / h) * 12) + 1; R(g, y % 8 < 1 ? '#1e4a2a' : '#2a6a3a', x + 11 - w, base - 16 - h + y, w * 2, 1); }
    }
    for (let i = 0; i < 12; i++) R(g, '#ff9ab8', (i * 29) % W, H - 22 - (i % 3), 2, 2); // little mushrooms/flowers
  }),
  floor: null, floorKey: 'woods',
  enemies: ['squirrel', 'squirrel', 'cop', 'mouse', 'karen'],
};
// ---- BUZZKILL CORP HQ ----
THEMES.hq = {
  name: 'BUZZKILL HQ',
  tiles: makeTiles({ top: '#c8c4d8', topLight: '#f0ecf8', dirt: '#8a86a0', dirtDark: '#6a6680', dirtLight: '#b0acc8', block: '#5a5a78', blockLight: '#8a8aa8', blockDark: '#3a3a58', pipe: '#ff5a6a', pipeLight: '#ffa0a8', pipeDark: '#c83048' }),
  sky: layer(g => { gradient(g, ['#d8d4e8', '#d0cce2', '#c8c4dc', '#c0bcd6', '#b8b4d0', '#b0acca', '#a8a4c4', '#a09cbe']); }),
  clouds: layer(g => { for (let x = 0; x < W; x += 80) { R(g, '#ffffff', x + 20, 20, 40, 3); R(g, '#e8e4f8', x + 20, 23, 40, 1); } }), // ceiling lights
  far: layer(g => { // office windows looking out at the city
    for (let x = 0; x < W; x += 40) { R(g, '#2a1838', x + 4, H - 150, 32, 70); R(g, '#8ecbff', x + 6, H - 148, 28, 66); R(g, '#b8e0ff', x + 6, H - 148, 6, 66); R(g, '#2a1838', x + 19, H - 148, 2, 66); }
    R(g, '#ff5a6a', 110, H - 170, 100, 14); // BUZZKILL CORP banner
    for (let i = 0; i < 12; i++) R(g, '#ffffff', 116 + i * 8, H - 166, 5, 6);
  }),
  near: layer(g => { // cubicles + sad office plants
    for (let x = 0; x < W; x += 64) { R(g, '#2a1838', x + 4, H - 44, 50, 26); R(g, '#9a96b8', x + 5, H - 43, 48, 24); R(g, '#b8b4d0', x + 5, H - 43, 48, 2); R(g, '#3a3a58', x + 18, H - 60, 20, 14); R(g, '#7ac8ff', x + 20, H - 58, 16, 10); }
    for (let x = 40; x < W; x += 128) { R(g, '#c87a3a', x, H - 34, 10, 10); R(g, '#6a8a5a', x - 2, H - 48, 14, 14); }
  }),
  floor: null, floorKey: 'hq',
  enemies: ['cop', 'karen', 'cop', 'karen', 'mouse'],
};
THEME_ORDER.length = 0; THEME_ORDER.push('park', 'beach', 'suburb', 'city', 'woods', 'hq');
// ============================================================
//  FIVE WORLDS: tinted variants of the base areas, new enemy variants, bosses, skills
// ============================================================
function variantTheme(base, name, tint, a, enemies) {
  const b = THEMES[base];
  const tl = img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); return c; };
  return { name, tiles: b.tiles, sky: tl(b.sky), clouds: b.clouds, far: tl(b.far), near: tl(b.near), enemies, base, floorTint: [tint, a * 0.7] };
}
// enemy variants: same moves as the originals, new looks, a bit tougher
const BASE_AI = { ranger: 'cop', guard: 'cop', suit: 'karen', rat: 'mouse', raccoon: 'squirrel' };
const VARIANT_HP = { ranger: 1, guard: 2, suit: 1, rat: 0, raccoon: 1 };
{
  const tintSprites = (src, map) => src.map(img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { const key = d.data[i] + ',' + d.data[i + 1] + ',' + d.data[i + 2]; if (map[key]) { d.data[i] = map[key][0]; d.data[i + 1] = map[key][1]; d.data[i + 2] = map[key][2]; } } g.putImageData(d, 0, 0); return c; });
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const swap = pairs => { const m = {}; for (const [f, t] of pairs) m[hex(f).join(',')] = hex(t); return m; };
  ENEMY_IMG.ranger = tintSprites(ENEMY_IMG.cop, swap([[P.d, '#4a7a3a'], [P.D, '#2e5a2a'], [P.y, '#c8a030']]));
  ENEMY_IMG.guard = tintSprites(ENEMY_IMG.cop, swap([[P.d, '#3a3a48'], [P.D, '#22222e'], [P.y, '#e8e8f0']]));
  ENEMY_IMG.suit = tintSprites(ENEMY_IMG.karen, swap([[P.p, '#5a5a78'], [P.q, '#3a3a58'], [P.h, '#4a3a2a'], [P.H, '#2a2018']]));
  ENEMY_IMG.rat = tintSprites(ENEMY_IMG.mouse, swap([[P.m, '#6a5a58'], [P.M, '#4a3a38'], [P.u, '#c86a6a']]));
  ENEMY_IMG.raccoon = tintSprites(ENEMY_IMG.squirrel, swap([[P.t, '#7a7a8a'], [P.T, '#4a4a58'], [P.y, '#e8e8f0']]));
  for (const k of ['ranger', 'guard', 'suit', 'rat', 'raccoon']) ENEMY_FLASH[k] = ENEMY_IMG[k].map(flashOf);
}
Object.assign(THEMES, {
  nightwoods: variantTheme('woods', 'MIDNIGHT WOODS', '#101a4a', 0.5, ['ranger', 'raccoon', 'squirrel', 'ranger', 'mouse']),
  swamp: variantTheme('woods', 'SKUNK SWAMP', '#4a6a10', 0.4, ['rat', 'raccoon', 'ranger', 'rat', 'karen']),
  mountain: variantTheme('woods', 'SNOWY PEAKS', '#f0f4ff', 0.45, ['ranger', 'suit', 'raccoon', 'ranger', 'karen']),
  station: variantTheme('hq', 'RANGER STATION', '#2a6a2a', 0.35, ['ranger', 'ranger', 'suit', 'raccoon', 'guard']),
  sunset: variantTheme('beach', 'SUNSET BEACH', '#ff5a2a', 0.35, ['cop', 'rat', 'karen', 'raccoon', 'mouse']),
  boardwalk: variantTheme('suburb', 'THE BOARDWALK', '#ffa060', 0.3, ['karen', 'suit', 'rat', 'cop', 'raccoon']),
  pier: variantTheme('beach', 'PIER AT NIGHT', '#141e5a', 0.55, ['guard', 'rat', 'suit', 'raccoon', 'cop']),
  island: variantTheme('park', 'HIDDEN ISLAND', '#ffd84a', 0.25, ['raccoon', 'rat', 'ranger', 'suit', 'guard']),
  resort: variantTheme('hq', 'LUXURY RESORT', '#ff9ab8', 0.3, ['suit', 'guard', 'karen', 'suit', 'rat']),
  neon: variantTheme('city', 'NEON STRIP', '#ff3ad2', 0.25, ['guard', 'suit', 'rat', 'cop', 'karen']),
  alley: variantTheme('city', 'BACK ALLEY', '#0a0414', 0.5, ['rat', 'rat', 'guard', 'raccoon', 'suit']),
  club: variantTheme('hq', 'THE CLUB', '#8a2aff', 0.4, ['guard', 'guard', 'suit', 'rat', 'karen']),
  rooftops: variantTheme('suburb', 'ROOFTOPS', '#1a1050', 0.55, ['guard', 'raccoon', 'suit', 'ranger', 'rat']),
  casino: variantTheme('hq', 'HIGH ROLLER CASINO', '#ffc84a', 0.3, ['suit', 'guard', 'guard', 'suit', 'rat']),
  lobby: variantTheme('hq', 'TOWER LOBBY', '#ffffff', 0.15, ['guard', 'suit', 'guard', 'karen', 'suit']),
  labs: variantTheme('hq', 'SOBRIETY LABS', '#3ae8a0', 0.3, ['suit', 'rat', 'guard', 'rat', 'suit']),
  factory: variantTheme('city', 'BUZZKILL FACTORY', '#7a4a2a', 0.4, ['guard', 'guard', 'ranger', 'suit', 'rat']),
  vault: variantTheme('hq', 'THE VAULT', '#1a1a2a', 0.5, ['guard', 'suit', 'guard', 'guard', 'raccoon']),
  penthouse: variantTheme('city', 'THE PENTHOUSE', '#ff3a4a', 0.35, ['suit', 'guard', 'suit', 'guard', 'karen']),
});
const WORLDS = [
  { name: 'ROAD TO THE FARM', levels: ['park', 'beach', 'suburb', 'city', 'hq'], map: { seed: 1337, tint: null } },
  { name: 'INTO THE WILD', levels: ['woods', 'nightwoods', 'swamp', 'mountain', 'station'], map: { seed: 2024, tint: ['#1e4a2a', 0.25] } },
  { name: 'COASTLINE CHAOS', levels: ['sunset', 'boardwalk', 'pier', 'island', 'resort'], map: { seed: 777, tint: ['#ffb070', 0.2] } },
  { name: 'NEON NIGHTS', levels: ['neon', 'alley', 'club', 'rooftops', 'casino'], map: { seed: 4200, tint: ['#1a0a3a', 0.5] } },
  { name: 'BUZZKILL TOWER', levels: ['lobby', 'labs', 'factory', 'vault', 'penthouse'], map: { seed: 9001, tint: ['#3a3a48', 0.4] } },
];
const LEVELS_PER_WORLD = 5, TOTAL_LEVELS = WORLDS.length * LEVELS_PER_WORLD;
const themeKeyFor = n => { const w = WORLDS[Math.floor(n / LEVELS_PER_WORLD) % WORLDS.length]; return w.levels[n % LEVELS_PER_WORLD]; };
const worldOf = n => Math.floor(n / LEVELS_PER_WORLD);

// ---- skills: every boss teaches one ----
const SKILLS = {
  cherry: { name: 'LIGHT THE CHERRY', desc: 'YOUR GIANT JOINT NOW BURNS WHAT IT HITS' },
  charge: { name: 'CHARGED SWING', desc: 'HOLD SWING, THEN LET GO FOR A HUGE HIT' },
  throw: { name: 'THROWING', desc: 'THROW ROLLING PAPERS + NUG BOMBS (K / RIGHT-CLICK). +10 PAPERS' },
  roll: { name: 'DODGE ROLL', desc: 'HOLD RUN + PRESS JUMP TO ROLL THROUGH ATTACKS' },
  toke: { name: 'HIT A TOKE', desc: 'PRESS THE TOKE KEY: BLOW A SMOKE SCREEN. BUZZKILLS INSIDE GET CONFUSED. COSTS 20% COOKED' },
  pound: { name: 'GROUND POUND', desc: 'SWING WHILE FALLING TO SLAM THE GROUND AND STUN EVERYONE NEAR' },
  heart1: { name: 'IRON LUNGS', desc: '+1 MAX HEART' },
  hotbox: { name: 'HOTBOX', desc: 'YOUR SMOKE SCREEN IS BIGGER AND HURTS BUZZKILLS INSIDE' },
  embers: { name: 'EMBERS', desc: 'EVERY WEAPON SETS BUZZKILLS ON FIRE' },
  puffpass: { name: 'PUFF PUFF PASS', desc: 'YOUR SMOKE SCREEN HEALS YOU AND YOUR HOMIES' },
  finisher: { name: 'FINISHER', desc: 'THE 3RD HIT OF EVERY COMBO LAUNCHES THEM' },
  magnet: { name: 'STICKY FINGERS', desc: 'HASH COINS FLY TO YOU' },
  twothrow: { name: 'DOUBLE ROLL', desc: 'THROW TWO ROLLING PAPERS AT ONCE' },
  heart2: { name: 'BIG LUNGS', desc: '+1 MAX HEART' },
  breath: { name: 'DRAGON BREATH', desc: 'HOLD THE TOKE KEY TO BREATHE FIRE. COSTS COOKED WHILE YOU HOLD' },
  rage: { name: 'COUCH LOCK RAGE', desc: 'AT ULTRA COOKED YOU HIT TWICE AS HARD' },
  rollsmoke: { name: 'SMOKE ROLL', desc: 'YOUR DODGE ROLL LEAVES A DAMAGING SMOKE TRAIL' },
  crit: { name: 'THIRD EYE', desc: '15% CRITICAL HITS WITH EVERY WEAPON' },
  heart3: { name: 'LUNGS OF STEEL', desc: '+1 MAX HEART' },
  bongrip: { name: 'GIANT BONG RIP', desc: 'YOUR SMOKE SCREEN KNOCKS EVERYONE DOWN WHEN YOU BLOW IT' },
  regen: { name: 'SELF CARE', desc: 'SLOWLY HEAL WHILE YOU ARE COOKED (50%+)' },
  combo: { name: 'FLOW STATE', desc: 'COMBOS PAY OUT DOUBLE HASH COINS' },
  heart4: { name: 'ZEN MASTER', desc: '+1 MAX HEART' },
  sprint: { name: 'MUNCHIES RUN', desc: 'YOU MOVE 20% FASTER' },
  ultimate: { name: 'THE ULTIMATE HIGH', desc: 'AT 100% COOKED PRESS THE TOKE KEY: A BLAST THAT HITS EVERYTHING ON SCREEN' },
};
// one boss per level; every 5th is a MEGA boss
const BOSSES = [
  ['RANGER RICK', 'cop', 'cherry', 'THIS PARK HAS A STRICT NO FUN POLICY!'],
  ['LIFEGUARD LARRY', 'cop', 'charge', 'NO RUNNING! NO SMOKING! NO CHILLING!'],
  ['HOA PRESIDENT KAREN', 'karen', 'throw', 'YOUR VIBES VIOLATE BYLAW 42!'],
  ['OFFICER DONUT', 'cop', 'roll', 'I SMELL SOMETHING... AND IT AINT MY DONUTS.'],
  ['THE REGIONAL MANAGER', 'karen', 'toke', 'I OWN THIS WHOLE REGION. YOUR FARM IS NEXT.', true],
  ['BIGFOOT RANGER', 'ranger', 'pound', 'THESE WOODS ARE A DRUG FREE ZONE.'],
  ['OWL-EYED WARDEN', 'ranger', 'heart1', 'WHO... WHO... WHO SAID YOU COULD CHILL?'],
  ['SWAMP RAT KING', 'rat', 'hotbox', 'SQUEEEAK! YOUR STASH IS MINE!'],
  ['SNOW KAREN', 'suit', 'embers', 'I WILL FREEZE YOUR VIBES SOLID.'],
  ['HEAD RANGER HANK', 'ranger', 'puffpass', 'THE WILD BELONGS TO BUZZKILL CORP NOW.', true],
  ['BOARDWALK BANDIT', 'raccoon', 'finisher', 'NICE COINS. SHAME IF SOMEONE... TOOK THEM.'],
  ['SHERIFF SANDY', 'cop', 'magnet', 'THIS BEACH AINT BIG ENOUGH FOR THE TWO OF US.'],
  ['PIER PIRATE RAT', 'rat', 'twothrow', 'ARRR, HAND OVER YER HASH!'],
  ['CRUISE DIRECTOR KAREN', 'suit', 'heart2', 'THIS ISLAND IS MEMBERS ONLY!'],
  ['THE RESORT MOGUL', 'suit', 'breath', 'EVERY BEACH WILL BE A BUZZKILL BEACH.', true],
  ['BOUNCER BRUTUS', 'guard', 'rage', 'YOU AINT ON THE LIST.'],
  ['ALLEY CAT RAT', 'rat', 'rollsmoke', 'THIS IS MY ALLEY, STONER.'],
  ['VIP KAREN', 'suit', 'crit', 'DO YOU KNOW WHO I AM?!'],
  ['ROOFTOP SNIPER COP', 'guard', 'heart3', 'I CAN SEE YOUR SMOKE FROM UP HERE.'],
  ['THE NIGHT CHIEF', 'guard', 'bongrip', 'THE CITY NEVER SLEEPS... AND NEITHER DO MY COPS.', true],
  ['HR DIRECTOR', 'suit', 'regen', 'THIS WILL GO ON YOUR PERMANENT RECORD.'],
  ['SECURITY CHIEF', 'guard', 'combo', 'NOBODY GETS PAST SECURITY.'],
  ['LAB RAT PRIME', 'rat', 'heart4', 'I WAS BRED TO HATE FUN.'],
  ['THE AUDITOR', 'suit', 'sprint', 'I HAVE AUDITED YOUR VIBES. THEY FAILED.'],
  ['BUZZKILL CEO', 'suit', 'ultimate', 'I AM THE BUZZKILL. EVERY BUZZ ENDS WITH ME.', true],
];
const hasSkill = id => (save.skills || []).includes(id);


function drawLayer(img, factor, camX, drift = 0, yOff = 0) {
  const iw = img.width, off = ((camX * factor + drift) % iw + iw) % iw;
  for (let x = -Math.floor(off); x < W; x += iw) ctx.drawImage(img, x, yOff);
}
// ============================================================
//  STAGES (beat-em-up streets: walk left/right AND up/down)
// ============================================================
const FLOOR_Y = 110, ZMAX = 66;                 // screen y of the back edge of the street, depth of the street
const sy = (z, h = 0) => FLOOR_Y + z - h;        // world (z,h) -> screen y (feet)
const MISSION_LOOT = ['lighter', 'papers', 'blunt', 'hoodie', 'bombs', 'dab', 'vest', 'bong', 'grinder', 'crown', 'pouch'];
function missionName(n) {
  const th = THEMES[themeKeyFor(n)];
  return ['WORLD ' + (worldOf(n) % WORLDS.length + 1) + '-' + (n % LEVELS_PER_WORLD + 1), th.name + (n >= TOTAL_LEVELS ? ' REMIX' : '')];
}
let LEN = 0;
function buildLevel(n) {
  const themeKey = themeKeyFor(n), theme = THEMES[themeKey];
  const diff = Math.min(n, 12);
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
    const base = (n < 2 ? 7 : 5) + Math.floor(diff * 0.7) + Math.floor(zi / 2);
    const count = Math.round(base * 2.5) + (n < 2 ? 4 : 0); // enough for a full crew of 4; the host only uses what the crew size needs
    const ids = [];
    for (let k = 0; k < count; k++) {
      const kind = pick(theme.enemies);
      const hp = { cop: 3 + Math.floor(diff / 3), karen: 2 + Math.floor(diff / 4), mouse: 1, squirrel: 1 }[BASE_AI[kind] || kind] + (VARIANT_HP[kind] || 0);
      ids.push(enemies.length);
      enemies.push({ id: enemies.length, kind, ai: BASE_AI[kind] || kind, zone: zi, hp, maxHp: hp, x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, dir: -1, state: 0, t: 0, cd: 60 + Math.floor(rand() * 60), flash: 0, spawned: false, alive: true, stolen: 0, tx: 0, tz: 0, th: 0 });
    }
    if (zi === zoneCount - 1) { // the boss arrives after its crew
      const bd = BOSSES[n % BOSSES.length], mega = !!bd[4], crewN = Net.online ? remotes.size + 1 : 1, bhp = Math.round((14 + n * 3) * (mega ? 2.2 : 1) * (1 + 0.4 * (crewN - 1)));
      ids.push(enemies.length);
      const boss = { id: enemies.length, kind: bd[1], ai: BASE_AI[bd[1]] || bd[1], boss: true, mega, bname: bd[0], skill: bd[2], quote: bd[3], zone: zi, hp: bhp, maxHp: bhp, x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, dir: -1, state: 0, t: 0, cd: 90, flash: 0, spawned: false, alive: true, stolen: 0, tx: 0, tz: 0, th: 0, summons: [] };
      enemies.push(boss);
      for (let k = 0; k < 8; k++) { boss.summons.push(enemies.length); const kind = pick(theme.enemies); enemies.push({ id: enemies.length, kind, ai: BASE_AI[kind] || kind, zone: zi, reserve: true, hp: 1 + (VARIANT_HP[kind] || 0), maxHp: 1, x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, dir: -1, state: 0, t: 0, cd: 40, flash: 0, spawned: false, alive: false, stolen: 0, tx: 0, tz: 0, th: 0 }); }
    }
    zones.push({ x0, ids, base, started: false, cleared: false });
    // stuff inside each fight area
    prop(rand() < .5 ? 'crate' : 'trash', x0 + 60 + Math.floor(rand() * 180), rz(), [pick(['coin', 'munchie', 'nug', 'brownie', 'soda', 'coin']), 'coin', 'coin']);
    if (zi === 2) prop('chest', x0 + 150, 20, ['loot']);
    if (zi === 3) prop('crate', x0 + 220, 40, ['gold']);
    // the walk to the next fight: coins, nugs, rings, bonuses
    const gx = x0 + ZW + 10;
    coinArc(gx, rz(), 5);
    item('nug', gx + 60, rz(), 6); nugCount++;
    item('ring', gx + 30, rz(), 12);
    if (zi % 2 === 1) { item('nug', gx + 90, rz(), 6); nugCount++; }
    if (zi === 1 || zi === 3 || zi === 5) item('extra', gx + 40, rz(), 8, ['shatter', 'diamond', 'kief', 'hash'][(zi + n) % 4]);
    deco.push(x0 - 30, x0 + 120, x0 + 260);
  }
  while (nugCount < 7) { item('nug', 320 + nugCount * 300, rz(), 6); nugCount++; }
  const midGap = zones[Math.floor(zoneCount / 2)].x0 + ZW + 90;
  const legend = { x: midGap, z: 8, who: n % LEGENDS.length, met: false };
  const endX = zones[zoneCount - 1].x0 + ZW;
  coinLine(endX + 30, 34, 6); item('ring', endX + 130, 20, 10); item('ring', endX + 150, 44, 10);
  const spot = { x: LEN - 150, w: 60 };

  return {
    n, themeKey, theme, name: missionName(n), items, props, enemies, zones, deco, legend, spot,
    zi: -1, locked: false, spawn: { x: 40, z: 30 }, eshots: [], bodies: [], decals: [], clouds: []
  };
}

// ============================================================
//  SAVE DATA (each player keeps their own stash + gear)
// ============================================================
let SAVE_KEY = 'kq_save_v2_s1';
const SLOT_COUNT = 3;
try { const old = localStorage.getItem('kq_save_v2'); if (old && !localStorage.getItem('kq_save_v2_s1')) localStorage.setItem('kq_save_v2_s1', old); } catch (e) {}
function defaultSave() { return { coins: 0, spots: 0, weapons: ['puff'], armor: [], pouch: false, munchie: 1, preroll: 0, gold: 0, weapon: 'puff', farm: false, throws: { papers: 0, bombs: 0 }, throwSel: 'papers', intro: false, wlv: {}, brownie: 1, soda: 0, quick: 'brownie', met: [], stats: { kills: 0, deaths: 0, playSec: 0, bestCombo: 0, bossesBeaten: 0 }, achv: [] }; }
let save = defaultSave();
function readSlot(i) { try { const s = JSON.parse(localStorage.getItem('kq_save_v2_s' + i)); return s && typeof s === 'object' ? s : null; } catch (e) { return null; } }
function loadSlot(i) {
  SAVE_KEY = 'kq_save_v2_s' + i;
  save = { ...defaultSave(), ...(readSlot(i) || {}) };
  save.throws = { papers: 0, bombs: 0, ...(save.throws || {}) }; save.wlv = save.wlv || {}; save.met = save.met || []; ['brownie', 'soda', 'munchie', 'preroll', 'gold'].forEach(k => save[k] = save[k] || 0); save.stats = { kills: 0, deaths: 0, playSec: 0, bestCombo: 0, bossesBeaten: 0, ...(save.stats || {}) }; save.achv = save.achv || [];
  save.weapons = save.weapons.map(w => w === 'boomer' ? 'dab' : w); if (save.weapon === 'boomer') save.weapon = 'dab';
  if (!Array.isArray(save.skills)) save.skills = BOSSES.slice(0, Math.min(save.spots || 0, BOSSES.length)).map(b => b[2]);
}
loadSlot(1);
function persist() { save.played = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
const maxHp = () => 5 + ARMORS.reduce((m, a) => save.armor.includes(a.id) ? Math.max(m, a.hp) : m, 0) + ['heart1', 'heart2', 'heart3', 'heart4'].filter(k => (save.skills || []).includes(k)).length + (Net.color === 0 ? 1 : 0);
const weaponDef = () => WEAPONS.find(w => w.id === save.weapon) || WEAPONS[0];

// ============================================================
//  WORLD STATE
// ============================================================
let lvl, me, camX = 0, state = 'play', frame = 0, running = false, paused = false, invOpen = false;
let particles = [], popups = [], shots = [], banner = null, shake = 0, hitstop = 0;
let finInfo = null, hurryT = 0, results = null, shopSel = 0, readyInfo = null;
const remotes = new Map();
const isHost = () => Net.online ? Net.hostId === Net.id : !Net.reconnecting;

function makePlayer() {
  return {
    x: lvl.spawn.x + (Net.color || 0) * 10, z: lvl.spawn.z - 12 + (Net.color || 0) * 10, h: 0, vx: 0, vz: 0, vh: 0, face: 1, w: 10,
    puffed: false, flaps: 0, jumpBuf: 0, inv: 60, walkT: 0, sq: 0, star: 0,
    hp: maxHp(), cooked: 0, combo: 0, comboT: 0, best: 0, atkCd: 0, atkT: 0, chain: 0, chainT: 0,
    earned: 0, lost: 0, kills: 0, nugs: 0, buffs: { speed: 0, magnet: 0, power: 0, rage: 0, soda: 0 }, legendT: 0,
    color: Net.color, name: Net.name, emote: null, stealCd: {}
  };
}
function startLevel(n) {
  lvl = buildLevel(n);
  me = makePlayer();
  camX = 0; state = 'brief'; briefT = Net.online ? ([...new Set(lvl.theme.enemies)].some(k => !save.met.includes(k) && k === 'karen') ? 480 : 240) : 1200; particles = []; popups = []; shots = [];
  finInfo = null; hurryT = 0; results = null; readyInfo = null; invOpen = false;
  banner = null;
  if (n === 0 && save.spots === 0) me.tipT = 900;
  persist();
  if (n === LEVELS_PER_WORLD && !save.sawMidpoint) {
    save.sawMidpoint = true; persist();
    showDialogue([
      { name: 'GRANDMA KUSH', text: 'SWEETIES, BUZZKILL CORP JUST MADE AN OFFER ON MY FARM.' },
      { name: 'GRANDMA KUSH', text: "THEY WANT TO PAVE IT INTO A PARKING LOT FOR MR. KILLJOY'S NEW OFFICE." },
      { name: 'GRANDMA KUSH', text: "WE GOTTA BEAT THEM TO IT. KEEP STACKING THOSE HASH COINS." },
    ]);
  }
  if (n === LEVELS_PER_WORLD * (WORLDS.length - 1) && !save.sawKilljoy) {
    save.sawKilljoy = true; persist();
    showDialogue([
      { name: 'MR. KILLJOY', text: "WELL WELL. LOOK WHO MADE IT TO MY TOWER." },
      { name: 'MR. KILLJOY', text: "GRANDMA KUSH'S LITTLE FARM IS ALREADY MINE ON PAPER." },
      { name: 'MR. KILLJOY', text: 'CLIMB ALL YOU WANT. THE PAPERWORK SIGNS ITSELF AT SUNSET.' },
    ]);
  }
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
    const bonus = me.combo * (hasSkill('combo') ? 4 : 2); addCoins(bonus); popup(x, y - 10, 'COMBO BONUS +' + bonus, '#c8ffa0');
  }
}
function addCoins(k) { if (Net.color === 2) k = Math.round(k * 1.15); save.coins += k; me.earned += k; }
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
  if (loot === 'papers' || loot === 'bombs') {
    save.throws[loot] = (save.throws[loot] || 0) + (loot === 'papers' ? 15 : 6); save.throwSel = loot; persist();
    banner = loot === 'papers' ? { t: 260, a: 'FOUND: ROLLING PAPERS x15!', b: 'THROW WITH ' + KL('throw') + ' OR RIGHT-CLICK. GREAT FOR BUZZKILLS WHO KEEP THEIR DISTANCE...' } : { t: 220, a: 'FOUND: NUG BOMBS x6!', b: 'PRESS ' + KL('throwsel') + ' TO SWITCH, ' + KL('throw') + ' TO LOB ONE INTO A CROWD' };
    return;
  }
  const def = [...WEAPONS, ...ARMORS, { id: 'pouch', name: 'STASH POUCH' }].find(i => i.id === loot);
  const owned = save.weapons.includes(loot) || save.armor.includes(loot) || (loot === 'pouch' && save.pouch);
  if (owned) { addCoins(30); banner = { t: 140, a: 'TREASURE CHEST!', b: 'ALREADY HAVE ' + def.name + ' - TOOK 30 COINS' }; }
  else {
    if (WEAPONS.some(w => w.id === loot)) { save.weapons.push(loot); save.weapon = loot; }
    else if (loot === 'pouch') save.pouch = true;
    else { save.armor.push(loot); me.hp = maxHp(); }
    banner = { t: 180, a: 'FOUND: ' + def.name + '!', b: WEAPONS.some(w => w.id === loot) ? 'EQUIPPED - CLICK OR ' + KL('attack') + ' TO SWING, ' + KL('weapon') + ' TO SWITCH' : 'SAVED IN YOUR BAG - OPEN IT WITH ' + KL('bag') + ', QUICK-USE WITH ' + KL('quick') };
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
  else if (ITEMS[it.kind] && !(it.kind === 'munchie' && me.hp < maxHp())) { save[it.kind] = Math.min(MAX_ITEM, (save[it.kind] || 0) + 1); SFX.buy(); popup(x - 16, y - 6, '+1 ' + ITEMS[it.kind].name, '#fff6b0'); persist(); }
  else if (it.kind === 'papers' || it.kind === 'bombs') { const k = it.kind === 'papers' ? 5 : 2; save.throws[it.kind] = (save.throws[it.kind] || 0) + k; SFX.buy(); popup(x - 16, y - 6, '+' + k + (it.kind === 'papers' ? ' PAPERS' : ' NUG BOMBS'), '#fff6b0'); }
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
  SFX.hurt(); puff(me.x, sy(me.z, me.h) - 10, 5, ['#ffffff']); bleed(me.x, me.z, me.h, 5, me.vx > 0 ? 1 : -1);
  if (me.hp <= 0) knockedOut();
}
function knockedOut() {
  if (Net.online && remotes.size > 0 && !me.down) {
    me.down = 480; me.hp = 0; me.vx = me.vz = 0; me.h = 0; me.inv = 999; me.revive = 0; save.stats.deaths++;
    banner = { t: 160, a: 'YOU GOT BEAT UP!', b: 'A HOMIE CAN REVIVE YOU - STAND NEXT TO YOU + HOLD ' + KL('munchie') };
    SFX.hurt(); return;
  }
  if (!Net.online && save.munchie > 0) { // solo: a carried munchie auto-revives instead of losing coins
    save.munchie--; persist(); save.stats.deaths++;
    me.hp = Math.max(1, Math.ceil(maxHp() / 2)); me.inv = 90; me.combo = 0; me.puffed = false;
    banner = { t: 150, a: 'AUTO-MUNCHED!', b: 'A CARRIED MUNCHIE SAVED YOU - BACK UP AT HALF HP' };
    SFX.power(); return;
  }
  return knockedOutFinal();
}
function knockedOutFinal() {
  me.down = 0; save.stats.deaths++;
  const loss = Math.min(save.coins, 40, Math.max(5, Math.floor(save.coins * 0.1)));
  save.coins -= loss; me.lost += loss;
  me.hp = maxHp(); me.x = camX + W / 2; me.z = ZMAX / 2; me.h = 140; me.vx = me.vz = me.vh = 0; me.inv = 150; me.combo = 0; me.puffed = false;
  banner = { t: 140, a: 'YOU GOT BEAT UP!', b: 'DROPPED ' + loss + ' HASH COINS - BACK IN THE FIGHT' };
  SFX.hurt();
}
function emote(i) { me.emote = { e: i, t: 120 }; Net.send({ t: 'emote', e: i }); tone(660, 0.08, 'square', 0.04); tone(880, 0.1, 'square', 0.04, 0.08); }
const ITEMS = {
  munchie: { name: 'MUNCHIES', icon: 'munchie', price: 25, desc: 'HEALS 2 HEARTS. QUICK KEY: E' },
  brownie: { name: 'RAGE BROWNIE', icon: 'brownie', price: 45, desc: '+2 DAMAGE ON EVERY HIT FOR 20 SECONDS' },
  soda: { name: 'ENERGY SODA', icon: 'soda', price: 35, desc: 'RUN + SWING FASTER FOR 20 SECONDS' },
  preroll: { name: 'PRE-ROLL', icon: 'preroll', price: 40, desc: '+40% COOKED RIGHT NOW' },
  gold: { name: 'GOLDEN LEAF', icon: 'gold', price: 75, desc: 'INVINCIBLE FOR 10 SECONDS. SMASH THROUGH ANYTHING' },
};
const MAX_ITEM = 5;
function useItem(id) {
  if (state !== 'play' || !(save[id] > 0)) { SFX.bump(); return; }
  if (id === 'munchie' && me.hp >= maxHp()) { popup(me.x - 14, sy(me.z) - 34, 'ALREADY FULL', '#ff9ab8'); return; }
  save[id]--; persist(); SFX.munch();
  const say = t => popup(me.x - 18, sy(me.z) - 36, t, '#fff6b0');
  if (id === 'munchie') { me.hp = Math.min(maxHp(), me.hp + 2); say('MUNCHIES! +2'); }
  if (id === 'brownie') { me.buffs.rage = 1200; say('RAGE BROWNIE!'); shake = 4; }
  if (id === 'soda') { me.buffs.soda = 1200; me.buffs.speed = Math.max(me.buffs.speed, 1200); say('ENERGY SODA!'); }
  if (id === 'preroll') { addCooked(40); say('PRE-ROLL +40%'); }
  if (id === 'gold') { me.star = 600; SFX.star(); say('GOLDEN LEAF!'); }
}
function useMunchies() {
  useItem('munchie');
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
const REACH = {}; for (const w of WEAPONS) REACH[w.id] = w.reach;
// my hit landed on an enemy: the host applies it, everyone else asks the host
// ---- smoke powers ----
function hitAToke() {
  if (!hasSkill('toke')) { popup(me.x - 26, sy(me.z) - 34, 'A MEGA BOSS TEACHES THIS', '#ff8a8a'); return; }
  if (hasSkill('ultimate') && me.cooked >= 100) return ultimateHigh();
  if (me.cooked < 20) { popup(me.x - 24, sy(me.z) - 34, 'NEED 20% COOKED', '#ff8a8a'); SFX.bump(); return; }
  me.cooked -= 20;
  const c = { x: me.x, z: me.z, r: hasSkill('hotbox') ? 70 : 50, t: 360, heal: hasSkill('puffpass'), hot: hasSkill('hotbox'), by: Net.id };
  lvl.clouds.push(c); SFX.exhale(); shake = 4;
  Net.send({ t: 'fx', k: 9, x: Math.round(c.x), y: Math.round(c.z), f: (c.heal ? 1 : 0) | (c.hot ? 2 : 0), h: c.r });
  if (hasSkill('bongrip')) for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - c.x) < c.r && Math.abs(e.z - c.z) < c.r * 0.6) hitEnemy(e, 2, Math.sign(e.x - c.x) || 1, true, { stun: 70 });
}
function breathFire() {
  for (let i = 0; i < 6; i++) particles.push({ x: me.x + me.face * (12 + i * 6), y: sy(me.z, me.h) - 14 + (Math.random() - .5) * 8, vx: me.face * (1.5 + Math.random()), vy: -0.3, life: 16, col: ['#ff5a6a', '#ff9a3a', '#ffd84a'][i % 3], s: 3, g: -0.02 });
  if (frame % 10 === 0) for (const e of lvl.enemies) { const dx = (e.x - me.x) * me.face; if (e.spawned && e.alive && e.state !== 5 && dx > 0 && dx < 64 && Math.abs(e.z - me.z) < 14) hitEnemy(e, 1, me.face, false, { burn: 3 }); }
}
function ultimateHigh() {
  me.cooked = 50; shake = 16; hitstop = 10; SFX.star(); SFX.flag();
  particles.push({ x: me.x, y: sy(me.z) - 20, vx: 0, vy: 0, life: 9, col: '#fff', s: 1, g: 0, burst: 40 });
  for (let i = 0; i < 60; i++) puff(camX + Math.random() * W, FLOOR_Y + Math.random() * ZMAX, 1, ['#c070ff', '#c8ffa0', '#ffd84a', '#ffffff'], 2);
  banner = { t: 90, a: 'THE ULTIMATE HIGH!!', b: '' };
  for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && e.x > camX - 10 && e.x < camX + W + 10) hitEnemy(e, 12, Math.sign(e.x - me.x) || 1, true, { burn: 3, stun: 60 });
}
function learnSkill(id) {
  if (!id || hasSkill(id)) return;
  save.skills = [...(save.skills || []), id];
  if (id === 'throw') { save.throws.papers = (save.throws.papers || 0) + 10; save.throwSel = 'papers'; }
  persist(); me.hp = maxHp();
  skillPop = { id, t: 420 }; banner = null; SFX.power(); setTimeout(() => SFX.star(), 300);
}
let skillPop = null;
function bossIntro(e) {
  if (!e || e.introduced) return; e.introduced = true;
  banner = { t: 220, a: e.bname, b: '"' + e.quote + '"' }; shake = 10; SFX.karen(); lvl.boss = e;
}
// ---- impact juice: cartoon blood, hit sparks, POW text, bodies that stay down ----
const POWS = ['POW!', 'WHAM!', 'BONK!', 'SMACK!', 'CRACK!', 'OOF!'];
function bleed(x, z, h, n, dir = 0) {
  if (!settings.blood) { puff(x, sy(z, h) - 10, Math.ceil(n / 2), ['#ffffff', '#c8ffa0'], 1); return; }
  for (let i = 0; i < n; i++) particles.push({ x: x + (Math.random() - .5) * 6, y: sy(z, h) - 10 - Math.random() * 6, vx: dir * (0.6 + Math.random() * 1.6) + (Math.random() - .5), vy: -1 - Math.random() * 1.8, life: 22 + Math.random() * 14, col: Math.random() < .7 ? '#d82040' : '#a01830', s: 1 + Math.floor(Math.random() * 2), g: 0.16, drip: z });
  if (lvl.decals.length > 90) lvl.decals.shift();
  if (Math.random() < 0.6) lvl.decals.push({ x: x + dir * (4 + Math.random() * 10), z: z + (Math.random() - .5) * 4, r: 2 + Math.random() * 3 });
}
function impact(x, z, h, strong) {
  particles.push({ x, y: sy(z, h) - 12, vx: 0, vy: 0, life: strong ? 7 : 5, col: '#ffffff', s: 1, g: 0, burst: strong ? 9 : 6 });
  if (strong && Math.random() < 0.45) popup(x - 10, sy(z, h) - 30, POWS[Math.floor(Math.random() * POWS.length)], ['#ffd84a', '#ffffff', '#ff9ab8'][Math.floor(Math.random() * 3)]);
}
function layBody(e) {
  if (e.skipped || e.gone || e.bodied) return;
  e.bodied = true;
  if (lvl.bodies.length > 45) lvl.bodies.shift();
  lvl.bodies.push({ kind: e.kind, x: e.x, z: e.z, dir: e.dir || 1 });
  if (lvl.decals.length > 90) lvl.decals.shift();
  if (settings.blood) lvl.decals.push({ x: e.x, z: e.z + 1, r: e.ai === 'mouse' ? 3 : 6, pool: true });
  puff(e.x, sy(e.z) - 2, 5, ['#e8e0d0', '#ffffff'], .8);
}
function hitEnemy(e, dmg, dir, strong, fx = {}) {
  if (!e.alive || e.state === 5) return;
  e.flash = 8; hitstop = strong ? 5 : 3; shake = Math.max(shake, strong ? 5 : 3);
  puff(e.x, sy(e.z, e.h) - 12, 4, ['#ffffff', '#fff6b0'], 1.2);
  bleed(e.x, e.z, e.h, strong ? 7 : 4, dir); impact(e.x - dir * 4, e.z, e.h, strong);
  SFX.hit();
  if (fx.burn) puff(e.x, sy(e.z, e.h) - 10, 4, ['#ff9a3a', '#ffd84a', '#ff5a6a'], .8, -0.03);
  if (isHost()) damageEnemy(e, dmg, dir, strong, Net.id, fx);
  else Net.send({ t: 'hit', i: e.id, d: dmg, dir, s: strong ? 1 : 0, l: lvl.n, b: fx.burn || 0, sp: fx.sp || 0, st: fx.stun || 0, bl: fx.bleed || 0, kb: fx.kb || 1, hr: fx.hr || 0 });
}
function damageEnemy(e, dmg, dir, strong, by, fx = {}) { // host only
  if (!e.alive || e.state === 5) return;
  let teamBonus = 0;
  if (by && e.lastHitBy && e.lastHitBy !== by && frame - (e.lastHitT || -999) < 30) { teamBonus = Math.max(1, Math.ceil(dmg * 0.5)); popup(e.x - 22, sy(e.z) - 30, 'TEAM UP!', '#ffd84a'); SFX.power(); }
  e.lastHitBy = by; e.lastHitT = frame;
  e.hp -= dmg + teamBonus; e.flash = 8;
  if (fx.burn) { e.burn = Math.max(e.burn || 0, fx.burn); e.burnBy = by; e.burnT = e.burnT || 36; e.spread = e.spread || fx.sp; }
  if (fx.bleed) { e.bleedN = Math.max(e.bleedN || 0, fx.bleed); e.bleedBy = by; e.bleedT = e.bleedT || 44; }
  // HOTBOX: burning + stunned at once detonates a smoke burst that hits everything nearby
  if ((e.burn > 0 || fx.burn) && (e.stunned > 0 || fx.stun) && !(e.hotboxCd > 0)) { e.hotboxCd = 90; hotboxBlast(e, by); }
  if (e.hotboxCd > 0) e.hotboxCd--;
  if (e.hp <= 0) {
    e.state = 5; e.t = 50; e.vx = dir * 2.6; e.vh = 3;
    Net.send({ t: 'kill', i: e.id, by, st: e.stolen, l: lvl.n });
    onKill(e, by);
  } else {
    const kb = (fx.kb || 1) * (e.boss ? 0.25 : 1);
    if (e.boss) { if (!(e.state === 1 || e.state === 2) || fx.stun) { e.state = 4; e.t = fx.stun ? 30 : 8; } e.vx = dir * kb; if (fx.hr) fx = { ...fx, hr: 0 }; return; }
    e.state = 4; e.t = Math.max(strong ? 30 : 20, fx.stun || 0); e.stunned = fx.stun ? e.t : 0; e.vx = dir * (strong ? 3 : 1.4) * kb; if (strong) e.vh = 2.2;
    if (fx.hr) { e.vh = 4; e.vx = dir * 5; e.flying = { by, dir }; }
  }
}
function hotboxBlast(center, by) {
  shake = Math.max(shake, 8); hitstop = Math.max(hitstop, 6); SFX.stomp();
  puff(center.x, sy(center.z) - 10, 16, ['#ffd84a', '#ff9a3a', '#ffffff', '#c8ffa0'], 2, -0.02);
  popup(center.x - 20, sy(center.z) - 30, 'HOTBOX!', '#ffd84a');
  for (const e2 of lvl.enemies) {
    if (e2 === center || !e2.alive || e2.state === 5 || !e2.spawned) continue;
    if (Math.abs(e2.x - center.x) > 40 || Math.abs(e2.z - center.z) > 30) continue;
    damageEnemy(e2, 3, Math.sign(e2.x - center.x) || 1, true, by, {});
  }
}
let crewCombo = 0, crewComboT = 0;
function onKill(e, by) { // everyone: death effect; the one who landed it gets the goods
  e.state = 5; e.t = Math.max(e.t, 40);
  if (Net.online) { crewCombo++; crewComboT = 150; if (crewCombo > 0 && crewCombo % 10 === 0) { addCoins(5); popup(e.x - 24, sy(e.z) - 40, 'CREW COMBO x' + crewCombo + '! +5', '#ffd84a'); } }
  if (e.boss) { save.stats.bossesBeaten++; e.t = 90; hitstop = 20; shake = 16; for (const id of e.summons || []) { const a = lvl.enemies[id]; if (a.alive && a.spawned) { a.alive = false; puff(a.x, sy(a.z) - 8, 8, ['#ffffff'], 1); } } banner = { t: 160, a: e.bname + ' DEFEATED!', b: '' }; setTimeout(() => learnSkill(e.skill), 1600); lvl.boss = null; }
  puff(e.x, sy(e.z) - 10, 8, ['#ffffff', '#e8e4f4', '#c8ffa0'], 1.4); bleed(e.x, e.z, e.h, 8, e.vx > 0 ? 1 : -1);
  const zn = lvl.zones[lvl.zi];
  if (zn && lvl.locked && zn.ids.every(i => { const o = lvl.enemies[i]; return o === e || !o.alive || o.state === 5 || !o.spawned && o.skipped; }) && zn.ids.filter(i => !lvl.enemies[i].spawned && lvl.enemies[i].alive).length === 0) { hitstop = 14; shake = 10; }
  if (by !== Net.id) return;
  const reward = (e.boss ? (e.mega ? 150 : 60) : { cop: 8, karen: 6, mouse: 2, squirrel: 3 }[e.ai]) + e.stolen;
  addCoins(reward); addCooked(3); me.kills++; addCombo(e.x, sy(e.z) - 30); SFX.stomp();
  popup(e.x - 14, sy(e.z) - 34, { cop: 'COP DOWN!', karen: 'KAREN DENIED!', mouse: 'SQUEAK!', squirrel: 'NUTS!' }[e.ai] + ' +' + reward, '#ffffff');
  e.stolen = 0;
}
function attack(charged) {
  if ((me.atkCd > 0 && !charged) || state !== 'play' || me.roll > 0) return;
  const w = weaponDef(), wi = WEAPONS.indexOf(w);
  if (me.puffed) { // exhale a smoke blast from the cloud
    me.puffed = false; me.flaps = 0; SFX.exhale(); me.atkCd = 16; me.atkT = 10;
    shots.push({ mine: true, x: me.x + me.face * 10, z: me.z, h: me.h + 8, vx: me.face * 3.6, life: 26, dmg: 2, kind: 5, hit: new Set() });
    Net.send({ t: 'fx', k: 5, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
    return;
  }
  const lunge = K.run && Math.abs(me.vx) > 1.5 && me.h === 0, air = me.h > 6;
  if (air && me.vh < 0.5 && hasSkill('pound') && !charged) { me.pound = true; me.vh = -5; me.slash = { t: 12, max: 12, heavy: true, kind: w.id, air: true }; SFX.flap(); return; }
  me.chain = lunge || air || charged ? 2 : me.chainT > 0 ? (me.chain + 1) % 3 : 0;
  const strong = me.chain === 2;
  if (charged) { shake = 8; popup(me.x - 18, sy(me.z) - 40, 'CHARGED!', '#ffd84a'); SFX.power(); }
  if (lunge) { me.vx = me.face * 4.5; me.inv = Math.max(me.inv, 10); }
  me.slash = { t: 12, max: 12, heavy: strong, kind: w.id, air, lunge };
  { // aim assist: step into the nearest enemy's lane
    let best = null, bd = 1e9;
    for (const e of lvl.enemies) { if (!e.spawned || !e.alive || e.state === 5) continue; const dx = (e.x - me.x) * me.face; if (dx > -8 && dx < (REACH[w.id] || 30) + 16 && Math.abs(e.z - me.z) < 26) { const d = Math.abs(dx) + Math.abs(e.z - me.z) * 2; if (d < bd) { bd = d; best = e; } } }
    if (best) me.z += Math.max(-8, Math.min(8, best.z - me.z));
  }
  me.atkCd = Math.round(w.cd * (strong ? 1.3 : 0.75) * (me.buffs.soda > 0 ? 0.6 : 1)); me.atkT = 12; me.chainT = me.atkCd + 16;
  SFX.attack(Math.min(wi, 4));
  const lv = wlv(w.id);
  let dmg = w.dmg + (lv - 1) + (ultra() ? (hasSkill('rage') ? 3 : 1) : 0) + (me.buffs.power > 0 ? 1 : 0) + (me.buffs.rage > 0 ? 2 : 0) + (strong ? 1 : 0);
  if (charged) dmg = dmg * 2 + 2;
  const reach = w.reach + (charged ? 12 : 0);
  const baseBurn = w.id === 'puff' ? (hasSkill('cherry') ? w.burn : 0) : (w.burn || 0);
  const fx = { burn: Math.max(baseBurn ? baseBurn + (lv - 1) : 0, hasSkill('embers') ? 1 : 0), sp: w.spread ? 1 : 0, stun: w.stun ? w.stun + (lv - 1) * 15 : 0, bleed: w.bleed ? w.bleed + (lv - 1) : 0, kb: (w.kb || 1) * (strong ? 1.3 : 1) * (charged ? 1.8 : 1), hr: (w.homer || hasSkill('finisher') || charged) && strong ? 1 : 0 };
  let hits = 0;
  const targets = lvl.enemies.filter(e => e.spawned && e.alive && e.state !== 5).map(e => ({ e, dx: e.x - me.x, dz: Math.abs(e.z - me.z) }))
    .filter(t => { const r = reach + (t.e.boss ? 14 : 0); return (w.spin || air ? Math.abs(t.dx) < r : t.dx * me.face > -6 && Math.abs(t.dx) < r) && t.dz < w.zr + (air ? 6 : 0) + (t.e.boss ? 10 : 0) && Math.abs(t.e.h - me.h) < 30; })
    .sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx));
  for (const t of (w.pierce || w.spin || w.id === 'lighter' || w.id === 'bong' || w.homer) ? targets : targets.slice(0, 2)) {
    let d = dmg; const crit = Math.random() < (w.crit || 0) + (hasSkill('crit') ? 0.15 : 0);
    if (crit) { d *= 2; popup(t.e.x - 10, sy(t.e.z) - 30, 'CRIT!', '#9ae8ff'); }
    hitEnemy(t.e, d, Math.sign(t.dx) || me.face, strong || crit, fx); hits++;
  }
  if (w.id === 'grinder' && hits) for (const t of targets) t.e.x += Math.sign(me.x - t.e.x) * 4; // pulls them in
  for (const p of lvl.props) {
    if (p.broken) continue;
    const dx = p.x - me.x;
    if ((w.id === 'grinder' ? Math.abs(dx) < reach : dx * me.face > -6 && Math.abs(dx) < reach) && Math.abs(p.z - me.z) < 12) {
      p.hp--; p.flash = 6; SFX.bump(); if (p.hp <= 0) breakProp(p);
    }
  }
  if (w.id === 'bong' && strong) { shake = 6; puff(me.x + me.face * 22, sy(me.z) - 2, 12, ['#bfe8ff', '#ffffff', '#7fe07a'], 1.6); }
  if (w.id === 'blunt' && strong && hits) popup(me.x + me.face * 20, sy(me.z) - 40, 'HOME RUN!', '#ffd84a');
  if (w.id === 'lighter') for (let i = 0; i < 8; i++) particles.push({ x: me.x + me.face * (10 + i * 3), y: sy(me.z, me.h) - 12 + (Math.random() - .5) * 8, vx: me.face * (1 + Math.random()), vy: -0.3, life: 14, col: ['#ff5a6a', '#ff9a3a', '#ffd84a'][i % 3], s: 3, g: -0.02 });
  if (w.id === 'puff') puff(me.x + me.face * 26, sy(me.z, me.h) - 16, 5, ['#ffffff', '#e8e4f4'], .6, -0.02);
  Net.send({ t: 'fx', k: wi, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
}
function updateShots() {
  for (const s of shots) {
    s.x += s.vx; s.life--; if (s.kind === 5) s.vx *= 0.95;
    if (s.kind === 8) { s.vh -= 0.18; s.h += s.vh; if (s.h <= 0) { s.life = 0; explode(s); } continue; }
    if (!s.mine) continue;
    for (const e of lvl.enemies) {
      if (!e.spawned || !e.alive || e.state === 5 || s.hit.has(e)) continue;
      if (Math.abs(e.x - s.x) < 12 && Math.abs(e.z - s.z) < 14) {
        s.hit.add(e); hitEnemy(e, s.dmg + (ultra() ? 1 : 0), Math.sign(s.vx), s.kind === 5);
        if (s.kind === 7 && --s.pierce > 0) continue;
        s.life = 0;
      }
    }
    if (s.kind === 7) for (const p of lvl.props) if (!p.broken && Math.abs(p.x - s.x) < 10 && Math.abs(p.z - s.z) < 10) { p.hp--; p.flash = 6; if (p.hp <= 0) breakProp(p); s.life = 0; }
  }
  shots = shots.filter(s => s.life > 0);
  // purses thrown by Karens (simulated on every screen, each player checks themselves)
  for (const s of lvl.eshots) {
    s.x += s.vx; s.life--; s.spin++;
    if (state === 'play' && Math.abs(s.x - me.x) < 10 && Math.abs(s.z - me.z) < 8 && me.h < 7) { s.life = 0; hurt(1, 8, s.x); }
    for (const p of shots) if (p.mine && Math.abs(p.x - s.x) < 10 && Math.abs(p.z - s.z) < 10) { s.life = 0; puff(s.x, sy(s.z, 14), 5, ['#ff7ac8', '#ffffff']); }
  }
  lvl.eshots = lvl.eshots.filter(s => s.life > 0);
}

// ============================================================
//  UPDATE
// ============================================================
function update() {
  if (paused && !menu) return;
  frame++;
  if (frame % 600 === 0 && running) { save.stats.playSec += 10; }
  if (banner && --banner.t <= 0) banner = null;
  if (crewComboT > 0 && --crewComboT <= 0) crewCombo = 0;
  const clearIn = () => { K.jumpPressed = K.enterPressed = K.attackPressed = K.throwPressed = false; K.nav = nextNav(); K.escPressed = false; if (state !== 'results') K.upPressed = K.downPressed = false; };
  if (updateTrans()) { clearIn(); return; }
  if (dialog) { updateDialogue(); clearIn(); return; }
  if (menu) { updateMenu(); clearIn(); if (!Net.online || !menu) return; }
  if (state === 'story') { updateStory(); clearIn(); return; }
  if (state === 'lobby') { updateLobby(); clearIn(); return; }
  if (state === 'map') { if (invOpen) updateInventory(); else updateMap(); clearIn(); return; }
  if (state === 'brief') {
    if (--briefT <= 0 || (!Net.online && (K.jumpPressed || K.enterPressed || K.attackPressed))) { state = 'play'; banner = null; for (const k of new Set(lvl.theme.enemies)) if (!save.met.includes(k)) save.met.push(k); persist(); }
    clearIn(); return;
  }
  if (invOpen) { updateInventory(); if (!Net.online) { clearIn(); return; } }
  if (hitstop > 0) { hitstop--; return; }

  if (state === 'play' && !invOpen) updatePlayer();
  else if (state === 'sitting') {
    me.vx = me.vz = 0;
    if (frame % 8 === 0) puff(lvl.spot.x + 40, sy(-2) - 14, 1, ['#ffffff', '#e8e4f4', '#d4c8f8'], .3, -0.03);
    if (!Net.online && !Net.reconnecting && finInfo && --finInfo.t <= 0 && !trans) go(toResults, true);
    if (Net.online && (K.enterPressed || K.jumpPressed) && !finInfo.hurried) { Net.send({ t: 'hurry' }); finInfo.hurried = true; }
  } else if (state === 'results') updateShop();
  if (hurryT > 0 && --hurryT === 0) Net.send({ t: 'timeup' });
  K.jumpPressed = false; K.enterPressed = false; K.attackPressed = false; K.throwPressed = false; K.nav = nextNav(); K.escPressed = false;
  if (state !== 'results') K.upPressed = K.downPressed = false;
  if (!settings.shake || settings.reduceFlash) shake = 0;
  for (const c of chatLog) if (c.t > 0) c.t--;
  if (me.say && --me.say.t <= 0) me.say = null;
  for (const r of remotes.values()) if (r.say && --r.say.t <= 0) r.say = null;
  if (me.tipT > 0 && state === 'play' && !banner) me.tipT--;
  if (me.tipT > 0 && lvl.zones[0] && lvl.zones[0].cleared) me.tipT = 0;
  if (me.emote && --me.emote.t <= 0) me.emote = null;

  if (isHost()) hostUpdate(); else clientEnemies();
  updateShots();
  for (const e of lvl.enemies) {
    if (e.flash > 0) e.flash--;
    if (!e.spawned || !e.alive || e.state === 5) continue;
    const f = isHost() ? (e.burn > 0 ? 1 : 0) | (e.bleedN > 0 ? 2 : 0) | (e.stunned ? 4 : 0) : e.fxf || 0;
    if (f & 1 && frame % 3 === 0) particles.push({ x: e.x + (Math.random() - .5) * 10, y: sy(e.z, e.h) - 6 - Math.random() * 12, vx: 0, vy: -0.7, life: 16, col: ['#ff5a6a', '#ff9a3a', '#ffd84a'][frame % 3], s: 2, g: -0.02 });
    if (f & 2 && frame % 10 === 0) bleed(e.x, e.z, e.h, 1, 0);
    e.dazed = f & 4; if (!isHost()) { e.conf = f & 8; e.dash = !!(f & 16); }
  }

  for (const r of remotes.values()) {
    if (r.tx < -500) continue;
    if (Math.abs(r.tx - r.x) > 100) { r.x = r.tx; r.z = r.tz; r.h = r.th; }
    r.x += (r.tx - r.x) * 0.35; r.z += (r.tz - r.z) * 0.35; r.h += (r.th - r.h) * 0.35;
    if (r.emote && --r.emote.t <= 0) r.emote = null;
    if (r.atkT > 0) r.atkT--;
    if (r.slash && r.slash.t > 0) r.slash.t--;
  }
  // items that pop out of crates settle onto the ground
  for (const it of lvl.items) if (it.vh !== undefined && (it.h > 0 || it.vh > 0)) { it.vh -= 0.2; it.h = Math.max(0, it.h + it.vh); if (it.h === 0) it.vh = 0; }
  if (lvl.pendingTaken) { lvl.pendingTaken = lvl.pendingTaken.filter(id => { const it = lvl.items.find(i => i.id === id); if (it) { it.taken = true; return false; } return true; }); }
  for (const p of lvl.props) if (p.flash > 0) p.flash--;
  lvl.clouds = lvl.clouds.filter(c => --c.t > 0);
  if (skillPop && --skillPop.t <= 0) skillPop = null;
  particles = particles.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += p.g; return --p.life > 0; });
  popups = popups.filter(p => { p.y -= 0.4; return --p.t > 0; });

  // camera: follow me, but stay put while a fight area is locked
  const z = lvl.zones[lvl.zi];
  let target = me.x - W * 0.4;
  if (lvl.locked && z) target = z.x0 + (ZW - W) / 2;
  camX += (target - camX) * (lvl.locked ? 0.045 : 0.1);
  camX = Math.max(0, Math.min(camX, LEN - W));
  if (lvl.locked && z) camX = Math.max(z.x0 + (ZW - W) / 2 - 40, Math.min(camX, z.x0 + 40));

  if (Net.online && frame % 3 === 0 && (state === 'play' || state === 'sitting')) {
    Net.send({ t: 's', x: Math.round(me.x), y: Math.round(me.z), h: Math.round(me.h), l: lvl.n, a: animFrame(me), f: me.face, b: (me.star > 0 ? 1 : 0) | (ultra() ? 2 : 0) | (state === 'sitting' ? 4 : 0) | (me.down > 0 ? 8 : 0), w: WEAPONS.indexOf(weaponDef()), c: Math.round(me.cooked), hp: me.hp, mh: maxHp() });
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
  if (me.down > 0) { // waiting for a revive
    me.vx = me.vz = 0; me.atkT = 0;
    if (--me.down <= 0) { me.inv = 0; knockedOutFinal(); }
    return;
  }
  // reviving a downed homie: hold E next to them
  let nearDown = false;
  if (K.use) for (const [id, r] of remotes) if (r.b & 8 && Math.abs(r.x - me.x) < 18 && Math.abs(r.z - me.z) < 12) {
    nearDown = true;
    me.reviveT = (me.reviveT || 0) + 1;
    if (me.reviveT % 10 === 0) puff(r.x, sy(r.z) - 8, 3, ['#c8ffa0', '#ffffff'], .6, -0.03);
    if (me.reviveT >= 70) { me.reviveT = 0; Net.send({ t: 'rev', who: id }); addCooked(10); popup(me.x - 20, sy(me.z) - 36, 'PASSED IT! REVIVED', '#c8ffa0'); SFX.power(); }
    break;
  }
  if (!K.use) me.reviveT = 0;
  // PUFF PUFF PASS: hold E next to an upright homie to share 20% Cooked (10s cooldown)
  me.passCd = me.passCd || 0; if (me.passCd > 0) me.passCd--;
  if (K.use && !nearDown && me.passCd <= 0) {
    let passed = false;
    for (const [id, r] of remotes) if (!(r.b & 8) && Math.abs(r.x - me.x) < 18 && Math.abs(r.z - me.z) < 12) {
      me.passT = (me.passT || 0) + 1;
      if (me.passT % 10 === 0) puff((me.x + r.x) / 2, sy(me.z) - 8, 3, ['#c8ffa0', '#ffffff', '#e4b3ff'], .8, -0.03);
      if (me.passT >= 40) { me.passT = 0; me.passCd = 600; addCooked(20); Net.send({ t: 'pass', who: id }); popup(me.x - 24, sy(me.z) - 36, 'PUFF PUFF PASS!', '#e4b3ff'); SFX.power(); }
      passed = true; break;
    }
    if (!passed) me.passT = 0;
  } else me.passT = 0;
  const p = me, spd = (p.buffs.speed > 0 ? 1.45 : 1) * (hasSkill('sprint') ? 1.2 : 1);
  const mx = (K.run ? 2.1 : 1.3) * spd * (Net.color === 1 ? 1.1 : 1), mz = (K.run ? 1.3 : 0.9) * spd * (Net.color === 1 ? 1.1 : 1);
  let ix = (K.right ? 1 : 0) - (K.left ? 1 : 0), iz = (K.down ? 1 : 0) - (K.up ? 1 : 0);
  if (p.atkT > 6 && p.h === 0) { ix = 0; iz = 0; } // plant your feet while swinging
  if (ix) p.face = ix;
  if (mouseG && !chatOpen && p.atkT <= 6) { const sx = p.x - camX; if (Math.abs(mouseG.x - sx) > 3) p.face = mouseG.x > sx ? 1 : -1; } // aim with the mouse; WASD still moves
  if (p.roll > 0) { p.roll--; if (hasSkill('rollsmoke') && frame % 3 === 0) { puff(p.x, sy(p.z) - 6, 3, ['#ffffff', '#c8ffa0'], .6); for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - p.x) < 14 && Math.abs(e.z - p.z) < 10 && !(e.rollHit > frame)) { e.rollHit = frame + 30; hitEnemy(e, 1, Math.sign(e.x - p.x) || 1, false, { burn: 1 }); } } }
  else if (p.inv > 55) { /* knockback */ } else { p.vx += (ix * mx - p.vx) * 0.3; p.vz += (iz * mz - p.vz) * 0.3; }
  if (p.puffed) { p.vx *= 0.9; p.vz *= 0.9; }

  if (K.jumpPressed) p.jumpBuf = 6; else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.jumpBuf > 0 && K.run && hasSkill('roll') && p.h === 0 && !(p.roll > 0) && (ix || iz)) {
    p.roll = 20; p.jumpBuf = 0; p.vx = (ix || p.face) * 4.2; p.vz = iz * 2.4; p.inv = Math.max(p.inv, 22); SFX.flap(); puff(p.x, sy(p.z) - 4, 5, ['#ffffff', '#e8e0d0'], .8);
  } else if (p.jumpBuf > 0) {
    if (p.h === 0) { p.vh = 3.4; p.jumpBuf = 0; p.sq = 6; SFX.jump(); }
  }
  if (p.h > 0 || p.vh > 0) {
    p.vh -= 0.24;
    if (p.puffed) p.vh = Math.max(p.vh, -0.8);
    p.h += p.vh;
    if (p.h <= 0) { p.h = 0; p.vh = 0; p.puffed = false; p.flaps = 0; p.sq = 5; puff(p.x, sy(p.z), 3, ['#ffffff', '#f0e8ff'], .5);
      if (p.pound) { p.pound = false; shake = 10; SFX.stomp(); puff(p.x, sy(p.z), 24, ['#ffffff', '#e8e0d0', '#c8ffa0'], 2.4);
        for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - p.x) < 44 && Math.abs(e.z - p.z) < 18) hitEnemy(e, 3 + wlv(weaponDef().id) - 1, Math.sign(e.x - p.x) || 1, true, { stun: 60 }); } }
  }
  p.x += p.vx; p.z += p.vz;
  p.z = Math.max(0, Math.min(ZMAX, p.z));
  const zn = lvl.zones[lvl.zi];
  const left = lvl.locked && zn ? zn.x0 + 8 : Math.max(8, camX - 40), right = lvl.locked && zn ? zn.x0 + ZW - 8 : LEN - 8;
  p.x = Math.max(left, Math.min(right, p.x));
  if (!lvl.locked) { // can't run past the next fight until it's started
    const next = lvl.zones.find(z => !z.cleared);
    if (next && next.started && p.x > next.x0 + ZW - 8) p.x = next.x0 + ZW - 8;
  }

  if (K.attackPressed) attack();
  else if (settings.holdAttack && K.attack && !hasSkill('charge') && p.atkCd <= 0) attack();
  if (K.attack && hasSkill('charge')) { p.holdT = (p.holdT || 0) + 1; if (p.holdT > 30 && frame % 4 === 0) puff(p.x + p.face * 10, sy(p.z, p.h) - 14, 2, ['#ffd84a', '#ffffff'], .5, -0.03); }
  else { if (p.holdT > 30) attack(true); p.holdT = 0; }
  if (K.toke) { p.tokeT = (p.tokeT || 0) + 1; if (p.tokeT > 25 && hasSkill('breath') && p.cooked > 1) { p.cooked -= 0.3; if (frame % 5 === 0) breathFire(); } }
  else { if (p.tokeT > 0 && p.tokeT <= 25) hitAToke(); p.tokeT = 0; }
  if (hasSkill('regen') && p.cooked >= 50 && frame % 480 === 0 && p.hp < maxHp()) { p.hp++; popup(p.x - 8, sy(p.z) - 34, '+1 HEART', '#ff9ab8'); }
  if (hasSkill('magnet')) for (const it of lvl.items) if (!it.taken && it.kind === 'coin') { const dx = p.x - it.x, dz = p.z - it.z, d = Math.hypot(dx, dz); if (d < 56 && d > 1) { it.x += dx / d * 2; it.z += dz / d * 2; } }
  for (const c of lvl.clouds) if (c.heal && Math.abs(c.x - p.x) < c.r && Math.abs(c.z - p.z) < c.r * 0.5 && frame % 120 === 0 && p.hp < maxHp()) { p.hp++; popup(p.x - 8, sy(p.z) - 34, 'PUFF PUFF +1', '#c8ffa0'); }
  if (p.atkCd > 0) p.atkCd--;
  if (p.throwCd > 0) p.throwCd--;
  if (p.slash && p.slash.t > 0) p.slash.t--;
  if (K.throwPressed) throwItem();
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
    if (Math.abs(it.x - p.x) < 12 && Math.abs(it.z - p.z) < 12 && Math.abs((it.h || 0) - p.h) < 22) pickUp(it);
  }
  // thieves
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive || (e.ai !== 'mouse' && e.ai !== 'squirrel') || e.state !== 0) continue;
    if (Math.abs(e.x - p.x) < 10 && Math.abs(e.z - p.z) < 7 && p.h < 10 && !(p.stealCd[e.id] > frame)) {
      p.stealCd[e.id] = frame + 120;
      const k = save.pouch ? 0 : Math.min(save.coins, e.ai === 'mouse' ? 5 : 8);
      if (save.pouch) popup(e.x - 16, sy(e.z) - 24, 'POUCH LOCKED!', '#ffd84a');
      else if (k) { save.coins -= k; p.lost += k; popup(p.x - 16, sy(p.z) - 36, '-' + k + ' STOLEN!', '#ff8a8a'); SFX.steal(); }
      else if (!(p.nothingT > frame)) { p.nothingT = frame + 180; popup(p.x - 16, sy(p.z) - 36, 'NOTHING TO STEAL LOL', '#ff8a8a'); }
      if (isHost()) thiefFlee(e, k); else Net.send({ t: 'steal', i: e.id, k, l: lvl.n });
    }
  }
  // enemy attacks that reach me
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive || e.state !== 2 || (e.ai !== 'cop' && !e.boss)) continue;
    if (e.hitMe === e.strikeN) continue;
    const dx = p.x - e.x;
    if (e.boss) { if ((e.dash ? Math.abs(dx) < 22 : dx * e.dir > -6 && Math.abs(dx) < 44) && Math.abs(e.z - p.z) < 14 && p.h < 20) { e.hitMe = e.strikeN; hurt(e.mega ? 2 : 1, 5, e.x); } continue; }
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
  save.stats.kills += me.kills; save.stats.bestCombo = Math.max(save.stats.bestCombo, me.best);
  persist();
  results = { made, earned: me.earned, lost: me.lost, spotBonus, ultraBonus, cooked: Math.round(me.cooked), kills: me.kills, best: me.best, nugs: me.nugs };
  state = 'results'; shopSel = 0; hurryT = 0; banner = null;
}

// ============================================================
//  ENEMY AI (runs on the host's screen, synced to the crew)
// ============================================================
function playersList() {
  const list = [{ id: Net.id, x: me.x, z: me.z, h: me.h, ok: state === 'play' && me.inv < 60 && !(me.down > 0) }];
  for (const [id, r] of remotes) if (r.l === lvl.n && r.tx > -500 && !(r.b & 12)) list.push({ id, x: r.x, z: r.z, h: r.h, ok: true });
  return list;
}
function bossAI(e, tgt, dx, dz, cloud) {
  const rage = e.hp < e.maxHp / 2, spd = (rage ? 1.3 : 1) * (cloud ? 0.5 : 1);
  if (rage && !e.raged) { e.raged = true; banner = { t: 100, a: e.bname + ' IS MAD!', b: '' }; shake = 8; }
  if ((e.sumT = (e.sumT == null ? 240 : e.sumT) - 1) <= 0) { e.sumT = e.mega ? (rage ? 300 : 420) : 560; summonAdds(e, e.mega ? 3 : 2); }
  if (e.state === 1) { if (--e.t <= 0) { e.state = 2; e.t = e.dash ? 38 : 10; e.strikeN = (e.strikeN || 0) + 1; SFX.hit(); } return [0, 0]; }
  if (e.state === 2) {
    if (e.dash) { if (--e.t <= 0) { e.state = 3; e.t = 45; e.dash = false; } return [e.dashDir * 4.2 * spd, 0]; }
    if (--e.t <= 0) { e.state = 3; e.t = 30; } return [0, 0];
  }
  if (e.state === 3) { if (--e.t <= 0) e.state = 0; return [0, 0]; }
  e.dir = Math.sign(dx) || 1; e.cd--;
  const shooter = e.ai === 'karen' || (e.mega && e.phase);
  if (shooter) { // keep distance, throw volleys
    const side = e.x < tgt.x ? -1 : 1, wantX = tgt.x + side * 84;
    if (e.cd <= 0 && Math.abs(dz) < 20) {
      e.cd = Math.round(110 / spd); e.state = 3; e.t = 40; e.phase = e.mega ? !e.phase : e.phase;
      for (const oz of rage ? [-18, -8, 0, 8, 18] : [-12, 0, 12]) { const shot = { x: e.x + e.dir * 12, z: Math.max(0, Math.min(ZMAX, e.z + oz)), vx: e.dir * 1.7, life: 170, spin: 0 }; lvl.eshots.push(shot); Net.send({ t: 'eshot', x: Math.round(shot.x), z: Math.round(shot.z), vx: shot.vx, l: lvl.n }); }
      SFX.karen(); if (Math.random() < .4) popup(e.x - 20, sy(e.z) - 50, e.quote.split(' ').slice(0, 3).join(' '), '#ffb0b0');
    }
    return [Math.sign(wantX - e.x) * Math.min(0.6 * spd, Math.abs(wantX - e.x)), Math.sign(dz) * Math.min(0.6, Math.abs(dz))];
  }
  // brawler: walk up and swing, or wind up a charging dash
  if (e.cd <= 0 && Math.abs(dx) > 50 && Math.abs(dz) < 14) { e.state = 1; e.t = 34; e.dash = true; e.dashDir = e.dir; e.cd = Math.round(170 / spd); e.phase = e.mega ? !e.phase : e.phase; return [0, 0]; }
  if (Math.abs(dx) < 40 && Math.abs(dz) < 10 && tgt.h < 16) { e.state = 1; e.t = 22; e.dash = false; return [0, 0]; }
  const wantX = tgt.x - e.dir * 30;
  return [Math.sign(wantX - e.x) * Math.min(1.0 * spd, Math.abs(wantX - e.x)), Math.sign(dz) * Math.min(0.8, Math.abs(dz))];
}
function summonAdds(e, k) {
  let n = 0;
  for (const id of e.summons || []) {
    const a = lvl.enemies[id]; if (n >= k || a.alive || a.spawned) continue;
    a.alive = true; a.spawned = true; a.entered = true; a.x = e.x + (n % 2 ? 30 : -30); a.z = Math.max(4, Math.min(ZMAX - 4, e.z + (n - 1) * 14)); a.state = 0; n++;
    puff(a.x, sy(a.z) - 8, 8, ['#ffffff', '#ff9ab8'], 1.2);
  }
  if (n) popup(e.x - 20, sy(e.z) - 56, 'GET THEM!', '#ff8a8a');
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
      const crew = players.length, need = Math.round(z.base * (1 + 0.55 * (crew - 1)));
      z.ids.filter(i => !lvl.enemies[i].boss).slice(need).forEach(i => { lvl.enemies[i].alive = false; lvl.enemies[i].skipped = true; });
      z.maxOn = 5 + 2 * (crew - 1);
      banner = { t: 70, a: 'HERE THEY COME!', b: '' }; SFX.karen();
    }
    if (z.started && !z.cleared) {
      const alive = z.ids.map(i => lvl.enemies[i]).filter(e => e.alive);
      const onScreen = alive.filter(e => e.spawned).length;
      const waiting = alive.filter(e => !e.spawned);
      if (z.spawnT == null) z.spawnT = 0;
      if (!z.maxOn) z.maxOn = 5 + 2 * (players.length - 1);
      const nonBoss = waiting.filter(e => !e.boss);
      if (waiting.length && onScreen < z.maxOn && --z.spawnT <= 0 && (nonBoss.length || onScreen <= 2)) {
        const e = nonBoss[0] || waiting[0], fromLeft = e.id % 3 === 0;
        e.spawned = true; e.x = fromLeft ? Math.min(z.x0 - 20, camX - 20) : Math.max(z.x0 + ZW + 20, camX + W + 20); z.spawnN = (z.spawnN || 0) + 1; e.z = 6 + ((e.id * 37 + z.spawnN * 19) % (ZMAX - 12)); e.dir = fromLeft ? 1 : -1;
        z.spawnT = onScreen < 2 ? 12 : 34;
        if (e.boss) { e.x = z.x0 + ZW + 30; e.dir = -1; e.z = ZMAX / 2; bossIntro(e); Net.send({ t: 'boss', i: e.id, l: lvl.n }); }
      }
      if (!alive.length) { z.cleared = true; lvl.locked = false; banner = { t: 90, a: 'GO GO GO!', b: '' }; SFX.cp(); }
    }
  }
  const zLock = lvl.locked && lvl.zones[lvl.zi], zMin = zLock ? zLock.x0 + 16 : -1e9, zMax = zLock ? zLock.x0 + ZW - 16 : 1e9;
  const inZone = x => Math.max(zMin, Math.min(zMax, x));
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive) continue;
    if (e.state === 5) { // knocked out, flying back
      e.vh -= 0.2; e.h = Math.max(0, e.h + e.vh); e.x += e.vx; e.vx *= 0.95; e.x = Math.max(camX + 6, Math.min(camX + W - 6, e.x));
      if (--e.t <= 0) { e.alive = false; layBody(e); }
      continue;
    }
    // target the closest homie
    let tgt = null, best = 1e9;
    for (const p of players) { if (!p.ok) continue; const d = Math.abs(p.x - e.x) + Math.abs(p.z - e.z) * 2; if (d < best) { best = d; tgt = p; } }
    if (!tgt) tgt = players[0];
    const dx = tgt.x - e.x, dz = tgt.z - e.z;
    e.vh -= 0.2; e.h = Math.max(0, e.h + e.vh); if (e.h === 0) e.vh = 0;
    if (e.burn > 0 && --e.burnT <= 0) {
      e.burnT = 36; e.burn--; e.hp -= 1; e.flash = 4;
      if (e.spread) for (const o of lvl.enemies) if (o !== e && o.spawned && o.alive && o.state !== 5 && !(o.burn > 0) && Math.abs(o.x - e.x) < 16 && Math.abs(o.z - e.z) < 10) { o.burn = 1; o.burnT = 36; o.burnBy = e.burnBy; }
      if (e.hp <= 0) { damageEnemy(e, 0, e.dir * -1, false, e.burnBy); continue; }
    }
    if (e.bleedN > 0 && --e.bleedT <= 0) { e.bleedT = 44; e.bleedN--; e.hp -= 1; e.flash = 4; if (e.hp <= 0) { damageEnemy(e, 0, e.dir * -1, false, e.bleedBy); continue; } }
    if (e.flying) {
      for (const o of lvl.enemies) if (o !== e && o.spawned && o.alive && o.state !== 5 && Math.abs(o.x - e.x) < 14 && Math.abs(o.z - e.z) < 10 && !(o.bowled === e.id)) { o.bowled = e.id; damageEnemy(o, 2, e.flying.dir, true, e.flying.by, { kb: 1.5 }); }
      if (e.h === 0 && e.vh <= 0) { e.flying = null; shake = Math.max(shake, 4); puff(e.x, sy(e.z), 6, ['#e8e0d0', '#ffffff'], 1); }
    }
    if (e.state === 4) { e.x += e.vx; e.vx *= 0.85; if (--e.t <= 0) { e.state = 0; e.stunned = 0; } continue; }
    let sx = 0, sz = 0;
    // smoke screens: confused buzzkills wander and can't attack; hotbox smoke burns them
    let inCloud = null;
    for (const c of lvl.clouds) if (Math.abs(e.x - c.x) < c.r && Math.abs(e.z - c.z) < c.r * 0.6) { inCloud = c; break; }
    if (inCloud && !e.boss) {
      if (inCloud.hot && frame % 60 === (e.id % 60)) damageEnemy(e, 1, 0, false, inCloud.by);
      e.state = 0; e.dir = Math.sin(frame / 30 + e.id) > 0 ? 1 : -1;
      e.x += e.dir * 0.3; e.z = Math.max(0, Math.min(ZMAX, e.z + Math.cos(frame / 20 + e.id) * 0.3)); e.conf = 1;
      continue;
    }
    e.conf = 0;
    if (e.boss) { const mv = bossAI(e, tgt, dx, dz, inCloud); sx = mv[0]; sz = mv[1]; }
    else if (e.state === 6) { // running off with your coins
      e.dir = e.dir || 1; sx = e.dir * 2.6;
      if (e.x < camX - 60 || e.x > camX + W + 60) { e.alive = false; e.gone = true; }
    } else if (e.ai === 'cop') {
      if (e.state === 0) {
        e.dir = Math.sign(dx) || 1;
        // take turns: only a couple of cops go for you at once, the rest circle and wait
        const busy = lvl.enemies.filter(o => o !== e && o.ai === 'cop' && o.alive && (o.state === 1 || o.state === 2 || o.near)).length;
        e.near = busy < 1 + players.length;
        const wantX = inZone(tgt.x - e.dir * (e.near ? 20 : 52 + (e.id % 3) * 12));
        sx = Math.sign(wantX - e.x) * Math.min(0.9, Math.abs(wantX - e.x)); sz = Math.sign(dz) * Math.min(0.9, Math.abs(dz));
        if (e.near && Math.abs(dx) < 26 && Math.abs(dz) < 5 && tgt.h < 14) { e.state = 1; e.t = 26; }
      } else if (e.state === 1) { if (--e.t <= 0) { e.state = 2; e.t = 8; e.strikeN = (e.strikeN || 0) + 1; SFX.hit(); } }
      else if (e.state === 2) { if (--e.t <= 0) { e.state = 3; e.t = 44; } }
      else if (e.state === 3) { if (--e.t <= 0) e.state = 0; }
    } else if (e.ai === 'karen') {
      if (e.state === 0) {
        const side = e.x < tgt.x ? -1 : 1, wantX = inZone(tgt.x + side * 56);
        e.dir = Math.sign(dx) || 1;
        sx = Math.sign(wantX - e.x) * Math.min(0.45, Math.abs(wantX - e.x)); sz = Math.sign(dz) * Math.min(0.6, Math.abs(dz));
        if (--e.cd <= 0 && Math.abs(dz) < 10) { e.state = 1; e.t = 16; }
      } else if (e.state === 1) {
        if (--e.t <= 0) {
          e.state = 3; e.t = 70; e.cd = 170 + (e.id * 17) % 80;
          const shot = { x: e.x + e.dir * 8, z: e.z, vx: e.dir * 1.6, life: 150, spin: 0 };
          lvl.eshots.push(shot); Net.send({ t: 'eshot', x: Math.round(shot.x), z: Math.round(shot.z), vx: shot.vx, l: lvl.n });
          if (e.id % 2) popup(e.x - 18, sy(e.z) - 36, e.id % 4 === 1 ? 'MANAGER!!' : 'UNACCEPTABLE!', '#ffb0b0');
          SFX.karen();
        }
      } else if (e.state === 3) { if (--e.t <= 0) e.state = 0; }
    } else if (e.ai === 'mouse') {
      e.dir = Math.sign(dx) || 1; sx = Math.sign(dx) * Math.min(1.8, Math.abs(dx)); sz = Math.sign(dz) * Math.min(1.1, Math.abs(dz));
    } else if (e.ai === 'squirrel') {
      if (e.h === 0) { if (--e.cd <= 0) { e.cd = 24 + (e.id * 7) % 20; e.vh = 2.6; e.dir = Math.sign(dx) || 1; e.hx = Math.sign(dx) * 1.7; e.hz = Math.sign(dz) * Math.min(1, Math.abs(dz) / 10); } }
      else { sx = e.hx || 0; sz = e.hz || 0; }
    }
    e.x += sx; e.z = Math.max(0, Math.min(ZMAX, e.z + sz));
  }
  // enemies stay inside the fight like you do (thieves running off with coins are the only ones allowed to leave)
  const zb = lvl.zones[lvl.zi];
  const L = lvl.locked && zb ? zb.x0 + 8 : camX + 8, Rt = lvl.locked && zb ? zb.x0 + ZW - 8 : camX + W - 8;
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive || e.state === 6) continue;
    if (!e.entered) { if (e.x > L && e.x < Rt) e.entered = true; else continue; }
    e.x = Math.max(L, Math.min(Rt, e.x));
  }
  // don't let enemies stack into one blob
  const act = lvl.enemies.filter(e => e.spawned && e.alive && e.state !== 5);
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j], dx = b.x - a.x, dz = b.z - a.z;
    if (Math.abs(dx) < 16 && Math.abs(dz) < 9) { const push = dx >= 0 ? 0.7 : -0.7; a.x -= push; b.x += push; a.z -= Math.sign(dz || 1) * 0.2; b.z += Math.sign(dz || 1) * 0.2; }
  }
  if (Net.online && frame % 4 === 0) {
    Net.send({
      t: 'es', l: lvl.n, zi: lvl.zi, lk: lvl.locked ? 1 : 0, zc: lvl.zones.filter(z => z.cleared).length, sk: lvl.zi >= 0 ? lvl.zones[lvl.zi].ids.filter(i => lvl.enemies[i].skipped) : [],
      e: lvl.enemies.filter(e => e.spawned && (e.alive || !e.sentDead && (e.sentDead = frame))).map(e => [e.id, Math.round(e.x), Math.round(e.z), Math.round(e.h), e.alive ? e.state : 7, e.dir, e.hp, e.strikeN || 0, e.stolen || 0, (e.burn > 0 ? 1 : 0) | (e.bleedN > 0 ? 2 : 0) | (e.stunned ? 4 : 0) | (e.conf ? 8 : 0) | (e.dash ? 16 : 0)])
    });
  }
}
function clientEnemies() {
  for (const e of lvl.enemies) {
    if (!e.spawned) continue;
    e.x += (e.tx - e.x) * 0.3; e.z += (e.tz - e.z) * 0.3; e.h += (e.th - e.h) * 0.4;
    if (e.state === 5 && --e.t <= 0) { e.alive = false; layBody(e); }
  }
}
function applySnapshot(m) {
  if (!lvl || m.l !== lvl.n) return;
  lvl.zi = m.zi; lvl.locked = !!m.lk;
  lvl.zones.forEach((z, i) => { z.started = i <= m.zi; z.cleared = i < m.zc; });
  for (const i of m.sk || []) { const e = lvl.enemies[i]; if (e && !e.spawned) { e.skipped = true; e.alive = false; } }
  for (const [id, x, z, h, st, dir, hp, sn] of m.e) {
    const e = lvl.enemies[id]; if (!e) continue;
    if (!e.spawned) { e.spawned = true; e.x = x; e.z = z; e.h = h; }
    e.tx = x; e.tz = z; e.th = h; e.dir = dir; e.hp = hp; e.strikeN = sn;
    if (st === 7) { if (e.state !== 5) e.alive = false; }
    else if (!(e.state === 5 && e.alive)) { e.state = st; if (!e.bodied) e.alive = true; }
    { const row = m.e.find(a => a[0] === id); e.stolen = row[8] || 0; e.fxf = row[9] || 0; }
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
function drawPlayer(x, y, face, anim, color, sq, inv, emote, name, star, ult, sitting, wi = 0, atkT = 0, slash = null, down = 0) {
  if (down) {
    const img = PLAYER[color][0], X = Math.round(x - camX + 5), Y = Math.round(y + 14);
    ctx.save(); ctx.translate(X, Y); ctx.rotate(Math.PI / 2 * (face > 0 ? -1 : 1)); ctx.drawImage(img, -8, -10); ctx.restore();
    if (frame % 40 < 28) text(down === true ? 'HOLD ' + KL('munchie') + ' TO REVIVE' : 'DOWN ' + Math.ceil(down / 60) + 'S', x + 5 - camX, y - 4, '#ff9ab8', 1, 'center');
    if (name) text(name, x + 5 - camX, y - 12, SHIRTS[color], 1, 'center');
    return;
  }
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
  } else if (drawPlayer.roll) { const X = Math.round(x - camX + 5), Y = Math.round(y + 9); ctx.save(); ctx.translate(X, Y); ctx.rotate(drawPlayer.roll * 0.6 * face); ctx.drawImage(img, -8, -9); ctx.restore(); drawPlayer.roll = 0; }
  else draw_(img, x - 3, y - 2, face < 0);
  ctx.filter = 'none';
  if (!sitting) drawHeld(x, y, face, wi, atkT, anim);
  if (slash && !sitting) drawSlash(x, y, face, slash);
  if (sitting && frame % 40 < 30) text('Z', x + 12 - camX, y - 8 - (frame % 40) / 8, '#e4b3ff');
  if (emote) bubble(EMOTES[emote.e], x + 5, y - (name ? 24 : 14));
  if (drawPlayer.say) { const m = drawPlayer.say, w = Math.min(46, m.length) * 4 + 6, bx = Math.round(x + 5 - camX - w / 2), by = Math.round(y - (name ? 34 : 24)); R(ctx, P.k, bx - 1, by - 1, w + 2, 11); R(ctx, '#ffffff', bx, by, w, 9); text(m.slice(0, 46), bx + 3, by + 2, '#2a1838'); drawPlayer.say = null; }
  if (name) text(name, x + 5 - camX, y - 10, SHIRTS[color], 1, 'center');
}
// sword slash: a big white crescent in front of the homie
const SLASH_COL = { puff: '#ffffff', lighter: '#ffb84a', dab: '#9ae8ff', bong: '#bfe8ff', grinder: '#c8ffa0', blunt: '#ffd84a' };
function drawSlash(px, pyTop, face, sl) {
  if (!sl || sl.t <= 0) return;
  const p = 1 - sl.t / sl.max, reach = (REACH[sl.kind] || 30) * (sl.heavy ? 1.15 : 1);
  const cx = Math.round(px - camX + 5), cy = Math.round(pyTop + 10);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(face, 1);
  const spin = sl.kind === 'grinder' || sl.air;
  const a0 = spin ? p * Math.PI * 2 - 1 : -1.9 + p * 0.4, a1 = spin ? a0 + 2.4 : a0 + (sl.heavy ? 2.9 : 2.3) * Math.min(1, p * 2.2);
  ctx.globalAlpha = Math.max(0, 1 - p * 0.9);
  ctx.strokeStyle = P.k; ctx.lineWidth = sl.heavy ? 7 : 5; ctx.beginPath(); ctx.arc(0, 0, reach * 0.8, a0, a1); ctx.stroke();
  ctx.strokeStyle = SLASH_COL[sl.kind] || '#fff'; ctx.lineWidth = sl.heavy ? 5 : 3; ctx.beginPath(); ctx.arc(0, 0, reach * 0.8, a0, a1); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, reach * 0.8 - 1, a0 + 0.2, a1); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawHeld(x, y, face, wi, atkT, anim) {
  const w = WEAPONS[wi] || WEAPONS[0], img = HELD[w.id]; if (!img || anim === 4) return;
  const hx = Math.round(x - camX + 5 + face * 5), hy = Math.round(y + 11);
  const p = atkT > 0 ? 1 - atkT / 12 : 0; // swing progress
  ctx.save(); ctx.translate(hx, hy); ctx.scale(face, 1);
  if (w.id === 'puff' || w.id === 'bong' || w.id === 'blunt') ctx.rotate(atkT > 0 ? -1.6 + p * 2.4 : -0.5);
  else if (w.id === 'dab') ctx.translate(atkT > 0 ? Math.sin(p * Math.PI) * 10 : 0, 0), ctx.rotate(atkT > 0 ? 0 : -0.25);
  else if (w.id === 'grinder') ctx.rotate(atkT > 0 ? p * 12 : 0);
  else if (w.id === 'lighter') ctx.rotate(atkT > 0 ? 0.2 : -0.1);
  if (w.id === 'puff' || w.id === 'blunt') ctx.drawImage(img, -2, -4);
  else if (w.id === 'dab') ctx.drawImage(img, -2, -2);
  else if (w.id === 'grinder') ctx.drawImage(img, -6, -5);
  else ctx.drawImage(img, -3, -img.height + 3);
  ctx.restore();
  if (w.id === 'puff' && frame % 14 === 0) puff(x + 5 + face * 26, y + 6, 1, ['#ffffff', '#e8e4f4'], .2, -0.03);
}
function circle(cx, cy, r) { for (let y = -r; y <= r; y++) { const w = Math.sqrt(r * r - y * y); ctx.fillRect(Math.round(cx - w), Math.round(cy + y), Math.round(w * 2), 1); } }

// each area gets its own street surface (64px repeating strip)
function makeFloor(key, tiles) {
  const c = document.createElement('canvas'); c.width = 64; c.height = H - FLOOR_Y + 12;
  const g = c.getContext('2d'), top = 12;
  let sd = 7; const rr = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const specks = (y0, y1, cols, n) => { for (let i = 0; i < n; i++) R(g, cols[i % cols.length], Math.floor(rr() * 64), y0 + Math.floor(rr() * (y1 - y0)), 1 + Math.floor(rr() * 2), 1); };
  for (let x = 0; x < 64; x += 16) g.drawImage(tiles[TOP], x, 0);
  if (key === 'park') {
    R(g, '#8ad890', 0, top, 64, c.height); specks(top, c.height, ['#6ac070', '#a8f0a0'], 60);
    for (let x = 0; x < 64; x++) { const w1 = Math.round(Math.sin(x / 64 * TAU * 2) * 2), w2 = Math.round(Math.cos(x / 64 * TAU) * 2);
      R(g, '#c8a070', x, top + 20 + w1, 1, 1); R(g, '#ecd0a0', x, top + 21 + w1, 1, 30 - w1 + w2); R(g, '#c8a070', x, top + 51 + w2, 1, 1); }
    specks(top + 24, top + 48, ['#d8b888', '#fff0d0'], 25);
  } else if (key === 'suburb') {
    R(g, '#e8e4f0', 0, top, 64, 26); for (let x = 0; x < 64; x += 16) R(g, '#c8c0d8', x, top, 1, 26); R(g, '#c8c0d8', 0, top + 13, 64, 1);
    R(g, '#b0a8c8', 0, top + 26, 64, 3); R(g, '#8a80a8', 0, top + 29, 64, 1);
    R(g, '#6a6480', 0, top + 30, 64, c.height); specks(top + 30, c.height, ['#7a7490', '#5a5470'], 50);
    R(g, '#ffffff', 8, top + 58, 22, 2);
  } else if (key === 'beach') {
    R(g, '#c89a6a', 0, top, 64, 18); for (let x = 0; x < 64; x += 8) R(g, '#9a6a42', x, top, 1, 18); R(g, '#e0b888', 0, top, 64, 1); R(g, '#9a6a42', 0, top + 17, 64, 2);
    R(g, '#ffe8a8', 0, top + 19, 64, c.height); specks(top + 19, c.height, ['#f0d090', '#fff6d8', '#e8c888'], 70);
    R(g, '#ff9ab8', 20, top + 44, 2, 2); R(g, '#ffffff', 50, top + 60, 3, 2);
  } else if (key === 'woods') {
    R(g, '#5aa860', 0, top, 64, c.height); specks(top, c.height, ['#4a9050', '#78c070'], 60);
    for (let x = 0; x < 64; x++) { const w = Math.round(Math.sin(x / 64 * TAU) * 3); R(g, '#8a6a4a', x, top + 18 + w, 1, 34); }
    specks(top + 20, top + 50, ['#c87a3a', '#e8a060', '#6a4a30'], 30);
  } else if (key === 'hq') {
    for (let y = top; y < c.height; y += 16) for (let x = 0; x < 64; x += 16) R(g, ((x + y) / 16) % 2 ? '#c8c4d8' : '#b0acc8', x, y, 16, 16);
    R(g, '#ff5a6a', 0, top + 30, 64, 3); R(g, '#e8e4f4', 0, top, 64, 1);
  } else {
    R(g, '#4a3a70', 0, top, 64, 22); for (let x = 0; x < 64; x += 16) R(g, '#3a2c5c', x, top, 1, 22); R(g, '#3a2c5c', 0, top + 11, 64, 1);
    R(g, '#8a80b8', 0, top + 22, 64, 2); R(g, '#2e2448', 0, top + 24, 64, c.height); specks(top + 24, c.height, ['#3a3058', '#262040'], 50);
    R(g, '#ffd84a', 4, top + 50, 24, 2); R(g, '#ffd84a', 36, top + 50, 24, 2);
  }
  return c;
}
// every fight area gets its own set dressing behind it
const LANDMARKS = {
  park: ['fountain', 'bench', 'hotdog', 'swings', 'bench', 'fountain', 'hotdog', 'swings'],
  beach: ['tower', 'boards', 'icecream', 'umbrella', 'boards', 'tower', 'icecream', 'umbrella'],
  suburb: ['car', 'mailbox', 'tramp', 'car', 'mailbox', 'tramp', 'car', 'mailbox'],
  city: ['foodtruck', 'busstop', 'dispo', 'foodtruck', 'busstop', 'dispo', 'foodtruck', 'busstop'],
  woods: ['tent', 'cabin', 'camp', 'tent', 'cabin', 'camp', 'tent', 'cabin'],
  hq: ['vending', 'cooler', 'desk', 'vending', 'cooler', 'desk', 'vending', 'cooler'],
};
function drawLandmarks() {
  const set = LANDMARKS[lvl.theme.base || lvl.themeKey] || LANDMARKS.park, by = FLOOR_Y - 10;
  lvl.zones.forEach((z, i) => {
    const kind = set[i % set.length], x = Math.round(z.x0 + 150 - camX * 1), k = P.k;
    if (x < -80 || x > W + 80) return;
    const box = (dx, dy, w, h, c, c2) => { R(ctx, k, x + dx - 1, by + dy - 1, w + 2, h + 2); R(ctx, c, x + dx, by + dy, w, h); if (c2) R(ctx, c2, x + dx, by + dy, w, 2); };
    switch (kind) {
      case 'fountain': box(-20, -10, 40, 10, '#b8b4d0', '#e8e4f4'); box(-4, -26, 8, 16, '#b8b4d0'); if (frame % 6 < 3) R(ctx, '#9ae8ff', x - 1, by - 34, 2, 8); R(ctx, '#7ac8ff', x - 18, by - 8, 36, 3); break;
      case 'bench': box(-18, -8, 36, 4, '#9a6a42', '#c89a6a'); box(-16, -4, 3, 4, '#5a5a78'); box(13, -4, 3, 4, '#5a5a78'); box(-18, -16, 36, 3, '#9a6a42'); break;
      case 'hotdog': box(-16, -14, 32, 14, '#ffffff', '#ff5a6a'); box(-18, -28, 36, 6, '#ff5a6a', '#ffd84a'); box(-2, -22, 2, 8, '#5a5a78'); break;
      case 'swings': box(-22, -34, 44, 3, '#ff9a3a'); box(-22, -34, 3, 34, '#ff9a3a'); box(19, -34, 3, 34, '#ff9a3a'); R(ctx, '#2a1838', x - 8, by - 31, 1, 20); R(ctx, '#2a1838', x + 8, by - 31, 1, 20); box(-11, -12, 8, 2, '#7ac8ff'); box(4, -12, 8, 2, '#7ac8ff'); break;
      case 'tower': box(-14, -40, 28, 14, '#ffffff', '#ff5a6a'); box(-12, -26, 3, 26, '#c89a6a'); box(9, -26, 3, 26, '#c89a6a'); break;
      case 'boards': box(-16, -30, 7, 30, '#ff9ab8', '#ffffff'); box(-6, -34, 7, 34, '#7ac8ff', '#ffffff'); box(4, -28, 7, 28, '#ffd84a', '#ffffff'); break;
      case 'icecream': box(-24, -22, 48, 18, '#ffffff', '#ff9ab8'); box(-18, -18, 14, 8, '#9ae8ff'); R(ctx, k, x - 20, by - 5, 8, 5); R(ctx, k, x + 12, by - 5, 8, 5); break;
      case 'umbrella': for (let yy = 0; yy < 8; yy++) R(ctx, yy % 2 ? '#ffffff' : '#ff5a6a', x - 18 + yy * 2, by - 36 + yy, 36 - yy * 4, 1); box(-1, -30, 2, 30, '#c89a6a'); break;
      case 'car': box(-26, -14, 52, 10, '#7a6ad8', '#b0a4ff'); box(-16, -22, 30, 8, '#7a6ad8'); box(-12, -20, 10, 5, '#9ae8ff'); box(2, -20, 10, 5, '#9ae8ff'); R(ctx, k, x - 20, by - 5, 8, 5); R(ctx, k, x + 12, by - 5, 8, 5); break;
      case 'mailbox': box(-5, -22, 10, 8, '#3a6ad8', '#7ac8ff'); box(-1, -14, 2, 14, '#9a6a42'); R(ctx, '#ff5a6a', x + 5, by - 24, 2, 5); break;
      case 'tramp': box(-22, -12, 44, 3, '#2a1838'); box(-20, -9, 2, 9, '#5a5a78'); box(18, -9, 2, 9, '#5a5a78'); R(ctx, '#7fe07a', x - 20, by - 13, 40, 1); break;
      case 'foodtruck': box(-30, -30, 60, 26, '#ffd84a', '#ffffff'); box(-20, -24, 24, 10, '#2a1838'); text('TACOS', x + 8, by - 22, '#ff5a6a'); R(ctx, k, x - 22, by - 5, 9, 5); R(ctx, k, x + 14, by - 5, 9, 5); break;
      case 'busstop': box(-20, -36, 40, 3, '#9aa0b8'); box(-20, -33, 2, 33, '#9aa0b8'); box(18, -33, 2, 33, '#9aa0b8'); box(-16, -28, 22, 18, 'rgba(154,232,255,.5)'); box(-14, -10, 28, 3, '#9a6a42'); break;
      case 'dispo': box(-22, -40, 44, 40, '#3a2a5a'); box(-18, -36, 36, 12, '#1a1026'); if (frame % 60 < 50) { R(ctx, '#7fe07a', x - 16, by - 34, 32, 8); text('DISPO', x - 10, by - 33, '#1a1026'); } box(-6, -20, 12, 20, '#7fe07a'); break;
      case 'tent': for (let yy = 0; yy < 20; yy++) R(ctx, yy % 4 ? '#ff9a3a' : '#c86a1a', x - yy, by - 20 + yy, yy * 2, 1); R(ctx, '#2a1838', x - 3, by - 8, 6, 8); break;
      case 'cabin': box(-26, -26, 52, 26, '#8a5a3a'); for (let yy = 0; yy < 12; yy++) R(ctx, '#5a3a24', x - 30 + yy * 2, by - 38 + yy, 60 - yy * 4, 1); box(-6, -14, 12, 14, '#5a3a24'); box(-20, -20, 8, 7, '#ffd84a'); break;
      case 'camp': box(-10, -3, 20, 3, '#6a4428'); if (frame % 8 < 4) R(ctx, '#ff9a3a', x - 4, by - 10, 8, 7); R(ctx, '#ffd84a', x - 2, by - 8, 4, 5); box(-24, -6, 10, 6, '#8a5a3a'); box(14, -6, 10, 6, '#8a5a3a'); break;
      case 'vending': box(-12, -38, 24, 38, '#e03b3b', '#ff7a7a'); box(-9, -34, 14, 22, '#9ae8ff'); for (let yy = 0; yy < 4; yy++) R(ctx, ['#ffd84a', '#7fe07a', '#ff9ab8', '#ffffff'][yy], x - 7, by - 32 + yy * 5, 10, 2); break;
      case 'cooler': box(-6, -30, 12, 30, '#e8e4f4'); box(-7, -42, 14, 12, 'rgba(154,232,255,.7)'); break;
      case 'desk': box(-28, -18, 56, 18, '#5a5a78', '#8a8aa8'); box(-8, -30, 16, 12, '#2a1838'); R(ctx, '#7ac8ff', x - 6, by - 28, 12, 8); text('SECURITY', x - 16, by - 12, '#ffffff'); break;
    }
  });
}
function shadow(x, z, h, w = 7) {
  const X = Math.round(x - camX), Y = sy(z);
  ctx.globalAlpha = Math.max(0.2, 0.42 - h / 160); ctx.fillStyle = '#2a1838';
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
  if ((e.ai === 'cop' && (e.state === 2)) || (e.ai === 'karen' && e.state === 1)) f = 1;
  if (e.ai === 'cop' && e.state === 1) f = 0;
  const bs = e.boss ? (e.mega ? 2.5 : 2) : 1;
  const img = imgs[f], x = e.x - img.width / 2, y = sy(e.z, e.h) - img.height;
  if (bs > 1) { const X = Math.round(e.x - camX - img.width * bs / 2), Y = Math.round(sy(e.z, e.h) - img.height * bs), fl = e.dir < 0;
    if (e.state === 5) { ctx.globalAlpha = Math.min(1, e.t / 40); } if (e.state === 1 && frame % 6 < 3) ctx.filter = 'brightness(1.8)';
    ctx.save(); ctx.translate(X + (fl ? img.width * bs : 0), Y); ctx.scale(fl ? -bs : bs, bs); ctx.drawImage(img, 0, 0); ctx.restore(); ctx.filter = 'none'; ctx.globalAlpha = 1;
    if (e.state === 1) text(e.dash ? '!!' : '!', e.x - camX, Y - 10, '#ff5a6a', 2, 'center');
    if (e.mega && frame % 4 === 0) puff(e.x, Y + 6, 1, ['#ff5a6a', '#ffd84a'], .4, -0.03);
    return; }
  if (e.state === 5 && e.t < 20 && frame % 4 < 2) return;
  const flip = e.ai === 'mouse' || e.ai === 'squirrel' ? e.dir > 0 : e.dir < 0;
  if (e.state === 5) { ctx.save(); ctx.translate(Math.round(e.x - camX), Math.round(sy(e.z, e.h) - 4)); ctx.rotate(e.dir * -1.4); ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore(); return; }
  draw_(img, x, y, flip);
  if (e.ai === 'cop' && e.state === 1 && frame % 6 < 3) text('!', e.x - camX, y - 8, '#ff5a6a', 1, 'center');
  if (e.conf && frame % 30 < 20) text('?', e.x - camX, y - 12, '#e4b3ff', 1, 'center');
  if (e.dazed || e.stunned) for (let k = 0; k < 3; k++) { const a = frame / 8 + k * 2.1; R(ctx, '#ffd84a', Math.round(e.x - camX + Math.cos(a) * 7), Math.round(y - 3 + Math.sin(a) * 2), 2, 2); }
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
  else if (it.kind === 'papers' || it.kind === 'bombs' || it.kind === 'brownie' || it.kind === 'soda') draw_(ICONS[it.kind], it.x - 4, y - 9);
  else if (it.kind === 'extra') { draw_(EXTRAS[it.sub].img, it.x - 4, y - 10); if (frame % 20 === 0) puff(it.x, y - 8, 1, ['#ffffff', '#fff6b0', '#9ae8ff'], .4); }
}

// menus are laid out for 320 wide: center them on wider screens
function draw320(fn, bg) {
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H); TQ.length = 0; }
  const w = W, ox = Math.floor((W - 320) / 2); ctx.save(); ctx.translate(ox, 0); W = 320; try { fn(); } finally { W = w; ctx.restore(); }
}
const FG_KIND = { park: ['leaves', 'bush'], beach: ['frond', 'post'], suburb: ['bush', 'post'], city: ['post', 'hydrant'], woods: ['leaves', 'fern'], hq: ['plant', 'post'] };
function drawForeground() {
  const kinds = FG_KIND[lvl.theme.base || lvl.themeKey] || ['leaves'], f = 1.5, spacing = 260;
  const start = Math.floor(camX * f / spacing) - 1;
  ctx.save(); ctx.filter = 'blur(1.5px)'; ctx.globalAlpha = lvl.locked ? 0.35 : 0.85;
  for (let i = start; i < start + Math.ceil(W / spacing) + 3; i++) {
    const seedv = (i * 9301 + 49297 + lvl.n * 17) % 233280; if (seedv % 3 === 0) continue; // only now and then
    const kind = kinds[seedv % kinds.length], x = Math.round(i * spacing + (seedv % 90) - camX * f), bottom = H + 4;
    if (x < -80 || x > W + 80) continue;
    if (kind === 'leaves' || kind === 'fern' || kind === 'frond') {
      const col = kind === 'frond' ? '#2f8e4a' : kind === 'fern' ? '#1e5a2e' : '#2f7a3a', lite = kind === 'fern' ? '#2f7a3a' : '#4fae5a';
      for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.35, len = 38 + (k % 3) * 10; ctx.strokeStyle = k % 2 ? col : lite; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(x, bottom); ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.6 + 8, bottom + Math.sin(a) * len * 0.6, x + Math.cos(a) * len, bottom + Math.sin(a) * len); ctx.stroke(); }
    } else if (kind === 'bush' || kind === 'plant') {
      ctx.fillStyle = kind === 'plant' ? '#4a7a4a' : '#3a8a48'; circle(x, bottom - 6, 22); ctx.fillStyle = kind === 'plant' ? '#6a9a5a' : '#5aae62'; circle(x - 8, bottom - 14, 12); circle(x + 10, bottom - 10, 10);
    } else if (kind === 'post') {
      R(ctx, '#2a1838', x - 5, 0, 10, H); R(ctx, (lvl.theme.base || lvl.themeKey) === 'beach' ? '#c89a6a' : '#6a6480', x - 4, 0, 8, H); R(ctx, '#ffffff', x - 3, 0, 2, H);
    } else if (kind === 'hydrant') {
      R(ctx, '#2a1838', x - 9, bottom - 34, 18, 34); R(ctx, '#e03b3b', x - 8, bottom - 33, 16, 33); R(ctx, '#ff7a7a', x - 6, bottom - 33, 4, 33); R(ctx, '#e03b3b', x - 13, bottom - 24, 26, 6);
    }
  }
  ctx.restore(); ctx.filter = 'none'; ctx.globalAlpha = 1;
}
// 8-bit smoke transition: puffs roll in, the screen changes behind the smoke, puffs roll out
// clickable regions: menus register them while drawing; the mouse hovers/clicks them
let HOT = [], mouseG = null;
function hot(x, y, w, h, click, hover) { const m = ctx.getTransform(); HOT.push({ x: m.e + x * m.a, y: m.f + y * m.d, w: w * m.a, h: h * m.d, click, hover }); }
function hotAt(gx, gy) { for (let i = HOT.length - 1; i >= 0; i--) { const r = HOT[i]; if (gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h) return r; } return null; }
let trans = null;
function go(fn, exhale) {
  if (document.hidden) { fn(); return; } // no one is watching: skip the animation
  if (trans) { if (!trans.done) { const prev = trans.mid; trans.mid = () => { prev && prev(); fn(); }; } else fn(); return; }
  trans = { t: 0, dur: exhale ? 110 : 64, mid: fn, done: false, exhale, ox: exhale && me ? me.x - camX : W / 2, oy: exhale && me ? sy(me.z || 30) - 20 : H / 2 };
  if (AC) { noise(exhale ? 1.4 : 0.6, exhale ? 0.1 : 0.05, AC.currentTime, 500); if (exhale) tone(180, 1.2, 'triangle', 0.05, 0, 0.5); }
}
function updateTrans() {
  if (!trans) return false;
  trans.t++;
  if (!trans.done && trans.t >= trans.dur / 2) { trans.done = true; const f = trans.mid; trans.mid = null; f && f(); K.jumpPressed = K.enterPressed = K.attackPressed = false; K.nav = null; K.navQ = []; }
  if (trans.t >= trans.dur) trans = null;
  return !!trans && trans.t < trans.dur / 2 + 6;
}
function drawTrans() {
  if (!trans) return;
  const half = trans.dur / 2, k = trans.t < half ? trans.t / half : 1 - (trans.t - half) / half; // 0 -> 1 -> 0 coverage
  const cols = ['#ffffff', '#ece6f6', '#d8cff0', '#c8bce6'];
  for (let i = 0; i < 70; i++) {
    const seedx = (i * 97) % 101 / 101, seedy = (i * 57) % 89 / 89, order = (i * 31) % 70 / 70;
    const x = trans.exhale ? trans.ox + (seedx - 0.5) * W * 1.4 * Math.min(1, k * 1.6) : seedx * (W + 40) - 20;
    const y = trans.exhale ? trans.oy + (seedy - 0.5) * H * 1.4 * Math.min(1, k * 1.6) : seedy * (H + 40) - 20;
    const r = Math.max(0, (k * 1.35 - order * 0.35) * 46);
    if (r < 1) continue;
    ctx.fillStyle = '#2a1838'; circle(Math.round(x), Math.round(y), Math.round(r + 1));
    ctx.fillStyle = cols[i % 4]; circle(Math.round(x), Math.round(y), Math.round(r));
    ctx.fillStyle = 'rgba(255,255,255,.6)'; circle(Math.round(x - r / 3), Math.round(y - r / 3), Math.round(r / 3));
  }
  if (k > 0.35) TQ.length = 0; // text hides behind the smoke too
}
let menu = null;
function menuOptions() {
  const m = menu || { page: 'main' };
  if (m.page === 'settings') {
    const bar = v => '[' + '#'.repeat(Math.round(v * 10)).padEnd(10, '-') + ']';
    return [
      { label: 'MUSIC   ' + bar(settings.music), adj: d => { settings.music = Math.max(0, Math.min(1, settings.music + d * 0.1)); saveSettings(); } },
      { label: 'SOUND   ' + bar(settings.sfx), adj: d => { settings.sfx = Math.max(0, Math.min(1, settings.sfx + d * 0.1)); saveSettings(); SFX.coin(); } },
      { label: 'SCREEN SHAKE: ' + (settings.shake ? 'ON' : 'OFF'), act: () => { settings.shake = !settings.shake; saveSettings(); } },
      { label: 'BLOOD: ' + (settings.blood ? 'ON' : 'OFF (SMOKE INSTEAD)'), act: () => { settings.blood = !settings.blood; saveSettings(); } },
      { label: 'FULLSCREEN (F)', act: toggleFullscreen },
      { label: 'BIG TEXT: ' + (settings.bigText ? 'ON' : 'OFF'), act: () => { settings.bigText = !settings.bigText; saveSettings(); } },
      { label: 'REDUCE FLASHING: ' + (settings.reduceFlash ? 'ON' : 'OFF'), act: () => { settings.reduceFlash = !settings.reduceFlash; saveSettings(); } },
      { label: 'COLORBLIND MODE: ' + (settings.colorblind ? 'ON' : 'OFF'), act: () => { settings.colorblind = !settings.colorblind; saveSettings(); } },
      { label: 'MUTE WHEN TAB HIDDEN: ' + (settings.muteHidden ? 'ON' : 'OFF'), act: () => { settings.muteHidden = !settings.muteHidden; saveSettings(); } },
      { label: 'HOLD TO AUTO-SWING: ' + (settings.holdAttack ? 'ON' : 'OFF'), act: () => { settings.holdAttack = !settings.holdAttack; saveSettings(); } },
      { label: 'BACK', act: () => { menu.page = 'main'; menu.sel = 0; } },
    ];
  }
  if (m.page === 'controls') {
    return [
      ...Object.keys(DEFAULT_KEYS).map(a => ({ label: ACTION_NAMES[a].padEnd(18, ' ') + (rebinding === a ? '...PRESS A KEY' : keyLabel(settings.keys[a])), act: () => { rebinding = a; } })),
      { label: 'RESET TO DEFAULTS', act: () => { settings.keys = { ...DEFAULT_KEYS }; saveSettings(); } },
      { label: 'BACK', act: () => { menu.page = 'main'; menu.sel = 0; } },
    ];
  }
  const o = [{ label: 'RESUME', act: closeMenu }];
  if (Net.online) o.push({ label: 'COPY INVITE LINK', act: copyInvite });
  if (Net.online) o.push({ label: 'CHAT (' + keyLabel(settings.keys.chat) + ')', act: () => { closeMenu(); openChat(); } });
  o.push({ label: 'SETTINGS', act: () => { menu.page = 'settings'; menu.sel = 0; } });
  o.push({ label: 'CONTROLS', act: () => { menu.page = 'controls'; menu.sel = 0; } });
  if (!Net.online && (state === 'play' || state === 'brief' || state === 'sitting')) o.push({ label: 'RESTART MISSION', act: () => { closeMenu(); go(() => startLevel(lvl.n)); } });
  if (!Net.online && (state === 'play' || state === 'brief' || state === 'sitting')) o.push({ label: 'QUIT TO MAP', act: () => { closeMenu(); go(openMap); } });
  o.push({ label: 'SAVE + MAIN MENU', act: () => { persist(); location.href = location.pathname; } });
  return o;
}
function copyInvite() {
  const link = location.origin + '/?room=' + Net.code;
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => { menu.msg = 'COPIED! PASTE IT TO YOUR FRIENDS'; }, () => { menu.msg = link; });
}
function openMenu() { menu = { page: 'main', sel: 0, msg: '' }; if (!Net.online) paused = true; else if (me && state === 'play') me.inv = Math.max(me.inv, 120); }
function closeMenu() { menu = null; paused = false; rebinding = null; }
function menuPick(i) { const o = menuOptions()[i]; if (!o) return; SFX.tick(); if (o.act) o.act(); else if (o.adj) o.adj(1); }
function updateMenu() {
  const o = menuOptions(), n = o.length;
  if (rebinding) return;
  if (K.nav === 'up') { menu.sel = (menu.sel + n - 1) % n; SFX.tick(); }
  if (K.nav === 'down') { menu.sel = (menu.sel + 1) % n; SFX.tick(); }
  const cur = o[menu.sel];
  if (cur && cur.adj && (K.nav === 'left' || K.nav === 'right')) cur.adj(K.nav === 'right' ? 1 : -1);
  if (K.jumpPressed || K.enterPressed || K.attackPressed) menuPick(menu.sel);
}
function drawMenu() {
  TQ.length = 0;
  const o = menuOptions(), rowH = menu.page === 'controls' ? 10 : 14, bw = menu.page === 'main' ? 180 : 240;
  const h = 30 + o.length * rowH + (Net.online && menu.page === 'main' ? 14 : 0), y0 = Math.max(4, Math.round((H - h) / 2)), x0 = Math.round(W / 2 - bw / 2);
  ctx.fillStyle = 'rgba(20,12,32,.65)'; ctx.fillRect(0, 0, W, H);
  R(ctx, P.k, x0 - 2, y0 - 2, bw + 4, h + 4); R(ctx, '#2a1838', x0, y0, bw, h); R(ctx, '#c8ffa0', x0, y0, bw, 1);
  text(menu.page === 'main' ? (Net.online ? 'MENU' : 'PAUSED') : menu.page.toUpperCase(), W / 2, y0 + 6, '#c8ffa0', 2, 'center');
  o.forEach((t, i) => {
    const y = y0 + 24 + i * rowH;
    hot(x0 + 6, y - 2, bw - 12, rowH - 1, () => { menu.sel = i; menuPick(i); }, () => { menu.sel = i; });
    if (i === menu.sel) R(ctx, '#4a3a60', x0 + 6, y - 2, bw - 12, rowH - 2);
    text((i === menu.sel ? '> ' : '  ') + t.label, x0 + 12, y, i === menu.sel ? '#ffd84a' : '#ffffff');
    if (t.adj) { hot(x0 + bw - 40, y - 2, 14, rowH - 1, () => t.adj(-1)); hot(x0 + bw - 22, y - 2, 14, rowH - 1, () => t.adj(1)); text('-  +', x0 + bw - 36, y, '#c8ffa0'); }
  });
  if (Net.online && menu.page === 'main') text('ROOM CODE: ' + Net.code, W / 2, y0 + h - 12, '#e4b3ff', 1, 'center');
  if (Net.online && menu.page === 'main' && remotes.size) {
    const cy = y0 + h + 20; text('CREW', W / 2, cy - 8, '#b0a8c0', 1, 'center');
    let yy = cy;
    for (const [id, rp] of remotes) {
      const down = rp.b & 8;
      text(rp.name, x0 + 10, yy, SHIRTS[rp.color] || '#fff');
      text(down ? 'DOWN - NEEDS HELP' : (rp.hp || 0) + '/' + (rp.mh || 5) + ' HP', x0 + bw - 10, yy, down ? '#ff8a8a' : '#c8ffa0', 1, 'right');
      yy += 9;
    }
  }
  if (menu.page === 'settings') text('LEFT/RIGHT OR -/+ CHANGES VOLUME', W / 2, y0 + h + 6, '#b0a8c0', 1, 'center');
  if (menu.page === 'controls') text(rebinding ? 'PRESS ANY KEY (ESC CANCELS)' : rebindWarn && rebindWarn.t-- > 0 ? rebindWarn.m : 'CLICK A ROW, THEN PRESS THE NEW KEY. ARROWS + MOUSE ALWAYS WORK', W / 2, y0 + h + 6, '#b0a8c0', 1, 'center');
  if (menu.msg) text(menu.msg, W / 2, y0 + h + 16, '#c8ffa0', 1, 'center');
}
function draw() { TQ.length = 0; HOT = []; drawScene(); if (menu) { HOT = []; drawMenu(); } if (dialog) { HOT = []; draw320(drawDialogue); } drawTrans(); flushText(); if (mouseG) { const r = hotAt(mouseG.x, mouseG.y); cv.style.cursor = r ? 'pointer' : 'default'; } }
function drawScene() {
  if (state === 'story') { drawStory(); return; }
  if (state === 'lobby') { draw320(drawLobby); return; }
  if (state === 'map') { drawMap_(); if (invOpen) draw320(drawInventory); return; }
  if (state === 'results' && results && results.shopOnly) { draw320(drawShop, '#1e122c'); return; }
  const th = lvl.theme;
  ctx.save();
  if (shake > 0) { ctx.translate(Math.round((Math.random() - .5) * shake), Math.round((Math.random() - .5) * shake)); shake *= 0.85; if (shake < 0.5) shake = 0; }
  ctx.drawImage(th.sky, 0, 0);
  drawLayer(th.clouds, 0.08, camX, frame * 0.1, 0);
  drawLayer(th.far, 0.2, camX, 0, -78);
  drawLayer(th.near, 0.45, camX, 0, -80);
  { // mood grade: 0% at the start, full at the smoke spot; fights push it a bit further
    const pr = Math.max(0, Math.min(1, camX / Math.max(1, LEN - W))), md = MOOD[lvl.theme.base || lvl.themeKey] || MOOD.park;
    lvl.fightT = Math.max(0, Math.min(1, (lvl.fightT || 0) + (lvl.locked ? 0.012 : -0.01)));
    ctx.fillStyle = 'rgba(' + md[0] + ',' + (pr * md[1] + lvl.fightT * 0.08).toFixed(3) + ')'; ctx.fillRect(0, 0, W, FLOOR_Y - 8);
  }
  drawLandmarks();
  // the street
  if (!th.floor) th.floor = makeFloor(th.base || lvl.themeKey, th.tiles);
  for (let X = -Math.floor(((camX % 64) + 64) % 64); X < W; X += 64) ctx.drawImage(th.floor, X, FLOOR_Y - 12);
  if (th.floorTint) { ctx.globalAlpha = th.floorTint[1]; ctx.fillStyle = th.floorTint[0]; ctx.fillRect(0, FLOOR_Y - 12, W, H); ctx.globalAlpha = 1; }
  for (const x of lvl.deco) draw_(PLANT, x, FLOOR_Y - 24);
  drawSpot();
  // fight area edges
  const zn = lvl.zones[lvl.zi];
  if (lvl.locked && zn && frame % 30 < 20) { R(ctx, 'rgba(255,90,106,.5)', Math.round(zn.x0 + ZW - 4 - camX), FLOOR_Y, 3, ZMAX + 10); R(ctx, 'rgba(255,90,106,.5)', Math.round(zn.x0 + 2 - camX), FLOOR_Y, 3, ZMAX + 10); }

  // smoke screens on the ground
  for (const c of lvl.clouds) {
    const a = Math.min(1, c.t / 60) * 0.55, X = Math.round(c.x - camX), Y = sy(c.z) - 10;
    ctx.globalAlpha = a;
    for (let k = 0; k < 9; k++) { const ang = k / 9 * TAU + frame / 90, rx = Math.cos(ang) * c.r * 0.7, rz = Math.sin(ang) * c.r * 0.25; ctx.fillStyle = c.hot ? (k % 2 ? '#ffd0b0' : '#ffffff') : c.heal ? (k % 2 ? '#d8ffd0' : '#ffffff') : (k % 2 ? '#e8e4f4' : '#ffffff'); circle(X + rx, Y + rz, c.r * 0.38); }
    ctx.globalAlpha = 1;
  }
  // blood on the street + the fallen (stays for the whole mission)
  for (const d of lvl.decals) { const X = Math.round(d.x - camX), Y = sy(d.z); if (X < -10 || X > W + 10) continue; ctx.fillStyle = d.pool ? 'rgba(150,20,40,.55)' : 'rgba(170,24,48,.6)'; ctx.fillRect(X - d.r, Y - 1, d.r * 2, 2); ctx.fillRect(X - d.r + 1, Y - 2, d.r * 2 - 2, 4); }
  for (const b of lvl.bodies) {
    const img = ENEMY_IMG[b.kind][0], X = Math.round(b.x - camX), Y = sy(b.z);
    if (X < -30 || X > W + 30) continue;
    ctx.save(); ctx.translate(X, Y - img.width / 2 + 2); ctx.rotate(b.dir > 0 ? Math.PI / 2 : -Math.PI / 2); ctx.filter = 'brightness(.75) saturate(.7)'; ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore(); ctx.filter = 'none';
    if (b.kind !== 'mouse' && b.kind !== 'squirrel') text('X X', X - 5, Y - 6 - (b.dir > 0 ? 0 : 0), '#2a1838');
  }
  // everything standing on the street, back to front
  const list = [];
  for (const it of lvl.items) if (!it.taken && Math.abs(it.x - camX - W / 2) < W) list.push({ z: it.z, d: () => { shadow(it.x, it.z, it.h || 0, 4); drawItem(it); } });
  for (const p of lvl.props) if (!p.broken) list.push({ z: p.z, d: () => { shadow(p.x, p.z, 0, 8); drawProp(p); } });
  for (const e of lvl.enemies) if (e.spawned && e.alive) list.push({ z: e.z, d: () => { shadow(e.x, e.z, e.h, e.ai === 'mouse' ? 5 : 7); drawEnemyB(e); } });
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
    list.push({ z: r.z, d: () => { shadow(r.x, r.z, r.h); drawPlayer.say = r.say && r.say.msg; drawPlayer(r.x - 5, sy(r.z, r.h) - 17, r.f || 1, r.a, r.color, 0, 0, r.emote, r.name, r.b & 1, r.b & 2, r.b & 4, r.w, r.atkT || 0, r.slash, r.b & 8 ? true : 0); } });
  }
  list.push({ z: me.z + 0.01, d: () => { drawPlayer.roll = me.roll > 0 ? 20 - me.roll : 0; if (me.holdT > 30) { ctx.fillStyle = 'rgba(255,216,74,' + (0.25 + Math.sin(frame / 3) * 0.15) + ')'; circle(Math.round(me.x - camX), sy(me.z, me.h) - 9, 12); } shadow(me.x, me.z, me.h); drawPlayer.say = me.say && me.say.msg; { const X = Math.round(me.x - camX), Y = sy(me.z); ctx.strokeStyle = SHIRTS[me.color]; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(X + .5, Y + .5, 9, 3, 0, 0, TAU); ctx.stroke(); } drawPlayer(me.x - 5, sy(me.z, me.h) - 17, me.face, animFrame(me), me.color, me.sq, me.inv, me.emote, Net.online ? me.name : '', me.star > 0, ultra(), state === 'sitting', WEAPONS.indexOf(weaponDef()), me.atkT, me.slash, me.down || 0); } });
  for (const s of lvl.eshots) list.push({ z: s.z, d: () => {
    shadow(s.x, s.z, 5, 4); const x = Math.round(s.x - camX), y = sy(s.z, 5);
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.spin * 0.3); R(ctx, P.k, -4, -4, 8, 8); R(ctx, '#ff7ac8', -3, -3, 6, 6); R(ctx, '#ffd84a', -1, -5, 2, 2); ctx.restore();
  } });
  for (const s of shots) list.push({ z: s.z, d: () => {
    const x = Math.round(s.x - camX), y = sy(s.z, s.h);
    if (s.kind === 7) { ctx.save(); ctx.translate(x, y); ctx.rotate(frame * 0.6); ctx.drawImage(ICONS.papers, -3, -3); ctx.restore(); return; }
    if (s.kind === 8) { shadow(s.x, s.z, s.h, 4); ctx.drawImage(ICONS.bombs, x - 4, y - 4); if (frame % 3 === 0) puff(s.x, y - 4, 1, ['#ffffff', '#c8ffa0'], .3); return; }
    if (s.kind === 6) { ctx.fillStyle = P.k; circle(x, y, 4.5); ctx.fillStyle = '#7ac8ff'; circle(x, y, 3.5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 3, 2, 2); }
    else { ctx.globalAlpha = Math.min(1, s.life / 8); ctx.fillStyle = P.k; circle(x, y, 8); ctx.fillStyle = '#ffffff'; circle(x, y, 7); ctx.fillStyle = '#e8e4f4'; circle(x + 2, y + 2, 3); ctx.globalAlpha = 1; }
  } });
  list.sort((a, b) => a.z - b.z).forEach(o => o.d());

  for (const p of particles) {
    if (p.burst) { const X = Math.round(p.x - camX), Y = Math.round(p.y), r = p.burst * (1 - p.life / 9) + 3; ctx.fillStyle = '#ffffff'; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.fillRect(Math.round(X + Math.cos(a) * r), Math.round(Y + Math.sin(a) * r), 2, 2); } ctx.fillStyle = '#fff6b0'; ctx.fillRect(X - 2, Y - 2, 4, 4); continue; }
    if (p.drip !== undefined && p.y > sy(p.drip) - 1) { p.vx = p.vy = p.g = 0; p.y = sy(p.drip) - 1; }
    ctx.globalAlpha = Math.min(1, p.life / 15); ctx.fillStyle = p.col;
    ctx.fillRect(Math.round(p.x - camX), Math.round(p.y), p.s, p.s); ctx.globalAlpha = 1;
  }
  drawForeground();
  for (const p of popups) text(p.str, p.x - camX, p.y, p.col);
  if (lg && lg.met && me.legendT > 0 && state === 'play') {
    const L = LEGENDS[lg.who];
    ctx.fillStyle = 'rgba(42,24,56,.9)'; ctx.fillRect(10, 30, W - 20, 26);
    text(L.name + ':', 16, 34, '#ffd84a'); wrap('"' + L.tip + '"', 16, 43, 72, '#ffffff'); text('GIFT: ' + lg.gift, W - 16, 34, '#c8ffa0', 1, 'right');
  }
  ctx.restore();

  if (lvl.fightT > 0.02) { const a = lvl.fightT * 0.35; ctx.fillStyle = 'rgba(40,10,30,' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, W, 6); ctx.fillRect(0, H - 6, W, 6); ctx.fillRect(0, 0, 6, H); ctx.fillRect(W - 6, 0, 6, H); }
  if (ultra() && state === 'play') { ctx.fillStyle = 'rgba(192,112,255,' + (0.06 + Math.sin(frame / 20) * 0.03) + ')'; ctx.fillRect(0, 0, W, H); }
  // GO arrow after clearing a fight
  const next = lvl.zones.find(z => !z.cleared);
  if (state === 'play' && !lvl.locked && frame % 40 < 26 && (!next || me.x < next.x0 + 40)) {
    text('GO', W - 30, 60, '#ffd84a', 2); R(ctx, '#ffd84a', W - 12, 62, 4, 6); R(ctx, '#ffd84a', W - 8, 64, 2, 2);
  }
  if (me.tipT > 0 && state === 'play' && !banner) {
    const tips = ['WASD MOVE   SPACE JUMP   CLICK / ' + KL('attack') + ' SWING (3-HIT COMBO)', 'AIM WITH YOUR MOUSE   HOLD SHIFT TO RUN + LUNGE   JUMP AGAIN TO FLOAT', KL('throw') + ' OR RIGHT-CLICK TO THROW   ' + KL('munchie') + ' FOR MUNCHIES/REVIVE', 'GET COOKED TO 50%, THEN REACH THE SMOKE SPOT + PRESS SPACE TO CALL THE CREW'];
    const tip = tips[Math.floor((900 - me.tipT) / 225) % tips.length];
    ctx.fillStyle = 'rgba(42,24,56,.8)'; ctx.fillRect(Math.max(4, W / 2 - tip.length * 2 - 6), 174, Math.min(W - 8, tip.length * 4 + 12), 13);
    text(tip, W / 2, 180, '#fff6b0', 1, 'center');
  }
  drawHUD();
  drawChat();
  if (state === 'brief') draw320(drawBrief);
  if (invOpen) draw320(drawInventory);
  if (state === 'results') draw320(drawShop, '#1e122c');
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
  R(ctx, c >= 100 ? (settings.reduceFlash ? '#e4b3ff' : ['#c070ff', '#c8ffa0', '#ff9ab8', '#ffd84a'][Math.floor(frame / 5) % 4]) : c >= 50 ? '#7fe07a' : '#c8b890', mx + 10, 4, Math.round(60 * c / 100), 5);
  R(ctx, settings.colorblind ? '#1a1026' : '#ffffff', mx + 30, 3, 1, 7); R(ctx, settings.colorblind ? '#1a1026' : '#ffffff', mx + 54, 3, 1, 7);
  text(c >= 100 ? 'ULTRA COOKED!' : c >= 50 ? 'COOKED ' + c + '%' : 'SOBER-ISH ' + c + '%', mx + 9, 11, c >= 100 ? '#e4b3ff' : c >= 50 ? '#c8ffa0' : '#d8c8b0');
  // weapon + items
  const w = weaponDef();
  R(ctx, P.k, 146, 2, 14, 14); R(ctx, '#4a3a60', 147, 3, 12, 12); ctx.drawImage(ICONS[w.icon], 148, 4);
  if (me.atkCd > 0) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(147, 3, 12, Math.round(12 * me.atkCd / w.cd)); }
  if (save.munchie > 0) { ctx.drawImage(MUNCHIE, 164, 4); text('x' + save.munchie, 174, 3, '#ff9ab8'); text('E', 176, 10, '#b0a8c0'); }
  { const q = save.quick || 'brownie'; if (save[q] > 0) { ctx.drawImage(ICONS[ITEMS[q].icon], 250, 4); text('x' + save[q], 260, 3, '#fff6b0'); text('C', 262, 10, '#b0a8c0'); } }
  if (me.buffs.rage > 0) text('RAGE', 246, 20, frame % 20 < 12 ? '#ff5a6a' : '#ffd84a');
  let bx = 226;
  for (const [k, ex, maxT] of [['speed', 'shatter', 600], ['magnet', 'kief', 720], ['power', 'hash', 720]]) if (me.buffs[k] > 0 && (me.buffs[k] > 120 || frame % 10 < 6)) { ctx.drawImage(EXTRAS[ex].img, bx, 4); R(ctx, '#1a1026', bx, 13, 9, 2); R(ctx, '#c8ffa0', bx, 13, Math.max(1, Math.round(9 * me.buffs[k] / maxT)), 2); bx += 11; }
  // off-screen arrows toward crew who are behind, ahead, or downed
  if (Net.online) for (const [id, rp] of remotes) {
    const sx = rp.x - camX, off = sx < 6 || sx > W - 6, down = rp.b & 8;
    if (!off && !down) continue;
    const ay = down ? 30 : 96, ax = Math.max(8, Math.min(W - 8, sx));
    const dir = sx < W / 2 ? -1 : 1, arrowX = off ? (sx < 0 ? 8 : W - 8) : ax;
    ctx.save(); ctx.translate(arrowX, ay); if (off) ctx.scale(dir, 1);
    ctx.fillStyle = down ? '#ff8a8a' : SHIRTS[rp.color] || '#fff'; ctx.beginPath(); ctx.moveTo(4, -4); ctx.lineTo(4, 4); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (down && !off) text(rp.name + ' DOWN', arrowX, ay + 8, '#ff8a8a', 1, 'center');
  }
  const tw = THROWS.find(t => t.id === save.throwSel) || THROWS[0];
  if ((save.throws.papers || 0) + (save.throws.bombs || 0) > 0) { ctx.drawImage(ICONS[tw.id], 186, 4); text(save.throws[tw.id] || 0, 196, 3, '#fff6b0'); text('K', 197, 10, '#b0a8c0'); }
  if (me.star > 0) { ctx.drawImage(GOLD_LEAF, 212, 4); R(ctx, '#ffd84a', 198, 8, Math.ceil(me.star / 540 * 20), 3); }
  text(lvl.name[0], W - 4, 3, '#ffffff', 1, 'right');
  text(lvl.name[1], W - 4, 10, '#b0a8c0', 1, 'right');
  if (Net.online) { text('ROOM ' + Net.code + '  ' + (remotes.size + 1) + '/4', W - 4, 20, '#e4b3ff', 1, 'right'); }
  else if (Net.reconnecting) text('RECONNECTING...', W - 4, 20, '#ff8a8a', 1, 'right');
  if (!musicOn) text('MUSIC OFF', 4, 20, '#b0a8c0');

  if (lvl.boss && lvl.boss.alive && lvl.boss.state !== 5 && state === 'play') {
    const b = lvl.boss, bw = Math.min(200, W - 60), bx = Math.round(W / 2 - bw / 2), by = H - 16;
    R(ctx, P.k, bx - 2, by - 2, bw + 4, 9); R(ctx, '#4a2a40', bx, by, bw, 5); R(ctx, b.raged ? '#ff5a6a' : '#ff9a3a', bx, by, Math.round(bw * Math.max(0, b.hp) / b.maxHp), 5);
    text((b.mega ? 'MEGA BOSS: ' : 'BOSS: ') + b.bname, W / 2, by - 10, '#ffd84a', 1, 'center');
  }
  if (skillPop) {
    const sk = SKILLS[skillPop.id], a = Math.min(1, skillPop.t / 30, (420 - skillPop.t) / 20);
    ctx.globalAlpha = a; R(ctx, 'rgba(26,16,38,.92)', 20, 50, W - 40, 60); R(ctx, '#ffd84a', 20, 50, W - 40, 1); R(ctx, '#ffd84a', 20, 109, W - 40, 1);
    text('NEW SKILL LEARNED!', W / 2, 56, '#ffd84a', 1, 'center'); text(sk.name, W / 2, 68, '#c8ffa0', 2, 'center'); wrap(sk.desc, 32, 88, Math.floor((W - 64) / 4), '#ffffff'); ctx.globalAlpha = 1;
  }
  if (me.combo < 3 && state === 'play' && !banner) {
    const next = lvl.zones.find(z => !z.cleared);
    const goal = lvl.locked ? 'BEAT THE WAVE!' : me.cooked < 50 ? 'GOAL: GET COOKED (' + Math.round(me.cooked) + '/50%)' : !next ? 'GOAL: REACH THE SMOKE SPOT' : 'GOAL: KEEP MOVING - SMOKE SPOT AHEAD';
    const gs = settings.bigText ? 2 : 1, gw = goal.length * 4 * gs + 8; R(ctx, 'rgba(26,16,38,.75)', Math.round(W / 2 - gw / 2), 19, gw, 11 * gs);
    text(goal, W / 2, 22, lvl.locked ? '#ff8a8a' : '#fff6b0', gs, 'center');
    if (me.cooked >= 50 && !lvl.locked && lvl.spot.x > camX + W && frame % 30 < 20) { text('SMOKE SPOT', W - 44, 96, '#c8ffa0', 1, 'center'); R(ctx, '#c8ffa0', W - 10, 95, 4, 7); R(ctx, '#c8ffa0', W - 6, 97, 2, 3); }
  }
  if (me.combo >= 3) {
    const col = me.combo >= 10 ? (settings.reduceFlash ? '#e4b3ff' : ['#c8ffa0', '#e4b3ff', '#ffd84a', '#ffffff'][Math.floor(frame / 4) % 4]) : '#fff';
    text(me.combo + 'x COMBO', W / 2, 22, col, 1, 'center');
    if (me.combo >= 10) text('BLAZED!', W / 2, 30, col, 2, 'center');
  }
  if (Net.online && crewCombo >= 3) text('CREW COMBO x' + crewCombo, W - 4, 27, '#e4b3ff', 1, 'right');
  if (banner && skillPop) banner = null;
  if (banner) {
    const bs = settings.bigText ? 2 : 1;
    ctx.globalAlpha = Math.min(1, banner.t / 20);
    ctx.fillStyle = 'rgba(42,24,56,.75)'; ctx.fillRect(0, 62, W, (banner.b ? 34 : 22) * bs);
    text(banner.a, W / 2, 68, '#c8ffa0', 2 * bs, 'center');
    if (banner.b) text(banner.b, W / 2, 68 + 16 * bs, '#fff', bs, 'center');
    if (Net.rejoin) hot(0, 62, W, (banner.b ? 34 : 22) * bs, () => Net.doRejoin());
    if (Net.kicked) hot(0, 62, W, (banner.b ? 34 : 22) * bs, () => { persist(); location.href = location.pathname; });
    ctx.globalAlpha = 1;
  }
  if (state === 'sitting') {
    ctx.fillStyle = 'rgba(42,24,56,.75)'; ctx.fillRect(40, 110, W - 80, 36);
    text('CHILLING AT THE SMOKE SPOT', W / 2, 115, '#c8ffa0', 1, 'center');
    if (Net.online) {
      text((finInfo ? finInfo.n : 1) + '/' + (remotes.size + 1) + ' OF THE CREW MADE IT', W / 2, 125, '#ffffff', 1, 'center');
      text(hurryT > 0 ? 'CREW HAS ' + Math.ceil(hurryT / 60) + 'S TO GET HERE' : finInfo && finInfo.hurried ? 'CALLED THE CREW...' : 'ENTER OR SPACE = CALL THE CREW (20S)', W / 2, 135, '#e4b3ff', 1, 'center');
    }
  } else if (hurryT > 0 && state === 'play') {
    ctx.fillStyle = 'rgba(42,24,56,.75)'; ctx.fillRect(60, 24, W - 120, 20);
    text('THE CREW IS WAITING! ' + Math.ceil(hurryT / 60) + 'S', W / 2, 28, '#ffd84a', 1, 'center');
    text('GET TO THE SMOKE SPOT', W / 2, 36, '#ffffff', 1, 'center');
  }

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
let shopTab = 0;
const SHOP_TABS = ['ALL', 'WEAPONS', 'ARMOR', 'ITEMS', 'AMMO', 'UPGRADES'];
const SHOP_TAB_OF = { weapon: 'WEAPONS', armor: 'ARMOR', item: 'ITEMS', use: 'ITEMS', ammo: 'AMMO', upgrade: 'UPGRADES' };
function shopEntries(all) {
  const ups = WEAPONS.filter(w => save.weapons.includes(w.id)).map(w => ({ kind: 'upgrade', id: w.id, icon: w.icon, name: 'UPGRADE ' + w.name + (wlv(w.id) < 3 ? ' LV' + (wlv(w.id) + 1) : ''), price: 60 * wlv(w.id) + w.dmg * 20, desc: '+1 DAMAGE AND STRONGER EFFECTS. MAX LV3' }));
  const uses = Object.entries(ITEMS).map(([id, d]) => ({ kind: 'use', id, ...d, desc: d.desc + '. SAVED IN YOUR BAG' }));
  const nav = [{ kind: 'ready', name: results && !results.shopOnly && Net.online ? 'READY - BACK TO THE MAP' : 'BACK TO THE MAP', icon: 'puff', price: 0, desc: 'PICK YOUR NEXT MISSION ON THE WORLD MAP. ESC WORKS TOO' }, { kind: 'quit', name: 'SAVE + MAIN MENU', icon: 'puff', price: 0, desc: 'YOUR COINS + GEAR ARE SAVED. COME BACK ANYTIME' }];
  const goods = [...ups, ...uses, ...SHOP];
  const tab = SHOP_TABS[shopTab];
  return [...nav, ...(all || tab === 'ALL' ? goods : goods.filter(g => SHOP_TAB_OF[g.kind] === tab))];
}
function itemStatus(it) {
  if (it.kind === 'weapon' && save.weapons.includes(it.id)) return 'OWNED';
  if (it.kind === 'armor' && save.armor.includes(it.id)) return 'OWNED';
  if (it.kind === 'item' && save.pouch) return 'OWNED';
  if (it.kind === 'use' && save[it.id] >= MAX_ITEM + (Net.color === 3 && it.id === 'munchie' ? 1 : 0)) return 'MAX ' + (MAX_ITEM + (Net.color === 3 && it.id === 'munchie' ? 1 : 0));
  if (it.kind === 'upgrade' && wlv(it.id) >= 3) return 'MAXED';
  if (it.kind === 'ammo' && save.throws[it.id] >= 60) return 'FULL';
  if (it.kind === 'farm') { if (save.farm) return 'YOURS!'; if (save.spots < SPOTS_TO_FARM) return 'LOCKED'; }
  if (it.kind === 'ready') return readyInfo && readyInfo.me ? 'WAITING ' + readyInfo.n + '/' + readyInfo.of : '';
  return null;
}
function updateShop() {
  if (results.statsScreen) { if (K.enterPressed || K.jumpPressed) { results.statsScreen = false; openMap(); } return; }
  if (results.farmScene) { if (K.enterPressed || K.jumpPressed) { results.farmScene = false; if (results.endingStats) results.statsScreen = true; else if (results.shopOnly) openMap(); } return; }
  if (K.worldPrev || K.worldNext || K.nav === 'left' || K.nav === 'right') { shopTab = (shopTab + (K.worldNext || K.nav === 'right' ? 1 : -1) + SHOP_TABS.length) % SHOP_TABS.length; shopSel = 0; SFX.tick(); }
  K.worldPrev = K.worldNext = false;
  const list = shopEntries();
  if (K.upPressed) { shopSel = (shopSel - 1 + list.length) % list.length; SFX.tick(); }
  if (K.downPressed) { shopSel = (shopSel + 1) % list.length; SFX.tick(); }
  K.upPressed = K.downPressed = false;
  if (!(K.enterPressed || K.jumpPressed || K.attackPressed)) return;
  shopConfirm();
}
function shopConfirm() {
  if (results.statsScreen) { results.statsScreen = false; go(openMap); return; }
  if (results.farmScene) { results.farmScene = false; if (results.endingStats) results.statsScreen = true; else if (results.shopOnly) go(openMap); return; }
  const list = shopEntries();
  const it = list[shopSel];
  if (it.kind === 'quit') { persist(); location.href = location.pathname; return; }
  if (it.kind === 'ready') {
    if (Net.online && !results.shopOnly) { if (!readyInfo || !readyInfo.me) { Net.send({ t: 'ready' }); SFX.cp(); } }
    else go(openMap);
    return;
  }
  const st = itemStatus(it);
  if (st) { SFX.bump(); results.msg = st === 'LOCKED' ? 'REACH ' + SPOTS_TO_FARM + ' SMOKE SPOTS FIRST' : 'CANT BUY THAT'; return; }
  if (save.coins < it.price) { SFX.bump(); results.msg = 'NEED ' + (it.price - save.coins) + ' MORE HASH COINS'; return; }
  save.coins -= it.price;
  if (it.kind === 'weapon') { save.weapons.push(it.id); save.weapon = it.id; }
  else if (it.kind === 'armor') save.armor.push(it.id);
  else if (it.kind === 'item') save.pouch = true;
  else if (it.kind === 'use') save[it.id] = Math.min(MAX_ITEM + (Net.color === 3 && it.id === 'munchie' ? 1 : 0), save[it.id] + 1);
  else if (it.kind === 'upgrade') save.wlv[it.id] = wlv(it.id) + 1;
  else if (it.kind === 'ammo') save.throws[it.id] = (save.throws[it.id] || 0) + (it.id === 'papers' ? 10 : 5);
  else if (it.kind === 'farm') { save.farm = true; results.farmScene = true; SFX.flag(); }
  persist(); SFX.buy(); results.msg = 'BOUGHT ' + it.name + '!';
}
function drawShop() {
  ctx.fillStyle = '#1e122c'; ctx.fillRect(0, 0, W, H);
  if (results.statsScreen) {
    R(ctx, '#3a1a5a', 0, 0, W, H);
    text('THE ROAD TO THE FARM', W / 2, 10, '#ffd84a', 2, 'center');
    text('- CREDITS -', W / 2, 28, '#c8ffa0', 1, 'center');
    const st = save.stats, rows = [
      ['TOTAL HASH COINS EARNED', save.coins], ['BUZZKILLS TAKEN DOWN', st.kills], ['BOSSES BEATEN', st.bossesBeaten],
      ['BEST COMBO', st.bestCombo + 'x'], ['TIMES KNOCKED OUT', st.deaths], ['TIME PLAYED', Math.floor(st.playSec / 60) + 'm ' + (st.playSec % 60) + 's'],
    ];
    rows.forEach((rw, i) => { const y = 50 + i * 14; text(rw[0], W / 2 - 90, y, '#ffffff'); text(String(rw[1]), W / 2 + 90, y, '#c8ffa0', 1, 'right'); });
    text('THANKS FOR PLAYING KUSH QUEST', W / 2, H - 24, '#e4b3ff', 1, 'center');
    if (frame % 40 < 26) text('CLICK OR PRESS ENTER FOR THE MAP', W / 2, H - 10, '#8a809a', 1, 'center');
    hot(0, 0, W, H, () => shopConfirm());
    return;
  }
  if (results.farmScene) {
    const g = ctx; R(g, '#9ad8ff', 0, 0, W, 120); R(g, '#7fe07a', 0, 120, W, 72);
    for (let i = 0; i < 14; i++) g.drawImage(PLANT, 8 + i * 22, 110 + (i % 2) * 8);
    g.drawImage(ICONS.farm, W / 2 - 6, 60);
    hot(0, 0, W, H, () => shopConfirm());
    text('YOU BOUGHT THE POT FARM!', W / 2, 20, '#2a1838', 2, 'center');
    text('THE CREW NEVER HAS TO WORRY AGAIN', W / 2, 40, '#2a1838', 1, 'center');
    text('(KEEP PLAYING FOR MORE COINS + GEAR)', W / 2, 172, '#2a1838', 1, 'center');
    ctx.drawImage(PLAYER[me.color][0], W / 2 - 8, 100);
    return;
  }
  const r = results;
  if (r.shopOnly) { text('THE HEAD SHOP', W / 2, 6, '#c8ffa0', 2, 'center'); text('SPEND COINS ON GEAR... OR SAVE THEM FOR THE FARM', W / 2, 24, '#ffffff', 1, 'center'); }
  else {
  text(r.made ? 'SMOKE SPOT ' + (lvl.n + 1) + ' REACHED!' : 'MISSION OVER', W / 2, 4, r.made ? '#c8ffa0' : '#ff8a8a', 2, 'center');
  text('COINS +' + r.earned + '   STOLEN/LOST -' + r.lost + '   COOKED ' + r.cooked + '%   KOS ' + r.kills + (r.ultraBonus ? '   ULTRA x2!' : ''), W / 2, 18, '#ffffff', 1, 'center');
  }
  drawMap(38);
  // tabs
  let tx = 6;
  SHOP_TABS.forEach((t, i) => {
    const tw = t.length * 4 + 6;
    hot(tx, 58, tw, 8, () => { shopTab = i; shopSel = 0; SFX.tick(); });
    if (i === shopTab) R(ctx, '#4a3a60', tx, 58, tw, 8);
    text(t, tx + 3, 60, i === shopTab ? '#ffd84a' : '#8a809a');
    tx += tw + 2;
  });
  text('Q/E OR CLICK TO SWITCH TABS', W - 6, 60, '#8a809a', 1, 'right');
  // shop list
  text('HEAD SHOP', 8, 68, '#ffd84a', 1);
  text('YOUR STASH: ' + save.coins, W - 8, 68, '#ffd84a', 1, 'right');
  const list = shopEntries(), rows = 9, start = Math.max(0, Math.min(shopSel - 4, list.length - rows));
  for (let i = start; i < Math.min(list.length, start + rows); i++) {
    const it = list[i], y = 76 + (i - start) * 10, sel = i === shopSel, st = itemStatus(it);
    hot(4, y - 1, 190, 10, () => { if (shopSel === i) shopConfirm(); else { shopSel = i; SFX.tick(); } }, () => { shopSel = i; });
    if (sel) { R(ctx, '#4a3a60', 4, y - 1, 190, 10); R(ctx, '#c8ffa0', 4, y - 1, 2, 10); }
    const plain = it.kind === 'ready' || it.kind === 'quit';
    if (!plain) ctx.drawImage(ICONS[it.icon], 8, y - 1, 9, 9);
    text(it.name, plain ? 10 : 20, y + 1, it.kind === 'ready' ? '#c8ffa0' : it.kind === 'quit' ? '#ff9ab8' : st ? '#8a809a' : '#ffffff');
    if (!plain) text(st || it.price, 192, y + 1, st ? '#8a809a' : save.coins >= it.price ? '#ffd84a' : '#ff8a8a', 1, 'right');
    else if (st) text(st, 192, y + 1, '#e4b3ff', 1, 'right');
  }
  if (start > 0 && frame % 30 < 20) text('^ MORE', 150, 68, '#b0a8c0');
  if (start + rows < list.length && frame % 30 < 20) text('V MORE', 150, 176, '#b0a8c0');
  const it = list[shopSel];
  R(ctx, '#4a3a60', 202, 76, 112, 96);
  if (it.kind !== 'ready' && it.kind !== 'quit') ctx.drawImage(ICONS[it.icon], 246, 80, 20, 20);
  wrap(it.desc, 206, 106, 26, '#ffffff');
  if (it.kind === 'weapon') {
    const cur = weaponDef(), dd = it.dmg - cur.dmg, rd = it.reach - cur.reach;
    text('DMG ' + (dd >= 0 ? '+' : '') + dd + '  REACH ' + (rd >= 0 ? '+' : '') + rd, 206, 128, dd + rd >= 0 ? '#7fe07a' : '#ff8a8a');
  } else if (it.kind === 'armor') {
    const curHp = ARMORS.filter(a => save.armor.includes(a.id)).reduce((m, a) => Math.max(m, a.hp), 0), hd = it.hp - curHp;
    text('HEARTS ' + (hd >= 0 ? '+' : '') + hd, 206, 128, hd >= 0 ? '#7fe07a' : '#ff8a8a');
  }
  if (r.msg) wrap(r.msg, 206, 142, 26, '#ffd84a');
  const clerk = SHOPKEEP_LINES[Math.floor(frame / 300) % SHOPKEEP_LINES.length];
  text('SMOKEY:', 206, 160, '#e4b3ff'); wrap('"' + clerk + '"', 206, 168, 26, '#ffffff');
  text('MOUSE: CLICK TWICE TO BUY   KEYS: UP/DOWN + ENTER   ESC: MAP', W / 2, 183, '#8a809a', 1, 'center');
}
function wrap(str, x, y, width, col) {
  const words = String(str).split(' '); let line = '';
  for (const w of words) { if ((line + w).length > width) { text(line, x, y, col); y += 8; line = ''; } line += w + ' '; }
  if (line) text(line, x, y, col);
}
// ============================================================
//  MAIN LOOP (fixed 60 updates / second)
// ============================================================
let last = 0, acc = 0, lastBg = 0;
// browsers pause requestAnimationFrame in background tabs; keep the game (and the host's enemies) running anyway
setInterval(() => {
  if (!running || !document.hidden) { lastBg = 0; return; }
  const now = performance.now(); if (!lastBg) lastBg = now;
  let steps = Math.min(120, Math.floor((now - lastBg) / (1000 / 60)));
  lastBg += steps * (1000 / 60);
  while (steps-- > 0) update();
}, 100);
document.addEventListener('visibilitychange', () => { last = 0; acc = 0; if (master) master.gain.value = (document.hidden && settings.muteHidden) ? 0 : settings.sfx; });
function loop(t) {
  if (!last) last = t;
  acc += Math.min(100, t - last); last = t;
  pollGamepad();
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(loop);
}
// ---- Gamepad: mirror standard-mapping buttons onto real key events, so every
// existing keyboard-driven system (menus, nav, actions) works unchanged. ----
let gpState = {};
function gpDispatch(code, down) { if (!code) return; try { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, repeat: false })); } catch (e) {} }
function pollGamepad() {
  if (chatOpen || rebinding) return;
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null; for (const p of pads) if (p) { gp = p; break; }
  if (!gp) return;
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const ax = gp.axes || [];
  const map = {
    dUp: b(12) || ax[1] < -0.5, dDown: b(13) || ax[1] > 0.5, dLeft: b(14) || ax[0] < -0.5, dRight: b(15) || ax[0] > 0.5,
    jump: b(0), attack: b(2), throw_: b(1), quick: b(3), weapon: b(4), throwsel: b(5), munchie: b(6), run: b(7), bag: b(8), esc: b(9),
  };
  const codes = {
    dUp: 'ArrowUp', dDown: 'ArrowDown', dLeft: 'ArrowLeft', dRight: 'ArrowRight', esc: 'Escape',
    jump: settings.keys.jump, attack: settings.keys.attack, throw_: settings.keys.throw, quick: settings.keys.quick,
    weapon: settings.keys.weapon, throwsel: settings.keys.throwsel, munchie: settings.keys.munchie, run: settings.keys.run, bag: settings.keys.bag,
  };
  for (const k in map) {
    const was = gpState[k], now = !!map[k];
    if (now !== was) gpDispatch(codes[k], now);
    gpState[k] = now;
  }
}

// ============================================================
//  THROWABLES (secondary attack with ammo)
// ============================================================
const THROWS = [
  { id: 'papers', name: 'ROLLING PAPERS', dmg: 1, desc: 'FAST THROWING STARS. PIERCE 2 ENEMIES', pack: 10, price: 30 },
  { id: 'bombs', name: 'NUG BOMBS', dmg: 3, desc: 'LOB IT. BIG SMOKY BOOM HITS A CROWD', pack: 5, price: 60 },
];
ICONS.papers = sprite(['...k...', '..kwk..', '.kwWwk.', 'kwWwWwk', '.kwWwk.', '..kwk..', '...k...']);
ICONS.bombs = sprite(['....kk...', '...kEEk..', '..kGGGGk.', '.kGLGGGGk', '.kGGpGGGk', '.kGGGGoGk', '..kGGGGk.', '...kkkk..']);
function throwItem() {
  if (state !== 'play' || me.throwCd > 0) return;
  if (!hasSkill('throw')) { popup(me.x - 30, sy(me.z) - 34, 'A BOSS WILL TEACH YOU TO THROW', '#ff8a8a'); me.throwCd = 30; return; }
  const t = THROWS.find(t => t.id === save.throwSel) || THROWS[0];
  if (!(save.throws[t.id] > 0)) { const other = THROWS.find(o => save.throws[o.id] > 0); if (other) { save.throwSel = other.id; return throwItem(); } popup(me.x - 20, sy(me.z) - 34, (save.throws.papers || save.throws.bombs) ? 'OUT OF ' + t.name : 'NO THROWABLES YET', '#ff8a8a'); SFX.bump(); me.throwCd = 20; return; }
  save.throws[t.id]--; me.throwCd = t.id === 'bombs' ? 40 : 16; me.atkT = 8;
  const perkDmg = Net.color === 3 ? 1 : 0;
  if (t.id === 'papers') for (const dz of hasSkill('twothrow') ? [-7, 7] : [0]) shots.push({ mine: true, kind: 7, x: me.x + me.face * 8, z: me.z + dz, h: me.h + 10, vx: me.face * 5, life: 45, dmg: 1 + (me.buffs.power > 0 ? 1 : 0) + perkDmg, pierce: 2, hit: new Set() });
  else shots.push({ mine: true, kind: 8, x: me.x + me.face * 6, z: me.z, h: me.h + 14, vx: me.face * 2.4, vh: 3, life: 200, dmg: 3 + (ultra() ? 1 : 0) + perkDmg, hit: new Set() });
  SFX.jump();
  Net.send({ t: 'fx', k: t.id === 'papers' ? 7 : 8, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
}
function explode(s) {
  shake = 8; hitstop = 3; SFX.stomp(); if (AC) noise(0.4, 0.12, AC.currentTime, 300);
  puff(s.x, sy(s.z, 4), 30, ['#ffffff', '#e8e4f4', '#c8ffa0', '#7fe07a', '#d4c8f8'], 2.6, -0.03);
  if (!s.mine) return;
  for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - s.x) < 30 && Math.abs(e.z - s.z) < 16) hitEnemy(e, s.dmg, Math.sign(e.x - s.x) || 1, true);
  for (const p of lvl.props) if (!p.broken && Math.abs(p.x - s.x) < 30 && Math.abs(p.z - s.z) < 16) breakProp(p);
}

// ============================================================
//  WORLD MAP (procedural, dithered, weirdly realistic 8-bit terrain)
// ============================================================
const MW = 400;
// each world's map has the same road layout; the stops look like that world's areas
function mapNodes(w) {
  const L = k => ({ kind: 'level', n: w * LEVELS_PER_WORLD + k });
  return [
    { ...L(0), x: 84, y: 138 }, { ...L(1), x: 70, y: 70 }, { ...L(2), x: 140, y: 104 }, { kind: 'shop', x: 184, y: 142 },
    { ...L(3), x: 226, y: 100 }, { ...L(4), x: 312, y: 134, mega: true },
    w === 0 ? { kind: 'farm', x: 350, y: 82 } : { kind: 'gate', to: (w + 1) % WORLDS.length, x: 350, y: 82 },
  ];
}
let curWorld = 0, MAP_NODES = mapNodes(0);
const maxWorld = () => Math.min(WORLDS.length - 1, worldOf(Math.min(save.spots, TOTAL_LEVELS - 1)));
function setWorld(w) { curWorld = Math.max(0, Math.min(maxWorld(), w)); MAP_NODES = mapNodes(curWorld); if (!(MAP_NODES[mapSel] && nodeUnlocked(MAP_NODES[mapSel]))) mapSel = 0; }
let mapSel = 0, mapCanvas = null, mapWater = null, mapRoads = [], storyPage = 0, briefT = 0;
const mapCache = {};
function useMap(w) { if (!mapCache[w]) { const nodesWas = MAP_NODES; MAP_NODES = mapNodes(w); const c = buildMapCanvas(w); mapCache[w] = { c, water: mapWater, roads: mapRoads }; MAP_NODES = nodesWas; } mapCanvas = mapCache[w].c; mapWater = mapCache[w].water; mapRoads = mapCache[w].roads; return mapCanvas; }
function nodeUnlocked(nd) {
  if (nd.kind === 'level') return nd.n <= save.spots;
  if (nd.kind === 'gate') return save.spots >= (curWorld + 1) * LEVELS_PER_WORLD;
  if (nd.kind === 'shop') return true;
  return save.spots >= SPOTS_TO_FARM;
}
function buildMapCanvas(w = 0) {
  const c = document.createElement('canvas'); c.width = MW; c.height = H; const g = c.getContext('2d');
  // value noise
  let sd = WORLDS[w].map.seed; const rnd2 = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const GRID = 24, gw = Math.ceil(MW / GRID) + 2, gh = Math.ceil(H / GRID) + 2, lat = [];
  for (let o = 0; o < 4; o++) { lat[o] = []; for (let i = 0; i < gw * gh * (1 << o) * (1 << o); i++) lat[o].push(rnd2()); }
  const vnoise = (x, y, o) => {
    const sc = GRID / (1 << o), W2 = gw * (1 << o), xi = Math.floor(x / sc), yi = Math.floor(y / sc), fx = x / sc - xi, fy = y / sc - yi;
    const L = lat[o], v = (a, b) => L[(b * W2 + a) % L.length];
    const sx = fx * fx * (3 - 2 * fx), sy2 = fy * fy * (3 - 2 * fy);
    return (v(xi, yi) * (1 - sx) + v(xi + 1, yi) * sx) * (1 - sy2) + (v(xi, yi + 1) * (1 - sx) + v(xi + 1, yi + 1) * sx) * sy2;
  };
  const fbm = (x, y) => vnoise(x, y, 0) * 0.5 + vnoise(x, y, 1) * 0.28 + vnoise(x, y, 2) * 0.15 + vnoise(x, y, 3) * 0.07;
  const bump = (x, y, cx, cy, r, amt) => { const d = Math.hypot(x - cx, (y - cy) * 1.2) / r; return d < 1 ? amt * (1 - d * d) : 0; };
  const height = (x, y) => {
    const dx = (x - MW / 2) / 185, dy = (y - H / 2 - 4) / 86, mask = 1 - Math.min(1, Math.sqrt(dx * dx + dy * dy));
    let h = fbm(x, y) * 0.5 + mask * 0.75 - 0.08;
    h += bump(x, y, 46, 58, 38, -0.35);   // the beach cove
    h += bump(x, y, 350, 80, 40, 0.25);   // farm hill
    h += bump(x, y, 285, 55, 45, 0.12);   // wooded highlands
    h += bump(x, y, 105, 150, 10, -0.2);  // park pond
    return h;
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bands = [
    [0.00, '#1c3a6e'], [0.22, '#24508c'], [0.30, '#2e6aa8'], [0.36, '#4a8ec4'], [0.40, '#e8d8a0'],
    [0.44, '#a8c870'], [0.52, '#7aa858'], [0.62, '#5a8a48'], [0.72, '#8a8a6a'], [0.80, '#a8a494'], [0.88, '#e8eef0'],
  ];
  const img = g.createImageData(MW, H), d = img.data, hex = hcol => [parseInt(hcol.slice(1, 3), 16), parseInt(hcol.slice(3, 5), 16), parseInt(hcol.slice(5, 7), 16)];
  const bandCols = bands.map(b => hex(b[1]));
  mapWater = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < MW; x++) {
    let h = height(x, y);
    // light from the top-left: compare with the neighbour for relief shading
    const shade = (h - height(x + 1, y + 1)) * 6;
    let i = 0; while (i < bands.length - 1 && h >= bands[i + 1][0]) i++;
    const lo = bands[i][0], hi = i < bands.length - 1 ? bands[i + 1][0] : 1;
    const t = (h - lo) / (hi - lo), th = BAYER[(y & 3) * 4 + (x & 3)] / 16;
    let col = bandCols[t > 0.72 + th * 0.28 && i < bands.length - 1 ? i + 1 : i].slice();
    if (h > 0.40) { const k = Math.max(-0.18, Math.min(0.18, shade)); col = col.map(v => Math.max(0, Math.min(255, v * (1 + k)))); }
    if (h < 0.40 && h > 0.375 && BAYER[(y & 3) * 4 + (x & 3)] < 5) col = [220, 240, 255]; // foam at the shore
    if (h < 0.36 && (x + y) % 5 === 0) mapWater.push(x, y);
    const o = (y * MW + x) * 4; d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const dot = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  let r3 = 99; const rr = () => (r3 = (r3 * 16807) % 2147483647) / 2147483647;
  // ROADS: real roads with a dashed center line
  mapRoads = [];
  for (let i = 0; i < MAP_NODES.length - 1; i++) {
    const a = MAP_NODES[i], b = MAP_NODES[i + 1], mx = (a.x + b.x) / 2 + (i % 2 ? 10 : -10), my = (a.y + b.y) / 2 + (i % 2 ? -8 : 8), pts = [];
    for (let k = 0; k <= 40; k++) { const t = k / 40, x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mx + t * t * b.x, y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * my + t * t * b.y; pts.push([x, y]); }
    mapRoads.push(pts);
    for (const [x, y] of pts) { g.fillStyle = '#2a2838'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5); }
    for (const [x, y] of pts) { g.fillStyle = '#5a5870'; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3); }
    pts.forEach(([x, y], k) => { if (k % 4 < 2) dot(Math.round(x), Math.round(y), '#e8c84a'); });
  }
  if (w > 0) { // other worlds: each stop gets a little cluster that looks like its area
    MAP_NODES.forEach(nd => {
      if (nd.kind !== 'level') return;
      const base = THEMES[themeKeyFor(nd.n)].base || themeKeyFor(nd.n), x = nd.x, y = nd.y - 12;
      for (let k = 0; k < 7; k++) {
        const px = x - 14 + (k * 9) % 28, py = y - 8 + (k * 7) % 14;
        if (base === 'woods') { for (let q = 0; q < 8; q++) { g.fillStyle = q % 3 ? '#2a5a34' : '#1e3e28'; g.fillRect(px - Math.floor(q / 2), py + q, Math.floor(q / 2) * 2 + 1, 1); } }
        else if (base === 'beach' || base === 'park') { g.fillStyle = '#9a6a42'; g.fillRect(px, py, 1, 6); g.fillStyle = '#3fae5a'; g.fillRect(px - 3, py - 1, 7, 2); }
        else if (base === 'city') { const hh = 6 + (k * 5) % 10; g.fillStyle = '#2a1838'; g.fillRect(px - 1, py - hh, 6, hh + 5); g.fillStyle = '#4a3a70'; g.fillRect(px, py - hh + 1, 4, hh + 3); g.fillStyle = '#ffd84a'; g.fillRect(px + 1, py - hh + 3, 1, 1); }
        else if (base === 'suburb') { g.fillStyle = '#2a1838'; g.fillRect(px - 1, py - 1, 6, 5); g.fillStyle = '#f4ece8'; g.fillRect(px, py, 4, 3); g.fillStyle = '#c84860'; g.fillRect(px - 1, py - 1, 6, 1); }
        else { g.fillStyle = '#2a1838'; g.fillRect(px - 1, py - 10, 8, 15); g.fillStyle = '#8a86a8'; g.fillRect(px, py - 9, 6, 13); g.fillStyle = '#e03b3b'; g.fillRect(px, py - 10, 6, 2); }
      }
    });
    if (WORLDS[w].map.tint) { g.globalAlpha = WORLDS[w].map.tint[1]; g.fillStyle = WORLDS[w].map.tint[0]; g.fillRect(0, 0, MW, H); g.globalAlpha = 1; }
    return c;
  }
  // THE PARK: round trees, a pond, paths
  for (let k = 0; k < 16; k++) { const x = 60 + rr() * 50, y = 122 + rr() * 34; if (Math.hypot(x - 105, y - 150) < 12) continue; g.fillStyle = '#1e4a2a'; g.fillRect(Math.round(x) - 2, Math.round(y) - 1, 5, 4); g.fillStyle = rr() < .3 ? '#e890b0' : '#5ab860'; g.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 3); dot(Math.round(x) - 1, Math.round(y) - 2, '#c8f0a0'); }
  // THE BEACH COVE: umbrellas, a pier
  for (let k = 0; k < 5; k++) { const x = 62 + k * 7, y = 80 + (k % 2) * 4; g.fillStyle = ['#ff5a6a', '#ffd84a', '#7ac8ff'][k % 3]; g.fillRect(x - 2, y - 2, 5, 2); dot(x, y, '#6a4428'); }
  g.fillStyle = '#8a5a3a'; g.fillRect(40, 62, 18, 2); for (let x = 40; x < 58; x += 3) dot(x, 64, '#5a3a24');
  // SUBURBIA: little houses in rows along streets
  for (let row = 0; row < 3; row++) {
    g.fillStyle = '#6a6880'; g.fillRect(118, 92 + row * 10, 46, 1);
    for (let k = 0; k < 6; k++) { const x = 120 + k * 8, y = 88 + row * 10; g.fillStyle = '#2a1838'; g.fillRect(x - 1, y - 1, 6, 5); g.fillStyle = '#f4ece8'; g.fillRect(x, y, 4, 3); g.fillStyle = ['#c84860', '#6a5ac8', '#4a8a5a'][(k + row) % 3]; g.fillRect(x - 1, y - 1, 6, 1); dot(x + 1, y + 1, '#ffd84a'); g.fillStyle = '#6aae5a'; g.fillRect(x, y + 4, 4, 1); }
  }
  // HEAD SHOP: a little purple shack with a neon leaf
  g.fillStyle = '#2a1838'; g.fillRect(178, 134, 13, 9); g.fillStyle = '#9a5ae8'; g.fillRect(179, 135, 11, 7); g.fillStyle = '#7fe07a'; g.fillRect(183, 132, 3, 3); dot(184, 131, '#c8ffa0');
  // DOWNTOWN: a street grid of towers casting long shadows
  for (let gx = 0; gx < 6; gx++) for (let gy = 0; gy < 4; gy++) {
    const x = 204 + gx * 8, y = 86 + gy * 8, hgt = 3 + Math.floor(rr() * 8);
    g.fillStyle = 'rgba(20,16,40,.45)'; g.fillRect(x + 2, y + 2, 6 + hgt / 2, 5);
    g.fillStyle = '#3a3458'; g.fillRect(x, y - hgt, 6, 5 + hgt); g.fillStyle = '#5a5480'; g.fillRect(x, y - hgt, 6, 2);
    for (let w = 0; w < hgt; w += 2) if (rr() < .6) dot(x + 1 + Math.floor(rr() * 4), y - hgt + 2 + w, '#ffd84a');
  }
  // MISTY WOODS: dense dithered pines + fog
  for (let k = 0; k < 140; k++) { const x = 250 + rr() * 64, y = 40 + rr() * 42; if (Math.hypot((x - 282) / 34, (y - 62) / 22) > 1) continue; g.fillStyle = rr() < .5 ? '#1e3e28' : '#2a5a34'; g.fillRect(Math.round(x), Math.round(y), 2, 3); dot(Math.round(x), Math.round(y) - 1, '#3a7a44'); }
  g.fillStyle = 'rgba(230,240,240,.18)'; for (let k = 0; k < 6; k++) g.fillRect(252 + k * 4, 50 + k * 5, 50, 2);
  // BUZZKILL HQ: one grey tower with a huge shadow and a red logo
  g.fillStyle = 'rgba(20,16,40,.5)'; for (let k = 0; k < 18; k++) g.fillRect(314 + k, 140 - k / 3, 10, 2);
  g.fillStyle = '#2a1838'; g.fillRect(305, 112, 14, 30); g.fillStyle = '#8a86a8'; g.fillRect(306, 113, 12, 28); g.fillStyle = '#b8b4d0'; g.fillRect(306, 113, 3, 28);
  for (let y = 116; y < 138; y += 3) for (let x = 309; x < 317; x += 3) dot(x, y, '#7ab8e8');
  g.fillStyle = '#e03b3b'; g.fillRect(305, 109, 14, 4);
  // THE FARM: crop rows on the hill + a red barn + silo
  for (let y = 70; y < 98; y += 3) for (let x = 330; x < 374; x++) if (Math.hypot((x - 352) / 24, (y - 84) / 16) < 1) dot(x, y, (x + y) % 7 ? '#8ad060' : '#6aa848');
  g.fillStyle = '#2a1838'; g.fillRect(343, 70, 12, 9); g.fillStyle = '#c83838'; g.fillRect(344, 71, 10, 7); g.fillStyle = '#ffffff'; g.fillRect(348, 74, 2, 4);
  g.fillStyle = '#8a8aa0'; g.fillRect(356, 67, 4, 11); g.fillStyle = '#c8c8d8'; g.fillRect(356, 66, 4, 2);
  return c;
}
function nodeLabel(nd) {
  if (nd.kind === 'shop') return 'HEAD SHOP';
  if (nd.kind === 'gate') return nd.to === 0 ? 'BACK HOME' : 'ON TO WORLD ' + (nd.to + 1) + ': ' + WORLDS[nd.to].name;
  if (nd.kind === 'farm') return 'THE POT FARM';
  return missionName(nd.n)[0] + ' ' + missionName(nd.n)[1];
}
// ---- Online lobby: shown right after create/join, before the map ----
function openLobby() { state = 'lobby'; lobbySel = 0; }
let lobbySel = 0;
function updateLobby() {
  if (!Net.online) { go(openMap); return; } // solo never lands here
  const rows = lobbyRows();
  if (K.nav === 'up') lobbySel = (lobbySel + rows.length - 1) % rows.length;
  if (K.nav === 'down') lobbySel = (lobbySel + 1) % rows.length;
  if (K.nav) SFX.tick();
  if ((K.jumpPressed || K.enterPressed || K.attackPressed) && rows[lobbySel]) rows[lobbySel].act();
}
function lobbyRows() {
  const isH = Net.hostId === Net.id;
  const rows = [{ label: (Net.readySet && Net.readySet.has(Net.id)) ? "I'M READY (CANCEL)" : "I'M READY", act: () => { Net.send({ t: 'ready' }); (Net.readySet = Net.readySet || new Set()).add(Net.id); SFX.cp(); } }];
  if (isH) rows.push({ label: 'START NOW (SKIP READY-UP)', act: () => { Net.send({ t: 'start' }); } });
  rows.push({ label: 'COPY INVITE LINK', act: copyInviteLobby });
  rows.push({ label: 'BACK TO MAIN MENU', act: () => { persist(); location.href = location.pathname; } });
  return rows;
}
function copyInviteLobby() {
  const link = location.origin + '/?room=' + Net.code;
  (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(() => { lobbyMsg = 'COPIED! PASTE IT TO YOUR FRIENDS'; }, () => { lobbyMsg = link; });
}
let lobbyMsg = '';
function drawLobby() {
  ctx.fillStyle = 'rgba(26,16,38,.96)'; ctx.fillRect(0, 0, W, H);
  text('WAITING ROOM', W / 2, 10, '#c8ffa0', 2, 'center');
  text('ROOM CODE', W / 2, 26, '#b0a8c0', 1, 'center');
  text(Net.code, W / 2, 34, '#ffd84a', 2, 'center');
  const ready = Net.readySet || new Set();
  const all = [{ id: Net.id, name: Net.name, color: Net.color, host: Net.hostId === Net.id }, ...[...remotes].map(([id, r]) => ({ id, name: r.name, color: r.color, host: Net.hostId === id }))];
  let y = 54;
  for (const pl of all) {
    R(ctx, P.k, 30, y - 1, W - 60, 12); R(ctx, '#4a3a60', 31, y, W - 62, 10);
    text((pl.host ? '[HOST] ' : '') + pl.name, 36, y + 2, SHIRTS[pl.color] || '#fff');
    text(ready.has(pl.id) ? 'READY' : 'WAITING...', W - 34, y + 2, ready.has(pl.id) ? '#7fe07a' : '#b0a8c0', 1, 'right');
    if (Net.hostId === Net.id && pl.id !== Net.id) hot(W - 30, y - 1, 24, 12, () => Net.send({ t: 'kick', id: pl.id }));
    if (Net.hostId === Net.id && pl.id !== Net.id) text('X', W - 22, y + 2, '#ff8a8a');
    y += 15;
  }
  y += 8;
  const rows = lobbyRows();
  rows.forEach((row, i) => {
    hot(30, y - 1, W - 60, 12, () => { lobbySel = i; row.act(); }, () => { lobbySel = i; });
    text(row.label, W / 2, y + 2, i === lobbySel ? '#ffd84a' : '#ffffff', 1, 'center');
    y += 14;
  });
  if (lobbyMsg) text(lobbyMsg, W / 2, y + 6, '#c8ffa0', 1, 'center');
  text('THE HOST CAN START ANY TIME. EVERYONE ELSE: HIT READY', W / 2, H - 10, '#8a809a', 1, 'center');
}
function openMap() {
  state = 'map'; results = null; banner = null; invOpen = false;
  setWorld(maxWorld());
  const next = MAP_NODES.findIndex(nd => nd.kind === 'level' && nd.n === Math.min(save.spots, TOTAL_LEVELS - 1));
  mapSel = next < 0 ? 0 : next;
}
function updateMap() {
  const canDrive = !Net.online || isHost();
  if (canDrive) {
    let dir = 0;
    if (K.nav) {
      const cur = MAP_NODES[mapSel], score = i => { const n = MAP_NODES[i]; if (!n) return -1e9; const dx = n.x - cur.x, dy = n.y - cur.y; return K.nav === 'right' ? dx : K.nav === 'left' ? -dx : K.nav === 'up' ? -dy : dy; };
      const a = score(mapSel - 1), b = score(mapSel + 1);
      dir = Math.max(a, b) <= 0 ? 0 : a > b ? -1 : 1;
      if (!dir) SFX.bump();
    }
    if (dir) {
      const to = mapSel + dir;
      if (to >= 0 && to < MAP_NODES.length && nodeUnlocked(MAP_NODES[to])) { mapSel = to; SFX.tick(); Net.send({ t: 'mapsel', i: mapSel }); }
      else SFX.bump();
    }
    if (K.jumpPressed || K.enterPressed || K.attackPressed) {
      const nd = MAP_NODES[mapSel];
      if (nd.kind === 'level') { if (Net.online) Net.send({ t: 'pick', n: nd.n }); else go(() => startLevel(nd.n)); SFX.cp(); }
      else if (nd.kind === 'shop') go(openShop);
      else if (nd.kind === 'gate') { go(() => { setWorld(nd.to); mapSel = 0; Net.send({ t: 'mapsel', i: 0, w: curWorld }); }); }
      else if (nd.kind === 'farm') {
        if (save.farm) { results = { shopOnly: true, farmScene: true }; state = 'results'; }
        else if (save.coins >= FARM_PRICE) {
          save.coins -= FARM_PRICE; save.farm = true; persist(); SFX.flag();
          showDialogue([
            { name: 'GRANDMA KUSH', text: 'YOU DID IT, SWEETIES. THE FARM IS OURS - FOR GOOD THIS TIME.' },
            { name: 'GRANDMA KUSH', text: "MR. KILLJOY CAN PAVE A PARKING LOT SOMEWHERE ELSE." },
            { name: 'GRANDMA KUSH', text: 'NOW SIT DOWN AND LET AN OLD LADY ROLL YOU ALL ONE.' },
          ], () => { results = { shopOnly: true, farmScene: true, endingStats: true }; state = 'results'; });
        }
        else { banner = { t: 120, a: 'NOT ENOUGH HASH COINS', b: 'THE FARM COSTS ' + FARM_PRICE + ' - YOU HAVE ' + save.coins }; SFX.bump(); }
      }
    }
    if (K.worldPrev || K.worldNext) { setWorld(curWorld + (K.worldNext ? 1 : -1)); SFX.tick(); Net.send({ t: 'mapsel', i: mapSel, w: curWorld }); }
  } else if (Net.mapCursor !== undefined) { if (Net.mapWorld !== undefined && Net.mapWorld !== curWorld) { curWorld = Net.mapWorld; MAP_NODES = mapNodes(curWorld); } mapSel = Net.mapCursor; }
  K.worldPrev = K.worldNext = false;
  if (K.shopPressed) go(openShop);
  K.nav = null; K.shopPressed = false;
}
function mapClick(gx, gy) {
  if (Net.online && !isHost()) return;
  const ox = Math.floor((W - MW) / 2), mx = gx - ox, my = gy;
  const i = MAP_NODES.findIndex(nd => Math.hypot(nd.x - mx, nd.y - my) < 11);
  if (i < 0) return;
  if (!nodeUnlocked(MAP_NODES[i])) { SFX.bump(); banner = { t: 90, a: 'LOCKED', b: 'BEAT THE STOP BEFORE IT FIRST' }; return; }
  if (i === mapSel) K.enterPressed = true; // second click on the same stop = go
  else { mapSel = i; SFX.tick(); Net.send({ t: 'mapsel', i }); }
}
function openShop() { results = { shopOnly: true, made: false }; state = 'results'; shopSel = 0; }
function drawMap_() {
  useMap(curWorld);
  const ox = Math.floor((W - MW) / 2);
  ctx.fillStyle = '#1c3a6e'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(ox, 0);
  ctx.drawImage(mapCanvas, 0, 0);
  // shimmering water
  for (let i = 0; i < mapWater.length; i += 2) if (((mapWater[i] * 7 + mapWater[i + 1] * 13 + (frame >> 3)) % 23) === 0) { ctx.fillStyle = '#8ac4f0'; ctx.fillRect(mapWater[i], mapWater[i + 1], 2, 1); }
  // cars driving the roads
  mapRoads.forEach((pts, i) => { for (let c = 0; c < 2; c++) { const t = ((frame * 0.15 + i * 13 + c * 20) % pts.length) | 0, [x, y] = pts[c ? pts.length - 1 - t : t]; ctx.fillStyle = ['#ff5a6a', '#ffffff', '#ffd84a', '#7ac8ff'][(i + c) % 4]; ctx.fillRect(Math.round(x) - 1 + c, Math.round(y) - 1, 2, 1); } });
  // drifting cloud shadows
  ctx.fillStyle = 'rgba(20,30,60,.16)';
  for (let k = 0; k < 3; k++) { const cx = ((frame * 0.12 + k * 160) % (MW + 120)) - 60, cy = 30 + k * 50; for (let y = -9; y <= 9; y++) { const w = Math.floor(Math.sqrt(81 - y * y) * 3.2); ctx.fillRect(Math.round(cx - w), cy + y, w * 2, 1); } }
  // birds
  for (let k = 0; k < 3; k++) { const bx = ((frame * 0.4 + k * 140) % (MW + 40)) - 20, by = 22 + k * 11 + Math.sin(frame / 20 + k) * 3, flap = (frame >> 3) % 2; ctx.fillStyle = '#2a1838'; ctx.fillRect(Math.round(bx) - 2, Math.round(by) - flap, 2, 1); ctx.fillRect(Math.round(bx) + 1, Math.round(by) - flap, 2, 1); ctx.fillRect(Math.round(bx), Math.round(by), 1, 1); }
  // smoke from the farm + the woods fog breathing
  if (frame % 14 === 0) particles.push({ x: 358, y: 64, vx: 0.1, vy: -0.25, life: 50, col: 'rgba(255,255,255,.7)', s: 2, g: 0, map: true });
  for (const p of particles) if (p.map) { p.x += p.vx; p.y += p.vy; ctx.fillStyle = p.col; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
  particles = particles.filter(p => !p.map || --p.life > 0);
  // stops
  MAP_NODES.forEach((nd, i) => {
    const open = nodeUnlocked(nd), done = nd.kind === 'level' && nd.n < save.spots, sel = i === mapSel;
    const col = nd.kind === 'shop' ? '#c070ff' : nd.kind === 'gate' ? '#7ac8ff' : nd.kind === 'farm' ? (save.farm ? '#7fe07a' : '#ffd84a') : done ? '#7fe07a' : nd.mega && open ? '#ff5a6a' : open ? '#ffd84a' : '#8a809a';
    const r = sel ? 5 + (frame % 30 < 15 ? 1 : 0) : 4;
    ctx.fillStyle = 'rgba(20,16,40,.4)'; ctx.fillRect(nd.x - r + 1, nd.y + r - 1, r * 2, 2);
    ctx.fillStyle = P.k; circle(nd.x, nd.y, r + 1); ctx.fillStyle = col; circle(nd.x, nd.y, r); ctx.fillStyle = '#ffffff'; ctx.fillRect(nd.x - 2, nd.y - 3, 2, 1);
    if (!open) { ctx.fillStyle = P.k; ctx.fillRect(nd.x - 1, nd.y - 1, 3, 3); }
    if (nd.kind === 'level') { if (open) drawStr((nd.n % LEVELS_PER_WORLD + 1) + '', nd.x - 1, nd.y - 2, P.k, 1); if (done) text('+', nd.x + 6, nd.y - 9, '#c8ffa0'); if (nd.mega) text('MEGA', nd.x, nd.y + 8, '#ff5a6a', 1, 'center'); }
    if (nd.kind === 'gate') text('WORLD ' + (nd.to + 1), nd.x, nd.y + 8, '#7ac8ff', 1, 'center');
  });
  const nd = MAP_NODES[mapSel], bob = Math.floor(frame / 15) % 2;
  for (const d of [-1, 1]) { const t = MAP_NODES[mapSel + d]; if (!t || !nodeUnlocked(t)) continue; const ang = Math.atan2(t.y - nd.y, t.x - nd.x), ax = nd.x + Math.cos(ang) * 15, ay = nd.y + Math.sin(ang) * 15; if (frame % 40 < 28) { R(ctx, P.k, Math.round(ax) - 2, Math.round(ay) - 2, 5, 5); R(ctx, '#ffffff', Math.round(ax) - 1, Math.round(ay) - 1, 3, 3); } }
  ctx.drawImage(PLAYER[me.color || 0][bob ? 1 : 0], nd.x - 8, nd.y - 24);
  let k = 0; for (const r of remotes.values()) { ctx.drawImage(PLAYER[r.color][0], nd.x - 20 - k * 10, nd.y - 22); k++; }
  ctx.restore();
  // room code box (online): always visible on the map
  if (Net.online) {
    R(ctx, 'rgba(26,16,38,.9)', 4, 20, 112, 34); R(ctx, '#e4b3ff', 4, 20, 112, 1);
    text('ROOM CODE', 10, 24, '#e4b3ff'); text(Net.code, 10, 32, '#ffffff', 2);
    text('ESC: COPY INVITE LINK', 10, 46, '#b0a8c0');
  }
  // header + info panel across the full width
  R(ctx, 'rgba(26,16,38,.85)', 0, 0, W, 16);
  text('WORLD ' + (curWorld + 1) + ' - ' + WORLDS[curWorld].name, 6, 5, '#c8ffa0');
  if (maxWorld() > 0) { const ax = Math.round(W / 2 + 30); hot(ax, 2, 12, 12, () => { setWorld(curWorld - 1); SFX.tick(); Net.send({ t: 'mapsel', i: mapSel, w: curWorld }); }); hot(ax + 14, 2, 12, 12, () => { setWorld(curWorld + 1); SFX.tick(); Net.send({ t: 'mapsel', i: mapSel, w: curWorld }); }); text('< >', ax + 1, 5, curWorld < maxWorld() ? '#ffd84a' : '#8a809a'); }
  { const bx = Math.round(W / 2 - 22); R(ctx, '#4a3a60', bx, 2, 44, 12); R(ctx, '#c8ffa0', bx, 2, 44, 1); text('MENU', W / 2, 5, '#ffffff', 1, 'center'); hot(bx, 2, 44, 12, () => openMenu()); }
  ctx.drawImage(COIN, W - 76, 3); text(save.coins + ' / ' + FARM_PRICE, W - 4, 5, '#ffd84a', 1, 'right');
  R(ctx, 'rgba(26,16,38,.92)', 0, H - 34, W, 34); R(ctx, '#c8ffa0', 0, H - 34, W, 1);
  text(nodeLabel(nd), 6, H - 30, '#ffd84a', 1);
  if (nd.kind === 'level') {
    const th = THEMES[themeKeyFor(nd.n)];
    const bd = BOSSES[nd.n % BOSSES.length];
    text(nd.n < save.spots ? 'CLEARED - REPLAY FOR COINS' : (bd[4] ? 'MEGA BOSS: ' : 'BOSS: ') + bd[0] + '  -  TEACHES: ' + SKILLS[bd[2]].name, 6, H - 21, nd.n < save.spots ? '#c8ffa0' : bd[4] ? '#ff8a8a' : '#ffffff');
    text('WATCH OUT:', 6, H - 12, '#b0a8c0');
    [...new Set(th.enemies)].forEach((e, i) => { const img = ENEMY_IMG[e][0]; ctx.drawImage(img, 50 + i * 12, H - 2 - Math.round(img.height * 0.5), Math.round(img.width * 0.5), Math.round(img.height * 0.5)); });
  } else if (nd.kind === 'shop') text('GEAR, AMMO + SNACKS. ANYONE CAN PRESS H ANYTIME ON THE MAP', 6, H - 21, '#ffffff');
  else text(save.farm ? 'YOU OWN IT. HOME SWEET HOME' : 'COSTS ' + FARM_PRICE + ' HASH COINS. YOU HAVE ' + save.coins, 6, H - 21, '#ffffff');
  drawChat();
  const hint = Net.online && !isHost() ? 'HOST PICKS   H SHOP   TAB BAG   ESC MENU' : 'ARROWS/CLICK PICK   SPACE GO   Q/E WORLD   H SHOP   ESC MENU';
  text(hint, W - 4, H - 10, '#c8ffa0', 1, 'right');
  if (banner) { R(ctx, 'rgba(42,24,56,.85)', 0, 70, W, 30); text(banner.a, W / 2, 74, '#ff8a8a', 2, 'center'); text(banner.b, W / 2, 90, '#fff', 1, 'center'); }
}

// ============================================================
//  STORY INTRO
// ============================================================
// Animated intro: four little scenes acted out by the real game sprites, with typewriter dialogue.
// SPACE skips to the next scene, ESC skips the whole intro.
// ---- generic dialogue box: portrait + name + typewriter text, used for briefings/cutscenes outside the intro ----
let dialog = null;
const DIALOG_COL = { 'GRANDMA KUSH': '#e4b3ff', 'MR. KILLJOY': '#ff5a6a', 'BUZZKILL CORP': '#ff5a6a' };
function showDialogue(lines, after) { dialog = { lines, i: 0, t: 0, after: after || null }; SFX.tick(); }
function updateDialogue() {
  dialog.t++;
  if (K.jumpPressed || K.enterPressed || K.attackPressed) {
    const ln = dialog.lines[dialog.i];
    if (dialog.t < ln.text.length * 1.4) dialog.t = ln.text.length * 1.4; // reveal instantly
    else { dialog.i++; dialog.t = 0; SFX.tick(); if (dialog.i >= dialog.lines.length) { const a = dialog.after; dialog = null; a && a(); } }
  }
  if (K.escPressed) { const a = dialog.after; dialog = null; a && a(); }
  K.escPressed = false;
}
function drawDialogue() {
  const ln = dialog.lines[dialog.i], shown = ln.text.slice(0, Math.floor(dialog.t / 1.4));
  ctx.fillStyle = 'rgba(20,12,32,.55)'; ctx.fillRect(0, 0, W, H);
  R(ctx, P.k, 20, H - 68, W - 40, 58); R(ctx, '#2a1838', 22, H - 66, W - 44, 54); R(ctx, '#c8ffa0', 22, H - 66, W - 44, 1);
  R(ctx, P.k, 26, H - 62, 26, 26); R(ctx, DIALOG_COL[ln.name] || SHIRTS[ln.color] || '#c070ff', 27, H - 61, 24, 24);
  text(ln.name.slice(0, 1), 39, H - 56, '#1a1026', 2, 'center');
  text(ln.name, 58, H - 60, DIALOG_COL[ln.name] || '#ffd84a', 1);
  wrap(shown, 58, H - 48, 46, '#ffffff');
  if (dialog.t >= ln.text.length * 1.4 && frame % 40 < 26) text(dialog.i < dialog.lines.length - 1 ? '▼ CONTINUE' : '▼ CLOSE', W - 28, H - 14, '#8a809a', 1, 'right');
  hot(20, H - 68, W - 40, 58, () => { K.enterPressed = true; updateDialogue(); K.enterPressed = false; });
}
const STORY = [
  { len: 540, lines: [[40, 0, 'BEST SMOKE SPOT IN TOWN. NO CAP.'], [200, 1, 'NOTHING COULD EVER RUIN THIS...'], [360, 3, 'PASS IT LEFT, HOMIE.']] },
  { len: 560, lines: [[60, 'BUZZKILL CORP', 'THIS PARK IS BUZZKILL CORP PROPERTY NOW - ORDERS OF MR. KILLJOY!'], [230, 'KAREN', 'I AM CALLING THE MANAGER OF THE PARK!'], [390, 2, 'THEY FLATTENED OUR COUCH, BRO!']] },
  { len: 520, lines: [[40, 'GRANDMA KUSH', 'MY OLD POT FARM IS FOR SALE, SWEETIES.'], [200, 'GRANDMA KUSH', FARM_PRICE + ' HASH COINS AND IT IS YOURS FOREVER.'], [360, 0, 'A SPOT NOBODY CAN EVER TAKE FROM US...']] },
  { len: 520, lines: [[40, 3, 'SO WE HIT EVERY SMOKE SPOT ON THE WAY...'], [190, 1, 'BEAT DOWN EVERY BUZZKILL...'], [340, 2, 'STACK HASH COINS AND BUY THE FARM. LETS ROLL!']] },
];
let storyT = 0;
function updateStory() {
  storyT++;
  const sc = STORY[storyPage];
  if (K.jumpPressed || K.enterPressed || K.attackPressed) { // finish the current line, or move to the next scene
    const cur = sc && sc.lines.filter(l => l[0] <= storyT).pop();
    if (cur && storyT - cur[0] < cur[2].length * 1.5) storyT = cur[0] + cur[2].length * 1.5;
    else { storyPage++; storyT = 0; SFX.tick(); }
  }
  if (sc && storyT > sc.len) { storyPage++; storyT = 0; }
  if ((K.escPressed || storyPage >= STORY.length) && !trans) { save.intro = true; persist(); go(openMap); storyPage = STORY.length; }
  K.escPressed = false;
}
function storyStreet(th, cam) {
  ctx.drawImage(th.sky, 0, 0);
  drawLayer(th.clouds, 0.1, cam, frame * 0.1, 0); drawLayer(th.far, 0.2, cam, 0, -78); drawLayer(th.near, 0.45, cam, 0, -80);
  if (!th.floor) th.floor = makeFloor('park', th.tiles);
  for (let X = -Math.floor(((cam % 64) + 64) % 64); X < W; X += 64) ctx.drawImage(th.floor, X, FLOOR_Y - 12);
}
function couch(x, y, flat) {
  if (flat) { R(ctx, P.k, x, y - 6, 60, 6); R(ctx, '#8a40c8', x + 1, y - 5, 58, 4); return; }
  R(ctx, P.k, x, y - 22, 60, 22); R(ctx, '#c070ff', x + 1, y - 21, 58, 20); R(ctx, '#e0a8ff', x + 1, y - 21, 58, 3); R(ctx, P.k, x + 4, y - 11, 52, 1);
}
function walker(i, x, y, face, moving, frameOff = 0) {
  const img = PLAYER[i][moving ? 1 + Math.floor((frame + frameOff) / 8) % 2 : 0];
  draw_(img, x + camX, y, face < 0);
}
function drawStory() {
  const sc = Math.min(storyPage, STORY.length - 1), t = storyT, th = THEMES.park, ground = sy(30) - 17;
  const saved = camX; camX = 0;
  if (sc === 0) { // the crew strolls in and chills on the couch
    storyStreet(th, t * 0.2);
    couch(130, sy(24));
    for (let i = 0; i < 4; i++) {
      const target = 128 + i * 15, x = Math.min(target, -30 - i * 22 + t * 1.1), sitting = x >= target;
      walker(i, x, sitting ? sy(24) - 30 : ground, 1, !sitting, i * 3);
    }
    if (t > 140) { const who = Math.floor((t - 140) / 90) % 4, jx = 136 + who * 15; R(ctx, '#ffffff', jx + 9, sy(24) - 22, 8, 2); R(ctx, '#ff9a3a', jx + 17, sy(24) - 22, 2, 2); if (frame % 6 === 0) puff(jx + 18, sy(24) - 24, 1, ['#ffffff', '#e8e4f4'], .3, -0.04); }
  } else if (sc === 1) { // bulldozer + buzzkills crash the party
    storyStreet(th, 40);
    const smash = t > 300, dz = Math.max(170, W + 20 - t * 0.9);
    couch(130, sy(24), smash);
    for (let i = 0; i < 4; i++) { const scared = t > 280, x = scared ? 128 + i * 15 - Math.min(80, (t - 280) * 1.4) : 128 + i * 15; walker(i, x, scared ? ground - (Math.abs(Math.sin((t + i * 20) / 8)) * 6) : sy(24) - 30, scared ? -1 : 1, scared); }
    const bx = dz + (t < 300 ? Math.sin(t / 6) : 0);
    R(ctx, P.k, bx, sy(30) - 42, 84, 42); R(ctx, '#ffd84a', bx + 1, sy(30) - 41, 82, 32); R(ctx, P.k, bx + 44, sy(30) - 58, 30, 18); R(ctx, '#8ecbff', bx + 46, sy(30) - 56, 26, 14);
    R(ctx, P.k, bx - 14, sy(30) - 36, 16, 34); R(ctx, '#9aa0b8', bx - 12, sy(30) - 34, 12, 30);
    for (let k = 0; k < 4; k++) { R(ctx, P.k, bx + 6 + k * 19, sy(30) - 12, 14, 12); R(ctx, '#5a5a78', bx + 8 + k * 19, sy(30) - 10, 10, 8); }
    R(ctx, '#ff5a6a', bx + 6, sy(30) - 36, 50, 10); text('BUZZKILL', bx + 10, sy(30) - 34, '#ffffff');
    if (smash && t < 320) shake = 8;
    if (t > 120) { draw_(ENEMY_IMG.cop[Math.floor(t / 20) % 2], Math.min(W - 40, W + 60 - (t - 120)), sy(40) - 18, true); }
    if (t > 170) { draw_(ENEMY_IMG.karen[t > 230 && t < 330 ? 1 : 0], Math.min(W - 64, W + 60 - (t - 170)), sy(34) - 18, true); }
    if (smash && frame % 3 === 0) puff(160, sy(24) - 8, 2, ['#c070ff', '#ffffff', '#e8e0d0'], 1.5);
  } else if (sc === 2) { // grandma kush shows the farm
    gradient(ctx, ['#9ad8ff', '#aee0ff', '#c2e8ff', '#d6eeff', '#e8f0ff', '#fff6d8', '#fff0c0', '#ffe8a8']);
    const pan = Math.min(60, t * 0.25);
    for (let y = 118; y < H; y += 8) { R(ctx, '#7fe07a', 0, y, W, 5); R(ctx, '#5ab860', 0, y + 5, W, 3); }
    for (let i = 0; i < 16; i++) ctx.drawImage(PLANT, 10 + i * 26 - pan, 106 + (i % 2) * 6 + Math.sin(frame / 20 + i) * 1);
    const bx = 220 - pan; R(ctx, P.k, bx, 66, 70, 50); R(ctx, '#e03b3b', bx + 1, 67, 68, 48); for (let k = 0; k < 20; k++) R(ctx, '#8a2020', bx - 2 + k * 1.5, 66 - k, 76 - k * 3, 1); R(ctx, '#ffffff', bx + 26, 90, 18, 26); R(ctx, P.k, bx + 34, 90, 2, 26);
    R(ctx, P.k, 100 - pan, 70, 72, 24); R(ctx, '#ffe0a0', 101 - pan, 71, 70, 22); text('FOR SALE', 118 - pan, 74, '#6a4428'); text(FARM_PRICE + ' COINS', 110 - pan, 84, '#6a4428'); R(ctx, P.k, 134 - pan, 94, 3, 26);
    ctx.drawImage(LEGENDS[1].img, 70, 100 + (frame % 40 < 20 ? 0 : 1));
    for (let i = 0; i < 4; i++) { const x = Math.min(20 + i * 12, -60 + t * 0.8 + i * 12); ctx.drawImage(PLAYER[i][x < 20 + i * 12 ? 1 + Math.floor(frame / 8) % 2 : 0], x, 104); }
    if (t > 400 && frame % 10 < 5) for (let k = 0; k < 3; k++) R(ctx, '#ff9ab8', 26 + k * 12 + Math.sin(frame / 5 + k) * 2, 94 - (t % 40) / 4, 3, 3);
  } else { // the journey: the crew walks the world map toward the farm
    useMap(0); MAP_NODES = mapNodes(0);
    const prog = Math.min(1, t / 440), seg = prog * (MAP_NODES.length - 1), si = Math.min(MAP_NODES.length - 2, Math.floor(seg)), f = seg - si;
    const a = MAP_NODES[si], b2 = MAP_NODES[si + 1], px = a.x + (b2.x - a.x) * f, py = a.y + (b2.y - a.y) * f;
    const ox = Math.round(W / 2 - px);
    ctx.fillStyle = '#1c3a6e'; ctx.fillRect(0, 0, W, H); ctx.drawImage(mapCanvas, ox, 0);
    for (let i = 0; i < 4; i++) ctx.drawImage(PLAYER[i][1 + Math.floor((frame + i * 4) / 8) % 2], px + ox - 20 + i * 9, py - 22 + (i % 2) * 2);
    const farm = MAP_NODES[MAP_NODES.length - 1]; if (frame % 30 < 20) text('THE FARM', farm.x + ox - 14, farm.y - 20, '#ffd84a');
  }
  camX = saved;
  // letterbox bars + title + dialogue box with typewriter text
  R(ctx, '#140c20', 0, 0, W, 18); R(ctx, '#140c20', 0, H - 40, W, 40);
  text(['THE CREW', 'THEN IT HAPPENED', 'A DREAM', 'THE PLAN'][sc], W / 2, 5, '#c8ffa0', 1, 'center');
  const line = STORY[sc].lines.filter(l => l[0] <= t).pop();
  if (line) {
    const who = typeof line[1] === 'number' ? LOOKS[line[1]].name : line[1], col = typeof line[1] === 'number' ? SHIRTS[line[1]] : '#ff9ab8';
    const shown = line[2].slice(0, Math.floor((t - line[0]) / 1.5));
    if (typeof line[1] === 'number') ctx.drawImage(PLAYER[line[1]][0], 6, H - 36);
    text(who + ':', 26, H - 34, col); text(shown, 26, H - 24, '#ffffff');
    if (shown.length < line[2].length && frame % 4 === 0) tone(700 + Math.random() * 200, 0.02, 'square', 0.015);
  }
  text('SPACE NEXT   ESC SKIP', W - 4, H - 9, '#6a6080', 1, 'right');
  for (let i = 0; i < STORY.length; i++) R(ctx, i === sc ? '#c8ffa0' : '#4a3a60', 6 + i * 8, H - 8, 6, 3);
}

// ============================================================
//  MISSION BRIEFING (shows before every mission)
// ============================================================
function drawBrief() {
  const th = lvl.theme;
  R(ctx, 'rgba(42,24,56,.9)', 30, 34, W - 60, 118); R(ctx, '#c8ffa0', 30, 34, W - 60, 1); R(ctx, '#c8ffa0', 30, 151, W - 60, 1);
  text(lvl.name[0], W / 2, 40, '#b0a8c0', 1, 'center');
  text(lvl.name[1], W / 2, 50, '#c8ffa0', 2, 'center');
  text('1. GET COOKED TO 50% - NUGS, SMOKE RINGS, KNOCKOUTS', 40, 72, '#ffffff');
  text('2. BEAT EACH WAVE OF BUZZKILLS', 40, 82, '#ffffff');
  text('3. CHILL AT THE SMOKE SPOT AT THE END', 40, 92, '#ffffff');
  { const bd = BOSSES[lvl.n % BOSSES.length]; text((bd[4] ? 'MEGA BOSS: ' : 'BOSS: ') + bd[0] + ' - BEAT HIM TO LEARN ' + SKILLS[bd[2]].name, 40, 104, bd[4] ? '#ff8a8a' : '#e4b3ff'); }
  const fresh = [...new Set(th.enemies)].find(k => !save.met.includes(k) && k !== 'mouse' && k !== 'squirrel' && k !== 'cop');
  if (fresh === 'karen') {
    R(ctx, '#4a2a40', 34, 112, W - 68, 38); ctx.drawImage(ENEMY_IMG.karen[1], 40, 116);
    text('NEW BUZZKILL: KAREN', 60, 115, '#ff9ab8');
    text('THROWS PURSES FROM AFAR. JUMP THEM (SPACE)', 60, 124, '#ffffff');
    text('THEN RUSH HER WHILE SHE CATCHES HER BREATH.', 60, 132, '#ffffff');
    text('ROLLING PAPERS (K) HIT HER FROM RANGE!', 60, 140, '#c8ffa0');
    return;
  }
  text('WATCH OUT FOR:', 40, 118, '#ffd84a');
  [...new Set(th.enemies)].forEach((e, i) => ctx.drawImage(ENEMY_IMG[e][0], 104 + i * 22, 132 - ENEMY_IMG[e][0].height));
  if (frame % 50 < 36) text(Net.online ? 'STARTING...' : 'PRESS SPACE TO START', W / 2, 140, '#fff6b0', 1, 'center');
}

// ============================================================
//  INVENTORY (the bag)
// ============================================================
let invRow = 0, invCol = 0;
const INV_ROWS = () => [
  { label: 'MELEE', items: WEAPONS.map(w => ({ kind: 'weapon', def: w, icon: ICONS[w.icon], has: save.weapons.includes(w.id), on: save.weapon === w.id })) },
  { label: 'THROW', items: THROWS.map(t => ({ kind: 'throw', def: t, icon: ICONS[t.id], has: save.throws[t.id] > 0, on: save.throwSel === t.id, count: save.throws[t.id] || 0 })) },
  { label: 'ARMOR', items: [...ARMORS.map(a => ({ kind: 'armor', def: a, icon: ICONS[a.icon], has: save.armor.includes(a.id), on: save.armor.includes(a.id) && maxHp() === 5 + a.hp })), { kind: 'armor', def: { name: 'STASH POUCH', desc: 'MICE + SQUIRRELS CANT STEAL' }, icon: ICONS.pouch, has: save.pouch, on: save.pouch }] },
  { label: 'ITEMS', items: Object.entries(ITEMS).map(([id, d]) => ({ kind: 'use', id, def: { name: d.name, desc: d.desc + '. SPACE: USE NOW. ' + KL('quick') + ': QUICK-USE' + (save.quick === id ? ' (SET)' : '') }, icon: ICONS[d.icon], has: save[id] > 0, count: save[id] || 0, on: save.quick === id })) },
];
function updateInventory() {
  const rows = INV_ROWS();
  if (K.nav === 'up') invRow = (invRow + rows.length - 1) % rows.length;
  if (K.nav === 'down') invRow = (invRow + 1) % rows.length;
  if (K.nav === 'left') invCol--; if (K.nav === 'right') invCol++;
  if (K.nav) SFX.tick();
  const row = rows[invRow]; invCol = (invCol + row.items.length) % row.items.length;
  if (K.jumpPressed || K.enterPressed || K.attackPressed) invConfirm();
  K.nav = null;
}
function invConfirm() {
  const row = INV_ROWS()[invRow];
  {
    const it = row.items[invCol];
    if (!it.has) SFX.bump();
    else if (it.kind === 'weapon') { save.weapon = it.def.id; persist(); SFX.buy(); }
    else if (it.kind === 'throw') { save.throwSel = it.def.id; persist(); SFX.buy(); }
    else if (it.kind === 'use') { save.quick = it.id; persist(); if (state === 'play') useItem(it.id); else SFX.buy(); }
  }
}
function drawInventory() {
  TQ.length = 0;
  R(ctx, '#2a1838', 8, 18, W - 16, H - 24); R(ctx, '#c8ffa0', 8, 18, W - 16, 1);
  text('YOUR BAG', 16, 23, '#c8ffa0', 2);
  text('CLICK OR ARROWS   CLICK AGAIN/SPACE EQUIP   TAB CLOSE', W - 16, 26, '#b0a8c0', 1, 'right');
  hot(W - 34, 18, 26, 12, () => { invOpen = false; });
  text('[X]', W - 20, 20, '#ff8a8a');
  const rows = INV_ROWS();
  rows.forEach((row, r) => {
    const y = 44 + r * 26;
    text(row.label, 16, y + 5, r === invRow ? '#ffd84a' : '#b0a8c0');
    row.items.forEach((it, c) => {
      const x = 56 + c * 22, sel = r === invRow && c === invCol;
      hot(x - 1, y - 1, 20, 20, () => { if (sel) invConfirm(); else { invRow = r; invCol = c; SFX.tick(); } }, () => { invRow = r; invCol = c; });
      R(ctx, sel ? '#ffd84a' : it.on ? '#7fe07a' : P.k, x - 1, y - 1, 20, 20); R(ctx, '#4a3a60', x, y, 18, 18);
      ctx.globalAlpha = it.has ? 1 : .2; ctx.drawImage(it.icon, x + 9 - Math.min(8, it.icon.width / 2), y + 9 - Math.min(8, it.icon.height / 2), Math.min(16, it.icon.width), Math.min(16, it.icon.height)); ctx.globalAlpha = 1;
      if (it.count !== undefined) text(it.count, x + 17, y + 12, '#ffffff', 1, 'right');
    });
  });
  const it = rows[invRow].items[invCol];
  R(ctx, '#4a3a60', 172, 42, W - 188, 98);
  text(it.has ? it.def.name : '??? LOCKED', 178, 48, it.has ? '#ffd84a' : '#8a809a');
  wrap(it.has ? it.def.desc : (it.def && it.def.id === 'blunt' ? 'FIND IT IN A CHEST - NOT SOLD IN SHOPS' : it.kind === 'use' ? 'BUY IT AT THE HEAD SHOP OR FIND IT IN A CHEST' : 'BUY IT AT THE HEAD SHOP'), 178, 60, 30, '#ffffff');
  if (it.kind === 'weapon' && it.has) { text('LV ' + wlv(it.def.id) + '   DAMAGE ' + (it.def.dmg + wlv(it.def.id) - 1), 178, 96, '#ff9ab8'); text('REACH ' + it.def.reach, 178, 106, '#9ae8ff'); }
  if (it.on) text('EQUIPPED', 178, 126, '#7fe07a');
  R(ctx, '#4a3a60', 16, 150, W - 32, 30);
  text('THE GOAL: BUY THE POT FARM', 22, 154, '#c8ffa0');
  text('SMOKE SPOTS ' + Math.min(save.spots, SPOTS_TO_FARM) + '/' + SPOTS_TO_FARM, W - 22, 154, '#ffffff', 1, 'right');
  R(ctx, P.k, 22, 166, W - 44, 7); R(ctx, '#ffd84a', 23, 167, Math.round((W - 46) * Math.min(1, save.coins / FARM_PRICE)), 5);
  text(save.coins + ' / ' + FARM_PRICE + ' HASH COINS', W / 2, 167, '#ffffff', 1, 'center');
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
          me.color = m.color; readyInfo = null;
          if (m.phase === 'lobby') openLobby();
          else if (m.phase === 'map') openMap();
          else if (m.phase === 'shop') { if (state !== 'results') toResults(); }
          else {
            if (m.level !== lvl.n || state === 'map' || state === 'results') startLevel(m.level);
            m.collected.forEach(id => applyCollected(id, m.level));
            if (state === 'sitting') Net.send({ t: 'fin', l: lvl.n });
          }
          banner = { t: 90, a: 'RECONNECTED!', b: '' };
        } else this.pendingCollected = m.collected.map(id => ({ id, l: m.level }));
        resolve();
      };
    });
  },
  doRejoin() { if (!this.rejoin) return; this.rejoin = false; banner = null; this.lost(); },
  lost() {
    this.online = false; this.ws = null; remotes.clear(); this.hostId = this.id;
    if (this.reconnecting) return;
    this.reconnecting = true;
    banner = { t: 120, a: 'CONNECTION LOST', b: 'TRYING TO RECONNECT...' };
    let tries = 0;
    const attempt = () => {
      if (this.online) return;
      if (++tries > 30) { this.reconnecting = false; banner = { t: 99999, a: 'DISCONNECTED', b: 'CLICK HERE OR PRESS ENTER TO REJOIN' }; this.rejoin = true; return; }
      this.connect({ t: 'join', code: this.code, name: this.name }).catch(() => setTimeout(attempt, 2500));
    };
    setTimeout(attempt, 1000);
  }
};
function addRemote(p) { remotes.set(p.id, { name: p.name, color: p.color, x: -1000, z: 30, h: 0, tx: -1000, tz: 30, th: 0, f: 1, a: 0, b: 0, l: -1, w: 0, c: 0, atkT: 0, emote: null, hp: 5, mh: 5 }); }
function onNet(m) {
  switch (m.t) {
    case 's': { const r = remotes.get(m.id); if (!r) return; if (r.tx < -500 || r.l !== m.l) { r.x = m.x; r.z = m.y; r.h = m.h; } Object.assign(r, { tx: m.x, tz: m.y, th: m.h, f: m.f, a: m.a, b: m.b, l: m.l, w: m.w, c: m.c, hp: m.hp, mh: m.mh }); break; }
    case 'fx': {
      const r = remotes.get(m.id); if (!r || r.l !== lvl.n) break;
      r.atkT = 12;
      if (m.k < 5) r.slash = { t: 12, max: 12, heavy: false, kind: (WEAPONS[m.k] || WEAPONS[0]).id, air: m.h > 6 };
      if (m.k === 9) { lvl.clouds.push({ x: m.x, z: m.y, r: m.h || 50, t: 360, heal: !!(m.f & 1), hot: !!(m.f & 2), by: m.id }); break; }
      if (m.k === 7) shots.push({ mine: false, kind: 7, x: m.x + m.f * 8, z: m.y, h: m.h + 10, vx: m.f * 5, life: 45 });
      if (m.k === 8) shots.push({ mine: false, kind: 8, x: m.x + m.f * 6, z: m.y, h: m.h + 14, vx: m.f * 2.4, vh: 3, life: 200 });
      if (m.k === 5) shots.push({ mine: false, x: m.x + m.f * 10, z: m.y, h: m.h + 8, vx: m.f * 3.6, life: 26, kind: 5 });
      break;
    }
    case 'es': if (!isHost()) applySnapshot(m); break;
    case 'hit': if (isHost() && m.l === lvl.n) { const e = lvl.enemies[m.i]; if (e && e.spawned) damageEnemy(e, m.d, m.dir, !!m.s, m.id, { burn: m.b, sp: m.sp, stun: m.st, bleed: m.bl, kb: m.kb || 1, hr: m.hr }); } break;
    case 'kill': if (m.l === lvl.n) { const e = lvl.enemies[m.i]; if (e) { e.stolen = m.st || 0; onKill(e, m.by); } } break;
    case 'eshot': if (m.l === lvl.n) lvl.eshots.push({ x: m.x, z: m.z, vx: m.vx, life: 150, spin: 0 }); break;
    case 'steal': if (isHost() && m.l === lvl.n) { const e = lvl.enemies[m.i]; if (e) thiefFlee(e, m.k); } break;
    case 'rev': if (m.who === Net.id && me.down > 0) { me.down = 0; me.hp = Math.ceil(maxHp() / 2); me.inv = 90; addCooked(10); banner = { t: 90, a: 'REVIVED!', b: 'YOUR HOMIE PASSED IT TO YOU' }; SFX.power(); } break;
    case 'pass': if (m.who === Net.id) { addCooked(20); popup(me.x - 24, sy(me.z) - 36, 'PUFF PUFF PASS!', '#e4b3ff'); SFX.power(); } break;
    case 'chat': { const r = remotes.get(m.id); if (r) { addChat(r.name, m.msg, SHIRTS[r.color]); r.say = { msg: m.msg.toUpperCase(), t: 300 }; } break; }
    case 'boss': if (m.l === lvl.n) bossIntro(lvl.enemies[m.i]); break;
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
    case 'allfin': readyInfo = null; go(toResults, true); break;
    case 'ready': readyInfo = { me: (readyInfo && readyInfo.me) || m.who === Net.id, n: m.n, of: m.of }; (Net.readySet = Net.readySet || new Set()).add(m.who); break;
    case 'level': go(() => startLevel(m.n)); break;
    case 'map': go(openMap); readyInfo = null; if (Net.readySet) Net.readySet.clear(); break;
    case 'mapsel': Net.mapCursor = m.i; Net.mapWorld = m.w; break;
    case 'emote': { const r = remotes.get(m.id); if (r) r.emote = { e: m.e % EMOTES.length, t: 120 }; break; }
    case 'kicked': persist(); banner = { t: 99999, a: 'REMOVED FROM THE ROOM', b: 'BY THE HOST - CLICK HERE TO GO TO THE MENU' }; Net.online = false; Net.kicked = true; break;
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
let slotSel = 0;
const CREW_NAMES = ['AK', 'LOG', 'G-RAT', 'ELIJAH', 'GRYPH', 'TG', 'OGMUDBONE'];
function renderNames() {
  const box = $('names'); box.innerHTML = '';
  for (const n of CREW_NAMES) {
    const b = document.createElement('button'); b.textContent = n; b.type = 'button';
    if (($('name').value || '').toUpperCase() === n) b.className = 'on';
    b.onclick = () => { $('name').value = n; renderNames(); };
    box.appendChild(b);
  }
}
$('name').addEventListener('input', renderNames);
setTimeout(renderNames, 0);
function renderSlots() {
  const box = $('slots'); box.innerHTML = '';
  for (let i = 1; i <= SLOT_COUNT; i++) {
    const d = readSlot(i), b = document.createElement('button');
    b.className = d ? 'slot' : 'slot empty';
    b.innerHTML = d
      ? '<b>SAVE ' + i + '</b><span>SMOKE SPOTS ' + Math.min(d.spots || 0, SPOTS_TO_FARM) + '/' + SPOTS_TO_FARM + ' &middot; ' + (d.coins || 0) + ' HASH COINS' + (d.farm ? ' &middot; FARM OWNER' : '') + '</span><small>CONTINUE' + (d.played ? ' &middot; LAST PLAYED ' + new Date(d.played).toLocaleDateString() : '') + '</small>'
      : '<b>SAVE ' + i + '</b><span>EMPTY</span><small>NEW GAME</small>';
    b.onclick = () => chooseSlot(i);
    box.appendChild(b);
    if (d) { const x = document.createElement('a'); x.className = 'del'; x.textContent = 'DELETE SAVE ' + i; x.onclick = () => { if (x.dataset.sure) { localStorage.removeItem('kq_save_v2_s' + i); renderSlots(); } else { x.dataset.sure = 1; x.textContent = 'CLICK AGAIN TO DELETE SAVE ' + i; } }; box.appendChild(x); }
  }
}
function chooseSlot(i) {
  slotSel = i; loadSlot(i);
  $('slotPanel').style.display = 'none'; $('modePanel').style.display = 'block';
  $('slotLabel').textContent = (readSlot(i) ? 'CONTINUING SAVE ' : 'NEW GAME ON SAVE ') + i;
  $('err').textContent = urlRoom ? 'ENTER YOUR NAME AND PRESS JOIN' : '';
  selectedChar = save.character || 0; if (typeof renderChars === 'function') renderChars();
}
function showSave() {}
$('back').onclick = () => { $('modePanel').style.display = 'none'; $('slotPanel').style.display = 'block'; renderSlots(); };
renderSlots();
function startGame() {
  initAudio();
  $('menu').style.display = 'none';
  document.body.classList.add('playing');
  running = true;
  if (Net.online && Net.phase === 'play') startLevel(Net.level);
  else if (Net.online && Net.phase === 'shop') { results = { made: false, earned: 0, lost: 0, spotBonus: 0, ultraBonus: 0, cooked: 0, kills: 0, best: 0, msg: 'CREW IS SHOPPING - JOIN THEM' }; state = 'results'; }
  else if (Net.online && Net.phase === 'lobby') openLobby();
  else if (!save.intro && !Net.online) { state = 'story'; storyPage = 0; storyT = 0; }
  else openMap();
  if (Net.online) setTimeout(() => { banner = { t: 150, a: 'ROOM CODE: ' + Net.code, b: 'ALWAYS ON THE MAP - ESC TO COPY THE INVITE LINK' }; }, 50);
  requestAnimationFrame(loop);
}
function busy(on) { ['solo', 'create', 'join'].forEach(id => $(id).disabled = on); }
async function goOnline(msg) {
  $('err').textContent = 'CONNECTING...'; busy(true);
  try { await Net.connect(msg); startGame(); }
  catch (e) { $('err').textContent = e.message.toUpperCase(); busy(false); }
}
let selectedChar = 0;
function renderChars() {
  const box = $('chars'); box.innerHTML = '';
  LOOKS.forEach((l, i) => {
    const b = document.createElement('button'); b.textContent = l.name; b.type = 'button';
    if (i === selectedChar) b.className = 'on';
    b.onclick = () => { selectedChar = i; save.character = i; persist(); if (!$('name').value || LOOKS.some(x => x.name === $('name').value.toUpperCase())) $('name').value = l.name; renderChars(); renderNames(); };
    box.appendChild(b);
  });
  $('charPerk').textContent = CHAR_PERKS[selectedChar].line;
}
selectedChar = save.character || 0;
renderChars();
$('solo').onclick = () => { Net.name = getName(); Net.color = selectedChar; startGame(); };
$('create').onclick = () => { Net.name = getName(); Net.color = selectedChar; goOnline({ t: 'create', name: Net.name, level: 0, color: selectedChar }); };
$('join').onclick = () => {
  const code = $('code').value.trim().toUpperCase();
  if (code.length < 5) { $('err').textContent = 'ENTER THE 5-LETTER ROOM CODE'; return; }
  Net.name = getName(); Net.color = selectedChar; goOnline({ t: 'join', code, name: Net.name, color: selectedChar });
};
$('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('join').click(); });
if ($('reset')) $('reset').onclick = () => { if ($('reset').dataset.sure) { save = defaultSave(); persist(); showSave(); $('reset').textContent = 'SAVE RESET'; delete $('reset').dataset.sure; } else { $('reset').dataset.sure = 1; $('reset').textContent = 'CLICK AGAIN TO WIPE YOUR SAVE'; } };
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) { $('code').value = urlRoom.toUpperCase().slice(0, 5); $('slotHint').textContent = 'YOUR FRIEND INVITED YOU TO ROOM ' + urlRoom.toUpperCase().slice(0, 5) + ' - PICK A SAVE TO PLAY WITH'; }

fit(); lvl = buildLevel(0); me = makePlayer(); camX = 0; draw();
window.__KQ = { openMenu: () => openMenu(), setMenu: (p, r) => { menu.page = p; rebinding = r; }, get camX() { return camX; }, get me() { return me; }, get lvl() { return lvl; }, get state() { return state; }, get save() { return save; }, get mouseG() { return mouseG; }, get dialog() { return dialog; }, K, remotes, Net, startLevel, toResults };
})();
