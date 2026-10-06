/**
 * 正文字数统计与预计阅读时长（文章详情页用）。
 *
 * 口径：中日韩表意文字按「字」逐字计，拉丁字母/数字按「词」计，两者相加为总字数。
 * 统计前先剥掉 markdown 标记（代码块 / 图片 / 链接语法 / 强调与标题符号），
 * 否则 `###`、`**`、URL 都会被算进去。中文按 350 字/分钟估算，最少显示 1 分钟。
 *
 * `entry.body` 是**不含 frontmatter** 的原始正文。
 */
const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const WORD_RE = /[A-Za-z0-9][A-Za-z0-9'-]*/g;

export const READING_UNITS_PER_MINUTE = 350;

export function countWords(entry) {
  const raw = entry?.body ?? '';
  const text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`|]/g, ' ');

  const cjk = (text.match(CJK_RE) ?? []).length;
  const words = (text.match(WORD_RE) ?? []).length;
  return { cjk, words, total: cjk + words };
}

export function readingMinutes(total, unitsPerMinute = READING_UNITS_PER_MINUTE) {
  if (!total) return 0;
  return Math.max(1, Math.round(total / unitsPerMinute));
}
