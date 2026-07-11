/* DUEL — bonus rounds: shoot the bottles, never the assistant */
window.GB = window.GB || {};

GB.Bonus = (function () {
  const W = 960, H = 540;
  const AST = { x: 600, y: 470, scale: 1.25 };
  const ASSISTANT_CFG = {
    skin: '#e8b98a', hair: '#6b4a2a', hat: '#e8d5a3', shirt: '#e8e2d2',
    vest: '#8c6238', pants: '#4a3527', bandana: '#c23b2e', gun: '#555',
    hatStyle: 1, mustache: false, beard: false
  };
  const BOTTLE_COLORS = ['#3e7d4f', '#7d5a2f', '#4f6b8c', '#7d3e5e'];

  let S = null;

  function bottleAt(x, y, i) {
    return { x, y, vx: 0, vy: 0, rot: 0, vr: 0, air: false, alive: true, color: BOTTLE_COLORS[i % BOTTLE_COLORS.length] };
  }

  function start(opts) {
    const type = opts.index % 2; // 0 = steady hands, 1 = toss-up
    const s = AST.scale;
    S = {
      opts, type, t: 0, phase: 'intro', phaseT: 0,
      title: type === 0 ? 'STEADY HANDS' : 'TOSS-UP',
      timeLeft: type === 0 ? 10 : 14,
      shots: opts.cheats.moreammo ? Infinity : (type === 0 ? 8 : 10),
      points: 0, targetsDown: 0, totalTargets: type === 0 ? 5 : 6,
      tossesLeft: type === 1 ? 6 : 0, nextToss: 1.2,
      bottles: [],
      assistantHit: false, cooldown: 0,
      aim: { x: W / 2, y: H / 2 },
      ended: false, endT: 0, banner: '', bannerCol: '#e0a52e'
    };
    if (type === 0) {
      // on head, in each outstretched hand, and on two posts
      S.bottles.push(bottleAt(AST.x, AST.y - 196 * s, 0));            // head
      S.bottles.push(bottleAt(AST.x - 58 * s, AST.y - 148 * s, 1));   // left hand
      S.bottles.push(bottleAt(AST.x + 58 * s, AST.y - 148 * s, 2));   // right hand
      S.bottles.push(bottleAt(430, 402, 3));                          // posts
      S.bottles.push(bottleAt(770, 402, 0));
    }
    GB.fx.clear();
  }

  function setPhase(p) { S.phase = p; S.phaseT = 0; }

  function update(dt) {
    if (!S) return;
    S.t += dt; S.phaseT += dt;
    S.cooldown = Math.max(0, S.cooldown - dt);

    if (S.phase === 'intro') {
      if (S.phaseT > 2.4) setPhase('play');
    } else if (S.phase === 'play') {
      S.timeLeft -= dt;

      // toss-up: lob bottles one at a time
      if (S.type === 1 && S.tossesLeft > 0) {
        S.nextToss -= dt;
        if (S.nextToss <= 0) {
          S.tossesLeft--;
          S.nextToss = 1.5 + Math.random() * 0.5;
          const b = bottleAt(AST.x - 58 * AST.scale, AST.y - 148 * AST.scale, (6 - S.tossesLeft));
          b.air = true;
          b.vx = -40 - Math.random() * 160;
          b.vy = -520 - Math.random() * 90;
          b.vr = (Math.random() - 0.5) * 10;
          S.bottles.push(b);
          GB.sfx.toss();
        }
      }
      // physics for airborne bottles
      for (const b of S.bottles) {
        if (!b.alive || !b.air) continue;
        b.vy += 640 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += b.vr * dt;
        if (b.y > 470) { // hits the dirt unbroken
          b.alive = false;
          GB.fx.spawnShards(b.x, 470, b.color, 8);
          GB.fx.spawnDust(b.x, 474, 5);
          GB.sfx.smash();
        }
      }

      const liveStatic = S.bottles.some(b => b.alive && !b.air);
      const liveAir = S.bottles.some(b => b.alive && b.air);
      const doneTossing = S.type === 0 || S.tossesLeft === 0;
      const cleared = S.targetsDown >= S.totalTargets;
      const outOfShots = S.shots <= 0 && !liveAir;
      const outOfTime = S.timeLeft <= 0;
      const nothingLeft = doneTossing && !liveStatic && !liveAir && S.type === 1;

      if (cleared || outOfShots || outOfTime || nothingLeft) {
        finish(cleared);
      }
    } else if (S.phase === 'over') {
      if (!S.ended && S.phaseT > 2.2) {
        S.ended = true;
        S.opts.onEnd({ points: S.points, perfect: S.targetsDown >= S.totalTargets, shotAssistant: S.assistantHit });
      }
    }

    GB.fx.update(dt);
  }

  function finish(cleared) {
    if (S.phase === 'over') return;
    if (cleared) {
      S.points += 500;
      S.banner = 'PERFECT! +500';
      S.bannerCol = '#e0a52e';
      GB.sfx.winSting();
    } else {
      S.banner = 'BONUS OVER — +' + S.points;
      S.bannerCol = '#e8d5a3';
    }
    setPhase('over');
  }

  function shootAssistant() {
    S.assistantHit = true;
    S.points = 0;
    S.banner = 'YOU SHOT THE ASSISTANT!';
    S.bannerCol = '#ff5040';
    GB.fx.spawnText(AST.x, AST.y - 220, 'OW!', '#ff5040', 26);
    GB.sfx.fleshHit();
    GB.sfx.loseSting();
    setPhase('over');
  }

  function mouseDown(x, y) {
    if (!S || S.phase !== 'play') return;
    if (S.cooldown > 0) return;
    if (S.shots <= 0) { GB.sfx.dryFire(); return; }
    S.cooldown = S.opts.cheats.fastfire ? 0.07 : 0.24;
    if (S.shots !== Infinity) S.shots--;
    GB.sfx.gunshot();

    // bottles first (they sit in front of the assistant)
    for (const b of S.bottles) {
      if (!b.alive) continue;
      const dx = x - b.x, dy = y - (b.y - 17);
      if (Math.abs(dx) <= 14 && Math.abs(dy) <= 22) {
        b.alive = false;
        S.targetsDown++;
        const pts = b.air ? 250 : 200;
        S.points += pts;
        GB.fx.spawnShards(b.x, b.y - 17, b.color, 14);
        GB.fx.spawnText(b.x, b.y - 40, '+' + pts, '#e0a52e', 20);
        GB.sfx.smash();
        GB.sfx.point();
        return;
      }
    }
    // then the assistant — any body part ends the round
    const part = GB.chars.hitTest(AST.x, AST.y, AST.scale, 1, true, x, y);
    if (part && part !== 'hat') { shootAssistant(); return; }
    if (part === 'hat') { GB.sfx.ricochet(); GB.fx.spawnText(x, y - 20, 'CAREFUL!', '#ff5040', 16); return; }
    // miss
    if (y > 440) GB.fx.spawnDust(x, Math.max(y, 450), 6);
    if (Math.random() < 0.6) GB.sfx.ricochet();
  }

  function mouseMove(x, y) { if (S) { S.aim.x = x; S.aim.y = y; } }

  // ---------- drawing ----------
  function drawBottle(ctx, b) {
    ctx.save();
    ctx.translate(b.x, b.y);
    if (b.air) ctx.rotate(b.rot);
    ctx.fillStyle = b.color;
    GB.chars.rr(ctx, -9, -26, 18, 26, 5); ctx.fill();          // body
    ctx.fillRect(-3.5, -38, 7, 14);                            // neck
    ctx.fillStyle = GB.chars.shade(b.color, 1.5);
    ctx.fillRect(-1, -24, 4, 18);                              // shine
    ctx.fillStyle = '#2b1a0a';
    ctx.fillRect(-3.5, -40, 7, 4);                             // cork
    ctx.restore();
  }

  function drawPost(ctx, x) {
    ctx.fillStyle = '#4b3a22';
    ctx.fillRect(x - 6, 402, 12, 70);
    ctx.fillStyle = '#3a2c18';
    ctx.fillRect(x - 10, 398, 20, 8);
  }

  function draw(ctx) {
    if (!S) return;
    GB.scene.draw(ctx, S.opts.level || 1, 1 / 60);

    if (S.type === 0) { drawPost(ctx, 430); drawPost(ctx, 770); }

    // assistant — nervous knees, arms out when holding bottles
    const armsOut = S.type === 0 ? 1 : 0.35;
    GB.chars.draw(ctx, AST.x, AST.y, AST.scale, ASSISTANT_CFG, {
      armsOut, breathe: S.t * 3,
      hurt: S.assistantHit ? 1 : 0,
      fall: S.assistantHit ? Math.min(1, S.phaseT * 1.5) : 0, fallDir: -1
    });

    for (const b of S.bottles) if (b.alive) drawBottle(ctx, b);

    GB.fx.draw(ctx);
    drawHud(ctx);
    drawMessages(ctx);
    drawCrosshair(ctx);
  }

  function drawHud(ctx) {
    ctx.fillStyle = 'rgba(20,10,4,.55)';
    GB.chars.rr(ctx, W / 2 - 220, 10, 440, 54, 8); ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px Georgia';
    ctx.fillStyle = '#e0a52e';
    ctx.fillText('BONUS: ' + S.title, W / 2, 32);
    ctx.font = '14px Georgia';
    ctx.fillStyle = '#e8d5a3';
    const shots = S.shots === Infinity ? '∞' : S.shots;
    ctx.fillText('TIME ' + Math.max(0, S.timeLeft).toFixed(1) + '   ·   SHOTS ' + shots + '   ·   POINTS ' + S.points, W / 2, 54);
  }

  function drawMessages(ctx) {
    ctx.textAlign = 'center';
    if (S.phase === 'intro') {
      ctx.fillStyle = 'rgba(20,10,4,.75)';
      ctx.fillRect(0, 180, W, 140);
      ctx.font = 'bold 40px Georgia';
      ctx.fillStyle = '#e0a52e';
      ctx.fillText('BONUS ROUND — ' + S.title, W / 2, 232);
      ctx.font = 'bold 20px Georgia';
      ctx.fillStyle = '#e8d5a3';
      ctx.fillText(S.type === 0 ? 'Shoot every bottle. Do NOT shoot the assistant!' : 'Shoot the bottles out of the air. Spare the assistant!', W / 2, 268);
      ctx.font = 'italic 15px Georgia';
      ctx.fillText('Get them all for a PERFECT bonus', W / 2, 296);
    }
    if (S.phase === 'over') {
      ctx.font = 'bold 44px Georgia';
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText(S.banner, W / 2, 190);
      ctx.fillStyle = S.bannerCol;
      ctx.fillText(S.banner, W / 2, 190);
    }
  }

  function drawCrosshair(ctx) {
    const { x, y } = S.aim;
    ctx.strokeStyle = '#ffd76b';
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
  }

  return { start, update, draw, mouseMove, mouseDown, get state() { return S; } };
})();
