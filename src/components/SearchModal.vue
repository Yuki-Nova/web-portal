<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 px-4"
    @click.self="closeModal"
  >
    <div class="paper-card w-full max-w-xl bg-surface border border-border-paper shadow-2xl overflow-hidden flex flex-col max-h-[75vh]">
      <!-- Search Input Box -->
      <div class="flex items-center gap-3 px-4 py-3.5 border-b border-border-paper bg-canvas/40">
        <svg class="w-4 h-4 text-seal flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref="inputRef"
          type="text"
          v-model="query"
          placeholder="搜索篇名或字句"
          class="w-full bg-transparent text-sm font-serif text-ink placeholder-ink-muted/50 focus:outline-none"
          @keydown.esc="closeModal"
          @keydown.down.prevent="selectNext"
          @keydown.up.prevent="selectPrev"
          @keydown.enter.prevent="selectCurrent"
        />
        <button
          v-if="query"
          @click="query = ''"
          class="text-xs text-ink-muted hover:text-ink px-1.5"
        >
          ✕
        </button>
        <kbd class="font-mono text-[10px] text-ink-muted px-1.5 py-0.5 rounded border border-border-paper">ESC</kbd>
      </div>

      <!-- Search Results List -->
      <div class="overflow-y-auto flex-1 divide-y divide-border-paper p-2">
        <div v-if="indexLoading" class="py-8 text-center text-xs font-serif text-ink-muted">
          正在装载检索索引...
        </div>

        <div v-else-if="indexError" class="py-8 text-center text-xs font-serif text-red-700 dark:text-red-400">
          检索索引加载失败：{{ indexError }}
        </div>

        <div v-else-if="query.trim() === ''" class="py-8 text-center text-xs font-serif text-ink-muted">
          输入关键词检索
        </div>

        <div v-else-if="filteredResults.length === 0" class="py-8 text-center text-xs font-serif text-ink-muted">
          没有找到「{{ query }}」
        </div>

        <div
          v-for="(item, idx) in filteredResults"
          :key="item.slug"
          @click="goToPost(item.slug)"
          class="p-3 rounded-md cursor-pointer transition-colors"
          :class="selectedIndex === idx ? 'bg-seal/10 text-seal' : 'hover:bg-black/5 dark:hover:bg-white/5'"
        >
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="font-serif font-semibold text-sm text-ink truncate">
              {{ item.title }}
            </span>
            <div class="flex items-center gap-1.5 flex-shrink-0 text-[10px] font-mono text-ink-muted">
              <span v-for="t in item.tags?.slice(0, 1)" :key="t" class="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 font-serif text-seal">
                {{ t }}
              </span>
              <span>{{ item.date }}</span>
            </div>
          </div>

          <!-- Matched Text Snippet -->
          <p class="text-xs font-serif text-ink-muted line-clamp-2 leading-relaxed" v-html="highlight(item.snippet, query)"></p>
        </div>
      </div>

      <!-- Footer Status -->
      <div class="px-4 py-2 border-t border-border-paper bg-canvas/30 flex items-center justify-between text-[11px] font-serif text-ink-muted">
        <span>{{ filteredResults.length }} 条结果</span>
        <span class="font-mono">↑↓ 选择 · Enter 打开</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';

/**
 * 全文搜索弹窗。
 *
 * 两条约束（都踩过坑，别改回去）：
 *  1. 本组件挂在 BaseLayout 的 body 末尾，**不要**用 Vue 的 <Teleport to="body">——
 *     它在 Astro 岛内会在 hydration 时把整个 <header> 从 DOM 中移除（见 AGENTS.md 坑点一）。
 *  2. 检索索引**不要**再当作 props 从布局内联进来（那会让每页 HTML 多背 20+KB），
 *     改为打开弹窗时按需 fetch /search-index.json，并在会话内缓存。
 */
const INDEX_URL = '/search-index.json';

const isOpen = ref(false);
const query = ref('');
const selectedIndex = ref(0);
const inputRef = ref(null);

// 检索索引（按需加载，模块级缓存跨开合复用）
const indexData = ref([]);
const indexLoading = ref(false);
const indexError = ref(null);

async function ensureIndex() {
  if (indexData.value.length || indexLoading.value) return;
  indexLoading.value = true;
  indexError.value = null;
  try {
    const res = await fetch(INDEX_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('索引格式异常');
    indexData.value = data;
  } catch (err) {
    indexError.value = err.message;
    console.error('[SearchModal] 检索索引加载失败:', err);
  } finally {
    indexLoading.value = false;
  }
}

const openModal = () => {
  isOpen.value = true;
  query.value = '';
  selectedIndex.value = 0;
  ensureIndex();
  nextTick(() => {
    inputRef.value?.focus();
  });
};

const closeModal = () => {
  isOpen.value = false;
};

const filteredResults = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return [];

  return indexData.value
    .map((p) => {
      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const catMatch = (p.categories || []).some((c) => c.toLowerCase().includes(q));
      const tagMatch = (p.tags || []).some((t) => t.toLowerCase().includes(q));
      const body = (p.body || '').replace(/---[\s\S]*?---/, '');
      const bodyIdx = body.toLowerCase().indexOf(q);

      if (titleMatch || catMatch || tagMatch || bodyIdx !== -1) {
        let snippet = '';
        if (bodyIdx !== -1) {
          const start = Math.max(0, bodyIdx - 30);
          const end = Math.min(body.length, bodyIdx + 50);
          snippet = (start > 0 ? '...' : '') + body.substring(start, end).trim() + (end < body.length ? '...' : '');
        } else {
          snippet = body.substring(0, 70).trim() + '...';
        }

        return {
          ...p,
          snippet: snippet.replace(/[\n\r]+/g, ' '),
          score: titleMatch ? 10 : (catMatch || tagMatch ? 5 : 1),
        };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
});

const highlight = (text, q) => {
  if (!text || !q) return text || '';
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<span class="text-seal font-semibold underline">$1</span>');
};

const selectNext = () => {
  if (selectedIndex.value < filteredResults.value.length - 1) {
    selectedIndex.value++;
  } else {
    selectedIndex.value = 0;
  }
};

const selectPrev = () => {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
  } else {
    selectedIndex.value = filteredResults.value.length - 1;
  }
};

const selectCurrent = () => {
  const target = filteredResults.value[selectedIndex.value];
  if (target) {
    goToPost(target.slug);
  }
};

const goToPost = (slug) => {
  closeModal();
  window.location.href = `/posts/${encodeURIComponent(slug)}`;
};

// Header 的搜索按钮派发的打开请求
const handleOpenRequest = () => {
  if (!isOpen.value) openModal();
};

const handleGlobalKey = (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    if (isOpen.value) {
      closeModal();
    } else {
      openModal();
    }
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKey);
  window.addEventListener('shiro:open-search', handleOpenRequest);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKey);
  window.removeEventListener('shiro:open-search', handleOpenRequest);
});
</script>
