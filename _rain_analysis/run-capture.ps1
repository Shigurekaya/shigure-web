# 大雨截图：uv + 项目内 Playwright 浏览器（勿用 npx / C 盘 ms-playwright）
param(
    [string]$Url = "http://127.0.0.1:3000/?rain=heavy",
    [string]$Tag = "shot",
    [int]$Width = 390,
    [int]$Height = 844,
    [switch]$UseProxy
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "env-uv.ps1")
if ($UseProxy) { Enable-RainProxy }

$env:RAIN_URL = $Url
$env:RAIN_TAG = $Tag
$env:RAIN_W = "$Width"
$env:RAIN_H = "$Height"

Set-Location $RainAnalysisRoot
if (-not (Test-Path (Join-Path $RainVenv "Scripts\python.exe"))) {
    & (Join-Path $RainAnalysisRoot "setup-uv.ps1")
}
if (-not (Test-Path (Join-Path $RainBrowsers "chromium_headless_shell-1234\chrome-headless-shell-win64\chrome-headless-shell.exe"))) {
    Write-Host ">> browsers missing, running setup-uv.ps1 ..."
    if ($UseProxy) { Enable-RainProxy }
    & (Join-Path $RainAnalysisRoot "setup-uv.ps1")
}

uv run python capture_local.py
