    /* ===================== محرّك التقارير المخصصة الجديدة =====================
       1) «حساب مقابل حساب»: حركة حساب (أو مجموعة حسابات) مع حساب مقابل محدد، مع كلمات في البيان.
       2) «تقرير حر»: مصدر بيانات + أعمدة + شروط + ترتيب + تجميع، يُبنى من الصفر. */

    // توحيد النص العربي للبحث: بلا تشكيل، والألف والتاء المربوطة والياء بشكل واحد
    function normAr(s) {
      return String(s || '').replace(/[ً-ْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
        .replace(/[٠-٩]/g, function (c) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(c); }).toLowerCase().replace(/\s+/g, ' ').trim();
    }
    function kwList(s) { return String(s || '').split(/[,،\n]+/).map(normAr).filter(String); }
    // هل النص يطابق الكلمات؟ mode: any = أي كلمة، all = كل الكلمات. ex = كلمات مستبعدة
    function kwPass(text, kw, mode, ex) {
      var t = normAr(text);
      if (ex.length && ex.some(function (w) { return t.indexOf(w) >= 0; })) return false;
      if (!kw.length) return true;
      return mode === 'all' ? kw.every(function (w) { return t.indexOf(w) >= 0; }) : kw.some(function (w) { return t.indexOf(w) >= 0; });
    }
    function idSet(ids) { var o = {}; ids.forEach(function (x) { o[x] = 1; }); return o; }
    function codesText(codes) {
      return (codes || []).map(function (c) { var a = F.D.byCode[c]; return a ? a.name : c; }).join('، ');
    }
    function emptyRes(msg) { return { cols: [C('m', '')], rows: [], empty: msg }; }

    /* ---------- 1) حساب مقابل حساب ---------- */
    var PAIR_VIEWS = [['lines', 'كل حركة في سطر'], ['month', 'مجمّع شهرياً'], ['cp', 'حسب الحساب المقابل'], ['acc', 'حسب الحساب الفرعي'], ['type', 'حسب نوع القيد']];
    function pairMatches(def, p) {
      var idsA = byCodes((def.a || []).join(','));
      var inA = idSet(idsA), inB = (def.b || []).length ? idSet(byCodes(def.b.join(','))) : null;
      var kw = kwList(def.kw), ex = kwList(def.kwx), out = [];
      idsA.forEach(function (id) {
        (F.D.byAcc[id] || []).forEach(function (l) {
          if (l.d < p.from || l.d > p.to) return;
          if (def.side === 'dr' && !l.dr || def.side === 'cr' && !l.cr) return;
          var ent = F.D.byEntry[l.e] || [l];
          var others = ent.filter(function (x) { return !inA[x.a]; });
          // الطرف المقابل: الأسطر في الجهة المعاكسة (وإن لم توجد فكل الأسطر الأخرى)
          var opp = others.filter(function (x) { return l.dr ? x.cr : x.dr; });
          if (!opp.length) opp = others;
          var cps = inB ? opp.filter(function (x) { return inB[x.a]; }) : opp;
          if (inB && !cps.length) return;
          if (kw.length || ex.length) {
            var text = (l.ed || '') + ' ' + ent.map(function (x) { return x.ld || ''; }).join(' ');
            if (!kwPass(text, kw, def.kwm, ex)) return;
          }
          // المبلغ المقابل فقط: إذا كان في القيد أكثر من طرف مقابل نوزّع المبلغ بنسبة كل طرف
          var amt = l.dr || l.cr, oppSum = opp.reduce(function (s, x) { return s + ((l.dr ? x.cr : x.dr) || 0); }, 0);
          var share = function (x) { var v = l.dr ? x.cr : x.dr; return oppSum ? amt * (v || 0) / oppSum : amt / (opp.length || 1); };
          var part = inB ? cps.reduce(function (s, x) { return s + share(x); }, 0) : amt;
          out.push({ l: l, cps: cps, share: share, dr: l.dr ? part : 0, cr: l.cr ? part : 0 });
        });
      });
      out.sort(function (x, y) { return cmpLine(x.l, y.l); });
      return out;
    }
    function runPair(def, p) {
      if (!(def.a || []).length) return emptyRes('اختر الحساب الأول');
      var m = pairMatches(def, p), view = def.view || 'lines';
      var aName = codesText(def.a), bName = (def.b || []).length ? codesText(def.b) : 'كل الحسابات';
      var title = 'حركة ' + aName + ' مقابل ' + bName;
      var notes = [];
      if (def.kw) notes.push('البيان يحتوي ' + (def.kwm === 'all' ? 'كل الكلمات' : 'أياً من الكلمات') + ': ' + def.kw);
      if (def.kwx) notes.push('بدون: ' + def.kwx);
      if (def.side === 'dr') notes.push('الحركات المدينة فقط'); else if (def.side === 'cr') notes.push('الحركات الدائنة فقط');
      var tDr = 0, tCr = 0; m.forEach(function (x) { tDr += x.dr; tCr += x.cr; });
      var res;
      if (view === 'lines') {
        var multiA = byCodes((def.a || []).join(',')).filter(function (id) { return F.D.byAcc[id]; }).length > 1, bal = 0;
        var rows = m.map(function (x) {
          bal += x.dr - x.cr;
          var names = []; x.cps.forEach(function (c) { var n = accName(c.a); if (names.indexOf(n) < 0) names.push(n); });
          return { d: x.l.d, no: x.l.no, type: x.l.btn, desc: x.l.ld || x.l.ed || '', acc: accName(x.l.a), cp: names.length > 2 ? names[0] + ' و' + (names.length - 1) + ' أخرى' : names.join('، '),
            dr: x.dr || '', cr: x.cr || '', bal: bal };
        });
        var cols = [C('d', 'التاريخ'), C('no', 'رقم القيد'), C('type', 'النوع'), C('desc', 'البيان')].concat(multiA ? [C('acc', 'الحساب')] : [])
          .concat([C('cp', 'الحساب المقابل'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money'), C('bal', 'الرصيد التراكمي', 'money')]);
        res = { cols: cols, rows: rows, total: { d: 'الإجمالي (' + m.length + ' حركة)', dr: tDr, cr: tCr, bal: tDr - tCr } };
      } else {
        var g = {}, add = function (k, name, dr, cr, sortK) { var r = g[k] || (g[k] = { k: k, name: name, s: sortK || name, n: 0, dr: 0, cr: 0 }); r.n++; r.dr += dr; r.cr += cr; };
        m.forEach(function (x) {
          if (view === 'month') add(x.l.d.slice(0, 7), monthLabel(x.l.d.slice(0, 7)), x.dr, x.cr, x.l.d.slice(0, 7));
          else if (view === 'acc') add(x.l.a, accName(x.l.a), x.dr, x.cr);
          else if (view === 'type') add(x.l.btn, x.l.btn, x.dr, x.cr);
          else x.cps.forEach(function (c) { var v = x.share(c); add(c.a, accName(c.a), x.l.dr ? v : 0, x.l.cr ? v : 0); });
        });
        var list = Object.keys(g).map(function (k) { var r = g[k]; r.net = r.dr - r.cr; return r; });
        list.sort(view === 'month' ? function (a, b) { return a.s < b.s ? -1 : 1; } : function (a, b) { return Math.abs(b.dr + b.cr) - Math.abs(a.dr + a.cr); });
        var first = { month: 'الشهر', acc: 'الحساب الفرعي', type: 'نوع القيد', cp: 'الحساب المقابل' }[view];
        var cols2 = [C('name', first), C('n', 'عدد الحركات', 'int'), C('dr', 'مدين', 'money'), C('cr', 'دائن', 'money'), C('net', 'الصافي (مدين − دائن)', 'money')];
        res = { cols: cols2, rows: list, total: sumRow(list, cols2) };
        if (list.length > 1) res.chart = view === 'month' ? { type: 'bar', x: 'name', y: ['dr', 'cr'], yl: ['مدين', 'دائن'] } : { type: 'hbar', x: 'name', y: ['net'], yl: ['الصافي'], limit: 15 };
      }
      res.subtitle = title;
      if (notes.length) res.note = notes.join(' · ');
      if (!m.length) res.empty = 'لا توجد حركات مطابقة في هذه الفترة' + (def.kw ? ' بهذه الكلمات' : '');
      return res;
    }

    /* ---------- 2) التقرير الحر ---------- */
    var CLS_AR = {}; CLS_AR[SALE] = 'مبيع'; CLS_AR[SRET] = 'مرتجع مبيع'; CLS_AR[PUR] = 'شراء'; CLS_AR[PRET] = 'مرتجع شراء'; CLS_AR[OPEN_STOCK] = 'بضاعة أول المدة'; CLS_AR[TRANSFER] = 'مناقلة'; CLS_AR[ISSUE] = 'إخراج';
    var K_AR = { r: 'سند قبض', p: 'سند دفع', j: 'قيد يومية', i: 'قيد فاتورة', o: 'قيد افتتاحي' };
    function invTypeName(v) { return (T().it[v.t] || {}).name || CLS_AR[v.c] || String(v.c); }
    function brNameOf(r) { var b = (r.br || ''); return multiBr() ? brName(b) : ''; }
    // الحقول: [الاسم، النوع، القيمة]. الأنواع: text نص · date تاريخ · money مبلغ · qty كمية · int عدد
    var SRC = {
      jl: { name: 'القيود المحاسبية', hint: 'كل سطر في كل قيد: سندات القبض والدفع وقيود اليومية وقيود الفواتير',
        rows: function () { return T().jl; },
        def: ['d', 'no', 'type', 'acc', 'desc', 'dr', 'cr'],
        f: {
          d: ['التاريخ', 'date', function (l) { return l.d; }], mon: ['الشهر', 'text', function (l) { return l.d.slice(0, 7); }, 'month'],
          no: ['رقم القيد', 'text', function (l) { return l.no || ''; }], type: ['نوع القيد', 'text', function (l) { return l.btn; }],
          kind: ['تصنيف القيد', 'text', function (l) { return K_AR[l.k] || 'قيد'; }],
          code: ['رمز الحساب', 'text', function (l) { return (acc(l.a) || {}).code || ''; }], acc: ['الحساب', 'text', function (l) { return accName(l.a); }],
          acc2: ['الحساب (مستوى 2)', 'text', function (l) { return ancestorAt(l.a, 2); }], acc3: ['الحساب (مستوى 3)', 'text', function (l) { return ancestorAt(l.a, 3); }],
          acc4: ['الحساب (مستوى 4)', 'text', function (l) { return ancestorAt(l.a, 4); }],
          desc: ['البيان', 'text', function (l) { return l.ld || l.ed || ''; }], ed: ['بيان القيد', 'text', function (l) { return l.ed || ''; }], ld: ['بيان السطر', 'text', function (l) { return l.ld || ''; }],
          cp: ['الحساب المقابل', 'text', function (l) { return counterpart(l, [l.a]); }],
          dr: ['مدين', 'money', function (l) { return l.dr; }], cr: ['دائن', 'money', function (l) { return l.cr; }], net: ['الصافي (مدين − دائن)', 'money', function (l) { return l.dr - l.cr; }],
          rep: ['المندوب', 'text', function (l) { return repName(l.ag); }], user: ['المستخدم', 'text', function (l) { return userName(l.u); }],
          br: ['الفرع', 'text', brNameOf]
        } },
      inv: { name: 'الفواتير', hint: 'رأس كل فاتورة: مبيع، مرتجع، شراء… بصافيها وكميتها وربحها',
        rows: function () { return F.D.invs; },
        def: ['d', 'no', 'cls', 'cust', 'net'],
        f: {
          d: ['التاريخ', 'date', function (v) { return v.d; }], mon: ['الشهر', 'text', function (v) { return v.d.slice(0, 7); }, 'month'],
          no: ['رقم الفاتورة', 'text', function (v) { return v.no || ''; }], cls: ['نوع الحركة', 'text', function (v) { return CLS_AR[v.c] || String(v.c); }],
          type: ['نوع الفاتورة', 'text', invTypeName], cust: ['العميل/المورد', 'text', function (v) { return v.name; }],
          store: ['المخزن', 'text', function (v) { return storeName(v.st); }], rep: ['المندوب', 'text', function (v) { return repName(v.ag); }],
          user: ['المستخدم', 'text', function (v) { return userName(v.u); }], note: ['البيان', 'text', function (v) { return v.note || ''; }],
          net: ['الصافي', 'money', function (v) { return v.sign * v.net; }], qty: ['الكمية', 'qty', function (v) { return v.sign * v.qty; }],
          cost: ['التكلفة', 'money', function (v) { return v.sign * v.cost; }], profit: ['الربح', 'money', function (v) { return v.sign * v.profit; }],
          br: ['الفرع', 'text', brNameOf]
        } },
      invl: { name: 'أصناف الفواتير', hint: 'كل صنف في كل فاتورة: الكميات والأسعار والقيم والأرباح',
        rows: function () { return T().invl.filter(function (l) { return l.v; }); },
        def: ['d', 'no', 'cust', 'item', 'qty', 'value'],
        f: {
          d: ['التاريخ', 'date', function (l) { return l.d; }], mon: ['الشهر', 'text', function (l) { return l.d.slice(0, 7); }, 'month'],
          no: ['رقم الفاتورة', 'text', function (l) { return l.v.no || ''; }], cls: ['نوع الحركة', 'text', function (l) { return CLS_AR[l.v.c] || String(l.v.c); }],
          type: ['نوع الفاتورة', 'text', function (l) { return invTypeName(l.v); }], cust: ['العميل/المورد', 'text', function (l) { return l.v.name; }],
          item: ['الصنف', 'text', function (l) { return itemName(l.item); }], icode: ['رمز الصنف', 'text', function (l) { return (T().item[l.item] || {}).code || ''; }],
          unit: ['الوحدة', 'text', function (l) { return (T().item[l.item] || {}).mu || l.un || ''; }],
          store: ['المخزن', 'text', function (l) { return storeName(l.st); }], rep: ['المندوب', 'text', function (l) { return repName(l.v.ag); }],
          user: ['المستخدم', 'text', function (l) { return userName(l.v.u); }],
          qty: ['الكمية', 'qty', function (l) { var it = T().item[l.item] || { f: 1 }; return l.v.sign * l.qb / (it.f || 1); }],
          gift: ['الهدايا', 'qty', function (l) { return l.v.sign * l.g; }], price: ['السعر', 'money', function (l) { return l.p; }],
          value: ['القيمة', 'money', function (l) { return l.v.sign * l.tot; }], cost: ['التكلفة', 'money', function (l) { return l.v.sign * l.cost; }],
          profit: ['الربح', 'money', function (l) { return l.v.sign * l.win; }], br: ['الفرع', 'text', brNameOf]
        } }
    };
    var NUMT = { money: 1, qty: 1, int: 1 };
    // العمليات في الشروط
    var OPS_T = [['has', 'يحتوي على'], ['nhas', 'لا يحتوي على'], ['eq', 'يساوي'], ['in', 'واحد من'], ['nin', 'ليس من'], ['empty', 'فارغ'], ['nempty', 'غير فارغ']];
    var OPS_N = [['gt', 'أكبر من'], ['lt', 'أصغر من'], ['ge', 'أكبر من أو يساوي'], ['le', 'أصغر من أو يساوي'], ['eqn', 'يساوي'], ['ne0', 'لا يساوي صفراً']];
    function condPass(cnd, row, src) {
      if (cnd.f === '@acc') {   // الحساب وكل فروعه (للقيود)
        var s = cnd._ids || (cnd._ids = idSet(byCodes((cnd.v || []).join(','))));
        return cnd.op === 'nin' ? !s[row.a] : !!s[row.a];
      }
      var fd = SRC[src].f[cnd.f]; if (!fd) return true;
      var v = fd[2](row);
      if (NUMT[fd[1]]) {
        var x = Number(v) || 0, n = Number(cnd.v) || 0;
        return cnd.op === 'gt' ? x > n : cnd.op === 'lt' ? x < n : cnd.op === 'ge' ? x >= n : cnd.op === 'le' ? x <= n : cnd.op === 'ne0' ? Math.abs(x) > 0.0005 : Math.abs(x - n) < 0.0005;
      }
      var t = normAr(v);
      if (cnd.op === 'empty') return !t;
      if (cnd.op === 'nempty') return !!t;
      if (cnd.op === 'in' || cnd.op === 'nin') { var hit = (cnd.v || []).some(function (w) { return normAr(w) === t; }); return cnd.op === 'in' ? hit : !hit; }
      var ws = kwList(cnd.v);
      if (!ws.length) return true;
      if (cnd.op === 'eq') return ws.some(function (w) { return w === t; });
      var any = ws.some(function (w) { return t.indexOf(w) >= 0; });
      return cnd.op === 'nhas' ? !any : any;
    }
    function fieldVals(src, f, from, to) {   // القيم الموجودة فعلاً في الحقل (لخيار «واحد من»)
      var fd = SRC[src].f[f], seen = {}, out = [];
      SRC[src].rows().forEach(function (r) { if (from && (r.d < from || r.d > to)) return; var v = String(fd[2](r) || ''); if (v && !seen[v]) { seen[v] = 1; out.push(v); } });
      return out.sort(function (a, b) { return a.localeCompare(b, 'ar'); });
    }
    function colType(fd) { return fd[1] === 'date' ? 'text' : fd[1]; }
    function fmtKey(fd, v) { return fd[3] === 'month' && /^\d{4}-\d{2}$/.test(v) ? monthLabel(v) : v; }
    function runFree(def, p) {
      var src = SRC[def.src];
      if (!src) return emptyRes('اختر مصدر البيانات');
      var conds = (def.conds || []).filter(function (c) { return c.f && c.op; });
      var rows = src.rows().filter(function (r) { return r.d >= p.from && r.d <= p.to && conds.every(function (c) { return condPass(c, r, def.src); }); });
      var F_ = src.f, res;
      if (def.mode === 'sum') {
        var rf = F_[def.row] ? def.row : 'mon', cf = def.col && F_[def.col] && def.col !== rf ? def.col : '';
        var meas = (def.meas || []).filter(function (k) { return k === '@n' || (F_[k] && NUMT[F_[k][1]]); });
        if (!meas.length) meas = ['@n'];
        var mName = function (k) { return k === '@n' ? 'العدد' : F_[k][0]; }, mVal = function (k, r) { return k === '@n' ? 1 : Number(F_[k][2](r)) || 0; };
        var g = {}, colKeys = {};
        rows.forEach(function (r) {
          var k = String(F_[rf][2](r) || '—'), o = g[k] || (g[k] = { name: fmtKey(F_[rf], k), _s: k });
          if (cf) { var ck = String(F_[cf][2](r) || '—'); colKeys[ck] = (colKeys[ck] || 0) + Math.abs(mVal(meas[0], r)); o['c_' + ck] = (o['c_' + ck] || 0) + mVal(meas[0], r); o.tot = (o.tot || 0) + mVal(meas[0], r); }
          else meas.forEach(function (mk) { o[mk] = (o[mk] || 0) + mVal(mk, r); });
        });
        var list = Object.keys(g).map(function (k) { return g[k]; });
        var sk = def.sort || (F_[rf][1] === 'date' || F_[rf][3] === 'month' ? '_name' : '_val');
        var firstK = cf ? 'tot' : meas[0];
        list.sort(sk === '_name' ? function (a, b) { return String(a._s).localeCompare(String(b._s), 'ar'); } : function (a, b) { return (b[firstK] || 0) - (a[firstK] || 0); });
        var cols = [C('name', F_[rf][0])];
        if (cf) {
          var ck2 = Object.keys(colKeys).sort(function (a, b) { return F_[cf][1] === 'date' || F_[cf][3] === 'month' ? a.localeCompare(b) : colKeys[b] - colKeys[a]; }).slice(0, 24);
          ck2.forEach(function (k) { cols.push(C('c_' + k, fmtKey(F_[cf], k), meas[0] === '@n' ? 'int' : colType(F_[meas[0]]))); });
          cols.push(C('tot', 'الإجمالي', meas[0] === '@n' ? 'int' : colType(F_[meas[0]])));
        } else meas.forEach(function (mk) { cols.push(C(mk, mName(mk), mk === '@n' ? 'int' : colType(F_[mk]))); });
        var total = sumRow(list, cols);
        if (def.top) list = list.slice(0, Number(def.top));
        res = { cols: cols, rows: list, total: total };
        if (def.chart && list.length > 1) res.chart = { type: def.chart, x: 'name', y: [cols[1].k], yl: [cols[1].l], limit: def.chart === 'hbar' ? 20 : undefined };
        res.note = fk(rows.length) + ' سطر من «' + src.name + '»' + (def.top && Object.keys(g).length > def.top ? ' · يظهر أعلى ' + def.top + ' من ' + Object.keys(g).length : '');
      } else {
        var cs = (def.cols || []).filter(function (k) { return F_[k]; });
        if (!cs.length) cs = src.def.slice();
        var srt = def.sort && F_[def.sort] ? def.sort : 'd', dir = def.dir === 'asc' ? 1 : def.dir === 'desc' ? -1 : (srt === 'd' ? 1 : -1);
        var gf = def.group && F_[def.group] ? def.group : '';
        var keyed = rows.map(function (r) { var o = { _r: r }; cs.forEach(function (k) { o[k] = F_[k][2](r); }); if (gf) o._g = String(F_[gf][2](r) || '—'); o._s = F_[srt][2](r); return o; });
        var cmp = function (a, b) { var x = a._s, y = b._s; if (NUMT[F_[srt][1]]) { x = Number(x) || 0; y = Number(y) || 0; } return (x < y ? -1 : x > y ? 1 : 0) * dir; };
        var colsD = cs.map(function (k) { return C(k, F_[k][0], colType(F_[k])); });
        var numK = cs.filter(function (k) { return NUMT[F_[k][1]] && k !== 'price'; });
        var out = [];
        if (gf) {
          var groups = {};
          keyed.forEach(function (o) { (groups[o._g] = groups[o._g] || []).push(o); });
          Object.keys(groups).sort(function (a, b) { return a.localeCompare(b, 'ar'); }).forEach(function (gk) {
            var arr = groups[gk].sort(cmp);
            var head = { _b: true, _hl: true }; head[cs[0]] = F_[gf][0] + ': ' + fmtKey(F_[gf], gk) + ' (' + arr.length + ')';
            numK.forEach(function (k) { head[k] = arr.reduce(function (s, o) { return s + (Number(o[k]) || 0); }, 0); });
            out.push(head);
            if (!def.collapse) arr.forEach(function (o) { out.push(o); });
          });
        } else out = keyed.sort(cmp);
        out.forEach(function (o) { cs.forEach(function (k) { if (F_[k][3] === 'month' && o[k]) o[k] = fmtKey(F_[k], o[k]); }); });
        var tot = {}; numK.forEach(function (k) { tot[k] = rows.reduce(function (s, r) { return s + (Number(F_[k][2](r)) || 0); }, 0); });
        tot.name = 'الإجمالي (' + fk(rows.length) + ' سطر)';
        if (numK.indexOf(cs[0]) < 0) tot[cs[0]] = tot.name;
        res = { cols: colsD, rows: out, total: numK.length ? tot : null };
      }
      if (!rows.length) res.empty = 'لا توجد بيانات مطابقة في هذه الفترة. جرّب فترة أطول أو خفّف الشروط';
      return res;
    }
    function condText(c, src) {
      if (c.f === '@acc') return (c.op === 'nin' ? 'الحساب ليس تحت: ' : 'الحساب تحت: ') + codesText(c.v);
      var fd = SRC[src] && SRC[src].f[c.f]; if (!fd) return '';
      var op = (OPS_T.concat(OPS_N).filter(function (o) { return o[0] === c.op; })[0] || [0, ''])[1];
      var v = Array.isArray(c.v) ? c.v.join('، ') : (c.v === undefined ? '' : c.v);
      return fd[0] + ' ' + op + (c.op === 'empty' || c.op === 'nempty' || c.op === 'ne0' ? '' : ' «' + v + '»');
    }
    function customDesc(def) {
      if (def.kind === 'formula') return 'بنود ومعادلات';
      if (def.kind === 'pair') return 'حساب مقابل حساب' + ((def.b || []).length ? '' : ' (كل الحسابات المقابلة)') + (def.kw ? ' · كلمات في البيان' : '');
      if (def.kind === 'free') return (def.mode === 'sum' ? 'ملخص' : 'قائمة تفصيلية') + ' من ' + ((SRC[def.src] || {}).name || '');
      return (DS[def.ds] || {}).name || '';
    }
