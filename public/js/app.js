const API = '/api';

const $ = (sel) => document.querySelector(sel);

const homePage = $('#homePage');
const authOverlay = $('#authOverlay');
const loginForm = $('#loginForm');
const registerForm = $('#registerForm');
const btnLogin = $('#btnLogin');
const btnRegister = $('#btnRegister');
const btnJoinGame = $('#btnJoinGame');
const btnCloseAuth = $('#btnCloseAuth');
const btnLogout = $('#btnLogout');
const btnChangePwd = $('#btnChangePwd');
const userInfo = $('#userInfo');
const message = $('#message');
const linkLogin = $('#linkLogin');
const linkRegister = $('#linkRegister');
const btnRegisterSubmit = $('#btnRegisterSubmit');
const btnLoginSubmit = $('#formLogin')?.querySelector('button[type="submit"]');
const pwdOverlay = $('#pwdOverlay');
const btnClosePwd = $('#btnClosePwd');

function showMessage(text, type) {
  if (!message) return;
  message.textContent = text;
  message.className = 'message ' + (type || 'success');
  message.classList.remove('hidden');
  message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => message.classList.add('hidden'), 4000);
}

function getToken() { return localStorage.getItem('token'); }
function setToken(token) { token ? localStorage.setItem('token', token) : localStorage.removeItem('token'); }
function setUser(user) { user ? localStorage.setItem('user', JSON.stringify(user)) : localStorage.removeItem('user'); }
function getUser() { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; }

function showAuthOverlay() {
  if (authOverlay) authOverlay.classList.remove('hidden');
}
function hideAuthOverlay() {
  if (authOverlay) authOverlay.classList.add('hidden');
  if (loginForm) loginForm.classList.add('hidden');
  if (registerForm) registerForm.classList.add('hidden');
}

function showLoginForm() {
  showAuthOverlay();
  if (loginForm) loginForm.classList.remove('hidden');
  if (registerForm) registerForm.classList.add('hidden');
}
function showRegisterForm() {
  showAuthOverlay();
  if (registerForm) registerForm.classList.remove('hidden');
  if (loginForm) loginForm.classList.add('hidden');
}

async function refreshUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(API + '/user', {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!res.ok) {
      if (res.status === 401) { setToken(null); setUser(null); }
      return null;
    }
    const json = await res.json();
    if (json.user) { setUser(json.user); return json.user; }
  } catch (_) {}
  return getUser();
}

async function loadCharacters() {
  const list = $('#charactersList');
  if (!list) return;
  try {
    const res = await fetch(API + '/user/characters', {
      headers: { Authorization: 'Bearer ' + getToken() },
    });
    if (!res.ok) return;
    const json = await res.json();
    const chars = json.characters || [];
    list.innerHTML = chars.map((c, i) => {
      const name = c.name || '未命名';
      const gold = c.gold ?? 0;
      const rp = c.rp ?? 0;
      if (!c.id) return `<div class="character-card character-empty">槽位 ${i + 1}：空</div>`;
      return `<div class="character-card"><span class="char-name">${escapeHtml(name)}</span><span class="char-stats">金币 ${gold} · RP ${rp}</span></div>`;
    }).join('');
  } catch (_) {}
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateUI() {
  const user = getUser();
  const token = getToken();
  const heroActions = $('#heroActions');
  const heroLoggedIn = $('#heroLoggedIn');
  const heroUsername = $('#heroUsername');
  if (user && token) {
    if (userInfo) { userInfo.textContent = '欢迎，' + user.username; userInfo.classList.remove('hidden'); }
    if (btnChangePwd) btnChangePwd.classList.remove('hidden');
    if (btnLogout) btnLogout.classList.remove('hidden');
    if (btnLogin) btnLogin.classList.add('hidden');
    if (btnRegister) btnRegister.classList.add('hidden');
    if (heroActions) heroActions.classList.add('hidden');
    if (heroLoggedIn) { heroLoggedIn.classList.remove('hidden'); if (heroUsername) heroUsername.textContent = user.username; }
    if (homePage) homePage.classList.remove('hidden');
    loadCharacters();
    hideAuthOverlay();
  } else {
    const list = $('#charactersList');
    if (list) list.innerHTML = '';
    if (userInfo) userInfo.classList.add('hidden');
    if (btnChangePwd) btnChangePwd.classList.add('hidden');
    if (btnLogout) btnLogout.classList.add('hidden');
    if (btnLogin) btnLogin.classList.remove('hidden');
    if (btnRegister) btnRegister.classList.remove('hidden');
    if (heroActions) heroActions.classList.remove('hidden');
    if (heroLoggedIn) heroLoggedIn.classList.add('hidden');
    if (homePage) homePage.classList.remove('hidden');
    hideAuthOverlay();
  }
}

if (btnLogin) btnLogin.onclick = showLoginForm;
if (btnRegister) btnRegister.onclick = showRegisterForm;
if (btnJoinGame) btnJoinGame.onclick = showRegisterForm;
if (btnCloseAuth) btnCloseAuth.onclick = hideAuthOverlay;
if (linkLogin) linkLogin.onclick = (e) => { e.preventDefault(); showLoginForm(); };
if (linkRegister) linkRegister.onclick = (e) => { e.preventDefault(); showRegisterForm(); };

if (authOverlay) authOverlay.onclick = (e) => {
  if (e.target === authOverlay) hideAuthOverlay();
};

if (btnChangePwd) btnChangePwd.onclick = () => {
  if (pwdOverlay) pwdOverlay.classList.remove('hidden');
};
if (btnClosePwd) btnClosePwd.onclick = () => {
  if (pwdOverlay) pwdOverlay.classList.add('hidden');
};
if (pwdOverlay) pwdOverlay.onclick = (e) => {
  if (e.target === pwdOverlay) pwdOverlay.classList.add('hidden');
};

if (btnLogout) btnLogout.onclick = () => {
  setToken(null);
  setUser(null);
  updateUI();
  showMessage('已退出登录');
};

const formLogin = $('#formLogin');
if (formLogin) formLogin.onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const login = form.login?.value?.trim() || '';
  const pwd = form.password?.value || '';
  if (!login) { showMessage('请输入用户名或邮箱', 'error'); return; }
  if (!pwd) { showMessage('请输入密码', 'error'); return; }
  const data = { password: pwd };
  login.includes('@') ? (data.email = login) : (data.username = login);
  if (btnLoginSubmit) { btnLoginSubmit.disabled = true; btnLoginSubmit.textContent = '登录中...'; }
  try {
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) { showMessage(json.error || '登录失败', 'error'); return; }
    setToken(json.token);
    setUser(json.user);
    updateUI();
    showMessage('登录成功');
    form.reset();
    hideAuthOverlay();
  } catch (err) { showMessage(err.message === 'Failed to fetch' ? '无法连接服务器，请检查服务是否启动' : '网络错误，请稍后重试', 'error'); }
  finally { if (btnLoginSubmit) { btnLoginSubmit.disabled = false; btnLoginSubmit.textContent = '登录'; } }
};

const formRegister = $('#formRegister');
if (formRegister) formRegister.onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const username = form.username?.value?.trim() || '';
  const email = form.email?.value?.trim() || '';
  const password = form.password?.value || '';
  if (!username) { showMessage('请输入用户名', 'error'); return; }
  if (username.length < 3) { showMessage('用户名至少 3 个字符', 'error'); return; }
  if (!email) { showMessage('请输入邮箱', 'error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMessage('邮箱格式不正确', 'error'); return; }
  if (!password) { showMessage('请输入密码', 'error'); return; }
  if (password.length < 6) { showMessage('密码至少 6 位', 'error'); return; }
  const data = { username, email, password };
  if (btnRegisterSubmit) { btnRegisterSubmit.disabled = true; btnRegisterSubmit.textContent = '注册中...'; }
  try {
    const res = await fetch(API + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    let json;
    try { json = await res.json(); } catch (_) { showMessage('服务器返回异常', 'error'); return; }
    if (!res.ok) { showMessage(json?.error || '注册失败', 'error'); return; }
    showMessage('注册成功，请登录');
    form.reset();
    showLoginForm();
  } catch (err) { showMessage(err.message === 'Failed to fetch' ? '无法连接服务器，请检查服务是否启动' : '网络错误，请稍后重试', 'error'); }
  finally { if (btnRegisterSubmit) { btnRegisterSubmit.disabled = false; btnRegisterSubmit.textContent = '注册'; } }
};

const formChangePwd = $('#formChangePwd');
const btnPwdSubmit = $('#btnPwdSubmit');
if (formChangePwd) formChangePwd.onsubmit = async (e) => {
  e.preventDefault();
  const form = e.target;
  const current = form.currentPassword?.value || '';
  const newPwd = form.newPassword?.value || '';
  const confirm = form.confirmPassword?.value || '';
  if (!current) { showMessage('请输入当前密码', 'error'); return; }
  if (!newPwd) { showMessage('请输入新密码', 'error'); return; }
  if (newPwd.length < 6) { showMessage('新密码至少 6 位', 'error'); return; }
  if (newPwd !== confirm) { showMessage('两次输入的新密码不一致', 'error'); return; }
  if (btnPwdSubmit) { btnPwdSubmit.disabled = true; btnPwdSubmit.textContent = '修改中...'; }
  try {
    const res = await fetch(API + '/user/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      body: JSON.stringify({ currentPassword: current, newPassword: newPwd }),
    });
    const json = await res.json();
    if (!res.ok) { showMessage(json.error || '修改失败', 'error'); return; }
    showMessage('密码修改成功');
    form.reset();
    if (pwdOverlay) pwdOverlay.classList.add('hidden');
  } catch (err) { showMessage(err.message === 'Failed to fetch' ? '无法连接服务器' : '网络错误', 'error'); }
  finally { if (btnPwdSubmit) { btnPwdSubmit.disabled = false; btnPwdSubmit.textContent = '确认修改'; } }
};

(async function init() {
  const token = getToken();
  if (token) {
    const user = await refreshUser();
    if (!user) setToken(null);
  }
  updateUI();
})();
