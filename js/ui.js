/* DUEL — DOM menus, settings, persistence, cheat codes */
window.GB = window.GB || {};

GB.UI = (function () {
  const $ = id => document.getElementById(id);

  const DEFAULT_SETTINGS = {
    health: 100, ammo: 6, opponents: 9,
    damageModel: 'zones', oneShotHead: true, bonusFreq: 2,
    reactionScale: 100, accuracyScale: 100,
    sound: true, difficulty: 'normal'
  };
  const PRESETS = {
    easy:    { reactionScale: 160, accuracyScale: 75 },
    normal:  { reactionScale: 100, accuracyScale: 100 },
    hard:    { reactionScale: 75,  accuracyScale: 110 },
    deadeye: { reactionScale: 55,  accuracyScale: 125 }
  };
  const COLOR_PARTS = ['hat', 'shirt', 'vest', 'pants', 'bandana', 'skin', 'gun', 'hair'];

  let settings = { ...DEFAULT_SETTINGS };
  let character = null;   // { rosterIndex, name, cfg }
  let cheats = freshCheats();
  let app = null;         // callbacks from main
  let previewTimer = null;
  let previewT = 0;

  function freshCheats() {
    return { nohit: false, moreammo: false, fastfire: false, slowmo: false,
             oneshot: false, bighead: false, startLevel: 0, startBonus: 0, any: false };
  }

  // ---------- persistence ----------
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem('duel_settings'));
      if (s) settings = { ...DEFAULT_SETTINGS, ...s };
    } catch (e) { /* fresh start */ }
    try {
      const c = JSON.parse(localStorage.getItem('duel_char'));
      if (c && c.cfg) character = c;
    } catch (e) { /* fresh start */ }
    if (!character) selectRosterIndex(0, false);
  }
  function saveSettings() { localStorage.setItem('duel_settings', JSON.stringify(settings)); }
  function saveCharacter() { localStorage.setItem('duel_char', JSON.stringify(character)); }
  function highScore() { return parseInt(localStorage.getItem('duel_high') || '0', 10); }
  function submitScore(score) {
    const isRecord = score > highScore();
    if (isRecord) localStorage.setItem('duel_high', String(score));
    return isRecord;
  }

  // ---------- screens ----------
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('visible'));
    const canvas = $('game');
    if (id) {
      $(id).classList.add('visible');
      canvas.classList.remove('playing');
    } else {
      canvas.classList.add('playing');
    }
    if (previewTimer) { clearInterval(previewTimer); previewTimer = null; }
    if (id === 'screen-select') {
      previewTimer = setInterval(() => { previewT += 0.05; renderPreview(); }, 50);
    }
    $('title-highscore').textContent = 'HIGH SCORE: ' + highScore();
  }

  // ---------- character select ----------
  function buildRoster() {
    const grid = $('roster-grid');
    grid.innerHTML = '';
    GB.chars.ROSTER.forEach((base, i) => {
      const slot = document.createElement('button');
      slot.className = 'roster-slot' + (i === character.rosterIndex ? ' active' : '');
      const cv = document.createElement('canvas');
      cv.width = 92; cv.height = 96;
      const nm = document.createElement('span');
      nm.className = 'slot-name';
      nm.textContent = base.name;
      slot.appendChild(cv);
      slot.appendChild(nm);
      slot.addEventListener('click', () => selectRosterIndex(i, true));
      grid.appendChild(slot);
      GB.chars.drawPortrait(cv, i === character.rosterIndex ? character.cfg : base);
    });
  }

  function refreshRosterThumbs() {
    const slots = document.querySelectorAll('.roster-slot');
    slots.forEach((slot, i) => {
      slot.classList.toggle('active', i === character.rosterIndex);
      const cfg = i === character.rosterIndex ? character.cfg : GB.chars.ROSTER[i];
      GB.chars.drawPortrait(slot.querySelector('canvas'), cfg);
    });
  }

  function selectRosterIndex(i, refresh) {
    const base = GB.chars.ROSTER[i];
    character = { rosterIndex: i, name: base.name, cfg: { ...base } };
    delete character.cfg.name;
    if (refresh) {
      $('name-input').value = character.name;
      syncColorInputs();
      refreshRosterThumbs();
      renderPreview();
      saveCharacter();
    }
  }

  function syncColorInputs() {
    document.querySelectorAll('#color-grid input[type=color]').forEach(inp => {
      inp.value = character.cfg[inp.dataset.part] || '#888888';
    });
  }

  function renderPreview() {
    const cv = $('preview-canvas');
    GB.chars.drawPortrait(cv, character.cfg, { bg: true, breathe: previewT, raise: 0 });
    const c = cv.getContext('2d');
    c.font = 'bold 16px Georgia';
    c.textAlign = 'center';
    c.fillStyle = '#2b1a0a';
    c.fillText(character.name || '?', cv.width / 2, 24);
  }

  // ---------- cheats ----------
  function applyCheat(codeRaw) {
    const code = codeRaw.trim().toUpperCase();
    const fb = $('cheat-feedback');
    const ok = msg => { fb.textContent = '✔ ' + msg; GB.sfx.point(); };
    if (!code) { fb.textContent = ''; return; }

    if (code === 'RESET') { cheats = freshCheats(); ok('CHEATS CLEARED'); return; }

    const simple = {
      NOHIT: ['nohit', 'INVINCIBLE — THEY CANNOT HIT YOU'],
      MOREAMMO: ['moreammo', 'UNLIMITED AMMO'],
      FASTFIRE: ['fastfire', 'LIGHTNING TRIGGER'],
      SLOWMO: ['slowmo', 'OPPONENTS SLOWED'],
      ONESHOT: ['oneshot', 'EVERY HIT IS LETHAL'],
      BIGHEAD: ['bighead', 'BIG HEAD MODE']
    };
    if (simple[code]) {
      cheats[simple[code][0]] = true;
      cheats.any = true;
      ok(simple[code][1]);
      return;
    }
    let m = code.match(/^LEVEL(\d{1,2})$/);
    if (m) {
      const lvl = parseInt(m[1], 10);
      if (lvl >= 1 && lvl <= settings.opponents) {
        cheats.startLevel = lvl; cheats.any = true;
        ok('STARTING AT LEVEL ' + lvl);
      } else fb.textContent = '✘ LEVEL MUST BE 1–' + settings.opponents;
      return;
    }
    m = code.match(/^BONUS([12])$/);
    if (m) {
      cheats.startBonus = parseInt(m[1], 10); cheats.any = true;
      ok('STARTING AT BONUS ROUND ' + m[1]);
      return;
    }
    fb.textContent = '✘ UNKNOWN CODE';
    GB.sfx.foul();
  }

  // ---------- settings ----------
  function syncSettingsForm() {
    $('set-health').value = String(settings.health);
    $('set-ammo').value = String(settings.ammo);
    $('set-opponents').value = String(settings.opponents);
    $('set-damage').value = settings.damageModel;
    $('set-headshot').value = settings.oneShotHead ? 'on' : 'off';
    $('set-bonus').value = String(settings.bonusFreq);
    $('set-sound').value = settings.sound ? 'on' : 'off';
    $('set-reaction').value = settings.reactionScale;
    $('set-accuracy').value = settings.accuracyScale;
    updateSliderLabels();
    document.querySelectorAll('.btn-preset').forEach(b =>
      b.classList.toggle('active', b.dataset.preset === settings.difficulty));
  }

  function updateSliderLabels() {
    const r = settings.reactionScale, a = settings.accuracyScale;
    $('val-reaction').textContent = (r > 120 ? 'SLOW ' : r < 80 ? 'FAST ' : '') + r + '%';
    $('val-accuracy').textContent = (a > 110 ? 'SHARP ' : a < 80 ? 'WILD ' : '') + a + '%';
  }

  function wireSettings() {
    const set = (key, fn) => v => { settings[key] = fn ? fn(v) : v; saveSettings(); };
    $('set-health').addEventListener('change', e => set('health', Number)(e.target.value));
    $('set-ammo').addEventListener('change', e => set('ammo', Number)(e.target.value));
    $('set-opponents').addEventListener('change', e => set('opponents', Number)(e.target.value));
    $('set-damage').addEventListener('change', e => set('damageModel')(e.target.value));
    $('set-headshot').addEventListener('change', e => set('oneShotHead', v => v === 'on')(e.target.value));
    $('set-bonus').addEventListener('change', e => set('bonusFreq', Number)(e.target.value));
    $('set-sound').addEventListener('change', e => {
      settings.sound = e.target.value === 'on';
      GB.sfx.setEnabled(settings.sound);
      saveSettings();
    });
    const custom = () => {
      settings.difficulty = 'custom';
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
    };
    $('set-reaction').addEventListener('input', e => {
      settings.reactionScale = Number(e.target.value);
      custom(); updateSliderLabels(); saveSettings();
    });
    $('set-accuracy').addEventListener('input', e => {
      settings.accuracyScale = Number(e.target.value);
      custom(); updateSliderLabels(); saveSettings();
    });
    document.querySelectorAll('.btn-preset').forEach(b => {
      b.addEventListener('click', () => {
        settings.difficulty = b.dataset.preset;
        Object.assign(settings, PRESETS[b.dataset.preset]);
        syncSettingsForm(); saveSettings();
      });
    });
    $('btn-settings-reset').addEventListener('click', () => {
      settings = { ...DEFAULT_SETTINGS };
      GB.sfx.setEnabled(true);
      syncSettingsForm(); saveSettings();
    });
  }

  // ---------- results ----------
  function showResults(o) {
    $('results-heading').textContent = o.heading;
    $('results-line').textContent = o.line;
    $('results-score').textContent = 'SCORE  ' + o.score;
    const hi = $('results-high');
    hi.textContent = o.isRecord ? '★ NEW HIGH SCORE ★' : 'HIGH SCORE  ' + highScore();
    hi.classList.toggle('new-record', !!o.isRecord);
    $('btn-results-retry').style.display = o.showRetry ? '' : 'none';
    $('btn-results-retry').textContent = o.retryLabel || 'RETRY LEVEL';
    showScreen('screen-results');
  }

  // ---------- init ----------
  function init(callbacks) {
    app = callbacks;
    load();
    GB.sfx.setEnabled(settings.sound);
    buildRoster();
    $('name-input').value = character.name;
    syncColorInputs();
    renderPreview();
    syncSettingsForm();
    wireSettings();

    $('btn-play').addEventListener('click', () => { GB.sfx.unlock(); showScreen('screen-select'); });
    $('btn-settings').addEventListener('click', () => showScreen('screen-settings'));
    $('btn-help').addEventListener('click', () => showScreen('screen-help'));
    $('btn-settings-back').addEventListener('click', () => showScreen('screen-title'));
    $('btn-help-back').addEventListener('click', () => showScreen('screen-title'));
    $('btn-select-back').addEventListener('click', () => showScreen('screen-title'));

    $('name-input').addEventListener('input', e => {
      character.name = e.target.value.toUpperCase().slice(0, 14) || 'STRANGER';
      saveCharacter();
    });
    document.querySelectorAll('#color-grid input[type=color]').forEach(inp => {
      inp.addEventListener('input', () => {
        character.cfg[inp.dataset.part] = inp.value;
        refreshRosterThumbs();
        renderPreview();
        saveCharacter();
      });
    });
    $('btn-cheat').addEventListener('click', () => { applyCheat($('cheat-input').value); $('cheat-input').value = ''; });
    $('cheat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') { applyCheat(e.target.value); e.target.value = ''; }
    });

    $('btn-start').addEventListener('click', () => { GB.sfx.unlock(); app.onStart(); });
    $('btn-results-retry').addEventListener('click', () => app.onRetry());
    $('btn-results-title').addEventListener('click', () => showScreen('screen-title'));

    showScreen('screen-title');
  }

  return {
    init, showScreen, showResults, submitScore, highScore,
    getSettings: () => ({ ...settings }),
    getCharacter: () => ({ name: character.name || 'STRANGER', cfg: { ...character.cfg } }),
    getCheats: () => ({ ...cheats })
  };
})();
