/* DUEL match — load base + barrel-elevation aiming patch */
(function () {
  var BASE = 'https://cdn.jsdelivr.net/gh/balug87/Duel@1c98a389d7bbb66c851188f5449d34b4596448ef/js/match.js';
  var s = document.createElement('script');
  s.src = BASE;
  s.crossOrigin = 'anonymous';
  s.onload = function () { setTimeout(patchAim, 0); };
  s.onerror = function () { console.error('Failed to load base match.js from CDN'); };
  document.head.appendChild(s);

  var PL = { x: 115, y: 470, scale: 1.35, facing: 1 };

  function patchAim() {
    if (!window.GB || !GB.Duel || !GB.aim) {
      console.warn('[DUEL] aim patch skipped — missing modules');
      return;
    }
    var D = GB.Duel;
    var origUpdate = D.update;
    var origDraw = D.draw;
    var origMouseDown = D.mouseDown;

    // Keep arm elevation tracking the cursor while alive in fire/over-win.
    D.update = function (dt) {
      origUpdate.call(this, dt);
      var S = D.state;
      if (!S || !S.player || S.player.hp <= 0) return;
      if (S.phase === 'fire' || (S.phase === 'over' && S.result === 'win')) {
        var target = GB.aim.raiseFromAim(S.aim.x, S.aim.y, PL);
        S.player.raise += (target - S.player.raise) * Math.min(1, dt * 16);
      }
    };

    // On click: fire along the barrel, not through the cursor.
    D.mouseDown = function (x, y) {
      var S = D.state;
      if (!S || !S.player || S.player.hp <= 0 || !GB.aim || !GB.chars) {
        return origMouseDown.call(this, x, y);
      }
      if (S.phase !== 'fire' && !(S.phase === 'over' && S.result === 'win')) {
        return origMouseDown.call(this, x, y);
      }

      var P = S.player;
      var elev = P.raise;
      var m = GB.chars.sideMuzzlePoint(PL.x, PL.y, PL.scale, PL.facing, elev);
      var barrel = GB.aim.barrelDir(elev, PL.facing);
      var farX = m.x + barrel.x * 900;
      var farY = m.y + barrel.y * 900;

      // Prevent playerShoot from slamming the arm level (raise = 1) and from
      // computing the muzzle at full raise. Lock raise + wrap muzzle for this shot.
      var raiseLocked = elev;
      Object.defineProperty(P, 'raise', {
        configurable: true,
        enumerable: true,
        get: function () { return raiseLocked; },
        set: function (v) { /* ignore force-to-1 during this shot */ }
      });
      var realMuzzle = GB.chars.sideMuzzlePoint;
      GB.chars.sideMuzzlePoint = function (x, y, s, f, raise) {
        return realMuzzle(x, y, s, f, raiseLocked);
      };

      try {
        origMouseDown.call(this, farX, farY);
      } finally {
        GB.chars.sideMuzzlePoint = realMuzzle;
        Object.defineProperty(P, 'raise', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: raiseLocked
        });
      }
    };

    // Dashed trajectory guide along the current barrel line.
    D.draw = function (ctx) {
      origDraw.call(this, ctx);
      var S = D.state;
      if (!S || !S.player || S.player.hp <= 0 || !GB.aim || !GB.chars) return;
      if (!(S.phase === 'fire' || (S.phase === 'over' && S.result === 'win'))) return;
      var m = GB.chars.sideMuzzlePoint(PL.x, PL.y, PL.scale, PL.facing, S.player.raise);
      var barrel = GB.aim.barrelDir(S.player.raise, PL.facing);
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 215, 107, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 9]);
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + barrel.x * 820, m.y + barrel.y * 820);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    };

    console.log('[DUEL] barrel-elevation aiming active');
  }
})();
