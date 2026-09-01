// ---------- the duel itself (side view) ----------
GB.Duel = (function () {
  const W = 960, H = 540;
  const PL = { x: 115, y: 470, scale: 1.35, facing: 1 };
  const OP = { x: 845, y: 470, scale: 1.35, facing: -1 };
  const COUNT_STEP = 0.75;
  const AMMO_HUD = { x: 64, y: H - 58 };
  const CONTINUE_Y0 = 198, CONTINUE_Y1 = 258;

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
        missing: {}, gushT: 0, pendingTear: null, disarmed: false, aimRecover: 0
      },
      opp: {
        def: opts.oppDef, cfg: opts.oppDef.cfg, name: opts.oppDef.name,
        hp: st.health, maxHp: st.health,
        ammo: st.ammo === 0 ? Infinity : st.ammo,
        raise: 0, recoil: 0, fall: 0, hurt: 0, hatOn: true, wounds: [], dripT: 0,
        nextShot: 0, missing: {}, gushT: 0, pendingTear: null, disarmed: false,
        aimZone: null, aimErrorY: 0
      },
      aim: { x: W / 2, y: H / 2 },
      result: null, ended: false, canContinue: false,
      hitStop: 0, trauma: 0,
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

  function juice(kind) {
    if (kind === 'kill') {
      S.hitStop = Math.max(S.hitStop, 0.11);
      S.trauma = Math.min(1, S.trauma + 0.82);
    } else if (kind === 'disarm') {
      S.hitStop = Math.max(S.hitStop, 0.07);
      S.trauma = Math.min(1, S.trauma + 0.55);
    } else if (kind === 'hit') {
      S.hitStop = Math.max(S.hitStop, 0.045);
      S.trauma = Math.min(1, S.trauma + 0.32);
    } else if (kind === 'shot') {
      S.trauma = Math.min(1, S.trauma + 0.16);
    }
  }

  function canFire(ent) {
    return ent.hp > 0 && !ent.missing.gunArm && !ent.disarmed && ent.ammo > 0;
  }

  function trackRaise(ent, geo, ax, ay, dt, rate) {
    if (!GB.aim) return;
    const target = GB.aim.raiseFromAim(ax, ay, geo);
    ent.raise += (target - ent.raise) * Math.min(1, dt * rate);
    ent.raise = GB.aim.clampRaise(ent.raise);
  }

  function pickAiZone() {
    const a = S.accuracy;
    const r = Math.random();
    if (a > 0.88) {
      if (r < 0.55) return 'head';
      if (r < 0.90) return 'torso';
      return 'arm';
    }
    if (a > 0.65) {
      if (r < 0.22) return 'head';
      if (r < 0.72) return 'torso';
      if (r < 0.88) return 'arm';
      return 'legs';
    }
    if (r < 0.08) return 'head';
    if (r < 0.52) return 'torso';
    if (r < 0.72) return 'arm';
    return 'legs';
  }

  function applyHit(ent, geo, part, dmg, hit, dir, isPlayerVictim) {
    const dying = dmg >= ent.hp || (part === 'head' && S.settings.oneShotHead);
    const angle = Math.atan2(dir.y, dir.x);
    ent.hurt = 1;
    GB.fx.blood(hit.x, hit.y, part === 'head' ? 40 : 22, angle);
    GB.fx.gibs(hit.x, hit.y, part === 'head' ? 12 : 6, angle, gibColors(ent.cfg));
    addWound(ent, geo, hit.x, hit.y);
    GB.sfx.fleshHit();

    if (part === 'arm' && !ent.missing.gunArm) {
      const gore = S.settings.gore;
      const sever = gore === 'buckets' ? Math.random() < 0.92 : gore === 'classic' ? Math.random() < 0.6 : false;
      if (sever || gore !== 'off') {
        disarm(ent, geo, hit, dir);
        juice(dying ? 'kill' : 'disarm');
        if (!dying) {
          GB.fx.spawnText(hit.x, hit.y - 30, 'DISARMED!', '#ff6b4a', 20);
        }
      } else {
        juice('hit');
        GB.fx.spawnText(hit.x, hit.y - 30, '-' + dmg, '#fff', 18);
      }
    } else {
      const tearPart = part === 'legs' ? (Math.random() < 0.55 ? 'nearLeg' : 'farLeg') : part;
      if (shouldSever(part) && dying && tearPart !== 'torso' && part !== 'arm') {
        markTear(ent, tearPart, hit, dir);
        juice(dying ? 'kill' : 'hit');
      } else {
        juice(dying ? 'kill' : 'hit');
        GB.fx.spawnText(hit.x, hit.y - 30, part === 'head' ? 'HEADSHOT!' : '-' + dmg,
          part === 'head' ? '#ffd76b' : '#fff', part === 'head' ? 22 : 18);
      }
    }

    ent.hp = Math.max(0, ent.hp - dmg);
    if (isPlayerVictim) ent.hitFlash = 1;
    return ent.hp <= 0;
  }

  function disarm(ent, geo, impact, dir) {
    if (ent.missing.gunArm) return;
    ent.missing.gunArm = true;
    ent.disarmed = true;
    ent.raise = 0;
    const hand = GB.chars.sideHandPoint(geo.x, geo.y, geo.scale, geo.facing, 0.7, 0);
    const facing = geo.facing;
    if (GB.fx.spawnGun) GB.fx.spawnGun(hand.x, hand.y, ent.cfg.gun, facing);
    const ang = Math.atan2(dir.y, dir.x);
    GB.fx.gush(impact.x, impact.y, ang, 1.15);
    GB.fx.gibs(impact.x, impact.y, 10, ang, gibColors(ent.cfg));
    GB.sfx.smash();
  }

  function playerDamageFor(part) {
    const st = S.settings;
    if (st.damageModel === 'uniform') return 25;
    switch (part) {
      case 'head': return st.oneShotHead ? 9999 : 55;
      case 'torso': return 30;
      case 'arm': return 20;
      default: return 15;
    }
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
      if (ent.pendingTear && !ent.missing[ent.pendingTear] && ent.pendingTear !== 'gunArm') {
        GB.ragdoll.tear(who, ent.pendingTear, dir);
        ent.pendingTear = null;
      } else if (ent.pendingTear === 'gunArm' && !ent.missing.gunArm) {
        GB.ragdoll.tear(who, 'gunArm', dir);
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
    if (bodyPart === 'head') {
      GB.fx.spawnText(impact.x, impact.y - 36, 'DECAPITATED!', '#ffd76b', 22);
    } else {
      GB.fx.spawnText(impact.x, impact.y - 28, bodyPart === 'gunArm' || bodyPart === 'arm' ? 'ARM OFF!' : 'LEG OFF!', '#ff6b4a', 18);
    }
  }

  /** Stalemate: both still standing, neither can fire (empty cylinder and/or no gun-arm). */
  function tryDeclareDraw() {
    if (!S || S.phase !== 'fire') return false;
    const P = S.player, O = S.opp;
    if (P.hp <= 0 || O.hp <= 0) return false;
    if (canFire(P) || canFire(O)) return false;
    const pArmGone = !!(P.disarmed || P.missing.gunArm);
    const oArmGone = !!(O.disarmed || O.missing.gunArm);
    S.result = 'draw';
    S.banner = pArmGone && oArmGone ? 'BOTH DISARMED — DRAW' : 'DRAW! REMATCH';
    S.bannerT = 99;
    GB.sfx.drawSting();
    setPhase('over');
    return true;
  }

  function finishDuel() {
    if (!S || S.ended) return;
    S.ended = true;
    S.opts.onEnd({
      result: S.result,
      timeToKill: S.firstKillT ? (S.firstKillT - S.fireT) : 0,
      shots: S.player.shots, hits: S.player.hitsLanded,
      hpLeft: S.player.hp, maxHp: S.player.maxHp
    });
  }

  function update(dt) {
    if (!S) return;
    S.t += dt;
    S.trauma = Math.max(0, S.trauma - dt * 1.85);

    if (S.hitStop > 0) {
      S.hitStop -= dt;
      GB.fx.update(dt * 0.18);
      return;
    }

    S.phaseT += dt;
    const P = S.player, O = S.opp;
    P.cooldown = Math.max(0, P.cooldown - dt);
    P.hitFlash = Math.max(0, P.hitFlash - dt * 2.2);
    P.recoil = Math.max(0, P.recoil - dt * 5.2);
    P.hurt = Math.max(0, P.hurt - dt * 3);
    P.aimRecover = Math.max(0, P.aimRecover - dt);
    O.recoil = Math.max(0, O.recoil - dt * 4.6);
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
      if (ent.missing.gunArm && ent.hp > 0) {
        ent.gushT -= dt;
        if (ent.gushT <= 0) {
          ent.gushT = 0.11 + Math.random() * 0.1;
          const p = GB.chars.sideShoulderPoint(geo.x, geo.y, geo.scale, geo.facing);
          GB.fx.gush(p.x, p.y, geo.facing > 0 ? 0.15 : Math.PI - 0.15, 0.4);
        }
      }
    }

    if (S.phase === 'intro') {
      if (S.phaseT > 2.0) setPhase('holster');
    } else if (S.phase === 'holster') {
      P.raise = Math.max(0, P.raise - dt * 4);
      if (S.inHolster) { setPhase('countdown'); S.count = 3; S.countT = 0; GB.sfx.tick(); GB.sfx.heartbeat(); }
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
            O.aimZone = pickAiZone();
            O.aimErrorY = (Math.random() - 0.5) * (1 - S.accuracy) * 70;
          } else {
            GB.sfx.tick();
            GB.sfx.heartbeat();
          }
        }
      }
    } else if (S.phase === 'fire') {
      if (P.hp > 0 && !P.missing.gunArm) {
        const rate = P.aimRecover > 0 ? 4.2 : 11;
        trackRaise(P, PL, S.aim.x, S.aim.y, dt, rate);
      }
      if (O.hp > 0 && P.hp > 0 && !O.missing.gunArm) {
        if (!O.aimZone) {
          O.aimZone = pickAiZone();
          O.aimErrorY = (Math.random() - 0.5) * (1 - S.accuracy) * 70;
        }
        const aimPt = GB.chars.sidePointIn(PL.x, PL.y, PL.scale, PL.facing, O.aimZone);
        const untilShot = O.nextShot - S.t;
        if (untilShot < 0.32 && O.ammo > 0) {
          trackRaise(O, OP, aimPt.x, aimPt.y + O.aimErrorY, dt, 10);
        }
        if (S.t >= O.nextShot && canFire(O)) {
          oppShoot();
        } else if (S.t >= O.nextShot && !canFire(O)) {
          O.nextShot = S.t + 0.6;
        }
      }
      tryDeclareDraw();
    } else if (S.phase === 'over') {
      if (P.hp > 0 && S.result === 'win' && !P.missing.gunArm) {
        trackRaise(P, PL, S.aim.x, S.aim.y, dt, 11);
      }
      if (GB.ragdoll) GB.ragdoll.step(dt);
      if (S.result !== 'draw' && !S.poolSpawned && S.phaseT > 0.7) {
        S.poolSpawned = true;
        const who = S.result === 'lose' ? 'player' : 'opp';
        const p = GB.ragdoll && GB.ragdoll.pelvis(who);
        const geo = who === 'player' ? PL : OP;
        GB.fx.pool(p ? p.x : geo.x, p ? p.y : geo.y, 52);
      }
      // Draws rematch on a short timer (no corpse to play with).
      // Kills wait for Space / clicking the continue plate.
      if (S.result === 'draw') {
        if (!S.ended && S.phaseT > 1.6) finishDuel();
      } else {
        if (S.phaseT > 0.65) S.canContinue = true;
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

  function oppShoot() {
    const P = S.player, O = S.opp;
    O.ammo--;
    juice('shot');
    const m = GB.chars.sideMuzzlePoint(OP.x, OP.y, OP.scale, OP.facing, O.raise, O.recoil);
    const barrel = GB.aim ? GB.aim.barrelDir(O.raise, OP.facing, O.recoil) : { x: OP.facing, y: 0 };
    const spread = (1 - S.accuracy) * 0.14;
    const ang = Math.atan2(barrel.y, barrel.x) + (Math.random() - 0.5) * spread * 2;
    const bx = Math.cos(ang), by = Math.sin(ang);
    O.recoil = 1;
    O.raise = GB.aim ? GB.aim.clampRaise(O.raise - 0.08) : O.raise;
    GB.sfx.enemyShot();
    GB.fx.flash(m.x, m.y, ang);

    const ray = GB.geom.castRay(m.x, m.y, m.x + bx * 900, m.y + by * 900, (px, py) => {
      if (P.hp <= 0) return null;
      return GB.chars.sideHitTest(PL.x, PL.y, PL.scale, PL.facing, 1, true, px, py, P.missing);
    }, { x: bx, y: by });

    const dir = GB.geom.norm(ray.x - m.x, ray.y - m.y);
    GB.fx.tracer(m.x, m.y, ray.x, ray.y);

    const part = ray.hit;
    if (S.cheats.nohit) {
      GB.sfx.ricochet();
      GB.fx.spawnDust(30 + Math.random() * 120, 460 + Math.random() * 40, 5);
    } else if (part === 'head' || part === 'torso' || part === 'arm' || part === 'legs') {
      const dmg = playerDamageFor(part);
      const dead = applyHit(P, PL, part, dmg, { x: ray.x, y: ray.y }, dir, true);
      if (dead) {
        S.deathDir = dir; S.deathPart = part; S.deathImpact = { x: ray.x, y: ray.y };
        return playerDown();
      }
    } else if (part === 'ground') {
      GB.fx.spawnDust(ray.x, ray.y, 6);
      if (Math.random() < 0.6) GB.sfx.ricochet();
    } else {
      GB.sfx.ricochet();
      GB.fx.spawnDust(30 + Math.random() * 120, 460 + Math.random() * 40, 5);
    }

    O.aimZone = null;
    O.nextShot = S.t + (S.interval * (0.8 + Math.random() * 0.4)) / 1000;
  }

  function playerShoot(/* x, y unused — barrel aims */) {
    const P = S.player, O = S.opp;
    if (S.phase === 'holster' || S.phase === 'countdown') {
      S.warn = 'WAIT FOR THE SIGNAL!'; S.warnT = 1.4;
      GB.sfx.foul();
      return;
    }
    if (P.hp <= 0) return;
    if (S.phase !== 'fire' && S.phase !== 'over') return;
    if (S.phase === 'over' && S.result === 'lose') return;
    if (P.missing.gunArm || P.disarmed) {
      S.warn = "CAN'T SHOOT — ARM'S GONE!"; S.warnT = 1.2;
      GB.sfx.dryFire();
      tryDeclareDraw();
      return;
    }
    if (P.cooldown > 0) return;
    if (P.ammo <= 0) {
      GB.sfx.dryFire();
      tryDeclareDraw();
      return;
    }
    P.cooldown = S.cheats.fastfire ? 0.07 : 0.28;
    if (!S.cheats.moreammo) P.ammo--;
    P.shots++;
    juice('shot');

    const m = GB.chars.sideMuzzlePoint(PL.x, PL.y, PL.scale, PL.facing, P.raise, P.recoil);
    const barrel = GB.aim ? GB.aim.barrelDir(P.raise, PL.facing, P.recoil) : { x: PL.facing, y: -0.05 };
    const ray = GB.geom.castRay(m.x, m.y, m.x + barrel.x * 900, m.y + barrel.y * 900, (px, py) => {
      if (O.hp > 0) {
        return GB.chars.sideHitTest(OP.x, OP.y, OP.scale, OP.facing, S.oppHeadScale(), O.hatOn, px, py, O.missing);
      }
      if (GB.ragdoll && GB.ragdoll.hitAt(px, py)) return 'corpse';
      return null;
    }, barrel);

    // Recoil kicks the barrel AFTER the shot — follow-ups climb unless you re-aim.
    P.recoil = 1;
    P.raise = GB.aim ? GB.aim.clampRaise(P.raise - 0.12) : Math.max(0, P.raise - 0.12);
    P.aimRecover = 0.22;

    const dir = GB.geom.norm(ray.x - m.x, ray.y - m.y);
    const angle = Math.atan2(dir.y, dir.x);
    GB.sfx.gunshot();
    GB.fx.flash(m.x, m.y, angle);
    GB.fx.tracer(m.x, m.y, ray.x, ray.y);

    if (O.hp <= 0) {
      if (ray.hit === 'corpse' && GB.ragdoll) {
        const info = GB.ragdoll.hitAt(ray.x, ray.y);
        const torn = info && GB.ragdoll.shot(info, dir, S.settings.gore === 'buckets');
        GB.fx.gibs(ray.x, ray.y, torn ? 14 : 8, angle, gibColors(O.cfg));
        GB.fx.blood(ray.x, ray.y, torn ? 28 : 16, angle);
        GB.sfx.fleshHit();
        juice(torn ? 'disarm' : 'hit');
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
      const dead = applyHit(O, OP, part, dmg, { x: ray.x, y: ray.y }, dir, false);
      if (dead) {
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
    tryDeclareDraw();
  }

  function draw(ctx) {
    if (!S) return;
    const P = S.player, O = S.opp;
    const shake = S.trauma * S.trauma;
    const ox = shake * 12 * Math.sin(S.t * 71.3);
    const oy = shake * 9 * Math.sin(S.t * 63.1 + 1.2);

    ctx.save();
    ctx.translate(ox, oy);

    GB.scene.draw(ctx, S.level, 1 / 60);
    GB.fx.drawStains(ctx);
    if (!(S.ragdoll && S.ragdoll.player)) {
      GB.chars.drawSide(ctx, PL.x, PL.y, PL.scale, P.cfg, {
        facing: PL.facing, raise: P.raise, recoil: P.recoil,
        hurt: P.hurt, breathe: S.t, wounds: P.wounds, missing: P.missing
      });
    }
    if (!(S.ragdoll && S.ragdoll.opp)) {
      GB.chars.drawSide(ctx, OP.x, OP.y, OP.scale, O.cfg, {
        facing: OP.facing, raise: O.raise, recoil: O.recoil,
        hurt: O.hurt, hatOff: !O.hatOn,
        breathe: S.t + 1.7, headScale: S.oppHeadScale(), wounds: O.wounds,
        missing: O.missing
      });
    }
    if (GB.ragdoll) GB.ragdoll.draw(ctx);
    GB.fx.draw(ctx);
    ctx.restore();

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
    if (S.phase === 'over' && S.canContinue && !S.ended) {
      ctx.save();
      const pulse = 0.82 + Math.sin(S.t * 5) * 0.18;
      ctx.globalAlpha = pulse;
      GB.chars.rr(ctx, W / 2 - 210, CONTINUE_Y0 + 6, 420, 44, 8);
      ctx.fillStyle = 'rgba(20,10,4,.78)';
      ctx.fill();
      ctx.strokeStyle = '#e0a52e';
      ctx.lineWidth = 2;
      GB.chars.rr(ctx, W / 2 - 210, CONTINUE_Y0 + 6, 420, 44, 8);
      ctx.stroke();
      ctx.font = 'bold 18px Georgia';
      ctx.fillStyle = '#e0a52e';
      ctx.textAlign = 'center';
      const label = S.result === 'win'
        ? 'KEEP SHOOTING  ·  SPACE / CLICK HERE TO CONTINUE'
        : 'CLICK OR SPACE TO CONTINUE';
      ctx.fillText(label, W / 2, CONTINUE_Y0 + 35);
      ctx.restore();
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
    const aiming = (S.phase === 'fire' || (S.phase === 'over' && S.result === 'win')) && S.player.hp > 0 && !S.player.missing.gunArm;
    if (aiming && GB.aim) {
      const m = GB.chars.sideMuzzlePoint(PL.x, PL.y, PL.scale, PL.facing, S.player.raise, S.player.recoil);
      const barrel = GB.aim.barrelDir(S.player.raise, PL.facing, S.player.recoil);
      const fade = S.player.shots === 0 ? 0.48 : 0.22;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 215, 107, ' + fade + ')';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 9]);
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + barrel.x * 820, m.y + barrel.y * 820);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = aiming ? '#ffd76b' : '#e8d5a3';
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

  function inContinuePlate(x, y) {
    return S.canContinue && y >= CONTINUE_Y0 && y <= CONTINUE_Y1 && x >= W / 2 - 220 && x <= W / 2 + 220;
  }

  function mouseDown(x, y) {
    if (!S) return;
    if (S.phase === 'over' && S.canContinue && !S.ended) {
      if (S.result !== 'win' || inContinuePlate(x, y)) {
        finishDuel();
        return;
      }
    }
    playerShoot(x, y);
  }

  function keyDown(key) {
    if (!S) return;
    if ((key === ' ' || key === 'Enter' || key === 'Spacebar') && S.phase === 'over' && S.canContinue) {
      finishDuel();
    }
  }

  return {
    start, update, draw, mouseMove, mouseDown, keyDown,
    get state() { return S; }
  };
})();
