/**
 * Task 1.2 水墨游丝笔触光标（Ink Trail Cursor）
 *
 * 表现：指针跟随一枚极小墨点，移动时身后拖曳出 15~20 节水墨游丝，越接近笔尖越粗越浓，
 *       停止移动后逐渐淡出收回；悬停在链接/按钮/卡片上时，墨点平滑展开为朱砂方印轮廓。
 *
 * 设计取舍（用户已确认）：
 *   - **保留系统原生光标**，游丝只作为拖尾装饰，不影响文本选择、输入框定位与无障碍；
 *   - 只在精细指针设备加载，触屏与 prefers-reduced-motion 下不创建 canvas；
 *   - 单一 rAF 循环，document.hidden 时由 motion.js 自动停帧；
 *   - canvas 挂在 body 末尾（项目禁止 <Teleport>），换页被替换后在下一帧自动补挂。
 */
import {
  createRafLoop,
  cssRgb,
  decorationEnabled,
  fitCanvas,
  injectStyle,
  onPageLoad,
  themeKey,
  watchDecoration,
} from './motion.js';

const STYLE_ID = 'shiro-ink-cursor-style';
const CANVAS_ID = 'shiro-ink-cursor';
/** 游丝节数（需求区间 15~20） */
const TRAIL_MAX = 18;
/** 单节游丝的存活时长（ms）——按时间衰减，与刷新率无关 */
const TRAIL_LIFE_MS = 420;
/** 追加轨迹点的最小位移（px），避免静止时把点堆在原地 */
const TRAIL_MIN_STEP = 1.2;
/** 墨点跟随插值系数（按 60fps 标定，实际按帧间隔换算）：越大越跟手 */
const HEAD_SMOOTHING = 0.4;
/** 60fps 的基准帧间隔（ms） */
const BASE_FRAME_MS = 1000 / 60;
/** 悬停可交互元素时的朱砂方印边长（过大反而显得像页面上的红框） */
const SEAL_SIZE = 14;
/** 判定「可交互」的命中范围 */
const HOVER_SELECTOR = [
  'a',
  'button',
  '[role="button"]',
  'summary',
  'label',
  'input',
  'textarea',
  'select',
  '.paper-card',
].join(', ');

const CSS = `
#${CANVAS_ID} {
  position: fixed;
  inset: 0;
  pointer-events: none;
  /* 高于全部弹层（z-150）与吸顶导航（z-50）：无论指针在哪，游丝反馈都连续 */
  z-index: 160;
}
@media (prefers-reduced-motion: reduce) {
  #${CANVAS_ID} { display: none; }
}
`;

const state = {
  /** 真实指针位置 */
  x: 0,
  y: 0,
  /** 平滑后的墨点位置 */
  headX: 0,
  headY: 0,
  /** 指针是否在窗口内 */
  seen: false,
  /** 是否悬停在可交互元素上 */
  hovering: false,
  /** 游丝点：{ x, y, a }，a 为剩余透明度 */
  trail: [],
  /** 最近一次追加轨迹点的位置（与 trail 是否被清空无关，防止空数组时每帧补推） */
  lastPushX: Number.NaN,
  lastPushY: Number.NaN,
  /** 取色缓存：{ theme, ink, seal } */
  palette: null,
};

let canvas = null;
let ctx = null;
let loop = null;
let listening = false;
/** 上一帧时间戳，用于把位移与衰减换算成与刷新率无关的量 */
let lastFrameAt = 0;

/** 读取当前主题下的墨色与朱砂色，只在主题切换时刷新。 */
function palette() {
  const theme = themeKey();
  if (!state.palette || state.palette.theme !== theme) {
    state.palette = {
      theme,
      ink: cssRgb('--color-ink-rgb', 1),
      seal: cssRgb('--color-seal-rgb', 1),
    };
  }
  return state.palette;
}

/** 确保 canvas 存在且尺寸正确（换页后 body 子节点被替换时补挂）。 */
function ensureCanvas() {
  if (canvas && canvas.isConnected) return;

  let element = document.getElementById(CANVAS_ID);
  if (!element) {
    element = document.createElement('canvas');
    element.id = CANVAS_ID;
    element.setAttribute('aria-hidden', 'true');
    document.body.appendChild(element);
  }
  canvas = element;
  ctx = fitCanvas(canvas);
}

function onPointerMove(event) {
  if (event.pointerType === 'touch') return;

  state.x = event.clientX;
  state.y = event.clientY;

  if (!state.seen) {
    state.seen = true;
    state.headX = state.x;
    state.headY = state.y;
  }

  const target = event.target;
  state.hovering = target instanceof Element ? Boolean(target.closest(HOVER_SELECTOR)) : false;
}

function onPointerGone() {
  state.seen = false;
  state.hovering = false;
}

function onResize() {
  if (canvas && canvas.isConnected) ctx = fitCanvas(canvas);
}

function step(now) {
  ensureCanvas();
  if (!ctx) return;

  const width = window.innerWidth;
  const height = window.innerHeight;
  const colors = palette();

  // 帧间隔换算：高刷屏（145Hz）与 60Hz 上的观感必须一致，
  // 因此位移、平滑、衰减全部按「等效 60fps 帧数」计算，并夹住后台切回的巨帧。
  const dt = lastFrameAt ? Math.min(now - lastFrameAt, 64) : BASE_FRAME_MS;
  lastFrameAt = now;
  const frames = dt / BASE_FRAME_MS;
  const decay = dt / TRAIL_LIFE_MS;

  ctx.clearRect(0, 0, width, height);

  // 墨点平滑跟随（指数插值：越接近目标越慢，形成收笔的减速感）
  const easing = 1 - Math.pow(1 - HEAD_SMOOTHING, frames);
  state.headX += (state.x - state.headX) * easing;
  state.headY += (state.y - state.headY) * easing;

  // 追加轨迹点：与「上一次追加的位置」比较，而不是与数组末项——
  // 否则数组被清空后会因为缺少末项而每帧补推一个点，游丝永远收不干净。
  if (
    state.seen &&
    (!Number.isFinite(state.lastPushX) ||
      Math.hypot(state.headX - state.lastPushX, state.headY - state.lastPushY) > TRAIL_MIN_STEP)
  ) {
    state.trail.push({ x: state.headX, y: state.headY, a: 1 });
    state.lastPushX = state.headX;
    state.lastPushY = state.headY;
    if (state.trail.length > TRAIL_MAX) state.trail.shift();
  }

  // 透明度按时间衰减 + 回收
  for (let i = state.trail.length - 1; i >= 0; i -= 1) {
    state.trail[i].a -= decay;
    if (state.trail[i].a <= 0.02) state.trail.splice(i, 1);
  }

  // 游丝：越靠近笔尖越粗越浓
  const total = state.trail.length;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 1; i < total; i += 1) {
    const prev = state.trail[i - 1];
    const cur = state.trail[i];
    const t = i / total;

    ctx.globalAlpha = Math.max(0, cur.a * t * 0.5);
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 0.6 + 3.4 * t;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(cur.x, cur.y);
    ctx.stroke();
  }

  // 笔尖形态
  if (state.seen) {
    if (state.hovering) {
      // 悬停可交互元素：朱砂方印轮廓（克制版，只作光标形态提示）
      const half = SEAL_SIZE / 2;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = colors.seal;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(state.headX - half, state.headY - half, SEAL_SIZE, SEAL_SIZE, 3);
      } else {
        ctx.rect(state.headX - half, state.headY - half, SEAL_SIZE, SEAL_SIZE);
      }
      ctx.stroke();
    } else {
      // 常规：小墨点
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = colors.ink;
      ctx.beginPath();
      ctx.arc(state.headX, state.headY, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
  window.__shiroInkCursor = {
    active: listening,
    hovering: state.hovering,
    points: state.trail.length,
  };
}

function enable() {
  if (listening) return;
  listening = true;

  injectStyle(STYLE_ID, CSS);
  ensureCanvas();

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('resize', onResize);
  document.addEventListener('pointerleave', onPointerGone);

  if (!loop) loop = createRafLoop(step);
  loop.start();
}

function disable() {
  if (!listening) return;
  listening = false;

  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('resize', onResize);
  document.removeEventListener('pointerleave', onPointerGone);

  if (loop) loop.stop();

  state.trail = [];
  state.seen = false;
  state.hovering = false;
  state.lastPushX = Number.NaN;
  state.lastPushY = Number.NaN;
  lastFrameAt = 0;
  if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // 关闭时连节点一起摘掉：不留一个永远空白的全屏 canvas 在 DOM 里
  if (canvas && canvas.isConnected) canvas.remove();
  canvas = null;
  ctx = null;

  window.__shiroInkCursor = { active: false, hovering: false, points: 0 };
}

onPageLoad(() => {
  if (decorationEnabled()) enable();
  else disable();
});

// 用户中途切换系统偏好时实时生效。
// 必须拆开订阅两条媒体查询——合并写法收不到 change 事件，见 motion.js 的 watchDecoration。
watchDecoration((enabled) => {
  if (enabled) enable();
  else disable();
});
