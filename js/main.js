/* DUEL — boot, game loop, progression & scoring */
window.GB = window.GB || {};

GB.Game = (function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  let mode = 'menu';        // 'menu' | 'duel' | 'bonus'
  let run = null;           // current playthrough
  let retryAction = null;
  let lastT = 0;

  // ---------- playthrough ----------
  function newRun() {
    const cheats = GB.UI.getCheats();
    run = {
      settings: GB.UI.getSettings(),
      cheats,
      player: GB.UI.getCharacter(),
      level: Math.max(1, cheats.startLevel || 1),
      score: 0,
      duelsWon: 0,
      bonusIndex: 0
    };
  }

  function startGame() {
    newRun();
    if (run.cheats.startBonus > 0) {
      run.bonusIndex = run.cheats.startBonus - 1;
      startBonus();
    } else {
      startDuel();
    }
  }

  function opponentForLevel(level) {
    const list = GB.chars.OPPONENTS;
    return list[Math.min(level - 1, list.length - 1)];
  }

  function startDuel() {
    mode = 'duel';
    GB.UI.showScreen(null);
    GB.Duel.start({
      level: run.level,
      totalLevels: run.settings.opponents,
      oppDef: opponentForLevel(run.level),
      settings: run.settings,
      cheats: run.cheats,
      player: run.player,
      score: run.score,
      onHatShot() {
        run.score += 50;
        if (GB.Duel.state) GB.Duel.state.opts.score = run.score;
      },
      onEnd: duelEnded
    });
  }

  function startBonus() {
    mode = 'bonus';
    GB.UI.showScreen(null);
    GB.Bonus.start({
      index: run.bonusIndex,
      level: run.level,
      settings: run.settings,
      cheats: run.cheats,
      player: run.player,
      onEnd: bonusEnded
    });
    run.bonusIndex++;
  }

  function duelEnded(stats) {
    if (stats.result === 'win') {
      const speed = Math.max(0, Math.round((3.0 - stats.timeToKill) * 300));
      const acc = stats.shots > 0 ? stats.hits / stats.shots : 0;
      const accuracy = Math.round(acc * 300);
      const health = Math.round((stats.hpLeft / stats.maxHp) * 300);
      run.score += 400 + speed + accuracy + health;
      run.duelsWon++;

      if (run.level >= run.settings.opponents) return victory();

      run.level++;
      const freq = run.settings.bonusFreq;
      if (freq > 0 && run.duelsWon % freq === 0) startBonus();
      else startDuel();
    } else if (stats.result === 'draw') {
      startDuel(); // same gunslinger, one more time
    } else {
      gameOver();
    }
  }

  function bonusEnded(stats) {
    run.score += stats.points;
    startDuel();
  }

  function victory() {
    mode = 'menu';
    const isRecord = GB.UI.submitScore(run.score);
    retryAction = () => startGame();
    GB.UI.showResults({
      heading: 'THE WEST IS WON!',
      line: run.player.name + ' outdrew every gunslinger in the territory.',
      score: run.score,
      isRecord,
      showRetry: true,
      retryLabel: 'PLAY AGAIN'
    });
  }

  function gameOver() {
    mode = 'menu';
    const opp = opponentForLevel(run.level).name;
    const isRecord = GB.UI.submitScore(run.score);
    const lvl = run.level;
    retryAction = () => {
      run.level = lvl;
      startDuel();
    };
    GB.UI.showResults({
      heading: 'GAME OVER',
      line: opp + ' gunned you down at level ' + lvl + '.',
      score: run.score,
      isRecord,
      showRetry: true,
      retryLabel: 'RETRY LEVEL'
    });
  }

  // ---------- input ----------
  function canvasCoords(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (canvas.width / r.width),
      y: (e.clientY - r.top) * (canvas.height / r.height)
    };
  }
  canvas.addEventListener('mousemove', e => {
    const p = canvasCoords(e);
    if (mode === 'duel') GB.Duel.mouseMove(p.x, p.y);
    else if (mode === 'bonus') GB.Bonus.mouseMove(p.x, p.y);
  });
  canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const p = canvasCoords(e);
    if (mode === 'duel') GB.Duel.mouseDown(p.x, p.y);
    else if (mode === 'bonus') GB.Bonus.mouseDown(p.x, p.y);
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mode !== 'menu') {
      mode = 'menu';
      GB.UI.showScreen('screen-title');
    }
  });

  // ---------- scaling ----------
  function resize() {
    const k = Math.min(window.innerWidth / 980, window.innerHeight / 560, 1.5);
    document.getElementById('game-frame').style.transform =
      'translate(-50%, -50%) scale(' + Math.max(0.4, k) + ')';
  }
  window.addEventListener('resize', resize);

  // ---------- loop ----------
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (mode === 'duel') {
      GB.Duel.update(dt);
      GB.Duel.draw(ctx);
    } else if (mode === 'bonus') {
      GB.Bonus.update(dt);
      GB.Bonus.draw(ctx);
    }
    requestAnimationFrame(frame);
  }

  // ---------- boot ----------
  GB.UI.init({
    onStart: startGame,
    onRetry() { if (retryAction) retryAction(); }
  });
  resize();
  requestAnimationFrame(frame);

  return { get mode() { return mode; }, get run() { return run; } };
})();
