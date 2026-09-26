// drive.js — "HOTBOX HIGHWAY" transit mini-game. Brief v1.0 Part 1 (mechanics), placement per
// brief v1.1 Part B2 (once per world, right after that world's mini-boss).
// A short, chaotic co-op driving mini-game: a pseudo-3D road (OutRun-style segments, curve +
// simple horizon projection), a DRIVER seat plus up to 3 HAVOC window seats that throw snacks at
// cops, grab coins, and can TAKE A HIT to push the crew's baked steering tiers. One mid-drive
// seat swap (via Transit's swap-event system) rotates everyone one seat. Built on top of
// transit.js the same way the 5 other transit mini-games are, so it shares seat scaling, the
// swap-event framework, the results screen, and the online relay envelope.
//
// Contract: window.Drive.start({ from, to, world, cooked, crew, save, net, onDone, mount, scale })
//   world: 'park'|'beach'|'suburb'|'city'|'woods'|'hq' - picks the road theme.
//   cooked: the crew's average Cooked % carried in from the level just finished (0-100).
//   crew: int 1-4 or array of {id,name,color} in join order.
//   save: host save object. Fields read/written: save.lastRide ('van'|'shitbox'),
//         save.shitboxSeen (bool), save.drives ({'0-1':true,...}), save.drivesDone (int),
//         save.vanUp ({tires,engine,stash} levels, read only - GARAGE tab not built yet),
//         save.vanPaint (read only, cosmetic).
//   onDone({ coins, cooked, snacksLeft, munchies, buff, score, awards, heatCaught, route })
// Drive.needsDrive(save, fromIdx, toIdx, isShopOrFarm) -> 'drive' | 'ask' | 'none'
//   First trip between two stops is always a drive; after that it's 'ask' (host decides online);
//   the Head Shop and the Farm never need a drive (isShopOrFarm=true forces 'none').

(function () {
  'use strict';
  const T = window.Transit;
  const W = T.BASE_W, H = T.BASE_H, HORIZON = 70;

  function driveKey(fromIdx, toIdx) { return Math.min(fromIdx, toIdx) + '-' + Math.max(fromIdx, toIdx); }
  function needsDrive(save, fromIdx, toIdx, isShopOrFarm) {
    if (isShopOrFarm) return 'none';
    const drives = (save && save.drives) || {};
    return drives[driveKey(fromIdx, toIdx)] ? 'ask' : 'drive';
  }

  const ROAD_THEME = {
    park: { sky: '#8fd0ff', grass: '#3a9a4a', grass2: '#2f7d3c', road: '#4a4a52', line: '#f0f0d0' },
    beach: { sky: '#9adfff', grass: '#e8d38a', grass2: '#d9c070', road: '#585858', line: '#ffffff' },
    suburb: { sky: '#a8c8ff', grass: '#6ab04c', grass2: '#559140', road: '#4a4a52', line: '#f0f0d0' },
    city: { sky: '#1c2038', grass: '#2a2e42', grass2: '#22263a', road: '#333340', line: '#ffd84a' },
    woods: { sky: '#4a5a3a', grass: '#1f3a20', grass2: '#173016', road: '#3a3a38', line: '#c8c890' },
    hq: { sky: '#20242e', grass: '#3a3e4a', grass2: '#30333e', road: '#2a2a32', line: '#ff5a6a' },
  };

  const SWAP_EVENTS = [
    'THE POTHOLE!', 'THE SPEED BUMP!', 'THE COUGHING FIT!', "THE DROPPED JOINT!",
    'THE MUNCHIE EMERGENCY!', 'THE ZONE-OUT!', 'THE LOST LIGHTER!', 'THE PHONE CALL!',
  ];
  const SHITBOX_EVENTS = ['THE BACKFIRE BLAST!', 'THE CHECK ENGINE LIGHT!', 'THE DOOR FALLS OFF!'];

  function start(opts) {
    opts = opts || {};
    const save = opts.save || {};
    const scale = opts.scale || 3;
    const { canvas, ctx } = T.makeCanvas(opts.mount, scale);
    canvas.focus();

    const netRaw = opts.net || null;
    const net = netRaw ? T.makeNet(netRaw, 'dr') : null;
    const isHost = !net || net.isHost;

    const seats = T.assignSeats(opts.crew || 1, ['driver', 'right', 'rear', 'left']);
    const soloMode = seats.length === 1;
    const theme = ROAD_THEME[opts.world] || ROAD_THEME.park;

    // ---- ride pick (van vs shitbox) ----
    const st = {
      phase: 'pick', ride: save.lastRide || 'van',
      voteT: 0, votes: {},
      x: 0, curve: 0, curveTarget: 0, dist: 0, len: 4200, speed: 0, maxSpeed: 190,
      heat: 0, cops: [], snacks: 30, coins: 0, cookedAvg: opts.cooked || 0,
      route: null, forkAt: 1000, forked: false,
      swapDone: false, ended: false, caughtCount: 0,
      driverSeatIdx: 0, hitCd: 0, dmg: 0,
    };
    const swapPool = T.makeSwapPool(st.ride === 'shitbox' ? SWAP_EVENTS.concat(SHITBOX_EVENTS) : SWAP_EVENTS);
    const swapRunner = T.makeSwapRunner();
    const results = T.makeResultsScreen();

    function bakedTier() {
      const c = st.cookedAvg;
      if (c >= 100) return 3; if (c >= 90) return 2; if (c >= 40) return 1; return 0;
    }
    function coinMul() { return [1, 1.5, 2, 3][bakedTier()]; }

    // ---- input ----
    const keys = new Set();
    function onKeyDown(e) { keys.add(e.key.toLowerCase()); if (e.key === ' ') e.preventDefault(); }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    let mouse = { x: W / 2, y: H / 2, down: false };
    canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) / r.width * W; mouse.y = (e.clientY - r.top) / r.height * H; });
    canvas.addEventListener('mousedown', () => { mouse.down = true; });
    canvas.addEventListener('mouseup', () => { mouse.down = false; });

    // ---- touch controls (phone/tablet) ----
    const touch = { left: false, right: false, boost: false, brake: false, throw: false, hit: false };
    let isTouch = false;
    function bindTouchZone(el) {
      el.addEventListener('touchstart', onTouch, { passive: false });
      el.addEventListener('touchmove', onTouch, { passive: false });
      el.addEventListener('touchend', onTouchEnd, { passive: false });
    }
    function zoneAt(x, y) {
      // Bottom strip split into zones: left 25% steer-left, next 25% steer-right,
      // right 25% boost/throw, far right 25% brake/take-a-hit. Driver vs havoc differ in labels
      // but we keep the touch layout simple and consistent.
      if (y < H * 0.55) return null;
      const f = x / W;
      if (f < 0.25) return 'left'; if (f < 0.5) return 'right';
      if (f < 0.75) return 'boost'; return 'brake';
    }
    function onTouch(e) {
      e.preventDefault(); isTouch = true;
      touch.left = touch.right = touch.boost = touch.brake = false;
      const r = canvas.getBoundingClientRect();
      for (const t of e.touches) {
        const x = (t.clientX - r.left) / r.width * W, y = (t.clientY - r.top) / r.height * H;
        const z = zoneAt(x, y); if (z) touch[z] = true;
      }
    }
    function onTouchEnd(e) { e.preventDefault(); if (e.touches.length === 0) { touch.left = touch.right = touch.boost = touch.brake = false; } }
    bindTouchZone(canvas);

    function myInputs() {
      const left = keys.has('a') || keys.has('arrowleft') || touch.left;
      const right = keys.has('d') || keys.has('arrowright') || touch.right;
      const boost = keys.has('w') || keys.has('arrowup') || keys.has(' ') || touch.boost;
      const brake = keys.has('s') || keys.has('arrowdown') || touch.brake;
      const throwK = keys.has('j') || mouse.down;
      const hit = keys.has('h');
      return { left, right, boost, brake, throwK, hit };
    }

    // ---- cops ----
    function spawnCop() {
      const kinds = ['cruiser', 'moto', 'suv'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      st.cops.push({ kind, hp: kind === 'suv' ? 5 : kind === 'moto' ? 1 : 2, d: st.dist + 260 + Math.random() * 200, side: Math.random() < 0.5 ? -1 : 1, stage: 'tail', lockT: 0 });
    }
    let copTimer = 90;

    function driverSeat() { return seats[st.driverSeatIdx % seats.length]; }
    function amDriver() { return !net ? true : (net.isHost && driverSeat().seat === 0) || (net.id === (driverSeat().player && driverSeat().player.id)); }

    function pickResolve() {
      st.phase = 'drive'; save.lastRide = st.ride; if (st.ride === 'shitbox') save.shitboxSeen = true;
      try { if (typeof save.__persist === 'function') save.__persist(); } catch (e) {}
    }

    // ---- ride pick screen ----
    function updatePick(dt) {
      if (soloMode || !net) { if (keys.has('enter') || keys.has(' ') || mouse.down || touch.boost) pickResolve(); return; }
      st.voteT += dt;
      if (net.isHost && st.voteT > 5000) { const v = tallyVotes(); st.ride = v; pickResolve(); }
    }
    function tallyVotes() {
      const counts = { van: 0, shitbox: 0 };
      for (const v of Object.values(st.votes)) counts[v] = (counts[v] || 0) + 1;
      return counts.shitbox > counts.van ? 'shitbox' : 'van'; // tie or no votes -> van
    }
    function drawPick() {
      ctx.fillStyle = '#1a1026'; ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffe98a'; ctx.font = 'bold 13px monospace';
      ctx.fillText('PICK YOUR RIDE', W / 2, 20);
      ctx.font = '9px monospace'; ctx.fillStyle = '#fff';
      ctx.fillText('1: THE HOTBOX (steady)', W / 2, 70);
      ctx.fillText('2: TAYLOR\'S SHITBOX (fast, twitchy, backfires)', W / 2, 100);
      ctx.font = '8px monospace'; ctx.fillStyle = '#9fff9f';
      ctx.fillText(soloMode || !net ? 'PRESS SPACE TO START' : 'VOTE: 1 or 2 - ' + Math.max(0, Math.ceil((5000 - st.voteT) / 1000)) + 's', W / 2, H - 12);
      if (keys.has('1')) st.ride = 'van'; if (keys.has('2')) st.ride = 'shitbox';
      if (net && !net.isHost) { /* vote sent below */ }
    }

    // ---- drive sim (runs on the current driver's client; others get snapshots) ----
    function simTick(dt) {
      const dts = dt / 1000;
      const tier = bakedTier();
      const wobble = tier >= 1 ? Math.sin(st.dist / 40) * (tier * 0.4) : 0;
      const inp = myInputs();
      const shitbox = st.ride === 'shitbox';
      const steerRate = (shitbox ? 130 : 95) * dts;
      if (inp.left) st.x -= steerRate * (1 + tier * 0.15);
      if (inp.right) st.x += steerRate * (1 + tier * 0.15);
      st.x += wobble * dts * 20;
      st.x = Math.max(-1, Math.min(1, st.x));
      const accel = inp.boost ? 140 : 60, brakeA = inp.brake ? 160 : 40;
      st.speed += (inp.boost ? accel : -brakeA) * dts;
      st.speed = Math.max(30, Math.min(shitbox ? st.maxSpeed * 1.15 : st.maxSpeed, st.speed));
      st.dist += st.speed * dts;
      // curve: gentle seeded sine bends + the fork
      st.curveTarget = Math.sin(st.dist / 900) * 0.9 + Math.sin(st.dist / 260) * 0.2;
      if (st.forked === 'fast') st.curveTarget += 0.3; else if (st.forked === 'scenic') st.curveTarget -= 0.3;
      st.curve += (st.curveTarget - st.curve) * Math.min(1, dts * 2);
      if (!st.forked && st.dist > st.forkAt) { st.forked = st.x > 0.15 ? 'fast' : st.x < -0.15 ? 'scenic' : 'fast'; }
      // heat from speeding + hits
      if (st.speed > st.maxSpeed * 0.85) st.heat += 4 * dts;
      st.heat = Math.max(0, st.heat - (inp.hit ? 0 : 0.6 * dts));
      // TAKE A HIT
      st.hitCd -= dt; if (inp.hit && st.hitCd <= 0) { st.hitCd = 8000; st.cookedAvg = Math.min(100, st.cookedAvg + 10); T.tone(180, 0.3, 'sawtooth', 0.1); }
      // cops
      copTimer -= dts; if (copTimer <= 0) { copTimer = 4 + Math.random() * 4; spawnCop(); }
      for (const c of st.cops) {
        const gap = c.d - st.dist;
        if (c.stage === 'tail' && gap < 90) c.stage = 'along';
        else if (c.stage === 'along' && gap < 20) { c.stage = 'ram'; c.lockT = 5000; }
        if (c.stage === 'ram') {
          c.lockT -= dt;
          if (inp.throwK && Math.random() < 0.4) { c.hp--; T.noise(0.1, 0.08); if (c.hp <= 0) { c.dead = true; st.coins += 3; } }
          if (c.lockT <= 0 && !c.dead) { st.caughtCount++; st.coins = Math.max(0, st.coins - 10 * seats.length); st.heat = 50; c.dead = true; T.tone(90, 0.4, 'square', 0.15); }
        }
      }
      st.cops = st.cops.filter(c => !c.dead && c.d - st.dist > -40);
      // coins/snacks along the road
      if (frameN % 30 === 0) { st.coins += Math.round(1 * coinMul()); }
      if (st.dist >= st.len && !st.ended) finish();
    }

    let frameN = 0;
    function finish() {
      st.ended = true; st.phase = 'results';
      const key = driveKey(opts.from, opts.to);
      save.drives = save.drives || {}; save.drives[key] = true;
      save.drivesDone = (save.drivesDone || 0) + 1;
      const awards = [];
      if (st.caughtCount === 0) awards.push('SMOOTHEST DRIVER');
      if (st.coins > 60) awards.push('COIN GOBLIN');
      if (st.ride === 'shitbox') awards.push('TAYLOR WOULD BE PROUD');
      try { if (typeof save.__persist === 'function') save.__persist(); } catch (e) {}
      st._final = {
        coins: st.coins, cooked: Math.round(st.cookedAvg), snacksLeft: st.snacks, score: Math.round(st.dist),
        awards, heatCaught: st.caughtCount, route: st.forked || 'fast',
        munchies: Math.min(2, Math.floor((30 - st.snacks) / 5)),
        buff: st.cookedAvg >= 80 ? 'cooked10' : (awards.includes('COIN GOBLIN') ? 'soda10' : null),
      };
    }

    // ---- mid-drive seat swap (once, 40-60% through) ----
    function maybeTriggerSwap() {
      if (st.swapDone || st.dist < st.len * 0.4 || st.dist > st.len * 0.6) return;
      st.swapDone = true;
      const banner = swapPool.next();
      swapRunner.trigger(banner, {
        onReseat() {
          if (soloMode) return; // solo: no seat change, just the scramble visual (handled by wobble below)
          st.driverSeatIdx = (st.driverSeatIdx + 1) % seats.length;
          T.tone(520, 0.2, 'triangle', 0.1);
        },
      });
      T.tone(300, 0.3, 'square', 0.12);
    }

    // ---- render ----
    function projectX(baseX, depth) { return baseX + st.curve * depth * depth * 40; }
    function drawRoad() {
      ctx.fillStyle = theme.sky; ctx.fillRect(0, 0, W, HORIZON);
      for (let y = HORIZON; y < H; y++) {
        const depth = (y - HORIZON) / (H - HORIZON);
        const roadW = 20 + depth * (W * 0.9);
        const cx = W / 2 + st.x * (W * 0.35) * depth + st.curve * depth * depth * 30;
        const grassCol = Math.floor(y / 4) % 2 === 0 ? theme.grass : theme.grass2;
        ctx.fillStyle = grassCol; ctx.fillRect(0, y, W, 1);
        ctx.fillStyle = theme.road; ctx.fillRect(cx - roadW / 2, y, roadW, 1);
        if (Math.floor((y + Math.floor(st.dist / 2)) / 6) % 2 === 0) { ctx.fillStyle = theme.line; ctx.fillRect(cx - 1.5, y, 2, 1); ctx.fillRect(cx + roadW / 2 - 4, y, 2, 1); ctx.fillRect(cx - roadW / 2 + 2, y, 2, 1); }
      }
    }
    function drawHud() {
      ctx.textAlign = 'left'; ctx.font = '8px monospace'; ctx.fillStyle = '#fff';
      ctx.fillText('DIST ' + Math.round(st.dist) + '/' + st.len, 4, 10);
      ctx.fillText('HEAT', 4, 20); ctx.strokeStyle = '#fff'; ctx.strokeRect(28, 14, 40, 6);
      ctx.fillStyle = st.heat > 40 ? '#ff5a5a' : '#ffd84a'; ctx.fillRect(28, 14, Math.min(40, st.heat * 0.4), 6);
      ctx.fillStyle = '#c8ffa0'; ctx.textAlign = 'right'; ctx.fillText('COINS ' + st.coins, W - 4, 10);
      ctx.fillText('COOKED ' + Math.round(st.cookedAvg) + '%', W - 4, 20);
      const tierLabel = ['NORMAL', 'LAGGY', 'BAKED', 'ASTRAL'][bakedTier()];
      ctx.fillStyle = '#e4b3ff'; ctx.fillText(tierLabel, W - 4, 30);
      if (st.cops.some(c => c.stage === 'ram')) { ctx.textAlign = 'center'; ctx.fillStyle = '#ff5a6a'; ctx.font = 'bold 9px monospace'; ctx.fillText('LOCKED ON!', W / 2, HORIZON - 4); }
      ctx.textAlign = 'center'; ctx.fillStyle = '#9fff9f'; ctx.font = '7px monospace';
      ctx.fillText('A/D steer  W boost  S brake  J throw  H take a hit', W / 2, H - 4);
    }
    let cardDone = false;
    const intro = T.showInstructionCard(ctx, {
      save, seenKey: 'seenHighway', canvas,
      title: 'HOTBOX HIGHWAY',
      lines: ['A/D or arrows steer, W/Space boost, S brakes.', 'J or click throws snacks at cops alongside you.', 'H takes a hit: +Cooked, but steering gets looser.', 'Stay under the Heat meter or you get LOCKED ON!'],
    }, () => { cardDone = true; });

    // ---- loop ----
    let rafId = 0, last = performance.now();
    function loop(now) {
      const dt = Math.min(50, now - last); last = now; frameN++;
      ctx.clearRect(0, 0, W, H);
      if (!cardDone) { intro.draw(); rafId = requestAnimationFrame(loop); return; }
      if (st.phase === 'pick') { updatePick(dt); drawPick(); rafId = requestAnimationFrame(loop); return; }
      if (st.phase === 'drive') {
        if (swapRunner.tick(dt)) { drawRoad(); swapRunner.draw(ctx); rafId = requestAnimationFrame(loop); return; }
        if (amDriver()) { simTick(dt); maybeTriggerSwap(); if (net) net.send({ type: 'state', st: { x: st.x, curve: st.curve, dist: st.dist, speed: st.speed, heat: st.heat, coins: st.coins, cookedAvg: st.cookedAvg }, t: Date.now() }); }
        drawRoad(); drawHud();
        if (st.ended) st.phase = 'results';
        rafId = requestAnimationFrame(loop);
        return;
      }
      if (st.phase === 'results') {
        drawRoad();
        results.draw(ctx, { canvas, title: 'MADE IT TO ' + (opts.to != null ? 'THE NEXT STOP' : 'THE FARM'), coins: st._final.coins, score: st._final.score, awards: st._final.awards });
        if (results.dismissed()) { cleanup(); opts.onDone && opts.onDone(st._final); return; }
        rafId = requestAnimationFrame(loop);
        return;
      }
    }
    if (net) net.onMessage((fromId, payload) => {
      if (payload && payload.type === 'state' && !amDriver()) Object.assign(st, payload.st);
      if (payload && payload.type === 'vote') st.votes[fromId] = payload.ride;
    });
    rafId = requestAnimationFrame(loop);

    function cleanup() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.remove();
    }
    return { cleanup };
  }

  window.Drive = { start, needsDrive };
})();
