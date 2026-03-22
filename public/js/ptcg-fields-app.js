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

  function loadRawIntoForm(raw) {
    raw = raw || {};
    var taCardStatus = document.getElementById('taCardStatus');
    var taLanguage = document.getElementById('taLanguage');
    var taVersion = document.getElementById('taVersion');
    var taRarity = document.getElementById('taRarity');
    var taCondition = document.getElementById('taCondition');

    if (Object.prototype.hasOwnProperty.call(raw, 'cardStatus')) {
      taCardStatus.value = arrToLines(raw.cardStatus);
    } else {
      taCardStatus.value = arrToLines(DEFAULT_CARD_STATUS_LINES.slice());
    }
    taLanguage.value = arrToLines(raw.language);
    taVersion.value = arrToLines(raw.version);
    taRarity.value = arrToLines(raw.rarity);
    taCondition.value = arrToLines(raw.condition);
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

    document.getElementById('dropdownForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var msg = document.getElementById('fdSaveMsg');
      if (msg) msg.textContent = '';
      var dropdowns = {
        cardStatus: linesToArr(document.getElementById('taCardStatus').value),
        language: linesToArr(document.getElementById('taLanguage').value),
        version: linesToArr(document.getElementById('taVersion').value),
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
            msg.style.color = 'var(--success)';
            msg.textContent = '已保存。返回卡牌页即可看到下拉效果。';
          }
          return fetchRaw();
        })
        .catch(function (err) {
          if (err.message !== 'unauthorized') {
            if (msg) {
              msg.style.color = 'var(--error)';
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
