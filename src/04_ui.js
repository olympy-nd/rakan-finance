
    /* ===================== منشئ التقارير المخصصة ===================== */
    var DIMS = {
      day: ['اليوم', function (r) { return r.d; }], week: ['الأسبوع', function (r) { return weekStart(r.d); }], month: ['الشهر', function (r) { return r.d.slice(0, 7); }],
      year: ['السنة', function (r) { return r.d.slice(0, 4); }],
      cust: ['العميل/المورد', function (r) { return r.v ? r.v.name : r.name; }], rep: ['المندوب', function (r) { var v = r.v || r; return (T().ag[v.ag] || {}).name || 'بدون'; }],
      store: ['المخزن', function (r) { return storeName(r.st); }],
      type: ['نوع الفاتورة', function (r) { var v = r.v || r; return (T().it[v.t] || {}).name || String(v.c); }],
      user: ['المستخدم', function (r) { var v = r.v || r; return (T().us[v.u] || {}).name || 'غير معروف'; }],
      item: ['الصنف', function (r) { return itemName(r.item); }],
      acc: ['الحساب', function (r) { return accName(r.a); }],
      acc2: ['الحساب (مستوى 2)', function (r) { return ancestorAt(r.a, 2); }], acc3: ['الحساب (مستوى 3)', function (r) { return ancestorAt(r.a, 3); }],
      acc4: ['الحساب (مستوى 4)', function (r) { return ancestorAt(r.a, 4); }],
      etype: ['نوع القيد', function (r) { return r.btn; }],
      dow: ['يوم الأسبوع', function (r) { return DOW[new Date(d2t(r.d)).getUTCDay()]; }]
    };
    var DS = {
      sinv: { name: 'فواتير المبيع والمرتجع', dims: ['day', 'week', 'month', 'year', 'dow', 'cust', 'rep', 'store', 'type', 'user'],
        rows: function () { return F.D.invs.filter(function (v) { return v.c === SALE || v.c === SRET; }); },
        meas: { count: ['عدد الفواتير', function (r) { return 1; }], sales: ['المبيعات', function (r) { return r.c === SALE ? r.net : 0; }], ret: ['المرتجعات', function (r) { return r.c === SRET ? r.net : 0; }],
          net: ['صافي المبيعات', function (r) { return r.sign * r.net; }], profit: ['مجمل الربح', function (r) { return r.sign * r.profit; }], qty: ['الكمية', function (r) { return r.sign * r.qty; }] } },
      slines: { name: 'أصناف المبيع والمرتجع (أسطر)', dims: ['day', 'week', 'month', 'year', 'dow', 'item', 'cust', 'rep', 'store', 'user'],
        rows: function () { var out = []; F.D.invs.forEach(function (v) { if (v.c === SALE || v.c === SRET) v.lines.forEach(function (l) { out.push(l); }); }); return out; },
        meas: { q: ['الكمية (الوحدة الشائعة)', function (l) { var it = T().item[l.item] || { f: 1 }; return l.v.sign * l.qb / (it.f || 1); }], value: ['القيمة الصافية', function (l) { return l.v.sign * l.tot; }],
          cost: ['التكلفة', function (l) { return l.v.sign * l.cost; }], profit: ['الربح', function (l) { return l.v.sign * l.win; }], gift: ['الهدايا', function (l) { return l.v.sign * l.g; }], lines: ['عدد الأسطر', function () { return 1; }] } },
      pinv: { name: 'فواتير المشتريات ومرتجعاتها', dims: ['day', 'week', 'month', 'year', 'cust', 'store', 'type', 'user'],
        rows: function () { return F.D.invs.filter(function (v) { return v.c === PUR || v.c === PRET; }); },
        meas: { count: ['عدد الفواتير', function () { return 1; }], net: ['صافي المشتريات', function (r) { return r.sign * r.net; }], qty: ['الكمية', function (r) { return r.sign * r.qty; }] } },
      plines: { name: 'أصناف المشتريات (أسطر)', dims: ['day', 'week', 'month', 'year', 'item', 'cust', 'store'],
        rows: function () { var out = []; F.D.invs.forEach(function (v) { if (v.c === PUR || v.c === PRET) v.lines.forEach(function (l) { out.push(l); }); }); return out; },
        meas: { q: ['الكمية (الوحدة الشائعة)', function (l) { var it = T().item[l.item] || { f: 1 }; return l.v.sign * l.qb / (it.f || 1); }], value: ['القيمة', function (l) { return l.v.sign * l.tot; }] } },
      jl: { name: 'القيود المحاسبية (أسطر)', dims: ['day', 'week', 'month', 'year', 'acc', 'acc2', 'acc3', 'acc4', 'etype', 'user'],
        rows: function () { return T().jl; },
        meas: { dr: ['مدين', function (l) { return l.dr; }], cr: ['دائن', function (l) { return l.cr; }], net: ['الصافي (مدين - دائن)', function (l) { return l.dr - l.cr; }], count: ['عدد الأسطر', function () { return 1; }] } }
    };
    function runCustom(def, p) {
      if (def.kind === 'formula') return runFormulaReport(def, p);
      var ds = DS[def.ds];
      if (!ds) return { cols: [C('m', '')], rows: [], empty: 'مصدر البيانات غير معروف' };
      var dimR = DIMS[def.row] || DIMS.month, dimC = def.col ? DIMS[def.col] : null;
      var meas = (def.meas && def.meas.length ? def.meas : Object.keys(ds.meas).slice(0, 2)).filter(function (m) { return ds.meas[m]; });
      var flt = String(def.filter || '').trim(), fdim = def.fdim ? DIMS[def.fdim] : null;
      var g = {}, colKeys = {};
      ds.rows().forEach(function (r) {
        if (r.d < p.from || r.d > p.to) return;
        if (flt && fdim && String(fdim[1](r)).indexOf(flt) < 0) return;
        var rk = dimR[1](r), x = g[rk] || (g[rk] = { name: rk });
        meas.forEach(function (m) { x[m] = (x[m] || 0) + ds.meas[m][1](r); });
        if (dimC) { var ck = dimC[1](r); colKeys[ck] = 1; x['c_' + ck] = (x['c_' + ck] || 0) + ds.meas[meas[0]][1](r); }
      });
      var list = Object.keys(g).map(function (k) { return g[k]; });
      var timeDim = ['day', 'week', 'month', 'year'].indexOf(def.row) >= 0;
      var sortK = def.sort || (timeDim ? '_name' : meas[0]);
      list.sort(function (a, b) { return sortK === '_name' ? (a.name < b.name ? -1 : 1) : (b[sortK] || 0) - (a[sortK] || 0); });
      if (def.row === 'month') list.forEach(function (r) { r.name = monthLabel(r.name); });
      var cols = [C('name', dimR[0])];
      if (dimC) {
        var ck = Object.keys(colKeys).sort().slice(0, 24);
        ck.forEach(function (k) { cols.push(C('c_' + k, def.col === 'month' ? monthLabel(k) : k, 'money')); });
        cols.push(C(meas[0], 'الإجمالي: ' + ds.meas[meas[0]][0], 'money'));
      } else meas.forEach(function (m) { cols.push(C(m, ds.meas[m][0], /count|lines/.test(m) ? 'int' : /^q|gift/.test(m) ? 'qty' : 'money')); });
      var total = sumRow(list, cols.slice(1));
      var res = { cols: cols, rows: list, total: total };
      if (def.top) topN(res, { top: def.top });
      if (def.chart && !dimC) res.chart = { type: def.chart, x: 'name', y: [meas[0]], yl: [ds.meas[meas[0]][0]], limit: def.chart === 'hbar' ? 15 : 0 };
      return res;
    }
    // تقرير بالمعادلات: كل سطر معادلة، والأعمدة فترات زمنية
    function periodCols(from, to, g) {
      if (!g || g === 'single') return [{ k: 'all', l: perLabelTxt(from, to), from: from, to: to }];
      var out = [], keys = {}, d = from;
      while (d <= to && out.length < 400) { var k = bucket(d, g); if (!keys[k]) { keys[k] = 1; out.push(k); } d = addD(d, 1); }
      return out.slice(-62).map(function (k) {
        var a = g === 'month' ? k + '-01' : k, b = g === 'month' ? monthEnd(k) : g === 'week' ? addD(k, 6) : k;
        if (a < from) a = from; if (b > to) b = to;
        return { k: k, l: g === 'month' ? MONTHS[+k.slice(5, 7) - 1] + (k.slice(0, 4) !== to.slice(0, 4) ? ' ' + k.slice(0, 4) : '') : g === 'day' ? dayShort(k) : 'أسبوع ' + dayShort(k), from: a, to: b };
      });
    }
    function perLabelTxt(from, to) { return from === to ? from : from + ' ← ' + to; }
    function runFormulaReport(def, p) {
      var rows = (def.rows || []).filter(function (r) { return r.name || r.f; });
      if (!rows.length) return { cols: [C('m', '')], rows: [], empty: 'أضف سطراً واحداً على الأقل' };
      var pc = periodCols(p.from, p.to, def.cols), multi = pc.length > 1;
      var vals = pc.map(function (c) { return evalList(rows, c.from, c.to); });
      var tot = multi && def.total !== false ? evalList(rows, p.from, p.to) : null;
      var errs = [];
      var out = rows.map(function (r, i) {
        if (!r.f) return { name: r.name, _b: true, _hl: true };
        var o = { name: r.name, _fmt: r.fmt || 'money', _b: !!r.bold };
        pc.forEach(function (c, j) { var x = vals[j][i]; o['c' + j] = x.err ? null : x.v; if (x.err && errs.indexOf(r.name) < 0) errs.push(r.name + ': ' + x.err); });
        if (tot) o.tot = tot[i].err ? null : tot[i].v;
        return o;
      });
      var cols = [C('name', def.first || 'البند')].concat(pc.map(function (c, j) { return C('c' + j, c.l, 'money'); }));
      if (tot) cols.push(C('tot', 'الفترة كاملة', 'money'));
      var res = { cols: cols, rows: out, note: errs.length ? 'أخطاء: ' + errs.slice(0, 3).join(' · ') : '' };
      if (def.chart && multi) { var first = out.filter(function (r) { return r.c0 !== undefined; })[0]; if (first) res.chart = { type: def.chart, x: 'name', y: ['v'], yl: [first.name], rowsOverride: pc.map(function (c, j) { return { name: c.l, v: first['c' + j] || 0 }; }) }; }
      return res;
    }

    /* ===================== الواجهة ===================== */
    function go(sub) { F.sub = sub; if (sub !== 'reports') F.cur = null; A.go(sub); }
    function canEdit() { return !!(A.st.user && A.st.user.can_edit); }
    var SUBS = ['dash', 'daily', 'reports', 'builder', 'settings'];

    function view(sub) {
      return {
        load: function (quiet) {
          var had = !!F.D, rev = F.rev, nb = JSON.stringify([F.boxes, F.reports, F.config]);
          // التحديث التلقائي لا يعيد رسم الشاشة إلا إذا وصل جديد، حتى لا يقطع ما يكتبه المستخدم
          if (quiet && had && F.lastPull && Date.now() - F.lastPull < 180000) return Promise.resolve(false);
          if (quiet && F.dirty) return Promise.resolve(false);
          F.quiet = quiet;
          return load(false).then(function () { return !had || F.rev !== rev || nb !== JSON.stringify([F.boxes, F.reports, F.config]); });
        },
        html: function () {
          if (F.sub !== sub) { F.sub = sub; if (sub !== 'reports') F.cur = null; }
          var h = '';
          if (!F.D && F.error && !F.loading) return '<div class="card empty"><p>تعذّر تحميل البيانات المالية: ' + esc(F.error) + '</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' إعادة المحاولة</button></div>';
          if (!F.D && F.rows && !Object.keys(F.rows).length && !F.loading && F.meta) return '<div class="card empty"><p>لم تصل بيانات مالية من الوكيل بعد.</p><p class="small muted">بعد إعداد الوكيل على جهاز سراج بمفتاح المنظومة المالية سيرسل القيود والفواتير تلقائياً خلال دقائق.</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' تحقق الآن</button></div>';
          if (!F.D) return '<div class="card loading"><span class="spin"></span> <span id="finprog">' + esc(F.progress || 'جارٍ تحميل البيانات المالية… أول مرة قد تستغرق دقيقة') + '</span></div>';
          h += syncLine();
          try {
            if (sub === 'dash') h += dashHTML();
            else if (sub === 'daily') h += dailyHTML();
            else if (sub === 'reports') h += F.cur ? reportHTML() : catalogHTML();
            else if (sub === 'builder') h += builderHTML();
            else h += settingsHTML();
          } catch (e) { if (window.console) console.error(e); h += '<div class="card empty">حدث خطأ أثناء إعداد الشاشة: ' + esc(e.message) + '</div>'; }
          return h;
        },
        bind: function (m) {
          var rf = q('[data-frefresh]', m);
          if (rf) rf.onclick = function () { busy(rf, true); load(true).then(function () { toast('حُدّثت البيانات المالية'); A.render(); }).catch(function (e) { busy(rf, false); toast(e.message, true); A.render(); }); };
          if (!F.D) return;
          qa('[data-open]', m).forEach(function (b) { b.addEventListener('click', function () { openReport(b.dataset.open, b.dataset.per ? { preset: b.dataset.per, from: F.lastRange && F.lastRange[0], to: F.lastRange && F.lastRange[1] } : null); }); });
          if (sub === 'dash') bindDash(m);
          else if (sub === 'daily') bindDaily(m);
          else if (sub === 'reports') (F.cur ? bindReport : bindCatalog)(m);
          else if (sub === 'builder') bindBuilder(m);
          else bindSettings(m);
        }
      };
    }
    SUBS.forEach(function (k) { A.VIEWS[k] = view(k); });

    function syncLine() {
      var m = F.meta || {}, ck = m.check || {};
      var lb = m.agent && m.agent.last_beat;
      return '<div class="row small muted fin-sync"><span>آخر بيانات مالية من سراج: ' + (m.last ? N(String(m.last).slice(0, 16)) : '—') + '</span>' +
        (ck.balanced === false ? '<span class="badge b-flag">القيود غير متوازنة في سراج</span>' : ck.balanced ? '<span class="badge b-delivered">القيود متوازنة ✓</span>' : '') +
        (lb ? '<span>الوكيل: ' + N(String(lb).slice(11, 16)) + '</span>' : '') + '<button class="btn sm ghost" data-frefresh>' + ICON.refresh + ' تحديث البيانات</button></div>';
    }

    /* ---------- لوحة المؤشرات (بطاقات بالمعادلات) ---------- */
    var DASH_PRESETS = PRESETS.filter(function (p) { return ['today', 'yesterday', 'week', 'month', 'lastmonth', 'quarter', 'year', 'custom'].indexOf(p[0]) >= 0; });
    function cardHTML(c, r, pr, i) {
      var v = r.err ? null : r.v, pv = pr && !pr.err ? pr.v : null;
      var ch = c.cmp && pv ? (v - pv) / Math.abs(pv) * 100 : null, good = c.good === 'down' ? ch < 0 : ch > 0;
      return '<' + (c.rep && R[c.rep] ? 'button data-crep="' + esc(c.rep) + '"' : 'div') + ' class="kpi fin-kpi' + (c.rep && R[c.rep] ? ' tap' : '') + '" title="' + esc(c.f) + '"><span>' + esc(c.name) + '</span>' +
        (r.err ? '<b class="num">—</b><small class="down">خطأ في المعادلة: ' + esc(r.err) + '</small>' : '<b class="num">' + fmtVal(v, c.fmt || 'money0') + '</b>') +
        (ch !== null && isFinite(ch) ? '<small class="' + (Math.abs(ch) < 0.05 ? '' : good ? 'up' : 'down') + '">' + (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + fp(Math.abs(ch)) + ' عن الفترة السابقة</small>' : c.cmp ? '<small class="muted">لا مقارنة</small>' : '') +
        (c.sub && r.sub !== null && r.sub !== undefined ? '<small class="muted">' + fmtVal(r.sub, c.subfmt || 'int') + ' ' + esc(c.subl || '') + '</small>' : '') + '</' + (c.rep && R[c.rep] ? 'button' : 'div') + '>';
    }
    function dashRange() { return presetRange(F.dashPer, F.dashFrom, F.dashTo); }
    function dashHTML() {
      var r = dashRange(), pr = prevRange(r[0], r[1], F.dashPer), list = cards();
      F.lastRange = r;
      var cur = evalList(list, r[0], r[1]), prev = list.some(function (c) { return c.cmp; }) ? evalList(list, pr[0], pr[1]) : [];
      var h = '<div class="card"><div class="row" style="align-items:center"><div class="chips grow">' + DASH_PRESETS.map(function (pp) { return '<button class="chip' + (F.dashPer === pp[0] ? ' on' : '') + '" data-dper="' + pp[0] + '">' + pp[1] + '</button>'; }).join('') + '</div>' +
        (canEdit() ? '<button class="btn sm ghost" data-custom>تخصيص البطاقات</button>' : '') + '</div>' +
        (F.dashPer === 'custom' ? '<div class="row" style="margin-top:10px"><input type="date" class="input num" id="dfrom" value="' + r[0] + '" style="max-width:180px"><input type="date" class="input num" id="dto" value="' + r[1] + '" style="max-width:180px"></div>' : '') +
        '<div class="small muted" style="margin-top:6px">' + perLabel(r[0], r[1]) + ' · مقارنة بـ ' + perLabel(pr[0], pr[1]) + '</div></div>';
      h += '<div class="kpis fin-kpis">' + list.map(function (c, i) { return cardHTML(c, cur[i], prev[i], i); }).join('') + '</div>';
      // منحنى آخر 6 أشهر
      var months = [], m0 = r[1].slice(0, 7);
      for (var i = 5; i >= 0; i--) { var mm = m0, k = i; while (k-- > 0) mm = addD(mm + '-01', -1).slice(0, 7); months.push(mm); }
      var series = months.map(function (mm) { var e = monthEnd(mm) > r[1] ? r[1] : monthEnd(mm); return { name: MONTHS[+mm.slice(5, 7) - 1], net: salesStats(mm + '-01', e).net, coll: collections(mm + '-01', e, '') }; });
      h += '<div class="grid2"><div class="card"><h3>صافي المبيعات والتحصيل · آخر 6 أشهر</h3>' + chartSVG({ type: 'bar', x: 'name', y: ['net', 'coll'], yl: ['صافي المبيعات', 'التحصيل'] }, series) + '</div>';
      var top = R.sales_cust.run({ from: r[0], to: r[1], top: 7 }).rows;
      h += '<div class="card"><h3>أعلى العملاء مبيعاً في الفترة</h3>' + (top.length ? chartSVG({ type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] }, top) : '<p class="muted">لا مبيعات في الفترة</p>') + '</div></div>';
      h += '<div class="card"><h3>تقارير سريعة</h3><div class="chips">' + [['exec_summary', 'الملخص التنفيذي'], ['sales_item', 'المبيعات حسب الصنف'], ['sales_cust', 'المبيعات حسب العميل'], ['collections_daily', 'التحصيل اليومي'],
        ['recv_aging', 'أعمار الديون'], ['stock_balance', 'أرصدة المخزون'], ['boxes', 'الصناديق والبنوك'], ['income', 'قائمة الدخل']].map(function (x) { return '<button class="chip" data-open="' + x[0] + '"' + (R[x[0]].params.indexOf('period') >= 0 ? ' data-per="' + esc(F.dashPer) + '"' : '') + '>' + x[1] + '</button>'; }).join('') +
        '<button class="chip" data-gosub="daily">التقرير اليومي للإدارة</button></div></div>';
      return h;
    }
    function bindDash(m) {
      qa('[data-dper]', m).forEach(function (b) { b.onclick = function () { F.dashPer = b.dataset.dper; A.render(); }; });
      var df = q('#dfrom', m), dt = q('#dto', m);
      if (df) df.onchange = dt.onchange = function () { F.dashFrom = df.value; F.dashTo = dt.value; A.render(); };
      qa('[data-crep]', m).forEach(function (b) { b.onclick = function () { var r = dashRange(), def = R[b.dataset.crep]; openReport(b.dataset.crep, def.params.indexOf('period') >= 0 ? { preset: F.dashPer, from: r[0], to: r[1] } : { asof: r[1] }); }; });
      qa('[data-gosub]', m).forEach(function (b) { b.onclick = function () { go(b.dataset.gosub); }; });
      var cu = q('[data-custom]', m);
      if (cu) cu.onclick = function () { F.setTab = 'cards'; go('settings'); };
    }

    /* ---------- التقرير اليومي للإدارة ---------- */
    function dailyCols() {
      var d = F.dailyDate || F.D.maxDate || today(), cols = [];
      if (F.dailyMode === 'days7') for (var i = 6; i >= 0; i--) { var x = addD(d, -i); cols.push({ l: dayShort(x), from: x, to: x }); }
      else cols.push({ l: dayShort(d), from: d, to: d });
      if (F.dailyMtd) cols.push({ l: 'MTD ' + MON_EN[+d.slice(5, 7) - 1], from: d.slice(0, 7) + '-01', to: d });
      return cols;
    }
    function dailyData() {
      var def = dailyDef(), cols = dailyCols();
      var vals = cols.map(function (c) { return evalList(def.rows, c.from, c.to); });
      return { def: def, cols: cols, vals: vals, date: F.dailyDate || F.D.maxDate || today() };
    }
    function dailyTable(D, cls) {
      return '<table class="' + cls + '"><thead><tr><th class="dh-s">Subject</th>' + D.cols.map(function (c) { return '<th class="dh-d">' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        D.def.rows.map(function (r, i) {
          if (!r.f) return '<tr class="dsep"><th colspan="' + (D.cols.length + 1) + '">' + esc(r.name) + '</th></tr>';
          return '<tr><th class="dl">' + esc(r.name) + '</th>' + D.vals.map(function (v) { var x = v[i]; return '<td class="dv"' + (x.err ? ' title="' + esc(x.err) + '"' : '') + '>' + (x.err ? '<span class="derr">خطأ</span>' : fmtVal(x.v, r.fmt || 'dec2')) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }
    function dailyHTML() {
      var D = dailyData(), errs = [];
      D.def.rows.forEach(function (r, i) { D.vals.forEach(function (v) { if (v[i].err && errs.indexOf(r.name) < 0) errs.push(r.name); }); });
      var h = '<div class="card"><div class="row fin-head" style="align-items:flex-end"><div class="grow"><h2 style="margin:0">' + esc(D.def.title || 'التقرير اليومي للإدارة') + '</h2><div class="small muted">كل الأرقام محسوبة من بيانات سراج بالمعادلات المحددة لكل سطر</div></div>' +
        '<button class="btn sm" data-dxls>Excel</button><button class="btn sm" data-dprt>' + ICON.print + ' طباعة / PDF</button>' + (canEdit() ? '<button class="btn sm ghost" data-dcustom>تخصيص الأسطر</button>' : '') + '</div>' +
        '<div class="row fin-params"><label class="field fin-param"><span class="lbl">التاريخ</span><input type="date" class="input num" id="ddate" value="' + D.date + '"></label>' +
        '<label class="field fin-param"><span class="lbl">الأعمدة</span><select class="input" id="dmode"><option value="day"' + (F.dailyMode !== 'days7' ? ' selected' : '') + '>اليوم المحدد</option><option value="days7"' + (F.dailyMode === 'days7' ? ' selected' : '') + '>آخر 7 أيام (عمود لكل يوم)</option></select></label>' +
        '<label class="chk fin-param" style="align-self:center"><input type="checkbox" id="dmtd"' + (F.dailyMtd ? ' checked' : '') + '> إضافة عمود «من بداية الشهر»</label>' +
        '<div class="fin-param" style="flex:0 0 auto"><button class="btn sm ghost" data-dprev>→ اليوم السابق</button> <button class="btn sm ghost" data-dnext>اليوم التالي ←</button></div></div>' +
        (errs.length ? '<div class="msg err" style="margin-top:8px">أسطر فيها خطأ: ' + esc(errs.join('، ')) + (canEdit() ? '. صحّحها من «تخصيص الأسطر».' : '') + '</div>' : '') + '</div>';
      h += '<div class="card scroll-x"><div class="daily-wrap">' + dailyTable(D, 'daily') + '</div>' +
        '<p class="small muted" style="margin:10px 0 0">الكميات والأرصدة (المخزون والمديونية والحسابات) في نهاية اليوم، والمبيعات والتحصيل لليوم نفسه. عمود «من بداية الشهر» يجمع حركة الشهر حتى التاريخ.</p></div>';
      return h;
    }
    function bindDaily(m) {
      var setD = function (d) { F.dailyDate = d; A.render(); };
      q('#ddate', m).onchange = function () { if (this.value) setD(this.value); };
      q('#dmode', m).onchange = function () { F.dailyMode = this.value; A.render(); };
      q('#dmtd', m).onchange = function () { F.dailyMtd = this.checked; A.render(); };
      q('[data-dprev]', m).onclick = function () { setD(addD(F.dailyDate || F.D.maxDate || today(), -1)); };
      q('[data-dnext]', m).onclick = function () { setD(addD(F.dailyDate || F.D.maxDate || today(), 1)); };
      var cu = q('[data-dcustom]', m);
      if (cu) cu.onclick = function () { F.setTab = 'daily'; go('settings'); };
      q('[data-dxls]', m).onclick = function () { exportDaily(); };
      q('[data-dprt]', m).onclick = function () {
        var D = dailyData(), P = document.getElementById('print');
        P.innerHTML = '<div class="p-rep p-daily"><div class="p-head"><img src="logo.png" alt=""><div class="t"><b>' + esc(D.def.title || 'التقرير اليومي للإدارة') + '</b><span>شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + esc(D.date) + '</span></div><span class="p-copy">' + esc('طُبع ' + RK.nowStr().slice(0, 16)) + '</span></div>' +
          dailyTable(D, 'daily pd') + '<p class="p-note">من بيانات سراج حتى ' + esc((F.meta && F.meta.last) || '') + '</p></div>';
        setTimeout(function () { window.print(); }, 150);
      };
    }
    // Excel منسّق (برتقالي وكحلي مثل نموذج الإدارة)
    var XS = {
      border: { top: { style: 'thin', color: { rgb: 'A6A6A6' } }, bottom: { style: 'thin', color: { rgb: 'A6A6A6' } }, left: { style: 'thin', color: { rgb: 'A6A6A6' } }, right: { style: 'thin', color: { rgb: 'A6A6A6' } } },
      font: function (o) { return Object.assign({ name: 'Calibri', sz: 11 }, o || {}); }
    };
    function xcell(v, s, z) { var c = { v: v === null || v === undefined ? '' : v, t: typeof v === 'number' ? 'n' : 's', s: s }; if (z && c.t === 'n') { c.z = z; s.numFmt = z; } return c; }
    function exportDaily() {
      A.withXLSX().then(function (X) {
        var D = dailyData(), ws = {}, R0 = 0, nc = D.cols.length + 1;
        var put = function (r, c, cell) { ws[X.utils.encode_cell({ r: r, c: c })] = cell; };
        put(0, 0, xcell(D.def.title || 'التقرير اليومي للإدارة', { font: XS.font({ bold: true, sz: 14, color: { rgb: '1F3864' } }) }));
        put(1, 0, xcell('شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + D.date, { font: XS.font({ color: { rgb: '595959' } }) }));
        R0 = 3;
        var hs = { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }), fill: { fgColor: { rgb: 'ED7D31' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: XS.border };
        put(R0, 0, xcell('Subject', hs)); D.cols.forEach(function (c, j) { put(R0, j + 1, xcell(c.l, Object.assign({}, hs))); });
        D.def.rows.forEach(function (r, i) {
          var rr = R0 + 1 + i;
          if (!r.f) { put(rr, 0, xcell(r.name, { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' } }), fill: { fgColor: { rgb: '0C4CA2' } }, border: XS.border })); for (var j = 1; j < nc; j++) put(rr, j, xcell('', { fill: { fgColor: { rgb: '0C4CA2' } }, border: XS.border })); return; }
          put(rr, 0, xcell(r.name, { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' } }), fill: { fgColor: { rgb: '1F3864' } }, alignment: { vertical: 'center' }, border: XS.border }));
          D.vals.forEach(function (v, j) {
            var x = v[i], z = r.fmt === 'int' || r.fmt === 'money0' ? '#,##0' : r.fmt === 'money' ? '#,##0.000' : r.fmt === 'pct' ? '0.0"%"' : '#,##0.00';
            put(rr, j + 1, xcell(x.err ? 'خطأ' : Math.round(x.v * 1000) / 1000, { font: XS.font({ sz: 12 }), alignment: { horizontal: 'center' }, border: XS.border }, z));
          });
        });
        ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: R0 + D.def.rows.length, c: nc - 1 } });
        ws['!cols'] = [{ wch: 30 }].concat(D.cols.map(function () { return { wch: 18 }; }));
        ws['!rows'] = []; ws['!rows'][R0] = { hpt: 22 };
        var wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Daily');
        download(X, wb, 'rakan-daily-' + D.date + '.xlsx');
      }).catch(function (e) { toast(e.message, true); });
    }
    function download(X, wb, fname) {
      var blob = new Blob([X.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }

    /* ---------- الرسوم ---------- */
    var COLORS = ['#0C4CA2', '#F15C22', '#2E9E6A', '#7A5AF8', '#C2410C'];
    function chartSVG(ch, rows) {
      if (ch.rowsOverride) rows = ch.rowsOverride;
      rows = rows.filter(function (r) { return !r._b || ch.type !== 'hbar'; }).slice(0, ch.limit || rows.length);
      if (!rows.length) return '';
      var vals = []; rows.forEach(function (r) { ch.y.forEach(function (k) { vals.push(Number(r[k]) || 0); }); });
      var max = Math.max.apply(null, vals.concat([0])), min = Math.min.apply(null, vals.concat([0])), span = (max - min) || 1;
      var legend = ch.y.length > 1 ? '<div class="legend">' + ch.y.map(function (k, i) { return '<span><i style="background:' + COLORS[i] + '"></i>' + esc(ch.yl[i]) + '</span>'; }).join('') + '</div>' : '';
      if (ch.type === 'hbar') {
        var hh = rows.length * 30 + 6;
        return legend + '<svg class="chart hb" viewBox="0 0 600 ' + hh + '" role="img" direction="rtl">' + rows.map(function (r, i) {
          var v = Number(r[ch.y[0]]) || 0, w = Math.max(1, Math.abs(v) / (Math.max(Math.abs(max), Math.abs(min)) || 1) * 280);
          var lb = String(r[ch.x]); if (lb.length > 24) lb = lb.slice(0, 23) + '…';
          return '<text x="596" y="' + (i * 30 + 20) + '" text-anchor="start" class="cl">' + esc(lb) + '<title>' + esc(r[ch.x]) + '</title></text>' +
            '<rect x="' + (370 - w) + '" y="' + (i * 30 + 6) + '" width="' + w + '" height="18" rx="4" fill="' + (v < 0 ? COLORS[1] : COLORS[0]) + '"></rect>' +
            '<text x="' + (366 - w) + '" y="' + (i * 30 + 19) + '" text-anchor="end" class="cv">' + fk(v) + '</text>';
        }).join('') + '</svg>';
      }
      var W = 600, H = 230, pl = 56, pb = 34, pt = 10, iw = W - pl - 10, ih = H - pb - pt;
      var y = function (v) { return pt + ih - (v - min) / span * ih; };
      var ticks = [min, min + span / 2, max].map(function (v) { return '<line x1="' + pl + '" x2="' + (W - 10) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="gl"></line><text x="' + (pl - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="cv">' + short(v) + '</text>'; }).join('');
      var n = rows.length, bw = iw / n, lblEvery = Math.ceil(n / 12);
      var xl = rows.map(function (r, i) { return i % lblEvery ? '' : '<text x="' + (pl + bw * i + bw / 2) + '" y="' + (H - 12) + '" text-anchor="middle" class="cl">' + esc(String(r[ch.x]).replace(/^أسبوع /, '').slice(0, 12)) + '</text>'; }).join('');
      var body = '';
      if (ch.type === 'line') {
        ch.y.forEach(function (k, j) {
          var pts = rows.map(function (r, i) { return (pl + bw * i + bw / 2) + ',' + y(Number(r[k]) || 0); }).join(' ');
          body += '<polyline points="' + pts + '" fill="none" stroke="' + COLORS[j] + '" stroke-width="2.5"></polyline>';
          if (n <= 40) rows.forEach(function (r, i) { body += '<circle cx="' + (pl + bw * i + bw / 2) + '" cy="' + y(Number(r[k]) || 0) + '" r="3" fill="' + COLORS[j] + '"><title>' + esc(r[ch.x]) + ': ' + fk(r[k]) + '</title></circle>'; });
        });
      } else {
        var gw = bw * 0.78, sw = gw / ch.y.length;
        rows.forEach(function (r, i) {
          ch.y.forEach(function (k, j) {
            var v = Number(r[k]) || 0, y0 = y(Math.max(0, min)), y1 = y(v);
            body += '<rect x="' + (pl + bw * i + (bw - gw) / 2 + sw * j) + '" y="' + Math.min(y0, y1) + '" width="' + Math.max(1, sw - 1) + '" height="' + Math.max(1, Math.abs(y1 - y0)) + '" rx="2" fill="' + COLORS[j] + '"><title>' + esc(r[ch.x]) + ': ' + fk(v) + '</title></rect>';
          });
        });
      }
      return legend + '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" direction="ltr">' + ticks + body + xl + '</svg>';
    }
    function short(v) { var a = Math.abs(v); return (a >= 1e6 ? (v / 1e6).toFixed(1) + 'م' : a >= 1e3 ? (v / 1e3).toFixed(0) + 'أ' : fk(v)); }

    /* ---------- فهرس التقارير ---------- */
    function catalogHTML() {
      var n = Object.keys(R).length;
      var h = '<div class="card"><input class="input" id="rq" placeholder="ابحث في ' + n + ' تقريراً: مبيعات، صنف، عميل، ميزانية، مخزون…" value="' + esc(F.rq || '') + '"><div class="chips" style="margin-top:8px">' +
        CATS.map(function (c) { return '<button class="chip" data-jump="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div></div>';
      CATS.forEach(function (c) {
        var list = c[0] === 'mine' ? F.reports.map(function (r) { return { id: 'c:' + r.id, name: r.name, desc: r.def.kind === 'formula' ? 'تقرير بالمعادلات' : (DS[r.def.ds] || {}).name || '', by: r.by }; })
          : Object.keys(R).filter(function (k) { return R[k].cat === c[0]; }).map(function (k) { return { id: k, name: R[k].name, desc: R[k].desc }; });
        if (!list.length && c[0] !== 'mine') return;
        h += '<section class="fin-catsec" id="cat-' + c[0] + '"><div class="sec-title"><h2>' + c[1] + ' <span class="badge">' + list.length + '</span></h2></div><div class="fin-cat">' + (list.length ? list.map(function (r) {
          return '<button class="item tap fin-rep" data-open="' + esc(r.id) + '" data-s="' + esc(r.name + ' ' + (r.desc || '') + ' ' + c[1]) + '"><div class="main"><b>' + esc(r.name) + '</b><div class="small muted">' + esc(r.desc || '') + (r.by ? ' · أنشأه ' + esc(r.by) : '') + '</div></div></button>';
        }).join('') : '<div class="card empty small">لا توجد تقارير مخصصة بعد.' + (canEdit() ? ' أنشئ تقريرك من «تقرير مخصص».' : '') + '</div>') + '</div></section>';
      });
      return h;
    }
    function bindCatalog(m) {
      var inp = q('#rq', m);
      var apply = function () {
        var t = inp.value.trim(); F.rq = t;
        qa('.fin-rep', m).forEach(function (b) { b.hidden = !!t && b.dataset.s.indexOf(t) < 0; });
        qa('.fin-catsec', m).forEach(function (s) { s.hidden = !!t && !qa('.fin-rep', s).some(function (b) { return !b.hidden; }); });
      };
      inp.oninput = apply; if (F.rq) apply();
      qa('[data-jump]', m).forEach(function (b) { b.onclick = function () { inp.value = ''; apply(); var el = q('#cat-' + b.dataset.jump, m); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
    }

    function openReport(id, params) {
      var def = id.indexOf('c:') === 0 ? F.reports.filter(function (r) { return 'c:' + r.id === id; })[0] : null;
      if (!def && !R[id]) { toast('التقرير غير موجود', true); return; }
      var t = today();
      var base = { preset: 'month', from: t.slice(0, 7) + '-01', to: t, asof: t, gran: 'day', level: 3, top: 0, rby: 'cust', vby: 'none', box: 'all', nonzero: 'nz', measure: 'value', idle: 30, boxkind: 'all', etype: 'all', flt: null };
      var saved = (st.finParams || {})[id] || {};
      var p = Object.assign(base, saved, params || {});
      if (params && params.from && params.preset && params.preset !== 'custom') { p.from = params.from; p.to = params.to; }
      F.cur = { id: id, custom: def, p: p };
      go('reports');
      window.scrollTo(0, 0);
    }

    function curDef() { var c = F.cur; return c.custom ? { name: c.custom.name, desc: c.custom.def.kind === 'formula' ? 'تقرير بالمعادلات' : (DS[c.custom.def.ds] || {}).name, params: ['period'] } : R[c.id]; }
    function runCur() {
      var c = F.cur, p = c.p;
      if (p.preset && p.preset !== 'custom') { var r = presetRange(p.preset); p.from = r[0]; p.to = r[1]; }
      return c.custom ? runCustom(c.custom.def, p) : R[c.id].run(p);
    }

    // أبعاد التصفية لكل نوع تقرير
    var FDIMS = { cust: 'العملاء', item: 'الأصناف', st: 'المخازن', ag: 'المناديب', u: 'المستخدمون', xcust: 'استثناء عملاء', xitem: 'استثناء أصناف' };
    function fdimsFor(def) { return def.cat === 'stock' ? ['item', 'st', 'xitem'] : def.cat === 'purch' ? ['cust', 'item', 'st', 'u'] : ['cust', 'item', 'st', 'ag', 'u', 'xcust', 'xitem']; }
    function fltOptions(k, def) {
      var Tt = T(), out = [];
      if (k === 'cust' || k === 'xcust') {
        var purch = def && def.cat === 'purch', seen = {};
        F.D.invs.forEach(function (v) { if ((purch ? (v.c === PUR || v.c === PRET) : (v.c === SALE || v.c === SRET)) && !seen[v.ck]) { seen[v.ck] = 1; out.push({ id: v.ck, name: v.name, sub: (acc(v.acc) || {}).code || '' }); } });
      } else if (k === 'item' || k === 'xitem') {
        var used = {}; Tt.invl.forEach(function (l) { used[l.item] = 1; });
        Object.keys(Tt.item).forEach(function (id) { if (used[id]) out.push({ id: id, name: itemName(id), sub: String(Tt.item[id].code || '') }); });
      } else if (k === 'st') Object.keys(Tt.st).forEach(function (id) { out.push({ id: id, name: storeName(id) }); });
      else if (k === 'ag') Object.keys(Tt.ag).forEach(function (id) { out.push({ id: id, name: repName(id) }); });
      else if (k === 'u') Object.keys(Tt.us).forEach(function (id) { out.push({ id: id, name: userName(id) }); });
      return out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); });
    }
    function fltBar(def, p) {
      var f = p.flt && typeof p.flt === 'object' ? p.flt : {}, dims = fdimsFor(def), any = false;
      var h = '<div class="fin-flt"><span class="small muted">تصفية:</span>' + dims.map(function (k) {
        var v = f[k] || [], on = v.length > 0; if (on) any = true;
        var lbl = def.cat === 'purch' && k === 'cust' ? 'الموردون' : FDIMS[k];
        var txt = on ? (v.length <= 2 ? v.map(function (x) { return fltName(k, x); }).join('، ') : v.length + ' محدد') : 'الكل';
        return '<button class="chip' + (on ? ' on' : '') + '" data-fk="' + k + '">' + esc(lbl) + ': ' + esc(txt) + ' ▾</button>';
      }).join('') + (any ? '<button class="chip" data-fclear>✕ مسح التصفية</button>' : '') + '</div>';
      return h;
    }

    function paramsHTML(def, p) {
      var h = '';
      var has = function (k) { return def.params.indexOf(k) >= 0; };
      if (has('period')) {
        h += '<div class="chips">' + PRESETS.map(function (pp) { return '<button class="chip' + (p.preset === pp[0] ? ' on' : '') + '" data-pp="' + pp[0] + '">' + pp[1] + '</button>'; }).join('') + '</div>';
        if (p.preset === 'custom') h += '<div class="row"><label class="small">من <input type="date" class="input num" data-pk="from" value="' + p.from + '"></label><label class="small">إلى <input type="date" class="input num" data-pk="to" value="' + p.to + '"></label></div>';
      }
      var sel = function (k, label, opts) { return '<label class="field fin-param"><span class="lbl">' + label + '</span><select class="input" data-pk="' + k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(p[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; };
      var row = '';
      if (has('asof')) row += '<label class="field fin-param"><span class="lbl">في تاريخ</span><input type="date" class="input num" data-pk="asof" value="' + p.asof + '"></label>';
      if (has('asof2')) row += '<label class="field fin-param"><span class="lbl">مقارنة بتاريخ</span><input type="date" class="input num" data-pk="asof2" value="' + esc(p.asof2 || addD(p.asof.slice(0, 4) + '-01-01', -1)) + '"></label>';
      if (has('gran')) row += sel('gran', 'التجميع', GRAN);
      if (has('level')) row += sel('level', 'المستوى', [[1, 'المستوى 1'], [2, 'المستوى 2'], [3, 'المستوى 3'], [4, 'المستوى 4'], [5, 'المستوى 5'], [6, 'كل المستويات']]);
      if (has('top')) row += sel('top', 'العرض', [[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50'], [100, 'أعلى 100']]);
      if (has('measure')) row += sel('measure', 'القيمة', [['value', 'صافي المبيعات (د.ل)'], ['qty', 'الكمية']]);
      if (has('rby')) row += sel('rby', 'حسب', [['cust', 'العميل'], ['item', 'الصنف']]);
      if (has('vby')) row += sel('vby', 'العرض', [['none', 'كل سند (تفصيلي)'], ['box', 'مجمّع حسب الصندوق/البنك'], ['party', 'مجمّع حسب الطرف'], ['day', 'مجمّع حسب اليوم']]);
      if (has('nonzero')) row += sel('nonzero', 'الأرصدة', [['nz', 'غير الصفرية فقط'], ['all', 'الكل']]);
      if (has('idle')) row += sel('idle', 'بلا شراء منذ', [[15, '15 يوماً'], [30, '30 يوماً'], [60, '60 يوماً'], [90, '90 يوماً'], [180, '180 يوماً']]);
      if (has('etype')) row += sel('etype', 'نوع القيد', [['all', 'الكل'], ['r', 'سندات القبض'], ['p', 'سندات الدفع'], ['j', 'قيود يومية'], ['i', 'قيود الفواتير'], ['o', 'افتتاحي']]);
      if (has('boxkind')) row += sel('boxkind', 'النوع', [['all', 'الصناديق والبنوك'], ['صندوق', 'الصناديق فقط'], ['بنك', 'البنوك فقط']]);
      if (has('box')) row += sel('box', 'الصندوق/البنك', [['all', 'كل الصناديق والبنوك (ملخص)']].concat(activeBoxes().map(function (b) { return [b.acc, b.name]; })));
      if (has('search')) row += '<label class="field fin-param"><span class="lbl">بحث</span><input class="input" data-pk="search" value="' + esc(p.search || '') + '" placeholder="رقم أو اسم"></label>';
      if (has('account')) row += '<div class="field fin-param" style="flex:2"><span class="lbl">الحساب</span><button class="input" data-accpick style="text-align:start">' + (p.account ? esc(acc(p.account) ? acc(p.account).code + ' · ' + acc(p.account).name : '—') : 'اختر الحساب…') + '</button></div>';
      if (row) h += '<div class="row fin-params">' + row + '</div>';
      if (has('flt')) h += fltBar(def, p);
      return h;
    }

    function reportHTML() {
      var c = F.cur, def = curDef();
      if (!def) { F.cur = null; return catalogHTML(); }
      var res;
      try { res = runCur(); } catch (e) { res = { cols: [], rows: [], empty: 'تعذّر إعداد التقرير: ' + e.message }; if (window.console) console.error(e); }
      c.res = res;
      var p = c.p;
      var h = '<div class="card"><div class="row fin-head"><button class="btn sm ghost" data-back>→ التقارير</button><div class="grow"><h2 style="margin:0">' + esc(res.title || def.name) + '</h2><div class="small muted">' + esc(def.desc || '') + '</div></div>' +
        '<button class="btn sm" data-xls>Excel</button><button class="btn sm" data-prt>' + ICON.print + ' طباعة / PDF</button>' + (c.custom && canEdit() ? '<button class="btn sm ghost" data-edit>تعديل</button>' : '') + '</div>' +
        '<div style="margin-top:10px">' + paramsHTML(def, p) + '</div>' +
        '<div class="small muted" style="margin-top:6px">' + (def.params.indexOf('asof') >= 0 ? 'في ' + N(p.asof) : def.params.indexOf('period') >= 0 ? perLabel(p.from, p.to) : '') + (res.note ? ' · ' + esc(res.note) : '') + '</div></div>';
      if (res.empty) return h + '<div class="card empty">' + esc(res.empty) + '</div>';
      if (res.chart && (res.chart.rowsOverride || res.rows.length > 1)) h += '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>';
      h += '<div class="card scroll-x fin-table">' + tableHTML(res) + '</div>';
      return h;
    }
    var FMT_SHORT = { p: 'pct', q: 'qty', n: 'int' };
    function cell(c, v, r) {
      if (v === '' || v === undefined || v === null) return '';
      var rf = r && r._fmt ? FMT_SHORT[r._fmt] || r._fmt : null;
      if (rf && (c.t === 'money') && typeof v === 'number') return fmtVal(v, rf);
      if (c.t === 'money') return fm(v);
      if (c.t === 'money0') return fk(v);
      if (c.t === 'int') return fk(v);
      if (c.t === 'qty') return fq(v);
      if (c.t === 'pct') return fp(v);
      return esc(v);
    }
    function lvlCol(res) { return res.cols[0] && res.cols[0].k === 'code' ? 1 : 0; }
    function isNum(c) { return ['money', 'money0', 'int', 'qty', 'pct'].indexOf(c.t) >= 0; }
    function tableHTML(res) {
      var sk = F.cur && F.cur.sort;
      var rows = res.rows.slice();
      if (sk) { var col = res.cols.filter(function (c) { return c.k === sk.k; })[0]; if (col) rows.sort(function (a, b) { var x = a[sk.k], y = b[sk.k]; if (isNum(col)) { x = Number(x) || 0; y = Number(y) || 0; } return (x < y ? -1 : x > y ? 1 : 0) * sk.dir; }); }
      if (!rows.length) return '<p class="muted" style="margin:0">لا توجد حركة في هذه الفترة</p>';
      var clickable = rows.some(function (r) { return r._acc || r._box; });
      var shown = rows.length > 3000 ? rows.slice(0, 3000) : rows;
      return '<table class="tbl fin"><thead><tr>' + res.cols.map(function (c) { return '<th class="' + (isNum(c) ? 'n' : '') + '" data-sort="' + c.k + '">' + esc(c.l) + (sk && sk.k === c.k ? (sk.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        shown.map(function (r) {
          return '<tr class="' + (r._b ? 'b ' : '') + (r._hl ? 'hl ' : '') + ((r._acc || r._box) && clickable ? 'tap' : '') + '"' + (r._acc ? ' data-acc="' + esc(r._acc) + '"' : r._box ? ' data-box="' + esc(r._box) + '"' : '') + '>' +
            res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '"' + (r._lvl && i === lvlCol(res) ? ' style="padding-inline-start:' + (6 + r._lvl * 18) + 'px"' : '') + '>' + cell(c, r[c.k], r) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody>' + (res.total ? '<tfoot><tr>' + res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '">' + (i === 0 ? esc(res.total[c.k] && !isNum(c) ? res.total[c.k] : res.total.name || res.total.desc || 'الإجمالي') : cell(c, res.total[c.k], res.total)) + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table>' +
        '<p class="small muted" style="margin:8px 0 0">' + fk(rows.length) + ' سطر' + (shown.length < rows.length ? ' (يظهر أول ' + fk(shown.length) + '، وملف Excel فيه الكل)' : '') + (clickable ? ' · اضغط على أي حساب لفتح كشف حسابه' : '') + ' · اضغط على عنوان أي عمود للترتيب</p>';
    }

    function bindReport(m) {
      var c = F.cur, p = c.p, def = curDef();
      var save = function () { st.finParams = st.finParams || {}; st.finParams[c.id] = Object.assign({}, p); try { localStorage.setItem('rk.finParams', JSON.stringify(st.finParams)); } catch (e) {} };
      q('[data-back]', m).onclick = function () { F.cur = null; A.render(); };
      qa('[data-pp]', m).forEach(function (b) { b.onclick = function () { p.preset = b.dataset.pp; save(); A.render(); }; });
      qa('[data-pk]', m).forEach(function (el) {
        el.addEventListener('change', function () { p[el.dataset.pk] = el.value; if (el.dataset.pk === 'from' || el.dataset.pk === 'to') p.preset = 'custom'; save(); A.render(); });
      });
      var ap = q('[data-accpick]', m);
      if (ap) ap.onclick = function () { pickAccount({ title: 'اختر الحساب', any: true }).then(function (id) { if (id) { p.account = id; save(); A.render(); } }); };
      qa('[data-fk]', m).forEach(function (b) {
        b.onclick = function () {
          var k = b.dataset.fk, f = p.flt && typeof p.flt === 'object' ? p.flt : {};
          pickMulti({ title: 'تصفية: ' + (def.cat === 'purch' && k === 'cust' ? 'الموردون' : FDIMS[k]), options: fltOptions(k, def), value: f[k] || [] }).then(function (v) {
            if (!v) return; f = Object.assign({}, f); f[k] = v; p.flt = f; save(); A.render();
          });
        };
      });
      var fc = q('[data-fclear]', m);
      if (fc) fc.onclick = function () { p.flt = null; save(); A.render(); };
      qa('th[data-sort]', m).forEach(function (th) { th.onclick = function () { var k = th.dataset.sort; c.sort = c.sort && c.sort.k === k ? { k: k, dir: -c.sort.dir } : { k: k, dir: -1 }; A.render(); }; });
      qa('tr[data-acc]', m).forEach(function (tr) { tr.onclick = function () { var asof = def.params.indexOf('asof') >= 0; openReport('statement', { account: tr.dataset.acc, preset: asof ? 'custom' : p.preset, from: asof ? p.asof.slice(0, 4) + '-01-01' : p.from, to: asof ? p.asof : p.to }); }; });
      qa('tr[data-box]', m).forEach(function (tr) { tr.onclick = function () { p.box = tr.dataset.box; save(); A.render(); }; });
      q('[data-xls]', m).onclick = function () { exportXLSX(c.res, def.name, p); };
      q('[data-prt]', m).onclick = function () { printReport(c.res, def.name, p); };
      var ed = q('[data-edit]', m);
      if (ed) ed.onclick = function () { F.custom = JSON.parse(JSON.stringify(c.custom)); F.preview = true; go('builder'); };
    }

    /* ---------- التصدير والطباعة ---------- */
    function periodText(p, def) { return def.params.indexOf('asof') >= 0 ? 'في ' + p.asof : def.params.indexOf('period') >= 0 ? (p.from === p.to ? p.from : 'من ' + p.from + ' إلى ' + p.to) : ''; }
    function plain(s) { return String(s || '').replace(/<[^>]+>/g, ''); }
    function exportXLSX(res, name, p) {
      A.withXLSX().then(function (X) {
        var def = curDef(), ws = {}, r = 0, nc = res.cols.length;
        var put = function (rr, cc, cl) { ws[X.utils.encode_cell({ r: rr, c: cc })] = cl; };
        put(r++, 0, xcell('شركة راكان لاستيراد المواد الغذائية والتوزيع', { font: XS.font({ color: { rgb: '595959' } }) }));
        put(r++, 0, xcell(res.title || name, { font: XS.font({ bold: true, sz: 14, color: { rgb: '0C4CA2' } }) }));
        put(r++, 0, xcell(periodText(p, def) + (res.note ? ' · ' + plain(res.note) : ''), { font: XS.font({ color: { rgb: '595959' } }) }));
        put(r++, 0, xcell('آخر بيانات من سراج: ' + ((F.meta && F.meta.last) || ''), { font: XS.font({ sz: 9, color: { rgb: '7F7F7F' } }) }));
        r++;
        var hr = r;
        res.cols.forEach(function (c, j) { put(r, j, xcell(c.l, { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' } }), fill: { fgColor: { rgb: '0C4CA2' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: XS.border })); });
        r++;
        var zOf = function (c, row) { var f = row && row._fmt ? FMT_SHORT[row._fmt] || row._fmt : null; if (f && c.t === 'money') return f === 'pct' ? '0.0"%"' : f === 'int' || f === 'money0' ? '#,##0' : f === 'qty' ? '#,##0.##' : f === 'dec2' ? '#,##0.00' : '#,##0.000'; return c.t === 'money' ? '#,##0.000' : c.t === 'int' || c.t === 'money0' ? '#,##0' : c.t === 'qty' ? '#,##0.##' : c.t === 'pct' ? '0.0"%"' : null; };
        var val = function (c, v, j, row) { if (v === undefined || v === null || v === '') return ''; if (isNum(c) && typeof v === 'number') return Math.round(v * 1000) / 1000; return plain(v); };
        res.rows.forEach(function (row) {
          res.cols.forEach(function (c, j) {
            var v = val(c, row[c.k], j, row); if (row._lvl && typeof v === 'string' && j === lvlCol(res)) v = new Array(row._lvl + 1).join('    ') + v;
            var s = { font: XS.font({ bold: !!row._b }), border: XS.border }; if (row._hl) s.fill = { fgColor: { rgb: 'E8EFFA' } };
            if (isNum(c)) s.alignment = { horizontal: 'right' };
            put(r, j, xcell(v, s, zOf(c, row)));
          });
          r++;
        });
        if (res.total) {
          res.cols.forEach(function (c, j) { var v = j === 0 ? 'الإجمالي' : val(c, res.total[c.k], j, res.total); put(r, j, xcell(v, { font: XS.font({ bold: true }), fill: { fgColor: { rgb: 'FDE7DC' } }, border: { top: { style: 'medium', color: { rgb: 'F15C22' } }, bottom: XS.border.bottom, left: XS.border.left, right: XS.border.right } }, zOf(c, res.total))); });
          r++;
        }
        ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(r - 1, hr), c: Math.max(nc - 1, 0) } });
        ws['!cols'] = res.cols.map(function (c) { return { wch: c.t === 'text' ? 30 : 16 }; });
        ws['!views'] = [{ RTL: true }];
        ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: hr, c: 0 }, e: { r: hr, c: Math.max(nc - 1, 0) } }) };
        var wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
        X.utils.book_append_sheet(wb, ws, 'التقرير');
        download(X, wb, 'rakan-' + (res.title || name).replace(/[\\/:*?"<>|]/g, '').slice(0, 40) + '-' + today() + '.xlsx');
      }).catch(function (e) { toast(e.message, true); });
    }
    function printReport(res, name, p) {
      var def = curDef(), P = document.getElementById('print');
      P.innerHTML = '<div class="p-rep"><div class="p-head"><img src="logo.png" alt=""><div class="t"><b>' + esc(res.title || name) + '</b><span>شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + esc(periodText(p, def)) + '</span></div><span class="p-copy">' +
        esc('طُبع ' + RK.nowStr().slice(0, 16)) + '</span></div>' + (res.note ? '<p class="p-note">' + esc(plain(res.note)) + '</p>' : '') +
        '<table class="p-tbl"><thead><tr>' + res.cols.map(function (c) { return '<th>' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        res.rows.map(function (r) { return '<tr' + (r._b ? ' style="font-weight:800"' : '') + '>' + res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '"' + (r._lvl && i === lvlCol(res) ? ' style="padding-inline-start:' + (2 + r._lvl * 4) + 'mm"' : '') + '>' + cell(c, r[c.k], r) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>' +
        (res.total ? '<tfoot><tr>' + res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '"><b>' + (i === 0 ? 'الإجمالي' : cell(c, res.total[c.k], res.total)) + '</b></td>'; }).join('') + '</tr></tfoot>' : '') + '</table>' +
        '<p class="p-note">آخر بيانات من سراج: ' + esc((F.meta && F.meta.last) || '') + ' · تقارير راكان تقرأ من سراج ولا تعدّل فيه</p></div>';
      setTimeout(function () { window.print(); }, 150);
    }

    /* ---------- اختيار حساب ---------- */
    function pickAccount(opts) {
      opts = opts || {};
      return new Promise(function (res) {
        var sel = opts.multi ? (opts.value || []).slice() : null;
        sheet(opts.title || 'اختر الحساب', '<input class="input" id="aq" placeholder="ابحث بالرمز أو الاسم">' + (opts.hint ? '<div class="msg info">' + esc(opts.hint) + '</div>' : '') +
          '<div class="list acc-list" id="al"></div>' + (opts.multi ? '<button class="btn primary big" data-ok>حفظ الاختيار</button>' : ''), function (s) {
          var inp = q('#aq', s.el), al = q('#al', s.el);
          function draw() {
            var t = inp.value.trim();
            var list = F.D.accList.filter(function (a) { return (!opts.filter || opts.filter(a)) && (!t || (a.code + ' ' + a.name).indexOf(t) >= 0); }).slice(0, 300);
            al.innerHTML = list.map(function (a) {
              var on = sel && sel.indexOf(String(a.code)) >= 0;
              return '<button class="item tap acc-it' + (on ? ' sel' : '') + '" data-a="' + esc(a.id) + '" style="padding-inline-start:' + (8 + (t ? 0 : (a.lvl - 1) * 14)) + 'px"><div class="main"><b>' + esc(a.name) + '</b><div class="meta"><span class="num">' + esc(a.code) + '</span><span>مستوى ' + a.lvl + '</span>' + (a.leaf ? '' : '<span>رئيسي · ' + a.kids.length + ' فرع</span>') + '</div></div>' + (on ? '✓' : '') + '</button>';
            }).join('') || '<p class="muted">لا نتائج</p>';
            qa('[data-a]', al).forEach(function (b) {
              b.onclick = function () {
                var a = acc(b.dataset.a);
                if (!sel) { s.done = true; s.close(); res(a.id); return; }
                var c = String(a.code), i = sel.indexOf(c); if (i >= 0) sel.splice(i, 1); else sel.push(c); draw();
              };
            });
          }
          inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
          var ok = q('[data-ok]', s.el);
          if (ok) ok.onclick = function () { s.done = true; s.close(); res(sel); };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    // اختيار متعدد من قائمة (عملاء، أصناف، مخازن…)
    function pickMulti(opts) {
      return new Promise(function (res) {
        var sel = (opts.value || []).map(String);
        sheet(opts.title || 'اختر', '<input class="input" id="mq" placeholder="ابحث بالاسم أو الرمز"><div class="row small" style="margin-top:6px"><span class="muted grow" id="mn"></span><button class="btn sm ghost" data-all>تحديد الظاهر</button><button class="btn sm ghost" data-none>مسح الكل</button></div>' +
          '<div class="list acc-list" id="ml"></div><button class="btn primary big" data-ok>تطبيق</button>', function (s) {
          var inp = q('#mq', s.el), ml = q('#ml', s.el), shown = [];
          function draw() {
            var t = inp.value.trim();
            var list = opts.options.filter(function (o) { return !t || (o.name + ' ' + (o.sub || '') + ' ' + o.id).indexOf(t) >= 0; });
            list.sort(function (a, b) { return (sel.indexOf(String(b.id)) >= 0) - (sel.indexOf(String(a.id)) >= 0); });
            shown = list.slice(0, 400);
            q('#mn', s.el).textContent = sel.length + ' محدد من ' + opts.options.length + (list.length > shown.length ? ' · يظهر ' + shown.length + ' من ' + list.length + '، استعمل البحث' : '');
            ml.innerHTML = shown.map(function (o) { var on = sel.indexOf(String(o.id)) >= 0; return '<button class="item tap acc-it' + (on ? ' sel' : '') + '" data-o="' + esc(o.id) + '"><div class="main"><b>' + esc(o.name) + '</b>' + (o.sub ? '<div class="meta"><span class="num">' + esc(o.sub) + '</span></div>' : '') + '</div>' + (on ? '✓' : '') + '</button>'; }).join('') || '<p class="muted">لا نتائج</p>';
            qa('[data-o]', ml).forEach(function (b) { b.onclick = function () { var id = b.dataset.o, i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); draw(); }; });
          }
          inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
          q('[data-all]', s.el).onclick = function () { shown.forEach(function (o) { if (sel.indexOf(String(o.id)) < 0) sel.push(String(o.id)); }); draw(); };
          q('[data-none]', s.el).onclick = function () { sel = []; draw(); };
          q('[data-ok]', s.el).onclick = function () { s.done = true; s.close(); res(sel); };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }

    /* ---------- محرر المعادلة (للبطاقات وأسطر التقرير اليومي والتقارير بالمعادلات) ---------- */
    function insertAt(ta, text) {
      var a = ta.selectionStart || ta.value.length, b = ta.selectionEnd || a;
      ta.value = ta.value.slice(0, a) + text + ta.value.slice(b);
      var pos = a + text.length; var k = text.indexOf('()'); if (k >= 0 && /\(\)$/.test(text)) pos = a + text.length - 1;
      ta.focus(); ta.setSelectionRange(pos, pos); ta.dispatchEvent(new Event('input'));
    }
    function fnHelpHTML() {
      var groups = {};
      FN.forEach(function (f) { (groups[f.grp] = groups[f.grp] || []).push(f); });
      return Object.keys(groups).map(function (g) {
        return '<details class="fn-grp"><summary>' + esc(g) + ' (' + groups[g].length + ')</summary><div class="fn-list">' + groups[g].map(function (f) {
          return '<button type="button" class="fn-it" data-fn="' + esc(f.ar) + '"><b>' + esc(f.ar) + '(' + esc(f.args) + ')</b><span>' + esc(f.desc) + '</span></button>';
        }).join('') + '</div></details>';
      }).join('');
    }
    function editItem(item, kind, ctx) {
      // kind: card | row | frow ; ctx: { from, to, vars, perLabel }
      return new Promise(function (res) {
        var d = Object.assign({ name: '', f: '', fmt: kind === 'card' ? 'money0' : kind === 'row' ? 'dec2' : 'money' }, item || {});
        var fmtOpts = function (v) { return FMTS.map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); };
        var repOpts = '<option value="">بدون</option>' + Object.keys(R).map(function (k) { return '<option value="' + k + '"' + (d.rep === k ? ' selected' : '') + '>' + esc(R[k].name) + '</option>'; }).join('');
        var html = '<div class="form fe">' +
          '<div class="field"><label class="lbl" for="fen">' + (kind === 'card' ? 'اسم البطاقة' : 'اسم السطر') + '</label><input id="fen" class="input" value="' + esc(d.name) + '"></div>' +
          (kind !== 'card' ? '<label class="chk"><input type="checkbox" id="fesep"' + (item && !item.f && item.name ? ' checked' : '') + '> عنوان قسم فقط (بدون رقم)</label>' : '') +
          '<div id="febody"><div class="field"><label class="lbl" for="fef">المعادلة</label><textarea id="fef" class="input fe-f" rows="3" dir="rtl" spellcheck="false">' + esc(d.f) + '</textarea>' +
          '<div class="fe-ops">' + ['+', '−', '×', '÷', '(', ')'].map(function (o) { return '<button type="button" class="chip" data-op="' + o + '">' + o + '</button>'; }).join('') +
          '<button type="button" class="chip" data-ins="acc">+ حساب</button><button type="button" class="chip" data-ins="st">+ مخزن</button><button type="button" class="chip" data-ins="cust">+ تصفية عميل</button><button type="button" class="chip" data-ins="item">+ تصفية صنف</button>' +
          (ctx.names && ctx.names.length ? '<button type="button" class="chip" data-ins="var">+ قيمة سطر سابق</button>' : '') + '</div>' +
          '<div class="fe-prev" id="fep"></div></div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="fefmt">التنسيق</label><select id="fefmt" class="input">' + fmtOpts(d.fmt) + '</select></div>' +
          (kind === 'frow' ? '<label class="chk grow" style="align-self:end"><input type="checkbox" id="feb"' + (d.bold ? ' checked' : '') + '> خط عريض</label>' : '') + '</div>' +
          (kind === 'card' ? '<div class="row"><div class="field grow"><label class="lbl" for="fes">سطر فرعي تحت الرقم (معادلة اختيارية)</label><input id="fes" class="input" dir="rtl" value="' + esc(d.sub || '') + '" placeholder="مثل: فواتير_مبيع()"></div></div>' +
            '<div class="row"><div class="field grow"><label class="lbl" for="fesl">نص بعده</label><input id="fesl" class="input" value="' + esc(d.subl || '') + '" placeholder="مثل: فاتورة"></div><div class="field grow"><label class="lbl" for="fesf">تنسيقه</label><select id="fesf" class="input">' + fmtOpts(d.subfmt || 'int') + '</select></div></div>' +
            '<div class="row"><label class="chk grow"><input type="checkbox" id="fecmp"' + (d.cmp ? ' checked' : '') + '> مقارنة بالفترة السابقة</label><div class="field grow"><label class="lbl" for="feg">الأفضل أن يكون</label><select id="feg" class="input"><option value="up"' + (d.good !== 'down' ? ' selected' : '') + '>أعلى (مثل المبيعات)</option><option value="down"' + (d.good === 'down' ? ' selected' : '') + '>أقل (مثل المديونية)</option></select></div></div>' +
            '<div class="field"><label class="lbl" for="ferep">عند الضغط على البطاقة افتح تقرير</label><select id="ferep" class="input">' + repOpts + '</select></div>' : '') +
          '</div>' +
          '<details class="fe-help"><summary>الدوال المتاحة وأمثلة</summary><div class="small" style="margin:6px 0">' +
          '<p style="margin:4px 0">• <b>[1601]</b> = رصيد الحساب 1601 مع فروعه. مثال: <code>[1601] - [2610] × 2</code></p>' +
          '<p style="margin:4px 0">• التصفية بين علامتي تنصيص: <code>مبيعات("عميل:1601001; صنف:زيت")</code> · <code>مخزون_كمية("بنغازي,سبها")</code></p>' +
          '<p style="margin:4px 0">• قيمة سطر أو بطاقة قبله باسمه بين قوسين: <code>قسمة({صافي المبيعات}, {الكمية})</code></p>' +
          '<p style="margin:4px 0">• المفاتيح: عميل، صنف، مخزن، مندوب، مستخدم، بدون_عميل، بدون_صنف. الأسماء العربية والإنجليزية للدوال كلاهما يعمل.</p></div>' + fnHelpHTML() + '</details>' +
          '<div id="feerr"></div><button class="btn primary big" id="fesv">حفظ</button></div>';
        sheet(kind === 'card' ? (item ? 'تعديل البطاقة' : 'بطاقة جديدة') : (item ? 'تعديل السطر' : 'سطر جديد'), html, function (s) {
          var ta = q('#fef', s.el), prev = q('#fep', s.el), tmr = null;
          var sep = q('#fesep', s.el);
          var syncSep = function () { if (sep) q('#febody', s.el).hidden = sep.checked; };
          if (sep) { sep.onchange = syncSep; syncSep(); }
          var preview = function () {
            var src = ta.value.trim();
            if (!src) { prev.innerHTML = '<span class="muted small">اكتب المعادلة أو اختر دالة من الأسفل</span>'; return; }
            var r = tryFormula(src, ctx.from, ctx.to, ctx.vars);
            prev.innerHTML = r.err ? '<span class="derr">✗ ' + esc(r.err) + '</span>' : '<span class="small muted">' + esc(ctx.perLabel || '') + ' = </span><b class="num">' + fmtVal(r.v, q('#fefmt', s.el).value) + '</b>';
          };
          ta.oninput = function () { clearTimeout(tmr); tmr = setTimeout(preview, 250); };
          q('#fefmt', s.el).onchange = preview;
          preview();
          qa('[data-op]', s.el).forEach(function (b) { b.onclick = function () { insertAt(ta, ' ' + b.dataset.op + ' '); }; });
          qa('[data-fn]', s.el).forEach(function (b) { b.onclick = function () { insertAt(ta, b.dataset.fn + '()'); }; });
          qa('[data-ins]', s.el).forEach(function (b) {
            b.onclick = function () {
              var k = b.dataset.ins;
              if (k === 'acc') pickAccount({ title: 'إدراج حساب في المعادلة', any: true }).then(function (id) { if (id) insertAt(ta, '[' + acc(id).code + ']'); });
              else if (k === 'var') pickMulti({ title: 'قيمة سطر سابق', options: ctx.names.map(function (n) { return { id: n, name: n }; }), value: [] }).then(function (v) { if (v && v.length) insertAt(ta, v.map(function (n) { return '{' + n + '}'; }).join(' + ')); });
              else pickMulti({ title: k === 'st' ? 'إدراج مخازن' : k === 'cust' ? 'تصفية حسب العميل' : 'تصفية حسب الصنف', options: fltOptions(k), value: [] }).then(function (v) {
                if (!v || !v.length) return;
                var names = v.map(function (x) { return k === 'st' ? storeName(x) : k === 'cust' ? ((acc(x) || {}).code || x) : x; });
                insertAt(ta, k === 'st' ? '"' + names.join(',') + '"' : '"' + (k === 'cust' ? 'عميل:' : 'صنف:') + names.join(',') + '"');
              });
            };
          });
          q('#fesv', s.el).onclick = function () {
            var o = { name: q('#fen', s.el).value.trim() };
            if (!o.name) { q('#feerr', s.el).innerHTML = '<div class="msg err">اكتب الاسم</div>'; return; }
            if (sep && sep.checked) { s.done = true; s.close(); res({ name: o.name, f: '' }); return; }
            o.f = ta.value.trim(); o.fmt = q('#fefmt', s.el).value;
            if (!o.f) { q('#feerr', s.el).innerHTML = '<div class="msg err">اكتب المعادلة</div>'; return; }
            try { parseFormula(o.f); } catch (e) { q('#feerr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; return; }
            if (kind === 'card') {
              o.id = d.id || ('c' + Date.now().toString(36));
              o.sub = q('#fes', s.el).value.trim(); o.subl = q('#fesl', s.el).value.trim(); o.subfmt = q('#fesf', s.el).value;
              if (o.sub) { try { parseFormula(o.sub); } catch (e) { q('#feerr', s.el).innerHTML = '<div class="msg err">السطر الفرعي: ' + esc(e.message) + '</div>'; return; } }
              o.cmp = q('#fecmp', s.el).checked; o.good = q('#feg', s.el).value; o.rep = q('#ferep', s.el).value;
            }
            if (kind === 'frow') o.bold = q('#feb', s.el).checked;
            s.done = true; s.close(); res(o);
          };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    // قائمة قابلة للتعديل (ترتيب، تعديل، حذف) مع القيم الحالية
    function listEditorHTML(key, list, ctx) {
      var vals = evalList(list, ctx.from, ctx.to);
      return '<div class="list fe-list">' + (list.length ? list.map(function (it, i) {
        var v = vals[i];
        return '<div class="item fe-row' + (!it.f ? ' fe-sep' : '') + '"><div class="main"><b>' + esc(it.name || '—') + '</b>' + (it.f ? '<div class="meta"><code class="fe-code">' + esc(it.f) + '</code><span>' + (v.err ? '<span class="derr">✗ ' + esc(v.err) + '</span>' : '= <b class="num">' + fmtVal(v.v, it.fmt) + '</b>') + '</span></div>' : '<div class="meta"><span>عنوان قسم</span></div>') + '</div>' +
          '<div class="fe-btns"><button class="iconbtn" data-le="' + key + '" data-op="up" data-i="' + i + '" title="أعلى"' + (i ? '' : ' disabled') + '>↑</button><button class="iconbtn" data-le="' + key + '" data-op="down" data-i="' + i + '" title="أسفل"' + (i < list.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button class="btn sm ghost" data-le="' + key + '" data-op="edit" data-i="' + i + '">تعديل</button><button class="btn sm ghost" data-le="' + key + '" data-op="del" data-i="' + i + '" title="حذف">✕</button></div></div>';
      }).join('') : '<p class="muted">لا توجد أسطر بعد</p>') + '</div>';
    }
    function bindListEditor(m, key, getList, kind, ctxFn, onChange) {
      qa('[data-le="' + key + '"]', m).forEach(function (b) {
        b.onclick = function () {
          var list = getList(), i = Number(b.dataset.i), op = b.dataset.op;
          if (op === 'up' && i > 0) { var t = list[i - 1]; list[i - 1] = list[i]; list[i] = t; onChange(); }
          else if (op === 'down' && i < list.length - 1) { var t2 = list[i + 1]; list[i + 1] = list[i]; list[i] = t2; onChange(); }
          else if (op === 'del') A.confirmBox('حذف', 'حذف «' + esc(list[i].name) + '»؟ (لا يُحذف نهائياً إلا بعد «حفظ التغييرات»)', 'حذف').then(function (y) { if (y) { list.splice(i, 1); onChange(); } });
          else if (op === 'edit') editItem(list[i], kind, ctxFn(i)).then(function (o) { if (o) { list[i] = o; onChange(); } });
        };
      });
    }
    function ctxFor(list, i, from, to, label) {
      var vars = {}, names = [];
      evalList(list.slice(0, i), from, to).forEach(function (r, j) { var n = list[j].name; if (list[j].f && n) { vars[n] = r.err ? 'err' : r.v; names.push(n); } });
      return { from: from, to: to, vars: vars, names: names, perLabel: label };
    }

    /* ---------- منشئ التقرير المخصص ---------- */
    function builderHTML() {
      var d = F.custom || (F.custom = { name: '', cat: 'تقاريري', def: { ds: 'sinv', row: 'month', col: '', meas: ['net', 'profit'], chart: 'bar', top: 0, fdim: '', filter: '' } });
      var df = d.def, formula = df.kind === 'formula';
      var opt = function (list, v) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
      var h = '<div class="card"><h2>تقرير مخصص</h2><p class="small muted" style="margin:0 0 10px">صمّم تقريرك واحفظه باسم ليظهر في «تقاريري المخصصة» لكل المستخدمين.</p>' +
        '<div class="chips" style="margin-bottom:12px"><button class="chip' + (formula ? '' : ' on') + '" data-bk="data">تجميع البيانات (صفوف وأعمدة)</button><button class="chip' + (formula ? ' on' : '') + '" data-bk="formula">تقرير بالمعادلات (بنود × فترات)</button></div><div class="form">';
      if (formula) {
        var t = today();
        h += '<p class="small" style="margin:0">كل سطر معادلة (مثل قائمة الدخل الخاصة بك أو مؤشرات الإدارة)، والأعمدة فترات. يمكن استعمال الحسابات <code>[1601]</code> والدوال وقيم الأسطر السابقة <code>{الاسم}</code>.</p>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="bcols">الأعمدة</label><select id="bcols" class="input">' + opt([['single', 'عمود واحد (الفترة كاملة)'], ['month', 'عمود لكل شهر'], ['week', 'عمود لكل أسبوع'], ['day', 'عمود لكل يوم']], df.cols || 'month') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bch">الرسم (للسطر الأول)</label><select id="bch" class="input">' + opt([['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط']], df.chart || '') + '</select></div></div>' +
          '<div class="field"><span class="lbl">الأسطر</span>' + listEditorHTML('frow', df.rows || [], { from: t.slice(0, 7) + '-01', to: t }) +
          '<div class="row" style="margin-top:8px"><button class="btn sm" data-fadd>+ سطر</button><button class="btn sm ghost" data-fsep>+ عنوان قسم</button></div></div>';
      } else {
        var ds = DS[df.ds], dims = ds.dims.map(function (k) { return [k, DIMS[k][0]]; });
        h += '<div class="field"><label class="lbl" for="bds">مصدر البيانات</label><select id="bds" class="input">' + opt(Object.keys(DS).map(function (k) { return [k, DS[k].name]; }), df.ds) + '</select></div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="brow">الصفوف حسب</label><select id="brow" class="input">' + opt(dims, df.row) + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bcol">الأعمدة حسب (اختياري)</label><select id="bcol" class="input"><option value="">بدون</option>' + opt(dims.filter(function (x) { return x[0] !== df.row; }), df.col) + '</select></div></div>' +
          '<div class="field"><span class="lbl">الأرقام</span><div class="chips">' + Object.keys(ds.meas).map(function (k) { return '<label class="chip' + (df.meas.indexOf(k) >= 0 ? ' on' : '') + '"><input type="checkbox" hidden value="' + k + '"' + (df.meas.indexOf(k) >= 0 ? ' checked' : '') + '>' + esc(ds.meas[k][0]) + '</label>'; }).join('') + '</div>' +
          (df.col ? '<span class="small muted">مع «الأعمدة حسب» يُعرض الرقم الأول فقط موزعاً على الأعمدة</span>' : '') + '</div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="bfd">تصفية حسب (اختياري)</label><select id="bfd" class="input"><option value="">بدون</option>' + opt(dims, df.fdim) + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bfv">يحتوي على</label><input id="bfv" class="input" value="' + esc(df.filter || '') + '" placeholder="مثل: طرابلس"></div></div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="btop">العرض</label><select id="btop" class="input">' + opt([[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50']], df.top) + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bch">الرسم</label><select id="bch" class="input">' + opt([['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط'], ['hbar', 'أشرطة أفقية']], df.chart) + '</select></div></div>';
      }
      h += '<div class="row"><div class="field grow"><label class="lbl" for="bname">اسم التقرير</label><input id="bname" class="input" value="' + esc(d.name || '') + '" placeholder="' + (formula ? 'مثل: مؤشرات الإدارة الشهرية' : 'مثل: مبيعات العملاء شهرياً') + '"></div></div>' +
        '<div class="row"><button class="btn primary" data-brun>معاينة</button><button class="btn accent" data-bsave>' + (d.id ? 'حفظ التعديل' : 'حفظ التقرير') + '</button>' +
        (d.id ? '<button class="btn danger" data-bdel>حذف</button>' : '') + '<button class="btn ghost" data-bnew>جديد</button></div></div></div>';
      if (F.preview) {
        var t2 = today(), p = F.previewP || { from: t2.slice(0, 4) + '-01-01', to: t2 };
        var res = runCustom(df, p);
        h += '<div class="card"><div class="small muted">معاينة: ' + perLabel(p.from, p.to) + ' (يمكن تغيير الفترة بعد الحفظ)' + (res.note ? ' · ' + esc(res.note) : '') + '</div></div>' +
          (res.empty ? '<div class="card empty">' + esc(res.empty) + '</div>' : (res.chart && (res.chart.rowsOverride || res.rows.length > 1) ? '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>' : '') + '<div class="card scroll-x fin-table">' + tableHTML(res) + '</div>');
      }
      return h;
    }
    function bindBuilder(m) {
      var d = F.custom, df = d.def;
      d._upd = null;
      var nm = q('#bname', m); nm.oninput = function () { d.name = this.value; };
      qa('[data-bk]', m).forEach(function (b) {
        b.onclick = function () {
          if ((b.dataset.bk === 'formula') === (df.kind === 'formula')) return;
          d.def = df = b.dataset.bk === 'formula' ? { kind: 'formula', cols: 'month', chart: '', rows: [{ name: 'صافي المبيعات', f: 'مبيعات()', fmt: 'money' }, { name: 'مجمل الربح', f: 'ربح()', fmt: 'money' }, { name: 'هامش الربح', f: 'نسبة({مجمل الربح}, {صافي المبيعات})', fmt: 'pct' }] }
            : { ds: 'sinv', row: 'month', col: '', meas: ['net', 'profit'], chart: 'bar', top: 0, fdim: '', filter: '' };
          F.preview = false; A.render();
        };
      });
      if (df.kind === 'formula') {
        var t = today(), from = t.slice(0, 7) + '-01';
        q('#bcols', m).onchange = function () { df.cols = this.value; A.render(); };
        q('#bch', m).onchange = function () { df.chart = this.value; A.render(); };
        df.rows = df.rows || [];
        bindListEditor(m, 'frow', function () { return df.rows; }, 'frow', function (i) { return ctxFor(df.rows, i, from, t, 'هذا الشهر'); }, function () { A.render(); });
        q('[data-fadd]', m).onclick = function () { editItem(null, 'frow', ctxFor(df.rows, df.rows.length, from, t, 'هذا الشهر')).then(function (o) { if (o) { df.rows.push(o); A.render(); } }); };
        q('[data-fsep]', m).onclick = function () { editItem({ name: '', f: '' }, 'row', { from: from, to: t }).then(function (o) { if (o) { df.rows.push({ name: o.name, f: o.f || '', fmt: o.fmt }); A.render(); } }); };
      } else {
        var upd = function (rerender) {
          df.ds = q('#bds', m).value;
          var dsd = DS[df.ds];
          if (dsd.dims.indexOf(df.row) < 0) df.row = dsd.dims[2];
          df.row = q('#brow', m).value && dsd.dims.indexOf(q('#brow', m).value) >= 0 ? q('#brow', m).value : df.row;
          df.col = q('#bcol', m).value; if (df.col === df.row || dsd.dims.indexOf(df.col) < 0) df.col = '';
          df.meas = qa('.chips input:checked', m).map(function (c) { return c.value; }).filter(function (k) { return dsd.meas[k]; });
          if (!df.meas.length) df.meas = [Object.keys(dsd.meas)[0]];
          df.fdim = q('#bfd', m).value; df.filter = q('#bfv', m).value.trim(); df.top = Number(q('#btop', m).value) || 0; df.chart = q('#bch', m).value;
          d.name = q('#bname', m).value.trim();
          if (rerender) A.render();
        };
        ['#bds', '#brow', '#bcol', '#bfd', '#btop', '#bch'].forEach(function (s) { q(s, m).onchange = function () { if (s === '#bds') { df.meas = []; df.row = 'month'; df.col = ''; df.fdim = ''; } upd(true); }; });
        qa('.chips label', m).forEach(function (l) { l.onclick = function (e) { e.preventDefault(); var c = q('input', l); c.checked = !c.checked; upd(true); }; });
        q('#bfv', m).onchange = function () { upd(F.preview); };
        d._upd = upd;
      }
      q('[data-brun]', m).onclick = function () { if (d._upd) d._upd(false); F.preview = true; A.render(); };
      q('[data-bnew]', m).onclick = function () { F.custom = null; F.preview = false; A.render(); };
      q('[data-bsave]', m).onclick = function () {
        if (d._upd) d._upd(false);
        d.name = nm.value.trim();
        if (!d.name) { toast('اكتب اسم التقرير', true); nm.focus(); return; }
        if (df.kind === 'formula' && !(df.rows || []).some(function (r) { return r.f; })) { toast('أضف سطراً فيه معادلة', true); return; }
        var b = this; busy(b, true);
        var def = JSON.parse(JSON.stringify(df));
        call('fin_report_save', { report: { id: d.id, name: d.name, cat: d.cat, def: def } }).then(function (r) {
          F.reports = r.reports; var saved = r.reports.filter(function (x) { return x.name === d.name; }).pop();
          toast('حُفظ التقرير في «تقاريري المخصصة»'); F.custom = null; F.preview = false;
          if (saved) openReport('c:' + saved.id); else go('reports');
        }).catch(function (e) { busy(b, false); toast(e.message, true); });
      };
      var del = q('[data-bdel]', m);
      if (del) del.onclick = function () {
        A.confirmBox('حذف التقرير', 'حذف «' + esc(d.name) + '» من التقارير المخصصة؟', 'حذف').then(function (y) {
          if (!y) return;
          call('fin_report_delete', { id: d.id }).then(function (r) { F.reports = r.reports; F.custom = null; F.preview = false; toast('حُذف التقرير'); go('reports'); }).catch(function (e) { toast(e.message, true); });
        });
      };
    }

    /* ---------- الإعدادات ---------- */
    var SET_TABS = [['boxes', 'الصناديق والبنوك'], ['cards', 'بطاقات لوحة المؤشرات'], ['daily', 'التقرير اليومي'], ['groups', 'مجموعات الحسابات'], ['data', 'البيانات']];
    function boxSuggestions() {
      var defined = {}; F.boxes.forEach(function (b) { defined[b.acc] = 1; });
      return F.D.accList.filter(function (a) {
        if (!a.leaf || defined[a.id]) return false;
        var anc = acc(a.parent), names = a.name, g = 0;
        while (anc && g++ < 6) { names += ' ' + anc.name; anc = acc(anc.parent); }
        return /الصناديق|خزين|صندوق|المصارف|مصرف|بنك/.test(names) && !/معلق|حوالات|البطاقات/.test(a.name);
      }).map(function (a) { return { acc: a.id, name: a.name.trim(), kind: /مصرف|بنك/.test(a.name + ' ' + (acc(a.parent) || {}).name) ? 'بنك' : 'صندوق', bal: balance([a.id], null, null).close, n: (F.D.byAcc[a.id] || []).length }; })
        .filter(function (x) { return x.n > 0; }).sort(function (x, y) { return y.n - x.n; });
    }
    function editDraft(k) {
      F.edit = F.edit || {};
      if (!F.edit[k]) F.edit[k] = k === 'cards' ? JSON.parse(JSON.stringify(cards())) : JSON.parse(JSON.stringify(dailyDef()));
      return F.edit[k];
    }
    function settingsHTML() {
      var tab = F.setTab || 'boxes', h = '<div class="chips fin-settabs">' + SET_TABS.map(function (t) { return '<button class="chip' + (tab === t[0] ? ' on' : '') + '" data-stab="' + t[0] + '">' + t[1] + (F.dirtyKeys && F.dirtyKeys[t[0]] ? ' •' : '') + '</button>'; }).join('') + '</div>';
      var s = (F.meta && F.meta.settings) || {};
      if (tab === 'boxes') {
        var bx = F.boxes.slice().sort(function (a, b) { return (b.active - a.active) || (a.sort || 0) - (b.sort || 0); });
        var sug = boxSuggestions();
        h += '<div class="card"><h2>الصناديق والبنوك</h2><p class="small muted" style="margin:0 0 10px">عرّف الصناديق والحسابات المصرفية التي تريد متابعة أرصدتها وحركتها وتحصيلها. كل واحد مربوط بحساب في دليل حسابات سراج. «إيقاف» يخفيه من التقارير مع بقاء تعريفه، و«حذف التعريف» يلغي ربطه نهائياً (ولا يمس سراج).</p>' +
          (bx.length ? '<div class="list">' + bx.map(function (b) {
            return '<div class="item' + (b.active ? '' : ' muted') + '"><div class="main"><b>' + esc(b.name) + ' <span class="badge">' + esc(b.kind) + '</span>' + (b.active ? '' : ' <span class="badge">موقوف</span>') + '</b><div class="meta"><span class="num">' + esc((acc(b.acc) || {}).code || '') + '</span><span>' + esc(accName(b.acc)) + '</span><span>الرصيد الآن: <b class="num">' + fm(balance([b.acc], null, null).close) + '</b></span></div></div>' +
              '<div class="fe-btns"><button class="btn sm ghost" data-bedit="' + esc(b.id) + '">تعديل</button>' + (b.active ? '' : '<button class="btn sm ghost" data-bon="' + esc(b.id) + '">تفعيل</button>') + '<button class="btn sm ghost danger-t" data-bdel="' + esc(b.id) + '">حذف التعريف</button></div></div>';
          }).join('') + '</div>' : '<div class="msg info">لم يُعرّف أي صندوق أو بنك بعد.</div>') +
          '<div class="row" style="margin-top:10px"><button class="btn primary" data-badd>+ تعريف صندوق أو بنك</button></div></div>';
        if (sug.length) h += '<div class="card"><h3>حسابات مقترحة من دليل حسابات سراج (' + sug.length + ')</h3><p class="small muted" style="margin:0 0 8px">حسابات تحت «الصناديق» و«المصارف» عليها حركة ولم تُعرّف بعد.</p><div class="list">' +
          sug.map(function (x, i) { return '<label class="item tap"><input type="checkbox" data-sug="' + i + '"><div class="main"><b>' + esc(x.name) + '</b><div class="meta"><span class="badge">' + x.kind + '</span><span>' + fk(x.n) + ' حركة</span><span>الرصيد ' + fm(x.bal) + '</span></div></div></label>'; }).join('') +
          '</div><button class="btn accent" data-sugadd style="margin-top:10px">تعريف المحدد</button></div>';
      } else if (tab === 'cards') {
        var cl = editDraft('cards'), r = presetRange('month');
        h += '<div class="card"><h2>بطاقات لوحة المؤشرات</h2><p class="small muted" style="margin:0 0 10px">كل بطاقة معادلة تحسب للفترة المختارة في اللوحة. القيم الظاهرة هنا لهذا الشهر. مثال: <code>[1601] - [2610] × [1701]</code> أو <code>مبيعات("مخزن:بنغازي")</code>.</p>' +
          listEditorHTML('cards', cl, { from: r[0], to: r[1] }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-cadd>+ بطاقة</button><span class="grow"></span><button class="btn ghost" data-creset>استعادة الافتراضي</button><button class="btn accent" data-csave' + (F.dirtyKeys && F.dirtyKeys.cards ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>';
      } else if (tab === 'daily') {
        var dd = editDraft('daily'), d0 = F.D.maxDate || today();
        h += '<div class="card"><h2>التقرير اليومي للإدارة</h2><p class="small muted" style="margin:0 0 10px">رتّب الأسطر وغيّر معادلة كل سطر. القيم الظاهرة هنا ليوم ' + N(d0) + '.</p>' +
          '<div class="field"><label class="lbl" for="dtitle">عنوان التقرير</label><input id="dtitle" class="input" value="' + esc(dd.title || '') + '"></div>' +
          listEditorHTML('daily', dd.rows, { from: d0, to: d0 }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-dadd>+ سطر</button><button class="btn ghost" data-dsep>+ عنوان قسم</button><span class="grow"></span><button class="btn ghost" data-dreset>استعادة الافتراضي</button><button class="btn accent" data-dsave' + (F.dirtyKeys && F.dirtyKeys.daily ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>' +
          '<div class="card"><h3>ملاحظة عن Sell-Out</h3><p class="small" style="margin:0">«Total Sell-Out» افتراضياً = صافي الكمية المباعة لكل العملاء. إذا كان المقصود مبيعات فئة معينة فقط (مثلاً بدون الوكلاء أو من مخزن واحد) عدّل المعادلة، مثل: <code>كمية_مبيعات("مخزن:المستودع الرئيسي")</code> أو <code>كمية_مبيعات("بدون_عميل:1602")</code>.</p></div>';
      } else if (tab === 'groups') {
        h += '<div class="card"><h2>مجموعات الحسابات</h2><div class="form">' +
          '<div class="field"><span class="lbl">حسابات العملاء (للمديونيات وأعمار الديون والتحصيل)</span><button class="input" data-grp="recv" style="text-align:start">' + esc(grpLabel(s.recv || '1601')) + '</button><span class="small muted">' + fk(recvIds().length) + ' حساب عميل</span></div>' +
          '<div class="field"><span class="lbl">حسابات الموردين</span><button class="input" data-grp="pay" style="text-align:start">' + esc(grpLabel(s.pay || '261')) + '</button><span class="small muted">' + fk(payIds().length) + ' حساب مورد</span></div>' +
          '<div class="field"><label class="lbl" for="fys">بداية السنة المالية</label><input type="date" class="input num" id="fys" value="' + esc(s.year_start || '2026-01-01') + '" style="max-width:200px"></div></div></div>';
      } else {
        h += '<div class="card"><h2>البيانات على هذا الجهاز</h2><p class="small" style="margin:0">' + fk(Object.keys(F.rows || {}).length) + ' سجل · آخر مزامنة ' + esc((F.meta && F.meta.last) || '—') + '</p><p class="small muted">تُحفظ البيانات المالية على هذا الجهاز لتعمل التقارير بسرعة وبلا إنترنت، وتُمسح عند الخروج من التطبيق.</p><button class="btn sm ghost" data-open="data_check">فحص سلامة البيانات</button></div>';
      }
      return h;
    }
    function grpLabel(codes) { return String(codes).split(',').map(function (c) { var a = F.D.byCode[c]; return a ? c + ' · ' + a.name : c; }).join('، '); }
    function markDirty(k, on) { F.dirtyKeys = F.dirtyKeys || {}; F.dirtyKeys[k] = on; F.dirty = Object.keys(F.dirtyKeys).some(function (x) { return F.dirtyKeys[x]; }); }
    function saveConfig(k, value, btn) {
      if (btn) busy(btn, true);
      return call('fin_config_save', { key: k, value: value }).then(function (r) {
        F.config = r.config || {}; F.edit[k] = null; markDirty(k, false); PARSED = {};
        S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config });
        toast(value === null ? 'استُعيد الافتراضي' : 'حُفظ'); A.render();
      }).catch(function (e) { if (btn) busy(btn, false); toast(e.message, true); });
    }
    function bindSettings(m) {
      qa('[data-stab]', m).forEach(function (b) { b.onclick = function () { F.setTab = b.dataset.stab; A.render(); }; });
      var tab = F.setTab || 'boxes';
      if (tab === 'boxes') {
        q('[data-badd]', m).onclick = function () { boxForm(null); };
        qa('[data-bedit]', m).forEach(function (b) { b.onclick = function () { boxForm(F.boxes.filter(function (x) { return x.id === b.dataset.bedit; })[0]); }; });
        qa('[data-bon]', m).forEach(function (b) {
          b.onclick = function () { var x = Object.assign({}, F.boxes.filter(function (y) { return y.id === b.dataset.bon; })[0], { active: true }); busy(b, true); call('fin_box_save', { box: x }).then(function (r) { F.boxes = r.boxes; toast('فُعّل'); A.render(); }).catch(function (e) { busy(b, false); toast(e.message, true); }); };
        });
        qa('[data-bdel]', m).forEach(function (b) {
          b.onclick = function () {
            var x = F.boxes.filter(function (y) { return y.id === b.dataset.bdel; })[0];
            A.confirmBox('حذف التعريف', 'إلغاء ربط «' + esc(x.name) + '» بالحساب ' + esc((acc(x.acc) || {}).code || x.acc) + ' وحذف تعريفه نهائياً من المنظومة المالية؟ لن يظهر بعد ذلك في تقارير الصناديق والتحصيل. لا يتأثر سراج، ويمكنك تعريفه من جديد في أي وقت.', 'حذف التعريف').then(function (y) {
              if (!y) return;
              call('fin_box_delete', { id: x.id }).then(function (r) { F.boxes = r.boxes; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); toast('حُذف التعريف'); A.render(); }).catch(function (e) { toast(e.message, true); });
            });
          };
        });
        var sa = q('[data-sugadd]', m);
        if (sa) sa.onclick = function () {
          var sug = boxSuggestions(), pick = qa('[data-sug]', m).filter(function (c) { return c.checked; }).map(function (c) { return sug[Number(c.dataset.sug)]; });
          if (!pick.length) { toast('حدّد حساباً واحداً على الأقل', true); return; }
          busy(sa, true);
          var chain = Promise.resolve();
          pick.forEach(function (x, i) { chain = chain.then(function () { return call('fin_box_save', { box: { acc: x.acc, name: x.name, kind: x.kind, sort: F.boxes.length + i } }).then(function (r) { F.boxes = r.boxes; }); }); });
          chain.then(function () { toast('عُرّف ' + pick.length + ' صندوق/بنك'); A.render(); }).catch(function (e) { busy(sa, false); toast(e.message, true); A.render(); });
        };
      } else if (tab === 'cards') {
        var cl = editDraft('cards'), r = presetRange('month'), ch = function () { markDirty('cards', true); A.render(); };
        bindListEditor(m, 'cards', function () { return cl; }, 'card', function (i) { return ctxFor(cl, i, r[0], r[1], 'هذا الشهر'); }, ch);
        q('[data-cadd]', m).onclick = function () { editItem({ cmp: true, good: 'up' }, 'card', ctxFor(cl, cl.length, r[0], r[1], 'هذا الشهر')).then(function (o) { if (o) { cl.push(o); ch(); } }); };
        q('[data-csave]', m).onclick = function () { saveConfig('cards', cl, this); };
        q('[data-creset]', m).onclick = function () { A.confirmBox('استعادة الافتراضي', 'استبدال البطاقات الحالية بالبطاقات الافتراضية الست؟', 'استعادة').then(function (y) { if (y) saveConfig('cards', null); }); };
      } else if (tab === 'daily') {
        var dd = editDraft('daily'), d0 = F.D.maxDate || today(), chd = function () { markDirty('daily', true); A.render(); };
        bindListEditor(m, 'daily', function () { return dd.rows; }, 'row', function (i) { return ctxFor(dd.rows, i, d0, d0, 'يوم ' + d0); }, chd);
        q('#dtitle', m).onchange = function () { dd.title = this.value.trim(); chd(); };
        q('[data-dadd]', m).onclick = function () { editItem(null, 'row', ctxFor(dd.rows, dd.rows.length, d0, d0, 'يوم ' + d0)).then(function (o) { if (o) { dd.rows.push(o); chd(); } }); };
        q('[data-dsep]', m).onclick = function () { editItem({ name: '', f: '' }, 'row', { from: d0, to: d0 }).then(function (o) { if (o) { dd.rows.push(o); chd(); } }); };
        q('[data-dsave]', m).onclick = function () { saveConfig('daily', { title: dd.title, rows: dd.rows }, this); };
        q('[data-dreset]', m).onclick = function () { A.confirmBox('استعادة الافتراضي', 'استبدال أسطر التقرير اليومي بالأسطر الافتراضية (مثل نموذج الإدارة)؟', 'استعادة').then(function (y) { if (y) saveConfig('daily', null); }); };
      } else if (tab === 'groups') {
        qa('[data-grp]', m).forEach(function (b) {
          b.onclick = function () {
            var k = b.dataset.grp, cur = String(((F.meta && F.meta.settings) || {})[k] || (k === 'recv' ? '1601' : '261')).split(',');
            pickAccount({ multi: true, value: cur, title: k === 'recv' ? 'حسابات العملاء' : 'حسابات الموردين', hint: 'اختر الحسابات الرئيسية التي تحتها العملاء أو الموردون. كل الحسابات الفرعية تحتها تُحسب تلقائياً.', filter: function (a) { return !a.leaf || a.lvl <= 4; } })
              .then(function (codes) {
                if (!codes || !codes.length) return;
                var body = {}; body[k] = codes.join(',');
                call('fin_settings_save', { settings: body }).then(function (r) { F.meta.settings = r.settings; F.cache = {}; S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); });
              });
          };
        });
        q('#fys', m).onchange = function () { call('fin_settings_save', { settings: { year_start: this.value } }).then(function (r) { F.meta.settings = r.settings; F.cache = {}; S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); }); };
      }
    }
    function boxForm(b) {
      var d = b ? Object.assign({}, b) : { acc: '', name: '', kind: 'صندوق', active: true, sort: F.boxes.length };
      return sheet(b ? 'تعديل ' + b.name : 'تعريف صندوق أو بنك', '<div class="form"><div class="field"><span class="lbl">الحساب في دليل سراج</span><button class="input" id="bacc" style="text-align:start">' + (d.acc ? esc(((acc(d.acc) || {}).code || '') + ' · ' + accName(d.acc)) : 'اختر الحساب…') + '</button></div>' +
        '<div class="field"><label class="lbl" for="bnm">الاسم في التقارير</label><input id="bnm" class="input" value="' + esc(d.name) + '"></div>' +
        '<div class="field"><span class="lbl">النوع</span><div class="chips">' + ['صندوق', 'بنك'].map(function (k) { return '<button class="chip' + (d.kind === k ? ' on' : '') + '" data-k="' + k + '">' + k + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label class="lbl" for="bso">الترتيب</label><input id="bso" type="number" class="input num" value="' + esc(d.sort) + '" style="max-width:120px"></div>' +
        (b ? '<label class="chk"><input type="checkbox" id="bac"' + (d.active ? ' checked' : '') + '> نشط (يظهر في التقارير)</label>' : '') +
        '<div id="berr"></div><button class="btn primary big" id="bsv">حفظ</button></div>', function (s) {
        q('#bacc', s.el).onclick = function () {
          pickAccount({ title: 'حساب الصندوق أو البنك', filter: function (a) { return a.leaf; } }).then(function (id) {
            if (!id) return; d.acc = id; q('#bacc', s.el).textContent = acc(id).code + ' · ' + acc(id).name;
            if (!q('#bnm', s.el).value) q('#bnm', s.el).value = acc(id).name.trim();
          });
        };
        qa('[data-k]', s.el).forEach(function (c) { c.onclick = function () { d.kind = c.dataset.k; qa('[data-k]', s.el).forEach(function (x) { x.classList.toggle('on', x === c); }); }; });
        q('#bsv', s.el).onclick = function () {
          var btn = this; busy(btn, true);
          d.name = q('#bnm', s.el).value.trim(); d.sort = Number(q('#bso', s.el).value) || 0; if (b) d.active = q('#bac', s.el).checked;
          call('fin_box_save', { box: d }).then(function (r) { F.boxes = r.boxes; s.close(); toast('حُفظ'); A.render(); })
            .catch(function (e) { busy(btn, false); q('#berr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
        };
      });
    }

    // عند الخروج: مسح البيانات المالية من الجهاز
    A.onLogout(function () { F.rows = null; F.D = null; F.rev = 0; F.meta = null; F.cur = null; F.edit = null; F.dirtyKeys = null; F.dirty = false; return Promise.all([S.del('fin:rows'), S.del('fin:rev'), S.del('fin:meta'), S.del('fin:aux')]); });
    try { st.finParams = JSON.parse(localStorage.getItem('rk.finParams') || '{}'); } catch (e) { st.finParams = {}; }

    // للاختبارات: الوصول للمحرّك
    window.__rkfin = { F: F, R: R, runCustom: runCustom, build: build, balance: balance, salesStats: salesStats, evalFormula: evalFormula, tryFormula: tryFormula, evalList: evalList,
      stockTotals: stockTotals, collections: collections, dailyData: function () { return dailyData(); }, cards: cards, dailyDef: dailyDef };
  };
})();
