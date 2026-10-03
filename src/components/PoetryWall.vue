<template>
  <div class="poetry-wall-wrapper">
    <!-- Top Filter & Controls -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border-paper">
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-2 text-xs font-serif">
        <span class="text-ink-muted">体裁：</span>
        <button
          v-for="cat in categories"
          :key="cat"
          @click="selectCategory(cat)"
          class="px-2.5 py-1 rounded transition-colors"
          :class="
            selectedCategory === cat
              ? 'bg-seal/10 text-seal font-medium border border-seal/20'
              : 'text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5'
          "
        >
          {{ cat }}
        </button>

        <span class="text-border-paper mx-1">|</span>

        <button
          v-for="tag in popularTags"
          :key="tag"
          @click="selectTag(tag)"
          class="px-2.5 py-1 rounded transition-colors"
          :class="
            selectedTag === tag
              ? 'bg-seal/10 text-seal font-medium border border-seal/20'
              : 'text-ink-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5'
          "
        >
          {{ tag }}
        </button>
      </div>

      <!-- Action buttons -->
      <div class="flex items-center gap-3">
        <button
          @click="randomPoem"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-paper bg-surface hover:bg-black/5 dark:hover:bg-white/5 text-ink text-xs font-serif transition-colors shadow-sm"
        >
          <span>随机拾萃</span>
          <span class="text-seal">✦</span>
        </button>
        <span class="text-xs font-mono text-ink-muted">
          {{ currentIndex + 1 }} / {{ filteredPoems.length }}
        </span>
      </div>
    </div>

    <!-- Central Paper Stage -->
    <div class="relative max-w-2xl mx-auto my-4 sm:my-8 px-2 select-text">
      <!-- Navigation Arrow Left -->
      <button
        @click="prevPoem"
        class="hidden sm:flex absolute -left-12 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-border-paper bg-surface/80 hover:bg-surface text-ink-muted hover:text-ink items-center justify-center transition-all shadow-paper z-10"
        aria-label="上一首"
      >
        ‹
      </button>

      <!-- The Poetry Paper Card -->
      <article
        class="paper-card p-8 sm:p-12 relative overflow-hidden transition-all duration-300 min-h-[320px] flex flex-col justify-between"
      >
        <!-- Watermark -->
        <div
          class="absolute -right-6 -bottom-6 text-9xl font-serif text-ink opacity-[0.025] select-none pointer-events-none"
        >
          詞
        </div>

        <div>
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-4 border-b border-border-paper pb-4 mb-8">
            <div>
              <span class="text-[11px] font-mono text-ink-faint block mb-1">
                {{ currentPoem?.date }}
              </span>
              <h2 class="text-2xl sm:text-3xl font-serif font-bold text-ink tracking-wider">
                {{ currentPoem?.title }}
              </h2>
            </div>

            <div class="flex items-center gap-2">
              <span
                v-for="t in currentPoem?.tags"
                :key="t"
                class="px-2 py-0.5 rounded text-[11px] font-serif bg-seal/5 text-seal border border-seal/15"
              >
                {{ t }}
              </span>
            </div>
          </div>

          <!-- Card Body: Poetry Lines -->
          <div
            class="font-serif text-lg sm:text-xl text-ink leading-loose tracking-widest space-y-2 whitespace-pre-wrap text-center sm:text-left"
            v-html="currentPoem?.content"
          ></div>
        </div>

        <!-- Card Footer -->
        <div class="mt-10 pt-4 border-t border-border-paper flex items-center justify-between text-xs text-ink-muted">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 seal-badge text-[10px]">印</span>
            <span class="font-serif text-ink-muted">yuki's stop 诗录</span>
          </div>

          <div class="flex items-center gap-3">
            <button
              @click="copyPoem"
              class="hover:text-seal transition-colors font-serif"
            >
              {{ copied ? '已抄录！' : '抄录诗文' }}
            </button>
          </div>
        </div>
      </article>

      <!-- Navigation Arrow Right -->
      <button
        @click="nextPoem"
        class="hidden sm:flex absolute -right-12 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full border border-border-paper bg-surface/80 hover:bg-surface text-ink-muted hover:text-ink items-center justify-center transition-all shadow-paper z-10"
        aria-label="下一首"
      >
        ›
      </button>
    </div>

    <!-- Mobile Nav Controls -->
    <div class="flex sm:hidden items-center justify-center gap-4 mt-6">
      <button
        @click="prevPoem"
        class="px-4 py-2 rounded-md border border-border-paper bg-surface text-ink text-xs font-serif"
      >
        ← 上一首
      </button>
      <button
        @click="nextPoem"
        class="px-4 py-2 rounded-md border border-border-paper bg-surface text-ink text-xs font-serif"
      >
        下一首 →
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  poems: {
    type: Array,
    required: true,
  },
});

const selectedCategory = ref('全部');
const selectedTag = ref('全部');
const currentIndex = ref(0);
const copied = ref(false);

const categories = ['全部', '诗', '词', '诗词'];
const popularTags = ['全部', '七绝', '七律', '五律', '词'];

const selectCategory = (cat) => {
  selectedCategory.value = cat;
  currentIndex.value = 0;
};

const selectTag = (tag) => {
  selectedTag.value = tag;
  currentIndex.value = 0;
};

const filteredPoems = computed(() => {
  return props.poems.filter((p) => {
    const matchCat =
      selectedCategory.value === '全部' ||
      (p.categories && p.categories.includes(selectedCategory.value));
    const matchTag =
      selectedTag.value === '全部' ||
      (p.tags && p.tags.includes(selectedTag.value));
    return matchCat && matchTag;
  });
});

const currentPoem = computed(() => {
  if (filteredPoems.value.length === 0) return null;
  return filteredPoems.value[currentIndex.value] || filteredPoems.value[0];
});

const nextPoem = () => {
  if (currentIndex.value < filteredPoems.value.length - 1) {
    currentIndex.value++;
  } else {
    currentIndex.value = 0;
  }
};

const prevPoem = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--;
  } else {
    currentIndex.value = filteredPoems.value.length - 1;
  }
};

const randomPoem = () => {
  if (filteredPoems.value.length < 2) return;
  let r;
  do {
    r = Math.floor(Math.random() * filteredPoems.value.length);
  } while (r === currentIndex.value);
  currentIndex.value = r;
};

const copyPoem = () => {
  if (!currentPoem.value) return;
  // Convert HTML content into clean plain text
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = currentPoem.value.content;
  const plain = tempDiv.innerText || tempDiv.textContent || '';
  const text = `《${currentPoem.value.title}》\n\n${plain.trim()}\n\n—— yuki's stop`;
  navigator.clipboard.writeText(text).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  });
};

const handleKeyDown = (e) => {
  if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === 'ArrowLeft') prevPoem();
  if (e.key === 'ArrowRight') nextPoem();
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>
