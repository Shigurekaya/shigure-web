# 统一 uv / Playwright 环境（全部在 _rain_analysis 目录，不写 C 盘）
$ErrorActionPreference = "Stop"
$Here = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

$script:RainAnalysisRoot = $Here
$script:RainVenv = Join-Path $Here ".venv"
$script:RainBrowsers = Join-Path $Here ".playwright-browsers"

$env:UV_PROJECT_ENVIRONMENT = $script:RainVenv
$env:PLAYWRIGHT_BROWSERS_PATH = $script:RainBrowsers

function Clear-CPlaywright {
    $c = Join-Path $env:LOCALAPPDATA "ms-playwright"
    if (-not (Test-Path $c)) {
        Write-Host "[env-uv] C ms-playwright: already absent"
        return
    }
    Remove-Item -LiteralPath $c -Recurse -Force
    Write-Host "[env-uv] removed $c"
}

function Enable-RainProxy {
    param([string]$Url = "http://127.0.0.1:7890")
    $env:HTTP_PROXY = $Url
    $env:HTTPS_PROXY = $Url
    $env:ALL_PROXY = $Url
    $env:http_proxy = $Url
    $env:https_proxy = $Url
    Write-Host "[env-uv] proxy $Url"
}
