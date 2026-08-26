@echo off
setlocal EnableExtensions
chcp 65001 >nul 2>&1
title shigure-web 本地服务
cd /d "%~dp0"

set "HOST=127.0.0.1"
set "PORT=3456"
set "URL=http://%HOST%:%PORT%/"

echo.
echo  shigure-web 本地开发服务器
echo  %URL%
echo  文档: docs\local-dev.md
echo.

REM 端口被占用时结束监听进程（与 start-local.ps1 行为一致）
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%PORT%'; $h='%HOST%'; $needle=($h+':'+$p); $pids=@(netstat -ano | Select-String ([regex]::Escape($needle)) | ForEach-Object { if($_.Line -match 'LISTENING\s+(\d+)\s*$'){[int]$matches[1]} } | Where-Object {$_ -gt 0} | Sort-Object -Unique); foreach($id in $pids){ try { $pn=(Get-Process -Id $id -ErrorAction Stop).ProcessName; Write-Host ('端口 '+$p+' 被 '+$pn+' (PID '+$id+') 占用，正在结束...') -ForegroundColor Yellow; Stop-Process -Id $id -Force -ErrorAction Stop } catch {} }; if($pids.Count -gt 0){ Start-Sleep -Milliseconds 500 }"

where uv >nul 2>&1
if errorlevel 1 (
  echo [错误] 未找到 uv。
  echo        安装: https://docs.astral.sh/uv/getting-started/installation/
  echo        然后在本目录执行: uv sync
  pause
  exit /b 1
)

if not exist ".venv\" (
  echo 首次运行，正在 uv sync ...
  uv sync
  if errorlevel 1 (
    echo [错误] uv sync 失败
    pause
    exit /b 1
  )
)

REM 等服务就绪后自动打开浏览器
start /min cmd /c "ping -n 3 127.0.0.1 >nul && start "" "%URL%""

echo 服务运行中，按 Ctrl+C 停止。
echo.
uv run python serve-local.py --host %HOST% --port %PORT%

echo.
echo 服务已停止。
pause
endlocal
