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
    function matchAny(list, id, name, code) {
      return list.some(function (x) {
        x = String(x);
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
    function collections(from, to, kind, perCust) {
      var bx = boxIds(kind), recv = recvIds(), bset = {}, rset = {}, tot = 0, by = {};
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
    fn('مديونية', 'DEBT', '', 'مديونية العملاء في نهاية الفترة (حسابات العملاء المحددة في الإعدادات).', function (c) { return balance(recvIds(), null, c.to).close; }, G_ACC);
    fn('الموردون', 'SUPP', '', 'ما للموردين على الشركة في نهاية الفترة (رصيد دائن).', function (c) { return -balance(payIds(), null, c.to).close; }, G_ACC);
    fn('مبيعات', 'SALES', '"تصفية اختيارية"', 'صافي المبيعات (المبيع − المرتجع) في الفترة.', function (c, a) { return salesStats(c.from, c.to, a[0]).net; }, G_SAL);
    fn('مبيعات_إجمالي', 'GSALES', '"تصفية"', 'المبيعات قبل خصم المرتجعات.', function (c, a) { return salesStats(c.from, c.to, a[0]).sales; }, G_SAL);
    fn('مرتجعات', 'RETURNS', '"تصفية"', 'قيمة مرتجعات المبيع.', function (c, a) { return salesStats(c.from, c.to, a[0]).ret; }, G_SAL);
    fn('كمية_مبيعات', 'SQTY', '"تصفية"', 'صافي الكمية المباعة بالوحدة الشائعة (الكرتونة/الصندوق).', function (c, a) { return salesStats(c.from, c.to, a[0]).nqty; }, G_SAL);
    fn('كمية_مرتجعات', 'RQTY', '"تصفية"', 'الكمية المرتجعة.', function (c, a) { return salesStats(c.from, c.to, a[0]).rqty; }, G_SAL);
    fn('هدايا', 'GIFTS', '"تصفية"', 'كمية الهدايا في فواتير المبيع.', function (c, a) { return salesStats(c.from, c.to, a[0]).gift; }, G_SAL);
    fn('ربح', 'PROFIT', '"تصفية"', 'مجمل الربح (القيمة − التكلفة).', function (c, a) { return salesStats(c.from, c.to, a[0]).profit; }, G_SAL);
    fn('تكلفة_مبيعات', 'COGS', '"تصفية"', 'تكلفة البضاعة المباعة.', function (c, a) { return salesStats(c.from, c.to, a[0]).cost; }, G_SAL);
    fn('فواتير_مبيع', 'NINV', '"تصفية"', 'عدد فواتير المبيع.', function (c, a) { return salesStats(c.from, c.to, a[0]).n; }, G_SAL);
    fn('عملاء_مشترون', 'NCUST', '"تصفية"', 'عدد العملاء الذين اشتروا في الفترة.', function (c, a) { return salesStats(c.from, c.to, a[0]).cust; }, G_SAL);
    fn('مشتريات', 'PURCH', '"تصفية"', 'صافي المشتريات (الشراء − مرتجع الشراء).', function (c, a) { var s = salesStats(c.from, c.to, a[0]); return s.purch - s.pret; }, G_SAL);
    fn('كمية_مشتريات', 'PQTY', '"تصفية"', 'صافي الكمية المشتراة بالوحدة الشائعة.', function (c, a) { return salesStats(c.from, c.to, a[0]).pqty; }, G_SAL);
    fn('تحصيل', 'COLL', '"صندوق" أو "بنك" أو اسم', 'المحصّل من العملاء في الفترة إلى الصناديق أو البنوك المعرّفة. بدون قيمة: الكل.', function (c, a) { return collections(c.from, c.to, a[0] || ''); }, G_CASH);
    fn('مقبوضات', 'REC', '', 'مجموع سندات القبض في الفترة.', function (c) { return cashStats(c.from, c.to).rec; }, G_CASH);
    fn('مدفوعات', 'PAY', '', 'مجموع سندات الدفع في الفترة.', function (c) { return cashStats(c.from, c.to).pay; }, G_CASH);
    fn('رصيد_صناديق', 'BOXBAL', '"صندوق" أو "بنك" أو اسم', 'رصيد الصناديق أو البنوك المعرّفة في نهاية الفترة.', function (c, a) { var b = boxIds(a[0] || ''); return b.length ? balance(b, null, c.to).close : 0; }, G_CASH);
    fn('مخزون_كمية', 'STOCKQ', '"المخازن" ، "تصفية"', 'كمية المخزون في نهاية الفترة بالوحدة الشائعة. بدون مخزن: كل المخازن.', function (c, a) { return stockTotals(c.to, splitList(a[0]), a[1]).qty; }, G_STK);
    fn('مخزون_قيمة', 'STOCKV', '"المخازن" ، "تصفية"', 'قيمة المخزون بمتوسط التكلفة في نهاية الفترة.', function (c, a) { return stockTotals(c.to, splitList(a[0]), a[1]).val; }, G_STK);
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
    function evalFormula(src, from, to, vars) {
      var tree = PARSED[src] || (PARSED[src] = parseFormula(src));
      var v = evalTree(tree, { from: from, to: to, vars: vars });
      if (typeof v === 'string') throw new Error('النتيجة نص، وليست رقماً');
      return isFinite(v) ? v : 0;
    }
    function tryFormula(src, from, to, vars) { try { return { v: evalFormula(src, from, to, vars) }; } catch (e) { return { err: e.message }; } }
    // تقييم قائمة (بطاقات أو أسطر) بالترتيب، وكل سطر يمكنه استعمال ما قبله بالاسم {الاسم}
    function evalList(list, from, to) {
      var vars = {};
      return list.map(function (it) {
        if (!it.f) return { sep: true };
        var r = tryFormula(it.f, from, to, vars);
        if (it.name) vars[String(it.name).trim()] = r.err ? 'err' : r.v;
        if (it.sub) { var s2 = tryFormula(it.sub, from, to, vars); r.sub = s2.err ? null : s2.v; }
        return r;
      });
    }
    var FMTS = [['money', 'مبلغ (3 خانات)'], ['money0', 'مبلغ مقرّب'], ['dec2', 'رقم بخانتين'], ['qty', 'كمية'], ['int', 'عدد صحيح'], ['pct', 'نسبة %']];
    function fmtVal(v, f) {
      if (v === null || v === undefined || v === '') return '';
      return f === 'money' ? fm(v) : f === 'money0' ? fk(v) : f === 'dec2' ? f2(v) : f === 'int' ? fk(v) : f === 'pct' ? fp(v) : fq(v);
    }

    /* ---------- الإعدادات الافتراضية للبطاقات والتقرير اليومي ---------- */
    var DEFAULT_CARDS = [
      { id: 'c1', name: 'صافي المبيعات', f: 'مبيعات()', fmt: 'money0', sub: 'فواتير_مبيع()', subl: 'فاتورة مبيع', subfmt: 'int', cmp: true, good: 'up', rep: 'sales_trend' },
      { id: 'c2', name: 'مجمل الربح', f: 'ربح()', fmt: 'money0', sub: 'نسبة(ربح(), مبيعات())', subl: 'هامش الربح', subfmt: 'pct', cmp: true, good: 'up', rep: 'gross_profit' },
      { id: 'c3', name: 'التحصيل', f: 'تحصيل()', fmt: 'money0', sub: 'نسبة(تحصيل(), مبيعات())', subl: 'من المبيعات', subfmt: 'pct', cmp: true, good: 'up', rep: 'collections_cust' },
      { id: 'c4', name: 'مديونية العملاء', f: 'مديونية()', fmt: 'money0', cmp: true, good: 'down', rep: 'recv_balances' },
      { id: 'c5', name: 'أرصدة الصناديق والبنوك', f: 'رصيد_صناديق()', fmt: 'money0', cmp: false, rep: 'boxes' },
      { id: 'c6', name: 'قيمة المخزون', f: 'مخزون_قيمة()', fmt: 'money0', sub: 'مخزون_كمية()', subl: 'كرتونة/وحدة', subfmt: 'qty', cmp: false, rep: 'stock_store' }
    ];
    var DEFAULT_DAILY = { title: 'التقرير اليومي للإدارة', rows: [
      { name: 'Total Sell-Out', f: 'كمية_مبيعات()', fmt: 'dec2' },
      { name: 'Total Sell-Out Amount', f: 'مبيعات()', fmt: 'dec2' },
      { name: 'Total Collection Cash', f: 'تحصيل("صندوق")', fmt: 'dec2' },
      { name: 'Total Collection Transfer', f: 'تحصيل("بنك")', fmt: 'dec2' },
      { name: 'AL ZAHRA Account', f: 'رصيد_دائن("261004")', fmt: 'dec2' },
      { name: 'Total Dept in the market', f: 'مديونية()', fmt: 'dec2' },
      { name: 'Inventory (Qty) Main', f: 'مخزون_كمية("المستودع الرئيسي")', fmt: 'dec2' },
      { name: 'Inventory Value Main', f: 'مخزون_قيمة("المستودع الرئيسي")', fmt: 'dec2' },
      { name: 'Inventory (Qty) Agents', f: 'مخزون_كمية("بنغازي,سبها")', fmt: 'dec2' },
      { name: 'Inventory Value Agents', f: 'مخزون_قيمة("بنغازي,سبها")', fmt: 'dec2' },
      { name: 'Avarage Selling Price', f: 'قسمة(مبيعات(), كمية_مبيعات())', fmt: 'dec2' }
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
    function repName(id) { return (T().ag[id] || {}).name || 'بدون'; }
    function userName(id) { return (T().us[id] || {}).name || 'غير معروف'; }
    function noteF(p) { var f = parseFilter(p.flt); if (!f) return ''; var parts = []; Object.keys(f).forEach(function (k) { if (f[k] && f[k].length) parts.push(FLT_LABEL[k] + ': ' + f[k].map(function (x) { return fltName(k, x); }).join('، ')); }); return parts.length ? 'التصفية: ' + parts.join(' · ') : ''; }
    var FLT_LABEL = { cust: 'العميل', item: 'الصنف', st: 'المخزن', ag: 'المندوب', u: 'المستخدم', xcust: 'بدون العميل', xitem: 'بدون الصنف', xst: 'بدون المخزن', type: 'النوع' };
    function fltName(k, x) { return k === 'cust' || k === 'xcust' ? (acc(x) ? acc(x).name : x) : k === 'item' || k === 'xitem' ? (T().item[x] ? itemName(x) : x) : k === 'st' || k === 'xst' ? (T().st[x] ? storeName(x) : x) : k === 'ag' ? (T().ag[x] ? repName(x) : x) : k === 'u' ? (T().us[x] ? userName(x) : x) : x; }
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
    R.exec_summary = { cat: 'exec', name: 'الملخص التنفيذي', desc: 'أهم المؤشرات للفترة مقارنة بالفترة السابقة', params: ['period'],
      run: function (p) {
        var pr = prevRange(p.from, p.to, p.preset);
        var a = salesStats(p.from, p.to), b = salesStats(pr[0], pr[1]), ca = cashStats(p.from, p.to), cb = cashStats(pr[0], pr[1]);
        var ra = balance(recvIds(), null, p.to).close, rb = balance(recvIds(), null, pr[1]).close;
        var rows = [
          ['صافي المبيعات', a.net, b.net], ['المبيعات', a.sales, b.sales], ['المرتجعات', a.ret, b.ret],
          ['نسبة المرتجعات %', pct(a.ret, a.sales), pct(b.ret, b.sales), 'p'], ['صافي الكمية المباعة', a.nqty, b.nqty, 'q'], ['عدد فواتير المبيع', a.n, b.n, 'n'],
          ['عدد العملاء المشترين', a.cust, b.cust, 'n'], ['متوسط سعر الوحدة', a.nqty ? a.net / a.nqty : 0, b.nqty ? b.net / b.nqty : 0],
          ['مجمل الربح', a.profit, b.profit], ['هامش الربح %', pct(a.profit, a.net), pct(b.profit, b.net), 'p'],
          ['المشتريات (صافي)', a.purch - a.pret, b.purch - b.pret], ['التحصيل من العملاء', collections(p.from, p.to, ''), collections(pr[0], pr[1], '')],
          ['المقبوضات', ca.rec, cb.rec], ['المدفوعات', ca.pay, cb.pay], ['مديونية العملاء في نهاية الفترة', ra, rb],
          ['قيمة المخزون في نهاية الفترة', stockTotals(p.to).val, stockTotals(pr[1]).val]];
        if (ca.boxNet !== undefined) rows.push(['أرصدة الصناديق والبنوك في نهاية الفترة', ca.boxClose, cb.boxClose]);
        return { cols: [C('m', 'المؤشر'), C('a', 'الفترة الحالية', 'money'), C('b', 'الفترة السابقة', 'money'), C('ch', 'التغيّر %', 'pct')],
          rows: rows.map(function (r) { return { m: r[0], a: r[1], b: r[2], ch: r[2] ? (r[1] - r[2]) / Math.abs(r[2]) * 100 : null, _fmt: r[3] }; }),
          note: 'الفترة السابقة: ' + perLabel(pr[0], pr[1]) };
      } };
    R.kpi_month = { cat: 'exec', name: 'المؤشرات الشهرية', desc: 'المبيعات والربح والتحصيل والمديونية والمخزون لكل شهر', params: ['period'],
      run: function (p) {
        var rows = [], m = p.from.slice(0, 7), end = p.to.slice(0, 7);
        while (m <= end) {
          var a = m + '-01' < p.from ? p.from : m + '-01', b = monthEnd(m) > p.to ? p.to : monthEnd(m), s = salesStats(a, b);
          rows.push({ name: monthLabel(m), net: s.net, qty: s.nqty, profit: s.profit, margin: pct(s.profit, s.net), coll: collections(a, b, ''), purch: s.purch - s.pret, debt: balance(recvIds(), null, b).close, stock: stockTotals(b).val });
          m = addD(monthEnd(m), 1).slice(0, 7);
        }
        var cols = [C('name', 'الشهر'), C('net', 'صافي المبيعات', 'money'), C('qty', 'الكمية', 'qty'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'),
          C('coll', 'التحصيل', 'money'), C('purch', 'المشتريات', 'money'), C('debt', 'المديونية آخر الشهر', 'money'), C('stock', 'المخزون آخر الشهر', 'money')];
        var t = sumRow(rows, cols.slice(0, 7)); t.margin = pct(t.profit, t.net);
        return { cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['net', 'coll'], yl: ['صافي المبيعات', 'التحصيل'] } };
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
    function custFirstLast() {
      if (F.cache.cfl) return F.cache.cfl;
      var m = {};
      F.D.invs.forEach(function (v) { if (v.c !== SALE) return; var r = m[v.ck] || (m[v.ck] = { first: v.d, last: v.d, name: v.name }); if (v.d < r.first) r.first = v.d; if (v.d > r.last) r.last = v.d; });
      return (F.cache.cfl = m);
    }
    R.new_customers = { cat: 'cust', name: 'العملاء الجدد', desc: 'العملاء الذين كانت أول فاتورة لهم في الفترة', params: ['period'],
      run: function (p) {
        var m = custFirstLast(), s = {};
        salesBy(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }).forEach(function (r) { s[r.k] = r; });
        var rows = Object.keys(m).filter(function (k) { return m[k].first >= p.from && m[k].first <= p.to; }).map(function (k) { var r = s[k] || {}; return { name: m[k].name, first: m[k].first, n: r.n || 0, net: r.net || 0, debt: acc(k) ? balance([k], null, p.to).close : '', _acc: acc(k) ? k : null }; }).sort(function (a, b) { return a.first < b.first ? -1 : 1; });
        return { cols: [C('name', 'العميل'), C('first', 'أول فاتورة'), C('n', 'الفواتير', 'int'), C('net', 'صافي المبيعات', 'money'), C('debt', 'الرصيد', 'money')], rows: rows, total: sumRow(rows, [C('n', '', 'int'), C('net', '', 'money')]) };
      } };
    R.dormant = { cat: 'cust', name: 'العملاء المتوقفون عن الشراء', desc: 'عملاء لم يشتروا منذ عدد أيام، مع رصيدهم', params: ['asof', 'idle'],
      run: function (p) {
        var m = custFirstLast(), n = Number(p.idle || 30), rows = [];
        Object.keys(m).forEach(function (k) { var r = m[k], last = r.last <= p.asof ? r.last : null; if (!last) return; var age = days(last, p.asof); if (age < n) return; rows.push({ name: r.name, last: last, age: age, debt: acc(k) ? balance([k], null, p.asof).close : '', _acc: acc(k) ? k : null }); });
        rows.sort(function (a, b) { return b.age - a.age; });
        return { cols: [C('name', 'العميل'), C('last', 'آخر فاتورة'), C('age', 'أيام بلا شراء', 'int'), C('debt', 'الرصيد', 'money')], rows: rows, total: sumRow(rows, [C('debt', '', 'money')]), note: 'آخر شراء قبل ' + n + ' يوماً أو أكثر' };
      } };
    R.cust_profile = { cat: 'cust', name: 'ملف العملاء الشامل', desc: 'لكل عميل: المبيعات والتحصيل والرصيد وآخر شراء ومتوسط الشراء الشهري', params: ['period', 'top'],
      run: function (p) {
        var m = custFirstLast(), coll = collections(p.from, p.to, '', true), s = {}, months = Math.max(1, days(p.from, p.to) / 30.4);
        salesBy(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }).forEach(function (r) { s[r.k] = r; });
        var rows = recvIds().map(function (k) { var r = s[k] || {}, b = balance([k], null, p.to).close; return { name: accName(k), net: r.net || 0, n: r.n || 0, avgm: (r.net || 0) / months, coll: coll[k] || 0, cr: pct(coll[k] || 0, r.net || 0), bal: b, last: (m[k] || {}).last || '', lim: custLimit(k) || '', _acc: k }; })
          .filter(function (r) { return r.net || r.coll || Math.abs(r.bal) > 0.0005; }).sort(function (a, b) { return b.net - a.net; });
        var cols = [C('name', 'العميل'), C('n', 'الفواتير', 'int'), C('net', 'صافي المبيعات', 'money'), C('avgm', 'متوسط شهري', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'نسبة التحصيل', 'pct'), C('bal', 'الرصيد', 'money'), C('lim', 'حد الائتمان', 'money'), C('last', 'آخر شراء')];
        return topN({ cols: cols, rows: rows, total: sumRow(rows, cols) }, p);
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
    R.recv_balances = { cat: 'debts', name: 'أرصدة العملاء (المديونيات)', desc: 'ما على كل عميل في تاريخ محدد مع آخر حركة وآخر تحصيل', params: ['asof', 'nonzero'], run: function (p) { return partyBalances(recvIds(), p, 1, 'العميل'); } };
    R.pay_balances = { cat: 'debts', name: 'أرصدة الموردين', desc: 'ما للموردين على الشركة في تاريخ محدد', params: ['asof', 'nonzero'], run: function (p) { return partyBalances(payIds(), p, -1, 'المورد'); } };
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
    R.recv_aging = { cat: 'debts', name: 'أعمار ديون العملاء', desc: 'توزيع مديونية كل عميل حسب عمرها (يُخصم التحصيل من أقدم دين)', params: ['asof'], run: function (p) { return aging(recvIds(), p.asof, 1); } };
    R.pay_aging = { cat: 'debts', name: 'أعمار أرصدة الموردين', desc: 'توزيع ما للموردين حسب عمره', params: ['asof'], run: function (p) { return aging(payIds(), p.asof, -1); } };
    R.debt_movement = { cat: 'debts', name: 'حركة المديونيات اليومية والأسبوعية والشهرية', desc: 'رصيد أول المدة والزيادة والتحصيل ورصيد آخر المدة لمجموع العملاء', params: ['period', 'gran'],
      run: function (p) {
        var g = p.gran || 'day', ids = recvIds(), set = {};
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
        return { cols: cols, rows: rows, total: tot, chart: { type: 'line', x: 'name', y: ['close'], yl: ['رصيد المديونية'] } };
      } };
    R.collections_cust = { cat: 'debts', name: 'التحصيل حسب العميل', desc: 'المحصّل من كل عميل نقداً وتحويلاً ونسبته من مبيعاته', params: ['period', 'top'],
      run: function (p) {
        var cash = collections(p.from, p.to, 'صندوق', true), bank = collections(p.from, p.to, 'بنك', true), all = collections(p.from, p.to, '', true), s = {};
        salesBy(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }).forEach(function (r) { s[r.k] = r; });
        var rows = uniq(Object.keys(all).concat(Object.keys(s))).map(function (k) { var tot = all[k] || 0, sl = (s[k] || {}).net || 0; return { name: custName(k), cash: cash[k] || 0, bank: bank[k] || 0, tot: tot, sales: sl, cr: pct(tot, sl), bal: acc(k) ? balance([k], null, p.to).close : '', _acc: acc(k) ? k : null }; })
          .filter(function (r) { return r.tot || r.sales; }).sort(function (a, b) { return b.tot - a.tot; });
        var cols = [C('name', 'العميل'), C('cash', 'نقداً (صناديق)', 'money'), C('bank', 'تحويل (بنوك)', 'money'), C('tot', 'إجمالي التحصيل', 'money'), C('sales', 'صافي المبيعات', 'money'), C('cr', 'نسبة التحصيل', 'pct'), C('bal', 'الرصيد', 'money')];
        var t = sumRow(rows, cols); t.cr = pct(t.tot, t.sales);
        return topN({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['tot'], yl: ['التحصيل'], limit: 12 }, note: activeBoxes().length ? '' : 'عرّف الصناديق والبنوك ليُفصل النقدي عن التحويل' }, p);
      } };
    R.collections_daily = { cat: 'debts', name: 'التحصيل اليومي والشهري', desc: 'التحصيل نقداً وتحويلاً لكل يوم أو شهر مع المبيعات', params: ['period', 'gran'],
      run: function (p) {
        var g = p.gran || 'day', rows = [], b = {};
        var add = function (map, f) { Object.keys(map).forEach(function (d) { var k = bucket(d, g), r = b[k] || (b[k] = { k: k, cash: 0, bank: 0, tot: 0, sales: 0 }); r[f] += map[d]; }); };
        add(collections(p.from, p.to, 'صندوق', 'day'), 'cash'); add(collections(p.from, p.to, 'بنك', 'day'), 'bank'); add(collections(p.from, p.to, '', 'day'), 'tot');
        var sd = {}; facts('s', p.from, p.to).forEach(function (x) { sd[x.d] = (sd[x.d] || 0) + x.s * x.val; }); add(sd, 'sales');
        Object.keys(b).sort().forEach(function (k) { var r = b[k]; rows.push({ name: bucketLabel(k, g), cash: r.cash, bank: r.bank, tot: r.tot, sales: r.sales, cr: pct(r.tot, r.sales) }); });
        var cols = [C('name', 'الفترة'), C('cash', 'نقداً', 'money'), C('bank', 'تحويل', 'money'), C('tot', 'الإجمالي', 'money'), C('sales', 'صافي المبيعات', 'money'), C('cr', 'نسبة التحصيل', 'pct')];
        var t = sumRow(rows, cols); t.cr = pct(t.tot, t.sales);
        return { cols: cols, rows: rows, total: t, chart: { type: 'bar', x: 'name', y: ['tot', 'sales'], yl: ['التحصيل', 'المبيعات'] } };
      } };
    R.credit_limit = { cat: 'debts', name: 'العملاء المتجاوزون لحد الائتمان', desc: 'من تجاوز رصيده حد الائتمان المحدد في سراج', params: ['asof'],
      run: function (p) {
        var rows = recvIds().map(function (k) { var lim = custLimit(k), b = balance([k], null, p.asof).close; return { name: accName(k), lim: lim, bal: b, over: b - lim, pc: pct(b, lim), _acc: k }; }).filter(function (r) { return r.lim && r.bal > r.lim; }).sort(function (a, b) { return b.over - a.over; });
        return { cols: [C('name', 'العميل'), C('lim', 'حد الائتمان', 'money'), C('bal', 'الرصيد', 'money'), C('over', 'التجاوز', 'money'), C('pc', 'من الحد', 'pct')], rows: rows, total: sumRow(rows, [C('lim', '', 'money'), C('bal', '', 'money'), C('over', '', 'money')]), empty: 'لا يوجد عملاء متجاوزون لحد الائتمان (أو لم تُحدد حدود في سراج)' };
      } };

    /* ---------- الصناديق والبنوك ---------- */
    function vouchers(kind, p) {
      var rows = [], bx = boxIds();
      entriesIn(p.from, p.to, function (l) { return l.k === kind; }).forEach(function (l) {
        var ls = F.D.byEntry[l.e], tot = entryTotal(ls);
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
    R.receipts = { cat: 'cash', name: 'سندات القبض', desc: 'كل سند قبض بمبلغه ومصدره، أو مجمّعة', params: ['period', 'vby'], run: function (p) { return vouchers('r', p); } };
    R.payments = { cat: 'cash', name: 'سندات الدفع', desc: 'كل سند دفع بمبلغه وجهته، أو مجمّعة', params: ['period', 'vby'], run: function (p) { return vouchers('p', p); } };

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
      var vals = pc.map(function (c) { return evalList(rows, c.from, c.to); });
      var tot = multi && def.total !== false ? evalList(rows, p.from, p.to) : null;
      var errs = [];
      var out = rows.map(function (r, i) {
        if (!r.f) return { name: r.name, _b: true, _hl: true };
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
          var had = !!F.D, rev = F.rev, nb = JSON.stringify([F.boxes, F.reports, F.config]);
          // التحديث التلقائي لا يعيد رسم الشاشة إلا إذا وصل جديد، حتى لا يقطع ما يكتبه المستخدم
          if (quiet && had && F.lastPull && Date.now() - F.lastPull < 180000) return Promise.resolve(false);
          if (quiet && F.dirty) return Promise.resolve(false);
          F.quiet = quiet;
          return load(false).then(function () { return !had || F.rev !== rev || nb !== JSON.stringify([F.boxes, F.reports, F.config]); });
        },
        html: function () {
          if (F.sub !== sub) { F.sub = sub; if (sub !== 'reports') F.cur = null; }
          var h = '';
          if (!F.D && F.error && !F.loading) return '<div class="card empty"><p>تعذّر تحميل البيانات المالية: ' + esc(F.error) + '</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' إعادة المحاولة</button></div>';
          if (!F.D && F.rows && !Object.keys(F.rows).length && !F.loading && F.meta) return '<div class="card empty"><p>لم تصل بيانات مالية من الوكيل بعد.</p><p class="small muted">بعد إعداد الوكيل على جهاز سراج بمفتاح المنظومة المالية سيرسل القيود والفواتير تلقائياً خلال دقائق.</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' تحقق الآن</button></div>';
          if (!F.D) return '<div class="card loading"><span class="spin"></span> <span id="finprog">' + esc(F.progress || 'جارٍ تحميل البيانات المالية… أول مرة قد تستغرق دقيقة') + '</span></div>';
          h += syncLine();
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

    function syncLine() {
      var m = F.meta || {}, ck = m.check || {};
      var lb = m.agent && m.agent.last_beat;
      return '<div class="row small muted fin-sync"><span>آخر بيانات مالية من سراج: ' + (m.last ? N(String(m.last).slice(0, 16)) : '—') + '</span>' +
        (ck.balanced === false ? '<span class="badge b-flag">القيود غير متوازنة في سراج</span>' : ck.balanced ? '<span class="badge b-delivered">القيود متوازنة ✓</span>' : '') +
        (lb ? '<span>الوكيل: ' + N(String(lb).slice(11, 16)) + '</span>' : '') + '<button class="btn sm ghost" data-frefresh>' + ICON.refresh + ' تحديث البيانات</button></div>';
    }

    /* ---------- لوحة المؤشرات (بطاقات بالمعادلات) ---------- */
    var DASH_PRESETS = PRESETS.filter(function (p) { return ['today', 'yesterday', 'week', 'month', 'lastmonth', 'quarter', 'year', 'custom'].indexOf(p[0]) >= 0; });
    function cardHTML(c, r, pr, i) {
      var v = r.err ? null : r.v, pv = pr && !pr.err ? pr.v : null;
      var ch = c.cmp && pv ? (v - pv) / Math.abs(pv) * 100 : null, good = c.good === 'down' ? ch < 0 : ch > 0;
      return '<' + (c.rep && R[c.rep] ? 'button data-crep="' + esc(c.rep) + '"' : 'div') + ' class="kpi fin-kpi' + (c.rep && R[c.rep] ? ' tap' : '') + '" title="' + esc(c.f) + '"><span>' + esc(c.name) + '</span>' +
        (r.err ? '<b class="num">—</b><small class="down">خطأ في المعادلة: ' + esc(r.err) + '</small>' : '<b class="num">' + fmtVal(v, c.fmt || 'money0') + '</b>') +
        (ch !== null && isFinite(ch) ? '<small class="' + (Math.abs(ch) < 0.05 ? '' : good ? 'up' : 'down') + '">' + (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + fp(Math.abs(ch)) + ' عن الفترة السابقة</small>' : c.cmp ? '<small class="muted">لا مقارنة</small>' : '') +
        (c.sub && r.sub !== null && r.sub !== undefined ? '<small class="muted">' + fmtVal(r.sub, c.subfmt || 'int') + ' ' + esc(c.subl || '') + '</small>' : '') + '</' + (c.rep && R[c.rep] ? 'button' : 'div') + '>';
    }
    function dashRange() { return presetRange(F.dashPer, F.dashFrom, F.dashTo); }
    function dashHTML() {
      var r = dashRange(), pr = prevRange(r[0], r[1], F.dashPer), list = cards();
      F.lastRange = r;
      var cur = evalList(list, r[0], r[1]), prev = list.some(function (c) { return c.cmp; }) ? evalList(list, pr[0], pr[1]) : [];
      var h = '<div class="card"><div class="row" style="align-items:center"><div class="chips grow">' + DASH_PRESETS.map(function (pp) { return '<button class="chip' + (F.dashPer === pp[0] ? ' on' : '') + '" data-dper="' + pp[0] + '">' + pp[1] + '</button>'; }).join('') + '</div>' +
        (canEdit() ? '<button class="btn sm ghost" data-custom>تخصيص البطاقات</button>' : '') + '</div>' +
        (F.dashPer === 'custom' ? '<div class="row" style="margin-top:10px"><input type="date" class="input num" id="dfrom" value="' + r[0] + '" style="max-width:180px"><input type="date" class="input num" id="dto" value="' + r[1] + '" style="max-width:180px"></div>' : '') +
        '<div class="small muted" style="margin-top:6px">' + perLabel(r[0], r[1]) + ' · مقارنة بـ ' + perLabel(pr[0], pr[1]) + '</div></div>';
      h += '<div class="kpis fin-kpis">' + list.map(function (c, i) { return cardHTML(c, cur[i], prev[i], i); }).join('') + '</div>';
      // منحنى آخر 6 أشهر
      var months = [], m0 = r[1].slice(0, 7);
      for (var i = 5; i >= 0; i--) { var mm = m0, k = i; while (k-- > 0) mm = addD(mm + '-01', -1).slice(0, 7); months.push(mm); }
      var series = months.map(function (mm) { var e = monthEnd(mm) > r[1] ? r[1] : monthEnd(mm); return { name: MONTHS[+mm.slice(5, 7) - 1], net: salesStats(mm + '-01', e).net, coll: collections(mm + '-01', e, '') }; });
      h += '<div class="grid2"><div class="card"><h3>صافي المبيعات والتحصيل · آخر 6 أشهر</h3>' + chartSVG({ type: 'bar', x: 'name', y: ['net', 'coll'], yl: ['صافي المبيعات', 'التحصيل'] }, series) + '</div>';
      var top = R.sales_cust.run({ from: r[0], to: r[1], top: 7 }).rows;
      h += '<div class="card"><h3>أعلى العملاء مبيعاً في الفترة</h3>' + (top.length ? chartSVG({ type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] }, top) : '<p class="muted">لا مبيعات في الفترة</p>') + '</div></div>';
      h += '<div class="card"><h3>تقارير سريعة</h3><div class="chips">' + [['exec_summary', 'الملخص التنفيذي'], ['sales_item', 'المبيعات حسب الصنف'], ['sales_cust', 'المبيعات حسب العميل'], ['collections_daily', 'التحصيل اليومي'],
        ['recv_aging', 'أعمار الديون'], ['stock_balance', 'أرصدة المخزون'], ['boxes', 'الصناديق والبنوك'], ['income', 'قائمة الدخل']].map(function (x) { return '<button class="chip" data-open="' + x[0] + '"' + (R[x[0]].params.indexOf('period') >= 0 ? ' data-per="' + esc(F.dashPer) + '"' : '') + '>' + x[1] + '</button>'; }).join('') +
        '<button class="chip" data-gosub="daily">التقرير اليومي للإدارة</button></div></div>';
      return h;
    }
    function bindDash(m) {
      qa('[data-dper]', m).forEach(function (b) { b.onclick = function () { F.dashPer = b.dataset.dper; A.render(); }; });
      var df = q('#dfrom', m), dt = q('#dto', m);
      if (df) df.onchange = dt.onchange = function () { F.dashFrom = df.value; F.dashTo = dt.value; A.render(); };
      qa('[data-crep]', m).forEach(function (b) { b.onclick = function () { var r = dashRange(), def = R[b.dataset.crep]; openReport(b.dataset.crep, def.params.indexOf('period') >= 0 ? { preset: F.dashPer, from: r[0], to: r[1] } : { asof: r[1] }); }; });
      qa('[data-gosub]', m).forEach(function (b) { b.onclick = function () { go(b.dataset.gosub); }; });
      var cu = q('[data-custom]', m);
      if (cu) cu.onclick = function () { F.setTab = 'cards'; go('settings'); };
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
      var vals = cols.map(function (c) { return evalList(def.rows, c.from, c.to); });
      return { def: def, cols: cols, vals: vals, date: F.dailyDate || F.D.maxDate || today() };
    }
    function dailyTable(D, cls) {
      return '<table class="' + cls + '"><thead><tr><th class="dh-s">Subject</th>' + D.cols.map(function (c) { return '<th class="dh-d">' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        D.def.rows.map(function (r, i) {
          if (!r.f) return '<tr class="dsep"><th colspan="' + (D.cols.length + 1) + '">' + esc(r.name) + '</th></tr>';
          return '<tr><th class="dl">' + esc(r.name) + '</th>' + D.vals.map(function (v) { var x = v[i]; return '<td class="dv"' + (x.err ? ' title="' + esc(x.err) + '"' : '') + '>' + (x.err ? '<span class="derr">خطأ</span>' : fmtVal(x.v, r.fmt || 'dec2')) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }
    function dailyHTML() {
      var D = dailyData(), errs = [];
      D.def.rows.forEach(function (r, i) { D.vals.forEach(function (v) { if (v[i].err && errs.indexOf(r.name) < 0) errs.push(r.name); }); });
      var h = '<div class="card"><div class="row fin-head" style="align-items:flex-end"><div class="grow"><h2 style="margin:0">' + esc(D.def.title || 'التقرير اليومي للإدارة') + '</h2><div class="small muted">كل الأرقام محسوبة من بيانات سراج بالمعادلات المحددة لكل سطر</div></div>' +
        '<button class="btn sm" data-dxls>Excel</button><button class="btn sm" data-dprt>' + ICON.print + ' طباعة / PDF</button>' + (canEdit() ? '<button class="btn sm ghost" data-dcustom>تخصيص الأسطر</button>' : '') + '</div>' +
        '<div class="row fin-params"><label class="field fin-param"><span class="lbl">التاريخ</span><input type="date" class="input num" id="ddate" value="' + D.date + '"></label>' +
        '<label class="field fin-param"><span class="lbl">الأعمدة</span><select class="input" id="dmode"><option value="day"' + (F.dailyMode !== 'days7' ? ' selected' : '') + '>اليوم المحدد</option><option value="days7"' + (F.dailyMode === 'days7' ? ' selected' : '') + '>آخر 7 أيام (عمود لكل يوم)</option></select></label>' +
        '<label class="chk fin-param" style="align-self:center"><input type="checkbox" id="dmtd"' + (F.dailyMtd ? ' checked' : '') + '> إضافة عمود «من بداية الشهر»</label>' +
        '<div class="fin-param" style="flex:0 0 auto"><button class="btn sm ghost" data-dprev>→ اليوم السابق</button> <button class="btn sm ghost" data-dnext>اليوم التالي ←</button></div></div>' +
        (errs.length ? '<div class="msg err" style="margin-top:8px">أسطر فيها خطأ: ' + esc(errs.join('، ')) + (canEdit() ? '. صحّحها من «تخصيص الأسطر».' : '') + '</div>' : '') + '</div>';
      h += '<div class="card scroll-x"><div class="daily-wrap">' + dailyTable(D, 'daily') + '</div>' +
        '<p class="small muted" style="margin:10px 0 0">الكميات والأرصدة (المخزون والمديونية والحسابات) في نهاية اليوم، والمبيعات والتحصيل لليوم نفسه. عمود «من بداية الشهر» يجمع حركة الشهر حتى التاريخ.</p></div>';
      return h;
    }
    function bindDaily(m) {
      var setD = function (d) { F.dailyDate = d; A.render(); };
      q('#ddate', m).onchange = function () { if (this.value) setD(this.value); };
      q('#dmode', m).onchange = function () { F.dailyMode = this.value; A.render(); };
      q('#dmtd', m).onchange = function () { F.dailyMtd = this.checked; A.render(); };
      q('[data-dprev]', m).onclick = function () { setD(addD(F.dailyDate || F.D.maxDate || today(), -1)); };
      q('[data-dnext]', m).onclick = function () { setD(addD(F.dailyDate || F.D.maxDate || today(), 1)); };
      var cu = q('[data-dcustom]', m);
      if (cu) cu.onclick = function () { F.setTab = 'daily'; go('settings'); };
      q('[data-dxls]', m).onclick = function () { exportDaily(); };
      q('[data-dprt]', m).onclick = function () {
        var D = dailyData(), P = document.getElementById('print');
        P.innerHTML = '<div class="p-rep p-daily"><div class="p-head"><img src="logo.png" alt=""><div class="t"><b>' + esc(D.def.title || 'التقرير اليومي للإدارة') + '</b><span>شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + esc(D.date) + '</span></div><span class="p-copy">' + esc('طُبع ' + RK.nowStr().slice(0, 16)) + '</span></div>' +
          dailyTable(D, 'daily pd') + '<p class="p-note">من بيانات سراج حتى ' + esc((F.meta && F.meta.last) || '') + '</p></div>';
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
        put(1, 0, xcell('شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + D.date, { font: XS.font({ color: { rgb: '595959' } }) }));
        R0 = 3;
        var hs = { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }), fill: { fgColor: { rgb: 'ED7D31' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: XS.border };
        put(R0, 0, xcell('Subject', hs)); D.cols.forEach(function (c, j) { put(R0, j + 1, xcell(c.l, Object.assign({}, hs))); });
        D.def.rows.forEach(function (r, i) {
          var rr = R0 + 1 + i;
          if (!r.f) { put(rr, 0, xcell(r.name, { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' } }), fill: { fgColor: { rgb: '0C4CA2' } }, border: XS.border })); for (var j = 1; j < nc; j++) put(rr, j, xcell('', { fill: { fgColor: { rgb: '0C4CA2' } }, border: XS.border })); return; }
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

    /* ---------- فهرس التقارير ---------- */
    function catalogHTML() {
      var n = Object.keys(R).length;
      var h = '<div class="card"><input class="input" id="rq" placeholder="ابحث في ' + n + ' تقريراً: مبيعات، صنف، عميل، ميزانية، مخزون…" value="' + esc(F.rq || '') + '"><div class="chips" style="margin-top:8px">' +
        CATS.map(function (c) { return '<button class="chip" data-jump="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div></div>';
      CATS.forEach(function (c) {
        var list = c[0] === 'mine' ? F.reports.map(function (r) { return { id: 'c:' + r.id, name: r.name, desc: r.def.kind === 'formula' ? 'تقرير بالمعادلات' : (DS[r.def.ds] || {}).name || '', by: r.by }; })
          : Object.keys(R).filter(function (k) { return R[k].cat === c[0]; }).map(function (k) { return { id: k, name: R[k].name, desc: R[k].desc }; });
        if (!list.length && c[0] !== 'mine') return;
        h += '<section class="fin-catsec" id="cat-' + c[0] + '"><div class="sec-title"><h2>' + c[1] + ' <span class="badge">' + list.length + '</span></h2></div><div class="fin-cat">' + (list.length ? list.map(function (r) {
          return '<button class="item tap fin-rep" data-open="' + esc(r.id) + '" data-s="' + esc(r.name + ' ' + (r.desc || '') + ' ' + c[1]) + '"><div class="main"><b>' + esc(r.name) + '</b><div class="small muted">' + esc(r.desc || '') + (r.by ? ' · أنشأه ' + esc(r.by) : '') + '</div></div></button>';
        }).join('') : '<div class="card empty small">لا توجد تقارير مخصصة بعد.' + (canEdit() ? ' أنشئ تقريرك من «تقرير مخصص».' : '') + '</div>') + '</div></section>';
      });
      return h;
    }
    function bindCatalog(m) {
      var inp = q('#rq', m);
      var apply = function () {
        var t = inp.value.trim(); F.rq = t;
        qa('.fin-rep', m).forEach(function (b) { b.hidden = !!t && b.dataset.s.indexOf(t) < 0; });
        qa('.fin-catsec', m).forEach(function (s) { s.hidden = !!t && !qa('.fin-rep', s).some(function (b) { return !b.hidden; }); });
      };
      inp.oninput = apply; if (F.rq) apply();
      qa('[data-jump]', m).forEach(function (b) { b.onclick = function () { inp.value = ''; apply(); var el = q('#cat-' + b.dataset.jump, m); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    }

    function openReport(id, params) {
      var def = id.indexOf('c:') === 0 ? F.reports.filter(function (r) { return 'c:' + r.id === id; })[0] : null;
      if (!def && !R[id]) { toast('التقرير غير موجود', true); return; }
      var t = today();
      var base = { preset: 'month', from: t.slice(0, 7) + '-01', to: t, asof: t, gran: 'day', level: 3, top: 0, rby: 'cust', vby: 'none', box: 'all', nonzero: 'nz', measure: 'value', idle: 30, boxkind: 'all', etype: 'all', flt: null };
      var saved = (st.finParams || {})[id] || {};
      var p = Object.assign(base, saved, params || {});
      if (params && params.from && params.preset && params.preset !== 'custom') { p.from = params.from; p.to = params.to; }
      F.cur = { id: id, custom: def, p: p };
      go('reports');
      window.scrollTo(0, 0);
    }

    function curDef() { var c = F.cur; return c.custom ? { name: c.custom.name, desc: c.custom.def.kind === 'formula' ? 'تقرير بالمعادلات' : (DS[c.custom.def.ds] || {}).name, params: ['period'] } : R[c.id]; }
    function runCur() {
      var c = F.cur, p = c.p;
      if (p.preset && p.preset !== 'custom') { var r = presetRange(p.preset); p.from = r[0]; p.to = r[1]; }
      return c.custom ? runCustom(c.custom.def, p) : R[c.id].run(p);
    }

    // أبعاد التصفية لكل نوع تقرير
    var FDIMS = { cust: 'العملاء', item: 'الأصناف', st: 'المخازن', ag: 'المناديب', u: 'المستخدمون', xcust: 'استثناء عملاء', xitem: 'استثناء أصناف' };
    function fdimsFor(def) { return def.cat === 'stock' ? ['item', 'st', 'xitem'] : def.cat === 'purch' ? ['cust', 'item', 'st', 'u'] : ['cust', 'item', 'st', 'ag', 'u', 'xcust', 'xitem']; }
    function fltOptions(k, def) {
      var Tt = T(), out = [];
      if (k === 'cust' || k === 'xcust') {
        var purch = def && def.cat === 'purch', seen = {};
        F.D.invs.forEach(function (v) { if ((purch ? (v.c === PUR || v.c === PRET) : (v.c === SALE || v.c === SRET)) && !seen[v.ck]) { seen[v.ck] = 1; out.push({ id: v.ck, name: v.name, sub: (acc(v.acc) || {}).code || '' }); } });
      } else if (k === 'item' || k === 'xitem') {
        var used = {}; Tt.invl.forEach(function (l) { used[l.item] = 1; });
        Object.keys(Tt.item).forEach(function (id) { if (used[id]) out.push({ id: id, name: itemName(id), sub: String(Tt.item[id].code || '') }); });
      } else if (k === 'st') Object.keys(Tt.st).forEach(function (id) { out.push({ id: id, name: storeName(id) }); });
      else if (k === 'ag') Object.keys(Tt.ag).forEach(function (id) { out.push({ id: id, name: repName(id) }); });
      else if (k === 'u') Object.keys(Tt.us).forEach(function (id) { out.push({ id: id, name: userName(id) }); });
      return out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); });
    }
    function fltBar(def, p) {
      var f = p.flt && typeof p.flt === 'object' ? p.flt : {}, dims = fdimsFor(def), any = false;
      var h = '<div class="fin-flt"><span class="small muted">تصفية:</span>' + dims.map(function (k) {
        var v = f[k] || [], on = v.length > 0; if (on) any = true;
        var lbl = def.cat === 'purch' && k === 'cust' ? 'الموردون' : FDIMS[k];
        var txt = on ? (v.length <= 2 ? v.map(function (x) { return fltName(k, x); }).join('، ') : v.length + ' محدد') : 'الكل';
        return '<button class="chip' + (on ? ' on' : '') + '" data-fk="' + k + '">' + esc(lbl) + ': ' + esc(txt) + ' ▾</button>';
      }).join('') + (any ? '<button class="chip" data-fclear>✕ مسح التصفية</button>' : '') + '</div>';
      return h;
    }

    function paramsHTML(def, p) {
      var h = '';
      var has = function (k) { return def.params.indexOf(k) >= 0; };
      if (has('period')) {
        h += '<div class="chips">' + PRESETS.map(function (pp) { return '<button class="chip' + (p.preset === pp[0] ? ' on' : '') + '" data-pp="' + pp[0] + '">' + pp[1] + '</button>'; }).join('') + '</div>';
        if (p.preset === 'custom') h += '<div class="row"><label class="small">من <input type="date" class="input num" data-pk="from" value="' + p.from + '"></label><label class="small">إلى <input type="date" class="input num" data-pk="to" value="' + p.to + '"></label></div>';
      }
      var sel = function (k, label, opts) { return '<label class="field fin-param"><span class="lbl">' + label + '</span><select class="input" data-pk="' + k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(p[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; };
      var row = '';
      if (has('asof')) row += '<label class="field fin-param"><span class="lbl">في تاريخ</span><input type="date" class="input num" data-pk="asof" value="' + p.asof + '"></label>';
      if (has('asof2')) row += '<label class="field fin-param"><span class="lbl">مقارنة بتاريخ</span><input type="date" class="input num" data-pk="asof2" value="' + esc(p.asof2 || addD(p.asof.slice(0, 4) + '-01-01', -1)) + '"></label>';
      if (has('gran')) row += sel('gran', 'التجميع', GRAN);
      if (has('level')) row += sel('level', 'المستوى', [[1, 'المستوى 1'], [2, 'المستوى 2'], [3, 'المستوى 3'], [4, 'المستوى 4'], [5, 'المستوى 5'], [6, 'كل المستويات']]);
      if (has('top')) row += sel('top', 'العرض', [[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50'], [100, 'أعلى 100']]);
      if (has('measure')) row += sel('measure', 'القيمة', [['value', 'صافي المبيعات (د.ل)'], ['qty', 'الكمية']]);
      if (has('rby')) row += sel('rby', 'حسب', [['cust', 'العميل'], ['item', 'الصنف']]);
      if (has('vby')) row += sel('vby', 'العرض', [['none', 'كل سند (تفصيلي)'], ['box', 'مجمّع حسب الصندوق/البنك'], ['party', 'مجمّع حسب الطرف'], ['day', 'مجمّع حسب اليوم']]);
      if (has('nonzero')) row += sel('nonzero', 'الأرصدة', [['nz', 'غير الصفرية فقط'], ['all', 'الكل']]);
      if (has('idle')) row += sel('idle', 'بلا شراء منذ', [[15, '15 يوماً'], [30, '30 يوماً'], [60, '60 يوماً'], [90, '90 يوماً'], [180, '180 يوماً']]);
      if (has('etype')) row += sel('etype', 'نوع القيد', [['all', 'الكل'], ['r', 'سندات القبض'], ['p', 'سندات الدفع'], ['j', 'قيود يومية'], ['i', 'قيود الفواتير'], ['o', 'افتتاحي']]);
      if (has('boxkind')) row += sel('boxkind', 'النوع', [['all', 'الصناديق والبنوك'], ['صندوق', 'الصناديق فقط'], ['بنك', 'البنوك فقط']]);
      if (has('box')) row += sel('box', 'الصندوق/البنك', [['all', 'كل الصناديق والبنوك (ملخص)']].concat(activeBoxes().map(function (b) { return [b.acc, b.name]; })));
      if (has('search')) row += '<label class="field fin-param"><span class="lbl">بحث</span><input class="input" data-pk="search" value="' + esc(p.search || '') + '" placeholder="رقم أو اسم"></label>';
      if (has('account')) row += '<div class="field fin-param" style="flex:2"><span class="lbl">الحساب</span><button class="input" data-accpick style="text-align:start">' + (p.account ? esc(acc(p.account) ? acc(p.account).code + ' · ' + acc(p.account).name : '—') : 'اختر الحساب…') + '</button></div>';
      if (row) h += '<div class="row fin-params">' + row + '</div>';
      if (has('flt')) h += fltBar(def, p);
      return h;
    }

    function reportHTML() {
      var c = F.cur, def = curDef();
      if (!def) { F.cur = null; return catalogHTML(); }
      var res;
      try { res = runCur(); } catch (e) { res = { cols: [], rows: [], empty: 'تعذّر إعداد التقرير: ' + e.message }; if (window.console) console.error(e); }
      c.res = res;
      var p = c.p;
      var h = '<div class="card"><div class="row fin-head"><button class="btn sm ghost" data-back>→ التقارير</button><div class="grow"><h2 style="margin:0">' + esc(res.title || def.name) + '</h2><div class="small muted">' + esc(def.desc || '') + '</div></div>' +
        '<button class="btn sm" data-xls>Excel</button><button class="btn sm" data-prt>' + ICON.print + ' طباعة / PDF</button>' + (c.custom && canEdit() ? '<button class="btn sm ghost" data-edit>تعديل</button>' : '') + '</div>' +
        '<div style="margin-top:10px">' + paramsHTML(def, p) + '</div>' +
        '<div class="small muted" style="margin-top:6px">' + (def.params.indexOf('asof') >= 0 ? 'في ' + N(p.asof) : def.params.indexOf('period') >= 0 ? perLabel(p.from, p.to) : '') + (res.note ? ' · ' + esc(res.note) : '') + '</div></div>';
      if (res.empty) return h + '<div class="card empty">' + esc(res.empty) + '</div>';
      if (res.chart && (res.chart.rowsOverride || res.rows.length > 1)) h += '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>';
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
      qa('[data-pp]', m).forEach(function (b) { b.onclick = function () { p.preset = b.dataset.pp; save(); A.render(); }; });
      qa('[data-pk]', m).forEach(function (el) {
        el.addEventListener('change', function () { p[el.dataset.pk] = el.value; if (el.dataset.pk === 'from' || el.dataset.pk === 'to') p.preset = 'custom'; save(); A.render(); });
      });
      var ap = q('[data-accpick]', m);
      if (ap) ap.onclick = function () { pickAccount({ title: 'اختر الحساب', any: true }).then(function (id) { if (id) { p.account = id; save(); A.render(); } }); };
      qa('[data-fk]', m).forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.fk, f = p.flt && typeof p.flt === 'object' ? p.flt : {};
          pickMulti({ title: 'تصفية: ' + (def.cat === 'purch' && k === 'cust' ? 'الموردون' : FDIMS[k]), options: fltOptions(k, def), value: f[k] || [] }).then(function (v) {
            if (!v) return; f = Object.assign({}, f); f[k] = v; p.flt = f; save(); A.render();
          });
        };
      });
      var fc = q('[data-fclear]', m);
      if (fc) fc.onclick = function () { p.flt = null; save(); A.render(); };
      qa('th[data-sort]', m).forEach(function (th) { th.onclick = function () { var k = th.dataset.sort; c.sort = c.sort && c.sort.k === k ? { k: k, dir: -c.sort.dir } : { k: k, dir: -1 }; A.render(); }; });
      qa('tr[data-acc]', m).forEach(function (tr) { tr.onclick = function () { var asof = def.params.indexOf('asof') >= 0; openReport('statement', { account: tr.dataset.acc, preset: asof ? 'custom' : p.preset, from: asof ? p.asof.slice(0, 4) + '-01-01' : p.from, to: asof ? p.asof : p.to }); }; });
      qa('tr[data-box]', m).forEach(function (tr) { tr.onclick = function () { p.box = tr.dataset.box; save(); A.render(); }; });
      q('[data-xls]', m).onclick = function () { exportXLSX(c.res, def.name, p); };
      q('[data-prt]', m).onclick = function () { printReport(c.res, def.name, p); };
      var ed = q('[data-edit]', m);
      if (ed) ed.onclick = function () { F.custom = JSON.parse(JSON.stringify(c.custom)); F.preview = true; go('builder'); };
    }

    /* ---------- التصدير والطباعة ---------- */
    function periodText(p, def) { return def.params.indexOf('asof') >= 0 ? 'في ' + p.asof : def.params.indexOf('period') >= 0 ? (p.from === p.to ? p.from : 'من ' + p.from + ' إلى ' + p.to) : ''; }
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
    // اختيار متعدد من قائمة (عملاء، أصناف، مخازن…)
    function pickMulti(opts) {
      return new Promise(function (res) {
        var sel = (opts.value || []).map(String);
        sheet(opts.title || 'اختر', '<input class="input" id="mq" placeholder="ابحث بالاسم أو الرمز"><div class="row small" style="margin-top:6px"><span class="muted grow" id="mn"></span><button class="btn sm ghost" data-all>تحديد الظاهر</button><button class="btn sm ghost" data-none>مسح الكل</button></div>' +
          '<div class="list acc-list" id="ml"></div><button class="btn primary big" data-ok>تطبيق</button>', function (s) {
          var inp = q('#mq', s.el), ml = q('#ml', s.el), shown = [];
          function draw() {
            var t = inp.value.trim();
            var list = opts.options.filter(function (o) { return !t || (o.name + ' ' + (o.sub || '') + ' ' + o.id).indexOf(t) >= 0; });
            list.sort(function (a, b) { return (sel.indexOf(String(b.id)) >= 0) - (sel.indexOf(String(a.id)) >= 0); });
            shown = list.slice(0, 400);
            q('#mn', s.el).textContent = sel.length + ' محدد من ' + opts.options.length + (list.length > shown.length ? ' · يظهر ' + shown.length + ' من ' + list.length + '، استعمل البحث' : '');
            ml.innerHTML = shown.map(function (o) { var on = sel.indexOf(String(o.id)) >= 0; return '<button class="item tap acc-it' + (on ? ' sel' : '') + '" data-o="' + esc(o.id) + '"><div class="main"><b>' + esc(o.name) + '</b>' + (o.sub ? '<div class="meta"><span class="num">' + esc(o.sub) + '</span></div>' : '') + '</div>' + (on ? '✓' : '') + '</button>'; }).join('') || '<p class="muted">لا نتائج</p>';
            qa('[data-o]', ml).forEach(function (b) { b.onclick = function () { var id = b.dataset.o, i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); draw(); }; });
          }
          inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
          q('[data-all]', s.el).onclick = function () { shown.forEach(function (o) { if (sel.indexOf(String(o.id)) < 0) sel.push(String(o.id)); }); draw(); };
          q('[data-none]', s.el).onclick = function () { sel = []; draw(); };
          q('[data-ok]', s.el).onclick = function () { s.done = true; s.close(); res(sel); };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }

    /* ---------- محرر المعادلة (للبطاقات وأسطر التقرير اليومي والتقارير بالمعادلات) ---------- */
    function insertAt(ta, text) {
      var a = ta.selectionStart || ta.value.length, b = ta.selectionEnd || a;
      ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
      var pos = a + text.length; var k = text.indexOf('()'); if (k >= 0 && /\(\)$/.test(text)) pos = a + text.length - 1;
      ta.focus(); ta.setSelectionRange(pos, pos); ta.dispatchEvent(new Event('input'));
    }
    function fnHelpHTML() {
      var groups = {};
      FN.forEach(function (f) { (groups[f.grp] = groups[f.grp] || []).push(f); });
      return Object.keys(groups).map(function (g) {
        return '<details class="fn-grp"><summary>' + esc(g) + ' (' + groups[g].length + ')</summary><div class="fn-list">' + groups[g].map(function (f) {
          return '<button type="button" class="fn-it" data-fn="' + esc(f.ar) + '"><b>' + esc(f.ar) + '(' + esc(f.args) + ')</b><span>' + esc(f.desc) + '</span></button>';
        }).join('') + '</div></details>';
      }).join('');
    }
    function editItem(item, kind, ctx) {
      // kind: card | row | frow ; ctx: { from, to, vars, perLabel }
      return new Promise(function (res) {
        var d = Object.assign({ name: '', f: '', fmt: kind === 'card' ? 'money0' : kind === 'row' ? 'dec2' : 'money' }, item || {});
        var fmtOpts = function (v) { return FMTS.map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); };
        var repOpts = '<option value="">بدون</option>' + Object.keys(R).map(function (k) { return '<option value="' + k + '"' + (d.rep === k ? ' selected' : '') + '>' + esc(R[k].name) + '</option>'; }).join('');
        var html = '<div class="form fe">' +
          '<div class="field"><label class="lbl" for="fen">' + (kind === 'card' ? 'اسم البطاقة' : 'اسم السطر') + '</label><input id="fen" class="input" value="' + esc(d.name) + '"></div>' +
          (kind !== 'card' ? '<label class="chk"><input type="checkbox" id="fesep"' + (item && !item.f && item.name ? ' checked' : '') + '> عنوان قسم فقط (بدون رقم)</label>' : '') +
          '<div id="febody"><div class="field"><label class="lbl" for="fef">المعادلة</label><textarea id="fef" class="input fe-f" rows="3" dir="rtl" spellcheck="false">' + esc(d.f) + '</textarea>' +
          '<div class="fe-ops">' + ['+', '−', '×', '÷', '(', ')'].map(function (o) { return '<button type="button" class="chip" data-op="' + o + '">' + o + '</button>'; }).join('') +
          '<button type="button" class="chip" data-ins="acc">+ حساب</button><button type="button" class="chip" data-ins="st">+ مخزن</button><button type="button" class="chip" data-ins="cust">+ تصفية عميل</button><button type="button" class="chip" data-ins="item">+ تصفية صنف</button>' +
          (ctx.names && ctx.names.length ? '<button type="button" class="chip" data-ins="var">+ قيمة سطر سابق</button>' : '') + '</div>' +
          '<div class="fe-prev" id="fep"></div></div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="fefmt">التنسيق</label><select id="fefmt" class="input">' + fmtOpts(d.fmt) + '</select></div>' +
          (kind === 'frow' ? '<label class="chk grow" style="align-self:end"><input type="checkbox" id="feb"' + (d.bold ? ' checked' : '') + '> خط عريض</label>' : '') + '</div>' +
          (kind === 'card' ? '<div class="row"><div class="field grow"><label class="lbl" for="fes">سطر فرعي تحت الرقم (معادلة اختيارية)</label><input id="fes" class="input" dir="rtl" value="' + esc(d.sub || '') + '" placeholder="مثل: فواتير_مبيع()"></div></div>' +
            '<div class="row"><div class="field grow"><label class="lbl" for="fesl">نص بعده</label><input id="fesl" class="input" value="' + esc(d.subl || '') + '" placeholder="مثل: فاتورة"></div><div class="field grow"><label class="lbl" for="fesf">تنسيقه</label><select id="fesf" class="input">' + fmtOpts(d.subfmt || 'int') + '</select></div></div>' +
            '<div class="row"><label class="chk grow"><input type="checkbox" id="fecmp"' + (d.cmp ? ' checked' : '') + '> مقارنة بالفترة السابقة</label><div class="field grow"><label class="lbl" for="feg">الأفضل أن يكون</label><select id="feg" class="input"><option value="up"' + (d.good !== 'down' ? ' selected' : '') + '>أعلى (مثل المبيعات)</option><option value="down"' + (d.good === 'down' ? ' selected' : '') + '>أقل (مثل المديونية)</option></select></div></div>' +
            '<div class="field"><label class="lbl" for="ferep">عند الضغط على البطاقة افتح تقرير</label><select id="ferep" class="input">' + repOpts + '</select></div>' : '') +
          '</div>' +
          '<details class="fe-help"><summary>الدوال المتاحة وأمثلة</summary><div class="small" style="margin:6px 0">' +
          '<p style="margin:4px 0">• <b>[1601]</b> = رصيد الحساب 1601 مع فروعه. مثال: <code>[1601] - [2610] × 2</code></p>' +
          '<p style="margin:4px 0">• التصفية بين علامتي تنصيص: <code>مبيعات("عميل:1601001; صنف:زيت")</code> · <code>مخزون_كمية("بنغازي,سبها")</code></p>' +
          '<p style="margin:4px 0">• قيمة سطر أو بطاقة قبله باسمه بين قوسين: <code>قسمة({صافي المبيعات}, {الكمية})</code></p>' +
          '<p style="margin:4px 0">• المفاتيح: عميل، صنف، مخزن، مندوب، مستخدم، بدون_عميل، بدون_صنف. الأسماء العربية والإنجليزية للدوال كلاهما يعمل.</p></div>' + fnHelpHTML() + '</details>' +
          '<div id="feerr"></div><button class="btn primary big" id="fesv">حفظ</button></div>';
        sheet(kind === 'card' ? (item ? 'تعديل البطاقة' : 'بطاقة جديدة') : (item ? 'تعديل السطر' : 'سطر جديد'), html, function (s) {
          var ta = q('#fef', s.el), prev = q('#fep', s.el), tmr = null;
          var sep = q('#fesep', s.el);
          var syncSep = function () { if (sep) q('#febody', s.el).hidden = sep.checked; };
          if (sep) { sep.onchange = syncSep; syncSep(); }
          var preview = function () {
            var src = ta.value.trim();
            if (!src) { prev.innerHTML = '<span class="muted small">اكتب المعادلة أو اختر دالة من الأسفل</span>'; return; }
            var r = tryFormula(src, ctx.from, ctx.to, ctx.vars);
            prev.innerHTML = r.err ? '<span class="derr">✗ ' + esc(r.err) + '</span>' : '<span class="small muted">' + esc(ctx.perLabel || '') + ' = </span><b class="num">' + fmtVal(r.v, q('#fefmt', s.el).value) + '</b>';
          };
          ta.oninput = function () { clearTimeout(tmr); tmr = setTimeout(preview, 250); };
          q('#fefmt', s.el).onchange = preview;
          preview();
          qa('[data-op]', s.el).forEach(function (b) { b.onclick = function () { insertAt(ta, ' ' + b.dataset.op + ' '); }; });
          qa('[data-fn]', s.el).forEach(function (b) { b.onclick = function () { insertAt(ta, b.dataset.fn + '()'); }; });
          qa('[data-ins]', s.el).forEach(function (b) {
            b.onclick = function () {
              var k = b.dataset.ins;
              if (k === 'acc') pickAccount({ title: 'إدراج حساب في المعادلة', any: true }).then(function (id) { if (id) insertAt(ta, '[' + acc(id).code + ']'); });
              else if (k === 'var') pickMulti({ title: 'قيمة سطر سابق', options: ctx.names.map(function (n) { return { id: n, name: n }; }), value: [] }).then(function (v) { if (v && v.length) insertAt(ta, v.map(function (n) { return '{' + n + '}'; }).join(' + ')); });
              else pickMulti({ title: k === 'st' ? 'إدراج مخازن' : k === 'cust' ? 'تصفية حسب العميل' : 'تصفية حسب الصنف', options: fltOptions(k), value: [] }).then(function (v) {
                if (!v || !v.length) return;
                var names = v.map(function (x) { return k === 'st' ? storeName(x) : k === 'cust' ? ((acc(x) || {}).code || x) : x; });
                insertAt(ta, k === 'st' ? '"' + names.join(',') + '"' : '"' + (k === 'cust' ? 'عميل:' : 'صنف:') + names.join(',') + '"');
              });
            };
          });
          q('#fesv', s.el).onclick = function () {
            var o = { name: q('#fen', s.el).value.trim() };
            if (!o.name) { q('#feerr', s.el).innerHTML = '<div class="msg err">اكتب الاسم</div>'; return; }
            if (sep && sep.checked) { s.done = true; s.close(); res({ name: o.name, f: '' }); return; }
            o.f = ta.value.trim(); o.fmt = q('#fefmt', s.el).value;
            if (!o.f) { q('#feerr', s.el).innerHTML = '<div class="msg err">اكتب المعادلة</div>'; return; }
            try { parseFormula(o.f); } catch (e) { q('#feerr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; return; }
            if (kind === 'card') {
              o.id = d.id || ('c' + Date.now().toString(36));
              o.sub = q('#fes', s.el).value.trim(); o.subl = q('#fesl', s.el).value.trim(); o.subfmt = q('#fesf', s.el).value;
              if (o.sub) { try { parseFormula(o.sub); } catch (e) { q('#feerr', s.el).innerHTML = '<div class="msg err">السطر الفرعي: ' + esc(e.message) + '</div>'; return; } }
              o.cmp = q('#fecmp', s.el).checked; o.good = q('#feg', s.el).value; o.rep = q('#ferep', s.el).value;
            }
            if (kind === 'frow') o.bold = q('#feb', s.el).checked;
            s.done = true; s.close(); res(o);
          };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    // قائمة قابلة للتعديل (ترتيب، تعديل، حذف) مع القيم الحالية
    function listEditorHTML(key, list, ctx) {
      var vals = evalList(list, ctx.from, ctx.to);
      return '<div class="list fe-list">' + (list.length ? list.map(function (it, i) {
        var v = vals[i];
        return '<div class="item fe-row' + (!it.f ? ' fe-sep' : '') + '"><div class="main"><b>' + esc(it.name || '—') + '</b>' + (it.f ? '<div class="meta"><code class="fe-code">' + esc(it.f) + '</code><span>' + (v.err ? '<span class="derr">✗ ' + esc(v.err) + '</span>' : '= <b class="num">' + fmtVal(v.v, it.fmt) + '</b>') + '</span></div>' : '<div class="meta"><span>عنوان قسم</span></div>') + '</div>' +
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
    function ctxFor(list, i, from, to, label) {
      var vars = {}, names = [];
      evalList(list.slice(0, i), from, to).forEach(function (r, j) { var n = list[j].name; if (list[j].f && n) { vars[n] = r.err ? 'err' : r.v; names.push(n); } });
      return { from: from, to: to, vars: vars, names: names, perLabel: label };
    }

    /* ---------- منشئ التقرير المخصص ---------- */
    function builderHTML() {
      var d = F.custom || (F.custom = { name: '', cat: 'تقاريري', def: { ds: 'sinv', row: 'month', col: '', meas: ['net', 'profit'], chart: 'bar', top: 0, fdim: '', filter: '' } });
      var df = d.def, formula = df.kind === 'formula';
      var opt = function (list, v) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
      var h = '<div class="card"><h2>تقرير مخصص</h2><p class="small muted" style="margin:0 0 10px">صمّم تقريرك واحفظه باسم ليظهر في «تقاريري المخصصة» لكل المستخدمين.</p>' +
        '<div class="chips" style="margin-bottom:12px"><button class="chip' + (formula ? '' : ' on') + '" data-bk="data">تجميع البيانات (صفوف وأعمدة)</button><button class="chip' + (formula ? ' on' : '') + '" data-bk="formula">تقرير بالمعادلات (بنود × فترات)</button></div><div class="form">';
      if (formula) {
        var t = today();
        h += '<p class="small" style="margin:0">كل سطر معادلة (مثل قائمة الدخل الخاصة بك أو مؤشرات الإدارة)، والأعمدة فترات. يمكن استعمال الحسابات <code>[1601]</code> والدوال وقيم الأسطر السابقة <code>{الاسم}</code>.</p>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="bcols">الأعمدة</label><select id="bcols" class="input">' + opt([['single', 'عمود واحد (الفترة كاملة)'], ['month', 'عمود لكل شهر'], ['week', 'عمود لكل أسبوع'], ['day', 'عمود لكل يوم']], df.cols || 'month') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bch">الرسم (للسطر الأول)</label><select id="bch" class="input">' + opt([['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط']], df.chart || '') + '</select></div></div>' +
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
        h += '<div class="card"><div class="small muted">معاينة: ' + perLabel(p.from, p.to) + ' (يمكن تغيير الفترة بعد الحفظ)' + (res.note ? ' · ' + esc(res.note) : '') + '</div></div>' +
          (res.empty ? '<div class="card empty">' + esc(res.empty) + '</div>' : (res.chart && (res.chart.rowsOverride || res.rows.length > 1) ? '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>' : '') + '<div class="card scroll-x fin-table">' + tableHTML(res) + '</div>');
      }
      return h;
    }
    function bindBuilder(m) {
      var d = F.custom, df = d.def;
      d._upd = null;
      var nm = q('#bname', m); nm.oninput = function () { d.name = this.value; };
      qa('[data-bk]', m).forEach(function (b) {
        b.onclick = function () {
          if ((b.dataset.bk === 'formula') === (df.kind === 'formula')) return;
          d.def = df = b.dataset.bk === 'formula' ? { kind: 'formula', cols: 'month', chart: '', rows: [{ name: 'صافي المبيعات', f: 'مبيعات()', fmt: 'money' }, { name: 'مجمل الربح', f: 'ربح()', fmt: 'money' }, { name: 'هامش الربح', f: 'نسبة({مجمل الربح}, {صافي المبيعات})', fmt: 'pct' }] }
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
        if (df.kind === 'formula' && !(df.rows || []).some(function (r) { return r.f; })) { toast('أضف سطراً فيه معادلة', true); return; }
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
    var SET_TABS = [['boxes', 'الصناديق والبنوك'], ['cards', 'بطاقات لوحة المؤشرات'], ['daily', 'التقرير اليومي'], ['groups', 'مجموعات الحسابات'], ['data', 'البيانات']];
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
        h += '<div class="card"><h2>بطاقات لوحة المؤشرات</h2><p class="small muted" style="margin:0 0 10px">كل بطاقة معادلة تحسب للفترة المختارة في اللوحة. القيم الظاهرة هنا لهذا الشهر. مثال: <code>[1601] - [2610] × [1701]</code> أو <code>مبيعات("مخزن:بنغازي")</code>.</p>' +
          listEditorHTML('cards', cl, { from: r[0], to: r[1] }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-cadd>+ بطاقة</button><span class="grow"></span><button class="btn ghost" data-creset>استعادة الافتراضي</button><button class="btn accent" data-csave' + (F.dirtyKeys && F.dirtyKeys.cards ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>';
      } else if (tab === 'daily') {
        var dd = editDraft('daily'), d0 = F.D.maxDate || today();
        h += '<div class="card"><h2>التقرير اليومي للإدارة</h2><p class="small muted" style="margin:0 0 10px">رتّب الأسطر وغيّر معادلة كل سطر. القيم الظاهرة هنا ليوم ' + N(d0) + '.</p>' +
          '<div class="field"><label class="lbl" for="dtitle">عنوان التقرير</label><input id="dtitle" class="input" value="' + esc(dd.title || '') + '"></div>' +
          listEditorHTML('daily', dd.rows, { from: d0, to: d0 }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-dadd>+ سطر</button><button class="btn ghost" data-dsep>+ عنوان قسم</button><span class="grow"></span><button class="btn ghost" data-dreset>استعادة الافتراضي</button><button class="btn accent" data-dsave' + (F.dirtyKeys && F.dirtyKeys.daily ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>' +
          '<div class="card"><h3>ملاحظة عن Sell-Out</h3><p class="small" style="margin:0">«Total Sell-Out» افتراضياً = صافي الكمية المباعة لكل العملاء. إذا كان المقصود مبيعات فئة معينة فقط (مثلاً بدون الوكلاء أو من مخزن واحد) عدّل المعادلة، مثل: <code>كمية_مبيعات("مخزن:المستودع الرئيسي")</code> أو <code>كمية_مبيعات("بدون_عميل:1602")</code>.</p></div>';
      } else if (tab === 'groups') {
        h += '<div class="card"><h2>مجموعات الحسابات</h2><div class="form">' +
          '<div class="field"><span class="lbl">حسابات العملاء (للمديونيات وأعمار الديون والتحصيل)</span><button class="input" data-grp="recv" style="text-align:start">' + esc(grpLabel(s.recv || '1601')) + '</button><span class="small muted">' + fk(recvIds().length) + ' حساب عميل</span></div>' +
          '<div class="field"><span class="lbl">حسابات الموردين</span><button class="input" data-grp="pay" style="text-align:start">' + esc(grpLabel(s.pay || '261')) + '</button><span class="small muted">' + fk(payIds().length) + ' حساب مورد</span></div>' +
          '<div class="field"><label class="lbl" for="fys">بداية السنة المالية</label><input type="date" class="input num" id="fys" value="' + esc(s.year_start || '2026-01-01') + '" style="max-width:200px"></div></div></div>';
      } else {
        h += '<div class="card"><h2>البيانات على هذا الجهاز</h2><p class="small" style="margin:0">' + fk(Object.keys(F.rows || {}).length) + ' سجل · آخر مزامنة ' + esc((F.meta && F.meta.last) || '—') + '</p><p class="small muted">تُحفظ البيانات المالية على هذا الجهاز لتعمل التقارير بسرعة وبلا إنترنت، وتُمسح عند الخروج من التطبيق.</p><button class="btn sm ghost" data-open="data_check">فحص سلامة البيانات</button></div>';
      }
      return h;
    }
    function grpLabel(codes) { return String(codes).split(',').map(function (c) { var a = F.D.byCode[c]; return a ? c + ' · ' + a.name : c; }).join('، '); }
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
      } else if (tab === 'groups') {
        qa('[data-grp]', m).forEach(function (b) {
          b.onclick = function () {
            var k = b.dataset.grp, cur = String(((F.meta && F.meta.settings) || {})[k] || (k === 'recv' ? '1601' : '261')).split(',');
            pickAccount({ multi: true, value: cur, title: k === 'recv' ? 'حسابات العملاء' : 'حسابات الموردين', hint: 'اختر الحسابات الرئيسية التي تحتها العملاء أو الموردون. كل الحسابات الفرعية تحتها تُحسب تلقائياً.', filter: function (a) { return !a.leaf || a.lvl <= 4; } })
              .then(function (codes) {
                if (!codes || !codes.length) return;
                var body = {}; body[k] = codes.join(',');
                call('fin_settings_save', { settings: body }).then(function (r) { F.meta.settings = r.settings; F.cache = {}; S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); });
              });
          };
        });
        q('#fys', m).onchange = function () { call('fin_settings_save', { settings: { year_start: this.value } }).then(function (r) { F.meta.settings = r.settings; F.cache = {}; S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); }); };
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

    // عند الخروج: مسح البيانات المالية من الجهاز
    A.onLogout(function () { F.rows = null; F.D = null; F.rev = 0; F.meta = null; F.cur = null; F.edit = null; F.dirtyKeys = null; F.dirty = false; return Promise.all([S.del('fin:rows'), S.del('fin:rev'), S.del('fin:meta'), S.del('fin:aux')]); });
    try { st.finParams = JSON.parse(localStorage.getItem('rk.finParams') || '{}'); } catch (e) { st.finParams = {}; }

    // للاختبارات: الوصول للمحرّك
    window.__rkfin = { F: F, R: R, runCustom: runCustom, build: build, balance: balance, salesStats: salesStats, evalFormula: evalFormula, tryFormula: tryFormula, evalList: evalList,
      stockTotals: stockTotals, collections: collections, dailyData: function () { return dailyData(); }, cards: cards, dailyDef: dailyDef };
  };
})();
