<template>
  <!--
    Task 5.1 随风碎雪粒子层。
    呼应站名 Yuki：全屏 fixed 背景 canvas，z-0 且 pointer-events 全关，
    正文（main / footer 的 relative z-10）压在其上，文字永远在雪之上。
    不接管鼠标事件，不遮挡任何可点击元素。
  -->
  <canvas ref="canvasEl" class="yuki-snow" aria-hidden="true"></canvas>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import {
  REDUCED_MOTION_QUERY,
  createRafLoop,
  cssRgb,
  fitCanvas,
  prefersReducedMotion,
  themeKey,
  watchMedia,
} from '../scripts/motion.js';
import { snowEnabled, subscribeSnow } from '../scripts/snow-state.js';

/** 粒子数（需求区间 35~45） */
const FLAKE_COUNT = 38;
/** 指针扰动半径（px） */
const WIND_RADIUS = 96;
/** 扰动强度系数 */
const WIND_STRENGTH = 0.9;
/** 60fps 的基准帧间隔（ms）：位移与衰减按等效帧数换算，保证高刷屏观感一致 */
const BASE_FRAME_MS = 1000 / 60;

const canvasEl = ref(null);

let ctx = null;
let loop = null;
let flakes = [];
let palette = null;
let unsubscribeSnow = null;
let running = false;
/** 上一帧时间戳（把速度换算成与刷新率无关的量） */
let lastFrameAt = 0;

/** 指针状态：位置 + 速度（用于「快速掠过」的推挤） */
const pointer = { x: -999, y: -999, vx: 0, vy: 0, has: false, lastX: 0, lastY: 0 };

/** 浏览器实测断言用的调试引用（对象引用保持不变，只更新字段） */
const debug = { active: false, count: 0, mode: 'light', sampleX: 0, sampleY: 0 };

/** 主题自适应取色：白昼为暖雪白（叠一道极淡墨边，否则在宣纸上看不见），夜间为月白。 */
function refreshPalette() {
  const dark = themeKey() === 'dark';
  palette = dark
    ? { theme: themeKey(), mode: 'dark', fill: cssRgb('--color-ink-rgb', 1), stroke: null }
    : {
        theme: themeKey(),
        mode: 'light',
        // 白昼态：纯白填充在 #f9f8f5 宣纸上是不可见的（2026-10-09 实测截图中完全看不出雪），
        // 必须靠一圈极淡墨边勾出轮廓，透明度不能太保守。
        fill: 'rgb(255 255 255)',
        stroke: cssRgb('--color-ink-rgb', 0.22),
      };
  debug.mode = palette.mode;
}

function createFlake(width, height, randomY = true) {
  const radius = 0.7 + Math.random() * 1.7;
  return {
    x: Math.random() * width,
    y: randomY ? Math.random() * height : -radius * 3,
    r: radius,
    // 大颗粒落得快一点，形成疏密层次
    vy: 0.18 + radius * 0.16,
    phase: Math.random() * Math.PI * 2,
    driftAmp: 0.25 + Math.random() * 0.5,
    alpha: 0.28 + Math.random() * 0.45,
    vx: 0,
  };
}

function step(now) {
  const canvas = canvasEl.value;
  if (!ctx || !canvas) return;

  const width = window.innerWidth;
  const height = window.innerHeight;

  if (!palette || palette.theme !== themeKey()) refreshPalette();

  ctx.clearRect(0, 0, width, height);

  const seconds = now / 1000;

  // 145Hz 与 60Hz 上雪的下落速度必须一致，故速度统一乘以「等效 60fps 帧数」；
  // 夹住上限避免从后台切回时一帧跳出屏幕。
  const dt = lastFrameAt ? Math.min(now - lastFrameAt, 64) : BASE_FRAME_MS;
  lastFrameAt = now;
  const frames = dt / BASE_FRAME_MS;

  // 指针速度自然衰减
  pointer.vx *= Math.pow(0.9, frames);
  pointer.vy *= Math.pow(0.9, frames);

  for (let i = 0; i < flakes.length; i += 1) {
    const flake = flakes[i];

    // 自然下落 + 横向随风摆动（正弦漂移）
    flake.y += flake.vy * frames;
    flake.x += Math.sin(seconds * 0.6 + flake.phase) * flake.driftAmp * frames;

    // 指针快速掠过时的物理排斥
    if (pointer.has) {
      const dx = flake.x - pointer.x;
      const dy = flake.y - pointer.y;
      const distance = Math.hypot(dx, dy);
      if (distance < WIND_RADIUS && distance > 0.001) {
        const falloff = 1 - distance / WIND_RADIUS;
        const speed = Math.hypot(pointer.vx, pointer.vy);
        flake.vx += (dx / distance) * falloff * WIND_STRENGTH * (0.5 + speed * 0.12) * frames;
        flake.y += (dy / distance) * falloff * 0.35 * frames;
      }
    }

    // 侧向速度衰减 + 位移
    flake.x += flake.vx * frames;
    flake.vx *= Math.pow(0.94, frames);

    // 出界回场
    if (flake.y - flake.r > height) {
      flake.y = -flake.r * 3;
      flake.x = Math.random() * width;
      flake.vx = 0;
    }
    if (flake.x < -4) flake.x = width + 4;
    else if (flake.x > width + 4) flake.x = -4;

    // 绘制
    ctx.globalAlpha = flake.alpha;
    ctx.fillStyle = palette.fill;
    ctx.beginPath();
    ctx.arc(flake.x, flake.y, flake.r, 0, Math.PI * 2);
    ctx.fill();

    if (palette.stroke) {
      // 描边单独的透明度：若沿用填充的 globalAlpha（0.28~0.73），
      // 0.22 的墨边会被再乘一次而降到不足 5%，等于没画。
      ctx.globalAlpha = Math.min(1, flake.alpha + 0.25);
      ctx.strokeStyle = palette.stroke;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;

  debug.count = flakes.length;
  if (flakes[0]) {
    debug.sampleX = Math.round(flakes[0].x);
    debug.sampleY = Math.round(flakes[0].y);
  }
}

function onPointerMove(event) {
  // 触屏不参与风场（手指按住时的抖动没有意义）
  if (event.pointerType === 'touch') return;

  if (pointer.has) {
    pointer.vx = event.clientX - pointer.lastX;
    pointer.vy = event.clientY - pointer.lastY;
  }
  pointer.lastX = event.clientX;
  pointer.lastY = event.clientY;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.has = true;
}

function onPointerGone() {
  pointer.has = false;
}

function onResize() {
  const canvas = canvasEl.value;
  if (!canvas) return;
  ctx = fitCanvas(canvas);
  const width = window.innerWidth;
  const height = window.innerHeight;
  flakes.forEach((flake) => {
    flake.x = Math.min(flake.x, width);
    flake.y = Math.min(flake.y, height);
  });
}

function start() {
  if (running) return;
  if (!snowEnabled() || prefersReducedMotion()) {
    debug.active = false;
    return;
  }

  const canvas = canvasEl.value;
  if (!canvas) return;

  refreshPalette();
  ctx = fitCanvas(canvas);

  if (!flakes.length) {
    flakes = Array.from({ length: FLAKE_COUNT }, () =>
      createFlake(window.innerWidth, window.innerHeight)
    );
  }

  if (!loop) loop = createRafLoop(step);
  running = true;
  debug.active = true;
  debug.count = flakes.length;
  loop.start();
}

function stop() {
  running = false;
  debug.active = false;
  if (loop) loop.stop();

  const canvas = canvasEl.value;
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

onMounted(() => {
  window.__shiroSnow = debug;

  start();

  // 页脚开关
  unsubscribeSnow = subscribeSnow((enabled) => {
    if (enabled) start();
    else stop();
  });

  // 系统偏好实时变化
  watchMedia(REDUCED_MOTION_QUERY, () => {
    if (prefersReducedMotion()) stop();
    else start();
  });

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerGone);
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(() => {
  if (unsubscribeSnow) unsubscribeSnow();
  window.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerleave', onPointerGone);
  window.removeEventListener('resize', onResize);
  if (loop) loop.dispose();
  loop = null;
  running = false;
});
</script>

<style scoped>
.yuki-snow {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .yuki-snow {
    display: none;
  }
}
</style>
