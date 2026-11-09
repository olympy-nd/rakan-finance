
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
