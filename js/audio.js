/* DUEL — synthesized sound effects (no audio files) */
window.GB = window.GB || {};

GB.sfx = (function () {
  let ctx = null;
  let enabled = true;
  let noiseBuf = null;

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function noise(dur, filterType, freq, q, peak, when) {
    const c = ac(), t = c.currentTime + (when || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain();
    src.connect(f).connect(g).connect(c.destination);
    env(g, t, peak, 0.005, dur);
    src.start(t); src.stop(t + dur + 0.1);
  }

  function tone(type, f0, f1, dur, peak, when) {
    const c = ac(), t = c.currentTime + (when || 0);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = c.createGain();
    o.connect(g).connect(c.destination);
    env(g, t, peak, 0.008, dur);
    o.start(t); o.stop(t + dur + 0.1);
  }

  const api = {
    setEnabled(v) { enabled = v; },
    unlock() { try { ac(); } catch (e) { enabled = false; } },

    gunshot() {
      if (!enabled) return;
      noise(0.18, 'lowpass', 900, 0.8, 0.9);       // boom
      noise(0.06, 'highpass', 2500, 1, 0.5);        // crack
      tone('triangle', 220, 40, 0.22, 0.5);         // thump
    },
    enemyShot() {
      if (!enabled) return;
      noise(0.16, 'lowpass', 650, 0.8, 0.65);
      tone('triangle', 160, 35, 0.2, 0.35);
    },
    ricochet() {
      if (!enabled) return;
      tone('sine', 2600, 700, 0.28, 0.16, 0.02);
      noise(0.05, 'highpass', 4000, 2, 0.18);
    },
    fleshHit() {
      if (!enabled) return;
      noise(0.09, 'lowpass', 350, 1, 0.55);
      tone('sine', 110, 55, 0.12, 0.4);
    },
    smash() {
      if (!enabled) return;
      noise(0.22, 'highpass', 3200, 2, 0.5);
      noise(0.14, 'bandpass', 1500, 3, 0.35, 0.02);
      tone('square', 1800, 900, 0.08, 0.1);
    },
    tick() {
      if (!enabled) return;
      tone('square', 900, 900, 0.045, 0.18);
      noise(0.03, 'highpass', 3000, 1, 0.12);
    },
    fireBell() {
      if (!enabled) return;
      tone('square', 1500, 1500, 0.3, 0.25);
      tone('square', 2250, 2250, 0.3, 0.12);
    },
    foul() {
      if (!enabled) return;
      tone('sawtooth', 300, 140, 0.22, 0.2);
    },
    dryFire() {
      if (!enabled) return;
      tone('square', 500, 500, 0.03, 0.15);
      tone('square', 380, 380, 0.03, 0.12, 0.06);
    },
    fall() {
      if (!enabled) return;
      noise(0.3, 'lowpass', 240, 0.8, 0.5, 0.02);
    },
    // little western win sting (minor-pentatonic-ish trumpet)
    winSting() {
      if (!enabled) return;
      const seq = [[392, 0], [523, 0.13], [659, 0.26], [784, 0.42]];
      seq.forEach(([f, w]) => tone('sawtooth', f, f, 0.22, 0.14, w));
    },
    loseSting() {
      if (!enabled) return;
      const seq = [[330, 0], [277, 0.2], [220, 0.42], [165, 0.66]];
      seq.forEach(([f, w]) => tone('sawtooth', f, f, 0.3, 0.14, w));
    },
    drawSting() {
      if (!enabled) return;
      tone('sawtooth', 330, 330, 0.25, 0.13);
      tone('sawtooth', 330, 330, 0.25, 0.13, 0.3);
    },
    toss() {
      if (!enabled) return;
      tone('sine', 500, 1100, 0.18, 0.12);
    },
    point() {
      if (!enabled) return;
      tone('square', 1050, 1050, 0.06, 0.14);
      tone('square', 1560, 1560, 0.08, 0.14, 0.07);
    },
    heartbeat() {
      if (!enabled) return;
      tone('sine', 70, 45, 0.09, 0.4);
      tone('sine', 65, 42, 0.08, 0.3, 0.14);
    }
  };
  return api;
})();
