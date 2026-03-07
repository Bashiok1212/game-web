#!/usr/bin/env node
'use strict';
// 道具图片生成：与 generate-spirit-images.js 用法一致，运行即生成到 public/images/items/
// 执行：node scripts/generate-item-images.js
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'images', 'items');
const MAX = 300; // 道具编号 1～300，可按需改

function svgForNumber(n) {
  const label = '\u9053\u5177' + n; // 道具
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
    '<rect width="96" height="96" fill="#1a1a20" stroke="#2a2a35" stroke-width="2" rx="8"/>' +
    '<text x="48" y="52" text-anchor="middle" fill="#e8e8ed" font-size="14" font-family="sans-serif">' +
    label +
    '</text></svg>'
  );
}

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

for (let n = 1; n <= MAX; n++) {
  const file = path.join(OUT_DIR, n + '.svg');
  fs.writeFileSync(file, svgForNumber(n), 'utf8');
}
console.log('Generated ' + MAX + ' item images in ' + OUT_DIR);
