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
          <span>随机</span>
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
        class="hidden sm:flex absolute -left-12 top-52 sm:top-56 -translate-y-1/2 w-9 h-9 rounded-full border border-border-paper bg-surface/80 hover:bg-surface text-ink-muted hover:text-ink items-center justify-center transition-all shadow-paper z-10"
        aria-label="上一首"
      >
        ‹
      </button>

      <!-- The Poetry Paper Card -->
      <article
        class="paper-card p-8 sm:p-12 relative overflow-hidden transition-all duration-300 min-h-[480px] sm:min-h-[520px] flex flex-col justify-between"
      >
        <!-- Watermark -->
        <div
          class="absolute -right-6 -bottom-6 text-9xl font-serif text-ink opacity-[0.025] select-none pointer-events-none"
        >
          {{ watermarkText }}
        </div>

        <Transition name="poem-fade" mode="out-in">
          <div :key="currentPoem?.title" class="flex-1 flex flex-col justify-between">
            <div>
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-4 border-b border-border-paper pb-4 mb-8">
            <div>
              <span class="text-[11px] font-mono text-ink-faint block mb-1">
                {{ currentPoem?.date }}
              </span>
              <h2 class="text-2xl sm:text-3xl font-serif font-bold text-ink tracking-wider">
                <a
                  :href="postUrl"
                  class="text-ink hover:text-seal transition-colors no-underline"
                  title="查看文章详情"
                >
                  {{ currentPoem?.title }}
                </a>
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
            v-html="poemParsed.textHtml"
          ></div>

          <!-- Card Body: Attached Images / 附图画廊 -->
          <div
            v-if="poemParsed.images.length > 0"
            class="mt-10 pt-6 border-t border-border-paper/60 text-left"
          >
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs font-serif text-ink-muted flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-seal"></span>
                <span>题咏影存 · {{ poemParsed.images.length }} 张</span>
              </span>
              <span class="text-[11px] font-serif text-ink-faint">点击查看大图</span>
            </div>

            <!-- Single Image Layout -->
            <div
              v-if="poemParsed.images.length === 1"
              class="max-w-md mx-auto group cursor-zoom-in"
              @click="openLightbox(0)"
            >
              <div
                class="overflow-hidden rounded-md border border-border-paper bg-surface shadow-paper hover:shadow-paper-hover transition-all"
              >
                <!-- Fallback if broken -->
                <div
                  v-if="failedImages.has(poemParsed.images[0].src)"
                  class="p-8 text-center text-ink-faint bg-black/5 dark:bg-white/5 font-serif text-xs"
                >
                  <span class="block text-xl mb-1">🖼️</span>
                  <span>{{ poemParsed.images[0].alt || '题咏配图' }}（外链暂不可达）</span>
                </div>
                <img
                  v-else
                  :src="poemParsed.images[0].src"
                  :alt="poemParsed.images[0].alt"
                  class="w-full max-h-80 object-cover group-hover:scale-102 transition-transform duration-300"
                  loading="lazy"
                  @error="onImageError(poemParsed.images[0].src)"
                />
              </div>
              <p
                v-if="poemParsed.images[0].alt"
                class="text-center text-xs font-serif text-ink-muted mt-2 tracking-wider"
              >
                {{ poemParsed.images[0].alt }}
              </p>
            </div>

            <!-- Double Images Layout -->
            <div
              v-else-if="poemParsed.images.length === 2"
              class="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
            >
              <div
                v-for="(img, idx) in poemParsed.images"
                :key="idx"
                class="group cursor-zoom-in flex flex-col"
                @click="openLightbox(idx)"
              >
                <div
                  class="overflow-hidden rounded-md border border-border-paper bg-surface shadow-paper hover:shadow-paper-hover transition-all aspect-[4/3] flex items-center justify-center"
                >
                  <div
                    v-if="failedImages.has(img.src)"
                    class="p-4 text-center text-ink-faint font-serif text-xs"
                  >
                    <span class="block text-lg mb-1">🖼️</span>
                    <span class="truncate block max-w-[90%] mx-auto">{{ img.alt || '配图' }}</span>
                  </div>
                  <img
                    v-else
                    :src="img.src"
                    :alt="img.alt"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    @error="onImageError(img.src)"
                  />
                </div>
                <p
                  v-if="img.alt"
                  class="text-center text-xs font-serif text-ink-muted mt-1.5 tracking-wider truncate"
                >
                  {{ img.alt }}
                </p>
              </div>
            </div>

            <!-- 3+ Images Layout (Grid) -->
            <div
              v-else
              class="grid grid-cols-2 sm:grid-cols-3 gap-3"
            >
              <div
                v-for="(img, idx) in poemParsed.images"
                :key="idx"
                class="group cursor-zoom-in flex flex-col"
                @click="openLightbox(idx)"
              >
                <div
                  class="overflow-hidden rounded-md border border-border-paper bg-surface shadow-paper hover:shadow-paper-hover transition-all aspect-square sm:aspect-[4/3] flex items-center justify-center"
                >
                  <div
                    v-if="failedImages.has(img.src)"
                    class="p-3 text-center text-ink-faint font-serif text-[11px]"
                  >
                    <span class="block text-base mb-1">🖼️</span>
                    <span class="truncate block max-w-[90%] mx-auto">{{ img.alt || '配图' }}</span>
                  </div>
                  <img
                    v-else
                    :src="img.src"
                    :alt="img.alt"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    @error="onImageError(img.src)"
                  />
                </div>
                <p
                  v-if="img.alt"
                  class="text-center text-[11px] font-serif text-ink-muted mt-1 tracking-wider truncate"
                >
                  {{ img.alt }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Card Footer -->
        <div class="mt-10 pt-4 border-t border-border-paper flex items-center justify-between text-xs text-ink-muted">
          <div class="flex items-center gap-2">
            <span class="w-5 h-5 seal-badge text-[10px]">印</span>
            <span class="font-serif text-ink-muted">yuki's stop</span>
          </div>

          <div class="flex items-center gap-4">
            <a
              :href="postUrl"
              class="hover:text-seal transition-colors font-serif no-underline text-ink-muted flex items-center gap-1"
              title="前往文章详情页"
            >
              <span>全文</span>
              <span class="text-[10px]">→</span>
            </a>
            <button
              @click="copyPoem"
              class="hover:text-seal transition-colors font-serif"
            >
              {{ copied ? '已复制' : '复制' }}
            </button>
            <button
              @click="cardOpen = true"
              class="hover:text-seal transition-colors font-serif"
              title="把这一首生成笺纸卡片（可下载 / 复制成图片）"
            >
              卡片
            </button>
          </div>
        </div>
        </div>
      </Transition>
      </article>

      <!-- Navigation Arrow Right -->
      <button
        @click="nextPoem"
        class="hidden sm:flex absolute -right-12 top-52 sm:top-56 -translate-y-1/2 w-9 h-9 rounded-full border border-border-paper bg-surface/80 hover:bg-surface text-ink-muted hover:text-ink items-center justify-center transition-all shadow-paper z-10"
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

    <!-- Lightbox Modal (就地 fixed 定位，禁止 Teleport) -->
    <div
      v-if="isLightboxOpen && activeImage"
      class="fixed inset-0 z-50 flex flex-col items-center justify-between bg-black/90 backdrop-blur-md p-4 sm:p-6 select-none"
      @click.self="closeLightbox"
    >
      <!-- Top Action Bar -->
      <div class="w-full max-w-5xl flex items-center justify-between text-white/80 py-2">
        <div class="flex items-center gap-2 text-xs font-serif">
          <span class="w-2 h-2 rounded-full bg-seal"></span>
          <span>{{ currentPoem?.title }}</span>
          <span class="text-white/40">|</span>
          <span class="font-mono text-white/60">
            {{ activeImageIndex + 1 }} / {{ poemParsed.images.length }}
          </span>
        </div>

        <button
          @click="closeLightbox"
          class="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-serif text-white/90 transition-colors flex items-center gap-1.5"
          aria-label="关闭大图预览"
        >
          <span>✕</span>
          <span class="hidden sm:inline text-[11px] text-white/60">Esc</span>
        </button>
      </div>

      <!-- Main Stage with Image & Navigation -->
      <div class="relative w-full max-w-5xl flex-1 flex items-center justify-center min-h-0 py-2">
        <!-- Prev Button -->
        <button
          v-if="poemParsed.images.length > 1"
          @click="prevImage"
          class="absolute left-2 sm:left-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white border border-white/20 flex items-center justify-center transition-all text-xl"
          aria-label="上一张"
        >
          ‹
        </button>

        <img
          :src="activeImage.src"
          :alt="activeImage.alt"
          class="max-h-[75vh] max-w-[92vw] sm:max-w-[85vw] object-contain rounded-md shadow-2xl transition-all"
        />

        <!-- Next Button -->
        <button
          v-if="poemParsed.images.length > 1"
          @click="nextImage"
          class="absolute right-2 sm:right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-black/80 text-white/80 hover:text-white border border-white/20 flex items-center justify-center transition-all text-xl"
          aria-label="下一张"
        >
          ›
        </button>
      </div>

      <!-- Bottom Caption Bar -->
      <div class="w-full max-w-2xl text-center py-2 min-h-[2rem]">
        <p v-if="activeImage.alt" class="text-sm font-serif text-white/90 tracking-wider">
          {{ activeImage.alt }}
        </p>
      </div>
    </div>

    <!-- 笺纸卡片浮层：就地 fixed 定位（本项目禁止 Vue <Teleport>，见 AGENTS.md 坑点五），
         层级高于图片 lightbox 的 z-50。卡片本体与下载/复制逻辑复用 PoemCardPanel。 -->
    <div
      v-if="cardOpen && currentPoem"
      class="fixed inset-0 z-[150] flex items-start justify-center overflow-y-auto bg-black/60 p-4"
      @click.self="cardOpen = false"
    >
      <div class="paper-card w-full max-w-lg my-8 p-5">
        <div class="flex items-baseline justify-between mb-3">
          <h3 class="font-serif text-sm text-ink">笺纸卡片 · {{ currentPoem.title }}</h3>
          <button
            type="button"
            class="text-xs font-serif text-ink-muted hover:text-ink transition-colors"
            @click="cardOpen = false"
          >
            关闭
          </button>
        </div>
        <PoemCardPanel
          :title="currentPoem.title"
          :groups="cardGroups"
          :date="currentPoem.date"
          :tags="cardTags"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import PoemCardPanel from './PoemCardPanel.vue';
import { splitGroupsFromHtml } from '../utils/poem-card.js';

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
// 笺纸卡片浮层开关（卡片本体是 PoemCardPanel）
const cardOpen = ref(false);

// Lightbox state
const isLightboxOpen = ref(false);
const activeImageIndex = ref(0);
const failedImages = ref(new Set());

const categories = ['全部', '诗', '词', '诗词'];
const popularTags = ['全部', '七绝', '七律', '五律', '词'];

const selectCategory = (cat) => {
  selectedCategory.value = cat;
  currentIndex.value = 0;
  closeLightbox();
};

const selectTag = (tag) => {
  selectedTag.value = tag;
  currentIndex.value = 0;
  closeLightbox();
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

// 水印根据体裁动态显示「詩」或「詞」
const watermarkText = computed(() => {
  if (!currentPoem.value) return '詞';
  const cats = currentPoem.value.categories || [];
  return cats.includes('诗') ? '詩' : '詞';
});

// 文章详情页链接
const postUrl = computed(() => {
  if (!currentPoem.value) return '/poems';
  const slug = currentPoem.value.slug || currentPoem.value.title?.replace(/\s+/g, '-');
  return `/posts/${encodeURIComponent(slug)}/`;
});

// 分离诗词文本与附图
const poemParsed = computed(() => {
  if (!currentPoem.value || !currentPoem.value.content) {
    return { textHtml: '', images: [] };
  }
  const raw = currentPoem.value.content;
  const images = [];

  // 1. 匹配 HTML <img>
  const imgTagRegex = /<img\b([^>]*?)(\/?>)/gi;
  let match;
  while ((match = imgTagRegex.exec(raw)) !== null) {
    const attrs = match[1];
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    if (srcMatch && srcMatch[1]) {
      images.push({
        src: srcMatch[1],
        alt: altMatch ? altMatch[1] : '',
      });
    }
  }

  // 2. 匹配 Markdown ![alt](url)
  const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = mdImgRegex.exec(raw)) !== null) {
    images.push({
      alt: match[1] || '',
      src: match[2].trim(),
    });
  }

  // 3. 清理正文中的图片标签、多余 br 与空 p 标签
  let cleanHtml = raw
    .replace(/<img\b[^>]*\/?>/gi, '')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '')
    .replace(/(<br\s*\/?>\s*)+(?=<\/p>)/gi, '')
    .replace(/<p>\s*(<br\s*\/?>\s*)*<\/p>/gi, '')
    .trim();

  return { textHtml: cleanHtml, images };
});

// 笺纸卡片用的竖排组：诗词墙的数据是 HTML（<p>/<br>），故走 splitGroupsFromHtml
const cardGroups = computed(() => splitGroupsFromHtml(poemParsed.value.textHtml));
const cardTags = computed(() => currentPoem.value?.tags || []);

const onImageError = (src) => {
  failedImages.value.add(src);
};

// Lightbox controls
const openLightbox = (index) => {
  activeImageIndex.value = index;
  isLightboxOpen.value = true;
};

const closeLightbox = () => {
  isLightboxOpen.value = false;
};

const activeImage = computed(() => {
  const imgs = poemParsed.value.images;
  if (imgs.length === 0) return null;
  return imgs[activeImageIndex.value] || imgs[0];
});

const nextImage = () => {
  const total = poemParsed.value.images.length;
  if (total <= 1) return;
  activeImageIndex.value = (activeImageIndex.value + 1) % total;
};

const prevImage = () => {
  const total = poemParsed.value.images.length;
  if (total <= 1) return;
  activeImageIndex.value = (activeImageIndex.value - 1 + total) % total;
};

// Poem navigation
const nextPoem = () => {
  closeLightbox();
  if (currentIndex.value < filteredPoems.value.length - 1) {
    currentIndex.value++;
  } else {
    currentIndex.value = 0;
  }
};

const prevPoem = () => {
  closeLightbox();
  if (currentIndex.value > 0) {
    currentIndex.value--;
  } else {
    currentIndex.value = filteredPoems.value.length - 1;
  }
};

const randomPoem = () => {
  closeLightbox();
  if (filteredPoems.value.length < 2) return;
  let r;
  do {
    r = Math.floor(Math.random() * filteredPoems.value.length);
  } while (r === currentIndex.value);
  currentIndex.value = r;
};

const copyPoem = () => {
  if (!currentPoem.value) return;
  // Convert HTML content into clean plain text (excluding images)
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = poemParsed.value.textHtml;
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
  if (isLightboxOpen.value) {
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'ArrowRight') nextImage();
    return;
  }
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

<style scoped>
.poem-fade-enter-active,
.poem-fade-leave-active {
  transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.poem-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.poem-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
