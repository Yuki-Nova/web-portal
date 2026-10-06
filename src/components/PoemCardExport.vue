<template>
  <div class="mt-6">
    <button
      v-if="!imageUrl"
      type="button"
      class="px-4 py-2 rounded-md border border-seal/30 bg-seal/5 text-xs font-serif text-seal hover:bg-seal/10 transition-colors"
      @click="generate"
    >
      生成笺纸卡片
    </button>

    <div v-else class="space-y-3">
      <!-- 就地预览：本项目禁止 Vue <Teleport>（见 AGENTS.md 坑点一），因此不使用弹窗 -->
      <img
        :src="imageUrl"
        alt="笺纸卡片预览"
        class="w-full max-w-md rounded-md border border-border-paper shadow-paper"
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
        <button
          type="button"
          class="px-3 py-1.5 rounded-md text-xs font-serif text-ink-faint hover:text-ink-muted transition-colors"
          @click="reset"
        >
          收起
        </button>
      </div>
      <p v-if="hint" class="text-[11px] font-serif" :class="hintError ? 'text-red-700 dark:text-red-400' : 'text-ink-muted'">
        {{ hint }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { renderPoemCard, canvasToPngBlob } from '../utils/poem-card.js';

/**
 * 诗词笺纸卡片导出岛。
 *
 * 挂在文章详情页（posts/[slug].astro）正文下方，只传一小段数据（标题 + 竖排正文行 +
 * 日期/标签），不涉及大块数据内联的问题。渲染与导出逻辑都在 utils/poem-card.js。
 *
 * 「复制图片」依赖 ClipboardItem + navigator.clipboard.write，需要安全上下文
 * （https 或 localhost）。不可用时如实提示并让用户改用「下载 PNG」，不静默失败。
 */
const props = defineProps({
  title: { type: String, default: '' },
  /** 竖排正文：外层是原诗的行，内层是按标点断出的短列（见 utils/poem-card.js） */
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

function reset() {
  imageUrl.value = '';
  hint.value = '';
  pngBlob = null;
}
</script>
