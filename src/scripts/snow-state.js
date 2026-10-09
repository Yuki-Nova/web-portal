/**
 * 飘雪开关的持久化状态（Task 5.1）。
 *
 * 为什么单独一个模块：开关在页脚（Footer 的岛），雪在布局层（BaseLayout 的岛），
 * 两个 Astro 岛彼此独立，靠这个模块做唯一的状态源与订阅，避免互相引用组件。
 * 只做三件事：读、写、订阅。默认开启（用户已确认）。
 */

const STORAGE_KEY = 'yuki-snow';

/** 订阅者集合（同一页面内两个岛共享同一份模块实例） */
const listeners = new Set();

/** 飘雪是否开启；未设置过时默认开启。 */
export function snowEnabled() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored === 'on';
  } catch (error) {
    // 隐私模式等场景下 localStorage 不可用：退化为「默认开启」，仅当次会话有效
    return true;
  }
}

/** 写入开关状态并广播。 */
export function setSnowEnabled(enabled) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (error) {
    // 写不进去也不影响本次会话的即时生效
  }
  listeners.forEach((listener) => {
    try {
      listener(enabled);
    } catch (error) {
      console.warn('[snow-state] 订阅回调异常：', error);
    }
  });
}

/** 订阅开关变化，返回取消订阅函数。 */
export function subscribeSnow(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
