# web-portal · yukinova.top 统一门户

把原本各自为政的四个站点（Hexo 博客 / Express 相册 / Vue3 诗词工具 / Bookswich）整合为**一个 Astro 静态门户**，共享一套布局与设计令牌，由 Nginx 直接分发静态文件，以降低阿里云 ECS（1.6G 内存）上的常驻进程开销。

规划源头见 [../docs/FRONTEND_REDESIGN_PLAN.md](../docs/FRONTEND_REDESIGN_PLAN.md) 与 [../docs/WEBSITE_ARCHITECTURE.md](../docs/WEBSITE_ARCHITECTURE.md)。

## 做什么

| 路由 | 内容 | 数据来源 |
|---|---|---|
| `/` | 个人名片页（独立骨架，不使用 BaseLayout） | 静态 |
| `/blog` | 诗词墙 + 文章存稿列表 + 侧栏名片 | `src/data/poetry-wall.json` + content collection |
| `/posts/[slug]` | 文章详情页（含目录、朱砂钤印） | `src/content/blog/*.md` |
| `/archives` `/categories` `/tags` | 编年表 / 分类 / 标签索引 | content collection |
| `/images` | 影廊（353 张，纯静态快照 + 可选 OSS 实时同步） | `src/data/gallery.json` |
| `/poetry` | 填词案头（153 词牌、平仄引擎、韵书校验） | `public/cipai.json` + `src/poetry-engine/` |

`bookswich.yukinova.top` 是**外链**，不在本工程内，代码不合并。

## 怎么跑

```bash
npm install        # 依赖已随仓库外的 node_modules 就位；重装走 npmmirror 源更快
npm run dev        # 开发服务器（--host）
npm run build      # 输出到 dist/，纯静态
npm run preview    # 预览构建产物，默认 http://localhost:4321
```

环境：Node 24 + npm；本机 pnpm 位于 `D:\Myworksoftware\Node.js\node_global`。

## 技术栈

- **Astro 5.18**（`output: 'static'`，87 个静态页面）
- **Vue 3.5 Islands**（填词引擎、相册、诗词墙、搜索、主题切换共 5 个交互孤岛）
- **Tailwind CSS 3.4**（配置式主题，颜色全部走 CSS 变量）
- 设计系统「纸墨·新文人」：`src/styles/tokens.css` 是唯一令牌源

## 目录结构

```
src/
├── content/blog/          80 篇诗词 Markdown（与旧 Hexo _posts 同源）
├── data/
│   ├── gallery.json       相册数据（由 scripts/extract-gallery.js 生成）
│   └── poetry-wall.json   诗词墙数据（80 条）
├── poetry-engine/         填词引擎：core 算法 + composables + 韵书/平仄数据
├── components/
│   ├── poetry/            填词案头 UI（自 poetry_tool 迁移）
│   └── *.astro|vue        全站组件（Header/Footer/侧栏/相册/诗词墙/搜索）
├── layouts/BaseLayout.astro
├── pages/                 路由
└── styles/
    ├── tokens.css         设计令牌（含 poetry 组件兼容层）
    └── global.css         纸墨卡片、印章徽标、文章正文排版
public/cipai.json          153 词牌数据（构建期随 dist 一起发布）
scripts/extract-gallery.js 从旧相册静态快照抽取 gallery.json
```

## 部署形态

- 主域 `yukinova.top`：Nginx 托管本工程 `dist/` 静态产物。
- 相册写操作（保存分类 / 删除 OSS 图片 / 实时同步）依赖 `/api/*` → Nginx 反代到 `images-server`（127.0.0.1:3000）。后端不可达时前端静默退回构建期静态快照。
- 词牌数据更新 = 重新生成 `public/cipai.json` 后重新构建（或只替换该文件），无需后端。

## 已知问题

| 严重度 | 问题 | 位置 |
|---|---|---|
| **高（未修）** | Vue `<Teleport to="body">` 与 Astro 岛组合，会把整个 `<header>` 从 DOM 中移除（含两个岛），真实浏览器下所有内页顶部导航消失 | `src/components/SearchModal.vue:19`，复现与定位见 `AGENTS.md` |
| 中 | 全站搜索把 80 篇文章正文内联进**每个**页面（SearchModal 岛标签 26KB），87 页 HTML 合计 5.1MB | `src/layouts/BaseLayout.astro` |
| 中 | 首页 `/` 自带完整 `<html>` 骨架，不使用 BaseLayout，与内页是两套导航体系 | `src/pages/index.astro` |
| 低 | Header 硬编码深色条 `#1a1c20` + emoji 图标，与纸墨浅色令牌体系不一致 | `src/components/Header.astro:32` |
| 低 | 无自动化测试（旧 poetry_tool 的 vitest 用例未随引擎迁移） | — |

## 相关文档

- 顶层重构规划：[../docs/FRONTEND_REDESIGN_PLAN.md](../docs/FRONTEND_REDESIGN_PLAN.md)
- 四站事实基准：[../docs/WEBSITE_ARCHITECTURE.md](../docs/WEBSITE_ARCHITECTURE.md)
- 静态化实施记录：[../docs/INTEGRATION_PLAN.md](../docs/INTEGRATION_PLAN.md)
- 项目开发约定与坑点：[AGENTS.md](AGENTS.md)
