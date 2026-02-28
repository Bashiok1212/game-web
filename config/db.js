const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/game';

mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).catch((err) => {
  console.error('MongoDB 连接失败:', err.message);
  console.error('请启动 MongoDB: systemctl start mongod 或 docker start mongo');
});

mongoose.connection.on('connected', async () => {
  console.log('MongoDB 已连接');
  // 移除 festivals 集合的遗留 key_1 唯一索引（旧 schema 残留，会导致 E11000 duplicate key: { key: null }）
  mongoose.connection.collection('festivals').dropIndex('key_1').catch((err) => {
    if (err.code !== 27) console.error('drop key_1 index:', err.message);
  });
  // 移除 playeritems 的 character+item 唯一索引（堆叠上限 99 后允许多格同物品）
  try {
    const coll = mongoose.connection.collection('playeritems');
    const indexes = await coll.indexes();
    const uniqueIdx = indexes.find((i) => i.unique && i.key?.character && i.key?.item);
    if (uniqueIdx) {
      await coll.dropIndex(uniqueIdx.name);
      console.log('已删除 playeritems 唯一索引:', uniqueIdx.name);
    }
  } catch (e) {
    if (e.code !== 27 && e.codeName !== 'IndexNotFound') console.error('drop playeritems unique index:', e.message);
  }
});

module.exports = mongoose;
