/* DUEL — quick-draw duel logic, AI opponent, effects, scene rendering */
window.GB = window.GB || {};

// ---------- shared particle / floating-text effects ----------
GB.fx = (function () {
  let parts = [];
  let texts = [];

  function spawnBlood(x, y, n, dir) {
    for (let i = 0; i < n; i++) {
      const a = (dir || 0) + (Math.random() - 0.5) * 2.2;
      const sp = 60 + Math.random() * 240;
      parts.push({
        type: 'blood', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
        r: 1.5 + Math.random() * 3, life: 0.7 + Math.random() * 0.5,
        color: Math.random() < 0.5 ? '#a3231b' : '#7d0f0f'
      });
    }
  }
  function spawnDust(x, y, n, big) {
    for (let i = 0; i < n; i++) {
      parts.push({
        type: 'dust', x: x + (Math.random() - 0.5) * (big ? 40 : 10), y,
        vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 50,
        r: (big ? 6 : 3) + Math.random() * 5, life: 0.5 + Math.random() * 0.5,
        color: 'rgba(190,160,110,'
      });
    }
  }
  function spawnShards(x, y, color, n) {
    for (let i = 0; i < (n || 10); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 200;
      parts.push({
        type: 'shard', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        r: 1.5 + Math.random() * 2.5, life: 0.6 + Math.random() * 0.4,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14,
        color
      });
    }
  }
  function spawnHat(x, y, color, dir) {
    parts.push({
      type: 'hat', x, y, vx: dir * (120 + Math.random() * 80), vy: -240,
      rot: 0, vr: dir * 9, life: 1.4, color
    });
  }
  function spawnText(x, y, text, color, size) {
    texts.push({ x, y, text, color: color || '#fff', size: size || 20, life: 1.1 });
  }

  function update(dt) {
    for (const p of parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.type === 'dust' ? 60 : 620) * dt;
      if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
    }
    parts = parts.filter(p => p.life > 0);
    for (const t of texts) { t.life -= dt; t.y -= 46 * dt; }
    texts = texts.filter(t => t.life > 0);
  }

  function draw(ctx) {
    for (const p of parts) {
      const a = Math.max(0, Math.min(1, p.life * 1.6));
      if (p.type === 'dust') {
        ctx.fillStyle = p.color + (a * 0.5) + ')';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1.6 - a * 0.6), 0, 7); ctx.fill();
      } else if (p.type === 'hat') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.ellipse(0, 0, 24, 7, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0, -8, 11, 8, 0, 0, 7); ctx.fill();
        ctx.restore();
      } else if (p.type === 'shard') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.textAlign = 'center';
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life * 1.4));
      ctx.font = 'bold ' + t.size + 'px Georgia';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }

  return { spawnBlood, spawnDust, spawnShards, spawnHat, spawnText, update, draw, clear() { parts = []; texts = []; } };
})();

// ---------- procedural scene backgrounds ----------
GB.scene = (function () {
  const W = 960, H = 540, GROUND = 480;
  const PALETTES = [
    { sky: ['#8fc4e8', '#cfe3d8', '#f0d9a8'], sun: '#fff3c4', mesa: '#b5765a', sand: '#d9b27c', street: '#c49a5f', night: false },
    { sky: ['#e8a04b', '#e8c07c', '#f0d9a8'], sun: '#ffdca0', mesa: '#8c4f3a', sand: '#cfa066', street: '#b58a50', night: false },
    { sky: ['#c25b3a', '#d98a54', '#e8b87c'], sun: '#ffb26b', mesa: '#6b2f24', sand: '#b58455', street: '#9c7343', night: false },
    { sky: ['#1a2340', '#2c3a5e', '#4a4a6b'], sun: '#e8e2d2', mesa: '#232338', sand: '#6b5d4f', street: '#5a4c3d', night: true }
  ];

  let cache = null, cacheKey = -1;
  let tumbleX = -100, tumbleR = 0;

  function paletteFor(level) { return PALETTES[Math.floor((level - 1) / 3) % PALETTES.length]; }

  function render(level) {
    const p = paletteFor(level);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    // sky
    const sky = c.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, p.sky[0]); sky.addColorStop(0.6, p.sky[1]); sky.addColorStop(1, p.sky[2]);
    c.fillStyle = sky; c.fillRect(0, 0, W, GROUND);

    // stars / sun / moon
    if (p.night) {
      c.fillStyle = 'rgba(255,255,255,.8)';
      let seed = 7;
      for (let i = 0; i < 60; i++) {
        seed = (seed * 16807) % 2147483647;
        const sx = seed % W; seed = (seed * 16807) % 2147483647;
        const sy = seed % 300;
        c.fillRect(sx, sy, 2, 2);
      }
      c.fillStyle = p.sun;
      c.beginPath(); c.arc(780, 90, 34, 0, 7); c.fill();
      c.fillStyle = p.sky[0];
      c.beginPath(); c.arc(768, 82, 30, 0, 7); c.fill();
    } else {
      const g = c.createRadialGradient(780, 95, 10, 780, 95, 90);
      g.addColorStop(0, p.sun); g.addColorStop(1, 'rgba(255,240,190,0)');
      c.fillStyle = g; c.fillRect(660, 0, 240, 220);
      c.fillStyle = p.sun;
      c.beginPath(); c.arc(780, 95, 32, 0, 7); c.fill();
      // clouds
      c.fillStyle = 'rgba(255,255,255,.55)';
      [[150, 80, 1], [420, 130, 0.7], [640, 60, 0.85]].forEach(([cx, cy, s]) => {
        c.beginPath();
        c.ellipse(cx, cy, 56 * s, 14 * s, 0, 0, 7);
        c.ellipse(cx + 30 * s, cy - 10 * s, 34 * s, 12 * s, 0, 0, 7);
        c.ellipse(cx - 34 * s, cy - 6 * s, 30 * s, 11 * s, 0, 0, 7);
        c.fill();
      });
    }

    // distant mesas
    c.fillStyle = p.mesa;
    c.beginPath();
    c.moveTo(0, 340);
    c.lineTo(60, 300); c.lineTo(150, 300); c.lineTo(190, 345);
    c.lineTo(320, 345); c.lineTo(360, 285); c.lineTo(470, 285); c.lineTo(510, 350);
    c.lineTo(700, 350); c.lineTo(750, 305); c.lineTo(860, 305); c.lineTo(910, 355);
    c.lineTo(W, 355); c.lineTo(W, GROUND); c.lineTo(0, GROUND);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(0,0,0,.12)';
    c.fillRect(0, 356, W, GROUND - 356);

    // ground
    const sand = c.createLinearGradient(0, 380, 0, H);
    sand.addColorStop(0, p.sand); sand.addColorStop(1, GB.chars.shade(p.sand, 0.72));
    c.fillStyle = sand; c.fillRect(0, 380, W, H - 380);
    // street strip
    c.fillStyle = p.street;
    c.beginPath();
    c.moveTo(280, H); c.lineTo(380, 400); c.lineTo(760, 400); c.lineTo(920, H);
    c.closePath(); c.fill();
    // wheel ruts
    c.strokeStyle = 'rgba(0,0,0,.12)';
    c.lineWidth = 6;
    c.beginPath(); c.moveTo(430, 410); c.lineTo(370, H); c.moveTo(700, 410); c.lineTo(820, H); c.stroke();

    drawSaloon(c, 20, 402, p);
    drawStore(c, 700, 402, p);
    drawCactus(c, 250, 430, 0.8);
    drawCactus(c, 880, 460, 1.1);
    // hitching rail
    c.strokeStyle = '#4b3a22';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(300, 430); c.lineTo(300, 405); c.moveTo(360, 430); c.lineTo(360, 405);
    c.moveTo(292, 408); c.lineTo(368, 408);
    c.stroke();
    // skull
    c.fillStyle = '#e8e2d2';
    c.beginPath(); c.arc(150, 505, 8, 0, 7); c.fill();
    c.fillRect(144, 508, 12, 6);
    c.fillStyle = p.sand;
    c.beginPath(); c.arc(147, 504, 2, 0, 7); c.arc(153, 504, 2, 0, 7); c.fill();

    if (p.night) { c.fillStyle = 'rgba(10,14,40,.32)'; c.fillRect(0, 0, W, H); }
    return cv;
  }

  function drawSaloon(c, x, gy, p) {
    const w = 220, h = 150;
    c.fillStyle = '#6b4a2a';
    c.fillRect(x, gy - h, w, h);
    // false front
    c.fillStyle = '#7c5a34';
    c.fillRect(x - 6, gy - h - 26, w + 12, 34);
    c.fillStyle = '#4b3a22';
    for (let i = 0; i < 6; i++) c.fillRect(x + 8 + i * 36, gy - h, 3, h);
    // sign
    c.fillStyle = '#2b1a0a';
    c.fillRect(x + 30, gy - h - 20, w - 60, 24);
    c.fillStyle = '#e0a52e';
    c.font = 'bold 17px Georgia';
    c.textAlign = 'center';
    c.fillText('S A L O O N', x + w / 2, gy - h - 2);
    // porch roof
    c.fillStyle = '#54381e';
    c.fillRect(x - 10, gy - 84, w + 20, 10);
    c.strokeStyle = '#3f2712'; c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x + 12, gy - 74); c.lineTo(x + 12, gy);
    c.moveTo(x + w - 12, gy - 74); c.lineTo(x + w - 12, gy);
    c.stroke();
    // batwing doors
    c.fillStyle = p.night ? '#e8c06b' : '#2b1a0a';
    c.fillRect(x + 92, gy - 62, 40, 62);
    c.fillStyle = '#8c6238';
    c.fillRect(x + 90, gy - 56, 20, 34);
    c.fillRect(x + 114, gy - 56, 20, 34);
    // windows
    c.fillStyle = p.night ? '#e8c06b' : '#96c6e0';
    c.fillRect(x + 24, gy - 60, 34, 30);
    c.fillRect(x + 164, gy - 60, 34, 30);
    c.strokeStyle = '#2b1a0a'; c.lineWidth = 3;
    c.strokeRect(x + 24, gy - 60, 34, 30);
    c.strokeRect(x + 164, gy - 60, 34, 30);
  }

  function drawStore(c, x, gy, p) {
    const w = 240, h = 130;
    c.fillStyle = '#8c6238';
    c.fillRect(x, gy - h, w, h);
    c.fillStyle = '#a3764a';
    c.beginPath();
    c.moveTo(x - 8, gy - h); c.lineTo(x + w / 2, gy - h - 40); c.lineTo(x + w + 8, gy - h);
    c.closePath(); c.fill();
    c.fillStyle = '#4b3a22';
    for (let i = 0; i < 7; i++) c.fillRect(x + 6 + i * 34, gy - h, 3, h);
    c.fillStyle = '#2b1a0a';
    c.fillRect(x + 26, gy - 96, w - 52, 22);
    c.fillStyle = '#e8d5a3';
    c.font = 'bold 14px Georgia';
    c.textAlign = 'center';
    c.fillText('GENERAL STORE', x + w / 2, gy - 80);
    c.fillStyle = p.night ? '#e8c06b' : '#96c6e0';
    c.fillRect(x + 34, gy - 58, 36, 34);
    c.fillRect(x + 170, gy - 58, 36, 34);
    c.strokeStyle = '#2b1a0a'; c.lineWidth = 3;
    c.strokeRect(x + 34, gy - 58, 36, 34);
    c.strokeRect(x + 170, gy - 58, 36, 34);
    c.fillStyle = '#2b1a0a';
    c.fillRect(x + 104, gy - 64, 34, 64);
  }

  function drawCactus(c, x, gy, s) {
    c.fillStyle = '#4f7359';
    GB.chars.rr(c, x - 7 * s, gy - 64 * s, 14 * s, 64 * s, 7 * s); c.fill();
    GB.chars.rr(c, x - 26 * s, gy - 48 * s, 12 * s, 26 * s, 6 * s); c.fill();
    c.fillRect(x - 26 * s, gy - 26 * s, 22 * s, 9 * s);
    GB.chars.rr(c, x + 14 * s, gy - 56 * s, 12 * s, 30 * s, 6 * s); c.fill();
    c.fillRect(x + 6 * s, gy - 34 * s, 20 * s, 9 * s);
  }

  function draw(ctx, level, dt) {
    if (!cache || cacheKey !== level) { cache = render(level); cacheKey = level; }
    ctx.drawImage(cache, 0, 0);
    // rolling tumbleweed
    tumbleX += 55 * dt; tumbleR += 3.2 * dt;
    if (tumbleX > W + 120) tumbleX = -120;
    ctx.save();
    ctx.translate(tumbleX, 462 + Math.abs(Math.sin(tumbleR * 1.5)) * -10);
    ctx.rotate(tumbleR);
    ctx.strokeStyle = 'rgba(140,110,60,.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, 13, i, i + 2.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  return { draw, paletteFor, GROUND, W, H };
})();

// ---------- the duel itself ----------
GB.Duel = (function () {
  const W = 960, H = 540;
  const HOLSTER = { x: 95, y: H - 85, r: 52 };
  const OPP = { x: 600, y: 470, scale: 1.32 };
  const COUNT_STEP = 0.75;   // seconds per countdown tick

  let S = null;              // duel state

  function start(opts) {
    const st = opts.settings, ch = opts.cheats;
    S = {
      opts, phase: 'intro', t: 0, phaseT: 0,
      level: opts.level,
      count: 3, countT: 0, inHolster: false,
      warn: '', warnT: 0,
      fireT: 0, firstKillT: 0,
      banner: '', bannerT: 0,
      player: {
        name: opts.player.name, cfg: opts.player.cfg,
        hp: st.health, maxHp: st.health,
        ammo: st.ammo === 0 ? Infinity : st.ammo,
        shots: 0, hitsLanded: 0, cooldown: 0, hitFlash: 0, recoil: 0, gunUp: 0
      },
      opp: {
        def: opts.oppDef, cfg: opts.oppDef.cfg, name: opts.oppDef.name,
        hp: st.health, maxHp: st.health,
        ammo: st.ammo === 0 ? Infinity : st.ammo,
        raise: 0, recoil: 0, fall: 0, hurt: 0, hatOn: true,
        nextShot: 0, shooting: false
      },
      aim: { x: W / 2, y: H / 2 },
      result: null, endT: 0, ended: false,
      reaction: opts.oppDef.reaction * (st.reactionScale / 100) * (ch.slowmo ? 1.9 : 1),
      accuracy: Math.min(0.99, opts.oppDef.accuracy * (st.accuracyScale / 100)),
      interval: opts.oppDef.interval * (ch.slowmo ? 1.6 : 1),
      cheats: ch, settings: st,
      oppHeadScale() { return ch.bighead ? 1.8 : 1; }
    };
    GB.fx.clear();
  }

  function setPhase(p) { S.phase = p; S.phaseT = 0; }

  function playerDamageRoll() {
    const st = S.settings;
    if (st.damageModel === 'uniform') return { part: 'body', dmg: 25 };
    const r = Math.random();
    if (r < 0.10) return { part: 'head', dmg: st.oneShotHead ? 9999 : 55 };
    if (r < 0.55) return { part: 'torso', dmg: 30 };
    if (r < 0.80) return { part: 'arm', dmg: 20 };
    return { part: 'leg', dmg: 15 };
  }

  function oppDamageFor(part) {
    const st = S.settings;
    if (S.cheats.oneshot) return 9999;
    if (st.damageModel === 'uniform') return 25;
    switch (part) {
      case 'head': return st.oneShotHead ? 9999 : 60;
      case 'torso': return 34;
      case 'armL': case 'armR': return 22;
      default: return 18;
    }
  }

  function update(dt) {
    if (!S) return;
    S.t += dt; S.phaseT += dt;
    const P = S.player, O = S.opp;

    P.cooldown = Math.max(0, P.cooldown - dt);
    P.hitFlash = Math.max(0, P.hitFlash - dt * 2.2);
    P.recoil = Math.max(0, P.recoil - dt * 6);
    O.recoil = Math.max(0, O.recoil - dt * 5);
    O.hurt = Math.max(0, O.hurt - dt * 3);
    S.warnT = Math.max(0, S.warnT - dt);
    S.bannerT = Math.max(0, S.bannerT - dt);

    if (S.phase === 'intro') {
      if (S.phaseT > 2.0) { setPhase('holster'); }
    } else if (S.phase === 'holster') {
      P.gunUp = Math.max(0, P.gunUp - dt * 3);
      if (S.inHolster) { setPhase('countdown'); S.count = 3; S.countT = 0; GB.sfx.tick(); }
    } else if (S.phase === 'countdown') {
      if (!S.inHolster) {
        setPhase('holster');
        S.warn = 'TOO SOON! KEEP YOUR CURSOR HOLSTERED'; S.warnT = 1.6;
        GB.sfx.foul();
      } else {
        S.countT += dt;
        if (S.countT >= COUNT_STEP) {
          S.countT -= COUNT_STEP;
          S.count--;
          if (S.count <= 0) {
            setPhase('fire');
            S.fireT = S.t;
            GB.sfx.fireBell();
            const jit = 0.85 + Math.random() * 0.3;
            O.nextShot = S.t + (S.reaction * jit) / 1000;
          } else GB.sfx.tick();
        }
      }
    } else if (S.phase === 'fire') {
      P.gunUp = Math.min(1, P.gunUp + dt * 6);
      // opponent draws just before their shot lands
      if (O.hp > 0 && P.hp > 0) {
        const untilShot = O.nextShot - S.t;
        if (untilShot < 0.22 && O.ammo > 0) O.raise = Math.min(1, O.raise + dt * 7);
        if (S.t >= O.nextShot && O.ammo > 0) {
          O.ammo--;
          O.recoil = 1;
          GB.sfx.enemyShot();
          oppMuzzle();
          if (Math.random() < S.accuracy && !S.cheats.nohit) {
            const roll = playerDamageRoll();
            P.hp = Math.max(0, P.hp - roll.dmg);
            P.hitFlash = 1;
            GB.sfx.fleshHit();
            GB.fx.spawnText(W / 2 + (Math.random() - 0.5) * 120, H - 140, '-' + Math.min(roll.dmg, P.maxHp) + (roll.part === 'head' ? '  HEAD!' : ''), '#ff5040', 24);
            if (P.hp <= 0) return playerDown();
          } else {
            GB.sfx.ricochet();
            GB.fx.spawnDust(120 + Math.random() * 200, H - 20 - Math.random() * 60, 5);
          }
          O.nextShot = S.t + (S.interval * (0.8 + Math.random() * 0.4)) / 1000;
        }
      }
      // stand-off: both out of ammo, both standing
      if (P.hp > 0 && O.hp > 0 && P.ammo <= 0 && O.ammo <= 0 && S.phaseT > 1) {
        S.result = 'draw';
        S.banner = 'DRAW!'; S.bannerT = 99;
        GB.sfx.drawSting();
        setPhase('over');
      }
    } else if (S.phase === 'over') {
      if (S.result === 'win' && O.fall < 1) {
        O.fall = Math.min(1, O.fall + dt * 1.7);
        if (O.fall >= 1) { GB.fx.spawnDust(OPP.x, OPP.y, 14, true); GB.sfx.fall(); }
      }
      if (!S.ended && S.phaseT > 2.3) {
        S.ended = true;
        const stats = {
          result: S.result,
          timeToKill: S.firstKillT ? (S.firstKillT - S.fireT) : 0,
          shots: P.shots, hits: P.hitsLanded,
          hpLeft: P.hp, maxHp: P.maxHp
        };
        S.opts.onEnd(stats);
      }
    }

    GB.fx.update(dt);
  }

  function oppMuzzle() {
    const m = GB.chars.muzzlePoint(OPP.x, OPP.y, OPP.scale);
    GB.fx.spawnShards(m.x, m.y, '#ffd76b', 6);
  }

  function playerDown() {
    S.result = 'lose';
    S.banner = 'GUNNED DOWN...'; S.bannerT = 99;
    GB.sfx.loseSting();
    setPhase('over');
  }

  function playerShoot(x, y) {
    const P = S.player, O = S.opp;
    if (S.phase === 'holster' || S.phase === 'countdown') {
      S.warn = 'WAIT FOR THE SIGNAL!'; S.warnT = 1.4;
      GB.sfx.foul();
      return;
    }
    if (S.phase !== 'fire' || P.hp <= 0) return;
    if (P.cooldown > 0) return;
    if (P.ammo <= 0) { GB.sfx.dryFire(); return; }

    P.cooldown = S.cheats.fastfire ? 0.07 : 0.28;
    if (!S.cheats.moreammo) P.ammo--;
    P.shots++;
    P.recoil = 1;
    GB.sfx.gunshot();

    if (O.hp <= 0) return; // firing at a downed man — shots still spend, nothing to hit

    const part = GB.chars.hitTest(OPP.x, OPP.y, OPP.scale, S.oppHeadScale(), O.hatOn, x, y);
    if (part === 'hat') {
      O.hatOn = false;
      GB.fx.spawnHat(x, y, O.cfg.hat, x > OPP.x ? 1 : -1);
      GB.fx.spawnText(x, y - 20, 'HAT TRICK! +50', '#e0a52e', 18);
      GB.sfx.ricochet();
      S.opts.onHatShot && S.opts.onHatShot();
    } else if (part) {
      P.hitsLanded++;
      const dmg = oppDamageFor(part);
      O.hp = Math.max(0, O.hp - dmg);
      O.hurt = 1;
      GB.fx.spawnBlood(x, y, part === 'head' ? 22 : 12, x > OPP.x ? 0.4 : Math.PI - 0.4);
      GB.sfx.fleshHit();
      GB.fx.spawnText(x, y - 26, part === 'head' ? 'HEADSHOT!' : '-' + dmg, part === 'head' ? '#ffd76b' : '#fff', part === 'head' ? 22 : 18);
      if (O.hp <= 0) {
        S.firstKillT = S.t;
        S.result = 'win';
        S.banner = S.opp.name + ' IS DOWN!';
        S.bannerT = 99;
        GB.sfx.winSting();
        setPhase('over');
      }
    } else {
      // miss
      if (y > 440) GB.fx.spawnDust(x, Math.max(y, 450), 6);
      else GB.fx.spawnShards(x, y, 'rgba(200,200,200,.9)', 4);
      if (Math.random() < 0.6) GB.sfx.ricochet();
    }
  }

  // ---------- drawing ----------
  function draw(ctx) {
    if (!S) return;
    const P = S.player, O = S.opp;

    GB.scene.draw(ctx, S.level, 1 / 60);

    // opponent
    GB.chars.draw(ctx, OPP.x, OPP.y, OPP.scale, O.cfg, {
      raise: O.raise, recoil: O.recoil, fall: O.fall, fallDir: 1,
      hurt: O.hurt, hatOff: !O.hatOn, breathe: S.t, headScale: S.oppHeadScale()
    });

    GB.fx.draw(ctx);
    drawPlayerGun(ctx);
    drawHolster(ctx);
    drawHud(ctx);
    drawMessages(ctx);

    // red pain vignette
    if (P.hitFlash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 560);
      g.addColorStop(0, 'rgba(160,20,10,0)');
      g.addColorStop(1, 'rgba(160,20,10,' + (P.hitFlash * 0.55) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (S.phase === 'over' && S.result === 'lose') {
      ctx.fillStyle = 'rgba(90,5,5,' + Math.min(0.5, S.phaseT * 0.3) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    drawCrosshair(ctx);
  }

  function drawPlayerGun(ctx) {
    // first-person revolver rising from the bottom-right on FIRE
    const P = S.player;
    const up = P.gunUp;
    if (up <= 0.01) return;
    const bx = W - 210, by = H + 130 - up * 150 + P.recoil * 26;
    const ang = -0.28 + (S.aim.x - bx) * 0.00028 - P.recoil * 0.18;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ang);
    // forearm
    ctx.fillStyle = P.cfg.shirt;
    GB.chars.rr(ctx, -28, 12, 60, 46, 16); ctx.fill();
    // hand
    ctx.fillStyle = P.cfg.skin;
    ctx.beginPath(); ctx.arc(10, 6, 20, 0, 7); ctx.fill();
    // revolver
    ctx.fillStyle = P.cfg.gun;
    GB.chars.rr(ctx, -6, -78, 22, 74, 8); ctx.fill();          // barrel
    ctx.fillStyle = GB.chars.shade(P.cfg.gun, 1.3);
    GB.chars.rr(ctx, -12, -22, 34, 30, 9); ctx.fill();          // cylinder
    ctx.fillStyle = GB.chars.shade(P.cfg.gun, 0.7);
    GB.chars.rr(ctx, -4, -86, 18, 10, 4); ctx.fill();           // sight
    // muzzle flash
    if (P.recoil > 0.55) {
      ctx.fillStyle = 'rgba(255,220,110,' + P.recoil + ')';
      ctx.beginPath();
      ctx.moveTo(5, -120); ctx.lineTo(-14, -86); ctx.lineTo(24, -86);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  function drawHolster(ctx) {
    const hz = HOLSTER;
    const active = S.phase === 'holster' || S.phase === 'countdown';
    if (!active && S.phase !== 'intro') return;
    ctx.save();
    ctx.globalAlpha = S.phase === 'intro' ? 0.5 : 1;
    // circle
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.r, 0, 7);
    ctx.fillStyle = S.inHolster ? 'rgba(224,165,46,.28)' : 'rgba(0,0,0,.42)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = S.inHolster ? '#e0a52e' : '#e8d5a3';
    ctx.setLineDash(S.inHolster ? [] : [10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    // holstered revolver icon
    ctx.save();
    ctx.translate(hz.x, hz.y + 4);
    ctx.rotate(0.5);
    ctx.fillStyle = '#3f2712';
    GB.chars.rr(ctx, -16, -26, 32, 44, 8); ctx.fill();
    ctx.fillStyle = S.player.cfg.gun;
    GB.chars.rr(ctx, -6, -34, 12, 20, 4); ctx.fill();
    ctx.beginPath(); ctx.arc(2, -32, 9, -3, 1.4); ctx.fill();
    ctx.restore();
    ctx.font = 'bold 13px Georgia';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8d5a3';
    ctx.fillText('HOLSTER', hz.x, hz.y + hz.r + 18);
    ctx.restore();
  }

  function drawHud(ctx) {
    const P = S.player, O = S.opp;
    // player plate (top-left)
    hudPlate(ctx, 16, 12, P.name, P.hp, P.maxHp, P.ammo, false, S.cheats.moreammo);
    // opponent plate (top-right)
    hudPlate(ctx, W - 286, 12, O.name, O.hp, O.maxHp, O.ammo, true, false);
    // level + score (top-center)
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Georgia';
    ctx.fillStyle = '#e8d5a3';
    ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 4;
    const lvl = 'LEVEL ' + S.level;
    ctx.strokeText(lvl, W / 2, 32);
    ctx.fillText(lvl, W / 2, 32);
    ctx.font = '14px Georgia';
    const sc = 'SCORE ' + S.opts.score;
    ctx.strokeText(sc, W / 2, 52);
    ctx.fillStyle = '#e0a52e';
    ctx.fillText(sc, W / 2, 52);
    if (S.cheats.any) {
      ctx.font = 'italic 11px Georgia';
      ctx.fillStyle = '#e0a52e';
      ctx.fillText('· CHEATS ON ·', W / 2, 68);
    }
  }

  function hudPlate(ctx, x, y, name, hp, maxHp, ammo, flip, infinite) {
    const w = 270, h = 58;
    ctx.fillStyle = 'rgba(20,10,4,.55)';
    GB.chars.rr(ctx, x, y, w, h, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(232,213,163,.4)'; ctx.lineWidth = 2;
    GB.chars.rr(ctx, x, y, w, h, 8); ctx.stroke();
    ctx.font = 'bold 14px Georgia';
    ctx.textAlign = flip ? 'right' : 'left';
    ctx.fillStyle = '#e8d5a3';
    ctx.fillText(name, flip ? x + w - 10 : x + 10, y + 19);
    // health bar
    const bw = w - 20, bh = 12, bx = x + 10, by = y + 26;
    ctx.fillStyle = '#2b1a0a';
    GB.chars.rr(ctx, bx, by, bw, bh, 4); ctx.fill();
    const frac = Math.max(0, hp / maxHp);
    if (frac > 0) {
      ctx.fillStyle = frac > 0.5 ? '#4f9c3f' : frac > 0.25 ? '#e0a52e' : '#c22c20';
      const fw = Math.max(4, bw * frac);
      GB.chars.rr(ctx, flip ? bx + bw - fw : bx, by, fw, bh, 4);
      ctx.fill();
    }
    // ammo pips
    ctx.fillStyle = '#e0a52e';
    if (infinite || ammo === Infinity) {
      ctx.font = 'bold 15px Georgia';
      ctx.textAlign = flip ? 'right' : 'left';
      ctx.fillText('∞ AMMO', flip ? x + w - 10 : x + 10, y + 53);
    } else {
      const n = Math.min(12, ammo);
      for (let i = 0; i < n; i++) {
        const px = flip ? x + w - 16 - i * 13 : x + 10 + i * 13;
        GB.chars.rr(ctx, px, y + 42, 7, 11, 3); ctx.fill();
      }
    }
  }

  function drawMessages(ctx) {
    ctx.textAlign = 'center';
    if (S.phase === 'intro') {
      const a = Math.min(1, S.phaseT * 2) * (S.phaseT > 1.6 ? Math.max(0, (2.0 - S.phaseT) / 0.4) : 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(20,10,4,.75)';
      ctx.fillRect(0, 190, W, 120);
      ctx.font = 'bold 30px Georgia';
      ctx.fillStyle = '#e8d5a3';
      ctx.fillText('LEVEL ' + S.level + ' OF ' + S.opts.totalLevels, W / 2, 238);
      ctx.font = 'bold 38px Georgia';
      ctx.fillStyle = '#e0a52e';
      ctx.fillText(S.opp.name, W / 2, 284);
      ctx.globalAlpha = 1;
    }
    if (S.phase === 'holster' && S.warnT <= 0) {
      pulseText(ctx, 'REST YOUR CURSOR ON THE HOLSTER', W / 2, 130, 20, '#e8d5a3');
    }
    if (S.warnT > 0) {
      pulseText(ctx, S.warn, W / 2, 130, 22, '#ff5040');
    }
    if (S.phase === 'countdown') {
      ctx.font = 'bold 110px Georgia';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(S.count, W / 2, 200);
      ctx.fillStyle = '#e8d5a3';
      ctx.fillText(S.count, W / 2, 200);
    }
    if (S.phase === 'fire' && S.phaseT < 0.8) {
      const sc = 1 + S.phaseT * 1.2;
      ctx.save();
      ctx.translate(W / 2, 190);
      ctx.scale(sc, sc);
      ctx.font = 'bold 84px Georgia';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText('FIRE!', 0, 0);
      ctx.fillStyle = '#c22c20';
      ctx.fillText('FIRE!', 0, 0);
      ctx.restore();
    }
    if (S.bannerT > 0 && S.phase === 'over') {
      ctx.font = 'bold 46px Georgia';
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(S.banner, W / 2, 180);
      ctx.fillStyle = S.result === 'win' ? '#e0a52e' : S.result === 'draw' ? '#e8d5a3' : '#ff5040';
      ctx.fillText(S.banner, W / 2, 180);
    }
  }

  function pulseText(ctx, text, x, y, size, color) {
    const a = 0.7 + Math.sin(S.t * 5) * 0.3;
    ctx.globalAlpha = a;
    ctx.font = 'bold ' + size + 'px Georgia';
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(0,0,0,.75)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }

  function drawCrosshair(ctx) {
    const { x, y } = S.aim;
    ctx.save();
    ctx.strokeStyle = S.phase === 'fire' ? '#ffd76b' : '#e8d5a3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, 7);
    ctx.moveTo(x - 18, y); ctx.lineTo(x - 5, y);
    ctx.moveTo(x + 5, y); ctx.lineTo(x + 18, y);
    ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 18);
    ctx.stroke();
    ctx.fillStyle = '#c22c20';
    ctx.beginPath(); ctx.arc(x, y, 2, 0, 7); ctx.fill();
    ctx.restore();
  }

  // ---------- input ----------
  function mouseMove(x, y) {
    if (!S) return;
    S.aim.x = x; S.aim.y = y;
    const dx = x - HOLSTER.x, dy = y - HOLSTER.y;
    S.inHolster = dx * dx + dy * dy <= HOLSTER.r * HOLSTER.r;
  }
  function mouseDown(x, y) {
    if (!S) return;
    playerShoot(x, y);
  }

  return {
    start, update, draw, mouseMove, mouseDown,
    get state() { return S; }
  };
})();
