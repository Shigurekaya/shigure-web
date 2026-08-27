# Gal 名言审阅服务
Set-Location $PSScriptRoot\..
. ..\gal-\ops\proxy.ps1
Enable-RepoProxy
Write-Host "[gal-quotes] 打开 http://127.0.0.1:8765/review.html"
uv run python _gal_quotes/review_server.py --port 8765
