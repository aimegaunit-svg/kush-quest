// lazyriver.js — "LAZY RIVER" transit mini-game (Park -> Beach). Brief v1.1 Part B3, section 3.1.
// Top-down vertical-scrolling river with TANK/PADDLE controls: there is no direct steering.
// Left paddle turns the tube RIGHT, right paddle turns it LEFT, both together = straighter +
// faster. Momentum + angular velocity physics, river current, rocks/swans/whirlpools, a
// waterfall finale. Extra crew (3rd/4th player) are lookout/fend-off: they push hazards away
// and grab floating snacks instead of paddling.
//
// Contract: window.LazyRiver.start({ from, to, world, crew, save, net, onDone, mount, scale })
// Save field expected from the host game: save.seenLazyRiver (bool) — set true after the
// first instruction card is dismissed; pass seenIntro via that field so replays skip the card.
// onDone({ coins, score, awards, popped, hazardsHit })

(function () {
  'use strict';
  const T = window.Transit;
  const W = T.BASE_W, H = T.BASE_H;

  function start(opts) {
    opts = opts || {};
    const save = opts.save || {};
    const scale = opts.scale || 3;
    const { canvas, ctx } = T.makeCanvas(opts.mount, scale);
    canvas.focus();

    const netRaw = opts.net || null;
    const net = netRaw ? T.makeNet(netRaw, 'lr') : null;
    const isHost = !net || net.isHost;

    const seats = T.assignSeats(opts.crew || 1, ['paddle', 'paddle2', 'fend1', 'fend2']);
    const soloMode = seats.length === 1;

    // ---- state ----
    const RIVER_L = 40, RIVER_R = W - 40; // river banks in screen space (x)
    const st = {
      x: W / 2, angle: 0, angVel: 0, speed: 46, // px/sec forward
      progress: 0, finishAt: 3200, // total "river length" to reach the waterfall
      hits: 0, popped: false, coins: 0, score: 0,
      lastCalm: 0, // checkpoint progress to respawn at
      swans: [], rocks: [], whirlpools: [], snacks: [],
      shakeT: 0, ended: false, wonAwards: []
    };

    // Seeded so every online client builds the same river (the host's seed rides in the start gate).
    let seed = T.newSeed(), R = T.rng(seed);
    function reseed(sd) { seed = sd; R = T.rng(sd); st.rocks = []; st.swans = []; st.whirlpools = []; st.snacks = []; seedHazards(); }
    function seedHazards() {
      let p = 300;
      while (p < st.finishAt - 200) {
        const roll = R();
        if (roll < 0.4) st.rocks.push({ p, x: RIVER_L + 20 + R() * (RIVER_R - RIVER_L - 40), r: 8 });
        else if (roll < 0.65) st.swans.push({ p, x: RIVER_L + 20 + R() * (RIVER_R - RIVER_L - 40), dir: R() < 0.5 ? 1 : -1, r: 7 });
        else if (roll < 0.8) st.whirlpools.push({ p, x: RIVER_L + 30 + R() * (RIVER_R - RIVER_L - 60), r: 14 });
        else st.snacks.push({ p, x: RIVER_L + 20 + R() * (RIVER_R - RIVER_L - 40), got: false });
        p += 120 + R() * 140;
      }
    }
    seedHazards();

    // ---- input ----
    const keys = new Set();
    function onKeyDown(e) { keys.add(e.key.toLowerCase()); }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ---- touch controls: left half of the canvas = left paddle, right half = right paddle ----
    const touch = { left: false, right: false, fend: false };
    function touchZoneAt(x, y) {
      if (y < H * 0.15) return 'fend';
      return x < W / 2 ? 'left' : 'right';
    }
    function onTouch(e) {
      e.preventDefault();
      touch.left = touch.right = touch.fend = false;
      const r = canvas.getBoundingClientRect();
      for (const t of e.touches) {
        const x = (t.clientX - r.left) / r.width * W, y = (t.clientY - r.top) / r.height * H;
        touch[touchZoneAt(x, y)] = true;
      }
    }
    function onTouchEnd(e) { e.preventDefault(); if (e.touches.length === 0) { touch.left = touch.right = touch.fend = false; } else onTouch(e); }
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchmove', onTouch, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

    function myInputs() {
      // Solo: A = left paddle, D = right paddle (also arrow keys as alt).
      // 2p online each seat sends its own single paddle; here we still read both for solo.
      const left = keys.has('a') || keys.has('arrowleft') || touch.left;
      const right = keys.has('d') || keys.has('arrowright') || touch.right;
      const fend = keys.has(' ') || keys.has('f') || keys.has('w') || keys.has('arrowup') || touch.fend;
      return { left, right, fend };
    }

    // remote inputs from non-host players, keyed by seat/net id
    const remoteInputs = new Map();
    if (net) net._deliver = (fromId, payload) => {
      if (intro.handle(fromId, payload)) return;
      if (payload && payload.type === 'swap') { if (!isHost) deck.handle(payload); return; }
      if (payload && payload.type === 'input') remoteInputs.set(fromId, payload);
      if (payload && payload.type === 'state' && !isHost) applyRemoteState(payload);
      if (payload && payload.type === 'end' && !isHost) applyEnd(payload);
    };
    const sendInput = T.inputSender(net);

    function combinedPaddles() {
      if (soloMode) { const i = myInputs(); return st.mirrorT > 0 ? { left: i.right, right: i.left } : { left: i.left, right: i.right }; }
      // multi-seat: seat0 = left paddle, seat1 = right paddle (2p); solo-per-seat reads own keys
      // if this client IS that seat, else pulled from remoteInputs.
      let left = false, right = false;
      seats.forEach((s, idx) => {
        const mine = (!net) || (s.player && s.player.id === net.id) || idx === 0 && !net;
        let input;
        if (mine) input = myInputs();
        else input = remoteInputs.get(s.player && s.player.id) || {};
        if (idx === 0) left = !!input.left || left;
        if (idx === 1) right = !!input.right || right;
      });
      return { left, right };
    }

    // ---- swap event ----
    const swap = T.makeSwapRunner();
    let nextSwapAt = 900 + Math.random() * 800;
    // Swap events (Step 4.3). Every one reseats the crew a different way and has its own
    // physical effect on the tube, so solo runs still feel each one.
    const deck = T.makeSwapDeck([
      { id: 'capsize', banner: 'CAPSIZE!', reseat: 'rotate', sfx: [140, 'sawtooth'],
        fx: () => { st.angle = -st.angle; st.angVel = -st.angVel; st.speed *= 0.6; } },
      { id: 'spin', banner: 'SPIN CYCLE!', reseat: 'reverse', sfx: [260, 'triangle'],
        fx: () => { st.angVel += (Math.random() < 0.5 ? -1 : 1) * 0.25; } },
      { id: 'swan', banner: 'SWAN ATTACK!', reseat: 'shuffle', sfx: [520, 'square'],
        fx: () => { st.swans.push({ p: st.progress + 140, x: st.x, dir: 1, r: 7 }); } },
      { id: 'butter', banner: 'BUTTERFINGERS!', reseat: 'swap01', sfx: [180, 'square'],
        fx: () => { st.mirrorT = 4; } }, // paddles swapped hands: left/right reversed for 4s
      { id: 'rapids', banner: 'RAPIDS!', reseat: 'rotate2', sfx: [90, 'sawtooth'],
        fx: () => { st.speed = 140; st.angVel += (Math.random() - 0.5) * 0.2; } }
    ], { seats, runner: swap, net, onDone: () => { nextSwapAt = 700 + Math.random() * 600; } });

    // ---- results / instructions ----
    let running = false;
    const intro = T.makeStartGate(ctx, {
      save, gameKey: 'lr', seenKey: 'seenLazyRiver', canvas, net, seed, onSeed: reseed,
      title: 'LAZY RIVER',
      lines: soloMode
        ? ['A = left paddle  D = right paddle', 'Left paddle turns you RIGHT,', 'right paddle turns you LEFT.', 'Both together = straight & fast!']
        : ['Paddlers: coordinate left/right!', 'Extra crew: SPACE to fend off', 'hazards and grab snacks.']
    }, () => { running = true; }, () => finish(true));
    const results = T.makeResultsScreen();

    // ---- main loop ----
    let last = performance.now(), raf = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      drawRiver();

      if (!running) { intro.draw(); return; }

      if (swap.tick(dt * 1000)) { simVisualsOnly(dt); draw(); swap.draw(ctx); drawHud(); return; }

      if (st.ended) {
        results.draw(ctx, { canvas, title: st.popped ? 'TUBE POPPED!' : 'SPLASHDOWN!', coins: st.coins, score: st.score, awards: st.wonAwards });
        if (results.dismissed()) finish();
        return;
      }

      if (isHost || !net) step(dt);
      draw();
      drawHud();

      if (isHost && net) {
        st._bcastT = (st._bcastT || 0) + dt;
        if (st._bcastT > 0.1) { st._bcastT = 0; net.send(snapshot()); }
      } else if (net) {
        sendInput({ type: 'input', ...myInputs() });
      }
    }

    function snapshot() {
      return { type: 'state', x: st.x, angle: st.angle, progress: st.progress, hits: st.hits, coins: st.coins, speed: st.speed,
        sx: st.swans.map(w => Math.round(w.x)), rk: T.flagIdx(st.rocks, 'hit'), sw: T.flagIdx(st.swans, 'hit'), sn: T.flagIdx(st.snacks, 'got'),
        rkx: st.rocks.map(r => Math.round(r.x)), extra: st.swans.length };
    }
    function applyRemoteState(p) {
      st.x = p.x; st.angle = p.angle; st.progress = p.progress; st.hits = p.hits; st.coins = p.coins; st.speed = p.speed;
      // swap events can spawn extra swans on the host; mirror count before applying positions
      while (p.extra && st.swans.length < p.extra) st.swans.push({ p: st.progress + 140, x: st.x, dir: 1, r: 7 });
      if (p.sx) p.sx.forEach((x, i) => { if (st.swans[i]) st.swans[i].x = x; });
      if (p.rkx) p.rkx.forEach((x, i) => { if (st.rocks[i]) st.rocks[i].x = x; });
      T.applyFlags(st.rocks, 'hit', p.rk); T.applyFlags(st.swans, 'hit', p.sw); T.applyFlags(st.snacks, 'got', p.sn);
    }
    function applyEnd(p) {
      if (st.ended) return;
      applyRemoteState(p.state || {});
      st.popped = !!p.popped; st.coins = p.coins; st.score = p.score; st.wonAwards = p.awards || []; st.snacksGot = p.snacksGot || 0; st.ended = true;
    }

    function simVisualsOnly(dt) { st.progress += 20 * dt; }

    function step(dt) {
      if (st.mirrorT > 0) st.mirrorT -= dt;
      let { left, right } = combinedPaddles();
      if (!soloMode && st.mirrorT > 0) { const t = left; left = right; right = t; }
      const TURN_ACC = 2.4, DAMP = 0.9, THRUST = 34, DRAG = 0.985;
      if (left) st.angVel += TURN_ACC * dt * 60 * dt; // right turn
      if (right) st.angVel -= TURN_ACC * dt * 60 * dt;
      st.angVel *= Math.pow(DAMP, dt * 60);
      st.angle += st.angVel;
      st.angle = Math.max(-1.3, Math.min(1.3, st.angle));

      let thrust = 0;
      if (left) thrust += THRUST;
      if (right) thrust += THRUST;
      if (left && right) thrust += THRUST * 0.6; // both = extra speed bonus
      st.speed += thrust * dt;
      st.speed *= Math.pow(DRAG, dt * 60);
      st.speed = Math.max(30, Math.min(140, st.speed));

      st.x += Math.sin(st.angle) * st.speed * dt;
      st.progress += (st.speed * 0.5 + 18) * dt;

      if (st.x < RIVER_L + 6) { st.x = RIVER_L + 6; st.angVel -= 0.3; }
      if (st.x > RIVER_R - 6) { st.x = RIVER_R - 6; st.angVel += 0.3; }

      // hazards
      for (const r of st.rocks) if (!r.hit && Math.abs(r.p - st.progress) < 10 && Math.hypot(r.x - st.x, 0) < r.r + 6) hitHazard(r);
      for (const s of st.swans) { s.x += Math.sin(st.progress * 0.01 + s.p) * s.dir * dt * 8; if (!s.hit && Math.abs(s.p - st.progress) < 10 && Math.hypot(s.x - st.x, 0) < s.r + 6) hitHazard(s); }
      for (const w of st.whirlpools) if (Math.abs(w.p - st.progress) < 16 && Math.hypot(w.x - st.x, 0) < w.r) st.angVel += (Math.random() - 0.5) * 0.15;
      for (const sn of st.snacks) if (!sn.got && Math.abs(sn.p - st.progress) < 8 && Math.hypot(sn.x - st.x, 0) < 8) { sn.got = true; st.coins += 3; st.snacksGot = (st.snacksGot || 0) + 1; T.tone(880, 0.08, 'square', 0.08); }
      // Lookout / fend-off seats (3rd-4th player; in solo SPACE/W also works): pole-shove the nearest
      // rock or swan ahead out of the tube's path, or hook a floating snack from up to 40px away.
      st.fendCd = Math.max(0, (st.fendCd || 0) - dt);
      if (st.fendCd <= 0 && fendPressed()) {
        st.fendCd = 0.8; st.fendFx = 0.25;
        const ahead = st.rocks.concat(st.swans).filter(h => !h.hit && h.p - st.progress > 0 && h.p - st.progress < 70 && Math.abs(h.x - st.x) < 24);
        ahead.sort((a, b) => a.p - b.p);
        if (ahead[0]) { const h = ahead[0]; h.x += (h.x >= st.x ? 1 : -1) * 30; h.x = Math.max(RIVER_L + 6, Math.min(RIVER_R - 6, h.x)); T.tone(200, 0.08, 'triangle', 0.1); }
        const sn = st.snacks.find(q => !q.got && Math.abs(q.p - st.progress) < 40 && Math.abs(q.x - st.x) < 40);
        if (sn) { sn.got = true; st.coins += 3; st.snacksGot = (st.snacksGot || 0) + 1; T.tone(880, 0.08, 'square', 0.08); }
      }

      if (Math.abs(st.angle) < 0.15 && !hazardNear()) st.lastCalm = st.progress;

      st.score = Math.floor(st.progress);
      nextSwapAt -= dt * 60;
      if (nextSwapAt <= 0 && st.progress > 400 && st.progress < st.finishAt - 300) {
        nextSwapAt = 99999;
        deck.fire();
      }

      if (st.progress >= st.finishAt) endRun(false);
    }

    function fendPressed() {
      if (soloMode) return myInputs().fend;
      let any = false;
      seats.forEach((s, idx) => {
        if (idx < 2) return; // seats 0-1 paddle
        const inp = T.seatIsMine(s, net) ? myInputs() : (remoteInputs.get(s.player && s.player.id) || {});
        if (inp.fend) any = true;
      });
      return any;
    }
    function hazardNear() {
      return st.rocks.some(r => Math.abs(r.p - st.progress) < 20) || st.swans.some(s => Math.abs(s.p - st.progress) < 20);
    }

    function hitHazard(h) {
      h.hit = true; st.hits++; st.shakeT = 0.25;
      T.noise(0.15, 0.15);
      if (st.hits >= 3) endRun(true);
    }

    function endRun(popped) {
      st.popped = popped; st.ended = true;
      if (popped) { st.coins = Math.max(0, st.coins - 5); st.progress = st.lastCalm; }
      st.wonAwards = [];
      if (st.hits === 0) st.wonAwards.push('DRY & CHILL — no hits!');
      if (st.coins >= 15) st.wonAwards.push('SNACK RUN — big haul');
      st.score += st.coins * 2;
      if (net && isHost) net.send({ type: 'end', popped, coins: st.coins, score: st.score, awards: st.wonAwards, snacksGot: st.snacksGot || 0, state: snapshot() });
    }

    function drawRiver() {
      ctx.fillStyle = '#1a5c3a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#2f8fd6';
      ctx.fillRect(RIVER_L, 0, RIVER_R - RIVER_L, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) { const y = ((i * 30 - (st.progress % 30)) + H) % H; ctx.beginPath(); ctx.moveTo(RIVER_L, y); ctx.lineTo(RIVER_R, y); ctx.stroke(); }
    }

    function worldY(p) { return H * 0.7 - (p - st.progress); }

    function draw() {
      const sh = st.shakeT > 0 ? (Math.random() - 0.5) * 4 : 0;
      st.shakeT = Math.max(0, st.shakeT - 1 / 60);
      ctx.save(); ctx.translate(sh, 0);
      for (const r of st.rocks) { const y = worldY(r.p); if (y > -20 && y < H + 20) { ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.arc(r.x, y, r.r, 0, 7); ctx.fill(); } }
      for (const s of st.swans) { const y = worldY(s.p); if (y > -20 && y < H + 20) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x, y, s.r, 0, 7); ctx.fill(); ctx.fillStyle = '#f60'; ctx.fillRect(s.x - 2, y - 8, 3, 3); } }
      for (const w of st.whirlpools) { const y = worldY(w.p); if (y > -20 && y < H + 20) { ctx.strokeStyle = '#0af'; ctx.beginPath(); ctx.arc(w.x, y, w.r * (0.6 + 0.4 * Math.sin(performance.now() / 150)), 0, 7); ctx.stroke(); } }
      for (const sn of st.snacks) if (!sn.got) { const y = worldY(sn.p); if (y > -20 && y < H + 20) { ctx.fillStyle = '#ff5'; ctx.fillRect(sn.x - 3, y - 3, 6, 6); } }
      if (st.progress > st.finishAt - 250) {
        const y = worldY(st.finishAt);
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(RIVER_L, Math.max(0, y - 6), RIVER_R - RIVER_L, 10);
      }
      // tube
      ctx.save(); ctx.translate(st.x, H * 0.7);
      ctx.rotate(st.angle);
      ctx.fillStyle = '#e0862a'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.fill();
      ctx.fillStyle = '#a85a12'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe0a0'; ctx.fillRect(-2, -3, 4, 4);
      ctx.restore();
      ctx.restore();
    }

    function drawHud() {
      ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
      ctx.fillText('Progress ' + Math.min(100, Math.floor(100 * st.progress / st.finishAt)) + '%', 4, 10);
      ctx.fillText('Coins ' + st.coins, 4, 20);
      ctx.textAlign = 'right';
      ctx.fillStyle = st.hits >= 2 ? '#f55' : '#ffd';
      ctx.fillText('Hits ' + st.hits + '/3', W - 4, 10);
      if (T.isTouchDevice) T.drawTouchZones(ctx, [
        { x: 0, y: H * 0.15, w: W / 2, h: H * 0.85, label: 'PADDLE L', active: touch.left },
        { x: W / 2, y: H * 0.15, w: W / 2, h: H * 0.85, label: 'PADDLE R', active: touch.right },
        { x: 0, y: 0, w: W, h: H * 0.15, label: 'FEND OFF', active: touch.fend },
      ]);
    }

    function finish(skipped) {
      cleanup();
      if (skipped) { opts.onDone && opts.onDone({ coins: 0, score: 0, awards: [], skipped: true, popped: false, hazardsHit: 0, swaps: [], from: opts.from, to: opts.to }); return; }
      T.markDone(save, 'lr');
      const awards = st.wonAwards.slice();
      // carry-over (Step 4.4): every 3 floating snacks grabbed = 1 Munchies (game.js caps the bag at 3)
      const munchies = Math.min(2, Math.floor((st.snacksGot || 0) / 3));
      opts.onDone && opts.onDone({ coins: st.coins, munchies, score: st.score, awards, popped: st.popped, hazardsHit: st.hits, swaps: deck.history.slice(), from: opts.from, to: opts.to });
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      intro.cleanup();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchmove', onTouch);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    }

    raf = requestAnimationFrame(loop);
    // _debug: test-page / Playwright hook only (state, seats, swap deck, force a swap).
    return { cleanup, _debug: { st, seats, deck, swap, fireSwap: () => deck.fire(), running: () => running } };
  }

  window.LazyRiver = { start, needsPlay: (save) => T.needsPlay(save, 'lr') };
})();
