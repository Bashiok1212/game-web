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

**错误**：400 用户名或邮箱已被使用；429 请求过于频繁；503 数据库连接失败

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

**错误**：400 请填写用户名/邮箱和密码；401 用户名或密码错误；429 尝试次数过多

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

### 1.5 PTCG 个人卡牌页（独立管理员）

用于 `/ptcg.html`，与游戏账号无关。管理员账号存 **MongoDB**（集合 `PtcgAdmin`）。卡牌存 **MongoDB**（集合 `PtcgCard`，字段 `admin` 关联 `PtcgAdmin`）。  
`.env` 中 `PTCG_ADMIN_USER` / `PTCG_ADMIN_PASSWORD` 由启动时脚本同步到库，**登录仅校验库中账号**。

**POST /api/ptcg/register**

请求体：`{ "username": "string", "password": "string", "registerSecret": "可选" }`

- 用户名：`3～32` 位；密码：至少 `6` 位。
- 若设置 `PTCG_REGISTER_SECRET`，则 `registerSecret` 须与之一致。
- 若未设置 `PTCG_REGISTER_SECRET`，则**仅当库中尚无 PTCG 管理员**时允许注册（首个账号）。

**成功 (200)**：`{ "ok": true, "message": "注册成功，请登录" }`  
**失败**：400 / 403 / 500

**POST /api/ptcg/login**

请求体：`{ "username": "string", "password": "string" }`

- 仅校验 MongoDB 中 `PtcgAdmin`（`.env` 账号需已同步到库）。

**成功 (200)**：`{ "ok": true, "token": "<JWT>" }`（约 7 天有效；载荷含 `adminId`，用于卡牌接口）

**失败**：400 / 401 / 503（库中无任何管理员时，提示注册或配置 `.env` 并重启）

**GET /api/ptcg/verify**

请求头：`Authorization: Bearer <token>`

**成功 (200)**：`{ "ok": true, "adminId": "<id>" }`  
**失败**：401 / 403（旧 token 无 `adminId` 时需重新登录）

#### 卡牌（均需 `Authorization: Bearer <token>`，且 token 须含 `adminId`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ptcg/cards` | 当前管理员的卡牌列表 |
| POST | `/api/ptcg/cards` | 新增单条（见下方字段说明） |
| PUT | `/api/ptcg/cards/:id` | 更新（同字段；**不可改** `cardNo`） |
| DELETE | `/api/ptcg/cards/:id` | 删除 |
| POST | `/api/ptcg/cards/import` | 批量导入（body：`{ "items": [ ... ] }` 或直接数组，与导出 JSON 兼容） |

**卡牌字段**（`name` 必填；`cardNo` 为保存后自动生成序号，仅列表展示）：

| 字段 | 说明 |
|------|------|
| `cardNo` | 编号（整数，按管理员自增，只读） |
| `name` | 名称 |
| `year` | 年份（0～9999，可选） |
| `language` | 语言 |
| `version` | 版本（旧版 `set` 可与 `version` 互填，导入时无 `version` 时可用 `set`） |
| `rarity` | 稀有度 |
| `purchasePrice` | 购入价（数字，元） |
| `graded` | 是否评级卡（布尔） |
| `gradingCompany` | 评级公司（`graded=true` 时必填） |
| `gradingNumber` | 评级编号（`graded=true` 时必填） |
| `condition` | 品相 |
| `notes` | 备注 |
| `cardStatus` | 卡状态（如：在库 / 已售） |
| `image` | 图片（外链 URL 或 `data:image/...` Base64，勿过大） |
| `set` / `quantity` | 兼容旧数据 |

#### 现有字段下拉配置（均需 Bearer + `adminId`）

独立页：`/ptcg-fields.html`。为固定五个键配置选项（每行一项）：`language`、`version`、`rarity`、`condition`、`cardStatus`。某键**未保存过**时，合并接口对该键返回空数组（卡状态除外，见下）；**保存为空数组**表示该字段在录入页用手输框而非下拉。

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ptcg/field-dropdowns` | 合并默认值后的下拉（卡牌录入页用）。`cardStatus` 未在库中配置键时使用服务端默认列表；库中 `cardStatus: []` 时该字段为手输 |
| GET | `/api/ptcg/field-dropdowns?raw=1` | 仅已保存的键与数组（编辑页用） |
| PUT | `/api/ptcg/field-dropdowns` | body：`{ "dropdowns": { "language": ["简中","日文"], ... } }` |

**成功**：`GET /field-dropdowns` 返回 `{ "dropdowns": { ... }, "fieldKeys": [ ... ] }`；`GET /cards` 返回 `{ "cards": [ ... ] }`，单条含 `createdAt` / `updatedAt`。

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

**错误**：400 当前密码错误；429 尝试次数过多

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
- **服务端无限堆叠**：同物品单条记录可任意数量；游戏内单格显示上限 99（超出显示 99+）

**错误**：400 请提供 characterId；404 角色不存在或无权访问

---

### 2.7.5 获取队伍（游戏内 SpiritBar）

**GET /api/user/party**

| 参数 | 必填 | 说明 |
|------|------|------|
| characterId | ✓ | 角色 ID（须为当前用户拥有的角色） |

**成功 (200)**：
```json
{
  "party": [
    { "id": "玩家妖灵ID", "spiritNumber": 1, "spiritName": "皮卡丘", "spiritImage": "https://...", "spiritTypes": ["电"], "level": 5, "nickname": "" },
    null,
    ...
  ]
}
```
- `party`：长度为 6 的数组，对应队伍第 1～6 格；有妖灵时为对象（含 `spiritImage` 等），空位为 `null`。

**错误**：400 请提供 characterId；404 角色不存在或无权访问

---

### 2.7.6 获取单只玩家妖灵详情（游戏内详情面板）

**GET /api/user/player-spirit/:id**

- `:id`：玩家妖灵 ID（来自 GET /api/user/party 返回的 `party[].id`）
- 仅可查询当前用户拥有的角色之妖灵

**成功 (200)**：与管理端单只玩家妖灵详情结构一致，包含：图鉴信息（spiritNumber、spiritName、spiritTypes、spiritStats、spiritDescription、spiritImage）、昵称、等级/经验/性格、个体值 ivHp～ivSpeed、努力值 evHp～evSpeed、currentHp/status、持有物 heldItemId/heldItemName、技能 moves、friendship、isShiny、originalTrainer、capturedAt、capturedPlace、ballType、partySlot、boxIndex、slotInBox、origin、ribbons、protons 等。

**错误**：404 妖灵不存在；403 无权查看该妖灵

**若客户端收到「接口返回 HTML 而非 JSON」**：说明请求未命中本接口，常见原因：① 服务器未部署含该路由的最新代码（需拉取并重启 Node）；② 反向代理（如 Nginx）未将 `/api/*` 转发到 Node，而是返回了前端页面。请确保部署后访问 `GET /api/user/player-spirit/某ID`（带有效 Bearer）返回 JSON。

---

### 2.8 丢弃背包物品

**DELETE /api/user/player-items/:id** 或 **POST /api/user/player-items/:id/discard**

- `:id`：玩家物品 ID（来自 GET /api/user/player-items 返回的 `playerItems[].id`）
- `quantity`（可选）：丢弃数量，查询参数 `?quantity=N` 或 POST body `{ "quantity": N }`。不传或 0 表示丢弃全部
- 仅可丢弃当前用户拥有的角色之物品

**成功 (200)**：`{ "message": "已丢弃", "discarded": N }`

**错误**：404 物品不存在；403 无权丢弃该物品

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
- 服务端无限堆叠：若角色已有该物品则累加数量

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

### 3.9 玩家妖灵管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/player-spirits | 玩家妖灵列表 |
| GET | /api/admin/player-spirits/:id | 玩家妖灵详情（完整个体信息） |
| POST | /api/admin/player-spirits | 发放妖灵 |
| PUT | /api/admin/player-spirits/:id | 更新玩家妖灵（等级/性格/IV/EV/技能等） |

**GET /api/admin/player-spirits** 查询参数：`userId`、`characterId`、`spiritNumber` 可选筛选。

**GET /api/admin/player-spirits/:id** 响应：单只玩家妖灵完整信息，包含图鉴信息（spiritNumber、spiritName、spiritTypes、spiritStats、spiritDescription、spiritImage）、归属（userId、username、characterId、characterName、characterSlot）、个体值 ivHp～ivSpeed、努力值 evHp～evSpeed、等级/经验/性格、currentHp/status、heldItem（heldItemId/heldItemName）、球种 ballType、moves（技能列表含 skillId/skillName/pp/maxPp）、friendship、isShiny、origin、originalTrainer（初训家）、capturedAt（捕获时间）、capturedPlace（捕获地点）、位置 partySlot（0～5=队伍位，null=在仓库）、boxIndex（第几箱）、slotInBox（箱内格位）、缎带 ribbons（数组，元素 1～10）、质子 protons（数组，元素 1～10）。

**POST /api/admin/player-spirits** 请求体：`spiritNumber`（必填）；目标二选一：`username`（账号名，如 ow）或 `characterId`（角色 ID）；可选 `level`、`nickname`、`capturedPlace`（捕获地点）。若图鉴无该编号则自动创建图鉴妖灵再发放。

**PUT /api/admin/player-spirits/:id** 请求体（均为可选）：`nickname`、`level`、`exp`、`nature`、`currentHp`、`status`、`friendship`（0～255）、`isShiny`、`originalTrainer`（初训家，最多 32 字）、`capturedAt`（捕获时间，ISO 日期时间）、`capturedPlace`（捕获地点，最多 64 字）、`ballType`（球种，最多 32 字）、`partySlot`（队伍位：空或 null=在仓库，0～5=队伍第 1～6 格）、`boxIndex`（第几箱，0 起）、`slotInBox`（箱内格位，0 起）、`ribbons`（缎带数组，元素 1～10）、`protons`（质子数组，元素 1～10）、`ivHp`～`ivSpeed`（0～31）、`evHp`～`evSpeed`（0～252，总和≤510）、`heldItemId`（空字符串表示卸下）、`moves`（数组，最多 4 项，每项 `{ skillId, pp, maxPp }`）。

---

### 3.10 节日管理（仅 OW）

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
| /api/user/party | GET | 获取角色队伍（6 格，含妖灵图片） | Bearer |
| /api/user/player-items/:id | DELETE | 丢弃背包物品 | Bearer |
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
| /api/admin/player-spirits | GET | 玩家妖灵列表 | admin/ow |
| /api/admin/player-spirits/:id | GET | 玩家妖灵详情 | admin/ow |
| /api/admin/player-spirits | POST | 发放妖灵 | admin/ow |
| /api/admin/player-spirits/:id | PUT | 更新玩家妖灵 | admin/ow |
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
