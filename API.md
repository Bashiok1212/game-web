# 妖灵151 API 文档

基础地址：`http://localhost:3000`（开发）或生产域名（通过 Nginx 代理）

**鉴权**：需登录的接口在请求头添加 `Authorization: Bearer <token>`

---

## 一、公开接口（无需鉴权）

### 1.1 注册

**POST /api/register**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | ✓ | 3-20 位，仅字母、数字、下划线、中文 |
| email | string | ✓ | 有效邮箱格式 |
| password | string | ✓ | 至少 6 位 |

**成功 (201)**：`{ "message": "注册成功" }`

**说明**：注册成功会自动创建 3 个角色（角色1、角色2、角色3）。

---

### 1.2 登录

**POST /api/login**

请求体（二选一）：
```json
{ "username": "用户名", "password": "密码" }
```
或
```json
{ "email": "邮箱", "password": "密码" }
```

**成功 (200)**：
```json
{
  "token": "JWT令牌",
  "user": {
    "id": "用户ID",
    "username": "用户名",
    "email": "邮箱",
    "created_at": "2026-02-25T12:00:00.000Z",
    "role": "user"
  }
}
```

**说明**：首次登录时若账号无角色，会自动创建 3 个角色。

---

### 1.3 服务器时间

**GET /api/time**

**成功 (200)**：
```json
{
  "timestamp": 1730123456,
  "utc": "2026-02-27T12:00:00.000Z",
  "utcFormatted": "2026/2/27 12:00:00",
  "pacificFormatted": "2026/2/27 04:00:00"
}
```

---

### 1.4 当前节日

**GET /api/festival**

根据当前服务器时间返回正在进行的节日及 Buff 加成。

**成功 (200)**：
```json
{
  "name": "春节活动",
  "buffs": {
    "shineRateBoost": 1.5,
    "goldBoost": 2,
    "expBoost": 1.5,
    "captureRateBoost": 1.2
  }
}
```
- 无节日时 `name` 为空字符串，`buffs` 各项为 1

---

## 二、用户接口（需 Bearer Token）

### 2.1 获取当前用户信息

**GET /api/user**

**成功 (200)**：
```json
{
  "user": {
    "id": "用户ID",
    "username": "用户名",
    "email": "邮箱",
    "created_at": "2026-02-25T12:00:00.000Z",
    "role": "user"
  }
}
```

---

### 2.2 验证 Token

**POST /api/verify**

**成功 (200)**：
```json
{ "user": { "id": "...", "username": "...", "email": "..." } }
```

---

### 2.3 修改密码

**PUT /api/user/password**

请求体：`{ "currentPassword": "当前密码", "newPassword": "新密码" }`

**成功 (200)**：`{ "message": "密码修改成功" }`

---

### 2.4 获取当前用户角色

**GET /api/user/characters**

**成功 (200)**：
```json
{
  "characters": [
    { "id": "xxx", "slot": 1, "name": "角色1", "gold": 100, "rp": 50, "x": 150, "y": 200, "backpackCapacity": 9999 },
    { "id": "yyy", "slot": 2, "name": "角色2", "gold": 0, "rp": 0, "x": 0, "y": 0, "backpackCapacity": 9999 },
    { "id": null, "slot": 3, "name": "", "gold": 0, "rp": 0, "x": 0, "y": 0, "backpackCapacity": 9999 }
  ]
}
```
- 固定返回 3 个槽位，按 slot 1、2、3 顺序
- `id`：角色 ID，用于获取背包等；空槽位为 `null`
- `backpackCapacity`：背包容量，9999 表示无限

---

### 2.5 更新单个角色

**PUT /api/user/characters/:index**

- `:index`：角色槽位 **0**、**1** 或 **2**
- 支持部分更新：只传需要修改的字段

请求体示例：
```json
{ "x": 150.5, "y": 200.3 }
```
或
```json
{ "x": 150, "y": 200, "gold": 100, "rp": 50, "name": "角色名" }
```

**成功 (200)**：
```json
{
  "character": { "id": "xxx", "slot": 1, "name": "角色名", "gold": 100, "rp": 50, "x": 150, "y": 200 }
}
```

---

### 2.6 批量更新角色

**PUT /api/user/characters**

请求体：
```json
{
  "characters": [
    { "name": "角色1", "gold": 100, "rp": 50, "x": 0, "y": 0 },
    { "name": "角色2", "gold": 0, "rp": 0, "x": 0, "y": 0 },
    { "name": "", "gold": 0, "rp": 0, "x": 0, "y": 0 }
  ]
}
```
- 固定 3 个元素，空槽位 `name` 为空

**成功 (200)**：返回更新后的 `characters` 数组

---

### 2.7 获取背包物品

**GET /api/user/player-items**

| 参数 | 必填 | 说明 |
|------|------|------|
| characterId | ✓ | 角色 ID（须为当前用户拥有的角色） |

**成功 (200)**：
```json
{
  "playerItems": [
    {
      "id": "xxx",
      "itemId": "yyy",
      "itemNumber": 1,
      "itemName": "精灵球",
      "itemCategory": "精灵球",
      "itemImage": "https://...",
      "quantity": 10,
      "slot": 0
    }
  ],
  "backpackCapacity": 9999,
  "usedSlots": 1
}
```
- `backpackCapacity`：9999 表示无限
- `slot`：背包格子位置，用于排序

---

### 2.8 丢弃背包物品

**DELETE /api/user/player-items/:id**

- `:id`：玩家物品 ID（来自 GET /api/user/player-items 返回的 `playerItems[].id`）
- 仅可丢弃当前用户拥有的角色之物品

**成功 (200)**：`{ "message": "已丢弃" }`

**失败**：404 物品不存在；403 无权丢弃

---

## 三、管理后台 API

所有管理接口需：`Authorization: Bearer <token>`，且当前用户角色为 `admin` 或 `ow`。部分接口仅 `ow` 可访问。

### 3.1 用户管理

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/admin/users | 用户列表 | admin/ow |
| PUT | /api/admin/users/:id/role | 设置用户角色 | ow（admin 仅可查看） |
| DELETE | /api/admin/users/:id | 删除用户 | ow |

**GET /api/admin/users** 响应：
```json
{
  "users": [
    {
      "id": "xxx",
      "username": "xxx",
      "email": "xxx@example.com",
      "role": "user",
      "created_at": "2026-02-25T12:00:00.000Z",
      "last_login": "2026-02-26T10:00:00.000Z"
    }
  ]
}
```

**PUT /api/admin/users/:id/role** 请求体：`{ "role": "admin" }`
- `role`：`user` | `admin` | `ow`

---

### 3.2 统计

**GET /api/admin/stats**

**响应**：`{ "total": 100, "newToday": 5 }`

---

### 3.3 操作日志

**GET /api/admin/logs**

| 参数 | 说明 |
|------|------|
| action | 筛选操作类型（login/user_role/spirit/skill/item/character/player_item/festival 等） |
| limit | 返回条数，默认 200，最大 500 |

**响应**：
```json
{
  "logs": [
    {
      "id": "xxx",
      "operatorId": "xxx",
      "operatorName": "admin",
      "action": "spirit",
      "detail": "添加妖灵 #1 小火龙",
      "targetId": "xxx",
      "created_at": "2026-02-25T12:00:00.000Z"
    }
  ]
}
```

---

### 3.4 妖灵管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/spirits | 妖灵列表 |
| GET | /api/admin/spirits/:id | 妖灵详情 |
| POST | /api/admin/spirits | 添加妖灵 |
| PUT | /api/admin/spirits/:id | 更新妖灵 |
| DELETE | /api/admin/spirits/:id | 删除妖灵 |

**GET /api/admin/spirits** 查询参数：

| 参数 | 说明 |
|------|------|
| search | 搜索编号或名称 |
| type | 属性筛选（火、水、草等） |
| sort | 排序字段（number/name） |
| order | asc/desc |

**妖灵数据结构**：
```json
{
  "id": "xxx",
  "number": 1,
  "name": "妖灵名",
  "types": ["火", "水"],
  "stats": { "hp": 50, "attack": 50, "defense": 50, "sp_attack": 50, "sp_defense": 50, "speed": 50 },
  "description": "描述",
  "image": "https://..."
}
```

---

### 3.5 技能管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/skills | 技能列表 |
| GET | /api/admin/skills/:id | 技能详情 |
| POST | /api/admin/skills | 添加技能 |
| PUT | /api/admin/skills/:id | 更新技能 |
| DELETE | /api/admin/skills/:id | 删除技能 |

**GET /api/admin/skills** 查询参数：

| 参数 | 说明 |
|------|------|
| search | 搜索编号或名称 |
| type | 属性筛选 |
| category | 物理/特殊/变化 |
| sort | 排序字段 |
| order | asc/desc |

**技能数据结构**：
```json
{
  "id": "xxx",
  "number": 1,
  "name": "技能名",
  "type": "火",
  "category": "物理",
  "power": 80,
  "accuracy": 100,
  "pp": 15,
  "description": "描述",
  "effect": "效果"
}
```

---

### 3.6 物品管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/items | 物品列表 |
| GET | /api/admin/items/:id | 物品详情 |
| POST | /api/admin/items | 添加物品 |
| PUT | /api/admin/items/:id | 更新物品 |
| DELETE | /api/admin/items/:id | 删除物品 |

**GET /api/admin/items** 查询参数：

| 参数 | 说明 |
|------|------|
| search | 搜索编号或名称 |
| category | 类型筛选 |
| sort | 排序字段 |
| order | asc/desc |

**物品类型（category）**：道具、精灵球、贵重物品、药品、商城、时装

**物品数据结构**：
```json
{
  "id": "xxx",
  "number": 1,
  "name": "物品名",
  "category": "道具",
  "description": "描述",
  "effect": "效果",
  "image": "https://..."
}
```

---

### 3.7 角色管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/characters | 角色列表 |
| POST | /api/admin/characters | 创建角色 |
| PUT | /api/admin/characters/:id | 更新角色 |
| DELETE | /api/admin/characters/:id | 删除角色 |

**GET /api/admin/characters** 查询参数：`userId` 按账号筛选

**POST /api/admin/characters** 请求体：
```json
{
  "userId": "xxx",
  "slot": 1,
  "name": "角色名",
  "backpackCapacity": 9999
}
```
- `slot`：1、2 或 3
- `backpackCapacity`：可选，默认 9999（无限）

**PUT /api/admin/characters/:id** 请求体：
```json
{ "name": "角色名", "gold": 1000, "rp": 100, "backpackCapacity": 9999 }
```
- 支持部分更新

**角色数据结构**：
```json
{
  "id": "xxx",
  "userId": "xxx",
  "username": "账号名",
  "slot": 1,
  "name": "角色名",
  "gold": 0,
  "rp": 0,
  "backpackCapacity": 9999,
  "created_at": "2026-02-25T12:00:00.000Z"
}
```

---

### 3.8 玩家背包管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/player-items | 玩家背包列表 |
| POST | /api/admin/player-items | 发放物品 |
| PUT | /api/admin/player-items/:id | 修改数量 |
| DELETE | /api/admin/player-items/:id | 移除物品 |

**GET /api/admin/player-items** 查询参数：

| 参数 | 说明 |
|------|------|
| userId | 按账号筛选（该账号下所有角色的背包） |
| characterId | 按角色筛选 |
| itemId | 按物品筛选 |

**POST /api/admin/player-items** 请求体：
```json
{
  "characterId": "xxx",
  "itemId": "xxx",
  "quantity": 10
}
```
- 若角色已有该物品，则累加数量

**PUT /api/admin/player-items/:id** 请求体：`{ "quantity": 10 }`

**玩家物品数据结构**：
```json
{
  "id": "xxx",
  "characterId": "xxx",
  "characterName": "角色名",
  "characterSlot": 1,
  "username": "账号名",
  "itemId": "xxx",
  "itemNumber": 1,
  "itemName": "物品名",
  "itemCategory": "道具",
  "itemImage": "https://...",
  "quantity": 10,
  "slot": 0,
  "updated_at": "2026-02-25T12:00:00.000Z"
}
```

---

### 3.9 节日管理（仅 OW）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | /api/admin/festivals | 节日列表 | ow |
| POST | /api/admin/festivals | 添加节日 | ow |
| PUT | /api/admin/festivals/:id | 更新节日 | ow |
| DELETE | /api/admin/festivals/:id | 删除节日 | ow |

**POST /api/admin/festivals** 请求体：
```json
{
  "name": "春节活动",
  "startDate": "2026-02-01T00:00:00.000Z",
  "endDate": "2026-02-15T23:59:59.000Z",
  "shineRateBoost": 1.5,
  "goldBoost": 2,
  "expBoost": 1.5,
  "captureRateBoost": 1.2
}
```
- Buff 倍率 1–10，1 表示无加成

**节日数据结构**：
```json
{
  "id": "xxx",
  "name": "春节活动",
  "startDate": "2026-02-01T00:00:00.000Z",
  "endDate": "2026-02-15T23:59:59.000Z",
  "shineRateBoost": 1.5,
  "goldBoost": 2,
  "expBoost": 1.5,
  "captureRateBoost": 1.2,
  "created_at": "2026-02-25T12:00:00.000Z",
  "updated_at": "2026-02-25T12:00:00.000Z"
}
```

---

## 四、接口汇总

| 接口 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| /api/register | POST | 注册 | 否 |
| /api/login | POST | 登录 | 否 |
| /api/time | GET | 服务器时间 | 否 |
| /api/festival | GET | 当前节日及 Buff | 否 |
| /api/verify | POST | 验证 Token | Bearer |
| /api/user | GET | 获取用户信息 | Bearer |
| /api/user/password | PUT | 修改密码 | Bearer |
| /api/user/characters | GET | 获取当前用户角色 | Bearer |
| /api/user/characters | PUT | 批量更新角色 | Bearer |
| /api/user/characters/:index | PUT | 更新单个角色 | Bearer |
| /api/user/player-items | GET | 获取背包物品 | Bearer |
| /api/admin/users | GET | 用户列表 | admin/ow |
| /api/admin/users/:id/role | PUT | 修改用户角色 | ow |
| /api/admin/users/:id | DELETE | 删除用户 | ow |
| /api/admin/stats | GET | 统计信息 | admin/ow |
| /api/admin/logs | GET | 操作日志 | admin/ow |
| /api/admin/spirits | GET | 妖灵列表 | admin/ow |
| /api/admin/spirits/:id | GET | 妖灵详情 | admin/ow |
| /api/admin/spirits | POST | 添加妖灵 | admin/ow |
| /api/admin/spirits/:id | PUT | 更新妖灵 | admin/ow |
| /api/admin/spirits/:id | DELETE | 删除妖灵 | admin/ow |
| /api/admin/skills | GET | 技能列表 | admin/ow |
| /api/admin/skills/:id | GET | 技能详情 | admin/ow |
| /api/admin/skills | POST | 添加技能 | admin/ow |
| /api/admin/skills/:id | PUT | 更新技能 | admin/ow |
| /api/admin/skills/:id | DELETE | 删除技能 | admin/ow |
| /api/admin/items | GET | 物品列表 | admin/ow |
| /api/admin/items/:id | GET | 物品详情 | admin/ow |
| /api/admin/items | POST | 添加物品 | admin/ow |
| /api/admin/items/:id | PUT | 更新物品 | admin/ow |
| /api/admin/items/:id | DELETE | 删除物品 | admin/ow |
| /api/admin/characters | GET | 角色列表 | admin/ow |
| /api/admin/characters | POST | 创建角色 | admin/ow |
| /api/admin/characters/:id | PUT | 更新角色 | admin/ow |
| /api/admin/characters/:id | DELETE | 删除角色 | admin/ow |
| /api/admin/player-items | GET | 玩家背包列表 | admin/ow |
| /api/admin/player-items | POST | 发放物品 | admin/ow |
| /api/admin/player-items/:id | PUT | 修改数量 | admin/ow |
| /api/admin/player-items/:id | DELETE | 移除物品 | admin/ow |
| /api/admin/festivals | GET | 节日列表 | ow |
| /api/admin/festivals | POST | 添加节日 | ow |
| /api/admin/festivals/:id | PUT | 更新节日 | ow |
| /api/admin/festivals/:id | DELETE | 删除节日 | ow |

---

## 五、数据模型

### 5.1 用户（User）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| username | string | 用户名，唯一 |
| email | string | 邮箱，唯一 |
| created_at | Date | 注册时间 |
| last_login | Date | 最后登录 |
| role | string | user / admin / ow |

### 5.2 角色（Character）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 主键 |
| user | ObjectId | 所属账号 |
| slot | number | 角色位 1/2/3 |
| name | string | 角色名 |
| gold | number | 金币，默认 0 |
| rp | number | RP 点，默认 0 |
| x, y | number | 坐标，默认 0 |
| backpackCapacity | number | 背包容量，默认 9999（无限），范围 10–99999 |
| created_at | Date | 创建时间 |

### 5.3 妖灵（Spirit）

| 字段 | 类型 | 说明 |
|------|------|------|
| number | number | 图鉴编号 |
| name | string | 名称 |
| types | string[] | 属性（最多 2 个） |
| stats | object | 种族值 hp/attack/defense/sp_attack/sp_defense/speed |
| description | string | 描述 |
| image | string | 图片 URL |

### 5.4 技能（Skill）

| 字段 | 类型 | 说明 |
|------|------|------|
| number | number | 编号 |
| name | string | 名称 |
| type | string | 属性 |
| category | string | 物理/特殊/变化 |
| power | number | 威力 0–300 |
| accuracy | number | 命中 0–100 |
| pp | number | PP 1–40 |
| description | string | 描述 |
| effect | string | 效果 |

### 5.5 物品（Item）

| 字段 | 类型 | 说明 |
|------|------|------|
| number | number | 编号 |
| name | string | 名称 |
| category | string | 道具/精灵球/贵重物品/药品/商城/时装 |
| description | string | 描述 |
| effect | string | 效果 |
| image | string | 图片 URL |

### 5.6 玩家物品（PlayerItem）

| 字段 | 类型 | 说明 |
|------|------|------|
| character | ObjectId | 所属角色 |
| item | ObjectId | 物品 |
| quantity | number | 数量 |
| slot | number | 背包格子位置（0 起，用于排序） |

### 5.7 节日（Festival）

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 节日名称 |
| startDate | Date | 开始时间 |
| endDate | Date | 结束时间 |
| shineRateBoost | number | 闪率加成 1–10 |
| goldBoost | number | 金币加成 1–10 |
| expBoost | number | 经验加成 1–10 |
| captureRateBoost | number | 捕捉率加成 1–10 |

---

## 六、错误响应

统一格式：`{ "error": "错误描述信息" }`

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | 未认证或 token 无效 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 七、限流

- **登录/注册/修改密码**：15 分钟内最多 15 次
- **其他接口**：15 分钟内最多 100 次（生产）/ 200 次（开发）

超限返回 429：`{ "error": "请求过于频繁，请稍后再试" }` 或 `{ "error": "尝试次数过多，请 15 分钟后再试" }`
