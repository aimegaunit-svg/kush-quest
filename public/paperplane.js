// paperplane.js — "PAPER PLANE" transit mini-game (Beach -> Suburbia). Brief v1.1 Part B3, 3.2.
// Side-on, auto-scrolls right. Tiny-Wings-style one-button glide: hold to DIVE (gain speed,
// lose height), release to PULL UP (trade speed for height). No engine. Updraft zones + wind
// gusts. "Wet paper": spray/rain makes the plane heavier (sags); sun/warm zones dry it out.
// Crew: pilot holds/releases dive. Extra crew are wing-walkers who lean left/right (small pitch
// nudge) and grab coins; leaning the same way as everyone else tips the plane.
//
// Contract: window.PaperPlane.start({ from, to, world, crew, save, net, onDone, mount, scale })
// Save field: save.seenPaperPlane (bool)
// onDone({ coins, score, awards, tips, dunked })

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
    const net = netRaw ? T.makeNet(netRaw, 'pp') : null;
    const isHost = !net || net.isHost;

    const seats = T.assignSeats(opts.crew || 1, ['pilot', 'wing1', 'wing2', 'wing3']);
    const soloMode = seats.length === 1;

    const st = {
      x: 0, y: H * 0.5, vx: 60, vy: 0, wet: 0, lean: 0,
      dist: 0, finishDist: 2600, coins: 0, score: 0, tips: 0, dunked: false,
      ended: false, wonAwards: [], shakeT: 0,
      updrafts: [], gusts: [], gulls: [], pelicans: [], coinsArr: [], caught: null
    };

    let seed = T.newSeed(), R = T.rng(seed);
    function reseed(sd) { seed = sd; R = T.rng(sd); st.updrafts = []; st.gusts = []; st.gulls = []; st.pelicans = []; st.coinsArr = []; seedWorld(); }
    function seedWorld() {
      let p = 200;
      while (p < st.finishDist - 150) {
        const roll = R();
        if (roll < 0.3) st.updrafts.push({ p, y: 40 + R() * 100, w: 60 });
        else if (roll < 0.5) st.gusts.push({ p, dir: R() < 0.5 ? 1 : -1, w: 50 });
        else if (roll < 0.7) st.gulls.push({ p, y: 30 + R() * 120 });
        else if (roll < 0.82) st.pelicans.push({ p, y: 40 + R() * 100 });
        else st.coinsArr.push({ p, y: 30 + R() * 130, got: false });
        p += 90 + R() * 120;
      }
    }
    seedWorld();

    const keys = new Set();
    let mouseDown = false;
    function onKeyDown(e) { keys.add(e.key.toLowerCase()); }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    function onMouseDown() { mouseDown = true; }
    function onMouseUp() { mouseDown = false; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    // touch: holding anywhere on the canvas dives; where you hold (left/mid/right third)
    // also leans the plane, so one thumb both dives and steers.
    let touchLean = 0;
    function touchXOf(e) { const t = e.touches[0] || e.changedTouches[0]; if (!t) return null; const r = canvas.getBoundingClientRect(); return (t.clientX - r.left) * (W / r.width); }
    canvas.addEventListener('touchstart', (e) => { mouseDown = true; const x = touchXOf(e); touchLean = x == null ? 0 : (x < W / 3 ? -1 : x > W * 2 / 3 ? 1 : 0); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { const x = touchXOf(e); touchLean = x == null ? 0 : (x < W / 3 ? -1 : x > W * 2 / 3 ? 1 : 0); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', (e) => { mouseDown = false; touchLean = 0; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchcancel', (e) => { mouseDown = false; touchLean = 0; e.preventDefault(); }, { passive: false });

    function diving() { return keys.has(' ') || keys.has('arrowdown') || mouseDown; }
    function leanInput() {
      let l = touchLean;
      if (keys.has('a') || keys.has('arrowleft')) l -= 1;
      if (keys.has('d') || keys.has('arrowright')) l += 1;
      return Math.max(-1, Math.min(1, l));
    }

    const remoteInputs = new Map();
    if (net) net._deliver = (fromId, payload) => {
      if (intro.handle(fromId, payload)) return;
      if (payload && payload.type === 'swap') { if (!isHost) deck.handle(payload); return; }
      if (payload && payload.type === 'input') remoteInputs.set(fromId, payload);
      if (payload && payload.type === 'state' && !isHost) applyRemoteState(payload);
      if (payload && payload.type === 'end' && !isHost) applyEnd(payload);
    };
    const sendInput = T.inputSender(net);
    function freeing() { return keys.has('e') || mouseDown; }
    // any crewmate can tap to free a pelican-grabbed plane
    function anyFreeing() {
      if (freeing()) return true;
      for (const v of remoteInputs.values()) if (v.free) return true;
      return false;
    }

    function combinedLean() {
      if (soloMode) return 0;
      let total = 0;
      seats.forEach((s, idx) => {
        if (idx === 0) return; // pilot doesn't lean
        const mine = (!net) || (s.player && s.player.id === net.id);
        const input = mine ? { lean: leanInput() } : (remoteInputs.get(s.player && s.player.id) || {});
        total += input.lean || 0;
      });
      return Math.max(-3, Math.min(3, total));
    }
    function pilotDive() {
      const idx0 = seats[0];
      const mine = (!net) || (idx0.player && idx0.player.id === net.id);
      if (soloMode || mine) return diving();
      const input = remoteInputs.get(idx0.player && idx0.player.id) || {};
      return !!input.dive;
    }

    const swap = T.makeSwapRunner();
    let nextSwapAt = 900 + Math.random() * 700;
    const deck = T.makeSwapDeck([
      { id: 'gust', banner: 'GUST!', reseat: 'rotate', sfx: [220, 'sawtooth'],
        fx: () => { st.vx = Math.min(160, st.vx + 30); st.vy -= 30; } },
      { id: 'roll', banner: 'BARREL ROLL!', reseat: 'reverse', sfx: [330, 'triangle'],
        fx: () => { st.vy = 45; st.shakeT = 0.5; } },
      { id: 'pelican', banner: 'PELICAN SNATCH!', reseat: 'shuffle', sfx: [160, 'square'],
        fx: () => { st.pelicans.push({ p: st.dist + 110, y: st.y }); } },
      { id: 'soggy', banner: 'SOGGY PAPER!', reseat: 'swap01', sfx: [110, 'sine'],
        fx: () => { st.wet = Math.min(1, st.wet + 0.4); } },
      { id: 'thermal', banner: 'THERMAL!', reseat: 'rotate2', sfx: [620, 'sine'],
        fx: () => { st.updrafts.push({ p: st.dist + 90, y: st.y, w: 70 }); st.wet = Math.max(0, st.wet - 0.3); } }
    ], { seats, runner: swap, net, onDone: () => { nextSwapAt = 700 + Math.random() * 600; } });

    let running = false;
    const intro = T.makeStartGate(ctx, {
      save, gameKey: 'pp', seenKey: 'seenPaperPlane', canvas, net, seed, onSeed: reseed, title: 'PAPER PLANE',
      lines: soloMode
        ? ['Hold SPACE/click to DIVE (gain speed).', 'Release to PULL UP (gain height).', 'Ride updrafts, dodge gulls & pelicans!']
        : ['Pilot: hold to dive, release to climb.', 'Others: A/D to lean & grab coins —', "don't all lean the same way!"]
    }, () => { running = true; }, () => finish(true));
    const results = T.makeResultsScreen();

    let last = performance.now(), raf = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      drawSky();
      if (!running) { intro.draw(); return; }
      if (swap.tick(dt * 1000)) { st.dist += 15 * dt; draw(); swap.draw(ctx); drawHud(); return; }
      if (st.ended) {
        results.draw(ctx, { canvas, title: st.dunked ? 'DUNKED!' : 'LANDED SAFE!', coins: st.coins, score: st.score, awards: st.wonAwards });
        if (results.dismissed()) finish();
        return;
      }
      if (isHost || !net) step(dt);
      draw();
      drawHud();
      if (isHost && net) {
        st._bT = (st._bT || 0) + dt;
        if (st._bT > 0.1) { st._bT = 0; net.send(snapshot()); }
      } else if (net) sendInput({ type: 'input', dive: diving(), lean: leanInput(), free: freeing() });
    }

    function snapshot() {
      return { type: 'state', y: st.y, vy: st.vy, vx: st.vx, dist: st.dist, wet: st.wet, coins: st.coins, caught: !!st.caught,
        gl: T.flagIdx(st.gulls, 'hit'), pe: T.flagIdx(st.pelicans, 'hit'), co: T.flagIdx(st.coinsArr, 'got'),
        np: st.pelicans.length, nu: st.updrafts.length };
    }
    function applyRemoteState(p) {
      st.y = p.y; st.vy = p.vy; st.vx = p.vx; st.dist = p.dist; st.wet = p.wet; st.coins = p.coins;
      st.caught = p.caught ? (st.caught || { t: 0 }) : null;
      while (p.np && st.pelicans.length < p.np) st.pelicans.push({ p: st.dist + 110, y: st.y });
      while (p.nu && st.updrafts.length < p.nu) st.updrafts.push({ p: st.dist + 90, y: st.y, w: 70 });
      T.applyFlags(st.gulls, 'hit', p.gl); T.applyFlags(st.pelicans, 'hit', p.pe); T.applyFlags(st.coinsArr, 'got', p.co);
    }
    function applyEnd(p) {
      if (st.ended) return;
      applyRemoteState(p.state || {});
      st.dunked = !!p.dunked; st.coins = p.coins; st.score = p.score; st.wonAwards = p.awards || []; st.ended = true;
    }

    function step(dt) {
      const dive = pilotDive();
      const lean = combinedLean();
      const heavy = 1 + st.wet * 0.5;
      if (dive) { st.vy += 70 * dt; st.vx = Math.min(160, st.vx + 40 * dt); }
      else { st.vy -= 55 * dt / heavy; st.vx = Math.max(30, st.vx - 25 * dt); }
      st.vy += 20 * dt * heavy; // gravity
      st.y += st.vy * dt + lean * 6 * dt;
      st.dist += st.vx * dt;

      // wing-lean tip risk: all leaning same way for a while = wobble that costs a little speed
      if (Math.abs(lean) >= 2.5) { st.vx *= 0.995; st.shakeT = Math.max(st.shakeT, 0.08); }

      for (const u of st.updrafts) if (Math.abs(u.p - st.dist) < u.w && Math.abs(u.y - st.y) < 40) st.vy -= 40 * dt;
      for (const g of st.gusts) if (Math.abs(g.p - st.dist) < g.w) st.vx += g.dir * 20 * dt;

      // rain/spray strips near water level -> wet; sun dries
      if (st.y > 140) { st.wet = Math.min(1, st.wet + dt * 0.6); }
      else if (st.y < 60) { st.wet = Math.max(0, st.wet - dt * 0.4); }

      if (st.y < 5) st.y = 5;
      if (st.y > H - 8) { crash(); return; }

      for (const g of st.gulls) if (!g.hit && Math.abs(g.p - st.dist) < 8 && Math.abs(g.y - st.y) < 8) { g.hit = true; st.vy += 30; st.wonAwardsHit = true; T.noise(0.1, 0.15); }
      for (const p of st.pelicans) if (!p.hit && !st.caught && Math.abs(p.p - st.dist) < 8 && Math.abs(p.y - st.y) < 10) { p.hit = true; st.caught = { t: 0 }; T.tone(180, 0.3, 'square', 0.2); }
      if (st.caught) { st.caught.t += dt; st.y -= 10 * dt; if (anyFreeing()) st.caught.freeT = (st.caught.freeT || 0) + dt; if ((st.caught.freeT || 0) > 0.6 || st.caught.t > 2.5) st.caught = null; }

      for (const c of st.coinsArr) if (!c.got && Math.abs(c.p - st.dist) < 8 && Math.abs(c.y - st.y) < 10) { c.got = true; st.coins += 2; T.tone(900, 0.06, 'square', 0.08); }

      st.score = Math.floor(st.dist);
      nextSwapAt -= dt * 60;
      if (nextSwapAt <= 0 && st.dist > 400 && st.dist < st.finishDist - 300) {
        nextSwapAt = 99999;
        deck.fire();
      }
      if (st.dist >= st.finishDist) endRun(false);
    }

    function crash() { endRun(true); }
    function endRun(dunked) {
      st.dunked = dunked; st.ended = true;
      if (dunked) st.coins = Math.max(0, st.coins - 4);
      st.wonAwards = [];
      if (st.wet < 0.2) st.wonAwards.push('BONE DRY — stayed high & dry');
      if (st.coins >= 10) st.wonAwards.push('COIN GLIDER');
      st.score += st.coins * 2;
      if (net && isHost) net.send({ type: 'end', dunked, coins: st.coins, score: st.score, awards: st.wonAwards, state: snapshot() });
    }

    function drawSky() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#7fd0ff'); g.addColorStop(1, '#1a6fae');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 4; i++) { const x = ((i * 90 - st.dist * 0.3) % (W + 40) + W + 40) % (W + 40) - 20; ctx.fillRect(x, 20 + i * 15, 24, 6); }
    }

    function draw() {
      const sh = st.shakeT > 0 ? (Math.random() - 0.5) * 3 : 0;
      st.shakeT = Math.max(0, st.shakeT - 1 / 60);
      ctx.save(); ctx.translate(sh, 0);
      const sx = x => W * 0.4 + (x - st.dist);
      for (const u of st.updrafts) { const x = sx(u.p); if (x > -60 && x < W + 60) { ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x, u.y); ctx.stroke(); } }
      for (const g of st.gulls) if (!g.hit) { const x = sx(g.p); if (x > -20 && x < W + 20) { ctx.fillStyle = '#eee'; ctx.fillRect(x - 4, g.y - 2, 8, 4); } }
      for (const p of st.pelicans) if (!p.hit) { const x = sx(p.p); if (x > -20 && x < W + 20) { ctx.fillStyle = '#b8860b'; ctx.fillRect(x - 5, p.y - 3, 10, 6); } }
      for (const c of st.coinsArr) if (!c.got) { const x = sx(c.p); if (x > -20 && x < W + 20) { ctx.fillStyle = '#ff5'; ctx.beginPath(); ctx.arc(x, c.y, 3, 0, 7); ctx.fill(); } }
      // plane
      ctx.save(); ctx.translate(sx(st.dist), st.y);
      ctx.rotate(Math.max(-0.6, Math.min(0.6, st.vy / 150)));
      ctx.fillStyle = st.wet > 0.5 ? '#c9d8e6' : '#fff';
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, -6); ctx.lineTo(-4, 0); ctx.lineTo(-10, 6); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.restore();
      if (st.y > 150) { ctx.fillStyle = 'rgba(0,80,160,0.35)'; ctx.fillRect(0, 150, W, H - 150); }
    }

    function drawHud() {
      ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.textAlign = 'left';
      ctx.fillText('Progress ' + Math.min(100, Math.floor(100 * st.dist / st.finishDist)) + '%', 4, 10);
      ctx.fillText('Coins ' + st.coins, 4, 20);
      ctx.textAlign = 'right';
      ctx.fillStyle = st.wet > 0.6 ? '#88f' : '#ffd';
      ctx.fillText('Wet ' + Math.floor(st.wet * 100) + '%', W - 4, 10);
      if (st.caught) { ctx.fillStyle = '#f55'; ctx.textAlign = 'center'; ctx.fillText('CAUGHT! tap E/click to free', W / 2, H - 20); }
      if (T.isTouchDevice) T.drawTouchZones(ctx, [
        { x: 0, y: H - 26, w: W / 3, h: 26, label: '◀ LEAN', active: touchLean < 0 },
        { x: W / 3, y: H - 26, w: W / 3, h: 26, label: 'HOLD=DIVE', active: mouseDown && touchLean === 0 },
        { x: W * 2 / 3, y: H - 26, w: W / 3, h: 26, label: 'LEAN ▶', active: touchLean > 0 },
      ]);
    }

    function finish(skipped) {
      cleanup();
      if (skipped) { opts.onDone && opts.onDone({ coins: 0, score: 0, awards: [], skipped: true, tips: 0, dunked: false, swaps: [], from: opts.from, to: opts.to }); return; }
      T.markDone(save, 'pp');
      opts.onDone && opts.onDone({ coins: st.coins, score: st.score, awards: st.wonAwards.slice(), tips: st.tips, dunked: st.dunked, swaps: deck.history.slice(), from: opts.from, to: opts.to });
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

  window.PaperPlane = { start, needsPlay: (save) => T.needsPlay(save, 'pp') };
})();
