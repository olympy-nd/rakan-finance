    /* ===================== تقييم المخزون بأسعار الشراء (تقرير الإدارة) ===================== */
    var VB_METH = [['mavg', 'متوسط التكلفة المتحرك (الدفتري)'], ['fifo', 'الوارد أولاً صادر أولاً (FIFO)'], ['wavg', 'المتوسط المرجح لأسعار الشراء'], ['last', 'آخر سعر شراء'], ['min', 'أقل سعر شراء'], ['max', 'أعلى سعر شراء']];
    var VB_BY = [['item', 'الصنف'], ['st', 'المخزن'], ['icl', 'تصنيف الصنف'], ['igrp', 'مجموعة الأصناف'], ['sup', 'المورد الرئيسي']];
    function vbShort(x) { x = String(x || '').replace(/\s+/g, ' ').trim(); return x.length > 30 ? x.slice(0, 29) + '…' : x; }
    // كل أسعار شراء الصنف مع عدد مرات الشراء بكل سعر (عدد الفواتير، وبضاعة أول المدة مرة لكل قيد)، الأكثر تكراراً أولاً
    function vbPrices(r) {
      if (!r.has) return 'بدون مشتريات حتى التاريخ';
      var m = {}, f = r.f;
      r.tiers.forEach(function (t) { var k = t.pb.toFixed(5), o = m[k] || (m[k] = { pb: t.pb, n: 0, o: 0 }), c = Object.keys(t.inv).length; o.n += c; if (t.label === 'o') o.o += c; });
      return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.n - a.n || a.pb - b.pb; })
        .map(function (o) { return (o.pb > 0 ? fm(o.pb * f) : 'مجاني') + '\u00a0×' + o.n + (o.o ? (o.o === o.n ? '\u00a0(أول\u00a0المدة)' : '\u00a0(منها\u00a0' + o.o + '\u00a0أول\u00a0المدة)') : ''); }).join('  ·  ');
    }
    function vbMethName(m) { var o = VB_METH.filter(function (x) { return x[0] === m; })[0]; return o ? o[1] : m; }
    // طبقات الشراء لكل صنف حتى تاريخ: بضاعة أول المدة + كل سعر شراء (مع المرتجعات) — على مستوى الشركة
    function vbLayers(asof) {
      var key = 'vbl:' + asof;
      if (F.cache[key]) return F.cache[key];
      var by = {};
      var tierOf = function (it, pb, label) {
        var o = by[it] || (by[it] = { tiers: [], ret: 0 }), k = label + '|' + pb.toFixed(5), t = null;
        for (var i = 0; i < o.tiers.length; i++) if (o.tiers[i].k === k) { t = o.tiers[i]; break; }
        if (!t) { t = { k: k, label: label, pb: pb, qb: 0, rq: 0, val: 0, d1: '', d2: '', inv: {}, sup: {} }; o.tiers.push(t); }
        return t;
      };
      var invs = F.D.invs.filter(function (v) { return v.d <= asof && (v.c === PUR || v.c === OPEN_STOCK || v.c === PRET); }).sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
      invs.forEach(function (v) {
        v.lines.forEach(function (l) {
          if (!(l.qb > 0)) return;
          var tot = l.tot > 0 ? l.tot : v.c === OPEN_STOCK ? (l.cost || 0) : 0, pb = tot / l.qb;
          if (v.c === PRET) {   // المرتجع يُخصم من طبقة نفس السعر، وإلا من آخر طبقة قبله
            var o = by[l.item]; if (!o) return;
            var m = o.tiers.filter(function (t) { return t.label === 'p' && Math.abs(t.pb - pb) < 0.0005; })[0];
            if (!m) m = o.tiers.filter(function (t) { return t.d1 && t.d1 <= v.d && t.pb > 0; }).pop();
            if (m) { m.rq += l.qb; m.val -= l.qb * m.pb; }
            o.ret += tot;
            return;
          }
          var t = tierOf(l.item, pb, v.c === OPEN_STOCK ? 'o' : 'p');
          t.qb += l.qb; t.val += tot; t.inv[v.id] = 1; var sk = v.c === OPEN_STOCK ? 'بضاعة أول المدة' : (v.name || (acc(v.ck) || {}).name || '—'); t.sup[sk] = (t.sup[sk] || 0) + tot;
          if (!t.d1 || v.d < t.d1) t.d1 = v.d; if (!t.d2 || v.d > t.d2) t.d2 = v.d;
        });
      });
      Object.keys(by).forEach(function (it) { by[it].tiers.sort(function (a, b) { return a.label !== b.label ? (a.label === 'o' ? -1 : 1) : a.d1 < b.d1 ? -1 : a.d1 > b.d1 ? 1 : 0; }); });
      return (F.cache[key] = by);
    }
    // تكلفة الوحدة (لوحدة الأساس) بكل طريقة، والتوزيع على الطبقات بطريقة FIFO
    function vbItem(it, asof, Qco) {
      var L = vbLayers(asof)[it], book = costAt(it, asof), r = { it: it, book: book, tiers: [], has: false };
      if (!L || !L.tiers.length) { ['fifo', 'wavg', 'last', 'min', 'max'].forEach(function (m) { r[m] = book; }); r.mavg = book; r.fifoX = 0; return r; }
      r.has = true; r.tiers = L.tiers;
      var nq = 0, nv = 0, paid = L.tiers.filter(function (t) { return t.pb > 0; });
      L.tiers.forEach(function (t) { var q = Math.max(0, t.qb - t.rq); nq += q; nv += q * t.pb; t.fq = 0; });
      r.mavg = book;
      r.wavg = nq > 0 ? nv / nq : book;
      var lastT = paid.slice().sort(function (a, b) { return a.d2 < b.d2 ? -1 : a.d2 > b.d2 ? 1 : 0; }).pop();
      r.last = lastT ? lastT.pb : book; r.lastD = lastT ? lastT.d2 : '';
      var firstT = paid.slice().sort(function (a, b) { return a.d1 < b.d1 ? -1 : 1; })[0];
      r.first = firstT ? firstT.pb : r.last;
      r.min = paid.length ? Math.min.apply(null, paid.map(function (t) { return t.pb; })) : book;
      r.max = paid.length ? Math.max.apply(null, paid.map(function (t) { return t.pb; })) : book;
      // FIFO: الرصيد الموجود من أحدث الطبقات رجوعاً، والزائد عن المشتريات بالتكلفة الدفترية
      var need = Math.max(0, Qco), fv = 0, ord = L.tiers.slice().sort(function (a, b) { return a.d2 < b.d2 ? 1 : a.d2 > b.d2 ? -1 : 0; });
      ord.forEach(function (t) { if (need <= 0) return; var q = Math.min(need, Math.max(0, t.qb - t.rq)); t.fq = q; fv += q * t.pb; need -= q; });
      r.fifoX = need; fv += need * book;
      r.fifo = Qco > 0 ? fv / Qco : book;
      var sp = {}; L.tiers.forEach(function (t) { Object.keys(t.sup).forEach(function (s) { if (s !== 'بضاعة أول المدة') sp[s] = (sp[s] || 0) + t.sup[s]; }); });
      r.sup = Object.keys(sp).sort(function (a, b) { return sp[b] - sp[a]; });
      r.pv = L.tiers.reduce(function (s, t) { return s + (t.label === 'p' ? t.val : 0); }, 0);
      r.ninv = {}; L.tiers.forEach(function (t) { Object.keys(t.inv).forEach(function (k) { if (t.label === 'p') r.ninv[k] = 1; }); }); r.ninv = Object.keys(r.ninv).length;
      r.nprice = paid.filter(function (t) { return t.label === 'p'; }).length; r.nq = nq; r.rq = L.tiers.reduce(function (s, t) { return s + t.rq; }, 0); var dp = {}; paid.forEach(function (t) { dp[t.pb.toFixed(4)] = 1; }); r.nlev = Object.keys(dp).length;
      return r;
    }
    R.stock_val_buy = { cat: 'stock', name: 'تقييم المخزون بأسعار الشراء (تقرير الإدارة)', desc: 'لكل صنف: كل أسعار الشراء التي اشتُري بها (الكمية والقيمة والتواريخ والموردون والمرتجعات)، ثم قيمة المخزون بست طرق: متوسط التكلفة الدفتري، FIFO، المتوسط المرجح، آخر سعر، أقل وأعلى سعر؛ مع طريقة التقييم النهائي المختارة وفرقها عن الدفاتر، وقاعدة الأقل من التكلفة أو سعر البيع اختيارياً؛ ملخصاً حسب الصنف أو المخزن أو التصنيف أو المورد، أو تفصيلياً بأسعار شراء كل صنف',
      params: ['asof', 'flt'], fdims: IF4,
      sel: [['view', 'العرض', [['sum', 'ملخص'], ['det', 'تفصيلي: الصنف وأسعار شرائه']]], ['method', 'طريقة التقييم النهائي', VB_METH], ['by', 'الملخص حسب', VB_BY], ['lcm', 'قاعدة الأقل من التكلفة أو سعر البيع', [['0', 'لا تُطبَّق'], ['1', 'تُطبَّق (سعر البيع أ)']]]],
      run: function (p) {
        var asof = p.asof, view = p.view === 'det' ? 'det' : 'sum', meth = p.method || 'mavg', by = p.by || 'item', lcm = p.lcm === '1';
        var fl = parseFilter(p.flt) || {}, stk = stockAt(asof), qco = {}, qf = {}, qst = {};
        Object.keys(stk).forEach(function (k) { var x = k.split('|'), sid = x[0], it = x[1], q = stk[k]; qco[it] = (qco[it] || 0) + q; if (!linePass({ item: it, st: sid }, fl) || Math.abs(q) < 1e-9) return; qf[it] = (qf[it] || 0) + q; (qst[it] = qst[it] || {})[sid] = q; });
        var items = Object.keys(qf).filter(function (it) { return Math.abs(qf[it]) > 1e-9; });
        if (!items.length) return emptyR('لا يوجد مخزون في ' + asof + ' بهذه الشروط');
        var ipr = hasIpr(), M = ['mavg', 'fifo', 'wavg', 'last', 'min', 'max'];
        var D = items.map(function (it) {
          var r = vbItem(it, asof, qco[it] || 0), q = qf[it], f = (T().item[it] || {}).f || 1;
          r.q = q; r.f = f; r.v = {}; M.forEach(function (m) { r.v[m] = q * r[m]; });
          r.unitF = r[meth]; r.sp = ipr ? listBase(it, null, 'a') : null; r.lcmCut = 0;
          if (lcm && r.sp && r.sp < r.unitF && q > 0) { r.lcmCut = q * (r.unitF - r.sp); r.unitF = r.sp; }
          r.fin = q * r.unitF; r.diff = r.fin - r.v.mavg;
          r.chg = r.first > 0 && r.has ? pct(r.last - r.first, r.first) : 0;
          return r;
        });
        // المجاميع
        var Tt = { q: 0, fin: 0, pv: 0, ninv: {}, lcm: 0, multi: 0, noPur: 0, up: 0, down: 0, firstV: 0, lastV: 0, fifoX: 0 }; M.forEach(function (m) { Tt[m] = 0; });
        D.forEach(function (r) {
          M.forEach(function (m) { Tt[m] += r.v[m]; }); Tt.fin += r.fin; Tt.lcm += r.lcmCut; Tt.pv += r.pv || 0;
          if (r.nlev > 1) Tt.multi++; if (!r.has) Tt.noPur++; if (r.has && r.last > r.first + 1e-9) Tt.up++; if (r.has && r.last < r.first - 1e-9) Tt.down++;
          if (r.has && r.q > 0) { Tt.firstV += r.q * r.first; Tt.lastV += r.q * r.last; } if (r.fifoX > 0) Tt.fifoX++;
        });
        var mName = vbMethName(meth), rows, cols, title;
        var priceRange = function (r) { if (!r.has) return 'بدون مشتريات حتى التاريخ'; var f = r.f; return r.max - r.min > 1e-9 ? fm(r.min * f) + '\u00a0–\u00a0' + fm(r.max * f) : r.max > 0 ? fm(r.max * f) : 'مجاني فقط'; };
        if (view === 'sum') {
          var grp = {
            item: function (r) { return [r.it, itemName(r.it)]; },
            icl: function (r) { var c = iclTop(r.it); return [c || '-', c ? iclName(c) : 'بدون تصنيف']; },
            igrp: function (r) { var g = igrpOf(r.it); return [g || '-', g ? igrpName(g) : 'بدون مجموعة']; },
            sup: function (r) { var s = r.sup && r.sup[0]; return [s || '-', s || 'بدون مشتريات']; }
          }[by];
          var G = {}, add = function (id, name, r, share) {
            var g = G[id] || (G[id] = { name: name, items: {}, q: 0, fin: 0, pv: 0, v: {}, np: 0, it: null });
            g.items[r.it] = 1; M.forEach(function (m) { g.v[m] = (g.v[m] || 0) + r.v[m] * share; }); g.fin += r.fin * share; if (share === 1) g.pv += r.pv || 0;
            if (by === 'item') { g.it = r; }
          };
          D.forEach(function (r) {
            if (by === 'st') Object.keys(qst[r.it]).forEach(function (sid) { add(sid, stLabel(sid), r, qst[r.it][sid] / r.q); });
            else { var k = grp(r); add(k[0], k[1], r, 1); }
          });
          rows = Object.keys(G).map(function (k) { var g = G[k], o = { name: g.name, items: Object.keys(g.items).length, fin: g.fin, share: pct(g.fin, Tt.fin), book: g.v.mavg, diff: g.fin - g.v.mavg, dpct: pct(g.fin - g.v.mavg, g.v.mavg), fifo: g.v.fifo, wavg: g.v.wavg, last: g.v.last, min: g.v.min, max: g.v.max, pv: g.pv };
            if (g.it) { var r = g.it; o.unit = unitOf(r.it); o.q = r.q / r.f; o.np = r.has ? r.nlev : 0; o.range = priceRange(r); o.prices = vbPrices(r); o.uf = r.unitF * r.f; o.chg = r.chg; o.lastD = r.lastD || '—'; o.sup = r.sup && r.sup.length ? vbShort(r.sup[0]) + (r.sup.length > 1 ? ' +' + (r.sup.length - 1) : '') : '—'; }
            return o; }).sort(function (a, b) { return b.fin - a.fin; });
          var byL = { item: 'الصنف', st: 'المخزن', icl: 'التصنيف', igrp: 'المجموعة', sup: 'المورد الرئيسي' }[by];
          cols = [C('name', byL)];
          if (by === 'item') cols = cols.concat([C('unit', 'الوحدة'), C('q', 'الكمية', 'qty'), C('np', 'عدد الأسعار', 'int'), C('prices', 'أسعار الشراء (× عدد مرات الشراء)', 'long'), C('chg', 'تغير السعر %', 'pct'), C('uf', 'تكلفة الوحدة النهائية', 'money')]);
          else cols.push(C('items', 'عدد الأصناف', 'int'));
          cols = cols.concat([C('fin', 'القيمة النهائية', 'money'), C('share', 'من الإجمالي %', 'pct'), C('book', 'الدفترية (متوسط متحرك)', 'money'), C('diff', 'الفرق عن الدفتري', 'money'), C('dpct', 'الفرق %', 'pct'), C('fifo', 'FIFO', 'money'), C('wavg', 'المتوسط المرجح', 'money'), C('last', 'بآخر سعر', 'money'), C('min', 'بأقل سعر', 'money'), C('max', 'بأعلى سعر', 'money')]);
          if (by === 'item') cols.push(C('sup', 'المورد الرئيسي'));
          title = 'تقييم المخزون بأسعار الشراء — ملخص حسب ' + byL;
        } else {
          rows = [];
          D.sort(function (a, b) { return b.fin - a.fin; }).forEach(function (r, gi) {
            var f = r.f;
            rows.push({ _g: gi, _gh: 1, _b: true, name: itemName(r.it) + ' (' + unitOf(r.it) + ')', src: r.has ? (r.sup.length === 1 ? 'مورد واحد' : r.sup.length === 2 ? 'موردان' : r.sup.length ? r.sup.length + (r.sup.length <= 10 ? ' موردين' : ' مورداً') : '—') : 'بدون مشتريات', d1: r.has ? r.tiers.reduce(function (m, t) { return !m || (t.d1 && t.d1 < m) ? t.d1 : m; }, '') : '—', d2: r.lastD || '—', ninv: r.has ? r.ninv : '', pq: r.has ? r.nq / f : '', rq: r.rq ? r.rq / f : '', pp: r.has ? r.wavg * f : '', pv: r.has ? r.pv : '', sq: r.q / f, uf: r.unitF * f, fin: r.fin, book: r.v.mavg, diff: r.diff });
            r.tiers.forEach(function (t) {
              var nq = Math.max(0, t.qb - t.rq), sup = Object.keys(t.sup);
              rows.push({ _g: gi, _lvl: 1, name: t.label === 'o' ? 'بضاعة أول المدة بسعر ' + fm(t.pb * f) : t.pb > 0 ? 'سعر شراء ' + fm(t.pb * f) : 'مجاني (بونص)', src: t.label === 'o' ? '—' : vbShort(sup.sort(function (a, b) { return t.sup[b] - t.sup[a]; })[0] || '') + (sup.length > 1 ? ' +' + (sup.length - 1) : ''), d1: t.d1, d2: t.d2, ninv: Object.keys(t.inv).length, pq: nq / f, rq: t.rq ? t.rq / f : '', pp: t.pb * f, pv: nq * t.pb, sq: meth === 'fifo' ? t.fq / f : '', uf: '', fin: meth === 'fifo' ? t.fq * t.pb : '', book: '', diff: '' });
            });
            if (meth === 'fifo' && r.fifoX > 0) rows.push({ _g: gi, _lvl: 1, name: 'رصيد غير مغطى بمشتريات (بالتكلفة الدفترية)', src: '', d1: '', d2: '', pq: '', pp: r.book * f, sq: r.fifoX / f, fin: r.fifoX * r.book });
          });
          cols = [C('name', 'الصنف / سعر الشراء'), C('src', 'المورد'), C('d1', 'من'), C('d2', 'إلى'), C('ninv', 'الفواتير', 'int'), C('pq', 'الكمية المشتراة', 'qty'), C('rq', 'المرتجع', 'qty'), C('pp', 'سعر الشراء', 'money'), C('pv', 'قيمة المشتريات', 'money'), C('sq', meth === 'fifo' ? 'بالمخزون (FIFO)' : 'الكمية بالمخزون', 'qty'), C('uf', 'تكلفة الوحدة النهائية', 'money'), C('fin', 'القيمة النهائية', 'money'), C('book', 'الدفترية', 'money'), C('diff', 'الفرق', 'money')];
          title = 'تقييم المخزون بأسعار الشراء — تفصيلي (' + mName + ')';
        }
        var qT = D.reduce(function (a, r) { return a + r.q / r.f; }, 0), pqT = D.reduce(function (a, r) { return a + (r.has ? r.nq / r.f : 0); }, 0), rqT = D.reduce(function (a, r) { return a + (r.rq ? r.rq / r.f : 0); }, 0);
        var total = { name: 'الإجمالي', _b: true, items: D.length, q: qT, sq: qT, pq: pqT, rq: rqT || '', fin: Tt.fin, share: 100, book: Tt.mavg, diff: Tt.fin - Tt.mavg, dpct: pct(Tt.fin - Tt.mavg, Tt.mavg), fifo: Tt.fifo, wavg: Tt.wavg, last: Tt.last, min: Tt.min, max: Tt.max, pv: Tt.pv };
        var tots = M.map(function (m) { return Tt[m]; }), lo = Math.min.apply(null, tots), hi = Math.max.apply(null, tots), infl = pct(Tt.lastV - Tt.firstV, Tt.firstV);
        var kpis = [
          { l: 'القيمة النهائية للمخزون', v: Tt.fin, t: 'money', s: mName + (lcm ? ' + قاعدة الأقل' : '') },
          { l: 'القيمة الدفترية (سراج)', v: Tt.mavg, t: 'money', s: 'متوسط التكلفة المتحرك' },
          { l: 'الفرق عن الدفاتر', v: Tt.fin - Tt.mavg, t: 'money', s: (function (x) { return (Math.abs(x) < 0.005 ? '0.00' : x.toFixed(2)) + '% من القيمة الدفترية'; })(pct(Tt.fin - Tt.mavg, Tt.mavg)), bad: Math.abs(Tt.fin - Tt.mavg) > 0.5 },
          { l: 'مدى التقييم بين الطرق', v: hi - lo, t: 'money', s: 'من ' + fm(lo) + ' إلى ' + fm(hi) },
          { l: 'تغير أسعار الشراء', v: infl, t: 'pct', s: 'آخر سعر مقابل أول سعر · ' + Tt.up + ' ارتفع · ' + Tt.down + ' انخفض', bad: infl > 0.05 },
          { l: 'أصناف بأكثر من سعر شراء', v: Tt.multi, t: 'int', s: 'من ' + D.length + ' صنف بالمخزون' },
          { l: 'مشتريات حتى التاريخ', v: Tt.pv, t: 'money', s: 'لأصناف المخزون الحالية' },
          lcm ? { l: 'تخفيض قاعدة الأقل', v: Tt.lcm, t: 'money', s: 'سعر البيع أقل من التكلفة', bad: Tt.lcm > 0.5 } : { l: 'أصناف بلا مشتريات', v: Tt.noPur, t: 'int', s: 'تُقيَّم بالتكلفة الدفترية', bad: Tt.noPur > 0 }
        ];
        var note = 'طريقة التقييم النهائي: ' + mName + (lcm ? ' مع قاعدة الأقل من التكلفة أو سعر البيع أ' + (ipr ? '' : ' (قوائم الأسعار لم تصل، فلم تُطبَّق)') : '') +
          ' · أسعار الشراء بالوحدة الشائعة من فواتير الشراء وبضاعة أول المدة حتى التاريخ، والمرتجع يُخصم من طبقة سعره · FIFO: الرصيد الموجود يُقيَّم بأحدث أسعار الشراء رجوعاً' + (Tt.fifoX ? '، والزائد عن المشتريات بالتكلفة الدفترية (' + Tt.fifoX + ' صنف)' : '') +
          ' · أسعار الشراء: كل سعر مع عدد مرات الشراء به (عدد الفواتير، وقيود بضاعة أول المدة) · المتوسط المرجح يشمل الكميات المجانية (البونص) بسعر صفر · الأسعار وطرق التقييم على مستوى الشركة، وتصفية المخزن تحدد الكميات فقط · الدفترية = متوسط التكلفة المتحرك كما في سراج';
        var res = { title: title, cols: cols, rows: rows, total: total, kpis: kpis, note: note };
        res.printKeys = view === 'sum' ? ['name', 'unit', 'q'] : ['name'];
        if (view === 'det') res._grouped = true;
        else res.chart = { type: 'hbar', x: 'name', y: ['v'], yl: ['قيمة المخزون'], rowsOverride: M.map(function (m) { return { name: (m === meth ? '◀ ' : '') + vbMethName(m), v: Tt[m] }; }), limit: 6 };
        return withNote(res, p);
      } };
