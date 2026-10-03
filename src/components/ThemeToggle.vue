<template>
  <button
    type="button"
    @click="toggleTheme"
    class="relative p-2 rounded-md text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-seal/40"
    :title="isDark ? '切换至日光宣纸' : '切换至玄墨沉夜'"
    aria-label="切换明暗主题"
  >
    <!-- Sun icon -->
    <svg
      v-if="isDark"
      class="w-4 h-4 transition-transform rotate-0 scale-100"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.8"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
    <!-- Moon icon -->
    <svg
      v-else
      class="w-4 h-4 transition-transform rotate-0 scale-100"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="1.8"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  </button>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const isDark = ref(false);

const updateTheme = (dark) => {
  isDark.value = dark;
  if (dark) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('shiro-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('shiro-theme', 'light');
  }
};

const toggleTheme = () => {
  updateTheme(!isDark.value);
};

onMounted(() => {
  // 与 <head> 里的主题脚本保持同一判断口径：显式存储优先，其次跟随系统。
  // 不直接读 documentElement 的属性——客户端导航后该属性由 astro:after-swap
  // 补回，读取时机可能早于它，会造成图标状态与实际主题错位。
  try {
    const stored = localStorage.getItem('shiro-theme');
    isDark.value = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    isDark.value = document.documentElement.getAttribute('data-theme') === 'dark';
  }
});
</script>
