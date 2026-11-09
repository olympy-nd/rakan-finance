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
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>'
  };

  function toast(msg, err) {
    var t = document.createElement('div');
    t.className = 'toast' + (err ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
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
  function sheet(title, html, mount) {
    var bg = document.createElement('div');
    bg.className = 'sheet-bg';
    bg.innerHTML = '<div class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="sheet-h"><h2>' + esc(title) +
      '</h2><button class="iconbtn" data-x aria-label="إغلاق">' + ICON.close + '</button></div><div class="sheet-b">' + html + '</div></div>';
    document.body.appendChild(bg);
    var api = { el: q('.sheet-b', bg), close: function () { bg.remove(); if (api.onclose) api.onclose(); } };
    q('[data-x]', bg).onclick = api.close;
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
      sc.src = 'xlsx.full.min.js';
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
      startApp();
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
          return Promise.all([S.set('token', r.token), S.set('user', r.user)]).then(function () { if (r.user.must_change) renderChangePin(); else startApp(); });
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
        st.user = r.user; S.set('user', r.user); startApp(); toast('تم حفظ رقمك السري');
      }).catch(function (e2) { busy(b, false); m.innerHTML = '<div class="msg err">' + esc(e2.message) + '</div>'; });
    };
  }

  /* ===================== الهيكل ===================== */
  function tabsFor(u) {
    var t = [['dash', 'لوحة المؤشرات'], ['reports', 'التقارير']];
    if (u.can_edit) t.push(['builder', 'تقرير مخصص'], ['settings', 'الصناديق والإعدادات']);
    if (u.role === 'manager') t.push(['users', 'المستخدمون'], ['audit', 'سجل التدقيق']);
    return t;
  }

  function startApp() {
    var tabs = tabsFor(st.user);
    if (!st.tab || !tabs.some(function (t) { return t[0] === st.tab; })) st.tab = tabs[0][0];
    $app.innerHTML = '<div class="strip"></div><header class="top"><div class="top-in"><img class="logo" src="logo.png" alt="راكان">' +
      '<div class="who"><b>' + esc(st.user.name) + '</b><span>التقارير المالية · ' + esc(st.user.role_ar || '') + '</span></div>' +
      '<span class="net" id="net"></span><button class="iconbtn" id="pinb" aria-label="تغيير الرقم السري" title="تغيير الرقم السري">' + ICON.key + '</button>' +
      '<button class="iconbtn" id="lo" aria-label="خروج" title="خروج">' + ICON.out + '</button></div>' +
      '<nav class="tabs" id="tabs">' + tabs.map(function (t) { return '<button class="tab" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>'; }).join('') + '</nav>' +
      '</header><main id="main"></main>';
    q('#lo').onclick = function () { confirmBox('خروج', 'هل تريد الخروج؟ تُمسح البيانات المالية من هذا الجهاز.', 'خروج').then(function (y) { if (y) logout(); }); };
    q('#pinb').onclick = pinSheet;
    qa('[data-tab]').forEach(function (b) { b.onclick = function () { go(b.dataset.tab); }; });
    netUI();
    render();
    refresh(false);
  }

  function go(tab) { st.tab = tab; render(); refresh(true); window.scrollTo(0, 0); }

  function netUI() {
    var n = q('#net');
    if (!n) return;
    n.className = 'net' + (st.online ? '' : ' off');
    n.textContent = st.online ? 'متصل' : 'بلا إنترنت';
  }

  function render() {
    qa('[data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === st.tab); });
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
    load: function () { return call('users_list').then(function (r) { st.users = r.users; }); },
    html: function () {
      if (!st.users) return '<div class="card loading"><span class="spin"></span> جارٍ التحميل…</div>';
      return '<div class="sec-title"><h2>مستخدمو المنظومة المالية</h2><button class="btn primary" data-new>+ مستخدم جديد</button></div>' +
        '<p class="small muted" style="margin:0 0 10px">حسابات هذه المنظومة مستقلة تماماً عن تطبيق تتبع الفواتير.</p><div class="list">' +
        st.users.map(function (u) {
          return '<button class="item tap" data-u="' + esc(u.id) + '"><div class="main"><b>' + esc(u.name) + (u.active ? '' : ' <span class="badge">موقوف</span>') + '</b><div class="meta"><span class="ltr">' + esc(u.username) +
            '</span><span class="badge">' + esc(ROLE_AR[u.role] || u.role) + '</span>' + (u.email ? '<span>' + esc(u.email) + '</span>' : '') + '<span>آخر ظهور: ' + (u.last_seen ? N(String(u.last_seen).slice(0, 16)) : '—') + '</span></div></div></button>';
        }).join('') + '</div>';
    },
    bind: function (m) {
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
    window.RKFIN({ esc: esc, q: q, qa: qa, call: call, sheet: sheet, toast: toast, busy: busy, ICON: ICON, st: st,
      VIEWS: VIEWS, render: render, go: go, withXLSX: withXLSX, saveBook: saveBook, confirmBox: confirmBox,
      onLogout: function (f) { window.RKFIN_RESET = f; } });
  } catch (e) { if (window.console) console.error(e); }

  boot();
})();
