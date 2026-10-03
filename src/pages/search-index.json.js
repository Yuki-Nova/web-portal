/**
 * 全站搜索索引（构建期生成的静态 JSON，输出为 /search-index.json）。
 *
 * 背景：原先由 BaseLayout 把 80 篇文章正文当作 props 内联进每个页面的
 * island 属性，SearchModal 的 astro-island 标签因此长达 26KB，
 * 87 个页面 HTML 合计 5.1MB。改为独立端点后，索引只在用户真正
 * 打开搜索时按需加载一次，并在会话内缓存。
 */
import { getCollection } from 'astro:content';

export async function GET() {
  const posts = await getCollection('blog');

  const index = posts.map((p) => ({
    slug: p.id.replace(/\.md$/, ''),
    title: p.data.title,
    date: p.data.date ? new Date(p.data.date).toLocaleDateString('zh-CN') : '',
    categories: p.data.categories || [],
    tags: p.data.tags || [],
    // 正文用于字句检索；前端只取匹配片段，不整体渲染
    body: p.body || '',
  }));

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
