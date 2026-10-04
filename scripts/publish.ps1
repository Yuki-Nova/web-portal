<#
.SYNOPSIS
  web-portal 一键发布：git 基线 → 构建 → 产物断言 → 打包 → 上传 → 落位 → 校验。

.DESCRIPTION
  发布形态为「纯静态覆盖」，不改 Nginx、不重启任何服务（见 DEPLOY.md 第八节的运维坑）。
  站点根与产物阈值以 2026-10-05 服务器只读核实结果为准。

  兼容 Windows PowerShell 5.1 与 PowerShell 7（不用 ?: 与 ?? 之类的新语法）。
  本文件必须以 UTF-8 with BOM 保存，否则 5.1 会把中文注释读成乱码。

.EXAMPLE
  pwsh -NoProfile -File scripts\publish.ps1 -Message "新增博文《xxx》"
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\publish.ps1 -Message "修正错别字"

.EXAMPLE
  # 只看会执行什么，不做任何改动
  pwsh -NoProfile -File scripts\publish.ps1 -DryRun
#>
[CmdletBinding()]
param(
    # git 提交说明（中文简述，不加 Conventional Commits 前缀）；工作区有改动时必填
    [string]$Message = '',

    # 复用现有 dist，不重新构建
    [switch]$SkipBuild,

    # 只打印将执行的命令，不做任何改动
    [switch]$DryRun,

    # 删除远端站点根里不在本次产物内的多余文件（默认只报告不删除）
    [switch]$Prune,

    # 跳过发布后的 curl 校验
    [switch]$NoVerify,

    [string]$SshHost = 'root@121.43.153.125',
    [string]$RemoteRoot = '/www/wwwroot/yukinova.top-new',
    [string]$SiteBaseUrl = 'https://yukinova.top',

    # 精确阈值校验，0 表示不做精确比对（默认；结构完整性断言始终执行）
    [int]$ExpectHtml = 0,
    [int]$ExpectFiles = 0
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = New-Object System.Text.UTF8Encoding $false

# ---------- 基础工具函数 ----------

$script:ProjectRoot = Split-Path -Parent $PSScriptRoot
$script:StepNo = -1   # 第一步是「步骤 0/8 前置检查」
$script:StepTotal = 8

function Info {
    param([string]$Text)
    Write-Host ("[publish] " + $Text) -ForegroundColor Cyan
}

function Step {
    param([string]$Text)
    $script:StepNo = $script:StepNo + 1
    Write-Host ''
    Write-Host ("=== 步骤 {0}/{1}：{2} ===" -f $script:StepNo, $script:StepTotal, $Text) -ForegroundColor White
}

function Warn {
    param([string]$Text)
    Write-Host ("[warn] " + $Text) -ForegroundColor Yellow
}

function Die {
    param([string]$Text)
    Write-Host ("[FAIL] " + $Text) -ForegroundColor Red
    exit 1
}

# 执行外部命令并取回合并后的输出；失败即中止（AllowFailure 时只返回输出）
function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [switch]$AllowFailure
    )
    $errFile = [System.IO.Path]::GetTempFileName()
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $stdout = & $FilePath @Arguments 2> $errFile
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    $err = ''
    if (Test-Path $errFile) {
        $err = Get-Content $errFile -Raw
        Remove-Item $errFile -Force -ErrorAction SilentlyContinue
    }
    $text = (@($stdout) -join "`n")
    if ($err) { $text = ($text + "`n" + $err).Trim() }
    if (-not $AllowFailure -and $code -ne 0) {
        Die ("{0} 执行失败（exit={1}）：`n{2}" -f $FilePath, $code, $text)
    }
    return $text
}

# 把一段 bash 脚本经 stdin 交给远端执行。
# 关键：PowerShell here-string 会带 CRLF，远端会把 "\r" 当成命令的一部分
# （实测 xargs 报 "md5sum\r: No such file or directory"、tail 报 invalid context），
# 因此这里统一把行尾规范成 LF。
function Invoke-Remote {
    param(
        [Parameter(Mandatory = $true)][string]$Script,
        [switch]$Capture
    )
    $norm = $Script -replace "`r`n", "`n" -replace "`r", "`n"
    if ($DryRun) {
        Write-Host ("  [dry-run] ssh {0} <<'BASH'" -f $SshHost) -ForegroundColor DarkGray
        foreach ($line in ($norm -split "`n")) { Write-Host ("  | " + $line) -ForegroundColor DarkGray }
        Write-Host '  BASH' -ForegroundColor DarkGray
        return ''
    }
    $errFile = [System.IO.Path]::GetTempFileName()
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $stdout = $norm | & ssh -o BatchMode=yes -o ConnectTimeout=15 $SshHost 'bash -s' 2> $errFile
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    $err = ''
    if (Test-Path $errFile) {
        $err = Get-Content $errFile -Raw
        Remove-Item $errFile -Force -ErrorAction SilentlyContinue
    }
    $text = (@($stdout) -join "`n").Trim()
    if ($err) { $text = ($text + "`n" + $err).Trim() }
    if ($Capture) { return $text }
    if ($text) { Write-Host $text }
    if ($code -ne 0) { Die ("远端命令失败（exit={0}）：`n{1}" -f $code, $text) }
    return $text
}

# ---------- 步骤 0：前置检查 ----------

Step '前置检查'
Set-Location $script:ProjectRoot
Info ("工程目录：" + $script:ProjectRoot)
Info ("发布目标：" + $SshHost + ":" + $RemoteRoot)

foreach ($tool in @('git', 'tar', 'scp', 'ssh', 'curl.exe')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Die ("缺少命令：" + $tool)
    }
}
# npm 走 .cmd，避开 5.1 的 npm.ps1 执行策略问题
$npmCmd = 'npm.cmd'
if (-not (Get-Command $npmCmd -ErrorAction SilentlyContinue)) { $npmCmd = 'npm' }

$keyPath = Join-Path $env:USERPROFILE '.ssh\id_ed25519'
if (-not (Test-Path $keyPath)) {
    Warn ("未找到 " + $keyPath + "，若使用口令登录，脚本会因 BatchMode 直接失败")
}

$probe = Invoke-Remote -Script 'echo SSH_OK' -Capture
if ($DryRun) {
    Info '（dry-run）跳过免密探测'
} elseif ($probe -notmatch 'SSH_OK') {
    Die ("免密 SSH 不通：{0}`n  请先部署公钥（一次即可）：`n  type `$env:USERPROFILE\.ssh\id_ed25519.pub | ssh {0} `"mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys`"" -f $SshHost)
} else {
    Info '免密 SSH 正常'
}

# ---------- 步骤 1：git 基线 ----------

Step 'git 基线'
# 自动同步诗词墙数据，保证 Markdown 与诗词墙绝对一致
$syncScript = Join-Path $script:ProjectRoot 'scripts\sync-poetry-wall.mjs'
if (Test-Path $syncScript) {
    Info "执行诗词墙数据同步 ..."
    Invoke-Native node.exe @($syncScript) | Out-Null
}

$prevSha = (Invoke-Native git.exe @('rev-parse', '--short', 'HEAD')).Trim()
$dirty = (Invoke-Native git.exe @('status', '--porcelain')).Trim()
if ($dirty) {
    if (-not $Message) {
        $blogDir = Join-Path $script:ProjectRoot 'src\content\blog'
        $newest = Get-ChildItem $blogDir -Filter *.md | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($dirty -match 'src[/\\]content[/\\]blog' -and $newest) {
            $Message = "更新博文《" + $newest.BaseName + "》"
            Info ("未提供 -Message，已自动提取博文标题：" + $Message)
        } else {
            $Message = "更新站点内容与组件"
            Info ("未提供 -Message，使用默认提交信息：" + $Message)
        }
    }
    Info ("提交改动：" + $Message)
    if (-not $DryRun) {
        Invoke-Native git.exe @('add', '-A') | Out-Null
        Invoke-Native git.exe @('commit', '-m', $Message) | Out-Null
    }
} else {
    Info '工作区干净，无需提交'
}
$sha = (Invoke-Native git.exe @('rev-parse', '--short', 'HEAD')).Trim()
Info ("本次发布基线：" + $sha + "（上一版：" + $prevSha + "）")

# ---------- 步骤 2：构建 ----------

Step '构建'
$distPath = Join-Path $script:ProjectRoot 'dist'
if ($SkipBuild) {
    Info '按 -SkipBuild 复用现有 dist'
} elseif ($DryRun) {
    Write-Host ("  [dry-run] {0} run build" -f $npmCmd) -ForegroundColor DarkGray
} else {
    Info ("执行 " + $npmCmd + " run build ...")
    $buildOut = Invoke-Native $npmCmd @('run', 'build')
    Write-Host $buildOut
}

# ---------- 步骤 3：产物断言 ----------

Step '产物断言'
if (-not (Test-Path $distPath)) { Die 'dist 目录不存在，构建可能失败' }

$required = @('index.html', '404.html', 'search-index.json', 'gallery.json', 'cipai.json')
foreach ($r in $required) {
    if (-not (Test-Path (Join-Path $distPath $r))) { Die ("产物缺少必要文件：" + $r) }
}

$distFiles = @(Get-ChildItem $distPath -Recurse -File)
$htmlCount = @($distFiles | Where-Object { $_.Extension -eq '.html' }).Count
$totalKb = [math]::Round((($distFiles | Measure-Object -Property Length -Sum).Sum / 1KB), 0)

# 自洽性断言：产物里的文章页数必须等于源 md 篇数（新增文章后依然成立）
$srcPosts = @(Get-ChildItem (Join-Path $script:ProjectRoot 'src\content\blog') -Filter *.md -File).Count
$postsDir = Join-Path $distPath 'posts'
$builtPosts = 0
if (Test-Path $postsDir) { $builtPosts = @(Get-ChildItem $postsDir -Directory).Count }
if ($builtPosts -ne $srcPosts) {
    Die ("文章页数不一致：源 $srcPosts 篇，产物 $builtPosts 篇（构建不完整）")
}

if ($htmlCount -lt 100) { Die ("产物 html 数仅 $htmlCount，疑似空构建或构建中断") }
if ($ExpectHtml -gt 0 -and $htmlCount -ne $ExpectHtml) { Die ("html 数 = $htmlCount，期望 $ExpectHtml") }
if ($ExpectFiles -gt 0 -and $distFiles.Count -ne $ExpectFiles) { Die ("文件数 = $($distFiles.Count)，期望 $ExpectFiles") }

Info ("产物校验通过：$htmlCount 个 html、$($distFiles.Count) 个文件、$totalKb KB；文章 $builtPosts 篇与源一致")

$localIdx = Join-Path $distPath 'search-index.json'
$localIdxSize = (Get-Item $localIdx).Length

# ---------- 步骤 4：打包 ----------

Step '打包产物'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$localTar = Join-Path $env:TEMP ("web-portal-dist-" + $stamp + ".tar.gz")
$remoteTar = "/tmp/web-portal-dist-" + $stamp + ".tar.gz"
Info ("本地包：" + $localTar)
Info ("远端包：" + $remoteTar)
if ($DryRun) {
    Write-Host ("  [dry-run] tar -czf {0} -C {1} ." -f $localTar, $distPath) -ForegroundColor DarkGray
} else {
    Invoke-Native tar.exe @('-czf', $localTar, '-C', $distPath, '.') | Out-Null
    $tarKb = [math]::Round(((Get-Item $localTar).Length / 1KB), 0)
    Info ("打包完成：" + $tarKb + " KB")
}

# ---------- 步骤 5：上传 ----------

Step '上传到服务器'
if ($DryRun) {
    Write-Host ("  [dry-run] scp {0} {1}:{2}" -f $localTar, $SshHost, $remoteTar) -ForegroundColor DarkGray
} else {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Invoke-Native scp.exe @('-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', $localTar, ($SshHost + ':' + $remoteTar)) | Out-Null
    $sw.Stop()
    Info ("上传完成，耗时 " + [math]::Round($sw.Elapsed.TotalSeconds, 1) + " 秒")
}

# ---------- 步骤 6：远端落位 ----------

Step '远端落位'
# 落位完整性门禁：解压后远端必须一个都不少（用于发现解压中断/权限问题）
$missingBlock = @'
MISSING=$(comm -23 /tmp/expected.lst /tmp/actual.lst | wc -l)
echo "REMOTE_MISSING=$MISSING"
if [ "$MISSING" -gt 0 ]; then
  echo "--- 缺失文件（前 20 条）---"
  comm -23 /tmp/expected.lst /tmp/actual.lst | head -20
fi
'@

$pruneBlock = @'
# 只报告不删除（默认）
EXTRA=$(comm -13 /tmp/expected.lst /tmp/actual.lst | wc -l)
echo "REMOTE_EXTRA=$EXTRA"
'@
if ($Prune) {
    $pruneBlock = @'
# 删除远端多余文件（-Prune）
comm -13 /tmp/expected.lst /tmp/actual.lst | grep -v -E '^/|\.\.' > /tmp/extra.lst
EXTRA=$(wc -l < /tmp/extra.lst)
echo "REMOTE_EXTRA=$EXTRA"
if [ "$EXTRA" -gt 0 ]; then
  echo "--- 将被删除的远端多余文件（前 40 条）---"
  head -40 /tmp/extra.lst
  echo "--- 开始删除 ---"
  while IFS= read -r f; do [ -n "$f" ] && rm -f "$f"; done < /tmp/extra.lst
  find . -type d -empty -delete
  echo "--- 删除完成 ---"
fi
'@
}

$remoteScript = @"
set -e
mkdir -p '$RemoteRoot'
cd '$RemoteRoot'

# 部署前快照远端文件清单（便于排查与手工回滚）
find . -type f | sed 's|^\./||' | sort > '/root/web-portal-deploy-$stamp.lst'

# 期望清单 = 本次包内文件
# 注意：tar 的根条目 "./" 经 sed 后是空行，必须 grep -v '^$' 去掉，
# 否则 comm 会误报“缺失 1 个文件”（2026-10-05 实跑踩到）。
tar -tzf '$remoteTar' | sed 's|^\./||' | grep -v '/$' | grep -v '^$' | sort > /tmp/expected.lst

tar -xzf '$remoteTar' -C '$RemoteRoot'

# Windows 版 bsdtar 会把 Windows 的文件模式（目录 777 / 文件 666）写进归档，
# GNU tar 解压时照搬，线上权限会被放宽（2026-10-05 实跑踩到：全站变 777/666）。
# 因此解压后统一归一化回 755 / 644，再改属主。
find '$RemoteRoot' -type d -exec chmod 755 {} +
find '$RemoteRoot' -type f -exec chmod 644 {} +
chown -R www:www '$RemoteRoot'

# 远端现有清单
find . -type f | sed 's|^\./||' | sort > /tmp/actual.lst

$missingBlock

$pruneBlock

rm -f '$remoteTar' /tmp/expected.lst /tmp/actual.lst
echo DEPLOY_DONE
"@

$deployOut = Invoke-Remote -Script $remoteScript -Capture
if ($DryRun) {
    Info '（dry-run）跳过落位'
} else {
    Write-Host $deployOut
    if ($deployOut -notmatch 'DEPLOY_DONE') { Die '远端落位未返回 DEPLOY_DONE，请手工检查' }
    $missingMatch = [regex]::Match($deployOut, 'REMOTE_MISSING=(\d+)')
    if ($missingMatch.Success -and [int]$missingMatch.Groups[1].Value -gt 0) {
        Die ("远端落位后缺失 " + $missingMatch.Groups[1].Value + " 个文件（见上方清单），请检查权限与磁盘后重跑")
    }
    $extraMatch = [regex]::Match($deployOut, 'REMOTE_EXTRA=(\d+)')
    if ($extraMatch.Success) {
        $extraCount = [int]$extraMatch.Groups[1].Value
        if ($extraCount -gt 0 -and -not $Prune) {
            Warn ("远端有 $extraCount 个文件不在本次产物中（未删除；加 -Prune 可清理）")
        }
    }
    Info '落位完成（未 reload Nginx，纯静态覆盖无需重启）'
}

# ---------- 步骤 7：发布后校验 ----------

Step '发布后校验'
# 校验只发 GET，不改任何东西，因此 -DryRun 下也照跑（顺便验证校验逻辑本身）
if ($NoVerify) {
    Info '按参数跳过校验'
} else {
    # 取源目录中最新修改的文章做中文 slug 校验（确保校验到最新发布的那篇）
    $blogDir = Join-Path $script:ProjectRoot 'src\content\blog'
    $newestFile = Get-ChildItem $blogDir -Filter *.md | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $newestSlug = ''
    $newestTitle = ''
    if ($newestFile) {
        $slugName = $newestFile.BaseName -replace '\s+', '-'
        $newestSlug = [System.Uri]::EscapeDataString($slugName)
        $newestTitle = $newestFile.BaseName
    }

    $checks = @(
        @{ Path = '/'; Expect = 200; Name = '首页' },
        @{ Path = '/poems/'; Expect = 200; Name = '诗词墙' },
        @{ Path = '/archives/'; Expect = 200; Name = '文集编年' },
        @{ Path = '/search-index.json'; Expect = 200; Name = '检索索引' },
        @{ Path = '/gallery.json'; Expect = 200; Name = '相册快照' },
        @{ Path = '/no-such-page-xyz'; Expect = 404; Name = '404 页' }
    )
    if ($newestSlug) {
        $checks += @{ Path = ('/posts/' + $newestSlug + '/'); Expect = 200; Name = ('文章页 ' + $newestTitle) }
    }

    $hits = 0
    $miss = 0
    $idxSize = -1
    foreach ($c in $checks) {
        $url = $SiteBaseUrl + $c.Path
        $res = (Invoke-Native curl.exe @('-s', '-o', 'NUL', '-w', '%{http_code} %{size_download} %{time_total}', '--max-time', '20', $url) -AllowFailure).Trim()
        $parts = $res -split '\s+'
        $code = 0
        if ($parts.Count -ge 1 -and $parts[0] -match '^\d+$') { $code = [int]$parts[0] }
        if ($c.Path -eq '/search-index.json' -and $parts.Count -ge 2) { $idxSize = [int]$parts[1] }

        $ok = ($code -eq $c.Expect)
        if ($ok) { $hits = $hits + 1 } else { $miss = $miss + 1 }
        $flag = 'OK  '
        if (-not $ok) { $flag = 'BAD ' }
        Write-Host ("  [{0}] {1,-16} 期望 {2} 实际 {3}  {4}" -f $flag, $c.Name, $c.Expect, $code, $url) -ForegroundColor $(if ($ok) { 'Gray' } else { 'Red' })
    }

    Info ("校验结果：" + $hits + " 项通过，" + $miss + " 项异常")

    # 新鲜度校验：线上 search-index.json 字节数应与本地产物一致（不一致通常是缓存或落位没生效）
    if ($idxSize -ge 0) {
        if ($idxSize -eq $localIdxSize) {
            Info ("新鲜度校验通过：search-index.json 线上/本地同为 " + $localIdxSize + " 字节")
        } else {
            Warn ("新鲜度存疑：search-index.json 线上 " + $idxSize + " 字节、本地 " + $localIdxSize + " 字节（可能命中了缓存或压缩）")
        }
    }

    if ($miss -gt 0) { Warn '存在异常项，未自动回滚；请按下方回滚命令处理' }
}

# ---------- 步骤 8：摘要与回滚提示 ----------

Step '发布摘要'
Write-Host ''
Write-Host '  发布完成' -ForegroundColor Green
Write-Host ("    基  线 ：" + $sha)
Write-Host ("    产  物 ：" + $htmlCount + " 个 html / " + $distFiles.Count + " 个文件 / " + $totalKb + " KB")
Write-Host ("    目  标 ：" + $SshHost + ":" + $RemoteRoot)
Write-Host ("    远端快照：/root/web-portal-deploy-" + $stamp + ".lst")
Write-Host ''
Write-Host ("  回滚到上一版（" + $prevSha + "）：") -ForegroundColor Yellow
Write-Host ("    git checkout " + $prevSha)
Write-Host  '    npm run build'
Write-Host ("    pwsh -NoProfile -File scripts\publish.ps1 -SkipBuild")

# 成功收尾才清本地临时包；失败时保留，便于排查
if (-not $DryRun) {
    if (Test-Path $localTar) { Remove-Item $localTar -Force -ErrorAction SilentlyContinue }
}
