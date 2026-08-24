#Requires -Version 5.1
# 本地静态服 — 固定 127.0.0.1:3000（见 docs/local-dev.md）
$ErrorActionPreference = "Stop"
$HostAddr = "127.0.0.1"
$Port = 3000
$root = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $root
Write-Host "http://${HostAddr}:${Port}/" -ForegroundColor Cyan
py -3 .\serve-local.py --host $HostAddr --port $Port
