#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
const examplePath = path.join(__dirname, '..', '.env.example');

if (!fs.existsSync(envPath)) {
  fs.copyFileSync(examplePath, envPath);
  console.log('已创建 .env');
}
let content = fs.readFileSync(envPath, 'utf8');
if (content.includes('your-secret-at-least-32-chars')) {
  const secret = require('crypto').randomBytes(32).toString('hex');
  content = content.replace('your-secret-at-least-32-chars', secret);
  fs.writeFileSync(envPath, content);
  console.log('已自动生成 JWT_SECRET');
}
