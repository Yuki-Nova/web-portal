<template>
  <div class="space-y-3">
    <img
      :src="imageUrl"
      alt="笺纸卡片预览"
      class="w-full rounded-md border border-border-paper shadow-paper"
    />
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="px-3 py-1.5 rounded-md border border-seal/30 bg-seal/5 text-xs font-serif text-seal hover:bg-seal/10 transition-colors"
        @click="download"
      >
        下载 PNG
      </button>
      <button
        type="button"
        class="px-3 py-1.5 rounded-md border border-border-paper text-xs font-serif text-ink-muted hover:text-ink transition-colors"
        @click="copy"
      >
        复制图片
      </button>
      <!-- 父组件放「收起 / 关闭」之类的收尾按钮 -->
      <slot name="actions" />
    </div>
    <p
      v-if="hint"
      class="text-[11px] font-serif"
      :class="hintError ? 'text-red-700 dark:text-red-400' : 'text-ink-muted'"
    >
      {{ hint }}
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { renderPoemCard, canvasToPngBlob } from '../utils/poem-card.js';

/**
 * 笺纸卡片「预览 + 下载 + 复制」面板（无自己触发按钮，由父组件决定何时显示）。
 *
 * 两个入口共用它：文章详情页（就地展开，`PoemCardExport.vue`）与诗词墙
 * （`PoetryWall.vue` 的浮层）。渲染逻辑全在 `utils/poem-card.js`。
 *
 * 「复制图片」依赖 ClipboardItem + navigator.clipboard.write，需要安全上下文
 * （https 或 localhost）。不可用时如实提示并让用户改用下载，不静默失败。
 */
const props = defineProps({
  title: { type: String, default: '' },
  /** 竖排正文：外层是原诗的行，内层是按标点断出的短列 */
  groups: { type: Array, default: () => [] },
  date: { type: String, default: '' },
  tags: { type: Array, default: () => [] },
});

const imageUrl = ref('');
const hint = ref('');
const hintError = ref(false);
let pngBlob = null;

function drawCard() {
  return renderPoemCard({
    title: props.title,
    groups: props.groups,
    date: props.date,
    tags: props.tags,
  });
}

function generate() {
  const canvas = drawCard();
  imageUrl.value = canvas.toDataURL('image/png');
  hint.value = '';
  hintError.value = false;
  pngBlob = null;
  canvasToPngBlob(canvas)
    .then((blob) => {
      pngBlob = blob;
    })
    .catch(() => {
      pngBlob = null;
    });
}

function download() {
  if (!imageUrl.value) return;
  const a = document.createElement('a');
  a.href = imageUrl.value;
  a.download = `${props.title || 'poem'}-笺纸卡片.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copy() {
  try {
    if (!pngBlob) pngBlob = await canvasToPngBlob(drawCard());
    if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
      throw new Error('当前浏览器不支持图片剪贴板');
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    hint.value = '已复制到剪贴板，可直接粘贴分享。';
    hintError.value = false;
  } catch (err) {
    hint.value = `复制失败（${err.message}），请改用「下载 PNG」。`;
    hintError.value = true;
  }
}

onMounted(generate);

// 诗词墙切到别的诗时，浮层里的卡片要跟着重画（groups 每次都是新数组）
watch(() => props.groups, generate);
watch(() => props.title, generate);
</script>
