<template>
  <!--
    Task 4.1 朱砂印阅读进度指示器。
    固定于文章页右下角：印章内朱砂墨汁随滚动百分比自下而上注入，点击平滑回顶并落章一按。
    z-40 —— 低于吸顶导航（z-50）与各类弹层，不与它们争层级。
  -->
  <button
    type="button"
    class="reading-seal"
    :class="{ 'is-visible': visible, 'is-stamping': stamping }"
    :style="{ '--seal-progress': progress }"
    :data-progress="percent"
    :aria-label="`阅读进度 ${percent}%，点击回到顶部`"
    title="回顶"
    @click="backToTop"
  >
    <span class="reading-seal__ink" aria-hidden="true"></span>
    <span class="reading-seal__glyph" aria-hidden="true">顶</span>
  </button>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

/** 阅读进度 0~1 */
const progress = ref(0);
/** 顶部时隐藏，向下滚动一小段才浮现 */
const visible = ref(false);
/** 点击后的落章按压动画标记 */
const stamping = ref(false);

const percent = computed(() => Math.round(progress.value * 100));

let frameId = 0;
let stampTimer = 0;

function measure() {
  frameId = 0;
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  progress.value = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  visible.value = window.scrollY > 120;
}

function onScroll() {
  // 滚动事件频率极高，统一收敛到每帧一次计算
  if (frameId) return;
  frameId = window.requestAnimationFrame(measure);
}

function backToTop() {
  let reduceMotion = false;
  try {
    reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) {
    reduceMotion = false;
  }
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });

  stamping.value = true;
  window.clearTimeout(stampTimer);
  stampTimer = window.setTimeout(() => {
    stamping.value = false;
  }, 340);
}

onMounted(() => {
  measure();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
  if (frameId) window.cancelAnimationFrame(frameId);
  window.clearTimeout(stampTimer);
});
</script>

<style scoped>
.reading-seal {
  position: fixed;
  right: 1.25rem;
  bottom: 1.5rem;
  z-index: 40;
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--color-seal-border);
  border-radius: 6px;
  background-color: var(--color-seal-soft);
  cursor: pointer;
  box-shadow: var(--shadow-paper);
  opacity: 0;
  transform: translateY(8px);
  pointer-events: none;
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (min-width: 640px) {
  .reading-seal {
    right: 1.75rem;
    bottom: 2rem;
  }
}

.reading-seal.is-visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.reading-seal:hover {
  border-color: var(--color-seal);
}

.reading-seal:focus-visible {
  outline: 1px solid var(--color-seal);
  outline-offset: 2px;
}

/* 朱砂墨汁：高度即阅读百分比 */
.reading-seal__ink {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(var(--seal-progress, 0) * 100%);
  background-color: rgb(var(--color-seal-rgb) / 0.22);
  border-top: 1px solid rgb(var(--color-seal-rgb) / 0.45);
  transition: height 0.12s linear;
}

.reading-seal__glyph {
  position: relative;
  font-family: var(--font-serif);
  font-size: 20px;
  line-height: 1;
  font-weight: 600;
  color: var(--color-seal);
  user-select: none;
}

/* 点击回顶时的落章按压 */
.reading-seal.is-stamping {
  animation: reading-seal-press 0.34s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes reading-seal-press {
  0% { transform: scale(1); }
  35% { transform: scale(0.9); }
  100% { transform: scale(1); }
}

@media (prefers-reduced-motion: reduce) {
  .reading-seal,
  .reading-seal.is-visible {
    transform: none;
    transition: opacity 0.15s linear;
  }
  .reading-seal__ink {
    transition: none;
  }
  .reading-seal.is-stamping {
    animation: none;
  }
}
</style>
