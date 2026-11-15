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
