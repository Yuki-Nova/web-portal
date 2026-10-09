<template>
  <!--
    Task 5.1 的「飘雪开关」：页脚里的极简微图标。
    状态存在 localStorage['yuki-snow']（见 src/scripts/snow-state.js），
    默认开启；系统开启「减弱动效」时图标会显式提示飘雪已暂停，不假装可用。
  -->
  <button
    type="button"
    class="snow-toggle"
    :class="{ 'is-on': enabled, 'is-paused': paused }"
    :aria-pressed="enabled"
    :title="title"
    @click="toggle"
  >
    <svg
      class="snow-toggle__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" />
      <path d="M12 6.6l2-2M12 6.6l-2-2M12 17.4l2 2M12 17.4l-2 2" />
    </svg>
    <span class="snow-toggle__label">飘雪</span>
  </button>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { REDUCED_MOTION_QUERY, prefersReducedMotion, watchMedia } from '../scripts/motion.js';
import { setSnowEnabled, snowEnabled } from '../scripts/snow-state.js';

const enabled = ref(true);
const paused = ref(false);

const title = computed(() => {
  if (paused.value) return '系统已开启「减弱动效」，飘雪暂停';
  return enabled.value ? '关闭飘雪' : '开启飘雪';
});

function toggle() {
  enabled.value = !enabled.value;
  setSnowEnabled(enabled.value);
}

onMounted(() => {
  enabled.value = snowEnabled();
  paused.value = prefersReducedMotion();
  // 系统偏好可随时改变，提示文案要跟着走（否则会显示成「可开启」但实际不会下雪）
  watchMedia(REDUCED_MOTION_QUERY, (matches) => {
    paused.value = matches;
  });
});
</script>

<style scoped>
.snow-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  color: var(--color-ink-faint);
  font-family: var(--font-sans);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.snow-toggle:hover {
  color: var(--color-ink-muted);
  border-color: var(--color-border);
}

.snow-toggle:focus-visible {
  outline: 1px solid var(--color-seal);
  outline-offset: 1px;
}

.snow-toggle.is-on {
  color: var(--color-seal);
  border-color: var(--color-seal-border);
  background-color: var(--color-seal-soft);
}

.snow-toggle.is-paused {
  opacity: 0.6;
}

.snow-toggle__icon {
  width: 12px;
  height: 12px;
}

/* 关闭态：图标略暗、斜线感更弱 */
.snow-toggle:not(.is-on) .snow-toggle__icon {
  opacity: 0.55;
}

@media (prefers-reduced-motion: reduce) {
  .snow-toggle {
    transition: none;
  }
}
</style>
