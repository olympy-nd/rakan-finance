
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
      if (def.kind === 'ready') { var rb = R[def.base]; if (!rb) return { cols: [C('m', '')], rows: [], empty: 'التقرير الأساسي غير موجود' }; return rb.run(Object.assign({}, def.p || {}, p)); }
      if (def.kind === 'pair') return runPair(def, p);
      if (def.kind === 'free') return runFree(def, p);
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
      var vals = pc.map(function (c) { return evalList(rows, c.from, c.to, p.flt); });
      var tot = multi && def.total !== false ? evalList(rows, p.from, p.to, p.flt) : null;
      var errs = [];
      var out = rows.map(function (r, i) {
        if (!itemF(r)) return { name: r.name, _b: true, _hl: true };
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
          var had = !!F.D, rev = F.rev + '|' + ((F.pks && F.pks.gen) || ''), nb = JSON.stringify([F.boxes, F.reports, F.config]);
          // التحديث التلقائي لا يعيد رسم الشاشة إلا إذا وصل جديد، حتى لا يقطع ما يكتبه المستخدم
          if (quiet && had && F.lastPull && Date.now() - F.lastPull < 180000) return Promise.resolve(false);
          if (quiet && F.dirty) return Promise.resolve(false);
          F.quiet = quiet;
          return load(false).then(function () { return !had || F.rev + '|' + ((F.pks && F.pks.gen) || '') !== rev || nb !== JSON.stringify([F.boxes, F.reports, F.config]); });
        },
        html: function () {
          if (F.sub !== sub) { F.sub = sub; if (sub !== 'reports') F.cur = null; }
          var h = '';
          if (!F.D && F.error && !F.loading) return '<div class="card empty"><p>تعذّر تحميل البيانات المالية: ' + esc(F.error) + '</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' إعادة المحاولة</button></div>';
          if (!F.D && F.rows && !hasData() && !F.loading && F.meta) return '<div class="card empty"><p>لم تصل بيانات مالية من الوكيل بعد.</p><p class="small muted">بعد إعداد الوكيل على جهاز سراج بمفتاح المنظومة المالية سيرسل القيود والفواتير تلقائياً خلال دقائق.</p><button class="btn primary" data-frefresh>' + ICON.refresh + ' تحقق الآن</button></div>';
          if (!F.D) return '<div class="card loading"><span class="spin"></span> <span id="finprog">' + esc(F.progress || 'جارٍ تحميل البيانات المالية… أول مرة قد تستغرق دقيقة') + '</span></div>';
          h += syncLine();
          if (sub === 'dash' || sub === 'daily' || sub === 'reports') h += brBarHTML();
          else if (multiBr()) useBr('*');   // الإعدادات والمنشئ تعمل على كل البيانات
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
          qa('[data-brv]', m).forEach(function (b) { b.onclick = function () { setBr(b.dataset.brv); A.render(); }; });
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

    /* ---------- اختيار الفرع (يظهر فقط إذا كان الوكيل يقرأ أكثر من قاعدة) ---------- */
    function brBarHTML() {
      if (!multiBr()) return '';
      var v = viewBr();
      useBr(v === 'cmp' ? '*' : v);
      var opts = [{ code: '*', name: 'موحّد' }].concat(branches()).concat([{ code: 'cmp', name: 'مقارنة الفروع' }]);
      return '<div class="br-bar" role="group" aria-label="الفرع"><span class="br-l">الفرع</span><div class="seg">' + opts.map(function (o) {
        return '<button class="seg-b' + (v === o.code ? ' on' : '') + '" data-brv="' + esc(o.code) + '">' + esc(o.name) + '</button>';
      }).join('') + '</div></div>';
    }
    function brNote() { return multiBr() ? brName(viewBr()) : ''; }

    function syncLine() {
      var m = F.meta || {}, ck = m.check || {};
      var lb = m.agent && m.agent.last_beat;
      return '<div class="fin-sync"><span class="fs-dot' + (ck.balanced === false ? ' bad' : '') + '"></span><span class="fs-t">آخر بيانات من سراج ' + (m.last ? N(String(m.last).slice(5, 16).replace('-', '/')) : '—') + '</span>' +
        (ck.balanced === false ? '<span class="badge b-flag">القيود غير متوازنة في سراج</span>' : ck.balanced ? '<span class="fs-ok">القيود متوازنة ✓</span>' : '') +
        (lb ? '<span class="fs-ag">الوكيل ' + N(String(lb).slice(11, 16)) + '</span>' : '') + '<button class="btn sm ghost fs-btn" data-frefresh aria-label="تحديث البيانات">' + ICON.refresh + '<span class="bt-txt">تحديث</span></button></div>';
    }

    /* ---------- اختيار الفترة (موحّد للوحة والتقارير) ---------- */
    var QUICK = [['today', 'اليوم'], ['week', 'الأسبوع'], ['month', 'الشهر'], ['@q', 'الربع'], ['year', 'السنة']];
    var ICON_CAL = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" style="vertical-align:-3px"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>';
    var ICON_XLS = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 2h9l5 5v15H6z"/><path d="M9 11l5 6M14 11l-5 6"/></svg>';
    var ICON_EDIT = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>';
    function rangeText(a, b) {
      var d1 = +a.slice(8, 10), m1 = +a.slice(5, 7), y1 = a.slice(0, 4), d2 = +b.slice(8, 10), m2 = +b.slice(5, 7), y2 = b.slice(0, 4);
      if (a === b) return d1 + ' ' + MONTHS[m1 - 1] + ' ' + y1;
      if (y1 === y2 && m1 === m2) return d1 + ' – ' + d2 + ' ' + MONTHS[m1 - 1] + ' ' + y1;
      if (y1 === y2) return d1 + ' ' + MONTHS[m1 - 1] + ' – ' + d2 + ' ' + MONTHS[m2 - 1] + ' ' + y1;
      return d1 + ' ' + MONTHS[m1 - 1] + ' ' + y1 + ' – ' + d2 + ' ' + MONTHS[m2 - 1] + ' ' + y2;
    }
    function perRange(ps) { return presetRange(ps.preset, ps.from, ps.to, ps.year, ps.month); }
    function isCmp(p) { return p === 'cmpq' || p === 'cmpm'; }
    function isQ(p) { return /^q[1-4]$/.test(p) || p === 'quarter' || p === 'cmpq'; }
    function yearsAvail() {
      if (!F.cache.years) { var mn = T().jl.reduce(function (x, l) { return l.d && l.d < x ? l.d : x; }, today()); var out = []; for (var y = +today().slice(0, 4); y >= +mn.slice(0, 4); y--) out.push(String(y)); F.cache.years = out; }
      return F.cache.years;
    }
    function periodHTML(ps, key, o) {
      o = o || {};
      var r = perRange(ps), cmp = isCmp(ps.preset), pr = o.prev && !cmp ? prevRange(r[0], r[1], ps.preset) : null;
      var on = function (k) { return k === '@q' ? isQ(ps.preset) : ps.preset === k; };
      var moreOn = !QUICK.some(function (k) { return on(k[0]); });
      var qLbl = ps.preset === 'cmpq' ? 'مقارنة الأرباع' : /^q[1-4]$/.test(ps.preset) ? QNAMES[+ps.preset[1] - 1] : ps.preset === 'quarter' ? 'هذا الربع' : 'الربع';
      return '<div class="per"><div class="per-strip" role="group" aria-label="الفترة">' + QUICK.map(function (k) {
        return '<button class="per-b' + (on(k[0]) ? ' on' : '') + '" ' + (k[0] === '@q' ? 'data-pq="' + key + '"' : 'data-pset="' + key + '|' + k[0] + '"') + '>' + (k[0] === '@q' ? esc(qLbl) + ' <i class="car">▾</i>' : k[1]) + '</button>';
      }).join('') + '<button class="per-b per-more' + (moreOn ? ' on' : '') + '" data-per="' + key + '">' + (moreOn ? esc(presetName(ps.preset, ps.year, ps.month)) : 'فترة أخرى') + ' <i class="car">▾</i></button></div>' +
        '<div class="per-info">' + ICON_CAL + ' <b>' + esc(cmp ? presetName(ps.preset, ps.year) + ' (' + rangeText(r[0], r[1]) + ')' : rangeText(r[0], r[1])) + '</b>' +
        (ps.year && ps.year !== today().slice(0, 4) && !cmp && /^q|mon/.test(ps.preset) ? '' : '') + (pr ? '<span class="per-prev">مقارنة بـ ' + esc(rangeText(pr[0], pr[1])) + '</span>' : '') + '</div></div>';
    }
    function yearChips(y) { var ys = yearsAvail(); return ys.length > 1 ? '<div class="ps-years">' + ys.map(function (x) { return '<button class="chip' + (x === y ? ' on' : '') + '" data-yr="' + x + '">' + x + '</button>'; }).join('') + '</div>' : ''; }
    function quarterSheet(ps, allowCmp) {
      return new Promise(function (res) {
        var y = ps.year || today().slice(0, 4);
        sheet('اختر الربع', '<div id="qsb"></div>', function (s) {
          var draw = function () {
            var t = today();
            q('#qsb', s.el).innerHTML = yearChips(y) + '<div class="ps-q">' + [0, 1, 2, 3].map(function (i) {
              var rr = presetRange('q' + (i + 1), null, null, y), fut = rr[0] > t, sel = ps.preset === 'q' + (i + 1) && (ps.year || t.slice(0, 4)) === y;
              return '<button class="ps-qb' + (sel ? ' on' : '') + '" data-setp="q' + (i + 1) + '"' + (fut ? ' disabled' : '') + '><b>' + QNAMES[i] + '</b><span>' + MONTHS[i * 3] + ' – ' + MONTHS[i * 3 + 2] + '</span>' + (fut ? '<em>لم يبدأ</em>' : rr[1] < monthEnd(rr[1].slice(0, 7)) || (rr[1] === t) ? '<em>حتى اليوم</em>' : '') + '</button>';
            }).join('') + '</div>' + (allowCmp ? '<button class="ps-cmp' + (ps.preset === 'cmpq' ? ' on' : '') + '" data-setp="cmpq"><b>كل الأرباع: مقارنة بينها</b><span>عمود لكل ربع في ' + y + ' مع الإجمالي</span></button>' : '');
            qa('[data-yr]', s.el).forEach(function (b) { b.onclick = function () { y = b.dataset.yr; draw(); }; });
            qa('[data-setp]', s.el).forEach(function (b) { b.onclick = function () { s.done = true; s.close(); res({ preset: b.dataset.setp, year: y }); }; });
          };
          draw();
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function periodSheet(ps, allowCmp) {
      return new Promise(function (res) {
        var y = ps.year || today().slice(0, 4), r0 = perRange(ps);
        sheet('اختر الفترة', '<div id="psb"></div>', function (s) {
          var draw = function () {
            var t = today(), cy = y === t.slice(0, 4);
            var b = function (k, l, extra, dis) { return '<button class="ps-b' + (ps.preset === k && (!extra || extra === ps.month) ? ' on' : '') + '" data-setp="' + k + '"' + (extra ? ' data-mon="' + extra + '"' : '') + (dis ? ' disabled' : '') + '>' + l + '</button>'; };
            q('#psb', s.el).innerHTML =
              '<div class="ps-sec"><div class="ps-h">سريع</div><div class="ps-grid">' + b('today', 'اليوم') + b('yesterday', 'أمس') + b('week', 'هذا الأسبوع') + b('last7', 'آخر 7 أيام') + b('month', 'هذا الشهر') + b('lastmonth', 'الشهر الماضي') + '</div></div>' +
              (yearsAvail().length > 1 ? '<div class="ps-sec"><div class="ps-h">السنة</div>' + yearChips(y) + '</div>' : '') +
              '<div class="ps-sec"><div class="ps-h">شهر من ' + y + '</div><div class="ps-grid ps-m">' + MONTHS.map(function (mn, i) { var mm = y + '-' + ('0' + (i + 1)).slice(-2); return b('mon', mn, mm, mm + '-01' > t); }).join('') + '</div></div>' +
              '<div class="ps-sec"><div class="ps-h">ربع من ' + y + '</div><div class="ps-grid">' + [1, 2, 3, 4].map(function (i) { var rr = presetRange('q' + i, null, null, y); return '<button class="ps-b' + (ps.preset === 'q' + i && (ps.year || t.slice(0, 4)) === y ? ' on' : '') + '" data-setp="q' + i + '"' + (rr[0] > t ? ' disabled' : '') + '>' + QNAMES[i - 1] + '</button>'; }).join('') + '</div></div>' +
              '<div class="ps-sec"><div class="ps-h">السنة كاملة</div><div class="ps-grid">' + '<button class="ps-b" data-yfull>سنة ' + y + (cy ? ' حتى اليوم' : '') + '</button>' +
              (allowCmp ? '<button class="ps-b ps-c' + (ps.preset === 'cmpq' ? ' on' : '') + '" data-setp="cmpq">مقارنة الأرباع ' + y + '</button><button class="ps-b ps-c' + (ps.preset === 'cmpm' ? ' on' : '') + '" data-setp="cmpm">مقارنة الأشهر ' + y + '</button>' : '') + '</div></div>' +
              '<div class="ps-sec"><div class="ps-h">فترة محددة</div><div class="ps-cust"><label>من<input type="date" class="input num" id="psf" value="' + r0[0] + '"></label><label>إلى<input type="date" class="input num" id="pst" value="' + r0[1] + '"></label><button class="btn primary" data-pscust>تطبيق</button></div></div>';
            qa('[data-yr]', s.el).forEach(function (bb) { bb.onclick = function () { y = bb.dataset.yr; draw(); }; });
            qa('[data-setp]', s.el).forEach(function (bb) { bb.onclick = function () { s.done = true; s.close(); res({ preset: bb.dataset.setp, year: y, month: bb.dataset.mon || null }); }; });
            q('[data-yfull]', s.el).onclick = function () { s.done = true; s.close(); res({ preset: 'custom', from: y + '-01-01', to: (y + '-12-31') > t ? t : y + '-12-31', year: y }); };
            q('[data-pscust]', s.el).onclick = function () { var f = q('#psf', s.el).value, tt = q('#pst', s.el).value; if (!f || !tt || f > tt) { toast('اختر تاريخين صحيحين', true); return; } s.done = true; s.close(); res({ preset: 'custom', from: f, to: tt }); };
          };
          draw();
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function bindPeriod(m, key, getPs, setPs, allowCmp) {
      var apply = function (patch) { if (!patch) return; var ps = Object.assign({}, getPs(), patch); if (patch.preset !== 'custom') { var r = presetRange(ps.preset, null, null, ps.year, ps.month); ps.from = r[0]; ps.to = r[1]; } setPs(ps); };
      qa('[data-pset^="' + key + '|"]', m).forEach(function (b) { b.onclick = function () { apply({ preset: b.dataset.pset.split('|')[1], year: null, month: null }); }; });
      var bq = q('[data-pq="' + key + '"]', m); if (bq) bq.onclick = function () { quarterSheet(getPs(), allowCmp).then(apply); };
      var bm = q('[data-per="' + key + '"]', m); if (bm) bm.onclick = function () { periodSheet(getPs(), allowCmp).then(apply); };
    }

    /* ---------- لوحة المؤشرات (بطاقات) ---------- */
    var DASH_DIMS = ['cust', 'item', 'st', 'ag', 'xcust', 'xitem'];
    function cardHTML(c, r, pr, i) {
      var v = r.err ? null : r.v, pv = pr && !pr.err ? pr.v : null;
      var ch = c.cmp && pv ? (v - pv) / Math.abs(pv) * 100 : null, good = c.good === 'down' ? ch < 0 : ch > 0;
      var tag = c.rep && R[c.rep] ? 'button' : 'div';
      return '<' + tag + (tag === 'button' ? ' data-crep="' + esc(c.rep) + '"' : '') + ' class="kpi fin-kpi' + (tag === 'button' ? ' tap' : '') + '" title="' + esc(itemText(c)) + '"><span class="k-n">' + esc(c.name) + '</span>' +
        (r.err ? '<b class="num">—</b><small class="down">خطأ: ' + esc(r.err) + '</small>' : '<b class="num">' + fmtVal(v, c.fmt || 'money0') + '</b>') +
        (ch !== null && isFinite(ch) ? '<small class="k-ch ' + (Math.abs(ch) < 0.05 ? '' : good ? 'up' : 'down') + '">' + (ch > 0 ? '▲ ' : ch < 0 ? '▼ ' : '') + fp(Math.abs(ch)) + ' <span class="muted">عن السابقة</span></small>' : '') +
        (c.sub && r.sub !== null && r.sub !== undefined ? '<small class="muted">' + fmtVal(r.sub, c.subfmt || 'int') + ' ' + esc(c.subl || '') + '</small>' : '') + '</' + tag + '>';
    }
    function dashPs() { return F.dash || (F.dash = { preset: 'month' }); }
    function dashRange() { return perRange(dashPs()); }
    function dashHTML() {
      var ps = dashPs(), r = dashRange(), list = cards(), gf = F.gflt, rv = recvFor(gf), cmp = isCmp(ps.preset);
      F.lastRange = r;
      var h = '<div class="card head-card"><div class="hc-top"><h2 class="hc-sub">الفترة</h2>' + (canEdit() ? '<button class="btn sm ghost" data-custom>' + ICON_EDIT + '<span class="bt-txt">تخصيص البطاقات</span></button>' : '') + '</div>' +
        periodHTML(ps, 'dash', { prev: true }) + fltPanelHTML(DASH_DIMS, gf, 'dash') + '</div>';
      if (viewBr() === 'cmp') {
        var bs = branches(), bv = bs.map(function (b) { return withBr(b.code, function () { return evalList(list, r[0], r[1], gf); }); }), tv = evalList(list, r[0], r[1], gf);
        h += '<div class="card scroll-x fin-table"><h3>مقارنة الفروع · ' + esc(rangeText(r[0], r[1])) + '</h3><table class="tbl fin"><thead><tr><th>المؤشر</th>' + bs.map(function (b) { return '<th class="n">' + esc(b.name) + '</th>'; }).join('') + '<th class="n">الموحّد</th></tr></thead><tbody>' +
          list.map(function (c, i) { var cell = function (v) { return '<td class="n">' + (v[i].err ? '—' : fmtVal(v[i].v, c.fmt || 'money0')) + '</td>'; }; return '<tr><td>' + esc(c.name) + '</td>' + bv.map(cell).join('') + cell(tv).replace('<td class="n">', '<td class="n"><b>').replace('</td>', '</b></td>') + '</tr>'; }).join('') + '</tbody></table>' +
          '<p class="small muted" style="margin:8px 0 0">كل فرع من قاعدة بياناته في سراج. الموحّد يجمع الفروع كلها.</p></div>';
        if (list.length) h += '<div class="card"><h3>' + esc(list[0].name) + '</h3>' + chartSVG({ type: 'bar', x: 'name', y: ['v'], yl: [list[0].name] }, bs.map(function (b, j) { return { name: b.name, v: bv[j][0].err ? 0 : bv[j][0].v }; })) + '</div>';
        return h;
      }
      if (cmp) {
        var pcs = comparePeriods(ps.preset, ps.year), vals = pcs.map(function (c) { return evalList(list, c.from, c.to, gf); });
        h += '<div class="card scroll-x fin-table"><h3>' + esc(presetName(ps.preset, ps.year)) + '</h3><table class="tbl fin"><thead><tr><th>المؤشر</th>' + pcs.map(function (c) { return '<th class="n">' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          list.map(function (c, i) { return '<tr><td>' + esc(c.name) + '</td>' + vals.map(function (v) { return '<td class="n">' + (v[i].err ? '—' : fmtVal(v[i].v, c.fmt || 'money0')) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
        if (list.length) h += '<div class="card"><h3>' + esc(list[0].name) + '</h3>' + chartSVG({ type: 'bar', x: 'name', y: ['v'], yl: [list[0].name] }, pcs.map(function (c, j) { return { name: c.l, v: vals[j][0].err ? 0 : vals[j][0].v }; })) + '</div>';
        return h;
      }
      var pr = prevRange(r[0], r[1], ps.preset);
      var cur = evalList(list, r[0], r[1], gf), prev = list.some(function (c) { return c.cmp; }) ? evalList(list, pr[0], pr[1], gf) : [];
      h += '<div class="kpis fin-kpis">' + list.map(function (c, i) { return cardHTML(c, cur[i], prev[i], i); }).join('') + '</div>';
      var months = [], m0 = r[1].slice(0, 7);
      for (var i = 5; i >= 0; i--) { var mm = m0, k = i; while (k-- > 0) mm = addD(mm + '-01', -1).slice(0, 7); months.push(mm); }
      var series = months.map(function (mm) { var e = monthEnd(mm) > r[1] ? r[1] : monthEnd(mm); return { name: MONTHS[+mm.slice(5, 7) - 1], net: salesStats(mm + '-01', e, gf).net, coll: collections(mm + '-01', e, '', false, rv) }; });
      h += '<div class="grid2"><div class="card"><h3>المبيعات والتحصيل · آخر 6 أشهر</h3>' + chartSVG({ type: 'bar', x: 'name', y: ['net', 'coll'], yl: ['صافي المبيعات', 'التحصيل'] }, series) + '</div>';
      var top = R.sales_cust.run({ from: r[0], to: r[1], top: 7, flt: gf }).rows;
      h += '<div class="card"><h3>أعلى العملاء مبيعاً</h3>' + (top.length ? chartSVG({ type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] }, top) : '<p class="muted">لا مبيعات في الفترة</p>') + '</div></div>';
      h += '<div class="card"><h3>تقارير سريعة</h3><div class="quick-reps">' + [['exec_summary', 'الملخص التنفيذي'], ['sales_item', 'المبيعات حسب الصنف'], ['sales_cust', 'المبيعات حسب العميل'], ['collections_daily', 'التحصيل اليومي'],
        ['recv_aging', 'أعمار الديون'], ['stock_balance', 'أرصدة المخزون'], ['boxes', 'الصناديق والبنوك'], ['income', 'قائمة الدخل']].map(function (x) { return '<button class="qr" data-qopen="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
        '<button class="qr" data-gosub="daily">التقرير اليومي للإدارة</button></div></div>';
      return h;
    }
    function dashReportParams(id) {
      var ps = dashPs(), r = dashRange(), def = R[id], o = {};
      if (def.params.indexOf('period') >= 0) Object.assign(o, { preset: isCmp(ps.preset) && false ? 'custom' : ps.preset, year: ps.year || null, month: ps.month || null, from: r[0], to: r[1] }); else o.asof = r[1];
      if (def.params.indexOf('flt') >= 0) o.flt = F.gflt || null;
      return o;
    }
    function bindDash(m) {
      bindPeriod(m, 'dash', dashPs, function (ps) { F.dash = ps; A.render(); }, true);
      qa('[data-crep]', m).forEach(function (b) { b.onclick = function () { openReport(b.dataset.crep, dashReportParams(b.dataset.crep)); }; });
      qa('[data-qopen]', m).forEach(function (b) { b.onclick = function () { openReport(b.dataset.qopen, dashReportParams(b.dataset.qopen)); }; });
      qa('[data-gosub]', m).forEach(function (b) { b.onclick = function () { go(b.dataset.gosub); }; });
      var cu = q('[data-custom]', m);
      if (cu) cu.onclick = function () { F.setTab = 'cards'; go('settings'); };
      bindFltPanel(m, 'dash', DASH_DIMS, function () { return F.gflt; }, function (f) { F.gflt = f; A.render(); });
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
      var vals = cols.map(function (c) { return evalList(def.rows, c.from, c.to, F.dflt); });
      return { def: def, cols: cols, vals: vals, date: F.dailyDate || F.D.maxDate || today() };
    }
    function dailyTable(D, cls) {
      return '<table class="' + cls + '"><thead><tr><th class="dh-s">Subject</th>' + D.cols.map(function (c) { return '<th class="dh-d">' + esc(c.l) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        D.def.rows.map(function (r, i) {
          if (!itemF(r)) return '<tr class="dsep"><th colspan="' + (D.cols.length + 1) + '">' + esc(r.name) + '</th></tr>';
          return '<tr><th class="dl">' + esc(r.name) + '</th>' + D.vals.map(function (v) { var x = v[i]; return '<td class="dv"' + (x.err ? ' title="' + esc(x.err) + '"' : '') + '>' + (x.err ? '<span class="derr">خطأ</span>' : fmtVal(x.v, r.fmt || 'dec2')) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }
    function dailyHTML() {
      var D = dailyData(), errs = [];
      D.def.rows.forEach(function (r, i) { D.vals.forEach(function (v) { if (v[i].err && errs.indexOf(r.name) < 0) errs.push(r.name); }); });
      var h = '<div class="card head-card"><div class="hc-top"><div class="grow"><h2>' + esc(D.def.title || 'التقرير اليومي للإدارة') + '</h2></div><div class="rh-act">' +
        '<button class="btn sm" data-dxls aria-label="Excel">' + ICON_XLS + '<span class="bt-txt">Excel</span></button><button class="btn sm" data-dprt aria-label="طباعة">' + ICON.print + '<span class="bt-txt">طباعة / PDF</span></button>' + (canEdit() ? '<button class="btn sm ghost" data-dcustom aria-label="تخصيص الأسطر">' + ICON_EDIT + '<span class="bt-txt">تخصيص</span></button>' : '') + '</div></div>' +
        '<div class="day-nav"><button class="iconbtn" data-dprev aria-label="اليوم السابق" title="اليوم السابق"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button><label class="day-date">' + ICON_CAL + '<input type="date" class="input num" id="ddate" value="' + D.date + '"></label><button class="iconbtn" data-dnext aria-label="اليوم التالي" title="اليوم التالي"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>' +
        '<span class="day-lbl">' + esc(DOW[new Date(d2t(D.date)).getUTCDay()] + ' ' + rangeText(D.date, D.date)) + '</span></div>' +
        '<div class="seg" role="group" aria-label="الأعمدة"><button class="seg-b' + (F.dailyMode !== 'days7' ? ' on' : '') + '" data-dmode="day">يوم واحد</button><button class="seg-b' + (F.dailyMode === 'days7' ? ' on' : '') + '" data-dmode="days7">آخر 7 أيام</button>' +
        '<button class="seg-b' + (F.dailyMtd ? ' on' : '') + '" data-dmtd>+ من بداية الشهر</button></div>' +
        fltPanelHTML(DASH_DIMS, F.dflt, 'daily') +
        (errs.length ? '<div class="msg err" style="margin-top:8px">أسطر فيها خطأ: ' + esc(errs.join('، ')) + (canEdit() ? '. صحّحها من «تخصيص الأسطر».' : '') + '</div>' : '') + '</div>';
      if (viewBr() === 'cmp') {
        branches().forEach(function (b) {
          h += '<div class="card scroll-x"><h3>' + esc(b.name) + '</h3><div class="daily-wrap">' + withBr(b.code, function () { return dailyTable(dailyData(), 'daily'); }) + '</div></div>';
        });
        h += '<div class="card scroll-x"><h3>الموحّد (كل الفروع)</h3><div class="daily-wrap">' + dailyTable(D, 'daily') + '</div>' +
          '<p class="small muted" style="margin:10px 0 0">الأرصدة والمخزون في نهاية اليوم، والمبيعات والتحصيل لليوم نفسه.</p></div>';
        return h;
      }
      h += '<div class="card scroll-x"><div class="daily-wrap">' + dailyTable(D, 'daily') + '</div>' +
        '<p class="small muted" style="margin:10px 0 0">الأرصدة والمخزون في نهاية اليوم، والمبيعات والتحصيل لليوم نفسه.</p></div>';
      return h;
    }
    function bindDaily(m) {
      var setD = function (d) { F.dailyDate = d; A.render(); };
      q('#ddate', m).onchange = function () { if (this.value) setD(this.value); };
      qa('[data-dmode]', m).forEach(function (b) { b.onclick = function () { F.dailyMode = b.dataset.dmode; A.render(); }; });
      q('[data-dmtd]', m).onclick = function () { F.dailyMtd = !F.dailyMtd; A.render(); };
      q('[data-dprev]', m).onclick = function () { setD(addD(F.dailyDate || F.D.maxDate || today(), -1)); };
      q('[data-dnext]', m).onclick = function () { setD(addD(F.dailyDate || F.D.maxDate || today(), 1)); };
      bindFltPanel(m, 'daily', DASH_DIMS, function () { return F.dflt; }, function (f) { F.dflt = f; A.render(); });
      var cu = q('[data-dcustom]', m);
      if (cu) cu.onclick = function () { F.setTab = 'daily'; go('settings'); };
      q('[data-dxls]', m).onclick = function () { exportDaily(); };
      q('[data-dprt]', m).onclick = function () {
        var D = dailyData(), P = document.getElementById('print');
        P.innerHTML = '<div class="p-rep p-daily"><div class="p-head"><img src="logo.png" alt=""><div class="t"><b>' + esc(D.def.title || 'التقرير اليومي للإدارة') + '</b><span>شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + esc(D.date) + '</span></div><span class="p-copy">' + esc('طُبع ' + RK.nowStr().slice(0, 16)) + '</span></div>' +
          (noteF({ flt: F.dflt }) ? '<p class="p-note">' + esc(noteF({ flt: F.dflt })) + '</p>' : '') + dailyTable(D, 'daily pd') + '<p class="p-note">من بيانات سراج حتى ' + esc((F.meta && F.meta.last) || '') + '</p></div>';
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
        put(1, 0, xcell('شركة راكان لاستيراد المواد الغذائية والتوزيع · ' + D.date + (noteF({ flt: F.dflt }) ? ' · ' + noteF({ flt: F.dflt }) : ''), { font: XS.font({ color: { rgb: '595959' } }) }));
        R0 = 3;
        var hs = { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }), fill: { fgColor: { rgb: 'ED7D31' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: XS.border };
        put(R0, 0, xcell('Subject', hs)); D.cols.forEach(function (c, j) { put(R0, j + 1, xcell(c.l, Object.assign({}, hs))); });
        D.def.rows.forEach(function (r, i) {
          var rr = R0 + 1 + i;
          if (!itemF(r)) { put(rr, 0, xcell(r.name, { font: XS.font({ bold: true, color: { rgb: 'FFFFFF' } }), fill: { fgColor: { rgb: '0C4CA2' } }, border: XS.border })); for (var j = 1; j < nc; j++) put(rr, j, xcell('', { fill: { fgColor: { rgb: '0C4CA2' } }, border: XS.border })); return; }
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

    function openReport(id, params) {
      // نحفظ موضع قائمة التقارير لنعود إليه عند الرجوع
      if (!F.cur) F.catY = A.st.tab === 'reports' ? (window.scrollY || 0) : 0;
      var def = id.indexOf('c:') === 0 ? F.reports.filter(function (r) { return 'c:' + r.id === id; })[0] : null;
      if (!def && !R[id]) { toast('التقرير غير موجود', true); return; }
      var t = today();
      var base = { preset: 'month', from: t.slice(0, 7) + '-01', to: t, asof: t, gran: 'day', level: 3, top: 0, rby: 'cust', vby: 'none', box: 'all', nonzero: 'nz', measure: 'value', idle: 30, boxkind: 'all', etype: 'all', flt: null };
      var saved = (st.finParams || {})[id] || {};
      if (def) (def.def.kind === 'ready' && R[def.def.base] ? R[def.def.base].sel || [] : []).forEach(function (x) { base[x[0]] = x[2][0][0]; });
      else (R[id].sel || []).forEach(function (x) { base[x[0]] = x[2][0][0]; });
      var p = Object.assign(base, def && def.def.p ? def.def.p : {}, saved, params || {});
      var pin = pinnedFilter(), ddef = def ? (def.def.kind === 'ready' && R[def.def.base] ? R[def.def.base] : null) : R[id];
      if (!pin && p._pin) { p.flt = null; delete p._pin; }
      if (pin && ddef && ddef.params.indexOf('flt') >= 0 && !(params && params.flt)) { var pf = fltFor(pin.flt, fdimsFor(ddef)); if (pf) { p.flt = pf; p._pin = pin.name; } }
      if (def && !saved.view && def.def.view) p.view = JSON.parse(JSON.stringify(def.def.view));
      if (params && params.preset) { p.year = params.year || null; p.month = params.month || null; }
      var dd = def ? (def.def.kind === 'ready' && R[def.def.base] ? R[def.def.base] : { params: ['period'] }) : R[id];
      if (isCmp(p.preset) && dd.params.indexOf('period') < 0) p.preset = 'month';
      F.cur = { id: id, custom: def, p: p };
      go('reports');
      window.scrollTo(0, 0);
    }

    function curDef() { var c = F.cur; if (c.custom && c.custom.def.kind === 'ready' && R[c.custom.def.base]) return Object.assign({}, R[c.custom.def.base], { name: c.custom.name, desc: customDesc(c.custom.def) }); return c.custom ? { name: c.custom.name, desc: customDesc(c.custom.def), params: c.custom.def.kind === 'formula' ? ['period', 'flt'] : ['period'], fdims: DASH_DIMS } : R[c.id]; }
    function runCur() {
      var c = F.cur, p = c.p;
      if (p.preset && p.preset !== 'custom') { var r = presetRange(p.preset, p.from, p.to, p.year, p.month); p.from = r[0]; p.to = r[1]; }
      var fn = function (pp) { return c.custom ? runCustom(c.custom.def, pp) : R[c.id].run(pp); };
      if (multiBr() && viewBr() === 'cmp') {
        var bs = branches(), pcsB = bs.map(function (b) { return { l: b.name, code: b.code }; });
        var oc = runCompare(function (pp, pc) { return withBr(pc.code, function () { return isCmp(pp.preset) && curDef().params.indexOf('period') >= 0 ? runCompare(fn, pp) : fn(pp); }); }, p, pcsB);
        c.rawCols = oc && oc.cols; return applyView(oc, p.view);
      }
      var out = isCmp(p.preset) && curDef().params.indexOf('period') >= 0 ? runCompare(fn, p) : fn(p);
      if (multiBr() && out && !out.empty) out.note = brNote() + (out.note ? ' · ' + plain(out.note) : '');
      c.rawCols = out && out.cols; return groupBySel(applyView(out, p.view), p.flt, c.id && R[c.id] && R[c.id].cat === 'cgrp' ? 'none' : grpMode(p));
    }
    // مقارنة الأرباع أو الأشهر: يُشغَّل التقرير لكل فترة، ويُعرض رقم واحد يختاره المستخدم في عمود لكل فترة
    var CMP_PREF = ['net', 'tot', 'v', 'a', 'sales', 'val', 'inn', 'pur', 'qty', 'q', 'dr', 'n'];
    var CMP_NOSUM = /^(close|bal|open|avg|avgp|margin|share|rp|cr|ch|cover|lim|cost|p|min|max|spread|daily|age)$/;
    // pcsIn: أعمدة جاهزة (الفروع)؛ بدونها تكون الأعمدة فترات (أرباع أو أشهر)
    function runCompare(fn, p, pcsIn) {
      var pcs = pcsIn || comparePeriods(p.preset, p.year);
      if (!pcs.length) return { cols: [C('m', '')], rows: [], empty: 'لا توجد فترات للمقارنة في هذه السنة' };
      var res = pcs.map(function (c) { return pcsIn ? fn(p, c) : fn(Object.assign({}, p, { preset: 'custom', from: c.from, to: c.to })); });
      var base = res.filter(function (r) { return r && r.cols && r.cols.length > 1 && !r.empty; })[0];
      if (!base) return res[0];
      var nums = base.cols.filter(function (c) { return isNum(c); });
      if (!nums.length) return { cols: [C('m', '')], rows: [], empty: 'هذا التقرير لا يحتوي أرقاماً للمقارنة' };
      var mk = nums.filter(function (c) { return c.k === p.cmpcol; })[0] || CMP_PREF.map(function (k) { return nums.filter(function (c) { return c.k === k; })[0]; }).filter(Boolean)[0] || nums[0];
      var firstNum = base.cols.indexOf(nums[0]), keyCols = base.cols.slice(0, Math.max(1, Math.min(2, firstNum))).filter(function (c) { return !isNum(c); });
      var rows = [], idx = {};
      res.forEach(function (r, j) {
        (r.rows || []).forEach(function (row) {
          var key = keyCols.map(function (c) { return plain(row[c.k]); }).join('|');
          var o = idx[key];
          if (!o) { o = idx[key] = { _lvl: row._lvl, _b: row._b, _hl: row._hl, _acc: row._acc, _fmt: row._fmt }; keyCols.forEach(function (c) { o[c.k] = row[c.k]; }); rows.push(o); }
          var v = row[mk.k]; if (typeof v === 'number') o['p' + j] = (o['p' + j] || 0) + v;
        });
      });
      var sumOk = mk.t !== 'pct' && !CMP_NOSUM.test(mk.k);
      rows.forEach(function (o) {
        if (sumOk) o.tot = pcs.reduce(function (sm, c, j) { return sm + (o['p' + j] || 0); }, 0);
        var n = pcs.length; if (n > 1 && typeof o['p' + (n - 1)] === 'number' && o['p' + (n - 2)]) o.chg = (o['p' + (n - 1)] - o['p' + (n - 2)]) / Math.abs(o['p' + (n - 2)]) * 100;
      });
      var cols = keyCols.concat(pcs.map(function (c, j) { return C('p' + j, c.l, mk.t); }));
      if (sumOk) cols.push(C('tot', 'الإجمالي', mk.t));
      if (pcs.length > 1 && !pcsIn) cols.push(C('chg', 'تغيّر آخر فترة', 'pct'));
      var total = null;
      if (res.some(function (r) { return r.total && typeof r.total[mk.k] === 'number'; })) {
        total = { name: 'الإجمالي' };
        pcs.forEach(function (c, j) { var t = res[j].total; total['p' + j] = t && typeof t[mk.k] === 'number' ? t[mk.k] : null; });
        if (sumOk) total.tot = pcs.reduce(function (sm, c, j) { return sm + (total['p' + j] || 0); }, 0);
        var n2 = pcs.length; if (n2 > 1 && total['p' + (n2 - 2)]) total.chg = (total['p' + (n2 - 1)] - total['p' + (n2 - 2)]) / Math.abs(total['p' + (n2 - 2)]) * 100;
      }
      var chartRows = pcs.map(function (c, j) { return { name: c.l, v: total ? total['p' + j] || 0 : rows.reduce(function (sm, o) { return sm + (o._b ? 0 : o['p' + j] || 0); }, 0) }; });
      return { cols: cols, rows: rows, total: total, cmp: { cols: nums.map(function (c) { return [c.k, c.l]; }), mk: mk.k },
        chart: { type: 'bar', x: 'name', y: ['v'], yl: [mk.l], rowsOverride: chartRows }, note: (pcsIn ? 'مقارنة الفروع حسب: ' : 'المقارنة حسب: ') + mk.l + (base.note ? ' · ' + plain(base.note) : '') };
    }

    /* ---------- التصفية (عملاء، أصناف، مخازن…) ---------- */
    // البُعد ← مفتاح التصفية، والعنوان، ونص زر الإضافة
    var DIM = { cust: ['cust', 'العملاء', 'عميل', 'عملاء محددون بالاسم'], supp: ['cust', 'الموردون', 'مورد', 'موردون محددون بالاسم'], item: ['item', 'الأصناف', 'صنف', 'أصناف محددة'], st: ['st', 'المخازن', 'مخزن', 'مخزن أو سيارة'], ag: ['ag', 'المناديب', 'مندوب', 'مناديب محددون'],
      cacc: ['cacc', 'حسابات العملاء', 'حساب عملاء', 'كل العملاء تحت حساب رئيسي أو فرعي من الدليل'], cgrp: ['cgrp', 'مجموعات العملاء', 'مجموعة عملاء', 'المجموعات المعرّفة في الإعدادات'],
      cat: ['cat', 'فئات المناديب', 'فئة مندوب', 'جملة، تجزئة، أسواق…'], u: ['u', 'المستخدمون', 'مستخدم', 'من أدخل الفاتورة'],
      xcust: ['xcust', 'استثناء العملاء', 'استثناء عميل', 'إخفاء عملاء محددين'], xcacc: ['xcacc', 'استثناء حسابات العملاء', 'استثناء حساب عملاء', 'إخفاء كل العملاء تحت حساب'], xcgrp: ['xcgrp', 'استثناء مجموعات العملاء', 'استثناء مجموعة', 'إخفاء مجموعة عملاء'],
      xcat: ['xcat', 'استثناء فئات المناديب', 'استثناء فئة', 'إخفاء فئة مناديب'], xitem: ['xitem', 'استثناء الأصناف', 'استثناء صنف', 'إخفاء أصناف محددة'] };
    var FDIMS = {}; Object.keys(DIM).forEach(function (k) { FDIMS[k] = DIM[k][1]; });
    function fdimsFor(def) { return normDims(def.fdims || (def.cat === 'stock' ? ['item', 'st', 'xitem'] : def.cat === 'purch' ? ['supp', 'item', 'st', 'u'] : ['cust', 'item', 'st', 'ag', 'cat', 'u', 'xcust', 'xitem'])); }
    // كل تقرير فيه تصفية العميل يأخذ معها حسابات العملاء ومجموعاتهم، وكل تقرير فيه المندوب يأخذ فئات المناديب
    function normDims(d) {
      var o = d.slice(), add = function (after, k) { if (o.indexOf(k) >= 0) return; var i = o.indexOf(after); o.splice(i < 0 ? o.length : i + 1, 0, k); };
      if (o.indexOf('cust') >= 0) { add('cust', 'cacc'); add('cacc', 'cgrp'); }
      if (o.indexOf('xcust') >= 0) { add('xcust', 'xcacc'); add('xcacc', 'xcgrp'); }
      if (o.indexOf('ag') >= 0) { add('ag', 'cat'); if (o.indexOf('xcust') >= 0 || o.indexOf('xitem') >= 0) add(o.indexOf('xitem') >= 0 ? 'xitem' : 'xcgrp', 'xcat'); }
      return o;
    }
    function fltOptions(dim) {
      var Tt = T(), out = [], seen = {};
      var addAcc = function (id, name) { if (seen[id] || !id) return; seen[id] = 1; var a = acc(id); out.push({ id: '@' + id, name: name || (a ? a.name : id), sub: a ? a.code : '' }); };
      if (dim === 'cust' || dim === 'xcust') { F.D.invs.forEach(function (v) { if (v.c === SALE || v.c === SRET) addAcc(v.ck, v.name); }); recvIds().forEach(function (id) { addAcc(id); }); }
      else if (dim === 'supp') { F.D.invs.forEach(function (v) { if (v.c === PUR || v.c === PRET) addAcc(v.ck, v.name); }); payIds().forEach(function (id) { addAcc(id); }); }
      else if (dim === 'item' || dim === 'xitem') {
        var used = {}; Tt.invl.forEach(function (l) { used[l.item] = 1; });
        Object.keys(Tt.item).forEach(function (id) { if (used[id]) out.push({ id: '@' + id, name: itemName(id), sub: String(Tt.item[id].code || '') }); });
      } else if (dim === 'st') Object.keys(Tt.st).forEach(function (id) { out.push({ id: '@' + id, name: storeName(id) }); });
      else if (dim === 'ag') Object.keys(Tt.ag).forEach(function (id) { out.push({ id: '@' + id, name: repName(id) }); });
      else if (dim === 'cat' || dim === 'xcat') repCats().forEach(function (c) { out.push({ id: '@' + c, name: c }); });
      else if (dim === 'cgrp' || dim === 'xcgrp') { cgList().forEach(function (g, i) { out.push({ id: '@' + g.id, name: g.name, sub: (g.codes || []).join('، '), ord: i }); }); out.push({ id: '@' + CG_NONE, name: 'بدون مجموعة', ord: 999 }); return out; }
      else if (dim === 'cacc' || dim === 'xcacc') { var tr = custTreeAccs(), base = tr.length ? Math.min.apply(null, tr.map(function (a) { return a.lvl; })) : 1; return tr.map(function (a) { return { id: '@' + a.id, name: a.name, sub: a.code + ' · ' + a.kids.length + ' فرع', lvl: a.lvl - base }; }); }
      else if (dim === 'u') Object.keys(Tt.us).forEach(function (id) { out.push({ id: '@' + id, name: userName(id) }); });
      return out.sort(function (a, b) { return String(a.name).localeCompare(String(b.name), 'ar'); });
    }
    function fObj(f) { return f && typeof f === 'object' ? f : (parseFilter(f) || {}); }
    function fCount(f) { f = fObj(f); return Object.keys(f).reduce(function (n, k) { return n + ((f[k] && f[k].length) || 0); }, 0); }
    // شريط التصفية: كل تصفية مطبّقة مجموعة بعنوانها وقيمها (كل قيمة تُحذف وحدها)، وزر «إضافة تصفية» يفتح قائمة مرتبة: عرض فقط / استثناء
    function fltPanelHTML(dims, f, key) {
      f = fObj(f);
      var applied = dims.filter(function (d) { var v = f[DIM[d][0]]; return v && v.length; });
      applied = applied.filter(function (d, i) { return applied.map(function (x) { return DIM[x][0]; }).indexOf(DIM[d][0]) === i; });
      var inc = dims.filter(function (d) { return !/^x/.test(d); }), exc = dims.filter(function (d) { return /^x/.test(d); });
      var tile = function (d) { var n = (f[DIM[d][0]] || []).length; return '<button class="fx-tile' + (/^x/.test(d) ? ' x' : '') + (n ? ' on' : '') + '" data-fadd="' + key + '|' + d + '"><b>' + esc(DIM[d][1]) + (n ? ' <span class="fx-n">' + n + '</span>' : '') + '</b><span>' + esc(DIM[d][3] || '') + '</span></button>'; };
      var open = F.fpOpen && F.fpOpen[key];
      return '<div class="fx' + (applied.length ? ' has' : '') + '"><div class="fx-bar"><span class="fx-t">' + ICON_FILTER + ' التصفية' + (applied.length ? ' <span class="fp-cnt">' + fCount(f) + '</span>' : '') + '</span>' +
        (applied.length ? '<div class="fp-applied fx-list">' + applied.map(function (d) {
          var k = DIM[d][0], v = f[k];
          return '<div class="fx-grp' + (/^x/.test(k) ? ' x' : '') + '"><button class="fx-k" data-fedit="' + key + '|' + d + '" title="تعديل">' + esc(DIM[d][1]) + ' ▾</button>' + v.map(function (x, i) {
            return '<span class="fp-tag' + (/^x/.test(k) ? ' x' : '') + '">' + esc(fltName(k, x)) + '<button aria-label="إزالة" data-frm="' + key + '|' + k + '|' + i + '">×</button></span>';
          }).join('') + '</div>';
        }).join('') + '</div>' : '<span class="fx-none small muted">بدون تصفية: يُعرض الكل</span>') +
        '<details class="fp fx-menu" data-fp="' + key + '"' + (open ? ' open' : '') + '><summary class="fx-add">+ إضافة تصفية</summary><div class="fx-pop">' +
        '<div class="fx-sec">عرض فقط</div><div class="fx-tiles">' + inc.map(tile).join('') + '</div>' +
        (exc.length ? '<div class="fx-sec x">استثناء (إخفاء)</div><div class="fx-tiles">' + exc.map(tile).join('') + '</div>' : '') + '</div></details>' +
        (savedFilters().length ? '<button class="fx-saved" data-fload="' + key + '">الفلاتر الجاهزة <span class="fx-n">' + savedFilters().length + '</span></button>' : '') +
        (applied.length ? '<button class="fx-save" data-fsave="' + key + '">☆ حفظ كفلتر جاهز</button><button class="fx-clear" data-fclr="' + key + '">مسح الكل</button>' : '') + '</div></div>';
    }
    function bindFltPanel(m, key, dims, getF, setF) {
      var dt = q('[data-fp="' + key + '"]', m); if (dt) dt.addEventListener('toggle', function () { F.fpOpen = F.fpOpen || {}; F.fpOpen[key] = dt.open; });
      var pick = function (d) {
        var k = DIM[d][0], f = Object.assign({}, fObj(getF()));
        F.fpOpen = F.fpOpen || {}; F.fpOpen[key] = false;
        pickMulti({ title: (/^x/.test(d) ? '' : 'عرض فقط: ') + DIM[d][1], hint: DIM[d][3], options: fltOptions(d), value: f[k] || [] }).then(function (v) { if (!v) { A.render(); return; } f[k] = v; if (!v.length) delete f[k]; setF(fCount(f) ? f : null); });
      };
      qa('[data-fadd^="' + key + '|"], [data-fedit^="' + key + '|"]', m).forEach(function (b) { b.onclick = function (e) { e.preventDefault(); pick((b.dataset.fadd || b.dataset.fedit).split('|')[1]); }; });
      qa('[data-frm^="' + key + '|"]', m).forEach(function (b) {
        b.onclick = function () { var p2 = b.dataset.frm.split('|'), f = Object.assign({}, fObj(getF())); f[p2[1]] = (f[p2[1]] || []).filter(function (x, i) { return i !== Number(p2[2]); }); if (!f[p2[1]].length) delete f[p2[1]]; setF(fCount(f) ? f : null); };
      });
      var c = q('[data-fclr="' + key + '"]', m);
      if (c) c.onclick = function () { setF(null); };
      var sv = q('[data-fsave="' + key + '"]', m); if (sv) sv.onclick = function () { saveCurrentFilter(getF()); };
      var ld = q('[data-fload="' + key + '"]', m); if (ld) ld.onclick = function () { pickSaved(dims).then(function (x) { if (!x) return; var f = fltFor(x.flt, dims); if (f) { setF(f); toast('طُبّق «' + x.name + '»'); } }); };
      // إغلاق القائمة عند الضغط خارجها
      if (dt && dt.open) setTimeout(function () { var h = function (e) { if (!dt.contains(e.target)) { dt.open = false; document.removeEventListener('click', h, true); } }; document.addEventListener('click', h, true); }, 0);
    }
    var ICON_FILTER = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" style="vertical-align:-3px"><path fill="currentColor" d="M3 5h18l-7 8v6l-4 2v-8z"/></svg>';

    function paramsHTML(def, p) {
      var h = '';
      var has = function (k) { return def.params.indexOf(k) >= 0; };
      if (has('period')) h += periodHTML(p, 'rep');
      var sel = function (k, label, opts) { return '<label class="field fin-param"><span class="lbl">' + label + '</span><select class="input" data-pk="' + k + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(p[k]) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>'; };
      var row = '';
      if (isCmp(p.preset) && F.cur && F.cur.res && F.cur.res.cmp) { if (!p.cmpcol || !F.cur.res.cmp.cols.some(function (c) { return c[0] === p.cmpcol; })) p.cmpcol = F.cur.res.cmp.mk; row += sel('cmpcol', 'الرقم المقارن', F.cur.res.cmp.cols); }
      if (has('asof')) row += '<label class="field fin-param"><span class="lbl">في تاريخ</span><input type="date" class="input num" data-pk="asof" value="' + p.asof + '"></label>';
      if (has('asof2')) row += '<label class="field fin-param"><span class="lbl">مقارنة بتاريخ</span><input type="date" class="input num" data-pk="asof2" value="' + esc(p.asof2 || addD(p.asof.slice(0, 4) + '-01-01', -1)) + '"></label>';
      if (has('gran')) row += sel('gran', 'التجميع', GRAN);
      if (has('level')) row += sel('level', 'المستوى', [[1, 'المستوى 1'], [2, 'المستوى 2'], [3, 'المستوى 3'], [4, 'المستوى 4'], [5, 'المستوى 5'], [6, 'كل المستويات']]);
      if (has('top')) row += sel('top', 'العرض', [[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50'], [100, 'أعلى 100']]);
      if (has('measure')) row += sel('measure', 'القيمة', [['value', 'صافي المبيعات (د.ل)'], ['qty', 'الكمية']]);
      if (has('rmeas')) row += sel('rmeas', 'القيمة', [['net', 'صافي المبيعات (د.ل)'], ['profit', 'مجمل الربح'], ['qty', 'الكمية'], ['n', 'عدد الفواتير']]);
      if (has('rep')) { var rl = Object.keys(T().ag).map(function (k) { return [k, repName(k) + ' · ' + repCat(k)]; }).sort(function (a, b) { return a[1].localeCompare(b[1], 'ar'); }); if (!p.rep && rl.length) p.rep = rl[0][0]; row += sel('rep', 'المندوب', rl); }
      if (has('rby')) row += sel('rby', 'حسب', [['cust', 'العميل'], ['item', 'الصنف']]);
      if (has('vby')) row += sel('vby', 'العرض', [['none', 'كل سند (تفصيلي)'], ['box', 'مجمّع حسب الصندوق/البنك'], ['party', 'مجمّع حسب الطرف'], ['day', 'مجمّع حسب اليوم']]);
      if (has('nonzero')) row += sel('nonzero', 'الأرصدة', [['nz', 'غير الصفرية فقط'], ['all', 'الكل']]);
      if (has('idle')) row += sel('idle', 'بلا شراء منذ', [[15, '15 يوماً'], [30, '30 يوماً'], [60, '60 يوماً'], [90, '90 يوماً'], [180, '180 يوماً']]);
      if (has('etype')) row += sel('etype', 'نوع القيد', [['all', 'الكل'], ['r', 'سندات القبض'], ['p', 'سندات الدفع'], ['j', 'قيود يومية'], ['i', 'قيود الفواتير'], ['o', 'افتتاحي']]);
      if (has('boxkind')) row += sel('boxkind', 'النوع', [['all', 'الصناديق والبنوك'], ['صندوق', 'الصناديق فقط'], ['بنك', 'البنوك فقط']]);
      if (has('box')) row += sel('box', 'الصندوق/البنك', [['all', 'كل الصناديق والبنوك (ملخص)']].concat(activeBoxes().map(function (b) { return [b.acc, b.name]; })));
      (def.sel || []).forEach(function (x) { row += sel(x[0], x[1], x[2]); });
      if (has('search')) row += '<label class="field fin-param"><span class="lbl">بحث</span><input class="input" data-pk="search" value="' + esc(p.search || '') + '" placeholder="رقم أو اسم"></label>';
      if (has('cust1')) { var ck1 = c1Default(p); if (ck1) p.cust1 = ck1; row += '<div class="field fin-param" style="flex:1 1 100%;max-width:520px"><span class="lbl">العميل</span><button class="input" data-custpick style="text-align:start;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (ck1 ? esc(c1Sub(ck1)) : 'اختر العميل…') + '</button></div>'; }
      if (has('account')) row += '<div class="field fin-param" style="flex:2"><span class="lbl">الحساب</span><button class="input" data-accpick style="text-align:start">' + (p.account ? esc(acc(p.account) ? acc(p.account).code + ' · ' + acc(p.account).name : '—') : 'اختر الحساب…') + '</button></div>';
      if (row) h += '<div class="fin-params">' + row + '</div>';
      if (has('flt')) h += fltPanelHTML(fdimsFor(def), p.flt, 'rep');
      return h;
    }

    function reportHTML() {
      var c = F.cur, def = curDef();
      if (!def) { F.cur = null; return catalogHTML(); }
      var res;
      try { res = runCur(); } catch (e) { res = { cols: [], rows: [], empty: 'تعذّر إعداد التقرير: ' + e.message }; if (window.console) console.error(e); }
      c.res = res;
      var p = c.p;
      var h = '<div class="card head-card"><div class="hc-top"><button class="iconbtn hc-back" data-back aria-label="رجوع إلى التقارير">→</button><div class="grow"><h2>' + esc(res.title || def.name) + '</h2><div class="small muted hc-desc">' + esc(res.subtitle || def.desc || '') + '</div></div>' +
        '<div class="rh-act"><button class="btn sm" data-xls aria-label="Excel">' + ICON_XLS + '<span class="bt-txt">Excel</span></button><button class="btn sm" data-prt aria-label="طباعة">' + ICON.print + '<span class="bt-txt">طباعة</span></button>' + (c.custom && canEdit() ? '<button class="btn sm ' + (c.custom.tmp ? 'accent' : 'ghost') + '" data-edit aria-label="تعديل">' + ICON_EDIT + '<span class="bt-txt">' + (c.custom.tmp ? 'رجوع للتعديل والحفظ' : 'تعديل') + '</span></button>' : '') + '</div></div>' +
        (p._pin && p.flt ? '<div class="pin-note">📌 مُطبَّق الفلتر المثبّت «' + esc(p._pin) + '» · يُلغى من صفحة التقارير ← الفلاتر الجاهزة</div>' : '') + paramsHTML(def, p) + (res.empty && !hasView(p.view) ? '' : viewPanelHTML(res, p)) +
        (res.note ? '<div class="small muted rep-note">' + esc(plain(res.note)) + '</div>' : '') + '</div>';
      if (res.empty) return h + '<div class="card empty">' + esc(res.empty) + '</div>';
      if (res.chart && (res.chart.rowsOverride || res.rows.length > 1)) h += '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>';
      if (!res.rows.length && hasView(p.view)) return h + '<div class="card empty">لا توجد أسطر تطابق شروط التخصيص. عدّل الشروط أو اضغط «إلغاء كل التعديلات».</div>';
      h += '<div class="card scroll-x fin-table">' + (res._custRows ? grpBarHTML(res, p) : '') + tableHTML(res) + '</div>';
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
    function lvlCol(res) { return res._lvlc !== undefined ? res._lvlc : res.cols[0] && res.cols[0].k === 'code' ? 1 : 0; }
    function isNum(c) { return ['money', 'money0', 'int', 'qty', 'pct'].indexOf(c.t) >= 0; }
    function tableHTML(res) {
      var sk = F.cur && F.cur.sort;
      var rows = res.rows.slice();
      if (sk) { var col = res.cols.filter(function (c) { return c.k === sk.k; })[0]; if (col) rows.sort(function (a, b) { if (res._grouped && a._g !== b._g) return a._g - b._g; if (res._grouped && (a._gh || b._gh)) return (b._gh || 0) - (a._gh || 0); var x = a[sk.k], y = b[sk.k]; if (isNum(col)) { x = Number(x) || 0; y = Number(y) || 0; } return (x < y ? -1 : x > y ? 1 : 0) * sk.dir; }); }
      if (!rows.length) return '<p class="muted" style="margin:0">لا توجد حركة في هذه الفترة</p>';
      var clickable = rows.some(function (r) { return r._acc || r._box || r._c1; }), hasC1 = rows.some(function (r) { return r._c1; });
      var shown = rows.length > 3000 ? rows.slice(0, 3000) : rows;
      return '<table class="tbl fin"><thead><tr>' + res.cols.map(function (c) { return '<th class="' + (isNum(c) ? 'n' : '') + '" data-sort="' + c.k + '">' + esc(c.l) + (sk && sk.k === c.k ? (sk.dir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
        shown.map(function (r) {
          return '<tr class="' + (r._b ? 'b ' : '') + (r._hl ? 'hl ' : '') + ((r._acc || r._box || r._c1) && clickable ? 'tap' : '') + '"' + (r._c1 ? ' data-c1="' + esc(r._c1) + '"' : r._acc ? ' data-acc="' + esc(r._acc) + '"' : r._box ? ' data-box="' + esc(r._box) + '"' : '') + '>' +
            res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '"' + (r._lvl && i === lvlCol(res) ? ' style="padding-inline-start:' + (6 + r._lvl * 18) + 'px"' : '') + '>' + cell(c, r[c.k], r) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody>' + (res.total ? '<tfoot><tr>' + res.cols.map(function (c, i) { return '<td class="' + (isNum(c) ? 'n' : '') + '">' + (i === 0 ? esc(res.total[c.k] && !isNum(c) ? res.total[c.k] : res.total.name || res.total.desc || 'الإجمالي') : cell(c, res.total[c.k], res.total)) + '</td>'; }).join('') + '</tr></tfoot>' : '') + '</table>' +
        '<p class="small muted" style="margin:8px 0 0">' + fk(rows.length) + ' سطر' + (shown.length < rows.length ? ' (يظهر أول ' + fk(shown.length) + '، وملف Excel فيه الكل)' : '') + (clickable ? (hasC1 ? ' · اضغط على أي عميل لفتح ملفه الكامل' : ' · اضغط على أي حساب لفتح كشف حسابه') : '') + ' · اضغط على عنوان أي عمود للترتيب</p>';
    }

    function bindReport(m) {
      var c = F.cur, p = c.p, def = curDef();
      var save = function () { st.finParams = st.finParams || {}; st.finParams[c.id] = Object.assign({}, p); try { localStorage.setItem('rk.finParams', JSON.stringify(st.finParams)); } catch (e) {} };
      q('[data-back]', m).onclick = function () { var y = F.catY || 0; F.cur = null; A.render(); var go2 = function (n) { window.scrollTo(0, y); if (n && Math.abs(window.scrollY - y) > 2) requestAnimationFrame(function () { go2(n - 1); }); }; requestAnimationFrame(function () { go2(5); }); };
      bindPeriod(m, 'rep', function () { return p; }, function (ps) { Object.assign(p, ps); save(); A.render(); }, def.params.indexOf('period') >= 0);
      qa('[data-pk]', m).forEach(function (el) {
        el.addEventListener('change', function () { p[el.dataset.pk] = el.value; if (el.dataset.pk === 'from' || el.dataset.pk === 'to') p.preset = 'custom'; save(); A.render(); });
      });
      var cp = q('[data-custpick]', m);
      if (cp) cp.onclick = function () { pickCustomer(p.cust1).then(function (k) { if (k) { p.cust1 = k; c1Last(k); save(); A.render(); } }); };
      var ap = q('[data-accpick]', m);
      if (ap) ap.onclick = function () { pickAccount({ title: 'اختر الحساب', any: true }).then(function (id) { if (id) { p.account = id; save(); A.render(); } }); };
      bindFltPanel(m, 'rep', fdimsFor(def), function () { return p.flt; }, function (f) { p.flt = f; delete p._pin; save(); A.render(); });
      bindGrpBar(m, p, save);
      qa('th[data-sort]', m).forEach(function (th) { th.onclick = function () { var k = th.dataset.sort; c.sort = c.sort && c.sort.k === k ? { k: k, dir: -c.sort.dir } : { k: k, dir: -1 }; A.render(); }; });
      qa('tr[data-acc]', m).forEach(function (tr) { tr.onclick = function () { var asof = def.params.indexOf('asof') >= 0; openReport('statement', { account: tr.dataset.acc, preset: asof ? 'custom' : p.preset, from: asof ? p.asof.slice(0, 4) + '-01-01' : p.from, to: asof ? p.asof : p.to }); }; });
      qa('tr[data-c1]', m).forEach(function (tr) { tr.onclick = function () { var asof = def.params.indexOf('asof') >= 0; c1Last(tr.dataset.c1); openReport('c1_card', { cust1: tr.dataset.c1, preset: asof ? 'custom' : p.preset, from: asof ? p.asof.slice(0, 4) + '-01-01' : p.from, to: asof ? p.asof : p.to }); }; });
      qa('tr[data-box]', m).forEach(function (tr) { tr.onclick = function () { p.box = tr.dataset.box; save(); A.render(); }; });
      q('[data-xls]', m).onclick = function () { exportXLSX(c.res, def.name, p); };
      q('[data-prt]', m).onclick = function () { printReport(c.res, def.name, p); };
      bindViewPanel(m, save);
      var ed = q('[data-edit]', m);
      if (ed) ed.onclick = function () { F.custom = JSON.parse(JSON.stringify(c.custom)); F.preview = true; go('builder'); };
    }

    /* ---------- التصدير والطباعة ---------- */
    function periodText(p, def) { return def.params.indexOf('asof') >= 0 ? 'في ' + p.asof : def.params.indexOf('period') >= 0 ? (isCmp(p.preset) ? presetName(p.preset, p.year) + ' · ' : '') + (p.from === p.to ? p.from : 'من ' + p.from + ' إلى ' + p.to) : ''; }
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
    // اختيار عميل واحد: بحث بالاسم أو الرمز، مرتب بمبيعات آخر سنة
    function pickCustomer(cur) {
      return new Promise(function (res) {
        sheet('اختر العميل', '<input class="input" id="cq" placeholder="ابحث باسم العميل أو رمز حسابه"><div class="list acc-list" id="cl"></div>', function (s) {
          var inp = q('#cq', s.el), cl = q('#cl', s.el), all = custChoices();
          function draw() {
            var t = normAr(inp.value.trim());
            var list = all.filter(function (r) { return !t || normAr(r.name + ' ' + r.code).indexOf(t) >= 0; }).slice(0, 200);
            cl.innerHTML = list.map(function (r) { return '<button class="item tap acc-it' + (r.k === cur ? ' sel' : '') + '" data-k="' + esc(r.k) + '"><div class="main"><b>' + esc(r.name) + '</b><div class="meta">' + (r.code ? '<span class="num">' + esc(r.code) + '</span>' : '') + '<span>مبيعات سنة: ' + fk(r.net) + '</span>' + (r.last ? '<span>آخر شراء ' + esc(r.last) + '</span>' : '') + '</div></div>' + (r.k === cur ? '✓' : '') + '</button>'; }).join('') || '<p class="muted">لا نتائج</p>';
            qa('[data-k]', cl).forEach(function (b) { b.onclick = function () { s.done = true; s.close(); res(b.dataset.k); }; });
          }
          inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function pickAccount(opts) {
      opts = opts || {};
      return new Promise(function (res) {
        var sel = opts.multi ? (opts.value || []).slice() : null;
        sheet(opts.title || 'اختر الحساب', '<input class="input" id="aq" placeholder="ابحث بالرمز أو الاسم">' + (opts.hint ? '<div class="msg info">' + esc(opts.hint) + '</div>' : '') +
          '<div class="list acc-list" id="al"></div>' + (opts.multi ? '<button class="btn primary big" data-ok>حفظ الاختيار</button>' : ''), function (s) {
          var inp = q('#aq', s.el), al = q('#al', s.el);
          function draw() {
            var t = inp.value.trim();
            var list = (opts.list || F.D.accList).filter(function (a) { return (!opts.filter || opts.filter(a)) && (!t || (a.code + ' ' + a.name).indexOf(t) >= 0); }).slice(0, 300);
            al.innerHTML = list.map(function (a) {
              var on = sel && sel.indexOf(String(a.code)) >= 0;
              return '<button class="item tap acc-it' + (on ? ' sel' : '') + '" data-a="' + esc(a.id) + '" style="padding-inline-start:' + (8 + (t ? 0 : (a.lvl - 1) * 14)) + 'px"><div class="main"><b>' + esc(a.name) + '</b><div class="meta"><span class="num">' + esc(a.code) + '</span><span>مستوى ' + a.lvl + '</span>' + (a.leaf ? '' : '<span>رئيسي · ' + a.kids.length + ' فرع</span>') + '</div></div>' + (on ? '✓' : '') + '</button>';
            }).join('') || '<p class="muted">لا نتائج</p>';
            qa('[data-a]', al).forEach(function (b) {
              b.onclick = function () {
                var a = opts.list ? opts.list.filter(function (x) { return x.id === b.dataset.a; })[0] : acc(b.dataset.a);
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
    // اختيار متعدد من قائمة (عملاء، أصناف، مخازن…): المحدد يظهر بالاسم في الأعلى، وكل سطر بمربع اختيار واضح
    function pickMulti(opts) {
      return new Promise(function (res) {
        var sel = (opts.value || []).map(String), byId = {}, onlySel = false;
        opts.options.forEach(function (o) { byId[String(o.id)] = o; });
        var nameOf = function (id) { var o = byId[id] || byId['@' + id] || byId[String(id).replace(/^@/, '')]; return o ? o.name : String(id).replace(/^@/, ''); };
        sheet(opts.title || 'اختر', (opts.hint ? '<p class="small muted" style="margin:0 0 6px">' + esc(opts.hint) + '</p>' : '') + '<div class="pm-sel" id="pms"></div><input class="input" id="mq" placeholder="اكتب للبحث بالاسم أو الرمز…">' +
          '<div class="row small pm-tools"><label class="chk"><input type="checkbox" id="mso"> المحدد فقط</label><span class="grow"></span><button class="btn sm ghost" data-all>تحديد كل الظاهر</button><button class="btn sm ghost" data-none>إلغاء التحديد</button></div>' +
          '<div class="list acc-list pm-list" id="ml"></div><button class="btn primary big" data-ok></button>', function (s) {
          var inp = q('#mq', s.el), ml = q('#ml', s.el), shown = [];
          function drawSel() {
            q('#pms', s.el).innerHTML = sel.length ? '<div class="small"><b>المحدد (' + sel.length + '):</b></div><div class="pm-tags">' + sel.map(function (id, i) { return '<span class="fp-tag">' + esc(nameOf(id)) + '<button data-un="' + i + '" aria-label="إزالة">×</button></span>'; }).join('') + '</div>'
              : '<div class="small muted">لم تحدد شيئاً بعد. بدون تحديد يُعرض الكل.</div>';
            qa('[data-un]', s.el).forEach(function (b) { b.onclick = function () { sel.splice(Number(b.dataset.un), 1); draw(); }; });
            q('[data-ok]', s.el).textContent = sel.length ? 'تطبيق (' + sel.length + ' محدد)' : 'تطبيق (الكل)';
          }
          function draw() {
            var t = inp.value.trim();
            var list = opts.options.filter(function (o) { return (!onlySel || sel.indexOf(String(o.id)) >= 0) && (!t || (o.name + ' ' + (o.sub || '')).indexOf(t) >= 0); });
            shown = list.slice(0, 400);
            ml.innerHTML = shown.map(function (o) { var on = sel.indexOf(String(o.id)) >= 0; return '<button class="item tap pm-it' + (on ? ' sel' : '') + '" data-o="' + esc(o.id) + '"' + (o.lvl && !t ? ' style="padding-inline-start:' + (10 + o.lvl * 16) + 'px"' : '') + '><span class="pm-box">' + (on ? '✓' : '') + '</span><div class="main"><b>' + esc(o.name) + '</b>' + (o.sub ? '<div class="meta"><span class="num">' + esc(o.sub) + '</span></div>' : '') + '</div></button>'; }).join('') +
              (list.length > shown.length ? '<p class="small muted">يظهر ' + shown.length + ' من ' + list.length + '، اكتب في البحث لتضييق القائمة</p>' : '') || '<p class="muted">لا نتائج</p>';
            qa('[data-o]', ml).forEach(function (b) { b.onclick = function () { var id = b.dataset.o, i = sel.indexOf(id); if (i >= 0) sel.splice(i, 1); else sel.push(id); draw(); }; });
            drawSel();
          }
          inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
          q('#mso', s.el).onchange = function () { onlySel = this.checked; draw(); };
          q('[data-all]', s.el).onclick = function () { shown.forEach(function (o) { if (sel.indexOf(String(o.id)) < 0) sel.push(String(o.id)); }); draw(); };
          q('[data-none]', s.el).onclick = function () { sel = []; draw(); };
          q('[data-ok]', s.el).onclick = function () { s.done = true; s.close(); res(sel); };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }

    /* ---------- الحساب المبسّط: اختر ما تريد من قائمة، واربط العناصر بـ + − × ÷ ---------- */
    var FMT_SIMPLE = [['money0', 'مبلغ بدون كسور'], ['money', 'مبلغ بثلاث خانات'], ['dec2', 'رقم بخانتين'], ['qty', 'كمية'], ['int', 'عدد'], ['pct', 'نسبة مئوية %']];
    function namesOf(k, list) { return (list || []).map(function (x) { return fltName(k, x); }); }
    function termOpts(t) {   // وصف خيارات العنصر بالكلمات
      var parts = [], f = t.flt || {};
      if (t.acc && t.acc.length) parts.push(t.acc.map(function (c) { var a = F.D.byCode[c]; return c + (a ? ' ' + a.name : ''); }).join('، '));
      if (t.st && t.st.length) parts.push('المخزن: ' + namesOf('st', t.st).join('، '));
      if (t.box) parts.push(t.box === 'صندوق' ? 'نقداً (الصناديق)' : t.box === 'بنك' ? 'تحويل (البنوك)' : t.box);
      ['cust', 'item', 'st', 'ag', 'xcust', 'xitem'].forEach(function (k) { if (f[k] && f[k].length) parts.push(DIM[k][1] + ': ' + namesOf(k, f[k]).join('، ')); });
      return parts.join(' · ');
    }
    function termLabel(t) {
      var d = TKMAP[t.k]; if (!d) return '؟';
      if (d.type === 'num') return String(Number(t.n) || 0);
      if (d.type === 'var') return '«' + (t.v || '…') + '»';
      var o = termOpts(t);
      return d.label + (o ? ' (' + o + ')' : '');
    }
    function termsText(terms) { return (terms || []).map(function (t, i) { return (i ? OPS[t.op || '+'] + ' ' : '') + termLabel(t); }).join(' '); }
    function itemText(it) { if (it.terms && it.terms.length) return termsText(it.terms); var tt = it.f ? fToTerms(it.f) : null; return tt ? termsText(tt) : (it.f || ''); }
    function pickTermKind() {
      return new Promise(function (res) {
        sheet('ماذا تريد أن تحسب؟', TK.map(function (g) {
          return '<div class="tk-g"><div class="tk-gt">' + esc(g[0]) + '</div><div class="tk-list">' + g[1].map(function (t) { return '<button class="tk-it" data-k="' + esc(t[0]) + '">' + esc(t[1]) + '</button>'; }).join('') + '</div></div>';
        }).join(''), function (s) {
          qa('[data-k]', s.el).forEach(function (b) { b.onclick = function () { s.done = true; s.close(); res(b.dataset.k); }; });
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function tbHTML(id, terms, names) {
      return '<div class="tb" id="' + id + '">' + terms.map(function (t, i) {
        var d = TKMAP[t.k] || {}, f = t.flt || {};
        var btn = function (attr, label, val) { return '<button type="button" class="chip tb-o' + (val ? ' on' : '') + '" ' + attr + '>' + esc(label) + ' ▾</button>'; };
        var o = '';
        if (d.type === 'flt') o = btn('data-tf="cust"', (f.cust || []).length ? 'العملاء: ' + f.cust.length : 'كل العملاء', (f.cust || []).length) + btn('data-tf="item"', (f.item || []).length ? 'الأصناف: ' + f.item.length : 'كل الأصناف', (f.item || []).length) + btn('data-tf="st"', (f.st || []).length ? 'المخازن: ' + f.st.length : 'كل المخازن', (f.st || []).length);
        else if (d.type === 'cust') o = btn('data-tf="cust"', (f.cust || []).length ? 'العملاء: ' + f.cust.length : 'كل العملاء', (f.cust || []).length);
        else if (d.type === 'coll') o = '<select class="input tb-sel" data-tbox><option value="">كل التحصيل</option><option value="صندوق"' + (t.box === 'صندوق' ? ' selected' : '') + '>نقداً (الصناديق)</option><option value="بنك"' + (t.box === 'بنك' ? ' selected' : '') + '>تحويل (البنوك)</option></select>' + btn('data-tf="cust"', (f.cust || []).length ? 'العملاء: ' + f.cust.length : 'كل العملاء', (f.cust || []).length);
        else if (d.type === 'box') o = '<select class="input tb-sel" data-tbox><option value="">الصناديق والبنوك</option><option value="صندوق"' + (t.box === 'صندوق' ? ' selected' : '') + '>الصناديق فقط</option><option value="بنك"' + (t.box === 'بنك' ? ' selected' : '') + '>البنوك فقط</option></select>';
        else if (d.type === 'acc') o = btn('data-tacc', (t.acc || []).length ? 'الحساب: ' + t.acc.map(function (c) { var a = F.D.byCode[c]; return a ? a.name : c; }).join('، ') : 'اختر الحساب', (t.acc || []).length);
        else if (d.type === 'stock') o = btn('data-tst', (t.st || []).length ? 'المخازن: ' + namesOf('st', t.st).join('، ') : 'كل المخازن', (t.st || []).length) + btn('data-tf="item"', (f.item || []).length ? 'الأصناف: ' + f.item.length : 'كل الأصناف', (f.item || []).length);
        else if (d.type === 'num') o = '<input class="input tb-num num" type="number" step="any" data-tnum value="' + esc(t.n === undefined ? '' : t.n) + '" placeholder="مثل 100">';
        else if (d.type === 'var') o = '<select class="input tb-sel" data-tvar><option value="">اختر…</option>' + (names || []).map(function (n) { return '<option' + (t.v === n ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select>';
        var det = termOpts(t);
        return '<div class="tb-row" data-i="' + i + '">' +
          (i ? '<select class="input tb-op" data-top aria-label="العملية">' + Object.keys(OPS).map(function (k) { return '<option value="' + k + '"' + ((t.op || '+') === k ? ' selected' : '') + '>' + OPS[k] + '</option>'; }).join('') + '</select>' : '<span class="tb-op0">=</span>') +
          '<div class="tb-main"><button type="button" class="tb-what" data-tw>' + esc(d.label || 'اختر…') + ' ▾</button><div class="tb-opts">' + o + '</div>' + (det && d.type !== 'acc' ? '<div class="tb-det small">' + esc(det) + '</div>' : '') + '</div>' +
          '<button type="button" class="iconbtn tb-del" data-tdel aria-label="حذف العنصر">✕</button></div>';
      }).join('') + '<button type="button" class="btn sm tb-add" data-tadd>+ إضافة عنصر (جمع، طرح، ضرب، قسمة)</button></div>';
    }
    function bindTb(box, terms, names, onChange) {
      var row = function (el) { return terms[Number(el.closest('.tb-row').dataset.i)]; };
      qa('[data-tw]', box).forEach(function (b) { b.onclick = function () { var t = row(b); pickTermKind().then(function (k) { if (!k) return; Object.keys(t).forEach(function (x) { if (x !== 'op') delete t[x]; }); t.k = k; onChange(); if (TKMAP[k].type === 'acc') pickAcc(t); }); }; });
      var pickAcc = function (t) { pickAccount({ multi: true, value: t.acc || [], title: 'اختر الحساب (الحساب الرئيسي يشمل فروعه)' }).then(function (codes) { if (codes) { t.acc = codes; onChange(); } }); };
      qa('[data-tacc]', box).forEach(function (b) { b.onclick = function () { pickAcc(row(b)); }; });
      qa('[data-tf]', box).forEach(function (b) {
        b.onclick = function () { var t = row(b), k = b.dataset.tf; t.flt = t.flt || {}; pickMulti({ title: 'اختر ' + DIM[k][1], options: fltOptions(k), value: t.flt[k] || [] }).then(function (v) { if (!v) return; if (v.length) t.flt[k] = v; else delete t.flt[k]; if (!Object.keys(t.flt).length) delete t.flt; onChange(); }); };
      });
      qa('[data-tst]', box).forEach(function (b) { b.onclick = function () { var t = row(b); pickMulti({ title: 'اختر المخازن', options: fltOptions('st'), value: t.st || [] }).then(function (v) { if (v) { t.st = v; onChange(); } }); }; });
      qa('[data-tbox]', box).forEach(function (el) { el.onchange = function () { row(el).box = el.value; onChange(); }; });
      qa('[data-tvar]', box).forEach(function (el) { el.onchange = function () { row(el).v = el.value; onChange(); }; });
      qa('[data-tnum]', box).forEach(function (el) { el.oninput = function () { row(el).n = el.value === '' ? '' : Number(el.value); onChange(true); }; });
      qa('[data-top]', box).forEach(function (el) { el.onchange = function () { row(el).op = el.value; onChange(); }; });
      qa('[data-tdel]', box).forEach(function (b) { b.onclick = function () { terms.splice(Number(b.closest('.tb-row').dataset.i), 1); if (terms[0]) delete terms[0].op; onChange(); }; });
      q('[data-tadd]', box).onclick = function () { pickTermKind().then(function (k) { if (!k) return; var t = { k: k }; if (terms.length) t.op = '+'; terms.push(t); onChange(); if (TKMAP[k].type === 'acc') pickAcc(t); }); };
    }
    function editItem(item, kind, ctx) {
      // kind: card | row | frow ; ctx: { from, to, vars, names, perLabel, flt }
      return new Promise(function (res) {
        var d = JSON.parse(JSON.stringify(item || {}));
        d.fmt = d.fmt || (kind === 'card' ? 'money0' : kind === 'row' ? 'dec2' : 'money');
        var sepInit = !!(item && item.name && !itemF(item));
        var terms = d.terms && d.terms.length ? d.terms : (d.f ? fToTerms(d.f) : []);
        var adv = !terms;           // معادلة نصية متقدمة لا يمكن تحويلها
        if (adv) terms = [];
        var sub = d.subTerms ? d.subTerms : (d.sub ? fToTerms(d.sub) || [] : []);
        var fmtOpts = function (v) { return FMT_SIMPLE.map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join(''); };
        var repOpts = '<option value="">بدون</option>' + Object.keys(R).map(function (k) { return '<option value="' + k + '"' + (d.rep === k ? ' selected' : '') + '>' + esc(R[k].name) + '</option>'; }).join('');
        var html = '<div class="form fe">' +
          '<div class="field"><label class="lbl" for="fen">' + (kind === 'card' ? 'اسم البطاقة' : 'اسم السطر') + '</label><input id="fen" class="input" value="' + esc(d.name || '') + '" placeholder="مثل: صافي مبيعات الزيت"></div>' +
          (kind !== 'card' ? '<label class="chk"><input type="checkbox" id="fesep"' + (sepInit ? ' checked' : '') + '> عنوان قسم فقط (بدون رقم)</label>' : '') +
          '<div id="febody"><div class="field"><span class="lbl">طريقة الحساب</span><div id="tbm"></div></div>' +
          '<div class="fe-res" id="fep"></div>' +
          '<div class="field"><label class="lbl" for="fefmt">شكل الرقم</label><select id="fefmt" class="input">' + fmtOpts(d.fmt) + '</select></div>' +
          (kind === 'card' ? '<details class="fe-more"' + (sub.length ? ' open' : '') + '><summary>سطر صغير تحت الرقم (اختياري)</summary><div id="tbs"></div><div class="row"><div class="field grow"><label class="lbl" for="fesl">نص بعده</label><input id="fesl" class="input" value="' + esc(d.subl || '') + '" placeholder="مثل: فاتورة"></div><div class="field grow"><label class="lbl" for="fesf">شكله</label><select id="fesf" class="input">' + fmtOpts(d.subfmt || 'int') + '</select></div></div></details>' +
            '<details class="fe-more"><summary>خيارات البطاقة</summary><label class="chk"><input type="checkbox" id="fecmp"' + (d.cmp !== false ? ' checked' : '') + '> قارن بالفترة السابقة</label>' +
            '<div class="field"><label class="lbl" for="feg">الأفضل أن يكون الرقم</label><select id="feg" class="input"><option value="up"' + (d.good !== 'down' ? ' selected' : '') + '>أعلى (مثل المبيعات)</option><option value="down"' + (d.good === 'down' ? ' selected' : '') + '>أقل (مثل المديونية)</option></select></div>' +
            '<div class="field"><label class="lbl" for="ferep">عند الضغط على البطاقة افتح تقرير</label><select id="ferep" class="input">' + repOpts + '</select></div></details>' : '') +
          (kind === 'frow' ? '<label class="chk"><input type="checkbox" id="feb"' + (d.bold ? ' checked' : '') + '> خط عريض</label>' : '') +
          '<details class="fe-more fe-adv"' + (adv ? ' open' : '') + '><summary>كتابة الحساب يدوياً (للمتقدمين فقط)</summary><textarea id="fef" class="input fe-f" rows="2" dir="rtl" spellcheck="false">' + esc(adv ? d.f : termsToF(terms)) + '</textarea><div class="small muted">يتغير تلقائياً مع اختياراتك في الأعلى.</div></details>' +
          '</div><div id="feerr"></div><button class="btn primary big" id="fesv">حفظ</button></div>';
        sheet(kind === 'card' ? (item && item.name ? 'تعديل البطاقة' : 'بطاقة جديدة') : (item && item.name ? 'تعديل السطر' : 'سطر جديد'), html, function (s) {
          var ta = q('#fef', s.el), prev = q('#fep', s.el), sep = q('#fesep', s.el);
          var curF = function () { return adv ? ta.value.trim() : termsToF(terms); };
          var preview = function () {
            var src = curF();
            if (!src) { prev.innerHTML = '<span class="muted">اضغط «+ إضافة عنصر» واختر ما تريد حسابه</span>'; return; }
            var r = tryFormula(src, ctx.from, ctx.to, ctx.vars, ctx.flt);
            prev.innerHTML = r.err ? '<span class="derr">✗ ' + esc(r.err) + '</span>' : '<span class="muted">النتيجة ' + esc(ctx.perLabel || '') + ':</span> <b class="num">' + fmtVal(r.v, q('#fefmt', s.el).value) + '</b>';
          };
          var drawTb = function () {
            var box = q('#tbm', s.el);
            if (adv) { box.innerHTML = '<div class="msg info">هذا حساب مكتوب يدوياً ولا يمكن عرضه كعناصر. عدّله من «كتابة الحساب يدوياً» أو <button type="button" class="btn sm" data-reset>ابدأ من جديد بالاختيار</button></div>'; q('[data-reset]', box).onclick = function () { adv = false; terms.length = 0; drawTb(); }; preview(); return; }
            box.innerHTML = tbHTML('tbmain', terms, ctx.names);
            bindTb(box, terms, ctx.names, function (light) { if (!light) drawTb(); else preview(); ta.value = termsToF(terms); });
            ta.value = termsToF(terms); preview();
          };
          var drawSub = function () { var box = q('#tbs', s.el); if (!box) return; box.innerHTML = tbHTML('tbsub', sub, ctx.names); bindTb(box, sub, ctx.names, function (light) { if (!light) drawSub(); }); };
          drawTb(); drawSub();
          if (!terms.length && !adv && !sepInit) setTimeout(function () { if (q('[data-tadd]', s.el)) q('[data-tadd]', s.el).click(); }, 60);
          var syncSep = function () { if (sep) q('#febody', s.el).hidden = sep.checked; };
          if (sep) { sep.onchange = syncSep; syncSep(); }
          ta.oninput = function () { var tt = fToTerms(ta.value); if (tt) { adv = false; terms.length = 0; tt.forEach(function (x) { terms.push(x); }); q('#tbm', s.el).innerHTML = tbHTML('tbmain', terms, ctx.names); bindTb(q('#tbm', s.el), terms, ctx.names, function (light) { if (!light) drawTb(); else preview(); ta.value = termsToF(terms); }); } else adv = true; preview(); };
          q('#fefmt', s.el).onchange = preview;
          q('#fesv', s.el).onclick = function () {
            var o = { name: q('#fen', s.el).value.trim() };
            if (!o.name) { q('#feerr', s.el).innerHTML = '<div class="msg err">اكتب الاسم</div>'; q('#fen', s.el).focus(); return; }
            if (sep && sep.checked) { s.done = true; s.close(); res({ name: o.name, f: '' }); return; }
            var src = curF();
            if (!src) { q('#feerr', s.el).innerHTML = '<div class="msg err">أضف عنصراً واحداً على الأقل</div>'; return; }
            var bad = !adv && terms.filter(function (t) { var dd = TKMAP[t.k]; return dd && ((dd.type === 'acc' && !(t.acc || []).length) || (dd.type === 'var' && !t.v) || (dd.type === 'num' && (t.n === '' || t.n === undefined))); })[0];
            if (bad) { q('#feerr', s.el).innerHTML = '<div class="msg err">أكمل اختيار: ' + esc(TKMAP[bad.k].label) + '</div>'; return; }
            try { parseFormula(src); } catch (e) { q('#feerr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; return; }
            if (adv) o.f = src; else { o.terms = terms; o.f = src; }
            o.fmt = q('#fefmt', s.el).value;
            if (kind === 'card') {
              o.id = d.id || ('c' + Date.now().toString(36));
              if (sub.length) { o.subTerms = sub; o.sub = termsToF(sub); }
              o.subl = q('#fesl', s.el).value.trim(); o.subfmt = q('#fesf', s.el).value;
              o.cmp = q('#fecmp', s.el).checked; o.good = q('#feg', s.el).value; o.rep = q('#ferep', s.el).value;
            }
            if (kind === 'frow') o.bold = q('#feb', s.el).checked;
            s.done = true; s.close(); res(o);
          };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    /* ---------- محرّر بند التقرير اليومي المبسّط: حسابات وقيم يدوية تُضاف أو تُخصم ---------- */
    var ACC_KINDS = [['رصيد', 'الرصيد في نهاية اليوم'], ['حركة', 'صافي حركة اليوم (مدين − دائن)'], ['مدين', 'المدين في اليوم'], ['دائن', 'الدائن في اليوم'], ['رصيد_دائن', 'الرصيد الدائن'], ['افتتاحي', 'الرصيد أول اليوم']];
    function dailySimpleOk(it) { if (!it) return true; var t = it.terms && it.terms.length ? it.terms : (it.f ? fToTerms(it.f) : []); return !!t && t.every(function (x) { return !x.op || x.op === '+' || x.op === '-'; }) && t.every(function (x) { return TKMAP[x.k] && TKMAP[x.k].type !== 'var'; }); }
    function editDaily(item, ctx) {
      if (item && !dailySimpleOk(item)) return editItem(item, 'row', ctx);
      return new Promise(function (res) {
        var d = JSON.parse(JSON.stringify(item || { name: '', fmt: 'dec2' }));
        var terms = (d.terms && d.terms.length ? d.terms : (d.f ? fToTerms(d.f) || [] : [])).map(function (t) { return Object.assign({}, t); });
        // صفر في البداية يعني أن أول عنصر مخصوم
        if (terms.length > 1 && terms[0].k === '#num' && Number(terms[0].n) === 0 && terms[1].op === '-') terms.shift(); else if (terms[0]) terms[0].op = terms[0].op || '+';
        var ready = []; TK.forEach(function (g) { g[1].forEach(function (t) { if (['acc', 'num', 'var'].indexOf(t[2]) < 0) ready.push([t[0], t[1], g[0]]); }); });
        var src = function () { var tt = terms.slice(); if (tt[0] && tt[0].op === '-') tt.unshift({ k: '#num', n: 0 }); return termsToF(tt.map(function (t, i) { var o = Object.assign({}, t); if (!i) delete o.op; return o; })); };
        var valOf = function (t) { var x = Object.assign({}, t); delete x.op; var r = tryFormula(termToF(x), ctx.from, ctx.to, ctx.vars, ctx.flt); return r.err ? '<span class="derr">✗</span>' : fmtVal(r.v, 'dec2'); };
        var accChips = function (t) { return (t.acc || []).map(function (c) { var a = F.D.byCode[c]; return '<span class="col-pill"><b class="num">' + esc(c) + '</b> ' + esc(a ? a.name : '(غير موجود)') + '</span>'; }).join('') || '<span class="small muted">لم تُختر حسابات</span>'; };
        var rowHTML = function (t, i) {
          var dd = TKMAP[t.k] || {}, body;
          if (dd.type === 'acc') body = '<select class="input dc-kind" data-dk="' + i + '">' + ACC_KINDS.map(function (k) { return '<option value="' + k[0] + '"' + (t.k === k[0] ? ' selected' : '') + '>' + k[1] + '</option>'; }).join('') + '</select><div class="st-pills dc-accs">' + accChips(t) + '<button type="button" class="btn sm" data-dacc="' + i + '">' + ((t.acc || []).length ? 'تغيير الحسابات' : 'اختر الحسابات') + '</button></div>';
          else if (dd.type === 'num') body = '<label class="dc-num"><span class="small muted">قيمة يدوية</span><input type="number" step="any" class="input num" data-dn="' + i + '" value="' + esc(t.n === undefined ? '' : t.n) + '" placeholder="0"></label>';
          else body = '<select class="input dc-kind" data-dr="' + i + '">' + ready.map(function (r) { return '<option value="' + r[0] + '"' + (t.k === r[0] ? ' selected' : '') + '>' + esc(r[2] + ' · ' + r[1]) + '</option>'; }).join('') + '</select>' + (termOpts(t) ? '<div class="small muted">' + esc(termOpts(t)) + '</div>' : '');
          return '<div class="dc-row' + (t.op === '-' ? ' minus' : '') + '"><button type="button" class="dc-sign" data-sg="' + i + '" title="إضافة أو خصم">' + (t.op === '-' ? '−' : '+') + '</button><div class="dc-main">' + body + '</div><div class="dc-val num">' + valOf(t) + '</div><button type="button" class="iconbtn" data-dcdel="' + i + '" aria-label="حذف">✕</button></div>';
        };
        var fmtOpts = FMT_SIMPLE.map(function (o) { return '<option value="' + o[0] + '"' + (d.fmt === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
        sheet(item && item.name ? 'تعديل البند' : 'بند جديد', '<div class="form dc">' +
          '<div class="field"><label class="lbl" for="dcn">اسم البند</label><input id="dcn" class="input" value="' + esc(d.name || '') + '" placeholder="مثل: النقدية المتاحة"></div>' +
          '<div class="field"><span class="lbl">مكوّنات البند (كل سطر يُضاف + أو يُخصم −)</span><div id="dcl" class="dc-list"></div>' +
          '<div class="row dc-add"><button type="button" class="btn sm" data-dadd-acc>+ حسابات</button><button type="button" class="btn sm" data-dadd-num>+ قيمة يدوية</button><button type="button" class="btn sm ghost" data-dadd-rd>+ بند جاهز (مبيعات، تحصيل…)</button></div></div>' +
          '<div class="fe-res" id="dct"></div>' +
          '<div class="field"><label class="lbl" for="dcf">شكل الرقم</label><select id="dcf" class="input">' + fmtOpts + '</select></div>' +
          '<div id="dcerr"></div><div class="row"><button type="button" class="btn ghost" id="dcadv">تعديل متقدم</button><span class="grow"></span><button class="btn primary big" id="dcsv">حفظ</button></div></div>', function (s) {
          var list = q('#dcl', s.el);
          var draw = function () {
            list.innerHTML = terms.length ? terms.map(rowHTML).join('') : '<p class="small muted" style="margin:0">أضف حسابات أو قيمة يدوية أو بنداً جاهزاً.</p>';
            var f = src(), r = f ? tryFormula(f, ctx.from, ctx.to, ctx.vars, ctx.flt) : null;
            q('#dct', s.el).innerHTML = !f ? '' : r.err ? '<span class="derr">✗ ' + esc(r.err) + '</span>' : '<span class="muted">قيمة البند ' + esc(ctx.perLabel || '') + ':</span> <b class="num">' + fmtVal(r.v, q('#dcf', s.el).value) + '</b>';
            qa('[data-sg]', list).forEach(function (b) { b.onclick = function () { var t = terms[Number(b.dataset.sg)]; t.op = t.op === '-' ? '+' : '-'; draw(); }; });
            qa('[data-dcdel]', list).forEach(function (b) { b.onclick = function () { terms.splice(Number(b.dataset.dcdel), 1); draw(); }; });
            qa('[data-dk]', list).forEach(function (el) { el.onchange = function () { terms[Number(el.dataset.dk)].k = el.value; draw(); }; });
            qa('[data-dr]', list).forEach(function (el) { el.onchange = function () { var t = terms[Number(el.dataset.dr)]; terms[Number(el.dataset.dr)] = { k: el.value, op: t.op }; draw(); }; });
            qa('[data-dn]', list).forEach(function (el) { el.onchange = function () { terms[Number(el.dataset.dn)].n = el.value === '' ? '' : Number(el.value); draw(); }; });
            qa('[data-dacc]', list).forEach(function (b) { b.onclick = function () { var t = terms[Number(b.dataset.dacc)]; pickAcc(t.acc || []).then(function (c) { if (c) { t.acc = c; draw(); } }); }; });
          };
          var pickAcc = function (cur) { return pickAccount({ multi: true, value: cur.slice(), title: 'اختر الحسابات', hint: 'يمكن اختيار أكثر من حساب، رئيسي أو فرعي. يُجمع رصيدها أو حركتها معاً.' }); };
          q('[data-dadd-acc]', s.el).onclick = function () { pickAcc([]).then(function (c) { if (c && c.length) { terms.push({ k: 'رصيد', op: '+', acc: c }); draw(); } }); };
          q('[data-dadd-num]', s.el).onclick = function () { terms.push({ k: '#num', op: '+', n: '' }); draw(); var el = qa('[data-dn]', list).pop(); if (el) el.focus(); };
          q('[data-dadd-rd]', s.el).onclick = function () { terms.push({ k: 'مبيعات', op: '+' }); draw(); };
          q('#dcf', s.el).onchange = draw;
          q('#dcadv', s.el).onclick = function () { s.done = true; s.close(); var o = { name: q('#dcn', s.el).value.trim(), fmt: q('#dcf', s.el).value, f: src() }; o.terms = fToTerms(o.f) || []; editItem(o, 'row', ctx).then(res); };
          q('#dcsv', s.el).onclick = function () {
            var name = q('#dcn', s.el).value.trim(), err = q('#dcerr', s.el);
            if (!name) { err.innerHTML = '<div class="msg err">اكتب اسم البند</div>'; return; }
            if (!terms.length) { err.innerHTML = '<div class="msg err">أضف مكوّناً واحداً على الأقل</div>'; return; }
            var bad = terms.filter(function (t) { var dd = TKMAP[t.k] || {}; return (dd.type === 'acc' && !(t.acc || []).length) || (dd.type === 'num' && (t.n === '' || t.n === undefined || isNaN(Number(t.n)))); })[0];
            if (bad) { err.innerHTML = '<div class="msg err">' + (TKMAP[bad.k].type === 'acc' ? 'اختر الحسابات في كل سطر حسابات' : 'اكتب القيمة اليدوية') + '</div>'; return; }
            var tt = terms.map(function (t) { return Object.assign({}, t); }); if (tt[0].op === '-') tt.unshift({ k: '#num', n: 0 }); delete tt[0].op;
            var o = { name: name, terms: tt, f: termsToF(tt), fmt: q('#dcf', s.el).value };
            if (d.bold) o.bold = d.bold;
            s.done = true; s.close(); res(o);
          };
          s.onclose = function () { if (!s.done) res(null); };
          draw();
        });
      });
    }
    // قائمة قابلة للتعديل (ترتيب، تعديل، حذف) مع وصف الحساب بالكلمات والقيمة الحالية
    function listEditorHTML(key, list, ctx) {
      var vals = evalList(list, ctx.from, ctx.to);
      return '<div class="list fe-list">' + (list.length ? list.map(function (it, i) {
        var v = vals[i], hasF = !!itemF(it);
        return '<div class="item fe-row' + (!hasF ? ' fe-sep' : '') + '"><div class="main"><b>' + esc(it.name || '—') + '</b>' + (hasF ? '<div class="meta"><span class="fe-txt">' + esc(itemText(it)) + '</span><span>' + (v.err ? '<span class="derr">✗ ' + esc(v.err) + '</span>' : '= <b class="num">' + fmtVal(v.v, it.fmt) + '</b>') + '</span></div>' : '<div class="meta"><span>عنوان قسم</span></div>') + '</div>' +
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
          else if (op === 'edit') (key === 'daily' && itemF(list[i]) ? editDaily(list[i], ctxFn(i)) : editItem(list[i], kind, ctxFn(i))).then(function (o) { if (o) { list[i] = o; onChange(); } });
        };
      });
    }
    function ctxFor(list, i, from, to, label, flt) {
      var vars = {}, names = [];
      evalList(list.slice(0, i), from, to, flt).forEach(function (r, j) { var n = list[j].name; if (itemF(list[j]) && n) { vars[n] = r.err ? 'err' : r.v; names.push(n); } });
      return { from: from, to: to, vars: vars, names: names, perLabel: label, flt: flt };
    }

    /* ---------- منشئ التقرير المخصص ---------- */
    function legacyBuilderHTML() {
      var d = F.custom || (F.custom = { name: '', cat: 'تقاريري', def: { ds: 'sinv', row: 'month', col: '', meas: ['net', 'profit'], chart: 'bar', top: 0, fdim: '', filter: '' } });
      var df = d.def, formula = df.kind === 'formula';
      var opt = function (list, v) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); };
      var h = '<div class="card"><h2>تقرير مخصص</h2><p class="small muted" style="margin:0 0 10px">صمّم تقريرك واحفظه باسم ليظهر في «تقاريري المخصصة» لكل المستخدمين.</p>' +
        '<div class="chips" style="margin-bottom:12px"><button class="chip' + (formula ? '' : ' on') + '" data-bk="data">تجميع البيانات (صفوف وأعمدة)</button><button class="chip' + (formula ? ' on' : '') + '" data-bk="formula">بنود أختارها بنفسي (حساب مبسّط)</button></div><div class="form">';
      if (formula) {
        var t = today();
        h += '<p class="small" style="margin:0">أضف أسطراً، وكل سطر تختار له ما يُحسب من قائمة (مبيعات، رصيد حساب، مخزون…) وتربط بينها بـ + − × ÷ إن احتجت. ثم اختر الأعمدة: شهر، أسبوع، أو يوم.</p>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="bcols">الأعمدة</label><select id="bcols" class="input">' + opt([['single', 'عمود واحد (الفترة كاملة)'], ['month', 'عمود لكل شهر'], ['week', 'عمود لكل أسبوع'], ['day', 'عمود لكل يوم']], df.cols || 'month') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="bch">رسم بياني (للسطر الأول)</label><select id="bch" class="input">' + opt([['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط']], df.chart || '') + '</select></div></div>' +
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
        h += '<div class="card"><div class="small muted">معاينة: ' + perLabel(p.from, p.to) + ' (يمكن تغيير الفترة بعد الحفظ)' + (res.note ? ' · ' + esc(plain(res.note)) : '') + '</div></div>' +
          (res.empty ? '<div class="card empty">' + esc(res.empty) + '</div>' : (res.chart && (res.chart.rowsOverride || res.rows.length > 1) ? '<div class="card">' + chartSVG(res.chart, res.rows) + '</div>' : '') + '<div class="card scroll-x fin-table">' + tableHTML(res) + '</div>');
      }
      return h;
    }
    function legacyBindBuilder(m) {
      var d = F.custom, df = d.def;
      d._upd = null;
      var nm = q('#bname', m); nm.oninput = function () { d.name = this.value; };
      qa('[data-bk]', m).forEach(function (b) {
        b.onclick = function () {
          if ((b.dataset.bk === 'formula') === (df.kind === 'formula')) return;
          d.def = df = b.dataset.bk === 'formula' ? { kind: 'formula', cols: 'month', chart: '', rows: [{ name: 'صافي المبيعات', terms: [{ k: 'مبيعات' }], fmt: 'money' }, { name: 'مجمل الربح', terms: [{ k: 'ربح' }], fmt: 'money' }, { name: 'هامش الربح %', terms: [{ k: '#var', v: 'مجمل الربح' }, { k: '#var', v: 'صافي المبيعات', op: '/' }, { k: '#num', n: 100, op: '*' }], fmt: 'pct' }] }
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
        if (df.kind === 'formula' && !(df.rows || []).some(function (r) { return itemF(r); })) { toast('أضف سطراً فيه معادلة', true); return; }
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
    var SET_TABS = [['boxes', 'الصناديق والبنوك'], ['cards', 'بطاقات لوحة المؤشرات'], ['daily', 'التقرير اليومي'], ['groups', 'مجموعات الحسابات'], ['cgroups', 'مجموعات العملاء'], ['reps', 'المندوبون وفئاتهم'], ['data', 'البيانات']];
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
        // لكل فرع (والإدارة العامة) صناديقه وبنوكه منفصلة، لأن لكل منها دليل حسابات مستقل في سراج
        var brs = multiBr() ? branches() : [{ code: viewBr() === '*' ? '' : (F.curBr || ''), name: '' }];
        h += '<div class="card"><h2>الصناديق والبنوك</h2><p class="small muted" style="margin:0">عرّف الصناديق والحسابات المصرفية التي تريد متابعة أرصدتها وحركتها وتحصيلها. كل واحد مربوط بحساب في دليل حسابات سراج' + (multiBr() ? '، ولكل فرع وللإدارة العامة قائمة منفصلة' : '') + '. يمكنك تحديد أنواع السندات التي تظهر في تقارير كل صندوق. «إيقاف» يخفيه من التقارير، و«حذف التعريف» يلغي ربطه (ولا يمس سراج).</p></div>';
        brs.forEach(function (br) {
          var inBr = function () {
            var bx = F.boxes.filter(function (b) { return !multiBr() || !!T().acc[b.acc]; }).sort(function (a, b) { return (b.active - a.active) || (a.sort || 0) - (b.sort || 0); });
            var sug = boxSuggestions(), bts = T().bt || {};
            var o = '<div class="card box-br">' + (br.name ? '<h2 class="box-brh">' + esc(br.name) + ' <span class="badge">' + bx.filter(function (b) { return b.active; }).length + '</span></h2>' : '') +
              (bx.length ? '<div class="list">' + bx.map(function (b) {
                var tl = (b.types || []).map(function (t) { return (bts[t] || T().it[t] || {}).name || t; });
                return '<div class="item' + (b.active ? '' : ' muted') + '"><div class="main"><b>' + esc(b.name) + ' <span class="badge">' + esc(b.kind) + '</span>' + (b.active ? '' : ' <span class="badge">موقوف</span>') + '</b><div class="meta"><span class="num">' + esc((acc(b.acc) || {}).code || '') + '</span><span>' + esc(accName(b.acc)) + '</span><span>الرصيد الآن: <b class="num">' + fm(balance([b.acc], null, null).close) + '</b></span></div>' +
                  '<div class="meta"><span>' + (tl.length ? 'السندات المعروضة: ' + esc(tl.join('، ')) : 'السندات المعروضة: كل الأنواع') + '</span></div></div>' +
                  '<div class="fe-btns"><button class="btn sm ghost" data-bedit="' + esc(b.id) + '" data-bbr="' + esc(br.code) + '">تعديل</button>' + (b.active ? '' : '<button class="btn sm ghost" data-bon="' + esc(b.id) + '">تفعيل</button>') + '<button class="btn sm ghost danger-t" data-bdel="' + esc(b.id) + '">حذف التعريف</button></div></div>';
              }).join('') + '</div>' : '<div class="msg info">لم يُعرّف أي صندوق أو بنك' + (br.name ? ' في ' + esc(br.name) : '') + ' بعد.</div>') +
              '<div class="row" style="margin-top:10px"><button class="btn primary" data-badd="' + esc(br.code) + '">+ تعريف صندوق أو بنك' + (br.name ? ' في ' + esc(br.name) : '') + '</button></div>';
            if (sug.length) o += '<details class="box-sug"' + (bx.length ? '' : ' open') + '><summary>حسابات مقترحة من دليل سراج (' + sug.length + ')</summary><p class="small muted" style="margin:6px 0 8px">حسابات تحت «الصناديق» و«المصارف» عليها حركة ولم تُعرّف بعد.</p><div class="list">' +
              sug.map(function (x) { return '<label class="item tap"><input type="checkbox" data-sug="' + esc(br.code) + '|' + esc(x.acc) + '|' + esc(x.kind) + '" data-sname="' + esc(x.name) + '"><div class="main"><b>' + esc(x.name) + '</b><div class="meta"><span class="badge">' + x.kind + '</span><span>' + fk(x.n) + ' حركة</span><span>الرصيد ' + fm(x.bal) + '</span></div></div></label>'; }).join('') +
              '</div><button class="btn accent" data-sugadd="' + esc(br.code) + '" style="margin-top:10px">تعريف المحدد</button></details>';
            return o + '</div>';
          };
          h += multiBr() ? withBr(br.code, inBr) : inBr();
        });
      } else if (tab === 'cards') {
        var cl = editDraft('cards'), r = presetRange('month');
        h += '<div class="card"><h2>بطاقات لوحة المؤشرات</h2><p class="small muted" style="margin:0 0 10px">كل بطاقة تختار لها ما تحسبه من قائمة (مثل: صافي المبيعات لعميل أو صنف معين، أو رصيد حساب ناقص رصيد حساب آخر). القيم الظاهرة هنا لهذا الشهر.</p>' +
          listEditorHTML('cards', cl, { from: r[0], to: r[1] }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-cadd>+ بطاقة</button><span class="grow"></span><button class="btn ghost" data-creset>استعادة الافتراضي</button><button class="btn accent" data-csave' + (F.dirtyKeys && F.dirtyKeys.cards ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>';
      } else if (tab === 'daily') {
        var dd = editDraft('daily'), d0 = F.D.maxDate || today();
        h += '<div class="card"><h2>التقرير اليومي للإدارة</h2><p class="small muted" style="margin:0 0 10px">رتّب الأسطر وغيّر معادلة كل سطر. القيم الظاهرة هنا ليوم ' + N(d0) + '.</p>' +
          '<div class="field"><label class="lbl" for="dtitle">عنوان التقرير</label><input id="dtitle" class="input" value="' + esc(dd.title || '') + '"></div>' +
          listEditorHTML('daily', dd.rows, { from: d0, to: d0 }) +
          '<div class="row" style="margin-top:10px"><button class="btn" data-dadd>+ سطر</button><button class="btn ghost" data-dsep>+ عنوان قسم</button><span class="grow"></span><button class="btn ghost" data-dreset>استعادة الافتراضي</button><button class="btn accent" data-dsave' + (F.dirtyKeys && F.dirtyKeys.daily ? '' : ' disabled') + '>حفظ التغييرات</button></div></div>' +
          '<div class="card"><h3>ملاحظة عن Sell-Out</h3><p class="small" style="margin:0">«Total Sell-Out» افتراضياً = الكمية المباعة لكل العملاء. لحصره في عملاء أو أصناف أو مخزن معين: اضغط «تعديل» على السطر، ثم «كل العملاء» أو «كل الأصناف» واختر ما تريد.</p></div>';
      } else if (tab === 'cgroups') {
        h += cgSettingsHTML();
      } else if (tab === 'reps') {
        h += repsSettingsHTML();
      } else if (tab === 'groups') {
        var grpField = function (k, code) {
          var codes = multiBr() ? grpCodes(k, code) : (s[k] || (k === 'recv' ? '1601' : '261'));
          var n = multiBr() ? leavesOf(byCodes(codes, code)).length : (k === 'recv' ? recvIds() : payIds()).length;
          return '<div class="field"><span class="lbl">' + (k === 'recv' ? 'حسابات العملاء (للمديونيات وأعمار الديون والتحصيل)' : 'حسابات الموردين') + '</span><button class="input" data-grp="' + k + '" data-gbr="' + esc(multiBr() ? code : '') + '" style="text-align:start">' + esc(grpLabel(codes, multiBr() ? code : undefined)) + '</button><span class="small muted">' + fk(n) + (k === 'recv' ? ' حساب عميل' : ' حساب مورد') + '</span></div>';
        };
        h += '<div class="card"><h2>مجموعات الحسابات</h2>' + (multiBr() ? '<p class="small muted" style="margin:0 0 10px">لكل فرع دليل حسابات مستقل في سراج، فحدّد حسابات العملاء والموردين لكل فرع.</p>' : '') + '<div class="form">' +
          (multiBr() ? branches().map(function (b) { return '<h3 style="margin:6px 0 0">' + esc(b.name) + '</h3>' + grpField('recv', b.code) + grpField('pay', b.code); }).join('') : grpField('recv', '') + grpField('pay', '')) +
          '<div class="field"><label class="lbl" for="fys">بداية السنة المالية</label><input type="date" class="input num" id="fys" value="' + esc(s.year_start || '2026-01-01') + '" style="max-width:200px"></div></div></div>';
      } else {
        h += '<div class="card"><h2>البيانات على هذا الجهاز</h2><p class="small" style="margin:0">' + fk(dataCount()) + ' سجل · آخر مزامنة ' + esc((F.meta && F.meta.last) || '—') + '</p><p class="small muted">تُحفظ البيانات المالية على هذا الجهاز لتعمل التقارير بسرعة وبلا إنترنت، وتُمسح عند الخروج من التطبيق.</p><button class="btn sm ghost" data-open="data_check">فحص سلامة البيانات</button></div>';
      }
      return h;
    }
    function grpLabel(codes, br) { return String(codes).split(',').map(function (c) { var a = (F.D.byCodeAll[c] || []).filter(function (x) { return br === undefined || x.br === br; })[0]; return a ? c + ' · ' + a.name : c + (br !== undefined ? ' (غير موجود في هذا الفرع)' : ''); }).join('، '); }
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
        qa('[data-badd]', m).forEach(function (b) { b.onclick = function () { boxForm(null, b.dataset.badd); }; });
        qa('[data-bedit]', m).forEach(function (b) { b.onclick = function () { boxForm(F.boxes.filter(function (x) { return x.id === b.dataset.bedit; })[0], b.dataset.bbr); }; });
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
        qa('[data-sugadd]', m).forEach(function (sa) {
          sa.onclick = function () {
            var pick = qa('[data-sug^="' + sa.dataset.sugadd + '|"]', m).filter(function (c) { return c.checked; }).map(function (c) { var x = c.dataset.sug.split('|'); return { acc: x[1], kind: x[2], name: c.dataset.sname }; });
            if (!pick.length) { toast('حدّد حساباً واحداً على الأقل', true); return; }
            busy(sa, true);
            var chain = Promise.resolve();
            pick.forEach(function (x, i) { chain = chain.then(function () { return call('fin_box_save', { box: { acc: x.acc, name: x.name, kind: x.kind, sort: F.boxes.length + i } }).then(function (r) { F.boxes = r.boxes; }); }); });
            chain.then(function () { toast('عُرّف ' + pick.length + ' صندوق/بنك'); A.render(); }).catch(function (e) { busy(sa, false); toast(e.message, true); A.render(); });
          };
        });
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
        q('[data-dadd]', m).onclick = function () { editDaily(null, ctxFor(dd.rows, dd.rows.length, d0, d0, 'يوم ' + d0)).then(function (o) { if (o) { dd.rows.push(o); chd(); } }); };
        q('[data-dsep]', m).onclick = function () { editItem({ name: '', f: '' }, 'row', { from: d0, to: d0 }).then(function (o) { if (o) { dd.rows.push(o); chd(); } }); };
        q('[data-dsave]', m).onclick = function () { saveConfig('daily', { title: dd.title, rows: dd.rows }, this); };
        q('[data-dreset]', m).onclick = function () { A.confirmBox('استعادة الافتراضي', 'استبدال أسطر التقرير اليومي بالأسطر الافتراضية (مثل نموذج الإدارة)؟', 'استعادة').then(function (y) { if (y) saveConfig('daily', null); }); };
      } else if (tab === 'cgroups') {
        bindCgSettings(m);
      } else if (tab === 'reps') {
        bindRepsSettings(m);
      } else if (tab === 'groups') {
        qa('[data-grp]', m).forEach(function (b) {
          b.onclick = function () {
            var k = b.dataset.grp, gb = b.dataset.gbr || '', cur = String(multiBr() ? grpCodes(k, gb) : (((F.meta && F.meta.settings) || {})[k] || (k === 'recv' ? '1601' : '261'))).split(',');
            pickAccount({ multi: true, value: cur, title: (k === 'recv' ? 'حسابات العملاء' : 'حسابات الموردين') + (multiBr() ? ' · ' + brName(gb) : ''), hint: 'اختر الحسابات الرئيسية التي تحتها العملاء أو الموردون. كل الحسابات الفرعية تحتها تُحسب تلقائياً.', filter: function (a) { return (!multiBr() || a.br === gb) && (!a.leaf || a.lvl <= 4); } })
              .then(function (codes) {
                if (!codes || !codes.length) return;
                var body = {}; body[k] = codes.join(',');
                call('fin_settings_save', { settings: body, br: multiBr() ? gb : '' }).then(function (r) { F.meta.settings = r.settings; resetCache(); S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); });
              });
          };
        });
        q('#fys', m).onchange = function () { call('fin_settings_save', { settings: { year_start: this.value } }).then(function (r) { F.meta.settings = r.settings; resetCache(); S.set('fin:meta', F.meta); toast('حُفظت'); A.render(); }).catch(function (e) { toast(e.message, true); }); };
      }
    }
    function boxForm(b, brCode) {
      var d = b ? Object.assign({}, b) : { acc: '', name: '', kind: 'صندوق', active: true, sort: F.boxes.length, types: [] };
      d.types = (d.types || []).slice();
      var mb = multiBr(), br = brCode || '';
      // داخل نموذج الفرع حتى تظهر حساباته وأنواع سنداته فقط
      var inBr = function (fn) { return mb ? withBr(br, fn) : fn(); };
      var accLabel = function () { return inBr(function () { return d.acc ? ((acc(d.acc) || {}).code || '') + ' · ' + accName(d.acc) : 'اختر الحساب…'; }); };
      var typeOpts = function () {
        return inBr(function () {
          var g = {}, Tt = T();
          (F.D.byAcc[d.acc] || []).forEach(function (l) { var k = String(l.bt || ''), o = g[k] || (g[k] = { k: k, name: l.btn || k, n: 0, v: 0 }); o.n++; o.v += l.dr + l.cr; });
          d.types.forEach(function (k) { if (!g[k]) g[k] = { k: k, name: ((Tt.bt || {})[k] || Tt.it[k] || {}).name || k, n: 0, v: 0 }; });
          return Object.keys(g).map(function (k) { return g[k]; }).sort(function (a, b) { return b.n - a.n; });
        });
      };
      var accList = inBr(function () { return F.D.accList.filter(function (a) { return a.leaf; }).slice(); });
      var drawTypes = function (el) {
        var ops = typeOpts();
        el.innerHTML = !d.acc ? '<p class="small muted" style="margin:0">اختر الحساب أولاً لتظهر أنواع السندات التي عليه.</p>' : !ops.length ? '<p class="small muted" style="margin:0">لا توجد حركات على هذا الحساب بعد.</p>' :
          '<p class="small muted" style="margin:0 0 6px">' + (d.types.length ? 'تظهر في التقارير الأنواع المحددة فقط.' : 'بدون تحديد: تظهر كل الأنواع.') + '</p><div class="list bt-list">' + ops.map(function (o) {
            var on = d.types.indexOf(o.k) >= 0;
            return '<label class="item tap"><input type="checkbox" data-bt="' + esc(o.k) + '"' + (on ? ' checked' : '') + '><div class="main"><b>' + esc(o.name) + '</b><div class="meta"><span>' + fk(o.n) + ' حركة</span><span>' + fm(o.v) + '</span></div></div></label>';
          }).join('') + '</div><div class="row small" style="margin-top:6px"><button type="button" class="btn sm ghost" data-btall>كل الأنواع</button></div>';
        qa('[data-bt]', el).forEach(function (c) { c.onchange = function () { var k = c.dataset.bt, i = d.types.indexOf(k); if (c.checked && i < 0) d.types.push(k); if (!c.checked && i >= 0) d.types.splice(i, 1); drawTypes(el); }; });
        var all = q('[data-btall]', el); if (all) all.onclick = function () { d.types = []; drawTypes(el); };
      };
      return sheet((b ? 'تعديل ' + b.name : 'تعريف صندوق أو بنك') + (mb ? ' · ' + brName(br) : ''), '<div class="form"><div class="field"><span class="lbl">الحساب في دليل سراج' + (mb ? ' (' + esc(brName(br)) + ')' : '') + '</span><button class="input" id="bacc" style="text-align:start">' + esc(accLabel()) + '</button></div>' +
        '<div class="field"><label class="lbl" for="bnm">الاسم في التقارير</label><input id="bnm" class="input" value="' + esc(d.name) + '"></div>' +
        '<div class="field"><span class="lbl">النوع</span><div class="chips">' + ['صندوق', 'بنك'].map(function (k) { return '<button class="chip' + (d.kind === k ? ' on' : '') + '" data-k="' + k + '">' + k + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><span class="lbl">أنواع السندات التي تظهر في التقارير</span><div id="btypes"></div></div>' +
        '<div class="field"><label class="lbl" for="bso">الترتيب</label><input id="bso" type="number" class="input num" value="' + esc(d.sort) + '" style="max-width:120px"></div>' +
        (b ? '<label class="chk"><input type="checkbox" id="bac"' + (d.active ? ' checked' : '') + '> نشط (يظهر في التقارير)</label>' : '') +
        '<div id="berr"></div><button class="btn primary big" id="bsv">حفظ</button></div>', function (s) {
        drawTypes(q('#btypes', s.el));
        q('#bacc', s.el).onclick = function () {
          pickAccount({ title: 'حساب الصندوق أو البنك' + (mb ? ' · ' + brName(br) : ''), list: accList }).then(function (id) {
            if (!id) return; d.acc = id; d.types = []; var a = accList.filter(function (x) { return x.id === id; })[0] || {};
            q('#bacc', s.el).textContent = (a.code || '') + ' · ' + (a.name || '');
            if (!q('#bnm', s.el).value) q('#bnm', s.el).value = String(a.name || '').trim();
            drawTypes(q('#btypes', s.el));
          });
        };
        qa('[data-k]', s.el).forEach(function (c) { c.onclick = function () { d.kind = c.dataset.k; qa('[data-k]', s.el).forEach(function (x) { x.classList.toggle('on', x === c); }); }; });
        q('#bsv', s.el).onclick = function () {
          var btn = this; busy(btn, true);
          d.name = q('#bnm', s.el).value.trim(); d.sort = Number(q('#bso', s.el).value) || 0; if (b) d.active = q('#bac', s.el).checked;
          call('fin_box_save', { box: d }).then(function (r) { F.boxes = r.boxes; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); resetCache(); s.close(); toast('حُفظ'); A.render(); })
            .catch(function (e) { busy(btn, false); q('#berr', s.el).innerHTML = '<div class="msg err">' + esc(e.message) + '</div>'; });
        };
      });
    }

