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
