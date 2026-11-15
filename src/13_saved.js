    /* ===================== الفلاتر الجاهزة وقالب التجميع =====================
       فلتر جاهز = تصفية محفوظة باسم (عملاء، حسابات، مجموعات، أصناف…) تُستدعى في أي تقرير، أو تُثبَّت لتُطبَّق على كل تقرير يُفتح.
       قالب التجميع = عرض صفوف العملاء مجمّعة تحت مجموعاتها (أو حساباتها الأب) في أي تقرير، ويمكن جعله الافتراضي لكل التقارير. */
    function savedFilters() {
      var l = F.config && Array.isArray(F.config.filters) ? F.config.filters : null;
      if (!l) { try { l = JSON.parse(localStorage.getItem('rk.finFilters') || 'null'); } catch (e) { l = null; } }
      return (l || []).filter(function (x) { return x && x.id && x.name && x.flt; });
    }
    function saveConfigKey(k, value, lsKey) {
      return call('fin_config_save', { key: k, value: value }).then(function (r) {
        F.config = r.config || {}; if (value === null) delete F.config[k]; S.set('fin:aux', { boxes: F.boxes, reports: F.reports, config: F.config }); try { localStorage.removeItem(lsKey); } catch (e) {} return false;
      }).catch(function (e) {
        if (!/غير معروف/.test(e.message)) throw e;
        try { if (value === null) localStorage.removeItem(lsKey); else localStorage.setItem(lsKey, JSON.stringify(value)); } catch (x) {} if (F.config) delete F.config[k]; return true;
      });
    }
    function storeFilters(list) { return saveConfigKey('filters', list.length ? list : null, 'rk.finFilters'); }
    // نوع الفلتر: الأبعاد التي فيه (لترتيب الفلاتر الجاهزة في أقسام)
    var FKEY_ORDER = ['cgrp', 'cacc', 'cust', 'ag', 'cat', 'item', 'st', 'u', 'xcgrp', 'xcacc', 'xcust', 'xcat', 'xitem'];
    var FKEY_SEC = { cgrp: 'مجموعات العملاء', xcgrp: 'مجموعات العملاء', cacc: 'حسابات العملاء', xcacc: 'حسابات العملاء', cust: 'العملاء', xcust: 'العملاء', ag: 'المناديب', cat: 'فئات المناديب', xcat: 'فئات المناديب', item: 'الأصناف', xitem: 'الأصناف', st: 'المخازن', u: 'المستخدمون' };
    function fltType(f) { f = fObj(f); var ks = FKEY_ORDER.filter(function (k) { return f[k] && f[k].length; }), secs = []; ks.forEach(function (k) { var s0 = FKEY_SEC[k] || k; if (secs.indexOf(s0) < 0) secs.push(s0); }); return secs.length ? secs.join(' + ') : 'أخرى'; }
    function fltSummary(f) { f = fObj(f); return FKEY_ORDER.filter(function (k) { return f[k] && f[k].length; }).map(function (k) { return (FLT_LABEL[k] || k) + ': ' + f[k].map(function (x) { return fltName(k, x); }).join('، '); }).join(' · '); }
    function fltFor(f, dims) { f = fObj(f); var ok = {}, o = {}; dims.forEach(function (d) { ok[DIM[d][0]] = 1; }); Object.keys(f).forEach(function (k) { if (ok[k] && f[k] && f[k].length) o[k] = f[k].slice(); }); return fCount(o) ? o : null; }
    function groupedSaved(list) {
      var sec = {}, order = [];
      list.forEach(function (x) { var t = fltType(x.flt); if (!sec[t]) { sec[t] = []; order.push(t); } sec[t].push(x); });
      return order.map(function (t) { return [t, sec[t]]; });
    }
    function askName(title, val) {
      return new Promise(function (res) {
        sheet(title, '<div class="form"><div class="field"><label class="lbl" for="snm">الاسم</label><input id="snm" class="input" value="' + esc(val || '') + '" placeholder="مثل: وكلاء الشرقية والغربية"></div><button class="btn primary big" id="snok">حفظ</button></div>', function (s) {
          var i = q('#snm', s.el); setTimeout(function () { i.focus(); i.select(); }, 50);
          var ok = function () { var v = i.value.trim(); if (!v) { i.focus(); return; } s.done = true; s.close(); res(v); };
          q('#snok', s.el).onclick = ok; i.onkeydown = function (e) { if (e.key === 'Enter') ok(); };
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    function saveCurrentFilter(f) {
      return askName('حفظ كفلتر جاهز', '').then(function (name) {
        if (!name) return;
        var list = savedFilters().slice(); list.push({ id: 'f' + Date.now().toString(36), name: name.slice(0, 60), flt: fObj(f), by: (A.st.user && A.st.user.name) || '' });
        return storeFilters(list).then(function (local) { toast(local ? 'حُفظ على هذا الجهاز فقط حتى يُحدَّث الخادم' : 'حُفظ في «الفلاتر الجاهزة»'); A.render(); });
      }).catch(function (e) { toast(e.message, true); });
    }
    // قائمة الفلاتر الجاهزة لاختيار واحد منها في تقرير
    function pickSaved(dims) {
      return new Promise(function (res) {
        var list = savedFilters();
        sheet('الفلاتر الجاهزة', '<div class="sf-pick">' + groupedSaved(list).map(function (g) {
          return '<div class="sf-sec">' + esc(g[0]) + '</div>' + g[1].map(function (x) {
            var fit = fltFor(x.flt, dims), part = fit && fCount(fit) < fCount(x.flt);
            return '<button class="item tap sf-it" data-sf="' + esc(x.id) + '"' + (fit ? '' : ' disabled') + '><div class="main"><b>' + esc(x.name) + '</b><div class="meta"><span>' + esc(fltSummary(x.flt)) + '</span>' + (!fit ? '<span class="derr">لا يناسب هذا التقرير</span>' : part ? '<span class="muted">يُطبَّق جزء منه فقط</span>' : '') + '</div></div></button>';
          }).join('');
        }).join('') + '</div>', function (s) {
          qa('[data-sf]', s.el).forEach(function (b) { b.onclick = function () { s.done = true; s.close(); res(list.filter(function (x) { return x.id === b.dataset.sf; })[0]); }; });
          s.onclose = function () { if (!s.done) res(null); };
        });
      });
    }
    // الفلتر المثبّت: يُطبَّق على كل تقرير يُفتح بعده (إن كان التقرير يقبل أبعاده)
    function pinnedFilter() { if (F.pinF === undefined) { try { F.pinF = JSON.parse(localStorage.getItem('rk.finPin') || 'null'); } catch (e) { F.pinF = null; } } return F.pinF; }
    function setPinned(x) { F.pinF = x || null; try { if (x) localStorage.setItem('rk.finPin', JSON.stringify(x)); else localStorage.removeItem('rk.finPin'); } catch (e) {} }

    // قسم «الفلاتر الجاهزة» في الصفحة الأولى للتقارير
    function savedHomeHTML() {
      var list = savedFilters(), pin = pinnedFilter();
      var h = '<section class="card sf-home"><div class="sf-head"><h2>الفلاتر الجاهزة <span class="badge">' + list.length + '</span></h2>' + (pin ? '<span class="sf-pin-on">مثبّت الآن: <b>' + esc(pin.name) + '</b><button class="btn sm ghost" data-sfunpin>إلغاء التثبيت</button></span>' : '') + '</div>';
      if (!list.length) return h + '<p class="small muted" style="margin:0">لا توجد فلاتر محفوظة بعد. افتح أي تقرير، اختر التصفية التي تريدها (عملاء، حسابات، مجموعات، أصناف…) ثم اضغط «☆ حفظ كفلتر جاهز»، فتظهر هنا لتستدعيها في أي وقت.</p></section>';
      h += '<p class="small muted" style="margin:0 0 10px">«تثبيت» يطبّق الفلتر على كل تقرير تفتحه حتى تلغيه. ويمكن أيضاً اختياره من زر «الفلاتر الجاهزة» داخل أي تقرير.</p>';
      groupedSaved(list).forEach(function (g) {
        h += '<div class="sf-sec">' + esc(g[0]) + ' <span class="badge">' + g[1].length + '</span></div><div class="sf-grid">' + g[1].map(function (x) {
          var on = pin && pin.id === x.id;
          return '<div class="sf-card' + (on ? ' on' : '') + '"><b>' + esc(x.name) + '</b><span class="sf-sum">' + esc(fltSummary(x.flt)) + '</span>' + (x.by ? '<span class="small muted">' + esc(x.by) + '</span>' : '') +
            '<div class="sf-act"><button class="btn sm ' + (on ? 'ghost' : 'primary') + '" data-sfpin="' + esc(x.id) + '">' + (on ? 'مثبّت ✓' : 'تثبيت على كل التقارير') + '</button>' +
            (canEdit() ? '<button class="iconbtn" data-sfren="' + esc(x.id) + '" title="إعادة تسمية" aria-label="إعادة تسمية">✎</button><button class="iconbtn" data-sfdel="' + esc(x.id) + '" title="حذف" aria-label="حذف">✕</button>' : '') + '</div></div>';
        }).join('') + '</div>';
      });
      return h + '</section>';
    }
    function bindSavedHome(m) {
      var list = savedFilters();
      qa('[data-sfpin]', m).forEach(function (b) { b.onclick = function () { var x = list.filter(function (y) { return y.id === b.dataset.sfpin; })[0], pin = pinnedFilter(); setPinned(pin && pin.id === x.id ? null : { id: x.id, name: x.name, flt: x.flt }); toast(pinnedFilter() ? 'سيُطبَّق «' + x.name + '» على كل تقرير تفتحه' : 'أُلغي التثبيت'); A.render(); }; });
      var up = q('[data-sfunpin]', m); if (up) up.onclick = function () { setPinned(null); A.render(); };
      qa('[data-sfdel]', m).forEach(function (b) { b.onclick = function () { var x = list.filter(function (y) { return y.id === b.dataset.sfdel; })[0]; A.confirmBox('حذف الفلتر', 'حذف الفلتر الجاهز «' + esc(x.name) + '»؟', 'حذف').then(function (y) { if (!y) return; var pin = pinnedFilter(); if (pin && pin.id === x.id) setPinned(null); storeFilters(list.filter(function (z) { return z.id !== x.id; })).then(function () { toast('حُذف'); A.render(); }).catch(function (e) { toast(e.message, true); }); }); }; });
      qa('[data-sfren]', m).forEach(function (b) { b.onclick = function () { var x = list.filter(function (y) { return y.id === b.dataset.sfren; })[0]; askName('إعادة تسمية الفلتر', x.name).then(function (n) { if (!n) return; var l2 = list.map(function (z) { return z.id === x.id ? Object.assign({}, z, { name: n }) : z; }); storeFilters(l2).then(function () { var pin = pinnedFilter(); if (pin && pin.id === x.id) setPinned(Object.assign({}, pin, { name: n })); A.render(); }).catch(function (e) { toast(e.message, true); }); }); }; });
    }

    // شريط قالب التجميع فوق جدول التقرير
    function grpBarHTML(res, p) {
      var cur = p.cgx && p.cgx !== 'auto' ? p.cgx : 'auto', def = grpDefault(), eff = grpMode(p), bySel = res._grouped === 'cacc' || res._grouped === 'cgrp';
      return '<div class="grp-bar"><span class="grp-t">تجميع العملاء:</span>' + (bySel ? '<span class="small muted">حسب ما حددته في التصفية</span>' :
        GRP_MODES.map(function (m0) { var on = eff === m0[0] || (m0[0] === 'grp' && eff === 'parent' && cur === 'grp'); return '<button class="chip' + (on ? ' on' : '') + '" data-cgx="' + m0[0] + '">' + m0[1] + '</button>'; }).join('') +
        (canEdit() && eff !== def ? '<button class="btn sm ghost" data-cgxdef="' + eff + '">اجعله الافتراضي لكل التقارير</button>' : (def !== 'none' ? '<span class="small muted">' + (cur === 'auto' ? '(الافتراضي لكل التقارير)' : '') + '</span>' : ''))) + '</div>';
    }
    function bindGrpBar(m, p, save) {
      qa('[data-cgx]', m).forEach(function (b) { b.onclick = function () { p.cgx = b.dataset.cgx === grpDefault() ? 'auto' : b.dataset.cgx; save(); A.render(); }; });
      var d = q('[data-cgxdef]', m);
      if (d) d.onclick = function () {
        var v = d.dataset.cgxdef, ui = Object.assign({}, (F.config && F.config.ui) || {}, { grp: v });
        saveConfigKey('ui', ui, 'rk.finUi').then(function (local) { if (local) try { localStorage.setItem('rk.finUi', JSON.stringify(ui)); } catch (e) {} p.cgx = 'auto'; save(); toast(v === 'none' ? 'أصبح الافتراضي: بدون تجميع' : 'أصبح الافتراضي في كل تقارير العملاء: ' + GRP_MODES.filter(function (x) { return x[0] === v; })[0][1]); A.render(); }).catch(function (e) { toast(e.message, true); });
      };
    }
