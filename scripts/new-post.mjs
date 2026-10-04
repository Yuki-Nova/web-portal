import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { syncPoetryWall } from './sync-poetry-wall.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const blogDir = path.join(projectRoot, 'src', 'content', 'blog');

function askQuestion(rl, query, defaultVal = '') {
  return new Promise((resolve) => {
    const prompt = defaultVal ? `${query} [默认: ${defaultVal}]: ` : `${query}: `;
    rl.question(prompt, (answer) => {
      resolve(answer.trim() || defaultVal);
    });
  });
}

function formatDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const Y = date.getFullYear();
  const M = pad(date.getMonth() + 1);
  const D = pad(date.getDate());
  const h = pad(date.getHours());
  const m = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

async function main() {
  const args = process.argv.slice(2);
  let title = '';
  let category = '';
  let tag = '';

  // 命令行参数解析
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--cat' || args[i] === '-c') {
      category = args[++i];
    } else if (args[i] === '--tag' || args[i] === '-t') {
      tag = args[++i];
    } else if (!title && !args[i].startsWith('-')) {
      title = args[i];
    }
  }

  // 交互式补全
  if (!title) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      title = await askQuestion(rl, '请输入博文/诗词标题');
      if (!title) {
        console.error('未输入标题，已取消。');
        rl.close();
        process.exit(1);
      }
      category = await askQuestion(rl, '体裁 (诗 / 词 / 诗词)', '词');
      const defaultTag = category === '词' ? '词' : '七绝';
      tag = await askQuestion(rl, '标签 (七绝 / 七律 / 五律 / 词 / 古体)', defaultTag);
    } finally {
      rl.close();
    }
  } else {
    if (!category) category = '词';
    if (!tag) tag = category === '词' ? '词' : '七绝';
  }

  // 清洗文件名特殊字符
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '');
  const filePath = path.join(blogDir, `${safeTitle}.md`);

  if (fs.existsSync(filePath)) {
    console.log(`[new-post] 文件已存在: ${filePath}`);
  } else {
    const nowStr = formatDate();
    const content = `---
title: ${title}
date: '${nowStr}'
categories:
  - ${category}
tags:
  - ${tag}
---

`;

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`[new-post] 成功创建博文: ${path.relative(projectRoot, filePath)}`);

    // 自动同步到诗词墙
    syncPoetryWall();
  }

  // 尝试使用 VS Code 打开
  exec(`code "${filePath}"`, (err) => {
    if (err) {
      console.log(`[new-post] 编辑器未唤起，请手动编辑: ${filePath}`);
    } else {
      console.log(`[new-post] 已在 VS Code 中打开文件。`);
    }
  });
}

main().catch((err) => {
  console.error('[new-post] 错误:', err);
  process.exit(1);
});
