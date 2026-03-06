const express = require('express');
const User = require('../models/User');
const Spirit = require('../models/Spirit');
const Skill = require('../models/Skill');
const Item = require('../models/Item');
const PlayerItem = require('../models/PlayerItem');
const PlayerSpirit = require('../models/PlayerSpirit');
const Character = require('../models/Character');
const Festival = require('../models/Festival');
const Mail = require('../models/Mail');
const AdminLog = require('../models/AdminLog');
const wsHub = require('../wsHub');
const { authMiddleware } = require('../middleware/auth');
const { adminMiddleware } = require('../middleware/admin');

const router = express.Router();

async function logAdminAction(operatorId, operatorName, action, detail = '', targetId = '') {
  try {
    await AdminLog.create({
      operator: operatorId,
      operatorName: operatorName || '',
      action,
      detail,
      targetId,
    });
  } catch (err) {
    console.error('AdminLog create error:', err.message);
  }
}

router.get('/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, { password_hash: 0 })
      .sort({ created_at: -1 })
      .lean();
    const list = users.map((u) => ({
      id: u._id.toString(),
      username: u.username,
      email: u.email,
      role: u.role || 'user',
      created_at: u.created_at,
      last_login: u.last_login,
    }));
    res.json({ users: list });
  } catch (err) {
    console.error('Admin users error:', err.message);
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

router.get('/logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action, limit = 200 } = req.query;
    const filter = {};
    if (action) filter.action = action;
    const logs = await AdminLog.find(filter)
      .sort({ created_at: -1 })
      .limit(Math.min(500, Math.max(1, Number(limit) || 200)))
      .lean();
    const list = logs.map((l) => ({
      id: l._id.toString(),
      operatorId: l.operator?.toString(),
      operatorName: l.operatorName || '',
      action: l.action,
      detail: l.detail || '',
      targetId: l.targetId || '',
      created_at: l.created_at,
    }));
    res.json({ logs: list });
  } catch (err) {
    console.error('Admin logs error:', err.message);
    res.status(500).json({ error: '获取日志失败' });
  }
});

router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const total = await User.countDocuments();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = await User.countDocuments({ created_at: { $gte: today } });
    res.json({ total, newToday });
  } catch (err) {
    res.status(500).json({ error: '获取统计失败' });
  }
});

router.put('/users/:id/role', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    if (!['admin', 'user', 'ow'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    const operator = await User.findById(req.user.id);
    const target = await User.findById(id);
    if (!target) return res.status(404).json({ error: '用户不存在' });

    if (id === req.user.id && role !== 'ow' && operator.role === 'ow') {
      const owCount = await User.countDocuments({ role: 'ow' });
      if (owCount <= 1) return res.status(400).json({ error: '至少保留一个 OW 账号' });
    }
    if (id === req.user.id && role === 'user') {
      return res.status(400).json({ error: '不能取消自己的管理员权限' });
    }

    if (operator.role === 'admin') {
      return res.status(403).json({ error: '仅 OW 可设置或取消管理员' });
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true, runValidators: true });
    await logAdminAction(req.user.id, operator.username, 'user_role', `将 ${target.username} 设为 ${role}`, id);
    res.json({ message: '角色已更新', user: { id: user._id.toString(), username: user.username, role: user.role } });
  } catch (err) {
    console.error('Set role error:', err.message);
    res.status(500).json({ error: '操作失败' });
  }
});

router.delete('/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const operator = await User.findById(req.user.id);
    if (operator.role !== 'ow') {
      return res.status(403).json({ error: '仅 OW 可删除账号' });
    }
    if (id === req.user.id) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }
    const target = await User.findById(id);
    if (!target) return res.status(404).json({ error: '用户不存在' });
    if (target.role === 'ow') {
      const owCount = await User.countDocuments({ role: 'ow' });
      if (owCount <= 1) return res.status(400).json({ error: '至少保留一个 OW 账号' });
    }
    await User.findByIdAndDelete(id);
    await logAdminAction(req.user.id, operator.username, 'user_delete', `删除用户 ${target.username}`, id);
    res.json({ message: '账号已删除' });
  } catch (err) {
    console.error('Delete user error:', err.message);
    res.status(500).json({ error: '操作失败' });
  }
});

// ========== 邮件发送 ==========

function parseAttachmentsText(raw) {
  const list = [];
  if (!raw) return list;
  const parts = String(raw).split(/[，,；;]+/);
  for (const p of parts) {
    const s = String(p || '').trim();
    if (!s) continue;
    const m = s.match(/^(\d+)(?:\s*[xX\*：:]\s*(\d+))?$/);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    const qty = parseInt(m[2] || '1', 10);
    if (!Number.isFinite(num) || num <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    list.push({ number: num, quantity: qty });
  }
  return list;
}

router.post('/mail/send', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { targetType, targetValue, title, content, attachmentsText, goldAmount, spiritsText } = req.body || {};
    const t = String(title || '').trim();
    let c = String(content || '').trim();
    if (!t || !c) {
      return res.status(400).json({ error: '标题和正文均为必填' });
    }
    if (t.length > 64) c = c.slice(0, 64);
    if (c.length > 2000) c = c.slice(0, 2000);

    let users = [];
    let targetDesc = '';

    if (targetType === 'all') {
      users = await User.find({}, { _id: 1, username: 1 }).lean();
      targetDesc = `全部用户 (${users.length} 人)`;
    } else if (targetType === 'userId') {
      const id = String(targetValue || '').trim();
      if (!id) return res.status(400).json({ error: '请填写用户ID' });
      const u = await User.findById(id).lean();
      if (!u) return res.status(404).json({ error: '用户不存在' });
      users = [u];
      targetDesc = `userId=${u._id.toString()} (${u.username})`;
    } else {
      // 默认按用户名
      const username = String(targetValue || '').trim();
      if (!username) return res.status(400).json({ error: '请填写用户名' });
      const u = await User.findOne({ username }).lean();
      if (!u) return res.status(404).json({ error: '用户不存在' });
      users = [u];
      targetDesc = `username=${u.username}`;
    }

    if (!users || users.length === 0) {
      return res.status(400).json({ error: '未找到目标用户' });
    }

    // 解析附件：根据物品编号和数量
    const attachmentSpecs = parseAttachmentsText(attachmentsText);
    let attachmentItems = [];
    if (attachmentSpecs.length > 0) {
      const numbers = [...new Set(attachmentSpecs.map((a) => a.number))];
      attachmentItems = await Item.find({ number: { $in: numbers } }, { _id: 1, number: 1, name: 1 }).lean();
    }
    const attachments = attachmentSpecs
      .slice(0, 5)
      .map((spec) => {
        const item = attachmentItems.find((it) => it.number === spec.number);
        if (!item) return null;
        return {
          item: item._id,
          quantity: spec.quantity,
          claimed: false,
        };
      })
      .filter(Boolean);

    const gold = Math.max(0, Math.floor(Number(goldAmount) || 0));
    const spiritNumbers = (String(spiritsText || '').trim().split(/[,，\s]+/).map((n) => parseInt(n, 10)).filter((n) => !isNaN(n) && n > 0)).slice(0, 5);
    let spiritDocs = [];
    if (spiritNumbers.length > 0) {
      spiritDocs = await Spirit.find({ number: { $in: spiritNumbers } }, { _id: 1, number: 1 }).lean();
    }
    const spirits = spiritNumbers.slice(0, 5).map((num) => {
      const sp = spiritDocs.find((s) => s.number === num);
      return sp ? { spirit: sp._id, claimed: false } : null;
    }).filter(Boolean);

    // 按角色维度发送：为每个角色生成一封邮件（包含相同附件）
    const userIds = users.map((u) => u._id);
    const characters = await Character.find({ user: { $in: userIds } }, { _id: 1, user: 1, slot: 1, name: 1 }).lean();
    if (!characters || characters.length === 0) {
      return res.status(400).json({ error: '目标账号下没有角色' });
    }

    const docs = characters.map((ch) => ({
      user: ch.user,
      character: ch._id,
      title: t,
      content: c,
      attachments,
      spirits,
      gold,
      goldClaimed: false,
    }));
    await Mail.insertMany(docs);

    // WS 即时通知：目标角色收到新邮件后，客户端立即显示图标/刷新列表
    // 不在这里计算 unread（群发时会很重）；订阅时会推一次 unread，读/删/领时会推 unread 更新。
    try {
      for (const ch of characters) wsHub.notifyMailNew(ch._id.toString(), null);
    } catch (_) {}

    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'mail', `发送邮件「${t}」给 ${targetDesc} 的 ${characters.length} 个角色`, '');

    res.json({ ok: true, count: docs.length });
  } catch (err) {
    console.error('Admin mail send error:', err.message);
    res.status(500).json({ error: '发送邮件失败' });
  }
});

// ========== 妖灵管理（宝可梦风格） ==========

router.get('/spirits', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { search, type, sort = 'number', order = 'asc' } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [{ name: new RegExp(escapeRegex(search), 'i') }];
      if (!isNaN(Number(search))) filter.$or.push({ number: Number(search) });
    }
    if (type) filter.types = type;
    const sortOpt = { [sort]: order === 'desc' ? -1 : 1 };
    const spirits = await Spirit.find(filter).sort(sortOpt).lean();
    const list = spirits.map((s) => ({
      id: s._id.toString(),
      number: s.number,
      name: s.name,
      types: s.types || [],
      stats: s.stats || {},
      description: s.description || '',
      image: s.image || '',
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
    res.json({ spirits: list });
  } catch (err) {
    console.error('Admin spirits list error:', err.message);
    res.status(500).json({ error: '获取妖灵列表失败' });
  }
});

router.get('/spirits/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const spirit = await Spirit.findById(req.params.id).lean();
    if (!spirit) return res.status(404).json({ error: '妖灵不存在' });
    res.json({
      id: spirit._id.toString(),
      number: spirit.number,
      name: spirit.name,
      types: spirit.types || [],
      stats: spirit.stats || {},
      description: spirit.description || '',
      image: spirit.image || '',
    });
  } catch (err) {
    console.error('Admin spirit get error:', err.message);
    res.status(500).json({ error: '获取妖灵失败' });
  }
});

router.post('/spirits', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { number, name, types, stats, description, image } = req.body;
    if (!number || !name) return res.status(400).json({ error: '编号和名称为必填' });
    const exists = await Spirit.findOne({ number: Number(number) });
    if (exists) return res.status(400).json({ error: '该编号已存在' });
    const spirit = await Spirit.create({
      number: Number(number),
      name: String(name).trim(),
      types: Array.isArray(types) ? types.filter(Boolean) : [],
      stats: normalizeStats(stats),
      description: String(description || '').trim(),
      image: String(image || '').trim(),
    });
    await logAdminAction(req.user.id, (await User.findById(req.user.id).select('username')).username, 'spirit', `添加妖灵 #${number} ${name}`, spirit._id.toString());
    res.status(201).json({ message: '添加成功', id: spirit._id.toString() });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message || '数据校验失败' });
    }
    console.error('Admin spirit create error:', err.message);
    res.status(500).json({ error: '添加妖灵失败' });
  }
});

router.put('/spirits/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { number, name, types, stats, description, image } = req.body;
    const spirit = await Spirit.findById(req.params.id);
    if (!spirit) return res.status(404).json({ error: '妖灵不存在' });
    if (number != null) {
      const num = Number(number);
      const exists = await Spirit.findOne({ number: num, _id: { $ne: spirit._id } });
      if (exists) return res.status(400).json({ error: '该编号已被其他妖灵使用' });
      spirit.number = num;
    }
    if (name != null) spirit.name = String(name).trim();
    if (types != null) spirit.types = Array.isArray(types) ? types.filter(Boolean) : spirit.types;
    if (stats != null) spirit.stats = normalizeStats(stats);
    if (description != null) spirit.description = String(description).trim();
    if (image != null) spirit.image = String(image).trim();
    await spirit.save();
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'spirit', `更新妖灵 #${spirit.number} ${spirit.name}`, spirit._id.toString());
    res.json({ message: '更新成功' });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message || '数据校验失败' });
    }
    console.error('Admin spirit update error:', err.message);
    res.status(500).json({ error: '更新妖灵失败' });
  }
});

router.delete('/spirits/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const spirit = await Spirit.findByIdAndDelete(req.params.id);
    if (!spirit) return res.status(404).json({ error: '妖灵不存在' });
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'spirit', `删除妖灵 #${spirit.number} ${spirit.name}`, spirit._id.toString());
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('Admin spirit delete error:', err.message);
    res.status(500).json({ error: '删除妖灵失败' });
  }
});

// ========== 技能管理 ==========

router.get('/skills', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { search, type, category, sort = 'number', order = 'asc' } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [{ name: new RegExp(escapeRegex(search), 'i') }];
      if (!isNaN(Number(search))) filter.$or.push({ number: Number(search) });
    }
    if (type) filter.type = type;
    if (category) filter.category = category;
    const sortOpt = { [sort]: order === 'desc' ? -1 : 1 };
    const skills = await Skill.find(filter).sort(sortOpt).lean();
    const list = skills.map((s) => ({
      id: s._id.toString(),
      number: s.number,
      name: s.name,
      type: s.type || '',
      category: s.category || '',
      power: s.power ?? 0,
      accuracy: s.accuracy ?? 100,
      pp: s.pp ?? 10,
      description: s.description || '',
      effect: s.effect || '',
    }));
    res.json({ skills: list });
  } catch (err) {
    console.error('Admin skills list error:', err.message);
    res.status(500).json({ error: '获取技能列表失败' });
  }
});

router.get('/skills/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id).lean();
    if (!skill) return res.status(404).json({ error: '技能不存在' });
    res.json({
      id: skill._id.toString(),
      number: skill.number,
      name: skill.name,
      type: skill.type || '',
      category: skill.category || '',
      power: skill.power ?? 0,
      accuracy: skill.accuracy ?? 100,
      pp: skill.pp ?? 10,
      description: skill.description || '',
      effect: skill.effect || '',
    });
  } catch (err) {
    console.error('Admin skill get error:', err.message);
    res.status(500).json({ error: '获取技能失败' });
  }
});

router.post('/skills', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { number, name, type, category, power, accuracy, pp, description, effect } = req.body;
    if (!number || !name) return res.status(400).json({ error: '编号和名称为必填' });
    const exists = await Skill.findOne({ number: Number(number) });
    if (exists) return res.status(400).json({ error: '该编号已存在' });
    const skill = await Skill.create({
      number: Number(number),
      name: String(name).trim(),
      type: String(type || '').trim(),
      category: ['物理', '特殊', '变化'].includes(category) ? category : '',
      power: Math.min(300, Math.max(0, Number(power) || 0)),
      accuracy: Math.min(100, Math.max(0, Number(accuracy) ?? 100)),
      pp: Math.min(40, Math.max(1, Number(pp) ?? 10)),
      description: String(description || '').trim(),
      effect: String(effect || '').trim(),
    });
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'skill', `添加技能 #${number} ${name}`, skill._id.toString());
    res.status(201).json({ message: '添加成功', id: skill._id.toString() });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message || '数据校验失败' });
    console.error('Admin skill create error:', err.message);
    res.status(500).json({ error: '添加技能失败' });
  }
});

router.put('/skills/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { number, name, type, category, power, accuracy, pp, description, effect } = req.body;
    const skill = await Skill.findById(req.params.id);
    if (!skill) return res.status(404).json({ error: '技能不存在' });
    if (number != null) {
      const num = Number(number);
      const exists = await Skill.findOne({ number: num, _id: { $ne: skill._id } });
      if (exists) return res.status(400).json({ error: '该编号已被其他技能使用' });
      skill.number = num;
    }
    if (name != null) skill.name = String(name).trim();
    if (type != null) skill.type = String(type || '').trim();
    if (category != null) skill.category = ['物理', '特殊', '变化'].includes(category) ? category : skill.category;
    if (power != null) skill.power = Math.min(300, Math.max(0, Number(power) ?? 0));
    if (accuracy != null) skill.accuracy = Math.min(100, Math.max(0, Number(accuracy) ?? 100));
    if (pp != null) skill.pp = Math.min(40, Math.max(1, Number(pp) ?? 10));
    if (description != null) skill.description = String(description || '').trim();
    if (effect != null) skill.effect = String(effect || '').trim();
    await skill.save();
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'skill', `更新技能 #${skill.number} ${skill.name}`, skill._id.toString());
    res.json({ message: '更新成功' });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message || '数据校验失败' });
    console.error('Admin skill update error:', err.message);
    res.status(500).json({ error: '更新技能失败' });
  }
});

router.delete('/skills/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const skill = await Skill.findByIdAndDelete(req.params.id);
    if (!skill) return res.status(404).json({ error: '技能不存在' });
    await Spirit.updateMany({ skills: skill._id }, { $pull: { skills: skill._id } });
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'skill', `删除技能 #${skill.number} ${skill.name}`, skill._id.toString());
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('Admin skill delete error:', err.message);
    res.status(500).json({ error: '删除技能失败' });
  }
});

// ========== 物品管理 ==========

router.get('/items', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { search, category, sort = 'number', order = 'asc' } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [{ name: new RegExp(escapeRegex(search), 'i') }];
      if (!isNaN(Number(search))) filter.$or.push({ number: Number(search) });
    }
    if (category) filter.category = category;
    const sortOpt = { [sort]: order === 'desc' ? -1 : 1 };
    const items = await Item.find(filter).sort(sortOpt).lean();
    const list = items.map((i) => ({
      id: i._id.toString(),
      number: i.number,
      name: i.name,
      category: i.category || '',
      description: i.description || '',
      effect: i.effect || '',
      image: i.image || '',
    }));
    res.json({ items: list });
  } catch (err) {
    console.error('Admin items list error:', err.message);
    res.status(500).json({ error: '获取物品列表失败' });
  }
});

router.get('/items/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).lean();
    if (!item) return res.status(404).json({ error: '物品不存在' });
    res.json({
      id: item._id.toString(),
      number: item.number,
      name: item.name,
      category: item.category || '',
      description: item.description || '',
      effect: item.effect || '',
      image: item.image || '',
    });
  } catch (err) {
    console.error('Admin item get error:', err.message);
    res.status(500).json({ error: '获取物品失败' });
  }
});

router.post('/items', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { number, name, category, description, effect, image } = req.body;
    if (!number || !name) return res.status(400).json({ error: '编号和名称为必填' });
    const exists = await Item.findOne({ number: Number(number) });
    if (exists) return res.status(400).json({ error: '该编号已存在' });
    const item = await Item.create({
      number: Number(number),
      name: String(name).trim(),
      category: normalizeItemCategory(category),
      description: String(description || '').trim(),
      effect: String(effect || '').trim(),
      image: String(image || '').trim(),
    });
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'item', `添加物品 #${number} ${name}`, item._id.toString());
    res.status(201).json({ message: '添加成功', id: item._id.toString() });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message || '数据校验失败' });
    console.error('Admin item create error:', err.message);
    res.status(500).json({ error: '添加物品失败' });
  }
});

router.put('/items/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { number, name, category, description, effect, image } = req.body;
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: '物品不存在' });
    if (number != null) {
      const num = Number(number);
      const exists = await Item.findOne({ number: num, _id: { $ne: item._id } });
      if (exists) return res.status(400).json({ error: '该编号已被其他物品使用' });
      item.number = num;
    }
    if (name != null) item.name = String(name).trim();
    if (category != null) item.category = normalizeItemCategory(category);
    if (description != null) item.description = String(description || '').trim();
    if (effect != null) item.effect = String(effect || '').trim();
    if (image != null) item.image = String(image || '').trim();
    await item.save();
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'item', `更新物品 #${item.number} ${item.name}`, item._id.toString());
    res.json({ message: '更新成功' });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message || '数据校验失败' });
    console.error('Admin item update error:', err.message);
    res.status(500).json({ error: '更新物品失败' });
  }
});

router.delete('/items/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ error: '物品不存在' });
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'item', `删除物品 #${item.number} ${item.name}`, item._id.toString());
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('Admin item delete error:', err.message);
    res.status(500).json({ error: '删除物品失败' });
  }
});

// ========== 节日管理（仅 OW） ==========

router.get('/festivals', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const operator = await User.findById(req.user.id);
    if (operator.role !== 'ow') return res.status(403).json({ error: '仅 OW 可管理节日' });
    const festivals = await Festival.find({}).sort({ startDate: 1 }).lean();
    const list = festivals.map((f) => ({
      id: f._id.toString(),
      name: f.name,
      startDate: f.startDate,
      endDate: f.endDate,
      shineRateBoost: f.shineRateBoost ?? 1,
      goldBoost: f.goldBoost ?? 1,
      expBoost: f.expBoost ?? 1,
      captureRateBoost: f.captureRateBoost ?? 1,
      created_at: f.created_at,
      updated_at: f.updated_at,
    }));
    res.json({ festivals: list });
  } catch (err) {
    console.error('Admin festivals list error:', err.message);
    res.status(500).json({ error: '获取节日列表失败' });
  }
});

router.post('/festivals', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const operator = await User.findById(req.user.id);
    if (operator.role !== 'ow') return res.status(403).json({ error: '仅 OW 可管理节日' });
    const { name, startDate, endDate, shineRateBoost, goldBoost, expBoost, captureRateBoost } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: '请填写节日名称、开始日期和结束日期' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: '请填写有效的开始和结束日期，且结束日期晚于开始日期' });
    }
    const festival = await Festival.create({
      name: String(name).trim().slice(0, 64),
      startDate: start,
      endDate: end,
      shineRateBoost: Math.min(10, Math.max(1, Number(shineRateBoost) || 1)),
      goldBoost: Math.min(10, Math.max(1, Number(goldBoost) || 1)),
      expBoost: Math.min(10, Math.max(1, Number(expBoost) || 1)),
      captureRateBoost: Math.min(10, Math.max(1, Number(captureRateBoost) || 1)),
    });
    await logAdminAction(req.user.id, operator.username, 'festival', `添加节日 ${festival.name}`, festival._id.toString());
    res.status(201).json({
      id: festival._id.toString(),
      name: festival.name,
      startDate: festival.startDate,
      endDate: festival.endDate,
      created_at: festival.created_at,
      updated_at: festival.updated_at,
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = err.errors ? Object.values(err.errors).map((e) => e.message).join('; ') : (err.message || '数据校验失败');
      return res.status(400).json({ error: msg });
    }
    console.error('Admin festival create error:', err);
    res.status(500).json({ error: err.message || '添加节日失败' });
  }
});

router.put('/festivals/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const operator = await User.findById(req.user.id);
    if (operator.role !== 'ow') return res.status(403).json({ error: '仅 OW 可管理节日' });
    const festival = await Festival.findById(req.params.id);
    if (!festival) return res.status(404).json({ error: '节日不存在' });
    const { name, startDate, endDate, shineRateBoost, goldBoost, expBoost, captureRateBoost } = req.body;
    if (name != null) festival.name = String(name).trim().slice(0, 64);
    if (startDate != null) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) festival.startDate = start;
    }
    if (endDate != null) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) festival.endDate = end;
    }
    if (festival.endDate <= festival.startDate) {
      return res.status(400).json({ error: '结束日期必须晚于开始日期' });
    }
    if (shineRateBoost != null) festival.shineRateBoost = Math.min(10, Math.max(1, Number(shineRateBoost) || 1));
    if (goldBoost != null) festival.goldBoost = Math.min(10, Math.max(1, Number(goldBoost) || 1));
    if (expBoost != null) festival.expBoost = Math.min(10, Math.max(1, Number(expBoost) || 1));
    if (captureRateBoost != null) festival.captureRateBoost = Math.min(10, Math.max(1, Number(captureRateBoost) || 1));
    await festival.save();
    await logAdminAction(req.user.id, operator.username, 'festival', `更新节日 ${festival.name}`, festival._id.toString());
    res.json({ message: '更新成功' });
  } catch (err) {
    console.error('Admin festival update error:', err.message);
    res.status(500).json({ error: '更新节日失败' });
  }
});

router.delete('/festivals/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const operator = await User.findById(req.user.id);
    if (operator.role !== 'ow') return res.status(403).json({ error: '仅 OW 可管理节日' });
    const festival = await Festival.findByIdAndDelete(req.params.id);
    if (!festival) return res.status(404).json({ error: '节日不存在' });
    await logAdminAction(req.user.id, operator.username, 'festival', `删除节日 ${festival.name}`, festival._id.toString());
    res.json({ message: '已删除' });
  } catch (err) {
    console.error('Admin festival delete error:', err.message);
    res.status(500).json({ error: '删除节日失败' });
  }
});

// ========== 角色管理（每账号 3 个角色） ==========

router.get('/characters', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId } = req.query;
    const filter = userId ? { user: userId } : {};
    const characters = await Character.find(filter)
      .populate('user', 'username')
      .sort({ user: 1, slot: 1 })
      .lean();
    const list = characters.map((c) => ({
      id: c._id.toString(),
      userId: c.user?._id?.toString(),
      username: c.user?.username || '-',
      slot: c.slot,
      name: c.name || '',
      gold: c.gold ?? 0,
      rp: c.rp ?? 0,
      backpackCapacity: c.backpackCapacity ?? 9999,
      created_at: c.created_at,
    }));
    res.json({ characters: list });
  } catch (err) {
    console.error('Admin characters list error:', err.message);
    res.status(500).json({ error: '获取角色列表失败' });
  }
});

router.post('/characters', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, slot, name, backpackCapacity } = req.body;
    if (!userId || !name) return res.status(400).json({ error: '用户和角色名为必填' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    const s = Math.min(3, Math.max(1, Number(slot) || 1));
    const exists = await Character.findOne({ user: userId, slot: s });
    if (exists) return res.status(400).json({ error: `该账号角色位 ${s} 已存在` });
    const count = await Character.countDocuments({ user: userId });
    if (count >= 3) return res.status(400).json({ error: '每个账号最多 3 个角色' });
    const cap = backpackCapacity != null ? Math.min(200, Math.max(10, Math.floor(Number(backpackCapacity) || 30))) : 30;
    const character = await Character.create({
      user: userId,
      slot: s,
      name: String(name).trim().slice(0, 20),
      gold: 0,
      rp: 0,
      backpackCapacity: cap,
    });
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'character', `为用户 ${user.username} 创建角色位${s} ${character.name}`, character._id.toString());
    res.status(201).json({ message: '创建成功', id: character._id.toString() });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message || '数据校验失败' });
    console.error('Admin character create error:', err.message);
    res.status(500).json({ error: '创建角色失败' });
  }
});

router.put('/characters/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, gold, rp, backpackCapacity } = req.body;
    const character = await Character.findById(req.params.id);
    if (!character) return res.status(404).json({ error: '角色不存在' });
    if (name != null) {
      const n = String(name).trim().slice(0, 20);
      if (n) character.name = n;
    }
    if (gold != null) character.gold = Math.max(0, Math.floor(Number(gold) || 0));
    if (rp != null) character.rp = Math.max(0, Math.floor(Number(rp) || 0));
    if (backpackCapacity != null) character.backpackCapacity = Math.min(99999, Math.max(10, Math.floor(Number(backpackCapacity) || 9999)));
    await character.save();
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'character', `更新角色 ${character.name}`, character._id.toString());
    res.json({ message: '更新成功' });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message || '数据校验失败' });
    console.error('Admin character update error:', err.message);
    res.status(500).json({ error: err.message || '更新失败' });
  }
});

router.delete('/characters/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const character = await Character.findByIdAndDelete(req.params.id);
    if (!character) return res.status(404).json({ error: '角色不存在' });
    await PlayerItem.deleteMany({ character: character._id });
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'character', `删除角色 ${character.name}`, character._id.toString());
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('Admin character delete error:', err.message);
    res.status(500).json({ error: '删除失败' });
  }
});

// ========== 玩家物品管理（按角色） ==========

router.get('/player-items', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, characterId, itemId } = req.query;
    const filter = {};
    if (userId) {
      const chars = await Character.find({ user: userId }).select('_id').lean();
      const charIds = chars.map((c) => c._id);
      filter.character = { $in: charIds };
    }
    if (characterId) filter.character = characterId;
    if (itemId) filter.item = itemId;
    const playerItems = await PlayerItem.find(filter)
      .populate({ path: 'character', populate: { path: 'user', select: 'username' } })
      .populate('item', 'number name category image')
      .sort({ slot: 1, updated_at: -1 })
      .lean();
    const list = playerItems.map((pi) => ({
      id: pi._id.toString(),
      characterId: pi.character?._id?.toString(),
      characterName: pi.character?.name || '-',
      characterSlot: pi.character?.slot,
      username: pi.character?.user?.username || '-',
      itemId: pi.item?._id?.toString(),
      itemNumber: pi.item?.number,
      itemName: pi.item?.name || '-',
      itemCategory: pi.item?.category || '',
      itemImage: pi.item?.image || '',
      quantity: pi.quantity,
      slot: pi.slot ?? 0,
      updated_at: pi.updated_at,
    }));
    res.json({ playerItems: list });
  } catch (err) {
    console.error('Admin player-items list error:', err.message);
    res.status(500).json({ error: '获取玩家物品列表失败' });
  }
});

router.post('/player-items', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { characterId, itemId, quantity } = req.body;
    if (!characterId || !itemId) return res.status(400).json({ error: '角色和物品为必填' });
    const character = await Character.findById(characterId);
    if (!character) return res.status(404).json({ error: '角色不存在' });
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: '物品不存在' });
    const qty = Math.max(1, Math.min(99999, Number(quantity) || 1));
    let playerItem = await PlayerItem.findOne({ character: characterId, item: itemId });
    if (playerItem) {
      playerItem.quantity += qty;
      await playerItem.save();
    } else {
      const cap = character.backpackCapacity ?? 9999;
      if (cap < 9999) {
        const count = await PlayerItem.countDocuments({ character: characterId });
        if (count >= cap) return res.status(400).json({ error: `背包已满（${cap} 格），无法添加新物品` });
      }
      const maxSlot = await PlayerItem.findOne({ character: characterId }).sort({ slot: -1 }).select('slot').lean();
      const nextSlot = (maxSlot?.slot ?? -1) + 1;
      playerItem = await PlayerItem.create({ character: characterId, item: itemId, quantity: qty, slot: nextSlot });
    }
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'player_item', `发放 ${item.name} x${qty} 给角色`, playerItem._id.toString());
    res.status(201).json({ message: '发放成功', id: playerItem._id.toString() });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message || '数据校验失败' });
    console.error('Admin player-item create error:', err.message);
    res.status(500).json({ error: '发放物品失败' });
  }
});

router.put('/player-items/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { quantity } = req.body;
    const playerItem = await PlayerItem.findById(req.params.id);
    if (!playerItem) return res.status(404).json({ error: '记录不存在' });
    const qty = Math.max(1, Math.min(99999, Number(quantity) || 1));
    playerItem.quantity = qty;
    await playerItem.save();
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'player_item', `更新玩家物品数量为 ${qty}`, playerItem._id.toString());
    res.json({ message: '更新成功' });
  } catch (err) {
    console.error('Admin player-item update error:', err.message);
    res.status(500).json({ error: '更新失败' });
  }
});

router.delete('/player-items/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const playerItem = await PlayerItem.findByIdAndDelete(req.params.id);
    if (!playerItem) return res.status(404).json({ error: '记录不存在' });
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'player_item', `删除玩家物品记录`, playerItem._id.toString());
    res.json({ message: '删除成功' });
  } catch (err) {
    console.error('Admin player-item delete error:', err.message);
    res.status(500).json({ error: '删除失败' });
  }
});

// ========== 玩家妖灵管理 ==========

router.get('/player-spirits', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { userId, characterId, spiritNumber } = req.query;
    const filter = {};
    if (userId) filter.user = userId;
    if (characterId) filter.character = characterId;
    if (spiritNumber) {
      const num = Number(spiritNumber) || 0;
      const spirits = await Spirit.find({ number: num }).select('_id').lean();
      if (spirits.length === 0) return res.json({ playerSpirits: [] });
      filter.spirit = spirits[0]._id;
    }
    const docs = await PlayerSpirit.find(filter)
      .populate('user', 'username')
      .populate('character', 'name slot')
      .populate('spirit', 'number name types')
      .sort({ capturedAt: -1 })
      .limit(200)
      .lean();
    const list = docs.map((p) => ({
      id: p._id.toString(),
      userId: p.user?._id?.toString() || '',
      username: p.user?.username || '',
      characterId: p.character?._id?.toString() || '',
      characterName: p.character?.name || '',
      characterSlot: p.character?.slot ?? null,
      spiritId: p.spirit?._id?.toString() || '',
      spiritNumber: p.spirit?.number || 0,
      spiritName: p.spirit?.name || '',
      level: p.level,
      nature: p.nature || '',
      nickname: p.nickname || '',
      currentHp: p.currentHp,
      isShiny: !!p.isShiny,
      capturedAt: p.capturedAt,
    }));
    res.json({ playerSpirits: list });
  } catch (err) {
    console.error('Admin player-spirits list error:', err.message);
    res.status(500).json({ error: '获取玩家妖灵列表失败' });
  }
});

router.post('/player-spirits', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { characterId, username, spiritNumber, level, nickname, origin } = req.body || {};
    if (!spiritNumber) return res.status(400).json({ error: '妖灵编号为必填' });

    let character;
    if (characterId) {
      character = await Character.findById(characterId).populate('user', 'username').lean();
      if (!character) return res.status(404).json({ error: '角色不存在' });
    } else if (username) {
      const uname = String(username).trim();
      if (!uname) return res.status(400).json({ error: '请填写账号名或角色ID' });
      const user = await User.findOne({ username: uname }).select('_id').lean();
      if (!user) return res.status(404).json({ error: '账号不存在' });
      character = await Character.findOne({ user: user._id }).sort({ slot: 1 }).populate('user', 'username').lean();
      if (!character) return res.status(404).json({ error: '该账号下暂无角色' });
    } else {
      return res.status(400).json({ error: '请填写账号名（如 ow）或角色ID' });
    }

    const num = Number(spiritNumber) || 0;
    if (num < 1) return res.status(400).json({ error: '妖灵编号须为正整数' });
    let spirit = await Spirit.findOne({ number: num }).lean();
    if (!spirit) {
      const newSpirit = await Spirit.create({
        number: num,
        name: `妖灵#${num}`,
        types: [],
        stats: normalizeStats({}),
        description: '',
        image: '',
      });
      await logAdminAction(
        req.user.id,
        (await User.findById(req.user.id).select('username'))?.username,
        'spirit',
        `发放时自动创建图鉴妖灵 #${num} 妖灵#${num}`,
        newSpirit._id.toString(),
      );
      spirit = { _id: newSpirit._id, number: newSpirit.number, name: newSpirit.name };
    }

    const lvl = Math.max(1, Math.min(100, Number(level) || 1));
    const randIv = () => Math.floor(Math.random() * 32); // 0~31

    const doc = await PlayerSpirit.create({
      user: character.user,
      character: character._id,
      spirit: spirit._id,
      nickname: String(nickname || '').trim() || '',
      level: lvl,
      exp: 0,
      nature: 'Hardy',
      ivHp: randIv(),
      ivAtk: randIv(),
      ivDef: randIv(),
      ivSpAtk: randIv(),
      ivSpDef: randIv(),
      ivSpeed: randIv(),
      currentHp: 1,
      status: 'none',
      friendship: 0,
      isShiny: false,
      origin: String(origin || '').trim() || 'admin_grant',
    });

    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(
      req.user.id,
      op?.username,
      'player_spirit',
      `发放妖灵 #${spirit.number} ${spirit.name || ''} Lv.${lvl} 给角色 ${character.name} (user=${character.user})`,
      doc._id.toString(),
    );

    res.json({ ok: true, id: doc._id.toString() });
  } catch (err) {
    console.error('Admin player-spirits create error:', err.message);
    res.status(500).json({ error: '发放妖灵失败' });
  }
});

router.get('/player-spirits/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const doc = await PlayerSpirit.findById(req.params.id)
      .populate('user', 'username')
      .populate('character', 'name slot')
      .populate('spirit')
      .populate('heldItem', 'number name')
      .populate('moves.skill', 'number name pp')
      .lean();
    if (!doc) return res.status(404).json({ error: '玩家妖灵不存在' });
    const spirit = doc.spirit || {};
    const list = (doc.moves || []).map((m) => ({
      skillId: m.skill?._id?.toString(),
      skillNumber: m.skill?.number,
      skillName: m.skill?.name,
      pp: m.pp,
      maxPp: m.maxPp,
    }));
    res.json({
      id: doc._id.toString(),
      userId: doc.user?._id?.toString(),
      username: doc.user?.username,
      characterId: doc.character?._id?.toString(),
      characterName: doc.character?.name,
      characterSlot: doc.character?.slot,
      spiritId: spirit._id?.toString(),
      spiritNumber: spirit.number,
      spiritName: spirit.name,
      spiritTypes: spirit.types || [],
      spiritStats: spirit.stats || {},
      spiritDescription: spirit.description || '',
      spiritImage: spirit.image || '',
      nickname: doc.nickname || '',
      level: doc.level ?? 1,
      exp: doc.exp ?? 0,
      nature: doc.nature || 'Hardy',
      ivHp: doc.ivHp ?? 0,
      ivAtk: doc.ivAtk ?? 0,
      ivDef: doc.ivDef ?? 0,
      ivSpAtk: doc.ivSpAtk ?? 0,
      ivSpDef: doc.ivSpDef ?? 0,
      ivSpeed: doc.ivSpeed ?? 0,
      evHp: doc.evHp ?? 0,
      evAtk: doc.evAtk ?? 0,
      evDef: doc.evDef ?? 0,
      evSpAtk: doc.evSpAtk ?? 0,
      evSpDef: doc.evSpDef ?? 0,
      evSpeed: doc.evSpeed ?? 0,
      currentHp: doc.currentHp ?? 1,
      status: doc.status || 'none',
      heldItemId: doc.heldItem?._id?.toString(),
      heldItemName: doc.heldItem?.name,
      moves: list,
      friendship: doc.friendship ?? 0,
      isShiny: !!doc.isShiny,
      origin: doc.origin || '',
      capturedAt: doc.capturedAt,
    });
  } catch (err) {
    console.error('Admin player-spirit get error:', err.message);
    res.status(500).json({ error: '获取玩家妖灵详情失败' });
  }
});

router.put('/player-spirits/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const doc = await PlayerSpirit.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: '玩家妖灵不存在' });
    const body = req.body || {};
    const clamp = (v, min, max) => Math.min(max, Math.max(min, Number(v) || 0));
    if (body.nickname !== undefined) doc.nickname = String(body.nickname || '').trim().slice(0, 32);
    if (body.level !== undefined) doc.level = clamp(body.level, 1, 100);
    if (body.exp !== undefined) doc.exp = Math.max(0, Number(body.exp) || 0);
    if (body.nature !== undefined) doc.nature = String(body.nature || 'Hardy').trim().slice(0, 16);
    if (body.currentHp !== undefined) doc.currentHp = Math.max(0, Number(body.currentHp) || 0);
    if (body.status !== undefined) doc.status = String(body.status || 'none').trim().slice(0, 16);
    if (body.friendship !== undefined) doc.friendship = clamp(body.friendship, 0, 255);
    if (body.isShiny !== undefined) doc.isShiny = !!body.isShiny;
    if (body.origin !== undefined) doc.origin = String(body.origin || '').trim().slice(0, 64);
    const ivKeys = ['ivHp', 'ivAtk', 'ivDef', 'ivSpAtk', 'ivSpDef', 'ivSpeed'];
    ivKeys.forEach((k) => {
      if (body[k] !== undefined) doc[k] = clamp(body[k], 0, 31);
    });
    const evKeys = ['evHp', 'evAtk', 'evDef', 'evSpAtk', 'evSpDef', 'evSpeed'];
    evKeys.forEach((k) => {
      if (body[k] !== undefined) doc[k] = clamp(body[k], 0, 252);
    });
    const evSum = evKeys.reduce((s, k) => s + (doc[k] || 0), 0);
    if (evSum > 510) return res.status(400).json({ error: '努力值总和不能超过510' });
    if (body.heldItemId !== undefined) {
      doc.heldItem = body.heldItemId === '' || body.heldItemId == null ? null : body.heldItemId;
    }
    if (Array.isArray(body.moves)) {
      doc.moves = body.moves.slice(0, 4).map((m) => ({
        skill: m.skillId || m.skill || null,
        pp: clamp(m.pp, 0, 99),
        maxPp: clamp(m.maxPp, 0, 99),
      })).filter((m) => m.skill);
    }
    await doc.save();
    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(
      req.user.id,
      op?.username,
      'player_spirit',
      `编辑玩家妖灵 ${doc._id}`,
      doc._id.toString(),
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message || '数据校验失败' });
    console.error('Admin player-spirit update error:', err.message);
    res.status(500).json({ error: '更新玩家妖灵失败' });
  }
});

const ITEM_CATEGORIES = ['道具', '精灵球', '贵重物品', '药品', '商城', '时装'];

function normalizeItemCategory(cat) {
  const s = String(cat || '').trim();
  return ITEM_CATEGORIES.includes(s) ? s : '道具';
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeStats(stats) {
  const def = { hp: 50, attack: 50, defense: 50, sp_attack: 50, sp_defense: 50, speed: 50 };
  if (!stats || typeof stats !== 'object') return def;
  const keys = ['hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'];
  const out = { ...def };
  keys.forEach((k) => {
    if (stats[k] != null) {
      const v = Number(stats[k]);
      out[k] = Math.min(255, Math.max(1, isNaN(v) ? def[k] : v));
    }
  });
  return out;
}

module.exports = router;
