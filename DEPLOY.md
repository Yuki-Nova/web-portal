# DEPLOY.md · web-portal 上线部署方案

> 目标：把 `web-portal` 的静态产物接管 `yukinova.top` 主域，取代原 Hexo 博客 + 相册反代 + 诗词工具 alias 的三段式。
>
> **状态**：方案已就绪，**尚未执行**。服务器侧信息来自既有文档与记忆，标注「待实机确认」的项必须在动手前用只读命令核实。

---

## 一、目标形态

```
yukinova.top（单站静态，Nginx 直接分发 dist/）
  /                    名片 + 门户入口
  /poems               诗词墙（旧 /blog 301 过来）
  /poetry              填词案头（原 alias 旧 dist → 本次改由本工程接管）
  /images              影廊  （原反代 :3000 → 本次改由本工程接管）
  /posts/<slug>/       文章详情（80 篇）
  /archives /categories /tags   列表与分页
  /404.html            自定义错误页
  /search-index.json /gallery.json /cipai.json   按需加载的数据
  /api/*               仍反代 images-server（相册的保存分类 / 删除图片 / 实时同步）
```

关键变化：**`/poetry` 与 `/images` 不再指向旧工程**，全部由 `dist/` 提供；`/api/*` 是否保留取决于 images-server 是否仍在运行（见第三节）。

## 二、产物清单（本地构建后实测）

| 项 | 数值 |
|---|---|
| 页面 | 105 页（`posts/` 80、`tags/` 9、`categories/` 7、`archives/` 4，其余各 1） |
| 文件总数 / 体积 | 124 个 / 3,421 KB |
| HTML 合计 | 106 个（含 `404.html`）/ 1,710 KB |
| 顶层结构 | `_astro/`（构建资源）、`archives/ blog/ categories/ images/ poems/ poetry/ posts/ tags/`、`index.html`、`404.html`、`beian.png`、`favicon.svg`、`search-index.json`、`gallery.json`、`cipai.json` |
| 最大单文件 | `cipai.json` 963 KB（153 词牌，gzip 后约 200 KB） |
| `blog/` 目录 | 只有 1 页——`/blog → /poems` 的跳转页 |

## 三、服务器侧巡检（部署前必做，全部只读）

> 目标机按既有文档为 **121.43.153.125**（yukinova.top 站点群，Ubuntu 22.04 + 宝塔 + Nginx）。以下每一项都**待实机确认**，不要照抄旧文档。

```bash
# 1. 现有 Nginx 站点配置（重点看 /poetry、/images、/api 的处理方式）
nginx -T 2>/dev/null | sed -n '/server_name yukinova.top/,/^}/p'
ls -l /www/server/panel/vhost/nginx/ | head -30

# 2. 站点根现状与磁盘
ls -l /www/wwwroot/
df -h /

# 3. images-server 是否还在跑（决定 /api 反代保不保留）
pm2 list 2>/dev/null || true
ss -lntp | grep -E ':(3000|8001|8081)' || true

# 4. 证书（宝塔管理，确认续期正常）
ls -l /www/server/panel/vhost/cert/yukinova.top/ 2>/dev/null || true
```

**巡检结论决定两件事**：
- `images-server`（:3000）还在 → `location /api/` 保留反代；已退役 → 删掉该段，相册退化为纯静态只读（页面会自动静默降级，不报错）。
- 旧 `/poetry`、`/images` 的 location 必须**删除或改写**，否则会与新产物冲突。

## 四、上线步骤

> 原则：**不覆盖旧目录、先备份配置、可分钟级回滚**。

1. **备份**（服务器上）
   ```bash
   ts=$(date +%Y%m%d-%H%M%S)
   cp -a /www/server/panel/vhost/nginx/yukinova.top.conf \
         /www/server/panel/vhost/nginx/yukinova.top.conf.bak_$ts
   ls -ld /www/wwwroot/yukinova.top && echo "旧站点目录已存在，保留不动"
   ```

2. **上传产物到新目录**（本地打包 → scp → 解压）
   ```powershell
   # 本机（web-portal 根目录）
   tar -czf "$env:TEMP\web-portal-dist.tar.gz" -C dist .
   scp "$env:TEMP\web-portal-dist.tar.gz" root@121.43.153.125:/tmp/
   ```
   ```bash
   # 服务器
   mkdir -p /www/wwwroot/yukinova.top-new
   tar -xzf /tmp/web-portal-dist.tar.gz -C /www/wwwroot/yukinova.top-new
   chown -R www:www /www/wwwroot/yukinova.top-new
   ```

3. **改 Nginx**（目标 server 块，证书段沿用宝塔现有配置）
   ```nginx
   root /www/wwwroot/yukinova.top-new;
   index index.html;

   location / {
       try_files $uri $uri/ =404;
   }

   # 旧路径收敛
   location = /blog  { return 301 /poems; }
   location = /blog/ { return 301 /poems; }

   # 自定义 404
   error_page 404 /404.html;
   location = /404.html { internal; }

   # 构建资源长缓存
   location /_astro/ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   location ~* \.(json|png|svg)$ {
       expires 7d;
       add_header Cache-Control "public";
   }

   # 仅当 images-server(:3000) 仍在运行时保留
   location /api/ {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
   }
   ```

   > **必须删除**旧的 `location /poetry/ { alias ... }`、`location /images/ { proxy_pass ... }`、以及任何指向旧 `poetrytool` / `images` 目录的规则，否则请求会被旧规则截走。

4. **生效与自检**
   ```bash
   nginx -t && nginx -s reload
   ```

5. **观察期**：旧目录 `/www/wwwroot/yukinova.top` 至少保留 7 天再清（清理前另行确认）。

## 五、回滚（目标 < 1 分钟）

```bash
cp -a /www/server/panel/vhost/nginx/yukinova.top.conf.bak_<时间戳> \
      /www/server/panel/vhost/nginx/yukinova.top.conf
nginx -t && nginx -s reload
```

旧站点目录始终未被覆盖，恢复配置即回到原状。**产物与环境互不影响**，因此回滚不需要碰上传的文件。

## 六、验收清单

**服务器侧（curl）**

| 检查 | 期望 |
|---|---|
| `curl -sI https://yukinova.top/` | 200，`text/html` |
| `curl -sI https://yukinova.top/poems` | 200 或 301 → `/poems/` |
| `curl -sI https://yukinova.top/blog` | **301** → `/poems` |
| `curl -sI https://yukinova.top/poetry` | 200 |
| `curl -sI https://yukinova.top/images` | 200 |
| `curl -sI https://yukinova.top/posts/良玉/` | 200 |
| `curl -s https://yukinova.top/cipai.json \| head -c 60` | `{"code":0,...` |
| `curl -sI https://yukinova.top/search-index.json` | 200，`application/json` |
| `curl -sI https://yukinova.top/不存在的页面` | **404** + 自定义页 |
| `curl -sI https://yukinova.top/api/images` | 200（images-server 仍在时） |

**浏览器侧（人工）**

1. 首页名片 + 导航（7 项，无工作台入口）
2. 切夜模式 → 点导航跳 2 个页面 → **不闪昼模式**（坑点 6 的回归）
3. `/poems` 诗词墙：筛选、随机、复制
4. `/poetry`：选词牌 → 输入 → 平仄高亮 / 韵脚；点谱面未创建的行 → 自动补行
5. `/images`：全量出图、灯箱、分类编辑（需 images-server）
6. 搜索：`Ctrl+K` → 输入关键词出结果
7. 页脚：ICP 与公安备案号显示正常

## 七、执行前需要确认的事项

| # | 事项 | 说明 |
|---|---|---|
| 1 | **SSH 凭据** | 121.43.153.125 的 root 口令（会话中提供，不写入任何文件） |
| 2 | **执行方式** | 由我远程执行；或我只输出命令、你在宝塔终端自己跑 |
| 3 | **images-server 去留** | 还在跑 → 保留 `/api` 反代；已退役 → 相册只读，去掉该段 |
| 4 | **旧站点目录** | 保留 7 天做回滚（默认），还是立即清理 |
| 5 | **部署窗口** | 切换瞬间会有极短的重载；是否需要避开某个时间段 |
| 6 | **域名与证书** | 预期不动（沿用现有证书）；若需改动另行确认 |

**未经确认我不会触碰服务器**（用户级规则：涉及服务器操作先确认）。
