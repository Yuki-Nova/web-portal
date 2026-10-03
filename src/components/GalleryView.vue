<template>
  <div class="gallery-container">
    <!-- Top Action Toolbar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
      <!-- Categories Filter Tabs -->
      <div class="flex flex-wrap items-center gap-1.5 font-serif text-xs">
        <button
          v-for="cat in availableCategories"
          :key="cat"
          @click="activeCategory = cat; currentPage = 1"
          class="px-3 py-1.5 rounded-full transition-all duration-200"
          :class="
            activeCategory === cat
              ? 'bg-seal text-white font-medium shadow-sm'
              : 'bg-black/5 dark:bg-white/5 text-ink-muted hover:text-ink hover:bg-black/10 dark:hover:bg-white/10'
          "
        >
          {{ cat }}
          <span class="opacity-60 text-[10px] ml-0.5">({{ getCategoryCount(cat) }})</span>
        </button>
      </div>

      <!-- Right controls: Sync from OSS & Count -->
      <div class="flex items-center gap-3 self-end sm:self-auto">
        <button
          @click="fetchLiveImages()"
          :disabled="syncing"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-serif text-ink-muted hover:text-seal border border-border-paper hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          title="从阿里云 OSS 实时获取最新增减图片"
        >
          <span :class="{ 'animate-spin': syncing }">⟳</span>
          <span>{{ syncing ? '正在连接 OSS...' : '实时同步' }}</span>
        </button>

        <span class="text-xs font-mono text-ink-muted">
          共 {{ filteredImages.length }} 幅影像
        </span>
      </div>
    </div>

    <!-- Notification Toast -->
    <div
      v-if="toastMessage"
      class="fixed bottom-6 right-6 z-[110] px-4 py-2.5 rounded-lg shadow-xl text-xs font-serif transition-all transform duration-300"
      :class="toastType === 'error' ? 'bg-red-800 text-white' : 'bg-seal text-white'"
    >
      {{ toastMessage }}
    </div>

    <!-- Image Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      <div
        v-for="(img, idx) in paginatedImages"
        :key="img.key"
        @click="openLightbox(idx)"
        class="paper-card group relative aspect-square overflow-hidden cursor-pointer bg-surface/50 border border-border-paper"
      >
        <img
          :src="img.thumb || img.url"
          :alt="img.name"
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />

        <!-- Hover Overlay -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3 text-white"
        >
          <span class="text-xs font-serif font-medium truncate">{{ img.name }}</span>
          <div class="flex items-center justify-between mt-1 text-[10px] text-white/70 font-mono">
            <span class="px-1.5 py-0.5 rounded bg-white/20 text-white">{{ img.category }}</span>
            <span>{{ formatDate(img.time) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="filteredImages.length === 0" class="paper-card p-12 text-center text-ink-muted font-serif my-8">
      当前分类暂无影像作品
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 mt-10 text-xs font-sans">
      <button
        @click="currentPage > 1 && (currentPage--)"
        :disabled="currentPage === 1"
        class="px-3 py-1.5 rounded-md border border-border-paper text-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        上一页
      </button>
      <span class="text-ink-muted font-mono">{{ currentPage }} / {{ totalPages }}</span>
      <button
        @click="currentPage < totalPages && (currentPage++)"
        :disabled="currentPage === totalPages"
        class="px-3 py-1.5 rounded-md border border-border-paper text-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        下一页
      </button>
    </div>

    <!-- Darkroom Lightbox Modal -->
    <Teleport to="body">
      <div
        v-if="lightboxOpen"
        class="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 transition-all duration-300"
        @keydown.esc="closeLightbox"
        tabindex="0"
        ref="lightboxRef"
      >
        <!-- Top Toolbar -->
        <div class="flex items-center justify-between text-white/80 text-xs font-serif">
          <div class="flex items-center gap-2">
            <span class="seal-badge px-1.5 py-0.5 text-[10px]">展</span>
            <span class="font-mono text-white/60">{{ activeIndex + 1 }} / {{ filteredImages.length }}</span>
            <span class="hidden sm:inline opacity-40">·</span>
            <span class="hidden sm:inline font-mono truncate max-w-xs">{{ currentImage?.name }}</span>
          </div>

          <div class="flex items-center gap-2 sm:gap-3">
            <button
              @click="copyMarkdown(currentImage)"
              class="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] transition-colors"
            >
              {{ copied ? '已复制！' : '复制 Markdown' }}
            </button>
            <a
              :href="currentImage?.url"
              target="_blank"
              rel="noopener noreferrer"
              class="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[11px] transition-colors"
            >
              原图 ↗
            </a>
            <button
              @click="closeLightbox"
              class="p-1.5 rounded hover:bg-white/15 text-white/70 hover:text-white transition-colors text-lg leading-none"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        </div>

        <!-- Stage: Image & Navigation -->
        <div class="relative flex-1 flex items-center justify-center my-2 overflow-hidden select-none">
          <!-- Previous Button -->
          <button
            @click="prevImage"
            class="absolute left-2 sm:left-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl flex items-center justify-center transition-colors"
            aria-label="上一张"
          >
            ‹
          </button>

          <!-- Current Image -->
          <img
            :src="currentImage?.url"
            :alt="currentImage?.name"
            class="max-h-[75vh] max-w-full object-contain rounded shadow-2xl transition-transform duration-300"
          />

          <!-- Next Button -->
          <button
            @click="nextImage"
            class="absolute right-2 sm:right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white text-xl flex items-center justify-center transition-colors"
            aria-label="下一张"
          >
            ›
          </button>
        </div>

        <!-- Bottom Action Bar (Category Edit & Delete from OSS) -->
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-white/70 text-xs font-serif border-t border-white/10 pt-3">
          <!-- Category Editor -->
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <span class="text-white/50 text-[11px]">分类：</span>
            <input
              type="text"
              v-model="editCategoryText"
              placeholder="输入分类标签"
              class="px-2 py-1 rounded bg-white/10 border border-white/20 text-white text-xs placeholder-white/40 focus:outline-none focus:border-seal w-32"
            />
            <button
              @click="saveCategory"
              :disabled="savingCategory"
              class="px-2.5 py-1 rounded bg-seal hover:bg-seal/90 text-white text-[11px] transition-colors"
            >
              {{ savingCategory ? '保存中...' : '保存分类' }}
            </button>
          </div>

          <!-- Delete from OSS button -->
          <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <button
              @click="confirmDelete"
              :disabled="deleting"
              class="px-2.5 py-1 rounded bg-red-950/80 hover:bg-red-800 text-red-200 border border-red-800/60 text-[11px] transition-colors"
            >
              {{ deleting ? '删除中...' : '🗑️ 删除此图' }}
            </button>

            <span class="text-[11px] text-white/40 hidden sm:inline">
              ← → 翻阅 · Esc 退出
            </span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Password Prompt Modal for Admin Operations -->
    <Teleport to="body">
      <div
        v-if="authModalOpen"
        class="fixed inset-0 z-[120] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <div class="paper-card p-6 max-w-sm w-full bg-surface border border-border-paper shadow-2xl">
          <h3 class="text-base font-serif font-bold text-ink mb-2">
            管理员鉴权认证
          </h3>
          <p class="text-xs text-ink-muted font-serif mb-4">
            该操作需要验证管理口令以授权修改或删除 OSS 文件。
          </p>

          <input
            type="password"
            v-model="adminPasswordInput"
            placeholder="请输入管理员密码"
            @keydown.enter="submitAuth"
            class="w-full px-3 py-2 text-sm rounded border border-border-paper bg-canvas text-ink mb-4 focus:outline-none focus:border-seal"
          />

          <div class="flex items-center justify-end gap-2 text-xs font-serif">
            <button
              @click="authModalOpen = false; pendingAction = null"
              class="px-3 py-1.5 rounded border border-border-paper text-ink-muted hover:text-ink"
            >
              取消
            </button>
            <button
              @click="submitAuth"
              class="px-3 py-1.5 rounded bg-seal text-white hover:opacity-90"
            >
              验证并执行
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';

const props = defineProps({
  images: {
    type: Array,
    required: true,
  },
});

// Live image collection state
const allImages = ref([...props.images]);
const activeCategory = ref('全部');
const currentPage = ref(1);
const pageSize = 24;

// Lightbox state
const lightboxOpen = ref(false);
const activeIndex = ref(0);
const copied = ref(false);
const lightboxRef = ref(null);

// Editing & Operations
const editCategoryText = ref('');
const savingCategory = ref(false);
const deleting = ref(false);
const syncing = ref(false);

// Auth Modal
const authModalOpen = ref(false);
const adminPasswordInput = ref('');
const pendingAction = ref(null); // 'saveCategory' | 'delete'

// Toast
const toastMessage = ref('');
const toastType = ref('success');
const showToast = (msg, type = 'success') => {
  toastMessage.value = msg;
  toastType.value = type;
  setTimeout(() => {
    toastMessage.value = '';
  }, 2500);
};

// Auth Token management
const getAuthToken = () => localStorage.getItem('gallery-token') || '';
const setAuthToken = (tok) => localStorage.setItem('gallery-token', tok);

// 从 OSS 服务端拉取最新图片清单（GET /api/images，生产由 nginx 反代到 images-server）
// silent=true 用于页面自动同步：后端未部署或不可达时静默退回构建期静态快照，
// 不打扰访客；仅用户手动点击「实时同步」时才给出失败提示。
const fetchLiveImages = async ({ silent = false } = {}) => {
  syncing.value = true;
  try {
    const res = await fetch('/api/images');
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.images)) {
        allImages.value = data.images;
        if (!silent) showToast(`已从 OSS 同步 ${data.images.length} 幅最新图片！`);
      } else if (!silent) {
        showToast('服务端返回数据格式异常', 'error');
      }
    } else if (!silent) {
      showToast('无法连接 OSS 服务端接口，当前展示静态快照', 'error');
    }
  } catch (e) {
    if (!silent) showToast('同步失败，请检查网络或后端服务', 'error');
  } finally {
    syncing.value = false;
  }
};

// Categories calculation
const availableCategories = computed(() => {
  const set = new Set();
  allImages.value.forEach((img) => {
    if (img.category) set.add(img.category);
  });
  return ['全部', ...Array.from(set)];
});

const getCategoryCount = (cat) => {
  if (cat === '全部') return allImages.value.length;
  return allImages.value.filter((img) => img.category === cat).length;
};

// Filtered images
const filteredImages = computed(() => {
  if (activeCategory.value === '全部') {
    return allImages.value;
  }
  return allImages.value.filter((img) => img.category === activeCategory.value);
});

// Paginated
const totalPages = computed(() => Math.ceil(filteredImages.value.length / pageSize) || 1);

const paginatedImages = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredImages.value.slice(start, start + pageSize);
});

const currentImage = computed(() => filteredImages.value[activeIndex.value]);

watch(currentImage, (newImg) => {
  if (newImg) {
    editCategoryText.value = newImg.category || '';
  }
});

const formatDate = (isoStr) => {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (e) {
    return '';
  }
};

const openLightbox = (pageIdx) => {
  const globalIdx = (currentPage.value - 1) * pageSize + pageIdx;
  activeIndex.value = globalIdx;
  editCategoryText.value = filteredImages.value[globalIdx]?.category || '';
  lightboxOpen.value = true;
  nextTick(() => {
    lightboxRef.value?.focus();
  });
};

const closeLightbox = () => {
  lightboxOpen.value = false;
};

const nextImage = () => {
  if (activeIndex.value < filteredImages.value.length - 1) {
    activeIndex.value++;
  } else {
    activeIndex.value = 0;
  }
};

const prevImage = () => {
  if (activeIndex.value > 0) {
    activeIndex.value--;
  } else {
    activeIndex.value = filteredImages.value.length - 1;
  }
};

const copyMarkdown = (img) => {
  if (!img) return;
  const md = `![${img.name}](${img.url})`;
  navigator.clipboard.writeText(md).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  });
};

// Submit Auth Token
const submitAuth = async () => {
  if (!adminPasswordInput.value) return;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPasswordInput.value }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        setAuthToken(data.token);
        authModalOpen.value = false;
        adminPasswordInput.value = '';
        showToast('认证成功！');
        // Execute pending action
        if (pendingAction.value === 'saveCategory') {
          doSaveCategory();
        } else if (pendingAction.value === 'delete') {
          doDelete();
        }
        pendingAction.value = null;
        return;
      }
    }
    showToast('密码错误，认证失败', 'error');
  } catch (e) {
    showToast('认证网络异常', 'error');
  }
};

// Save Category
const saveCategory = () => {
  if (!getAuthToken()) {
    pendingAction.value = 'saveCategory';
    authModalOpen.value = true;
    return;
  }
  doSaveCategory();
};

const doSaveCategory = async () => {
  if (!currentImage.value) return;
  savingCategory.value = true;
  const newCat = editCategoryText.value.trim() || '未分类';

  try {
    // Read all categories or send single map
    const payload = { [currentImage.value.key]: newCat };
    const res = await fetch('/api/categories', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': getAuthToken(),
      },
      body: JSON.stringify({ categories: payload }),
    });

    if (res.status === 401) {
      setAuthToken('');
      pendingAction.value = 'saveCategory';
      authModalOpen.value = true;
      return;
    }

    if (res.ok) {
      currentImage.value.category = newCat;
      showToast('分类已成功更新保存！');
    } else {
      showToast('保存分类失败，请重试', 'error');
    }
  } catch (e) {
    showToast('网络请求失败', 'error');
  } finally {
    savingCategory.value = false;
  }
};

// Delete Image from OSS
const confirmDelete = () => {
  if (!confirm(`确定要从阿里云 OSS 彻底删除【${currentImage.value?.name}】吗？此操作不可逆！`)) {
    return;
  }
  if (!getAuthToken()) {
    pendingAction.value = 'delete';
    authModalOpen.value = true;
    return;
  }
  doDelete();
};

const doDelete = async () => {
  if (!currentImage.value) return;
  deleting.value = true;
  const keyToDelete = currentImage.value.key;

  try {
    const res = await fetch('/api/images', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': getAuthToken(),
      },
      body: JSON.stringify({ objectKey: keyToDelete }),
    });

    if (res.status === 401) {
      setAuthToken('');
      pendingAction.value = 'delete';
      authModalOpen.value = true;
      return;
    }

    if (res.ok) {
      // Remove from allImages
      allImages.value = allImages.value.filter((img) => img.key !== keyToDelete);
      showToast('已从阿里云 OSS 永久删除！');
      closeLightbox();
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || '删除失败，请检查权限', 'error');
    }
  } catch (e) {
    showToast('删除网络异常', 'error');
  } finally {
    deleting.value = false;
  }
};

const handleKeyDown = (e) => {
  if (authModalOpen.value) return;
  if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (!lightboxOpen.value) return;
  if (e.key === 'ArrowLeft') prevImage();
  if (e.key === 'ArrowRight') nextImage();
  if (e.key === 'Escape') closeLightbox();
};

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown);
  // 页面载入时静默尝试与 OSS 服务端对齐，失败则直接展示静态快照
  fetchLiveImages({ silent: true });
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown);
});
</script>
