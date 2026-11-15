    // عند الخروج: مسح البيانات المالية من الجهاز
    A.paintSync = paintSync;
    A.onLogout(function () { var pk = Object.keys((F.pks && F.pks.list) || {}); F.packs = {}; F.pks = null; F.rows = null; F.D = null; F.Dby = null; F.Dcache = null; F.br = undefined; F.rev = 0; F.meta = null; F.cur = null; F.edit = null; F.dirtyKeys = null; F.dirty = false; return Promise.all([S.del('fin:rows'), S.del('fin:rev'), S.del('fin:meta'), S.del('fin:aux'), S.del('fin:pks')].concat(pk.map(function (n) { return S.del('fin:pk:' + n); }))); });
    try { st.finParams = JSON.parse(localStorage.getItem('rk.finParams') || '{}'); } catch (e) { st.finParams = {}; }

    // للاختبارات: الوصول للمحرّك
    window.__rkfin = { F: F, R: R, custTreeAccs: custTreeAccs, iclTree: iclTree, resetCache: resetCache, cgOf: cgOf, runCustom: runCustom, runPair: runPair, runFree: runFree, applyView: applyView, CATS: CATS, repCat: repCat, repCollections: repCollections, SRC: SRC, normAr: normAr, build: rebuild, buildOne: build, useBr: useBr, setBr: setBr, withBr: withBr, branches: branches, recvIds: recvIds, runCur: runCur, balance: balance, salesStats: salesStats, evalFormula: evalFormula, tryFormula: tryFormula, evalList: evalList,
      stockTotals: stockTotals, collections: collections, termsToF: termsToF, fToTerms: fToTerms, itemText: function (x) { return itemText(x); }, fltOptions: function (d) { return fltOptions(d); }, dailyData: function () { return dailyData(); }, cards: cards, dailyDef: dailyDef, T: T, evalList: evalList, costAt: costAt, hasPrevYear: hasPrevYear, repKeys: repKeys, prevRange: prevRange, stockAt: stockAt, itemName: itemName, balance: balance };
  };
})();
