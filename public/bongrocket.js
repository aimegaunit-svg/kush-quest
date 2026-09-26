// bongrocket.js — "BONG ROCKET" transit mini-game (Woods -> HQ, finale). Brief v1.1 Part B3, 3.5.
// Vertical-scrolling space-shooter view. Pilot flies FREELY in 2D with momentum (8-direction,
// the only free-flight game in the set). Gunners run 360-degree turrets aimed with the MOUSE,
// independent of the pilot. Fuel = "bong water" burned by boosting; collect fuel bubbles.
// Enemies: Buzzkill drones, satellites, a mini-carrier boss-lite wave right before docking at HQ.
//
// NOTE: this same file/contract is reused later, harder and trippier, as the ride to the Astral
// Plane (v0.9 Phase F / v1.1 Part B4 unlock). Don't build that variant now — the `astral: true`
// flag below is the hook: when set it should eventually swap palette/enemy pool/music, but for
// now it only tints the background and is otherwise inert. Extend seedWave()/palette() later.
//
// Contract: window.BongRocket.start({ from, to, world, crew, save, net, onDone, mount, scale, astral })
// Save field: save.seenBongRocket (bool)
// onDone({ coins, score, awards, fuel, hits })

(function () {
  'use strict';
  const T = window.Transit;
  const W = T.BASE_W, H = T.BASE_H;

  function start(opts) {
    opts = opts || {};
    const save = opts.save || {};
    const { canvas, ctx } = T.makeCanvas(opts.mount, opts.scale || 3);
    canvas.focus();

    const netRaw = opts.net || null;
    const net = netRaw ? T.makeNet(netRaw, 'br') : null;
    const isHost = !net || net.isHost;

    const seats = T.assignSeats(opts.crew || 1, ['pilot', 'gunL', 'gunR', 'gunRear']);
    const soloMode = seats.length === 1;
    const astral = !!opts.astral;

    const st = {
      x: W / 2, y: H * 0.7, vx: 0, vy: 0, fuel: 1,
      dist: 0, finishDist: 2800, coins: 0, score: 0, hits: 0,
      ended: false, wonAwards: [], drones: [], sats: [], bubbles: [], boss: null,
      turretAngle: { gunL: -Math.PI / 2, gunR: -Math.PI / 2, gunRear: Math.PI / 2 },
      bullets: []
    };

    function seedWave() {
      let p = 200;
      while (p < st.finishDist - 400) {
        const roll = Math.random();
        if (roll < 0.4) st.drones.push({ p, x: 30 + Math.random() * (W - 60), hp: 1 });
        else if (roll < 0.65) st.sats.push({ p, x: 30 + Math.random() * (W - 60), hp: 2 });
        else st.bubbles.push({ p, x: 30 + Math.random() * (W - 60), got: false });
        p += 70 + Math.random() * 90;
      }
      st.boss = { p: st.finishDist - 250, hp: 8, x: W / 2, defeated: false };
    }
    seedWave();

    const keys = new Set();
    let mouse = { x: W / 2, y: H / 2, down: false };
    let joy = null; // {cx,cy,dx,dy} virtual joystick for touch pilot
    function onKeyDown(e) { keys.add(e.key.toLowerCase()); }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    function onMouseMove(e) { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * (W / r.width); mouse.y = (e.clientY - r.top) * (H / r.height); }
    function onMouseDown() { mouse.down = true; }
    function onMouseUp() { mouse.down = false; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', (e) => {
      const t = e.touches[0]; const r = canvas.getBoundingClientRect();
      const x = (t.clientX - r.left) * (W / r.width), y = (t.clientY - r.top) * (H / r.height);
      if (x < W / 2) joy = { cx: x, cy: y, dx: 0, dy: 0 }; else { mouse.x = x; mouse.y = y; mouse.down = true; }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      const r = canvas.getBoundingClientRect();
      for (const t of e.touches) {
        const x = (t.clientX - r.left) * (W / r.width), y = (t.clientY - r.top) * (H / r.height);
        if (joy && x < W / 2) { joy.dx = Math.max(-1, Math.min(1, (x - joy.cx) / 20)); joy.dy = Math.max(-1, Math.min(1, (y - joy.cy) / 20)); }
        else { mouse.x = x; mouse.y = y; }
      }
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('touchend', () => { joy = null; mouse.down = false; }, { passive: false });
    canvas.addEventListener('touchcancel', () => { joy = null; mouse.down = false; }, { passive: false });

    function pilotAxes() {
      let dx = 0, dy = 0;
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;
      if (keys.has('w') || keys.has('arrowup')) dy -= 1;
      if (keys.has('s') || keys.has('arrowdown')) dy += 1;
      if (joy) { dx = joy.dx; dy = joy.dy; }
      const boost = keys.has(' ') || keys.has('shift') || (joy && Math.hypot(joy.dx, joy.dy) > 0.85);
      return { dx, dy, boost };
    }

    const remoteInputs = new Map();
    if (net) net._deliver = (fromId, payload) => {
      if (intro.handle(fromId, payload)) return;
      if (payload && payload.type === 'swap') { if (!isHost) deck.handle(payload); return; }
      if (payload && payload.type === 'input') remoteInputs.set(fromId, payload);
      if (payload && payload.type === 'state' && !isHost) applyRemoteState(payload);
      if (payload && payload.type === 'fire' && isHost) doFire(payload.turret, payload.angle);
    };

    const swap = T.makeSwapRunner();
    let nextSwapAt = 900 + Math.random() * 700;
    const deck = T.makeSwapDeck([
      { id: 'zerog', banner: 'ZERO-G!', reseat: 'rotate', sfx: [400, 'sine'],
        fx: () => { st.vx += (Math.random() - 0.5) * 80; st.vy += (Math.random() - 0.5) * 80; } },
      { id: 'wormhole', banner: 'WORMHOLE!', reseat: 'shuffle', sfx: [700, 'triangle'],
        fx: () => { st.x = W - st.x; st.dist += 60; } },
      { id: 'breach', banner: 'HULL BREACH!', reseat: 'reverse', sfx: [100, 'sawtooth'],
        fx: () => { st.fuel = Math.max(0.05, st.fuel - 0.15); st.vy += 40; } },
      { id: 'munchies', banner: 'SPACE MUNCHIES!', reseat: 'swap01', sfx: [880, 'square'],
        fx: () => { st.fuel = Math.min(1, st.fuel + 0.2); } },
      { id: 'flare', banner: 'SOLAR FLARE!', reseat: 'rotate2', sfx: [1200, 'square'],
        fx: () => { st.invertT = 3; } } // pilot controls inverted for 3s
    ], { seats, runner: swap, net, onDone: () => { nextSwapAt = 700 + Math.random() * 600; } });

    let running = false;
    const intro = T.makeStartGate(ctx, {
      save, gameKey: 'br', seenKey: 'seenBongRocket', canvas, net, title: 'BONG ROCKET',
      lines: soloMode
        ? ['WASD/arrows to fly freely, hold', 'SHIFT/SPACE to boost (burns fuel).', 'Auto-gun fires — press to fire manually.', 'Collect fuel bubbles, dodge drones!']
        : ['Pilot: free 8-way flight + boost.', 'Gunners: aim turret with MOUSE,', 'click to fire at drones & satellites.']
    }, () => { running = true; }, () => finish(true));
    const results = T.makeResultsScreen();

    let last = performance.now(), raf = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      drawSpace();
      if (!running) { intro.draw(); return; }
      if (swap.tick(dt * 1000)) { st.dist += 20 * dt; draw(); swap.draw(ctx); drawHud(); return; }
      if (st.ended) {
        results.draw(ctx, { canvas, title: 'DOCKED AT HQ!', coins: st.coins, score: st.score, awards: st.wonAwards });
        if (results.dismissed()) finish();
        return;
      }
      if (isHost || !net) step(dt);
      draw();
      drawHud();
      if (isHost && net) {
        st._bT = (st._bT || 0) + dt;
        if (st._bT > 0.1) { st._bT = 0; net.send({ type: 'state', x: st.x, y: st.y, dist: st.dist, fuel: st.fuel, coins: st.coins, hits: st.hits }); }
      } else if (net) {
        net.send({ type: 'input', ...pilotAxes() });
      }
    }

    function applyRemoteState(p) { st.x = p.x; st.y = p.y; st.dist = p.dist; st.fuel = p.fuel; st.coins = p.coins; st.hits = p.hits; }

    function step(dt) {
      let { dx, dy, boost } = pilotAxes();
      if (st.invertT > 0) { st.invertT -= dt; dx = -dx; dy = -dy; }
      const ACC = 90;
      st.vx += dx * ACC * dt * (boost ? 1.6 : 1);
      st.vy += dy * ACC * dt * (boost ? 1.6 : 1);
      st.vx *= 0.94; st.vy *= 0.94;
      if (boost && st.fuel > 0) st.fuel = Math.max(0, st.fuel - dt * 0.25);
      st.x += st.vx * dt; st.y += st.vy * dt;
      st.x = Math.max(10, Math.min(W - 10, st.x));
      st.y = Math.max(10, Math.min(H - 10, st.y));
      st.dist += (40 + (boost ? 30 : 0)) * dt;

      if (mouse.down && !soloMode) { /* handled per-turret via fire calls from UI clicks below */ }
      autoFireCheck(dt);

      for (const b of st.bullets) { b.y -= b.vy * dt; b.x += (b.vx || 0) * dt; b.life -= dt; }
      st.bullets = st.bullets.filter(b => b.life > 0);

      for (const d of st.drones) if (!d.dead && Math.abs(d.p - st.dist) < 10 && Math.hypot(d.x - st.x, 0) < 10) hitPlayer();
      for (const s of st.sats) if (!s.dead && Math.abs(s.p - st.dist) < 10 && Math.hypot(s.x - st.x, 0) < 12) hitPlayer();
      for (const b of st.bubbles) if (!b.got && Math.abs(b.p - st.dist) < 10 && Math.hypot(b.x - st.x, 0) < 10) { b.got = true; st.fuel = Math.min(1, st.fuel + 0.25); st.coins += 2; T.tone(900, 0.06, 'square', 0.08); }

      checkBulletHits();

      if (st.boss && !st.boss.defeated && Math.abs(st.boss.p - st.dist) < 12 && st.dist < st.boss.p + 5) {
        // hold position near boss until defeated
        st.dist = Math.min(st.dist, st.boss.p + 4);
        if (st.boss.hp <= 0) { st.boss.defeated = true; T.tone(200, 0.5, 'sawtooth', 0.25); }
      }

      st.score = Math.floor(st.dist) + st.coins * 2;
      nextSwapAt -= dt * 60;
      if (nextSwapAt <= 0 && st.dist > 500 && st.dist < st.boss.p - 200) {
        nextSwapAt = 99999;
        deck.fire();
      }
      if ((!st.boss || st.boss.defeated) && st.dist >= st.finishDist) endRun();
      if (st.fuel <= 0 && st.hits >= 5) endRun();
    }

    function autoFireCheck(dt) {
      if (soloMode) {
        if ((keys.has('e') || mouse.down)) doFire('auto', angleToNearest());
        return;
      }
      // non-pilot seats fire on click toward mouse aim; handled by DOM click handler below in draw() input loop
    }
    canvas.addEventListener('click', (e) => {
      if (soloMode) return;
      const angle = Math.atan2(mouse.y - st.y, mouse.x - st.x);
      if (isHost) doFire('gunL', angle);
      else if (net) net.send({ type: 'fire', turret: 'gunL', angle });
    });

    function angleToNearest() {
      let best = null, bd = 1e9;
      const all = st.drones.concat(st.sats).filter(e => !e.dead);
      for (const e of all) { const d = Math.abs(e.p - st.dist); if (d < bd) { bd = d; best = e; } }
      if (!best) return -Math.PI / 2;
      return Math.atan2(0 - 0, best.x - st.x) - Math.PI / 2;
    }

    function doFire(turret, angle) {
      st.bullets.push({ x: st.x, y: st.y, vy: 220, vx: Math.sin(angle) * 40, life: 1.2 });
      T.tone(500, 0.04, 'square', 0.05);
    }

    function checkBulletHits() {
      for (const b of st.bullets) {
        for (const d of st.drones) if (!d.dead && Math.abs(d.p - st.dist - 6) < 8 && Math.abs(d.x - b.x) < 8) { d.dead = true; d.hp = 0; st.coins += 1; b.life = 0; }
        for (const s of st.sats) if (!s.dead && Math.abs(s.p - st.dist - 6) < 8 && Math.abs(s.x - b.x) < 8) { s.hp--; if (s.hp <= 0) { s.dead = true; st.coins += 2; } b.life = 0; }
        if (st.boss && !st.boss.defeated && Math.abs(st.boss.p - st.dist - 6) < 10 && Math.abs(st.boss.x - b.x) < 16) { st.boss.hp--; b.life = 0; }
      }
    }

    function hitPlayer() { st.hits++; st.fuel = Math.max(0, st.fuel - 0.1); T.noise(0.12, 0.15); }

    function endRun() {
      st.ended = true; st.wonAwards = [];
      if (st.hits === 0) st.wonAwards.push('CLEAN DOCKING — no hits');
      if (st.fuel > 0.5) st.wonAwards.push('FUEL EFFICIENT');
      st.score += st.coins * 2;
    }

    function drawSpace() {
      ctx.fillStyle = astral ? '#1a0a2e' : '#05070f';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = astral ? '#7a4ad6' : '#fff';
      for (let i = 0; i < 20; i++) { const sx = (i * 53 + 7) % W; const sy = ((i * 97 - st.dist * 2) % H + H) % H; ctx.fillRect(sx, sy, 1, 1); }
    }

    function draw() {
      const sy = p => H * 0.75 - (p - st.dist);
      for (const d of st.drones) if (!d.dead) { const y = sy(d.p); if (y > -10 && y < H + 10) { ctx.fillStyle = '#c33'; ctx.fillRect(d.x - 4, y - 4, 8, 8); } }
      for (const s of st.sats) if (!s.dead) { const y = sy(s.p); if (y > -10 && y < H + 10) { ctx.fillStyle = '#aaa'; ctx.fillRect(s.x - 5, y - 3, 10, 6); } }
      for (const b of st.bubbles) if (!b.got) { const y = sy(b.p); if (y > -10 && y < H + 10) { ctx.strokeStyle = '#5cf'; ctx.beginPath(); ctx.arc(b.x, y, 4, 0, 7); ctx.stroke(); } }
      if (st.boss && !st.boss.defeated) { const y = sy(st.boss.p); if (y > -20 && y < H + 20) { ctx.fillStyle = '#822'; ctx.fillRect(st.boss.x - 20, y - 10, 40, 20); ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText('HP ' + st.boss.hp, st.boss.x, y - 14); } }
      for (const b of st.bullets) { ctx.fillStyle = '#ff5'; ctx.fillRect(b.x - 1, b.y - 3, 2, 6); }
      ctx.fillStyle = astral ? '#c9a0ff' : '#7fdc6a';
      ctx.beginPath(); ctx.moveTo(st.x, st.y - 8); ctx.lineTo(st.x - 6, st.y + 6); ctx.lineTo(st.x + 6, st.y + 6); ctx.closePath(); ctx.fill();
      if (!soloMode) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 4, 0, 7); ctx.stroke(); }
    }

    function drawHud() {
      ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
      ctx.fillText('Progress ' + Math.min(100, Math.floor(100 * st.dist / st.finishDist)) + '%', 4, 10);
      ctx.fillText('Coins ' + st.coins, 4, 20);
      ctx.textAlign = 'right';
      ctx.fillStyle = st.fuel < 0.3 ? '#f55' : '#ffd';
      ctx.fillText('Fuel ' + Math.floor(st.fuel * 100) + '%', W - 4, 10);
      ctx.fillText('Hits ' + st.hits, W - 4, 20);
      if (T.isTouchDevice) {
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(0, 0, W / 2, H);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
        ctx.textAlign = 'center'; ctx.font = 'bold 8px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('DRAG TO FLY', W / 4, H - 6);
        ctx.fillText('TAP+DRAG TO AIM/FIRE', W * 0.75, H - 6);
        if (joy) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(joy.cx, joy.cy, 16, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(joy.cx + joy.dx * 16, joy.cy + joy.dy * 16, 5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
        ctx.restore();
      }
    }

    function finish(skipped) {
      cleanup();
      if (skipped) { opts.onDone && opts.onDone({ coins: 0, score: 0, awards: [], skipped: true, fuel: 1, hits: 0, swaps: [], from: opts.from, to: opts.to }); return; }
      T.markDone(save, 'br');
      opts.onDone && opts.onDone({ coins: st.coins, score: st.score, awards: st.wonAwards.slice(), fuel: st.fuel, hits: st.hits, swaps: deck.history.slice(), from: opts.from, to: opts.to });
    }
    function cleanup() {
      cancelAnimationFrame(raf);
      intro.cleanup();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
    }

    raf = requestAnimationFrame(loop);
    // _debug: test-page / Playwright hook only (state, seats, swap deck, force a swap).
    return { cleanup, _debug: { st, seats, deck, swap, fireSwap: () => deck.fire(), running: () => running } };
  }

  window.BongRocket = { start, needsPlay: (save) => T.needsPlay(save, 'br') };
})();
