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
