    /* ===================== تصنيفات الأصناف ومجموعاتها =====================
       التصنيف: شجرة سراج (الشركة ← الفئة) مربوطة بكل صنف. المجموعة: اسم + تصنيفات و/أو أصناف تختارها في الإعدادات،
       وتظهر معها مجموعات الأصناف المعرّفة في سراج إن كان لها أصناف. */
    function iclOf(item) { return (T().item[item] || {}).cl || ''; }
    function iclAnc(cid) {
      var c = F.cache.iclAnc || (F.cache.iclAnc = {});
      if (c[cid]) return c[cid];
      var out = [], x = T().icl[cid], g = 0;
      while (x && g++ < 10) { out.push(x.id); x = x.parent ? T().icl[x.parent] : null; }
      return (c[cid] = out);
    }
    function iclName(cid) { var c = T().icl[cid]; return c ? c.name : (cid ? 'تصنيف ' + cid : 'بدون تصنيف'); }
    function iclTop(item) { var a = iclAnc(iclOf(item)); return a.length ? a[a.length - 1] : ''; }
    function iclMatch(list, item) { var an = iclAnc(iclOf(item)); return list.some(function (x) { return an.indexOf(String(x).replace(/^@/, '')) >= 0; }); }
    // شجرة التصنيفات مرتبة (الأب ثم أبناؤه) مع عدد الأصناف تحت كل تصنيف
    function iclTree() {
      if (F.cache.iclTree) return F.cache.iclTree;
      var Tt = T(), kids = {}, cnt = {};
      Object.keys(Tt.icl).forEach(function (id) { var p0 = Tt.icl[id].parent && Tt.icl[Tt.icl[id].parent] ? Tt.icl[id].parent : ''; (kids[p0] = kids[p0] || []).push(id); });
      Object.keys(Tt.item).forEach(function (it) { iclAnc(iclOf(it)).forEach(function (c) { cnt[c] = (cnt[c] || 0) + 1; }); });
      var out = [], walk = function (p0, lvl) { (kids[p0] || []).sort(function (a, b) { return String(Tt.icl[a].code || Tt.icl[a].name).localeCompare(String(Tt.icl[b].code || Tt.icl[b].name)); }).forEach(function (id) { var c = Tt.icl[id]; out.push({ id: id, name: c.name, code: c.code, lvl: lvl, n: cnt[id] || 0, leaf: !(kids[id] || []).length }); walk(id, lvl + 1); }); };
      walk('', 0);
      return (F.cache.iclTree = out);
    }
    function igUser() {
      var l = F.config && Array.isArray(F.config.igroups) ? F.config.igroups : null;
      if (!l) { try { l = JSON.parse(localStorage.getItem('rk.finIgroups') || 'null'); } catch (e) { l = null; } }
      return (l || []).filter(function (g) { return g && g.id && g.name; });
    }
    // كل مجموعات الأصناف: المعرّفة في الإعدادات ثم مجموعات سراج التي لها أصناف
    function igrpList() {
      if (F.cache.igl) return F.cache.igl;
      var Tt = T(), out = igUser().map(function (g) { return { id: g.id, name: g.name, sub: [(g.cls || []).length ? (g.cls || []).map(iclName).join('، ') : '', (g.items || []).length ? (g.items || []).length + ' صنف' : ''].filter(String).join(' · '), cls: g.cls || [], items: g.items || [] }; });
      var sg = {}; Object.keys(Tt.item).forEach(function (it) { String(Tt.item[it].ig || '').split(',').filter(String).forEach(function (g) { (sg[g] = sg[g] || []).push(it); }); });
      Object.keys(sg).forEach(function (g) { var x = Tt.igr[g] || Tt.igr[(Tt.item[sg[g][0]].br ? Tt.item[sg[g][0]].br + '-' : '') + g]; out.push({ id: 's:' + g, name: (x ? x.name : 'مجموعة ' + g) + ' (سراج)', sub: sg[g].length + ' صنف', cls: [], items: sg[g] }); });
      return (F.cache.igl = out);
    }
    function igrpName(id) { var g = igrpList().filter(function (x) { return x.id === id; })[0]; return g ? g.name : id; }
    function igrpIn(item, gid) { var g = igrpList().filter(function (x) { return x.id === gid; })[0]; if (!g) return false; if (g.items.indexOf(item) >= 0) return true; var an = iclAnc(iclOf(item)); return g.cls.some(function (c) { return an.indexOf(c) >= 0; }); }
    function igrpMatch(list, item) { return list.some(function (x) { return igrpIn(item, String(x).replace(/^@/, '')); }); }
    function igrpOf(item) { var l = igrpList(); for (var i = 0; i < l.length; i++) if (igrpIn(item, l[i].id)) return l[i].id; return ''; }

    /* ---------- إعدادات مجموعات الأصناف ---------- */
    function igDraft() { if (!F.igDraft) F.igDraft = JSON.parse(JSON.stringify(igUser())); return F.igDraft; }
    function igSettingsHTML() {
      var d = igDraft(), Tt = T(), nCl = Object.keys(Tt.icl).length;
      var h = '<div class="card"><h2>مجموعات الأصناف</h2><p class="small muted" style="margin:0 0 10px">اجمع الأصناف في مجموعات بالاسم الذي تريده: اختر تصنيفاً أو أكثر من شجرة تصنيفات سراج (فتدخل كل أصنافه)، و/أو أصنافاً بعينها. تظهر في التصفية «مجموعات الأصناف» في كل التقارير، وفي تقارير الأصناف.</p>' +
        (nCl ? '' : '<div class="msg info">لم تصل تصنيفات الأصناف من سراج بعد. ثبّت الوكيل 2.3.0 لترسل التصنيفات، وحتى ذلك الحين يمكنك اختيار الأصناف بعينها.</div>');
      if (!d.length) h += '<div class="empty" style="margin:0 0 10px">لا توجد مجموعات بعد.' + (nCl ? ' اضغط «إنشاء من تصنيفات سراج» لتُنشأ مجموعة لكل تصنيف رئيسي (مثل الشركات).' : '') + '</div>';
      h += '<div class="cg-list">' + d.map(function (g, i) {
        var cls = (g.cls || []).map(function (c, j) { return '<span class="col-pill">' + esc(iclName(c)) + '<button type="button" data-igrm="' + i + '|cls|' + j + '" aria-label="إزالة">×</button></span>'; }).join('');
        var its = (g.items || []).map(function (it, j) { return '<span class="col-pill">' + esc(itemName(it)) + '<button type="button" data-igrm="' + i + '|items|' + j + '" aria-label="إزالة">×</button></span>'; }).join('');
        return '<div class="cg-item"><div class="cg-top"><span class="cg-ord">' + (i + 1) + '</span><input class="input cg-name" data-igname="' + i + '" value="' + esc(g.name) + '" placeholder="اسم المجموعة"><button class="btn sm ghost danger" data-igdel="' + i + '">حذف</button></div>' +
          '<div class="st-pills cg-accs">' + cls + its + (nCl ? '<button class="btn sm" data-igcls="' + i + '">+ تصنيفات</button>' : '') + '<button class="btn sm ghost" data-igit="' + i + '">+ أصناف</button></div></div>';
      }).join('') + '</div>';
      h += '<div class="row" style="margin-top:12px;flex-wrap:wrap;gap:8px"><button class="btn" data-igadd>+ مجموعة جديدة</button>' + (nCl ? '<button class="btn ghost" data-igauto>إنشاء من تصنيفات سراج</button>' : '') + '<span class="grow small muted">' + (F.igDirty ? 'لديك تعديلات غير محفوظة' : '') + '</span>' +
        (F.igDirty ? '<button class="btn ghost" data-igundo>تراجع</button>' : '') + '<button class="btn primary" data-igsave' + (canEdit() ? '' : ' disabled') + '>حفظ</button></div></div>';
      var sg = igrpList().filter(function (g) { return /^s:/.test(g.id); });
      if (sg.length) h += '<div class="card"><h3>مجموعات الأصناف في سراج</h3><p class="small muted" style="margin:0">' + sg.map(function (g) { return esc(g.name) + ' (' + esc(g.sub) + ')'; }).join(' · ') + '</p></div>';
      return h;
    }
    function bindIgSettings(m) {
      var d = igDraft(), dirty = function () { F.igDirty = true; };
      qa('[data-igname]', m).forEach(function (el) { el.oninput = function () { d[Number(el.dataset.igname)].name = el.value; dirty(); }; });
      qa('[data-igdel]', m).forEach(function (b) { b.onclick = function () { d.splice(Number(b.dataset.igdel), 1); dirty(); A.render(); }; });
      qa('[data-igrm]', m).forEach(function (b) { b.onclick = function () { var x = b.dataset.igrm.split('|'); d[Number(x[0])][x[1]].splice(Number(x[2]), 1); dirty(); A.render(); }; });
      qa('[data-igcls]', m).forEach(function (b) { b.onclick = function () { var g = d[Number(b.dataset.igcls)]; pickMulti({ title: 'تصنيفات «' + (g.name || 'المجموعة') + '»', hint: 'اختيار تصنيف رئيسي يُدخل كل التصنيفات والأصناف تحته', options: iclTree().map(function (c) { return { id: c.id, name: c.name, sub: (c.code || '') + ' · ' + c.n + ' صنف', lvl: c.lvl }; }), value: (g.cls || []).slice() }).then(function (v) { if (!v) return; g.cls = v; if (!g.name && v.length === 1) g.name = iclName(v[0]); dirty(); A.render(); }); }; });
      qa('[data-igit]', m).forEach(function (b) { b.onclick = function () { var g = d[Number(b.dataset.igit)], Tt = T(); pickMulti({ title: 'أصناف «' + (g.name || 'المجموعة') + '»', options: Object.keys(Tt.item).map(function (id) { return { id: id, name: itemName(id), sub: String(Tt.item[id].code || '') + (iclOf(id) ? ' · ' + iclName(iclOf(id)) : '') }; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); }), value: (g.items || []).slice() }).then(function (v) { if (!v) return; g.items = v; dirty(); A.render(); }); }; });
      q('[data-igadd]', m).onclick = function () { d.push({ id: 'i' + Date.now().toString(36), name: '', cls: [], items: [] }); dirty(); A.render(); };
      var au = q('[data-igauto]', m); if (au) au.onclick = function () { var have = {}; d.forEach(function (g) { (g.cls || []).forEach(function (c) { have[c] = 1; }); }); var n = 0; iclTree().filter(function (c) { return c.lvl === 0 && c.n; }).forEach(function (c) { if (have[c.id]) return; d.push({ id: 'i' + Date.now().toString(36) + n, name: c.name, cls: [c.id], items: [] }); n++; }); if (!n) { toast('لا توجد تصنيفات رئيسية جديدة'); return; } dirty(); toast('أُضيفت ' + n + ' مجموعة، راجعها ثم احفظ'); A.render(); };
      var un = q('[data-igundo]', m); if (un) un.onclick = function () { F.igDraft = null; F.igDirty = false; A.render(); };
      q('[data-igsave]', m).onclick = function () {
        if (d.some(function (g) { return !String(g.name || '').trim() || !((g.cls || []).length || (g.items || []).length); })) { toast('لكل مجموعة اسم وتصنيف أو صنف واحد على الأقل', true); return; }
        var val = d.map(function (g) { return { id: g.id, name: String(g.name).trim().slice(0, 60), cls: (g.cls || []).slice(0, 100), items: (g.items || []).slice(0, 500) }; }), b = this; busy(b, true);
        saveConfigKey('igroups', val.length ? val : null, 'rk.finIgroups').then(function (local) { F.igDraft = null; F.igDirty = false; resetCache(); toast(local ? 'حُفظت على هذا الجهاز فقط حتى يُحدَّث الخادم' : 'حُفظت مجموعات الأصناف'); A.render(); }).catch(function (e) { busy(b, false); toast(e.message, true); });
      };
    }

    /* ---------- تقارير التصنيفات والمجموعات ---------- */
    var ITM_F = ['item', 'icl', 'igrp', 'cust', 'st', 'ag', 'cat', 'xitem'];
    function iclLevelKey(item, lvl) { var a = iclAnc(iclOf(item)).slice().reverse(); return a.length ? a[Math.min(lvl, a.length - 1)] : ''; }
    R.item_class_sales = { cat: 'items', name: 'المبيعات حسب تصنيف الأصناف', desc: 'شجرة التصنيفات (الشركة ثم الفئة): الكمية والصافي والربح والهامش والحصة وعدد الأصناف والعملاء لكل تصنيف', params: ['period', 'flt'], fdims: ITM_F,
      run: function (p) {
        if (!Object.keys(T().icl).length) return emptyR('لم تصل تصنيفات الأصناف من سراج بعد. ثبّت الوكيل 2.3.0 لترسلها.');
        var g = {};
        facts('s', p.from, p.to, p.flt).forEach(function (x) {
          var an = iclAnc(iclOf(x.l.item)); if (!an.length) an = ['~'];
          an.forEach(function (c) { var r = g[c] || (g[c] = { net: 0, profit: 0, qty: 0, it: {}, cu: {} }); r.net += x.s * x.val; r.profit += x.s * x.profit; r.qty += x.s * x.qty; if (x.s > 0) { r.it[x.l.item] = 1; r.cu[x.v.ck] = 1; } });
        });
        var tops = iclTree().filter(function (c) { return c.lvl === 0; }), tn = tops.reduce(function (s0, c) { return s0 + ((g[c.id] || {}).net || 0); }, 0) + ((g['~'] || {}).net || 0);
        var rows = iclTree().filter(function (c) { return g[c.id]; }).map(function (c) { var r = g[c.id]; return { name: c.name, code: c.code, qty: r.qty, net: r.net, profit: r.profit, margin: pct(r.profit, r.net), share: pct(r.net, tn), items: Object.keys(r.it).length, cust: Object.keys(r.cu).length, _lvl: c.lvl, _b: c.lvl === 0 }; });
        if (g['~']) { var r0 = g['~']; rows.push({ name: 'بدون تصنيف', qty: r0.qty, net: r0.net, profit: r0.profit, margin: pct(r0.profit, r0.net), share: pct(r0.net, tn), items: Object.keys(r0.it).length, cust: Object.keys(r0.cu).length, _b: true }); }
        var cols = [C('code', 'الرمز'), C('name', 'التصنيف'), C('qty', 'صافي الكمية', 'qty'), C('net', 'صافي المبيعات', 'money'), C('share', 'الحصة', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('items', 'الأصناف المباعة', 'int'), C('cust', 'العملاء', 'int')];
        var top = rows.filter(function (r) { return r._b; }), t = { name: 'الإجمالي', _b: true, qty: sum(top, 'qty'), net: sum(top, 'net'), profit: sum(top, 'profit') }; t.margin = pct(t.profit, t.net); t.share = 100;
        return withNote({ cols: cols, rows: rows, total: t, chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'], rowsOverride: top.map(function (r) { return { name: r.name, net: r.net }; }) } }, p);
      } };
    R.item_class_month = { cat: 'items', name: 'تصنيفات الأصناف شهرياً', desc: 'جدول: صف لكل تصنيف (الشركة أو الفئة) وعمود لكل شهر، بالقيمة أو الربح أو الكمية', params: ['period', 'rmeas', 'flt'], fdims: ITM_F,
      sel: [['icll', 'مستوى التصنيف', [['0', 'الشركة (التصنيف الرئيسي)'], ['1', 'الفئة (التصنيف الفرعي)']]]],
      run: function (p) { var lv = Number(p.icll || 0); var r = repPivot(p, function (x) { return iclLevelKey(x.l.item, lv) || '~'; }, function (x) { var k = iclLevelKey(x.l.item, lv); return k ? iclName(k) : 'بدون تصنيف'; }, function (x) { return x.d.slice(0, 7); }, function (x) { return monthLabel(x.d.slice(0, 7)); }, p.rmeas, function (a, b) { return a.k < b.k ? -1 : 1; }); r.cols[0].l = 'التصنيف'; return withNote(r, p); } };
    R.item_class_cust = { cat: 'items', name: 'العملاء × تصنيفات الأصناف', desc: 'جدول: صف لكل عميل وعمود لكل تصنيف (الشركة أو الفئة): ماذا يشتري كل عميل من كل شركة', params: ['period', 'rmeas', 'top', 'flt'], fdims: ITM_F,
      sel: [['icll', 'مستوى التصنيف', [['0', 'الشركة (التصنيف الرئيسي)'], ['1', 'الفئة (التصنيف الفرعي)']]]],
      run: function (p) { var lv = Number(p.icll || 0); var r = repPivot(p, function (x) { return x.v.ck; }, function (x) { return x.v.name; }, function (x) { return iclLevelKey(x.l.item, lv) || '~'; }, function (x) { var k = iclLevelKey(x.l.item, lv); return k ? iclName(k) : 'بدون تصنيف'; }, p.rmeas); r.cols[0].l = 'العميل'; return withNote(topN(r, p), p); } };
    R.item_class_rep = { cat: 'items', name: 'المناديب × تصنيفات الأصناف', desc: 'جدول: صف لكل مندوب وعمود لكل تصنيف: ما يبيعه كل مندوب من كل شركة أو فئة', params: ['period', 'rmeas', 'flt'], fdims: ITM_F,
      sel: [['icll', 'مستوى التصنيف', [['0', 'الشركة (التصنيف الرئيسي)'], ['1', 'الفئة (التصنيف الفرعي)']]]],
      run: function (p) { var lv = Number(p.icll || 0); var r = repPivot(p, function (x) { return x.v.ag || '0'; }, function (x) { return repName(x.v.ag || '0'); }, function (x) { return iclLevelKey(x.l.item, lv) || '~'; }, function (x) { var k = iclLevelKey(x.l.item, lv); return k ? iclName(k) : 'بدون تصنيف'; }, p.rmeas); r.cols[0].l = 'المندوب'; return withNote(r, p); } };
    R.item_groups = { cat: 'items', name: 'ملخص مجموعات الأصناف', desc: 'لكل مجموعة أصناف (من الإعدادات وسراج): الكمية والصافي والربح والهامش والحصة والعملاء والفترة السابقة', params: ['period', 'flt'], fdims: ITM_F,
      run: function (p) {
        var gl = igrpList(); if (!gl.length) return emptyR('لا توجد مجموعات أصناف بعد. عرّفها من الإعدادات ← مجموعات الأصناف.');
        var pr = prevRange(p.from, p.to, p.preset), agg = function (from, to) { var g = {}; facts('s', from, to, p.flt).forEach(function (x) { gl.forEach(function (gg) { if (!igrpIn(x.l.item, gg.id)) return; var r = g[gg.id] || (g[gg.id] = { net: 0, profit: 0, qty: 0, cu: {} }); r.net += x.s * x.val; r.profit += x.s * x.profit; r.qty += x.s * x.qty; if (x.s > 0) r.cu[x.v.ck] = 1; }); }); return g; };
        var a = agg(p.from, p.to), b = agg(pr[0], pr[1]), S0 = salesStats(p.from, p.to, p.flt);
        var rows = gl.map(function (g) { var r = a[g.id] || { net: 0, profit: 0, qty: 0, cu: {} }, o = (b[g.id] || {}).net || 0; return { name: g.name, qty: r.qty, net: r.net, share: pct(r.net, S0.net), profit: r.profit, margin: pct(r.profit, r.net), cust: Object.keys(r.cu).length, pnet: o, chp: o ? (r.net - o) / Math.abs(o) * 100 : '' }; });
        var cols = [C('name', 'المجموعة'), C('qty', 'صافي الكمية', 'qty'), C('net', 'صافي المبيعات', 'money'), C('share', 'من إجمالي المبيعات', 'pct'), C('profit', 'مجمل الربح', 'money'), C('margin', 'الهامش', 'pct'), C('cust', 'العملاء', 'int'), C('pnet', 'الفترة السابقة', 'money'), C('chp', 'التغير %', 'pct')];
        return withNote({ cols: cols, rows: rows, note: 'قد يقع الصنف في أكثر من مجموعة، لذلك لا يُجمع الإجمالي.', chart: { type: 'hbar', x: 'name', y: ['net'], yl: ['صافي المبيعات'] } }, p);
      } };

    /* ---------- تجميع صفوف الأصناف ---------- */
    var IGRP_MODES = [['none', 'بدون تجميع'], ['top', 'حسب الشركة (التصنيف الرئيسي)'], ['cl', 'حسب الفئة'], ['igrp', 'حسب مجموعات الأصناف']];
    function itemNameMap() { if (F.cache.inm) return F.cache.inm; var m = {}, Tt = T(); Object.keys(Tt.item).forEach(function (id) { var n = itemName(id); if (!m[n]) m[n] = id; }); return (F.cache.inm = m); }
    function itemGroupBy(res, flt, mode) {
      var f = parseFilter(flt) || {};
      if (!res || res.empty || !res.rows || !res.rows.length || res._grouped || res.rows.some(function (r) { return r._b || r._lvl; })) return res;
      var nm = itemNameMap(), textCols = res.cols.filter(function (c) { return !isNum(c); }), icol = null, best = 0;
      var key = function (r, c) { return r._item || nm[plain(r[c.k]).trim().replace(/ \(.*\)$/, '')] || nm[plain(r[c.k]).trim()]; };
      textCols.slice(0, 3).forEach(function (c) { var n = res.rows.filter(function (r) { return key(r, c); }).length; if (n > best) { best = n; icol = c; } });
      if (!icol || best < res.rows.length * 0.6) return res;
      res._itemRows = true;
      var kind = f.icl && f.icl.length > 1 ? 'icl' : f.igrp && f.igrp.length > 1 ? 'igrp' : mode && mode !== 'none' ? mode : '';
      if (kind === 'igrp' && !(f.igrp && f.igrp.length > 1) && !igrpList().length) kind = '';
      if ((kind === 'top' || kind === 'cl') && !Object.keys(T().icl).length) kind = '';
      if (!kind) return res;
      var sel = (f[kind] || []).map(function (x) { return String(x).replace(/^@/, ''); });
      var keyOf = kind === 'icl' && sel.length > 1 ? function (it) { var an = iclAnc(iclOf(it)), bi = null, bd = 1e9; sel.forEach(function (id) { var d = an.indexOf(id); if (d >= 0 && d < bd) { bd = d; bi = id; } }); return bi; }
        : kind === 'igrp' && sel.length > 1 ? function (it) { for (var i = 0; i < sel.length; i++) if (igrpIn(it, sel[i])) return sel[i]; return null; }
        : kind === 'top' ? function (it) { return iclTop(it) || null; } : kind === 'cl' ? function (it) { return iclOf(it) || null; } : function (it) { return igrpOf(it) || null; };
      var label = kind === 'igrp' ? igrpName : iclName;
      var g = {}, keys = [], other = [];
      res.rows.forEach(function (r) { var k = keyOf(key(r, icol)); if (!k) { other.push(r); return; } if (!g[k]) { g[k] = []; keys.push(k); } g[k].push(r); });
      var nums = res.cols.filter(function (c) { return isNum(c) && c.t !== 'pct' && !GRP_NOSUM.test(c.k); }), main = nums[0] && nums[0].k;
      if (main) keys.sort(function (a, b) { var s0 = function (k) { return g[k].reduce(function (s1, r) { return s1 + (Number(r[main]) || 0); }, 0); }; return s0(b) - s0(a); });
      var head = function (name, list, gi) { var h = { _b: true, _hl: true, _g: gi, _gh: 1 }; h[icol.k] = name + ' (' + list.length + ')'; nums.forEach(function (c) { h[c.k] = list.reduce(function (s1, r) { return s1 + (Number(r[c.k]) || 0); }, 0); }); if ('margin' in (list[0] || {}) && 'profit' in h && 'net' in h) h.margin = pct(h.profit, h.net); if ('share' in (list[0] || {})) h.share = list.reduce(function (s1, r) { return s1 + (Number(r.share) || 0); }, 0); return h; };
      var rows = [];
      keys.forEach(function (k, i) { rows.push(head(label(k), g[k], i)); g[k].forEach(function (r) { rows.push(Object.assign({}, r, { _lvl: 1, _g: i })); }); });
      if (other.length) { rows.push(head('أخرى', other, keys.length)); other.forEach(function (r) { rows.push(Object.assign({}, r, { _lvl: 1, _g: keys.length })); }); }
      var out = Object.assign({}, res, { rows: rows, _lvlc: res.cols.indexOf(icol), _grouped: 'item:' + kind, _itemRows: true });
      if (res.chart && !res.chart.rowsOverride) { var hs = rows.filter(function (r) { return r._gh; }).map(function (r) { var o = Object.assign({}, r); delete o._b; delete o._hl; if (res.chart.x && res.chart.x !== icol.k) o[res.chart.x] = r[icol.k]; return o; }); out.chart = Object.assign({}, res.chart, { rowsOverride: hs, limit: Math.max(hs.length, 1) }); }
      out.note = (res.note ? res.note + ' · ' : '') + 'الأصناف مجمّعة ' + (kind === 'icl' ? 'حسب التصنيفات المحددة في التصفية' : kind === 'igrp' && sel.length > 1 ? 'حسب المجموعات المحددة في التصفية' : IGRP_MODES.filter(function (m0) { return m0[0] === kind; })[0][1]);
      return out;
    }
    function igrpBarHTML(res, p) {
      if (/^item:(icl|igrp)$/.test(res._grouped || '') && (parseFilter(p.flt) || {})[res._grouped.slice(5)]) return '<div class="grp-bar"><span class="grp-t">تجميع الأصناف:</span><span class="small muted">حسب ما حددته في التصفية</span></div>';
      var cur = p.igx || 'none', hasCl = Object.keys(T().icl).length, hasG = igrpList().length;
      return '<div class="grp-bar"><span class="grp-t">تجميع الأصناف:</span>' + IGRP_MODES.filter(function (m0) { return m0[0] === 'none' || (m0[0] === 'igrp' ? hasG : hasCl); }).map(function (m0) { return '<button class="chip' + (cur === m0[0] ? ' on' : '') + '" data-igx="' + m0[0] + '">' + m0[1] + '</button>'; }).join('') + '</div>';
    }
    function bindIgrpBar(m, p, save) { qa('[data-igx]', m).forEach(function (b) { b.onclick = function () { p.igx = b.dataset.igx; save(); A.render(); }; }); }

    /* ---------- المجموعات المحددة في التصفية كأعمدة مقارنة ---------- */
    // عند اختيار أكثر من مجموعة/حساب عملاء أو تصنيف/مجموعة أصناف: يمكن عرض كل واحد في عمود (في أي تقرير يقبل التصفية)
    function splitInfo(flt) {
      var f = parseFilter(flt); if (!f) return null;
      var defs = [['cgrp', 'مجموعات العملاء', cgName], ['cacc', 'حسابات العملاء', function (id) { var a = acc(id); return a ? a.name : id; }], ['igrp', 'مجموعات الأصناف', igrpName], ['icl', 'تصنيفات الأصناف', iclName]];
      for (var i = 0; i < defs.length; i++) { var v = f[defs[i][0]]; if (v && v.length > 1) return { key: defs[i][0], title: defs[i][1], name: defs[i][2], vals: v.map(function (x) { return String(x).replace(/^@/, ''); }) }; }
      return null;
    }
    function splitBarHTML(res, p) {
      var sp = splitInfo(p.flt); if (!sp) return '';
      var cur = p.gsplit === 'cols' ? 'cols' : 'one';
      return '<div class="grp-def split-bar"><span>' + esc(sp.title) + ' المحددة (' + sp.vals.length + '):</span><span class="grp-def-act"><button class="chip' + (cur === 'one' ? ' on' : '') + '" data-gsplit="one">في جدول واحد' + (res._grouped ? ' (مجمّعة)' : '') + '</button><button class="chip' + (cur === 'cols' ? ' on' : '') + '" data-gsplit="cols">مقارنة: عمود لكل واحدة</button></span></div>';
    }
    function bindSplitBar(m, p, save) { qa('[data-gsplit]', m).forEach(function (b) { b.onclick = function () { p.gsplit = b.dataset.gsplit; save(); A.render(); }; }); }
