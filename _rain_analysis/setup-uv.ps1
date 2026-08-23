# 在 _rain_analysis 目录建立 uv 环境与本地 Playwright 浏览器（不写 C 盘用户目录）
param(
    [switch]$UseProxy
)

$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Here
. (Join-Path $Here "env-uv.ps1")

if ($UseProxy) { Enable-RainProxy }

Write-Host ">> clear mistaken C:\Users\...\AppData\Local\ms-playwright (if any)"
Clear-CPlaywright

Write-Host ">> uv sync (venv: $env:UV_PROJECT_ENVIRONMENT)"
uv sync

Write-Host ">> playwright install chromium (browsers: $env:PLAYWRIGHT_BROWSERS_PATH)"
uv run playwright install chromium

Clear-CPlaywright

Write-Host "OK. 用法:"
Write-Host "  .\run-capture.ps1 -Tag iter71 -UseProxy   # 截图"
Write-Host "  .\run-perf.ps1                            # FPS"
Write-Host "  uv run python quant_pair.py --ref frame_010.png --loc local/iter71.png"
