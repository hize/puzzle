#!/usr/bin/env node
/**
 * 把 Web 资源同步到 www/ 目录，供 Capacitor 打包时使用。
 * 仅做文件复制，不做代码编译（项目本身是零依赖纯静态）。
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dst = path.join(root, 'www');

const items = ['index.html', 'manifest.webmanifest', 'sw.js', 'styles', 'src', 'icons'];

function rmrf(p) {
  if (!fs.existsSync(p)) return;
  const stat = fs.lstatSync(p);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(p)) rmrf(path.join(p, name));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

function copy(src, rel) {
  const target = path.join(dst, rel);
  const st = fs.lstatSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copy(path.join(src, name), path.join(rel, name));
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(src, target);
  }
}

rmrf(dst);
fs.mkdirSync(dst, { recursive: true });
for (const it of items) {
  const src = path.join(root, it);
  if (!fs.existsSync(src)) {
    console.warn('  skip (missing):', it);
    continue;
  }
  copy(src, it);
  console.log('  copied:', it);
}
console.log('www/ 同步完成');
