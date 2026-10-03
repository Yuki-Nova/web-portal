/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // 颜色一律走 RGB 通道变量，否则 Tailwind 3 无法生成 /5、/15 这类透明度修饰符的类
        // （背景/边框/分隔线的浅色底会静默消失）。通道变量定义见 src/styles/tokens.css。
        canvas: 'rgb(var(--color-canvas-rgb) / <alpha-value>)',
        surface: 'rgb(var(--color-surface-rgb) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--color-surface-elevated-rgb) / <alpha-value>)',
        ink: 'rgb(var(--color-ink-rgb) / <alpha-value>)',
        'ink-muted': 'rgb(var(--color-ink-muted-rgb) / <alpha-value>)',
        'ink-faint': 'rgb(var(--color-ink-faint-rgb) / <alpha-value>)',
        // 边框色本身即极淡的半透明值，保持 var() 直引，不参与透明度计算
        'border-paper': 'var(--color-border)',
        seal: 'rgb(var(--color-seal-rgb) / <alpha-value>)',
        'seal-soft': 'var(--color-seal-soft)',
        amber: 'rgb(var(--color-amber-rgb) / <alpha-value>)',
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', '"Songti SC"', 'STSong', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'paper-sm': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'paper': '0 1px 3px rgba(0, 0, 0, 0.05), 0 10px 30px rgba(0, 0, 0, 0.04)',
        'paper-lg': '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 20px 40px -4px rgba(0, 0, 0, 0.08)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};
