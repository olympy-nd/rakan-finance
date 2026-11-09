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
      ['lastmonth', 'الشهر الماضي'], ['quarter', 'هذا الربع'], ['year', 'هذه السنة'], ['custom', 'فترة محددة']];
    function presetRange(p, from, to) {
      var t = today(), m = t.slice(0, 7);
      switch (p) {
        case 'today': return [t, t];
        case 'yesterday': return [addD(t, -1), addD(t, -1)];
        case 'week': return [weekStart(t), t];
        case 'last7': return [addD(t, -6), t];
        case 'month': return [m + '-01', t];
        case 'lastmonth': var lm = addD(m + '-01', -1).slice(0, 7); return [lm + '-01', monthEnd(lm)];
        case 'quarter': var qm = Math.floor((+t.slice(5, 7) - 1) / 3) * 3 + 1; return [t.slice(0, 4) + '-' + ('0' + qm).slice(-2) + '-01', t];
        case 'year': return [t.slice(0, 4) + '-01-01', t];
        default: return [from || m + '-01', to || t];
      }
    }
    function prevRange(from, to, p) {
      if (p === 'month' || p === 'lastmonth') {
        var pm = addD(from, -1).slice(0, 7), n = days(from, to);
        var pe = addD(pm + '-01', n);
        return [pm + '-01', pe > monthEnd(pm) ? monthEnd(pm) : pe];
      }
      if (p === 'year') { var y = +from.slice(0, 4) - 1; return [y + from.slice(4), y + to.slice(4)]; }
      var len = days(from, to) + 1;
      return [addD(from, -len), addD(from, -1)];
    }
    function perLabel(from, to) { return from === to ? N(from) : 'من ' + N(from) + ' إلى ' + N(to); }

    /* ===================== تحميل البيانات ===================== */
    function load(force) {
      if (F.loading) return F.loading;
      F.loading = (F.rows ? Promise.resolve() : Promise.all([S.get('fin:rows'), S.get('fin:rev'), S.get('fin:meta'), S.get('fin:aux')]).then(function (v) {
        F.rows = v[0] || {}; F.rev = v[1] || 0; F.meta = v[2] || null;
        if (v[3]) { F.boxes = v[3].boxes || []; F.reports = v[3].reports || []; F.config = v[3].config || {}; }
        if (Object.keys(F.rows).length) build();
      })).then(function () {
        if (!navigator.onLine) throw new Error('لا يوجد اتصال بالإنترنت');
        return pull(force).then(function () { return Promise.all([call('fin_boxes'), call('fin_reports'), call('fin_config').catch(function () { return { config: F.config }; })]); }).then(function (r) {
          F.boxes = r[0].boxes; F.reports = r[1].reports; F.config = r[2].config || {}; F.error = null; F.lastPull = Date.now();
          return S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config });
        });
      }).catch(function (e) {
        if (!F.D) { F.error = e.message; throw e; }
        if (!F.quiet) toast('تعذّر تحديث البيانات المالية (' + e.message + ')، تُعرض آخر بيانات محفوظة', true);
      }).finally(function () { F.loading = null; F.progress = ''; });
      return F.loading;
    }

    function pull(force) {
      var changed = 0;
      var step = function () {
        return call('fin_pull', { since: F.rev, limit: 8000 }, { timeout: 120000 }).then(function (r) {
          F.meta = r.meta;
          r.rows.forEach(function (x) {
            var key = x[0] + ':' + x[4];
            if (x[2]) delete F.rows[key]; else F.rows[key] = [x[0], x[1]];
            changed++;
          });
          F.rev = r.next;
          if (r.more) { F.progress = 'جارٍ تحميل البيانات المالية… ' + Object.keys(F.rows).length.toLocaleString('en-US') + ' سجل'; paintProgress(); return step(); }
        });
      };
      return step().then(function () {
        if (changed || !F.D || force) { if (Object.keys(F.rows).length) build(); else F.D = null; return Promise.all([S.set('fin:rows', F.rows), S.set('fin:rev', F.rev), S.set('fin:meta', F.meta)]); }
        return S.set('fin:meta', F.meta);
      });
    }

    function paintProgress() { var el = q('#finprog'); if (el) el.textContent = F.progress; }

    /* ===================== بناء نموذج البيانات ===================== */
    var SALE = 102, SRET = 104, PUR = 105, PRET = 107, OPEN_STOCK = 101, TRANSFER = 108, ISSUE = 110;
    // أثر كل نوع فاتورة على كمية المخزن (المناقلة: من مخزن إلى آخر)
    var STOCK_SIGN = {}; STOCK_SIGN[OPEN_STOCK] = 1; STOCK_SIGN[PUR] = 1; STOCK_SIGN[PRET] = -1; STOCK_SIGN[SALE] = -1; STOCK_SIGN[SRET] = 1; STOCK_SIGN[ISSUE] = -1;

    function build() {
      var T = { acc: {}, bt: {}, it: {}, cu: {}, ag: {}, us: {}, st: {}, item: {}, jl: [], inv: {}, invl: [] };
      Object.keys(F.rows).forEach(function (k) {
        var v = F.rows[k], d;
        try { d = JSON.parse(v[1]); } catch (e) { return; }
        if (v[0] === 'jl' || v[0] === 'invl') T[v[0]].push(d); else if (T[v[0]]) T[v[0]][d.id] = d;
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
      F.D = { T: T, byAcc: byAcc, byEntry: byEntry, moves: moves, costHist: costHist,
        accList: Object.keys(T.acc).map(function (k) { return T.acc[k]; }).sort(function (x, y) { return String(x.po || x.code).localeCompare(String(y.po || y.code)); }),
        maxDate: T.jl.reduce(function (m, l) { return l.d > m ? l.d : m; }, '') };
      F.D.invs = Object.keys(T.inv).map(function (k) { return T.inv[k]; });
      F.D.byCode = {}; F.D.accList.forEach(function (a) { F.D.byCode[a.code] = a; });
      F.D.custAccs = {}; F.D.invs.forEach(function (v) { if (v.c === SALE || v.c === SRET) F.D.custAccs[v.ck] = v.name; });
      F.cache = {};
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
    function byCodes(codes) {
      var key = 'c:' + codes;
      if (F.cache[key]) return F.cache[key];
      var ids = [];
      String(codes || '').split(/[,،\s]+/).map(function (c) { return c.trim(); }).filter(String).forEach(function (c) {
        var a = F.D.byCode[c];
        if (a) ids = ids.concat(descend(a.id));
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
    function recvIds() { return leavesOf(byCodes((F.meta && F.meta.settings && F.meta.settings.recv) || '1601')); }
    function payIds() { return leavesOf(byCodes((F.meta && F.meta.settings && F.meta.settings.pay) || '261')); }
    function activeBoxes(kind) { return F.boxes.filter(function (b) { return b.active && (!kind || b.kind === kind || b.name.indexOf(kind) >= 0); }); }
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
      'بدون_مخزن': 'xst', xst: 'xst', 'نوع': 'type', type: 'type' };
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
