#!/usr/bin/env node
'use strict';
/**
 * 本地脚本：把已生成的 public/images/spirits/*.svg 转成 PNG，输出到指定目录，供复制到 Unity 的 Resources/SpiritIcons。
 * 无需服务端参与，全部在本地运行。
 * 使用：npm install sharp（仅本地安装一次），然后 node scripts/export-spirit-pngs-for-unity.js [输出目录]
 * 默认输出到项目下的 unity-export/SpiritIcons，复制到 Unity 项目的 Assets/Resources/SpiritIcons 即可。
 */
const fs = require('fs');
const path = require('path');

const SVG_DIR = path.join(__dirname, '..', 'public', 'images', 'spirits');
const OUT_DIR = process.argv[2] || path.join(__dirname, '..', 'unity-export', 'SpiritIcons');

let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.error('请先在本地安装 sharp：npm install sharp');
  process.exit(1);
}

if (!fs.existsSync(SVG_DIR)) {
  console.error('未找到 SVG 目录：' + SVG_DIR + '，请先运行 node scripts/generate-spirit-images.js');
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

(async () => {
  for (let n = 1; n <= 151; n++) {
    const svgPath = path.join(SVG_DIR, n + '.svg');
    if (!fs.existsSync(svgPath)) continue;
    const pngPath = path.join(OUT_DIR, 'spirit_' + n + '.png');
    await sharp(svgPath).png().toFile(pngPath);
  }
  console.log('已导出 PNG 到 ' + OUT_DIR + '，复制到 Unity 项目的 Assets/Resources/SpiritIcons 即可。');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
