    /* ===================== مجموعات العملاء =====================
       مجموعة = اسم + حساب أو أكثر من دليل العملاء (رئيسي أو فرعي)، مثل «وكلاء المنطقة الشرقية» أو «الفروع».
       كل عميل تحت أي حساب في المجموعة يتبعها. إن وقع العميل في أكثر من مجموعة يتبع الأدق (الحساب الأعمق)، ثم الأسبق ترتيباً.
       وبدون تعريف مجموعات تعمل التقارير «حسب الحساب الرئيسي الأب» مباشرة من الدليل. */
    (function () {
      var ci = CATS.map(function (c) { return c[0]; }).indexOf('cust1');
      CATS.splice(ci + 1, 0, ['cgrp', 'مجموعات العملاء']);
    })();
    var CG_NONE = '~';
    function cgList() {
      var l = F.config && Array.isArray(F.config.cgroups) ? F.config.cgroups : null;
      if (!l) { try { l = JSON.parse(localStorage.getItem('rk.finCgroups') || 'null'); } catch (e) { l = null; } }
      return (l || []).filter(function (g) { return g && g.id && g.name; });
    }
    // سلسلة الحسابات من العميل صعوداً إلى أعلى الدليل
    function ancOf(id) {
      var c = F.cache.anc || (F.cache.anc = {});
      if (c[id]) return c[id];
      var out = [], a = acc(id), guard = 0;
      while (a && guard++ < 20) { out.push(a); a = a.parent ? acc(a.parent) : null; }
      return (c[id] = out);
    }
    // مجموعة العميل (للتقارير التي تقسم المجموع على المجموعات)
    function cgOf(ck) {
      var c = F.cache.cgOf || (F.cache.cgOf = {});
      if (c[ck] !== undefined) return c[ck];
      var best = CG_NONE, bestLvl = -1, gs = cgList(), an = ancOf(ck);
      gs.forEach(function (g) {
        an.forEach(function (a) { if ((g.codes || []).indexOf(String(a.code)) >= 0 && a.lvl > bestLvl) { best = g.id; bestLvl = a.lvl; } });
      });
      return (c[ck] = best);
    }
    function cgIn(ck, gid) {
      if (gid === CG_NONE) return cgOf(ck) === CG_NONE;
      var g = cgList().filter(function (x) { return x.id === gid; })[0]; if (!g) return false;
      return ancOf(ck).some(function (a) { return (g.codes || []).indexOf(String(a.code)) >= 0; });
    }
    function cgName(gid) { if (gid === CG_NONE) return 'بدون مجموعة'; var g = cgList().filter(function (x) { return x.id === gid; })[0]; return g ? g.name : gid; }
    function cgMatch(list, ck) { return list.some(function (x) { return cgIn(ck, String(x).replace(/^@/, '')); }); }
    // تصفية «حساب عملاء رئيسي أو فرعي»: العميل نفسه أو أي حساب فوقه
    function caccMatch(list, ck) { var ids = ancOf(ck).map(function (a) { return a.id; }); return list.some(function (x) { return ids.indexOf(String(x).replace(/^@/, '')) >= 0; }); }
    // الحسابات الرئيسية في دليل العملاء (بين حسابات العملاء المحددة في الإعدادات وحسابات العملاء الفرعية)
    function custTreeAccs() {
      if (F.cache.ctree) return F.cache.ctree;
      var leaves = recvIds(), roots = {}, seen = {};
      leaves.forEach(function (id) {
        var an = ancOf(id).slice(1), s = settings(), codes = String((s && s.recv) || '1601').split(',');
        var cut = an.length; for (var i = 0; i < an.length; i++) if (codes.indexOf(String(an[i].code)) >= 0) { cut = i + 1; roots[an[i].id] = 1; break; }
        an.slice(0, cut).forEach(function (a) { seen[a.id] = 1; });
      });
      return (F.cache.ctree = F.D.accList.filter(function (a) { return seen[a.id]; }));
    }
    function settings() { return (F.meta && F.meta.settings) || {}; }
    // مفتاح التجميع: المجموعات المعرّفة، أو الحساب الأب مباشرة
    function cgKeyFn(p) {
      if (cgBy(p) === 'grp') return { key: function (ck) { return cgOf(ck); }, name: cgName, label: 'المجموعة' };
      return { key: function (ck) { var a = acc(ck); return a && a.parent ? a.parent : CG_NONE; }, name: function (k) { return k === CG_NONE ? 'بدون حساب' : (acc(k) ? acc(k).name : k); }, label: 'الحساب الأب' };
    }
    function cgBy(p) { return p.cgby === 'parent' || !cgList().length ? 'parent' : 'grp'; }
    var CG_SEL = [['cgby', 'التجميع حسب', [['grp', 'المجموعات المعرّفة'], ['parent', 'الحساب الأب في الدليل']]]];
    var CG_F = ['cust', 'cacc', 'cgrp', 'item', 'st', 'ag', 'cat', 'xcust', 'xcgrp', 'xitem'];
    function cgNote(p) { return cgBy(p) === 'grp' ? 'التجميع حسب مجموعات العملاء المعرّفة في الإعدادات' : (cgList().length ? 'التجميع حسب الحساب الرئيسي الأب لكل عميل' : 'لم تُعرَّف مجموعات عملاء بعد، فالتجميع حسب الحساب الرئيسي الأب لكل عميل. عرّف المجموعات من الإعدادات ← مجموعات العملاء.'); }
    function cgOrder(keys, p) {
      if (cgBy(p) === 'grp') { var ord = cgList().map(function (g) { return g.id; }).concat([CG_NONE]); return keys.sort(function (a, b) { return ord.indexOf(a) - ord.indexOf(b); }); }
      return keys;
    }

    // المؤشرات الأساسية لكل مجموعة: مبيعات وربح وعملاء وتحصيل وأرصدة
    function cgAgg(p) {
      var K = cgKeyFn(p), g = {};
      var mk = function (k) { return g[k] || (g[k] = { k: k, name: K.name(k), sales: 0, ret: 0, profit: 0, cost: 0, qty: 0, inv: {}, cust: {}, items: {}, coll: 0, bal: 0, od: 0, ncust: 0, pnet: 0 }); };
      facts('s', p.from, p.to, p.flt).forEach(function (x) {
        var r = mk(K.key(x.v.ck));
        if (x.s > 0) { r.sales += x.val; r.inv[x.v.id] = 1; r.cust[x.v.ck] = 1; r.items[x.l.item] = 1; } else r.ret += x.val;
        r.profit += x.s * x.profit; r.cost += x.s * x.cost; r.qty += x.s * x.qty;
      });
      var pr = prevRange(p.from, p.to, p.preset);
      facts('s', pr[0], pr[1], p.flt).forEach(function (x) { mk(K.key(x.v.ck)).pnet += x.s * x.val; });
      var coll = collections(p.from, p.to, '', true), ids = recvFor(p.flt);
      ids.forEach(function (id) {
        var r = mk(K.key(id)), b = balance([id], null, p.to).close;
        r.ncust++; r.bal += b; r.coll += coll[id] || 0; if (b > 0.0005) r.od += overdue(id, p.to, 90);
      });
      return cgOrder(Object.keys(g), p).map(function (k) {
        var r = g[k], net = r.sales - r.ret, n = Object.keys(r.inv).length, act = Object.keys(r.cust).length;
        return { k: k, name: r.name, ncust: r.ncust, act: act, n: n, sales: r.sales, ret: r.ret, rp: pct(r.ret, r.sales), net: net, profit: r.profit, margin: pct(r.profit, net), qty: r.qty, items: Object.keys(r.items).length,
          avgc: act ? net / act : 0, avgi: n ? r.sales / n : 0, coll: r.coll, cr: pct(r.coll, net), bal: r.bal, od: r.od, odp: pct(r.od, r.bal), pnet: r.pnet, ch: net - r.pnet, chp: r.pnet ? (net - r.pnet) / Math.abs(r.pnet) * 100 : '' };
      }).filter(function (r) { return r.net || r.ncust || r.bal || r.pnet; });
    }

    R.cg_summary = { cat: 'cgrp', name: 'ملخص مجموعات العملاء', desc: 'لكل مجموعة (مثل وكلاء المنطقة الشرقية والغربية والفروع): العملاء والنشطون والفواتير والمبيعات والربح والهامش والحصة والتحصيل والأرصدة والدين القديم', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) {
        var rows = cgAgg(p), tn = sum(rows, 'net'); rows.forEach(function (r) { r.share = pct(r.net, tn); });
        var K = cgKeyFn(p);
        var cols = [C('name', K.label), C('ncust', 'العملاء', 'int'), C('act', 'النشطون', 'int'), C('n', 'الفواتير', 'int'), C('net', 'صافي المبيعات', 'money'), C('share', 'الحصة', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'),
          C('rp', 'المرتجعات %', 'pct'), C('avgc', 'متوسط العميل', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'التحصيل %', 'pct'), C('bal', 'الأرصدة', 'money'), C('od', 'دين +90 يوماً', 'money'), C('chp', 'التغير عن السابقة', 'pct')];
        var t = sumRow(rows, cols); t.share = 100; t.avgc = t.act ? t.net / t.act : 0; t.cr = pct(t.coll, t.net); var tp = sum(rows, 'pnet'); t.chp = tp ? (t.net - tp) / Math.abs(tp) * 100 : '';
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p), chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] } }, p);
      } };
    R.cg_month = { cat: 'cgrp', name: 'مجموعات العملاء شهرياً', desc: 'جدول: صف لكل مجموعة وعمود لكل شهر، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) { var K = cgKeyFn(p); var r = repPivot(p, function (x) { return K.key(x.v.ck); }, function (x, k) { return K.name(k || K.key(x.v.ck)); }, function (x) { return x.d.slice(0, 7); }, function (x) { return monthLabel(x.d.slice(0, 7)); }, p.rmeas, function (a, b) { return a.k < b.k ? -1 : 1; }); r.cols[0].l = K.label; r.note = cgNote(p); return withNote(r, p); } };
    R.cg_customers = { cat: 'cgrp', name: 'عملاء كل مجموعة', desc: 'كل مجموعة وتحتها عملاؤها: المبيعات والربح والهامش والفواتير والتحصيل والرصيد وآخر شراء', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL.concat([['cact', 'العملاء', [['act', 'من اشترى في الفترة'], ['all', 'كل العملاء (مع الأرصدة)']]]]),
      run: function (p) {
        var K = cgKeyFn(p), cm = custMetrics(p), by = {}, seen = {};
        cm.forEach(function (o) { if (!o.net && !o.sales) return; seen[o.k] = 1; (by[K.key(o.k)] = by[K.key(o.k)] || []).push({ name: o.name, n: o.n, net: o.net, profit: o.profit, margin: o.margin, coll: o.coll, bal: o.bal, last: o.last, _c1: o.k }); });
        if (p.cact === 'all') recvFor(p.flt).forEach(function (id) { if (seen[id]) return; var b = balance([id], null, p.to).close; if (Math.abs(b) < 0.0005) return; (by[K.key(id)] = by[K.key(id)] || []).push({ name: accName(id), n: 0, net: 0, profit: 0, margin: 0, coll: 0, bal: b, last: '', _c1: id }); });
        var rows = [];
        cgOrder(Object.keys(by), p).forEach(function (k) {
          var l = by[k].sort(function (a, b) { return b.net - a.net || (Number(b.bal) || 0) - (Number(a.bal) || 0); }), h = { name: K.name(k) + ' (' + l.length + ' عميل)', n: sum(l, 'n'), net: sum(l, 'net'), profit: sum(l, 'profit'), coll: sum(l, 'coll'), bal: sum(l, function (r) { return Number(r.bal) || 0; }), _b: true, _hl: true };
          h.margin = pct(h.profit, h.net); rows.push(h); l.forEach(function (r) { r.name = '   ' + r.name; rows.push(r); });
        });
        var cols = [C('name', K.label + ' / العميل'), C('n', 'الفواتير', 'int'), C('net', 'صافي المبيعات', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('coll', 'التحصيل', 'money'), C('bal', 'الرصيد', 'money'), C('last', 'آخر شراء')];
        var hs = rows.filter(function (r) { return r._b; }), t = { name: 'الإجمالي', _b: true, n: sum(hs, 'n'), net: sum(hs, 'net'), profit: sum(hs, 'profit'), coll: sum(hs, 'coll'), bal: sum(hs, 'bal') }; t.margin = pct(t.profit, t.net);
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p) }, p);
      } };
    R.cg_items = { cat: 'cgrp', name: 'المجموعات × الأصناف', desc: 'جدول: صف لكل صنف وعمود لكل مجموعة، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'top', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) { var K = cgKeyFn(p); var r = repPivot(p, function (x) { return x.l.item; }, function (x) { return itemName(x.l.item); }, function (x) { return K.key(x.v.ck); }, function (x) { return K.name(K.key(x.v.ck)); }, p.rmeas); r.cols[0].l = 'الصنف'; r.note = cgNote(p); return withNote(topN(r, p), p); } };
    R.cg_compare = { cat: 'cgrp', name: 'مقارنة المجموعات بالفترة السابقة', desc: 'لكل مجموعة: المبيعات الآن وفي الفترة السابقة والتغير ونسبته، والربح والهامش والعملاء النشطون', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) {
        var rows = cgAgg(p).map(function (r) { return { name: r.name, net: r.net, pnet: r.pnet, ch: r.ch, chp: r.chp, profit: r.profit, margin: r.margin, act: r.act, _hl: r.ch < 0 }; }).sort(function (a, b) { return a.ch - b.ch; });
        var pr = prevRange(p.from, p.to, p.preset), K = cgKeyFn(p);
        var cols = [C('name', K.label), C('net', 'الآن', 'money'), C('pnet', 'الفترة السابقة', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('act', 'العملاء النشطون', 'int')];
        var t = sumRow(rows, cols); t.chp = t.pnet ? (t.net - t.pnet) / Math.abs(t.pnet) * 100 : '';
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p) + ' · الفترة السابقة: ' + pr[0] + ' إلى ' + pr[1], chart: { type: 'bar', x: 'name', y: ['net', 'pnet'], yl: ['الآن', 'السابقة'] } }, p);
      } };
    R.cg_collect = { cat: 'cgrp', name: 'تحصيل وأرصدة المجموعات', desc: 'لكل مجموعة: المبيعات والتحصيل ونسبته والأرصدة والدين الأقدم من 90 يوماً ونسبته وعدد العملاء المدينين', params: ['period', 'flt'], fdims: ['cust', 'cacc', 'cgrp', 'xcust', 'xcgrp'], sel: CG_SEL,
      run: function (p) {
        var K = cgKeyFn(p), deb = {}; recvFor(p.flt).forEach(function (id) { if (balance([id], null, p.to).close > 0.0005) deb[K.key(id)] = (deb[K.key(id)] || 0) + 1; });
        var rows = cgAgg(p).map(function (r) { return { name: r.name, net: r.net, coll: r.coll, cr: r.cr, bal: r.bal, od: r.od, odp: r.odp, ncust: r.ncust, deb: deb[r.k] || 0, _hl: r.odp > 30 }; });
        var cols = [C('name', K.label), C('ncust', 'العملاء', 'int'), C('deb', 'المدينون', 'int'), C('net', 'صافي المبيعات', 'money'), C('coll', 'التحصيل', 'money'), C('cr', 'التحصيل %', 'pct'), C('bal', 'الأرصدة', 'money'), C('od', 'دين +90 يوماً', 'money'), C('odp', 'نسبته من الرصيد', 'pct')];
        var t = sumRow(rows, cols); t.cr = pct(t.coll, t.net); t.odp = pct(t.od, t.bal);
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p), chart: { type: 'hbar', x: 'name', y: ['bal'], yl: ['الأرصدة'] } }, p);
      } };
    R.cg_reps = { cat: 'cgrp', name: 'المجموعات × المناديب', desc: 'جدول: صف لكل مجموعة وعمود لكل مندوب، بالقيمة أو الربح أو الكمية أو عدد الفواتير', params: ['period', 'rmeas', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) { var K = cgKeyFn(p); var r = repPivot(p, function (x) { return K.key(x.v.ck); }, function (x) { return K.name(K.key(x.v.ck)); }, function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag || '0'); }, p.rmeas); r.cols[0].l = K.label; r.note = cgNote(p); return withNote(r, p); } };
    R.cg_cats = { cat: 'cgrp', name: 'المجموعات × فئات المناديب', desc: 'جدول: صف لكل مجموعة وعمود لكل فئة مندوب (جملة، تجزئة، أسواق…)', params: ['period', 'rmeas', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) { var K = cgKeyFn(p); var r = repPivot(p, function (x) { return K.key(x.v.ck); }, function (x) { return K.name(K.key(x.v.ck)); }, function (x) { return repCat(x.v.ag); }, function (x) { return repCat(x.v.ag); }, p.rmeas); r.cols[0].l = K.label; r.note = cgNote(p); return withNote(r, p); } };
    R.cg_eval = { cat: 'cgrp', name: 'تقييم المجموعات', desc: 'لكل مجموعة: متوسط درجة التعامل مع عملائها وتوزيعهم على التقديرات، والعملاء المتوقفون', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) {
        var K = cgKeyFn(p), g = {}, gr = ['ممتاز', 'جيد جداً', 'جيد', 'مقبول', 'ضعيف', 'متوقف'];
        custMetrics(p).forEach(function (o) { if (!(o.net > 0 || o.prevOnly)) return; var k = K.key(o.k), r = g[k] || (g[k] = { k: k, n: 0, sc: 0, act: 0, net: 0 }); r.n++; r[o.grade] = (r[o.grade] || 0) + 1; r.net += o.net; if (o.net > 0) { r.act++; r.sc += o.score * o.net; } });
        var rows = cgOrder(Object.keys(g), p).map(function (k) { var r = g[k], o = { name: K.name(k), n: r.n, net: r.net, avg: r.net > 0 ? r.sc / r.net : 0 }; o.grade = grade(o.avg); gr.forEach(function (x, i) { o['g' + i] = r[x] || 0; }); return o; });
        var cols = [C('name', K.label), C('n', 'العملاء', 'int'), C('net', 'صافي المبيعات', 'money'), C('avg', 'متوسط الدرجة (موزون)', 'int'), C('grade', 'التقدير')].concat(gr.map(function (x, i) { return C('g' + i, x, 'int'); }));
        var t = sumRow(rows, cols); t.avg = ''; t.grade = '';
        return withNote({ cols: cols, rows: rows, total: t, note: cgNote(p) + ' · متوسط الدرجة موزون بمبيعات كل عميل', chart: { type: 'hbar', x: 'name', y: ['avg'], yl: ['متوسط الدرجة'] } }, p);
      } };
    R.cg_item_price = { cat: 'cgrp', name: 'سعر الصنف في كل مجموعة', desc: 'لأعلى الأصناف (أو صنف تختاره): متوسط سعر البيع في كل مجموعة والفرق عن متوسط الشركة وأقل وأعلى سعر', params: ['period', 'flt'], fdims: CG_F, sel: CG_SEL,
      run: function (p) {
        var K = cgKeyFn(p), byItem = {}, g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) { var up = unitPrice(x); if (up === null) return; var it = byItem[x.l.item] || (byItem[x.l.item] = { v: 0, q: 0 }); it.v += x.val; it.q += x.qty;
          var k = x.l.item + '|' + K.key(x.v.ck), r = g[k] || (g[k] = { item: x.l.item, gk: K.key(x.v.ck), v: 0, q: 0, pf: 0, mn: null, mx: null }); r.v += x.val; r.q += x.qty; r.pf += x.profit; if (r.mn === null || up < r.mn) r.mn = up; if (r.mx === null || up > r.mx) r.mx = up; });
        var items = Object.keys(byItem).sort(function (a, b) { return byItem[b].v - byItem[a].v; }), rows = [], lim = hasItemF(p.flt) ? items.length : Math.min(15, items.length);
        items.slice(0, lim).forEach(function (it) {
          var avg = byItem[it].q ? byItem[it].v / byItem[it].q : 0, sub = Object.keys(g).filter(function (k) { return g[k].item === it; }).map(function (k) { return g[k]; });
          rows.push({ name: itemName(it) + ' (' + unitOf(it) + ')', avgp: avg, q: byItem[it].q, v: byItem[it].v, _b: true, _hl: true });
          sub.sort(function (a, b) { return a.v / a.q - b.v / b.q; }).forEach(function (r) { var ap = r.q ? r.v / r.q : 0; rows.push({ name: '   ' + K.name(r.gk), avgp: ap, diff: ap - avg, diffp: avg ? (ap - avg) / avg * 100 : 0, mn: r.mn, mx: r.mx, q: r.q, v: r.v, margin: pct(r.pf, r.v) }); });
        });
        var cols = [C('name', 'الصنف / ' + K.label), C('avgp', 'متوسط السعر', 'money'), C('diff', 'الفرق عن متوسط الشركة', 'money'), C('diffp', 'الفرق %', 'pct'), C('mn', 'أقل سعر', 'money'), C('mx', 'أعلى سعر', 'money'), C('q', 'الكمية', 'qty'), C('v', 'القيمة', 'money'), C('margin', 'الهامش', 'pct')];
        return withNote({ cols: cols, rows: rows, note: cgNote(p) + (hasItemF(p.flt) ? '' : ' · يعرض أعلى 15 صنفاً؛ اختر صنفاً من التصفية لعرضه وحده') }, p);
      } };

    /* ---------- إعدادات مجموعات العملاء ---------- */
    function cgDraft() { if (!F.cgDraft) F.cgDraft = JSON.parse(JSON.stringify(cgList())); return F.cgDraft; }
    function cgStats() {
      var y0 = addD(today(), -365), s = {}; F.D.invs.forEach(function (v) { if (v.c !== SALE || v.d < y0) return; var k = cgOf(v.ck), o = s[k] || (s[k] = { n: {}, v: 0 }); o.n[v.ck] = 1; o.v += v.net; });
      return s;
    }
    function cgSettingsHTML() {
      var d = cgDraft(), live = !F.cgDirty, st = live ? cgStats() : {};
      var h = '<div class="card"><h2>مجموعات العملاء</h2><p class="small muted" style="margin:0 0 10px">اجمع العملاء في مجموعات تختار لكل منها حساباً أو أكثر من دليل العملاء (رئيسياً أو فرعياً)، مثل «وكلاء المنطقة الشرقية» أو «الفروع». كل العملاء تحت هذه الحسابات يتبعون المجموعة، وتظهر التقارير حسبها في قسم «مجموعات العملاء»، ويمكن التصفية بها في كل التقارير.</p>';
      if (!d.length) h += '<div class="empty" style="margin:0 0 10px">لا توجد مجموعات بعد. أنشئها يدوياً، أو اضغط «إنشاء من الحسابات الرئيسية» لتُنشأ مجموعة لكل حساب رئيسي تحت العملاء.</div>';
      h += '<div class="cg-list">' + d.map(function (g, i) {
        var o = st[g.id];
        return '<div class="cg-item"><div class="cg-top"><span class="cg-ord">' + (i + 1) + '</span><input class="input cg-name" data-cgname="' + i + '" value="' + esc(g.name) + '" placeholder="اسم المجموعة">' +
          '<button class="btn sm ghost" data-cgup="' + i + '"' + (i ? '' : ' disabled') + ' aria-label="أعلى">▲</button><button class="btn sm ghost" data-cgdn="' + i + '"' + (i < d.length - 1 ? '' : ' disabled') + ' aria-label="أسفل">▼</button><button class="btn sm ghost danger" data-cgdel="' + i + '">حذف</button></div>' +
          '<div class="st-pills cg-accs">' + (g.codes || []).map(function (c, j) { var a = F.D.byCode[c]; return '<span class="col-pill"><b class="num">' + esc(c) + '</b> ' + esc(a ? a.name : '(غير موجود)') + '<button type="button" data-cgrm="' + i + '|' + j + '" aria-label="إزالة">×</button></span>'; }).join('') +
          '<button class="btn sm" data-cgacc="' + i + '">+ حسابات</button></div>' +
          (o ? '<div class="small muted">آخر سنة: ' + fk(Object.keys(o.n).length) + ' عميل اشترى · مبيعات ' + fm(o.v) + '</div>' : (live && (g.codes || []).length ? '<div class="small muted">لا مبيعات لعملاء هذه المجموعة في آخر سنة</div>' : '')) + '</div>';
      }).join('') + '</div>';
      var none = st[CG_NONE];
      if (live && d.length && none) h += '<p class="small" style="margin:8px 0 0">عملاء خارج كل المجموعات (آخر سنة): ' + fk(Object.keys(none.n).length) + ' · مبيعات ' + fm(none.v) + '</p>';
      h += '<div class="row" style="margin-top:12px;flex-wrap:wrap;gap:8px"><button class="btn" data-cgadd>+ مجموعة جديدة</button><button class="btn ghost" data-cgauto>إنشاء من الحسابات الرئيسية</button><span class="grow small muted">' + (F.cgDirty ? 'لديك تعديلات غير محفوظة' : '') + '</span>' +
        (F.cgDirty ? '<button class="btn ghost" data-cgundo>تراجع</button>' : '') + '<button class="btn primary" data-cgsave' + (canEdit() ? '' : ' disabled') + '>حفظ</button></div>' +
        '<p class="small muted" style="margin:10px 0 0">إن وقع عميل تحت حسابات أكثر من مجموعة، يتبع المجموعة ذات الحساب الأدق (الأعمق في الدليل)، ثم الأعلى في هذه القائمة.</p></div>';
      return h;
    }
    function bindCgSettings(m) {
      var d = cgDraft(), dirty = function () { F.cgDirty = true; };
      qa('[data-cgname]', m).forEach(function (el) { el.oninput = function () { d[Number(el.dataset.cgname)].name = el.value; dirty(); }; });
      qa('[data-cgdel]', m).forEach(function (b) { b.onclick = function () { d.splice(Number(b.dataset.cgdel), 1); dirty(); A.render(); }; });
      qa('[data-cgup]', m).forEach(function (b) { b.onclick = function () { var i = Number(b.dataset.cgup); d.splice(i - 1, 0, d.splice(i, 1)[0]); dirty(); A.render(); }; });
      qa('[data-cgdn]', m).forEach(function (b) { b.onclick = function () { var i = Number(b.dataset.cgdn); d.splice(i + 1, 0, d.splice(i, 1)[0]); dirty(); A.render(); }; });
      qa('[data-cgrm]', m).forEach(function (b) { b.onclick = function () { var x = b.dataset.cgrm.split('|'); d[Number(x[0])].codes.splice(Number(x[1]), 1); dirty(); A.render(); }; });
      var tree = custTreeAccs().map(function (a) { return a.id; }), leaves = {}; recvIds().forEach(function (id) { leaves[id] = 1; });
      var inTree = function (a) { return tree.indexOf(a.id) >= 0 || leaves[a.id]; };
      qa('[data-cgacc]', m).forEach(function (b) {
        b.onclick = function () {
          var g = d[Number(b.dataset.cgacc)];
          pickAccount({ multi: true, value: (g.codes || []).slice(), title: 'حسابات «' + (g.name || 'المجموعة') + '»', hint: 'اختر حساباً رئيسياً (فيدخل كل العملاء تحته) أو حسابات عملاء فرعية بعينها. يمكن اختيار أكثر من حساب.', filter: inTree })
            .then(function (codes) { if (!codes) return; g.codes = codes; if (!g.name && codes.length === 1 && F.D.byCode[codes[0]]) g.name = F.D.byCode[codes[0]].name; dirty(); A.render(); });
        };
      });
      q('[data-cgadd]', m).onclick = function () { d.push({ id: 'g' + Date.now().toString(36), name: '', codes: [] }); dirty(); A.render(); setTimeout(function () { var el = qa('[data-cgname]', document).pop(); if (el) el.focus(); }, 30); };
      q('[data-cgauto]', m).onclick = function () {
        // حساب رئيسي لكل مجموعة: الأبناء المباشرون لحسابات العملاء التي لها عملاء تحتها
        var s = settings(), roots = String(s.recv || '1601').split(','), have = {}; d.forEach(function (g) { (g.codes || []).forEach(function (c) { have[c] = 1; }); });
        var added = 0;
        custTreeAccs().forEach(function (a) { var p0 = a.parent ? acc(a.parent) : null; if (!a.leaf && p0 && roots.indexOf(String(p0.code)) >= 0 && !have[a.code]) { d.push({ id: 'g' + Date.now().toString(36) + added, name: a.name, codes: [String(a.code)] }); have[a.code] = 1; added++; } });
        if (!added) { toast('لا توجد حسابات رئيسية جديدة تحت حسابات العملاء'); return; }
        dirty(); toast('أُضيفت ' + added + ' مجموعة، راجعها ثم احفظ'); A.render();
      };
      var un = q('[data-cgundo]', m); if (un) un.onclick = function () { F.cgDraft = null; F.cgDirty = false; A.render(); };
      q('[data-cgsave]', m).onclick = function () {
        var bad = d.filter(function (g) { return !String(g.name || '').trim() || !(g.codes || []).length; })[0];
        if (bad) { toast('لكل مجموعة اسم وحساب واحد على الأقل', true); return; }
        var val = d.map(function (g) { return { id: g.id, name: String(g.name).trim().slice(0, 60), codes: g.codes.slice(0, 200) }; }), b = this; busy(b, true);
        var done = function (local) { F.cgDraft = null; F.cgDirty = false; resetCache(); toast(local ? 'حُفظت على هذا الجهاز فقط حتى يُحدَّث الخادم' : 'حُفظت مجموعات العملاء'); A.render(); };
        call('fin_config_save', { key: 'cgroups', value: val.length ? val : null }).then(function (r) {
          F.config = r.config || {}; if (!val.length) delete F.config.cgroups; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); try { localStorage.removeItem('rk.finCgroups'); } catch (e) {} done(false);
        }).catch(function (e) {
          if (!/غير معروف/.test(e.message)) { busy(b, false); toast(e.message, true); return; }
          try { localStorage.setItem('rk.finCgroups', JSON.stringify(val)); } catch (x) {} if (F.config) delete F.config.cgroups; done(true);
        });
      };
    }

    /* ---------- تجميع صفوف العملاء حسب الحسابات أو المجموعات المحددة في التصفية ---------- */
    // عند اختيار أكثر من حساب عملاء (أو مجموعة) في التصفية، تُعرض كل مجموعة بعنوان وإجمالي وتحتها عملاؤها
    var GRP_NOSUM = /^(margin|share|rp|cr|ch|chp|diffp|odp|pch|use|avg|avgp|avgc|avgi|ppi|upp|score|grade|dso|pd|gap|since|ratio|pmin|pmax|mn|mx|lim|cov|mratio|p|lp|up|s_\w+)$/;
    function custNameMap() {
      if (F.cache.cnm) return F.cache.cnm;
      var m = {}; F.D.invs.forEach(function (v) { if (v.name && !m[v.name]) m[v.name] = v.ck; });
      recvIds().forEach(function (id) { var a = acc(id); if (a && !m[a.name]) m[a.name] = id; });
      return (F.cache.cnm = m);
    }
    // التجميع: حسب الحسابات/المجموعات المحددة في التصفية (تلقائي عند اختيار أكثر من واحد)،
    // أو حسب قالب التجميع المختار للتقرير أو الافتراضي لكل التقارير: مجموعات العملاء أو الحساب الأب
    var GRP_MODES = [['none', 'بدون تجميع'], ['grp', 'حسب مجموعات العملاء'], ['parent', 'حسب الحساب الأب']];
    function grpDefault() { var u = (F.config && F.config.ui) || null; if (!u) { try { u = JSON.parse(localStorage.getItem('rk.finUi') || 'null'); } catch (e) { u = null; } } return (u && u.grp) || 'none'; }
    function grpMode(p) { var m = p && p.cgx && p.cgx !== 'auto' ? p.cgx : grpDefault(); if (m === 'grp' && !cgList().length) m = 'parent'; return m; }
    function groupBySel(res, flt, mode) {
      var f = parseFilter(flt) || {};
      if (!res || res.empty || !res.rows || !res.rows.length) return res;
      if (res.rows.some(function (r) { return r._b || r._lvl; })) return res;
      var nm = custNameMap();
      // عمود العميل: أول عمود نصي تُعرف قيمه كعملاء
      var textCols = res.cols.filter(function (c) { return !isNum(c); }), ccol = null, best = 0;
      textCols.slice(0, 3).forEach(function (c) { var n = res.rows.filter(function (r) { return r._c1 || r._ck || r._acc || nm[plain(r[c.k]).trim()]; }).length; if (n > best) { best = n; ccol = c; } });
      if (!ccol || best < res.rows.length * 0.6) return res;
      res._custRows = true;
      var kind = f.cacc && f.cacc.length > 1 ? 'cacc' : f.cgrp && f.cgrp.length > 1 ? 'cgrp' : mode === 'grp' || mode === 'parent' ? mode : '';
      if (!kind) return res;
      var ckOf = function (r) { return r._c1 || r._ck || (r._acc && acc(r._acc) ? r._acc : null) || nm[plain(r[ccol.k]).trim()]; };
      var keyOf, label, order;
      if (kind === 'cacc' || kind === 'cgrp') {
        var sel = f[kind].map(function (x) { return String(x).replace(/^@/, ''); });
        keyOf = function (ck) {
          if (!ck) return null;
          if (kind === 'cgrp') { for (var i = 0; i < sel.length; i++) if (cgIn(ck, sel[i])) return sel[i]; return null; }
          var an = ancOf(ck).map(function (a) { return a.id; }), bi = null, bd = 1e9;
          sel.forEach(function (id) { var d = an.indexOf(id); if (d >= 0 && d < bd) { bd = d; bi = id; } });   // الأقرب للعميل (الأدق) يفوز
          return bi;
        };
        label = function (k) { if (kind === 'cgrp') return cgName(k); var a = acc(k); return a ? a.code + ' · ' + a.name : k; };
        order = sel;
      } else if (kind === 'grp') {
        keyOf = function (ck) { return ck ? cgOf(ck) : null; }; label = cgName; order = cgList().map(function (g) { return g.id; }).concat([CG_NONE]);
      } else {
        keyOf = function (ck) { var a = ck && acc(ck); return a && a.parent ? a.parent : null; }; label = function (k) { var a = acc(k); return a ? a.code + ' · ' + a.name : k; }; order = null;
      }
      var g = {}, keys = [], other = [];
      res.rows.forEach(function (r) { var k = keyOf(ckOf(r)); if (k === null || k === undefined) { other.push(r); return; } if (!g[k]) { g[k] = []; keys.push(k); } g[k].push(r); });
      if (order) keys.sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      var nums = res.cols.filter(function (c) { return isNum(c) && c.t !== 'pct' && !GRP_NOSUM.test(c.k); });
      var head = function (name, list, gi) {
        var h = { _b: true, _hl: true, _g: gi, _gh: 1 }; h[ccol.k] = name + ' (' + list.length + ')';
        nums.forEach(function (c) { h[c.k] = list.reduce(function (s, r) { return s + (Number(r[c.k]) || 0); }, 0); });
        if ('margin' in (list[0] || {}) && 'profit' in h && 'net' in h) h.margin = pct(h.profit, h.net);
        if ('ch' in (list[0] || {}) && 'cur' in h && 'prev' in h) h.ch = h.prev ? (h.cur - h.prev) / Math.abs(h.prev) * 100 : null;
        if ('chp' in (list[0] || {}) && 'net' in h && 'pnet' in h) h.chp = h.pnet ? (h.net - h.pnet) / Math.abs(h.pnet) * 100 : '';
        if ('share' in (list[0] || {})) h.share = list.reduce(function (s, r) { return s + (Number(r.share) || 0); }, 0);
        return h;
      };
      var main = nums[0] ? nums[0].k : null;
      if (!order && main) keys.sort(function (a, b) { var sa = g[a].reduce(function (s, r) { return s + (Number(r[main]) || 0); }, 0), sb = g[b].reduce(function (s, r) { return s + (Number(r[main]) || 0); }, 0); return sb - sa; });
      var rows = [];
      keys.forEach(function (k, i) { rows.push(head(label(k), g[k], i)); g[k].forEach(function (r) { rows.push(Object.assign({}, r, { _lvl: 1, _g: i })); }); });
      if (other.length) { rows.push(head(kind === 'cacc' || kind === 'cgrp' ? 'أخرى' : 'بدون حساب', other, keys.length)); other.forEach(function (r) { rows.push(Object.assign({}, r, { _lvl: 1, _g: keys.length })); }); }
      var out = Object.assign({}, res, { rows: rows, _lvlc: res.cols.indexOf(ccol), _grouped: kind });
      if (res.chart && !res.chart.rowsOverride) { var hs = rows.filter(function (r) { return r._gh; }).map(function (r) { var o = Object.assign({}, r); delete o._b; delete o._hl; if (res.chart.x && res.chart.x !== ccol.k) o[res.chart.x] = r[ccol.k]; return o; }); out.chart = Object.assign({}, res.chart, { rowsOverride: hs, limit: Math.max(hs.length, 1) }); }
      out.note = (res.note ? res.note + ' · ' : '') + 'مجمّع ' + (kind === 'cacc' ? 'حسب حسابات العملاء المحددة في التصفية' : kind === 'cgrp' ? 'حسب مجموعات العملاء المحددة في التصفية' : kind === 'grp' ? 'حسب مجموعات العملاء' : 'حسب الحساب الأب لكل عميل');
      return out;
    }
