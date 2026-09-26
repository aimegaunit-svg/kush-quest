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

    function seedHazards() {
      let p = 300;
      while (p < st.finishAt - 200) {
        const roll = Math.random();
        if (roll < 0.4) st.rocks.push({ p, x: RIVER_L + 20 + Math.random() * (RIVER_R - RIVER_L - 40), r: 8 });
        else if (roll < 0.65) st.swans.push({ p, x: RIVER_L + 20 + Math.random() * (RIVER_R - RIVER_L - 40), dir: Math.random() < 0.5 ? 1 : -1, r: 7 });
        else if (roll < 0.8) st.whirlpools.push({ p, x: RIVER_L + 30 + Math.random() * (RIVER_R - RIVER_L - 60), r: 14 });
        else st.snacks.push({ p, x: RIVER_L + 20 + Math.random() * (RIVER_R - RIVER_L - 40), got: false });
        p += 120 + Math.random() * 140;
      }
    }
    seedHazards();

    // ---- input ----
    const keys = new Set();
    function onKeyDown(e) { keys.add(e.key.toLowerCase()); }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    function myInputs() {
      // Solo: A = left paddle, D = right paddle (also arrow keys as alt).
      // 2p online each seat sends its own single paddle; here we still read both for solo.
      const left = keys.has('a') || keys.has('arrowleft');
      const right = keys.has('d') || keys.has('arrowright');
      const fend = keys.has(' ') || keys.has('f');
      return { left, right, fend };
    }

    // remote inputs from non-host players, keyed by seat/net id
    const remoteInputs = new Map();
    if (net) net._deliver = (fromId, payload) => {
      if (payload && payload.type === 'input') remoteInputs.set(fromId, payload);
      if (payload && payload.type === 'state' && !isHost) applyRemoteState(payload);
    };

    function combinedPaddles() {
      if (soloMode) { const i = myInputs(); return { left: i.left, right: i.right }; }
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
        if (soloMode) { left = left || !!input.left; right = right || !!input.right; }
      });
      return { left, right };
    }

    // ---- swap event ----
    const pool = T.makeSwapPool(['CAPSIZE']);
    const swap = T.makeSwapRunner();
    let nextSwapAt = 900 + Math.random() * 800;

    function doCapsize() {
      // flip: everyone lands on a different side -> rotate seat roles
      seats.push(seats.shift());
      T.tone(140, 0.4, 'sawtooth', 0.2);
    }

    // ---- results / instructions ----
    const intro = T.showInstructionCard(ctx, {
      save, seenKey: 'seenLazyRiver', canvas,
      title: 'LAZY RIVER',
      lines: soloMode
        ? ['A = left paddle  D = right paddle', 'Left paddle turns you RIGHT,', 'right paddle turns you LEFT.', 'Both together = straight & fast!']
        : ['Paddlers: coordinate left/right!', 'Extra crew: SPACE to fend off', 'hazards and grab snacks.']
    }, () => { running = true; });
    let running = false;
    const results = T.makeResultsScreen();

    // ---- main loop ----
    let last = performance.now(), raf = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      drawRiver();

      if (!running) { intro.draw(); return; }

      if (swap.tick(dt * 1000)) { simVisualsOnly(dt); swap.draw(ctx, 'CAPSIZE!'); drawHud(); return; }

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
        if (st._bcastT > 0.1) { st._bcastT = 0; net.send({ type: 'state', x: st.x, angle: st.angle, progress: st.progress, hits: st.hits }); }
      } else if (net) {
        net.send({ type: 'input', ...myInputs() });
      }
    }

    function applyRemoteState(p) { st.x = p.x; st.angle = p.angle; st.progress = p.progress; st.hits = p.hits; }

    function simVisualsOnly(dt) { st.progress += 20 * dt; }

    function step(dt) {
      const { left, right } = combinedPaddles();
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
      for (const sn of st.snacks) if (!sn.got && Math.abs(sn.p - st.progress) < 8 && Math.hypot(sn.x - st.x, 0) < 8) { sn.got = true; st.coins += 3; T.tone(880, 0.08, 'square', 0.08); }

      if (Math.abs(st.angle) < 0.15 && !hazardNear()) st.lastCalm = st.progress;

      st.score = Math.floor(st.progress);
      nextSwapAt -= dt * 60;
      if (nextSwapAt <= 0 && st.progress > 400 && st.progress < st.finishAt - 300) {
        nextSwapAt = 99999;
        swap.trigger(pool.next() + '!', { freezeMs: 1300, onReseat: doCapsize, onDone: () => { nextSwapAt = 700 + Math.random() * 600; } });
      }

      if (st.progress >= st.finishAt) endRun(false);
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
    }

    function finish() {
      cleanup();
      const awards = st.wonAwards.slice();
      opts.onDone && opts.onDone({ coins: st.coins, score: st.score, awards, popped: st.popped, hazardsHit: st.hits, from: opts.from, to: opts.to });
    }

    function cleanup() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }

    raf = requestAnimationFrame(loop);
    return { cleanup };
  }

  window.LazyRiver = { start };
})();
