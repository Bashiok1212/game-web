(function () {
  'use strict';

  var TOKEN_KEY = 'ptcg_token';
  var LEGACY_STORAGE = 'personalCards_v1';

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

  var cardsCache = [];

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
            return { ok: r.ok, data: data };
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

    function fetchCards() {
      return fetch('/api/ptcg/cards', { headers: authHeaders(), credentials: 'same-origin' })
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
          cardsCache = data.cards || [];
        });
    }

    function maybeMigrateLocal() {
      try {
        var raw = localStorage.getItem(LEGACY_STORAGE);
        if (!raw || cardsCache.length > 0) return Promise.resolve();
        var old = JSON.parse(raw);
        if (!Array.isArray(old) || old.length === 0) return Promise.resolve();
        var items = old.map(function (c) {
          return {
            name: c.name,
            set: c.set || '',
            quantity: c.quantity != null ? c.quantity : 1,
            condition: c.condition || '',
            notes: c.notes || '',
          };
        });
        return fetch('/api/ptcg/cards/import', {
          method: 'POST',
          headers: authHeaders(),
          credentials: 'same-origin',
          body: JSON.stringify({ items: items }),
        }).then(function (r) {
          if (r.ok) {
            localStorage.removeItem(LEGACY_STORAGE);
            return fetchCards();
          }
        });
      } catch (e) {
        return Promise.resolve();
      }
    }

    function getFiltered() {
      var q = (searchEl.value || '').trim().toLowerCase();
      if (!q) return cardsCache.slice();
      return cardsCache.filter(function (c) {
        var blob = [c.name, c.set, c.condition, c.notes].join(' ').toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }

    function render() {
      var cards = getFiltered();
      listEl.innerHTML = '';
      if (cards.length === 0) {
        emptyEl.classList.toggle('hidden', false);
        if (cardsCache.length > 0) emptyEl.textContent = '没有匹配的卡牌，换个关键词试试。';
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
      var id = editId.value;
      var payload = {
        name: fName.value.trim(),
        set: fSet.value.trim(),
        quantity: Math.max(0, parseInt(fQty.value, 10) || 0),
        condition: fCondition.value.trim(),
        notes: fNotes.value.trim(),
      };
      if (!payload.name) return;

      var url = '/api/ptcg/cards';
      var method = 'POST';
      if (id) {
        url = '/api/ptcg/cards/' + encodeURIComponent(id);
        method = 'PUT';
      }

      fetch(url, {
        method: method,
        headers: authHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      })
        .then(function (r) {
          if (r.status === 401) {
            setToken('');
            showAuth();
            throw new Error('unauthorized');
          }
          if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'save'); });
          return r.json();
        })
        .then(function () {
          return fetchCards();
        })
        .then(function () {
          closeForm();
          render();
        })
        .catch(function (err) {
          if (err.message !== 'unauthorized') alert(err.message || '保存失败');
        });
    });

    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var id = btn.closest('.card-item').dataset.id;
      var act = btn.getAttribute('data-act');
      var card = cardsCache.find(function (x) { return x.id === id; });
      if (act === 'edit' && card) openForm(card);
      if (act === 'del' && card) {
        if (!confirm('确定删除「' + (card.name || '该卡牌') + '」？')) return;
        fetch('/api/ptcg/cards/' + encodeURIComponent(id), {
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
            if (!r.ok) throw new Error();
            return fetchCards();
          })
          .then(function () {
            render();
          })
          .catch(function () {
            alert('删除失败');
          });
      }
    });

    searchEl.addEventListener('input', function () {
      render();
    });

    document.getElementById('btnExport').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(cardsCache, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ptcg-cards-' + new Date().toISOString().slice(0, 10) + '.json';
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
          fetch('/api/ptcg/cards/import', {
            method: 'POST',
            headers: authHeaders(),
            credentials: 'same-origin',
            body: JSON.stringify({ items: data }),
          })
            .then(function (r) {
              if (r.status === 401) {
                setToken('');
                showAuth();
                return;
              }
              if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || '导入失败'); });
              return r.json();
            })
            .then(function (res) {
              if (!res) return;
              return fetchCards().then(function () {
                render();
                alert('导入完成：新增 ' + (res.created || 0) + '，更新 ' + (res.updated || 0));
              });
            })
            .catch(function (err) {
              alert(err.message || '导入失败');
            });
        } catch (err) {
          alert('导入失败：' + (err.message || '无效 JSON'));
        }
      };
      reader.readAsText(file, 'UTF-8');
    });

    fetchCards()
      .then(function () {
        return maybeMigrateLocal();
      })
      .then(function () {
        render();
      })
      .catch(function () {
        emptyEl.textContent = '加载失败，请重新登录。';
      });
  }

  boot();
})();
