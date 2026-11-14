    /* ===================== تخصيص أي تقرير: بحث، شروط على الأعمدة، إخفاء أعمدة، أعلى N، وحفظ نسخة مخصصة ===================== */
    var VOPS_T = [['has', 'يحتوي'], ['nhas', 'لا يحتوي'], ['eq', 'يساوي']];
    var VOPS_N = [['gt', 'أكبر من'], ['lt', 'أصغر من'], ['ge', '≥'], ['le', '≤'], ['eqn', 'يساوي'], ['ne0', 'غير صفر']];
    function rowVal(r, k) { var v = r[k]; return v === undefined || v === null ? '' : v; }
    function vCondPass(c, r, col) {
      var v = rowVal(r, c.k);
      if (col && isNum(col)) {
        if (v === '') return c.op === 'ne0' ? false : c.op === 'lt' || c.op === 'le';
        var x = Number(v) || 0, n = Number(c.v) || 0;
        return c.op === 'gt' ? x > n : c.op === 'lt' ? x < n : c.op === 'ge' ? x >= n : c.op === 'le' ? x <= n : c.op === 'ne0' ? Math.abs(x) > 0.0005 : Math.abs(x - n) < 0.0005;
      }
      var t = normAr(plain(v)), ws = kwList(c.v);
      if (!ws.length) return true;
      if (c.op === 'eq') return ws.some(function (w) { return w === t; });
      var any = ws.some(function (w) { return t.indexOf(w) >= 0; });
      return c.op === 'nhas' ? !any : any;
    }
    function hasView(v) { return !!(v && ((v.q && v.q.trim()) || (v.rf || []).some(function (c) { return c.k && (c.v !== '' && c.v !== undefined || c.op === 'ne0'); }) || (v.hide || []).length || Number(v.lim))); }
    function applyView(res, v) {
      if (!res || res.empty || !res.cols || !hasView(v)) return res;
      var colOf = {}; res.cols.forEach(function (c) { colOf[c.k] = c; });
      var conds = (v.rf || []).filter(function (c) { return c.k && colOf[c.k] && (c.v !== '' && c.v !== undefined || c.op === 'ne0'); });
      var qs = kwList(v.q || ''), before = res.rows.length;
      var hier = res.rows.some(function (r) { return r._lvl; });
      var keep = function (r) {
        if (qs.length && !qs.every(function (w) { return res.cols.some(function (c) { return normAr(plain(rowVal(r, c.k))).indexOf(w) >= 0; }); })) return false;
        return conds.every(function (c) { return vCondPass(c, r, colOf[c.k]); });
      };
      var rows = (qs.length || conds.length) ? res.rows.filter(function (r) { return (r._b && !hier && !qs.length && !conds.length) || keep(r); }) : res.rows.slice();
      var lim = Number(v.lim) || 0;
      if (lim && rows.length > lim) rows = rows.slice(0, lim);
      var out = Object.assign({}, res, { rows: rows });
      var filtered = rows.length !== before;
      if (filtered && res.total && !hier) {
        var t = Object.assign({}, res.total);
        res.cols.forEach(function (c) { if (['money', 'money0', 'int', 'qty'].indexOf(c.t) >= 0 && typeof res.total[c.k] === 'number') t[c.k] = rows.reduce(function (s, r) { return r._b ? s : s + (Number(r[c.k]) || 0); }, 0); });
        out.total = t;
      } else if (filtered && hier) out.total = null;
      var hide = (v.hide || []).filter(function (k) { return k !== res.cols[0].k; });
      if (hide.length) out.cols = res.cols.filter(function (c) { return hide.indexOf(c.k) < 0; });
      if (filtered) out.note = (res.note ? plain(res.note) + ' · ' : '') + 'بعد التخصيص: ' + rows.length + ' من ' + before + ' سطر';
      if (out.chart && filtered && !out.chart.rowsOverride) out.chart = Object.assign({}, out.chart);
      return out;
    }
    function viewPanelHTML(res, p) {
      var v = p.view || {}, cols = (F.cur && F.cur.rawCols) || res.cols || [];
      if (!cols.length) return '';
      var n = (v.q ? 1 : 0) + (v.rf || []).filter(function (c) { return c.k; }).length + (v.hide || []).length + (Number(v.lim) ? 1 : 0);
      var open = n || (F.vpOpen);
      var copt = function (k) { return cols.map(function (c) { return '<option value="' + esc(c.k) + '"' + (c.k === k ? ' selected' : '') + '>' + esc(c.l) + '</option>'; }).join(''); };
      return '<details class="fp vp" data-vp' + (open ? ' open' : '') + '><summary class="fp-sum"><span class="fp-t">' + ICON_FILTER + ' تخصيص التقرير</span>' + (n ? '<span class="fp-cnt">' + n + ' تعديل</span>' : '<span class="small muted">بحث، شروط، أعمدة، أعلى…</span>') + '</summary><div class="vp-b">' +
        '<div class="vp-row"><input class="input" id="vq" value="' + esc(v.q || '') + '" placeholder="ابحث في نتائج هذا التقرير…" aria-label="بحث في النتائج">' +
        '<select class="input vp-lim" id="vlim" aria-label="عدد الأسطر">' + [[0, 'كل الأسطر'], [10, 'أول 10'], [20, 'أول 20'], [50, 'أول 50'], [100, 'أول 100']].map(function (o) { return '<option value="' + o[0] + '"' + (Number(v.lim || 0) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="vp-h">الشروط على الأعمدة</div><div class="vp-conds">' + (v.rf || []).map(function (c, i) {
          var col = cols.filter(function (x) { return x.k === c.k; })[0] || cols[0], num = isNum(col), ops = num ? VOPS_N : VOPS_T;
          return '<div class="vp-cond"><select class="input" data-vk="' + i + '">' + copt(col.k) + '</select><select class="input" data-vo="' + i + '">' + ops.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === c.op ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
            (c.op === 'ne0' ? '<span></span>' : '<input class="input" data-vv="' + i + '" value="' + esc(c.v === undefined ? '' : c.v) + '"' + (num ? ' type="number" inputmode="decimal"' : '') + ' placeholder="' + (num ? '0' : 'كلمة أو أكثر') + '">') +
            '<button type="button" class="iconbtn" data-vx="' + i + '" aria-label="حذف">' + ICON.close + '</button></div>';
        }).join('') + '</div><button type="button" class="btn sm" data-vadd>+ شرط</button>' +
        '<div class="vp-h">الأعمدة الظاهرة</div><div class="st-pills">' + cols.map(function (c, i) { var on = (v.hide || []).indexOf(c.k) < 0; return '<button type="button" class="pill' + (on ? ' on' : '') + '" data-vcol="' + esc(c.k) + '"' + (i ? '' : ' disabled') + '>' + (on ? '✓ ' : '') + esc(c.l) + '</button>'; }).join('') + '</div>' +
        '<div class="row vp-act">' + (n ? '<button type="button" class="btn sm ghost" data-vreset>إلغاء كل التعديلات</button>' : '') + '<span class="grow"></span>' +
        (canEdit() ? (F.cur.custom && F.cur.custom.id ? '<button type="button" class="btn sm accent" data-vsave>حفظ التغييرات في التقرير</button>' : '') + '<button type="button" class="btn sm' + (F.cur.custom && F.cur.custom.id ? ' ghost' : ' accent') + '" data-vcopy>حفظ نسخة باسم جديد</button>' : '') + '</div></div></details>';
    }
    function bindViewPanel(m, save) {
      var c = F.cur, p = c.p, v = p.view || (p.view = {}), cols = c.rawCols || [];
      var dt = q('[data-vp]', m); if (!dt) return;
      dt.addEventListener('toggle', function () { F.vpOpen = dt.open; });
      var re = function () { save(); A.render(); };
      var tq = null;
      q('#vq', m).oninput = function () { v.q = this.value; clearTimeout(tq); tq = setTimeout(function () { save(); A.render(); var i = q('#vq'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 500); };
      q('#vlim', m).onchange = function () { v.lim = Number(this.value) || 0; re(); };
      q('[data-vadd]', m).onclick = function () { v.rf = v.rf || []; var nums = cols.filter(function (x) { return isNum(x); }), nc = CMP_PREF.map(function (k) { return nums.filter(function (x) { return x.k === k; })[0]; }).filter(Boolean)[0] || nums[0] || cols[0]; v.rf.push({ k: nc.k, op: isNum(nc) ? 'gt' : 'has', v: '' }); F.vpOpen = true; re(); };
      qa('[data-vk]', m).forEach(function (el) { el.onchange = function () { var cnd = v.rf[Number(el.dataset.vk)], col = cols.filter(function (x) { return x.k === el.value; })[0]; cnd.k = el.value; cnd.op = col && isNum(col) ? 'gt' : 'has'; cnd.v = ''; re(); }; });
      qa('[data-vo]', m).forEach(function (el) { el.onchange = function () { v.rf[Number(el.dataset.vo)].op = el.value; re(); }; });
      qa('[data-vv]', m).forEach(function (el) { el.onchange = function () { v.rf[Number(el.dataset.vv)].v = el.value; re(); }; el.onkeydown = function (e) { if (e.key === 'Enter') el.onchange(); }; });
      qa('[data-vx]', m).forEach(function (b) { b.onclick = function () { v.rf.splice(Number(b.dataset.vx), 1); re(); }; });
      qa('[data-vcol]', m).forEach(function (b) { b.onclick = function () { v.hide = v.hide || []; var k = b.dataset.vcol, i = v.hide.indexOf(k); if (i >= 0) v.hide.splice(i, 1); else v.hide.push(k); re(); }; });
      var rs = q('[data-vreset]', m); if (rs) rs.onclick = function () { p.view = {}; re(); };
      var defOf = function () {
        var keepP = {}; Object.keys(p).forEach(function (k) { if (['view', 'from', 'to', 'year', 'month', 'cmpcol'].indexOf(k) < 0 || (p.preset === 'custom' && (k === 'from' || k === 'to'))) keepP[k] = p[k]; });
        if (c.custom) { var d0 = cleanDef(c.custom.def); d0.view = JSON.parse(JSON.stringify(p.view || {})); if (d0.kind === 'ready') d0.p = keepP; else d0.p = { preset: p.preset, flt: p.flt || null }; return d0; }
        return { kind: 'ready', base: c.id, p: keepP, view: JSON.parse(JSON.stringify(p.view || {})) };
      };
      var vs = q('[data-vsave]', m);
      if (vs) vs.onclick = function () {
        busy(vs, true);
        call('fin_report_save', { report: { id: c.custom.id, name: c.custom.name, cat: c.custom.cat || 'تقاريري', def: defOf() } }).then(function (r) { F.reports = r.reports; var s2 = r.reports.filter(function (x) { return x.id === c.custom.id; })[0]; if (s2) c.custom = s2; toast('حُفظت التغييرات'); A.render(); })
          .catch(function (e) { busy(vs, false); toast(e.message, true); });
      };
      var vc = q('[data-vcopy]', m);
      if (vc) vc.onclick = function () {
        var base = c.custom ? c.custom.name : (R[c.id] || {}).name;
        sheet('حفظ نسخة مخصصة', '<p class="small muted" style="margin:0 0 8px">تُحفظ النسخة بالإعدادات الحالية (الفترة، التصفية، الشروط، الأعمدة) في «تقاريري» لكل المستخدمين، ويبقى التقرير الأصلي كما هو.</p>' +
          '<div class="field"><label class="lbl" for="vcn">اسم التقرير</label><input id="vcn" class="input" value="' + esc(base + (c.custom ? ' (نسخة)' : ' - مخصص')) + '"></div><button class="btn primary big" data-vcok>حفظ</button>', function (s) {
          var inp = q('#vcn', s.el); setTimeout(function () { inp.focus(); inp.select(); }, 50);
          q('[data-vcok]', s.el).onclick = function () {
            var name = inp.value.trim(); if (!name) { inp.focus(); return; }
            var b = this; busy(b, true);
            call('fin_report_save', { report: { name: name, cat: 'تقاريري', def: defOf() } }).then(function (r) {
              F.reports = r.reports; s.close(); var saved = r.reports.filter(function (x) { return x.name === name; }).pop(); toast('حُفظ «' + name + '» في تقاريري'); if (saved) openReport('c:' + saved.id); else A.render();
            }).catch(function (e) { busy(b, false); toast(e.message, true); });
          };
        });
      };
    }
