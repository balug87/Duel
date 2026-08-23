// ---------- the duel itself (side view) ----------
GB.Duel = (function () {
  const W = 960, H = 540;
  const PL = { x: 115, y: 470, scale: 1.35, facing: 1 };
  const OP = { x: 845, y: 470, scale: 1.35, facing: -1 };
  const COUNT_STEP = 0.75;
  const AMMO_HUD = { x: 64, y: H - 58 };

  let S = null;

  function restZone() {
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
        raise: 0, recoil: 0, fall: 0, hurt: 0, wounds: [], dripT: 0,
        missing: {}, gush: [], pendingTear: null
      },
      opp: {
        def: opts.oppDef, cfg: opts.oppDef.cfg, name: opts.oppDef.name,
        hp: st.health, maxHp: st.health,
        ammo: st.ammo === 0 ? Infinity : st.ammo,
        raise: 0, recoil: 0, fall: 0, hurt: 0, hatOn: true, wounds: [], dripT: 0,
        nextShot: 0, missing: {}, gush: [], pendingTear: null
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
    if (GB.ragdoll) GB.ragdoll.reset();
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

  function dropBody(who, dir, impact, part) {
    const ent = who === 'player' ? S.player : S.opp;
    const geo = who === 'player' ? PL : OP;
    const hatOn = who === 'player' ? true : !!ent.hatOn;
    S.ragdoll = S.ragdoll || {};
    if (GB.ragdoll && GB.ragdoll.available()) {
      GB.ragdoll.spawn(geo, {
        who: who, cfg: ent.cfg, hatOn: hatOn && ent.pendingTear !== 'head',
        raise: ent.raise, headScale: who === 'opp' ? S.oppHeadScale() : 1,
        dir: dir, impact: impact || { x: geo.x, y: geo.y - 100 },
        part: part || 'torso', missing: ent.missing
      });
      if (ent.pendingTear) {
        GB.ragdoll.tear(who, ent.pendingTear, dir);
        ent.pendingTear = null;
      }
      S.ragdoll[who] = true;
    }
  }

  function shouldSever(part) {
    if (S.settings.gore !== 'buckets') return false;
    if (part === 'head') return Math.random() < 0.92;
    if (part === 'arm') return Math.random() < 0.82;
    if (part === 'legs') return Math.random() < 0.75;
    return false;
  }

  function markTear(ent, bodyPart, impact, dir) {
    ent.pendingTear = bodyPart;
    ent.gush.push({ part: bodyPart, pulse: Math.random() * 4 });
    if (bodyPart === 'head') {
      GB.fx.spawnText(impact.x, impact.y - 36, 'DECAPITATED!', '#ffd76b', 22);
    } else {
      GB.fx.spawnText(impact.x, impact.y - 28, bodyPart === 'arm' ? 'ARM OFF!' : 'LEG OFF!', '#ff6b4a', 18);
    }
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
            if (P.hp <= 0) { S.deathDir = dir; S.deathPart = roll.part; S.deathImpact = hit; return playerDown(); }
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
      if (GB.ragdoll) GB.ragdoll.step(dt);
      if (!S.poolSpawned && S.phaseT > 0.7) {
        S.poolSpawned = true;
        const who = S.result === 'lose' ? 'player' : 'opp';
        const p = GB.ragdoll && GB.ragdoll.pelvis(who);
        const geo = who === 'player' ? PL : OP;
        GB.fx.pool(p ? p.x : geo.x, p ? p.y : geo.y, 52);
      }
      if (!S.ended && S.phaseT > 3.2) {
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
    dropBody('player', dir, S.deathImpact, S.deathPart);
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
    if (P.hp <= 0) return;
    if (S.phase !== 'fire' && S.phase !== 'over') return;
    if (S.phase === 'over' && S.result === 'lose') return;
    if (P.cooldown > 0) return;
    if (P.ammo <= 0) { GB.sfx.dryFire(); return; }
    P.cooldown = S.cheats.fastfire ? 0.07 : 0.28;
    if (!S.cheats.moreammo) P.ammo--;
    P.shots++;
    P.recoil = 1;
    P.raise = 1;
    GB.sfx.gunshot();
    const m = GB.chars.sideMuzzlePoint(PL.x, PL.y, PL.scale, PL.facing, 1);
    const ray = GB.geom.castRay(m.x, m.y, x, y, (px, py) => {
      if (O.hp > 0) {
        return GB.chars.sideHitTest(OP.x, OP.y, OP.scale, OP.facing, S.oppHeadScale(), O.hatOn, px, py);
      }
      if (GB.ragdoll && GB.ragdoll.hitAt(px, py)) return 'corpse';
      return null;
    }, { x: PL.facing, y: -0.05 });
    const dir = GB.geom.norm(ray.x - m.x, ray.y - m.y);
    const angle = Math.atan2(dir.y, dir.x);
    GB.fx.flash(m.x, m.y, angle);
    GB.fx.tracer(m.x, m.y, ray.x, ray.y);
    if (O.hp <= 0) {
      if (ray.hit === 'corpse' && GB.ragdoll) {
        const info = GB.ragdoll.hitAt(ray.x, ray.y);
        const torn = info && GB.ragdoll.shot(info, dir, S.settings.gore === 'buckets');
        GB.fx.gibs(ray.x, ray.y, torn ? 14 : 8, angle, gibColors(O.cfg));
        GB.fx.blood(ray.x, ray.y, torn ? 28 : 16, angle);
        GB.sfx.fleshHit();
        if (torn) GB.fx.spawnText(ray.x, ray.y - 24, 'TORN OFF!', '#ff6b4a', 16);
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
      const dying = dmg >= O.hp || (part === 'head' && S.settings.oneShotHead);
      const tearPart = part === 'arm' ? 'gunArm' : part === 'legs' ? (Math.random() < 0.55 ? 'nearLeg' : 'farLeg') : part;
      O.hurt = 1;
      GB.fx.blood(ray.x, ray.y, part === 'head' ? 40 : 22, angle);
      GB.fx.gibs(ray.x, ray.y, part === 'head' ? 12 : 6, angle, gibColors(O.cfg));
      addWound(O, OP, ray.x, ray.y);
      GB.sfx.fleshHit();
      if (shouldSever(part) && dying && tearPart !== 'torso') {
        markTear(O, tearPart, { x: ray.x, y: ray.y }, dir);
      } else {
        GB.fx.spawnText(ray.x, ray.y - 30, part === 'head' ? 'HEADSHOT!' : '-' + dmg, part === 'head' ? '#ffd76b' : '#fff', part === 'head' ? 22 : 18);
      }
      O.hp = Math.max(0, O.hp - dmg);
      if (O.hp <= 0) {
        S.firstKillT = S.t;
        S.result = 'win';
        dropBody('opp', dir, { x: ray.x, y: ray.y }, part);
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

  function draw(ctx) {
    if (!S) return;
    const P = S.player, O = S.opp;
    GB.scene.draw(ctx, S.level, 1 / 60);
    GB.fx.drawStains(ctx);
    if (!(S.ragdoll && S.ragdoll.player)) {
      GB.chars.drawSide(ctx, PL.x, PL.y, PL.scale, P.cfg, {
        facing: PL.facing, raise: P.raise, recoil: P.recoil,
        hurt: P.hurt, breathe: S.t, wounds: P.wounds
      });
    }
    if (!(S.ragdoll && S.ragdoll.opp)) {
      GB.chars.drawSide(ctx, OP.x, OP.y, OP.scale, O.cfg, {
        facing: OP.facing, raise: O.raise, recoil: O.recoil,
        hurt: O.hurt, hatOff: !O.hatOn,
        breathe: S.t + 1.7, headScale: S.oppHeadScale(), wounds: O.wounds
      });
    }
    if (GB.ragdoll) GB.ragdoll.draw(ctx);
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
      ctx.fillText('\u00b7 CHEATS ON \u00b7', W / 2, 68);
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
      ctx.fillText('\u221e', cx, cy + 9);
      return;
    }
    const n = Math.min(6, Math.max(0, ammo));
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 3;
      const hx = cx + Math.cos(a) * 19, hy = cy + Math.sin(a) * 19;
      if (i < n) {
        ctx.fillStyle = '#c8a13e';
        ctx.beginPath(); ctx.arc(hx, hy, 8.5, 0, 7); ctx.fill();
        ctx.fillStyle = '#8f7124';
        ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, 7); ctx.fill();
      } else {
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
