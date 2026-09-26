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
    const list = Array.isArray(crew) ? crew : new Array(crew || 1).fill(null).map((_, i) => ({ id: 'p' + i }));
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
    let active = false, t = 0, total = 0, banner = '', reseated = false, onReseat = null, onDone = null;
    return {
      trigger(bannerText, opts) {
        opts = opts || {};
        active = true; t = 0; total = opts.freezeMs || 1400; banner = bannerText;
        reseated = false; onReseat = opts.onReseat || null; onDone = opts.onDone || null;
      },
      get active() { return active; },
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

  window.Transit = {
    BASE_W, BASE_H,
    makeCanvas, autoScale,
    assignSeats,
    hasSeenIntro, markSeenIntro,
    showInstructionCard,
    makeSwapPool, makeSwapRunner,
    makeResultsScreen,
    tone, noise,
    makeNet
  };
})();
