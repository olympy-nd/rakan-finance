
    /* ===================== محرّك المعادلات (للبطاقات والتقرير اليومي) ===================== */
    // الدوال: الاسم العربي، والاسم الإنجليزي البديل، والوصف، ونوعها (فترة/في تاريخ)
    var FN = [];
    function fn(ar, en, args, desc, impl, grp) { FN.push({ ar: ar, en: en, args: args, desc: desc, impl: impl, grp: grp }); }
    var G_ACC = 'الحسابات', G_SAL = 'المبيعات والمشتريات', G_CASH = 'التحصيل والصناديق', G_STK = 'المخزون', G_MATH = 'رياضيات';
    fn('رصيد', 'BAL', '"رموز الحسابات"', 'رصيد الحساب (مدين − دائن) في نهاية الفترة. الحساب الرئيسي يشمل فروعه.', function (c, a) { return balance(byCodes(a[0]), null, c.to).close; }, G_ACC);
    fn('رصيد_دائن', 'BALC', '"رموز الحسابات"', 'الرصيد الدائن (دائن − مدين) في نهاية الفترة، مثل الموردين والإيرادات.', function (c, a) { return -balance(byCodes(a[0]), null, c.to).close; }, G_ACC);
    fn('افتتاحي', 'OPEN', '"رموز الحسابات"', 'الرصيد قبل بداية الفترة.', function (c, a) { return balance(byCodes(a[0]), c.from, c.to).open; }, G_ACC);
    fn('حركة', 'MOV', '"رموز الحسابات"', 'صافي حركة الحساب خلال الفترة (مدين − دائن).', function (c, a) { var b = balance(byCodes(a[0]), c.from, c.to); return b.dr - b.cr; }, G_ACC);
    fn('مدين', 'DR', '"رموز الحسابات"', 'مجموع المدين خلال الفترة.', function (c, a) { return balance(byCodes(a[0]), c.from, c.to).dr; }, G_ACC);
    fn('دائن', 'CR', '"رموز الحسابات"', 'مجموع الدائن خلال الفترة.', function (c, a) { return balance(byCodes(a[0]), c.from, c.to).cr; }, G_ACC);
    fn('مديونية', 'DEBT', '', 'مديونية العملاء في نهاية الفترة (حسابات العملاء المحددة في الإعدادات).', function (c) { return balance(recvIds(), null, c.to).close; }, G_ACC);
    fn('الموردون', 'SUPP', '', 'ما للموردين على الشركة في نهاية الفترة (رصيد دائن).', function (c) { return -balance(payIds(), null, c.to).close; }, G_ACC);
    fn('مبيعات', 'SALES', '"تصفية اختيارية"', 'صافي المبيعات (المبيع − المرتجع) في الفترة.', function (c, a) { return salesStats(c.from, c.to, a[0]).net; }, G_SAL);
    fn('مبيعات_إجمالي', 'GSALES', '"تصفية"', 'المبيعات قبل خصم المرتجعات.', function (c, a) { return salesStats(c.from, c.to, a[0]).sales; }, G_SAL);
    fn('مرتجعات', 'RETURNS', '"تصفية"', 'قيمة مرتجعات المبيع.', function (c, a) { return salesStats(c.from, c.to, a[0]).ret; }, G_SAL);
    fn('كمية_مبيعات', 'SQTY', '"تصفية"', 'صافي الكمية المباعة بالوحدة الشائعة (الكرتونة/الصندوق).', function (c, a) { return salesStats(c.from, c.to, a[0]).nqty; }, G_SAL);
    fn('كمية_مرتجعات', 'RQTY', '"تصفية"', 'الكمية المرتجعة.', function (c, a) { return salesStats(c.from, c.to, a[0]).rqty; }, G_SAL);
    fn('هدايا', 'GIFTS', '"تصفية"', 'كمية الهدايا في فواتير المبيع.', function (c, a) { return salesStats(c.from, c.to, a[0]).gift; }, G_SAL);
    fn('ربح', 'PROFIT', '"تصفية"', 'مجمل الربح (القيمة − التكلفة).', function (c, a) { return salesStats(c.from, c.to, a[0]).profit; }, G_SAL);
    fn('تكلفة_مبيعات', 'COGS', '"تصفية"', 'تكلفة البضاعة المباعة.', function (c, a) { return salesStats(c.from, c.to, a[0]).cost; }, G_SAL);
    fn('فواتير_مبيع', 'NINV', '"تصفية"', 'عدد فواتير المبيع.', function (c, a) { return salesStats(c.from, c.to, a[0]).n; }, G_SAL);
    fn('عملاء_مشترون', 'NCUST', '"تصفية"', 'عدد العملاء الذين اشتروا في الفترة.', function (c, a) { return salesStats(c.from, c.to, a[0]).cust; }, G_SAL);
    fn('مشتريات', 'PURCH', '"تصفية"', 'صافي المشتريات (الشراء − مرتجع الشراء).', function (c, a) { var s = salesStats(c.from, c.to, a[0]); return s.purch - s.pret; }, G_SAL);
    fn('كمية_مشتريات', 'PQTY', '"تصفية"', 'صافي الكمية المشتراة بالوحدة الشائعة.', function (c, a) { return salesStats(c.from, c.to, a[0]).pqty; }, G_SAL);
    fn('تحصيل', 'COLL', '"صندوق" أو "بنك" أو اسم', 'المحصّل من العملاء في الفترة إلى الصناديق أو البنوك المعرّفة. بدون قيمة: الكل.', function (c, a) { return collections(c.from, c.to, a[0] || ''); }, G_CASH);
    fn('مقبوضات', 'REC', '', 'مجموع سندات القبض في الفترة.', function (c) { return cashStats(c.from, c.to).rec; }, G_CASH);
    fn('مدفوعات', 'PAY', '', 'مجموع سندات الدفع في الفترة.', function (c) { return cashStats(c.from, c.to).pay; }, G_CASH);
    fn('رصيد_صناديق', 'BOXBAL', '"صندوق" أو "بنك" أو اسم', 'رصيد الصناديق أو البنوك المعرّفة في نهاية الفترة.', function (c, a) { var b = boxIds(a[0] || ''); return b.length ? balance(b, null, c.to).close : 0; }, G_CASH);
    fn('مخزون_كمية', 'STOCKQ', '"المخازن" ، "تصفية"', 'كمية المخزون في نهاية الفترة بالوحدة الشائعة. بدون مخزن: كل المخازن.', function (c, a) { return stockTotals(c.to, splitList(a[0]), a[1]).qty; }, G_STK);
    fn('مخزون_قيمة', 'STOCKV', '"المخازن" ، "تصفية"', 'قيمة المخزون بمتوسط التكلفة في نهاية الفترة.', function (c, a) { return stockTotals(c.to, splitList(a[0]), a[1]).val; }, G_STK);
    fn('أيام', 'DAYS', '', 'عدد أيام الفترة.', function (c) { return days(c.from, c.to) + 1; }, G_MATH);
    fn('قسمة', 'DIV', 'أ ، ب', 'أ ÷ ب، ويعطي صفراً إذا كانت ب صفراً.', function (c, a) { return a[1] ? a[0] / a[1] : 0; }, G_MATH);
    fn('نسبة', 'PCT', 'أ ، ب', 'أ ÷ ب × 100.', function (c, a) { return a[1] ? a[0] / a[1] * 100 : 0; }, G_MATH);
    fn('مطلق', 'ABS', 'س', 'القيمة المطلقة.', function (c, a) { return Math.abs(a[0]); }, G_MATH);
    fn('تقريب', 'ROUND', 'س ، خانات', 'تقريب إلى عدد خانات.', function (c, a) { var k = Math.pow(10, a[1] || 0); return Math.round(a[0] * k) / k; }, G_MATH);
    fn('أكبر', 'MAX', 'أ ، ب ، ...', 'أكبر قيمة.', function (c, a) { return Math.max.apply(null, a); }, G_MATH);
    fn('أصغر', 'MIN', 'أ ، ب ، ...', 'أصغر قيمة.', function (c, a) { return Math.min.apply(null, a); }, G_MATH);
    var FNMAP = {};
    FN.forEach(function (x) { FNMAP[x.ar] = x; FNMAP[x.en] = x; FNMAP[x.en.toLowerCase()] = x; });
    function splitList(s) { return s ? String(s).split(/[,،|]/).map(function (x) { return x.trim(); }).filter(String) : []; }

    function tokenize(src) {
      var out = [], i = 0, s = String(src || '');
      var digits = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.' };
      s = s.replace(/[٠-٩٫]/g, function (c) { return digits[c]; }).replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-').replace(/،/g, ',');
      while (i < s.length) {
        var ch = s[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (/[0-9.]/.test(ch)) { var j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; out.push({ t: 'n', v: Number(s.slice(i, j)) }); i = j; continue; }
        if (ch === '"' || ch === "'" || ch === '«' || ch === '“') {
          var end = ch === '«' ? '»' : ch === '“' ? '”' : ch, k = s.indexOf(end, i + 1);
          if (k < 0) throw new Error('علامة تنصيص غير مغلقة');
          out.push({ t: 's', v: s.slice(i + 1, k) }); i = k + 1; continue;
        }
        if (ch === '[' || ch === '{') {   // [1601] = رصيد الحساب 1601 · {اسم} = قيمة بطاقة أو سطر سابق
          var e2 = s.indexOf(ch === '[' ? ']' : '}', i + 1);
          if (e2 < 0) throw new Error('القوس ' + ch + ' غير مغلق');
          out.push({ t: ch === '[' ? 'acc' : 'var', v: s.slice(i + 1, e2).trim() }); i = e2 + 1; continue;
        }
        if ('+-*/(),'.indexOf(ch) >= 0) { out.push({ t: ch }); i++; continue; }
        var m = /^[A-Za-z_؀-ۿ][A-Za-z0-9_؀-ۿ]*/.exec(s.slice(i));
        if (m) { out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
        throw new Error('رمز غير مفهوم: ' + ch);
      }
      return out;
    }
    function parseFormula(src) {
      var tk = tokenize(src), i = 0;
      if (!tk.length) throw new Error('المعادلة فارغة');
      function peek(t) { return tk[i] && tk[i].t === t; }
      function eat(t) { if (!peek(t)) throw new Error('متوقع «' + t + '»' + (tk[i] ? ' بدل «' + (tk[i].v !== undefined ? tk[i].v : tk[i].t) + '»' : ' في النهاية')); return tk[i++]; }
      function expr() { var n = term(); while (peek('+') || peek('-')) { var op = tk[i++].t; n = { op: op, a: n, b: term() }; } return n; }
      function term() { var n = unary(); while (peek('*') || peek('/')) { var op = tk[i++].t; n = { op: op, a: n, b: unary() }; } return n; }
      function unary() { if (peek('-')) { i++; return { op: 'neg', a: unary() }; } if (peek('+')) { i++; return unary(); } return atom(); }
      function atom() {
        var t = tk[i];
        if (!t) throw new Error('المعادلة ناقصة');
        if (t.t === 'n') { i++; return { num: t.v }; }
        if (t.t === 's') { i++; return { str: t.v }; }
        if (t.t === 'acc') { i++; return { fn: FNMAP['رصيد'], args: [{ str: t.v }] }; }
        if (t.t === 'var') { i++; return { vr: t.v }; }
        if (t.t === '(') { i++; var e = expr(); eat(')'); return e; }
        if (t.t === 'id') {
          i++;
          var f = FNMAP[t.v];
          if (!f) throw new Error('دالة غير معروفة: ' + t.v);
          var args = [];
          if (peek('(')) { i++; if (!peek(')')) { args.push(expr()); while (peek(',')) { i++; args.push(expr()); } } eat(')'); }
          return { fn: f, args: args };
        }
        throw new Error('غير متوقع: ' + t.t);
      }
      var tree = expr();
      if (i < tk.length) throw new Error('زيادة غير مفهومة بعد: ' + (tk[i].v !== undefined ? tk[i].v : tk[i].t));
      return tree;
    }
    function evalTree(n, ctx) {
      if (n.num !== undefined) return n.num;
      if (n.str !== undefined) return n.str;
      if (n.vr !== undefined) {
        if (!ctx.vars || !(n.vr in ctx.vars)) throw new Error('{' + n.vr + '} غير معرّف: اكتب اسم بطاقة أو سطر قبله بالضبط');
        if (typeof ctx.vars[n.vr] !== 'number') throw new Error('{' + n.vr + '} فيه خطأ');
        return ctx.vars[n.vr];
      }
      if (n.fn) return Number(n.fn.impl(ctx, n.args.map(function (a) { return evalTree(a, ctx); }))) || 0;
      var a = evalTree(n.a, ctx);
      if (n.op === 'neg') return -a;
      var b = evalTree(n.b, ctx);
      if (typeof a === 'string' || typeof b === 'string') throw new Error('لا يمكن الحساب على نص: ضع النص داخل دالة');
      return n.op === '+' ? a + b : n.op === '-' ? a - b : n.op === '*' ? a * b : b ? a / b : 0;
    }
    var PARSED = {};
    function evalFormula(src, from, to, vars) {
      var tree = PARSED[src] || (PARSED[src] = parseFormula(src));
      var v = evalTree(tree, { from: from, to: to, vars: vars });
      if (typeof v === 'string') throw new Error('النتيجة نص، وليست رقماً');
      return isFinite(v) ? v : 0;
    }
    function tryFormula(src, from, to, vars) { try { return { v: evalFormula(src, from, to, vars) }; } catch (e) { return { err: e.message }; } }
    // تقييم قائمة (بطاقات أو أسطر) بالترتيب، وكل سطر يمكنه استعمال ما قبله بالاسم {الاسم}
    function evalList(list, from, to) {
      var vars = {};
      return list.map(function (it) {
        if (!it.f) return { sep: true };
        var r = tryFormula(it.f, from, to, vars);
        if (it.name) vars[String(it.name).trim()] = r.err ? 'err' : r.v;
        if (it.sub) { var s2 = tryFormula(it.sub, from, to, vars); r.sub = s2.err ? null : s2.v; }
        return r;
      });
    }
    var FMTS = [['money', 'مبلغ (3 خانات)'], ['money0', 'مبلغ مقرّب'], ['dec2', 'رقم بخانتين'], ['qty', 'كمية'], ['int', 'عدد صحيح'], ['pct', 'نسبة %']];
    function fmtVal(v, f) {
      if (v === null || v === undefined || v === '') return '';
      return f === 'money' ? fm(v) : f === 'money0' ? fk(v) : f === 'dec2' ? f2(v) : f === 'int' ? fk(v) : f === 'pct' ? fp(v) : fq(v);
    }

    /* ---------- الإعدادات الافتراضية للبطاقات والتقرير اليومي ---------- */
    var DEFAULT_CARDS = [
      { id: 'c1', name: 'صافي المبيعات', f: 'مبيعات()', fmt: 'money0', sub: 'فواتير_مبيع()', subl: 'فاتورة مبيع', subfmt: 'int', cmp: true, good: 'up', rep: 'sales_trend' },
      { id: 'c2', name: 'مجمل الربح', f: 'ربح()', fmt: 'money0', sub: 'نسبة(ربح(), مبيعات())', subl: 'هامش الربح', subfmt: 'pct', cmp: true, good: 'up', rep: 'gross_profit' },
      { id: 'c3', name: 'التحصيل', f: 'تحصيل()', fmt: 'money0', sub: 'نسبة(تحصيل(), مبيعات())', subl: 'من المبيعات', subfmt: 'pct', cmp: true, good: 'up', rep: 'collections_cust' },
      { id: 'c4', name: 'مديونية العملاء', f: 'مديونية()', fmt: 'money0', cmp: true, good: 'down', rep: 'recv_balances' },
      { id: 'c5', name: 'أرصدة الصناديق والبنوك', f: 'رصيد_صناديق()', fmt: 'money0', cmp: false, rep: 'boxes' },
      { id: 'c6', name: 'قيمة المخزون', f: 'مخزون_قيمة()', fmt: 'money0', sub: 'مخزون_كمية()', subl: 'كرتونة/وحدة', subfmt: 'qty', cmp: false, rep: 'stock_store' }
    ];
    var DEFAULT_DAILY = { title: 'التقرير اليومي للإدارة', rows: [
      { name: 'Total Sell-Out', f: 'كمية_مبيعات()', fmt: 'dec2' },
      { name: 'Total Sell-Out Amount', f: 'مبيعات()', fmt: 'dec2' },
      { name: 'Total Collection Cash', f: 'تحصيل("صندوق")', fmt: 'dec2' },
      { name: 'Total Collection Transfer', f: 'تحصيل("بنك")', fmt: 'dec2' },
      { name: 'AL ZAHRA Account', f: 'رصيد_دائن("261004")', fmt: 'dec2' },
      { name: 'Total Dept in the market', f: 'مديونية()', fmt: 'dec2' },
      { name: 'Inventory (Qty) Main', f: 'مخزون_كمية("المستودع الرئيسي")', fmt: 'dec2' },
      { name: 'Inventory Value Main', f: 'مخزون_قيمة("المستودع الرئيسي")', fmt: 'dec2' },
      { name: 'Inventory (Qty) Agents', f: 'مخزون_كمية("بنغازي,سبها")', fmt: 'dec2' },
      { name: 'Inventory Value Agents', f: 'مخزون_قيمة("بنغازي,سبها")', fmt: 'dec2' },
      { name: 'Avarage Selling Price', f: 'قسمة(مبيعات(), كمية_مبيعات())', fmt: 'dec2' }
    ] };
    function cards() { return (F.config.cards && F.config.cards.length ? F.config.cards : DEFAULT_CARDS); }
    function dailyDef() { return F.config.daily && F.config.daily.rows ? F.config.daily : DEFAULT_DAILY; }
