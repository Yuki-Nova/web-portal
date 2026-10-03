<template>
  <button
    type="button"
    @click="openSearch"
    class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-serif text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors border border-border-paper"
    title="全文搜索 (Ctrl+K)"
    aria-label="搜索"
  >
    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <span class="hidden sm:inline">搜索</span>
    <kbd class="hidden sm:inline font-mono text-[10px] opacity-50 px-1 py-0.5 rounded bg-black/5 dark:bg-white/5">⌘K</kbd>
  </button>
</template>

<script setup>
/**
 * 搜索触发按钮（与 SearchModal 弹窗分离部署）。
 *
 * 按钮必须留在 Header 内，但 Header 带有 backdrop-blur-md（会创建包含块），
 * 弹窗若就地渲染就无法覆盖全屏；而 Vue 的 <Teleport to="body"> 在 Astro 岛内
 * 会在 hydration 时把整个 <header> 从 DOM 中移除（详见 AGENTS.md 坑点一）。
 *
 * 因此拆成两半：按钮在这里，弹窗挂在布局末尾（BaseLayout 的 body 尾部），
 * 两者通过全局事件通信。
 */
const openSearch = () => {
  window.dispatchEvent(new CustomEvent('shiro:open-search'));
};
</script>
