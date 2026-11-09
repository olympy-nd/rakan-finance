/* راكان المالية · التخزين على الجهاز والاتصال بالخادم */
(function (root) {
  'use strict';
  var DB_NAME = 'rakan-finance', DB_VER = 1, dbp = null;

  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains('kv')) r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('kv', mode), out = fn(t.objectStore('kv'));
        t.oncomplete = function () { res(typeof IDBRequest !== 'undefined' && out instanceof IDBRequest ? out.result : undefined); };
        t.onerror = function () { rej(t.error); };
        t.onabort = function () { rej(t.error); };
      });
    });
  }
  var S = {
    get: function (k) { return tx('readonly', function (s) { return s.get(k); }); },
    set: function (k, v) { return tx('readwrite', function (s) { s.put(v, k); }); },
    del: function (k) { return tx('readwrite', function (s) { s.delete(k); }); },
    clearAll: function () { return tx('readwrite', function (s) { s.clear(); }); }
  };
  function uuid() {
    if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  }
  // الوقت بتوقيت طرابلس (UTC+2)
  function nowStr(d) { return new Date((d ? d.getTime() : Date.now()) + 2 * 3600e3).toISOString().slice(0, 19).replace('T', ' '); }
  function netErr(m) { var e = new Error(m); e.net = true; return e; }
  function api(action, body, opts) {
    opts = opts || {};
    return Promise.all([S.get('token'), S.get('device')]).then(function (v) {
      var payload = Object.assign({ app: 1, action: action, token: v[0], device: v[1] }, body || {});
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timer = ctl ? setTimeout(function () { ctl.abort(); }, opts.timeout || 45000) : null;
      return fetch(root.RAKAN_FIN_API, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow', signal: ctl && ctl.signal })
        .then(function (r) { if (!r.ok) throw netErr('الخادم لا يستجيب (' + r.status + ')'); return r.text(); })
        .then(function (t) { try { return JSON.parse(t); } catch (e) { throw netErr('رد غير مفهوم من الخادم'); } },
          function (e) { if (e && e.net) throw e; throw netErr('لا يوجد اتصال بالإنترنت'); })
        .finally(function () { if (timer) clearTimeout(timer); });
    });
  }
  root.RK = { S: S, api: api, uuid: uuid, nowStr: nowStr };
})(typeof self !== 'undefined' ? self : this);
