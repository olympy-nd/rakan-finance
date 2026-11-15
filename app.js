/* راكان المالية · هيكل التطبيق: الدخول، التبويبات، المستخدمون، سجل التدقيق */
(function () {
  'use strict';
  var S = RK.S;
  var $app = document.getElementById('app');
  var st = { user: null, tab: null, online: navigator.onLine };

  /* ===================== أدوات ===================== */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function N(n) { return '<span class="num">' + esc(n) + '</span>'; }
  function q(sel, el) { return (el || document).querySelector(sel); }
  function qa(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  var ICON = {
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h4v16h-4"/><path d="M10 8l-4 4 4 4"/><path d="M6 12h10"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
    dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/></svg>',
    reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h7"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>'
  };

  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
    if (window.RKSnd) RKSnd.play(err ? 'err' : 'ok');
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, err ? 5200 : 3000);
  }
  function call(action, body, opts) {
    return RK.api(action, body, opts).then(function (r) {
      if (r.ok) return r;
      if (r.error === 'auth') { logout(r.msg || 'انتهت الجلسة، سجّل الدخول من جديد'); throw new Error(r.msg || 'سجّل الدخول'); }
      if (r.error === 'busy') throw new Error('الخادم مشغول، حاول بعد لحظة');
      var e = new Error(r.msg || r.error || 'تعذّر تنفيذ الطلب'); e.code = r.error; throw e;
    });
  }
  /* ===================== حقل التاريخ: نص منسّق ثابت فوق الحقل الأصلي (الهاتف يعرض الحقل العربي مقلوباً) ===================== */
  function fmtDx(v) { var m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(v || ''); return m ? m[3] + ' / ' + m[2] + ' / ' + m[1] : 'اختر التاريخ'; }
  function enhanceDates() {
    qa('input[type=date]:not([data-dx])').forEach(function (inp) {
      inp.setAttribute('data-dx', '1');
      var w = document.createElement('span'); w.className = 'dx';
      ['width', 'maxWidth', 'minWidth', 'flex'].forEach(function (k) { if (inp.style[k]) { w.style[k] = inp.style[k]; inp.style[k] = ''; } });
      inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
      var t = document.createElement('span'); t.className = 'dx-t'; t.setAttribute('aria-hidden', 'true'); w.appendChild(t);
      var up = function () { t.textContent = fmtDx(inp.value); }; up();
      inp.addEventListener('input', up); inp.addEventListener('change', up);
    });
  }
  (function () { var qd = 0; new MutationObserver(function () { if (qd) return; qd = 1; requestAnimationFrame(function () { qd = 0; enhanceDates(); }); }).observe(document.documentElement, { childList: true, subtree: true }); })();

  /* ===================== سجل التنقل: الرجوع لنفس المكان (التبويب، التقرير، القسم، وموضع التمرير) ===================== */
  var SHEETS = [], NAV = [], NAVI = { skip: 0 };
  function navPush() {
    NAV.push({ tab: st.tab, y: window.scrollY || 0, fin: FINAPI && FINAPI.navSnap ? FINAPI.navSnap() : null });
    if (NAV.length > 40) NAV.shift();
    try { history.pushState({ rkNav: NAV.length }, ''); } catch (e) {}
  }
  function restoreY(y) { var n = 8, f = function () { window.scrollTo(0, y); if (--n > 0 && Math.abs((window.scrollY || 0) - y) > 2) requestAnimationFrame(f); }; requestAnimationFrame(f); }
  function navPop() {
    var s = NAV.pop(); if (!s) return false;
    if (FINAPI && FINAPI.navApply) FINAPI.navApply(s.fin);
    var same = st.tab === s.tab; st.tab = s.tab; render(); if (!same) refresh(true); restoreY(s.y);
    return true;
  }
  window.addEventListener('popstate', function () {
    if (NAVI.skip > 0) { NAVI.skip--; return; }
    if (SHEETS.length) { SHEETS[SHEETS.length - 1].close(true); return; }
    navPop();
  });
  window.RKNav = {
    push: navPush,
    // زر «رجوع» في الواجهة: يرجع خطوة في السجل إن وجدت
    back: function () { if (!NAV.length) return false; if (history.state && history.state.rkNav) history.back(); else navPop(); return true; },
    peek: function () { return NAV[NAV.length - 1] || null; },
    tabName: function (t) { return (tabsFor(st.user).filter(function (x) { return x[0] === t; })[0] || [])[1] || ''; }
  };
  function sheet(title, html, mount) {
    var bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="sheet-h"><h2>' + esc(title) +
      '</h2><button class="iconbtn" data-x aria-label="إغلاق">' + ICON.close + '</button></div><div class="sheet-b">' + html + '</div></div>';
    document.body.appendChild(bg);
    if (window.RKSnd) RKSnd.play('pop');
    // زر الرجوع في الهاتف يغلق النافذة بدل الخروج من الصفحة
    var hs = false; try { history.pushState({ rkSheet: 1 }, ''); hs = true; } catch (e) {}
    var api = { el: q('.sheet-b', bg), close: function (fromPop) {
      if (!bg.parentNode) return;
      bg.remove(); SHEETS.splice(SHEETS.indexOf(api), 1);
      if (hs && fromPop !== true && history.state && history.state.rkSheet) { NAVI.skip++; history.back(); }
      if (api.onclose) api.onclose();
    } };
    SHEETS.push(api);
    q('[data-x]', bg).onclick = function () { api.close(); };
    bg.addEventListener('click', function (e) { if (e.target === bg && !api.sticky) api.close(); });
    if (mount) mount(api);
    return api;
  }
  function confirmBox(title, text, ok) {
    return new Promise(function (res) {
      sheet(title, '<p style="margin:0">' + text + '</p><div class="row"><button class="btn primary grow" data-ok>' + esc(ok || 'نعم') +
        '</button><button class="btn ghost" data-no>إلغاء</button></div>', function (s) {
        q('[data-ok]', s.el).onclick = function () { s.done = true; s.close(); res(true); };
        q('[data-no]', s.el).onclick = function () { s.close(); };
        s.onclose = function () { if (!s.done) res(false); };
      });
    });
  }
  function busy(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.t = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
    else { btn.disabled = false; if (btn.dataset.t) btn.innerHTML = btn.dataset.t; }
  }
  function withXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = 'xlsx.style.min.js';
      sc.onload = function () { res(window.XLSX); };
      sc.onerror = function () { rej(new Error('تعذّر تحميل مكتبة Excel. تأكد من الإنترنت')); };
      document.head.appendChild(sc);
    });
  }
  function saveBook(X, rows, name, sheetName, widths) {
    var ws = X.utils.aoa_to_sheet(rows);
    ws['!cols'] = (widths || []).map(function (w) { return { wch: w }; });
    ws['!views'] = [{ RTL: true }];
    var wb = X.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    X.utils.book_append_sheet(wb, ws, sheetName);
    return wb;
  }

  /* ===================== التشغيل ===================== */
  function boot() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(function () {});
      var hadCtl = !!navigator.serviceWorker.controller, reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (!hadCtl || reloaded) { hadCtl = true; return; }
        reloaded = true;
        if (!q('.sheet-bg')) location.reload(); else toast('وصلت نسخة جديدة من التطبيق. أعد فتحه بعد إنهاء ما تقوم به');
      });
      navigator.serviceWorker.getRegistration().then(function (reg) { if (reg) reg.update(); });
    }
    window.addEventListener('online', function () { st.online = true; netUI(); });
    window.addEventListener('offline', function () { st.online = false; netUI(); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) refresh(true); });
    setInterval(function () { if (!document.hidden) refresh(true); }, 60000);
    Promise.all([S.get('device'), S.get('token'), S.get('user')]).then(function (v) {
      if (!v[0]) S.set('device', RK.uuid());
      if (!v[1] || !v[2]) return renderLogin();
      st.user = v[2];
      if (st.user.must_change) return renderChangePin();
      startApp(); welcome(false);
      if (navigator.onLine) call('me').then(function (r) { st.user = r.user; S.set('user', r.user); }).catch(function () {});
    });
  }

  function logout(msg) {
    // البيانات المالية لا تبقى على الجهاز بعد الخروج
    S.get('device').then(function (dev) { return S.clearAll().then(function () { return S.set('device', dev || RK.uuid()); }); });
    st.user = null;
    if (window.RKFIN_RESET) window.RKFIN_RESET();
    renderLogin(msg);
  }

  function brand(sub) {
    return '<div class="brand"><img src="logo.png" alt="شعار راكان"><h1>التقارير المالية</h1><p>' + sub + '</p></div>';
  }

  function renderLogin(msg) {
    $app.innerHTML = '<div class="strip"></div><div class="login"><div class="card">' + brand('منظومة راكان للتقارير المالية والتنفيذية') +
      '<form class="form" id="lf" autocomplete="on">' + (msg ? '<div class="msg warn">' + esc(msg) + '</div>' : '') +
      '<div class="field"><label for="lu">اسم المستخدم</label><input id="lu" class="input ltr" autocapitalize="none" autocomplete="username" required></div>' +
      '<div class="field"><label for="lp">الرقم السري</label><input id="lp" class="input pin" type="password" inputmode="numeric" autocomplete="current-password" required></div>' +
      '<div class="field" id="lcw" hidden><label for="lc">رمز التحقق من البريد</label><input id="lc" class="input pin" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>' +
      '<div id="lm"></div><button class="btn primary big" id="lb">دخول</button></form></div></div>';
    q('#lf').onsubmit = function (e) {
      e.preventDefault();
      var b = q('#lb'), m = q('#lm');
      m.innerHTML = '';
      if (!navigator.onLine) { m.innerHTML = '<div class="msg err">الدخول يحتاج إنترنت.</div>'; return; }
      busy(b, true);
      S.get('device').then(function (dev) {
        if (!dev) { dev = RK.uuid(); S.set('device', dev); }
        return RK.api('login', { username: q('#lu').value.trim(), pin: q('#lp').value, device: dev, code: q('#lc').value.trim() || undefined });
      }).then(function (r) {
        busy(b, false);
        if (r.ok) {
          st.user = r.user;
          return Promise.all([S.set('token', r.token), S.set('user', r.user)]).then(function () { if (r.user.must_change) renderChangePin(); else { startApp(); welcome(true); } });
        }
        if (r.error === 'code') { q('#lcw').hidden = false; q('#lc').focus(); m.innerHTML = '<div class="msg info">' + esc(r.msg) + '</div>'; return; }
        m.innerHTML = '<div class="msg err">' + esc(r.msg || r.error) + '</div>';
      }).catch(function (e2) { busy(b, false); m.innerHTML = '<div class="msg err">' + esc(e2.message) + '</div>'; });
    };
  }

  function renderChangePin() {
    $app.innerHTML = '<div class="strip"></div><div class="login"><div class="card">' + brand('أهلاً ' + esc(st.user.name) + '. اختر رقماً سرياً جديداً لا يعرفه غيرك.') +
      '<form class="form" id="pf"><div class="field"><label for="p0">الرقم السري الحالي (المؤقت)</label><input id="p0" class="input pin" type="password" inputmode="numeric" required></div>' +
      '<div class="field"><label for="p1">الرقم السري الجديد (4 إلى 8 أرقام)</label><input id="p1" class="input pin" type="password" inputmode="numeric" required></div>' +
      '<div class="field"><label for="p2">أعد كتابته</label><input id="p2" class="input pin" type="password" inputmode="numeric" required></div>' +
      '<div id="pm"></div><button class="btn primary big" id="pb">حفظ والمتابعة</button><button type="button" class="btn ghost" id="po">خروج</button></form></div></div>';
    q('#po').onclick = function () { logout(); };
    q('#pf').onsubmit = function (e) {
      e.preventDefault();
      var m = q('#pm');
      if (q('#p1').value !== q('#p2').value) { m.innerHTML = '<div class="msg err">الرقمان غير متطابقين</div>'; return; }
      var b = q('#pb'); busy(b, true);
      call('change_pin', { old: q('#p0').value, pin: q('#p1').value }).then(function (r) {
        st.user = r.user; S.set('user', r.user); startApp(); welcome(true); toast('تم حفظ رقمك السري');
      }).catch(function (e2) { busy(b, false); m.innerHTML = '<div class="msg err">' + esc(e2.message) + '</div>'; });
    };
  }

  /* ===================== الهيكل ===================== */
  function tabsFor(u) {
    var t = [['dash', 'لوحة المؤشرات'], ['daily', 'التقرير اليومي'], ['reports', 'التقارير']];
    if (u.can_edit) t.push(['builder', 'إنشاء تقرير'], ['settings', 'الإعدادات']);
    if (u.role === 'manager') t.push(['users', 'المستخدمون'], ['audit', 'سجل التدقيق']);
    return t;
  }
  var TAB_ICON = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    daily: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4M7 13h4M7 17h7"/>',
    reports: '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h7M9 17h7"/>',
    builder: '<path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3.5 5.5"/>',
    audit: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7M9 8h3"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>'
  };
  function tabIcon(k) { return '<svg class="ti" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (TAB_ICON[k] || TAB_ICON.dash) + '</svg>'; }
  var TAB_GROUP = { dash: 'المتابعة', daily: 'المتابعة', reports: 'التقارير', builder: 'التقارير', settings: 'الإدارة', users: 'الإدارة', audit: 'الإدارة' };
  var TAB_SHORT = { dash: 'المؤشرات', daily: 'اليومي', builder: 'تقرير جديد', audit: 'السجل' };
  var PAGE_SUB = { dash: 'أهم الأرقام لفترة تختارها', daily: 'تقرير الإدارة اليومي', reports: 'كل التقارير الجاهزة وتقاريرك', builder: 'صمّم تقريراً خاصاً بك من الصفر', settings: 'الصناديق والبطاقات ومجموعات الحسابات', users: 'من يدخل المنظومة وصلاحياته', audit: 'كل ما حدث في المنظومة' };
  function isPhone() { return window.matchMedia('(max-width: 899px)').matches; }

  // رسالة ترحيب باسم المستخدم: عند تسجيل الدخول، ومرة واحدة في اليوم عند فتح التطبيق
  function welcome(force) {
    var day = RK.nowStr().slice(0, 10);
    Promise.resolve(S.get('welcomed')).then(function (v) {
      if (!force && v === day) return;
      S.set('welcomed', day);
      var h = +RK.nowStr().slice(11, 13), hi = h >= 4 && h < 12 ? 'صباح الخير' : 'مساء الخير', name = String((st.user && st.user.name) || '').trim();
      var dt = ''; try { dt = new Date().toLocaleDateString('ar-LY-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
      var w = document.createElement('div'); w.className = 'welcome'; w.setAttribute('role', 'status');
      w.innerHTML = '<div class="wc-card"><img src="logo.png" alt=""><div class="wc-hi">' + hi + '</div><div class="wc-name">' + esc(name || 'بك') + '</div>' +
        '<div class="wc-sub">' + (force ? 'أهلاً وسهلاً بك في منظومة راكان للتقارير المالية' : 'سعداء برؤيتك مجدداً في منظومة راكان للتقارير المالية') + '</div>' + (dt ? '<div class="wc-date">' + esc(dt) + '</div>' : '') + '</div>';
      var close = function () { if (!w.parentNode) return; w.classList.add('out'); setTimeout(function () { w.remove(); }, 320); };
      document.body.appendChild(w); setTimeout(close, 1950); if (window.RKSnd) RKSnd.play('login');
    }).catch(function () {});
  }
  function startApp(keep) {
    var tabs = tabsFor(st.user);
    if (!st.tab || !tabs.some(function (t) { return t[0] === st.tab; })) st.tab = tabs[0][0];
    var phone = isPhone(); st.phone = phone;
    var nav, mainTabs = tabs.length > 5 ? tabs.slice(0, 4) : tabs;
    st.moreTabs = tabs.slice(mainTabs.length);
    if (!phone) {
      var last = null;
      nav = '<aside class="side"><div class="side-brand"><img class="logo" src="logo.png" alt="راكان"><span class="side-app">التقارير المالية</span></div><nav class="side-nav" id="tabs">' + tabs.map(function (t) {
        var g = TAB_GROUP[t[0]] || '', head = g !== last ? '<div class="side-g">' + esc(g) + '</div>' : ''; last = g;
        return head + '<button class="tab side-i" data-tab="' + t[0] + '">' + tabIcon(t[0]) + '<span>' + esc(t[1]) + '</span></button>';
      }).join('') + '</nav><div class="side-user"><div class="av">' + esc(String(st.user.name || '').trim().charAt(0)) + '</div><div class="grow"><b>' + esc(st.user.name) + '</b><span>' + esc(st.user.role_ar || '') + '</span></div>' +
        '<button class="iconbtn" id="pinb" aria-label="تغيير الرقم السري" title="تغيير الرقم السري">' + ICON.key + '</button></div></aside>';
    } else {
      nav = '<nav class="bnav" id="tabs">' + mainTabs.map(function (t) { return '<button class="tab bn-i" data-tab="' + t[0] + '">' + tabIcon(t[0]) + '<span>' + esc(TAB_SHORT[t[0]] || t[1]) + '</span></button>'; }).join('') +
        '<button class="bn-i" data-more aria-label="المزيد">' + tabIcon('more') + '<span>المزيد</span></button></nav>';
    }
    $app.innerHTML = '<div class="strip"></div><div class="shell ' + (phone ? 'has-bnav' : 'has-side') + '">' + (phone ? '' : nav) +
      '<div class="shell-b"><header class="top"><div class="top-in">' + (phone ? '<img class="logo" src="logo.png" alt="راكان">' : '') +
      '<div class="who"><h1 id="ptitle"></h1><span id="psub"></span></div>' +
      '<span class="dsync" id="dsync" hidden></span><span class="net" id="net"></span><button class="iconbtn" id="sndb" aria-label="الأصوات" title="الأصوات">' + sndIcon() + '</button><button class="iconbtn" id="lo" aria-label="خروج" title="خروج">' + ICON.out + '</button></div></header>' +
      '<main id="main"></main></div>' + (phone ? nav : '') + '</div>';
    q('#lo').onclick = function () { confirmBox('خروج', 'هل تريد الخروج؟ تُمسح البيانات المالية من هذا الجهاز.', 'خروج').then(function (y) { if (y) logout(); }); };
    var pb = q('#pinb'); if (pb) pb.onclick = pinSheet;
    q('#sndb').onclick = sndSheet;
    navBadges();
    qa('[data-tab]').forEach(function (b) { b.onclick = function () { if (b.dataset.tab !== st.tab || (FINAPI && FINAPI.navSnap && FINAPI.navSnap().cur)) navPush(); go(b.dataset.tab); }; });
    var mb = q('[data-more]');
    if (mb) mb.onclick = function () {
      var last2 = null;
      sheet('المزيد', '<div class="more-list">' + st.moreTabs.map(function (t) {
        var g = TAB_GROUP[t[0]] || '', head = g !== last2 ? '<div class="side-g">' + esc(g) + '</div>' : ''; last2 = g;
        return head + '<button class="tab more-i' + (st.tab === t[0] ? ' on' : '') + '" data-tab="' + t[0] + '">' + tabIcon(t[0]) + '<span>' + esc(t[1]) + '</span></button>';
      }).join('') + '<div class="side-g">الحساب</div>' +
        (window.RKInstall && RKInstall.can() ? '<button class="tab more-i" data-minst>' + tabIcon('dash') + '<span>تثبيت التطبيق على الجهاز</span></button>' : '') +
        '<button class="tab more-i" data-msnd>' + sndIcon() + '<span>الأصوات</span></button><button class="tab more-i" data-mpin>' + ICON.key + '<span>تغيير الرقم السري</span></button><button class="tab more-i" data-mlo>' + ICON.out + '<span>خروج</span></button></div>', function (s) {
        qa('[data-tab]', s.el).forEach(function (b) { b.onclick = function () { s.close(); setTimeout(function () { navPush(); go(b.dataset.tab); }, 30); }; });
        var mi = q('[data-minst]', s.el); if (mi) mi.onclick = function () { s.close(); RKInstall.show(); };
        q('[data-mpin]', s.el).onclick = function () { s.close(); pinSheet(); };
        q('[data-msnd]', s.el).onclick = function () { s.close(); sndSheet(); };
        navBadges();
        q('[data-mlo]', s.el).onclick = function () { s.close(); q('#lo').click(); };
      });
    };
    if (!startApp.bound) {
      startApp.bound = true;
      window.addEventListener('resize', function () { if (st.user && q('#main') && isPhone() !== st.phone) startApp(true); });
    }
    netUI();
    render();
    if (!keep) refresh(false);
  }

  function go(tab) { if (window.RKSnd && tab !== st.tab) RKSnd.play('nav'); st.tab = tab; render(); refresh(true); window.scrollTo(0, 0); }
  function shellUI() {
    if (!st.user) return;
    var name = (tabsFor(st.user).filter(function (t) { return t[0] === st.tab; })[0] || [])[1] || '';
    var t = q('#ptitle'), sub = q('#psub');
    if (t) t.textContent = name;
    if (sub) sub.textContent = st.phone ? '' : PAGE_SUB[st.tab] || '';
    var mb = q('[data-more]'); if (mb) mb.classList.toggle('on', (st.moreTabs || []).some(function (x) { return x[0] === st.tab; }));
  }

  var FINAPI = null;
  function netUI() {
    if (FINAPI && FINAPI.paintSync) FINAPI.paintSync();
    var n = q('#net');
    if (!n) return;
    n.className = 'net' + (st.online ? '' : ' off');
    n.textContent = st.online ? 'متصل' : 'بلا إنترنت';
  }

  function render() {
    qa('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === st.tab); });
    shellUI();
    var m = q('#main'), v = VIEWS[st.tab];
    if (!m) return;
    try { if (v) m.innerHTML = v.html(); if (v && v.bind) v.bind(m); }
    catch (e) { m.innerHTML = '<div class="msg err">حدث خطأ في عرض الشاشة: ' + esc(e.message) + '</div>'; if (window.console) console.error(e); }
  }

  function refresh(quiet) {
    if (!st.user || !navigator.onLine) return;
    var v = VIEWS[st.tab];
    if (v && v.load) v.load(quiet).then(function (changed) { if (VIEWS[st.tab] === v && changed !== false) render(); }).catch(function (e) { if (VIEWS[st.tab] === v) render(); if (!quiet) toast(e.message, true); });
  }

  // علامة «قيد التطوير» على زر التقرير اليومي (تتحكم بها الإعدادات المالية)
  function navBadges() {
    var on = true; try { on = localStorage.getItem('rk.devDaily') !== 'off'; } catch (e) {}
    qa('[data-tab="daily"]').forEach(function (b) {
      var x = b.querySelector('.dev-b');
      if (on && !x) { x = document.createElement('i'); x.className = 'dev-b'; x.textContent = 'قيد التطوير'; x.title = 'قيد التطوير'; b.appendChild(x); }
      else if (!on && x) x.remove();
    });
  }
  window.RKShell = { navBadges: navBadges };
  function sndIcon() {
    var off = window.RKSnd && !RKSnd.prefs().sound;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z"/>' + (off ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M16.5 8.5a5 5 0 010 7M19.5 5.5a9 9 0 010 13"/>') + '</svg>';
  }
  function sndSheet() {
    if (!window.RKSnd) return;
    var pr = RKSnd.prefs();
    sheet('أصوات الواجهة', '<div class="form"><p class="small muted" style="margin:0">نفس مؤثرات منظومة باركود الأصول: نقرة خفيفة عند الضغط، وصوت للتنقل والحفظ والأخطاء والطباعة. الإعداد خاص بهذا الجهاز.</p>' +
      '<label class="chk"><input type="checkbox" id="sndOn"' + (pr.sound ? ' checked' : '') + '> تشغيل الأصوات</label>' +
      '<div class="field"><label class="lbl" for="sndVol">مستوى الصوت <b id="sndV">' + pr.vol + '%</b></label><input type="range" id="sndVol" min="0" max="100" step="5" value="' + pr.vol + '"' + (pr.sound ? '' : ' disabled') + ' style="width:100%"></div>' +
      '<div class="row"><button class="btn ghost" data-sndt data-sfx="ok">تجربة</button></div></div>', function (s) {
      var on = q('#sndOn', s.el), vol = q('#sndVol', s.el);
      on.onchange = function () { RKSnd.setPrefs({ sound: on.checked }); vol.disabled = !on.checked; var sb = q('#sndb'); if (sb) sb.innerHTML = sndIcon(); if (on.checked) RKSnd.play('ok'); };
      vol.oninput = function () { RKSnd.setPrefs({ vol: vol.value }); q('#sndV', s.el).textContent = vol.value + '%'; };
      vol.onchange = function () { RKSnd.play('ok'); };
      q('[data-sndt]', s.el).onclick = function () { ['tick', 'nav', 'ok'].forEach(function (n, i) { setTimeout(function () { RKSnd.play(n); }, i * 300); }); };
    });
  }
  function pinSheet() {
    sheet('تغيير الرقم السري', '<form class="form" id="cf"><div class="field"><label for="c0">الرقم السري الحالي</label><input id="c0" class="input pin" type="password" inputmode="numeric" required></div>' +
      '<div class="field"><label for="c1">الجديد (4 إلى 8 أرقام)</label><input id="c1" class="input pin" type="password" inputmode="numeric" required></div>' +
      '<div class="field"><label for="c2">أعد كتابته</label><input id="c2" class="input pin" type="password" inputmode="numeric" required></div><div id="cm"></div><button class="btn primary big">حفظ</button></form>', function (s) {
      q('#cf', s.el).onsubmit = function (e) {
        e.preventDefault();
        var m = q('#cm', s.el), b = q('button.primary', s.el);
        if (q('#c1', s.el).value !== q('#c2', s.el).value) { m.innerHTML = '<div class="msg err">الرقمان غير متطابقين</div>'; return; }
        busy(b, true);
        call('change_pin', { old: q('#c0', s.el).value, pin: q('#c1', s.el).value }).then(function () { s.close(); toast('تم تغيير الرقم السري'); })
          .catch(function (e2) { busy(b, false); m.innerHTML = '<div class="msg err">' + esc(e2.message) + '</div>'; });
      };
    });
  }

  var VIEWS = {};

  /* ===================== المستخدمون ===================== */
  var ROLE_AR = { manager: 'المدير', accountant: 'المحاسب', viewer: 'مطّلع' };
  var ROLE_HELP = { manager: 'كل الصلاحيات، وإدارة المستخدمين، وسجل التدقيق. يُطلب رمز من بريده عند الدخول من جهاز جديد.',
    accountant: 'كل التقارير، وتعريف الصناديق والبنوك، وحفظ التقارير المخصصة.', viewer: 'يرى لوحة المؤشرات والتقارير فقط، دون تعديل.' };
  VIEWS.users = {
    load: function () { return call('users_list').then(function (r) { st.users = r.users; st.codesToMgr = !!r.codes_to_manager; }); },
    html: function () {
      if (!st.users) return '<div class="card loading"><span class="spin"></span> جارٍ التحميل…</div>';
      return '<div class="sec-title"><h2>مستخدمو المنظومة المالية</h2><button class="btn primary" data-new>+ مستخدم جديد</button></div>' +
        '<p class="small muted" style="margin:0 0 10px">حسابات هذه المنظومة مستقلة تماماً عن تطبيق تتبع الفواتير.</p><div class="list">' +
        st.users.map(function (u) {
          return '<button class="item tap" data-u="' + esc(u.id) + '"><div class="main"><b>' + esc(u.name) + (u.active ? '' : ' <span class="badge">موقوف</span>') + '</b><div class="meta"><span class="ltr">' + esc(u.username) +
            '</span><span class="badge">' + esc(ROLE_AR[u.role] || u.role) + '</span>' + (u.email ? '<span>' + esc(u.email) + '</span>' : '') + '<span>آخر ظهور: ' + (u.last_seen ? N(String(u.last_seen).slice(0, 16)) : '—') + '</span></div></div></button>';
        }).join('') + '</div>' +
        '<div class="card" style="margin-top:14px"><h3>رمز التحقق عند الدخول من جهاز جديد</h3>' +
        '<p class="small" style="margin:0 0 8px">يُرسل الرمز إلى البريد المكتوب في حساب المستخدم نفسه (بريده الشخصي)، ويصله من حساب Google المالك للمنظومة. المستخدم الذي ليس له بريد يدخل بالرقم السري فقط.</p>' +
        '<label class="chk"><input type="checkbox" id="c2m"' + (st.codesToMgr ? ' checked' : '') + '> من ليس له بريد: أرسل رمز دخوله إلى بريد المدير، ويعطيه المدير الرمز</label></div>';
    },
    bind: function (m) {
      var c2 = q('#c2m', m);
      if (c2) c2.onchange = function () { c2.disabled = true; call('sec_save', { codes_to_manager: c2.checked }).then(function (r) { st.codesToMgr = r.codes_to_manager; c2.disabled = false; toast('حُفظ'); }).catch(function (e) { c2.checked = !c2.checked; c2.disabled = false; toast(e.message, true); }); };
      var nb = q('[data-new]', m);
      if (nb) nb.onclick = function () { userForm(null); };
      qa('[data-u]', m).forEach(function (b) { b.onclick = function () { userForm(st.users.filter(function (u) { return u.id === b.dataset.u; })[0]); }; });
    }
  };
  function userForm(u) {
    var d = u ? Object.assign({}, u) : { username: '', name: '', role: 'accountant', email: '', phone: '', active: true };
    sheet(u ? 'تعديل ' + u.name : 'مستخدم جديد', '<form class="form" id="uf">' +
      '<div class="field"><label for="un">الاسم</label><input id="un" class="input" value="' + esc(d.name) + '" required></div>' +
      '<div class="field"><label for="uu">اسم المستخدم (بالإنجليزية)</label><input id="uu" class="input ltr" autocapitalize="none" value="' + esc(d.username) + '" required></div>' +
      '<div class="field"><span class="lbl">الدور</span><div class="chips">' + ['manager', 'accountant', 'viewer'].map(function (r) { return '<button type="button" class="chip' + (d.role === r ? ' on' : '') + '" data-r="' + r + '">' + ROLE_AR[r] + '</button>'; }).join('') +
      '</div><span class="small muted" id="rh">' + esc(ROLE_HELP[d.role]) + '</span></div>' +
      '<div class="field"><label for="ue">البريد (لرمز التحقق عند الدخول من جهاز جديد؛ إلزامي للمدير)</label><input id="ue" class="input ltr" type="email" value="' + esc(d.email) + '"></div>' +
      '<div class="field"><label for="up">الهاتف (اختياري)</label><input id="up" class="input ltr" value="' + esc(d.phone) + '"></div>' +
      (u ? '<label class="chk"><input type="checkbox" id="ua"' + (d.active ? ' checked' : '') + '> الحساب نشط</label>' +
        '<label class="chk"><input type="checkbox" id="ur"> رقم سري مؤقت جديد</label>' +
        (u.devices ? '<label class="chk"><input type="checkbox" id="ud"> إلغاء الأجهزة الموثوقة (' + u.devices + ') ويُطلب رمز البريد من جديد</label>' : '') : '') +
      '<div id="um"></div><button class="btn primary big">حفظ</button></form>', function (s) {
      qa('[data-r]', s.el).forEach(function (c) { c.onclick = function () { d.role = c.dataset.r; qa('[data-r]', s.el).forEach(function (x) { x.classList.toggle('on', x === c); }); q('#rh', s.el).textContent = ROLE_HELP[d.role]; }; });
      q('#uf', s.el).onsubmit = function (e) {
        e.preventDefault();
        var b = q('button.primary', s.el); busy(b, true);
        var body = { id: d.id, name: q('#un', s.el).value, username: q('#uu', s.el).value, role: d.role, email: q('#ue', s.el).value, phone: q('#up', s.el).value,
          active: u ? q('#ua', s.el).checked : true, reset_pin: u ? q('#ur', s.el).checked : false, reset_devices: !!(q('#ud', s.el) && q('#ud', s.el).checked) };
        call('user_save', { user: body }).then(function (r) {
          s.close();
          if (r.pin) sheet('الرقم السري المؤقت', '<p>أعطِ هذه البيانات لـ <b>' + esc(body.name) + '</b>. سيُطلب منه تغيير الرقم عند أول دخول.</p><div class="card" style="text-align:center"><div>اسم المستخدم: <b class="ltr">' +
            esc(body.username.trim().toLowerCase()) + '</b></div><div style="font-size:30px;font-weight:800;letter-spacing:4px" class="num">' + esc(r.pin) + '</div></div><p class="small muted">رابط التطبيق: <span class="ltr">' + esc(location.href.split('#')[0]) + '</span></p>');
          else toast('حُفظ');
          VIEWS.users.load().then(render);
        }).catch(function (e2) { busy(b, false); q('#um', s.el).innerHTML = '<div class="msg err">' + esc(e2.message) + '</div>'; });
      };
    });
  }

  /* ===================== سجل التدقيق ===================== */
  VIEWS.audit = {
    load: function () { return call('audit', { q: st.auditQ || '' }).then(function (r) { st.audit = r.events; }); },
    html: function () {
      if (!st.audit) return '<div class="card loading"><span class="spin"></span> جارٍ التحميل…</div>';
      return '<div class="sec-title"><h2>سجل التدقيق</h2></div><div class="row"><input class="input grow" id="aq" placeholder="بحث بالاسم أو الفعل" value="' + esc(st.auditQ || '') + '"><button class="btn" id="ab">بحث</button></div>' +
        '<div class="card scroll-x" style="margin-top:10px"><table class="tbl"><thead><tr><th>الوقت</th><th>المستخدم</th><th>الفعل</th><th>التفاصيل</th></tr></thead><tbody>' +
        (st.audit.map(function (e) { return '<tr><td class="num" style="white-space:nowrap">' + esc(String(e.t).slice(0, 16)) + '</td><td>' + esc(e.user_name) + '<div class="small muted">' + esc(e.role) + '</div></td><td>' + esc(e.action) + '</td><td class="small">' + esc([e.before, e.after].filter(String).join(' ← ')) + '</td></tr>'; }).join('') ||
          '<tr><td colspan="4" class="muted">لا شيء</td></tr>') + '</tbody></table></div>';
    },
    bind: function (m) {
      if (!q('#ab', m)) return;
      var go2 = function () { st.auditQ = q('#aq', m).value.trim(); VIEWS.audit.load().then(render); };
      q('#ab', m).onclick = go2;
      q('#aq', m).onkeydown = function (e) { if (e.key === 'Enter') go2(); };
    }
  };

  // محرّك التقارير وشاشاتها (fin.js)
  if (window.RKFIN) try {
    window.RKFIN(FINAPI = { esc: esc, q: q, qa: qa, call: call, sheet: sheet, toast: toast, busy: busy, ICON: ICON, st: st,
      VIEWS: VIEWS, render: render, go: go, N: N, withXLSX: withXLSX, saveBook: saveBook, confirmBox: confirmBox,
      onLogout: function (f) { window.RKFIN_RESET = f; } });
  } catch (e) { if (window.console) console.error(e); }

  boot();
})();
