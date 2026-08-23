# Back-compat wrapper -> real-perf-check.ps1 (Chrome, GPU+CPU+RAM)
param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [int]$Seconds = 6
)
& (Join-Path $PSScriptRoot "real-perf-check.ps1") -BaseUrl $BaseUrl -Seconds $Seconds
