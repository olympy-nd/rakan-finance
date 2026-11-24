/* راكان المالية · محرّك التقارير وشاشاتها
   البيانات تأتي من وكيل سراج إلى خادم المنظومة المالية، وتُحفظ على جهاز المستخدم، وتُحسب التقارير هنا مباشرة.
   (هذا الملف يُجمَّع من web/src بالأمر: node build.js) */
(function () {
  'use strict';
  window.RKFIN = function (A) {
    var esc = A.esc, q = A.q, qa = A.qa, call = A.call, sheet = A.sheet, toast = A.toast, busy = A.busy, S = RK.S, ICON = A.ICON, st = A.st;
    var F = { rows: null, rev: 0, meta: null, D: null, boxes: [], reports: [], config: {}, sub: 'dash', loading: null, progress: '', cur: null,
      dashPer: 'month', custom: null, dailyDate: null, dailyCols: 1 };

    /* ===================== أدوات ===================== */
    function N(v) { return '<span class="num">' + esc(v) + '</span>'; }
    function fm(n) { n = Number(n) || 0; return (Math.abs(n) < 0.0005 ? 0 : n).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }); }
    function f2(n) { n = Number(n) || 0; return (Math.abs(n) < 0.005 ? 0 : n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function fk(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
    function fq(n) { return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
    function pct(a, b) { return b ? (a / b * 100) : 0; }
    function fp(n) { n = Number(n) || 0; if (Math.abs(n) < 0.05) n = 0; return n.toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%'; }
    function today() { return RK.nowStr().slice(0, 10); }
    function d2t(d) { return Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)); }
    function t2d(t) { return new Date(t).toISOString().slice(0, 10); }
    function addD(d, n) { return t2d(d2t(d) + n * 864e5); }
    function days(a, b) { return Math.round((d2t(b) - d2t(a)) / 864e5); }
    function weekStart(d) { var w = new Date(d2t(d)).getUTCDay(); return addD(d, -((w + 1) % 7)); }   // الأسبوع يبدأ السبت
    function monthEnd(m) { var y = +m.slice(0, 4), mo = +m.slice(5, 7); return t2d(Date.UTC(y, mo, 0)); }
    var MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    var MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DOW = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    function monthLabel(m) { return MONTHS[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
    function dayShort(d) { return (+d.slice(8, 10)) + '-' + MON_EN[+d.slice(5, 7) - 1]; }
    function bucket(d, g) { return g === 'month' ? d.slice(0, 7) : g === 'week' ? weekStart(d) : g === 'year' ? d.slice(0, 4) : d; }
    function bucketLabel(k, g) { return g === 'month' ? monthLabel(k) : g === 'week' ? 'أسبوع ' + k : k; }
    function sum(list, f) { var s = 0; for (var i = 0; i < list.length; i++) s += (typeof f === 'function' ? f(list[i]) : list[i][f]) || 0; return s; }
    function uniq(a) { var o = {}, r = []; a.forEach(function (x) { if (!o[x]) { o[x] = 1; r.push(x); } }); return r; }

    var PRESETS = [['today', 'اليوم'], ['yesterday', 'أمس'], ['week', 'هذا الأسبوع'], ['last7', 'آخر 7 أيام'], ['month', 'هذا الشهر'],
      ['lastmonth', 'الشهر الماضي'], ['quarter', 'هذا الربع'], ['year', 'هذه السنة'], ['lastyear', 'السنة الماضية'], ['custom', 'فترة محددة']];
    var QNAMES = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
    // الفترة: اسم جاهز، أو ربع q1..q4 من سنة، أو شهر محدد m، أو مقارنة الأرباع cmpq / الأشهر cmpm لسنة
    function presetRange(p, from, to, year, month) {
      var t = today(), m = t.slice(0, 7), y = String(year || t.slice(0, 4));
      var cap = function (d) { return d > t ? t : d; };
      if (/^q[1-4]$/.test(p)) { var qs = (+p[1] - 1) * 3 + 1, qe = qs + 2; var a = y + '-' + ('0' + qs).slice(-2) + '-01'; return [a, cap(monthEnd(y + '-' + ('0' + qe).slice(-2)))]; }
      if (p === 'cmpq' || p === 'cmpm') return [y + '-01-01', cap(y + '-12-31')];
      if (p === 'mon' && month) return [month + '-01', cap(monthEnd(month))];
      switch (p) {
        case 'today': return [t, t];
        case 'yesterday': return [addD(t, -1), addD(t, -1)];
        case 'week': return [weekStart(t), t];
        case 'last7': return [addD(t, -6), t];
        case 'month': return [m + '-01', t];
        case 'lastmonth': var lm = addD(m + '-01', -1).slice(0, 7); return [lm + '-01', monthEnd(lm)];
        case 'quarter': var qm = Math.floor((+t.slice(5, 7) - 1) / 3) * 3 + 1; return [t.slice(0, 4) + '-' + ('0' + qm).slice(-2) + '-01', t];
        case 'year': return [t.slice(0, 4) + '-01-01', t];
        case 'lastyear': var ly = +t.slice(0, 4) - 1; return [ly + '-01-01', ly + '-12-31'];
        default: return [from || m + '-01', to || t];
      }
    }
    function curQuarter() { return 'q' + (Math.floor((+today().slice(5, 7) - 1) / 3) + 1); }
    // أعمدة المقارنة: كل ربع أو كل شهر في السنة حتى اليوم
    function comparePeriods(p, year) {
      var y = String(year || today().slice(0, 4)), t = today(), out = [];
      if (p === 'cmpq') for (var i = 1; i <= 4; i++) { var r = presetRange('q' + i, null, null, y); if (r[0] <= t) out.push({ k: 'q' + i, l: QNAMES[i - 1] + (r[1] === t && t < r[1].slice(0, 4) + '-' + ('0' + i * 3).slice(-2) + '-28' ? ' (حتى اليوم)' : ''), from: r[0], to: r[1] }); }
      if (p === 'cmpm') for (var mI = 1; mI <= 12; mI++) { var mm = y + '-' + ('0' + mI).slice(-2); if (mm + '-01' <= t) out.push({ k: mm, l: MONTHS[mI - 1], from: mm + '-01', to: monthEnd(mm) > t ? t : monthEnd(mm) }); }
      return out;
    }
    function presetName(p, year, month) {
      if (/^q[1-4]$/.test(p)) return QNAMES[+p[1] - 1] + ' ' + (year || today().slice(0, 4));
      if (p === 'cmpq') return 'مقارنة الأرباع ' + (year || today().slice(0, 4));
      if (p === 'cmpm') return 'مقارنة الأشهر ' + (year || today().slice(0, 4));
      if (p === 'mon' && month) return monthLabel(month);
      var x = PRESETS.filter(function (z) { return z[0] === p; })[0];
      return x ? x[1] : 'فترة محددة';
    }
    function prevRange(from, to, p) {
      if (p === 'month' || p === 'lastmonth' || p === 'mon') {
        var pm = addD(from, -1).slice(0, 7), n = days(from, to);
        var pe = addD(pm + '-01', n);
        return [pm + '-01', pe > monthEnd(pm) ? monthEnd(pm) : pe];
      }
      if (/^q[1-4]$/.test(p) || p === 'quarter') { var s0 = from.slice(0, 7), pq = addD(s0 + '-01', -1).slice(0, 7), ps = addD(addD(pq + '-01', -1).slice(0, 7) + '-01', -1).slice(0, 7) + '-01'; var n2 = days(from, to); var pe2 = addD(ps, n2); var qend = addD(from, -1); return [ps, pe2 > qend ? qend : pe2]; }
      if (p === 'year' || p === 'lastyear') { var y = +from.slice(0, 4) - 1; return [y + from.slice(4), y + to.slice(4)]; }
      var len = days(from, to) + 1;
      return [addD(from, -len), addD(from, -1)];
    }
    function perLabel(from, to) { return from === to ? N(from) : 'من ' + N(from) + ' إلى ' + N(to); }

    /* ===================== التخزين المشفّر على الجهاز =====================
     * البيانات المالية تبقى على الجهاز بعد الخروج لكن مشفّرة (AES-GCM 256)، والمفتاح عند الخادم لكل مستخدم وجهاز
     * ولا يُعطى إلا بجلسة صحيحة. المفتاح في الذاكرة وفي sessionStorage (يُمسح عند الخروج أو إغلاق اللسان). */
    var CK = { key: null, kid: '', p: null };
    var CK_PLAIN = { 'fin:rev': 1, 'fin:pks': 1, 'fin:tm': 1 };   // أرقام وإصدارات فقط، لا بيانات مالية
    function ckOk() { return !!(window.crypto && crypto.subtle && typeof CompressionStream !== 'undefined'); }
    function b64u8(b) { var bin = atob(b), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
    function ckImport(o) { return crypto.subtle.importKey('raw', b64u8(o.key), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']).then(function (k) { CK.key = k; CK.kid = o.kid; return k; }); }
    function ckGet() {
      if (CK.key) return Promise.resolve(CK.key);
      if (!ckOk()) return Promise.resolve(null);
      if (CK.p) return CK.p;
      var o = null; try { o = JSON.parse(sessionStorage.getItem('rk.ck') || 'null'); } catch (e) {}
      CK.p = (o && o.key ? Promise.resolve(o) : call('fin_ckey').then(function (r) { var x = { key: r.key, kid: r.kid }; try { sessionStorage.setItem('rk.ck', JSON.stringify(x)); } catch (e) {} return x; }))
        .then(ckImport).catch(function () { return null; }).finally(function () { CK.p = null; });
      return CK.p;
    }
    function ckForget() { CK.key = null; CK.kid = ''; try { sessionStorage.removeItem('rk.ck'); } catch (e) {} }
    function zipBytes(u8) { return new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
    function unzipBytes(u8) { return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); }
    function encBytes(u8) { var iv = crypto.getRandomValues(new Uint8Array(12)); return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, CK.key, u8).then(function (c) { return { kid: CK.kid, iv: iv, c: c }; }); }
    function decBytes(r) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: r.iv }, CK.key, r.c).then(function (b) { return new Uint8Array(b); }); }
    // غلاف التخزين: مفاتيح fin:* تُشفَّر، والحزم تُحفظ مضغوطة كما وصلت (bin) ثم تُشفَّر
    var S0 = S;
    S = {
      get: function (k) {
        if (k.indexOf('fin:') !== 0 || CK_PLAIN[k]) return S0.get(k);
        return S0.get(k).then(function (r) {
          if (!r) return r;
          if (!r.iv) { S.legacy = true; return r; }   // بيانات قديمة غير مشفّرة (قبل هذا الإصدار): تُقرأ ثم تُعاد كتابتها مشفّرة
          if (!CK.key || r.kid !== CK.kid) return null;
          return decBytes(r).then(function (u8) { return r.pk ? { ver: r.ver, bin: u8 } : unzipBytes(u8).then(JSON.parse); }).catch(function () { return null; });
        });
      },
      set: function (k, v) {
        if (k.indexOf('fin:') !== 0 || CK_PLAIN[k]) return S0.set(k, v);
        if (!CK.key) return Promise.resolve();   // بلا مفتاح لا نحفظ شيئاً غير مشفّر
        var isPk = v && v.bin instanceof Uint8Array;
        return (isPk ? Promise.resolve(v.bin) : zipBytes(new TextEncoder().encode(JSON.stringify(v)))).then(encBytes).then(function (r) {
          if (isPk) { r.pk = 1; r.ver = v.ver; }
          return S0.set(k, r);
        }).catch(function () {});
      },
      del: function (k) { return S0.del(k); },
      clearAll: function () { return S0.clearAll(); },
      // قراءة خام (دون فك تشفير) لتجري بالتوازي مع جلب المفتاح، ثم open لفكها
      raw: function (k) { return S0.get(k); },
      open: function (k, r) {
        if (!r) return Promise.resolve(r);
        if (!r.iv) { S.legacy = true; return Promise.resolve(r); }
        if (!CK.key || r.kid !== CK.kid) return Promise.resolve(null);
        return decBytes(r).then(function (u8) { return r.pk ? { ver: r.ver, bin: u8 } : unzipBytes(u8).then(JSON.parse); }).catch(function () { return null; });
      }
    };
    // يفسح المجال للمتصفح بين الأعمال الثقيلة حتى لا تتجمد الشاشة
    // (MessageChannel لا يُبطئه المتصفح في الألسنة الخلفية بعكس setTimeout)
    var YCH = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null, YQ = [];
    if (YCH) YCH.port1.onmessage = function () { var f = YQ.shift(); if (f) f(); };
    function yieldUI() {
      if (window.scheduler && typeof scheduler.yield === 'function') return scheduler.yield();
      return new Promise(function (r) { if (YCH) { YQ.push(r); YCH.port2.postMessage(0); } else setTimeout(r, 0); });
    }
    // أزمنة التحميل (للقياس وتقرير سلامة البيانات)
    var TM = { t0: (window.performance && performance.now) ? performance.now() : Date.now() };
    function now_() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function tmSave() { try { localStorage.setItem('rk.finTm', JSON.stringify(TM)); } catch (e) {} }

    /* ===================== تحميل البيانات ===================== */
    /* ===================== تحميل البيانات =====================
     * الحزم: بيانات كل شهر (لكل قاعدة) ملف مضغوط واحد، تُنزَّل الحزمة فقط إذا تغيّر إصدارها،
     * وتُحفظ على الجهاز كما هي. فوقها «سجل التغييرات» (F.rows): ما وصل بعد آخر اعتماد للحزم. */
    function readCache() {
      var t = now_(), KS = ['fin:rows', 'fin:rev', 'fin:meta', 'fin:aux', 'fin:pks', 'fin:snap'];
      // المفتاح والقراءة من الجهاز بالتوازي
      var rawP = Promise.all(KS.map(function (k) { return S.raw(k); }));
      var pkP = S.raw('fin:pks').then(function (pks) { var names = Object.keys((pks && pks.list) || {}); return Promise.all(names.map(function (n) { return S.raw('fin:pk:' + n); })).then(function (a) { return { names: names, raw: a }; }); });
      return Promise.all([ckGet(), rawP]).then(function (x) {
        TM.key = Math.round(now_() - t); t = now_();
        var raw = x[1];
        return Promise.all(KS.map(function (k, i) { return k === 'fin:rev' || k === 'fin:pks' ? raw[i] : S.open(k, raw[i]); }));
      }).then(function (v) {
        // آخر لوحة مؤشرات محفوظة: تظهر فوراً حتى تكتمل قراءة البيانات
        if (v[5] && v[5].html && !F.D) { F.snap = v[5]; if (A.render) A.render(); }
        // بيانات من مستخدم آخر أو بلا مفتاح: نبدأ من الصفر (الحزم القديمة تُستبدل عند التنزيل)
        var ok = !!v[0];
        F.rows = v[0] || {}; F.rev = ok ? (v[1] || 0) : 0; F.meta = v[2] || null;
        if (v[3]) { F.boxes = v[3].boxes || []; F.reports = v[3].reports || []; F.config = v[3].config || {}; }
        F.pks = ok && v[4] ? v[4] : { gen: '', base: 0, list: {} };
        F.packs = {};
        var names = Object.keys(F.pks.list || {}), legacy = [];
        return pkP.then(function (pr) {
          return Promise.all(names.map(function (n) { var j = pr.names.indexOf(n); return j >= 0 ? S.open('fin:pk:' + n, pr.raw[j]) : S.get('fin:pk:' + n); }));
        }).then(function (arr) {
          TM.read = Math.round(now_() - t); t = now_();
          return Promise.all(arr.map(function (x, i) {
            var n = names[i];
            if (!x || x.ver !== F.pks.list[n]) { delete F.pks.list[n]; return null; }
            if (x.s !== undefined) { legacy.push(n); return x.s; }
            return unzipBytes(x.bin);
          })).then(function (txts) {
            TM.unzip = Math.round(now_() - t); t = now_();
            // التحليل حزمةً حزمة مع فسح المجال للمتصفح بينها: الشاشة تبقى تستجيب
            var i = 0, mx = 0;
            var step = function () {
              if (i >= txts.length) return Promise.resolve();
              var t1 = now_(), txt = txts[i], nm = names[i]; i++;
              if (txt !== null) { try { F.packs[nm] = JSON.parse(txt); } catch (e) { delete F.pks.list[nm]; } }
              mx = Math.max(mx, now_() - t1);
              return yieldUI().then(step);
            };
            return step().then(function () { TM.parseMax = Math.round(mx); return txts; });
          }).then(function (txts) {
            TM.parse = Math.round(now_() - t); t = now_();
            if (hasData()) rebuild();
            TM.rebuild = Math.round(now_() - t); TM.cachePacks = Object.keys(F.packs).length; TM.open = Math.round(now_() - TM.t0); tmSave();
            // نسخة الحزم القديمة غير المشفّرة: تُعاد كتابتها مشفّرة ومضغوطة
            if (legacy.length && CK.key) legacy.forEach(function (n) { var j = JSON.stringify(F.packs[n]); zipBytes(new TextEncoder().encode(j)).then(function (z) { return S.set('fin:pk:' + n, { ver: F.pks.list[n], bin: z }); }); });
            // سجل التغييرات والإعدادات القديمة غير المشفّرة: تُعاد كتابتها مشفّرة
            if (S.legacy && CK.key) { S.legacy = false; S.set('fin:rows', F.rows); S.set('fin:meta', F.meta); S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); }
          });
        });
      });
    }
    function dataCount() {
      var n = 0, rows = F.rows || {};
      Object.keys(F.packs || {}).forEach(function (nm) { var k = F.packs[nm].k; Object.keys(k).forEach(function (x) { n += k[x].v.length; }); });
      Object.keys(rows).forEach(function (k) { if (rows[k][1]) n++; });
      return n;
    }
    function hasData() { return Object.keys(F.rows || {}).length > 0 || Object.keys(F.packs || {}).length > 0; }
    function load(force) {
      if (F.loading) return F.loading;
      var fresh = !F.rows;
      // طلب حفظ دائم حتى لا يحذف المتصفح البيانات المحفوظة عند امتلاء المساحة
      if (fresh && navigator.storage && navigator.storage.persist) navigator.storage.persist().then(function (x) { TM.persist = x; }).catch(function () {});
      F.loading = (fresh ? readCache().then(function () {
        // الفتح الفوري: نعرض آخر بيانات محفوظة الآن، والتحديث يكمل في الخلفية
        if (F.D) setTimeout(function () { if (A.render) A.render(); }, 0);
      }) : Promise.resolve()).then(function () {
        if (!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت');
        return sync(force).then(function () { return Promise.all([call('fin_boxes'), call('fin_reports'), call('fin_config').catch(function () { return { config: F.config }; })]); }).then(function (r) {
          F.boxes = r[0].boxes; F.reports = r[1].reports; F.config = r[2].config || {}; F.error = null; F.syncErr = null; F.lastPull = Date.now();
          return S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config });
        });
      }).catch(function (e) {
        if (!F.D) { F.error = e.message; throw e; }
        F.syncErr = e.message;
        if (!F.quiet) toast('تعذّر تحديث البيانات المالية (' + e.message + ')، تُعرض آخر بيانات محفوظة', true);
      }).finally(function () { F.loading = null; F.progress = ''; paintSync(); });
      paintSync();
      return F.loading;
    }

    function gunzipText(b64) {
      var bin = atob(b64), u = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('المتصفح قديم: حدّثه لتعمل المنظومة'));
      return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    }
    // يجلب حالة الحزم من الخادم، وينزّل ما تغيّر منها فقط (3 في الوقت نفسه)، ثم سجل التغييرات بعدها
    function sync(force) {
      return call('fin_state').catch(function () { return null; }).then(function (st) {
        if (!st || !st.meta || !st.meta.gen) return pull(force);   // خادم أقدم أو بلا حزم بعد: الطريقة القديمة
        F.meta = st.meta;
        var list = {}, changed = false;
        st.packs.forEach(function (p) { list[p.name] = p.ver; });
        var genChanged = st.meta.gen !== F.pks.gen;
        var need = st.packs.filter(function (p) { return !F.packs[p.name] || F.pks.list[p.name] !== p.ver; });
        Object.keys(F.packs).forEach(function (n) { if (!list[n]) { delete F.packs[n]; S.del('fin:pk:' + n); changed = true; } });
        var done = 0, total = need.length, queue = need.slice();
        var one = function () {
          var p = queue.shift();
          if (!p) return Promise.resolve();
          return call('fin_pack', { name: p.name }, { timeout: 180000 }).then(function (r) {
            var bin = b64u8(r.data); TM.bytes = (TM.bytes || 0) + bin.length;
            return unzipBytes(bin).then(function (txt) {
              F.packs[p.name] = JSON.parse(txt); F.pks.list[p.name] = r.ver; changed = true; done++;
              F.progress = 'جارٍ تنزيل البيانات المالية… ' + done + ' من ' + total; paintProgress();
              return S.set('fin:pk:' + p.name, { ver: r.ver, bin: bin });
            });
          }).then(one);
        };
        if (total) { F.progress = 'جارٍ تنزيل البيانات المالية… 0 من ' + total; paintProgress(); }
        var td = now_(); TM.bytes = 0;
        return Promise.all([one(), one(), one()]).then(function () {
          TM.dlPacks = total; TM.dl = Math.round(now_() - td); TM.dlAt = RK.nowStr(); tmSave();
          // الحزم الجديدة تغطي كل ما قبل نقطة الاعتماد: سجل التغييرات القديم لم يعد لازماً
          if (genChanged || F.rev < st.meta.base) { F.rows = {}; F.rev = st.meta.base; changed = true; }
          F.pks = { gen: st.meta.gen, base: st.meta.base, list: list };
          return S.set('fin:pks', F.pks);
        }).then(function () { return pull(force || changed); });
      });
    }

    function pull(force) {
      var changed = 0;
      var step = function () {
        return call('fin_pull', { since: F.rev, limit: 8000 }, { timeout: 120000 }).then(function (r) {
          F.meta = r.meta;
          r.rows.forEach(function (x) {
            var key = x[0] + ':' + x[4];
            // الحذف يبقى علامة حتى يخفي السجل الموجود في الحزمة
            if (x[2]) F.rows[key] = [x[0], null]; else F.rows[key] = [x[0], x[1]];
            changed++;
          });
          F.rev = r.next;
          if (r.more) { F.progress = 'جارٍ تحميل البيانات المالية… ' + Object.keys(F.rows).length.toLocaleString('en-US') + ' سجل'; paintProgress(); return step(); }
        });
      };
      return step().then(function () {
        if (changed || !F.D || force) { if (hasData()) rebuild(); else { F.D = null; F.Dby = {}; } return Promise.all([S.set('fin:rows', F.rows), S.set('fin:rev', F.rev), S.set('fin:meta', F.meta)]); }
        return S.set('fin:meta', F.meta);
      });
    }

    function paintProgress() { var el = q('#finprog'); if (el) el.textContent = F.progress; paintSync(); }
    // مؤشر حالة البيانات أعلى الشاشة بجانب «متصل»: جارٍ التحميل (مع التقدم) ← مكتملة
    function paintSync() {
      var el = q('#dsync'); if (!el) return;
      if (!A.st.user) { el.hidden = true; return; }
      var cls = 'dsync', txt, tip = '';
      var m = /(\d[\d,]*)\s*من\s*(\d[\d,]*)/.exec(F.progress || '');
      if (F.loading) { cls += ' busy'; txt = (F.D ? 'جارٍ تحديث البيانات' : 'جارٍ تحميل البيانات') + (m ? ' ' + m[1] + ' من ' + m[2] : '…'); }
      else if (F.error && !F.D) { cls += ' err'; txt = 'تعذّر تحميل البيانات'; tip = F.error; }
      else if (F.D && F.syncErr) { cls += ' warn'; txt = 'تعذّر التحديث · بيانات محفوظة'; tip = F.syncErr; }
      else if (F.D) { cls += ' ok'; txt = 'البيانات مكتملة ✓'; tip = 'آخر تحديث ' + (F.lastPull ? new Date(F.lastPull).toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' }) : '—') + (F.meta && F.meta.last ? ' · آخر بيانات من سراج ' + F.meta.last : ''); }
      else { el.hidden = true; return; }
      el.hidden = false; el.className = cls; el.textContent = txt; el.title = tip;
    }

    /* ===================== بناء نموذج البيانات ===================== */
    var SALE = 102, SRET = 104, PUR = 105, PRET = 107, OPEN_STOCK = 101, TRANSFER = 108, ISSUE = 110;
    // أثر كل نوع فاتورة على كمية المخزن (المناقلة: من مخزن إلى آخر)
    var STOCK_SIGN = {}; STOCK_SIGN[OPEN_STOCK] = 1; STOCK_SIGN[PUR] = 1; STOCK_SIGN[PRET] = -1; STOCK_SIGN[SALE] = -1; STOCK_SIGN[SRET] = 1; STOCK_SIGN[ISSUE] = -1;

    /* ---------- الفروع: كل قاعدة سراج لها نموذج بيانات مستقل، والموحّد يجمعها ----------
     * F.br: '*' موحّد، أو رمز الفرع ('' للقاعدة الرئيسية)، أو 'cmp' مقارنة الفروع (تُبنى الأعمدة من نماذج الفروع). */
    function branches() { var b = F.meta && F.meta.branches; return b && b.length ? b : [{ code: '', name: 'الإدارة العامة' }]; }
    function multiBr() { return branches().length > 1; }
    function brName(code) { var b = branches().filter(function (x) { return x.code === code; })[0]; return code === '*' ? 'كل الفروع (موحّد)' : code === 'cmp' ? 'مقارنة الفروع' : b ? b.name : code; }
    function viewBr() {
      if (!multiBr()) return '*';
      var b = F.br === undefined ? (function () { try { return localStorage.getItem('fin:br'); } catch (e) { return null; } })() : F.br;
      if (b === null || b === undefined) b = '*';
      if (b !== '*' && b !== 'cmp' && !branches().some(function (x) { return x.code === b; })) b = '*';
      return (F.br = b);
    }
    function setBr(b) { F.br = b; try { localStorage.setItem('fin:br', b); } catch (e) {} useBr(b === 'cmp' ? '*' : b); }
    // يجعل نموذج فرع معيّن هو الحالي (F.D وذاكرته المؤقتة)، ويبنيه عند أول طلب فقط
    function useBr(code) {
      code = multiBr() ? code : '*';
      F.Dby = F.Dby || {}; F.Dcache = F.Dcache || {};
      if (!F.Dby[code]) F.Dby[code] = build(code);
      F.D = F.Dby[code]; F.cache = F.Dcache[code] || (F.Dcache[code] = {}); F.curBr = code;
      return F.D;
    }
    function rebuild() { F.Dby = {}; F.Dcache = {}; useBr(viewBr() === 'cmp' ? '*' : viewBr()); }
    function resetCache() { F.Dcache = {}; F.cache = F.Dcache[F.curBr || '*'] = {}; }
    // يشغّل دالة على نموذج فرع ثم يعيد النموذج الحالي كما كان
    function withBr(code, fn) { var prev = F.curBr || '*'; useBr(code); try { return fn(); } finally { useBr(prev); } }

    function build(code) {
      var T = { acc: {}, bt: {}, it: {}, cu: {}, ag: {}, us: {}, st: {}, item: {}, icl: {}, igr: {}, ipr: {}, jl: [], inv: {}, invl: [] };
      var all = code === undefined || code === '*';
      var put = function (kind, d) { if (kind === 'jl' || kind === 'invl') T[kind].push(d); else if (T[kind]) T[kind][d.id] = d; };
      var rows = F.rows || {};
      Object.keys(F.packs || {}).forEach(function (name) {
        var pk = F.packs[name], br = pk.br || '';
        if (!all && br !== code) return;
        Object.keys(pk.k).forEach(function (kind) {
          var cols = pk.k[kind].c, vals = pk.k[kind].v, nc = cols.length, idi = cols.indexOf('id');
          for (var r = 0; r < vals.length; r++) {
            var row = vals[r];
            if (rows[kind + ':' + row[idi]]) continue;          // في سجل التغييرات نسخة أحدث
            var d = { br: br };
            for (var c = 0; c < nc; c++) if (row[c] !== null) d[cols[c]] = row[c];
            put(kind, d);
          }
        });
      });
      Object.keys(rows).forEach(function (k) {
        var v = rows[k], d;
        if (!v[1]) return;
        try { d = JSON.parse(v[1]); } catch (e) { return; }
        if (!all && (d.br || '') !== code) return;
        d.br = d.br || '';
        put(v[0], d);
      });
      // الحسابات: الشجرة والمسار والطبيعة
      Object.keys(T.acc).forEach(function (id) { var a = T.acc[id]; a.kids = []; a.lvl = Number(a.lvl) || 1; a.fin = Number(a.fin) || 0; a.code = String(a.code || ''); });
      Object.keys(T.acc).forEach(function (id) { var a = T.acc[id], p = T.acc[a.parent]; if (p && a.parent !== id) p.kids.push(id); });
      Object.keys(T.acc).forEach(function (id) {
        var a = T.acc[id], r = a, guard = 0;
        while (T.acc[r.parent] && r.parent !== r.id && guard++ < 12) r = T.acc[r.parent];
        a.root = r.id; a.rootCode = String(r.code || '').charAt(0);
        a.pl = a.fin === 2 || a.fin === 3 || a.rootCode === '3' || a.rootCode === '4';
        a.leaf = !a.kids.length;
      });
      Object.keys(T.acc).forEach(function (id) { var a = T.acc[id]; a.kids.sort(function (x, y) { return String(T.acc[x].po || T.acc[x].code).localeCompare(String(T.acc[y].po || T.acc[y].code)); }); });
      // أنواع القيود
      Object.keys(T.bt).forEach(function (id) {
        var b = T.bt[id], n = String(b.name || '');
        b.kind = /قبض|مقبوضات/.test(n) ? 'r' : /دفع|مدفوعات/.test(n) ? 'p' : /افتتاح/.test(n) ? 'o' : 'j';
      });
      // أسطر القيود
      var byAcc = {}, byEntry = {};
      T.jl.forEach(function (l) {
        l.d = String(l.dt || '').slice(0, 10); l.dr = Number(l.dr) || 0; l.cr = Number(l.cr) || 0;
        var b = T.bt[l.bt];
        l.k = l.src && T.inv[l.src] ? 'i' : b ? b.kind : 'j';
        l.btn = b ? b.name : T.it[l.bt] ? T.it[l.bt].name : (l.k === 'i' ? 'قيد فاتورة' : 'قيد');
        (byAcc[l.a] = byAcc[l.a] || []).push(l);
        (byEntry[l.e] = byEntry[l.e] || []).push(l);
      });
      Object.keys(byAcc).forEach(function (a) { byAcc[a].sort(cmpLine); });
      // الفواتير وأسطرها
      Object.keys(T.inv).forEach(function (id) {
        var v = T.inv[id];
        v.d = String(v.dt || '').slice(0, 10); v.c = Number(v.c); v.net = Number(v.net) || 0; v.qty = Number(v.qty) || 0;
        v.sign = v.c === SRET || v.c === PRET ? -1 : 1;
        v.name = (T.acc[v.acc] && T.acc[v.acc].name) || (T.cu[v.cu] && T.cu[v.cu].name) || '—';
        v.ck = String(v.acc || v.cu || '0');
        v.lines = []; v.profit = 0; v.cost = 0;
      });
      var unitF = {};
      T.invl.forEach(function (l) {
        var v = T.inv[l.inv];
        if (!v) return;
        l.v = v; l.d = v.d; l.q = Number(l.q) || 0; l.qb = Number(l.qb) || l.q; l.tot = Number(l.tot) || 0; l.cost = Number(l.cost) || 0;
        l.g = Number(l.g) || 0; l.p = Number(l.p) || 0;
        l.win = Number(l.win) || (l.cost ? l.tot - l.cost : 0);   // سراج لا يملأ حقل الربح، فنحسبه من القيمة والتكلفة
        l.st = String(l.st || v.st || ''); l.ts = String(l.ts || '');
        v.lines.push(l); v.profit += l.win; v.cost += l.cost;
        if (v.c === SALE && l.q) { var u = unitF[l.item] || (unitF[l.item] = {}); var f = Math.round(l.qb / l.q * 1000) / 1000; var key = f + '|' + (l.un || ''); u[key] = (u[key] || 0) + 1; }
      });
      // الوحدة الأكثر استعمالاً في البيع لكل صنف (الكميات بالصندوق/الكرتونة بدل القطعة)
      Object.keys(T.item).forEach(function (id) {
        var it = T.item[id], u = unitF[id], best = null, n = 0;
        if (u) Object.keys(u).forEach(function (k) { if (u[k] > n) { n = u[k]; best = k; } });
        it.f = best ? Number(best.split('|')[0]) || 1 : 1; it.mu = best ? best.split('|')[1] || it.unit || '' : it.unit || '';
      });
      // حركة المخزون ومتوسط التكلفة المتحرك لكل صنف بالترتيب الزمني
      var moves = [], costHist = {}, avg = {}, onHand = {};
      T.invl.forEach(function (l) {
        if (!l.v) return;
        var c = l.v.c;
        if (c === TRANSFER) { if (l.st) moves.push({ d: l.d, dt: l.v.dt, item: l.item, st: l.st, q: -l.qb }); if (l.ts) moves.push({ d: l.d, dt: l.v.dt, item: l.item, st: l.ts, q: l.qb }); }
        else if (STOCK_SIGN[c]) moves.push({ d: l.d, dt: l.v.dt, item: l.item, st: l.st, q: STOCK_SIGN[c] * l.qb, l: l });
      });
      moves.sort(function (a, b) { return a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : 0; });
      moves.forEach(function (m) {
        if (!m.l) return;
        var c = m.l.v.c, it = m.item, q0 = Math.max(onHand[it] || 0, 0);
        if ((c === OPEN_STOCK || c === PUR) && m.l.qb > 0) {
          var a = avg[it] || 0;
          avg[it] = (a * q0 + m.l.tot) / (q0 + m.l.qb);
          (costHist[it] = costHist[it] || []).push([m.d, avg[it]]);
        }
        onHand[it] = (onHand[it] || 0) + m.q;
      });
      var D = { T: T, br: all ? '*' : code, byAcc: byAcc, byEntry: byEntry, moves: moves, costHist: costHist,
        accList: Object.keys(T.acc).map(function (k) { return T.acc[k]; }).sort(function (x, y) { return String(x.po || x.code).localeCompare(String(y.po || y.code)); }),
        maxDate: T.jl.reduce(function (m, l) { return l.d > m ? l.d : m; }, '') };
      D.invs = Object.keys(T.inv).map(function (k) { return T.inv[k]; });
      // رموز الحسابات تختلف بين القواعد وقد تتكرر، فنحفظ كل الحسابات التي تحمل الرمز
      D.byCode = {}; D.byCodeAll = {};
      D.accList.forEach(function (a) { if (!D.byCode[a.code] || !a.br) D.byCode[a.code] = a; (D.byCodeAll[a.code] = D.byCodeAll[a.code] || []).push(a); });
      D.custAccs = {}; D.invs.forEach(function (v) { if (v.c === SALE || v.c === SRET) D.custAccs[v.ck] = v.name; });
      resolveReps(T, D);
      return D;
    }
    /* ---------- المندوب: من الفاتورة، أو عميلها، أو المخزن، أو المستخدم (حسب الإعداد) ---------- */
    function repSet() {
      var r = F.meta && F.meta.settings && F.meta.settings.reps;
      if (r) return r;
      // الخادم القديم لا يحفظ إعدادات المناديب: نستعمل النسخة المحفوظة على هذا الجهاز
      try { return JSON.parse(localStorage.getItem('rk.finReps') || 'null') || {}; } catch (e) { return {}; }
    }
    function resolveReps(T, D) {
      var RS = repSet(), mode = RS.mode || 'auto', byStore = {}, byUser = {};
      Object.keys(T.ag).forEach(function (id) { var g = T.ag[id]; if (g.st && g.st !== '0') byStore[g.st] = id; if (g.us && g.us !== '0') byUser[g.us] = id; });
      Object.keys(RS.st || {}).forEach(function (k) { byStore[k] = RS.st[k]; });
      Object.keys(RS.us || {}).forEach(function (k) { byUser[k] = RS.us[k]; });
      var ok = function (x) { return x && x !== '0' && T.ag[x] ? x : ''; };
      D.custRepAcc = {};
      Object.keys(T.cu).forEach(function (k) { var c = T.cu[k]; if (ok(c.ag) && c.acc) D.custRepAcc[c.acc] = c.ag; });
      D.invs.forEach(function (v) {
        if (v.ag0 === undefined) v.ag0 = v.ag || '';
        var inv = ok(v.ag0), cust = ok((T.cu[v.cu] || {}).ag) || ok(D.custRepAcc[v.acc]), st = ok(byStore[v.st]), us = ok(byUser[v.u]);
        v.ag = (mode === 'inv' ? inv : mode === 'cust' ? cust || inv : mode === 'store' ? st || inv : mode === 'user' ? us || inv : inv || cust || st || us) || '0';
      });
      // مندوب العميل = مندوب آخر فاتورة مبيع له (لتوزيع الديون والتحصيل على المناديب)
      D.repOfCust = {};
      D.invs.slice().sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; }).forEach(function (v) { if (v.c === SALE && v.ag !== '0') D.repOfCust[v.ck] = v.ag; });
      Object.keys(D.custRepAcc).forEach(function (a) { if (!D.repOfCust[a]) D.repOfCust[a] = D.custRepAcc[a]; });
      D.byUser = byUser;
    }
    function repCat(id) {
      var RS = repSet(), m = RS.map && RS.map[id];
      if (m && m.cat) return m.cat;
      if (!id || id === '0') return 'بدون مندوب';
      return (T().ag[id] || {}).grp || 'بدون فئة';
    }
    function repCats() {
      var out = (repSet().cats || []).slice(), add = function (c) { if (c && out.indexOf(c) < 0) out.push(c); };
      Object.keys(T().ag).forEach(function (id) { add(repCat(id)); });
      return out;
    }
    function cmpLine(x, y) { return x.d < y.d ? -1 : x.d > y.d ? 1 : (Number(x.e) - Number(y.e)) || (Number(x.so) - Number(y.so)); }

    /* ---------- استعلامات الحسابات ---------- */
    function T() { return F.D.T; }
    function acc(id) { return T().acc[id]; }
    function accName(id) { var a = acc(id); return a ? a.name : '—'; }
    function descend(id) {
      var out = [], seen = {};
      (function walk(x) { if (seen[x]) return; seen[x] = 1; out.push(x); var a = acc(x); if (a) a.kids.forEach(walk); })(id);
      return out;
    }
    // رموز حسابات مفصولة بفواصل ← كل الحسابات تحتها (الحساب الرئيسي يشمل فروعه)
    function byCodes(codes, brOnly) {
      var key = 'c:' + codes + (brOnly === undefined ? '' : '@' + brOnly);
      if (F.cache[key]) return F.cache[key];
      var ids = [];
      String(codes || '').split(/[,،\s]+/).map(function (c) { return c.trim(); }).filter(String).forEach(function (c) {
        (F.D.byCodeAll[c] || []).forEach(function (a) { if (brOnly === undefined || a.br === brOnly) ids = ids.concat(descend(a.id)); });
      });
      return (F.cache[key] = uniq(ids));
    }
    function leavesOf(ids) { return ids.filter(function (id) { var a = acc(id); return a && a.leaf; }); }
    // رصيد مجموعة حسابات: قبل الفترة، وحركتها، وبعدها. الحسابات الختامية (الإيرادات والمصروفات) تبدأ من بداية السنة المالية
    function balance(ids, from, to) {
      var r = { open: 0, dr: 0, cr: 0, close: 0, last: '', lastCr: '' };
      var ys = yearStart();
      ids.forEach(function (id) {
        var a = acc(id), ls = F.D.byAcc[id];
        if (!ls) return;
        var pl = a && a.pl;
        for (var i = 0; i < ls.length; i++) {
          var l = ls[i];
          if (to && l.d > to) break;
          if (pl && l.d < ys && (!from || from >= ys)) continue;
          if (from && l.d < from) { r.open += l.dr - l.cr; continue; }
          r.dr += l.dr; r.cr += l.cr;
          if (l.d > r.last) r.last = l.d;
          if (l.cr && l.d > r.lastCr) r.lastCr = l.d;
        }
      });
      r.close = r.open + r.dr - r.cr;
      return r;
    }
    // بداية البيانات المعتمدة للمقارنة: بداية السنة المالية من الإعدادات، وإلا أول قيد
    function dataStart() { var ys = F.meta && F.meta.settings && F.meta.settings.year_start; if (ys) return ys; if (!F.cache.dstart) F.cache.dstart = T().jl.reduce(function (x, l) { return l.d && l.d < x ? l.d : x; }, today()); return F.cache.dstart; }
    // هل توجد بيانات لسنة سابقة؟ التقارير التي تقارن بالسنة السابقة تُخفى حتى توجد
    function hasPrevYear() { return dataStart() < today().slice(0, 4) + '-01-01'; }
    function repKeys() { var hp = hasPrevYear(); return Object.keys(R).filter(function (k) { return hp || !R[k].needPrev; }); }
    function yearStart() { return (F.meta && F.meta.settings && F.meta.settings.year_start) || today().slice(0, 4) + '-01-01'; }
    // حسابات العملاء والموردين: لكل فرع حساباته (دليل حسابات مستقل). الفرع الذي لم تُحدَّد له يأخذ رموز القاعدة الرئيسية
    function grpCodes(k, code) {
      var s = (F.meta && F.meta.settings) || {}, def = s[k] || (k === 'recv' ? '1601' : '261');
      return code ? ((s.br && s.br[code] && s.br[code][k]) || def) : def;
    }
    function grpIds(k) {
      var key = 'grp:' + k;
      if (F.cache[key]) return F.cache[key];
      var ids = [];
      if (!multiBr()) ids = byCodes(grpCodes(k, ''));
      else branches().forEach(function (b) { if (F.D.br === '*' || F.D.br === b.code) ids = ids.concat(byCodes(grpCodes(k, b.code), b.code)); });
      return (F.cache[key] = leavesOf(uniq(ids)));
    }
    function recvIds() { return grpIds('recv'); }
    function payIds() { return grpIds('pay'); }
    // صناديق الفرع المعروض فقط (حساب الصندوق موجود في نموذجه)
    // أنواع السندات المعروضة لكل صندوق (فارغ = كل الأنواع)
    // لكل صندوق: أنواع السندات المعروضة، والطرف المعروض (مدين فقط / دائن فقط / كلاهما) — يُحفظ الطرف كرمز side:dr داخل الأنواع
    var BOX_SIDES = [['', 'كلا الطرفين (مدين ودائن)'], ['dr', 'المدين فقط (الداخل)'], ['cr', 'الدائن فقط (الخارج)']];
    function boxSide(b) { var t = (b && b.types || []).filter(function (x) { return String(x).indexOf('side:') === 0; })[0]; return t ? String(t).slice(5) : ''; }
    function boxTypesOnly(b) { return (b && b.types || []).map(String).filter(function (x) { return x.indexOf('side:') !== 0; }); }
    function boxTypeMap() { var m = {}; F.boxes.forEach(function (b) { if (!b.active) return; var ty = boxTypesOnly(b), sd = boxSide(b); if (ty.length || sd) m[b.acc] = { t: ty.length ? ty : null, s: sd }; }); return m; }
    function boxLinePass(l, m) { var r = (m || boxTypeMap())[l.a]; if (!r) return true; if (r.t && r.t.indexOf(String(l.bt)) < 0) return false; if (r.s === 'dr' && !(l.dr > 0)) return false; if (r.s === 'cr' && !(l.cr > 0)) return false; return true; }
    function activeBoxes(kind) { return F.boxes.filter(function (b) { return b.active && (!kind || b.kind === kind || b.name.indexOf(kind) >= 0) && (!multiBr() || !!T().acc[b.acc]); }); }
    function boxIds(kind) { return activeBoxes(kind).map(function (b) { return b.acc; }); }
    function counterpart(l, ids) {
      var others = (F.D.byEntry[l.e] || []).filter(function (x) { return ids.indexOf(x.a) < 0 && (l.dr ? x.cr : x.dr); });
      if (!others.length) others = (F.D.byEntry[l.e] || []).filter(function (x) { return ids.indexOf(x.a) < 0; });
      var names = [];
      others.forEach(function (x) { var n = accName(x.a); if (names.indexOf(n) < 0) names.push(n); });
      return names.length > 2 ? names[0] + ' و' + (names.length - 1) + ' أخرى' : names.join('، ');
    }
    function entryTotal(lines) { return lines.reduce(function (s, l) { return s + l.dr; }, 0); }
    function entriesIn(from, to, pred) {
      var seen = {}, out = [];
      T().jl.forEach(function (l) { if (l.d < from || l.d > to || seen[l.e]) return; seen[l.e] = 1; if (!pred || pred(l)) out.push(l); });
      return out;
    }

    /* ---------- الفواتير: الحقائق مع التصفية ---------- */
    // التصفية: { cust:[مفاتيح العملاء], item:[], st:[], ag:[], u:[], xcust:[] } أو نص "عميل:1601001,1602; مخزن:الرئيسي; بدون_عميل:..."
    var FKEYS = { 'عميل': 'cust', 'عملاء': 'cust', cust: 'cust', 'صنف': 'item', 'أصناف': 'item', item: 'item', 'مخزن': 'st', store: 'st', st: 'st',
      'مندوب': 'ag', rep: 'ag', ag: 'ag', 'مستخدم': 'u', user: 'u', u: 'u', 'بدون_عميل': 'xcust', xcust: 'xcust', 'بدون_صنف': 'xitem', xitem: 'xitem',
      'بدون_مخزن': 'xst', xst: 'xst', 'نوع': 'type', type: 'type', 'فئة': 'cat', 'فئة_المندوب': 'cat', cat: 'cat', 'بدون_فئة': 'xcat', xcat: 'xcat',
      'حساب': 'acc', 'حسابات': 'acc', acc: 'acc', 'بدون_حساب': 'xacc', xacc: 'xacc' };
    function parseFilter(f) {
      if (!f) return null;
      if (typeof f === 'object') { var any = false; Object.keys(f).forEach(function (k) { if (f[k] && f[k].length) any = true; }); return any ? f : null; }
      var out = {};
      String(f).split(/[;؛]/).forEach(function (part) {
        var m = part.split(/[:=]/);
        if (m.length < 2) return;
        var k = FKEYS[m[0].trim()];
        if (!k) throw new Error('تصفية غير معروفة: ' + m[0].trim());
        out[k] = m.slice(1).join(':').split(/[,،|]/).map(function (x) { return x.trim(); }).filter(String);
      });
      return out;
    }
    // دمج تصفيتين (تصفية المعادلة نفسها + التصفية العامة للشاشة)، مع حصرها في مفاتيح معينة عند الحاجة
    function mergeF(a, b, keys) {
      var x = parseFilter(a), y = parseFilter(b), out = {}, any = false;
      [x, y].forEach(function (f) { if (!f) return; Object.keys(f).forEach(function (k) { if (keys && keys.indexOf(k) < 0) return; if (f[k] && f[k].length) { out[k] = (out[k] || []).concat(f[k]); any = true; } }); });
      return any ? out : null;
    }
    // حسابات العملاء بعد تصفية العميل (للمديونية والتحصيل وأعمار الديون)
    function partyFilter(ids, flt) {
      var f = parseFilter(flt);
      if (!f || !CUST_KEYS.some(function (k) { return f[k] && f[k].length; })) return ids;
      return ids.filter(function (id) {
        var a = acc(id), nm = a ? a.name : '', cd = a ? a.code : '';
        if (f.cust && f.cust.length && !matchAny(f.cust, id, nm, cd)) return false;
        if (f.xcust && f.xcust.length && matchAny(f.xcust, id, nm, cd)) return false;
        if (f.cacc && f.cacc.length && !caccMatch(f.cacc, id)) return false;
        if (f.xcacc && f.xcacc.length && caccMatch(f.xcacc, id)) return false;
        if (f.cgrp && f.cgrp.length && !cgMatch(f.cgrp, id)) return false;
        if (f.xcgrp && f.xcgrp.length && cgMatch(f.xcgrp, id)) return false;
        return true;
      });
    }
    function recvFor(flt) { return partyFilter(recvIds(), flt); }
    var CUST_KEYS = ['cust', 'xcust', 'cacc', 'xcacc', 'cgrp', 'xcgrp'];
    function hasCustF(flt) { var f = parseFilter(flt); return !!(f && CUST_KEYS.some(function (k) { return f[k] && f[k].length; })); }
    function matchAny(list, id, name, code) {
      return list.some(function (x) {
        x = String(x);
        if (x.charAt(0) === '@') return x.slice(1) === String(id);   // اختيار من القائمة: المعرّف بالضبط
        return x === String(id) || (code && (code === x || code.indexOf(x) === 0)) || (name && x.length > 1 && String(name).indexOf(x) >= 0);
      });
    }
    function custMatch(list, v) { var a = acc(v.acc); return matchAny(list, v.ck, v.name, a ? a.code : ''); }
    function itemMatch(list, l) { var it = T().item[l.item] || {}; return matchAny(list, l.item, it.name, it.code ? String(it.code) : ''); }
    function storeMatch(list, sid) { return matchAny(list, sid, (T().st[sid] || {}).name); }
    function invPass(v, f) {
      if (!f) return true;
      if (f.cust && f.cust.length && !custMatch(f.cust, v)) return false;
      if (f.xcust && f.xcust.length && custMatch(f.xcust, v)) return false;
      if (f.cacc && f.cacc.length && !caccMatch(f.cacc, v.ck)) return false;
      if (f.xcacc && f.xcacc.length && caccMatch(f.xcacc, v.ck)) return false;
      if (f.cgrp && f.cgrp.length && !cgMatch(f.cgrp, v.ck)) return false;
      if (f.xcgrp && f.xcgrp.length && cgMatch(f.xcgrp, v.ck)) return false;
      if (f.ag && f.ag.length && !matchAny(f.ag, v.ag, (T().ag[v.ag] || {}).name)) return false;
      if (f.cat && f.cat.length && f.cat.map(function (x) { return String(x).replace(/^@/, ''); }).indexOf(repCat(v.ag)) < 0) return false;
      if (f.xcat && f.xcat.length && f.xcat.map(function (x) { return String(x).replace(/^@/, ''); }).indexOf(repCat(v.ag)) >= 0) return false;
      if (f.u && f.u.length && !matchAny(f.u, v.u, (T().us[v.u] || {}).name)) return false;
      if (f.type && f.type.length && !matchAny(f.type, v.t, (T().it[v.t] || {}).name)) return false;
      if (f.acc && f.acc.length && !accIdSet(f.acc)[v.ck]) return false;
      if (f.xacc && f.xacc.length && accIdSet(f.xacc)[v.ck]) return false;
      return true;
    }
    // حسابات من الدليل (رموز، والحساب الرئيسي يشمل فروعه) ← مجموعة المعرّفات
    function accIdSet(codes) {
      var key = 'as:' + codes.join(',');
      if (F.cache[key]) return F.cache[key];
      var o = {}; byCodes(codes.map(function (c) { return String(c).replace(/^@/, ''); }).join(',')).forEach(function (id) { o[id] = 1; });
      return (F.cache[key] = o);
    }
    function linePass(l, f) {
      if (!f) return true;
      if (f.item && f.item.length && !itemMatch(f.item, l)) return false;
      if (f.xitem && f.xitem.length && itemMatch(f.xitem, l)) return false;
      if (f.icl && f.icl.length && !iclMatch(f.icl, l.item)) return false;
      if (f.xicl && f.xicl.length && iclMatch(f.xicl, l.item)) return false;
      if (f.igrp && f.igrp.length && !igrpMatch(f.igrp, l.item)) return false;
      if (f.xigrp && f.xigrp.length && igrpMatch(f.xigrp, l.item)) return false;
      if (f.st && f.st.length && !storeMatch(f.st, l.st)) return false;
      if (f.xst && f.xst.length && storeMatch(f.xst, l.st)) return false;
      return true;
    }
    // أسطر المبيع/الشراء في فترة: لكل سطر الإشارة (+ مبيع، − مرتجع) والكمية بالوحدة الشائعة
    function facts(kind, from, to, f) {
      f = parseFilter(f);
      var key = 'f:' + kind + from + to + JSON.stringify(f || '');
      if (F.cache[key]) return F.cache[key];
      var types = kind === 'p' ? [PUR, PRET] : [SALE, SRET], out = [];
      F.D.invs.forEach(function (v) {
        if (types.indexOf(v.c) < 0 || v.d < from || v.d > to || !invPass(v, f)) return;
        var s = v.c === SRET || v.c === PRET ? -1 : 1;
        v.lines.forEach(function (l) {
          if (!linePass(l, f)) return;
          var it = T().item[l.item] || { f: 1 };
          out.push({ v: v, l: l, s: s, d: v.d, val: l.tot, qty: l.qb / (it.f || 1), gift: l.g, cost: l.cost, profit: l.win });
        });
      });
      return (F.cache[key] = out);
    }
    function salesStats(from, to, f) {
      var s = { sales: 0, ret: 0, net: 0, n: 0, nr: 0, profit: 0, cost: 0, qty: 0, rqty: 0, gift: 0, cust: 0, purch: 0, pret: 0, pqty: 0 };
      var invs = {}, rets = {}, custs = {};
      facts('s', from, to, f).forEach(function (x) {
        if (x.s > 0) { s.sales += x.val; s.qty += x.qty; invs[x.v.id] = 1; custs[x.v.ck] = 1; } else { s.ret += x.val; s.rqty += x.qty; rets[x.v.id] = 1; }
        s.profit += x.s * x.profit; s.cost += x.s * x.cost; s.gift += x.s * x.gift;
      });
      facts('p', from, to, f).forEach(function (x) { if (x.s > 0) { s.purch += x.val; s.pqty += x.qty; } else { s.pret += x.val; s.pqty -= x.qty; } });
      s.n = Object.keys(invs).length; s.nr = Object.keys(rets).length; s.cust = Object.keys(custs).length;
      s.net = s.sales - s.ret; s.nqty = s.qty - s.rqty;
      return s;
    }
    function cashStats(from, to) {
      var r = { rec: 0, pay: 0, recN: 0, payN: 0 };
      entriesIn(from, to, function (l) { return l.k === 'r' || l.k === 'p'; }).forEach(function (l) {
        var tot = entryTotal(F.D.byEntry[l.e]);
        if (l.k === 'r') { r.rec += tot; r.recN++; } else { r.pay += tot; r.payN++; }
      });
      var b = boxIds();
      if (b.length) { var bb = balance(b, from, to); r.boxIn = bb.dr; r.boxOut = bb.cr; r.boxNet = bb.dr - bb.cr; r.boxClose = bb.close; }
      return r;
    }
    // التحصيل من العملاء إلى صناديق أو بنوك: لكل قيد = الأقل بين المدين على الصناديق والدائن على حسابات العملاء
    // الحسابات المستبعدة من التحصيل (الإعدادات ← الصناديق والبنوك): الحساب وكل فروعه
    function collExclList() { return F.config && Array.isArray(F.config.collx) ? F.config.collx : []; }
    // قواعد الاستبعاد: [{ ids: الحساب وفروعه، cps: الحسابات المقابلة وفروعها (null = أي حساب)، all/t: أنواع السندات }]
    function accTree(id, o) { o = o || {}; (function w(x) { if (!x || o[x]) return; o[x] = 1; var a = T().acc[x]; ((a && a.kids) || []).forEach(w); })(String(id)); return o; }
    function collExcl() {
      if (F.cache.cx) return F.cache.cx;
      var rules = collExclList().map(function (x) {
        var ty = Array.isArray(x.types) ? x.types : [], cps = Array.isArray(x.cps) ? x.cps : [], r = { acc: String(x.acc), ids: accTree(x.acc), cps: null, all: !ty.length, t: {} };
        ty.forEach(function (t) { r.t[String(t)] = 1; });
        // لكل حساب مقابل (وفروعه) أنواع سنداته؛ بلا أنواع = كل الأنواع
        if (cps.length) { r.cps = {}; cps.forEach(function (c) { var ct = Array.isArray(c.types) ? c.types : [], cr = { all: !ct.length, t: {} }; ct.forEach(function (t) { cr.t[String(t)] = 1; }); var tr = accTree(c.acc); Object.keys(tr).forEach(function (id) { if (!r.cps[id]) r.cps[id] = cr; }); }); }
        return r;
      });
      return (F.cache.cx = rules);
    }
    // الحسابات التي تُهمل سطورها في هذا القيد (الحساب المستبعد حين يطابق نوع السند والحساب المقابل)، أو null
    function collExSkip(rules, ls, bt) {
      if (!rules || !rules.length) return null;
      var sk = null;
      rules.forEach(function (r) {
        var mine = ls.filter(function (l) { return r.ids[l.a]; });
        if (!mine.length) return;
        if (r.cps) { if (!ls.some(function (l) { var c = !r.ids[l.a] && r.cps[l.a]; return c && (c.all || c.t[String(bt)]); })) return; }
        else if (!(r.all || r.t[String(bt)])) return;
        sk = sk || {}; mine.forEach(function (l) { sk[l.a] = r.acc; });
      });
      return sk;
    }
    // حسابات أخرى تُحسب في التحصيل (الإعدادات ← الصناديق والبنوك): الدائن عليها مقابل صندوق أو بنك = تحصيل، مثل حسابات العملاء
    function collAddList() { return F.config && Array.isArray(F.config.colla) ? F.config.colla : []; }
    // { حساب: 1 (كل الأنواع) | { نوع: 1 } } — الحساب وفروعه، دون الصناديق والبنوك نفسها
    function collAddSet() {
      if (F.cache.ca) return F.cache.ca;
      var o = {}, bx = {}; boxIds('').forEach(function (x) { bx[x] = 1; });
      collAddList().forEach(function (x) {
        var ty = Array.isArray(x.types) ? x.types : [], v = 1;
        if (ty.length) { v = {}; ty.forEach(function (t) { v[String(t)] = 1; }); }
        Object.keys(accTree(x.acc)).forEach(function (id) { if (bx[id] || o[id] === 1) return; if (v === 1 || !o[id]) o[id] = v; else Object.keys(v).forEach(function (t) { o[id][t] = 1; }); });
      });
      return (F.cache.ca = o);
    }
    // حسابات الطرف الدائن في التحصيل: العملاء، ومعهم الحسابات الإضافية ما لم يكن هناك فلتر عملاء
    function collRset(recvList) {
      var base = recvIds(), rset = {};
      (recvList || base).forEach(function (x) { rset[x] = 1; });
      if (!recvList || recvList === base) { var ca = collAddSet(); Object.keys(ca).forEach(function (k) { if (!rset[k]) rset[k] = ca[k]; }); }
      return rset;
    }
    function rOk(r, bt) { return r === 1 || !!(r && r[String(bt)]); }
    function collections(from, to, kind, perCust, recvList, noExcl) {
      var bx = boxIds(kind), bset = {}, rset = collRset(recvList), tot = 0, by = {}, ex = noExcl ? null : collExcl();
      if (!bx.length && kind) return perCust ? {} : 0;
      bx.forEach(function (x) { bset[x] = 1; });
      entriesIn(from, to).forEach(function (l0) {
        var ls = F.D.byEntry[l0.e], dB = 0, cR = 0, cr = {}, sk = collExSkip(ex, ls, l0.bt);
        ls.forEach(function (l) { if (sk && sk[l.a]) return; if (bx.length ? bset[l.a] : (l0.k === 'r' && l.dr)) dB += l.dr; if (l.cr && rOk(rset[l.a], l0.bt)) { cR += l.cr; cr[l.a] = (cr[l.a] || 0) + l.cr; } });
        var amt = Math.min(dB, cR);
        if (amt <= 0) return;
        tot += amt;
        if (perCust === 'day') by[l0.d] = (by[l0.d] || 0) + amt;
        else if (perCust) Object.keys(cr).forEach(function (a) { by[a] = (by[a] || 0) + amt * cr[a] / cR; });
      });
      return perCust ? by : tot;
    }
    // نوع الحساب المدين في سند القبض: «صندوق» أو «بنك» — من تعريف الصناديق والبنوك، وإلا من اسمه واسم الحسابات فوقه
    function cashBankKind(id) {
      var c = F.cache.cbk || (F.cache.cbk = {});
      if (c[id] !== undefined) return c[id];
      var b = (F.boxes || []).filter(function (x) { return x.acc === id; })[0], k = '';
      if (b) k = /بنك|مصرف/.test(b.kind || '') ? 'بنك' : 'صندوق';
      else { var a = acc(id), names = a ? a.name : '', g = 0, anc = a ? acc(a.parent) : null; while (anc && g++ < 6) { names += ' ' + anc.name; anc = acc(anc.parent); } k = /مصرف|بنك/.test(names) ? 'بنك' : /الصناديق|خزين|صندوق|نقد/.test(names) ? 'صندوق' : ''; }
      return (c[id] = k);
    }
    // التحصيل من العملاء مقسّماً: نقدي (الصناديق) وبنوك، بنفس قواعد collections()
    function collSplit(from, to, recvList) {
      var key = 'cs:' + from + to + (recvList ? recvList.join(',') : '');
      if (F.cache[key]) return F.cache[key];
      var bx = boxIds(''), bset = {}, rset = collRset(recvList), out = { cash: 0, bank: 0, other: 0, tot: 0 }, ex = collExcl();
      bx.forEach(function (x) { bset[x] = 1; });
      entriesIn(from, to).forEach(function (l0) {
        var ls = F.D.byEntry[l0.e], dB = 0, cR = 0, part = { cash: 0, bank: 0, other: 0 }, sk = collExSkip(ex, ls, l0.bt);
        ls.forEach(function (l) {
          if (sk && sk[l.a]) return;
          if ((bx.length ? bset[l.a] : (l0.k === 'r' && l.dr)) && l.dr) { dB += l.dr; var k = cashBankKind(l.a); part[k === 'بنك' ? 'bank' : k === 'صندوق' ? 'cash' : 'other'] += l.dr; }
          if (l.cr && rOk(rset[l.a], l0.bt)) cR += l.cr;
        });
        var amt = Math.min(dB, cR);
        if (amt <= 0 || dB <= 0) return;
        out.tot += amt; out.cash += amt * part.cash / dB; out.bank += amt * part.bank / dB; out.other += amt * part.other / dB;
      });
      return (F.cache[key] = out);
    }
    /* ---------- المخزون ---------- */
    function costAt(item, d) {
      var h = F.D.costHist[item];
      if (!h) return 0;
      var c = 0;
      for (var i = 0; i < h.length && h[i][0] <= d; i++) c = h[i][1];
      return c || h[0][1];
    }
    // أرصدة المخزون في تاريخ: { 'مخزن|صنف': كمية بالوحدة الأساسية }
    function stockAt(d) {
      var key = 'stk:' + d;
      if (F.cache[key]) return F.cache[key];
      var b = {};
      F.D.moves.forEach(function (m) { if (m.d <= d) { var k = m.st + '|' + m.item; b[k] = (b[k] || 0) + m.q; } });
      return (F.cache[key] = b);
    }
    function stockTotals(d, stores, f) {
      var b = stockAt(d), r = { qty: 0, val: 0, base: 0 };
      f = parseFilter(f);
      Object.keys(b).forEach(function (k) {
        var p = k.split('|'), sid = p[0], it = T().item[p[1]] || { f: 1 }, qb = b[k];
        if (Math.abs(qb) < 1e-9) return;
        if (stores && stores.length && !storeMatch(stores, sid)) return;
        if (f && !linePass({ item: p[1], st: sid }, f)) return;
        r.base += qb; r.qty += qb / (it.f || 1); r.val += qb * costAt(p[1], d);
      });
      return r;
    }
    // البضاعة لدى حسابات من الدليل (مثل الوكلاء) حتى تاريخ: المباع لها − المرتجع منها، بالوحدة الشائعة وبالتكلفة
    function accHeld(d, stores, f) {
      f = Object.assign({}, parseFilter(f) || {});
      if (stores && stores.length) f.st = (f.st || []).concat(stores);
      var key = 'ah:' + d + JSON.stringify(f);
      if (F.cache[key]) return F.cache[key];
      var r = { qty: 0, val: 0, base: 0 };
      F.D.invs.forEach(function (v) {
        if ((v.c !== SALE && v.c !== SRET) || v.d > d || !invPass(v, f)) return;
        var s = v.c === SRET ? -1 : 1;
        v.lines.forEach(function (l) {
          if (!linePass(l, f)) return;
          var it = T().item[l.item] || { f: 1 };
          r.base += s * l.qb; r.qty += s * l.qb / (it.f || 1); r.val += s * (l.cost || 0);
        });
      });
      return (F.cache[key] = r);
    }
    function stockOrHeld(d, stores, own, scr) {
      var o = parseFilter(own);
      if (o && o.acc && o.acc.length) return accHeld(d, stores, mergeF(own, scr, ['item', 'xitem', 'st', 'acc', 'xacc']));
      return stockTotals(d, stores, mergeF(own, scr, ['item', 'xitem', 'st']));
    }
