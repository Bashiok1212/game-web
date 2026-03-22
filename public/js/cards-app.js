(function () {
  'use strict';

  var TOKEN_KEY = 'ptcg_token';
  var LEGACY_STORAGE = 'personalCards_v1';
  var IMAGE_FILE_MAX = 450000;

  var DROPDOWN_KEYS = ['language', 'rarity', 'condition', 'cardStatus'];
  var FIELD_IDS = {
    language: 'fLanguage',
    rarity: 'fRarity',
    condition: 'fCondition',
    cardStatus: 'fCardStatus',
  };

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

  function cardSearchBlob(c) {
    var parts = [
      c.cardNo,
      c.name,
      c.year,
      c.language,
      c.version,
      c.versionCode,
      c.rarity,
      c.purchasePrice,
      c.graded ? '评级' : '',
      c.gradingCompany,
      c.gradingNumber,
      c.condition,
      c.notes,
      c.cardStatus,
      c.set,
    ];
    return parts
      .filter(function (x) {
        return x != null && x !== '';
      })
      .join(' ')
      .toLowerCase();
  }

  function initCardsApp() {
    var listEl = document.getElementById('cardsList');
    var emptyEl = document.getElementById('cardsEmpty');
    var searchEl = document.getElementById('cardSearch');
    var formWrap = document.getElementById('cardFormWrap');
    var form = document.getElementById('cardForm');
    var editId = document.getElementById('editId');
    var cardNoHint = document.getElementById('cardNoHint');
    var fName = document.getElementById('fName');
    var fYear = document.getElementById('fYear');
    var fPurchasePrice = document.getElementById('fPurchasePrice');
    var fGraded = document.getElementById('fGraded');
    var gradedFields = document.getElementById('gradedFields');
    var fGradingCompany = document.getElementById('fGradingCompany');
    var fGradingNumber = document.getElementById('fGradingNumber');
    var fNotes = document.getElementById('fNotes');
    var fImageUrl = document.getElementById('fImageUrl');
    var fImageFile = document.getElementById('fImageFile');
    var fImage = document.getElementById('fImage');
    var fImagePreview = document.getElementById('fImagePreview');
    var btnClearImage = document.getElementById('btnClearImage');

    var dropdownConfig = {};
    var tableWrap = document.getElementById('cardsTableWrap');

    var stockMoveModal = document.getElementById('stockMoveModal');
    var stockMoveForm = document.getElementById('stockMoveForm');
    var smCardId = document.getElementById('smCardId');
    var smType = document.getElementById('smType');
    var smNote = document.getElementById('smNote');
    var smSyncStatus = document.getElementById('smSyncStatus');
    var smCardStatus = document.getElementById('smCardStatus');
    var smErr = document.getElementById('smErr');
    var smCancel = document.getElementById('smCancel');
    var stockMoveBackdrop = document.getElementById('stockMoveBackdrop');
    var ledgerModal = document.getElementById('ledgerModal');
    var ledgerTbody = document.getElementById('ledgerTbody');
    var ledgerEmpty = document.getElementById('ledgerEmpty');
    var ledgerBackdrop = document.getElementById('ledgerBackdrop');
    var ledgerClose = document.getElementById('ledgerClose');
    var btnStockLedger = document.getElementById('btnStockLedger');

    if (!listEl || !form) return;

    function syncGradedUi() {
      var on = fGraded && fGraded.checked;
      if (gradedFields) gradedFields.classList.toggle('hidden', !on);
    }

    if (fGraded) {
      fGraded.addEventListener('change', syncGradedUi);
    }

    function fetchFieldDropdowns() {
      return fetch('/api/ptcg/field-dropdowns', {
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
          dropdownConfig = data.dropdowns || {};
        });
    }

    function fieldVal(id) {
      var el = document.getElementById(id);
      if (!el) return '';
      if (el.disabled) return '';
      return el.value != null ? String(el.value).trim() : '';
    }

    function parseVersionEntryClient(v) {
      if (v == null) return null;
      if (typeof v === 'string') {
        var ns = String(v).trim();
        return ns ? { name: ns, year: null, code: '' } : null;
      }
      if (typeof v === 'object') {
        var name = String(v.name != null ? v.name : '').trim();
        if (!name) return null;
        var year = null;
        if (v.year !== undefined && v.year !== null && v.year !== '') {
          var y = parseInt(v.year, 10);
          if (!Number.isNaN(y) && y >= 0 && y <= 9999) year = y;
        }
        var code = v.code != null ? String(v.code).trim() : '';
        return { name: name, year: year, code: code };
      }
      return null;
    }

    function versionOptionLabel(entry) {
      var bits = [];
      if (entry.year != null && entry.year !== '') bits.push(entry.year);
      if (entry.code) bits.push(entry.code);
      if (bits.length) return entry.name + '（' + bits.join(' · ') + '）';
      return entry.name;
    }

    function needsLanguageBeforeVersion() {
      var vbl = dropdownConfig.versionByLanguage;
      return (
        vbl &&
        typeof vbl === 'object' &&
        !Array.isArray(vbl) &&
        Object.keys(vbl).length > 0
      );
    }

    function getVersionOpts(lang) {
      var vbl = dropdownConfig.versionByLanguage;
      var flat = dropdownConfig.version || [];
      var hasLangMap =
        vbl &&
        typeof vbl === 'object' &&
        !Array.isArray(vbl) &&
        Object.keys(vbl).length > 0;
      if (!hasLangMap) {
        var fa = Array.isArray(flat) ? flat : [];
        return fa.map(parseVersionEntryClient).filter(Boolean);
      }
      lang = (lang || '').trim();
      if (!lang) return [];
      if (Object.prototype.hasOwnProperty.call(vbl, lang) && Array.isArray(vbl[lang])) {
        return vbl[lang].map(parseVersionEntryClient).filter(Boolean);
      }
      return [];
    }

    function findVersionNameInOpts(opts, curVersion) {
      var cv = curVersion != null ? String(curVersion).trim() : '';
      if (!cv) return '';
      for (var i = 0; i < opts.length; i++) {
        if (opts[i].name === cv) return cv;
      }
      return '';
    }

    function bindVersionMetaFromSelect(verEl) {
      if (!verEl || verEl.tagName !== 'SELECT') return;
      var fYear = document.getElementById('fYear');
      var fVersionCode = document.getElementById('fVersionCode');
      verEl.addEventListener('change', function () {
        var opt = verEl.options[verEl.selectedIndex];
        if (!opt) return;
        var y = opt.getAttribute('data-year');
        var code = opt.getAttribute('data-code');
        if (fYear && y !== null && y !== '') fYear.value = y;
        if (fVersionCode && code !== null) fVersionCode.value = code || '';
      });
    }

    function renderVersionSlot(lang, curVersion) {
      var slot = document.querySelector('.field-control[data-slot="version"]');
      if (!slot) return;
      curVersion = curVersion != null ? String(curVersion) : '';
      var opts = getVersionOpts(lang);
      var needLang = needsLanguageBeforeVersion();
      slot.innerHTML = '';
      var el;
      if (opts.length > 0) {
        var validCur = findVersionNameInOpts(opts, curVersion);
        el = document.createElement('select');
        el.id = 'fVersion';
        var o0 = document.createElement('option');
        o0.value = '';
        o0.textContent = '（未选）';
        el.appendChild(o0);
        opts.forEach(function (entry) {
          var o = document.createElement('option');
          o.value = entry.name;
          o.textContent = versionOptionLabel(entry);
          if (entry.year != null && entry.year !== '') o.setAttribute('data-year', String(entry.year));
          if (entry.code) o.setAttribute('data-code', entry.code);
          if (String(validCur) === String(entry.name)) o.selected = true;
          el.appendChild(o);
        });
        bindVersionMetaFromSelect(el);
      } else {
        el = document.createElement('input');
        el.type = 'text';
        el.id = 'fVersion';
        el.maxLength = 128;
        el.value = curVersion;
        if (needLang && !(lang || '').trim()) {
          el.disabled = true;
          el.placeholder = '请先选择语言';
        } else {
          el.disabled = false;
          el.placeholder = '该语言下的版本（可手输）';
        }
      }
      slot.appendChild(el);
    }

    function attachLanguageVersionSync() {
      var langEl = document.getElementById('fLanguage');
      if (!langEl) return;
      var sync = function () {
        var L = fieldVal('fLanguage');
        var pv = '';
        var verEl = document.getElementById('fVersion');
        if (verEl && !verEl.disabled) {
          pv = verEl.value != null ? String(verEl.value).trim() : '';
        }
        var list = getVersionOpts(L);
        var nv = '';
        if (list.length > 0) {
          nv = findVersionNameInOpts(list, pv);
        } else {
          nv = pv;
        }
        renderVersionSlot(L, nv);
      };
      langEl.onchange = sync;
      langEl.oninput = sync;
    }

    function renderFieldControls(partial) {
      partial = partial || {};
      DROPDOWN_KEYS.forEach(function (key) {
        var opts = (dropdownConfig && dropdownConfig[key]) || [];
        var slot = document.querySelector('.field-control[data-slot="' + key + '"]');
        if (!slot) return;
        var cur =
          partial[key] !== undefined && partial[key] !== null ? String(partial[key]) : '';
        slot.innerHTML = '';
        var el;
        if (opts.length > 0) {
          el = document.createElement('select');
          el.id = FIELD_IDS[key];
          var o0 = document.createElement('option');
          o0.value = '';
          o0.textContent = '（未选）';
          el.appendChild(o0);
          opts.forEach(function (opt) {
            var o = document.createElement('option');
            o.value = opt;
            o.textContent = opt;
            if (String(cur) === String(opt)) o.selected = true;
            el.appendChild(o);
          });
        } else {
          el = document.createElement('input');
          el.type = 'text';
          el.id = FIELD_IDS[key];
          if (key === 'language') el.maxLength = 32;
          else el.maxLength = 64;
          el.value = cur;
          if (key === 'language') el.placeholder = '简中 / 日文 / 英文…';
          else if (key === 'rarity') el.placeholder = '如：AR / SAR / 闪';
          else if (key === 'condition') el.placeholder = '如：NM / 白边';
          else if (key === 'cardStatus') el.placeholder = '手输状态';
        }
        slot.appendChild(el);
      });
      var lang =
        partial.language !== undefined && partial.language !== null
          ? String(partial.language)
          : '';
      var ver =
        partial.version !== undefined && partial.version !== null
          ? String(partial.version)
          : '';
      renderVersionSlot(lang, ver);
      attachLanguageVersionSync();
      var fVc = document.getElementById('fVersionCode');
      if (fVc) {
        fVc.value =
          partial.versionCode != null && partial.versionCode !== undefined
            ? String(partial.versionCode)
            : '';
      }
    }

    function collectPayload() {
      var graded = fGraded.checked;
      var imgVal = fImage && fImage.value ? fImage.value.trim() : '';
      if (!imgVal && fImageUrl) imgVal = fImageUrl.value.trim();
      return {
        name: fName.value.trim(),
        year: fYear.value === '' ? '' : fYear.value,
        language: fieldVal('fLanguage'),
        version: fieldVal('fVersion'),
        versionCode: fieldVal('fVersionCode'),
        rarity: fieldVal('fRarity'),
        purchasePrice: fPurchasePrice.value === '' ? '' : fPurchasePrice.value,
        graded: graded,
        gradingCompany: graded ? fGradingCompany.value.trim() : '',
        gradingNumber: graded ? fGradingNumber.value.trim() : '',
        condition: fieldVal('fCondition'),
        notes: fNotes.value.trim(),
        cardStatus: fieldVal('fCardStatus'),
        image: imgVal,
      };
    }

    function resetFormAfterContinue() {
      var S = {
        year: fYear.value,
        language: fieldVal('fLanguage'),
        version: fieldVal('fVersion'),
        versionCode: fieldVal('fVersionCode'),
        rarity: fieldVal('fRarity'),
        purchasePrice: fPurchasePrice.value,
        condition: fieldVal('fCondition'),
        cardStatus: fieldVal('fCardStatus'),
      };
      fName.value = '';
      fNotes.value = '';
      clearImageFields();
      fYear.value = S.year;
      fPurchasePrice.value = S.purchasePrice;
      fGraded.checked = false;
      fGradingCompany.value = '';
      fGradingNumber.value = '';
      var fVersionCode = document.getElementById('fVersionCode');
      if (fVersionCode) fVersionCode.value = S.versionCode || '';
      renderFieldControls({
        language: S.language,
        version: S.version,
        versionCode: S.versionCode,
        rarity: S.rarity,
        condition: S.condition,
        cardStatus: S.cardStatus,
      });
      editId.value = '';
      if (cardNoHint) cardNoHint.textContent = '编号将在保存后自动生成';
      syncGradedUi();
      fName.focus();
    }

    function submitCard(continueNext) {
      var payload = collectPayload();
      if (!payload.name) return;
      if (payload.graded) {
        if (!payload.gradingCompany) {
          alert('请填写评级公司');
          return;
        }
        if (!payload.gradingNumber) {
          alert('请填写评级编号');
          return;
        }
      }
      var id = editId.value;
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
          if (continueNext) {
            resetFormAfterContinue();
          } else {
            closeForm();
          }
          render();
        })
        .catch(function (err) {
          if (err.message !== 'unauthorized') alert(err.message || '保存失败');
        });
    }

    function showImagePreview(src) {
      if (!fImagePreview) return;
      if (!src) {
        fImagePreview.classList.add('hidden');
        fImagePreview.innerHTML = '';
        if (btnClearImage) btnClearImage.classList.add('hidden');
        return;
      }
      fImagePreview.classList.remove('hidden');
      fImagePreview.innerHTML = '';
      var img = document.createElement('img');
      img.alt = '预览';
      img.src = src;
      fImagePreview.appendChild(img);
      if (btnClearImage) btnClearImage.classList.remove('hidden');
    }

    function clearImageFields() {
      if (fImage) fImage.value = '';
      if (fImageUrl) fImageUrl.value = '';
      if (fImageFile) fImageFile.value = '';
      showImagePreview('');
    }

    if (btnClearImage) {
      btnClearImage.addEventListener('click', function () {
        clearImageFields();
      });
    }

    if (fImageFile) {
      fImageFile.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > IMAGE_FILE_MAX) {
          alert('图片过大，请选择小于约 400KB 的文件或使用外链');
          fImageFile.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function () {
          var dataUrl = reader.result;
          if (typeof dataUrl !== 'string' || dataUrl.length > 500000) {
            alert('图片编码后仍过大，请压缩或使用外链');
            fImageFile.value = '';
            return;
          }
          if (fImage) fImage.value = dataUrl;
          if (fImageUrl) fImageUrl.value = '';
          showImagePreview(dataUrl);
        };
        reader.readAsDataURL(file);
      });
    }

    if (fImageUrl) {
      fImageUrl.addEventListener('input', function () {
        if (fImage && fImage.value) return;
        var u = (fImageUrl.value || '').trim();
        if (u.indexOf('http') === 0) showImagePreview(u);
        else if (!u) showImagePreview('');
      });
    }

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
            version: c.version || c.set || '',
            set: c.set || '',
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
        return cardSearchBlob(c).indexOf(q) !== -1;
      });
    }

    function tdText(val, className) {
      var td = document.createElement('td');
      if (className) td.className = className;
      var s = val != null && val !== '' ? String(val) : '';
      td.textContent = s || '—';
      return td;
    }

    function formatVersionCell(c) {
      var v = String(c.version || c.set || '').trim();
      var code = String(c.versionCode || '').trim();
      if (v && code) return v + ' · ' + code;
      if (v) return v;
      if (code) return code;
      return '';
    }

    function tdNotes(text) {
      var td = document.createElement('td');
      td.className = 'cards-td-notes';
      var t = (text || '').trim();
      if (t) {
        td.textContent = t.length > 48 ? t.slice(0, 48) + '…' : t;
        td.title = t;
      } else {
        td.textContent = '—';
      }
      return td;
    }

    function render() {
      var cards = getFiltered();
      listEl.innerHTML = '';
      if (cards.length === 0) {
        emptyEl.classList.toggle('hidden', false);
        if (tableWrap) tableWrap.classList.add('hidden');
        if (cardsCache.length > 0) emptyEl.textContent = '没有匹配的卡牌，换个关键词试试。';
        else emptyEl.textContent = '暂无卡牌，点击「添加卡牌」开始。';
        return;
      }
      emptyEl.classList.add('hidden');
      if (tableWrap) tableWrap.classList.remove('hidden');

      cards.forEach(function (c) {
        var tr = document.createElement('tr');
        tr.className = 'cards-table-row';
        tr.dataset.id = c.id;

        var tdImg = document.createElement('td');
        tdImg.className = 'cards-td-thumb';
        if (c.image) {
          var im = document.createElement('img');
          im.alt = '';
          im.loading = 'lazy';
          im.src = c.image;
          tdImg.appendChild(im);
        } else {
          tdImg.textContent = '—';
        }
        tr.appendChild(tdImg);

        tr.appendChild(tdText(c.cardNo != null ? c.cardNo : '', 'cards-td-num'));
        tr.appendChild(tdText(c.name || '（未命名）', 'cards-td-name'));
        tr.appendChild(tdText(c.year != null && c.year !== '' ? c.year : '', ''));
        tr.appendChild(tdText(c.language, ''));
        tr.appendChild(tdText(formatVersionCell(c), ''));
        tr.appendChild(tdText(c.rarity, ''));
        var priceStr = '';
        if (c.purchasePrice != null && c.purchasePrice !== '') {
          priceStr = '¥' + c.purchasePrice;
        }
        tr.appendChild(tdText(priceStr, 'cards-td-num'));

        var gradeStr = '';
        if (c.graded) {
          gradeStr = ((c.gradingCompany || '') + ' ' + (c.gradingNumber || '')).trim() || '是';
        }
        tr.appendChild(tdText(gradeStr, 'cards-td-grading'));

        tr.appendChild(tdText(c.condition, ''));
        tr.appendChild(tdText(c.cardStatus, ''));
        tr.appendChild(tdNotes(c.notes));

        var tdStock = document.createElement('td');
        tdStock.className = 'cards-td-stock';
        tdStock.innerHTML =
          '<button type="button" class="btn btn-secondary btn-sm" data-act="stock-in">入</button> ' +
          '<button type="button" class="btn btn-secondary btn-sm" data-act="stock-out">出</button>';
        tr.appendChild(tdStock);

        var tdAct = document.createElement('td');
        tdAct.className = 'cards-td-actions';
        tdAct.innerHTML =
          '<button type="button" class="btn btn-ghost btn-sm" data-act="edit">编辑</button> ' +
          '<button type="button" class="btn btn-danger btn-sm" data-act="del">删除</button>';
        tr.appendChild(tdAct);

        listEl.appendChild(tr);
      });
    }

    function openForm(card) {
      formWrap.classList.remove('hidden');
      editId.value = card ? card.id : '';
      if (cardNoHint) {
        if (card && card.cardNo != null) {
          cardNoHint.textContent = '编号：' + card.cardNo + '（自动生成，不可改）';
        } else {
          cardNoHint.textContent = '编号将在保存后自动生成';
        }
      }
      fName.value = card ? card.name || '' : '';
      fYear.value = card && card.year != null ? card.year : '';
      fPurchasePrice.value =
        card && card.purchasePrice != null && card.purchasePrice !== ''
          ? card.purchasePrice
          : '';
      fGraded.checked = !!(card && card.graded);
      fGradingCompany.value = card ? card.gradingCompany || '' : '';
      fGradingNumber.value = card ? card.gradingNumber || '' : '';
      fNotes.value = card ? card.notes || '' : '';
      var fVersionCodeEl = document.getElementById('fVersionCode');
      if (fVersionCodeEl) fVersionCodeEl.value = card ? card.versionCode || '' : '';
      clearImageFields();
      if (card && card.image) {
        if (card.image.indexOf('data:') === 0) {
          fImage.value = card.image;
          showImagePreview(card.image);
        } else {
          fImageUrl.value = card.image;
          showImagePreview(card.image);
        }
      }
      syncGradedUi();
      fName.focus();
      fetchFieldDropdowns()
        .then(function () {
          renderFieldControls(
            card
              ? {
                  language: card.language || '',
                  version: card.version || card.set || '',
                  versionCode: card.versionCode || '',
                  rarity: card.rarity || '',
                  condition: card.condition || '',
                  cardStatus: card.cardStatus || '',
                }
              : {}
          );
        })
        .catch(function () {
          renderFieldControls(
            card
              ? {
                  language: card.language || '',
                  version: card.version || card.set || '',
                  versionCode: card.versionCode || '',
                  rarity: card.rarity || '',
                  condition: card.condition || '',
                  cardStatus: card.cardStatus || '',
                }
              : {}
          );
        });
    }

    function closeForm() {
      formWrap.classList.add('hidden');
      form.reset();
      editId.value = '';
      clearImageFields();
      renderFieldControls({});
      if (cardNoHint) cardNoHint.textContent = '';
      syncGradedUi();
    }

    document.getElementById('btnAddCard').addEventListener('click', function () {
      openForm(null);
    });
    document.getElementById('btnCancelForm').addEventListener('click', closeForm);

    var btnSaveNext = document.getElementById('btnSaveNext');
    if (btnSaveNext) {
      btnSaveNext.addEventListener('click', function () {
        submitCard(true);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitCard(false);
    });
    form.addEventListener('keydown', function (e) {
      if (e.ctrlKey && (e.key === 'Enter' || e.keyCode === 13)) {
        if (e.target && e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        submitCard(true);
      }
    });

    function closeStockMoveModal() {
      if (!stockMoveModal) return;
      stockMoveModal.classList.add('hidden');
      stockMoveModal.setAttribute('aria-hidden', 'true');
    }

    function openStockMoveModal(card, preset) {
      if (!stockMoveModal || !smCardId || !smType) return;
      smCardId.value = card.id;
      smType.value = preset === 'out' ? 'out' : 'in';
      if (smNote) smNote.value = '';
      if (smErr) smErr.textContent = '';
      if (smSyncStatus) smSyncStatus.checked = true;
      if (smCardStatus) {
        smCardStatus.value = preset === 'out' ? '已售' : '在库';
      }
      var meta = document.getElementById('stockMoveMeta');
      if (meta) {
        var no = card.cardNo != null ? '#' + card.cardNo + ' ' : '';
        meta.textContent = no + (card.name || '（未命名）');
      }
      stockMoveModal.classList.remove('hidden');
      stockMoveModal.setAttribute('aria-hidden', 'false');
    }

    function closeLedgerModal() {
      if (!ledgerModal) return;
      ledgerModal.classList.add('hidden');
      ledgerModal.setAttribute('aria-hidden', 'true');
    }

    function openLedgerModal() {
      if (!ledgerModal || !ledgerTbody) return;
      var hintEl = document.getElementById('ledgerHint');
      if (hintEl) {
        hintEl.textContent = '按时间倒序；每条对应一张卡牌上的一次操作。';
      }
      ledgerTbody.innerHTML = '';
      if (ledgerEmpty) {
        ledgerEmpty.textContent = '暂无记录。';
        ledgerEmpty.classList.add('hidden');
      }
      ledgerModal.classList.remove('hidden');
      ledgerModal.setAttribute('aria-hidden', 'false');

      fetch('/api/ptcg/stock-movements?limit=200', {
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
          var rows = (data && data.movements) || [];
          if (rows.length === 0) {
            if (ledgerEmpty) ledgerEmpty.classList.remove('hidden');
            return;
          }
          var hint = document.getElementById('ledgerHint');
          if (hint && data.total != null) {
            hint.textContent = '共 ' + data.total + ' 条（本页最多 ' + rows.length + ' 条）';
          }
          rows.forEach(function (m) {
            var tr = document.createElement('tr');
            var t = m.createdAt || '';
            try {
              if (t) t = new Date(t).toLocaleString('zh-CN');
            } catch (e) {}
            var typeLabel = m.type === 'out' ? '出库' : '入库';
            var no = m.cardNo != null ? String(m.cardNo) : '—';
            var name = m.cardName || '—';
            var note = (m.note || '').trim() || '—';
            tr.innerHTML =
              '<td>' +
              escapeHtml(t) +
              '</td><td class="cards-td-num">' +
              escapeHtml(no) +
              '</td><td>' +
              escapeHtml(name) +
              '</td><td>' +
              typeLabel +
              '</td><td class="cards-td-notes">' +
              escapeHtml(note) +
              '</td>';
            ledgerTbody.appendChild(tr);
          });
        })
        .catch(function () {
          if (ledgerEmpty) {
            ledgerEmpty.textContent = '加载失败';
            ledgerEmpty.classList.remove('hidden');
          }
        });
    }

    function escapeHtml(s) {
      var d = document.createElement('div');
      d.textContent = s != null ? String(s) : '';
      return d.innerHTML;
    }

    if (stockMoveForm) {
      stockMoveForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (smErr) smErr.textContent = '';
        var cid = smCardId ? smCardId.value : '';
        if (!cid) return;
        var body = {
          type: smType && smType.value === 'out' ? 'out' : 'in',
          note: smNote ? smNote.value.trim() : '',
        };
        if (smSyncStatus && smSyncStatus.checked && smCardStatus && smCardStatus.value.trim()) {
          body.cardStatus = smCardStatus.value.trim();
        }
        fetch('/api/ptcg/cards/' + encodeURIComponent(cid) + '/stock-movement', {
          method: 'POST',
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
            if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || '登记失败'); });
            return r.json();
          })
          .then(function () {
            closeStockMoveModal();
            return fetchCards();
          })
          .then(function () {
            render();
          })
          .catch(function (err) {
            if (err.message !== 'unauthorized' && smErr) {
              smErr.textContent = err.message || '登记失败';
            }
          });
      });
    }

    if (smCancel) smCancel.addEventListener('click', closeStockMoveModal);
    if (stockMoveBackdrop) stockMoveBackdrop.addEventListener('click', closeStockMoveModal);
    if (ledgerClose) ledgerClose.addEventListener('click', closeLedgerModal);
    if (ledgerBackdrop) ledgerBackdrop.addEventListener('click', closeLedgerModal);
    if (btnStockLedger) btnStockLedger.addEventListener('click', openLedgerModal);

    if (smType && smCardStatus) {
      smType.addEventListener('change', function () {
        smCardStatus.value = smType.value === 'out' ? '已售' : '在库';
      });
    }

    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var row = btn.closest('tr');
      if (!row || !row.dataset.id) return;
      var id = row.dataset.id;
      var act = btn.getAttribute('data-act');
      var card = cardsCache.find(function (x) { return x.id === id; });
      if (act === 'stock-in' && card) openStockMoveModal(card, 'in');
      if (act === 'stock-out' && card) openStockMoveModal(card, 'out');
      if (act === 'edit' && card) openForm(card);
      if (act === 'del' && card) {
        var label = card.cardNo != null ? '#' + card.cardNo + ' ' : '';
        if (!confirm('确定删除「' + label + (card.name || '该卡牌') + '」？')) return;
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

    fetchFieldDropdowns()
      .then(function () {
        return fetchCards();
      })
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
