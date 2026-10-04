import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const blogDir = path.join(projectRoot, 'src', 'content', 'blog');
const targetJson = path.join(projectRoot, 'src', 'data', 'poetry-wall.json');

/**
 * 解析 Markdown 文件的 YAML frontmatter 和正文
 */
function parsePost(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: content };
  }

  const rawYaml = match[1];
  const body = match[2];

  const data = {};
  const lines = rawYaml.split(/\r?\n/);
  let currentKey = null;

  for (const line of lines) {
    const keyMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const val = keyMatch[2].trim();
      if (val === '') {
        data[currentKey] = [];
      } else {
        data[currentKey] = val.replace(/^['"](.*)['"]$/, '$1');
      }
      continue;
    }

    const itemMatch = line.match(/^\s*-\s*(.*)$/);
    if (itemMatch && currentKey && Array.isArray(data[currentKey])) {
      data[currentKey].push(itemMatch[1].trim().replace(/^['"](.*)['"]$/, '$1'));
    }
  }

  return { data, body };
}

/**
 * 将 Markdown 正文转换为诗词墙的 HTML 片段
 */
function formatPoemContent(body) {
  const blocks = body.trim().split(/\r?\n\s*\r?\n/);
  const htmlBlocks = blocks
    .map((block) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return '';
      const lines = trimmedBlock.split(/\r?\n/).map((line) => {
        const trimmed = line.trim();
        // 转换 Markdown 图片语法 ![alt](src) 为 HTML <img>
        return trimmed.replace(
          /!\[([^\]]*)\]\(([^)]+)\)/g,
          '<img src="$2" alt="$1">'
        );
      });
      return `<p>${lines.join('<br>')}</p>\n`;
    })
    .filter(Boolean);

  return htmlBlocks.join('');
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(d) {
  if (!d) return '';
  const dateObj = new Date(d);
  if (Number.isNaN(dateObj.getTime())) return String(d).split(' ')[0];
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function syncPoetryWall() {
  if (!fs.existsSync(blogDir)) {
    console.error(`[sync-poetry-wall] 博客目录不存在: ${blogDir}`);
    return;
  }

  const files = fs.readdirSync(blogDir).filter((f) => f.endsWith('.md'));
  const poems = [];

  for (const file of files) {
    const fullPath = path.join(blogDir, file);
    const rawContent = fs.readFileSync(fullPath, 'utf8');
    const { data, body } = parsePost(rawContent);

    const title = data.title || file.replace(/\.md$/, '');
    const date = formatDate(data.date);
    const categories = Array.isArray(data.categories) ? data.categories : [];
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const content = formatPoemContent(body);

    poems.push({
      title,
      date,
      categories,
      tags,
      content,
    });
  }

  // 按日期降序排序；日期相同时按标题自然序
  poems.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    if (db !== da) return db - da;
    return a.title.localeCompare(b.title, 'zh-CN');
  });

  const jsonContent = JSON.stringify(poems);
  fs.writeFileSync(targetJson, jsonContent, 'utf8');
  console.log(`[sync-poetry-wall] 已同步 ${poems.length} 首诗词到 ${path.relative(projectRoot, targetJson)}`);
}

// 直接运行模式
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncPoetryWall();
}
