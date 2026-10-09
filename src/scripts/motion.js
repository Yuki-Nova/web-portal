/**
 * 全站装饰性交互的共用基础设施：降级判定 + 换页生命周期 + rAF 托管。
 *
 * 三件事：
 *   1. 动效开关判定——装饰性动效只在「精细指针设备」且用户未要求「减弱动效」时运行；
 *   2. View Transitions 生命周期——页面级初始化统一走 onPageLoad()，清理走 onBeforeSwap()；
 *   3. rAF 循环托管——document.hidden 时自动停帧，回到前台自动续跑，避免后台空转。
 *
 * 为什么必须集中在这里：本文件由 BaseLayout.astro 以 `<script src="...">` 引入，
 * Astro 会把它当模块打包，**每个页面只执行一次**，ClientRouter 换页时不会重跑。
 * 因此模块级代码不得假设「每次换页都会重新执行」，页面级初始化一律走 onPageLoad()。
 */

/** 精细指针（鼠标 / 触控板）；触屏设备为 false。 */
export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';
/** 系统级「减弱动效」偏好。 */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** 安全版 matchMedia：老浏览器或异常环境下退化为 false，不抛错。 */
function query(queryString) {
  try {
    return window.matchMedia(queryString);
  } catch (e) {
    return null;
  }
}

/** 用户是否要求减弱动效。 */
export function prefersReducedMotion() {
  const mql = query(REDUCED_MOTION_QUERY);
  return mql ? mql.matches : false;
}

/** 是否精细指针设备（鼠标 / 触控板）。 */
export function finePointer() {
  const mql = query(FINE_POINTER_QUERY);
  return mql ? mql.matches : false;
}

/** 装饰性动效总开关：精细指针 且 未开启减弱动效。 */
export function decorationEnabled() {
  return finePointer() && !prefersReducedMotion();
}

/**
 * 订阅媒体查询变化（立即回调一次当前状态，之后每次变化再回调）。
 * @param {string} queryString 媒体查询，可用逗号组合多条
 * @param {(matches: boolean) => void} callback
 */
export function watchMedia(queryString, callback) {
  const mql = query(queryString);
  if (!mql) return;
  const handler = (event) => callback(event.matches);
  callback(mql.matches);
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
  } else if (typeof mql.addListener === 'function') {
    // Safari < 14 兜底
    mql.addListener(handler);
  }
}

/**
 * 注册页面级初始化。
 *
 * astro:page-load 在首次加载与每次客户端导航后都会触发；这里额外用「路径 + 查询串」
 * 去重，避免脚本执行时机与事件触发顺序造成的重复初始化。
 * @param {() => void} init
 */
export function onPageLoad(init) {
  let lastKey = null;

  const run = () => {
    const key = `${location.pathname}${location.search}`;
    if (key === lastKey) return;
    lastKey = key;
    try {
      init();
    } catch (error) {
      console.warn('[motion] 页面初始化失败：', error);
    }
  };

  document.addEventListener('astro:page-load', run);

  // 兜底：脚本若在 astro:page-load 之后才执行（或被客户端路由以外的流程替换），补跑一次。
  // 模块脚本是 deferred，正常时机 readyState 不会已经是 complete，不会与上面重复。
  if (document.readyState === 'complete') run();
}

/** 注册换页前清理（ClientRouter 在替换 DOM 之前触发）。 */
export function onBeforeSwap(callback) {
  document.addEventListener('astro:before-swap', callback);
}

/** 已创建的 rAF 循环（用于统一的可见性调度）。 */
const rafLoops = new Set();
let visibilityBound = false;

function bindVisibility() {
  if (visibilityBound) return;
  visibilityBound = true;
  document.addEventListener('visibilitychange', () => {
    const hidden = document.hidden;
    rafLoops.forEach((loop) => (hidden ? loop.stop() : loop.start()));
  });
}

/**
 * 创建一个受页面可见性托管的 requestAnimationFrame 循环。
 * @param {(now: number) => void} step 每帧回调
 * @returns {{ start: () => void, stop: () => void, dispose: () => void }}
 */
export function createRafLoop(step) {
  bindVisibility();

  let frameId = 0;
  let wanted = false;
  let disposed = false;

  const frame = (now) => {
    if (!wanted || disposed) {
      frameId = 0;
      return;
    }
    try {
      step(now);
    } catch (error) {
      // 单帧异常不打断整个循环，但要让问题可见
      console.warn('[motion] 动画帧异常：', error);
    }
    frameId = requestAnimationFrame(frame);
  };

  const loop = {
    start() {
      if (disposed || wanted || document.hidden) return;
      wanted = true;
      frameId = requestAnimationFrame(frame);
    },
    stop() {
      wanted = false;
      if (frameId) cancelAnimationFrame(frameId);
      frameId = 0;
    },
    dispose() {
      loop.stop();
      disposed = true;
      rafLoops.delete(loop);
    },
  };

  rafLoops.add(loop);
  return loop;
}

/**
 * 幂等注入模块自用的样式。
 * 涟漪与游丝这类「有 JS 才存在」的装饰，样式随脚本一起注入：无 JS 时零成本，
 * 也不必往 global.css 里塞只为少数交互服务的规则。
 * @param {string} id style 元素 id
 * @param {string} css 样式文本
 */
export function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * 让 canvas 铺满视口并做 devicePixelRatio 适配，返回 2D 上下文。
 * 调用方需在窗口尺寸变化时重新调用。
 * @param {HTMLCanvasElement} canvas
 * @returns {CanvasRenderingContext2D | null}
 */
export function fitCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * 读取 tokens.css 里的 RGB 通道变量并拼成颜色串。
 * 例：cssRgb('--color-ink-rgb', 0.5) → 'rgb(31 33 36 / 0.5)'
 * 注意：内部会调用 getComputedStyle，不要在每帧里无脑调用，调用方需自行缓存。
 * @param {string} varName
 * @param {number} alpha
 */
export function cssRgb(varName, alpha = 1) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const channels = raw || '31 33 36';
  return `rgb(${channels} / ${alpha})`;
}

/** 当前主题标记（用于判断是否需要刷新取色缓存）。 */
export function themeKey() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * 订阅「装饰性动效是否可用」的变化：任一相关媒体特性变化都会回调，注册时立即回调一次。
 *
 * **不要**写成 matchMedia('(a), (b)') 的逗号合并形式：MediaQueryList.matches 表示
 * 「列表中任意一条命中」，change 只在整体布尔值翻转时触发。精细指针恒为真时，
 * 单独切换 prefers-reduced-motion 不会让它翻转 —— 2026-10-09 实测：一次
 * reduced-motion 开/关切换，合并查询收到 0 个 change 事件，单一查询各收到 1 个，
 * 结果是降级与恢复全部失效。故这里拆成两条各自订阅。
 *
 * @param {(enabled: boolean) => void} callback
 */
export function watchDecoration(callback) {
  const notify = () => callback(decorationEnabled());
  watchMedia(FINE_POINTER_QUERY, notify);
  watchMedia(REDUCED_MOTION_QUERY, notify);
}
