import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { toExcerpt } from '../utils/excerpt.js';

/**
 * RSS 2.0 订阅源（构建期生成 dist/rss.xml）。
 *
 * ⚠️ 文章链接的 slug 必须由内容集合的 `post.id` 推导，**不要**用文件名或标题拼：
 * Astro 的 glob loader 会小写化 ASCII 并删掉 `.`/`·`/空格 等标点
 * （`Eden.md` → `eden`、`永遇乐.voyager_01.md` → `永遇乐voyager_01`）。
 * AGENTS.md 第六节硬规则 7 记录了历史事故：用近似算法导致诗词墙 39/81 个链接 404。
 * 这里与 `src/pages/posts/[slug].astro` 保持同一口径。
 */
const SITE_TITLE = "yuki's stop";
const SITE_DESCRIPTION = '诗词、照片与工具';

export async function GET(context) {
  const posts = await getCollection('blog');
  const sorted = [...posts].sort(
    (a, b) => new Date(b.data.date ?? 0).getTime() - new Date(a.data.date ?? 0).getTime(),
  );

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site,
    items: sorted
      // 没有日期的条目会让 pubDate 非法，直接跳过（当前 81 篇全部带 date）
      .filter((post) => Boolean(post.data.date))
      .map((post) => ({
        title: post.data.title,
        pubDate: new Date(post.data.date),
        description: toExcerpt(post),
        link: `/posts/${encodeURIComponent(post.id.replace(/\.md$/, ''))}`,
        // categories / tags 有重名（例如「词」同时是分类和标签），去重后再输出
        categories: [...new Set([...(post.data.categories ?? []), ...(post.data.tags ?? [])])],
      })),
    customData: '<language>zh-CN</language>',
  });
}
