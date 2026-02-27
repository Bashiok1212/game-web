const API = '/api';

const ITEM_CATEGORIES = ['道具', '精灵球', '贵重物品', '药品', '商城', '时装'];

const $ = (sel) => document.querySelector(sel);

function getToken() { return localStorage.getItem('token'); }
function setToken(token) { token ? localStorage.setItem('token', token) : localStorage.removeItem('token'); }
function setUser(user) { user ? localStorage.setItem('user', JSON.stringify(user)) : localStorage.removeItem('user'); }
function getUser() { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; }

const loginSection = $('#loginSection');
const dashboardSection = $('#dashboardSection');
const forbiddenSection = $('#forbiddenSection');
const formAdminLogin = $('#formAdminLogin');
const loginError = $('#loginError');

function showSection(section) {
  [loginSection, dashboardSection, forbiddenSection].forEach((s) => {
    if (s) s.classList.add('hidden');
  });
  if (section) section.classList.remove('hidden');
}

function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(API + path, { ...options, headers });
}

formAdminLogin?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const login = form.login?.value?.trim() || '';
  const pwd = form.password?.value || '';
  if (!login || !pwd) return;
  loginError.classList.add('hidden');
  try {
    const data = { password: pwd };
    login.includes('@') ? (data.email = login) : (data.username = login);
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      loginError.textContent = json.error || '登录失败';
      loginError.classList.remove('hidden');
      return;
    }
    setToken(json.token);
    setUser(json.user);
    if (['admin', 'ow'].includes(json.user?.role)) {
      loadDashboard();
      showSection(dashboardSection);
    } else {
      setToken(null);
      setUser(null);
      showSection(forbiddenSection);
    }
  } catch (err) {
    loginError.textContent = '网络错误，请稍后重试';
    loginError.classList.remove('hidden');
  }
});

let serverTimeInterval = null;

async function loadServerTime() {
  const el = $('#serverTime');
  if (!el) return;
  try {
    const res = await fetch(API + '/time');
    if (res.ok) {
      const data = await res.json();
      const display = data.pacificFormatted || data.utcFormatted || new Date().toLocaleString('zh-CN');
      el.textContent = '服务器时间: ' + display;
      el.title = 'UTC: ' + (data.utcFormatted || '') + '\n太平洋: ' + (data.pacificFormatted || '');
    } else {
      el.textContent = '服务器时间: ' + new Date().toLocaleString('zh-CN') + ' (本地)';
    }
  } catch (_) {
    el.textContent = '服务器时间: ' + new Date().toLocaleString('zh-CN') + ' (本地)';
  }
  if (serverTimeInterval) clearInterval(serverTimeInterval);
  serverTimeInterval = setInterval(loadServerTime, 60000);
}

async function loadLogs() {
  const tbody = $('#logsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">加载中...</td></tr>';
  const actionFilter = $('#logActionFilter')?.value || '';
  try {
    const url = actionFilter ? '/admin/logs?action=' + encodeURIComponent(actionFilter) : '/admin/logs';
    const res = await apiFetch(url);
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
      return;
    }
    const { logs } = await res.json();
    if (!logs || logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">暂无日志</td></tr>';
      return;
    }
    const actionLabels = {
      login: '登录',
      user_role: '用户角色',
      user_delete: '删除用户',
      spirit: '妖灵',
      skill: '技能',
      item: '物品',
      character: '角色',
      player_item: '玩家物品',
      festival: '节日',
    };
    tbody.innerHTML = logs.map((l) => `
      <tr>
        <td>${formatDate(l.created_at)}</td>
        <td>${escapeHtml(l.operatorName || '-')}</td>
        <td>${escapeHtml(actionLabels[l.action] || l.action)}</td>
        <td>${escapeHtml(l.detail || '-')}</td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
    tbody.innerHTML = '<tr><td colspan="4">加载失败</td></tr>';
  }
}

async function loadDashboard() {
  let user = getUser();
  loadServerTime();
  // 从 API 获取最新用户信息（含 role），避免 localStorage 过期导致权限显示错误
  try {
    const userRes = await apiFetch('/user');
    if (userRes.ok) {
      const { user: freshUser } = await userRes.json();
      if (freshUser) {
        user = freshUser;
        setUser(freshUser);
      }
    }
  } catch (_) {}
  if ($('#adminUser')) $('#adminUser').textContent = (user?.username || '') + (user?.role === 'ow' ? ' (OW)' : '');
  const tabFestivalsBtn = $('#tabFestivalsBtn');
  if (tabFestivalsBtn) tabFestivalsBtn.style.display = user?.role === 'ow' ? '' : 'none';

  try {
    const [statsRes, usersRes] = await Promise.all([
      apiFetch('/admin/stats'),
      apiFetch('/admin/users'),
    ]);

    if (statsRes.ok) {
      const stats = await statsRes.json();
      if ($('#statTotal')) $('#statTotal').textContent = stats.total ?? 0;
      if ($('#statNewToday')) $('#statNewToday').textContent = stats.newToday ?? 0;
    }

    if (usersRes.ok) {
      const { users } = await usersRes.json();
      const currentUserId = user?.id || '';
      const tbody = $('#usersTableBody');
      if (tbody) {
        const currentRole = user?.role || 'user';
        const isOw = currentRole === 'ow';
        tbody.innerHTML = users.map((u) => {
          const isSelf = u.id === currentUserId;
          const targetRole = u.role || 'user';
          let actions = '';
          if (isSelf) {
            actions = '<span class="role-hint">当前账号</span>';
          } else if (targetRole === 'ow') {
            actions = isOw ? `<button class="btn btn-ghost btn-sm" data-id="${escapeHtml(u.id)}" data-role="admin">取消OW</button> <button class="btn btn-danger btn-sm" data-id="${escapeHtml(u.id)}" data-action="delete" data-username="${escapeHtml(u.username)}">删除</button>` : '';
          } else if (targetRole === 'admin') {
            actions = isOw
              ? `<button class="btn btn-primary btn-sm" data-id="${escapeHtml(u.id)}" data-role="ow">设为OW</button> <button class="btn btn-ghost btn-sm" data-id="${escapeHtml(u.id)}" data-role="user">取消管理员</button> <button class="btn btn-danger btn-sm" data-id="${escapeHtml(u.id)}" data-action="delete" data-username="${escapeHtml(u.username)}">删除</button>`
              : '';
          } else {
            actions = isOw
              ? `<button class="btn btn-primary btn-sm" data-id="${escapeHtml(u.id)}" data-role="ow">设为OW</button> <button class="btn btn-primary btn-sm" data-id="${escapeHtml(u.id)}" data-role="admin">设为管理员</button> <button class="btn btn-danger btn-sm" data-id="${escapeHtml(u.id)}" data-action="delete" data-username="${escapeHtml(u.username)}">删除</button>`
              : '';
          }
          const roleClass = targetRole === 'ow' ? 'role-ow' : (targetRole === 'admin' ? 'role-admin' : '');
          return `
          <tr data-id="${escapeHtml(u.id)}">
            <td>${escapeHtml(u.username)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="${roleClass}">${targetRole}</span></td>
            <td>${formatDate(u.created_at)}</td>
            <td>${formatDate(u.last_login) || '-'}</td>
            <td class="role-actions">${actions}</td>
          </tr>
        `;
        }).join('');
        tbody.querySelectorAll('button[data-id]').forEach((btn) => {
          if (btn.dataset.action === 'delete') {
            btn.onclick = () => deleteUser(btn.dataset.id, btn.dataset.username);
          } else {
            btn.onclick = () => setUserRole(btn.dataset.id, btn.dataset.role);
          }
        });
      }
    } else if (usersRes.status === 403) {
      showSection(forbiddenSection);
    }
  } catch (err) {
    console.error(err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleString('zh-CN');
}

async function setUserRole(userId, role) {
  try {
    const res = await apiFetch('/admin/users/' + userId + '/role', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok) {
      alert(json.error || '操作失败');
      return;
    }
    loadDashboard();
  } catch (err) {
    alert('网络错误');
  }
}

async function deleteUser(userId, username) {
  if (!confirm(`确定要删除账号「${username}」吗？此操作不可恢复。`)) return;
  try {
    const res = await apiFetch('/admin/users/' + userId, { method: 'DELETE' });
    let json = {};
    try {
      const text = await res.text();
      if (text) json = JSON.parse(text);
    } catch (_) {}
    if (!res.ok) {
      alert(json.error || '操作失败');
      return;
    }
    loadDashboard();
  } catch (err) {
    alert('网络错误，请检查网络连接或刷新后重试');
  }
}

$('#btnLogout')?.addEventListener('click', () => {
  setToken(null);
  setUser(null);
  if ($('#adminUser')) $('#adminUser').textContent = '';
  showSection(loginSection);
});

// ========== 妖灵管理（宝可梦风格） ==========

const spiritModal = $('#spiritModal');
const formSpirit = $('#formSpirit');
const spiritsTableBody = $('#spiritsTableBody');

document.querySelectorAll('.admin-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = $('#tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1));
    if (panel) panel.classList.add('active');
    if (tab.dataset.tab === 'spirits') loadSpirits();
    else if (tab.dataset.tab === 'skills') loadSkills();
    else if (tab.dataset.tab === 'items') loadItems();
    else if (tab.dataset.tab === 'characters') {
      initCharacterFilters();
      loadCharacters();
    }
    else if (tab.dataset.tab === 'playerItems') {
      initPlayerItemFilters();
      loadPlayerItems();
    }
    else if (tab.dataset.tab === 'festivals') loadFestivals();
  });
});

$('#btnLogSearch')?.addEventListener('click', () => loadLogs());

$('#btnAddSpirit')?.addEventListener('click', () => openSpiritModal());
$('#btnCloseSpiritModal')?.addEventListener('click', () => closeSpiritModal());
$('#btnCancelSpirit')?.addEventListener('click', () => closeSpiritModal());
spiritModal?.addEventListener('click', (e) => { if (e.target === spiritModal) closeSpiritModal(); });

$('#btnSpiritSearch')?.addEventListener('click', () => loadSpirits());
$('#spiritSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadSpirits(); });
$('#spiritTypeFilter')?.addEventListener('change', () => loadSpirits());
$('#spiritSort')?.addEventListener('change', () => loadSpirits());

formSpirit?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.spiritId?.value;
  const payload = {
    number: parseInt(form.number?.value, 10),
    name: form.name?.value?.trim(),
    types: [form.type1?.value, form.type2?.value].filter(Boolean),
    stats: {
      hp: parseInt(form.hp?.value, 10) || 50,
      attack: parseInt(form.attack?.value, 10) || 50,
      defense: parseInt(form.defense?.value, 10) || 50,
      sp_attack: parseInt(form.sp_attack?.value, 10) || 50,
      sp_defense: parseInt(form.sp_defense?.value, 10) || 50,
      speed: parseInt(form.speed?.value, 10) || 50,
    },
    description: form.description?.value?.trim() || '',
    image: form.image?.value?.trim() || '',
  };
  try {
    if (id) {
      const res = await apiFetch('/admin/spirits/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '更新失败'); return; }
      closeSpiritModal();
      loadSpirits();
    } else {
      const res = await apiFetch('/admin/spirits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '添加失败'); return; }
      closeSpiritModal();
      loadSpirits();
    }
  } catch (err) {
    alert('网络错误');
  }
});

async function loadSpirits() {
  const search = $('#spiritSearch')?.value?.trim() || '';
  const type = $('#spiritTypeFilter')?.value || '';
  const sortVal = $('#spiritSort')?.value || 'number-asc';
  const [sort, order] = sortVal.split('-');
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  params.set('sort', sort);
  params.set('order', order);
  try {
    const res = await apiFetch('/admin/spirits?' + params.toString());
    if (!res.ok) {
      if (res.status === 403) showSection(forbiddenSection);
      return;
    }
    const { spirits } = await res.json();
    if (spiritsTableBody) {
      spiritsTableBody.innerHTML = spirits.length === 0
        ? '<tr><td colspan="11" class="empty">暂无妖灵</td></tr>'
        : spirits.map((s) => {
            const typeStr = (s.types || []).join(' / ');
            const stats = s.stats || {};
            return `
          <tr data-id="${escapeHtml(s.id)}">
            <td class="spirit-number">#${String(s.number).padStart(3, '0')}</td>
            <td class="spirit-img">${s.image ? `<img src="${escapeHtml(s.image)}" alt="" onerror="this.parentElement.innerHTML='-'">` : '-'}</td>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(typeStr) || '-'}</td>
            <td>${stats.hp ?? '-'}</td>
            <td>${stats.attack ?? '-'}</td>
            <td>${stats.defense ?? '-'}</td>
            <td>${stats.sp_attack ?? '-'}</td>
            <td>${stats.sp_defense ?? '-'}</td>
            <td>${stats.speed ?? '-'}</td>
            <td class="spirit-actions">
              <button type="button" class="btn btn-ghost btn-sm btn-edit" data-id="${escapeHtml(s.id)}">编辑</button>
              <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}">删除</button>
            </td>
          </tr>
        `;
          }).join('');
      spiritsTableBody.querySelectorAll('.btn-edit').forEach((btn) => {
        btn.onclick = () => openSpiritModal(btn.dataset.id);
      });
      spiritsTableBody.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.onclick = () => deleteSpirit(btn.dataset.id, btn.dataset.name);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function openSpiritModal(id) {
  if (id) {
    $('#spiritModalTitle').textContent = '编辑妖灵';
    formSpirit.spiritId.value = id;
    apiFetch('/admin/spirits/' + id, {}).then(async (res) => {
      if (!res.ok) return;
      const s = await res.json();
      formSpirit.number.value = s.number;
      formSpirit.name.value = s.name || '';
      formSpirit.type1.value = (s.types || [])[0] || '';
      formSpirit.type2.value = (s.types || [])[1] || '';
      const st = s.stats || {};
      formSpirit.hp.value = st.hp ?? 50;
      formSpirit.attack.value = st.attack ?? 50;
      formSpirit.defense.value = st.defense ?? 50;
      formSpirit.sp_attack.value = st.sp_attack ?? 50;
      formSpirit.sp_defense.value = st.sp_defense ?? 50;
      formSpirit.speed.value = st.speed ?? 50;
      formSpirit.description.value = s.description || '';
      formSpirit.image.value = s.image || '';
      spiritModal.classList.remove('hidden');
    });
  } else {
    $('#spiritModalTitle').textContent = '添加妖灵';
    formSpirit.reset();
    formSpirit.spiritId.value = '';
    formSpirit.number.value = '';
    formSpirit.name.value = '';
    formSpirit.type1.value = '';
    formSpirit.type2.value = '';
    formSpirit.hp.value = 50;
    formSpirit.attack.value = 50;
    formSpirit.defense.value = 50;
    formSpirit.sp_attack.value = 50;
    formSpirit.sp_defense.value = 50;
    formSpirit.speed.value = 50;
    formSpirit.description.value = '';
    formSpirit.image.value = '';
    spiritModal.classList.remove('hidden');
  }
}

function closeSpiritModal() {
  spiritModal?.classList.add('hidden');
}

async function deleteSpirit(id, name) {
  if (!confirm(`确定要删除妖灵「${name}」吗？`)) return;
  try {
    const res = await apiFetch('/admin/spirits/' + id, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json.error || '删除失败'); return; }
    loadSpirits();
  } catch (err) {
    alert('网络错误');
  }
}

// ========== 技能管理 ==========

const skillModal = $('#skillModal');
const formSkill = $('#formSkill');
const skillsTableBody = $('#skillsTableBody');

$('#btnAddSkill')?.addEventListener('click', () => openSkillModal());
$('#btnCloseSkillModal')?.addEventListener('click', () => closeSkillModal());
$('#btnCancelSkill')?.addEventListener('click', () => closeSkillModal());
skillModal?.addEventListener('click', (e) => { if (e.target === skillModal) closeSkillModal(); });

$('#btnSkillSearch')?.addEventListener('click', () => loadSkills());
$('#skillSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadSkills(); });
$('#skillTypeFilter')?.addEventListener('change', () => loadSkills());
$('#skillCategoryFilter')?.addEventListener('change', () => loadSkills());
$('#skillSort')?.addEventListener('change', () => loadSkills());

formSkill?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.skillId?.value;
  const payload = {
    number: parseInt(form.number?.value, 10),
    name: form.name?.value?.trim(),
    type: form.type?.value || '',
    category: form.category?.value || '',
    power: parseInt(form.power?.value, 10) || 0,
    accuracy: parseInt(form.accuracy?.value, 10) ?? 100,
    pp: parseInt(form.pp?.value, 10) ?? 10,
    description: form.description?.value?.trim() || '',
    effect: form.effect?.value?.trim() || '',
  };
  try {
    if (id) {
      const res = await apiFetch('/admin/skills/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '更新失败'); return; }
      closeSkillModal();
      loadSkills();
    } else {
      const res = await apiFetch('/admin/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '添加失败'); return; }
      closeSkillModal();
      loadSkills();
    }
  } catch (err) {
    alert('网络错误');
  }
});

async function loadSkills() {
  const search = $('#skillSearch')?.value?.trim() || '';
  const type = $('#skillTypeFilter')?.value || '';
  const category = $('#skillCategoryFilter')?.value || '';
  const sortVal = $('#skillSort')?.value || 'number-asc';
  const [sort, order] = sortVal.split('-');
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (type) params.set('type', type);
  if (category) params.set('category', category);
  params.set('sort', sort);
  params.set('order', order);
  try {
    const res = await apiFetch('/admin/skills?' + params.toString());
    if (!res.ok) { if (res.status === 403) showSection(forbiddenSection); return; }
    const { skills } = await res.json();
    if (skillsTableBody) {
      skillsTableBody.innerHTML = skills.length === 0
        ? '<tr><td colspan="8" class="empty">暂无技能</td></tr>'
        : skills.map((s) => `
          <tr data-id="${escapeHtml(s.id)}">
            <td class="spirit-number">#${String(s.number).padStart(3, '0')}</td>
            <td><strong>${escapeHtml(s.name)}</strong></td>
            <td>${escapeHtml(s.type) || '-'}</td>
            <td>${escapeHtml(s.category) || '-'}</td>
            <td>${s.power ?? 0}</td>
            <td>${s.accuracy ?? 100}%</td>
            <td>${s.pp ?? 10}</td>
            <td class="spirit-actions">
              <button type="button" class="btn btn-ghost btn-sm btn-edit" data-id="${escapeHtml(s.id)}">编辑</button>
              <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}">删除</button>
            </td>
          </tr>
        `).join('');
      skillsTableBody.querySelectorAll('.btn-edit').forEach((btn) => {
        btn.onclick = () => openSkillModal(btn.dataset.id);
      });
      skillsTableBody.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.onclick = () => deleteSkill(btn.dataset.id, btn.dataset.name);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function openSkillModal(id) {
  if (id) {
    $('#skillModalTitle').textContent = '编辑技能';
    formSkill.skillId.value = id;
    apiFetch('/admin/skills/' + id, {}).then(async (res) => {
      if (!res.ok) return;
      const s = await res.json();
      formSkill.number.value = s.number;
      formSkill.name.value = s.name || '';
      formSkill.type.value = s.type || '';
      formSkill.category.value = s.category || '';
      formSkill.power.value = s.power ?? 0;
      formSkill.accuracy.value = s.accuracy ?? 100;
      formSkill.pp.value = s.pp ?? 10;
      formSkill.description.value = s.description || '';
      formSkill.effect.value = s.effect || '';
      skillModal.classList.remove('hidden');
    });
  } else {
    $('#skillModalTitle').textContent = '添加技能';
    formSkill.reset();
    formSkill.skillId.value = '';
    formSkill.number.value = '';
    formSkill.name.value = '';
    formSkill.type.value = '';
    formSkill.category.value = '';
    formSkill.power.value = 0;
    formSkill.accuracy.value = 100;
    formSkill.pp.value = 10;
    formSkill.description.value = '';
    formSkill.effect.value = '';
    skillModal.classList.remove('hidden');
  }
}

function closeSkillModal() {
  skillModal?.classList.add('hidden');
}

async function deleteSkill(id, name) {
  if (!confirm(`确定要删除技能「${name}」吗？关联的妖灵将移除该技能。`)) return;
  try {
    const res = await apiFetch('/admin/skills/' + id, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json.error || '删除失败'); return; }
    loadSkills();
  } catch (err) {
    alert('网络错误');
  }
}

// ========== 物品管理 ==========

const itemModal = $('#itemModal');
const formItem = $('#formItem');
const itemsTableBody = $('#itemsTableBody');

$('#btnAddItem')?.addEventListener('click', () => openItemModal());
$('#btnCloseItemModal')?.addEventListener('click', () => closeItemModal());
$('#btnCancelItem')?.addEventListener('click', () => closeItemModal());
itemModal?.addEventListener('click', (e) => { if (e.target === itemModal) closeItemModal(); });

$('#btnItemSearch')?.addEventListener('click', () => loadItems());
$('#itemSearch')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadItems(); });
$('#itemCategoryFilter')?.addEventListener('change', () => loadItems());
$('#itemSort')?.addEventListener('change', () => loadItems());

formItem?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.itemId?.value;
  const payload = {
    number: parseInt(form.number?.value, 10),
    name: form.name?.value?.trim(),
    category: form.category?.value?.trim() || '',
    description: form.description?.value?.trim() || '',
    effect: form.effect?.value?.trim() || '',
    image: form.image?.value?.trim() || '',
  };
  try {
    if (id) {
      const res = await apiFetch('/admin/items/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '更新失败'); return; }
      closeItemModal();
      loadItems();
    } else {
      const res = await apiFetch('/admin/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '添加失败'); return; }
      closeItemModal();
      loadItems();
    }
  } catch (err) {
    alert('网络错误');
  }
});

async function loadItems() {
  const search = $('#itemSearch')?.value?.trim() || '';
  const category = $('#itemCategoryFilter')?.value || '';
  const sortVal = $('#itemSort')?.value || 'number-asc';
  const [sort, order] = sortVal.split('-');
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  params.set('sort', sort);
  params.set('order', order);
  try {
    const res = await apiFetch('/admin/items?' + params.toString());
    if (!res.ok) { if (res.status === 403) showSection(forbiddenSection); return; }
    const { items } = await res.json();
    if (itemsTableBody) {
      itemsTableBody.innerHTML = items.length === 0
        ? '<tr><td colspan="6" class="empty">暂无物品</td></tr>'
        : items.map((i) => `
          <tr data-id="${escapeHtml(i.id)}">
            <td class="spirit-number">#${String(i.number).padStart(3, '0')}</td>
            <td class="spirit-img">${i.image ? `<img src="${escapeHtml(i.image)}" alt="" onerror="this.parentElement.innerHTML='-'">` : '-'}</td>
            <td><strong>${escapeHtml(i.name)}</strong></td>
            <td>${escapeHtml(i.category) || '道具'}</td>
            <td>${escapeHtml((i.description || '').slice(0, 30))}${(i.description || '').length > 30 ? '...' : ''}</td>
            <td class="spirit-actions">
              <button type="button" class="btn btn-ghost btn-sm btn-edit" data-id="${escapeHtml(i.id)}">编辑</button>
              <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${escapeHtml(i.id)}" data-name="${escapeHtml(i.name)}">删除</button>
            </td>
          </tr>
        `).join('');
      itemsTableBody.querySelectorAll('.btn-edit').forEach((btn) => {
        btn.onclick = () => openItemModal(btn.dataset.id);
      });
      itemsTableBody.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.onclick = () => deleteItem(btn.dataset.id, btn.dataset.name);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function openItemModal(id) {
  if (id) {
    $('#itemModalTitle').textContent = '编辑物品';
    formItem.itemId.value = id;
    apiFetch('/admin/items/' + id, {}).then(async (res) => {
      if (!res.ok) return;
      const i = await res.json();
      formItem.number.value = i.number;
      formItem.name.value = i.name || '';
      formItem.category.value = ITEM_CATEGORIES.includes(i.category) ? i.category : '道具';
      formItem.description.value = i.description || '';
      formItem.effect.value = i.effect || '';
      formItem.image.value = i.image || '';
      itemModal.classList.remove('hidden');
    });
  } else {
    $('#itemModalTitle').textContent = '添加物品';
    formItem.reset();
    formItem.itemId.value = '';
    formItem.number.value = '';
    formItem.name.value = '';
    formItem.category.value = '道具';
    formItem.description.value = '';
    formItem.effect.value = '';
    formItem.image.value = '';
    itemModal.classList.remove('hidden');
  }
}

function closeItemModal() {
  itemModal?.classList.add('hidden');
}

async function deleteItem(id, name) {
  if (!confirm(`确定要删除物品「${name}」吗？`)) return;
  try {
    const res = await apiFetch('/admin/items/' + id, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json.error || '删除失败'); return; }
    loadItems();
  } catch (err) {
    alert('网络错误');
  }
}

// ========== 角色管理（每账号 3 个角色） ==========

const characterModal = $('#characterModal');
const formCharacter = $('#formCharacter');
const charactersTableBody = $('#charactersTableBody');

$('#btnAddCharacter')?.addEventListener('click', () => openCharacterModal());
$('#btnCloseCharacterModal')?.addEventListener('click', () => closeCharacterModal());
$('#btnCancelCharacter')?.addEventListener('click', () => closeCharacterModal());
characterModal?.addEventListener('click', (e) => { if (e.target === characterModal) closeCharacterModal(); });

$('#btnCharacterSearch')?.addEventListener('click', () => loadCharacters());
$('#characterUserFilter')?.addEventListener('change', () => loadCharacters());

formCharacter?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = (form.querySelector('[name="characterId"]') || form.characterId)?.value?.trim();
  if (id) {
    const name = (form.querySelector('[name="name"]') || form.name)?.value?.trim() ?? '';
    const goldInput = form.querySelector('[name="gold"]') || form.gold;
    const rpInput = form.querySelector('[name="rp"]') || form.rp;
    const gold = Math.max(0, Math.floor(parseInt(goldInput?.value, 10) || 0));
    const rp = Math.max(0, Math.floor(parseInt(rpInput?.value, 10) || 0));
    if (!name) { alert('请填写角色名'); return; }
    try {
      const res = await apiFetch('/admin/characters/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, gold, rp }),
      });
      let json;
      try { json = await res.json(); } catch (_) { alert('服务器返回异常'); return; }
      if (!res.ok) { alert(json.error || '更新失败'); return; }
      closeCharacterModal();
      loadCharacters();
    } catch (err) { alert('网络错误: ' + (err.message || '')); }
  } else {
    const userId = form.userId?.value;
    const slot = parseInt(form.slot?.value, 10) || 1;
    const name = form.name?.value?.trim();
    if (!userId || !name) { alert('请选择账号并填写角色名'); return; }
    try {
      const res = await apiFetch('/admin/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, slot, name }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '创建失败'); return; }
      closeCharacterModal();
      loadCharacters();
    } catch (err) { alert('网络错误'); }
  }
});

async function loadCharacters() {
  const userId = $('#characterUserFilter')?.value || '';
  const params = userId ? '?userId=' + encodeURIComponent(userId) : '';
  try {
    const res = await apiFetch('/admin/characters' + params);
    if (!res.ok) { if (res.status === 403) showSection(forbiddenSection); return; }
    const { characters } = await res.json();
    if (charactersTableBody) {
      charactersTableBody.innerHTML = characters.length === 0
        ? '<tr><td colspan="6" class="empty">暂无角色</td></tr>'
        : characters.map((c) => `
          <tr data-id="${escapeHtml(c.id)}">
            <td>${escapeHtml(c.username)}</td>
            <td>${c.slot ?? '-'}</td>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td>${c.gold ?? 0}</td>
            <td>${c.rp ?? 0}</td>
            <td class="spirit-actions">
              <button type="button" class="btn btn-ghost btn-sm btn-edit" data-id="${escapeHtml(c.id)}" data-name="${escapeHtml(c.name)}" data-gold="${c.gold ?? 0}" data-rp="${c.rp ?? 0}">编辑</button>
              <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${escapeHtml(c.id)}" data-desc="${escapeHtml(c.username + ' - ' + c.name)}">删除</button>
            </td>
          </tr>
        `).join('');
      charactersTableBody.querySelectorAll('.btn-edit').forEach((btn) => {
        btn.onclick = () => openCharacterModal(btn.dataset.id, btn.dataset.name, btn.dataset.gold, btn.dataset.rp);
      });
      charactersTableBody.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.onclick = () => deleteCharacter(btn.dataset.id, btn.dataset.desc);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function openCharacterModal(id, name, gold, rp) {
  if (id) {
    $('#characterModalTitle').textContent = '编辑角色';
    const charIdInput = formCharacter.querySelector('[name="characterId"]') || formCharacter.characterId;
    if (charIdInput) charIdInput.value = id;
    formCharacter.userId?.closest('.form-row')?.classList.add('hidden');
    formCharacter.slot?.closest('.form-row')?.classList.add('hidden');
    const nameInput = formCharacter.querySelector('[name="name"]') || formCharacter.name;
    const goldInput = formCharacter.querySelector('[name="gold"]') || formCharacter.gold;
    const rpInput = formCharacter.querySelector('[name="rp"]') || formCharacter.rp;
    if (nameInput) nameInput.value = name || '';
    if (goldInput) goldInput.value = gold ?? 0;
    if (rpInput) rpInput.value = rp ?? 0;
    characterModal.classList.remove('hidden');
  } else {
    $('#characterModalTitle').textContent = '创建角色';
    formCharacter.reset();
    const charIdInput = formCharacter.querySelector('[name="characterId"]') || formCharacter.characterId;
    if (charIdInput) charIdInput.value = '';
    const goldInput = formCharacter.querySelector('[name="gold"]') || formCharacter.gold;
    const rpInput = formCharacter.querySelector('[name="rp"]') || formCharacter.rp;
    if (goldInput) goldInput.value = 0;
    if (rpInput) rpInput.value = 0;
    formCharacter.userId?.closest('.form-row')?.classList.remove('hidden');
    formCharacter.slot.closest('.form-row')?.classList.remove('hidden');
    try {
      const usersRes = await apiFetch('/admin/users');
      if (usersRes.ok) {
        const { users } = await usersRes.json();
        $('#characterUserId').innerHTML = '<option value="">请选择账号</option>' + (users || []).map((u) =>
          `<option value="${escapeHtml(u.id)}">${escapeHtml(u.username)}</option>`
        ).join('');
      }
      characterModal.classList.remove('hidden');
    } catch (err) {
      console.error(err);
    }
  }
}

function closeCharacterModal() {
  characterModal?.classList.add('hidden');
  formCharacter.userId.closest('.form-row')?.classList.remove('hidden');
  formCharacter.slot.closest('.form-row')?.classList.remove('hidden');
}

async function deleteCharacter(id, desc) {
  if (!confirm(`确定要删除角色「${desc}」吗？该角色的物品将一并删除。`)) return;
  try {
    const res = await apiFetch('/admin/characters/' + id, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json.error || '删除失败'); return; }
    loadCharacters();
    loadPlayerItems();
  } catch (err) {
    alert('网络错误');
  }
}

async function initCharacterFilters() {
  const userFilter = $('#characterUserFilter');
  if (!userFilter) return;
  try {
    const usersRes = await apiFetch('/admin/users');
    if (usersRes.ok) {
      const { users } = await usersRes.json();
      userFilter.innerHTML = '<option value="">全部账号</option>' + (users || []).map((u) =>
        `<option value="${escapeHtml(u.id)}">${escapeHtml(u.username)}</option>`
      ).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// ========== 玩家物品管理（按角色） ==========

const playerItemModal = $('#playerItemModal');
const formPlayerItem = $('#formPlayerItem');
const playerItemsTableBody = $('#playerItemsTableBody');

$('#btnAddPlayerItem')?.addEventListener('click', () => openPlayerItemModal());
$('#btnClosePlayerItemModal')?.addEventListener('click', () => closePlayerItemModal());
$('#btnCancelPlayerItem')?.addEventListener('click', () => closePlayerItemModal());
playerItemModal?.addEventListener('click', (e) => { if (e.target === playerItemModal) closePlayerItemModal(); });

$('#btnPlayerItemSearch')?.addEventListener('click', () => loadPlayerItems());
$('#playerItemCharacterFilter')?.addEventListener('change', () => loadPlayerItems());
$('#playerItemItemFilter')?.addEventListener('change', () => loadPlayerItems());

formPlayerItem?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const id = form.playerItemId?.value;
  if (id) {
    const quantity = parseInt(form.quantity?.value, 10) || 1;
    try {
      const res = await apiFetch('/admin/player-items/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '更新失败'); return; }
      closePlayerItemModal();
      loadPlayerItems();
    } catch (err) { alert('网络错误'); }
  } else {
    const characterId = form.characterId?.value;
    const itemId = form.itemId?.value;
    const quantity = parseInt(form.quantity?.value, 10) || 1;
    if (!characterId || !itemId) { alert('请选择角色和物品'); return; }
    try {
      const res = await apiFetch('/admin/player-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, itemId, quantity }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '发放失败'); return; }
      closePlayerItemModal();
      loadPlayerItems();
    } catch (err) { alert('网络错误'); }
  }
});

async function loadPlayerItems() {
  const characterId = $('#playerItemCharacterFilter')?.value || '';
  const itemId = $('#playerItemItemFilter')?.value || '';
  const params = new URLSearchParams();
  if (characterId) params.set('characterId', characterId);
  if (itemId) params.set('itemId', itemId);
  try {
    const res = await apiFetch('/admin/player-items?' + params.toString());
    if (!res.ok) { if (res.status === 403) showSection(forbiddenSection); return; }
    const { playerItems } = await res.json();
    if (playerItemsTableBody) {
      playerItemsTableBody.innerHTML = playerItems.length === 0
        ? '<tr><td colspan="5" class="empty">暂无玩家物品记录</td></tr>'
        : playerItems.map((pi) => `
          <tr data-id="${escapeHtml(pi.id)}">
            <td>${escapeHtml(pi.username)}</td>
            <td>${escapeHtml(pi.characterName)} (位${pi.characterSlot ?? '-'})</td>
            <td>#${String(pi.itemNumber || 0).padStart(3, '0')} ${escapeHtml(pi.itemName)}</td>
            <td>${pi.quantity ?? 0}</td>
            <td class="spirit-actions">
              <button type="button" class="btn btn-ghost btn-sm btn-edit" data-id="${escapeHtml(pi.id)}" data-quantity="${pi.quantity}" data-charactername="${escapeHtml(pi.characterName)}" data-itemname="${escapeHtml(pi.itemName)}">编辑</button>
              <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${escapeHtml(pi.id)}" data-desc="${escapeHtml(pi.characterName + ' - ' + pi.itemName)}">删除</button>
            </td>
          </tr>
        `).join('');
      playerItemsTableBody.querySelectorAll('.btn-edit').forEach((btn) => {
        btn.onclick = () => openPlayerItemModal(btn.dataset.id, btn.dataset.quantity, btn.dataset.charactername, btn.dataset.itemname);
      });
      playerItemsTableBody.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.onclick = () => deletePlayerItem(btn.dataset.id, btn.dataset.desc);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function openPlayerItemModal(id, quantity, characterName, itemName) {
  const characterIdSelect = $('#playerItemCharacterId');
  const itemIdSelect = $('#playerItemItemId');
  if (id) {
    $('#playerItemModalTitle').textContent = '修改数量';
    formPlayerItem.playerItemId.value = id;
    characterIdSelect.closest('.form-row').classList.add('hidden');
    itemIdSelect.closest('.form-row').classList.add('hidden');
    const qtyRow = formPlayerItem?.querySelector('[name="quantity"]')?.closest('.form-row');
    if (qtyRow && !qtyRow.querySelector('.edit-hint')) {
      const hint = document.createElement('p');
      hint.className = 'edit-hint';
      hint.style.cssText = 'font-size:0.9rem;color:var(--text-muted);margin-bottom:0.5rem;';
      hint.textContent = `${characterName || ''} · ${itemName || ''}`;
      qtyRow.insertBefore(hint, qtyRow.firstChild);
    }
    if (qtyRow?.querySelector('.edit-hint')) qtyRow.querySelector('.edit-hint').textContent = `${characterName || ''} · ${itemName || ''}`;
    formPlayerItem.quantity.value = quantity || 1;
    formPlayerItem.quantity.focus();
    playerItemModal.classList.remove('hidden');
  } else {
    characterIdSelect.closest('.form-row')?.classList.remove('hidden');
    itemIdSelect.closest('.form-row')?.classList.remove('hidden');
    const qtyRow = formPlayerItem?.querySelector('[name="quantity"]')?.closest('.form-row');
    const hint = qtyRow?.querySelector('.edit-hint');
    if (hint) hint.remove();
    $('#playerItemModalTitle').textContent = '发放物品';
    formPlayerItem.reset();
    formPlayerItem.playerItemId.value = '';
    formPlayerItem.quantity.value = 1;
    try {
      const [charactersRes, itemsRes] = await Promise.all([
        apiFetch('/admin/characters'),
        apiFetch('/admin/items'),
      ]);
      if (charactersRes.ok) {
        const { characters } = await charactersRes.json();
        characterIdSelect.innerHTML = '<option value="">请选择角色</option>' + (characters || []).map((c) =>
          `<option value="${escapeHtml(c.id)}">${escapeHtml(c.username)} - ${escapeHtml(c.name)} (位${c.slot})</option>`
        ).join('');
      }
      if (itemsRes.ok) {
        const { items } = await itemsRes.json();
        itemIdSelect.innerHTML = '<option value="">请选择物品</option>' + (items || []).map((i) =>
          `<option value="${escapeHtml(i.id)}">#${String(i.number || 0).padStart(3, '0')} ${escapeHtml(i.name)}</option>`
        ).join('');
      }
      playerItemModal.classList.remove('hidden');
    } catch (err) {
      console.error(err);
    }
  }
}

function closePlayerItemModal() {
  playerItemModal?.classList.add('hidden');
  $('#playerItemCharacterId')?.closest('.form-row')?.classList.remove('hidden');
  $('#playerItemItemId')?.closest('.form-row')?.classList.remove('hidden');
  formPlayerItem?.querySelector('[name="quantity"]')?.closest('.form-row')?.querySelector('.edit-hint')?.remove();
}

async function deletePlayerItem(id, desc) {
  if (!confirm(`确定要移除「${desc}」吗？`)) return;
  try {
    const res = await apiFetch('/admin/player-items/' + id, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json.error || '删除失败'); return; }
    loadPlayerItems();
  } catch (err) {
    alert('网络错误');
  }
}

// ========== 节日管理（仅 OW） ==========

const festivalModal = $('#festivalModal');
const formFestival = $('#formFestival');
const festivalsTableBody = $('#festivalsTableBody');

$('#btnAddFestival')?.addEventListener('click', () => openFestivalModal());
$('#btnCloseFestivalModal')?.addEventListener('click', () => closeFestivalModal());
$('#btnCancelFestival')?.addEventListener('click', () => closeFestivalModal());
festivalModal?.addEventListener('click', (e) => { if (e.target === festivalModal) closeFestivalModal(); });

formFestival?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const el = (n) => form.elements?.namedItem?.(n) || form.querySelector(`[name="${n}"]`);
  const id = el('festivalId')?.value || '';
  const startVal = el('startDate')?.value || '';
  const endVal = el('endDate')?.value || '';
  const nameVal = (el('name')?.value || '').trim();
  if (!nameVal || !startVal || !endVal) {
    alert('请填写节日名称、开始日期和结束日期');
    return;
  }
  const startDate = new Date(startVal);
  const endDate = new Date(endVal);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    alert('请填写有效的日期格式');
    return;
  }
  if (endDate <= startDate) {
    alert('结束日期必须晚于开始日期');
    return;
  }
  const payload = {
    name: nameVal,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    shineRateBoost: Math.min(10, Math.max(1, parseFloat(el('shineRateBoost')?.value) || 1)),
    goldBoost: Math.min(10, Math.max(1, parseFloat(el('goldBoost')?.value) || 1)),
    expBoost: Math.min(10, Math.max(1, parseFloat(el('expBoost')?.value) || 1)),
    captureRateBoost: Math.min(10, Math.max(1, parseFloat(el('captureRateBoost')?.value) || 1)),
  };
  try {
    if (id) {
      const res = await apiFetch('/admin/festivals/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '更新失败'); return; }
      closeFestivalModal();
      loadFestivals();
    } else {
      const res = await apiFetch('/admin/festivals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '添加失败'); return; }
      closeFestivalModal();
      loadFestivals();
    }
  } catch (err) {
    alert('网络错误');
  }
});

async function loadFestivals() {
  try {
    const res = await apiFetch('/admin/festivals');
    if (!res.ok) {
      if (res.status === 403) {
        if (festivalsTableBody) festivalsTableBody.innerHTML = '<tr><td colspan="8" class="empty">仅 OW 可管理节日</td></tr>';
        return;
      }
      return;
    }
    const { festivals } = await res.json();
    if (festivalsTableBody) {
      festivalsTableBody.innerHTML = festivals.length === 0
        ? '<tr><td colspan="8" class="empty">暂无节日</td></tr>'
        : festivals.map((f) => {
            const start = f.startDate ? new Date(f.startDate).toLocaleString('zh-CN') : '-';
            const end = f.endDate ? new Date(f.endDate).toLocaleString('zh-CN') : '-';
            return `
          <tr data-id="${escapeHtml(f.id)}">
            <td><strong>${escapeHtml(f.name)}</strong></td>
            <td>${escapeHtml(start)}</td>
            <td>${escapeHtml(end)}</td>
            <td>${f.shineRateBoost ?? 1}×</td>
            <td>${f.goldBoost ?? 1}×</td>
            <td>${f.expBoost ?? 1}×</td>
            <td>${f.captureRateBoost ?? 1}×</td>
            <td class="spirit-actions">
              <button type="button" class="btn btn-ghost btn-sm btn-edit" data-id="${escapeHtml(f.id)}">编辑</button>
              <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${escapeHtml(f.id)}" data-name="${escapeHtml(f.name)}">删除</button>
            </td>
          </tr>
        `;
          }).join('');
      festivalsTableBody.querySelectorAll('.btn-edit').forEach((btn) => {
        btn.onclick = () => openFestivalModal(btn.dataset.id);
      });
      festivalsTableBody.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.onclick = () => deleteFestival(btn.dataset.id, btn.dataset.name);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

function toDatetimeLocal(d) {
  if (!d) return '';
  const date = new Date(d);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

function getFestivalFormEl(n) {
  return formFestival?.elements?.namedItem?.(n) || formFestival?.querySelector?.(`[name="${n}"]`);
}

async function openFestivalModal(id) {
  if (id) {
    $('#festivalModalTitle').textContent = '编辑节日';
    const fid = getFestivalFormEl('festivalId');
    if (fid) fid.value = id;
    try {
      const res = await apiFetch('/admin/festivals');
      if (!res.ok) return;
      const { festivals } = await res.json();
      const f = festivals.find((x) => x.id === id);
      if (!f) return;
      const set = (n, v) => { const e = getFestivalFormEl(n); if (e) e.value = v; };
      set('name', f.name || '');
      set('startDate', toDatetimeLocal(f.startDate));
      set('endDate', toDatetimeLocal(f.endDate));
      set('shineRateBoost', f.shineRateBoost ?? 1);
      set('goldBoost', f.goldBoost ?? 1);
      set('expBoost', f.expBoost ?? 1);
      set('captureRateBoost', f.captureRateBoost ?? 1);
      festivalModal.classList.remove('hidden');
    } catch (err) {
      console.error(err);
    }
  } else {
    $('#festivalModalTitle').textContent = '添加节日';
    formFestival?.reset();
    const set = (n, v) => { const e = getFestivalFormEl(n); if (e) e.value = v; };
    set('festivalId', '');
    set('shineRateBoost', 1);
    set('goldBoost', 1);
    set('expBoost', 1);
    set('captureRateBoost', 1);
    festivalModal.classList.remove('hidden');
  }
}

function closeFestivalModal() {
  festivalModal?.classList.add('hidden');
}

async function deleteFestival(id, name) {
  if (!confirm(`确定要删除节日「${name}」吗？`)) return;
  try {
    const res = await apiFetch('/admin/festivals/' + id, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json.error || '删除失败'); return; }
    loadFestivals();
  } catch (err) {
    alert('网络错误');
  }
}

async function initPlayerItemFilters() {
  const characterFilter = $('#playerItemCharacterFilter');
  const itemFilter = $('#playerItemItemFilter');
  if (!characterFilter || !itemFilter) return;
  try {
    const [charactersRes, itemsRes] = await Promise.all([
      apiFetch('/admin/characters'),
      apiFetch('/admin/items'),
    ]);
    if (charactersRes.ok) {
      const { characters } = await charactersRes.json();
      characterFilter.innerHTML = '<option value="">全部角色</option>' + (characters || []).map((c) =>
        `<option value="${escapeHtml(c.id)}">${escapeHtml(c.username)} - ${escapeHtml(c.name)}</option>`
      ).join('');
    }
    if (itemsRes.ok) {
      const { items } = await itemsRes.json();
      itemFilter.innerHTML = '<option value="">全部物品</option>' + (items || []).map((i) =>
        `<option value="${escapeHtml(i.id)}">#${String(i.number || 0).padStart(3, '0')} ${escapeHtml(i.name)}</option>`
      ).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

// 初始化
(function init() {
  // 页面加载即显示服务器时间（登录前后都可见）
  loadServerTime();

  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    if ($('#adminUser')) $('#adminUser').textContent = '';
    showSection(loginSection);
    return;
  }
  if (['admin', 'ow'].includes(user.role)) {
    loadDashboard();
    showSection(dashboardSection);
  } else {
    showSection(forbiddenSection);
  }
})();
