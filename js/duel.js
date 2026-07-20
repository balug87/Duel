/* DUEL — side-view quick-draw duel, AI opponent, gore effects, scene rendering */
window.GB = window.GB || {};

// ---------- shared particle / tracer / stain / floating-text effects ----------
GB.fx = (function () {
  let parts = [];
  let texts = [];
  let pools = [];
  let gore = 'buckets';           // 'off' | 'classic' | 'buckets'
  let stain = null, stainCtx = null;

  function setGore(g) { gore = g || 'buckets'; }

  function initStains(w, h) {
    if (!stain) {
      stain = document.createElement('canvas');
      stain.width = w; stain.height = h;
      stainCtx = stain.getContext('2d');
    }
  }

  /** Gore-aware blood burst. dir = spray direction in radians. */
  function blood(x, y, base, dir) {
    if (gore === 'off') { spawnDust(x, y, 4); return; }
    const n = gore === 'buckets' ? Math.round(base * 2.4) : base;
    const big = gore === 'buckets';
    for (let i = 0; i < n; i++) {
      const a = (dir || 0) + (Math.random() - 0.5) * (big ? 1.6 : 2.2);
      const sp = 50 + Math.random() * (big ? 340 : 240);
      parts.push({
        type: 'blood', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (60 + Math.random() * 120),
        r: (big && Math.random() < 0.3 ? 3.5 : 1.3) + Math.random() * (big ? 3.6 : 2.6),
        life: 0.8 + Math.random() * 0.8,
        floor: 462 + Math.random() * 46,
        color: Math.random() < 0.5 ? '#a3231b' : '#7d0f0f'
      });
    }
  }
  const spawnBlood = (x, y, n, dir) => blood(x, y, n, dir);

  /** Slow ooze from an open wound. */
  function drip(x, y) {
    if (gore === 'off') return;
    parts.push({
      type: 'blood', x, y,
      vx: (Math.random() - 0.5) * 18, vy: 8 + Math.random() * 22,
      r: 1.2 + Math.random() * 2, life: 1.6,
      floor: 462 + Math.random() * 40,
      color: '#7d0f0f'
    });
  }

  /** Growing puddle stamped into the stain layer. */
  function pool(x, y, maxR) {
    if (gore === 'off' || !stainCtx) return;
    pools.push({ x, y, r: 4, maxR: (maxR || 34) * (gore === 'buckets' ? 1.4 : 1), rate: 16 });
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
  function tracer(x1, y1, x2, y2) {
    parts.push({ type: 'tracer', x: x1, y: y1, x2, y2, life: 0.09, max: 0.09 });
  }
  function flash(x, y, dir) {
    parts.push({ type: 'flash', x, y, dir, life: 0.07, max: 0.07 });
  }
  function spawnText(x, y, text, color, size) {
    texts.push({ x, y, text, color: color || '#fff', size: size || 20, life: 1.1 });
  }

  function update(dt) {
    for (const p of parts) {
      p.life -= dt;
      if (p.type === 'tracer' || p.type === 'flash') continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += (p.type === 'dust' ? 60 : 620) * dt;
      if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
      // blood that reaches the dirt stains it permanently
      if (p.type === 'blood' && p.vy > 0 && p.y >= p.floor) {
        if (stainCtx) {
          stainCtx.fillStyle = 'rgba(122,16,10,' + (0.25 + Math.random() * 0.3) + ')';
          stainCtx.beginPath();
          stainCtx.ellipse(p.x, p.y, p.r * (1.5 + Math.random() * 2), p.r * (0.5 + Math.random() * 0.6), 0, 0, 7);
          stainCtx.fill();
        }
        p.life = 0;
      }
    }
    parts = parts.filter(p => p.life > 0);
    for (const pl of pools) {
      if (pl.r < pl.maxR && stainCtx) {
        pl.r += pl.rate * dt;
        stainCtx.fillStyle = 'rgba(110,12,8,0.10)';
        stainCtx.beginPath();
        stainCtx.ellipse(pl.x, pl.y, pl.r, pl.r * 0.28, 0, 0, 7);
        stainCtx.fill();
      }
    }
    pools = pools.filter(pl => pl.r < pl.maxR);
    for (const t of texts) { t.life -= dt; t.y -= 46 * dt; }
    texts = texts.filter(t => t.life > 0);
  }

  function drawStains(ctx) { if (stain) ctx.drawImage(stain, 0, 0); }

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
      } else if (p.type === 'tracer') {
        ctx.globalAlpha = Math.max(0, p.life / p.max) * 0.85;
        ctx.strokeStyle = '#ffe9b0';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (p.type === 'flash') {
        const k = Math.max(0, p.life / p.max);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.dir);
        ctx.globalAlpha = k;
        ctx.fillStyle = '#ffd76b';
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(26, -7); ctx.lineTo(38, 0); ctx.lineTo(26, 7);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.beginPath(); ctx.arc(4, 0, 6, 0, 7); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
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

  function clear() {
    parts = []; texts = []; pools = [];
    if (stainCtx) stainCtx.clearRect(0, 0, stain.width, stain.height);
  }

  return { setGore, initStains, blood, spawnBlood, drip, pool, spawnDust, spawnShards,
           spawnHat, tracer, flash, spawnText, update, draw, drawStains, clear };
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
    // open dueling street across the middle
    c.fillStyle = p.street;
    c.beginPath();
    c.moveTo(40, H); c.lineTo(150, 400); c.lineTo(820, 400); c.lineTo(940, H);
    c.closePath(); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.12)';
    c.lineWidth = 6;
    c.beginPath(); c.moveTo(330, 410); c.lineTo(290, H); c.moveTo(660, 410); c.lineTo(720, H); c.stroke();

    drawSaloon(c, 250, 398, p);
    drawStore(c, 530, 398, p);
    drawCactus(c, 210, 420, 0.7);
    drawCactus(c, 800, 425, 0.8);
    // hitching rail
    c.strokeStyle = '#4b3a22';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(490, 420); c.lineTo(490, 398); c.moveTo(540, 420); c.lineTo(540, 398);
    c.moveTo(483, 401); c.lineTo(547, 401);
    c.stroke();
    // skull
    c.fillStyle = '#e8e2d2';
    c.beginPath(); c.arc(430, 505, 8, 0, 7); c.fill();
    c.fillRect(424, 508, 12, 6);
    c.fillStyle = p.sand;
    c.beginPath(); c.arc(427, 504, 2, 0, 7); c.arc(433, 504, 2, 0, 7); c.fill();

    // long duel shadows
    c.fillStyle = 'rgba(40,20,5,.18)';
    c.beginPath(); c.ellipse(150, 476, 66, 9, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(815, 476, 66, 9, 0, 0, 7); c.fill();

    if (p.night) { c.fillStyle = 'rgba(10,14,40,.32)'; c.fillRect(0, 0, W, H); }
    return cv;
  }

  function drawSaloon(c, x, gy, p) {
    const w = 190, h = 130;
    c.fillStyle = '#6b4a2a';
    c.fillRect(x, gy - h, w, h);
    c.fillStyle = '#7c5a34';
    c.fillRect(x - 6, gy - h - 24, w + 12, 30);
    c.fillStyle = '#4b3a22';
    for (let i = 0; i < 5; i++) c.fillRect(x + 8 + i * 36, gy - h, 3, h);
    c.fillStyle = '#2b1a0a';
    c.fillRect(x + 26, gy - h - 18, w - 52, 22);
    c.fillStyle = '#e0a52e';
    c.font = 'bold 15px Georgia';
    c.textAlign = 'center';
    c.fillText('S A L O O N', x + w / 2, gy - h - 1);
    c.fillStyle = '#54381e';
    c.fillRect(x - 8, gy - 76, w + 16, 9);
    c.strokeStyle = '#3f2712'; c.lineWidth = 5;
    c.beginPath();
    c.moveTo(x + 10, gy - 67); c.lineTo(x + 10, gy);
    c.moveTo(x + w - 10, gy - 67); c.lineTo(x + w - 10, gy);
    c.stroke();
    c.fillStyle = p.night ? '#e8c06b' : '#2b1a0a';
    c.fillRect(x + 78, gy - 56, 36, 56);
    c.fillStyle = '#8c6238';
    c.fillRect(x + 76, gy - 50, 18, 30);
    c.fillRect(x + 98, gy - 50, 18, 30);
    c.fillStyle = p.night ? '#e8c06b' : '#96c6e0';
    c.fillRect(x + 20, gy - 54, 30, 27);
    c.fillRect(x + 142, gy - 54, 30, 27);
    c.strokeStyle = '#2b1a0a'; c.lineWidth = 3;
    c.strokeRect(x + 20, gy - 54, 30, 27);
    c.strokeRect(x + 142, gy - 54, 30, 27);
  }

  function drawStore(c, x, gy, p) {
    const w = 210, h = 115;
    c.fillStyle = '#8c6238';
    c.fillRect(x, gy - h, w, h);
    c.fillStyle = '#a3764a';
    c.beginPath();
    c.moveTo(x - 8, gy - h); c.lineTo(x + w / 2, gy - h - 34); c.lineTo(x + w + 8, gy - h);
    c.closePath(); c.fill();
    c.fillStyle = '#4b3a22';
    for (let i = 0; i < 6; i++) c.fillRect(x + 6 + i * 34, gy - h, 3, h);
    c.fillStyle = '#2b1a0a';
    c.fillRect(x + 24, gy - 86, w - 48, 20);
    c.fillStyle = '#e8d5a3';
    c.font = 'bold 13px Georgia';
    c.textAlign = 'center';
    c.fillText('GENERAL STORE', x + w / 2, gy - 71);
    c.fillStyle = p.night ? '#e8c06b' : '#96c6e0';
    c.fillRect(x + 28, gy - 52, 32, 30);
    c.fillRect(x + 150, gy - 52, 32, 30);
    c.strokeStyle = '#2b1a0a'; c.lineWidth = 3;
    c.strokeRect(x + 28, gy - 52, 32, 30);
    c.strokeRect(x + 150, gy - 52, 32, 30);
    c.fillStyle = '#2b1a0a';
    c.fillRect(x + 90, gy - 58, 30, 58);
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
    tumbleX += 55 * dt; tumbleR += 3.2 * dt;
    if (tumbleX > W + 120) tumbleX = -120;
    ctx.save();
    ctx.translate(tumbleX, 452 + Math.abs(Math.sin(tumbleR * 1.5)) * -10);
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

// ---------- the duel itself (side view) ----------
GB.Duel = (function () {
  const W = 960, H = 540;
  const PL = { x: 115, y: 470, scale: 1.35, facing: 1 };
  const OP = { x: 845, y: 470, scale: 1.35, facing: -1 };
  const COUNT_STEP = 0.75;

  let S = null;

  function restZone() {
    // circle around the player's holstered revolver (arm hanging, raise = 0)
    const m = GB.chars.sideMuzzlePoint(PL.x, PL.y, PL.scale, PL.facing, 0);
    const sh = { x: PL.x + 2 * PL.scale, y: PL.y - 128 * PL.scale };
    return { x: (m.x + sh.x) / 2 + 8, y: (m.y + sh.y) / 2 + 14, r: 50 };
  }

  function start(opts) {
    const st = opts.settings, ch = opts.cheats;
    GB.fx.setGore(st.gore);
    GB.fx.initStains(W, H);
    S = {
      opts, phase: 'intro', t: 0, phaseT: 0,
      level: opts.level,
      count: 3, countT: 0, inHolster: false,
      warn: '', warnT: 0,
      fireT: 0, firstKillT: 0,
      banner: '', bannerT: 0,
      rest: restZone(),
      player: {
        name: opts.player.name, cfg: opts.player.cfg,
        hp: st.health, maxHp: st.health,
        ammo: st.ammo === 0 ? Infinity : st.ammo,
        shots: 0, hitsLanded: 0, cooldown: 0, hitFlash: 0,
        raise: 0, recoil: 0, fall: 0, hurt: 0, wounds: [], dripT: 0
      },
      opp: {
        def: opts.oppDef, cfg: opts.oppDef.cfg, name: opts.oppDef.name,
        hp: st.health, maxHp: st.health,
        ammo: st.ammo === 0 ? Infinity : st.ammo,
        raise: 0, recoil: 0, fall: 0, hurt: 0, hatOn: true, wounds: [], dripT: 0,
        nextShot: 0
      },
      aim: { x: W / 2, y: H / 2 },
      result: null, ended: false,
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
    if (st.damageModel === 'uniform') return { part: 'torso', dmg: 25 };
    const r = Math.random();
    if (r < 0.10) return { part: 'head', dmg: st.oneShotHead ? 9999 : 55 };
    if (r < 0.55) return { part: 'torso', dmg: 30 };
    if (r < 0.80) return { part: 'arm', dmg: 20 };
    return { part: 'legs', dmg: 15 };
  }

  function oppDamageFor(part) {
    const st = S.settings;
    if (S.cheats.oneshot) return 9999;
    if (st.damageModel === 'uniform') return 25;
    switch (part) {
      case 'head': return st.oneShotHead ? 9999 : 60;
      case 'torso': return 34;
      case 'arm': return 22;
      default: return 18;
    }
  }

  /** Record a wound decal on an entity in its local (unmirrored) coords. */
  function addWound(ent, geo, px, py) {
    if (S.settings.gore === 'off') return;
    ent.wounds.push({
      dx: (px - geo.x) / geo.scale * geo.facing,
      dy: (py - geo.y) / geo.scale,
      drip: Math.random() * 6
    });
  }

  function woundWorld(ent, geo) {
    const w = ent.wounds[(Math.random() * ent.wounds.length) | 0];
    return { x: geo.x + w.dx * geo.scale * geo.facing, y: geo.y + w.dy * geo.scale };
  }

  function update(dt) {
    if (!S) return;
    S.t += dt; S.phaseT += dt;
    const P = S.player, O = S.opp;

    P.cooldown = Math.max(0, P.cooldown - dt);
    P.hitFlash = Math.max(0, P.hitFlash - dt * 2.2);
    P.recoil = Math.max(0, P.recoil - dt * 6);
    P.hurt = Math.max(0, P.hurt - dt * 3);
    O.recoil = Math.max(0, O.recoil - dt * 5);
    O.hurt = Math.max(0, O.hurt - dt * 3);
    S.warnT = Math.max(0, S.warnT - dt);
    S.bannerT = Math.max(0, S.bannerT - dt);

    // open wounds keep bleeding
    for (const [ent, geo] of [[P, PL], [O, OP]]) {
      if (ent.wounds.length > 0 && ent.hp > 0) {
        ent.dripT -= dt;
        if (ent.dripT <= 0) {
          ent.dripT = 0.16 + Math.random() * 0.2;
          const w = woundWorld(ent, geo);
          GB.fx.drip(w.x, w.y);
        }
      }
    }

    if (S.phase === 'intro') {
      if (S.phaseT > 2.0) setPhase('holster');
    } else if (S.phase === 'holster') {
      P.raise = Math.max(0, P.raise - dt * 4);
      if (S.inHolster) { setPhase('countdown'); S.count = 3; S.countT = 0; GB.sfx.tick(); }
    } else if (S.phase === 'countdown') {
      if (!S.inHolster) {
        setPhase('holster');
        S.warn = 'TOO SOON! KEEP YOUR CURSOR ON YOUR REVOLVER'; S.warnT = 1.6;
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
      if (P.hp > 0) P.raise = Math.min(1, P.raise + dt * 7);
      if (O.hp > 0 && P.hp > 0) {
        const untilShot = O.nextShot - S.t;
        if (untilShot < 0.18 && O.ammo > 0) O.raise = Math.min(1, O.raise + dt * 9);
        if (S.t >= O.nextShot && O.ammo > 0) {
          O.ammo--;
          O.recoil = 1;
          GB.sfx.enemyShot();
          const m = GB.chars.sideMuzzlePoint(OP.x, OP.y, OP.scale, OP.facing, O.raise);
          GB.fx.flash(m.x, m.y, Math.PI);
          if (Math.random() < S.accuracy && !S.cheats.nohit) {
            const roll = playerDamageRoll();
            const hit = GB.chars.sidePointIn(PL.x, PL.y, PL.scale, PL.facing, roll.part);
            GB.fx.tracer(m.x, m.y, hit.x, hit.y);
            GB.fx.blood(hit.x, hit.y, roll.part === 'head' ? 34 : 20, Math.PI - 0.35);
            addWound(P, PL, hit.x, hit.y);
            P.hp = Math.max(0, P.hp - roll.dmg);
            P.hitFlash = 1;
            P.hurt = 1;
            GB.sfx.fleshHit();
            GB.fx.spawnText(hit.x, hit.y - 40, '-' + Math.min(roll.dmg, P.maxHp) + (roll.part === 'head' ? '  HEAD!' : ''), '#ff5040', 22);
            if (P.hp <= 0) return playerDown();
          } else {
            const missY = 300 + Math.random() * 170;
            GB.fx.tracer(m.x, m.y, -30, missY);
            GB.sfx.ricochet();
            GB.fx.spawnDust(30 + Math.random() * 120, 460 + Math.random() * 40, 5);
          }
          O.nextShot = S.t + (S.interval * (0.8 + Math.random() * 0.4)) / 1000;
        }
      }
      if (P.hp > 0 && O.hp > 0 && P.ammo <= 0 && O.ammo <= 0 && S.phaseT > 1) {
        S.result = 'draw';
        S.banner = 'DRAW!'; S.bannerT = 99;
        GB.sfx.drawSting();
        setPhase('over');
      }
    } else if (S.phase === 'over') {
      const downed = S.result === 'win' ? O : S.result === 'lose' ? P : null;
      const geo = S.result === 'win' ? OP : PL;
      if (downed && downed.fall < 1) {
        downed.fall = Math.min(1, downed.fall + dt * 1.7);
        if (downed.fall >= 1) {
          GB.fx.spawnDust(geo.x, geo.y, 14, true);
          GB.sfx.fall();
          GB.fx.pool(geo.x + geo.facing * 40, geo.y + 4, 40);
        }
      }
      if (!S.ended && S.phaseT > 2.3) {
        S.ended = true;
        S.opts.onEnd({
          result: S.result,
          timeToKill: S.firstKillT ? (S.firstKillT - S.fireT) : 0,
          shots: S.player.shots, hits: S.player.hitsLanded,
          hpLeft: S.player.hp, maxHp: S.player.maxHp
        });
      }
    }

    GB.fx.update(dt);
  }

  function playerDown() {
    S.result = 'lose';
    S.player.fall = 0.001;
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
    P.raise = 1;
    GB.sfx.gunshot();
    const m = GB.chars.sideMuzzlePoint(PL.x, PL.y, PL.scale, PL.facing, 1);
    GB.fx.flash(m.x, m.y, Math.atan2(y - m.y, x - m.x));
    GB.fx.tracer(m.x, m.y, x, y);

    if (O.hp <= 0) return;

    const part = GB.chars.sideHitTest(OP.x, OP.y, OP.scale, OP.facing, S.oppHeadScale(), O.hatOn, x, y);
    if (part === 'hat') {
      O.hatOn = false;
      GB.fx.spawnHat(x, y, O.cfg.hat, 1);
      GB.fx.spawnText(x, y - 20, 'HAT TRICK! +50', '#e0a52e', 18);
      GB.sfx.ricochet();
      S.opts.onHatShot && S.opts.onHatShot();
    } else if (part) {
      P.hitsLanded++;
      const dmg = oppDamageFor(part);
      O.hp = Math.max(0, O.hp - dmg);
      O.hurt = 1;
      GB.fx.blood(x, y, part === 'head' ? 34 : 20, -0.35);
      addWound(O, OP, x, y);
      GB.sfx.fleshHit();
      GB.fx.spawnText(x, y - 30, part === 'head' ? 'HEADSHOT!' : '-' + dmg, part === 'head' ? '#ffd76b' : '#fff', part === 'head' ? 22 : 18);
      if (O.hp <= 0) {
        S.firstKillT = S.t;
        S.result = 'win';
        S.banner = S.opp.name + ' IS DOWN!';
        S.bannerT = 99;
        GB.sfx.winSting();
        setPhase('over');
      }
    } else {
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
    GB.fx.drawStains(ctx);

    // fallDir tips the body toward the middle of the street so it stays on screen
    GB.chars.drawSide(ctx, PL.x, PL.y, PL.scale, P.cfg, {
      facing: PL.facing, raise: P.raise, recoil: P.recoil,
      fall: P.fall, fallDir: 1, hurt: P.hurt, breathe: S.t, wounds: P.wounds
    });
    GB.chars.drawSide(ctx, OP.x, OP.y, OP.scale, O.cfg, {
      facing: OP.facing, raise: O.raise, recoil: O.recoil,
      fall: O.fall, fallDir: -1, hurt: O.hurt, hatOff: !O.hatOn,
      breathe: S.t + 1.7, headScale: S.oppHeadScale(), wounds: O.wounds
    });

    GB.fx.draw(ctx);
    drawRest(ctx);
    drawHud(ctx);
    drawMessages(ctx);

    if (P.hitFlash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 560);
      g.addColorStop(0, 'rgba(160,20,10,0)');
      g.addColorStop(1, 'rgba(160,20,10,' + (P.hitFlash * 0.4) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (S.phase === 'over' && S.result === 'lose') {
      ctx.fillStyle = 'rgba(90,5,5,' + Math.min(0.4, S.phaseT * 0.25) + ')';
      ctx.fillRect(0, 0, W, H);
    }

    drawCrosshair(ctx);
  }

  function drawRest(ctx) {
    const active = S.phase === 'holster' || S.phase === 'countdown';
    if (!active && S.phase !== 'intro') return;
    const rz = S.rest;
    ctx.save();
    ctx.globalAlpha = S.phase === 'intro' ? 0.45 : 1;
    const pulse = 1 + Math.sin(S.t * 5) * 0.04;
    ctx.beginPath();
    ctx.arc(rz.x, rz.y, rz.r * pulse, 0, 7);
    ctx.fillStyle = S.inHolster ? 'rgba(224,165,46,.22)' : 'rgba(0,0,0,.3)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = S.inHolster ? '#e0a52e' : '#e8d5a3';
    ctx.setLineDash(S.inHolster ? [] : [10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = 'bold 13px Georgia';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8d5a3';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    ctx.strokeText('HOLSTER', rz.x, rz.y + rz.r + 20);
    ctx.fillText('HOLSTER', rz.x, rz.y + rz.r + 20);
    ctx.restore();
  }

  function drawHud(ctx) {
    const P = S.player, O = S.opp;
    drawHealthBar(ctx, 18, 16, P.name, P.hp, P.maxHp, false);
    drawHealthBar(ctx, W - 318, 16, O.name, O.hp, O.maxHp, true);
    drawCylinder(ctx, 64, H - 58, P.ammo, S.cheats.moreammo);
    drawCylinder(ctx, W - 64, H - 58, O.ammo, false);

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

  function drawHealthBar(ctx, x, y, name, hp, maxHp, flip) {
    const w = 300, h = 20;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    GB.chars.rr(ctx, x, y, w, h, 4); ctx.fill();
    const frac = Math.max(0, hp / maxHp);
    if (frac > 0) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      if (flip) {
        g.addColorStop(0, '#c22c20'); g.addColorStop(0.5, '#e0c02e'); g.addColorStop(1, '#4f9c3f');
      } else {
        g.addColorStop(0, '#4f9c3f'); g.addColorStop(0.5, '#e0c02e'); g.addColorStop(1, '#c22c20');
      }
      ctx.fillStyle = g;
      const fw = Math.max(3, (w - 4) * frac);
      GB.chars.rr(ctx, flip ? x + 2 + (w - 4) - fw : x + 2, y + 2, fw, h - 4, 3);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(30,15,5,.8)'; ctx.lineWidth = 2;
    GB.chars.rr(ctx, x, y, w, h, 4); ctx.stroke();
    ctx.font = 'bold 13px Georgia';
    ctx.textAlign = flip ? 'right' : 'left';
    ctx.fillStyle = '#e8d5a3';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,.7)';
    const nx = flip ? x + w : x;
    ctx.strokeText(name, nx, y + h + 16);
    ctx.fillText(name, nx, y + h + 16);
  }

  function drawCylinder(ctx, cx, cy, ammo, infinite) {
    const R = 32;
    // steel face
    const g = ctx.createRadialGradient(cx - 8, cy - 8, 4, cx, cy, R);
    g.addColorStop(0, '#dcdfe3'); g.addColorStop(0.7, '#9ba0a8'); g.addColorStop(1, '#5c6068');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(20,20,25,.8)'; ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#43464c';
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill();
    if (infinite || ammo === Infinity) {
      ctx.font = 'bold 26px Georgia';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2b1a0a';
      ctx.fillText('∞', cx, cy + 9);
      return;
    }
    const n = Math.min(6, Math.max(0, ammo));
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const hx = cx + Math.cos(a) * 19, hy = cy + Math.sin(a) * 19;
      if (i < n) {           // loaded: brass with primer
        ctx.fillStyle = '#c8a13e';
        ctx.beginPath(); ctx.arc(hx, hy, 8.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#8f7124';
        ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, 7); ctx.fill();
      } else {               // spent: empty chamber
        ctx.fillStyle = '#1c1e22';
        ctx.beginPath(); ctx.arc(hx, hy, 8.5, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    if (ammo > 6) {
      ctx.font = 'bold 12px Georgia';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e8d5a3';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText('+' + (ammo - 6), cx, cy - R - 6);
      ctx.fillText('+' + (ammo - 6), cx, cy - R - 6);
    }
  }

  function drawMessages(ctx) {
    ctx.textAlign = 'center';
    if (S.phase === 'intro') {
      const a = Math.min(1, S.phaseT * 2) * (S.phaseT > 1.6 ? Math.max(0, (2.0 - S.phaseT) / 0.4) : 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(20,10,4,.75)';
      ctx.fillRect(0, 150, W, 120);
      ctx.font = 'bold 30px Georgia';
      ctx.fillStyle = '#e8d5a3';
      ctx.fillText('LEVEL ' + S.level + ' OF ' + S.opts.totalLevels, W / 2, 198);
      ctx.font = 'bold 38px Georgia';
      ctx.fillStyle = '#e0a52e';
      ctx.fillText(S.opp.name, W / 2, 244);
      ctx.globalAlpha = 1;
    }
    if (S.phase === 'holster' && S.warnT <= 0) {
      pulseText(ctx, 'REST YOUR CURSOR ON YOUR REVOLVER', W / 2, 120, 20, '#e8d5a3');
    }
    if (S.warnT > 0) {
      pulseText(ctx, S.warn, W / 2, 120, 22, '#ff5040');
    }
    if (S.phase === 'countdown') {
      ctx.font = 'bold 110px Georgia';
      ctx.lineWidth = 8;
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.strokeText(S.count, W / 2, 190);
      ctx.fillStyle = '#e8d5a3';
      ctx.fillText(S.count, W / 2, 190);
    }
    if (S.phase === 'fire' && S.phaseT < 0.8) {
      const sc = 1 + S.phaseT * 1.2;
      ctx.save();
      ctx.translate(W / 2, 180);
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
      ctx.strokeText(S.banner, W / 2, 170);
      ctx.fillStyle = S.result === 'win' ? '#e0a52e' : S.result === 'draw' ? '#e8d5a3' : '#ff5040';
      ctx.fillText(S.banner, W / 2, 170);
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
    const dx = x - S.rest.x, dy = y - S.rest.y;
    S.inHolster = dx * dx + dy * dy <= S.rest.r * S.rest.r;
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
