const express = require('express');
const User = require('../models/User');
const Spirit = require('../models/Spirit');
const Skill = require('../models/Skill');
const Item = require('../models/Item');
const PlayerItem = require('../models/PlayerItem');
const STACK_LIMIT = PlayerItem.STACK_LIMIT;
const Character = require('../models/Character');
const Festival = require('../models/Festival');
const AdminLog = require('../models/AdminLog');
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

async function dropPlayerItemsUniqueIndex() {
  try {
    const mongoose = require('mongoose');
    const coll = mongoose.connection.collection('playeritems');
    const indexes = await coll.indexes();
    const idx = indexes.find((i) => (i.name === 'character_1_item_1' || (i.key?.character && i.key?.item)) && i.unique);
    if (idx) {
      await coll.dropIndex(idx.name);
      console.log('[Admin] 已删除 playeritems 唯一索引:', idx.name);
    }
  } catch (e) {
    if (e.code !== 27 && e.codeName !== 'IndexNotFound') console.error('[Admin] drop index:', e.message);
  }
}

router.post('/player-items', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { characterId, itemId, quantity } = req.body;
    if (!characterId || !itemId) return res.status(400).json({ error: '角色和物品为必填' });
    const character = await Character.findById(characterId);
    if (!character) return res.status(404).json({ error: '角色不存在' });
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: '物品不存在' });
    const totalToAdd = Math.max(1, Number(quantity) || 1);
    const cap = character.backpackCapacity ?? 9999;

    const existingSlots = await PlayerItem.find({ character: characterId, item: itemId }).sort({ slot: 1 });
    let remaining = totalToAdd;
    const createdIds = [];

    for (const pi of existingSlots) {
      if (remaining <= 0) break;
      const space = STACK_LIMIT - (pi.quantity ?? 0);
      if (space > 0) {
        const add = Math.min(remaining, space);
        pi.quantity += add;
        await pi.save();
        remaining -= add;
        createdIds.push(pi._id.toString());
      }
    }

    while (remaining > 0) {
      if (cap < 9999) {
        const count = await PlayerItem.countDocuments({ character: characterId });
        if (count >= cap) return res.status(400).json({ error: `背包已满（${cap} 格），无法添加新物品` });
      }
      const maxSlot = await PlayerItem.findOne({ character: characterId }).sort({ slot: -1 }).select('slot').lean();
      const nextSlot = (maxSlot?.slot ?? -1) + 1;
      const add = Math.min(remaining, STACK_LIMIT);
      try {
        const playerItem = await PlayerItem.create({ character: characterId, item: itemId, quantity: add, slot: nextSlot });
        remaining -= add;
        createdIds.push(playerItem._id.toString());
      } catch (createErr) {
        if (createErr.code === 11000) {
          await dropPlayerItemsUniqueIndex();
          const retry = await PlayerItem.create({ character: characterId, item: itemId, quantity: add, slot: nextSlot });
          remaining -= add;
          createdIds.push(retry._id.toString());
        } else throw createErr;
      }
    }

    const op = await User.findById(req.user.id).select('username');
    await logAdminAction(req.user.id, op?.username, 'player_item', `发放 ${item.name} x${totalToAdd} 给角色`, createdIds[0] || '');
    res.status(201).json({ message: '发放成功', id: createdIds[0] || '' });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message || '数据校验失败' });
    console.error('Admin player-item create error:', err.message, err.code || '');
    const msg = err.code === 11000 ? '重复键：请执行 node scripts/migrate-stack-limit.js 或重启服务' : (err.message || '发放物品失败');
    res.status(500).json({ error: msg });
  }
});

router.put('/player-items/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { quantity } = req.body;
    const playerItem = await PlayerItem.findById(req.params.id);
    if (!playerItem) return res.status(404).json({ error: '记录不存在' });
    const qty = Math.max(1, Math.min(STACK_LIMIT, Number(quantity) || 1));
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
