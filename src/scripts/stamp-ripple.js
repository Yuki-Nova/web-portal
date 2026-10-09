/**
 * Task 1.1 朱砂落印点击涟漪（Cinnabar Stamp Ripple）
 *
 * 表现：在页面空白处按下指针时，以光标为中心展开一圈极淡的朱砂波纹，
 *       并随机隐现一枚小印章篆字（雪 / 墨 / 诗 / 印 / 云），约 400ms 后自毁。
 *
 * 设计取舍：
 *   - 只用原生 DOM + CSS keyframes，不用 canvas（一次点击一个节点，开销可忽略）；
 *   - 点击发生在可交互元素上时**不触发**，避免与按钮/链接自身的点击反馈打架；
 *   - 120ms 节流，连点不会堆出一片红；
 *   - 触屏与 prefers-reduced-motion 下整体不注册监听（见 motion.js 的 decorationEnabled）。
 */
import { decorationEnabled, injectStyle, onPageLoad, watchDecoration } from './motion.js';

const STYLE_ID = 'shiro-stamp-ripple-style';
/** 印章篆字，随机取一枚 */
const SEALS = ['雪', '墨', '诗', '印', '云'];
/** 交互元素命中即跳过（这些位置留给控件自身的反馈） */
const SKIP_SELECTOR = [
  'a',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'summary',
  'label',
  '[role="button"]',
  '[role="link"]',
  '[contenteditable="true"]',
  '[data-no-ripple]',
].join(', ');
/** 连点节流窗口 */
const THROTTLE_MS = 120;
/** 单枚涟漪存活时长（含动画） */
const LIFE_MS = 400;

const CSS = `
.shiro-ripple {
  position: fixed;
  width: 0;
  height: 0;
  pointer-events: none;
  /* 低于吸顶导航（z-50）与各类弹层（z-100+），不会盖住任何交互面 */
  z-index: 45;
}
.shiro-ripple__ring {
  position: absolute;
  left: -7px;
  top: -7px;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  border: 1px solid rgb(var(--color-seal-rgb) / 0.32);
  background: radial-gradient(circle, rgb(var(--color-seal-rgb) / 0.14), rgb(var(--color-seal-rgb) / 0) 70%);
  animation: shiro-ripple-ring ${LIFE_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.shiro-ripple__seal {
  position: absolute;
  left: 7px;
  top: 7px;
  padding: 2px 3px;
  border: 1px solid rgb(var(--color-seal-rgb) / 0.28);
  border-radius: 2px;
  font-family: var(--font-serif, serif);
  font-size: 10px;
  line-height: 1;
  color: rgb(var(--color-seal-rgb) / 0.5);
  opacity: 0;
  animation: shiro-ripple-seal ${LIFE_MS}ms ease-out forwards;
}
@keyframes shiro-ripple-ring {
  from { transform: scale(0.35); opacity: 0.95; }
  to   { transform: scale(4.2);  opacity: 0; }
}
@keyframes shiro-ripple-seal {
  0%   { opacity: 0;   transform: scale(0.82) rotate(-6deg); }
  35%  { opacity: 0.9; }
  100% { opacity: 0;   transform: scale(1.02) rotate(-2deg); }
}
/* 系统要求减弱动效时彻底隐藏（JS 侧已不注册，这里再兜一层） */
@media (prefers-reduced-motion: reduce) {
  .shiro-ripple { display: none; }
}
`;

let lastSpawnAt = 0;
let bound = false;

/** 在指定视口坐标生成一枚涟漪，LIFE_MS 后移除节点。 */
function spawn(x, y) {
  const wrap = document.createElement('span');
  wrap.className = 'shiro-ripple';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.style.left = `${Math.round(x)}px`;
  wrap.style.top = `${Math.round(y)}px`;

  const ring = document.createElement('i');
  ring.className = 'shiro-ripple__ring';

  const seal = document.createElement('span');
  seal.className = 'shiro-ripple__seal';
  seal.textContent = SEALS[Math.floor(Math.random() * SEALS.length)];

  wrap.append(ring, seal);
  document.body.appendChild(wrap);

  // 供浏览器实测断言用的轻量计数（不影响逻辑）
  window.__shiroRippleCount = (window.__shiroRippleCount || 0) + 1;

  window.setTimeout(() => wrap.remove(), LIFE_MS + 30);
}

function onPointerDown(event) {
  if (event.button !== 0 || event.isPrimary === false) return;

  const target = event.target;
  if (target instanceof Element && target.closest(SKIP_SELECTOR)) return;

  const now = performance.now();
  if (now - lastSpawnAt < THROTTLE_MS) return;
  lastSpawnAt = now;

  spawn(event.clientX, event.clientY);
}

function enable() {
  if (bound) return;
  bound = true;
  injectStyle(STYLE_ID, CSS);
  document.addEventListener('pointerdown', onPointerDown, { passive: true });
}

function disable() {
  if (!bound) return;
  bound = false;
  document.removeEventListener('pointerdown', onPointerDown);
}

// 监听器挂在 document 上，模块只执行一次，换页后依然有效；
// onPageLoad 在这里只负责按当前设备/偏好重新判定开关。
onPageLoad(() => {
  if (decorationEnabled()) enable();
  else disable();
});

// 用户中途切换系统偏好（如打开减弱动效）时实时生效。
// 必须拆开订阅两条媒体查询——合并写法收不到 change 事件，见 motion.js 的 watchDecoration。
watchDecoration((enabled) => {
  if (enabled) enable();
  else disable();
});
