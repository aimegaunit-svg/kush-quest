// smokeballoon.js — "SMOKE BALLOON" transit mini-game (Downtown -> Woods). Brief v1.1 Part B3, 3.4.
// Side-on, wind auto-scrolls right. ALTITUDE-ONLY controls: no left/right, height comes from
// breathing in RHYTHM on beat markers shared across one crew lung meter. Good hit = big lift,
// mistimed = cough (small drop), nobody smoking = sink. Limited sandbag drops for a quick climb.
// Rhythm lanes are split by player color; crew must trade off inhaling on the beat together for
// a combo lift. Hazards: police helicopters (searchlight raises Heat -> forced descent at full),
// power lines, skyscrapers, birds.
//
// Contract: window.SmokeBalloon.start({ from, to, world, crew, save, net, onDone, mount, scale })
// Save field: save.seenSmokeBalloon (bool)
// onDone({ coins, score, awards, heat, forcedDescents })

(function () {
  'use strict';
  const T = window.Transit;
  const W = T.BASE_W, H = T.BASE_H;
  const COLORS = ['#f55', '#5af', '#5f5', '#ff5'];

  function start(opts) {
    opts = opts || {};
    const save = opts.save || {};
    const { canvas, ctx } = T.makeCanvas(opts.mount, opts.scale || 3);
    canvas.focus();

    const netRaw = opts.net || null;
    const net = netRaw ? T.makeNet(netRaw, 'sb') : null;
    const isHost = !net || net.isHost;

    const seats = T.assignSeats(opts.crew || 1, ['lane0', 'lane1', 'lane2', 'sandbag']);
    const nLanes = Math.min(4, seats.length);

    const st = {
      dist: 0, finishDist: 2400, y: H * 0.5, vy: 0, lung: 0.6, heat: 0,
      coins: 0, score: 0, forcedDescents: 0, combo: 0, bestCombo: 0,
      ended: false, wonAwards: [], notes: [], sandbags: 3, sandbagsUsed: 0,
      choppers: [], wires: [], towers: [], birds: []
    };

    function seedNotes() {
      let t = 60; // beat time in "distance units"
      while (t < st.finishDist - 100) {
        st.notes.push({ t, lane: (Math.random() * nLanes) | 0, hit: false, missed: false });
        t += 26 + Math.random() * 10;
      }
    }
    function seedHazards() {
      let p = 250;
      while (p < st.finishDist - 150) {
        const roll = Math.random();
        if (roll < 0.3) st.choppers.push({ p, y: 30 + Math.random() * 60 });
        else if (roll < 0.55) st.wires.push({ p, y: 60 + Math.random() * 90 });
        else if (roll < 0.8) st.towers.push({ p, h: 60 + Math.random() * 60 });
        else st.birds.push({ p, y: 30 + Math.random() * 100 });
        p += 100 + Math.random() * 120;
      }
    }
    seedNotes(); seedHazards();

    const keys = new Set();
    let touchTaps = new Set(); // lanes tapped this frame via touch
    function onKeyDown(e) { keys.add(e.key.toLowerCase()); }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    let touchSandbag = false;
    const SANDBAG_ZONE_H = H * 0.16;
    function handleTouch(e) {
      touchTaps = new Set(); touchSandbag = false;
      const r = canvas.getBoundingClientRect();
      for (const t of e.touches) {
        const x = (t.clientX - r.left) * (W / r.width), y = (t.clientY - r.top) * (H / r.height);
        if (y < SANDBAG_ZONE_H) { touchSandbag = true; continue; }
        const lane = Math.min(nLanes - 1, Math.floor(x / (W / nLanes)));
        touchTaps.add(lane);
      }
      e.preventDefault();
    }
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouch, { passive: false });
    canvas.addEventListener('touchcancel', handleTouch, { passive: false });

    // key 1..4 -> lanes; also J/K/L/; as alt; solo just uses SPACE for lane0
    const LANE_KEYS = [['1', 'j'], ['2', 'k'], ['3', 'l'], ['4', ';']];
    function laneTapped(lane) {
      if (touchTaps.has(lane)) return true;
      if (nLanes === 1) return keys.has(' ') || LANE_KEYS[0].some(k => keys.has(k));
      return LANE_KEYS[lane] ? LANE_KEYS[lane].some(k => keys.has(k)) : false;
    }
    function sandbagPressed() { return keys.has('b') || keys.has('shift') || touchSandbag; }

    const remoteInputs = new Map();
    if (net) net._deliver = (fromId, payload) => {
      if (intro.handle(fromId, payload)) return;
      if (payload && payload.type === 'swap') { if (!isHost) deck.handle(payload); return; }
      if (payload && payload.type === 'input') remoteInputs.set(fromId, payload);
      if (payload && payload.type === 'state' && !isHost) applyRemoteState(payload);
    };

    const swap = T.makeSwapRunner();
    let nextSwapAt = 900 + Math.random() * 700;
    // Every event reseats players (so each player's lane/colour changes) and does its own thing.
    const shiftLanes = (k) => { if (nLanes > 1) st.notes.forEach(n => { if (!n.hit && !n.missed) n.lane = (n.lane + k) % nLanes; }); };
    const deck = T.makeSwapDeck([
      { id: 'hiccups', banner: 'HICCUPS!', reseat: 'shuffle', sfx: [300, 'triangle'],
        fx: () => { shiftLanes(1); } },
      { id: 'cough', banner: 'COUGHING FIT!', reseat: 'rotate', sfx: [120, 'sawtooth'],
        fx: () => { st.lung = Math.max(0, st.lung - 0.2); st.combo = 0; } },
      { id: 'contact', banner: 'CONTACT HIGH!', reseat: 'reverse', sfx: [660, 'sine'],
        fx: () => { st.lung = Math.min(1, st.lung + 0.2); } },
      { id: 'bird', banner: 'BIRD STRIKE!', reseat: 'swap01', sfx: [900, 'square'],
        fx: () => { st.vy += 35; shiftLanes(nLanes > 2 ? 2 : 1); } },
      { id: 'sandbag', banner: 'LOOSE SANDBAG!', reseat: 'rotate2', sfx: [80, 'sine'],
        fx: () => { if (st.sandbags > 0) { st.sandbags--; st.vy -= 50; } else st.vy += 20; } }
    ], { seats, runner: swap, net, onDone: () => { nextSwapAt = 700 + Math.random() * 600; } });

    let running = false;
    const intro = T.makeStartGate(ctx, {
      save, gameKey: 'sb', seenKey: 'seenSmokeBalloon', canvas, net, title: 'SMOKE BALLOON',
      lines: [
        'Tap your lane key on the beat!',
        '(1/2/3/4 or SPACE solo)', 'Good timing = lift, miss = cough.',
        'B/SHIFT drops a sandbag for a quick climb.',
        "Don't get lit up by chopper lights!"
      ]
    }, () => { running = true; }, () => finish(true));
    const results = T.makeResultsScreen();

    let last = performance.now(), raf = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      drawSky();
      if (!running) { intro.draw(); return; }
      if (swap.tick(dt * 1000)) { st.dist += 12 * dt; draw(); swap.draw(ctx); drawHud(); touchTaps.clear(); return; }
      if (st.ended) {
        results.draw(ctx, { canvas, title: 'RIDE OVER!', coins: st.coins, score: st.score, awards: st.wonAwards });
        if (results.dismissed()) finish();
        touchTaps.clear();
        return;
      }
      if (isHost || !net) step(dt);
      draw();
      drawHud();
      touchTaps.clear();
      if (isHost && net) {
        st._bT = (st._bT || 0) + dt;
        if (st._bT > 0.1) { st._bT = 0; net.send({ type: 'state', y: st.y, dist: st.dist, lung: st.lung, heat: st.heat, coins: st.coins }); }
      } else if (net) {
        for (let i = 0; i < nLanes; i++) if (laneTapped(i)) net.send({ type: 'input', tap: i });
      }
    }

    function applyRemoteState(p) { st.y = p.y; st.dist = p.dist; st.lung = p.lung; st.heat = p.heat; st.coins = p.coins; }

    function step(dt) {
      st.dist += 34 * dt;
      // rhythm notes: window +/- 6 dist units around st.dist
      for (const n of st.notes) {
        if (n.hit || n.missed) continue;
        if (laneTapped(n.lane) && Math.abs(n.t - st.dist) < 7) {
          n.hit = true; st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo);
          const lift = 0.06 + Math.min(0.12, st.combo * 0.01);
          st.lung = Math.min(1, st.lung + lift);
          st.coins += 1;
          T.tone(500 + st.combo * 15, 0.06, 'square', 0.08);
        } else if (n.t < st.dist - 8) {
          n.missed = true; st.combo = 0; st.lung = Math.max(0, st.lung - 0.05);
          T.noise(0.08, 0.08);
        }
      }
      if (sandbagPressed() && st.sandbags > 0 && !st._sbLock) {
        st.sandbags--; st.sandbagsUsed++; st.vy -= 60; st._sbLock = true; T.tone(120, 0.2, 'sine', 0.15);
      }
      if (!sandbagPressed()) st._sbLock = false;

      st.lung = Math.max(0, st.lung - dt * 0.05); // natural drift down
      const targetVy = (st.lung - 0.5) * -80; // more lung -> rise
      st.vy += (targetVy - st.vy) * Math.min(1, dt * 3);
      st.y += st.vy * dt;
      st.y = Math.max(10, Math.min(H - 12, st.y));

      for (const c of st.choppers) {
        const lit = Math.abs(c.p - st.dist) < 30 && Math.abs(c.y - st.y) < 30;
        if (lit) { st.heat = Math.min(1, st.heat + dt * 0.4); }
      }
      st.heat = Math.max(0, st.heat - dt * 0.1);
      if (st.heat >= 1) forcedDescent();

      for (const w of st.wires) if (!w.hit && Math.abs(w.p - st.dist) < 6 && Math.abs(w.y - st.y) < 8) { w.hit = true; st.vy += 40; T.noise(0.15, 0.15); }
      for (const t of st.towers) if (!t.hit && Math.abs(t.p - st.dist) < 8 && st.y > H - t.h) { t.hit = true; st.vy += 30; T.noise(0.15, 0.15); }

      st.score = Math.floor(st.dist) + st.coins * 2;
      nextSwapAt -= dt * 60;
      if (nextSwapAt <= 0 && st.dist > 400 && st.dist < st.finishDist - 300) {
        nextSwapAt = 99999;
        deck.fire();
      }
      if (st.dist >= st.finishDist) endRun();
    }

    function forcedDescent() {
      st.forcedDescents++; st.heat = 0; st.vy += 70; st.y = Math.min(H - 12, st.y + 20);
      T.tone(100, 0.4, 'sawtooth', 0.2);
    }

    function endRun() {
      st.ended = true; st.wonAwards = [];
      if (st.forcedDescents === 0) st.wonAwards.push('COOL AS ICE — no heat descents');
      if (st.bestCombo >= 8) st.wonAwards.push('IN THE POCKET x' + st.bestCombo);
      st.score += st.coins * 2;
    }

    function drawSky() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2a2a44'); g.addColorStop(1, '#5a4a70');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    function draw() {
      const sx = p => W * 0.4 + (p - st.dist);
      for (const w of st.wires) if (!w.hit) { const x = sx(w.p); if (x > -10 && x < W + 10) { ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(x, w.y - 40); ctx.lineTo(x, w.y + 40); ctx.stroke(); } }
      for (const t of st.towers) if (!t.hit) { const x = sx(t.p); if (x > -20 && x < W + 20) { ctx.fillStyle = '#222'; ctx.fillRect(x - 8, H - t.h, 16, t.h); } }
      for (const c of st.choppers) { const x = sx(c.p); if (x > -20 && x < W + 20) { ctx.fillStyle = '#444'; ctx.fillRect(x - 6, c.y - 3, 12, 6); ctx.fillStyle = 'rgba(255,255,150,0.25)'; ctx.beginPath(); ctx.moveTo(x, c.y); ctx.lineTo(x - 20, st.y); ctx.lineTo(x + 20, st.y); ctx.closePath(); ctx.fill(); } }
      for (const b of st.birds) { const x = sx(b.p); if (x > -10 && x < W + 10) { ctx.fillStyle = '#ccc'; ctx.fillRect(x - 3, b.y, 6, 3); } }
      // balloon
      const bx = sx(st.dist);
      ctx.fillStyle = '#e0862a'; ctx.beginPath(); ctx.arc(bx, st.y, 12, 0, 7); ctx.fill();
      ctx.fillStyle = '#a85a12'; ctx.fillRect(bx - 5, st.y + 10, 10, 6);
      // beat lanes at bottom
      const laneW = W / nLanes;
      for (let i = 0; i < nLanes; i++) {
        ctx.strokeStyle = COLORS[i]; ctx.strokeRect(i * laneW + 2, H - 20, laneW - 4, 16);
      }
      for (const n of st.notes) {
        if (n.hit) continue;
        const rel = n.t - st.dist;
        if (rel > -8 && rel < 40) {
          const x = i2x(n.lane, laneW);
          const y = H - 20 - (rel / 40) * (H - 40);
          if (y > 0 && y < H) { ctx.fillStyle = n.missed ? '#666' : COLORS[n.lane]; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
        }
      }
    }
    function i2x(lane, laneW) { return lane * laneW + laneW / 2; }

    function drawHud() {
      ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
      ctx.fillText('Progress ' + Math.min(100, Math.floor(100 * st.dist / st.finishDist)) + '%', 4, 10);
      ctx.fillText('Coins ' + st.coins + '  Combo ' + st.combo, 4, 20);
      ctx.textAlign = 'right';
      ctx.fillStyle = st.heat > 0.6 ? '#f55' : '#ffd';
      ctx.fillText('Heat ' + Math.floor(st.heat * 100) + '%  Bags ' + st.sandbags, W - 4, 10);
      // lung meter bar
      ctx.fillStyle = '#333'; ctx.fillRect(4, H - 30, 60, 5);
      ctx.fillStyle = '#7fdc6a'; ctx.fillRect(4, H - 30, 60 * st.lung, 5);
      if (T.isTouchDevice) {
        const lw = W / nLanes;
        const zones = [{ x: 0, y: 0, w: W, h: SANDBAG_ZONE_H, label: 'SANDBAG', active: touchSandbag }];
        for (let i = 0; i < nLanes; i++) zones.push({ x: i * lw, y: SANDBAG_ZONE_H, w: lw, h: H - SANDBAG_ZONE_H, label: 'TAP', active: touchTaps.has(i) });
        T.drawTouchZones(ctx, zones);
      }
    }

    function finish(skipped) {
      cleanup();
      if (skipped) { opts.onDone && opts.onDone({ coins: 0, score: 0, awards: [], skipped: true, heat: 0, forcedDescents: 0, swaps: [], from: opts.from, to: opts.to }); return; }
      T.markDone(save, 'sb');
      opts.onDone && opts.onDone({ coins: st.coins, score: st.score, awards: st.wonAwards.slice(), heat: st.heat, forcedDescents: st.forcedDescents, swaps: deck.history.slice(), from: opts.from, to: opts.to });
    }
    function cleanup() {
      cancelAnimationFrame(raf);
      intro.cleanup();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }

    raf = requestAnimationFrame(loop);
    // _debug: test-page / Playwright hook only (state, seats, swap deck, force a swap).
    return { cleanup, _debug: { st, seats, deck, swap, fireSwap: () => deck.fire(), running: () => running } };
  }

  window.SmokeBalloon = { start, needsPlay: (save) => T.needsPlay(save, 'sb') };
})();
