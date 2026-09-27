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

    const world = typeof opts.world === 'string' ? opts.world : 'beach';
    // Economy (Hotbox Highway rules): gas is paid up front; a clean landing pays LAND_BONUS, coins
    // are worth COIN_VAL each, every bird hit / pelican grab spills coins, a dunk forfeits the bonus.
    const GAS = T.gasCost(world), COIN_VAL = 2, LAND_BONUS = GAS + 2, DRY_BONUS = 3;
    const GULL_COST = 2, PELICAN_COST = 3;
    let gas = 0, flashT = 0, tSec = 0, hintT = 6, lastPct = 0;
    const msg = T.makeMessages();
    let seed = T.newSeed(), R = T.rng(seed), weather = T.makeWeather(seed, world);
    function reseed(sd) { seed = sd; R = T.rng(sd); weather = T.makeWeather(sd, world); st.updrafts = []; st.gusts = []; st.gulls = []; st.pelicans = []; st.coinsArr = []; seedWorld(); }
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
      if (payload && (payload.type === 'swap' || payload.type === 'swapWarn')) { if (!isHost) deck.handle(payload); return; }
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
    }, () => { running = true; gas = T.payGas(save, world); }, () => finish(true));
    const results = T.makeResultsScreen();

    let last = performance.now(), raf = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.textBaseline = 'alphabetic';
      drawSky();
      if (!running) { intro.draw(); return; }
      if (st.ended) {
        draw();
        ctx.textBaseline = 'alphabetic'; // hud helpers leave 'top' set
        results.draw(ctx, { canvas, title: st.dunked ? 'DUNKED!' : 'LANDED SAFE!', coins: st.coins, score: st.score, awards: st.wonAwards, gas });
        if (results.dismissed()) finish();
        return;
      }
      tSec += dt; hintT -= dt; flashT = Math.max(0, flashT - dt);
      msg.tick(dt * 1000);
      const wxName = weather.changed(pct());
      if (wxName) msg.say(wxName, weatherHint(), '#a0e8ff', 3);
      if (swap.tick(dt * 1000)) { st.dist += 15 * dt; draw(); drawHud(); swap.draw(ctx); return; }
      if (isHost || !net) step(dt);
      draw();
      drawHud();
      swap.draw(ctx); // countdown pill while a swap warning is pending (gameplay keeps running)
      if (isHost && net) {
        st._bT = (st._bT || 0) + dt;
        if (st._bT > 0.1) { st._bT = 0; net.send(snapshot()); }
      } else if (net) sendInput({ type: 'input', dive: diving(), lean: leanInput(), free: freeing() });
    }

    function pct() { return Math.max(0, Math.min(1, st.dist / st.finishDist)); }
    function weatherHint() {
      const w = weather.at(pct());
      if (w.k === 'rain' || w.k === 'storm') return 'PAPER SOAKS UP - STAY HIGH';
      if (w.k === 'fog') return 'CAN\'T SEE FAR AHEAD';
      if (w.k === 'snow') return 'HEAVY FLAKES - STAY HIGH';
      return '';
    }
    function spill(n, why) {
      const lost = Math.min(st.coins, n); st.coins -= lost; flashT = 0.6;
      msg.say(why, lost ? '-' + lost + ' COINS' : '', '#ff6b6b', 1.4);
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
      // weather: wind is a gentle tail/headwind + slight push down; rain/snow slowly soaks the paper
      const w = weather.at(pct());
      st.vx = Math.max(30, Math.min(160, st.vx + w.wind * 6 * dt));
      st.vy += Math.abs(w.wind) * 4 * dt;
      if (st.y > 45) st.wet = Math.min(1, st.wet + dt * 0.12 * (w.wet + w.snow * 0.7));
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

      for (const g of st.gulls) if (!g.hit && Math.abs(g.p - st.dist) < 8 && Math.abs(g.y - st.y) < 8) { g.hit = true; st.vy += 30; st.hits = (st.hits || 0) + 1; T.noise(0.1, 0.15); spill(GULL_COST, 'GULL HIT!'); }
      for (const p of st.pelicans) if (!p.hit && !st.caught && Math.abs(p.p - st.dist) < 8 && Math.abs(p.y - st.y) < 10) { p.hit = true; st.caught = { t: 0 }; st.hits = (st.hits || 0) + 1; T.tone(180, 0.3, 'square', 0.2); spill(PELICAN_COST, 'PELICAN GRAB!'); msg.say('PELICAN GRAB!', 'MASH E / CLICK TO BREAK FREE', '#ff6b6b', 2); }
      if (st.caught) { st.caught.t += dt; st.y -= 10 * dt; if (anyFreeing()) st.caught.freeT = (st.caught.freeT || 0) + dt; if ((st.caught.freeT || 0) > 0.6 || st.caught.t > 2.5) st.caught = null; }

      for (const c of st.coinsArr) if (!c.got && Math.abs(c.p - st.dist) < 8 && Math.abs(c.y - st.y) < 10) { c.got = true; st.coins += COIN_VAL; st.flashGood = 0.3; T.tone(900, 0.06, 'square', 0.08); }

      st.score = Math.floor(st.dist);
      nextSwapAt -= dt * 60;
      // fire() starts a 5s countdown (returns null if one is already pending); the event lands after it
      if (nextSwapAt <= 0 && !swap.warning && !swap.active && st.dist > 400 && st.dist < st.finishDist - 600) {
        if (deck.fire()) nextSwapAt = 99999;
      }
      if (st.dist >= st.finishDist) endRun(false);
    }

    function crash() { endRun(true); }
    function endRun(dunked) {
      st.dunked = dunked; st.ended = true;
      st.wonAwards = [];
      if (dunked) { st.coins = Math.floor(st.coins / 2); st.wonAwards.push('DUNKED - half your coins sank'); }
      else {
        st.coins += LAND_BONUS; st.wonAwards.push('LANDING FEE +' + LAND_BONUS);
        if (st.wet < 0.2) { st.coins += DRY_BONUS; st.wonAwards.push('BONE DRY +' + DRY_BONUS); }
        if (!st.hits) st.wonAwards.push('NO BIRD STRIKES');
      }
      st.score += st.coins * 2;
      if (net && isHost) net.send({ type: 'end', dunked, coins: st.coins, score: st.score, awards: st.wonAwards, state: snapshot() });
    }

    function drawSky() {
      const sk = weather.sky(pct());
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, sk[0]); g.addColorStop(0.75, sk[1]); g.addColorStop(1, '#1a6fae');
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
      // sea at the bottom (touch it = dunked): always visible so the danger line is clear
      ctx.fillStyle = 'rgba(0,70,150,0.55)'; ctx.fillRect(0, H - 8, W, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 12; i++) ctx.fillRect(((i * 30 - st.dist * 0.8) % W + W) % W, H - 8, 6, 1);
      if (st.y > 150) { ctx.fillStyle = 'rgba(0,80,160,0.25)'; ctx.fillRect(0, 150, W, H - 150); }
      weather.drawOverlay(ctx, pct(), tSec, { horizon: 40 });
    }

    function drawHud() {
      T.hudProgress(ctx, pct());
      if (flashT > 0 && Math.floor(flashT * 10) % 2) { ctx.fillStyle = 'rgba(255,60,60,0.35)'; ctx.fillRect(0, 6, 90, 24); }
      if (st.flashGood > 0) { st.flashGood -= 1 / 60; ctx.fillStyle = 'rgba(255,230,80,0.3)'; ctx.fillRect(0, 6, 40, 14); }
      T.hudCoins(ctx, st.coins, gas);
      // bottom-right: wetness meter (droplet icon + bar)
      const bx = W - 46, by = H - (T.isTouchDevice ? 38 : 20);
      ctx.fillStyle = 'rgba(20,12,30,0.7)'; ctx.fillRect(bx - 10, by - 2, 52, 10);
      ctx.fillStyle = '#6ab8ff'; ctx.fillRect(bx - 7, by + 2, 4, 4); ctx.fillRect(bx - 6, by, 2, 2);
      ctx.fillStyle = '#333'; ctx.fillRect(bx, by + 1, 38, 5);
      ctx.fillStyle = st.wet > 0.6 ? '#4a7aff' : '#a0d8ff'; ctx.fillRect(bx, by + 1, Math.round(38 * st.wet), 5);
      // bottom-left: my role tag in crew mode
      if (!soloMode) {
        const mine = seats.find(x => T.seatIsMine(x, net)) || seats[0];
        T.hudText(ctx, mine.role === 'pilot' ? 'PILOT' : 'WING', 4, by - 1, '#ffe98a', 1);
      }
      if (hintT > 0 && !msg.busy && !swap.warning) {
        msg.say(soloMode || (seats[0] && T.seatIsMine(seats[0], net)) ? 'HOLD = DIVE' : 'A/D = LEAN',
          soloMode ? 'LET GO = CLIMB. AVOID THE SEA' : 'GRAB COINS, DON\'T ALL LEAN SAME WAY', '#fff', Math.max(0.3, hintT), true);
      }
      if (!swap.warning && !swap.active) msg.draw(ctx, 24);
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
    return { cleanup, _debug: { st, seats, deck, swap, fireSwap: () => deck.fire(), running: () => running, weather: () => weather, gas: () => gas, msg } };
  }

  window.PaperPlane = { start, needsPlay: (save) => T.needsPlay(save, 'pp') };
})();
