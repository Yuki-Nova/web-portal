/**
 * Task 2.1 / 2.2 宣纸卡片 3D 微倾与反光（Paper Tilt & Sheen）
 *
 * 表现：指针在声明了 `data-tilt` 的卡片上移动时，卡片随相对位置产生 ≤4deg 的
 *       3D 微旋转，表面同时划过一层与角度联动的漫反射微光；移出后缓动复位。
 *
 * 实现：
 *   - 只写 CSS 变量（--tilt-x / --tilt-y / --sheen-x / --sheen-y / --sheen-opacity），
 *     位移与微光全部由 global.css 的 [data-tilt] 规则消费，JS 不直接拼 transform；
 *   - 指针事件挂在元素自身（不用 document 代理），换页后元素消失即自动解绑；
 *   - 触屏（pointerType === 'touch'）与 prefers-reduced-motion 下完全不挂监听。
 */
import { decorationEnabled, onPageLoad, watchDecoration } from './motion.js';

/** 最大倾斜角（度）。需求上限 4deg，这里即取值上限。 */
const MAX_TILT = 4;
/** 悬停时微光的整体强度 */
const SHEEN_ON = '0.5';
/** 已绑定的元素 → 处理函数，便于关闭动效时精确解绑 */
const attached = new WeakMap();

/** 复位：清掉变量与跟随态，让 CSS 过渡把卡片送回原处。 */
function reset(element) {
  element.classList.remove('is-tilting');
  element.style.removeProperty('--tilt-x');
  element.style.removeProperty('--tilt-y');
  element.style.removeProperty('--sheen-x');
  element.style.removeProperty('--sheen-y');
  element.style.removeProperty('--sheen-opacity');
}

function attach(element) {
  if (attached.has(element)) return;

  const onMove = (event) => {
    // 混合设备（触屏 + 鼠标）上，手指拖动不应触发倾斜
    if (event.pointerType === 'touch') return;

    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const px = (event.clientX - rect.left) / rect.width; // 0~1
    const py = (event.clientY - rect.top) / rect.height; // 0~1

    element.style.setProperty('--tilt-y', `${((px - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
    element.style.setProperty('--tilt-x', `${((0.5 - py) * 2 * MAX_TILT).toFixed(2)}deg`);
    element.style.setProperty('--sheen-x', `${(px * 100).toFixed(1)}%`);
    element.style.setProperty('--sheen-y', `${(py * 100).toFixed(1)}%`);
    element.style.setProperty('--sheen-opacity', SHEEN_ON);
    element.classList.add('is-tilting');
  };

  const onLeave = () => reset(element);

  element.addEventListener('pointermove', onMove, { passive: true });
  element.addEventListener('pointerleave', onLeave);
  element.addEventListener('pointercancel', onLeave);
  element.addEventListener('blur', onLeave);

  attached.set(element, { onMove, onLeave });
}

function detach(element) {
  const handlers = attached.get(element);
  if (!handlers) return;

  element.removeEventListener('pointermove', handlers.onMove);
  element.removeEventListener('pointerleave', handlers.onLeave);
  element.removeEventListener('pointercancel', handlers.onLeave);
  element.removeEventListener('blur', handlers.onLeave);

  attached.delete(element);
  reset(element);
}

function bind() {
  const targets = document.querySelectorAll('[data-tilt]');
  targets.forEach(attach);
  window.__shiroTiltCount = targets.length; // 供浏览器实测断言
}

function unbind() {
  document.querySelectorAll('[data-tilt]').forEach(detach);
  window.__shiroTiltCount = 0;
}

onPageLoad(() => {
  if (decorationEnabled()) bind();
  else unbind();
});

// 用户中途切换系统偏好时实时生效。
// 必须拆开订阅两条媒体查询——合并写法收不到 change 事件，见 motion.js 的 watchDecoration。
watchDecoration((enabled) => {
  if (enabled) bind();
  else unbind();
});
