(function () {
  'use strict';

  var TOKEN_KEY = 'ptcg_token';

  var DEFAULT_CARD_STATUS_LINES = ['在库', '已售', '出借', '送评中', '其他'];

  var authPanel = document.getElementById('ptcgAuth');
  var appPanel = document.getElementById('fieldsApp');
  var loginForm = document.getElementById('ptcgLoginForm');
  var loginErr = document.getElementById('ptcgLoginErr');
  var tabLogin = document.getElementById('tabLogin');
  var tabRegister = document.getElementById('tabRegister');
  var loginPanel = document.getElementById('ptcgLoginPanel');
  var registerPanel = document.getElementById('ptcgRegisterPanel');
  var registerForm = document.getElementById('ptcgRegisterForm');
  var registerErr = document.getElementById('ptcgRegisterErr');

  var pairsContainer = document.getElementById('langVersionPairs');
  var btnAddLangRow = document.getElementById('btnAddLangRow');
  var legacyVersionRows = document.getElementById('legacyVersionRows');
  var btnAddLegacyVer = document.getElementById('btnAddLegacyVer');

  function getToken() {
    try {
      return sessionStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function setToken(t) {
    try {
      if (t) sessionStorage.setItem(TOKEN_KEY, t);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  function authHeaders() {
    var t = getToken();
    var h = { 'Content-Type': 'application/json' };
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  }

  function switchTab(tab) {
    if (!loginPanel || !registerPanel) return;
    if (tab === 'register') {
      if (tabLogin) tabLogin.classList.remove('active');
      if (tabRegister) tabRegister.classList.add('active');
      loginPanel.classList.add('hidden');
      registerPanel.classList.remove('hidden');
    } else {
      if (tabLogin) tabLogin.classList.add('active');
      if (tabRegister) tabRegister.classList.remove('active');
      loginPanel.classList.remove('hidden');
      registerPanel.classList.add('hidden');
    }
    if (loginErr) loginErr.textContent = '';
    if (registerErr) registerErr.textContent = '';
  }

  if (tabLogin) tabLogin.addEventListener('click', function () { switchTab('login'); });
  if (tabRegister) tabRegister.addEventListener('click', function () { switchTab('register'); });

  function showAuth() {
    if (authPanel) authPanel.classList.remove('hidden');
    if (appPanel) appPanel.classList.add('hidden');
    switchTab('login');
  }

  function showApp() {
    if (authPanel) authPanel.classList.add('hidden');
    if (appPanel) appPanel.classList.remove('hidden');
  }

  function verifyToken() {
    var t = getToken();
    if (!t) return Promise.resolve(false);
    return fetch('/api/ptcg/verify', {
      headers: { Authorization: 'Bearer ' + t },
      credentials: 'same-origin',
    }).then(function (r) {
      return r.ok;
    }).catch(function () {
      return false;
    });
  }

  function linesToArr(text) {
    if (!text || !String(text).trim()) return [];
    return String(text)
      .split(/\r?\n/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function arrToLines(arr) {
    if (!arr || !arr.length) return '';
    return arr.join('\n');
  }

  function clearPairs() {
    if (pairsContainer) pairsContainer.innerHTML = '';
  }

  function clearLegacyRows() {
    if (legacyVersionRows) legacyVersionRows.innerHTML = '';
  }

  function normalizeVersionEntryLoad(v) {
    if (v == null) return { name: '', year: '', code: '', maxNo: '' };
    if (typeof v === 'string') {
      return { name: String(v).trim(), year: '', code: '', maxNo: '' };
    }
    if (typeof v === 'object') {
      var maxRaw = v.maxNo != null ? v.maxNo : v.numberMax != null ? v.numberMax : '';
      return {
        name: v.name != null ? String(v.name).trim() : '',
        year: v.year != null && v.year !== '' ? String(v.year) : '',
        code:
          v.code != null
            ? String(v.code).trim()
            : v.versionCode != null
              ? String(v.versionCode).trim()
              : '',
        maxNo: maxRaw !== '' && maxRaw != null ? String(maxRaw) : '',
      };
    }
    return { name: '', year: '', code: '', maxNo: '' };
  }

  function addVersionMetaRow(container, entry) {
    if (!container) return;
    entry = entry || {};
    var name = entry.name != null ? String(entry.name) : '';
    var year = entry.year != null && entry.year !== '' ? String(entry.year) : '';
    var code = entry.code != null ? String(entry.code) : '';
    var maxNo = entry.maxNo != null && entry.maxNo !== '' ? String(entry.maxNo) : '';
    var row = document.createElement('div');
    row.className = 'version-meta-row';
    row.innerHTML =
      '<div class="version-meta-cols">' +
      '<div class="version-meta-field">' +
      '<label>版本名称</label>' +
      '<input type="text" class="vm-name" maxlength="128" placeholder="如：朱紫">' +
      '</div>' +
      '<div class="version-meta-field">' +
      '<label>年份</label>' +
      '<input type="number" class="vm-year" min="0" max="9999" step="1" placeholder="如：2023">' +
      '</div>' +
      '<div class="version-meta-field">' +
      '<label>扩展编号</label>' +
      '<input type="text" class="vm-code" maxlength="128" placeholder="如：SV1">' +
      '</div>' +
      '<div class="version-meta-field">' +
      '<label>编号上限</label>' +
      '<input type="number" class="vm-max" min="1" max="999999" step="1" placeholder="如：207">' +
      '</div>' +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm vm-rm" title="移除此版本">×</button>';
    var inpN = row.querySelector('.vm-name');
    var inpY = row.querySelector('.vm-year');
    var inpC = row.querySelector('.vm-code');
    var inpM = row.querySelector('.vm-max');
    var btnRm = row.querySelector('.vm-rm');
    if (inpN) inpN.value = name;
    if (inpY) inpY.value = year;
    if (inpC) inpC.value = code;
    if (inpM) inpM.value = maxNo;
    if (btnRm) {
      btnRm.addEventListener('click', function () {
        row.remove();
      });
    }
    container.appendChild(row);
  }

  function collectVersionRows(container) {
    var out = [];
    if (!container) return out;
    var rows = container.querySelectorAll('.version-meta-row');
    rows.forEach(function (row) {
      var nameEl = row.querySelector('.vm-name');
      var yearEl = row.querySelector('.vm-year');
      var codeEl = row.querySelector('.vm-code');
      var maxEl = row.querySelector('.vm-max');
      var n = nameEl && nameEl.value ? String(nameEl.value).trim() : '';
      if (!n) return;
      var o = { name: n };
      if (yearEl && yearEl.value !== '') {
        var y = parseInt(yearEl.value, 10);
        if (!Number.isNaN(y) && y >= 0 && y <= 9999) o.year = y;
      }
      if (codeEl && codeEl.value.trim()) o.code = String(codeEl.value).trim();
      if (maxEl && maxEl.value !== '') {
        var mx = parseInt(maxEl.value, 10);
        if (!Number.isNaN(mx) && mx >= 1 && mx <= 999999) o.maxNo = mx;
      }
      out.push(o);
    });
    return out;
  }

  function addLangRow(lang, versions) {
    if (!pairsContainer) return;
    lang = lang != null ? String(lang) : '';
    versions = Array.isArray(versions) ? versions : [];
    var row = document.createElement('div');
    row.className = 'lang-version-row';
    row.innerHTML =
      '<div class="lang-version-row-inner">' +
      '<div class="lang-version-field">' +
      '<label>语言</label>' +
      '<input type="text" class="lang-version-input-lang" maxlength="128" placeholder="如：简中" value="">' +
      '</div>' +
      '<div class="lang-version-field lang-version-field--grow">' +
      '<label>该语言的版本（名称 · 年份 · 扩展编号 · 编号上限）</label>' +
      '<div class="version-meta-rows"></div>' +
      '<button type="button" class="btn btn-secondary btn-sm btn-add-ver-meta">+ 添加版本</button>' +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm lang-version-remove" title="移除此语言行">×</button>' +
      '</div>';
    var inp = row.querySelector('.lang-version-input-lang');
    var verList = row.querySelector('.version-meta-rows');
    var btnAddVer = row.querySelector('.btn-add-ver-meta');
    var btnRm = row.querySelector('.lang-version-remove');
    if (inp) inp.value = lang;
    var norm = versions.map(normalizeVersionEntryLoad).filter(function (e) {
      return e.name;
    });
    if (!norm.length) {
      addVersionMetaRow(verList, {});
    } else {
      norm.forEach(function (e) {
        addVersionMetaRow(verList, e);
      });
    }
    if (btnAddVer && verList) {
      btnAddVer.addEventListener('click', function () {
        addVersionMetaRow(verList, {});
      });
    }
    if (btnRm) {
      btnRm.addEventListener('click', function () {
        row.remove();
        if (pairsContainer && !pairsContainer.querySelector('.lang-version-row')) {
          addLangRow('', []);
        }
      });
    }
    pairsContainer.appendChild(row);
  }

  function loadRawIntoForm(raw) {
    raw = raw || {};
    var taCardStatus = document.getElementById('taCardStatus');
    var taRarity = document.getElementById('taRarity');
    var taCondition = document.getElementById('taCondition');

    if (Object.prototype.hasOwnProperty.call(raw, 'cardStatus')) {
      taCardStatus.value = arrToLines(raw.cardStatus);
    } else {
      taCardStatus.value = arrToLines(DEFAULT_CARD_STATUS_LINES.slice());
    }

    clearPairs();
    var vbl = raw.versionByLanguage && typeof raw.versionByLanguage === 'object' && !Array.isArray(raw.versionByLanguage)
      ? raw.versionByLanguage
      : null;
    var keys = vbl && Object.keys(vbl).length ? Object.keys(vbl) : [];
    if (keys.length) {
      keys.forEach(function (k) {
        var arr = Array.isArray(vbl[k]) ? vbl[k] : [];
        addLangRow(k, arr);
      });
    } else if (raw.language && raw.language.length) {
      var verArr = Array.isArray(raw.version) ? raw.version : [];
      raw.language.forEach(function (lang) {
        addLangRow(lang, verArr);
      });
    } else {
      addLangRow('', []);
    }

    clearLegacyRows();
    var leg = Array.isArray(raw.version) ? raw.version : [];
    var legNorm = leg.map(normalizeVersionEntryLoad).filter(function (e) {
      return e.name;
    });
    if (legacyVersionRows) {
      if (!legNorm.length) {
        addVersionMetaRow(legacyVersionRows, {});
      } else {
        legNorm.forEach(function (e) {
          addVersionMetaRow(legacyVersionRows, e);
        });
      }
    }
    taRarity.value = arrToLines(raw.rarity);
    taCondition.value = arrToLines(raw.condition);
  }

  function collectLangVersionFromDom() {
    var versionByLanguage = {};
    var languages = [];
    if (!pairsContainer) return { language: languages, versionByLanguage: versionByLanguage };
    var rows = pairsContainer.querySelectorAll('.lang-version-row');
    rows.forEach(function (row) {
      var inp = row.querySelector('.lang-version-input-lang');
      var verList = row.querySelector('.version-meta-rows');
      var lang = inp && inp.value ? String(inp.value).trim() : '';
      if (!lang) return;
      languages.push(lang);
      versionByLanguage[lang] = collectVersionRows(verList);
    });
    return { language: languages, versionByLanguage: versionByLanguage };
  }

  function fetchRaw() {
    return fetch('/api/ptcg/field-dropdowns?raw=1', {
      headers: authHeaders(),
      credentials: 'same-origin',
    })
      .then(function (r) {
        if (r.status === 401) {
          setToken('');
          showAuth();
          throw new Error('unauthorized');
        }
        if (!r.ok) throw new Error('load');
        return r.json();
      })
      .then(function (data) {
        loadRawIntoForm(data.dropdowns || {});
      });
  }

  function initFieldsApp() {
    fetchRaw().catch(function () {});

    if (btnAddLangRow) {
      btnAddLangRow.addEventListener('click', function () {
        addLangRow('', []);
      });
    }
    if (btnAddLegacyVer && legacyVersionRows) {
      btnAddLegacyVer.addEventListener('click', function () {
        addVersionMetaRow(legacyVersionRows, {});
      });
    }

    document.getElementById('dropdownForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('fdSaveMsg');
      if (msg) {
        msg.textContent = '';
        msg.className = 'fd-save-msg';
      }
      var lv = collectLangVersionFromDom();
      var legacyFlat = collectVersionRows(legacyVersionRows);
      var dropdowns = {
        cardStatus: linesToArr(document.getElementById('taCardStatus').value),
        language: lv.language,
        versionByLanguage: lv.versionByLanguage,
        version: legacyFlat,
        rarity: linesToArr(document.getElementById('taRarity').value),
        condition: linesToArr(document.getElementById('taCondition').value),
      };
      fetch('/api/ptcg/field-dropdowns', {
        method: 'PUT',
        headers: authHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ dropdowns: dropdowns }),
      })
        .then(function (r) {
          if (r.status === 401) {
            setToken('');
            showAuth();
            throw new Error('unauthorized');
          }
          if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || '保存失败'); });
          return r.json();
        })
        .then(function () {
          if (msg) {
            msg.classList.add('fd-save-msg--ok');
            msg.textContent = '已保存。返回卡牌页即可生效。';
          }
          return fetchRaw();
        })
        .catch(function (err) {
          if (err.message !== 'unauthorized') {
            if (msg) {
              msg.classList.add('fd-save-msg--err');
              msg.textContent = err.message || '保存失败';
            }
          }
        });
    });

    document.getElementById('btnFieldsLogout').addEventListener('click', function () {
      setToken('');
      showAuth();
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (loginErr) loginErr.textContent = '';
      var u = document.getElementById('ptcgUser');
      var p = document.getElementById('ptcgPass');
      var username = u && u.value ? u.value.trim() : '';
      var password = p && p.value ? p.value : '';
      fetch('/api/ptcg/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username: username, password: password }),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function (res) {
          if (res.ok && res.data && res.data.token) {
            setToken(res.data.token);
            showApp();
            initFieldsApp();
            if (p) p.value = '';
          } else {
            if (loginErr) loginErr.textContent = (res.data && res.data.error) || '登录失败';
          }
        })
        .catch(function () {
          if (loginErr) loginErr.textContent = '网络错误';
        });
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (registerErr) registerErr.textContent = '';
      var u = document.getElementById('ptcgRegUser');
      var p = document.getElementById('ptcgRegPass');
      var s = document.getElementById('ptcgRegSecret');
      var username = u && u.value ? u.value.trim() : '';
      var password = p && p.value ? p.value : '';
      var registerSecret = s && s.value ? s.value.trim() : '';
      var body = { username: username, password: password };
      if (registerSecret) body.registerSecret = registerSecret;
      fetch('/api/ptcg/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      })
        .then(function (r) {
          return r.json().then(function (data) {
            return { ok: r.ok, data: data };
          });
        })
        .then(function (res) {
          if (res.ok && res.data && res.data.ok) {
            if (registerErr) {
              registerErr.classList.remove('ptcg-msg-err');
              registerErr.classList.add('ptcg-msg-ok');
              registerErr.textContent = res.data.message || '注册成功';
            }
            setTimeout(function () {
              switchTab('login');
            }, 600);
          } else {
            if (registerErr) {
              registerErr.classList.add('ptcg-msg-err');
              registerErr.textContent = (res.data && res.data.error) || '注册失败';
            }
          }
        })
        .catch(function () {
          if (registerErr) registerErr.textContent = '网络错误';
        });
    });
  }

  verifyToken().then(function (ok) {
    if (ok) {
      showApp();
      initFieldsApp();
    } else {
      setToken('');
      showAuth();
    }
  });
})();
