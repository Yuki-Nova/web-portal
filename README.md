# web-portal · yukinova.top 统一门户

把原本各自为政的四个站点（Hexo 博客 / Express 相册 / Vue3 诗词工具 / Bookswich）整合为**一个 Astro 静态门户**，共享一套布局与设计令牌，由 Nginx 直接分发静态文件，以降低阿里云 ECS（1.6G 内存）上的常驻进程开销。

规划源头见 [../docs/FRONTEND_REDESIGN_PLAN.md](../docs/FRONTEND_REDESIGN_PLAN.md) 与 [../docs/WEBSITE_ARCHITECTURE.md](../docs/WEBSITE_ARCHITECTURE.md)。

## 做什么

| 路由 | 内容 | 数据来源 |
|---|---|---|
| `/` | 个人名片 + 门户入口卡片（走 BaseLayout 统一骨架） | 静态 |
| `/poems` | 诗词墙（纯诗词页，无存稿列表与个人信息卡） | `src/data/poetry-wall.json`（由 `scripts/sync-poetry-wall.mjs` 从 `src/content/blog/` 生成，**禁止手改**） |
| `/posts/[slug]` | 文章详情页（居中单栏、上下篇导航、朱砂钤印） | `src/content/blog/*.md` |
| `/archives` | 文集编年（每页 20 篇，构建期分页） | content collection |
| `/categories` `/tags` | 分类 / 标签索引卡片；详情页 `/categories/<分类>/`、`/tags/<标签>/` 各自分页 | content collection |
| `/images` | 影廊（353 张，纯静态快照 + 可选 OSS 实时同步） | `public/gallery.json` |
| `/poetry` | 填词案头（153 词牌、平仄引擎、韵书校验） | `public/cipai.json` + `src/poetry-engine/` |
| `/404` | 未寻得页（部署时 Nginx 需配 `error_page 404 /404.html;` 才生效） | 静态 |

`bookswich`（教材解析工作台）不在本工程内，代码不合并；门户导航与名片页**不提供入口**（2026-10-03 按用户要求移除）。

## 怎么跑

```bash
npm install        # 依赖已随仓库外的 node_modules 就位；重装走 npmmirror 源更快
npm run dev        # 开发服务器（--host）
npm run build      # 输出到 dist/，纯静态
npm run preview    # 预览构建产物，默认 http://localhost:4321
```

环境：Node 24 + npm；本机 pnpm 位于 `D:\Myworksoftware\Node.js\node_global`。

## 发布（本地构建 → 上传服务器）

线上只吃静态产物，**源码与构建都只在本地**。发布统一走 `scripts/publish.ps1`，不要手工 `scp`。

```powershell
# 有未提交改动时：脚本会自动用这句中文说明提交，作为回滚基线
pwsh -NoProfile -File scripts\publish.ps1 -Message "新增博文《xxx》"

# 无改动、只想把当前产物推上去
pwsh -NoProfile -File scripts\publish.ps1

# 只演练：打印将执行的命令，不做任何改动（校验仍会跑，因为它只发 GET）
pwsh -NoProfile -File scripts\publish.ps1 -DryRun
```

| 参数 | 说明 |
|---|---|
| `-Message` | git 提交说明（中文简述）；工作区有改动时必填 |
| `-SkipBuild` | 复用现有 `dist/`，不重新构建 |
| `-DryRun` | 只打印命令，零改动 |
| `-Prune` | 删除远端站点根中不在本次产物内的多余文件（**默认关**，只报告） |
| `-NoVerify` | 跳过发布后的 curl 校验 |
| `-SshHost` / `-RemoteRoot` | 默认 `root@121.43.153.125` / `/www/wwwroot/yukinova.top-new` |

脚本的 8 步：前置检查（含免密 SSH 探测）→ git 基线 → `npm run build` → 产物断言 → `tar` 打包 → `scp` → 远端解压覆盖 + `chown www:www` + 缺失门禁 → curl 校验 7 条 URL（含最新一篇的中文 slug）并比对线上/本地 `search-index.json` 字节数。

**前置（一次性）**：部署 SSH 公钥，之后全程免密。

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@121.43.153.125 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

**回滚**：产物由 git 保证可复现，退到上一版提交重新构建再发布即可（脚本结束时会打印确切命令）。

```powershell
git checkout <上一版 sha>
npm run build
pwsh -NoProfile -File scripts\publish.ps1 -SkipBuild
```

发布细节与两个已踩的坑（Windows `bsdtar` 的 CRLF 清单、PowerShell 管道进 `ssh` 的 CRLF）见 [AGENTS.md](AGENTS.md) 第六节。

## 技术栈

- **Astro 5.18**（`output: 'static'`，当前 107 个静态页面）
- **Vue 3.5 Islands**（填词引擎、相册、诗词墙、搜索、主题切换共 5 个交互孤岛）
- **Tailwind CSS 3.4**（配置式主题，颜色全部走 CSS 变量）
- 设计系统「纸墨·新文人」：`src/styles/tokens.css` 是唯一令牌源

## 目录结构

```
src/
├── content/blog/          81 篇诗词 Markdown（唯一事实源，新文章写这里）
├── data/
│   ├── gallery.json       相册数据（由 scripts/extract-gallery.js 生成）
│   └── poetry-wall.json   诗词墙数据（由 scripts/sync-poetry-wall.mjs 从 content/blog 生成，禁止手改）
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
scripts/new-post.mjs       新建博文脚手架（npm run new）
scripts/sync-poetry-wall.mjs 由 content/blog 生成 poetry-wall.json（npm run sync，build 前自动跑）
scripts/publish.ps1        一键发布：git 基线 → 构建 → 断言 → 打包 → 上传 → 校验
scripts/extract-gallery.js 从旧相册静态快照抽取 gallery.json
```

## 部署形态

- 主域 `yukinova.top`：Nginx 托管本工程 `dist/` 静态产物。
- 相册写操作（保存分类 / 删除 OSS 图片 / 实时同步）依赖 `/api/*` → Nginx 反代到 `images-server`（127.0.0.1:3000）。后端不可达时前端静默退回构建期静态快照。
- 词牌数据更新 = 重新生成 `public/cipai.json` 后重新构建（或只替换该文件），无需后端。

## 已知问题

| 严重度 | 问题 | 位置 |
|---|---|---|
| ~~高~~ 已修（2026-10-03） | 填词工作台白屏：`EditorTooltip` 内的 Teleport 叠加容器与引擎接口不匹配（`useAnalysis`/`useDraft` 签名、事件载荷全对不上，`onMounted` 调用未定义函数直接抛错） | `poetry/EditorTooltip.vue` + `poetry/PoetryWorkbench.vue` |
| ~~高~~ 已修（2026-10-03） | Vue `<Teleport to="body">` 与 Astro 岛组合会把整个 `<header>` 从 DOM 中移除；已改为触发按钮与弹窗分离部署 | `src/components/SearchTrigger.vue` + `SearchModal.vue`，见 `AGENTS.md` |
| ~~中~~ 已修（2026-10-03） | 全站搜索曾把 80 篇正文内联进**每个**页面（87 页 HTML 合计 5.1MB）；现改为构建期静态索引 `/search-index.json`，打开搜索时才加载 | `src/pages/search-index.json.js` |
| ~~中~~ 已修（2026-10-03） | Google Fonts 外链会拖住 `load` 事件（外网受限时首屏被拖慢）；已改为 `media="print"` 非阻塞加载 + `noscript` 兜底 | `src/layouts/BaseLayout.astro` |
| ~~中~~ 已修（2026-10-03） | 首页曾自带独立 `<html>` 骨架、拿不到全站导航；已并入 BaseLayout，重做为「名片 + 门户入口卡片」 | `src/pages/index.astro` |
| ~~低~~ 已修（2026-10-03） | Header 曾硬编码深色条 `#1a1c20` + emoji 图标；已改为纸墨令牌体系（纸底 + 墨字 + 印章红下划线）并去除 emoji | `src/components/Header.astro` |
| 低 | 无自动化测试（旧 poetry_tool 的 vitest 用例未随引擎迁移） | — |

## 相关文档

- 顶层重构规划：[../docs/FRONTEND_REDESIGN_PLAN.md](../docs/FRONTEND_REDESIGN_PLAN.md)
- 四站事实基准：[../docs/WEBSITE_ARCHITECTURE.md](../docs/WEBSITE_ARCHITECTURE.md)
- 静态化实施记录：[../docs/INTEGRATION_PLAN.md](../docs/INTEGRATION_PLAN.md)
- 项目开发约定与坑点：[AGENTS.md](AGENTS.md)
- 上线部署方案：[DEPLOY.md](DEPLOY.md)
