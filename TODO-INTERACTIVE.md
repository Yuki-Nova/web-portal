# web-portal 可交互元素落地规划清单 (TODO)

> **设计基调**：纸墨·新文人设计系统（日光宣纸 / 玄墨沉夜 / 朱砂印灵魂色）  
> **核心原则**：雅致、克制、轻灵、高性能；无感降级、零破坏性 DOM 污染、全兼容 View Transitions。

---

## 总体实施原则与架构约束

1. **审美自洽**：所有动效均以「水墨晕染」、「宣纸触感」、「朱砂印章」、「落雪微风」为母题，严禁赛博霓虹、高饱和花哨动效。
2. **性能与降级**：
   - 鼠标专属动效必须限定于 `@media (hover: hover) and (pointer: fine)`，移动端与触屏静默隐藏，不浪费算力。
   - 严格尊重 `prefers-reduced-motion: reduce`，开启减弱动效时直接关闭粒子与位移。
   - 页面失焦（`document.hidden`）时，所有 Canvas 动画帧循环（`requestAnimationFrame`）必须自动休眠。
3. **架构守则（依据 `AGENTS.md`）**：
   - **全项目禁止 `<Teleport>`**：所有弹出层、挂件采用就地 `fixed` 或挂载于 `BaseLayout.astro` 根层，避免破坏 Astro Island 的 Hydration。
   - **View Transitions 兼容**：使用 `ClientRouter` 换页时，页面级脚本必须监听 `astro:page-load` 或 `astro:after-swap`，防止换页后事件监听失效或内存泄漏。
   - **色彩令牌统一**：严格使用 `tokens.css` 内预设的 CSS 变量及 Tailwind 通道变量（如 `--color-seal-rgb`）。

---

## 模块规划与任务清单

### 模块一：鼠标与指针微交互（Ink & Seal Pointer）

- [x] **Task 1.1: 朱砂落印点击涟漪 (Cinnabar Stamp Ripple)**
  - **表现**：全站任意空白处点击时，在光标中心展开一圈极淡的朱砂红波纹（`--color-seal-soft`），并随机隐现一枚淡红小印章轮廓（如「雪」、「墨」、「诗」、「印」、「云」篆字）。
  - **实现方案**：纯原生 JS 监听 `pointerdown`，动态生成带有 CSS keyframe 动画的轻量 DOM 节点，400ms 后自销毁；避免使用 heavy canvas。
  - **落位**：`src/scripts/stamp-ripple.js`，通过 `BaseLayout.astro` 引入。

- [x] **Task 1.2: 水墨游丝笔触光标 (Ink Trail Cursor)**
  - **表现**：
    - 默认光标跟随一个微小墨点；
    - 移动时后方拖曳出 15~20 节水墨骨架游丝，如毛笔落纸般平滑减速、淡出；
    - 悬停在链接、按钮、卡片时，光标平滑展开为朱砂方印轮廓，增强交互感知。
  - **实现方案**：全屏透明 Canvas 覆盖层（`pointer-events: none`），仅在支持鼠标悬停的设备加载；采用轻量贝塞尔平滑插值。
  - **落位**：`src/scripts/ink-cursor.js` 或作为独立轻量挂载脚本。

---

### 模块二：宣纸与卡片实体物理感（Paper Tilt & Sheen）

- [x] **Task 2.1: 宣纸卡片 3D 微倾斜 (Paper 3D Tilt)**
  - **表现**：
    - 鼠标悬停在卡片（首页 5 大入口卡片、`/archives` 文章卡片）时，卡片随鼠标相对位置产生微小 3D 旋转（角度 ≤ 4deg）；
    - 移出时光滑缓动复位。
  - **实现方案**：基于 CSS Transform 变量驱动（`--tilt-x`, `--tilt-y`），通过极简事件监听注入样式，避免引入重型外部依赖。
  - **落位**：`src/scripts/paper-tilt.js`，通过 `data-tilt` 属性在目标卡片声明式激活。

- [x] **Task 2.2: 宣纸反光流动微光 (Paper Sheen)**
  - **表现**：卡片倾斜时，表面划过一层倾斜的漫反射微光（纸张纤维光泽），与 3D 角度联动。
  - **实现方案**：CSS 伪元素 `::after` 配合径向渐变与混合模式，通过 CSS 变量动态偏移。

---

### 模块三：文人雅趣特色交互（Poem Fortune / 拈阄日签）

- [x] **Task 3.1: 抽诗签交互挂件组件 (`PoemFortune.vue`)**
  - **表现**：
    - 首页右下角常驻一枚古朴的「诗签」挂牌（朱印小签筒或折角木质签）；
    - 点击后触发抽签动画（竹签轻摇 / 诗笺缓缓展开）；
    - 随机呈现一句作者过往创作的古典诗词名句，显示作者、词牌名/诗名；
    - 交互面板提供：
      1. 「前往品读」：一键导航到该诗词文章详情；
      2. 「再拈一签」：重新摇签换句；
      3. 「复制名句」：将佳句与出处复制到剪贴板。
  - **数据支撑**：复用 `src/data/poetry-wall.json` 中已有的 81 首诗词数据，提取金句列表与 slug 权威映射。
  - **落位**：`src/components/PoemFortune.vue`，在 `src/pages/index.astro` 挂载为独立岛。

---

### 模块四：长文阅读伴侣（Reading Seal Companion）

- [x] **Task 4.1: 朱砂印阅读进度指示器 (`ReadingSeal.vue`)**
  - **表现**：
    - 在博文详情页（`src/pages/posts/[slug].astro`）右下角显示一枚极简正方形朱砂石印章徽标；
    - 印章内部刻有古典篆文「顶」或印纹；
    - 页面向下滚动时，朱砂红墨汁（SVG 描边/填充蒙版）自下而上注入，实时反馈阅读百分比；
    - 悬停浮现「回顶」提示，点击平滑回顶并产生一次落章按压微动效。
  - **落位**：`src/components/ReadingSeal.vue`，集成至文章详情页模版。

---

### 模块五：意境环境氛围（Yuki Snow Particles）

- [x] **Task 5.1: 随风碎雪粒子 Canvas (`YukiSnow.vue`)**
  - **表现**：
    - 呼应站名 "Yuki"（雪）：背景层下落稀疏、轻柔的碎雪粒子（数量控制在 35~45 颗）；
    - **风场扰动交互**：鼠标快速掠过屏幕时，雪花受到物理排斥或微风推挤，自然向两侧翩跹掠开；
    - **主题自适应**：白昼模式下为半透明暖雪白，夜间模式下为皎洁月光白微粒；
    - **环境开关**：在页脚（或控制栏）提供极简的「飘雪开关」微图标，状态持久化到 `localStorage['yuki-snow']`。
  - **落位**：`src/components/YukiSnow.vue`，通过 `BaseLayout.astro` 条件渲染。

---

## 阶段实施路线图 (Execution Milestones)

| 阶段 | 任务目标 | 关键产出 | 预期验证方式 |
| :--- | :--- | :--- | :--- |
| **Phase 1** | 极简微交互先行 | 朱砂落印波纹 (`stamp-ripple.js`) + 宣纸卡片 3D 微倾 (`paper-tilt.js`) | 本地 preview 悬停与点击测试 |
| **Phase 2** | 长文伴侣与光标 | 朱砂印阅读进度 (`ReadingSeal.vue`) + 水墨游丝微光标 (`ink-cursor.js`) | 文章页滚动注墨、桌面光标平滑度与移动端禁用 |
| **Phase 3** | 文人雅趣核心功能 | 拈阄·抽诗签挂件 (`PoemFortune.vue`) | 首页抽取 81 篇诗词金句与跳转断言 |
| **Phase 4** | 意境氛围与控制项 | 随风落雪微风交互 (`YukiSnow.vue`) + 状态持久化与减弱动效回退 | 鼠标排斥测试、开关状态与夜间模式适配 |
| **Phase 5** | 全量构建与回归 | `npm run build` 全绿、产物样式与 View Transitions 换页无缝测试 | 确保 0 DOM 破损、无 `<Teleport>`、构建顺利通过 |
