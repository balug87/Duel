/* DUEL — side-view quick-draw duel, AI opponent, gore effects, scene rendering */
window.GB = window.GB || {};

// ---------- shared trajectory math (ray-cast aiming) ----------
GB.geom = (function () {
  function norm(dx, dy) {
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  }

  /**
   * March a ray from (mx,my) through (cx,cy) and beyond, stopping at the
   * first point testFn() reports a hit for, the ground plane, or the edge
   * of the screen. Aiming only depends on the muzzle->cursor line, not the
   * cursor's exact position — the bullet keeps travelling past the cursor.
   */
  function castRay(mx, my, cx, cy, testFn, defaultDir, groundY) {
    const GY = groundY || 478;
    let dx = cx - mx, dy = cy - my;
    const len = Math.hypot(dx, dy);
    if (len < 2) { dx = (defaultDir && defaultDir.x) || 1; dy = (defaultDir && defaultDir.y) || 0; }
    else { dx /= len; dy /= len; }
    const STEP = 6, MAX = 1700;
    let px = mx, py = my;
    for (let t = STEP; t < MAX; t += STEP) {
      const nx = mx + dx * t, ny = my + dy * t;
      // only counts as a ground hit if the ray crosses the plane from above —
      // a muzzle that already starts at/below it (e.g. a corner prop) can still fire
      if (py < GY && ny >= GY) {
        const frac = (GY - py) / ((ny - py) || 1);
        return { hit: 'ground', x: px + (nx - px) * frac, y: GY };
      }
      if (nx < -60 || nx > 1020 || ny < -90 || ny > 640) return { hit: null, x: nx, y: ny };
      const r = testFn(nx, ny);
      if (r) return { hit: r, x: nx, y: ny };
      px = nx; py = ny;
    }
    return { hit: null, x: mx + dx * MAX, y: my + dy * MAX };
  }

  return { norm, castRay };
})();

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

  /** Chunks of flesh/cloth/bone stripped out on impact. dir = spray direction in radians. */
  function gibs(x, y, n, dir, colors) {
    if (gore === 'off') return;
    const mult = gore === 'buckets' ? 1.8 : 1;
    const count = Math.max(1, Math.round(n * mult));
    for (let i = 0; i < count; i++) {
      const a = (dir || 0) + (Math.random() - 0.5) * 2.0;
      const sp = 90 + Math.random() * 260;
      parts.push({
        type: 'gib', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (100 + Math.random() * 140),
        w: 3 + Math.random() * 5, h: 2.5 + Math.random() * 4,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16,
        life: 0.9 + Math.random() * 0.7,
        floor: 460 + Math.random() * 50,
        color: colors[(Math.random() * colors.length) | 0]
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
      // fallen chunks leave a stamped smear too
      if (p.type === 'gib' && p.vy > 0 && p.y >= p.floor) {
        if (stainCtx) {
          stainCtx.save();
          stainCtx.translate(p.x, p.y);
          stainCtx.rotate(p.rot);
          stainCtx.fillStyle = p.color;
          stainCtx.globalAlpha = 0.8;
          stainCtx.fillRect(-p.w, -p.h * 0.6, p.w * 2, p.h * 1.2);
          stainCtx.restore();
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
      } else if (p.type === 'gib') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        GB.chars.rr(ctx, -p.w, -p.h, p.w * 2, p.h * 2, Math.min(p.w, p.h) * 0.6);
        ctx.fill();
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

  return { setGore, initStains, blood, spawnBlood, drip, pool, gibs, spawnDust, spawnShards,
           spawnHat, tracer, flash, spawnText, update, draw, drawStains, clear,
           debugCounts: () => ({ parts: parts.length, gibs: parts.filter(p => p.type === 'gib').length, pools: pools.length }) };
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
  const AMMO_HUD = { x: 64, y: H - 58 };

  let S = null;

  function restZone() {
    // circle on the ammo cylinder HUD icon — the revolver showing the bullets
    return { x: AMMO_HUD.x, y: AMMO_HUD.y, r: 40 };
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

  const GIB_BONE = '#e8e2d2';
  function gibColors(cfg) { return ['#8c1f16', '#a3231b', cfg.shirt, GIB_BONE]; }

  // ================= basic ragdoll physics (Verlet) =================
  // Local (unscaled, facing=+1) anatomy points matching drawSide's proportions.
  const RAG_LOCAL = {
    head:   { x: 4,    y: -160 },
    neck:   { x: 2,    y: -140 },
    pelvis: { x: 0,    y: -80  },
    kneeB:  { x: -7.5, y: -45  },
    footB:  { x: -7.5, y: -8   },
    kneeF:  { x: 7.5,  y: -45  },
    footF:  { x: 7.5,  y: -8   },
    handF:  { x: -9,   y: -90  }
  };
  const RAG_LINKS = [
    ['head', 'neck'], ['neck', 'pelvis'], ['neck', 'handF'], ['neck', 'handG'],
    ['pelvis', 'kneeB'], ['kneeB', 'footB'], ['pelvis', 'kneeF'], ['kneeF', 'footF']
  ];
  const HIT_TO_POINT = { head: 'head', torso: 'neck', arm: 'handG', legs: 'footF', hat: 'head' };

  function localToWorld(geo, lx, ly) {
    return { x: geo.x + lx * geo.scale * geo.facing, y: geo.y + ly * geo.scale };
  }

  /** Seed a ragdoll from the standing pose at the moment of death. dirX/dirY = unit bullet direction. */
  function makeRagdoll(geo, cfg, hatOn, raiseAtDeath, dirX, dirY, hitPart) {
    const pts = {};
    for (const k in RAG_LOCAL) {
      const w = localToWorld(geo, RAG_LOCAL[k].x, RAG_LOCAL[k].y);
      pts[k] = { x: w.x, y: w.y, px: w.x, py: w.y };
    }
    const hand = GB.chars.sideHandPoint(geo.x, geo.y, geo.scale, geo.facing, raiseAtDeath || 0);
    pts.handG = { x: hand.x, y: hand.y, px: hand.x, py: hand.y };

    // body-wide stagger in the direction the bullet was travelling
    for (const k in pts) {
      pts[k].px -= dirX * 9 + (Math.random() - 0.5) * 4;
      pts[k].py -= dirY * 9 + (Math.random() - 0.5) * 4;
    }
    // the point that actually took the hit gets flung much harder
    const hitPt = pts[HIT_TO_POINT[hitPart] || 'neck'];
    if (hitPt) {
      hitPt.px -= dirX * 58;
      hitPt.py -= dirY * 58 - 34;
    }

    const links = RAG_LINKS.map(([a, b]) => {
      const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y;
      return { a, b, len: Math.hypot(dx, dy) };
    });

    return { pts, links, cfg, hatOn, anchorX: geo.x, age: 0, settle: 0, poolSpawned: false };
  }

  function stepRagdoll(rag, dt) {
    rag.age += dt;
    if (rag.age > 1.3) return; // basic physics settles fast, then the pose freezes rather than fully unfolding
    const GRAV = 1500, GROUND = 476, FRICTION = 0.4, DAMP = 0.9;
    for (const k in rag.pts) {
      const p = rag.pts[k];
      const vx = (p.x - p.px) * DAMP, vy = (p.y - p.py) * DAMP;
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + GRAV * dt * dt;
    }
    for (let iter = 0; iter < 6; iter++) {
      for (const l of rag.links) {
        const a = rag.pts[l.a], b = rag.pts[l.b];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const diff = (dist - l.len) / dist * 0.5;
        const ox = dx * diff, oy = dy * diff;
        a.x += ox; a.y += oy;
        b.x -= ox; b.y -= oy;
      }
    }
    let moving = 0;
    for (const k in rag.pts) {
      const p = rag.pts[k];
      if (p.y > GROUND) {
        p.y = GROUND;
        const vx = p.x - p.px;
        p.px = p.x - vx * FRICTION;
        p.py = p.y;
      }
      // a basic ragdoll shouldn't wander — keep the pile roughly where it fell
      if (p.x > rag.anchorX + 180) { p.x = rag.anchorX + 180; p.px = p.x; }
      if (p.x < rag.anchorX - 180) { p.x = rag.anchorX - 180; p.px = p.x; }
      moving += Math.abs(p.x - p.px) + Math.abs(p.y - p.py);
    }
    rag.settle = moving < 0.6 ? rag.settle + dt : 0;
  }

  function ragLine(ctx, a, b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  function ragDot(ctx, a, r) { ctx.beginPath(); ctx.arc(a.x, a.y, r, 0, 7); ctx.fill(); }

  function drawRagdoll(ctx, rag) {
    const cfg = rag.cfg, p = rag.pts;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // far leg + far arm first (behind the torso)
    ctx.strokeStyle = GB.chars.shade(cfg.pants, 0.8); ctx.lineWidth = 13;
    ragLine(ctx, p.pelvis, p.kneeB); ragLine(ctx, p.kneeB, p.footB);
    ctx.strokeStyle = GB.chars.shade(cfg.shirt, 0.72); ctx.lineWidth = 11;
    ragLine(ctx, p.neck, p.handF);
    // torso
    ctx.strokeStyle = cfg.shirt; ctx.lineWidth = 22;
    ragLine(ctx, p.neck, p.pelvis);
    ctx.strokeStyle = cfg.vest; ctx.lineWidth = 10;
    ragLine(ctx, p.neck, p.pelvis);
    // near leg + gun arm
    ctx.strokeStyle = cfg.pants; ctx.lineWidth = 13;
    ragLine(ctx, p.pelvis, p.kneeF); ragLine(ctx, p.kneeF, p.footF);
    ctx.strokeStyle = GB.chars.shade(cfg.shirt, 0.92); ctx.lineWidth = 11;
    ragLine(ctx, p.neck, p.handG);
    // boots + hands
    ctx.fillStyle = GB.chars.shade(cfg.pants, 0.5);
    ragDot(ctx, p.footB, 8); ragDot(ctx, p.footF, 8);
    ctx.fillStyle = cfg.skin;
    ragDot(ctx, p.handF, 6.5); ragDot(ctx, p.handG, 6.5);
    // head, oriented along the neck->head bone
    const ang = Math.atan2(p.head.y - p.neck.y, p.head.x - p.neck.x);
    ctx.save();
    ctx.translate(p.head.x, p.head.y);
    ctx.rotate(ang + Math.PI / 2);
    ctx.fillStyle = cfg.skin;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.fill();
    ctx.fillStyle = cfg.hair;
    ctx.beginPath(); ctx.arc(0, 2, 15, Math.PI * 0.15, Math.PI * 0.95); ctx.fill();
    if (rag.hatOn) {
      ctx.fillStyle = cfg.hat;
      ctx.beginPath(); ctx.ellipse(0, -2, 20, 7, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -11, 9, 8, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
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
        S.warn = 'TOO SOON! KEEP YOUR CURSOR ON THE CYLINDER'; S.warnT = 1.6;
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
            const dir = GB.geom.norm(hit.x - m.x, hit.y - m.y);
            const angle = Math.atan2(dir.y, dir.x);
            GB.fx.tracer(m.x, m.y, hit.x, hit.y);
            GB.fx.blood(hit.x, hit.y, roll.part === 'head' ? 34 : 20, angle);
            GB.fx.gibs(hit.x, hit.y, roll.part === 'head' ? 8 : 4, angle, gibColors(P.cfg));
            addWound(P, PL, hit.x, hit.y);
            P.hp = Math.max(0, P.hp - roll.dmg);
            P.hitFlash = 1;
            P.hurt = 1;
            GB.sfx.fleshHit();
            GB.fx.spawnText(hit.x, hit.y - 40, '-' + Math.min(roll.dmg, P.maxHp) + (roll.part === 'head' ? '  HEAD!' : ''), '#ff5040', 22);
            if (P.hp <= 0) { S.deathDir = dir; S.deathPart = roll.part; return playerDown(); }
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
      if (S.ragdoll) {
        const rag = S.ragdoll.player || S.ragdoll.opp;
        stepRagdoll(rag, dt);
        if (!rag.poolSpawned && (rag.settle > 0.4 || rag.age > 1.0)) {
          rag.poolSpawned = true;
          GB.fx.pool(rag.pts.pelvis.x, rag.pts.pelvis.y, 40);
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
    const dir = S.deathDir || { x: -1, y: -0.1 };
    S.ragdoll = { player: makeRagdoll(PL, S.player.cfg, true, S.player.raise, dir.x, dir.y, S.deathPart) };
    GB.sfx.fall();
    GB.fx.spawnDust(PL.x, PL.y, 10, true);
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

    // aiming depends only on the straight line from the barrel through the cursor —
    // the bullet keeps travelling along that line, it doesn't teleport to the cursor
    const m = GB.chars.sideMuzzlePoint(PL.x, PL.y, PL.scale, PL.facing, 1);
    const ray = GB.geom.castRay(m.x, m.y, x, y, (px, py) => {
      if (O.hp > 0) {
        return GB.chars.sideHitTest(OP.x, OP.y, OP.scale, OP.facing, S.oppHeadScale(), O.hatOn, px, py);
      }
      if (S.ragdoll && S.ragdoll.opp) {
        for (const k in S.ragdoll.opp.pts) {
          const pt = S.ragdoll.opp.pts[k];
          const dx = pt.x - px, dy = pt.y - py;
          if (dx * dx + dy * dy < 676) return 'corpse:' + k;
        }
      }
      return null;
    }, { x: PL.facing, y: -0.05 });

    const dir = GB.geom.norm(ray.x - m.x, ray.y - m.y);
    const angle = Math.atan2(dir.y, dir.x);
    GB.fx.flash(m.x, m.y, angle);
    GB.fx.tracer(m.x, m.y, ray.x, ray.y);

    if (O.hp <= 0) {
      if (typeof ray.hit === 'string' && ray.hit.indexOf('corpse:') === 0 && S.ragdoll && S.ragdoll.opp) {
        const pt = S.ragdoll.opp.pts[ray.hit.slice(7)];
        pt.px -= dir.x * 22; pt.py -= dir.y * 22;
        GB.fx.gibs(ray.x, ray.y, 10, angle, gibColors(O.cfg));
        GB.sfx.fleshHit();
      }
      return;
    }

    const part = ray.hit;
    if (part === 'hat') {
      O.hatOn = false;
      GB.fx.spawnHat(ray.x, ray.y, O.cfg.hat, 1);
      GB.fx.spawnText(ray.x, ray.y - 20, 'HAT TRICK! +50', '#e0a52e', 18);
      GB.sfx.ricochet();
      S.opts.onHatShot && S.opts.onHatShot();
    } else if (part === 'head' || part === 'torso' || part === 'arm' || part === 'legs') {
      P.hitsLanded++;
      const dmg = oppDamageFor(part);
      O.hp = Math.max(0, O.hp - dmg);
      O.hurt = 1;
      GB.fx.blood(ray.x, ray.y, part === 'head' ? 34 : 20, angle);
      GB.fx.gibs(ray.x, ray.y, part === 'head' ? 8 : 4, angle, gibColors(O.cfg));
      addWound(O, OP, ray.x, ray.y);
      GB.sfx.fleshHit();
      GB.fx.spawnText(ray.x, ray.y - 30, part === 'head' ? 'HEADSHOT!' : '-' + dmg, part === 'head' ? '#ffd76b' : '#fff', part === 'head' ? 22 : 18);
      if (O.hp <= 0) {
        S.firstKillT = S.t;
        S.result = 'win';
        S.ragdoll = { opp: makeRagdoll(OP, O.cfg, O.hatOn, O.raise, dir.x, dir.y, part) };
        GB.sfx.fall();
        GB.fx.spawnDust(OP.x, OP.y, 10, true);
        S.banner = S.opp.name + ' IS DOWN!';
        S.bannerT = 99;
        GB.sfx.winSting();
        setPhase('over');
      }
    } else if (part === 'ground') {
      GB.fx.spawnDust(ray.x, ray.y, 6);
      if (Math.random() < 0.6) GB.sfx.ricochet();
    } else {
      if (Math.random() < 0.4) GB.sfx.ricochet();
    }
  }

  // ---------- drawing ----------
  function draw(ctx) {
    if (!S) return;
    const P = S.player, O = S.opp;

    GB.scene.draw(ctx, S.level, 1 / 60);
    GB.fx.drawStains(ctx);

    if (S.ragdoll && S.ragdoll.player) {
      drawRagdoll(ctx, S.ragdoll.player);
    } else {
      GB.chars.drawSide(ctx, PL.x, PL.y, PL.scale, P.cfg, {
        facing: PL.facing, raise: P.raise, recoil: P.recoil,
        hurt: P.hurt, breathe: S.t, wounds: P.wounds
      });
    }
    if (S.ragdoll && S.ragdoll.opp) {
      drawRagdoll(ctx, S.ragdoll.opp);
    } else {
      GB.chars.drawSide(ctx, OP.x, OP.y, OP.scale, O.cfg, {
        facing: OP.facing, raise: O.raise, recoil: O.recoil,
        hurt: O.hurt, hatOff: !O.hatOn,
        breathe: S.t + 1.7, headScale: S.oppHeadScale(), wounds: O.wounds
      });
    }

    GB.fx.draw(ctx);
    drawHud(ctx);
    drawRest(ctx);
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
    ctx.strokeText('REST', rz.x, rz.y - rz.r - 10);
    ctx.fillText('REST', rz.x, rz.y - rz.r - 10);
    ctx.restore();
  }

  function drawHud(ctx) {
    const P = S.player, O = S.opp;
    drawHealthBar(ctx, 18, 16, P.name, P.hp, P.maxHp, false);
    drawHealthBar(ctx, W - 318, 16, O.name, O.hp, O.maxHp, true);
    drawCylinder(ctx, AMMO_HUD.x, AMMO_HUD.y, P.ammo, S.cheats.moreammo);
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
      pulseText(ctx, 'REST YOUR CURSOR ON THE CYLINDER', W / 2, 120, 20, '#e8d5a3');
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
