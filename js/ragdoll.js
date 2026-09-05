/* DUEL — Matter.js limp-body ragdoll
 *
 * Why this exists:
 *   The old death anim was a hand-rolled Verlet stick figure. It froze after
 *   ~1.3s and never really *flopped*. This module builds a cowboy-shaped
 *   rigid-body ragdoll (head, torso, two arms, two thighs, two shins) with
 *   pin joints, then draws each body with the same palette as drawSide().
 *
 * Important Matter.js gotchas we already burned on:
 *   1. Composite.create({ bodies, constraints }) does NOT register children
 *      correctly. Always Composite.add(composite, bodyOrConstraint).
 *   2. Constraint.pointA / pointB are world-space offsets from body.position
 *      at creation time (Matter then rotates them as the body spins). Pass
 *      `worldJoint - body.position`, not unrotated local coords.
 *   3. Pin joints: length: 0 + stiffness ~0.7. A wrong rest-length explodes
 *      the doll on the first step.
 */
window.GB = window.GB || {};

GB.ragdoll = (function () {
  const STEP_MS = 1000 / 60;
  const FLOOR_Y = 470;

  let engine = null;
  let acc = 0;
  const dolls = [];
  const meta = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function M() {
    if (typeof Matter === 'undefined') return null;
    return Matter;
  }

  function ensure() {
    const Mt = M();
    if (!Mt) return null;
    if (engine) return engine;
    engine = Mt.Engine.create({
      enableSleeping: true,
      gravity: { x: 0, y: 1.25 }
    });
    engine.positionIterations = 10;
    engine.velocityIterations = 8;
    engine.constraintIterations = 6;
    addBounds();
    return engine;
  }

  function addBounds() {
    const Mt = M();
    const opts = { isStatic: true, friction: 0.98, restitution: 0.05, label: 'ground' };
    // Floor top sits at FLOOR_Y so boots rest on the dirt instead of hovering.
    Mt.Composite.add(engine.world, [
      Mt.Bodies.rectangle(480, FLOOR_Y + 50, 4200, 100, opts),
      Mt.Bodies.rectangle(-200, 270, 80, 2400, Object.assign({}, opts, { label: 'wall' })),
      Mt.Bodies.rectangle(1160, 270, 80, 2400, Object.assign({}, opts, { label: 'wall' }))
    ]);
  }

  function reset() {
    const Mt = M();
    if (!Mt) return;
    const e = ensure();
    Mt.Composite.clear(e.world, false);
    dolls.length = 0;
    acc = 0;
    addBounds();
  }

  function worldOf(geo, lx, ly) {
    return { x: geo.x + lx * geo.scale * geo.facing, y: geo.y + ly * geo.scale };
  }

  function worldAngle(localA, facing) {
    return Math.atan2(Math.sin(localA), facing * Math.cos(localA));
  }

  function groupFilter(group) {
    // Negative group = this doll's parts never collide with each other.
    // Category 2 / mask 1 = they still collide with the static ground (cat 1).
    return { group: group, category: 0x0002, mask: 0x0001 };
  }

  function tag(body, kind, who) {
    if (meta) meta.set(body, { kind: kind, who: who });
    body.plugin = body.plugin || {};
    body.plugin.kind = kind;
    body.plugin.who = who;
    return body;
  }

  function kindOf(body) {
    if (meta && meta.get(body)) return meta.get(body).kind;
    return body.plugin && body.plugin.kind;
  }

  function rect(kind, who, x, y, w, h, angle, group, extra) {
    const Mt = M();
    const body = Mt.Bodies.rectangle(x, y, w, h, Object.assign({
      angle: angle,
      collisionFilter: groupFilter(group),
      friction: 0.85,
      frictionStatic: 0.9,
      frictionAir: 0.045,
      restitution: kind === 'head' ? 0.22 : 0.08,
      density: kind === 'torso' ? 0.0024 : 0.0014,
      chamfer: { radius: Math.min(6, Math.min(w, h) * 0.28) },
      label: kind,
      sleepThreshold: 28
    }, extra || {}));
    return tag(body, kind, who);
  }

  function circle(kind, who, x, y, r, group) {
    const Mt = M();
    const body = Mt.Bodies.circle(x, y, r, {
      collisionFilter: groupFilter(group),
      friction: 0.7,
      frictionAir: 0.04,
      restitution: 0.22,
      density: 0.0011,
      label: kind,
      sleepThreshold: 28
    });
    return tag(body, kind, who);
  }

  // Pin two bodies together at a shared world-space point.
  function pin(name, a, b, world, stiffness) {
    const Mt = M();
    return Mt.Constraint.create({
      bodyA: a,
      bodyB: b,
      pointA: { x: world.x - a.position.x, y: world.y - a.position.y },
      pointB: { x: world.x - b.position.x, y: world.y - b.position.y },
      stiffness: stiffness == null ? 0.72 : stiffness,
      damping: 0.15,
      length: 0,
      label: name,
      render: { visible: false }
    });
  }

  /**
   * Spawn a cowboy ragdoll at the standing pose.
   * geo    = { x, y, scale, facing }
   * opts   = { who, cfg, hatOn, raise, headScale, dir, impact, part, missing }
   */
  function spawn(geo, opts) {
    const Mt = M();
    if (!Mt) return null;
    const e = ensure();
    opts = opts || {};
    const who = opts.who || 'opp';
    // Replace any previous doll for this side (new duel / double-kill guard).
    for (let i = dolls.length - 1; i >= 0; i--) {
      if (dolls[i].who === who) {
        Mt.Composite.remove(e.world, dolls[i].composite);
        dolls.splice(i, 1);
      }
    }

    const s = geo.scale, f = geo.facing;
    const miss = Object.assign({}, opts.missing || {});
    const group = Mt.Body.nextGroup(true);
    const bodies = {};
    const joints = {};
    const parts = [];
    const cons = [];
    const wpos = function (lx, ly) { return worldOf(geo, lx, ly); };
    const skip = function (p) { return !!miss[p]; };

    const torsoC = wpos(0, -109);
    bodies.torso = rect('torso', who, torsoC.x, torsoC.y, 34 * s, 66 * s, 0, group);
    parts.push(bodies.torso);

    if (!skip('head')) {
      const hs = opts.headScale || 1;
      const c = wpos(4, -160);
      bodies.head = circle('head', who, c.x, c.y, 19 * s * hs, group);
      parts.push(bodies.head);
      joints.neck = pin('neck', bodies.torso, bodies.head, wpos(4, -141), 0.7);
      cons.push(joints.neck);
    }

    if (!skip('gunArm')) {
      const raise = opts.raise || 0;
      const a = 1.32 + (-0.06 - 1.32) * raise; // matches characters.js armAngle
      const wa = worldAngle(a, f);
      const dirx = Math.cos(wa), diry = Math.sin(wa);
      const sh = wpos(2, -128);
      const uLen = 18 * s, lLen = 22 * s;
      bodies.gunUpper = rect('gunUpper', who, sh.x + dirx * (uLen / 2), sh.y + diry * (uLen / 2), uLen, 12 * s, wa, group);
      bodies.gunLower = rect('gunLower', who, sh.x + dirx * (uLen + lLen / 2), sh.y + diry * (uLen + lLen / 2), lLen, 12 * s, wa, group);
      parts.push(bodies.gunUpper, bodies.gunLower);
      joints.gunShoulder = pin('gunShoulder', bodies.torso, bodies.gunUpper, sh, 0.78);
      joints.gunElbow = pin('gunElbow', bodies.gunUpper, bodies.gunLower, { x: sh.x + dirx * uLen, y: sh.y + diry * uLen }, 0.72);
      cons.push(joints.gunShoulder, joints.gunElbow);
    }

    if (!skip('farArm')) {
      const ldx = -5, ldy = 36;
      const len = Math.hypot(ldx, ldy);
      const wa = worldAngle(Math.atan2(ldy, ldx), f);
      const dirx = Math.cos(wa), diry = Math.sin(wa);
      const sh = wpos(-4, -126);
      const uLen = len * 0.48 * s, lLen = len * 0.52 * s;
      bodies.farUpper = rect('farUpper', who, sh.x + dirx * (uLen / 2), sh.y + diry * (uLen / 2), uLen, 11 * s, wa, group);
      bodies.farLower = rect('farLower', who, sh.x + dirx * (uLen + lLen / 2), sh.y + diry * (uLen + lLen / 2), lLen, 11 * s, wa, group);
      parts.push(bodies.farUpper, bodies.farLower);
      joints.farShoulder = pin('farShoulder', bodies.torso, bodies.farUpper, sh, 0.7);
      joints.farElbow = pin('farElbow', bodies.farUpper, bodies.farLower, { x: sh.x + dirx * uLen, y: sh.y + diry * uLen }, 0.68);
      cons.push(joints.farShoulder, joints.farElbow);
    }

    function addLeg(prefix, hipLocalX, hipKey, kneeKey) {
      if (skip(prefix === 'near' ? 'nearLeg' : 'farLeg')) return;
      const hip = wpos(hipLocalX, -82);
      const tLen = 34 * s, sLen = 48 * s;
      bodies[prefix + 'Thigh'] = rect(prefix + 'Thigh', who, hip.x, hip.y + tLen / 2, 15 * s, tLen, 0, group, { density: 0.0018 });
      bodies[prefix + 'Shin'] = rect(prefix + 'Shin', who, hip.x, hip.y + tLen + sLen / 2, 15 * s, sLen, 0, group, { density: 0.0017, friction: 0.95 });
      parts.push(bodies[prefix + 'Thigh'], bodies[prefix + 'Shin']);
      joints[hipKey] = pin(hipKey, bodies.torso, bodies[prefix + 'Thigh'], hip, 0.8);
      joints[kneeKey] = pin(kneeKey, bodies[prefix + 'Thigh'], bodies[prefix + 'Shin'], { x: hip.x, y: hip.y + tLen }, 0.74);
      cons.push(joints[hipKey], joints[kneeKey]);
    }
    addLeg('near', 7.5, 'nearHip', 'nearKnee');
    addLeg('far', -7.5, 'farHip', 'farKnee');

    const composite = Mt.Composite.create({ label: 'ragdoll-' + who });
    Mt.Composite.add(composite, parts);
    Mt.Composite.add(composite, cons);
    Mt.Composite.add(e.world, composite);

    const doll = {
      who: who,
      cfg: opts.cfg,
      facing: f,
      scale: s,
      hatOn: !!opts.hatOn,
      headScale: opts.headScale || 1,
      missing: miss,
      composite: composite,
      bodies: bodies,
      joints: joints,
      broken: {},
      age: 0,
      heavy: !!(opts.cfg && opts.cfg.robot)
    };
    if (doll.heavy) {
      for (let i = 0; i < parts.length; i++) {
        const b = parts[i];
        Mt.Body.setDensity(b, b.density * 2.8);
        b.frictionAir = (b.frictionAir || 0.04) * 0.5;
        b.restitution = Math.min(0.05, (b.restitution || 0.08) * 0.3);
        b.friction = Math.min(0.98, (b.friction || 0.8) + 0.1);
      }
    }
    dolls.push(doll);
    applyImpulse(doll, opts.dir || { x: f, y: -0.2 }, opts.impact || torsoC, opts.part || 'torso');
    return doll;
  }

  function applyImpulse(doll, dir, impact, part) {
    const Mt = M();
    const massK = doll.heavy ? 0.46 : 1;
    const knock = (part === 'head' ? 9 : part === 'torso' ? 7.5 : 6.5) * massK;
    const up = (part === 'head' ? 3.8 : 2.4) * massK;
    let closest = null, best = Infinity;
    for (const k in doll.bodies) {
      const b = doll.bodies[k];
      const d = (b.position.x - impact.x) * (b.position.x - impact.x) + (b.position.y - impact.y) * (b.position.y - impact.y);
      if (d < best) { best = d; closest = b; }
    }
    for (const k in doll.bodies) {
      const b = doll.bodies[k];
      Mt.Sleeping.set(b, false);
      const falloff = b === closest ? 1 : 0.55;
      Mt.Body.setVelocity(b, {
        x: b.velocity.x + dir.x * knock * falloff,
        y: b.velocity.y + dir.y * knock * falloff - up * falloff
      });
    }
    if (closest) {
      const spin = (dir.x >= 0 ? 1 : -1) * (part === 'head' ? 0.28 : 0.16);
      Mt.Body.setAngularVelocity(closest, closest.angularVelocity + spin);
    }
  }

  function getDoll(who) {
    for (let i = 0; i < dolls.length; i++) if (dolls[i].who === who) return dolls[i];
    return null;
  }

  function hitAt(px, py) {
    const Mt = M();
    if (!Mt) return null;
    const point = { x: px, y: py };
    for (let i = 0; i < dolls.length; i++) {
      const doll = dolls[i];
      const list = [];
      for (const k in doll.bodies) list.push(doll.bodies[k]);
      const hits = Mt.Query.point(list, point);
      if (hits.length) {
        return { doll: doll, kind: kindOf(hits[0]), body: hits[0] };
      }
    }
    return null;
  }

  const KIND_JOINT = {
    head: 'neck',
    gunUpper: 'gunShoulder', gunLower: 'gunElbow',
    farUpper: 'farShoulder', farLower: 'farElbow',
    nearThigh: 'nearHip', nearShin: 'nearKnee',
    farThigh: 'farHip', farShin: 'farKnee'
  };
  const PART_JOINT = {
    head: 'neck', gunArm: 'gunShoulder', farArm: 'farShoulder',
    nearLeg: 'nearHip', farLeg: 'farHip'
  };
  const PART_KINDS = {
    head: ['head'],
    gunArm: ['gunUpper', 'gunLower'],
    farArm: ['farUpper', 'farLower'],
    nearLeg: ['nearThigh', 'nearShin'],
    farLeg: ['farThigh', 'farShin']
  };

  function breakJoint(doll, jointName) {
    const Mt = M();
    const c = doll.joints[jointName];
    if (!c || doll.broken[jointName]) return false;
    Mt.Composite.remove(doll.composite, c);
    doll.broken[jointName] = true;
    return true;
  }

  // Tear a named limb off an existing doll (killing blow / corpse shot).
  function tear(who, part, dir) {
    const Mt = M();
    const doll = getDoll(who);
    if (!Mt || !doll) return false;
    const jointName = PART_JOINT[part];
    if (!jointName || !breakJoint(doll, jointName)) return false;
    doll.missing[part] = true;
    const kinds = PART_KINDS[part] || [];
    dir = dir || { x: 1, y: -0.2 };
    for (let i = 0; i < kinds.length; i++) {
      const b = doll.bodies[kinds[i]];
      if (!b) continue;
      Mt.Sleeping.set(b, false);
      Mt.Body.setVelocity(b, {
        x: b.velocity.x + dir.x * 3.2,
        y: b.velocity.y + dir.y * 3.2 - 2.2
      });
      Mt.Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - 0.5) * 0.25);
    }
    return true;
  }

  function shot(info, dir, buckets) {
    const Mt = M();
    if (!Mt || !info) return false;
    const body = info.body, doll = info.doll;
    Mt.Sleeping.set(body, false);
    const kick = (doll.cfg && doll.cfg.robot) ? 0.48 : 1;
    Mt.Body.setVelocity(body, {
      x: body.velocity.x + dir.x * 10 * kick,
      y: body.velocity.y + dir.y * 10 * kick - 4 * kick
    });
    Mt.Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.35);
    if (!buckets) return false;
    const jointName = KIND_JOINT[info.kind];
    if (!jointName) return false;
    return breakJoint(doll, jointName);
  }

  function pelvis(who) {
    const doll = getDoll(who);
    if (!doll || !doll.bodies.torso) return null;
    return { x: doll.bodies.torso.position.x, y: doll.bodies.torso.position.y + 20 };
  }

  function step(dt) {
    const Mt = M();
    if (!Mt || !engine || !dolls.length) return;
    acc += Math.min(dt, 0.08) * 1000;
    let guard = 0;
    while (acc >= STEP_MS && guard++ < 4) {
      Mt.Engine.update(engine, STEP_MS);
      acc -= STEP_MS;
    }
    for (let i = 0; i < dolls.length; i++) dolls[i].age += dt;
  }

  function shade(hex, k) {
    if (GB.chars && GB.chars.shade) return GB.chars.shade(hex, k);
    return hex;
  }

  function meat(ctx, x, y, r) {
    ctx.fillStyle = '#4a0808';
    ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, 7); ctx.fill();
    ctx.fillStyle = '#8c1a14';
    ctx.beginPath(); ctx.arc(x, y, r * 0.7, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8e2d2';
    ctx.beginPath(); ctx.ellipse(x + 0.3, y - 0.4, r * 0.26, r * 0.32, 0.2, 0, 7); ctx.fill();
  }

  const DRAW_ORDER = [
    'farUpper', 'farLower', 'farThigh', 'farShin',
    'torso',
    'nearThigh', 'nearShin', 'gunUpper', 'gunLower', 'head'
  ];

  function drawPart(ctx, kind, cfg, doll) {
    if (cfg && cfg.robot && GB.chars && GB.chars.drawEndoRagdollPart) {
      GB.chars.drawEndoRagdollPart(ctx, kind, cfg, doll);
      return;
    }
    const boot = shade(cfg.pants, 0.5);
    if (kind === 'head') {
      ctx.fillStyle = cfg.bandana;
      ctx.beginPath(); ctx.moveTo(-12, 14); ctx.lineTo(10, 14); ctx.lineTo(3, 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = cfg.skin;
      ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(16, -5); ctx.lineTo(26, 1); ctx.lineTo(15, 7); ctx.closePath(); ctx.fill();
      ctx.fillStyle = cfg.hair;
      ctx.beginPath(); ctx.arc(0, -1, 19, Math.PI * 0.55, Math.PI * 1.45); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(8, -4, 3.6, 4.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1208';
      ctx.beginPath(); ctx.arc(9.4, -3.5, 1.8, 0, 7); ctx.fill();
      if (doll.hatOn) {
        ctx.fillStyle = cfg.hat;
        ctx.beginPath(); ctx.ellipse(1, -12, 27, 6.5, 0, 0, 7); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-12, -12);
        ctx.quadraticCurveTo(-14, -32, -5, -33);
        ctx.quadraticCurveTo(1, -28, 7, -33);
        ctx.quadraticCurveTo(16, -32, 14, -12);
        ctx.closePath(); ctx.fill();
      }
      if (doll.broken.neck) meat(ctx, 0, 18, 7);
      return;
    }
    if (kind === 'torso') {
      ctx.fillStyle = cfg.shirt;
      if (GB.chars && GB.chars.rr) GB.chars.rr(ctx, -17, -33, 34, 66, 8); else ctx.fillRect(-17, -33, 34, 66);
      ctx.fill();
      ctx.fillStyle = cfg.vest;
      if (GB.chars && GB.chars.rr) GB.chars.rr(ctx, -6, -33, 23, 62, 6); else ctx.fillRect(-6, -33, 23, 62);
      ctx.fill();
      ctx.fillStyle = '#2b1a0a'; ctx.fillRect(-17, 21, 34, 9);
      ctx.fillStyle = '#e0a52e'; ctx.fillRect(7, 20, 9, 11);
      if (doll.missing.head) meat(ctx, 4, -33, 9);
      if (doll.missing.gunArm) meat(ctx, 2, -19, 7);
      if (doll.missing.farArm) meat(ctx, -4, -17, 6.5);
      if (doll.missing.nearLeg) meat(ctx, 7.5, 29, 8);
      if (doll.missing.farLeg) meat(ctx, -7.5, 29, 8);
      return;
    }
    const armish = kind === 'gunUpper' || kind === 'gunLower' || kind === 'farUpper' || kind === 'farLower';
    if (armish) {
      const dark = kind.indexOf('far') === 0;
      const half = kind.indexOf('Lower') >= 0 ? 11 : 9;
      ctx.strokeStyle = shade(cfg.shirt, dark ? 0.72 : 0.92);
      ctx.lineWidth = dark ? 11 : 12;
      ctx.beginPath(); ctx.moveTo(-half, 0); ctx.lineTo(half, 0); ctx.stroke();
      if (kind === 'gunLower' || kind === 'farLower') {
        ctx.fillStyle = dark ? shade(cfg.skin, 0.8) : cfg.skin;
        ctx.beginPath(); ctx.arc(half, 0, dark ? 6 : 7, 0, 7); ctx.fill();
      }
      if (doll.broken[KIND_JOINT[kind]]) meat(ctx, -half, 0, 6);
      return;
    }
    const far = kind.indexOf('far') === 0;
    const shin = kind.indexOf('Shin') >= 0;
    ctx.fillStyle = far ? shade(cfg.pants, 0.8) : cfg.pants;
    if (shin) {
      if (GB.chars && GB.chars.rr) GB.chars.rr(ctx, -7.5, -24, 15, 36, 5); else ctx.fillRect(-7.5, -24, 15, 36);
      ctx.fill();
      ctx.fillStyle = far ? shade(boot, 0.8) : boot;
      if (GB.chars && GB.chars.rr) GB.chars.rr(ctx, -8.5, 12, 21, 12, 3); else ctx.fillRect(-8.5, 12, 21, 12);
      ctx.fill();
    } else {
      if (GB.chars && GB.chars.rr) GB.chars.rr(ctx, -7.5, -17, 15, 34, 5); else ctx.fillRect(-7.5, -17, 15, 34);
      ctx.fill();
    }
    if (doll.broken[KIND_JOINT[kind]]) meat(ctx, 0, shin ? -24 : -17, 7);
  }

  function draw(ctx) {
    for (let d = 0; d < dolls.length; d++) {
      const doll = dolls[d];
      for (let i = 0; i < DRAW_ORDER.length; i++) {
        const kind = DRAW_ORDER[i];
        const body = doll.bodies[kind];
        if (!body) continue;
        const mirror = kind === 'head' || kind === 'torso' || kind.indexOf('Thigh') >= 0 || kind.indexOf('Shin') >= 0;
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        if (mirror) ctx.scale(doll.scale * doll.facing, doll.scale);
        else ctx.scale(doll.scale, doll.scale * doll.facing);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        drawPart(ctx, kind, doll.cfg, doll);
        ctx.restore();
      }
    }
  }

  return { reset: reset, spawn: spawn, step: step, draw: draw, getDoll: getDoll, hitAt: hitAt, tear: tear, shot: shot, pelvis: pelvis, available: function () { return !!M(); } };
})();
