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
