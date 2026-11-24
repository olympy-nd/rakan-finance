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
      clearAll: function () { return S0.clearAll(); }
    };
    // أزمنة التحميل (للقياس وتقرير سلامة البيانات)
    var TM = { t0: (window.performance && performance.now) ? performance.now() : Date.now() };
    function now_() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function tmSave() { try { localStorage.setItem('rk.finTm', JSON.stringify(TM)); } catch (e) {} }

    /* ===================== تحميل البيانات ===================== */
    /* ===================== تحميل البيانات =====================
     * الحزم: بيانات كل شهر (لكل قاعدة) ملف مضغوط واحد، تُنزَّل الحزمة فقط إذا تغيّر إصدارها،
     * وتُحفظ على الجهاز كما هي. فوقها «سجل التغييرات» (F.rows): ما وصل بعد آخر اعتماد للحزم. */
    function readCache() {
      var t = now_();
      return ckGet().then(function () {
        TM.key = Math.round(now_() - t); t = now_();
        return Promise.all([S.get('fin:rows'), S.get('fin:rev'), S.get('fin:meta'), S.get('fin:aux'), S.get('fin:pks')]);
      }).then(function (v) {
        // بيانات من مستخدم آخر أو بلا مفتاح: نبدأ من الصفر (الحزم القديمة تُستبدل عند التنزيل)
        var ok = !!v[0];
        F.rows = v[0] || {}; F.rev = ok ? (v[1] || 0) : 0; F.meta = v[2] || null;
        if (v[3]) { F.boxes = v[3].boxes || []; F.reports = v[3].reports || []; F.config = v[3].config || {}; }
        F.pks = ok && v[4] ? v[4] : { gen: '', base: 0, list: {} };
        F.packs = {};
        var names = Object.keys(F.pks.list || {}), legacy = [];
        return Promise.all(names.map(function (n) { return S.get('fin:pk:' + n); })).then(function (arr) {
          TM.read = Math.round(now_() - t); t = now_();
          return Promise.all(arr.map(function (x, i) {
            var n = names[i];
            if (!x || x.ver !== F.pks.list[n]) { delete F.pks.list[n]; return null; }
            if (x.s !== undefined) { legacy.push(n); return x.s; }
            return unzipBytes(x.bin);
          })).then(function (txts) {
            TM.unzip = Math.round(now_() - t); t = now_();
            txts.forEach(function (txt, i) { if (txt === null) return; try { F.packs[names[i]] = JSON.parse(txt); } catch (e) { delete F.pks.list[names[i]]; } });
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


    /* ===================== محرّك المعادلات (للبطاقات والتقرير اليومي) ===================== */
    // الدوال: الاسم العربي، والاسم الإنجليزي البديل، والوصف، ونوعها (فترة/في تاريخ)
    var FN = [];
    function fn(ar, en, args, desc, impl, grp) { FN.push({ ar: ar, en: en, args: args, desc: desc, impl: impl, grp: grp }); }
    var G_ACC = 'الحسابات', G_SAL = 'المبيعات والمشتريات', G_CASH = 'التحصيل والصناديق', G_STK = 'المخزون', G_MATH = 'رياضيات';
    fn('رصيد', 'BAL', '"رموز الحسابات"', 'رصيد الحساب (مدين − دائن) في نهاية الفترة. الحساب الرئيسي يشمل فروعه.', function (c, a) { return balance(byCodes(a[0]), null, c.to).close; }, G_ACC);
    fn('رصيد_دائن', 'BALC', '"رموز الحسابات"', 'الرصيد الدائن (دائن − مدين) في نهاية الفترة، مثل الموردين والإيرادات.', function (c, a) { return -balance(byCodes(a[0]), null, c.to).close; }, G_ACC);
    fn('افتتاحي', 'OPEN', '"رموز الحسابات"', 'الرصيد قبل بداية الفترة.', function (c, a) { return balance(byCodes(a[0]), c.from, c.to).open; }, G_ACC);
    fn('حركة', 'MOV', '"رموز الحسابات"', 'صافي حركة الحساب خلال الفترة (مدين − دائن).', function (c, a) { var b = balance(byCodes(a[0]), c.from, c.to); return b.dr - b.cr; }, G_ACC);
    fn('مدين', 'DR', '"رموز الحسابات"', 'مجموع المدين خلال الفترة.', function (c, a) { return balance(byCodes(a[0]), c.from, c.to).dr; }, G_ACC);
    fn('دائن', 'CR', '"رموز الحسابات"', 'مجموع الدائن خلال الفترة.', function (c, a) { return balance(byCodes(a[0]), c.from, c.to).cr; }, G_ACC);
    fn('مديونية', 'DEBT', '', 'مديونية العملاء في نهاية الفترة (حسابات العملاء المحددة في الإعدادات).', function (c, a) { return balance(recvFor(mergeF(a[0], c.flt, ['cust', 'xcust'])), null, c.to).close; }, G_ACC);
    fn('الموردون', 'SUPP', '', 'ما للموردين على الشركة في نهاية الفترة (رصيد دائن).', function (c) { return -balance(payIds(), null, c.to).close; }, G_ACC);
    fn('مبيعات', 'SALES', '"تصفية اختيارية"', 'صافي المبيعات (المبيع − المرتجع) في الفترة.', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).net; }, G_SAL);
    fn('مبيعات_إجمالي', 'GSALES', '"تصفية"', 'المبيعات قبل خصم المرتجعات.', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).sales; }, G_SAL);
    fn('مرتجعات', 'RETURNS', '"تصفية"', 'قيمة مرتجعات المبيع.', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).ret; }, G_SAL);
    fn('كمية_مبيعات', 'SQTY', '"تصفية"', 'صافي الكمية المباعة بالوحدة الشائعة (الكرتونة/الصندوق).', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).nqty; }, G_SAL);
    fn('كمية_مرتجعات', 'RQTY', '"تصفية"', 'الكمية المرتجعة.', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).rqty; }, G_SAL);
    fn('هدايا', 'GIFTS', '"تصفية"', 'كمية الهدايا في فواتير المبيع.', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).gift; }, G_SAL);
    fn('ربح', 'PROFIT', '"تصفية"', 'مجمل الربح (القيمة − التكلفة).', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).profit; }, G_SAL);
    fn('تكلفة_مبيعات', 'COGS', '"تصفية"', 'تكلفة البضاعة المباعة.', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).cost; }, G_SAL);
    fn('فواتير_مبيع', 'NINV', '"تصفية"', 'عدد فواتير المبيع.', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).n; }, G_SAL);
    fn('عملاء_مشترون', 'NCUST', '"تصفية"', 'عدد العملاء الذين اشتروا في الفترة.', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).cust; }, G_SAL);
    fn('مشتريات', 'PURCH', '"تصفية"', 'صافي المشتريات (الشراء − مرتجع الشراء).', function (c, a) { var s = salesStats(c.from, c.to, mergeF(a[0], c.flt)); return s.purch - s.pret; }, G_SAL);
    fn('كمية_مشتريات', 'PQTY', '"تصفية"', 'صافي الكمية المشتراة بالوحدة الشائعة.', function (c, a) { return salesStats(c.from, c.to, mergeF(a[0], c.flt)).pqty; }, G_SAL);
    fn('تحصيل', 'COLL', '"صندوق" أو "بنك" أو اسم', 'المحصّل من العملاء في الفترة إلى الصناديق أو البنوك المعرّفة. بدون قيمة: الكل.', function (c, a) { var f = mergeF(a[1], c.flt, ['cust', 'xcust']); return collections(c.from, c.to, a[0] || '', false, f ? recvFor(f) : null); }, G_CASH);
    fn('مقبوضات', 'REC', '', 'مجموع سندات القبض في الفترة.', function (c) { return cashStats(c.from, c.to).rec; }, G_CASH);
    fn('مدفوعات', 'PAY', '', 'مجموع سندات الدفع في الفترة.', function (c) { return cashStats(c.from, c.to).pay; }, G_CASH);
    fn('رصيد_صناديق', 'BOXBAL', '"صندوق" أو "بنك" أو اسم', 'رصيد الصناديق أو البنوك المعرّفة في نهاية الفترة.', function (c, a) { var b = boxIds(a[0] || ''); return b.length ? balance(b, null, c.to).close : 0; }, G_CASH);
    fn('مخزون_كمية', 'STOCKQ', '"المخازن" ، "تصفية"', 'كمية المخزون في نهاية الفترة بالوحدة الشائعة. بدون مخزن: كل المخازن. مع «حساب:»: الكمية لدى الحساب (المباع له − المرتجع منه) حتى نهاية الفترة.', function (c, a) { return stockOrHeld(c.to, splitList(a[0]), a[1], c.flt).qty; }, G_STK);
    fn('مخزون_قيمة', 'STOCKV', '"المخازن" ، "تصفية"', 'قيمة المخزون بمتوسط التكلفة في نهاية الفترة.', function (c, a) { return stockOrHeld(c.to, splitList(a[0]), a[1], c.flt).val; }, G_STK);
    fn('أيام', 'DAYS', '', 'عدد أيام الفترة.', function (c) { return days(c.from, c.to) + 1; }, G_MATH);
    fn('قسمة', 'DIV', 'أ ، ب', 'أ ÷ ب، ويعطي صفراً إذا كانت ب صفراً.', function (c, a) { return a[1] ? a[0] / a[1] : 0; }, G_MATH);
    fn('نسبة', 'PCT', 'أ ، ب', 'أ ÷ ب × 100.', function (c, a) { return a[1] ? a[0] / a[1] * 100 : 0; }, G_MATH);
    fn('مطلق', 'ABS', 'س', 'القيمة المطلقة.', function (c, a) { return Math.abs(a[0]); }, G_MATH);
    fn('تقريب', 'ROUND', 'س ، خانات', 'تقريب إلى عدد خانات.', function (c, a) { var k = Math.pow(10, a[1] || 0); return Math.round(a[0] * k) / k; }, G_MATH);
    fn('أكبر', 'MAX', 'أ ، ب ، ...', 'أكبر قيمة.', function (c, a) { return Math.max.apply(null, a); }, G_MATH);
    fn('أصغر', 'MIN', 'أ ، ب ، ...', 'أصغر قيمة.', function (c, a) { return Math.min.apply(null, a); }, G_MATH);
    var FNMAP = {};
    FN.forEach(function (x) { FNMAP[x.ar] = x; FNMAP[x.en] = x; FNMAP[x.en.toLowerCase()] = x; });
    function splitList(s) { return s ? String(s).split(/[,،|]/).map(function (x) { return x.trim(); }).filter(String) : []; }

    function tokenize(src) {
      var out = [], i = 0, s = String(src || '');
      var digits = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.' };
      s = s.replace(/[٠-٩٫]/g, function (c) { return digits[c]; }).replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/،/g, ',');
      while (i < s.length) {
        var ch = s[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (/[0-9.]/.test(ch)) { var j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; out.push({ t: 'n', v: Number(s.slice(i, j)) }); i = j; continue; }
        if (ch === '"' || ch === "'" || ch === '«' || ch === '“') {
          var end = ch === '«' ? '»' : ch === '“' ? '”' : ch, k = s.indexOf(end, i + 1);
          if (k < 0) throw new Error('علامة تنصيص غير مغلقة');
          out.push({ t: 's', v: s.slice(i + 1, k) }); i = k + 1; continue;
        }
        if (ch === '[' || ch === '{') {   // [1601] = رصيد الحساب 1601 · {اسم} = قيمة بطاقة أو سطر سابق
          var e2 = s.indexOf(ch === '[' ? ']' : '}', i + 1);
          if (e2 < 0) throw new Error('القوس ' + ch + ' غير مغلق');
          out.push({ t: ch === '[' ? 'acc' : 'var', v: s.slice(i + 1, e2).trim() }); i = e2 + 1; continue;
        }
        if ('+-*/(),'.indexOf(ch) >= 0) { out.push({ t: ch }); i++; continue; }
        var m = /^[A-Za-z_؀-ۿ][A-Za-z0-9_؀-ۿ]*/.exec(s.slice(i));
        if (m) { out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
        throw new Error('رمز غير مفهوم: ' + ch);
      }
      return out;
    }
    function parseFormula(src) {
      var tk = tokenize(src), i = 0;
      if (!tk.length) throw new Error('المعادلة فارغة');
      function peek(t) { return tk[i] && tk[i].t === t; }
      function eat(t) { if (!peek(t)) throw new Error('متوقع «' + t + '»' + (tk[i] ? ' بدل «' + (tk[i].v !== undefined ? tk[i].v : tk[i].t) + '»' : ' في النهاية')); return tk[i++]; }
      function expr() { var n = term(); while (peek('+') || peek('-')) { var op = tk[i++].t; n = { op: op, a: n, b: term() }; } return n; }
      function term() { var n = unary(); while (peek('*') || peek('/')) { var op = tk[i++].t; n = { op: op, a: n, b: unary() }; } return n; }
      function unary() { if (peek('-')) { i++; return { op: 'neg', a: unary() }; } if (peek('+')) { i++; return unary(); } return atom(); }
      function atom() {
        var t = tk[i];
        if (!t) throw new Error('المعادلة ناقصة');
        if (t.t === 'n') { i++; return { num: t.v }; }
        if (t.t === 's') { i++; return { str: t.v }; }
        if (t.t === 'acc') { i++; return { fn: FNMAP['رصيد'], args: [{ str: t.v }] }; }
        if (t.t === 'var') { i++; return { vr: t.v }; }
        if (t.t === '(') { i++; var e = expr(); eat(')'); return e; }
        if (t.t === 'id') {
          i++;
          var f = FNMAP[t.v];
          if (!f) throw new Error('دالة غير معروفة: ' + t.v);
          var args = [];
          if (peek('(')) { i++; if (!peek(')')) { args.push(expr()); while (peek(',')) { i++; args.push(expr()); } } eat(')'); }
          return { fn: f, args: args };
        }
        throw new Error('غير متوقع: ' + t.t);
      }
      var tree = expr();
      if (i < tk.length) throw new Error('زيادة غير مفهومة بعد: ' + (tk[i].v !== undefined ? tk[i].v : tk[i].t));
      return tree;
    }
    function evalTree(n, ctx) {
      if (n.num !== undefined) return n.num;
      if (n.str !== undefined) return n.str;
      if (n.vr !== undefined) {
        if (!ctx.vars || !(n.vr in ctx.vars)) throw new Error('{' + n.vr + '} غير معرّف: اكتب اسم بطاقة أو سطر قبله بالضبط');
        if (typeof ctx.vars[n.vr] !== 'number') throw new Error('{' + n.vr + '} فيه خطأ');
        return ctx.vars[n.vr];
      }
      if (n.fn) return Number(n.fn.impl(ctx, n.args.map(function (a) { return evalTree(a, ctx); }))) || 0;
      var a = evalTree(n.a, ctx);
      if (n.op === 'neg') return -a;
      var b = evalTree(n.b, ctx);
      if (typeof a === 'string' || typeof b === 'string') throw new Error('لا يمكن الحساب على نص: ضع النص داخل دالة');
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : b ? a / b : 0;
    }
    var PARSED = {};
    function evalFormula(src, from, to, vars, flt) {
      var tree = PARSED[src] || (PARSED[src] = parseFormula(src));
      var v = evalTree(tree, { from: from, to: to, vars: vars, flt: flt || null });
      if (typeof v === 'string') throw new Error('النتيجة نص، وليست رقماً');
      return isFinite(v) ? v : 0;
    }
    function tryFormula(src, from, to, vars, flt) { try { return { v: evalFormula(src, from, to, vars, flt) }; } catch (e) { return { err: e.message }; } }
    // تقييم قائمة (بطاقات أو أسطر) بالترتيب، وكل سطر يمكنه استعمال ما قبله بالاسم {الاسم}
    function evalList(list, from, to, flt) {
      var vars = {};
      return list.map(function (it) {
        var f = itemF(it);
        if (!f) return { sep: true };
        var r = tryFormula(f, from, to, vars, flt);
        if (it.name) vars[String(it.name).trim()] = r.err ? 'err' : r.v;
        var sf = it.subTerms ? termsToF(it.subTerms) : it.sub;
        if (sf) { var s2 = tryFormula(sf, from, to, vars, flt); r.sub = s2.err ? null : s2.v; }
        return r;
      });
    }
    var FMTS = [['money', 'مبلغ (3 خانات)'], ['money0', 'مبلغ مقرّب'], ['dec2', 'رقم بخانتين'], ['qty', 'كمية'], ['int', 'عدد صحيح'], ['pct', 'نسبة %']];
    function fmtVal(v, f) {
      if (v === null || v === undefined || v === '') return '';
      return f === 'money' ? fm(v) : f === 'money0' ? fk(v) : f === 'dec2' ? f2(v) : f === 'int' ? fk(v) : f === 'pct' ? fp(v) : fq(v);
    }

    /* ---------- المعادلة المبسّطة: عناصر بأسماء واضحة بينها + − × ÷ ---------- */
    // نوع الخيار: flt = تصفية اختيارية (عملاء/أصناف/مخازن) · acc = حسابات · stock = مخازن + أصناف · box = صندوق/بنك · none
    var TK = [
      ['المبيعات', [['مبيعات', 'صافي المبيعات', 'flt'], ['كمية_مبيعات', 'الكمية المباعة', 'flt'], ['مبيعات_إجمالي', 'المبيعات قبل المرتجعات', 'flt'], ['مرتجعات', 'قيمة المرتجعات', 'flt'],
        ['كمية_مرتجعات', 'الكمية المرتجعة', 'flt'], ['ربح', 'مجمل الربح', 'flt'], ['تكلفة_مبيعات', 'تكلفة المبيعات', 'flt'], ['هدايا', 'كمية الهدايا', 'flt'], ['فواتير_مبيع', 'عدد فواتير المبيع', 'flt'], ['عملاء_مشترون', 'عدد العملاء المشترين', 'flt']]],
      ['المشتريات', [['مشتريات', 'صافي المشتريات', 'flt'], ['كمية_مشتريات', 'الكمية المشتراة', 'flt']]],
      ['العملاء والتحصيل', [['مديونية', 'مديونية العملاء', 'cust'], ['تحصيل', 'التحصيل من العملاء', 'coll'], ['الموردون', 'ما للموردين', 'none']]],
      ['الصناديق والبنوك', [['رصيد_صناديق', 'رصيد الصناديق والبنوك', 'box'], ['مقبوضات', 'سندات القبض', 'none'], ['مدفوعات', 'سندات الدفع', 'none']]],
      ['المخزون', [['مخزون_كمية', 'كمية المخزون', 'stock'], ['مخزون_قيمة', 'قيمة المخزون', 'stock']]],
      ['الحسابات', [['رصيد', 'رصيد حساب', 'acc'], ['رصيد_دائن', 'رصيد دائن لحساب', 'acc'], ['حركة', 'حركة حساب في الفترة', 'acc'], ['مدين', 'مدين حساب في الفترة', 'acc'], ['دائن', 'دائن حساب في الفترة', 'acc'], ['افتتاحي', 'رصيد حساب أول الفترة', 'acc']]],
      ['أخرى', [['#num', 'رقم ثابت', 'num'], ['#var', 'نتيجة سطر أو بطاقة سابقة', 'var'], ['أيام', 'عدد أيام الفترة', 'none']]]
    ];
    var TKMAP = {}; TK.forEach(function (g) { g[1].forEach(function (t) { TKMAP[t[0]] = { k: t[0], label: t[1], type: t[2], grp: g[0] }; }); });
    var OPS = { '+': '+', '-': '−', '*': '×', '/': '÷' };
    var FKEY_AR = { cust: 'عميل', item: 'صنف', st: 'مخزن', xcust: 'بدون_عميل', xitem: 'بدون_صنف', ag: 'مندوب', acc: 'حساب' };
    function fltToStr(f) { if (!f) return ''; return Object.keys(f).filter(function (k) { return f[k] && f[k].length && FKEY_AR[k]; }).map(function (k) { return FKEY_AR[k] + ':' + f[k].join(','); }).join('; '); }
    function q2(s) { return '"' + String(s).replace(/"/g, '') + '"'; }
    function termToF(t) {
      var d = TKMAP[t.k];
      if (!d) return '0';
      if (d.type === 'num') return String(Number(t.n) || 0);
      if (d.type === 'var') return '{' + (t.v || '') + '}';
      var fs = fltToStr(t.flt);
      if (d.type === 'flt') return t.k + '(' + (fs ? q2(fs) : '') + ')';
      if (d.type === 'cust') return t.k + '(' + (fs ? q2(fs) : '') + ')';
      if (d.type === 'coll') return t.k + '(' + (t.box || fs ? q2(t.box || '') : '') + (fs ? ', ' + q2(fs) : '') + ')';
      if (d.type === 'box') return t.k + '(' + (t.box ? q2(t.box) : '') + ')';
      if (d.type === 'acc') return t.k + '(' + q2((t.acc || []).join(',')) + ')';
      if (d.type === 'stock') return t.k + '(' + ((t.st && t.st.length) || fs ? q2((t.st || []).join(',')) : '') + (fs ? ', ' + q2(fs) : '') + ')';
      return t.k + '()';
    }
    function termsToF(terms) {
      return (terms || []).map(function (t, i) { return (i ? ' ' + (t.op || '+') + ' ' : '') + termToF(t); }).join('');
    }
    function itemF(it) { return it.terms && it.terms.length ? termsToF(it.terms) : (it.f || ''); }
    function strToFlt(s) { var f = parseFilter(s); if (!f) return null; var o = {}; Object.keys(f).forEach(function (k) { if (FKEY_AR[k]) o[k] = f[k]; }); return o; }
    // تحويل معادلة نصية بسيطة إلى عناصر (للتعديل السهل)؛ يعيد null إن كانت معقدة (أقواس أو دوال متداخلة)
    function fToTerms(src) { try { return fToTerms0(src); } catch (e) { return null; } }
    function fToTerms0(src) {
      var tk; try { tk = tokenize(src); parseFormula(src); } catch (e) { return null; }
      var i = 0, out = [], op = '+';
      while (i < tk.length) {
        var t = tk[i], term = null;
        if (t.t === 'n') { term = { k: '#num', n: t.v }; i++; }
        else if (t.t === 'var') { term = { k: '#var', v: t.v }; i++; }
        else if (t.t === 'acc') { term = { k: 'رصيد', acc: splitList(t.v) }; i++; }
        else if (t.t === 'id') {
          var f = FNMAP[t.v]; if (!f || !TKMAP[f.ar]) return null;
          var d = TKMAP[f.ar], args = []; i++;
          if (tk[i] && tk[i].t === '(') {
            i++;
            while (tk[i] && tk[i].t !== ')') { if (tk[i].t === 's') args.push(tk[i].v); else if (tk[i].t !== ',') return null; i++; }
            if (!tk[i]) return null; i++;
          }
          term = { k: f.ar };
          if (d.type === 'flt' || d.type === 'cust') { if (args[0]) term.flt = strToFlt(args[0]); }
          else if (d.type === 'coll') { term.box = args[0] || ''; if (args[1]) term.flt = strToFlt(args[1]); }
          else if (d.type === 'box') term.box = args[0] || '';
          else if (d.type === 'acc') term.acc = splitList(args[0]);
          else if (d.type === 'stock') { term.st = splitList(args[0]); if (args[1]) term.flt = strToFlt(args[1]); }
        } else return null;
        term.op = op; out.push(term);
        if (i >= tk.length) break;
        var o = tk[i]; if (!OPS[o.t]) return null; op = o.t; i++;
        if (i >= tk.length) return null;
      }
      if (out.length) delete out[0].op;
      return out.length ? out : null;
    }

    /* ---------- الإعدادات الافتراضية للبطاقات والتقرير اليومي ---------- */
    function T1(k, extra) { return Object.assign({ k: k }, extra || {}); }
    var DEFAULT_CARDS = [
      { id: 'c1', name: 'صافي المبيعات', terms: [T1('مبيعات')], fmt: 'money0', subTerms: [T1('فواتير_مبيع')], subl: 'فاتورة مبيع', subfmt: 'int', cmp: true, good: 'up', rep: 'sales_trend' },
      { id: 'c2', name: 'مجمل الربح', terms: [T1('ربح')], fmt: 'money0', subTerms: [T1('ربح'), T1('مبيعات', { op: '/' }), T1('#num', { op: '*', n: 100 })], subl: 'هامش الربح', subfmt: 'pct', cmp: true, good: 'up', rep: 'gross_profit' },
      { id: 'c3', name: 'التحصيل', terms: [T1('تحصيل')], fmt: 'money0', subTerms: [T1('تحصيل'), T1('مبيعات', { op: '/' }), T1('#num', { op: '*', n: 100 })], subl: 'من المبيعات', subfmt: 'pct', cmp: true, good: 'up', rep: 'collections_cust' },
      { id: 'c4', name: 'مديونية العملاء', terms: [T1('مديونية')], fmt: 'money0', cmp: true, good: 'down', rep: 'recv_balances' },
      { id: 'c5', name: 'أرصدة الصناديق والبنوك', terms: [T1('رصيد_صناديق')], fmt: 'money0', cmp: false, rep: 'boxes' },
      { id: 'c6', name: 'قيمة المخزون', terms: [T1('مخزون_قيمة')], fmt: 'money0', subTerms: [T1('مخزون_كمية')], subl: 'كرتونة/وحدة', subfmt: 'qty', cmp: false, rep: 'stock_store' }
    ];
    var DEFAULT_DAILY = { title: 'التقرير اليومي للإدارة', rows: [
      { name: 'Total Sell-Out', terms: [T1('كمية_مبيعات')], fmt: 'dec2' },
      { name: 'Total Sell-Out Amount', terms: [T1('مبيعات')], fmt: 'dec2' },
      { name: 'Total Collection Cash', terms: [T1('تحصيل', { box: 'صندوق' })], fmt: 'dec2' },
      { name: 'Total Collection Transfer', terms: [T1('تحصيل', { box: 'بنك' })], fmt: 'dec2' },
      { name: 'AL ZAHRA Account', terms: [T1('رصيد_دائن', { acc: ['261004'] })], fmt: 'dec2' },
      { name: 'Total Dept in the market', terms: [T1('مديونية')], fmt: 'dec2' },
      { name: 'Inventory (Qty) Main', terms: [T1('مخزون_كمية', { st: ['المستودع الرئيسي'] })], fmt: 'dec2' },
      { name: 'Inventory Value Main', terms: [T1('مخزون_قيمة', { st: ['المستودع الرئيسي'] })], fmt: 'dec2' },
      { name: 'Inventory (Qty) Agents', terms: [T1('مخزون_كمية', { st: ['بنغازي', 'سبها'] })], fmt: 'dec2' },
      { name: 'Inventory Value Agents', terms: [T1('مخزون_قيمة', { st: ['بنغازي', 'سبها'] })], fmt: 'dec2' },
      { name: 'Avarage Selling Price', terms: [T1('مبيعات'), T1('كمية_مبيعات', { op: '/' })], fmt: 'dec2' }
    ] };
    function cards() { return (F.config.cards && F.config.cards.length ? F.config.cards : DEFAULT_CARDS); }
    function dailyDef() { return F.config.daily && F.config.daily.rows ? F.config.daily : DEFAULT_DAILY; }


    /* ===================== التقارير الجاهزة ===================== */
    var CATS = [['exec', 'تنفيذية'], ['stmt', 'القوائم المالية'], ['acct', 'محاسبية'], ['sales', 'المبيعات'], ['cust', 'العملاء'], ['debts', 'المديونيات والتحصيل'],
      ['cash', 'الصناديق والبنوك'], ['purch', 'المشتريات'], ['stock', 'المخزون'], ['admin', 'إدارية'], ['mine', 'تقاريري المخصصة']];
    var GRAN = [['day', 'يومي'], ['week', 'أسبوعي'], ['month', 'شهري']];
    var R = {};
    function C(k, l, t) { return { k: k, l: l, t: t || 'text' }; }
    function sumRow(rows, cols) {
      var t = { name: 'الإجمالي', _b: true };
      cols.forEach(function (c) { if (['money', 'int', 'qty', 'money0'].indexOf(c.t) >= 0) t[c.k] = rows.reduce(function (s, r) { return s + (Number(r[c.k]) || 0); }, 0); });
      if (t.net !== undefined && t.profit !== undefined) t.margin = pct(t.profit, t.net);
      if (t.sales !== undefined && t.ret !== undefined) t.rp = pct(t.ret, t.sales);
      if (cols.some(function (c) { return c.k === 'share'; })) t.share = 100;
      return t;
    }
    function topN(res, p) {
      var n = Number(p.top || 0);
      if (n && res.rows.length > n) { res.note = (res.note ? res.note + ' · ' : '') + 'أعلى ' + n + ' من ' + res.rows.length + ' (الإجمالي يشمل الجميع)'; res.rows = res.rows.slice(0, n); }
      return res;
    }
    function moneyCols(cols) { return cols.filter(function (c) { return ['money', 'int', 'qty', 'money0'].indexOf(c.t) >= 0; }); }
    function custName(k) { var a = acc(k); return a ? a.name : (T().cu[k] || {}).name || F.D.custAccs[k] || k; }
    function itemName(id) { return (T().item[id] || {}).name || 'صنف ' + id; }
    function storeName(id) { return (T().st[id] || {}).name || (id ? 'مخزن ' + id : 'بدون'); }
    // في الموحّد مع أكثر من قاعدة: اسم المخزن مع قاعدته (الإدارة أو الفرع) لتمييز المخازن المتشابهة
    function stBr(id) { var x = T().st[id]; return x ? (x.br || '') : ''; }
    function stMixed() { if (!multiBr()) return false; var k = {}; Object.keys(T().st).forEach(function (id) { k[stBr(id)] = 1; }); return Object.keys(k).length > 1; }
    function stLabel(id) { return storeName(id) + (stMixed() && T().st[id] ? ' — ' + brName(stBr(id)) : ''); }
    // قيم المخازن المكتوبة بالاسم ← المخازن الفعلية التي تطابقها (المعرّف بالضبط يبقى كما هو)
    function stResolve(list) {
      var out = [];
      (list || []).forEach(function (x) {
        x = String(x);
        var ids = x.charAt(0) === '@' ? [x.slice(1)] : Object.keys(T().st).filter(function (id) { return storeMatch([x], id); });
        if (!ids.length) { if (out.indexOf(x) < 0) out.push(x); return; }
        ids.forEach(function (id) { if (out.indexOf('@' + id) < 0) out.push('@' + id); });
      });
      return out;
    }
    function repName(id) { return (T().ag[id] || {}).name || 'بدون مندوب'; }
    function userName(id) { return (T().us[id] || {}).name || 'غير معروف'; }
    function noteF(p) { var f = parseFilter(p.flt); if (!f) return ''; var parts = []; Object.keys(f).forEach(function (k) { if (f[k] && f[k].length) parts.push((FLT_LABEL[k] || k) + ': ' + f[k].map(function (x) { return fltName(k, x); }).join('، ')); }); return parts.length ? 'التصفية: ' + parts.join(' · ') : ''; }
    var FLT_LABEL = { cust: 'العميل', item: 'الصنف', st: 'المخزن', ag: 'المندوب', u: 'المستخدم', xcust: 'بدون العميل', xitem: 'بدون الصنف', xst: 'بدون المخزن', type: 'النوع', cat: 'فئة المندوب', xcat: 'بدون فئة المندوب', cacc: 'حساب العملاء', xcacc: 'بدون حساب العملاء', cgrp: 'مجموعة العملاء', xcgrp: 'بدون مجموعة العملاء', icl: 'تصنيف الصنف', xicl: 'بدون تصنيف الصنف', igrp: 'مجموعة الأصناف', xigrp: 'بدون مجموعة الأصناف', acc: 'الحساب', xacc: 'بدون الحساب' };
    function fltName(k, x) { x = String(x).replace(/^@/, ''); if (k === 'cgrp' || k === 'xcgrp') return cgName(x); if (k === 'icl' || k === 'xicl') return iclName(x); if (k === 'igrp' || k === 'xigrp') return igrpName(x); if (k === 'acc' || k === 'xacc') { var ab = F.D.byCode[x]; return ab ? ab.code + ' ' + ab.name : x; } if (k === 'cacc' || k === 'xcacc') return acc(x) ? acc(x).code + ' ' + acc(x).name : x; return k === 'cust' || k === 'xcust' ? (acc(x) ? acc(x).name : x) : k === 'item' || k === 'xitem' ? (T().item[x] ? itemName(x) : x) : k === 'st' || k === 'xst' ? (T().st[x] ? stLabel(x) : x) : k === 'ag' ? (T().ag[x] ? repName(x) : x) : k === 'u' ? (T().us[x] ? userName(x) : x) : x; }
    function hasItemF(flt) { var f = parseFilter(flt); return !!(f && ['item', 'xitem', 'st', 'icl', 'xicl', 'igrp', 'xigrp'].some(function (k) { return f[k] && f[k].length; })); }
    function custKeys(flt) { if (!hasCustF(flt)) return null; var ok = {}, f = parseFilter(flt); F.D.invs.forEach(function (v) { if ((v.c === SALE || v.c === SRET) && invPass(v, { cust: f.cust, xcust: f.xcust, cacc: f.cacc, xcacc: f.xcacc, cgrp: f.cgrp, xcgrp: f.xcgrp })) ok[v.ck] = 1; }); return ok; }
    function withNote(res, p) { var n = noteF(p); if (n) res.note = (res.note ? res.note + ' · ' : '') + n; return res; }

    // تجميع المبيعات حسب مفتاح (من أسطر الفواتير، فتعمل معها تصفية الصنف والمخزن)
    function salesBy(p, keyFn, labelFn) {
      var g = {};
      facts('s', p.from, p.to, p.flt).forEach(function (x) {
        var k = keyFn(x), r = g[k] || (g[k] = { k: k, name: labelFn(x, k), n: {}, sales: 0, ret: 0, net: 0, profit: 0, qty: 0, cost: 0 });
        if (x.s > 0) { r.n[x.v.id] = 1; r.sales += x.val; } else r.ret += x.val;
        r.profit += x.s * x.profit; r.qty += x.s * x.qty; r.cost += x.s * x.cost; r.net = r.sales - r.ret;
      });
      var list = Object.keys(g).map(function (k) { var r = g[k]; r.n = Object.keys(r.n).length; return r; });
      var totNet = sum(list, 'net');
      list.forEach(function (r) { r.share = pct(r.net, totNet); r.margin = pct(r.profit, r.net); r.rp = pct(r.ret, r.sales); r.avgp = r.qty ? r.net / r.qty : 0; });
      return list;
    }
    var SALES_COLS = [C('n', 'الفواتير', 'int'), C('qty', 'صافي الكمية', 'qty'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('net', 'الصافي', 'money'),
      C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('share', 'الحصة', 'pct')];
    function salesTable(p, label, keyFn, labelFn, extra) {
      var list = salesBy(p, keyFn, labelFn).sort(function (a, b) { return b.net - a.net; });
      var cols = [C('name', label)].concat(SALES_COLS, extra || []);
      return withNote(topN({ cols: cols, rows: list, total: sumRow(list, cols), chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], limit: 12 } }, p), p);
    }
    // جدول محوري: صفوف × أعمدة زمنية لقيمة
    function pivot(p, rowFn, rowLabel, colFn, colLabel, valFn, label, topRows) {
      var g = {}, cols = {};
      facts('s', p.from, p.to, p.flt).forEach(function (x) {
        var rk = rowFn(x), ck = colFn(x), r = g[rk] || (g[rk] = { name: rowLabel(rk), tot: 0 });
        var v = valFn(x); r['c_' + ck] = (r['c_' + ck] || 0) + v; r.tot += v; cols[ck] = 1;
      });
      var list = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.tot - a.tot; });
      var ck = Object.keys(cols).sort();
      var c = [C('name', label)].concat(ck.map(function (k) { return C('c_' + k, colLabel(k), 'money'); }), [C('tot', 'الإجمالي', 'money')]);
      return withNote(topN({ cols: c, rows: list, total: sumRow(list, c) }, { top: p.top || topRows || 0 }), p);
    }

    /* ---------- تنفيذية ---------- */
    R.exec_summary = { cat: 'exec', name: 'الملخص التنفيذي', desc: 'أهم المؤشرات للفترة مقارنة بالفترة السابقة', params: ['period', 'flt'], fdims: ['cust', 'item', 'st', 'ag', 'xcust', 'xitem'],
      run: function (p) {
        var pr = prevRange(p.from, p.to, p.preset), f = p.flt, rv = recvFor(f), sf = mergeF(f, null, ['item', 'xitem', 'st']);
        var a = salesStats(p.from, p.to, f), b = salesStats(pr[0], pr[1], f), ca = cashStats(p.from, p.to), cb = cashStats(pr[0], pr[1]);
        var ra = balance(rv, null, p.to).close, rb = balance(rv, null, pr[1]).close;
        var rows = [
          ['صافي المبيعات', a.net, b.net], ['المبيعات', a.sales, b.sales], ['المرتجعات', a.ret, b.ret],
          ['نسبة المرتجعات %', pct(a.ret, a.sales), pct(b.ret, b.sales), 'p'], ['صافي الكمية المباعة', a.nqty, b.nqty, 'q'], ['عدد فواتير المبيع', a.n, b.n, 'n'],
          ['عدد العملاء المشترين', a.cust, b.cust, 'n'], ['متوسط سعر الوحدة', a.nqty ? a.net / a.nqty : 0, b.nqty ? b.net / b.nqty : 0],
          ['مجمل الربح', a.profit, b.profit], ['هامش الربح %', pct(a.profit, a.net), pct(b.profit, b.net), 'p'],
          ['المشتريات (صافي)', a.purch - a.pret, b.purch - b.pret], ['التحصيل من العملاء', collections(p.from, p.to, '', false, rv), collections(pr[0], pr[1], '', false, rv)],
          ['المقبوضات', ca.rec, cb.rec], ['المدفوعات', ca.pay, cb.pay], ['مديونية العملاء في نهاية الفترة', ra, rb],
          ['قيمة المخزون في نهاية الفترة', stockTotals(p.to, null, sf).val, stockTotals(pr[1], null, sf).val]];
        if (ca.boxNet !== undefined && !parseFilter(f)) rows.push(['أرصدة الصناديق والبنوك في نهاية الفترة', ca.boxClose, cb.boxClose]);
        if (parseFilter(f)) rows = rows.filter(function (r) { return !/المقبوضات|المدفوعات/.test(r[0]); });
        return { cols: [C('m', 'المؤشر'), C('a', 'الفترة الحالية', 'money'), C('b', 'الفترة السابقة', 'money'), C('ch', 'التغيّر %', 'pct')],
          rows: rows.map(function (r) { return { m: r[0], a: r[1], b: r[2], ch: r[2] ? (r[1] - r[2]) / Math.abs(r[2]) * 100 : null, _fmt: r[3] }; }),
          note: 'الفترة السابقة: ' + perLabel(pr[0], pr[1]) + (noteF(p) ? ' · ' + noteF(p) : '') };
      } };
    R.kpi_month = { cat: 'exec', name: 'المؤشرات الشهرية', desc: 'المبيعات والربح والتحصيل والمديونية والمخزون لكل شهر', params: ['period', 'flt'], fdims: ['cust', 'item', 'st', 'ag', 'xcust', 'xitem'],
      run: function (p) {
        var rows = [], m = p.from.slice(0, 7), end = p.to.slice(0, 7), f = p.flt, rv = recvFor(f), sf = mergeF(f, null, ['item', 'xitem', 'st']);
        while (m <= end) {
          var a = m + '-01' < p.from ? p.from : m + '-01', b = monthEnd(m) > p.to ? p.to : monthEnd(m), s = salesStats(a, b, f);
          rows.push({ name: monthLabel(m), net: s.net, qty: s.nqty, profit: s.profit, margin: pct(s.profit, s.net), coll: collections(a, b, '', false, rv), purch: s.purch - s.pret, debt: balance(rv, null, b).close, stock: stockTotals(b, null, sf).val });
          m = addD(monthEnd(m), 1).slice(0, 7);
        }
        var cols = [C('name', 'الشهر'), C('net', 'صافي المبيعات', 'money'), C('qty', 'الكمية', 'qty'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'),
          C('coll', 'التحصيل', 'money'), C('purch', 'المشتريات', 'money'), C('debt', 'المديونية آخر الشهر', 'money'), C('stock', 'المخزون آخر الشهر', 'money')];
        var t = sumRow(rows, cols.slice(0, 7)); t.margin = pct(t.profit, t.net);
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['net', 'coll'], yl: ['صافي المبيعات', 'التحصيل'] } }, p);
      } };

    /* ---------- القوائم المالية ---------- */
    function plTree(p, depth, from, to) {
      var rows = [], tot = { r: 0, u: 0 };
      var roots = F.D.accList.filter(function (a) { return a.lvl === 1 && (a.rootCode === '4' || a.rootCode === '3'); });
      roots.sort(function (x, y) { return String(y.rootCode).localeCompare(String(x.rootCode)) || String(x.code).localeCompare(String(y.code)); });
      roots.forEach(function (r) {
        var res = r.rootCode === '4';
        (function walk(id, lv) {
          var a = acc(id), b = balance(descend(id), from, to), v = res ? b.cr - b.dr : b.dr - b.cr;
          if (Math.abs(v) < 0.0005 && lv > 1) return;
          rows.push({ code: a.code, name: a.name, v: v, _lvl: lv - 1, _b: lv === 1, _acc: id, _id: id });
          if (lv === 1) tot[res ? 'r' : 'u'] = v;
          if (lv < depth) a.kids.forEach(function (k) { walk(k, lv + 1); });
        })(r.id, 1);
      });
      return { rows: rows, net: tot.r - tot.u, tot: tot };
    }
    R.income = { cat: 'stmt', name: 'قائمة الدخل (الأرباح والخسائر)', desc: 'الموارد والاستخدامات من دليل حسابات سراج للفترة', params: ['period', 'level'],
      run: function (p) {
        var t = plTree(p, Number(p.level || 3), p.from, p.to), rows = t.rows;
        rows.push({ code: '', name: t.net >= 0 ? 'صافي الربح' : 'صافي الخسارة', v: t.net, _b: true, _hl: true });
        return { cols: [C('code', 'الرمز'), C('name', 'الحساب'), C('v', 'المبلغ', 'money')], rows: rows, note: 'الموارد (4) بطبيعة دائنة، والاستخدامات (3) بطبيعة مدينة، كما في دليل حسابات سراج' };
      } };
    R.income_cmp = { cat: 'stmt', name: 'قائمة الدخل المقارنة (شهرياً)', desc: 'بنود قائمة الدخل لكل شهر في أعمدة مع الإجمالي', params: ['period', 'level'],
      run: function (p) {
        var depth = Number(p.level || 2), months = [], m = p.from.slice(0, 7);
        while (m <= p.to.slice(0, 7)) { months.push(m); m = addD(monthEnd(m), 1).slice(0, 7); }
        var base = plTree(p, depth, p.from, p.to), rows = base.rows.map(function (r) { return { code: r.code, name: r.name, _lvl: r._lvl, _b: r._b, _acc: r._acc, tot: r.v }; });
        var netRow = { code: '', name: 'صافي الربح (الخسارة)', _b: true, _hl: true, tot: base.net };
        months.forEach(function (mm) {
          var a = mm + '-01' < p.from ? p.from : mm + '-01', b = monthEnd(mm) > p.to ? p.to : monthEnd(mm), t = plTree(p, depth, a, b), map = {};
          t.rows.forEach(function (r) { map[r._id] = r.v; });
          rows.forEach(function (r) { r['m' + mm] = map[r._acc] || 0; });
          netRow['m' + mm] = t.net;
        });
        rows.push(netRow);
        return { cols: [C('code', 'الرمز'), C('name', 'الحساب')].concat(months.map(function (mm) { return C('m' + mm, MONTHS[+mm.slice(5, 7) - 1], 'money'); }), [C('tot', 'الإجمالي', 'money')]), rows: rows };
      } };
    function bsRows(asof, depth) {
      var rows = [], tot = {};
      ['1', '2'].forEach(function (rc) {
        var asset = rc === '1';
        F.D.accList.filter(function (a) { return a.lvl === 1 && a.rootCode === rc && !a.pl; }).forEach(function (r) {
          (function walk(id, lv) {
            var a = acc(id), b = balance(descend(id).filter(function (x) { return !acc(x).pl; }), null, asof), v = asset ? b.close : -b.close;
            if (Math.abs(v) < 0.0005 && lv > 1) return;
            rows.push({ code: a.code, name: a.name, v: v, _lvl: lv - 1, _b: lv === 1, _acc: id });
            if (lv === 1) tot[rc] = (tot[rc] || 0) + v;
            if (lv < depth) a.kids.forEach(function (k) { walk(k, lv + 1); });
          })(r.id, 1);
        });
      });
      var plIds = F.D.accList.filter(function (a) { return a.pl; }).map(function (a) { return a.id; });
      var plb = balance(plIds, yearStart(), asof), profit = plb.cr - plb.dr;
      return { rows: rows, tot: tot, profit: profit };
    }
    R.balance_sheet = { cat: 'stmt', name: 'المركز المالي (الميزانية)', desc: 'الأصول والخصوم وحقوق الملكية في تاريخ محدد', params: ['asof', 'level'],
      run: function (p) {
        var b = bsRows(p.asof, Number(p.level || 3)), rows = b.rows;
        rows.push({ code: '', name: 'صافي ربح (خسارة) السنة حتى التاريخ', v: b.profit, _b: true });
        var liab = (b.tot['2'] || 0) + b.profit;
        rows.push({ code: '', name: 'إجمالي الخصوم وحقوق الملكية والنتيجة', v: liab, _b: true, _hl: true });
        var diff = (b.tot['1'] || 0) - liab;
        return { cols: [C('code', 'الرمز'), C('name', 'الحساب'), C('v', 'الرصيد', 'money')], rows: rows,
          note: Math.abs(diff) < 1 ? 'الميزانية متوازنة: إجمالي الأصول = الخصوم وحقوق الملكية والنتيجة' : 'فرق التوازن: ' + fm(diff) + ' (حسابات خارج الأصول والخصوم، مثل الحساب الختامي)' };
      } };
    R.balance_cmp = { cat: 'stmt', name: 'المركز المالي المقارن', desc: 'الميزانية في تاريخين مع الفرق', params: ['asof', 'asof2', 'level'],
      run: function (p) {
        var d2 = p.asof2 || addD(p.asof.slice(0, 4) + '-01-01', -1); if (!p.asof2 && d2 < dataStart()) d2 = addD(p.asof.slice(0, 7) + '-01', -1); var depth = Number(p.level || 2);
        var a = bsRows(p.asof, depth), b = bsRows(d2, depth), map = {};
        b.rows.forEach(function (r) { map[r._acc] = r.v; });
        var rows = a.rows.map(function (r) { var o = map[r._acc] || 0; return { code: r.code, name: r.name, _lvl: r._lvl, _b: r._b, _acc: r._acc, v: r.v, o: o, ch: r.v - o }; });
        rows.push({ name: 'نتيجة السنة حتى التاريخ', v: a.profit, o: b.profit, ch: a.profit - b.profit, _b: true });
        return { cols: [C('code', 'الرمز'), C('name', 'الحساب'), C('v', 'في ' + p.asof, 'money'), C('o', 'في ' + d2, 'money'), C('ch', 'الفرق', 'money')], rows: rows };
      } };
    R.cash_flow = { cat: 'stmt', name: 'قائمة التدفقات النقدية', desc: 'الداخل والخارج من الصناديق والبنوك المعرّفة مصنّفاً حسب الحساب المقابل', params: ['period'],
      run: function (p) {
        var bx = boxIds();
        if (!bx.length) return { cols: [C('m', '')], rows: [], empty: 'عرّف الصناديق والبنوك أولاً من «الصناديق والإعدادات».' };
        var bset = {}; bx.forEach(function (x) { bset[x] = 1; });
        var g = {}, open = balance(bx, p.from, p.to).open;
        entriesIn(p.from, p.to).forEach(function (l0) {
          var ls = F.D.byEntry[l0.e], cash = 0, others = [];
          ls.forEach(function (l) { if (bset[l.a]) cash += l.dr - l.cr; else others.push(l); });
          if (Math.abs(cash) < 0.0005) return;
          var tot = sum(others, function (l) { return Math.abs(l.dr - l.cr); }) || 1;
          others.forEach(function (l) {
            var a = acc(l.a), grp = a ? ancestorAt(l.a, 2) : 'أخرى', share = cash * Math.abs(l.dr - l.cr) / tot;
            var r = g[grp] || (g[grp] = { name: grp, inn: 0, out: 0 });
            if (share > 0) r.inn += share; else r.out -= share;
          });
          if (!others.length) { var r = g['تحويلات بين الصناديق'] || (g['تحويلات بين الصناديق'] = { name: 'تحويلات بين الصناديق', inn: 0, out: 0 }); if (cash > 0) r.inn += cash; else r.out -= cash; }
        });
        var list = Object.keys(g).map(function (k) { var r = g[k]; r.net = r.inn - r.out; return r; }).sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'المصدر أو الاستخدام (حسب الحساب المقابل)'), C('inn', 'داخل', 'money'), C('out', 'خارج', 'money'), C('net', 'الصافي', 'money')];
        var t = sumRow(list, cols);
        list.unshift({ name: 'رصيد النقدية أول المدة', net: open, _b: true });
        t.name = 'رصيد النقدية آخر المدة'; t.net = open + t.inn - t.out;
        return { cols: cols, rows: list, total: t, note: 'الطريقة المباشرة من حركة الصناديق والبنوك المعرّفة' };
      } };
    R.equity = { cat: 'stmt', name: 'حركة حقوق الملكية', desc: 'رصيد أول المدة والحركة ورصيد آخر المدة لحسابات رأس المال والجاري', params: ['period'],
      run: function (p) {
        var eq = F.D.accList.filter(function (a) { return a.rootCode === '2' && !a.pl && a.lvl === 2 && /رأس|راس|جاري|ملكية|أرباح|ارباح|احتياط/.test(a.name); });
        if (!eq.length) eq = F.D.accList.filter(function (a) { return a.rootCode === '2' && !a.pl && a.lvl === 2; });
        var rows = eq.map(function (a) { var b = balance(descend(a.id), p.from, p.to); return { code: a.code, name: a.name, open: -b.open, inc: b.cr, dec: b.dr, close: -b.close, _acc: a.id }; });
        var cols = [C('code', 'الرمز'), C('name', 'الحساب'), C('open', 'أول المدة', 'money'), C('inc', 'زيادة (دائن)', 'money'), C('dec', 'نقص (مدين)', 'money'), C('close', 'آخر المدة', 'money')];
        var pl = plTree(p, 1, p.from, p.to);
        rows.push({ name: 'نتيجة الفترة (من قائمة الدخل)', close: pl.net, _b: true });
        return { cols: cols, rows: rows, total: sumRow(rows, cols) };
      } };
    R.ratios = { cat: 'stmt', name: 'المؤشرات والنسب المالية', desc: 'السيولة والربحية ودوران المديونية والمخزون', params: ['period'],
      run: function (p) {
        var s = salesStats(p.from, p.to), d = days(p.from, p.to) + 1, debt = balance(recvIds(), null, p.to).close, debt0 = balance(recvIds(), null, addD(p.from, -1)).close;
        var stock = stockTotals(p.to).val, stock0 = stockTotals(addD(p.from, -1)).val, supp = -balance(payIds(), null, p.to).close;
        var ca = 0, cl = 0;
        F.D.accList.filter(function (a) { return a.lvl === 2 && !a.pl; }).forEach(function (a) { var v = balance(descend(a.id), null, p.to).close; if (a.rootCode === '1' && /متداول|نقدية|مدين|عملاء|صناديق|مصارف|مخزون|بضاعة/.test(a.name)) ca += v; if (a.rootCode === '2' && /متداول|دائن|موردين|موردون|قصيرة/.test(a.name)) cl -= v; });
        var pl = plTree(p, 1, p.from, p.to), coll = collections(p.from, p.to, '');
        var rows = [
          ['هامش مجمل الربح', pct(s.profit, s.net), 'pct'], ['هامش صافي الربح (من قائمة الدخل)', pct(pl.net, s.net), 'pct'], ['نسبة المرتجعات', pct(s.ret, s.sales), 'pct'],
          ['متوسط المبيعات اليومية', s.net / d, 'money'], ['متوسط التحصيل اليومي', coll / d, 'money'], ['نسبة التحصيل إلى المبيعات', pct(coll, s.net), 'pct'],
          ['متوسط فترة التحصيل (يوم)', s.net ? ((debt + debt0) / 2) / (s.net / d) : 0, 'qty'], ['دوران المديونية (مرة)', (debt + debt0) ? s.net / ((debt + debt0) / 2) : 0, 'qty'],
          ['دوران المخزون (مرة)', (stock + stock0) ? s.cost / ((stock + stock0) / 2) : 0, 'qty'], ['أيام المخزون', s.cost ? ((stock + stock0) / 2) / (s.cost / d) : 0, 'qty'],
          ['الأصول المتداولة (تقديري)', ca, 'money'], ['الخصوم المتداولة (تقديري)', cl, 'money'], ['نسبة التداول', cl ? ca / cl : 0, 'qty'],
          ['مديونية العملاء', debt, 'money'], ['ما للموردين', supp, 'money'], ['قيمة المخزون', stock, 'money']];
        return { cols: [C('m', 'المؤشر'), C('v', 'القيمة', 'money')], rows: rows.map(function (r) { return { m: r[0], v: r[1], _fmt: r[2] === 'pct' ? 'p' : r[2] === 'qty' ? 'q' : '' }; }),
          note: 'الأصول والخصوم المتداولة تُقدَّر من أسماء الحسابات في المستوى الثاني' };
      } };
    R.gross_profit = { cat: 'stmt', name: 'تحليل مجمل الربح', desc: 'المبيعات وتكلفتها ومجمل الربح والهامش لكل فترة', params: ['period', 'gran', 'flt'],
      run: function (p) {
        var g = p.gran || 'month', list = salesBy(p, function (x) { return bucket(x.d, g); }, function (x, k) { return bucketLabel(k, g); }).sort(function (a, b) { return a.k < b.k ? -1 : 1; });
        var cols = [C('name', 'الفترة'), C('net', 'صافي المبيعات', 'money'), C('cost', 'التكلفة', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct')];
        return withNote({ cols: cols, rows: list, total: sumRow(list, cols), chart: { type: 'bar', x: 'name', y: ['net', 'profit'], yl: ['المبيعات', 'مجمل الربح'] } }, p);
      } };

    /* ---------- محاسبية ---------- */
    function ancestorAt(id, lvl) { var a = acc(id), g = 0; while (a && a.lvl > lvl && acc(a.parent) && g++ < 10) a = acc(a.parent); return a ? a.name : '—'; }
    function statement(ids, p, title, pass) {
      var all = [], hid = { dr: 0, cr: 0, n: 0 };
      ids.forEach(function (id) { (F.D.byAcc[id] || []).forEach(function (l) { if (l.d >= p.from && l.d <= p.to) all.push(l); }); });
      all.sort(cmpLine);
      var b = balance(ids, p.from, p.to), bal = b.open;
      var rows = [{ d: '', no: '', type: '', desc: 'رصيد أول المدة', cp: '', dr: '', cr: '', bal: b.open, _b: true }];
      all.forEach(function (l) {
        bal += l.dr - l.cr;
        if (pass && !pass(l)) { hid.dr += l.dr; hid.cr += l.cr; hid.n++; return; }
        rows.push({ d: l.d, no: l.no, type: l.btn, desc: l.ld || l.ed || '', cp: counterpart(l, ids), dr: l.dr || '', cr: l.cr || '', bal: bal, _acc: ids.length > 1 ? l.a : null });
      });
      return { title: title, cols: [C('d', 'التاريخ'), C('no', 'رقم القيد'), C('type', 'النوع'), C('desc', 'البيان'), C('cp', 'الحساب المقابل'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money'), C('bal', 'الرصيد', 'money')],
        rows: rows, total: { desc: 'الإجمالي ورصيد آخر المدة', dr: b.dr - hid.dr, cr: b.cr - hid.cr, bal: b.close },
        note: hid.n ? 'يُعرض فقط أنواع السندات المحددة لهذا الصندوق. أُخفيت ' + hid.n + ' حركة (مدين ' + fm(hid.dr) + '، دائن ' + fm(hid.cr) + ')، والرصيد يشملها.' : '' };
    }
    R.journal = { cat: 'acct', name: 'دفتر اليومية العامة', desc: 'كل القيود بأسطرها مرتبة بالتاريخ', params: ['period', 'etype'],
      run: function (p) {
        var rows = [], et = p.etype || 'all';
        entriesIn(p.from, p.to, function (l) { return et === 'all' || l.k === et; }).sort(cmpLine).forEach(function (l0) {
          var ls = F.D.byEntry[l0.e].slice().sort(function (a, b) { return (Number(a.so) || 0) - (Number(b.so) || 0); });
          ls.forEach(function (l, i) { rows.push({ d: i ? '' : l.d, no: i ? '' : l.no, type: i ? '' : l.btn, code: (acc(l.a) || {}).code, name: accName(l.a), desc: l.ld || (i ? '' : l.ed) || '', dr: l.dr || '', cr: l.cr || '', _acc: l.a, _b: false }); });
        });
        var cols = [C('d', 'التاريخ'), C('no', 'الرقم'), C('type', 'النوع'), C('code', 'الرمز'), C('name', 'الحساب'), C('desc', 'البيان'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money')];
        return { cols: cols, rows: rows, total: sumRow(rows, cols) };
      } };
    R.entry_types = { cat: 'acct', name: 'ملخص القيود حسب النوع', desc: 'عدد القيود ومبالغها لكل نوع (قبض، دفع، قيد، فواتير…)', params: ['period'],
      run: function (p) {
        var g = {};
        entriesIn(p.from, p.to).forEach(function (l) { var r = g[l.btn] || (g[l.btn] = { name: l.btn, n: 0, v: 0 }); r.n++; r.v += entryTotal(F.D.byEntry[l.e]); });
        var list = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.v - a.v; });
        var cols = [C('name', 'نوع القيد'), C('n', 'عدد القيود', 'int'), C('v', 'المبلغ', 'money')];
        return { cols: cols, rows: list, total: sumRow(list, cols), chart: { type: 'hbar', x: 'name', y: ['v'], yl: ['المبلغ'] } };
      } };
    R.statement = { cat: 'acct', name: 'كشف حساب', desc: 'حركة عميل أو مورد أو أي حساب برصيد افتتاحي وتراكمي', params: ['period', 'account'],
      run: function (p) { if (!p.account) return { cols: [C('m', '')], rows: [], empty: 'اختر الحساب من الأعلى' }; return statement(descend(p.account), p, 'كشف حساب: ' + accName(p.account)); } };
    // حسابات بطاقة يدوية (رموز من الدليل) ← أسماؤها للعنوان
    function accsTitle(codes) { var n = codes.map(function (c) { var a = F.D.byCode[c]; return a ? a.name : c; }); return n.length > 3 ? n.slice(0, 3).join('، ') + ' و' + (n.length - 3) + ' أخرى' : n.join('، '); }
    R.ledger = { cat: 'acct', name: 'دفتر الأستاذ', desc: 'القيود على حساب رئيسي وكل فروعه مع اسم الحساب الفرعي', params: ['period', 'account'],
      run: function (p) {
        if (!p.account && p.accs && p.accs.length) {   // من بطاقة: حركات كل حساباتها معاً
          var ids = byCodes(p.accs.join(','));
          var rs = statement(ids, p, 'حركات الحساب: ' + accsTitle(p.accs));
          rs.cols.splice(4, 0, C('sub', 'الحساب'));
          rs.rows.forEach(function (r) { r.sub = r._acc ? accName(r._acc) : (ids.length === 1 && r.d ? accName(ids[0]) : ''); });
          return rs;
        }
        if (!p.account) return { cols: [C('m', '')], rows: [], empty: 'اختر الحساب الرئيسي من الأعلى' };
        var res = statement(descend(p.account), p, 'دفتر الأستاذ: ' + accName(p.account));
        res.cols.splice(4, 0, C('sub', 'الحساب الفرعي'));
        res.rows.forEach(function (r) { r.sub = r._acc ? accName(r._acc) : ''; });
        return res;
      } };
    function trialRows(p, lvl, mode) {
      var rows = [];
      F.D.accList.forEach(function (a) {
        if (!(a.lvl === lvl || (a.leaf && a.lvl < lvl))) return;
        var b = balance(descend(a.id), p.from, p.to);
        if (!b.open && !b.dr && !b.cr) return;
        rows.push({ code: a.code, name: a.name, odr: b.open > 0 ? b.open : 0, ocr: b.open < 0 ? -b.open : 0, dr: b.dr, cr: b.cr, cdr: b.close > 0 ? b.close : 0, ccr: b.close < 0 ? -b.close : 0, _acc: a.id });
      });
      return rows;
    }
    R.trial = { cat: 'acct', name: 'ميزان المراجعة بالمجاميع والأرصدة', desc: 'الأرصدة الافتتاحية والحركة والأرصدة الختامية حسب المستوى', params: ['period', 'level'],
      run: function (p) {
        var rows = trialRows(p, Number(p.level || 3));
        var cols = [C('code', 'الرمز'), C('name', 'الحساب'), C('odr', 'أول المدة مدين', 'money'), C('ocr', 'أول المدة دائن', 'money'), C('dr', 'الحركة مدين', 'money'), C('cr', 'الحركة دائن', 'money'), C('cdr', 'الرصيد مدين', 'money'), C('ccr', 'الرصيد دائن', 'money')];
        var tot = sumRow(rows, cols);
        return { cols: cols, rows: rows, total: tot, note: Math.abs(tot.dr - tot.cr) < 0.01 ? 'الميزان متوازن: إجمالي الحركة المدينة = الدائنة' : 'تنبيه: الميزان غير متوازن بفرق ' + fm(tot.dr - tot.cr) };
      } };
    R.trial_bal = { cat: 'acct', name: 'ميزان المراجعة بالأرصدة', desc: 'الرصيد المدين أو الدائن لكل حساب من تاريخ إلى تاريخ: الرصيد التراكمي في نهاية الفترة، أو صافي حركة الفترة فقط', params: ['asof', 'level'],
      sel: [['tbm', 'الأرصدة', [['close', 'الرصيد في نهاية الفترة (تراكمي)'], ['move', 'صافي حركة الفترة فقط (بدون أول المدة)']]]],
      run: function (p) {
        var mv = p.tbm === 'move', from = p.from || p.asof;
        var rows = trialRows({ from: from, to: p.asof }, Number(p.level || 4)).map(function (r) {
          var net = mv ? r.dr - r.cr : r.cdr - r.ccr;
          return { code: r.code, name: r.name, cdr: net > 0 ? net : 0, ccr: net < 0 ? -net : 0, _acc: r._acc };
        }).filter(function (r) { return r.cdr > 0.0005 || r.ccr > 0.0005; });
        var cols = [C('code', 'الرمز'), C('name', 'الحساب'), C('cdr', 'مدين', 'money'), C('ccr', 'دائن', 'money')];
        return { cols: cols, rows: rows, total: sumRow(rows, cols), subtitle: mv ? 'صافي حركة الفترة من ' + from + ' إلى ' + p.asof : 'الأرصدة في ' + p.asof };
      } };
    R.coa = { cat: 'acct', name: 'دليل الحسابات بالأرصدة', desc: 'شجرة الحسابات كاملة مع رصيد كل حساب', params: ['asof', 'level'],
      run: function (p) {
        var lvl = Number(p.level || 6), rows = [];
        F.D.accList.forEach(function (a) { if (a.lvl > lvl) return; var b = balance(descend(a.id), p.from || null, p.asof); rows.push({ code: a.code, name: a.name, lvl: a.lvl, kind: a.leaf ? 'فرعي' : 'رئيسي', open: b.open, dr: b.dr, cr: b.cr, bal: b.close, _lvl: a.lvl - 1, _b: a.lvl === 1, _acc: a.id }); });
        return { cols: [C('code', 'الرمز'), C('name', 'الحساب'), C('kind', 'النوع'), C('open', 'أول المدة', 'money'), C('dr', 'مدين الفترة', 'money'), C('cr', 'دائن الفترة', 'money'), C('bal', 'الرصيد (مدين +)', 'money')], rows: rows };
      } };
    function accMonthly(p, rootFilter, label, sign, anyLevel) {
      var months = [], m = p.from.slice(0, 7);
      while (m <= p.to.slice(0, 7)) { months.push(m); m = addD(monthEnd(m), 1).slice(0, 7); }
      var lvl = Number(p.level || 3), rows = [];
      F.D.accList.filter(function (a) { return rootFilter(a) && (anyLevel || a.lvl === lvl || (a.leaf && a.lvl < lvl)); }).forEach(function (a) {
        var ids = descend(a.id), r = { code: a.code, name: a.name, tot: 0, _acc: a.id };
        months.forEach(function (mm) { var x = mm + '-01' < p.from ? p.from : mm + '-01', y = monthEnd(mm) > p.to ? p.to : monthEnd(mm), b = balance(ids, x, y); r['m' + mm] = sign * (b.dr - b.cr); r.tot += r['m' + mm]; });
        if (Math.abs(r.tot) > 0.0005) rows.push(r);
      });
      rows.sort(function (a, b) { return Math.abs(b.tot) - Math.abs(a.tot); });
      var cols = [C('code', 'الرمز'), C('name', label)].concat(months.map(function (mm) { return C('m' + mm, MONTHS[+mm.slice(5, 7) - 1], 'money'); }), [C('tot', 'الإجمالي', 'money')]);
      return { cols: cols, rows: rows, total: sumRow(rows, cols) };
    }
    R.expenses = { cat: 'acct', name: 'تحليل المصروفات شهرياً', desc: 'حسابات الاستخدامات (3) لكل شهر', params: ['period', 'level'], run: function (p) { return accMonthly(p, function (a) { return a.rootCode === '3'; }, 'المصروف', 1); } };
    R.revenues = { cat: 'acct', name: 'تحليل الإيرادات شهرياً', desc: 'حسابات الموارد (4) لكل شهر', params: ['period', 'level'], run: function (p) { return accMonthly(p, function (a) { return a.rootCode === '4'; }, 'الإيراد', -1); } };
    R.acc_monthly = { cat: 'acct', name: 'حركة حساب شهرياً', desc: 'حركة حساب رئيسي وفروعه لكل شهر', params: ['period', 'account', 'level'],
      run: function (p) {
        if (!p.account) return { cols: [C('m', '')], rows: [], empty: 'اختر الحساب من الأعلى' };
        var a0 = acc(p.account), kids = {}; (a0.kids.length ? a0.kids : [a0.id]).forEach(function (x) { kids[x] = 1; });
        var res = accMonthly(Object.assign({}, p, { level: 99 }), function (a) { return kids[a.id]; }, 'الحساب', 1, true);
        res.note = 'حركة (مدين − دائن) لكل فرع مباشر تحت ' + a0.name;
        return res;
      } };

    /* ---------- المبيعات ---------- */
    R.sales_trend = { cat: 'sales', name: 'المبيعات اليومية والأسبوعية والشهرية', desc: 'المبيعات والمرتجعات والكمية والربح لكل فترة', params: ['period', 'gran', 'flt'],
      run: function (p) {
        var g = p.gran || 'day', list = salesBy(p, function (x) { return bucket(x.d, g); }, function (x, k) { return bucketLabel(k, g); }).sort(function (a, b) { return a.k < b.k ? -1 : 1; });
        var cols = [C('name', g === 'day' ? 'اليوم' : g === 'week' ? 'الأسبوع' : 'الشهر')].concat(SALES_COLS, [C('avgp', 'متوسط السعر', 'money')]);
        return withNote({ cols: cols, rows: list, total: sumRow(list, cols), chart: { type: 'bar', x: 'name', y: ['net', 'profit'], yl: ['صافي المبيعات', 'مجمل الربح'] } }, p);
      } };
    R.sales_cust = { cat: 'sales', name: 'المبيعات حسب العميل', desc: 'صافي المبيعات والكمية والربح لكل عميل', params: ['period', 'top', 'flt'],
      run: function (p) { return salesTable(p, 'العميل', function (x) { return x.v.ck; }, function (x) { return x.v.name; }, [C('rp', 'نسبة المرتجع', 'pct')]); } };
    R.sales_item = { cat: 'sales', name: 'المبيعات حسب الصنف وربحيته', desc: 'الكميات والقيم والتكلفة والربح ومتوسط السعر لكل صنف', params: ['period', 'top', 'flt'],
      run: function (p) {
        var list = salesBy(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }).sort(function (a, b) { return b.net - a.net; });
        list.forEach(function (r) { r.unit = (T().item[r.k] || {}).mu || ''; });
        var cols = [C('name', 'الصنف'), C('qty', 'صافي الكمية', 'qty'), C('unit', 'الوحدة'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('net', 'الصافي', 'money'),
          C('cost', 'التكلفة', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('avgp', 'متوسط السعر', 'money'), C('share', 'الحصة', 'pct')];
        return withNote(topN({ cols: cols, rows: list, total: sumRow(list, cols), chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], limit: 12 } }, p), p);
      } };
    R.sales_store = { cat: 'sales', name: 'المبيعات حسب المخزن', desc: 'توزيع المبيعات على المخازن', params: ['period', 'flt'], run: function (p) { return salesTable(p, 'المخزن', function (x) { return x.l.st; }, function (x) { return storeName(x.l.st); }); } };
    R.sales_rep = { cat: 'sales', name: 'المبيعات حسب المندوب', desc: 'توزيع المبيعات على المناديب', params: ['period', 'flt'], run: function (p) { return salesTable(p, 'المندوب', function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag); }); } };
    R.sales_user = { cat: 'sales', name: 'المبيعات حسب المستخدم', desc: 'من أدخل فواتير المبيع في سراج', params: ['period', 'flt'], run: function (p) { return salesTable(p, 'المستخدم', function (x) { return x.v.u || '0'; }, function (x) { return userName(x.v.u); }); } };
    R.sales_dow = { cat: 'sales', name: 'المبيعات حسب أيام الأسبوع', desc: 'أي أيام الأسبوع أعلى مبيعاً', params: ['period', 'flt'],
      run: function (p) {
        var list = salesBy(p, function (x) { return new Date(d2t(x.d)).getUTCDay(); }, function (x, k) { return DOW[k]; }).sort(function (a, b) { return ((a.k + 1) % 7) - ((b.k + 1) % 7); });
        var cols = [C('name', 'اليوم')].concat(SALES_COLS);
        return withNote({ cols: cols, rows: list, total: sumRow(list, cols), chart: { type: 'bar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] } }, p);
      } };
    R.sales_lines = { cat: 'sales', name: 'تفاصيل المبيعات (أصناف الفواتير)', desc: 'كل سطر: التاريخ والفاتورة والعميل والصنف والكمية والسعر والقيمة', params: ['period', 'flt', 'search'],
      run: function (p) {
        var s = String(p.search || '').trim();
        var rows = facts('s', p.from, p.to, p.flt).filter(function (x) { return !s || (x.v.no + ' ' + x.v.name + ' ' + itemName(x.l.item)).indexOf(s) >= 0; }).sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : 1; })
          .map(function (x) { return { d: x.d, no: x.v.no, type: x.s > 0 ? 'مبيع' : 'مرتجع', name: x.v.name, item: itemName(x.l.item), unit: x.l.un || '', q: x.s * x.l.q, g: x.s * x.l.g, p: x.l.p, val: x.s * x.val, profit: x.s * x.profit, st: storeName(x.l.st) }; });
        var cols = [C('d', 'التاريخ'), C('no', 'الفاتورة'), C('type', 'النوع'), C('name', 'العميل'), C('item', 'الصنف'), C('unit', 'الوحدة'), C('q', 'الكمية', 'qty'), C('g', 'هدايا', 'qty'), C('p', 'السعر', 'money'), C('val', 'القيمة', 'money'), C('profit', 'الربح', 'money'), C('st', 'المخزن')];
        return withNote({ cols: cols, rows: rows, total: sumRow(rows, [C('val', '', 'money'), C('profit', '', 'money')]) }, p);
      } };
    R.sales_invoices = { cat: 'sales', name: 'سجل فواتير المبيع والمرتجع', desc: 'كل فاتورة برقمها وعميلها وقيمتها وربحها', params: ['period', 'flt', 'search'],
      run: function (p) {
        var s = String(p.search || '').trim(), g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { var r = g[x.v.id] || (g[x.v.id] = { v: x.v, s: x.s, qty: 0, val: 0, profit: 0 }); r.qty += x.qty; r.val += x.val; r.profit += x.profit; });
        var rows = Object.keys(g).map(function (k) { return g[k]; }).filter(function (r) { return !s || (r.v.no + ' ' + r.v.name + ' ' + (r.v.note || '')).indexOf(s) >= 0; }).sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : 1; })
          .map(function (r) { return { d: r.v.d, no: r.v.no, type: r.s > 0 ? 'مبيع' : 'مرتجع', name: r.v.name, st: storeName(r.v.st), u: userName(r.v.u), qty: r.s * r.qty, net: r.s * r.val, profit: r.s * r.profit, margin: pct(r.profit, r.val), note: r.v.note || '', _acc: acc(r.v.acc) ? r.v.acc : null }; });
        var cols = [C('d', 'التاريخ'), C('no', 'الرقم'), C('type', 'النوع'), C('name', 'العميل'), C('st', 'المخزن'), C('u', 'المستخدم'), C('qty', 'الكمية', 'qty'), C('net', 'الصافي', 'money'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('note', 'البيان')];
        return withNote({ cols: cols, rows: rows, total: sumRow(rows, [C('qty', '', 'qty'), C('net', '', 'money'), C('profit', '', 'money')]) }, p);
      } };
    R.sales_cust_month = { cat: 'sales', name: 'مبيعات العملاء شهرياً (جدول محوري)', desc: 'صافي مبيعات كل عميل في كل شهر', params: ['period', 'top', 'flt'],
      run: function (p) { return pivot(p, function (x) { return x.v.ck; }, function (k) { return custName(k); }, function (x) { return x.d.slice(0, 7); }, function (k) { return MONTHS[+k.slice(5, 7) - 1]; }, function (x) { return x.s * x.val; }, 'العميل'); } };
    R.sales_item_month = { cat: 'sales', name: 'مبيعات الأصناف شهرياً (جدول محوري)', desc: 'صافي مبيعات كل صنف في كل شهر', params: ['period', 'top', 'measure', 'flt'],
      run: function (p) { var qm = p.measure === 'qty'; return pivot(p, function (x) { return x.l.item; }, itemName, function (x) { return x.d.slice(0, 7); }, function (k) { return MONTHS[+k.slice(5, 7) - 1]; }, function (x) { return x.s * (qm ? x.qty : x.val); }, 'الصنف'); } };
    R.sales_item_cust = { cat: 'sales', name: 'الأصناف لكل عميل', desc: 'ما اشتراه كل عميل من كل صنف (كمية وقيمة)', params: ['period', 'flt', 'top'],
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { var k = x.v.ck + '|' + x.l.item, r = g[k] || (g[k] = { cust: x.v.name, item: itemName(x.l.item), qty: 0, val: 0, profit: 0 }); r.qty += x.s * x.qty; r.val += x.s * x.val; r.profit += x.s * x.profit; });
        var rows = Object.keys(g).map(function (k) { var r = g[k]; r.avgp = r.qty ? r.val / r.qty : 0; return r; }).sort(function (a, b) { return a.cust === b.cust ? b.val - a.val : a.cust < b.cust ? -1 : 1; });
        var cols = [C('cust', 'العميل'), C('item', 'الصنف'), C('qty', 'صافي الكمية', 'qty'), C('val', 'صافي القيمة', 'money'), C('avgp', 'متوسط السعر', 'money'), C('profit', 'الربح', 'money')];
        return withNote(topN({ cols: cols, rows: rows, total: sumRow(rows, cols) }, p), p);
      } };
    R.price_analysis = { cat: 'sales', name: 'تحليل أسعار البيع', desc: 'أقل وأعلى ومتوسط سعر بيع لكل صنف ووحدة', params: ['period', 'flt'],
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          if (x.s < 0 || !x.l.q || !x.l.p) return;
          var k = x.l.item + '|' + (x.l.un || ''), r = g[k] || (g[k] = { item: itemName(x.l.item), unit: x.l.un || '', min: Infinity, max: 0, q: 0, v: 0, n: 0 });
          r.min = Math.min(r.min, x.l.p); r.max = Math.max(r.max, x.l.p); r.q += x.l.q; r.v += x.val; r.n++;
        });
        var rows = Object.keys(g).map(function (k) { var r = g[k]; r.avg = r.q ? r.v / r.q : 0; r.spread = pct(r.max - r.min, r.min); return r; }).sort(function (a, b) { return b.v - a.v; });
        return withNote({ cols: [C('item', 'الصنف'), C('unit', 'الوحدة'), C('n', 'عدد الأسطر', 'int'), C('min', 'أقل سعر', 'money'), C('avg', 'متوسط السعر', 'money'), C('max', 'أعلى سعر', 'money'), C('spread', 'الفرق', 'pct'), C('q', 'الكمية', 'qty')], rows: rows }, p);
      } };
    R.sales_returns = { cat: 'sales', name: 'مرتجعات المبيعات', desc: 'المرتجعات حسب العميل أو الصنف ونسبتها من المبيعات', params: ['period', 'rby', 'flt'],
      run: function (p) {
        var byItem = p.rby === 'item';
        var list = salesBy(p, function (x) { return byItem ? x.l.item : x.v.ck; }, function (x) { return byItem ? itemName(x.l.item) : x.v.name; }).filter(function (r) { return r.ret; }).sort(function (a, b) { return b.ret - a.ret; });
        var cols = [C('name', byItem ? 'الصنف' : 'العميل'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('rp', 'نسبة المرتجع', 'pct')];
        var tot = sumRow(list, cols); tot.rp = pct(tot.ret, tot.sales);
        return withNote({ cols: cols, rows: list, total: tot, chart: { type: 'hbar', x: 'name', y: ['ret'], yl: ['المرتجعات'], limit: 12 } }, p);
      } };
    R.gifts = { cat: 'sales', name: 'الهدايا والعروض', desc: 'كميات الهدايا الممنوحة لكل صنف وعميل', params: ['period', 'flt'],
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { if (!x.gift) return; var k = x.v.ck + '|' + x.l.item, r = g[k] || (g[k] = { cust: x.v.name, item: itemName(x.l.item), g: 0, q: 0 }); r.g += x.s * x.gift; r.q += x.s * x.l.q; });
        var rows = Object.keys(g).map(function (k) { var r = g[k]; r.ratio = pct(r.g, r.q); return r; }).sort(function (a, b) { return b.g - a.g; });
        return withNote({ cols: [C('cust', 'العميل'), C('item', 'الصنف'), C('q', 'الكمية المباعة', 'qty'), C('g', 'الهدايا', 'qty'), C('ratio', 'نسبة الهدايا', 'pct')], rows: rows, total: sumRow(rows, [C('q', '', 'qty'), C('g', '', 'qty')]) }, p);
      } };
    function compareTable(p, keyFn, labelFn, label) {
      var pr = prevRange(p.from, p.to, p.preset), a = {}, b = {};
      salesBy(p, keyFn, labelFn).forEach(function (r) { a[r.k] = r; });
      salesBy({ from: pr[0], to: pr[1], flt: p.flt }, keyFn, labelFn).forEach(function (r) { b[r.k] = r; });
      var rows = uniq(Object.keys(a).concat(Object.keys(b))).map(function (k) { var x = a[k] || {}, y = b[k] || {}, n = x.net || 0, o = y.net || 0; return { name: x.name || y.name, cur: n, prev: o, diff: n - o, ch: o ? (n - o) / Math.abs(o) * 100 : null, qc: x.qty || 0, qp: y.qty || 0 }; })
        .sort(function (x, y) { return y.cur - x.cur; });
      var cols = [C('name', label), C('cur', 'الفترة الحالية', 'money'), C('prev', 'الفترة السابقة', 'money'), C('diff', 'الفرق', 'money'), C('ch', 'التغيّر', 'pct'), C('qc', 'الكمية الحالية', 'qty'), C('qp', 'الكمية السابقة', 'qty')];
      var t = sumRow(rows, cols); t.ch = t.prev ? (t.cur - t.prev) / Math.abs(t.prev) * 100 : null;
      return withNote(topN({ cols: cols, rows: rows, total: t, note: 'الفترة السابقة: ' + perLabel(pr[0], pr[1]) }, p), p);
    }
    R.cust_compare = { cat: 'cust', name: 'مقارنة مبيعات العملاء بالفترة السابقة', desc: 'النمو والتراجع لكل عميل', params: ['period', 'top', 'flt'], run: function (p) { return compareTable(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }, 'العميل'); } };
    R.item_compare = { cat: 'sales', name: 'مقارنة مبيعات الأصناف بالفترة السابقة', desc: 'النمو والتراجع لكل صنف', params: ['period', 'top', 'flt'], run: function (p) { return compareTable(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }, 'الصنف'); } };

    /* ---------- العملاء ---------- */
    function custFirstLast(flt) {
      if (flt) { var m2 = {}; facts('s', '0000', '9999', flt).forEach(function (x) { if (x.s < 0) return; var v = x.v, r = m2[v.ck] || (m2[v.ck] = { first: v.d, last: v.d, name: v.name }); if (v.d < r.first) r.first = v.d; if (v.d > r.last) r.last = v.d; }); return m2; }
      if (F.cache.cfl) return F.cache.cfl;
      var m = {};
      F.D.invs.forEach(function (v) { if (v.c !== SALE) return; var r = m[v.ck] || (m[v.ck] = { first: v.d, last: v.d, name: v.name }); if (v.d < r.first) r.first = v.d; if (v.d > r.last) r.last = v.d; });
      return (F.cache.cfl = m);
    }
    R.new_customers = { cat: 'cust', name: 'العملاء الجدد', desc: 'العملاء الذين كانت أول فاتورة لهم في الفترة', params: ['period', 'flt'], fdims: ['cust', 'item', 'st', 'ag', 'xcust'],
      run: function (p) {
        var m = custFirstLast(), s = {}, ok = custKeys(p.flt);
        salesBy(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }).forEach(function (r) { s[r.k] = r; });
        var rows = Object.keys(m).filter(function (k) { return m[k].first >= p.from && m[k].first <= p.to && (!ok || ok[k]) && (!hasItemF(p.flt) || s[k]); }).map(function (k) { var r = s[k] || {}; return { name: m[k].name, first: m[k].first, n: r.n || 0, net: r.net || 0, debt: acc(k) ? balance([k], null, p.to).close : '', _acc: acc(k) ? k : null }; }).sort(function (a, b) { return a.first < b.first ? -1 : 1; });
        return withNote({ cols: [C('name', 'العميل'), C('first', 'أول فاتورة'), C('n', 'الفواتير', 'int'), C('net', 'صافي المبيعات', 'money'), C('debt', 'الرصيد', 'money')], rows: rows, total: sumRow(rows, [C('n', '', 'int'), C('net', '', 'money')]) }, p);
      } };
    R.dormant = { cat: 'cust', name: 'العملاء المتوقفون عن الشراء', desc: 'عملاء لم يشتروا منذ عدد أيام (أو لم يشتروا صنفاً محدداً)، مع رصيدهم', params: ['asof', 'idle', 'flt'], fdims: ['cust', 'item', 'st', 'ag', 'xcust'],
      run: function (p) {
        var m = hasItemF(p.flt) ? custFirstLast(p.flt) : custFirstLast(), n = Number(p.idle || 30), rows = [], ok = custKeys(p.flt);
        Object.keys(m).forEach(function (k) { if (ok && !ok[k]) return; var r = m[k], last = r.last <= p.asof ? r.last : null; if (!last) return; var age = days(last, p.asof); if (age < n) return; rows.push({ name: r.name, last: last, age: age, debt: acc(k) ? balance([k], null, p.asof).close : '', _acc: acc(k) ? k : null }); });
        rows.sort(function (a, b) { return b.age - a.age; });
        return withNote({ cols: [C('name', 'العميل'), C('last', 'آخر فاتورة'), C('age', 'أيام بلا شراء', 'int'), C('debt', 'الرصيد', 'money')], rows: rows, total: sumRow(rows, [C('debt', '', 'money')]), note: 'آخر شراء' + (hasItemF(p.flt) ? ' للأصناف المحددة' : '') + ' قبل ' + n + ' يوماً أو أكثر' }, p);
      } };
    R.cust_profile = { cat: 'cust', name: 'ملف العملاء الشامل', desc: 'لكل عميل: المبيعات والتحصيل والرصيد وآخر شراء ومتوسط الشراء الشهري', params: ['period', 'top', 'flt'], fdims: ['cust', 'item', 'st', 'ag', 'xcust', 'xitem'],
      run: function (p) {
        var m = custFirstLast(), coll = collections(p.from, p.to, '', true), s = {}, months = Math.max(1, days(p.from, p.to) / 30.4);
        salesBy(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }).forEach(function (r) { s[r.k] = r; });
        var rows = recvFor(p.flt).filter(function (k) { return !hasItemF(p.flt) || s[k]; }).map(function (k) { var r = s[k] || {}, b = balance([k], null, p.to).close; return { name: accName(k), net: r.net || 0, n: r.n || 0, avgm: (r.net || 0) / months, coll: coll[k] || 0, cr: pct(coll[k] || 0, r.net || 0), bal: b, last: (m[k] || {}).last || '', lim: custLimit(k) || '', _acc: k }; })
          .filter(function (r) { return r.net || r.coll || Math.abs(r.bal) > 0.0005; }).sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'العميل'), C('n', 'الفواتير', 'int'), C('net', 'صافي المبيعات', 'money'), C('avgm', 'متوسط شهري', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'نسبة التحصيل', 'pct'), C('bal', 'الرصيد', 'money'), C('lim', 'حد الائتمان', 'money'), C('last', 'آخر شراء')];
        return withNote(topN({ cols: cols, rows: rows, total: sumRow(rows, cols) }, p), p);
      } };

    /* ---------- المديونيات والتحصيل ---------- */
    function custLimit(accId) { var cu = T().cu, lim = 0; Object.keys(cu).forEach(function (k) { if (String(cu[k].acc) === String(accId)) lim = Number(cu[k].lim) || 0; }); return lim; }
    function lastMove(id, asof) { var ls = F.D.byAcc[id] || [], d = ''; ls.forEach(function (l) { if (l.d <= asof) d = l.d; }); return d; }
    function lastCredit(id, asof) { var ls = F.D.byAcc[id] || [], d = ''; ls.forEach(function (l) { if (l.d <= asof && l.cr) d = l.d; }); return d; }
    function partyBalances(ids, p, sign, label) {
      var rows = [];
      ids.forEach(function (id) {
        var b = balance([id], p.from || null, p.asof), v = sign * b.close;
        if (p.nonzero !== 'all' && Math.abs(v) < 0.0005 && !(p.nonzero === 'mv' && (b.dr || b.cr))) return;
        if (p.nonzero === 'mv' && !b.dr && !b.cr) return;
        var lim = sign > 0 ? custLimit(id) : 0;
        rows.push({ code: acc(id).code, name: accName(id), open: sign * b.open, inc: sign > 0 ? b.dr : b.cr, dec: sign > 0 ? b.cr : b.dr, v: v, last: lastMove(id, p.asof), lastCr: sign > 0 ? lastCredit(id, p.asof) : '', lim: lim || '', over: lim && v > lim ? 'تجاوز الحد' : '', _acc: id });
      });
      rows.sort(function (a, b) { return b.v - a.v; });
      var cols = [C('code', 'الرمز'), C('name', label), C('open', 'رصيد أول المدة', 'money'), C('inc', sign > 0 ? 'الزيادة (مدين)' : 'الزيادة (دائن)', 'money'), C('dec', sign > 0 ? 'التحصيل والخصم (دائن)' : 'السداد (مدين)', 'money'), C('v', 'الرصيد في نهاية الفترة', 'money'), C('last', 'آخر حركة')];
      if (sign > 0) cols.push(C('lastCr', 'آخر تحصيل'), C('lim', 'حد الائتمان', 'money'), C('over', 'تنبيه'));
      return { cols: cols, rows: rows, total: sumRow(rows, [C('open', '', 'money'), C('inc', '', 'money'), C('dec', '', 'money'), C('v', '', 'money')]), chart: { type: 'hbar', x: 'name', y: ['v'], yl: ['الرصيد'], limit: 12 }, note: 'مجموعة الحسابات تُضبط من «الصناديق والإعدادات»' };
    }
    R.recv_balances = { cat: 'debts', name: 'أرصدة العملاء (المديونيات)', desc: 'ما على كل عميل في تاريخ محدد مع آخر حركة وآخر تحصيل', params: ['asof', 'nonzero', 'flt'], fdims: ['cust', 'xcust'], run: function (p) { return withNote(partyBalances(recvFor(p.flt), p, 1, 'العميل'), p); } };
    R.pay_balances = { cat: 'debts', name: 'أرصدة الموردين', desc: 'ما للموردين على الشركة في تاريخ محدد', params: ['asof', 'nonzero', 'flt'], fdims: ['supp'], run: function (p) { return withNote(partyBalances(partyFilter(payIds(), p.flt), p, -1, 'المورد'), p); } };
    function aging(ids, asof, sign) {
      var B = [[0, 30, 'b1', '0-30 يوماً'], [31, 60, 'b2', '31-60'], [61, 90, 'b3', '61-90'], [91, 120, 'b4', '91-120'], [121, 1e9, 'b5', 'أكثر من 120']], rows = [];
      ids.forEach(function (id) {
        var ls = (F.D.byAcc[id] || []).filter(function (l) { return l.d <= asof; }), debts = [], credit = 0;
        ls.forEach(function (l) { var inc = sign > 0 ? l.dr : l.cr, dec = sign > 0 ? l.cr : l.dr; if (inc) debts.push({ d: l.d, v: inc }); credit += dec; });
        debts.forEach(function (x) { var u = Math.min(x.v, credit); x.v -= u; credit -= u; });
        var r = { code: acc(id).code, name: accName(id), tot: 0, _acc: id };
        B.forEach(function (b) { r[b[2]] = 0; });
        debts.forEach(function (x) { if (x.v < 0.0005) return; var age = days(x.d, asof); B.forEach(function (b) { if (age >= b[0] && age <= b[1]) r[b[2]] += x.v; }); r.tot += x.v; });
        if (credit > 0.0005) r.adv = credit;
        if (r.tot > 0.0005 || r.adv) rows.push(r);
      });
      rows.sort(function (a, b) { return b.tot - a.tot; });
      var cols = [C('code', 'الرمز'), C('name', sign > 0 ? 'العميل' : 'المورد'), C('tot', 'الإجمالي', 'money')].concat(B.map(function (b) { return C(b[2], b[3], 'money'); }), [C('adv', 'رصيد معاكس (مقدّم)', 'money')]);
      return { cols: cols, rows: rows, total: sumRow(rows, cols) };
    }
    R.recv_aging = { cat: 'debts', name: 'أعمار ديون العملاء', desc: 'توزيع مديونية كل عميل حسب عمرها (يُخصم التحصيل من أقدم دين)', params: ['asof', 'flt'], fdims: ['cust', 'xcust'], run: function (p) { return withNote(aging(recvFor(p.flt), p.asof, 1), p); } };
    R.pay_aging = { cat: 'debts', name: 'أعمار أرصدة الموردين', desc: 'توزيع ما للموردين حسب عمره', params: ['asof', 'flt'], fdims: ['supp'], run: function (p) { return withNote(aging(partyFilter(payIds(), p.flt), p.asof, -1), p); } };
    R.debt_movement = { cat: 'debts', name: 'حركة المديونيات اليومية والأسبوعية والشهرية', desc: 'رصيد أول المدة والزيادة والتحصيل ورصيد آخر المدة للعملاء', params: ['period', 'gran', 'flt'], fdims: ['cust', 'xcust'],
      run: function (p) {
        var g = p.gran || 'day', ids = recvFor(p.flt), set = {};
        ids.forEach(function (i) { set[i] = 1; });
        var open = balance(ids, p.from, p.to).open, buckets = {};
        T().jl.forEach(function (l) {
          if (!set[l.a] || l.d < p.from || l.d > p.to) return;
          var k = bucket(l.d, g), b = buckets[k] || (buckets[k] = { k: k, inc: 0, dec: 0, rec: 0 });
          b.inc += l.dr; b.dec += l.cr; if (l.k === 'r') b.rec += l.cr;
        });
        var keys = Object.keys(buckets).sort(), bal = open, rows = [];
        keys.forEach(function (k) { var b = buckets[k]; rows.push({ name: bucketLabel(k, g), open: bal, inc: b.inc, dec: b.dec, rec: b.rec, close: bal + b.inc - b.dec }); bal += b.inc - b.dec; });
        var cols = [C('name', g === 'day' ? 'اليوم' : g === 'week' ? 'الأسبوع' : 'الشهر'), C('open', 'رصيد أول المدة', 'money'), C('inc', 'زيادة (مبيعات آجلة وغيرها)', 'money'),
          C('dec', 'نقص (تحصيل ومرتجعات وتسويات)', 'money'), C('rec', 'منها سندات قبض', 'money'), C('close', 'رصيد آخر المدة', 'money')];
        var tot = sumRow(rows, [C('inc', '', 'money'), C('dec', '', 'money'), C('rec', '', 'money')]); tot.open = open; tot.close = bal;
        return withNote({ cols: cols, rows: rows, total: tot, chart: { type: 'line', x: 'name', y: ['close'], yl: ['رصيد المديونية'] } }, p);
      } };
    R.collections_cust = { cat: 'debts', name: 'التحصيل حسب العميل', desc: 'المحصّل من كل عميل نقداً وتحويلاً ونسبته من مبيعاته', params: ['period', 'top', 'flt'], fdims: ['cust', 'xcust', 'ag'],
      run: function (p) {
        var rv = recvFor(p.flt), cash = collections(p.from, p.to, 'صندوق', true, rv), bank = collections(p.from, p.to, 'بنك', true, rv), all = collections(p.from, p.to, '', true, rv), s = {};
        salesBy(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }).forEach(function (r) { s[r.k] = r; });
        var rows = uniq(Object.keys(all).concat(Object.keys(s))).map(function (k) { var tot = all[k] || 0, sl = (s[k] || {}).net || 0; return { name: custName(k), cash: cash[k] || 0, bank: bank[k] || 0, tot: tot, sales: sl, cr: pct(tot, sl), bal: acc(k) ? balance([k], null, p.to).close : '', _acc: acc(k) ? k : null }; })
          .filter(function (r) { return r.tot || r.sales; }).sort(function (a, b) { return b.tot - a.tot; });
        var cols = [C('name', 'العميل'), C('cash', 'نقداً (صناديق)', 'money'), C('bank', 'تحويل (بنوك)', 'money'), C('tot', 'إجمالي التحصيل', 'money'), C('sales', 'صافي المبيعات', 'money'), C('cr', 'نسبة التحصيل', 'pct'), C('bal', 'الرصيد', 'money')];
        var t = sumRow(rows, cols); t.cr = pct(t.tot, t.sales);
        return withNote(topN({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['tot'], yl: ['التحصيل'], limit: 12 }, note: activeBoxes().length ? '' : 'عرّف الصناديق والبنوك ليُفصل النقدي عن التحويل' }, p), p);
      } };
    R.collections_daily = { cat: 'debts', name: 'التحصيل اليومي والشهري', desc: 'التحصيل نقداً وتحويلاً لكل يوم أو شهر مع المبيعات', params: ['period', 'gran', 'flt'], fdims: ['cust', 'xcust', 'ag'],
      run: function (p) {
        var g = p.gran || 'day', rows = [], b = {}, rv = recvFor(p.flt);
        var add = function (map, f) { Object.keys(map).forEach(function (d) { var k = bucket(d, g), r = b[k] || (b[k] = { k: k, cash: 0, bank: 0, tot: 0, sales: 0 }); r[f] += map[d]; }); };
        add(collections(p.from, p.to, 'صندوق', 'day', rv), 'cash'); add(collections(p.from, p.to, 'بنك', 'day', rv), 'bank'); add(collections(p.from, p.to, '', 'day', rv), 'tot');
        var sd = {}; facts('s', p.from, p.to, p.flt).forEach(function (x) { sd[x.d] = (sd[x.d] || 0) + x.s * x.val; }); add(sd, 'sales');
        Object.keys(b).sort().forEach(function (k) { var r = b[k]; rows.push({ name: bucketLabel(k, g), cash: r.cash, bank: r.bank, tot: r.tot, sales: r.sales, cr: pct(r.tot, r.sales) }); });
        var cols = [C('name', 'الفترة'), C('cash', 'نقداً', 'money'), C('bank', 'تحويل', 'money'), C('tot', 'الإجمالي', 'money'), C('sales', 'صافي المبيعات', 'money'), C('cr', 'نسبة التحصيل', 'pct')];
        var t = sumRow(rows, cols); t.cr = pct(t.tot, t.sales);
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['tot', 'sales'], yl: ['التحصيل', 'المبيعات'] } }, p);
      } };
    R.credit_limit = { cat: 'debts', name: 'العملاء المتجاوزون لحد الائتمان', desc: 'من تجاوز رصيده حد الائتمان المحدد في سراج', params: ['asof', 'flt'], fdims: ['cust', 'xcust'],
      run: function (p) {
        var rows = recvFor(p.flt).map(function (k) { var lim = custLimit(k), b = balance([k], null, p.asof).close; return { name: accName(k), lim: lim, bal: b, over: b - lim, pc: pct(b, lim), _acc: k }; }).filter(function (r) { return r.lim && r.bal > r.lim; }).sort(function (a, b) { return b.over - a.over; });
        return { cols: [C('name', 'العميل'), C('lim', 'حد الائتمان', 'money'), C('bal', 'الرصيد', 'money'), C('over', 'التجاوز', 'money'), C('pc', 'من الحد', 'pct')], rows: rows, total: sumRow(rows, [C('lim', '', 'money'), C('bal', '', 'money'), C('over', '', 'money')]), empty: 'لا يوجد عملاء متجاوزون لحد الائتمان (أو لم تُحدد حدود في سراج)' };
      } };

    /* ---------- الصناديق والبنوك ---------- */
    function vouchers(kind, p) {
      var rows = [], bx = boxIds(), pf = hasCustF(p.flt) ? {} : null;
      if (pf) partyFilter(recvIds().concat(payIds()), p.flt).forEach(function (x) { pf[x] = 1; });
      entriesIn(p.from, p.to, function (l) { return l.k === kind; }).forEach(function (l) {
        var ls = F.D.byEntry[l.e], tot = entryTotal(ls);
        if (pf && !ls.some(function (x) { return pf[x.a]; })) return;
        var cashSide = ls.filter(function (x) { return kind === 'r' ? x.dr : x.cr; }), other = ls.filter(function (x) { return kind === 'r' ? x.cr : x.dr; });
        var boxL = cashSide.filter(function (x) { return bx.indexOf(x.a) >= 0; })[0] || cashSide[0] || {};
        rows.push({ d: l.d, no: l.no, type: l.btn, box: accName(boxL.a), party: uniq(other.map(function (x) { return accName(x.a); })).join('، '), v: tot, desc: l.ed || l.ld || '' });
      });
      rows.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
      if (p.vby && p.vby !== 'none') {
        var g = {}, keyF = p.vby === 'box' ? 'box' : p.vby === 'party' ? 'party' : 'd';
        rows.forEach(function (r) { var k = r[keyF], x = g[k] || (g[k] = { name: k, n: 0, v: 0 }); x.n++; x.v += r.v; });
        var list = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return keyF === 'd' ? (a.name < b.name ? -1 : 1) : b.v - a.v; });
        return { cols: [C('name', keyF === 'box' ? 'الصندوق أو البنك' : keyF === 'party' ? (kind === 'r' ? 'المصدر' : 'الجهة') : 'اليوم'), C('n', 'عدد السندات', 'int'), C('v', 'المبلغ', 'money')],
          rows: list, total: sumRow(list, [C('n', '', 'int'), C('v', '', 'money')]), chart: { type: keyF === 'd' ? 'bar' : 'hbar', x: 'name', y: ['v'], yl: ['المبلغ'], limit: 12 } };
      }
      return { cols: [C('d', 'التاريخ'), C('no', 'رقم السند'), C('type', 'النوع'), C('box', kind === 'r' ? 'إلى (الصندوق/البنك)' : 'من (الصندوق/البنك)'), C('party', kind === 'r' ? 'من' : 'إلى'), C('v', 'المبلغ', 'money'), C('desc', 'البيان')],
        rows: rows, total: sumRow(rows, [C('v', '', 'money')]) };
    }
    R.boxes = { cat: 'cash', name: 'حركة الصناديق والبنوك', desc: 'رصيد أول المدة والمقبوضات والمدفوعات والرصيد لكل صندوق وبنك معرّف', params: ['period', 'box'],
      run: function (p) {
        var bx = activeBoxes();
        if (!bx.length) return { cols: [C('m', '')], rows: [], empty: 'لم تُعرّف صناديق أو بنوك بعد. عرّفها من «الصناديق والإعدادات».' };
        var tm = boxTypeMap();
        if (p.box && p.box !== 'all') { var b = bx.filter(function (x) { return x.acc === p.box; })[0]; return statement([p.box], p, (b ? b.name : accName(p.box)), tm[p.box] ? function (l) { return boxLinePass(l, tm); } : null); }
        var anyT = Object.keys(tm).length;
        var rows = bx.map(function (b) {
          var r = balance([b.acc], p.from, p.to), o = { name: b.name, kind: b.kind, open: r.open, inn: r.dr, out: r.cr, other: 0, close: r.close, _box: b.acc };
          if (tm[b.acc]) { var inn = 0, out = 0; (F.D.byAcc[b.acc] || []).forEach(function (l) { if (l.d >= p.from && l.d <= p.to && boxLinePass(l, tm)) { inn += l.dr; out += l.cr; } }); o.other = (r.dr - r.cr) - (inn - out); o.inn = inn; o.out = out; }
          return o;
        });
        var cols = [C('name', 'الاسم'), C('kind', 'النوع'), C('open', 'رصيد أول المدة', 'money'), C('inn', 'الداخل (مدين)', 'money'), C('out', 'الخارج (دائن)', 'money')].concat(anyT ? [C('other', 'صافي حركة غير معروضة', 'money')] : []).concat([C('close', 'الرصيد', 'money')]);
        return { cols: cols, rows: rows, total: sumRow(rows, cols), chart: { type: 'hbar', x: 'name', y: ['close'], yl: ['الرصيد'] }, note: 'اضغط على أي صندوق أو بنك لعرض حركته التفصيلية برصيد تراكمي' + (anyT ? ' · لبعض الصناديق أنواع سندات أو طرف حركة (مدين أو دائن) محدد في الإعدادات؛ عمود «غير معروضة» يبيّن صافي باقي الحركات حتى يبقى الرصيد صحيحاً' : '') };
      } };
    R.box_daily = { cat: 'cash', name: 'الحركة اليومية للصناديق والبنوك', desc: 'الداخل والخارج والرصيد لكل يوم', params: ['period', 'boxkind'],
      run: function (p) {
        var ids = boxIds(p.boxkind === 'all' ? '' : p.boxkind);
        if (!ids.length) return { cols: [C('m', '')], rows: [], empty: 'لم تُعرّف صناديق أو بنوك من هذا النوع.' };
        var set = {}, g = {}; ids.forEach(function (x) { set[x] = 1; });
        var bal = balance(ids, p.from, p.to).open, rows = [];
        var tm = boxTypeMap(), anyT = ids.some(function (x) { return tm[x]; });
        T().jl.forEach(function (l) { if (!set[l.a] || l.d < p.from || l.d > p.to) return; var r = g[l.d] || (g[l.d] = { inn: 0, out: 0, other: 0 }); if (boxLinePass(l, tm)) { r.inn += l.dr; r.out += l.cr; } else r.other += l.dr - l.cr; });
        Object.keys(g).sort().forEach(function (d) { var r = g[d]; rows.push({ name: d, open: bal, inn: r.inn, out: r.out, other: r.other, close: bal + r.inn - r.out + r.other }); bal += r.inn - r.out + r.other; });
        var cols = [C('name', 'اليوم'), C('open', 'أول اليوم', 'money'), C('inn', 'الداخل', 'money'), C('out', 'الخارج', 'money')].concat(anyT ? [C('other', 'حركة غير معروضة', 'money')] : []).concat([C('close', 'آخر اليوم', 'money')]);
        var t = sumRow(rows, [C('inn', '', 'money'), C('out', '', 'money'), C('other', '', 'money')]); t.close = bal;
        return { cols: cols, rows: rows, total: t, chart: { type: 'line', x: 'name', y: ['close'], yl: ['الرصيد'] } };
      } };
    R.receipts = { cat: 'cash', name: 'سندات القبض', desc: 'كل سند قبض بمبلغه ومصدره، أو مجمّعة', params: ['period', 'vby', 'flt'], fdims: ['cust', 'xcust'], run: function (p) { return withNote(vouchers('r', p), p); } };
    R.payments = { cat: 'cash', name: 'سندات الدفع', desc: 'كل سند دفع بمبلغه وجهته، أو مجمّعة', params: ['period', 'vby', 'flt'], fdims: ['supp'], run: function (p) { return withNote(vouchers('p', p), p); } };

    /* ---------- المشتريات ---------- */
    R.purch = { cat: 'purch', name: 'المشتريات حسب المورد', desc: 'قيمة المشتريات ومرتجعاتها وكمياتها لكل مورد', params: ['period', 'flt'],
      run: function (p) {
        var g = {};
        facts('p', p.from, p.to, p.flt).forEach(function (x) { var k = x.v.ck, r = g[k] || (g[k] = { name: x.v.name, n: {}, pur: 0, ret: 0, qty: 0 }); if (x.s > 0) { r.n[x.v.id] = 1; r.pur += x.val; } else r.ret += x.val; r.qty += x.s * x.qty; });
        var list = Object.keys(g).map(function (k) { var r = g[k]; r.n = Object.keys(r.n).length; r.net = r.pur - r.ret; return r; }).sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'المورد'), C('n', 'عدد الفواتير', 'int'), C('qty', 'صافي الكمية', 'qty'), C('pur', 'المشتريات', 'money'), C('ret', 'المرتجعات', 'money'), C('net', 'الصافي', 'money')];
        return withNote({ cols: cols, rows: list, total: sumRow(list, cols), chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المشتريات'], limit: 12 } }, p);
      } };
    R.purch_item = { cat: 'purch', name: 'المشتريات حسب الصنف', desc: 'الكميات والقيم ومتوسط سعر الشراء لكل صنف', params: ['period', 'flt'],
      run: function (p) {
        var g = {};
        facts('p', p.from, p.to, p.flt).forEach(function (x) { var r = g[x.l.item] || (g[x.l.item] = { name: itemName(x.l.item), unit: (T().item[x.l.item] || {}).mu || '', q: 0, v: 0 }); r.q += x.s * x.qty; r.v += x.s * x.val; });
        var list = Object.keys(g).map(function (k) { var r = g[k]; r.avg = r.q ? r.v / r.q : 0; return r; }).sort(function (a, b) { return b.v - a.v; });
        return withNote({ cols: [C('name', 'الصنف'), C('q', 'صافي الكمية', 'qty'), C('unit', 'الوحدة'), C('v', 'صافي القيمة', 'money'), C('avg', 'متوسط السعر', 'money')], rows: list, total: sumRow(list, [C('q', '', 'qty'), C('v', '', 'money')]) }, p);
      } };
    R.purch_invoices = { cat: 'purch', name: 'سجل فواتير الشراء', desc: 'كل فاتورة شراء ومرتجع شراء', params: ['period', 'flt'],
      run: function (p) {
        var g = {};
        facts('p', p.from, p.to, p.flt).forEach(function (x) { var r = g[x.v.id] || (g[x.v.id] = { v: x.v, s: x.s, qty: 0, val: 0 }); r.qty += x.qty; r.val += x.val; });
        var rows = Object.keys(g).map(function (k) { var r = g[k]; return { d: r.v.d, no: r.v.no, type: r.s > 0 ? 'شراء' : 'مرتجع شراء', name: r.v.name, st: storeName(r.v.st), qty: r.s * r.qty, net: r.s * r.val, note: r.v.note || '' }; }).sort(function (a, b) { return a.d < b.d ? -1 : 1; });
        var cols = [C('d', 'التاريخ'), C('no', 'الرقم'), C('type', 'النوع'), C('name', 'المورد'), C('st', 'المخزن'), C('qty', 'الكمية', 'qty'), C('net', 'الصافي', 'money'), C('note', 'البيان')];
        return withNote({ cols: cols, rows: rows, total: sumRow(rows, [C('qty', '', 'qty'), C('net', '', 'money')]) }, p);
      } };
    R.purch_price = { cat: 'purch', name: 'تطور أسعار الشراء', desc: 'سعر شراء كل صنف في كل فاتورة شراء بالترتيب الزمني', params: ['period', 'flt'],
      run: function (p) {
        var rows = facts('p', p.from, p.to, p.flt).filter(function (x) { return x.s > 0 && x.l.q; }).sort(function (a, b) { return a.l.item === b.l.item ? (a.v.dt < b.v.dt ? -1 : 1) : itemName(a.l.item) < itemName(b.l.item) ? -1 : 1; })
          .map(function (x) { return { item: itemName(x.l.item), d: x.d, no: x.v.no, sup: x.v.name, unit: x.l.un || '', q: x.l.q, p: x.l.p || x.val / x.l.q, cu: x.l.qb ? x.val / x.l.qb * ((T().item[x.l.item] || {}).f || 1) : 0 }; });
        return withNote({ cols: [C('item', 'الصنف'), C('d', 'التاريخ'), C('no', 'الفاتورة'), C('sup', 'المورد'), C('unit', 'الوحدة'), C('q', 'الكمية', 'qty'), C('p', 'السعر', 'money'), C('cu', 'تكلفة الوحدة الشائعة', 'money')], rows: rows }, p);
      } };

    /* ---------- المخزون ---------- */
    function stockRows(d, flt) {
      var b = stockAt(d), g = {}, stores = {};
      var f = parseFilter(flt);
      Object.keys(b).forEach(function (k) {
        var p2 = k.split('|'), sid = p2[0], item = p2[1], qb = b[k];
        if (Math.abs(qb) < 1e-9) return;
        if (f && !linePass({ item: item, st: sid }, f)) return;
        var it = T().item[item] || { f: 1 }, r = g[item] || (g[item] = { id: item, name: itemName(item), unit: it.mu || '', qty: 0, val: 0, cost: costAt(item, d) * (it.f || 1) });
        r['s' + sid] = (r['s' + sid] || 0) + qb / (it.f || 1); r.qty += qb / (it.f || 1); r.val += qb * costAt(item, d); stores[sid] = 1;
      });
      return { rows: Object.keys(g).map(function (k) { return g[k]; }), stores: Object.keys(stores) };
    }
    R.stock_balance = { cat: 'stock', name: 'أرصدة المخزون', desc: 'كمية وقيمة كل صنف في كل مخزن في تاريخ محدد', params: ['asof', 'flt'],
      run: function (p) {
        var s = stockRows(p.asof, p.flt), rows = s.rows.sort(function (a, b) { return b.val - a.val; });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة')].concat(s.stores.map(function (sid) { return C('s' + sid, storeName(sid), 'qty'); }), [C('qty', 'إجمالي الكمية', 'qty'), C('cost', 'متوسط التكلفة', 'money'), C('val', 'القيمة', 'money')]);
        return withNote({ cols: cols, rows: rows, total: sumRow(rows, cols.filter(function (c) { return c.k !== 'cost'; })), note: 'الكمية بالوحدة الشائعة في البيع، والقيمة بمتوسط تكلفة الشراء المتحرك' }, p);
      } };
    R.stock_store = { cat: 'stock', name: 'المخزون حسب المخزن', desc: 'إجمالي الكمية والقيمة لكل مخزن', params: ['asof', 'flt'],
      run: function (p) {
        var b = stockAt(p.asof), f = parseFilter(p.flt), g = {};
        Object.keys(b).forEach(function (k) { var q2 = k.split('|'), it = T().item[q2[1]] || { f: 1 }; if (Math.abs(b[k]) < 1e-9 || (f && !linePass({ item: q2[1], st: q2[0] }, f))) return; var r = g[q2[0]] || (g[q2[0]] = { name: storeName(q2[0]), items: 0, qty: 0, val: 0 }); r.items++; r.qty += b[k] / (it.f || 1); r.val += b[k] * costAt(q2[1], p.asof); });
        var rows = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.val - a.val; });
        var cols = [C('name', 'المخزن'), C('items', 'عدد الأصناف', 'int'), C('qty', 'الكمية', 'qty'), C('val', 'القيمة', 'money')];
        return withNote({ cols: cols, rows: rows, total: sumRow(rows, cols), chart: { type: 'hbar', x: 'name', y: ['val'], yl: ['القيمة'] } }, p);
      } };
    R.stock_movement = { cat: 'stock', name: 'حركة الأصناف (أول المدة والوارد والصادر وآخر المدة)', desc: 'لكل صنف: الرصيد الافتتاحي والمشتريات والمبيعات والمرتجعات والمناقلات والرصيد', params: ['period', 'flt'],
      run: function (p) {
        var f = parseFilter(p.flt), g = {};
        var row = function (item) { var it = T().item[item] || { f: 1 }; return g[item] || (g[item] = { name: itemName(item), unit: it.mu || '', open: 0, pur: 0, sal: 0, ret: 0, tin: 0, tout: 0, iss: 0, close: 0, _f: it.f || 1 }); };
        F.D.moves.forEach(function (m) {
          if (m.d > p.to || (f && !linePass({ item: m.item, st: m.st }, f))) return;
          var r = row(m.item), q2 = m.q / r._f;
          if (m.d < p.from) { r.open += q2; r.close += q2; return; }
          r.close += q2;
          var c = m.l ? m.l.v.c : TRANSFER;
          if (c === PUR || c === OPEN_STOCK || c === PRET) r.pur += q2; else if (c === SALE) r.sal -= q2; else if (c === SRET) r.ret += q2; else if (c === ISSUE) r.iss -= q2; else if (q2 > 0) r.tin += q2; else r.tout -= q2;
        });
        var rows = Object.keys(g).map(function (k) { return g[k]; }).filter(function (r) { return Math.abs(r.open) + Math.abs(r.close) + r.pur + r.sal > 0.0005; }).sort(function (a, b) { return b.sal - a.sal; });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة'), C('open', 'أول المدة', 'qty'), C('pur', 'مشتريات', 'qty'), C('ret', 'مرتجع مبيع', 'qty'), C('tin', 'مناقلة واردة', 'qty'), C('sal', 'مبيعات', 'qty'), C('tout', 'مناقلة صادرة', 'qty'), C('iss', 'إخراج', 'qty'), C('close', 'آخر المدة', 'qty')];
        return withNote({ cols: cols, rows: rows, total: sumRow(rows, cols), note: 'بالوحدة الشائعة في البيع. مع تصفية المخزن تظهر المناقلات من وإلى ذلك المخزن' }, p);
      } };
    R.transfers = { cat: 'stock', name: 'المناقلات بين المخازن', desc: 'كل مناقلة: من مخزن إلى مخزن والأصناف والكميات', params: ['period', 'flt'],
      run: function (p) {
        var f = parseFilter(p.flt), rows = [];
        F.D.invs.forEach(function (v) { if (v.c !== TRANSFER || v.d < p.from || v.d > p.to) return; v.lines.forEach(function (l) { if (f && !linePass(l, f) && !(f.st && storeMatch(f.st, l.ts))) return; var it = T().item[l.item] || { f: 1 }; rows.push({ d: v.d, no: v.no, from: storeName(l.st), to: storeName(l.ts), item: itemName(l.item), q: l.qb / (it.f || 1), val: l.qb * costAt(l.item, v.d) }); }); });
        rows.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
        return withNote({ cols: [C('d', 'التاريخ'), C('no', 'الرقم'), C('from', 'من مخزن'), C('to', 'إلى مخزن'), C('item', 'الصنف'), C('q', 'الكمية', 'qty'), C('val', 'القيمة بالتكلفة', 'money')], rows: rows, total: sumRow(rows, [C('q', '', 'qty'), C('val', '', 'money')]) }, p);
      } };
    R.stock_slow = { cat: 'stock', name: 'الأصناف الراكدة وتغطية المخزون', desc: 'أيام تغطية المخزون الحالي بمعدل البيع، وآخر بيع لكل صنف', params: ['asof', 'flt'],
      run: function (p) {
        var s = stockRows(p.asof, p.flt), from = addD(p.asof, -89), sold = {}, last = {};
        facts('s', from, p.asof, p.flt).forEach(function (x) { sold[x.l.item] = (sold[x.l.item] || 0) + x.s * x.qty; });
        F.D.invs.forEach(function (v) { if (v.c === SALE && v.d <= p.asof) v.lines.forEach(function (l) { if (!last[l.item] || v.d > last[l.item]) last[l.item] = v.d; }); });
        var rows = s.rows.filter(function (r) { return r.qty > 0.0005; }).map(function (r) { var id = r.id, daily = (sold[id] || 0) / 90; return { name: r.name, unit: r.unit, qty: r.qty, val: r.val, daily: daily, cover: daily > 0 ? r.qty / daily : null, last: last[id] || '—' }; })
          .sort(function (a, b) { return (b.cover === null ? 1e9 : b.cover) - (a.cover === null ? 1e9 : a.cover); });
        return withNote({ cols: [C('name', 'الصنف'), C('unit', 'الوحدة'), C('qty', 'الكمية', 'qty'), C('val', 'القيمة', 'money'), C('daily', 'البيع اليومي (90 يوماً)', 'qty'), C('cover', 'أيام التغطية', 'qty'), C('last', 'آخر بيع')], rows: rows, total: sumRow(rows, [C('qty', '', 'qty'), C('val', '', 'money')]), note: 'الأصناف بلا بيع خلال 90 يوماً تظهر في الأعلى' }, p);
      } };

    /* ---------- إدارية ---------- */
    R.users_activity = { cat: 'admin', name: 'نشاط المستخدمين في سراج', desc: 'عدد الفواتير والقيود التي أدخلها كل مستخدم في الفترة', params: ['period'],
      run: function (p) {
        var g = {}, get = function (u) { return g[u] || (g[u] = { name: userName(u), sale: 0, ret: 0, pur: 0, other: 0, vr: 0, vp: 0, je: 0 }); };
        F.D.invs.forEach(function (v) { if (v.d < p.from || v.d > p.to) return; var r = get(v.u || '0'); if (v.c === SALE) r.sale++; else if (v.c === SRET) r.ret++; else if (v.c === PUR || v.c === PRET) r.pur++; else r.other++; });
        entriesIn(p.from, p.to, function (l) { return l.k !== 'i'; }).forEach(function (l) { var r = get(l.u || '0'); if (l.k === 'r') r.vr++; else if (l.k === 'p') r.vp++; else r.je++; });
        var list = Object.keys(g).map(function (k) { var r = g[k]; r.tot = r.sale + r.ret + r.pur + r.other + r.vr + r.vp + r.je; return r; }).sort(function (a, b) { return b.tot - a.tot; });
        var cols = [C('name', 'المستخدم'), C('sale', 'فواتير مبيع', 'int'), C('ret', 'مرتجعات', 'int'), C('pur', 'مشتريات', 'int'), C('other', 'فواتير أخرى', 'int'), C('vr', 'سندات قبض', 'int'), C('vp', 'سندات دفع', 'int'), C('je', 'قيود يدوية', 'int'), C('tot', 'الإجمالي', 'int')];
        return { cols: cols, rows: list, total: sumRow(list, cols) };
      } };
    R.data_check = { cat: 'admin', name: 'سلامة البيانات والمزامنة', desc: 'آخر مزامنة، وعدد السجلات، وتوازن القيود، وتطابق الجهاز مع سراج', params: [],
      run: function () {
        var m = F.meta || {}, ck = m.check || {}, Tt = T();
        var rows = [
          { m: 'آخر استلام بيانات مالية من الوكيل', v: m.last || '—' }, { m: 'آخر نبضة من الوكيل', v: (m.agent && m.agent.last_beat) || '—' }, { m: 'إصدار الوكيل', v: (m.agent && m.agent.version) || '—' },
          { m: 'أسطر القيود', v: fk(Tt.jl.length) }, { m: 'الفواتير (كل الأنواع)', v: fk(Object.keys(Tt.inv).length) }, { m: 'أسطر الفواتير', v: fk(Tt.invl.length) },
          { m: 'الحسابات', v: fk(Object.keys(Tt.acc).length) }, { m: 'آخر تاريخ في القيود', v: F.D.maxDate || '—' },
          { m: 'إجمالي المدين في سراج', v: fm(ck.debit) }, { m: 'إجمالي الدائن في سراج', v: fm(ck.credit) },
          { m: 'توازن القيود في سراج', v: ck.balanced === false ? 'غير متوازنة ✗' : ck.balanced ? 'متوازنة ✓' : '—' }];
        var dr = 0; Tt.jl.forEach(function (l) { dr += l.dr; });
        // المقارنة بإجمالي القسم المعروض نفسه (فرع واحد = إجمالي ذلك الفرع)، مع هامش تقريب الأسطر (3 خانات لكل سطر)
        var cb = F.curBr && F.curBr !== '*' && ck.by && ck.by[F.curBr] ? ck.by[F.curBr] : ck, okDr = cb.debit !== undefined && Math.abs(dr - cb.debit) < Math.max(0.05, Tt.jl.length * 0.0005);
        rows.push({ m: 'إجمالي المدين على هذا الجهاز' + (cb !== ck ? ' (' + brName(F.curBr) + ')' : ''), v: fm(dr) });
        if (cb !== ck) rows.push({ m: 'إجمالي المدين في سراج (' + brName(F.curBr) + ')', v: fm(cb.debit) });
        rows.push({ m: 'تطابق الجهاز مع سراج', v: okDr ? 'مطابق ✓' : 'غير مطابق، اضغط «تحديث البيانات»' });
        // أزمنة التحميل على هذا الجهاز
        var tm = TM || {}, sec = function (ms) { return ms === undefined ? '—' : (ms / 1000).toFixed(1) + ' ث'; };
        rows.push({ m: 'فتح المنظومة من بيانات الجهاز', v: sec(tm.open) + (tm.cachePacks !== undefined ? ' · ' + tm.cachePacks + ' حزمة محفوظة' : '') + ' (المفتاح ' + sec(tm.key) + '، القراءة ' + sec(tm.read) + '، فك الضغط ' + sec(tm.unzip) + '، التحليل ' + sec(tm.parse) + '، الفهرسة ' + sec(tm.rebuild) + ')' },
          { m: 'آخر تنزيل من الخادم', v: tm.dlAt ? tm.dlAt.slice(11, 16) + ' · ' + (tm.dlPacks || 0) + ' حزمة' + (tm.bytes ? ' · ' + (tm.bytes / 1048576).toFixed(1) + ' م.ب' : '') + ' · ' + sec(tm.dl) : '—' },
          { m: 'التخزين على الجهاز', v: (CK.key ? 'مشفّر ✓' : 'غير مشفّر') + (tm.persist === true ? ' · دائم ✓' : tm.persist === false ? ' · قد يحذفه المتصفح عند امتلاء المساحة' : '') });
        // آخر حركة في كل قسم: يكشف القسم الذي توقفت بياناته
        if (multiBr()) branches().forEach(function (b) { var x = withBr(b.code, function () { var le = '', li = '', n = 0, d0 = addD(today(), -1); Object.keys(F.D.byEntry).forEach(function (k) { var l = F.D.byEntry[k][0]; if (l.dt && l.dt > le) le = l.dt; if (l.d === d0) n++; }); (F.D.invs || []).forEach(function (v) { var t = v.dt || v.d; if (t && t > li) li = t; }); return { le: le, li: li, n: n }; });
          rows.push({ m: 'آخر قيد مُدخل — ' + b.name, v: x.le || '—' }, { m: 'آخر فاتورة — ' + b.name, v: x.li || '—' }, { m: 'قيود أمس — ' + b.name, v: fk(x.n) }); });
        var hasStore = Tt.invl.some(function (l) { return l.st; });
        rows.push({ m: 'بيانات المخازن في أسطر الفواتير', v: hasStore ? 'متوفرة ✓' : 'غير متوفرة: حدّث الوكيل إلى 1.2.2 لتعمل تقارير المخزون بدقة' });
        return { cols: [C('m', 'البند'), C('v', 'القيمة')], rows: rows };
      } };


    /* ===================== منشئ التقارير المخصصة ===================== */
    var DIMS = {
      day: ['اليوم', function (r) { return r.d; }], week: ['الأسبوع', function (r) { return weekStart(r.d); }], month: ['الشهر', function (r) { return r.d.slice(0, 7); }],
      year: ['السنة', function (r) { return r.d.slice(0, 4); }],
      cust: ['العميل/المورد', function (r) { return r.v ? r.v.name : r.name; }], rep: ['المندوب', function (r) { var v = r.v || r; return (T().ag[v.ag] || {}).name || 'بدون'; }],
      store: ['المخزن', function (r) { return storeName(r.st); }],
      type: ['نوع الفاتورة', function (r) { var v = r.v || r; return (T().it[v.t] || {}).name || String(v.c); }],
      user: ['المستخدم', function (r) { var v = r.v || r; return (T().us[v.u] || {}).name || 'غير معروف'; }],
      item: ['الصنف', function (r) { return itemName(r.item); }],
      acc: ['الحساب', function (r) { return accName(r.a); }],
      acc2: ['الحساب (مستوى 2)', function (r) { return ancestorAt(r.a, 2); }], acc3: ['الحساب (مستوى 3)', function (r) { return ancestorAt(r.a, 3); }],
      acc4: ['الحساب (مستوى 4)', function (r) { return ancestorAt(r.a, 4); }],
      etype: ['نوع القيد', function (r) { return r.btn; }],
      dow: ['يوم الأسبوع', function (r) { return DOW[new Date(d2t(r.d)).getUTCDay()]; }]
    };
    var DS = {
      sinv: { name: 'فواتير المبيع والمرتجع', dims: ['day', 'week', 'month', 'year', 'dow', 'cust', 'rep', 'store', 'type', 'user'],
        rows: function () { return F.D.invs.filter(function (v) { return v.c === SALE || v.c === SRET; }); },
        meas: { count: ['عدد الفواتير', function (r) { return 1; }], sales: ['المبيعات', function (r) { return r.c === SALE ? r.net : 0; }], ret: ['المرتجعات', function (r) { return r.c === SRET ? r.net : 0; }],
          net: ['صافي المبيعات', function (r) { return r.sign * r.net; }], profit: ['مجمل الربح', function (r) { return r.sign * r.profit; }], qty: ['الكمية', function (r) { return r.sign * r.qty; }] } },
      slines: { name: 'أصناف المبيع والمرتجع (أسطر)', dims: ['day', 'week', 'month', 'year', 'dow', 'item', 'cust', 'rep', 'store', 'user'],
        rows: function () { var out = []; F.D.invs.forEach(function (v) { if (v.c === SALE || v.c === SRET) v.lines.forEach(function (l) { out.push(l); }); }); return out; },
        meas: { q: ['الكمية (الوحدة الشائعة)', function (l) { var it = T().item[l.item] || { f: 1 }; return l.v.sign * l.qb / (it.f || 1); }], value: ['القيمة الصافية', function (l) { return l.v.sign * l.tot; }],
          cost: ['التكلفة', function (l) { return l.v.sign * l.cost; }], profit: ['الربح', function (l) { return l.v.sign * l.win; }], gift: ['الهدايا', function (l) { return l.v.sign * l.g; }], lines: ['عدد الأسطر', function () { return 1; }] } },
      pinv: { name: 'فواتير المشتريات ومرتجعاتها', dims: ['day', 'week', 'month', 'year', 'cust', 'store', 'type', 'user'],
        rows: function () { return F.D.invs.filter(function (v) { return v.c === PUR || v.c === PRET; }); },
        meas: { count: ['عدد الفواتير', function () { return 1; }], net: ['صافي المشتريات', function (r) { return r.sign * r.net; }], qty: ['الكمية', function (r) { return r.sign * r.qty; }] } },
      plines: { name: 'أصناف المشتريات (أسطر)', dims: ['day', 'week', 'month', 'year', 'item', 'cust', 'store'],
        rows: function () { var out = []; F.D.invs.forEach(function (v) { if (v.c === PUR || v.c === PRET) v.lines.forEach(function (l) { out.push(l); }); }); return out; },
        meas: { q: ['الكمية (الوحدة الشائعة)', function (l) { var it = T().item[l.item] || { f: 1 }; return l.v.sign * l.qb / (it.f || 1); }], value: ['القيمة', function (l) { return l.v.sign * l.tot; }] } },
      jl: { name: 'القيود المحاسبية (أسطر)', dims: ['day', 'week', 'month', 'year', 'acc', 'acc2', 'acc3', 'acc4', 'etype', 'user'],
        rows: function () { return T().jl; },
        meas: { dr: ['مدين', function (l) { return l.dr; }], cr: ['دائن', function (l) { return l.cr; }], net: ['الصافي (مدين - دائن)', function (l) { return l.dr - l.cr; }], count: ['عدد الأسطر', function () { return 1; }] } }
    };
    function runCustom(def, p) {
      if (def.kind === 'formula') return runFormulaReport(def, p);
      if (def.kind === 'ready') { var rb = R[def.base]; if (!rb) return { cols: [C('m', '')], rows: [], empty: 'التقرير الأساسي غير موجود' }; return rb.run(Object.assign({}, def.p || {}, p)); }
      if (def.kind === 'pair') return runPair(def, p);
      if (def.kind === 'free') return runFree(def, p);
      var ds = DS[def.ds];
      if (!ds) return { cols: [C('m', '')], rows: [], empty: 'مصدر البيانات غير معروف' };
      var dimR = DIMS[def.row] || DIMS.month, dimC = def.col ? DIMS[def.col] : null;
      var meas = (def.meas && def.meas.length ? def.meas : Object.keys(ds.meas).slice(0, 2)).filter(function (m) { return ds.meas[m]; });
      var flt = String(def.filter || '').trim(), fdim = def.fdim ? DIMS[def.fdim] : null;
      var g = {}, colKeys = {};
      ds.rows().forEach(function (r) {
        if (r.d < p.from || r.d > p.to) return;
        if (flt && fdim && String(fdim[1](r)).indexOf(flt) < 0) return;
        var rk = dimR[1](r), x = g[rk] || (g[rk] = { name: rk });
        meas.forEach(function (m) { x[m] = (x[m] || 0) + ds.meas[m][1](r); });
        if (dimC) { var ck = dimC[1](r); colKeys[ck] = 1; x['c_' + ck] = (x['c_' + ck] || 0) + ds.meas[meas[0]][1](r); }
      });
      var list = Object.keys(g).map(function (k) { return g[k]; });
      var timeDim = ['day', 'week', 'month', 'year'].indexOf(def.row) >= 0;
      var sortK = def.sort || (timeDim ? '_name' : meas[0]);
      list.sort(function (a, b) { return sortK === '_name' ? (a.name < b.name ? -1 : 1) : (b[sortK] || 0) - (a[sortK] || 0); });
      if (def.row === 'month') list.forEach(function (r) { r.name = monthLabel(r.name); });
      var cols = [C('name', dimR[0])];
      if (dimC) {
        var ck = Object.keys(colKeys).sort().slice(0, 24);
        ck.forEach(function (k) { cols.push(C('c_' + k, def.col === 'month' ? monthLabel(k) : k, 'money')); });
        cols.push(C(meas[0], 'الإجمالي: ' + ds.meas[meas[0]][0], 'money'));
      } else meas.forEach(function (m) { cols.push(C(m, ds.meas[m][0], /count|lines/.test(m) ? 'int' : /^q|gift/.test(m) ? 'qty' : 'money')); });
      var total = sumRow(list, cols.slice(1));
      var res = { cols: cols, rows: list, total: total };
      if (def.top) topN(res, { top: def.top });
      if (def.chart && !dimC) res.chart = { type: def.chart, x: 'name', y: [meas[0]], yl: [ds.meas[meas[0]][0]], limit: def.chart === 'hbar' ? 15 : 0 };
      return res;
    }
    // تقرير بالمعادلات: كل سطر معادلة، والأعمدة فترات زمنية
    function periodCols(from, to, g) {
      if (!g || g === 'single') return [{ k: 'all', l: perLabelTxt(from, to), from: from, to: to }];
      var out = [], keys = {}, d = from;
      while (d <= to && out.length < 400) { var k = bucket(d, g); if (!keys[k]) { keys[k] = 1; out.push(k); } d = addD(d, 1); }
      return out.slice(-62).map(function (k) {
        var a = g === 'month' ? k + '-01' : k, b = g === 'month' ? monthEnd(k) : g === 'week' ? addD(k, 6) : k;
        if (a < from) a = from; if (b > to) b = to;
        return { k: k, l: g === 'month' ? MONTHS[+k.slice(5, 7) - 1] + (k.slice(0, 4) !== to.slice(0, 4) ? ' ' + k.slice(0, 4) : '') : g === 'day' ? dayShort(k) : 'أسبوع ' + dayShort(k), from: a, to: b };
      });
    }
    function perLabelTxt(from, to) { return from === to ? from : from + ' ← ' + to; }
    function runFormulaReport(def, p) {
      var rows = (def.rows || []).filter(function (r) { return r.name || r.f; });
      if (!rows.length) return { cols: [C('m', '')], rows: [], empty: 'أضف سطراً واحداً على الأقل' };
      var pc = periodCols(p.from, p.to, def.cols), multi = pc.length > 1;
      var vals = pc.map(function (c) { return evalList(rows, c.from, c.to, p.flt); });
      var tot = multi && def.total !== false ? evalList(rows, p.from, p.to, p.flt) : null;
      var errs = [];
      var out = rows.map(function (r, i) {
        if (!itemF(r)) return { name: r.name, _b: true, _hl: true };
        var o = { name: r.name, _fmt: r.fmt || 'money', _b: !!r.bold };
        pc.forEach(function (c, j) { var x = vals[j][i]; o['c' + j] = x.err ? null : x.v; if (x.err && errs.indexOf(r.name) < 0) errs.push(r.name + ': ' + x.err); });
        if (tot) o.tot = tot[i].err ? null : tot[i].v;
        return o;
      });
      var cols = [C('name', def.first || 'البند')].concat(pc.map(function (c, j) { return C('c' + j, c.l, 'money'); }));
      if (tot) cols.push(C('tot', 'الفترة كاملة', 'money'));
      var res = { cols: cols, rows: out, note: errs.length ? 'أخطاء: ' + errs.slice(0, 3).join(' · ') : '' };
      if (def.chart && multi) { var first = out.filter(function (r) { return r.c0 !== undefined; })[0]; if (first) res.chart = { type: def.chart, x: 'name', y: ['v'], yl: [first.name], rowsOverride: pc.map(function (c, j) { return { name: c.l, v: first['c' + j] || 0 }; }) }; }
      return res;
    }

    /* ===================== الواجهة ===================== */
    function go(sub) { F.sub = sub; if (sub !== 'reports') F.cur = null; A.go(sub); }
    function canEdit() { return !!(A.st.user && A.st.user.can_edit); }
    var SUBS = ['dash', 'daily', 'reports', 'builder', 'settings'];

    function newDataBar() {
      var m = q('#main'); if (!m || q('#newdata', m)) return;
      var d = document.createElement('div'); d.id = 'newdata'; d.className = 'newdata';
      d.innerHTML = '<span>' + ICON.refresh + ' وصلت بيانات أحدث من سراج</span><button class="btn sm primary" type="button">تحديث التقرير</button>';
      m.insertBefore(d, m.firstChild);
      d.querySelector('button').onclick = function () { var y = window.scrollY; d.remove(); A.render(); setTimeout(function () { window.scrollTo(0, y); }, 0); };
    }
    function view(sub) {
      return {
        load: function (quiet) {
          var had = !!F.D, rev = F.rev + '|' + ((F.pks && F.pks.gen) || ''), nb = JSON.stringify([F.boxes, F.reports, F.config]);
          // التحديث التلقائي لا يعيد رسم الشاشة إلا إذا وصل جديد، حتى لا يقطع ما يكتبه المستخدم
          if (quiet && had && F.lastPull && Date.now() - F.lastPull < 180000) return Promise.resolve(false);
          if (quiet && F.dirty) return Promise.resolve(false);
          F.quiet = quiet;
          return load(false).then(function () {
            var ch = !had || F.rev + '|' + ((F.pks && F.pks.gen) || '') !== rev || nb !== JSON.stringify([F.boxes, F.reports, F.config]);
            // تقرير مفتوح: لا نغيّر أرقامه تحت يد المستخدم، نعرض شريط «بيانات أحدث» ويحدّث متى شاء
            if (ch && had && quiet && F.sub === 'reports' && F.cur) { newDataBar(); return false; }
            return ch;
          });
        },
        html: function () {
          if (F.sub !== sub) { F.sub = sub; if (sub !== 'reports') F.cur = null; }
          var h = '';
          if (!F.D && F.error && !F.loading) return '<div class="card empty"><p>تعذّر تحميل البيانات المالية: ' + esc(F.error) + '</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' إعادة المحاولة</button></div>';
          if (!F.D && F.rows && !hasData() && !F.loading && F.meta) return '<div class="card empty"><p>لم تصل بيانات مالية من الوكيل بعد.</p><p class="small muted">بعد إعداد الوكيل على جهاز سراج بمفتاح المنظومة المالية سيرسل القيود والفواتير تلقائياً خلال دقائق.</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' تحقق الآن</button></div>';
          if (!F.D) return '<div class="card loading"><span class="spin"></span> <span id="finprog">' + esc(F.progress || 'جارٍ تحميل البيانات المالية… أول مرة قد تستغرق دقيقة') + '</span></div>';
          h += syncLine();
          if (sub === 'dash' || sub === 'daily' || sub === 'reports') h += brBarHTML();
          else if (multiBr()) useBr('*');   // الإعدادات والمنشئ تعمل على كل البيانات
          try {
            if (sub === 'dash') h += dashHTML();
            else if (sub === 'daily') h += dailyHTML();
            else if (sub === 'reports') h += F.cur ? reportHTML() : catalogHTML();
            else if (sub === 'builder') h += builderHTML();
            else h += settingsHTML();
          } catch (e) { if (window.console) console.error(e); h += '<div class="card empty">حدث خطأ أثناء إعداد الشاشة: ' + esc(e.message) + '</div>'; }
          return h;
        },
        bind: function (m) {
          var rf = q('[data-frefresh]', m);
          if (rf) rf.onclick = function () { busy(rf, true); load(true).then(function () { toast('حُدّثت البيانات المالية'); A.render(); }).catch(function (e) { busy(rf, false); toast(e.message, true); A.render(); }); };
          if (!F.D) return;
          qa('[data-brv]', m).forEach(function (b) { b.onclick = function () { setBr(b.dataset.brv); A.render(); }; });
          qa('[data-open]', m).forEach(function (b) { b.addEventListener('click', function () { openReport(b.dataset.open, b.dataset.per ? { preset: b.dataset.per, from: F.lastRange && F.lastRange[0], to: F.lastRange && F.lastRange[1] } : null); }); });
          if (sub === 'dash') bindDash(m);
          else if (sub === 'daily') bindDaily(m);
          else if (sub === 'reports') (F.cur ? bindReport : bindCatalog)(m);
          else if (sub === 'builder') bindBuilder(m);
          else bindSettings(m);
        }
      };
    }
    SUBS.forEach(function (k) { A.VIEWS[k] = view(k); });

    /* ---------- اختيار الفرع (يظهر فقط إذا كان الوكيل يقرأ أكثر من قاعدة) ---------- */
    function brBarHTML() {
      if (!multiBr()) return '';
      var v = viewBr();
      useBr(v === 'cmp' ? '*' : v);
      var opts = [{ code: '*', name: 'موحّد' }].concat(branches()).concat([{ code: 'cmp', name: 'مقارنة الفروع' }]);
      return '<div class="br-bar" role="group" aria-label="الفرع"><span class="br-l">الفرع</span><div class="seg">' + opts.map(function (o) {
        return '<button class="seg-b' + (v === o.code ? ' on' : '') + '" data-brv="' + esc(o.code) + '">' + esc(o.name) + '</button>';
      }).join('') + '</div></div>';
    }
    function brNote() { return multiBr() ? brName(viewBr()) : ''; }

    function syncLine() {
      var m = F.meta || {}, ck = m.check || {};
      var lb = m.agent && m.agent.last_beat;
      return '<div class="fin-sync"><span class="fs-dot' + (ck.balanced === false ? ' bad' : '') + '"></span><span class="fs-t">آخر بيانات من سراج ' + (m.last ? N(String(m.last).slice(5, 16).replace('-', '/')) : '—') + '</span>' +
        (ck.balanced === false ? '<span class="badge b-flag">القيود غير متوازنة في سراج</span>' : ck.balanced ? '<span class="fs-ok">القيود متوازنة ✓</span>' : '') +
        (lb ? '<span class="fs-ag">الوكيل ' + N(String(lb).slice(11, 16)) + '</span>' : '') + '<button class="btn sm ghost fs-btn" data-frefresh aria-label="تحديث البيانات">' + ICON.refresh + '<span class="bt-txt">تحديث</span></button></div>';
    }

    /* ---------- اختيار الفترة (موحّد للوحة والتقارير) ---------- */
    var QUICK = [['today', 'اليوم'], ['week', 'الأسبوع'], ['month', 'الشهر'], ['@q', 'الربع'], ['year', 'السنة']];
    var ICON_CAL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-3px"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>';
    var ICON_XLS = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2h9l5 5v15H6z"/><path d="M9 11l5 6M14 11l-5 6"/></svg>';
    var ICON_EDIT = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
    function rangeText(a, b) {
      var d1 = +a.slice(8, 10), m1 = +a.slice(5, 7), y1 = a.slice(0, 4), d2 = +b.slice(8, 10), m2 = +b.slice(5, 7), y2 = b.slice(0, 4);
      if (a === b) return d1 + ' ' + MONTHS[m1 - 1] + ' ' + y1;
      if (y1 === y2 && m1 === m2) return d1 + ' – ' + d2 + ' ' + MONTHS[m1 - 1] + ' ' + y1;
      if (y1 === y2) return d1 + ' ' + MONTHS[m1 - 1] + ' – ' + d2 + ' ' + MONTHS[m2 - 1] + ' ' + y1;
      return d1 + ' ' + MONTHS[m1 - 1] + ' ' + y1 + ' – ' + d2 + ' ' + MONTHS[m2 - 1] + ' ' + y2;
    }
    function perRange(ps) { return presetRange(ps.preset, ps.from, ps.to, ps.year, ps.month); }
    function isCmp(p) { return p === 'cmpq' || p === 'cmpm'; }
    function isQ(p) { return /^q[1-4]$/.test(p) || p === 'quarter' || p === 'cmpq'; }
    function yearsAvail() {
      if (!F.cache.years) { var mn = T().jl.reduce(function (x, l) { return l.d && l.d < x ? l.d : x; }, today()); var out = []; for (var y = +today().slice(0, 4); y >= +mn.slice(0, 4); y--) out.push(String(y)); F.cache.years = out; }
      return F.cache.years;
    }
    function periodHTML(ps, key, o) {
      o = o || {};
      var r = perRange(ps), cmp = isCmp(ps.preset), pr = o.prev && !cmp ? prevRange(r[0], r[1], ps.preset) : null;
      var on = function (k) { return k === '@q' ? isQ(ps.preset) : ps.preset === k; };
      var moreOn = !QUICK.some(function (k) { return on(k[0]); });
      var qLbl = ps.preset === 'cmpq' ? 'مقارنة الأرباع' : /^q[1-4]$/.test(ps.preset) ? QNAMES[+ps.preset[1] - 1] : ps.preset === 'quarter' ? 'هذا الربع' : 'الربع';
      return '<div class="per"><div class="per-strip" role="group" aria-label="الفترة">' + QUICK.map(function (k) {
        return '<button class="per-b' + (on(k[0]) ? ' on' : '') + '" ' + (k[0] === '@q' ? 'data-pq="' + key + '"' : 'data-pset="' + key + '|' + k[0] + '"') + '>' + (k[0] === '@q' ? esc(qLbl) + ' <i class="car">▾</i>' : k[1]) + '</button>';
      }).join('') + '<button class="per-b per-more' + (moreOn ? ' on' : '') + '" data-per="' + key + '">' + (moreOn ? esc(presetName(ps.preset, ps.year, ps.month)) : 'فترة أخرى') + ' <i class="car">▾</i></button></div>' +
        '<div class="per-info">' + ICON_CAL + ' <b>' + esc(cmp ? presetName(ps.preset, ps.year) + ' (' + rangeText(r[0], r[1]) + ')' : rangeText(r[0], r[1])) + '</b>' +
        (ps.year && ps.year !== today().slice(0, 4) && !cmp && /^q|mon/.test(ps.preset) ? '' : '') + (pr ? '<span class="per-prev">مقارنة بـ ' + esc(rangeText(pr[0], pr[1])) + '</span>' : '') + '</div></div>';
    }
    function yearChips(y) { var ys = yearsAvail(); return ys.length > 1 ? '<div class="ps-years">' + ys.map(function (x) { return '<button class="chip' + (x === y ? ' on' : '') + '" data-yr="' + x + '">' + x + '</button>'; }).join('') + '</div>' : ''; }
    function quarterSheet(ps, allowCmp) {
      return new Promise(function (res) {
        var y = ps.year || today().slice(0, 4);
        sheet('اختر الربع', '<div id="qsb"></div>', function (s) {
          var draw = function () {
            var t = today();
            q('#qsb', s.el).innerHTML = yearChips(y) + '<div class="ps-q">' + [0, 1, 2, 3].map(function (i) {
              var rr = presetRange('q' + (i + 1), null, null, y), fut = rr[0] > t, sel = ps.preset === 'q' + (i + 1) && (ps.year || t.slice(0, 4)) === y;
              return '<button class="ps-qb' + (sel ? ' on' : '') + '" data-setp="q' + (i + 1) + '"' + (fut ? ' disabled' : '') + '><b>' + QNAMES[i] + '</b><span>' + MONTHS[i * 3] + ' – ' + MONTHS[i * 3 + 2] + '</span>' + (fut ? '<em>لم يبدأ</em>' : rr[1] < monthEnd(rr[1].slice(0, 7)) || (rr[1] === t) ? '<em>حتى اليوم</em>' : '') + '</button>';
            }).join('') + '</div>' + (allowCmp ? '<button class="ps-cmp' + (ps.preset === 'cmpq' ? ' on' : '') + '" data-setp="cmpq"><b>كل الأرباع: مقارنة بينها</b><span>عمود لكل ربع في ' + y + ' مع الإجمالي</span></button>' : '');
            qa('[data-yr]', s.el).forEach(function (b) { b.onclick = function () { y = b.dataset.yr; draw(); }; });
            qa('[data-setp]', s.el).forEach(function (b) { b.onclick = function () { s.done = true; s.close(); res({ preset: b.dataset.setp, year: y }); }; });
          };
          draw();
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function periodSheet(ps, allowCmp) {
      return new Promise(function (res) {
        var y = ps.year || today().slice(0, 4), r0 = perRange(ps);
        sheet('اختر الفترة', '<div id="psb"></div>', function (s) {
          var draw = function () {
            var t = today(), cy = y === t.slice(0, 4);
            var b = function (k, l, extra, dis) { return '<button class="ps-b' + (ps.preset === k && (!extra || extra === ps.month) ? ' on' : '') + '" data-setp="' + k + '"' + (extra ? ' data-mon="' + extra + '"' : '') + (dis ? ' disabled' : '') + '>' + l + '</button>'; };
            q('#psb', s.el).innerHTML =
              '<div class="ps-sec"><div class="ps-h">سريع</div><div class="ps-grid">' + b('today', 'اليوم') + b('yesterday', 'أمس') + b('week', 'هذا الأسبوع') + b('last7', 'آخر 7 أيام') + b('month', 'هذا الشهر') + b('lastmonth', 'الشهر الماضي') + '</div></div>' +
              (yearsAvail().length > 1 ? '<div class="ps-sec"><div class="ps-h">السنة</div>' + yearChips(y) + '</div>' : '') +
              '<div class="ps-sec"><div class="ps-h">شهر من ' + y + '</div><div class="ps-grid ps-m">' + MONTHS.map(function (mn, i) { var mm = y + '-' + ('0' + (i + 1)).slice(-2); return b('mon', mn, mm, mm + '-01' > t); }).join('') + '</div></div>' +
              '<div class="ps-sec"><div class="ps-h">ربع من ' + y + '</div><div class="ps-grid">' + [1, 2, 3, 4].map(function (i) { var rr = presetRange('q' + i, null, null, y); return '<button class="ps-b' + (ps.preset === 'q' + i && (ps.year || t.slice(0, 4)) === y ? ' on' : '') + '" data-setp="q' + i + '"' + (rr[0] > t ? ' disabled' : '') + '>' + QNAMES[i - 1] + '</button>'; }).join('') + '</div></div>' +
              '<div class="ps-sec"><div class="ps-h">السنة كاملة</div><div class="ps-grid">' + '<button class="ps-b" data-yfull>سنة ' + y + (cy ? ' حتى اليوم' : '') + '</button>' +
              (allowCmp ? '<button class="ps-b ps-c' + (ps.preset === 'cmpq' ? ' on' : '') + '" data-setp="cmpq">مقارنة الأرباع ' + y + '</button><button class="ps-b ps-c' + (ps.preset === 'cmpm' ? ' on' : '') + '" data-setp="cmpm">مقارنة الأشهر ' + y + '</button>' : '') + '</div></div>' +
              '<div class="ps-sec"><div class="ps-h">فترة محددة</div><div class="ps-cust"><label>من<input type="date" class="input num" id="psf" value="' + r0[0] + '"></label><label>إلى<input type="date" class="input num" id="pst" value="' + r0[1] + '"></label><button class="btn primary" data-pscust>تطبيق</button></div></div>';
            qa('[data-yr]', s.el).forEach(function (bb) { bb.onclick = function () { y = bb.dataset.yr; draw(); }; });
            qa('[data-setp]', s.el).forEach(function (bb) { bb.onclick = function () { s.done = true; s.close(); res({ preset: bb.dataset.setp, year: y, month: bb.dataset.mon || null }); }; });
            q('[data-yfull]', s.el).onclick = function () { s.done = true; s.close(); res({ preset: 'custom', from: y + '-01-01', to: (y + '-12-31') > t ? t : y + '-12-31', year: y }); };
            q('[data-pscust]', s.el).onclick = function () { var f = q('#psf', s.el).value, tt = q('#pst', s.el).value; if (!f || !tt || f > tt) { toast('اختر تاريخين صحيحين', true); return; } s.done = true; s.close(); res({ preset: 'custom', from: f, to: tt }); };
          };
          draw();
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function bindPeriod(m, key, getPs, setPs, allowCmp) {
      var apply = function (patch) { if (!patch) return; var ps = Object.assign({}, getPs(), patch); if (patch.preset !== 'custom') { var r = presetRange(ps.preset, null, null, ps.year, ps.month); ps.from = r[0]; ps.to = r[1]; } setPs(ps); };
      qa('[data-pset^="' + key + '|"]', m).forEach(function (b) { b.onclick = function () { apply({ preset: b.dataset.pset.split('|')[1], year: null, month: null }); }; });
      var bq = q('[data-pq="' + key + '"]', m); if (bq) bq.onclick = function () { quarterSheet(getPs(), allowCmp).then(apply); };
      var bm = q('[data-per="' + key + '"]', m); if (bm) bm.onclick = function () { periodSheet(getPs(), allowCmp).then(apply); };
    }

    /* ---------- لوحة المؤشرات (بطاقات) ---------- */
    var DASH_DIMS = ['cust', 'item', 'st', 'ag', 'xcust', 'xitem'];
    // ماذا يفتح الضغط على البطاقة: التقرير المختار، وإلا تلقائياً: حركات حساباتها، أو التقرير المناسب لما تحسبه
    var CARD_AUTO = { 'مبيعات': 'sales_trend', 'كمية_مبيعات': 'sales_trend', 'مبيعات_إجمالي': 'sales_trend', 'فواتير_مبيع': 'sales_trend', 'عملاء_مشترون': 'sales_cust', 'هدايا': 'sales_trend',
      'مرتجعات': 'sales_returns', 'كمية_مرتجعات': 'sales_returns', 'ربح': 'gross_profit', 'تكلفة_مبيعات': 'gross_profit', 'مشتريات': 'purch', 'كمية_مشتريات': 'purch_item',
      'مديونية': 'recv_balances', 'تحصيل': 'collections_cust', 'الموردون': 'pay_balances', 'رصيد_صناديق': 'boxes', 'مقبوضات': 'receipts', 'مدفوعات': 'payments', 'مخزون_كمية': 'stock_store', 'مخزون_قيمة': 'stock_store' };
    function cardTerms(c) { return c.terms && c.terms.length ? c.terms : (c.f ? fToTerms(c.f) || [] : []); }
    function cardAction(c) {
      if (c.rep === '-') return null;
      if (c.rep && R[c.rep]) return { rep: c.rep };
      var tt = cardTerms(c), codes = [];
      tt.forEach(function (t) { if (TKMAP[t.k] && TKMAP[t.k].type === 'acc') (t.acc || []).forEach(function (x) { if (codes.indexOf(x) < 0) codes.push(x); }); });
      if (!codes.length && c.f) { var m, re = /\[([^\]]+)\]/g; while ((m = re.exec(c.f))) splitList(m[1]).forEach(function (x) { if (codes.indexOf(x) < 0) codes.push(x); }); }
      if (codes.length) return { rep: 'ledger', accs: codes };
      for (var i = 0; i < tt.length; i++) { var k = CARD_AUTO[tt[i].k]; if (k && R[k]) return { rep: k }; }
      return null;
    }
    // شريط مؤشرات أعلى التقرير (مثل تقييم المخزون)
    function kpiVal(k) { return k.t === 'money' ? fm(k.v) : k.t === 'int' ? fk(k.v) : k.t === 'pct' ? (Number(k.v) || 0).toFixed(1) + '%' : String(k.v); }
    function repKpisHTML(ks) { return '<div class="rep-kpis">' + ks.map(function (k) { return '<div class="rk-t' + (k.bad ? ' bad' : '') + '"><span class="rk-l">' + esc(k.l) + '</span><b>' + esc(kpiVal(k)) + '</b>' + (k.s ? '<span class="rk-s">' + esc(k.s) + '</span>' : '') + '</div>'; }).join('') + '</div>'; }
    function cardHTML(c, r, pr, i) {
      var v = r.err ? null : r.v, pv = pr && !pr.err ? pr.v : null;
      var ch = c.cmp && pv ? (v - pv) / Math.abs(pv) * 100 : null, good = c.good === 'down' ? ch < 0 : ch > 0;
      var act = cardAction(c), tag = act ? 'button' : 'div';
      return '<' + tag + (tag === 'button' ? ' data-crep="' + esc(act.rep) + '" data-ci="' + i + '"' : '') + ' class="kpi fin-kpi' + (tag === 'button' ? ' tap' : '') + '" title="' + esc(itemText(c)) + '"><span class="k-n">' + esc(c.name) + '</span>' +
        (r.err ? '<b class="num">—</b><small class="down">خطأ: ' + esc(r.err) + '</small>' : '<b class="num">' + fmtVal(v, c.fmt || 'money0') + '</b>') +
        (ch !== null && isFinite(ch) ? '<small class="k-ch ' + (Math.abs(ch) < 0.05 ? '' : good ? 'up' : 'down') + '">' + (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + fp(Math.abs(ch)) + ' <span class="muted">عن السابقة</span></small>' : '') +
        collSplitHTML(c, r) +
        (c.sub && r.sub !== null && r.sub !== undefined ? '<small class="muted">' + fmtVal(r.sub, c.subfmt || 'int') + ' ' + esc(c.subl || '') + '</small>' : '') + '</' + tag + '>';
    }
    // بطاقة التحصيل (كل التحصيل): سطر صغير «نقدي · بنوك» تحت الرقم
    function collSplitHTML(c, r) {
      if (r.err || !F.lastRange) return '';
      var tt = cardTerms(c);
      if (tt.length !== 1 || tt[0].k !== 'تحصيل' || tt[0].box || (tt[0].flt && Object.keys(tt[0].flt).length)) return '';
      var gf = F.gflt, x = collSplit(F.lastRange[0], F.lastRange[1], gf ? recvFor(gf) : null);
      if (!x.tot) return '';
      var seg = function (cls, l, v) { return '<span class="cs-' + cls + '"><i></i>' + l + ' <b>' + fmtVal(v, c.fmt || 'money0') + '</b></span>'; };
      return '<span class="k-split">' + seg('cash', 'نقدي', x.cash) + seg('bank', 'بنوك', x.bank) + (x.other > 0.5 ? seg('oth', 'مقاصة', x.other) : '') + '</span>' +
        '<span class="k-bar" aria-hidden="true"><i class="cs-cash" style="width:' + (x.cash / x.tot * 100).toFixed(1) + '%"></i><i class="cs-bank" style="width:' + (x.bank / x.tot * 100).toFixed(1) + '%"></i></span>';
    }
    function dashPs() { return F.dash || (F.dash = { preset: 'month' }); }
    function dashRange() { return perRange(dashPs()); }
    function dashHTML() {
      var ps = dashPs(), r = dashRange(), list = cards(), gf = F.gflt, rv = recvFor(gf), cmp = isCmp(ps.preset);
      F.lastRange = r;
      var h = '<div class="card head-card"><div class="hc-top"><h2 class="hc-sub">الفترة</h2>' + (canEdit() ? '<button class="btn sm ghost" data-custom>' + ICON_EDIT + '<span class="bt-txt">تخصيص البطاقات</span></button>' : '') + '</div>' +
        periodHTML(ps, 'dash') + fltPanelHTML(DASH_DIMS, gf, 'dash') + '</div>';
      if (viewBr() === 'cmp') {
        var bs = branches(), bv = bs.map(function (b) { return withBr(b.code, function () { return evalList(list, r[0], r[1], gf); }); }), tv = evalList(list, r[0], r[1], gf);
        h += '<div class="card scroll-x fin-table"><h3>مقارنة الفروع · ' + esc(rangeText(r[0], r[1])) + '</h3><table class="tbl fin"><thead><tr><th>المؤشر</th>' + bs.map(function (b) { return '<th class="n">' + esc(b.name) + '</th>'; }).join('') + '<th class="n">الموحّد</th></tr></thead><tbody>' +
          list.map(function (c, i) { var cell = function (v) { return '<td class="n">' + (v[i].err ? '—' : fmtVal(v[i].v, c.fmt || 'money0')) + '</td>'; }; return '<tr><td>' + esc(c.name) + '</td>' + bv.map(cell).join('') + cell(tv).replace('<td class="n">', '<td class="n"><b>').replace('</td>', '</b></td>') + '</tr>'; }).join('') + '</tbody></table>' +
          '<p class="small muted" style="margin:8px 0 0">كل فرع من قاعدة بياناته في سراج. الموحّد يجمع الفروع كلها.</p></div>';
        if (list.length) h += '<div class="card"><h3>' + esc(list[0].name) + '</h3>' + chartSVG({ type: 'bar', x: 'name', y: ['v'], yl: [list[0].name] }, bs.map(function (b, j) { return { name: b.name, v: bv[j][0].err ? 0 : bv[j][0].v }; })) + '</div>';
        return h;
      }
      if (cmp) {
        var pcs = comparePeriods(ps.preset, ps.year), vals = pcs.map(function (c) { return evalList(list, c.from, c.to, gf); });
        h += '<div class="card scroll-x fin-table"><h3>' + esc(presetName(ps.preset, ps.year)) + '</h3><table class="tbl fin"><thead><tr><th>المؤشر</th>' + pcs.map(function (c) { return '<th class="n">' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          list.map(function (c, i) { return '<tr><td>' + esc(c.name) + '</td>' + vals.map(function (v) { return '<td class="n">' + (v[i].err ? '—' : fmtVal(v[i].v, c.fmt || 'money0')) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
        if (list.length) h += '<div class="card"><h3>' + esc(list[0].name) + '</h3>' + chartSVG({ type: 'bar', x: 'name', y: ['v'], yl: [list[0].name] }, pcs.map(function (c, j) { return { name: c.l, v: vals[j][0].err ? 0 : vals[j][0].v }; })) + '</div>';
        return h;
      }
      var pr = prevRange(r[0], r[1], ps.preset), ds = dataStart(), hasCmp = list.some(function (c) { return c.cmp; }), canCmp = pr[0] >= ds;
      var cur = evalList(list, r[0], r[1], gf), prev = hasCmp && canCmp ? evalList(list, pr[0], pr[1], gf) : [];
      h += '<div class="kpis fin-kpis">' + list.map(function (c, i) { return cardHTML(c, cur[i], prev[i], i); }).join('') + '</div>';
      if (hasCmp) h += '<p class="kpi-cmp">' + (canCmp
        ? '<span class="kc-ar"><b class="up">▲</b><b class="down">▼</b></span><span>النسب في البطاقات مقارنة بالفترة</span><b class="kc-d">' + esc(rangeText(pr[0], pr[1])) + '</b>'
        : '<span class="kc-i">i</span><span>لا تظهر نسب المقارنة: الفترة السابقة (' + esc(rangeText(pr[0], pr[1])) + ') تبدأ قبل بداية بيانات المنظومة في</span><b class="kc-d">' + esc(rangeText(ds, ds)) + '</b>') + '</p>';
      var months = [], m0 = r[1].slice(0, 7);
      for (var i = 5; i >= 0; i--) { var mm = m0, k = i; while (k-- > 0) mm = addD(mm + '-01', -1).slice(0, 7); months.push(mm); }
      var series = months.map(function (mm) { var e = monthEnd(mm) > r[1] ? r[1] : monthEnd(mm); return { name: MONTHS[+mm.slice(5, 7) - 1], net: salesStats(mm + '-01', e, gf).net, coll: collections(mm + '-01', e, '', false, rv) }; });
      h += '<div class="grid2"><div class="card"><h3>المبيعات والتحصيل · آخر 6 أشهر</h3>' + chartSVG({ type: 'bar', x: 'name', y: ['net', 'coll'], yl: ['صافي المبيعات', 'التحصيل'] }, series) + '</div>';
      var top = R.sales_cust.run({ from: r[0], to: r[1], top: 7, flt: gf }).rows;
      h += '<div class="card"><h3>أعلى العملاء مبيعاً</h3>' + (top.length ? chartSVG({ type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] }, top) : '<p class="muted">لا مبيعات في الفترة</p>') + '</div></div>';
      h += '<div class="card"><h3>تقارير سريعة</h3><div class="quick-reps">' + [['exec_summary', 'الملخص التنفيذي'], ['sales_item', 'المبيعات حسب الصنف'], ['sales_cust', 'المبيعات حسب العميل'], ['collections_daily', 'التحصيل اليومي'],
        ['recv_aging', 'أعمار الديون'], ['stock_balance', 'أرصدة المخزون'], ['boxes', 'الصناديق والبنوك'], ['income', 'قائمة الدخل']].map(function (x) { return '<button class="qr" data-qopen="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
        '<button class="qr" data-gosub="daily">التقرير اليومي للإدارة</button></div></div>';
      return h;
    }
    function dashReportParams(id) {
      var ps = dashPs(), r = dashRange(), def = R[id], o = {};
      if (def.params.indexOf('period') >= 0) Object.assign(o, { preset: isCmp(ps.preset) && false ? 'custom' : ps.preset, year: ps.year || null, month: ps.month || null, from: r[0], to: r[1] }); else o.asof = r[1];
      if (def.params.indexOf('flt') >= 0) o.flt = F.gflt || null;
      return o;
    }
    function bindDash(m) {
      bindPeriod(m, 'dash', dashPs, function (ps) { F.dash = ps; A.render(); }, true);
      qa('[data-crep]', m).forEach(function (b) { b.onclick = function () { var c = cards()[Number(b.dataset.ci)], act = c && cardAction(c), rep = b.dataset.crep, o = dashReportParams(rep); if (act && act.accs) { o.accs = act.accs; o.account = ''; } openReport(rep, o); }; });
      qa('[data-qopen]', m).forEach(function (b) { b.onclick = function () { openReport(b.dataset.qopen, dashReportParams(b.dataset.qopen)); }; });
      qa('[data-gosub]', m).forEach(function (b) { b.onclick = function () { go(b.dataset.gosub); }; });
      var cu = q('[data-custom]', m);
      if (cu) cu.onclick = function () { F.setTab = 'cards'; go('settings'); };
      bindFltPanel(m, 'dash', DASH_DIMS, function () { return F.gflt; }, function (f) { F.gflt = f; A.render(); });
    }

    /* ---------- التقرير اليومي للإدارة ---------- */
    function dailyCols() {
      var d = F.dailyDate || F.D.maxDate || today(), cols = [];
      if (F.dailyMode === 'days7') for (var i = 6; i >= 0; i--) { var x = addD(d, -i); cols.push({ l: dayShort(x), from: x, to: x }); }
      else cols.push({ l: dayShort(d), from: d, to: d });
      if (F.dailyMtd) cols.push({ l: 'MTD ' + MON_EN[+d.slice(5, 7) - 1], from: d.slice(0, 7) + '-01', to: d });
      return cols;
    }
    function dailyData() {
      var def = dailyDef(), cols = dailyCols();
      var vals = cols.map(function (c) { return evalList(def.rows, c.from, c.to, F.dflt); });
      return { def: def, cols: cols, vals: vals, date: F.dailyDate || F.D.maxDate || today() };
    }
    function dailyTable(D, cls) {
      return '<table class="' + cls + '"><thead><tr><th class="dh-s">Subject</th>' + D.cols.map(function (c) { return '<th class="dh-d">' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        D.def.rows.map(function (r, i) {
          if (!itemF(r)) return '<tr class="dsep"><th colspan="' + (D.cols.length + 1) + '">' + esc(r.name) + '</th></tr>';
          return '<tr><th class="dl">' + esc(r.name) + '</th>' + D.vals.map(function (v) { var x = v[i]; return '<td class="dv"' + (x.err ? ' title="' + esc(x.err) + '"' : '') + '>' + (x.err ? '<span class="derr">خطأ</span>' : fmtVal(x.v, r.fmt || 'dec2')) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }
    // علامة «قيد التطوير» للتقرير اليومي: إعداد عام (مع الإعدادات المالية) ونسخة محلية تقرأها القائمة الجانبية
    function devDaily() {
      var u = F.config && F.config.ui, on;
      if (u && u.devd !== undefined) on = u.devd !== false; else { try { on = localStorage.getItem('rk.devDaily') !== 'off'; } catch (e) { on = true; } }
      try { localStorage.setItem('rk.devDaily', on ? 'on' : 'off'); } catch (e) {}
      return on;
    }
    function setDevDaily(on) {
      try { localStorage.setItem('rk.devDaily', on ? 'on' : 'off'); } catch (e) {}
      var ui = Object.assign({}, (F.config && F.config.ui) || {}, { devd: !!on });
      if (!F.config) F.config = {}; F.config.ui = ui;
      if (window.RKShell) RKShell.navBadges();
      return saveConfigKey('ui', ui, 'rk.finUi').then(function () { F.config.ui = Object.assign({}, F.config.ui || {}, { devd: !!on }); });
    }
    function dailyHTML() {
      var D = dailyData(), errs = [];
      D.def.rows.forEach(function (r, i) { D.vals.forEach(function (v) { if (v[i].err && errs.indexOf(r.name) < 0) errs.push(r.name); }); });
      var h = (devDaily() ? '<div class="dev-note" role="note"><span class="dev-ic">!</span><div class="grow"><b>التقرير اليومي قيد التطوير</b><span>قد تتغير بنوده وطريقة حسابها خلال التطوير. راجع الأرقام قبل اعتمادها.</span></div></div>' : '') +
        '<div class="card head-card"><div class="hc-top"><div class="grow"><h2>' + esc(D.def.title || 'التقرير اليومي للإدارة') + '</h2></div><div class="rh-act">' +
        '<button class="btn sm" data-dxls aria-label="Excel">' + ICON_XLS + '<span class="bt-txt">Excel</span></button><button class="btn sm" data-dprt aria-label="طباعة">' + ICON.print + '<span class="bt-txt">طباعة / PDF</span></button>' + (canEdit() ? '<button class="btn sm ghost" data-dcustom aria-label="تخصيص الأسطر">' + ICON_EDIT + '<span class="bt-txt">تخصيص</span></button>' : '') + '</div></div>' +
        '<div class="day-nav"><button class="iconbtn" data-dprev aria-label="اليوم السابق" title="اليوم السابق"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button><label class="day-date">' + ICON_CAL + '<input type="date" class="input num" id="ddate" value="' + D.date + '"></label><button class="iconbtn" data-dnext aria-label="اليوم التالي" title="اليوم التالي"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>' +
        '<span class="day-lbl">' + esc(DOW[new Date(d2t(D.date)).getUTCDay()] + ' ' + rangeText(D.date, D.date)) + '</span></div>' +
        '<div class="seg" role="group" aria-label="الأعمدة"><button class="seg-b' + (F.dailyMode !== 'days7' ? ' on' : '') + '" data-dmode="day">يوم واحد</button><button class="seg-b' + (F.dailyMode === 'days7' ? ' on' : '') + '" data-dmode="days7">آخر 7 أيام</button>' +
        '<button class="seg-b' + (F.dailyMtd ? ' on' : '') + '" data-dmtd>+ من بداية الشهر</button></div>' +
        fltPanelHTML(DASH_DIMS, F.dflt, 'daily') +
        (errs.length ? '<div class="msg err" style="margin-top:8px">أسطر فيها خطأ: ' + esc(errs.join('، ')) + (canEdit() ? '. صحّحها من «تخصيص الأسطر».' : '') + '</div>' : '') + '</div>';
      if (viewBr() === 'cmp') {
        branches().forEach(function (b) {
          h += '<div class="card scroll-x"><h3>' + esc(b.name) + '</h3><div class="daily-wrap">' + withBr(b.code, function () { return dailyTable(dailyData(), 'daily'); }) + '</div></div>';
        });
        h += '<div class="card scroll-x"><h3>الموحّد (كل الفروع)</h3><div class="daily-wrap">' + dailyTable(D, 'daily') + '</div>' +
          '<p class="small muted" style="margin:10px 0 0">الأرصدة والمخزون في نهاية اليوم، والمبيعات والتحصيل لليوم نفسه.</p></div>';
        return h;
      }
      h += '<div class="card scroll-x"><div class="daily-wrap">' + dailyTable(D, 'daily') + '</div>' +
        '<p class="small muted" style="margin:10px 0 0">الأرصدة والمخزون في نهاية اليوم، والمبيعات والتحصيل لليوم نفسه.</p></div>';
      return h;
    }
    function bindDaily(m) {
      var setD = function (d) { F.dailyDate = d; A.render(); };
      q('#ddate', m).onchange = function () { if (this.value) setD(this.value); };
      qa('[data-dmode]', m).forEach(function (b) { b.onclick = function () { F.dailyMode = b.dataset.dmode; A.render(); }; });
      q('[data-dmtd]', m).onclick = function () { F.dailyMtd = !F.dailyMtd; A.render(); };
      q('[data-dprev]', m).onclick = function () { setD(addD(F.dailyDate || F.D.maxDate || today(), -1)); };
      q('[data-dnext]', m).onclick = function () { setD(addD(F.dailyDate || F.D.maxDate || today(), 1)); };
      bindFltPanel(m, 'daily', DASH_DIMS, function () { return F.dflt; }, function (f) { F.dflt = f; A.render(); });
      var cu = q('[data-dcustom]', m);
      if (cu) cu.onclick = function () { F.setTab = 'daily'; go('settings'); };
      q('[data-dxls]', m).onclick = function () { exportDaily(); };
      q('[data-dprt]', m).onclick = function () {
        var D = dailyData(), P = document.getElementById('print');
        P.innerHTML = '<div class="p-rep p-daily"><div class="p-head"><img src="logo.png" alt=""><div class="t"><b>' + esc(D.def.title || 'التقرير اليومي للإدارة') + '</b><span>شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + esc(D.date) + '</span></div><span class="p-copy">' + esc('طُبع ' + RK.nowStr().slice(0, 16)) + '</span></div>' +
          (noteF({ flt: F.dflt }) ? '<p class="p-note">' + esc(noteF({ flt: F.dflt })) + '</p>' : '') + dailyTable(D, 'daily pd') + '<p class="p-note">من بيانات سراج حتى ' + esc((F.meta && F.meta.last) || '') + '</p></div>';
        setTimeout(function () { window.print(); }, 150);
      };
    }
    // Excel منسّق (برتقالي وكحلي مثل نموذج الإدارة)
    var XS = {
      border: { top: { style: 'thin', color: { rgb: 'A6A6A6' } }, bottom: { style: 'thin', color: { rgb: 'A6A6A6' } }, left: { style: 'thin', color: { rgb: 'A6A6A6' } }, right: { style: 'thin', color: { rgb: 'A6A6A6' } } },
      font: function (o) { return Object.assign({ name: 'Calibri', sz: 11 }, o || {}); }
    };
    function xcell(v, s, z) { var c = { v: v === null || v === undefined ? '' : v, t: typeof v === 'number' ? 'n' : 's', s: s }; if (z && c.t === 'n') { c.z = z; s.numFmt = z; } return c; }
    function exportDaily() {
      A.withXLSX().then(function (X) {
        var D = dailyData(), ws = {}, R0 = 0, nc = D.cols.length + 1;
        var put = function (r, c, cell) { ws[X.utils.encode_cell({ r: r, c: c })] = cell; };
        put(0, 0, xcell(D.def.title || 'التقرير اليومي للإدارة', { font: XS.font({ bold: true, sz: 14, color: { rgb: '1F3864' } }) }));
        put(1, 0, xcell('شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + D.date + (noteF({ flt: F.dflt }) ? ' · ' + noteF({ flt: F.dflt }) : ''), { font: XS.font({ color: { rgb: '595959' } }) }));
        R0 = 3;
        var hs = { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }), fill: { fgColor: { rgb: 'ED7D31' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: XS.border };
        put(R0, 0, xcell('Subject', hs)); D.cols.forEach(function (c, j) { put(R0, j + 1, xcell(c.l, Object.assign({}, hs))); });
        D.def.rows.forEach(function (r, i) {
          var rr = R0 + 1 + i;
          if (!itemF(r)) { put(rr, 0, xcell(r.name, { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' } }), fill: { fgColor: { rgb: '0C4CA2' } }, border: XS.border })); for (var j = 1; j < nc; j++) put(rr, j, xcell('', { fill: { fgColor: { rgb: '0C4CA2' } }, border: XS.border })); return; }
          put(rr, 0, xcell(r.name, { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' } }), fill: { fgColor: { rgb: '1F3864' } }, alignment: { vertical: 'center' }, border: XS.border }));
          D.vals.forEach(function (v, j) {
            var x = v[i], z = r.fmt === 'int' || r.fmt === 'money0' ? '#,##0' : r.fmt === 'money' ? '#,##0.000' : r.fmt === 'pct' ? '0.0"%"' : '#,##0.00';
            put(rr, j + 1, xcell(x.err ? 'خطأ' : Math.round(x.v * 1000) / 1000, { font: XS.font({ sz: 12 }), alignment: { horizontal: 'center' }, border: XS.border }, z));
          });
        });
        ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: R0 + D.def.rows.length, c: nc - 1 } });
        ws['!cols'] = [{ wch: 30 }].concat(D.cols.map(function () { return { wch: 18 }; }));
        ws['!rows'] = []; ws['!rows'][R0] = { hpt: 22 };
        var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Daily');
        download(X, wb, 'rakan-daily-' + D.date + '.xlsx');
      }).catch(function (e) { toast(e.message, true); });
    }
    function download(X, wb, fname) {
      var blob = new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }

    /* ---------- الرسوم ---------- */
    var COLORS = ['#0C4CA2', '#F15C22', '#2E9E6A', '#7A5AF8', '#C2410C'];
    /* ---------- الرسوم البيانية: تُرسم بالعرض الفعلي للبطاقة حتى لا تتداخل النصوص ---------- */
    var CHARTS = {}, chartSeq = 0, measCtx = null;
    function chartSVG(ch, rows) {
      if (ch.rowsOverride) rows = ch.rowsOverride;
      rows = rows.filter(function (r) { return !r._b || ch.type !== 'hbar'; }).slice(0, ch.limit || rows.length);
      if (!rows.length) return '';
      var id = 'ch' + (++chartSeq); CHARTS[id] = { ch: ch, rows: rows };
      var legend = ch.y.length > 1 ? '<div class="legend">' + ch.y.map(function (k, i) { return '<span><i style="background:' + COLORS[i % COLORS.length] + '"></i>' + esc(ch.yl[i]) + '</span>'; }).join('') + '</div>' : '';
      return legend + '<div class="chart-box" data-cid="' + id + '">' + drawChart(ch, rows, 640) + '</div>';
    }
    function textW(t, px, bold) {
      try { if (typeof document !== 'undefined') { measCtx = measCtx || document.createElement('canvas').getContext('2d'); measCtx.font = (bold ? '700 ' : '400 ') + px + 'px RkNum, Tajawal, sans-serif'; return measCtx.measureText(String(t)).width; } } catch (e) {}
      return String(t).length * px * 0.56;
    }
    function fitText(t, px, maxW) { t = String(t); if (textW(t, px) <= maxW) return t; while (t.length > 2 && textW(t + '…', px) > maxW) t = t.slice(0, -1); return t + '…'; }
    function niceTicks(min, max, n) {
      if (min === max) { if (max === 0) max = 1; else if (max > 0) min = 0; else max = 0; }
      var raw = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), e = raw / mag;
      var step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag, lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step, out = [];
      for (var v = lo; v <= hi + step / 2; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : v);
      return out;
    }
    function axisUnit(maxAbs) { return maxAbs >= 1e6 ? [1e6, 'بالمليون'] : maxAbs >= 1e4 ? [1e3, 'بالألف'] : [1, '']; }
    function unitNum(v, u) { var x = v / u; return (Math.abs(x) >= 100 || u === 1 ? Math.round(x) : Math.round(x * 10) / 10).toLocaleString('en-US'); }
    function svgEsc(t) { return esc(String(t)); }
    function drawChart(ch, rows, W) {
      W = Math.max(260, Math.round(W)); var small = W < 480, fs = small ? 11.5 : 12.5, C0 = COLORS;
      var vals = []; rows.forEach(function (r) { ch.y.forEach(function (k) { vals.push(Number(r[k]) || 0); }); });
      var max = Math.max.apply(null, vals.concat([0])), min = Math.min.apply(null, vals.concat([0])), maxAbs = Math.max(Math.abs(max), Math.abs(min));
      var tipOf = function (r, k, v) { return svgEsc(r[ch.x]) + (ch.y.length > 1 ? ' · ' + svgEsc(ch.yl[ch.y.indexOf(k)] || '') : '') + ': ' + fk(v); };
      if (ch.type === 'hbar') {
        var rh = small ? 30 : 32, vw = textW(fk(maxAbs), fs) + 10, lw = Math.min(Math.max.apply(null, rows.map(function (r) { return textW(r[ch.x], fs); })) + 8, W * (small ? 0.42 : 0.36)), bx = W - lw - 8, area = Math.max(40, bx - vw - 4);
        var out = rows.map(function (r, i) {
          var v = Number(r[ch.y[0]]) || 0, w = Math.max(2, Math.abs(v) / (maxAbs || 1) * area), yy = i * rh;
          return '<g><title>' + tipOf(r, ch.y[0], v) + '</title><text x="' + (W - 2) + '" y="' + (yy + rh / 2 + 4) + '" text-anchor="start" class="cl" style="direction:rtl;unicode-bidi:plaintext">' + svgEsc(fitText(r[ch.x], fs, lw - 6)) + '</text>' +
            '<rect x="' + (bx - w) + '" y="' + (yy + 7) + '" width="' + w + '" height="' + (rh - 14) + '" rx="4" fill="' + (v < 0 ? C0[1] : C0[0]) + '"></rect>' +
            '<text x="' + (bx - w - 6) + '" y="' + (yy + rh / 2 + 4) + '" text-anchor="end" class="cv">' + fk(v) + '</text></g>';
        }).join('');
        var hh = rows.length * rh;
        return '<svg class="chart hb" width="100%" viewBox="0 0 ' + W + ' ' + hh + '" role="img" direction="ltr" style="direction:ltr;font-size:' + fs + 'px">' + out + '</svg>';
      }
      var ticks = niceTicks(min, max, small ? 4 : 5), tmin = ticks[0], tmax = ticks[ticks.length - 1], u = axisUnit(Math.max(Math.abs(tmin), Math.abs(tmax)));
      var tl = ticks.map(function (v) { return unitNum(v, u[0]); }), pl = Math.max.apply(null, tl.map(function (t) { return textW(t, fs - 0.5); })) + 12, pr = 10, pt = u[1] ? 22 : 12;
      // تسميات المحور الأفقي: نحذف السنة إن كانت واحدة لكل الأعمدة، ونميل التسميات أو نتخطى بعضها إذا ضاق المكان
      var labels = rows.map(function (r) { return String(r[ch.x] == null ? '' : r[ch.x]).replace(/^أسبوع /, ''); }), yearCap = '';
      // تواريخ: أسبوع «من – إلى» أو يوم ← يوم/شهر، والسنة في العنوان
      var dm = labels.map(function (l) { return l.match(/^(\d{4})-(\d\d)-(\d\d)(?:\s*[–-]\s*\d{4}-\d\d-\d\d)?$/); });
      if (labels.length > 1 && dm.every(Boolean)) { labels = dm.map(function (m) { return +m[3] + '/' + +m[2]; }); if (dm.every(function (m) { return m[1] === dm[0][1]; })) yearCap = dm[0][1]; }
      var ym = labels.map(function (l) { var m = l.match(/^(.+?)\s+(\d{4})$/); return m ? m : null; });
      if (ym.every(Boolean) && ym.every(function (m) { return m[2] === ym[0][2]; }) && labels.length > 1) { labels = ym.map(function (m) { return m[1]; }); yearCap = ym[0][2]; }
      var n = rows.length, iw = W - pl - pr, bw = iw / n, lwMax = Math.max.apply(null, labels.map(function (l) { return textW(l, fs); }));
      var rot = lwMax + 10 > bw, step = rot ? Math.max(1, Math.ceil((fs + 4) / (bw * 0.574))) : 1, cut = small ? 86 : 120;
      var lab = labels.map(function (l) { return rot ? fitText(l, fs, cut) : l; }), lw2 = Math.max.apply(null, lab.map(function (l) { return textW(l, fs); }));
      var pb = rot ? Math.ceil(lw2 * 0.574 + fs * 0.82 + 14) : fs + 16, H = (small ? 190 : 230) + pb + pt, ih = H - pt - pb;
      var y = function (v) { return pt + ih - (v - tmin) / ((tmax - tmin) || 1) * ih; };
      var g = ticks.map(function (v, i) { var yy = y(v); return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + yy + '" y2="' + yy + '" class="' + (v === 0 ? 'gl0' : 'gl') + '"></line><text x="' + (pl - 7) + '" y="' + (yy + 4) + '" text-anchor="end" class="cv">' + tl[i] + '</text>'; }).join('');
      var cap = (u[1] || yearCap) ? '<text x="' + (W - pr) + '" y="13" text-anchor="start" class="cap" style="direction:rtl;unicode-bidi:plaintext">' + svgEsc([u[1] ? 'القيم ' + u[1] : '', yearCap ? 'سنة ' + yearCap : ''].filter(Boolean).join(' · ')) + '</text>' : '';
      var cx = function (i) { return pl + bw * i + bw / 2; }, base = H - pb + fs + 6;
      var xl = lab.map(function (l, i) {
        if (i % step && i !== n - 1) return ''; if (i === n - 1 && i % step && (n - 1) % step < step / 2 && n > step) return '';
        return rot ? '<text x="' + cx(i) + '" y="' + (H - pb + 12) + '" text-anchor="start" class="cl" transform="rotate(-35 ' + cx(i) + ' ' + (H - pb + 12) + ')" style="direction:rtl;unicode-bidi:plaintext">' + svgEsc(l) + '</text>'
          : '<text x="' + cx(i) + '" y="' + base + '" text-anchor="middle" class="cl" style="direction:rtl;unicode-bidi:plaintext">' + svgEsc(l) + '</text>';
      }).join('');
      var body = '', ns = ch.y.length;
      if (ch.type === 'line') {
        ch.y.forEach(function (k, j) {
          var pts = rows.map(function (r, i) { return cx(i).toFixed(1) + ',' + y(Number(r[k]) || 0).toFixed(1); }).join(' ');
          body += '<polyline points="' + pts + '" fill="none" stroke="' + C0[j % C0.length] + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>';
          if (n <= 60) rows.forEach(function (r, i) { var v = Number(r[k]) || 0; body += '<circle cx="' + cx(i) + '" cy="' + y(v) + '" r="' + (n <= 24 ? 3.5 : 2.5) + '" fill="#fff" stroke="' + C0[j % C0.length] + '" stroke-width="2"><title>' + tipOf(r, k, v) + '</title></circle>'; });
        });
      } else {
        var gw = Math.min(bw * 0.74, 46 * ns), sw = gw / ns, showV = ns === 1 && sw >= 26 && n <= 16, y0 = y(0 < tmin ? tmin : 0 > tmax ? tmax : 0);
        rows.forEach(function (r, i) {
          ch.y.forEach(function (k, j) {
            var v = Number(r[k]) || 0, y1 = y(v), x0 = pl + bw * i + (bw - gw) / 2 + sw * j;
            body += '<rect x="' + x0.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + Math.max(1, sw - (ns > 1 ? 2 : 0)).toFixed(1) + '" height="' + Math.max(1, Math.abs(y1 - y0)).toFixed(1) + '" rx="3" fill="' + (ns === 1 && v < 0 ? C0[1] : C0[j % C0.length]) + '"><title>' + tipOf(r, k, v) + '</title></rect>';
            if (showV && v) { var tv = unitNum(v, u[0]); if (textW(tv, fs - 1) < sw + 6) body += '<text x="' + (x0 + sw / 2) + '" y="' + (v >= 0 ? y1 - 5 : y1 + fs + 2) + '" text-anchor="middle" class="cvb">' + tv + '</text>'; }
          });
        });
      }
      return '<svg class="chart" width="100%" viewBox="0 0 ' + W + ' ' + H + '" role="img" direction="ltr" style="direction:ltr;font-size:' + fs + 'px">' + cap + g + body + xl + '</svg>';
    }
    function fitCharts() {
      if (typeof document === 'undefined') return;
      var live = {};
      qa('.chart-box[data-cid]', document).forEach(function (el) {
        var id = el.dataset.cid, sp = CHARTS[id]; live[id] = 1; if (!sp) return;
        var w = el.clientWidth; if (!w || Math.abs(w - (el._w || 0)) < 3) return;
        el._w = w; el.innerHTML = drawChart(sp.ch, sp.rows, w);
      });
      Object.keys(CHARTS).forEach(function (k) { if (!live[k] && +k.slice(2) < chartSeq - 40) delete CHARTS[k]; });
    }
    if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined' && !window.__rkChartObs) {
      var fitQ = 0, queueFit = function () { if (fitQ) return; fitQ = 1; requestAnimationFrame(function () { fitQ = 0; fitCharts(); }); };
      window.__rkChartObs = new MutationObserver(function (ms) { for (var i = 0; i < ms.length; i++) if (ms[i].addedNodes.length) { queueFit(); return; } });
      window.__rkChartObs.observe(document.body || document.documentElement, { childList: true, subtree: true });
      window.addEventListener('resize', queueFit);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { qa('.chart-box', document).forEach(function (el) { el._w = 0; }); fitCharts(); });
    }
    function short(v) { var a = Math.abs(v); return (a >= 1e6 ? (v / 1e6).toFixed(1) + 'م' : a >= 1e3 ? (v / 1e3).toFixed(0) + 'أ' : fk(v)); }

    function backBtnHTML() {
      var pk = window.RKNav && RKNav.peek(), to = 'التقارير';
      if (pk) to = pk.fin && pk.fin.cur ? (pk.fin.cur.custom ? pk.fin.cur.custom.name : (R[pk.fin.cur.id] || {}).name || 'التقرير السابق') : pk.tab === 'reports' ? 'التقارير' : RKNav.tabName(pk.tab) || 'السابق';
      return '<button class="hc-back2" data-back aria-label="رجوع إلى ' + esc(to) + '" title="رجوع إلى ' + esc(to) + '"><span class="hb-ar">→</span><span class="hb-t">' + esc(to) + '</span></button>';
    }
    // لقطة من حالة التقارير لسجل التنقل، واستعادتها عند الرجوع
    function navSnap() { return { cur: F.cur ? { id: F.cur.id, custom: F.cur.custom, p: JSON.parse(JSON.stringify(F.cur.p || {})), sort: F.cur.sort } : null, rcat: F.rcat, rq: F.rq, setTab: F.setTab }; }
    function navApply(s) { if (!s) { F.cur = null; return; } F.cur = s.cur ? { id: s.cur.id, custom: s.cur.custom, p: s.cur.p, sort: s.cur.sort } : null; F.rcat = s.rcat; F.rq = s.rq || ''; if (s.setTab) F.setTab = s.setTab; }
    function openReport(id, params, opt) {
      // نحفظ المكان الحالي (لوحة المؤشرات، قائمة التقارير، أو تقرير آخر) لنرجع إليه بنفس موضع التمرير
      if (!F.cur) F.catY = A.st.tab === 'reports' ? (window.scrollY || 0) : 0;
      if (window.RKNav && !(opt && opt.noPush)) RKNav.push();
      var def = id.indexOf('c:') === 0 ? F.reports.filter(function (r) { return 'c:' + r.id === id; })[0] : null;
      if (!def && !R[id]) { toast('التقرير غير موجود', true); return; }
      var t = today();
      var base = { preset: 'month', from: t.slice(0, 7) + '-01', to: t, asof: t, gran: 'day', level: 3, top: 0, rby: 'cust', vby: 'none', box: 'all', nonzero: 'nz', measure: 'value', idle: 30, boxkind: 'all', etype: 'all', flt: null };
      var saved = (st.finParams || {})[id] || {};
      if (def) (def.def.kind === 'ready' && R[def.def.base] ? R[def.def.base].sel || [] : []).forEach(function (x) { base[x[0]] = x[2][0][0]; });
      else (R[id].sel || []).forEach(function (x) { base[x[0]] = x[2][0][0]; });
      var dd0 = def ? (def.def.kind === 'ready' && R[def.def.base] ? R[def.def.base] : { params: ['period'] }) : R[id];
      if (dd0 && ((dd0.params.indexOf('asof') >= 0 && dd0.params.indexOf('period') < 0) || dd0.year) && !saved.preset) { base.preset = 'year'; base.from = t.slice(0, 4) + '-01-01'; }
      var p = Object.assign(base, def && def.def.p ? def.def.p : {}, saved, params || {});
      if (!(params && params.accs)) delete p.accs;   // حسابات البطاقة تُستعمل فقط عند الفتح من البطاقة
      var pin = pinnedFilter(), ddef = def ? (def.def.kind === 'ready' && R[def.def.base] ? R[def.def.base] : null) : R[id];
      if (!pin && p._pin) { p.flt = null; delete p._pin; }
      if (pin && ddef && ddef.params.indexOf('flt') >= 0 && !(params && params.flt)) { var pf = fltFor(pin.flt, fdimsFor(ddef)); if (pf) { p.flt = pf; p._pin = pin.name; } }
      if (def && !saved.view && def.def.view) p.view = JSON.parse(JSON.stringify(def.def.view));
      if (params && params.preset) { p.year = params.year || null; p.month = params.month || null; }
      var dd = def ? (def.def.kind === 'ready' && R[def.def.base] ? R[def.def.base] : { params: ['period'] }) : R[id];
      if (isCmp(p.preset) && dd.params.indexOf('period') < 0) p.preset = 'month';
      F.cur = { id: id, custom: def, p: p };
      go('reports');
      window.scrollTo(0, 0);
    }

    function curDef() { var c = F.cur; if (c.custom && c.custom.def.kind === 'ready' && R[c.custom.def.base]) return Object.assign({}, R[c.custom.def.base], { name: c.custom.name, desc: customDesc(c.custom.def) }); return c.custom ? { name: c.custom.name, desc: customDesc(c.custom.def), params: c.custom.def.kind === 'formula' ? ['period', 'flt'] : ['period'], fdims: DASH_DIMS } : R[c.id]; }
    function usesPrev(id) { var r = R[id]; if (r._up === undefined) r._up = /prevRange\(|custMetrics\(/.test(String(r.run)) && r.params.indexOf('period') >= 0; return r._up; }
    function runCur() {
      var c = F.cur, p = c.p;
      if (p.preset && p.preset !== 'custom') { var r = presetRange(p.preset, p.from, p.to, p.year, p.month); p.from = r[0]; p.to = r[1]; }
      var fn = function (pp) { return c.custom ? runCustom(c.custom.def, pp) : R[c.id].run(pp); };
      var dp0 = curDef().params; if (dp0.indexOf('asof') >= 0 && dp0.indexOf('period') < 0 && p.to) p.asof = p.to;
      if (multiBr() && viewBr() === 'cmp') {
        var bs = branches(), pcsB = bs.map(function (b) { return { l: b.name, code: b.code }; });
        var oc = runCompare(function (pp, pc) { return withBr(pc.code, function () { return isCmp(pp.preset) && curDef().params.indexOf('period') >= 0 ? runCompare(fn, pp) : fn(pp); }); }, p, pcsB);
        c.rawCols = oc && oc.cols; return applyView(oc, p.view);
      }
      var dp = curDef().params; if (dp.indexOf('asof') >= 0 && dp.indexOf('period') < 0 && p.to) p.asof = p.to;
      var sp = splitInfo(p.flt), out;
      if (sp && p.gsplit === 'cols' && !isCmp(p.preset)) {
        out = runCompare(function (pp, pc) { var f2 = Object.assign({}, parseFilter(pp.flt)); f2[sp.key] = ['@' + pc.code]; return fn(Object.assign({}, pp, { flt: f2 })); }, p, sp.vals.map(function (v) { return { l: sp.name(v), code: v }; }));
        if (out && out.note) out.note = out.note.replace('مقارنة الفروع حسب', 'مقارنة ' + sp.title + ' المحددة حسب');
        if (out) out._split = sp.key;
      } else out = isCmp(p.preset) && curDef().params.indexOf('period') >= 0 ? runCompare(fn, p) : fn(p);
      if (multiBr() && out && !out.empty) out.note = brNote() + (out.note ? ' · ' + plain(out.note) : '');
      // تقارير تقارن بالفترة السابقة: تنبيه إذا كانت الفترة السابقة قبل بداية البيانات
      if (out && !out.empty && !c.custom && R[c.id] && usesPrev(c.id) && p.from) { var pr0 = prevRange(p.from, p.to, p.preset); if (pr0[0] < dataStart()) out.note = 'لا توجد بيانات للفترة السابقة (' + rangeText(pr0[0], pr0[1]) + ') لأن بيانات المنظومة تبدأ من ' + rangeText(dataStart(), dataStart()) + '، فأعمدة المقارنة صفر' + (out.note ? ' · ' + out.note : ''); }
      c.rawCols = out && out.cols; var vw = applyView(out, p.view); if (out && out._split) return vw; var g1 = groupBySel(vw, p.flt, c.id && R[c.id] && R[c.id].cat === 'cgrp' ? 'none' : grpMode(p)); return g1 && g1._grouped ? g1 : itemGroupBy(g1, p.flt, p.igx);
    }
    // مقارنة الأرباع أو الأشهر: يُشغَّل التقرير لكل فترة، ويُعرض رقم واحد يختاره المستخدم في عمود لكل فترة
    var CMP_PREF = ['net', 'tot', 'v', 'a', 'sales', 'val', 'inn', 'pur', 'qty', 'q', 'dr', 'n'];
    var CMP_NOSUM = /^(close|bal|open|avg|avgp|margin|share|rp|cr|ch|cover|lim|cost|p|min|max|spread|daily|age)$/;
    // pcsIn: أعمدة جاهزة (الفروع)؛ بدونها تكون الأعمدة فترات (أرباع أو أشهر)
    function runCompare(fn, p, pcsIn) {
      var pcs = pcsIn || comparePeriods(p.preset, p.year);
      if (!pcs.length) return { cols: [C('m', '')], rows: [], empty: 'لا توجد فترات للمقارنة في هذه السنة' };
      var res = pcs.map(function (c) { return pcsIn ? fn(p, c) : fn(Object.assign({}, p, { preset: 'custom', from: c.from, to: c.to })); });
      var base = res.filter(function (r) { return r && r.cols && r.cols.length > 1 && !r.empty; })[0];
      if (!base) return res[0];
      var nums = base.cols.filter(function (c) { return isNum(c); });
      if (!nums.length) return { cols: [C('m', '')], rows: [], empty: 'هذا التقرير لا يحتوي أرقاماً للمقارنة' };
      var mk = nums.filter(function (c) { return c.k === p.cmpcol; })[0] || CMP_PREF.map(function (k) { return nums.filter(function (c) { return c.k === k; })[0]; }).filter(Boolean)[0] || nums[0];
      var firstNum = base.cols.indexOf(nums[0]), keyCols = base.cols.slice(0, Math.max(1, Math.min(2, firstNum))).filter(function (c) { return !isNum(c); });
      var rows = [], idx = {};
      res.forEach(function (r, j) {
        (r.rows || []).forEach(function (row) {
          var key = keyCols.map(function (c) { return plain(row[c.k]); }).join('|');
          var o = idx[key];
          if (!o) { o = idx[key] = { _lvl: row._lvl, _b: row._b, _hl: row._hl, _acc: row._acc, _fmt: row._fmt }; keyCols.forEach(function (c) { o[c.k] = row[c.k]; }); rows.push(o); }
          var v = row[mk.k]; if (typeof v === 'number') o['p' + j] = (o['p' + j] || 0) + v;
        });
      });
      var sumOk = mk.t !== 'pct' && !CMP_NOSUM.test(mk.k);
      rows.forEach(function (o) {
        if (sumOk) o.tot = pcs.reduce(function (sm, c, j) { return sm + (o['p' + j] || 0); }, 0);
        var n = pcs.length; if (n > 1 && typeof o['p' + (n - 1)] === 'number' && o['p' + (n - 2)]) o.chg = (o['p' + (n - 1)] - o['p' + (n - 2)]) / Math.abs(o['p' + (n - 2)]) * 100;
      });
      var cols = keyCols.concat(pcs.map(function (c, j) { return C('p' + j, c.l, mk.t); }));
      if (sumOk) cols.push(C('tot', 'الإجمالي', mk.t));
      if (pcs.length > 1 && !pcsIn) cols.push(C('chg', 'تغيّر آخر فترة', 'pct'));
      var total = null;
      if (res.some(function (r) { return r.total && typeof r.total[mk.k] === 'number'; })) {
        total = { name: 'الإجمالي' };
        pcs.forEach(function (c, j) { var t = res[j].total; total['p' + j] = t && typeof t[mk.k] === 'number' ? t[mk.k] : null; });
        if (sumOk) total.tot = pcs.reduce(function (sm, c, j) { return sm + (total['p' + j] || 0); }, 0);
        var n2 = pcs.length; if (n2 > 1 && total['p' + (n2 - 2)]) total.chg = (total['p' + (n2 - 1)] - total['p' + (n2 - 2)]) / Math.abs(total['p' + (n2 - 2)]) * 100;
      }
      var chartRows = pcs.map(function (c, j) { return { name: c.l, v: total ? total['p' + j] || 0 : rows.reduce(function (sm, o) { return sm + (o._b ? 0 : o['p' + j] || 0); }, 0) }; });
      return { cols: cols, rows: rows, total: total, cmp: { cols: nums.map(function (c) { return [c.k, c.l]; }), mk: mk.k },
        chart: { type: 'bar', x: 'name', y: ['v'], yl: [mk.l], rowsOverride: chartRows }, note: (pcsIn ? 'مقارنة الفروع حسب: ' : 'المقارنة حسب: ') + mk.l + (base.note ? ' · ' + plain(base.note) : '') };
    }

    /* ---------- التصفية (عملاء، أصناف، مخازن…) ---------- */
    // البُعد ← مفتاح التصفية، والعنوان، ونص زر الإضافة
    var DIM = { cust: ['cust', 'العملاء', 'عميل', 'عملاء محددون بالاسم'], supp: ['cust', 'الموردون', 'مورد', 'موردون محددون بالاسم'], item: ['item', 'الأصناف', 'صنف', 'أصناف محددة'], st: ['st', 'المخازن', 'مخزن', 'مخزن أو سيارة'], ag: ['ag', 'المناديب', 'مندوب', 'مناديب محددون'],
      cacc: ['cacc', 'حسابات العملاء', 'حساب عملاء', 'كل العملاء تحت حساب رئيسي أو فرعي من الدليل'], cgrp: ['cgrp', 'مجموعات العملاء', 'مجموعة عملاء', 'المجموعات المعرّفة في الإعدادات'],
      cat: ['cat', 'فئات المناديب', 'فئة مندوب', 'جملة، تجزئة، أسواق…'], u: ['u', 'المستخدمون', 'مستخدم', 'من أدخل الفاتورة'],
      xcust: ['xcust', 'استثناء العملاء', 'استثناء عميل', 'إخفاء عملاء محددين'], xcacc: ['xcacc', 'استثناء حسابات العملاء', 'استثناء حساب عملاء', 'إخفاء كل العملاء تحت حساب'], xcgrp: ['xcgrp', 'استثناء مجموعات العملاء', 'استثناء مجموعة', 'إخفاء مجموعة عملاء'],
      xcat: ['xcat', 'استثناء فئات المناديب', 'استثناء فئة', 'إخفاء فئة مناديب'], xitem: ['xitem', 'استثناء الأصناف', 'استثناء صنف', 'إخفاء أصناف محددة'],
      icl: ['icl', 'تصنيفات الأصناف', 'تصنيف أصناف', 'الشركة أو الفئة من شجرة تصنيفات سراج'], igrp: ['igrp', 'مجموعات الأصناف', 'مجموعة أصناف', 'المجموعات المعرّفة في الإعدادات وفي سراج'],
      xicl: ['xicl', 'استثناء تصنيفات الأصناف', 'استثناء تصنيف', 'إخفاء تصنيف أصناف'], xigrp: ['xigrp', 'استثناء مجموعات الأصناف', 'استثناء مجموعة أصناف', 'إخفاء مجموعة أصناف'] };
    var FDIMS = {}; Object.keys(DIM).forEach(function (k) { FDIMS[k] = DIM[k][1]; });
    function fdimsFor(def) { return normDims(def.fdims || (def.cat === 'stock' ? ['item', 'st', 'xitem'] : def.cat === 'purch' ? ['supp', 'item', 'st', 'u'] : ['cust', 'item', 'st', 'ag', 'cat', 'u', 'xcust', 'xitem'])); }
    // كل تقرير فيه تصفية العميل يأخذ معها حسابات العملاء ومجموعاتهم، وكل تقرير فيه المندوب يأخذ فئات المناديب
    function normDims(d) {
      var o = d.slice(), add = function (after, k) { if (o.indexOf(k) >= 0) return; var i = o.indexOf(after); o.splice(i < 0 ? o.length : i + 1, 0, k); };
      if (o.indexOf('cust') >= 0) { add('cust', 'cacc'); add('cacc', 'cgrp'); }
      if (o.indexOf('xcust') >= 0) { add('xcust', 'xcacc'); add('xcacc', 'xcgrp'); }
      if (o.indexOf('item') >= 0) { add('item', 'icl'); add('icl', 'igrp'); }
      if (o.indexOf('xitem') >= 0) { add('xitem', 'xicl'); add('xicl', 'xigrp'); }
      if (o.indexOf('ag') >= 0) { add('ag', 'cat'); if (o.indexOf('xcust') >= 0 || o.indexOf('xitem') >= 0) add(o.indexOf('xitem') >= 0 ? 'xitem' : 'xcgrp', 'xcat'); }
      return o;
    }
    function fltOptions(dim) {
      var Tt = T(), out = [], seen = {};
      var addAcc = function (id, name) { if (seen[id] || !id) return; seen[id] = 1; var a = acc(id); out.push({ id: '@' + id, name: name || (a ? a.name : id), sub: a ? a.code : '' }); };
      if (dim === 'cust' || dim === 'xcust') { F.D.invs.forEach(function (v) { if (v.c === SALE || v.c === SRET) addAcc(v.ck, v.name); }); recvIds().forEach(function (id) { addAcc(id); }); }
      else if (dim === 'supp') { F.D.invs.forEach(function (v) { if (v.c === PUR || v.c === PRET) addAcc(v.ck, v.name); }); payIds().forEach(function (id) { addAcc(id); }); }
      else if (dim === 'item' || dim === 'xitem') {
        var used = {}; Tt.invl.forEach(function (l) { used[l.item] = 1; });
        Object.keys(Tt.item).forEach(function (id) { if (used[id]) out.push({ id: '@' + id, name: itemName(id), sub: String(Tt.item[id].code || '') }); });
      } else if (dim === 'st' || dim === 'xst') {
        var mix = stMixed(), bro = {}; branches().forEach(function (b, i) { bro[b.code] = i; });
        return Object.keys(Tt.st).map(function (id) { var b = stBr(id); return { id: '@' + id, name: storeName(id), grp: mix ? brName(b) : '', go: mix ? (bro[b] !== undefined ? bro[b] : 99) : 0 }; })
          .sort(function (a, b) { return (a.go - b.go) || String(a.name).localeCompare(String(b.name), 'ar'); });
      }
      else if (dim === 'ag') Object.keys(Tt.ag).forEach(function (id) { out.push({ id: '@' + id, name: repName(id) }); });
      else if (dim === 'cat' || dim === 'xcat') repCats().forEach(function (c) { out.push({ id: '@' + c, name: c }); });
      else if (dim === 'cgrp' || dim === 'xcgrp') { cgList().forEach(function (g, i) { out.push({ id: '@' + g.id, name: g.name, sub: (g.codes || []).join('، '), ord: i }); }); out.push({ id: '@' + CG_NONE, name: 'بدون مجموعة', ord: 999 }); return out; }
      else if (dim === 'icl' || dim === 'xicl') { return iclTree().map(function (c) { return { id: '@' + c.id, name: c.name, sub: (c.code || '') + ' · ' + c.n + ' صنف', lvl: c.lvl }; }); }
      else if (dim === 'igrp' || dim === 'xigrp') { return igrpList().map(function (g) { return { id: '@' + g.id, name: g.name, sub: g.sub }; }); }
      else if (dim === 'cacc' || dim === 'xcacc') { var tr = custTreeAccs(), base = tr.length ? Math.min.apply(null, tr.map(function (a) { return a.lvl; })) : 1; return tr.map(function (a) { return { id: '@' + a.id, name: a.name, sub: a.code + ' · ' + a.kids.length + ' فرع', lvl: a.lvl - base }; }); }
      else if (dim === 'u') Object.keys(Tt.us).forEach(function (id) { out.push({ id: '@' + id, name: userName(id) }); });
      return out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); });
    }
    function fObj(f) { return f && typeof f === 'object' ? f : (parseFilter(f) || {}); }
    function fCount(f) { f = fObj(f); return Object.keys(f).reduce(function (n, k) { return n + ((f[k] && f[k].length) || 0); }, 0); }
    // شريط التصفية: كل تصفية مطبّقة مجموعة بعنوانها وقيمها (كل قيمة تُحذف وحدها)، وزر «إضافة تصفية» يفتح قائمة مرتبة: عرض فقط / استثناء
    function fltPanelHTML(dims, f, key) {
      f = fObj(f);
      var applied = dims.filter(function (d) { var v = f[DIM[d][0]]; return v && v.length; });
      applied = applied.filter(function (d, i) { return applied.map(function (x) { return DIM[x][0]; }).indexOf(DIM[d][0]) === i; });
      var inc = dims.filter(function (d) { return !/^x/.test(d); }), exc = dims.filter(function (d) { return /^x/.test(d); });
      var tile = function (d) { var n = (f[DIM[d][0]] || []).length; return '<button class="fx-tile' + (/^x/.test(d) ? ' x' : '') + (n ? ' on' : '') + '" data-fadd="' + key + '|' + d + '"><b>' + esc(DIM[d][1]) + (n ? ' <span class="fx-n">' + n + '</span>' : '') + '</b><span>' + esc(DIM[d][3] || '') + '</span></button>'; };
      var open = F.fpOpen && F.fpOpen[key];
      return '<div class="fx' + (applied.length ? ' has' : '') + '"><div class="fx-bar"><span class="fx-t">' + ICON_FILTER + ' التصفية' + (applied.length ? ' <span class="fp-cnt">' + fCount(f) + '</span>' : '') + '</span>' +
        (applied.length ? '<div class="fp-applied fx-list">' + applied.map(function (d) {
          var k = DIM[d][0], v = f[k];
          return '<div class="fx-grp' + (/^x/.test(k) ? ' x' : '') + '"><button class="fx-k" data-fedit="' + key + '|' + d + '" title="تعديل">' + esc(DIM[d][1]) + ' ▾</button>' + v.map(function (x, i) {
            return '<span class="fp-tag' + (/^x/.test(k) ? ' x' : '') + '">' + esc(fltName(k, x)) + '<button aria-label="إزالة" data-frm="' + key + '|' + k + '|' + i + '">×</button></span>';
          }).join('') + '</div>';
        }).join('') + '</div>' : '<span class="fx-none small muted">بدون تصفية: يُعرض الكل</span>') +
        '<details class="fp fx-menu" data-fp="' + key + '"' + (open ? ' open' : '') + '><summary class="fx-add">+ إضافة تصفية</summary><div class="fx-pop">' +
        '<div class="fx-sec">عرض فقط</div><div class="fx-tiles">' + inc.map(tile).join('') + '</div>' +
        (exc.length ? '<div class="fx-sec x">استثناء (إخفاء)</div><div class="fx-tiles">' + exc.map(tile).join('') + '</div>' : '') + '</div></details>' +
        (savedFilters().length ? '<button class="fx-saved" data-fload="' + key + '">الفلاتر الجاهزة <span class="fx-n">' + savedFilters().length + '</span></button>' : '') +
        (applied.length ? '<button class="fx-save" data-fsave="' + key + '">☆ حفظ كفلتر جاهز</button><button class="fx-clear" data-fclr="' + key + '">مسح الكل</button>' : '') + '</div></div>';
    }
    function bindFltPanel(m, key, dims, getF, setF) {
      var dt = q('[data-fp="' + key + '"]', m); if (dt) dt.addEventListener('toggle', function () { F.fpOpen = F.fpOpen || {}; F.fpOpen[key] = dt.open; });
      var pick = function (d) {
        var k = DIM[d][0], f = Object.assign({}, fObj(getF()));
        F.fpOpen = F.fpOpen || {}; F.fpOpen[key] = false;
        pickMulti({ title: (/^x/.test(d) ? '' : 'عرض فقط: ') + DIM[d][1], hint: DIM[d][3], options: fltOptions(d), value: f[k] || [], resolve: d === 'st' || d === 'xst' ? stResolve : null }).then(function (v) { if (!v) { A.render(); return; } f[k] = v; if (!v.length) delete f[k]; setF(fCount(f) ? f : null); });
      };
      qa('[data-fadd^="' + key + '|"], [data-fedit^="' + key + '|"]', m).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); pick((b.dataset.fadd || b.dataset.fedit).split('|')[1]); }; });
      qa('[data-frm^="' + key + '|"]', m).forEach(function (b) {
        b.onclick = function () { var p2 = b.dataset.frm.split('|'), f = Object.assign({}, fObj(getF())); f[p2[1]] = (f[p2[1]] || []).filter(function (x, i) { return i !== Number(p2[2]); }); if (!f[p2[1]].length) delete f[p2[1]]; setF(fCount(f) ? f : null); };
      });
      var c = q('[data-fclr="' + key + '"]', m);
      if (c) c.onclick = function () { setF(null); };
      var sv = q('[data-fsave="' + key + '"]', m); if (sv) sv.onclick = function () { saveCurrentFilter(getF()); };
      var ld = q('[data-fload="' + key + '"]', m); if (ld) ld.onclick = function () { pickSaved(dims).then(function (x) { if (!x) return; var f = fltFor(x.flt, dims); if (f) { setF(f); toast('طُبّق «' + x.name + '»'); } }); };
      // إغلاق القائمة عند الضغط خارجها
      if (dt && dt.open) setTimeout(function () { var h = function (e) { if (!dt.contains(e.target)) { dt.open = false; document.removeEventListener('click', h, true); } }; document.addEventListener('click', h, true); }, 0);
    }
    var ICON_FILTER = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" style="vertical-align:-3px"><path fill="currentColor" d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>';

    var ASOF_MOVE = { trial_bal: 1, coa: 1, recv_balances: 1, pay_balances: 1 };
    function paramsHTML(def, p) {
      var h = '';
      var has = function (k) { return def.params.indexOf(k) >= 0; };
      if (has('period')) h += periodHTML(p, 'rep');
      else if (has('asof')) h += periodHTML(p, 'rep') + '<div class="small muted asof-note">' + (ASOF_MOVE[(F.cur && ((F.cur.custom && F.cur.custom.def.base) || F.cur.id)) || ''] ? 'الفترة من ' + N(p.from || p.asof) + ' إلى ' + N(p.to || p.asof) + ((F.cur && F.cur.id) === 'trial_bal' ? '' : ': رصيد أول المدة وحركة الفترة والرصيد في نهايتها') : 'يُحسب حتى نهاية الفترة: ' + N(p.to || p.asof)) + '</div>';
      var sel = function (k, label, opts) { return '<label class="field fin-param"><span class="lbl">' + label + '</span><select class="input" data-pk="' + k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(p[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; };
      var row = '';
      if ((isCmp(p.preset) || (p.gsplit === 'cols' && splitInfo(p.flt))) && F.cur && F.cur.res && F.cur.res.cmp) { if (!p.cmpcol || !F.cur.res.cmp.cols.some(function (c) { return c[0] === p.cmpcol; })) p.cmpcol = F.cur.res.cmp.mk; row += sel('cmpcol', 'الرقم المقارن', F.cur.res.cmp.cols); }

      if (has('asof2')) row += '<label class="field fin-param"><span class="lbl">مقارنة بتاريخ</span><input type="date" class="input num" data-pk="asof2" value="' + esc(p.asof2 || addD(p.asof.slice(0, 4) + '-01-01', -1)) + '"></label>';
      if (has('gran')) row += sel('gran', 'التجميع', GRAN);
      if (has('level')) row += sel('level', 'المستوى', [[1, 'المستوى 1'], [2, 'المستوى 2'], [3, 'المستوى 3'], [4, 'المستوى 4'], [5, 'المستوى 5'], [6, 'كل المستويات']]);
      if (has('top')) row += sel('top', 'العرض', [[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50'], [100, 'أعلى 100']]);
      if (has('measure')) row += sel('measure', 'القيمة', [['value', 'صافي المبيعات (د.ل)'], ['qty', 'الكمية']]);
      if (has('rmeas')) row += sel('rmeas', 'القيمة', [['net', 'صافي المبيعات (د.ل)'], ['profit', 'مجمل الربح'], ['qty', 'الكمية'], ['n', 'عدد الفواتير']]);
      if (has('rep')) { var rl = Object.keys(T().ag).map(function (k) { return [k, repName(k) + ' · ' + repCat(k)]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'ar'); }); if (!p.rep && rl.length) p.rep = rl[0][0]; row += sel('rep', 'المندوب', rl); }
      if (has('rby')) row += sel('rby', 'حسب', [['cust', 'العميل'], ['item', 'الصنف']]);
      if (has('vby')) row += sel('vby', 'العرض', [['none', 'كل سند (تفصيلي)'], ['box', 'مجمّع حسب الصندوق/البنك'], ['party', 'مجمّع حسب الطرف'], ['day', 'مجمّع حسب اليوم']]);
      if (has('nonzero')) row += sel('nonzero', 'الأرصدة', [['nz', 'غير الصفرية فقط'], ['mv', 'من عليهم حركة في الفترة'], ['all', 'الكل']]);
      if (has('idle')) row += sel('idle', 'بلا شراء منذ', [[15, '15 يوماً'], [30, '30 يوماً'], [60, '60 يوماً'], [90, '90 يوماً'], [180, '180 يوماً']]);
      if (has('etype')) row += sel('etype', 'نوع القيد', [['all', 'الكل'], ['r', 'سندات القبض'], ['p', 'سندات الدفع'], ['j', 'قيود يومية'], ['i', 'قيود الفواتير'], ['o', 'افتتاحي']]);
      if (has('boxkind')) row += sel('boxkind', 'النوع', [['all', 'الصناديق والبنوك'], ['صندوق', 'الصناديق فقط'], ['بنك', 'البنوك فقط']]);
      if (has('box')) row += sel('box', 'الصندوق/البنك', [['all', 'كل الصناديق والبنوك (ملخص)']].concat(activeBoxes().map(function (b) { return [b.acc, b.name]; })));
      (def.sel || []).forEach(function (x) { row += sel(x[0], x[1], x[2]); });
      if (has('search')) row += '<label class="field fin-param"><span class="lbl">بحث</span><input class="input" data-pk="search" value="' + esc(p.search || '') + '" placeholder="رقم أو اسم"></label>';
      if (has('item1')) row += '<div class="field fin-param" style="flex:1 1 100%;max-width:520px"><span class="lbl">الصنف</span><button class="input" data-itempick style="text-align:start;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (p.item1 && T().item[p.item1] ? esc(itemName(p.item1)) : 'اختر الصنف…') + '</button></div>';
      if (has('cust1')) { var ck1 = c1Default(p); if (ck1) p.cust1 = ck1; row += '<div class="field fin-param" style="flex:1 1 100%;max-width:520px"><span class="lbl">العميل</span><button class="input" data-custpick style="text-align:start;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (ck1 ? esc(c1Sub(ck1)) : 'اختر العميل…') + '</button></div>'; }
      if (has('account')) row += '<div class="field fin-param" style="flex:2"><span class="lbl">الحساب</span><button class="input" data-accpick style="text-align:start">' + (p.account ? esc(acc(p.account) ? acc(p.account).code + ' · ' + acc(p.account).name : '—') : p.accs && p.accs.length ? esc(p.accs.map(function (c) { var a = F.D.byCode[c]; return c + ' · ' + (a ? a.name : ''); }).join('، ')) : 'اختر الحساب…') + '</button></div>';
      if (row) h += '<div class="fin-params">' + row + '</div>';
      if (has('flt')) h += fltPanelHTML(fdimsFor(def), p.flt, 'rep');
      return h;
    }

    function reportHTML() {
      var c = F.cur, def = curDef();
      if (!def) { F.cur = null; return catalogHTML(); }
      var res;
      try { res = runCur(); } catch (e) { res = { cols: [], rows: [], empty: 'تعذّر إعداد التقرير: ' + e.message }; if (window.console) console.error(e); }
      c.res = res;
      var p = c.p;
      var h = '<div class="card head-card"><div class="hc-top">' + backBtnHTML() + '<div class="grow"><h2>' + esc(res.title || def.name) + '</h2><div class="small muted hc-desc">' + esc(res.subtitle || def.desc || '') + '</div></div>' +
        '<div class="rh-act"><button class="btn sm" data-xls aria-label="Excel">' + ICON_XLS + '<span class="bt-txt">Excel</span></button><button class="btn sm" data-prt aria-label="طباعة">' + ICON.print + '<span class="bt-txt">طباعة</span></button>' + (c.custom && canEdit() ? '<button class="btn sm ' + (c.custom.tmp ? 'accent' : 'ghost') + '" data-edit aria-label="تعديل">' + ICON_EDIT + '<span class="bt-txt">' + (c.custom.tmp ? 'رجوع للتعديل والحفظ' : 'تعديل') + '</span></button>' : '') + '</div></div>' +
        (p._pin && p.flt ? '<div class="pin-note">📌 مُطبَّق الفلتر المثبّت «' + esc(p._pin) + '» · يُلغى من صفحة التقارير ← الفلاتر الجاهزة</div>' : '') + paramsHTML(def, p) + (res.empty && !hasView(p.view) ? '' : viewPanelHTML(res, p)) +
        (res.note ? '<div class="small muted rep-note">' + esc(plain(res.note)) + '</div>' : '') + (res._custRows ? '' : grpDefaultHTML()) + splitBarHTML(res, p) + '</div>';
      if (res.empty) return h + '<div class="card empty">' + esc(res.empty) + '</div>';
      if (res.kpis && res.kpis.length) h += repKpisHTML(res.kpis);
      if (res.chart && (res.chart.rowsOverride || res.rows.length > 1)) h += '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>';
      if (!res.rows.length && hasView(p.view)) return h + '<div class="card empty">لا توجد أسطر تطابق شروط التخصيص. عدّل الشروط أو اضغط «إلغاء كل التعديلات».</div>';
      h += '<div class="card scroll-x fin-table">' + (res._custRows ? grpBarHTML(res, p) : '') + (res._itemRows && !res._custRows ? igrpBarHTML(res, p) : '') + tableHTML(res) + '</div>';
      return h;
    }
    var FMT_SHORT = { p: 'pct', q: 'qty', n: 'int' };
    function cell(c, v, r) {
      if (v === '' || v === undefined || v === null) return '';
      var rf = r && r._fmt ? FMT_SHORT[r._fmt] || r._fmt : null;
      if (rf && (c.t === 'money') && typeof v === 'number') return fmtVal(v, rf);
      if (c.t === 'money') return fm(v);
      if (c.t === 'money0') return fk(v);
      if (c.t === 'int') return fk(v);
      if (c.t === 'qty') return fq(v);
      if (c.t === 'pct') return fp(v);
      if (typeof v === 'string' && /^\d{4}-\d\d-\d\d( \d\d:\d\d(:\d\d)?)?$/.test(v)) return '<span class="nw">' + esc(v) + '</span>';
      return esc(v);
    }
    function lvlCol(res) { return res._lvlc !== undefined ? res._lvlc : res.cols[0] && res.cols[0].k === 'code' ? 1 : 0; }
    function isNum(c) { return ['money', 'money0', 'int', 'qty', 'pct'].indexOf(c.t) >= 0; }
    function tableHTML(res) {
      var sk = F.cur && F.cur.sort;
      var rows = res.rows.slice();
      if (sk) { var col = res.cols.filter(function (c) { return c.k === sk.k; })[0]; if (col) rows.sort(function (a, b) { if (res._grouped && a._g !== b._g) return a._g - b._g; if (res._grouped && (a._gh || b._gh)) return (b._gh || 0) - (a._gh || 0); var x = a[sk.k], y = b[sk.k]; if (isNum(col)) { x = Number(x) || 0; y = Number(y) || 0; } return (x < y ? -1 : x > y ? 1 : 0) * sk.dir; }); }
      if (!rows.length) return '<p class="muted" style="margin:0">لا توجد حركة في هذه الفترة</p>';
      var clickable = rows.some(function (r) { return r._acc || r._box || r._c1; }), hasC1 = rows.some(function (r) { return r._c1; });
      var shown = rows.length > 3000 ? rows.slice(0, 3000) : rows;
      return '<table class="tbl fin"><thead><tr>' + res.cols.map(function (c) { return '<th class="' + (isNum(c) ? 'n' : c.t === 'long' ? 'lt' : '') + '" data-sort="' + c.k + '">' + thHTML(c.l) + (sk && sk.k === c.k ? '<span class="ths">' + (sk.dir > 0 ? '▲' : '▼') + '</span>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        shown.map(function (r) {
          return '<tr class="' + (r._gh ? 'gh ' : '') + (r._b ? 'b ' : '') + (r._hl ? 'hl ' : '') + ((r._acc || r._box || r._c1) && clickable ? 'tap' : '') + '"' + (r._c1 ? ' data-c1="' + esc(r._c1) + '"' : r._acc ? ' data-acc="' + esc(r._acc) + '"' : r._box ? ' data-box="' + esc(r._box) + '"' : '') + '>' +
            res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : c.t === 'long' ? 'lt' : '') + '"' + (r._lvl && i === lvlCol(res) ? ' style="padding-inline-start:' + (6 + r._lvl * 18) + 'px"' : '') + '>' + cell(c, r[c.k], r) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody>' + (res.total ? '<tfoot><tr>' + res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '">' + (i === 0 ? esc(res.total[c.k] && !isNum(c) ? res.total[c.k] : res.total.name || res.total.desc || 'الإجمالي') : cell(c, res.total[c.k], res.total)) + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table>' +
        '<p class="small muted" style="margin:8px 0 0">' + fk(rows.length) + ' سطر' + (shown.length < rows.length ? ' (يظهر أول ' + fk(shown.length) + '، وملف Excel فيه الكل)' : '') + (clickable ? (hasC1 ? ' · اضغط على أي عميل لفتح ملفه الكامل' : ' · اضغط على أي حساب لفتح كشف حسابه') : '') + ' · اضغط على عنوان أي عمود للترتيب</p>';
    }

    function bindReport(m) {
      var c = F.cur, p = c.p, def = curDef();
      var save = function () { st.finParams = st.finParams || {}; st.finParams[c.id] = Object.assign({}, p); try { localStorage.setItem('rk.finParams', JSON.stringify(st.finParams)); } catch (e) {} };
      q('[data-back]', m).onclick = function () { if (window.RKNav && RKNav.back()) return; var y = F.catY || 0; F.cur = null; A.render(); var go2 = function (n) { window.scrollTo(0, y); if (n && Math.abs(window.scrollY - y) > 2) requestAnimationFrame(function () { go2(n - 1); }); }; requestAnimationFrame(function () { go2(5); }); };
      bindPeriod(m, 'rep', function () { return p; }, function (ps) { Object.assign(p, ps); save(); A.render(); }, def.params.indexOf('period') >= 0);
      qa('[data-pk]', m).forEach(function (el) {
        el.addEventListener('change', function () { p[el.dataset.pk] = el.value; if (el.dataset.pk === 'from' || el.dataset.pk === 'to') p.preset = 'custom'; save(); A.render(); });
      });
      var cp = q('[data-custpick]', m);
      if (cp) cp.onclick = function () { pickCustomer(p.cust1).then(function (k) { if (k) { p.cust1 = k; c1Last(k); save(); A.render(); } }); };
      var ip = q('[data-itempick]', m);
      if (ip) ip.onclick = function () { pickMulti({ title: 'اختر الصنف', hint: 'اختر صنفاً واحداً', options: fltOptions('item'), value: p.item1 ? ['@' + p.item1] : [] }).then(function (v) { if (v && v.length) { p.item1 = String(v[v.length - 1]).replace(/^@/, ''); save(); A.render(); } }); };
      var ap = q('[data-accpick]', m);
      if (ap) ap.onclick = function () { pickAccount({ title: 'اختر الحساب', any: true }).then(function (id) { if (id) { p.account = id; delete p.accs; save(); A.render(); } }); };
      bindFltPanel(m, 'rep', fdimsFor(def), function () { return p.flt; }, function (f) { p.flt = f; delete p._pin; save(); A.render(); });
      bindGrpBar(m, p, save); bindIgrpBar(m, p, save); bindSplitBar(m, p, save);
      qa('th[data-sort]', m).forEach(function (th) { th.onclick = function () { var k = th.dataset.sort; c.sort = c.sort && c.sort.k === k ? { k: k, dir: -c.sort.dir } : { k: k, dir: -1 }; A.render(); }; });
      qa('tr[data-acc]', m).forEach(function (tr) { tr.onclick = function () { var asof = def.params.indexOf('asof') >= 0; openReport('statement', { account: tr.dataset.acc, preset: asof ? 'custom' : p.preset, from: asof ? p.asof.slice(0, 4) + '-01-01' : p.from, to: asof ? p.asof : p.to }); }; });
      qa('tr[data-c1]', m).forEach(function (tr) { tr.onclick = function () { var asof = def.params.indexOf('asof') >= 0; c1Last(tr.dataset.c1); openReport('c1_card', { cust1: tr.dataset.c1, preset: asof ? 'custom' : p.preset, from: asof ? p.asof.slice(0, 4) + '-01-01' : p.from, to: asof ? p.asof : p.to }); }; });
      qa('tr[data-box]', m).forEach(function (tr) { tr.onclick = function () { p.box = tr.dataset.box; save(); A.render(); }; });
      q('[data-xls]', m).onclick = function () { exportXLSX(c.res, def.name, p); };
      q('[data-prt]', m).onclick = function () { printReport(c.res, def.name, p); };
      bindViewPanel(m, save);
      var ed = q('[data-edit]', m);
      if (ed) ed.onclick = function () { F.custom = JSON.parse(JSON.stringify(c.custom)); F.preview = true; go('builder'); };
    }

    /* ---------- التصدير والطباعة ---------- */
    function periodText(p, def) { return def.params.indexOf('asof') >= 0 ? 'في ' + p.asof : def.params.indexOf('period') >= 0 ? (isCmp(p.preset) ? presetName(p.preset, p.year) + ' · ' : '') + (p.from === p.to ? p.from : 'من ' + p.from + ' إلى ' + p.to) : ''; }
    function plain(s) { return String(s || '').replace(/<[^>]+>/g, ''); }
    function exportXLSX(res, name, p) {
      A.withXLSX().then(function (X) {
        var def = curDef(), ws = {}, r = 0, nc = res.cols.length;
        var put = function (rr, cc, cl) { ws[X.utils.encode_cell({ r: rr, c: cc })] = cl; };
        put(r++, 0, xcell('شركة راكان لاستيراد المواد الغذائية والتوزيع', { font: XS.font({ color: { rgb: '595959' } }) }));
        put(r++, 0, xcell(res.title || name, { font: XS.font({ bold: true, sz: 14, color: { rgb: '0C4CA2' } }) }));
        put(r++, 0, xcell(periodText(p, def) + (res.note ? ' · ' + plain(res.note) : ''), { font: XS.font({ color: { rgb: '595959' } }) }));
        put(r++, 0, xcell('آخر بيانات من سراج: ' + ((F.meta && F.meta.last) || ''), { font: XS.font({ sz: 9, color: { rgb: '7F7F7F' } }) }));
        if (res.kpis && res.kpis.length) { r++; res.kpis.forEach(function (x) { put(r, 0, xcell(x.l, { font: XS.font({ bold: true, color: { rgb: '0C4CA2' } }) })); put(r, 1, x.t === 'money' || x.t === 'int' ? xcell(Number(x.v) || 0, { font: XS.font({ bold: true }) }, x.t === 'money' ? '#,##0.000' : '#,##0') : xcell(kpiVal(x), { font: XS.font({ bold: true }) })); if (x.s) put(r, 2, xcell(x.s, { font: XS.font({ sz: 9, color: { rgb: '7F7F7F' } }) })); r++; }); }
        r++;
        var hr = r;
        res.cols.forEach(function (c, j) { put(r, j, xcell(c.l, { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' } }), fill: { fgColor: { rgb: '0C4CA2' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: XS.border })); });
        r++;
        var zOf = function (c, row) { var f = row && row._fmt ? FMT_SHORT[row._fmt] || row._fmt : null; if (f && c.t === 'money') return f === 'pct' ? '0.0"%"' : f === 'int' || f === 'money0' ? '#,##0' : f === 'qty' ? '#,##0.##' : f === 'dec2' ? '#,##0.00' : '#,##0.000'; return c.t === 'money' ? '#,##0.000' : c.t === 'int' || c.t === 'money0' ? '#,##0' : c.t === 'qty' ? '#,##0.##' : c.t === 'pct' ? '0.0"%"' : null; };
        var val = function (c, v, j, row) { if (v === undefined || v === null || v === '') return ''; if (isNum(c) && typeof v === 'number') return Math.round(v * 1000) / 1000; return plain(v); };
        res.rows.forEach(function (row) {
          res.cols.forEach(function (c, j) {
            var v = val(c, row[c.k], j, row); if (row._lvl && typeof v === 'string' && j === lvlCol(res)) v = new Array(row._lvl + 1).join('    ') + v;
            var s = { font: XS.font({ bold: !!row._b }), border: XS.border }; if (row._hl) s.fill = { fgColor: { rgb: 'E8EFFA' } };
            if (isNum(c)) s.alignment = { horizontal: 'right' };
            put(r, j, xcell(v, s, zOf(c, row)));
          });
          r++;
        });
        if (res.total) {
          res.cols.forEach(function (c, j) { var v = j === 0 ? 'الإجمالي' : val(c, res.total[c.k], j, res.total); put(r, j, xcell(v, { font: XS.font({ bold: true }), fill: { fgColor: { rgb: 'FDE7DC' } }, border: { top: { style: 'medium', color: { rgb: 'F15C22' } }, bottom: XS.border.bottom, left: XS.border.left, right: XS.border.right } }, zOf(c, res.total))); });
          r++;
        }
        ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(r - 1, hr), c: Math.max(nc - 1, 0) } });
        ws['!cols'] = res.cols.map(function (c) { return { wch: c.t === 'text' ? 30 : 16 }; });
        ws['!views'] = [{ RTL: true }];
        ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: hr, c: 0 }, e: { r: hr, c: Math.max(nc - 1, 0) } }) };
        var wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
        X.utils.book_append_sheet(wb, ws, 'التقرير');
        download(X, wb, 'rakan-' + (res.title || name).replace(/[\\/:*?"<>|]/g, '').slice(0, 40) + '-' + today() + '.xlsx');
      }).catch(function (e) { toast(e.message, true); });
    }
    /* ---------- الطباعة الاحترافية: اختيار الاتجاه وحجم الخط تلقائياً، وتقسيم الأعمدة على أجزاء عند الحاجة دون فقد أي عمود ---------- */
    var PX2MM = 25.4 / 96;
    function pMeasure(t, pt, bold) { return textW(String(t), pt * 96 / 72, bold) * PX2MM; }
    // عنوان العمود على سطرين كحد أقصى: العنوان الرئيسي، وما بين القوسين سطراً ثانياً أصغر
    function thSplit(l) { l = String(l || ''); var m = l.match(/^(.*?)\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/); return m && m[1] ? [m[1], m[2]] : [l, '']; }
    function thHTML(l) { var x = thSplit(l); return '<span class="thm' + (x[0].split(/\s+/).length <= 3 ? ' one' : '') + '">' + esc(x[0]) + '</span>' + (x[1] ? ' <span class="ths">(' + esc(x[1]) + ')</span>' : ''); }
    function thWidth(l, pt) {
      var x = thSplit(l), words = x[0].split(/\s+/), lw = Math.max.apply(null, words.map(function (w) { return pMeasure(w, pt - 0.5, true); })), full = pMeasure(x[0], pt - 0.5, true);
      var main = words.length <= 3 ? full : Math.max(lw, Math.min(full, Math.max(full * 0.55, lw)));   // العنوان الرئيسي في سطر أو سطرين متوازنين
      var sub = x[1] ? Math.min(pMeasure('(' + x[1] + ')', pt - 1.5, false), 30) : 0;
      return Math.min(Math.max(main, sub, lw), 38);
    }
    function pColWidths(res, rows, cols, pt) {
      return cols.map(function (c) {
        var num = isNum(c), hw = thWidth(c.l, pt), natural = 0, word = 0;
        var sample = rows.length > 400 ? rows.filter(function (r, i) { return i % Math.ceil(rows.length / 400) === 0 || r._b; }) : rows;
        sample.concat(res.total ? [res.total] : []).forEach(function (r) {
          var v = plain(cell(c, r[c.k], r)); if (!v) return;
          String(v).split('\n').forEach(function (ln) { var w = pMeasure(ln, pt, !!r._b); if (w > natural) natural = w; });   // متعدد الأسطر: أطول سطر
          if (!num) v.split(/\s+/).forEach(function (x) { var ww = pMeasure(x, pt); if (ww > word) word = ww; });
        });
        var cap = num ? 999 : c.t === 'long' ? 46 : 40, w = num ? natural : Math.max(word, Math.min(natural, cap));
        return Math.max(w, hw, num ? 9 : 12) + 3.2;   // + الحشوة
      });
    }
    function printPlan(res, mode) {
      var rows = res.rows, cols = res.cols.filter(function (c) { return rows.some(function (r) { var v = r[c.k]; return v !== '' && v !== undefined && v !== null; }) || (res.total && res.total[c.k] !== undefined && res.total[c.k] !== ''); });
      if (!cols.length) cols = res.cols.slice();
      var best = null, AV = { portrait: 190, landscape: 277 }, sizes = [8.5, 8, 7.5, 7, 6.6], tries = mode === 'portrait' ? ['portrait'] : mode === 'landscape' ? ['landscape'] : ['portrait', 'landscape'];
      if (mode !== 'split') for (var o = 0; o < tries.length; o++) for (var k = 0; k < sizes.length; k++) {
        var ws = pColWidths(res, rows, cols, sizes[k]), tot = ws.reduce(function (a, b) { return a + b; }, 0);
        if (tot <= AV[tries[o]]) { var cand = { orient: tries[o], pt: sizes[k], parts: [{ cols: cols, ws: ws.map(function (w) { return w / tot * 100; }) }] }; if (!best || cand.pt > best.pt) best = cand; break; }
      }
      // العمودي يُفضَّل إذا كان خطه 8 فأكبر أو مساوياً للأفقي، وإلا فالأفقي بخط أوضح
      if (best && mode !== 'split') return best;
      // تقسيم الأعمدة: أعمدة التعريف (الاسم/الرمز) تتكرر في كل جزء، وبقية الأعمدة توزَّع بالترتيب
      var pt = mode === 'split' ? 8 : 7.5, orient = mode === 'portrait' ? 'portrait' : 'landscape', av = AV[orient], ws2 = pColWidths(res, rows, cols, pt);
      var nKey = 1; if (cols.length > 2 && !isNum(cols[1]) && (cols[0].k === 'code' || ws2[0] < 30)) nKey = 2;
      // أعمدة يطلب التقرير تكرارها في كل جزء (مثل الوحدة والكمية) إن كانت في أول الجدول
      if (res.printKeys) { var pk = 0; while (pk < cols.length && res.printKeys.indexOf(cols[pk].k) >= 0) pk++; if (pk > nKey) nKey = pk; }
      var keyW = ws2.slice(0, nKey).reduce(function (a, b) { return a + b; }, 0), parts = [], cur = [];
      for (var i = nKey; i < cols.length; i++) {
        var used = keyW + cur.reduce(function (a, x) { return a + ws2[x]; }, 0);
        if (cur.length && used + ws2[i] > av) { parts.push(cur); cur = []; }
        cur.push(i);
      }
      if (cur.length) parts.push(cur);
      return { orient: orient, pt: pt, split: true, parts: parts.map(function (ix) {
        var idx = []; for (var z = 0; z < nKey; z++) idx.push(z); idx = idx.concat(ix);
        var w = idx.map(function (x) { return ws2[x]; }), t = w.reduce(function (a, b) { return a + b; }, 0), fill = t < av * 0.75;
        return { cols: idx.map(function (x) { return cols[x]; }), ws: w.map(function (x) { return fill ? x / av * 100 : x / t * 100; }), fill: fill };
      }) };
    }
    function printTableHTML(res, part, pt) {
      var cols = part.cols, rows = res.rows, lc = lvlCol(res), lk = res.cols[lc] && res.cols[lc].k;
      return '<table class="p-tbl p-auto" style="font-size:' + pt + 'pt' + (part.fill ? ';width:auto;min-width:' + Math.round(part.ws.reduce(function (a, b) { return a + b; }, 0)) + '%' : '') + '"><colgroup>' + part.ws.map(function (w) { return '<col style="width:' + w.toFixed(2) + '%">'; }).join('') + '</colgroup><thead><tr>' +
        cols.map(function (c) { return '<th class="' + (isNum(c) ? 'n' : '') + '">' + thHTML(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr class="' + (r._gh ? 'gh ' : r._b ? 'b ' : '') + (r._hl ? 'hl' : '') + '">' + cols.map(function (c) {
            return '<td class="' + (isNum(c) ? 'n' : c.t === 'long' ? 'lt' : '') + '"' + (r._lvl && c.k === lk ? ' style="padding-inline-start:' + (1.5 + r._lvl * 3.5) + 'mm"' : '') + '>' + cell(c, r[c.k], r) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody>' +
        (res.total ? '<tfoot><tr>' + cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '">' + (i === 0 ? esc(res.total[c.k] && !isNum(c) ? res.total[c.k] : res.total.name || 'الإجمالي') : cell(c, res.total[c.k], res.total)) + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table>';
    }
    function printReport(res, name, p, mode) {
      if (!mode) {   // نافذة اختيار سريعة مع الخيار التلقائي الموصى به
        var auto = printPlan(res, 'auto'), desc = function (pl) { return (pl.orient === 'landscape' ? 'أفقي' : 'عمودي') + ' · خط ' + pl.pt + (pl.split && pl.parts.length > 1 ? ' · الأعمدة على ' + pl.parts.length + ' أجزاء' : ''); };
        return sheet('طباعة التقرير', '<div class="form"><p class="small muted" style="margin:0">' + fk(res.rows.length) + ' سطر · ' + res.cols.length + ' عمود. يُختار الاتجاه وحجم الخط تلقائياً حتى تظهر كل الأعمدة بوضوح.</p><div class="list">' +
          [['auto', 'تلقائي (موصى به)', desc(auto)], ['portrait', 'عمودي', desc(printPlan(res, 'portrait'))], ['landscape', 'أفقي', desc(printPlan(res, 'landscape'))], ['split', 'تقسيم الأعمدة على أجزاء بخط أوضح', desc(printPlan(res, 'split'))]].map(function (o, i) {
            return '<label class="item tap"><input type="radio" name="pmode" value="' + o[0] + '"' + (i === 0 ? ' checked' : '') + '><div class="main"><b>' + o[1] + '</b><div class="meta"><span>' + esc(o[2]) + '</span></div></div></label>';
          }).join('') + '</div><button class="btn primary big" data-pgo>طباعة</button></div>', function (s) {
          q('[data-pgo]', s.el).onclick = function () { var v = (q('input[name=pmode]:checked', s.el) || {}).value || 'auto'; s.close(); printReport(res, name, p, v); };
        });
      }
      var def = curDef(), P = document.getElementById('print'), plan = printPlan(res, mode);
      var head = function (k) { return '<div class="p-head"><img src="logo.png" alt=""><div class="t"><b>' + esc(res.title || name) + '</b><span>شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + esc(periodText(p, def)) + (res.subtitle ? ' · ' + esc(plain(res.subtitle)) : '') + '</span></div><span class="p-copy">' +
        (plan.split ? 'الجزء ' + (k + 1) + ' من ' + plan.parts.length : esc('طُبع ' + RK.nowStr().slice(0, 16))) + '</span></div>'; };
      var foot = '<p class="p-note">آخر بيانات من سراج: ' + esc((F.meta && F.meta.last) || '') + ' · طُبع ' + esc(RK.nowStr().slice(0, 16)) + ' · ' + fk(res.rows.length) + ' سطر · تقارير راكان تقرأ من سراج ولا تعدّل فيه</p>';
      P.innerHTML = '<div class="p-rep p-' + plan.orient + '">' + plan.parts.map(function (part, k) {
        return '<section class="p-part">' + head(k) + (k === 0 && res.note ? '<p class="p-note">' + esc(plain(res.note)) + '</p>' : '') + (k === 0 && res.kpis ? '<div class="p-kpis">' + res.kpis.map(function (x) { return '<div><span>' + esc(x.l) + '</span><b>' + esc(kpiVal(x)) + '</b>' + (x.s ? '<i>' + esc(x.s) + '</i>' : '') + '</div>'; }).join('') + '</div>' : '') +
          (plan.split ? '<p class="p-note p-cols">الأعمدة في هذا الجزء: ' + esc(part.cols.map(function (c) { return c.l; }).join('، ')) + '</p>' : '') + printTableHTML(res, part, plan.pt) + foot + '</section>';
      }).join('') + '</div>';
      var st = document.getElementById('p-page-style') || document.head.appendChild(Object.assign(document.createElement('style'), { id: 'p-page-style' }));
      st.textContent = '@media print { @page { size: A4 ' + plan.orient + '; margin: 9mm 8mm 11mm; @bottom-center { content: "صفحة " counter(page) " من " counter(pages); font: 8pt Tajawal, sans-serif; color: #555; } } }';
      var clean = function () { st.textContent = ''; window.removeEventListener('afterprint', clean); };
      window.addEventListener('afterprint', clean);
      if (window.RKSnd) RKSnd.play('print');
      setTimeout(function () { window.print(); }, 200);
    }

    /* ---------- اختيار حساب ---------- */
    // اختيار عميل واحد: بحث بالاسم أو الرمز، مرتب بمبيعات آخر سنة
    function pickCustomer(cur) {
      return new Promise(function (res) {
        sheet('اختر العميل', '<input class="input" id="cq" placeholder="ابحث باسم العميل أو رمز حسابه"><div class="list acc-list" id="cl"></div>', function (s) {
          var inp = q('#cq', s.el), cl = q('#cl', s.el), all = custChoices();
          function draw() {
            var t = normAr(inp.value.trim());
            var list = all.filter(function (r) { return !t || normAr(r.name + ' ' + r.code).indexOf(t) >= 0; }).slice(0, 200);
            cl.innerHTML = list.map(function (r) { return '<button class="item tap acc-it' + (r.k === cur ? ' sel' : '') + '" data-k="' + esc(r.k) + '"><div class="main"><b>' + esc(r.name) + '</b><div class="meta">' + (r.code ? '<span class="num">' + esc(r.code) + '</span>' : '') + '<span>مبيعات سنة: ' + fk(r.net) + '</span>' + (r.last ? '<span>آخر شراء ' + esc(r.last) + '</span>' : '') + '</div></div>' + (r.k === cur ? '✓' : '') + '</button>'; }).join('') || '<p class="muted">لا نتائج</p>';
            qa('[data-k]', cl).forEach(function (b) { b.onclick = function () { s.done = true; s.close(); res(b.dataset.k); }; });
          }
          inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function pickAccount(opts) {
      opts = opts || {};
      return new Promise(function (res) {
        var sel = opts.multi ? (opts.value || []).slice() : null;
        sheet(opts.title || 'اختر الحساب', '<input class="input" id="aq" placeholder="ابحث بالرمز أو الاسم">' + (opts.hint ? '<div class="msg info">' + esc(opts.hint) + '</div>' : '') +
          '<div class="list acc-list" id="al"></div>' + (opts.multi ? '<button class="btn primary big" data-ok>' + (opts.okText || 'حفظ الاختيار') + '</button>' : ''), function (s) {
          var inp = q('#aq', s.el), al = q('#al', s.el);
          function draw() {
            var t = inp.value.trim();
            var list = (opts.list || F.D.accList).filter(function (a) { return (!opts.filter || opts.filter(a)) && (!t || (a.code + ' ' + a.name).indexOf(t) >= 0); }).slice(0, 300);
            al.innerHTML = list.map(function (a) {
              var on = sel && sel.indexOf(String(opts.byId ? a.id : a.code)) >= 0;
              return '<button class="item tap acc-it' + (on ? ' sel' : '') + '" data-a="' + esc(a.id) + '" style="padding-inline-start:' + (8 + (t ? 0 : (a.lvl - 1) * 14)) + 'px"><div class="main"><b>' + esc(a.name) + '</b><div class="meta"><span class="num">' + esc(a.code) + '</span><span>مستوى ' + a.lvl + '</span>' + (a.leaf ? '' : '<span>رئيسي · ' + a.kids.length + ' فرع</span>') + '</div></div>' + (on ? '✓' : '') + '</button>';
            }).join('') || '<p class="muted">لا نتائج</p>';
            var okb = q('[data-ok]', s.el); if (okb && sel) okb.textContent = (opts.okText || 'حفظ الاختيار') + (sel.length ? ' (' + sel.length + ')' : '');
            qa('[data-a]', al).forEach(function (b) {
              b.onclick = function () {
                var a = opts.list ? opts.list.filter(function (x) { return x.id === b.dataset.a; })[0] : acc(b.dataset.a);
                if (!sel) { s.done = true; s.close(); res(a.id); return; }
                var c = String(opts.byId ? a.id : a.code), i = sel.indexOf(c); if (i >= 0) sel.splice(i, 1); else sel.push(c); draw();
              };
            });
          }
          inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
          var ok = q('[data-ok]', s.el);
          if (ok) ok.onclick = function () { s.done = true; s.close(); res(sel); };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    // اختيار متعدد من قائمة (عملاء، أصناف، مخازن…): المحدد يظهر بالاسم في الأعلى، وكل سطر بمربع اختيار واضح
    function pickMulti(opts) {
      return new Promise(function (res) {
        var sel = (opts.resolve ? opts.resolve(opts.value || []) : (opts.value || [])).map(String), byId = {}, onlySel = false;
        opts.options.forEach(function (o) { byId[String(o.id)] = o; });
        var nameOf = function (id) { var o = byId[id] || byId['@' + id] || byId[String(id).replace(/^@/, '')]; return o ? o.name + (o.grp ? ' — ' + o.grp : '') : String(id).replace(/^@/, ''); };
        sheet(opts.title || 'اختر', (opts.hint ? '<p class="small muted" style="margin:0 0 6px">' + esc(opts.hint) + '</p>' : '') + '<div class="pm-sel" id="pms"></div><input class="input" id="mq" placeholder="اكتب للبحث بالاسم أو الرمز…">' +
          '<div class="row small pm-tools"><label class="chk"><input type="checkbox" id="mso"> المحدد فقط</label><span class="grow"></span><button class="btn sm ghost" data-all>تحديد كل الظاهر</button><button class="btn sm ghost" data-none>إلغاء التحديد</button></div>' +
          '<div class="list acc-list pm-list" id="ml"></div><button class="btn primary big" data-ok></button>', function (s) {
          var inp = q('#mq', s.el), ml = q('#ml', s.el), shown = [];
          function drawSel() {
            q('#pms', s.el).innerHTML = sel.length ? '<div class="small"><b>المحدد (' + sel.length + '):</b></div><div class="pm-tags">' + sel.map(function (id, i) { return '<span class="fp-tag">' + esc(nameOf(id)) + '<button data-un="' + i + '" aria-label="إزالة">×</button></span>'; }).join('') + '</div>'
              : '<div class="small muted">لم تحدد شيئاً بعد. بدون تحديد يُعرض الكل.</div>';
            qa('[data-un]', s.el).forEach(function (b) { b.onclick = function () { sel.splice(Number(b.dataset.un), 1); draw(); }; });
            q('[data-ok]', s.el).textContent = sel.length ? 'تطبيق (' + sel.length + ' محدد)' : 'تطبيق (الكل)';
          }
          function draw() {
            var t = inp.value.trim();
            var list = opts.options.filter(function (o) { return (!onlySel || sel.indexOf(String(o.id)) >= 0) && (!t || (o.name + ' ' + (o.sub || '')).indexOf(t) >= 0); });
            shown = list.slice(0, 400);
            var lastG = null;
            ml.innerHTML = shown.map(function (o) { var on = sel.indexOf(String(o.id)) >= 0, gh = ''; if (o.grp && o.grp !== lastG) { lastG = o.grp; var gn = shown.filter(function (x) { return x.grp === o.grp; }), gs = gn.filter(function (x) { return sel.indexOf(String(x.id)) >= 0; }).length; gh = '<div class="pm-grp"><b>' + esc(o.grp) + '</b><span class="small muted">' + (gs ? gs + ' من ' : '') + gn.length + '</span><span class="grow"></span><button type="button" class="btn sm ghost" data-gall="' + esc(o.grp) + '">' + (gs === gn.length ? 'إلغاء الكل' : 'تحديد الكل') + '</button></div>'; } return gh + '<button class="item tap pm-it' + (on ? ' sel' : '') + '" data-o="' + esc(o.id) + '"' + (o.lvl && !t ? ' style="padding-inline-start:' + (10 + o.lvl * 16) + 'px"' : '') + '><span class="pm-box">' + (on ? '✓' : '') + '</span><div class="main"><b>' + esc(o.name) + '</b>' + (o.sub ? '<div class="meta"><span class="num">' + esc(o.sub) + '</span></div>' : '') + '</div></button>'; }).join('') +
              (list.length > shown.length ? '<p class="small muted">يظهر ' + shown.length + ' من ' + list.length + '، اكتب في البحث لتضييق القائمة</p>' : '') || '<p class="muted">لا نتائج</p>';
            qa('[data-o]', ml).forEach(function (b) { b.onclick = function () { var id = b.dataset.o, i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); draw(); }; });
            qa('[data-gall]', ml).forEach(function (b) { b.onclick = function () { var g = shown.filter(function (x) { return x.grp === b.dataset.gall; }).map(function (x) { return String(x.id); }), all = g.every(function (id) { return sel.indexOf(id) >= 0; }); if (all) sel = sel.filter(function (id) { return g.indexOf(id) < 0; }); else g.forEach(function (id) { if (sel.indexOf(id) < 0) sel.push(id); }); draw(); }; });
            drawSel();
          }
          inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
          q('#mso', s.el).onchange = function () { onlySel = this.checked; draw(); };
          q('[data-all]', s.el).onclick = function () { shown.forEach(function (o) { if (sel.indexOf(String(o.id)) < 0) sel.push(String(o.id)); }); draw(); };
          q('[data-none]', s.el).onclick = function () { sel = []; draw(); };
          q('[data-ok]', s.el).onclick = function () { s.done = true; s.close(); res(sel); };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }

    /* ---------- الحساب المبسّط: اختر ما تريد من قائمة، واربط العناصر بـ + − × ÷ ---------- */
    var FMT_SIMPLE = [['money0', 'مبلغ بدون كسور'], ['money', 'مبلغ بثلاث خانات'], ['dec2', 'رقم بخانتين'], ['qty', 'كمية'], ['int', 'عدد'], ['pct', 'نسبة مئوية %']];
    function accNames(codes) { return (codes || []).map(function (c) { var a = F.D.byCode[c]; return a ? a.name : c; }); }
    function namesOf(k, list) { return (list || []).map(function (x) { return fltName(k, x); }); }
    function termOpts(t) {   // وصف خيارات العنصر بالكلمات
      var parts = [], f = t.flt || {};
      if (t.acc && t.acc.length) parts.push(t.acc.map(function (c) { var a = F.D.byCode[c]; return c + (a ? ' ' + a.name : ''); }).join('، '));
      if (t.st && t.st.length) parts.push('المخزن: ' + namesOf('st', stResolve(t.st)).join('، '));
      if (t.box) parts.push(t.box === 'صندوق' ? 'نقداً (الصناديق)' : t.box === 'بنك' ? 'تحويل (البنوك)' : t.box);
      ['cust', 'item', 'st', 'ag', 'xcust', 'xitem'].forEach(function (k) { if (f[k] && f[k].length) parts.push(DIM[k][1] + ': ' + namesOf(k, k === 'st' ? stResolve(f[k]) : f[k]).join('، ')); });
      if (f.acc && f.acc.length) parts.push((TKMAP[t.k] && TKMAP[t.k].type === 'stock' ? 'لدى الحساب (المباع له − المرتجع منه حتى نهاية الفترة): ' : 'الحساب: ') + accNames(f.acc).join('، '));
      return parts.join(' · ');
    }
    function termLabel(t) {
      var d = TKMAP[t.k]; if (!d) return '؟';
      if (d.type === 'num') return String(Number(t.n) || 0);
      if (d.type === 'var') return '«' + (t.v || '…') + '»';
      var o = termOpts(t);
      return d.label + (o ? ' (' + o + ')' : '');
    }
    function termsText(terms) { return (terms || []).map(function (t, i) { return (i ? OPS[t.op || '+'] + ' ' : '') + termLabel(t); }).join(' '); }
    function itemText(it) { if (it.terms && it.terms.length) return termsText(it.terms); var tt = it.f ? fToTerms(it.f) : null; return tt ? termsText(tt) : (it.f || ''); }
    function pickTermKind() {
      return new Promise(function (res) {
        sheet('ماذا تريد أن تحسب؟', TK.map(function (g) {
          return '<div class="tk-g"><div class="tk-gt">' + esc(g[0]) + '</div><div class="tk-list">' + g[1].map(function (t) { return '<button class="tk-it" data-k="' + esc(t[0]) + '">' + esc(t[1]) + '</button>'; }).join('') + '</div></div>';
        }).join(''), function (s) {
          qa('[data-k]', s.el).forEach(function (b) { b.onclick = function () { s.done = true; s.close(); res(b.dataset.k); }; });
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function tbHTML(id, terms, names) {
      return '<div class="tb" id="' + id + '">' + terms.map(function (t, i) {
        var d = TKMAP[t.k] || {}, f = t.flt || {};
        var btn = function (attr, label, val) { return '<button type="button" class="chip tb-o' + (val ? ' on' : '') + '" ' + attr + '>' + esc(label) + ' ▾</button>'; };
        var o = '';
        var accB = btn('data-tfacc', (f.acc || []).length ? 'الحسابات: ' + accNames(f.acc).join('، ') : 'كل الحسابات', (f.acc || []).length);
        if (d.type === 'flt') o = btn('data-tf="cust"', (f.cust || []).length ? 'العملاء: ' + f.cust.length : 'كل العملاء', (f.cust || []).length) + btn('data-tf="item"', (f.item || []).length ? 'الأصناف: ' + f.item.length : 'كل الأصناف', (f.item || []).length) + btn('data-tf="st"', (f.st || []).length ? 'المخازن: ' + f.st.length : 'كل المخازن', (f.st || []).length) + accB;
        else if (d.type === 'cust') o = btn('data-tf="cust"', (f.cust || []).length ? 'العملاء: ' + f.cust.length : 'كل العملاء', (f.cust || []).length);
        else if (d.type === 'coll') o = '<select class="input tb-sel" data-tbox><option value="">كل التحصيل</option><option value="صندوق"' + (t.box === 'صندوق' ? ' selected' : '') + '>نقداً (الصناديق)</option><option value="بنك"' + (t.box === 'بنك' ? ' selected' : '') + '>تحويل (البنوك)</option></select>' + btn('data-tf="cust"', (f.cust || []).length ? 'العملاء: ' + f.cust.length : 'كل العملاء', (f.cust || []).length);
        else if (d.type === 'box') o = '<select class="input tb-sel" data-tbox><option value="">الصناديق والبنوك</option><option value="صندوق"' + (t.box === 'صندوق' ? ' selected' : '') + '>الصناديق فقط</option><option value="بنك"' + (t.box === 'بنك' ? ' selected' : '') + '>البنوك فقط</option></select>';
        else if (d.type === 'acc') o = btn('data-tacc', (t.acc || []).length ? 'الحساب: ' + t.acc.map(function (c) { var a = F.D.byCode[c]; return a ? a.name : c; }).join('، ') : 'اختر الحساب', (t.acc || []).length);
        else if (d.type === 'stock') o = btn('data-tst', (t.st || []).length ? 'المخازن: ' + namesOf('st', stResolve(t.st)).join('، ') : 'كل المخازن', (t.st || []).length) + btn('data-tf="item"', (f.item || []).length ? 'الأصناف: ' + f.item.length : 'كل الأصناف', (f.item || []).length) + accB;
        else if (d.type === 'num') o = '<input class="input tb-num num" type="number" step="any" data-tnum value="' + esc(t.n === undefined ? '' : t.n) + '" placeholder="مثل 100">';
        else if (d.type === 'var') o = '<select class="input tb-sel" data-tvar><option value="">اختر…</option>' + (names || []).map(function (n) { return '<option' + (t.v === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>';
        var det = termOpts(t);
        return '<div class="tb-row" data-i="' + i + '">' +
          (i ? '<select class="input tb-op" data-top aria-label="العملية">' + Object.keys(OPS).map(function (k) { return '<option value="' + k + '"' + ((t.op || '+') === k ? ' selected' : '') + '>' + OPS[k] + '</option>'; }).join('') + '</select>' : '<span class="tb-op0">=</span>') +
          '<div class="tb-main"><button type="button" class="tb-what" data-tw>' + esc(d.label || 'اختر…') + ' ▾</button><div class="tb-opts">' + o + '</div>' + (det && d.type !== 'acc' ? '<div class="tb-det small">' + esc(det) + '</div>' : '') + '</div>' +
          '<button type="button" class="iconbtn tb-del" data-tdel aria-label="حذف العنصر">✕</button></div>';
      }).join('') + '<button type="button" class="btn sm tb-add" data-tadd>+ إضافة عنصر (جمع، طرح، ضرب، قسمة)</button></div>';
    }
    function bindTb(box, terms, names, onChange) {
      var row = function (el) { return terms[Number(el.closest('.tb-row').dataset.i)]; };
      qa('[data-tw]', box).forEach(function (b) { b.onclick = function () { var t = row(b); pickTermKind().then(function (k) { if (!k) return; Object.keys(t).forEach(function (x) { if (x !== 'op') delete t[x]; }); t.k = k; onChange(); if (TKMAP[k].type === 'acc') pickAcc(t); }); }; });
      var pickAcc = function (t) { pickAccount({ multi: true, value: t.acc || [], title: 'اختر الحساب (الحساب الرئيسي يشمل فروعه)' }).then(function (codes) { if (codes) { t.acc = codes; onChange(); } }); };
      qa('[data-tacc]', box).forEach(function (b) { b.onclick = function () { pickAcc(row(b)); }; });
      qa('[data-tf]', box).forEach(function (b) {
        b.onclick = function () { var t = row(b), k = b.dataset.tf; t.flt = t.flt || {}; pickMulti({ title: 'اختر ' + DIM[k][1], options: fltOptions(k), value: t.flt[k] || [], resolve: k === 'st' ? stResolve : null }).then(function (v) { if (!v) return; if (v.length) t.flt[k] = v; else delete t.flt[k]; if (!Object.keys(t.flt).length) delete t.flt; onChange(); }); };
      });
      qa('[data-tfacc]', box).forEach(function (b) { b.onclick = function () { var t = row(b), stk = (TKMAP[t.k] || {}).type === 'stock'; pickAccount({ multi: true, value: (t.flt && t.flt.acc) || [], title: 'اختر الحسابات (الحساب الرئيسي يشمل فروعه)', hint: stk ? 'مثل حساب الوكلاء: تُحسب الكمية لدى الحساب = المباع له − المرتجع منه حتى نهاية الفترة. اترك الاختيار فارغاً لكمية المخازن.' : 'تُحسب الكميات والمبالغ لفواتير هذه الحسابات فقط.' }).then(function (codes) { if (!codes) return; t.flt = t.flt || {}; if (codes.length) t.flt.acc = codes; else delete t.flt.acc; if (!Object.keys(t.flt).length) delete t.flt; onChange(); }); }; });
      qa('[data-tst]', box).forEach(function (b) { b.onclick = function () { var t = row(b); pickMulti({ title: 'اختر المخازن', options: fltOptions('st'), value: t.st || [], resolve: stResolve, hint: stMixed() ? 'المخازن مقسّمة حسب الإدارة والفرع، فاختر من القسم الصحيح.' : '' }).then(function (v) { if (v) { t.st = v; onChange(); } }); }; });
      qa('[data-tbox]', box).forEach(function (el) { el.onchange = function () { row(el).box = el.value; onChange(); }; });
      qa('[data-tvar]', box).forEach(function (el) { el.onchange = function () { row(el).v = el.value; onChange(); }; });
      qa('[data-tnum]', box).forEach(function (el) { el.oninput = function () { row(el).n = el.value === '' ? '' : Number(el.value); onChange(true); }; });
      qa('[data-top]', box).forEach(function (el) { el.onchange = function () { row(el).op = el.value; onChange(); }; });
      qa('[data-tdel]', box).forEach(function (b) { b.onclick = function () { terms.splice(Number(b.closest('.tb-row').dataset.i), 1); if (terms[0]) delete terms[0].op; onChange(); }; });
      q('[data-tadd]', box).onclick = function () { pickTermKind().then(function (k) { if (!k) return; var t = { k: k }; if (terms.length) t.op = '+'; terms.push(t); onChange(); if (TKMAP[k].type === 'acc') pickAcc(t); }); };
    }
    function editItem(item, kind, ctx) {
      // kind: card | row | frow ; ctx: { from, to, vars, names, perLabel, flt }
      return new Promise(function (res) {
        var d = JSON.parse(JSON.stringify(item || {}));
        d.fmt = d.fmt || (kind === 'card' ? 'money0' : kind === 'row' ? 'dec2' : 'money');
        var sepInit = !!(item && item.name && !itemF(item));
        var terms = d.terms && d.terms.length ? d.terms : (d.f ? fToTerms(d.f) : []);
        var adv = !terms;           // معادلة نصية متقدمة لا يمكن تحويلها
        if (adv) terms = [];
        var sub = d.subTerms ? d.subTerms : (d.sub ? fToTerms(d.sub) || [] : []);
        var fmtOpts = function (v) { return FMT_SIMPLE.map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); };
        var repOpts = '<option value="">تلقائي: حركات حسابات البطاقة أو التقرير المناسب</option><option value="-"' + (d.rep === '-' ? ' selected' : '') + '>بدون (لا تفتح شيئاً)</option>' + Object.keys(R).map(function (k) { return '<option value="' + k + '"' + (d.rep === k ? ' selected' : '') + '>' + esc(R[k].name) + '</option>'; }).join('');
        var html = '<div class="form fe">' +
          '<div class="field"><label class="lbl" for="fen">' + (kind === 'card' ? 'اسم البطاقة' : 'اسم السطر') + '</label><input id="fen" class="input" value="' + esc(d.name || '') + '" placeholder="مثل: صافي مبيعات الزيت"></div>' +
          (kind !== 'card' ? '<label class="chk"><input type="checkbox" id="fesep"' + (sepInit ? ' checked' : '') + '> عنوان قسم فقط (بدون رقم)</label>' : '') +
          '<div id="febody"><div class="field"><span class="lbl">طريقة الحساب</span><div id="tbm"></div></div>' +
          '<div class="fe-res" id="fep"></div>' +
          '<div class="field"><label class="lbl" for="fefmt">شكل الرقم</label><select id="fefmt" class="input">' + fmtOpts(d.fmt) + '</select></div>' +
          (kind === 'card' ? '<details class="fe-more"' + (sub.length ? ' open' : '') + '><summary>سطر صغير تحت الرقم (اختياري)</summary><div id="tbs"></div><div class="row"><div class="field grow"><label class="lbl" for="fesl">نص بعده</label><input id="fesl" class="input" value="' + esc(d.subl || '') + '" placeholder="مثل: فاتورة"></div><div class="field grow"><label class="lbl" for="fesf">شكله</label><select id="fesf" class="input">' + fmtOpts(d.subfmt || 'int') + '</select></div></div></details>' +
            '<details class="fe-more"><summary>خيارات البطاقة</summary><label class="chk"><input type="checkbox" id="fecmp"' + (d.cmp !== false ? ' checked' : '') + '> قارن بالفترة السابقة</label>' +
            '<div class="field"><label class="lbl" for="feg">الأفضل أن يكون الرقم</label><select id="feg" class="input"><option value="up"' + (d.good !== 'down' ? ' selected' : '') + '>أعلى (مثل المبيعات)</option><option value="down"' + (d.good === 'down' ? ' selected' : '') + '>أقل (مثل المديونية)</option></select></div>' +
            '<div class="field"><label class="lbl" for="ferep">عند الضغط على البطاقة افتح تقرير</label><select id="ferep" class="input">' + repOpts + '</select></div></details>' : '') +
          (kind === 'frow' ? '<label class="chk"><input type="checkbox" id="feb"' + (d.bold ? ' checked' : '') + '> خط عريض</label>' : '') +
          '<details class="fe-more fe-adv"' + (adv ? ' open' : '') + '><summary>كتابة الحساب يدوياً (للمتقدمين فقط)</summary><textarea id="fef" class="input fe-f" rows="2" dir="rtl" spellcheck="false">' + esc(adv ? d.f : termsToF(terms)) + '</textarea><div class="small muted">يتغير تلقائياً مع اختياراتك في الأعلى.</div></details>' +
          '</div><div id="feerr"></div><button class="btn primary big" id="fesv">حفظ</button></div>';
        sheet(kind === 'card' ? (item && item.name ? 'تعديل البطاقة' : 'بطاقة جديدة') : (item && item.name ? 'تعديل السطر' : 'سطر جديد'), html, function (s) {
          var ta = q('#fef', s.el), prev = q('#fep', s.el), sep = q('#fesep', s.el);
          var curF = function () { return adv ? ta.value.trim() : termsToF(terms); };
          var preview = function () {
            var src = curF();
            if (!src) { prev.innerHTML = '<span class="muted">اضغط «+ إضافة عنصر» واختر ما تريد حسابه</span>'; return; }
            var r = tryFormula(src, ctx.from, ctx.to, ctx.vars, ctx.flt);
            prev.innerHTML = r.err ? '<span class="derr">✗ ' + esc(r.err) + '</span>' : '<span class="muted">النتيجة ' + esc(ctx.perLabel || '') + ':</span> <b class="num">' + fmtVal(r.v, q('#fefmt', s.el).value) + '</b>';
          };
          var drawTb = function () {
            var box = q('#tbm', s.el);
            if (adv) { box.innerHTML = '<div class="msg info">هذا حساب مكتوب يدوياً ولا يمكن عرضه كعناصر. عدّله من «كتابة الحساب يدوياً» أو <button type="button" class="btn sm" data-reset>ابدأ من جديد بالاختيار</button></div>'; q('[data-reset]', box).onclick = function () { adv = false; terms.length = 0; drawTb(); }; preview(); return; }
            box.innerHTML = tbHTML('tbmain', terms, ctx.names);
            bindTb(box, terms, ctx.names, function (light) { if (!light) drawTb(); else preview(); ta.value = termsToF(terms); });
            ta.value = termsToF(terms); preview();
          };
          var drawSub = function () { var box = q('#tbs', s.el); if (!box) return; box.innerHTML = tbHTML('tbsub', sub, ctx.names); bindTb(box, sub, ctx.names, function (light) { if (!light) drawSub(); }); };
          drawTb(); drawSub();
          if (!terms.length && !adv && !sepInit) setTimeout(function () { if (q('[data-tadd]', s.el)) q('[data-tadd]', s.el).click(); }, 60);
          var syncSep = function () { if (sep) q('#febody', s.el).hidden = sep.checked; };
          if (sep) { sep.onchange = syncSep; syncSep(); }
          ta.oninput = function () { var tt = fToTerms(ta.value); if (tt) { adv = false; terms.length = 0; tt.forEach(function (x) { terms.push(x); }); q('#tbm', s.el).innerHTML = tbHTML('tbmain', terms, ctx.names); bindTb(q('#tbm', s.el), terms, ctx.names, function (light) { if (!light) drawTb(); else preview(); ta.value = termsToF(terms); }); } else adv = true; preview(); };
          q('#fefmt', s.el).onchange = preview;
          q('#fesv', s.el).onclick = function () {
            var o = { name: q('#fen', s.el).value.trim() };
            if (!o.name) { q('#feerr', s.el).innerHTML = '<div class="msg err">اكتب الاسم</div>'; q('#fen', s.el).focus(); return; }
            if (sep && sep.checked) { s.done = true; s.close(); res({ name: o.name, f: '' }); return; }
            var src = curF();
            if (!src) { q('#feerr', s.el).innerHTML = '<div class="msg err">أضف عنصراً واحداً على الأقل</div>'; return; }
            var bad = !adv && terms.filter(function (t) { var dd = TKMAP[t.k]; return dd && ((dd.type === 'acc' && !(t.acc || []).length) || (dd.type === 'var' && !t.v) || (dd.type === 'num' && (t.n === '' || t.n === undefined))); })[0];
            if (bad) { q('#feerr', s.el).innerHTML = '<div class="msg err">أكمل اختيار: ' + esc(TKMAP[bad.k].label) + '</div>'; return; }
            try { parseFormula(src); } catch (e) { q('#feerr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; return; }
            if (adv) o.f = src; else { o.terms = terms; o.f = src; }
            o.fmt = q('#fefmt', s.el).value;
            if (kind === 'card') {
              o.id = d.id || ('c' + Date.now().toString(36));
              if (sub.length) { o.subTerms = sub; o.sub = termsToF(sub); }
              o.subl = q('#fesl', s.el).value.trim(); o.subfmt = q('#fesf', s.el).value;
              o.cmp = q('#fecmp', s.el).checked; o.good = q('#feg', s.el).value; o.rep = q('#ferep', s.el).value;
            }
            if (kind === 'frow') o.bold = q('#feb', s.el).checked;
            s.done = true; s.close(); res(o);
          };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    /* ---------- محرّر بند التقرير اليومي المبسّط: حسابات وقيم يدوية تُضاف أو تُخصم ---------- */
    var ACC_KINDS = [['رصيد', 'الرصيد في نهاية اليوم'], ['حركة', 'صافي حركة اليوم (مدين − دائن)'], ['مدين', 'المدين في اليوم'], ['دائن', 'الدائن في اليوم'], ['رصيد_دائن', 'الرصيد الدائن'], ['افتتاحي', 'الرصيد أول اليوم']];
    function dailySimpleOk(it) { if (!it) return true; var t = it.terms && it.terms.length ? it.terms : (it.f ? fToTerms(it.f) : []); return !!t && t.every(function (x) { return !x.op || x.op === '+' || x.op === '-'; }) && t.every(function (x) { return TKMAP[x.k] && TKMAP[x.k].type !== 'var'; }); }
    function editDaily(item, ctx) {
      if (item && !dailySimpleOk(item)) return editItem(item, 'row', ctx);
      return new Promise(function (res) {
        var d = JSON.parse(JSON.stringify(item || { name: '', fmt: 'dec2' }));
        var terms = (d.terms && d.terms.length ? d.terms : (d.f ? fToTerms(d.f) || [] : [])).map(function (t) { return Object.assign({}, t); });
        // صفر في البداية يعني أن أول عنصر مخصوم
        if (terms.length > 1 && terms[0].k === '#num' && Number(terms[0].n) === 0 && terms[1].op === '-') terms.shift(); else if (terms[0]) terms[0].op = terms[0].op || '+';
        var ready = []; TK.forEach(function (g) { g[1].forEach(function (t) { if (['acc', 'num', 'var'].indexOf(t[2]) < 0) ready.push([t[0], t[1], g[0]]); }); });
        var src = function () { var tt = terms.slice(); if (tt[0] && tt[0].op === '-') tt.unshift({ k: '#num', n: 0 }); return termsToF(tt.map(function (t, i) { var o = Object.assign({}, t); if (!i) delete o.op; return o; })); };
        var valOf = function (t) { var x = Object.assign({}, t); delete x.op; var r = tryFormula(termToF(x), ctx.from, ctx.to, ctx.vars, ctx.flt); return r.err ? '<span class="derr">✗</span>' : fmtVal(r.v, 'dec2'); };
        var accChips = function (t) { return (t.acc || []).map(function (c) { var a = F.D.byCode[c]; return '<span class="col-pill"><b class="num">' + esc(c) + '</b> ' + esc(a ? a.name : '(غير موجود)') + '</span>'; }).join('') || '<span class="small muted">لم تُختر حسابات</span>'; };
        var rowHTML = function (t, i) {
          var dd = TKMAP[t.k] || {}, body;
          if (dd.type === 'acc') body = '<select class="input dc-kind" data-dk="' + i + '">' + ACC_KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (t.k === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select><div class="st-pills dc-accs">' + accChips(t) + '<button type="button" class="btn sm" data-dacc="' + i + '">' + ((t.acc || []).length ? 'تغيير الحسابات' : 'اختر الحسابات') + '</button></div>';
          else if (dd.type === 'num') body = '<label class="dc-num"><span class="small muted">قيمة يدوية</span><input type="number" step="any" class="input num" data-dn="' + i + '" value="' + esc(t.n === undefined ? '' : t.n) + '" placeholder="0"></label>';
          else body = '<select class="input dc-kind" data-dr="' + i + '">' + ready.map(function (r) { return '<option value="' + r[0] + '"' + (t.k === r[0] ? ' selected' : '') + '>' + esc(r[2] + ' · ' + r[1]) + '</option>'; }).join('') + '</select>' + (termOpts(t) ? '<div class="small muted">' + esc(termOpts(t)) + '</div>' : '') +
            (dd.type === 'flt' || dd.type === 'stock' ? '<div class="st-pills dc-accs">' + (dd.type === 'stock' ? '<button type="button" class="chip tb-o' + ((t.st || []).length ? ' on' : '') + '" data-dfst="' + i + '">' + esc((t.st || []).length ? 'المخازن: ' + namesOf('st', stResolve(t.st)).join('، ') : 'كل المخازن') + ' ▾</button>' : '') + '<button type="button" class="chip tb-o' + ((t.flt && t.flt.acc || []).length ? ' on' : '') + '" data-dfacc="' + i + '">' + esc((t.flt && t.flt.acc || []).length ? 'الحسابات: ' + accNames(t.flt.acc).join('، ') : 'كل الحسابات') + ' ▾</button></div>' : '');
          return '<div class="dc-row' + (t.op === '-' ? ' minus' : '') + '"><button type="button" class="dc-sign" data-sg="' + i + '" title="إضافة أو خصم">' + (t.op === '-' ? '−' : '+') + '</button><div class="dc-main">' + body + '</div><div class="dc-val num">' + valOf(t) + '</div><button type="button" class="iconbtn" data-dcdel="' + i + '" aria-label="حذف">✕</button></div>';
        };
        var fmtOpts = FMT_SIMPLE.map(function (o) { return '<option value="' + o[0] + '"' + (d.fmt === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
        sheet(item && item.name ? 'تعديل البند' : 'بند جديد', '<div class="form dc">' +
          '<div class="field"><label class="lbl" for="dcn">اسم البند</label><input id="dcn" class="input" value="' + esc(d.name || '') + '" placeholder="مثل: النقدية المتاحة"></div>' +
          '<div class="field"><span class="lbl">مكوّنات البند (كل سطر يُضاف + أو يُخصم −)</span><div id="dcl" class="dc-list"></div>' +
          '<div class="row dc-add"><button type="button" class="btn sm" data-dadd-acc>+ حسابات</button><button type="button" class="btn sm" data-dadd-num>+ قيمة يدوية</button><button type="button" class="btn sm ghost" data-dadd-rd>+ بند جاهز (مبيعات، تحصيل…)</button></div></div>' +
          '<div class="fe-res" id="dct"></div>' +
          '<div class="field"><label class="lbl" for="dcf">شكل الرقم</label><select id="dcf" class="input">' + fmtOpts + '</select></div>' +
          '<div id="dcerr"></div><div class="row"><button type="button" class="btn ghost" id="dcadv">تعديل متقدم</button><span class="grow"></span><button class="btn primary big" id="dcsv">حفظ</button></div></div>', function (s) {
          var list = q('#dcl', s.el);
          var draw = function () {
            list.innerHTML = terms.length ? terms.map(rowHTML).join('') : '<p class="small muted" style="margin:0">أضف حسابات أو قيمة يدوية أو بنداً جاهزاً.</p>';
            var f = src(), r = f ? tryFormula(f, ctx.from, ctx.to, ctx.vars, ctx.flt) : null;
            q('#dct', s.el).innerHTML = !f ? '' : r.err ? '<span class="derr">✗ ' + esc(r.err) + '</span>' : '<span class="muted">قيمة البند ' + esc(ctx.perLabel || '') + ':</span> <b class="num">' + fmtVal(r.v, q('#dcf', s.el).value) + '</b>';
            qa('[data-sg]', list).forEach(function (b) { b.onclick = function () { var t = terms[Number(b.dataset.sg)]; t.op = t.op === '-' ? '+' : '-'; draw(); }; });
            qa('[data-dcdel]', list).forEach(function (b) { b.onclick = function () { terms.splice(Number(b.dataset.dcdel), 1); draw(); }; });
            qa('[data-dk]', list).forEach(function (el) { el.onchange = function () { terms[Number(el.dataset.dk)].k = el.value; draw(); }; });
            qa('[data-dr]', list).forEach(function (el) { el.onchange = function () { var t = terms[Number(el.dataset.dr)]; terms[Number(el.dataset.dr)] = { k: el.value, op: t.op }; draw(); }; });
            qa('[data-dn]', list).forEach(function (el) { el.onchange = function () { terms[Number(el.dataset.dn)].n = el.value === '' ? '' : Number(el.value); draw(); }; });
            qa('[data-dfst]', list).forEach(function (b) { b.onclick = function () { var t = terms[Number(b.dataset.dfst)]; pickMulti({ title: 'اختر المخازن', options: fltOptions('st'), value: t.st || [], resolve: stResolve, hint: stMixed() ? 'المخازن مقسّمة حسب الإدارة والفرع، فاختر من القسم الصحيح.' : '' }).then(function (v) { if (v) { t.st = v; draw(); } }); }; });
            qa('[data-dfacc]', list).forEach(function (b) { b.onclick = function () { var t = terms[Number(b.dataset.dfacc)], stk = (TKMAP[t.k] || {}).type === 'stock'; pickAccount({ multi: true, value: (t.flt && t.flt.acc) || [], title: 'اختر الحسابات (الحساب الرئيسي يشمل فروعه)', hint: stk ? 'مثل حساب الوكلاء: تُحسب الكمية لدى الحساب = المباع له − المرتجع منه حتى نهاية الفترة. اترك الاختيار فارغاً لكمية المخازن.' : 'تُحسب الكميات والمبالغ لفواتير هذه الحسابات فقط.' }).then(function (c) { if (!c) return; t.flt = t.flt || {}; if (c.length) t.flt.acc = c; else delete t.flt.acc; if (!Object.keys(t.flt).length) delete t.flt; draw(); }); }; });
            qa('[data-dacc]', list).forEach(function (b) { b.onclick = function () { var t = terms[Number(b.dataset.dacc)]; pickAcc(t.acc || []).then(function (c) { if (c) { t.acc = c; draw(); } }); }; });
          };
          var pickAcc = function (cur) { return pickAccount({ multi: true, value: cur.slice(), title: 'اختر الحسابات', hint: 'يمكن اختيار أكثر من حساب، رئيسي أو فرعي. يُجمع رصيدها أو حركتها معاً.' }); };
          q('[data-dadd-acc]', s.el).onclick = function () { pickAcc([]).then(function (c) { if (c && c.length) { terms.push({ k: 'رصيد', op: '+', acc: c }); draw(); } }); };
          q('[data-dadd-num]', s.el).onclick = function () { terms.push({ k: '#num', op: '+', n: '' }); draw(); var el = qa('[data-dn]', list).pop(); if (el) el.focus(); };
          q('[data-dadd-rd]', s.el).onclick = function () { terms.push({ k: 'مبيعات', op: '+' }); draw(); };
          q('#dcf', s.el).onchange = draw;
          q('#dcadv', s.el).onclick = function () { s.done = true; s.close(); var o = { name: q('#dcn', s.el).value.trim(), fmt: q('#dcf', s.el).value, f: src() }; o.terms = fToTerms(o.f) || []; editItem(o, 'row', ctx).then(res); };
          q('#dcsv', s.el).onclick = function () {
            var name = q('#dcn', s.el).value.trim(), err = q('#dcerr', s.el);
            if (!name) { err.innerHTML = '<div class="msg err">اكتب اسم البند</div>'; return; }
            if (!terms.length) { err.innerHTML = '<div class="msg err">أضف مكوّناً واحداً على الأقل</div>'; return; }
            var bad = terms.filter(function (t) { var dd = TKMAP[t.k] || {}; return (dd.type === 'acc' && !(t.acc || []).length) || (dd.type === 'num' && (t.n === '' || t.n === undefined || isNaN(Number(t.n)))); })[0];
            if (bad) { err.innerHTML = '<div class="msg err">' + (TKMAP[bad.k].type === 'acc' ? 'اختر الحسابات في كل سطر حسابات' : 'اكتب القيمة اليدوية') + '</div>'; return; }
            var tt = terms.map(function (t) { return Object.assign({}, t); }); if (tt[0].op === '-') tt.unshift({ k: '#num', n: 0 }); delete tt[0].op;
            var o = { name: name, terms: tt, f: termsToF(tt), fmt: q('#dcf', s.el).value };
            if (d.bold) o.bold = d.bold;
            s.done = true; s.close(); res(o);
          };
          s.onclose = function () { if (!s.done) res(null); };
          draw();
        });
      });
    }
    // قائمة قابلة للتعديل (ترتيب، تعديل، حذف) مع وصف الحساب بالكلمات والقيمة الحالية
    function listEditorHTML(key, list, ctx) {
      var vals = evalList(list, ctx.from, ctx.to);
      return '<div class="list fe-list">' + (list.length ? list.map(function (it, i) {
        var v = vals[i], hasF = !!itemF(it);
        return '<div class="item fe-row' + (!hasF ? ' fe-sep' : '') + '"><div class="main"><b>' + esc(it.name || '—') + '</b>' + (hasF ? '<div class="meta"><span class="fe-txt">' + esc(itemText(it)) + '</span><span>' + (v.err ? '<span class="derr">✗ ' + esc(v.err) + '</span>' : '= <b class="num">' + fmtVal(v.v, it.fmt) + '</b>') + '</span></div>' : '<div class="meta"><span>عنوان قسم</span></div>') + '</div>' +
          '<div class="fe-btns"><button class="iconbtn" data-le="' + key + '" data-op="up" data-i="' + i + '" title="أعلى"' + (i ? '' : ' disabled') + '>↑</button><button class="iconbtn" data-le="' + key + '" data-op="down" data-i="' + i + '" title="أسفل"' + (i < list.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button class="btn sm ghost" data-le="' + key + '" data-op="edit" data-i="' + i + '">تعديل</button><button class="btn sm ghost" data-le="' + key + '" data-op="del" data-i="' + i + '" title="حذف">✕</button></div></div>';
      }).join('') : '<p class="muted">لا توجد أسطر بعد</p>') + '</div>';
    }
    function bindListEditor(m, key, getList, kind, ctxFn, onChange) {
      qa('[data-le="' + key + '"]', m).forEach(function (b) {
        b.onclick = function () {
          var list = getList(), i = Number(b.dataset.i), op = b.dataset.op;
          if (op === 'up' && i > 0) { var t = list[i - 1]; list[i - 1] = list[i]; list[i] = t; onChange(); }
          else if (op === 'down' && i < list.length - 1) { var t2 = list[i + 1]; list[i + 1] = list[i]; list[i] = t2; onChange(); }
          else if (op === 'del') A.confirmBox('حذف', 'حذف «' + esc(list[i].name) + '»؟ (لا يُحذف نهائياً إلا بعد «حفظ التغييرات»)', 'حذف').then(function (y) { if (y) { list.splice(i, 1); onChange(); } });
          else if (op === 'edit') (key === 'daily' && itemF(list[i]) ? editDaily(list[i], ctxFn(i)) : editItem(list[i], kind, ctxFn(i))).then(function (o) { if (o) { list[i] = o; onChange(); } });
        };
      });
    }
    function ctxFor(list, i, from, to, label, flt) {
      var vars = {}, names = [];
      evalList(list.slice(0, i), from, to, flt).forEach(function (r, j) { var n = list[j].name; if (itemF(list[j]) && n) { vars[n] = r.err ? 'err' : r.v; names.push(n); } });
      return { from: from, to: to, vars: vars, names: names, perLabel: label, flt: flt };
    }

    /* ---------- منشئ التقرير المخصص ---------- */
    function legacyBuilderHTML() {
      var d = F.custom || (F.custom = { name: '', cat: 'تقاريري', def: { ds: 'sinv', row: 'month', col: '', meas: ['net', 'profit'], chart: 'bar', top: 0, fdim: '', filter: '' } });
      var df = d.def, formula = df.kind === 'formula';
      var opt = function (list, v) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
      var h = '<div class="card"><h2>تقرير مخصص</h2><p class="small muted" style="margin:0 0 10px">صمّم تقريرك واحفظه باسم ليظهر في «تقاريري المخصصة» لكل المستخدمين.</p>' +
        '<div class="chips" style="margin-bottom:12px"><button class="chip' + (formula ? '' : ' on') + '" data-bk="data">تجميع البيانات (صفوف وأعمدة)</button><button class="chip' + (formula ? ' on' : '') + '" data-bk="formula">بنود أختارها بنفسي (حساب مبسّط)</button></div><div class="form">';
      if (formula) {
        var t = today();
        h += '<p class="small" style="margin:0">أضف أسطراً، وكل سطر تختار له ما يُحسب من قائمة (مبيعات، رصيد حساب، مخزون…) وتربط بينها بـ + − × ÷ إن احتجت. ثم اختر الأعمدة: شهر، أسبوع، أو يوم.</p>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="bcols">الأعمدة</label><select id="bcols" class="input">' + opt([['single', 'عمود واحد (الفترة كاملة)'], ['month', 'عمود لكل شهر'], ['week', 'عمود لكل أسبوع'], ['day', 'عمود لكل يوم']], df.cols || 'month') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bch">رسم بياني (للسطر الأول)</label><select id="bch" class="input">' + opt([['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط']], df.chart || '') + '</select></div></div>' +
          '<div class="field"><span class="lbl">الأسطر</span>' + listEditorHTML('frow', df.rows || [], { from: t.slice(0, 7) + '-01', to: t }) +
          '<div class="row" style="margin-top:8px"><button class="btn sm" data-fadd>+ سطر</button><button class="btn sm ghost" data-fsep>+ عنوان قسم</button></div></div>';
      } else {
        var ds = DS[df.ds], dims = ds.dims.map(function (k) { return [k, DIMS[k][0]]; });
        h += '<div class="field"><label class="lbl" for="bds">مصدر البيانات</label><select id="bds" class="input">' + opt(Object.keys(DS).map(function (k) { return [k, DS[k].name]; }), df.ds) + '</select></div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="brow">الصفوف حسب</label><select id="brow" class="input">' + opt(dims, df.row) + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bcol">الأعمدة حسب (اختياري)</label><select id="bcol" class="input"><option value="">بدون</option>' + opt(dims.filter(function (x) { return x[0] !== df.row; }), df.col) + '</select></div></div>' +
          '<div class="field"><span class="lbl">الأرقام</span><div class="chips">' + Object.keys(ds.meas).map(function (k) { return '<label class="chip' + (df.meas.indexOf(k) >= 0 ? ' on' : '') + '"><input type="checkbox" hidden value="' + k + '"' + (df.meas.indexOf(k) >= 0 ? ' checked' : '') + '>' + esc(ds.meas[k][0]) + '</label>'; }).join('') + '</div>' +
          (df.col ? '<span class="small muted">مع «الأعمدة حسب» يُعرض الرقم الأول فقط موزعاً على الأعمدة</span>' : '') + '</div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="bfd">تصفية حسب (اختياري)</label><select id="bfd" class="input"><option value="">بدون</option>' + opt(dims, df.fdim) + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bfv">يحتوي على</label><input id="bfv" class="input" value="' + esc(df.filter || '') + '" placeholder="مثل: طرابلس"></div></div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="btop">العرض</label><select id="btop" class="input">' + opt([[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50']], df.top) + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bch">الرسم</label><select id="bch" class="input">' + opt([['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط'], ['hbar', 'أشرطة أفقية']], df.chart) + '</select></div></div>';
      }
      h += '<div class="row"><div class="field grow"><label class="lbl" for="bname">اسم التقرير</label><input id="bname" class="input" value="' + esc(d.name || '') + '" placeholder="' + (formula ? 'مثل: مؤشرات الإدارة الشهرية' : 'مثل: مبيعات العملاء شهرياً') + '"></div></div>' +
        '<div class="row"><button class="btn primary" data-brun>معاينة</button><button class="btn accent" data-bsave>' + (d.id ? 'حفظ التعديل' : 'حفظ التقرير') + '</button>' +
        (d.id ? '<button class="btn danger" data-bdel>حذف</button>' : '') + '<button class="btn ghost" data-bnew>جديد</button></div></div></div>';
      if (F.preview) {
        var t2 = today(), p = F.previewP || { from: t2.slice(0, 4) + '-01-01', to: t2 };
        var res = runCustom(df, p);
        h += '<div class="card"><div class="small muted">معاينة: ' + perLabel(p.from, p.to) + ' (يمكن تغيير الفترة بعد الحفظ)' + (res.note ? ' · ' + esc(plain(res.note)) : '') + '</div></div>' +
          (res.empty ? '<div class="card empty">' + esc(res.empty) + '</div>' : (res.chart && (res.chart.rowsOverride || res.rows.length > 1) ? '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>' : '') + '<div class="card scroll-x fin-table">' + tableHTML(res) + '</div>');
      }
      return h;
    }
    function legacyBindBuilder(m) {
      var d = F.custom, df = d.def;
      d._upd = null;
      var nm = q('#bname', m); nm.oninput = function () { d.name = this.value; };
      qa('[data-bk]', m).forEach(function (b) {
        b.onclick = function () {
          if ((b.dataset.bk === 'formula') === (df.kind === 'formula')) return;
          d.def = df = b.dataset.bk === 'formula' ? { kind: 'formula', cols: 'month', chart: '', rows: [{ name: 'صافي المبيعات', terms: [{ k: 'مبيعات' }], fmt: 'money' }, { name: 'مجمل الربح', terms: [{ k: 'ربح' }], fmt: 'money' }, { name: 'هامش الربح %', terms: [{ k: '#var', v: 'مجمل الربح' }, { k: '#var', v: 'صافي المبيعات', op: '/' }, { k: '#num', n: 100, op: '*' }], fmt: 'pct' }] }
            : { ds: 'sinv', row: 'month', col: '', meas: ['net', 'profit'], chart: 'bar', top: 0, fdim: '', filter: '' };
          F.preview = false; A.render();
        };
      });
      if (df.kind === 'formula') {
        var t = today(), from = t.slice(0, 7) + '-01';
        q('#bcols', m).onchange = function () { df.cols = this.value; A.render(); };
        q('#bch', m).onchange = function () { df.chart = this.value; A.render(); };
        df.rows = df.rows || [];
        bindListEditor(m, 'frow', function () { return df.rows; }, 'frow', function (i) { return ctxFor(df.rows, i, from, t, 'هذا الشهر'); }, function () { A.render(); });
        q('[data-fadd]', m).onclick = function () { editItem(null, 'frow', ctxFor(df.rows, df.rows.length, from, t, 'هذا الشهر')).then(function (o) { if (o) { df.rows.push(o); A.render(); } }); };
        q('[data-fsep]', m).onclick = function () { editItem({ name: '', f: '' }, 'row', { from: from, to: t }).then(function (o) { if (o) { df.rows.push({ name: o.name, f: o.f || '', fmt: o.fmt }); A.render(); } }); };
      } else {
        var upd = function (rerender) {
          df.ds = q('#bds', m).value;
          var dsd = DS[df.ds];
          if (dsd.dims.indexOf(df.row) < 0) df.row = dsd.dims[2];
          df.row = q('#brow', m).value && dsd.dims.indexOf(q('#brow', m).value) >= 0 ? q('#brow', m).value : df.row;
          df.col = q('#bcol', m).value; if (df.col === df.row || dsd.dims.indexOf(df.col) < 0) df.col = '';
          df.meas = qa('.chips input:checked', m).map(function (c) { return c.value; }).filter(function (k) { return dsd.meas[k]; });
          if (!df.meas.length) df.meas = [Object.keys(dsd.meas)[0]];
          df.fdim = q('#bfd', m).value; df.filter = q('#bfv', m).value.trim(); df.top = Number(q('#btop', m).value) || 0; df.chart = q('#bch', m).value;
          d.name = q('#bname', m).value.trim();
          if (rerender) A.render();
        };
        ['#bds', '#brow', '#bcol', '#bfd', '#btop', '#bch'].forEach(function (s) { q(s, m).onchange = function () { if (s === '#bds') { df.meas = []; df.row = 'month'; df.col = ''; df.fdim = ''; } upd(true); }; });
        qa('.chips label', m).forEach(function (l) { l.onclick = function (e) { e.preventDefault(); var c = q('input', l); c.checked = !c.checked; upd(true); }; });
        q('#bfv', m).onchange = function () { upd(F.preview); };
        d._upd = upd;
      }
      q('[data-brun]', m).onclick = function () { if (d._upd) d._upd(false); F.preview = true; A.render(); };
      q('[data-bnew]', m).onclick = function () { F.custom = null; F.preview = false; A.render(); };
      q('[data-bsave]', m).onclick = function () {
        if (d._upd) d._upd(false);
        d.name = nm.value.trim();
        if (!d.name) { toast('اكتب اسم التقرير', true); nm.focus(); return; }
        if (df.kind === 'formula' && !(df.rows || []).some(function (r) { return itemF(r); })) { toast('أضف سطراً فيه معادلة', true); return; }
        var b = this; busy(b, true);
        var def = JSON.parse(JSON.stringify(df));
        call('fin_report_save', { report: { id: d.id, name: d.name, cat: d.cat, def: def } }).then(function (r) {
          F.reports = r.reports; var saved = r.reports.filter(function (x) { return x.name === d.name; }).pop();
          toast('حُفظ التقرير في «تقاريري المخصصة»'); F.custom = null; F.preview = false;
          if (saved) openReport('c:' + saved.id, null, { noPush: true }); else go('reports');
        }).catch(function (e) { busy(b, false); toast(e.message, true); });
      };
      var del = q('[data-bdel]', m);
      if (del) del.onclick = function () {
        A.confirmBox('حذف التقرير', 'حذف «' + esc(d.name) + '» من التقارير المخصصة؟', 'حذف').then(function (y) {
          if (!y) return;
          call('fin_report_delete', { id: d.id }).then(function (r) { F.reports = r.reports; F.custom = null; F.preview = false; toast('حُذف التقرير'); go('reports'); }).catch(function (e) { toast(e.message, true); });
        });
      };
    }

    /* ---------- الإعدادات ---------- */
    var SET_TABS = [['boxes', 'الصناديق والبنوك'], ['cards', 'بطاقات لوحة المؤشرات'], ['daily', 'التقرير اليومي'], ['groups', 'مجموعات الحسابات'], ['cgroups', 'مجموعات العملاء'], ['igroups', 'مجموعات الأصناف'], ['reps', 'المندوبون وفئاتهم'], ['data', 'البيانات']];
    function boxSuggestions() {
      var defined = {}; F.boxes.forEach(function (b) { defined[b.acc] = 1; });
      return F.D.accList.filter(function (a) {
        if (!a.leaf || defined[a.id]) return false;
        var anc = acc(a.parent), names = a.name, g = 0;
        while (anc && g++ < 6) { names += ' ' + anc.name; anc = acc(anc.parent); }
        return /الصناديق|خزين|صندوق|المصارف|مصرف|بنك/.test(names) && !/معلق|حوالات|البطاقات/.test(a.name);
      }).map(function (a) { return { acc: a.id, name: a.name.trim(), kind: /مصرف|بنك/.test(a.name + ' ' + (acc(a.parent) || {}).name) ? 'بنك' : 'صندوق', bal: balance([a.id], null, null).close, n: (F.D.byAcc[a.id] || []).length }; })
        .filter(function (x) { return x.n > 0; }).sort(function (x, y) { return y.n - x.n; });
    }
    function editDraft(k) {
      F.edit = F.edit || {};
      if (!F.edit[k]) F.edit[k] = k === 'cards' ? JSON.parse(JSON.stringify(cards())) : JSON.parse(JSON.stringify(dailyDef()));
      return F.edit[k];
    }
    function settingsHTML() {
      var isMgr = A.st.user && A.st.user.role === 'manager', TABS = SET_TABS.concat(isMgr ? [['sec', 'الأمان والدخول']] : []);
      if (F.setTab === 'sec' && !isMgr) F.setTab = 'boxes';
      var tab = F.setTab || 'boxes', h = '<div class="chips fin-settabs">' + TABS.map(function (t) { return '<button class="chip' + (tab === t[0] ? ' on' : '') + '" data-stab="' + t[0] + '">' + t[1] + (F.dirtyKeys && F.dirtyKeys[t[0]] ? ' •' : '') + '</button>'; }).join('') + '</div>';
      var s = (F.meta && F.meta.settings) || {};
      if (tab === 'sec') return h + secHTML();
      if (tab === 'boxes') {
        // لكل فرع (والإدارة العامة) صناديقه وبنوكه منفصلة، لأن لكل منها دليل حسابات مستقل في سراج
        var brs = multiBr() ? branches() : [{ code: viewBr() === '*' ? '' : (F.curBr || ''), name: '' }];
        h += '<div class="card"><h2>الصناديق والبنوك</h2><p class="small muted" style="margin:0">عرّف الصناديق والحسابات المصرفية التي تريد متابعة أرصدتها وحركتها وتحصيلها. كل واحد مربوط بحساب في دليل حسابات سراج' + (multiBr() ? '، ولكل فرع وللإدارة العامة قائمة منفصلة' : '') + '. يمكنك تحديد أنواع السندات التي تظهر في تقارير كل صندوق. «إيقاف» يخفيه من التقارير، و«حذف التعريف» يلغي ربطه (ولا يمس سراج).</p></div>';
        brs.forEach(function (br) {
          var inBr = function () {
            var bx = F.boxes.filter(function (b) { return !multiBr() || !!T().acc[b.acc]; }).sort(function (a, b) { return (b.active - a.active) || (a.sort || 0) - (b.sort || 0); });
            var sug = boxSuggestions(), bts = T().bt || {};
            var o = '<div class="card box-br">' + (br.name ? '<h2 class="box-brh">' + esc(br.name) + ' <span class="badge">' + bx.filter(function (b) { return b.active; }).length + '</span></h2>' : '') +
              (bx.length ? '<div class="list">' + bx.map(function (b) {
                var tl = boxTypesOnly(b).map(function (t) { return (bts[t] || T().it[t] || {}).name || t; }), sd = boxSide(b);
                return '<div class="item' + (b.active ? '' : ' muted') + '"><div class="main"><b>' + esc(b.name) + ' <span class="badge">' + esc(b.kind) + '</span>' + (b.active ? '' : ' <span class="badge">موقوف</span>') + '</b><div class="meta"><span class="num">' + esc((acc(b.acc) || {}).code || '') + '</span><span>' + esc(accName(b.acc)) + '</span><span>الرصيد الآن: <b class="num">' + fm(balance([b.acc], null, null).close) + '</b></span></div>' +
                  '<div class="meta"><span>' + (tl.length ? 'السندات المعروضة: ' + esc(tl.join('، ')) : 'السندات المعروضة: كل الأنواع') + '</span><span class="badge' + (sd ? ' warn' : '') + '">' + (sd === 'dr' ? 'المدين فقط' : sd === 'cr' ? 'الدائن فقط' : 'مدين ودائن') + '</span></div></div>' +
                  '<div class="fe-btns"><button class="btn sm ghost" data-bedit="' + esc(b.id) + '" data-bbr="' + esc(br.code) + '">تعديل</button>' + (b.active ? '' : '<button class="btn sm ghost" data-bon="' + esc(b.id) + '">تفعيل</button>') + '<button class="btn sm ghost danger-t" data-bdel="' + esc(b.id) + '">حذف التعريف</button></div></div>';
              }).join('') + '</div>' : '<div class="msg info">لم يُعرّف أي صندوق أو بنك' + (br.name ? ' في ' + esc(br.name) : '') + ' بعد.</div>') +
              '<div class="row" style="margin-top:10px"><button class="btn primary" data-badd="' + esc(br.code) + '">+ تعريف صناديق أو بنوك' + (br.name ? ' في ' + esc(br.name) : '') + '</button><span class="small muted" style="align-self:center">يمكن تحديد عدة حسابات دفعة واحدة</span></div>';
            if (sug.length) o += '<details class="box-sug"' + (bx.length ? '' : ' open') + '><summary>حسابات مقترحة من دليل سراج (' + sug.length + ')</summary><p class="small muted" style="margin:6px 0 8px">حسابات تحت «الصناديق» و«المصارف» عليها حركة ولم تُعرّف بعد.</p><div class="list">' +
              sug.map(function (x) { return '<label class="item tap"><input type="checkbox" data-sug="' + esc(br.code) + '|' + esc(x.acc) + '|' + esc(x.kind) + '" data-sname="' + esc(x.name) + '"><div class="main"><b>' + esc(x.name) + '</b><div class="meta"><span class="badge">' + x.kind + '</span><span>' + fk(x.n) + ' حركة</span><span>الرصيد ' + fm(x.bal) + '</span></div></div></label>'; }).join('') +
              '</div><button class="btn accent" data-sugadd="' + esc(br.code) + '" style="margin-top:10px">تعريف المحدد</button></details>';
            return o + '</div>';
          };
          h += multiBr() ? withBr(br.code, inBr) : inBr();
        });
        h += collExclHTML();
        h += collAddHTML();
      } else if (tab === 'cards') {
        var cl = editDraft('cards'), r = presetRange('month');
        h += '<div class="card"><h2>بطاقات لوحة المؤشرات</h2><p class="small muted" style="margin:0 0 10px">كل بطاقة تختار لها ما تحسبه من قائمة (مثل: صافي المبيعات لعميل أو صنف معين، أو رصيد حساب ناقص رصيد حساب آخر). القيم الظاهرة هنا لهذا الشهر.</p>' +
          listEditorHTML('cards', cl, { from: r[0], to: r[1] }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-cadd>+ بطاقة</button><span class="grow"></span><button class="btn ghost" data-creset>استعادة الافتراضي</button><button class="btn accent" data-csave' + (F.dirtyKeys && F.dirtyKeys.cards ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>';
      } else if (tab === 'daily') {
        var dd = editDraft('daily'), d0 = F.D.maxDate || today();
        h += '<div class="card dev-set"><label class="chk"><input type="checkbox" id="devd"' + (devDaily() ? ' checked' : '') + '> إظهار علامة «قيد التطوير» على التقرير اليومي</label><p class="small muted" style="margin:4px 0 0">تظهر بجانب زر التقرير في القائمة ورسالةً أعلى التقرير. أزل التحديد عند اعتماد التقرير.</p></div>' +
          '<div class="card"><h2>التقرير اليومي للإدارة</h2><p class="small muted" style="margin:0 0 10px">رتّب الأسطر وغيّر معادلة كل سطر. القيم الظاهرة هنا ليوم ' + N(d0) + '.</p>' +
          '<div class="field"><label class="lbl" for="dtitle">عنوان التقرير</label><input id="dtitle" class="input" value="' + esc(dd.title || '') + '"></div>' +
          listEditorHTML('daily', dd.rows, { from: d0, to: d0 }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-dadd>+ سطر</button><button class="btn ghost" data-dsep>+ عنوان قسم</button><span class="grow"></span><button class="btn ghost" data-dreset>استعادة الافتراضي</button><button class="btn accent" data-dsave' + (F.dirtyKeys && F.dirtyKeys.daily ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>' +
          '<div class="card"><h3>ملاحظة عن Sell-Out</h3><p class="small" style="margin:0">«Total Sell-Out» افتراضياً = الكمية المباعة لكل العملاء. لحصره في عملاء أو أصناف أو مخزن معين: اضغط «تعديل» على السطر، ثم «كل العملاء» أو «كل الأصناف» واختر ما تريد.</p></div>';
      } else if (tab === 'igroups') {
        h += igSettingsHTML();
      } else if (tab === 'cgroups') {
        h += cgSettingsHTML() + grpDefaultSettingsHTML();
      } else if (tab === 'reps') {
        h += repsSettingsHTML();
      } else if (tab === 'groups') {
        var grpField = function (k, code) {
          var codes = multiBr() ? grpCodes(k, code) : (s[k] || (k === 'recv' ? '1601' : '261'));
          var n = multiBr() ? leavesOf(byCodes(codes, code)).length : (k === 'recv' ? recvIds() : payIds()).length;
          return '<div class="field"><span class="lbl">' + (k === 'recv' ? 'حسابات العملاء (للمديونيات وأعمار الديون والتحصيل)' : 'حسابات الموردين') + '</span><button class="input" data-grp="' + k + '" data-gbr="' + esc(multiBr() ? code : '') + '" style="text-align:start">' + esc(grpLabel(codes, multiBr() ? code : undefined)) + '</button><span class="small muted">' + fk(n) + (k === 'recv' ? ' حساب عميل' : ' حساب مورد') + '</span></div>';
        };
        h += '<div class="card"><h2>مجموعات الحسابات</h2>' + (multiBr() ? '<p class="small muted" style="margin:0 0 10px">لكل فرع دليل حسابات مستقل في سراج، فحدّد حسابات العملاء والموردين لكل فرع.</p>' : '') + '<div class="form">' +
          (multiBr() ? branches().map(function (b) { return '<h3 style="margin:6px 0 0">' + esc(b.name) + '</h3>' + grpField('recv', b.code) + grpField('pay', b.code); }).join('') : grpField('recv', '') + grpField('pay', '')) +
          '<div class="field"><label class="lbl" for="fys">بداية السنة المالية</label><input type="date" class="input num" id="fys" value="' + esc(s.year_start || '2026-01-01') + '" style="max-width:200px"></div></div></div>';
      } else {
        h += '<div class="card"><h2>البيانات على هذا الجهاز</h2><p class="small" style="margin:0">' + fk(dataCount()) + ' سجل · آخر مزامنة ' + esc((F.meta && F.meta.last) || '—') + '</p><p class="small muted">تُحفظ البيانات المالية على هذا الجهاز لتعمل التقارير بسرعة وبلا إنترنت، وتُمسح عند الخروج من التطبيق.</p><button class="btn sm ghost" data-open="data_check">فحص سلامة البيانات</button></div>';
      }
      return h;
    }
    function grpLabel(codes, br) { return String(codes).split(',').map(function (c) { var a = (F.D.byCodeAll[c] || []).filter(function (x) { return br === undefined || x.br === br; })[0]; return a ? c + ' · ' + a.name : c + (br !== undefined ? ' (غير موجود في هذا الفرع)' : ''); }).join('، '); }
    function markDirty(k, on) { F.dirtyKeys = F.dirtyKeys || {}; F.dirtyKeys[k] = on; F.dirty = Object.keys(F.dirtyKeys).some(function (x) { return F.dirtyKeys[x]; }); }
    function saveConfig(k, value, btn) {
      if (btn) busy(btn, true);
      return call('fin_config_save', { key: k, value: value }).then(function (r) {
        F.config = r.config || {}; F.edit[k] = null; markDirty(k, false); PARSED = {};
        S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config });
        toast(value === null ? 'استُعيد الافتراضي' : 'حُفظ'); A.render();
      }).catch(function (e) { if (btn) busy(btn, false); toast(e.message, true); });
    }
    /* ---------- حسابات لا تُحسب حركاتها في التحصيل ---------- */
    function collExclHTML() {
      var lst = collExclList(), y0 = yearStart(), t0 = today(), amt = {};
      if (lst.length) collLines(y0, t0, null, true).forEach(function (l) { var k = l.exa[0]; if (k) amt[k] = (amt[k] || 0) + l.amt; });
      var brs = multiBr() ? branches() : [{ code: '', name: '' }], bts = T().bt || {};
      var tname = function (t) { return (bts[t] || T().it[t] || {}).name || t; };
      return '<div class="card cx-card"><h2>حسابات لا تُحسب حركاتها في التحصيل</h2><p class="small muted" style="margin:0 0 10px">لكل حساب تختار أنواع الحركات المستبعدة (افتراضياً سندات القبض فقط) والحسابات المقابلة (افتراضياً أي حساب). أي سند من هذه الأنواع بين الحساب وأحد حساباته المقابلة لا يُحسب تحصيلاً في كل التقارير ولوحة المؤشرات. استعملها للحسابات بين الإدارة والفروع حتى لا يُحسب نفس المبلغ مرتين. الحساب الرئيسي يشمل فروعه.</p>' +
        (lst.length ? '<div class="list">' + lst.map(function (x, i) { var a = acc(x.acc), ty = Array.isArray(x.types) ? x.types : [], cps = Array.isArray(x.cps) ? x.cps : [];
          return '<div class="item"><div class="main"><b>' + esc(a ? a.name : x.name) + '</b><div class="meta"><span class="num">' + esc(a ? a.code : x.code) + '</span>' + (multiBr() ? '<span class="badge">' + esc(brName((a && a.br) || '')) + '</span>' : '') + (a ? '' : '<span class="badge warn">غير موجود في البيانات الحالية</span>') +
            '</div><div class="meta cx-rule">' + (cps.length ? '' : '<span class="badge' + (ty.length ? '' : ' warn') + '">' + (ty.length ? 'الأنواع: ' + esc(ty.map(tname).join('، ')) : 'كل أنواع الحركات') + '</span>') +
            '</div>' + (cps.length ? cps.map(function (c) { var ca = acc(c.acc), ct = Array.isArray(c.types) ? c.types : []; return '<div class="meta cx-rule"><span class="badge">مقابل: ' + esc(ca ? ca.code + ' ' + ca.name : c.name || c.code) + '</span><span class="badge' + (ct.length ? '' : ' warn') + '">' + (ct.length ? esc(ct.map(tname).join('، ')) : 'كل أنواع الحركات') + '</span></div>'; }).join('') : '<div class="meta cx-rule"><span class="badge warn">مع أي حساب مقابل</span></div>') + '<div class="meta cx-rule">' +
            '<span>المستبعد منذ بداية السنة: <b class="num">' + fm(amt[x.acc] || 0) + '</b></span></div></div>' +
            (canEdit() ? '<div class="fe-btns"><button class="btn sm" data-cxed="' + i + '">الحسابات المقابلة والحركات</button><button class="btn sm ghost" data-cxdel="' + i + '">إلغاء الاستبعاد</button></div>' : '') + '</div>'; }).join('') + '</div>' :
          '<div class="msg info">لا توجد حسابات مستبعدة: كل ما يدخل الصناديق والبنوك المعرّفة من حسابات العملاء يُحسب تحصيلاً.</div>') +
        (canEdit() ? '<div class="row" style="margin-top:10px">' + brs.map(function (b) { return '<button class="btn" data-cxadd="' + esc(b.code) + '">+ حساب مستبعد' + (b.name ? ' من ' + esc(b.name) : '') + '</button>'; }).join('') + '<span class="grow"></span><button class="btn ghost" data-cxrep>عرض الحركات المستبعدة</button></div>' : '') + '</div>';
    }
    // أنواع السندات التي فيها الحساب طرفاً وكانت ستُحسب تحصيلاً منذ بداية السنة: { نوع: { name, n, amt, r } }
    // كل أنواع السندات التي فيها الحساب طرفاً منذ بداية السنة، ومعها أثر كل نوع في التحصيل: { نوع: { name, lines, n, amt, r } }
    function collAccTypes(id, cps) {
      var ids = accTree(id), cp = null, y0 = yearStart(); if (cps && cps.length) { cp = {}; cps.forEach(function (c) { accTree(c.acc, cp); }); }
      var o = {}, seen = {};
      Object.keys(ids).forEach(function (aid) { (F.D.byAcc[aid] || []).forEach(function (l) { if (l.d < y0) return; var t = String(l.bt), r = o[t] || (o[t] = { name: l.btn || t, lines: 0, n: 0, amt: 0, r: false }); r.lines++; if (l.k === 'r') r.r = true; }); });
      collLines(y0, today(), null, 'raw').forEach(function (l) {
        if (!l.accs.some(function (a) { return ids[a]; })) return;
        if (cp && !l.accs.some(function (a) { return cp[a] && !ids[a]; })) return;
        var t = String(l.bt), r = o[t] || (o[t] = { name: l.btn || t, lines: 0, n: 0, amt: 0, r: false });
        if (!seen[t + '|' + l.e]) { seen[t + '|' + l.e] = 1; r.n++; } r.amt += l.amt;
      });
      return o;
    }
    // الحسابات المقابلة: الحسابات التي ظهرت مع الحساب في سندات التحصيل منذ بداية السنة أولاً (بمبالغها)، ثم بقية الدليل
    function collCpPick(x) {
      var ids = accTree(x.acc), amt = {};
      collLines(yearStart(), today(), null, 'raw').forEach(function (l) { if (!l.accs.some(function (a) { return ids[a]; })) return; var seen = {}; l.accs.forEach(function (a) { if (ids[a] || seen[a]) return; seen[a] = 1; amt[a] = (amt[a] || 0) + l.amt; }); });
      var top = Object.keys(amt).sort(function (a, b) { return amt[b] - amt[a]; }).map(function (a) { var ac = acc(a); return ac ? Object.assign({}, ac, { name: ac.name + '  — ' + fm(amt[a]), lvl: 1 }) : null; }).filter(Boolean);
      var rest = F.D.accList.filter(function (a) { return !amt[a.id] && !ids[a.id]; });
      return pickAccount({ title: 'الحسابات المقابلة لـ ' + (x.name || x.code), multi: true, byId: true, list: top.concat(rest), value: (Array.isArray(x.cps) ? x.cps : []).map(function (c) { return String(c.acc); }),
        hint: 'لا يُستبعد إلا السند الذي فيه أحد هذه الحسابات مقابل الحساب المستبعد. في الأعلى الحسابات التي ظهرت معه في سندات التحصيل منذ بداية السنة بمبالغها. بلا اختيار = أي حساب مقابل.' })
        .then(function (v) { return v === null ? null : v.map(function (id) { var a = acc(id) || {}; return { acc: id, code: a.code || '', name: (a.name || '').trim() }; }); });
    }
    // محرّر قاعدة الاستبعاد: الحسابات المقابلة، ولكل حساب مقابل أنواع حركاته (أو أنواع عامة مع أي حساب مقابل)
    function collRuleEditor(x0, br, isNew) {
      var x = JSON.parse(JSON.stringify(x0)); x.cps = Array.isArray(x.cps) ? x.cps : []; x.types = Array.isArray(x.types) ? x.types : [];
      var inBr = function (fn) { return multiBr() ? withBr(br, fn) : fn(); };
      var raw = inBr(function () { return collLines(yearStart(), today(), null, 'raw'); }), ex = inBr(function () { return accTree(x.acc); });
      // أنواع السندات بين الحساب المستبعد وحساب مقابل (أو أي حساب): { نوع: { name, n, amt, r } }
      var pairTypes = function (cpId) {
        return inBr(function () {
          var cp = cpId ? accTree(cpId) : null, y0 = yearStart(), o = {}, seen = {};
          Object.keys(ex).forEach(function (aid) { (F.D.byAcc[aid] || []).forEach(function (l) {
            if (l.d < y0 || seen[l.e]) return; var ls = F.D.byEntry[l.e] || [];
            if (cp && !ls.some(function (q) { return cp[q.a] && !ex[q.a]; })) return;
            seen[l.e] = 1; var t = String(l.bt), r = o[t] || (o[t] = { name: l.btn || t, n: 0, amt: 0, r: false }); r.n++; if (l.k === 'r') r.r = true; }); });
          raw.forEach(function (l) { if (!l.accs.some(function (a) { return ex[a]; })) return; if (cp && !l.accs.some(function (a) { return cp[a] && !ex[a]; })) return; var t = String(l.bt); if (o[t]) o[t].amt += l.amt; });
          return o;
        });
      };
      if (isNew && !x.cps.length && !x.types.length) { var o0 = pairTypes(null); x.types = Object.keys(o0).filter(function (k) { return o0[k].r; }); }
      return new Promise(function (res) {
        sheet('الحسابات المقابلة والحركات — ' + (x.name || x.code), '<div class="msg info">اختر الحسابات المقابلة للحساب المستبعد، ولكل حساب مقابل أنواع الحركات التي لا تُحسب تحصيلاً. بجانب كل نوع: عدد السندات بينهما منذ بداية السنة وما يضيفه حالياً إلى التحصيل. بلا اختيار أنواع = كل الأنواع.</div><div id="cxe"></div>' +
          '<div class="row" style="margin-top:10px"><button class="btn" data-cxeadd>+ إضافة حساب مقابل</button><span class="grow"></span><button class="btn primary" data-cxesave>حفظ</button></div>', function (s) {
          var box = q('#cxe', s.el);
          var chips = function (o, sel, key) {
            var ks = Object.keys(o).sort(function (a, b) { return (o[b].amt - o[a].amt) || (o[b].n - o[a].n); });
            if (!ks.length) return '<div class="small muted">لا توجد سندات بينهما منذ بداية السنة.</div>';
            return '<div class="cxe-types">' + ks.map(function (k) { var r = o[k], on = sel.indexOf(k) >= 0; return '<button type="button" class="chip cxe-t' + (on ? ' on' : '') + '" data-cxet="' + esc(key) + '|' + esc(k) + '"><b>' + esc(r.name) + '</b><span>' + r.n + ' سند · ' + (r.amt > 0.005 ? 'يضيف للتحصيل ' + fm(r.amt) : 'لا يدخل في التحصيل') + '</span></button>'; }).join('') + '</div>' +
              '<div class="small muted">' + (sel.length ? 'المستبعد: ' + sel.map(function (k) { return (o[k] || { name: k }).name; }).join('، ') : 'لم تُحدَّد أنواع: تُستبعد كل الأنواع') + '</div>';
          };
          var draw = function () {
            box.innerHTML = x.cps.length ? x.cps.map(function (c, i) { var ca = inBr(function () { return acc(c.acc); }); c.types = Array.isArray(c.types) ? c.types : [];
              return '<div class="cxe-cp"><div class="cxe-h"><b>' + esc(ca ? ca.code + ' · ' + ca.name : c.name || c.code) + '</b><span class="grow"></span><button class="btn sm ghost" data-cxerm="' + i + '">حذف</button></div>' + chips(pairTypes(c.acc), c.types.map(String), String(i)) + '</div>'; }).join('')
              : '<div class="cxe-cp"><div class="cxe-h"><b>أي حساب مقابل</b></div>' + chips(pairTypes(null), x.types.map(String), 'all') + '</div>';
            qa('[data-cxet]', box).forEach(function (b) { b.onclick = function () { var p = b.dataset.cxet.split('|'), list = p[0] === 'all' ? x.types : x.cps[Number(p[0])].types, j = list.map(String).indexOf(p[1]); if (j >= 0) list.splice(j, 1); else list.push(p[1]); draw(); }; });
            qa('[data-cxerm]', box).forEach(function (b) { b.onclick = function () { x.cps.splice(Number(b.dataset.cxerm), 1); draw(); }; });
          };
          draw();
          q('[data-cxeadd]', s.el).onclick = function () {
            inBr(function () { return collCpPick(x); }).then(function (c) { if (!c) return;
              x.cps = c.map(function (n) { var old = x.cps.filter(function (y) { return String(y.acc) === String(n.acc); })[0]; if (old) return old; var o = pairTypes(n.acc); n.types = Object.keys(o).filter(function (k) { return o[k].amt > 0.005; }); return n; });
              draw(); });
          };
          q('[data-cxesave]', s.el).onclick = function () { s.done = true; s.close(); if (x.cps.length) x.types = []; res(x); };
          s.onclose = function () { if (!s.done) res(isNew ? x : null); };
        });
      });
    }
    function collTypesPick(x, isNew) {
      var o = collAccTypes(x.acc, x.cps), keys = Object.keys(o).sort(function (a, b) { return (o[b].amt > 0.005) - (o[a].amt > 0.005) || (o[b].amt - o[a].amt) || (o[b].r - o[a].r) || (o[b].lines - o[a].lines); });
      if (!keys.length) { toast('لا توجد حركات على هذا الحساب منذ بداية السنة؛ يُستبعد بكل الأنواع'); return Promise.resolve(isNew ? [] : null); }
      var def = Array.isArray(x.types) && x.types.length ? x.types.map(String) : isNew ? keys.filter(function (k) { return o[k].r; }) : [];
      var none = keys.every(function (k) { return !(o[k].amt > 0.005); });
      return pickMulti({ title: 'أنواع الحركات المستبعدة — ' + (x.name || x.code), value: def,
        hint: 'كل أنواع الحركات على هذا الحساب منذ بداية السنة' + (x.cps && x.cps.length ? ' (مع الحسابات المقابلة المحددة)' : '') + '. بجانب كل نوع: ما يضيفه حالياً إلى التحصيل، أو «لا يدخل في التحصيل» إن كان لا يُحسب أصلاً (فاستبعاده لا يغيّر شيئاً). بلا اختيار = كل الأنواع.' + (none ? ' تنبيه: لا شيء من حركات هذا الحساب يُحسب تحصيلاً حالياً، لأنه ليس حساب عميل ولا صندوقاً أو بنكاً معرّفاً.' : ''),
        options: keys.map(function (k) { var r = o[k]; return { id: k, name: r.name, sub: (r.amt > 0.005 ? 'يضيف للتحصيل ' + fm(r.amt) + ' (' + r.n + ' سند)' : 'لا يدخل في التحصيل') + ' · ' + r.lines + ' سطر على الحساب' + (r.r ? ' · سند قبض' : '') }; }) })
        .then(function (v) { return v === null && isNew ? def : v; });   // إغلاق النافذة لحساب جديد = سندات القبض فقط
    }
    function collExclSave(list, btn) {
      if (btn) busy(btn, true);
      return call('fin_config_save', { key: 'collx', value: list }).then(function (r) { F.config = r.config || {}; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); resetCache(); toast('حُفظ'); A.render(); })
        .catch(function (e) { if (btn) busy(btn, false); toast(e.message, true); });
    }
    /* ---------- حسابات أخرى تُحسب في التحصيل ---------- */
    // ما أضافته كل قاعدة إلى التحصيل في الفترة (الحساب وفروعه، دون حسابات العملاء الأصلية): { acc: مبلغ }
    function collAddAmounts(from, to) {
      var lst = collAddList(), out = {}; if (!lst.length) return out;
      var base = {}; recvIds().forEach(function (x) { base[x] = 1; });
      var trees = lst.map(function (x) { return { acc: String(x.acc), t: accTree(x.acc) }; });
      collLines(from, to).forEach(function (l) { if (!l.cus || !(l.cR > 0)) return; Object.keys(l.cus).forEach(function (a) { if (base[a]) return; trees.forEach(function (r) { if (r.t[a]) out[r.acc] = (out[r.acc] || 0) + l.amt * l.cus[a] / l.cR; }); }); });
      return out;
    }
    // أنواع السندات التي يكون فيها الحساب (وفروعه) دائناً مقابل صندوق أو بنك منذ بداية السنة: { نوع: { name, n, amt } }
    function collAddTypes(id) {
      var ids = accTree(id), bx = {}, y0 = yearStart(), o = {}, seen = {}; boxIds('').forEach(function (x) { bx[x] = 1; });
      Object.keys(ids).forEach(function (aid) { if (bx[aid]) return; (F.D.byAcc[aid] || []).forEach(function (l) {
        if (l.d < y0 || !l.cr || seen[l.e]) return; seen[l.e] = 1;
        var ls = F.D.byEntry[l.e] || [], dB = 0, cA = 0; ls.forEach(function (q) { if (bx[q.a] && q.dr) dB += q.dr; if (ids[q.a] && !bx[q.a] && q.cr) cA += q.cr; });
        var t = String(l.bt), r = o[t] || (o[t] = { name: l.btn || t, n: 0, amt: 0 }); if (dB > 0) { r.n++; r.amt += Math.min(dB, cA); }
      }); });
      Object.keys(o).forEach(function (t) { if (!o[t].n) delete o[t]; });
      return o;
    }
    function collAddTypesPick(x, br, isNew) {
      var o = multiBr() ? withBr(br, function () { return collAddTypes(x.acc); }) : collAddTypes(x.acc), keys = Object.keys(o).sort(function (a, b) { return o[b].amt - o[a].amt; });
      if (!keys.length) { toast('لا توجد منذ بداية السنة سندات دخل فيها مبلغ من هذا الحساب إلى صندوق أو بنك؛ سيُحسب بكل الأنواع عند حدوثها'); return Promise.resolve(isNew ? [] : null); }
      var def = Array.isArray(x.types) && x.types.length ? x.types.map(String) : isNew ? keys.slice() : [];
      return pickMulti({ title: 'أنواع السندات المحسوبة تحصيلاً — ' + (x.name || x.code), value: def,
        hint: 'أنواع السندات التي دخل فيها مبلغ من هذا الحساب (دائن) إلى صندوق أو بنك معرّف منذ بداية السنة، وبجانب كل نوع ما سيضيفه إلى التحصيل. اختر ما يُحسب تحصيلاً فقط (مثلاً سندات القبض). بلا اختيار = كل الأنواع.',
        options: keys.map(function (k) { var r = o[k]; return { id: k, name: r.name, sub: 'يضيف ' + fm(r.amt) + ' (' + r.n + ' سند منذ بداية السنة)' }; }) })
        .then(function (v) { return v === null && isNew ? def : v; });
    }
    function collAddHTML() {
      var lst = collAddList(), amt = collAddAmounts(yearStart(), today()), brs = multiBr() ? branches() : [{ code: '', name: '' }], bts = T().bt || {};
      var tname = function (t) { return (bts[t] || T().it[t] || {}).name || t; };
      var tot = Object.keys(amt).reduce(function (s0, k) { return s0 + amt[k]; }, 0);
      return '<div class="card cx-card"><h2>حسابات أخرى تُحسب في التحصيل</h2><p class="small muted" style="margin:0 0 10px">التحصيل يُحسب أصلاً من حسابات العملاء فقط. أضف هنا حسابات أخرى (مثل السلف أو حسابات جارية أو إيرادات أخرى): أي سند يكون فيه الحساب دائناً مقابل صندوق أو بنك معرّف يُحسب تحصيلاً في كل التقارير ولوحة المؤشرات، بنفس قاعدة العملاء. لا يؤثر على المديونيات وأعمار الديون. حسابات الاستبعاد أعلاه تنطبق عليها أيضاً. الحساب الرئيسي يشمل فروعه.</p>' +
        (lst.length ? '<div class="list">' + lst.map(function (x, i) { var a = acc(x.acc), ty = Array.isArray(x.types) ? x.types : [];
          return '<div class="item"><div class="main"><b>' + esc(a ? a.name : x.name) + '</b><div class="meta"><span class="num">' + esc(a ? a.code : x.code) + '</span>' + (multiBr() ? '<span class="badge">' + esc(brName((a && a.br) || '')) + '</span>' : '') + (a ? '' : '<span class="badge warn">غير موجود في البيانات الحالية</span>') + '</div>' +
            '<div class="meta cx-rule"><span class="badge' + (ty.length ? '' : ' warn') + '">' + (ty.length ? 'الأنواع: ' + esc(ty.map(tname).join('، ')) : 'كل أنواع السندات') + '</span></div>' +
            '<div class="meta cx-rule"><span>أضاف للتحصيل منذ بداية السنة: <b class="num">' + fm(amt[String(x.acc)] || 0) + '</b></span></div></div>' +
            (canEdit() ? '<div class="fe-btns"><button class="btn sm" data-caty="' + i + '">أنواع السندات</button><button class="btn sm ghost" data-cadel="' + i + '">إزالة</button></div>' : '') + '</div>'; }).join('') + '</div>' +
          '<div class="small muted" style="margin-top:6px">المجموع المضاف منذ بداية السنة: <b class="num">' + fm(tot) + '</b></div>' :
          '<div class="msg info">لا توجد حسابات إضافية: التحصيل من حسابات العملاء فقط.</div>') +
        (canEdit() ? '<div class="row" style="margin-top:10px">' + brs.map(function (b) { return '<button class="btn" data-caadd="' + esc(b.code) + '">+ حساب تحصيل' + (b.name ? ' في ' + esc(b.name) : '') + '</button>'; }).join('') + '</div>' : '') + '</div>';
    }
    function collAddSave(list, btn) {
      if (btn) busy(btn, true);
      return call('fin_config_save', { key: 'colla', value: list }).then(function (r) { F.config = r.config || {}; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); resetCache(); toast('حُفظ'); A.render(); })
        .catch(function (e) { if (btn) busy(btn, false); toast(e.message, true); });
    }
    function bindCollAdd(m) {
      qa('[data-caadd]', m).forEach(function (b) { b.onclick = function () {
        var code = b.dataset.caadd, inBr = function (fn) { return multiBr() ? withBr(code, fn) : fn(); };
        var bx = {}, rv = {}; inBr(function () { boxIds('').forEach(function (x) { bx[x] = 1; }); recvIds().forEach(function (x) { rv[x] = 1; }); });
        var list = inBr(function () { return F.D.accList.slice(); }).filter(function (a) { return !bx[a.id] && !rv[a.id]; }), cur = collAddList();
        pickAccount({ title: 'حسابات أخرى تُحسب في التحصيل' + (multiBr() ? ' — ' + brName(code) : ''), list: list, multi: true, byId: true, value: cur.map(function (x) { return String(x.acc); }).filter(function (id) { return list.some(function (a) { return a.id === id; }); }),
          hint: 'حسابات غير العملاء يُقبض منها مبالغ إلى الصناديق والبنوك (سلف، حسابات جارية، إيرادات أخرى…). لا تظهر هنا الصناديق والبنوك المعرّفة ولا حسابات العملاء لأنها محسوبة أصلاً. الحساب الرئيسي يشمل فروعه.' }).then(function (ids) {
          if (!ids) return;
          var other = cur.filter(function (x) { return !list.some(function (a) { return a.id === String(x.acc); }); });
          var add = ids.map(function (id) { var old0 = cur.filter(function (x) { return String(x.acc) === id; })[0]; if (old0) return old0; var a = list.filter(function (x) { return x.id === id; })[0] || {}; return { acc: id, code: a.code || '', name: (a.name || '').trim(), types: [], _new: true }; });
          var seq = Promise.resolve();
          add.forEach(function (x) { if (!x._new) return; seq = seq.then(function () { delete x._new; return collAddTypesPick(x, code, true).then(function (t) { x.types = t || []; }); }); });
          seq.then(function () { collAddSave(other.concat(add), b); });
        });
      }; });
      qa('[data-caty]', m).forEach(function (b) { b.onclick = function () { var l = collAddList().map(function (x) { return JSON.parse(JSON.stringify(x)); }), i = Number(b.dataset.caty), x = l[i], a = acc(x.acc);
        collAddTypesPick(x, a ? a.br || '' : '', false).then(function (t) { if (t === null) return; l[i].types = t; collAddSave(l, b); }); }; });
      qa('[data-cadel]', m).forEach(function (b) { b.onclick = function () { var l = collAddList().slice(), x = l[Number(b.dataset.cadel)]; A.confirmBox('إزالة من التحصيل', 'لا تُحسب حركات «' + esc(x.name || x.code) + '» تحصيلاً بعد الآن؟', 'إزالة').then(function (y) { if (!y) return; l.splice(Number(b.dataset.cadel), 1); collAddSave(l, b); }); }; });
    }
    function bindCollExcl(m) {
      qa('[data-cxadd]', m).forEach(function (b) { b.onclick = function () {
        var code = b.dataset.cxadd, list = multiBr() ? withBr(code, function () { return F.D.accList.slice(); }) : F.D.accList, cur = collExclList();
        pickAccount({ title: 'حساب لا تُحسب حركاته في التحصيل' + (multiBr() ? ' — ' + brName(code) : ''), list: list, multi: true, byId: true, value: cur.map(function (x) { return String(x.acc); }).filter(function (id) { return list.some(function (a) { return a.id === id; }); }),
          hint: 'مثل حساب الفرع في الإدارة العامة، أو حساب الإدارة في الفرع. الحساب الرئيسي يشمل فروعه.' }).then(function (ids) {
          if (!ids) return;
          var other = cur.filter(function (x) { return !list.some(function (a) { return a.id === String(x.acc); }); });
          var add = ids.map(function (id) { var old0 = cur.filter(function (x) { return String(x.acc) === id; })[0]; if (old0) return old0; var a = list.filter(function (x) { return x.id === id; })[0] || acc(id) || {}; return { acc: id, code: a.code || '', name: (a.name || '').trim(), types: null, _new: true }; });
          // الحسابات الجديدة: اختيار أنواع الحركات (افتراضياً سندات القبض)
          var seq = Promise.resolve();
          add.forEach(function (x, k) { if (!x._new) return; seq = seq.then(function () { delete x._new; x.types = []; return collRuleEditor(x, code, true).then(function (y) { if (y) add[k] = y; }); }); });
          seq.then(function () { collExclSave(other.concat(add), b); });
        });
      }; });
      qa('[data-cxed]', m).forEach(function (b) { b.onclick = function () { var l = collExclList().map(function (x) { return JSON.parse(JSON.stringify(x)); }), i = Number(b.dataset.cxed), x = l[i], a = acc(x.acc), br = a ? a.br || '' : '';
        collRuleEditor(x, br, false).then(function (y) { if (!y) return; l[i] = y; collExclSave(l, b); }); }; });
      qa('[data-cxdel]', m).forEach(function (b) { b.onclick = function () { var l = collExclList().slice(), x = l[Number(b.dataset.cxdel)]; A.confirmBox('إلغاء الاستبعاد', 'تُحسب حركات «' + esc(x.name || x.code) + '» تحصيلاً من جديد؟', 'إلغاء الاستبعاد').then(function (y) { if (!y) return; l.splice(Number(b.dataset.cxdel), 1); collExclSave(l, b); }); }; });
      var rb = q('[data-cxrep]', m); if (rb) rb.onclick = function () { openReport('coll_offset', { view: 'excl', preset: 'year', from: yearStart(), to: today() }); A.go('reports'); };
    }
    /* ---------- الأمان والدخول (المدير) ---------- */
    var IDLE_OPTS = [[0, 'بدون خروج تلقائي'], [15, '15 دقيقة'], [30, '30 دقيقة'], [60, 'ساعة'], [120, 'ساعتان'], [240, '4 ساعات'], [480, '8 ساعات']];
    function secHTML() {
      var x = F.sec;
      if (!x) { if (!F.secLoading) { F.secLoading = true; call('users_list').then(function (r) { F.sec = { idle_min: r.idle_min, trust_devices: r.trust_devices, codes_to_manager: r.codes_to_manager }; F.secLoading = false; if (A.secNow && A.setSec) A.setSec(F.sec); A.render(); }).catch(function (e) { F.secLoading = false; toast(e.message, true); }); } return '<div class="card loading"><span class="spin"></span> جارٍ التحميل…</div>'; }
      return '<div class="card"><h2>الخروج التلقائي عند عدم النشاط</h2><p class="small muted" style="margin:0 0 10px">إذا لم يستعمل المستخدم المنظومة طوال هذه المدة (لا نقر ولا كتابة ولا تمرير) يُسجَّل خروجه تلقائياً، وتُمسح البيانات المالية من الجهاز، ويعود بالرقم السري فقط على جهازه الموثوق. تنطبق على كل المستخدمين وكل الأجهزة.</p>' +
        '<div class="chips sec-idle">' + IDLE_OPTS.map(function (o) { return '<button class="chip' + (Number(x.idle_min) === o[0] ? ' on' : '') + '" data-idle="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div>' +
        '<div class="card"><h2>تذكر الأجهزة الموثوقة</h2><p class="small muted" style="margin:0 0 10px">الجهاز الموثوق هو الذي أدخل عليه المستخدم رمز التحقق من بريده مرة واحدة (حتى 5 أجهزة لكل مستخدم). يمكن إلغاء أجهزة مستخدم من شاشة المستخدمين.</p>' +
        '<label class="chk"><input type="checkbox" id="sec_trust"' + (x.trust_devices ? ' checked' : '') + '> لا تطلب رمز البريد عند الدخول من جهاز موثوق</label>' +
        '<div class="msg ' + (x.trust_devices ? 'info' : 'warn') + '" style="margin-top:8px">' + (x.trust_devices ? 'مفعّل: يُطلب الرمز من الجهاز الجديد فقط، ثم يكفي الرقم السري.' : 'غير مفعّل: يُطلب رمز البريد عند كل دخول، حتى من جهاز سبق التحقق منه.') + '</div></div>' +
        '<div class="card"><h2>رمز التحقق لمن ليس له بريد</h2><p class="small muted" style="margin:0 0 10px">يُرسل الرمز إلى البريد المكتوب في حساب المستخدم، ويصله من حساب Google المالك للمنظومة. من ليس له بريد يدخل بالرقم السري فقط، إلا إذا فعّلت هذا الخيار.</p>' +
        '<label class="chk"><input type="checkbox" id="sec_c2m"' + (x.codes_to_manager ? ' checked' : '') + '> أرسل رمز دخوله إلى بريد المدير، ويعطيه المدير الرمز</label></div>';
    }
    function bindSec(m) {
      var save = function (body, el) {
        if (el) el.disabled = true;
        return call('sec_save', body).then(function (r) { F.sec = { idle_min: r.idle_min, trust_devices: r.trust_devices, codes_to_manager: r.codes_to_manager }; if (A.setSec) A.setSec(F.sec); toast('حُفظ'); A.render(); })
          .catch(function (e) { toast(e.message, true); A.render(); });
      };
      qa('[data-idle]', m).forEach(function (b) { b.onclick = function () { save({ idle_min: Number(b.dataset.idle) }, b); }; });
      var t = q('#sec_trust', m); if (t) t.onchange = function () { save({ trust_devices: t.checked }, t); };
      var c = q('#sec_c2m', m); if (c) c.onchange = function () { save({ codes_to_manager: c.checked }, c); };
    }
    function bindSettings(m) {
      qa('[data-stab]', m).forEach(function (b) { b.onclick = function () { F.setTab = b.dataset.stab; A.render(); }; });
      var onc = q('.fin-settabs .chip.on', m); if (onc && onc.scrollIntoView) try { onc.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
      var tab = F.setTab || 'boxes';
      if (tab === 'sec') return bindSec(m);
      if (tab === 'boxes') {
        bindCollExcl(m);
        bindCollAdd(m);
        qa('[data-badd]', m).forEach(function (b) { b.onclick = function () { boxAdd(b.dataset.badd); }; });
        qa('[data-bedit]', m).forEach(function (b) { b.onclick = function () { boxForm(F.boxes.filter(function (x) { return x.id === b.dataset.bedit; })[0], b.dataset.bbr); }; });
        qa('[data-bon]', m).forEach(function (b) {
          b.onclick = function () { var x = Object.assign({}, F.boxes.filter(function (y) { return y.id === b.dataset.bon; })[0], { active: true }); busy(b, true); call('fin_box_save', { box: x }).then(function (r) { F.boxes = r.boxes; toast('فُعّل'); A.render(); }).catch(function (e) { busy(b, false); toast(e.message, true); }); };
        });
        qa('[data-bdel]', m).forEach(function (b) {
          b.onclick = function () {
            var x = F.boxes.filter(function (y) { return y.id === b.dataset.bdel; })[0];
            A.confirmBox('حذف التعريف', 'إلغاء ربط «' + esc(x.name) + '» بالحساب ' + esc((acc(x.acc) || {}).code || x.acc) + ' وحذف تعريفه نهائياً من المنظومة المالية؟ لن يظهر بعد ذلك في تقارير الصناديق والتحصيل. لا يتأثر سراج، ويمكنك تعريفه من جديد في أي وقت.', 'حذف التعريف').then(function (y) {
              if (!y) return;
              call('fin_box_delete', { id: x.id }).then(function (r) { F.boxes = r.boxes; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); toast('حُذف التعريف'); A.render(); }).catch(function (e) { toast(e.message, true); });
            });
          };
        });
        qa('[data-sugadd]', m).forEach(function (sa) {
          sa.onclick = function () {
            var pick = qa('[data-sug^="' + sa.dataset.sugadd + '|"]', m).filter(function (c) { return c.checked; }).map(function (c) { var x = c.dataset.sug.split('|'); return { acc: x[1], kind: x[2], name: c.dataset.sname }; });
            if (!pick.length) { toast('حدّد حساباً واحداً على الأقل', true); return; }
            busy(sa, true);
            var chain = Promise.resolve();
            pick.forEach(function (x, i) { chain = chain.then(function () { return call('fin_box_save', { box: { acc: x.acc, name: x.name, kind: x.kind, sort: F.boxes.length + i } }).then(function (r) { F.boxes = r.boxes; }); }); });
            chain.then(function () { toast('عُرّف ' + pick.length + ' صندوق/بنك'); A.render(); }).catch(function (e) { busy(sa, false); toast(e.message, true); A.render(); });
          };
        });
      } else if (tab === 'cards') {
        var cl = editDraft('cards'), r = presetRange('month'), ch = function () { markDirty('cards', true); A.render(); };
        bindListEditor(m, 'cards', function () { return cl; }, 'card', function (i) { return ctxFor(cl, i, r[0], r[1], 'هذا الشهر'); }, ch);
        q('[data-cadd]', m).onclick = function () { editItem({ cmp: true, good: 'up' }, 'card', ctxFor(cl, cl.length, r[0], r[1], 'هذا الشهر')).then(function (o) { if (o) { cl.push(o); ch(); } }); };
        q('[data-csave]', m).onclick = function () { saveConfig('cards', cl, this); };
        q('[data-creset]', m).onclick = function () { A.confirmBox('استعادة الافتراضي', 'استبدال البطاقات الحالية بالبطاقات الافتراضية الست؟', 'استعادة').then(function (y) { if (y) saveConfig('cards', null); }); };
      } else if (tab === 'daily') {
        var dd = editDraft('daily'), d0 = F.D.maxDate || today(), chd = function () { markDirty('daily', true); A.render(); };
        q('#devd', m).onchange = function () { var on = this.checked; setDevDaily(on).then(function () { toast(on ? 'ستظهر علامة «قيد التطوير»' : 'أُزيلت علامة «قيد التطوير»'); }); };
        bindListEditor(m, 'daily', function () { return dd.rows; }, 'row', function (i) { return ctxFor(dd.rows, i, d0, d0, 'يوم ' + d0); }, chd);
        q('#dtitle', m).onchange = function () { dd.title = this.value.trim(); chd(); };
        q('[data-dadd]', m).onclick = function () { editDaily(null, ctxFor(dd.rows, dd.rows.length, d0, d0, 'يوم ' + d0)).then(function (o) { if (o) { dd.rows.push(o); chd(); } }); };
        q('[data-dsep]', m).onclick = function () { editItem({ name: '', f: '' }, 'row', { from: d0, to: d0 }).then(function (o) { if (o) { dd.rows.push(o); chd(); } }); };
        q('[data-dsave]', m).onclick = function () { saveConfig('daily', { title: dd.title, rows: dd.rows }, this); };
        q('[data-dreset]', m).onclick = function () { A.confirmBox('استعادة الافتراضي', 'استبدال أسطر التقرير اليومي بالأسطر الافتراضية (مثل نموذج الإدارة)؟', 'استعادة').then(function (y) { if (y) saveConfig('daily', null); }); };
      } else if (tab === 'igroups') {
        bindIgSettings(m);
      } else if (tab === 'cgroups') {
        bindCgSettings(m); bindGrpBar(m, {}, function () {});
      } else if (tab === 'reps') {
        bindRepsSettings(m);
      } else if (tab === 'groups') {
        qa('[data-grp]', m).forEach(function (b) {
          b.onclick = function () {
            var k = b.dataset.grp, gb = b.dataset.gbr || '', cur = String(multiBr() ? grpCodes(k, gb) : (((F.meta && F.meta.settings) || {})[k] || (k === 'recv' ? '1601' : '261'))).split(',');
            pickAccount({ multi: true, value: cur, title: (k === 'recv' ? 'حسابات العملاء' : 'حسابات الموردين') + (multiBr() ? ' · ' + brName(gb) : ''), hint: 'اختر الحسابات الرئيسية التي تحتها العملاء أو الموردون. كل الحسابات الفرعية تحتها تُحسب تلقائياً.', filter: function (a) { return (!multiBr() || a.br === gb) && (!a.leaf || a.lvl <= 4); } })
              .then(function (codes) {
                if (!codes || !codes.length) return;
                var body = {}; body[k] = codes.join(',');
                call('fin_settings_save', { settings: body, br: multiBr() ? gb : '' }).then(function (r) { F.meta.settings = r.settings; resetCache(); S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); });
              });
          };
        });
        q('#fys', m).onchange = function () { call('fin_settings_save', { settings: { year_start: this.value } }).then(function (r) { F.meta.settings = r.settings; resetCache(); S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); }); };
      }
    }
    // تعريف صندوق أو أكثر: اختر حساباً واحداً (نموذج كامل) أو عدة حسابات دفعة واحدة
    function boxGuessKind(a, inBr) { return inBr(function () { var n = a.name, p0 = acc(a.parent), g = 0; while (p0 && g++ < 4) { n += ' ' + p0.name; p0 = acc(p0.parent); } return /مصرف|بنك|مصارف/.test(n) ? 'بنك' : 'صندوق'; }); }
    function boxAdd(brCode) {
      var mb = multiBr(), br = brCode || '', inBr = function (fn) { return mb ? withBr(br, fn) : fn(); };
      var list = inBr(function () { return F.D.accList.filter(function (a) { return a.leaf; }).slice(); });
      var defined = {}; F.boxes.forEach(function (x) { defined[x.acc] = x.name; });
      pickAccount({ multi: true, byId: true, value: [], list: list, okText: 'التالي', title: 'اختر حساباً أو أكثر' + (mb ? ' · ' + brName(br) : ''), hint: 'يمكنك تحديد عدة صناديق وبنوك لتعريفها دفعة واحدة. الحسابات المعرّفة مسبقاً لا تُكرَّر.', filter: function (a) { return !defined[a.id]; } }).then(function (ids) {
        if (!ids || !ids.length) return;
        if (ids.length === 1) { boxForm({ acc: ids[0], name: String((list.filter(function (a) { return a.id === ids[0]; })[0] || {}).name || '').trim(), kind: boxGuessKind(list.filter(function (a) { return a.id === ids[0]; })[0], inBr), active: true, sort: F.boxes.length, types: [], _new: true }, br); return; }
        var rows = ids.map(function (id) { var a = list.filter(function (x) { return x.id === id; })[0] || { id: id, name: id, code: '' }; return { acc: id, code: a.code, name: String(a.name).trim(), kind: boxGuessKind(a, inBr) }; });
        sheet('تعريف ' + rows.length + ' حسابات دفعة واحدة' + (mb ? ' · ' + brName(br) : ''), '<div class="form"><p class="small muted" style="margin:0">راجع الاسم والنوع لكل حساب، ثم اضغط «تعريف الكل». يمكنك تحديد أنواع السندات لكل واحد لاحقاً من «تعديل».</p><div class="list bulk-box">' + rows.map(function (r, i) {
          return '<div class="item"><div class="main"><div class="small muted num">' + esc(r.code) + '</div><input class="input" data-bn="' + i + '" value="' + esc(r.name) + '"></div><div class="chips">' + ['صندوق', 'بنك'].map(function (k) { return '<button type="button" class="chip' + (r.kind === k ? ' on' : '') + '" data-bk="' + i + '|' + k + '">' + k + '</button>'; }).join('') + '</div><button type="button" class="iconbtn" data-bx="' + i + '" aria-label="إزالة">✕</button></div>';
        }).join('') + '</div><div class="field"><span class="lbl">الحركة التي تظهر في التقارير (للكل)</span><div class="chips">' + BOX_SIDES.map(function (o) { return '<button class="chip' + (o[0] === '' ? ' on' : '') + '" data-bside="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div></div><div id="bberr"></div><button class="btn primary big" id="bbsv">تعريف الكل (' + rows.length + ')</button></div>', function (s) {
          var bside = '';
          qa('[data-bside]', s.el).forEach(function (c) { c.onclick = function () { bside = c.dataset.bside; qa('[data-bside]', s.el).forEach(function (x) { x.classList.toggle('on', x === c); }); }; });
          qa('[data-bn]', s.el).forEach(function (el) { el.oninput = function () { rows[Number(el.dataset.bn)].name = el.value; }; });
          qa('[data-bk]', s.el).forEach(function (c) { c.onclick = function () { var x = c.dataset.bk.split('|'); rows[Number(x[0])].kind = x[1]; qa('[data-bk^="' + x[0] + '|"]', s.el).forEach(function (y) { y.classList.toggle('on', y === c); }); }; });
          qa('[data-bx]', s.el).forEach(function (c) { c.onclick = function () { var i = Number(c.dataset.bx); rows[i].skip = true; c.closest('.item').remove(); q('#bbsv', s.el).textContent = 'تعريف الكل (' + rows.filter(function (r) { return !r.skip; }).length + ')'; }; });
          q('#bbsv', s.el).onclick = function () {
            var todo = rows.filter(function (r) { return !r.skip; }), btn = this;
            if (!todo.length) { s.close(); return; }
            if (todo.some(function (r) { return !String(r.name).trim(); })) { q('#bberr', s.el).innerHTML = '<div class="msg err">اكتب اسماً لكل حساب</div>'; return; }
            busy(btn, true); var done = 0, chain = Promise.resolve();
            todo.forEach(function (r, i) { chain = chain.then(function () { return call('fin_box_save', { box: { acc: r.acc, name: String(r.name).trim(), kind: r.kind, sort: F.boxes.length + i, types: bside ? ['side:' + bside] : [] } }).then(function (x) { F.boxes = x.boxes; done++; btn.textContent = 'جارٍ التعريف… ' + done + ' من ' + todo.length; }); }); });
            chain.then(function () { S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); resetCache(); s.close(); toast('عُرّف ' + done + ' صندوق/بنك'); A.render(); })
              .catch(function (e) { busy(btn, false); q('#bberr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + (done ? ' (عُرّف ' + done + ' قبل الخطأ)' : '') + '</div>'; F.boxes = F.boxes; A.render(); });
          };
        });
      });
    }
    function boxForm(b, brCode) {
      var isNew = !b || b._new; var d = b ? Object.assign({}, b) : { acc: '', name: '', kind: 'صندوق', active: true, sort: F.boxes.length, types: [] }; delete d._new; if (isNew) b = null;
      d.side = boxSide(d); d.types = boxTypesOnly(d);
      var mb = multiBr(), br = brCode || '';
      // داخل نموذج الفرع حتى تظهر حساباته وأنواع سنداته فقط
      var inBr = function (fn) { return mb ? withBr(br, fn) : fn(); };
      var accLabel = function () { return inBr(function () { return d.acc ? ((acc(d.acc) || {}).code || '') + ' · ' + accName(d.acc) : 'اختر الحساب…'; }); };
      var typeOpts = function () {
        return inBr(function () {
          var g = {}, Tt = T();
          (F.D.byAcc[d.acc] || []).forEach(function (l) { var k = String(l.bt || ''), o = g[k] || (g[k] = { k: k, name: l.btn || k, n: 0, v: 0 }); o.n++; o.v += l.dr + l.cr; });
          d.types.forEach(function (k) { if (!g[k]) g[k] = { k: k, name: ((Tt.bt || {})[k] || Tt.it[k] || {}).name || k, n: 0, v: 0 }; });
          return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.n - a.n; });
        });
      };
      var accList = inBr(function () { return F.D.accList.filter(function (a) { return a.leaf; }).slice(); });
      var drawTypes = function (el) {
        var ops = typeOpts();
        el.innerHTML = !d.acc ? '<p class="small muted" style="margin:0">اختر الحساب أولاً لتظهر أنواع السندات التي عليه.</p>' : !ops.length ? '<p class="small muted" style="margin:0">لا توجد حركات على هذا الحساب بعد.</p>' :
          '<p class="small muted" style="margin:0 0 6px">' + (d.types.length ? 'تظهر في التقارير الأنواع المحددة فقط.' : 'بدون تحديد: تظهر كل الأنواع.') + '</p><div class="list bt-list">' + ops.map(function (o) {
            var on = d.types.indexOf(o.k) >= 0;
            return '<label class="item tap"><input type="checkbox" data-bt="' + esc(o.k) + '"' + (on ? ' checked' : '') + '><div class="main"><b>' + esc(o.name) + '</b><div class="meta"><span>' + fk(o.n) + ' حركة</span><span>' + fm(o.v) + '</span></div></div></label>';
          }).join('') + '</div><div class="row small" style="margin-top:6px"><button type="button" class="btn sm ghost" data-btall>كل الأنواع</button></div>';
        qa('[data-bt]', el).forEach(function (c) { c.onchange = function () { var k = c.dataset.bt, i = d.types.indexOf(k); if (c.checked && i < 0) d.types.push(k); if (!c.checked && i >= 0) d.types.splice(i, 1); drawTypes(el); }; });
        var all = q('[data-btall]', el); if (all) all.onclick = function () { d.types = []; drawTypes(el); };
      };
      return sheet((b ? 'تعديل ' + b.name : 'تعريف صندوق أو بنك') + (mb ? ' · ' + brName(br) : ''), '<div class="form"><div class="field"><span class="lbl">الحساب في دليل سراج' + (mb ? ' (' + esc(brName(br)) + ')' : '') + '</span><button class="input" id="bacc" style="text-align:start">' + esc(accLabel()) + '</button></div>' +
        '<div class="field"><label class="lbl" for="bnm">الاسم في التقارير</label><input id="bnm" class="input" value="' + esc(d.name) + '"></div>' +
        '<div class="field"><span class="lbl">النوع</span><div class="chips">' + ['صندوق', 'بنك'].map(function (k) { return '<button class="chip' + (d.kind === k ? ' on' : '') + '" data-k="' + k + '">' + k + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="lbl">الحركة التي تظهر في التقارير</span><div class="chips">' + BOX_SIDES.map(function (o) { return '<button class="chip' + (d.side === o[0] ? ' on' : '') + '" data-side="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div><p class="small muted" style="margin:4px 0 0">الرصيد يبقى الرصيد الفعلي للحساب؛ الحركة المخفية تظهر في عمود «غير معروضة».</p></div>' +
        '<div class="field"><span class="lbl">أنواع السندات التي تظهر في التقارير</span><div id="btypes"></div></div>' +
        '<div class="field"><label class="lbl" for="bso">الترتيب</label><input id="bso" type="number" class="input num" value="' + esc(d.sort) + '" style="max-width:120px"></div>' +
        (b ? '<label class="chk"><input type="checkbox" id="bac"' + (d.active ? ' checked' : '') + '> نشط (يظهر في التقارير)</label>' : '') +
        '<div id="berr"></div><button class="btn primary big" id="bsv">حفظ</button></div>', function (s) {
        drawTypes(q('#btypes', s.el));
        q('#bacc', s.el).onclick = function () {
          pickAccount({ title: 'حساب الصندوق أو البنك' + (mb ? ' · ' + brName(br) : ''), list: accList }).then(function (id) {
            if (!id) return; d.acc = id; d.types = []; var a = accList.filter(function (x) { return x.id === id; })[0] || {};
            q('#bacc', s.el).textContent = (a.code || '') + ' · ' + (a.name || '');
            if (!q('#bnm', s.el).value) q('#bnm', s.el).value = String(a.name || '').trim();
            drawTypes(q('#btypes', s.el));
          });
        };
        qa('[data-k]', s.el).forEach(function (c) { c.onclick = function () { d.kind = c.dataset.k; qa('[data-k]', s.el).forEach(function (x) { x.classList.toggle('on', x === c); }); }; });
        qa('[data-side]', s.el).forEach(function (c) { c.onclick = function () { d.side = c.dataset.side; qa('[data-side]', s.el).forEach(function (x) { x.classList.toggle('on', x === c); }); }; });
        q('#bsv', s.el).onclick = function () {
          var btn = this; busy(btn, true);
          d.name = q('#bnm', s.el).value.trim(); d.sort = Number(q('#bso', s.el).value) || 0; if (b) d.active = q('#bac', s.el).checked;
          var sendBox = Object.assign({}, d, { types: d.types.concat(d.side ? ['side:' + d.side] : []) }); delete sendBox.side;
          call('fin_box_save', { box: sendBox }).then(function (r) { F.boxes = r.boxes; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); resetCache(); s.close(); toast('حُفظ'); A.render(); })
            .catch(function (e) { busy(btn, false); q('#berr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
        };
      });
    }


    /* ===================== محرّك التقارير المخصصة الجديدة =====================
       1) «حساب مقابل حساب»: حركة حساب (أو مجموعة حسابات) مع حساب مقابل محدد، مع كلمات في البيان.
       2) «تقرير حر»: مصدر بيانات + أعمدة + شروط + ترتيب + تجميع، يُبنى من الصفر. */

    // توحيد النص العربي للبحث: بلا تشكيل، والألف والتاء المربوطة والياء بشكل واحد
    function normAr(s) {
      return String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
        .replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }).toLowerCase().replace(/\s+/g, ' ').trim();
    }
    function kwList(s) { return String(s || '').split(/[,،\n]+/).map(normAr).filter(String); }
    // هل النص يطابق الكلمات؟ mode: any = أي كلمة، all = كل الكلمات. ex = كلمات مستبعدة
    function kwPass(text, kw, mode, ex) {
      var t = normAr(text);
      if (ex.length && ex.some(function (w) { return t.indexOf(w) >= 0; })) return false;
      if (!kw.length) return true;
      return mode === 'all' ? kw.every(function (w) { return t.indexOf(w) >= 0; }) : kw.some(function (w) { return t.indexOf(w) >= 0; });
    }
    function idSet(ids) { var o = {}; ids.forEach(function (x) { o[x] = 1; }); return o; }
    function codesText(codes) {
      return (codes || []).map(function (c) { var a = F.D.byCode[c]; return a ? a.name : c; }).join('، ');
    }
    function emptyRes(msg) { return { cols: [C('m', '')], rows: [], empty: msg }; }

    /* ---------- 1) حساب مقابل حساب ---------- */
    var PAIR_VIEWS = [['lines', 'كل حركة في سطر'], ['month', 'مجمّع شهرياً'], ['cp', 'حسب الحساب المقابل'], ['acc', 'حسب الحساب الفرعي'], ['type', 'حسب نوع القيد']];
    function pairMatches(def, p) {
      var idsA = byCodes((def.a || []).join(','));
      var inA = idSet(idsA), inB = (def.b || []).length ? idSet(byCodes(def.b.join(','))) : null;
      var kw = kwList(def.kw), ex = kwList(def.kwx), out = [];
      idsA.forEach(function (id) {
        (F.D.byAcc[id] || []).forEach(function (l) {
          if (l.d < p.from || l.d > p.to) return;
          if (def.side === 'dr' && !l.dr || def.side === 'cr' && !l.cr) return;
          var ent = F.D.byEntry[l.e] || [l];
          var others = ent.filter(function (x) { return !inA[x.a]; });
          // الطرف المقابل: الأسطر في الجهة المعاكسة (وإن لم توجد فكل الأسطر الأخرى)
          var opp = others.filter(function (x) { return l.dr ? x.cr : x.dr; });
          if (!opp.length) opp = others;
          var cps = inB ? opp.filter(function (x) { return inB[x.a]; }) : opp;
          if (inB && !cps.length) return;
          if (kw.length || ex.length) {
            var text = (l.ed || '') + ' ' + ent.map(function (x) { return x.ld || ''; }).join(' ');
            if (!kwPass(text, kw, def.kwm, ex)) return;
          }
          // المبلغ المقابل فقط: إذا كان في القيد أكثر من طرف مقابل نوزّع المبلغ بنسبة كل طرف
          var amt = l.dr || l.cr, oppSum = opp.reduce(function (s, x) { return s + ((l.dr ? x.cr : x.dr) || 0); }, 0);
          var share = function (x) { var v = l.dr ? x.cr : x.dr; return oppSum ? amt * (v || 0) / oppSum : amt / (opp.length || 1); };
          var part = inB ? cps.reduce(function (s, x) { return s + share(x); }, 0) : amt;
          out.push({ l: l, cps: cps, share: share, dr: l.dr ? part : 0, cr: l.cr ? part : 0 });
        });
      });
      out.sort(function (x, y) { return cmpLine(x.l, y.l); });
      return out;
    }
    function runPair(def, p) {
      if (!(def.a || []).length) return emptyRes('اختر الحساب الأول');
      var m = pairMatches(def, p), view = def.view || 'lines';
      var aName = codesText(def.a), bName = (def.b || []).length ? codesText(def.b) : 'كل الحسابات';
      var title = 'حركة ' + aName + ' مقابل ' + bName;
      var notes = [];
      if (def.kw) notes.push('البيان يحتوي ' + (def.kwm === 'all' ? 'كل الكلمات' : 'أياً من الكلمات') + ': ' + def.kw);
      if (def.kwx) notes.push('بدون: ' + def.kwx);
      if (def.side === 'dr') notes.push('الحركات المدينة فقط'); else if (def.side === 'cr') notes.push('الحركات الدائنة فقط');
      var tDr = 0, tCr = 0; m.forEach(function (x) { tDr += x.dr; tCr += x.cr; });
      var res;
      if (view === 'lines') {
        var multiA = byCodes((def.a || []).join(',')).filter(function (id) { return F.D.byAcc[id]; }).length > 1, bal = 0;
        var rows = m.map(function (x) {
          bal += x.dr - x.cr;
          var names = []; x.cps.forEach(function (c) { var n = accName(c.a); if (names.indexOf(n) < 0) names.push(n); });
          return { d: x.l.d, no: x.l.no, type: x.l.btn, desc: x.l.ld || x.l.ed || '', acc: accName(x.l.a), cp: names.length > 2 ? names[0] + ' و' + (names.length - 1) + ' أخرى' : names.join('، '),
            dr: x.dr || '', cr: x.cr || '', bal: bal };
        });
        var cols = [C('d', 'التاريخ'), C('no', 'رقم القيد'), C('type', 'النوع'), C('desc', 'البيان')].concat(multiA ? [C('acc', 'الحساب')] : [])
          .concat([C('cp', 'الحساب المقابل'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money'), C('bal', 'الرصيد التراكمي', 'money')]);
        res = { cols: cols, rows: rows, total: { d: 'الإجمالي (' + m.length + ' حركة)', dr: tDr, cr: tCr, bal: tDr - tCr } };
      } else {
        var g = {}, add = function (k, name, dr, cr, sortK) { var r = g[k] || (g[k] = { k: k, name: name, s: sortK || name, n: 0, dr: 0, cr: 0 }); r.n++; r.dr += dr; r.cr += cr; };
        m.forEach(function (x) {
          if (view === 'month') add(x.l.d.slice(0, 7), monthLabel(x.l.d.slice(0, 7)), x.dr, x.cr, x.l.d.slice(0, 7));
          else if (view === 'acc') add(x.l.a, accName(x.l.a), x.dr, x.cr);
          else if (view === 'type') add(x.l.btn, x.l.btn, x.dr, x.cr);
          else x.cps.forEach(function (c) { var v = x.share(c); add(c.a, accName(c.a), x.l.dr ? v : 0, x.l.cr ? v : 0); });
        });
        var list = Object.keys(g).map(function (k) { var r = g[k]; r.net = r.dr - r.cr; return r; });
        list.sort(view === 'month' ? function (a, b) { return a.s < b.s ? -1 : 1; } : function (a, b) { return Math.abs(b.dr + b.cr) - Math.abs(a.dr + a.cr); });
        var first = { month: 'الشهر', acc: 'الحساب الفرعي', type: 'نوع القيد', cp: 'الحساب المقابل' }[view];
        var cols2 = [C('name', first), C('n', 'عدد الحركات', 'int'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money'), C('net', 'الصافي (مدين − دائن)', 'money')];
        res = { cols: cols2, rows: list, total: sumRow(list, cols2) };
        if (list.length > 1) res.chart = view === 'month' ? { type: 'bar', x: 'name', y: ['dr', 'cr'], yl: ['مدين', 'دائن'] } : { type: 'hbar', x: 'name', y: ['net'], yl: ['الصافي'], limit: 15 };
      }
      res.subtitle = title;
      if (notes.length) res.note = notes.join(' · ');
      if (!m.length) res.empty = 'لا توجد حركات مطابقة في هذه الفترة' + (def.kw ? ' بهذه الكلمات' : '');
      return res;
    }

    /* ---------- 2) التقرير الحر ---------- */
    var CLS_AR = {}; CLS_AR[SALE] = 'مبيع'; CLS_AR[SRET] = 'مرتجع مبيع'; CLS_AR[PUR] = 'شراء'; CLS_AR[PRET] = 'مرتجع شراء'; CLS_AR[OPEN_STOCK] = 'بضاعة أول المدة'; CLS_AR[TRANSFER] = 'مناقلة'; CLS_AR[ISSUE] = 'إخراج';
    var K_AR = { r: 'سند قبض', p: 'سند دفع', j: 'قيد يومية', i: 'قيد فاتورة', o: 'قيد افتتاحي' };
    function invTypeName(v) { return (T().it[v.t] || {}).name || CLS_AR[v.c] || String(v.c); }
    function brNameOf(r) { var b = (r.br || ''); return multiBr() ? brName(b) : ''; }
    // الحقول: [الاسم، النوع، القيمة]. الأنواع: text نص · date تاريخ · money مبلغ · qty كمية · int عدد
    var SRC = {
      jl: { name: 'القيود المحاسبية', hint: 'كل سطر في كل قيد: سندات القبض والدفع وقيود اليومية وقيود الفواتير',
        rows: function () { return T().jl; },
        def: ['d', 'no', 'type', 'acc', 'desc', 'dr', 'cr'],
        f: {
          d: ['التاريخ', 'date', function (l) { return l.d; }], mon: ['الشهر', 'text', function (l) { return l.d.slice(0, 7); }, 'month'],
          no: ['رقم القيد', 'text', function (l) { return l.no || ''; }], type: ['نوع القيد', 'text', function (l) { return l.btn; }],
          kind: ['تصنيف القيد', 'text', function (l) { return K_AR[l.k] || 'قيد'; }],
          code: ['رمز الحساب', 'text', function (l) { return (acc(l.a) || {}).code || ''; }], acc: ['الحساب', 'text', function (l) { return accName(l.a); }],
          acc2: ['الحساب (مستوى 2)', 'text', function (l) { return ancestorAt(l.a, 2); }], acc3: ['الحساب (مستوى 3)', 'text', function (l) { return ancestorAt(l.a, 3); }],
          acc4: ['الحساب (مستوى 4)', 'text', function (l) { return ancestorAt(l.a, 4); }],
          desc: ['البيان', 'text', function (l) { return l.ld || l.ed || ''; }], ed: ['بيان القيد', 'text', function (l) { return l.ed || ''; }], ld: ['بيان السطر', 'text', function (l) { return l.ld || ''; }],
          cp: ['الحساب المقابل', 'text', function (l) { return counterpart(l, [l.a]); }],
          dr: ['مدين', 'money', function (l) { return l.dr; }], cr: ['دائن', 'money', function (l) { return l.cr; }], net: ['الصافي (مدين − دائن)', 'money', function (l) { return l.dr - l.cr; }],
          rep: ['المندوب', 'text', function (l) { return repName(l.ag); }], user: ['المستخدم', 'text', function (l) { return userName(l.u); }],
          br: ['الفرع', 'text', brNameOf]
        } },
      inv: { name: 'الفواتير', hint: 'رأس كل فاتورة: مبيع، مرتجع، شراء… بصافيها وكميتها وربحها',
        rows: function () { return F.D.invs; },
        def: ['d', 'no', 'cls', 'cust', 'net'],
        f: {
          d: ['التاريخ', 'date', function (v) { return v.d; }], mon: ['الشهر', 'text', function (v) { return v.d.slice(0, 7); }, 'month'],
          no: ['رقم الفاتورة', 'text', function (v) { return v.no || ''; }], cls: ['نوع الحركة', 'text', function (v) { return CLS_AR[v.c] || String(v.c); }],
          type: ['نوع الفاتورة', 'text', invTypeName], cust: ['العميل/المورد', 'text', function (v) { return v.name; }],
          store: ['المخزن', 'text', function (v) { return storeName(v.st); }], rep: ['المندوب', 'text', function (v) { return repName(v.ag); }],
          user: ['المستخدم', 'text', function (v) { return userName(v.u); }], note: ['البيان', 'text', function (v) { return v.note || ''; }],
          net: ['الصافي', 'money', function (v) { return v.sign * v.net; }], qty: ['الكمية', 'qty', function (v) { return v.sign * v.qty; }],
          cost: ['التكلفة', 'money', function (v) { return v.sign * v.cost; }], profit: ['الربح', 'money', function (v) { return v.sign * v.profit; }],
          br: ['الفرع', 'text', brNameOf]
        } },
      invl: { name: 'أصناف الفواتير', hint: 'كل صنف في كل فاتورة: الكميات والأسعار والقيم والأرباح',
        rows: function () { return T().invl.filter(function (l) { return l.v; }); },
        def: ['d', 'no', 'cust', 'item', 'qty', 'value'],
        f: {
          d: ['التاريخ', 'date', function (l) { return l.d; }], mon: ['الشهر', 'text', function (l) { return l.d.slice(0, 7); }, 'month'],
          no: ['رقم الفاتورة', 'text', function (l) { return l.v.no || ''; }], cls: ['نوع الحركة', 'text', function (l) { return CLS_AR[l.v.c] || String(l.v.c); }],
          type: ['نوع الفاتورة', 'text', function (l) { return invTypeName(l.v); }], cust: ['العميل/المورد', 'text', function (l) { return l.v.name; }],
          item: ['الصنف', 'text', function (l) { return itemName(l.item); }], icode: ['رمز الصنف', 'text', function (l) { return (T().item[l.item] || {}).code || ''; }],
          unit: ['الوحدة', 'text', function (l) { return (T().item[l.item] || {}).mu || l.un || ''; }],
          store: ['المخزن', 'text', function (l) { return storeName(l.st); }], rep: ['المندوب', 'text', function (l) { return repName(l.v.ag); }],
          user: ['المستخدم', 'text', function (l) { return userName(l.v.u); }],
          qty: ['الكمية', 'qty', function (l) { var it = T().item[l.item] || { f: 1 }; return l.v.sign * l.qb / (it.f || 1); }],
          gift: ['الهدايا', 'qty', function (l) { return l.v.sign * l.g; }], price: ['السعر', 'money', function (l) { return l.p; }],
          value: ['القيمة', 'money', function (l) { return l.v.sign * l.tot; }], cost: ['التكلفة', 'money', function (l) { return l.v.sign * l.cost; }],
          profit: ['الربح', 'money', function (l) { return l.v.sign * l.win; }], br: ['الفرع', 'text', brNameOf]
        } }
    };
    var NUMT = { money: 1, qty: 1, int: 1 };
    // العمليات في الشروط
    var OPS_T = [['has', 'يحتوي على'], ['nhas', 'لا يحتوي على'], ['eq', 'يساوي'], ['in', 'واحد من'], ['nin', 'ليس من'], ['empty', 'فارغ'], ['nempty', 'غير فارغ']];
    var OPS_N = [['gt', 'أكبر من'], ['lt', 'أصغر من'], ['ge', 'أكبر من أو يساوي'], ['le', 'أصغر من أو يساوي'], ['eqn', 'يساوي'], ['ne0', 'لا يساوي صفراً']];
    function condPass(cnd, row, src) {
      if (cnd.f === '@acc') {   // الحساب وكل فروعه (للقيود)
        var s = cnd._ids || (cnd._ids = idSet(byCodes((cnd.v || []).join(','))));
        return cnd.op === 'nin' ? !s[row.a] : !!s[row.a];
      }
      var fd = SRC[src].f[cnd.f]; if (!fd) return true;
      var v = fd[2](row);
      if (NUMT[fd[1]]) {
        var x = Number(v) || 0, n = Number(cnd.v) || 0;
        return cnd.op === 'gt' ? x > n : cnd.op === 'lt' ? x < n : cnd.op === 'ge' ? x >= n : cnd.op === 'le' ? x <= n : cnd.op === 'ne0' ? Math.abs(x) > 0.0005 : Math.abs(x - n) < 0.0005;
      }
      var t = normAr(v);
      if (cnd.op === 'empty') return !t;
      if (cnd.op === 'nempty') return !!t;
      if (cnd.op === 'in' || cnd.op === 'nin') { var hit = (cnd.v || []).some(function (w) { return normAr(w) === t; }); return cnd.op === 'in' ? hit : !hit; }
      var ws = kwList(cnd.v);
      if (!ws.length) return true;
      if (cnd.op === 'eq') return ws.some(function (w) { return w === t; });
      var any = ws.some(function (w) { return t.indexOf(w) >= 0; });
      return cnd.op === 'nhas' ? !any : any;
    }
    function fieldVals(src, f, from, to) {   // القيم الموجودة فعلاً في الحقل (لخيار «واحد من»)
      var fd = SRC[src].f[f], seen = {}, out = [];
      SRC[src].rows().forEach(function (r) { if (from && (r.d < from || r.d > to)) return; var v = String(fd[2](r) || ''); if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
      return out.sort(function (a, b) { return a.localeCompare(b, 'ar'); });
    }
    function colType(fd) { return fd[1] === 'date' ? 'text' : fd[1]; }
    function fmtKey(fd, v) { return fd[3] === 'month' && /^\d{4}-\d{2}$/.test(v) ? monthLabel(v) : v; }
    function runFree(def, p) {
      var src = SRC[def.src];
      if (!src) return emptyRes('اختر مصدر البيانات');
      var conds = (def.conds || []).filter(function (c) { return c.f && c.op; });
      var rows = src.rows().filter(function (r) { return r.d >= p.from && r.d <= p.to && conds.every(function (c) { return condPass(c, r, def.src); }); });
      var F_ = src.f, res;
      if (def.mode === 'sum') {
        var rf = F_[def.row] ? def.row : 'mon', cf = def.col && F_[def.col] && def.col !== rf ? def.col : '';
        var meas = (def.meas || []).filter(function (k) { return k === '@n' || (F_[k] && NUMT[F_[k][1]]); });
        if (!meas.length) meas = ['@n'];
        var mName = function (k) { return k === '@n' ? 'العدد' : F_[k][0]; }, mVal = function (k, r) { return k === '@n' ? 1 : Number(F_[k][2](r)) || 0; };
        var g = {}, colKeys = {};
        rows.forEach(function (r) {
          var k = String(F_[rf][2](r) || '—'), o = g[k] || (g[k] = { name: fmtKey(F_[rf], k), _s: k });
          if (cf) { var ck = String(F_[cf][2](r) || '—'); colKeys[ck] = (colKeys[ck] || 0) + Math.abs(mVal(meas[0], r)); o['c_' + ck] = (o['c_' + ck] || 0) + mVal(meas[0], r); o.tot = (o.tot || 0) + mVal(meas[0], r); }
          else meas.forEach(function (mk) { o[mk] = (o[mk] || 0) + mVal(mk, r); });
        });
        var list = Object.keys(g).map(function (k) { return g[k]; });
        var sk = def.sort || (F_[rf][1] === 'date' || F_[rf][3] === 'month' ? '_name' : '_val');
        var firstK = cf ? 'tot' : meas[0];
        list.sort(sk === '_name' ? function (a, b) { return String(a._s).localeCompare(String(b._s), 'ar'); } : function (a, b) { return (b[firstK] || 0) - (a[firstK] || 0); });
        var cols = [C('name', F_[rf][0])];
        if (cf) {
          var ck2 = Object.keys(colKeys).sort(function (a, b) { return F_[cf][1] === 'date' || F_[cf][3] === 'month' ? a.localeCompare(b) : colKeys[b] - colKeys[a]; }).slice(0, 24);
          ck2.forEach(function (k) { cols.push(C('c_' + k, fmtKey(F_[cf], k), meas[0] === '@n' ? 'int' : colType(F_[meas[0]]))); });
          cols.push(C('tot', 'الإجمالي', meas[0] === '@n' ? 'int' : colType(F_[meas[0]])));
        } else meas.forEach(function (mk) { cols.push(C(mk, mName(mk), mk === '@n' ? 'int' : colType(F_[mk]))); });
        var total = sumRow(list, cols);
        if (def.top) list = list.slice(0, Number(def.top));
        res = { cols: cols, rows: list, total: total };
        if (def.chart && list.length > 1) res.chart = { type: def.chart, x: 'name', y: [cols[1].k], yl: [cols[1].l], limit: def.chart === 'hbar' ? 20 : undefined };
        res.note = fk(rows.length) + ' سطر من «' + src.name + '»' + (def.top && Object.keys(g).length > def.top ? ' · يظهر أعلى ' + def.top + ' من ' + Object.keys(g).length : '');
      } else {
        var cs = (def.cols || []).filter(function (k) { return F_[k]; });
        if (!cs.length) cs = src.def.slice();
        var srt = def.sort && F_[def.sort] ? def.sort : 'd', dir = def.dir === 'asc' ? 1 : def.dir === 'desc' ? -1 : (srt === 'd' ? 1 : -1);
        var gf = def.group && F_[def.group] ? def.group : '';
        var keyed = rows.map(function (r) { var o = { _r: r }; cs.forEach(function (k) { o[k] = F_[k][2](r); }); if (gf) o._g = String(F_[gf][2](r) || '—'); o._s = F_[srt][2](r); return o; });
        var cmp = function (a, b) { var x = a._s, y = b._s; if (NUMT[F_[srt][1]]) { x = Number(x) || 0; y = Number(y) || 0; } return (x < y ? -1 : x > y ? 1 : 0) * dir; };
        var colsD = cs.map(function (k) { return C(k, F_[k][0], colType(F_[k])); });
        var numK = cs.filter(function (k) { return NUMT[F_[k][1]] && k !== 'price'; });
        var out = [];
        if (gf) {
          var groups = {};
          keyed.forEach(function (o) { (groups[o._g] = groups[o._g] || []).push(o); });
          Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, 'ar'); }).forEach(function (gk) {
            var arr = groups[gk].sort(cmp);
            var head = { _b: true, _hl: true }; head[cs[0]] = F_[gf][0] + ': ' + fmtKey(F_[gf], gk) + ' (' + arr.length + ')';
            numK.forEach(function (k) { head[k] = arr.reduce(function (s, o) { return s + (Number(o[k]) || 0); }, 0); });
            out.push(head);
            if (!def.collapse) arr.forEach(function (o) { out.push(o); });
          });
        } else out = keyed.sort(cmp);
        out.forEach(function (o) { cs.forEach(function (k) { if (F_[k][3] === 'month' && o[k]) o[k] = fmtKey(F_[k], o[k]); }); });
        var tot = {}; numK.forEach(function (k) { tot[k] = rows.reduce(function (s, r) { return s + (Number(F_[k][2](r)) || 0); }, 0); });
        tot.name = 'الإجمالي (' + fk(rows.length) + ' سطر)';
        if (numK.indexOf(cs[0]) < 0) tot[cs[0]] = tot.name;
        res = { cols: colsD, rows: out, total: numK.length ? tot : null };
      }
      if (!rows.length) res.empty = 'لا توجد بيانات مطابقة في هذه الفترة. جرّب فترة أطول أو خفّف الشروط';
      return res;
    }
    function condText(c, src) {
      if (c.f === '@acc') return (c.op === 'nin' ? 'الحساب ليس تحت: ' : 'الحساب تحت: ') + codesText(c.v);
      var fd = SRC[src] && SRC[src].f[c.f]; if (!fd) return '';
      var op = (OPS_T.concat(OPS_N).filter(function (o) { return o[0] === c.op; })[0] || [0, ''])[1];
      var v = Array.isArray(c.v) ? c.v.join('، ') : (c.v === undefined ? '' : c.v);
      return fd[0] + ' ' + op + (c.op === 'empty' || c.op === 'nempty' || c.op === 'ne0' ? '' : ' «' + v + '»');
    }
    function customDesc(def) {
      if (def.kind === 'ready') return 'نسخة مخصصة من: ' + ((R[def.base] || {}).name || '');
      if (def.kind === 'formula') return 'بنود ومعادلات';
      if (def.kind === 'pair') return 'حساب مقابل حساب' + ((def.b || []).length ? '' : ' (كل الحسابات المقابلة)') + (def.kw ? ' · كلمات في البيان' : '');
      if (def.kind === 'free') return (def.mode === 'sum' ? 'ملخص' : 'قائمة تفصيلية') + ' من ' + ((SRC[def.src] || {}).name || '');
      return (DS[def.ds] || {}).name || '';
    }

    /* ===================== إنشاء تقرير (الاستوديو) =====================
       شاشة واحدة: تختار نوع التقرير، ثم تملأ خطوات مرقّمة، والمعاينة تتحدّث بجانبك مباشرة. */
    var ST_TYPES = [
      ['pair', 'حساب مقابل حساب', 'حركة حساب مع حساب آخر محدد، ويمكن حصرها بكلمات موجودة في البيان. مثال: الصندوق مقابل المصروفات، أو العملاء مقابل البنك.', '<path d="M4 7h13l-3-3M20 17H7l3 3"/>'],
      ['free', 'تقرير حر من الصفر', 'اختر مصدر البيانات (القيود أو الفواتير أو الأصناف)، ثم الأعمدة والشروط والتجميع كما تريد.', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>'],
      ['ready', 'تخصيص تقرير جاهز', 'اختر أياً من التقارير الجاهزة، وعدّل فترته وتصفيته، وأضف شروطاً على أعمدته، وأخفِ ما لا تحتاج، ثم احفظه باسمك.', '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'],
      ['formula', 'بنود ومعادلات', 'أسطر تختار لكل منها ما يُحسب (مبيعات، رصيد حساب، تحصيل…) وتربط بينها بـ + − × ÷، بعمود لكل شهر أو أسبوع.', '<path d="M5 7h14M5 12h8M5 17h11"/><path d="M17 14l4 4M21 14l-4 4"/>']
    ];
    var ST_TPL = [
      ['pair', 'حساب مقابل حساب', 'اختر الحسابين وابدأ', function () { return { kind: 'pair', a: [], b: [], kw: '', kwm: 'any', kwx: '', side: '', view: 'lines' }; }],
      ['kw', 'حركات فيها كلمة في البيان', 'مثل: إيجار، كهرباء، اسم شخص', function () { return { kind: 'free', src: 'jl', mode: 'list', cols: ['d', 'no', 'type', 'acc', 'desc', 'dr', 'cr'], conds: [{ f: 'desc', op: 'has', v: '' }] }; }],
      ['exp', 'حساب وفروعه شهرياً', 'مصروفات أو إيرادات حسب الحساب، عمود لكل شهر', function () { return { kind: 'free', src: 'jl', mode: 'sum', row: 'acc', col: 'mon', meas: ['net'], conds: [{ f: '@acc', op: 'in', v: [] }] }; }],
      ['items', 'مبيعات الأصناف لكل مندوب', 'قيمة المبيعات: صف لكل صنف وعمود لكل مندوب', function () { return { kind: 'free', src: 'invl', mode: 'sum', row: 'item', col: 'rep', meas: ['value'], conds: [{ f: 'cls', op: 'in', v: ['مبيع', 'مرتجع مبيع'] }], top: 50 }; }],
      ['big', 'أكبر فواتير المبيع', 'الفواتير مرتبة من الأكبر', function () { return { kind: 'free', src: 'inv', mode: 'list', cols: ['d', 'no', 'cust', 'rep', 'net', 'profit'], conds: [{ f: 'cls', op: 'in', v: ['مبيع'] }], sort: 'net', dir: 'desc' }; }],
      ['formula', 'مؤشرات شهرية بالمعادلات', 'المبيعات والربح وهامش الربح لكل شهر', function () { return { kind: 'formula', cols: 'month', chart: '', rows: [{ name: 'صافي المبيعات', terms: [{ k: 'مبيعات' }], fmt: 'money' }, { name: 'مجمل الربح', terms: [{ k: 'ربح' }], fmt: 'money' }, { name: 'هامش الربح %', terms: [{ k: '#var', v: 'مجمل الربح' }, { k: '#var', v: 'صافي المبيعات', op: '/' }, { k: '#num', n: 100, op: '*' }], fmt: 'pct' }] }; }]
    ];
    function stIcon(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
    function stPer() { var k = F.stPer || 'month'; return presetRange(k); }
    function opt(list, v) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
    function chipsSel(name, list, v) { return '<div class="seg2" role="group">' + list.map(function (o) { return '<button type="button" class="' + (String(v || '') === String(o[0]) ? 'on' : '') + '" data-' + name + '="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; }
    function accTags(codes, key) {
      return (codes || []).length ? '<div class="acc-tags">' + codes.map(function (c, i) { var a = F.D.byCode[c]; return '<span class="acc-tag"><b>' + esc(a ? a.name : c) + '</b><span class="num">' + esc(c) + '</span>' + (a && !a.leaf ? '<em>وكل فروعه</em>' : '') + '<button type="button" data-untag="' + key + '|' + i + '" aria-label="إزالة">×</button></span>'; }).join('') + '</div>' : '';
    }
    function sec(n, title, hint, body, opt2) { return '<section class="st-sec' + (opt2 ? ' opt' : '') + '"><div class="st-h"><span class="st-n">' + n + '</span><div><h3>' + esc(title) + (opt2 ? ' <small>اختياري</small>' : '') + '</h3>' + (hint ? '<p>' + esc(hint) + '</p>' : '') + '</div></div><div class="st-b">' + body + '</div></section>'; }

    function builderHTML() {
      var d = F.custom;
      if (d && d.def && d.def.ds && !d.def.kind) return legacyBuilderHTML();
      if (d && d.def && d.def.kind === 'ready') return '<div class="card"><h2>' + esc(d.name) + '</h2><p class="muted">' + esc(customDesc(d.def)) + '. يُعدَّل هذا النوع من شاشة التقرير نفسه: افتحه ثم اضغط «تخصيص التقرير».</p><div class="row"><button class="btn primary" data-ropen>فتح التقرير للتعديل</button><button class="btn ghost" data-rnew>تقرير جديد</button></div></div>';
      if (!d || !d.def || !d.def.kind) return studioStartHTML();
      var df = d.def, typ = ST_TYPES.filter(function (t) { return t[0] === df.kind; })[0];
      var h = '<div class="studio"><div class="st-form">';
      h += '<div class="card st-head"><div class="row"><button class="btn sm ghost" data-stback>→ تغيير النوع</button><span class="grow"></span>' + (d.id ? '<span class="badge">تعديل تقرير محفوظ</span>' : '') + '</div>' +
        '<div class="st-type">' + stIcon(typ[3]) + '<div><h2>' + esc(typ[1]) + '</h2><p class="small muted">' + esc(typ[2]) + '</p></div></div>' +
        '<div class="field"><label class="lbl" for="stname">اسم التقرير</label><input id="stname" class="input" value="' + esc(d.name || '') + '" placeholder="اسم يظهر في «تقاريري»، مثل: مصروفات الصندوق الشهرية"></div></div>';
      if (df.kind === 'pair') h += pairForm(df);
      else if (df.kind === 'free') h += freeForm(df);
      else h += formulaForm(df);
      h += '</div><aside class="st-prev"><div class="card st-pcard"><div class="st-ph"><h3>المعاينة</h3>' + chipsSel('stper', [['month', 'هذا الشهر'], ['lastmonth', 'الشهر الماضي'], ['year', 'هذه السنة']], F.stPer || 'month') + '</div>' +
        '<div id="stprev"></div><div class="st-actions"><button class="btn primary grow" data-stopen>عرض التقرير كاملاً</button>' + (canEdit() ? '<button class="btn accent grow" data-stsave>' + (d.id ? 'حفظ التعديل' : 'حفظ في تقاريري') + '</button>' : '') + '</div>' +
        (d.id ? '<button class="btn sm danger" data-stdel style="margin-top:8px">حذف هذا التقرير</button>' : '') + '</div></aside></div>';
      return h;
    }
    function studioStartHTML() {
      var h = '<div class="card st-intro"><h2>ماذا تريد أن تبني؟</h2><p class="muted">اختر نوع التقرير. ستملأ خطوات قليلة واضحة، وترى النتيجة مباشرة قبل الحفظ.</p><div class="st-types">' +
        ST_TYPES.map(function (t) { return '<button class="st-tcard" data-sttype="' + t[0] + '">' + stIcon(t[3]) + '<b>' + esc(t[1]) + '</b><span>' + esc(t[2]) + '</span></button>'; }).join('') + '</div></div>';
      h += '<div class="card"><h3>أو ابدأ من نموذج جاهز وعدّله</h3><div class="st-tpls">' + ST_TPL.map(function (t) { return '<button class="item tap st-tpl" data-sttpl="' + t[0] + '"><div class="main"><b>' + esc(t[1]) + '</b><div class="small muted">' + esc(t[2]) + '</div></div><span class="st-go">←</span></button>'; }).join('') + '</div></div>';
      if (F.reports.length) h += '<div class="card"><h3>تقاريري المحفوظة</h3><div class="st-tpls">' + F.reports.map(function (r) { return '<button class="item tap st-tpl" data-stedit="' + esc(r.id) + '"><div class="main"><b>' + esc(r.name) + '</b><div class="small muted">' + esc(customDesc(r.def)) + (r.by ? ' · ' + esc(r.by) : '') + '</div></div><span class="btn sm ghost">تعديل</span></button>'; }).join('') + '</div></div>';
      return h;
    }

    /* ---------- نموذج «حساب مقابل حساب» ---------- */
    function pairForm(df) {
      var anyB = !(df.b || []).length && !df.bpick;
      return sec(1, 'الحساب الأساسي', 'الحساب الذي تريد حركته. الحساب الرئيسي يشمل كل فروعه، ويمكن اختيار أكثر من حساب.',
          accTags(df.a, 'a') + '<button type="button" class="btn" data-pick="a">' + ((df.a || []).length ? 'تغيير الحساب' : '+ اختر الحساب') + '</button>') +
        sec(2, 'الحساب المقابل', 'الطرف الآخر في القيد. اختر «أي حساب» لترى كل الحسابات المقابلة.',
          chipsSel('bmode', [['any', 'أي حساب'], ['pick', 'حساب محدد']], anyB ? 'any' : 'pick') +
          (anyB ? '' : '<div style="margin-top:10px">' + accTags(df.b, 'b') + '<button type="button" class="btn" data-pick="b">' + ((df.b || []).length ? 'تغيير الحساب المقابل' : '+ اختر الحساب المقابل') + '</button></div>')) +
        sec(3, 'كلمات في البيان', 'تظهر فقط الحركات التي في بيانها هذه الكلمات. افصل بين الكلمات بفاصلة.',
          '<div class="field"><input id="stkw" class="input" value="' + esc(df.kw || '') + '" placeholder="مثل: إيجار، كهرباء، محمد"></div>' +
          '<div class="row st-inl"><span class="small">تظهر الحركة إذا وُجدت</span>' + chipsSel('kwm', [['any', 'أي كلمة'], ['all', 'كل الكلمات']], df.kwm || 'any') + '</div>' +
          '<div class="field" style="margin-top:10px"><label class="lbl" for="stkwx">واستبعد الحركات التي فيها</label><input id="stkwx" class="input" value="' + esc(df.kwx || '') + '" placeholder="اختياري: كلمات لا تريدها"></div>', true) +
        sec(4, 'أي الحركات؟', '', chipsSel('side', [['', 'الكل'], ['dr', 'المدينة فقط'], ['cr', 'الدائنة فقط']], df.side || '')) +
        sec(5, 'طريقة العرض', '', chipsSel('pview', PAIR_VIEWS, df.view || 'lines'));
    }

    /* ---------- نموذج «التقرير الحر» ---------- */
    function freeForm(df) {
      var src = SRC[df.src], h = '';
      h += sec(1, 'من أين البيانات؟', '', '<div class="st-src">' + Object.keys(SRC).map(function (k) { return '<button type="button" class="st-scard' + (df.src === k ? ' on' : '') + '" data-src="' + k + '"><b>' + esc(SRC[k].name) + '</b><span>' + esc(SRC[k].hint) + '</span></button>'; }).join('') + '</div>');
      if (!src) return h;
      var F_ = src.f, keys = Object.keys(F_), numK = keys.filter(function (k) { return NUMT[F_[k][1]]; }), txtK = keys.filter(function (k) { return !NUMT[F_[k][1]]; });
      if (!multiBr()) { txtK = txtK.filter(function (k) { return k !== 'br'; }); keys = keys.filter(function (k) { return k !== 'br'; }); }
      h += sec(2, 'شكل التقرير', '', '<div class="st-src two"><button type="button" class="st-scard' + (df.mode !== 'sum' ? ' on' : '') + '" data-mode="list"><b>قائمة تفصيلية</b><span>كل سطر كما هو، بالأعمدة التي تختارها، مع مجاميع.</span></button>' +
        '<button type="button" class="st-scard' + (df.mode === 'sum' ? ' on' : '') + '" data-mode="sum"><b>ملخص مجمّع</b><span>مجاميع حسب ما تختار: شهر، حساب، عميل، صنف…</span></button></div>');
      if (df.mode === 'sum') {
        h += sec(3, 'التجميع', 'كل صف في التقرير يمثّل قيمة واحدة مما تختاره هنا.',
          '<div class="row"><div class="field grow"><label class="lbl" for="strow">صف لكل</label><select id="strow" class="input">' + opt(txtK.map(function (k) { return [k, F_[k][0]]; }), df.row || 'mon') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="stcol">وعمود لكل (اختياري)</label><select id="stcol" class="input"><option value="">بدون</option>' + opt(txtK.filter(function (k) { return k !== df.row; }).map(function (k) { return [k, F_[k][0]]; }), df.col || '') + '</select></div></div>' +
          '<div class="field"><span class="lbl">الأرقام المطلوبة</span><div class="st-pills">' + numK.concat(['@n']).map(function (k) { var on = (df.meas || []).indexOf(k) >= 0; return '<button type="button" class="pill' + (on ? ' on' : '') + '" data-meas="' + k + '">' + (on ? '✓ ' : '') + esc(k === '@n' ? 'العدد' : F_[k][0]) + '</button>'; }).join('') + '</div>' +
          (df.col ? '<p class="small muted" style="margin:6px 0 0">مع «عمود لكل» يُوزَّع الرقم الأول فقط على الأعمدة.</p>' : '') + '</div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="stsort">الترتيب</label><select id="stsort" class="input">' + opt([['', 'تلقائي'], ['_val', 'الأكبر أولاً'], ['_name', 'أبجدي / زمني']], df.sort || '') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="sttop">العرض</label><select id="sttop" class="input">' + opt([[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50'], [100, 'أعلى 100']], df.top || 0) + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="stchart">رسم بياني</label><select id="stchart" class="input">' + opt([['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط'], ['hbar', 'أشرطة أفقية']], df.chart || '') + '</select></div></div>');
      } else {
        var cols = (df.cols || []).filter(function (k) { return F_[k]; });
        h += sec(3, 'الأعمدة', 'اضغط على أي حقل لإضافته أو إزالته. رتّب الأعمدة المختارة بالأسهم.',
          '<div class="st-cols">' + (cols.length ? cols.map(function (k, i) { return '<span class="col-pill"><button type="button" data-cmv="' + i + '|-1" aria-label="قبل"' + (i ? '' : ' disabled') + '>→</button><b>' + esc(F_[k][0]) + '</b><button type="button" data-cmv="' + i + '|1" aria-label="بعد"' + (i < cols.length - 1 ? '' : ' disabled') + '>←</button><button type="button" data-cdel="' + i + '" aria-label="إزالة">×</button></span>'; }).join('') : '<span class="muted small">لم تختر أعمدة بعد</span>') + '</div>' +
          '<div class="st-pills" style="margin-top:10px">' + keys.filter(function (k) { return cols.indexOf(k) < 0; }).map(function (k) { return '<button type="button" class="pill add" data-cadd="' + k + '">+ ' + esc(F_[k][0]) + '</button>'; }).join('') + '</div>' +
          '<div class="row" style="margin-top:12px"><div class="field grow"><label class="lbl" for="stsortf">رتّب حسب</label><select id="stsortf" class="input">' + opt(keys.map(function (k) { return [k, F_[k][0]]; }), df.sort || 'd') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="stdir">الاتجاه</label><select id="stdir" class="input">' + opt([['', 'تلقائي'], ['asc', 'تصاعدي'], ['desc', 'تنازلي']], df.dir || '') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="stgrp">جمّع في مجموعات حسب</label><select id="stgrp" class="input"><option value="">بدون</option>' + opt(txtK.map(function (k) { return [k, F_[k][0]]; }), df.group || '') + '</select></div></div>' +
          (df.group ? '<label class="chk"><input type="checkbox" id="stcoll"' + (df.collapse ? ' checked' : '') + '> اعرض مجموع كل مجموعة فقط (بدون التفاصيل)</label>' : ''));
      }
      var conds = df.conds || [];
      h += sec(4, 'الشروط', 'لحصر البيانات: حساب معيّن وفروعه، كلمات في البيان، نوع حركة، مبلغ أكبر من… كل الشروط يجب أن تتحقق معاً.',
        '<div class="st-conds">' + conds.map(function (c, i) { return condRow(df.src, c, i); }).join('') + '</div><button type="button" class="btn" data-cadd2>+ أضف شرطاً</button>', true);
      return h;
    }
    function condFields(srcK) {
      var src = SRC[srcK], out = srcK === 'jl' ? [['@acc', 'الحساب (وكل فروعه)']] : [];
      return out.concat(Object.keys(src.f).filter(function (k) { return src.f[k][1] !== 'date' && (k !== 'br' || multiBr()); }).map(function (k) { return [k, src.f[k][0]]; }));
    }
    function condRow(srcK, c, i) {
      var fd = c.f === '@acc' ? null : SRC[srcK].f[c.f], isN = fd && NUMT[fd[1]];
      var ops = c.f === '@acc' ? [['in', 'تحت'], ['nin', 'ليس تحت']] : isN ? OPS_N : OPS_T;
      var val = '';
      if (c.f === '@acc') val = accTags(c.v || [], 'c' + i) + '<button type="button" class="btn sm" data-cacc="' + i + '">' + ((c.v || []).length ? 'تغيير' : 'اختر الحساب') + '</button>';
      else if (c.op === 'in' || c.op === 'nin') val = '<button type="button" class="input selbtn" data-cpick="' + i + '">' + ((c.v || []).length ? esc(c.v.slice(0, 3).join('، ') + (c.v.length > 3 ? ' و' + (c.v.length - 3) + ' أخرى' : '')) : 'اختر من القائمة…') + '</button>';
      else if (c.op === 'empty' || c.op === 'nempty' || c.op === 'ne0') val = '';
      else val = '<input class="input" data-cval="' + i + '" ' + (isN ? 'type="number" inputmode="decimal"' : '') + ' value="' + esc(c.v === undefined ? '' : c.v) + '" placeholder="' + (isN ? '0' : 'كلمة أو أكثر، افصل بفاصلة') + '">';
      return '<div class="cond"><div class="cond-r"><select class="input" data-cf="' + i + '" aria-label="الحقل">' + opt(condFields(srcK), c.f) + '</select><select class="input" data-cop="' + i + '" aria-label="الشرط">' + opt(ops, c.op) + '</select>' +
        '<button type="button" class="iconbtn" data-cx="' + i + '" aria-label="حذف الشرط">' + ICON.close + '</button></div>' + (val ? '<div class="cond-v">' + val + '</div>' : '') + '</div>';
    }

    /* ---------- نموذج «بنود ومعادلات» (المحرّر الحالي في خطوات أوضح) ---------- */
    function formulaForm(df) {
      var t = today();
      return sec(1, 'الأسطر', 'كل سطر: اسم وما يُحسب له. اضغط «تعديل» لاختيار ما يُحسب من قائمة، ويمكن استعمال الأسطر السابقة في المعادلات.',
          listEditorHTML('frow', df.rows || [], { from: t.slice(0, 7) + '-01', to: t }) + '<div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-fadd>+ سطر</button><button type="button" class="btn sm ghost" data-fsep>+ عنوان قسم</button></div>') +
        sec(2, 'الأعمدة', '', chipsSel('fcols', [['single', 'الفترة كاملة'], ['month', 'لكل شهر'], ['week', 'لكل أسبوع'], ['day', 'لكل يوم']], df.cols || 'month')) +
        sec(3, 'رسم بياني', 'للسطر الأول', chipsSel('fch', [['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط']], df.chart || ''), true);
    }

    function previewHTML() {
      var d = F.custom, r = stPer(), res;
      try { res = runCustom(d.def, { from: r[0], to: r[1], preset: 'custom' }); } catch (e) { res = { cols: [], rows: [], empty: 'تعذّر الحساب: ' + e.message }; }
      var h = '<div class="small muted st-pnote">' + perLabel(r[0], r[1]) + (res.note ? ' · ' + esc(plain(res.note)) : '') + '</div>';
      if (res.empty) return h + '<div class="st-empty">' + esc(res.empty) + '</div>';
      var short = { cols: res.cols, rows: res.rows.slice(0, 60), total: res.total };
      if (res.chart && res.rows.length > 1) h += chartSVG(res.chart, res.rows);
      h += '<div class="scroll-x fin-table st-tbl">' + tableHTML(short).replace(/<p class="small muted"[\s\S]*<\/p>$/, '') + '</div>';
      if (res.rows.length > 60) h += '<p class="small muted">يظهر أول 60 سطراً من ' + fk(res.rows.length) + '. «عرض التقرير كاملاً» يعرض الكل.</p>';
      return h;
    }

    function bindBuilder(m) {
      var d = F.custom;
      if (d && d.def && d.def.ds && !d.def.kind) return legacyBindBuilder(m);
      if (d && d.def && d.def.kind === 'ready') { q('[data-ropen]', m).onclick = function () { var id = d.id; F.custom = null; F.vpOpen = true; openReport('c:' + id); }; q('[data-rnew]', m).onclick = function () { F.custom = null; A.render(); }; return; }
      if (!d || !d.def || !d.def.kind) {
        qa('[data-sttype]', m).forEach(function (b) { b.onclick = function () { var k = b.dataset.sttype; if (k === 'ready') { pickReady(); return; } F.custom = { name: '', cat: 'تقاريري', def: ST_TPL.filter(function (t) { return t[0] === (k === 'free' ? 'kw' : k); })[0][3]() }; if (k === 'free') F.custom.def = { kind: 'free', src: '', mode: 'list', cols: [], conds: [] }; A.render(); window.scrollTo(0, 0); }; });
        qa('[data-sttpl]', m).forEach(function (b) { b.onclick = function () { var t = ST_TPL.filter(function (x) { return x[0] === b.dataset.sttpl; })[0]; F.custom = { name: t[0] === 'pair' ? '' : t[1], cat: 'تقاريري', def: t[3]() }; A.render(); window.scrollTo(0, 0); }; });
        qa('[data-stedit]', m).forEach(function (b) { b.onclick = function () { var r = F.reports.filter(function (x) { return x.id === b.dataset.stedit; })[0]; if (r) { F.custom = JSON.parse(JSON.stringify(r)); A.render(); window.scrollTo(0, 0); } }; });
        return;
      }
      var df = d.def;
      var pv = function () { var el = q('#stprev', m); if (el) el.innerHTML = previewHTML(); };
      var re = function () { F.dirty = true; A.render(); };
      pv();
      q('#stname', m).oninput = function () { d.name = this.value; F.dirty = true; };
      q('[data-stback]', m).onclick = function () { A.confirmBox('تغيير النوع', 'ستبدأ تقريراً جديداً من البداية. هل تريد المتابعة؟', 'نعم').then(function (y) { if (y) { F.custom = null; F.dirty = false; A.render(); } }); };
      qa('[data-stper]', m).forEach(function (b) { b.onclick = function () { F.stPer = b.dataset.stper; qa('[data-stper]', m).forEach(function (x) { x.classList.toggle('on', x === b); }); pv(); }; });
      qa('[data-untag]', m).forEach(function (b) { b.onclick = function () { var p2 = b.dataset.untag.split('|'), list = p2[0] === 'a' ? df.a : p2[0] === 'b' ? df.b : df.conds[Number(p2[0].slice(1))].v; list.splice(Number(p2[1]), 1); if (p2[0][0] === 'c') delete df.conds[Number(p2[0].slice(1))]._ids; re(); }; });
      if (df.kind === 'pair') {
        qa('[data-pick]', m).forEach(function (b) {
          b.onclick = function () {
            var k = b.dataset.pick;
            pickAccount({ multi: true, value: df[k] || [], title: k === 'a' ? 'اختر الحساب الأساسي' : 'اختر الحساب المقابل', hint: 'الحساب الرئيسي يشمل كل فروعه. يمكنك اختيار أكثر من حساب.' }).then(function (codes) { if (codes) { df[k] = codes; if (k === 'a' && !d.name && codes.length) d.name = 'حركة ' + codesText(codes); re(); } });
          };
        });
        qa('[data-bmode]', m).forEach(function (b) { b.onclick = function () { if (b.dataset.bmode === 'any') { df.b = []; df.bpick = false; } else df.bpick = true; re(); }; });
        var kwT = null, kwIn = function () { df.kw = q('#stkw', m).value; df.kwx = q('#stkwx', m).value; F.dirty = true; clearTimeout(kwT); kwT = setTimeout(pv, 450); };
        q('#stkw', m).oninput = kwIn; q('#stkwx', m).oninput = kwIn;
        qa('[data-kwm]', m).forEach(function (b) { b.onclick = function () { df.kwm = b.dataset.kwm; re(); }; });
        qa('[data-side]', m).forEach(function (b) { b.onclick = function () { df.side = b.dataset.side; re(); }; });
        qa('[data-pview]', m).forEach(function (b) { b.onclick = function () { df.view = b.dataset.pview; re(); }; });
      } else if (df.kind === 'free') {
        qa('[data-src]', m).forEach(function (b) { b.onclick = function () { if (df.src === b.dataset.src) return; df.src = b.dataset.src; df.cols = SRC[df.src].def.slice(); df.conds = []; df.row = 'mon'; df.col = ''; df.meas = []; df.sort = ''; df.group = ''; re(); }; });
        qa('[data-mode]', m).forEach(function (b) { b.onclick = function () { df.mode = b.dataset.mode; if (df.mode === 'sum' && !(df.meas || []).length) { var nk = Object.keys(SRC[df.src].f).filter(function (k) { return NUMT[SRC[df.src].f[k][1]]; }); df.meas = nk.slice(0, 1); df.row = df.row || 'mon'; df.sort = ''; } if (df.mode === 'list') df.sort = df.sort && SRC[df.src].f[df.sort] ? df.sort : 'd'; re(); }; });
        var on = function (sel, fn) { var el = q(sel, m); if (el) el.onchange = function () { fn(el); re(); }; };
        on('#strow', function (el) { df.row = el.value; if (df.col === df.row) df.col = ''; });
        on('#stcol', function (el) { df.col = el.value; });
        on('#stsort', function (el) { df.sort = el.value; });
        on('#sttop', function (el) { df.top = Number(el.value) || 0; });
        on('#stchart', function (el) { df.chart = el.value; });
        on('#stsortf', function (el) { df.sort = el.value; });
        on('#stdir', function (el) { df.dir = el.value; });
        on('#stgrp', function (el) { df.group = el.value; if (!df.group) df.collapse = false; });
        on('#stcoll', function (el) { df.collapse = el.checked; });
        qa('[data-meas]', m).forEach(function (b) { b.onclick = function () { var k = b.dataset.meas; df.meas = df.meas || []; var i = df.meas.indexOf(k); if (i >= 0) df.meas.splice(i, 1); else df.meas.push(k); re(); }; });
        qa('[data-cadd]', m).forEach(function (b) { b.onclick = function () { df.cols = df.cols || []; df.cols.push(b.dataset.cadd); re(); }; });
        qa('[data-cdel]', m).forEach(function (b) { b.onclick = function () { df.cols.splice(Number(b.dataset.cdel), 1); re(); }; });
        qa('[data-cmv]', m).forEach(function (b) { b.onclick = function () { var p2 = b.dataset.cmv.split('|'), i = Number(p2[0]), j = i + Number(p2[1]); var t = df.cols[i]; df.cols[i] = df.cols[j]; df.cols[j] = t; re(); }; });
        var ca = q('[data-cadd2]', m);
        if (ca) ca.onclick = function () { df.conds = df.conds || []; df.conds.push(df.src === 'jl' ? { f: '@acc', op: 'in', v: [] } : { f: 'cust', op: 'has', v: '' }); re(); };
        qa('[data-cf]', m).forEach(function (el) { el.onchange = function () { var c = df.conds[Number(el.dataset.cf)], fd = SRC[df.src].f[el.value]; c.f = el.value; delete c._ids; c.op = el.value === '@acc' ? 'in' : fd && NUMT[fd[1]] ? 'gt' : 'has'; c.v = el.value === '@acc' ? [] : ''; re(); }; });
        qa('[data-cop]', m).forEach(function (el) { el.onchange = function () { var c = df.conds[Number(el.dataset.cop)], was = c.op; c.op = el.value; if ((c.op === 'in' || c.op === 'nin') !== (was === 'in' || was === 'nin') && c.f !== '@acc') c.v = c.op === 'in' || c.op === 'nin' ? [] : ''; re(); }; });
        qa('[data-cx]', m).forEach(function (b) { b.onclick = function () { df.conds.splice(Number(b.dataset.cx), 1); re(); }; });
        var cvT = null;
        qa('[data-cval]', m).forEach(function (el) { el.oninput = function () { df.conds[Number(el.dataset.cval)].v = el.value; F.dirty = true; clearTimeout(cvT); cvT = setTimeout(pv, 450); }; });
        qa('[data-cacc]', m).forEach(function (b) { b.onclick = function () { var c = df.conds[Number(b.dataset.cacc)]; pickAccount({ multi: true, value: c.v || [], title: 'اختر الحساب', hint: 'الحساب الرئيسي يشمل كل فروعه.' }).then(function (codes) { if (codes) { c.v = codes; delete c._ids; re(); } }); }; });
        qa('[data-cpick]', m).forEach(function (b) {
          b.onclick = function () {
            var c = df.conds[Number(b.dataset.cpick)], r = stPer();
            var vals = fieldVals(df.src, c.f, F.stPer === 'year' ? null : addD(r[0], -365), r[1]);
            pickMulti({ title: 'اختر: ' + SRC[df.src].f[c.f][0], options: vals.map(function (v) { return { id: v, name: v }; }), value: c.v || [] }).then(function (sel) { if (sel) { c.v = sel; re(); } });
          };
        });
      } else {
        var t = today(), from = t.slice(0, 7) + '-01';
        df.rows = df.rows || [];
        bindListEditor(m, 'frow', function () { return df.rows; }, 'frow', function (i) { return ctxFor(df.rows, i, from, t, 'هذا الشهر'); }, re);
        q('[data-fadd]', m).onclick = function () { editItem(null, 'frow', ctxFor(df.rows, df.rows.length, from, t, 'هذا الشهر')).then(function (o) { if (o) { df.rows.push(o); re(); } }); };
        q('[data-fsep]', m).onclick = function () { editItem({ name: '', f: '' }, 'row', { from: from, to: t }).then(function (o) { if (o) { df.rows.push({ name: o.name, f: o.f || '', fmt: o.fmt }); re(); } }); };
        qa('[data-fcols]', m).forEach(function (b) { b.onclick = function () { df.cols = b.dataset.fcols; re(); }; });
        qa('[data-fch]', m).forEach(function (b) { b.onclick = function () { df.chart = b.dataset.fch; re(); }; });
      }
      q('[data-stopen]', m).onclick = function () {
        var r = stPer();
        F.cur = { id: 'tmp', custom: { id: d.id, name: d.name || 'تقرير بدون اسم', cat: d.cat, def: df, tmp: true }, p: { preset: F.stPer || 'month', from: r[0], to: r[1], flt: null } };
        F.sub = 'reports'; A.go('reports'); window.scrollTo(0, 0);
      };
      var sv = q('[data-stsave]', m);
      if (sv) sv.onclick = function () { saveCustom(d, sv); };
      var del = q('[data-stdel]', m);
      if (del) del.onclick = function () {
        A.confirmBox('حذف التقرير', 'حذف «' + esc(d.name) + '» من تقاريري؟', 'حذف').then(function (y) {
          if (!y) return;
          call('fin_report_delete', { id: d.id }).then(function (r) { F.reports = r.reports; F.custom = null; F.dirty = false; toast('حُذف التقرير'); go('reports'); }).catch(function (e) { toast(e.message, true); });
        });
      };
    }
    function cleanDef(df) {
      return JSON.parse(JSON.stringify(df, function (k, v) { return k === '_ids' || k === 'bpick' ? undefined : v; }));
    }
    function saveCustom(d, btn) {
      var df = d.def;
      d.name = String(d.name || '').trim();
      if (!d.name) { toast('اكتب اسم التقرير في الأعلى', true); var n = q('#stname'); if (n) n.focus(); return; }
      if (df.kind === 'pair' && !(df.a || []).length) { toast('اختر الحساب الأساسي', true); return; }
      if (df.kind === 'free' && !df.src) { toast('اختر مصدر البيانات', true); return; }
      if (df.kind === 'formula' && !(df.rows || []).some(function (r) { return itemF(r); })) { toast('أضف سطراً فيه ما يُحسب', true); return; }
      busy(btn, true);
      call('fin_report_save', { report: { id: d.id, name: d.name, cat: d.cat || 'تقاريري', def: cleanDef(df) } }).then(function (r) {
        F.reports = r.reports; var saved = d.id ? r.reports.filter(function (x) { return x.id === d.id; })[0] : r.reports.filter(function (x) { return x.name === d.name; }).pop();
        toast('حُفظ التقرير في «تقاريري»'); F.custom = null; F.dirty = false;
        if (saved) openReport('c:' + saved.id, null, { noPush: true }); else go('reports');
      }).catch(function (e) { busy(btn, false); toast(e.message, true); });
    }

    /* ---------- فهرس التقارير ---------- */
    function catalogHTML() {
      var n = repKeys().length;
      var h = '<div class="card cat-top"><div class="cat-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input class="input" id="rq" placeholder="ابحث في ' + n + ' تقريراً: مبيعات، عميل، ميزانية، مخزون…" value="' + esc(F.rq || '') + '" aria-label="بحث في التقارير"></div>' +
        (canEdit() ? '<div class="cat-cta"><button class="btn accent" data-newrep>+ إنشاء تقرير</button><button class="btn" data-newpair>حساب مقابل حساب</button></div>' : '') + '</div>' +
        '';
      var view = F.rcat || 'home';
      if (view === 'home' && !F.rq) return h + catHomeHTML() + savedHomeHTML();
      h += '<div class="cat-nav"><button class="btn sm ghost cat-back" data-jump="home">→ كل الأقسام</button><div class="cat-filter" role="group" aria-label="التصنيف">' + [['all', 'الكل']].concat(F.reports.length ? [['mine', 'تقاريري']] : []).concat(CATS.filter(function (c) { return c[0] !== 'mine'; })).map(function (c) { return '<button class="' + (view === c[0] ? 'on' : '') + '" data-jump="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div></div>';
      var mine = F.reports.map(function (r) { return { id: 'c:' + r.id, rid: r.id, name: r.name, desc: customDesc(r.def), by: r.by }; });
      var cats = [['mine', 'تقاريري']].concat(CATS.filter(function (c) { return c[0] !== 'mine'; }));
      cats.forEach(function (c) {
        var list = c[0] === 'mine' ? mine : repKeys().filter(function (k) { return R[k].cat === c[0]; }).map(function (k) { return { id: k, name: R[k].name, desc: R[k].desc }; });
        if (!list.length && c[0] !== 'mine') return;
        if (!list.length && !canEdit()) return;
        if (view !== 'all' && view !== c[0]) return;
        h += '<section class="fin-catsec' + (c[0] === 'mine' ? ' mine' : '') + '" id="cat-' + c[0] + '"><div class="sec-title"><h2>' + c[1] + ' <span class="badge">' + list.length + '</span></h2></div><div class="fin-cat">' + (list.length ? list.map(function (r) {
          return '<div class="rep-tile" data-s="' + esc(r.name + ' ' + (r.desc || '') + ' ' + c[1]) + '"><button class="rep-open" data-open="' + esc(r.id) + '"><b>' + esc(r.name) + '</b><span>' + esc(r.desc || '') + (r.by ? ' · ' + esc(r.by) : '') + '</span></button>' +
            (r.rid && canEdit() ? '<button class="iconbtn rep-ed" data-redit="' + esc(r.rid) + '" aria-label="تعديل" title="تعديل">' + ICON_EDIT + '</button>' : '') + '</div>';
        }).join('') : '<div class="cat-empty"><b>لا توجد تقارير خاصة بك بعد</b><span>صمّم تقريراً من الصفر واحفظه هنا ليظهر لكل المستخدمين.</span><button class="btn sm accent" data-newrep>+ إنشاء تقرير</button></div>') + '</div></section>';
      });
      return h;
    }
    // الصفحة الأولى للتقارير: بطاقة لكل قسم رئيسي، وعند الضغط تظهر تقاريره
    var CAT_INFO = {
      exec: ['ملخص الإدارة ومؤشرات الأداء', 'M4 19V9m6 10V5m6 14v-7m4 7H2'], stmt: ['قائمة الدخل والميزانية والتدفقات', 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7'],
      acct: ['اليومية والأستاذ وميزان المراجعة', 'M4 5h16v14H4zM4 10h16M10 10v9'], sales: ['المبيعات حسب الصنف والعميل والفترة', 'M3 4h2l2.4 11h11L21 7H6.2M9 20h.01M18 20h.01'],
      reps: ['أداء المناديب وفئاتهم', 'M8 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M17 11a3 3 0 100-6M22 21v-1a5 5 0 00-4-4.9'],
      cust: ['تحليل العملاء وتقييمهم وأسعارهم', 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a8 8 0 0116 0v1'], cust1: ['كل شيء عن عميل واحد', 'M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20a7 7 0 0114 0M19 4l2 2-2 2'],
      cgrp: ['الوكلاء والفروع ومجموعات العملاء', 'M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4'], debts: ['المديونيات وأعمارها والتحصيل', 'M3 6h18v12H3zM3 10h18M7 15h3'],
      cash: ['الصناديق والبنوك والسندات', 'M3 10l9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18'], items: ['الأصناف وربحيتها وتحليلها', 'M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8M12 13v8'],
      disc: ['قوائم الأسعار والتخفيضات والحسومات والهدايا', 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01'],
      analytics: ['إحصاءات وتوقعات وتوزيعات', 'M12 3v9l7 4M21 12a9 9 0 11-9-9'], purch: ['المشتريات والموردون', 'M3 7h13v10H3zM16 10h3l2 3v4h-5M7 20a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4z'],
      supp: ['فواتير الموردين ومرتجعاتهم وأصنافهم والبونص', 'M4 3h12l4 4v14H4zM15 3v5h5M8 12h8M8 16h8M8 8h3'],
      stock: ['المخزون والحركة والتغطية', 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'], admin: ['المستخدمون وسجل التعديلات', 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2 .5-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5L7.5 18 7 20l3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z'],
      mine: ['التقارير التي صممتها وحفظتها', 'M12 3l2.7 5.5 6 .9-4.4 4.2 1 6L12 16.8 6.7 19.6l1-6L3.3 9.4l6-.9z']
    };
    function catHomeHTML() {
      var cnt = {}; repKeys().forEach(function (k) { cnt[R[k].cat] = (cnt[R[k].cat] || 0) + 1; }); cnt.mine = F.reports.length;
      var cats = (F.reports.length || canEdit() ? [['mine', 'تقاريري']] : []).concat(CATS.filter(function (c) { return c[0] !== 'mine' && cnt[c[0]]; }));
      var icon = function (k) { var d = (CAT_INFO[k] || ['', 'M4 4h16v16H4z'])[1]; return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
      var names = function (k) { return repKeys().filter(function (r) { return R[r].cat === k; }).slice(0, 3).map(function (r) { return R[r].name; }).join(' · '); };
      return '<div class="cat-home">' + cats.map(function (c) {
        return '<button class="cat-card' + (c[0] === 'mine' ? ' mine' : '') + '" data-jump="' + c[0] + '"><span class="cat-ic">' + icon(c[0]) + '</span><span class="cat-tx"><b>' + esc(c[1]) + '</b><span class="cat-sub">' + esc((CAT_INFO[c[0]] || [''])[0]) + '</span>' +
          '<span class="cat-ex">' + esc(c[0] === 'mine' ? (cnt.mine ? F.reports.slice(0, 3).map(function (r) { return r.name; }).join(' · ') : 'لم تحفظ تقارير بعد') : names(c[0])) + '</span></span><span class="cat-cnt">' + fk(cnt[c[0]] || 0) + '</span></button>';
      }).join('') + '</div><div class="row" style="justify-content:center;margin-top:14px"><button class="btn ghost" data-jump="all">عرض كل التقارير (' + repKeys().length + ') في قائمة واحدة</button></div>';
    }
    function bindCatalog(m) {
      var inp = q('#rq', m);
      var apply = function () {
        var t = normAr(inp.value); F.rq = inp.value.trim();
        if (t && (F.rcat || 'home') !== 'all') { F.rcatPrev = F.rcat || 'home'; F.rcat = 'all'; A.render(); var ni = q('#rq'); if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } return; }
        if (!t && F.rcatPrev && F.rcat === 'all') { F.rcat = F.rcatPrev; F.rcatPrev = null; A.render(); var n2 = q('#rq'); if (n2) n2.focus(); return; }
        qa('.rep-tile', m).forEach(function (b) { b.hidden = !!t && normAr(b.dataset.s).indexOf(t) < 0; });
        qa('.fin-catsec', m).forEach(function (s) { s.hidden = !!t && !qa('.rep-tile', s).some(function (b) { return !b.hidden; }); });
      };
      inp.oninput = apply; if (F.rq) apply();
      qa('[data-jump]', m).forEach(function (b) { b.onclick = function () { if (window.RKNav && F.rcat !== b.dataset.jump) RKNav.push(); F.rcat = b.dataset.jump; F.rcatPrev = null; inp.value = ''; F.rq = ''; A.render(); window.scrollTo(0, 0); }; });
      qa('[data-newrep]', m).forEach(function (b) { b.onclick = function () { F.custom = null; go('builder'); }; });
      bindSavedHome(m);
      var np = q('[data-newpair]', m); if (np) np.onclick = function () { F.custom = { name: '', cat: 'تقاريري', def: ST_TPL[0][3]() }; go('builder'); };
      qa('[data-redit]', m).forEach(function (b) { b.onclick = function () { var r = F.reports.filter(function (x) { return x.id === b.dataset.redit; })[0]; if (!r) return; if (r.def.kind === 'ready') { F.vpOpen = true; openReport('c:' + r.id); return; } F.custom = JSON.parse(JSON.stringify(r)); go('builder'); }; });
    }

    function pickReady() {
      var list = repKeys().map(function (k) { return { id: k, name: R[k].name, desc: R[k].desc, cat: (CATS.filter(function (c) { return c[0] === R[k].cat; })[0] || [0, ''])[1] }; });
      sheet('اختر التقرير الذي تريد تخصيصه', '<input class="input" id="rpq" placeholder="ابحث باسم التقرير…"><div class="list rp-list" id="rpl"></div>', function (s) {
        var inp = q('#rpq', s.el), box = q('#rpl', s.el);
        var draw = function () {
          var t = normAr(inp.value);
          box.innerHTML = list.filter(function (r) { return !t || normAr(r.name + ' ' + r.desc + ' ' + r.cat).indexOf(t) >= 0; }).map(function (r) { return '<button class="item tap" data-rp="' + r.id + '"><div class="main"><b>' + esc(r.name) + '</b><div class="meta"><span class="badge">' + esc(r.cat) + '</span><span>' + esc(r.desc) + '</span></div></div></button>'; }).join('') || '<p class="muted">لا نتائج</p>';
          qa('[data-rp]', box).forEach(function (b) { b.onclick = function () { s.close(); F.vpOpen = true; openReport(b.dataset.rp); }; });
        };
        inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
      });
    }

    /* ===================== تقارير إضافية: تنفيذية، محاسبية، مبيعات، أصناف، عملاء، تحليلية وإحصائية ===================== */
    (function () {
      var ai = CATS.map(function (c) { return c[0]; }).indexOf('purch');
      CATS.splice(ai, 0, ['items', 'الأصناف'], ['analytics', 'تحليلية وإحصائية']);
    })();
    var SALE_F = ['cust', 'item', 'st', 'ag', 'u', 'xcust', 'xitem'];
    function monthsOf(p) {
      var out = [], m = p.from.slice(0, 7), end = p.to.slice(0, 7);
      while (m <= end) { out.push({ m: m, a: m + '-01' < p.from ? p.from : m + '-01', b: monthEnd(m) > p.to ? p.to : monthEnd(m), label: monthLabel(m) }); m = addD(monthEnd(m), 1).slice(0, 7); }
      return out;
    }
    // تجميع أسطر المبيع حسب الفاتورة (فتعمل تصفية الصنف والمخزن)
    function invAgg(from, to, f) {
      var g = {};
      facts('s', from, to, f).forEach(function (x) {
        var r = g[x.v.id] || (g[x.v.id] = { v: x.v, s: x.s, val: 0, qty: 0, lines: 0, profit: 0, items: {} });
        r.val += x.val; r.qty += x.qty; r.lines++; r.profit += x.profit; r.items[x.l.item] = 1;
      });
      return Object.keys(g).map(function (k) { return g[k]; });
    }
    function plIds(rc) { var k = 'pl:' + rc; if (F.cache[k]) return F.cache[k]; var ids = []; F.D.accList.forEach(function (a) { if (a.lvl === 1 && a.rootCode === rc) ids = ids.concat(descend(a.id)); }); return (F.cache[k] = uniq(ids)); }
    function plTotals(from, to) { var r = balance(plIds('4'), from, to), e = balance(plIds('3'), from, to); var rev = r.cr - r.dr, exp = e.dr - e.cr; return { rev: rev, exp: exp, net: rev - exp }; }
    function median(a) { if (!a.length) return 0; var s = a.slice().sort(function (x, y) { return x - y; }), h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; }
    function stdev(a) { if (a.length < 2) return 0; var m = sum(a, function (x) { return x; }) / a.length; return Math.sqrt(sum(a, function (x) { return (x - m) * (x - m); }) / (a.length - 1)); }
    function scoreOf(v, sorted) { if (!sorted.length) return 1; var i = 0; while (i < sorted.length && sorted[i] < v) i++; return Math.min(5, 1 + Math.floor(i / sorted.length * 5)); }
    function custAccName(k) { return custName(k); }
    function emptyR(msg) { return { cols: [C('m', '')], rows: [], empty: msg }; }

    /* ---------- تنفيذية ---------- */
    R.exec_scorecard = { cat: 'exec', name: 'بطاقة الأداء مقابل الفترة السابقة', desc: 'أهم 14 مؤشراً للفترة مقارنة بالفترة السابقة بنفس الطول، مع نسبة التغير', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var pr = prevRange(p.from, p.to, p.preset), rv = recvFor(p.flt), sf = mergeF(p.flt, null, ['item', 'xitem', 'st']);
        var calc = function (a, b) {
          var s = salesStats(a, b, p.flt), pl = plTotals(a, b), iv = invAgg(a, b, p.flt).filter(function (x) { return x.s > 0; });
          return { net: s.net, profit: s.profit, margin: pct(s.profit, s.net), n: s.n, avg: s.n ? s.sales / s.n : 0, cust: s.cust, qty: s.nqty, rp: pct(s.ret, s.sales),
            lines: iv.length ? sum(iv, 'lines') / iv.length : 0, coll: collections(a, b, '', false, rv), purch: s.purch - s.pret, exp: pl.exp, np: pl.net, debt: balance(rv, null, b).close, stock: stockTotals(b, null, sf).val };
        };
        var c = calc(p.from, p.to), o = calc(pr[0], pr[1]);
        var M = [['net', 'صافي المبيعات', 'money'], ['profit', 'مجمل الربح', 'money'], ['margin', 'هامش الربح %', 'pct'], ['n', 'عدد فواتير المبيع', 'int'], ['avg', 'متوسط قيمة الفاتورة', 'money'],
          ['lines', 'متوسط الأصناف في الفاتورة', 'qty'], ['cust', 'العملاء المشترون', 'int'], ['qty', 'صافي الكمية المباعة', 'qty'], ['rp', 'نسبة المرتجعات %', 'pct'], ['coll', 'التحصيل', 'money'],
          ['purch', 'صافي المشتريات', 'money'], ['exp', 'المصروفات (حسابات 3)', 'money'], ['np', 'صافي الربح (الإيرادات − المصروفات)', 'money'], ['debt', 'المديونية آخر الفترة', 'money'], ['stock', 'المخزون آخر الفترة', 'money']];
        var rows = M.map(function (m) { var d = c[m[0]] - o[m[0]]; return { name: m[1], cur: c[m[0]], prev: o[m[0]], ch: d, chp: m[2] === 'pct' ? null : (o[m[0]] ? d / Math.abs(o[m[0]]) * 100 : null), _fmt: m[2] === 'pct' ? 'pct' : m[2] === 'int' ? 'int' : m[2] === 'qty' ? 'qty' : undefined }; });
        rows.forEach(function (r) { if (r.chp === null) r.chp = ''; });
        return withNote({ cols: [C('name', 'المؤشر'), C('cur', 'الفترة الحالية', 'money'), C('prev', 'الفترة السابقة', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct')], rows: rows,
          note: 'الفترة السابقة: ' + pr[0] + ' إلى ' + pr[1] }, p);
      } };
    R.exec_pl_month = { cat: 'exec', name: 'الأرباح والخسائر الشهرية المختصرة', desc: 'لكل شهر: صافي المبيعات ومجمل الربح والإيرادات والمصروفات وصافي الربح وهامشه', params: ['period'],
      run: function (p) {
        var rows = monthsOf(p).map(function (x) { var s = salesStats(x.a, x.b), pl = plTotals(x.a, x.b); return { name: x.label, net: s.net, gp: s.profit, rev: pl.rev, exp: pl.exp, np: pl.net, npm: pct(pl.net, pl.rev) }; });
        var cols = [C('name', 'الشهر'), C('net', 'صافي المبيعات', 'money'), C('gp', 'مجمل الربح', 'money'), C('rev', 'الإيرادات (حسابات 4)', 'money'), C('exp', 'المصروفات (حسابات 3)', 'money'), C('np', 'صافي الربح', 'money'), C('npm', 'هامش صافي الربح', 'pct')];
        var t = sumRow(rows, cols); t.npm = pct(t.np, t.rev);
        return { cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['rev', 'exp', 'np'], yl: ['الإيرادات', 'المصروفات', 'صافي الربح'] } };
      } };
    R.exec_cash = { cat: 'exec', name: 'الموقف النقدي الشهري', desc: 'رصيد الصناديق والبنوك أول كل شهر والداخل والخارج ورصيد آخر الشهر', params: ['period', 'boxkind'],
      run: function (p) {
        var ids = boxIds(p.boxkind === 'all' ? '' : p.boxkind);
        if (!ids.length) return emptyR('عرّف الصناديق والبنوك أولاً من الإعدادات ← الصناديق والبنوك');
        var rows = monthsOf(p).map(function (x) { var b = balance(ids, x.a, x.b); return { name: x.label, open: b.open, inn: b.dr, out: b.cr, net: b.dr - b.cr, close: b.close }; });
        var cols = [C('name', 'الشهر'), C('open', 'رصيد أول الشهر', 'money'), C('inn', 'الداخل', 'money'), C('out', 'الخارج', 'money'), C('net', 'صافي الحركة', 'money'), C('close', 'رصيد آخر الشهر', 'money')];
        var t = { name: 'الإجمالي', inn: sum(rows, 'inn'), out: sum(rows, 'out'), net: sum(rows, 'net'), open: rows.length ? rows[0].open : 0, close: rows.length ? rows[rows.length - 1].close : 0 };
        return { cols: cols, rows: rows, total: t, chart: { type: 'line', x: 'name', y: ['close'], yl: ['الرصيد آخر الشهر'] } };
      } };
    R.exec_top = { cat: 'exec', name: 'الأعلى في كل شيء', desc: 'أعلى العملاء والأصناف ربحاً وقيمةً، وأعلى المناديب والمخازن، في صفحة واحدة', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var rows = [], add = function (title, list, k, n) {
          var tot = sum(list, k); rows.push({ name: title, _b: true, _hl: true });
          list.sort(function (a, b) { return b[k] - a[k]; }).slice(0, n || 10).forEach(function (r, i) { rows.push({ rank: i + 1, name: r.name, v: r[k], share: pct(r[k], tot), net: r.net, profit: r.profit }); });
        };
        add('أعلى العملاء مبيعاً', salesBy(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }), 'net');
        add('أعلى الأصناف مبيعاً', salesBy(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }), 'net');
        add('أكثر الأصناف ربحاً', salesBy(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }), 'profit');
        add('أكثر العملاء ربحاً', salesBy(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }), 'profit');
        add('المناديب', salesBy(p, function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag); }), 'net', 5);
        add('المخازن', salesBy(p, function (x) { return x.l.st; }, function (x) { return storeName(x.l.st); }), 'net', 5);
        return withNote({ cols: [C('rank', '#', 'int'), C('name', 'الاسم'), C('v', 'القيمة', 'money'), C('share', 'الحصة من القسم', 'pct'), C('net', 'صافي المبيعات', 'money'), C('profit', 'مجمل الربح', 'money')], rows: rows }, p);
      } };

    /* ---------- محاسبية ---------- */
    R.acct_unbalanced = { cat: 'acct', name: 'فحص توازن القيود', desc: 'القيود التي لا يتساوى مدينها ودائنها، أو فيها طرف واحد فقط', params: ['period'],
      run: function (p) {
        var rows = [];
        entriesIn(p.from, p.to).forEach(function (l0) {
          var ls = F.D.byEntry[l0.e], dr = sum(ls, 'dr'), cr = sum(ls, 'cr');
          if (Math.abs(dr - cr) > 0.005 || ls.length < 2) rows.push({ d: l0.d, no: l0.no, type: l0.btn, desc: l0.ed || '', n: ls.length, dr: dr, cr: cr, diff: dr - cr, _acc: ls[0].a });
        });
        rows.sort(function (a, b) { return Math.abs(b.diff) - Math.abs(a.diff); });
        var res = { cols: [C('d', 'التاريخ'), C('no', 'رقم القيد'), C('type', 'النوع'), C('desc', 'البيان'), C('n', 'عدد الأسطر', 'int'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money'), C('diff', 'الفرق', 'money')], rows: rows };
        if (!rows.length) res.empty = 'كل القيود في هذه الفترة متوازنة ✓';
        return res;
      } };
    R.acct_large = { cat: 'acct', name: 'القيود الكبيرة', desc: 'القيود التي يتجاوز مبلغها حداً تختاره، حسب النوع، للمراجعة والتدقيق', params: ['period', 'etype'],
      sel: [['min', 'المبلغ من', [[10000, '10,000'], [1000, '1,000'], [5000, '5,000'], [50000, '50,000'], [100000, '100,000'], [500000, '500,000']]]],
      run: function (p) {
        var min = Number(p.min) || 10000, et = p.etype || 'all', rows = [];
        entriesIn(p.from, p.to, function (l) { return et === 'all' || l.k === et; }).forEach(function (l0) {
          var ls = F.D.byEntry[l0.e], amt = entryTotal(ls);
          if (amt >= min) rows.push({ d: l0.d, no: l0.no, type: l0.btn, desc: l0.ed || ls.map(function (x) { return x.ld; }).filter(String)[0] || '', accs: uniq(ls.map(function (x) { return accName(x.a); })).slice(0, 3).join('، '), n: ls.length, v: amt, user: userName(l0.u) });
        });
        rows.sort(function (a, b) { return b.v - a.v; });
        var cols = [C('d', 'التاريخ'), C('no', 'رقم القيد'), C('type', 'النوع'), C('desc', 'البيان'), C('accs', 'الحسابات'), C('n', 'الأسطر', 'int'), C('v', 'المبلغ', 'money'), C('user', 'المستخدم')];
        return { cols: cols, rows: rows, total: { d: 'الإجمالي (' + rows.length + ' قيد)', v: sum(rows, 'v') } };
      } };
    R.acct_change = { cat: 'acct', name: 'أكبر التغيرات في أرصدة الحسابات', desc: 'رصيد كل حساب أول الفترة وآخرها والتغير، مرتبة من الأكبر تغيراً', params: ['period', 'top'],
      run: function (p) {
        var rows = [];
        F.D.accList.forEach(function (a) {
          if (!a.leaf || !F.D.byAcc[a.id]) return;
          var b = balance([a.id], p.from, p.to);
          if (Math.abs(b.dr) + Math.abs(b.cr) < 0.0005) return;
          rows.push({ code: a.code, name: a.name, open: b.open, dr: b.dr, cr: b.cr, close: b.close, ch: b.close - b.open, chp: b.open ? (b.close - b.open) / Math.abs(b.open) * 100 : '', _acc: a.id });
        });
        rows.sort(function (x, y) { return Math.abs(y.ch) - Math.abs(x.ch); });
        var cols = [C('code', 'الرمز'), C('name', 'الحساب'), C('open', 'أول الفترة', 'money'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money'), C('close', 'آخر الفترة', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct')];
        return topN({ cols: cols, rows: rows, chart: { type: 'hbar', x: 'name', y: ['ch'], yl: ['التغير'], limit: 15 } }, p);
      } };
    R.acct_idle = { cat: 'acct', name: 'حسابات بأرصدة دون حركة', desc: 'الحسابات التي عليها رصيد ولم تتحرك منذ مدة تختارها', params: ['asof', 'idle'],
      run: function (p) {
        var rows = [], lim = Number(p.idle) || 30;
        F.D.accList.forEach(function (a) {
          if (!a.leaf || !F.D.byAcc[a.id]) return;
          var b = balance([a.id], null, p.asof);
          if (Math.abs(b.close) < 0.005 || !b.last) return;
          var dd = days(b.last, p.asof);
          if (dd >= lim) rows.push({ code: a.code, name: a.name, bal: b.close, last: b.last, days: dd, _acc: a.id });
        });
        rows.sort(function (x, y) { return y.days - x.days || Math.abs(y.bal) - Math.abs(x.bal); });
        return { cols: [C('code', 'الرمز'), C('name', 'الحساب'), C('bal', 'الرصيد', 'money'), C('last', 'آخر حركة'), C('days', 'أيام بلا حركة', 'int')], rows: rows, total: { code: 'الإجمالي', bal: sum(rows, 'bal') } };
      } };
    R.acct_counter = { cat: 'acct', name: 'الحسابات المقابلة لحساب', desc: 'مع أي الحسابات يتعامل حساب معيّن، وكم مديناً ودائناً مع كل منها', params: ['period', 'account'],
      run: function (p) {
        if (!p.account) return emptyR('اختر الحساب من الأعلى');
        var a = acc(p.account), res = runPair({ kind: 'pair', a: [a.code], b: [], view: 'cp' }, p);
        res.subtitle = 'الحسابات المقابلة لـ ' + a.name; return res;
      } };
    R.acct_users = { cat: 'acct', name: 'القيود حسب المستخدم ونوعها', desc: 'كم قيداً أدخل كل مستخدم من كل نوع وبأي مبالغ', params: ['period'],
      run: function (p) {
        var g = {}, types = {};
        entriesIn(p.from, p.to).forEach(function (l0) {
          var u = userName(l0.u), r = g[u] || (g[u] = { name: u, n: 0, v: 0 }), t = l0.btn;
          r.n++; r.v += entryTotal(F.D.byEntry[l0.e]); r['t_' + t] = (r['t_' + t] || 0) + 1; types[t] = (types[t] || 0) + 1;
        });
        var tk = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, 8);
        var rows = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.n - a.n; });
        var cols = [C('name', 'المستخدم'), C('n', 'عدد القيود', 'int'), C('v', 'المبالغ', 'money')].concat(tk.map(function (t) { return C('t_' + t, t, 'int'); }));
        return { cols: cols, rows: rows, total: sumRow(rows, cols), chart: { type: 'hbar', x: 'name', y: ['n'], yl: ['عدد القيود'] } };
      } };

    /* ---------- المبيعات ---------- */
    R.sales_basket = { cat: 'sales', name: 'متوسط الفاتورة وحجم السلة', desc: 'لكل شهر: عدد الفواتير ومتوسط قيمتها وعدد أصنافها وكميتها، وفواتير كل عميل', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var rows = monthsOf(p).map(function (x) {
          var iv = invAgg(x.a, x.b, p.flt).filter(function (r) { return r.s > 0; }), n = iv.length, cust = uniq(iv.map(function (r) { return r.v.ck; })).length, val = sum(iv, 'val');
          return { name: x.label, n: n, val: val, avg: n ? val / n : 0, med: median(iv.map(function (r) { return r.val; })), lines: n ? sum(iv, 'lines') / n : 0, qty: n ? sum(iv, 'qty') / n : 0, cust: cust, ipc: cust ? n / cust : 0 };
        });
        var cols = [C('name', 'الشهر'), C('n', 'فواتير المبيع', 'int'), C('val', 'قيمة المبيع', 'money'), C('avg', 'متوسط الفاتورة', 'money'), C('med', 'الوسيط', 'money'), C('lines', 'أصناف/فاتورة', 'qty'), C('qty', 'كمية/فاتورة', 'qty'), C('cust', 'العملاء', 'int'), C('ipc', 'فواتير/عميل', 'qty')];
        var all = invAgg(p.from, p.to, p.flt).filter(function (r) { return r.s > 0; }), n = all.length, nc = uniq(all.map(function (r) { return r.v.ck; })).length;
        var t = { name: 'الفترة كاملة', n: n, val: sum(all, 'val'), avg: n ? sum(all, 'val') / n : 0, med: median(all.map(function (r) { return r.val; })), lines: n ? sum(all, 'lines') / n : 0, qty: n ? sum(all, 'qty') / n : 0, cust: nc, ipc: nc ? n / nc : 0 };
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['avg'], yl: ['متوسط الفاتورة'] } }, p);
      } };
    R.sales_hour = { cat: 'sales', name: 'المبيعات حسب ساعة اليوم', desc: 'في أي ساعات تُسجَّل فواتير المبيع أكثر', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var g = {};
        invAgg(p.from, p.to, p.flt).forEach(function (r) { var h = Number(String(r.v.dt || '').slice(11, 13)); if (isNaN(h)) return; var o = g[h] || (g[h] = { h: h, n: 0, net: 0 }); if (r.s > 0) o.n++; o.net += r.s * r.val; });
        var rows = Object.keys(g).map(function (k) { var o = g[k]; o.name = ('0' + o.h).slice(-2) + ':00 - ' + ('0' + o.h).slice(-2) + ':59'; return o; }).sort(function (a, b) { return a.h - b.h; });
        var tot = sum(rows, 'net'); rows.forEach(function (r) { r.share = pct(r.net, tot); r.avg = r.n ? r.net / r.n : 0; });
        var cols = [C('name', 'الساعة'), C('n', 'فواتير المبيع', 'int'), C('net', 'صافي المبيعات', 'money'), C('avg', 'متوسط الفاتورة', 'money'), C('share', 'الحصة', 'pct')];
        return withNote({ cols: cols, rows: rows, total: sumRow(rows, cols), chart: { type: 'bar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] } }, p);
      } };
    R.sales_reps_card = { cat: 'sales', name: 'بطاقة أداء المناديب', desc: 'لكل مندوب: المبيعات والربح والهامش والفواتير والعملاء والأصناف ومتوسط الفاتورة والمرتجعات', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          var k = x.v.ag || '0', r = g[k] || (g[k] = { name: repName(x.v.ag), sales: 0, ret: 0, profit: 0, inv: {}, cust: {}, items: {}, qty: 0 });
          if (x.s > 0) { r.sales += x.val; r.inv[x.v.id] = 1; r.cust[x.v.ck] = 1; r.items[x.l.item] = 1; } else r.ret += x.val;
          r.profit += x.s * x.profit; r.qty += x.s * x.qty;
        });
        var rows = Object.keys(g).map(function (k) { var r = g[k], n = Object.keys(r.inv).length; return { name: r.name, net: r.sales - r.ret, profit: r.profit, margin: pct(r.profit, r.sales - r.ret), n: n, cust: Object.keys(r.cust).length, items: Object.keys(r.items).length, avg: n ? r.sales / n : 0, qty: r.qty, rp: pct(r.ret, r.sales) }; });
        var tot = sum(rows, 'net'); rows.forEach(function (r) { r.share = pct(r.net, tot); });
        rows.sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'المندوب'), C('net', 'صافي المبيعات', 'money'), C('share', 'الحصة', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('n', 'الفواتير', 'int'), C('cust', 'العملاء', 'int'), C('items', 'الأصناف', 'int'), C('avg', 'متوسط الفاتورة', 'money'), C('qty', 'الكمية', 'qty'), C('rp', 'المرتجعات %', 'pct')];
        var t = sumRow(rows, cols); t.margin = pct(t.profit, t.net); t.share = 100;
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] } }, p);
      } };
    R.sales_low_margin = { cat: 'sales', name: 'المبيعات بهامش منخفض أو بخسارة', desc: 'أسطر المبيع التي ربحها أقل من نسبة تختارها، لاكتشاف البيع تحت التكلفة', params: ['period', 'flt'], fdims: SALE_F,
      sel: [['thr', 'الهامش أقل من', [[5, '5%'], [0, '0% (بخسارة)'], [10, '10%'], [15, '15%'], [20, '20%']]]],
      run: function (p) {
        var thr = Number(p.thr), rows = [];
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          if (x.s < 0 || !x.cost || !x.val) return;
          var m = pct(x.profit, x.val);
          if (m < thr) rows.push({ d: x.d, no: x.v.no, cust: x.v.name, item: itemName(x.l.item), qty: x.qty, price: x.l.p, val: x.val, cost: x.cost, profit: x.profit, margin: m });
        });
        rows.sort(function (a, b) { return a.margin - b.margin; });
        var cols = [C('d', 'التاريخ'), C('no', 'الفاتورة'), C('cust', 'العميل'), C('item', 'الصنف'), C('qty', 'الكمية', 'qty'), C('price', 'السعر', 'money'), C('val', 'القيمة', 'money'), C('cost', 'التكلفة', 'money'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct')];
        var t = sumRow(rows, cols); t.d = 'الإجمالي (' + rows.length + ' سطر)'; t.margin = pct(t.profit, t.val);
        var res = withNote({ cols: cols, rows: rows, total: t }, p);
        if (!rows.length) res.empty = 'لا توجد مبيعات بهامش أقل من ' + thr + '% في هذه الفترة ✓';
        return res;
      } };
    R.sales_type = { cat: 'sales', name: 'المبيعات حسب نوع الفاتورة', desc: 'توزيع المبيعات على أنواع فواتير المبيع المعرّفة في سراج', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) { return salesTable(p, 'نوع الفاتورة', function (x) { return x.v.t || '0'; }, function (x) { return (T().it[x.v.t] || {}).name || 'بدون'; }); } };
    R.sales_mom = { cat: 'sales', name: 'نمو المبيعات شهراً بشهر', desc: 'صافي المبيعات والربح لكل شهر، والتغير عن الشهر السابق، والتراكمي، ومتوسط اليوم', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var prev = null, cum = 0;
        var rows = monthsOf(p).map(function (x) {
          var s = salesStats(x.a, x.b, p.flt); cum += s.net;
          var r = { name: x.label, net: s.net, ch: prev === null ? '' : s.net - prev, chp: prev ? (s.net - prev) / Math.abs(prev) * 100 : '', profit: s.profit, margin: pct(s.profit, s.net), cum: cum, daily: s.net / (days(x.a, x.b) + 1) };
          prev = s.net; return r;
        });
        var cols = [C('name', 'الشهر'), C('net', 'صافي المبيعات', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('cum', 'التراكمي', 'money'), C('daily', 'متوسط اليوم', 'money')];
        var t = { name: 'الإجمالي', net: cum, profit: sum(rows, 'profit') }; t.margin = pct(t.profit, t.net);
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'line', x: 'name', y: ['net', 'profit'], yl: ['صافي المبيعات', 'مجمل الربح'] } }, p);
      } };

    /* ---------- العملاء ---------- */
    function custStats(p) {
      var g = {};
      invAgg(p.from, p.to, p.flt).forEach(function (r) {
        var k = r.v.ck, o = g[k] || (g[k] = { k: k, name: r.v.name, n: 0, net: 0, profit: 0, first: r.v.d, last: '', dates: {} });
        if (r.s > 0) { o.n++; o.dates[r.v.d] = 1; if (r.v.d > o.last) o.last = r.v.d; if (r.v.d < o.first) o.first = r.v.d; }
        o.net += r.s * r.val; o.profit += r.s * r.profit;
      });
      return Object.keys(g).map(function (k) { return g[k]; }).filter(function (o) { return o.n > 0; });
    }
    R.cust_rfm = { cat: 'cust', name: 'تصنيف العملاء (RFM)', desc: 'كل عميل حسب حداثة آخر شراء وتكراره وقيمته: أبطال، مخلصون، واعدون، معرّضون للفقد، خاملون', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var list = custStats(p);
        if (!list.length) return emptyR('لا توجد مبيعات في هذه الفترة');
        list.forEach(function (o) { o.rec = days(o.last, p.to); });
        var R_ = list.map(function (o) { return -o.rec; }).sort(function (a, b) { return a - b; }), F_ = list.map(function (o) { return o.n; }).sort(function (a, b) { return a - b; }), M_ = list.map(function (o) { return o.net; }).sort(function (a, b) { return a - b; });
        var seg = function (r, f, m) { return r >= 4 && f >= 4 ? 'أبطال' : f >= 4 ? 'مخلصون' : r >= 4 && f <= 2 ? 'جدد وواعدون' : r === 3 ? 'يحتاجون انتباهاً' : r <= 2 && (f >= 3 || m >= 4) ? 'معرّضون للفقد' : 'خاملون'; };
        list.forEach(function (o) { o.r = scoreOf(-o.rec, R_); o.f = scoreOf(o.n, F_); o.m = scoreOf(o.net, M_); o.score = '' + o.r + o.f + o.m; o.seg = seg(o.r, o.f, o.m); });
        var order = ['أبطال', 'مخلصون', 'جدد وواعدون', 'يحتاجون انتباهاً', 'معرّضون للفقد', 'خاملون'];
        list.sort(function (a, b) { return order.indexOf(a.seg) - order.indexOf(b.seg) || b.net - a.net; });
        var rows = list.map(function (o) { return { name: o.name, seg: o.seg, rec: o.rec, n: o.n, net: o.net, last: o.last, score: o.score, _acc: acc(o.k) ? o.k : null }; });
        var cols = [C('name', 'العميل'), C('seg', 'التصنيف'), C('rec', 'أيام منذ آخر شراء', 'int'), C('n', 'عدد الفواتير', 'int'), C('net', 'صافي المشتريات', 'money'), C('last', 'آخر شراء'), C('score', 'R-F-M')];
        var bySeg = order.map(function (s) { var x = list.filter(function (o) { return o.seg === s; }); return { name: s, v: x.length, net: sum(x, 'net') }; }).filter(function (x) { return x.v; });
        return withNote({ cols: cols, rows: rows, total: { name: 'الإجمالي (' + list.length + ' عميل)', n: sum(list, 'n'), net: sum(list, 'net') }, chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المشتريات حسب التصنيف'], rowsOverride: bySeg },
          note: 'كل مقياس من 1 إلى 5 مقارنة ببقية العملاء. التصنيفات: ' + bySeg.map(function (x) { return x.name + ' ' + x.v; }).join('، ') }, p);
      } };
    R.cust_abc = { cat: 'cust', name: 'تحليل ABC للعملاء (باريتو)', desc: 'ترتيب العملاء بالحصة التراكمية: فئة A تصنع 80% من المبيعات، B حتى 95%، والباقي C', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) { return abcTable(salesBy(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }), 'العميل', 'net', p); } };
    function abcTable(list, label, k, p) {
      list = list.filter(function (r) { return r[k] > 0; }).sort(function (a, b) { return b[k] - a[k]; });
      var tot = sum(list, k), cum = 0, cnt = { A: 0, B: 0, C: 0 }, val = { A: 0, B: 0, C: 0 };
      list.forEach(function (r, i) { var before = cum; cum += r[k]; r.rank = i + 1; r.share = pct(r[k], tot); r.cum = pct(cum, tot); r.cls = pct(before, tot) < 80 ? 'A' : pct(before, tot) < 95 ? 'B' : 'C'; cnt[r.cls]++; val[r.cls] += r[k]; r._hl = r.cls === 'A'; });
      var cols = [C('rank', '#', 'int'), C('name', label), C(k, k === 'qty' ? 'الكمية' : 'صافي المبيعات', k === 'qty' ? 'qty' : 'money'), C('profit', 'مجمل الربح', 'money'), C('share', 'الحصة', 'pct'), C('cum', 'الحصة التراكمية', 'pct'), C('cls', 'الفئة')];
      var t = sumRow(list, cols); t.rank = ''; t.name = 'الإجمالي (' + list.length + ')';
      return withNote({ cols: cols, rows: list, total: t, chart: { type: 'line', x: 'name', y: ['cum'], yl: ['الحصة التراكمية %'] },
        note: ['A', 'B', 'C'].map(function (c) { return 'الفئة ' + c + ': ' + cnt[c] + ' (' + fp(pct(cnt[c], list.length)) + ' من العدد، ' + fp(pct(val[c], tot)) + ' من القيمة)'; }).join(' · ') }, p);
    }
    R.cust_freq = { cat: 'cust', name: 'تكرار الشراء لكل عميل', desc: 'عدد مرات الشراء وأيامه، ومتوسط الأيام بين كل شراء والذي يليه، وآخر شراء، ومتوسط الفاتورة', params: ['period', 'top', 'flt'], fdims: SALE_F,
      run: function (p) {
        var rows = custStats(p).map(function (o) {
          var ds = Object.keys(o.dates).sort(), gap = ds.length > 1 ? days(ds[0], ds[ds.length - 1]) / (ds.length - 1) : '';
          return { name: o.name, n: o.n, dd: ds.length, gap: gap, first: o.first, last: o.last, since: days(o.last, p.to), net: o.net, avg: o.n ? o.net / o.n : 0, _acc: acc(o.k) ? o.k : null };
        }).sort(function (a, b) { return b.n - a.n || b.net - a.net; });
        var cols = [C('name', 'العميل'), C('n', 'الفواتير', 'int'), C('dd', 'أيام الشراء', 'int'), C('gap', 'متوسط الأيام بين الشراءات', 'qty'), C('first', 'أول شراء'), C('last', 'آخر شراء'), C('since', 'منذ آخر شراء (يوم)', 'int'), C('net', 'صافي المشتريات', 'money'), C('avg', 'متوسط الفاتورة', 'money')];
        return withNote(topN({ cols: cols, rows: rows, total: { name: 'الإجمالي', n: sum(rows, 'n'), net: sum(rows, 'net') } }, p), p);
      } };
    R.cust_base = { cat: 'cust', name: 'حركة قاعدة العملاء شهرياً', desc: 'لكل شهر: العملاء النشطون والجدد والعائدون والمتوقفون عن الشهر السابق', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var first = {};
        F.D.invs.forEach(function (v) { if (v.c === SALE && invPass(v, parseFilter(p.flt)) && (!first[v.ck] || v.d < first[v.ck])) first[v.ck] = v.d; });
        var prevSet = null, rows = monthsOf(p).map(function (x) {
          var set = {}; invAgg(x.a, x.b, p.flt).forEach(function (r) { if (r.s > 0) set[r.v.ck] = 1; });
          var ks = Object.keys(set), nw = ks.filter(function (k) { return first[k] >= x.a && first[k] <= x.b; }).length;
          var ret = prevSet ? ks.filter(function (k) { return prevSet[k]; }).length : '', lost = prevSet ? Object.keys(prevSet).filter(function (k) { return !set[k]; }).length : '';
          var r = { name: x.label, act: ks.length, nw: nw, ret: ret, back: prevSet ? ks.length - nw - ret : '', lost: lost, keep: prevSet && Object.keys(prevSet).length ? pct(ret, Object.keys(prevSet).length) : '' };
          prevSet = set; return r;
        });
        var cols = [C('name', 'الشهر'), C('act', 'نشطون', 'int'), C('nw', 'جدد', 'int'), C('ret', 'استمروا من الشهر السابق', 'int'), C('back', 'عادوا بعد انقطاع', 'int'), C('lost', 'توقفوا', 'int'), C('keep', 'نسبة الاستمرار', 'pct')];
        return withNote({ cols: cols, rows: rows, chart: { type: 'bar', x: 'name', y: ['act', 'nw', 'lost'], yl: ['نشطون', 'جدد', 'توقفوا'] } }, p);
      } };
    R.cust_cohort = { cat: 'cust', name: 'احتفاظ العملاء (مجموعات الشهر الأول)', desc: 'العملاء حسب شهر أول شراء، وكم منهم اشترى في كل شهر بعده (نسبة الاحتفاظ)', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var first = {}, active = {}, f = parseFilter(p.flt);
        F.D.invs.forEach(function (v) { if (v.c !== SALE || !invPass(v, f) || v.d > p.to) return; var m = v.d.slice(0, 7); if (!first[v.ck] || m < first[v.ck]) first[v.ck] = m; (active[v.ck] = active[v.ck] || {})[m] = 1; });
        var months = monthsOf(p).map(function (x) { return x.m; }), maxK = 0, rows = [];
        months.forEach(function (m, i) {
          var coh = Object.keys(first).filter(function (k) { return first[k] === m; });
          if (!coh.length) return;
          var r = { name: monthLabel(m), n: coh.length };
          for (var k = 1; i + k < months.length; k++) { var mm = months[i + k]; r['m' + k] = pct(coh.filter(function (c) { return active[c][mm]; }).length, coh.length); if (k > maxK) maxK = k; }
          rows.push(r);
        });
        var cols = [C('name', 'شهر أول شراء'), C('n', 'عملاء المجموعة', 'int')];
        for (var k = 1; k <= Math.min(maxK, 12); k++) cols.push(C('m' + k, 'بعد ' + k + (k === 1 ? ' شهر' : ' أشهر'), 'pct'));
        var res = withNote({ cols: cols, rows: rows }, p);
        if (!rows.length) res.empty = 'لا يوجد عملاء جدد في هذه الفترة';
        return res;
      } };

    /* ---------- الأصناف ---------- */
    var ITEM_F = ['item', 'st', 'cust', 'ag', 'xitem', 'xcust'];
    function itemsBy(p) { var l = salesBy(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }); l.forEach(function (r) { r.unit = (T().item[r.k] || {}).mu || ''; }); return l; }
    R.item_abc = { cat: 'items', name: 'تحليل ABC للأصناف', desc: 'الأصناف التي تصنع 80% من المبيعات (A) ثم حتى 95% (B) والباقي (C)، بالقيمة أو بالكمية', params: ['period', 'measure', 'flt'], fdims: ITEM_F,
      run: function (p) { return abcTable(itemsBy(p), 'الصنف', p.measure === 'qty' ? 'qty' : 'net', p); } };
    R.item_profit = { cat: 'items', name: 'ربحية الأصناف وترتيبها', desc: 'القيمة والتكلفة والربح والهامش وربح الوحدة وحصة كل صنف من الربح الكلي', params: ['period', 'top', 'flt'], fdims: ITEM_F,
      run: function (p) {
        var list = itemsBy(p), tp = sum(list, 'profit');
        list.forEach(function (r) { r.pshare = pct(r.profit, tp); r.ppu = r.qty ? r.profit / r.qty : 0; });
        list.sort(function (a, b) { return b.profit - a.profit; }); list.forEach(function (r, i) { r.rank = i + 1; });
        var cols = [C('rank', '#', 'int'), C('name', 'الصنف'), C('qty', 'الكمية', 'qty'), C('unit', 'الوحدة'), C('net', 'صافي المبيعات', 'money'), C('cost', 'التكلفة', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('ppu', 'ربح الوحدة', 'money'), C('pshare', 'من الربح الكلي', 'pct')];
        var t = sumRow(list, cols); t.rank = ''; t.margin = pct(t.profit, t.net); t.pshare = 100;
        return withNote(topN({ cols: cols, rows: list, total: t, chart: { type: 'hbar', x: 'name', y: ['profit'], yl: ['مجمل الربح'], limit: 12 } }, p), p);
      } };
    R.item_reach = { cat: 'items', name: 'انتشار الأصناف بين العملاء', desc: 'كم عميلاً يشتري كل صنف، ونسبة انتشاره بين العملاء النشطين، ومتوسط الكمية في الفاتورة', params: ['period', 'top', 'flt'], fdims: ITEM_F,
      run: function (p) {
        var g = {}, allC = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          if (x.s < 0) return; allC[x.v.ck] = 1;
          var r = g[x.l.item] || (g[x.l.item] = { name: itemName(x.l.item), cust: {}, inv: {}, qty: 0, val: 0 });
          r.cust[x.v.ck] = 1; r.inv[x.v.id] = 1; r.qty += x.qty; r.val += x.val;
        });
        var nc = Object.keys(allC).length;
        var rows = Object.keys(g).map(function (k) { var r = g[k], c = Object.keys(r.cust).length, n = Object.keys(r.inv).length; return { name: r.name, c: c, pen: pct(c, nc), n: n, qpi: n ? r.qty / n : 0, val: r.val, unit: (T().item[k] || {}).mu || '' }; })
          .sort(function (a, b) { return b.c - a.c; });
        var cols = [C('name', 'الصنف'), C('c', 'عدد العملاء', 'int'), C('pen', 'الانتشار', 'pct'), C('n', 'الفواتير', 'int'), C('qpi', 'متوسط الكمية/فاتورة', 'qty'), C('unit', 'الوحدة'), C('val', 'قيمة المبيع', 'money')];
        return withNote(topN({ cols: cols, rows: rows, note: 'العملاء النشطون في الفترة: ' + nc, chart: { type: 'hbar', x: 'name', y: ['pen'], yl: ['الانتشار %'], limit: 15 } }, p), p);
      } };
    R.item_pairs = { cat: 'items', name: 'الأصناف التي تُباع معاً', desc: 'أكثر أزواج الأصناف ظهوراً في نفس الفاتورة، مع نسبة الثقة وقوة الارتباط (Lift)', params: ['period', 'top', 'flt'], fdims: ['cust', 'ag', 'st', 'xcust'],
      run: function (p) {
        var inv = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { if (x.s > 0) (inv[x.v.id] = inv[x.v.id] || {})[x.l.item] = 1; });
        var ids = Object.keys(inv), N0 = ids.length, one = {}, two = {};
        ids.forEach(function (i) {
          var its = Object.keys(inv[i]).sort();
          its.forEach(function (a) { one[a] = (one[a] || 0) + 1; });
          if (its.length > 40) return;
          for (var x = 0; x < its.length; x++) for (var y = x + 1; y < its.length; y++) { var k = its[x] + '|' + its[y]; two[k] = (two[k] || 0) + 1; }
        });
        var rows = Object.keys(two).filter(function (k) { return two[k] >= 2; }).map(function (k) {
          var ab = k.split('|'), n = two[k], ca = n / one[ab[0]], cb = n / one[ab[1]];
          return { a: itemName(ab[0]), b: itemName(ab[1]), n: n, sup: pct(n, N0), conf: Math.max(ca, cb) * 100, lift: N0 ? n * N0 / (one[ab[0]] * one[ab[1]]) : 0 };
        }).sort(function (x, y) { return y.n - x.n || y.lift - x.lift; });
        if (!p.top || Number(p.top) === 0) rows = rows.slice(0, 100);
        var res = topN({ cols: [C('a', 'الصنف الأول'), C('b', 'الصنف الثاني'), C('n', 'فواتير فيها الاثنان', 'int'), C('sup', 'من كل الفواتير', 'pct'), C('conf', 'الثقة', 'pct'), C('lift', 'قوة الارتباط (Lift)', 'qty')], rows: rows,
          note: 'الثقة: من الفواتير التي فيها أحد الصنفين، كم فيها الآخر. قوة الارتباط فوق 1 تعني أنهما يُشتريان معاً أكثر من الصدفة. فواتير المبيع: ' + N0 }, p);
        if (!rows.length) res.empty = 'لا توجد أزواج متكررة في هذه الفترة';
        return withNote(res, p);
      } };
    R.item_gifts = { cat: 'items', name: 'نسبة الهدايا لكل صنف', desc: 'الكمية المباعة والهدايا ونسبتها لكل صنف، لمراقبة العروض', params: ['period', 'flt'], fdims: ITEM_F,
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { var r = g[x.l.item] || (g[x.l.item] = { name: itemName(x.l.item), qb: 0, gift: 0, val: 0, n: {} }); r.qb += x.s * x.l.qb; r.gift += x.s * x.gift; r.val += x.s * x.val; if (x.gift) r.n[x.v.id] = 1; });
        var rows = Object.keys(g).map(function (k) { var r = g[k]; return { name: r.name, qb: r.qb, gift: r.gift, ratio: pct(r.gift, r.qb), n: Object.keys(r.n).length, val: r.val }; }).filter(function (r) { return r.gift; }).sort(function (a, b) { return b.ratio - a.ratio; });
        var cols = [C('name', 'الصنف'), C('qb', 'الكمية المباعة (وحدة أساسية)', 'qty'), C('gift', 'الهدايا', 'qty'), C('ratio', 'نسبة الهدايا', 'pct'), C('n', 'فواتير فيها هدايا', 'int'), C('val', 'قيمة المبيع', 'money')];
        var t = sumRow(rows, cols); t.ratio = pct(t.gift, t.qb);
        var res = withNote({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['ratio'], yl: ['نسبة الهدايا %'], limit: 15 } }, p);
        if (!rows.length) res.empty = 'لا توجد هدايا في هذه الفترة';
        return res;
      } };
    R.item_price_month = { cat: 'items', name: 'متوسط سعر البيع شهرياً', desc: 'متوسط سعر بيع الوحدة لكل صنف في كل شهر، لمتابعة تغيّر الأسعار', params: ['period', 'flt'], fdims: ITEM_F,
      run: function (p) {
        var g = {}, ms = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { if (x.s < 0 || !x.qty) return; var m = x.d.slice(0, 7), r = g[x.l.item] || (g[x.l.item] = { name: itemName(x.l.item), unit: (T().item[x.l.item] || {}).mu || '', v: {}, q: {}, tv: 0, tq: 0 }); r.v[m] = (r.v[m] || 0) + x.val; r.q[m] = (r.q[m] || 0) + x.qty; r.tv += x.val; r.tq += x.qty; ms[m] = 1; });
        var mk = Object.keys(ms).sort();
        var rows = Object.keys(g).map(function (k) { var r = g[k], o = { name: r.name, unit: r.unit, avg: r.tq ? r.tv / r.tq : 0 }; mk.forEach(function (m) { o['c_' + m] = r.q[m] ? r.v[m] / r.q[m] : ''; }); var f0 = mk.filter(function (m) { return r.q[m]; }); o.ch = f0.length > 1 ? pct(o['c_' + f0[f0.length - 1]] - o['c_' + f0[0]], o['c_' + f0[0]]) : ''; return o; })
          .sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة')].concat(mk.map(function (m) { return C('c_' + m, monthLabel(m), 'money'); })).concat([C('avg', 'متوسط الفترة', 'money'), C('ch', 'التغير من أول شهر لآخر شهر', 'pct')]);
        return withNote({ cols: cols, rows: rows }, p);
      } };
    R.item_unsold = { cat: 'items', name: 'أصناف في المخزون لم تُبع', desc: 'الأصناف التي لها رصيد في المخزون ولم يُبع منها شيء في الفترة، مع قيمتها', params: ['period'],
      run: function (p) {
        var sold = {}; facts('s', p.from, p.to).forEach(function (x) { if (x.s > 0) sold[x.l.item] = 1; });
        var b = stockAt(p.to), g = {};
        Object.keys(b).forEach(function (k) { var it = k.split('|')[1], q = b[k]; if (Math.abs(q) < 1e-9 || sold[it]) return; var r = g[it] || (g[it] = { qb: 0 }); r.qb += q; });
        var rows = Object.keys(g).filter(function (it) { return g[it].qb > 0; }).map(function (it) { var I = T().item[it] || { f: 1 }, q = g[it].qb; return { name: itemName(it), qty: q / (I.f || 1), unit: I.mu || '', val: q * costAt(it, p.to) }; }).sort(function (a, b) { return b.val - a.val; });
        var res = { cols: [C('name', 'الصنف'), C('qty', 'الكمية في المخزون', 'qty'), C('unit', 'الوحدة'), C('val', 'القيمة بمتوسط التكلفة', 'money')], rows: rows, total: { name: 'الإجمالي (' + rows.length + ' صنف)', val: sum(rows, 'val') } };
        if (!rows.length) res.empty = 'كل الأصناف التي في المخزون بيع منها شيء في هذه الفترة ✓';
        return res;
      } };

    /* ---------- تحليلية وإحصائية ---------- */
    R.an_daily_stats = { cat: 'analytics', name: 'إحصاءات المبيعات اليومية', desc: 'لكل شهر: أيام البيع، المتوسط اليومي، الوسيط، الانحراف المعياري، أعلى وأدنى يوم ومعامل التذبذب', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var rows = monthsOf(p).map(function (x) {
          var d = {}; facts('s', x.a, x.b, p.flt).forEach(function (f0) { d[f0.d] = (d[f0.d] || 0) + f0.s * f0.val; });
          var ks = Object.keys(d), v = ks.map(function (k) { return d[k]; }), mean = v.length ? sum(v, function (y) { return y; }) / v.length : 0, sd = stdev(v);
          var best = ks.reduce(function (b, k) { return b === null || d[k] > d[b] ? k : b; }, null), worst = ks.reduce(function (b, k) { return b === null || d[k] < d[b] ? k : b; }, null);
          return { name: x.label, n: ks.length, tot: sum(v, function (y) { return y; }), mean: mean, med: median(v), sd: sd, cv: mean ? sd / mean * 100 : 0, max: best ? d[best] : 0, best: best || '', min: worst ? d[worst] : 0, worst: worst || '' };
        });
        var cols = [C('name', 'الشهر'), C('n', 'أيام البيع', 'int'), C('tot', 'الإجمالي', 'money'), C('mean', 'المتوسط اليومي', 'money'), C('med', 'الوسيط', 'money'), C('sd', 'الانحراف المعياري', 'money'), C('cv', 'معامل التذبذب', 'pct'), C('max', 'أعلى يوم', 'money'), C('best', 'تاريخه'), C('min', 'أدنى يوم', 'money'), C('worst', 'تاريخه')];
        return withNote({ cols: cols, rows: rows, note: 'معامل التذبذب = الانحراف المعياري ÷ المتوسط. كلما قلّ كانت المبيعات أكثر انتظاماً.', chart: { type: 'bar', x: 'name', y: ['mean', 'med'], yl: ['المتوسط اليومي', 'الوسيط'] } }, p);
      } };
    R.an_inv_dist = { cat: 'analytics', name: 'توزيع قيم الفواتير', desc: 'كم فاتورة في كل شريحة قيمة، وكم تمثّل من العدد ومن القيمة الكلية', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var B = [[0, 500], [500, 1000], [1000, 2500], [2500, 5000], [5000, 10000], [10000, 25000], [25000, 50000], [50000, 100000], [100000, Infinity]];
        var iv = invAgg(p.from, p.to, p.flt).filter(function (r) { return r.s > 0; }), n = iv.length, tv = sum(iv, 'val');
        var rows = B.map(function (b) { var x = iv.filter(function (r) { return r.val >= b[0] && r.val < b[1]; }), v = sum(x, 'val'); return { name: fk(b[0]) + (b[1] === Infinity ? ' فأكثر' : ' − ' + fk(b[1])), n: x.length, np: pct(x.length, n), v: v, vp: pct(v, tv), avg: x.length ? v / x.length : 0 }; }).filter(function (r) { return r.n; });
        var cols = [C('name', 'شريحة قيمة الفاتورة (د.ل)'), C('n', 'عدد الفواتير', 'int'), C('np', 'من العدد', 'pct'), C('v', 'القيمة', 'money'), C('vp', 'من القيمة', 'pct'), C('avg', 'متوسط الشريحة', 'money')];
        var vals = iv.map(function (r) { return r.val; });
        return withNote({ cols: cols, rows: rows, total: { name: 'الإجمالي', n: n, np: 100, v: tv, vp: 100, avg: n ? tv / n : 0 }, chart: { type: 'bar', x: 'name', y: ['np', 'vp'], yl: ['% من العدد', '% من القيمة'] },
          note: 'الوسيط ' + fm(median(vals)) + ' · الانحراف المعياري ' + fm(stdev(vals)) + ' · أكبر فاتورة ' + fm(vals.length ? Math.max.apply(null, vals) : 0) }, p);
      } };
    R.an_forecast = { cat: 'analytics', name: 'توقع المبيعات للأشهر القادمة', desc: 'اتجاه صافي المبيعات الشهري (انحدار خطي) ومتوسط متحرك لثلاثة أشهر، وتقدير الأشهر الثلاثة القادمة', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var ms = monthsOf(p), cur = today().slice(0, 7);
        var full = ms.filter(function (x) { return x.m < cur || x.b === monthEnd(x.m); });
        if (full.length < 3) return emptyR('يحتاج التوقع ثلاثة أشهر كاملة على الأقل. اختر فترة أطول (مثل «السنة»)');
        var y = full.map(function (x) { return salesStats(x.m + '-01', monthEnd(x.m), p.flt).net; }), n = y.length, xs = y.map(function (v, i) { return i; });
        var mx = (n - 1) / 2, my = sum(y, function (v) { return v; }) / n, sxy = 0, sxx = 0;
        xs.forEach(function (x, i) { sxy += (x - mx) * (y[i] - my); sxx += (x - mx) * (x - mx); });
        var b = sxx ? sxy / sxx : 0, a = my - b * mx, ssr = 0, sst = 0;
        y.forEach(function (v, i) { ssr += Math.pow(v - (a + b * i), 2); sst += Math.pow(v - my, 2); });
        var r2 = sst ? 1 - ssr / sst : 0, rows = [];
        full.forEach(function (x, i) { rows.push({ name: x.label, act: y[i], fit: a + b * i, ma: i >= 2 ? (y[i] + y[i - 1] + y[i - 2]) / 3 : '', kind: 'فعلي' }); });
        var m = full[full.length - 1].m, ma3 = (y[n - 1] + y[n - 2] + y[n - 3]) / 3;
        for (var k = 1; k <= 3; k++) { m = addD(monthEnd(m), 1).slice(0, 7); var tr = Math.max(0, a + b * (n - 1 + k)); rows.push({ name: monthLabel(m), act: '', fit: tr, ma: ma3, fc: (tr + ma3) / 2, kind: 'تقدير', _hl: true }); }
        return withNote({ cols: [C('name', 'الشهر'), C('kind', 'النوع'), C('act', 'المبيعات الفعلية', 'money'), C('fit', 'خط الاتجاه', 'money'), C('ma', 'المتوسط المتحرك 3 أشهر', 'money'), C('fc', 'التقدير المقترح', 'money')], rows: rows,
          note: 'الاتجاه الشهري ' + (b >= 0 ? '+' : '') + fm(b) + ' د.ل في الشهر · دقة خط الاتجاه R² = ' + fq(r2) + ' (كلما اقتربت من 1 كان أدق). التقدير المقترح متوسط خط الاتجاه والمتوسط المتحرك، وهو تقدير إحصائي وليس وعداً.',
          chart: { type: 'line', x: 'name', y: ['plot', 'fit'], yl: ['الفعلي ثم التقدير', 'خط الاتجاه'], rowsOverride: rows.map(function (r) { return { name: r.name, plot: r.act === '' ? r.fc : r.act, fit: r.fit }; }) } }, p);
      } };
    R.an_dso = { cat: 'analytics', name: 'دوران المديونية ومتوسط فترة التحصيل', desc: 'لكل شهر: المبيعات والتحصيل ونسبته ومديونية آخر الشهر ومتوسط فترة التحصيل (DSO) بالأيام', params: ['period', 'flt'], fdims: ['cust', 'xcust'],
      run: function (p) {
        var rv = recvFor(p.flt);
        var rows = monthsOf(p).map(function (x) {
          var s = salesStats(x.a, x.b, p.flt), c = collections(x.a, x.b, '', false, rv), d = balance(rv, null, x.b).close, dd = days(x.a, x.b) + 1;
          return { name: x.label, net: s.net, coll: c, cr: pct(c, s.net), debt: d, dso: s.net > 0 ? d / (s.net / dd) : '', turn: d > 0 ? s.net / d : '' };
        });
        var cols = [C('name', 'الشهر'), C('net', 'صافي المبيعات', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'نسبة التحصيل للمبيعات', 'pct'), C('debt', 'المديونية آخر الشهر', 'money'), C('dso', 'متوسط فترة التحصيل (يوم)', 'qty'), C('turn', 'معدل الدوران', 'qty')];
        var t = { name: 'الإجمالي', net: sum(rows, 'net'), coll: sum(rows, 'coll') }; t.cr = pct(t.coll, t.net);
        return withNote({ cols: cols, rows: rows, total: t, note: 'متوسط فترة التحصيل = مديونية آخر الشهر ÷ متوسط المبيعات اليومية في الشهر.', chart: { type: 'line', x: 'name', y: ['dso'], yl: ['متوسط فترة التحصيل (يوم)'] } }, p);
      } };
    R.an_concentration = { cat: 'analytics', name: 'تركّز المبيعات', desc: 'حصة أعلى 1 و5 و10 و20 عميلاً وصنفاً ومندوباً من المبيعات، ومؤشر التركّز (HHI)', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var rows = [];
        [['العملاء', function (x) { return x.v.ck; }], ['الأصناف', function (x) { return x.l.item; }], ['المناديب', function (x) { return x.v.ag || '0'; }], ['المخازن', function (x) { return x.l.st; }]].forEach(function (d) {
          var l = salesBy(p, d[1], function () { return ''; }).filter(function (r) { return r.net > 0; }).sort(function (a, b) { return b.net - a.net; }), t = sum(l, 'net');
          var top = function (n) { return pct(sum(l.slice(0, n), 'net'), t); }, hhi = sum(l, function (r) { var s = r.net / t * 100; return s * s; });
          rows.push({ name: d[0], n: l.length, t1: top(1), t5: top(5), t10: top(10), t20: top(20), hhi: hhi, lvl: hhi > 2500 ? 'مرتفع' : hhi > 1500 ? 'متوسط' : 'منخفض' });
        });
        return withNote({ cols: [C('name', 'البُعد'), C('n', 'العدد', 'int'), C('t1', 'أعلى 1', 'pct'), C('t5', 'أعلى 5', 'pct'), C('t10', 'أعلى 10', 'pct'), C('t20', 'أعلى 20', 'pct'), C('hhi', 'مؤشر HHI', 'int'), C('lvl', 'درجة التركّز')], rows: rows,
          note: 'مؤشر HHI: مجموع مربعات الحصص. فوق 2500 تركّز مرتفع (اعتماد كبير على قلة)، وتحت 1500 منخفض.' }, p);
      } };
    R.an_weekday_month = { cat: 'analytics', name: 'المبيعات حسب اليوم والشهر', desc: 'جدول: صف لكل يوم من أيام الأسبوع وعمود لكل شهر، لاكتشاف الأنماط الموسمية', params: ['period', 'flt'], fdims: SALE_F,
      run: function (p) {
        var g = {}, ms = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { var w = new Date(d2t(x.d)).getUTCDay(), m = x.d.slice(0, 7), r = g[w] || (g[w] = { w: w, name: DOW[w], tot: 0 }); r['c_' + m] = (r['c_' + m] || 0) + x.s * x.val; r.tot += x.s * x.val; ms[m] = 1; });
        var mk = Object.keys(ms).sort(), order = [6, 0, 1, 2, 3, 4, 5];
        var rows = order.filter(function (w) { return g[w]; }).map(function (w) { return g[w]; });
        var cols = [C('name', 'اليوم')].concat(mk.map(function (m) { return C('c_' + m, monthLabel(m), 'money'); })).concat([C('tot', 'الإجمالي', 'money')]);
        return withNote({ cols: cols, rows: rows, total: sumRow(rows, cols), chart: { type: 'bar', x: 'name', y: ['tot'], yl: ['الإجمالي'] } }, p);
      } };

    /* ===================== تخصيص أي تقرير: بحث، شروط على الأعمدة، إخفاء أعمدة، أعلى N، وحفظ نسخة مخصصة ===================== */
    var VOPS_T = [['has', 'يحتوي'], ['nhas', 'لا يحتوي'], ['eq', 'يساوي']];
    var VOPS_N = [['gt', 'أكبر من'], ['lt', 'أصغر من'], ['ge', '≥'], ['le', '≤'], ['eqn', 'يساوي'], ['ne0', 'غير صفر']];
    function rowVal(r, k) { var v = r[k]; return v === undefined || v === null ? '' : v; }
    function vCondPass(c, r, col) {
      var v = rowVal(r, c.k);
      if (col && isNum(col)) {
        if (v === '') return c.op === 'ne0' ? false : c.op === 'lt' || c.op === 'le';
        var x = Number(v) || 0, n = Number(c.v) || 0;
        return c.op === 'gt' ? x > n : c.op === 'lt' ? x < n : c.op === 'ge' ? x >= n : c.op === 'le' ? x <= n : c.op === 'ne0' ? Math.abs(x) > 0.0005 : Math.abs(x - n) < 0.0005;
      }
      var t = normAr(plain(v)), ws = kwList(c.v);
      if (!ws.length) return true;
      if (c.op === 'eq') return ws.some(function (w) { return w === t; });
      var any = ws.some(function (w) { return t.indexOf(w) >= 0; });
      return c.op === 'nhas' ? !any : any;
    }
    function hasView(v) { return !!(v && ((v.q && v.q.trim()) || (v.rf || []).some(function (c) { return c.k && (c.v !== '' && c.v !== undefined || c.op === 'ne0'); }) || (v.hide || []).length || Number(v.lim))); }
    function applyView(res, v) {
      if (!res || res.empty || !res.cols || !hasView(v)) return res;
      var colOf = {}; res.cols.forEach(function (c) { colOf[c.k] = c; });
      var conds = (v.rf || []).filter(function (c) { return c.k && colOf[c.k] && (c.v !== '' && c.v !== undefined || c.op === 'ne0'); });
      var qs = kwList(v.q || ''), before = res.rows.length;
      var hier = res.rows.some(function (r) { return r._lvl; });
      var keep = function (r) {
        if (qs.length && !qs.every(function (w) { return res.cols.some(function (c) { return normAr(plain(rowVal(r, c.k))).indexOf(w) >= 0; }); })) return false;
        return conds.every(function (c) { return vCondPass(c, r, colOf[c.k]); });
      };
      var rows = (qs.length || conds.length) ? res.rows.filter(function (r) { return (r._b && !hier && !qs.length && !conds.length) || keep(r); }) : res.rows.slice();
      var lim = Number(v.lim) || 0;
      if (lim && rows.length > lim) rows = rows.slice(0, lim);
      var out = Object.assign({}, res, { rows: rows });
      var filtered = rows.length !== before;
      if (filtered && res.total && !hier) {
        var t = Object.assign({}, res.total);
        res.cols.forEach(function (c) { if (['money', 'money0', 'int', 'qty'].indexOf(c.t) >= 0 && typeof res.total[c.k] === 'number') t[c.k] = rows.reduce(function (s, r) { return r._b ? s : s + (Number(r[c.k]) || 0); }, 0); });
        out.total = t;
      } else if (filtered && hier) out.total = null;
      var hide = (v.hide || []).filter(function (k) { return k !== res.cols[0].k; });
      if (hide.length) out.cols = res.cols.filter(function (c) { return hide.indexOf(c.k) < 0; });
      if (filtered) out.note = (res.note ? plain(res.note) + ' · ' : '') + 'بعد التخصيص: ' + rows.length + ' من ' + before + ' سطر';
      if (out.chart && filtered && !out.chart.rowsOverride) out.chart = Object.assign({}, out.chart);
      return out;
    }
    function viewPanelHTML(res, p) {
      var v = p.view || {}, cols = (F.cur && F.cur.rawCols) || res.cols || [];
      if (!cols.length) return '';
      var n = (v.q ? 1 : 0) + (v.rf || []).filter(function (c) { return c.k; }).length + (v.hide || []).length + (Number(v.lim) ? 1 : 0);
      var open = n || (F.vpOpen);
      var copt = function (k) { return cols.map(function (c) { return '<option value="' + esc(c.k) + '"' + (c.k === k ? ' selected' : '') + '>' + esc(c.l) + '</option>'; }).join(''); };
      return '<details class="fp vp" data-vp' + (open ? ' open' : '') + '><summary class="fp-sum"><span class="fp-t">' + ICON_FILTER + ' تخصيص التقرير</span>' + (n ? '<span class="fp-cnt">' + n + ' تعديل</span>' : '<span class="small muted">بحث، شروط، أعمدة، أعلى…</span>') + '</summary><div class="vp-b">' +
        '<div class="vp-row"><input class="input" id="vq" value="' + esc(v.q || '') + '" placeholder="ابحث في نتائج هذا التقرير…" aria-label="بحث في النتائج">' +
        '<select class="input vp-lim" id="vlim" aria-label="عدد الأسطر">' + [[0, 'كل الأسطر'], [10, 'أول 10'], [20, 'أول 20'], [50, 'أول 50'], [100, 'أول 100']].map(function (o) { return '<option value="' + o[0] + '"' + (Number(v.lim || 0) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="vp-h">الشروط على الأعمدة</div><div class="vp-conds">' + (v.rf || []).map(function (c, i) {
          var col = cols.filter(function (x) { return x.k === c.k; })[0] || cols[0], num = isNum(col), ops = num ? VOPS_N : VOPS_T;
          return '<div class="vp-cond"><select class="input" data-vk="' + i + '">' + copt(col.k) + '</select><select class="input" data-vo="' + i + '">' + ops.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === c.op ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
            (c.op === 'ne0' ? '<span></span>' : '<input class="input" data-vv="' + i + '" value="' + esc(c.v === undefined ? '' : c.v) + '"' + (num ? ' type="number" inputmode="decimal"' : '') + ' placeholder="' + (num ? '0' : 'كلمة أو أكثر') + '">') +
            '<button type="button" class="iconbtn" data-vx="' + i + '" aria-label="حذف">' + ICON.close + '</button></div>';
        }).join('') + '</div><button type="button" class="btn sm" data-vadd>+ شرط</button>' +
        '<div class="vp-h">الأعمدة الظاهرة</div><div class="st-pills">' + cols.map(function (c, i) { var on = (v.hide || []).indexOf(c.k) < 0; return '<button type="button" class="pill' + (on ? ' on' : '') + '" data-vcol="' + esc(c.k) + '"' + (i ? '' : ' disabled') + '>' + (on ? '✓ ' : '') + esc(c.l) + '</button>'; }).join('') + '</div>' +
        '<div class="row vp-act">' + (n ? '<button type="button" class="btn sm ghost" data-vreset>إلغاء كل التعديلات</button>' : '') + '<span class="grow"></span>' +
        (canEdit() ? (F.cur.custom && F.cur.custom.id ? '<button type="button" class="btn sm accent" data-vsave>حفظ التغييرات في التقرير</button>' : '') + '<button type="button" class="btn sm' + (F.cur.custom && F.cur.custom.id ? ' ghost' : ' accent') + '" data-vcopy>حفظ نسخة باسم جديد</button>' : '') + '</div></div></details>';
    }
    function bindViewPanel(m, save) {
      var c = F.cur, p = c.p, v = p.view || (p.view = {}), cols = c.rawCols || [];
      var dt = q('[data-vp]', m); if (!dt) return;
      dt.addEventListener('toggle', function () { F.vpOpen = dt.open; });
      var re = function () { save(); A.render(); };
      var tq = null;
      q('#vq', m).oninput = function () { v.q = this.value; clearTimeout(tq); tq = setTimeout(function () { save(); A.render(); var i = q('#vq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 500); };
      q('#vlim', m).onchange = function () { v.lim = Number(this.value) || 0; re(); };
      q('[data-vadd]', m).onclick = function () { v.rf = v.rf || []; var nums = cols.filter(function (x) { return isNum(x); }), nc = CMP_PREF.map(function (k) { return nums.filter(function (x) { return x.k === k; })[0]; }).filter(Boolean)[0] || nums[0] || cols[0]; v.rf.push({ k: nc.k, op: isNum(nc) ? 'gt' : 'has', v: '' }); F.vpOpen = true; re(); };
      qa('[data-vk]', m).forEach(function (el) { el.onchange = function () { var cnd = v.rf[Number(el.dataset.vk)], col = cols.filter(function (x) { return x.k === el.value; })[0]; cnd.k = el.value; cnd.op = col && isNum(col) ? 'gt' : 'has'; cnd.v = ''; re(); }; });
      qa('[data-vo]', m).forEach(function (el) { el.onchange = function () { v.rf[Number(el.dataset.vo)].op = el.value; re(); }; });
      qa('[data-vv]', m).forEach(function (el) { el.onchange = function () { v.rf[Number(el.dataset.vv)].v = el.value; re(); }; el.onkeydown = function (e) { if (e.key === 'Enter') el.onchange(); }; });
      qa('[data-vx]', m).forEach(function (b) { b.onclick = function () { v.rf.splice(Number(b.dataset.vx), 1); re(); }; });
      qa('[data-vcol]', m).forEach(function (b) { b.onclick = function () { v.hide = v.hide || []; var k = b.dataset.vcol, i = v.hide.indexOf(k); if (i >= 0) v.hide.splice(i, 1); else v.hide.push(k); re(); }; });
      var rs = q('[data-vreset]', m); if (rs) rs.onclick = function () { p.view = {}; re(); };
      var defOf = function () {
        var keepP = {}; Object.keys(p).forEach(function (k) { if (['view', 'from', 'to', 'year', 'month', 'cmpcol'].indexOf(k) < 0 || (p.preset === 'custom' && (k === 'from' || k === 'to'))) keepP[k] = p[k]; });
        if (c.custom) { var d0 = cleanDef(c.custom.def); d0.view = JSON.parse(JSON.stringify(p.view || {})); if (d0.kind === 'ready') d0.p = keepP; else d0.p = { preset: p.preset, flt: p.flt || null }; return d0; }
        return { kind: 'ready', base: c.id, p: keepP, view: JSON.parse(JSON.stringify(p.view || {})) };
      };
      var vs = q('[data-vsave]', m);
      if (vs) vs.onclick = function () {
        busy(vs, true);
        call('fin_report_save', { report: { id: c.custom.id, name: c.custom.name, cat: c.custom.cat || 'تقاريري', def: defOf() } }).then(function (r) { F.reports = r.reports; var s2 = r.reports.filter(function (x) { return x.id === c.custom.id; })[0]; if (s2) c.custom = s2; toast('حُفظت التغييرات'); A.render(); })
          .catch(function (e) { busy(vs, false); toast(e.message, true); });
      };
      var vc = q('[data-vcopy]', m);
      if (vc) vc.onclick = function () {
        var base = c.custom ? c.custom.name : (R[c.id] || {}).name;
        sheet('حفظ نسخة مخصصة', '<p class="small muted" style="margin:0 0 8px">تُحفظ النسخة بالإعدادات الحالية (الفترة، التصفية، الشروط، الأعمدة) في «تقاريري» لكل المستخدمين، ويبقى التقرير الأصلي كما هو.</p>' +
          '<div class="field"><label class="lbl" for="vcn">اسم التقرير</label><input id="vcn" class="input" value="' + esc(base + (c.custom ? ' (نسخة)' : ' - مخصص')) + '"></div><button class="btn primary big" data-vcok>حفظ</button>', function (s) {
          var inp = q('#vcn', s.el); setTimeout(function () { inp.focus(); inp.select(); }, 50);
          q('[data-vcok]', s.el).onclick = function () {
            var name = inp.value.trim(); if (!name) { inp.focus(); return; }
            var b = this; busy(b, true);
            call('fin_report_save', { report: { name: name, cat: 'تقاريري', def: defOf() } }).then(function (r) {
              F.reports = r.reports; s.close(); var saved = r.reports.filter(function (x) { return x.name === name; }).pop(); toast('حُفظ «' + name + '» في تقاريري'); if (saved) openReport('c:' + saved.id); else A.render();
            }).catch(function (e) { busy(b, false); toast(e.message, true); });
          };
        });
      };
    }

    /* ===================== المندوبون وفئاتهم (جملة، تجزئة، أسواق…) =====================
       المندوب لكل فاتورة يُحدَّد حسب الإعداد (الفاتورة، ثم عميلها، ثم المخزن، ثم المستخدم).
       الفئة من «مجموعات المندوبين» في سراج، أو مما تحدده في الإعدادات ← المندوبون وفئاتهم. */
    (function () {
      var ai = CATS.map(function (c) { return c[0]; }).indexOf('sales');
      CATS.splice(ai + 1, 0, ['reps', 'المندوبون وفئاتهم']);
    })();
    if (R.sales_rep) R.sales_rep.cat = 'reps';
    if (R.sales_reps_card) R.sales_reps_card.cat = 'reps';
    var REP_F = ['ag', 'cat', 'cust', 'item', 'st', 'xcust', 'xitem', 'xcat'];
    if (R.sales_reps_card) R.sales_reps_card.fdims = REP_F;
    function ok0(x) { return x && x !== '0' && T().ag[x] ? x : ''; }
    // التحصيل لكل مندوب: مندوب السند، وإلا مندوب العميل (آخر فاتورة له)، وإلا مندوب المستخدم
    function repCollections(from, to, rv) {
      var bx = boxIds(''), recv = rv || recvIds(), bset = {}, rset = {}, by = {}, mode = repSet().mode || 'auto';
      bx.forEach(function (x) { bset[x] = 1; }); recv.forEach(function (x) { rset[x] = 1; });
      entriesIn(from, to).forEach(function (l0) {
        var ls = F.D.byEntry[l0.e], dB = 0, cR = 0, cr = [];
        ls.forEach(function (l) { if (bx.length ? bset[l.a] : (l0.k === 'r' && l.dr)) dB += l.dr; if (rset[l.a] && l.cr) { cR += l.cr; cr.push(l); } });
        var amt = Math.min(dB, cR);
        if (amt <= 0) return;
        cr.forEach(function (l) {
          var r = ok0(l.ag) || ok0(l0.ag) || ok0(F.D.repOfCust[l.a]) || (mode === 'auto' || mode === 'user' ? ok0(F.D.byUser[l0.u]) : '') || '0';
          var o = by[r] || (by[r] = { v: 0, n: {} }); o.v += amt * l.cr / cR; o.n[l0.e] = 1;
        });
      });
      return by;
    }
    function custDebtByRep(asof, rv) {
      var by = {};
      (rv || recvIds()).forEach(function (a) { var b = balance([a], null, asof).close; if (Math.abs(b) < 0.005) return; var r = F.D.repOfCust[a] || '0'; var o = by[r] || (by[r] = { v: 0, n: 0, list: [] }); o.v += b; o.n++; o.list.push({ a: a, v: b }); });
      return by;
    }
    // تجميع المبيعات حسب مفتاح، مع مؤشرات المندوب الكاملة
    function repAgg(p, keyFn, nameFn) {
      var g = {};
      facts('s', p.from, p.to, p.flt).forEach(function (x) {
        var k = keyFn(x), r = g[k] || (g[k] = { k: k, name: nameFn(x), sales: 0, ret: 0, profit: 0, cost: 0, qty: 0, inv: {}, cust: {}, items: {}, reps: {}, days: {}, rinv: {} });
        if (x.s > 0) { r.sales += x.val; r.inv[x.v.id] = 1; r.cust[x.v.ck] = 1; r.items[x.l.item] = 1; r.days[x.d] = 1; } else { r.ret += x.val; r.rinv[x.v.id] = 1; }
        r.profit += x.s * x.profit; r.cost += x.s * x.cost; r.qty += x.s * x.qty; r.reps[x.v.ag] = 1;
      });
      return Object.keys(g).map(function (k) {
        var r = g[k], n = Object.keys(r.inv).length;
        return { k: k, name: r.name, net: r.sales - r.ret, sales: r.sales, ret: r.ret, rp: pct(r.ret, r.sales), profit: r.profit, margin: pct(r.profit, r.sales - r.ret), qty: r.qty,
          n: n, rn: Object.keys(r.rinv).length, cust: Object.keys(r.cust).length, items: Object.keys(r.items).length, reps: Object.keys(r.reps).filter(function (x) { return x !== '0'; }).length,
          days: Object.keys(r.days).length, avg: n ? r.sales / n : 0 };
      });
    }
    function shareOf(rows, k, out) { var t = sum(rows, k); rows.forEach(function (r) { r[out || 'share'] = pct(r[k], t); }); return rows; }
    function repRows(p) { return repAgg(p, function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag); }); }
    function catRows(p) { return repAgg(p, function (x) { return repCat(x.v.ag); }, function (x) { return repCat(x.v.ag); }); }
    var MEAS = { net: ['صافي المبيعات', 'money'], profit: ['مجمل الربح', 'money'], qty: ['الكمية', 'qty'], n: ['عدد الفواتير', 'int'] };
    function repPivot(p, rowK, rowN, colK, colN, meas, colSort) {
      var g = {}, cs = {}, m = MEAS[meas] ? meas : 'net', seenInv = {};
      facts('s', p.from, p.to, p.flt).forEach(function (x) {
        var rk = rowK(x), ck = colK(x), r = g[rk] || (g[rk] = { name: rowN(x), tot: 0 }), v;
        if (m === 'n') { var key = rk + '|' + ck + '|' + x.v.id; if (x.s < 0 || seenInv[key]) return; seenInv[key] = 1; v = 1; }
        else v = m === 'net' ? x.s * x.val : m === 'profit' ? x.s * x.profit : x.s * x.qty;
        r['c_' + ck] = (r['c_' + ck] || 0) + v; r.tot += v;
        if (!cs[ck]) cs[ck] = { k: ck, name: colN(x), v: 0 }; cs[ck].v += Math.abs(v);
      });
      var cols0 = Object.keys(cs).map(function (k) { return cs[k]; });
      cols0.sort(colSort || function (a, b) { return b.v - a.v; });
      cols0 = cols0.slice(0, 30);
      var rows = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.tot - a.tot; });
      var t = MEAS[m][1], cols = [C('name', '')].concat(cols0.map(function (c) { return C('c_' + c.k, c.name, t); })).concat([C('tot', 'الإجمالي', t)]);
      return { cols: cols, rows: rows, total: sumRow(rows, cols) };
    }
    var monthSort = function (a, b) { return a.k < b.k ? -1 : 1; };

    /* ---------- حسب المندوب ---------- */
    R.reps_summary = { cat: 'reps', name: 'ملخص أداء المناديب الشامل', desc: 'لكل مندوب: الفئة والمبيعات والمرتجعات والربح والهامش والفواتير والعملاء والأصناف وأيام العمل والتحصيل ونسبته', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var rows = shareOf(repRows(p), 'net'), coll = repCollections(p.from, p.to);
        rows.forEach(function (r) { r.cat = repCat(r.k); r.coll = (coll[r.k] || {}).v || 0; r.cr = pct(r.coll, r.net); });
        rows.sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'المندوب'), C('cat', 'الفئة'), C('net', 'صافي المبيعات', 'money'), C('share', 'الحصة', 'pct'), C('ret', 'المرتجعات', 'money'), C('rp', 'المرتجعات %', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'),
          C('n', 'الفواتير', 'int'), C('avg', 'متوسط الفاتورة', 'money'), C('cust', 'العملاء', 'int'), C('items', 'الأصناف', 'int'), C('days', 'أيام البيع', 'int'), C('coll', 'التحصيل', 'money'), C('cr', 'التحصيل/المبيعات', 'pct')];
        var t = sumRow(rows, cols); t.share = 100; t.margin = pct(t.profit, t.net); t.rp = pct(t.ret, sum(rows, 'sales')); t.cr = pct(t.coll, t.net); t.cat = '';
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], limit: 15 } }, p);
      } };
    R.reps_profile = { cat: 'reps', name: 'بطاقة مندوب تفصيلية', desc: 'كل شيء عن مندوب واحد: مؤشراته، ومبيعاته الشهرية، وأعلى عملائه وأصنافه، وتحصيله ومديونية عملائه', params: ['period', 'rep'],
      run: function (p) {
        var id = p.rep || Object.keys(T().ag)[0];
        if (!id) return emptyR('لا يوجد مناديب في سراج');
        var pf = Object.assign({}, p, { flt: { ag: ['@' + id] } }), s = repRows(pf).filter(function (r) { return r.k === id; })[0] || { net: 0, profit: 0, n: 0, cust: 0, items: 0, ret: 0, sales: 0, days: 0, avg: 0, margin: 0, rp: 0 };
        var coll = (repCollections(p.from, p.to)[id] || {}).v || 0, debt = custDebtByRep(p.to)[id] || { v: 0, n: 0 };
        var all = sum(repRows(p), 'net');
        var rows = [{ name: 'المؤشرات', _b: true, _hl: true }];
        [['صافي المبيعات', s.net, 'm'], ['حصته من مبيعات الشركة', pct(s.net, all), 'p'], ['المرتجعات', s.ret, 'm'], ['نسبة المرتجعات', s.rp, 'p'], ['مجمل الربح', s.profit, 'm'], ['هامش الربح', s.margin, 'p'],
          ['عدد الفواتير', s.n, 'n'], ['متوسط الفاتورة', s.avg, 'm'], ['العملاء', s.cust, 'n'], ['الأصناف المباعة', s.items, 'n'], ['أيام البيع', s.days, 'n'], ['التحصيل', coll, 'm'], ['التحصيل/المبيعات', pct(coll, s.net), 'p'],
          ['مديونية عملائه الآن', debt.v, 'm'], ['عدد عملائه المدينين', debt.n, 'n']].forEach(function (k) { rows.push({ name: k[0], v: k[1], _fmt: k[2] === 'p' ? 'pct' : k[2] === 'n' ? 'int' : undefined }); });
        rows.push({ name: 'المبيعات الشهرية', _b: true, _hl: true });
        monthsOf(p).forEach(function (x) { var st = salesStats(x.a, x.b, pf.flt); rows.push({ name: x.label, v: st.net, b: st.profit, c: st.n }); });
        rows.push({ name: 'أعلى 10 عملاء', _b: true, _hl: true });
        salesBy(pf, function (x) { return x.v.ck; }, function (x) { return x.v.name; }).sort(function (a, b) { return b.net - a.net; }).slice(0, 10).forEach(function (r) { rows.push({ name: r.name, v: r.net, b: r.profit, c: r.n }); });
        rows.push({ name: 'أعلى 10 أصناف', _b: true, _hl: true });
        salesBy(pf, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }).sort(function (a, b) { return b.net - a.net; }).slice(0, 10).forEach(function (r) { rows.push({ name: r.name, v: r.net, b: r.profit, c: r.qty }); });
        var res = { cols: [C('name', ''), C('v', 'القيمة', 'money'), C('b', 'مجمل الربح', 'money'), C('c', 'العدد/الكمية', 'qty')], rows: rows, subtitle: repName(id) + ' · ' + repCat(id) };
        return withNote(res, p);
      } };
    R.reps_month = { cat: 'reps', name: 'المناديب شهرياً', desc: 'جدول: صف لكل مندوب وعمود لكل شهر، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'flt'], fdims: REP_F,
      run: function (p) { var r = repPivot(p, function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag); }, function (x) { return x.d.slice(0, 7); }, function (x) { return monthLabel(x.d.slice(0, 7)); }, p.rmeas, monthSort); r.cols[0].l = 'المندوب'; r.chart = r.rows.length > 1 ? { type: 'hbar', x: 'name', y: ['tot'], yl: ['الإجمالي'] } : null; return withNote(r, p); } };
    R.reps_compare = { cat: 'reps', name: 'المناديب مقابل الفترة السابقة', desc: 'مبيعات وربح كل مندوب في الفترة والفترة السابقة بنفس الطول، والتغير ونسبته', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var pr = prevRange(p.from, p.to, p.preset), cur = repRows(p), old = {}; repRows(Object.assign({}, p, { from: pr[0], to: pr[1] })).forEach(function (r) { old[r.k] = r; });
        var keys = {}; cur.forEach(function (r) { keys[r.k] = 1; }); Object.keys(old).forEach(function (k) { keys[k] = 1; });
        var c0 = {}; cur.forEach(function (r) { c0[r.k] = r; });
        var rows = Object.keys(keys).map(function (k) { var a = c0[k] || { net: 0, profit: 0, cust: 0 }, b = old[k] || { net: 0, profit: 0, cust: 0 }; return { name: repName(k === '0' ? '' : k), cat: repCat(k), net: a.net, pnet: b.net, ch: a.net - b.net, chp: b.net ? (a.net - b.net) / Math.abs(b.net) * 100 : '', profit: a.profit, pprofit: b.profit, cust: a.cust, pcust: b.cust }; })
          .sort(function (a, b) { return b.ch - a.ch; });
        var cols = [C('name', 'المندوب'), C('cat', 'الفئة'), C('net', 'المبيعات الآن', 'money'), C('pnet', 'الفترة السابقة', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct'), C('profit', 'الربح الآن', 'money'), C('pprofit', 'الربح سابقاً', 'money'), C('cust', 'عملاء الآن', 'int'), C('pcust', 'عملاء سابقاً', 'int')];
        var t = sumRow(rows, cols); t.chp = t.pnet ? (t.net - t.pnet) / Math.abs(t.pnet) * 100 : ''; t.cat = '';
        return withNote({ cols: cols, rows: rows, total: t, note: 'الفترة السابقة: ' + pr[0] + ' إلى ' + pr[1], chart: { type: 'hbar', x: 'name', y: ['ch'], yl: ['التغير'] } }, p);
      } };
    R.reps_rank = { cat: 'reps', name: 'ترتيب المناديب على عدة مؤشرات', desc: 'ترتيب كل مندوب في المبيعات والربح والهامش والعملاء والتحصيل والمرتجعات، ومجموع نقاط عام', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var rows = repRows(p).filter(function (r) { return r.k !== '0'; }), coll = repCollections(p.from, p.to);
        rows.forEach(function (r) { r.coll = (coll[r.k] || {}).v || 0; r.cat = repCat(r.k); });
        var M = [['net', 1], ['profit', 1], ['margin', 1], ['cust', 1], ['coll', 1], ['rp', -1]], n = rows.length;
        M.forEach(function (m) { rows.slice().sort(function (a, b) { return m[1] * ((b[m[0]] || 0) - (a[m[0]] || 0)); }).forEach(function (r, i) { r['r_' + m[0]] = i + 1; }); });
        rows.forEach(function (r) { r.score = sum(M, function (m) { return n - r['r_' + m[0]] + 1; }) / (M.length * n) * 100; });
        rows.sort(function (a, b) { return b.score - a.score; }); rows.forEach(function (r, i) { r.rank = i + 1; r._hl = i < 3; });
        var cols = [C('rank', 'الترتيب العام', 'int'), C('name', 'المندوب'), C('cat', 'الفئة'), C('score', 'النقاط من 100', 'qty'), C('r_net', 'المبيعات', 'int'), C('r_profit', 'الربح', 'int'), C('r_margin', 'الهامش', 'int'), C('r_cust', 'العملاء', 'int'), C('r_coll', 'التحصيل', 'int'), C('r_rp', 'أقل مرتجعات', 'int')];
        var res = withNote({ cols: cols, rows: rows, note: 'الأرقام في الأعمدة هي ترتيب المندوب (1 = الأفضل). النقاط تجمع الترتيبات الستة بأوزان متساوية.' }, p);
        if (!rows.length) res.empty = 'لا توجد مبيعات بمناديب في هذه الفترة';
        return res;
      } };
    R.reps_customers = { cat: 'reps', name: 'عملاء كل مندوب', desc: 'لكل مندوب عملاؤه: مشترياتهم وربحهم وفواتيرهم وآخر شراء ورصيد كل عميل الآن', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          var rk = x.v.ag || '0', ck = x.v.ck, R0 = g[rk] || (g[rk] = {}), r = R0[ck] || (R0[ck] = { name: x.v.name, net: 0, profit: 0, inv: {}, last: '' });
          r.net += x.s * x.val; r.profit += x.s * x.profit; if (x.s > 0) { r.inv[x.v.id] = 1; if (x.d > r.last) r.last = x.d; }
        });
        var rows = [];
        Object.keys(g).sort(function (a, b) { return sum(Object.keys(g[b]).map(function (k) { return g[b][k]; }), 'net') - sum(Object.keys(g[a]).map(function (k) { return g[a][k]; }), 'net'); }).forEach(function (rk) {
          var list = Object.keys(g[rk]).map(function (ck) { var r = g[rk][ck]; return { name: r.name, net: r.net, profit: r.profit, n: Object.keys(r.inv).length, last: r.last, bal: acc(ck) ? balance([ck], null, p.to).close : '', _acc: acc(ck) ? ck : null }; }).sort(function (a, b) { return b.net - a.net; });
          rows.push({ name: repName(rk === '0' ? '' : rk) + ' · ' + repCat(rk) + ' (' + list.length + ' عميل)', net: sum(list, 'net'), profit: sum(list, 'profit'), n: sum(list, 'n'), bal: sum(list, function (r) { return Number(r.bal) || 0; }), _b: true, _hl: true });
          list.forEach(function (r) { rows.push(r); });
        });
        var cols = [C('name', 'المندوب / العميل'), C('net', 'صافي المشتريات', 'money'), C('profit', 'مجمل الربح', 'money'), C('n', 'الفواتير', 'int'), C('last', 'آخر شراء'), C('bal', 'الرصيد الآن', 'money')];
        return withNote({ cols: cols, rows: rows }, p);
      } };
    R.reps_items = { cat: 'reps', name: 'أصناف كل مندوب', desc: 'لكل مندوب الأصناف التي باعها: الكمية والقيمة والربح والهامش', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          var rk = x.v.ag || '0', R0 = g[rk] || (g[rk] = {}), r = R0[x.l.item] || (R0[x.l.item] = { name: itemName(x.l.item), unit: (T().item[x.l.item] || {}).mu || '', qty: 0, net: 0, profit: 0 });
          r.qty += x.s * x.qty; r.net += x.s * x.val; r.profit += x.s * x.profit;
        });
        var rows = [];
        Object.keys(g).forEach(function (rk) {
          var list = Object.keys(g[rk]).map(function (k) { var r = g[rk][k]; r.margin = pct(r.profit, r.net); return r; }).sort(function (a, b) { return b.net - a.net; });
          var t = sum(list, 'net'); list.forEach(function (r) { r.share = pct(r.net, t); });
          rows.push({ name: repName(rk === '0' ? '' : rk) + ' · ' + repCat(rk) + ' (' + list.length + ' صنف)', net: t, profit: sum(list, 'profit'), _b: true, _hl: true, _s: t });
          list.forEach(function (r) { rows.push(r); });
        });
        var cols = [C('name', 'المندوب / الصنف'), C('qty', 'الكمية', 'qty'), C('unit', 'الوحدة'), C('net', 'صافي المبيعات', 'money'), C('share', 'من مبيعات المندوب', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct')];
        return withNote({ cols: cols, rows: rows }, p);
      } };
    R.reps_item_matrix = { cat: 'reps', name: 'الأصناف × المناديب', desc: 'جدول: صف لكل صنف وعمود لكل مندوب، بالقيمة أو الكمية أو الربح', params: ['period', 'rmeas', 'top', 'flt'], fdims: REP_F,
      run: function (p) { var r = repPivot(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }, function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag); }, p.rmeas); r.cols[0].l = 'الصنف'; return withNote(topN(r, p), p); } };
    R.reps_collect = { cat: 'reps', name: 'تحصيل المناديب ومديونية عملائهم', desc: 'لكل مندوب: المبيعات والتحصيل وعدد السندات ونسبة التحصيل ومديونية عملائه الآن', params: ['period', 'flt'], fdims: ['ag', 'cat'],
      run: function (p) {
        var f = parseFilter(p.flt), sales = {}; repRows(p).forEach(function (r) { sales[r.k] = r; });
        var coll = repCollections(p.from, p.to), debt = custDebtByRep(p.to), keys = {};
        [sales, coll, debt].forEach(function (o) { Object.keys(o).forEach(function (k) { keys[k] = 1; }); });
        var rows = Object.keys(keys).filter(function (k) { return !f || ((!f.ag || !f.ag.length || matchAny(f.ag, k, repName(k))) && (!f.cat || !f.cat.length || f.cat.map(function (x) { return String(x).replace(/^@/, ''); }).indexOf(repCat(k)) >= 0)); })
          .map(function (k) { var s = sales[k] || { net: 0 }, c = coll[k] || { v: 0, n: {} }, d = debt[k] || { v: 0, n: 0 }; return { name: repName(k === '0' ? '' : k), cat: repCat(k), net: s.net, coll: c.v, nr: Object.keys(c.n).length, cr: pct(c.v, s.net), debt: d.v, dn: d.n, avgd: d.n ? d.v / d.n : 0 }; })
          .sort(function (a, b) { return b.coll - a.coll; });
        var cols = [C('name', 'المندوب'), C('cat', 'الفئة'), C('net', 'صافي المبيعات', 'money'), C('coll', 'التحصيل', 'money'), C('nr', 'سندات القبض', 'int'), C('cr', 'التحصيل/المبيعات', 'pct'), C('debt', 'مديونية عملائه الآن', 'money'), C('dn', 'عملاء مدينون', 'int'), C('avgd', 'متوسط دين العميل', 'money')];
        var t = sumRow(rows, cols); t.cr = pct(t.coll, t.net); t.cat = ''; t.avgd = t.dn ? t.debt / t.dn : 0;
        return withNote({ cols: cols, rows: rows, total: t, note: 'التحصيل يُنسب لمندوب السند، وإن لم يوجد فلمندوب العميل (مندوب آخر فاتورة مبيع له). المديونية حسب مندوب العميل.', chart: { type: 'bar', x: 'name', y: ['net', 'coll'], yl: ['المبيعات', 'التحصيل'] } }, p);
      } };
    R.reps_aging = { cat: 'reps', name: 'أعمار ديون عملاء كل مندوب', desc: 'مديونية عملاء كل مندوب موزعة حسب عمر الدين (0-30، 31-60، 61-90، 91-120، أكثر)', params: ['asof', 'flt'], fdims: ['ag', 'cat'],
      run: function (p) {
        var base = aging(recvIds(), p.asof, 1), f = parseFilter(p.flt), g = {};
        base.rows.forEach(function (r) {
          var rk = F.D.repOfCust[r._acc] || '0';
          if (f && f.ag && f.ag.length && !matchAny(f.ag, rk, repName(rk))) return;
          if (f && f.cat && f.cat.length && f.cat.map(function (x) { return String(x).replace(/^@/, ''); }).indexOf(repCat(rk)) < 0) return;
          var o = g[rk] || (g[rk] = { name: repName(rk === '0' ? '' : rk), cat: repCat(rk), n: 0, tot: 0, b1: 0, b2: 0, b3: 0, b4: 0, b5: 0 });
          o.n++; ['tot', 'b1', 'b2', 'b3', 'b4', 'b5'].forEach(function (k) { o[k] += r[k] || 0; });
        });
        var rows = Object.keys(g).map(function (k) { var o = g[k]; o.old = pct(o.b4 + o.b5, o.tot); return o; }).sort(function (a, b) { return b.tot - a.tot; });
        var cols = [C('name', 'المندوب'), C('cat', 'الفئة'), C('n', 'عملاء مدينون', 'int'), C('tot', 'الإجمالي', 'money'), C('b1', '0-30 يوماً', 'money'), C('b2', '31-60', 'money'), C('b3', '61-90', 'money'), C('b4', '91-120', 'money'), C('b5', 'أكثر من 120', 'money'), C('old', 'نسبة ما فوق 90 يوماً', 'pct')];
        var t = sumRow(rows, cols); t.old = pct(t.b4 + t.b5, t.tot); t.cat = '';
        return { cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['tot'], yl: ['المديونية'] } };
      } };
    R.reps_returns = { cat: 'reps', name: 'مرتجعات المناديب', desc: 'لكل مندوب: المبيعات والمرتجعات ونسبتها وعدد فواتير المرتجع وأكثر صنف مرتجع', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var top = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { if (x.s > 0) return; var rk = x.v.ag || '0', o = top[rk] || (top[rk] = {}); o[x.l.item] = (o[x.l.item] || 0) + x.val; });
        var rows = repRows(p).map(function (r) { var o = top[r.k] || {}, ti = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; })[0]; return { name: r.name, cat: repCat(r.k), sales: r.sales, ret: r.ret, rp: r.rp, rn: r.rn, ti: ti ? itemName(ti) : '', tv: ti ? o[ti] : '' }; })
          .sort(function (a, b) { return b.rp - a.rp; });
        var cols = [C('name', 'المندوب'), C('cat', 'الفئة'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('rp', 'نسبة المرتجعات', 'pct'), C('rn', 'فواتير المرتجع', 'int'), C('ti', 'أكثر صنف مرتجع'), C('tv', 'قيمته', 'money')];
        var t = sumRow(rows, cols); t.rp = pct(t.ret, t.sales); t.cat = ''; t.ti = ''; t.tv = '';
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['rp'], yl: ['نسبة المرتجعات %'] } }, p);
      } };
    R.reps_custbase = { cat: 'reps', name: 'العملاء الجدد والمتوقفون لكل مندوب', desc: 'لكل مندوب: العملاء النشطون في الفترة، والجدد (أول شراء لهم)، والذين اشتروا في الفترة السابقة وتوقفوا', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var pr = prevRange(p.from, p.to, p.preset), first = {}, f = parseFilter(p.flt);
        F.D.invs.forEach(function (v) { if (v.c === SALE && (!first[v.ck] || v.d < first[v.ck])) first[v.ck] = v.d; });
        var setOf = function (a, b) { var o = {}; facts('s', a, b, p.flt).forEach(function (x) { if (x.s > 0) (o[x.v.ag || '0'] = o[x.v.ag || '0'] || {})[x.v.ck] = 1; }); return o; };
        var cur = setOf(p.from, p.to), old = setOf(pr[0], pr[1]), keys = {};
        Object.keys(cur).forEach(function (k) { keys[k] = 1; }); Object.keys(old).forEach(function (k) { keys[k] = 1; });
        var rows = Object.keys(keys).map(function (k) {
          var c = cur[k] || {}, o = old[k] || {}, ck = Object.keys(c), ok = Object.keys(o);
          return { name: repName(k === '0' ? '' : k), cat: repCat(k), act: ck.length, nw: ck.filter(function (x) { return first[x] >= p.from; }).length, kept: ck.filter(function (x) { return o[x]; }).length, lost: ok.filter(function (x) { return !c[x]; }).length, prev: ok.length };
        }).map(function (r) { r.keep = pct(r.kept, r.prev); return r; }).sort(function (a, b) { return b.act - a.act; });
        var cols = [C('name', 'المندوب'), C('cat', 'الفئة'), C('act', 'نشطون الآن', 'int'), C('nw', 'جدد', 'int'), C('prev', 'نشطون سابقاً', 'int'), C('kept', 'استمروا', 'int'), C('lost', 'توقفوا', 'int'), C('keep', 'نسبة الاستمرار', 'pct')];
        return withNote({ cols: cols, rows: rows, note: 'الفترة السابقة: ' + pr[0] + ' إلى ' + pr[1] }, p);
      } };
    R.reps_daily = { cat: 'reps', name: 'النشاط اليومي للمناديب', desc: 'جدول: صف لكل مندوب وعمود لكل يوم، بقيمة المبيعات أو عدد الفواتير (حتى 31 يوماً)', params: ['period', 'rmeas', 'flt'], fdims: REP_F,
      run: function (p) {
        var from = days(p.from, p.to) > 30 ? addD(p.to, -30) : p.from;
        var r = repPivot(Object.assign({}, p, { from: from }), function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag); }, function (x) { return x.d; }, function (x) { return x.d.slice(8, 10) + '/' + x.d.slice(5, 7); }, p.rmeas, monthSort);
        r.cols[0].l = 'المندوب';
        if (from !== p.from) r.note = 'آخر 31 يوماً من الفترة: ' + from + ' إلى ' + p.to;
        return withNote(r, p);
      } };
    R.reps_weekday = { cat: 'reps', name: 'أيام عمل المناديب في الأسبوع', desc: 'لكل مندوب: المبيعات في كل يوم من أيام الأسبوع، لمعرفة خطوط السير والأيام الضعيفة', params: ['period', 'rmeas', 'flt'], fdims: REP_F,
      run: function (p) {
        var ord = [6, 0, 1, 2, 3, 4, 5];
        var r = repPivot(p, function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag); }, function (x) { return new Date(d2t(x.d)).getUTCDay(); }, function (x) { return DOW[new Date(d2t(x.d)).getUTCDay()]; }, p.rmeas, function (a, b) { return ord.indexOf(Number(a.k)) - ord.indexOf(Number(b.k)); });
        r.cols[0].l = 'المندوب'; return withNote(r, p);
      } };
    R.reps_invoices = { cat: 'reps', name: 'فواتير المناديب بالتفصيل', desc: 'كل فاتورة مبيع ومرتجع مجمّعة حسب المندوب: التاريخ والرقم والعميل والقيمة والربح', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var g = {};
        invAgg(p.from, p.to, p.flt).forEach(function (r) { (g[r.v.ag || '0'] = g[r.v.ag || '0'] || []).push(r); });
        var rows = [];
        Object.keys(g).forEach(function (rk) {
          var list = g[rk].sort(function (a, b) { return a.v.d < b.v.d ? -1 : a.v.d > b.v.d ? 1 : 0; });
          rows.push({ d: repName(rk === '0' ? '' : rk) + ' · ' + repCat(rk) + ' (' + list.length + ' فاتورة)', val: sum(list, function (r) { return r.s * r.val; }), profit: sum(list, function (r) { return r.s * r.profit; }), qty: sum(list, function (r) { return r.s * r.qty; }), _b: true, _hl: true });
          list.forEach(function (r) { rows.push({ d: r.v.d, no: r.v.no, kind: r.s > 0 ? 'مبيع' : 'مرتجع', cust: r.v.name, lines: r.lines, qty: r.s * r.qty, val: r.s * r.val, profit: r.s * r.profit }); });
        });
        var cols = [C('d', 'التاريخ'), C('no', 'الفاتورة'), C('kind', 'النوع'), C('cust', 'العميل'), C('lines', 'الأصناف', 'int'), C('qty', 'الكمية', 'qty'), C('val', 'الصافي', 'money'), C('profit', 'الربح', 'money')];
        return withNote({ cols: cols, rows: rows }, p);
      } };

    /* ---------- حسب فئة المندوب ---------- */
    R.cat_summary = { cat: 'reps', name: 'ملخص فئات المناديب', desc: 'لكل فئة (جملة، تجزئة، أسواق…): عدد المناديب والمبيعات والحصة والربح والهامش والعملاء ومتوسط المندوب والتحصيل', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var rows = shareOf(catRows(p), 'net'), coll = repCollections(p.from, p.to), cc = {};
        Object.keys(coll).forEach(function (k) { var c = repCat(k); cc[c] = (cc[c] || 0) + coll[k].v; });
        rows.forEach(function (r) { r.coll = cc[r.k] || 0; r.cr = pct(r.coll, r.net); r.per = r.reps ? r.net / r.reps : ''; });
        rows.sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'الفئة'), C('reps', 'المناديب', 'int'), C('net', 'صافي المبيعات', 'money'), C('share', 'الحصة', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('rp', 'المرتجعات %', 'pct'),
          C('n', 'الفواتير', 'int'), C('avg', 'متوسط الفاتورة', 'money'), C('cust', 'العملاء', 'int'), C('items', 'الأصناف', 'int'), C('per', 'متوسط مبيعات المندوب', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'التحصيل/المبيعات', 'pct')];
        var t = sumRow(rows, cols); t.share = 100; t.margin = pct(t.profit, t.net); t.rp = pct(sum(rows, 'ret'), sum(rows, 'sales')); t.cr = pct(t.coll, t.net); t.per = '';
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['net', 'profit'], yl: ['صافي المبيعات', 'مجمل الربح'] } }, p);
      } };
    R.cat_reps = { cat: 'reps', name: 'المناديب داخل كل فئة', desc: 'كل فئة ومناديبها مع مجموع الفئة، وحصة كل مندوب داخل فئته ومن الإجمالي', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var reps = repRows(p), all = sum(reps, 'net'), g = {};
        reps.forEach(function (r) { (g[repCat(r.k)] = g[repCat(r.k)] || []).push(r); });
        var rows = [];
        Object.keys(g).sort(function (a, b) { return sum(g[b], 'net') - sum(g[a], 'net'); }).forEach(function (c) {
          var list = g[c].sort(function (a, b) { return b.net - a.net; }), t = sum(list, 'net');
          rows.push({ name: c + ' (' + list.length + ' مندوب)', net: t, profit: sum(list, 'profit'), cust: sum(list, 'cust'), n: sum(list, 'n'), inCat: 100, ofAll: pct(t, all), margin: pct(sum(list, 'profit'), t), _b: true, _hl: true });
          list.forEach(function (r) { rows.push({ name: r.name, net: r.net, profit: r.profit, margin: r.margin, cust: r.cust, n: r.n, inCat: pct(r.net, t), ofAll: pct(r.net, all) }); });
        });
        var cols = [C('name', 'الفئة / المندوب'), C('net', 'صافي المبيعات', 'money'), C('inCat', 'من الفئة', 'pct'), C('ofAll', 'من الإجمالي', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('cust', 'العملاء', 'int'), C('n', 'الفواتير', 'int')];
        return withNote({ cols: cols, rows: rows, total: { name: 'الإجمالي', net: all, profit: sum(reps, 'profit'), ofAll: 100 } }, p);
      } };
    R.cat_month = { cat: 'reps', name: 'فئات المناديب شهرياً', desc: 'جدول: صف لكل فئة وعمود لكل شهر، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'flt'], fdims: REP_F,
      run: function (p) {
        var r = repPivot(p, function (x) { return repCat(x.v.ag); }, function (x) { return repCat(x.v.ag); }, function (x) { return x.d.slice(0, 7); }, function (x) { return monthLabel(x.d.slice(0, 7)); }, p.rmeas, monthSort);
        r.cols[0].l = 'الفئة';
        var mk = r.cols.slice(1, -1).map(function (c) { return c.k; });
        if (mk.length > 1) { r.chart = { type: 'line', x: 'name', y: r.rows.slice(0, 6).map(function (x, i) { return 'y' + i; }), yl: r.rows.slice(0, 6).map(function (x) { return x.name; }), rowsOverride: mk.map(function (k, j) { var o = { name: r.cols[j + 1].l }; r.rows.slice(0, 6).forEach(function (x, i) { o['y' + i] = x[k] || 0; }); return o; }) }; }
        return withNote(r, p);
      } };
    R.cat_items = { cat: 'reps', name: 'الأصناف حسب فئة المندوب', desc: 'جدول: صف لكل صنف وعمود لكل فئة، لمعرفة ما تبيعه الجملة والتجزئة والأسواق', params: ['period', 'rmeas', 'top', 'flt'], fdims: REP_F,
      run: function (p) { var r = repPivot(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }, function (x) { return repCat(x.v.ag); }, function (x) { return repCat(x.v.ag); }, p.rmeas); r.cols[0].l = 'الصنف'; return withNote(topN(r, p), p); } };
    R.cat_item_share = { cat: 'reps', name: 'حصة كل فئة من كل صنف', desc: 'لكل صنف: كم نسبة مبيعاته تأتي من كل فئة (الجملة مقابل التجزئة مثلاً)', params: ['period', 'top', 'flt'], fdims: REP_F,
      run: function (p) {
        var r = repPivot(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }, function (x) { return repCat(x.v.ag); }, function (x) { return repCat(x.v.ag); }, 'net');
        var ks = r.cols.slice(1, -1);
        r.rows.forEach(function (row) { ks.forEach(function (c) { row['p' + c.k] = pct(row[c.k] || 0, row.tot); }); });
        r.cols = [C('name', 'الصنف'), C('tot', 'صافي المبيعات', 'money')].concat(ks.map(function (c) { return C('p' + c.k, c.l, 'pct'); }));
        r.total = null;
        return withNote(topN(r, p), p);
      } };
    R.cat_customers = { cat: 'reps', name: 'العملاء حسب فئة المندوب', desc: 'العملاء مجمّعون حسب فئة المندوب الذي باعهم، بمشترياتهم وربحهم ورصيدهم', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          var c = repCat(x.v.ag), G = g[c] || (g[c] = {}), r = G[x.v.ck] || (G[x.v.ck] = { name: x.v.name, net: 0, profit: 0, inv: {}, reps: {} });
          r.net += x.s * x.val; r.profit += x.s * x.profit; if (x.s > 0) r.inv[x.v.id] = 1; r.reps[repName(x.v.ag)] = 1;
        });
        var rows = [];
        Object.keys(g).forEach(function (c) {
          var list = Object.keys(g[c]).map(function (ck) { var r = g[c][ck]; return { name: r.name, net: r.net, profit: r.profit, n: Object.keys(r.inv).length, reps: Object.keys(r.reps).join('، '), bal: acc(ck) ? balance([ck], null, p.to).close : '', _acc: acc(ck) ? ck : null }; }).sort(function (a, b) { return b.net - a.net; });
          rows.push({ name: c + ' (' + list.length + ' عميل)', net: sum(list, 'net'), profit: sum(list, 'profit'), n: sum(list, 'n'), bal: sum(list, function (r) { return Number(r.bal) || 0; }), _b: true, _hl: true });
          list.forEach(function (r) { rows.push(r); });
        });
        return withNote({ cols: [C('name', 'الفئة / العميل'), C('net', 'صافي المشتريات', 'money'), C('profit', 'مجمل الربح', 'money'), C('n', 'الفواتير', 'int'), C('reps', 'المناديب'), C('bal', 'الرصيد الآن', 'money')], rows: rows }, p);
      } };
    R.cat_compare = { cat: 'reps', name: 'الفئات مقابل الفترة السابقة', desc: 'مبيعات وربح وعملاء كل فئة الآن وفي الفترة السابقة بنفس الطول، والتغير', params: ['period', 'flt'], fdims: REP_F,
      run: function (p) {
        var pr = prevRange(p.from, p.to, p.preset), old = {}; catRows(Object.assign({}, p, { from: pr[0], to: pr[1] })).forEach(function (r) { old[r.k] = r; });
        var cur = catRows(p), keys = {}; cur.forEach(function (r) { keys[r.k] = r; }); Object.keys(old).forEach(function (k) { if (!keys[k]) keys[k] = null; });
        var rows = Object.keys(keys).map(function (k) { var a = keys[k] || { net: 0, profit: 0, cust: 0, margin: 0 }, b = old[k] || { net: 0, profit: 0, cust: 0, margin: 0 }; return { name: k, net: a.net, pnet: b.net, ch: a.net - b.net, chp: b.net ? (a.net - b.net) / Math.abs(b.net) * 100 : '', margin: a.margin, pmargin: b.margin, cust: a.cust, pcust: b.cust }; }).sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'الفئة'), C('net', 'المبيعات الآن', 'money'), C('pnet', 'الفترة السابقة', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct'), C('margin', 'الهامش الآن', 'pct'), C('pmargin', 'الهامش سابقاً', 'pct'), C('cust', 'عملاء الآن', 'int'), C('pcust', 'عملاء سابقاً', 'int')];
        var t = sumRow(rows, cols); t.chp = t.pnet ? (t.net - t.pnet) / Math.abs(t.pnet) * 100 : ''; t.margin = ''; t.pmargin = '';
        return withNote({ cols: cols, rows: rows, total: t, note: 'الفترة السابقة: ' + pr[0] + ' إلى ' + pr[1], chart: { type: 'bar', x: 'name', y: ['net', 'pnet'], yl: ['الآن', 'الفترة السابقة'] } }, p);
      } };
    R.cat_collect = { cat: 'reps', name: 'تحصيل ومديونية كل فئة', desc: 'لكل فئة: المبيعات والتحصيل ونسبته ومديونية العملاء الآن وأعمارها', params: ['period', 'flt'], fdims: ['cat'],
      run: function (p) {
        var f = parseFilter(p.flt), cats = {}, add = function (c) { return cats[c] || (cats[c] = { name: c, net: 0, coll: 0, debt: 0, dn: 0, old: 0 }); };
        catRows(p).forEach(function (r) { add(r.k).net = r.net; });
        var coll = repCollections(p.from, p.to); Object.keys(coll).forEach(function (k) { add(repCat(k)).coll += coll[k].v; });
        aging(recvIds(), p.to, 1).rows.forEach(function (r) { var o = add(repCat(F.D.repOfCust[r._acc] || '0')); o.debt += r.tot; o.dn++; o.old += (r.b4 || 0) + (r.b5 || 0); });
        var rows = Object.keys(cats).filter(function (c) { return !f || !f.cat || !f.cat.length || f.cat.map(function (x) { return String(x).replace(/^@/, ''); }).indexOf(c) >= 0; })
          .map(function (c) { var o = cats[c]; o.cr = pct(o.coll, o.net); o.oldp = pct(o.old, o.debt); return o; }).sort(function (a, b) { return b.debt - a.debt; });
        var cols = [C('name', 'الفئة'), C('net', 'صافي المبيعات', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'التحصيل/المبيعات', 'pct'), C('debt', 'المديونية الآن', 'money'), C('dn', 'عملاء مدينون', 'int'), C('old', 'منها فوق 90 يوماً', 'money'), C('oldp', 'نسبتها', 'pct')];
        var t = sumRow(rows, cols); t.cr = pct(t.coll, t.net); t.oldp = pct(t.old, t.debt);
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['coll', 'debt'], yl: ['التحصيل', 'المديونية'] } }, p);
      } };

    /* ---------- الإعدادات: المندوبون وفئاتهم ---------- */
    var REP_MODES = [['auto', 'تلقائي: مندوب الفاتورة، وإلا مندوب العميل، وإلا مندوب المخزن، وإلا مندوب المستخدم'], ['inv', 'مندوب الفاتورة فقط (كما في سراج)'], ['cust', 'مندوب العميل المسجّل في بطاقة العميل'], ['store', 'مندوب المخزن (سيارة المندوب)'], ['user', 'مندوب المستخدم الذي أدخل الفاتورة']];
    function repDraft() {
      if (F.repDraft) return F.repDraft;
      var RS = repSet(), d = { mode: RS.mode || 'auto', cats: (RS.cats || []).slice(), map: JSON.parse(JSON.stringify(RS.map || {})), st: Object.assign({}, RS.st || {}), us: Object.assign({}, RS.us || {}) };
      if (!d.cats.length) { d.cats = ['جملة', 'تجزئة', 'أسواق']; Object.keys(T().ag).forEach(function (id) { var g = (T().ag[id] || {}).grp; if (g && d.cats.indexOf(g) < 0) d.cats.push(g); }); }
      return (F.repDraft = d);
    }
    function repsSettingsHTML() {
      var d = repDraft(), Tt = T(), ids = Object.keys(Tt.ag), stats = {};
      F.D.invs.forEach(function (v) { if (v.c === SALE) { var o = stats[v.ag] || (stats[v.ag] = { n: 0, v: 0 }); o.n++; o.v += v.net; } });
      var none = stats['0'] || { n: 0, v: 0 }, totN = sum(Object.keys(stats).map(function (k) { return stats[k]; }), 'n');
      var stOpts = function (rid) { var cur = Object.keys(d.st).filter(function (k) { return d.st[k] === rid; })[0] || ((Tt.ag[rid] || {}).st && !d.st[(Tt.ag[rid] || {}).st] ? Tt.ag[rid].st : ''); return '<option value="">—</option>' + Object.keys(Tt.st).map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(storeName(k)) + '</option>'; }).join(''); };
      var usOpts = function (rid) { var cur = Object.keys(d.us).filter(function (k) { return d.us[k] === rid; })[0] || ((Tt.ag[rid] || {}).us && !d.us[(Tt.ag[rid] || {}).us] ? Tt.ag[rid].us : ''); return '<option value="">—</option>' + Object.keys(Tt.us).map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? ' selected' : '') + '>' + esc(userName(k)) + '</option>'; }).join(''); };
      var h = '<div class="card"><h2>كيف يُحدَّد مندوب كل فاتورة؟</h2><p class="small muted" style="margin:0 0 10px">إذا كانت فواتير سراج لا تحمل اسم المندوب دائماً، اختر «تلقائي» لتُنسب الفاتورة لمندوب العميل أو المخزن أو المستخدم.</p>' +
        '<div class="list">' + REP_MODES.map(function (m) { return '<label class="item tap"><input type="radio" name="rmode" value="' + m[0] + '"' + (d.mode === m[0] ? ' checked' : '') + '><div class="main"><b>' + esc(m[1]) + '</b></div></label>'; }).join('') + '</div>' +
        '<p class="small" style="margin:10px 0 0">في البيانات الحالية: ' + fk(totN - none.n) + ' فاتورة مبيع لها مندوب، و' + fk(none.n) + ' بدون مندوب' + (none.n ? ' (' + fm(none.v) + ' د.ل)' : '') + '.</p></div>';
      h += '<div class="card"><h2>الفئات</h2><p class="small muted" style="margin:0 0 10px">أسماء فئات المناديب، مثل: جملة، تجزئة، أسواق، نصف جملة، مؤسسات. فئات «مجموعات المندوبين» في سراج تُضاف تلقائياً.</p>' +
        '<div class="st-pills">' + d.cats.map(function (c, i) { return '<span class="col-pill"><b>' + esc(c) + '</b><button type="button" data-rcdel="' + i + '" aria-label="حذف">×</button></span>'; }).join('') + '</div>' +
        '<div class="row" style="margin-top:10px"><input class="input grow" id="rcnew" placeholder="اسم فئة جديدة"><button class="btn" data-rcadd>+ إضافة</button></div></div>';
      h += '<div class="card"><h2>المناديب</h2><p class="small muted" style="margin:0 0 10px">اختر فئة كل مندوب، واربطه بمخزنه (سيارته) وبالمستخدم الذي يدخل فواتيره إن أردت. ما يأتي من سراج يظهر تلقائياً.</p>' +
        (ids.length ? '<div class="scroll-x"><table class="tbl rep-set"><thead><tr><th>المندوب</th><th>فاتورة مبيع</th><th>الفئة</th><th>المخزن</th><th>المستخدم</th></tr></thead><tbody>' + ids.sort(function (a, b) { return repName(a).localeCompare(repName(b), 'ar'); }).map(function (id) {
          var g = Tt.ag[id], cur = (d.map[id] || {}).cat || '', st0 = stats[id] || { n: 0 };
          return '<tr><td><b>' + esc(g.name) + '</b>' + (g.code ? ' <span class="num muted small">' + esc(g.code) + '</span>' : '') + (g.grp ? '<div class="small muted">في سراج: ' + esc(g.grp) + '</div>' : '') + '</td><td class="num">' + fk(st0.n) + '</td>' +
            '<td><select class="input" data-rcat="' + esc(id) + '"><option value="">' + esc(g.grp ? 'كما في سراج (' + g.grp + ')' : 'بدون فئة') + '</option>' + d.cats.map(function (c) { return '<option' + (c === cur ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></td>' +
            '<td><select class="input" data-rst="' + esc(id) + '">' + stOpts(id) + '</select></td><td><select class="input" data-rus="' + esc(id) + '">' + usOpts(id) + '</select></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="empty">لا يوجد مناديب في سراج بعد</div>') +
        '<div class="row" style="margin-top:12px"><span class="grow small muted">' + (F.repDirty ? 'لديك تعديلات غير محفوظة' : '') + '</span>' + (F.repDirty ? '<button class="btn ghost" data-rundo>تراجع</button>' : '') + '<button class="btn primary" data-rsave' + (canEdit() ? '' : ' disabled') + '>حفظ</button></div></div>';
      return h;
    }
    function bindRepsSettings(m) {
      var d = repDraft(), dirty = function () { F.repDirty = true; };
      qa('[name="rmode"]', m).forEach(function (r) { r.onchange = function () { d.mode = r.value; dirty(); A.render(); }; });
      qa('[data-rcdel]', m).forEach(function (b) { b.onclick = function () { var c = d.cats.splice(Number(b.dataset.rcdel), 1)[0]; Object.keys(d.map).forEach(function (k) { if (d.map[k].cat === c) delete d.map[k]; }); dirty(); A.render(); }; });
      var add = function () { var v = q('#rcnew', m).value.trim(); if (!v || d.cats.indexOf(v) >= 0) return; d.cats.push(v); dirty(); A.render(); };
      q('[data-rcadd]', m).onclick = add; q('#rcnew', m).onkeydown = function (e) { if (e.key === 'Enter') add(); };
      qa('[data-rcat]', m).forEach(function (el) { el.onchange = function () { if (el.value) d.map[el.dataset.rcat] = { cat: el.value }; else delete d.map[el.dataset.rcat]; dirty(); }; });
      qa('[data-rst]', m).forEach(function (el) { el.onchange = function () { var rid = el.dataset.rst; Object.keys(d.st).forEach(function (k) { if (d.st[k] === rid) delete d.st[k]; }); if (el.value) d.st[el.value] = rid; dirty(); }; });
      qa('[data-rus]', m).forEach(function (el) { el.onchange = function () { var rid = el.dataset.rus; Object.keys(d.us).forEach(function (k) { if (d.us[k] === rid) delete d.us[k]; }); if (el.value) d.us[el.value] = rid; dirty(); }; });
      var un = q('[data-rundo]', m); if (un) un.onclick = function () { F.repDraft = null; F.repDirty = false; A.render(); };
      q('[data-rsave]', m).onclick = function () {
        var b = this; busy(b, true);
        call('fin_settings_save', { settings: { reps: d } }).then(function (r) {
          var local = !('reps' in (r.settings || {}));
          if (local) { try { localStorage.setItem('rk.finReps', JSON.stringify(d)); } catch (e) {} } else { try { localStorage.removeItem('rk.finReps'); } catch (e) {} }
          F.meta.settings = r.settings; S.set('fin:meta', F.meta); F.repDraft = null; F.repDirty = false; rebuild();
          toast(local ? 'حُفظت على هذا الجهاز فقط حتى يُحدَّث الخادم' : 'حُفظت إعدادات المناديب'); A.render();
        }).catch(function (e) { busy(b, false); toast(e.message, true); });
      };
    }

    /* ===================== العملاء: ملف العميل الواحد، والتقييم، والأسعار =====================
       «ملف العميل» = تقارير عن عميل واحد تختاره: بطاقته الكاملة وتقييمه، وأصنافه وأسعاره، وفواتيره، وسداده.
       وفي قسم «العملاء» تقارير لكل العملاء: التقييم ونجاح التعامل، وتعدد الأسعار، والربحية، والسداد. */
    (function () {
      var ci = CATS.map(function (c) { return c[0]; }).indexOf('cust');
      CATS.splice(ci + 1, 0, ['cust1', 'ملف العميل (تفصيلي)']);
    })();
    var C1_F = ['item', 'st', 'ag', 'xitem'];
    var CU_F = ['cust', 'item', 'st', 'ag', 'cat', 'xcust', 'xitem'];

    function c1Filter(p, ck) { var f = parseFilter(p.flt), o = {}; if (f) Object.keys(f).forEach(function (k) { if (k !== 'cust' && k !== 'xcust') o[k] = f[k]; }); o.cust = ['@' + ck]; return o; }
    function custHasAcc(ck) { return !!acc(ck); }
    // قائمة العملاء للاختيار: من فواتير المبيع ومن حسابات العملاء
    function custChoices() {
      if (F.cache.c1list) return F.cache.c1list;
      var g = {}, y0 = addD(today(), -365);
      F.D.invs.forEach(function (v) { if (v.c !== SALE && v.c !== SRET) return; var r = g[v.ck] || (g[v.ck] = { k: v.ck, name: v.name, net: 0, last: '' }); if (v.d >= y0) r.net += v.sign * v.net; if (v.c === SALE && v.d > r.last) r.last = v.d; });
      recvIds().forEach(function (a) { if (!g[a] && acc(a) && acc(a).leaf) g[a] = { k: a, name: accName(a), net: 0, last: '' }; });
      var list = Object.keys(g).map(function (k) { var r = g[k], a = acc(k); r.code = a ? a.code : ''; return r; }).sort(function (a, b) { return b.net - a.net; });
      return (F.cache.c1list = list);
    }
    function c1Known(k) { return k && (acc(k) || custChoices().some(function (r) { return r.k === k; })); }
    // آخر عميل اخترته يبقى مختاراً في كل تقارير «ملف العميل» حتى تغيّره
    function c1Last(k) { if (k) { F.lastC1 = k; try { localStorage.setItem('rk.finC1', k); } catch (e) {} } if (!F.lastC1) { try { F.lastC1 = localStorage.getItem('rk.finC1') || ''; } catch (e) { F.lastC1 = ''; } } return F.lastC1; }
    function c1Default(p) { var l = c1Last(); if (c1Known(l)) return l; if (c1Known(p.cust1)) return p.cust1; var list = custChoices(); return list.length ? list[0].k : ''; }
    function dowOf(d) { return new Date(d + 'T00:00:00Z').getUTCDay(); }
    function rnd(n, k) { var m = Math.pow(10, k == null ? 3 : k); return Math.round(n * m) / m; }
    function unitOf(item) { var it = T().item[item] || {}; return it.mu || it.unit || ''; }
    // سعر الوحدة (بوحدة البيع الأساسية للصنف) لسطر مبيع مدفوع، وإلا null (هدية أو بلا كمية)
    function unitPrice(x) { return x.s > 0 && x.qty > 0 && x.val > 0 ? x.val / x.qty : null; }

    // متوسط أيام السداد: كل دفعة دائنة تسدد أقدم دين مدين (FIFO)، ويُحسب متوسط الأيام موزوناً بالمبلغ للدفعات داخل الفترة
    function payDays(id, from, to) {
      var ls = F.D.byAcc[id] || [], q = [], w = 0, amt = 0;
      for (var i = 0; i < ls.length; i++) {
        var l = ls[i]; if (l.d > to) break;
        if (l.dr) q.push({ d: l.d, v: l.dr });
        var c = l.cr;
        while (c > 0.0005 && q.length) { var h = q[0], u = Math.min(h.v, c); if (l.d >= from) { w += u * days(h.d, l.d); amt += u; } h.v -= u; c -= u; if (h.v < 0.0005) q.shift(); }
      }
      return amt ? w / amt : null;
    }
    function overdue(id, asof, minAge) {
      var ls = (F.D.byAcc[id] || []).filter(function (l) { return l.d <= asof; }), debts = [], credit = 0, o = 0;
      ls.forEach(function (l) { if (l.dr) debts.push({ d: l.d, v: l.dr }); credit += l.cr; });
      debts.forEach(function (x) { var u = Math.min(x.v, credit); x.v -= u; credit -= u; if (x.v > 0.0005 && days(x.d, asof) >= minAge) o += x.v; });
      return o;
    }
    function maxBalance(id, from, to) {
      var b = balance([id], null, addD(from, -1)).close, mx = b;
      (F.D.byAcc[id] || []).forEach(function (l) { if (l.d < from || l.d > to) return; b += l.dr - l.cr; if (b > mx) mx = b; });
      return mx;
    }

    /* ---------- مؤشرات كل عميل وتقييمه ---------- */
    var EVAL_W = [['vol', 'الحجم', 25], ['prof', 'الربحية', 20], ['pay', 'السداد', 20], ['reg', 'الانتظام', 15], ['grow', 'النمو', 10], ['ret', 'المرتجعات', 10]];
    var EVAL_TIP = { vol: 'مشترياته قليلة مقارنة ببقية العملاء: فرصة لزيادة التشكيلة والكميات', prof: 'هامش الربح معه منخفض: راجع الأسعار والخصومات والهدايا', pay: 'السداد بطيء أو الدين قديم: تابع التحصيل وراجع حد الائتمان',
      reg: 'شراؤه غير منتظم: جدول زيارات ثابتاً وتواصل دوري', grow: 'مشترياته تتراجع عن الفترة السابقة: اعرف السبب وقدّم عرضاً لاستعادته', ret: 'مرتجعاته مرتفعة: راجع أسبابها (الصلاحية، الجودة، الكميات)' };
    function grade(s) { return s >= 80 ? 'ممتاز' : s >= 65 ? 'جيد جداً' : s >= 50 ? 'جيد' : s >= 35 ? 'مقبول' : 'ضعيف'; }
    function clamp(v) { return Math.max(0, Math.min(100, v)); }
    function pctRank(v, sorted) { if (sorted.length < 2) return 100; var i = 0; while (i < sorted.length && sorted[i] < v) i++; return i / (sorted.length - 1) * 100; }
    function custMetrics(p) {
      var key = 'cm:' + p.from + p.to + p.preset + JSON.stringify(p.flt || '');
      if (F.cache[key]) return F.cache[key];
      var pr = prevRange(p.from, p.to, p.preset), span = Math.max(1, days(p.from, p.to) + 1), months = monthsOf(p).map(function (m) { return m.m; });
      var g = {};
      var mk = function (x) { return g[x.v.ck] || (g[x.v.ck] = { k: x.v.ck, name: x.v.name, sales: 0, ret: 0, profit: 0, cost: 0, qty: 0, gift: 0, inv: {}, rinv: {}, items: {}, days: {}, mon: {}, first: '', last: '', reps: {}, pnet: 0 }); };
      facts('s', p.from, p.to, p.flt).forEach(function (x) {
        var r = mk(x);
        if (x.s > 0) { r.sales += x.val; r.inv[x.v.id] = 1; r.items[x.l.item] = 1; r.days[x.d] = 1; r.mon[x.d.slice(0, 7)] = 1; if (!r.first || x.d < r.first) r.first = x.d; if (x.d > r.last) r.last = x.d; if (x.v.ag) r.reps[x.v.ag] = 1; }
        else { r.ret += x.val; r.rinv[x.v.id] = 1; }
        r.profit += x.s * x.profit; r.cost += x.s * x.cost; r.qty += x.s * x.qty; if (x.gift) r.gift += x.s * x.gift;
      });
      facts('s', pr[0], pr[1], p.flt).forEach(function (x) { var r = g[x.v.ck]; if (r) r.pnet += x.s * x.val; else { r = mk(x); r.pnet += x.s * x.val; r.prevOnly = true; } });
      var coll = collections(p.from, p.to, '', true), fl = custFirstLast(), list = [];
      Object.keys(g).forEach(function (k) {
        var r = g[k], n = Object.keys(r.inv).length, net = r.sales - r.ret, ha = custHasAcc(k);
        var bal = ha ? balance([k], null, p.to).close : 0, od = ha && bal > 0.0005 ? overdue(k, p.to, 90) : 0, pd = ha ? payDays(k, p.from, p.to) : null;
        var dl = Object.keys(r.days).sort(), gaps = []; for (var i = 1; i < dl.length; i++) gaps.push(days(dl[i - 1], dl[i]));
        var o = { k: k, name: r.name, net: net, sales: r.sales, ret: r.ret, rp: pct(r.ret, r.sales), profit: r.profit, margin: pct(r.profit, net), cost: r.cost, qty: r.qty, gift: r.gift,
          n: n, rn: Object.keys(r.rinv).length, avg: n ? r.sales / n : 0, items: Object.keys(r.items).length, bdays: dl.length, mact: Object.keys(r.mon).length, mtot: months.length,
          first: (fl[k] || {}).first || r.first, last: (fl[k] || {}).last || r.last, since: r.last ? days(r.last, p.to) : '', gap: gaps.length ? sum(gaps, function (x) { return x; }) / gaps.length : '',
          pnet: r.pnet, ch: net - r.pnet, chp: r.pnet ? (net - r.pnet) / Math.abs(r.pnet) * 100 : '', coll: coll[k] || 0, cr: pct(coll[k] || 0, net), bal: ha ? bal : '', od: od, odp: bal > 0.0005 ? pct(od, bal) : 0,
          pd: pd, dso: ha && net > 0 && bal > 0 ? bal / (net / span) : (ha ? 0 : ''), lim: ha ? custLimit(k) || '' : '', reps: Object.keys(r.reps).map(repName).join('، '), prevOnly: !!r.prevOnly, _acc: ha ? k : null };
        list.push(o);
      });
      // التقييم: كل بُعد من 100، ثم مجموع موزون
      var act = list.filter(function (o) { return o.net > 0; }), nets = act.map(function (o) { return o.net; }).sort(function (a, b) { return a - b; }), mars = act.map(function (o) { return o.margin; }).sort(function (a, b) { return a - b; });
      list.forEach(function (o) {
        if (o.net <= 0) { o.s_vol = o.s_prof = o.s_pay = o.s_reg = o.s_grow = o.s_ret = 0; o.score = 0; o.grade = o.prevOnly ? 'متوقف' : 'بلا مبيعات'; o.tip = o.prevOnly ? 'اشترى في الفترة السابقة ولم يشترِ الآن: تواصل معه' : ''; return; }
        o.s_vol = pctRank(o.net, nets);
        o.s_prof = pctRank(o.margin, mars);
        var dsoS = o.dso === '' ? 100 : clamp(100 - (o.dso - 30) * 1.25);
        o.s_pay = o.bal === '' ? 100 : clamp(0.7 * dsoS + 0.3 * (100 - o.odp));
        o.s_reg = clamp((o.mtot ? o.mact / o.mtot : 1) * 100 * (o.since !== '' && o.since > 60 ? 0.5 : 1));
        o.s_grow = o.pnet > 0 ? clamp(50 + o.chp / 2) : 60;
        o.s_ret = clamp(100 - o.rp * 5);
        o.score = sum(EVAL_W, function (w) { return o['s_' + w[0]] * w[2]; }) / 100;
        o.grade = grade(o.score);
        var weak = EVAL_W.slice().sort(function (a, b) { return o['s_' + a[0]] - o['s_' + b[0]]; })[0];
        o.weak = weak[1];
        o.tip = o.since !== '' && o.since > 60 ? 'لم يشترِ منذ ' + o.since + ' يوماً: تواصل معه قبل أن تفقده' : o['s_' + weak[0]] < 50 ? EVAL_TIP[weak[0]] : 'عميل جيد: حافظ على مستوى الخدمة';
      });
      list.sort(function (a, b) { return b.net - a.net; });
      list.forEach(function (o, i) { o.rank = o.net > 0 ? i + 1 : ''; });
      return (F.cache[key] = list);
    }
    function c1Metrics(p, ck) { return custMetrics(Object.assign({}, p, { flt: null })).filter(function (o) { return o.k === ck; })[0]; }
    function c1Need(p) { var ck = c1Default(p); if (!ck) return { err: emptyR('لا يوجد عملاء') }; p.cust1 = ck; return { ck: ck, f: c1Filter(p, ck) }; }
    function c1Sub(ck) { var a = acc(ck); return custName(ck) + (a ? ' · ' + a.code : ''); }

    /* ======================= ملف العميل الواحد ======================= */
    R.c1_card = { cat: 'cust1', name: 'ملف العميل الكامل وتقييم التعامل', desc: 'كل شيء عن عميل واحد: مؤشرات البيع والربح والسداد والانتظام، وتقييم نجاح التعامل معه من 100 بستة أبعاد، والتوصية، والحركة الشهرية وأهم أصنافه', params: ['period', 'cust1'],
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        var o = c1Metrics(p, c.ck), all = custMetrics(Object.assign({}, p, { flt: null })), totNet = sum(all, function (x) { return Math.max(0, x.net); });
        if (!o) o = { net: 0, sales: 0, ret: 0, rp: 0, profit: 0, margin: 0, n: 0, avg: 0, items: 0, bdays: 0, mact: 0, mtot: monthsOf(p).length, first: '', last: '', since: '', gap: '', pnet: 0, chp: '', coll: 0, cr: 0, bal: custHasAcc(c.ck) ? balance([c.ck], null, p.to).close : '', od: 0, pd: null, dso: '', lim: custHasAcc(c.ck) ? custLimit(c.ck) : '', reps: '', score: 0, grade: 'بلا مبيعات', tip: 'لا توجد مبيعات له في هذه الفترة', gift: 0, rank: '' };
        var rows = [{ name: 'التقييم العام', _b: true, _hl: true }];
        rows.push({ name: 'درجة التعامل من 100', v: Math.round(o.score), t: o.grade, _fmt: 'int' });
        EVAL_W.forEach(function (w) { if (o['s_' + w[0]] !== undefined) rows.push({ name: '· ' + w[1] + ' (وزنه ' + w[2] + '%)', v: Math.round(o['s_' + w[0]]), t: grade(o['s_' + w[0]]), _fmt: 'int' }); });
        rows.push({ name: 'التوصية', t: o.tip });
        rows.push({ name: 'المبيعات والربح', _b: true, _hl: true });
        [['صافي المبيعات', o.net], ['المبيعات', o.sales], ['المرتجعات', o.ret], ['نسبة المرتجعات', o.rp, 'pct'], ['مجمل الربح', o.profit], ['هامش الربح', o.margin, 'pct'], ['تكلفة البضاعة المباعة له', o.cost],
          ['كمية الهدايا (بوحدة البيع)', o.gift, 'qty'], ['حصته من مبيعات الشركة', pct(Math.max(0, o.net), totNet), 'pct'], ['ترتيبه بين العملاء', o.rank, 'int', o.rank ? 'من ' + all.filter(function (x) { return x.net > 0; }).length : ''],
          ['الفترة السابقة', o.pnet], ['التغير عن الفترة السابقة', o.chp, 'pct']].forEach(function (k) { rows.push({ name: k[0], v: k[1], _fmt: k[2], t: k[3] || '' }); });
        rows.push({ name: 'النشاط والانتظام', _b: true, _hl: true });
        [['عدد فواتير المبيع', o.n, 'int'], ['فواتير المرتجع', o.rn, 'int'], ['متوسط الفاتورة', o.avg], ['عدد الأصناف التي اشتراها', o.items, 'int'], ['أيام الشراء', o.bdays, 'int'], ['الأشهر النشطة', o.mact, 'int', 'من ' + o.mtot + ' شهر'],
          ['متوسط الأيام بين مرتين شراء', o.gap, 'qty'], ['أول شراء', null, null, o.first], ['آخر شراء', null, null, o.last], ['أيام منذ آخر شراء', o.since, 'int'], ['المناديب', null, null, o.reps]].forEach(function (k) { rows.push({ name: k[0], v: k[1], _fmt: k[2], t: k[3] || '' }); });
        rows.push({ name: 'الحساب والسداد', _b: true, _hl: true });
        if (custHasAcc(c.ck)) {
          var lim = Number(o.lim) || 0, mx = maxBalance(c.ck, p.from, p.to);
          [['التحصيل في الفترة', o.coll], ['التحصيل/المبيعات', o.cr, 'pct'], ['الرصيد في نهاية الفترة', o.bal], ['أعلى رصيد خلال الفترة', mx], ['دين عمره أكثر من 90 يوماً', o.od], ['متوسط أيام السداد', o.pd === null ? '' : o.pd, 'qty'],
            ['الرصيد بأيام المبيعات (DSO)', o.dso, 'qty'], ['حد الائتمان', lim || ''], ['استخدام الحد', lim ? pct(o.bal, lim) : '', 'pct', lim && o.bal > lim ? 'تجاوز الحد' : '']].forEach(function (k) { rows.push({ name: k[0], v: k[1], _fmt: k[2], t: k[3] || '' }); });
          rows[rows.length - 1]._acc = c.ck;
        } else rows.push({ name: 'لا يوجد حساب دائن/مدين لهذا العميل في الدليل (عميل نقدي)' });
        rows.push({ name: 'الحركة الشهرية', _b: true, _hl: true });
        monthsOf(p).forEach(function (m) { var s = salesStats(m.a, m.b, c.f); rows.push({ name: m.label, v: s.net, t: s.n ? s.n + ' فاتورة · ربح ' + fk(s.profit) + ' · هامش ' + fp(pct(s.profit, s.net)) : '—' }); });
        rows.push({ name: 'أهم 10 أصناف', _b: true, _hl: true });
        salesBy(Object.assign({}, p, { flt: c.f }), function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }).sort(function (a, b) { return b.net - a.net; }).slice(0, 10)
          .forEach(function (r) { rows.push({ name: r.name, v: r.net, t: fq(r.qty) + ' ' + unitOf(r.k) + ' · ربح ' + fk(r.profit) + ' · هامش ' + fp(r.margin) }); });
        var res = { cols: [C('name', ''), C('v', 'القيمة', 'money'), C('t', 'ملاحظة')], rows: rows, subtitle: c1Sub(c.ck) + ' · التقييم: ' + o.grade + ' (' + fk(o.score) + '/100)',
          note: 'الأبعاد: الحجم والربحية بالمقارنة مع بقية العملاء، والسداد من الرصيد بأيام المبيعات وقِدم الدين، والانتظام من الأشهر النشطة وحداثة آخر شراء، والنمو مقابل الفترة السابقة، والمرتجعات من نسبتها.' };
        res.chart = { type: 'bar', x: 'name', y: ['v'], yl: ['الدرجة'], rowsOverride: EVAL_W.map(function (w) { return { name: w[1], v: Math.round(o['s_' + w[0]] || 0) }; }) };
        return res;
      } };

    R.c1_month = { cat: 'cust1', name: 'حركة العميل شهرياً', desc: 'لكل شهر: الفواتير والمبيعات والمرتجعات والصافي والربح والهامش والأصناف والتحصيل ورصيد آخر الشهر', params: ['period', 'cust1', 'flt'], fdims: C1_F,
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        var ha = custHasAcc(c.ck), rows = monthsOf(p).map(function (m) {
          var s = salesStats(m.a, m.b, c.f), it = {}; facts('s', m.a, m.b, c.f).forEach(function (x) { if (x.s > 0) it[x.l.item] = 1; });
          var cl = ha ? (collections(m.a, m.b, '', true)[c.ck] || 0) : '';
          return { name: m.label, n: s.n, sales: s.sales, ret: s.ret, net: s.net, profit: s.profit, margin: pct(s.profit, s.net), items: Object.keys(it).length, qty: s.nqty, coll: cl, bal: ha ? balance([c.ck], null, m.b).close : '' };
        });
        var cols = [C('name', 'الشهر'), C('n', 'الفواتير', 'int'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('net', 'الصافي', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'),
          C('items', 'الأصناف', 'int'), C('qty', 'صافي الكمية', 'qty'), C('coll', 'التحصيل', 'money'), C('bal', 'الرصيد آخر الشهر', 'money')];
        var t = sumRow(rows, cols); t.items = ''; t.bal = rows.length ? rows[rows.length - 1].bal : '';
        return withNote({ cols: cols, rows: rows, total: t, subtitle: c1Sub(c.ck), chart: { type: 'bar', x: 'name', y: ['net', 'profit'], yl: ['الصافي', 'الربح'] } }, p);
      } };

    function itemPriceStats(list) {
      var g = {};
      list.forEach(function (x) {
        var r = g[x.l.item] || (g[x.l.item] = { item: x.l.item, net: 0, sales: 0, ret: 0, profit: 0, qty: 0, rqty: 0, gift: 0, n: {}, prices: {}, pmin: null, pmax: null, last: '', lastp: null, firstp: null, first: '' });
        if (x.s > 0) { r.sales += x.val; r.qty += x.qty; r.n[x.v.id] = 1; } else { r.ret += x.val; r.rqty += x.qty; }
        r.net += x.s * x.val; r.profit += x.s * x.profit; if (x.gift) r.gift += x.s * x.gift;
        var up = unitPrice(x);
        if (up !== null) {
          var k = rnd(up, 3); r.prices[k] = (r.prices[k] || 0) + 1;
          if (r.pmin === null || up < r.pmin) r.pmin = up; if (r.pmax === null || up > r.pmax) r.pmax = up;
          if (x.v.dt >= r.last) { r.last = x.v.dt; r.lastp = up; } if (!r.first || x.v.dt < r.first) { r.first = x.v.dt; r.firstp = up; }
        }
      });
      return Object.keys(g).map(function (k) {
        var r = g[k], np = Object.keys(r.prices).length;
        return { item: r.item, name: itemName(r.item), unit: unitOf(r.item), n: Object.keys(r.n).length, qty: r.qty - r.rqty, sales: r.sales, ret: r.ret, net: r.net, profit: r.profit, margin: pct(r.profit, r.net), gift: r.gift,
          avgp: r.qty ? r.sales / r.qty : 0, pmin: r.pmin === null ? '' : r.pmin, pmax: r.pmax === null ? '' : r.pmax, np: np, spread: np > 1 ? r.pmax - r.pmin : 0, spreadp: np > 1 && r.pmin ? (r.pmax - r.pmin) / r.pmin * 100 : 0,
          firstp: r.firstp === null ? '' : r.firstp, lastp: r.lastp === null ? '' : r.lastp, last: r.last.slice(0, 10), upp: r.qty ? r.profit / (r.qty - r.rqty || r.qty) : 0 };
      });
    }
    R.c1_items = { cat: 'cust1', name: 'أصناف العميل: الكميات والأسعار والأرباح', desc: 'كل صنف اشتراه: الكمية والقيمة والربح والهامش والهدايا، ومتوسط السعر وأقل وأعلى سعر وأول وآخر سعر وعدد الأسعار المختلفة', params: ['period', 'cust1', 'top', 'flt'], fdims: C1_F,
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        var rows = itemPriceStats(facts('s', p.from, p.to, c.f)).sort(function (a, b) { return b.net - a.net; });
        rows.forEach(function (r) { if (r.np > 1) r._hl = true; r.share = 0; });
        var tn = sum(rows, 'net'); rows.forEach(function (r) { r.share = pct(r.net, tn); });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة'), C('n', 'الفواتير', 'int'), C('qty', 'صافي الكمية', 'qty'), C('gift', 'هدايا', 'qty'), C('net', 'الصافي', 'money'), C('share', 'الحصة', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'),
          C('upp', 'ربح الوحدة', 'money'), C('avgp', 'متوسط السعر', 'money'), C('pmin', 'أقل سعر', 'money'), C('pmax', 'أعلى سعر', 'money'), C('np', 'عدد الأسعار', 'int'), C('firstp', 'أول سعر', 'money'), C('lastp', 'آخر سعر', 'money'), C('last', 'آخر شراء')];
        var t = sumRow(rows, cols); ['pmin', 'pmax', 'np', 'firstp', 'lastp', 'upp'].forEach(function (k) { t[k] = ''; }); t.qty = ''; t.gift = '';
        return withNote(topN({ cols: cols, rows: rows, total: t, subtitle: c1Sub(c.ck), note: 'الصفوف المظللة: أصناف بيعت لهذا العميل بأكثر من سعر. الأسعار بوحدة البيع الأساسية للصنف وبعد الخصم.', chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['الصافي'], limit: 12 } }, p), p);
      } };

    // كل سعر مختلف لكل صنف: الكمية والقيمة والربح والهامش والتواريخ
    function priceRows(list, withCust) {
      var g = {};
      list.forEach(function (x) {
        var up = unitPrice(x); if (up === null) return;
        var gk = (withCust ? x.v.ck + '|' : '') + x.l.item, r = g[gk] || (g[gk] = { ck: x.v.ck, cname: x.v.name, item: x.l.item, pr: {} });
        var k = rnd(up, 3), o = r.pr[k] || (r.pr[k] = { p: up, qty: 0, val: 0, profit: 0, n: {}, first: x.d, last: x.d, list: {} });
        o.qty += x.qty; o.val += x.val; o.profit += x.profit; o.n[x.v.id] = 1; if (x.d < o.first) o.first = x.d; if (x.d > o.last) o.last = x.d; if (x.l.p) o.list[rnd(x.l.p, 3) + ' / ' + (x.l.un || '')] = 1;
      });
      return Object.keys(g).map(function (k) { var r = g[k]; r.list = Object.keys(r.pr).map(function (pk) { return r.pr[pk]; }).sort(function (a, b) { return a.p - b.p; }); return r; }).filter(function (r) { return r.list.length > 1; });
    }
    R.c1_prices = { cat: 'cust1', name: 'أصناف بيعت للعميل بأكثر من سعر', desc: 'لكل صنف بيع له بأسعار مختلفة: كل سعر وكميته وقيمته وربحه وهامشه وعدد الفواتير وأول وآخر تاريخ، والفرق عن أقل سعر', params: ['period', 'cust1', 'flt'], fdims: C1_F,
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        var groups = priceRows(facts('s', p.from, p.to, c.f), false).sort(function (a, b) { return sum(b.list, 'val') - sum(a.list, 'val'); }), rows = [];
        groups.forEach(function (gp) {
          var mn = gp.list[0].p, mx = gp.list[gp.list.length - 1].p, q = sum(gp.list, 'qty'), v = sum(gp.list, 'val'), pf = sum(gp.list, 'profit');
          rows.push({ name: itemName(gp.item) + ' (' + unitOf(gp.item) + ')', p: '', qty: q, val: v, profit: pf, margin: pct(pf, v), n: '', diff: mx - mn, diffp: mn ? (mx - mn) / mn * 100 : 0, lost: sum(gp.list, function (o) { return (mx - o.p) * o.qty; }), _b: true, _hl: true });
          gp.list.forEach(function (o) { rows.push({ name: '   سعر ' + fm(o.p), p: o.p, qty: o.qty, val: o.val, profit: o.profit, margin: pct(o.profit, o.val), n: Object.keys(o.n).length, diff: o.p - mn, diffp: mn ? (o.p - mn) / mn * 100 : 0, first: o.first, last: o.last, lst: Object.keys(o.list).join('، ') }); });
        });
        var cols = [C('name', 'الصنف / السعر'), C('p', 'السعر', 'money'), C('qty', 'الكمية', 'qty'), C('val', 'القيمة', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('n', 'الفواتير', 'int'),
          C('diff', 'الفرق عن أقل سعر', 'money'), C('diffp', 'الفرق %', 'pct'), C('lost', 'الفرق لو بيع كله بأعلى سعر', 'money'), C('first', 'من'), C('last', 'إلى'), C('lst', 'السعر في الفاتورة / الوحدة')];
        var head = rows.filter(function (r) { return r._b; }), t = { name: 'الإجمالي (' + head.length + ' صنف)', _b: true, qty: sum(head, 'qty'), val: sum(head, 'val'), profit: sum(head, 'profit'), lost: sum(head, 'lost') }; t.margin = pct(t.profit, t.val);
        var res = { cols: cols, rows: rows, total: t, subtitle: c1Sub(c.ck), note: 'السعر = صافي قيمة السطر ÷ الكمية بوحدة البيع الأساسية للصنف (تُستبعد الهدايا). «الفرق لو بيع كله بأعلى سعر» = ما كان سيزيد لو بيعت كل الكميات بأعلى سعر بيع له.' };
        if (!rows.length) res.empty = 'كل الأصناف بيعت لهذا العميل بسعر واحد في هذه الفترة';
        return withNote(res, p);
      } };

    R.c1_price_log = { cat: 'cust1', name: 'سجل أسعار العميل سطراً بسطر', desc: 'كل سطر بيع له بالتاريخ: الصنف والوحدة والكمية والسعر والتكلفة والربح والهامش، وتغير السعر عن المرة السابقة لنفس الصنف', params: ['period', 'cust1', 'flt'], fdims: C1_F,
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        var list = facts('s', p.from, p.to, c.f).slice().sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : a.v.dt > b.v.dt ? 1 : 0; }), prev = {}, rows = [];
        list.forEach(function (x) {
          var up = unitPrice(x), pv = prev[x.l.item];
          var r = { d: String(x.v.dt || x.d).slice(0, 16), no: x.v.no, type: x.s > 0 ? 'مبيع' : 'مرتجع', name: itemName(x.l.item), un: x.l.un || '', q: x.s * x.l.q, lp: x.l.p || '', val: x.s * x.val, cost: x.s * x.cost, profit: x.s * x.profit, margin: pct(x.profit, x.val),
            up: up === null ? '' : up, ch: up !== null && pv != null ? up - pv : '', chp: up !== null && pv ? (up - pv) / pv * 100 : '', gift: x.gift || '', rep: x.v.ag ? repName(x.v.ag) : '' };
          if (up !== null) { if (pv != null && Math.abs(up - pv) > 0.0005) r._hl = true; prev[x.l.item] = up; }
          if (!up && x.s > 0 && x.qty > 0) r.type = 'هدية';
          rows.push(r);
        });
        rows.reverse();
        var cols = [C('d', 'التاريخ'), C('no', 'الفاتورة'), C('type', 'النوع'), C('name', 'الصنف'), C('un', 'الوحدة'), C('q', 'الكمية', 'qty'), C('lp', 'السعر في الفاتورة', 'money'), C('up', 'سعر الوحدة الأساسية', 'money'),
          C('ch', 'تغير السعر', 'money'), C('chp', 'التغير %', 'pct'), C('val', 'القيمة', 'money'), C('cost', 'التكلفة', 'money'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('gift', 'هدية', 'qty'), C('rep', 'المندوب')];
        var t = sumRow(rows, cols); t.q = ''; t.lp = ''; t.up = ''; t.ch = ''; t.gift = ''; t.margin = pct(t.profit, t.val);
        return withNote({ cols: cols, rows: rows, total: t, subtitle: c1Sub(c.ck), note: 'الأحدث أولاً. الصفوف المظللة: تغيّر فيها سعر الصنف عن آخر مرة بيع لهذا العميل.' }, p);
      } };

    R.c1_invoices = { cat: 'cust1', name: 'فواتير العميل', desc: 'كل فاتورة مبيع ومرتجع: التاريخ والرقم والأصناف والكمية والقيمة والربح والهامش والمندوب والمخزن والمستخدم', params: ['period', 'cust1', 'flt'], fdims: C1_F,
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        var rows = invAgg(p.from, p.to, c.f).sort(function (a, b) { return a.v.dt < b.v.dt ? 1 : -1; }).map(function (r) {
          return { d: String(r.v.dt).slice(0, 16), no: r.v.no, type: r.s > 0 ? 'مبيع' : 'مرتجع', items: Object.keys(r.items).length, lines: r.lines, qty: r.s * r.qty, val: r.s * r.val, profit: r.s * r.profit, margin: pct(r.profit, r.val),
            rep: r.v.ag ? repName(r.v.ag) : '', st: (T().st[r.v.st] || {}).name || '', u: (T().us[r.v.u] || {}).name || '', note: r.v.note || '', _hl: r.s < 0 };
        });
        var cols = [C('d', 'التاريخ'), C('no', 'الرقم'), C('type', 'النوع'), C('items', 'الأصناف', 'int'), C('lines', 'الأسطر', 'int'), C('qty', 'الكمية', 'qty'), C('val', 'القيمة', 'money'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct'),
          C('rep', 'المندوب'), C('st', 'المخزن'), C('u', 'المستخدم'), C('note', 'البيان')];
        var t = sumRow(rows, cols); t.items = ''; t.lines = ''; t.margin = pct(t.profit, t.val);
        return withNote({ cols: cols, rows: rows, total: t, subtitle: c1Sub(c.ck) }, p);
      } };

    R.c1_payments = { cat: 'cust1', name: 'سداد العميل وحركة حسابه', desc: 'كل حركة على حساب العميل: فواتير ودفعات وقيود، مع الرصيد المتراكم وأيام السداد ومتوسطها', params: ['period', 'cust1'],
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        if (!custHasAcc(c.ck)) return emptyR('هذا العميل ليس له حساب في الدليل (عميل نقدي)');
        var b = balance([c.ck], null, addD(p.from, -1)).close, rows = [{ d: '', name: 'رصيد أول المدة', bal: b, _b: true }];
        (F.D.byAcc[c.ck] || []).forEach(function (l) {
          if (l.d < p.from || l.d > p.to) return;
          b += l.dr - l.cr;
          var kind = l.k === 'i' ? 'فاتورة' : l.k === 'r' ? 'سند قبض' : l.k === 'p' ? 'سند دفع' : l.k === 'o' ? 'افتتاحي' : 'قيد';
          rows.push({ d: l.d, name: kind + ' · ' + (l.btn || '') + (l.no ? ' ' + l.no : ''), note: l.ld || l.ed || '', dr: l.dr || '', cr: l.cr || '', bal: b, _hl: !!l.cr });
        });
        var pd = payDays(c.ck, p.from, p.to), od = overdue(c.ck, p.to, 90);
        var cols = [C('d', 'التاريخ'), C('name', 'الحركة'), C('note', 'البيان'), C('dr', 'مدين (عليه)', 'money'), C('cr', 'دائن (سدّد)', 'money'), C('bal', 'الرصيد', 'money')];
        var t = sumRow(rows.slice(1), cols); t.bal = b;
        return { cols: cols, rows: rows, total: t, subtitle: c1Sub(c.ck), note: 'متوسط أيام السداد في الفترة: ' + (pd === null ? '—' : fq(pd) + ' يوماً') + ' · دين عمره أكثر من 90 يوماً: ' + fm(od) + ' · الصفوف المظللة: دفعات' };
      } };

    R.c1_aging = { cat: 'cust1', name: 'الفواتير غير المسددة للعميل وأعمارها', desc: 'كل فاتورة (حركة مدينة) لم تُسدَّد بالكامل: المتبقي منها وعمره بالأيام وشريحته، بعد خصم الدفعات من الأقدم', params: ['asof', 'cust1'],
      run: function (p) {
        p.from = p.from || p.asof; var c = c1Need(p); if (c.err) return c.err;
        if (!custHasAcc(c.ck)) return emptyR('هذا العميل ليس له حساب في الدليل (عميل نقدي)');
        var ls = (F.D.byAcc[c.ck] || []).filter(function (l) { return l.d <= p.asof; }), debts = [], credit = 0;
        ls.forEach(function (l) { if (l.dr) debts.push({ l: l, v: l.dr }); credit += l.cr; });
        debts.forEach(function (x) { var u = Math.min(x.v, credit); x.v -= u; credit -= u; });
        var rows = debts.filter(function (x) { return x.v > 0.0005; }).map(function (x) { var age = days(x.l.d, p.asof); return { d: x.l.d, name: (x.l.btn || '') + (x.l.no ? ' ' + x.l.no : ''), orig: x.l.dr, rem: x.v, paid: x.l.dr - x.v, age: age, band: age <= 30 ? '0-30' : age <= 60 ? '31-60' : age <= 90 ? '61-90' : age <= 120 ? '91-120' : 'أكثر من 120', _hl: age > 90 }; }).reverse();
        var cols = [C('d', 'التاريخ'), C('name', 'الحركة'), C('orig', 'المبلغ', 'money'), C('paid', 'المسدد منه', 'money'), C('rem', 'المتبقي', 'money'), C('age', 'العمر (يوم)', 'int'), C('band', 'الشريحة')];
        var t = sumRow(rows, cols); t.age = '';
        var res = { cols: cols, rows: rows, total: t, subtitle: c1Sub(c.ck) + ' · في ' + p.asof, note: credit > 0.0005 ? 'للعميل رصيد دائن مقدّم: ' + fm(credit) : 'الصفوف المظللة: أعمارها أكثر من 90 يوماً' };
        if (!rows.length) res.empty = 'لا توجد مبالغ غير مسددة على هذا العميل في ' + p.asof;
        return res;
      } };

    R.c1_pattern = { cat: 'cust1', name: 'نمط شراء العميل', desc: 'متى يشتري: حسب يوم الأسبوع وساعة اليوم، والفجوات بين مرات الشراء، وأطول انقطاع', params: ['period', 'cust1', 'flt'], fdims: C1_F,
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        var inv = invAgg(p.from, p.to, c.f).filter(function (r) { return r.s > 0; }), dw = {}, hr = {}, ds = {};
        inv.forEach(function (r) { var w = dowOf(r.v.d), h = Number(String(r.v.dt).slice(11, 13)); (dw[w] = dw[w] || { n: 0, v: 0 }); dw[w].n++; dw[w].v += r.val; if (!isNaN(h)) { (hr[h] = hr[h] || { n: 0, v: 0 }); hr[h].n++; hr[h].v += r.val; } ds[r.v.d] = 1; });
        var rows = [{ name: 'حسب يوم الأسبوع', _b: true, _hl: true }], tv = sum(inv, 'val');
        [6, 0, 1, 2, 3, 4, 5].forEach(function (w) { var o = dw[w] || { n: 0, v: 0 }; rows.push({ name: DOW[w], n: o.n, v: o.v, share: pct(o.v, tv) }); });
        rows.push({ name: 'حسب ساعة اليوم', _b: true, _hl: true });
        Object.keys(hr).map(Number).sort(function (a, b) { return a - b; }).forEach(function (h) { var o = hr[h]; rows.push({ name: ('0' + h).slice(-2) + ':00', n: o.n, v: o.v, share: pct(o.v, tv) }); });
        var dl = Object.keys(ds).sort(), gaps = []; for (var i = 1; i < dl.length; i++) gaps.push({ a: dl[i - 1], b: dl[i], g: days(dl[i - 1], dl[i]) });
        rows.push({ name: 'الفجوات بين مرات الشراء', _b: true, _hl: true });
        var gv = gaps.map(function (x) { return x.g; });
        rows.push({ name: 'عدد أيام الشراء', n: dl.length });
        rows.push({ name: 'متوسط الفجوة (يوم)', n: gv.length ? sum(gv, function (x) { return x; }) / gv.length : '' });
        rows.push({ name: 'الوسيط (يوم)', n: gv.length ? median(gv) : '' });
        if (dl.length) rows.push({ name: 'منذ آخر شراء حتى نهاية الفترة (يوم)', n: days(dl[dl.length - 1], p.to) });
        gaps.sort(function (a, b) { return b.g - a.g; }).slice(0, 5).forEach(function (x) { rows.push({ name: 'انقطاع: ' + x.a + ' ← ' + x.b, n: x.g }); });
        var res = { cols: [C('name', ''), C('n', 'العدد / الأيام', 'qty'), C('v', 'القيمة', 'money'), C('share', 'الحصة', 'pct')], rows: rows, subtitle: c1Sub(c.ck) };
        res.chart = { type: 'bar', x: 'name', y: ['v'], yl: ['المبيعات'], rowsOverride: [6, 0, 1, 2, 3, 4, 5].map(function (w) { return { name: DOW[w], v: (dw[w] || { v: 0 }).v }; }) };
        if (!inv.length) res.empty = 'لا توجد مبيعات له في هذه الفترة';
        return withNote(res, p);
      } };

    R.c1_compare = { cat: 'cust1', name: 'أصناف العميل مقابل الفترة السابقة', desc: 'لكل صنف: الكمية والقيمة الآن وفي الفترة السابقة والتغير، مع تمييز الأصناف الجديدة والتي توقف عن شرائها', params: ['period', 'cust1', 'flt'], fdims: C1_F,
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        var pr = prevRange(p.from, p.to, p.preset), a = {}, b = {};
        itemPriceStats(facts('s', p.from, p.to, c.f)).forEach(function (r) { a[r.item] = r; });
        itemPriceStats(facts('s', pr[0], pr[1], c.f)).forEach(function (r) { b[r.item] = r; });
        var keys = uniq(Object.keys(a).concat(Object.keys(b)));
        var rows = keys.map(function (k) { var x = a[k] || { qty: 0, net: 0, profit: 0, avgp: 0 }, y = b[k] || { qty: 0, net: 0, profit: 0, avgp: 0 };
          var st = !b[k] ? 'جديد' : !a[k] ? 'توقف' : x.net > y.net * 1.1 ? 'زاد' : x.net < y.net * 0.9 ? 'نقص' : 'ثابت';
          return { name: itemName(k), unit: unitOf(k), qty: x.qty, pqty: y.qty, net: x.net, pnet: y.net, ch: x.net - y.net, chp: y.net ? (x.net - y.net) / Math.abs(y.net) * 100 : '', avgp: x.avgp || '', pavgp: y.avgp || '', pch: x.avgp && y.avgp ? (x.avgp - y.avgp) / y.avgp * 100 : '', st: st, _hl: st === 'توقف' || st === 'جديد' };
        }).sort(function (x, y) { return x.ch - y.ch; });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة'), C('st', 'الحالة'), C('qty', 'الكمية الآن', 'qty'), C('pqty', 'الكمية سابقاً', 'qty'), C('net', 'القيمة الآن', 'money'), C('pnet', 'القيمة سابقاً', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct'),
          C('avgp', 'متوسط السعر الآن', 'money'), C('pavgp', 'متوسط السعر سابقاً', 'money'), C('pch', 'تغير السعر %', 'pct')];
        var t = sumRow(rows, cols); t.qty = ''; t.pqty = ''; t.avgp = ''; t.pavgp = ''; t.chp = t.pnet ? (t.net - t.pnet) / Math.abs(t.pnet) * 100 : '';
        var nNew = rows.filter(function (r) { return r.st === 'جديد'; }).length, nStop = rows.filter(function (r) { return r.st === 'توقف'; }).length;
        return withNote({ cols: cols, rows: rows, total: t, subtitle: c1Sub(c.ck), note: 'الفترة السابقة: ' + pr[0] + ' إلى ' + pr[1] + ' · أصناف جديدة ' + nNew + ' · أصناف توقف عنها ' + nStop }, p);
      } };

    R.c1_returns = { cat: 'cust1', name: 'مرتجعات العميل', desc: 'الأصناف التي أرجعها: الكمية والقيمة ونسبتها من مبيعات الصنف له، وعدد فواتير المرتجع وتواريخها', params: ['period', 'cust1', 'flt'], fdims: C1_F,
      run: function (p) {
        var c = c1Need(p); if (c.err) return c.err;
        var g = {};
        facts('s', p.from, p.to, c.f).forEach(function (x) { var r = g[x.l.item] || (g[x.l.item] = { sales: 0, sq: 0, ret: 0, rq: 0, n: {}, last: '' }); if (x.s > 0) { r.sales += x.val; r.sq += x.qty; } else { r.ret += x.val; r.rq += x.qty; r.n[x.v.id] = 1; if (x.d > r.last) r.last = x.d; } });
        var rows = Object.keys(g).filter(function (k) { return g[k].ret || g[k].rq; }).map(function (k) { var r = g[k]; return { name: itemName(k), unit: unitOf(k), rq: r.rq, ret: r.ret, sq: r.sq, sales: r.sales, rp: pct(r.ret, r.sales), n: Object.keys(r.n).length, last: r.last }; }).sort(function (a, b) { return b.ret - a.ret; });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة'), C('rq', 'كمية المرتجع', 'qty'), C('ret', 'قيمة المرتجع', 'money'), C('sq', 'كمية المبيع', 'qty'), C('sales', 'قيمة المبيع', 'money'), C('rp', 'المرتجع من المبيع %', 'pct'), C('n', 'فواتير المرتجع', 'int'), C('last', 'آخر مرتجع')];
        var t = sumRow(rows, cols); t.rq = ''; t.sq = ''; t.rp = pct(t.ret, t.sales);
        var res = withNote({ cols: cols, rows: rows, total: t, subtitle: c1Sub(c.ck), chart: { type: 'hbar', x: 'name', y: ['ret'], yl: ['المرتجع'], limit: 10 } }, p);
        if (!rows.length) res.empty = 'لا توجد مرتجعات لهذا العميل في هذه الفترة';
        return res;
      } };

    /* ======================= كل العملاء ======================= */
    R.cust_eval = { cat: 'cust', name: 'تقييم العملاء ومدى نجاح التعامل', desc: 'لكل عميل درجة من 100 بستة أبعاد (الحجم، الربحية، السداد، الانتظام، النمو، المرتجعات) والتقدير ونقطة الضعف والتوصية', params: ['period', 'top', 'flt'], fdims: CU_F,
      sel: [['grade', 'التقدير', [['all', 'الكل'], ['ممتاز', 'ممتاز'], ['جيد جداً', 'جيد جداً'], ['جيد', 'جيد'], ['مقبول', 'مقبول'], ['ضعيف', 'ضعيف'], ['متوقف', 'متوقف']]]],
      run: function (p) {
        var rows = custMetrics(p).filter(function (o) { return (o.net > 0 || o.prevOnly) && (!p.grade || p.grade === 'all' || o.grade === p.grade); }).map(function (o) { return Object.assign({}, o, { _c1: o.k }); }).sort(function (a, b) { return b.score - a.score || b.pnet - a.pnet; });
        rows.forEach(function (r, i) { r.erank = r.net > 0 ? i + 1 : ''; if (r.grade === 'ضعيف' || r.grade === 'متوقف') r._hl = true; });
        var cols = [C('erank', 'الترتيب', 'int'), C('name', 'العميل'), C('score', 'الدرجة', 'int'), C('grade', 'التقدير'), C('s_vol', 'الحجم', 'int'), C('s_prof', 'الربحية', 'int'), C('s_pay', 'السداد', 'int'), C('s_reg', 'الانتظام', 'int'), C('s_grow', 'النمو', 'int'), C('s_ret', 'المرتجعات', 'int'),
          C('net', 'صافي المبيعات', 'money'), C('margin', 'الهامش', 'pct'), C('bal', 'الرصيد', 'money'), C('since', 'أيام منذ آخر شراء', 'int'), C('weak', 'نقطة الضعف'), C('tip', 'التوصية')];
        var t = { name: 'الإجمالي (' + rows.length + ' عميل)', _b: true, net: sum(rows, 'net'), bal: sum(rows, function (r) { return Number(r.bal) || 0; }) }; t.margin = pct(sum(rows, 'profit'), t.net);
        var gs = {}; rows.forEach(function (r) { gs[r.grade] = (gs[r.grade] || 0) + 1; });
        return withNote(topN({ cols: cols, rows: rows, total: t, note: 'التوزيع: ' + Object.keys(gs).map(function (k) { return k + ' ' + gs[k]; }).join(' · ') + ' · الأوزان: ' + EVAL_W.map(function (w) { return w[1] + ' ' + w[2] + '%'; }).join('، '),
          chart: { type: 'bar', x: 'name', y: ['v'], yl: ['عدد العملاء'], rowsOverride: ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'ضعيف', 'متوقف'].map(function (k) { return { name: k, v: gs[k] || 0 }; }) } }, p), p);
      } };
    R.cust_grades = { cat: 'cust', name: 'شرائح العملاء حسب التقييم', desc: 'كم عميلاً في كل تقدير (ممتاز، جيد جداً…)، ومبيعاتهم وربحهم وحصتهم وأرصدتهم ومتوسط درجاتهم', params: ['period', 'flt'], fdims: CU_F,
      run: function (p) {
        var g = {}, list = custMetrics(p).filter(function (o) { return o.net || o.prevOnly; });
        list.forEach(function (o) { var r = g[o.grade] || (g[o.grade] = { name: o.grade, n: 0, net: 0, profit: 0, bal: 0, sc: 0, pnet: 0 }); r.n++; r.net += o.net; r.profit += o.profit; r.bal += Number(o.bal) || 0; r.sc += o.score; r.pnet += o.pnet; });
        var order = ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'ضعيف', 'متوقف', 'بلا مبيعات'], tn = sum(list, 'net');
        var rows = order.filter(function (k) { return g[k]; }).map(function (k) { var r = g[k]; r.share = pct(r.net, tn); r.margin = pct(r.profit, r.net); r.avgsc = r.sc / r.n; r.avgnet = r.net / r.n; return r; });
        var cols = [C('name', 'التقدير'), C('n', 'العملاء', 'int'), C('net', 'صافي المبيعات', 'money'), C('share', 'الحصة', 'pct'), C('pnet', 'الفترة السابقة', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('avgnet', 'متوسط العميل', 'money'), C('bal', 'الأرصدة', 'money'), C('avgsc', 'متوسط الدرجة', 'qty')];
        var t = sumRow(rows, cols); t.avgnet = t.n ? t.net / t.n : 0; t.avgsc = '';
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] } }, p);
      } };

    R.cust_multi_price = { cat: 'cust', name: 'أصناف بيعت للعميل الواحد بأكثر من سعر (كل العملاء)', desc: 'لكل عميل وصنف بيع له بأسعار مختلفة: عدد الأسعار وأقلها وأعلاها والفرق ونسبته والكمية والقيمة والربح، والفرق لو بيع كله بأعلى سعر', params: ['period', 'top', 'flt'], fdims: CU_F,
      sel: [['minsp', 'أقل فرق', [['0', 'أي فرق'], ['1', '1% فأكثر'], ['3', '3% فأكثر'], ['5', '5% فأكثر'], ['10', '10% فأكثر']]]],
      run: function (p) {
        var mn = Number(p.minsp || 0);
        var rows = priceRows(facts('s', p.from, p.to, p.flt), true).map(function (r) {
          var a = r.list[0].p, b = r.list[r.list.length - 1].p, v = sum(r.list, 'val'), pf = sum(r.list, 'profit');
          return { cust: r.cname, name: itemName(r.item), unit: unitOf(r.item), np: r.list.length, pmin: a, pmax: b, diff: b - a, diffp: a ? (b - a) / a * 100 : 0, qty: sum(r.list, 'qty'), val: v, profit: pf, margin: pct(pf, v),
            lost: sum(r.list, function (o) { return (b - o.p) * o.qty; }), prices: r.list.map(function (o) { return fm(o.p) + ' × ' + fq(o.qty); }).join(' | '), _acc: acc(r.ck) ? r.ck : null };
        }).filter(function (r) { return r.diffp >= mn; }).sort(function (a, b) { return b.lost - a.lost; });
        var cols = [C('cust', 'العميل'), C('name', 'الصنف'), C('unit', 'الوحدة'), C('np', 'عدد الأسعار', 'int'), C('pmin', 'أقل سعر', 'money'), C('pmax', 'أعلى سعر', 'money'), C('diff', 'الفرق', 'money'), C('diffp', 'الفرق %', 'pct'),
          C('qty', 'الكمية', 'qty'), C('val', 'القيمة', 'money'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('lost', 'الفرق لو بيع كله بأعلى سعر', 'money'), C('prices', 'الأسعار × الكميات', 'long')];
        var t = sumRow(rows, cols); t.np = ''; t.qty = ''; t.margin = pct(t.profit, t.val); t.cust = 'الإجمالي (' + rows.length + ')';
        var res = withNote(topN({ cols: cols, rows: rows, total: t, note: 'اضغط على صف لفتح كشف حساب العميل. للتفصيل الكامل لعميل واحد استعمل «ملف العميل ← أصناف بيعت للعميل بأكثر من سعر».' }, p), p);
        if (!rows.length) res.empty = 'لم يُبع أي صنف لنفس العميل بأكثر من سعر في هذه الفترة';
        return res;
      } };

    R.cust_item_price = { cat: 'cust', name: 'سعر الصنف لكل عميل مقارنة بمتوسط الشركة', desc: 'لصنف أو أكثر: متوسط سعر البيع لكل عميل والفرق عن متوسط الشركة، وأقل وأعلى سعر له، والكمية والربح والهامش', params: ['period', 'flt'], fdims: CU_F,
      run: function (p) {
        var list = facts('s', p.from, p.to, p.flt), byItem = {}, g = {};
        list.forEach(function (x) { var up = unitPrice(x); if (up === null) return; var it = byItem[x.l.item] || (byItem[x.l.item] = { v: 0, q: 0 }); it.v += x.val; it.q += x.qty;
          var k = x.l.item + '|' + x.v.ck, r = g[k] || (g[k] = { item: x.l.item, ck: x.v.ck, cname: x.v.name, v: 0, q: 0, pf: 0, mn: null, mx: null, n: {} }); r.v += x.val; r.q += x.qty; r.pf += x.profit; r.n[x.v.id] = 1; if (r.mn === null || up < r.mn) r.mn = up; if (r.mx === null || up > r.mx) r.mx = up; });
        var items = Object.keys(byItem).sort(function (a, b) { return byItem[b].v - byItem[a].v; }), rows = [];
        var hasItem = hasItemF(p.flt), lim = hasItem ? items.length : Math.min(items.length, 15);
        items.slice(0, lim).forEach(function (it) {
          var avg = byItem[it].q ? byItem[it].v / byItem[it].q : 0, sub = Object.keys(g).filter(function (k) { return g[k].item === it; }).map(function (k) { return g[k]; });
          if (sub.length < 2) return;
          rows.push({ name: itemName(it) + ' (' + unitOf(it) + ')', avgp: avg, q: byItem[it].q, v: byItem[it].v, _b: true, _hl: true, nc: sub.length });
          sub.map(function (r) { var ap = r.q ? r.v / r.q : 0; return { name: '   ' + r.cname, avgp: ap, diff: ap - avg, diffp: avg ? (ap - avg) / avg * 100 : 0, mn: r.mn, mx: r.mx, q: r.q, v: r.v, pf: r.pf, margin: pct(r.pf, r.v), n: Object.keys(r.n).length, _acc: acc(r.ck) ? r.ck : null }; })
            .sort(function (a, b) { return a.diffp - b.diffp; }).forEach(function (r) { rows.push(r); });
        });
        var cols = [C('name', 'الصنف / العميل'), C('avgp', 'متوسط السعر', 'money'), C('diff', 'الفرق عن متوسط الشركة', 'money'), C('diffp', 'الفرق %', 'pct'), C('mn', 'أقل سعر', 'money'), C('mx', 'أعلى سعر', 'money'), C('q', 'الكمية', 'qty'), C('v', 'القيمة', 'money'), C('pf', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('n', 'الفواتير', 'int'), C('nc', 'العملاء', 'int')];
        var res = withNote({ cols: cols, rows: rows, note: (hasItem ? '' : 'يعرض أعلى 15 صنفاً مبيعاً. اختر صنفاً من التصفية لعرضه وحده. ') + 'العملاء مرتبون من الأقل سعراً إلى الأعلى.' }, p);
        if (!rows.length) res.empty = 'لا توجد أصناف بيعت لأكثر من عميل في هذه الفترة';
        return res;
      } };

    R.cust_profit = { cat: 'cust', name: 'ربحية العملاء التفصيلية', desc: 'لكل عميل: المبيعات والتكلفة والربح والهامش والمرتجعات والهدايا، وربح الفاتورة، والتحصيل، والربح مقابل الرصيد', params: ['period', 'top', 'flt'], fdims: CU_F,
      run: function (p) {
        var rows = custMetrics(p).filter(function (o) { return o.net || o.sales; }).map(function (o) { return { name: o.name, n: o.n, sales: o.sales, ret: o.ret, rp: o.rp, net: o.net, cost: o.cost, profit: o.profit, margin: o.margin, gift: o.gift, ppi: o.n ? o.profit / o.n : 0, coll: o.coll, cr: o.cr, bal: o.bal, _c1: o.k }; })
          .sort(function (a, b) { return b.profit - a.profit; });
        var tp = sum(rows, 'profit'); rows.forEach(function (r) { r.pshare = pct(r.profit, tp); });
        var cols = [C('name', 'العميل'), C('n', 'الفواتير', 'int'), C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('rp', 'المرتجعات %', 'pct'), C('net', 'الصافي', 'money'), C('cost', 'التكلفة', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'),
          C('pshare', 'حصته من الربح', 'pct'), C('ppi', 'ربح الفاتورة', 'money'), C('gift', 'هدايا (كمية)', 'qty'), C('coll', 'التحصيل', 'money'), C('cr', 'التحصيل %', 'pct'), C('bal', 'الرصيد', 'money')];
        var t = sumRow(rows, cols); t.pshare = 100; t.ppi = t.n ? t.profit / t.n : 0; t.cr = pct(t.coll, t.net);
        return withNote(topN({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['profit'], yl: ['مجمل الربح'], limit: 12 } }, p), p);
      } };

    R.cust_low_margin = { cat: 'cust', name: 'عملاء بهامش ربح منخفض', desc: 'العملاء الذين هامش الربح معهم أقل من حد تختاره، مع أصنافهم الأقل هامشاً', params: ['period', 'flt'], fdims: CU_F,
      sel: [['thr', 'الهامش أقل من', [['3', '3%'], ['5', '5%'], ['8', '8%'], ['10', '10%'], ['15', '15%']]]],
      run: function (p) {
        var thr = Number(p.thr || 5), cm = custMetrics(p).filter(function (o) { return o.net > 0 && o.margin < thr; }).sort(function (a, b) { return a.margin - b.margin; }), rows = [];
        cm.forEach(function (o) {
          rows.push({ name: o.name, net: o.net, profit: o.profit, margin: o.margin, n: o.n, _b: true, _hl: true, _c1: o.k });
          itemPriceStats(facts('s', p.from, p.to, c1Filter(p, o.k))).filter(function (r) { return r.net > 0; }).sort(function (a, b) { return a.margin - b.margin; }).slice(0, 5)
            .forEach(function (r) { rows.push({ name: '   ' + r.name, net: r.net, profit: r.profit, margin: r.margin, n: r.n, avgp: r.avgp }); });
        });
        var cols = [C('name', 'العميل / أقل أصنافه هامشاً'), C('n', 'الفواتير', 'int'), C('net', 'الصافي', 'money'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('avgp', 'متوسط السعر', 'money')];
        var head = rows.filter(function (r) { return r._b; }), t = { name: 'الإجمالي (' + head.length + ' عميل)', _b: true, net: sum(head, 'net'), profit: sum(head, 'profit') }; t.margin = pct(t.profit, t.net);
        var res = withNote({ cols: cols, rows: rows, total: t }, p);
        if (!rows.length) res.empty = 'لا يوجد عملاء بهامش أقل من ' + thr + '%';
        return res;
      } };

    R.cust_month_pivot = { cat: 'cust', name: 'العملاء شهرياً', desc: 'جدول: صف لكل عميل وعمود لكل شهر، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'top', 'flt'], fdims: CU_F,
      run: function (p) {
        var r = repPivot(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }, function (x) { return x.d.slice(0, 7); }, function (x) { return monthLabel(x.d.slice(0, 7)); }, p.rmeas, function (a, b) { return a.k < b.k ? -1 : 1; });
        r.cols[0].l = 'العميل';
        return withNote(topN(r, p), p);
      } };

    R.cust_growth = { cat: 'cust', name: 'نمو العملاء وتراجعهم', desc: 'تصنيف كل عميل مقابل الفترة السابقة: نامٍ، مستقر، متراجع، جديد، متوقف، مع القيمة والتغير والأصناف', params: ['period', 'top', 'flt'], fdims: CU_F,
      sel: [['gst', 'الحالة', [['all', 'الكل'], ['نامٍ', 'نامٍ'], ['مستقر', 'مستقر'], ['متراجع', 'متراجع'], ['جديد', 'جديد'], ['متوقف', 'متوقف']]]],
      run: function (p) {
        var rows = custMetrics(p).filter(function (o) { return o.net || o.pnet; }).map(function (o) {
          var st = o.pnet <= 0 && o.net > 0 ? 'جديد' : o.net <= 0 && o.pnet > 0 ? 'متوقف' : o.chp !== '' && o.chp >= 10 ? 'نامٍ' : o.chp !== '' && o.chp <= -10 ? 'متراجع' : 'مستقر';
          return { name: o.name, st: st, net: o.net, pnet: o.pnet, ch: o.ch, chp: o.chp, n: o.n, items: o.items, last: o.last, _c1: o.k, _hl: st === 'متوقف' || st === 'متراجع' };
        }).filter(function (r) { return !p.gst || p.gst === 'all' || r.st === p.gst; }).sort(function (a, b) { return a.ch - b.ch; });
        var g = {}; rows.forEach(function (r) { var o = g[r.st] || (g[r.st] = { n: 0, ch: 0 }); o.n++; o.ch += r.ch; });
        var cols = [C('name', 'العميل'), C('st', 'الحالة'), C('net', 'الآن', 'money'), C('pnet', 'الفترة السابقة', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct'), C('n', 'الفواتير', 'int'), C('items', 'الأصناف', 'int'), C('last', 'آخر شراء')];
        var t = sumRow(rows, cols); t.chp = t.pnet ? (t.net - t.pnet) / Math.abs(t.pnet) * 100 : ''; t.items = '';
        var pr = prevRange(p.from, p.to, p.preset);
        return withNote(topN({ cols: cols, rows: rows, total: t, note: 'الفترة السابقة: ' + pr[0] + ' إلى ' + pr[1] + ' · ' + Object.keys(g).map(function (k) { return k + ' ' + g[k].n + ' (' + fk(g[k].ch) + ')'; }).join(' · '),
          chart: { type: 'bar', x: 'name', y: ['v'], yl: ['التغير'], rowsOverride: ['نامٍ', 'مستقر', 'متراجع', 'جديد', 'متوقف'].map(function (k) { return { name: k, v: (g[k] || { ch: 0 }).ch }; }) } }, p), p);
      } };

    R.cust_pay_behavior = { cat: 'cust', name: 'سلوك سداد العملاء', desc: 'لكل عميل آجل: المبيعات والتحصيل ونسبته والرصيد وأعلى رصيد والدين القديم (+90 يوماً) ومتوسط أيام السداد والرصيد بأيام المبيعات وحد الائتمان', params: ['period', 'top', 'flt'], fdims: ['cust', 'ag', 'cat', 'xcust'],
      run: function (p) {
        var rows = custMetrics(p).filter(function (o) { return o._acc && (o.net > 0 || Math.abs(Number(o.bal) || 0) > 0.0005); }).map(function (o) {
          var lim = Number(o.lim) || 0;
          return { name: o.name, net: o.net, coll: o.coll, cr: o.cr, bal: o.bal, mx: maxBalance(o.k, p.from, p.to), od: o.od, odp: o.odp, pd: o.pd === null ? '' : o.pd, dso: o.dso, lim: lim || '', use: lim ? pct(o.bal, lim) : '', s_pay: o.s_pay, _acc: o._acc, _hl: o.od > 0.0005 || (lim && o.bal > lim) };
        }).sort(function (a, b) { return (Number(b.bal) || 0) - (Number(a.bal) || 0); });
        var cols = [C('name', 'العميل'), C('net', 'صافي المبيعات', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'التحصيل %', 'pct'), C('bal', 'الرصيد', 'money'), C('mx', 'أعلى رصيد', 'money'), C('od', 'دين +90 يوماً', 'money'), C('odp', 'نسبته من الرصيد', 'pct'),
          C('pd', 'متوسط أيام السداد', 'qty'), C('dso', 'الرصيد بأيام المبيعات', 'qty'), C('lim', 'حد الائتمان', 'money'), C('use', 'استخدام الحد', 'pct'), C('s_pay', 'درجة السداد', 'int')];
        var t = sumRow(rows, cols); t.cr = pct(t.coll, t.net); t.odp = pct(t.od, t.bal); t.mx = ''; t.lim = ''; t.s_pay = '';
        return withNote(topN({ cols: cols, rows: rows, total: t, note: 'الصفوف المظللة: لها دين أقدم من 90 يوماً أو تجاوزت حد الائتمان.' }, p), p);
      } };

    R.cust_activity = { cat: 'cust', name: 'نشاط العملاء وانتظامهم', desc: 'لكل عميل: أيام وأشهر الشراء، ومتوسط الأيام بين المرات، وآخر شراء، ومتوسط الفاتورة وأصنافها، ودرجة الانتظام', params: ['period', 'top', 'flt'], fdims: CU_F,
      run: function (p) {
        var ia = {}; invAgg(p.from, p.to, p.flt).forEach(function (r) { if (r.s < 0) return; var o = ia[r.v.ck] || (ia[r.v.ck] = { n: 0, it: 0 }); o.n++; o.it += Object.keys(r.items).length; });
        var rows = custMetrics(p).filter(function (o) { return o.net > 0; }).map(function (o) { var x = ia[o.k] || { n: 0, it: 0 };
          return { name: o.name, n: o.n, bdays: o.bdays, mact: o.mact, mratio: o.mtot ? pct(o.mact, o.mtot) : 0, gap: o.gap, first: o.first, last: o.last, since: o.since, avg: o.avg, ipi: x.n ? x.it / x.n : 0, items: o.items, s_reg: o.s_reg, _c1: o.k, _hl: o.since > 60 }; })
          .sort(function (a, b) { return b.bdays - a.bdays; });
        var cols = [C('name', 'العميل'), C('n', 'الفواتير', 'int'), C('bdays', 'أيام الشراء', 'int'), C('mact', 'الأشهر النشطة', 'int'), C('mratio', 'من أشهر الفترة', 'pct'), C('gap', 'متوسط الأيام بين المرات', 'qty'), C('first', 'أول شراء'), C('last', 'آخر شراء'),
          C('since', 'منذ آخر شراء (يوم)', 'int'), C('avg', 'متوسط الفاتورة', 'money'), C('ipi', 'أصناف الفاتورة', 'qty'), C('items', 'الأصناف المختلفة', 'int'), C('s_reg', 'درجة الانتظام', 'int')];
        var t = { name: 'الإجمالي (' + rows.length + ' عميل)', _b: true, n: sum(rows, 'n') };
        return withNote(topN({ cols: cols, rows: rows, total: t, note: 'الصفوف المظللة: لم يشترِ منذ أكثر من 60 يوماً.' }, p), p);
      } };

    R.cust_item_matrix = { cat: 'cust', name: 'العملاء × الأصناف', desc: 'جدول: صف لكل عميل وعمود لكل صنف (أعلى 30 صنفاً)، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'top', 'flt'], fdims: CU_F,
      run: function (p) { var r = repPivot(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }, p.rmeas); r.cols[0].l = 'العميل'; return withNote(topN(r, p), p); } };

    R.cust_discount = { cat: 'cust', name: 'الخصومات والهدايا لكل عميل', desc: 'لكل عميل: قيمة الأصناف قبل الخصم والخصم ونسبته، وكمية الهدايا وتكلفتها، وأثرها على الهامش', params: ['period', 'top', 'flt'], fdims: CU_F,
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          if (x.s < 0) return;
          var r = g[x.v.ck] || (g[x.v.ck] = { name: x.v.name, gross: 0, net: 0, gq: 0, gcost: 0, profit: 0, _acc: acc(x.v.ck) ? x.v.ck : null });
          var gross = x.l.p && x.l.q ? x.l.p * x.l.q : x.val; r.gross += Math.max(gross, x.val); r.net += x.val; r.profit += x.profit;
          if (x.gift) { r.gq += x.gift; } if (!x.val && x.qty > 0) { r.gq += x.qty; r.gcost += x.cost; }
        });
        var rows = Object.keys(g).map(function (k) { var r = g[k]; r.disc = r.gross - r.net; r.dp = pct(r.disc, r.gross); r.margin = pct(r.profit, r.net); r.m0 = pct(r.profit + r.gcost, r.net); return r; }).filter(function (r) { return r.disc > 0.0005 || r.gq; }).sort(function (a, b) { return (b.disc + b.gcost) - (a.disc + a.gcost); });
        var cols = [C('name', 'العميل'), C('gross', 'قبل الخصم', 'money'), C('disc', 'الخصم', 'money'), C('dp', 'الخصم %', 'pct'), C('net', 'بعد الخصم', 'money'), C('gq', 'كمية الهدايا', 'qty'), C('gcost', 'تكلفة الهدايا', 'money'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('m0', 'الهامش بدون الهدايا', 'pct')];
        var t = sumRow(rows, cols); t.dp = pct(t.disc, t.gross); t.m0 = pct(t.profit + t.gcost, t.net);
        var res = withNote(topN({ cols: cols, rows: rows, total: t }, p), p);
        if (!rows.length) res.empty = 'لا توجد خصومات أو هدايا للعملاء في هذه الفترة';
        return res;
      } };

    R.cust_items_breadth = { cat: 'cust', name: 'تشكيلة العميل وفرص البيع', desc: 'لكل عميل: عدد الأصناف التي يشتريها من أصناف الشركة النشطة، وأعلى الأصناف مبيعاً في الشركة التي لا يشتريها (فرص)', params: ['period', 'top', 'flt'], fdims: CU_F,
      run: function (p) {
        var topItems = salesBy(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }).sort(function (a, b) { return b.net - a.net; }), act = topItems.length, top20 = topItems.slice(0, 20).map(function (r) { return r.k; });
        var g = {}; facts('s', p.from, p.to, p.flt).forEach(function (x) { if (x.s < 0) return; (g[x.v.ck] = g[x.v.ck] || { name: x.v.name, it: {}, net: 0 }); g[x.v.ck].it[x.l.item] = 1; g[x.v.ck].net += x.val; });
        var rows = Object.keys(g).map(function (k) { var r = g[k], n = Object.keys(r.it).length, miss = top20.filter(function (i) { return !r.it[i]; });
          return { name: r.name, net: r.net, n: n, cov: pct(n, act), top: 20 - miss.length, miss: miss.slice(0, 6).map(itemName).join('، '), _c1: k }; }).sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'العميل'), C('net', 'المبيعات', 'money'), C('n', 'أصنافه', 'int'), C('cov', 'من أصناف الشركة النشطة', 'pct'), C('top', 'من أعلى 20 صنفاً', 'int'), C('miss', 'أصناف رائجة لا يشتريها (فرص)')];
        var t = { name: 'الإجمالي', _b: true, net: sum(rows, 'net') };
        return withNote(topN({ cols: cols, rows: rows, total: t, note: 'أصناف الشركة النشطة في الفترة: ' + act }, p), p);
      } };

    /* ===================== مجموعات العملاء =====================
       مجموعة = اسم + حساب أو أكثر من دليل العملاء (رئيسي أو فرعي)، مثل «وكلاء المنطقة الشرقية» أو «الفروع».
       كل عميل تحت أي حساب في المجموعة يتبعها. إن وقع العميل في أكثر من مجموعة يتبع الأدق (الحساب الأعمق)، ثم الأسبق ترتيباً.
       وبدون تعريف مجموعات تعمل التقارير «حسب الحساب الرئيسي الأب» مباشرة من الدليل. */
    (function () {
      var ci = CATS.map(function (c) { return c[0]; }).indexOf('cust1');
      CATS.splice(ci + 1, 0, ['cgrp', 'مجموعات العملاء']);
    })();
    var CG_NONE = '~';
    function cgList() {
      var l = F.config && Array.isArray(F.config.cgroups) ? F.config.cgroups : null;
      if (!l) { try { l = JSON.parse(localStorage.getItem('rk.finCgroups') || 'null'); } catch (e) { l = null; } }
      return (l || []).filter(function (g) { return g && g.id && g.name; });
    }
    // سلسلة الحسابات من العميل صعوداً إلى أعلى الدليل
    function ancOf(id) {
      var c = F.cache.anc || (F.cache.anc = {});
      if (c[id]) return c[id];
      var out = [], a = acc(id), guard = 0;
      while (a && guard++ < 20) { out.push(a); a = a.parent ? acc(a.parent) : null; }
      return (c[id] = out);
    }
    // مجموعة العميل (للتقارير التي تقسم المجموع على المجموعات)
    function cgOf(ck) {
      var c = F.cache.cgOf || (F.cache.cgOf = {});
      if (c[ck] !== undefined) return c[ck];
      var best = CG_NONE, bestLvl = -1, gs = cgList(), an = ancOf(ck);
      gs.forEach(function (g) {
        an.forEach(function (a) { if ((g.codes || []).indexOf(String(a.code)) >= 0 && a.lvl > bestLvl) { best = g.id; bestLvl = a.lvl; } });
      });
      return (c[ck] = best);
    }
    function cgIn(ck, gid) {
      if (gid === CG_NONE) return cgOf(ck) === CG_NONE;
      var g = cgList().filter(function (x) { return x.id === gid; })[0]; if (!g) return false;
      return ancOf(ck).some(function (a) { return (g.codes || []).indexOf(String(a.code)) >= 0; });
    }
    function cgName(gid) { if (gid === CG_NONE) return 'بدون مجموعة'; var g = cgList().filter(function (x) { return x.id === gid; })[0]; return g ? g.name : gid; }
    function cgMatch(list, ck) { return list.some(function (x) { return cgIn(ck, String(x).replace(/^@/, '')); }); }
    // تصفية «حساب عملاء رئيسي أو فرعي»: العميل نفسه أو أي حساب فوقه
    function caccMatch(list, ck) { var ids = ancOf(ck).map(function (a) { return a.id; }); return list.some(function (x) { return ids.indexOf(String(x).replace(/^@/, '')) >= 0; }); }
    // الحسابات الرئيسية في دليل العملاء (بين حسابات العملاء المحددة في الإعدادات وحسابات العملاء الفرعية)
    function custTreeAccs() {
      if (F.cache.ctree) return F.cache.ctree;
      var leaves = recvIds(), roots = {}, seen = {};
      leaves.forEach(function (id) {
        var an = ancOf(id).slice(1), s = settings(), codes = String((s && s.recv) || '1601').split(',');
        var cut = an.length; for (var i = 0; i < an.length; i++) if (codes.indexOf(String(an[i].code)) >= 0) { cut = i + 1; roots[an[i].id] = 1; break; }
        an.slice(0, cut).forEach(function (a) { seen[a.id] = 1; });
      });
      return (F.cache.ctree = F.D.accList.filter(function (a) { return seen[a.id]; }));
    }
    function settings() { return (F.meta && F.meta.settings) || {}; }
    // مفتاح التجميع: المجموعات المعرّفة، أو الحساب الأب مباشرة
    function cgKeyFn(p) {
      if (cgBy(p) === 'grp') return { key: function (ck) { return cgOf(ck); }, name: cgName, label: 'المجموعة' };
      return { key: function (ck) { var a = acc(ck); return a && a.parent ? a.parent : CG_NONE; }, name: function (k) { return k === CG_NONE ? 'بدون حساب' : (acc(k) ? acc(k).name : k); }, label: 'الحساب الأب' };
    }
    function cgBy(p) { return p.cgby === 'parent' || !cgList().length ? 'parent' : 'grp'; }
    var CG_SEL = [['cgby', 'التجميع حسب', [['grp', 'المجموعات المعرّفة'], ['parent', 'الحساب الأب في الدليل']]]];
    var CG_F = ['cust', 'cacc', 'cgrp', 'item', 'st', 'ag', 'cat', 'xcust', 'xcgrp', 'xitem'];
    function cgNote(p) { return cgBy(p) === 'grp' ? 'التجميع حسب مجموعات العملاء المعرّفة في الإعدادات' : (cgList().length ? 'التجميع حسب الحساب الرئيسي الأب لكل عميل' : 'لم تُعرَّف مجموعات عملاء بعد، فالتجميع حسب الحساب الرئيسي الأب لكل عميل. عرّف المجموعات من الإعدادات ← مجموعات العملاء.'); }
    function cgOrder(keys, p) {
      if (cgBy(p) === 'grp') { var ord = cgList().map(function (g) { return g.id; }).concat([CG_NONE]); return keys.sort(function (a, b) { return ord.indexOf(a) - ord.indexOf(b); }); }
      return keys;
    }

    // المؤشرات الأساسية لكل مجموعة: مبيعات وربح وعملاء وتحصيل وأرصدة
    function cgAgg(p) {
      var K = cgKeyFn(p), g = {};
      var mk = function (k) { return g[k] || (g[k] = { k: k, name: K.name(k), sales: 0, ret: 0, profit: 0, cost: 0, qty: 0, inv: {}, cust: {}, items: {}, coll: 0, bal: 0, od: 0, ncust: 0, pnet: 0 }); };
      facts('s', p.from, p.to, p.flt).forEach(function (x) {
        var r = mk(K.key(x.v.ck));
        if (x.s > 0) { r.sales += x.val; r.inv[x.v.id] = 1; r.cust[x.v.ck] = 1; r.items[x.l.item] = 1; } else r.ret += x.val;
        r.profit += x.s * x.profit; r.cost += x.s * x.cost; r.qty += x.s * x.qty;
      });
      var pr = prevRange(p.from, p.to, p.preset);
      facts('s', pr[0], pr[1], p.flt).forEach(function (x) { mk(K.key(x.v.ck)).pnet += x.s * x.val; });
      var coll = collections(p.from, p.to, '', true), ids = recvFor(p.flt);
      ids.forEach(function (id) {
        var r = mk(K.key(id)), b = balance([id], null, p.to).close;
        r.ncust++; r.bal += b; r.coll += coll[id] || 0; if (b > 0.0005) r.od += overdue(id, p.to, 90);
      });
      return cgOrder(Object.keys(g), p).map(function (k) {
        var r = g[k], net = r.sales - r.ret, n = Object.keys(r.inv).length, act = Object.keys(r.cust).length;
        return { k: k, name: r.name, ncust: r.ncust, act: act, n: n, sales: r.sales, ret: r.ret, rp: pct(r.ret, r.sales), net: net, profit: r.profit, margin: pct(r.profit, net), qty: r.qty, items: Object.keys(r.items).length,
          avgc: act ? net / act : 0, avgi: n ? r.sales / n : 0, coll: r.coll, cr: pct(r.coll, net), bal: r.bal, od: r.od, odp: pct(r.od, r.bal), pnet: r.pnet, ch: net - r.pnet, chp: r.pnet ? (net - r.pnet) / Math.abs(r.pnet) * 100 : '' };
      }).filter(function (r) { return r.net || r.ncust || r.bal || r.pnet; });
    }

    R.cg_summary = { cat: 'cgrp', name: 'ملخص مجموعات العملاء', desc: 'لكل مجموعة (مثل وكلاء المنطقة الشرقية والغربية والفروع): العملاء والنشطون والفواتير والمبيعات والربح والهامش والحصة والتحصيل والأرصدة والدين القديم', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) {
        var rows = cgAgg(p), tn = sum(rows, 'net'); rows.forEach(function (r) { r.share = pct(r.net, tn); });
        var K = cgKeyFn(p);
        var cols = [C('name', K.label), C('ncust', 'العملاء', 'int'), C('act', 'النشطون', 'int'), C('n', 'الفواتير', 'int'), C('net', 'صافي المبيعات', 'money'), C('share', 'الحصة', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'),
          C('rp', 'المرتجعات %', 'pct'), C('avgc', 'متوسط العميل', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'التحصيل %', 'pct'), C('bal', 'الأرصدة', 'money'), C('od', 'دين +90 يوماً', 'money'), C('chp', 'التغير عن السابقة', 'pct')];
        var t = sumRow(rows, cols); t.share = 100; t.avgc = t.act ? t.net / t.act : 0; t.cr = pct(t.coll, t.net); var tp = sum(rows, 'pnet'); t.chp = tp ? (t.net - tp) / Math.abs(tp) * 100 : '';
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p), chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] } }, p);
      } };
    R.cg_month = { cat: 'cgrp', name: 'مجموعات العملاء شهرياً', desc: 'جدول: صف لكل مجموعة وعمود لكل شهر، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) { var K = cgKeyFn(p); var r = repPivot(p, function (x) { return K.key(x.v.ck); }, function (x, k) { return K.name(k || K.key(x.v.ck)); }, function (x) { return x.d.slice(0, 7); }, function (x) { return monthLabel(x.d.slice(0, 7)); }, p.rmeas, function (a, b) { return a.k < b.k ? -1 : 1; }); r.cols[0].l = K.label; r.note = cgNote(p); return withNote(r, p); } };
    R.cg_customers = { cat: 'cgrp', name: 'عملاء كل مجموعة', desc: 'كل مجموعة وتحتها عملاؤها: المبيعات والربح والهامش والفواتير والتحصيل والرصيد وآخر شراء', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL.concat([['cact', 'العملاء', [['act', 'من اشترى في الفترة'], ['all', 'كل العملاء (مع الأرصدة)']]]]),
      run: function (p) {
        var K = cgKeyFn(p), cm = custMetrics(p), by = {}, seen = {};
        cm.forEach(function (o) { if (!o.net && !o.sales) return; seen[o.k] = 1; (by[K.key(o.k)] = by[K.key(o.k)] || []).push({ name: o.name, n: o.n, net: o.net, profit: o.profit, margin: o.margin, coll: o.coll, bal: o.bal, last: o.last, _c1: o.k }); });
        if (p.cact === 'all') recvFor(p.flt).forEach(function (id) { if (seen[id]) return; var b = balance([id], null, p.to).close; if (Math.abs(b) < 0.0005) return; (by[K.key(id)] = by[K.key(id)] || []).push({ name: accName(id), n: 0, net: 0, profit: 0, margin: 0, coll: 0, bal: b, last: '', _c1: id }); });
        var rows = [];
        cgOrder(Object.keys(by), p).forEach(function (k) {
          var l = by[k].sort(function (a, b) { return b.net - a.net || (Number(b.bal) || 0) - (Number(a.bal) || 0); }), h = { name: K.name(k) + ' (' + l.length + ' عميل)', n: sum(l, 'n'), net: sum(l, 'net'), profit: sum(l, 'profit'), coll: sum(l, 'coll'), bal: sum(l, function (r) { return Number(r.bal) || 0; }), _b: true, _hl: true };
          h.margin = pct(h.profit, h.net); rows.push(h); l.forEach(function (r) { r.name = '   ' + r.name; rows.push(r); });
        });
        var cols = [C('name', K.label + ' / العميل'), C('n', 'الفواتير', 'int'), C('net', 'صافي المبيعات', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('coll', 'التحصيل', 'money'), C('bal', 'الرصيد', 'money'), C('last', 'آخر شراء')];
        var hs = rows.filter(function (r) { return r._b; }), t = { name: 'الإجمالي', _b: true, n: sum(hs, 'n'), net: sum(hs, 'net'), profit: sum(hs, 'profit'), coll: sum(hs, 'coll'), bal: sum(hs, 'bal') }; t.margin = pct(t.profit, t.net);
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p) }, p);
      } };
    R.cg_items = { cat: 'cgrp', name: 'المجموعات × الأصناف', desc: 'جدول: صف لكل صنف وعمود لكل مجموعة، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'top', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) { var K = cgKeyFn(p); var r = repPivot(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }, function (x) { return K.key(x.v.ck); }, function (x) { return K.name(K.key(x.v.ck)); }, p.rmeas); r.cols[0].l = 'الصنف'; r.note = cgNote(p); return withNote(topN(r, p), p); } };
    R.cg_compare = { cat: 'cgrp', name: 'مقارنة المجموعات بالفترة السابقة', desc: 'لكل مجموعة: المبيعات الآن وفي الفترة السابقة والتغير ونسبته، والربح والهامش والعملاء النشطون', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) {
        var rows = cgAgg(p).map(function (r) { return { name: r.name, net: r.net, pnet: r.pnet, ch: r.ch, chp: r.chp, profit: r.profit, margin: r.margin, act: r.act, _hl: r.ch < 0 }; }).sort(function (a, b) { return a.ch - b.ch; });
        var pr = prevRange(p.from, p.to, p.preset), K = cgKeyFn(p);
        var cols = [C('name', K.label), C('net', 'الآن', 'money'), C('pnet', 'الفترة السابقة', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('act', 'العملاء النشطون', 'int')];
        var t = sumRow(rows, cols); t.chp = t.pnet ? (t.net - t.pnet) / Math.abs(t.pnet) * 100 : '';
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p) + ' · الفترة السابقة: ' + pr[0] + ' إلى ' + pr[1], chart: { type: 'bar', x: 'name', y: ['net', 'pnet'], yl: ['الآن', 'السابقة'] } }, p);
      } };
    R.cg_collect = { cat: 'cgrp', name: 'تحصيل وأرصدة المجموعات', desc: 'لكل مجموعة: المبيعات والتحصيل ونسبته والأرصدة والدين الأقدم من 90 يوماً ونسبته وعدد العملاء المدينين', params: ['period', 'flt'], fdims: ['cust', 'cacc', 'cgrp', 'xcust', 'xcgrp'], sel: CG_SEL,
      run: function (p) {
        var K = cgKeyFn(p), deb = {}; recvFor(p.flt).forEach(function (id) { if (balance([id], null, p.to).close > 0.0005) deb[K.key(id)] = (deb[K.key(id)] || 0) + 1; });
        var rows = cgAgg(p).map(function (r) { return { name: r.name, net: r.net, coll: r.coll, cr: r.cr, bal: r.bal, od: r.od, odp: r.odp, ncust: r.ncust, deb: deb[r.k] || 0, _hl: r.odp > 30 }; });
        var cols = [C('name', K.label), C('ncust', 'العملاء', 'int'), C('deb', 'المدينون', 'int'), C('net', 'صافي المبيعات', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'التحصيل %', 'pct'), C('bal', 'الأرصدة', 'money'), C('od', 'دين +90 يوماً', 'money'), C('odp', 'نسبته من الرصيد', 'pct')];
        var t = sumRow(rows, cols); t.cr = pct(t.coll, t.net); t.odp = pct(t.od, t.bal);
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p), chart: { type: 'hbar', x: 'name', y: ['bal'], yl: ['الأرصدة'] } }, p);
      } };
    R.cg_reps = { cat: 'cgrp', name: 'المجموعات × المناديب', desc: 'جدول: صف لكل مجموعة وعمود لكل مندوب، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) { var K = cgKeyFn(p); var r = repPivot(p, function (x) { return K.key(x.v.ck); }, function (x) { return K.name(K.key(x.v.ck)); }, function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag || '0'); }, p.rmeas); r.cols[0].l = K.label; r.note = cgNote(p); return withNote(r, p); } };
    R.cg_cats = { cat: 'cgrp', name: 'المجموعات × فئات المناديب', desc: 'جدول: صف لكل مجموعة وعمود لكل فئة مندوب (جملة، تجزئة، أسواق…)', params: ['period', 'rmeas', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) { var K = cgKeyFn(p); var r = repPivot(p, function (x) { return K.key(x.v.ck); }, function (x) { return K.name(K.key(x.v.ck)); }, function (x) { return repCat(x.v.ag); }, function (x) { return repCat(x.v.ag); }, p.rmeas); r.cols[0].l = K.label; r.note = cgNote(p); return withNote(r, p); } };
    R.cg_eval = { cat: 'cgrp', name: 'تقييم المجموعات', desc: 'لكل مجموعة: متوسط درجة التعامل مع عملائها وتوزيعهم على التقديرات، والعملاء المتوقفون', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) {
        var K = cgKeyFn(p), g = {}, gr = ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'ضعيف', 'متوقف'];
        custMetrics(p).forEach(function (o) { if (!(o.net > 0 || o.prevOnly)) return; var k = K.key(o.k), r = g[k] || (g[k] = { k: k, n: 0, sc: 0, act: 0, net: 0 }); r.n++; r[o.grade] = (r[o.grade] || 0) + 1; r.net += o.net; if (o.net > 0) { r.act++; r.sc += o.score * o.net; } });
        var rows = cgOrder(Object.keys(g), p).map(function (k) { var r = g[k], o = { name: K.name(k), n: r.n, net: r.net, avg: r.net > 0 ? r.sc / r.net : 0 }; o.grade = grade(o.avg); gr.forEach(function (x, i) { o['g' + i] = r[x] || 0; }); return o; });
        var cols = [C('name', K.label), C('n', 'العملاء', 'int'), C('net', 'صافي المبيعات', 'money'), C('avg', 'متوسط الدرجة (موزون)', 'int'), C('grade', 'التقدير')].concat(gr.map(function (x, i) { return C('g' + i, x, 'int'); }));
        var t = sumRow(rows, cols); t.avg = ''; t.grade = '';
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p) + ' · متوسط الدرجة موزون بمبيعات كل عميل', chart: { type: 'hbar', x: 'name', y: ['avg'], yl: ['متوسط الدرجة'] } }, p);
      } };
    R.cg_item_price = { cat: 'cgrp', name: 'سعر الصنف في كل مجموعة', desc: 'لأعلى الأصناف (أو صنف تختاره): متوسط سعر البيع في كل مجموعة والفرق عن متوسط الشركة وأقل وأعلى سعر', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) {
        var K = cgKeyFn(p), byItem = {}, g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { var up = unitPrice(x); if (up === null) return; var it = byItem[x.l.item] || (byItem[x.l.item] = { v: 0, q: 0 }); it.v += x.val; it.q += x.qty;
          var k = x.l.item + '|' + K.key(x.v.ck), r = g[k] || (g[k] = { item: x.l.item, gk: K.key(x.v.ck), v: 0, q: 0, pf: 0, mn: null, mx: null }); r.v += x.val; r.q += x.qty; r.pf += x.profit; if (r.mn === null || up < r.mn) r.mn = up; if (r.mx === null || up > r.mx) r.mx = up; });
        var items = Object.keys(byItem).sort(function (a, b) { return byItem[b].v - byItem[a].v; }), rows = [], lim = hasItemF(p.flt) ? items.length : Math.min(15, items.length);
        items.slice(0, lim).forEach(function (it) {
          var avg = byItem[it].q ? byItem[it].v / byItem[it].q : 0, sub = Object.keys(g).filter(function (k) { return g[k].item === it; }).map(function (k) { return g[k]; });
          rows.push({ name: itemName(it) + ' (' + unitOf(it) + ')', avgp: avg, q: byItem[it].q, v: byItem[it].v, _b: true, _hl: true });
          sub.sort(function (a, b) { return a.v / a.q - b.v / b.q; }).forEach(function (r) { var ap = r.q ? r.v / r.q : 0; rows.push({ name: '   ' + K.name(r.gk), avgp: ap, diff: ap - avg, diffp: avg ? (ap - avg) / avg * 100 : 0, mn: r.mn, mx: r.mx, q: r.q, v: r.v, margin: pct(r.pf, r.v) }); });
        });
        var cols = [C('name', 'الصنف / ' + K.label), C('avgp', 'متوسط السعر', 'money'), C('diff', 'الفرق عن متوسط الشركة', 'money'), C('diffp', 'الفرق %', 'pct'), C('mn', 'أقل سعر', 'money'), C('mx', 'أعلى سعر', 'money'), C('q', 'الكمية', 'qty'), C('v', 'القيمة', 'money'), C('margin', 'الهامش', 'pct')];
        return withNote({ cols: cols, rows: rows, note: cgNote(p) + (hasItemF(p.flt) ? '' : ' · يعرض أعلى 15 صنفاً؛ اختر صنفاً من التصفية لعرضه وحده') }, p);
      } };

    /* ---------- إعدادات مجموعات العملاء ---------- */
    function cgDraft() { if (!F.cgDraft) F.cgDraft = JSON.parse(JSON.stringify(cgList())); return F.cgDraft; }
    function cgStats() {
      var y0 = addD(today(), -365), s = {}; F.D.invs.forEach(function (v) { if (v.c !== SALE || v.d < y0) return; var k = cgOf(v.ck), o = s[k] || (s[k] = { n: {}, v: 0 }); o.n[v.ck] = 1; o.v += v.net; });
      return s;
    }
    function cgSettingsHTML() {
      var d = cgDraft(), live = !F.cgDirty, st = live ? cgStats() : {};
      var h = '<div class="card"><h2>مجموعات العملاء</h2><p class="small muted" style="margin:0 0 10px">اجمع العملاء في مجموعات تختار لكل منها حساباً أو أكثر من دليل العملاء (رئيسياً أو فرعياً)، مثل «وكلاء المنطقة الشرقية» أو «الفروع». كل العملاء تحت هذه الحسابات يتبعون المجموعة، وتظهر التقارير حسبها في قسم «مجموعات العملاء»، ويمكن التصفية بها في كل التقارير.</p>';
      if (!d.length) h += '<div class="empty" style="margin:0 0 10px">لا توجد مجموعات بعد. أنشئها يدوياً، أو اضغط «إنشاء من الحسابات الرئيسية» لتُنشأ مجموعة لكل حساب رئيسي تحت العملاء.</div>';
      h += '<div class="cg-list">' + d.map(function (g, i) {
        var o = st[g.id];
        return '<div class="cg-item"><div class="cg-top"><span class="cg-ord">' + (i + 1) + '</span><input class="input cg-name" data-cgname="' + i + '" value="' + esc(g.name) + '" placeholder="اسم المجموعة">' +
          '<button class="btn sm ghost" data-cgup="' + i + '"' + (i ? '' : ' disabled') + ' aria-label="أعلى">▲</button><button class="btn sm ghost" data-cgdn="' + i + '"' + (i < d.length - 1 ? '' : ' disabled') + ' aria-label="أسفل">▼</button><button class="btn sm ghost danger" data-cgdel="' + i + '">حذف</button></div>' +
          '<div class="st-pills cg-accs">' + (g.codes || []).map(function (c, j) { var a = F.D.byCode[c]; return '<span class="col-pill"><b class="num">' + esc(c) + '</b> ' + esc(a ? a.name : '(غير موجود)') + '<button type="button" data-cgrm="' + i + '|' + j + '" aria-label="إزالة">×</button></span>'; }).join('') +
          '<button class="btn sm" data-cgacc="' + i + '">+ حسابات</button></div>' +
          (o ? '<div class="small muted">آخر سنة: ' + fk(Object.keys(o.n).length) + ' عميل اشترى · مبيعات ' + fm(o.v) + '</div>' : (live && (g.codes || []).length ? '<div class="small muted">لا مبيعات لعملاء هذه المجموعة في آخر سنة</div>' : '')) + '</div>';
      }).join('') + '</div>';
      var none = st[CG_NONE];
      if (live && d.length && none) h += '<p class="small" style="margin:8px 0 0">عملاء خارج كل المجموعات (آخر سنة): ' + fk(Object.keys(none.n).length) + ' · مبيعات ' + fm(none.v) + '</p>';
      h += '<div class="row" style="margin-top:12px;flex-wrap:wrap;gap:8px"><button class="btn" data-cgadd>+ مجموعة جديدة</button><button class="btn ghost" data-cgauto>إنشاء من الحسابات الرئيسية</button><span class="grow small muted">' + (F.cgDirty ? 'لديك تعديلات غير محفوظة' : '') + '</span>' +
        (F.cgDirty ? '<button class="btn ghost" data-cgundo>تراجع</button>' : '') + '<button class="btn primary" data-cgsave' + (canEdit() ? '' : ' disabled') + '>حفظ</button></div>' +
        '<p class="small muted" style="margin:10px 0 0">إن وقع عميل تحت حسابات أكثر من مجموعة، يتبع المجموعة ذات الحساب الأدق (الأعمق في الدليل)، ثم الأعلى في هذه القائمة.</p></div>';
      return h;
    }
    function bindCgSettings(m) {
      var d = cgDraft(), dirty = function () { F.cgDirty = true; };
      qa('[data-cgname]', m).forEach(function (el) { el.oninput = function () { d[Number(el.dataset.cgname)].name = el.value; dirty(); }; });
      qa('[data-cgdel]', m).forEach(function (b) { b.onclick = function () { d.splice(Number(b.dataset.cgdel), 1); dirty(); A.render(); }; });
      qa('[data-cgup]', m).forEach(function (b) { b.onclick = function () { var i = Number(b.dataset.cgup); d.splice(i - 1, 0, d.splice(i, 1)[0]); dirty(); A.render(); }; });
      qa('[data-cgdn]', m).forEach(function (b) { b.onclick = function () { var i = Number(b.dataset.cgdn); d.splice(i + 1, 0, d.splice(i, 1)[0]); dirty(); A.render(); }; });
      qa('[data-cgrm]', m).forEach(function (b) { b.onclick = function () { var x = b.dataset.cgrm.split('|'); d[Number(x[0])].codes.splice(Number(x[1]), 1); dirty(); A.render(); }; });
      var tree = custTreeAccs().map(function (a) { return a.id; }), leaves = {}; recvIds().forEach(function (id) { leaves[id] = 1; });
      var inTree = function (a) { return tree.indexOf(a.id) >= 0 || leaves[a.id]; };
      qa('[data-cgacc]', m).forEach(function (b) {
        b.onclick = function () {
          var g = d[Number(b.dataset.cgacc)];
          pickAccount({ multi: true, value: (g.codes || []).slice(), title: 'حسابات «' + (g.name || 'المجموعة') + '»', hint: 'اختر حساباً رئيسياً (فيدخل كل العملاء تحته) أو حسابات عملاء فرعية بعينها. يمكن اختيار أكثر من حساب.', filter: inTree })
            .then(function (codes) { if (!codes) return; g.codes = codes; if (!g.name && codes.length === 1 && F.D.byCode[codes[0]]) g.name = F.D.byCode[codes[0]].name; dirty(); A.render(); });
        };
      });
      q('[data-cgadd]', m).onclick = function () { d.push({ id: 'g' + Date.now().toString(36), name: '', codes: [] }); dirty(); A.render(); setTimeout(function () { var el = qa('[data-cgname]', document).pop(); if (el) el.focus(); }, 30); };
      q('[data-cgauto]', m).onclick = function () {
        // حساب رئيسي لكل مجموعة: الأبناء المباشرون لحسابات العملاء التي لها عملاء تحتها
        var s = settings(), roots = String(s.recv || '1601').split(','), have = {}; d.forEach(function (g) { (g.codes || []).forEach(function (c) { have[c] = 1; }); });
        var added = 0;
        custTreeAccs().forEach(function (a) { var p0 = a.parent ? acc(a.parent) : null; if (!a.leaf && p0 && roots.indexOf(String(p0.code)) >= 0 && !have[a.code]) { d.push({ id: 'g' + Date.now().toString(36) + added, name: a.name, codes: [String(a.code)] }); have[a.code] = 1; added++; } });
        if (!added) { toast('لا توجد حسابات رئيسية جديدة تحت حسابات العملاء'); return; }
        dirty(); toast('أُضيفت ' + added + ' مجموعة، راجعها ثم احفظ'); A.render();
      };
      var un = q('[data-cgundo]', m); if (un) un.onclick = function () { F.cgDraft = null; F.cgDirty = false; A.render(); };
      q('[data-cgsave]', m).onclick = function () {
        var bad = d.filter(function (g) { return !String(g.name || '').trim() || !(g.codes || []).length; })[0];
        if (bad) { toast('لكل مجموعة اسم وحساب واحد على الأقل', true); return; }
        var val = d.map(function (g) { return { id: g.id, name: String(g.name).trim().slice(0, 60), codes: g.codes.slice(0, 200) }; }), b = this; busy(b, true);
        var done = function (local) { F.cgDraft = null; F.cgDirty = false; resetCache(); toast(local ? 'حُفظت على هذا الجهاز فقط حتى يُحدَّث الخادم' : 'حُفظت مجموعات العملاء'); A.render(); };
        call('fin_config_save', { key: 'cgroups', value: val.length ? val : null }).then(function (r) {
          F.config = r.config || {}; if (!val.length) delete F.config.cgroups; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); try { localStorage.removeItem('rk.finCgroups'); } catch (e) {} done(false);
        }).catch(function (e) {
          if (!/غير معروف/.test(e.message)) { busy(b, false); toast(e.message, true); return; }
          try { localStorage.setItem('rk.finCgroups', JSON.stringify(val)); } catch (x) {} if (F.config) delete F.config.cgroups; done(true);
        });
      };
    }

    /* ---------- تجميع صفوف العملاء حسب الحسابات أو المجموعات المحددة في التصفية ---------- */
    // عند اختيار أكثر من حساب عملاء (أو مجموعة) في التصفية، تُعرض كل مجموعة بعنوان وإجمالي وتحتها عملاؤها
    var GRP_NOSUM = /^(margin|share|uf|np|rp|cr|ch|chp|diffp|odp|pch|use|avg|avgp|avgc|avgi|ppi|upp|score|grade|dso|pd|gap|since|ratio|pmin|pmax|mn|mx|lim|cov|mratio|p|lp|up|s_\w+)$/;
    function custNameMap() {
      if (F.cache.cnm) return F.cache.cnm;
      var m = {}; F.D.invs.forEach(function (v) { if (v.name && !m[v.name]) m[v.name] = v.ck; });
      recvIds().forEach(function (id) { var a = acc(id); if (a && !m[a.name]) m[a.name] = id; });
      return (F.cache.cnm = m);
    }
    // التجميع: حسب الحسابات/المجموعات المحددة في التصفية (تلقائي عند اختيار أكثر من واحد)،
    // أو حسب قالب التجميع المختار للتقرير أو الافتراضي لكل التقارير: مجموعات العملاء أو الحساب الأب
    var GRP_MODES = [['none', 'بدون تجميع'], ['grp', 'حسب مجموعات العملاء'], ['parent', 'حسب الحساب الأب']];
    function grpDefault() { var u = (F.config && F.config.ui) || null; if (!u) { try { u = JSON.parse(localStorage.getItem('rk.finUi') || 'null'); } catch (e) { u = null; } } return (u && u.grp) || 'none'; }
    function grpMode(p) { var m = p && p.cgx && p.cgx !== 'auto' ? p.cgx : grpDefault(); if (m === 'grp' && !cgList().length) m = 'parent'; return m; }
    function custSet() { if (F.cache.cset) return F.cache.cset; var o = {}, m = custNameMap(); Object.keys(m).forEach(function (k) { o[m[k]] = 1; }); recvIds().forEach(function (id) { o[id] = 1; }); return (F.cache.cset = o); }
    function groupBySel(res, flt, mode) {
      var f = parseFilter(flt) || {};
      if (!res || res.empty || !res.rows || !res.rows.length || res._noCust) return res;
      if (res.rows.some(function (r) { return r._b || r._lvl; })) return res;
      var nm = custNameMap();
      // عمود العميل: أول عمود نصي تُعرف قيمه كعملاء
      var textCols = res.cols.filter(function (c) { return !isNum(c); }), ccol = null, best = 0;
      var cset = custSet(); textCols.slice(0, 3).forEach(function (c) { var n = res.rows.filter(function (r) { return r._c1 || r._ck || (r._acc && cset[r._acc]) || nm[plain(r[c.k]).trim()]; }).length; if (n > best) { best = n; ccol = c; } });
      if (!ccol || best < res.rows.length * 0.6) return res;
      res._custRows = true;
      var kind = f.cacc && f.cacc.length > 1 ? 'cacc' : f.cgrp && f.cgrp.length > 1 ? 'cgrp' : mode === 'grp' || mode === 'parent' ? mode : '';
      if (!kind) return res;
      var ckOf = function (r) { return r._c1 || r._ck || (r._acc && acc(r._acc) ? r._acc : null) || nm[plain(r[ccol.k]).trim()]; };
      var keyOf, label, order;
      if (kind === 'cacc' || kind === 'cgrp') {
        var sel = f[kind].map(function (x) { return String(x).replace(/^@/, ''); });
        keyOf = function (ck) {
          if (!ck) return null;
          if (kind === 'cgrp') { for (var i = 0; i < sel.length; i++) if (cgIn(ck, sel[i])) return sel[i]; return null; }
          var an = ancOf(ck).map(function (a) { return a.id; }), bi = null, bd = 1e9;
          sel.forEach(function (id) { var d = an.indexOf(id); if (d >= 0 && d < bd) { bd = d; bi = id; } });   // الأقرب للعميل (الأدق) يفوز
          return bi;
        };
        label = function (k) { if (kind === 'cgrp') return cgName(k); var a = acc(k); return a ? a.code + ' · ' + a.name : k; };
        order = sel;
      } else if (kind === 'grp') {
        keyOf = function (ck) { return ck ? cgOf(ck) : null; }; label = cgName; order = cgList().map(function (g) { return g.id; }).concat([CG_NONE]);
      } else {
        keyOf = function (ck) { var a = ck && acc(ck); return a && a.parent ? a.parent : null; }; label = function (k) { var a = acc(k); return a ? a.code + ' · ' + a.name : k; }; order = null;
      }
      var g = {}, keys = [], other = [];
      res.rows.forEach(function (r) { var k = keyOf(ckOf(r)); if (k === null || k === undefined) { other.push(r); return; } if (!g[k]) { g[k] = []; keys.push(k); } g[k].push(r); });
      if (order) keys.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      var nums = res.cols.filter(function (c) { return isNum(c) && c.t !== 'pct' && !GRP_NOSUM.test(c.k); });
      var head = function (name, list, gi) {
        var h = { _b: true, _hl: true, _g: gi, _gh: 1 }; h[ccol.k] = name + ' (' + list.length + ')';
        nums.forEach(function (c) { h[c.k] = list.reduce(function (s, r) { return s + (Number(r[c.k]) || 0); }, 0); });
        if ('margin' in (list[0] || {}) && 'profit' in h && 'net' in h) h.margin = pct(h.profit, h.net);
        if ('ch' in (list[0] || {}) && 'cur' in h && 'prev' in h) h.ch = h.prev ? (h.cur - h.prev) / Math.abs(h.prev) * 100 : null;
        if ('chp' in (list[0] || {}) && 'net' in h && 'pnet' in h) h.chp = h.pnet ? (h.net - h.pnet) / Math.abs(h.pnet) * 100 : '';
        if ('share' in (list[0] || {})) h.share = list.reduce(function (s, r) { return s + (Number(r.share) || 0); }, 0);
        return h;
      };
      var main = nums[0] ? nums[0].k : null;
      if (!order && main) keys.sort(function (a, b) { var sa = g[a].reduce(function (s, r) { return s + (Number(r[main]) || 0); }, 0), sb = g[b].reduce(function (s, r) { return s + (Number(r[main]) || 0); }, 0); return sb - sa; });
      var rows = [];
      keys.forEach(function (k, i) { rows.push(head(label(k), g[k], i)); g[k].forEach(function (r) { rows.push(Object.assign({}, r, { _lvl: 1, _g: i })); }); });
      if (other.length) { rows.push(head(kind === 'cacc' || kind === 'cgrp' ? 'أخرى' : 'بدون حساب', other, keys.length)); other.forEach(function (r) { rows.push(Object.assign({}, r, { _lvl: 1, _g: keys.length })); }); }
      var out = Object.assign({}, res, { rows: rows, _lvlc: res.cols.indexOf(ccol), _grouped: kind });
      if (res.chart && !res.chart.rowsOverride) { var hs = rows.filter(function (r) { return r._gh; }).map(function (r) { var o = Object.assign({}, r); delete o._b; delete o._hl; if (res.chart.x && res.chart.x !== ccol.k) o[res.chart.x] = r[ccol.k]; return o; }); out.chart = Object.assign({}, res.chart, { rowsOverride: hs, limit: Math.max(hs.length, 1) }); }
      out.note = (res.note ? res.note + ' · ' : '') + 'مجمّع ' + (kind === 'cacc' ? 'حسب حسابات العملاء المحددة في التصفية' : kind === 'cgrp' ? 'حسب مجموعات العملاء المحددة في التصفية' : kind === 'grp' ? 'حسب مجموعات العملاء' : 'حسب الحساب الأب لكل عميل');
      return out;
    }

    /* ===================== الفلاتر الجاهزة وقالب التجميع =====================
       فلتر جاهز = تصفية محفوظة باسم (عملاء، حسابات، مجموعات، أصناف…) تُستدعى في أي تقرير، أو تُثبَّت لتُطبَّق على كل تقرير يُفتح.
       قالب التجميع = عرض صفوف العملاء مجمّعة تحت مجموعاتها (أو حساباتها الأب) في أي تقرير، ويمكن جعله الافتراضي لكل التقارير. */
    function savedFilters() {
      var l = F.config && Array.isArray(F.config.filters) ? F.config.filters : null;
      if (!l) { try { l = JSON.parse(localStorage.getItem('rk.finFilters') || 'null'); } catch (e) { l = null; } }
      return (l || []).filter(function (x) { return x && x.id && x.name && x.flt; });
    }
    function saveConfigKey(k, value, lsKey) {
      return call('fin_config_save', { key: k, value: value }).then(function (r) {
        F.config = r.config || {}; if (value === null) delete F.config[k]; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); try { localStorage.removeItem(lsKey); } catch (e) {} return false;
      }).catch(function (e) {
        if (!/غير معروف/.test(e.message)) throw e;
        try { if (value === null) localStorage.removeItem(lsKey); else localStorage.setItem(lsKey, JSON.stringify(value)); } catch (x) {} if (F.config) delete F.config[k]; return true;
      });
    }
    function storeFilters(list) { return saveConfigKey('filters', list.length ? list : null, 'rk.finFilters'); }
    // نوع الفلتر: الأبعاد التي فيه (لترتيب الفلاتر الجاهزة في أقسام)
    var FKEY_ORDER = ['cgrp', 'cacc', 'cust', 'ag', 'cat', 'item', 'st', 'u', 'xcgrp', 'xcacc', 'xcust', 'xcat', 'xitem'];
    var FKEY_SEC = { cgrp: 'مجموعات العملاء', xcgrp: 'مجموعات العملاء', cacc: 'حسابات العملاء', xcacc: 'حسابات العملاء', cust: 'العملاء', xcust: 'العملاء', ag: 'المناديب', cat: 'فئات المناديب', xcat: 'فئات المناديب', item: 'الأصناف', xitem: 'الأصناف', st: 'المخازن', u: 'المستخدمون' };
    function fltType(f) { f = fObj(f); var ks = FKEY_ORDER.filter(function (k) { return f[k] && f[k].length; }), secs = []; ks.forEach(function (k) { var s0 = FKEY_SEC[k] || k; if (secs.indexOf(s0) < 0) secs.push(s0); }); return secs.length ? secs.join(' + ') : 'أخرى'; }
    function fltSummary(f) { f = fObj(f); return FKEY_ORDER.filter(function (k) { return f[k] && f[k].length; }).map(function (k) { return (FLT_LABEL[k] || k) + ': ' + f[k].map(function (x) { return fltName(k, x); }).join('، '); }).join(' · '); }
    function fltFor(f, dims) { f = fObj(f); var ok = {}, o = {}; dims.forEach(function (d) { ok[DIM[d][0]] = 1; }); Object.keys(f).forEach(function (k) { if (ok[k] && f[k] && f[k].length) o[k] = f[k].slice(); }); return fCount(o) ? o : null; }
    function groupedSaved(list) {
      var sec = {}, order = [];
      list.forEach(function (x) { var t = fltType(x.flt); if (!sec[t]) { sec[t] = []; order.push(t); } sec[t].push(x); });
      return order.map(function (t) { return [t, sec[t]]; });
    }
    function askName(title, val) {
      return new Promise(function (res) {
        sheet(title, '<div class="form"><div class="field"><label class="lbl" for="snm">الاسم</label><input id="snm" class="input" value="' + esc(val || '') + '" placeholder="مثل: وكلاء الشرقية والغربية"></div><button class="btn primary big" id="snok">حفظ</button></div>', function (s) {
          var i = q('#snm', s.el); setTimeout(function () { i.focus(); i.select(); }, 50);
          var ok = function () { var v = i.value.trim(); if (!v) { i.focus(); return; } s.done = true; s.close(); res(v); };
          q('#snok', s.el).onclick = ok; i.onkeydown = function (e) { if (e.key === 'Enter') ok(); };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function saveCurrentFilter(f) {
      return askName('حفظ كفلتر جاهز', '').then(function (name) {
        if (!name) return;
        var list = savedFilters().slice(); list.push({ id: 'f' + Date.now().toString(36), name: name.slice(0, 60), flt: fObj(f), by: (A.st.user && A.st.user.name) || '' });
        return storeFilters(list).then(function (local) { toast(local ? 'حُفظ على هذا الجهاز فقط حتى يُحدَّث الخادم' : 'حُفظ في «الفلاتر الجاهزة»'); A.render(); });
      }).catch(function (e) { toast(e.message, true); });
    }
    // قائمة الفلاتر الجاهزة لاختيار واحد منها في تقرير
    function pickSaved(dims) {
      return new Promise(function (res) {
        var list = savedFilters();
        sheet('الفلاتر الجاهزة', '<div class="sf-pick">' + groupedSaved(list).map(function (g) {
          return '<div class="sf-sec">' + esc(g[0]) + '</div>' + g[1].map(function (x) {
            var fit = fltFor(x.flt, dims), part = fit && fCount(fit) < fCount(x.flt);
            return '<button class="item tap sf-it" data-sf="' + esc(x.id) + '"' + (fit ? '' : ' disabled') + '><div class="main"><b>' + esc(x.name) + '</b><div class="meta"><span>' + esc(fltSummary(x.flt)) + '</span>' + (!fit ? '<span class="derr">لا يناسب هذا التقرير</span>' : part ? '<span class="muted">يُطبَّق جزء منه فقط</span>' : '') + '</div></div></button>';
          }).join('');
        }).join('') + '</div>', function (s) {
          qa('[data-sf]', s.el).forEach(function (b) { b.onclick = function () { s.done = true; s.close(); res(list.filter(function (x) { return x.id === b.dataset.sf; })[0]); }; });
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    // الفلتر المثبّت: يُطبَّق على كل تقرير يُفتح بعده (إن كان التقرير يقبل أبعاده)
    function pinnedFilter() { if (F.pinF === undefined) { try { F.pinF = JSON.parse(localStorage.getItem('rk.finPin') || 'null'); } catch (e) { F.pinF = null; } } return F.pinF; }
    function setPinned(x) { F.pinF = x || null; try { if (x) localStorage.setItem('rk.finPin', JSON.stringify(x)); else localStorage.removeItem('rk.finPin'); } catch (e) {} }

    // قسم «الفلاتر الجاهزة» في الصفحة الأولى للتقارير
    function savedHomeHTML() {
      var list = savedFilters(), pin = pinnedFilter();
      var h = '<section class="card sf-home"><div class="sf-head"><h2>الفلاتر الجاهزة <span class="badge">' + list.length + '</span></h2>' + (pin ? '<span class="sf-pin-on">مثبّت الآن: <b>' + esc(pin.name) + '</b><button class="btn sm ghost" data-sfunpin>إلغاء التثبيت</button></span>' : '') + '</div>';
      if (!list.length) return h + '<p class="small muted" style="margin:0">لا توجد فلاتر محفوظة بعد. افتح أي تقرير، اختر التصفية التي تريدها (عملاء، حسابات، مجموعات، أصناف…) ثم اضغط «☆ حفظ كفلتر جاهز»، فتظهر هنا لتستدعيها في أي وقت.</p></section>';
      h += '<p class="small muted" style="margin:0 0 10px">«تثبيت» يطبّق الفلتر على كل تقرير تفتحه حتى تلغيه. ويمكن أيضاً اختياره من زر «الفلاتر الجاهزة» داخل أي تقرير.</p>';
      groupedSaved(list).forEach(function (g) {
        h += '<div class="sf-sec">' + esc(g[0]) + ' <span class="badge">' + g[1].length + '</span></div><div class="sf-grid">' + g[1].map(function (x) {
          var on = pin && pin.id === x.id;
          return '<div class="sf-card' + (on ? ' on' : '') + '"><b>' + esc(x.name) + '</b><span class="sf-sum">' + esc(fltSummary(x.flt)) + '</span>' + (x.by ? '<span class="small muted">' + esc(x.by) + '</span>' : '') +
            '<div class="sf-act"><button class="btn sm ' + (on ? 'ghost' : 'primary') + '" data-sfpin="' + esc(x.id) + '">' + (on ? 'مثبّت ✓' : 'تثبيت على كل التقارير') + '</button>' +
            (canEdit() ? '<button class="iconbtn" data-sfren="' + esc(x.id) + '" title="إعادة تسمية" aria-label="إعادة تسمية">✎</button><button class="iconbtn" data-sfdel="' + esc(x.id) + '" title="حذف" aria-label="حذف">✕</button>' : '') + '</div></div>';
        }).join('') + '</div>';
      });
      return h + '</section>';
    }
    function bindSavedHome(m) {
      var list = savedFilters();
      qa('[data-sfpin]', m).forEach(function (b) { b.onclick = function () { var x = list.filter(function (y) { return y.id === b.dataset.sfpin; })[0], pin = pinnedFilter(); setPinned(pin && pin.id === x.id ? null : { id: x.id, name: x.name, flt: x.flt }); toast(pinnedFilter() ? 'سيُطبَّق «' + x.name + '» على كل تقرير تفتحه' : 'أُلغي التثبيت'); A.render(); }; });
      var up = q('[data-sfunpin]', m); if (up) up.onclick = function () { setPinned(null); A.render(); };
      qa('[data-sfdel]', m).forEach(function (b) { b.onclick = function () { var x = list.filter(function (y) { return y.id === b.dataset.sfdel; })[0]; A.confirmBox('حذف الفلتر', 'حذف الفلتر الجاهز «' + esc(x.name) + '»؟', 'حذف').then(function (y) { if (!y) return; var pin = pinnedFilter(); if (pin && pin.id === x.id) setPinned(null); storeFilters(list.filter(function (z) { return z.id !== x.id; })).then(function () { toast('حُذف'); A.render(); }).catch(function (e) { toast(e.message, true); }); }); }; });
      qa('[data-sfren]', m).forEach(function (b) { b.onclick = function () { var x = list.filter(function (y) { return y.id === b.dataset.sfren; })[0]; askName('إعادة تسمية الفلتر', x.name).then(function (n) { if (!n) return; var l2 = list.map(function (z) { return z.id === x.id ? Object.assign({}, z, { name: n }) : z; }); storeFilters(l2).then(function () { var pin = pinnedFilter(); if (pin && pin.id === x.id) setPinned(Object.assign({}, pin, { name: n })); A.render(); }).catch(function (e) { toast(e.message, true); }); }); }; });
    }

    // شريط قالب التجميع فوق جدول التقرير
    function grpBarHTML(res, p) {
      var cur = p.cgx && p.cgx !== 'auto' ? p.cgx : 'auto', def = grpDefault(), eff = grpMode(p), bySel = res._grouped === 'cacc' || res._grouped === 'cgrp';
      return '<div class="grp-bar"><span class="grp-t">تجميع العملاء:</span>' + (bySel ? '<span class="small muted">حسب ما حددته في التصفية</span>' :
        GRP_MODES.map(function (m0) { var on = eff === m0[0] || (m0[0] === 'grp' && eff === 'parent' && cur === 'grp'); return '<button class="chip' + (on ? ' on' : '') + '" data-cgx="' + m0[0] + '">' + m0[1] + '</button>'; }).join('') +
        (canEdit() && eff !== def ? '<button class="btn sm ghost" data-cgxdef="' + eff + '">اجعله الافتراضي لكل التقارير</button>' : (def !== 'none' ? '<span class="small muted">' + (cur === 'auto' ? '(الافتراضي لكل التقارير)' : '') + '</span>' : ''))) + '</div>';
    }
    function bindGrpBar(m, p, save) {
      qa('[data-cgx]', m).forEach(function (b) { b.onclick = function () { p.cgx = b.dataset.cgx === grpDefault() ? 'auto' : b.dataset.cgx; save(); A.render(); }; });
      qa('[data-cgxdef]', m).forEach(function (d) { d.onclick = function () {
        var v = d.dataset.cgxdef, ui = Object.assign({}, (F.config && F.config.ui) || {}, { grp: v });
        saveConfigKey('ui', ui, 'rk.finUi').then(function (local) { if (local) try { localStorage.setItem('rk.finUi', JSON.stringify(ui)); } catch (e) {} p.cgx = 'auto'; save(); toast(v === 'none' ? 'أُلغي الافتراضي: تقارير العملاء بدون تجميع' : 'أصبح الافتراضي في كل تقارير العملاء: ' + GRP_MODES.filter(function (x) { return x[0] === v; })[0][1]); A.render(); }).catch(function (e) { toast(e.message, true); });
      }; });
    }
    // في أي تقرير (حتى لو لم تكن صفوفه عملاء): تنبيه بالقالب الافتراضي المفعّل مع تغييره أو إلغائه مباشرة
    function grpDefaultHTML() {
      var def = grpDefault(); if (def === 'none') return '';
      return '<div class="grp-def"><span>قالب تجميع العملاء الافتراضي: <b>' + esc(GRP_MODES.filter(function (x) { return x[0] === def; })[0][1]) + '</b> <span class="small muted">(يُطبَّق على كل تقارير العملاء)</span></span>' +
        (canEdit() ? '<span class="grp-def-act">' + GRP_MODES.filter(function (x) { return x[0] !== def; }).map(function (x) { return '<button class="btn sm ' + (x[0] === 'none' ? 'ghost danger-t' : 'ghost') + '" data-cgxdef="' + x[0] + '">' + (x[0] === 'none' ? 'إلغاء الافتراضي' : 'تغييره إلى: ' + x[1]) + '</button>'; }).join('') + '</span>' : '') + '</div>';
    }
    // اختيار القالب الافتراضي من الإعدادات
    function grpDefaultSettingsHTML() {
      var def = grpDefault();
      return '<div class="card"><h2>قالب تجميع العملاء الافتراضي</h2><p class="small muted" style="margin:0 0 10px">كيف تُعرض صفوف العملاء في كل التقارير ما لم تغيّره في تقرير بعينه.</p><div class="chips">' +
        GRP_MODES.map(function (x) { return '<button class="chip' + (def === x[0] ? ' on' : '') + '" data-cgxdef="' + x[0] + '"' + (canEdit() ? '' : ' disabled') + '>' + x[1] + '</button>'; }).join('') + '</div></div>';
    }

    /* ===================== تصنيفات الأصناف ومجموعاتها =====================
       التصنيف: شجرة سراج (الشركة ← الفئة) مربوطة بكل صنف. المجموعة: اسم + تصنيفات و/أو أصناف تختارها في الإعدادات،
       وتظهر معها مجموعات الأصناف المعرّفة في سراج إن كان لها أصناف. */
    function iclOf(item) { return (T().item[item] || {}).cl || ''; }
    function iclAnc(cid) {
      var c = F.cache.iclAnc || (F.cache.iclAnc = {});
      if (c[cid]) return c[cid];
      var out = [], x = T().icl[cid], g = 0;
      while (x && g++ < 10) { out.push(x.id); x = x.parent ? T().icl[x.parent] : null; }
      return (c[cid] = out);
    }
    function iclName(cid) { var c = T().icl[cid]; return c ? c.name : (cid ? 'تصنيف ' + cid : 'بدون تصنيف'); }
    function iclTop(item) { var a = iclAnc(iclOf(item)); return a.length ? a[a.length - 1] : ''; }
    function iclMatch(list, item) { var an = iclAnc(iclOf(item)); return list.some(function (x) { return an.indexOf(String(x).replace(/^@/, '')) >= 0; }); }
    // شجرة التصنيفات مرتبة (الأب ثم أبناؤه) مع عدد الأصناف تحت كل تصنيف
    function iclTree() {
      if (F.cache.iclTree) return F.cache.iclTree;
      var Tt = T(), kids = {}, cnt = {};
      Object.keys(Tt.icl).forEach(function (id) { var p0 = Tt.icl[id].parent && Tt.icl[Tt.icl[id].parent] ? Tt.icl[id].parent : ''; (kids[p0] = kids[p0] || []).push(id); });
      Object.keys(Tt.item).forEach(function (it) { iclAnc(iclOf(it)).forEach(function (c) { cnt[c] = (cnt[c] || 0) + 1; }); });
      var out = [], walk = function (p0, lvl) { (kids[p0] || []).sort(function (a, b) { return String(Tt.icl[a].code || Tt.icl[a].name).localeCompare(String(Tt.icl[b].code || Tt.icl[b].name)); }).forEach(function (id) { var c = Tt.icl[id]; out.push({ id: id, name: c.name, code: c.code, lvl: lvl, n: cnt[id] || 0, leaf: !(kids[id] || []).length }); walk(id, lvl + 1); }); };
      walk('', 0);
      return (F.cache.iclTree = out);
    }
    function igUser() {
      var l = F.config && Array.isArray(F.config.igroups) ? F.config.igroups : null;
      if (!l) { try { l = JSON.parse(localStorage.getItem('rk.finIgroups') || 'null'); } catch (e) { l = null; } }
      return (l || []).filter(function (g) { return g && g.id && g.name; });
    }
    // كل مجموعات الأصناف: المعرّفة في الإعدادات ثم مجموعات سراج التي لها أصناف
    function igrpList() {
      if (F.cache.igl) return F.cache.igl;
      var Tt = T(), out = igUser().map(function (g) { return { id: g.id, name: g.name, sub: [(g.cls || []).length ? (g.cls || []).map(iclName).join('، ') : '', (g.items || []).length ? (g.items || []).length + ' صنف' : ''].filter(String).join(' · '), cls: g.cls || [], items: g.items || [] }; });
      var sg = {}; Object.keys(Tt.item).forEach(function (it) { String(Tt.item[it].ig || '').split(',').filter(String).forEach(function (g) { (sg[g] = sg[g] || []).push(it); }); });
      Object.keys(sg).forEach(function (g) { var x = Tt.igr[g] || Tt.igr[(Tt.item[sg[g][0]].br ? Tt.item[sg[g][0]].br + '-' : '') + g]; out.push({ id: 's:' + g, name: (x ? x.name : 'مجموعة ' + g) + ' (سراج)', sub: sg[g].length + ' صنف', cls: [], items: sg[g] }); });
      return (F.cache.igl = out);
    }
    function igrpName(id) { var g = igrpList().filter(function (x) { return x.id === id; })[0]; return g ? g.name : id; }
    function igrpIn(item, gid) { var g = igrpList().filter(function (x) { return x.id === gid; })[0]; if (!g) return false; if (g.items.indexOf(item) >= 0) return true; var an = iclAnc(iclOf(item)); return g.cls.some(function (c) { return an.indexOf(c) >= 0; }); }
    function igrpMatch(list, item) { return list.some(function (x) { return igrpIn(item, String(x).replace(/^@/, '')); }); }
    function igrpOf(item) { var l = igrpList(); for (var i = 0; i < l.length; i++) if (igrpIn(item, l[i].id)) return l[i].id; return ''; }

    /* ---------- إعدادات مجموعات الأصناف ---------- */
    function igDraft() { if (!F.igDraft) F.igDraft = JSON.parse(JSON.stringify(igUser())); return F.igDraft; }
    function igSettingsHTML() {
      var d = igDraft(), Tt = T(), nCl = Object.keys(Tt.icl).length;
      var h = '<div class="card"><h2>مجموعات الأصناف</h2><p class="small muted" style="margin:0 0 10px">اجمع الأصناف في مجموعات بالاسم الذي تريده: اختر تصنيفاً أو أكثر من شجرة تصنيفات سراج (فتدخل كل أصنافه)، و/أو أصنافاً بعينها. تظهر في التصفية «مجموعات الأصناف» في كل التقارير، وفي تقارير الأصناف.</p>' +
        (nCl ? '' : '<div class="msg info">لم تصل تصنيفات الأصناف من سراج بعد. ثبّت الوكيل 2.3.0 لترسل التصنيفات، وحتى ذلك الحين يمكنك اختيار الأصناف بعينها.</div>');
      if (!d.length) h += '<div class="empty" style="margin:0 0 10px">لا توجد مجموعات بعد.' + (nCl ? ' اضغط «إنشاء من تصنيفات سراج» لتُنشأ مجموعة لكل تصنيف رئيسي (مثل الشركات).' : '') + '</div>';
      h += '<div class="cg-list">' + d.map(function (g, i) {
        var cls = (g.cls || []).map(function (c, j) { return '<span class="col-pill">' + esc(iclName(c)) + '<button type="button" data-igrm="' + i + '|cls|' + j + '" aria-label="إزالة">×</button></span>'; }).join('');
        var its = (g.items || []).map(function (it, j) { return '<span class="col-pill">' + esc(itemName(it)) + '<button type="button" data-igrm="' + i + '|items|' + j + '" aria-label="إزالة">×</button></span>'; }).join('');
        return '<div class="cg-item"><div class="cg-top"><span class="cg-ord">' + (i + 1) + '</span><input class="input cg-name" data-igname="' + i + '" value="' + esc(g.name) + '" placeholder="اسم المجموعة"><button class="btn sm ghost danger" data-igdel="' + i + '">حذف</button></div>' +
          '<div class="st-pills cg-accs">' + cls + its + (nCl ? '<button class="btn sm" data-igcls="' + i + '">+ تصنيفات</button>' : '') + '<button class="btn sm ghost" data-igit="' + i + '">+ أصناف</button></div></div>';
      }).join('') + '</div>';
      h += '<div class="row" style="margin-top:12px;flex-wrap:wrap;gap:8px"><button class="btn" data-igadd>+ مجموعة جديدة</button>' + (nCl ? '<button class="btn ghost" data-igauto>إنشاء من تصنيفات سراج</button>' : '') + '<span class="grow small muted">' + (F.igDirty ? 'لديك تعديلات غير محفوظة' : '') + '</span>' +
        (F.igDirty ? '<button class="btn ghost" data-igundo>تراجع</button>' : '') + '<button class="btn primary" data-igsave' + (canEdit() ? '' : ' disabled') + '>حفظ</button></div></div>';
      var sg = igrpList().filter(function (g) { return /^s:/.test(g.id); });
      if (sg.length) h += '<div class="card"><h3>مجموعات الأصناف في سراج</h3><p class="small muted" style="margin:0">' + sg.map(function (g) { return esc(g.name) + ' (' + esc(g.sub) + ')'; }).join(' · ') + '</p></div>';
      return h;
    }
    function bindIgSettings(m) {
      var d = igDraft(), dirty = function () { F.igDirty = true; };
      qa('[data-igname]', m).forEach(function (el) { el.oninput = function () { d[Number(el.dataset.igname)].name = el.value; dirty(); }; });
      qa('[data-igdel]', m).forEach(function (b) { b.onclick = function () { d.splice(Number(b.dataset.igdel), 1); dirty(); A.render(); }; });
      qa('[data-igrm]', m).forEach(function (b) { b.onclick = function () { var x = b.dataset.igrm.split('|'); d[Number(x[0])][x[1]].splice(Number(x[2]), 1); dirty(); A.render(); }; });
      qa('[data-igcls]', m).forEach(function (b) { b.onclick = function () { var g = d[Number(b.dataset.igcls)]; pickMulti({ title: 'تصنيفات «' + (g.name || 'المجموعة') + '»', hint: 'اختيار تصنيف رئيسي يُدخل كل التصنيفات والأصناف تحته', options: iclTree().map(function (c) { return { id: c.id, name: c.name, sub: (c.code || '') + ' · ' + c.n + ' صنف', lvl: c.lvl }; }), value: (g.cls || []).slice() }).then(function (v) { if (!v) return; g.cls = v; if (!g.name && v.length === 1) g.name = iclName(v[0]); dirty(); A.render(); }); }; });
      qa('[data-igit]', m).forEach(function (b) { b.onclick = function () { var g = d[Number(b.dataset.igit)], Tt = T(); pickMulti({ title: 'أصناف «' + (g.name || 'المجموعة') + '»', options: Object.keys(Tt.item).map(function (id) { return { id: id, name: itemName(id), sub: String(Tt.item[id].code || '') + (iclOf(id) ? ' · ' + iclName(iclOf(id)) : '') }; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); }), value: (g.items || []).slice() }).then(function (v) { if (!v) return; g.items = v; dirty(); A.render(); }); }; });
      q('[data-igadd]', m).onclick = function () { d.push({ id: 'i' + Date.now().toString(36), name: '', cls: [], items: [] }); dirty(); A.render(); };
      var au = q('[data-igauto]', m); if (au) au.onclick = function () { var have = {}; d.forEach(function (g) { (g.cls || []).forEach(function (c) { have[c] = 1; }); }); var n = 0; iclTree().filter(function (c) { return c.lvl === 0 && c.n; }).forEach(function (c) { if (have[c.id]) return; d.push({ id: 'i' + Date.now().toString(36) + n, name: c.name, cls: [c.id], items: [] }); n++; }); if (!n) { toast('لا توجد تصنيفات رئيسية جديدة'); return; } dirty(); toast('أُضيفت ' + n + ' مجموعة، راجعها ثم احفظ'); A.render(); };
      var un = q('[data-igundo]', m); if (un) un.onclick = function () { F.igDraft = null; F.igDirty = false; A.render(); };
      q('[data-igsave]', m).onclick = function () {
        if (d.some(function (g) { return !String(g.name || '').trim() || !((g.cls || []).length || (g.items || []).length); })) { toast('لكل مجموعة اسم وتصنيف أو صنف واحد على الأقل', true); return; }
        var val = d.map(function (g) { return { id: g.id, name: String(g.name).trim().slice(0, 60), cls: (g.cls || []).slice(0, 100), items: (g.items || []).slice(0, 500) }; }), b = this; busy(b, true);
        saveConfigKey('igroups', val.length ? val : null, 'rk.finIgroups').then(function (local) { F.igDraft = null; F.igDirty = false; resetCache(); toast(local ? 'حُفظت على هذا الجهاز فقط حتى يُحدَّث الخادم' : 'حُفظت مجموعات الأصناف'); A.render(); }).catch(function (e) { busy(b, false); toast(e.message, true); });
      };
    }

    /* ---------- تقارير التصنيفات والمجموعات ---------- */
    var ITM_F = ['item', 'icl', 'igrp', 'cust', 'st', 'ag', 'cat', 'xitem'];
    function iclLevelKey(item, lvl) { var a = iclAnc(iclOf(item)).slice().reverse(); return a.length ? a[Math.min(lvl, a.length - 1)] : ''; }
    R.item_class_sales = { cat: 'items', name: 'المبيعات حسب تصنيف الأصناف', desc: 'شجرة التصنيفات (الشركة ثم الفئة): الكمية والصافي والربح والهامش والحصة وعدد الأصناف والعملاء لكل تصنيف', params: ['period', 'flt'], fdims: ITM_F,
      run: function (p) {
        if (!Object.keys(T().icl).length) return emptyR('لم تصل تصنيفات الأصناف من سراج بعد. ثبّت الوكيل 2.3.0 لترسلها.');
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          var an = iclAnc(iclOf(x.l.item)); if (!an.length) an = ['~'];
          an.forEach(function (c) { var r = g[c] || (g[c] = { net: 0, profit: 0, qty: 0, it: {}, cu: {} }); r.net += x.s * x.val; r.profit += x.s * x.profit; r.qty += x.s * x.qty; if (x.s > 0) { r.it[x.l.item] = 1; r.cu[x.v.ck] = 1; } });
        });
        var tops = iclTree().filter(function (c) { return c.lvl === 0; }), tn = tops.reduce(function (s0, c) { return s0 + ((g[c.id] || {}).net || 0); }, 0) + ((g['~'] || {}).net || 0);
        var rows = iclTree().filter(function (c) { return g[c.id]; }).map(function (c) { var r = g[c.id]; return { name: c.name, code: c.code, qty: r.qty, net: r.net, profit: r.profit, margin: pct(r.profit, r.net), share: pct(r.net, tn), items: Object.keys(r.it).length, cust: Object.keys(r.cu).length, _lvl: c.lvl, _b: c.lvl === 0 }; });
        if (g['~']) { var r0 = g['~']; rows.push({ name: 'بدون تصنيف', qty: r0.qty, net: r0.net, profit: r0.profit, margin: pct(r0.profit, r0.net), share: pct(r0.net, tn), items: Object.keys(r0.it).length, cust: Object.keys(r0.cu).length, _b: true }); }
        var cols = [C('code', 'الرمز'), C('name', 'التصنيف'), C('qty', 'صافي الكمية', 'qty'), C('net', 'صافي المبيعات', 'money'), C('share', 'الحصة', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('items', 'الأصناف المباعة', 'int'), C('cust', 'العملاء', 'int')];
        var top = rows.filter(function (r) { return r._b; }), t = { name: 'الإجمالي', _b: true, qty: sum(top, 'qty'), net: sum(top, 'net'), profit: sum(top, 'profit') }; t.margin = pct(t.profit, t.net); t.share = 100;
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], rowsOverride: top.map(function (r) { return { name: r.name, net: r.net }; }) } }, p);
      } };
    R.item_class_month = { cat: 'items', name: 'تصنيفات الأصناف شهرياً', desc: 'جدول: صف لكل تصنيف (الشركة أو الفئة) وعمود لكل شهر، بالقيمة أو الربح أو الكمية', params: ['period', 'rmeas', 'flt'], fdims: ITM_F,
      sel: [['icll', 'مستوى التصنيف', [['0', 'الشركة (التصنيف الرئيسي)'], ['1', 'الفئة (التصنيف الفرعي)']]]],
      run: function (p) { var lv = Number(p.icll || 0); var r = repPivot(p, function (x) { return iclLevelKey(x.l.item, lv) || '~'; }, function (x) { var k = iclLevelKey(x.l.item, lv); return k ? iclName(k) : 'بدون تصنيف'; }, function (x) { return x.d.slice(0, 7); }, function (x) { return monthLabel(x.d.slice(0, 7)); }, p.rmeas, function (a, b) { return a.k < b.k ? -1 : 1; }); r.cols[0].l = 'التصنيف'; return withNote(r, p); } };
    R.item_class_cust = { cat: 'items', name: 'العملاء × تصنيفات الأصناف', desc: 'جدول: صف لكل عميل وعمود لكل تصنيف (الشركة أو الفئة): ماذا يشتري كل عميل من كل شركة', params: ['period', 'rmeas', 'top', 'flt'], fdims: ITM_F,
      sel: [['icll', 'مستوى التصنيف', [['0', 'الشركة (التصنيف الرئيسي)'], ['1', 'الفئة (التصنيف الفرعي)']]]],
      run: function (p) { var lv = Number(p.icll || 0); var r = repPivot(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }, function (x) { return iclLevelKey(x.l.item, lv) || '~'; }, function (x) { var k = iclLevelKey(x.l.item, lv); return k ? iclName(k) : 'بدون تصنيف'; }, p.rmeas); r.cols[0].l = 'العميل'; return withNote(topN(r, p), p); } };
    R.item_class_rep = { cat: 'items', name: 'المناديب × تصنيفات الأصناف', desc: 'جدول: صف لكل مندوب وعمود لكل تصنيف: ما يبيعه كل مندوب من كل شركة أو فئة', params: ['period', 'rmeas', 'flt'], fdims: ITM_F,
      sel: [['icll', 'مستوى التصنيف', [['0', 'الشركة (التصنيف الرئيسي)'], ['1', 'الفئة (التصنيف الفرعي)']]]],
      run: function (p) { var lv = Number(p.icll || 0); var r = repPivot(p, function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag || '0'); }, function (x) { return iclLevelKey(x.l.item, lv) || '~'; }, function (x) { var k = iclLevelKey(x.l.item, lv); return k ? iclName(k) : 'بدون تصنيف'; }, p.rmeas); r.cols[0].l = 'المندوب'; return withNote(r, p); } };
    R.item_groups = { cat: 'items', name: 'ملخص مجموعات الأصناف', desc: 'لكل مجموعة أصناف (من الإعدادات وسراج): الكمية والصافي والربح والهامش والحصة والعملاء والفترة السابقة', params: ['period', 'flt'], fdims: ITM_F,
      run: function (p) {
        var gl = igrpList(); if (!gl.length) return emptyR('لا توجد مجموعات أصناف بعد. عرّفها من الإعدادات ← مجموعات الأصناف.');
        var pr = prevRange(p.from, p.to, p.preset), agg = function (from, to) { var g = {}; facts('s', from, to, p.flt).forEach(function (x) { gl.forEach(function (gg) { if (!igrpIn(x.l.item, gg.id)) return; var r = g[gg.id] || (g[gg.id] = { net: 0, profit: 0, qty: 0, cu: {} }); r.net += x.s * x.val; r.profit += x.s * x.profit; r.qty += x.s * x.qty; if (x.s > 0) r.cu[x.v.ck] = 1; }); }); return g; };
        var a = agg(p.from, p.to), b = agg(pr[0], pr[1]), S0 = salesStats(p.from, p.to, p.flt);
        var rows = gl.map(function (g) { var r = a[g.id] || { net: 0, profit: 0, qty: 0, cu: {} }, o = (b[g.id] || {}).net || 0; return { name: g.name, qty: r.qty, net: r.net, share: pct(r.net, S0.net), profit: r.profit, margin: pct(r.profit, r.net), cust: Object.keys(r.cu).length, pnet: o, chp: o ? (r.net - o) / Math.abs(o) * 100 : '' }; });
        var cols = [C('name', 'المجموعة'), C('qty', 'صافي الكمية', 'qty'), C('net', 'صافي المبيعات', 'money'), C('share', 'من إجمالي المبيعات', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('cust', 'العملاء', 'int'), C('pnet', 'الفترة السابقة', 'money'), C('chp', 'التغير %', 'pct')];
        return withNote({ cols: cols, rows: rows, note: 'قد يقع الصنف في أكثر من مجموعة، لذلك لا يُجمع الإجمالي.', chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] } }, p);
      } };

    /* ---------- تجميع صفوف الأصناف ---------- */
    var IGRP_MODES = [['none', 'بدون تجميع'], ['top', 'حسب الشركة (التصنيف الرئيسي)'], ['cl', 'حسب الفئة'], ['igrp', 'حسب مجموعات الأصناف']];
    function itemNameMap() { if (F.cache.inm) return F.cache.inm; var m = {}, Tt = T(); Object.keys(Tt.item).forEach(function (id) { var n = itemName(id); if (!m[n]) m[n] = id; }); return (F.cache.inm = m); }
    function itemGroupBy(res, flt, mode) {
      var f = parseFilter(flt) || {};
      if (!res || res.empty || !res.rows || !res.rows.length || res._grouped || res.rows.some(function (r) { return r._b || r._lvl; })) return res;
      var nm = itemNameMap(), textCols = res.cols.filter(function (c) { return !isNum(c); }), icol = null, best = 0;
      var key = function (r, c) { return r._item || nm[plain(r[c.k]).trim().replace(/ \(.*\)$/, '')] || nm[plain(r[c.k]).trim()]; };
      textCols.slice(0, 3).forEach(function (c) { var n = res.rows.filter(function (r) { return key(r, c); }).length; if (n > best) { best = n; icol = c; } });
      if (!icol || best < res.rows.length * 0.6) return res;
      res._itemRows = true;
      var kind = f.icl && f.icl.length > 1 ? 'icl' : f.igrp && f.igrp.length > 1 ? 'igrp' : mode && mode !== 'none' ? mode : '';
      if (kind === 'igrp' && !(f.igrp && f.igrp.length > 1) && !igrpList().length) kind = '';
      if ((kind === 'top' || kind === 'cl') && !Object.keys(T().icl).length) kind = '';
      if (!kind) return res;
      var sel = (f[kind] || []).map(function (x) { return String(x).replace(/^@/, ''); });
      var keyOf = kind === 'icl' && sel.length > 1 ? function (it) { var an = iclAnc(iclOf(it)), bi = null, bd = 1e9; sel.forEach(function (id) { var d = an.indexOf(id); if (d >= 0 && d < bd) { bd = d; bi = id; } }); return bi; }
        : kind === 'igrp' && sel.length > 1 ? function (it) { for (var i = 0; i < sel.length; i++) if (igrpIn(it, sel[i])) return sel[i]; return null; }
        : kind === 'top' ? function (it) { return iclTop(it) || null; } : kind === 'cl' ? function (it) { return iclOf(it) || null; } : function (it) { return igrpOf(it) || null; };
      var label = kind === 'igrp' ? igrpName : iclName;
      var g = {}, keys = [], other = [];
      res.rows.forEach(function (r) { var k = keyOf(key(r, icol)); if (!k) { other.push(r); return; } if (!g[k]) { g[k] = []; keys.push(k); } g[k].push(r); });
      var nums = res.cols.filter(function (c) { return isNum(c) && c.t !== 'pct' && !GRP_NOSUM.test(c.k); }), main = nums[0] && nums[0].k;
      if (main) keys.sort(function (a, b) { var s0 = function (k) { return g[k].reduce(function (s1, r) { return s1 + (Number(r[main]) || 0); }, 0); }; return s0(b) - s0(a); });
      var head = function (name, list, gi) { var h = { _b: true, _hl: true, _g: gi, _gh: 1 }; h[icol.k] = name + ' (' + list.length + ')'; nums.forEach(function (c) { h[c.k] = list.reduce(function (s1, r) { return s1 + (Number(r[c.k]) || 0); }, 0); }); if ('margin' in (list[0] || {}) && 'profit' in h && 'net' in h) h.margin = pct(h.profit, h.net); if ('share' in (list[0] || {})) h.share = list.reduce(function (s1, r) { return s1 + (Number(r.share) || 0); }, 0); return h; };
      var rows = [];
      keys.forEach(function (k, i) { rows.push(head(label(k), g[k], i)); g[k].forEach(function (r) { rows.push(Object.assign({}, r, { _lvl: 1, _g: i })); }); });
      if (other.length) { rows.push(head('أخرى', other, keys.length)); other.forEach(function (r) { rows.push(Object.assign({}, r, { _lvl: 1, _g: keys.length })); }); }
      var out = Object.assign({}, res, { rows: rows, _lvlc: res.cols.indexOf(icol), _grouped: 'item:' + kind, _itemRows: true });
      if (res.chart && !res.chart.rowsOverride) { var hs = rows.filter(function (r) { return r._gh; }).map(function (r) { var o = Object.assign({}, r); delete o._b; delete o._hl; if (res.chart.x && res.chart.x !== icol.k) o[res.chart.x] = r[icol.k]; return o; }); out.chart = Object.assign({}, res.chart, { rowsOverride: hs, limit: Math.max(hs.length, 1) }); }
      out.note = (res.note ? res.note + ' · ' : '') + 'الأصناف مجمّعة ' + (kind === 'icl' ? 'حسب التصنيفات المحددة في التصفية' : kind === 'igrp' && sel.length > 1 ? 'حسب المجموعات المحددة في التصفية' : IGRP_MODES.filter(function (m0) { return m0[0] === kind; })[0][1]);
      return out;
    }
    function igrpBarHTML(res, p) {
      if (/^item:(icl|igrp)$/.test(res._grouped || '') && (parseFilter(p.flt) || {})[res._grouped.slice(5)]) return '<div class="grp-bar"><span class="grp-t">تجميع الأصناف:</span><span class="small muted">حسب ما حددته في التصفية</span></div>';
      var cur = p.igx || 'none', hasCl = Object.keys(T().icl).length, hasG = igrpList().length;
      return '<div class="grp-bar"><span class="grp-t">تجميع الأصناف:</span>' + IGRP_MODES.filter(function (m0) { return m0[0] === 'none' || (m0[0] === 'igrp' ? hasG : hasCl); }).map(function (m0) { return '<button class="chip' + (cur === m0[0] ? ' on' : '') + '" data-igx="' + m0[0] + '">' + m0[1] + '</button>'; }).join('') + '</div>';
    }
    function bindIgrpBar(m, p, save) { qa('[data-igx]', m).forEach(function (b) { b.onclick = function () { p.igx = b.dataset.igx; save(); A.render(); }; }); }

    /* ---------- المجموعات المحددة في التصفية كأعمدة مقارنة ---------- */
    // عند اختيار أكثر من مجموعة/حساب عملاء أو تصنيف/مجموعة أصناف: يمكن عرض كل واحد في عمود (في أي تقرير يقبل التصفية)
    function splitInfo(flt) {
      var f = parseFilter(flt); if (!f) return null;
      var defs = [['cgrp', 'مجموعات العملاء', cgName], ['cacc', 'حسابات العملاء', function (id) { var a = acc(id); return a ? a.name : id; }], ['igrp', 'مجموعات الأصناف', igrpName], ['icl', 'تصنيفات الأصناف', iclName]];
      for (var i = 0; i < defs.length; i++) { var v = f[defs[i][0]]; if (v && v.length > 1) return { key: defs[i][0], title: defs[i][1], name: defs[i][2], vals: v.map(function (x) { return String(x).replace(/^@/, ''); }) }; }
      return null;
    }
    function splitBarHTML(res, p) {
      var sp = splitInfo(p.flt); if (!sp) return '';
      var cur = p.gsplit === 'cols' ? 'cols' : 'one';
      return '<div class="grp-def split-bar"><span>' + esc(sp.title) + ' المحددة (' + sp.vals.length + '):</span><span class="grp-def-act"><button class="chip' + (cur === 'one' ? ' on' : '') + '" data-gsplit="one">في جدول واحد' + (res._grouped ? ' (مجمّعة)' : '') + '</button><button class="chip' + (cur === 'cols' ? ' on' : '') + '" data-gsplit="cols">مقارنة: عمود لكل واحدة</button></span></div>';
    }
    function bindSplitBar(m, p, save) { qa('[data-gsplit]', m).forEach(function (b) { b.onclick = function () { p.gsplit = b.dataset.gsplit; save(); A.render(); }; }); }

    /* ===================== تقارير إضافية أساسية في كل الأقسام ===================== */
    var SF3 = ['cust', 'item', 'st', 'ag', 'cat', 'xcust', 'xitem'];
    function evalF(src, from, to, flt) { var r = tryFormula(src, from, to, null, flt); return r.err ? 0 : r.v; }
    function custCity(v) { var cu = T().cu, c = cu[v.cu]; if (c && c.city) return c.city; if (!F.cache.cityByAcc) { var m = {}; Object.keys(cu).forEach(function (k) { if (cu[k].acc && cu[k].city) m[cu[k].acc] = cu[k].city; }); F.cache.cityByAcc = m; } var ct = F.cache.cityByAcc[v.acc]; if (ct) return ct; var a = acc(v.acc); return a && a.parent && acc(a.parent) ? '(' + acc(a.parent).name + ')' : ''; }
    function ymList(from, to) { var out = [], m = from.slice(0, 7); while (m <= to.slice(0, 7)) { out.push(m); m = addD(monthEnd(m), 1).slice(0, 7); } return out; }

    /* ---------- تنفيذية ---------- */
    R.exec_flash = { cat: 'exec', name: 'موجز اليوم مقابل أمس والأسبوع الماضي', desc: 'أهم أرقام يوم تختاره مقارنة بالأمس وبنفس اليوم من الأسبوع الماضي: المبيعات والربح والفواتير والعملاء والتحصيل والمقبوضات والمدفوعات ورصيد الصناديق', params: ['asof', 'flt'], fdims: SF3,
      run: function (p) {
        var d = p.asof, ds = [d, addD(d, -1), addD(d, -7)], st = ds.map(function (x) { return salesStats(x, x, p.flt); }), cs = ds.map(function (x) { return cashStats(x, x); }), co = ds.map(function (x) { return collections(x, x); });
        var M = [['صافي المبيعات', function (i) { return st[i].net; }, 'money'], ['المرتجعات', function (i) { return st[i].ret; }, 'money'], ['مجمل الربح', function (i) { return st[i].profit; }, 'money'], ['هامش الربح %', function (i) { return pct(st[i].profit, st[i].net); }, 'pct'],
          ['فواتير المبيع', function (i) { return st[i].n; }, 'int'], ['العملاء المشترون', function (i) { return st[i].cust; }, 'int'], ['الكمية المباعة', function (i) { return st[i].nqty; }, 'qty'], ['التحصيل من العملاء', function (i) { return co[i]; }, 'money'],
          ['سندات القبض', function (i) { return cs[i].rec; }, 'money'], ['سندات الدفع', function (i) { return cs[i].pay; }, 'money'], ['صافي حركة الصناديق والبنوك', function (i) { return cs[i].boxNet || 0; }, 'money'], ['رصيد الصناديق والبنوك آخر اليوم', function (i) { return cs[i].boxClose || 0; }, 'money']];
        var rows = M.map(function (m) { var a = m[1](0), b = m[1](1), c = m[1](2); return { name: m[0], d0: a, d1: b, d7: c, c1: b ? (a - b) / Math.abs(b) * 100 : '', c7: c ? (a - c) / Math.abs(c) * 100 : '', _fmt: m[2] === 'pct' ? 'pct' : m[2] }; });
        return withNote({ cols: [C('name', 'المؤشر'), C('d0', 'اليوم ' + ds[0], 'money'), C('d1', 'أمس ' + ds[1], 'money'), C('c1', 'التغير عن أمس', 'pct'), C('d7', 'الأسبوع الماضي ' + ds[2], 'money'), C('c7', 'التغير عن الأسبوع الماضي', 'pct')], rows: rows, subtitle: 'يوم ' + d }, p);
      } };
    R.exec_ytd = { year: true, needPrev: true, cat: 'exec', name: 'الأداء التراكمي مقابل السنة السابقة', desc: 'لكل شهر: صافي المبيعات والربح والتحصيل للشهر وتراكمياً من بداية السنة، مقارنة بنفس الشهر والتراكمي في السنة السابقة', params: ['period', 'flt'], fdims: SF3,
      run: function (p) {
        var y = p.to.slice(0, 4), from = y + '-01-01', ms = ymList(from, p.to), cum = { n: 0, pn: 0, pr: 0, c: 0 }, rows = [];
        ms.forEach(function (m) {
          var a = m + '-01', b = monthEnd(m) > p.to ? p.to : monthEnd(m), pa = (+y - 1) + a.slice(4), pb = (+y - 1) + b.slice(4);
          var s = salesStats(a, b, p.flt), ps = salesStats(pa, pb, p.flt), c = collections(a, b);
          cum.n += s.net; cum.pn += ps.net; cum.pr += s.profit; cum.c += c;
          rows.push({ name: monthLabel(m), net: s.net, pnet: ps.net, ch: ps.net ? (s.net - ps.net) / Math.abs(ps.net) * 100 : '', cnet: cum.n, cpnet: cum.pn, cch: cum.pn ? (cum.n - cum.pn) / Math.abs(cum.pn) * 100 : '', profit: s.profit, cprofit: cum.pr, coll: c, ccoll: cum.c });
        });
        var cols = [C('name', 'الشهر'), C('net', 'المبيعات', 'money'), C('pnet', 'نفس الشهر السنة السابقة', 'money'), C('ch', 'التغير %', 'pct'), C('cnet', 'تراكمي من بداية السنة', 'money'), C('cpnet', 'تراكمي السنة السابقة', 'money'), C('cch', 'التغير التراكمي %', 'pct'), C('profit', 'الربح', 'money'), C('cprofit', 'الربح التراكمي', 'money'), C('coll', 'التحصيل', 'money'), C('ccoll', 'التحصيل التراكمي', 'money')];
        return withNote({ cols: cols, rows: rows, subtitle: 'سنة ' + y + ' حتى ' + p.to, chart: { type: 'line', x: 'name', y: ['cnet', 'cpnet'], yl: ['هذه السنة', 'السنة السابقة'] } }, p);
      } };
    R.exec_pace = { cat: 'exec', name: 'وتيرة مبيعات الشهر والمتوقع لنهايته', desc: 'ما تحقق من بداية الشهر حتى اليوم، ومتوسط اليوم، والمتوقع لنهاية الشهر بنفس الوتيرة، مقارنة بالشهر السابق كاملاً', params: ['asof', 'flt'], fdims: SF3,
      run: function (p) {
        var d = p.asof, m = d.slice(0, 7), a = m + '-01', e = monthEnd(m), dn = days(a, d) + 1, dt = days(a, e) + 1, s = salesStats(a, d, p.flt);
        var lm = addD(a, -1).slice(0, 7), ls = salesStats(lm + '-01', monthEnd(lm), p.flt), lsSame = salesStats(lm + '-01', addD(lm + '-01', dn - 1) > monthEnd(lm) ? monthEnd(lm) : addD(lm + '-01', dn - 1), p.flt);
        var rows = [['صافي المبيعات', s.net, ls.net, lsSame.net], ['مجمل الربح', s.profit, ls.profit, lsSame.profit], ['الكمية المباعة', s.nqty, ls.nqty, lsSame.nqty], ['فواتير المبيع', s.n, ls.n, lsSame.n]].map(function (x) {
          return { name: x[0], done: x[1], perday: x[1] / dn, proj: x[1] / dn * dt, last: x[2], lastSame: x[3], vsSame: x[3] ? (x[1] - x[3]) / Math.abs(x[3]) * 100 : '', vsLast: x[2] ? (x[1] / dn * dt - x[2]) / Math.abs(x[2]) * 100 : '' };
        });
        return withNote({ cols: [C('name', 'المؤشر'), C('done', 'المتحقق حتى اليوم', 'money'), C('perday', 'متوسط اليوم', 'money'), C('proj', 'المتوقع لنهاية الشهر', 'money'), C('lastSame', 'الشهر السابق لنفس عدد الأيام', 'money'), C('vsSame', 'التغير عنه %', 'pct'), C('last', 'الشهر السابق كاملاً', 'money'), C('vsLast', 'المتوقع مقابله %', 'pct')], rows: rows, note: 'مضى ' + dn + ' يوماً من ' + dt + ' يوماً في الشهر. المتوقع = متوسط اليوم × أيام الشهر.' }, p);
      } };

    /* ---------- القوائم المالية ---------- */
    R.stmt_wc = { year: true, cat: 'stmt', name: 'السيولة ورأس المال العامل شهرياً', desc: 'في نهاية كل شهر: الصناديق والبنوك، مديونية العملاء، قيمة المخزون، ما للموردين، وصافي رأس المال العامل التشغيلي', params: ['period'],
      run: function (p) {
        var rows = ymList(p.from, p.to).map(function (m) {
          var e = monthEnd(m) > p.to ? p.to : monthEnd(m), cash = evalF('رصيد_صناديق()', e, e), ar = evalF('مديونية()', e, e), inv = evalF('مخزون_قيمة()', e, e), ap = evalF('الموردون()', e, e);
          return { name: monthLabel(m), cash: cash, ar: ar, inv: inv, ap: ap, wc: cash + ar + inv - ap, quick: ap ? (cash + ar) / ap : '' };
        });
        return { cols: [C('name', 'نهاية الشهر'), C('cash', 'الصناديق والبنوك', 'money'), C('ar', 'مديونية العملاء', 'money'), C('inv', 'قيمة المخزون', 'money'), C('ap', 'ما للموردين', 'money'), C('wc', 'رأس المال العامل التشغيلي', 'money'), C('quick', 'السيولة السريعة (مرة)', 'qty')], rows: rows,
          note: 'رأس المال العامل التشغيلي = الصناديق + مديونية العملاء + المخزون − الموردون. السيولة السريعة = (الصناديق + العملاء) ÷ الموردين.', chart: { type: 'line', x: 'name', y: ['cash', 'ar', 'inv', 'ap'], yl: ['الصناديق', 'العملاء', 'المخزون', 'الموردون'] } };
      } };
    R.stmt_exp_ratio = { cat: 'stmt', name: 'المصروفات كنسبة من المبيعات', desc: 'كل حساب مصروفات: قيمته في الفترة ونسبته من صافي المبيعات ومن مجمل الربح، وتغيره عن الفترة السابقة', params: ['period', 'level'],
      run: function (p) {
        var net = salesStats(p.from, p.to).net, gp = salesStats(p.from, p.to).profit, pr = prevRange(p.from, p.to, p.preset), lvl = Number(p.level || 3), rows = [];
        var exp = plIds('3'); if (!exp.length) return emptyR('لم تُعرف حسابات المصروفات في الدليل');
        var roots = {}; exp.forEach(function (id) { roots[id] = 1; });
        F.D.accList.filter(function (a) { return (a.lvl === lvl || (a.leaf && a.lvl < lvl)) && descend(a.id).some(function (x) { return roots[x]; }); }).forEach(function (a) {
          var ids = descend(a.id).filter(function (x) { return roots[x]; }), b = balance(ids, p.from, p.to), o = balance(ids, pr[0], pr[1]), v = b.dr - b.cr, ov = o.dr - o.cr;
          if (Math.abs(v) < 0.0005 && Math.abs(ov) < 0.0005) return;
          rows.push({ code: a.code, name: a.name, v: v, ps: pct(v, net), pg: pct(v, gp), pv: ov, ch: ov ? (v - ov) / Math.abs(ov) * 100 : '', _acc: a.id });
        });
        rows.sort(function (x, y) { return y.v - x.v; });
        var t = { name: 'الإجمالي', _b: true, v: sum(rows, 'v'), pv: sum(rows, 'pv') }; t.ps = pct(t.v, net); t.pg = pct(t.v, gp); t.ch = t.pv ? (t.v - t.pv) / Math.abs(t.pv) * 100 : '';
        return { cols: [C('code', 'الرمز'), C('name', 'المصروف'), C('v', 'القيمة', 'money'), C('ps', 'من المبيعات %', 'pct'), C('pg', 'من مجمل الربح %', 'pct'), C('pv', 'الفترة السابقة', 'money'), C('ch', 'التغير %', 'pct')], rows: rows, total: t, note: 'صافي المبيعات ' + fm(net) + ' · مجمل الربح ' + fm(gp), chart: { type: 'hbar', x: 'name', y: ['v'], yl: ['المصروف'], limit: 12 } };
      } };

    /* ---------- محاسبية ---------- */
    R.acct_abnormal = { cat: 'acct', name: 'حسابات بأرصدة عكس طبيعتها', desc: 'عملاء بأرصدة دائنة، وموردون بأرصدة مدينة، وصناديق وبنوك بأرصدة سالبة: لمراجعة الأخطاء والدفعات المقدمة', params: ['asof'],
      run: function (p) {
        var rows = [], add = function (ids, sign, kind) { ids.forEach(function (id) { var b = balance([id], null, p.asof).close * sign; if (b < -0.0005) rows.push({ kind: kind, code: (acc(id) || {}).code, name: accName(id), v: -b, last: lastMove(id, p.asof), _acc: id }); }); };
        add(recvIds(), 1, 'عميل برصيد دائن'); add(payIds(), -1, 'مورد برصيد مدين'); add(boxIds(), 1, 'صندوق/بنك برصيد سالب');
        rows.sort(function (a, b) { return b.v - a.v; });
        var res = { cols: [C('kind', 'النوع'), C('code', 'الرمز'), C('name', 'الحساب'), C('v', 'المبلغ العكسي', 'money'), C('last', 'آخر حركة')], rows: rows, total: sumRow(rows, [C('v', '', 'money')]) };
        if (!rows.length) res.empty = 'لا توجد حسابات بأرصدة عكس طبيعتها في ' + p.asof;
        return res;
      } };
    R.acct_daily = { cat: 'acct', name: 'مجاميع القيود اليومية', desc: 'لكل يوم: عدد القيود ومجموع المدين حسب النوع (قبض، دفع، قيود يومية، قيود فواتير) والمستخدمين', params: ['period'],
      run: function (p) {
        var g = {}, K = { r: 'قبض', p: 'دفع', j: 'يومية', i: 'فواتير', o: 'افتتاحي' };
        entriesIn(p.from, p.to).forEach(function (l) { var r = g[l.d] || (g[l.d] = { name: l.d, n: 0, tot: 0, r: 0, p: 0, j: 0, i: 0, o: 0, us: {} }), t = entryTotal(F.D.byEntry[l.e]); r.n++; r.tot += t; r[l.k] = (r[l.k] || 0) + t; if (l.u) r.us[l.u] = 1; });
        var rows = Object.keys(g).sort().map(function (k) { var r = g[k]; r.users = Object.keys(r.us).map(userName).join('، '); return r; });
        var cols = [C('name', 'اليوم'), C('n', 'عدد القيود', 'int'), C('tot', 'مجموع المدين', 'money')].concat(['r', 'p', 'j', 'i'].map(function (k) { return C(k, K[k], 'money'); })).concat([C('users', 'المستخدمون')]);
        return { cols: cols, rows: rows, total: sumRow(rows, cols), chart: { type: 'bar', x: 'name', y: ['tot'], yl: ['المجموع'] } };
      } };

    /* ---------- المبيعات ---------- */
    R.sales_city = { cat: 'sales', name: 'المبيعات حسب المدينة / المنطقة', desc: 'صافي المبيعات والربح والهامش والعملاء والفواتير لكل مدينة من بطاقة العميل في سراج؛ وإن لم تُسجّل المدينة يُستعمل الحساب الرئيسي للعميل (المنطقة) بين قوسين', params: ['period', 'flt'], fdims: SF3,
      run: function (p) {
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { var c = custCity(x.v) || 'غير محددة', r = g[c] || (g[c] = { name: c, net: 0, profit: 0, qty: 0, n: {}, cu: {} }); r.net += x.s * x.val; r.profit += x.s * x.profit; r.qty += x.s * x.qty; if (x.s > 0) { r.n[x.v.id] = 1; r.cu[x.v.ck] = 1; } });
        var tn = 0, rows = Object.keys(g).map(function (k) { var r = g[k]; tn += r.net; return { name: r.name, n: Object.keys(r.n).length, cust: Object.keys(r.cu).length, qty: r.qty, net: r.net, profit: r.profit, margin: pct(r.profit, r.net) }; }).sort(function (a, b) { return b.net - a.net; });
        rows.forEach(function (r) { r.share = pct(r.net, tn); });
        var cols = [C('name', 'المدينة / المنطقة'), C('cust', 'العملاء', 'int'), C('n', 'الفواتير', 'int'), C('qty', 'الكمية', 'qty'), C('net', 'صافي المبيعات', 'money'), C('share', 'الحصة', 'pct'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct')];
        var t = sumRow(rows, cols); t.share = 100; t.margin = pct(t.profit, t.net);
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], limit: 12 } }, p);
      } };
    R.sales_week = { year: true, cat: 'sales', name: 'المبيعات أسبوعياً مع المقارنة', desc: 'لكل أسبوع (يبدأ السبت): صافي المبيعات والربح والفواتير والعملاء، والتغير عن الأسبوع السابق', params: ['period', 'flt'], fdims: SF3,
      run: function (p) {
        var rows = [], w = weekStart(p.from), prev = null;
        while (w <= p.to) {
          var a = w < p.from ? p.from : w, b = addD(w, 6) > p.to ? p.to : addD(w, 6), s = salesStats(a, b, p.flt);
          rows.push({ name: a + ' – ' + b, net: s.net, profit: s.profit, margin: pct(s.profit, s.net), n: s.n, cust: s.cust, ch: prev && prev.net ? (s.net - prev.net) / Math.abs(prev.net) * 100 : '' }); prev = s; w = addD(w, 7);
        }
        var cols = [C('name', 'الأسبوع'), C('net', 'صافي المبيعات', 'money'), C('ch', 'التغير عن السابق', 'pct'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('n', 'الفواتير', 'int'), C('cust', 'العملاء', 'int')];
        var t = sumRow(rows, cols); t.ch = ''; t.margin = pct(t.profit, t.net); t.cust = '';
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] } }, p);
      } };
    R.sales_store_item = { cat: 'sales', name: 'الأصناف × المخازن', desc: 'جدول: صف لكل صنف وعمود لكل مخزن (أو سيارة مندوب)، بالقيمة أو الربح أو الكمية', params: ['period', 'rmeas', 'top', 'flt'], fdims: SF3,
      run: function (p) { var r = repPivot(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }, function (x) { return x.l.st || '0'; }, function (x) { return storeName(x.l.st); }, p.rmeas); r.cols[0].l = 'الصنف'; return withNote(topN(r, p), p); } };

    /* ---------- المديونيات والتحصيل ---------- */
    R.debts_no_pay = { cat: 'debts', name: 'عملاء مدينون لم يسددوا منذ مدة', desc: 'العملاء الذين عليهم رصيد ولم يدفعوا منذ عدد أيام تختاره: الرصيد وتاريخ آخر سداد وآخر فاتورة وأيام التوقف', params: ['asof', 'idle', 'flt'], fdims: ['cust', 'cacc', 'cgrp', 'xcust'],
      run: function (p) {
        var lim = Number(p.idle || 30), rows = [];
        recvFor(p.flt).forEach(function (id) {
          var b = balance([id], null, p.asof).close; if (b <= 0.0005) return;
          var lc = lastCredit(id, p.asof), ld = ''; (F.D.byAcc[id] || []).forEach(function (l) { if (l.d <= p.asof && l.dr) ld = l.d; });
          var since = lc ? days(lc, p.asof) : (ld ? days(ld, p.asof) : 9999);
          if (since < lim) return;
          rows.push({ name: accName(id), code: (acc(id) || {}).code, bal: b, lastCr: lc || 'لم يسدد', since: since === 9999 ? '' : since, lastDr: ld, od: overdue(id, p.asof, 90), _c1: id });
        });
        rows.sort(function (a, b) { return b.bal - a.bal; });
        var res = withNote({ cols: [C('code', 'الرمز'), C('name', 'العميل'), C('bal', 'الرصيد', 'money'), C('lastCr', 'آخر سداد'), C('since', 'أيام بلا سداد', 'int'), C('lastDr', 'آخر فاتورة/مدين'), C('od', 'منه أقدم من 90 يوماً', 'money')], rows: rows, total: sumRow(rows, [C('bal', '', 'money'), C('od', '', 'money')]) }, p);
        if (!rows.length) res.empty = 'كل العملاء المدينين سددوا خلال آخر ' + lim + ' يوماً';
        return res;
      } };
    R.debts_aging_trend = { year: true, cat: 'debts', name: 'تطور أعمار الديون شهرياً', desc: 'في نهاية كل شهر: إجمالي مديونية العملاء موزعة على شرائح العمر، ونسبة الدين القديم', params: ['period', 'flt'], fdims: ['cust', 'cacc', 'cgrp', 'xcust'],
      run: function (p) {
        var ids = recvFor(p.flt);
        var rows = ymList(p.from, p.to).map(function (m) {
          var e = monthEnd(m) > p.to ? p.to : monthEnd(m), a = aging(ids, e, 1), t = a.total || {};
          return { name: monthLabel(m), b1: t.b1 || 0, b2: t.b2 || 0, b3: t.b3 || 0, b4: t.b4 || 0, b5: t.b5 || 0, tot: t.tot || 0 };
        });
        rows.forEach(function (r) { r.old = pct(r.b4 + r.b5, r.tot); });
        return withNote({ cols: [C('name', 'نهاية الشهر'), C('b1', '0-30', 'money'), C('b2', '31-60', 'money'), C('b3', '61-90', 'money'), C('b4', '91-120', 'money'), C('b5', 'أكثر من 120', 'money'), C('tot', 'الإجمالي', 'money'), C('old', 'أقدم من 90 يوماً %', 'pct')], rows: rows, chart: { type: 'line', x: 'name', y: ['tot', 'b5'], yl: ['الإجمالي', 'أكثر من 120'] } }, p);
      } };

    /* ---------- الصناديق والبنوك ---------- */
    R.cash_by_party = { cat: 'cash', name: 'أين ذهبت النقدية ومن أين جاءت', desc: 'المقبوضات والمدفوعات للصناديق والبنوك موزعة على الحسابات المقابلة (عملاء، موردون، مصروفات…) حسب المستوى', params: ['period', 'level'],
      run: function (p) {
        var bx = boxIds(), set = {}; if (!bx.length) return emptyR('عرّف الصناديق والبنوك أولاً من الإعدادات');
        bx.forEach(function (x) { set[x] = 1; });
        var lvl = Number(p.level || 3), g = {}, keyOf = function (id) { var a = acc(id); while (a && a.lvl > lvl && a.parent && acc(a.parent)) a = acc(a.parent); return a ? a.id : id; };
        entriesIn(p.from, p.to).forEach(function (l0) {
          var ls = F.D.byEntry[l0.e], bin = 0, bout = 0; ls.forEach(function (l) { if (set[l.a]) { bin += l.dr; bout += l.cr; } }); if (!bin && !bout) return;
          var others = ls.filter(function (l) { return !set[l.a]; }), od = sum(others, 'dr'), oc = sum(others, 'cr'), own = Math.min(bin, bout), vin = bin - own, vout = bout - own;
          if (vin > 0.0005 && !oc) { var u = g._u || (g._u = { inn: 0, out: 0 }); u.inn += vin; vin = 0; }
          if (vout > 0.0005 && !od) { var u2 = g._u || (g._u = { inn: 0, out: 0 }); u2.out += vout; vout = 0; }
          others.forEach(function (l) { var k = keyOf(l.a), r = g[k] || (g[k] = { inn: 0, out: 0 }); if (l.cr && oc) r.inn += vin * l.cr / oc; if (l.dr && od) r.out += vout * l.dr / od; });
        });
        var rows = Object.keys(g).map(function (k) { var r = g[k], a = k === '_u' ? { name: 'داخل قيود بين الصناديق نفسها' } : acc(k) || {}; return { code: a.code, name: a.name || k, inn: r.inn, out: r.out, net: r.inn - r.out, _acc: k === '_u' ? undefined : k }; }).filter(function (r) { return r.inn > 0.0005 || r.out > 0.0005; }).sort(function (a, b) { return (b.inn + b.out) - (a.inn + a.out); });
        var cols = [C('code', 'الرمز'), C('name', 'الحساب المقابل'), C('inn', 'مقبوضات منه', 'money'), C('out', 'مدفوعات إليه', 'money'), C('net', 'الصافي', 'money')];
        return { cols: cols, rows: rows, total: sumRow(rows, cols), note: 'التحويلات بين الصناديق والبنوك لا تظهر هنا (انظر «التحويلات بين الصناديق والبنوك»).', chart: { type: 'hbar', x: 'name', y: ['out'], yl: ['المدفوعات'], limit: 12 } };
      } };
    R.cash_transfers = { cat: 'cash', name: 'التحويلات بين الصناديق والبنوك', desc: 'كل قيد نقل مالاً من صندوق أو بنك إلى آخر: التاريخ والرقم والمبلغ ومن وإلى، مع الإجمالي لكل اتجاه', params: ['period'],
      run: function (p) {
        var bx = boxIds(), set = {}; if (!bx.length) return emptyR('عرّف الصناديق والبنوك أولاً من الإعدادات');
        bx.forEach(function (x) { set[x] = 1; });
        var rows = [];
        entriesIn(p.from, p.to).forEach(function (l0) {
          var ls = F.D.byEntry[l0.e]; if (!ls.every(function (l) { return set[l.a]; })) return;
          var to = ls.filter(function (l) { return l.dr; }), fr = ls.filter(function (l) { return l.cr; }); if (!to.length || !fr.length) return;
          rows.push({ d: l0.d, no: l0.no, from: uniq(fr.map(function (l) { return accName(l.a); })).join('، '), to: uniq(to.map(function (l) { return accName(l.a); })).join('، '), v: sum(to, 'dr'), desc: l0.ed || '' });
        });
        rows.sort(function (a, b) { return a.d < b.d ? -1 : 1; });
        var res = { cols: [C('d', 'التاريخ'), C('no', 'الرقم'), C('from', 'من'), C('to', 'إلى'), C('v', 'المبلغ', 'money'), C('desc', 'البيان')], rows: rows, total: sumRow(rows, [C('v', '', 'money')]) };
        if (!rows.length) res.empty = 'لا توجد تحويلات بين الصناديق والبنوك في هذه الفترة';
        return res;
      } };

    /* ---------- الأصناف والمخزون ---------- */
    R.stock_card = { year: true, cat: 'stock', name: 'بطاقة صنف (حركة تفصيلية برصيد تراكمي)', desc: 'كل حركة على صنف تختاره: بضاعة أول المدة والمشتريات والمبيعات والمرتجعات والمناقلات، مع الكمية الواردة والصادرة والرصيد بعد كل حركة', params: ['period', 'item1'],
      run: function (p) {
        var it = p.item1; if (!it || !T().item[it]) return emptyR('اختر الصنف');
        var f = (T().item[it] || {}).f || 1, Tt = T(), rows = [], open = 0;
        var TYPES = {}; TYPES[OPEN_STOCK] = 'بضاعة أول المدة'; TYPES[PUR] = 'شراء'; TYPES[PRET] = 'مرتجع شراء'; TYPES[SALE] = 'مبيع'; TYPES[SRET] = 'مرتجع مبيع'; TYPES[ISSUE] = 'إخراج'; TYPES[TRANSFER] = 'مناقلة';
        var list = Tt.invl.filter(function (l) { return l.item === it && l.v && (STOCK_SIGN[l.v.c] || l.v.c === TRANSFER); }).sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : a.v.dt > b.v.dt ? 1 : 0; });
        list.forEach(function (l) {
          var q = l.qb / f, sign = l.v.c === TRANSFER ? 0 : STOCK_SIGN[l.v.c], d = l.v.d;
          if (d < p.from) { open += sign * q; return; } if (d > p.to) return;
          rows.push({ d: String(l.v.dt).slice(0, 16), no: l.v.no, type: TYPES[l.v.c] || '', party: [SALE, SRET, PUR, PRET].indexOf(l.v.c) >= 0 ? l.v.name : l.v.c === TRANSFER ? storeName(l.st) + ' ← ' + storeName(l.ts) : storeName(l.st), inn: sign > 0 ? q : l.v.c === TRANSFER ? '' : '', out: sign < 0 ? q : '', price: q ? (Number(l.tot) || 0) / q : '', _q: sign * q });
        });
        var bal = open; rows.forEach(function (r) { bal += r._q; r.bal = bal; });
        rows.unshift({ d: '', type: 'رصيد أول المدة', bal: open, _b: true });
        var cols = [C('d', 'التاريخ'), C('no', 'الرقم'), C('type', 'النوع'), C('party', 'الطرف / المخزن'), C('inn', 'وارد', 'qty'), C('out', 'صادر', 'qty'), C('price', 'السعر', 'money'), C('bal', 'الرصيد', 'qty')];
        var t = { type: 'الإجمالي ورصيد آخر المدة', _b: true, inn: sum(rows.slice(1), function (r) { return Number(r.inn) || 0; }), out: sum(rows.slice(1), function (r) { return Number(r.out) || 0; }), bal: bal };
        return { cols: cols, rows: rows, total: t, subtitle: itemName(it) + ' · بوحدة ' + unitOf(it), note: 'الكمية بوحدة البيع الأساسية للصنف. المناقلات بين المخازن لا تغيّر الرصيد الإجمالي.' };
      } };
    R.stock_negative = { cat: 'stock', name: 'أصناف بأرصدة سالبة', desc: 'الأصناف التي رصيدها سالب في مخزن ما (بيع أكثر من المتوفر أو خطأ إدخال): الكمية وآخر حركة', params: ['asof'],
      run: function (p) {
        var b = stockAt(p.asof), rows = [];
        Object.keys(b).forEach(function (k) { var x = k.split('|'), it = T().item[x[1]] || { f: 1 }, q = b[k] / (it.f || 1); if (q < -0.0005) rows.push({ name: itemName(x[1]), unit: unitOf(x[1]), st: storeName(x[0]), q: q, val: b[k] * costAt(x[1], p.asof) }); });
        rows.sort(function (a, b2) { return a.q - b2.q; });
        var res = { cols: [C('name', 'الصنف'), C('unit', 'الوحدة'), C('st', 'المخزن'), C('q', 'الرصيد', 'qty'), C('val', 'القيمة بالتكلفة', 'money')], rows: rows, total: sumRow(rows, [C('val', '', 'money')]) };
        if (!rows.length) res.empty = 'لا توجد أصناف بأرصدة سالبة في ' + p.asof;
        return res;
      } };
    R.item_margin_month = { year: true, cat: 'items', name: 'هامش ربح الأصناف شهرياً', desc: 'جدول: صف لكل صنف وعمود لكل شهر بهامش الربح %، لاكتشاف الأصناف التي يتآكل هامشها', params: ['period', 'top', 'flt'], fdims: SF3,
      run: function (p) {
        var ms = ymList(p.from, p.to), g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { var r = g[x.l.item] || (g[x.l.item] = { net: 0, pf: 0 }), m = x.d.slice(0, 7); r.net += x.s * x.val; r.pf += x.s * x.profit; r['n' + m] = (r['n' + m] || 0) + x.s * x.val; r['p' + m] = (r['p' + m] || 0) + x.s * x.profit; });
        var rows = Object.keys(g).map(function (k) { var r = g[k], o = { name: itemName(k), net: r.net, margin: pct(r.pf, r.net) }; ms.forEach(function (m) { o['m' + m] = r['n' + m] ? pct(r['p' + m], r['n' + m]) : ''; }); var f0 = o['m' + ms[0]], l0 = o['m' + ms[ms.length - 1]]; o.trend = f0 !== '' && l0 !== '' && f0 !== undefined && l0 !== undefined ? l0 - f0 : ''; return o; }).sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'الصنف'), C('net', 'صافي المبيعات', 'money'), C('margin', 'هامش الفترة', 'pct')].concat(ms.map(function (m) { return C('m' + m, monthLabel(m), 'pct'); })).concat([C('trend', 'تغير الهامش (نقاط)', 'qty')]);
        return withNote(topN({ cols: cols, rows: rows, note: '«تغير الهامش» = هامش آخر شهر − هامش أول شهر بالنقاط المئوية.' }, p), p);
      } };

    /* ---------- المشتريات ---------- */
    R.purch_month = { year: true, cat: 'purch', name: 'المشتريات شهرياً حسب المورد', desc: 'جدول: صف لكل مورد وعمود لكل شهر بصافي المشتريات', params: ['period'],
      run: function (p) {
        var ms = ymList(p.from, p.to), g = {};
        facts('p', p.from, p.to).forEach(function (x) { var r = g[x.v.ck] || (g[x.v.ck] = { name: x.v.name, tot: 0 }), m = 'm' + x.d.slice(0, 7); r[m] = (r[m] || 0) + x.s * x.val; r.tot += x.s * x.val; });
        var rows = Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.tot - a.tot; });
        var cols = [C('name', 'المورد')].concat(ms.map(function (m) { return C('m' + m, monthLabel(m), 'money'); })).concat([C('tot', 'الإجمالي', 'money')]);
        return { cols: cols, rows: rows, total: sumRow(rows, cols) };
      } };
    R.purch_vs_sales = { cat: 'purch', name: 'المشتريات مقابل المبيعات لكل صنف', desc: 'لكل صنف: الكمية المشتراة والمباعة والفرق، والرصيد في نهاية الفترة، ومتوسط سعر الشراء والبيع والفرق بينهما', params: ['period', 'flt'], fdims: ['item', 'icl', 'igrp', 'st', 'xitem'],
      run: function (p) {
        var g = {}, mk = function (id) { return g[id] || (g[id] = { pq: 0, pv: 0, sq: 0, sv: 0 }); };
        facts('p', p.from, p.to, p.flt).forEach(function (x) { var r = mk(x.l.item); r.pq += x.s * x.qty; r.pv += x.s * x.val; });
        facts('s', p.from, p.to, p.flt).forEach(function (x) { var r = mk(x.l.item); r.sq += x.s * x.qty; r.sv += x.s * x.val; });
        var stk = stockAt(p.to), sb = {}; Object.keys(stk).forEach(function (k) { var it = k.split('|')[1]; sb[it] = (sb[it] || 0) + stk[k]; });
        var rows = Object.keys(g).map(function (k) { var r = g[k], f = (T().item[k] || {}).f || 1, bp = r.pq ? r.pv / r.pq : '', sp = r.sq ? r.sv / r.sq : ''; return { name: itemName(k), unit: unitOf(k), pq: r.pq, sq: r.sq, diff: r.pq - r.sq, bal: (sb[k] || 0) / f, bp: bp, sp: sp, gap: bp !== '' && sp !== '' ? pct(sp - bp, sp) : '' }; }).sort(function (a, b) { return b.sq - a.sq; });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة'), C('pq', 'المشتراة', 'qty'), C('sq', 'المباعة', 'qty'), C('diff', 'الفرق', 'qty'), C('bal', 'الرصيد آخر الفترة', 'qty'), C('bp', 'متوسط الشراء', 'money'), C('sp', 'متوسط البيع', 'money'), C('gap', 'الفرق من سعر البيع %', 'pct')];
        return withNote({ cols: cols, rows: rows }, p);
      } };

    /* ---------- تحليلية ---------- */
    R.an_season = { year: true, cat: 'analytics', name: 'مؤشر الموسمية الشهري', desc: 'مبيعات كل شهر مقارنة بمتوسط الأشهر (100 = متوسط): أي الأشهر أقوى وأيها أضعف، بالقيمة وبعدد الفواتير والعملاء', params: ['period', 'flt'], fdims: SF3,
      run: function (p) {
        var ms = ymList(p.from, p.to), st = ms.map(function (m) { var e = monthEnd(m) > p.to ? p.to : monthEnd(m), a = m + '-01' < p.from ? p.from : m + '-01', s = salesStats(a, e, p.flt), dd = days(a, e) + 1; return { m: m, net: s.net / dd * 30, n: s.n / dd * 30, cust: s.cust }; });
        var avg = function (k) { return st.length ? sum(st, k) / st.length : 0; }, an = avg('net'), ai = avg('n'), ac = avg('cust');
        var rows = st.map(function (s) { return { name: monthLabel(s.m), net: s.net, idx: an ? s.net / an * 100 : 0, nidx: ai ? s.n / ai * 100 : 0, cidx: ac ? s.cust / ac * 100 : 0 }; });
        return withNote({ cols: [C('name', 'الشهر'), C('net', 'المبيعات (معدلة لـ30 يوماً)', 'money'), C('idx', 'مؤشر القيمة', 'qty'), C('nidx', 'مؤشر عدد الفواتير', 'qty'), C('cidx', 'مؤشر العملاء', 'qty')], rows: rows, note: 'المؤشر 100 = متوسط الأشهر في الفترة؛ 120 = أعلى من المتوسط بـ20%. القيم معدلة لعدد أيام الشهر.', chart: { type: 'bar', x: 'name', y: ['idx'], yl: ['مؤشر القيمة'] } }, p);
      } };

    /* ===================== تقارير إضافية: الأسعار والتخفيضات، العملاء والأصناف، المشتريات بأكثر من سعر، المخازن، أرقام السنة ===================== */
    (function () {
      var ii = CATS.map(function (c) { return c[0]; }).indexOf('items');
      CATS.splice(ii + 1, 0, ['disc', 'الأسعار والتخفيضات']);
    })();
    var SF4 = ['cust', 'cacc', 'cgrp', 'item', 'icl', 'igrp', 'st', 'ag', 'cat', 'xcust', 'xitem'];
    var IF4 = ['item', 'icl', 'igrp', 'st', 'xitem'];

    /* ---------- قوائم الأسعار من سراج (تصل مع الوكيل 2.4.0) ---------- */
    function iprMap() {
      if (F.cache.iprm) return F.cache.iprm;
      var m = {}, P = T().ipr || {};
      Object.keys(P).forEach(function (k) { var r = P[k]; (m[r.item] || (m[r.item] = [])).push(r); });
      return (F.cache.iprm = m);
    }
    function hasIpr() { return Object.keys(T().ipr || {}).length > 0; }
    var LVL_KEY = { a: 'pa', b: 'pb', c: 'pc', min: 'pmin', buy: 'pbuy' };
    var REF_OPTS = [['a', 'سعر البيع أ (قائمة الأسعار)'], ['b', 'سعر البيع ب'], ['c', 'سعر البيع ج'], ['min', 'الحد الأدنى للبيع'], ['max', 'أعلى سعر بيع فعلي في الفترة']];
    // السعر المرجعي لوحدة الأساس: من قائمة الأسعار لنفس الوحدة، وإلا الوحدة الافتراضية
    function listBase(item, un, lvl) {
      var rows = iprMap()[item]; if (!rows || !rows.length) return null;
      var k = LVL_KEY[lvl] || 'pa', r = rows.filter(function (x) { return x.un === un && Number(x[k]) > 0; })[0] || rows.filter(function (x) { return Number(x.def) === 1 && Number(x[k]) > 0; })[0] || rows.filter(function (x) { return Number(x[k]) > 0; })[0];
      return r ? Number(r[k]) / (Number(r.eq) || 1) : null;
    }
    function itemPass(it, fl) { return !fl || linePass({ item: it }, { item: fl.item, xitem: fl.xitem, icl: fl.icl, xicl: fl.xicl, igrp: fl.igrp, xigrp: fl.xigrp }); }
    function grossOf(x) { var l = x.l; return l.p && l.q ? Number(l.p) * Number(l.q) : x.val; }
    function baseQ(x) { return Number(x.l.qb) || 0; }
    // لكل سطر بيع: القيمة بالسعر المرجعي، تخفيض السعر عنه، الخصم الصريح في الفاتورة، والهدايا (سطور بدون قيمة أو كمية هدية)
    function concessions(list, lvl) {
      var maxB = {};
      if (lvl === 'max') list.forEach(function (x) { var q = baseQ(x); if (x.s > 0 && q > 0 && x.val > 0) { var b = grossOf(x) / q; if (!(maxB[x.l.item] >= b)) maxB[x.l.item] = b; } });
      return list.filter(function (x) { return x.s > 0; }).map(function (x) {
        var q = baseQ(x), g = grossOf(x), exp = Math.max(0, g - x.val), free = !x.val && q > 0, ref = lvl === 'max' ? maxB[x.l.item] || null : listBase(x.l.item, x.l.un, lvl);
        var gb = q > 0 && g > 0 ? g / q : null, red = ref && gb !== null && gb < ref * 0.9995 ? (ref - gb) * q : 0;
        var unitP = Number(x.l.p) || (q && x.l.q ? g / x.l.q : 0), giftQ = Number(x.l.g) || 0;
        var giftV = free ? (ref ? ref * q : x.cost) : giftQ * (ref && x.l.q ? ref * q / x.l.q : unitP);
        var listV = ref && !free ? ref * q : g;
        return { x: x, q: q, g: g, exp: exp, red: red, giftV: giftV, giftQ: free ? q : giftQ, ref: ref, gb: gb, listV: listV, conc: red + exp + giftV, below: red > 0 };
      });
    }

    R.disc_summary = { cat: 'disc', name: 'التخفيضات والحسومات والهدايا', desc: 'كم تنازلت الشركة عن السعر: الفرق بين سعر قائمة الأسعار والسعر الفعلي، والخصومات الصريحة في الفواتير، وقيمة الهدايا، ونسبتها من المبيعات؛ حسب الصنف أو العميل أو المندوب أو الفئة أو المخزن أو التصنيف', params: ['period', 'top', 'flt'], fdims: SF4,
      sel: [['by', 'حسب', [['item', 'الصنف'], ['cust', 'العميل'], ['ag', 'المندوب'], ['cat', 'فئة المندوب'], ['st', 'المخزن'], ['icl', 'تصنيف الصنف']]], ['ref', 'مقارنة بـ', REF_OPTS]],
      run: function (p) {
        var by = p.by || 'item', lvl = p.ref || 'a';
        if (lvl !== 'max' && !hasIpr()) lvl = 'max';
        var keyOf = { item: function (x) { return [x.l.item, itemName(x.l.item)]; }, cust: function (x) { return [x.v.ck, x.v.name]; }, ag: function (x) { return [x.v.ag || '0', repName(x.v.ag)]; }, cat: function (x) { var c = repCat(x.v.ag); return [c, c]; }, st: function (x) { return [x.l.st || '0', storeName(x.l.st)]; }, icl: function (x) { var c = iclTop(x.l.item); return [c || '-', c ? iclName(c) : 'بدون تصنيف']; } }[by];
        var g = {};
        concessions(facts('s', p.from, p.to, p.flt), lvl).forEach(function (c) {
          var k = keyOf(c.x), r = g[k[0]] || (g[k[0]] = { id: k[0], name: k[1], listV: 0, g: 0, red: 0, exp: 0, giftV: 0, net: 0, pf: 0, n: 0, nb: 0 });
          r.listV += c.listV; r.g += c.g; r.red += c.red; r.exp += c.exp; r.giftV += c.giftV; r.net += c.x.val; r.pf += c.x.profit; r.n++; if (c.below || c.exp > 0) r.nb++;
        });
        var rows = Object.keys(g).map(function (k) { var r = g[k], o = { name: r.name, listV: r.listV, net: r.net, red: r.red, exp: r.exp, giftV: r.giftV, conc: r.red + r.exp + r.giftV, nbp: pct(r.nb, r.n), pf: r.pf, margin: pct(r.pf, r.net) }; o.cp = pct(o.conc, r.listV + r.giftV); if (by === 'cust' && acc(r.id)) o._c1 = r.id; return o; })
          .filter(function (r) { return r.conc > 0.0005 || r.net > 0.0005; }).sort(function (a, b) { return b.conc - a.conc; });
        var cols = [C('name', { item: 'الصنف', cust: 'العميل', ag: 'المندوب', cat: 'الفئة', st: 'المخزن', icl: 'التصنيف' }[by]), C('listV', 'القيمة بالسعر المرجعي', 'money'), C('red', 'تخفيض السعر', 'money'), C('exp', 'خصم صريح', 'money'), C('giftV', 'قيمة الهدايا', 'money'), C('conc', 'إجمالي التنازل', 'money'), C('cp', 'التنازل %', 'pct'), C('nbp', 'سطور مخفضة %', 'pct'), C('net', 'صافي المبيعات', 'money'), C('pf', 'الربح', 'money'), C('margin', 'الهامش', 'pct')];
        var t = sumRow(rows, cols); t.cp = pct(t.conc, t.listV + t.giftV); t.margin = pct(t.pf, t.net); t.nbp = '';
        var note = lvl === 'max' ? 'السعر المرجعي = أعلى سعر بيع فعلي للصنف في الفترة' + (hasIpr() ? '' : ' (قوائم أسعار سراج تصل بعد تثبيت الوكيل 2.4.0)') : 'السعر المرجعي = ' + REF_OPTS.filter(function (o) { return o[0] === lvl; })[0][1] + ' من بطاقة الصنف في سراج';
        return withNote(topN({ cols: cols, rows: rows, total: t, note: note + '. المرتجعات لا تدخل في حساب التنازل.', chart: { type: 'hbar', x: 'name', y: ['conc'], yl: ['إجمالي التنازل'], limit: 12 } }, p), p);
      } };
    R.disc_lines = { cat: 'disc', name: 'سطور البيع بسعر مخفض أو بخصم', desc: 'كل سطر بيع سعره أقل من السعر المرجعي أو فيه خصم أو هدية: الفاتورة والعميل والمندوب والصنف والسعر المرجعي والسعر الفعلي والفرق وقيمة التنازل', params: ['period', 'top', 'flt'], fdims: SF4,
      sel: [['ref', 'مقارنة بـ', REF_OPTS], ['mind', 'أقل فرق', [['0', 'أي فرق'], ['2', '2% فأكثر'], ['5', '5% فأكثر'], ['10', '10% فأكثر'], ['20', '20% فأكثر']]]],
      run: function (p) {
        var lvl = p.ref || 'a', mn = Number(p.mind || 0); if (lvl !== 'max' && !hasIpr()) lvl = 'max';
        var rows = concessions(facts('s', p.from, p.to, p.flt), lvl).filter(function (c) { return c.conc > 0.0005; }).map(function (c) {
          var x = c.x, f = c.q && x.l.q ? c.q / x.l.q : 1, refU = c.ref ? c.ref * f : '', pu = x.l.q ? c.g / x.l.q : '', dp = refU && pu !== '' ? (refU - pu) / refU * 100 : '';
          return { d: x.d, no: x.v.no, cust: x.v.name, rep: repName(x.v.ag), name: itemName(x.l.item), unit: x.l.un || '', qty: Number(x.l.q) || c.q, ref: refU, p: pu, dp: dp, red: c.red, exp: c.exp, giftV: c.giftV, conc: c.conc, pf: x.profit, _c1: acc(x.v.ck) ? x.v.ck : undefined };
        }).filter(function (r) { return mn ? Number(r.dp) >= mn : true; }).sort(function (a, b) { return b.conc - a.conc; });
        var cols = [C('d', 'التاريخ'), C('no', 'الفاتورة'), C('cust', 'العميل'), C('rep', 'المندوب'), C('name', 'الصنف'), C('unit', 'الوحدة'), C('qty', 'الكمية', 'qty'), C('ref', 'السعر المرجعي', 'money'), C('p', 'السعر الفعلي', 'money'), C('dp', 'الفرق %', 'pct'), C('red', 'تخفيض السعر', 'money'), C('exp', 'خصم صريح', 'money'), C('giftV', 'هدية', 'money'), C('conc', 'إجمالي التنازل', 'money'), C('pf', 'الربح', 'money')];
        var t = sumRow(rows, [C('red', '', 'money'), C('exp', '', 'money'), C('giftV', '', 'money'), C('conc', '', 'money'), C('pf', '', 'money')]); t.d = 'الإجمالي (' + rows.length + ' سطر)';
        var res = withNote(topN({ cols: cols, rows: rows, total: t }, p), p);
        if (!rows.length) res.empty = 'لا توجد سطور مخفضة في هذه الفترة';
        return res;
      } };
    R.disc_compliance = { cat: 'disc', name: 'الالتزام بقوائم الأسعار', desc: 'لكل صنف: أسعار القائمة (أ، ب، ج، الحد الأدنى) وأقل وأعلى ومتوسط سعر بيع فعلي، وتوزيع الكمية المباعة على شرائح الأسعار، والكمية المباعة تحت الحد الأدنى', params: ['period', 'top', 'flt'], fdims: SF4,
      run: function (p) {
        if (!hasIpr()) return emptyR('هذا التقرير يحتاج قوائم أسعار الأصناف من سراج: ثبّت الوكيل 2.4.0 على جهاز الإدارة وانتظر أول مزامنة');
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          var q = baseQ(x); if (x.s < 0 || q <= 0 || !x.val) return;
          var it = x.l.item, r = g[it] || (g[it] = { q: 0, v: 0, mn: null, mx: null, A: 0, B: 0, Cq: 0, L: 0, M: 0 }), b = grossOf(x) / q;
          var A = listBase(it, x.l.un, 'a'), B = listBase(it, x.l.un, 'b'), Cc = listBase(it, x.l.un, 'c'), Mn = listBase(it, x.l.un, 'min'), e = 0.9995;
          r.q += q; r.v += grossOf(x); if (r.mn === null || b < r.mn) r.mn = b; if (r.mx === null || b > r.mx) r.mx = b;
          if (A && b >= A * e) r.A += q; else if (B && b >= B * e) r.B += q; else if (Cc && b >= Cc * e) r.Cq += q; else r.L += q;
          if (Mn && b < Mn * e) r.M += q;
        });
        var rows = Object.keys(g).map(function (it) {
          var r = g[it], f = (T().item[it] || {}).f || 1, lb = function (l) { var v = listBase(it, (T().item[it] || {}).mu, l); return v ? v * f : ''; };
          return { name: itemName(it), unit: unitOf(it), pa: lb('a'), pb: lb('b'), pc: lb('c'), pmin: lb('min'), mn: r.mn * f, avg: r.v / r.q * f, mx: r.mx * f, sa: pct(r.A, r.q), sb: pct(r.B, r.q), sc: pct(r.Cq, r.q), sl: pct(r.L, r.q), sm: pct(r.M, r.q), qty: r.q / f, val: r.v };
        }).sort(function (a, b) { return b.val - a.val; });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة'), C('pa', 'سعر أ', 'money'), C('pb', 'سعر ب', 'money'), C('pc', 'سعر ج', 'money'), C('pmin', 'الحد الأدنى', 'money'), C('mn', 'أقل سعر فعلي', 'money'), C('avg', 'متوسط الفعلي', 'money'), C('mx', 'أعلى سعر فعلي', 'money'),
          C('sa', 'بيع بسعر أ فأعلى %', 'pct'), C('sb', 'بين ب و أ %', 'pct'), C('sc', 'بين ج و ب %', 'pct'), C('sl', 'أقل من ج %', 'pct'), C('sm', 'تحت الحد الأدنى %', 'pct'), C('qty', 'الكمية', 'qty'), C('val', 'القيمة قبل الخصم', 'money')];
        return withNote(topN({ cols: cols, rows: rows, note: 'النسب من الكمية المباعة. الأسعار بالوحدة الرئيسية للصنف.' }, p), p);
      } };
    R.disc_month = { year: true, cat: 'disc', name: 'التخفيضات والهدايا شهرياً', desc: 'لكل شهر: القيمة بالسعر المرجعي، وتخفيض السعر، والخصومات الصريحة، والهدايا، ونسبة التنازل من المبيعات', params: ['period', 'flt'], fdims: SF4,
      sel: [['ref', 'مقارنة بـ', REF_OPTS]],
      run: function (p) {
        var lvl = p.ref || 'a'; if (lvl !== 'max' && !hasIpr()) lvl = 'max';
        var g = {};
        concessions(facts('s', p.from, p.to, p.flt), lvl).forEach(function (c) { var m = c.x.d.slice(0, 7), r = g[m] || (g[m] = { listV: 0, red: 0, exp: 0, giftV: 0, net: 0, pf: 0 }); r.listV += c.listV; r.red += c.red; r.exp += c.exp; r.giftV += c.giftV; r.net += c.x.val; r.pf += c.x.profit; });
        var rows = Object.keys(g).sort().map(function (m) { var r = g[m], conc = r.red + r.exp + r.giftV; return { name: monthLabel(m), listV: r.listV, red: r.red, exp: r.exp, giftV: r.giftV, conc: conc, cp: pct(conc, r.listV + r.giftV), net: r.net, margin: pct(r.pf, r.net) }; });
        var cols = [C('name', 'الشهر'), C('listV', 'بالسعر المرجعي', 'money'), C('red', 'تخفيض السعر', 'money'), C('exp', 'خصم صريح', 'money'), C('giftV', 'الهدايا', 'money'), C('conc', 'إجمالي التنازل', 'money'), C('cp', 'التنازل %', 'pct'), C('net', 'صافي المبيعات', 'money'), C('margin', 'الهامش', 'pct')];
        var t = sumRow(rows, cols); t.cp = pct(t.conc, t.listV + t.giftV); t.margin = '';
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['red', 'exp', 'giftV'], yl: ['تخفيض السعر', 'خصم صريح', 'الهدايا'] } }, p);
      } };

    /* ---------- كل أسعار الصنف في تقرير تجميعي (مبيعات ومشتريات) ---------- */
    function priceGroups(list, partyLbl, minSp) {
      var g = {};
      list.forEach(function (x) {
        var q = baseQ(x); if (x.s < 0 || q <= 0 || !x.val) return;
        var it = x.l.item, f = (T().item[it] || {}).f || 1, up = Math.round(x.val / q * f * 1000) / 1000, r = g[it] || (g[it] = { pr: {}, q: 0, v: 0, pf: 0, last: '', lastP: 0 }), o = r.pr[up] || (r.pr[up] = { q: 0, v: 0, pf: 0, pt: {}, n: {}, first: x.d, last: x.d });
        o.q += q / f; o.v += x.val; o.pf += x.profit || 0; o.pt[x.v.name] = 1; o.n[x.v.id] = 1; if (x.d < o.first) o.first = x.d; if (x.d > o.last) o.last = x.d;
        r.q += q / f; r.v += x.val; r.pf += x.profit || 0; if (x.d >= r.last) { r.last = x.d; r.lastP = up; }
      });
      var rows = [], gi = 0, items = Object.keys(g).filter(function (it) { return Object.keys(g[it].pr).length > 1; }).sort(function (a, b) { return g[b].v - g[a].v; });
      items.forEach(function (it) {
        var r = g[it], ps = Object.keys(r.pr).map(Number).sort(function (a, b) { return a - b; }), mn = ps[0], mx = ps[ps.length - 1], avg = r.v / r.q, sp = mn ? (mx - mn) / mn * 100 : 0;
        if (sp < minSp) return;
        gi++;
        rows.push({ _g: gi, _gh: 1, _b: true, name: itemName(it), unit: unitOf(it), np: ps.length, p: '', mn: mn, avg: avg, mx: mx, sp: sp, lastP: r.lastP, q: r.q, v: r.v, share: 100, pf: r.pf, margin: pct(r.pf, r.v), saving: r.v - mn * r.q, parties: '', n: '' });
        ps.forEach(function (pp) { var o = r.pr[pp]; rows.push({ _g: gi, _lvl: 1, name: 'بسعر ' + fm(pp), unit: '', np: '', p: pp, mn: '', avg: '', mx: '', sp: mn ? (pp - mn) / mn * 100 : 0, lastP: '', q: o.q, v: o.v, share: pct(o.q, r.q), pf: o.pf, margin: pct(o.pf, o.v), saving: o.v - mn * o.q, parties: Object.keys(o.pt).slice(0, 3).join('، ') + (Object.keys(o.pt).length > 3 ? ' و' + (Object.keys(o.pt).length - 3) + ' آخرين' : ''), n: Object.keys(o.n).length, first: o.first, last: o.last }); });
      });
      return rows;
    }
    var SPREAD_SEL = ['minsp', 'أقل فرق بين الأسعار', [['0', 'أي فرق'], ['2', '2% فأكثر'], ['5', '5% فأكثر'], ['10', '10% فأكثر'], ['20', '20% فأكثر']]];
    R.purch_multi_price = { cat: 'purch', name: 'أصناف اشتُريت بأكثر من سعر (تجميعي)', desc: 'كل صنف اشتُري بأسعار مختلفة: صف إجمالي للصنف (عدد الأسعار، أقلها وأعلاها ومتوسطها وآخر سعر والفرق) وتحته كل سعر بكميته وقيمته ونسبته والموردين وتاريخ أول وآخر شراء، والوفر لو اشتُري كله بأقل سعر', params: ['period', 'flt'], fdims: IF4,
      sel: [SPREAD_SEL],
      run: function (p) {
        var rows = priceGroups(facts('p', p.from, p.to, p.flt), 'المورد', Number(p.minsp || 0));
        var cols = [C('name', 'الصنف / السعر'), C('unit', 'الوحدة'), C('np', 'عدد الأسعار', 'int'), C('mn', 'أقل سعر', 'money'), C('avg', 'المتوسط', 'money'), C('mx', 'أعلى سعر', 'money'), C('sp', 'الفرق عن الأقل %', 'pct'), C('lastP', 'آخر سعر', 'money'), C('q', 'الكمية', 'qty'), C('v', 'القيمة', 'money'), C('share', 'من الكمية %', 'pct'), C('saving', 'الزيادة عن أقل سعر', 'money'), C('parties', 'الموردون', 'long'), C('n', 'الفواتير', 'int'), C('first', 'أول شراء'), C('last', 'آخر شراء')];
        var hs = rows.filter(function (r) { return r._gh; }), t = { name: 'الإجمالي (' + hs.length + ' صنف)', _b: true, v: sum(hs, 'v'), saving: sum(hs, 'saving') };
        var res = { cols: cols, rows: rows, total: t, _grouped: true, note: 'الأسعار بالوحدة الرئيسية للصنف وبعد الخصم. «الزيادة عن أقل سعر» = ما دُفع زيادة على أقل سعر شراء في الفترة.' };
        if (!rows.length) res.empty = 'لم يُشترَ أي صنف بأكثر من سعر في هذه الفترة';
        return withNote(res, p);
      } };
    R.sales_item_prices = { cat: 'disc', name: 'كل أسعار البيع لكل صنف (تجميعي)', desc: 'كل صنف بيع بأسعار مختلفة: صف إجمالي للصنف وتحته كل سعر بكميته وقيمته ونسبته وربحه وهامشه والعملاء الذين بيع لهم وتاريخ أول وآخر بيع', params: ['period', 'flt'], fdims: SF4,
      sel: [SPREAD_SEL],
      run: function (p) {
        var rows = priceGroups(facts('s', p.from, p.to, p.flt), 'العميل', Number(p.minsp || 0));
        rows.forEach(function (r) { r.saving = r.saving; });
        var cols = [C('name', 'الصنف / السعر'), C('unit', 'الوحدة'), C('np', 'عدد الأسعار', 'int'), C('mn', 'أقل سعر', 'money'), C('avg', 'المتوسط', 'money'), C('mx', 'أعلى سعر', 'money'), C('sp', 'الفرق عن الأقل %', 'pct'), C('lastP', 'آخر سعر', 'money'), C('q', 'الكمية', 'qty'), C('v', 'القيمة', 'money'), C('share', 'من الكمية %', 'pct'), C('pf', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('parties', 'العملاء', 'long'), C('n', 'الفواتير', 'int'), C('first', 'أول بيع'), C('last', 'آخر بيع')];
        var hs = rows.filter(function (r) { return r._gh; }), t = { name: 'الإجمالي (' + hs.length + ' صنف)', _b: true, v: sum(hs, 'v'), pf: sum(hs, 'pf') }; t.margin = pct(t.pf, t.v);
        var res = { cols: cols, rows: rows, total: t, _grouped: true, note: 'الأسعار بالوحدة الرئيسية للصنف وبعد الخصم.' };
        if (!rows.length) res.empty = 'لم يُبع أي صنف بأكثر من سعر في هذه الفترة';
        return withNote(res, p);
      } };
    R.purch_supplier_cmp = { cat: 'purch', name: 'مقارنة أسعار الموردين لكل صنف', desc: 'للأصناف المشتراة من أكثر من مورد: متوسط سعر كل مورد وآخر سعر والكمية، وأرخص مورد، وفرق كل مورد عنه', params: ['period', 'flt'], fdims: IF4,
      run: function (p) {
        var g = {};
        facts('p', p.from, p.to, p.flt).forEach(function (x) {
          var q = baseQ(x); if (x.s < 0 || q <= 0 || !x.val) return;
          var it = x.l.item, f = (T().item[it] || {}).f || 1, r = g[it] || (g[it] = {}), s = r[x.v.ck] || (r[x.v.ck] = { name: x.v.name, q: 0, v: 0, last: '', lp: 0, n: {} });
          s.q += q / f; s.v += x.val; s.n[x.v.id] = 1; if (x.d >= s.last) { s.last = x.d; s.lp = x.val / q * f; }
        });
        var rows = [], gi = 0;
        Object.keys(g).filter(function (it) { return Object.keys(g[it]).length > 1; }).sort(function (a, b) { var va = 0, vb = 0; Object.keys(g[a]).forEach(function (k) { va += g[a][k].v; }); Object.keys(g[b]).forEach(function (k) { vb += g[b][k].v; }); return vb - va; }).forEach(function (it) {
          var ss = Object.keys(g[it]).map(function (k) { var s = g[it][k]; s.avg = s.v / s.q; return s; }).sort(function (a, b) { return a.avg - b.avg; }), best = ss[0];
          gi++; rows.push({ _g: gi, _gh: 1, _b: true, name: itemName(it), unit: unitOf(it), avg: '', lp: '', q: sum(ss, 'q'), v: sum(ss, 'v'), diff: '', extra: sum(ss, function (s) { return (s.avg - best.avg) * s.q; }), best: best.name });
          ss.forEach(function (s) { rows.push({ _g: gi, _lvl: 1, name: s.name, unit: '', avg: s.avg, lp: s.lp, last: s.last, q: s.q, v: s.v, n: Object.keys(s.n).length, diff: best.avg ? (s.avg - best.avg) / best.avg * 100 : 0, extra: (s.avg - best.avg) * s.q, best: s === best ? 'الأرخص' : '' }); });
        });
        var cols = [C('name', 'الصنف / المورد'), C('unit', 'الوحدة'), C('avg', 'متوسط السعر', 'money'), C('lp', 'آخر سعر', 'money'), C('last', 'آخر شراء'), C('q', 'الكمية', 'qty'), C('v', 'القيمة', 'money'), C('n', 'الفواتير', 'int'), C('diff', 'أغلى من الأرخص %', 'pct'), C('extra', 'الزيادة عن سعر الأرخص', 'money'), C('best', 'الأرخص')];
        var res = { cols: cols, rows: rows, _grouped: true, total: { name: 'الإجمالي', _b: true, extra: sum(rows.filter(function (r) { return r._gh; }), 'extra') } };
        if (!rows.length) res.empty = 'لا يوجد صنف اشتُري من أكثر من مورد في هذه الفترة';
        return withNote(res, p);
      } };

    /* ---------- العملاء والأصناف ---------- */
    R.cust_item_profit = { cat: 'cust', name: 'ربحية الشركة من كل صنف لدى كل عميل', desc: 'لكل عميل وصنف: الكمية والمبيعات والتكلفة والربح والهامش، ومقارنة هامشه بهامش الصنف لدى كل العملاء، ونصيبه من ربح العميل، مع إبراز البيع بخسارة', params: ['period', 'top', 'flt'], fdims: SF4,
      sel: [['sort', 'الترتيب', [['pf', 'الأعلى ربحاً'], ['loss', 'الأقل ربحاً والخسائر'], ['gap', 'هامش أقل من هامش الصنف'], ['val', 'الأعلى مبيعاً']]]],
      run: function (p) {
        var list = facts('s', p.from, p.to, p.flt), it = {}, cu = {}, g = {};
        list.forEach(function (x) {
          var a = it[x.l.item] || (it[x.l.item] = { v: 0, pf: 0 }); a.v += x.s * x.val; a.pf += x.s * x.profit;
          var c = cu[x.v.ck] || (cu[x.v.ck] = 0); cu[x.v.ck] = c + x.s * x.profit;
          var k = x.v.ck + '|' + x.l.item, r = g[k] || (g[k] = { ck: x.v.ck, cname: x.v.name, item: x.l.item, q: 0, v: 0, cost: 0, pf: 0, n: {} }); r.q += x.s * x.qty; r.v += x.s * x.val; r.cost += x.s * x.cost; r.pf += x.s * x.profit; if (x.s > 0) r.n[x.v.id] = 1;
        });
        var rows = Object.keys(g).map(function (k) {
          var r = g[k], im = pct(it[r.item].pf, it[r.item].v), m = pct(r.pf, r.v);
          return { cust: r.cname, name: itemName(r.item), unit: unitOf(r.item), q: r.q, n: Object.keys(r.n).length, v: r.v, cost: r.cost, pf: r.pf, margin: m, im: im, gap: r.v ? m - im : '', share: pct(r.pf, cu[r.ck]), _hl: r.pf < -0.0005, _c1: acc(r.ck) ? r.ck : undefined };
        }).filter(function (r) { return Math.abs(r.v) > 0.0005 || Math.abs(r.pf) > 0.0005; });
        var s = p.sort || 'pf';
        rows.sort(s === 'loss' ? function (a, b) { return a.pf - b.pf; } : s === 'gap' ? function (a, b) { return (Number(a.gap) || 0) - (Number(b.gap) || 0); } : s === 'val' ? function (a, b) { return b.v - a.v; } : function (a, b) { return b.pf - a.pf; });
        if (s === 'gap') rows = rows.filter(function (r) { return r.gap !== '' && r.gap < 0; });
        var cols = [C('cust', 'العميل'), C('name', 'الصنف'), C('unit', 'الوحدة'), C('q', 'الكمية', 'qty'), C('n', 'الفواتير', 'int'), C('v', 'صافي المبيعات', 'money'), C('cost', 'التكلفة', 'money'), C('pf', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('im', 'هامش الصنف لكل العملاء', 'pct'), C('gap', 'الفرق (نقاط)', 'qty'), C('share', 'من ربح العميل %', 'pct')];
        var t = sumRow(rows, cols); t.q = ''; t.n = ''; t.margin = pct(t.pf, t.v); t.im = ''; t.gap = ''; t.share = ''; t.cust = 'الإجمالي (' + rows.length + ')';
        var loss = rows.filter(function (r) { return r.pf < -0.0005; });
        return withNote(topN({ cols: cols, rows: rows, total: t, note: loss.length ? loss.length + ' حالة بيع بخسارة (مظللة) بإجمالي ' + fm(sum(loss, 'pf')) + '. اضغط الصف لفتح ملف العميل.' : 'اضغط الصف لفتح ملف العميل.' }, p), p);
      } };
    R.item_customers = { cat: 'items', name: 'بطاقة صنف: عملاؤه وأسعاره وربحيته', desc: 'لصنف تختاره: كل عميل اشتراه بالكمية والقيمة ومتوسط السعر وفرقه عن متوسط سعر الصنف، والربح والهامش، وعدد الفواتير وآخر شراء ونصيبه من الصنف', params: ['period', 'item1', 'flt'], fdims: ['cust', 'cacc', 'cgrp', 'st', 'ag', 'cat', 'xcust'],
      run: function (p) {
        var it = p.item1; if (!it || !T().item[it]) return emptyR('اختر الصنف');
        var flt = Object.assign({}, parseFilter(p.flt) || {}, { item: ['@' + it] }), g = {}, tv = 0, tq = 0, tpf = 0;
        facts('s', p.from, p.to, flt).forEach(function (x) {
          var r = g[x.v.ck] || (g[x.v.ck] = { ck: x.v.ck, name: x.v.name, q: 0, v: 0, pf: 0, n: {}, last: '', rq: 0 }); r.q += x.s * x.qty; r.v += x.s * x.val; r.pf += x.s * x.profit; if (x.s > 0) { r.n[x.v.id] = 1; if (x.d > r.last) r.last = x.d; } else r.rq += x.qty;
          tv += x.s * x.val; tq += x.s * x.qty; tpf += x.s * x.profit;
        });
        var avgP = tq ? tv / tq : 0;
        var rows = Object.keys(g).map(function (k) { var r = g[k], ap = r.q ? r.v / r.q : 0; return { name: r.name, q: r.q, v: r.v, ap: ap, dp: avgP && ap ? (ap - avgP) / avgP * 100 : '', pf: r.pf, margin: pct(r.pf, r.v), n: Object.keys(r.n).length, last: r.last, rq: r.rq, share: pct(r.v, tv), _c1: acc(r.ck) ? r.ck : undefined }; }).sort(function (a, b) { return b.v - a.v; });
        var cols = [C('name', 'العميل'), C('q', 'الكمية', 'qty'), C('v', 'صافي المبيعات', 'money'), C('share', 'من الصنف %', 'pct'), C('ap', 'متوسط السعر', 'money'), C('dp', 'عن متوسط الصنف %', 'pct'), C('pf', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('n', 'الفواتير', 'int'), C('rq', 'المرتجع', 'qty'), C('last', 'آخر شراء')];
        var t = sumRow(rows, cols); t.ap = avgP; t.dp = ''; t.margin = pct(t.pf, t.v); t.share = 100; t.last = ''; t.name = 'الإجمالي (' + rows.length + ' عميل)';
        var res = withNote({ cols: cols, rows: rows, total: t, subtitle: itemName(it) + ' · بوحدة ' + unitOf(it), chart: { type: 'hbar', x: 'name', y: ['v'], yl: ['المبيعات'], limit: 12 } }, p);
        if (!rows.length) res.empty = 'لم يُبع هذا الصنف في هذه الفترة';
        return res;
      } };
    R.cust_alerts = { cat: 'cust', name: 'إنذار مبكر: عملاء يحتاجون متابعة', desc: 'يفحص كل عميل ويُظهر الإشارات: تراجع المشتريات، التوقف عن الشراء على غير عادته، رصيد كبير مقارنة بمشترياته، عدم السداد، هامش ربح منخفض، مرتجعات مرتفعة؛ مع حالة العميل وسبب التنبيه', params: ['asof', 'flt'], fdims: ['cust', 'cacc', 'cgrp', 'ag', 'cat', 'xcust'],
      sel: [['sig', 'الإشارة', [['', 'كل الإشارات'], ['drop', 'تراجع المشتريات'], ['stop', 'توقف عن الشراء'], ['debt', 'رصيد كبير'], ['nopay', 'لا يسدد'], ['margin', 'هامش منخفض'], ['ret', 'مرتجعات مرتفعة']]]],
      run: function (p) {
        var to = p.asof, from = addD(to, -179), mid = addD(to, -59), prevA = addD(to, -119), g = {}, coA = 0, coV = 0;
        facts('s', from, to, p.flt).forEach(function (x) {
          var r = g[x.v.ck] || (g[x.v.ck] = { ck: x.v.ck, name: x.v.name, v: 0, pf: 0, ret: 0, gross: 0, l60: 0, p60: 0, ds: {} });
          r.v += x.s * x.val; r.pf += x.s * x.profit; if (x.s > 0) { r.gross += x.val; r.ds[x.d] = 1; } else r.ret += x.val;
          if (x.d >= mid) r.l60 += x.s * x.val; else if (x.d >= prevA) r.p60 += x.s * x.val;
          coA += x.s * x.profit; coV += x.s * x.val;
        });
        var coM = pct(coA, coV), want = p.sig || '', rows = [];
        Object.keys(g).forEach(function (k) {
          var r = g[k], ds = Object.keys(r.ds).sort(), last = ds[ds.length - 1] || '', gap = 0, sig = [], keys = [];
          for (var i = 1; i < ds.length; i++) gap += days(ds[i - 1], ds[i]);
          var avgGap = ds.length > 1 ? gap / (ds.length - 1) : 0, idle = last ? days(last, to) : 999, monthly = r.v / 6;
          var isAcc = !!acc(k), bal = isAcc ? balance([k], null, to).close : 0, lc = isAcc ? lastCredit(k, to) : '', nop = lc ? days(lc, to) : 999;
          if (r.p60 > 0 && r.l60 < r.p60 * 0.7) { sig.push('تراجع ' + Math.round((1 - r.l60 / r.p60) * 100) + '% عن الشهرين السابقين'); keys.push('drop'); }
          if (ds.length >= 3 && idle > Math.max(21, avgGap * 2.5)) { sig.push('لم يشترِ منذ ' + idle + ' يوماً وعادته كل ' + Math.round(avgGap) + ' يوم'); keys.push('stop'); }
          if (bal > 0 && monthly > 0 && bal > monthly * 2) { sig.push('رصيده يعادل ' + (bal / monthly).toFixed(1) + ' شهر مشتريات'); keys.push('debt'); }
          if (bal > 0.0005 && nop >= 45) { sig.push(lc ? 'لم يسدد منذ ' + nop + ' يوماً' : 'لا يوجد سداد'); keys.push('nopay'); }
          if (r.v > 0 && coM > 0 && pct(r.pf, r.v) < coM / 2) { sig.push('هامشه ' + pct(r.pf, r.v).toFixed(1) + '% مقابل ' + coM.toFixed(1) + '% للشركة'); keys.push('margin'); }
          if (r.gross > 0 && r.ret / r.gross > 0.1) { sig.push('مرتجعاته ' + (r.ret / r.gross * 100).toFixed(0) + '% من مشترياته'); keys.push('ret'); }
          if (!sig.length || (want && keys.indexOf(want) < 0)) return;
          var status = idle > 90 ? 'متوقف' : keys.indexOf('stop') >= 0 ? 'منقطع مؤخراً' : keys.indexOf('drop') >= 0 ? 'متراجع' : keys.indexOf('nopay') >= 0 || keys.indexOf('debt') >= 0 ? 'خطر سداد' : 'يحتاج مراجعة';
          rows.push({ name: r.name, status: status, nsig: sig.length, sig: sig.join(' · '), bal: bal, last: last, lastPay: lc, monthly: monthly, l60: r.l60, p60: r.p60, _hl: sig.length >= 3, _c1: isAcc ? k : undefined });
        });
        rows.sort(function (a, b) { return b.nsig - a.nsig || b.bal - a.bal; });
        var cnt = {}; rows.forEach(function (r) { cnt[r.status] = (cnt[r.status] || 0) + 1; });
        var cols = [C('name', 'العميل'), C('status', 'الحالة'), C('nsig', 'عدد الإشارات', 'int'), C('sig', 'سبب التنبيه', 'long'), C('bal', 'الرصيد', 'money'), C('last', 'آخر شراء'), C('lastPay', 'آخر سداد'), C('monthly', 'متوسط الشراء الشهري', 'money'), C('l60', 'آخر 60 يوماً', 'money'), C('p60', 'الـ60 يوماً قبلها', 'money')];
        var res = withNote({ cols: cols, rows: rows, total: { name: 'الإجمالي (' + rows.length + ' عميل)', _b: true, bal: sum(rows, 'bal') }, note: 'الفحص على آخر 6 أشهر حتى ' + to + '. ' + Object.keys(cnt).map(function (k) { return k + ': ' + cnt[k]; }).join(' · ') + '. المظلل: 3 إشارات فأكثر.' }, p);
        if (!rows.length) res.empty = 'لا يوجد عملاء عليهم إشارات تحتاج متابعة';
        return res;
      } };
    R.item_trend = { cat: 'items', name: 'اتجاه الأصناف: نامية ومستقرة ومتراجعة', desc: 'لكل صنف: مبيعات آخر 3 أشهر مقارنة بالـ3 أشهر قبلها بالكمية والقيمة وعدد العملاء، والتغير وحالة الصنف (نامٍ، مستقر، متراجع، متوقف، جديد)', params: ['asof', 'flt'], fdims: SF4,
      sel: [['st8', 'الحالة', [['', 'الكل'], ['نامٍ', 'نامية'], ['مستقر', 'مستقرة'], ['متراجع', 'متراجعة'], ['متوقف', 'متوقفة'], ['جديد', 'جديدة']]]],
      run: function (p) {
        var to = p.asof, mid = addD(to, -90), from = addD(to, -181), last30 = addD(to, -30), g = {};
        facts('s', from, to, p.flt).forEach(function (x) {
          var r = g[x.l.item] || (g[x.l.item] = { aq: 0, av: 0, bq: 0, bv: 0, ac: {}, bc: {}, l30: 0, first: x.d }), a = x.d > mid;
          if (a) { r.aq += x.s * x.qty; r.av += x.s * x.val; if (x.s > 0) r.ac[x.v.ck] = 1; if (x.d > last30) r.l30 += x.s * x.val; } else { r.bq += x.s * x.qty; r.bv += x.s * x.val; if (x.s > 0) r.bc[x.v.ck] = 1; }
          if (x.d < r.first) r.first = x.d;
        });
        var rows = Object.keys(g).map(function (k) {
          var r = g[k], ch = r.bv ? (r.av - r.bv) / Math.abs(r.bv) * 100 : '', st = r.bv <= 0.0005 && r.av > 0 ? 'جديد' : r.l30 <= 0.0005 && r.bv > 0 ? 'متوقف' : ch >= 15 ? 'نامٍ' : ch <= -15 ? 'متراجع' : 'مستقر';
          return { name: itemName(k), unit: unitOf(k), status: st, bq: r.bq, aq: r.aq, bv: r.bv, av: r.av, ch: ch, bc: Object.keys(r.bc).length, ac: Object.keys(r.ac).length };
        }).filter(function (r) { return !p.st8 || r.status === p.st8; }).sort(function (a, b) { return b.av - a.av; });
        var cnt = {}; rows.forEach(function (r) { cnt[r.status] = (cnt[r.status] || 0) + 1; });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة'), C('status', 'الحالة'), C('bq', 'كمية الـ3 أشهر السابقة', 'qty'), C('aq', 'كمية آخر 3 أشهر', 'qty'), C('bv', 'قيمة الـ3 أشهر السابقة', 'money'), C('av', 'قيمة آخر 3 أشهر', 'money'), C('ch', 'التغير %', 'pct'), C('bc', 'عملاء سابقاً', 'int'), C('ac', 'عملاء حالياً', 'int')];
        var t = sumRow(rows, [C('bv', '', 'money'), C('av', '', 'money')]); t.ch = t.bv ? (t.av - t.bv) / Math.abs(t.bv) * 100 : ''; t.name = 'الإجمالي';
        return withNote({ cols: cols, rows: rows, total: t, note: 'آخر 3 أشهر: ' + addD(mid, 1) + ' إلى ' + to + '. ' + Object.keys(cnt).map(function (k) { return k + ' ' + cnt[k]; }).join(' · ') + '. «متوقف» = لم يُبع آخر 30 يوماً.' }, p);
      } };

    /* ---------- المخازن ---------- */
    function storeMoves(from, to) {
      var g = {}, mk = function (st) { return g[st] || (g[st] = { open: 0, pur: 0, pret: 0, sale: 0, sret: 0, tin: 0, tout: 0, iss: 0, oth: 0, close: 0, items: {} }); };
      F.D.moves.forEach(function (m) {
        if (m.d > to) return;
        var r = mk(m.st || '0'), v = m.q * costAt(m.item, to);
        if (m.d < from) { r.open += v; return; }
        var c = m.l && m.l.v ? m.l.v.c : TRANSFER;
        if (c === TRANSFER) { if (m.q > 0) r.tin += v; else r.tout -= v; }
        else if (c === PUR || c === OPEN_STOCK) r.pur += v; else if (c === PRET) r.pret -= v; else if (c === SALE) r.sale -= v; else if (c === SRET) r.sret += v; else if (c === ISSUE) r.iss -= v; else r.oth += v;
        r.items[m.item] = 1;
      });
      Object.keys(g).forEach(function (k) { var r = g[k]; r.close = r.open + r.pur - r.pret - r.sale + r.sret + r.tin - r.tout - r.iss + r.oth; });
      return g;
    }
    R.store_movement = { cat: 'stock', name: 'حركة المخازن بالقيمة', desc: 'لكل مخزن (أو سيارة مندوب): رصيد أول المدة، المشتريات ومرتجعاتها، المبيعات ومرتجعاتها، المناقلات الواردة والصادرة، الإخراج، ورصيد آخر المدة، بالقيمة', params: ['period'],
      run: function (p) {
        var g = storeMoves(p.from, p.to);
        var rows = Object.keys(g).map(function (st) { var r = g[st]; return { name: storeName(st), open: r.open, pur: r.pur, pret: r.pret, sale: r.sale, sret: r.sret, tin: r.tin, tout: r.tout, iss: r.iss, close: r.close, n: Object.keys(r.items).length, turn: r.open + r.close ? r.sale / ((r.open + r.close) / 2) : '' }; })
          .filter(function (r) { return Math.abs(r.open) + Math.abs(r.close) + r.n > 0.001; }).sort(function (a, b) { return b.close - a.close; });
        var cols = [C('name', 'المخزن'), C('open', 'أول المدة', 'money'), C('pur', 'مشتريات وأول مدة', 'money'), C('pret', 'مرتجع شراء', 'money'), C('sale', 'مبيعات', 'money'), C('sret', 'مرتجع مبيع', 'money'), C('tin', 'مناقلات واردة', 'money'), C('tout', 'مناقلات صادرة', 'money'), C('iss', 'إخراج', 'money'), C('close', 'آخر المدة', 'money'), C('n', 'أصناف تحركت', 'int'), C('turn', 'دوران (مرة)', 'qty')];
        var t = sumRow(rows, cols); t.n = ''; t.turn = t.open + t.close ? t.sale / ((t.open + t.close) / 2) : '';
        return { cols: cols, rows: rows, total: t, note: 'القيم بمتوسط التكلفة في نهاية الفترة. الدوران = المبيعات بالتكلفة ÷ متوسط المخزون.', chart: { type: 'bar', x: 'name', y: ['open', 'close'], yl: ['أول المدة', 'آخر المدة'] } };
      } };
    R.stock_reorder = { cat: 'stock', name: 'اقتراح إعادة الطلب وتغطية المخزون', desc: 'لكل صنف: الرصيد الحالي، ومتوسط البيع اليومي، وكم يوماً يكفي، وآخر شراء وسعره، والكمية المقترح طلبها لتغطية عدد الأيام الذي تختاره، وتكلفتها، والحالة (نفد، اطلب الآن، قريباً، كافٍ، فائض)', params: ['asof', 'flt'], fdims: IF4,
      sel: [['basis', 'معدل البيع من', [['30', 'آخر 30 يوماً'], ['60', 'آخر 60 يوماً'], ['90', 'آخر 90 يوماً']]], ['cover', 'التغطية المطلوبة', [['30', '30 يوماً'], ['45', '45 يوماً'], ['60', '60 يوماً'], ['90', '90 يوماً']]]],
      run: function (p) {
        var to = p.asof, bd = Number(p.basis || 60), cv = Number(p.cover || 45), fl = parseFilter(p.flt) || {}, stk = stockAt(to), bal = {}, sold = {}, lastP = {};
        Object.keys(stk).forEach(function (k) { var x = k.split('|'); if (fl.st && fl.st.length && !storeMatch(fl.st, x[0])) return; if (fl.xst && fl.xst.length && storeMatch(fl.xst, x[0])) return; bal[x[1]] = (bal[x[1]] || 0) + stk[k]; });
        facts('s', addD(to, -bd + 1), to, p.flt).forEach(function (x) { sold[x.l.item] = (sold[x.l.item] || 0) + x.s * baseQ(x); });
        facts('p', '0000-01-01', to, p.flt).forEach(function (x) { if (x.s > 0 && baseQ(x) > 0 && (!lastP[x.l.item] || x.d >= lastP[x.l.item].d)) lastP[x.l.item] = { d: x.d, p: x.val / baseQ(x) }; });
        var items = uniq(Object.keys(bal).concat(Object.keys(sold))).filter(function (it) { return itemPass(it, fl); });
        var rows = items.map(function (it) {
          var f = (T().item[it] || {}).f || 1, b = (bal[it] || 0) / f, d = (sold[it] || 0) / f / bd, cover = d > 0 ? b / d : '', need = d > 0 ? Math.max(0, d * cv - b) : 0, lp = lastP[it], uc = lp ? lp.p * f : costAt(it, to) * f;
          var st = b <= 0.0005 && d > 0 ? 'نفد' : d <= 0 ? (b > 0 ? 'لا يُباع' : '') : cover < 7 ? 'اطلب الآن' : cover < cv ? 'قريباً' : cover > cv * 3 ? 'فائض' : 'كافٍ';
          return { name: itemName(it), unit: unitOf(it), status: st, bal: b, daily: d, cover: cover, need: need ? Math.ceil(need) : 0, cost: Math.ceil(need) * uc, lastD: lp ? lp.d : '', lastP: lp ? lp.p * f : '', _hl: st === 'نفد' || st === 'اطلب الآن' };
        }).filter(function (r) { return r.status; });
        var ord = { 'نفد': 0, 'اطلب الآن': 1, 'قريباً': 2, 'كافٍ': 3, 'فائض': 4, 'لا يُباع': 5 };
        rows.sort(function (a, b) { return ord[a.status] - ord[b.status] || (Number(a.cover) || 0) - (Number(b.cover) || 0); });
        var cnt = {}; rows.forEach(function (r) { cnt[r.status] = (cnt[r.status] || 0) + 1; });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة'), C('status', 'الحالة'), C('bal', 'الرصيد', 'qty'), C('daily', 'متوسط البيع اليومي', 'qty'), C('cover', 'يكفي (يوم)', 'int'), C('need', 'الكمية المقترحة', 'qty'), C('cost', 'التكلفة التقديرية', 'money'), C('lastP', 'آخر سعر شراء', 'money'), C('lastD', 'آخر شراء')];
        var t = sumRow(rows, [C('cost', '', 'money')]); t.name = 'الإجمالي';
        return withNote({ cols: cols, rows: rows, total: t, note: Object.keys(cnt).map(function (k) { return k + ': ' + cnt[k]; }).join(' · ') + '. الكمية المقترحة = متوسط البيع اليومي × ' + cv + ' يوماً − الرصيد.' }, p);
      } };
    R.stock_value_month = { year: true, cat: 'stock', name: 'قيمة المخزون في نهاية كل شهر', desc: 'قيمة المخزون بالتكلفة في نهاية كل شهر لكل مخزن وللإجمالي، والتغير عن الشهر السابق، ونسبته من مبيعات الشهر (أيام التغطية)', params: ['period'],
      run: function (p) {
        var ms = ymList(p.from, p.to), sts = {}, rows = [], prev = null;
        ms.forEach(function (m) {
          var e = monthEnd(m) > p.to ? p.to : monthEnd(m), b = stockAt(e), o = { name: monthLabel(m), tot: 0 };
          Object.keys(b).forEach(function (k) { var x = k.split('|'), v = b[k] * costAt(x[1], e); o['s' + x[0]] = (o['s' + x[0]] || 0) + v; o.tot += v; if (Math.abs(v) > 0.5) sts[x[0]] = 1; });
          var s = salesStats(m + '-01' < p.from ? p.from : m + '-01', e); o.days = s.cost > 0 ? o.tot / (s.cost / (days(m + '-01' < p.from ? p.from : m + '-01', e) + 1)) : '';
          o.ch = prev !== null ? o.tot - prev : ''; prev = o.tot; rows.push(o);
        });
        var cols = [C('name', 'نهاية الشهر')].concat(Object.keys(sts).map(function (s) { return C('s' + s, storeName(s), 'money'); })).concat([C('tot', 'الإجمالي', 'money'), C('ch', 'التغير', 'money'), C('days', 'أيام التغطية', 'int')]);
        return { cols: cols, rows: rows, note: 'أيام التغطية = قيمة المخزون ÷ متوسط تكلفة المبيعات اليومية في الشهر.', chart: { type: 'line', x: 'name', y: ['tot'], yl: ['قيمة المخزون'] } };
      } };
    R.stock_aging = { cat: 'stock', name: 'أعمار المخزون', desc: 'يوزّع رصيد كل صنف على أعمار حسب تاريخ دخوله المخزن (على أساس أن الأقدم يُباع أولاً): حتى 30 يوماً، 31-60، 61-90، 91-180، أكثر من 180، بالقيمة، مع تاريخ آخر وارد', params: ['asof', 'flt'], fdims: IF4,
      run: function (p) {
        var to = p.asof, fl = parseFilter(p.flt) || {}, bal = {}, rec = {}, stk = stockAt(to);
        Object.keys(stk).forEach(function (k) { var x = k.split('|'); bal[x[1]] = (bal[x[1]] || 0) + stk[k]; });
        F.D.moves.forEach(function (m) { if (m.d > to || m.q <= 0) return; var c = m.l && m.l.v ? m.l.v.c : TRANSFER; if (c === TRANSFER) return; (rec[m.item] || (rec[m.item] = [])).push(m); });
        var B = [30, 60, 90, 180], rows = [];
        Object.keys(bal).forEach(function (it) {
          if (bal[it] <= 0.0005) return;
          if (!itemPass(it, fl)) return;
          var left = bal[it], c = costAt(it, to), r = { name: itemName(it), unit: unitOf(it), b0: 0, b1: 0, b2: 0, b3: 0, b4: 0 }, rs = (rec[it] || []).slice().sort(function (a, b) { return a.d < b.d ? 1 : -1; });
          r.lastIn = rs.length ? rs[0].d : '';
          for (var i = 0; i < rs.length && left > 0.0005; i++) { var q = Math.min(left, rs[i].q), age = days(rs[i].d, to), bi = age <= B[0] ? 0 : age <= B[1] ? 1 : age <= B[2] ? 2 : age <= B[3] ? 3 : 4; r['b' + bi] += q * c; left -= q; }
          if (left > 0.0005) r.b4 += left * c;
          r.tot = r.b0 + r.b1 + r.b2 + r.b3 + r.b4; r.old = pct(r.b3 + r.b4, r.tot); r.qty = bal[it] / ((T().item[it] || {}).f || 1);
          rows.push(r);
        });
        rows.sort(function (a, b) { return (b.b3 + b.b4) - (a.b3 + a.b4) || b.tot - a.tot; });
        var cols = [C('name', 'الصنف'), C('unit', 'الوحدة'), C('qty', 'الرصيد', 'qty'), C('b0', 'حتى 30 يوماً', 'money'), C('b1', '31-60', 'money'), C('b2', '61-90', 'money'), C('b3', '91-180', 'money'), C('b4', 'أكثر من 180', 'money'), C('tot', 'القيمة', 'money'), C('old', 'أقدم من 90 يوماً %', 'pct'), C('lastIn', 'آخر وارد')];
        var t = sumRow(rows, cols); t.qty = ''; t.old = pct(t.b3 + t.b4, t.tot);
        return withNote({ cols: cols, rows: rows, total: t, note: 'القيمة بمتوسط التكلفة. المناقلات بين المخازن لا تغيّر عمر البضاعة.' }, p);
      } };

    /* ---------- أرقام السنة الحالية ---------- */
    R.exec_records = { cat: 'exec', name: 'الأرقام القياسية للسنة الحالية', desc: 'أفضل يوم وأسبوع وشهر مبيعاً وربحاً، وأكبر فاتورة، وأعلى عميل وصنف ومندوب، وأعلى يوم تحصيل، وأكثر العملاء شراءً، وعدد العملاء الجدد، من بداية السنة حتى اليوم', params: ['asof', 'flt'], fdims: SF4,
      run: function (p) {
        var y = p.asof.slice(0, 4), from = y + '-01-01' < dataStart() ? dataStart() : y + '-01-01', to = p.asof, list = facts('s', from, to, p.flt);
        if (!list.length) return emptyR('لا توجد مبيعات في سنة ' + y);
        var D = {}, W = {}, M = {}, MP = {}, inv = {}, cu = {}, cuN = {}, it = {}, itP = {}, ag = {};
        list.forEach(function (x) {
          var v = x.s * x.val, w = weekStart(x.d), m = x.d.slice(0, 7);
          D[x.d] = (D[x.d] || 0) + v; W[w] = (W[w] || 0) + v; M[m] = (M[m] || 0) + v; MP[m] = (MP[m] || 0) + x.s * x.profit;
          if (x.s > 0) { var iv = inv[x.v.id] || (inv[x.v.id] = { v: 0, no: x.v.no, d: x.d, name: x.v.name }); iv.v += x.val; (cuN[x.v.ck] || (cuN[x.v.ck] = {}))[x.v.id] = 1; }
          cu[x.v.ck] = (cu[x.v.ck] || 0) + v; it[x.l.item] = (it[x.l.item] || 0) + v; itP[x.l.item] = (itP[x.l.item] || 0) + x.s * x.profit; ag[x.v.ag || '0'] = (ag[x.v.ag || '0'] || 0) + v;
        });
        var best = function (o) { var k = null; Object.keys(o).forEach(function (z) { if (k === null || o[z] > o[k]) k = z; }); return k; };
        var cName = {}; list.forEach(function (x) { cName[x.v.ck] = x.v.name; });
        var bd = best(D), bw = best(W), bm = best(M), bmp = best(MP), bi = best(Object.keys(inv).reduce(function (o, k) { o[k] = inv[k].v; return o; }, {})), bc = best(cu), bit = best(it), bip = best(itP), ba = best(ag);
        var bcn = best(Object.keys(cuN).reduce(function (o, k) { o[k] = Object.keys(cuN[k]).length; return o; }, {}));
        var CO = {}; recvIds().forEach(function (id) { (F.D.byAcc[id] || []).forEach(function (l) { if (l.cr && l.d >= from && l.d <= to) CO[l.d] = (CO[l.d] || 0) + l.cr; }); });
        var bco = best(CO), nd = Object.keys(D).length, tot = sum(Object.keys(D).map(function (k) { return { v: D[k] }; }), 'v');
        var firsts = {}; list.forEach(function (x) { if (x.s > 0 && (!firsts[x.v.ck] || x.d < firsts[x.v.ck])) firsts[x.v.ck] = x.d; });
        var rows = [
          { name: 'أفضل يوم مبيعاً', v: D[bd], det: bd, cmp: 'متوسط اليوم ' + fm(tot / nd) },
          { name: 'أفضل أسبوع مبيعاً', v: W[bw], det: 'يبدأ ' + bw },
          { name: 'أفضل شهر مبيعاً', v: M[bm], det: monthLabel(bm) },
          { name: 'أفضل شهر ربحاً', v: MP[bmp], det: monthLabel(bmp), cmp: 'هامش ' + pct(MP[bmp], M[bmp]).toFixed(1) + '%' },
          { name: 'أكبر فاتورة مبيع', v: inv[bi].v, det: 'رقم ' + inv[bi].no + ' · ' + inv[bi].name, cmp: inv[bi].d },
          { name: 'أعلى عميل مشتريات', v: cu[bc], det: cName[bc], cmp: 'حصته ' + pct(cu[bc], tot).toFixed(1) + '%', _c1: acc(bc) ? bc : undefined },
          { name: 'أكثر عميل تكراراً للشراء', v: Object.keys(cuN[bcn]).length, det: cName[bcn], cmp: 'فاتورة', _int: 1, _c1: acc(bcn) ? bcn : undefined },
          { name: 'أعلى صنف مبيعاً', v: it[bit], det: itemName(bit) },
          { name: 'أعلى صنف ربحاً', v: itP[bip], det: itemName(bip) },
          { name: 'أعلى مندوب مبيعاً', v: ag[ba], det: repName(ba) },
          bco ? { name: 'أعلى يوم تحصيل من العملاء', v: CO[bco], det: bco } : null,
          { name: 'أيام البيع منذ بداية السنة', v: nd, det: 'من ' + from + ' إلى ' + to, _int: 1 },
          { name: 'عملاء اشتروا هذه السنة', v: Object.keys(firsts).length, det: '', _int: 1 }
        ].filter(Boolean);
        rows.forEach(function (r) { if (r._int) { r.vi = r.v; r.v = ''; } });
        return withNote({ cols: [C('name', 'الرقم القياسي'), C('v', 'القيمة', 'money'), C('vi', 'العدد', 'int'), C('det', 'التفاصيل'), C('cmp', 'ملاحظة')], rows: rows, subtitle: 'سنة ' + y + ' حتى ' + to }, p);
      } };

    /* ===================== تقييم المخزون: ملخص وتفصيلي ===================== */
    var VAL_PRICE = [['a', 'سعر البيع أ (قائمة الأسعار)'], ['b', 'سعر البيع ب'], ['c', 'سعر البيع ج'], ['min', 'الحد الأدنى للبيع'], ['last', 'آخر سعر بيع فعلي']];
    var VAL_BY = [['st', 'المخزن'], ['icl', 'تصنيف الصنف'], ['igrp', 'مجموعة الأصناف'], ['abc', 'فئة ABC'], ['status', 'حالة الصنف']];
    var VAL_STALE = 90;
    // آخر سعر شراء وآخر سعر بيع لكل صنف (لوحدة الأساس) حتى تاريخ
    function valLastPrices(asof) {
      var key = 'vlp:' + asof;
      if (F.cache[key]) return F.cache[key];
      var buy = {}, sell = {};
      F.D.invs.forEach(function (v) {
        if (v.d > asof || (v.c !== PUR && v.c !== SALE)) return;
        var m = v.c === PUR ? buy : sell;
        v.lines.forEach(function (l) { if (!(l.qb > 0) || !(l.tot > 0)) return; var o = m[l.item]; if (!o || v.d >= o.d) m[l.item] = { d: v.d, p: l.tot / l.qb }; });
      });
      return (F.cache[key] = { buy: buy, sell: sell });
    }
    // سطر لكل صنف في كل مخزن مع كل قيم التقييم
    function valLines(p) {
      var asof = p.asof, fl = parseFilter(p.flt) || {}, stk = stockAt(asof), lp = valLastPrices(asof), lvl = p.price || 'a', out = [];
      if (lvl !== 'last' && !hasIpr()) lvl = 'last';
      Object.keys(stk).forEach(function (k) {
        var x = k.split('|'), sid = x[0], it = x[1], qb = stk[k];
        if (Math.abs(qb) < 1e-9 || !linePass({ item: it, st: sid }, fl)) return;
        var c = costAt(it, asof), b = lp.buy[it] ? lp.buy[it].p : null, sp = lvl === 'last' ? (lp.sell[it] ? lp.sell[it].p : null) : listBase(it, null, lvl);
        var ls = lp.sell[it] ? lp.sell[it].d : '', o = { it: it, sid: sid, qb: qb, c: c, b: b, sp: sp || null, ls: ls };
        o.val = qb * c; o.rep = qb * (b || c); o.sale = qb * (sp || c); o.pf = sp ? qb * (sp - c) : 0;
        o.nrv = qb > 0 && sp && sp < c ? qb * (c - sp) : 0;
        o.stale = qb > 0 && (!ls || days(ls, asof) > VAL_STALE);
        out.push(o);
      });
      return { list: out, lvl: lvl };
    }
    function valStatus(o) { return o.qb < 0 ? 'سالب' : o.nrv > 0 ? 'دون التكلفة' : o.stale ? 'راكد' : !o.sp ? 'بلا سعر' : 'سليم'; }
    var VAL_ST_ORD = { 'سالب': 0, 'دون التكلفة': 1, 'راكد': 2, 'بلا سعر': 3, 'سليم': 4 };
    R.stock_valuation = { cat: 'stock', name: 'تقييم المخزون (ملخص وتفصيلي)', desc: 'قيمة المخزون في تاريخ بثلاث طرق: بمتوسط التكلفة، وبآخر سعر شراء (تكلفة الاستبدال)، وبسعر البيع؛ مع الربح المتوقع والهامش، وانخفاض القيمة حين يكون سعر البيع أقل من التكلفة، والأصناف الراكدة والسالبة، وتصنيف ABC؛ ملخصاً حسب المخزن أو التصنيف أو المجموعة، أو تفصيلياً لكل صنف',
      params: ['asof', 'flt'], fdims: IF4,
      sel: [['view', 'العرض', [['sum', 'ملخص'], ['det', 'تفصيلي']]], ['by', 'حسب', VAL_BY], ['price', 'سعر البيع', VAL_PRICE]],
      run: function (p) {
        var view = p.view === 'det' ? 'det' : 'sum', by = p.by || 'st', V = valLines(p), list = V.list, asof = p.asof;
        if (!list.length) return emptyR('لا يوجد مخزون في ' + asof + ' بهذه الشروط');
        // تصنيف ABC على قيمة كل صنف (كل المخازن)
        var iv = {}; list.forEach(function (o) { iv[o.it] = (iv[o.it] || 0) + o.val; });
        var ord = Object.keys(iv).filter(function (k) { return iv[k] > 0; }).sort(function (a, b) { return iv[b] - iv[a]; }), totPos = ord.reduce(function (s, k) { return s + iv[k]; }, 0), cum = 0, abc = {};
        ord.forEach(function (k) { var before = cum; cum += iv[k]; abc[k] = before / totPos < 0.8 ? 'A' : before / totPos < 0.95 ? 'B' : 'C'; });
        var grpOf = {
          st: function (o) { return [o.sid, stLabel(o.sid)]; },
          icl: function (o) { var c = iclTop(o.it); return [c || '-', c ? iclName(c) : 'بدون تصنيف']; },
          igrp: function (o) { var g = igrpOf(o.it); return [g || '-', g ? igrpName(g) : 'بدون مجموعة']; },
          abc: function (o) { var a = abc[o.it] || '-'; return [a, a === '-' ? 'بلا قيمة موجبة' : 'الفئة ' + a + (a === 'A' ? ' (أعلى 80% من القيمة)' : a === 'B' ? ' (15% التالية)' : ' (آخر 5%)')]; },
          status: function (o) { var s = valStatus(o); return [s, { 'سالب': 'رصيد سالب', 'دون التكلفة': 'سعر البيع أقل من التكلفة', 'راكد': 'راكد (بلا بيع ' + VAL_STALE + ' يوماً)', 'بلا سعر': 'بدون سعر بيع', 'سليم': 'سليم' }[s]]; }
        }[by] || function (o) { return [o.sid, stLabel(o.sid)]; };
        var G = {}, T0 = { val: 0, rep: 0, sale: 0, pf: 0, nrv: 0, staleV: 0, neg: 0, negV: 0, noP: 0, items: {} };
        list.forEach(function (o) {
          var g = grpOf(o), r = G[g[0]] || (G[g[0]] = { id: g[0], name: g[1], items: {}, it: {}, val: 0, rep: 0, sale: 0, pf: 0, pSale: 0, pVal: 0, nrv: 0, staleV: 0, neg: 0 });
          r.val += o.val; r.rep += o.rep; r.sale += o.sale; r.pf += o.pf; r.nrv += o.nrv; if (o.sp) { r.pSale += o.qb * o.sp; r.pVal += o.val; }
          if (o.stale) r.staleV += o.val; if (o.qb < 0) r.neg++; if (o.qb > 0) r.items[o.it] = 1;
          // في التفصيلي: الصنف داخل المجموعة (ومع «حسب المخزن» الصنف في ذلك المخزن)
          var e = r.it[o.it] || (r.it[o.it] = { it: o.it, qb: 0, val: 0, rep: 0, sale: 0, pf: 0, nrv: 0, c: o.c, b: o.b, sp: o.sp, ls: o.ls, stale: false, sts: {} });
          e.qb += o.qb; e.val += o.val; e.rep += o.rep; e.sale += o.sale; e.pf += o.pf; e.nrv += o.nrv; e.sts[o.sid] = 1;
          T0.val += o.val; T0.rep += o.rep; T0.sale += o.sale; T0.pf += o.pf; T0.nrv += o.nrv; if (o.stale) T0.staleV += o.val; if (o.qb < 0) { T0.neg++; T0.negV += o.val; } if (o.qb > 0) T0.items[o.it] = 1;
        });
        var pSaleT = 0, pValT = 0; list.forEach(function (o) { if (o.sp) { pSaleT += o.qb * o.sp; pValT += o.val; } });
        Object.keys(T0.items).forEach(function (k) { if (!list.some(function (o) { return o.it === k && o.sp; })) T0.noP++; });
        var groups = Object.keys(G).map(function (k) { return G[k]; }).sort(by === 'abc' ? function (a, b) { return a.id < b.id ? -1 : 1; } : by === 'status' ? function (a, b) { return (VAL_ST_ORD[a.id] === undefined ? 2 : VAL_ST_ORD[a.id]) - (VAL_ST_ORD[b.id] === undefined ? 2 : VAL_ST_ORD[b.id]); } : function (a, b) { return b.val - a.val; });
        groups = groups.filter(function (g) { return Object.keys(g.items).length || g.neg || Math.abs(g.val) > 0.0005; });
        var grow = function (r) { return { name: r.name, items: Object.keys(r.items).length, val: r.val, share: pct(r.val, T0.val), rep: r.rep, rdiff: r.rep - r.val, sale: r.sale, pf: r.pf, margin: pct(r.pf, r.pSale), nrv: r.nrv, staleV: r.staleV, neg: r.neg }; };
        var byL = { st: 'المخزن', icl: 'التصنيف', igrp: 'المجموعة', abc: 'فئة ABC', status: 'الحالة' }[by] || 'المخزن';
        var rows, cols;
        if (view === 'sum') {
          rows = groups.map(grow);
          cols = [C('name', byL), C('items', 'عدد الأصناف', 'int'), C('val', 'القيمة بالتكلفة', 'money'), C('share', 'من الإجمالي %', 'pct'), C('rep', 'بآخر سعر شراء', 'money'), C('rdiff', 'فرق الاستبدال', 'money'), C('sale', 'بسعر البيع', 'money'), C('pf', 'الربح المتوقع', 'money'), C('margin', 'الهامش %', 'pct'), C('nrv', 'انخفاض القيمة', 'money'), C('staleV', 'قيمة الراكد', 'money'), C('neg', 'أرصدة سالبة', 'int')];
        } else {
          rows = [];
          groups.forEach(function (g, gi) {
            var h = grow(g); h._g = gi; h._gh = 1; h._b = true; h.unit = ''; h.abc = ''; h.qty = ''; h.cost = ''; h.bp = ''; h.spu = ''; h.ls = ''; h.status = ''; h.cum = '';
            rows.push(h);
            Object.keys(g.it).map(function (k) { return g.it[k]; }).sort(function (a, b) { return b.val - a.val; }).forEach(function (e) {
              var f = (T().item[e.it] || {}).f || 1, o = { qb: e.qb, nrv: e.nrv, sp: e.sp, stale: e.qb > 0 && (!e.ls || days(e.ls, asof) > VAL_STALE) };
              rows.push({ _g: gi, _lvl: 1, name: itemName(e.it), unit: unitOf(e.it), abc: abc[e.it] || '', qty: e.qb / f, cost: e.c * f, val: e.val, share: pct(e.val, T0.val), bp: e.b ? e.b * f : '', rep: e.rep, rdiff: e.rep - e.val, spu: e.sp ? e.sp * f : '', sale: e.sale, pf: e.pf, margin: e.sp ? pct(e.sp - e.c, e.sp) : '', nrv: e.nrv, ls: e.ls || '—', status: valStatus(o) });
            });
          });
          cols = [C('name', byL + ' / الصنف'), C('unit', 'الوحدة'), C('abc', 'ABC'), C('qty', 'الكمية', 'qty'), C('cost', 'متوسط التكلفة', 'money'), C('val', 'القيمة بالتكلفة', 'money'), C('share', 'من الإجمالي %', 'pct'), C('bp', 'آخر سعر شراء', 'money'), C('rep', 'بآخر سعر شراء', 'money'), C('spu', 'سعر البيع', 'money'), C('sale', 'بسعر البيع', 'money'), C('pf', 'الربح المتوقع', 'money'), C('margin', 'الهامش %', 'pct'), C('nrv', 'انخفاض القيمة', 'money'), C('ls', 'آخر بيع'), C('status', 'الحالة')];
        }
        var qAll = 0; list.forEach(function (o) { qAll += o.qb / ((T().item[o.it] || {}).f || 1); });
        var t = { name: 'الإجمالي', _b: true, qty: qAll, items: Object.keys(T0.items).length, val: T0.val, share: 100, rep: T0.rep, rdiff: T0.rep - T0.val, sale: T0.sale, pf: T0.pf, margin: pct(T0.pf, pSaleT), nrv: T0.nrv, staleV: T0.staleV, neg: T0.neg, status: '' };
        var cnt = { A: 0, B: 0, C: 0 }; Object.keys(abc).forEach(function (k) { cnt[abc[k]]++; });
        var lvlName = VAL_PRICE.filter(function (o) { return o[0] === V.lvl; })[0][1];
        var kpis = [
          { l: 'قيمة المخزون بالتكلفة', v: T0.val, t: 'money', s: Object.keys(T0.items).length + ' صنف برصيد' },
          { l: 'بآخر سعر شراء (الاستبدال)', v: T0.rep, t: 'money', s: (T0.rep - T0.val >= 0 ? '+' : '') + fm(T0.rep - T0.val) + ' عن التكلفة' },
          { l: 'بسعر البيع', v: T0.sale, t: 'money', s: lvlName },
          { l: 'الربح المتوقع', v: T0.pf, t: 'money', s: 'هامش ' + pct(T0.pf, pSaleT).toFixed(1) + '%' },
          { l: 'انخفاض القيمة', v: T0.nrv, t: 'money', s: 'سعر البيع أقل من التكلفة', bad: T0.nrv > 0.5 },
          { l: 'قيمة الأصناف الراكدة', v: T0.staleV, t: 'money', s: pct(T0.staleV, T0.val).toFixed(1) + '% · بلا بيع ' + VAL_STALE + ' يوماً', bad: T0.staleV > 0.5 },
          { l: 'تصنيف ABC', v: cnt.A + ' / ' + cnt.B + ' / ' + cnt.C, t: 'text', s: 'عدد أصناف A / B / C' },
          { l: 'أرصدة سالبة', v: T0.neg, t: 'int', s: T0.neg ? 'بقيمة ' + fm(T0.negV) : 'لا توجد', bad: T0.neg > 0 }
        ];
        var note = 'الكمية بالوحدة الشائعة · التكلفة = متوسط تكلفة الشراء المتحرك · سعر البيع = ' + lvlName + (V.lvl === 'last' && p.price && p.price !== 'last' ? ' (قوائم أسعار سراج لم تصل بعد)' : '') +
          ' · الصنف بلا سعر بيع يُقيَّم بتكلفته ولا يدخل في الهامش' + (T0.noP ? ' (' + T0.noP + ' صنف)' : '') + ' · انخفاض القيمة = (التكلفة − سعر البيع) × الكمية حين يقل سعر البيع عن التكلفة · ABC: A أعلى 80% من القيمة، B الـ15% التالية، C الباقي';
        var res = { title: 'تقييم المخزون — ' + (view === 'sum' ? 'ملخص حسب ' + byL : 'تفصيلي حسب ' + byL), cols: cols, rows: rows, total: t, kpis: kpis, note: note };
        if (view === 'det') res._grouped = true;
        if (view === 'sum' && rows.length > 1) res.chart = { type: 'hbar', x: 'name', y: ['val'], yl: ['القيمة بالتكلفة'], limit: 12 };
        return withNote(res, p);
      } };

    /* ===================== تقييم المخزون بأسعار الشراء (تقرير الإدارة) ===================== */
    var VB_METH = [['mavg', 'متوسط التكلفة المتحرك (الدفتري)'], ['fifo', 'الوارد أولاً صادر أولاً (FIFO)'], ['wavg', 'المتوسط المرجح لأسعار الشراء'], ['last', 'آخر سعر شراء'], ['min', 'أقل سعر شراء'], ['max', 'أعلى سعر شراء']];
    var VB_BY = [['item', 'الصنف'], ['st', 'المخزن'], ['icl', 'تصنيف الصنف'], ['igrp', 'مجموعة الأصناف'], ['sup', 'المورد الرئيسي']];
    function vbFull(x) { return String(x || '').replace(/\s+/g, ' ').trim(); }
    function vbShort(x) { x = String(x || '').replace(/\s+/g, ' ').trim(); return x.length > 30 ? x.slice(0, 29) + '…' : x; }
    // كل أسعار شراء الصنف مع عدد مرات الشراء بكل سعر (عدد الفواتير، وبضاعة أول المدة مرة لكل قيد)، الأكثر تكراراً أولاً
    function vbPrices(r) {
      if (!r.has) return 'بدون مشتريات حتى التاريخ';
      var m = {}, f = r.f;
      r.tiers.forEach(function (t) { var k = t.pb.toFixed(5), o = m[k] || (m[k] = { pb: t.pb, n: 0, o: 0 }), c = Object.keys(t.inv).length; o.n += c; if (t.label === 'o') o.o += c; });
      return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.n - a.n || a.pb - b.pb; })
        .map(function (o) { return (o.pb > 0 ? fm(o.pb * f) : 'مجاني') + '\u00a0×' + o.n + (o.o ? (o.o === o.n ? '\u00a0(أول\u00a0المدة)' : '\u00a0(منها\u00a0' + o.o + '\u00a0أول\u00a0المدة)') : ''); }).join('\n');
    }
    var VB_SHORT = { mavg: 'متوسط متحرك', fifo: 'FIFO', wavg: 'متوسط مرجح', last: 'آخر سعر', min: 'أقل سعر', max: 'أعلى سعر' };
    function vbMethName(m) { var o = VB_METH.filter(function (x) { return x[0] === m; })[0]; return o ? o[1] : m; }
    // طبقات الشراء لكل صنف حتى تاريخ: بضاعة أول المدة + كل سعر شراء (مع المرتجعات) — على مستوى الشركة
    function vbLayers(asof) {
      var key = 'vbl:' + asof;
      if (F.cache[key]) return F.cache[key];
      var by = {};
      var tierOf = function (it, pb, label) {
        var o = by[it] || (by[it] = { tiers: [], ret: 0 }), k = label + '|' + pb.toFixed(5), t = null;
        for (var i = 0; i < o.tiers.length; i++) if (o.tiers[i].k === k) { t = o.tiers[i]; break; }
        if (!t) { t = { k: k, label: label, pb: pb, qb: 0, rq: 0, val: 0, d1: '', d2: '', inv: {}, sup: {} }; o.tiers.push(t); }
        return t;
      };
      var invs = F.D.invs.filter(function (v) { return v.d <= asof && (v.c === PUR || v.c === OPEN_STOCK || v.c === PRET); }).sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
      invs.forEach(function (v) {
        v.lines.forEach(function (l) {
          if (!(l.qb > 0)) return;
          var tot = l.tot > 0 ? l.tot : v.c === OPEN_STOCK ? (l.cost || 0) : 0, pb = tot / l.qb;
          if (v.c === PRET) {   // المرتجع يُخصم من طبقة نفس السعر، وإلا من آخر طبقة قبله
            var o = by[l.item]; if (!o) return;
            var m = o.tiers.filter(function (t) { return t.label === 'p' && Math.abs(t.pb - pb) < 0.0005; })[0];
            if (!m) m = o.tiers.filter(function (t) { return t.d1 && t.d1 <= v.d && t.pb > 0; }).pop();
            if (m) { m.rq += l.qb; m.val -= l.qb * m.pb; }
            o.ret += tot;
            return;
          }
          var t = tierOf(l.item, pb, v.c === OPEN_STOCK ? 'o' : 'p');
          t.qb += l.qb; t.val += tot; t.inv[v.id] = 1; var sk = v.c === OPEN_STOCK ? 'بضاعة أول المدة' : (v.name || (acc(v.ck) || {}).name || '—'); t.sup[sk] = (t.sup[sk] || 0) + tot;
          if (!t.d1 || v.d < t.d1) t.d1 = v.d; if (!t.d2 || v.d > t.d2) t.d2 = v.d;
        });
      });
      Object.keys(by).forEach(function (it) { by[it].tiers.sort(function (a, b) { return a.label !== b.label ? (a.label === 'o' ? -1 : 1) : a.d1 < b.d1 ? -1 : a.d1 > b.d1 ? 1 : 0; }); });
      return (F.cache[key] = by);
    }
    // تكلفة الوحدة (لوحدة الأساس) بكل طريقة، والتوزيع على الطبقات بطريقة FIFO
    function vbItem(it, asof, Qco) {
      var L = vbLayers(asof)[it], book = costAt(it, asof), r = { it: it, book: book, tiers: [], has: false };
      if (!L || !L.tiers.length) { ['fifo', 'wavg', 'last', 'min', 'max'].forEach(function (m) { r[m] = book; }); r.mavg = book; r.fifoX = 0; return r; }
      r.has = true; r.tiers = L.tiers;
      var nq = 0, nv = 0, paid = L.tiers.filter(function (t) { return t.pb > 0; });
      L.tiers.forEach(function (t) { var q = Math.max(0, t.qb - t.rq); nq += q; nv += q * t.pb; t.fq = 0; });
      r.mavg = book;
      r.wavg = nq > 0 ? nv / nq : book;
      var lastT = paid.slice().sort(function (a, b) { return a.d2 < b.d2 ? -1 : a.d2 > b.d2 ? 1 : 0; }).pop();
      r.last = lastT ? lastT.pb : book; r.lastD = lastT ? lastT.d2 : '';
      var firstT = paid.slice().sort(function (a, b) { return a.d1 < b.d1 ? -1 : 1; })[0];
      r.first = firstT ? firstT.pb : r.last;
      r.min = paid.length ? Math.min.apply(null, paid.map(function (t) { return t.pb; })) : book;
      r.max = paid.length ? Math.max.apply(null, paid.map(function (t) { return t.pb; })) : book;
      // FIFO: الرصيد الموجود من أحدث الطبقات رجوعاً، والزائد عن المشتريات بالتكلفة الدفترية
      var need = Math.max(0, Qco), fv = 0, ord = L.tiers.slice().sort(function (a, b) { return a.d2 < b.d2 ? 1 : a.d2 > b.d2 ? -1 : 0; });
      ord.forEach(function (t) { if (need <= 0) return; var q = Math.min(need, Math.max(0, t.qb - t.rq)); t.fq = q; fv += q * t.pb; need -= q; });
      r.fifoX = need; fv += need * book;
      r.fifo = Qco > 0 ? fv / Qco : book;
      var sp = {}; L.tiers.forEach(function (t) { Object.keys(t.sup).forEach(function (s) { if (s !== 'بضاعة أول المدة') sp[s] = (sp[s] || 0) + t.sup[s]; }); });
      r.sup = Object.keys(sp).sort(function (a, b) { return sp[b] - sp[a]; });
      r.pv = L.tiers.reduce(function (s, t) { return s + (t.label === 'p' ? t.val : 0); }, 0);
      r.ninv = {}; L.tiers.forEach(function (t) { Object.keys(t.inv).forEach(function (k) { if (t.label === 'p') r.ninv[k] = 1; }); }); r.ninv = Object.keys(r.ninv).length;
      r.nprice = paid.filter(function (t) { return t.label === 'p'; }).length; r.nq = nq; r.rq = L.tiers.reduce(function (s, t) { return s + t.rq; }, 0); var dp = {}; paid.forEach(function (t) { dp[t.pb.toFixed(4)] = 1; }); r.nlev = Object.keys(dp).length;
      return r;
    }
    R.stock_val_buy = { cat: 'stock', name: 'تقييم المخزون بأسعار الشراء (تقرير الإدارة)', desc: 'لكل صنف: كل أسعار الشراء التي اشتُري بها (الكمية والقيمة والتواريخ والموردون والمرتجعات)، ثم قيمة المخزون بست طرق: متوسط التكلفة الدفتري، FIFO، المتوسط المرجح، آخر سعر، أقل وأعلى سعر؛ مع طريقة التقييم النهائي المختارة وفرقها عن الدفاتر، وقاعدة الأقل من التكلفة أو سعر البيع اختيارياً؛ ملخصاً حسب الصنف أو المخزن أو التصنيف أو المورد، أو تفصيلياً بأسعار شراء كل صنف',
      params: ['asof', 'flt'], fdims: IF4,
      sel: [['view', 'العرض', [['sum', 'ملخص'], ['det', 'تفصيلي: الصنف وأسعار شرائه']]], ['method', 'طريقة التقييم النهائي', VB_METH], ['by', 'الملخص حسب', VB_BY], ['lcm', 'قاعدة الأقل من التكلفة أو سعر البيع', [['0', 'لا تُطبَّق'], ['1', 'تُطبَّق (سعر البيع أ)']]]],
      run: function (p) {
        var asof = p.asof, view = p.view === 'det' ? 'det' : 'sum', meth = p.method || 'mavg', by = p.by || 'item', lcm = p.lcm === '1';
        var fl = parseFilter(p.flt) || {}, stk = stockAt(asof), qco = {}, qf = {}, qst = {};
        Object.keys(stk).forEach(function (k) { var x = k.split('|'), sid = x[0], it = x[1], q = stk[k]; qco[it] = (qco[it] || 0) + q; if (!linePass({ item: it, st: sid }, fl) || Math.abs(q) < 1e-9) return; qf[it] = (qf[it] || 0) + q; (qst[it] = qst[it] || {})[sid] = q; });
        var items = Object.keys(qf).filter(function (it) { return Math.abs(qf[it]) > 1e-9; });
        if (!items.length) return emptyR('لا يوجد مخزون في ' + asof + ' بهذه الشروط');
        var ipr = hasIpr(), M = ['mavg', 'fifo', 'wavg', 'last', 'min', 'max'];
        var D = items.map(function (it) {
          var r = vbItem(it, asof, qco[it] || 0), q = qf[it], f = (T().item[it] || {}).f || 1;
          r.q = q; r.f = f; r.v = {}; M.forEach(function (m) { r.v[m] = q * r[m]; });
          r.unitF = r[meth]; r.sp = ipr ? listBase(it, null, 'a') : null; r.lcmCut = 0;
          if (lcm && r.sp && r.sp < r.unitF && q > 0) { r.lcmCut = q * (r.unitF - r.sp); r.unitF = r.sp; }
          r.fin = q * r.unitF; r.diff = r.fin - r.v.mavg;
          r.chg = r.first > 0 && r.has ? pct(r.last - r.first, r.first) : 0;
          return r;
        });
        // المجاميع
        var Tt = { q: 0, fin: 0, pv: 0, ninv: {}, lcm: 0, multi: 0, noPur: 0, up: 0, down: 0, firstV: 0, lastV: 0, fifoX: 0 }; M.forEach(function (m) { Tt[m] = 0; });
        D.forEach(function (r) {
          M.forEach(function (m) { Tt[m] += r.v[m]; }); Tt.fin += r.fin; Tt.lcm += r.lcmCut; Tt.pv += r.pv || 0;
          if (r.nlev > 1) Tt.multi++; if (!r.has) Tt.noPur++; if (r.has && r.last > r.first + 1e-9) Tt.up++; if (r.has && r.last < r.first - 1e-9) Tt.down++;
          if (r.has && r.q > 0) { Tt.firstV += r.q * r.first; Tt.lastV += r.q * r.last; } if (r.fifoX > 0) Tt.fifoX++;
        });
        var mName = vbMethName(meth), mS = VB_SHORT[meth] + (lcm ? ' + الأقل' : ''), rows, cols, title;
        var priceRange = function (r) { if (!r.has) return 'بدون مشتريات حتى التاريخ'; var f = r.f; return r.max - r.min > 1e-9 ? fm(r.min * f) + '\u00a0–\u00a0' + fm(r.max * f) : r.max > 0 ? fm(r.max * f) : 'مجاني فقط'; };
        if (view === 'sum') {
          var grp = {
            item: function (r) { return [r.it, itemName(r.it)]; },
            icl: function (r) { var c = iclTop(r.it); return [c || '-', c ? iclName(c) : 'بدون تصنيف']; },
            igrp: function (r) { var g = igrpOf(r.it); return [g || '-', g ? igrpName(g) : 'بدون مجموعة']; },
            sup: function (r) { var s = r.sup && r.sup[0]; return [s || '-', s || 'بدون مشتريات']; }
          }[by];
          var G = {}, add = function (id, name, r, share) {
            var g = G[id] || (G[id] = { name: name, items: {}, q: 0, fin: 0, pv: 0, v: {}, np: 0, it: null });
            g.items[r.it] = 1; M.forEach(function (m) { g.v[m] = (g.v[m] || 0) + r.v[m] * share; }); g.fin += r.fin * share; if (share === 1) g.pv += r.pv || 0;
            if (by === 'item') { g.it = r; }
          };
          D.forEach(function (r) {
            if (by === 'st') Object.keys(qst[r.it]).forEach(function (sid) { add(sid, stLabel(sid), r, qst[r.it][sid] / r.q); });
            else { var k = grp(r); add(k[0], k[1], r, 1); }
          });
          rows = Object.keys(G).map(function (k) { var g = G[k], o = { name: g.name, items: Object.keys(g.items).length, fin: g.fin, share: pct(g.fin, Tt.fin), book: g.v.mavg, diff: g.fin - g.v.mavg, dpct: pct(g.fin - g.v.mavg, g.v.mavg), fifo: g.v.fifo, wavg: g.v.wavg, last: g.v.last, min: g.v.min, max: g.v.max, pv: g.pv };
            if (g.it) { var r = g.it; o.unit = unitOf(r.it); o.q = r.q / r.f; o.np = r.has ? r.nlev : 0; o.range = priceRange(r); o.prices = vbPrices(r); o.uf = r.unitF * r.f; o.chg = r.chg; o.lastD = r.lastD || '—'; o.sup = r.sup && r.sup.length ? r.sup.map(vbFull).join('\n') : '—'; }
            return o; }).sort(function (a, b) { return b.fin - a.fin; });
          var byL = { item: 'الصنف', st: 'المخزن', icl: 'التصنيف', igrp: 'المجموعة', sup: 'المورد الرئيسي' }[by];
          cols = [C('name', byL)];
          if (by === 'item') cols = cols.concat([C('unit', 'الوحدة'), C('q', 'الكمية', 'qty'), C('np', 'عدد الأسعار', 'int'), C('prices', 'أسعار الشراء (× عدد مرات الشراء)', 'long'), C('chg', 'تغير السعر %', 'pct'), C('uf', 'تكلفة الوحدة النهائية (' + mS + ')', 'money')]);
          else cols.push(C('items', 'عدد الأصناف', 'int'));
          cols = cols.concat([C('fin', 'القيمة النهائية (' + mS + ')', 'money'), C('share', 'من الإجمالي %', 'pct'), C('book', 'الدفترية (متوسط متحرك)', 'money'), C('diff', 'الفرق عن الدفتري', 'money'), C('dpct', 'الفرق %', 'pct'), C('fifo', 'FIFO', 'money'), C('wavg', 'المتوسط المرجح', 'money'), C('last', 'بآخر سعر', 'money'), C('min', 'بأقل سعر', 'money'), C('max', 'بأعلى سعر', 'money')]);
          if (by === 'item') cols.push(C('sup', 'الموردون (الرئيسي أولاً)', 'long'));
          title = 'تقييم المخزون بأسعار الشراء — ملخص حسب ' + byL + ' (' + mName + (lcm ? ' + قاعدة الأقل' : '') + ')';
        } else {
          rows = [];
          D.sort(function (a, b) { return b.fin - a.fin; }).forEach(function (r, gi) {
            var f = r.f;
            rows.push({ _g: gi, _gh: 1, _b: true, name: itemName(r.it) + ' (' + unitOf(r.it) + ')', src: r.has ? (r.sup.length === 1 ? 'مورد واحد' : r.sup.length === 2 ? 'موردان' : r.sup.length ? r.sup.length + (r.sup.length <= 10 ? ' موردين' : ' مورداً') : '—') : 'بدون مشتريات', d1: r.has ? r.tiers.reduce(function (m, t) { return !m || (t.d1 && t.d1 < m) ? t.d1 : m; }, '') : '—', d2: r.lastD || '—', ninv: r.has ? r.ninv : '', pq: r.has ? r.nq / f : '', rq: r.rq ? r.rq / f : '', pp: r.has ? r.wavg * f : '', pv: r.has ? r.pv : '', sq: r.q / f, uf: r.unitF * f, fin: r.fin, book: r.v.mavg, diff: r.diff });
            r.tiers.forEach(function (t) {
              var nq = Math.max(0, t.qb - t.rq), sup = Object.keys(t.sup);
              rows.push({ _g: gi, _lvl: 1, name: t.label === 'o' ? 'بضاعة أول المدة بسعر ' + fm(t.pb * f) : t.pb > 0 ? 'سعر شراء ' + fm(t.pb * f) : 'مجاني (بونص)', src: t.label === 'o' ? '—' : sup.sort(function (a, b) { return t.sup[b] - t.sup[a]; }).map(vbFull).join('\n'), d1: t.d1, d2: t.d2, ninv: Object.keys(t.inv).length, pq: nq / f, rq: t.rq ? t.rq / f : '', pp: t.pb * f, pv: nq * t.pb, sq: meth === 'fifo' ? t.fq / f : '', uf: '', fin: meth === 'fifo' ? t.fq * t.pb : '', book: '', diff: '' });
            });
            if (meth === 'fifo' && r.fifoX > 0) rows.push({ _g: gi, _lvl: 1, name: 'رصيد غير مغطى بمشتريات (بالتكلفة الدفترية)', src: '', d1: '', d2: '', pq: '', pp: r.book * f, sq: r.fifoX / f, fin: r.fifoX * r.book });
          });
          cols = [C('name', 'الصنف / سعر الشراء'), C('src', 'المورد', 'long'), C('d1', 'من'), C('d2', 'إلى'), C('ninv', 'الفواتير', 'int'), C('pq', 'الكمية المشتراة', 'qty'), C('rq', 'المرتجع', 'qty'), C('pp', 'سعر الشراء', 'money'), C('pv', 'قيمة المشتريات', 'money'), C('sq', meth === 'fifo' ? 'بالمخزون (FIFO)' : 'الكمية بالمخزون', 'qty'), C('uf', 'تكلفة الوحدة النهائية (' + mS + ')', 'money'), C('fin', 'القيمة النهائية (' + mS + ')', 'money'), C('book', 'الدفترية', 'money'), C('diff', 'الفرق', 'money')];
          title = 'تقييم المخزون بأسعار الشراء — تفصيلي (' + mName + (lcm ? ' + قاعدة الأقل' : '') + ')';
        }
        var qT = D.reduce(function (a, r) { return a + r.q / r.f; }, 0), pqT = D.reduce(function (a, r) { return a + (r.has ? r.nq / r.f : 0); }, 0), rqT = D.reduce(function (a, r) { return a + (r.rq ? r.rq / r.f : 0); }, 0);
        var total = { name: 'الإجمالي', _b: true, items: D.length, q: qT, sq: qT, pq: pqT, rq: rqT || '', fin: Tt.fin, share: 100, book: Tt.mavg, diff: Tt.fin - Tt.mavg, dpct: pct(Tt.fin - Tt.mavg, Tt.mavg), fifo: Tt.fifo, wavg: Tt.wavg, last: Tt.last, min: Tt.min, max: Tt.max, pv: Tt.pv };
        var tots = M.map(function (m) { return Tt[m]; }), lo = Math.min.apply(null, tots), hi = Math.max.apply(null, tots), infl = pct(Tt.lastV - Tt.firstV, Tt.firstV);
        var kpis = [
          { l: 'القيمة النهائية للمخزون', v: Tt.fin, t: 'money', s: mName + (lcm ? ' + قاعدة الأقل' : '') },
          { l: 'القيمة الدفترية (سراج)', v: Tt.mavg, t: 'money', s: 'متوسط التكلفة المتحرك' },
          { l: 'الفرق عن الدفاتر', v: Tt.fin - Tt.mavg, t: 'money', s: (function (x) { return (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2)) + '% من القيمة الدفترية'; })(pct(Tt.fin - Tt.mavg, Tt.mavg)), bad: Math.abs(Tt.fin - Tt.mavg) > 0.5 },
          { l: 'مدى التقييم بين الطرق', v: hi - lo, t: 'money', s: 'من ' + fm(lo) + ' إلى ' + fm(hi) },
          { l: 'تغير أسعار الشراء', v: infl, t: 'pct', s: 'آخر سعر مقابل أول سعر · ' + Tt.up + ' ارتفع · ' + Tt.down + ' انخفض', bad: infl > 0.05 },
          { l: 'أصناف بأكثر من سعر شراء', v: Tt.multi, t: 'int', s: 'من ' + D.length + ' صنف بالمخزون' },
          { l: 'مشتريات حتى التاريخ', v: Tt.pv, t: 'money', s: 'لأصناف المخزون الحالية' },
          lcm ? { l: 'تخفيض قاعدة الأقل', v: Tt.lcm, t: 'money', s: 'سعر البيع أقل من التكلفة', bad: Tt.lcm > 0.5 } : { l: 'أصناف بلا مشتريات', v: Tt.noPur, t: 'int', s: 'تُقيَّم بالتكلفة الدفترية', bad: Tt.noPur > 0 }
        ];
        var note = 'طريقة التقييم النهائي: ' + mName + (lcm ? ' مع قاعدة الأقل من التكلفة أو سعر البيع أ' + (ipr ? '' : ' (قوائم الأسعار لم تصل، فلم تُطبَّق)') : '') +
          ' · أسعار الشراء بالوحدة الشائعة من فواتير الشراء وبضاعة أول المدة حتى التاريخ، والمرتجع يُخصم من طبقة سعره · FIFO: الرصيد الموجود يُقيَّم بأحدث أسعار الشراء رجوعاً' + (Tt.fifoX ? '، والزائد عن المشتريات بالتكلفة الدفترية (' + Tt.fifoX + ' صنف)' : '') +
          ' · أسعار الشراء: كل سعر مع عدد مرات الشراء به (عدد الفواتير، وقيود بضاعة أول المدة) · المتوسط المرجح يشمل الكميات المجانية (البونص) بسعر صفر · الأسعار وطرق التقييم على مستوى الشركة، وتصفية المخزن تحدد الكميات فقط · الدفترية = متوسط التكلفة المتحرك كما في سراج';
        var res = { title: title, cols: cols, rows: rows, total: total, kpis: kpis, note: note };
        res.printKeys = view === 'sum' ? ['name', 'unit', 'q'] : ['name'];
        if (view === 'det') res._grouped = true;
        else res.chart = { type: 'hbar', x: 'name', y: ['v'], yl: ['قيمة المخزون'], rowsOverride: M.map(function (m) { return { name: (m === meth ? '◀ ' : '') + vbMethName(m), v: Tt[m] }; }), limit: 6 };
        return withNote(res, p);
      } };

    /* ===================== الموردون: تقارير فواتير شراء الموردين ===================== */
    (function () { var ii = -1; CATS.forEach(function (c, i) { if (c[0] === 'purch') ii = i; }); CATS.splice(ii + 1, 0, ['supp', 'فواتير شراء الموردين']); })();
    var SFD = ['supp', 'item', 'st', 'u'];
    function spKey(v) { return String(v.ck || v.name || '-'); }
    function spName(v) { return v.name || (acc(v.ck) || {}).name || 'بدون مورد'; }
    // فواتير الشراء والمرتجعات في الفترة، مجمّعة لكل فاتورة (مع البونص: سطور بلا قيمة)
    function spInvoices(p) {
      var g = {};
      facts('p', p.from, p.to, p.flt).forEach(function (x) {
        var r = g[x.v.id] || (g[x.v.id] = { v: x.v, s: x.s, key: spKey(x.v), name: spName(x.v), qty: 0, free: 0, val: 0, lines: 0, items: {} });
        r.lines++; r.items[x.l.item] = 1; r.val += x.val; if (x.val > 0) r.qty += x.qty; else r.free += x.qty;
      });
      return Object.keys(g).map(function (k) { return g[k]; });
    }
    function spDays(a, b) { return a && b ? Math.round((new Date(b) - new Date(a)) / 864e5) : ''; }
    function isSupAcc(key) { var c = F.cache.spPay || (F.cache.spPay = (function () { var o = {}; payIds().forEach(function (id) { o[id] = 1; }); return o; })()); return !!c[key]; }
    function supBalance(key, to) { if (!isSupAcc(key)) return null; var b = balance([key], yearStart(), to); return -b.close; }

    /* 1) ملخص فواتير الموردين */
    R.supp_summary = { cat: 'supp', name: 'ملخص فواتير شراء الموردين', desc: 'لكل مورد: عدد فواتير الشراء والمرتجعات، والمشتريات والمرتجعات والصافي ونسبة المرتجع، ومتوسط الفاتورة، والأصناف، والبونص، وأول وآخر فاتورة ومعدل تكرار الشراء، والمسدد خلال الفترة والرصيد المستحق له',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var inv = spInvoices(p), G = {};
        if (!inv.length) return emptyR('لا توجد فواتير شراء في الفترة');
        inv.forEach(function (r) {
          var g = G[r.key] || (G[r.key] = { key: r.key, name: r.name, n: 0, nr: 0, pur: 0, ret: 0, qty: 0, free: 0, items: {}, ds: [] });
          if (r.s > 0) { g.n++; g.pur += r.val; g.qty += r.qty; g.free += r.free; g.ds.push(r.v.d); } else { g.nr++; g.ret += r.val; }
          Object.keys(r.items).forEach(function (k) { g.items[k] = 1; });
        });
        var tot = 0; Object.keys(G).forEach(function (k) { tot += G[k].pur - G[k].ret; });
        var rows = Object.keys(G).map(function (k) {
          var g = G[k], ds = g.ds.sort(), d1 = ds[0] || '', d2 = ds[ds.length - 1] || '', net = g.pur - g.ret, u = {}; ds.forEach(function (d) { u[d] = 1; });
          var days = Object.keys(u).sort(), gap = days.length > 1 ? spDays(days[0], days[days.length - 1]) / (days.length - 1) : '';
          var b = isSupAcc(k) ? balance([k], p.from, p.to) : null, paid = b ? b.dr - g.ret : '', due = supBalance(k, p.to);
          return { name: g.name, n: g.n, nr: g.nr, pur: g.pur, ret: g.ret, net: net, rp: pct(g.ret, g.pur), share: pct(net, tot), avg: g.n ? g.pur / g.n : 0, items: Object.keys(g.items).length,
            qty: g.qty, free: g.free, fp: pct(g.free, g.qty + g.free), d1: d1 || '—', d2: d2 || '—', since: d2 ? spDays(d2, p.to) : '', gap: gap === '' ? '' : Math.round(gap * 10) / 10, paid: paid, due: due === null ? '' : due };
        }).sort(function (a, b) { return b.net - a.net; });
        var t = sumRow(rows, [C('n', '', 'int'), C('nr', '', 'int'), C('pur', '', 'money'), C('ret', '', 'money'), C('net', '', 'money'), C('qty', '', 'qty'), C('free', '', 'qty'), C('paid', '', 'money'), C('due', '', 'money')]);
        t.rp = pct(t.ret, t.pur); t.share = 100; t.avg = t.n ? t.pur / t.n : 0; t.fp = pct(t.free, t.qty + t.free);
        var allItems = {}; inv.forEach(function (r) { Object.keys(r.items).forEach(function (k) { allItems[k] = 1; }); }); t.items = Object.keys(allItems).length;
        var top = rows[0];
        var kpis = [
          { l: 'صافي المشتريات', v: t.net, t: 'money', s: rows.length + ' مورد · ' + t.n + ' فاتورة' },
          { l: 'مرتجعات الشراء', v: t.ret, t: 'money', s: t.nr + ' فاتورة · ' + t.rp.toFixed(1) + '% من المشتريات', bad: t.rp > 5 },
          { l: 'متوسط فاتورة الشراء', v: t.avg, t: 'money', s: 'المشتريات ÷ عدد الفواتير' },
          { l: 'أكبر مورد', v: top ? top.share : 0, t: 'pct', s: top ? top.name : '' , bad: top && top.share > 70 },
          { l: 'الكميات المجانية (بونص)', v: t.free, t: 'int', s: t.fp.toFixed(1) + '% من الكمية المستلمة' },
          { l: 'المسدد للموردين', v: t.paid || 0, t: 'money', s: 'خلال الفترة (حركة مدين − المرتجعات)' },
          { l: 'المستحق للموردين', v: t.due || 0, t: 'money', s: 'الرصيد في ' + p.to },
          { l: 'الأصناف المشتراة', v: t.items, t: 'int', s: 'صنفاً مختلفاً' }
        ];
        return withNote({ title: 'ملخص فواتير شراء الموردين', _noCust: true, kpis: kpis, rows: rows, total: t,
          cols: [C('name', 'المورد'), C('n', 'فواتير الشراء', 'int'), C('nr', 'المرتجعات', 'int'), C('pur', 'المشتريات', 'money'), C('ret', 'مرتجع الشراء', 'money'), C('net', 'صافي المشتريات', 'money'), C('rp', 'المرتجع %', 'pct'), C('share', 'من الإجمالي %', 'pct'), C('avg', 'متوسط الفاتورة', 'money'), C('items', 'الأصناف', 'int'), C('qty', 'الكمية المدفوعة', 'qty'), C('free', 'البونص', 'qty'), C('fp', 'البونص %', 'pct'), C('d1', 'أول فاتورة'), C('d2', 'آخر فاتورة'), C('since', 'أيام منذ آخر فاتورة', 'int'), C('gap', 'كل كم يوم يُشترى', 'qty'), C('paid', 'المسدد في الفترة', 'money'), C('due', 'المستحق للمورد', 'money')],
          note: 'المورد = حساب فاتورة الشراء · المسدد والمستحق لحسابات الموردين فقط (تحت حساب الموردين في الإعدادات) · الكمية بالوحدة الشائعة · البونص = سطور بلا قيمة · «كل كم يوم» = متوسط الأيام بين أيام الشراء · المسدد = الحركة المدينة على حساب المورد في الفترة بعد خصم المرتجعات · المستحق = رصيده الدائن في نهاية الفترة',
          chart: rows.length > 1 ? { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المشتريات'], limit: 12 } : null }, p);
      } };

    /* 2) سجل فواتير الشراء حسب المورد */
    R.supp_register = { cat: 'supp', name: 'سجل فواتير الشراء حسب المورد', desc: 'فواتير الشراء والمرتجعات لكل مورد تحت عنوانه مع إجماليه: التاريخ والرقم والنوع والمخزن وعدد البنود والكمية والبونص والصافي والبيان',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var inv = spInvoices(p);
        if (!inv.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var G = {}; inv.forEach(function (r) { (G[r.key] = G[r.key] || { name: r.name, list: [] }).list.push(r); });
        var gs = Object.keys(G).map(function (k) { var g = G[k]; g.net = g.list.reduce(function (s, r) { return s + r.s * r.val; }, 0); return g; }).sort(function (a, b) { return b.net - a.net; });
        var rows = [];
        gs.forEach(function (g, gi) {
          var n = g.list.filter(function (r) { return r.s > 0; }).length, nr = g.list.length - n;
          rows.push({ _g: gi, _gh: 1, _b: true, d: '', no: '', name: g.name + ' (' + n + ' فاتورة' + (nr ? ' · ' + nr + ' مرتجع' : '') + ')', type: '', st: '', lines: g.list.reduce(function (s, r) { return s + r.lines; }, 0), qty: g.list.reduce(function (s, r) { return s + r.s * r.qty; }, 0), free: g.list.reduce(function (s, r) { return s + r.s * r.free; }, 0), net: g.net, note: '' });
          g.list.sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : a.v.dt > b.v.dt ? 1 : 0; }).forEach(function (r) {
            rows.push({ _g: gi, _lvl: 1, _hl: r.s < 0, d: r.v.d, no: r.v.no, name: r.s > 0 ? 'فاتورة شراء' : 'مرتجع شراء', st: stLabel(r.v.st), lines: r.lines, qty: r.s * r.qty, free: r.s * r.free, net: r.s * r.val, note: r.v.note || '' });
          });
        });
        var t = { name: 'الإجمالي (' + inv.length + ' فاتورة)', _b: true, lines: 0, qty: 0, free: 0, net: 0 };
        inv.forEach(function (r) { t.lines += r.lines; t.qty += r.s * r.qty; t.free += r.s * r.free; t.net += r.s * r.val; });
        return withNote({ title: 'سجل فواتير الشراء حسب المورد', rows: rows, total: t, _grouped: true,
          cols: [C('name', 'المورد / نوع الفاتورة'), C('d', 'التاريخ'), C('no', 'الرقم'), C('st', 'المخزن'), C('lines', 'البنود', 'int'), C('qty', 'الكمية', 'qty'), C('free', 'البونص', 'qty'), C('net', 'الصافي', 'money'), C('note', 'البيان', 'long')],
          note: 'المرتجعات بالسالب ومظللة · الكمية بالوحدة الشائعة · البونص = سطور بلا قيمة' }, p);
      } };

    /* 3) تفاصيل فواتير الشراء (بنود كل فاتورة) */
    R.supp_inv_lines = { cat: 'supp', name: 'تفاصيل فواتير الشراء (بنود الفاتورة)', desc: 'كل فاتورة شراء أو مرتجع تحت عنوانها (المورد والرقم والتاريخ والمخزن والصافي) وتحتها بنودها: الصنف والوحدة والكمية والسعر والإجمالي وتكلفة الوحدة الشائعة',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var xs = facts('p', p.from, p.to, p.flt);
        if (!xs.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var G = {}; xs.forEach(function (x) { (G[x.v.id] = G[x.v.id] || { v: x.v, s: x.s, l: [] }).l.push(x); });
        var gs = Object.keys(G).map(function (k) { return G[k]; }).sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : a.v.dt > b.v.dt ? 1 : 0; });
        var LIM = 3000, rows = [], cut = 0, t = { item: 'الإجمالي (' + gs.length + ' فاتورة)', _b: true, qty: 0, net: 0 };
        gs.forEach(function (g, gi) {
          var net = g.l.reduce(function (s, x) { return s + x.val; }, 0), qty = g.l.reduce(function (s, x) { return s + x.qty; }, 0);
          t.qty += g.s * qty; t.net += g.s * net;
          if (rows.length > LIM) { cut++; return; }
          rows.push({ _g: gi, _gh: 1, _b: true, _hl: g.s < 0, item: (g.s > 0 ? 'فاتورة شراء ' : 'مرتجع شراء ') + g.v.no + ' · ' + spName(g.v), d: g.v.d, unit: stLabel(g.v.st), q: '', p: '', qty: g.s * qty, net: g.s * net, cu: '' });
          g.l.forEach(function (x) {
            var f = (T().item[x.l.item] || {}).f || 1;
            rows.push({ _g: gi, _lvl: 1, item: itemName(x.l.item), d: '', unit: x.l.un || unitOf(x.l.item), q: g.s * (x.l.q || 0), p: x.l.p || (x.l.q ? x.val / x.l.q : 0), qty: g.s * x.qty, net: g.s * x.val, cu: x.l.qb ? x.val / x.l.qb * f : 0, free: x.val > 0 ? '' : 'بونص' });
          });
        });
        return withNote({ title: 'تفاصيل فواتير الشراء', rows: rows, total: t, _grouped: true,
          cols: [C('item', 'الفاتورة / الصنف'), C('d', 'التاريخ'), C('unit', 'المخزن / الوحدة'), C('q', 'الكمية بوحدة الفاتورة', 'qty'), C('p', 'السعر', 'money'), C('qty', 'الكمية (الوحدة الشائعة)', 'qty'), C('cu', 'تكلفة الوحدة الشائعة', 'money'), C('net', 'الإجمالي', 'money'), C('free', 'ملاحظة')],
          note: (cut ? 'عُرضت أول الفواتير فقط (' + cut + ' فاتورة لم تُعرض، والإجمالي يشملها) — ضيّق الفترة أو اختر مورداً · ' : '') + 'المرتجعات بالسالب ومظللة' }, p);
      } };

    /* 4) أصناف كل مورد وأسعارها */
    R.supp_items = { cat: 'supp', name: 'أصناف كل مورد وأسعار شرائها', desc: 'لكل مورد: الأصناف التي اشتُريت منه بعدد الفواتير والكمية والبونص والقيمة، ومتوسط وأقل وأعلى وآخر سعر شراء، ونصيب الصنف من مشتريات المورد',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var xs = facts('p', p.from, p.to, p.flt);
        if (!xs.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var G = {};
        xs.forEach(function (x) {
          var k = spKey(x.v), g = G[k] || (G[k] = { name: spName(x.v), it: {}, net: 0 }), e = g.it[x.l.item] || (g.it[x.l.item] = { inv: {}, qty: 0, free: 0, val: 0, rq: 0, rv: 0, ps: [] });
          if (x.s > 0) { e.inv[x.v.id] = 1; if (x.val > 0) { e.qty += x.qty; e.val += x.val; e.ps.push([x.v.dt, x.val / x.qty]); } else e.free += x.qty; g.net += x.val; }
          else { e.rq += x.qty; e.rv += x.val; g.net -= x.val; }
        });
        var gs = Object.keys(G).map(function (k) { return G[k]; }).sort(function (a, b) { return b.net - a.net; }), rows = [];
        gs.forEach(function (g, gi) {
          var its = Object.keys(g.it).map(function (k) { var e = g.it[k]; e.id = k; e.net = e.val - e.rv; return e; }).sort(function (a, b) { return b.net - a.net; });
          rows.push({ _g: gi, _gh: 1, _b: true, name: g.name + ' (' + its.length + ' صنف)', net: g.net, share: 100 });
          its.forEach(function (e) {
            var ps = e.ps.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).map(function (x) { return x[1]; });
            rows.push({ _g: gi, _lvl: 1, name: itemName(e.id), unit: unitOf(e.id), inv: Object.keys(e.inv).length, qty: e.qty, free: e.free, rq: e.rq || '', avg: e.qty ? e.val / e.qty : '', min: ps.length ? Math.min.apply(null, ps) : '', max: ps.length ? Math.max.apply(null, ps) : '', last: ps.length ? ps[ps.length - 1] : '', net: e.net, share: pct(e.net, g.net) });
          });
        });
        var t = { name: 'الإجمالي', _b: true, net: gs.reduce(function (s, g) { return s + g.net; }, 0) };
        return withNote({ title: 'أصناف كل مورد وأسعار شرائها', rows: rows, total: t, _grouped: true,
          cols: [C('name', 'المورد / الصنف'), C('unit', 'الوحدة'), C('inv', 'الفواتير', 'int'), C('qty', 'الكمية', 'qty'), C('free', 'البونص', 'qty'), C('rq', 'المرتجع', 'qty'), C('avg', 'متوسط السعر', 'money'), C('min', 'أقل سعر', 'money'), C('max', 'أعلى سعر', 'money'), C('last', 'آخر سعر', 'money'), C('net', 'صافي القيمة', 'money'), C('share', 'من مشتريات المورد %', 'pct')],
          note: 'الأسعار للوحدة الشائعة من سطور الشراء المدفوعة (بدون البونص) · صافي القيمة = المشتريات − المرتجعات' }, p);
      } };

    /* 5) مرتجعات الشراء حسب المورد */
    R.supp_returns = { cat: 'supp', name: 'مرتجعات الشراء حسب المورد', desc: 'فواتير مرتجع الشراء لكل مورد مع أصنافها وقيمتها، ونسبة المرتجع من مشتريات المورد',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var xs = facts('p', p.from, p.to, p.flt), G = {};
        xs.forEach(function (x) {
          var k = spKey(x.v), g = G[k] || (G[k] = { name: spName(x.v), pur: 0, ret: 0, inv: {} });
          if (x.s > 0) g.pur += x.val; else { g.ret += x.val; var r = g.inv[x.v.id] || (g.inv[x.v.id] = { v: x.v, val: 0, qty: 0, it: {} }); r.val += x.val; r.qty += x.qty; r.it[itemName(x.l.item)] = 1; }
        });
        var gs = Object.keys(G).map(function (k) { return G[k]; }).filter(function (g) { return g.ret; }).sort(function (a, b) { return b.ret - a.ret; });
        if (!gs.length) return emptyR('لا توجد مرتجعات شراء في الفترة');
        var rows = [];
        gs.forEach(function (g, gi) {
          var ls = Object.keys(g.inv).map(function (k) { return g.inv[k]; });
          rows.push({ _g: gi, _gh: 1, _b: true, name: g.name, n: ls.length, pur: g.pur, ret: g.ret, rp: pct(g.ret, g.pur), qty: ls.reduce(function (s, r) { return s + r.qty; }, 0) });
          ls.sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : 1; }).forEach(function (r) { rows.push({ _g: gi, _lvl: 1, name: 'مرتجع ' + r.v.no, d: r.v.d, st: stLabel(r.v.st), qty: r.qty, ret: r.val, its: Object.keys(r.it).join('\n'), note: r.v.note || '' }); });
        });
        var t = { name: 'الإجمالي', _b: true, n: 0, pur: 0, ret: 0, qty: 0 }; gs.forEach(function (g) { t.n += Object.keys(g.inv).length; t.pur += g.pur; t.ret += g.ret; }); t.rp = pct(t.ret, t.pur);
        rows.forEach(function (r) { if (r._gh) t.qty += r.qty; });
        return withNote({ title: 'مرتجعات الشراء حسب المورد', rows: rows, total: t, _grouped: true,
          cols: [C('name', 'المورد / المرتجع'), C('d', 'التاريخ'), C('st', 'المخزن'), C('n', 'عدد المرتجعات', 'int'), C('pur', 'مشتريات المورد', 'money'), C('ret', 'قيمة المرتجع', 'money'), C('rp', 'المرتجع %', 'pct'), C('qty', 'الكمية', 'qty'), C('its', 'الأصناف', 'long'), C('note', 'البيان', 'long')] }, p);
      } };

    /* 6) البونص والكميات المجانية من الموردين */
    R.supp_bonus = { cat: 'supp', name: 'البونص والكميات المجانية من الموردين', desc: 'لكل مورد وصنف: الكمية المدفوعة والمجانية ونسبة البونص، وقيمة البونص التقديرية بمتوسط سعر الشراء، وأثره في خفض تكلفة الوحدة',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var G = {};
        facts('p', p.from, p.to, p.flt).forEach(function (x) {
          if (x.s < 0) return;
          var k = spKey(x.v), g = G[k] || (G[k] = { name: spName(x.v), it: {} }), e = g.it[x.l.item] || (g.it[x.l.item] = { pq: 0, pv: 0, fq: 0, n: {} });
          if (x.val > 0) { e.pq += x.qty; e.pv += x.val; } else { e.fq += x.qty; e.n[x.v.id] = 1; }
        });
        var rows = [], T0 = { pq: 0, fq: 0, fv: 0 }, gi = 0;
        Object.keys(G).map(function (k) { return G[k]; }).forEach(function (g) {
          var its = Object.keys(g.it).map(function (k) { var e = g.it[k]; e.id = k; e.avg = e.pq ? e.pv / e.pq : 0; e.fv = e.fq * e.avg; return e; }).filter(function (e) { return e.fq > 0; }).sort(function (a, b) { return b.fv - a.fv || b.fq - a.fq; });
          if (!its.length) return;
          var h = { _g: gi, _gh: 1, _b: true, name: g.name, pq: 0, fq: 0, fv: 0 }; its.forEach(function (e) { h.pq += e.pq; h.fq += e.fq; h.fv += e.fv; }); h.fp = pct(h.fq, h.pq + h.fq); rows.push(h);
          its.forEach(function (e) { rows.push({ _g: gi, _lvl: 1, name: itemName(e.id), unit: unitOf(e.id), n: Object.keys(e.n).length, pq: e.pq, fq: e.fq, fp: pct(e.fq, e.pq + e.fq), avg: e.avg, fv: e.fv, eff: e.pq + e.fq ? e.pv / (e.pq + e.fq) : '' }); });
          T0.pq += h.pq; T0.fq += h.fq; T0.fv += h.fv; gi++;
        });
        if (!rows.length) return emptyR('لا توجد كميات مجانية من الموردين في الفترة');
        return withNote({ title: 'البونص والكميات المجانية من الموردين', rows: rows, _grouped: true, total: { name: 'الإجمالي', _b: true, pq: T0.pq, fq: T0.fq, fp: pct(T0.fq, T0.pq + T0.fq), fv: T0.fv },
          cols: [C('name', 'المورد / الصنف'), C('unit', 'الوحدة'), C('n', 'فواتير البونص', 'int'), C('pq', 'الكمية المدفوعة', 'qty'), C('fq', 'الكمية المجانية', 'qty'), C('fp', 'البونص %', 'pct'), C('avg', 'متوسط سعر الشراء', 'money'), C('fv', 'قيمة البونص التقديرية', 'money'), C('eff', 'التكلفة الفعلية للوحدة', 'money')],
          note: 'البونص = سطور شراء بلا قيمة · قيمته التقديرية = الكمية المجانية × متوسط سعر الشراء المدفوع · التكلفة الفعلية = المدفوع ÷ (المدفوعة + المجانية) · الأصناف ذات البونص فقط' }, p);
      } };

    /* 7) نشاط الموردين شهرياً */
    R.supp_months = { cat: 'supp', name: 'فواتير الموردين شهرياً', desc: 'لكل مورد في كل شهر: عدد الفواتير أو صافي المشتريات أو الكمية، مع الإجمالي والمتوسط الشهري',
      params: ['period', 'flt'], fdims: SFD, sel: [['metric', 'المقياس', [['net', 'صافي المشتريات'], ['n', 'عدد الفواتير'], ['qty', 'الكمية']]]],
      run: function (p) {
        var m = p.metric || 'net', G = {}, months = {};
        spInvoices(p).forEach(function (r) {
          var ym = r.v.d.slice(0, 7), g = G[r.key] || (G[r.key] = { name: r.name, m: {} }); months[ym] = 1;
          g.m[ym] = (g.m[ym] || 0) + (m === 'n' ? (r.s > 0 ? 1 : 0) : m === 'qty' ? r.s * r.qty : r.s * r.val);
        });
        var ms = Object.keys(months).sort();
        if (!ms.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var ty = m === 'n' ? 'int' : m === 'qty' ? 'qty' : 'money';
        var rows = Object.keys(G).map(function (k) { var g = G[k], o = { name: g.name, tot: 0 }; ms.forEach(function (x) { o[x] = g.m[x] || 0; o.tot += o[x]; }); o.avg = o.tot / ms.length; return o; }).sort(function (a, b) { return b.tot - a.tot; });
        var cols = [C('name', 'المورد')].concat(ms.map(function (x) { return C(x, x, ty); }), [C('tot', 'الإجمالي', ty), C('avg', 'المتوسط الشهري', m === 'n' ? 'qty' : ty)]);
        var t = sumRow(rows, cols.slice(1)); t.avg = t.tot / ms.length;
        return withNote({ _noCust: true, title: 'فواتير الموردين شهرياً — ' + ({ net: 'صافي المشتريات', n: 'عدد الفواتير', qty: 'الكمية' })[m], rows: rows, total: t, cols: cols,
          chart: { type: 'line', x: 'm', y: ['v'], yl: ['الإجمالي'], rowsOverride: ms.map(function (x) { return { m: x, v: t[x] }; }) } }, p);
      } };

    /* 8) تحليل أحجام فواتير الشراء */
    var SP_BUCKETS = [[0, 10000], [10000, 50000], [50000, 100000], [100000, 250000], [250000, 1e15]];
    R.supp_inv_size = { cat: 'supp', name: 'تحليل أحجام فواتير الشراء', desc: 'توزيع فواتير الشراء على شرائح القيمة: العدد والقيمة والنصيب لكل شريحة، لكل الموردين أو لكل مورد',
      params: ['period', 'flt'], fdims: SFD, sel: [['by', 'التجميع', [['all', 'كل الموردين'], ['sup', 'لكل مورد']]]],
      run: function (p) {
        var inv = spInvoices(p).filter(function (r) { return r.s > 0; });
        if (!inv.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var lab = function (b) { return b[1] >= 1e15 ? 'أكثر من ' + fk(b[0]) : fk(b[0]) + ' – ' + fk(b[1]); };
        var tot = inv.reduce(function (s, r) { return s + r.val; }, 0), rows = [];
        var block = function (list, gi, head) {
          if (head) rows.push({ _g: gi, _gh: 1, _b: true, name: head, n: list.length, val: list.reduce(function (s, r) { return s + r.val; }, 0), avg: '' });
          var gt = list.reduce(function (s, r) { return s + r.val; }, 0);
          SP_BUCKETS.forEach(function (b) {
            var xs = list.filter(function (r) { return r.val >= b[0] && r.val < b[1]; }); if (!xs.length) return;
            var v = xs.reduce(function (s, r) { return s + r.val; }, 0);
            rows.push({ _g: gi, _lvl: head ? 1 : 0, name: lab(b), n: xs.length, np: pct(xs.length, list.length), val: v, share: pct(v, gt), avg: v / xs.length, max: Math.max.apply(null, xs.map(function (r) { return r.val; })) });
          });
        };
        if (p.by === 'sup') { var G = {}; inv.forEach(function (r) { (G[r.key] = G[r.key] || { name: r.name, l: [] }).l.push(r); }); Object.keys(G).map(function (k) { return G[k]; }).sort(function (a, b) { return b.l.length - a.l.length; }).forEach(function (g, i) { block(g.l, i, g.name); }); }
        else block(inv, 0, null);
        return withNote({ title: 'تحليل أحجام فواتير الشراء', rows: rows, _grouped: p.by === 'sup', total: { name: 'الإجمالي', _b: true, n: inv.length, np: 100, val: tot, share: 100, avg: tot / inv.length },
          cols: [C('name', p.by === 'sup' ? 'المورد / شريحة القيمة' : 'شريحة قيمة الفاتورة'), C('n', 'عدد الفواتير', 'int'), C('np', 'من العدد %', 'pct'), C('val', 'القيمة', 'money'), C('share', 'من القيمة %', 'pct'), C('avg', 'متوسط الفاتورة', 'money'), C('max', 'أكبر فاتورة', 'money')],
          note: 'فواتير الشراء فقط (بدون المرتجعات) · الشرائح بقيمة صافي الفاتورة',
          chart: p.by === 'sup' ? null : { type: 'hbar', x: 'name', y: ['val'], yl: ['القيمة'] } }, p);
      } };

    /* ===================== التحصيل حسب طريقة القبض: نقدي / بنوك / مقاصة ===================== */
    // سطر لكل حساب مدين في كل سند تحصيل من العملاء، والمبلغ موزّع بنسبته (نفس قواعد collections وcollSplit)
    function collLines(from, to, recvList, onlyExcl) {
      // onlyExcl: الحركات التي كانت ستُحسب لولا الحسابات المستبعدة (للمراجعة)؛ 'raw': كل التحصيل دون أي استبعاد
      var bx = boxIds(''), bset = {}, rset = collRset(recvList), out = [], ex = onlyExcl === 'raw' ? null : collExcl();
      bx.forEach(function (x) { bset[x] = 1; });
      entriesIn(from, to).forEach(function (l0) {
        var ls = F.D.byEntry[l0.e], dB = 0, cR = 0, deb = [], cus = {}, sk = collExSkip(ex, ls, l0.bt);
        if (onlyExcl === true && !sk) return;
        var dB2 = 0, cR2 = 0;   // مع الاستبعاد (لمعرفة الفرق الذي يحدثه فعلاً)
        ls.forEach(function (l) {
          var skip = sk && sk[l.a];
          if (skip && onlyExcl !== true) return;
          if ((bx.length ? bset[l.a] : (l0.k === 'r' && l.dr)) && l.dr) { dB += l.dr; deb.push(l); if (!skip) dB2 += l.dr; }
          if (l.cr && rOk(rset[l.a], l0.bt)) { cR += l.cr; cus[l.a] = (cus[l.a] || 0) + l.cr; if (!skip) cR2 += l.cr; }
        });
        var amt = Math.min(dB, cR);
        if (onlyExcl === true) amt = amt - Math.max(0, Math.min(dB2, cR2));   // المستبعد = ما نقص من التحصيل بسبب الاستبعاد فقط
        if (amt <= 0.0005 || dB <= 0) return;
        var cl = Object.keys(cus).sort(function (a, b) { return cus[b] - cus[a]; });
        deb.forEach(function (l) {
          var k = cashBankKind(l.a);
          out.push({ e: l0.e, d: l0.d, dt: l0.dt, no: l0.no, bt: l0.bt, btn: l0.btn || '', ed: l0.ed || '', u: l0.u, ag: l0.ag, accs: ls.map(function (q) { return q.a; }), exa: sk ? Object.keys(sk).map(function (k) { return sk[k]; }) : [], acc: l.a, kind: k === 'بنك' ? 'بنوك' : k === 'صندوق' ? 'نقدي' : 'مقاصة', amt: amt * l.dr / dB, cust: cl, cmain: cl[0], cus: cus, cR: cR });
        });
      });
      return out;
    }
    R.coll_offset = { cat: 'debts', name: 'التحصيل حسب طريقة القبض (نقدي · بنوك · مقاصة)', desc: 'سندات التحصيل من العملاء مصنّفة حسب الحساب الذي دخل فيه المبلغ: صندوق (نقدي) أو مصرف (بنوك) أو حساب آخر (مقاصة: تسوية دين العميل مقابل حساب آخر دون نقد). حركات المقاصة تفصيلياً، أو كل التحصيل، أو ملخصاً حسب الحساب المقابل أو العميل',
      params: ['period', 'flt'], fdims: ['cust', 'xcust'],
      sel: [['view', 'العرض', [['oth', 'حركات المقاصة (تفصيلي)'], ['all', 'كل التحصيل (تفصيلي)'], ['acc', 'ملخص حسب الحساب المقابل'], ['cust', 'ملخص حسب العميل'], ['excl', 'الحركات المستبعدة من التحصيل']]]],
      run: function (p) {
        var f = parseFilter(p.flt), view = p.view || 'oth';
        if (view === 'excl') return collExclReport(p, f);
        var L = collLines(p.from, p.to, f ? recvFor(f) : null);
        if (!L.length) return emptyR('لا يوجد تحصيل من العملاء في الفترة');
        var tot = { 'نقدي': 0, 'بنوك': 0, 'مقاصة': 0 }, all = 0, offE = {}, offAcc = {}, offCus = {};
        L.forEach(function (x) { tot[x.kind] += x.amt; all += x.amt; if (x.kind === 'مقاصة') { offE[x.e] = 1; offAcc[x.acc] = 1; x.cust.forEach(function (c) { offCus[c] = 1; }); } });
        var kpis = [
          { l: 'المقاصة', v: tot['مقاصة'], t: 'money', s: Object.keys(offE).length + ' سند · ' + pct(tot['مقاصة'], all).toFixed(1) + '% من التحصيل', bad: tot['مقاصة'] > 0.5 },
          { l: 'نقدي (الصناديق)', v: tot['نقدي'], t: 'money', s: pct(tot['نقدي'], all).toFixed(1) + '% من التحصيل' },
          { l: 'بنوك (المصارف)', v: tot['بنوك'], t: 'money', s: pct(tot['بنوك'], all).toFixed(1) + '% من التحصيل' },
          { l: 'إجمالي التحصيل', v: all, t: 'money', s: 'كما في بطاقة التحصيل' },
          { l: 'الحسابات المقابلة في المقاصة', v: Object.keys(offAcc).length, t: 'int', s: Object.keys(offCus).length + ' عميل' }
        ];
        var note = 'المقاصة = سند قبض خُصم من حساب العميل وحُمِّل المبلغ على حساب آخر غير الصناديق والمصارف (مثل حساب فرع أو مورد أو عميل آخر)، أي تسوية لدين العميل دون دخول نقد · نوع الحساب من تعريف الصناديق والبنوك في الإعدادات، وإلا من اسمه والحسابات فوقه · السند الذي فيه أكثر من حساب مدين يُوزّع مبلغه بنسبتها';
        var cname = function (ids) { return ids.map(function (a) { return accName(a); }).join('\n'); };
        var acode = function (a) { var x = acc(a); return x ? x.code + ' · ' + x.name : a; };
        var rows, cols, title, total;
        if (view === 'oth' || view === 'all') {
          var list = L.filter(function (x) { return view === 'all' || x.kind === 'مقاصة'; });
          if (!list.length) return Object.assign(emptyR('لا توجد حركات مقاصة في الفترة: كل التحصيل نقدي أو بنكي'), { kpis: kpis });
          // تجميع تحت الحساب المقابل (المقاصة) أو تحت طريقة القبض (الكل)
          var gk = view === 'oth' ? function (x) { return x.acc; } : function (x) { return x.kind; };
          var gn = view === 'oth' ? function (x) { return acode(x.acc); } : function (x) { return x.kind; };
          var G = {}; list.forEach(function (x) { var k = gk(x), g = G[k] || (G[k] = { name: gn(x), l: [], amt: 0 }); g.l.push(x); g.amt += x.amt; });
          var ord = view === 'all' ? ['نقدي', 'بنوك', 'مقاصة'] : Object.keys(G).sort(function (a, b) { return G[b].amt - G[a].amt; });
          rows = [];
          ord.filter(function (k) { return G[k]; }).forEach(function (k, gi) {
            var g = G[k], ne = {}; g.l.forEach(function (x) { ne[x.e] = 1; });
            rows.push({ _g: gi, _gh: 1, _b: true, name: g.name + ' (' + Object.keys(ne).length + ' سند)', amt: g.amt, share: pct(g.amt, view === 'oth' ? tot['مقاصة'] : all) });
            g.l.sort(function (a, b) { return a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : 0; }).forEach(function (x) {
              rows.push({ _g: gi, _lvl: 1, name: cname(x.cust), d: x.d, no: x.no, btn: x.btn, kind: x.kind, cacc: acode(x.acc), amt: x.amt, ed: x.ed });
            });
          });
          var lt = list.reduce(function (s, x) { return s + x.amt; }, 0);
          total = { name: 'الإجمالي', _b: true, amt: lt, share: 100 };
          cols = [C('name', view === 'oth' ? 'الحساب المقابل / العميل' : 'طريقة القبض / العميل', 'long'), C('d', 'التاريخ'), C('no', 'رقم السند'), C('btn', 'نوع السند')];
          if (view === 'all') cols.push(C('cacc', 'الحساب المدين', 'long'));
          cols = cols.concat([C('amt', 'المبلغ', 'money'), C('share', 'من المجموعة %', 'pct'), C('ed', 'البيان', 'long')]);
          title = view === 'oth' ? 'حركات المقاصة في التحصيل' : 'التحصيل حسب طريقة القبض';
          return withNote({ title: title, kpis: kpis, rows: rows, total: total, cols: cols, note: note, _grouped: true, _noCust: true }, p);
        }
        // الملخصات
        var S = {};
        L.forEach(function (x) {
          var keys = view === 'acc' ? [x.kind === 'مقاصة' ? x.acc : x.kind] : [x.cmain];
          keys.forEach(function (k) { var r = S[k] || (S[k] = { k: k, name: view === 'acc' ? (x.kind === 'مقاصة' ? acode(x.acc) : 'كل ' + (x.kind === 'نقدي' ? 'الصناديق' : 'المصارف')) : accName(k), kind: view === 'acc' ? x.kind : '', e: {}, cash: 0, bank: 0, off: 0, amt: 0, last: '' }); r.e[x.e] = 1; r.amt += x.amt; if (x.kind === 'نقدي') r.cash += x.amt; else if (x.kind === 'بنوك') r.bank += x.amt; else r.off += x.amt; if (x.d > r.last) r.last = x.d; });
        });
        rows = Object.keys(S).map(function (k) { var r = S[k]; return { name: r.name, kind: r.kind, n: Object.keys(r.e).length, cash: r.cash, bank: r.bank, off: r.off, amt: r.amt, op: pct(r.off, r.amt), share: pct(r.amt, all), last: r.last }; });
        if (view === 'cust') rows = rows.filter(function (r) { return r.off > 0.005 || !p._onlyOff; });
        rows.sort(function (a, b) { return view === 'acc' ? (a.kind === 'مقاصة') - (b.kind === 'مقاصة') || b.amt - a.amt : b.off - a.off || b.amt - a.amt; });
        total = sumRow(rows, [C('n', '', 'int'), C('cash', '', 'money'), C('bank', '', 'money'), C('off', '', 'money'), C('amt', '', 'money')]); total.op = pct(total.off, total.amt); total.share = 100;
        cols = view === 'acc'
          ? [C('name', 'الحساب المقابل'), C('kind', 'الطريقة'), C('n', 'عدد السندات', 'int'), C('amt', 'المبلغ', 'money'), C('share', 'من التحصيل %', 'pct'), C('last', 'آخر حركة')]
          : [C('name', 'العميل'), C('n', 'عدد السندات', 'int'), C('cash', 'نقدي', 'money'), C('bank', 'بنوك', 'money'), C('off', 'مقاصة', 'money'), C('amt', 'إجمالي التحصيل', 'money'), C('op', 'المقاصة %', 'pct'), C('last', 'آخر تحصيل')];
        return withNote({ title: view === 'acc' ? 'التحصيل حسب الحساب المقابل' : 'التحصيل حسب العميل وطريقة القبض', kpis: kpis, rows: rows, total: total, cols: cols, note: note, _noCust: view === 'acc',
          chart: view === 'acc' ? { type: 'hbar', x: 'name', y: ['amt'], yl: ['المبلغ'], limit: 12 } : null }, p);
      } };

    // ---------- كشف التحصيلات التفصيلي: سطر لكل سند تحصيل ----------
    var CD_GRP = [['none', 'بدون تجميع (حسب التاريخ)'], ['day', 'اليوم'], ['month', 'الشهر'], ['box', 'الصندوق / المصرف'], ['kind', 'طريقة القبض'], ['cust', 'العميل'], ['rep', 'المندوب'], ['user', 'المستخدم'], ['btn', 'نوع السند']];
    R.coll_detail = { cat: 'debts', name: 'كشف التحصيلات التفصيلي', desc: 'كل سند تحصيل: التاريخ والوقت ورقم السند ونوعه والعميل والصندوق أو المصرف وطريقة القبض والمبلغ والمندوب والمستخدم والبيان، مع التجميع والمجاميع الفرعية أو ملخص بالمجموعات',
      params: ['period', 'flt', 'search'], fdims: ['cust', 'xcust', 'ag'],
      sel: [['grp', 'التجميع', CD_GRP], ['view', 'العرض', [['det', 'تفصيلي (كل سند)'], ['sum', 'ملخص بالمجموعات']]], ['meth', 'طريقة القبض', [['all', 'الكل'], ['نقدي', 'نقدي (الصناديق)'], ['بنوك', 'بنوك (المصارف)'], ['مقاصة', 'مقاصة']]]],
      run: function (p) {
        var f = parseFilter(p.flt), grp = p.grp || 'none', view = p.view || 'det', meth = p.meth || 'all', s = String(p.search || '').trim();
        var L = collLines(p.from, p.to, f ? recvFor(f) : null);
        if (!L.length) return emptyR('لا يوجد تحصيل في الفترة');
        var acode = function (a) { var x = acc(a); return x ? x.name + ' (' + x.code + ')' : a; };
        // دمج أسطر السند الواحد (أكثر من حساب مدين) في سطر واحد
        var E = {}, order = [];
        L.forEach(function (x) {
          if (meth !== 'all' && x.kind !== meth) return;
          var r = E[x.e];
          if (!r) { r = E[x.e] = { e: x.e, d: x.d, dt: x.dt || x.d, no: x.no, btn: x.btn, ed: x.ed, cust: x.cust, cmain: x.cmain, u: x.u, boxes: {}, kinds: {}, amt: 0,
            rep: F.D.repOfCust[x.cmain] || (x.ag && x.ag !== '0' ? x.ag : '0') }; order.push(r); }
          r.amt += x.amt; r.boxes[x.acc] = (r.boxes[x.acc] || 0) + x.amt; r.kinds[x.kind] = (r.kinds[x.kind] || 0) + x.amt;
        });
        var list = order.map(function (r) {
          var bk = Object.keys(r.boxes).sort(function (a, b) { return r.boxes[b] - r.boxes[a]; }), kk = Object.keys(r.kinds);
          r.box = bk[0]; r.boxTxt = bk.map(function (a) { return accName(a); }).join('\n');
          r.kind = kk.length === 1 ? kk[0] : 'مختلط'; r.cash = r.kinds['نقدي'] || 0; r.bank = r.kinds['بنوك'] || 0; r.off = r.kinds['مقاصة'] || 0;
          r.custTxt = r.cust.map(acode).join('\n'); r.repTxt = r.rep && r.rep !== '0' ? repName(r.rep) : 'بدون مندوب'; r.userTxt = r.u ? userName(r.u) : '';
          return r;
        }).filter(function (r) { return !s || (r.no + ' ' + r.custTxt + ' ' + r.boxTxt + ' ' + (r.ed || '') + ' ' + r.repTxt + ' ' + r.userTxt).indexOf(s) >= 0; });
        if (!list.length) return emptyR('لا توجد سندات تحصيل تطابق الاختيار');
        list.sort(function (a, b) { return a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : 0; });
        // المؤشرات
        var tot = 0, cash = 0, bank = 0, off = 0, cu = {}, days = {}, big = list[0];
        list.forEach(function (r) { tot += r.amt; cash += r.cash; bank += r.bank; off += r.off; r.cust.forEach(function (c) { cu[c] = 1; }); days[r.d] = 1; if (r.amt > big.amt) big = r; });
        var nd = Object.keys(days).length;
        var kpis = [
          { l: 'إجمالي التحصيل', v: tot, t: 'money', s: list.length + ' سند · ' + Object.keys(cu).length + ' عميل' },
          { l: 'نقدي (الصناديق)', v: cash, t: 'money', s: pct(cash, tot).toFixed(1) + '%' },
          { l: 'بنوك (المصارف)', v: bank, t: 'money', s: pct(bank, tot).toFixed(1) + '%' + (off > 0.005 ? ' · مقاصة ' + fm(off) : '') },
          { l: 'متوسط السند', v: tot / list.length, t: 'money', s: 'متوسط اليوم ' + fm(tot / (nd || 1)) + ' (' + nd + ' يوم)' },
          { l: 'أكبر سند', v: big.amt, t: 'money', s: big.btn + ' ' + big.no + ' · ' + accName(big.cmain) }
        ];
        var note = 'التحصيل = المبلغ الذي دخل صندوقاً أو مصرفاً معرّفاً مقابل حساب عميل (أو حساب تحصيل إضافي من الإعدادات)، بعد الحسابات المستبعدة — نفس رقم بطاقة التحصيل · السند الذي فيه أكثر من صندوق أو مصرف يظهر مرة واحدة بمجموعه · المندوب من آخر فاتورة للعميل أو تعريفه';
        var MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
        var GK = {
          none: null,
          day: function (r) { return [r.d, r.d]; },
          month: function (r) { var m = r.d.slice(0, 7); return [m, MON[Number(m.slice(5)) - 1] + ' ' + m.slice(0, 4)]; },
          box: function (r) { return [r.box, acode(r.box)]; },
          kind: function (r) { return [r.kind, r.kind]; },
          cust: function (r) { return [r.cmain, acode(r.cmain)]; },
          rep: function (r) { return [r.rep || '0', r.repTxt]; },
          user: function (r) { return [r.u || '', r.userTxt || 'غير معروف']; },
          btn: function (r) { return [r.btn, r.btn || 'غير محدد']; }
        }[grp];
        var detCols = [C('d', 'التاريخ'), C('tm', 'الوقت'), C('no', 'رقم السند'), C('btn', 'نوع السند'), C('cust', 'العميل', 'long'), C('box', 'الصندوق / المصرف', 'long'), C('kind', 'الطريقة'), C('amt', 'المبلغ', 'money'), C('rep', 'المندوب'), C('user', 'المستخدم'), C('ed', 'البيان', 'long')];
        var drop = { box: 'box', kind: 'kind', rep: 'rep', user: 'user', btn: 'btn' }[grp];
        if (drop) detCols = detCols.filter(function (c) { return c.k !== drop; });
        var detRow = function (r, gi) { return { _g: gi, _lvl: gi === undefined ? 0 : 1, d: r.d, tm: String(r.dt || '').slice(11, 16), no: r.no, btn: r.btn, cust: r.custTxt, box: r.boxTxt, kind: r.kind, amt: r.amt, rep: r.repTxt, user: r.userTxt, ed: r.ed }; };
        var title = 'كشف التحصيلات التفصيلي' + (meth !== 'all' ? ' — ' + meth : '');
        if (!GK) return withNote({ title: title, kpis: kpis, rows: list.map(function (r) { return detRow(r); }), cols: detCols, total: { name: 'الإجمالي', _b: true, d: 'الإجمالي', amt: tot }, note: note, _noCust: true }, p);
        var G = {}, gord = [];
        list.forEach(function (r) { var k = GK(r), g = G[k[0]]; if (!g) { g = G[k[0]] = { k: k[0], name: k[1], l: [], amt: 0, cash: 0, bank: 0, off: 0, cu: {}, last: '' }; gord.push(g); } g.l.push(r); g.amt += r.amt; g.cash += r.cash; g.bank += r.bank; g.off += r.off; r.cust.forEach(function (c) { g.cu[c] = 1; }); if (r.d > g.last) g.last = r.d; });
        if (grp !== 'day' && grp !== 'month') gord.sort(function (a, b) { return b.amt - a.amt; });
        var gl = CD_GRP.filter(function (x) { return x[0] === grp; })[0][1];
        if (view === 'sum') {
          var rows = gord.map(function (g) { return { name: g.name, n: g.l.length, nc: Object.keys(g.cu).length, cash: g.cash, bank: g.bank, off: g.off, amt: g.amt, share: pct(g.amt, tot), avg: g.amt / g.l.length, last: g.last }; });
          var cols = [C('name', gl, 'long'), C('n', 'عدد السندات', 'int'), C('nc', 'العملاء', 'int'), C('cash', 'نقدي', 'money'), C('bank', 'بنوك', 'money')];
          if (off > 0.005) cols.push(C('off', 'مقاصة', 'money'));
          cols = cols.concat([C('amt', 'الإجمالي', 'money'), C('share', 'من التحصيل %', 'pct'), C('avg', 'متوسط السند', 'money'), C('last', 'آخر تحصيل')]);
          var total = sumRow(rows, cols); total.share = 100; total.avg = tot / list.length; total.nc = Object.keys(cu).length;
          return withNote({ title: title + ' — ملخص حسب ' + gl, kpis: kpis, rows: rows, cols: cols, total: total, note: note, _noCust: true,
            chart: grp === 'day' || grp === 'month' ? { type: 'bar', x: 'name', y: ['cash', 'bank'], yl: ['نقدي', 'بنوك'] } : { type: 'hbar', x: 'name', y: ['amt'], yl: ['التحصيل'], limit: 12 } }, p);
        }
        var rows2 = [];
        gord.forEach(function (g, gi) {
          rows2.push({ _g: gi, _gh: 1, _b: true, d: g.name + ' — ' + g.l.length + ' سند', cust: Object.keys(g.cu).length + ' عميل · ' + pct(g.amt, tot).toFixed(1) + '% من التحصيل', amt: g.amt });
          g.l.forEach(function (r) { rows2.push(detRow(r, gi)); });
        });
        return withNote({ title: title + ' — حسب ' + gl, kpis: kpis, rows: rows2, cols: detCols, total: { name: 'الإجمالي', _b: true, d: 'الإجمالي', amt: tot }, note: note, _grouped: true, _noCust: true }, p);
      } };

    // الحركات المستبعدة من التحصيل بسبب الحسابات المحددة في الإعدادات
    function collExclReport(p, f) {
      var lst = collExclList();
      if (!lst.length) return emptyR('لم تُحدَّد حسابات مستبعدة من التحصيل. حدّدها من الإعدادات ← الصناديق والبنوك ← «حسابات لا تُحسب حركاتها في التحصيل»');
      var L = collLines(p.from, p.to, f ? recvFor(f) : null, true);
      if (!L.length) return emptyR('لا توجد حركات مستبعدة في الفترة');
      var acode = function (a) { var x = acc(a); return x ? x.code + ' · ' + x.name + (multiBr() ? ' — ' + brName(x.br || '') : '') : a; };
      var G = {}, tot = 0;
      L.forEach(function (x) { var k = x.exa[0] || x.cmain, g = G[k] || (G[k] = { name: acode(k), l: [], amt: 0 }); g.l.push(x); g.amt += x.amt; tot += x.amt; });
      var rows = [];
      Object.keys(G).sort(function (a, b) { return G[b].amt - G[a].amt; }).forEach(function (k, gi) {
        var g = G[k], ne = {}; g.l.forEach(function (x) { ne[x.e] = 1; });
        rows.push({ _g: gi, _gh: 1, _b: true, name: g.name + ' (' + Object.keys(ne).length + ' سند)', amt: g.amt, share: pct(g.amt, tot) });
        g.l.sort(function (a, b) { return a.dt < b.dt ? -1 : 1; }).forEach(function (x) { rows.push({ _g: gi, _lvl: 1, name: x.cust.map(function (a) { return accName(a); }).join('\n'), d: x.d, no: x.no, btn: x.btn, cacc: acode(x.acc), amt: x.amt, ed: x.ed }); });
      });
      var nE = {}; L.forEach(function (x) { nE[x.e] = 1; });
      return withNote({ title: 'الحركات المستبعدة من التحصيل', _grouped: true, _noCust: true, rows: rows, total: { name: 'الإجمالي', _b: true, amt: tot, share: 100 },
        kpis: [{ l: 'المستبعد من التحصيل', v: tot, t: 'money', s: Object.keys(nE).length + ' سند في الفترة' }, { l: 'التحصيل المحسوب', v: collections(p.from, p.to, '', false, f ? recvFor(f) : null), t: 'money', s: 'بعد الاستبعاد' }, { l: 'الحسابات المستبعدة', v: lst.length, t: 'int', s: 'من الإعدادات' }],
        cols: [C('name', 'الحساب المستبعد / العميل', 'long'), C('d', 'التاريخ'), C('no', 'رقم السند'), C('btn', 'نوع السند'), C('cacc', 'الحساب المدين', 'long'), C('amt', 'المبلغ', 'money'), C('share', 'من المستبعد %', 'pct'), C('ed', 'البيان', 'long')],
        note: 'سندات كانت ستُحسب تحصيلاً لولا أن أحد حساباتها من الحسابات المستبعدة ونوعها من الأنواع المحددة لذلك الحساب — مثل الحسابات بين الإدارة والفروع حتى لا يُحسب نفس المبلغ مرتين' }, p);
    }

    // عند الخروج: تُنسى البيانات من الذاكرة ويُنسى المفتاح؛ النسخة المشفّرة تبقى على الجهاز لفتح فوري عند الدخول التالي
    A.paintSync = paintSync; A.navSnap = navSnap; A.navApply = navApply;
    A.openSec = function () { F.setTab = 'sec'; F.sec = null; A.go('settings'); };
    A.onLogout(function () { F.sec = null; F.setTab = null; var pk = Object.keys((F.pks && F.pks.list) || {}); F.packs = {}; F.pks = null; F.rows = null; F.D = null; F.Dby = null; F.Dcache = null; F.br = undefined; F.rev = 0; F.meta = null; F.cur = null; F.edit = null; F.dirtyKeys = null; F.dirty = false; ckForget(); return Promise.resolve(); });
    try { st.finParams = JSON.parse(localStorage.getItem('rk.finParams') || '{}'); } catch (e) { st.finParams = {}; }

    // للاختبارات: الوصول للمحرّك
    window.__rkfin = { F: F, R: R, custTreeAccs: custTreeAccs, iclTree: iclTree, resetCache: resetCache, cgOf: cgOf, runCustom: runCustom, runPair: runPair, runFree: runFree, applyView: applyView, CATS: CATS, repCat: repCat, repCollections: repCollections, SRC: SRC, normAr: normAr, build: rebuild, buildOne: build, useBr: useBr, setBr: setBr, withBr: withBr, branches: branches, recvIds: recvIds, runCur: runCur, balance: balance, salesStats: salesStats, evalFormula: evalFormula, tryFormula: tryFormula, evalList: evalList,
      stockTotals: stockTotals, collections: collections, collSplit: collSplit, termsToF: termsToF, fToTerms: fToTerms, itemText: function (x) { return itemText(x); }, fltOptions: function (d) { return fltOptions(d); }, dailyData: function () { return dailyData(); }, cards: cards, dailyDef: dailyDef, T: T, evalList: evalList, costAt: costAt, hasPrevYear: hasPrevYear, repKeys: repKeys, prevRange: prevRange, stockAt: stockAt, itemName: itemName, balance: balance };
  };
})();
