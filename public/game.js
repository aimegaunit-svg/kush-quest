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
  if (AC) { if (AC.state === 'suspended') AC.resume().catch(() => {}); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    // iOS Safari sometimes hands back a context that's still "suspended" even when created
    // inside a real tap/click handler (startGame() is always called from one) - resume it
    // explicitly rather than assuming the gesture alone unlocked it.
    if (AC.state === 'suspended') AC.resume().catch(() => {});
    master = AC.createGain(); master.gain.value = settings.sfx; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.2, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    startMusic();
  } catch (e) { AC = null; }
}
// belt-and-suspenders: any early tap/click before startGame() (or a later backgrounding on iOS
// that re-suspends the context) tries to resume it too, from inside a trusted gesture handler.
['touchend', 'mousedown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); }, { passive: true }));
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
  // v1.1 A6: world-specific enemy trick sounds
  taser: () => { tone(2400, 0.04, 'square', 0.05); tone(1900, 0.16, 'sawtooth', 0.05, 0.05, 0.35); },
  spray: () => { if (AC) noise(0.3, 0.06, AC.currentTime, 3500); },
  thud: () => tone(160, 0.12, 'square', 0.09, 0, 0.5),
  trap: () => tone(520, 0.09, 'square', 0.05, 0, 0.4),
  flash: () => { tone(1600, 0.06, 'square', 0.06); tone(2100, 0.1, 'square', 0.05, 0.05); },
  net: () => tone(220, 0.22, 'sawtooth', 0.06, 0, 0.6),
  drip: () => tone(900, 0.1, 'sine', 0.04, 0, 0.7),
  boom: () => { tone(150, 0.25, 'sawtooth', 0.09, 0, 0.3); if (AC) noise(0.2, 0.07, AC.currentTime, 500); },
  beep: () => tone(1300, 0.05, 'square', 0.05),
  blow: () => { if (AC) noise(0.22, 0.07, AC.currentTime, 1200); tone(200, 0.15, 'sawtooth', 0.05, 0, 0.6); },
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
  boss: { bpm: 160, div: 4, steps: 16, // Phase 8: a darker, slower variant of the fight theme for boss encounters
    roots: [38, 33, 36, 34],
    arp: [[62, 65, 69, 74], [57, 60, 65, 69], [60, 62, 67, 72], [58, 62, 65, 70]] },
  farm: { bpm: 96, div: 2, steps: 8, // Phase 8: a happier major-key variant of the calm theme for the Farm Hub
    chords: [[60, 64, 67, 72], [65, 69, 72, 76], [62, 65, 69, 74], [67, 71, 74, 79]],
    bass: [[36, -1, -1, 43, -1, -1, 40, -1], [41, -1, -1, 48, -1, -1, 45, -1], [38, -1, -1, 45, -1, -1, 41, -1], [43, -1, -1, 50, -1, 47, -1, 50]],
    lead: [[72, -1, -1, 76, 79, -1, 76, -1], [77, -1, -1, -1, 81, -1, 77, -1], [74, -1, 76, -1, 79, -1, 81, -1], [79, -1, -1, -1, 84, -1, -1, -1]] },
};
let musicMode = 'map', musicVol = 1, musicWant = 'map';
function wantedMusic() {
  if (state === 'results' && results && results.farmHub) return 'farm';
  if (state === 'map' || state === 'story') return 'map';
  if (state === 'play' && lvl && lvl.locked) return (lvl.boss && lvl.boss.alive) ? 'boss' : 'fight';
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
        if (musicMode === 'fight' || musicMode === 'boss') {
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
          const calm = musicMode === 'calm' || musicMode === 'farm';
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
const DEFAULT_KEYS = { toke: 'KeyV', up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', attack: 'KeyJ', throw: 'KeyK', run: 'ShiftLeft', munchie: 'KeyE', quick: 'KeyC', weapon: 'KeyQ', throwsel: 'KeyR', bag: 'Tab', chat: 'KeyT', block: 'ControlLeft', give: 'KeyG', yoink: 'KeyY' };
const ACTION_NAMES = { toke: 'SMOKE (TAP=SMALL, HOLD=BIG)', up: 'MOVE UP', down: 'MOVE DOWN', left: 'MOVE LEFT', right: 'MOVE RIGHT', jump: 'JUMP', attack: 'SWING', throw: 'THROW', run: 'RUN', munchie: 'MUNCHIES / REVIVE', quick: 'QUICK ITEM', weapon: 'SWITCH WEAPON', throwsel: 'SWITCH THROWABLE', bag: 'BAG', chat: 'CHAT', block: 'BLOCK (TAP=PARRY, HOLD+DIR=ROLL)', give: 'GIVE (HERE BRO) - HANDS A HOMIE YOUR QUICK ITEM', yoink: 'YOINK - YANKS THE NEAREST DROP TO YOU' };
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
  if (c === 'KeyG' && state === 'map') { K.dailyPressed = true; return; }
  if (c === 'KeyB' && state === 'map') { K.statsPressed = true; return; }
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
    if (a === 'give') { giveItem(); return; }
    if (a === 'yoink') { yoink(); return; }
    if (a === 'throw') { K.throwPressed = true; return; }
    if (a === 'toke') { K.toke = true; return; }
    if (a === 'block') { if (!K.block) me.parryT = 8; K.block = true; return; }
    if (a === 'throwsel') { const i = THROWS.findIndex(t => t.id === save.throwSel); save.throwSel = THROWS[(i + 1) % THROWS.length].id; persist(); popup(me.x - 20, sy(me.z) - 34, THROWS.find(t => t.id === save.throwSel).name, '#fff6b0'); return; }
    const em = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[c]; if (em !== undefined) { emote(em + (K.run ? 4 : 0)); return; }
  }
  if (['left', 'right', 'up', 'down', 'jump', 'attack', 'run', 'enter'].includes(a)) { e.preventDefault(); press(a, true); }
});
addEventListener('keyup', e => { const a = actionOf(e.code); if (a === 'munchie') K.use = false; if (a === 'toke') K.toke = false; if (a === 'block') K.block = false; if (['left', 'right', 'up', 'down', 'jump', 'attack', 'run', 'enter'].includes(a)) press(a, false); });
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
function canvasTapDown(clientX, clientY, button) {
  if (!running) return;
  const r = cv.getBoundingClientRect(), gx = (clientX - r.left) / r.width * W, gy = (clientY - r.top) / r.height * H;
  const r0 = hotAt(gx, gy); if (r0) { r0.click && r0.click(); return; }
  if (menu || state === 'results' || invOpen) return;
  if (state === 'story') { K.enterPressed = true; return; }
  if (state === 'map') { mapClick(gx, gy); return; }
  if (state === 'brief') { K.enterPressed = true; return; }
  if (button === 0) press('attack', true); else if (button === 2) K.throwPressed = true;
}
cv.addEventListener('mousedown', e => { e.preventDefault(); canvasTapDown(e.clientX, e.clientY, e.button); });
addEventListener('mouseup', e => { if (e.button === 0) press('attack', false); });
cv.addEventListener('contextmenu', e => e.preventDefault());
// Touch: don't rely on the browser's synthetic-mouse-from-tap fallback (unreliable once
// touch-action:none is set on the canvas/ancestors, which we need to stop scroll/zoom from
// eating the gesture) - drive the same tap logic straight from real touch events instead.
cv.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.changedTouches[0]; if (!t) return;
  canvasTapDown(t.clientX, t.clientY, 0);
}, { passive: false });
cv.addEventListener('touchend', e => { e.preventDefault(); press('attack', false); }, { passive: false });
cv.addEventListener('touchcancel', e => { press('attack', false); }, { passive: false });
cv.addEventListener('mousemove', e => {
  const r = cv.getBoundingClientRect(); mouseG = { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  const h = hotAt(mouseG.x, mouseG.y); if (h && h.hover) h.hover();
});
cv.addEventListener('wheel', e => { if (!running) return; e.preventDefault(); if (menu) return; if (state === 'results') { if (e.deltaY < 0) K.upPressed = true; else K.downPressed = true; } else if (state === 'play') cycleWeapon(); }, { passive: false });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => {
    e.preventDefault();
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
// ---- virtual joystick (replaces the old up/down/left/right button grid) ----
// Reuses the exact same K.left/right/up/down boolean flags (via press()) that keyboard/
// gamepad movement already drives, plus the same K.nav single-shot pulse that menu
// screens (map/lobby/results/inventory) read - so no movement or menu code needed to change.
(function () {
  const joyBase = document.getElementById('joyBase'), joyKnob = document.getElementById('joyKnob');
  if (!joyBase || !joyKnob) return;
  const JOY_MAX = 40, JOY_DEAD = 12;
  let joyId = null, ox = 0, oy = 0, curDirs = { up: false, down: false, left: false, right: false }, navDir = null;
  function dirsFor(dx, dy, dist) {
    const d = { up: false, down: false, left: false, right: false };
    if (dist < JOY_DEAD) return d;
    const deg = Math.atan2(dy, dx) * 180 / Math.PI;
    if (deg > -157.5 && deg < -22.5) d.up = true;
    if (deg > 22.5 && deg < 157.5) d.down = true;
    if (deg > 112.5 || deg < -112.5) d.left = true;
    if (deg > -67.5 && deg < 67.5) d.right = true;
    return d;
  }
  function apply(d) {
    const menuish = menu || state === 'map' || state === 'lobby' || state === 'story' || invOpen || state === 'results';
    if (menuish) {
      const dom = d.up ? 'up' : d.down ? 'down' : d.left ? 'left' : d.right ? 'right' : null;
      if (dom !== navDir) {
        navDir = dom;
        if (dom) {
          if (state === 'results') { if (dom === 'left' || dom === 'up') K.upPressed = true; else K.downPressed = true; }
          else if (K.nav) (K.navQ = K.navQ || []).push(dom); else K.nav = dom;
        }
      }
    } else {
      ['up', 'down', 'left', 'right'].forEach(k => { if (d[k] !== curDirs[k]) press(k, d[k]); });
    }
    curDirs = d;
  }
  function resetKnob() { joyKnob.style.left = '33px'; joyKnob.style.top = '33px'; }
  function endDrag() {
    joyBase.classList.remove('dragging'); resetKnob(); apply({ up: false, down: false, left: false, right: false });
    navDir = null; joyId = null;
  }
  joyBase.addEventListener('pointerdown', e => {
    e.preventDefault(); joyId = e.pointerId;
    const r = joyBase.getBoundingClientRect(); ox = r.left + r.width / 2; oy = r.top + r.height / 2;
    joyBase.classList.add('dragging');
    joyBase.setPointerCapture && joyBase.setPointerCapture(e.pointerId);
  });
  joyBase.addEventListener('pointermove', e => {
    if (joyId === null || e.pointerId !== joyId) return;
    e.preventDefault();
    const dx = e.clientX - ox, dy = e.clientY - oy, dist = Math.hypot(dx, dy), clamped = Math.min(dist, JOY_MAX), ang = Math.atan2(dy, dx);
    joyKnob.style.left = (33 + Math.cos(ang) * clamped) + 'px';
    joyKnob.style.top = (33 + Math.sin(ang) * clamped) + 'px';
    apply(dirsFor(dx, dy, dist));
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => joyBase.addEventListener(ev, e => {
    if (joyId === null || e.pointerId !== joyId) return;
    endDrag();
  }));
})();

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
  cloak: sprite(['..kkkk....', '.kppppk...', 'kpqpppqk..', 'kppwppwk..', 'kpqpppqk..', 'kppppppk..', '.kkkkkk...'], { ...P, p: '#7a2fc0', q: '#c070ff' }),
  // v1.2 (Step 9.3): FARM_UPGRADES/FARM_COSMETICS shop icons.
  hookah: sprite(['...kk.....', '..kvvk....', '..kvvk.kk.', '.kvvvkEk..', 'kvvvvkk...', 'kGGGGGk...', '.kkkkk....'], { ...P, v: '#3a8a6a' }),
  rollingtray: sprite(['kkkkkkkkkk', 'kEEEEEEEEk', 'kEwwwwwwEk', 'kEwGGGGwEk', 'kEwwwwwwEk', 'kkkkkkkkkk'], { ...P, E: '#8a5024' }),
  blacklight: sprite(['..kkkk....', '.kqqqqk...', 'kqqqqqqk..', 'kqPqqPqk..', 'kqqqqqqk..', '.kqqqqk...', '..kEEk....'], { ...P, q: '#7a2fc0', P: '#e4b3ff' }),
  tapestry: sprite(['kkkkkkkkkk', 'kyGyGyGyGk', 'kGyGyGyGyk', 'kyGyGyGyGk', 'k.k..k..kk', 'k..k..k...'], { ...P, y: '#ffd84a' }),
  lavalamp: sprite(['...kk.....', '..kGGk....', '.kGrrGk...', '.kGrrGk...', '..kGGk....', '..kEEk....', '.kEEEEk...'], { ...P, r: '#ff5a7a' }),
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
// v1.2 fix (Step 5): Brief v1.1 A2's 10-level Core tables group into 6 NAMED FORMS (levels 1-2, 3-4, 5-6,
// 7-8, 9, 10) - the form name, sprite tint and swing effects all change together at each tier boundary.
// Only the 4 real Cores (puff=Joint, lighter=Lighter, bong=Bong, grinder=Grinder) have a table; dab/blunt
// keep their old fixed name (they're not one of the brief's 4 Cores - see AGENT_NOTES for the flagged
// "Dab Saber's fate is undefined in v1.1" decision, unchanged by this step).
function coreTier(lv) { return lv <= 2 ? 0 : lv <= 4 ? 1 : lv <= 6 ? 2 : lv <= 8 ? 3 : lv === 9 ? 4 : 5; }
const CORE_FORMS = {
  puff: ['PINNER', 'JOINT', 'FATTY', 'BLUNT', 'CANNON', 'LEGENDARY DOOBIE'],
  lighter: ['BIC', 'ZIPPO', 'TORCH LIGHTER', 'JET FLAME', 'BLOWTORCH', "DRAGON'S BREATH"],
  bong: ['MINI BONG', 'GLASS BONG', 'DOUBLE CHAMBER', 'PERCOLATOR', 'GRAVITY BEAST', 'THE MOTHERSHIP'],
  grinder: ['POCKET GRINDER', '2-PIECE', '4-PIECE', 'ELECTRIC', 'INDUSTRIAL', 'KIEF CYCLONE'],
};
// tier-tinted glow color, used for the growing weapon aura + swing trail (see drawHeld/drawSlash) - the
// brief calls for a new sprite per form; a full hand-drawn set for 4 weapons x 6 forms is out of scope for
// this pass, so the "clearly visible" growth is carried instead by a per-tier glow color/size/particle
// count ramp applied uniformly to every Core (flagging this scope trim, same as prior steps).
const CORE_TIER_GLOW = ['', '#fff6b0', '#ffd84a', '#ff9a3a', '#ff5a6a', '#e4b3ff'];
function formName(wid, lv) { const f = CORE_FORMS[wid]; return f ? f[coreTier(lv)] : (WEAPONS.find(w => w.id === wid) || {}).name || ''; }
// environmental "Wild" weapons: temporary pickups that replace your weapon while held.
// v1.1 A3 (real pass): the brief's exact 12 named Wild weapons, each with real distinct stats built from
// the same {id,dmg,cd,reach,zr,kb,...} shape + special-case flags attack() already branches on
// (spin/pierce/homer/crit/bleed/stun/burn/blockProj). Ammo is now a shared Resin CHARGE bar instead of a
// flat "uses" count: `charge` is the max charge (in Resin units) a freshly-picked-up copy starts full at,
// `cost` is how much charge one swing drains. `infiniteCharge` (Apple Pipe) never drains at all - the
// brief's "joke weapon". A weapon at 0 charge is NOT dropped - it stays held but attacking just "clicks"
// (see attack()) until Resin (from enemy kills - see gainResin()) tops it back up. See WILD_POOL_BY_THEME
// below for which 3-4 worlds each one appears in, per the brief's table.
const ENV_WEAPONS = {
  bonghammer: { id: 'bonghammer', name: 'BONG HAMMER', dmg: 3, cd: 34, reach: 34, zr: 22, kb: 1.5, spin: 1, stun: 40, cost: 3, charge: 24, desc: 'GROUND-POUND SHOCKWAVE - STUNS EVERYTHING AROUND YOU' },
  bluntbat: { id: 'bluntbat', name: 'BLUNT BAT', dmg: 2, cd: 22, reach: 34, zr: 12, kb: 3, homer: 1, cost: 2, charge: 20, desc: 'HOME RUN! LAUNCHES THEM INTO THEIR BUDDIES' },
  rollingpapers: { id: 'rollingpapers', name: 'ROLLING PAPERS', dmg: 2, cd: 16, reach: 44, zr: 10, kb: 1, pierce: 1, cost: 1, charge: 18, desc: 'THROWING-STAR SPREAD THAT PIERCES THE WHOLE LINE' },
  nugbombs: { id: 'nugbombs', name: 'NUG BOMBS', dmg: 3, cd: 40, reach: 30, zr: 30, kb: 2, spin: 1, cost: 4, charge: 16, desc: 'LOBS A BIG SMOKY EXPLOSION' },
  dabtorch: { id: 'dabtorch', name: 'DAB TORCH', dmg: 2, cd: 12, reach: 28, zr: 10, kb: 1, burn: 2, cost: 1, charge: 22, desc: 'A SHORT FLAMETHROWER STREAM' },
  hackysack: { id: 'hackysack', name: 'HACKY SACK', dmg: 1, cd: 14, reach: 24, zr: 14, kb: 0.5, stun: 10, cost: 1, charge: 24, desc: 'JUGGLES THEM FOR COMBOS, BOUNCES RIGHT BACK TO YOU' },
  leafblower: { id: 'leafblower', name: 'LEAF BLOWER', dmg: 1, cd: 18, reach: 36, zr: 16, kb: 3, cost: 2, charge: 20, desc: 'BLOWS ENEMIES BACK (AND SMOKE CLOUDS AROUND)' },
  zippoflick: { id: 'zippoflick', name: 'ZIPPO FLICK', dmg: 2, cd: 24, reach: 48, zr: 8, kb: 1, burn: 3, cost: 2, charge: 18, desc: 'A THROWN FLAME - IGNITES SMOKE CLOUDS FROM RANGE' },
  hookahwhip: { id: 'hookahwhip', name: 'HOOKAH WHIP', dmg: 1, cd: 26, reach: 60, zr: 14, kb: 1, cost: 2, charge: 20, desc: 'HUGE REACH - PULLS ENEMIES IN CLOSE' },
  lavalampmace: { id: 'lavalampmace', name: 'LAVA LAMP MACE', dmg: 3, cd: 26, reach: 30, zr: 16, kb: 1.5, burn: 1, cost: 3, charge: 18, desc: 'HITS LEAVE HOT GOO PUDDLES BEHIND' },
  // v1.2 (Step 9.3): the brief's "gravity bong ultimate" - unlike every other Wild weapon it doesn't drain
  // Resin per swing (cost:0, charge:1 so the existing CHARGE X/Y bag display always just reads "READY"),
  // it can only be FIRED at Ultra (100% Cooked), and firing it spends the whole pickup for the rest of the
  // mission - see the `ultimate` flag's special-case in attack().
  gravitybongcannon: { id: 'gravitybongcannon', name: 'GRAVITY BONG CANNON', dmg: 12, cd: 90, reach: 999, zr: 999, kb: 0, cost: 0, charge: 1, ultimate: true, desc: 'ONLY FIRES AT ULTRA (100% COOKED) - ONE HUGE SCREEN-CLEARING BLAST, THEN IT\'S SPENT' },
  applepipe: { id: 'applepipe', name: 'APPLE PIPE', dmg: 1, cd: 18, reach: 22, zr: 10, kb: 1, cost: 0, charge: 0, infiniteCharge: true, desc: 'CHEAP AND WEAK. NEVER RUNS OUT (ITS A JOKE, OKAY)' },
};
// v1.2 fix (Step 1.4): Wild weapons have no dedicated icon art of their own - reuse the closest-themed
// existing MELEE/THROW icon so the Bag's WILD row always has a real image to draw (never a blank/crash).
const WILD_ICON_ID = { bonghammer: 'bong', bluntbat: 'blunt', rollingpapers: 'papers', nugbombs: 'bombs', dabtorch: 'dab', hackysack: 'grinder', leafblower: 'lighter', zippoflick: 'lighter', hookahwhip: 'bong', lavalampmace: 'bong', gravitybongcannon: 'bong', applepipe: 'joint' };
// v1.1 A3: per-world Wild-weapon pool (brief's table, minus Astral Plane which doesn't exist in this
// codebase yet - Gravity Bong Cannon is just available in HQ per the task instructions). A pickup rolls
// one random id from its theme's pool instead of always the same fixed weapon.
const WILD_POOL_BY_THEME = {
  park: ['bonghammer', 'bluntbat', 'rollingpapers', 'applepipe'],
  beach: ['rollingpapers', 'nugbombs', 'dabtorch', 'hackysack'],
  suburb: ['bonghammer', 'hackysack', 'leafblower'],
  city: ['bluntbat', 'zippoflick', 'hookahwhip'],
  woods: ['nugbombs', 'leafblower', 'zippoflick', 'lavalampmace'],
  hq: ['dabtorch', 'hookahwhip', 'lavalampmace', 'gravitybongcannon'],
};
// v1.1 A2: weapons are no longer individually leveled/bought - each homie's one permanent Core weapon
// levels 1-10 via save.cores[homie] (see CORE_HOMIE/CORE_WEAPON_ID + coreLevel(), defined near the save
// code above). wlv() keeps its old (id) signature for every existing call site, but now ignores id and
// always returns the current homie's Core level, since the only weapon ever equipped IS that Core weapon.
const wlv = id => id === CORE_WEAPON_ID[CORE_HOMIE[Net.color || 0]] ? coreLevel() : 1;
const WEAPON_LV3 = { // LV3 unique perks, unlocked on the upgrade to LV3
  puff: 'LV3 PERK: BURN LASTS 2X LONGER + HITS SOMETIMES DROP A SMOKE RING',
  lighter: 'LV3 PERK: BURN SPREADS FURTHER + LEAVES A BURNING FIRE PATCH',
  dab: 'LV3 PERK: CRITS CHAIN TO THE NEXT ENEMY IN LINE',
  bong: 'LV3 PERK: THE STUN SENDS A SHOCKWAVE THAT HITS EVERYONE NEARBY',
  grinder: 'LV3 PERK: THE SPIN PULLS ENEMIES IN HARDER BEFORE HITTING',
  blunt: 'LV3 PERK: LAUNCHED ENEMIES BOUNCE OFF WALLS INTO MORE ENEMIES',
};
const ARMORS = [
  { id: 'hoodie', name: 'COMFY HOODIE', icon: 'hoodie', hp: 1, price: 70, desc: '+1 MAX HEART' },
  { id: 'vest', name: 'TIE-DYE VEST', icon: 'vest', hp: 2, price: 170, desc: '+2 MAX HEARTS' },
  { id: 'crown', name: 'RASTA CROWN', icon: 'crown', hp: 3, price: 300, desc: '+3 MAX HEARTS' },
  // v1.2 (Step 9.3): the Smoke Cloak - top of the armor upgrade line. +4 hearts plus its own perk (see
  // hurt()'s `cloaked` branch): a bigger cover-smoke puff and a longer invincibility window when you're hit.
  { id: 'cloak', name: 'SMOKE CLOAK', icon: 'cloak', hp: 4, price: 450, desc: '+4 MAX HEARTS. GETTING HIT PUFFS YOU INTO COVER SMOKE FOR LONGER I-FRAMES' },
];
// v1.1 B1: the Farm node now sits after the last world (Buzzkill HQ / Mr. Killjoy), matching the brief's
// story beat ("then the Astral Plane after the ending") - so SPOTS_TO_FARM is now the full 49-level total,
// not just world 1. (Can't reference TOTAL_LEVELS here, it's declared later - kept as a literal in sync with
// WORLD_DEF's level counts: 6+7+8+9+9+10.) Anyone who already owns save.farm keeps it regardless.
// v1.1 B4: "Farm price: about 2500 coins" - raised from the old 1500. The gate stays spots>=SPOTS_TO_FARM
// (all 49 main levels, i.e. Killjoy's level beaten) AND coins>=FARM_PRICE, matching "the farm needs BOTH".
const FARM_PRICE = 2500, SPOTS_TO_FARM = 49;
// ---- Farm Hub (Phase 7): 4 plots growing passive-buff strains, + a farm pet ----
const STRAINS = [
  { id: 'sunny', name: 'SUNNY HAZE', desc: '+10% HASH COINS' },
  { id: 'chill', name: 'CHILL KUSH', desc: 'COOKED FADES 30% SLOWER' },
  { id: 'fire', name: 'FIRE OG', desc: '+1 BURN DURATION ON EVERY HIT' },
  { id: 'sticky', name: 'STICKY WIDOW', desc: '+15% CRIT CHANCE' },
  { id: 'giggle', name: 'GIGGLE GAS', desc: 'START EVERY MISSION AT +10% COOKED' },
];
const PETS = [
  { id: 'sproutly', name: 'SPROUTLY', metric: 'none', need: 0, desc: 'A LITTLE SEEDLING BUDDY. +5% HASH COINS' },
  { id: 'munchkin', name: 'MUNCHKIN', metric: 'bosses', need: 1, desc: '1 BOSS BEATEN. FREE MUNCHIE EVERY MISSION START' },
  { id: 'zippy', name: 'ZIPPY', metric: 'bosses', need: 3, desc: '3 BOSSES BEATEN. +10% MOVE SPEED' },
  { id: 'puffball', name: 'PUFFBALL', metric: 'bosses', need: 10, desc: '10 BOSSES BEATEN. +5% COOKED GAINS' },
  { id: 'kushling', name: 'KUSHLING', metric: 'kills', need: 100, desc: '100 KOs. +1 MAX HEART' },
];
function petUnlocked(p) { return p.metric === 'none' || (p.metric === 'bosses' ? save.stats.bossesBeaten : save.stats.kills) >= p.need; }
// ---- Phase 8: achievements ----
const ACHV = [
  { id: 'first_blood', name: 'FIRST BLOOD', desc: 'KNOCK OUT YOUR FIRST BUZZKILL', coins: 10, check: s => s.stats.kills >= 1 },
  { id: 'buzzkill_50', name: 'BUZZKILL BUSTER', desc: 'KNOCK OUT 50 BUZZKILLS', coins: 25, check: s => s.stats.kills >= 50 },
  { id: 'buzzkill_250', name: 'PUBLIC MENACE', desc: 'KNOCK OUT 250 BUZZKILLS', coins: 60, check: s => s.stats.kills >= 250 },
  { id: 'buzzkill_1000', name: 'ONE-STONER ARMY', desc: 'KNOCK OUT 1000 BUZZKILLS', coins: 150, check: s => s.stats.kills >= 1000 },
  { id: 'boss_1', name: 'FIRST BOSS DOWN', desc: 'BEAT YOUR FIRST BOSS', coins: 20, check: s => s.stats.bossesBeaten >= 1 },
  { id: 'boss_10', name: 'BOSS SLAYER', desc: 'BEAT 10 BOSSES', coins: 60, check: s => s.stats.bossesBeaten >= 10 },
  { id: 'boss_25', name: 'THE WHOLE CORP', desc: 'BEAT ALL 25 MAIN BOSSES', coins: 150, check: s => s.stats.bossesBeaten >= 25 },
  { id: 'combo_10', name: 'ON A ROLL', desc: 'HIT A 10x COMBO', coins: 15, check: s => s.stats.bestCombo >= 10 },
  { id: 'combo_25', name: 'UNSTOPPABLE FLOW', desc: 'HIT A 25x COMBO', coins: 40, check: s => s.stats.bestCombo >= 25 },
  { id: 'coins_1000', name: 'HASH HOARDER', desc: 'EARN 1000 HASH COINS LIFETIME', coins: 30, check: s => (s.stats.coinsEarned || 0) >= 1000 },
  { id: 'coins_10000', name: 'HASH TYCOON', desc: 'EARN 10000 HASH COINS LIFETIME', coins: 100, check: s => (s.stats.coinsEarned || 0) >= 10000 },
  { id: 'farm_owner', name: 'HOME SWEET HOME', desc: 'BUY GRANDMA THE FARM', coins: 50, check: s => s.farm },
  { id: 'all_weapons', name: 'ARMED AND DANGEROUS', desc: 'OWN ALL 6 WEAPONS', coins: 60, check: s => s.weapons.length >= 6 },
  { id: 'maxed_weapon', name: 'FULLY LOADED', desc: 'UPGRADE ANY WEAPON TO LV3', coins: 40, check: s => Object.values(s.wlv || {}).some(v => v >= 3) },
  { id: 'full_armor', name: 'RASTA ROYALTY', desc: 'WEAR THE RASTA CROWN', coins: 40, check: s => s.armor.includes('crown') },
  { id: 'pouch_owner', name: 'NOTHING TO STEAL', desc: 'BUY THE STASH POUCH', coins: 20, check: s => s.pouch },
  { id: 'daily_done', name: 'DAILY DRIVER', desc: 'BEAT A DAILY CHALLENGE', coins: 30, check: s => !!s.dailyDate },
  { id: 'spots_all', name: 'ROAD TRIP COMPLETE', desc: 'REACH EVERY SMOKE SPOT', coins: 200, check: s => s.spots >= TOTAL_LEVELS },
  { id: 'green_thumb', name: 'GREEN THUMB', desc: 'PLANT A STRAIN IN THE FARM', coins: 20, check: s => (s.farmPlots || []).some(p => p), },
  { id: 'pet_owner', name: 'BEST FRIENDS', desc: 'EQUIP A FARM PET', coins: 20, check: s => !!s.pet },
];
function checkAchv() {
  save.achv = save.achv || [];
  for (const a of ACHV) {
    if (save.achv.includes(a.id) || !a.check(save)) continue;
    save.achv.push(a.id); save.coins += a.coins;
    if (state === 'play') { banner = { t: 180, a: 'ACHIEVEMENT: ' + a.name, b: a.desc + ' (+' + a.coins + ' COINS)' }; SFX.power(); }
  }
}
function farmHas(strainId) { return (save.farmPlots || []).includes(strainId); }
const farmSpeedMul = () => (save.pet === 'zippy' ? 1.1 : 1);
// v1.2 (Step 9.3): farm UPGRADES (a small permanent perk each, bought once with coins - unlike STRAINS'
// plots, these aren't swappable) and pure-cosmetic farm decorations, both new Farm hub purchase lists.
// "Secret rooms" from the brief's Blacklight line is scoped down to a real, visible perk - an on-screen
// glow on any unbroken secret stash plus an off-screen compass hint (see drawProp/drawHUD) - rather than
// a new hidden-room level-geometry system, which is out of scope for this pass.
const FARM_UPGRADES = [
  { id: 'hookah', name: 'HOOKAH', price: 400, desc: '+5% COOKED FROM EVERYTHING' },
  { id: 'rollingtray', name: 'ROLLING TRAY', price: 350, desc: '+5% HASH COINS' },
  { id: 'blacklight', name: 'BLACKLIGHT', price: 500, desc: 'SECRET STASHES GLOW ON SCREEN + AN OFF-SCREEN HINT' },
];
const FARM_COSMETICS = [
  { id: 'tapestry', name: 'TAPESTRY', price: 150, desc: 'DECORATES THE FARM - PURELY FOR LOOKS' },
  { id: 'lavalamp', name: 'LAVA LAMP', price: 150, desc: 'DECORATES THE FARM - PURELY FOR LOOKS' },
];
function farmUpgradeHas(id) { return !!(save.farmUpgrades && save.farmUpgrades[id]); }
function farmCosmeticHas(id) { return !!(save.farmCosmetics && save.farmCosmetics[id]); }
// v1.1 A1: weapons and throwable ammo are no longer sold here - your Core weapon is fixed per-homie and
// levels with Resin (see the 'coreup' entry shopEntries() builds), and loose throwables are gone entirely
// (Wild weapons, still to come in A3, cover that role instead).
const SHOP = [
  ...ARMORS.map(a => ({ kind: 'armor', ...a })),
  { kind: 'item', id: 'pouch', name: 'STASH POUCH', icon: 'pouch', price: 130, desc: 'HALVES THEFT AMOUNT (THIEF GETS +1 BONUS COIN)' },
];
const SHOPKEEP_LINES = [
  'WELCOME BACK, LEGEND.', "DON'T SPEND IT ALL ON PAPERS.", 'THE GRINDER SPIN SLAPS, TRUST ME.',
  'YOU SMELL LIKE A GOOD MISSION.', 'SAVE UP FOR THE FARM, HOMIE.', 'BONG HAMMER ON SALE IN MY HEART.',
  "I DON'T MAKE THE PRICES, I JUST VIBE.", 'COME BACK WHEN YOU GOT MORE COINS.',
];
// rare bonus pickups: coins + a special effect
const EXTRAS = {
  shatter: { name: 'SHATTER', coins: 25, buff: 'dash', time: 600, desc: 'RUN KEY DASHES WITH I-FRAMES FOR 10s', img: sprite(['...kkk...', '..kYyOk..', '.kYyyyOk.', 'kYyYyyyOk', 'kyyyyOyyk', '.kyOyyyk.', '..kOyyk..', '...kkk...'], { ...P, y: '#ffb84a', Y: '#fff0b0', O: '#d8801a' }) },
  diamond: { name: 'DIAMONDS', coins: 50, cooked: 20, desc: '+50 COINS +20% COOKED', img: sprite(['..kkkkk..', '.kwvvvwk.', 'kvwvvvwvk', '.kvvwvvk.', '..kvvvk..', '...kvk...', '....k....'], { ...P, v: '#9ae8ff', w: '#ffffff' }) },
  kief: { name: 'KIEF', coins: 10, buff: 'magnet', time: 720, desc: 'ITEM MAGNET + DOUBLE COINS', img: sprite(['.........', '....y....', '...yYy...', '..yYyYy..', '.yyYyyYy.', 'kkkkkkkkk', 'kNNNNNNNk', '.kkkkkkk.'], { ...P, y: '#e8d070', Y: '#fff6c0' }) },
  hash: { name: 'HASH', coins: 20, buff: 'crit', time: 720, desc: 'HASH POWER! +25% CRIT CHANCE FOR 12s', img: sprite(['.kkkkkkk.', 'kNtNtNtNk', 'ktNtNtNtk', 'kNtNtNtNk', 'ktNtNtNtk', '.kkkkkkk.'], { ...P, t: '#a8703a', N: '#7a4a24' }) },
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
  enemies: ['karen', 'lawnmower', 'squirrel', 'lawnmower', 'cop'],
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
  enemies: ['cop', 'segway', 'mouse', 'karen', 'segway'],
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
  enemies: ['mouse', 'crab', 'crab', 'mouse', 'cop'],
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
  enemies: ['owl', 'squirrel', 'cop', 'owl', 'karen'],
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
  enemies: ['securitybot', 'karen', 'securitybot', 'karen', 'mouse'],
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
const BASE_AI = { ranger: 'cop', guard: 'cop', suit: 'karen', rat: 'mouse', raccoon: 'squirrel', crab: 'squirrel', lawnmower: 'cop', segway: 'cop', owl: 'squirrel', securitybot: 'cop', badtrip: 'cop', paranoia: 'karen' };
const VARIANT_HP = { ranger: 1, guard: 2, suit: 1, rat: 0, raccoon: 1, crab: 0, lawnmower: 2, segway: 1, owl: 1, securitybot: 2, badtrip: 1 };
{
  const tintSprites = (src, map) => src.map(img => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { const key = d.data[i] + ',' + d.data[i + 1] + ',' + d.data[i + 2]; if (map[key]) { d.data[i] = map[key][0]; d.data[i + 1] = map[key][1]; d.data[i + 2] = map[key][2]; } } g.putImageData(d, 0, 0); return c; });
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const swap = pairs => { const m = {}; for (const [f, t] of pairs) m[hex(f).join(',')] = hex(t); return m; };
  ENEMY_IMG.ranger = tintSprites(ENEMY_IMG.cop, swap([[P.d, '#4a7a3a'], [P.D, '#2e5a2a'], [P.y, '#c8a030']]));
  ENEMY_IMG.guard = tintSprites(ENEMY_IMG.cop, swap([[P.d, '#3a3a48'], [P.D, '#22222e'], [P.y, '#e8e8f0']]));
  ENEMY_IMG.suit = tintSprites(ENEMY_IMG.karen, swap([[P.p, '#5a5a78'], [P.q, '#3a3a58'], [P.h, '#4a3a2a'], [P.H, '#2a2018']]));
  ENEMY_IMG.rat = tintSprites(ENEMY_IMG.mouse, swap([[P.m, '#6a5a58'], [P.M, '#4a3a38'], [P.u, '#c86a6a']]));
  ENEMY_IMG.raccoon = tintSprites(ENEMY_IMG.squirrel, swap([[P.t, '#7a7a8a'], [P.T, '#4a4a58'], [P.y, '#e8e8f0']]));
  // new-per-world enemies (Phase 5): same base moves, new looks + a signature quirk applied elsewhere
  ENEMY_IMG.crab = tintSprites(ENEMY_IMG.squirrel, swap([[P.t, '#ff5a3a'], [P.T, '#c83018'], [P.y, '#ffd84a']])); // Beach: CRAB
  ENEMY_IMG.lawnmower = tintSprites(ENEMY_IMG.cop, swap([[P.d, '#3a8a3a'], [P.D, '#1e5a1e'], [P.y, '#c8a030']])); // Suburbia: LAWNMOWER DAD
  ENEMY_IMG.segway = tintSprites(ENEMY_IMG.cop, swap([[P.d, '#3a6a9a'], [P.D, '#1e3a6a'], [P.y, '#e8e8f0']])); // Downtown: MALL COP ON A SEGWAY
  ENEMY_IMG.owl = tintSprites(ENEMY_IMG.squirrel, swap([[P.t, '#8a6a4a'], [P.T, '#5a3a20'], [P.y, '#e8e0c8']])); // Misty Woods: OWL NARC
  ENEMY_IMG.securitybot = tintSprites(ENEMY_IMG.cop, swap([[P.d, '#2a2a3a'], [P.D, '#15151f'], [P.y, '#ff3a3a']])); // Buzzkill HQ: SECURITY BOT
  // v1.2 (Step 8): Astral Plane enemies (brief v0.9 Phase F). No new sprite art was built for these - they
  // alias existing base sprites with a shadowy/psychedelic recolor, same approach as every variant above.
  ENEMY_IMG.badtrip = tintSprites(ENEMY_IMG.cop, swap([[P.d, '#5a1a8a'], [P.D, '#2e0a58'], [P.y, '#ff6aff']])); // BAD TRIP: shadow-homie
  ENEMY_IMG.paranoia = tintSprites(ENEMY_IMG.cop, swap([[P.d, '#160a28'], [P.D, '#0a0414'], [P.y, '#ff2af0']])); // THE PARANOIA's body - the giant eye is drawn on top of this in drawEnemyB
  for (const k of ['ranger', 'guard', 'suit', 'rat', 'raccoon', 'crab', 'lawnmower', 'segway', 'owl', 'securitybot', 'badtrip', 'paranoia']) ENEMY_FLASH[k] = ENEMY_IMG[k].map(flashOf);
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
// v1.2 (Step 8): THE ASTRAL PLANE - the trippy end-game theme (brief v0.9 Phase F), unlocked once every
// world boss is graded S (astralUnlocked(), below). Built the same way every other reskin here is: a heavy
// tint over an existing base (DOWNTOWN's skyline, since its night palette reads well under a deep-purple
// wash) rather than new hand-painted art, and its own enemy kind (badtrip/paranoia, defined just above).
THEMES.astral = variantTheme('city', 'THE ASTRAL PLANE', '#8a2aff', 0.6, ['badtrip', 'badtrip', 'badtrip', 'badtrip']);
// ============================================================
//  v1.1 Part B1: 6 worlds, growing level counts, per-world mini-boss + boss + secret slot.
//  Table (brief v1.1 B1): World / Levels / Mini-boss at / Boss at / +1 secret
//   1 Park 6/3/6   2 Beach 7/4/7   3 Suburbia 8/4/8   4 Downtown 9/5/9   5 Misty Woods 9/5/9   6 Buzzkill HQ 10/5/10
//  = 49 main levels + 6 secret levels (one per world, appended after n=48 as n=49..54).
//  SIMPLIFICATION: hand-painting 6 fully distinct biomes x up to 10 levels each was out of scope for one
//  session, so each world reuses that base theme's existing palette-tinted variant reskins (already built
//  for the old 5-world "remix tour"), cycling through them to fill the level count. Same level number always
//  gets the same theme (deterministic), just not always a *unique* piece of art.
// ============================================================
const VARIANTS_OF = {
  park: ['park', 'island'],
  beach: ['beach', 'sunset', 'pier'],
  suburb: ['suburb', 'boardwalk', 'rooftops'],
  city: ['city', 'neon', 'alley', 'factory', 'penthouse'],
  woods: ['woods', 'nightwoods', 'swamp', 'mountain'],
  hq: ['hq', 'station', 'resort', 'club', 'casino', 'lobby', 'labs', 'vault'],
};
// mini-boss / boss are 1-indexed level numbers in the brief's table; converted to 0-indexed here.
const WORLD_DEF = [
  { name: 'THE PARK', base: 'park', count: 6, miniAt: 2, bossAt: 5, mini: 'PARK RANGER PETE', boss: 'RANGER RICK', map: { seed: 1337, tint: null } },
  { name: 'THE BEACH', base: 'beach', count: 7, miniAt: 3, bossAt: 6, mini: 'BEACH PATROL BARB', boss: 'LIFEGUARD LANCE', map: { seed: 777, tint: ['#ffb070', 0.2] } },
  { name: 'SUBURBIA', base: 'suburb', count: 8, miniAt: 3, bossAt: 7, mini: 'NEIGHBORHOOD WATCH NED', boss: 'HOA PRESIDENT PAM', map: { seed: 2024, tint: ['#1e4a2a', 0.15] } },
  { name: 'DOWNTOWN', base: 'city', count: 9, miniAt: 4, bossAt: 8, mini: 'BEAT COP BRUTUS', boss: 'NARC DRONE SWARM', map: { seed: 4200, tint: ['#1a0a3a', 0.5] } },
  { name: 'MISTY WOODS', base: 'woods', count: 9, miniAt: 4, bossAt: 8, mini: 'TRAIL WARDEN TESS', boss: 'THE FOREST NARC', map: { seed: 9002, tint: ['#0e2418', 0.35] } },
  { name: 'BUZZKILL HQ', base: 'hq', count: 10, miniAt: 4, bossAt: 9, mini: 'FLOOR MANAGER FRANK', boss: 'MR. KILLJOY', map: { seed: 9001, tint: ['#3a3a48', 0.4] } },
];
const WORLDS = WORLD_DEF.map(w => ({
  name: w.name, map: w.map, miniAt: w.miniAt, bossAt: w.bossAt, miniName: w.mini, bossName: w.boss,
  levels: Array.from({ length: w.count }, (_, i) => VARIANTS_OF[w.base][i % VARIANTS_OF[w.base].length]),
  secretTheme: VARIANTS_OF[w.base][VARIANTS_OF[w.base].length - 1],
}));
// one short cutscene per world transition (index = the world you're ENTERING), fired once per save in
// startLevel(). Index 0 (The Park) is skipped - that's the intro, already handled by the story sequence.
const WORLD_CUTSCENES = [
  null,
  [{ name: 'GRANDMA KUSH', text: 'RANGER RICK IS DOWN. NICE WORK, KIDDOS.' }, { name: 'GRANDMA KUSH', text: "NOW LET'S HIT THE BEACH BEFORE BUZZKILL CORP DOES." }],
  [{ name: 'GRANDMA KUSH', text: 'LANCE FOLDED LIKE A LAWN CHAIR. ONWARD!' }, { name: 'GRANDMA KUSH', text: 'SUBURBIA IS NEXT - WATCH OUT FOR THE HOA.' }],
  [{ name: 'GRANDMA KUSH', text: 'PAM AND HER BYLAWS CAN GO SIT ON A CACTUS.' }, { name: 'GRANDMA KUSH', text: 'DOWNTOWN IS CRAWLING WITH NARC DRONES NOW. STAY SHARP.' }],
  [{ name: 'GRANDMA KUSH', text: 'THAT DRONE SWARM DIDNT STAND A CHANCE.' }, { name: 'GRANDMA KUSH', text: 'THE MISTY WOODS ARE NEXT. SOMETHING IN THERE HUNTS BY SMELL.' }],
  [{ name: 'GRANDMA KUSH', text: 'THE FOREST NARC IS TOAST. ONE PLACE LEFT.' }, { name: 'GRANDMA KUSH', text: 'BUZZKILL HQ. KILLJOY HIMSELF. LETS FINISH THIS.' }],
];
// v1.1 B3: one unique co-op transit mini-game per world-gate (the trip TO that index's world), per the
// brief's table. Index 5 (Buzzkill HQ) has no entry - its gate leads to the Farm, not another world.
const WORLD_TRANSIT_GAMES = [
  { mod: window.LazyRiver, name: 'lazy river', world: 'park' },     // 0: Park -> Beach
  { mod: window.PaperPlane, name: 'paper plane', world: 'beach' },  // 1: Beach -> Suburbia
  { mod: window.MunchieTruck, name: 'munchie truck', world: 'suburb' }, // 2: Suburbia -> Downtown
  { mod: window.SmokeBalloon, name: 'smoke balloon', world: 'city' }, // 3: Downtown -> Woods
  { mod: window.BongRocket, name: 'bong rocket', world: 'woods' },  // 4: Woods -> HQ
];
const WORLD_START = (() => { const a = [0]; for (const w of WORLDS) a.push(a[a.length - 1] + w.levels.length); return a; })();
const TOTAL_LEVELS = WORLD_START[WORLDS.length]; // 49 main levels
const SECRET_BASE = TOTAL_LEVELS; // secret levels are n = 49..54, one per world, in world order
const TOTAL_LEVELS_WITH_SECRETS = TOTAL_LEVELS + WORLDS.length;
const isSecretLevel = n => n >= SECRET_BASE && n < TOTAL_LEVELS_WITH_SECRETS;
// v1.2 (Step 8): the Astral Plane (brief v0.9 Phase F) is one extra level living past every normal/secret
// level number, unlocked once astralUnlocked() is true (S grade on all 6 world bosses - see v1.1's tighter
// condition, which supersedes v0.9's "100% every mission"). It's reached from the Farm hub, not through
// mapNodes/a world gate, since it isn't part of any of the 6 worlds - see drawFarmHub/updateFarmHub.
const ASTRAL_LEVEL = TOTAL_LEVELS_WITH_SECRETS;
const isAstralLevel = n => n === ASTRAL_LEVEL;
const worldOf = n => {
  if (isAstralLevel(n)) return WORLDS.length - 1; // borrows the last world's numbering for skill-cap/HUD math; it has no world of its own
  if (isSecretLevel(n)) return n - SECRET_BASE;
  for (let w = 0; w < WORLDS.length; w++) if (n < WORLD_START[w + 1]) return w;
  return WORLDS.length - 1;
};
const levelInWorld = n => isSecretLevel(n) ? WORLDS[worldOf(n)].levels.length : n - WORLD_START[worldOf(n)];
const themeKeyFor = n => { if (isAstralLevel(n)) return 'astral'; const w = worldOf(n); return isSecretLevel(n) ? WORLDS[w].secretTheme : WORLDS[w].levels[levelInWorld(n)]; };
// v1.2 fix (Step 1.6): world/level progress label ("WORLD 2-3") to replace the old flat "SMOKE SPOTS x/49"
// text wherever it showed up (save slots, the Bag, the stats screen, the menu).
function progressLabel(spots) {
  if (spots >= TOTAL_LEVELS) return 'ALL WORLDS CLEARED';
  const n = Math.max(0, Math.min(spots, TOTAL_LEVELS - 1));
  return 'WORLD ' + (worldOf(n) + 1) + '-' + (levelInWorld(n) + 1);
}
// level TYPE tag (brief v1.1 B1 "level variety"): assigned deterministically per level number so every world
// mixes at least 4 of the 6 types. GAUNTLET/ESCORT/CHASE are implemented as light variants of the standard
// BRAWL flow rather than bespoke mechanics (see buildLevel/updateZones) - documented simplification.
// v1.2 (Step 6): index 3 changed BRAWL->ESCORT so World 1 (li 0,1,3,4 - li2/li5 are the mini/boss overrides)
// actually hits 4 distinct non-boss types (BRAWL/GAUNTLET/ESCORT/CHASE), matching the brief's "at least 4
// types per world" instead of only 3 (the old table only ever gave World 1 BRAWL/GAUNTLET/CHASE).
const LEVEL_TYPES = ['BRAWL', 'GAUNTLET', 'HAZARD', 'ESCORT', 'CHASE', 'BRAWL', 'ESCORT', 'HAZARD', 'BRAWL', 'GAUNTLET'];
const TYPE_GOAL = {
  BRAWL: 'CLEAR THE STREETS', GAUNTLET: 'SURVIVE THE WAVES', HAZARD: 'WATCH THE HAZARD',
  ESCORT: 'PROTECT THE HOMIE', CHASE: "DON'T GET LEFT BEHIND", SECRET: 'FIND THE STASH',
  MINIBOSS: 'BEAT THE MINI-BOSS', BOSS: 'BEAT THE BOSS', ASTRAL: 'BEAT THE PARANOIA',
};
function levelType(n) {
  if (isAstralLevel(n)) return 'ASTRAL';
  if (isSecretLevel(n)) return 'SECRET';
  const w = worldOf(n), li = levelInWorld(n), wd = WORLDS[w];
  if (li === wd.bossAt) return 'BOSS';
  if (li === wd.miniAt) return 'MINIBOSS';
  return LEVEL_TYPES[li % LEVEL_TYPES.length];
}

// ---- skills: every boss teaches one ----
const SKILLS = {
  cherry: { name: 'LIGHT THE CHERRY', desc: 'YOUR GIANT JOINT NOW BURNS WHAT IT HITS' },
  charge: { name: 'CHARGED SWING', desc: 'HOLD SWING, THEN LET GO FOR A HUGE HIT' },
  throw: { name: 'THROWING', desc: 'THROW ROLLING PAPERS + NUG BOMBS (K / RIGHT-CLICK). +10 PAPERS' },
  roll: { name: 'DODGE ROLL', desc: 'HOLD RUN + PRESS JUMP TO ROLL THROUGH ATTACKS' },
  toke: { name: 'HIT A TOKE', desc: 'TAP THE SMOKE KEY FOR A SMALL CLOUD, HOLD IT FOR A BIG ONE. BUZZKILLS INSIDE GET CONFUSED, HOMIES INSIDE GET HIDDEN' },
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
// ---- v1.1 B1: every level still ends in a fight against a named "boss" of that fight, exactly like the
// pre-B1 game did for all 25 of its levels (unchanged core loop - see buildLevel). What changes is WHICH
// name/skill/HP-scale a level number gets: the 6 world-ending bosses and 6 mid-world mini-bosses from the
// brief's table are hardcoded; every other level gets a deterministic, procedurally-picked "captain" fight
// (same seed -> same name/kind/skill every time, per the recipe requirement in item 2 of the brief).
// bossDataFor(n) replaces the old static BOSSES[] array/lookup.
const SKILL_ORDER = Object.keys(SKILLS);
const MEGA_SKILLS = ['toke', 'puffpass', 'breath', 'bongrip', 'regen', 'ultimate']; // one big unlock per world boss
const CAPTAIN_TITLES = ['SERGEANT', 'CAPTAIN', 'CHIEF', 'DEPUTY', 'INSPECTOR', 'WARDEN', 'FOREMAN', 'SUPERVISOR', 'MANAGER', 'DIRECTOR'];
const CAPTAIN_NAMES = ['BOB', 'RICK', 'STEVE', 'DOUG', 'GARY', 'LARRY', 'KAREN', 'PAM', 'LINDA', 'CAROL'];
function seededPick(n, salt, arr) { let s = (n * 7919 + salt * 104729 + 1) >>> 0; s = (s * 1103515245 + 12345) >>> 0; return arr[s % arr.length]; }
function bossDataFor(n) {
  // skill slot reuses 'ultimate' rather than null: every UI that shows "BEAT HIM TO LEARN X" (the brief
  // panel, bossDataFor's callers) assumes a real skill id, and learnSkill() itself is already a no-op for
  // a skill you've already got, which anyone who unlocked the Astral Plane necessarily has by now.
  if (isAstralLevel(n)) return ['THE PARANOIA', 'paranoia', 'ultimate', "YOU CAN'T ESCAPE YOUR OWN HEAD.", true, false];
  const w = worldOf(n), li = levelInWorld(n), wd = WORLDS[w], theme = THEMES[themeKeyFor(n)];
  if (isSecretLevel(n)) return [wd.name + ' STASH GUARDIAN', seededPick(n, 1, theme.enemies), seededPick(n, 2, SKILL_ORDER), 'YOU FOUND MY SECRET SPOT?!', false, false];
  if (li === wd.bossAt) return [wd.bossName, seededPick(n, 0, theme.enemies), MEGA_SKILLS[w % MEGA_SKILLS.length], wd.bossName + " WON'T LET YOU THROUGH THIS EASY.", true, false];
  if (li === wd.miniAt) return [wd.miniName, seededPick(n, 0, theme.enemies), seededPick(n, 3, SKILL_ORDER), wd.miniName.toUpperCase() + ' BLOCKS THE WAY.', false, true];
  const kind = seededPick(n, 0, theme.enemies);
  const name = seededPick(n, 4, CAPTAIN_TITLES) + ' ' + seededPick(n, 5, CAPTAIN_NAMES);
  return [name, kind, seededPick(n, 6, SKILL_ORDER), name + ' STEPS UP.', false, false];
}
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
// v1.1 A1: papers/bombs (throwable ammo) and per-weapon pickups (lighter/blunt/dab/bong/grinder) are gone -
// chests now drop Resin (fuel for Wild weapons + Core-weapon shop upgrades) or armor/pouch as before.
const MISSION_LOOT = ['resin', 'hoodie', 'resin', 'vest', 'resin', 'crown', 'pouch'];
function missionName(n, remix) {
  const th = THEMES[themeKeyFor(n)];
  if (isAstralLevel(n)) return ['THE ASTRAL PLANE', 'FACE YOUR PARANOIA'];
  const label = isSecretLevel(n) ? 'WORLD ' + (worldOf(n) + 1) + ' SECRET' : 'WORLD ' + (worldOf(n) + 1) + '-' + (levelInWorld(n) + 1);
  return [label, th.name + (remix ? ' REMIX' : '')];
}
let LEN = 0;
// v1.2 (Step 10.4): stoner-touch background gags for buildLevel()'s new `signs` array - see drawScene()'s
// `for (const s of lvl.signs)` loop for the actual drawing.
const SPOOF_SIGNS = ['TACO BONG', 'KUSH & CARRY', 'BUDS BEFORE STUDS', 'THE STONED AGE', 'ROLL WITH IT', 'GRASS IS ALWAYS GREENER', 'WEED LIKE TO WELCOME YOU', 'JOINT VENTURE CAPITAL', 'HIGH-WAY TO SAVINGS', 'BAKED GOODS (LITERALLY)'];
function buildLevel(n, remix) {
  const themeKey = themeKeyFor(n), theme = THEMES[themeKey];
  const diff = Math.min(n, 12) + (remix ? 4 : 0);
  const type = levelType(n);
  let s = 1000 + (remix ? n + 90000 : n) * 7919; const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
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
  // randomize which non-boss zones get the chest / gold crate / hidden secret / ambush, per level (seeded, so it's consistent on replays of the same level)
  const nonBossCount = zoneCount - 1;
  const zonePicks = []; while (zonePicks.length < Math.min(5, nonBossCount)) { const z = Math.floor(rand() * nonBossCount); if (!zonePicks.includes(z)) zonePicks.push(z); }
  const [chestZone, goldZone, secretZone, ambushZone, wildChestZone] = [zonePicks[0], zonePicks[1] ?? zonePicks[0], zonePicks[2] ?? zonePicks[0], zonePicks[3] ?? zonePicks[0], zonePicks[4] ?? zonePicks[0]];
  // v1.2 (Step 9.2): "special chests" - a rarer, distinct source of Wild weapons beyond the guaranteed
  // zi===0 pickup and the rare enemy-drop chance added in onKill - about 1 in 3 levels gets one, seeded so
  // it's consistent on replays of the same level like every other zone-content pick here.
  const hasWildChest = rand() < 0.35;
  for (let zi = 0; zi < zoneCount; zi++) {
    const x0 = 300 + zi * 430;
    // v1.2 (Step 6.7): 1-1's very first fight (n===0, zi===0) used to get the SAME n<2 bonus crew as every
    // other zone of levels 0-1, i.e. it was tuned harder, not softer, than the brief wants for a brand new
    // player's first fight. Give it its own small flat count instead of the n<2 bump.
    const firstFight = n === 0 && zi === 0;
    const base = firstFight ? 3 : (n < 2 ? 7 : 5) + Math.floor(diff * 0.7) + Math.floor(zi / 2);
    // v1.2 (Step 6.1): a GAUNTLET level's zone 0 is a "survive waves for a timer" arena (see hostUpdate) -
    // give it a bigger pool so the drip-spawn logic (unchanged) has enough waves to last the timer.
    const gauntletZone = type === 'GAUNTLET' && zi === 0;
    const count = firstFight ? 4 : Math.round(base * 2.5 * (gauntletZone ? 1.7 : 1)) + (n < 2 ? 4 : 0); // enough for a full crew of 4; the host only uses what the crew size needs
    const ids = [];
    for (let k = 0; k < count; k++) {
      const kind = pick(theme.enemies);
      const hp = { cop: 3 + Math.floor(diff / 3), karen: 2 + Math.floor(diff / 4), mouse: 1, squirrel: 1 }[BASE_AI[kind] || kind] + (VARIANT_HP[kind] || 0);
      ids.push(enemies.length);
      enemies.push({ id: enemies.length, kind, ai: BASE_AI[kind] || kind, zone: zi, hp, maxHp: hp, x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, dir: -1, state: 0, t: 0, cd: 60 + Math.floor(rand() * 60), flash: 0, spawned: false, alive: true, stolen: 0, tx: 0, tz: 0, th: 0 });
    }
    if (zi === zoneCount - 1) { // the boss arrives after its crew
      const bd = bossDataFor(n), mega = !!bd[4], mini = !!bd[5], crewN = Net.online ? realRemotes() + 1 : 1, bhp = Math.round((14 + n * 3) * (mega ? 2.2 : mini ? 1.5 : 1) * (1 + 0.4 * (crewN - 1)));
      ids.push(enemies.length);
      const boss = { id: enemies.length, kind: bd[1], ai: BASE_AI[bd[1]] || bd[1], boss: true, mega, mini, bname: bd[0], skill: bd[2], quote: bd[3], zone: zi, hp: bhp, maxHp: bhp, x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, dir: -1, state: 0, t: 0, cd: 90, flash: 0, spawned: false, alive: true, stolen: 0, tx: 0, tz: 0, th: 0, summons: [] };
      enemies.push(boss);
      for (let k = 0; k < 8; k++) { boss.summons.push(enemies.length); const kind = pick(theme.enemies); enemies.push({ id: enemies.length, kind, ai: BASE_AI[kind] || kind, zone: zi, reserve: true, hp: 1 + (VARIANT_HP[kind] || 0), maxHp: 1, x: 0, z: 0, h: 0, vx: 0, vz: 0, vh: 0, dir: -1, state: 0, t: 0, cd: 40, flash: 0, spawned: false, alive: false, stolen: 0, tx: 0, tz: 0, th: 0 }); }
    }
    zones.push({ x0, ids, base, started: false, cleared: false, ambush: zi === ambushZone, gauntlet: gauntletZone });
    // stuff inside each fight area
    prop(rand() < .5 ? 'crate' : 'trash', x0 + 60 + Math.floor(rand() * 180), rz(), [pick(['coin', 'munchie', 'nug', 'brownie', 'soda', 'coin']), 'coin', 'coin']);
    if (zi === chestZone) prop('chest', x0 + 150, 20, ['loot']);
    if (zi === goldZone) prop('crate', x0 + 220, 40, ['gold']);
    if (zi === secretZone) prop('secret', x0 + 40, ZMAX - 8, ['gold', 'nug']);
    if (hasWildChest && zi === wildChestZone) prop('chest', x0 + 280, rz(), ['envweapon']); // v1.2 (Step 9.2): special chest
    if (zi === 0) item('envweapon', x0 + 90, rz(), 0, pick(WILD_POOL_BY_THEME[themeKey] || WILD_POOL_BY_THEME.park)); // one Wild-weapon pickup per mission, randomly rolled from this world's pool
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
  // chest loot pool: seeded random pick, biased toward gear you don't have yet instead of a fixed n%len sequence
  const owned = new Set([...save.weapons, ...save.armor, ...(save.pouch ? ['pouch'] : [])]);
  const lootPool = MISSION_LOOT.filter(id => !owned.has(id));
  const chestLoot = (lootPool.length ? lootPool : MISSION_LOOT)[Math.floor(rand() * (lootPool.length ? lootPool.length : MISSION_LOOT.length))];

  // v1.2 (Step 6.1): real per-type gameplay flags, read by hostUpdate/updatePlayer/applyHazards/drawScene.
  // CHASE: an auto-scrolling threat pushes the crew forward instead of locking them into fight areas.
  // ESCORT: a homie NPC with their own HP walks the level with you and must be kept alive.
  const chase = type === 'CHASE';
  const escort = type === 'ESCORT' ? { x: 60, z: 20, hp: 12, maxHp: 12, alive: true } : null;
  // v1.2 (Step 10.4): spoof signs - a stoner-touch background gag (brief's own "TACO BONG etc." example),
  // purely decorative like the PLANT `deco` array above, just with a joke on it. Seeded so they're the
  // same signs in the same spots on a replay of the same level, same as every other seeded pick here.
  const signs = [{ x: 280, text: pick(SPOOF_SIGNS) }, { x: LEN - 260, text: pick(SPOOF_SIGNS) }];
  return {
    n, themeKey, theme, name: missionName(n, remix), items, props, enemies, zones, deco, signs, legend, spot, chestLoot, remix,
    zi: -1, locked: false, spawn: { x: 40, z: 30 }, eshots: [], bodies: [], decals: [], clouds: [],
    type, chase, chaseX: 0, escort,
    // v1.1 A6: SUBURBIA mousetraps - a few placed on the ground in each fight area, telegraphed by being visible before they trigger
    traps: (themeKey === 'suburb' || theme.base === 'suburb') ? zones.map(z => ({ x: z.x0 + 90 + Math.floor(rand() * 140), z: rz(), armed: true, flash: 0 })) : []
  };
}

// ============================================================
//  SAVE DATA (each player keeps their own stash + gear)
// ============================================================
let SAVE_KEY = 'kq_save_v2_s1';
const SLOT_COUNT = 3;
try { const old = localStorage.getItem('kq_save_v2'); if (old && !localStorage.getItem('kq_save_v2_s1')) localStorage.setItem('kq_save_v2_s1', old); } catch (e) {}
// v1.1 Section A: 4 homies (idx by Net.color/save.character, matching LOOKS order) each have one permanent
// CORE weapon (10-level evolution) instead of the old shop-bought weapon roster. CORE_HOMIE[i] is the homie
// key used as the save.cores{} key; CORE_WEAPON_ID maps that key to the existing WEAPONS[] id it reuses/skins.
const CORE_HOMIE = ['rasta', 'snapback', 'bucket', 'afro'];
const CORE_WEAPON_ID = { rasta: 'puff', snapback: 'bong', bucket: 'grinder', afro: 'lighter' };
function defaultSave() { return { coins: 0, spots: 0, weapons: ['puff'], armor: [], pouch: false, munchie: 1, preroll: 0, gold: 0, weapon: 'puff', farm: false, throws: { papers: 0, bombs: 0, smoke: 0 }, throwSel: 'papers', intro: false, wlv: {}, brownie: 1, soda: 0, quick: 'brownie', met: [], stats: { kills: 0, deaths: 0, playSec: 0, bestCombo: 0, bossesBeaten: 0 }, achv: [], farmPlots: [null, null, null, null], pet: null, dailyDate: '', cores: { rasta: 1, snapback: 1, bucket: 1, afro: 1 }, resin: 0, wild: null, seeds: 0, migratedV11: false, secretsFound: [], grades: {}, killjoyBeaten: false, astralBeaten: false, farmUpgrades: {}, farmCosmetics: {} }; }
let save = defaultSave();
function readSlot(i) { try { const s = JSON.parse(localStorage.getItem('kq_save_v2_s' + i)); return s && typeof s === 'object' ? s : null; } catch (e) { return null; } }
function loadSlot(i) {
  SAVE_KEY = 'kq_save_v2_s' + i;
  save = { ...defaultSave(), ...(readSlot(i) || {}) };
  // v1.1 A2: capture whether this save had ALREADY finished the old (pre-cap) A1/A2 migration before we
  // touch anything below - that's the signal a save is from before Core-level caps existed at all, so it
  // should start generously uncapped (10) rather than at the new-save tutorial cap (3). Must be read before
  // the `if (!save.migratedV11)` block further down flips it to true for a genuinely brand-new save too.
  // BUGFIX: `save.migratedV11 === true` can only ever be true for a save that already went through THIS
  // exact migration once before - it can never be true for a save from before A1/A2 existed at all (those
  // saves never had the field, so it reads undefined, exactly like a fresh save). That made a real old
  // save with actual old-economy progress (e.g. `wlv:{bong:3}`, several `weapons` unlocked) indistinguishable
  // from a brand-new save here, so it got locked to the tutorial cap of 3 even though the migration below
  // immediately seeds a core level (from the old wlv) that's already ABOVE that cap. Detect "this save has
  // real pre-v1.1 progress" directly from the legacy fields instead of the migratedV11 flag.
  const hadOldProgress = (save.weapons || []).length > 1 || Object.keys(save.wlv || {}).length > 0 || (save.spots || 0) > 0;
  const hadMigratedV11Already = !!save.migratedV11 || (!save.migratedV11 && hadOldProgress);
  save.throws = { papers: 0, bombs: 0, smoke: 0, ...(save.throws || {}) }; save.wlv = save.wlv || {}; save.met = save.met || []; ['brownie', 'soda', 'munchie', 'preroll', 'gold', 'vape'].forEach(k => save[k] = save[k] || 0); save.stats = { kills: 0, deaths: 0, playSec: 0, bestCombo: 0, bossesBeaten: 0, ...(save.stats || {}) }; save.achv = save.achv || [];
  save.farmPlots = save.farmPlots && save.farmPlots.length === 4 ? save.farmPlots : [null, null, null, null]; save.pet = save.pet || null; save.dailyDate = save.dailyDate || '';
  save.weapons = save.weapons.map(w => w === 'boomer' ? 'dab' : w); if (save.weapon === 'boomer') save.weapon = 'dab';
  if (!Array.isArray(save.skills)) save.skills = Array.from({ length: Math.min(save.spots || 0, TOTAL_LEVELS) }, (_, i) => SKILL_ORDER[i % SKILL_ORDER.length]);
  save.cores = { rasta: 1, snapback: 1, bucket: 1, afro: 1, ...(save.cores || {}) };
  save.resin = save.resin || 0; save.seeds = save.seeds || 0; save.wild = save.wild || null;
  save.secretsFound = Array.isArray(save.secretsFound) ? save.secretsFound : []; // v1.2 (Step 6.3)
  // v1.2 (Step 7): grades-per-level + the real Killjoy-beaten flag. A save that already had spots>=49
  // (all main levels beaten) under the old shortcut clearly already beat Killjoy under it - migrate that
  // straight to the real flag rather than re-locking a save that's already earned the farm.
  save.grades = save.grades && typeof save.grades === 'object' ? save.grades : {};
  if (save.killjoyBeaten == null) save.killjoyBeaten = (save.spots || 0) >= TOTAL_LEVELS;
  if (save.astralBeaten == null) save.astralBeaten = false;
  save.farmUpgrades = save.farmUpgrades && typeof save.farmUpgrades === 'object' ? save.farmUpgrades : {};
  save.farmCosmetics = save.farmCosmetics && typeof save.farmCosmetics === 'object' ? save.farmCosmetics : {};
  // v1.1 A2: save.coreCap is the per-save cap on how high ANY core can currently be leveled (separate from
  // save.cores[homie] itself - see coreLevel()/shopEntries()). Never lower it once set. A save that already
  // had migratedV11 (i.e. existed before this cap system landed, possibly with cores already leveled past
  // 3 under the old free/uncapped economy) starts generously at 10 so it's never locked out of levels it
  // already reached; only a genuinely brand-new save starts at the tutorial cap of 3.
  if (save.coreCap == null) save.coreCap = hadMigratedV11Already ? 10 : 3;
  // v1.1 A4 / v1.2 Step 9.1: preroll/gold/vape are all valid ITEMS again as of Step 9 (see ITEMS below) -
  // only reset save.quick if it's pointed at something that ISN'T a real item id at all (e.g. a save from
  // the brief window when preroll/gold were dropped and something else took the slot). Checked by a fixed
  // literal list here, not ITEMS[...], since ITEMS is declared later in this file and loadSlot(1) runs
  // before that declaration executes - referencing it here would be a TDZ crash.
  if (!['munchie', 'brownie', 'soda', 'preroll', 'gold', 'vape'].includes(save.quick)) save.quick = 'brownie';
  save.munchie = Math.min(save.munchie || 0, 3);
  // v1.1 one-time migration: never break old saves. Any pre-v1.1 save had `weapons`/`wlv`/`throws` counts
  // that no longer mean anything under the two-slot Core/Wild system, so bank their value as Resin/coins
  // instead of silently deleting it, and seed each homie's starting Core level from their old flat weapon level.
  if (!save.migratedV11) {
    const oldWeaponCount = Math.max(0, (save.weapons || []).length - 1); // -1: 'puff' was always free/starting
    const oldThrowCount = Object.values(save.throws || {}).reduce((a, b) => a + (b || 0), 0);
    const bankedResin = oldWeaponCount * 15 + oldThrowCount * 2;
    if (bankedResin > 0) save.resin += bankedResin;
    CORE_HOMIE.forEach(h => {
      const oldId = CORE_WEAPON_ID[h];
      // BUGFIX: `(save.wlv && save.wlv[oldId]) || 1` defaulted to 1 for a save with NO old wlv entry at all
      // (i.e. every brand-new save, since this whole migration block runs once for every save regardless of
      // whether there was anything to migrate) - and 1 * 2 = 2, so every fresh save silently started every
      // homie's Core level at 2 instead of defaultSave()'s intended 1. Only apply the old-level mapping when
      // an old wlv entry for this weapon actually existed; otherwise leave the core at whatever it already is.
      if (!save.wlv || !(oldId in save.wlv)) return;
      const oldLv = save.wlv[oldId] || 1; // old flat weapon level, 1-3
      save.cores[h] = Math.max(save.cores[h] || 1, Math.min(10, oldLv * 2)); // map old 1-3 range onto new 1-10 range
    });
    save.migratedV11 = true;
  }
  // v1.1 B1 one-time migration: save.spots used to be a flat progress counter over the OLD 5-world x
  // 5-level = 25-level structure. B1 reworks that into 6 worlds of 6/7/8/9/9/10 = 49 levels, so an old
  // save's raw spots number means something different now (it would over- or under-unlock levels if left
  // as-is). Per the brief's global rule ("old per-world completion unlocks the matching world's first
  // level"), map however many OLD worlds were fully finished onto the same number of NEW worlds' worth of
  // unlock, landing on that new world's first level - simple, monotonic, never loses save.farm/coins/gear.
  if (!save.migratedB1) {
    if ((save.spots || 0) > 0) {
      const OLD_LEVELS_PER_WORLD = 5, OLD_WORLD_COUNT = 5;
      const oldWorldsBeaten = Math.min(OLD_WORLD_COUNT, Math.floor(save.spots / OLD_LEVELS_PER_WORLD));
      save.spots = WORLD_START[Math.min(oldWorldsBeaten, WORLDS.length)];
    }
    save.migratedB1 = true;
  }
  save.spots = Math.min(save.spots || 0, TOTAL_LEVELS);
  // v1.1 B2/B3: the transit-game files (drive.js, lazyriver.js, etc.) call save.__persist() when they want
  // to save mid-ride (e.g. after marking an intro card seen); persist is a hoisted function declaration so
  // it already exists here even though it's defined later in the file.
  save.__persist = persist;
}
loadSlot(1);
// Core weapon level for the currently-selected homie (Net.color/save.character index into CORE_HOMIE), 1-10.
// Replaces the old wlv(weaponDef().id) lookup, which was capped at 3.
function coreLevel(homieIdx) { const h = CORE_HOMIE[homieIdx != null ? homieIdx : (Net.color || 0)] || CORE_HOMIE[0]; return Math.max(1, Math.min(10, (save.cores && save.cores[h]) || 1)); }
// v1.1 A2: brief's example cost curve - Lv2 = 60 coins + 10 Resin, each level after ~1.6x the coins + 10
// more Resin, odd TARGET levels also cost 1 Seed. `lv` is the level upgrading FROM (so target = lv+1).
// Never called for target > 10 (shopEntries() stops offering the entry at Lv10).
function coreUpCost(lv) {
  const target = lv + 1;
  let coins = 60;
  for (let t = 3; t <= target; t++) coins = Math.round(coins * 1.6);
  return { coins, resin: 10 * (target - 1), seeds: target % 2 === 1 ? 1 : 0 };
}
function persist() { checkAchv(); save.played = Date.now(); try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
const maxHp = () => 5 + ARMORS.reduce((m, a) => save.armor.includes(a.id) ? Math.max(m, a.hp) : m, 0) + ['heart1', 'heart2', 'heart3', 'heart4'].filter(k => (save.skills || []).includes(k)).length + (Net.color === 0 ? 1 : 0) + (save.pet === 'kushling' ? 1 : 0);
// v1.1 A1/A2: your weapon is fixed by which homie you're playing (no more shop-bought weapon swapping).
const weaponDef = () => WEAPONS.find(w => w.id === CORE_WEAPON_ID[CORE_HOMIE[Net.color || 0]]) || WEAPONS[0];

// ============================================================
//  WORLD STATE
// ============================================================
let lvl, me, camX = 0, state = 'play', frame = 0, running = false, paused = false, invOpen = false;
let particles = [], popups = [], shots = [], banner = null, shake = 0, hitstop = 0, slowmo = 0;
let finInfo = null, hurryT = 0, results = null, shopSel = 0, readyInfo = null;
// v1.1 A5: crew-lives. A shared life pool (3 solo / 5 co-op) that any player's final knockout spends one
// of; while lives remain, that player respawns at the last-cleared zone (the checkpoint) instead of always
// the level's very start. At 0 lives the whole level restarts and the crew keeps half their coins/Resin.
let crewLives = 3, checkpoint = null;
const remotes = new Map();
// v1.2 (Step 11.2): shared helper - ARMOR is an upgrade line, so only the single highest tier owned counts
// (was previously computed inline just inside shopEntries(); drawPlayer's new hat overlay needs it too).
const armorTier = () => Math.max(-1, ...save.armor.map(id => ARMORS.findIndex(a => a.id === id)));
// v1.2 (Step 10.1): real (non-spectator) remote crewmates only - crew lives and boss HP scaling should
// never count a 5th+ Spectator as a fighting player.
const realRemotes = () => { let n = 0; for (const r of remotes.values()) if (!r.spectate) n++; return n; };
const isHost = () => Net.online ? Net.hostId === Net.id : !Net.reconnecting;

function makePlayer() {
  return {
    x: lvl.spawn.x + (Net.color || 0) * 10, z: lvl.spawn.z - 12 + (Net.color || 0) * 10, h: 0, vx: 0, vz: 0, vh: 0, face: 1, w: 10,
    puffed: false, flaps: 0, jumpBuf: 0, inv: 60, walkT: 0, sq: 0, star: 0,
    hp: maxHp(), cooked: 0, combo: 0, comboT: 0, best: 0, atkCd: 0, atkT: 0, chain: 0, chainT: 0,
    earned: 0, lost: 0, kills: 0, nugs: 0, buffs: { speed: 0, magnet: 0, power: 0, rage: 0, soda: 0, crit: 0, dash: 0, ultra: 0 }, legendT: 0, tokeChain: 0, lastTokeFrame: -999,
    color: Net.color, name: Net.name, emote: null, stealCd: {},
    wildOn: false, // v1.2 fix: true = the held Wild weapon (me.envWeapon) is the active weapon; false = the Core weapon is active. Q toggles this - see cycleWeapon().
    // v1.2 (Step 10.1): a Spectator (5th+ joiner, room's 4 crew slots were full) - a harmless permanently
    // invincible ghost. attack()/hurt() no-op for them (checked at the top of each), and playersList()
    // filters spectator remotes out so they never trigger zone fights or count toward crew lives.
    spectator: Net.spectate,
  };
}
function startLevel(n, dropIn) {
  softPause = null; // v1.2 (Step 10.1): never carry a stale crew-wide pause into a new level
  lvl = buildLevel(n, save.spots >= TOTAL_LEVELS && n < save.spots); // REMIX: once you've beaten every level, replaying an old one is harder + pays out more
  me = makePlayer();
  // v1.2 (Step 10.1): dropping into a level the crew is already mid-fight in (see startGame()'s `dropIn`
  // arg) - skip the level's usual brief/spawn-at-the-start flow, go straight to 'play', and mark this
  // client to warp to the crew's actual position + go briefly invincible the instant the host's next
  // enemy-state snapshot tells us where that is (applySnapshot() consumes `lvl.dropInPending`).
  if (dropIn) { lvl.dropInPending = true; me.inv = 150; }
  if (farmHas('giggle')) me.cooked = 10; // GIGGLE GAS: start every mission at +10% Cooked
  if (save.pet === 'munchkin' && save.munchie < 1) save.munchie = 1; // MUNCHKIN: a free munchie every mission start
  camX = 0; state = dropIn ? 'play' : 'brief'; briefT = Net.online ? ([...new Set(lvl.theme.enemies)].some(k => !save.met.includes(k) && k === 'karen') ? 480 : 240) : 1200; particles = []; popups = []; shots = [];
  finInfo = null; hurryT = 0; results = null; readyInfo = null; invOpen = false;
  banner = dropIn ? { t: 150, a: 'DROPPING IN...', b: "CATCHING UP TO THE CREW - YOU'RE BRIEFLY INVINCIBLE" } : null;
  crewLives = Net.online && realRemotes() > 0 ? 5 : 3; checkpoint = null; // v1.1 A5: reset the crew-lives pool + checkpoint for the new level
  lvl.startFrame = frame; lvl.livesStart = crewLives; lvl.secretFoundThisRun = false; // v1.2 (Step 7.1): grade inputs
  if (n === 0 && save.spots === 0) me.tipT = 900;
  persist();
  // v1.1 B1 item 5: a short cutscene when you finish a world's boss and step into the next world, gated so
  // it only ever plays once per save (save.sawWorldCut[]). Placeholder story beats + one crew line per
  // transition, exactly as scoped ("they don't need to be beautifully written, just present and functional").
  if (n > 0) {
    const w = worldOf(n);
    if (w > 0 && levelInWorld(n) === 0 && !isSecretLevel(n) && !(save.sawWorldCut || []).includes(w)) {
      save.sawWorldCut = save.sawWorldCut || []; save.sawWorldCut.push(w); persist();
      showDialogue(WORLD_CUTSCENES[w] || [{ name: 'GRANDMA KUSH', text: 'ONWARD TO ' + WORLDS[w].name + '.' }]);
    }
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
// v1.3 (mechanic redesign, requested 2026-09-26): Ultra now also triggers as a temporary buff from
// chaining tokes (see hitAToke) on top of the original "banked to 100%" path - both still work.
const ultra = () => me.cooked >= 100 || me.buffs.ultra > 0;
const tooHigh = () => me.cooked >= 90 && me.cooked < 100 && me.buffs.ultra <= 0;
function addCombo(x, y) {
  me.combo++; me.comboT = 120; me.best = Math.max(me.best, me.combo);
  if (me.combo === 5 || me.combo === 10 || me.combo === 20) {
    tone(784, 0.1, 'square', 0.05); tone(1175, 0.25, 'square', 0.05, 0.1);
    puff(me.x, sy(me.z) - 10, 18, ['#c8ffa0', '#7fe07a', '#e4b3ff', '#ffffff'], 1.6);
    const bonus = me.combo * (hasSkill('combo') ? 4 : 2); addCoins(bonus); popup(x, y - 10, 'COMBO BONUS +' + bonus, '#c8ffa0');
  }
}
function addCoins(k) { if (Net.color === 2) k = Math.round(k * 1.15); if (me.buffs.magnet > 0) k *= 2; if (lvl && lvl.remix) k = Math.round(k * 1.3); if (farmHas('sunny')) k = Math.round(k * 1.1); if (save.pet === 'sproutly') k = Math.round(k * 1.05); if (farmUpgradeHas('rollingtray')) k = Math.round(k * 1.05); save.coins += k; me.earned += k; save.stats.coinsEarned = (save.stats.coinsEarned || 0) + Math.max(0, k); }
// v1.1 A3: "Resin drops from knocked-out enemies" (brief) - onKill() calls this for the killer instead of
// spawning a separate physical pickup entity (simplification, disclosed in AGENT_NOTES/commit message: no
// new pickup-item type, network sync or animation for it - just an instant grant, same as addCoins()).
// Per the brief ("Resin goes into the Wild charge first while it's below full, and the rest goes to the
// player's Resin bank"), a held non-infinite Wild weapon below max charge is topped up first; any leftover
// (or all of it, if no Wild weapon is held, it's full, or it's the charge-less Apple Pipe) banks as save.resin.
function gainResin(amt) {
  if (amt <= 0) return;
  if (me.envWeapon) {
    const wdef = ENV_WEAPONS[me.envWeapon.id];
    if (wdef && !wdef.infiniteCharge) {
      const room = Math.max(0, wdef.charge - me.envWeapon.charge);
      const toCharge = Math.min(room, amt);
      me.envWeapon.charge += toCharge;
      amt -= toCharge;
    }
  }
  if (amt > 0) save.resin += amt;
}
function addCooked(k) {
  if (k > 0 && save.pet === 'puffball') k = Math.round(k * 1.05);
  if (k > 0 && farmUpgradeHas('hookah')) k = Math.round(k * 1.05);
  if (k < 0 && farmHas('chill')) k = Math.round(k * 0.7); // CHILL KUSH: fades 30% slower
  const was = me.cooked; me.cooked = Math.max(0, Math.min(100, me.cooked + k));
  // v1.3: the 50%-to-unlock-the-spot banner is gone with the gate itself (see updateSpot) - Cooked is
  // now a stash you spend by smoking, not a progress bar toward the exit. Banking to 100% naturally is
  // still a valid (if slower) path to Ultra, alongside chaining tokes (see hitAToke).
  if (k > 0 && was < 100 && me.cooked >= 100) { banner = { t: 160, a: 'ULTRA COOKED!!', b: 'STRONGER HITS + INFINITE FLOAT + +25% COINS AT THE SPOT' }; SFX.power(); shake = 8; puff(me.x, sy(me.z) - 20, 40, ['#c070ff', '#c8ffa0', '#ffffff', '#ff9ab8'], 2.4); }
}
function spawnDrops(p) {
  p.drops.forEach((d, k) => {
    const id = 'd' + p.id + '_' + k;
    if (d === 'loot') return;
    // v1.2 (Step 9.2): a "special chest" that drops a Wild weapon, same envweapon pickup as everywhere
    // else - just needs a `sub` (which weapon) rolled from the level's theme pool, like buildLevel's own
    // guaranteed spawn already does.
    const pool = d === 'envweapon' ? (WILD_POOL_BY_THEME[lvl.theme.base || lvl.themeKey] || WILD_POOL_BY_THEME.park) : null;
    const sub = pool ? pool[Math.floor(Math.random() * pool.length)] : undefined;
    lvl.items.push({ id, kind: d, x: p.x - 10 + k * 12, z: Math.min(ZMAX, p.z + (k % 2) * 6), h: 16, vh: 1.5, taken: false, sub });
  });
}
function breakProp(p, remote) {
  if (p.broken) return;
  p.broken = true; p.flash = 0;
  puff(p.x, sy(p.z) - 8, 14, p.kind === 'chest' ? ['#ffd84a', '#fff6b0', '#ffffff'] : ['#c87a3a', '#8a5024', '#ffffff'], 1.6);
  spawnDrops(p);
  if (!remote) { SFX.stomp(); collect(p.id); }
  if (p.kind === 'chest') openChest(p);
  if (p.kind === 'secret') { foundSecretExit(); if (lvl) lvl.secretFoundThisRun = true; } // v1.2 (Step 6.3/7.1): reveals the world's secret level AND counts toward this level's grade
}
// v1.2 (Step 6.3): breaking the 'secret' prop in ANY level of a world reveals that world's SECRET map node
// (see mapNodes()/nodeUnlocked()) - one hidden exit per world, exactly as the brief describes.
function foundSecretExit() {
  if (!lvl) return;
  const w = worldOf(lvl.n);
  save.secretsFound = save.secretsFound || [];
  if (!save.secretsFound.includes(w)) {
    save.secretsFound.push(w); persist();
    banner = { t: 220, a: 'SECRET FOUND!', b: WORLDS[w].name + ' SECRET LEVEL UNLOCKED ON THE MAP' };
    SFX.power();
  }
}
function openChest(c) {
  const loot = lvl.chestLoot || MISSION_LOOT[lvl.n % MISSION_LOOT.length];
  SFX.power(); shake = 5;
  if (loot === 'resin') {
    // v1.2 (Step 10 bugfix): this crashed every time a chest's rolled loot was Resin - `rand()` is
    // buildLevel()'s own seeded PRNG closure, out of scope here (openChest() is a top-level function).
    // Found while testing that chest loot is shared with the whole crew (breakProp() runs openChest() on
    // every client via the existing collect-sync path - see AGENT_NOTES). Math.random() is fine here since
    // this amount only needs to be a real grant on each client, not identical bit-for-bit across clients.
    const amt = 6 + Math.floor(Math.random() * 6);
    save.resin += amt; persist();
    banner = { t: 220, a: 'FOUND: ' + amt + ' RESIN!', b: 'SPEND IT ON WILD WEAPONS OR CORE-WEAPON UPGRADES AT THE HEAD SHOP' };
    return;
  }
  const def = [...ARMORS, { id: 'pouch', name: 'STASH POUCH' }].find(i => i.id === loot);
  const owned = save.armor.includes(loot) || (loot === 'pouch' && save.pouch);
  if (owned) { addCoins(30); banner = { t: 140, a: 'TREASURE CHEST!', b: 'ALREADY HAVE ' + def.name + ' - TOOK 30 COINS' }; }
  else {
    if (loot === 'pouch') save.pouch = true;
    else { save.armor.push(loot); me.hp = maxHp(); }
    banner = { t: 180, a: 'FOUND: ' + def.name + '!', b: 'SAVED IN YOUR BAG - OPEN IT WITH ' + KL('bag') + ', QUICK-USE WITH ' + KL('quick') };
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
  else if (ITEMS[it.kind] && !(it.kind === 'munchie' && me.hp < maxHp())) { save[it.kind] = Math.min(itemCap(it.kind), (save[it.kind] || 0) + 1); SFX.buy(); popup(x - 16, y - 6, '+1 ' + ITEMS[it.kind].name, '#fff6b0'); persist(); }
  else if (it.kind === 'papers' || it.kind === 'bombs' || it.kind === 'smoke') { const k = it.kind === 'papers' ? 5 : it.kind === 'bombs' ? 2 : 2; save.throws[it.kind] = (save.throws[it.kind] || 0) + k; SFX.buy(); popup(x - 16, y - 6, '+' + k + ' ' + (it.kind === 'papers' ? 'PAPERS' : it.kind === 'bombs' ? 'NUG BOMBS' : 'SMOKE GRENADES'), '#fff6b0'); }
  else if (it.kind === 'gold') { me.star = 540; SFX.star(); shake = 6; banner = { t: 150, a: 'GOLDEN LEAF!', b: 'UNSTOPPABLE - RUN INTO ENEMIES' }; }
  else if (it.kind === 'envweapon') { me.envWeapon = { id: it.sub, charge: ENV_WEAPONS[it.sub].charge }; me.wildOn = true; popup(x - 24, y - 10, 'PICKED UP ' + ENV_WEAPONS[it.sub].name, '#fff6b0'); SFX.buy(); }
  else if (it.kind === 'extra') {
    const d = EXTRAS[it.sub];
    addCoins(d.coins); if (d.cooked) addCooked(d.cooked); if (d.buff) me.buffs[d.buff] = d.time;
    SFX.star(); shake = 4;
    banner = { t: 110, a: d.name + '!', b: '+' + d.coins + ' COINS - ' + d.desc };
    puff(x, y, 22, ['#ffd84a', '#9ae8ff', '#ffffff', '#ffb84a'], 1.8);
  }
}
function hurt(dmg = 1, cookedLoss = 0, fromX) {
  if (me.spectator || me.inv > 0 || me.star > 0 || state !== 'play') return;
  if (me.parryT > 0 && dmg > 0) { // BLOCK tapped just before the hit: PARRY - no damage, attacker's stunned & knocked back
    me.parryT = 0; popup(me.x - 16, sy(me.z) - 38, 'PARRY!', '#ffd84a'); shake = 8; hitstop = 6; SFX.power();
    puff(me.x, sy(me.z, me.h) - 10, 8, ['#ffd84a', '#ffffff']);
    if (fromX !== undefined) for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - fromX) < 24 && Math.abs(e.z - me.z) < 20) { e.state = 4; e.t = 50; e.vx = (Math.sign(e.x - me.x) || 1) * 4.5; break; }
    return;
  }
  if (K.block && dmg > 0) { dmg = Math.max(0, Math.floor(dmg / 2)); popup(me.x - 16, sy(me.z) - 34, 'BLOCKED', '#9ac8ff'); if (dmg <= 0) { me.inv = 30; SFX.bump(); return; } }
  // v1.2 (Step 9.3): the SMOKE CLOAK's own perk, beyond its flat HP - a bigger puff of cover smoke and a
  // longer invincibility window ("cloak" - you slip away in the smoke), on top of every other armor's
  // plain +hearts.
  const cloaked = save.armor.includes('cloak');
  me.hp -= dmg; me.inv = cloaked ? 100 : 70; me.vx = (fromX !== undefined ? Math.sign(me.x - fromX) || -me.face : -me.face) * 2.2; me.vh = 2;
  me.puffed = false; me.combo = 0; shake = 10; hitstop = 4;
  if (cookedLoss) { addCooked(-cookedLoss); popup(me.x - 16, sy(me.z) - 34, 'BUZZKILL -' + cookedLoss + '%', '#ff8a8a'); }
  SFX.hurt(); puff(me.x, sy(me.z, me.h) - 10, cloaked ? 14 : 5, cloaked ? ['#ffffff', '#e4b3ff', '#c070ff'] : ['#ffffff']); bleed(me.x, me.z, me.h, 5, me.vx > 0 ? 1 : -1);
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
  // v1.1 A5: this knockout spends one crew life from the shared pool instead of just costing coins forever.
  crewLives = Math.max(0, crewLives - 1);
  if (isHost()) Net.send({ t: 'lives', n: crewLives, l: lvl.n });
  if (crewLives <= 0) { restartLevelOutOfLives(); return; }
  const loss = Math.min(save.coins, 40, Math.max(5, Math.floor(save.coins * 0.1)));
  save.coins -= loss; me.lost += loss;
  const cp = checkpoint || lvl.spawn;
  me.hp = maxHp(); me.x = camX + cp.x; me.z = cp.z; me.h = 140; me.vx = me.vz = me.vh = 0; me.inv = 150; me.combo = 0; me.puffed = false;
  banner = { t: 160, a: 'YOU GOT BEAT UP!', b: 'DROPPED ' + loss + ' HASH COINS - ' + crewLives + ' CREW LIFE' + (crewLives === 1 ? '' : 'S') + ' LEFT' };
  SFX.hurt();
}
// v1.1 A5: the crew is out of lives - restart the whole level (not just a checkpoint respawn), banking the
// coins/Resin lost at half value rather than wiping them, per the brief ("keeps 50% of coins/Resin").
function restartLevelOutOfLives() {
  const coinLoss = Math.ceil(save.coins * 0.5), resinLoss = Math.ceil(save.resin * 0.5);
  save.coins -= coinLoss; save.resin -= resinLoss; persist();
  banner = null;
  const n = lvl.n;
  lvl = buildLevel(n, lvl.remix);
  me = makePlayer();
  crewLives = Net.online && realRemotes() > 0 ? 5 : 3; checkpoint = null; camX = 0;
  lvl.startFrame = frame; lvl.livesStart = crewLives; lvl.secretFoundThisRun = false; // v1.2 (Step 7.1): restart resets the grade window too
  // v1.2 fix (Step 1.2): send the actual reset lives count so non-host clients apply the real number
  // instead of a hardcoded 5 (which drifted from this formula the moment it stopped always being 5).
  if (isHost()) Net.send({ t: 'wipe', l: n, n: crewLives });
  banner = { t: 220, a: 'CREW WIPED OUT!', b: 'BACK TO THE START OF THE LEVEL - LOST HALF YOUR COINS + RESIN' };
  SFX.bump();
}
function emote(i) { me.emote = { e: i, t: 120 }; Net.send({ t: 'emote', e: i }); tone(660, 0.08, 'square', 0.04); tone(880, 0.1, 'square', 0.04, 0.08); checkEmoteCombo(i, Net.id); }
// v1.2 (Step 10.2): emote combos - the crew matching the SAME emote within ~1.5s of each other (a real "the
// crew is vibing" moment, brief's own framing) gets a small shared coin bonus. A rolling log rather than a
// per-emote timestamp table since either self or any remote can trigger/complete a combo in either order.
let emoteComboLog = [];
function checkEmoteCombo(i, who) {
  emoteComboLog = emoteComboLog.filter(e => frame - e.frame < 90);
  const matched = emoteComboLog.some(e => e.i === i && e.id !== who);
  emoteComboLog.push({ i, id: who, frame });
  if (matched && Net.online && state === 'play') { addCoins(10); banner = { t: 110, a: 'EMOTE COMBO!', b: 'THE CREW IS VIBING - +10 COINS EACH' }; SFX.power(); }
}
// v1.1 A4 (scoped): trimmed from 5 consumables to Munchies (cap 3, was 5) + 2 others (brownie/soda),
// dropping preroll and gold as a disclosed cut, and flagging the "pass the plate" shared brownie buff +
// a GIVE key as follow-up work rather than rushed.
// v1.2 (Step 9.1): that follow-up. Pre-roll and Golden Leaf are back (their `useItem` cases were dead code
// left in place since A4 for exactly this) plus a new Vape Pen (a fast, quiet +cooked% hit - no smoke
// cloud, in keeping with the brief's "restore ... Vape Pen"). Munchies stays capped at 3 ("carry Munchies
// (max 3) plus 2 others" - the brief's "2 others" is read as the 2 QUICK-KEY slots, not a hard item-type
// cap, since the shop always offered more than 3 distinct consumables even before this step).
const ITEMS = {
  munchie: { name: 'MUNCHIES', icon: 'munchie', price: 25, desc: 'HEALS 2 HEARTS. QUICK KEY: E', cap: 3 },
  brownie: { name: 'RAGE BROWNIE', icon: 'brownie', price: 45, desc: '+2 DAMAGE ON EVERY HIT FOR 20 SECONDS. SHARED WITH ANY HOMIE NEARBY' },
  soda: { name: 'ENERGY SODA', icon: 'soda', price: 35, desc: 'RUN + SWING FASTER FOR 20 SECONDS' },
  preroll: { name: 'PRE-ROLL', icon: 'brownie', price: 30, desc: 'INSTANT +30% COOKED' },
  gold: { name: 'GOLDEN LEAF', icon: 'brownie', price: 60, desc: 'A GOLDEN AURA - EXTRA HASH COINS FOR 10 SECONDS' },
  vape: { name: 'VAPE PEN', icon: 'brownie', price: 20, desc: 'A QUICK, QUIET +15% COOKED - NO SMOKE CLOUD' },
};
const MAX_ITEM = 5;
const itemCap = id => (ITEMS[id] && ITEMS[id].cap) || MAX_ITEM;
function useItem(id) {
  if (state !== 'play' || !(save[id] > 0)) { SFX.bump(); return; }
  if (id === 'munchie' && me.hp >= maxHp()) { popup(me.x - 14, sy(me.z) - 34, 'ALREADY FULL', '#ff9ab8'); return; }
  save[id]--; persist(); SFX.munch();
  const say = t => popup(me.x - 18, sy(me.z) - 36, t, '#fff6b0');
  if (id === 'munchie') { me.hp = Math.min(maxHp(), me.hp + 2); say('MUNCHIES! +2'); }
  if (id === 'brownie') {
    me.buffs.rage = 1200; say('RAGE BROWNIE!'); shake = 4;
    // v1.2 (Step 9.1): "pass the plate" - the brief's own name for a shared brownie buff. Broadcasts a
    // small AoE the same way the puffpass/hotbox smoke clouds already share buffs with nearby crew (see
    // applyHazards' cloud-buff loop) - every online client (including whoever used it) checks their own
    // distance to the broadcast point and grants themselves the buff if they're close, so this needs no
    // host-authoritative bookkeeping, just the one new broadcast + a matching onNet case.
    if (Net.online) Net.send({ t: 'brownieshare', x: Math.round(me.x), z: Math.round(me.z) });
  }
  if (id === 'soda') { me.buffs.soda = 1200; me.buffs.speed = Math.max(me.buffs.speed, 1200); say('ENERGY SODA!'); }
  if (id === 'preroll') { addCooked(30); say('PRE-ROLL +30%'); }
  if (id === 'gold') { me.star = 600; SFX.star(); say('GOLDEN LEAF!'); }
  if (id === 'vape') { addCooked(15); say('VAPE HIT! +15%'); }
}
// v1.2 (Step 9.1): GIVE key - hand your current QUICK item to the nearest connected homie ("HERE BRO", per
// the brief). Each client's own inventory is purely local (never networked - the same reason coins/items
// were never synced anywhere else in the file), so this sends a targeted `give` message the same way
// `rev`/`pass` already target one specific player by id, and the recipient's own client is what actually
// grants the item - no host-authoritative step needed since nothing here can be contested (only the giver
// spends their own copy, checked against their own local save before sending).
function giveItem() {
  if (!Net.online || state !== 'play') { SFX.bump(); return; }
  const id = save.quick || 'brownie';
  if (!(save[id] > 0)) { SFX.bump(); return; }
  let bestId = null, bestD = 32;
  for (const [rid, r] of remotes) { const d = Math.abs(r.x - me.x) + Math.abs(r.z - me.z); if (d < bestD) { bestD = d; bestId = rid; } }
  if (!bestId) { popup(me.x - 18, sy(me.z) - 36, 'NO ONE NEARBY', '#b0a8c0'); SFX.bump(); return; }
  save[id]--; persist();
  popup(me.x - 14, sy(me.z) - 36, 'HERE BRO', '#fff6b0'); SFX.buy();
  Net.send({ t: 'give', to: bestId, id });
}
// v1.2 (Step 10.2): YOINK - a fun co-op grab move, not a stealth mechanic: instantly yanks the single
// nearest un-taken pickup on the ground (coin/item/envweapon/resin/anything spawnDrops() or a chest can
// drop) to you from further away than you could normally walk-and-grab it, so the crew can race for drops
// instead of just whoever's standing closest. No network message needed - `pickUp()` already runs the
// same local-only + `collect()`-broadcast path every ordinary walk-up grab uses.
function yoink() {
  if (me.spectator || state !== 'play') { SFX.bump(); return; }
  let best = null, bestD = 90;
  for (const it of lvl.items) { if (it.taken) continue; const d = Math.abs(it.x - me.x) + Math.abs(it.z - me.z); if (d < bestD) { bestD = d; best = it; } }
  if (!best) { popup(me.x - 14, sy(me.z) - 34, 'NOTHING TO YOINK', '#b0a8c0'); SFX.bump(); return; }
  best.x = me.x; best.z = me.z; best.h = Math.max(best.h || 0, 6);
  pickUp(best); SFX.coin(0); popup(me.x - 14, sy(me.z) - 36, 'YOINK!', '#ffd84a');
}
function useMunchies() {
  useItem('munchie');
}
// v1.2 fix (Step 1.1): Q used to just drop any held Wild weapon and cycle through the old, no-longer-used
// 6-weapon `save.weapons` roster. It now just toggles which weapon is active - Core or the held Wild
// weapon - and never drops anything. If no Wild weapon is held, Q is a no-op click (nothing to switch to).
function cycleWeapon() {
  if (!me.envWeapon) { SFX.bump(); popup(me.x - 16, sy(me.z) - 34, weaponDef().name, '#fff6b0'); return; }
  me.wildOn = !me.wildOn;
  SFX.buy();
  popup(me.x - 16, sy(me.z) - 34, me.wildOn ? ENV_WEAPONS[me.envWeapon.id].name + ' (WILD)' : weaponDef().name + ' (CORE)', '#fff6b0');
}

// ============================================================
//  COMBAT
// ============================================================
const REACH = {}; for (const w of WEAPONS) REACH[w.id] = w.reach; for (const w of Object.values(ENV_WEAPONS)) REACH[w.id] = w.reach;
// my hit landed on an enemy: the host applies it, everyone else asks the host
// ---- smoke powers ----
const CLOUD_CAP_SELF = 2, CLOUD_CAP_CREW = 6;
function hitAToke(big) {
  if (hasSkill('ultimate') && me.cooked >= 100) return ultimateHigh();
  const cost = big ? 25 : 10;
  if (me.cooked < cost) { popup(me.x - 24, sy(me.z) - 34, 'NEED ' + cost + '% COOKED', '#ff8a8a'); SFX.bump(); return; }
  // cap smoke clouds so it can't be spammed: 2 per player, 6 for the crew
  const mine = lvl.clouds.filter(c => c.by === Net.id);
  if (mine.length >= CLOUD_CAP_SELF) { const oldest = mine.reduce((a, b) => a.t < b.t ? a : b); lvl.clouds.splice(lvl.clouds.indexOf(oldest), 1); }
  if (lvl.clouds.length >= CLOUD_CAP_CREW) lvl.clouds.shift();
  me.cooked -= cost;
  const r = (big ? 55 : 36) + (hasSkill('hotbox') ? 15 : 0) + (lvl.hazardFog ? 10 : 0);
  const c = { x: me.x, z: me.z, r, t: (big ? 420 : 300) * (lvl.hazardFog ? 2 : 1), heal: hasSkill('puffpass'), hot: hasSkill('hotbox'), by: Net.id, big };
  lvl.clouds.push(c); SFX.exhale(); shake = big ? 6 : 4;
  Net.send({ t: 'fx', k: 9, x: Math.round(c.x), y: Math.round(c.z), f: (c.heal ? 1 : 0) | (c.hot ? 2 : 0), h: c.r });
  if (hasSkill('bongrip')) for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - c.x) < c.r && Math.abs(e.z - c.z) < c.r * 0.6) hitEnemy(e, 2, Math.sign(e.x - c.x) || 1, true, { stun: 70 });
  // v1.3 (mechanic redesign, requested 2026-09-26): smoking is now a direct self recovery move too, not
  // just a battlefield utility cloud for the crew - a real "post-fight, take a hit" payoff like the brief
  // gap the player flagged. Heals a bit and grants a short RAGE-style damage buff (same buff the Rage
  // Brownie/pass-the-plate already use, so no new HUD plumbing needed).
  if (me.hp < maxHp()) { me.hp = Math.min(maxHp(), me.hp + (big ? 2 : 1)); popup(me.x - 12, sy(me.z) - 40, '+' + (big ? 2 : 1) + ' HEART', '#ff9ab8'); }
  me.buffs.rage = Math.max(me.buffs.rage, big ? 420 : 240);
  // Chaining tokes within a 5s window stacks toward a temporary Ultra Cooked state - a faster, skill-based
  // path to Ultra alongside the older "bank Cooked up to 100% and just sit on it" route.
  me.tokeChain = (frame - me.lastTokeFrame < 300) ? me.tokeChain + 1 : 1;
  me.lastTokeFrame = frame;
  if (me.tokeChain >= 3 && me.buffs.ultra <= 0) {
    me.tokeChain = 0; me.buffs.ultra = 360;
    banner = { t: 160, a: 'ULTRA COOKED!!', b: 'STRONGER HITS + INFINITE FLOAT + +25% COINS AT THE SPOT' };
    SFX.power(); shake = 8; puff(me.x, sy(me.z) - 20, 40, ['#c070ff', '#c8ffa0', '#ffffff', '#ff9ab8'], 2.4);
  }
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
  else Net.send({ t: 'hit', i: e.id, d: dmg, dir, s: strong ? 1 : 0, l: lvl.n, b: fx.burn || 0, sp: fx.sp || 0, st: fx.stun || 0, bl: fx.bleed || 0, kb: fx.kb || 1, hr: fx.hr || 0, a: fx.air ? 1 : 0, dr: fx.dragon ? 1 : 0 });
}
function damageEnemy(e, dmg, dir, strong, by, fx = {}) { // host only
  if (!e.alive || e.state === 5) return;
  if (e.kind === 'crab' && e.h > 0 && dmg > 0) { popup(e.x - 14, sy(e.z, e.h) - 30, 'PINCHED SHUT!', '#ffb0b0'); return; } // CRAB: can't be hit while pinching/hopping
  if (e.kind === 'securitybot' && dmg > 0 && !fx.stun) { popup(e.x - 10, sy(e.z, e.h) - 30, 'SHIELDED!', '#9ab0ff'); return; } // SECURITY BOT: shielded unless stunned (Bong)
  if (e.kind === 'owl' && dmg > 0 && !fx.air) dmg = Math.max(1, Math.floor(dmg / 3)); // OWL NARC: needs an air hit to really connect
  // v1.1 A6: DOWNTOWN riot shields - cops block frontal damage; hit them from behind, or stun them first (fx.stun), to get through
  if (e.ai === 'cop' && !e.boss && dmg > 0 && !fx.stun && e.state !== 4 && (lvl.theme.base || lvl.themeKey) === 'city' && dir === -e.dir) {
    popup(e.x - 14, sy(e.z, e.h) - 30, 'SHIELDED!', '#9ab0ff'); SFX.bump(); return;
  }
  if (by === Net.id && tooHigh() && dmg > 0) dmg += 1; // too-high zone (90-99% Cooked): hit harder, but slower on your feet
  let teamBonus = 0;
  if (by && e.lastHitBy && e.lastHitBy !== by && frame - (e.lastHitT || -999) < 30) { teamBonus = Math.max(1, Math.ceil(dmg * 0.5)); popup(e.x - 22, sy(e.z) - 30, 'TEAM UP!', '#ffd84a'); SFX.power(); }
  e.lastHitBy = by; e.lastHitT = frame;
  e.hp -= dmg + teamBonus; e.flash = 8;
  if (fx.burn) { e.burn = Math.max(e.burn || 0, fx.burn); e.burnBy = by; e.burnT = e.burnT || 36; e.spread = Math.max(e.spread || 0, fx.sp || 0); }
  if (fx.dragon) e.dragonBurn = true; // LIGHTER "DRAGON'S BREATH" (tier5/Lv10): marks this enemy to explode on death, see below
  if (fx.bleed) { e.bleedN = Math.max(e.bleedN || 0, fx.bleed); e.bleedBy = by; e.bleedT = e.bleedT || 44; }
  // HOTBOX: burning + stunned at once detonates a smoke burst that hits everything nearby
  if ((e.burn > 0 || fx.burn) && (e.stunned > 0 || fx.stun) && !(e.hotboxCd > 0)) { e.hotboxCd = 90; hotboxBlast(e, by); }
  if (e.hotboxCd > 0) e.hotboxCd--;
  if (e.hp <= 0) {
    e.state = 5; e.t = 50; e.vx = dir * 2.6; e.vh = 3;
    // HQ: robot mice detonate in a small radius when they die, whether that's from your attack or their own self-detonate timer
    const wk4 = lvl.theme.base || lvl.themeKey, explodeMouse = e.ai === 'mouse' && wk4 === 'hq' && !e.reserve;
    if (explodeMouse) {
      SFX.boom(); shake = Math.max(shake, 6); puff(e.x, sy(e.z, e.h) - 6, 10, ['#ff5a6a', '#ffd84a', '#ffffff'], 1.4);
      if (Math.abs(e.x - me.x) < 22 && Math.abs(e.z - me.z) < 14) hurt(1, 3, e.x);
    }
    // LIGHTER "DRAGON'S BREATH" (tier5/Lv10): "burning enemies explode on death" - a small fiery burst
    // that also singes anything else standing right next to the body.
    if (e.dragonBurn && (e.burn > 0 || fx.burn)) {
      SFX.boom(); shake = Math.max(shake, 8); puff(e.x, sy(e.z, e.h) - 8, 12, ['#ff5a6a', '#ff9a3a', '#ffd84a', '#ffffff'], 1.6);
      for (const o of lvl.enemies) if (o !== e && o.spawned && o.alive && o.state !== 5 && Math.abs(o.x - e.x) < 26 && Math.abs(o.z - e.z) < 18) damageEnemy(o, 2, Math.sign(o.x - e.x) || 1, false, by, { burn: 2 });
      if (Math.abs(e.x - me.x) < 26 && Math.abs(e.z - me.z) < 18) hurt(1, 2, e.x);
    }
    Net.send({ t: 'kill', i: e.id, by, st: e.stolen, l: lvl.n, ex: explodeMouse ? 1 : 0, exx: Math.round(e.x), exz: Math.round(e.z) });
    onKill(e, by);
  } else {
    const kb = (fx.kb || 1) * (e.boss ? 0.25 : 1);
    if (e.boss) { if (!(e.state === 1 || e.state === 2) || fx.stun) { e.state = 4; e.t = fx.stun ? 30 : 8; } e.vx = dir * kb; if (fx.hr) fx = { ...fx, hr: 0 }; return; }
    e.state = 4; e.t = Math.max(strong ? 30 : 20, fx.stun || 0); e.stunned = fx.stun ? e.t : 0; e.vx = dir * (strong ? 3 : 1.4) * kb; if (strong) e.vh = 2.2;
    if (fx.hr) { e.vh = 4; e.vx = dir * 5; e.flying = { by, dir, lv3: !!fx.hrLv3, bounces: fx.hrLv3 ? 2 : 0 }; }
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
// ---- world hazards, one per base theme: hurt/push both players and enemies (except woods fog, which is purely visual) ----
function applyHazards() {
  if (state !== 'play' || !lvl) return;
  const bk = lvl.theme.base || lvl.themeKey;
  const zn = lvl.zones[lvl.zi] || lvl.zones[0]; if (!zn) return;
  lvl.hazardOn = false; lvl.hazardX = null; lvl.hazardZ = null; lvl.hazardFog = false;
  // v1.2 (Step 6.1): "HAZARD: built around the world's hazard" - every level of a world already runs its
  // theme's ambient hazard (unchanged below), but the level actually TAGGED hazard turns it up: shorter
  // cycles, more damage. Real, testable difference without touching the (already shipped/tested) baseline.
  const intense = levelType(lvl.n) === 'HAZARD', im = intense ? 1.7 : 1;
  if (bk === 'park') { // sprinklers: knock everyone around, no damage
    const midX = zn.x0 + ZW / 2, on = frame % (intense ? 160 : 240) < (intense ? 70 : 40);
    lvl.hazardOn = on;
    if (on && frame % 8 === 0) {
      if (Math.abs(me.x - midX) < ZW / 2 && me.h < 6) { me.vx += (Math.sign(me.x - midX) || 1) * 0.4 * im; me.vh = Math.max(me.vh, 1.4 * im); puff(me.x, sy(me.z, me.h) - 6, 2, ['#bfe8ff', '#ffffff'], .6); }
      if (isHost()) for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - midX) < ZW / 2) { e.vx += (Math.sign(e.x - midX) || 1) * 0.4 * im; e.vh = Math.max(e.vh, 1.2 * im); }
    }
  } else if (bk === 'beach') { // waves: push everyone along the depth axis, no damage
    lvl.hazardOn = Math.sin(frame / (intense ? 46 : 70)) > (intense ? 0.55 : 0.7);
    if (lvl.hazardOn && frame % 6 === 0) {
      me.vz = (me.vz || 0) + 0.3 * im;
      if (isHost()) for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5) e.vz = (e.vz || 0) + 0.25 * im;
    }
  } else if (bk === 'suburb') { // rolling BBQ grill: a moving hitbox that burns anyone (player or enemy) it rolls over
    const gx = zn.x0 + ZW / 2 + Math.sin(frame / (intense ? 65 : 100)) * (ZW / 2 - 24), gz = ZMAX / 2;
    lvl.hazardX = gx; lvl.hazardOn = true;
    if (frame % (intense ? 20 : 30) === 0 && Math.abs(me.x - gx) < 12 && Math.abs(me.z - gz) < 10) hurt(1, intense ? 6 : 4, gx);
    if (isHost() && frame % (intense ? 14 : 20) === 0) for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - gx) < 12 && Math.abs(e.z - gz) < 10) damageEnemy(e, intense ? 2 : 1, Math.sign(e.x - gx) || 1, false, null, { burn: 1 });
  } else if (bk === 'city') { // traffic lanes: a warning light, then a car passes through the lane
    const period = intense ? 100 : 150, cyc = frame % period, laneZ = 14 + (Math.floor(frame / period) % 3) * 20;
    lvl.hazardOn = cyc > period - (intense ? 30 : 40); lvl.hazardZ = laneZ;
    if (cyc === period - 20) {
      if (Math.abs(me.z - laneZ) < 10) hurt(1, intense ? 4 : 3, me.x - 40 * me.face);
      if (isHost()) for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.z - laneZ) < 10) damageEnemy(e, intense ? 3 : 2, 1, true, null, { kb: 1.4 });
    }
  } else if (bk === 'woods') { // fog: enemies only show up close (handled purely in drawScene)
    lvl.hazardFog = true;
  } else if (bk === 'hq') { // laser grid: switches on/off on a timer, damages anyone standing (not jumping) through it
    const period = intense ? 130 : 180, onLen = intense ? 55 : 60;
    lvl.hazardOn = (frame % period) < onLen;
    if (lvl.hazardOn && frame % (intense ? 14 : 20) === 0) {
      if (me.h < 6) hurt(1, intense ? 4 : 3, me.x);
      if (isHost()) for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && e.h < 6) damageEnemy(e, intense ? 2 : 1, 1, false, null, {});
    }
  }
}
let crewCombo = 0, crewComboT = 0;
function onKill(e, by) { // everyone: death effect; the one who landed it gets the goods
  e.state = 5; e.t = Math.max(e.t, 40);
  if (Net.online) { crewCombo++; crewComboT = 150; if (crewCombo > 0 && crewCombo % 10 === 0) { addCoins(5); popup(e.x - 24, sy(e.z) - 40, 'CREW COMBO x' + crewCombo + '! +5', '#ffd84a'); } }
  if (e.boss) { save.stats.bossesBeaten++; e.t = 90; hitstop = 20; shake = 16; for (const id of e.summons || []) { const a = lvl.enemies[id]; if (a.alive && a.spawned) { a.alive = false; puff(a.x, sy(a.z) - 8, 8, ['#ffffff'], 1); } } banner = { t: 160, a: e.bname + ' DEFEATED!', b: '' }; setTimeout(() => learnSkill(e.skill), 1600); lvl.boss = null; }
  // v1.1 A2: the Core-weapon level cap only rises at each world's mini-boss (e.mini) and boss (e.mega) - runs
  // for everyone locally (same e.mini/e.mega/worldOf(lvl.n) on every client, no network sync needed), never
  // lowers a cap raised by an earlier run. World w (0-5): mini-boss -> cap 4+w, world boss -> cap 5+w, so
  // World 6's (index 5) boss (Mr. Killjoy) lands exactly on cap 10 as the brief specifies.
  if (e.boss && (e.mega || e.mini)) {
    const w = worldOf(lvl.n), newCap = e.mega ? 5 + w : 4 + w;
    save.coreCap = Math.max(save.coreCap || 3, Math.min(10, newCap));
    // v1.2 fix (Step 5.6): "Seeds for every player in co-op on a boss kill (synced), not only the player
    // who landed the killing hit." onKill() itself already runs identically on EVERY client (it's called
    // from the same `case 'kill':` network event everyone receives - see onNet()), so this needs no new
    // network message at all: dropping the old `by === Net.id` gate means every player's own local onKill
    // call awards their own local save.seeds, all from the same synchronized e.mega/lvl.n/frame state.
    if (e.mega) save.seeds = (save.seeds || 0) + 1;
    // v1.2 (Step 7.5): a real "Killjoy beaten" flag instead of inferring it from save.spots>=SPOTS_TO_FARM -
    // set the instant the LAST world's boss (Buzzkill HQ's Mr. Killjoy) dies, runs identically on every
    // client for the same reason the Seed grant above does (onKill() is itself the synced event).
    // v1.2 (Step 8.4): the killing blow on the run's climactic mega boss (Mr. Killjoy, or THE PARANOIA in
    // the Astral Plane) gets a beat of slow-motion (see `slowmo` in update()) instead of just the usual
    // hitstop every knockout already gets, so the moment reads as bigger.
    if (e.mega && isAstralLevel(lvl.n)) { save.astralBeaten = true; slowmo = 50; banner = { t: 200, a: 'THE PARANOIA IS GONE.', b: 'COSMIC CLARITY ACHIEVED' }; }
    else if (e.mega && worldOf(lvl.n) === WORLDS.length - 1) { save.killjoyBeaten = true; slowmo = 50; }
  }
  puff(e.x, sy(e.z) - 10, 8, ['#ffffff', '#e8e4f4', '#c8ffa0'], 1.4); bleed(e.x, e.z, e.h, 8, e.vx > 0 ? 1 : -1);
  const zn = lvl.zones[lvl.zi];
  if (zn && lvl.locked && zn.ids.every(i => { const o = lvl.enemies[i]; return o === e || !o.alive || o.state === 5 || !o.spawned && o.skipped; }) && zn.ids.filter(i => !lvl.enemies[i].spawned && lvl.enemies[i].alive).length === 0) { hitstop = 14; shake = 10; }
  if (by !== Net.id) return;
  const reward = (e.boss ? (e.mega ? 150 : 60) : { cop: 8, karen: 6, mouse: 2, squirrel: 3 }[e.ai]) + e.stolen;
  addCoins(reward); addCooked(3); me.kills++; addCombo(e.x, sy(e.z) - 30); SFX.stomp();
  gainResin(e.mega ? 5 : e.mini ? 3 : 1); // v1.1 A3: Resin drops from every knock-out - see gainResin()'s comment on the simplification here
  // v1.2 (Step 9.2): "rare enemy drops" - a Wild weapon pickup, beyond the one guaranteed spawn per mission
  // (zi===0's `envweapon` item, built in buildLevel). Small enough (2%, mega/mini bosses always drop -
  // they're already a rare, celebrated kill) that the guaranteed spawn stays the normal way to get one.
  if (!e.reserve && (e.mega || e.mini || Math.random() < 0.02)) {
    const pool = WILD_POOL_BY_THEME[lvl.theme.base || lvl.themeKey] || WILD_POOL_BY_THEME.park;
    lvl.items.push({ id: 'w' + e.id + '_' + frame, kind: 'envweapon', x: e.x, z: e.z, h: 14, vh: 1.6, taken: false, sub: pool[Math.floor(Math.random() * pool.length)] });
  }
  // v1.2 (Step 10.3): every enemy kind now has its own real KO line (was only 5 of the ~13 kinds), plus a
  // per-Core-weapon flourish word appended on non-boss kills so the same enemy dying to the Joint vs. the
  // Bong reads a little different - small, but it's the kind of personality touch the brief means by
  // "weapon knockout lines".
  const KO_LINE = {
    crab: 'CRACKED!', lawnmower: 'MOWED DOWN!', segway: 'WIPED OUT!', owl: 'GROUNDED!', securitybot: 'SHUT DOWN!',
    ranger: 'TICKETED!', guard: 'OFF DUTY!', suit: 'FIRED!', rat: 'SCRAM!', raccoon: 'TRASHED!',
    badtrip: 'BUMMER!', paranoia: 'PARANOIA FADES!',
  };
  const AI_KO_LINE = { cop: 'COP DOWN!', karen: 'KAREN DENIED!', mouse: 'SQUEAK!', squirrel: 'NUTS!' };
  const WEAPON_KO_WORD = { joint: 'PUFF', lighter: 'TOASTED', bong: 'GONG', grinder: 'GROUND UP' };
  const flourish = (!e.boss && !e.mini) ? ' (' + (WEAPON_KO_WORD[weaponDef().id] || 'BONKED') + ')' : '';
  popup(e.x - 14, sy(e.z) - 34, (KO_LINE[e.kind] || AI_KO_LINE[e.ai] || 'DOWN!') + ' +' + reward + flourish, '#ffffff');
  e.stolen = 0;
}
function attack(charged) {
  if (me.spectator || (me.atkCd > 0 && !charged) || state !== 'play' || me.roll > 0) return;
  const wildActive = !!(me.envWeapon && me.wildOn);
  const w = wildActive ? ENV_WEAPONS[me.envWeapon.id] : weaponDef(), wi = wildActive ? 0 : WEAPONS.indexOf(w);
  if (me.puffed) { // exhale a smoke blast from the cloud
    me.puffed = false; me.flaps = 0; SFX.exhale(); me.atkCd = 16; me.atkT = 10;
    shots.push({ mine: true, x: me.x + me.face * 10, z: me.z, h: me.h + 8, vx: me.face * 3.6, life: 26, dmg: 2, kind: 5, hit: new Set() });
    Net.send({ t: 'fx', k: 5, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
    return;
  }
  // v1.2 (Step 9.3): the Gravity Bong Cannon (ENV_WEAPONS.gravitybongcannon, `ultimate: true`) - only
  // usable at Ultra (100% Cooked), reuses the tested ultimateHigh() screen-wide blast, and is spent
  // entirely (unequipped) the instant it fires rather than going back on cooldown like a normal weapon.
  if (wildActive && w.ultimate) {
    if (me.cooked < 100) { SFX.bump(); me.atkCd = 14; popup(me.x - 24, sy(me.z) - 34, 'NEEDS ULTRA (100% COOKED)', '#8a809a'); return; }
    me.atkCd = w.cd; me.atkT = 14;
    ultimateHigh();
    banner = { t: 130, a: 'GRAVITY BONG BLAST!', b: 'ONE-TIME ULTIMATE - THE CANNON IS SPENT' };
    me.envWeapon = null; me.wildOn = false;
    return;
  }
  // v1.1 A3: Wild-weapon charge bar. A held Wild weapon below its per-swing cost still "attacks" (so its
  // cooldown/animation logic below doesn't need touching) but deals no damage and just clicks - the brief's
  // "does nothing (a 'click' sound) until more Resin is picked up". It stays held (me.envWeapon isn't
  // cleared) rather than breaking/dropping.
  if (wildActive && !ENV_WEAPONS[me.envWeapon.id].infiniteCharge && me.envWeapon.charge < ENV_WEAPONS[me.envWeapon.id].cost) {
    SFX.bump(); me.atkCd = 14; popup(me.x - 14, sy(me.z) - 34, '*CLICK*', '#8a809a');
    return;
  }
  const lunge = K.run && Math.abs(me.vx) > 1.5 && me.h === 0, air = me.h > 6;
  if (air && me.vh < 0.5 && hasSkill('pound') && !charged) { me.pound = true; me.vh = -5; me.slash = { t: 12, max: 12, heavy: true, kind: w.id, air: true }; SFX.flap(); return; }
  // v1.2 fix (Step 5): tier = the brief's 6 named-form brackets for the 4 real Cores (see coreTier()),
  // computed up front now since the combo length itself changes at a tier (JOINT's 4-hit combo below).
  const lv0 = wlv(w.id), tier0 = coreTier(lv0);
  const comboMax = (w.id === 'puff' && tier0 >= 3) ? 4 : 3; // JOINT "BLUNT" form (tier3/Lv7+): a 4th hit joins the combo
  me.chain = lunge || air || charged ? comboMax - 1 : me.chainT > 0 ? (me.chain + 1) % comboMax : 0;
  const strong = me.chain === comboMax - 1;
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
  const lv = lv0, lv3 = lv >= 3, tier = tier0;
  let dmg = w.dmg + (lv - 1) + (ultra() ? (hasSkill('rage') ? 3 : 1) : 0) + (me.buffs.rage > 0 ? 2 : 0) + (strong ? 1 : 0);
  if (charged) dmg = dmg * 2 + 2;
  if (charged && w.id === 'bong' && tier >= 4 && (me.holdT || 0) > 70) { dmg += 3; popup(me.x - 20, sy(me.z) - 44, '2ND STAGE!', '#e4b3ff'); } // GRAVITY BEAST+ (tier4/Lv9+): a longer hold triggers a bigger 2nd-stage blast
  // v1.2 fix (Step 5.2): GRINDER is now a thrown, returning disc (see updateShots' `kind === 12` handling)
  // instead of a melee spin - it never reaches the melee target loop below at all. Range grows with tier;
  // 4-Piece+ (tier2/Lv5+) pierces; Electric+ (tier3/Lv7+) throws 2 discs; Industrial+ (tier4/Lv9+) can also
  // hit on the way back; Kief Cyclone (tier5/Lv10) leaves a slowing cloud where it's caught.
  if (w.id === 'grinder' && !wildActive) {
    const range = 60 + tier * 16, speed = 4.2, nDiscs = tier >= 3 ? 2 : 1, pierce = tier >= 2 ? 999 : 0, returnHits = tier >= 4, kief = tier >= 5;
    for (let i = 0; i < nDiscs; i++) shots.push({ mine: true, kind: 12, x: me.x + me.face * 10, z: me.z + (nDiscs > 1 ? (i === 0 ? -9 : 9) : 0), h: me.h + 8, vx: me.face * speed, life: 240, dmg, hit: new Set(), pierce, range, dist: 0, returning: false, returnHits, kief });
    Net.send({ t: 'fx', k: 12, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
    return;
  }
  // v1.2 fix (Step 5.3): BONG tap vs hold. A plain tap falls through to the melee smash below unchanged;
  // holding the attack button (see updatePlayer's holdT gate, extended to allow Bong's charge regardless
  // of the `charge` skill) fires this mid-range smoke blast instead. Percolator+ (tier3/Lv7+) leaves a
  // smoke cloud where it lands; The Mothership (tier5/Lv10) lets the blast pierce through the whole line.
  if (w.id === 'bong' && charged && !wildActive) {
    const range = 70 + tier * 10, pierce = tier >= 5 ? 999 : 1;
    shots.push({ mine: true, kind: 13, x: me.x + me.face * 14, z: me.z, h: me.h + 6, vx: me.face * 3.6, life: 90, dmg, hit: new Set(), pierce, kb: 2 + tier * 0.3, hr: tier >= 2 ? 1 : 0 });
    shake = 8; SFX.power();
    if (tier >= 3) lvl.clouds.push({ x: me.x + me.face * (range * 0.6), z: me.z, r: 18, t: 130, by: Net.id }); // PERCOLATOR+: the blast leaves a smoke cloud
    Net.send({ t: 'fx', k: 13, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
    return;
  }
  // v1.2 fix (Step 5): LIGHTER BLOWTORCH+ (tier4/Lv9+) - a held attack fires a short flamethrower stream
  // instead of the normal jab; DRAGON'S BREATH (tier5/Lv10) widens it into a whole cone (3 -> 5 jets) and
  // marks anything it burns to explode when it dies (see the `dr` field on 'hit'/damageEnemy below).
  if (w.id === 'lighter' && charged && tier >= 4 && !wildActive) {
    const jets = tier >= 5 ? 5 : 3, range = 34 + tier * 4;
    for (let i = 0; i < jets; i++) { const dz = (i - (jets - 1) / 2) * 7;
      shots.push({ mine: true, kind: 14, x: me.x + me.face * 8, z: me.z + dz, h: me.h + 8, vx: me.face * 3, life: Math.round(range / 3), dmg, hit: new Set(), dragon: tier >= 5 }); }
    shake = 6; SFX.exhale();
    Net.send({ t: 'fx', k: 14, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
    return;
  }
  const reach = w.reach + (charged ? 12 : 0) + (w.id === 'bong' ? tier * 3 : 0); // GLASS BONG+ (tier1/Lv3+): the smash radius grows too
  const baseBurn = w.id === 'puff' ? (hasSkill('cherry') ? w.burn : 0) : (w.burn || 0);
  const spreadOn = w.spread || (w.id === 'puff' && tier >= 2); // JOINT FATTY+ (tier2/Lv5+): burn spreads to a neighbor too
  const fx = { burn: Math.max(baseBurn ? (baseBurn + (lv - 1)) * (tier >= 1 && w.id === 'puff' ? 2 : 1) + (farmHas('fire') ? 1 : 0) : 0, hasSkill('embers') ? 1 : 0), sp: spreadOn ? (tier >= 1 && w.id === 'lighter' ? 2 : 1) : 0, stun: w.stun ? w.stun + (lv - 1) * 15 : 0, bleed: w.bleed ? w.bleed + (lv - 1) : 0, kb: (w.kb || 1) * (strong ? 1.3 : 1) * (charged ? 1.8 : 1), hr: (w.homer || hasSkill('finisher') || charged) && strong ? 1 : 0, hrLv3: lv3 && w.id === 'blunt' && strong, air };
  let hits = 0;
  const targets = lvl.enemies.filter(e => e.spawned && e.alive && e.state !== 5).map(e => ({ e, dx: e.x - me.x, dz: Math.abs(e.z - me.z) }))
    .filter(t => { const r = reach + (t.e.boss ? 14 : 0); return (w.spin || air ? Math.abs(t.dx) < r : t.dx * me.face > -6 && Math.abs(t.dx) < r) && t.dz < w.zr + (air ? 6 : 0) + (t.e.boss ? 10 : 0) && Math.abs(t.e.h - me.h) < 30; })
    .sort((a, b) => Math.abs(a.dx) - Math.abs(b.dx));
  let critChained = false;
  for (const t of (w.pierce || w.spin || w.id === 'lighter' || w.id === 'bong' || w.homer) ? targets : targets.slice(0, 2)) {
    let d = dmg; const crit = Math.random() < (w.crit || 0) + (hasSkill('crit') ? 0.15 : 0) + (me.buffs.crit > 0 ? 0.25 : 0) + (farmHas('sticky') ? 0.15 : 0);
    if (crit) { d *= 2; popup(t.e.x - 10, sy(t.e.z) - 30, 'CRIT!', '#9ae8ff'); }
    // minimal shove: swinging into an already-stunned buzzkill (Bong Hammer or a parry) knocks it into the others
    const shoveFx = (t.e.state === 4 && !fx.hr) ? { ...fx, hr: 1 } : fx;
    hitEnemy(t.e, d, Math.sign(t.dx) || me.face, strong || crit, shoveFx); hits++;
    if (w.id === 'puff' && lv3 && Math.random() < 0.15) lvl.items.push({ id: 'r' + Math.random(), kind: 'ring', x: t.e.x, z: t.e.z, h: 4, taken: false }); // JOINT LV3: hits sometimes drop a smoke ring
    // DAB SABER LV3: a crit chains to the next enemy in line
    if (w.id === 'dab' && lv3 && crit && !critChained) {
      critChained = true;
      const next = targets.find(o => o.e !== t.e);
      if (next) { hitEnemy(next.e, d, Math.sign(next.dx) || me.face, true, fx); popup(next.e.x - 16, sy(next.e.z) - 34, 'CHAIN CRIT!', '#9ae8ff'); }
    }
  }
  // fire touching a smoke cloud ignites it into a HOTBOX burst
  if (fx.burn > 0) for (const c of lvl.clouds) {
    if (c.ignited) continue;
    if (Math.abs(c.x - me.x) < reach + c.r && Math.abs(c.z - me.z) < 30 + c.r * 0.6) {
      c.ignited = true; c.t = Math.min(c.t, 20); c.hot = true;
      banner = { t: 70, a: 'HOTBOX!!', b: '' }; shake = Math.max(shake, 10); SFX.power();
      puff(c.x, sy(c.z) - 10, 20, ['#ff5a6a', '#ff9a3a', '#ffd84a', '#ffffff'], 2);
      for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - c.x) < c.r && Math.abs(e.z - c.z) < c.r * 0.6) hitEnemy(e, 3, Math.sign(e.x - c.x) || 1, true, { burn: 3, stun: 40 });
      Net.send({ t: 'fx', k: 11, x: Math.round(c.x), y: Math.round(c.z), h: Math.round(c.r) });
    }
  }
  // BONG "THE MOTHERSHIP" (tier5/Lv10 only, per the brief - earlier forms just have the smash/blast split
  // above): the stun sends out a shockwave that hits everyone near the target.
  if (w.id === 'bong' && tier >= 5 && strong && hits) for (const t of targets) for (const o of lvl.enemies) if (o !== t.e && o.spawned && o.alive && o.state !== 5 && Math.abs(o.x - t.e.x) < 30 && Math.abs(o.z - t.e.z) < 22) hitEnemy(o, 1, Math.sign(o.x - t.e.x) || 1, false, { stun: 30 });
  for (const p of lvl.props) {
    if (p.broken) continue;
    const dx = p.x - me.x;
    if (dx * me.face > -6 && Math.abs(dx) < reach && Math.abs(p.z - me.z) < 12) { p.hp--; p.flash = 6; SFX.bump(); if (p.hp <= 0) breakProp(p); }
  }
  if (w.id === 'bong' && strong) { shake = 6; puff(me.x + me.face * (22 + tier * 3), sy(me.z) - 2, 12 + tier * 2, ['#bfe8ff', '#ffffff', '#7fe07a'], 1.6); }
  if (w.id === 'blunt' && strong && hits) popup(me.x + me.face * 20, sy(me.z) - 40, 'HOME RUN!', '#ffd84a');
  if (w.id === 'lighter') for (let i = 0; i < 8 + tier * 3; i++) particles.push({ x: me.x + me.face * (10 + i * 3), y: sy(me.z, me.h) - 12 + (Math.random() - .5) * 8, vx: me.face * (1 + Math.random()), vy: -0.3, life: 14, col: ['#ff5a6a', '#ff9a3a', '#ffd84a'][i % 3], s: 3 + tier * 0.5, g: -0.02 });
  if (w.id === 'lighter' && tier >= 1 && hits) lvl.clouds.push({ x: me.x + me.face * 20, z: me.z, r: 16 + tier * 3, t: 150, hot: true, by: Net.id }); // ZIPPO+ (tier1/Lv3+): leaves a burning fire patch
  // LIGHTER JET FLAME+ (tier3/Lv7+): the combo finisher lets out an extra burst of flame around the target
  if (w.id === 'lighter' && tier >= 3 && strong && hits) { shake = Math.max(shake, 6); for (const t of targets) for (const o of lvl.enemies) if (o.spawned && o.alive && o.state !== 5 && Math.abs(o.x - t.e.x) < 26 && Math.abs(o.z - t.e.z) < 16) hitEnemy(o, 1, Math.sign(o.x - t.e.x) || 1, false, { burn: 2 }); }
  if (w.id === 'puff') puff(me.x + me.face * 26, sy(me.z, me.h) - 16, 5 + tier * 2, tier >= 5 ? ['#ff9ab8', '#c070ff', '#7ac8ff', '#ffd84a'] : ['#ffffff', '#e8e4f4'], .6, -0.02);
  // JOINT CANNON+ (tier4/Lv9+): the finisher leaves a patch of burning ground; LEGENDARY DOOBIE (tier5/
  // Lv10) makes that patch bigger and rainbow-tinted (drawn via the cloud's own draw code, see c.hot).
  if (w.id === 'puff' && tier >= 4 && strong && hits) lvl.clouds.push({ x: me.x + me.face * 22, z: me.z, r: tier >= 5 ? 22 : 16, t: 160, hot: true, by: Net.id });
  Net.send({ t: 'fx', k: wi, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
  // v1.1 A3: drain the Wild weapon's Resin charge on every swing that actually attacked (the click-check
  // above already bailed out before this point if there wasn't enough charge), never below 0. It stays
  // held at 0 charge - no more "BROKE!"/auto-drop; gainResin() (see onKill) tops it back up from kills.
  if (wildActive && !ENV_WEAPONS[me.envWeapon.id].infiniteCharge) me.envWeapon.charge = Math.max(0, me.envWeapon.charge - ENV_WEAPONS[me.envWeapon.id].cost);
}
function updateShots() {
  for (const s of shots) {
    // v1.2 fix (Step 5.2): GRINDER's disc (kind 12) is its own little state machine - fly out to s.range,
    // flip around, and home back toward the PLAYER'S CURRENT position (not a fixed point) until caught,
    // instead of just flying off in one straight line like every other shot kind here.
    if (s.kind === 12 && s.mine) {
      if (!s.returning) {
        s.dist = (s.dist || 0) + Math.abs(s.vx);
        if (s.dist >= s.range) { s.returning = true; if (s.returnHits) s.hit = new Set(); s.legHit = false; } // INDUSTRIAL+ (tier4/Lv9+): fresh hits allowed on the way back too
      } else {
        const dx = me.x - s.x; s.vx = Math.abs(s.vx) * (dx >= 0 ? 1 : -1);
        if (Math.abs(dx) < 12 && Math.abs(s.z - me.z) < 16) { if (s.kief) lvl.clouds.push({ x: s.x, z: s.z, r: 18, t: 220, slow: true, by: Net.id }); s.life = 0; continue; } // KIEF CYCLONE (tier5/Lv10): a slowing cloud where it's caught
      }
      s.x += s.vx; s.life--;
      // 4-PIECE+ (tier2/Lv5+, s.pierce > 0) can hit every enemy it passes; below that it only lands its
      // first hit per leg (`s.legHit`), then keeps flying/returning without hitting anything else that leg.
      if (s.mine && (s.pierce > 0 || !s.legHit)) for (const e of lvl.enemies) {
        if (!e.spawned || !e.alive || e.state === 5 || s.hit.has(e)) continue;
        if (Math.abs(e.x - s.x) < 12 && Math.abs(e.z - s.z) < 14) { s.hit.add(e); s.legHit = true; hitEnemy(e, s.dmg + (ultra() ? 1 : 0), Math.sign(s.vx) || 1, false); if (s.pierce <= 0) break; }
      }
      continue;
    }
    s.x += s.vx; s.life--; if (s.kind === 5) s.vx *= 0.95;
    if (s.kind === 8) { s.vh -= 0.18; s.h += s.vh; if (s.h <= 0) { s.life = 0; explode(s); } continue; }
    if (s.kind === 10) { s.vh -= 0.18; s.h += s.vh; if (s.h <= 0) { s.life = 0; landSmoke(s); } continue; }
    if (!s.mine) continue;
    for (const e of lvl.enemies) {
      if (!e.spawned || !e.alive || e.state === 5 || s.hit.has(e)) continue;
      if (Math.abs(e.x - s.x) < 12 && Math.abs(e.z - s.z) < 14) {
        s.hit.add(e); hitEnemy(e, s.dmg + (ultra() ? 1 : 0), Math.sign(s.vx), s.kind === 5, { kb: s.kb, hr: s.hr, dragon: s.dragon });
        if ((s.kind === 7 || s.kind === 13) && --s.pierce > 0) continue;
        s.life = 0;
      }
    }
    if (s.kind === 7) for (const p of lvl.props) if (!p.broken && Math.abs(p.x - s.x) < 10 && Math.abs(p.z - s.z) < 10) { p.hp--; p.flash = 6; if (p.hp <= 0) breakProp(p); s.life = 0; }
  }
  shots = shots.filter(s => s.life > 0);
  // purses thrown by Karens, and (v1.1 A6) the world-specific thrown tricks - simulated on every screen, each player checks themselves
  for (const s of lvl.eshots) {
    s.x += s.vx; s.life--; s.spin++;
    if (s.k === 'pinecone') { // WOODS: an arcing pinecone that explodes in a small radius when it lands
      s.h = (s.h == null ? 8 : s.h) + (s.vh = (s.vh == null ? 2.2 : s.vh) - 0.14);
      if (s.h <= 0) {
        s.h = 0; s.life = 0; SFX.boom(); puff(s.x, sy(s.z) - 4, 8, ['#8a5a2a', '#c8ffa0', '#ffffff'], 1.4); shake = Math.max(shake, 4);
        if (state === 'play' && Math.abs(s.x - me.x) < 26 && Math.abs(s.z - me.z) < 16 && me.h < 20) hurt(1, 4, s.x);
      }
    } else if (s.k === 'sand') { // BEACH: sand throw that slows you down on hit, no direct damage
      if (state === 'play' && Math.abs(s.x - me.x) < 10 && Math.abs(s.z - me.z) < 8 && me.h < 7) { s.life = 0; me.slowT = Math.max(me.slowT || 0, 80); popup(me.x - 16, sy(me.z) - 34, 'SLOWED!', '#e8c896'); SFX.thud(); }
    } else if (s.k === 'drone') { // HQ: the cop's flying drone shoots down from above
      if (state === 'play' && Math.abs(s.x - me.x) < 9 && Math.abs(s.z - me.z) < 8 && me.h < 24) { s.life = 0; hurt(1, 3, s.x); }
    } else if (!s.k) { // plain purse throw
      if (state === 'play' && Math.abs(s.x - me.x) < 10 && Math.abs(s.z - me.z) < 8 && me.h < 7) { s.life = 0; hurt(1, 8, s.x); }
    }
    for (const p of shots) if (p.mine && Math.abs(p.x - s.x) < 10 && Math.abs(p.z - s.z) < 10) { s.life = 0; puff(s.x, sy(s.z, 14), 5, ['#ff7ac8', '#ffffff']); }
  }
  lvl.eshots = lvl.eshots.filter(s => s.life > 0);
  // WOODS poison clouds (essential-oil diffuser): grows for ~20 frames, then drains Cooked% like a slow bleed while you stand in it
  for (const c of lvl.clouds) if (c.poison) {
    if (c.grow > 0) { c.grow--; c.r = Math.min(16, c.r + 0.6); }
    else if (state === 'play' && Math.abs(me.x - c.x) < c.r && Math.abs(me.z - c.z) < c.r * 0.6 && frame % 40 === 0) { addCooked(-2); popup(me.x - 20, sy(me.z) - 34, 'YUCK!', '#c8ffa0'); SFX.drip(); }
  }
}

// ============================================================
//  UPDATE
// ============================================================
function update() {
  if (paused && !menu) return;
  // v1.2 (Step 8.4): slow-motion on a big story beat (currently: the killing blow on a world's mega
  // boss - see onKill). Runs updates at 1/3 speed for slowmo frames while draw() keeps rendering every
  // rAF, which reads as smooth slow-mo rather than the hard freeze `hitstop` gives.
  if (slowmo > 0) { slowmo--; if (slowmo % 3) return; }
  frame++;
  if (frame % 600 === 0 && running) { save.stats.playSec += 10; }
  if (banner && --banner.t <= 0) banner = null;
  if (crewComboT > 0 && --crewComboT <= 0) crewCombo = 0;
  const clearIn = () => { K.jumpPressed = K.enterPressed = K.attackPressed = K.throwPressed = false; K.nav = nextNav(); K.escPressed = false; if (state !== 'results') K.upPressed = K.downPressed = false; };
  // v1.1 B2/B3: while a transit mini-game (Hotbox Highway or a world-transition game) owns the #transitMount
  // overlay, the main game loop is fully paused - the mini-game runs its own independent rAF loop.
  if (state === 'transit') { clearIn(); return; }
  // v1.2 fix (Step 2.3): a crewmate who joins mid-ride never got the host's original `transit-start`
  // broadcast, so they can't launch the mini-game themselves - they just wait here (see the matching
  // `transit-wait` draw branch) until the host's `transit-end` (sent from launchTransit's onDone) sends
  // everyone back to the map together.
  if (state === 'transit-wait') { clearIn(); return; }
  if (updateTrans()) { clearIn(); return; }
  // v1.2 (Step 10.1): Online Soft Pause - freezes combat/physics/hostUpdate for the WHOLE crew (unlike the
  // personal menu, which by design never blocks anyone else). Anyone can lift it (Enter/jump, or opening
  // the menu and picking RESUME FOR THE CREW) - it's "soft" in that no one player owns the lock.
  if (softPause && !menu && (state === 'play' || state === 'sitting')) {
    if (K.enterPressed || K.jumpPressed) toggleSoftPause(false);
    K.jumpPressed = K.enterPressed = K.attackPressed = K.throwPressed = false; K.nav = nextNav(); K.upPressed = K.downPressed = false;
    return;
  }
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

  if (state === 'play' && !invOpen) { updatePlayer(); applyHazards(); }
  else if (state === 'sitting') {
    me.vx = me.vz = 0;
    if (frame % 8 === 0) puff(lvl.spot.x + 40, sy(-2) - 14, 1, ['#ffffff', '#e8e4f4', '#d4c8f8'], .3, -0.03);
    if (!Net.online && !Net.reconnecting && finInfo) {
      // v1.2 fix (Step 15.4): solo previously had no way to skip this wait at all - only the crew's
      // ENTER/SPACE-to-call online. Since there's no crew to wait FOR solo, let the same input jump
      // straight to results (matches the HUD hint added alongside this fix).
      if (K.enterPressed || K.jumpPressed) finInfo.t = 0;
      if (--finInfo.t <= 0 && !trans) go(toResults, true);
    }
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
    // v1.2 fix (Step 5): `cl` (Core level) rides along on the same snapshot so remotes' held-weapon visuals
    // can scale by tier too (see drawHeld/drawSlash), not just the local player's own.
    // v1.2 (Step 11.2): `ar` (armor tier, -1..3) rides along the same way `cl` does, so a crewmate's worn
    // armor is actually visible to everyone, not just a stat only they can see in their own Bag.
    Net.send({ t: 's', x: Math.round(me.x), y: Math.round(me.z), h: Math.round(me.h), l: lvl.n, a: animFrame(me), f: me.face, b: (me.star > 0 ? 1 : 0) | (ultra() ? 2 : 0) | (state === 'sitting' ? 4 : 0) | (me.down > 0 ? 8 : 0), w: WEAPONS.indexOf(weaponDef()), c: Math.round(me.cooked), hp: me.hp, mh: maxHp(), cl: coreLevel(), ar: armorTier() });
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
  // v1.3 (mechanic redesign, requested 2026-09-26): Cooked no longer passively fades. It used to drain
  // ~1%/3s to pressure players into hitting a 50% threshold before it decayed back down - but the 50%
  // exit gate is gone (see updateSpot), so that pressure had no payoff left, just friction: banked Cooked
  // is now a stash you spend on purpose (see hitAToke), so it should stay put until you use it.
  // v1.2 (Step 10.4): the in-game 4:20 moment - checked against the REAL clock (not a level timer), once
  // per real occurrence per level (me.saw420, reset fresh by makePlayer() every level). A genuine, if
  // silly, real-world Easter egg with a real bonus, exactly as the brief asks for both halves of it.
  if (!me.saw420 && state === 'play') {
    const d = new Date();
    if (d.getHours() % 12 === 4 && d.getMinutes() === 20) {
      me.saw420 = true; addCoins(420); me.cooked = Math.min(100, me.cooked + 20);
      banner = { t: 260, a: "IT'S 4:20!", b: 'BONUS +420 COINS AND +20% COOKED - BLAZE ON' }; SFX.power();
    }
  }
  // v1.2 (Step 10.4): "DID YOU HEAR THAT?" - a purely ambient stoner-touch gag (brief's own example), a
  // rare ghost-siren cue with no cop, no real gameplay effect, cosmetic-only so it needs no network sync.
  if (frame % 2500 === 1250 && Math.random() < 0.15 && state === 'play' && !(lvl.boss && lvl.boss.alive)) {
    popup(me.x - 24, sy(me.z) - 40, 'DID YOU HEAR THAT?', '#b0a8c0'); SFX.bump();
  }
  if (me.down > 0) { // waiting for a revive
    me.vx = me.vz = 0; me.atkT = 0;
    if (--me.down <= 0) { me.inv = 0; knockedOutFinal(); }
    return;
  }
  // reviving a downed homie: hold E next to them
  let nearDown = false;
  if (K.use) for (const [id, r] of remotes) if (r.b & 8 && Math.abs(r.x - me.x) < 18 && Math.abs(r.z - me.z) < 12) {
    nearDown = true;
    const inCloud = lvl.clouds.some(c => Math.abs(me.x - c.x) < c.r && Math.abs(me.z - c.z) < c.r * 0.6);
    me.reviveT = (me.reviveT || 0) + (inCloud ? 2 : 1); // reviving inside a smoke cloud is 2x faster
    if (me.reviveT % 10 < (inCloud ? 2 : 1)) puff(r.x, sy(r.z) - 8, 3, ['#c8ffa0', '#ffffff'], .6, -0.03);
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
  // v1.1 A6: world-trick status effects on the player (stun = can't move/attack, root = can't move but can still swing, slow = half speed, blind = white screen flash)
  if (me.stunT > 0) me.stunT--;
  if (me.rootT > 0) { me.rootT--; if (Net.online && remotes.size > 0) for (const r of remotes.values()) if (r.l === lvl.n && Math.abs(r.x - me.x) < 20 && Math.abs(r.z - me.z) < 14) { me.rootT -= 1.5; break; } } // a nearby teammate mashes you free faster (WOODS net launcher)
  if (me.slowT > 0) me.slowT--;
  if (me.blindT > 0) me.blindT--;
  const p = me, spd = (p.buffs.speed > 0 ? 1.45 : 1) * (hasSkill('sprint') ? 1.2 : 1) * farmSpeedMul() * (me.slowT > 0 ? 0.5 : 1);
  const highSlow = tooHigh() ? 0.9 : 1;
  const mx = (K.run ? 2.1 : 1.3) * spd * (Net.color === 1 ? 1.1 : 1) * highSlow, mz = (K.run ? 1.3 : 0.9) * spd * (Net.color === 1 ? 1.1 : 1) * highSlow;
  let ix = (K.right ? 1 : 0) - (K.left ? 1 : 0), iz = (K.down ? 1 : 0) - (K.up ? 1 : 0);
  if (p.atkT > 6 && p.h === 0) { ix = 0; iz = 0; } // plant your feet while swinging
  if (me.stunT > 0 || me.rootT > 0) { ix = 0; iz = 0; }
  if (ix) p.face = ix;
  if (mouseG && !chatOpen && p.atkT <= 6) { const sx = p.x - camX; if (Math.abs(mouseG.x - sx) > 3) p.face = mouseG.x > sx ? 1 : -1; } // aim with the mouse; WASD still moves
  if (p.roll > 0) { p.roll--; if (hasSkill('rollsmoke') && frame % 3 === 0) { puff(p.x, sy(p.z) - 6, 3, ['#ffffff', '#c8ffa0'], .6); for (const e of lvl.enemies) if (e.spawned && e.alive && e.state !== 5 && Math.abs(e.x - p.x) < 14 && Math.abs(e.z - p.z) < 10 && !(e.rollHit > frame)) { e.rollHit = frame + 30; hitEnemy(e, 1, Math.sign(e.x - p.x) || 1, false, { burn: 1 }); } } }
  else if (p.inv > 55) { /* knockback */ } else { p.vx += (ix * mx - p.vx) * 0.3; p.vz += (iz * mz - p.vz) * 0.3; }
  if (p.puffed) { p.vx *= 0.9; p.vz *= 0.9; }

  if (K.jumpPressed) p.jumpBuf = 6; else if (p.jumpBuf > 0) p.jumpBuf--;
  if (p.jumpBuf > 0 && K.run && (hasSkill('roll') || p.buffs.dash > 0) && p.h === 0 && !(p.roll > 0) && (ix || iz)) {
    p.roll = 20; p.jumpBuf = 0; p.vx = (ix || p.face) * 4.2; p.vz = iz * 2.4; p.inv = Math.max(p.inv, 22); SFX.flap(); puff(p.x, sy(p.z) - 4, 5, ['#ffffff', '#e8e0d0'], .8);
  } else if (K.block && (ix || iz) && p.h === 0 && !(p.roll > 0) && (p.rollCd || 0) <= 0) { // BLOCK + direction: dodge roll with i-frames, 1s cooldown
    p.roll = 20; p.rollCd = 60; p.vx = (ix || p.face) * 4.2; p.vz = iz * 2.4; p.inv = Math.max(p.inv, 22); SFX.flap(); puff(p.x, sy(p.z) - 4, 5, ['#ffffff', '#e8e0d0'], .8);
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
  // v1.2 (Step 6.1): CHASE levels never lock a zone (see below) and must let the crew run straight through
  // an unfinished fight rather than walling them at its edge - that's the whole "keep moving" point of the type.
  if (!lvl.locked && !lvl.chase) { // can't run past the next fight until it's started
    const next = lvl.zones.find(z => !z.cleared);
    if (next && next.started && p.x > next.x0 + ZW - 8) p.x = next.x0 + ZW - 8;
  }
  // v1.2 (Step 6.1): CHASE - an auto-scrolling threat (a wall of "narcs") advances at a fixed pace behind
  // you; fall behind it and you take periodic damage and get shoved forward. Cosmetic/self-inflicted only
  // (each client runs its own frame counter), so no network sync is needed.
  if (lvl.chase && state === 'play') {
    lvl.locked = false;
    lvl.chaseX = (lvl.chaseX || 0) + 0.62;
    if (p.x < lvl.chaseX + 26) {
      p.x = Math.max(p.x, lvl.chaseX + 4);
      if (frame % 40 === 0) { hurt(1, 2, lvl.chaseX); popup(p.x - 14, sy(p.z) - 34, 'CAUGHT UP!', '#ff5a6a'); }
    }
  }

  // v1.2 fix (Step 5.3): BONG tap vs hold is its OWN input rule, not gated behind the `charge` skill -
  // every Bong player gets tap=smash/hold=blast, regardless of whether they've learned Charged Swings.
  const usingBong = weaponDef().id === 'bong' && !(p.envWeapon && p.wildOn);
  const canCharge = hasSkill('charge') || usingBong;
  if (me.stunT > 0) { /* BEACH taser / DOWNTOWN camera-flash: stunned, can't swing */ }
  else if (K.attackPressed) attack();
  else if (settings.holdAttack && K.attack && !canCharge && p.atkCd <= 0) attack();
  if (K.attack && canCharge) { p.holdT = (p.holdT || 0) + 1; if (p.holdT > 30 && frame % 4 === 0) puff(p.x + p.face * 10, sy(p.z, p.h) - 14, 2, ['#ffd84a', '#ffffff'], .5, -0.03); }
  else { if (p.holdT > 30) attack(true); p.holdT = 0; }
  if (K.toke) { p.tokeT = (p.tokeT || 0) + 1; if (p.tokeT > 25 && hasSkill('breath') && p.cooked > 1) { p.cooked -= 0.3; if (frame % 5 === 0) breathFire(); } }
  else { if (p.tokeT > 0 && p.tokeT <= 25) hitAToke(p.tokeT >= 14); p.tokeT = 0; }
  if (hasSkill('regen') && p.cooked >= 50 && frame % 480 === 0 && p.hp < maxHp()) { p.hp++; popup(p.x - 8, sy(p.z) - 34, '+1 HEART', '#ff9ab8'); }
  if (hasSkill('magnet')) for (const it of lvl.items) if (!it.taken && it.kind === 'coin') { const dx = p.x - it.x, dz = p.z - it.z, d = Math.hypot(dx, dz); if (d < 56 && d > 1) { it.x += dx / d * 2; it.z += dz / d * 2; } }
  for (const c of lvl.clouds) if (c.heal && Math.abs(c.x - p.x) < c.r && Math.abs(c.z - p.z) < c.r * 0.5 && frame % 120 === 0 && p.hp < maxHp()) { p.hp++; popup(p.x - 8, sy(p.z) - 34, 'PUFF PUFF +1', '#c8ffa0'); }
  // standing in a crewmate's cloud (not your own) gives a slow Cooked regen - the co-op payoff
  for (const c of lvl.clouds) if (c.by !== Net.id && Math.abs(c.x - p.x) < c.r && Math.abs(c.z - p.z) < c.r * 0.6 && frame % 60 === 0 && p.cooked < 100) { addCooked(1); break; }
  if (p.atkCd > 0) p.atkCd--;
  if (p.rollCd > 0) p.rollCd--;
  if (p.parryT > 0) p.parryT--;
  if (K.block && p.parryT <= 0 && frame % 30 === 0 && p.cooked > 0) p.cooked = Math.max(0, p.cooked - 1); // holding block drains Cooked slowly
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
    if (p.buffs.magnet > 0) { const dx = p.x - it.x, dz = p.z - it.z, d = Math.hypot(dx, dz); if (d < 90 && d > 1) { it.x += dx / d * 3; it.z += dz / d * 3; } }
    if (Math.abs(it.x - p.x) < 12 && Math.abs(it.z - p.z) < 12 && Math.abs((it.h || 0) - p.h) < 22) {
      if (it.kind === 'envweapon') { if (K.attackPressed && !p.envWeapon) pickUp(it); }
      else pickUp(it);
    }
  }
  // thieves
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive || (e.ai !== 'mouse' && e.ai !== 'squirrel') || e.state !== 0) continue;
    if (Math.abs(e.x - p.x) < 10 && Math.abs(e.z - p.z) < 7 && p.h < 10 && !(p.stealCd[e.id] > frame)) {
      p.stealCd[e.id] = frame + 120;
      const base = Math.min(save.coins, e.ai === 'mouse' ? 5 : 8), k = save.pouch ? Math.round(base / 2) : base;
      const thiefBonus = save.pouch && k > 0 ? 1 : 0; // STASH POUCH: halves theft instead of blocking it, but the thief gets a small bonus coin
      if (k) { save.coins -= k; p.lost += k; popup(p.x - 16, sy(p.z) - 36, '-' + k + ' STOLEN!' + (save.pouch ? ' (POUCH HALVED IT)' : ''), '#ff8a8a'); SFX.steal(); }
      else if (!(p.nothingT > frame)) { p.nothingT = frame + 180; popup(p.x - 16, sy(p.z) - 36, 'NOTHING TO STEAL LOL', '#ff8a8a'); }
      if (isHost()) thiefFlee(e, k + thiefBonus); else Net.send({ t: 'steal', i: e.id, k: k + thiefBonus, l: lvl.n });
    }
  }
  // enemy attacks that reach me
  for (const e of lvl.enemies) {
    if (!e.spawned || !e.alive) continue;
    const dx = p.x - e.x, dzp = p.z - e.z;
    if (e.boss) {
      if (e.state !== 2 || e.hitMe === e.strikeN) continue;
      if ((e.dash ? Math.abs(dx) < 22 : dx * e.dir > -6 && Math.abs(dx) < 44) && Math.abs(dzp) < 14 && p.h < 20) { e.hitMe = e.strikeN; hurt(e.mega ? 2 : 1, 5, e.x); }
      continue;
    }
    if (e.ai === 'cop') {
      if (e.state === 2) { if (e.hitMe !== e.strikeN && dx * e.dir > -4 && Math.abs(dx) < 28 && Math.abs(dzp) < 8 && p.h < 14) { e.hitMe = e.strikeN; hurt(1, 2, e.x); } }
      // v1.1 A6: BEACH taser lunge - a short stun, shorter range than the baton
      else if (e.state === 11) { if (e.hitMe !== e.strikeN && dx * e.dir > -4 && Math.abs(dx) < 20 && Math.abs(dzp) < 8 && p.h < 12) { e.hitMe = e.strikeN; me.stunT = Math.max(me.stunT || 0, 46); shake = Math.max(shake, 6); SFX.taser(); popup(p.x - 14, sy(p.z) - 34, 'TASED!', '#9ae8ff'); } }
      // SUBURBIA pepper-spray cone: damage + a short blind/slow
      else if (e.state === 16) { if (e.hitMe !== e.strikeN && dx * e.dir > -6 && Math.abs(dx) < 40 && Math.abs(dzp) < 16 && p.h < 16) { e.hitMe = e.strikeN; me.blindT = Math.max(me.blindT || 0, 20); me.slowT = Math.max(me.slowT || 0, 60); hurt(1, 2, e.x); SFX.spray(); } }
      // WOODS net launcher: no damage, but roots you for a while
      else if (e.state === 18) { if (e.hitMe !== e.strikeN && dx * e.dir > -8 && Math.abs(dx) < 60 && Math.abs(dzp) < 14 && p.h < 20) { e.hitMe = e.strikeN; me.rootT = Math.max(me.rootT || 0, 105); SFX.net(); popup(p.x - 14, sy(p.z) - 34, 'NETTED!', '#c8ffa0'); } }
    } else if (e.ai === 'karen') {
      // BEACH sunscreen spray: a radial screen-blind, no real damage
      if (e.state === 21) { if (e.hitMe !== e.strikeN && Math.abs(dx) < 90 && Math.abs(dzp) < 22) { e.hitMe = e.strikeN; me.blindT = Math.max(me.blindT || 0, 36); SFX.spray(); } }
      // SUBURBIA leaf-blower: knocks you straight back
      else if (e.state === 23) { if (e.hitMe !== e.strikeN && dx * e.dir > -8 && Math.abs(dx) < 70 && Math.abs(dzp) < 20) { e.hitMe = e.strikeN; me.vx = (dx > 0 ? 1 : -1) * 5.5; me.vz = Math.sign(dzp || 1) * 1.5; SFX.blow(); popup(p.x - 20, sy(p.z) - 34, 'BLOWN BACK!', '#c8ffa0'); } }
      // DOWNTOWN camera flash: stuns + blinds (the backup call is handled host-side)
      else if (e.state === 26) { if (e.hitMe !== e.strikeN && Math.abs(dx) < 70 && Math.abs(dzp) < 20) { e.hitMe = e.strikeN; me.stunT = Math.max(me.stunT || 0, 42); me.blindT = Math.max(me.blindT || 0, 26); SFX.flash(); } }
    }
  }
  // legend
  const lg = lvl.legend;
  if (lg && !lg.met && Math.abs(p.x - lg.x) < 20 && Math.abs(p.z - lg.z) < 14) {
    lg.met = true; const L = LEGENDS[lg.who]; SFX.power();
    if (L.gift === 'cooked') { addCooked(20); lg.gift = '+20% COOKED'; }
    else if (L.gift === 'heal') { p.hp = maxHp(); lg.gift = 'FULL HEARTS'; }
    else { addCoins(40); lg.gift = '+40 HASH COINS'; }
    p.legendT = 300;
    checkpoint = { x: lg.x, z: 8 }; // v1.2 (Step 6.5): the legend NPC is one of the only 2 checkpoint spots now
  }
  if (p.legendT > 0) p.legendT--;
  // the smoke spot
  // v1.3 (mechanic redesign, requested 2026-09-26): the exit used to require Cooked >= 50%, bouncing the
  // player back with "NOT COOKED ENOUGH!" if they arrived short - the exact wall the player got stuck on.
  // Reaching the spot already means every fight zone is cleared (lvl.locked gates movement past an active
  // zone - see updateCamera/the zone-trigger code), so that was a redundant second gate on top of a real
  // one. Dropping it: clearing the level is what opens the spot now, not a resource-bar threshold.
  const spot = lvl.spot;
  if (p.x > spot.x && p.x < spot.x + spot.w + 20) {
    if (!lvl.locked) sitDown();
    else if (!p.spotWarnT || frame > p.spotWarnT) {
      p.spotWarnT = frame + 120;
      banner = { t: 100, a: 'STILL FIGHTING!', b: 'CLEAR THE CURRENT FIGHT FIRST' };
    }
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
// v1.2 (Step 7.1): S/A/B/C grade from time, crew lives lost, whether this level's own hidden secret was
// found, coins collected, and best combo - a weighted 0-100 score, tuned against World 1's real level
// lengths/coin totals (see Step 6's logged 50-107 coins/level and this level's own zone count for pacing).
function computeGrade(n, { frames, livesLost, secretFound, coinsEarned, bestCombo }) {
  const zoneCount = lvl && lvl.zones ? lvl.zones.length : 6;
  const parFrames = 900 + zoneCount * 480; // ~15s intro + ~8s/zone at 60fps - a generous par, not a speedrun target
  const timeScore = Math.max(0, Math.min(100, 100 - (frames - parFrames) / parFrames * 60));
  const livesScore = livesLost <= 0 ? 100 : livesLost === 1 ? 65 : livesLost === 2 ? 30 : 0;
  const secretScore = secretFound ? 100 : 35;
  const coinsScore = Math.max(0, Math.min(100, coinsEarned / 80 * 100));
  const comboScore = Math.max(0, Math.min(100, bestCombo * 9));
  const total = timeScore * 0.3 + livesScore * 0.25 + secretScore * 0.15 + coinsScore * 0.15 + comboScore * 0.15;
  return total >= 90 ? 'S' : total >= 75 ? 'A' : total >= 55 ? 'B' : 'C';
}
const GRADE_RANK = { S: 4, A: 3, B: 2, C: 1 };
// v1.2 (Step 7.6): "an S grade on all 6 world bosses" - checked against the saved per-level best grades.
function astralUnlocked() { return WORLDS.every((w, i) => save.grades && save.grades[WORLD_START[i] + w.bossAt] === 'S'); }
function saveBestGrade(n, grade) { // v1.2 (Step 7.2): the best grade earned for a level is kept, never overwritten by a worse replay
  save.grades = save.grades || {};
  if (!save.grades[n] || GRADE_RANK[grade] > GRADE_RANK[save.grades[n]]) save.grades[n] = grade;
}
// v1.2 (Step 10.3): DJ Dank's results-screen roast/praise. Picked from the same run stats the results
// screen already shows (grade, combo, cooked%, lives lost, deaths this run) - not new tracking, just a
// new line of commentary read off the existing numbers.
function djDankLine(made, grade, best, cookedPct, livesLost) {
  if (!made) return "DJ DANK: \"...AND THAT'S WHY WE DON'T SKIP LEG DAY. OR ANY DAY.\"";
  if (grade === 'S') return 'DJ DANK: "OKAY OKAY, WE GOT A PRO OVER HERE!"';
  if (livesLost >= 3) return 'DJ DANK: "MAN GOT MORE LIVES LOST THAN A HORROR MOVIE EXTRA."';
  if (best >= 15) return 'DJ DANK: "THAT COMBO WAS DISGUSTING. RESPECT."';
  if (cookedPct >= 100) return 'DJ DANK: "ULTRA COOKED AND STILL STANDING. LEGENDARY."';
  if (grade === 'C') return 'DJ DANK: "IT WASN\'T PRETTY BUT WE MADE IT, FOLKS."';
  return 'DJ DANK: "SOLID RUN. GRAB A SNACK, YOU EARNED IT."';
}
function toResults() {
  if (state === 'results') return;
  const made = state === 'sitting';
  const ultraBonus = made && ultra() ? Math.round(me.earned * 0.25) : 0; // v1.2 fix (Step 1.3): was a full x2 (+100%) of earned coins - brief calls for +25%
  const spotBonus = made ? 50 + lvl.n * 10 : 0;
  addCoins(ultraBonus + spotBonus);
  const wasFirstClear = made && lvl.n >= save.spots; // v1.2 (Step 10.3): "NEW:" highlight input - never cleared before
  if (made && !lvl.daily && !lvl.remix) save.spots = Math.max(save.spots, lvl.n + 1); // daily challenges + remix replays don't advance world progress
  let dailyBonus = 0;
  if (made && lvl.daily && save.dailyDate !== todayStr()) { dailyBonus = 200; save.dailyDate = todayStr(); addCoins(dailyBonus); }
  save.stats.kills += me.kills; save.stats.bestCombo = Math.max(save.stats.bestCombo, me.best);
  let grade = null, isNewBest = false, livesLost = 0;
  if (made) {
    livesLost = Math.max(0, (lvl.livesStart == null ? crewLives : lvl.livesStart) - crewLives);
    grade = computeGrade(lvl.n, { frames: frame - (lvl.startFrame || frame), livesLost, secretFound: !!lvl.secretFoundThisRun, coinsEarned: me.earned, bestCombo: me.best });
    const prevBest = save.grades && save.grades[lvl.n];
    saveBestGrade(lvl.n, grade);
    isNewBest = !prevBest || GRADE_RANK[grade] > GRADE_RANK[prevBest];
  }
  // v1.2 (Step 10.3): "NEW:" highlights - every genuinely first-time thing this run unlocked or achieved,
  // collected in one array so drawShop's results screen can just list whatever's actually in it.
  const newThings = [];
  if (wasFirstClear) newThings.push('NEW: LEVEL CLEARED');
  if (isNewBest && grade) newThings.push('NEW: GRADE ' + grade + (grade === 'S' ? ' (BEST POSSIBLE!)' : ''));
  if (dailyBonus > 0) newThings.push('NEW: DAILY BONUS +' + dailyBonus);
  if (made && lvl.secretFoundThisRun) newThings.push('NEW: SECRET FOUND');
  const roast = djDankLine(made, grade, me.best, Math.round(me.cooked), livesLost);
  persist();
  results = { made, earned: me.earned, lost: me.lost, spotBonus, ultraBonus, dailyBonus, cooked: Math.round(me.cooked), kills: me.kills, best: me.best, nugs: me.nugs, grade, isNewBest, newThings, roast };
  // v1.2 (Step 11.1): Smoke Runs - a real level clear (daily or not) submits to the server leaderboard,
  // keyed by level number (plus the daily seed, for daily runs specifically - so today's board doesn't
  // mix with an ordinary replay of the same level). Score is this run's own coin haul, the simplest
  // real number every run already produces; the grade rides along for display.
  if (made) submitScore(lvl.n, me.earned + spotBonus + ultraBonus + dailyBonus, grade, lvl.daily ? todaySeed() : null);
  state = 'results'; shopSel = 0; hurryT = 0; banner = null;
}

// v1.2 (Step 11.2): share card - composites a snapshot of the current game canvas (whatever's on screen -
// the results screen when called from there, or the farm hub when called from farmSnapshot() below) onto
// a bigger card with a title/stat strip, then downloads it as a real PNG via canvas.toBlob(). No server
// round-trip needed - it's just compositing what's already drawn.
function shareCard() {
  try {
    const scale = 2, pad = 10, stripH = 34;
    const c = document.createElement('canvas'); c.width = cv.width * scale + pad * 2; c.height = cv.height * scale + pad * 2 + stripH;
    const g = c.getContext('2d');
    g.fillStyle = '#1a1028'; g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(cv, pad, pad, cv.width * scale, cv.height * scale);
    g.fillStyle = '#c8ffa0'; g.font = 'bold 16px monospace'; g.textAlign = 'center';
    const r = results;
    const line1 = 'KUSH QUEST - SMOKE SPOT ' + (lvl.n + 1) + ' REACHED' + (r && r.grade ? ' - GRADE ' + r.grade : '');
    g.fillText(line1, c.width / 2, c.height - stripH + 16);
    g.fillStyle = '#ffd84a'; g.font = '11px monospace';
    const line2 = r ? ('COINS +' + r.earned + '   COOKED ' + r.cooked + '%   KOS ' + r.kills) : 'KUSHQUEST.ONRENDER.COM';
    g.fillText(line2, c.width / 2, c.height - stripH + 30);
    c.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = 'kush-quest-run.png'; document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
  } catch (e) { console.error('shareCard failed', e); }
}

// ============================================================
//  ENEMY AI (runs on the host's screen, synced to the crew)
// ============================================================
function playersList() {
  // v1.2 (Step 10.1): a Spectator (self or remote) never counts as a real crewmate here - excluded from
  // both entries below so they can't trigger zone fights, hazards, or crew-lives math just by being on screen.
  const list = me.spectator ? [] : [{ id: Net.id, x: me.x, z: me.z, h: me.h, ok: state === 'play' && me.inv < 60 && !(me.down > 0) }];
  for (const [id, r] of remotes) if (!r.spectate && r.l === lvl.n && r.tx > -500 && !(r.b & 12)) list.push({ id, x: r.x, z: r.z, h: r.h, ok: true });
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
  // v1.2 (Step 6.4): mini-bosses (e.mini) now get the same phase-toggled 2nd attack pattern mega bosses
  // already had (ranged volleys alternating with the brawler pattern below) - was mega-only before, so
  // every mini-boss only ever used one pattern.
  const shooter = e.ai === 'karen' || ((e.mega || e.mini) && e.phase);
  if (shooter) { // keep distance, throw volleys
    const side = e.x < tgt.x ? -1 : 1, wantX = tgt.x + side * 84;
    if (e.cd <= 0 && Math.abs(dz) < 20) {
      e.cd = Math.round(110 / spd); e.state = 3; e.t = 40; e.phase = (e.mega || e.mini) ? !e.phase : e.phase;
      for (const oz of rage ? [-18, -8, 0, 8, 18] : [-12, 0, 12]) { const shot = { x: e.x + e.dir * 12, z: Math.max(0, Math.min(ZMAX, e.z + oz)), vx: e.dir * 1.7, life: 170, spin: 0 }; lvl.eshots.push(shot); Net.send({ t: 'eshot', x: Math.round(shot.x), z: Math.round(shot.z), vx: shot.vx, l: lvl.n }); }
      SFX.karen(); if (Math.random() < .4) popup(e.x - 20, sy(e.z) - 50, e.quote.split(' ').slice(0, 3).join(' '), '#ffb0b0');
    }
    return [Math.sign(wantX - e.x) * Math.min(0.6 * spd, Math.abs(wantX - e.x)), Math.sign(dz) * Math.min(0.6, Math.abs(dz))];
  }
  // brawler: walk up and swing, or wind up a charging dash
  if (e.cd <= 0 && Math.abs(dx) > 50 && Math.abs(dz) < 14) { e.state = 1; e.t = 34; e.dash = true; e.dashDir = e.dir; e.cd = Math.round(170 / spd); e.phase = (e.mega || e.mini) ? !e.phase : e.phase; return [0, 0]; }
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
  const wk = lvl.theme.base || lvl.themeKey; // v1.1 A6: which world's enemy tricks are active this mission
  // fight areas: start when someone walks in, clear when everyone's down
  const nz = lvl.zones.findIndex(z => !z.cleared);
  if (nz >= 0) {
    const z = lvl.zones[nz];
    if (!z.started && players.some(p => p.x > z.x0 + 70)) {
      z.started = true; lvl.zi = nz; lvl.locked = true; z.spawnT = 0;
      if (z.ambush) { banner = { t: 130, a: 'AMBUSH!', b: "THEY'RE COMING FROM BOTH SIDES!" }; SFX.karen(); shake = Math.max(shake, 6); }
      const crew = players.length, need = Math.round(z.base * (1 + 0.55 * (crew - 1)));
      z.ids.filter(i => !lvl.enemies[i].boss).slice(need).forEach(i => { lvl.enemies[i].alive = false; lvl.enemies[i].skipped = true; });
      z.maxOn = 5 + 2 * (crew - 1);
      // v1.2 (Step 6.5): checkpoints only at the legend NPC (see updatePlayer) and the boss arena start -
      // not at every cleared zone anymore. The boss zone is always the last one.
      if (nz === lvl.zones.length - 1) checkpoint = { x: z.x0 + 20, z: 30 };
      if (z.gauntlet) { z.timer = 2700; banner = { t: 90, a: 'SURVIVE!', b: 'HOLD THIS SPOT FOR 45 SECONDS' }; }
      else banner = { t: 70, a: 'HERE THEY COME!', b: '' };
      SFX.karen();
    }
    if (z.started && !z.cleared) {
      const alive = z.ids.map(i => lvl.enemies[i]).filter(e => e.alive);
      const onScreen = alive.filter(e => e.spawned).length;
      const waiting = alive.filter(e => !e.spawned);
      if (z.spawnT == null) z.spawnT = 0;
      if (!z.maxOn) z.maxOn = 5 + 2 * (players.length - 1);
      const nonBoss = waiting.filter(e => !e.boss);
      if (waiting.length && onScreen < z.maxOn && --z.spawnT <= 0 && (nonBoss.length || onScreen <= 2)) {
        const e = nonBoss[0] || waiting[0], fromLeft = z.ambush ? e.id % 2 === 0 : e.id % 3 === 0;
        e.spawned = true; e.x = fromLeft ? Math.min(z.x0 - 20, camX - 20) : Math.max(z.x0 + ZW + 20, camX + W + 20); z.spawnN = (z.spawnN || 0) + 1; e.z = 6 + ((e.id * 37 + z.spawnN * 19) % (ZMAX - 12)); e.dir = fromLeft ? 1 : -1;
        z.spawnT = z.ambush ? (onScreen < 3 ? 6 : 20) : onScreen < 2 ? 12 : 34;
        if (e.boss) { e.x = z.x0 + ZW + 30; e.dir = -1; e.z = ZMAX / 2; bossIntro(e); Net.send({ t: 'boss', i: e.id, l: lvl.n }); }
      }
      // v1.2 (Step 6.1): GAUNTLET - survive a timer instead of requiring every enemy dead. Waves keep
      // dripping in from the (bigger) pool via the spawn logic above, unchanged; when the timer runs out
      // (or the pool genuinely runs dry) the arena clears regardless of who's still standing.
      if (z.gauntlet) {
        if (z.timer == null) z.timer = 2700;
        if (--z.timer === 150) banner = { t: 90, a: 'ALMOST THERE!', b: '' };
        if (z.timer <= 0 || (!alive.length && !waiting.length)) {
          for (const e of alive) if (e.spawned) { e.alive = false; e.state = 5; e.t = 30; }
          z.cleared = true; lvl.locked = false; banner = { t: 110, a: 'GAUNTLET CLEARED!', b: '' }; SFX.cp();
        }
      } else if (!alive.length) { z.cleared = true; lvl.locked = false; banner = { t: 90, a: 'GO GO GO!', b: '' }; SFX.cp(); }
    }
  }
  // v1.2 (Step 6.1): ESCORT - the homie NPC waits outside an active fight (taking chip damage from nearby
  // enemies) and otherwise walks steadily toward the next zone. Host-authoritative; hp<=0 fails the level
  // through the exact same restartLevelOutOfLives() path a crew wipe already uses (fully tested, synced).
  if (lvl.escort && lvl.escort.alive) {
    const es = lvl.escort, z2 = lvl.zones[lvl.zi];
    if (z2 && z2.started && !z2.cleared) {
      es.x = Math.min(es.x, z2.x0 - 10); es.z = 20;
      if (frame % 45 === 0) {
        const near = z2.ids.map(i => lvl.enemies[i]).filter(e => e.alive && e.spawned && Math.abs(e.x - es.x) < 40 && Math.abs(e.z - es.z) < 24);
        if (near.length) {
          es.hp -= near.length; puff(es.x, sy(es.z) - 10, 4, ['#ff5a6a', '#ffffff'], .8); shake = Math.max(shake, 4);
          if (es.hp <= 0) { es.hp = 0; es.alive = false; banner = { t: 140, a: 'THE HOMIE WENT DOWN!', b: '' }; SFX.bump(); restartLevelOutOfLives(); }
        }
      }
    } else {
      const nextZ = lvl.zones[lvl.zi + 1] || lvl.zones[lvl.zones.length - 1];
      es.x = Math.min(es.x + 0.55, (nextZ ? nextZ.x0 - 10 : LEN - 20)); es.z = 20;
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
    // target the closest homie - a player hidden in a smoke cloud gets skipped unless everyone's hidden
    let tgt = null, best = 1e9, bestAny = null, bestAnyD = 1e9;
    for (const p of players) {
      if (!p.ok) continue;
      const d = Math.abs(p.x - e.x) + Math.abs(p.z - e.z) * 2;
      if (d < bestAnyD) { bestAnyD = d; bestAny = p; }
      const hidden = !e.boss && lvl.clouds.some(c => Math.abs(p.x - c.x) < c.r && Math.abs(p.z - c.z) < c.r * 0.6);
      if (hidden) continue;
      if (d < best) { best = d; tgt = p; }
    }
    if (!tgt) tgt = bestAny || players[0];
    const dx = tgt.x - e.x, dz = tgt.z - e.z;
    if (e.buffed > 0) e.buffed--; // HQ clipboard Karen's write-up buff wears off
    e.vh -= 0.2; e.h = Math.max(0, e.h + e.vh); if (e.h === 0) e.vh = 0;
    if (e.burn > 0 && --e.burnT <= 0) {
      e.burnT = 36; e.burn--; e.hp -= 1; e.flash = 4;
      if (e.spread) { const sr = 16 * e.spread; for (const o of lvl.enemies) if (o !== e && o.spawned && o.alive && o.state !== 5 && !(o.burn > 0) && Math.abs(o.x - e.x) < sr && Math.abs(o.z - e.z) < 10) { o.burn = 1; o.burnT = 36; o.burnBy = e.burnBy; } }
      if (e.hp <= 0) { damageEnemy(e, 0, e.dir * -1, false, e.burnBy); continue; }
    }
    if (e.bleedN > 0 && --e.bleedT <= 0) { e.bleedT = 44; e.bleedN--; e.hp -= 1; e.flash = 4; if (e.hp <= 0) { damageEnemy(e, 0, e.dir * -1, false, e.bleedBy); continue; } }
    if (e.flying) {
      for (const o of lvl.enemies) if (o !== e && o.spawned && o.alive && o.state !== 5 && Math.abs(o.x - e.x) < 14 && Math.abs(o.z - e.z) < 10 && !(o.bowled === e.id)) { o.bowled = e.id; damageEnemy(o, 2, e.flying.dir, true, e.flying.by, { kb: 1.5 }); }
      // BLUNT BAT LV3: a launched enemy bounces off the fight-area walls and keeps hitting more enemies
      if (e.flying.lv3 && e.flying.bounces > 0 && (e.x <= zMin + 4 || e.x >= zMax - 4) && Math.abs(e.vx) > 0.5) {
        e.vx *= -0.8; e.flying.bounces--; e.flying.dir *= -1; e.bowled = null; shake = Math.max(shake, 3); puff(e.x, sy(e.z, e.h), 4, ['#ffffff']);
      }
      if (e.h === 0 && e.vh <= 0) { e.flying = null; shake = Math.max(shake, 4); puff(e.x, sy(e.z), 6, ['#e8e0d0', '#ffffff'], 1); }
    }
    if (e.state === 4) { e.x += e.vx; e.vx *= 0.85; if (--e.t <= 0) { e.state = 0; e.stunned = 0; } continue; }
    let sx = 0, sz = 0;
    // smoke screens: confused buzzkills wander and can't attack; hotbox smoke burns them
    let inCloud = null;
    for (const c of lvl.clouds) if (!c.slow && Math.abs(e.x - c.x) < c.r && Math.abs(e.z - c.z) < c.r * 0.6) { inCloud = c; break; }
    // v1.2 fix (Step 5.2): GRINDER's Lv10 "Kief Cyclone" leaves a cloud that slows enemies - a gentler
    // effect than the full wandering-confusion above (that's `!c.slow` clouds only), so it's checked
    // separately and just cuts movement speed rather than taking over the enemy's AI state.
    const slowed = lvl.clouds.some(c => c.slow && Math.abs(e.x - c.x) < c.r && Math.abs(e.z - c.z) < c.r * 0.6);
    if (inCloud && !e.boss) {
      if (inCloud.hot && frame % 60 === (e.id % 60)) damageEnemy(e, 1, 0, false, inCloud.by);
      // confused buzzkills can bump into and hurt each other inside the smoke
      if (frame % 40 === (e.id % 40)) for (const o of lvl.enemies) if (o !== e && o.spawned && o.alive && o.conf && Math.abs(o.x - e.x) < 14 && Math.abs(o.z - e.z) < 10) { damageEnemy(e, 1, Math.sign(e.x - o.x) || 1, false, o.id); popup(e.x - 10, sy(e.z) - 30, 'BONK!', '#ffd84a'); break; }
      e.state = 0; e.dir = Math.sin(frame / 30 + e.id) > 0 ? 1 : -1;
      e.x += e.dir * 0.3; e.z = Math.max(0, Math.min(ZMAX, e.z + Math.cos(frame / 20 + e.id) * 0.3)); e.conf = 1;
      continue;
    }
    e.conf = 0;
    if (e.boss) { const mv = bossAI(e, tgt, dx, dz, inCloud); sx = mv[0]; sz = mv[1]; }
    else if (e.state === 6) { // running off with your coins
      e.dir = e.dir || 1; sx = e.dir * 2.6;
      if (e.x < camX - 60 || e.x > camX + W + 60) { e.alive = false; e.gone = true; }
    } else if (e.kind === 'lawnmower') { // SUBURBIA: charges in a straight line, ignoring depth - dodge by moving up/down
      if (e.state === 0) {
        e.dir = Math.sign(dx) || 1; sz = 0;
        if (Math.abs(dx) > 40) sx = e.dir * 1.5; else { e.state = 1; e.t = 22; }
      } else if (e.state === 1) { if (--e.t <= 0) { e.state = 2; e.t = 48; e.strikeN = (e.strikeN || 0) + 1; SFX.hit(); } }
      else if (e.state === 2) { sx = e.dir * 3; sz = 0; if (--e.t <= 0) { e.state = 3; e.t = 50; } }
      else if (e.state === 3) { if (--e.t <= 0) e.state = 0; }
    } else if (e.ai === 'cop') {
      // v1.1 A6: world tricks, layered on top of the plain baton - state numbers 10+ are exclusive to a theme so they never collide
      if (e.trickCd > 0) e.trickCd--;
      if (wk === 'hq' && !e.boss) { // HQ: drone-backed cops - a small flying drone hovers over them and shoots from above
        if (!e.drone) e.drone = { cd: 100 + (e.id * 13) % 80 };
        e.drone.x = e.x; e.drone.z = e.z;
        if (--e.drone.cd <= 0 && Math.abs(dz) < 26) {
          e.drone.cd = 220 + (e.id * 11) % 100;
          const shot = { x: e.x, z: e.z, vx: (Math.sign(dx) || e.dir) * 1.5, life: 140, spin: 0, k: 'drone' };
          lvl.eshots.push(shot); Net.send({ t: 'eshot', x: Math.round(shot.x), z: Math.round(shot.z), vx: shot.vx, l: lvl.n, k: 'drone' });
        }
      }
      if (e.state === 0) {
        e.dir = Math.sign(dx) || 1;
        // take turns: only a couple of cops go for you at once, the rest circle and wait
        const busy = lvl.enemies.filter(o => o !== e && o.ai === 'cop' && o.alive && (o.state === 1 || o.state === 2 || o.near)).length;
        e.near = busy < 1 + players.length;
        const spdMul = (e.kind === 'segway' ? 1.8 : 1) * (e.buffed > 0 ? 1.3 : 1); // DOWNTOWN: fast segway ram - jump (h>=14) to dodge, same as any melee contact. HQ: clipboard-buffed cops move faster too
        const wantX = inZone(tgt.x - e.dir * (e.near ? 20 : 52 + (e.id % 3) * 12));
        sx = Math.sign(wantX - e.x) * Math.min(0.9 * spdMul, Math.abs(wantX - e.x)); sz = Math.sign(dz) * Math.min(0.9, Math.abs(dz));
        if (e.near && wk === 'beach' && !(e.trickCd > 0) && Math.abs(dx) < 34 && Math.abs(dz) < 8) { e.state = 10; e.t = 26; e.trickCd = 260; } // BEACH: taser wind-up
        else if (e.near && wk === 'suburb' && !(e.trickCd > 0) && Math.abs(dx) < 30 && Math.abs(dz) < 10) { e.state = 15; e.t = 24; e.trickCd = 280; } // SUBURBIA: pepper-spray wind-up
        else if (!(e.trickCd > 0) && wk === 'woods' && Math.abs(dx) < 62 && Math.abs(dz) < 12) { e.state = 17; e.t = 22; e.trickCd = 340; } // WOODS: net-launcher aim
        else if (e.near && Math.abs(dx) < 26 && Math.abs(dz) < 5 && tgt.h < 14) { e.state = 1; e.t = e.kind === 'segway' ? 14 : 26; }
      } else if (e.state === 1) { if (--e.t <= 0) { e.state = 2; e.t = 8; e.strikeN = (e.strikeN || 0) + 1; SFX.hit(); } }
      else if (e.state === 2) { if (--e.t <= 0) { e.state = 3; e.t = 44; } }
      else if (e.state === 3) { if (--e.t <= 0) e.state = 0; }
      else if (e.state === 10) { if (--e.t <= 0) { e.state = 11; e.t = 12; e.strikeN = (e.strikeN || 0) + 1; e.dir = Math.sign(dx) || e.dir; SFX.taser(); } } // BEACH taser: lunges in fast, shorter range than the baton
      else if (e.state === 11) { sx = e.dir * 2.5; if (--e.t <= 0) { e.state = 3; e.t = 50; } }
      else if (e.state === 15) { if (--e.t <= 0) { e.state = 16; e.t = 14; e.strikeN = (e.strikeN || 0) + 1; SFX.spray(); } } // SUBURBIA pepper cone
      else if (e.state === 16) { if (--e.t <= 0) { e.state = 3; e.t = 50; } }
      else if (e.state === 17) { if (--e.t <= 0) { e.state = 18; e.t = 16; e.strikeN = (e.strikeN || 0) + 1; SFX.net(); } } // WOODS net launcher
      else if (e.state === 18) { if (--e.t <= 0) { e.state = 3; e.t = 60; } }
    } else if (e.ai === 'karen') {
      if (e.trickCd > 0) e.trickCd--;
      if (wk === 'hq' && frame % 30 === 0) { // HQ clipboard Karen: "writing up" nearby cops/mice buffs them until she's KO'd
        for (const o of lvl.enemies) if (o !== e && o.spawned && o.alive && o.state !== 5 && (o.ai === 'cop' || o.ai === 'mouse') && Math.abs(o.x - e.x) < 70 && Math.abs(o.z - e.z) < 24) o.buffed = 40;
      }
      if (e.state === 0) {
        const side = e.x < tgt.x ? -1 : 1, wantX = inZone(tgt.x + side * 56);
        e.dir = Math.sign(dx) || 1;
        sx = Math.sign(wantX - e.x) * Math.min(0.45, Math.abs(wantX - e.x)); sz = Math.sign(dz) * Math.min(0.6, Math.abs(dz));
        if (wk === 'beach' && !(e.trickCd > 0) && Math.abs(dx) < 110 && Math.abs(dz) < 16) { e.state = 20; e.t = 24; e.trickCd = 300; } // BEACH: sunscreen spray wind-up
        else if (wk === 'suburb' && !(e.trickCd > 0) && Math.abs(dx) < 70 && Math.abs(dz) < 14) { e.state = 22; e.t = 22; e.trickCd = 280; } // SUBURBIA: leaf-blower wind-up
        else if (wk === 'woods' && !(e.trickCd > 0) && Math.abs(dz) < 20) { e.state = 24; e.t = 30; e.trickCd = 420; } // WOODS: essential-oil diffuser
        else if (wk === 'city' && !(e.trickCd > 0) && Math.abs(dx) < 90 && Math.abs(dz) < 16) { e.state = 25; e.t = 20; e.trickCd = 320; } // DOWNTOWN: phone-camera flash
        else if (--e.cd <= 0 && Math.abs(dz) < 10) { e.state = 1; e.t = 16; }
      } else if (e.state === 1) {
        if (--e.t <= 0) {
          e.state = 3; e.t = 70; e.cd = 170 + (e.id * 17) % 80;
          const shot = { x: e.x + e.dir * 8, z: e.z, vx: e.dir * 1.6, life: 150, spin: 0 };
          lvl.eshots.push(shot); Net.send({ t: 'eshot', x: Math.round(shot.x), z: Math.round(shot.z), vx: shot.vx, l: lvl.n });
          if (e.id % 2) popup(e.x - 18, sy(e.z) - 36, e.id % 4 === 1 ? 'MANAGER!!' : 'UNACCEPTABLE!', '#ffb0b0');
          SFX.karen();
        }
      } else if (e.state === 3) { if (--e.t <= 0) e.state = 0; }
      else if (e.state === 20) { if (--e.t <= 0) { e.state = 21; e.t = 10; e.strikeN = (e.strikeN || 0) + 1; SFX.spray(); } } // BEACH sunscreen: radial screen-blind
      else if (e.state === 21) { if (--e.t <= 0) { e.state = 3; e.t = 60; } }
      else if (e.state === 22) { if (--e.t <= 0) { e.state = 23; e.t = 10; e.strikeN = (e.strikeN || 0) + 1; SFX.blow(); for (const c of lvl.clouds) if (Math.abs(c.x - e.x) < 90 && Math.abs(c.z - e.z) < 20) c.x += (c.x < e.x ? -1 : 1) * 30; } } // SUBURBIA leaf-blower: also scatters nearby smoke clouds
      else if (e.state === 23) { if (--e.t <= 0) { e.state = 3; e.t = 60; } }
      else if (e.state === 24) { if (--e.t <= 0) { e.state = 3; e.t = 90; SFX.drip(); const c = { x: e.x, z: e.z, r: 4, grow: 20, t: 480, poison: true, by: e.id }; lvl.clouds.push(c); Net.send({ t: 'cloud', l: lvl.n, x: Math.round(e.x), z: Math.round(e.z) }); } } // WOODS diffuser: grows into a lingering poison cloud
      else if (e.state === 25) {
        if (--e.t <= 0) {
          e.state = 26; e.t = 8; e.strikeN = (e.strikeN || 0) + 1; SFX.flash();
          const z = lvl.zones[lvl.zi], rsv = z && z.ids.map(i => lvl.enemies[i]).find(o => o.alive && !o.spawned && !o.boss); // DOWNTOWN: calls in a reserve early
          if (rsv) { rsv.spawned = true; rsv.x = e.x + (e.id % 2 ? -30 : 30); rsv.z = e.z; rsv.dir = e.dir; popup(e.x - 20, sy(e.z) - 46, 'BACKUP!', '#ffb0b0'); }
        }
      }
      else if (e.state === 26) { if (--e.t <= 0) { e.state = 3; e.t = 60; } }
    } else if (e.ai === 'mouse') {
      // HQ: robot mice beep, then self-detonate in a small radius near their target (also see damageEnemy for a kill-triggered blast)
      if (wk === 'hq' && !e.reserve && e.state !== 13 && e.state !== 14 && Math.abs(dx) < 20 && Math.abs(dz) < 12) { e.state = 13; e.t = 26; e.strikeN = (e.strikeN || 0) + 1; }
      if (e.state === 13) { if (--e.t <= 0) { e.state = 14; e.t = 8; e.strikeN = (e.strikeN || 0) + 1; SFX.beep(); } }
      else if (e.state === 14) { if (--e.t <= 0) damageEnemy(e, 999, e.dir, true, e.id); }
      else { e.dir = Math.sign(dx) || 1; sx = Math.sign(dx) * Math.min(1.8, Math.abs(dx)); sz = Math.sign(dz) * Math.min(1.1, Math.abs(dz)); }
    } else if (e.ai === 'squirrel') {
      if (e.trickCd > 0) e.trickCd--;
      if (e.h === 0) {
        if ((wk === 'beach' || wk === 'woods') && !(e.trickCd > 0) && e.state !== 10 && Math.abs(dz) < 14 && Math.abs(dx) > 20 && Math.abs(dx) < 140) {
          e.state = 10; e.t = wk === 'beach' ? 16 : 20; e.trickCd = 260; e.dir = Math.sign(dx) || 1;
        } else if (e.state !== 10 && --e.cd <= 0) { e.cd = 24 + (e.id * 7) % 20; e.vh = 2.6; e.dir = Math.sign(dx) || 1; e.hx = Math.sign(dx) * 1.7; e.hz = Math.sign(dz) * Math.min(1, Math.abs(dz) / 10); }
      } else { sx = e.hx || 0; sz = e.hz || 0; }
      if (e.state === 10) {
        if (--e.t <= 0) {
          e.state = 0; e.strikeN = (e.strikeN || 0) + 1; SFX.thud();
          if (wk === 'beach') { const shot = { x: e.x + e.dir * 8, z: e.z, vx: e.dir * 2.1, life: 110, spin: 0, k: 'sand' }; lvl.eshots.push(shot); Net.send({ t: 'eshot', x: Math.round(shot.x), z: Math.round(shot.z), vx: shot.vx, l: lvl.n, k: 'sand' }); }
          else { const shot = { x: e.x + e.dir * 8, z: e.z, vx: e.dir * 1.5, life: 140, spin: 0, k: 'pinecone', h: 8, vh: 2.2 }; lvl.eshots.push(shot); Net.send({ t: 'eshot', x: Math.round(shot.x), z: Math.round(shot.z), vx: shot.vx, l: lvl.n, k: 'pinecone', h: shot.h, vh: shot.vh }); }
        }
      }
    }
    if (slowed) { sx *= 0.45; sz *= 0.45; }
    e.x += sx; e.z = Math.max(0, Math.min(ZMAX, e.z + sz));
  }
  // SUBURBIA: mousetraps on the ground root anyone who walks into them (telegraphed - they're visible on the street before triggering)
  if (wk === 'suburb') for (let ti = 0; ti < lvl.traps.length; ti++) {
    const trap = lvl.traps[ti]; if (!trap.armed) continue;
    for (const p of players) if (p.ok && Math.abs(p.x - trap.x) < 9 && Math.abs(p.z - trap.z) < 7) {
      trap.armed = false; trap.flash = 30;
      if (p.id === Net.id) { me.rootT = Math.max(me.rootT || 0, 34); SFX.trap(); popup(me.x - 16, sy(me.z) - 34, 'STUCK!', '#c8ffa0'); }
      Net.send({ t: 'trap', l: lvl.n, i: ti, who: p.id });
      break;
    }
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
  // v1.2 (Step 10.1): the first real snapshot after a drop-in join tells us where the crew actually is -
  // warp straight there (the active zone if one's locked, else however far camX would put us) instead of
  // leaving the joiner stranded back at the level's own spawn point, off-screen behind everyone.
  if (lvl.dropInPending) {
    lvl.dropInPending = false;
    const z = lvl.zones[m.zi];
    me.x = lvl.locked && z ? z.x0 + 20 : Math.max(me.x, m.zc * ZW * 0.5);
    me.z = 30; camX = Math.max(0, me.x - W * 0.4);
  }
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
// v1.2 (Step 11.2): "cosmetics shown online" - armor was a pure stat (+hearts) with NO visual anywhere,
// even for the local player, so there was nothing for a crewmate to actually see. Draws the highest-tier
// owned armor's shop icon as a small hat/badge, scaled up a little each tier so it also doubles as an
// at-a-glance "who's got the good gear" readout in co-op.
function drawArmorHat(x, y, face, tier) {
  if (tier < 0) return;
  const icon = ICONS[ARMORS[tier].icon], s = 1 + tier * 0.15;
  const cx = Math.round(x - camX + 5), cy = Math.round(y - 3 - tier);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s * (face < 0 ? -1 : 1), s); ctx.drawImage(icon, -icon.width / 2, -icon.height); ctx.restore();
}
function drawPlayer(x, y, face, anim, color, sq, inv, emote, name, star, ult, sitting, wi = 0, atkT = 0, slash = null, down = 0, coreLv = 1, armorTier = -1) {
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
  if (!sitting) drawHeld(x, y, face, wi, atkT, anim, coreLv);
  if (slash && !sitting) drawSlash(x, y, face, slash, coreLv);
  drawArmorHat(x, y, face, armorTier);
  if (sitting && frame % 40 < 30) text('Z', x + 12 - camX, y - 8 - (frame % 40) / 8, '#e4b3ff');
  if (emote) bubble(EMOTES[emote.e], x + 5, y - (name ? 24 : 14));
  if (drawPlayer.say) { const m = drawPlayer.say, w = Math.min(46, m.length) * 4 + 6, bx = Math.round(x + 5 - camX - w / 2), by = Math.round(y - (name ? 34 : 24)); R(ctx, P.k, bx - 1, by - 1, w + 2, 11); R(ctx, '#ffffff', bx, by, w, 9); text(m.slice(0, 46), bx + 3, by + 2, '#2a1838'); drawPlayer.say = null; }
  if (name) text(name, x + 5 - camX, y - 10, SHIRTS[color], 1, 'center');
}
// sword slash: a big white crescent in front of the homie
const SLASH_COL = { puff: '#ffffff', lighter: '#ffb84a', dab: '#9ae8ff', bong: '#bfe8ff', grinder: '#c8ffa0', blunt: '#ffd84a' };
function drawSlash(px, pyTop, face, sl, coreLv = 1) {
  if (!sl || sl.t <= 0) return;
  // v1.2 fix (Step 5): the swing trail grows with the Core's tier (see coreTier()) - a bigger, brighter
  // arc at each named form, since this game has no room for 24 hand-drawn sprites (4 Cores x 6 forms).
  const tier = CORE_FORMS[sl.kind] ? coreTier(coreLv) : 0;
  const p = 1 - sl.t / sl.max, reach = (REACH[sl.kind] || 30) * (sl.heavy ? 1.15 : 1) * (1 + tier * 0.05);
  const cx = Math.round(px - camX + 5), cy = Math.round(pyTop + 10);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(face, 1);
  const spin = sl.kind === 'grinder' || sl.air;
  const a0 = spin ? p * Math.PI * 2 - 1 : -1.9 + p * 0.4, a1 = spin ? a0 + 2.4 : a0 + (sl.heavy ? 2.9 : 2.3) * Math.min(1, p * 2.2);
  ctx.globalAlpha = Math.max(0, 1 - p * 0.9);
  ctx.strokeStyle = P.k; ctx.lineWidth = (sl.heavy ? 7 : 5) + tier; ctx.beginPath(); ctx.arc(0, 0, reach * 0.8, a0, a1); ctx.stroke();
  ctx.strokeStyle = tier >= 2 ? (CORE_TIER_GLOW[tier] || SLASH_COL[sl.kind] || '#fff') : (SLASH_COL[sl.kind] || '#fff'); ctx.lineWidth = (sl.heavy ? 5 : 3) + tier; ctx.beginPath(); ctx.arc(0, 0, reach * 0.8, a0, a1); ctx.stroke();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, reach * 0.8 - 1, a0 + 0.2, a1); ctx.stroke();
  ctx.restore(); ctx.globalAlpha = 1;
}
function drawHeld(x, y, face, wi, atkT, anim, coreLv = 1) {
  const w = WEAPONS[wi] || WEAPONS[0], img = HELD[w.id]; if (!img || anim === 4) return;
  // v1.2 fix (Step 5): a growing glow aura + a slightly bigger weapon at each higher tier - the "clearly
  // visible" growth the brief asks for, carried by color/size instead of 24 unique hand-drawn sprites
  // (see CORE_FORMS/CORE_TIER_GLOW's own comment for that scope call).
  const tier = CORE_FORMS[w.id] ? coreTier(coreLv) : 0, scale = 1 + tier * 0.07;
  const hx = Math.round(x - camX + 5 + face * 5), hy = Math.round(y + 11);
  const p = atkT > 0 ? 1 - atkT / 12 : 0; // swing progress
  if (tier >= 2 && frame % 5 === 0) puff(x + 5 + face * 5, y + 6, 1, [CORE_TIER_GLOW[tier]], .4, -0.02); // a growing glow aura behind the held weapon
  ctx.save(); ctx.translate(hx, hy); ctx.scale(face * scale, scale);
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
    // v1.2 (Step 8): THE PARANOIA is "a giant eye that splits into copies" (brief v0.9 F) - no new sprite
    // was drawn for this, an iris/pupil is just layered on top of its (recolored cop) base sprite.
    if (e.kind === 'paranoia') {
      const ex = Math.round(e.x - camX), ey = Y + img.height * bs * 0.38;
      ctx.save(); ctx.beginPath(); ctx.ellipse(ex, ey, 11 * (bs / 2.5 || 1), 6 * (bs / 2.5 || 1), 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex + Math.sin(frame / 17) * 4, ey, 3, 0, TAU); ctx.fillStyle = e.state === 1 ? '#ff3a3a' : '#2a0a3a'; ctx.fill();
      ctx.restore();
    }
    return; }
  if (e.state === 5 && e.t < 20 && frame % 4 < 2) return;
  const flip = e.ai === 'mouse' || e.ai === 'squirrel' ? e.dir > 0 : e.dir < 0;
  if (e.state === 5) { ctx.save(); ctx.translate(Math.round(e.x - camX), Math.round(sy(e.z, e.h) - 4)); ctx.rotate(e.dir * -1.4); ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore(); return; }
  draw_(img, x, y, flip);
  if (e.ai === 'cop' && e.state === 1 && frame % 6 < 3) text('!', e.x - camX, y - 8, '#ff5a6a', 1, 'center');
  if (e.conf && frame % 30 < 20) text('?', e.x - camX, y - 12, '#e4b3ff', 1, 'center');
  if (e.dazed || e.stunned) for (let k = 0; k < 3; k++) { const a = frame / 8 + k * 2.1; R(ctx, '#ffd84a', Math.round(e.x - camX + Math.cos(a) * 7), Math.round(y - 3 + Math.sin(a) * 2), 2, 2); }
  if (e.stolen > 0 && frame % 30 < 20) draw_(COIN, e.x - 5, y - 11);
  // v1.1 A6: world-trick telegraphs - a wind-up flash/symbol before each new attack lands
  if (e.ai === 'cop' && e.state === 10 && frame % 6 < 3) text('~', e.x - camX, y - 8, '#9ae8ff', 1, 'center'); // BEACH taser crackle
  if (e.ai === 'cop' && e.state === 11) text('!!', e.x - camX, y - 10, '#9ae8ff', 1, 'center');
  if (e.ai === 'cop' && e.state === 15 && frame % 6 < 3) text('*', e.x - camX, y - 8, '#c8ffa0', 1, 'center'); // SUBURBIA pepper-spray wind-up
  if (e.ai === 'cop' && e.state === 16) text('><', e.x - camX, y - 10, '#c8ffa0', 1, 'center');
  if (e.ai === 'cop' && e.state === 17 && frame % 6 < 3) text('+', e.x - camX, y - 8, '#c8ffa0', 1, 'center'); // WOODS net-launcher aim
  if (e.ai === 'cop' && e.state === 18) text('X', e.x - camX, y - 10, '#c8ffa0', 1, 'center');
  if (e.ai === 'cop' && e.drone) { const dx3 = Math.round(e.x - camX); ctx.globalAlpha = .35; ctx.fillStyle = '#2a1838'; ctx.beginPath(); ctx.ellipse(dx3, sy(e.z) - 3, 7, 2.4, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    const dy3 = y - 20 + Math.sin(frame / 9 + e.id) * 2; R(ctx, '#7a90c0', dx3 - 4, dy3, 8, 3); R(ctx, '#c8e0ff', dx3 - 2, dy3 - 2, 4, 2);
    if (e.drone.cd < 20) text('!', dx3, dy3 - 8, '#ff5a6a', 1, 'center'); } // HQ drone hovering above
  if (e.ai === 'cop' && e.state !== 4 && (lvl.theme.base || lvl.themeKey) === 'city') { R(ctx, 'rgba(154,176,255,.55)', Math.round(e.x - camX + e.dir * 4 - 2), y + 2, 4, img.height - 4); } // DOWNTOWN riot-shield tint on their front side
  if (e.ai === 'karen' && (e.state === 20 || e.state === 22 || e.state === 24 || e.state === 25) && frame % 6 < 3) text(e.state === 24 ? 'o' : '~', e.x - camX, y - 8, '#e4b3ff', 1, 'center'); // wind-up
  if (e.ai === 'karen' && (e.state === 21 || e.state === 23 || e.state === 26)) text('!!', e.x - camX, y - 10, '#e4b3ff', 1, 'center'); // active
  if (e.ai === 'karen' && e.buffed > 0) { R(ctx, '#ffe0a0', Math.round(e.x - camX - 4), y - 14, 8, 6); text('W', e.x - camX, y - 13, '#6a4428', 1, 'center'); } // HQ clipboard buff icon
  if (e.ai === 'mouse' && (e.state === 13 || e.state === 14) && frame % 6 < 3) text(e.state === 14 ? '*BOOM*' : '!', e.x - camX, y - 10, '#ff5a6a', 1, 'center'); // HQ robot-mouse beep/detonate
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
  } else if (p.kind === 'secret') {
    // v1.2 (Step 9.3): the BLACKLIGHT farm upgrade makes this glow purple and visible on screen at any
    // distance, instead of only sparkling gold once you're basically on top of it.
    if (farmUpgradeHas('blacklight')) { ctx.globalAlpha = 0.5 + 0.3 * Math.sin(frame / 10); ctx.fillStyle = '#c070ff'; ctx.beginPath(); ctx.arc(x, y - 8, 14, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    R(ctx, P.k, x - 8, y - 16, 16, 16); R(ctx, '#d9a334', x - 7, y - 15, 14, 14); R(ctx, '#ffe6a0', x - 7, y - 15, 14, 2);
    R(ctx, P.k, x - 7, y - 9, 14, 1); R(ctx, P.k, x - 1, y - 15, 1, 14); R(ctx, '#8a5024', x - 7, y - 2, 14, 1);
    if (frame % 40 < 20) { ctx.fillStyle = '#ffd84a'; ctx.fillRect(x - 1, y - 24, 2, 6); ctx.fillRect(x - 2, y - 22, 4, 2); }
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
  else if (it.kind === 'envweapon') {
    const ew = ENV_WEAPONS[it.sub]; const X = Math.round(it.x - camX);
    R(ctx, '#8a7a6a', X - 5, y - 12, 10, 10); R(ctx, '#c0b0a0', X - 3, y - 10, 6, 6);
    if (Math.abs(it.x - me.x) < 14 && Math.abs(it.z - me.z) < 12 && !me.envWeapon) text(ew.name + ' (' + KL('attack') + ')', it.x - 20, y - 22, '#fff6b0');
  }
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
  // v1.2 (Step 10.1): Online Soft Pause - unlike the personal menu above (which never blocks the rest of
  // the crew, by design, since Step 1), this is an explicit, visible, opt-in "freeze it for everyone" that
  // any crewmate can call and any crewmate can lift - see softPause/toggleSoftPause() and its check in update().
  if (Net.online && (state === 'play' || state === 'sitting')) o.push({ label: softPause ? 'RESUME FOR THE CREW' : 'SOFT PAUSE (FREEZES EVERYONE)', act: () => { closeMenu(); toggleSoftPause(!softPause); } });
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
// v1.2 (Step 10.1): Online Soft Pause - one shared boolean, broadcast so every crewmate's update() halts
// at the same instant (see the check right after the transit/dialog/menu gates in update()). Optimistic-set
// locally so the caller doesn't wait a round trip to see their own pause take effect.
let softPause = null;
function toggleSoftPause(on) { softPause = on ? { by: Net.name } : null; if (Net.online) Net.send({ t: 'softpause', on, by: Net.name }); }
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
function drawHazard() {
  if (state !== 'play' || !lvl) return;
  const bk = lvl.theme.base || lvl.themeKey;
  if (bk === 'park' && lvl.hazardOn) {
    const midX = (lvl.zones[lvl.zi] || lvl.zones[0]).x0 + ZW / 2 - camX;
    for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(150,220,255,.5)'; ctx.fillRect(Math.round(midX + (i - 1.5) * 20), sy(0) - 40, 2, 40); }
  } else if (bk === 'beach' && lvl.hazardOn) {
    ctx.fillStyle = 'rgba(180,220,255,.25)'; ctx.fillRect(0, sy(ZMAX) - 6, W, 10);
  } else if (bk === 'suburb' && lvl.hazardX != null) {
    const X = Math.round(lvl.hazardX - camX), Y = sy(ZMAX / 2);
    ctx.fillStyle = 'rgba(255,220,80,.4)'; circle(X, Y, 12); ctx.fillStyle = 'rgba(255,120,40,.7)'; circle(X, Y, 7);
  } else if (bk === 'city') {
    const Y = sy(lvl.hazardZ || 14);
    ctx.fillStyle = lvl.hazardOn ? 'rgba(255,60,60,.35)' : 'rgba(255,220,60,.22)'; ctx.fillRect(0, Y - 8, W, 16);
  } else if (bk === 'hq' && lvl.hazardOn) {
    for (let X = 4; X < W; X += 16) { ctx.fillStyle = 'rgba(255,40,60,' + (0.35 + 0.15 * Math.sin(frame / 6 + X)).toFixed(2) + ')'; ctx.fillRect(X, FLOOR_Y - 40, 2, 40); }
  }
  // v1.2 (Step 6.1): CHASE - draw the auto-scrolling threat wall so it's obvious what's pushing you forward
  if (lvl.chase) {
    const X = Math.round((lvl.chaseX || 0) - camX);
    if (X > -30 && X < W + 30) { ctx.fillStyle = 'rgba(255,40,60,.4)'; ctx.fillRect(X - 4, FLOOR_Y - 44, 6, ZMAX + 44); ctx.fillStyle = 'rgba(255,120,60,.5)'; for (let k = 0; k < 5; k++) ctx.fillRect(X - 2, FLOOR_Y - 8 - k * 8, 2, 6); }
  }
}
function draw() { if (state === 'transit') return; TQ.length = 0; HOT = []; drawScene(); if (menu) { HOT = []; drawMenu(); } if (dialog) { HOT = []; draw320(drawDialogue); } drawTrans(); flushText(); if (mouseG) { const r = hotAt(mouseG.x, mouseG.y); cv.style.cursor = r ? 'pointer' : 'default'; } }
function drawTransitWait() {
  ctx.fillStyle = '#1e122c'; ctx.fillRect(0, 0, W, H);
  text('CREW IS DRIVING...', W / 2, H / 2 - 6, '#e4b3ff', 2, 'center');
  text('BACK ON THE MAP SOON', W / 2, H / 2 + 12, '#b0a8c0', 1, 'center');
}
function drawScene() {
  if (state === 'story') { drawStory(); return; }
  if (state === 'transit-wait') { draw320(drawTransitWait, '#1e122c'); return; }
  if (state === 'lobby') { draw320(drawLobby); return; }
  if (state === 'map') { drawMap_(); if (invOpen) draw320(drawInventory); return; }
  if (state === 'results' && results && results.shopOnly) { draw320(drawShop, '#1e122c'); return; }
  const th = lvl.theme;
  ctx.save();
  if (shake > 0) { ctx.translate(Math.round((Math.random() - .5) * shake), Math.round((Math.random() - .5) * shake)); shake *= 0.85; if (shake < 0.5) shake = 0; }
  if (tooHigh() && state === 'play' && !settings.reduceFlash) ctx.translate(Math.round(Math.sin(frame / 11) * 1.4), Math.round(Math.cos(frame / 13) * 0.8));
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
  // v1.2 (Step 10.4): spoof signs - purely decorative, drawn as a little roadside signpost with the joke
  // text on it (world-space, so they scroll with everything else, same offset math as draw_() above).
  for (const s of lvl.signs || []) {
    const sx = Math.round(s.x - camX); if (sx < -60 || sx > W + 60) continue;
    R(ctx, '#8a5024', sx - 1, FLOOR_Y - 38, 2, 26); const tw = s.text.length * 4 + 4;
    R(ctx, '#3a2a1a', sx - tw / 2, FLOOR_Y - 40, tw, 9); R(ctx, '#ffd84a', sx - tw / 2, FLOOR_Y - 40, tw, 1);
    text(s.text, sx, FLOOR_Y - 38, '#ffffff', 1, 'center');
  }
  drawSpot();
  drawHazard();
  // fight area edges
  const zn = lvl.zones[lvl.zi];
  if (lvl.locked && zn && frame % 30 < 20) { R(ctx, 'rgba(255,90,106,.5)', Math.round(zn.x0 + ZW - 4 - camX), FLOOR_Y, 3, ZMAX + 10); R(ctx, 'rgba(255,90,106,.5)', Math.round(zn.x0 + 2 - camX), FLOOR_Y, 3, ZMAX + 10); }

  // smoke screens on the ground
  for (const c of lvl.clouds) {
    const a = Math.min(1, c.t / 60) * 0.55, X = Math.round(c.x - camX), Y = sy(c.z) - 10;
    ctx.globalAlpha = a;
    for (let k = 0; k < 9; k++) { const ang = k / 9 * TAU + frame / 90, rx = Math.cos(ang) * c.r * 0.7, rz = Math.sin(ang) * c.r * 0.25; ctx.fillStyle = c.poison ? (k % 2 ? '#a0e070' : '#e8ffc8') : c.slow ? (k % 2 ? '#ffd84a' : '#fff6b0') : c.hot ? (k % 2 ? '#ffd0b0' : '#ffffff') : c.heal ? (k % 2 ? '#d8ffd0' : '#ffffff') : (k % 2 ? '#e8e4f4' : '#ffffff'); circle(X + rx, Y + rz, c.r * 0.38); }
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
  // v1.1 A6: SUBURBIA mousetraps - visible on the ground before they trigger
  for (const trap of lvl.traps) list.push({ z: trap.z, d: () => {
    const X = Math.round(trap.x - camX), Y = sy(trap.z);
    if (trap.flash > 0) { trap.flash--; ctx.globalAlpha = trap.flash / 30; ctx.fillStyle = '#ffffff'; circle(X, Y - 3, 10); ctx.globalAlpha = 1; }
    if (!trap.armed) return;
    R(ctx, '#5a5044', X - 6, Y - 3, 12, 3); R(ctx, '#8a7a5a', X - 5, Y - 4, 10, 1); R(ctx, '#c8302a', X - 1, Y - 5, 2, 2);
  } });
  for (const e of lvl.enemies) if (e.spawned && e.alive) list.push({ z: e.z, d: () => { const fogA = lvl.hazardFog ? Math.max(0.15, 1 - Math.max(0, Math.abs(e.x - me.x) - 46) / 90) : 1; ctx.globalAlpha = fogA; shadow(e.x, e.z, e.h, e.ai === 'mouse' ? 5 : 7); drawEnemyB(e); ctx.globalAlpha = 1; } });
  const lg = lvl.legend;
  if (lg) list.push({ z: lg.z, d: () => {
    const L = LEGENDS[lg.who]; shadow(lg.x, lg.z, 0);
    draw_(L.img, lg.x - 7, sy(lg.z) - 18 + (frame % 60 < 30 ? 0 : 1), me.x < lg.x);
    text(L.name, lg.x - camX, sy(lg.z) - 28, '#ffd84a', 1, 'center');
    if (!lg.met && frame % 80 < 60) text('!', lg.x - camX, sy(lg.z) - 36, '#ffffff', 1, 'center');
    if (frame % 12 === 0) puff(lg.x + 5, sy(lg.z) - 12, 1, ['#ffffff', '#e8e4f4'], .3, -0.03);
  } });
  // v1.2 (Step 6.1): ESCORT NPC - a simple homie sprite (reuses the player art in a distinct color) with an
  // HP bar, walking the level with the crew (see hostUpdate for its movement/damage logic).
  if (lvl.escort && lvl.escort.alive) { const es = lvl.escort; list.push({ z: es.z, d: () => {
    shadow(es.x, es.z, 0); const X = Math.round(es.x - camX), Y = sy(es.z);
    ctx.drawImage(PLAYER[3][frame % 30 < 15 ? 0 : 1], X - 5, Y - 17);
    text('THE HOMIE', X, Y - 26, '#7fe07a', 1, 'center');
    R(ctx, P.k, X - 8, Y - 32, 16, 3); R(ctx, '#ff5a6a', X - 7, Y - 31, Math.round(14 * es.hp / es.maxHp), 1);
  } }); }
  for (const r of remotes.values()) {
    if (r.tx < -500 || r.l !== lvl.n) continue;
    list.push({ z: r.z, d: () => { shadow(r.x, r.z, r.h); drawPlayer.say = r.say && r.say.msg; drawPlayer(r.x - 5, sy(r.z, r.h) - 17, r.f || 1, r.a, r.color, 0, 0, r.emote, r.name, r.b & 1, r.b & 2, r.b & 4, r.w, r.atkT || 0, r.slash, r.b & 8 ? true : 0, r.cl || 1, r.ar != null ? r.ar : -1); } });
  }
  list.push({ z: me.z + 0.01, d: () => { drawPlayer.roll = me.roll > 0 ? 20 - me.roll : 0; if (me.holdT > 30) { ctx.fillStyle = 'rgba(255,216,74,' + (0.25 + Math.sin(frame / 3) * 0.15) + ')'; circle(Math.round(me.x - camX), sy(me.z, me.h) - 9, 12); } shadow(me.x, me.z, me.h); drawPlayer.say = me.say && me.say.msg; { const X = Math.round(me.x - camX), Y = sy(me.z); ctx.strokeStyle = SHIRTS[me.color]; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(X + .5, Y + .5, 9, 3, 0, 0, TAU); ctx.stroke(); } drawPlayer(me.x - 5, sy(me.z, me.h) - 17, me.face, animFrame(me), me.color, me.sq, me.inv, me.emote, Net.online ? me.name : '', me.star > 0, ultra(), state === 'sitting', WEAPONS.indexOf(weaponDef()), me.atkT, me.slash, me.down || 0, coreLevel(), armorTier()); } });
  for (const s of lvl.eshots) list.push({ z: s.z, d: () => {
    const h = s.k === 'pinecone' ? (s.h || 0) : 5;
    shadow(s.x, s.z, h, 4); const x = Math.round(s.x - camX), y = sy(s.z, h);
    ctx.save(); ctx.translate(x, y); ctx.rotate(s.spin * 0.3);
    if (s.k === 'sand') { R(ctx, '#e8c896', -4, -4, 8, 8); R(ctx, '#fff0d0', -2, -2, 4, 4); }
    else if (s.k === 'pinecone') { R(ctx, '#6a4a2a', -3, -4, 6, 8); R(ctx, '#8a6a3a', -2, -3, 4, 6); }
    else if (s.k === 'drone') { R(ctx, '#7a90c0', -4, -3, 8, 6); R(ctx, '#c8e0ff', -2, -4, 4, 2); }
    else { R(ctx, P.k, -4, -4, 8, 8); R(ctx, '#ff7ac8', -3, -3, 6, 6); R(ctx, '#ffd84a', -1, -5, 2, 2); }
    ctx.restore();
  } });
  for (const s of shots) list.push({ z: s.z, d: () => {
    const x = Math.round(s.x - camX), y = sy(s.z, s.h);
    if (s.kind === 7) { ctx.save(); ctx.translate(x, y); ctx.rotate(frame * 0.6); ctx.drawImage(ICONS.papers, -3, -3); ctx.restore(); return; }
    if (s.kind === 8) { shadow(s.x, s.z, s.h, 4); ctx.drawImage(ICONS.bombs, x - 4, y - 4); if (frame % 3 === 0) puff(s.x, y - 4, 1, ['#ffffff', '#c8ffa0'], .3); return; }
    if (s.kind === 10) { shadow(s.x, s.z, s.h, 4); ctx.drawImage(ICONS.smoke, x - 4, y - 4); if (frame % 3 === 0) puff(s.x, y - 4, 1, ['#ffffff', '#e8e4f4'], .3); return; }
    if (s.kind === 6) { ctx.fillStyle = P.k; circle(x, y, 4.5); ctx.fillStyle = '#7ac8ff'; circle(x, y, 3.5); ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 2, y - 3, 2, 2); }
    // GRINDER's thrown disc - spins in flight, and trails gold sparkle once it's the Kief Cyclone form
    else if (s.kind === 12) { ctx.save(); ctx.translate(x, y); ctx.rotate(frame * 0.5); ctx.drawImage(ICONS.grinder, -4, -4); ctx.restore(); if (s.kief && frame % 3 === 0) puff(s.x, y - 2, 1, ['#ffd84a', '#fff6b0'], .3); }
    // BONG's mid-range smoke blast - a bubble of bong water that grows once it can pierce (The Mothership)
    else if (s.kind === 13) { const r = 6 + (s.pierce > 1 ? 3 : 0); ctx.fillStyle = P.k; circle(x, y, r + 1); ctx.fillStyle = '#bfe8ff'; circle(x, y, r); ctx.fillStyle = '#ffffff'; circle(x - 2, y - 2, 2); }
    // LIGHTER's Blowtorch/Dragon's Breath jet stream - a fatter, brighter flame once it's the Dragon's Breath form
    else if (s.kind === 14) { ctx.fillStyle = s.dragon ? '#e4b3ff' : '#ff9a3a'; circle(x, y, s.dragon ? 7 : 5); ctx.fillStyle = '#ffd84a'; circle(x, y, s.dragon ? 4 : 2); }
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
  // v1.2 fix (Step 15.4): all text (popups AND the banner) is queued through `text()` onto the separate
  // `tv` overlay canvas, which always sits above the main game canvas `cv` regardless of draw-call order
  // - so drawHUD()'s banner background rect (drawn on `ctx`/`cv`) can never actually occlude a popup's
  // text (drawn on `tv`), even though the code order looks like it should. A boss-intro banner is long
  // (220 frames) and boss fights spawn plenty of popups ("NUTS! +3" etc.) in that same window, so text
  // like that visibly ran straight through the boss name/quote. Simplest real fix: skip queuing any
  // popup whose screen position falls inside the banner's own occupied band while one is showing, rather
  // than trying to reorder two canvases that are composited independently by the browser.
  const bannerBand = banner ? [62, 62 + (banner.b ? 34 : 22) * (settings.bigText ? 2 : 1)] : null;
  for (const p of popups) { if (bannerBand && p.y >= bannerBand[0] && p.y <= bannerBand[1]) continue; text(p.str, p.x - camX, p.y, p.col); }
  if (lg && lg.met && me.legendT > 0 && state === 'play') {
    const L = LEGENDS[lg.who];
    ctx.fillStyle = 'rgba(42,24,56,.9)'; ctx.fillRect(10, 30, W - 20, 26);
    text(L.name + ':', 16, 34, '#ffd84a'); wrap('"' + L.tip + '"', 16, 43, 72, '#ffffff'); text('GIFT: ' + lg.gift, W - 16, 34, '#c8ffa0', 1, 'right');
  }
  ctx.restore();

  if (lvl.fightT > 0.02) { const a = lvl.fightT * 0.35; ctx.fillStyle = 'rgba(40,10,30,' + a.toFixed(3) + ')'; ctx.fillRect(0, 0, W, 6); ctx.fillRect(0, H - 6, W, 6); ctx.fillRect(0, 0, 6, H); ctx.fillRect(W - 6, 0, 6, H); }
  if (ultra() && state === 'play') { ctx.fillStyle = 'rgba(192,112,255,' + (0.06 + Math.sin(frame / 20) * 0.03) + ')'; ctx.fillRect(0, 0, W, H); }
  // v1.1 A6: BEACH sunscreen spray / DOWNTOWN camera flash - blinds the screen for a moment, fading out
  if (me.blindT > 0 && state === 'play') { ctx.fillStyle = 'rgba(255,255,255,' + Math.min(0.85, me.blindT / 40 * 0.85).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
  if (tooHigh() && state === 'play' && !settings.reduceFlash) { ctx.fillStyle = 'rgba(150,80,200,' + (0.05 + Math.sin(frame / 14) * 0.02) + ')'; ctx.fillRect(0, 0, W, H); }
  // GO arrow after clearing a fight
  const next = lvl.zones.find(z => !z.cleared);
  if (state === 'play' && !lvl.locked && frame % 40 < 26 && (!next || me.x < next.x0 + 40)) {
    text('GO', W - 30, 60, '#ffd84a', 2); R(ctx, '#ffd84a', W - 12, 62, 4, 6); R(ctx, '#ffd84a', W - 8, 64, 2, 2);
  }
  if (me.tipT > 0 && state === 'play' && !banner) {
    const tips = ['WASD MOVE   SPACE JUMP   CLICK / ' + KL('attack') + ' SWING (3-HIT COMBO)', 'AIM WITH YOUR MOUSE   HOLD SHIFT TO RUN + LUNGE   JUMP AGAIN TO FLOAT', KL('throw') + ' OR RIGHT-CLICK TO THROW   ' + KL('munchie') + ' FOR MUNCHIES/REVIVE', 'TAP ' + KL('toke') + ' TO SMOKE: HEALS + BOOSTS YOUR HITS   CLEAR THE FIGHTS, THEN REACH THE SMOKE SPOT'];
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
  // v1.2 (Step 10.1): Spectator HUD - no hearts/Cooked/weapon UI (none of it applies to a read-only
  // ghost), just a persistent label and the same crew-position info everyone else's HUD shows.
  if (me.spectator) {
    ctx.fillStyle = 'rgba(42,24,56,.6)'; ctx.fillRect(0, 0, W, 12);
    text('SPECTATING', 3, 3, '#e4b3ff', 1);
    if (Net.online) text('ROOM ' + Net.code, W - 4, 3, '#e4b3ff', 1, 'right');
    return;
  }
  ctx.fillStyle = 'rgba(42,24,56,.6)'; ctx.fillRect(0, 0, W, 17);
  const mh = maxHp();
  for (let i = 0; i < mh; i++) ctx.drawImage(i < me.hp ? (i >= 4 ? HEART_A : HEART) : HEART_E, 3 + i * 8, 3);
  ctx.drawImage(COIN, 3, 10 - 1, 7, 6); text(save.coins, 12, 10, '#ffd84a');
  text(crewLives + ' LIFE' + (crewLives === 1 ? '' : 'S'), 40, 10, crewLives <= 1 ? '#ff8a8a' : '#c8ffa0'); // v1.1 A5
  // v1.2 (Step 6.1): GAUNTLET survive-timer readout
  { const gz = lvl.zones[lvl.zi]; if (gz && gz.gauntlet && gz.started && !gz.cleared && gz.timer != null) text('SURVIVE: ' + Math.ceil(gz.timer / 60) + 's', W - 4, 3, '#ffd84a', 1, 'right'); }
  // v1.3 (mechanic redesign, requested 2026-09-26): relabeled from a "SOBER-ISH/COOKED X%" progress-bar
  // reading (which read as something to keep LOW, backwards from what it actually did, and implied a
  // threshold you needed to cross) to a plain "STASH X%" - it's ammo you're holding for smoking, not a
  // meter you're filling toward a goal. ULTRA! shows separately whenever ultra() is true, whether that's
  // from banking to 100% or from chaining tokes (see hitAToke).
  const mx = 72, c = Math.round(me.cooked);
  ctx.drawImage(LEAF_ICON, mx, 2);
  R(ctx, P.k, mx + 9, 3, 62, 7); R(ctx, '#4a3a60', mx + 10, 4, 60, 5);
  R(ctx, ultra() ? (settings.reduceFlash ? '#e4b3ff' : ['#c070ff', '#c8ffa0', '#ff9ab8', '#ffd84a'][Math.floor(frame / 5) % 4]) : c >= 50 ? '#7fe07a' : '#c8b890', mx + 10, 4, Math.round(60 * c / 100), 5);
  R(ctx, settings.colorblind ? '#1a1026' : '#ffffff', mx + 30, 3, 1, 7); R(ctx, settings.colorblind ? '#1a1026' : '#ffffff', mx + 54, 3, 1, 7);
  text(ultra() ? 'ULTRA COOKED!' : tooHigh() ? 'TOO HIGH ' + c + '%' : 'STASH ' + c + '%', mx + 9, 11, ultra() ? '#e4b3ff' : tooHigh() ? '#ff9a3a' : '#c8ffa0');
  // weapon + items
  const wildOnHud = !!(me.envWeapon && me.wildOn), w = wildOnHud ? ENV_WEAPONS[me.envWeapon.id] : weaponDef();
  R(ctx, P.k, 146, 2, 14, 14); R(ctx, wildOnHud ? '#7a2fc0' : '#4a3a60', 147, 3, 12, 12);
  if (wildOnHud) { R(ctx, '#c0b0a0', 149, 5, 8, 8); text(w.name[0], 151, 10, '#2a1838'); } else ctx.drawImage(ICONS[w.icon], 148, 4);
  if (me.atkCd > 0) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(147, 3, 12, Math.round(12 * me.atkCd / w.cd)); }
  if (me.envWeapon) { // Q swap indicator: a small dot shows whether Core or Wild is the currently-active weapon
    R(ctx, wildOnHud ? '#4a3a60' : '#7a2fc0', 147, 16, 5, 3);
    text(wildOnHud ? 'W' : 'C', 149, 18, '#ffffff', 1, 'center');
  }
  if (save.munchie > 0) { ctx.drawImage(MUNCHIE, 164, 4); text('x' + save.munchie, 174, 3, '#ff9ab8'); text('E', 176, 10, '#b0a8c0'); }
  { const q = save.quick || 'brownie'; if (save[q] > 0) { ctx.drawImage(ICONS[ITEMS[q].icon], 250, 4); text('x' + save[q], 260, 3, '#fff6b0'); text('C', 262, 10, '#b0a8c0'); } }
  if (me.buffs.rage > 0) text('RAGE', 246, 20, frame % 20 < 12 ? '#ff5a6a' : '#ffd84a');
  let bx = 226;
  for (const [k, ex, maxT] of [['dash', 'shatter', 600], ['magnet', 'kief', 720], ['crit', 'hash', 720]]) if (me.buffs[k] > 0 && (me.buffs[k] > 120 || frame % 10 < 6)) { ctx.drawImage(EXTRAS[ex].img, bx, 4); R(ctx, '#1a1026', bx, 13, 9, 2); R(ctx, '#c8ffa0', bx, 13, Math.max(1, Math.round(9 * me.buffs[k] / maxT)), 2); bx += 11; }
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
  if ((save.throws.papers || 0) + (save.throws.bombs || 0) + (save.throws.smoke || 0) > 0) { ctx.drawImage(ICONS[tw.id], 186, 4); text(save.throws[tw.id] || 0, 196, 3, '#fff6b0'); text('K', 197, 10, '#b0a8c0'); }
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
    const goal = lvl.locked ? 'BEAT THE WAVE!' : !next ? 'GOAL: REACH THE SMOKE SPOT' : 'GOAL: KEEP MOVING - SMOKE SPOT AHEAD';
    const gs = settings.bigText ? 2 : 1, gw = goal.length * 4 * gs + 8; R(ctx, 'rgba(26,16,38,.75)', Math.round(W / 2 - gw / 2), 19, gw, 11 * gs);
    text(goal, W / 2, 22, lvl.locked ? '#ff8a8a' : '#fff6b0', gs, 'center');
    if (!lvl.locked && lvl.spot.x > camX + W && frame % 30 < 20) { text('SMOKE SPOT', W - 44, 96, '#c8ffa0', 1, 'center'); R(ctx, '#c8ffa0', W - 10, 95, 4, 7); R(ctx, '#c8ffa0', W - 6, 97, 2, 3); }
  }
  // v1.2 (Step 9.3): the BLACKLIGHT farm upgrade's perk - an off-screen compass hint toward this level's
  // unbroken secret stash, same off-screen-arrow shape the SMOKE SPOT hint above already uses.
  if (farmUpgradeHas('blacklight') && state === 'play') {
    const secretProp = lvl.props.find(p => p.kind === 'secret' && !p.broken);
    if (secretProp && frame % 20 < 14) {
      const onL = secretProp.x < camX, onR = secretProp.x > camX + W;
      if (onL || onR) { const hx = onL ? 8 : W - 8; text('SECRET', hx, 106, '#c070ff', 1, 'center'); R(ctx, '#c070ff', hx - 2, onL ? 112 : 112, 4, 4); }
    }
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
    } else {
      // v1.2 fix (Step 15.4): solo left the bottom ~2/3 of this same box visually empty - it only ever
      // filled in the crew-wait lines above, which are online-only by design (there's no crew to wait for
      // solo). Fill the same space with solo's own real status instead of leaving dead space: how long
      // until the results screen (finInfo's own countdown, already driving the real auto-advance in
      // update()) and the same "press to skip the wait" affordance the crew-call prompt gives online.
      text('HEADING TO THE SHOP IN ' + (finInfo ? Math.max(0, Math.ceil(finInfo.t / 60)) : 0) + 'S', W / 2, 125, '#ffffff', 1, 'center');
      text('ENTER OR SPACE TO SKIP THE WAIT', W / 2, 135, '#e4b3ff', 1, 'center');
    }
  } else if (hurryT > 0 && state === 'play') {
    ctx.fillStyle = 'rgba(42,24,56,.75)'; ctx.fillRect(60, 24, W - 120, 20);
    text('THE CREW IS WAITING! ' + Math.ceil(hurryT / 60) + 'S', W / 2, 28, '#ffd84a', 1, 'center');
    text('GET TO THE SMOKE SPOT', W / 2, 36, '#ffffff', 1, 'center');
  }
  // v1.2 (Step 10.1): Online Soft Pause overlay - drawn over everything else so it's obvious the WHOLE
  // crew is frozen, not just this client.
  if (softPause) {
    ctx.fillStyle = 'rgba(20,10,30,.7)'; ctx.fillRect(0, 60, W, 30);
    text('PAUSED BY ' + softPause.by, W / 2, 68, '#ffd84a', 2, 'center');
    if (frame % 40 < 26) text('ENTER/JUMP TO RESUME FOR THE CREW', W / 2, 82, '#c8ffa0', 1, 'center');
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
// v1.2 (Step 9.3): FARM_UPGRADES/FARM_COSMETICS are sold in the Head Shop's UPGRADES tab (see shopEntries()
// below) rather than added as more fixed rows to the already-full-looking Farm hub screen.
const SHOP_TAB_OF = { armor: 'ARMOR', item: 'ITEMS', use: 'ITEMS', coreup: 'UPGRADES', farmup: 'UPGRADES', cosmetic: 'UPGRADES' };
function shopEntries(all) {
  // v1.1 A2: one Core-weapon upgrade entry for whichever homie you're playing, 1-10 levels instead of the
  // old flat 1-3, paid in coins + Resin (+ a Seed on odd target levels) per the brief's example cost curve
  // (coreUpCost()), and gated by save.coreCap (raised at each world's mini-boss/boss - see onKill()).
  // WEAPON_LV3's flavor text is reused as a "LV3+" milestone note.
  const w = weaponDef(), lv = coreLevel(), capReached = lv >= (save.coreCap || 3);
  const cost = lv >= 10 ? null : coreUpCost(lv);
  const ups = lv >= 10 ? [] : [{
    kind: 'coreup', id: w.id, icon: w.icon, name: 'LEVEL UP ' + w.name + ' - LV' + (lv + 1),
    coinPrice: cost.coins, resinPrice: cost.resin, seedPrice: cost.seeds, capReached,
    desc: capReached ? 'LOCKED UNTIL YOU BEAT THE NEXT WORLD MINI-BOSS/BOSS (CAP LV' + save.coreCap + ')' : lv === 2 ? WEAPON_LV3[w.id] : '+1 DAMAGE AND STRONGER EFFECTS. MAX LV10 (' + lv + '/10)',
  }];
  const uses = Object.entries(ITEMS).map(([id, d]) => ({ kind: 'use', id, ...d, desc: d.desc + '. SAVED IN YOUR BAG' }));
  // v1.2 (Step 9.3): one-time permanent farm upgrades (a small perk each) and pure-cosmetic farm decorations,
  // both sold here as ordinary coin-priced UPGRADES-tab goods - see farmUpgradeHas()/farmCosmeticHas().
  const farmUps = FARM_UPGRADES.map(u => ({ kind: 'farmup', id: u.id, icon: u.id, name: u.name, price: u.price, desc: u.desc }));
  const cosmetics = FARM_COSMETICS.map(c => ({ kind: 'cosmetic', id: c.id, icon: c.id, name: c.name, price: c.price, desc: c.desc }));
  const nav = [{ kind: 'ready', name: results && !results.shopOnly && Net.online ? 'READY - BACK TO THE MAP' : 'BACK TO THE MAP', icon: 'puff', price: 0, desc: 'PICK YOUR NEXT MISSION ON THE WORLD MAP. ESC WORKS TOO' }, { kind: 'quit', name: 'SAVE + MAIN MENU', icon: 'puff', price: 0, desc: 'YOUR COINS + GEAR ARE SAVED. COME BACK ANYTIME' }];
  const curArmorTier = armorTier(); // ARMOR is an upgrade line now: only the highest tier owned counts (also migrates old saves that stacked several pieces)
  const shopFixed = SHOP.map(g => {
    if (g.kind !== 'armor') return g;
    const idx = ARMORS.findIndex(a => a.id === g.id);
    if (idx <= curArmorTier) return { ...g, owned: true };
    const discount = curArmorTier >= 0 ? ARMORS[curArmorTier].price : 0;
    return { ...g, price: Math.max(10, g.price - discount), desc: g.desc + (curArmorTier >= 0 ? ' (UPGRADE FROM ' + ARMORS[curArmorTier].name + ' - REPLACES IT)' : '') };
  });
  const goods = [...ups, ...uses, ...shopFixed, ...farmUps, ...cosmetics];
  const tab = SHOP_TABS[shopTab];
  return [...nav, ...(all || tab === 'ALL' ? goods : goods.filter(g => SHOP_TAB_OF[g.kind] === tab))];
}
function itemStatus(it) {
  if (it.kind === 'armor' && it.owned) return 'OWNED';
  if (it.kind === 'item' && save.pouch) return 'OWNED';
  if (it.kind === 'use' && save[it.id] >= itemCap(it.id) + (Net.color === 3 && it.id === 'munchie' ? 1 : 0)) return 'MAX ' + (itemCap(it.id) + (Net.color === 3 && it.id === 'munchie' ? 1 : 0));
  if (it.kind === 'coreup') { if (coreLevel() >= 10) return 'MAXED'; if (it.capReached) return 'LOCKED'; }
  if (it.kind === 'farm') { if (save.farm) return 'YOURS!'; if (!save.killjoyBeaten) return 'LOCKED'; } // v1.2 (Step 7.5)
  if (it.kind === 'farmup' && farmUpgradeHas(it.id)) return 'OWNED';
  if (it.kind === 'cosmetic' && farmCosmeticHas(it.id)) return 'OWNED';
  if (it.kind === 'ready') return readyInfo && readyInfo.me ? 'WAITING ' + readyInfo.n + '/' + readyInfo.of : '';
  return null;
}
let farmSel = 0;
// v1.2 (Step 8): the Astral Plane is reached from here, not a map node - it isn't part of any of the 6
// worlds (see ASTRAL_LEVEL's comment), and the Farm is where the game already surfaces its unlock text.
function farmHubEntries() { return [...STRAINS.map((_, i) => i), 'pet0', 'pet1', 'pet2', 'pet3', 'pet4', ...(astralUnlocked() ? ['astral'] : []), 'back']; }
function updateFarmHub() {
  const list = farmHubEntries();
  if (K.upPressed) { farmSel = (farmSel - 1 + list.length) % list.length; SFX.tick(); }
  if (K.downPressed) { farmSel = (farmSel + 1) % list.length; SFX.tick(); }
  K.upPressed = K.downPressed = false;
  if (!(K.enterPressed || K.jumpPressed || K.attackPressed)) return;
  const sel = list[farmSel];
  if (sel === 'back') { results.farmHub = false; go(openMap); return; }
  if (sel === 'astral') { results.farmHub = false; go(() => startLevel(ASTRAL_LEVEL)); return; }
  if (typeof sel === 'number') { // cycle a plot through: empty -> strain0 -> strain1 -> ... -> empty
    const cur = save.farmPlots[sel], curIdx = STRAINS.findIndex(s => s.id === cur);
    save.farmPlots[sel] = curIdx >= STRAINS.length - 1 ? null : STRAINS[curIdx + 1].id;
    persist(); SFX.buy(); return;
  }
  const p = PETS[Number(sel.slice(3))];
  if (!petUnlocked(p)) { SFX.bump(); return; }
  save.pet = save.pet === p.id ? null : p.id; persist(); SFX.buy();
}
function drawFarmHub() {
  R(ctx, '#2a4a1e', 0, 0, W, H);
  // v1.2 (Step 10.5): the farm visibly grows - a row of little plants along the bottom that gets denser
  // the more you've invested in it (filled plots + farm upgrades + cosmetics owned), drawn behind
  // everything else so it reads as ambient growth rather than a stat display.
  { const growth = save.farmPlots.filter(Boolean).length + FARM_UPGRADES.filter(u => farmUpgradeHas(u.id)).length + FARM_COSMETICS.filter(c => farmCosmeticHas(c.id)).length;
    for (let i = 0; i < growth; i++) ctx.drawImage(PLANT, 6 + i * 20, H - 18); }
  text('THE FARM', W / 2, 6, '#ffd84a', 2, 'center');
  text('4 PLOTS GROW STRAINS THAT GIVE PASSIVE BUFFS - CLICK TO CYCLE', W / 2, 22, '#c8ffa0', 1, 'center');
  // v1.2 (Step 7.6): Astral Plane unlock condition - S grade on all 6 world bosses. The Astral Plane
  // content itself is Step 8's job; this just surfaces whether the condition is currently met.
  if (astralUnlocked()) text('ASTRAL PLANE: UNLOCKED (S ON EVERY WORLD BOSS)', W / 2, 30, '#e4b3ff', 1, 'center');
  // v1.2 (Step 11.2): farm snapshot - the brief's other `canvas.toBlob()` ask, same shareCard() function,
  // just triggered from the farm hub instead of the results screen (no run stats to show, so the strip
  // just carries the game's name/URL).
  hot(W - 46, 2, 44, 8, () => shareCard()); text('[ SNAPSHOT ]', W - 6, 4, '#ffd84a', 1, 'right');
  const list = farmHubEntries();
  for (let i = 0; i < 4; i++) {
    const y = 34 + i * 16, id = save.farmPlots[i], s = STRAINS.find(st => st.id === id);
    const on = farmSel === i;
    R(ctx, on ? '#4a7a3a' : '#3a5a2e', 8, y, W - 16, 14);
    text('PLOT ' + (i + 1) + ': ' + (s ? s.name : 'EMPTY'), 12, y + 3, s ? '#ffd84a' : '#8a809a');
    text(s ? s.desc : 'CLICK TO PLANT', W - 12, y + 3, '#ffffff', 1, 'right');
    hot(8, y, W - 16, 14, () => { farmSel = i; const curIdx = STRAINS.findIndex(st2 => st2.id === id); save.farmPlots[i] = curIdx >= STRAINS.length - 1 ? null : STRAINS[curIdx + 1].id; persist(); SFX.buy(); });
  }
  text('FARM PETS - EQUIP ONE FOR A SMALL BONUS', W / 2, 102, '#c8ffa0', 1, 'center');
  PETS.forEach((p, i) => {
    const y = 112 + i * 12, unlocked = petUnlocked(p), on = save.pet === p.id, sel = farmSel === i + 4;
    R(ctx, sel ? '#4a7a3a' : '#3a5a2e', 8, y, W - 16, 10);
    text((on ? '> ' : '') + p.name + (unlocked ? '' : ' (LOCKED)'), 12, y + 2, unlocked ? (on ? '#ffd84a' : '#ffffff') : '#6a6a6a');
    text(p.desc, W - 12, y + 2, '#c8ffa0', 1, 'right');
    hot(8, y, W - 16, 10, () => { if (!unlocked) { SFX.bump(); return; } save.pet = save.pet === p.id ? null : p.id; persist(); SFX.buy(); });
  });
  let by = 112 + PETS.length * 12 + 8;
  const astralIdx = list.indexOf('astral');
  if (astralIdx >= 0) {
    R(ctx, farmSel === astralIdx ? '#5a1a8a' : '#3a1a5a', 8, by, W - 16, 12);
    text('ENTER THE ASTRAL PLANE - BEAT THE PARANOIA', W / 2, by + 2, '#e4b3ff', 1, 'center');
    hot(8, by, W - 16, 12, () => { results.farmHub = false; go(() => startLevel(ASTRAL_LEVEL)); });
    by += 16;
  }
  R(ctx, farmSel === list.length - 1 ? '#4a7a3a' : '#3a5a2e', 8, by, W - 16, 12);
  text('BACK TO THE MAP', W / 2, by + 2, '#ffffff', 1, 'center'); hot(8, by, W - 16, 12, () => { results.farmHub = false; go(openMap); });
}
function updateShop() {
  if (results.farmHub) { updateFarmHub(); return; }
  if (results.statsPage) { updateStatsPage(); return; }
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
  if (st) { SFX.bump(); results.msg = it.kind === 'coreup' && st === 'LOCKED' ? 'BEAT THE NEXT WORLD MINI-BOSS/BOSS TO RAISE THE CORE CAP' : st === 'LOCKED' ? 'BEAT ALL 6 WORLDS FIRST' : 'CANT BUY THAT'; return; }
  if (it.kind === 'coreup') { // v1.1 A2: Core-weapon levels cost coins + Resin (+ a Seed on odd target levels), gated by save.coreCap above
    if (save.coins < it.coinPrice) { SFX.bump(); results.msg = 'NEED ' + (it.coinPrice - save.coins) + ' MORE HASH COINS'; return; }
    if (save.resin < it.resinPrice) { SFX.bump(); results.msg = 'NEED ' + (it.resinPrice - save.resin) + ' MORE RESIN'; return; }
    if ((save.seeds || 0) < it.seedPrice) { SFX.bump(); results.msg = 'NEED ' + (it.seedPrice - (save.seeds || 0)) + ' MORE SEED (BOSSES DROP THEM)'; return; }
    save.coins -= it.coinPrice; save.resin -= it.resinPrice; save.seeds -= it.seedPrice;
    const prevForm = formName(weaponDef().id, coreLevel());
    save.cores[CORE_HOMIE[Net.color || 0]] = coreLevel() + 1;
    persist(); SFX.buy();
    const newForm = formName(weaponDef().id, coreLevel());
    // v1.2 fix (Step 5.5): call out a form change (not just the level number) whenever the upgrade crosses
    // into a new named tier, since that's the moment the sprite/swing/particles/sound all change together.
    results.msg = newForm !== prevForm ? weaponDef().name + ' EVOLVED INTO THE ' + newForm + '! (LV' + coreLevel() + ')' : weaponDef().name + ' IS NOW LV' + coreLevel() + '!';
    return;
  }
  if (save.coins < it.price) { SFX.bump(); results.msg = 'NEED ' + (it.price - save.coins) + ' MORE HASH COINS'; return; }
  save.coins -= it.price;
  if (it.kind === 'armor') save.armor = [it.id]; // an upgrade line: the new piece replaces whatever was worn before
  else if (it.kind === 'item') save.pouch = true;
  else if (it.kind === 'use') save[it.id] = Math.min(itemCap(it.id) + (Net.color === 3 && it.id === 'munchie' ? 1 : 0), save[it.id] + 1);
  else if (it.kind === 'farm') { save.farm = true; results.farmScene = true; SFX.flag(); }
  else if (it.kind === 'farmup') { save.farmUpgrades[it.id] = true; }
  else if (it.kind === 'cosmetic') { save.farmCosmetics[it.id] = true; }
  persist(); SFX.buy(); results.msg = 'BOUGHT ' + it.name + '!';
}
function drawShop() {
  ctx.fillStyle = '#1e122c'; ctx.fillRect(0, 0, W, H);
  if (results.farmHub) { drawFarmHub(); return; }
  if (results.statsPage) { drawStatsPage(); return; }
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
    // v1.2 (Step 8): sunset-toned, per the ending beat brief calls for ("a sunset smoke session") - was a
    // flat daytime blue-sky/green-field palette before.
    const g = ctx;
    gradient(g, ['#6a4ac8', '#9a5ac0', '#c86ab0', '#e8869a', '#ff9a7a', '#ffb87a', '#ffce8a', '#ffe0a0']);
    g.fillStyle = '#fff0b0'; for (let y = -14; y <= 14; y++) { const w = Math.floor(Math.sqrt(196 - y * y)); g.fillRect(W - 60 - w, 50 + y, w * 2, 1); } // setting sun
    R(g, '#4a2a5a', 0, 118, W, 74);
    for (let i = 0; i < 14; i++) g.drawImage(PLANT, 8 + i * 22, 110 + (i % 2) * 8);
    g.drawImage(ICONS.farm, W / 2 - 6, 60);
    // v1.2 (Step 9.3): the two purely-cosmetic farm decorations, shown here once bought (see farmCosmeticHas()) -
    // this sunset scene is the most visible "your farm" backdrop in the game, so it's where they show up.
    if (farmCosmeticHas('tapestry')) g.drawImage(ICONS.tapestry, 16, 66);
    if (farmCosmeticHas('lavalamp')) g.drawImage(ICONS.lavalamp, W - 26, 96);
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
  // v1.2 (Step 7.1/7.2): show this run's grade + a "NEW BEST!" callout when it raised the saved best
  if (r.made && r.grade) { const gCol = { S: '#ffd84a', A: '#c8ffa0', B: '#7ac8ff', C: '#b0a8c0' }[r.grade]; text('GRADE ' + r.grade + (r.isNewBest ? '!' : ''), W - 6, 4, gCol, 2, 'right'); }
  text('COINS +' + r.earned + '   STOLEN/LOST -' + r.lost + '   COOKED ' + r.cooked + '%   KOS ' + r.kills + (r.ultraBonus ? '   ULTRA +25%!' : '') + (r.dailyBonus ? '   DAILY BONUS +' + r.dailyBonus + '!' : ''), W / 2, 18, '#ffffff', 1, 'center');
  // v1.2 (Step 10.3): "NEW:" highlights + DJ Dank's roast/praise line - both computed once in toResults()
  // and just read off here.
  if (r.newThings && r.newThings.length) text(r.newThings.join('   '), W / 2, 26, '#ffd84a', 1, 'center');
  if (r.roast) text(r.roast, W / 2, 33, '#e4b3ff', 1, 'center');
  // v1.2 (Step 11.1): Smoke Runs leaderboard - shows once the server answers the submit this run just
  // sent (see toResults()). Top 3 only here; the full top 10 is what the server actually keeps.
  if (r.made && leaderboard.key === lbKeyFor(lvl.n, lvl.daily ? todaySeed() : null) && leaderboard.list.length) {
    text((lvl.daily ? "TODAY'S SMOKE RUN" : 'LEVEL') + ' TOP ' + Math.min(3, leaderboard.list.length) + ': ' +
      leaderboard.list.slice(0, 3).map((e, i) => (i + 1) + '. ' + e.name + ' ' + e.score).join('   '), W / 2, 40, '#7ac8ff', 1, 'center');
  }
  // v1.2 (Step 11.2): share card - a real downloadable PNG snapshot of this run (see buildShareCard()),
  // not just a "share" button that does nothing. Only offered on a real clear, since a share card for a
  // wipe isn't much of a brag.
  if (r.made) { hot(W / 2 - 30, 46, 60, 8, () => shareCard()); text('[ SHARE CARD ]', W / 2, 48, '#ffd84a', 1, 'center'); }
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
  text('COINS ' + save.coins + '   RESIN ' + save.resin + '   SEEDS ' + (save.seeds || 0), W - 8, 68, '#ffd84a', 1, 'right');
  const list = shopEntries(), rows = 9, start = Math.max(0, Math.min(shopSel - 4, list.length - rows));
  for (let i = start; i < Math.min(list.length, start + rows); i++) {
    const it = list[i], y = 76 + (i - start) * 10, sel = i === shopSel, st = itemStatus(it);
    // v1.1 A2: Core upgrades cost coins + Resin (+ Seeds on odd target levels), everything else is coins-only
    const isCoreup = it.kind === 'coreup';
    const afford = isCoreup ? (save.coins >= it.coinPrice && save.resin >= it.resinPrice && (save.seeds || 0) >= it.seedPrice) : save.coins >= it.price;
    const costStr = isCoreup ? it.coinPrice + 'c ' + it.resinPrice + 'r' + (it.seedPrice ? ' ' + it.seedPrice + 'seed' : '') : it.price;
    hot(4, y - 1, 190, 10, () => { if (shopSel === i) shopConfirm(); else { shopSel = i; SFX.tick(); } }, () => { shopSel = i; });
    if (sel) { R(ctx, '#4a3a60', 4, y - 1, 190, 10); R(ctx, '#c8ffa0', 4, y - 1, 2, 10); }
    const plain = it.kind === 'ready' || it.kind === 'quit';
    if (!plain) ctx.drawImage(ICONS[it.icon], 8, y - 1, 9, 9);
    text(it.name, plain ? 10 : 20, y + 1, it.kind === 'ready' ? '#c8ffa0' : it.kind === 'quit' ? '#ff9ab8' : st ? '#8a809a' : '#ffffff');
    if (!plain) text(st || costStr, 192, y + 1, st ? '#8a809a' : afford ? '#ffd84a' : '#ff8a8a', 1, 'right');
    else if (st) text(st, 192, y + 1, '#e4b3ff', 1, 'right');
  }
  if (start > 0 && frame % 30 < 20) text('^ MORE', 150, 68, '#b0a8c0');
  if (start + rows < list.length && frame % 30 < 20) text('V MORE', 150, 176, '#b0a8c0');
  const it = list[shopSel];
  R(ctx, '#4a3a60', 202, 76, 112, 96);
  if (it.kind !== 'ready' && it.kind !== 'quit') ctx.drawImage(ICONS[it.icon], 246, 80, 20, 20);
  wrap(it.desc, 206, 106, 26, '#ffffff');
  if (it.kind === 'coreup') {
    { const nf = formName(weaponDef().id, coreLevel() + 1), of = formName(weaponDef().id, coreLevel());
      text('LV ' + coreLevel() + ' -> LV ' + (coreLevel() + 1) + (nf !== of ? '   BECOMES THE ' + nf + '!' : '   +1 DAMAGE'), 206, 128, '#7fe07a'); }
    if (!it.capReached && coreLevel() < 10) text('COST: ' + it.coinPrice + ' COINS + ' + it.resinPrice + ' RESIN' + (it.seedPrice ? ' + ' + it.seedPrice + ' SEED' : ''), 206, 136, '#c8ffa0');
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
  { id: 'smoke', name: 'SMOKE GRENADE', dmg: 0, desc: 'LOB IT. MAKES A HIDING CLOUD - GREAT FOR ESCAPES + REVIVES', pack: 3, price: 70 },
];
ICONS.papers = sprite(['...k...', '..kwk..', '.kwWwk.', 'kwWwWwk', '.kwWwk.', '..kwk..', '...k...']);
ICONS.bombs = sprite(['....kk...', '...kEEk..', '..kGGGGk.', '.kGLGGGGk', '.kGGpGGGk', '.kGGGGoGk', '..kGGGGk.', '...kkkk..']);
ICONS.smoke = sprite(['....kk...', '...kwwk..', '..kwWWwk.', '.kwWWWWwk', '.kWWwWWWk', '.kwWWWWwk', '..kwWWwk.', '...kkkk..']);
function throwItem() {
  if (state !== 'play' || me.throwCd > 0) return;
  if (!hasSkill('throw')) { popup(me.x - 30, sy(me.z) - 34, 'A BOSS WILL TEACH YOU TO THROW', '#ff8a8a'); me.throwCd = 30; return; }
  const t = THROWS.find(t => t.id === save.throwSel) || THROWS[0];
  if (!(save.throws[t.id] > 0)) { const other = THROWS.find(o => save.throws[o.id] > 0); if (other) { save.throwSel = other.id; return throwItem(); } popup(me.x - 20, sy(me.z) - 34, (save.throws.papers || save.throws.bombs || save.throws.smoke) ? 'OUT OF ' + t.name : 'NO THROWABLES YET', '#ff8a8a'); SFX.bump(); me.throwCd = 20; return; }
  save.throws[t.id]--; me.throwCd = t.id === 'bombs' ? 40 : t.id === 'smoke' ? 30 : 16; me.atkT = 8;
  const perkDmg = Net.color === 3 ? 1 : 0;
  if (t.id === 'papers') for (const dz of hasSkill('twothrow') ? [-7, 7] : [0]) shots.push({ mine: true, kind: 7, x: me.x + me.face * 8, z: me.z + dz, h: me.h + 10, vx: me.face * 5, life: 45, dmg: 1 + (me.buffs.power > 0 ? 1 : 0) + perkDmg, pierce: 2, hit: new Set() });
  else if (t.id === 'smoke') shots.push({ mine: true, kind: 10, x: me.x + me.face * 6, z: me.z, h: me.h + 14, vx: me.face * 2, vh: 3, life: 200, hit: new Set() });
  else shots.push({ mine: true, kind: 8, x: me.x + me.face * 6, z: me.z, h: me.h + 14, vx: me.face * 2.4, vh: 3, life: 200, dmg: 3 + (ultra() ? 1 : 0) + perkDmg, hit: new Set() });
  SFX.jump();
  Net.send({ t: 'fx', k: t.id === 'papers' ? 7 : t.id === 'smoke' ? 10 : 8, x: Math.round(me.x), y: Math.round(me.z), f: me.face, h: Math.round(me.h) });
}
function landSmoke(s) { // SMOKE GRENADE: a hiding cloud - enemies lose track, revives are faster inside
  shake = 4; SFX.exhale();
  puff(s.x, sy(s.z, 4), 20, ['#ffffff', '#e8e4f4'], 1.8, -0.03);
  if (!s.mine) return;
  const c = { x: s.x, z: s.z, r: 34, t: 300, by: Net.id };
  lvl.clouds.push(c);
  Net.send({ t: 'fx', k: 9, x: Math.round(s.x), y: Math.round(s.z), h: c.r, f: 0 });
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
// each world's map is a wavy road of that world's level nodes (count varies 6-10, brief v1.1 B1), with a
// Head Shop node early on and a Hotbox Highway node placed right after the mid-world mini-boss. The last
// world (Buzzkill HQ) leads to the Farm instead of a gate to the next world.
function mapNodes(w) {
  const wd = WORLDS[w], count = wd.levels.length;
  const x0 = 56, x1 = MW - 70, y0 = 62, amp = 44;
  const px = i => x0 + (count > 1 ? (i / (count - 1)) * (x1 - x0) : 0);
  const py = i => y0 + 40 + Math.sin((count > 1 ? i / (count - 1) : 0) * Math.PI * 2.3) * amp * 0.5 + (i % 2 ? 6 : -6);
  const nodes = [];
  for (let k = 0; k < count; k++) {
    nodes.push({ kind: 'level', n: WORLD_START[w] + k, x: Math.round(px(k)), y: Math.round(py(k)), mega: k === wd.bossAt, mini: k === wd.miniAt });
    if (k === 1) nodes.push({ kind: 'shop', x: Math.round(px(k) + 10), y: Math.round(py(k) + 22) });
    if (k === wd.miniAt) nodes.push({ kind: 'hotbox', x: Math.round((px(k) + px(Math.min(count - 1, k + 1))) / 2), y: Math.round(Math.min(py(k), py(Math.min(count - 1, k + 1))) - 18) });
  }
  // v1.2 (Step 6.3): the SECRET level's own map node - invisible (see the draw loop's `nd.secret` check)
  // and unselectable (nodeUnlocked() gates it on save.secretsFound) until its world's hidden door is found.
  nodes.push({ kind: 'level', n: SECRET_BASE + w, secret: true, x: Math.round(px(count - 1)), y: Math.round(py(count - 1)) + 30 });
  nodes.push(w === WORLDS.length - 1 ? { kind: 'farm', x: MW - 40, y: 82 } : { kind: 'gate', to: w + 1, x: MW - 40, y: 82 });
  return nodes;
}
let curWorld = 0, MAP_NODES = mapNodes(0);
const maxWorld = () => Math.min(WORLDS.length - 1, worldOf(Math.min(save.spots, TOTAL_LEVELS - 1)));
function setWorld(w) { curWorld = Math.max(0, Math.min(maxWorld(), w)); MAP_NODES = mapNodes(curWorld); if (!(MAP_NODES[mapSel] && nodeUnlocked(MAP_NODES[mapSel]))) mapSel = 0; }
let mapSel = 0, mapCanvas = null, mapWater = null, mapRoads = [], storyPage = 0, briefT = 0;
const mapCache = {};
function useMap(w) { if (!mapCache[w]) { const nodesWas = MAP_NODES; MAP_NODES = mapNodes(w); const c = buildMapCanvas(w); mapCache[w] = { c, water: mapWater, roads: mapRoads }; MAP_NODES = nodesWas; } mapCanvas = mapCache[w].c; mapWater = mapCache[w].water; mapRoads = mapCache[w].roads; return mapCanvas; }
function nodeUnlocked(nd) {
  if (nd.kind === 'level') return nd.secret ? save.secretsFound.includes(worldOf(nd.n)) : nd.n <= save.spots;
  if (nd.kind === 'gate') return save.spots >= WORLD_START[curWorld + 1];
  if (nd.kind === 'shop') return true;
  if (nd.kind === 'hotbox') return save.spots >= WORLD_START[curWorld] + WORLDS[curWorld].miniAt;
  return save.killjoyBeaten; // v1.2 (Step 7.5): a real flag instead of inferring "Killjoy beaten" from save.spots>=SPOTS_TO_FARM
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
  if (true) { // v1.1 B1: every world is now a single biome across all its levels (was: world 0 only was a
              // hand-painted multi-biome "tour" map; that no longer fits, so all 6 worlds use this generic
              // per-node cluster art, keyed off each level's theme). SIMPLIFICATION: less bespoke than the
              // old world-0 art, but correct for any level count and still legible per-theme.
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
  if (nd.kind === 'gate') return 'ON TO WORLD ' + (nd.to + 1) + ': ' + WORLDS[nd.to].name;
  if (nd.kind === 'farm') return 'THE POT FARM';
  if (nd.kind === 'hotbox') return 'HOTBOX HIGHWAY';
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
// v1.1 B2/B3: launches a transit mini-game (Hotbox Highway, or one of the 5 world-transition games) into
// the #transitMount overlay, pausing the main loop (see the `state === 'transit'` guards in update()/draw())
// until it reports back via onDone. `mod` is one of window.Drive/LazyRiver/PaperPlane/MunchieTruck/
// SmokeBalloon/BongRocket - all share the same {save,mount,scale,crew,net,onDone} start() contract.
// `extraOpts` carries game-specific fields (Drive needs {from,to,world,cooked}; the others just {world}).
// v1.2 fix (Step 2.1): transit.js's makeNet() wraps whatever `net` a mini-game is given into a fresh
// object keyed by a 2-letter game key (lr/pp/mt/sb/br) and the mini-game then overwrites that wrapped
// object's `_deliver` with its own incoming-message handler - but that wrapped object only ever lives
// inside the mini-game's own closure, so game.js (which owns the actual WebSocket and Net.send) has no
// way to reach it to deliver incoming {t:'d'} relay messages... unless it grabs a reference the moment
// makeNet() creates it. This wraps Transit.makeNet (without editing transit.js, which isn't game.js's
// file to touch) so every wrapped net gets stashed in Transit._activeNets[gameKey] - the SAME object the
// mini-game later attaches its `_deliver` to, so the stashed reference sees that update too. Drive.js
// doesn't need this trick - it already exposes a top-level `Drive._deliver` singleton (see its own header
// comment), since only one drive can run at a time.
if (window.Transit && typeof window.Transit.makeNet === 'function' && !window.Transit.__netHooked) {
  const origMakeNet = window.Transit.makeNet;
  window.Transit.makeNet = function (netRaw, gameKey) {
    const wrapped = origMakeNet(netRaw, gameKey);
    if (wrapped) { window.Transit._activeNets = window.Transit._activeNets || {}; window.Transit._activeNets[gameKey] = wrapped; }
    return wrapped;
  };
  window.Transit.__netHooked = true;
}
// v1.1 B2/B3: launches a transit mini-game (Hotbox Highway, or one of the 5 world-transition games) into
// the #transitMount overlay, pausing the main loop (see the `state === 'transit'` guards in update()/draw())
// until it reports back via onDone. `mod` is one of window.Drive/LazyRiver/PaperPlane/MunchieTruck/
// SmokeBalloon/BongRocket - all share the same {save,mount,scale,crew,net,onDone} start() contract.
// `extraOpts` carries game-specific fields (Drive needs {from,to,world,cooked}; the others just {world}).
// v1.2 fix (Step 2.4): onDone's `cooked`/`munchies`/`buff` fields (Drive returns all three; the 5 transit
// games don't yet - see AGENT_NOTES Step 4.4) are now applied too, not just `coins`.
function launchTransit(mod, extraOpts, afterBanner, onAfter) {
  if (!mod || typeof mod.start !== 'function') { banner = { t: 120, a: 'RIDE UNAVAILABLE', b: 'THIS MINI-GAME DID NOT LOAD - CHECK THE BROWSER CONSOLE' }; return; }
  const mount = document.getElementById('transitMount');
  if (!mount) { banner = { t: 120, a: 'RIDE UNAVAILABLE', b: 'NO MOUNT POINT ON THIS PAGE' }; return; }
  mount.innerHTML = ''; mount.style.display = 'flex'; state = 'transit';
  const crew = Net.online ? [{ id: Net.id, name: Net.name, color: Net.color }, ...[...remotes].map(([id, r]) => ({ id, name: r.name, color: r.color }))] : 1;
  try {
    mod.start({
      ...extraOpts, save, mount, scale: 3, crew, net: Net.online ? Net : null,
      onDone: (r) => {
        try {
          if (r && typeof r.coins === 'number') { save.coins += Math.max(0, Math.round(r.coins)); }
          if (r && typeof r.cooked === 'number' && me) me.cooked = Math.max(0, Math.min(100, r.cooked));
          if (r && typeof r.munchies === 'number' && r.munchies > 0) save.munchie = Math.min(3, (save.munchie || 0) + Math.round(r.munchies));
          if (r && r.buff === 'cooked10' && me) me.cooked = Math.min(100, me.cooked + 10);
          else if (r && r.buff === 'soda10' && me) { me.buffs.soda = Math.max(me.buffs.soda || 0, 600); me.buffs.speed = Math.max(me.buffs.speed || 0, 600); }
          persist();
        } catch (e) {}
        mount.style.display = 'none'; mount.innerHTML = '';
        state = 'map';
        // v1.2 fix (Step 2.2/2.3): tell any crewmate who joined mid-ride (and is stuck on the "CREW IS
        // DRIVING..." wait screen, since they never got the original transit-start) that it's over, so
        // they come back to the map instead of waiting forever. Only the host needs to send this - see
        // the matching `case 'transit-end'` handler and the drop-in wait screen below.
        if (Net.online && isHost()) Net.send({ t: 'transit-end' });
        if (typeof onAfter === 'function') onAfter();
        banner = { t: 150, a: (afterBanner && afterBanner.a) || 'MADE IT!', b: (r && typeof r.coins === 'number' ? '+' + Math.max(0, Math.round(r.coins)) + ' COINS - ' : '') + ((afterBanner && afterBanner.b) || '') };
        SFX.cp();
      }
    });
  } catch (e) {
    mount.style.display = 'none'; mount.innerHTML = ''; state = 'map';
    banner = { t: 150, a: 'RIDE CRASHED', b: String(e && e.message || e).slice(0, 60) };
  }
}
// v1.2 fix (Step 2.2): the actual launch logic for each transit trigger, factored out of the map's click
// handler so both the host (who decides to launch) and every other crewmate (who receives the host's
// broadcast and must launch the SAME ride locally, with their own local per-player extras like their own
// Cooked%) can call the same code. Only the host broadcasts; everyone (host included) then calls these.
function startHotboxTransit(from, to, worldIdx) {
  const worldBase = (WORLD_DEF[worldIdx] || WORLD_DEF[0]).base;
  launchTransit(window.Drive, { from, to, world: worldBase, cooked: me ? Math.round(me.cooked) : 0 }, { a: 'MADE IT DOWN THE HIGHWAY!', b: 'BACK ON THE MAP' });
}
function startGateTransit(worldIdx) {
  const game = WORLD_TRANSIT_GAMES[worldIdx], to = worldIdx + 1; // gate nodes always lead to worldIdx+1 - see mapNodes()
  const advance = () => go(() => { setWorld(to); mapSel = 0; Net.send({ t: 'mapsel', i: 0, w: curWorld }); });
  if (game) launchTransit(game.mod, { world: game.world }, { a: game.name.toUpperCase() + '!', b: 'WELCOME TO ' + (WORLDS[to] ? WORLDS[to].name : 'THE NEXT WORLD') }, advance);
  else advance();
}
function openMap() {
  state = 'map'; results = null; banner = null; invOpen = false;
  setWorld(maxWorld());
  const next = MAP_NODES.findIndex(nd => nd.kind === 'level' && nd.n === Math.min(save.spots, TOTAL_LEVELS - 1));
  mapSel = next < 0 ? 0 : next;
}
function updateMap() {
  // v1.2 fix (Step 15.1): same defensive clamp as drawMap_() - a driving client's own mapSel should
  // always be valid already (it's the one setting it), but this makes every MAP_NODES[mapSel] read
  // below crash-proof too, not just the drawing side.
  if (!(MAP_NODES[mapSel])) mapSel = Math.max(0, Math.min(mapSel, MAP_NODES.length - 1));
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
      // v1.1 B2: Hotbox Highway, right after the mid-world mini-boss - drive.js's own from/to args just need
      // real level numbers either side of the mini-boss and the world's theme key for its road palette.
      else if (nd.kind === 'hotbox') {
        SFX.tick();
        const wd = WORLDS[curWorld], from = WORLD_START[curWorld] + wd.miniAt, to = Math.min(from + 1, WORLD_START[curWorld] + wd.levels.length - 1);
        // v1.2 fix (Step 2.2): the host broadcasts the launch so every crewmate runs the SAME ride at
        // the SAME moment (see the matching `case 'transit-start'` handler below) instead of only the
        // clicking player driving locally.
        if (Net.online) Net.send({ t: 'transit-start', k: 'hb', from, to, w: curWorld });
        startHotboxTransit(from, to, curWorld);
      }
      // v1.1 B3: each world-gate node is also the crew's ride to the next world - a different one-off
      // transit mini-game per world, per the brief's B3 table (Park->Beach: Lazy River, Beach->Suburbia:
      // Paper Plane, Suburbia->Downtown: Munchie Truck, Downtown->Woods: Smoke Balloon, Woods->HQ: Bong
      // Rocket). WORLD_TRANSIT_GAMES maps world index -> the module to launch (see its definition near
      // WORLD_DEF). If a world has no entry (shouldn't happen for 0-4) it just falls straight through to
      // the old gate behavior.
      else if (nd.kind === 'gate') {
        SFX.tick();
        if (Net.online) Net.send({ t: 'transit-start', k: 'gate', w: curWorld });
        startGateTransit(curWorld);
      }
      else if (nd.kind === 'farm') {
        if (save.farm) { results = { shopOnly: true, farmHub: true }; state = 'results'; farmSel = 0; }
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
  } else if (Net.mapCursor !== undefined) {
    // v1.2 fix (Step 15.1): a non-host applies the host's relayed cursor/world every frame here, but the
    // two updates aren't atomic on the wire - `mapsel` messages can arrive out of order with a world-gate
    // ride's own local `advance()` (see startGateTransit), so for a few frames this client can hold a
    // WORLD that already changed locally but a stale CURSOR from before the ride (or vice versa). That
    // combination used to leave `mapSel` pointing past the end of whatever `MAP_NODES` this client is
    // currently showing, and `drawMap_()` dereferences `MAP_NODES[mapSel]` unguarded - a real, previously
    // unfixed crash for non-host clients right after a world-gate ride. Range-check the incoming cursor
    // against the CURRENT node list (after any world change) instead of trusting it blindly.
    if (Net.mapWorld !== undefined && Net.mapWorld !== curWorld) { curWorld = Net.mapWorld; MAP_NODES = mapNodes(curWorld); }
    mapSel = Math.max(0, Math.min(Net.mapCursor, MAP_NODES.length - 1));
  }
  K.worldPrev = K.worldNext = false;
  if (K.shopPressed) go(openShop);
  if (K.dailyPressed) startDaily();
  if (K.statsPressed) { results = { shopOnly: true, statsPage: true }; state = 'results'; statsScroll = 0; }
  K.nav = null; K.shopPressed = false; K.dailyPressed = false; K.statsPressed = false;
}
let statsScroll = 0;
function updateStatsPage() {
  if (K.upPressed) { statsScroll = Math.max(0, statsScroll - 1); SFX.tick(); }
  if (K.downPressed) { statsScroll = Math.min(ACHV.length - 1, statsScroll + 1); SFX.tick(); }
  K.upPressed = K.downPressed = false;
  if (K.escPressed || K.enterPressed || K.jumpPressed) { results.statsPage = false; go(openMap); }
  K.escPressed = false;
}
function drawStatsPage() {
  R(ctx, '#1e122c', 0, 0, W, H);
  text('STATS & ACHIEVEMENTS', W / 2, 4, '#ffd84a', 2, 'center');
  const st = save.stats;
  const rows = [
    ['HASH COINS (LIFETIME)', st.coinsEarned || 0], ['BUZZKILLS TAKEN DOWN', st.kills], ['BOSSES BEATEN', st.bossesBeaten],
    ['BEST COMBO', st.bestCombo + 'x'], ['TIMES KNOCKED OUT', st.deaths], ['PROGRESS', progressLabel(save.spots)],
  ];
  rows.forEach((rw, i) => { const y = 16 + i * 8; text(rw[0], 6, y, '#ffffff'); text(String(rw[1]), W - 6, y, '#c8ffa0', 1, 'right'); });
  const unlockedN = ACHV.filter(a => save.achv.includes(a.id)).length;
  text('ACHIEVEMENTS: ' + unlockedN + '/' + ACHV.length, W / 2, 68, '#e4b3ff', 1, 'center');
  const visible = 8, start = Math.max(0, Math.min(ACHV.length - visible, statsScroll - Math.floor(visible / 2)));
  for (let i = 0; i < visible && start + i < ACHV.length; i++) {
    const a = ACHV[start + i], y = 78 + i * 12, on = save.achv.includes(a.id), sel = start + i === statsScroll;
    R(ctx, sel ? '#4a3a60' : '#2a1f40', 8, y, W - 16, 11);
    text((on ? '[X] ' : '[ ] ') + a.name, 12, y + 2, on ? '#ffd84a' : '#6a6a6a');
    text(on ? a.desc : '???', W - 12, y + 2, on ? '#c8ffa0' : '#6a6a6a', 1, 'right');
    hot(8, y, W - 16, 11, () => { statsScroll = start + i; });
  }
  text('UP/DOWN TO SCROLL - ENTER OR ESC FOR THE MAP', W / 2, H - 8, '#8a809a', 1, 'center');
  hot(0, H - 12, W, 12, () => { results.statsPage = false; go(openMap); });
}
function todaySeed() { const d = new Date(); return d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate(); }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
function startDaily() {
  if (save.dailyDate === todayStr()) { banner = { t: 120, a: 'ALREADY DONE TODAY', b: 'COME BACK TOMORROW FOR A NEW DAILY CHALLENGE' }; SFX.bump(); return; }
  go(() => {
    lvl = buildLevel(todaySeed() % TOTAL_LEVELS, true); lvl.daily = true; lvl.name = [lvl.name[0], "DAILY CHALLENGE - " + lvl.name[1].replace(' REMIX', '')];
    me = makePlayer(); camX = 0; state = 'brief'; briefT = 240; particles = []; popups = []; shots = []; finInfo = null; hurryT = 0; results = null; readyInfo = null; invOpen = false;
  });
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
  // v1.2 fix (Step 15.1): belt-and-suspenders - whatever set `mapSel` (host input, a relayed cursor,
  // `setWorld()`'s own guard), never let a stale/out-of-range index reach the unguarded `MAP_NODES[mapSel]`
  // dereferences below. Self-heals instead of crashing if anything upstream still gets this wrong.
  if (!(MAP_NODES[mapSel])) mapSel = Math.max(0, Math.min(mapSel, MAP_NODES.length - 1));
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
    if (nd.secret && !nodeUnlocked(nd)) return; // v1.2 (Step 6.3): truly hidden until its secret exit is found
    const open = nodeUnlocked(nd), done = nd.kind === 'level' && nd.n < save.spots, sel = i === mapSel;
    const col = nd.kind === 'shop' ? '#c070ff' : nd.kind === 'hotbox' ? '#5affd0' : nd.kind === 'gate' ? '#7ac8ff' : nd.kind === 'farm' ? (save.farm ? '#7fe07a' : '#ffd84a') : done ? '#7fe07a' : nd.mega && open ? '#ff5a6a' : nd.mini && open ? '#ff9a5a' : open ? '#ffd84a' : '#8a809a';
    const r = sel ? 5 + (frame % 30 < 15 ? 1 : 0) : 4;
    ctx.fillStyle = 'rgba(20,16,40,.4)'; ctx.fillRect(nd.x - r + 1, nd.y + r - 1, r * 2, 2);
    ctx.fillStyle = P.k; circle(nd.x, nd.y, r + 1); ctx.fillStyle = col; circle(nd.x, nd.y, r); ctx.fillStyle = '#ffffff'; ctx.fillRect(nd.x - 2, nd.y - 3, 2, 1);
    if (!open) { ctx.fillStyle = P.k; ctx.fillRect(nd.x - 1, nd.y - 1, 3, 3); }
    if (nd.kind === 'level') {
      if (open) drawStr((levelInWorld(nd.n) + 1) + '', nd.x - 1, nd.y - 2, P.k, 1);
      if (done) text('+', nd.x + 6, nd.y - 9, '#c8ffa0');
      if (nd.mega) text('MEGA', nd.x, nd.y + 8, '#ff5a6a', 1, 'center'); if (nd.mini) text('MINI', nd.x, nd.y + 8, '#ff9a5a', 1, 'center');
      // v1.2 (Step 7.2): the best grade earned for this level, shown right on its map node
      const g = save.grades && save.grades[nd.n];
      if (g) text(g, nd.x + 6, nd.y + 2, { S: '#ffd84a', A: '#c8ffa0', B: '#7ac8ff', C: '#b0a8c0' }[g], 1, 'center');
    }
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
  R(ctx, 'rgba(26,16,38,.85)', 0, 0, W, 24);
  text('WORLD ' + (curWorld + 1) + ' - ' + WORLDS[curWorld].name, 6, 5, '#c8ffa0');
  // v1.2 (Step 7.3): world select - % complete + secrets found for the world currently shown on the map
  { const beaten = Math.min(WORLDS[curWorld].levels.length, Math.max(0, save.spots - WORLD_START[curWorld])), pct = Math.round(beaten / WORLDS[curWorld].levels.length * 100);
    text(beaten + '/' + WORLDS[curWorld].levels.length + ' · SECRET ' + (save.secretsFound.includes(curWorld) ? '✓' : '?'), W - 82, 5, '#b0a8c0', 1, 'right'); }
  if (maxWorld() > 0) { const ax = Math.round(W / 2 + 30); hot(ax, 2, 12, 12, () => { setWorld(curWorld - 1); SFX.tick(); Net.send({ t: 'mapsel', i: mapSel, w: curWorld }); }); hot(ax + 14, 2, 12, 12, () => { setWorld(curWorld + 1); SFX.tick(); Net.send({ t: 'mapsel', i: mapSel, w: curWorld }); }); text('< >', ax + 1, 5, curWorld < maxWorld() ? '#ffd84a' : '#8a809a'); }
  { const bx = Math.round(W / 2 - 22); R(ctx, '#4a3a60', bx, 2, 44, 12); R(ctx, '#c8ffa0', bx, 2, 44, 1); text('MENU', W / 2, 5, '#ffffff', 1, 'center'); hot(bx, 2, 44, 12, () => openMenu()); }
  ctx.drawImage(COIN, W - 76, 3); text(save.coins + ' / ' + FARM_PRICE, W - 4, 5, '#ffd84a', 1, 'right');
  // help line moved into its own header row so it never overlaps the bottom info panel's icons
  const hint = Net.online && !isHost() ? 'HOST PICKS   H SHOP   TAB BAG   ESC MENU' : 'ARROWS/CLICK PICK   SPACE GO   Q/E WORLD   H SHOP   ESC MENU';
  text(hint, W - 4, 16, '#c8ffa0', 1, 'right');
  R(ctx, 'rgba(26,16,38,.92)', 0, H - 40, W, 40); R(ctx, '#c8ffa0', 0, H - 40, W, 1);
  text(nodeLabel(nd), 6, H - 36, '#ffd84a', 1);
  if (nd.kind === 'level') {
    const th = THEMES[themeKeyFor(nd.n)];
    const bd = bossDataFor(nd.n);
    text(nd.n < save.spots ? 'CLEARED - REPLAY FOR COINS' : (bd[4] ? 'MEGA BOSS: ' : bd[5] ? 'MINI-BOSS: ' : 'BOSS: ') + bd[0] + '  -  TEACHES: ' + SKILLS[bd[2]].name, 6, H - 27, nd.n < save.spots ? '#c8ffa0' : bd[4] ? '#ff8a8a' : bd[5] ? '#ff9a5a' : '#ffffff');
    text('TYPE: ' + levelType(nd.n) + ' - ' + (TYPE_GOAL[levelType(nd.n)] || '') + '   WATCH OUT:', 6, H - 16, '#b0a8c0');
    [...new Set(th.enemies)].forEach((e, i) => { const img = ENEMY_IMG[e][0]; ctx.drawImage(img, 90 + i * 12, H - 4 - Math.round(img.height * 0.5), Math.round(img.width * 0.5), Math.round(img.height * 0.5)); });
  } else if (nd.kind === 'shop') text('GEAR, AMMO + SNACKS. ANYONE CAN PRESS H ANYTIME ON THE MAP', 6, H - 27, '#ffffff');
  else if (nd.kind === 'hotbox') text('HOTBOX HIGHWAY - A CO-OP DRIVING MINI-GAME', 6, H - 27, '#ffffff');
  else text(save.farm ? 'YOU OWN IT. HOME SWEET HOME' : 'COSTS ' + FARM_PRICE + ' HASH COINS. YOU HAVE ' + save.coins, 6, H - 27, '#ffffff');
  drawChat();
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
  text('1. BEAT EACH WAVE OF BUZZKILLS', 40, 72, '#ffffff');
  text('2. SMOKE (' + KL('toke') + ') TO HEAL + HIT HARDER - IT\'S NOT A REQUIREMENT', 40, 82, '#ffffff');
  text('3. CHILL AT THE SMOKE SPOT AT THE END', 40, 92, '#ffffff');
  { const bd = bossDataFor(lvl.n); text((bd[4] ? 'MEGA BOSS: ' : bd[5] ? 'MINI-BOSS: ' : 'BOSS: ') + bd[0] + ' - BEAT HIM TO LEARN ' + SKILLS[bd[2]].name, 40, 104, bd[4] ? '#ff8a8a' : bd[5] ? '#ff9a5a' : '#e4b3ff'); }
  const fresh = [...new Set(th.enemies)].find(k => !save.met.includes(k) && k !== 'mouse' && k !== 'squirrel' && k !== 'cop');
  const NEW_TIP = {
    karen: ['KAREN', '#ff9ab8', ['THROWS PURSES FROM AFAR. JUMP THEM (SPACE)', 'THEN RUSH HER WHILE SHE CATCHES HER BREATH.', 'ROLLING PAPERS (K) HIT HER FROM RANGE!']],
    crab: ['CRAB', '#ff9a6a', ["CAN'T BE HIT WHILE IT'S HOPPING/PINCHING.", 'WAIT FOR IT TO LAND, THEN STRIKE.']],
    lawnmower: ['LAWNMOWER DAD', '#9af0a0', ['CHARGES STRAIGHT AT YOU IN A LINE.', 'DODGE BY MOVING UP OR DOWN (W/S).']],
    segway: ['MALL COP ON A SEGWAY', '#9ac8ff', ['FAST AND RAMS YOU HEAD-ON.', 'JUMP (SPACE) OVER HIM TO DODGE THE HIT.']],
    owl: ['OWL NARC', '#e0d0a0', ['SWOOPS IN FROM ABOVE.', 'HIT IT WITH AN AIR ATTACK (JUMP + SWING) TO REALLY HURT IT.']],
    securitybot: ['SECURITY BOT', '#ff6a6a', ['SHIELDED UP FRONT - NORMAL HITS BOUNCE OFF.', 'A BONG HAMMER STUN GETS THROUGH THE SHIELD.']],
  };
  if (fresh && NEW_TIP[fresh]) {
    const [nm, col, lines] = NEW_TIP[fresh];
    R(ctx, '#4a2a40', 34, 112, W - 68, 38); ctx.drawImage(ENEMY_IMG[fresh][1] || ENEMY_IMG[fresh][0], 40, 116);
    text('NEW BUZZKILL: ' + nm, 60, 115, col);
    lines.forEach((ln, i) => text(ln, 60, 124 + i * 8, i === lines.length - 1 ? '#c8ffa0' : '#ffffff'));
    return;
  }
  if (lvl.n === 0 && !save.sawSmokeTip) {
    save.sawSmokeTip = true; persist();
    R(ctx, '#3a2a58', 34, 112, W - 68, 38);
    text('TIP: SMOKE (' + KL('toke') + ')', 60, 115, '#c8ffa0');
    text('TAP TO PUFF A SMALL CLOUD, HOLD TO CHARGE A BIG ONE.', 60, 124, '#ffffff');
    text('HIDES YOU, CONFUSES BUZZKILLS, AND A FIRE HIT IGNITES IT!', 60, 132, '#ffffff');
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
// v1.2 fix (Step 1.4): MELEE (the old 6-weapon roster) and THROW (papers/bombs/smoke ammo, which nothing
// has granted since the A1/A2 shop rework - see the old `save.weapon(s)`/`throwsel`/`throws` reads this
// replaces) are gone. The Bag's weapon section is now exactly what the brief's A1/A2 model actually is:
// one fixed CORE weapon per homie (display-only - it's always equipped, nothing to pick) and the one WILD
// weapon currently held, if any (confirming toggles it active/inactive, same as pressing Q).
const INV_ROWS = () => [
  { label: 'CORE', items: [(() => { const w = weaponDef(), lv = coreLevel(); return { kind: 'core', def: { name: formName(w.id, lv) + ' - LV ' + lv, desc: w.desc, dmg: w.dmg + lv - 1, reach: w.reach }, icon: ICONS[w.icon], has: true, on: !(me.envWeapon && me.wildOn) }; })()] },
  { label: 'WILD', items: [me.envWeapon ? { kind: 'wild', def: { ...ENV_WEAPONS[me.envWeapon.id], desc: ENV_WEAPONS[me.envWeapon.id].desc + ' - CHARGE ' + Math.round(me.envWeapon.charge) + '/' + ENV_WEAPONS[me.envWeapon.id].charge }, icon: ICONS[WILD_ICON_ID[me.envWeapon.id]] || ICONS.joint, has: true, on: !!me.wildOn } : { kind: 'wild', def: { name: 'NONE HELD', desc: 'PICK ONE UP OFF THE GROUND THIS MISSION, THEN PRESS ' + KL('weapon') + ' TO SWITCH TO IT' }, icon: ICONS.joint, has: false, on: false }] },
  { label: 'ARMOR', items: [...ARMORS.map(a => ({ kind: 'armor', def: a, icon: ICONS[a.icon], has: save.armor.includes(a.id), on: save.armor.includes(a.id) && maxHp() === 5 + a.hp })), { kind: 'armor', def: { name: 'STASH POUCH', desc: 'HALVES THEFT AMOUNT (THIEF GETS +1 BONUS COIN)' }, icon: ICONS.pouch, has: save.pouch, on: save.pouch }] },
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
    else if (it.kind === 'core') { if (me.envWeapon && me.wildOn) cycleWeapon(); else SFX.buy(); } // switches TO Core if Wild is active; otherwise it's already equipped
    else if (it.kind === 'wild') { if (me.envWeapon && !me.wildOn) cycleWeapon(); else SFX.buy(); } // switches TO Wild if it's held but not active
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
  text(it.has || it.kind === 'wild' ? it.def.name : '??? LOCKED', 178, 48, it.has ? '#ffd84a' : '#8a809a');
  wrap(it.has || it.kind === 'wild' ? it.def.desc : (it.def && it.def.id === 'blunt' ? 'FIND IT IN A CHEST - NOT SOLD IN SHOPS' : it.kind === 'use' ? 'BUY IT AT THE HEAD SHOP OR FIND IT IN A CHEST' : 'BUY IT AT THE HEAD SHOP'), 178, 60, 30, '#ffffff');
  if ((it.kind === 'core' || it.kind === 'wild') && it.has) { text('DAMAGE ' + it.def.dmg, 178, 96, '#ff9ab8'); text('REACH ' + it.def.reach, 178, 106, '#9ae8ff'); }
  if (it.on) text('EQUIPPED', 178, 126, '#7fe07a');
  R(ctx, '#4a3a60', 16, 150, W - 32, 30);
  text('THE GOAL: BUY THE POT FARM', 22, 154, '#c8ffa0');
  text(progressLabel(save.spots), W - 22, 154, '#ffffff', 1, 'right');
  R(ctx, P.k, 22, 166, W - 44, 7); R(ctx, '#ffd84a', 23, 167, Math.round((W - 46) * Math.min(1, save.coins / FARM_PRICE)), 5);
  text(save.coins + ' / ' + FARM_PRICE + ' HASH COINS', W / 2, 167, '#ffffff', 1, 'center');
}

// ============================================================
//  NETWORK
// ============================================================
// v1.2 (Step 11.4): client error reporting - any uncaught error gets a best-effort one-shot report to the
// server (see server.js's 'clienterr' case), separate from Net entirely since a crash can happen before
// or without ever being online. Best-effort: swallows its own failures, never throws, never blocks anything.
window.addEventListener('error', e => {
  try {
    if (location.protocol === 'file:') return;
    const msg = (e && e.message || 'error') + ' @ ' + (e && e.filename || '?') + ':' + (e && e.lineno || 0);
    const sock = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    sock.onopen = () => { sock.send(JSON.stringify({ t: 'clienterr', msg })); setTimeout(() => sock.close(), 500); };
    sock.onerror = () => {};
  } catch (err) {}
});
const Net = {
  ws: null, online: false, reconnecting: false, id: 'me', hostId: 'me', code: '', color: 0, name: 'STONER', level: 0, phase: 'play', pendingCollected: [], transit: null,
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
        this.spectate = !!m.spectate; // v1.2 (Step 10.1): the crew's 4 slots were full - watch, read-only
        this.transit = m.transit || null; // v1.2 fix (Step 2.3): a ride already in progress when we joined - see startGame()
        remotes.clear(); m.players.forEach(addRemote);
        ws.onmessage = e2 => { try { onNet(JSON.parse(e2.data)); } catch (err) { console.error(err); } };
        ws.onerror = null;
        ws.onclose = () => { if (this.ws === ws) this.lost(); };
        if (running) {
          me.color = m.color; readyInfo = null;
          if (m.phase === 'lobby') openLobby();
          // v1.2 fix (Step 2.3): a ride already in progress when this player (re)joins - server.js's
          // `enter()` includes `m.transit` in this case. There's nothing to launch locally since we
          // never got the host's original transit-start, so just wait for the host's transit-end.
          else if (m.phase === 'map') { openMap(); if (m.transit) state = 'transit-wait'; }
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
function addRemote(p) { remotes.set(p.id, { name: p.name, color: p.color, spectate: !!p.spectate, x: -1000, z: 30, h: 0, tx: -1000, tz: 30, th: 0, f: 1, a: 0, b: 0, l: -1, w: 0, c: 0, atkT: 0, emote: null, hp: 5, mh: 5, cl: 1, ar: -1 }); }
function onNet(m) {
  switch (m.t) {
    case 's': { const r = remotes.get(m.id); if (!r) return; if (r.tx < -500 || r.l !== m.l) { r.x = m.x; r.z = m.y; r.h = m.h; } Object.assign(r, { tx: m.x, tz: m.y, th: m.h, f: m.f, a: m.a, b: m.b, l: m.l, w: m.w, c: m.c, hp: m.hp, mh: m.mh, cl: m.cl || 1, ar: m.ar != null ? m.ar : -1 }); break; }
    case 'fx': {
      const r = remotes.get(m.id); if (!r || r.l !== lvl.n) break;
      r.atkT = 12;
      if (m.k < 5) r.slash = { t: 12, max: 12, heavy: false, kind: (WEAPONS[m.k] || WEAPONS[0]).id, air: m.h > 6 };
      if (m.k === 9) { lvl.clouds.push({ x: m.x, z: m.y, r: m.h || 50, t: 360, heal: !!(m.f & 1), hot: !!(m.f & 2), by: m.id }); break; }
      if (m.k === 11) { shake = Math.max(shake, 10); puff(m.x, sy(m.y) - 10, 20, ['#ff5a6a', '#ff9a3a', '#ffd84a', '#ffffff'], 2); for (const c of lvl.clouds) if (Math.abs(c.x - m.x) < 6 && Math.abs(c.z - m.y) < 6) { c.ignited = true; c.hot = true; c.t = Math.min(c.t, 20); } break; }
      if (m.k === 7) shots.push({ mine: false, kind: 7, x: m.x + m.f * 8, z: m.y, h: m.h + 10, vx: m.f * 5, life: 45 });
      if (m.k === 8) shots.push({ mine: false, kind: 8, x: m.x + m.f * 6, z: m.y, h: m.h + 14, vx: m.f * 2.4, vh: 3, life: 200 });
      if (m.k === 10) shots.push({ mine: false, kind: 10, x: m.x + m.f * 6, z: m.y, h: m.h + 14, vx: m.f * 2, vh: 3, life: 200 });
      if (m.k === 5) shots.push({ mine: false, x: m.x + m.f * 10, z: m.y, h: m.h + 8, vx: m.f * 3.6, life: 26, kind: 5 });
      // v1.2 fix (Step 5): cosmetic-only echoes of the new ranged Core attacks for every OTHER client -
      // `mine: false` means updateShots() never runs hit-detection on these (see its `if (!s.mine) continue`
      // right after the kind-12 branch), so no `range`/`pierce`/etc. fields are needed, just something to draw.
      if (m.k === 12) shots.push({ mine: false, kind: 12, x: m.x + m.f * 10, z: m.y, h: m.h + 8, vx: m.f * 4.2, life: 40 });
      if (m.k === 13) shots.push({ mine: false, kind: 13, x: m.x + m.f * 14, z: m.y, h: m.h + 6, vx: m.f * 3.6, life: 30, pierce: 1 });
      if (m.k === 14) shots.push({ mine: false, kind: 14, x: m.x + m.f * 8, z: m.y, h: m.h + 8, vx: m.f * 3, life: 14 });
      break;
    }
    case 'es': if (!isHost()) applySnapshot(m); break;
    case 'hit': if (isHost() && m.l === lvl.n) { const e = lvl.enemies[m.i]; if (e && e.spawned) damageEnemy(e, m.d, m.dir, !!m.s, m.id, { burn: m.b, sp: m.sp, stun: m.st, bleed: m.bl, kb: m.kb || 1, hr: m.hr, air: !!m.a, dragon: !!m.dr }); } break;
    case 'kill': if (m.l === lvl.n) { const e = lvl.enemies[m.i]; if (e) { e.stolen = m.st || 0; onKill(e, m.by); } if (m.ex && Math.abs(m.exx - me.x) < 22 && Math.abs(m.exz - me.z) < 14) { hurt(1, 3, m.exx); SFX.boom(); } } break;
    case 'eshot': if (m.l === lvl.n) lvl.eshots.push({ x: m.x, z: m.z, vx: m.vx, life: 150, spin: 0, k: m.k, h: m.h, vh: m.vh }); break;
    // v1.1 A6: WOODS essential-oil diffuser - the cloud itself isn't tied to a player id, so it gets its own message
    case 'cloud': if (m.l === lvl.n) lvl.clouds.push({ x: m.x, z: m.z, r: 4, grow: 20, t: 480, poison: true }); break;
    // v1.1 A6: SUBURBIA mousetraps - disarm on every screen, and root whichever player tripped it
    case 'trap': if (m.l === lvl.n && lvl.traps[m.i]) { lvl.traps[m.i].armed = false; lvl.traps[m.i].flash = 30; if (m.who === Net.id) { me.rootT = Math.max(me.rootT || 0, 34); SFX.trap(); popup(me.x - 16, sy(me.z) - 34, 'STUCK!', '#c8ffa0'); } } break;
    case 'steal': if (isHost() && m.l === lvl.n) { const e = lvl.enemies[m.i]; if (e) thiefFlee(e, m.k); } break;
    case 'rev': if (m.who === Net.id && me.down > 0) { me.down = 0; me.hp = Math.ceil(maxHp() / 2); me.inv = 90; addCooked(10); banner = { t: 90, a: 'REVIVED!', b: 'YOUR HOMIE PASSED IT TO YOU' }; SFX.power(); } break;
    // v1.1 A5: non-host crewmates follow the host's authoritative life count / wipe-restart so everyone agrees.
    case 'lives': if (!isHost() && m.l === lvl.n) crewLives = m.n; break;
    case 'wipe': if (!isHost() && m.l === lvl.n) { const n = lvl.n, remix = lvl.remix; lvl = buildLevel(n, remix); me = makePlayer(); crewLives = typeof m.n === 'number' ? m.n : (Net.online && realRemotes() > 0 ? 5 : 3); checkpoint = null; camX = 0; banner = { t: 220, a: 'CREW WIPED OUT!', b: 'BACK TO THE START OF THE LEVEL' }; SFX.bump(); } break;
    case 'pass': if (m.who === Net.id) { addCooked(20); popup(me.x - 24, sy(me.z) - 36, 'PUFF PUFF PASS!', '#e4b3ff'); SFX.power(); } break;
    // v1.2 (Step 9.1): "pass the plate" (brownie) - an AoE broadcast every client checks themselves against
    // (see useItem's comment), and GIVE - a targeted item hand-off (see giveItem's comment).
    case 'brownieshare': if (Math.abs(me.x - m.x) < 40 && Math.abs(me.z - m.z) < 16) { me.buffs.rage = Math.max(me.buffs.rage || 0, 600); popup(me.x - 24, sy(me.z) - 36, 'PASSED THE PLATE!', '#fff6b0'); SFX.power(); } break;
    case 'give': if (m.to === Net.id) { save[m.id] = Math.min(itemCap(m.id), (save[m.id] || 0) + 1); persist(); popup(me.x - 20, sy(me.z) - 36, 'GOT ' + (ITEMS[m.id] ? ITEMS[m.id].name : m.id), '#c8ffa0'); SFX.buy(); } break;
    case 'chat': { const r = remotes.get(m.id); if (r) { addChat(r.name, m.msg, SHIRTS[r.color]); r.say = { msg: m.msg.toUpperCase(), t: 300 }; } break; }
    case 'boss': if (m.l === lvl.n) bossIntro(lvl.enemies[m.i]); break;
    case 'host': Net.hostId = m.id; if (m.id === Net.id) popup(camX + W / 2 - 40, 50, 'YOU ARE NOW HOSTING', '#e4b3ff'); if (window.Drive && typeof window.Drive.onNet === 'function') try { window.Drive.onNet(m); } catch (e) {} break;
    case 'pj': addRemote(m); popup(camX + W / 2 - 30, 60, m.name + (m.spectate ? ' IS SPECTATING' : ' JOINED!'), '#c8ffa0'); SFX.cp(); break;
    // v1.2 fix (Step 2.2): also forward player-left to Drive - it tracks its own crew list for Hotbox
    // Highway (drive.js is a singleton that may be running for someone else when this player leaves).
    case 'pl': { const r = remotes.get(m.id); if (r) popup(camX + W / 2 - 30, 60, r.name + ' LEFT', '#b0a8c0'); remotes.delete(m.id); if (window.Drive && typeof window.Drive.onNet === 'function') try { window.Drive.onNet(m); } catch (e) {} break; }
    // v1.2 fix (Step 2.1): generic relay envelope for the transit mini-games (m.k is a 2-letter game key
    // like 'lr'/'pp'/'mt'/'sb'/'br') and for Hotbox Highway (m.k === 'dr', matching drive.js's own key).
    // Drive is a singleton exposing _deliver directly; the 5 transit games' wrapped nets are stashed by
    // the Transit.makeNet hook above (see launchTransit) since transit.js never exposes them itself.
    case 'd': {
      if (m.k === 'dr') { if (window.Drive && window.Drive._deliver) window.Drive._deliver(m.id, m.p); break; }
      const activeNets = window.Transit && window.Transit._activeNets;
      const net = activeNets && activeNets[m.k];
      if (net && net._deliver) net._deliver(m.id, m.p);
      break;
    }
    // v1.2 fix (Step 2.2): the host broadcasts this the instant it launches a ride so every other
    // crewmate launches the exact same mini-game with the exact same options at the same moment.
    case 'transit-start': {
      if (isHost()) break; // the host already launched locally before sending this
      if (state === 'map') {
        if (m.k === 'hb') startHotboxTransit(m.from, m.to, m.w);
        else if (m.k === 'gate') startGateTransit(m.w);
      } else {
        // not on the map (mid-level, in a menu, etc.) - can't launch, so just wait for transit-end
        state = 'transit-wait';
      }
      break;
    }
    // v1.2 fix (Step 2.3): sent by the host's launchTransit onDone so a crewmate stuck on the
    // 'transit-wait' screen (joined mid-ride, never got the original transit-start) rejoins the map.
    case 'transit-end': if (state === 'transit-wait') { state = 'map'; } break;
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
    case 'emote': { const r = remotes.get(m.id); if (r) r.emote = { e: m.e % EMOTES.length, t: 120 }; checkEmoteCombo(m.e % EMOTES.length, m.id); break; }
    case 'softpause': softPause = m.on ? { by: m.by } : null; break;
    case 'kicked': persist(); banner = { t: 99999, a: 'REMOVED FROM THE ROOM', b: 'BY THE HOST - CLICK HERE TO GO TO THE MENU' }; Net.online = false; Net.kicked = true; break;
    // v1.2 (Step 11.3): FIND A CREW - the server's answer to a 'list_rooms' query.
    case 'rooms': Net.publicRooms = Array.isArray(m.list) ? m.list : []; break;
    // v1.2 (Step 11.1): server leaderboard reply, to either a submit or a query.
    case 'lb': leaderboard.key = m.key; leaderboard.list = Array.isArray(m.list) ? m.list : []; break;
  }
}

// v1.2 (Step 11.1): the current leaderboard the results screen (or FIND A CREW menu) is showing, filled
// in by the 'lb' case above once the server answers. Not persisted - always a fresh server query.
const leaderboard = { key: null, list: [] };
function lbKeyFor(n, daily) { return String(n | 0) + (daily ? ':' + String(daily) : ''); }
// v1.2 (Step 11.1): submits this run's score (works solo too - a leaderboard is only useful shared, and
// solo runs are real runs) then re-queries so the freshly-submitted score is reflected.
function submitScore(n, score, grade, daily) {
  if (location.protocol === 'file:') return; // no server to talk to when just opening the file directly
  if (Net.online) Net.send({ t: 'lb_submit', level: n, score, grade, name: Net.name, daily: daily || null });
  else { // solo: open a one-shot connection just to submit/query, since Net.send() requires Net.online
    try {
      const sock = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
      sock.onopen = () => sock.send(JSON.stringify({ t: 'lb_submit', level: n, score, grade, name: Net.name, daily: daily || null }));
      sock.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m.t === 'lb') { leaderboard.key = m.key; leaderboard.list = m.list; } } catch (e) {} sock.close(); };
      sock.onerror = () => {}; setTimeout(() => { try { sock.close(); } catch (e) {} }, 5000);
    } catch (e) {}
  }
}

// ============================================================
//  MENU
// ============================================================
const $ = id => document.getElementById(id);
try { $('name').value = localStorage.getItem('kq_name') || ''; } catch (e) {}
// on a phone, the on-screen keyboard can cover a focused input sitting low in the menu panel -
// nudge it into view once the keyboard has had a moment to open.
['name', 'code'].forEach(id => { const el = $(id); if (el) el.addEventListener('focus', () => setTimeout(() => { try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 300)); });
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
    // v1.2 (Step 7.4): save slots show world/level (already did), coins, and now overall % complete too
    b.innerHTML = d
      ? '<b>SAVE ' + i + '</b><span>' + progressLabel(d.spots || 0) + ' (' + Math.round(Math.min(d.spots || 0, TOTAL_LEVELS) / TOTAL_LEVELS * 100) + '%) &middot; ' + (d.coins || 0) + ' HASH COINS' + (d.farm ? ' &middot; FARM OWNER' : '') + '</span><small>CONTINUE' + (d.played ? ' &middot; LAST PLAYED ' + new Date(d.played).toLocaleDateString() : '') + '</small>'
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
  // v1.2 (Step 10.1): joining a level the crew is already mid-fight in - startLevel's own dropIn arg
  // spawns this client at the camera/action edge with brief invincibility instead of the level's own
  // spawn point (which could be several screens behind wherever the crew actually is by now).
  if (Net.online && Net.phase === 'play') startLevel(Net.level, true);
  else if (Net.online && Net.phase === 'shop') { results = { made: false, earned: 0, lost: 0, spotBonus: 0, ultraBonus: 0, cooked: 0, kills: 0, best: 0, msg: 'CREW IS SHOPPING - JOIN THEM' }; state = 'results'; }
  else if (Net.online && Net.phase === 'lobby') openLobby();
  else if (!save.intro && !Net.online) { state = 'story'; storyPage = 0; storyT = 0; }
  // v1.2 fix (Step 2.3): a ride was already in progress when we joined the room (Net.transit was set
  // from the 'joined' payload) - there's nothing to launch since we never got the host's transit-start,
  // so wait on the map screen underneath until the host's transit-end frees everyone.
  else if (Net.online && Net.transit) { openMap(); state = 'transit-wait'; }
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
$('create').onclick = () => { Net.name = getName(); Net.color = selectedChar; goOnline({ t: 'create', name: Net.name, level: 0, color: selectedChar, pub: !!($('pubRoom') && $('pubRoom').checked) }); };
$('join').onclick = () => {
  const code = $('code').value.trim().toUpperCase();
  if (code.length < 5) { $('err').textContent = 'ENTER THE 5-LETTER ROOM CODE'; return; }
  Net.name = getName(); Net.color = selectedChar; goOnline({ t: 'join', code, name: Net.name, color: selectedChar });
};
$('code').addEventListener('keydown', e => { if (e.key === 'Enter') $('join').click(); });
// v1.2 (Step 11.3): FIND A CREW - a one-shot connection just to ask the server for public open lobbies,
// same "solo one-shot socket" pattern submitScore() uses for leaderboard queries when not already online.
if ($('findCrew')) $('findCrew').onclick = () => {
  const listEl = $('crewList');
  listEl.style.display = 'block'; listEl.textContent = 'LOOKING FOR OPEN CREWS...';
  let sock;
  try { sock = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); }
  catch (e) { listEl.textContent = 'COULD NOT REACH THE SERVER'; return; }
  sock.onopen = () => sock.send(JSON.stringify({ t: 'list_rooms' }));
  sock.onmessage = ev => {
    try {
      const m = JSON.parse(ev.data);
      if (m.t !== 'rooms') return;
      sock.close();
      if (!m.list.length) { listEl.textContent = 'NO OPEN PUBLIC CREWS RIGHT NOW - TRY CREATING ONE'; return; }
      listEl.innerHTML = '';
      m.list.forEach(r => {
        const b = document.createElement('button');
        b.className = 'alt'; b.style.display = 'block'; b.style.margin = '3px 0'; b.style.fontSize = '9px';
        b.textContent = r.host + "'S CREW - " + r.players + '/4 - CODE ' + r.code;
        b.onclick = () => { $('code').value = r.code; $('join').click(); };
        listEl.appendChild(b);
      });
    } catch (e) {}
  };
  sock.onerror = () => { listEl.textContent = 'COULD NOT REACH THE SERVER'; };
  setTimeout(() => { try { sock.close(); } catch (e) {} }, 6000);
};
if ($('reset')) $('reset').onclick = () => { if ($('reset').dataset.sure) { save = defaultSave(); persist(); showSave(); $('reset').textContent = 'SAVE RESET'; delete $('reset').dataset.sure; } else { $('reset').dataset.sure = 1; $('reset').textContent = 'CLICK AGAIN TO WIPE YOUR SAVE'; } };
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) { $('code').value = urlRoom.toUpperCase().slice(0, 5); $('slotHint').textContent = 'YOUR FRIEND INVITED YOU TO ROOM ' + urlRoom.toUpperCase().slice(0, 5) + ' - PICK A SAVE TO PLAY WITH'; }

fit(); lvl = buildLevel(0); me = makePlayer(); camX = 0; draw();
window.__KQ = { openMenu: () => openMenu(), setMenu: (p, r) => { menu.page = p; rebinding = r; }, get camX() { return camX; }, get me() { return me; }, get lvl() { return lvl; }, get state() { return state; }, set state(v) { state = v; }, get save() { return save; }, get mouseG() { return mouseG; }, get dialog() { return dialog; }, get results() { return results; }, K, remotes, Net, startLevel, toResults, openMap, openFarmHub: () => { results = { shopOnly: true, farmHub: true }; state = 'results'; farmSel = 0; },
  openFarmScene: () => { results = { shopOnly: true, farmScene: true, endingStats: true }; state = 'results'; }, startDaily, mapClick, get mapSel() { return mapSel; }, get MAP_NODES() { return MAP_NODES; }, persist, checkAchv, get ACHV() { return ACHV; }, hurt,
  // v1.1 B1 debug hooks (used by the automated smoke tests; also handy for future debugging)
  buildLevel, mapNodes, bossDataFor, levelType, worldOf, levelInWorld, missionName, WORLDS, WORLD_START, TOTAL_LEVELS, isSecretLevel, setWorld, get curWorld() { return curWorld; },
  // v1.1 A2/A3 debug hooks (used by the automated smoke tests for the Core-cost curve + Wild charge economy)
  shopEntries, shopConfirm, itemStatus, get shopTab() { return shopTab; }, set shopTab(v) { shopTab = v; }, get shopSel() { return shopSel; }, set shopSel(v) { shopSel = v; }, ENV_WEAPONS, gainResin, onKill, coreLevel, coreUpCost,
  // v1.2 fix (Step 1) debug hooks: crew-lives visibility + the real restart-out-of-lives path, for the
  // automated 2-browser tests that verify the host/non-host crewLives-sync fix.
  get crewLives() { return crewLives; }, restartLevelOutOfLives, cycleWeapon, progressLabel,
  // v1.2 fix (Step 5) debug hooks: set the current homie's Core straight to a level (bypassing coreCap and
  // the coins/Resin/Seed cost) for the "screenshot every form" check, plus the tier/form-name helpers.
  setCoreLevel: lv => { save.cores[CORE_HOMIE[Net.color || 0]] = Math.max(1, Math.min(10, lv | 0)); save.coreCap = Math.max(save.coreCap || 3, lv | 0); },
  coreTier, formName, weaponDef, CORE_FORMS, attack, get shots() { return shots; }, coreLevel, WEAPONS,
  // v1.2 (Step 6) debug hooks: level-type gameplay + secret exits, for the automated per-world playthrough test.
  TYPE_GOAL, foundSecretExit, hostUpdate, applyHazards, nodeUnlocked, get checkpoint() { return checkpoint; },
  breakProp, get particles() { return particles; },
  // v1.2 (Step 7) debug hooks: grades, Killjoy-beaten, Astral-unlock, for the automated seeded-save check.
  computeGrade, saveBestGrade, astralUnlocked, get crewLivesStart() { return lvl && lvl.livesStart; },
  ASTRAL_LEVEL, isAstralLevel, farmHubEntries, get slowmo() { return slowmo; }, set slowmo(v) { slowmo = v; },
  ITEMS, useItem, giveItem, itemCap,
  // v1.2 (Step 9.3) debug hooks: Gravity Bong Cannon / Smoke Cloak / farm upgrades+cosmetics, for the
  // automated same-page test.
  FARM_UPGRADES, FARM_COSMETICS, farmUpgradeHas, farmCosmeticHas,
  // v1.2 (Step 10) debug hooks: drop-in join, Online Soft Pause, Spectator, emote combos, YOINK - for the
  // automated same-page + 2-tab tests.
  attack, emote, checkEmoteCombo, yoink, giveItem, toggleSoftPause, get softPause() { return softPause; },
  playersList, realRemotes, applySnapshot, addCoins, djDankLine,
  // v1.2 (Step 11) debug hooks: share card / leaderboard / armor visuals, for the automated Step 11 tests.
  shareCard, get leaderboard() { return leaderboard; }, submitScore, lbKeyFor, armorTier, todaySeed,
  // v1.2 (Step 15) debug hook: force the smoke-spot "crew is chilling" screen to stay up for a
  // screenshot/automated check instead of racing its own 150-frame auto-advance to results.
  get finInfo() { return finInfo; }, set finInfo(v) { finInfo = v; },
  // v1.2 (Step 15) debug hooks: banner/popups access + a direct popup() call, for testing the
  // popup-vs-banner overlap fix without needing to drive a real kill/pickup to generate one.
  get banner() { return banner; }, set banner(v) { banner = v; }, get popups() { return popups; }, popup, bossIntro, get TQ() { return TQ; },
  // v1.3 (mechanic redesign) debug hook: trigger a toke directly, for the automated test covering the
  // new heal+buff/chain-Ultra behavior without needing to drive real keyboard input.
  hitAToke, ultra, tooHigh };
})();
