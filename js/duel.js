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

  /** Arterial spray from a stump — pulses with a fake heartbeat. */
  function gush(x, y, dir, strength) {
    if (gore === 'off') return;
    const n = gore === 'buckets' ? 4 + ((strength * 5) | 0) : 2;
    for (let i = 0; i < n; i++) {
      const a = dir + (Math.random() - 0.5) * 0.5;
      const sp = 200 + Math.random() * 320 * (strength || 0.6);
      parts.push({
        type: 'blood', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
        r: 2 + Math.random() * 3.2, life: 0.7 + Math.random() * 0.5,
        floor: 462 + Math.random() * 40,
        color: Math.random() < 0.5 ? '#a3231b' : '#7d0f0f'
      });
    }
  }

  const SPARK_COLORS = ['#ffe9a0', '#ffb020', '#fff6d2', '#ff6a20', '#c8e8ff'];

  /** Impact sparks for metal bodies — never stains, never blood. */
  function sparks(x, y, n, dir) {
    const count = Math.max(4, n | 0);
    for (let i = 0; i < count; i++) {
      const a = (dir || 0) + (Math.random() - 0.5) * 1.8;
      const sp = 80 + Math.random() * 320;
      parts.push({
        type: 'spark', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (40 + Math.random() * 90),
        life: 0.1 + Math.random() * 0.22,
        len: 5 + Math.random() * 12,
        w: 1.1 + Math.random() * 1.4,
        color: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0]
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
  function spawnGun(x, y, color, dir) {
    parts.push({
      type: 'gun', x, y,
      vx: dir * (140 + Math.random() * 90),
      vy: -180 - Math.random() * 80,
      rot: 0, vr: dir * (8 + Math.random() * 6),
      life: 1.5, color: color || '#4a4a52'
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
      if (p.type === 'spark') {
        p.vy += 180 * dt;
        p.vx *= 0.98;
        continue;
      }
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
      } else if (p.type === 'gun') {
        ctx.save();
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-4, -3, 22, 6);
        ctx.fillRect(-8, 0, 8, 11);
        ctx.beginPath(); ctx.arc(4, 0, 5, 0, 7); ctx.fill();
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
      } else if (p.type === 'spark') {
        ctx.save();
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.w || 1.4;
        ctx.lineCap = 'round';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        const dx = p.vx * 0.016 * (p.len || 8);
        const dy = p.vy * 0.016 * (p.len || 8);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - dx, p.y - dy);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = a * 0.85;
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.15, 0, 7); ctx.fill();
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

  return { setGore, initStains, blood, spawnBlood, drip, pool, gush, gibs, sparks, spawnDust, spawnShards,
           spawnHat, spawnGun, tracer, flash, spawnText, update, draw, drawStains, clear,
           debugCounts: () => ({ parts: parts.length, gibs: parts.filter(p => p.type === 'gib').length, pools: pools.length }) };
})();
