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

  function addLangRow(lang, versionText) {
    if (!pairsContainer) return;
    lang = lang != null ? String(lang) : '';
    versionText = versionText != null ? String(versionText) : '';
    var row = document.createElement('div');
    row.className = 'lang-version-row';
    row.innerHTML =
      '<div class="lang-version-row-inner">' +
      '<div class="lang-version-field">' +
      '<label>语言</label>' +
      '<input type="text" class="lang-version-input-lang" maxlength="128" placeholder="如：简中" value="">' +
      '</div>' +
      '<div class="lang-version-field lang-version-field--grow">' +
      '<label>该语言的版本（每行一项）</label>' +
      '<textarea class="lang-version-ta-ver" rows="4" maxlength="8000" placeholder="朱紫&#10;剑盾"></textarea>' +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm lang-version-remove" title="移除此行">×</button>' +
      '</div>';
    var inp = row.querySelector('.lang-version-input-lang');
    var ta = row.querySelector('.lang-version-ta-ver');
    var btnRm = row.querySelector('.lang-version-remove');
    if (inp) inp.value = lang;
    if (ta) ta.value = versionText;
    if (btnRm) {
      btnRm.addEventListener('click', function () {
        row.remove();
        if (pairsContainer && !pairsContainer.querySelector('.lang-version-row')) {
          addLangRow('', '');
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
    var taVersionLegacy = document.getElementById('taVersionLegacy');

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
        addLangRow(k, arrToLines(vbl[k]));
      });
    } else if (raw.language && raw.language.length) {
      var verText = arrToLines(raw.version || []);
      raw.language.forEach(function (lang) {
        addLangRow(lang, verText);
      });
    } else {
      addLangRow('', '');
    }

    if (taVersionLegacy) {
      taVersionLegacy.value = arrToLines(raw.version || []);
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
      var ta = row.querySelector('.lang-version-ta-ver');
      var lang = inp && inp.value ? String(inp.value).trim() : '';
      if (!lang) return;
      languages.push(lang);
      versionByLanguage[lang] = linesToArr(ta ? ta.value : '');
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
        addLangRow('', '');
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
      var taVersionLegacy = document.getElementById('taVersionLegacy');
      var legacyFlat = linesToArr(taVersionLegacy ? taVersionLegacy.value : '');
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
