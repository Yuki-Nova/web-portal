/**
 * 正文摘要工具（meta description / OG / RSS 共用）。
 *
 * 把 markdown 正文压成一行纯文本：只做粗粒度去标记（代码块 / 图片 / 链接 /
 * 标题与强调符号），**不做完整 Markdown 解析** —— 目的是给搜索引擎、社交卡片
 * 和 RSS 阅读器一句可读的提要，不是渲染正文。
 *
 * 注意：`entry.body` 是**不含 frontmatter** 的原始正文；本文件被
 * `src/pages/posts/[slug].astro` 与 `src/pages/rss.xml.js` 共用，改口径请只改这里。
 */
export function toExcerpt(entry, maxLength = 110) {
  const raw = entry?.body ?? '';
  const plain = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~`-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!plain) return entry?.data?.title ?? '';
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain;
}
