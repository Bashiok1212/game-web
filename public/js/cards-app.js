(function () {
  'use strict';

  var STORAGE_KEY = 'personalCards_v1';

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
})();
