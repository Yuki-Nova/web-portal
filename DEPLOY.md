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

## 三、服务器现状（2026-10-03 实测，只读巡检）

主机 `121.43.153.125`：40G 盘用 29%（27G 可用）、内存 1608MB（available 717MB）、已运行 100 天。Nginx 1.18.0，由宝塔管理（`systemctl is-active nginx` 显示 inactive 属正常，master 由 `/www/server/nginx/sbin/nginx` 启动，监听 80/443）。

**主域 `/www/server/panel/vhost/nginx/yukinova.top.conf`**

| 行 | 现状 | 处置 |
|---|---|---|
| 8 | `server_name yukinova.top;` | 不动 |
| 10 | `root /www/wwwroot/yukinova.top;` | **改指向新目录** |
| 49 | `error_page 404 /404.html;` | **已存在**，无需新增 |
| 61 | `location /hook { proxy_pass https://127.0.0.1:8888; }` | 不动（宝塔 hook） |
| 69 | `location = /poetry { return 301 /poetry/; }` | 保留 |
| 73 | `location /poetry/ { alias /www/wwwroot/poetry/tool/dist/; }` | **删除**（改由新产物提供） |
| 78 | `include …/proxy/yukinova.top/*.conf;` | 其中的 `/images/` 反代需移走 |

**`proxy/yukinova.top/59b5…_yukinova.top.conf`**（该文件仅此一条规则）

```nginx
location ^~ /images/ { proxy_pass http://127.0.0.1:3000/; ... }
```

→ 整条移走（新站 `/images/` 是静态目录）。

**运行中的服务**

| 服务 | 监听 | 处置 |
|---|---|---|
| nginx | 80 / 443 | 不动 |
| **images-server**（`node /www/wwwroot/images/app.js`，pm2 托管） | `*:3000` | **保留** → `/api/` 反代继续可用 |
| bookswich（uvicorn） | 127.0.0.1:8001 | 不动 |
| wsgidav（webdav） | 127.0.0.1:8081 | 不动 |

**站点目录 `/www/wwwroot/`**：`yukinova.top`（旧 Hexo 产物，含 `2025/ 2026/ archives/ atom.xml categories/ css/ js/ page/ poetry-wall/ search.json` 等）、`poetry`、`poetrytool`、`images`、`images.bak-20260813`、`bookswich`、`webdav`、`herb-*`。旧目录**保持不动**作为回滚资产。

### ⚠️ 巡检发现的关键问题：`/api` 没有反代

现有 nginx **不存在 `location /api/`**。旧相册页面本身由 `:3000` 直出，前端用相对路径（`api/images` → 实际请求 `/images/api/images`），因此能借道 `^~ /images/` 反代命中后端。

而新站 `GalleryView.vue` 用的是**绝对路径** `/api/images`——切换后若不加反代，请求会落到站点 root 变 404，相册的「实时同步 / 保存分类 / 删除图片」三项全部失效（页面不会崩，会静默退回静态快照，但功能没了）。

→ **必须在主域配置补一条**：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;   # 注意不带尾斜杠，保留 /api 前缀
    proxy_set_header Host 127.0.0.1;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

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

4. **生效与自检**（⚠️ 本机踩过的坑，见第八节）
   ```bash
   # 语法检查必须用宝塔自带的 nginx 二进制（系统 nginx 缺 stream 模块会误报）
   /www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf

   # reload 不能用 nginx -s reload（宝塔的 pid 不在 /run/nginx.pid）
   /etc/init.d/nginx reload
   # 或：kill -HUP $(ps aux | grep "nginx: master process" | grep -v grep | awk "{print \$2}" | head -1)
   ```

5. **观察期**：旧目录 `/www/wwwroot/yukinova.top` 至少保留 7 天再清（清理前另行确认）。

## 五、回滚（目标 < 1 分钟）

```bash
cp -a /www/server/panel/vhost/nginx/yukinova.top.conf.bak_<时间戳> \
      /www/server/panel/vhost/nginx/yukinova.top.conf
/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf && /etc/init.d/nginx reload
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

---

## 八、部署结果（2026-10-03 已执行）

切换已完成并通过验收。备份文件：`yukinova.top.conf.bak_20261003-135245`；旧 `/images` 反代规则改名保留为 `…59b5….conf.disabled`（含 `.bak_20261003-135245`）。

**验收实测（服务器本机 curl，HTTPS + Host 头）**

| 路径 | 结果 |
|---|---|
| `/` | 200，`<title>Yuki-Nova · 个人名片</title>`（已是新产物） |
| `/poems` `/poetry` `/images` `/archives` `/categories` `/tags` | 301 → 带尾斜杠（nginx 目录规范化） |
| `/blog` | **301 → https://yukinova.top/poems** ✅ |
| `/posts/%E8%89%AF%E7%8E%89/` | 200 |
| `/search-index.json` `/gallery.json` | 200 |
| `/no-such-page-xyz` | 404 |

**两个必须记住的运维坑**

1. **`nginx -s reload` 在这台机器上无效**——报 `invalid PID number "" in "/run/nginx.pid"`。宝塔的 pid 在 `/www/server/nginx/logs/nginx.pid`。正确做法：`/etc/init.d/nginx reload`，或 `kill -HUP <master pid>`。
2. **语法检查要用宝塔自带的二进制**：`/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf`。直接跑 `nginx -t` 会去检查 `/etc/nginx/nginx.conf`（系统那份），且系统二进制缺 `stream` 模块，会对宝塔配置误报 `unknown directive "stream"`。

**相册后端已补齐（2026-10-03 当日修复）**

切换后发现服务器 `/www/wwwroot/images/app.js`（Sep 5 版）缺少 `GET /api/images` 与 `DELETE /api/images` 两条路由，导致「实时同步 / 删除图片」不可用。已将本地 `my-oss-gallery` 的 `app.js` 部署上去（服务器备份 `app.js.bak_20261003-140004`），`pm2 restart images-server` 后验证：

| 检查 | 结果 |
|---|---|
| `GET /api/images`（公网 https） | **200**，`ok=true`，**360 张**（比构建期快照 353 张多 7 张，实时同步确实生效） |
| `GET /api/categories`（公网） | 200，262 条分类 |
| `DELETE /api/images` 无 token | **401 unauthorized**（正确拒绝；探针使用不存在的 objectKey，未造成任何删除） |
| `POST /api/auth/login` | 401（路由存在） |
| 启动日志 | `🔒 写接口已启用鉴权（X-Auth-Token / ?token=）`、`✅ OSS 连接成功` |

`ADMIN_PASSWORD` 已在 `.env` 中配置，故删除功能可用（前端点击后会要求输入口令换取 token）。

顺带说明该版本的两处行为变化：写接口由 fail-open 改为 **fail-closed**（未配 `ADMIN_PASSWORD` 时拒绝而非放行，更安全）；新增 CORS 响应头 `Access-Control-Allow-Origin: *`（写操作仍需 `X-Auth-Token`，读接口本就是公开数据）。

**回滚该后端**：`cp -a /www/wwwroot/images/app.js.bak_20261003-140004 /www/wwwroot/images/app.js && pm2 restart images-server`

**收尾建议**

- 旧站点目录 `/www/wwwroot/yukinova.top` 保留 7 天做回滚，之后清理前再确认；
- 站内链接目前是无尾斜杠形式（`/poems`），会被 nginx 301 到 `/poems/`，多一跳（同域，影响可忽略）；若要消除可改用尾斜杠链接；
- `robots.txt` 缺失导致爬虫 404（旧站日志里早已如此），可按需补一个。

## 九、旧工程清理（2026-10-03 当天执行）

切换验证通过后，按要求清理了服务器上的旧工程目录，**清理前已打包归档**：

| 目录 | 体积 | 状态 |
|---|---|---|
| `/www/wwwroot/yukinova.top`（旧 Hexo 产物） | 33 MB | 已删 |
| `/www/wwwroot/poetry`（旧填词工具） | 67 MB | 已删 |
| `/www/wwwroot/poetrytool` | 12 KB | 已删 |
| **归档** `/root/_archive/website-old-20261003.tar.gz` | **41 MB** | 保留 |

删除 `poetry` 时初次失败：`tool/dist/.user.ini` 与 `admin/dist/.user.ini` 带**不可变属性**（宝塔加的 `chattr +i`），须先 `chattr -i` 再删。

**本地同步清理**：`PortableHexo`（765 MB，无远程备份）与 `poetry_tool`（272 MB）已删；文章源另存档于 `Website/_archive/PortableHexo-blog-source-20261003.tar.gz`（7.9 MB，含 80 篇 md 与 `_config.yml`）。`my-oss-gallery` 保留（服务器相册后端即源于它）。

### ⚠️ 回滚方式已随之变化

旧目录**不再位于原位**，要回滚到旧站必须先解包：

```bash
mkdir -p /www/wwwroot/_restore
tar -xzf /root/_archive/website-old-20261003.tar.gz -C /www/wwwroot/_restore
# 再把 nginx root 指回 /www/wwwroot/_restore/yukinova.top，并恢复 conf 备份后 reload
```

**清理后回归实测**：`/` 200、`/posts/良玉/` 200、`/search-index.json` `/gallery.json` `/api/images` 均 200、`/blog` 301 → `/poems`、未知路径 404 —— 删除旧目录未影响线上。