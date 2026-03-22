(function () {
  'use strict';

  var TOKEN_KEY = 'ptcg_token';
  var STORAGE_KEY = 'personalCards_v1';

  var authPanel = document.getElementById('ptcgAuth');
  var appPanel = document.getElementById('ptcgApp');
  var loginForm = document.getElementById('ptcgLoginForm');
  var loginErr = document.getElementById('ptcgLoginErr');
  var tabLogin = document.getElementById('tabLogin');
  var tabRegister = document.getElementById('tabRegister');
  var loginPanel = document.getElementById('ptcgLoginPanel');
  var registerPanel = document.getElementById('ptcgRegisterPanel');
  var registerForm = document.getElementById('ptcgRegisterForm');
  var registerErr = document.getElementById('ptcgRegisterErr');

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

  function boot() {
    verifyToken().then(function (ok) {
      if (ok) {
        showApp();
        initCardsApp();
      } else {
        setToken('');
        showAuth();
      }
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
            return { ok: r.ok, status: r.status, data: data };
          });
        })
        .then(function (res) {
          if (res.ok && res.data && res.data.token) {
            setToken(res.data.token);
            showApp();
            initCardsApp();
            if (p) p.value = '';
          } else {
            var msg = (res.data && res.data.error) || '登录失败';
            if (loginErr) loginErr.textContent = msg;
          }
        })
        .catch(function () {
          if (loginErr) loginErr.textContent = '网络错误';
        });
    });
  }

  var btnLogout = document.getElementById('btnPtcgLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', function () {
      setToken('');
      showAuth();
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
              registerErr.textContent = res.data.message || '注册成功，请登录';
            }
            if (p) p.value = '';
            if (s) s.value = '';
            setTimeout(function () {
              switchTab('login');
              var lu = document.getElementById('ptcgUser');
              if (lu) lu.value = String(username).toLowerCase();
              if (registerErr) {
                registerErr.textContent = '';
                registerErr.classList.remove('ptcg-msg-ok', 'ptcg-msg-err');
              }
            }, 800);
          } else {
            var msg = (res.data && res.data.error) || '注册失败';
            if (registerErr) {
              registerErr.classList.remove('ptcg-msg-ok');
              registerErr.classList.add('ptcg-msg-err');
              registerErr.textContent = msg;
            }
          }
        })
        .catch(function () {
          if (registerErr) registerErr.textContent = '网络错误';
        });
    });
  }

  function initCardsApp() {
    function loadCards() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        var data = JSON.parse(raw);
        return Array.isArray(data) ? data : [];
      } catch (e) {
        return [];
      }
    }

    function saveCards(list) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function uid() {
      return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
    }

    var listEl = document.getElementById('cardsList');
    var emptyEl = document.getElementById('cardsEmpty');
    var searchEl = document.getElementById('cardSearch');
    var formWrap = document.getElementById('cardFormWrap');
    var form = document.getElementById('cardForm');
    var editId = document.getElementById('editId');
    var fName = document.getElementById('fName');
    var fSet = document.getElementById('fSet');
    var fQty = document.getElementById('fQty');
    var fCondition = document.getElementById('fCondition');
    var fNotes = document.getElementById('fNotes');

    if (!listEl || !form) return;

    function getFiltered() {
      var all = loadCards();
      var q = (searchEl.value || '').trim().toLowerCase();
      if (!q) return all;
      return all.filter(function (c) {
        var blob = [c.name, c.set, c.condition, c.notes].join(' ').toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }

    function render() {
      var cards = getFiltered();
      listEl.innerHTML = '';
      if (cards.length === 0) {
        emptyEl.classList.toggle('hidden', false);
        if (loadCards().length > 0) emptyEl.textContent = '没有匹配的卡牌，换个关键词试试。';
        else emptyEl.textContent = '暂无卡牌，点击「添加卡牌」开始。';
        return;
      }
      emptyEl.classList.add('hidden');
      cards.forEach(function (c) {
        var li = document.createElement('li');
        li.className = 'card-item';
        li.dataset.id = c.id;
        var meta = [];
        if (c.set) meta.push('系列：' + c.set);
        meta.push('数量：' + (c.quantity != null ? c.quantity : 1));
        if (c.condition) meta.push('品相：' + c.condition);
        li.innerHTML =
          '<div class="card-item-main">' +
          '<div class="card-item-title"></div>' +
          '<div class="card-item-meta"></div>' +
          (c.notes ? '<div class="card-item-notes"></div>' : '') +
          '</div>' +
          '<div class="card-item-actions">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-act="edit">编辑</button>' +
          '<button type="button" class="btn btn-danger btn-sm" data-act="del">删除</button>' +
          '</div>';
        li.querySelector('.card-item-title').textContent = c.name || '（未命名）';
        li.querySelector('.card-item-meta').textContent = meta.join(' · ');
        if (c.notes) li.querySelector('.card-item-notes').textContent = c.notes;
        listEl.appendChild(li);
      });
    }

    function openForm(card) {
      formWrap.classList.remove('hidden');
      editId.value = card ? card.id : '';
      fName.value = card ? card.name || '' : '';
      fSet.value = card ? card.set || '' : '';
      fQty.value = card && card.quantity != null ? card.quantity : 1;
      fCondition.value = card ? card.condition || '' : '';
      fNotes.value = card ? card.notes || '' : '';
      fName.focus();
    }

    function closeForm() {
      formWrap.classList.add('hidden');
      form.reset();
      editId.value = '';
    }

    document.getElementById('btnAddCard').addEventListener('click', function () {
      openForm(null);
    });
    document.getElementById('btnCancelForm').addEventListener('click', closeForm);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var all = loadCards();
      var id = editId.value;
      var rec = {
        id: id || uid(),
        name: fName.value.trim(),
        set: fSet.value.trim(),
        quantity: Math.max(0, parseInt(fQty.value, 10) || 0),
        condition: fCondition.value.trim(),
        notes: fNotes.value.trim(),
        updatedAt: new Date().toISOString()
      };
      if (!rec.name) return;
      if (id) {
        var idx = all.findIndex(function (x) { return x.id === id; });
        if (idx >= 0) all[idx] = rec;
      } else {
        rec.createdAt = rec.updatedAt;
        all.push(rec);
      }
      saveCards(all);
      closeForm();
      render();
    });

    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var id = btn.closest('.card-item').dataset.id;
      var act = btn.getAttribute('data-act');
      var all = loadCards();
      var card = all.find(function (x) { return x.id === id; });
      if (act === 'edit' && card) openForm(card);
      if (act === 'del' && card) {
        if (!confirm('确定删除「' + (card.name || '该卡牌') + '」？')) return;
        saveCards(all.filter(function (x) { return x.id !== id; }));
        render();
      }
    });

    searchEl.addEventListener('input', function () {
      render();
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      var data = loadCards();
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cards-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });

    document.getElementById('importFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          if (!Array.isArray(data)) throw new Error('格式应为数组');
          var merged = loadCards();
          var ids = {};
          merged.forEach(function (x) { ids[x.id] = true; });
          data.forEach(function (item) {
            if (!item || typeof item !== 'object') return;
            if (!item.name) return;
            if (!item.id || ids[item.id]) item.id = uid();
            ids[item.id] = true;
            merged.push({
              id: item.id,
              name: String(item.name).slice(0, 128),
              set: item.set != null ? String(item.set).slice(0, 128) : '',
              quantity: Math.max(0, parseInt(item.quantity, 10) || 0) || 1,
              condition: item.condition != null ? String(item.condition).slice(0, 64) : '',
              notes: item.notes != null ? String(item.notes).slice(0, 2000) : '',
              createdAt: item.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          });
          saveCards(merged);
          render();
          alert('导入完成，共 ' + merged.length + ' 条记录。');
        } catch (err) {
          alert('导入失败：' + (err.message || '无效 JSON'));
        }
      };
      reader.readAsText(file, 'UTF-8');
    });

    render();
  }

  boot();
})();
