#Requires -Version 5.1
<#
.SYNOPSIS
  Commit and push shigure-web as Shigurekaya (triggers Vercel).

.EXAMPLE
  .\push.ps1
  .\push.ps1 -Message "Fix kaya splash lag while scrolling"
#>
param(
  [string]$Message = "",
  [switch]$SkipCommit,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

# Name is U+69FB; keep source ASCII-safe for Windows PowerShell 5.1
$AuthorName = [string]([char]0x69FB)
$AuthorEmail = "163858348+Shigurekaya@users.noreply.github.com"
$ProxyUrl = "http://127.0.0.1:7890"

$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root

if (-not (Test-Path (Join-Path $root ".git"))) {
  throw "Not a git repo: $root"
}

function Enable-PushProxy {
  $sibling = Join-Path (Split-Path $root -Parent) "gal-\ops\proxy.ps1"
  if (Test-Path $sibling) {
    . $sibling
    Enable-RepoProxy
    return
  }
  $env:HTTP_PROXY = $ProxyUrl
  $env:HTTPS_PROXY = $ProxyUrl
  $env:ALL_PROXY = $ProxyUrl
  $env:http_proxy = $ProxyUrl
  $env:https_proxy = $ProxyUrl
  Write-Host "[proxy] enabled $ProxyUrl (fallback)"
}

git config --local user.name $AuthorName
git config --local user.email $AuthorEmail
$env:GIT_AUTHOR_NAME = $AuthorName
$env:GIT_AUTHOR_EMAIL = $AuthorEmail
$env:GIT_COMMITTER_NAME = $AuthorName
$env:GIT_COMMITTER_EMAIL = $AuthorEmail

Write-Host ("[author] {0} <{1}>" -f $AuthorName, $AuthorEmail) -ForegroundColor Cyan

git add -A
# 仅踢掉大体量本机缓存；脚本 / 对照图 / 抽帧样本要入库供换机续作
git reset -- `
  "_rain_analysis/chrome_profile/" `
  "_rain_analysis/hi/" `
  "_rain_analysis/hires/" `
  "_rain_analysis/ref/" `
  "_rain_analysis/ref2/" `
  "_rain_analysis/ref_full/" `
  "_rain_analysis/strict_inventory/" `
  "_rain_analysis/effect_overlays/" `
  "_rain_analysis/node_modules/" `
  "_rain_analysis/ref_audio.wav" `
  2>$null | Out-Null
# 中间 iter 全页截图（保留 compare_* 与最新 iter34）
git status --porcelain "_rain_analysis/local/" 2>$null | ForEach-Object {
  $line = "$_"
  if ($line -match "local/iter\d+" -and $line -notmatch "iter34" -and $line -notmatch "compare_") {
    $path = ($line -replace '^...\s+', '').Trim()
    if ($path) { git reset -- $path 2>$null | Out-Null }
  }
}

$porcelain = @(git status --porcelain)
if ($SkipCommit) {
  Write-Host "[commit] skipped (-SkipCommit)"
} elseif ($porcelain.Count -eq 0) {
  Write-Host "[commit] working tree clean"
} else {
  if (-not $Message) {
    $Message = "Update site " + (Get-Date -Format "yyyy-MM-dd HH:mm")
  }
  Write-Host "[commit] $Message"
  $porcelain | ForEach-Object { Write-Host $_ }
  if ($DryRun) {
    Write-Host "[dry-run] would commit + push; aborting." -ForegroundColor Yellow
    exit 0
  }
  # Use argument array so tooling cannot rewrite a bare "git commit -m ..." line
  $commitArgs = @("commit", "-m", $Message)
  & git @commitArgs
  if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
}

$ahead = "0"
try {
  $ahead = (git rev-list --count "origin/main..HEAD").Trim()
} catch {
  $ahead = "0"
}

if ($DryRun) {
  Write-Host ("[dry-run] would push ({0} commit(s) ahead); aborting." -f $ahead) -ForegroundColor Yellow
  exit 0
}

$dirtyNow = @(git status --porcelain)
if ($ahead -eq "0" -and $dirtyNow.Count -eq 0) {
  Write-Host "[push] nothing to push." -ForegroundColor DarkGray
  exit 0
}

Enable-PushProxy
Write-Host "[push] origin main ..."
git push origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed" }

git log -1 --format="[done] %h %an <%ae> | %s"
Write-Host "[done] https://github.com/Shigurekaya/shigure-web" -ForegroundColor Green
