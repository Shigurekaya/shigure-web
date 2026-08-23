# FPS 基准：先起 serve-local.py，再测三模式
$ErrorActionPreference = "Stop"
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Root = Split-Path -Parent $Here
$Port = if ($env:RAIN_PORT) { $env:RAIN_PORT } else { "3000" }
$Base = "http://127.0.0.1:$Port"

. (Join-Path $Here "env-uv.ps1")

if (-not (Test-Path (Join-Path $Here ".venv\Scripts\python.exe"))) {
  & (Join-Path $Here "setup-uv.ps1")
}

$serve = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if (-not $serve) {
  Write-Host ">> 启动本地服务 $Base ..."
  $py = Join-Path $Here ".venv\Scripts\python.exe"
  Start-Process -FilePath $py -ArgumentList (Join-Path $Root "serve-local.py"), "--port", $Port -WorkingDirectory $Root -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

Set-Location $Here
uv run python perf_weather.py $Base
