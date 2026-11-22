    /* ===================== الموردون: تقارير فواتير شراء الموردين ===================== */
    (function () { var ii = -1; CATS.forEach(function (c, i) { if (c[0] === 'purch') ii = i; }); CATS.splice(ii + 1, 0, ['supp', 'فواتير شراء الموردين']); })();
    var SFD = ['supp', 'item', 'st', 'u'];
    function spKey(v) { return String(v.ck || v.name || '-'); }
    function spName(v) { return v.name || (acc(v.ck) || {}).name || 'بدون مورد'; }
    // فواتير الشراء والمرتجعات في الفترة، مجمّعة لكل فاتورة (مع البونص: سطور بلا قيمة)
    function spInvoices(p) {
      var g = {};
      facts('p', p.from, p.to, p.flt).forEach(function (x) {
        var r = g[x.v.id] || (g[x.v.id] = { v: x.v, s: x.s, key: spKey(x.v), name: spName(x.v), qty: 0, free: 0, val: 0, lines: 0, items: {} });
        r.lines++; r.items[x.l.item] = 1; r.val += x.val; if (x.val > 0) r.qty += x.qty; else r.free += x.qty;
      });
      return Object.keys(g).map(function (k) { return g[k]; });
    }
    function spDays(a, b) { return a && b ? Math.round((new Date(b) - new Date(a)) / 864e5) : ''; }
    function isSupAcc(key) { var c = F.cache.spPay || (F.cache.spPay = (function () { var o = {}; payIds().forEach(function (id) { o[id] = 1; }); return o; })()); return !!c[key]; }
    function supBalance(key, to) { if (!isSupAcc(key)) return null; var b = balance([key], yearStart(), to); return -b.close; }

    /* 1) ملخص فواتير الموردين */
    R.supp_summary = { cat: 'supp', name: 'ملخص فواتير شراء الموردين', desc: 'لكل مورد: عدد فواتير الشراء والمرتجعات، والمشتريات والمرتجعات والصافي ونسبة المرتجع، ومتوسط الفاتورة، والأصناف، والبونص، وأول وآخر فاتورة ومعدل تكرار الشراء، والمسدد خلال الفترة والرصيد المستحق له',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var inv = spInvoices(p), G = {};
        if (!inv.length) return emptyR('لا توجد فواتير شراء في الفترة');
        inv.forEach(function (r) {
          var g = G[r.key] || (G[r.key] = { key: r.key, name: r.name, n: 0, nr: 0, pur: 0, ret: 0, qty: 0, free: 0, items: {}, ds: [] });
          if (r.s > 0) { g.n++; g.pur += r.val; g.qty += r.qty; g.free += r.free; g.ds.push(r.v.d); } else { g.nr++; g.ret += r.val; }
          Object.keys(r.items).forEach(function (k) { g.items[k] = 1; });
        });
        var tot = 0; Object.keys(G).forEach(function (k) { tot += G[k].pur - G[k].ret; });
        var rows = Object.keys(G).map(function (k) {
          var g = G[k], ds = g.ds.sort(), d1 = ds[0] || '', d2 = ds[ds.length - 1] || '', net = g.pur - g.ret, u = {}; ds.forEach(function (d) { u[d] = 1; });
          var days = Object.keys(u).sort(), gap = days.length > 1 ? spDays(days[0], days[days.length - 1]) / (days.length - 1) : '';
          var b = isSupAcc(k) ? balance([k], p.from, p.to) : null, paid = b ? b.dr - g.ret : '', due = supBalance(k, p.to);
          return { name: g.name, n: g.n, nr: g.nr, pur: g.pur, ret: g.ret, net: net, rp: pct(g.ret, g.pur), share: pct(net, tot), avg: g.n ? g.pur / g.n : 0, items: Object.keys(g.items).length,
            qty: g.qty, free: g.free, fp: pct(g.free, g.qty + g.free), d1: d1 || '—', d2: d2 || '—', since: d2 ? spDays(d2, p.to) : '', gap: gap === '' ? '' : Math.round(gap * 10) / 10, paid: paid, due: due === null ? '' : due };
        }).sort(function (a, b) { return b.net - a.net; });
        var t = sumRow(rows, [C('n', '', 'int'), C('nr', '', 'int'), C('pur', '', 'money'), C('ret', '', 'money'), C('net', '', 'money'), C('qty', '', 'qty'), C('free', '', 'qty'), C('paid', '', 'money'), C('due', '', 'money')]);
        t.rp = pct(t.ret, t.pur); t.share = 100; t.avg = t.n ? t.pur / t.n : 0; t.fp = pct(t.free, t.qty + t.free);
        var allItems = {}; inv.forEach(function (r) { Object.keys(r.items).forEach(function (k) { allItems[k] = 1; }); }); t.items = Object.keys(allItems).length;
        var top = rows[0];
        var kpis = [
          { l: 'صافي المشتريات', v: t.net, t: 'money', s: rows.length + ' مورد · ' + t.n + ' فاتورة' },
          { l: 'مرتجعات الشراء', v: t.ret, t: 'money', s: t.nr + ' فاتورة · ' + t.rp.toFixed(1) + '% من المشتريات', bad: t.rp > 5 },
          { l: 'متوسط فاتورة الشراء', v: t.avg, t: 'money', s: 'المشتريات ÷ عدد الفواتير' },
          { l: 'أكبر مورد', v: top ? top.share : 0, t: 'pct', s: top ? top.name : '' , bad: top && top.share > 70 },
          { l: 'الكميات المجانية (بونص)', v: t.free, t: 'int', s: t.fp.toFixed(1) + '% من الكمية المستلمة' },
          { l: 'المسدد للموردين', v: t.paid || 0, t: 'money', s: 'خلال الفترة (حركة مدين − المرتجعات)' },
          { l: 'المستحق للموردين', v: t.due || 0, t: 'money', s: 'الرصيد في ' + p.to },
          { l: 'الأصناف المشتراة', v: t.items, t: 'int', s: 'صنفاً مختلفاً' }
        ];
        return withNote({ title: 'ملخص فواتير شراء الموردين', _noCust: true, kpis: kpis, rows: rows, total: t,
          cols: [C('name', 'المورد'), C('n', 'فواتير الشراء', 'int'), C('nr', 'المرتجعات', 'int'), C('pur', 'المشتريات', 'money'), C('ret', 'مرتجع الشراء', 'money'), C('net', 'صافي المشتريات', 'money'), C('rp', 'المرتجع %', 'pct'), C('share', 'من الإجمالي %', 'pct'), C('avg', 'متوسط الفاتورة', 'money'), C('items', 'الأصناف', 'int'), C('qty', 'الكمية المدفوعة', 'qty'), C('free', 'البونص', 'qty'), C('fp', 'البونص %', 'pct'), C('d1', 'أول فاتورة'), C('d2', 'آخر فاتورة'), C('since', 'أيام منذ آخر فاتورة', 'int'), C('gap', 'كل كم يوم يُشترى', 'qty'), C('paid', 'المسدد في الفترة', 'money'), C('due', 'المستحق للمورد', 'money')],
          note: 'المورد = حساب فاتورة الشراء · المسدد والمستحق لحسابات الموردين فقط (تحت حساب الموردين في الإعدادات) · الكمية بالوحدة الشائعة · البونص = سطور بلا قيمة · «كل كم يوم» = متوسط الأيام بين أيام الشراء · المسدد = الحركة المدينة على حساب المورد في الفترة بعد خصم المرتجعات · المستحق = رصيده الدائن في نهاية الفترة',
          chart: rows.length > 1 ? { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المشتريات'], limit: 12 } : null }, p);
      } };

    /* 2) سجل فواتير الشراء حسب المورد */
    R.supp_register = { cat: 'supp', name: 'سجل فواتير الشراء حسب المورد', desc: 'فواتير الشراء والمرتجعات لكل مورد تحت عنوانه مع إجماليه: التاريخ والرقم والنوع والمخزن وعدد البنود والكمية والبونص والصافي والبيان',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var inv = spInvoices(p);
        if (!inv.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var G = {}; inv.forEach(function (r) { (G[r.key] = G[r.key] || { name: r.name, list: [] }).list.push(r); });
        var gs = Object.keys(G).map(function (k) { var g = G[k]; g.net = g.list.reduce(function (s, r) { return s + r.s * r.val; }, 0); return g; }).sort(function (a, b) { return b.net - a.net; });
        var rows = [];
        gs.forEach(function (g, gi) {
          var n = g.list.filter(function (r) { return r.s > 0; }).length, nr = g.list.length - n;
          rows.push({ _g: gi, _gh: 1, _b: true, d: '', no: '', name: g.name + ' (' + n + ' فاتورة' + (nr ? ' · ' + nr + ' مرتجع' : '') + ')', type: '', st: '', lines: g.list.reduce(function (s, r) { return s + r.lines; }, 0), qty: g.list.reduce(function (s, r) { return s + r.s * r.qty; }, 0), free: g.list.reduce(function (s, r) { return s + r.s * r.free; }, 0), net: g.net, note: '' });
          g.list.sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : a.v.dt > b.v.dt ? 1 : 0; }).forEach(function (r) {
            rows.push({ _g: gi, _lvl: 1, _hl: r.s < 0, d: r.v.d, no: r.v.no, name: r.s > 0 ? 'فاتورة شراء' : 'مرتجع شراء', st: stLabel(r.v.st), lines: r.lines, qty: r.s * r.qty, free: r.s * r.free, net: r.s * r.val, note: r.v.note || '' });
          });
        });
        var t = { name: 'الإجمالي (' + inv.length + ' فاتورة)', _b: true, lines: 0, qty: 0, free: 0, net: 0 };
        inv.forEach(function (r) { t.lines += r.lines; t.qty += r.s * r.qty; t.free += r.s * r.free; t.net += r.s * r.val; });
        return withNote({ title: 'سجل فواتير الشراء حسب المورد', rows: rows, total: t, _grouped: true,
          cols: [C('name', 'المورد / نوع الفاتورة'), C('d', 'التاريخ'), C('no', 'الرقم'), C('st', 'المخزن'), C('lines', 'البنود', 'int'), C('qty', 'الكمية', 'qty'), C('free', 'البونص', 'qty'), C('net', 'الصافي', 'money'), C('note', 'البيان', 'long')],
          note: 'المرتجعات بالسالب ومظللة · الكمية بالوحدة الشائعة · البونص = سطور بلا قيمة' }, p);
      } };

    /* 3) تفاصيل فواتير الشراء (بنود كل فاتورة) */
    R.supp_inv_lines = { cat: 'supp', name: 'تفاصيل فواتير الشراء (بنود الفاتورة)', desc: 'كل فاتورة شراء أو مرتجع تحت عنوانها (المورد والرقم والتاريخ والمخزن والصافي) وتحتها بنودها: الصنف والوحدة والكمية والسعر والإجمالي وتكلفة الوحدة الشائعة',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var xs = facts('p', p.from, p.to, p.flt);
        if (!xs.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var G = {}; xs.forEach(function (x) { (G[x.v.id] = G[x.v.id] || { v: x.v, s: x.s, l: [] }).l.push(x); });
        var gs = Object.keys(G).map(function (k) { return G[k]; }).sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : a.v.dt > b.v.dt ? 1 : 0; });
        var LIM = 3000, rows = [], cut = 0, t = { item: 'الإجمالي (' + gs.length + ' فاتورة)', _b: true, qty: 0, net: 0 };
        gs.forEach(function (g, gi) {
          var net = g.l.reduce(function (s, x) { return s + x.val; }, 0), qty = g.l.reduce(function (s, x) { return s + x.qty; }, 0);
          t.qty += g.s * qty; t.net += g.s * net;
          if (rows.length > LIM) { cut++; return; }
          rows.push({ _g: gi, _gh: 1, _b: true, _hl: g.s < 0, item: (g.s > 0 ? 'فاتورة شراء ' : 'مرتجع شراء ') + g.v.no + ' · ' + spName(g.v), d: g.v.d, unit: stLabel(g.v.st), q: '', p: '', qty: g.s * qty, net: g.s * net, cu: '' });
          g.l.forEach(function (x) {
            var f = (T().item[x.l.item] || {}).f || 1;
            rows.push({ _g: gi, _lvl: 1, item: itemName(x.l.item), d: '', unit: x.l.un || unitOf(x.l.item), q: g.s * (x.l.q || 0), p: x.l.p || (x.l.q ? x.val / x.l.q : 0), qty: g.s * x.qty, net: g.s * x.val, cu: x.l.qb ? x.val / x.l.qb * f : 0, free: x.val > 0 ? '' : 'بونص' });
          });
        });
        return withNote({ title: 'تفاصيل فواتير الشراء', rows: rows, total: t, _grouped: true,
          cols: [C('item', 'الفاتورة / الصنف'), C('d', 'التاريخ'), C('unit', 'المخزن / الوحدة'), C('q', 'الكمية بوحدة الفاتورة', 'qty'), C('p', 'السعر', 'money'), C('qty', 'الكمية (الوحدة الشائعة)', 'qty'), C('cu', 'تكلفة الوحدة الشائعة', 'money'), C('net', 'الإجمالي', 'money'), C('free', 'ملاحظة')],
          note: (cut ? 'عُرضت أول الفواتير فقط (' + cut + ' فاتورة لم تُعرض، والإجمالي يشملها) — ضيّق الفترة أو اختر مورداً · ' : '') + 'المرتجعات بالسالب ومظللة' }, p);
      } };

    /* 4) أصناف كل مورد وأسعارها */
    R.supp_items = { cat: 'supp', name: 'أصناف كل مورد وأسعار شرائها', desc: 'لكل مورد: الأصناف التي اشتُريت منه بعدد الفواتير والكمية والبونص والقيمة، ومتوسط وأقل وأعلى وآخر سعر شراء، ونصيب الصنف من مشتريات المورد',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var xs = facts('p', p.from, p.to, p.flt);
        if (!xs.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var G = {};
        xs.forEach(function (x) {
          var k = spKey(x.v), g = G[k] || (G[k] = { name: spName(x.v), it: {}, net: 0 }), e = g.it[x.l.item] || (g.it[x.l.item] = { inv: {}, qty: 0, free: 0, val: 0, rq: 0, rv: 0, ps: [] });
          if (x.s > 0) { e.inv[x.v.id] = 1; if (x.val > 0) { e.qty += x.qty; e.val += x.val; e.ps.push([x.v.dt, x.val / x.qty]); } else e.free += x.qty; g.net += x.val; }
          else { e.rq += x.qty; e.rv += x.val; g.net -= x.val; }
        });
        var gs = Object.keys(G).map(function (k) { return G[k]; }).sort(function (a, b) { return b.net - a.net; }), rows = [];
        gs.forEach(function (g, gi) {
          var its = Object.keys(g.it).map(function (k) { var e = g.it[k]; e.id = k; e.net = e.val - e.rv; return e; }).sort(function (a, b) { return b.net - a.net; });
          rows.push({ _g: gi, _gh: 1, _b: true, name: g.name + ' (' + its.length + ' صنف)', net: g.net, share: 100 });
          its.forEach(function (e) {
            var ps = e.ps.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; }).map(function (x) { return x[1]; });
            rows.push({ _g: gi, _lvl: 1, name: itemName(e.id), unit: unitOf(e.id), inv: Object.keys(e.inv).length, qty: e.qty, free: e.free, rq: e.rq || '', avg: e.qty ? e.val / e.qty : '', min: ps.length ? Math.min.apply(null, ps) : '', max: ps.length ? Math.max.apply(null, ps) : '', last: ps.length ? ps[ps.length - 1] : '', net: e.net, share: pct(e.net, g.net) });
          });
        });
        var t = { name: 'الإجمالي', _b: true, net: gs.reduce(function (s, g) { return s + g.net; }, 0) };
        return withNote({ title: 'أصناف كل مورد وأسعار شرائها', rows: rows, total: t, _grouped: true,
          cols: [C('name', 'المورد / الصنف'), C('unit', 'الوحدة'), C('inv', 'الفواتير', 'int'), C('qty', 'الكمية', 'qty'), C('free', 'البونص', 'qty'), C('rq', 'المرتجع', 'qty'), C('avg', 'متوسط السعر', 'money'), C('min', 'أقل سعر', 'money'), C('max', 'أعلى سعر', 'money'), C('last', 'آخر سعر', 'money'), C('net', 'صافي القيمة', 'money'), C('share', 'من مشتريات المورد %', 'pct')],
          note: 'الأسعار للوحدة الشائعة من سطور الشراء المدفوعة (بدون البونص) · صافي القيمة = المشتريات − المرتجعات' }, p);
      } };

    /* 5) مرتجعات الشراء حسب المورد */
    R.supp_returns = { cat: 'supp', name: 'مرتجعات الشراء حسب المورد', desc: 'فواتير مرتجع الشراء لكل مورد مع أصنافها وقيمتها، ونسبة المرتجع من مشتريات المورد',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var xs = facts('p', p.from, p.to, p.flt), G = {};
        xs.forEach(function (x) {
          var k = spKey(x.v), g = G[k] || (G[k] = { name: spName(x.v), pur: 0, ret: 0, inv: {} });
          if (x.s > 0) g.pur += x.val; else { g.ret += x.val; var r = g.inv[x.v.id] || (g.inv[x.v.id] = { v: x.v, val: 0, qty: 0, it: {} }); r.val += x.val; r.qty += x.qty; r.it[itemName(x.l.item)] = 1; }
        });
        var gs = Object.keys(G).map(function (k) { return G[k]; }).filter(function (g) { return g.ret; }).sort(function (a, b) { return b.ret - a.ret; });
        if (!gs.length) return emptyR('لا توجد مرتجعات شراء في الفترة');
        var rows = [];
        gs.forEach(function (g, gi) {
          var ls = Object.keys(g.inv).map(function (k) { return g.inv[k]; });
          rows.push({ _g: gi, _gh: 1, _b: true, name: g.name, n: ls.length, pur: g.pur, ret: g.ret, rp: pct(g.ret, g.pur), qty: ls.reduce(function (s, r) { return s + r.qty; }, 0) });
          ls.sort(function (a, b) { return a.v.dt < b.v.dt ? -1 : 1; }).forEach(function (r) { rows.push({ _g: gi, _lvl: 1, name: 'مرتجع ' + r.v.no, d: r.v.d, st: stLabel(r.v.st), qty: r.qty, ret: r.val, its: Object.keys(r.it).join('\n'), note: r.v.note || '' }); });
        });
        var t = { name: 'الإجمالي', _b: true, n: 0, pur: 0, ret: 0, qty: 0 }; gs.forEach(function (g) { t.n += Object.keys(g.inv).length; t.pur += g.pur; t.ret += g.ret; }); t.rp = pct(t.ret, t.pur);
        rows.forEach(function (r) { if (r._gh) t.qty += r.qty; });
        return withNote({ title: 'مرتجعات الشراء حسب المورد', rows: rows, total: t, _grouped: true,
          cols: [C('name', 'المورد / المرتجع'), C('d', 'التاريخ'), C('st', 'المخزن'), C('n', 'عدد المرتجعات', 'int'), C('pur', 'مشتريات المورد', 'money'), C('ret', 'قيمة المرتجع', 'money'), C('rp', 'المرتجع %', 'pct'), C('qty', 'الكمية', 'qty'), C('its', 'الأصناف', 'long'), C('note', 'البيان', 'long')] }, p);
      } };

    /* 6) البونص والكميات المجانية من الموردين */
    R.supp_bonus = { cat: 'supp', name: 'البونص والكميات المجانية من الموردين', desc: 'لكل مورد وصنف: الكمية المدفوعة والمجانية ونسبة البونص، وقيمة البونص التقديرية بمتوسط سعر الشراء، وأثره في خفض تكلفة الوحدة',
      params: ['period', 'flt'], fdims: SFD,
      run: function (p) {
        var G = {};
        facts('p', p.from, p.to, p.flt).forEach(function (x) {
          if (x.s < 0) return;
          var k = spKey(x.v), g = G[k] || (G[k] = { name: spName(x.v), it: {} }), e = g.it[x.l.item] || (g.it[x.l.item] = { pq: 0, pv: 0, fq: 0, n: {} });
          if (x.val > 0) { e.pq += x.qty; e.pv += x.val; } else { e.fq += x.qty; e.n[x.v.id] = 1; }
        });
        var rows = [], T0 = { pq: 0, fq: 0, fv: 0 }, gi = 0;
        Object.keys(G).map(function (k) { return G[k]; }).forEach(function (g) {
          var its = Object.keys(g.it).map(function (k) { var e = g.it[k]; e.id = k; e.avg = e.pq ? e.pv / e.pq : 0; e.fv = e.fq * e.avg; return e; }).filter(function (e) { return e.fq > 0; }).sort(function (a, b) { return b.fv - a.fv || b.fq - a.fq; });
          if (!its.length) return;
          var h = { _g: gi, _gh: 1, _b: true, name: g.name, pq: 0, fq: 0, fv: 0 }; its.forEach(function (e) { h.pq += e.pq; h.fq += e.fq; h.fv += e.fv; }); h.fp = pct(h.fq, h.pq + h.fq); rows.push(h);
          its.forEach(function (e) { rows.push({ _g: gi, _lvl: 1, name: itemName(e.id), unit: unitOf(e.id), n: Object.keys(e.n).length, pq: e.pq, fq: e.fq, fp: pct(e.fq, e.pq + e.fq), avg: e.avg, fv: e.fv, eff: e.pq + e.fq ? e.pv / (e.pq + e.fq) : '' }); });
          T0.pq += h.pq; T0.fq += h.fq; T0.fv += h.fv; gi++;
        });
        if (!rows.length) return emptyR('لا توجد كميات مجانية من الموردين في الفترة');
        return withNote({ title: 'البونص والكميات المجانية من الموردين', rows: rows, _grouped: true, total: { name: 'الإجمالي', _b: true, pq: T0.pq, fq: T0.fq, fp: pct(T0.fq, T0.pq + T0.fq), fv: T0.fv },
          cols: [C('name', 'المورد / الصنف'), C('unit', 'الوحدة'), C('n', 'فواتير البونص', 'int'), C('pq', 'الكمية المدفوعة', 'qty'), C('fq', 'الكمية المجانية', 'qty'), C('fp', 'البونص %', 'pct'), C('avg', 'متوسط سعر الشراء', 'money'), C('fv', 'قيمة البونص التقديرية', 'money'), C('eff', 'التكلفة الفعلية للوحدة', 'money')],
          note: 'البونص = سطور شراء بلا قيمة · قيمته التقديرية = الكمية المجانية × متوسط سعر الشراء المدفوع · التكلفة الفعلية = المدفوع ÷ (المدفوعة + المجانية) · الأصناف ذات البونص فقط' }, p);
      } };

    /* 7) نشاط الموردين شهرياً */
    R.supp_months = { cat: 'supp', name: 'فواتير الموردين شهرياً', desc: 'لكل مورد في كل شهر: عدد الفواتير أو صافي المشتريات أو الكمية، مع الإجمالي والمتوسط الشهري',
      params: ['period', 'flt'], fdims: SFD, sel: [['metric', 'المقياس', [['net', 'صافي المشتريات'], ['n', 'عدد الفواتير'], ['qty', 'الكمية']]]],
      run: function (p) {
        var m = p.metric || 'net', G = {}, months = {};
        spInvoices(p).forEach(function (r) {
          var ym = r.v.d.slice(0, 7), g = G[r.key] || (G[r.key] = { name: r.name, m: {} }); months[ym] = 1;
          g.m[ym] = (g.m[ym] || 0) + (m === 'n' ? (r.s > 0 ? 1 : 0) : m === 'qty' ? r.s * r.qty : r.s * r.val);
        });
        var ms = Object.keys(months).sort();
        if (!ms.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var ty = m === 'n' ? 'int' : m === 'qty' ? 'qty' : 'money';
        var rows = Object.keys(G).map(function (k) { var g = G[k], o = { name: g.name, tot: 0 }; ms.forEach(function (x) { o[x] = g.m[x] || 0; o.tot += o[x]; }); o.avg = o.tot / ms.length; return o; }).sort(function (a, b) { return b.tot - a.tot; });
        var cols = [C('name', 'المورد')].concat(ms.map(function (x) { return C(x, x, ty); }), [C('tot', 'الإجمالي', ty), C('avg', 'المتوسط الشهري', m === 'n' ? 'qty' : ty)]);
        var t = sumRow(rows, cols.slice(1)); t.avg = t.tot / ms.length;
        return withNote({ _noCust: true, title: 'فواتير الموردين شهرياً — ' + ({ net: 'صافي المشتريات', n: 'عدد الفواتير', qty: 'الكمية' })[m], rows: rows, total: t, cols: cols,
          chart: { type: 'line', x: 'm', y: ['v'], yl: ['الإجمالي'], rowsOverride: ms.map(function (x) { return { m: x, v: t[x] }; }) } }, p);
      } };

    /* 8) تحليل أحجام فواتير الشراء */
    var SP_BUCKETS = [[0, 10000], [10000, 50000], [50000, 100000], [100000, 250000], [250000, 1e15]];
    R.supp_inv_size = { cat: 'supp', name: 'تحليل أحجام فواتير الشراء', desc: 'توزيع فواتير الشراء على شرائح القيمة: العدد والقيمة والنصيب لكل شريحة، لكل الموردين أو لكل مورد',
      params: ['period', 'flt'], fdims: SFD, sel: [['by', 'التجميع', [['all', 'كل الموردين'], ['sup', 'لكل مورد']]]],
      run: function (p) {
        var inv = spInvoices(p).filter(function (r) { return r.s > 0; });
        if (!inv.length) return emptyR('لا توجد فواتير شراء في الفترة');
        var lab = function (b) { return b[1] >= 1e15 ? 'أكثر من ' + fk(b[0]) : fk(b[0]) + ' – ' + fk(b[1]); };
        var tot = inv.reduce(function (s, r) { return s + r.val; }, 0), rows = [];
        var block = function (list, gi, head) {
          if (head) rows.push({ _g: gi, _gh: 1, _b: true, name: head, n: list.length, val: list.reduce(function (s, r) { return s + r.val; }, 0), avg: '' });
          var gt = list.reduce(function (s, r) { return s + r.val; }, 0);
          SP_BUCKETS.forEach(function (b) {
            var xs = list.filter(function (r) { return r.val >= b[0] && r.val < b[1]; }); if (!xs.length) return;
            var v = xs.reduce(function (s, r) { return s + r.val; }, 0);
            rows.push({ _g: gi, _lvl: head ? 1 : 0, name: lab(b), n: xs.length, np: pct(xs.length, list.length), val: v, share: pct(v, gt), avg: v / xs.length, max: Math.max.apply(null, xs.map(function (r) { return r.val; })) });
          });
        };
        if (p.by === 'sup') { var G = {}; inv.forEach(function (r) { (G[r.key] = G[r.key] || { name: r.name, l: [] }).l.push(r); }); Object.keys(G).map(function (k) { return G[k]; }).sort(function (a, b) { return b.l.length - a.l.length; }).forEach(function (g, i) { block(g.l, i, g.name); }); }
        else block(inv, 0, null);
        return withNote({ title: 'تحليل أحجام فواتير الشراء', rows: rows, _grouped: p.by === 'sup', total: { name: 'الإجمالي', _b: true, n: inv.length, np: 100, val: tot, share: 100, avg: tot / inv.length },
          cols: [C('name', p.by === 'sup' ? 'المورد / شريحة القيمة' : 'شريحة قيمة الفاتورة'), C('n', 'عدد الفواتير', 'int'), C('np', 'من العدد %', 'pct'), C('val', 'القيمة', 'money'), C('share', 'من القيمة %', 'pct'), C('avg', 'متوسط الفاتورة', 'money'), C('max', 'أكبر فاتورة', 'money')],
          note: 'فواتير الشراء فقط (بدون المرتجعات) · الشرائح بقيمة صافي الفاتورة',
          chart: p.by === 'sup' ? null : { type: 'hbar', x: 'name', y: ['val'], yl: ['القيمة'] } }, p);
      } };

    /* ===================== التحصيل حسب طريقة القبض: نقدي / بنوك / مقاصة ===================== */
    // سطر لكل حساب مدين في كل سند تحصيل من العملاء، والمبلغ موزّع بنسبته (نفس قواعد collections وcollSplit)
    function collLines(from, to, recvList) {
      var bx = boxIds(''), recv = recvList || recvIds(), bset = {}, rset = {}, out = [];
      bx.forEach(function (x) { bset[x] = 1; }); recv.forEach(function (x) { rset[x] = 1; });
      entriesIn(from, to).forEach(function (l0) {
        var ls = F.D.byEntry[l0.e], dB = 0, cR = 0, deb = [], cus = {};
        ls.forEach(function (l) {
          if ((bx.length ? bset[l.a] : (l0.k === 'r' && l.dr)) && l.dr) { dB += l.dr; deb.push(l); }
          if (rset[l.a] && l.cr) { cR += l.cr; cus[l.a] = (cus[l.a] || 0) + l.cr; }
        });
        var amt = Math.min(dB, cR);
        if (amt <= 0 || dB <= 0) return;
        var cl = Object.keys(cus).sort(function (a, b) { return cus[b] - cus[a]; });
        deb.forEach(function (l) {
          var k = cashBankKind(l.a);
          out.push({ e: l0.e, d: l0.d, dt: l0.dt, no: l0.no, btn: l0.btn || '', ed: l0.ed || '', acc: l.a, kind: k === 'بنك' ? 'بنوك' : k === 'صندوق' ? 'نقدي' : 'مقاصة', amt: amt * l.dr / dB, cust: cl, cmain: cl[0] });
        });
      });
      return out;
    }
    R.coll_offset = { cat: 'debts', name: 'التحصيل حسب طريقة القبض (نقدي · بنوك · مقاصة)', desc: 'سندات التحصيل من العملاء مصنّفة حسب الحساب الذي دخل فيه المبلغ: صندوق (نقدي) أو مصرف (بنوك) أو حساب آخر (مقاصة: تسوية دين العميل مقابل حساب آخر دون نقد). حركات المقاصة تفصيلياً، أو كل التحصيل، أو ملخصاً حسب الحساب المقابل أو العميل',
      params: ['period', 'flt'], fdims: ['cust', 'xcust'],
      sel: [['view', 'العرض', [['oth', 'حركات المقاصة (تفصيلي)'], ['all', 'كل التحصيل (تفصيلي)'], ['acc', 'ملخص حسب الحساب المقابل'], ['cust', 'ملخص حسب العميل']]]],
      run: function (p) {
        var f = parseFilter(p.flt), L = collLines(p.from, p.to, f ? recvFor(f) : null), view = p.view || 'oth';
        if (!L.length) return emptyR('لا يوجد تحصيل من العملاء في الفترة');
        var tot = { 'نقدي': 0, 'بنوك': 0, 'مقاصة': 0 }, all = 0, offE = {}, offAcc = {}, offCus = {};
        L.forEach(function (x) { tot[x.kind] += x.amt; all += x.amt; if (x.kind === 'مقاصة') { offE[x.e] = 1; offAcc[x.acc] = 1; x.cust.forEach(function (c) { offCus[c] = 1; }); } });
        var kpis = [
          { l: 'المقاصة', v: tot['مقاصة'], t: 'money', s: Object.keys(offE).length + ' سند · ' + pct(tot['مقاصة'], all).toFixed(1) + '% من التحصيل', bad: tot['مقاصة'] > 0.5 },
          { l: 'نقدي (الصناديق)', v: tot['نقدي'], t: 'money', s: pct(tot['نقدي'], all).toFixed(1) + '% من التحصيل' },
          { l: 'بنوك (المصارف)', v: tot['بنوك'], t: 'money', s: pct(tot['بنوك'], all).toFixed(1) + '% من التحصيل' },
          { l: 'إجمالي التحصيل', v: all, t: 'money', s: 'كما في بطاقة التحصيل' },
          { l: 'الحسابات المقابلة في المقاصة', v: Object.keys(offAcc).length, t: 'int', s: Object.keys(offCus).length + ' عميل' }
        ];
        var note = 'المقاصة = سند قبض خُصم من حساب العميل وحُمِّل المبلغ على حساب آخر غير الصناديق والمصارف (مثل حساب فرع أو مورد أو عميل آخر)، أي تسوية لدين العميل دون دخول نقد · نوع الحساب من تعريف الصناديق والبنوك في الإعدادات، وإلا من اسمه والحسابات فوقه · السند الذي فيه أكثر من حساب مدين يُوزّع مبلغه بنسبتها';
        var cname = function (ids) { return ids.map(function (a) { return accName(a); }).join('\n'); };
        var acode = function (a) { var x = acc(a); return x ? x.code + ' · ' + x.name : a; };
        var rows, cols, title, total;
        if (view === 'oth' || view === 'all') {
          var list = L.filter(function (x) { return view === 'all' || x.kind === 'مقاصة'; });
          if (!list.length) return Object.assign(emptyR('لا توجد حركات مقاصة في الفترة: كل التحصيل نقدي أو بنكي'), { kpis: kpis });
          // تجميع تحت الحساب المقابل (المقاصة) أو تحت طريقة القبض (الكل)
          var gk = view === 'oth' ? function (x) { return x.acc; } : function (x) { return x.kind; };
          var gn = view === 'oth' ? function (x) { return acode(x.acc); } : function (x) { return x.kind; };
          var G = {}; list.forEach(function (x) { var k = gk(x), g = G[k] || (G[k] = { name: gn(x), l: [], amt: 0 }); g.l.push(x); g.amt += x.amt; });
          var ord = view === 'all' ? ['نقدي', 'بنوك', 'مقاصة'] : Object.keys(G).sort(function (a, b) { return G[b].amt - G[a].amt; });
          rows = [];
          ord.filter(function (k) { return G[k]; }).forEach(function (k, gi) {
            var g = G[k], ne = {}; g.l.forEach(function (x) { ne[x.e] = 1; });
            rows.push({ _g: gi, _gh: 1, _b: true, name: g.name + ' (' + Object.keys(ne).length + ' سند)', amt: g.amt, share: pct(g.amt, view === 'oth' ? tot['مقاصة'] : all) });
            g.l.sort(function (a, b) { return a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : 0; }).forEach(function (x) {
              rows.push({ _g: gi, _lvl: 1, name: cname(x.cust), d: x.d, no: x.no, btn: x.btn, kind: x.kind, cacc: acode(x.acc), amt: x.amt, ed: x.ed });
            });
          });
          var lt = list.reduce(function (s, x) { return s + x.amt; }, 0);
          total = { name: 'الإجمالي', _b: true, amt: lt, share: 100 };
          cols = [C('name', view === 'oth' ? 'الحساب المقابل / العميل' : 'طريقة القبض / العميل', 'long'), C('d', 'التاريخ'), C('no', 'رقم السند'), C('btn', 'نوع السند')];
          if (view === 'all') cols.push(C('cacc', 'الحساب المدين', 'long'));
          cols = cols.concat([C('amt', 'المبلغ', 'money'), C('share', 'من المجموعة %', 'pct'), C('ed', 'البيان', 'long')]);
          title = view === 'oth' ? 'حركات المقاصة في التحصيل' : 'التحصيل حسب طريقة القبض';
          return withNote({ title: title, kpis: kpis, rows: rows, total: total, cols: cols, note: note, _grouped: true, _noCust: true }, p);
        }
        // الملخصات
        var S = {};
        L.forEach(function (x) {
          var keys = view === 'acc' ? [x.kind === 'مقاصة' ? x.acc : x.kind] : [x.cmain];
          keys.forEach(function (k) { var r = S[k] || (S[k] = { k: k, name: view === 'acc' ? (x.kind === 'مقاصة' ? acode(x.acc) : 'كل ' + (x.kind === 'نقدي' ? 'الصناديق' : 'المصارف')) : accName(k), kind: view === 'acc' ? x.kind : '', e: {}, cash: 0, bank: 0, off: 0, amt: 0, last: '' }); r.e[x.e] = 1; r.amt += x.amt; if (x.kind === 'نقدي') r.cash += x.amt; else if (x.kind === 'بنوك') r.bank += x.amt; else r.off += x.amt; if (x.d > r.last) r.last = x.d; });
        });
        rows = Object.keys(S).map(function (k) { var r = S[k]; return { name: r.name, kind: r.kind, n: Object.keys(r.e).length, cash: r.cash, bank: r.bank, off: r.off, amt: r.amt, op: pct(r.off, r.amt), share: pct(r.amt, all), last: r.last }; });
        if (view === 'cust') rows = rows.filter(function (r) { return r.off > 0.005 || !p._onlyOff; });
        rows.sort(function (a, b) { return view === 'acc' ? (a.kind === 'مقاصة') - (b.kind === 'مقاصة') || b.amt - a.amt : b.off - a.off || b.amt - a.amt; });
        total = sumRow(rows, [C('n', '', 'int'), C('cash', '', 'money'), C('bank', '', 'money'), C('off', '', 'money'), C('amt', '', 'money')]); total.op = pct(total.off, total.amt); total.share = 100;
        cols = view === 'acc'
          ? [C('name', 'الحساب المقابل'), C('kind', 'الطريقة'), C('n', 'عدد السندات', 'int'), C('amt', 'المبلغ', 'money'), C('share', 'من التحصيل %', 'pct'), C('last', 'آخر حركة')]
          : [C('name', 'العميل'), C('n', 'عدد السندات', 'int'), C('cash', 'نقدي', 'money'), C('bank', 'بنوك', 'money'), C('off', 'مقاصة', 'money'), C('amt', 'إجمالي التحصيل', 'money'), C('op', 'المقاصة %', 'pct'), C('last', 'آخر تحصيل')];
        return withNote({ title: view === 'acc' ? 'التحصيل حسب الحساب المقابل' : 'التحصيل حسب العميل وطريقة القبض', kpis: kpis, rows: rows, total: total, cols: cols, note: note, _noCust: view === 'acc',
          chart: view === 'acc' ? { type: 'hbar', x: 'name', y: ['amt'], yl: ['المبلغ'], limit: 12 } : null }, p);
      } };
