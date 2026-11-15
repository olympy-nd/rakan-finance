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
    function fp(n) { return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 1 }) + '%'; }
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

    /* ===================== تحميل البيانات ===================== */
    /* ===================== تحميل البيانات =====================
     * الحزم: بيانات كل شهر (لكل قاعدة) ملف مضغوط واحد، تُنزَّل الحزمة فقط إذا تغيّر إصدارها،
     * وتُحفظ على الجهاز كما هي. فوقها «سجل التغييرات» (F.rows): ما وصل بعد آخر اعتماد للحزم. */
    function readCache() {
      return Promise.all([S.get('fin:rows'), S.get('fin:rev'), S.get('fin:meta'), S.get('fin:aux'), S.get('fin:pks')]).then(function (v) {
        F.rows = v[0] || {}; F.rev = v[1] || 0; F.meta = v[2] || null;
        if (v[3]) { F.boxes = v[3].boxes || []; F.reports = v[3].reports || []; F.config = v[3].config || {}; }
        F.pks = v[4] || { gen: '', base: 0, list: {} };
        F.packs = {};
        var names = Object.keys(F.pks.list || {});
        return Promise.all(names.map(function (n) { return S.get('fin:pk:' + n); })).then(function (arr) {
          arr.forEach(function (x, i) {
            if (!x || x.ver !== F.pks.list[names[i]]) { delete F.pks.list[names[i]]; return; }
            try { F.packs[names[i]] = JSON.parse(x.s); } catch (e) { delete F.pks.list[names[i]]; }
          });
          if (hasData()) rebuild();
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
      F.loading = (fresh ? readCache().then(function () {
        // الفتح الفوري: نعرض آخر بيانات محفوظة الآن، والتحديث يكمل في الخلفية
        if (F.D) setTimeout(function () { if (A.render) A.render(); }, 0);
      }) : Promise.resolve()).then(function () {
        if (!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت');
        return sync(force).then(function () { return Promise.all([call('fin_boxes'), call('fin_reports'), call('fin_config').catch(function () { return { config: F.config }; })]); }).then(function (r) {
          F.boxes = r[0].boxes; F.reports = r[1].reports; F.config = r[2].config || {}; F.error = null; F.lastPull = Date.now();
          return S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config });
        });
      }).catch(function (e) {
        if (!F.D) { F.error = e.message; throw e; }
        if (!F.quiet) toast('تعذّر تحديث البيانات المالية (' + e.message + ')، تُعرض آخر بيانات محفوظة', true);
      }).finally(function () { F.loading = null; F.progress = ''; });
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
            return gunzipText(r.data).then(function (txt) {
              F.packs[p.name] = JSON.parse(txt); F.pks.list[p.name] = r.ver; changed = true; done++;
              F.progress = 'جارٍ تنزيل البيانات المالية… ' + done + ' من ' + total; paintProgress();
              return S.set('fin:pk:' + p.name, { ver: r.ver, s: txt });
            });
          }).then(one);
        };
        if (total) { F.progress = 'جارٍ تنزيل البيانات المالية… 0 من ' + total; paintProgress(); }
        return Promise.all([one(), one(), one()]).then(function () {
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

    function paintProgress() { var el = q('#finprog'); if (el) el.textContent = F.progress; }

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
      var T = { acc: {}, bt: {}, it: {}, cu: {}, ag: {}, us: {}, st: {}, item: {}, jl: [], inv: {}, invl: [] };
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
      'بدون_مخزن': 'xst', xst: 'xst', 'نوع': 'type', type: 'type', 'فئة': 'cat', 'فئة_المندوب': 'cat', cat: 'cat', 'بدون_فئة': 'xcat', xcat: 'xcat' };
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
      if (!f || !((f.cust && f.cust.length) || (f.xcust && f.xcust.length))) return ids;
      return ids.filter(function (id) {
        var a = acc(id), nm = a ? a.name : '', cd = a ? a.code : '';
        if (f.cust && f.cust.length && !matchAny(f.cust, id, nm, cd)) return false;
        if (f.xcust && f.xcust.length && matchAny(f.xcust, id, nm, cd)) return false;
        return true;
      });
    }
    function recvFor(flt) { return partyFilter(recvIds(), flt); }
    function hasCustF(flt) { var f = parseFilter(flt); return !!(f && ((f.cust && f.cust.length) || (f.xcust && f.xcust.length))); }
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
      if (f.ag && f.ag.length && !matchAny(f.ag, v.ag, (T().ag[v.ag] || {}).name)) return false;
      if (f.cat && f.cat.length && f.cat.map(function (x) { return String(x).replace(/^@/, ''); }).indexOf(repCat(v.ag)) < 0) return false;
      if (f.xcat && f.xcat.length && f.xcat.map(function (x) { return String(x).replace(/^@/, ''); }).indexOf(repCat(v.ag)) >= 0) return false;
      if (f.u && f.u.length && !matchAny(f.u, v.u, (T().us[v.u] || {}).name)) return false;
      if (f.type && f.type.length && !matchAny(f.type, v.t, (T().it[v.t] || {}).name)) return false;
      return true;
    }
    function linePass(l, f) {
      if (!f) return true;
      if (f.item && f.item.length && !itemMatch(f.item, l)) return false;
      if (f.xitem && f.xitem.length && itemMatch(f.xitem, l)) return false;
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
    function collections(from, to, kind, perCust, recvList) {
      var bx = boxIds(kind), recv = recvList || recvIds(), bset = {}, rset = {}, tot = 0, by = {};
      if (!bx.length && kind) return perCust ? {} : 0;
      bx.forEach(function (x) { bset[x] = 1; }); recv.forEach(function (x) { rset[x] = 1; });
      entriesIn(from, to).forEach(function (l0) {
        var ls = F.D.byEntry[l0.e], dB = 0, cR = 0, cr = {};
        ls.forEach(function (l) { if (bx.length ? bset[l.a] : (l0.k === 'r' && l.dr)) dB += l.dr; if (rset[l.a] && l.cr) { cR += l.cr; cr[l.a] = (cr[l.a] || 0) + l.cr; } });
        var amt = Math.min(dB, cR);
        if (amt <= 0) return;
        tot += amt;
        if (perCust === 'day') by[l0.d] = (by[l0.d] || 0) + amt;
        else if (perCust) Object.keys(cr).forEach(function (a) { by[a] = (by[a] || 0) + amt * cr[a] / cR; });
      });
      return perCust ? by : tot;
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
    fn('مخزون_كمية', 'STOCKQ', '"المخازن" ، "تصفية"', 'كمية المخزون في نهاية الفترة بالوحدة الشائعة. بدون مخزن: كل المخازن.', function (c, a) { return stockTotals(c.to, splitList(a[0]), mergeF(a[1], c.flt, ['item', 'xitem', 'st'])).qty; }, G_STK);
    fn('مخزون_قيمة', 'STOCKV', '"المخازن" ، "تصفية"', 'قيمة المخزون بمتوسط التكلفة في نهاية الفترة.', function (c, a) { return stockTotals(c.to, splitList(a[0]), mergeF(a[1], c.flt, ['item', 'xitem', 'st'])).val; }, G_STK);
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
    var FKEY_AR = { cust: 'عميل', item: 'صنف', st: 'مخزن', xcust: 'بدون_عميل', xitem: 'بدون_صنف', ag: 'مندوب' };
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
    function repName(id) { return (T().ag[id] || {}).name || 'بدون مندوب'; }
    function userName(id) { return (T().us[id] || {}).name || 'غير معروف'; }
    function noteF(p) { var f = parseFilter(p.flt); if (!f) return ''; var parts = []; Object.keys(f).forEach(function (k) { if (f[k] && f[k].length) parts.push(FLT_LABEL[k] + ': ' + f[k].map(function (x) { return fltName(k, x); }).join('، ')); }); return parts.length ? 'التصفية: ' + parts.join(' · ') : ''; }
    var FLT_LABEL = { cust: 'العميل', item: 'الصنف', st: 'المخزن', ag: 'المندوب', u: 'المستخدم', xcust: 'بدون العميل', xitem: 'بدون الصنف', xst: 'بدون المخزن', type: 'النوع' };
    function fltName(k, x) { x = String(x).replace(/^@/, ''); return k === 'cust' || k === 'xcust' ? (acc(x) ? acc(x).name : x) : k === 'item' || k === 'xitem' ? (T().item[x] ? itemName(x) : x) : k === 'st' || k === 'xst' ? (T().st[x] ? storeName(x) : x) : k === 'ag' ? (T().ag[x] ? repName(x) : x) : k === 'u' ? (T().us[x] ? userName(x) : x) : x; }
    function hasItemF(flt) { var f = parseFilter(flt); return !!(f && ((f.item && f.item.length) || (f.xitem && f.xitem.length) || (f.st && f.st.length))); }
    function custKeys(flt) { if (!hasCustF(flt)) return null; var ok = {}, f = parseFilter(flt); F.D.invs.forEach(function (v) { if ((v.c === SALE || v.c === SRET) && invPass(v, { cust: f.cust, xcust: f.xcust })) ok[v.ck] = 1; }); return ok; }
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
        var d2 = p.asof2 || addD(p.asof.slice(0, 4) + '-01-01', -1), depth = Number(p.level || 2);
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
    function statement(ids, p, title) {
      var all = [];
      ids.forEach(function (id) { (F.D.byAcc[id] || []).forEach(function (l) { if (l.d >= p.from && l.d <= p.to) all.push(l); }); });
      all.sort(cmpLine);
      var b = balance(ids, p.from, p.to), bal = b.open;
      var rows = [{ d: '', no: '', type: '', desc: 'رصيد أول المدة', cp: '', dr: '', cr: '', bal: b.open, _b: true }];
      all.forEach(function (l) {
        bal += l.dr - l.cr;
        rows.push({ d: l.d, no: l.no, type: l.btn, desc: l.ld || l.ed || '', cp: counterpart(l, ids), dr: l.dr || '', cr: l.cr || '', bal: bal, _acc: ids.length > 1 ? l.a : null });
      });
      return { title: title, cols: [C('d', 'التاريخ'), C('no', 'رقم القيد'), C('type', 'النوع'), C('desc', 'البيان'), C('cp', 'الحساب المقابل'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money'), C('bal', 'الرصيد', 'money')],
        rows: rows, total: { desc: 'الإجمالي ورصيد آخر المدة', dr: b.dr, cr: b.cr, bal: b.close } };
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
    R.ledger = { cat: 'acct', name: 'دفتر الأستاذ', desc: 'القيود على حساب رئيسي وكل فروعه مع اسم الحساب الفرعي', params: ['period', 'account'],
      run: function (p) {
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
    R.trial_bal = { cat: 'acct', name: 'ميزان المراجعة بالأرصدة', desc: 'الرصيد المدين أو الدائن لكل حساب في تاريخ محدد', params: ['asof', 'level'],
      run: function (p) {
        var rows = trialRows({ from: null, to: p.asof }, Number(p.level || 4)).map(function (r) { return { code: r.code, name: r.name, cdr: r.cdr, ccr: r.ccr, _acc: r._acc }; }).filter(function (r) { return r.cdr || r.ccr; });
        var cols = [C('code', 'الرمز'), C('name', 'الحساب'), C('cdr', 'مدين', 'money'), C('ccr', 'دائن', 'money')];
        return { cols: cols, rows: rows, total: sumRow(rows, cols) };
      } };
    R.coa = { cat: 'acct', name: 'دليل الحسابات بالأرصدة', desc: 'شجرة الحسابات كاملة مع رصيد كل حساب', params: ['asof', 'level'],
      run: function (p) {
        var lvl = Number(p.level || 6), rows = [];
        F.D.accList.forEach(function (a) { if (a.lvl > lvl) return; var b = balance(descend(a.id), null, p.asof); rows.push({ code: a.code, name: a.name, lvl: a.lvl, kind: a.leaf ? 'فرعي' : 'رئيسي', bal: b.close, _lvl: a.lvl - 1, _b: a.lvl === 1, _acc: a.id }); });
        return { cols: [C('code', 'الرمز'), C('name', 'الحساب'), C('kind', 'النوع'), C('bal', 'الرصيد (مدين +)', 'money')], rows: rows };
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
        var b = balance([id], null, p.asof), v = sign * b.close;
        if (p.nonzero !== 'all' && Math.abs(v) < 0.0005) return;
        var lim = sign > 0 ? custLimit(id) : 0;
        rows.push({ code: acc(id).code, name: accName(id), v: v, last: lastMove(id, p.asof), lastCr: sign > 0 ? lastCredit(id, p.asof) : '', lim: lim || '', over: lim && v > lim ? 'تجاوز الحد' : '', _acc: id });
      });
      rows.sort(function (a, b) { return b.v - a.v; });
      var cols = [C('code', 'الرمز'), C('name', label), C('v', 'الرصيد', 'money'), C('last', 'آخر حركة')];
      if (sign > 0) cols.push(C('lastCr', 'آخر تحصيل'), C('lim', 'حد الائتمان', 'money'), C('over', 'تنبيه'));
      return { cols: cols, rows: rows, total: sumRow(rows, [C('v', '', 'money')]), chart: { type: 'hbar', x: 'name', y: ['v'], yl: ['الرصيد'], limit: 12 }, note: 'مجموعة الحسابات تُضبط من «الصناديق والإعدادات»' };
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
        if (p.box && p.box !== 'all') { var b = bx.filter(function (x) { return x.acc === p.box; })[0]; return statement([p.box], p, (b ? b.name : accName(p.box))); }
        var rows = bx.map(function (b) { var r = balance([b.acc], p.from, p.to); return { name: b.name, kind: b.kind, open: r.open, inn: r.dr, out: r.cr, close: r.close, _box: b.acc }; });
        var cols = [C('name', 'الاسم'), C('kind', 'النوع'), C('open', 'رصيد أول المدة', 'money'), C('inn', 'الداخل (مدين)', 'money'), C('out', 'الخارج (دائن)', 'money'), C('close', 'الرصيد', 'money')];
        return { cols: cols, rows: rows, total: sumRow(rows, cols), chart: { type: 'hbar', x: 'name', y: ['close'], yl: ['الرصيد'] }, note: 'اضغط على أي صندوق أو بنك لعرض حركته التفصيلية برصيد تراكمي' };
      } };
    R.box_daily = { cat: 'cash', name: 'الحركة اليومية للصناديق والبنوك', desc: 'الداخل والخارج والرصيد لكل يوم', params: ['period', 'boxkind'],
      run: function (p) {
        var ids = boxIds(p.boxkind === 'all' ? '' : p.boxkind);
        if (!ids.length) return { cols: [C('m', '')], rows: [], empty: 'لم تُعرّف صناديق أو بنوك من هذا النوع.' };
        var set = {}, g = {}; ids.forEach(function (x) { set[x] = 1; });
        var bal = balance(ids, p.from, p.to).open, rows = [];
        T().jl.forEach(function (l) { if (!set[l.a] || l.d < p.from || l.d > p.to) return; var r = g[l.d] || (g[l.d] = { inn: 0, out: 0 }); r.inn += l.dr; r.out += l.cr; });
        Object.keys(g).sort().forEach(function (d) { var r = g[d]; rows.push({ name: d, open: bal, inn: r.inn, out: r.out, close: bal + r.inn - r.out }); bal += r.inn - r.out; });
        var cols = [C('name', 'اليوم'), C('open', 'أول اليوم', 'money'), C('inn', 'الداخل', 'money'), C('out', 'الخارج', 'money'), C('close', 'آخر اليوم', 'money')];
        var t = sumRow(rows, [C('inn', '', 'money'), C('out', '', 'money')]); t.close = bal;
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
        rows.push({ m: 'إجمالي المدين على هذا الجهاز', v: fm(dr) }, { m: 'تطابق الجهاز مع سراج', v: ck.debit !== undefined && Math.abs(dr - ck.debit) < 0.01 ? 'مطابق ✓' : 'غير مطابق، اضغط «تحديث البيانات»' });
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

    function view(sub) {
      return {
        load: function (quiet) {
          var had = !!F.D, rev = F.rev + '|' + ((F.pks && F.pks.gen) || ''), nb = JSON.stringify([F.boxes, F.reports, F.config]);
          // التحديث التلقائي لا يعيد رسم الشاشة إلا إذا وصل جديد، حتى لا يقطع ما يكتبه المستخدم
          if (quiet && had && F.lastPull && Date.now() - F.lastPull < 180000) return Promise.resolve(false);
          if (quiet && F.dirty) return Promise.resolve(false);
          F.quiet = quiet;
          return load(false).then(function () { return !had || F.rev + '|' + ((F.pks && F.pks.gen) || '') !== rev || nb !== JSON.stringify([F.boxes, F.reports, F.config]); });
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
    function cardHTML(c, r, pr, i) {
      var v = r.err ? null : r.v, pv = pr && !pr.err ? pr.v : null;
      var ch = c.cmp && pv ? (v - pv) / Math.abs(pv) * 100 : null, good = c.good === 'down' ? ch < 0 : ch > 0;
      var tag = c.rep && R[c.rep] ? 'button' : 'div';
      return '<' + tag + (tag === 'button' ? ' data-crep="' + esc(c.rep) + '"' : '') + ' class="kpi fin-kpi' + (tag === 'button' ? ' tap' : '') + '" title="' + esc(itemText(c)) + '"><span class="k-n">' + esc(c.name) + '</span>' +
        (r.err ? '<b class="num">—</b><small class="down">خطأ: ' + esc(r.err) + '</small>' : '<b class="num">' + fmtVal(v, c.fmt || 'money0') + '</b>') +
        (ch !== null && isFinite(ch) ? '<small class="k-ch ' + (Math.abs(ch) < 0.05 ? '' : good ? 'up' : 'down') + '">' + (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + fp(Math.abs(ch)) + ' <span class="muted">عن السابقة</span></small>' : '') +
        (c.sub && r.sub !== null && r.sub !== undefined ? '<small class="muted">' + fmtVal(r.sub, c.subfmt || 'int') + ' ' + esc(c.subl || '') + '</small>' : '') + '</' + tag + '>';
    }
    function dashPs() { return F.dash || (F.dash = { preset: 'month' }); }
    function dashRange() { return perRange(dashPs()); }
    function dashHTML() {
      var ps = dashPs(), r = dashRange(), list = cards(), gf = F.gflt, rv = recvFor(gf), cmp = isCmp(ps.preset);
      F.lastRange = r;
      var h = '<div class="card head-card"><div class="hc-top"><h2 class="hc-sub">الفترة</h2>' + (canEdit() ? '<button class="btn sm ghost" data-custom>' + ICON_EDIT + '<span class="bt-txt">تخصيص البطاقات</span></button>' : '') + '</div>' +
        periodHTML(ps, 'dash', { prev: true }) + fltPanelHTML(DASH_DIMS, gf, 'dash') + '</div>';
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
      var pr = prevRange(r[0], r[1], ps.preset);
      var cur = evalList(list, r[0], r[1], gf), prev = list.some(function (c) { return c.cmp; }) ? evalList(list, pr[0], pr[1], gf) : [];
      h += '<div class="kpis fin-kpis">' + list.map(function (c, i) { return cardHTML(c, cur[i], prev[i], i); }).join('') + '</div>';
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
      qa('[data-crep]', m).forEach(function (b) { b.onclick = function () { openReport(b.dataset.crep, dashReportParams(b.dataset.crep)); }; });
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
    function dailyHTML() {
      var D = dailyData(), errs = [];
      D.def.rows.forEach(function (r, i) { D.vals.forEach(function (v) { if (v[i].err && errs.indexOf(r.name) < 0) errs.push(r.name); }); });
      var h = '<div class="card head-card"><div class="hc-top"><div class="grow"><h2>' + esc(D.def.title || 'التقرير اليومي للإدارة') + '</h2></div><div class="rh-act">' +
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
    function chartSVG(ch, rows) {
      if (ch.rowsOverride) rows = ch.rowsOverride;
      rows = rows.filter(function (r) { return !r._b || ch.type !== 'hbar'; }).slice(0, ch.limit || rows.length);
      if (!rows.length) return '';
      var vals = []; rows.forEach(function (r) { ch.y.forEach(function (k) { vals.push(Number(r[k]) || 0); }); });
      var max = Math.max.apply(null, vals.concat([0])), min = Math.min.apply(null, vals.concat([0])), span = (max - min) || 1;
      var legend = ch.y.length > 1 ? '<div class="legend">' + ch.y.map(function (k, i) { return '<span><i style="background:' + COLORS[i] + '"></i>' + esc(ch.yl[i]) + '</span>'; }).join('') + '</div>' : '';
      if (ch.type === 'hbar') {
        var hh = rows.length * 30 + 6;
        return legend + '<svg class="chart hb" viewBox="0 0 600 ' + hh + '" role="img" direction="rtl">' + rows.map(function (r, i) {
          var v = Number(r[ch.y[0]]) || 0, w = Math.max(1, Math.abs(v) / (Math.max(Math.abs(max), Math.abs(min)) || 1) * 280);
          var lb = String(r[ch.x]); if (lb.length > 24) lb = lb.slice(0, 23) + '…';
          return '<text x="596" y="' + (i * 30 + 20) + '" text-anchor="start" class="cl">' + esc(lb) + '<title>' + esc(r[ch.x]) + '</title></text>' +
            '<rect x="' + (370 - w) + '" y="' + (i * 30 + 6) + '" width="' + w + '" height="18" rx="4" fill="' + (v < 0 ? COLORS[1] : COLORS[0]) + '"></rect>' +
            '<text x="' + (366 - w) + '" y="' + (i * 30 + 19) + '" text-anchor="end" class="cv">' + fk(v) + '</text>';
        }).join('') + '</svg>';
      }
      var W = 600, H = 230, pl = 56, pb = 34, pt = 10, iw = W - pl - 10, ih = H - pb - pt;
      var y = function (v) { return pt + ih - (v - min) / span * ih; };
      var ticks = [min, min + span / 2, max].map(function (v) { return '<line x1="' + pl + '" x2="' + (W - 10) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"></line><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="cv">' + short(v) + '</text>'; }).join('');
      var n = rows.length, bw = iw / n, lblEvery = Math.ceil(n / 12);
      var xl = rows.map(function (r, i) { return i % lblEvery ? '' : '<text x="' + (pl + bw * i + bw / 2) + '" y="' + (H - 12) + '" text-anchor="middle" class="cl">' + esc(String(r[ch.x]).replace(/^أسبوع /, '').slice(0, 12)) + '</text>'; }).join('');
      var body = '';
      if (ch.type === 'line') {
        ch.y.forEach(function (k, j) {
          var pts = rows.map(function (r, i) { return (pl + bw * i + bw / 2) + ',' + y(Number(r[k]) || 0); }).join(' ');
          body += '<polyline points="' + pts + '" fill="none" stroke="' + COLORS[j] + '" stroke-width="2.5"></polyline>';
          if (n <= 40) rows.forEach(function (r, i) { body += '<circle cx="' + (pl + bw * i + bw / 2) + '" cy="' + y(Number(r[k]) || 0) + '" r="3" fill="' + COLORS[j] + '"><title>' + esc(r[ch.x]) + ': ' + fk(r[k]) + '</title></circle>'; });
        });
      } else {
        var gw = bw * 0.78, sw = gw / ch.y.length;
        rows.forEach(function (r, i) {
          ch.y.forEach(function (k, j) {
            var v = Number(r[k]) || 0, y0 = y(Math.max(0, min)), y1 = y(v);
            body += '<rect x="' + (pl + bw * i + (bw - gw) / 2 + sw * j) + '" y="' + Math.min(y0, y1) + '" width="' + Math.max(1, sw - 1) + '" height="' + Math.max(1, Math.abs(y1 - y0)) + '" rx="2" fill="' + COLORS[j] + '"><title>' + esc(r[ch.x]) + ': ' + fk(v) + '</title></rect>';
          });
        });
      }
      return legend + '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" direction="ltr">' + ticks + body + xl + '</svg>';
    }
    function short(v) { var a = Math.abs(v); return (a >= 1e6 ? (v / 1e6).toFixed(1) + 'م' : a >= 1e3 ? (v / 1e3).toFixed(0) + 'أ' : fk(v)); }

    function openReport(id, params) {
      var def = id.indexOf('c:') === 0 ? F.reports.filter(function (r) { return 'c:' + r.id === id; })[0] : null;
      if (!def && !R[id]) { toast('التقرير غير موجود', true); return; }
      var t = today();
      var base = { preset: 'month', from: t.slice(0, 7) + '-01', to: t, asof: t, gran: 'day', level: 3, top: 0, rby: 'cust', vby: 'none', box: 'all', nonzero: 'nz', measure: 'value', idle: 30, boxkind: 'all', etype: 'all', flt: null };
      var saved = (st.finParams || {})[id] || {};
      if (def) (def.def.kind === 'ready' && R[def.def.base] ? R[def.def.base].sel || [] : []).forEach(function (x) { base[x[0]] = x[2][0][0]; });
      else (R[id].sel || []).forEach(function (x) { base[x[0]] = x[2][0][0]; });
      var p = Object.assign(base, def && def.def.p ? def.def.p : {}, saved, params || {});
      if (def && !saved.view && def.def.view) p.view = JSON.parse(JSON.stringify(def.def.view));
      if (params && params.preset) { p.year = params.year || null; p.month = params.month || null; }
      var dd = def ? (def.def.kind === 'ready' && R[def.def.base] ? R[def.def.base] : { params: ['period'] }) : R[id];
      if (isCmp(p.preset) && dd.params.indexOf('period') < 0) p.preset = 'month';
      F.cur = { id: id, custom: def, p: p };
      go('reports');
      window.scrollTo(0, 0);
    }

    function curDef() { var c = F.cur; if (c.custom && c.custom.def.kind === 'ready' && R[c.custom.def.base]) return Object.assign({}, R[c.custom.def.base], { name: c.custom.name, desc: customDesc(c.custom.def) }); return c.custom ? { name: c.custom.name, desc: customDesc(c.custom.def), params: c.custom.def.kind === 'formula' ? ['period', 'flt'] : ['period'], fdims: DASH_DIMS } : R[c.id]; }
    function runCur() {
      var c = F.cur, p = c.p;
      if (p.preset && p.preset !== 'custom') { var r = presetRange(p.preset, p.from, p.to, p.year, p.month); p.from = r[0]; p.to = r[1]; }
      var fn = function (pp) { return c.custom ? runCustom(c.custom.def, pp) : R[c.id].run(pp); };
      if (multiBr() && viewBr() === 'cmp') {
        var bs = branches(), pcsB = bs.map(function (b) { return { l: b.name, code: b.code }; });
        var oc = runCompare(function (pp, pc) { return withBr(pc.code, function () { return isCmp(pp.preset) && curDef().params.indexOf('period') >= 0 ? runCompare(fn, pp) : fn(pp); }); }, p, pcsB);
        c.rawCols = oc && oc.cols; return applyView(oc, p.view);
      }
      var out = isCmp(p.preset) && curDef().params.indexOf('period') >= 0 ? runCompare(fn, p) : fn(p);
      if (multiBr() && out && !out.empty) out.note = brNote() + (out.note ? ' · ' + plain(out.note) : '');
      c.rawCols = out && out.cols; return applyView(out, p.view);
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
    var DIM = { cust: ['cust', 'العملاء', 'عميل'], supp: ['cust', 'الموردون', 'مورد'], item: ['item', 'الأصناف', 'صنف'], st: ['st', 'المخازن', 'مخزن'], ag: ['ag', 'المناديب', 'مندوب'],
      cat: ['cat', 'فئات المناديب', 'فئة مندوب'], xcat: ['xcat', 'استثناء فئات', 'استثناء فئة'], u: ['u', 'المستخدمون', 'مستخدم'], xcust: ['xcust', 'استثناء العملاء', 'استثناء عميل'], xitem: ['xitem', 'استثناء الأصناف', 'استثناء صنف'] };
    var FDIMS = {}; Object.keys(DIM).forEach(function (k) { FDIMS[k] = DIM[k][1]; });
    function fdimsFor(def) { return def.fdims || (def.cat === 'stock' ? ['item', 'st', 'xitem'] : def.cat === 'purch' ? ['supp', 'item', 'st', 'u'] : ['cust', 'item', 'st', 'ag', 'cat', 'u', 'xcust', 'xitem']); }
    function fltOptions(dim) {
      var Tt = T(), out = [], seen = {};
      var addAcc = function (id, name) { if (seen[id] || !id) return; seen[id] = 1; var a = acc(id); out.push({ id: '@' + id, name: name || (a ? a.name : id), sub: a ? a.code : '' }); };
      if (dim === 'cust' || dim === 'xcust') { F.D.invs.forEach(function (v) { if (v.c === SALE || v.c === SRET) addAcc(v.ck, v.name); }); recvIds().forEach(function (id) { addAcc(id); }); }
      else if (dim === 'supp') { F.D.invs.forEach(function (v) { if (v.c === PUR || v.c === PRET) addAcc(v.ck, v.name); }); payIds().forEach(function (id) { addAcc(id); }); }
      else if (dim === 'item' || dim === 'xitem') {
        var used = {}; Tt.invl.forEach(function (l) { used[l.item] = 1; });
        Object.keys(Tt.item).forEach(function (id) { if (used[id]) out.push({ id: '@' + id, name: itemName(id), sub: String(Tt.item[id].code || '') }); });
      } else if (dim === 'st') Object.keys(Tt.st).forEach(function (id) { out.push({ id: '@' + id, name: storeName(id) }); });
      else if (dim === 'ag') Object.keys(Tt.ag).forEach(function (id) { out.push({ id: '@' + id, name: repName(id) }); });
      else if (dim === 'cat' || dim === 'xcat') repCats().forEach(function (c) { out.push({ id: '@' + c, name: c }); });
      else if (dim === 'u') Object.keys(Tt.us).forEach(function (id) { out.push({ id: '@' + id, name: userName(id) }); });
      return out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); });
    }
    function fObj(f) { return f && typeof f === 'object' ? f : (parseFilter(f) || {}); }
    function fCount(f) { f = fObj(f); return Object.keys(f).reduce(function (n, k) { return n + ((f[k] && f[k].length) || 0); }, 0); }
    // لوحة التصفية: أزرار إضافة، وتحتها كل ما تم اختياره بالاسم مع زر حذف لكل واحد
    function fltPanelHTML(dims, f, key) {
      f = fObj(f);
      var applied = dims.filter(function (d) { var v = f[DIM[d][0]]; return v && v.length; });
      applied = applied.filter(function (d, i) { return applied.map(function (x) { return DIM[x][0]; }).indexOf(DIM[d][0]) === i; });
      var open = applied.length || (F.fpOpen && F.fpOpen[key]);
      return '<details class="fp" data-fp="' + key + '"' + (open ? ' open' : '') + '><summary class="fp-sum"><span class="fp-t">' + ICON_FILTER + ' تصفية</span>' + (applied.length ? '<span class="fp-cnt">' + fCount(f) + ' محدد</span>' : '<span class="small muted">عميل، صنف، مخزن… (اختياري)</span>') + '<i class="car">▾</i></summary><div class="fp-head">' + dims.map(function (d) {
        var n = (f[DIM[d][0]] || []).length;
        return '<button class="chip fp-add' + (n ? ' on' : '') + (/^x/.test(d) ? ' fp-x' : '') + '" data-fadd="' + key + '|' + d + '">' + (/^x/.test(d) ? '− ' : '+ ') + esc(DIM[d][2]) + (n ? ' <span class="fp-n">' + n + '</span>' : '') + '</button>';
      }).join('') + '</div>' +
        (applied.length ? '<div class="fp-applied">' + applied.map(function (d) {
          var k = DIM[d][0], v = f[k];
          return '<div class="fp-row"><span class="fp-lbl">' + esc(DIM[d][1]) + ' (' + v.length + '):</span>' + v.map(function (x, i) {
            return '<span class="fp-tag' + (/^x/.test(k) ? ' x' : '') + '">' + esc(fltName(k, x)) + '<button aria-label="إزالة" data-frm="' + key + '|' + k + '|' + i + '">×</button></span>';
          }).join('') + '</div>';
        }).join('') + '<button class="btn sm ghost fp-clear" data-fclr="' + key + '">✕ إلغاء كل التصفية</button></div>'
          : '<div class="fp-none small muted">بدون تصفية: يُعرض الكل.</div>') + '</details>';
    }
    function bindFltPanel(m, key, dims, getF, setF) {
      var dt = q('[data-fp="' + key + '"]', m); if (dt) dt.addEventListener('toggle', function () { F.fpOpen = F.fpOpen || {}; F.fpOpen[key] = dt.open; });
      qa('[data-fadd^="' + key + '|"]', m).forEach(function (b) {
        b.onclick = function () {
          var d = b.dataset.fadd.split('|')[1], k = DIM[d][0], f = Object.assign({}, fObj(getF()));
          pickMulti({ title: 'اختر ' + DIM[d][1], options: fltOptions(d), value: f[k] || [] }).then(function (v) { if (!v) return; f[k] = v; if (!v.length) delete f[k]; setF(fCount(f) ? f : null); });
        };
      });
      qa('[data-frm^="' + key + '|"]', m).forEach(function (b) {
        b.onclick = function () { var p2 = b.dataset.frm.split('|'), f = Object.assign({}, fObj(getF())); f[p2[1]] = (f[p2[1]] || []).filter(function (x, i) { return i !== Number(p2[2]); }); if (!f[p2[1]].length) delete f[p2[1]]; setF(fCount(f) ? f : null); };
      });
      var c = q('[data-fclr="' + key + '"]', m);
      if (c) c.onclick = function () { setF(null); };
    }
    var ICON_FILTER = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" style="vertical-align:-3px"><path fill="currentColor" d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>';

    function paramsHTML(def, p) {
      var h = '';
      var has = function (k) { return def.params.indexOf(k) >= 0; };
      if (has('period')) h += periodHTML(p, 'rep');
      var sel = function (k, label, opts) { return '<label class="field fin-param"><span class="lbl">' + label + '</span><select class="input" data-pk="' + k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(p[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; };
      var row = '';
      if (isCmp(p.preset) && F.cur && F.cur.res && F.cur.res.cmp) { if (!p.cmpcol || !F.cur.res.cmp.cols.some(function (c) { return c[0] === p.cmpcol; })) p.cmpcol = F.cur.res.cmp.mk; row += sel('cmpcol', 'الرقم المقارن', F.cur.res.cmp.cols); }
      if (has('asof')) row += '<label class="field fin-param"><span class="lbl">في تاريخ</span><input type="date" class="input num" data-pk="asof" value="' + p.asof + '"></label>';
      if (has('asof2')) row += '<label class="field fin-param"><span class="lbl">مقارنة بتاريخ</span><input type="date" class="input num" data-pk="asof2" value="' + esc(p.asof2 || addD(p.asof.slice(0, 4) + '-01-01', -1)) + '"></label>';
      if (has('gran')) row += sel('gran', 'التجميع', GRAN);
      if (has('level')) row += sel('level', 'المستوى', [[1, 'المستوى 1'], [2, 'المستوى 2'], [3, 'المستوى 3'], [4, 'المستوى 4'], [5, 'المستوى 5'], [6, 'كل المستويات']]);
      if (has('top')) row += sel('top', 'العرض', [[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50'], [100, 'أعلى 100']]);
      if (has('measure')) row += sel('measure', 'القيمة', [['value', 'صافي المبيعات (د.ل)'], ['qty', 'الكمية']]);
      if (has('rmeas')) row += sel('rmeas', 'القيمة', [['net', 'صافي المبيعات (د.ل)'], ['profit', 'مجمل الربح'], ['qty', 'الكمية'], ['n', 'عدد الفواتير']]);
      if (has('rep')) { var rl = Object.keys(T().ag).map(function (k) { return [k, repName(k) + ' · ' + repCat(k)]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'ar'); }); if (!p.rep && rl.length) p.rep = rl[0][0]; row += sel('rep', 'المندوب', rl); }
      if (has('rby')) row += sel('rby', 'حسب', [['cust', 'العميل'], ['item', 'الصنف']]);
      if (has('vby')) row += sel('vby', 'العرض', [['none', 'كل سند (تفصيلي)'], ['box', 'مجمّع حسب الصندوق/البنك'], ['party', 'مجمّع حسب الطرف'], ['day', 'مجمّع حسب اليوم']]);
      if (has('nonzero')) row += sel('nonzero', 'الأرصدة', [['nz', 'غير الصفرية فقط'], ['all', 'الكل']]);
      if (has('idle')) row += sel('idle', 'بلا شراء منذ', [[15, '15 يوماً'], [30, '30 يوماً'], [60, '60 يوماً'], [90, '90 يوماً'], [180, '180 يوماً']]);
      if (has('etype')) row += sel('etype', 'نوع القيد', [['all', 'الكل'], ['r', 'سندات القبض'], ['p', 'سندات الدفع'], ['j', 'قيود يومية'], ['i', 'قيود الفواتير'], ['o', 'افتتاحي']]);
      if (has('boxkind')) row += sel('boxkind', 'النوع', [['all', 'الصناديق والبنوك'], ['صندوق', 'الصناديق فقط'], ['بنك', 'البنوك فقط']]);
      if (has('box')) row += sel('box', 'الصندوق/البنك', [['all', 'كل الصناديق والبنوك (ملخص)']].concat(activeBoxes().map(function (b) { return [b.acc, b.name]; })));
      (def.sel || []).forEach(function (x) { row += sel(x[0], x[1], x[2]); });
      if (has('search')) row += '<label class="field fin-param"><span class="lbl">بحث</span><input class="input" data-pk="search" value="' + esc(p.search || '') + '" placeholder="رقم أو اسم"></label>';
      if (has('account')) row += '<div class="field fin-param" style="flex:2"><span class="lbl">الحساب</span><button class="input" data-accpick style="text-align:start">' + (p.account ? esc(acc(p.account) ? acc(p.account).code + ' · ' + acc(p.account).name : '—') : 'اختر الحساب…') + '</button></div>';
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
      var h = '<div class="card head-card"><div class="hc-top"><button class="iconbtn hc-back" data-back aria-label="رجوع إلى التقارير">→</button><div class="grow"><h2>' + esc(res.title || def.name) + '</h2><div class="small muted hc-desc">' + esc(res.subtitle || def.desc || '') + '</div></div>' +
        '<div class="rh-act"><button class="btn sm" data-xls aria-label="Excel">' + ICON_XLS + '<span class="bt-txt">Excel</span></button><button class="btn sm" data-prt aria-label="طباعة">' + ICON.print + '<span class="bt-txt">طباعة</span></button>' + (c.custom && canEdit() ? '<button class="btn sm ' + (c.custom.tmp ? 'accent' : 'ghost') + '" data-edit aria-label="تعديل">' + ICON_EDIT + '<span class="bt-txt">' + (c.custom.tmp ? 'رجوع للتعديل والحفظ' : 'تعديل') + '</span></button>' : '') + '</div></div>' +
        paramsHTML(def, p) + (res.empty && !hasView(p.view) ? '' : viewPanelHTML(res, p)) +
        (res.note ? '<div class="small muted rep-note">' + esc(plain(res.note)) + '</div>' : '') + '</div>';
      if (res.empty) return h + '<div class="card empty">' + esc(res.empty) + '</div>';
      if (res.chart && (res.chart.rowsOverride || res.rows.length > 1)) h += '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>';
      if (!res.rows.length && hasView(p.view)) return h + '<div class="card empty">لا توجد أسطر تطابق شروط التخصيص. عدّل الشروط أو اضغط «إلغاء كل التعديلات».</div>';
      h += '<div class="card scroll-x fin-table">' + tableHTML(res) + '</div>';
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
      return esc(v);
    }
    function lvlCol(res) { return res.cols[0] && res.cols[0].k === 'code' ? 1 : 0; }
    function isNum(c) { return ['money', 'money0', 'int', 'qty', 'pct'].indexOf(c.t) >= 0; }
    function tableHTML(res) {
      var sk = F.cur && F.cur.sort;
      var rows = res.rows.slice();
      if (sk) { var col = res.cols.filter(function (c) { return c.k === sk.k; })[0]; if (col) rows.sort(function (a, b) { var x = a[sk.k], y = b[sk.k]; if (isNum(col)) { x = Number(x) || 0; y = Number(y) || 0; } return (x < y ? -1 : x > y ? 1 : 0) * sk.dir; }); }
      if (!rows.length) return '<p class="muted" style="margin:0">لا توجد حركة في هذه الفترة</p>';
      var clickable = rows.some(function (r) { return r._acc || r._box; });
      var shown = rows.length > 3000 ? rows.slice(0, 3000) : rows;
      return '<table class="tbl fin"><thead><tr>' + res.cols.map(function (c) { return '<th class="' + (isNum(c) ? 'n' : '') + '" data-sort="' + c.k + '">' + esc(c.l) + (sk && sk.k === c.k ? (sk.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        shown.map(function (r) {
          return '<tr class="' + (r._b ? 'b ' : '') + (r._hl ? 'hl ' : '') + ((r._acc || r._box) && clickable ? 'tap' : '') + '"' + (r._acc ? ' data-acc="' + esc(r._acc) + '"' : r._box ? ' data-box="' + esc(r._box) + '"' : '') + '>' +
            res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '"' + (r._lvl && i === lvlCol(res) ? ' style="padding-inline-start:' + (6 + r._lvl * 18) + 'px"' : '') + '>' + cell(c, r[c.k], r) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody>' + (res.total ? '<tfoot><tr>' + res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '">' + (i === 0 ? esc(res.total[c.k] && !isNum(c) ? res.total[c.k] : res.total.name || res.total.desc || 'الإجمالي') : cell(c, res.total[c.k], res.total)) + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table>' +
        '<p class="small muted" style="margin:8px 0 0">' + fk(rows.length) + ' سطر' + (shown.length < rows.length ? ' (يظهر أول ' + fk(shown.length) + '، وملف Excel فيه الكل)' : '') + (clickable ? ' · اضغط على أي حساب لفتح كشف حسابه' : '') + ' · اضغط على عنوان أي عمود للترتيب</p>';
    }

    function bindReport(m) {
      var c = F.cur, p = c.p, def = curDef();
      var save = function () { st.finParams = st.finParams || {}; st.finParams[c.id] = Object.assign({}, p); try { localStorage.setItem('rk.finParams', JSON.stringify(st.finParams)); } catch (e) {} };
      q('[data-back]', m).onclick = function () { F.cur = null; A.render(); };
      bindPeriod(m, 'rep', function () { return p; }, function (ps) { Object.assign(p, ps); save(); A.render(); }, def.params.indexOf('period') >= 0);
      qa('[data-pk]', m).forEach(function (el) {
        el.addEventListener('change', function () { p[el.dataset.pk] = el.value; if (el.dataset.pk === 'from' || el.dataset.pk === 'to') p.preset = 'custom'; save(); A.render(); });
      });
      var ap = q('[data-accpick]', m);
      if (ap) ap.onclick = function () { pickAccount({ title: 'اختر الحساب', any: true }).then(function (id) { if (id) { p.account = id; save(); A.render(); } }); };
      bindFltPanel(m, 'rep', fdimsFor(def), function () { return p.flt; }, function (f) { p.flt = f; save(); A.render(); });
      qa('th[data-sort]', m).forEach(function (th) { th.onclick = function () { var k = th.dataset.sort; c.sort = c.sort && c.sort.k === k ? { k: k, dir: -c.sort.dir } : { k: k, dir: -1 }; A.render(); }; });
      qa('tr[data-acc]', m).forEach(function (tr) { tr.onclick = function () { var asof = def.params.indexOf('asof') >= 0; openReport('statement', { account: tr.dataset.acc, preset: asof ? 'custom' : p.preset, from: asof ? p.asof.slice(0, 4) + '-01-01' : p.from, to: asof ? p.asof : p.to }); }; });
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
    function printReport(res, name, p) {
      var def = curDef(), P = document.getElementById('print');
      P.innerHTML = '<div class="p-rep"><div class="p-head"><img src="logo.png" alt=""><div class="t"><b>' + esc(res.title || name) + '</b><span>شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + esc(periodText(p, def)) + '</span></div><span class="p-copy">' +
        esc('طُبع ' + RK.nowStr().slice(0, 16)) + '</span></div>' + (res.note ? '<p class="p-note">' + esc(plain(res.note)) + '</p>' : '') +
        '<table class="p-tbl"><thead><tr>' + res.cols.map(function (c) { return '<th>' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        res.rows.map(function (r) { return '<tr' + (r._b ? ' style="font-weight:800"' : '') + '>' + res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '"' + (r._lvl && i === lvlCol(res) ? ' style="padding-inline-start:' + (2 + r._lvl * 4) + 'mm"' : '') + '>' + cell(c, r[c.k], r) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>' +
        (res.total ? '<tfoot><tr>' + res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '"><b>' + (i === 0 ? 'الإجمالي' : cell(c, res.total[c.k], res.total)) + '</b></td>'; }).join('') + '</tr></tfoot>' : '') + '</table>' +
        '<p class="p-note">آخر بيانات من سراج: ' + esc((F.meta && F.meta.last) || '') + ' · تقارير راكان تقرأ من سراج ولا تعدّل فيه</p></div>';
      setTimeout(function () { window.print(); }, 150);
    }

    /* ---------- اختيار حساب ---------- */
    function pickAccount(opts) {
      opts = opts || {};
      return new Promise(function (res) {
        var sel = opts.multi ? (opts.value || []).slice() : null;
        sheet(opts.title || 'اختر الحساب', '<input class="input" id="aq" placeholder="ابحث بالرمز أو الاسم">' + (opts.hint ? '<div class="msg info">' + esc(opts.hint) + '</div>' : '') +
          '<div class="list acc-list" id="al"></div>' + (opts.multi ? '<button class="btn primary big" data-ok>حفظ الاختيار</button>' : ''), function (s) {
          var inp = q('#aq', s.el), al = q('#al', s.el);
          function draw() {
            var t = inp.value.trim();
            var list = F.D.accList.filter(function (a) { return (!opts.filter || opts.filter(a)) && (!t || (a.code + ' ' + a.name).indexOf(t) >= 0); }).slice(0, 300);
            al.innerHTML = list.map(function (a) {
              var on = sel && sel.indexOf(String(a.code)) >= 0;
              return '<button class="item tap acc-it' + (on ? ' sel' : '') + '" data-a="' + esc(a.id) + '" style="padding-inline-start:' + (8 + (t ? 0 : (a.lvl - 1) * 14)) + 'px"><div class="main"><b>' + esc(a.name) + '</b><div class="meta"><span class="num">' + esc(a.code) + '</span><span>مستوى ' + a.lvl + '</span>' + (a.leaf ? '' : '<span>رئيسي · ' + a.kids.length + ' فرع</span>') + '</div></div>' + (on ? '✓' : '') + '</button>';
            }).join('') || '<p class="muted">لا نتائج</p>';
            qa('[data-a]', al).forEach(function (b) {
              b.onclick = function () {
                var a = acc(b.dataset.a);
                if (!sel) { s.done = true; s.close(); res(a.id); return; }
                var c = String(a.code), i = sel.indexOf(c); if (i >= 0) sel.splice(i, 1); else sel.push(c); draw();
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
        var sel = (opts.value || []).map(String), byId = {}, onlySel = false;
        opts.options.forEach(function (o) { byId[String(o.id)] = o; });
        var nameOf = function (id) { var o = byId[id] || byId['@' + id] || byId[String(id).replace(/^@/, '')]; return o ? o.name : String(id).replace(/^@/, ''); };
        sheet(opts.title || 'اختر', '<div class="pm-sel" id="pms"></div><input class="input" id="mq" placeholder="اكتب للبحث بالاسم أو الرمز…">' +
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
            ml.innerHTML = shown.map(function (o) { var on = sel.indexOf(String(o.id)) >= 0; return '<button class="item tap pm-it' + (on ? ' sel' : '') + '" data-o="' + esc(o.id) + '"><span class="pm-box">' + (on ? '✓' : '') + '</span><div class="main"><b>' + esc(o.name) + '</b>' + (o.sub ? '<div class="meta"><span class="num">' + esc(o.sub) + '</span></div>' : '') + '</div></button>'; }).join('') +
              (list.length > shown.length ? '<p class="small muted">يظهر ' + shown.length + ' من ' + list.length + '، اكتب في البحث لتضييق القائمة</p>' : '') || '<p class="muted">لا نتائج</p>';
            qa('[data-o]', ml).forEach(function (b) { b.onclick = function () { var id = b.dataset.o, i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); draw(); }; });
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
    function namesOf(k, list) { return (list || []).map(function (x) { return fltName(k, x); }); }
    function termOpts(t) {   // وصف خيارات العنصر بالكلمات
      var parts = [], f = t.flt || {};
      if (t.acc && t.acc.length) parts.push(t.acc.map(function (c) { var a = F.D.byCode[c]; return c + (a ? ' ' + a.name : ''); }).join('، '));
      if (t.st && t.st.length) parts.push('المخزن: ' + namesOf('st', t.st).join('، '));
      if (t.box) parts.push(t.box === 'صندوق' ? 'نقداً (الصناديق)' : t.box === 'بنك' ? 'تحويل (البنوك)' : t.box);
      ['cust', 'item', 'st', 'ag', 'xcust', 'xitem'].forEach(function (k) { if (f[k] && f[k].length) parts.push(DIM[k][1] + ': ' + namesOf(k, f[k]).join('، ')); });
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
        if (d.type === 'flt') o = btn('data-tf="cust"', (f.cust || []).length ? 'العملاء: ' + f.cust.length : 'كل العملاء', (f.cust || []).length) + btn('data-tf="item"', (f.item || []).length ? 'الأصناف: ' + f.item.length : 'كل الأصناف', (f.item || []).length) + btn('data-tf="st"', (f.st || []).length ? 'المخازن: ' + f.st.length : 'كل المخازن', (f.st || []).length);
        else if (d.type === 'cust') o = btn('data-tf="cust"', (f.cust || []).length ? 'العملاء: ' + f.cust.length : 'كل العملاء', (f.cust || []).length);
        else if (d.type === 'coll') o = '<select class="input tb-sel" data-tbox><option value="">كل التحصيل</option><option value="صندوق"' + (t.box === 'صندوق' ? ' selected' : '') + '>نقداً (الصناديق)</option><option value="بنك"' + (t.box === 'بنك' ? ' selected' : '') + '>تحويل (البنوك)</option></select>' + btn('data-tf="cust"', (f.cust || []).length ? 'العملاء: ' + f.cust.length : 'كل العملاء', (f.cust || []).length);
        else if (d.type === 'box') o = '<select class="input tb-sel" data-tbox><option value="">الصناديق والبنوك</option><option value="صندوق"' + (t.box === 'صندوق' ? ' selected' : '') + '>الصناديق فقط</option><option value="بنك"' + (t.box === 'بنك' ? ' selected' : '') + '>البنوك فقط</option></select>';
        else if (d.type === 'acc') o = btn('data-tacc', (t.acc || []).length ? 'الحساب: ' + t.acc.map(function (c) { var a = F.D.byCode[c]; return a ? a.name : c; }).join('، ') : 'اختر الحساب', (t.acc || []).length);
        else if (d.type === 'stock') o = btn('data-tst', (t.st || []).length ? 'المخازن: ' + namesOf('st', t.st).join('، ') : 'كل المخازن', (t.st || []).length) + btn('data-tf="item"', (f.item || []).length ? 'الأصناف: ' + f.item.length : 'كل الأصناف', (f.item || []).length);
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
        b.onclick = function () { var t = row(b), k = b.dataset.tf; t.flt = t.flt || {}; pickMulti({ title: 'اختر ' + DIM[k][1], options: fltOptions(k), value: t.flt[k] || [] }).then(function (v) { if (!v) return; if (v.length) t.flt[k] = v; else delete t.flt[k]; if (!Object.keys(t.flt).length) delete t.flt; onChange(); }); };
      });
      qa('[data-tst]', box).forEach(function (b) { b.onclick = function () { var t = row(b); pickMulti({ title: 'اختر المخازن', options: fltOptions('st'), value: t.st || [] }).then(function (v) { if (v) { t.st = v; onChange(); } }); }; });
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
        var repOpts = '<option value="">بدون</option>' + Object.keys(R).map(function (k) { return '<option value="' + k + '"' + (d.rep === k ? ' selected' : '') + '>' + esc(R[k].name) + '</option>'; }).join('');
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
          else if (op === 'edit') editItem(list[i], kind, ctxFn(i)).then(function (o) { if (o) { list[i] = o; onChange(); } });
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
          if (saved) openReport('c:' + saved.id); else go('reports');
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
    var SET_TABS = [['boxes', 'الصناديق والبنوك'], ['cards', 'بطاقات لوحة المؤشرات'], ['daily', 'التقرير اليومي'], ['groups', 'مجموعات الحسابات'], ['reps', 'المندوبون وفئاتهم'], ['data', 'البيانات']];
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
      var tab = F.setTab || 'boxes', h = '<div class="chips fin-settabs">' + SET_TABS.map(function (t) { return '<button class="chip' + (tab === t[0] ? ' on' : '') + '" data-stab="' + t[0] + '">' + t[1] + (F.dirtyKeys && F.dirtyKeys[t[0]] ? ' •' : '') + '</button>'; }).join('') + '</div>';
      var s = (F.meta && F.meta.settings) || {};
      if (tab === 'boxes') {
        var bx = F.boxes.slice().sort(function (a, b) { return (b.active - a.active) || (a.sort || 0) - (b.sort || 0); });
        var sug = boxSuggestions();
        h += '<div class="card"><h2>الصناديق والبنوك</h2><p class="small muted" style="margin:0 0 10px">عرّف الصناديق والحسابات المصرفية التي تريد متابعة أرصدتها وحركتها وتحصيلها. كل واحد مربوط بحساب في دليل حسابات سراج. «إيقاف» يخفيه من التقارير مع بقاء تعريفه، و«حذف التعريف» يلغي ربطه نهائياً (ولا يمس سراج).</p>' +
          (bx.length ? '<div class="list">' + bx.map(function (b) {
            return '<div class="item' + (b.active ? '' : ' muted') + '"><div class="main"><b>' + esc(b.name) + ' <span class="badge">' + esc(b.kind) + '</span>' + (b.active ? '' : ' <span class="badge">موقوف</span>') + '</b><div class="meta"><span class="num">' + esc((acc(b.acc) || {}).code || '') + '</span><span>' + esc(accName(b.acc)) + '</span><span>الرصيد الآن: <b class="num">' + fm(balance([b.acc], null, null).close) + '</b></span></div></div>' +
              '<div class="fe-btns"><button class="btn sm ghost" data-bedit="' + esc(b.id) + '">تعديل</button>' + (b.active ? '' : '<button class="btn sm ghost" data-bon="' + esc(b.id) + '">تفعيل</button>') + '<button class="btn sm ghost danger-t" data-bdel="' + esc(b.id) + '">حذف التعريف</button></div></div>';
          }).join('') + '</div>' : '<div class="msg info">لم يُعرّف أي صندوق أو بنك بعد.</div>') +
          '<div class="row" style="margin-top:10px"><button class="btn primary" data-badd>+ تعريف صندوق أو بنك</button></div></div>';
        if (sug.length) h += '<div class="card"><h3>حسابات مقترحة من دليل حسابات سراج (' + sug.length + ')</h3><p class="small muted" style="margin:0 0 8px">حسابات تحت «الصناديق» و«المصارف» عليها حركة ولم تُعرّف بعد.</p><div class="list">' +
          sug.map(function (x, i) { return '<label class="item tap"><input type="checkbox" data-sug="' + i + '"><div class="main"><b>' + esc(x.name) + '</b><div class="meta"><span class="badge">' + x.kind + '</span><span>' + fk(x.n) + ' حركة</span><span>الرصيد ' + fm(x.bal) + '</span></div></div></label>'; }).join('') +
          '</div><button class="btn accent" data-sugadd style="margin-top:10px">تعريف المحدد</button></div>';
      } else if (tab === 'cards') {
        var cl = editDraft('cards'), r = presetRange('month');
        h += '<div class="card"><h2>بطاقات لوحة المؤشرات</h2><p class="small muted" style="margin:0 0 10px">كل بطاقة تختار لها ما تحسبه من قائمة (مثل: صافي المبيعات لعميل أو صنف معين، أو رصيد حساب ناقص رصيد حساب آخر). القيم الظاهرة هنا لهذا الشهر.</p>' +
          listEditorHTML('cards', cl, { from: r[0], to: r[1] }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-cadd>+ بطاقة</button><span class="grow"></span><button class="btn ghost" data-creset>استعادة الافتراضي</button><button class="btn accent" data-csave' + (F.dirtyKeys && F.dirtyKeys.cards ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>';
      } else if (tab === 'daily') {
        var dd = editDraft('daily'), d0 = F.D.maxDate || today();
        h += '<div class="card"><h2>التقرير اليومي للإدارة</h2><p class="small muted" style="margin:0 0 10px">رتّب الأسطر وغيّر معادلة كل سطر. القيم الظاهرة هنا ليوم ' + N(d0) + '.</p>' +
          '<div class="field"><label class="lbl" for="dtitle">عنوان التقرير</label><input id="dtitle" class="input" value="' + esc(dd.title || '') + '"></div>' +
          listEditorHTML('daily', dd.rows, { from: d0, to: d0 }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-dadd>+ سطر</button><button class="btn ghost" data-dsep>+ عنوان قسم</button><span class="grow"></span><button class="btn ghost" data-dreset>استعادة الافتراضي</button><button class="btn accent" data-dsave' + (F.dirtyKeys && F.dirtyKeys.daily ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>' +
          '<div class="card"><h3>ملاحظة عن Sell-Out</h3><p class="small" style="margin:0">«Total Sell-Out» افتراضياً = الكمية المباعة لكل العملاء. لحصره في عملاء أو أصناف أو مخزن معين: اضغط «تعديل» على السطر، ثم «كل العملاء» أو «كل الأصناف» واختر ما تريد.</p></div>';
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
    function bindSettings(m) {
      qa('[data-stab]', m).forEach(function (b) { b.onclick = function () { F.setTab = b.dataset.stab; A.render(); }; });
      var tab = F.setTab || 'boxes';
      if (tab === 'boxes') {
        q('[data-badd]', m).onclick = function () { boxForm(null); };
        qa('[data-bedit]', m).forEach(function (b) { b.onclick = function () { boxForm(F.boxes.filter(function (x) { return x.id === b.dataset.bedit; })[0]); }; });
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
        var sa = q('[data-sugadd]', m);
        if (sa) sa.onclick = function () {
          var sug = boxSuggestions(), pick = qa('[data-sug]', m).filter(function (c) { return c.checked; }).map(function (c) { return sug[Number(c.dataset.sug)]; });
          if (!pick.length) { toast('حدّد حساباً واحداً على الأقل', true); return; }
          busy(sa, true);
          var chain = Promise.resolve();
          pick.forEach(function (x, i) { chain = chain.then(function () { return call('fin_box_save', { box: { acc: x.acc, name: x.name, kind: x.kind, sort: F.boxes.length + i } }).then(function (r) { F.boxes = r.boxes; }); }); });
          chain.then(function () { toast('عُرّف ' + pick.length + ' صندوق/بنك'); A.render(); }).catch(function (e) { busy(sa, false); toast(e.message, true); A.render(); });
        };
      } else if (tab === 'cards') {
        var cl = editDraft('cards'), r = presetRange('month'), ch = function () { markDirty('cards', true); A.render(); };
        bindListEditor(m, 'cards', function () { return cl; }, 'card', function (i) { return ctxFor(cl, i, r[0], r[1], 'هذا الشهر'); }, ch);
        q('[data-cadd]', m).onclick = function () { editItem({ cmp: true, good: 'up' }, 'card', ctxFor(cl, cl.length, r[0], r[1], 'هذا الشهر')).then(function (o) { if (o) { cl.push(o); ch(); } }); };
        q('[data-csave]', m).onclick = function () { saveConfig('cards', cl, this); };
        q('[data-creset]', m).onclick = function () { A.confirmBox('استعادة الافتراضي', 'استبدال البطاقات الحالية بالبطاقات الافتراضية الست؟', 'استعادة').then(function (y) { if (y) saveConfig('cards', null); }); };
      } else if (tab === 'daily') {
        var dd = editDraft('daily'), d0 = F.D.maxDate || today(), chd = function () { markDirty('daily', true); A.render(); };
        bindListEditor(m, 'daily', function () { return dd.rows; }, 'row', function (i) { return ctxFor(dd.rows, i, d0, d0, 'يوم ' + d0); }, chd);
        q('#dtitle', m).onchange = function () { dd.title = this.value.trim(); chd(); };
        q('[data-dadd]', m).onclick = function () { editItem(null, 'row', ctxFor(dd.rows, dd.rows.length, d0, d0, 'يوم ' + d0)).then(function (o) { if (o) { dd.rows.push(o); chd(); } }); };
        q('[data-dsep]', m).onclick = function () { editItem({ name: '', f: '' }, 'row', { from: d0, to: d0 }).then(function (o) { if (o) { dd.rows.push(o); chd(); } }); };
        q('[data-dsave]', m).onclick = function () { saveConfig('daily', { title: dd.title, rows: dd.rows }, this); };
        q('[data-dreset]', m).onclick = function () { A.confirmBox('استعادة الافتراضي', 'استبدال أسطر التقرير اليومي بالأسطر الافتراضية (مثل نموذج الإدارة)؟', 'استعادة').then(function (y) { if (y) saveConfig('daily', null); }); };
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
    function boxForm(b) {
      var d = b ? Object.assign({}, b) : { acc: '', name: '', kind: 'صندوق', active: true, sort: F.boxes.length };
      return sheet(b ? 'تعديل ' + b.name : 'تعريف صندوق أو بنك', '<div class="form"><div class="field"><span class="lbl">الحساب في دليل سراج</span><button class="input" id="bacc" style="text-align:start">' + (d.acc ? esc(((acc(d.acc) || {}).code || '') + ' · ' + accName(d.acc)) : 'اختر الحساب…') + '</button></div>' +
        '<div class="field"><label class="lbl" for="bnm">الاسم في التقارير</label><input id="bnm" class="input" value="' + esc(d.name) + '"></div>' +
        '<div class="field"><span class="lbl">النوع</span><div class="chips">' + ['صندوق', 'بنك'].map(function (k) { return '<button class="chip' + (d.kind === k ? ' on' : '') + '" data-k="' + k + '">' + k + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label class="lbl" for="bso">الترتيب</label><input id="bso" type="number" class="input num" value="' + esc(d.sort) + '" style="max-width:120px"></div>' +
        (b ? '<label class="chk"><input type="checkbox" id="bac"' + (d.active ? ' checked' : '') + '> نشط (يظهر في التقارير)</label>' : '') +
        '<div id="berr"></div><button class="btn primary big" id="bsv">حفظ</button></div>', function (s) {
        q('#bacc', s.el).onclick = function () {
          pickAccount({ title: 'حساب الصندوق أو البنك', filter: function (a) { return a.leaf; } }).then(function (id) {
            if (!id) return; d.acc = id; q('#bacc', s.el).textContent = acc(id).code + ' · ' + acc(id).name;
            if (!q('#bnm', s.el).value) q('#bnm', s.el).value = acc(id).name.trim();
          });
        };
        qa('[data-k]', s.el).forEach(function (c) { c.onclick = function () { d.kind = c.dataset.k; qa('[data-k]', s.el).forEach(function (x) { x.classList.toggle('on', x === c); }); }; });
        q('#bsv', s.el).onclick = function () {
          var btn = this; busy(btn, true);
          d.name = q('#bnm', s.el).value.trim(); d.sort = Number(q('#bso', s.el).value) || 0; if (b) d.active = q('#bac', s.el).checked;
          call('fin_box_save', { box: d }).then(function (r) { F.boxes = r.boxes; s.close(); toast('حُفظ'); A.render(); })
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
        if (saved) openReport('c:' + saved.id); else go('reports');
      }).catch(function (e) { busy(btn, false); toast(e.message, true); });
    }

    /* ---------- فهرس التقارير ---------- */
    function catalogHTML() {
      var n = Object.keys(R).length;
      var h = '<div class="card cat-top"><div class="cat-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input class="input" id="rq" placeholder="ابحث في ' + n + ' تقريراً: مبيعات، عميل، ميزانية، مخزون…" value="' + esc(F.rq || '') + '" aria-label="بحث في التقارير"></div>' +
        (canEdit() ? '<div class="cat-cta"><button class="btn accent" data-newrep>+ إنشاء تقرير</button><button class="btn" data-newpair>حساب مقابل حساب</button></div>' : '') + '</div>' +
        '<div class="cat-filter" role="group" aria-label="التصنيف">' + [['all', 'الكل']].concat(F.reports.length ? [['mine', 'تقاريري']] : []).concat(CATS.filter(function (c) { return c[0] !== 'mine'; })).map(function (c) { return '<button class="' + ((F.rcat || 'all') === c[0] ? 'on' : '') + '" data-jump="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div>';
      var mine = F.reports.map(function (r) { return { id: 'c:' + r.id, rid: r.id, name: r.name, desc: customDesc(r.def), by: r.by }; });
      var cats = [['mine', 'تقاريري']].concat(CATS.filter(function (c) { return c[0] !== 'mine'; }));
      cats.forEach(function (c) {
        var list = c[0] === 'mine' ? mine : Object.keys(R).filter(function (k) { return R[k].cat === c[0]; }).map(function (k) { return { id: k, name: R[k].name, desc: R[k].desc }; });
        if (!list.length && c[0] !== 'mine') return;
        if (!list.length && !canEdit()) return;
        if (F.rcat && F.rcat !== 'all' && F.rcat !== c[0]) return;
        h += '<section class="fin-catsec' + (c[0] === 'mine' ? ' mine' : '') + '" id="cat-' + c[0] + '"><div class="sec-title"><h2>' + c[1] + ' <span class="badge">' + list.length + '</span></h2></div><div class="fin-cat">' + (list.length ? list.map(function (r) {
          return '<div class="rep-tile" data-s="' + esc(r.name + ' ' + (r.desc || '') + ' ' + c[1]) + '"><button class="rep-open" data-open="' + esc(r.id) + '"><b>' + esc(r.name) + '</b><span>' + esc(r.desc || '') + (r.by ? ' · ' + esc(r.by) : '') + '</span></button>' +
            (r.rid && canEdit() ? '<button class="iconbtn rep-ed" data-redit="' + esc(r.rid) + '" aria-label="تعديل" title="تعديل">' + ICON_EDIT + '</button>' : '') + '</div>';
        }).join('') : '<div class="cat-empty"><b>لا توجد تقارير خاصة بك بعد</b><span>صمّم تقريراً من الصفر واحفظه هنا ليظهر لكل المستخدمين.</span><button class="btn sm accent" data-newrep>+ إنشاء تقرير</button></div>') + '</div></section>';
      });
      return h;
    }
    function bindCatalog(m) {
      var inp = q('#rq', m);
      var apply = function () {
        var t = normAr(inp.value); F.rq = inp.value.trim();
        if (t && F.rcat && F.rcat !== 'all') { F.rcat = 'all'; A.render(); var ni = q('#rq'); if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } return; }
        qa('.rep-tile', m).forEach(function (b) { b.hidden = !!t && normAr(b.dataset.s).indexOf(t) < 0; });
        qa('.fin-catsec', m).forEach(function (s) { s.hidden = !!t && !qa('.rep-tile', s).some(function (b) { return !b.hidden; }); });
      };
      inp.oninput = apply; if (F.rq) apply();
      qa('[data-jump]', m).forEach(function (b) { b.onclick = function () { F.rcat = b.dataset.jump; inp.value = ''; F.rq = ''; A.render(); }; });
      qa('[data-newrep]', m).forEach(function (b) { b.onclick = function () { F.custom = null; go('builder'); }; });
      var np = q('[data-newpair]', m); if (np) np.onclick = function () { F.custom = { name: '', cat: 'تقاريري', def: ST_TPL[0][3]() }; go('builder'); };
      qa('[data-redit]', m).forEach(function (b) { b.onclick = function () { var r = F.reports.filter(function (x) { return x.id === b.dataset.redit; })[0]; if (!r) return; if (r.def.kind === 'ready') { F.vpOpen = true; openReport('c:' + r.id); return; } F.custom = JSON.parse(JSON.stringify(r)); go('builder'); }; });
    }

    function pickReady() {
      var list = Object.keys(R).map(function (k) { return { id: k, name: R[k].name, desc: R[k].desc, cat: (CATS.filter(function (c) { return c[0] === R[k].cat; })[0] || [0, ''])[1] }; });
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

    // عند الخروج: مسح البيانات المالية من الجهاز
    A.onLogout(function () { var pk = Object.keys((F.pks && F.pks.list) || {}); F.packs = {}; F.pks = null; F.rows = null; F.D = null; F.Dby = null; F.Dcache = null; F.br = undefined; F.rev = 0; F.meta = null; F.cur = null; F.edit = null; F.dirtyKeys = null; F.dirty = false; return Promise.all([S.del('fin:rows'), S.del('fin:rev'), S.del('fin:meta'), S.del('fin:aux'), S.del('fin:pks')].concat(pk.map(function (n) { return S.del('fin:pk:' + n); }))); });
    try { st.finParams = JSON.parse(localStorage.getItem('rk.finParams') || '{}'); } catch (e) { st.finParams = {}; }

    // للاختبارات: الوصول للمحرّك
    window.__rkfin = { F: F, R: R, runCustom: runCustom, runPair: runPair, runFree: runFree, applyView: applyView, CATS: CATS, repCat: repCat, repCollections: repCollections, SRC: SRC, normAr: normAr, build: rebuild, buildOne: build, useBr: useBr, setBr: setBr, withBr: withBr, branches: branches, recvIds: recvIds, runCur: runCur, balance: balance, salesStats: salesStats, evalFormula: evalFormula, tryFormula: tryFormula, evalList: evalList,
      stockTotals: stockTotals, collections: collections, termsToF: termsToF, fToTerms: fToTerms, itemText: function (x) { return itemText(x); }, fltOptions: function (d) { return fltOptions(d); }, dailyData: function () { return dailyData(); }, cards: cards, dailyDef: dailyDef };
  };
})();
