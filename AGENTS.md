# AGENTS.md · web-portal 项目约定

本文件只记录**本项目特有**的规则与坑点；通用开发规范见用户级 `~/.dsh/AGENTS.md`。

## 一、项目定位与权威源

- 本工程是 `yukinova.top` 主域的**唯一门户**，输出纯静态产物，由 Nginx 托管。
- **`src/poetry-engine/` 是填词引擎的唯一权威源**（2026-10-03 拍板）。旧项目 `../poetry_tool/` 已冻结，只作历史参考，**不要再往旧仓库加功能**，否则两处继续漂移。
- `bookswich` 不在本工程内，是独立域名外链，代码不合并、不改动。
- 旧 Hexo 博客（`../PortableHexo/blog`）的 80 篇文章已迁入 `src/content/blog/`，**新文章直接写这里**。

## 二、硬规则

### 1. Tailwind 颜色必须同时提供 RGB 通道变量

Tailwind 3 **无法**给 `var(--x)` 形式的颜色计算透明度：`bg-seal/5`、`border-seal/15` 这类类会**静默不生成**，页面上表现为浅色底、淡边框、分隔线凭空消失（构建不报错，极易漏掉）。

因此新增或修改颜色时：

```css
/* src/styles/tokens.css */
--color-xxx: #123456;          /* 供 CSS 直接引用 */
--color-xxx-rgb: 18 52 86;     /* 供 Tailwind 透明度修饰符使用 */
```

```js
// tailwind.config.mjs
xxx: 'rgb(var(--color-xxx-rgb) / <alpha-value>)',
```

例外：`--color-border` 这类**本身就是半透明值**的颜色保持 `var()` 直引，其上的 `/60` 之类修饰符无效，直接写不带修饰符的类。

**改完必须验证产物**（见第四节），不要只看源码。

### 2. 诗词组件的样式令牌走兼容层

`src/components/poetry/` 下的组件自 `poetry_tool` 整体迁移，内部 scoped 样式仍按旧令牌名书写（`--paper-card`、`--ink`、`--ping-bg`、`--accent` 等 25 个）。这些名字在 `tokens.css` 末尾的「诗词工坊兼容层」统一映射到纸墨令牌，**不要逐个改写组件样式**，也不要在兼容层之外新造同名变量。

### 3. 生成型数据不要手改

`src/data/gallery.json` 由 `scripts/extract-gallery.js` 从旧相册静态快照抽取（读 `../my-oss-gallery/docs/index.html` + `categories.json`）。相册内容有变动时重跑脚本，不要手编 JSON。

## 三、已定位的坑点

### 1. `<Teleport to="body">` 会删掉整个 `<header>`（**未修，高优先级**）

- **现象**：真实浏览器打开任意使用 `BaseLayout` 的页面，顶部导航（header）连同其中的主题切换、搜索两个岛一起从 DOM 消失；填词页工作台也不渲染。禁用 JS 时一切正常，因此极易误判为「CSS 问题」。
- **根因**：`src/components/SearchModal.vue:19` 的 `<Teleport to="body">` 在 Astro 岛的 hydration 过程中把 header 从 DOM 中移除。
- **定位证据**（隔离实验，2026-10-03）：

  | 实验 | 结果 |
  |---|---|
  | 禁用全部 JS（`network route "*.js" --abort`） | `HEADER,MAIN,FOOTER`，islands=3，正常 |
  | 移除 header 内两个 Vue 岛 | 正常 |
  | 仅保留 `ThemeToggle` | 正常 |
  | 保留 `SearchModal`（`client:idle` 或 `client:load` 均试过） | header 消失 |
  | 精简 SearchModal 的 props（去掉 80 篇正文） | 仍消失（排除 props 体积） |
  | `<Teleport to="body" disabled>` | **恢复正常**（islands=3） |
  | 移除 `<ClientRouter />` | 仍消失（排除 View Transitions） |

- **修复方向**：弹窗用 `fixed inset-0` 覆盖全屏，但 Header 有 `backdrop-blur-md`（会创建包含块），所以不能简单就地渲染。可选：① 把搜索弹窗拆成独立岛挂在 `BaseLayout` 的 body 末尾（触发按钮留在 Header，用事件或全局状态通信）；② 关掉 Header 的 `backdrop-blur` 后取消 Teleport。修完务必用第一节的隔离实验回归。

### 2. 全站文章正文被内联进每一页

`BaseLayout` 把 80 篇文章的 `body` 传给 Header → SearchModal，导致 SearchModal 的 `astro-island` 标签长达 26KB（props 属性），87 个 HTML 合计 5.1MB，文章详情页 43KB、`/blog` 153KB、`/images` 259KB（相册 353 张图的 JSON 也内联）。优化方向是改静态索引按需加载。

### 3. 相册接口是「可选后端」

`GalleryView.vue` 会请求 `/api/images`、`/api/auth/login`、`/api/categories`（生产由 Nginx 反代到 `images-server`）。页面载入时**静默**尝试同步，失败即退回构建期静态快照，不弹错误提示；只有用户手动点「实时同步」才提示失败。改动这段时别把静默降级去掉。

## 四、改动后的验证流程

1. `npm run build`（必须 87 页全绿）。
2. 检查产物里的令牌与透明度类是否真的生成（源码通过不代表 CSS 通过）：

   ```powershell
   $css = (Get-ChildItem dist\_astro\*.css | ForEach-Object { Get-Content $_ -Raw }) -join "`n"
   [regex]::Matches($css, '\.bg-seal\\/5\{[^}]*\}').Value   # 应输出 rgb(var(--color-seal-rgb) / .05)
   ```

3. 起 `npm run preview`，用 `agent-browser` 实测（服务端返回正常 ≠ 客户端 DOM 正常）：

   ```powershell
   agent-browser open "http://localhost:4321/poetry"
   agent-browser eval "Array.from(document.body.children).map(e=>e.tagName).join(',')"
   agent-browser errors
   ```

   期望 `HEADER,MAIN,FOOTER`。**只看 `Invoke-WebRequest` 的 HTML 会漏掉客户端删 DOM 这类问题。**

## 五、边界

- `dist/`、`node_modules/`、`.astro/` 已在 `.gitignore`，不要提交。
- 改动前先确认工作区干净（`git status`），大改前打 tag 或建分支。
- 涉及服务器（Nginx、images-server、OSS）的操作先与用户确认，不要擅自部署。
