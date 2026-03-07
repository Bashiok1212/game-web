# 图片生成脚本（妖灵 / 道具）

**全部在本地生成，不需要服务端参与。** 运行对应脚本，自动生成本地 SVG 到 `public/images/` 下。

| 脚本 | 生成目录 | 说明 |
|------|----------|------|
| `node scripts/generate-spirit-images.js` | `public/images/spirits/` | 妖灵1～151 的 SVG，网页图鉴/队伍条用 |
| `node scripts/generate-item-images.js`  | `public/images/items/`   | 道具1～300 的 SVG，后台物品可填 `/images/items/编号.svg` |

**游戏内 SpiritBar 用 PNG（Unity 只认位图）**：在本地把已生成的 SVG 转成 PNG 再放进 Unity 工程即可：

1. 本地安装一次：`npm install sharp`
2. 运行：`node scripts/export-spirit-pngs-for-unity.js [输出目录]`  
   默认输出到 `unity-export/SpiritIcons`（可传参数指定目录）
3. 把输出的 `spirit_1.png`～`spirit_151.png` 复制到 Unity 项目的 `Assets/Resources/SpiritIcons/`  
游戏内 SpiritBarLoader 默认从 Resources 加载，无需服务端生成或提供 PNG。

**查看是否生成成功**：看对应目录下是否有 `1.svg`、`2.svg`… 或执行：

```bash
node scripts/generate-spirit-images.js
dir public\images\spirits\*.svg | measure -Line
```
