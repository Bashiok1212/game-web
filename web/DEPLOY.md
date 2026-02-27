# Git 部署流程说明

Node.js + Express + MongoDB 游戏网站，本地开发 → Git 推送 → 云服务器拉取部署。

---

## 一、首次本地克隆与运行

### 1. 克隆远程仓库

```bash
# Windows (PowerShell / CMD)
git clone https://github.com/Bashiok1212/game-web.git D:\dev\game-web
cd D:\dev\game-web

# 或 macOS / Linux
git clone https://github.com/Bashiok1212/game-web.git ~/dev/game-web
cd ~/dev/game-web
```

### 2. 用 Cursor 打开项目

```bash
cursor D:\dev\game-web
# 或
code D:\dev\game-web
```

### 3. 安装依赖并启动

**环境要求**：Node.js 18+、MongoDB（本地或 Docker）

```bash
npm install
```

**配置环境变量**（可选，复制 `.env.example` 为 `.env` 并修改）：

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/game
NODE_ENV=development
```

**启动开发服务器**：

```bash
npm run dev
```

访问：`http://localhost:3000`，管理后台：`http://localhost:3000/admin`

**MongoDB 本地运行**：

- 已安装 MongoDB：直接启动服务
- 使用 Docker：`docker run -d -p 27017:27017 --name mongo mongo:7`
- 或使用 [MongoDB Atlas](https://www.mongodb.com/atlas) 免费云数据库

---

## 二、日常开发与部署流程

```
本地开发 → git add / commit / push → 云服务器执行 deploy-pull.sh
```

### 本地操作

```bash
# 1. 修改代码后提交
git add .
git commit -m "feat: 描述本次修改"
git push origin main
# 若默认分支是 master，则：git push origin master
```

### 云服务器操作

SSH 登录服务器后，在项目目录执行：

```bash
cd /root/web
./deploy-pull.sh
```

脚本会自动完成：`git pull` → `npm install --production` → 重启服务（pm2 或 systemd）。

---

## 三、云服务器首次 Git 配置（若尚未完成）

在云服务器 `/root/web` 目录：

```bash
cd /root/web
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/Bashiok1212/game-web.git
git branch -M main
git push -u origin main
```

> 若使用 GitHub，需配置 SSH 密钥或 Personal Access Token 以推送。

---

## 四、项目信息速查

| 项目 | 说明 |
|------|------|
| 技术栈 | Node.js + Express + MongoDB |
| 入口文件 | `server.js` |
| 启动命令 | `npm run dev`（开发）/ `npm start`（生产） |
| 端口 | 3000 |
| 管理后台 | `/admin` |
| 数据库 | MongoDB，默认 `mongodb://localhost:27017/game` |

---

## 五、常见问题

**Q: 本地没有 MongoDB？**  
A: 使用 Docker 运行 `mongo:7`，或使用 MongoDB Atlas 免费集群，在 `.env` 中设置 `MONGODB_URI`。

**Q: 云服务器如何常驻运行？**  
A: 推荐使用 pm2：`npm install -g pm2`，然后 `pm2 start server.js --name game-web`，并 `pm2 save`、`pm2 startup`。

**Q: deploy-pull.sh 无执行权限？**  
A: 执行 `chmod +x deploy-pull.sh`。

**Q: 推送后网页没更新？**  
A: 推送只是把代码传到 GitHub，服务器不会自动更新。需要 SSH 登录服务器后执行：
```bash
cd /root/web          # 或你的项目目录（含 .git 的仓库根目录）
git pull origin master
cd web                # 进入 web 子目录（若有）
npm install --production
pm2 restart game-web  # 或 systemctl restart game-web
```
若项目在 `/root/game-web`，则：
```bash
cd /root/game-web
git pull origin master
cd web
pm2 restart game-web
```
