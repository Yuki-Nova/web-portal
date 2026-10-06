<template>
  <div>
    <button
      type="button"
      class="px-3 py-1.5 rounded-md border border-border-paper text-xs font-serif text-ink-muted hover:text-seal hover:border-seal/30 transition-colors"
      @click="isOpen = true"
    >
      韵书速查
    </button>

    <!-- 抽屉就地 fixed 定位；本项目**全项目禁止 Vue <Teleport>**（见 AGENTS.md 坑点五），
         且此组件挂在 <main> 直属位置，祖先没有 transform/filter，fixed 可以正确定位。 -->
    <div v-if="isOpen" class="fixed inset-0 z-[140] bg-black/40" @click.self="isOpen = false">
      <aside
        class="absolute right-0 top-0 h-full w-full max-w-sm bg-surface border-l border-border-paper shadow-paper-lg overflow-y-auto px-5 py-5"
      >
        <header class="flex items-center justify-between mb-4">
          <h2 class="font-serif text-sm text-ink tracking-wide">韵书速查</h2>
          <button
            type="button"
            class="text-xs font-serif text-ink-muted hover:text-ink transition-colors"
            @click="isOpen = false"
          >
            关闭
          </button>
        </header>

        <!-- 韵书切换 -->
        <div class="flex flex-wrap gap-1.5 mb-4">
          <button
            v-for="b in bookOptions"
            :key="b.key"
            type="button"
            class="px-2.5 py-1 rounded-md text-[11px] font-serif border transition-colors"
            :class="book === b.key
              ? 'border-seal/30 bg-seal/10 text-seal'
              : 'border-border-paper text-ink-muted hover:text-ink'"
            @click="book = b.key"
          >
            {{ b.label }}
          </button>
        </div>

        <!-- 单字输入 -->
        <label class="block mb-4">
          <span class="block text-[11px] font-serif text-ink-muted mb-1.5">输入一个汉字，反查韵部与同韵字</span>
          <input
            v-model="rawChar"
            type="text"
            class="w-full px-3 py-2 rounded-md border border-border-paper bg-canvas/40 text-sm font-serif text-ink focus:outline-none focus:border-seal/40"
            placeholder="例如：东"
          />
        </label>

        <p v-if="!lookupChar" class="text-xs font-serif text-ink-faint">
          支持《中华新韵》《平水韵》《词林正韵》三套韵书；多音字跨部时会列出全部韵部。
        </p>

        <template v-else>
          <p v-if="matchedGroups.length === 0" class="text-xs font-serif text-ink-muted">
            「{{ lookupChar }}」未被《{{ currentLabel }}》收录。
          </p>

          <div v-else class="space-y-5">
            <section v-for="group in matchedGroups" :key="group.name">
              <div class="flex items-baseline justify-between mb-1.5">
                <h3 class="font-serif text-xs text-seal">{{ group.name }}</h3>
                <span class="font-mono text-[10px] text-ink-faint">{{ group.chars.length }} 字</span>
              </div>
              <p class="text-sm font-serif text-ink leading-loose tracking-wide break-all">
                {{ visibleChars(group).join(' ') }}<span v-if="!isExpanded(group.name) && group.chars.length > PREVIEW_COUNT" class="text-ink-faint"> …</span>
              </p>
              <button
                v-if="group.chars.length > PREVIEW_COUNT"
                type="button"
                class="mt-1.5 text-[11px] font-serif text-ink-muted hover:text-seal transition-colors"
                @click="toggleExpand(group.name)"
              >
                {{ isExpanded(group.name) ? '收起' : `展开全部 ${group.chars.length} 字` }}
              </button>
            </section>
          </div>

          <!-- 跨韵书对照：同一个字在不同韵书里分别属于哪一部 -->
          <section class="mt-6 pt-4 border-t border-border-paper">
            <h3 class="font-serif text-[11px] text-ink-muted mb-2">在其他韵书中</h3>
            <ul class="space-y-1.5">
              <li v-for="b in bookOptions" :key="b.key" class="flex items-baseline justify-between gap-2">
                <span class="text-[11px] font-serif text-ink-muted shrink-0">{{ b.label }}</span>
                <span class="text-[11px] font-serif text-ink text-right">
                  {{ crossBook[b.key].length ? crossBook[b.key].join('、') : '未收录' }}
                </span>
              </li>
            </ul>
            <p class="mt-3 text-[10px] font-serif text-ink-faint leading-relaxed">
              平仄未在韵书数据中单独列出，韵部名本身含声调信息（如「入声一屋」）；平水韵的
              上平/下平/上声/去声同编号韵部需按名称判断。
            </p>
          </section>
        </template>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { RHYME_BOOKS, RHYME_BOOK_LABELS, getRhymeGroups } from '../../poetry-engine/core/rhymeChecker.js';

/**
 * 韵书速查抽屉：单字反查韵部 + 同韵字推荐 + 跨韵书对照。
 *
 * 数据直接复用 `poetry-engine/core/rhymeChecker.js` 已加载的三套韵书
 * （`RHYME_BOOKS`），**不要**在这里重新 fetch JSON，否则同一份数据会被打包两次。
 *
 * 已知限制：韵书数据只有「韵部名 + 字表」，没有独立的平仄字段，
 * 因此这里只展示韵部名，不推断平仄（韵部名本身已含声调信息）。
 */
const bookOptions = Object.keys(RHYME_BOOKS).map((key) => ({
  key,
  label: RHYME_BOOK_LABELS[key] || key,
}));

const PREVIEW_COUNT = 60;

const isOpen = ref(false);
const book = ref('xinyun');
const rawChar = ref('');
const expanded = ref(new Set());

const lookupChar = computed(() => (rawChar.value || '').trim().slice(0, 1));
const currentLabel = computed(() => RHYME_BOOK_LABELS[book.value] || book.value);

const matchedGroups = computed(() => {
  const char = lookupChar.value;
  if (!char) return [];
  const data = RHYME_BOOKS[book.value];
  if (!data) return [];
  return data.groups.filter((group) => group.chars.includes(char));
});

const crossBook = computed(() => {
  const char = lookupChar.value;
  const result = {};
  bookOptions.forEach((b) => {
    result[b.key] = char ? getRhymeGroups(char, b.key) : [];
  });
  return result;
});

function isExpanded(name) {
  return expanded.value.has(name);
}

function toggleExpand(name) {
  const next = new Set(expanded.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  expanded.value = next;
}

function visibleChars(group) {
  if (isExpanded(group.name) || group.chars.length <= PREVIEW_COUNT) return group.chars;
  return group.chars.slice(0, PREVIEW_COUNT);
}
</script>
