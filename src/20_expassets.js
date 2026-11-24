    /* ===================== المصروفات والأصول وكشف مبيعات الأصناف ===================== */
    (function () { var ii = -1; CATS.forEach(function (c, i) { if (c[0] === 'acct') ii = i; }); CATS.splice(ii + 1, 0, ['exp', 'المصروفات'], ['assets', 'الأصول']); })();

    // اسم الحساب برمزه، ومعه الفرع عند عرض كل الفروع
    function acLabel(id) { var a = acc(id); if (!a) return id; return a.code + ' · ' + a.name + (multiBr() && viewBr() === '*' ? ' — ' + brName(a.br || '') : ''); }
    function depthUnder(id, roots) { var d = 1, a = acc(id), g = 0; while (a && !roots[a.id] && g++ < 20) { a = acc(a.parent); d++; } return a && roots[a.id] ? d : 0; }
    function monthsIn(from, to) { return Math.max(1, Math.round((new Date(to) - new Date(from)) / 864e5 + 1) / 30.44); }
    function lyRange(from, to) { var f = (Number(from.slice(0, 4)) - 1) + from.slice(4), t = (Number(to.slice(0, 4)) - 1) + to.slice(4); if (t.slice(5) === '02-29') t = t.slice(0, 8) + '28'; return [f, t]; }
    // جذور المصروفات: الحساب 32 «المصروفات» في كل فرع؛ وإلا فروع «الاستخدامات» (3) عدا المشتريات
    function expRoots() {
      if (F.cache.expRoots) return F.cache.expRoots;
      var r = (F.D.byCodeAll['32'] || []).map(function (a) { return a.id; });
      if (!r.length) r = F.D.accList.filter(function (a) { var p = acc(a.parent); return a.rootCode === '3' && p && p.code === '3' && !/مشتريات/.test(a.name); }).map(function (a) { return a.id; });
      return (F.cache.expRoots = r);
    }
    // جذور الأصول: الحساب 1 في كل فرع
    function assetRoots() { return (F.D.byCodeAll['1'] || []).map(function (a) { return a.id; }); }
    // مجموعة فرعية من الأصول حسب الاسم (ثابتة، متداولة، مخزون…)
    function assetGroup(re) {
      var out = [];
      assetRoots().forEach(function (r) { descend(r).forEach(function (id) { var a = acc(id), p = a && acc(a.parent); if (a && id !== r && re.test(a.name) && !(p && re.test(p.name))) out.push(id); }); });
      return out;
    }
    function idsOf(roots) { var o = []; roots.forEach(function (r) { o = o.concat(descend(r)); }); return o; }
    function sumBal(ids, from, to, sign) { var b = balance(ids, from, to); return { open: sign * b.open, mv: sign * (b.dr - b.cr), dr: b.dr, cr: b.cr, close: sign * b.close }; }

    /* ---------- المصروفات ---------- */
    var CMP_OPTS = [['prev', 'الفترة السابقة'], ['ly', 'نفس الفترة من السنة السابقة'], ['none', 'بدون مقارنة']];
    R.exp_summary = { cat: 'exp', name: 'تحليل المصروفات ومقارنتها', desc: 'شجرة حسابات المصروفات: المبلغ في الفترة ومقارنته بالفترة السابقة أو بالسنة السابقة، والتغير، والحصة، والمتوسط الشهري، والنسبة من صافي المبيعات',
      params: ['period', 'level'], sel: [['cmp', 'المقارنة', CMP_OPTS]],
      run: function (p) {
        var roots = expRoots(); if (!roots.length) return emptyR('لم يُعثر على حسابات المصروفات (الحساب 32 أو فروع الاستخدامات 3)');
        var rs = {}; roots.forEach(function (r) { rs[r] = 1; });
        var cmp = p.cmp || 'prev', pr = cmp === 'prev' ? prevRange(p.from, p.to, p.preset) : cmp === 'ly' ? lyRange(p.from, p.to) : null;
        var lvl = Number(p.level || 6), months = monthsIn(p.from, p.to), net = salesStats(p.from, p.to).net;
        var rows = [], leaves = [];
        roots.forEach(function (r) {
          descend(r).forEach(function (id) {
            var a = acc(id), d = depthUnder(id, rs); if (!a || !d || d > lvl) return;
            var ids = descend(id), cur = sumBal(ids, p.from, p.to, 1).mv, prv = pr ? sumBal(ids, pr[0], pr[1], 1).mv : 0;
            if (Math.abs(cur) < 0.0005 && Math.abs(prv) < 0.0005) return;
            var row = { code: a.code, name: a.name + (d === 1 && multiBr() && viewBr() === '*' ? ' — ' + brName(a.br || '') : ''), amt: cur, prev: prv, ch: cur - prv, chp: prv ? (cur - prv) / Math.abs(prv) * 100 : null, mavg: cur / months, ps: pct(cur, net), _acc: id, _lvl: d - 1, _b: !a.leaf && d < lvl };
            rows.push(row); if (a.leaf || d === lvl) leaves.push(row);
          });
        });
        if (!rows.length) return emptyR('لا توجد مصروفات في الفترة');
        var tot = roots.reduce(function (s0, r) { return s0 + sumBal(descend(r), p.from, p.to, 1).mv; }, 0);
        var totP = pr ? roots.reduce(function (s0, r) { return s0 + sumBal(descend(r), pr[0], pr[1], 1).mv; }, 0) : 0;
        rows.forEach(function (r) { r.share = pct(r.amt, tot); });
        var big = leaves.slice().sort(function (a, b) { return b.amt - a.amt; })[0] || {}, up = leaves.filter(function (r) { return r.prev > 0 && r.chp !== null && r.chp > 25 && r.ch > Math.max(500, tot * 0.002); }).sort(function (a, b) { return b.ch - a.ch; });
        var kpis = [
          { l: 'إجمالي المصروفات', v: tot, t: 'money', s: pr ? (totP ? ((tot - totP) / Math.abs(totP) * 100 >= 0 ? '▲ ' : '▼ ') + Math.abs((tot - totP) / Math.abs(totP) * 100).toFixed(1) + '% عن ' + (cmp === 'ly' ? 'السنة السابقة' : 'الفترة السابقة') : 'لا مصروفات في فترة المقارنة') : '', bad: pr && totP && tot > totP * 1.1 },
          { l: 'من صافي المبيعات', v: pct(tot, net), t: 'pct', s: 'صافي المبيعات ' + fm(net) },
          { l: 'المتوسط الشهري', v: tot / months, t: 'money', s: months.toFixed(1) + ' شهر' },
          { l: 'أكبر بند مصروف', v: big.amt || 0, t: 'money', s: big.name || '—' },
          { l: 'بنود ارتفعت بأكثر من 25%', v: up.length, t: 'int', s: up.length ? up.slice(0, 2).map(function (r) { return r.name; }).join('، ') : 'لا يوجد', bad: up.length > 0 }
        ];
        var cols = [C('code', 'الرمز'), C('name', 'الحساب', 'long'), C('amt', 'المبلغ', 'money')];
        if (pr) cols = cols.concat([C('prev', cmp === 'ly' ? 'السنة السابقة' : 'الفترة السابقة', 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct')]);
        cols = cols.concat([C('share', 'الحصة', 'pct'), C('mavg', 'المتوسط الشهري', 'money'), C('ps', 'من المبيعات %', 'pct')]);
        var total = { name: 'إجمالي المصروفات', _b: true, amt: tot, prev: totP, ch: tot - totP, chp: totP ? (tot - totP) / Math.abs(totP) * 100 : null, share: 100, mavg: tot / months, ps: pct(tot, net) };
        return withNote({ title: 'تحليل المصروفات' + (pr ? ' مقارنةً ب' + (cmp === 'ly' ? 'نفس الفترة من السنة السابقة' : 'الفترة السابقة') + ' (' + pr[0] + ' إلى ' + pr[1] + ')' : ''), kpis: kpis, rows: rows, cols: cols, total: total, _lvlc: 1,
          note: 'المبلغ = مدين − دائن على حسابات المصروفات في الفترة · اضغط أي سطر لكشف حسابه · الحسابات الختامية تبدأ من بداية السنة المالية',
          chart: { type: 'hbar', x: 'name', y: ['amt'], yl: ['المصروف'], limit: 12, rowsOverride: leaves.slice().sort(function (a, b) { return b.amt - a.amt; }).slice(0, 12) } }, p);
      } };

    // أسطر المصروفات في الفترة
    function expLines(from, to) {
      var rs = {}; idsOf(expRoots()).forEach(function (id) { rs[id] = 1; });
      var out = [];
      Object.keys(rs).forEach(function (id) {
        (F.D.byAcc[id] || []).forEach(function (l) {
          if (l.d < from || l.d > to || !(l.dr || l.cr)) return;
          var ls = F.D.byEntry[l.e] || [], side = l.dr ? 'cr' : 'dr';
          var cp = ls.filter(function (q) { return q !== l && q[side] && !rs[q.a]; }), cpA = {}; cp.forEach(function (q) { cpA[q.a] = (cpA[q.a] || 0) + q[side]; });
          var cpk = Object.keys(cpA).sort(function (a, b) { return cpA[b] - cpA[a]; });
          out.push({ l: l, e: l.e, d: l.d, dt: l.dt || l.d, no: l.no, btn: l.btn || '', a: l.a, amt: (l.dr || 0) - (l.cr || 0), cp: cpk, u: l.u, ed: l.ld || l.ed || '' });
        });
      });
      return out.sort(function (a, b) { return a.dt < b.dt ? -1 : a.dt > b.dt ? 1 : 0; });
    }
    function grpAcc(id, lvlFromRoot) {   // الحساب على مستوى معيّن تحت جذر المصروفات
      var rs = {}; expRoots().forEach(function (r) { rs[r] = 1; });
      var chain = [], a = acc(id), g = 0; while (a && g++ < 20) { chain.unshift(a.id); if (rs[a.id]) break; a = acc(a.parent); }
      return chain[Math.min(lvlFromRoot, chain.length - 1)];
    }
    var ED_GRP = [['none', 'بدون تجميع (حسب التاريخ)'], ['acc', 'حساب المصروف'], ['grp', 'مجموعة المصروف'], ['month', 'الشهر'], ['cp', 'الجهة المقابلة (من أين دُفع)'], ['user', 'المستخدم'], ['btn', 'نوع السند']];
    R.exp_detail = { cat: 'exp', name: 'كشف المصروفات التفصيلي', desc: 'كل حركة على حسابات المصروفات: التاريخ ورقم السند ونوعه والحساب والجهة المقابلة (الصندوق أو المصرف أو المورد) والمبلغ والبيان والمستخدم، مع التجميع والمجاميع الفرعية أو ملخص',
      params: ['period', 'search'], sel: [['grp', 'التجميع', ED_GRP], ['view', 'العرض', [['det', 'تفصيلي (كل حركة)'], ['sum', 'ملخص بالمجموعات']]]],
      run: function (p) {
        if (!expRoots().length) return emptyR('لم يُعثر على حسابات المصروفات');
        var s = String(p.search || '').trim(), grp = p.grp || 'none', view = p.view || 'det';
        var L = expLines(p.from, p.to).map(function (x) { x.accTxt = acLabel(x.a); x.cpTxt = x.cp.map(accName).join('\n'); x.userTxt = x.u ? userName(x.u) : ''; return x; })
          .filter(function (x) { return !s || (x.no + ' ' + x.accTxt + ' ' + x.cpTxt + ' ' + x.ed + ' ' + x.userTxt).indexOf(s) >= 0; });
        if (!L.length) return emptyR('لا توجد حركات مصروفات تطابق الاختيار');
        var tot = 0, ne = {}, ba = {}, bc = {}; L.forEach(function (x) { tot += x.amt; ne[x.e] = 1; ba[x.a] = (ba[x.a] || 0) + x.amt; if (x.cp[0]) bc[x.cp[0]] = (bc[x.cp[0]] || 0) + x.amt; });
        var topA = Object.keys(ba).sort(function (a, b) { return ba[b] - ba[a]; })[0], topC = Object.keys(bc).sort(function (a, b) { return bc[b] - bc[a]; })[0];
        var big = L.slice().sort(function (a, b) { return b.amt - a.amt; })[0];
        var kpis = [
          { l: 'إجمالي المصروفات', v: tot, t: 'money', s: L.length + ' حركة · ' + Object.keys(ne).length + ' سند' },
          { l: 'أكبر حساب مصروف', v: ba[topA] || 0, t: 'money', s: accName(topA) },
          { l: 'أكثر جهة دُفع منها', v: bc[topC] || 0, t: 'money', s: topC ? accName(topC) : '—' },
          { l: 'أكبر حركة', v: big.amt, t: 'money', s: big.btn + ' ' + big.no + ' · ' + accName(big.a) }
        ];
        var MON = MONTHS;
        var GK = {
          acc: function (x) { return [x.a, x.accTxt]; },
          grp: function (x) { var g = grpAcc(x.a, 1); return [g, acLabel(g)]; },
          month: function (x) { var m = x.d.slice(0, 7); return [m, MON[Number(m.slice(5)) - 1] + ' ' + m.slice(0, 4)]; },
          cp: function (x) { return [x.cp[0] || '', x.cp[0] ? acLabel(x.cp[0]) : 'بدون طرف مقابل']; },
          user: function (x) { return [x.u || '', x.userTxt || 'غير معروف']; },
          btn: function (x) { return [x.btn, x.btn || 'غير محدد']; }
        }[grp];
        var cols = [C('d', 'التاريخ'), C('no', 'رقم السند'), C('btn', 'نوع السند'), C('acc', 'حساب المصروف', 'long'), C('cp', 'الجهة المقابلة', 'long'), C('amt', 'المبلغ', 'money'), C('ed', 'البيان', 'long'), C('user', 'المستخدم')];
        var drop = { acc: 'acc', cp: 'cp', user: 'user', btn: 'btn' }[grp]; if (drop) cols = cols.filter(function (c) { return c.k !== drop; });
        var row = function (x, gi) { return { _g: gi, _lvl: gi === undefined ? 0 : 1, d: x.d, no: x.no, btn: x.btn, acc: x.accTxt, cp: x.cpTxt, amt: x.amt, ed: x.ed, user: x.userTxt, _acc: x.a }; };
        var note = 'المبلغ = مدين − دائن (القيد العكسي يظهر بالسالب) · الجهة المقابلة = الحساب الدائن في نفس السند (صندوق، مصرف، مورد، عهدة…) · اضغط أي سطر لكشف الحساب';
        if (!GK) return withNote({ title: 'كشف المصروفات التفصيلي', kpis: kpis, rows: L.map(function (x) { return row(x); }), cols: cols, total: { d: 'الإجمالي', _b: true, amt: tot }, note: note }, p);
        var G = {}, ord = [];
        L.forEach(function (x) { var k = GK(x), g = G[k[0]]; if (!g) { g = G[k[0]] = { name: k[1], l: [], amt: 0, e: {}, last: '' }; ord.push(g); } g.l.push(x); g.amt += x.amt; g.e[x.e] = 1; if (x.d > g.last) g.last = x.d; });
        if (grp !== 'month') ord.sort(function (a, b) { return b.amt - a.amt; });
        var gl = ED_GRP.filter(function (x) { return x[0] === grp; })[0][1];
        if (view === 'sum') {
          var rows = ord.map(function (g) { return { name: g.name, n: Object.keys(g.e).length, amt: g.amt, share: pct(g.amt, tot), avg: g.amt / g.l.length, last: g.last }; });
          var c2 = [C('name', gl, 'long'), C('n', 'عدد السندات', 'int'), C('amt', 'المبلغ', 'money'), C('share', 'الحصة', 'pct'), C('avg', 'متوسط الحركة', 'money'), C('last', 'آخر حركة')];
          return withNote({ title: 'المصروفات حسب ' + gl, kpis: kpis, rows: rows, cols: c2, total: { name: 'الإجمالي', _b: true, n: Object.keys(ne).length, amt: tot, share: 100 }, note: note,
            chart: grp === 'month' ? { type: 'bar', x: 'name', y: ['amt'], yl: ['المصروفات'] } : { type: 'hbar', x: 'name', y: ['amt'], yl: ['المصروفات'], limit: 12 } }, p);
        }
        var rows2 = [];
        ord.forEach(function (g, gi) { rows2.push({ _g: gi, _gh: 1, _b: true, d: g.name + ' — ' + Object.keys(g.e).length + ' سند', amt: g.amt, ed: pct(g.amt, tot).toFixed(1) + '% من المصروفات' }); g.l.forEach(function (x) { rows2.push(row(x, gi)); }); });
        return withNote({ title: 'كشف المصروفات حسب ' + gl, kpis: kpis, rows: rows2, cols: cols, total: { d: 'الإجمالي', _b: true, amt: tot }, note: note, _grouped: true }, p);
      } };

    R.exp_monthly = { cat: 'exp', name: 'المصروفات شهرياً (جدول محوري)', desc: 'صف لكل حساب مصروف وعمود لكل شهر، مع الإجمالي، لمتابعة تطور كل بند',
      params: ['period', 'level'],
      run: function (p) {
        var rs = {}, lvl = Number(p.level || 2); expRoots().forEach(function (r) { rs[r] = 1; });
        var ok = {}; idsOf(expRoots()).forEach(function (id) { var d = depthUnder(id, rs), a = acc(id); if (d && (d === lvl || (a.leaf && d < lvl))) ok[id] = 1; });
        var res = accMonthly(Object.assign({}, p, { level: 99 }), function (a) { return ok[a.id]; }, 'المصروف', 1, true);
        res.title = 'المصروفات شهرياً'; res.note = 'المبلغ = مدين − دائن لكل حساب في كل شهر · المستوى ' + lvl + ' تحت حساب المصروفات · اضغط أي سطر لكشف حسابه';
        res.rows.forEach(function (r) { var a = acc(r._acc); if (a && multiBr() && viewBr() === '*') r.name += ' — ' + brName(a.br || ''); });
        return res;
      } };

    /* ---------- الأصول ---------- */
    var ACMP = [['ys', 'بداية السنة المالية'], ['pm', 'نهاية الشهر السابق'], ['ly', 'نفس التاريخ من السنة السابقة'], ['none', 'بدون مقارنة']];
    R.assets_summary = { cat: 'assets', name: 'هيكل الأصول وتطورها', desc: 'شجرة الأصول بأرصدتها في تاريخ تختاره، ومقارنتها ببداية السنة أو بنهاية الشهر السابق، والتغير، وحصة كل بند، مع الأصول الثابتة والمتداولة والنقدية والذمم والمخزون',
      params: ['asof', 'level'], sel: [['cmp', 'المقارنة بـ', ACMP]],
      run: function (p) {
        var roots = assetRoots(); if (!roots.length) return emptyR('لم يُعثر على حساب الأصول (1)');
        var rs = {}; roots.forEach(function (r) { rs[r] = 1; });
        var asof = p.asof || p.to || today(), cmp = p.cmp || 'ys', lvl = Number(p.level || 3);
        var cd = cmp === 'ys' ? addD(yearStart(), -1) : cmp === 'pm' ? addD(asof.slice(0, 7) + '-01', -1) : cmp === 'ly' ? lyRange(asof, asof)[0] : null;
        var bal = function (ids, d) { return balance(ids, null, d).close; };
        var rows = [];
        roots.forEach(function (r) {
          descend(r).forEach(function (id) {
            var a = acc(id), d = depthUnder(id, rs); if (!a || !d || d > lvl + 1) return;
            if (d === 1 && roots.length === 1) return;   // الجذر نفسه يظهر في الإجمالي
            var ids = descend(id), v = bal(ids, asof), c = cd ? bal(ids, cd) : 0;
            if (Math.abs(v) < 0.0005 && Math.abs(c) < 0.0005) return;
            rows.push({ code: a.code, name: a.name + (d === 1 ? ' — ' + brName(a.br || '') : ''), bal: v, cmpv: c, ch: v - c, chp: c ? (v - c) / Math.abs(c) * 100 : null, _acc: id, _lvl: roots.length === 1 ? d - 2 : d - 1, _b: !a.leaf && d <= lvl });
          });
        });
        var tot = roots.reduce(function (s0, r) { return s0 + bal(descend(r), asof); }, 0), totC = cd ? roots.reduce(function (s0, r) { return s0 + bal(descend(r), cd); }, 0) : 0;
        rows.forEach(function (r) { r.share = pct(r.bal, tot); });
        var g = function (re) { var ids = idsOf(assetGroup(re)); return { v: bal(ids, asof), c: cd ? bal(ids, cd) : 0 }; };
        var fx = g(/ثابت/), cu = g(/متداول/), inv = g(/مخزون|المستودعات/);
        var cash = (function () { var ids = boxIds(''); return { v: bal(ids, asof), c: cd ? bal(ids, cd) : 0 }; })();
        var rcv = (function () { var ids = recvIds(); return { v: bal(ids, asof), c: cd ? bal(ids, cd) : 0 }; })();
        var chs = function (o) { return cd ? (o.v - o.c >= 0 ? '▲ ' : '▼ ') + fm(Math.abs(o.v - o.c)) + ' عن ' + cd : ''; };
        var kpis = [
          { l: 'إجمالي الأصول', v: tot, t: 'money', s: chs({ v: tot, c: totC }) },
          { l: 'الأصول الثابتة', v: fx.v, t: 'money', s: pct(fx.v, tot).toFixed(1) + '% · ' + chs(fx) },
          { l: 'الأصول المتداولة', v: cu.v, t: 'money', s: pct(cu.v, tot).toFixed(1) + '% · ' + chs(cu) },
          { l: 'النقدية والمصارف', v: cash.v, t: 'money', s: 'الصناديق والبنوك المعرّفة · ' + chs(cash) },
          { l: 'ذمم العملاء', v: rcv.v, t: 'money', s: chs(rcv) },
          { l: 'المخزون', v: inv.v, t: 'money', s: chs(inv) }
        ];
        var cols = [C('code', 'الرمز'), C('name', 'الحساب', 'long'), C('bal', 'الرصيد في ' + asof, 'money')];
        if (cd) cols = cols.concat([C('cmpv', 'الرصيد في ' + cd, 'money'), C('ch', 'التغير', 'money'), C('chp', 'التغير %', 'pct')]);
        cols.push(C('share', 'من الأصول %', 'pct'));
        var top = rows.filter(function (r) { return r._lvl === 0; });
        return withNote({ title: 'هيكل الأصول في ' + asof, kpis: kpis, rows: rows, cols: cols, _lvlc: 1, total: { name: 'إجمالي الأصول', _b: true, bal: tot, cmpv: totC, ch: tot - totC, chp: totC ? (tot - totC) / Math.abs(totC) * 100 : null, share: 100 },
          note: 'الرصيد = مدين − دائن من أول البيانات حتى التاريخ · الأصول الثابتة والمتداولة والمخزون حسب أسماء الحسابات في الدليل، والنقدية من الصناديق والبنوك المعرّفة، والذمم من حسابات العملاء في الإعدادات · اضغط أي سطر لكشف حسابه',
          chart: { type: 'hbar', x: 'name', y: ['bal'], yl: ['الرصيد'], rowsOverride: top.slice().sort(function (a, b) { return b.bal - a.bal; }).slice(0, 12) } }, p);
      } };

    R.fixed_assets = { cat: 'assets', name: 'الأصول الثابتة: الحركة والاهتلاك وصافي القيمة', desc: 'لكل أصل ثابت: رصيد أول المدة والإضافات والاستبعادات ورصيد آخر المدة، ومصروف الاهتلاك في الفترة ومجمع الاهتلاك وصافي القيمة الدفترية، أو حركات الأصول تفصيلياً',
      params: ['period'], sel: [['view', 'العرض', [['sum', 'ملخص لكل أصل'], ['det', 'حركات الأصول الثابتة تفصيلياً']]]],
      run: function (p) {
        var fx = assetGroup(/ثابت/); if (!fx.length) return emptyR('لم يُعثر على مجموعة «الأصول الثابتة» في دليل الحسابات');
        var rs = {}; fx.forEach(function (r) { rs[r] = 1; });
        var depE = idsOf(expRoots()).filter(function (id) { var a = acc(id); return a && a.leaf && /اهتلاك|إهتلاك|اهلاك|إهلاك/.test(a.name + ' ' + (acc(a.parent) || {}).name); });
        var accum = F.D.accList.filter(function (a) { return a.leaf && /مجمع|مخصص/.test(a.name + ' ' + (acc(a.parent) || {}).name) && /اهتلاك|إهتلاك|اهلاك|إهلاك/.test(a.name + ' ' + (acc(a.parent) || {}).name) && a.rootCode !== '3'; }).map(function (a) { return a.id; });
        var depAmt = sumBal(depE, p.from, p.to, 1).mv, accB = -balance(accum, null, p.to).close;
        var note = 'الإضافات = المدين على حسابات الأصول الثابتة في الفترة، والاستبعادات = الدائن · مصروف الاهتلاك من حسابات المصروفات التي في اسمها «اهتلاك/إهلاك»' + (accum.length ? '، ومجمع الاهتلاك من الحسابات التي في اسمها «مجمع/مخصص الاهتلاك»' : ' · لا توجد في الدليل حسابات «مجمع اهتلاك»، فصافي القيمة = التكلفة') + ' · اضغط أي سطر لكشف حسابه';
        if ((p.view || 'sum') === 'det') {
          var L = []; idsOf(fx).forEach(function (id) { (F.D.byAcc[id] || []).forEach(function (l) { if (l.d < p.from || l.d > p.to) return; var ls = F.D.byEntry[l.e] || [], side = l.dr ? 'cr' : 'dr'; L.push({ d: l.d, dt: l.dt || l.d, no: l.no, btn: l.btn, acc: acLabel(l.a), dr: l.dr, cr: l.cr, cp: ls.filter(function (q) { return q[side] && !rs[q.a] && q.a !== l.a; }).map(function (q) { return accName(q.a); }).join('\n'), ed: l.ld || '', _acc: l.a }); }); });
          if (!L.length) return Object.assign(emptyR('لا توجد حركات على الأصول الثابتة في الفترة'), {});
          L.sort(function (a, b) { return a.dt < b.dt ? -1 : 1; });
          var tdr = sum(L, 'dr'), tcr = sum(L, 'cr');
          return withNote({ title: 'حركات الأصول الثابتة', rows: L, cols: [C('d', 'التاريخ'), C('no', 'رقم السند'), C('btn', 'النوع'), C('acc', 'الأصل', 'long'), C('dr', 'إضافة (مدين)', 'money'), C('cr', 'استبعاد (دائن)', 'money'), C('cp', 'الحساب المقابل', 'long'), C('ed', 'البيان', 'long')],
            total: { d: 'الإجمالي', _b: true, dr: tdr, cr: tcr }, kpis: [{ l: 'الإضافات', v: tdr, t: 'money', s: L.filter(function (x) { return x.dr; }).length + ' حركة' }, { l: 'الاستبعادات', v: tcr, t: 'money', s: L.filter(function (x) { return x.cr; }).length + ' حركة' }], note: note }, p);
        }
        var rows = [];
        fx.forEach(function (r) {
          descend(r).forEach(function (id) {
            var a = acc(id), d = depthUnder(id, rs); if (!a || !d) return;
            var b = sumBal(descend(id), p.from, p.to, 1);
            if (Math.abs(b.open) < 0.0005 && Math.abs(b.dr) < 0.0005 && Math.abs(b.cr) < 0.0005) return;
            rows.push({ code: a.code, name: a.name + (d === 1 && multiBr() && viewBr() === '*' ? ' — ' + brName(a.br || '') : ''), open: b.open, add: b.dr, disp: b.cr, close: b.close, _acc: id, _lvl: d - 1, _b: !a.leaf });
          });
        });
        var T0 = fx.reduce(function (o, r) { var b = sumBal(descend(r), p.from, p.to, 1); o.open += b.open; o.add += b.dr; o.disp += b.cr; o.close += b.close; return o; }, { open: 0, add: 0, disp: 0, close: 0 });
        rows.forEach(function (r) { r.share = pct(r.close, T0.close); });
        var nbv = T0.close - accB;
        var kpis = [
          { l: 'تكلفة الأصول الثابتة', v: T0.close, t: 'money', s: 'في ' + p.to },
          { l: 'الإضافات في الفترة', v: T0.add, t: 'money', s: 'شراء ورسملة' },
          { l: 'الاستبعادات في الفترة', v: T0.disp, t: 'money', s: 'بيع أو شطب أو تحويل' },
          { l: 'مصروف الاهتلاك في الفترة', v: depAmt, t: 'money', s: depE.length ? depE.length + ' حساب اهتلاك' : 'لا توجد حسابات اهتلاك' },
          { l: 'صافي القيمة الدفترية', v: nbv, t: 'money', s: accum.length ? 'بعد مجمع الاهتلاك ' + fm(accB) : 'لا يوجد مجمع اهتلاك في الدليل' }
        ];
        var cols = [C('code', 'الرمز'), C('name', 'الأصل', 'long'), C('open', 'أول المدة', 'money'), C('add', 'الإضافات', 'money'), C('disp', 'الاستبعادات', 'money'), C('close', 'آخر المدة', 'money'), C('share', 'الحصة', 'pct')];
        var extra = [];
        if (depE.length) extra.push({ name: 'مصروف الاهتلاك في الفترة', _b: true, close: depAmt, _hl: 1 });
        if (accum.length) extra.push({ name: 'مجمع الاهتلاك', _b: true, close: -accB, _hl: 1 }, { name: 'صافي القيمة الدفترية', _b: true, close: nbv, _hl: 1 });
        return withNote({ title: 'الأصول الثابتة من ' + p.from + ' إلى ' + p.to, kpis: kpis, rows: rows.concat(extra), cols: cols, _lvlc: 1, total: { name: 'إجمالي الأصول الثابتة', _b: true, open: T0.open, add: T0.add, disp: T0.disp, close: T0.close, share: 100 }, note: note,
          chart: { type: 'hbar', x: 'name', y: ['close'], yl: ['التكلفة آخر المدة'], rowsOverride: rows.filter(function (r) { return acc(r._acc) && acc(r._acc).leaf; }).sort(function (a, b) { return b.close - a.close; }).slice(0, 12) } }, p);
      } };

    /* ---------- كشف مبيعات الأصناف ---------- */
    var SI_GRP = [['none', 'بدون تجميع'], ['top', 'تصنيف الصنف (الشركة)'], ['cls', 'تصنيف الصنف (الفئة)']];
    R.sales_item_stmt = { cat: 'sales', name: 'كشف مبيعات الأصناف (ملخص وتفصيلي)', desc: 'لكل صنف: الفواتير والعملاء والكمية المباعة والهدايا والمرتجعة والصافية، والمبيعات والمرتجعات والصافي والتكلفة والربح والهامش ومتوسط السعر والحصة، مجمّعة حسب التصنيف، أو تفصيلياً بفواتير كل صنف',
      params: ['period', 'flt', 'search'], fdims: ['item', 'icl', 'igrp', 'cust', 'st', 'ag', 'cat', 'xitem'],
      sel: [['grp', 'التجميع', SI_GRP], ['view', 'العرض', [['sum', 'ملخص لكل صنف'], ['det', 'تفصيلي (فواتير كل صنف)']]], ['sort', 'الترتيب', [['net', 'صافي المبيعات'], ['qty', 'الكمية'], ['profit', 'الربح'], ['name', 'اسم الصنف']]]],
      run: function (p) {
        var s = String(p.search || '').trim(), grp = p.grp || 'none', view = p.view || 'sum', sort = p.sort || 'net';
        var X = facts('s', p.from, p.to, p.flt).filter(function (x) { return !s || (itemName(x.l.item) + ' ' + ((T().item[x.l.item] || {}).code || '')).indexOf(s) >= 0; });
        if (!X.length) return emptyR('لا توجد مبيعات تطابق الاختيار في الفترة');
        var I = {}, totNet = 0, inv = {}, cu = {};
        X.forEach(function (x) {
          var k = x.l.item, it = T().item[k] || {}, r = I[k] || (I[k] = { k: k, code: it.code || '', name: itemName(k), unit: it.mu || it.unit || '', inv: {}, cu: {}, qty: 0, gift: 0, rqty: 0, sales: 0, ret: 0, cost: 0, profit: 0, l: [] });
          if (x.s > 0) { r.qty += x.qty; r.sales += x.val; r.inv[x.v.id] = 1; r.cu[x.v.ck] = 1; inv[x.v.id] = 1; cu[x.v.ck] = 1; } else { r.rqty += x.qty; r.ret += x.val; }
          r.gift += x.s * (x.gift || 0) / ((it.f || 1)); r.cost += x.s * (x.cost || 0); r.profit += x.s * (x.profit || 0); r.l.push(x);
        });
        var list = Object.keys(I).map(function (k) { var r = I[k]; r.net = r.sales - r.ret; r.nqty = r.qty - r.rqty; r.ninv = Object.keys(r.inv).length; r.ncu = Object.keys(r.cu).length; r.margin = pct(r.profit, r.net); r.avgp = r.nqty ? r.net / r.nqty : 0; r.rp = pct(r.ret, r.sales); totNet += r.net; return r; });
        list.forEach(function (r) { r.share = pct(r.net, totNet); });
        var cmpF = sort === 'name' ? function (a, b) { return a.name < b.name ? -1 : 1; } : function (a, b) { return b[sort === 'qty' ? 'nqty' : sort] - a[sort === 'qty' ? 'nqty' : sort]; };
        list.sort(cmpF);
        var T1 = { sales: sum(list, 'sales'), ret: sum(list, 'ret'), net: totNet, profit: sum(list, 'profit'), cost: sum(list, 'cost'), nqty: sum(list, 'nqty'), qty: sum(list, 'qty'), rqty: sum(list, 'rqty'), gift: sum(list, 'gift') };
        var best = list.slice().sort(function (a, b) { return b.net - a.net; })[0], bestP = list.slice().sort(function (a, b) { return b.profit - a.profit; })[0];
        var kpis = [
          { l: 'صافي مبيعات الأصناف', v: totNet, t: 'money', s: list.length + ' صنف · ' + Object.keys(inv).length + ' فاتورة · ' + Object.keys(cu).length + ' عميل' },
          { l: 'مجمل الربح', v: T1.profit, t: 'money', s: 'الهامش ' + pct(T1.profit, totNet).toFixed(1) + '%' },
          { l: 'المرتجعات', v: T1.ret, t: 'money', s: pct(T1.ret, T1.sales).toFixed(1) + '% من المبيعات', bad: pct(T1.ret, T1.sales) > 5 },
          { l: 'الصنف الأعلى مبيعاً', v: best.net, t: 'money', s: best.name + ' · ' + best.share.toFixed(1) + '%' },
          { l: 'الصنف الأعلى ربحاً', v: bestP.profit, t: 'money', s: bestP.name + ' · هامش ' + bestP.margin.toFixed(1) + '%' }
        ];
        var sumCols = [C('code', 'الرمز'), C('name', 'الصنف', 'long'), C('unit', 'الوحدة'), C('ninv', 'الفواتير', 'int'), C('ncu', 'العملاء', 'int'), C('qty', 'الكمية المباعة', 'qty'), C('gift', 'الهدايا', 'qty'), C('rqty', 'المرتجعة', 'qty'), C('nqty', 'صافي الكمية', 'qty'),
          C('sales', 'المبيعات', 'money'), C('ret', 'المرتجعات', 'money'), C('net', 'الصافي', 'money'), C('cost', 'التكلفة', 'money'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('avgp', 'متوسط السعر', 'money'), C('share', 'الحصة', 'pct')];
        var sumRowOf = function (r, gi) { return { _g: gi, _lvl: gi === undefined ? 0 : 1, code: r.code, name: r.name, unit: r.unit, ninv: r.ninv, ncu: r.ncu, qty: r.qty, gift: r.gift, rqty: r.rqty, nqty: r.nqty, sales: r.sales, ret: r.ret, net: r.net, cost: r.cost, profit: r.profit, margin: r.margin, avgp: r.avgp, share: r.share }; };
        var total = { name: 'الإجمالي', _b: true, ninv: Object.keys(inv).length, ncu: Object.keys(cu).length, qty: T1.qty, gift: T1.gift, rqty: T1.rqty, nqty: T1.nqty, sales: T1.sales, ret: T1.ret, net: totNet, cost: T1.cost, profit: T1.profit, margin: pct(T1.profit, totNet), share: 100 };
        var note = 'الكمية بالوحدة الأكبر للصنف · الصافي = المبيعات − المرتجعات · متوسط السعر = الصافي ÷ صافي الكمية · التكلفة والربح من سراج عند البيع';
        var gkey = grp === 'none' ? null : function (r) { var an = iclAnc(iclOf(r.k)); var c = grp === 'top' ? an[an.length - 1] : an[0]; return [c || '~', c ? iclName(c) : 'بدون تصنيف']; };
        if (view === 'det') {
          var dCols = [C('d', 'التاريخ'), C('no', 'الفاتورة'), C('typ', 'النوع'), C('cust', 'العميل', 'long'), C('q', 'الكمية', 'qty'), C('g', 'هدايا', 'qty'), C('unit', 'الوحدة'), C('pr', 'السعر', 'money'), C('val', 'القيمة', 'money'), C('profit', 'الربح', 'money'), C('rep', 'المندوب'), C('st', 'المخزن')];
          var rows = [];
          list.forEach(function (r, gi) {
            rows.push({ _g: gi, _gh: 1, _b: true, d: (r.code ? r.code + ' · ' : '') + r.name, cust: r.ninv + ' فاتورة · ' + r.ncu + ' عميل', q: r.nqty, unit: r.unit, val: r.net, profit: r.profit });
            r.l.slice().sort(function (a, b) { return (a.v.dt || a.d) < (b.v.dt || b.d) ? -1 : 1; }).forEach(function (x) {
              rows.push({ _g: gi, _lvl: 1, d: x.d, no: x.v.no, typ: x.s > 0 ? 'مبيع' : 'مرتجع', cust: x.v.name, q: x.s * x.qty, g: x.gift ? x.gift / ((T().item[x.l.item] || {}).f || 1) : 0, unit: r.unit, pr: x.l.p, val: x.s * x.val, profit: x.s * x.profit, rep: x.v.ag && x.v.ag !== '0' ? repName(x.v.ag) : '', st: storeName(x.l.st) });
            });
          });
          return withNote({ title: 'كشف مبيعات الأصناف التفصيلي', kpis: kpis, rows: rows, cols: dCols, total: { d: 'الإجمالي', _b: true, q: T1.nqty, val: totNet, profit: T1.profit }, note: note, _grouped: true, _noCust: true }, p);
        }
        if (!gkey) return withNote({ title: 'كشف مبيعات الأصناف', kpis: kpis, rows: list.map(function (r) { return sumRowOf(r); }), cols: sumCols, total: total, note: note, _noCust: true,
          chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], limit: 12, rowsOverride: list.slice().sort(function (a, b) { return b.net - a.net; }).slice(0, 12) } }, p);
        var G = {}, ord = [];
        list.forEach(function (r) { var k = gkey(r), g = G[k[0]]; if (!g) { g = G[k[0]] = { name: k[1], l: [] }; ord.push(g); } g.l.push(r); });
        ord.forEach(function (g) { g.net = sum(g.l, 'net'); g.profit = sum(g.l, 'profit'); g.nqty = sum(g.l, 'nqty'); g.sales = sum(g.l, 'sales'); g.ret = sum(g.l, 'ret'); g.cost = sum(g.l, 'cost'); });
        ord.sort(function (a, b) { return b.net - a.net; });
        var rows3 = [];
        ord.forEach(function (g, gi) {
          rows3.push({ _g: gi, _gh: 1, _b: true, name: g.name + ' — ' + g.l.length + ' صنف', nqty: g.nqty, sales: g.sales, ret: g.ret, net: g.net, cost: g.cost, profit: g.profit, margin: pct(g.profit, g.net), share: pct(g.net, totNet) });
          g.l.forEach(function (r) { rows3.push(sumRowOf(r, gi)); });
        });
        return withNote({ title: 'كشف مبيعات الأصناف حسب ' + (grp === 'top' ? 'الشركة' : 'الفئة'), kpis: kpis, rows: rows3, cols: sumCols, total: total, note: note, _grouped: true, _noCust: true, _lvlc: 1,
          chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], rowsOverride: ord.slice(0, 12).map(function (g) { return { name: g.name, net: g.net }; }) } }, p);
      } };
