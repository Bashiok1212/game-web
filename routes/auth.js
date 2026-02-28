const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Character = require('../models/Character');
const PlayerItem = require('../models/PlayerItem');
const AdminLog = require('../models/AdminLog');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const { validateUsername, validateEmail, validatePassword } = require('../utils/validation');

const router = express.Router();

function toUserResponse(doc, includeRole = false) {
  if (!doc) return null;
  const u = doc.toObject ? doc.toObject() : doc;
  const res = {
    id: u._id?.toString() || u.id,
    username: u.username,
    email: u.email,
    created_at: u.created_at,
  };
  if (includeRole && u.role) res.role = u.role;
  return res;
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const u = validateUsername(username);
    if (!u.ok) return res.status(400).json({ error: u.error });
    const e = validateEmail(email);
    if (!e.ok) return res.status(400).json({ error: e.error });
    const p = validatePassword(password);
    if (!p.ok) return res.status(400).json({ error: p.error });

    const passwordHash = bcrypt.hashSync(p.value, 12);
    const user = new User({
      username: u.value,
      email: e.value,
      password_hash: passwordHash,
    });
    await user.save();
    await Character.insertMany([
      { user: user._id, slot: 1, name: '角色1' },
      { user: user._id, slot: 2, name: '角色2' },
      { user: user._id, slot: 3, name: '角色3' },
    ]);
    res.status(201).json({ message: '注册成功' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: '用户名或邮箱已被使用' });
    }
    if (err.name === 'MongoServerError' || err.message?.includes('connect')) {
      return res.status(503).json({ error: '数据库连接失败，请稍后重试' });
    }
    console.error('Register error:', err.message);
    res.status(500).json({ error: '注册失败' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const loginBy = String(username || email || '').trim().slice(0, 254);
    const p = validatePassword(password);
    if (!loginBy || !p.ok) {
      return res.status(400).json({ error: '请填写用户名/邮箱和密码' });
    }

    const user = await User.findOne({
      $or: [{ username: loginBy }, { email: loginBy.toLowerCase() }],
    }).select('+password_hash');

    if (!user || !bcrypt.compareSync(p.value, user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    user.last_login = new Date();
    await user.save({ validateBeforeSave: false });

    const charCount = await Character.countDocuments({ user: user._id });
    if (charCount === 0) {
      await Character.insertMany([
        { user: user._id, slot: 1, name: '角色1' },
        { user: user._id, slot: 2, name: '角色2' },
        { user: user._id, slot: 3, name: '角色3' },
      ]);
    }

    const token = jwt.sign(
      { id: user._id.toString(), username: user.username, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: process.env.NODE_ENV === 'production' ? '24h' : '7d' }
    );
    if (['admin', 'ow'].includes(user.role || '')) {
      try {
        await AdminLog.create({
          operator: user._id,
          operatorName: user.username,
          action: 'login',
          detail: '管理员登录',
        });
      } catch (e) {
        console.error('AdminLog login error:', e?.message);
      }
    }
    res.json({
      token,
      user: toUserResponse(user, true),
    });
  } catch (err) {
    if (err.name === 'MongoServerError' || err.message?.includes('connect')) {
      return res.status(503).json({ error: '数据库连接失败，请稍后重试' });
    }
    console.error('Login error:', err.message);
    res.status(500).json({ error: '登录失败' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未提供认证令牌' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    res.json({ user: toUserResponse(user) });
  } catch (err) {
    res.status(401).json({ error: '令牌无效或已过期' });
  }
});

router.get('/user', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ user: toUserResponse(user, true) });
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 获取当前用户角色列表（游戏端用，固定 3 槽位）
router.get('/user/characters', authMiddleware, async (req, res) => {
  try {
    const chars = await Character.find({ user: req.user.id }).sort({ slot: 1 }).lean();
    const map = {};
    for (const c of chars) map[c.slot] = c;
    const list = [];
    for (let slot = 1; slot <= 3; slot++) {
      const c = map[slot];
      list.push({
        id: c?._id?.toString() ?? null,
        slot,
        name: c?.name ?? '',
        gold: c?.gold ?? 0,
        rp: c?.rp ?? 0,
        x: c?.x ?? 0,
        y: c?.y ?? 0,
        backpackCapacity: c?.backpackCapacity ?? 9999,
      });
    }
    res.json({ characters: list });
  } catch (err) {
    console.error('Get user characters error:', err.message);
    res.status(500).json({ error: '获取角色失败' });
  }
});

// 更新单个角色（游戏端上传坐标、金币等）：index 为 0、1、2
router.put('/user/characters/:index', authMiddleware, async (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    if (idx < 0 || idx > 2) return res.status(400).json({ error: '角色索引必须为 0、1 或 2' });
    const slot = idx + 1;

    let char = await Character.findOne({ user: req.user.id, slot });
    if (!char) {
      char = await Character.create({ user: req.user.id, slot, name: '角色' + slot, gold: 0, rp: 0, x: 0, y: 0 });
    }

    const { name, gold, rp, x, y } = req.body;
    if (name !== undefined) char.name = String(name).trim().slice(0, 20);
    if (typeof gold === 'number') char.gold = Math.max(0, Math.floor(gold));
    if (typeof rp === 'number') char.rp = Math.max(0, Math.floor(rp));
    if (typeof x === 'number') char.x = x;
    if (typeof y === 'number') char.y = y;
    await char.save();

    res.json({
      character: {
        id: char._id.toString(),
        slot: char.slot,
        name: char.name,
        gold: char.gold,
        rp: char.rp,
        x: char.x,
        y: char.y,
      },
    });
  } catch (err) {
    console.error('Put user character error:', err.message);
    res.status(500).json({ error: '更新角色失败' });
  }
});

// 获取当前用户某角色的背包物品（characterId 必须属于当前用户）
router.get('/user/player-items', authMiddleware, async (req, res) => {
  try {
    const { characterId } = req.query;
    if (!characterId) return res.status(400).json({ error: '请提供 characterId' });
    const character = await Character.findOne({ _id: characterId, user: req.user.id });
    if (!character) return res.status(404).json({ error: '角色不存在或无权访问' });
    const items = await PlayerItem.find({ character: characterId })
      .populate('item', 'number name category image description effect')
      .sort({ slot: 1, updated_at: -1 })
      .lean();
    const list = items.map((pi) => ({
      id: pi._id.toString(),
      itemId: pi.item?._id?.toString(),
      itemNumber: pi.item?.number,
      itemName: pi.item?.name || '',
      itemCategory: pi.item?.category || '',
      itemImage: pi.item?.image || '',
      quantity: pi.quantity,
      slot: pi.slot ?? 0,
    }));
    const capacity = character.backpackCapacity ?? 9999;
    res.json({ playerItems: list, backpackCapacity: capacity, usedSlots: list.length });
  } catch (err) {
    console.error('Get user player-items error:', err.message);
    res.status(500).json({ error: '获取背包失败' });
  }
});

// 丢弃背包物品（用户只能丢弃自己角色的物品）
// 支持 quantity 参数：DELETE ?quantity=N 或 POST body { quantity: N }，不传则丢弃全部
router.delete('/user/player-items/:id', authMiddleware, async (req, res) => {
  try {
    const quantity = parseInt(req.query?.quantity ?? req.body?.quantity ?? 0, 10);
    const playerItemId = req.params.id;
    const playerItem = await PlayerItem.findById(playerItemId);
    if (!playerItem) return res.status(404).json({ error: '物品不存在' });
    const character = await Character.findById(playerItem.character);
    if (!character || character.user.toString() !== req.user.id) {
      return res.status(403).json({ error: '无权丢弃该物品' });
    }
    const total = Math.max(1, playerItem.quantity ?? 1);
    const toDiscard = quantity > 0 ? Math.min(quantity, total) : total;
    if (toDiscard >= total) {
      await PlayerItem.findByIdAndDelete(playerItemId);
    } else {
      playerItem.quantity = total - toDiscard;
      await playerItem.save();
    }
    res.json({ message: '已丢弃', discarded: toDiscard });
  } catch (err) {
    console.error('Discard player-item error:', err.message);
    res.status(500).json({ error: '丢弃失败' });
  }
});

// 批量更新角色（游戏端创建/重命名）：body { characters: [{ name, gold, x, y }, ...] }
router.put('/user/characters', authMiddleware, async (req, res) => {
  try {
    const chars = req.body.characters;
    if (!Array.isArray(chars) || chars.length === 0) {
      return res.status(400).json({ error: 'characters 数组不能为空' });
    }
    const list = chars.slice(0, 3);
    while (list.length < 3) list.push({ name: '', gold: 0, rp: 0, x: 0, y: 0 });

    const existing = await Character.find({ user: req.user.id }).sort({ slot: 1 });
    const bySlot = {};
    for (const c of existing) bySlot[c.slot] = c;

    const result = [];
    for (let i = 0; i < 3; i++) {
      const slot = i + 1;
      const d = list[i] || {};
      const name = String(d.name ?? '').trim().slice(0, 20);
      const gold = Math.max(0, Math.floor(d.gold ?? 0));
      const rp = Math.max(0, Math.floor(d.rp ?? 0));
      const x = d.x ?? 0;
      const y = d.y ?? 0;

      let char = bySlot[slot];
      if (!char) {
        char = await Character.create({ user: req.user.id, slot, name, gold, rp, x, y });
      } else {
        char.name = name;
        char.gold = gold;
        char.rp = rp;
        char.x = x;
        char.y = y;
        await char.save();
      }
      result.push({ id: char._id.toString(), slot: char.slot, name: char.name, gold: char.gold, rp: char.rp, x: char.x, y: char.y });
    }
    res.json({ characters: result });
  } catch (err) {
    console.error('Put user characters error:', err.message);
    res.status(500).json({ error: '更新角色失败' });
  }
});

router.put('/user/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const p = validatePassword(currentPassword);
    if (!p.ok) return res.status(400).json({ error: '当前密码错误' });
    const pNew = validatePassword(newPassword);
    if (!pNew.ok) return res.status(400).json({ error: pNew.error });

    const user = await User.findById(req.user.id).select('+password_hash');
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!bcrypt.compareSync(p.value, user.password_hash)) {
      return res.status(400).json({ error: '当前密码错误' });
    }

    user.password_hash = bcrypt.hashSync(pNew.value, 12);
    await user.save({ validateBeforeSave: false });
    res.json({ message: '密码修改成功' });
  } catch (err) {
    console.error('Change password error:', err.message);
    res.status(500).json({ error: '修改失败' });
  }
});

module.exports = router;
