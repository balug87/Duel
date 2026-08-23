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
