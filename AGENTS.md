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

`public/gallery.json` 由 `scripts/extract-gallery.js` 从旧相册静态快照抽取（读 `../my-oss-gallery/docs/index.html` + `categories.json`）。相册内容有变动时重跑 `node scripts/extract-gallery.js`，不要手编 JSON。

> `src/data/gallery.json` 是迁移期的历史副本，已不被任何页面引用；确认无用后可删除（**删除前先与用户确认**）。

## 三、已定位的坑点

### 1. `<Teleport to="body">` 会删掉整个 `<header>`（**已修复**，2026-10-03）

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

- **已采用的修复**：把搜索功能拆成两半——
  - `src/components/SearchTrigger.vue`：触发按钮留在 Header，点击派发 `shiro:open-search` 全局事件；
  - `src/components/SearchModal.vue`：**去掉 `<Teleport>`**，改由 `BaseLayout.astro` 挂到 `<Footer />` 之后的 body 末尾，直接以 `fixed inset-0` 覆盖全屏（不在 `backdrop-blur` 容器内，无需 Teleport），并监听上述事件。

  **不要**把弹窗挪回 Header，也**不要**再加回 `<Teleport>`。若将来确需 Teleport，先跑上表的隔离实验确认。
- **回归要点**：`agent-browser eval 'Array.from(document.body.children).map(e=>e.tagName).join(",")'` 应为 `HEADER,MAIN,FOOTER,SCRIPT,ASTRO-ISLAND`；`document.querySelectorAll("astro-island").length` 应为 4；`agent-browser errors` 应为空；点击 Header 第二个按钮后 `input[placeholder]` 存在且输入关键词能出结果。

### 2. 大块数据不要内联进岛的 props（**已修**，2026-10-03）

原先 `BaseLayout` 把 80 篇文章正文当 props 传给 `SearchModal`（该岛标签 26KB），相册又把 353 张图的 JSON 当 props 传给 `GalleryView`（`/images` 页 259KB），87 页 HTML 合计 5.1MB。现已全部改为按需加载：

| 数据 | 运行时来源 | 体积（gzip） |
|---|---|---|
| 检索索引 | `/search-index.json`，由 `src/pages/search-index.json.js` 构建期生成；打开搜索时 fetch，会话内缓存 | 11 KB |
| 相册快照 | `/gallery.json`，由 `scripts/extract-gallery.js` 生成到 `public/`；进相册页时 fetch | 9.8 KB |
| 词牌数据 | `/cipai.json`（既有） | 约 200 KB |

**新增大块数据时照此办理**：放 `public/` 或做构建期端点，由客户端按需取，不要塞进组件 props。当前 87 页 HTML 原始 1.7MB、gzip 567KB（平均每页 6.5KB）。

### 3. 相册接口是「可选后端」

`GalleryView.vue` 会请求 `/api/images`、`/api/auth/login`、`/api/categories`（生产由 Nginx 反代到 `images-server`）。页面载入时**静默**尝试同步，失败即退回构建期静态快照，不弹错误提示；只有用户手动点「实时同步」才提示失败。改动这段时别把静默降级去掉。

### 4. 填词容器必须按 composables 的真实签名调用

`PoetryWorkbench.vue` 原先按一套并不存在的 API 书写（`useAnalysis({text, pattern, rhymeBook})`、`useDraft(selectedId)`、解构 `updateMultiToneOverride`/`loadDraft`/`saveDraft`/`draftRestored` 等），导致 `onMounted` 调用未定义函数直接抛错、整个岛白屏。**改任何调用前先读 composables 源码**，真实契约如下：

| 位置 | 真实签名 |
|---|---|
| `useCipai()` | 无参 → `{ list }` |
| `usePattern(cipaiListRef)` | 位置参数 → `{ selectedId, currentPattern, groupedPatterns, selectPattern(id) }` |
| `useAnalysis(text, pattern, rhymeBookOverride)` | 位置参数 → `{ analyzing, matchResults, stats, errors, multiToneList, rhymeResult, effectiveRhymeBook, setToneOverride(line, col, char, tone) }` |
| `useDraft({ text, patternId, rhymeBook })` | 对象参数 → `{ load, clear, hasDraft, restored, savedAt }`，内部已 watch 自动落盘，**没有** `saveDraft` |
| `PatternSelector` | `emit('select', id)` —— 抛**字符串 id**，不是对象 |
| `PatternPreview` / `ErrorPanel` | `emit('jump', line, col)` —— 两个位置参数 |
| `EditorTooltip` | `emit('select', { line, col, char, candidate })` |
| `PoetryIDE` | `defineExpose({ jumpTo(line, col) })` |

韵书传给 `useAnalysis` 的第三参数是**用户覆盖值**；传空串即交给引擎按体裁自动推导（诗体→新韵，词牌→词林正韵）。

### 5. 全项目禁止 `<Teleport>`

Astro 岛内使用 Vue 的 `<Teleport>` 会在 hydration 时破坏宿主 DOM（详见坑点一，已在 `SearchModal` / `EditorTooltip` / `GalleryView` 三处踩过）。弹窗一律就地 `fixed` 定位（确认祖先没有 transform / filter / backdrop-filter），或作为独立岛挂到 `BaseLayout` 的 body 末尾。

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
