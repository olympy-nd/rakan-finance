/* أصوات الواجهة: مؤثرات قصيرة هادئة تُولَّد بالمتصفح (بدون ملفات صوت) */
(function () {
  'use strict';
  var KEY = 'rk.snd', ctx = null, master = null, lastAt = 0;
  var LEVELS = { off: 0, low: 0.35, mid: 0.7 };
  function level() { try { var v = localStorage.getItem(KEY); return LEVELS[v] !== undefined ? v : 'low'; } catch (e) { return 'low'; } }
  function setLevel(v) { try { localStorage.setItem(KEY, v); } catch (e) {} if (master) master.gain.value = LEVELS[v] || 0; }
  function ac() {
    if (!LEVELS[level()]) return null;
    try {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
        ctx = new C(); master = ctx.createGain(); master.gain.value = LEVELS[level()];
        var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 4;
        master.connect(comp); comp.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  // نغمة واحدة بغلاف سريع (هجوم قصير ثم خفوت أسّي) — أساس كل المؤثرات
  function tone(c, t0, f1, f2, dur, vol, type) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f1, t0); if (f2 && f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  // نقرة خفيفة: ضجيج قصير جداً بمرشح عالٍ يعطي ملمس الزر
  function tick(c, t0, freq, vol) {
    var n = Math.floor(c.sampleRate * 0.012), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
    var s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.2; g.gain.value = vol;
    s.buffer = b; s.connect(f); f.connect(g); g.connect(master); s.start(t0);
  }
  var FX = {
    tap: function (c, t) { tick(c, t, 3200, 0.55); tone(c, t, 1350, 1100, 0.045, 0.06, 'triangle'); },
    nav: function (c, t) { tick(c, t, 2200, 0.4); tone(c, t, 660, 520, 0.08, 0.07, 'sine'); },
    toggle: function (c, t) { tone(c, t, 1180, 1180, 0.035, 0.07, 'triangle'); tone(c, t + 0.04, 1580, 1580, 0.04, 0.05, 'triangle'); },
    open: function (c, t) { tone(c, t, 420, 760, 0.12, 0.06, 'sine'); },
    close: function (c, t) { tone(c, t, 700, 420, 0.1, 0.05, 'sine'); },
    success: function (c, t) { tone(c, t, 1046.5, 1046.5, 0.14, 0.08, 'sine'); tone(c, t + 0.09, 1568, 1568, 0.22, 0.07, 'sine'); },
    error: function (c, t) { tone(c, t, 392, 370, 0.14, 0.09, 'triangle'); tone(c, t + 0.13, 311, 294, 0.2, 0.08, 'triangle'); },
    welcome: function (c, t) { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(c, t + i * 0.085, f, f, 0.32, 0.055, 'sine'); }); }
  };
  function play(name) {
    var c = ac(); if (!c || !FX[name]) return;
    var now = performance.now(); if (name !== 'success' && name !== 'error' && name !== 'welcome' && now - lastAt < 45) return; lastAt = now;
    try { FX[name](c, c.currentTime + 0.005); } catch (e) {}
  }
  // ربط عام: صوت عند الضغط على عناصر الواجهة حسب نوعها
  document.addEventListener('pointerdown', function (e) {
    if (e.button > 0) return;
    var el = e.target.closest && e.target.closest('button, a[href], .tap, label.item, label.chk, input[type=checkbox], input[type=radio], select, summary, [data-tab], [data-open], [data-jump]');
    if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
    if (el.matches('[data-tab], .bn-i, .side-i, [data-jump], .cat-card, [data-back]')) play('nav');
    else if (el.matches('.chip, .per-b, input[type=checkbox], input[type=radio], label.chk, label.item, [data-pset], [data-gsplit], [data-igx], [data-cgx]')) play('toggle');
    else if (el.matches('[data-x]')) play('close');
    else play('tap');
  }, true);
  window.RKSnd = { play: play, level: level, setLevel: setLevel, LEVELS: [['off', 'إيقاف'], ['low', 'هادئ'], ['mid', 'متوسط']] };
})();
