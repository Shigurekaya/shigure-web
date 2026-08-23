# Real-machine perf check (Chrome): GPU 3D + CPU + RAM
# Usage: .\scripts\real-perf-check.ps1 [-BaseUrl http://127.0.0.1:3000] [-Seconds 6]
param(
  [string]$BaseUrl = "http://127.0.0.1:3000",
  [int]$Seconds = 6,
  [int]$Warmup = 3
)

$ErrorActionPreference = "Stop"

function Find-Chrome {
  @(
    "${env:LocalAppData}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
  ) | Where-Object { Test-Path $_ } | Select-Object -First 1
}

function Get-Gpu3DMax {
  try {
    $c = Get-Counter '\GPU Engine(*engtype_3D*)\Utilization Percentage' -ErrorAction Stop
    $vals = @($c.CounterSamples | ForEach-Object { $_.CookedValue } | Where-Object { $_ -ge 0 })
    if ($vals.Count -eq 0) { return $null }
    return [math]::Round(($vals | Measure-Object -Maximum).Maximum, 1)
  } catch { return $null }
}

function Get-GpuVideoDecodeMax {
  try {
    $c = Get-Counter '\GPU Engine(*engtype_VideoDecode*)\Utilization Percentage' -ErrorAction Stop
    $vals = @($c.CounterSamples | ForEach-Object { $_.CookedValue } | Where-Object { $_ -ge 0 })
    if ($vals.Count -eq 0) { return $null }
    return [math]::Round(($vals | Measure-Object -Maximum).Maximum, 1)
  } catch { return $null }
}

function Get-CpuTotal {
  try {
    $c = Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction Stop
    return [math]::Round($c.CounterSamples[0].CookedValue, 1)
  } catch { return $null }
}

function Get-ChromeTreeStats([string]$ProfileMarker, $prev = $null) {
  $procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ProfileMarker*" }
  if (-not $procs) {
    return @{ cpuPct = $null; ramMb = $null; procs = 0; cpuRaw = 0 }
  }
  $ramMb = 0.0
  $cpuRaw = 0.0
  foreach ($p in $procs) {
    $wp = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
    if ($wp) {
      $ramMb += $wp.WorkingSet64 / 1MB
      $cpuRaw += $wp.CPU
    }
  }
  $cpuPct = $null
  if ($prev -and $prev.cpuRaw -gt 0) {
    $delta = $cpuRaw - $prev.cpuRaw
    $cores = [Math]::Max(1, [Environment]::ProcessorCount)
    $cpuPct = [math]::Round(($delta / $prev.elapsedSec) / $cores * 100, 1)
  }
  return @{
    cpuPct   = $cpuPct
    ramMb    = [math]::Round($ramMb, 1)
    procs    = @($procs).Count
    cpuRaw   = $cpuRaw
    elapsedSec = 1
  }
}

function Stop-ChromeProfile([string]$ProfileMarker) {
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like "*$ProfileMarker*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

function Summarize([double[]]$vals) {
  if (-not $vals -or $vals.Count -eq 0) { return @{ avg = 'n/a'; max = 'n/a'; samples = 0 } }
  return @{
    avg     = [math]::Round((($vals | Measure-Object -Average).Average), 1)
    max     = [math]::Round((($vals | Measure-Object -Maximum).Maximum), 1)
    samples = $vals.Count
  }
}

function Sample-Perf([string]$Label, [int]$Dur, [string]$ProfileMarker) {
  $gpu3d = [System.Collections.Generic.List[double]]::new()
  $gpuVid = [System.Collections.Generic.List[double]]::new()
  $cpuTotal = [System.Collections.Generic.List[double]]::new()
  $cpuChrome = [System.Collections.Generic.List[double]]::new()
  $ramChrome = [System.Collections.Generic.List[double]]::new()

  $prevChrome = $null
  for ($i = 0; $i -lt $Dur; $i++) {
    Start-Sleep -Seconds 1
    $g3 = Get-Gpu3DMax
    $gv = Get-GpuVideoDecodeMax
    $ct = Get-CpuTotal
    $ch = Get-ChromeTreeStats $ProfileMarker $prevChrome
    $prevChrome = @{ cpuRaw = $ch.cpuRaw; elapsedSec = 1 }

    if ($null -ne $g3) { [void]$gpu3d.Add($g3) }
    if ($null -ne $gv) { [void]$gpuVid.Add($gv) }
    if ($null -ne $ct) { [void]$cpuTotal.Add($ct) }
    if ($null -ne $ch.cpuPct) { [void]$cpuChrome.Add($ch.cpuPct) }
    if ($null -ne $ch.ramMb) { [void]$ramChrome.Add($ch.ramMb) }

    Write-Host ("  [{0}/{1}s] GPU3D={2}% GPUvid={3}% CPU={4}% ChromeCPU={5}% ChromeRAM={6}MB (p={7})" -f `
      ($i + 1), $Dur, `
      ($(if ($null -eq $g3) { 'n/a' } else { $g3 })), `
      ($(if ($null -eq $gv) { 'n/a' } else { $gv })), `
      ($(if ($null -eq $ct) { 'n/a' } else { $ct })), `
      ($(if ($null -eq $ch.cpuPct) { 'n/a' } else { $ch.cpuPct })), `
      ($(if ($null -eq $ch.ramMb) { 'n/a' } else { $ch.ramMb })), `
      $ch.procs)
  }

  $s3 = Summarize $gpu3d
  $sv = Summarize $gpuVid
  $st = Summarize $cpuTotal
  $sc = Summarize $cpuChrome
  $sr = Summarize $ramChrome

  return [pscustomobject]@{
    label         = $Label
    gpu3d_avg     = $s3.avg
    gpu3d_max     = $s3.max
    gpuVideo_avg  = $sv.avg
    gpuVideo_max  = $sv.max
    cpuTotal_avg  = $st.avg
    cpuTotal_max  = $st.max
    chromeCpu_avg = $sc.avg
    chromeCpu_max = $sc.max
    chromeRam_avg = $sr.avg
    chromeRam_max = $sr.max
    samples       = $s3.samples
  }
}

$chrome = Find-Chrome
if (-not $chrome) { throw "Google Chrome not found on this machine." }

$profileMarker = "shigure-perf-chrome-$PID"
$profileDir = Join-Path $env:TEMP $profileMarker
Stop-ChromeProfile $profileMarker

Write-Host "Browser: $chrome"
Write-Host "Profile: $profileDir"
Write-Host "Base: $BaseUrl | warmup ${Warmup}s | sample ${Seconds}s"
Write-Host ""

# warm counters
$null = Get-Gpu3DMax
$null = Get-CpuTotal
Start-Sleep -Seconds 1

Write-Host "== baseline (idle) =="
$baseline = Sample-Perf "baseline" 3 ""

$scenarios = @(
  @{ name = 'sunny';  url = ($BaseUrl + '/?rain=sunny&perf=1') },
  @{ name = 'light';  url = ($BaseUrl + '/?rain=light&perf=1') },
  @{ name = 'heavy';  url = ($BaseUrl + '/?rain=heavy&perf=1') },
  @{ name = 'storm';  url = ($BaseUrl + '/?rain=storm&perf=1') },
  @{ name = 'fuyuu';  url = ($BaseUrl + '/fuyuu/') }
)

$results = @($baseline)

foreach ($s in $scenarios) {
  Write-Host ""
  Write-Host ("== {0} ==`n  {1}" -f $s.name, $s.url)
  Stop-ChromeProfile $profileMarker
  Start-Process -FilePath $chrome -ArgumentList @(
    "--user-data-dir=$profileDir",
    "--no-first-run",
    "--disable-extensions",
    "--new-window",
    $s.url
  ) | Out-Null
  Start-Sleep -Seconds $Warmup
  $results += Sample-Perf $s.name $Seconds $profileMarker
  Stop-ChromeProfile $profileMarker
  Start-Sleep -Seconds 2
}

try { Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue } catch { }

Write-Host ""
Write-Host "======== SUMMARY (real Chrome: GPU / CPU / RAM) ========"
$results | Format-Table label, gpu3d_avg, gpu3d_max, cpuTotal_avg, chromeCpu_avg, chromeRam_avg -AutoSize

$out = Join-Path (Split-Path $PSScriptRoot -Parent) "_rain_analysis\local\real-perf-check.json"
$payload = @{
  at       = (Get-Date).ToString('o')
  baseUrl  = $BaseUrl
  browser  = $chrome
  seconds  = $Seconds
  warmup   = $Warmup
  results  = $results
} | ConvertTo-Json -Depth 5
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
Set-Content -Path $out -Value $payload -Encoding UTF8
Write-Host "Report: $out"
