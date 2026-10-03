// @ts-check
import { defineConfig } from 'astro/config';
import vue from '@astrojs/vue';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://yukinova.top',
  output: 'static',
  integrations: [
    vue(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
