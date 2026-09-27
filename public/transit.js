// transit.js — shared framework for Kush Quest "transit mini-games" (Part B3, brief v1.1)
// Plain IIFE global, zero deps. Games (lazyriver.js, paperplane.js, munchietruck.js,
// smokeballoon.js, bongrocket.js) call into window.Transit for the stuff that's genuinely
// common: canvas setup at the game's native 320x192 res, seat/role scaling for 1-4 players,
// a first-time instruction card (skippable + auto-skip-on-replay), a generic mid-game
// "swap event" system (banner + freeze/slowmo + authority handoff + no-repeat-until-exhausted
// pool), a results/awards screen renderer, WebAudio tone/noise helpers, and a thin online
// message helper that piggybacks on server.js's `{t:'d', k, p, to?}` relay (see AGENT_NOTES.md
// — this repo didn't have that relay yet, so this same PR adds the minimal server.js case
// this framework depends on).
//
// Everything that is inherently per-game (physics, rendering of the game world, controls,
// scoring rules) is NOT here — each of the 5 games owns that itself.

(function () {
  'use strict';

  // ---------------------------------------------------------------------
  // Canvas: same base resolution/scaling convention as the rest of the game.
  // ---------------------------------------------------------------------
  const BASE_W = 320, BASE_H = 192;

  function makeCanvas(mountEl, scale) {
    const canvas = document.createElement('canvas');
    canvas.width = BASE_W; canvas.height = BASE_H;
    canvas.style.width = (BASE_W * (scale || 1)) + 'px';
    canvas.style.height = (BASE_H * (scale || 1)) + 'px';
    canvas.style.imageRendering = 'pixelated';
    canvas.style.background = '#000';
    canvas.tabIndex = 0;
    (mountEl || document.body).appendChild(canvas);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return { canvas, ctx };
  }

  // Auto-fit scale to fill the window, same integer-ish scaling idea the main game uses.
  function autoScale() {
    return Math.max(1, Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H));
  }

  // ---------------------------------------------------------------------
  // Seat / role scaling for 1-4 players.
  // roles: array of role names in priority order the game wants filled, e.g.
  //   ['pilot','wing1','wing2','wing3']
  // crew: array of {id,name,color} (or just a count) in join order.
  // Returns array of {role, player} in the same order as roles, sliced to crew length,
  // with unused roles left off. First entry is always the "authority" seat.
  // ---------------------------------------------------------------------
  function assignSeats(crew, roles) {
    let list = Array.isArray(crew) ? crew.slice() : new Array(crew || 1).fill(null).map((_, i) => ({ id: 'p' + i }));
    // Online, every client builds its crew list with ITSELF first (game.js launchTransit), so sort by
    // player id to get the identical seat order on every client. Local test crews (p0..p3) keep order.
    if (Array.isArray(crew)) list.sort((a, b) => String(a && a.id).localeCompare(String(b && b.id), 'en', { numeric: true }));
    const n = Math.max(1, Math.min(4, list.length));
    const out = [];
    for (let i = 0; i < n; i++) out.push({ role: roles[Math.min(i, roles.length - 1)], player: list[i], seat: i });
    return out;
  }

  // ---------------------------------------------------------------------
  // Save-flag / skip-on-replay helper.
  // opts.save is the host game's save object; opts.seenKey is the exact field name to use
  // (each mini-game documents its own, e.g. 'seenLazyRiver'). Falls back gracefully if no
  // save object is passed (treats every run as first-time, but never throws).
  // ---------------------------------------------------------------------
  function hasSeenIntro(save, key) { return !!(save && key && save[key]); }
  function markSeenIntro(save, key) { if (save && key) { save[key] = true; try { if (typeof save.__persist === 'function') save.__persist(); } catch (e) {} } }

  // ---------------------------------------------------------------------
  // First-time instruction card. Draws over the given ctx each frame the caller renders it
  // (call `card.draw()` from your render loop while `card.active` is true), or use the
  // simpler `showInstructionCard` which owns its own key/mouse listeners and calls back.
  // ---------------------------------------------------------------------
  function showInstructionCard(ctx, opts, done) {
    const save = opts.save, key = opts.seenKey;
    if (hasSeenIntro(save, key) && !opts.force) { done(); return; }
    const title = opts.title || 'HOW TO PLAY';
    const lines = opts.lines || [];
    let closed = false;
    function draw() {
      if (closed) return;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fillRect(0, 0, BASE_W, BASE_H);
      ctx.fillStyle = '#1c2b1a';
      ctx.strokeStyle = '#8fdc6a';
      ctx.lineWidth = 2;
      const bx = 20, by = 22, bw = BASE_W - 40, bh = BASE_H - 44;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = '#c9ffb0';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(title, BASE_W / 2, by + 14);
      ctx.font = '8px monospace';
      ctx.fillStyle = '#e8ffe0';
      lines.forEach((l, i) => ctx.fillText(l, BASE_W / 2, by + 28 + i * 10));
      ctx.font = '8px monospace';
      ctx.fillStyle = '#ffe98a';
      ctx.fillText('press any key / click to start', BASE_W / 2, by + bh - 8);
      ctx.restore();
    }
    function close() {
      if (closed) return;
      closed = true;
      window.removeEventListener('keydown', onKey);
      (opts.canvas || document).removeEventListener('mousedown', onKey);
      (opts.canvas || document).removeEventListener('click', onKey);
      markSeenIntro(save, key);
      done();
    }
    function onKey() { close(); }
    window.addEventListener('keydown', onKey);
    (opts.canvas || document).addEventListener('mousedown', onKey);
    return { draw, active: () => !closed, close };
  }

  // ---------------------------------------------------------------------
  // Swap event system: a per-game pool of {name, banner} entries, drawn without repeats
  // until the pool is exhausted (then reshuffled). Handles the banner text + freeze/slowmo
  // window + calling the game's own authority-handoff + reseat logic.
  // ---------------------------------------------------------------------
  function makeSwapPool(events) {
    let bag = [];
    function refill() { bag = events.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [bag[i], bag[j]] = [bag[j], bag[i]]; } }
    refill();
    return {
      next() { if (!bag.length) refill(); return bag.pop(); }
    };
  }

  // Runs a swap event: freezes the game for `opts.freezeMs` (default 1400) showing a big
  // banner, calls opts.onReseat() at the midpoint to actually reshuffle roles/authority, then
  // resumes. `tick(dtMs)` must be called every frame from the host game's loop; returns true
  // while a swap is in progress (game should skip normal simulation / render banner on top).
  function makeSwapRunner() {
    let active = false, t = 0, total = 0, banner = '', sub = '', reseated = false, onReseat = null, onDone = null;
    let warnT = 0, warnLabel = '', warnCb = null, warnBeep = -1;
    return {
      // Countdown shown before an event lands (Hotbox Highway rule: nothing big happens without ~5s warning).
      // warn(seconds, label, cb): shows "<label> IN n" in the message slot, beeps each second, then calls cb.
      warn(sec, label, cb) { warnT = sec * 1000; warnLabel = label || 'SWAP'; warnCb = cb || null; warnBeep = -1; },
      get warning() { return warnT > 0; },
      get warnLeft() { return Math.ceil(warnT / 1000); },
      trigger(bannerText, opts) {
        opts = opts || {};
        active = true; t = 0; total = opts.freezeMs || 1400; banner = bannerText; sub = ''; warnT = 0; warnCb = null;
        reseated = false; onReseat = opts.onReseat || null; onDone = opts.onDone || null;
      },
      get active() { return active; },
      get banner() { return banner; },
      setSub(x) { sub = x || ''; },
      tick(dtMs) {
        if (warnT > 0) {
          warnT -= dtMs; const n = Math.ceil(Math.max(0, warnT) / 1000);
          if (n !== warnBeep && n > 0) { warnBeep = n; tone(n <= 2 ? 880 : 660, 0.08, 'square', 0.05); }
          if (warnT <= 0) { warnT = 0; const cb = warnCb; warnCb = null; if (cb) cb(); }
        }
        if (!active) return false;
        t += dtMs;
        if (!reseated && t >= total / 2) { reseated = true; if (onReseat) onReseat(); }
        if (t >= total) { active = false; if (onDone) onDone(); }
        return true;
      },
      draw(ctx, slowmoLabel) {
        if (warnT > 0 && !active) { const n = Math.ceil(warnT / 1000); hudMsg(ctx, warnLabel + ' IN ' + n, 'GET READY', n <= 2 ? '#ff3b3b' : '#ffd23f'); return; }
        if (!active) return;
        const p = Math.min(1, t / total);
        const flash = Math.sin(p * Math.PI) * 0.5;
        ctx.save();
        ctx.fillStyle = `rgba(255,220,60,${0.15 + flash * 0.25})`;
        ctx.fillRect(0, 0, BASE_W, BASE_H);
        ctx.fillStyle = '#000'; ctx.globalAlpha = 0.55;
        ctx.fillRect(0, BASE_H / 2 - 16, BASE_W, 32);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff3a0';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(banner, BASE_W / 2, BASE_H / 2 + 5);
        if (sub) { ctx.font = '7px monospace'; ctx.fillStyle = '#fff'; ctx.fillText(sub.slice(0, 70), BASE_W / 2, BASE_H / 2 + 26); }
        ctx.restore();
      }
    };
  }

  // ---------------------------------------------------------------------
  // Results / awards screen. Call every frame while in the 'results' state; returns true
  // once the player has dismissed it (key/click), at which point the host game should call
  // its onDone(...) with the tallied fields.
  // ---------------------------------------------------------------------
  function makeResultsScreen() {
    let dismissed = false, bound = false;
    function bind(canvas) {
      if (bound) return; bound = true;
      const h = () => { dismissed = true; };
      window.addEventListener('keydown', h, { once: true });
      (canvas || document).addEventListener('mousedown', h, { once: true });
    }
    return {
      dismissed: () => dismissed,
      draw(ctx, opts) {
        bind(opts.canvas);
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.78)';
        ctx.fillRect(0, 0, BASE_W, BASE_H);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffe98a';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(opts.title || 'MADE IT!', BASE_W / 2, 30);
        ctx.font = '9px monospace';
        ctx.fillStyle = '#fff';
        if (opts.gas != null) {
          const net = (opts.coins | 0) - (opts.gas | 0);
          ctx.fillText('Gas -' + (opts.gas | 0) + '   Earned +' + (opts.coins | 0), BASE_W / 2, 48);
          ctx.fillStyle = net >= 0 ? '#8ef0b0' : '#ff6b6b'; ctx.font = 'bold 11px monospace';
          ctx.fillText('NET ' + (net >= 0 ? '+' : '') + net, BASE_W / 2, 62); ctx.font = '9px monospace'; ctx.fillStyle = '#fff';
          ctx.fillText('Score ' + (opts.score | 0), BASE_W / 2, 72);
        } else {
          ctx.fillText('Coins +' + (opts.coins | 0), BASE_W / 2, 50);
          ctx.fillText('Score ' + (opts.score | 0), BASE_W / 2, 62);
        }
        const awards = opts.awards || [];
        ctx.fillStyle = '#a0e8ff';
        awards.slice(0, 5).forEach((a, i) => ctx.fillText(a, BASE_W / 2, (opts.gas != null ? 88 : 78) + i * 10));
        ctx.fillStyle = '#9fff9f';
        ctx.font = '8px monospace';
        ctx.fillText('press any key / click to continue', BASE_W / 2, BASE_H - 10);
        ctx.restore();
      }
    };
  }

  // ---------------------------------------------------------------------
  // WebAudio helpers — same lightweight style as the main game's SFX (no library).
  // ---------------------------------------------------------------------
  let actx = null;
  function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return actx; }
  function tone(freq, dur, type, vol) {
    const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.value = freq || 440;
    g.gain.value = (vol == null ? 0.15 : vol);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (dur || 0.15));
    o.connect(g); g.connect(c.destination);
    o.start(); o.stop(c.currentTime + (dur || 0.15) + 0.02);
  }
  function noise(dur, vol) {
    const c = ac(); if (!c) return;
    const len = Math.max(1, (dur || 0.2) * c.sampleRate);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource(); src.buffer = buf;
    const g = c.createGain(); g.gain.value = (vol == null ? 0.12 : vol);
    src.connect(g); g.connect(c.destination);
    src.start();
  }

  // ---------------------------------------------------------------------
  // Online helper: wraps net.send so games don't repeat the `{t:'d',k,p,to}` envelope.
  // net is `{ id, hostId, send: o => ... }` as passed into <Game>.start().
  // gameKey identifies the game on the wire, e.g. 'lr','pp','mt','sb','br'.
  // ---------------------------------------------------------------------
  function makeNet(net, gameKey) {
    if (!net) return null;
    return {
      id: net.id, hostId: net.hostId, isHost: net.id === net.hostId,
      send(payload, to) { try { net.send({ t: 'd', k: gameKey, p: payload, to }); } catch (e) {} },
      // Register a handler the host game calls with (fromClientId, payload) for every
      // incoming relayed message of this gameKey. The host page/test-harness is responsible
      // for routing raw socket messages here (see *-test.html for the exact wiring).
      onMessage(cb) { this._cb = cb; },
      _deliver(fromId, payload) { if (this._cb) this._cb(fromId, payload); }
    };
  }

  // ---------------------------------------------------------------------
  // Touch affordances: every mini-game runs with only invisible tap-zones by default, which
  // is unusable for a first-time phone player. isTouchDevice lets each game decide whether to
  // draw its zone labels; drawTouchZones is a shared renderer for "this rectangle of the canvas
  // does X" labeled bars, semi-transparent so they don't hide the game, brighter while held.
  // ---------------------------------------------------------------------
  const isTouchDevice = (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator && navigator.maxTouchPoints > 0));
  function drawTouchZones(ctx, zones) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px monospace';
    for (const z of zones) {
      ctx.fillStyle = z.active ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.11)';
      ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1;
      ctx.strokeRect(z.x + 0.5, z.y + 0.5, z.w - 1, z.h - 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(z.label, z.x + z.w / 2, z.y + z.h / 2 + 3);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------
  // Replay skip (FIX_STEPS Step 4.2). Completion is tracked separately from "seen the intro":
  // save.transitDone[gameKey] = true once a run reaches its results screen. On a replay the
  // start gate shows PLAY / SKIP instead of the intro card. Online, only the room host picks;
  // everyone else waits and follows the host's decision (relayed as {type:'gate', skip}).
  // ---------------------------------------------------------------------
  function hasDone(save, gk) { return !!(save && save.transitDone && save.transitDone[gk]); }
  function markDone(save, gk) {
    if (!save || !gk) return;
    save.transitDone = save.transitDone || {};
    save.transitDone[gk] = true;
    try { if (typeof save.__persist === 'function') save.__persist(); } catch (e) {}
  }
  // true = first time (must play), false = already done (SKIP is offered)
  function needsPlay(save, gk) { return !hasDone(save, gk); }

  // makeStartGate(ctx, { save, gameKey, seenKey, canvas, net, title, lines }, onPlay, onSkip)
  // Returns { draw(), handle(fromId, payload) -> bool, active() }. Call draw() every frame
  // until onPlay/onSkip fires; route incoming net payloads through handle() first.
  function makeStartGate(ctx, o, onPlay, onSkip) {
    const net = o.net || null, isHost = !net || net.isHost;
    const replay = hasDone(o.save, o.gameKey);
    let phase = 'decide', sel = 0, decision = null, intro = null, pingT = 0, last = performance.now();
    function begin(skip) {
      if (decision !== null) return;
      decision = skip;
      unbind();
      if (net && isHost) net.send({ type: 'gate', skip, seed: o.seed });
      if (skip) { phase = 'done'; onSkip(); return; }
      phase = 'intro';
      intro = showInstructionCard(ctx, { save: o.save, seenKey: o.seenKey, canvas: o.canvas, title: o.title, lines: o.lines }, () => { phase = 'done'; onPlay(); });
    }
    function onKey(e) {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') sel = 0;
      else if (k === 'arrowright' || k === 'd') sel = 1;
      else if (k === 's' || k === 'escape') begin(true);
      else if (k === 'p') begin(false);
      else if (k === 'enter' || k === ' ') begin(sel === 1);
    }
    function onClick(e) {
      const r = (o.canvas || document.body).getBoundingClientRect();
      const x = (e.clientX - r.left) * (BASE_W / r.width);
      begin(x >= BASE_W / 2);
    }
    let bound = false;
    function bind() { if (bound) return; bound = true; window.addEventListener('keydown', onKey); if (o.canvas) o.canvas.addEventListener('mousedown', onClick); }
    function unbind() { if (!bound) return; bound = false; window.removeEventListener('keydown', onKey); if (o.canvas) o.canvas.removeEventListener('mousedown', onClick); }

    if (isHost) { if (replay) bind(); else setTimeout(() => begin(false), 0); }

    function drawChoice() {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, 0, BASE_W, BASE_H);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffe98a'; ctx.font = 'bold 12px monospace';
      ctx.fillText(o.title || 'TRANSIT', BASE_W / 2, 50);
      ctx.font = '8px monospace'; ctx.fillStyle = '#e8ffe0';
      if (isHost) {
        ctx.fillText("You've done this ride before.", BASE_W / 2, 70);
        const bx = [BASE_W / 2 - 80, BASE_W / 2 + 10];
        ['PLAY AGAIN', 'SKIP'].forEach((lab, i) => {
          ctx.fillStyle = sel === i ? '#8fdc6a' : '#2a3a28'; ctx.fillRect(bx[i], 90, 70, 22);
          ctx.fillStyle = sel === i ? '#000' : '#c9ffb0'; ctx.font = 'bold 9px monospace';
          ctx.fillText(lab, bx[i] + 35, 104);
        });
        ctx.fillStyle = '#9fff9f'; ctx.font = '7px monospace';
        ctx.fillText('<-/-> + ENTER  ·  P = play  ·  S = skip  ·  or click', BASE_W / 2, 132);
      } else {
        ctx.fillText('WAITING FOR THE HOST TO START...', BASE_W / 2, 90);
      }
      ctx.restore();
    }
    return {
      active: () => phase !== 'done',
      draw() {
        const now = performance.now(); const dt = now - last; last = now;
        if (phase === 'intro') { if (intro && intro.draw) intro.draw(); return; }
        if (phase !== 'decide') return;
        if (!isHost && net) { pingT -= dt; if (pingT <= 0) { pingT = 500; net.send({ type: 'gate?' }); } }
        if (isHost && !replay) return; // first run: begin(false) is already queued
        drawChoice();
      },
      handle(fromId, p) {
        if (!p) return false;
        if (p.type === 'gate?') { if (isHost && decision !== null) net.send({ type: 'gate', skip: decision, seed: o.seed }, fromId); return true; }
        if (p.type === 'gate') { if (!isHost && decision === null) { if (p.seed != null && o.onSeed) o.onSeed(p.seed); begin(!!p.skip); } return true; }
        return false;
      },
      cleanup: unbind
    };
  }

  // ---------------------------------------------------------------------
  // Swap deck (FIX_STEPS Step 4.3): a pool of distinct swap events per game. Each event is
  //   { id, banner, reseat: 'rotate'|'reverse'|'shuffle'|'swap01'|'rotate2', fx(), sfx:[freq,type] }
  // fire() (authority only) draws the next event, computes the new seat order, broadcasts
  // {type:'swap', id, order:[playerIds]} so every client reseats identically, then runs the
  // banner freeze via the swap runner. handle() applies a relayed swap on non-authority clients.
  // ---------------------------------------------------------------------
  function reorder(seats, mode) {
    const s = seats.slice();
    if (s.length < 2) return s;
    if (mode === 'reverse') s.reverse();
    else if (mode === 'rotate2') { s.push(s.shift()); if (s.length > 2) s.push(s.shift()); }
    else if (mode === 'swap01') { const t = s[0]; s[0] = s[1]; s[1] = t; }
    else if (mode === 'shuffle') {
      const orig = s.slice();
      for (let tries = 0; tries < 8; tries++) {
        for (let i = s.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = s[i]; s[i] = s[j]; s[j] = t; }
        if (s.some((x, i) => x !== orig[i])) break;
      }
    } else s.push(s.shift()); // 'rotate' (default)
    return s;
  }
  function pid(seat, i) { return seat.player && seat.player.id != null ? seat.player.id : 'seat' + i; }
  function makeSwapDeck(events, o) {
    const seats = o.seats, runner = o.runner, net = o.net || null;
    const roles = seats.map(s => s.role);
    const pool = makeSwapPool(events.map(e => e.id));
    const byId = {}; events.forEach(e => { byId[e.id] = e; });
    const ids0 = seats.map(pid);
    const history = [];
    function applyOrder(order) {
      const map = {}; seats.forEach((s, i) => { map[pid(s, i)] = s; });
      const next = order.map(id => map[id]).filter(Boolean);
      if (next.length !== seats.length) return;
      seats.length = 0; next.forEach((s, i) => { s.role = roles[i]; s.seat = i; seats.push(s); });
    }
    function myRole() {
      if (!net) return null;
      const s = seats.find(x => x.player && x.player.id === net.id);
      return s ? s.role : null;
    }
    function run(ev, order) {
      history.push(ev.id);
      runner.trigger(ev.banner, {
        freezeMs: o.freezeMs || 1300,
        onReseat: () => {
          applyOrder(order);
          try { ev.fx && ev.fx(); } catch (e) {}
          const f = ev.sfx || [300, 'square']; tone(f[0], 0.3, f[1], 0.2);
          const r = myRole(); if (r) runner.setSub('YOU ARE NOW: ' + r.toUpperCase());
          else if (seats.length > 1) runner.setSub(seats.map(s => (s.player && s.player.name || '?') + '=' + s.role).join('  '));
        },
        onDone: o.onDone
      });
    }
    return {
      history, events,
      fire() {
        if (runner.warning || runner.active) return null;
        const go = () => {
          const ev = byId[pool.next()];
          const order = reorder(seats, ev.reseat).map(pid);
          if (net) net.send({ type: 'swap', id: ev.id, order });
          run(ev, order);
        };
        const sec = o.warnSec == null ? 5 : o.warnSec;
        if (!sec) { go(); return true; }
        if (net) net.send({ type: 'swapWarn', sec });
        runner.warn(sec, seats.length > 1 ? 'SEAT SWAP' : 'SOMETHING', go);
        return true;
      },
      handle(p) {
        if (p && p.type === 'swapWarn') { runner.warn(p.sec || 5, seats.length > 1 ? 'SEAT SWAP' : 'SOMETHING', null); return true; }
        if (!p || p.type !== 'swap' || !byId[p.id]) return false;
        run(byId[p.id], p.order || seats.map(pid));
        return true;
      },
      initialIds: ids0
    };
  }

  // ---------------------------------------------------------------------
  // Online helpers (Step 4.1).
  // rng(seed): deterministic PRNG (mulberry32). The host picks the seed; it rides along in the
  // start-gate message so every client builds the same hazard layout.
  // inputSender(net): sends held-input snapshots at most every 50ms (the server drops anything over
  // 120 msgs/sec per player), plus immediately whenever the input changes.
  // flagIdx(arr, key): indices of items with a truthy flag, for syncing collected/destroyed things.
  // ---------------------------------------------------------------------
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function newSeed() { return (Math.random() * 2147483647) | 0; }
  function inputSender(net) {
    let last = '', lastT = 0;
    return function (payload) {
      if (!net) return;
      const s = JSON.stringify(payload), now = performance.now();
      if (s === last && now - lastT < 50) return;
      if (s !== last || now - lastT >= 50) { last = s; lastT = now; net.send(payload); }
    };
  }
  function flagIdx(arr, key) { const o = []; for (let i = 0; i < arr.length; i++) if (arr[i][key]) o.push(i); return o; }
  function applyFlags(arr, key, idx) { if (!idx) return; for (const i of idx) if (arr[i]) arr[i][key] = true; }
  // seat helpers: is this seat mine? what is its current input?
  function seatIsMine(seat, net) { return !net || (seat && seat.player && seat.player.id === net.id); }

  // ---------------------------------------------------------------------
  // SHARED HUD (same layout as Hotbox Highway so every ride reads the same):
  //   top strip = trip progress (+ optional event marker), top-left = coins + break-even line,
  //   ONE message slot near the top for banners/countdowns. Keep everything else at the edges.
  // ---------------------------------------------------------------------
  function hudText(ctx, str, x, y, col, size, align) {
    ctx.save(); hudText0(ctx, str, x, y, col, size, align); ctx.restore();
  }
  function hudText0(ctx, str, x, y, col, size, align) {
    ctx.font = (size >= 2 ? 'bold 12px' : '8px') + ' monospace'; ctx.textAlign = align || 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = '#000'; ctx.fillText(str, x + 1, y + 1); ctx.fillStyle = col || '#fff'; ctx.fillText(str, x, y);
  }
  function hudMsg(ctx, t1, t2, col, y) {
    y = y == null ? 30 : y;
    ctx.save(); ctx.font = 'bold 12px monospace';
    const w = Math.max(ctx.measureText(t1).width, t2 ? t2.length * 5 : 0) + 14;
    ctx.fillStyle = 'rgba(20,12,30,0.8)'; ctx.fillRect(Math.round(BASE_W / 2 - w / 2), y - 3, Math.round(w), t2 ? 26 : 17);
    hudText(ctx, t1, BASE_W / 2, y, col || '#fff', 2, 'center');
    if (t2) hudText(ctx, t2, BASE_W / 2, y + 14, '#e8e0ff', 1, 'center');
    ctx.restore();
  }
  function hudProgress(ctx, pct, eventPct) {
    pct = Math.max(0, Math.min(1, pct || 0));
    ctx.save();
    ctx.fillStyle = 'rgba(20,12,30,0.7)'; ctx.fillRect(0, 0, BASE_W, 5);
    ctx.fillStyle = '#8ef0b0'; ctx.fillRect(0, 1, Math.round(BASE_W * pct), 3);
    if (eventPct != null && eventPct > pct) { ctx.fillStyle = '#ffd23f'; ctx.fillRect(Math.round(BASE_W * eventPct) - 1, 0, 3, 5); }
    ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(BASE_W * pct) - 2, 0, 4, 5);
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(BASE_W - 4, 0, 4, 5);
    ctx.restore();
  }
  function hudCoins(ctx, coins, gas, x, y) {
    x = x == null ? 4 : x; y = y == null ? 8 : y;
    const c = Math.floor(coins || 0);
    ctx.save();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x + 1, y, 6, 8); ctx.fillRect(x, y + 1, 8, 6); ctx.fillStyle = '#d99a12'; ctx.fillRect(x + 3, y + 2, 2, 4);
    hudText(ctx, String(c), x + 11, y - 2, '#ffd23f', 2);
    if (gas != null) { const net = c - gas, line = net < 0 ? 'GAS ' + gas + ' - NEED ' + (-net) + ' MORE' : 'PROFIT +' + net; ctx.font = '8px monospace'; ctx.fillStyle = 'rgba(20,12,30,0.55)'; ctx.fillRect(x - 2, y + 11, ctx.measureText(line).width + 4, 10); hudText(ctx, net < 0 ? 'GAS ' + gas + ' - NEED ' + (-net) + ' MORE' : 'PROFIT +' + net, x, y + 12, net < 0 ? '#c8a0a0' : '#8ef0b0', 1); }
    ctx.restore();
  }
  // A banner queue for the message slot: say(text, sub, col, secs). Only one shows at a time;
  // 'soft' messages are dropped if something is already showing.
  function makeMessages() {
    let cur = null;
    return {
      say(t1, t2, col, secs, soft) { if (soft && cur) return; cur = { t1, t2: t2 || '', col: col || '#fff', t: (secs || 1.5) * 1000 }; },
      tick(dtMs) { if (cur) { cur.t -= dtMs; if (cur.t <= 0) cur = null; } },
      draw(ctx, y) { if (cur) { ctx.save(); ctx.globalAlpha = Math.min(1, cur.t / 250); hudMsg(ctx, cur.t1, cur.t2, cur.col, y); ctx.restore(); } },
      get busy() { return !!cur; }
    };
  }

  // ---------------------------------------------------------------------
  // GAS MONEY: every ride costs coins up front (paid from the save) so a sloppy run is a net loss.
  // Call once when the ride actually starts (not on SKIP). Returns what was paid.
  // ---------------------------------------------------------------------
  const WORLD_TIER = ['park', 'beach', 'suburb', 'city', 'downtown', 'woods', 'hq'];
  function gasCost(world) { return 12 + 3 * Math.max(0, WORLD_TIER.indexOf(world)); }
  function payGas(save, world) {
    if (!save) return 0;
    const have = Math.max(0, Math.floor(+save.coins || 0)), g = Math.min(gasCost(world), have);
    if (g > 0) { save.coins = have - g; try { if (typeof save.__persist === 'function') save.__persist(); } catch (e) {} }
    return g;
  }

  // ---------------------------------------------------------------------
  // WEATHER + TIME OF DAY (same rules as Hotbox Highway, for every world).
  //   const wx = Transit.makeWeather(seed, world, night)
  //   wx.at(pct) -> { k, grip (0.65..1), fog (0..0.65), dark, wet, snow, mix, pct, wind (-1..1) }
  //   wx.sky(pct) -> [topColor, bottomColor]   (day -> golden hour -> sunset; night -> deeper)
  //   wx.drawOverlay(ctx, pct, tSec, opts)  rain/snow/fog/lightning/dusk tint, drawn over the world, under the HUD.
  //      opts.horizon: y where fog is thickest (default 60). opts.topDown: true for overhead games (fog is even).
  //   wx.changed(pct) -> name string the first frame the weather changes (feed it to the message slot), else null
  // Games decide what grip/wind/fog MEAN for their own controls (slide, drift, current, gusts...).
  // ---------------------------------------------------------------------
  const WX_POOL = {
    park: ['clear', 'clear', 'cloudy', 'rain', 'fog'], beach: ['clear', 'clear', 'cloudy', 'rain', 'storm'],
    suburb: ['clear', 'cloudy', 'rain', 'fog', 'storm'], city: ['clear', 'cloudy', 'rain', 'storm', 'fog'],
    woods: ['cloudy', 'fog', 'rain', 'snow', 'snow'], hq: ['cloudy', 'storm', 'storm', 'fog', 'rain'],
  };
  WX_POOL.downtown = WX_POOL.city;
  const WX = {
    clear: { grip: 1, fog: 0, dark: 0, name: '' }, cloudy: { grip: 1, fog: 0.1, dark: 0.15, name: 'CLOUDS ROLLING IN' },
    rain: { grip: 0.8, fog: 0.2, dark: 0.25, name: 'RAIN! IT GETS SLIPPERY' }, storm: { grip: 0.7, fog: 0.3, dark: 0.4, name: 'STORM! HOLD ON' },
    fog: { grip: 0.95, fog: 0.65, dark: 0.1, name: 'FOG BANK. EYES UP' }, snow: { grip: 0.65, fog: 0.35, dark: 0.1, name: 'SNOW! TAKE IT EASY' },
  };
  const hex6 = c => c.length === 4 ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
  const lerpC = (a, b, t) => { a = hex6(a); b = hex6(b); const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',') + ')'; };
  const SKY_DAY = { park: ['#6ec6ff', '#bfe9ff'], beach: ['#5ac8ff', '#bff0ff'], suburb: ['#8ab8ff', '#d8e8ff'], woods: ['#ff9a5a', '#ffd08a'], city: ['#150a2a', '#3a1a5a'], hq: ['#0a0a14', '#2a0a1a'] };
  function makeWeather(seed, world, night) {
    const R = rng(((seed | 0) ^ 0x5eed) >>> 0);
    const pool = WX_POOL[world] || WX_POOL.park;
    if (night == null) night = ['city', 'downtown', 'hq'].includes(world);
    const plan = [{ at: 0, k: pool[R() * 2 | 0] }];
    for (const at of [0.25 + R() * 0.1, 0.55 + R() * 0.1, 0.82]) plan.push({ at, k: pool[R() * pool.length | 0] });
    const windDir = R() < 0.5 ? -1 : 1;
    let lastK = null, boltT = 0, bolt = 0;
    function at(pct) {
      pct = Math.max(0, Math.min(1, pct || 0));
      let i = 0; while (i + 1 < plan.length && pct >= plan[i + 1].at) i++;
      const cur = plan[i], prev = i ? plan[i - 1] : cur, mix = i ? Math.min(1, (pct - cur.at) / 0.04) : 1;
      const a = WX[prev.k], b = WX[cur.k], L = (x, y) => x + (y - x) * mix;
      const isWet = k => k === 'rain' || k === 'storm';
      const wet = (isWet(cur.k) ? mix : 0) + (isWet(prev.k) ? 1 - mix : 0), snow = (cur.k === 'snow' ? mix : 0) + (prev.k === 'snow' ? 1 - mix : 0);
      return { k: cur.k, mix, pct, grip: L(a.grip, b.grip), fog: L(a.fog, b.fog), dark: L(a.dark, b.dark), wet, snow, wind: windDir * (cur.k === 'storm' ? 1 : wet * 0.5 + snow * 0.3) };
    }
    function sky(pct) {
      const base = SKY_DAY[world] || SKY_DAY[world === 'downtown' ? 'city' : 'park'];
      const keys = night ? [base, ['#0a0618', '#3a1440'], ['#05030c', '#1a0a2a']] : [base, ['#4a8ad8', '#ffc07a'], ['#3a2a6a', '#ff7a4a']];
      const seg = pct < 0.55 ? 0 : 1, t = Math.max(0, Math.min(1, seg ? (pct - 0.55) / 0.45 : pct / 0.55));
      const w = at(pct);
      return [0, 1].map(j => lerpC(keys[seg][j], keys[seg + 1][j], t)).map(c => w.dark > 0 ? c : c);
    }
    function changed(pct) { const k = at(pct).k; if (k !== lastK) { const first = lastK === null; lastK = k; if (!first && WX[k].name) return WX[k].name; } return null; }
    function drawOverlay(ctx, pct, tSec, opts) {
      opts = opts || {};
      const w = at(pct), W = BASE_W, H = BASE_H, hz = opts.horizon == null ? 60 : opts.horizon;
      ctx.save();
      if (w.dark > 0) { ctx.globalAlpha = w.dark * 0.35; ctx.fillStyle = '#2a2a3a'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      if (w.fog > 0) {
        const fc = w.snow > 0.5 ? '232,236,245' : '190,195,205';
        if (opts.topDown) { ctx.fillStyle = 'rgba(' + fc + ',' + (w.fog * 0.55) + ')'; ctx.fillRect(0, 0, W, H); }
        else { const g = ctx.createLinearGradient(0, hz - 20, 0, H); g.addColorStop(0, 'rgba(' + fc + ',' + Math.min(0.9, w.fog * 1.2) + ')'); g.addColorStop(1, 'rgba(' + fc + ',' + w.fog * 0.2 + ')'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      }
      if (w.wet > 0) { ctx.strokeStyle = 'rgba(180,200,255,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); const n = Math.round(60 * w.wet), sl = 3 + w.wind * 3; for (let i = 0; i < n; i++) { const rx = (i * 53 + tSec * 400 * (1 + i % 3)) % (W + 20) - 10, ry = (i * 97 + tSec * 520) % H; ctx.moveTo(rx, ry); ctx.lineTo(rx - sl, ry + 9); } ctx.stroke(); }
      if (w.snow > 0) { ctx.fillStyle = '#fff'; const n = Math.round(70 * w.snow); for (let i = 0; i < n; i++) { const fx = ((i * 61 + Math.sin(tSec + i) * 14 + tSec * 20 * (1 + w.wind)) % W + W) % W, fy = (i * 89 + tSec * (40 + i % 4 * 15)) % H; ctx.fillRect(fx, fy, i % 3 ? 1 : 2, i % 3 ? 1 : 2); } }
      if (w.k === 'storm' && w.mix > 0.5) {
        if (tSec > boltT) { boltT = tSec + 3 + Math.random() * 5; bolt = 0.25; noise(0.6, 0.08); }
        if (bolt > 0) { bolt -= 1 / 60; ctx.globalAlpha = Math.min(0.6, bolt * 3); ctx.fillStyle = '#eef'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
      }
      const dusk = night ? 0 : Math.max(0, pct - 0.55) / 0.45;
      if (dusk > 0) { ctx.globalAlpha = dusk * 0.18; ctx.fillStyle = pct > 0.85 ? '#2a1a50' : '#ff8a4a'; ctx.fillRect(0, 0, W, H); }
      ctx.restore();
    }
    return { plan, at, sky, changed, drawOverlay, night };
  }

  window.Transit = {
    hudText, hudMsg, hudProgress, hudCoins, makeMessages,
    gasCost, payGas, makeWeather, WX,
    BASE_W, BASE_H,
    makeCanvas, autoScale,
    assignSeats,
    hasSeenIntro, markSeenIntro,
    showInstructionCard,
    makeSwapPool, makeSwapRunner,
    makeResultsScreen,
    tone, noise,
    makeNet,
    isTouchDevice, drawTouchZones,
    hasDone, markDone, needsPlay, makeStartGate,
    reorder, makeSwapDeck,
    rng, newSeed, inputSender, flagIdx, applyFlags, seatIsMine
  };
})();
