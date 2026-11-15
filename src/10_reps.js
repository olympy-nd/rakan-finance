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
