// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwind from '@astrojs/tailwind';

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
  ],
});
