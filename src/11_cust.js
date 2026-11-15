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
          C('qty', 'الكمية', 'qty'), C('val', 'القيمة', 'money'), C('profit', 'الربح', 'money'), C('margin', 'الهامش', 'pct'), C('lost', 'الفرق لو بيع كله بأعلى سعر', 'money'), C('prices', 'الأسعار × الكميات')];
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
