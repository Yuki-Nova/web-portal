<template>
  <!--
    Task 3.1 拈阄·抽诗签挂件。
    首页右下角常驻一枚朱砂小签；点开后在原地 fixed 浮层里摇签抽句，
    可「前往品读 / 再拈一签 / 复制名句」。
    层级：触发按钮 z-60，浮层 z-140（低于搜索弹窗与卡片导出的 z-150）。
    项目禁止 <Teleport>，浮层就地 fixed —— 因此本组件必须挂在**没有 transform /
    filter / backdrop-filter 的祖先**下（首页那个 animate-fade-in 容器不能包它）。
  -->
  <button
    type="button"
    class="fortune-trigger seal-badge"
    :class="{ 'is-active': open }"
    aria-label="拈一签，随机读一句诗词"
    :aria-expanded="open"
    @click="openPanel"
  >
    <span class="fortune-trigger__glyph" aria-hidden="true">签</span>
  </button>

  <div v-if="open" class="fortune-layer">
    <!-- 遮罩独立一层，避免把 backdrop-blur 加到浮层祖先上 -->
    <div class="fortune-layer__backdrop" @click="close"></div>

    <section
      ref="panel"
      class="paper-card fortune-panel"
      :class="{ 'is-drawing': drawing }"
      role="dialog"
      aria-modal="false"
      aria-label="诗签"
      :data-slug="current ? current.slug : ''"
      :data-title="current ? current.title : ''"
    >
      <div class="fortune-panel__head">
        <span class="w-1.5 h-1.5 rounded-full bg-seal"></span>
        <span>拈阄 · 诗签</span>
        <button
          type="button"
          class="fortune-panel__close"
          aria-label="收起诗签"
          @click="close"
        >
          ×
        </button>
      </div>

      <div class="fortune-panel__body">
        <span class="fortune-panel__tube" aria-hidden="true">签</span>
        <p class="fortune-panel__quote">{{ current ? current.quote : '' }}</p>
        <p class="fortune-panel__source">《{{ current ? current.title : '' }}》</p>
      </div>

      <div class="fortune-panel__actions">
        <a
          class="fortune-btn fortune-btn--primary"
          :href="current ? `/posts/${encodeURIComponent(current.slug)}` : '#'"
          @click="close"
        >
          前往品读
        </a>
        <button type="button" class="fortune-btn" @click="draw">再拈一签</button>
        <button type="button" class="fortune-btn" @click="copyQuote">复制名句</button>
      </div>

      <p class="fortune-panel__tip" :class="tipTone" aria-live="polite">{{ tip }}</p>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps({
  /** [{ title, quote, slug }]，slug 由构建期按内容集合 post.id 注入 */
  poems: { type: Array, default: () => [] },
});

/** 浮层开关 */
const open = ref(false);
/** 摇签动画进行中 */
const drawing = ref(false);
/** 当前签面 */
const current = ref(null);
/** 底部提示文案与色调 */
const tip = ref('');
const tipTone = ref('');

let drawTimer = 0;
let tipTimer = 0;

/** 随机拈一签；尽量不与上一签重复 */
function pick() {
  const list = props.poems;
  if (!list.length) return null;
  if (list.length === 1) return list[0];

  let next = list[Math.floor(Math.random() * list.length)];
  let guard = 0;
  while (current.value && next.title === current.value.title && guard < 8) {
    next = list[Math.floor(Math.random() * list.length)];
    guard += 1;
  }
  return next;
}

/** 摇签：先收起旧签面，动画结束后换上新签 */
function draw() {
  if (!props.poems.length) {
    setTip('诗签数据为空', 'warn');
    return;
  }

  tip.value = '';
  tipTone.value = '';
  drawing.value = true;

  window.clearTimeout(drawTimer);
  drawTimer = window.setTimeout(() => {
    current.value = pick();
    drawing.value = false;
    // 供浏览器实测断言使用
    window.__shiroFortune = current.value ? { ...current.value } : null;
  }, 260);
}

function openPanel() {
  open.value = true;
  if (!current.value) draw();
}

function close() {
  open.value = false;
}

function setTip(text, tone = '') {
  tip.value = text;
  tipTone.value = tone;
  window.clearTimeout(tipTimer);
  tipTimer = window.setTimeout(() => {
    tip.value = '';
    tipTone.value = '';
  }, 2600);
}

/** 复制「名句 + 出处 + 链接」；失败时如实提示，不静默 */
async function copyQuote() {
  if (!current.value) return;

  const shareUrl = new URL(
    `/posts/${encodeURIComponent(current.value.slug)}`,
    window.location.origin
  ).href;
  const text = `${current.value.quote}\n——《${current.value.title}》\n${shareUrl}`;

  try {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
      throw new Error('clipboard unavailable');
    }
    await navigator.clipboard.writeText(text);
    setTip('已复制到剪贴板', 'ok');
  } catch (error) {
    setTip('复制失败（需 https 或 localhost），请手动选择', 'warn');
  }
}

function onKeydown(event) {
  if (event.key === 'Escape' && open.value) close();
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  window.clearTimeout(drawTimer);
  window.clearTimeout(tipTimer);
});
</script>

<style scoped>
/* ── 触发按钮：右下角常驻小签 ── */
.fortune-trigger {
  position: fixed;
  right: 1.25rem;
  bottom: 1.5rem;
  z-index: 60;
  width: 44px;
  height: 44px;
  padding: 0;
  cursor: pointer;
  box-shadow: var(--shadow-paper);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
}

@media (min-width: 640px) {
  .fortune-trigger {
    right: 1.75rem;
    bottom: 2rem;
  }
}

.fortune-trigger:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-paper-hover);
}

.fortune-trigger:focus-visible {
  outline: 1px solid var(--color-seal);
  outline-offset: 2px;
}

.fortune-trigger__glyph {
  font-family: var(--font-serif);
  font-size: 18px;
  line-height: 1;
  font-weight: 600;
}

/* ── 浮层 ── */
.fortune-layer {
  position: fixed;
  inset: 0;
  z-index: 140;
}

.fortune-layer__backdrop {
  position: absolute;
  inset: 0;
  background-color: rgb(0 0 0 / 0.22);
}

.fortune-panel {
  position: absolute;
  right: 1.25rem;
  bottom: 5.25rem;
  width: 19rem;
  max-width: calc(100vw - 2rem);
  padding: 1rem 1.15rem 0.9rem;
}

@media (min-width: 640px) {
  .fortune-panel {
    right: 1.75rem;
    bottom: 6rem;
  }
}

.fortune-panel__head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-serif);
  font-size: 0.75rem;
  color: var(--color-seal);
  border-bottom: 1px solid var(--color-border);
  padding-bottom: 0.6rem;
}

.fortune-panel__close {
  margin-left: auto;
  width: 1.25rem;
  height: 1.25rem;
  line-height: 1;
  font-size: 0.9rem;
  color: var(--color-ink-faint);
  background: none;
  border: none;
  cursor: pointer;
  border-radius: 3px;
}

.fortune-panel__close:hover {
  color: var(--color-ink);
  background-color: rgb(var(--color-ink-rgb) / 0.06);
}

.fortune-panel__body {
  position: relative;
  padding: 1.4rem 0 1.2rem;
  text-align: center;
}

.fortune-panel__tube {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  margin-bottom: 0.7rem;
  border: 1px solid var(--color-seal-border);
  border-radius: 3px;
  background-color: var(--color-seal-soft);
  color: var(--color-seal);
  font-family: var(--font-serif);
  font-size: 0.7rem;
}

.fortune-panel__quote {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.9;
  letter-spacing: 0.04em;
  color: var(--color-ink);
}

.fortune-panel__source {
  margin: 0.7rem 0 0;
  font-family: var(--font-serif);
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}

.fortune-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding-top: 0.8rem;
  border-top: 1px solid var(--color-border);
}

.fortune-btn {
  flex: 1 1 auto;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background-color: transparent;
  color: var(--color-ink-muted);
  font-family: var(--font-serif);
  font-size: 0.72rem;
  text-align: center;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.fortune-btn:hover {
  color: var(--color-seal);
  border-color: var(--color-seal-border);
  background-color: var(--color-seal-soft);
}

.fortune-btn--primary {
  color: var(--color-seal);
  border-color: var(--color-seal-border);
  background-color: var(--color-seal-soft);
}

.fortune-panel__tip {
  min-height: 1rem;
  margin: 0.6rem 0 0;
  font-size: 0.68rem;
  color: var(--color-ink-faint);
  text-align: center;
}

.fortune-panel__tip.ok {
  color: var(--color-success);
}

.fortune-panel__tip.warn {
  color: var(--color-danger);
}

/* ── 摇签动效：竹签轻摇，签面淡出淡入 ── */
.fortune-panel.is-drawing .fortune-panel__tube {
  animation: fortune-shake 0.26s ease-in-out 2;
}

.fortune-panel.is-drawing .fortune-panel__quote,
.fortune-panel.is-drawing .fortune-panel__source {
  opacity: 0.25;
  transition: opacity 0.12s linear;
}

.fortune-panel__quote,
.fortune-panel__source {
  transition: opacity 0.18s ease;
}

@keyframes fortune-shake {
  0%, 100% { transform: rotate(-7deg); }
  50% { transform: rotate(7deg); }
}

@media (prefers-reduced-motion: reduce) {
  .fortune-trigger:hover {
    transform: none;
  }
  .fortune-panel.is-drawing .fortune-panel__tube {
    animation: none;
  }
  .fortune-panel__quote,
  .fortune-panel__source {
    transition: none;
  }
}
</style>
