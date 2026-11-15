/* أصوات الواجهة: نفس مؤثرات منظومة باركود الأصول (Web Audio، بدون ملفات) — تعمل عند الضغط فقط، لا عند التمرير */
(function () {
  'use strict';
  var KEY = 'rk.sndp', ctx = null, lastTick = 0;
  function prefs() { var d = { sound: true, vol: 60 }; try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v) { d.sound = v.sound !== false; d.vol = Math.max(0, Math.min(100, Number(v.vol) || 0)); if (v.vol === undefined) d.vol = 60; } } catch (e) {} return d; }
  function setPrefs(p) { var c = prefs(); if (p.sound !== undefined) c.sound = !!p.sound; if (p.vol !== undefined) c.vol = Math.max(0, Math.min(100, Number(p.vol) || 0)); try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} return c; }
  function ac() {
    try {
      if (!ctx) { var A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  function tone(f1, f2, dur, o) {
    o = o || {}; var c = ac(); if (!c) return;
    var type = o.type || 'sine', gain = o.gain === undefined ? 0.18 : o.gain, at = o.at || 0, attack = o.attack || 0.004;
    var t = c.currentTime + at, os = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 4200; os.type = type; os.frequency.setValueAtTime(f1, t); if (f2 !== f1) os.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var v = gain * (prefs().vol / 100); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    os.connect(lp); lp.connect(g); g.connect(c.destination); os.start(t); os.stop(t + dur + 0.02);
  }
  function play(k) {
    if (!prefs().sound) return;
    try {
      switch (k) {
        case 'tick': tone(1250, 1100, 0.045, { type: 'triangle', gain: 0.11 }); break;
        case 'nav': tone(520, 780, 0.09, { gain: 0.10 }); break;
        case 'pop': tone(440, 660, 0.11, { gain: 0.12 }); tone(880, 880, 0.08, { gain: 0.05, at: 0.05 }); break;
        case 'ok': [[784, 0], [1046, 0.09], [1318, 0.18]].forEach(function (x) { tone(x[0], x[0], 0.22, { gain: 0.14, at: x[1], attack: 0.01 }); }); break;
        case 'err': tone(320, 180, 0.22, { type: 'square', gain: 0.06 }); tone(240, 150, 0.24, { type: 'sine', gain: 0.12, at: 0.04 }); break;
        case 'del': tone(700, 180, 0.32, { gain: 0.15 }); tone(1400, 360, 0.22, { type: 'triangle', gain: 0.04, at: 0.02 }); break;
        case 'print': for (var i = 0; i < 5; i++) tone(1500 + i * 40, 1450, 0.03, { type: 'square', gain: 0.035, at: i * 0.055 }); tone(988, 1318, 0.18, { gain: 0.11, at: 0.32 }); break;
        case 'login': [[523, 0], [659, 0.08], [784, 0.16], [1046, 0.24]].forEach(function (x) { tone(x[0], x[0], 0.26, { gain: 0.12, at: x[1], attack: 0.01 }); }); break;
      }
    } catch (e) {}
  }
  // نقرة خفيفة عند الضغط فقط (حدث click لا يحدث عند التمرير)؛ التبويبات لها صوت التنقل من التطبيق نفسه
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button, .tap, label.item, label.chk, input[type=checkbox], input[type=radio], select, summary');
    if (!b || b.disabled || b.matches('[data-tab], [data-more], [data-x], [data-sfx]')) return;
    var now = Date.now(); if (now - lastTick < 40) return; lastTick = now;
    play('tick');
  }, true);
  window.RKSnd = { play: play, prefs: prefs, setPrefs: setPrefs };
})();
