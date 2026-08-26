#Requires -Version 5.1
# 本地静态服 — 固定 127.0.0.1:3456（见 docs/local-dev.md）
# 端口占用时自动结束监听进程再启动
$ErrorActionPreference = "Stop"
$HostAddr = "127.0.0.1"
$Port = 3456
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root

function Stop-PortListener {
    param(
        [string]$BindHost,
        [int]$ListenPort
    )

    $needle = if ($BindHost -eq "0.0.0.0") { ":$ListenPort" } else { "${BindHost}:$ListenPort" }
    $pids = @(
        netstat -ano |
            Select-String ([regex]::Escape($needle)) |
            ForEach-Object {
                if ($_.Line -match 'LISTENING\s+(\d+)\s*$') { [int]$Matches[1] }
            } |
            Where-Object { $_ -gt 0 } |
            Sort-Object -Unique
    )

    foreach ($procId in $pids) {
        try {
            $proc = Get-Process -Id $procId -ErrorAction Stop
            Write-Host "Port $ListenPort in use by $($proc.ProcessName) (PID $procId), stopping..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force
        } catch {
            Write-Warning "Could not stop PID ${procId}: $_"
        }
    }

    if ($pids.Count -gt 0) {
        Start-Sleep -Milliseconds 500
    }
}

Stop-PortListener -BindHost $HostAddr -ListenPort $Port
Write-Host "http://${HostAddr}:${Port}/" -ForegroundColor Cyan
uv run python .\serve-local.py --host $HostAddr --port $Port
