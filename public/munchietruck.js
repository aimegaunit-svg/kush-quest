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
  const TOP_WALK = 56, ROAD_T = 74, ROAD_B = 178; // layout: storefronts+HUD / sidewalk / road / sidewalk

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
      x: W / 2, y: 128, ang: -Math.PI / 2, speed: 0, drift: 0,
      dist: 0, finishDist: 2400, coins: 0, score: 0, combo: 0, bestCombo: 0, angry: 0,
      ended: false, wonAwards: [], customers: [], carts: [], selSnack: SNACKS[0], throwCooldown: 0,
      hd: -Math.PI / 2, tSec: 0, fines: 0, spilled: 0, missed: 0, dodged: 0
    };
    const WORLD = typeof opts.world === 'string' ? opts.world : 'suburb';
    const msgs = T.makeMessages();
    let gas = 0, gasPaid = false, hintT = 0, weather = null;

    let seed = T.newSeed(), R = T.rng(seed);
    function reseed(sd) { seed = sd; R = T.rng(sd); st.customers = []; st.carts = []; seedRoute(); weather = T.makeWeather(seed, WORLD); }
    function seedRoute() {
      let p = 200;
      while (p < st.finishDist - 150) {
        if (R() < 0.75) st.customers.push({ p, side: R() < 0.5 ? -1 : 1, snack: SNACKS[(R() * SNACKS.length) | 0], served: false });
        else st.carts.push({ p, side: R() < 0.5 ? -1 : 1, hit: false, s: 0, cx: -20, cy: 0, t: 0 });
        p += 60 + R() * 90;
      }
    }
    seedRoute();
    weather = T.makeWeather(seed, WORLD);

    const keys = new Set();
    let mouse = { x: W / 2, y: H / 2, down: false };
    let touchAim = null; // {x,y} virtual joystick / aim for touch throwers
    function onKeyDown(e) { keys.add(e.key.toLowerCase()); if (e.key >= '1' && e.key <= '4') st.selSnack = SNACKS[+e.key - 1]; }
    function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
    function onMouseMove(e) { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * (W / r.width); mouse.y = (e.clientY - r.top) * (H / r.height); }
    function onMouseDown(e) { if (running && onClickChip(e)) return; mouse.down = true; mouse.clicked = true; }
    function onMouseUp() { mouse.down = false; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    // touch steering (solo drives too): bottom-left/right corners steer, rest of the screen
    // aims + throws (tap near a customer). The two never overlap so a throw-tap can't also steer.
    const STEER_ZONE_W = W * 0.16, STEER_ZONE_H = H * 0.22;
    const touchSteer = { left: false, right: false };
    function inSteerZone(x, y) { return y > H - STEER_ZONE_H && (x < STEER_ZONE_W ? 'left' : x > W - STEER_ZONE_W ? 'right' : null); }
    function refreshTouchSteer(touches) {
      touchSteer.left = touchSteer.right = false;
      for (const t of touches) { const r = canvas.getBoundingClientRect(); const x = (t.clientX - r.left) * (W / r.width), y = (t.clientY - r.top) * (H / r.height); const z = inSteerZone(x, y); if (z) touchSteer[z] = true; }
    }
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      refreshTouchSteer(e.touches);
      for (const t of e.changedTouches) {
        const r = canvas.getBoundingClientRect();
        const x = (t.clientX - r.left) * (W / r.width), y = (t.clientY - r.top) * (H / r.height);
        const chip = chipAt(x, y); if (chip >= 0) { st.selSnack = SNACKS[chip]; continue; }
        if (!inSteerZone(x, y)) { touchAim = { x, y }; mouse = touchAim; mouse.down = true; }
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      refreshTouchSteer(e.touches);
      if (!touchAim) return;
      const t = [...e.touches].find(t => { const r = canvas.getBoundingClientRect(); return !inSteerZone((t.clientX - r.left) * (W / r.width), (t.clientY - r.top) * (H / r.height)); });
      if (!t) return;
      const r = canvas.getBoundingClientRect(); touchAim.x = (t.clientX - r.left) * (W / r.width); touchAim.y = (t.clientY - r.top) * (H / r.height);
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => { e.preventDefault(); refreshTouchSteer(e.touches); if (mouse) mouse.down = false; if (e.touches.length === 0) touchAim = null; }, { passive: false });

    // snack picker chips (bottom-center): keys 1-4 or tap
    const CHIP = 12, CHIP_Y = H - CHIP - 3, CHIP_X0 = T.isTouchDevice ? W * 0.16 + 4 : 4; // bottom-left (right of the touch steer zone)
    function chipAt(x, y) { if (y < CHIP_Y - 2 || y > H) return -1; const i = Math.floor((x - CHIP_X0) / (CHIP + 3)); return i >= 0 && i < 4 && x - CHIP_X0 - i * (CHIP + 3) <= CHIP ? i : -1; }
    function onClickChip(e) { const r = canvas.getBoundingClientRect(); const i = chipAt((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height)); if (i >= 0) { st.selSnack = SNACKS[i]; return true; } return false; }

    function driverInput() {
      const throttle = keys.has('w') || keys.has('arrowup') || touchSteer.left || touchSteer.right; // any touch steer implies rolling forward
      const brake = keys.has('s') || keys.has('arrowdown');
      const left = keys.has('a') || keys.has('arrowleft') || touchSteer.left;
      const right = keys.has('d') || keys.has('arrowright') || touchSteer.right;
      const handbrake = keys.has('shift') || keys.has(' ');
      return { throttle, brake, left, right, handbrake };
    }

    const remoteInputs = new Map();
    if (net) net._deliver = (fromId, payload) => {
      if (intro.handle(fromId, payload)) return;
      if (payload && (payload.type === 'swap' || payload.type === 'swapWarn')) { if (!isHost) deck.handle(payload); return; }
      if (payload && payload.type === 'input') remoteInputs.set(fromId, payload);
      if (payload && payload.type === 'state' && !isHost) applyRemoteState(payload);
      if (payload && payload.type === 'throw' && isHost) doThrow(payload.side, payload.snack);
      if (payload && payload.type === 'end' && !isHost) applyEnd(payload);
    };
    const sendInput = T.inputSender(net);
    // Online: the driver is whoever sits in seat 0 (swap events move it). The host simulates with that
    // player's relayed input; everyone else in the truck is a thrower.
    function iAmDriver() { return soloMode || !net || T.seatIsMine(seats[0], net); }
    function seatDriverInput() {
      if (!net || T.seatIsMine(seats[0], net)) return driverInput();
      return remoteInputs.get(seats[0].player && seats[0].player.id) || {};
    }

    const swap = T.makeSwapRunner();
    let nextSwapAt = 900 + Math.random() * 700;
    const deck = T.makeSwapDeck([
      { id: 'freeze', banner: 'BRAIN FREEZE!', reseat: 'rotate', sfx: [150, 'square'],
        fx: () => { st.speed = 0; } },
      { id: 'pothole', banner: 'POTHOLE!', reseat: 'shuffle', sfx: [90, 'sawtooth'],
        fx: () => { st.selSnack = SNACKS[(Math.random() * SNACKS.length) | 0]; st.speed *= 0.5; } },
      { id: 'sugar', banner: 'SUGAR RUSH!', reseat: 'reverse', sfx: [880, 'square'],
        fx: () => { st.speed = 90; st.rushT = 4; } },
      { id: 'wrongturn', banner: 'WRONG TURN!', reseat: 'swap01', sfx: [240, 'triangle'],
        fx: () => { st.ang += Math.PI / 3 * (Math.random() < 0.5 ? -1 : 1); } },
      { id: 'spill', banner: 'SPRINKLE SPILL!', reseat: 'rotate2', sfx: [400, 'sine'],
        fx: () => { st.drift = 1; st.combo = 0; } }
    ], { seats, runner: swap, net, onDone: () => { nextSwapAt = 700 + Math.random() * 600; } });

    let running = false;
    const intro = T.makeStartGate(ctx, {
      save, gameKey: 'mt', seenKey: 'seenMunchieTruck', canvas, net, seed, onSeed: reseed, title: 'MUNCHIE TRUCK',
      lines: soloMode
        ? ['WASD/arrows to drive, SHIFT/SPACE', 'to handbrake-drift corners.', '1-4 pick snack, click to throw', 'at matching-color customers!']
        : ['Driver: WASD + SHIFT to drift.', 'Throwers: aim with MOUSE, click', 'to throw matching-color snacks.']
    }, () => {
      running = true;
      if (!gasPaid) { gasPaid = true; gas = T.payGas(save, WORLD); }
      hintT = 6;
      msgs.say(soloMode ? 'WASD DRIVE - 1-4 SNACK' : (iAmDriver() ? 'WASD DRIVE - SHIFT DRIFT' : 'CLICK A SIDE TO THROW'),
        soloMode ? 'click as you pass a matching customer' : 'match the snack color - 1-4 to pick', '#ffd23f', 6);
    }, () => finish(true));
    const results = T.makeResultsScreen();

    let last = performance.now(), raf = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      const pct = Math.min(1, st.dist / st.finishDist);
      drawStreet(pct);
      if (!running) { intro.draw(); return; }
      if (st.ended) {
        draw(); weather.drawOverlay(ctx, pct, st.tSec, { topDown: true });
        results.draw(ctx, { canvas, title: 'DELIVERED!', coins: st.coins, gas, score: st.score, awards: st.wonAwards });
        if (results.dismissed()) finish();
        return;
      }
      st.tSec += dt; msgs.tick(dt * 1000);
      const wxName = weather.changed(pct); if (wxName) msgs.say(wxName, wxHint(), '#9fd8ff', 2.5);
      if (swap.tick(dt * 1000)) { st.dist += 10 * dt; draw(); weather.drawOverlay(ctx, pct, st.tSec, { topDown: true }); drawHud(pct); swap.draw(ctx); return; }
      if (isHost || !net) step(dt);
      handleLocalThrow(dt);
      draw();
      weather.drawOverlay(ctx, pct, st.tSec, { topDown: true });
      drawHud(pct);
      if (isHost && net) {
        st._bT = (st._bT || 0) + dt;
        if (st._bT > 0.1) { st._bT = 0; net.send(snapshot()); }
      } else if (net) {
        sendInput({ type: 'input', ...driverInput() });
      }
    }

    function snapshot() {
      return { type: 'state', x: st.x, y: st.y, ang: st.ang, dist: st.dist, coins: st.coins, combo: st.combo, angry: st.angry, speed: st.speed,
        cu: T.flagIdx(st.customers, 'served'), ca: T.flagIdx(st.carts, 'hit'),
        cs: st.carts.map(c => c.s ? [c.s, Math.round(c.cx), Math.round(c.cy), Math.round(c.t * 10)] : 0) };
    }
    function applyRemoteState(p) {
      st.x = p.x; st.y = p.y; st.ang = p.ang; st.dist = p.dist; st.coins = p.coins; st.combo = p.combo; st.angry = p.angry; st.speed = p.speed;
      T.applyFlags(st.customers, 'served', p.cu); T.applyFlags(st.carts, 'hit', p.ca);
      if (p.cs) p.cs.forEach((a, i) => { const c = st.carts[i]; if (!c || !a) return; const was = c.s; c.s = a[0]; c.cx = a[1]; c.cy = a[2]; c.t = a[3] / 10; if (was !== c.s) cartSay(c, was); });
    }
    function applyEnd(p) {
      if (st.ended) return;
      applyRemoteState(p.state || {});
      st.coins = p.coins; st.score = p.score; st.bestCombo = p.bestCombo; st.wonAwards = p.awards || []; st.ended = true;
    }

    function wxHint() {
      const w = weather.at(st.dist / st.finishDist);
      if (w.snow > 0.5 || w.wet > 0.5) return 'truck slides - steer early';
      if (w.fog > 0.4) return 'orders are harder to see';
      return '';
    }

    // HOA carts: seeded trigger points. Each one drives up from behind (visible), paces you with
    // its light flashing, locks onto your lane (red line), then rams across it. Move up/down to dodge.
    const CART_PACE_X = W / 2 - 46;
    function cartSay(c, was) {
      if (c.s === 1) msgs.say('HOA CART BEHIND YOU', 'it will ram your lane', '#ff9a5a', 1.6);
      else if (c.s === 2) msgs.say('HOA CART PACING YOU', 'watch the red line - dodge it', '#ff9a5a', 1.8);
      else if (c.s === 4 && c.hit) { msgs.say('HOA FINE! -3', 'rammed by security', '#ff6b6b', 1.6); coinFlash = -0.6; }
      else if (c.s === 4 && was === 3) msgs.say('DODGED!', '', '#8ef0b0', 1, true);
    }
    function stepCarts(dt) {
      for (const c of st.carts) {
        const was = c.s;
        if (c.s === 0) {
          if (st.dist >= c.p - 60 && st.dist < st.finishDist - 120) { c.s = 1; c.cx = -16; c.cy = c.side < 0 ? ROAD_T - 6 : ROAD_B + 6; }
        } else if (c.s === 1) {
          c.cx += 55 * dt; c.cy += (st.y - c.cy) * Math.min(1, dt * 1.2);
          if (c.cx >= CART_PACE_X) { c.cx = CART_PACE_X; c.s = 2; c.t = 2.6; }
        } else if (c.s === 2) {
          c.t -= dt;
          if (c.t > 0.9) c.cy += Math.sign(st.y - c.cy) * Math.min(Math.abs(st.y - c.cy), 32 * dt); // tracks you, then locks
          if (c.t <= 0) { c.s = 3; T.tone(300, 0.12, 'sawtooth', 0.08); }
        } else if (c.s === 3) {
          c.cx += 170 * dt;
          if (!c.hit && Math.abs(c.cx - W / 2) < 11 && Math.abs(c.cy - st.y) < 9) {
            c.hit = true; st.speed *= 0.4; st.combo = 0; const f = Math.min(st.coins, 3); st.coins -= f; st.fines += f; T.noise(0.15, 0.15); c.s = 4;
          } else if (c.cx > W / 2 + 14) { c.s = 4; st.dodged++; }
        } else if (c.s === 4) {
          if (c.cx < W + 30) c.cx += 140 * dt; else c.s = 5;
        }
        if (was !== c.s) cartSay(c, was);
      }
    }

    function step(dt) {
      const inp = seatDriverInput();
      const w = weather.at(st.dist / st.finishDist);
      const ACC = 60, TURN = 2.4;
      if (inp.throttle) st.speed += ACC * dt;
      if (inp.brake) st.speed -= ACC * dt * 1.4;
      st.speed *= 0.98;
      if (st.rushT > 0) { st.rushT -= dt; st.speed = Math.max(st.speed, 80); }
      st.speed = Math.max(-30, Math.min(st.rushT > 0 ? 120 : 90, st.speed));
      const turnAmt = TURN * dt * (inp.handbrake ? 1.8 : 1);
      if (inp.left) st.ang -= turnAmt;
      if (inp.right) st.ang += turnAmt;
      st.drift = inp.handbrake ? Math.min(1, st.drift + dt * 2) : Math.max(0, st.drift - dt * 3);
      // weather: low grip (rain/snow) makes the truck's travel direction lag its nose (a gentle slide);
      // wind nudges it sideways a little. Dry = snappy.
      const g = w.grip * w.grip * w.grip, follow = Math.min(1, dt * (2 + 10 * g));
      let dA = st.ang - st.hd; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); st.hd += dA * follow;
      st.x += Math.cos(st.hd) * st.speed * dt * (1 - st.drift * 0.3);
      st.y += Math.sin(st.hd) * st.speed * dt * (1 - st.drift * 0.3) * 0.4 + w.wind * 5 * dt;
      st.y = Math.max(ROAD_T + 6, Math.min(ROAD_B - 6, st.y));
      st.dist += Math.abs(st.speed) * dt * 0.7;

      stepCarts(dt);
      // customers you roll past unserved are lost (and break the combo)
      for (const c of st.customers) if (!c.served && st.dist - c.p > 22) {
        c.served = true; st.missed++; if (st.combo > 0) msgs.say('MISSED ONE', 'combo lost', '#c8a0a0', 1, true); st.combo = 0;
      }
      if (st.dist >= st.finishDist) endRun();
      st.throwCooldown = Math.max(0, st.throwCooldown - dt);
      st.score = Math.floor(st.dist) + st.coins * 3;

      nextSwapAt -= dt * 60;
      if (nextSwapAt <= 0 && st.dist > 400 && st.dist < st.finishDist - 500) {
        nextSwapAt = deck.fire() ? 99999 : 60; // fire() starts the 5s countdown; null = one already pending
      }
    }

    function handleLocalThrow(dt) {
      // solo: auto-throw confirm when near a customer (press E/click)
      // a quick click can go down+up between two frames, so a click is latched until it's used
      const wantThrow = mouse.down || mouse.clicked;
      if (!wantThrow || st.throwCooldown > 0) return;
      mouse.clicked = false;
      if (soloMode) {
        const near = st.customers.find(c => !c.served && Math.abs(c.p - st.dist) < 16);
        if (near) { doThrow(near.side, st.selSnack); st.throwCooldown = 0.25; }
        return;
      }
      // multi: only non-driver seats throw (toward mouse/touch aim position)
      if (net && iAmDriver()) return;
      const side = mouse.y < st.y ? -1 : 1;
      if (isHost) doThrow(side, st.selSnack);
      else if (net) net.send({ type: 'throw', side, snack: st.selSnack });
      st.throwCooldown = 0.3;
    }

    // Economy (gas for suburb = 18): a right snack pays 2, +1 bonus on every 5th in a row.
    // ~12-17 customers per route -> a clean run earns ~26-37 (net ~+8..+19). Wrong snack spills 2 coins,
    // an HOA ram is a 3-coin fine, missed customers pay nothing -> sloppy runs end in the red.
    function doThrow(side, snack) {
      const target = st.customers.find(c => !c.served && c.side === side && Math.abs(c.p - st.dist) < 20);
      if (!target) return;
      target.served = true;
      if (target.snack === snack) {
        st.combo++; st.bestCombo = Math.max(st.bestCombo, st.combo);
        const bonus = st.combo % 5 === 0 ? 1 : 0; st.coins += 2 + bonus;
        if (bonus) msgs.say('COMBO x' + st.combo + '! +1', '', '#ffd23f', 1, true);
        T.tone(700 + st.combo * 20, 0.08, 'square', 0.1);
      } else {
        st.combo = 0; st.angry++;
        const f = Math.min(st.coins, 2); st.coins -= f; st.spilled += f;
        msgs.say('WRONG SNACK! -2', 'match the color', '#ff6b6b', 1.2);
        T.noise(0.12, 0.15);
      }
    }

    function endRun() {
      st.ended = true;
      st.wonAwards = [];
      if (st.angry === 0) st.wonAwards.push('CUSTOMER SERVICE — zero angry');
      if (st.bestCombo >= 6) st.wonAwards.push('COMBO KING x' + st.bestCombo);
      st.score += st.coins * 2;
      if (net && isHost) net.send({ type: 'end', coins: st.coins, score: st.score, bestCombo: st.bestCombo, awards: st.wonAwards, state: snapshot() });
    }

    function drawStreet(pct) {
      const sky = weather.sky(pct || 0);
      // sidewalks carry the time-of-day tint (overhead game: no sky, so the light changes the ground)
      ctx.fillStyle = '#5a5048'; ctx.fillRect(0, 0, W, TOP_WALK); // storefronts (HUD lives over these)
      const off = -((st.dist * 1) % 48);
      for (let x = off; x < W + 48; x += 48) { ctx.fillStyle = '#4a4240'; ctx.fillRect(x + 4, 10, 40, TOP_WALK - 10); ctx.fillStyle = '#3a4a5a'; ctx.fillRect(x + 10, 30, 12, 14); ctx.fillRect(x + 26, 30, 12, 14); }
      ctx.fillStyle = '#8a8478'; ctx.fillRect(0, TOP_WALK, W, ROAD_T - TOP_WALK); ctx.fillRect(0, ROAD_B, W, H - ROAD_B);
      ctx.fillStyle = '#4e4e52'; ctx.fillRect(0, ROAD_T, W, ROAD_B - ROAD_T);
      ctx.fillStyle = '#6c665c'; for (let x = off / 2 % 24; x < W; x += 24) { ctx.fillRect(x, TOP_WALK, 1, ROAD_T - TOP_WALK); ctx.fillRect(x, ROAD_B, 1, H - ROAD_B); }
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.setLineDash([6, 6]); ctx.lineDashOffset = st.dist % 12;
      ctx.beginPath(); ctx.moveTo(0, (ROAD_T + ROAD_B) / 2); ctx.lineTo(W, (ROAD_T + ROAD_B) / 2); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset = 0;
      const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sky[0]); gr.addColorStop(1, sky[1]);
      ctx.save(); ctx.globalAlpha = 0.22; ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore();
    }

    function worldX(p, side) { return W / 2 + side * 40 - (st.dist - p); }

    function draw() {
      for (const c of st.customers) if (!c.served) {
        const x = worldX(c.p, c.side);
        if (x > -10 && x < W + 10) {
          const y = c.side < 0 ? ROAD_T - 5 : H - 7;
          ctx.fillStyle = '#e8c8a0'; ctx.fillRect(x - 2, y - 4, 4, 4); ctx.fillStyle = '#556'; ctx.fillRect(x - 2, y, 4, 5);
          // order bubble
          ctx.fillStyle = '#fff'; ctx.fillRect(x - 5, y - 15, 10, 9); ctx.fillStyle = colorOf(c.snack); ctx.fillRect(x - 3, y - 13, 6, 5);
          if (Math.abs(c.p - st.dist) < 16) { ctx.strokeStyle = '#fff'; ctx.strokeRect(x - 6.5, y - 16.5, 13, 12); }
        }
      }
      for (const c of st.carts) if (c.s >= 1 && c.s <= 4 && c.cx > -30 && c.cx < W + 30) {
        if (c.s === 2 && c.t < 0.9) { // locked lane: red line shows where it will ram
          ctx.fillStyle = 'rgba(255,60,60,' + (0.35 + 0.3 * Math.sin(st.tSec * 20)) + ')'; ctx.fillRect(c.cx, c.cy - 1, W / 2 + 20 - c.cx, 2);
        }
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(c.cx - 7, c.cy - 4, 14, 8);
        ctx.fillStyle = '#2a4a8a'; ctx.fillRect(c.cx - 2, c.cy - 3, 5, 6);
        const on = Math.floor(st.tSec * 8) % 2 === 0;
        ctx.fillStyle = on ? '#ff3b3b' : '#ffb000'; ctx.fillRect(c.cx - 1, c.cy - 6, 3, 2);
        if (c.s === 2) T.hudText(ctx, '!', c.cx - 2, c.cy - 16, '#ff3b3b', 2);
      }
      // truck
      ctx.save(); ctx.translate(W / 2, st.y); ctx.rotate(st.ang + Math.PI / 2);
      ctx.fillStyle = '#e0c840'; ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = '#333'; ctx.fillRect(-6, -6, 12, 2);
      ctx.restore();
      // aim reticle for throwers
      if (!soloMode && !iAmDriver()) { ctx.strokeStyle = colorOf(st.selSnack); ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 4, 0, 7); ctx.stroke(); }
    }
    function colorOf(s) { return { red: '#f44', blue: '#48f', green: '#4c4', yellow: '#fd4' }[s] || '#fff'; }

    let lastCoins = 0, coinFlash = 0;
    function drawHud(pct) {
      T.hudProgress(ctx, pct);
      if (st.coins !== lastCoins) { coinFlash = st.coins > lastCoins ? 0.4 : -0.6; lastCoins = st.coins; }
      if (coinFlash) { const up = coinFlash > 0; coinFlash = up ? Math.max(0, coinFlash - 1 / 60) : Math.min(0, coinFlash + 1 / 60);
        ctx.fillStyle = up ? 'rgba(255,210,63,0.35)' : 'rgba(255,60,60,0.4)'; ctx.fillRect(2, 6, 34, 14); }
      T.hudCoins(ctx, st.coins, gas);
      // top-right: combo + angry, small
      if (st.combo > 1) T.hudText(ctx, 'x' + st.combo, W - 4, 8, st.combo >= 5 ? '#ffd23f' : '#fff', 2, 'right');
      if (st.angry) T.hudText(ctx, st.angry + ' ANGRY', W - 4, 22, '#ff8a8a', 1, 'right');
      // bottom-left: snack chips with key tags
      for (let i = 0; i < 4; i++) {
        const x = CHIP_X0 + i * (CHIP + 3), sel = SNACKS[i] === st.selSnack;
        ctx.fillStyle = sel ? '#fff' : 'rgba(20,12,30,0.7)'; ctx.fillRect(x - 1, CHIP_Y - 1, CHIP + 2, CHIP + 2);
        ctx.fillStyle = colorOf(SNACKS[i]); ctx.fillRect(x + 1, CHIP_Y + 1, CHIP - 2, CHIP - 2);
        if (!T.isTouchDevice) T.hudText(ctx, String(i + 1), x + 3, CHIP_Y + 2, '#000', 1);
      }
      if (T.isTouchDevice) {
        T.drawTouchZones(ctx, [
          { x: 0, y: H - STEER_ZONE_H, w: STEER_ZONE_W, h: STEER_ZONE_H, label: '◀', active: touchSteer.left },
          { x: W - STEER_ZONE_W, y: H - STEER_ZONE_H, w: STEER_ZONE_W, h: STEER_ZONE_H, label: '▶', active: touchSteer.right },
        ]);
        if (touchAim) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(touchAim.x, touchAim.y, 6, 0, Math.PI * 2); ctx.stroke(); }
      }
      // single message slot (swap countdown wins it while pending)
      if (swap.warning) swap.draw(ctx); else msgs.draw(ctx, 30);
    }

    function finish(skipped) {
      cleanup();
      if (skipped) { opts.onDone && opts.onDone({ coins: 0, score: 0, awards: [], skipped: true, combo: 0, angry: 0, swaps: [], from: opts.from, to: opts.to }); return; }
      T.markDone(save, 'mt');
      // carry-over (Step 4.4): leftover stock — a 5+ delivery combo lets the crew keep 1 Munchies
      opts.onDone && opts.onDone({ coins: st.coins, munchies: st.bestCombo >= 5 ? 1 : 0, score: st.score, awards: st.wonAwards.slice(), combo: st.bestCombo, angry: st.angry, swaps: deck.history.slice(), from: opts.from, to: opts.to });
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
    return { cleanup, _debug: { st, seats, deck, swap, msgs, weather: () => weather, setWeather: (w) => { weather = w; }, gas: () => gas, fireSwap: () => deck.fire(), running: () => running } };
  }

  window.MunchieTruck = { start, needsPlay: (save) => T.needsPlay(save, 'mt') };
})();
