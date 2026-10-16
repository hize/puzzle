/* ==========================================================================
   audio.js — 用 Web Audio 现场合成音效，无需任何音频资源
   ========================================================================== */
(function () {
  'use strict';

  const NS = (window.Sokoban = window.Sokoban || {});

  let ctx = null;
  let enabled = true;
  let master = null;

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function blip(freq, duration, options) {
    const c = ensure();
    if (!c) return;
    const opts = options || {};
    const t0 = c.currentTime + (opts.delay || 0);
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, opts.slideTo),
        t0 + duration
      );
    }
    const peak = (opts.gain === undefined ? 0.28 : opts.gain);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const Audio = {
    setEnabled(on) {
      enabled = Boolean(on);
      if (enabled) ensure();
    },

    isEnabled() {
      return enabled;
    },

    /** 需要在用户手势里调用一次，解锁移动端音频。 */
    unlock() {
      ensure();
    },

    move() {
      blip(180, 0.05, { type: 'triangle', gain: 0.13 });
    },

    push() {
      blip(300, 0.09, { type: 'square', gain: 0.12, slideTo: 210 });
      blip(120, 0.1, { type: 'triangle', gain: 0.16 });
    },

    blocked() {
      blip(92, 0.09, { type: 'sawtooth', gain: 0.1, slideTo: 70 });
    },

    undo() {
      blip(420, 0.09, { type: 'sine', gain: 0.14, slideTo: 250 });
    },

    reset() {
      blip(300, 0.08, { type: 'sine', gain: 0.12, slideTo: 420 });
    },

    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        blip(f, 0.26, { type: 'triangle', gain: 0.2, delay: i * 0.1 });
      });
    },

    star() {
      blip(880, 0.18, { type: 'sine', gain: 0.16 });
      blip(1174.66, 0.22, { type: 'sine', gain: 0.14, delay: 0.09 });
    },
  };

  NS.Audio = Audio;
})();
