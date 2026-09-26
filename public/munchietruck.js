// munchietruck.js — "MUNCHIE TRUCK" transit mini-game (Suburbia -> Downtown). Brief v1.1 Part B3, 3.3.
// Top-down free-roam streets, fixed short route. Driver: drift steering (rotate+throttle,
// handbrake drift around corners). Throwers: aim with the MOUSE, land snacks on customers whose
// order icon matches (color/shape) — wrong snack angers them. Combos reward accuracy over speed.
// Solo: driver auto-throws (press to confirm) when passing a customer. HOA security carts chase.
//
// Contract: window.MunchieTruck.start({ from, to, world, crew, save, net, onDone, mount, scale })
// Save field: save.seenMunchieTruck (bool)
// onDone({ coins, score, awards, combo, angry })

(function () {
  'use strict';
  const T = window.Transit;
  const W = T.BASE_W, H = T.BASE_H;
  const SNACKS = ['red', 'blue', 'green', 'yellow'];

  function start(opts) {
    opts = opts || {};
    const save = opts.save || {};
    const { canvas, ctx } = T.makeCanvas(opts.mount, opts.scale || 3);
    canvas.focus();

    const netRaw = opts.net || null;
    const net = netRaw ? T.makeNet(netRaw, 'mt') : null;
    const isHost = !net || net.isHost;

    const seats = T.assignSeats(opts.crew || 1, ['driver', 'thrower1', 'thrower2', 'thrower3']);
    const soloMode = seats.length === 1;

    const st = {
      x: W / 2, y: H * 0.6, ang: -Math.PI / 2, speed: 0, drift: 0,
      dist: 0, finishDist: 2400, coins: 0, score: 0, combo: 0, bestCombo: 0, angry: 0,
      ended: false, wonAwards: [], customers: [], carts: [], selSnack: SNACKS[0], throwCooldown: 0
    };

    function seedRoute() {
      let p = 200;
      while (p < st.finishDist - 150) {
        if (Math.random() < 0.75) st.customers.push({ p, side: Math.random() < 0.5 ? -1 : 1, snack: SNACKS[(Math.random() * SNACKS.length) | 0], served: false });
        else st.carts.push({ p, side: Math.random() < 0.5 ? -1 : 1, hit: false });
        p += 60 + Math.random() * 90;
      }
    }
    seedRoute();

    const keys = new Set();
    let mouse = { x: W / 2, y: H / 2, down: false };
    let touchAim = null; // {x,y} virtual joystick / aim for touch throwers
    function onKeyDown(e) { keys.add(e.key.toLowerCase()); if (e.key >= '1' && e.key <= '4') st.selSnack = SNACKS[+e.key - 1]; }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    function onMouseMove(e) { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * (W / r.width); mouse.y = (e.clientY - r.top) * (H / r.height); }
    function onMouseDown() { mouse.down = true; }
    function onMouseUp() { mouse.down = false; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; const r = canvas.getBoundingClientRect(); touchAim = { x: (t.clientX - r.left) * (W / r.width), y: (t.clientY - r.top) * (H / r.height) }; mouse = touchAim; mouse.down = true; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { if (!touchAim) return; const t = e.touches[0]; const r = canvas.getBoundingClientRect(); touchAim.x = (t.clientX - r.left) * (W / r.width); touchAim.y = (t.clientY - r.top) * (H / r.height); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', () => { if (mouse) mouse.down = false; touchAim = null; }, { passive: false });

    function driverInput() {
      const throttle = keys.has('w') || keys.has('arrowup');
      const brake = keys.has('s') || keys.has('arrowdown');
      const left = keys.has('a') || keys.has('arrowleft');
      const right = keys.has('d') || keys.has('arrowright');
      const handbrake = keys.has('shift') || keys.has(' ');
      return { throttle, brake, left, right, handbrake };
    }

    const remoteInputs = new Map();
    if (net) net._deliver = (fromId, payload) => {
      if (payload && payload.type === 'input') remoteInputs.set(fromId, payload);
      if (payload && payload.type === 'state' && !isHost) applyRemoteState(payload);
      if (payload && payload.type === 'throw' && isHost) doThrow(payload.side, payload.snack);
    };

    const pool = T.makeSwapPool(['BRAINFREEZE']);
    const swap = T.makeSwapRunner();
    let nextSwapAt = 900 + Math.random() * 700;
    function doBrainFreeze() { seats.push(seats.shift()); T.tone(150, 0.35, 'square', 0.2); }

    const intro = T.showInstructionCard(ctx, {
      save, seenKey: 'seenMunchieTruck', canvas, title: 'MUNCHIE TRUCK',
      lines: soloMode
        ? ['WASD/arrows to drive, SHIFT/SPACE', 'to handbrake-drift corners.', '1-4 pick snack, click to throw', 'at matching-color customers!']
        : ['Driver: WASD + SHIFT to drift.', 'Throwers: aim with MOUSE, click', 'to throw matching-color snacks.']
    }, () => { running = true; });
    let running = false;
    const results = T.makeResultsScreen();

    let last = performance.now(), raf = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      drawStreet();
      if (!running) { intro.draw(); return; }
      if (swap.tick(dt * 1000)) { st.dist += 10 * dt; swap.draw(ctx, 'BRAIN FREEZE!'); drawHud(); return; }
      if (st.ended) {
        results.draw(ctx, { canvas, title: 'DELIVERED!', coins: st.coins, score: st.score, awards: st.wonAwards });
        if (results.dismissed()) finish();
        return;
      }
      if (isHost || !net) step(dt);
      handleLocalThrow(dt);
      draw();
      drawHud();
      if (isHost && net) {
        st._bT = (st._bT || 0) + dt;
        if (st._bT > 0.1) { st._bT = 0; net.send({ type: 'state', x: st.x, y: st.y, ang: st.ang, dist: st.dist, coins: st.coins, combo: st.combo }); }
      } else if (net) {
        net.send({ type: 'input', ...driverInput() });
      }
    }

    function applyRemoteState(p) { st.x = p.x; st.y = p.y; st.ang = p.ang; st.dist = p.dist; st.coins = p.coins; st.combo = p.combo; }

    function step(dt) {
      const inp = driverInput();
      const ACC = 60, TURN = 2.4;
      if (inp.throttle) st.speed += ACC * dt;
      if (inp.brake) st.speed -= ACC * dt * 1.4;
      st.speed *= 0.98;
      st.speed = Math.max(-30, Math.min(90, st.speed));
      const turnAmt = TURN * dt * (inp.handbrake ? 1.8 : 1);
      if (inp.left) st.ang -= turnAmt;
      if (inp.right) st.ang += turnAmt;
      st.drift = inp.handbrake ? Math.min(1, st.drift + dt * 2) : Math.max(0, st.drift - dt * 3);
      st.x += Math.cos(st.ang) * st.speed * dt * (1 - st.drift * 0.3);
      st.y += Math.sin(st.ang) * st.speed * dt * (1 - st.drift * 0.3) * 0.4;
      st.y = Math.max(H * 0.35, Math.min(H * 0.85, st.y));
      st.dist += Math.abs(st.speed) * dt * 0.7;

      for (const c of st.carts) {
        if (Math.abs(c.p - st.dist) < 10 && !c.hit && Math.hypot((c.side * 40) - (st.x - W / 2), 0) < 14) { c.hit = true; st.speed *= 0.4; T.noise(0.15, 0.15); }
      }
      if (st.dist >= st.finishDist) endRun();
      st.throwCooldown = Math.max(0, st.throwCooldown - dt);
      st.score = Math.floor(st.dist) + st.coins * 3;

      nextSwapAt -= dt * 60;
      if (nextSwapAt <= 0 && st.dist > 400 && st.dist < st.finishDist - 300) {
        nextSwapAt = 99999;
        swap.trigger('BRAIN FREEZE!', { freezeMs: 1300, onReseat: doBrainFreeze, onDone: () => { nextSwapAt = 700 + Math.random() * 600; } });
      }
    }

    function handleLocalThrow(dt) {
      // solo: auto-throw confirm when near a customer (press E/click)
      const wantThrow = mouse.down;
      if (!wantThrow || st.throwCooldown > 0) return;
      if (soloMode) {
        const near = st.customers.find(c => !c.served && Math.abs(c.p - st.dist) < 16);
        if (near) { doThrow(near.side, st.selSnack); st.throwCooldown = 0.25; }
        return;
      }
      // multi: any non-driver seat throws toward mouse/touch aim position
      const side = mouse.x < W / 2 ? -1 : 1;
      if (isHost) doThrow(side, st.selSnack);
      else if (net) net.send({ type: 'throw', side, snack: st.selSnack });
      st.throwCooldown = 0.3;
    }

    function doThrow(side, snack) {
      const target = st.customers.find(c => !c.served && c.side === side && Math.abs(c.p - st.dist) < 20);
      if (!target) return;
      target.served = true;
      if (target.snack === snack) {
        st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo);
        st.coins += 2 + Math.min(6, st.combo);
        T.tone(700 + st.combo * 20, 0.08, 'square', 0.1);
      } else {
        st.combo = 0; st.angry++;
        T.noise(0.12, 0.15);
      }
    }

    function endRun() {
      st.ended = true;
      st.wonAwards = [];
      if (st.angry === 0) st.wonAwards.push('CUSTOMER SERVICE — zero angry');
      if (st.bestCombo >= 6) st.wonAwards.push('COMBO KING x' + st.bestCombo);
      st.score += st.coins * 2;
    }

    function drawStreet() {
      ctx.fillStyle = '#5a5a5a'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(0, H * 0.6); ctx.lineTo(W, H * 0.6); ctx.stroke();
      ctx.setLineDash([]);
    }

    function worldX(p, side) { return W / 2 + side * 40 - (st.dist - p); }

    function draw() {
      for (const c of st.customers) if (!c.served) {
        const x = worldX(c.p, c.side);
        if (x > -10 && x < W + 10) {
          ctx.fillStyle = colorOf(c.snack); ctx.fillRect(x - 3, H * (c.side < 0 ? 0.35 : 0.78), 6, 6);
        }
      }
      for (const c of st.carts) if (!c.hit) {
        const x = worldX(c.p, c.side);
        if (x > -10 && x < W + 10) { ctx.fillStyle = '#c40'; ctx.fillRect(x - 5, H * (c.side < 0 ? 0.4 : 0.72), 10, 6); }
      }
      // truck
      ctx.save(); ctx.translate(W / 2, st.y); ctx.rotate(st.ang + Math.PI / 2);
      ctx.fillStyle = '#e0c840'; ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = '#333'; ctx.fillRect(-6, -6, 12, 2);
      ctx.restore();
      // aim reticle for throwers
      ctx.strokeStyle = colorOf(st.selSnack); ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 4, 0, 7); ctx.stroke();
    }
    function colorOf(s) { return { red: '#f44', blue: '#48f', green: '#4c4', yellow: '#fd4' }[s] || '#fff'; }

    function drawHud() {
      ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
      ctx.fillText('Route ' + Math.min(100, Math.floor(100 * st.dist / st.finishDist)) + '%', 4, 10);
      ctx.fillText('Coins ' + st.coins + '  Combo ' + st.combo, 4, 20);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f88';
      ctx.fillText('Angry ' + st.angry, W - 4, 10);
      ctx.textAlign = 'left';
      ctx.fillStyle = colorOf(st.selSnack);
      ctx.fillText('Snack: ' + st.selSnack + ' (1-4)', 4, H - 4);
    }

    function finish() {
      cleanup();
      opts.onDone && opts.onDone({ coins: st.coins, score: st.score, awards: st.wonAwards.slice(), combo: st.bestCombo, angry: st.angry, from: opts.from, to: opts.to });
    }
    function cleanup() {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mouseup', onMouseUp);
    }

    raf = requestAnimationFrame(loop);
    return { cleanup };
  }

  window.MunchieTruck = { start };
})();
