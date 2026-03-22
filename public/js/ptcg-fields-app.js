(function () {
  'use strict';

  var TOKEN_KEY = 'ptcg_token';

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

  var listCache = [];

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

  function typeLabel(t) {
    var m = { text: '单行', textarea: '多行', number: '数字', select: '下拉' };
    return m[t] || t;
  }

  function syncOptionsRow() {
    var sel = document.getElementById('fdType');
    var row = document.getElementById('fdOptionsRow');
    if (!sel || !row) return;
    row.classList.toggle('hidden', sel.value !== 'select');
  }

  function fetchList() {
    return fetch('/api/ptcg/field-defs', { headers: authHeaders(), credentials: 'same-origin' })
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
        listCache = data.fieldDefs || [];
      });
  }

  function renderTable() {
    var tbody = document.getElementById('fdTableBody');
    var empty = document.getElementById('fdEmpty');
    var table = document.getElementById('fdTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (listCache.length === 0) {
      if (empty) empty.classList.remove('hidden');
      if (table) table.classList.add('hidden');
      return;
    }
    if (empty) empty.classList.add('hidden');
    if (table) table.classList.remove('hidden');
    listCache.forEach(function (d) {
      var tr = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.textContent = d.label;
      var td1 = document.createElement('td');
      td1.textContent = d.key;
      var td2 = document.createElement('td');
      td2.textContent = typeLabel(d.type);
      var td3 = document.createElement('td');
      td3.textContent = String(d.order != null ? d.order : 0);
      var td4 = document.createElement('td');
      td4.textContent = d.required ? '是' : '';
      var td5 = document.createElement('td');
      var b1 = document.createElement('button');
      b1.type = 'button';
      b1.className = 'btn btn-ghost btn-sm';
      b1.textContent = '编辑';
      b1.dataset.id = d.id;
      b1.dataset.act = 'edit';
      var b2 = document.createElement('button');
      b2.type = 'button';
      b2.className = 'btn btn-danger btn-sm';
      b2.textContent = '删除';
      b2.dataset.id = d.id;
      b2.dataset.act = 'del';
      td5.appendChild(b1);
      td5.appendChild(document.createTextNode(' '));
      td5.appendChild(b2);
      tr.appendChild(td0);
      tr.appendChild(td1);
      tr.appendChild(td2);
      tr.appendChild(td3);
      tr.appendChild(td4);
      tr.appendChild(td5);
      tbody.appendChild(tr);
    });
  }

  function openForm(def) {
    var wrap = document.getElementById('fieldDefFormWrap');
    var keyRow = document.getElementById('fdKeyRow');
    var fdKey = document.getElementById('fdKey');
    document.getElementById('fdEditId').value = def ? def.id : '';
    document.getElementById('fdLabel').value = def ? def.label : '';
    if (fdKey) {
      fdKey.value = def ? def.key : '';
      fdKey.disabled = !!def;
      fdKey.required = !def;
    }
    if (keyRow) keyRow.classList.toggle('fd-key-readonly', !!def);
    document.getElementById('fdType').value = def ? def.type : 'text';
    document.getElementById('fdOrder').value = def && def.order != null ? def.order : 0;
    document.getElementById('fdRequired').checked = !!(def && def.required);
    var opts = def && def.options ? def.options.join('\n') : '';
    document.getElementById('fdOptions').value = opts;
    syncOptionsRow();
    if (wrap) wrap.classList.remove('hidden');
    document.getElementById('fdLabel').focus();
  }

  function closeForm() {
    var wrap = document.getElementById('fieldDefFormWrap');
    if (wrap) wrap.classList.add('hidden');
    document.getElementById('fieldDefForm').reset();
    var fdKey = document.getElementById('fdKey');
    if (fdKey) fdKey.disabled = false;
  }

  function initFieldsApp() {
    document.getElementById('btnAddFieldDef').addEventListener('click', function () {
      openForm(null);
    });
    document.getElementById('btnFdCancel').addEventListener('click', closeForm);
    document.getElementById('fdType').addEventListener('change', syncOptionsRow);

    document.getElementById('fdTableBody').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var id = btn.dataset.id;
      var act = btn.dataset.act;
      var def = listCache.find(function (x) { return x.id === id; });
      if (act === 'edit' && def) openForm(def);
      if (act === 'del' && def) {
        if (!confirm('确定删除字段「' + def.label + '」？卡牌上已填的值仍会保留在数据中，但不再显示。')) return;
        fetch('/api/ptcg/field-defs/' + encodeURIComponent(id), {
          method: 'DELETE',
          headers: authHeaders(),
          credentials: 'same-origin',
        })
          .then(function (r) {
            if (r.status === 401) {
              setToken('');
              showAuth();
              return;
            }
            if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || '删除失败'); });
            return fetchList();
          })
          .then(function () {
            renderTable();
          })
          .catch(function (err) {
            alert(err.message || '删除失败');
          });
      }
    });

    document.getElementById('fieldDefForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var editId = document.getElementById('fdEditId').value;
      var label = document.getElementById('fdLabel').value.trim();
      var type = document.getElementById('fdType').value;
      var order = parseInt(document.getElementById('fdOrder').value, 10) || 0;
      var required = document.getElementById('fdRequired').checked;
      var optionsText = document.getElementById('fdOptions').value;
      var body = { label: label, type: type, order: order, required: required };
      if (type === 'select') body.options = optionsText;
      var url = '/api/ptcg/field-defs';
      var method = 'POST';
      if (editId) {
        url = '/api/ptcg/field-defs/' + encodeURIComponent(editId);
        method = 'PUT';
      } else {
        var key = document.getElementById('fdKey').value.trim().toLowerCase();
        if (!/^[a-z][a-z0-9_]{0,31}$/.test(key)) {
          alert('标识须为小写字母开头，仅含小写字母、数字、下划线');
          return;
        }
        body.key = key;
      }
      fetch(url, {
        method: method,
        headers: authHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(body),
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
          return fetchList();
        })
        .then(function () {
          closeForm();
          renderTable();
        })
        .catch(function (err) {
          if (err.message !== 'unauthorized') alert(err.message || '保存失败');
        });
    });

    document.getElementById('btnFieldsLogout').addEventListener('click', function () {
      setToken('');
      showAuth();
    });

    syncOptionsRow();

    fetchList()
      .then(function () {
        renderTable();
      })
      .catch(function () {});
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
