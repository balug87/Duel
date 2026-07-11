/* DUEL — procedural vector-cartoon gunslingers (original artwork, drawn in code) */
window.GB = window.GB || {};

GB.chars = (function () {

  // ---------- roster of playable looks ----------
  const ROSTER = [
    { name: 'BUCK',    skin: '#e8b98a', hair: '#4a2f18', hat: '#6b4a2a', shirt: '#8c2f24', vest: '#3f2712', pants: '#39506b', bandana: '#d8c15a', gun: '#4a4a52', hatStyle: 0, mustache: true,  beard: false },
    { name: 'ROSA',    skin: '#d9a06b', hair: '#20140c', hat: '#3a3a3f', shirt: '#5e3b6e', vest: '#241a10', pants: '#4a3527', bandana: '#c23b2e', gun: '#6b5a3a', hatStyle: 1, mustache: false, beard: false },
    { name: 'SHADY',   skin: '#c9a06e', hair: '#57575e', hat: '#23231f', shirt: '#3c3c3c', vest: '#191919', pants: '#2c2c34', bandana: '#7d0f0f', gun: '#2e2e33', hatStyle: 0, mustache: false, beard: true  },
    { name: 'DUSTY',   skin: '#f0c9a0', hair: '#b8862f', hat: '#a97e4b', shirt: '#4f7359', pants: '#6b503a', vest: '#54381e', bandana: '#355a7d', gun: '#555c66', hatStyle: 2, mustache: true,  beard: false },
    { name: 'JUNE',    skin: '#f2cfa6', hair: '#8c3b16', hat: '#7d2f28', shirt: '#c2a13b', vest: '#4b2c16', pants: '#333c46', bandana: '#3e6b4f', gun: '#7a6a4a', hatStyle: 1, mustache: false, beard: false },
    { name: 'GRAVES',  skin: '#d9b28c', hair: '#dcdcdc', hat: '#1d1d20', shirt: '#e8e2d2', vest: '#2b2b30', pants: '#1f1f24', bandana: '#101014', gun: '#8f9399', hatStyle: 0, mustache: true,  beard: true  },
    { name: 'COYOTE',  skin: '#b57e4e', hair: '#171009', hat: '#8c6238', shirt: '#a34d1f', vest: '#5e3b1a', pants: '#54452f', bandana: '#e0a52e', gun: '#4a4038', hatStyle: 2, mustache: false, beard: false },
    { name: 'PREACH',  skin: '#e5c3a1', hair: '#3a3a3a', hat: '#141414', shirt: '#20242c', vest: '#101216', pants: '#20242c', bandana: '#e8e2d2', gun: '#33363c', hatStyle: 1, mustache: false, beard: true  }
  ];

  // ---------- CPU opponents (stats before difficulty scaling) ----------
  const OPPONENTS = [
    { name: 'SLOW-HAND SAM', reaction: 1500, accuracy: 0.42, interval: 950,
      cfg: { skin: '#e8b98a', hair: '#6b4a2a', hat: '#8c6238', shirt: '#7d6b4a', vest: '#4b3a22', pants: '#5a4632', bandana: '#8c2f24', gun: '#4a4a52', hatStyle: 2, mustache: false, beard: false } },
    { name: 'TWO-BIT TESS', reaction: 1280, accuracy: 0.5, interval: 880,
      cfg: { skin: '#d9a06b', hair: '#20140c', hat: '#5e3b6e', shirt: '#8c5a2f', vest: '#3a2312', pants: '#443346', bandana: '#c2a13b', gun: '#6b5a3a', hatStyle: 1, mustache: false, beard: false } },
    { name: 'RATTLER ROY', reaction: 1100, accuracy: 0.56, interval: 820,
      cfg: { skin: '#c9a06e', hair: '#3a2a16', hat: '#4f7359', shirt: '#3e5e46', vest: '#22331f', pants: '#3c3c34', bandana: '#d8c15a', gun: '#555c66', hatStyle: 0, mustache: true, beard: false } },
    { name: 'MISS FORTUNE', reaction: 950, accuracy: 0.62, interval: 760,
      cfg: { skin: '#f2cfa6', hair: '#8c3b16', hat: '#7d0f0f', shirt: '#9c1f30', vest: '#3f0d14', pants: '#2c2c34', bandana: '#e8e2d2', gun: '#7a6a4a', hatStyle: 1, mustache: false, beard: false } },
    { name: 'BIG IRON IKE', reaction: 830, accuracy: 0.68, interval: 700,
      cfg: { skin: '#b57e4e', hair: '#171009', hat: '#43290f', shirt: '#355a7d', vest: '#1f3242', pants: '#3a3a3f', bandana: '#a34d1f', gun: '#2e2e33', hatStyle: 0, mustache: true, beard: true } },
    { name: 'EL CARDO', reaction: 720, accuracy: 0.74, interval: 650,
      cfg: { skin: '#c98e5a', hair: '#111', hat: '#23231f', shirt: '#c2a13b', vest: '#6b1a12', pants: '#1f1f24', bandana: '#3e6b4f', gun: '#8f9399', hatStyle: 2, mustache: true, beard: false } },
    { name: 'WIDOW WREN', reaction: 620, accuracy: 0.8, interval: 600,
      cfg: { skin: '#e5c3a1', hair: '#101014', hat: '#101014', shirt: '#26262c', vest: '#101014', pants: '#1a1a20', bandana: '#7d0f0f', gun: '#33363c', hatStyle: 1, mustache: false, beard: false } },
    { name: 'DOC MIDNIGHT', reaction: 520, accuracy: 0.86, interval: 550,
      cfg: { skin: '#d9b28c', hair: '#dcdcdc', hat: '#2b2b30', shirt: '#e8e2d2', vest: '#20242c', pants: '#20242c', bandana: '#355a7d', gun: '#4a4038', hatStyle: 0, mustache: true, beard: true } },
    { name: 'THE VULTURE', reaction: 420, accuracy: 0.92, interval: 500,
      cfg: { skin: '#c9a06e', hair: '#2c2c2c', hat: '#141414', shirt: '#3f2712', vest: '#141414', pants: '#141414', bandana: '#e0a52e', gun: '#181a1e', hatStyle: 0, mustache: false, beard: true } },
    { name: 'HELLFIRE KATE', reaction: 380, accuracy: 0.94, interval: 470,
      cfg: { skin: '#f0c9a0', hair: '#8c1d14', hat: '#8c1d14', shirt: '#1a1a20', vest: '#8c1d14', pants: '#26262c', bandana: '#e0a52e', gun: '#8f9399', hatStyle: 1, mustache: false, beard: false } },
    { name: 'JUDGE BONES', reaction: 350, accuracy: 0.95, interval: 450,
      cfg: { skin: '#e8e2d2', hair: '#e8e2d2', hat: '#101014', shirt: '#101014', vest: '#26262c', pants: '#101014', bandana: '#e8e2d2', gun: '#181a1e', hatStyle: 1, mustache: false, beard: false } },
    { name: 'THE STRANGER', reaction: 320, accuracy: 0.97, interval: 430,
      cfg: { skin: '#b58a62', hair: '#111', hat: '#3f2712', shirt: '#43290f', vest: '#2b1a0a', pants: '#2b1a0a', bandana: '#101014', gun: '#101014', hatStyle: 2, mustache: true, beard: true } }
  ];

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f));
    const b = Math.min(255, Math.max(0, (n & 255) * f));
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /**
   * Draw a front-facing gunslinger.
   * (x, y) = center of feet on ground. scale ~1 => ~190px tall.
   * pose: { raise (0..1 gun-arm draw), recoil (0..1), fall (0..1), fallDir (+-1),
   *         hurt (0..1 red flash), headScale, hatOff, breathe (seconds), armsOut (0..1 for assistant) }
   */
  function draw(ctx, x, y, scale, cfg, pose) {
    pose = pose || {};
    const s = scale;
    const hs = pose.headScale || 1;
    const raise = pose.raise || 0;
    const recoil = pose.recoil || 0;
    const fall = pose.fall || 0;
    const breathe = Math.sin((pose.breathe || 0) * 2.1) * 1.2;

    ctx.save();
    ctx.translate(x, y);
    if (fall > 0) {
      // topple sideways around the feet
      const dir = pose.fallDir || 1;
      ctx.rotate(fall * fall * (Math.PI / 2 - 0.12) * dir);
      ctx.translate(0, fall * 6);
    }
    ctx.scale(s, s);
    ctx.translate(0, breathe * (1 - fall));
    ctx.lineJoin = 'round';

    const skinD = shade(cfg.skin, 0.8);
    const boot = shade(cfg.pants, 0.5);

    // ---- legs ----
    ctx.fillStyle = cfg.pants;
    rr(ctx, -19, -80, 16, 74, 5); ctx.fill();
    rr(ctx, 3, -80, 16, 74, 5); ctx.fill();
    ctx.fillStyle = shade(cfg.pants, 0.82);
    ctx.fillRect(-19, -80, 38, 10);
    // boots
    ctx.fillStyle = boot;
    rr(ctx, -21, -14, 20, 14, 4); ctx.fill();
    rr(ctx, 1, -14, 20, 14, 4); ctx.fill();

    // ---- torso ----
    ctx.fillStyle = cfg.shirt;
    rr(ctx, -27, -140, 54, 66, 10); ctx.fill();
    // vest
    ctx.fillStyle = cfg.vest;
    rr(ctx, -27, -140, 20, 62, 8); ctx.fill();
    rr(ctx, 7, -140, 20, 62, 8); ctx.fill();
    // belt + buckle
    ctx.fillStyle = '#2b1a0a';
    ctx.fillRect(-27, -86, 54, 9);
    ctx.fillStyle = '#e0a52e';
    ctx.fillRect(-6, -87, 12, 11);
    // holster on hip
    ctx.fillStyle = '#3f2712';
    rr(ctx, 18, -80, 12, 22, 4); ctx.fill();

    // ---- non-gun arm (their left / our right) ----
    const armsOut = pose.armsOut || 0;
    ctx.strokeStyle = cfg.shirt;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-24, -128);
    if (armsOut > 0) {
      ctx.lineTo(-24 - 34 * armsOut, -128 - 14 * armsOut);
    } else {
      ctx.lineTo(-27 - raise * 3, -92);
    }
    ctx.stroke();
    ctx.fillStyle = cfg.skin;
    ctx.beginPath();
    if (armsOut > 0) ctx.arc(-24 - 34 * armsOut, -128 - 14 * armsOut, 7, 0, 7);
    else ctx.arc(-27 - raise * 3, -90, 7, 0, 7);
    ctx.fill();

    // ---- gun arm (their right / our left when facing us) ----
    // raise 0: hand hovering at holster. raise 1: revolver leveled at the viewer.
    const shx = 24, shy = -128;
    let hx, hy;
    if (armsOut > 0) {
      hx = 24 + 34 * armsOut; hy = -128 - 14 * armsOut;
    } else {
      hx = 26 - 8 * raise;
      hy = -74 - 44 * raise + recoil * 5;
    }
    ctx.strokeStyle = shade(cfg.shirt, 0.9);
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(shx, shy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    // hand
    ctx.fillStyle = cfg.skin;
    ctx.beginPath(); ctx.arc(hx, hy, 7.5, 0, 7); ctx.fill();

    // revolver pointing at the viewer once raised
    if (raise > 0.15 && !armsOut) {
      const lift = Math.min(1, (raise - 0.15) / 0.85);
      ctx.save();
      ctx.translate(hx, hy - 3);
      ctx.scale(0.6 + 0.5 * lift, 0.6 + 0.5 * lift);
      // frame
      ctx.fillStyle = cfg.gun;
      rr(ctx, -7, -10, 14, 12, 3); ctx.fill();
      // cylinder
      ctx.fillStyle = shade(cfg.gun, 1.25);
      ctx.beginPath(); ctx.arc(0, -6, 5.5, 0, 7); ctx.fill();
      // barrel mouth aimed at us
      ctx.fillStyle = shade(cfg.gun, 0.55);
      ctx.beginPath(); ctx.arc(0, -6, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#0a0a0a';
      ctx.beginPath(); ctx.arc(0, -6, 1.6, 0, 7); ctx.fill();
      ctx.restore();
    }

    // ---- head ----
    ctx.save();
    ctx.translate(0, -160);
    ctx.scale(hs, hs);
    // bandana knot behind neck drawn first
    ctx.fillStyle = cfg.bandana;
    ctx.beginPath();
    ctx.moveTo(-14, 16); ctx.lineTo(14, 16); ctx.lineTo(0, 34); ctx.closePath();
    ctx.fill();
    ctx.fillRect(-14, 12, 28, 8);
    // face
    ctx.fillStyle = cfg.skin;
    ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.fill();
    // ears
    ctx.beginPath(); ctx.arc(-19, 2, 4, 0, 7); ctx.arc(19, 2, 4, 0, 7); ctx.fill();
    // hair sides
    ctx.fillStyle = cfg.hair;
    ctx.beginPath();
    ctx.arc(0, -2, 19, Math.PI + 0.5, -0.5);
    ctx.lineTo(15, 4); ctx.lineTo(-15, 4);
    ctx.closePath(); ctx.fill();
    // eyes
    const squint = pose.hurt ? 2.5 : 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-7, -2, 4.4, 5 - squint, 0, 0, 7);
    ctx.ellipse(7, -2, 4.4, 5 - squint, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#1a1208';
    ctx.beginPath(); ctx.arc(-6.4, -1.5, 1.9, 0, 7); ctx.arc(7.6, -1.5, 1.9, 0, 7); ctx.fill();
    // brows
    ctx.strokeStyle = cfg.hair;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-11, -8.5); ctx.lineTo(-3, -6.8);
    ctx.moveTo(3, -6.8); ctx.lineTo(11, -8.5);
    ctx.stroke();
    // nose
    ctx.strokeStyle = skinD;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -1); ctx.lineTo(-1.5, 4.5); ctx.stroke();
    // mustache / beard / mouth
    if (cfg.beard) {
      ctx.fillStyle = cfg.hair;
      ctx.beginPath();
      ctx.moveTo(-13, 4); ctx.quadraticCurveTo(0, 26, 13, 4);
      ctx.quadraticCurveTo(6, 12, 0, 12); ctx.quadraticCurveTo(-6, 12, -13, 4);
      ctx.closePath(); ctx.fill();
    }
    if (cfg.mustache) {
      ctx.strokeStyle = cfg.hair;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(-8, 8.5); ctx.quadraticCurveTo(0, 5.5, 8, 8.5);
      ctx.stroke();
    } else if (!cfg.beard) {
      ctx.strokeStyle = skinD;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(4, 10); ctx.stroke();
    }
    // hat
    if (!pose.hatOff) drawHat(ctx, cfg);
    ctx.restore(); // head

    // hurt flash
    if (pose.hurt > 0) {
      ctx.globalAlpha = pose.hurt * 0.28;
      ctx.fillStyle = '#ff2211';
      rr(ctx, -30, -180 * hs + (hs - 1) * 20, 60, 178, 12); ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  function drawHat(ctx, cfg) {
    const hd = shade(cfg.hat, 0.75);
    ctx.fillStyle = cfg.hat;
    if (cfg.hatStyle === 2) {              // wide sombrero-ish
      ctx.beginPath(); ctx.ellipse(0, -12, 32, 9, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, -20, 13, 10, 0, 0, 7); ctx.fill();
      ctx.fillStyle = hd; ctx.fillRect(-13, -16, 26, 4);
    } else if (cfg.hatStyle === 1) {       // flat gambler
      ctx.beginPath(); ctx.ellipse(0, -13, 26, 6.5, 0, 0, 7); ctx.fill();
      rr(ctx, -12, -26, 24, 14, 4); ctx.fill();
      ctx.fillStyle = hd; ctx.fillRect(-12, -17, 24, 4);
    } else {                               // classic cattleman
      ctx.beginPath(); ctx.ellipse(0, -12, 28, 8, 0, 0, 7); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-13, -12);
      ctx.quadraticCurveTo(-15, -32, -6, -33);
      ctx.quadraticCurveTo(0, -28, 6, -33);
      ctx.quadraticCurveTo(15, -32, 13, -12);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = hd; ctx.fillRect(-13, -16, 26, 4);
    }
  }

  /**
   * Hit zones for a standing gunslinger drawn at (x,y,scale).
   * Returns list of { part, test(px,py) } ordered by priority.
   */
  function zones(x, y, s, headScale) {
    const hs = headScale || 1;
    const headC = { cx: x, cy: y - 160 * s, r: 21 * s * hs };
    const hatR = {
      x: x - 28 * s * hs, y: y - (160 + 34 * hs / 1) * s, w: 56 * s * hs, h: 22 * s * hs
    };
    return {
      hat: hatR,
      head: headC,
      torso: { x: x - 27 * s, y: y - 140 * s, w: 54 * s, h: 66 * s },
      armL: { x: x - 42 * s, y: y - 134 * s, w: 15 * s, h: 48 * s },
      armR: { x: x + 27 * s, y: y - 134 * s, w: 15 * s, h: 48 * s },
      legs: { x: x - 21 * s, y: y - 80 * s, w: 42 * s, h: 80 * s }
    };
  }

  function inRect(r, px, py) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h; }
  function inCircle(c, px, py) { const dx = px - c.cx, dy = py - c.cy; return dx * dx + dy * dy <= c.r * c.r; }

  /** Which body part does a shot at (px,py) hit? null = miss. */
  function hitTest(x, y, s, headScale, hatOn, px, py) {
    const z = zones(x, y, s, headScale);
    if (inCircle(z.head, px, py)) return 'head';
    if (hatOn && inRect(z.hat, px, py)) return 'hat';
    if (inRect(z.torso, px, py)) return 'torso';
    if (inRect(z.armL, px, py)) return 'armL';
    if (inRect(z.armR, px, py)) return 'armR';
    if (inRect(z.legs, px, py)) return 'legs';
    return null;
  }

  /** Where the opponent's muzzle flash appears (their raised revolver). */
  function muzzlePoint(x, y, s) {
    return { x: x + 18 * s, y: y - 121 * s };
  }

  /** Small standing portrait for roster thumbnails / preview. */
  function drawPortrait(canvas, cfg, opts) {
    const c = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    opts = opts || {};
    c.clearRect(0, 0, w, h);
    if (opts.bg !== false) {
      const sky = c.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#96c6e0'); sky.addColorStop(0.7, '#d9b27c');
      c.fillStyle = sky; c.fillRect(0, 0, w, h);
      c.fillStyle = '#a97e4b'; c.fillRect(0, h * 0.82, w, h);
    }
    const scale = opts.scale || (h / 230);
    draw(c, w / 2, h * 0.94, scale, cfg, { raise: opts.raise || 0, breathe: opts.breathe || 0 });
  }

  return { ROSTER, OPPONENTS, draw, zones, hitTest, muzzlePoint, drawPortrait, shade, rr };
})();
