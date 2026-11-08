$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
# 8000 costuma estar ocupada no Windows por Docker Desktop/WSL.
$Port = 8010

if (-not (Test-Path $Python)) {
    python -m venv (Join-Path $Root "backend\.venv")
    & $Python -m pip install -r (Join-Path $Root "backend\requirements.txt")
}

Write-Host "API Sentinela em http://127.0.0.1:$Port"
Write-Host "Docs: http://127.0.0.1:$Port/docs"
Write-Host "Console estático: http://127.0.0.1:5500/index.html"
Set-Location (Join-Path $Root "backend")
& $Python -m uvicorn app.main:app --host 127.0.0.1 --port $Port
