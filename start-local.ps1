#Requires -Version 5.1
# 本地静态服 — 固定 127.0.0.1:3456（见 docs/local-dev.md）
$ErrorActionPreference = "Stop"
$HostAddr = "127.0.0.1"
$Port = 3456
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root
Write-Host "http://${HostAddr}:${Port}/" -ForegroundColor Cyan
uv run python .\serve-local.py --host $HostAddr --port $Port
