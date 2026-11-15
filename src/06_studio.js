    /* ===================== إنشاء تقرير (الاستوديو) =====================
       شاشة واحدة: تختار نوع التقرير، ثم تملأ خطوات مرقّمة، والمعاينة تتحدّث بجانبك مباشرة. */
    var ST_TYPES = [
      ['pair', 'حساب مقابل حساب', 'حركة حساب مع حساب آخر محدد، ويمكن حصرها بكلمات موجودة في البيان. مثال: الصندوق مقابل المصروفات، أو العملاء مقابل البنك.', '<path d="M4 7h13l-3-3M20 17H7l3 3"/>'],
      ['free', 'تقرير حر من الصفر', 'اختر مصدر البيانات (القيود أو الفواتير أو الأصناف)، ثم الأعمدة والشروط والتجميع كما تريد.', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10"/>'],
      ['ready', 'تخصيص تقرير جاهز', 'اختر أياً من التقارير الجاهزة، وعدّل فترته وتصفيته، وأضف شروطاً على أعمدته، وأخفِ ما لا تحتاج، ثم احفظه باسمك.', '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'],
      ['formula', 'بنود ومعادلات', 'أسطر تختار لكل منها ما يُحسب (مبيعات، رصيد حساب، تحصيل…) وتربط بينها بـ + − × ÷، بعمود لكل شهر أو أسبوع.', '<path d="M5 7h14M5 12h8M5 17h11"/><path d="M17 14l4 4M21 14l-4 4"/>']
    ];
    var ST_TPL = [
      ['pair', 'حساب مقابل حساب', 'اختر الحسابين وابدأ', function () { return { kind: 'pair', a: [], b: [], kw: '', kwm: 'any', kwx: '', side: '', view: 'lines' }; }],
      ['kw', 'حركات فيها كلمة في البيان', 'مثل: إيجار، كهرباء، اسم شخص', function () { return { kind: 'free', src: 'jl', mode: 'list', cols: ['d', 'no', 'type', 'acc', 'desc', 'dr', 'cr'], conds: [{ f: 'desc', op: 'has', v: '' }] }; }],
      ['exp', 'حساب وفروعه شهرياً', 'مصروفات أو إيرادات حسب الحساب، عمود لكل شهر', function () { return { kind: 'free', src: 'jl', mode: 'sum', row: 'acc', col: 'mon', meas: ['net'], conds: [{ f: '@acc', op: 'in', v: [] }] }; }],
      ['items', 'مبيعات الأصناف لكل مندوب', 'قيمة المبيعات: صف لكل صنف وعمود لكل مندوب', function () { return { kind: 'free', src: 'invl', mode: 'sum', row: 'item', col: 'rep', meas: ['value'], conds: [{ f: 'cls', op: 'in', v: ['مبيع', 'مرتجع مبيع'] }], top: 50 }; }],
      ['big', 'أكبر فواتير المبيع', 'الفواتير مرتبة من الأكبر', function () { return { kind: 'free', src: 'inv', mode: 'list', cols: ['d', 'no', 'cust', 'rep', 'net', 'profit'], conds: [{ f: 'cls', op: 'in', v: ['مبيع'] }], sort: 'net', dir: 'desc' }; }],
      ['formula', 'مؤشرات شهرية بالمعادلات', 'المبيعات والربح وهامش الربح لكل شهر', function () { return { kind: 'formula', cols: 'month', chart: '', rows: [{ name: 'صافي المبيعات', terms: [{ k: 'مبيعات' }], fmt: 'money' }, { name: 'مجمل الربح', terms: [{ k: 'ربح' }], fmt: 'money' }, { name: 'هامش الربح %', terms: [{ k: '#var', v: 'مجمل الربح' }, { k: '#var', v: 'صافي المبيعات', op: '/' }, { k: '#num', n: 100, op: '*' }], fmt: 'pct' }] }; }]
    ];
    function stIcon(p) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
    function stPer() { var k = F.stPer || 'month'; return presetRange(k); }
    function opt(list, v) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(v) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
    function chipsSel(name, list, v) { return '<div class="seg2" role="group">' + list.map(function (o) { return '<button type="button" class="' + (String(v || '') === String(o[0]) ? 'on' : '') + '" data-' + name + '="' + esc(o[0]) + '">' + esc(o[1]) + '</button>'; }).join('') + '</div>'; }
    function accTags(codes, key) {
      return (codes || []).length ? '<div class="acc-tags">' + codes.map(function (c, i) { var a = F.D.byCode[c]; return '<span class="acc-tag"><b>' + esc(a ? a.name : c) + '</b><span class="num">' + esc(c) + '</span>' + (a && !a.leaf ? '<em>وكل فروعه</em>' : '') + '<button type="button" data-untag="' + key + '|' + i + '" aria-label="إزالة">×</button></span>'; }).join('') + '</div>' : '';
    }
    function sec(n, title, hint, body, opt2) { return '<section class="st-sec' + (opt2 ? ' opt' : '') + '"><div class="st-h"><span class="st-n">' + n + '</span><div><h3>' + esc(title) + (opt2 ? ' <small>اختياري</small>' : '') + '</h3>' + (hint ? '<p>' + esc(hint) + '</p>' : '') + '</div></div><div class="st-b">' + body + '</div></section>'; }

    function builderHTML() {
      var d = F.custom;
      if (d && d.def && d.def.ds && !d.def.kind) return legacyBuilderHTML();
      if (d && d.def && d.def.kind === 'ready') return '<div class="card"><h2>' + esc(d.name) + '</h2><p class="muted">' + esc(customDesc(d.def)) + '. يُعدَّل هذا النوع من شاشة التقرير نفسه: افتحه ثم اضغط «تخصيص التقرير».</p><div class="row"><button class="btn primary" data-ropen>فتح التقرير للتعديل</button><button class="btn ghost" data-rnew>تقرير جديد</button></div></div>';
      if (!d || !d.def || !d.def.kind) return studioStartHTML();
      var df = d.def, typ = ST_TYPES.filter(function (t) { return t[0] === df.kind; })[0];
      var h = '<div class="studio"><div class="st-form">';
      h += '<div class="card st-head"><div class="row"><button class="btn sm ghost" data-stback>→ تغيير النوع</button><span class="grow"></span>' + (d.id ? '<span class="badge">تعديل تقرير محفوظ</span>' : '') + '</div>' +
        '<div class="st-type">' + stIcon(typ[3]) + '<div><h2>' + esc(typ[1]) + '</h2><p class="small muted">' + esc(typ[2]) + '</p></div></div>' +
        '<div class="field"><label class="lbl" for="stname">اسم التقرير</label><input id="stname" class="input" value="' + esc(d.name || '') + '" placeholder="اسم يظهر في «تقاريري»، مثل: مصروفات الصندوق الشهرية"></div></div>';
      if (df.kind === 'pair') h += pairForm(df);
      else if (df.kind === 'free') h += freeForm(df);
      else h += formulaForm(df);
      h += '</div><aside class="st-prev"><div class="card st-pcard"><div class="st-ph"><h3>المعاينة</h3>' + chipsSel('stper', [['month', 'هذا الشهر'], ['lastmonth', 'الشهر الماضي'], ['year', 'هذه السنة']], F.stPer || 'month') + '</div>' +
        '<div id="stprev"></div><div class="st-actions"><button class="btn primary grow" data-stopen>عرض التقرير كاملاً</button>' + (canEdit() ? '<button class="btn accent grow" data-stsave>' + (d.id ? 'حفظ التعديل' : 'حفظ في تقاريري') + '</button>' : '') + '</div>' +
        (d.id ? '<button class="btn sm danger" data-stdel style="margin-top:8px">حذف هذا التقرير</button>' : '') + '</div></aside></div>';
      return h;
    }
    function studioStartHTML() {
      var h = '<div class="card st-intro"><h2>ماذا تريد أن تبني؟</h2><p class="muted">اختر نوع التقرير. ستملأ خطوات قليلة واضحة، وترى النتيجة مباشرة قبل الحفظ.</p><div class="st-types">' +
        ST_TYPES.map(function (t) { return '<button class="st-tcard" data-sttype="' + t[0] + '">' + stIcon(t[3]) + '<b>' + esc(t[1]) + '</b><span>' + esc(t[2]) + '</span></button>'; }).join('') + '</div></div>';
      h += '<div class="card"><h3>أو ابدأ من نموذج جاهز وعدّله</h3><div class="st-tpls">' + ST_TPL.map(function (t) { return '<button class="item tap st-tpl" data-sttpl="' + t[0] + '"><div class="main"><b>' + esc(t[1]) + '</b><div class="small muted">' + esc(t[2]) + '</div></div><span class="st-go">←</span></button>'; }).join('') + '</div></div>';
      if (F.reports.length) h += '<div class="card"><h3>تقاريري المحفوظة</h3><div class="st-tpls">' + F.reports.map(function (r) { return '<button class="item tap st-tpl" data-stedit="' + esc(r.id) + '"><div class="main"><b>' + esc(r.name) + '</b><div class="small muted">' + esc(customDesc(r.def)) + (r.by ? ' · ' + esc(r.by) : '') + '</div></div><span class="btn sm ghost">تعديل</span></button>'; }).join('') + '</div></div>';
      return h;
    }

    /* ---------- نموذج «حساب مقابل حساب» ---------- */
    function pairForm(df) {
      var anyB = !(df.b || []).length && !df.bpick;
      return sec(1, 'الحساب الأساسي', 'الحساب الذي تريد حركته. الحساب الرئيسي يشمل كل فروعه، ويمكن اختيار أكثر من حساب.',
          accTags(df.a, 'a') + '<button type="button" class="btn" data-pick="a">' + ((df.a || []).length ? 'تغيير الحساب' : '+ اختر الحساب') + '</button>') +
        sec(2, 'الحساب المقابل', 'الطرف الآخر في القيد. اختر «أي حساب» لترى كل الحسابات المقابلة.',
          chipsSel('bmode', [['any', 'أي حساب'], ['pick', 'حساب محدد']], anyB ? 'any' : 'pick') +
          (anyB ? '' : '<div style="margin-top:10px">' + accTags(df.b, 'b') + '<button type="button" class="btn" data-pick="b">' + ((df.b || []).length ? 'تغيير الحساب المقابل' : '+ اختر الحساب المقابل') + '</button></div>')) +
        sec(3, 'كلمات في البيان', 'تظهر فقط الحركات التي في بيانها هذه الكلمات. افصل بين الكلمات بفاصلة.',
          '<div class="field"><input id="stkw" class="input" value="' + esc(df.kw || '') + '" placeholder="مثل: إيجار، كهرباء، محمد"></div>' +
          '<div class="row st-inl"><span class="small">تظهر الحركة إذا وُجدت</span>' + chipsSel('kwm', [['any', 'أي كلمة'], ['all', 'كل الكلمات']], df.kwm || 'any') + '</div>' +
          '<div class="field" style="margin-top:10px"><label class="lbl" for="stkwx">واستبعد الحركات التي فيها</label><input id="stkwx" class="input" value="' + esc(df.kwx || '') + '" placeholder="اختياري: كلمات لا تريدها"></div>', true) +
        sec(4, 'أي الحركات؟', '', chipsSel('side', [['', 'الكل'], ['dr', 'المدينة فقط'], ['cr', 'الدائنة فقط']], df.side || '')) +
        sec(5, 'طريقة العرض', '', chipsSel('pview', PAIR_VIEWS, df.view || 'lines'));
    }

    /* ---------- نموذج «التقرير الحر» ---------- */
    function freeForm(df) {
      var src = SRC[df.src], h = '';
      h += sec(1, 'من أين البيانات؟', '', '<div class="st-src">' + Object.keys(SRC).map(function (k) { return '<button type="button" class="st-scard' + (df.src === k ? ' on' : '') + '" data-src="' + k + '"><b>' + esc(SRC[k].name) + '</b><span>' + esc(SRC[k].hint) + '</span></button>'; }).join('') + '</div>');
      if (!src) return h;
      var F_ = src.f, keys = Object.keys(F_), numK = keys.filter(function (k) { return NUMT[F_[k][1]]; }), txtK = keys.filter(function (k) { return !NUMT[F_[k][1]]; });
      if (!multiBr()) { txtK = txtK.filter(function (k) { return k !== 'br'; }); keys = keys.filter(function (k) { return k !== 'br'; }); }
      h += sec(2, 'شكل التقرير', '', '<div class="st-src two"><button type="button" class="st-scard' + (df.mode !== 'sum' ? ' on' : '') + '" data-mode="list"><b>قائمة تفصيلية</b><span>كل سطر كما هو، بالأعمدة التي تختارها، مع مجاميع.</span></button>' +
        '<button type="button" class="st-scard' + (df.mode === 'sum' ? ' on' : '') + '" data-mode="sum"><b>ملخص مجمّع</b><span>مجاميع حسب ما تختار: شهر، حساب، عميل، صنف…</span></button></div>');
      if (df.mode === 'sum') {
        h += sec(3, 'التجميع', 'كل صف في التقرير يمثّل قيمة واحدة مما تختاره هنا.',
          '<div class="row"><div class="field grow"><label class="lbl" for="strow">صف لكل</label><select id="strow" class="input">' + opt(txtK.map(function (k) { return [k, F_[k][0]]; }), df.row || 'mon') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="stcol">وعمود لكل (اختياري)</label><select id="stcol" class="input"><option value="">بدون</option>' + opt(txtK.filter(function (k) { return k !== df.row; }).map(function (k) { return [k, F_[k][0]]; }), df.col || '') + '</select></div></div>' +
          '<div class="field"><span class="lbl">الأرقام المطلوبة</span><div class="st-pills">' + numK.concat(['@n']).map(function (k) { var on = (df.meas || []).indexOf(k) >= 0; return '<button type="button" class="pill' + (on ? ' on' : '') + '" data-meas="' + k + '">' + (on ? '✓ ' : '') + esc(k === '@n' ? 'العدد' : F_[k][0]) + '</button>'; }).join('') + '</div>' +
          (df.col ? '<p class="small muted" style="margin:6px 0 0">مع «عمود لكل» يُوزَّع الرقم الأول فقط على الأعمدة.</p>' : '') + '</div>' +
          '<div class="row"><div class="field grow"><label class="lbl" for="stsort">الترتيب</label><select id="stsort" class="input">' + opt([['', 'تلقائي'], ['_val', 'الأكبر أولاً'], ['_name', 'أبجدي / زمني']], df.sort || '') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="sttop">العرض</label><select id="sttop" class="input">' + opt([[0, 'الكل'], [10, 'أعلى 10'], [20, 'أعلى 20'], [50, 'أعلى 50'], [100, 'أعلى 100']], df.top || 0) + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="stchart">رسم بياني</label><select id="stchart" class="input">' + opt([['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط'], ['hbar', 'أشرطة أفقية']], df.chart || '') + '</select></div></div>');
      } else {
        var cols = (df.cols || []).filter(function (k) { return F_[k]; });
        h += sec(3, 'الأعمدة', 'اضغط على أي حقل لإضافته أو إزالته. رتّب الأعمدة المختارة بالأسهم.',
          '<div class="st-cols">' + (cols.length ? cols.map(function (k, i) { return '<span class="col-pill"><button type="button" data-cmv="' + i + '|-1" aria-label="قبل"' + (i ? '' : ' disabled') + '>→</button><b>' + esc(F_[k][0]) + '</b><button type="button" data-cmv="' + i + '|1" aria-label="بعد"' + (i < cols.length - 1 ? '' : ' disabled') + '>←</button><button type="button" data-cdel="' + i + '" aria-label="إزالة">×</button></span>'; }).join('') : '<span class="muted small">لم تختر أعمدة بعد</span>') + '</div>' +
          '<div class="st-pills" style="margin-top:10px">' + keys.filter(function (k) { return cols.indexOf(k) < 0; }).map(function (k) { return '<button type="button" class="pill add" data-cadd="' + k + '">+ ' + esc(F_[k][0]) + '</button>'; }).join('') + '</div>' +
          '<div class="row" style="margin-top:12px"><div class="field grow"><label class="lbl" for="stsortf">رتّب حسب</label><select id="stsortf" class="input">' + opt(keys.map(function (k) { return [k, F_[k][0]]; }), df.sort || 'd') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="stdir">الاتجاه</label><select id="stdir" class="input">' + opt([['', 'تلقائي'], ['asc', 'تصاعدي'], ['desc', 'تنازلي']], df.dir || '') + '</select></div>' +
          '<div class="field grow"><label class="lbl" for="stgrp">جمّع في مجموعات حسب</label><select id="stgrp" class="input"><option value="">بدون</option>' + opt(txtK.map(function (k) { return [k, F_[k][0]]; }), df.group || '') + '</select></div></div>' +
          (df.group ? '<label class="chk"><input type="checkbox" id="stcoll"' + (df.collapse ? ' checked' : '') + '> اعرض مجموع كل مجموعة فقط (بدون التفاصيل)</label>' : ''));
      }
      var conds = df.conds || [];
      h += sec(4, 'الشروط', 'لحصر البيانات: حساب معيّن وفروعه، كلمات في البيان، نوع حركة، مبلغ أكبر من… كل الشروط يجب أن تتحقق معاً.',
        '<div class="st-conds">' + conds.map(function (c, i) { return condRow(df.src, c, i); }).join('') + '</div><button type="button" class="btn" data-cadd2>+ أضف شرطاً</button>', true);
      return h;
    }
    function condFields(srcK) {
      var src = SRC[srcK], out = srcK === 'jl' ? [['@acc', 'الحساب (وكل فروعه)']] : [];
      return out.concat(Object.keys(src.f).filter(function (k) { return src.f[k][1] !== 'date' && (k !== 'br' || multiBr()); }).map(function (k) { return [k, src.f[k][0]]; }));
    }
    function condRow(srcK, c, i) {
      var fd = c.f === '@acc' ? null : SRC[srcK].f[c.f], isN = fd && NUMT[fd[1]];
      var ops = c.f === '@acc' ? [['in', 'تحت'], ['nin', 'ليس تحت']] : isN ? OPS_N : OPS_T;
      var val = '';
      if (c.f === '@acc') val = accTags(c.v || [], 'c' + i) + '<button type="button" class="btn sm" data-cacc="' + i + '">' + ((c.v || []).length ? 'تغيير' : 'اختر الحساب') + '</button>';
      else if (c.op === 'in' || c.op === 'nin') val = '<button type="button" class="input selbtn" data-cpick="' + i + '">' + ((c.v || []).length ? esc(c.v.slice(0, 3).join('، ') + (c.v.length > 3 ? ' و' + (c.v.length - 3) + ' أخرى' : '')) : 'اختر من القائمة…') + '</button>';
      else if (c.op === 'empty' || c.op === 'nempty' || c.op === 'ne0') val = '';
      else val = '<input class="input" data-cval="' + i + '" ' + (isN ? 'type="number" inputmode="decimal"' : '') + ' value="' + esc(c.v === undefined ? '' : c.v) + '" placeholder="' + (isN ? '0' : 'كلمة أو أكثر، افصل بفاصلة') + '">';
      return '<div class="cond"><div class="cond-r"><select class="input" data-cf="' + i + '" aria-label="الحقل">' + opt(condFields(srcK), c.f) + '</select><select class="input" data-cop="' + i + '" aria-label="الشرط">' + opt(ops, c.op) + '</select>' +
        '<button type="button" class="iconbtn" data-cx="' + i + '" aria-label="حذف الشرط">' + ICON.close + '</button></div>' + (val ? '<div class="cond-v">' + val + '</div>' : '') + '</div>';
    }

    /* ---------- نموذج «بنود ومعادلات» (المحرّر الحالي في خطوات أوضح) ---------- */
    function formulaForm(df) {
      var t = today();
      return sec(1, 'الأسطر', 'كل سطر: اسم وما يُحسب له. اضغط «تعديل» لاختيار ما يُحسب من قائمة، ويمكن استعمال الأسطر السابقة في المعادلات.',
          listEditorHTML('frow', df.rows || [], { from: t.slice(0, 7) + '-01', to: t }) + '<div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-fadd>+ سطر</button><button type="button" class="btn sm ghost" data-fsep>+ عنوان قسم</button></div>') +
        sec(2, 'الأعمدة', '', chipsSel('fcols', [['single', 'الفترة كاملة'], ['month', 'لكل شهر'], ['week', 'لكل أسبوع'], ['day', 'لكل يوم']], df.cols || 'month')) +
        sec(3, 'رسم بياني', 'للسطر الأول', chipsSel('fch', [['', 'بدون'], ['bar', 'أعمدة'], ['line', 'خط']], df.chart || ''), true);
    }

    function previewHTML() {
      var d = F.custom, r = stPer(), res;
      try { res = runCustom(d.def, { from: r[0], to: r[1], preset: 'custom' }); } catch (e) { res = { cols: [], rows: [], empty: 'تعذّر الحساب: ' + e.message }; }
      var h = '<div class="small muted st-pnote">' + perLabel(r[0], r[1]) + (res.note ? ' · ' + esc(plain(res.note)) : '') + '</div>';
      if (res.empty) return h + '<div class="st-empty">' + esc(res.empty) + '</div>';
      var short = { cols: res.cols, rows: res.rows.slice(0, 60), total: res.total };
      if (res.chart && res.rows.length > 1) h += chartSVG(res.chart, res.rows);
      h += '<div class="scroll-x fin-table st-tbl">' + tableHTML(short).replace(/<p class="small muted"[\s\S]*<\/p>$/, '') + '</div>';
      if (res.rows.length > 60) h += '<p class="small muted">يظهر أول 60 سطراً من ' + fk(res.rows.length) + '. «عرض التقرير كاملاً» يعرض الكل.</p>';
      return h;
    }

    function bindBuilder(m) {
      var d = F.custom;
      if (d && d.def && d.def.ds && !d.def.kind) return legacyBindBuilder(m);
      if (d && d.def && d.def.kind === 'ready') { q('[data-ropen]', m).onclick = function () { var id = d.id; F.custom = null; F.vpOpen = true; openReport('c:' + id); }; q('[data-rnew]', m).onclick = function () { F.custom = null; A.render(); }; return; }
      if (!d || !d.def || !d.def.kind) {
        qa('[data-sttype]', m).forEach(function (b) { b.onclick = function () { var k = b.dataset.sttype; if (k === 'ready') { pickReady(); return; } F.custom = { name: '', cat: 'تقاريري', def: ST_TPL.filter(function (t) { return t[0] === (k === 'free' ? 'kw' : k); })[0][3]() }; if (k === 'free') F.custom.def = { kind: 'free', src: '', mode: 'list', cols: [], conds: [] }; A.render(); window.scrollTo(0, 0); }; });
        qa('[data-sttpl]', m).forEach(function (b) { b.onclick = function () { var t = ST_TPL.filter(function (x) { return x[0] === b.dataset.sttpl; })[0]; F.custom = { name: t[0] === 'pair' ? '' : t[1], cat: 'تقاريري', def: t[3]() }; A.render(); window.scrollTo(0, 0); }; });
        qa('[data-stedit]', m).forEach(function (b) { b.onclick = function () { var r = F.reports.filter(function (x) { return x.id === b.dataset.stedit; })[0]; if (r) { F.custom = JSON.parse(JSON.stringify(r)); A.render(); window.scrollTo(0, 0); } }; });
        return;
      }
      var df = d.def;
      var pv = function () { var el = q('#stprev', m); if (el) el.innerHTML = previewHTML(); };
      var re = function () { F.dirty = true; A.render(); };
      pv();
      q('#stname', m).oninput = function () { d.name = this.value; F.dirty = true; };
      q('[data-stback]', m).onclick = function () { A.confirmBox('تغيير النوع', 'ستبدأ تقريراً جديداً من البداية. هل تريد المتابعة؟', 'نعم').then(function (y) { if (y) { F.custom = null; F.dirty = false; A.render(); } }); };
      qa('[data-stper]', m).forEach(function (b) { b.onclick = function () { F.stPer = b.dataset.stper; qa('[data-stper]', m).forEach(function (x) { x.classList.toggle('on', x === b); }); pv(); }; });
      qa('[data-untag]', m).forEach(function (b) { b.onclick = function () { var p2 = b.dataset.untag.split('|'), list = p2[0] === 'a' ? df.a : p2[0] === 'b' ? df.b : df.conds[Number(p2[0].slice(1))].v; list.splice(Number(p2[1]), 1); if (p2[0][0] === 'c') delete df.conds[Number(p2[0].slice(1))]._ids; re(); }; });
      if (df.kind === 'pair') {
        qa('[data-pick]', m).forEach(function (b) {
          b.onclick = function () {
            var k = b.dataset.pick;
            pickAccount({ multi: true, value: df[k] || [], title: k === 'a' ? 'اختر الحساب الأساسي' : 'اختر الحساب المقابل', hint: 'الحساب الرئيسي يشمل كل فروعه. يمكنك اختيار أكثر من حساب.' }).then(function (codes) { if (codes) { df[k] = codes; if (k === 'a' && !d.name && codes.length) d.name = 'حركة ' + codesText(codes); re(); } });
          };
        });
        qa('[data-bmode]', m).forEach(function (b) { b.onclick = function () { if (b.dataset.bmode === 'any') { df.b = []; df.bpick = false; } else df.bpick = true; re(); }; });
        var kwT = null, kwIn = function () { df.kw = q('#stkw', m).value; df.kwx = q('#stkwx', m).value; F.dirty = true; clearTimeout(kwT); kwT = setTimeout(pv, 450); };
        q('#stkw', m).oninput = kwIn; q('#stkwx', m).oninput = kwIn;
        qa('[data-kwm]', m).forEach(function (b) { b.onclick = function () { df.kwm = b.dataset.kwm; re(); }; });
        qa('[data-side]', m).forEach(function (b) { b.onclick = function () { df.side = b.dataset.side; re(); }; });
        qa('[data-pview]', m).forEach(function (b) { b.onclick = function () { df.view = b.dataset.pview; re(); }; });
      } else if (df.kind === 'free') {
        qa('[data-src]', m).forEach(function (b) { b.onclick = function () { if (df.src === b.dataset.src) return; df.src = b.dataset.src; df.cols = SRC[df.src].def.slice(); df.conds = []; df.row = 'mon'; df.col = ''; df.meas = []; df.sort = ''; df.group = ''; re(); }; });
        qa('[data-mode]', m).forEach(function (b) { b.onclick = function () { df.mode = b.dataset.mode; if (df.mode === 'sum' && !(df.meas || []).length) { var nk = Object.keys(SRC[df.src].f).filter(function (k) { return NUMT[SRC[df.src].f[k][1]]; }); df.meas = nk.slice(0, 1); df.row = df.row || 'mon'; df.sort = ''; } if (df.mode === 'list') df.sort = df.sort && SRC[df.src].f[df.sort] ? df.sort : 'd'; re(); }; });
        var on = function (sel, fn) { var el = q(sel, m); if (el) el.onchange = function () { fn(el); re(); }; };
        on('#strow', function (el) { df.row = el.value; if (df.col === df.row) df.col = ''; });
        on('#stcol', function (el) { df.col = el.value; });
        on('#stsort', function (el) { df.sort = el.value; });
        on('#sttop', function (el) { df.top = Number(el.value) || 0; });
        on('#stchart', function (el) { df.chart = el.value; });
        on('#stsortf', function (el) { df.sort = el.value; });
        on('#stdir', function (el) { df.dir = el.value; });
        on('#stgrp', function (el) { df.group = el.value; if (!df.group) df.collapse = false; });
        on('#stcoll', function (el) { df.collapse = el.checked; });
        qa('[data-meas]', m).forEach(function (b) { b.onclick = function () { var k = b.dataset.meas; df.meas = df.meas || []; var i = df.meas.indexOf(k); if (i >= 0) df.meas.splice(i, 1); else df.meas.push(k); re(); }; });
        qa('[data-cadd]', m).forEach(function (b) { b.onclick = function () { df.cols = df.cols || []; df.cols.push(b.dataset.cadd); re(); }; });
        qa('[data-cdel]', m).forEach(function (b) { b.onclick = function () { df.cols.splice(Number(b.dataset.cdel), 1); re(); }; });
        qa('[data-cmv]', m).forEach(function (b) { b.onclick = function () { var p2 = b.dataset.cmv.split('|'), i = Number(p2[0]), j = i + Number(p2[1]); var t = df.cols[i]; df.cols[i] = df.cols[j]; df.cols[j] = t; re(); }; });
        var ca = q('[data-cadd2]', m);
        if (ca) ca.onclick = function () { df.conds = df.conds || []; df.conds.push(df.src === 'jl' ? { f: '@acc', op: 'in', v: [] } : { f: 'cust', op: 'has', v: '' }); re(); };
        qa('[data-cf]', m).forEach(function (el) { el.onchange = function () { var c = df.conds[Number(el.dataset.cf)], fd = SRC[df.src].f[el.value]; c.f = el.value; delete c._ids; c.op = el.value === '@acc' ? 'in' : fd && NUMT[fd[1]] ? 'gt' : 'has'; c.v = el.value === '@acc' ? [] : ''; re(); }; });
        qa('[data-cop]', m).forEach(function (el) { el.onchange = function () { var c = df.conds[Number(el.dataset.cop)], was = c.op; c.op = el.value; if ((c.op === 'in' || c.op === 'nin') !== (was === 'in' || was === 'nin') && c.f !== '@acc') c.v = c.op === 'in' || c.op === 'nin' ? [] : ''; re(); }; });
        qa('[data-cx]', m).forEach(function (b) { b.onclick = function () { df.conds.splice(Number(b.dataset.cx), 1); re(); }; });
        var cvT = null;
        qa('[data-cval]', m).forEach(function (el) { el.oninput = function () { df.conds[Number(el.dataset.cval)].v = el.value; F.dirty = true; clearTimeout(cvT); cvT = setTimeout(pv, 450); }; });
        qa('[data-cacc]', m).forEach(function (b) { b.onclick = function () { var c = df.conds[Number(b.dataset.cacc)]; pickAccount({ multi: true, value: c.v || [], title: 'اختر الحساب', hint: 'الحساب الرئيسي يشمل كل فروعه.' }).then(function (codes) { if (codes) { c.v = codes; delete c._ids; re(); } }); }; });
        qa('[data-cpick]', m).forEach(function (b) {
          b.onclick = function () {
            var c = df.conds[Number(b.dataset.cpick)], r = stPer();
            var vals = fieldVals(df.src, c.f, F.stPer === 'year' ? null : addD(r[0], -365), r[1]);
            pickMulti({ title: 'اختر: ' + SRC[df.src].f[c.f][0], options: vals.map(function (v) { return { id: v, name: v }; }), value: c.v || [] }).then(function (sel) { if (sel) { c.v = sel; re(); } });
          };
        });
      } else {
        var t = today(), from = t.slice(0, 7) + '-01';
        df.rows = df.rows || [];
        bindListEditor(m, 'frow', function () { return df.rows; }, 'frow', function (i) { return ctxFor(df.rows, i, from, t, 'هذا الشهر'); }, re);
        q('[data-fadd]', m).onclick = function () { editItem(null, 'frow', ctxFor(df.rows, df.rows.length, from, t, 'هذا الشهر')).then(function (o) { if (o) { df.rows.push(o); re(); } }); };
        q('[data-fsep]', m).onclick = function () { editItem({ name: '', f: '' }, 'row', { from: from, to: t }).then(function (o) { if (o) { df.rows.push({ name: o.name, f: o.f || '', fmt: o.fmt }); re(); } }); };
        qa('[data-fcols]', m).forEach(function (b) { b.onclick = function () { df.cols = b.dataset.fcols; re(); }; });
        qa('[data-fch]', m).forEach(function (b) { b.onclick = function () { df.chart = b.dataset.fch; re(); }; });
      }
      q('[data-stopen]', m).onclick = function () {
        var r = stPer();
        F.cur = { id: 'tmp', custom: { id: d.id, name: d.name || 'تقرير بدون اسم', cat: d.cat, def: df, tmp: true }, p: { preset: F.stPer || 'month', from: r[0], to: r[1], flt: null } };
        F.sub = 'reports'; A.go('reports'); window.scrollTo(0, 0);
      };
      var sv = q('[data-stsave]', m);
      if (sv) sv.onclick = function () { saveCustom(d, sv); };
      var del = q('[data-stdel]', m);
      if (del) del.onclick = function () {
        A.confirmBox('حذف التقرير', 'حذف «' + esc(d.name) + '» من تقاريري؟', 'حذف').then(function (y) {
          if (!y) return;
          call('fin_report_delete', { id: d.id }).then(function (r) { F.reports = r.reports; F.custom = null; F.dirty = false; toast('حُذف التقرير'); go('reports'); }).catch(function (e) { toast(e.message, true); });
        });
      };
    }
    function cleanDef(df) {
      return JSON.parse(JSON.stringify(df, function (k, v) { return k === '_ids' || k === 'bpick' ? undefined : v; }));
    }
    function saveCustom(d, btn) {
      var df = d.def;
      d.name = String(d.name || '').trim();
      if (!d.name) { toast('اكتب اسم التقرير في الأعلى', true); var n = q('#stname'); if (n) n.focus(); return; }
      if (df.kind === 'pair' && !(df.a || []).length) { toast('اختر الحساب الأساسي', true); return; }
      if (df.kind === 'free' && !df.src) { toast('اختر مصدر البيانات', true); return; }
      if (df.kind === 'formula' && !(df.rows || []).some(function (r) { return itemF(r); })) { toast('أضف سطراً فيه ما يُحسب', true); return; }
      busy(btn, true);
      call('fin_report_save', { report: { id: d.id, name: d.name, cat: d.cat || 'تقاريري', def: cleanDef(df) } }).then(function (r) {
        F.reports = r.reports; var saved = d.id ? r.reports.filter(function (x) { return x.id === d.id; })[0] : r.reports.filter(function (x) { return x.name === d.name; }).pop();
        toast('حُفظ التقرير في «تقاريري»'); F.custom = null; F.dirty = false;
        if (saved) openReport('c:' + saved.id); else go('reports');
      }).catch(function (e) { busy(btn, false); toast(e.message, true); });
    }

    /* ---------- فهرس التقارير ---------- */
    function catalogHTML() {
      var n = repKeys().length;
      var h = '<div class="card cat-top"><div class="cat-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
        '<input class="input" id="rq" placeholder="ابحث في ' + n + ' تقريراً: مبيعات، عميل، ميزانية، مخزون…" value="' + esc(F.rq || '') + '" aria-label="بحث في التقارير"></div>' +
        (canEdit() ? '<div class="cat-cta"><button class="btn accent" data-newrep>+ إنشاء تقرير</button><button class="btn" data-newpair>حساب مقابل حساب</button></div>' : '') + '</div>' +
        '';
      var view = F.rcat || 'home';
      if (view === 'home' && !F.rq) return h + catHomeHTML() + savedHomeHTML();
      h += '<div class="cat-nav"><button class="btn sm ghost cat-back" data-jump="home">→ كل الأقسام</button><div class="cat-filter" role="group" aria-label="التصنيف">' + [['all', 'الكل']].concat(F.reports.length ? [['mine', 'تقاريري']] : []).concat(CATS.filter(function (c) { return c[0] !== 'mine'; })).map(function (c) { return '<button class="' + (view === c[0] ? 'on' : '') + '" data-jump="' + c[0] + '">' + c[1] + '</button>'; }).join('') + '</div></div>';
      var mine = F.reports.map(function (r) { return { id: 'c:' + r.id, rid: r.id, name: r.name, desc: customDesc(r.def), by: r.by }; });
      var cats = [['mine', 'تقاريري']].concat(CATS.filter(function (c) { return c[0] !== 'mine'; }));
      cats.forEach(function (c) {
        var list = c[0] === 'mine' ? mine : repKeys().filter(function (k) { return R[k].cat === c[0]; }).map(function (k) { return { id: k, name: R[k].name, desc: R[k].desc }; });
        if (!list.length && c[0] !== 'mine') return;
        if (!list.length && !canEdit()) return;
        if (view !== 'all' && view !== c[0]) return;
        h += '<section class="fin-catsec' + (c[0] === 'mine' ? ' mine' : '') + '" id="cat-' + c[0] + '"><div class="sec-title"><h2>' + c[1] + ' <span class="badge">' + list.length + '</span></h2></div><div class="fin-cat">' + (list.length ? list.map(function (r) {
          return '<div class="rep-tile" data-s="' + esc(r.name + ' ' + (r.desc || '') + ' ' + c[1]) + '"><button class="rep-open" data-open="' + esc(r.id) + '"><b>' + esc(r.name) + '</b><span>' + esc(r.desc || '') + (r.by ? ' · ' + esc(r.by) : '') + '</span></button>' +
            (r.rid && canEdit() ? '<button class="iconbtn rep-ed" data-redit="' + esc(r.rid) + '" aria-label="تعديل" title="تعديل">' + ICON_EDIT + '</button>' : '') + '</div>';
        }).join('') : '<div class="cat-empty"><b>لا توجد تقارير خاصة بك بعد</b><span>صمّم تقريراً من الصفر واحفظه هنا ليظهر لكل المستخدمين.</span><button class="btn sm accent" data-newrep>+ إنشاء تقرير</button></div>') + '</div></section>';
      });
      return h;
    }
    // الصفحة الأولى للتقارير: بطاقة لكل قسم رئيسي، وعند الضغط تظهر تقاريره
    var CAT_INFO = {
      exec: ['ملخص الإدارة ومؤشرات الأداء', 'M4 19V9m6 10V5m6 14v-7m4 7H2'], stmt: ['قائمة الدخل والميزانية والتدفقات', 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7'],
      acct: ['اليومية والأستاذ وميزان المراجعة', 'M4 5h16v14H4zM4 10h16M10 10v9'], sales: ['المبيعات حسب الصنف والعميل والفترة', 'M3 4h2l2.4 11h11L21 7H6.2M9 20h.01M18 20h.01'],
      reps: ['أداء المناديب وفئاتهم', 'M8 11a4 4 0 100-8 4 4 0 000 8zM2 21v-1a6 6 0 0112 0v1M17 11a3 3 0 100-6M22 21v-1a5 5 0 00-4-4.9'],
      cust: ['تحليل العملاء وتقييمهم وأسعارهم', 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21v-1a8 8 0 0116 0v1'], cust1: ['كل شيء عن عميل واحد', 'M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20a7 7 0 0114 0M19 4l2 2-2 2'],
      cgrp: ['الوكلاء والفروع ومجموعات العملاء', 'M3 7l9-4 9 4-9 4zM3 12l9 4 9-4M3 17l9 4 9-4'], debts: ['المديونيات وأعمارها والتحصيل', 'M3 6h18v12H3zM3 10h18M7 15h3'],
      cash: ['الصناديق والبنوك والسندات', 'M3 10l9-6 9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18'], items: ['الأصناف وربحيتها وتحليلها', 'M21 8l-9-5-9 5 9 5zM3 8v8l9 5 9-5V8M12 13v8'],
      disc: ['قوائم الأسعار والتخفيضات والحسومات والهدايا', 'M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8zM7.5 7.5h.01'],
      analytics: ['إحصاءات وتوقعات وتوزيعات', 'M12 3v9l7 4M21 12a9 9 0 11-9-9'], purch: ['المشتريات والموردون', 'M3 7h13v10H3zM16 10h3l2 3v4h-5M7 20a2 2 0 100-4 2 2 0 000 4zM18 20a2 2 0 100-4 2 2 0 000 4z'],
      stock: ['المخزون والحركة والتغطية', 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'], admin: ['المستخدمون وسجل التعديلات', 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-1-3-2 .5-1.5-1.5L17 5l-3-1-1 2h-2L10 4 7 5l.5 2L6 8.5 4 8l-1 3 2 1v2l-2 1 1 3 2-.5L7.5 18 7 20l3 1 1-2h2l1 2 3-1-.5-2 1.5-1.5 2 .5 1-3-2-1z'],
      mine: ['التقارير التي صممتها وحفظتها', 'M12 3l2.7 5.5 6 .9-4.4 4.2 1 6L12 16.8 6.7 19.6l1-6L3.3 9.4l6-.9z']
    };
    function catHomeHTML() {
      var cnt = {}; repKeys().forEach(function (k) { cnt[R[k].cat] = (cnt[R[k].cat] || 0) + 1; }); cnt.mine = F.reports.length;
      var cats = (F.reports.length || canEdit() ? [['mine', 'تقاريري']] : []).concat(CATS.filter(function (c) { return c[0] !== 'mine' && cnt[c[0]]; }));
      var icon = function (k) { var d = (CAT_INFO[k] || ['', 'M4 4h16v16H4z'])[1]; return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
      var names = function (k) { return repKeys().filter(function (r) { return R[r].cat === k; }).slice(0, 3).map(function (r) { return R[r].name; }).join(' · '); };
      return '<div class="cat-home">' + cats.map(function (c) {
        return '<button class="cat-card' + (c[0] === 'mine' ? ' mine' : '') + '" data-jump="' + c[0] + '"><span class="cat-ic">' + icon(c[0]) + '</span><span class="cat-tx"><b>' + esc(c[1]) + '</b><span class="cat-sub">' + esc((CAT_INFO[c[0]] || [''])[0]) + '</span>' +
          '<span class="cat-ex">' + esc(c[0] === 'mine' ? (cnt.mine ? F.reports.slice(0, 3).map(function (r) { return r.name; }).join(' · ') : 'لم تحفظ تقارير بعد') : names(c[0])) + '</span></span><span class="cat-cnt">' + fk(cnt[c[0]] || 0) + '</span></button>';
      }).join('') + '</div><div class="row" style="justify-content:center;margin-top:14px"><button class="btn ghost" data-jump="all">عرض كل التقارير (' + repKeys().length + ') في قائمة واحدة</button></div>';
    }
    function bindCatalog(m) {
      var inp = q('#rq', m);
      var apply = function () {
        var t = normAr(inp.value); F.rq = inp.value.trim();
        if (t && (F.rcat || 'home') !== 'all') { F.rcatPrev = F.rcat || 'home'; F.rcat = 'all'; A.render(); var ni = q('#rq'); if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); } return; }
        if (!t && F.rcatPrev && F.rcat === 'all') { F.rcat = F.rcatPrev; F.rcatPrev = null; A.render(); var n2 = q('#rq'); if (n2) n2.focus(); return; }
        qa('.rep-tile', m).forEach(function (b) { b.hidden = !!t && normAr(b.dataset.s).indexOf(t) < 0; });
        qa('.fin-catsec', m).forEach(function (s) { s.hidden = !!t && !qa('.rep-tile', s).some(function (b) { return !b.hidden; }); });
      };
      inp.oninput = apply; if (F.rq) apply();
      qa('[data-jump]', m).forEach(function (b) { b.onclick = function () { F.rcat = b.dataset.jump; F.rcatPrev = null; inp.value = ''; F.rq = ''; A.render(); window.scrollTo(0, 0); }; });
      qa('[data-newrep]', m).forEach(function (b) { b.onclick = function () { F.custom = null; go('builder'); }; });
      bindSavedHome(m);
      var np = q('[data-newpair]', m); if (np) np.onclick = function () { F.custom = { name: '', cat: 'تقاريري', def: ST_TPL[0][3]() }; go('builder'); };
      qa('[data-redit]', m).forEach(function (b) { b.onclick = function () { var r = F.reports.filter(function (x) { return x.id === b.dataset.redit; })[0]; if (!r) return; if (r.def.kind === 'ready') { F.vpOpen = true; openReport('c:' + r.id); return; } F.custom = JSON.parse(JSON.stringify(r)); go('builder'); }; });
    }

    function pickReady() {
      var list = repKeys().map(function (k) { return { id: k, name: R[k].name, desc: R[k].desc, cat: (CATS.filter(function (c) { return c[0] === R[k].cat; })[0] || [0, ''])[1] }; });
      sheet('اختر التقرير الذي تريد تخصيصه', '<input class="input" id="rpq" placeholder="ابحث باسم التقرير…"><div class="list rp-list" id="rpl"></div>', function (s) {
        var inp = q('#rpq', s.el), box = q('#rpl', s.el);
        var draw = function () {
          var t = normAr(inp.value);
          box.innerHTML = list.filter(function (r) { return !t || normAr(r.name + ' ' + r.desc + ' ' + r.cat).indexOf(t) >= 0; }).map(function (r) { return '<button class="item tap" data-rp="' + r.id + '"><div class="main"><b>' + esc(r.name) + '</b><div class="meta"><span class="badge">' + esc(r.cat) + '</span><span>' + esc(r.desc) + '</span></div></div></button>'; }).join('') || '<p class="muted">لا نتائج</p>';
          qa('[data-rp]', box).forEach(function (b) { b.onclick = function () { s.close(); F.vpOpen = true; openReport(b.dataset.rp); }; });
        };
        inp.oninput = draw; draw(); setTimeout(function () { inp.focus(); }, 50);
      });
    }
