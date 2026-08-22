# 在 _rain_analysis 目录建立 uv 环境与本地 Playwright 浏览器（不写 C 盘用户目录）
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Here

$Browsers = Join-Path $Here ".playwright-browsers"
$env:PLAYWRIGHT_BROWSERS_PATH = $Browsers
$env:UV_PROJECT_ENVIRONMENT = Join-Path $Here ".venv"

Write-Host ">> uv sync (venv: $env:UV_PROJECT_ENVIRONMENT)"
uv sync

Write-Host ">> playwright install chromium (browsers: $Browsers)"
uv run playwright install chromium

Write-Host "OK. 用法:"
Write-Host "  .\run-perf.ps1"
Write-Host "  uv run python perf_weather.py http://127.0.0.1:3000"
