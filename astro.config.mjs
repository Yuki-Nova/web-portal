// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://yukinova.top',
  output: 'static',
  // 旧路径 /blog 已更名为 /poems（纯诗词页）；静态产物会生成跳转页兜底，
  // 生产环境另有 nginx 301（见 README 部署说明）。
  redirects: {
    '/blog': '/poems',
  },
  integrations: [
    vue(),
    tailwind({
      applyBaseStyles: false,
    }),
    // sitemap 会在构建期收录全部静态路由（含分页 / 分类 / 标签页），
    // 产出 dist/sitemap-index.xml + dist/sitemap-0.xml。
    // /blog 是 redirects 生成的跳转页，不该进 sitemap，故过滤掉。
    sitemap({
      filter: (page) => !page.includes('/blog'),
    }),
  ],
});
