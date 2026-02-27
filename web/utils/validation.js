/**
 * 输入校验与 sanitization，防止注入、XSS、过长输入
 */

// 用户名：3-20 位，仅字母数字下划线
const USERNAME_REGEX = /^[a-zA-Z0-9_\u4e00-\u9fa5]{3,20}$/;
// 邮箱格式
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// 密码：至少 6 位，建议含字母和数字
const PASSWORD_MIN_LEN = 6;
const PASSWORD_MAX_LEN = 128;

function sanitize(str, maxLen = 255) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, maxLen).replace(/[<>'"&]/g, '');
}

function validateUsername(username) {
  const s = sanitize(username, 20);
  if (!s || s.length < 3) return { ok: false, error: '用户名至少 3 个字符' };
  if (s.length > 20) return { ok: false, error: '用户名最多 20 个字符' };
  if (!USERNAME_REGEX.test(s)) return { ok: false, error: '用户名仅支持字母、数字、下划线和中文' };
  return { ok: true, value: s };
}

function validateEmail(email) {
  const s = sanitize(email, 254);
  if (!s) return { ok: false, error: '请输入邮箱' };
  if (!EMAIL_REGEX.test(s)) return { ok: false, error: '邮箱格式不正确' };
  return { ok: true, value: s.toLowerCase() };
}

function validatePassword(password) {
  if (typeof password !== 'string') return { ok: false, error: '请输入密码' };
  const p = password;
  if (p.length < PASSWORD_MIN_LEN) return { ok: false, error: '密码至少 6 位' };
  if (p.length > PASSWORD_MAX_LEN) return { ok: false, error: '密码过长' };
  // 禁止常见弱密码
  const weak = ['123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234', '111111', '1234567', 'dragon'];
  if (weak.includes(p.toLowerCase())) return { ok: false, error: '密码过于简单，请使用更复杂的密码' };
  return { ok: true, value: p };
}

module.exports = {
  sanitize,
  validateUsername,
  validateEmail,
  validatePassword,
};
