/* DUEL — synthesized sound effects (no audio files)
 * Gunshots are layered Magnum-revolver reports: shock crack, sub boom,
 * powder roar, brass ping, desert slap-back. */
window.GB = window.GB || {};

GB.sfx = (function () {
  let ctx = null;
  let enabled = true;
  let noiseBuf = null;
  let impulseBuf = null;
  let gunOut = null;

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const n = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, n, n);
      const d = noiseBuf.getChannelData(0);
      let brown = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        brown = (brown + w * 0.02) / 1.02;
        d[i] = w * 0.72 + brown * 0.55;
      }
      // Short decaying blast used as the Magnum body
      const m = Math.floor(n * 0.7);
      impulseBuf = ctx.createBuffer(1, m, n);
      const p = impulseBuf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < m; i++) {
        const t = i / n;
        const env = Math.exp(-t * 14) * (1 - t / 0.7);
        const w = Math.random() * 2 - 1;
        b = b * 0.985 + w * 0.015;
        const click = i < 48 ? (1 - i / 48) * (Math.random() * 2 - 1) : 0;
        p[i] = (w * 0.5 + b * 0.7) * env + click * 0.9;
      }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function gunBus() {
    const c = ac();
    if (gunOut) return gunOut;
    const shaper = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = i / 128 - 1;
      curve[i] = Math.tanh(x * 2.4);
    }
    shaper.curve = curve;
    shaper.oversample = '2x';
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 10;
    comp.ratio.value = 5.5;
    comp.attack.value = 0.002;
    comp.release.value = 0.14;
    const out = c.createGain();
    out.gain.value = 0.95;
    shaper.connect(comp).connect(out).connect(c.destination);
    gunOut = shaper;
    return gunOut;
  }

  function env(gainNode, t0, peak, attack, decay) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + Math.max(0.0008, attack));
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

  function blast(filterType, f0, f1, q, peak, attack, decay, when, dest) {
    const c = ac(), t = c.currentTime + (when || 0);
    const src = c.createBufferSource();
    src.buffer = impulseBuf || noiseBuf;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q || 0.8;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + decay);
    const g = c.createGain();
    src.connect(f).connect(g).connect(dest || gunBus());
    env(g, t, peak, attack, decay);
    src.start(t);
    src.stop(t + attack + decay + 0.05);
  }

  function bodyTone(type, f0, f1, dur, peak, when, dest) {
    const c = ac(), t = c.currentTime + (when || 0);
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(18, f1), t + dur);
    const g = c.createGain();
    o.connect(g).connect(dest || gunBus());
    env(g, t, peak, 0.0015, dur);
    o.start(t); o.stop(t + dur + 0.05);
  }

  /** .44 / .357 Magnum revolver: crack + sub boom + powder roar + desert echo. */
  function magnum(distant) {
    const jitter = 0.92 + Math.random() * 0.16;
    const v = (distant ? 0.58 : 1) * jitter;
    const darker = distant ? 0.72 : 1;

    // Shockwave crack — the Magnum's sharp report
    blast('highpass', 4200 * darker, 1800, 0.65, 0.62 * v, 0.0008, 0.05, 0);
    blast('bandpass', 2400 * darker, 700, 1.1, 0.5 * v, 0.001, 0.09, 0);

    // Powder roar — big mid-low sweep, the "whoom"
    blast('lowpass', 1600 * darker, 140, 0.55, 0.95 * v, 0.0015, 0.38, 0);
    blast('lowpass', 700 * darker, 90, 0.7, 0.55 * v, 0.003, 0.5, 0);

    // Sub / chest thump — what makes it a Magnum, not a 9mm
    bodyTone('sine', 62 * jitter, 24, 0.48, 0.72 * v, 0);
    bodyTone('triangle', 108 * jitter, 32, 0.3, 0.42 * v, 0);
    bodyTone('sine', 38 * jitter, 18, 0.58, 0.38 * v, 0.004);

    // Cylinder / brass ring, almost subliminal
    bodyTone('sine', 1750, 820, 0.08, 0.055 * v, 0.01);

    // Desert slap-back: first reflection, then a longer wash
    const echo = distant ? 0.38 : 0.22;
    blast('lowpass', 900 * darker, 180, 0.6, echo * v, 0.004, 0.28, distant ? 0.11 : 0.085);
    blast('lowpass', 420 * darker, 90, 0.5, echo * 0.45 * v, 0.01, 0.42, distant ? 0.22 : 0.17);
    if (!distant) {
      blast('highpass', 2800, 900, 0.8, 0.12 * v, 0.002, 0.12, 0.09);
    }
  }

  const api = {
    setEnabled(v) { enabled = v; },
    unlock() { try { ac(); gunBus(); } catch (e) { enabled = false; } },

    gunshot() {
      if (!enabled) return;
      magnum(false);
    },
    enemyShot() {
      if (!enabled) return;
      magnum(true);
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
    metalHit() {
      if (!enabled) return;
      noise(0.07, 'highpass', 3200, 1.6, 0.42);
      noise(0.1, 'bandpass', 1800, 4, 0.28);
      tone('square', 1600, 420, 0.09, 0.12);
      tone('sine', 2400, 900, 0.06, 0.08);
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
      // Heavy Magnum hammer falling on an empty chamber
      noise(0.04, 'highpass', 2200, 1.4, 0.22);
      tone('square', 280, 140, 0.05, 0.18);
      tone('sine', 190, 90, 0.07, 0.16);
      tone('sine', 1400, 700, 0.04, 0.07, 0.03);
    },
    fall() {
      if (!enabled) return;
      noise(0.3, 'lowpass', 240, 0.8, 0.5, 0.02);
    },
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
