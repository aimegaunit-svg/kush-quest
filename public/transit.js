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
    return {
      trigger(bannerText, opts) {
        opts = opts || {};
        active = true; t = 0; total = opts.freezeMs || 1400; banner = bannerText; sub = '';
        reseated = false; onReseat = opts.onReseat || null; onDone = opts.onDone || null;
      },
      get active() { return active; },
      get banner() { return banner; },
      setSub(x) { sub = x || ''; },
      tick(dtMs) {
        if (!active) return false;
        t += dtMs;
        if (!reseated && t >= total / 2) { reseated = true; if (onReseat) onReseat(); }
        if (t >= total) { active = false; if (onDone) onDone(); }
        return true;
      },
      draw(ctx, slowmoLabel) {
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
        ctx.fillText('Coins +' + (opts.coins | 0), BASE_W / 2, 50);
        ctx.fillText('Score ' + (opts.score | 0), BASE_W / 2, 62);
        const awards = opts.awards || [];
        ctx.fillStyle = '#a0e8ff';
        awards.slice(0, 5).forEach((a, i) => ctx.fillText(a, BASE_W / 2, 78 + i * 10));
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
        const ev = byId[pool.next()];
        const order = reorder(seats, ev.reseat).map(pid);
        if (net) net.send({ type: 'swap', id: ev.id, order });
        run(ev, order);
        return ev;
      },
      handle(p) {
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

  window.Transit = {
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
