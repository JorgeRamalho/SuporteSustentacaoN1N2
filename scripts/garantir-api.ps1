# Garante a API Sentinela em http://127.0.0.1:8010 (idempotente).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Port = 8010
$HealthUrl = "http://127.0.0.1:${Port}/api/health"
$Python = Join-Path $Root "backend\.venv\Scripts\python.exe"
$Backend = Join-Path $Root "backend"

function Test-ApiHealth {
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

if (Test-ApiHealth) {
    Write-Host "API Sentinela já ativa: $HealthUrl"
    exit 0
}

$listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -ne $listener) {
    Write-Host "A porta $Port está em uso, mas /api/health não responde. Encerre o processo (PID $($listener.OwningProcess)) ou reinicie com scripts\subir-api.ps1."
    exit 1
}

if (-not (Test-Path $Python)) {
    python -m venv (Join-Path $Root "backend\.venv")
    & $Python -m pip install -q -r (Join-Path $Root "backend\requirements.txt")
}

Write-Host "Iniciando API Sentinela (porta $Port)..."
Start-Process -FilePath $Python -ArgumentList @(
    "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$Port"
) -WorkingDirectory $Backend -WindowStyle Minimized

$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline) {
    if (Test-ApiHealth) {
        Write-Host "API pronta: $HealthUrl"
        exit 0
    }
    Start-Sleep -Milliseconds 500
}

Write-Host "A API não respondeu a tempo. Rode scripts\subir-api.ps1 em um terminal e veja o erro."
exit 1
