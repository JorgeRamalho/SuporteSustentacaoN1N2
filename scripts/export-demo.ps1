$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$OutDir = Join-Path $Root "frontend\demo"
$Base = "http://127.0.0.1:8010"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$paths = @(
    "/api/health",
    "/api/dashboard",
    "/api/logs",
    "/api/incidents",
    "/api/vendors",
    "/api/tickets",
    "/api/tickets/sla?days=7",
    "/api/automation/host",
    "/api/automation/runs",
    "/api/reports/options",
    "/api/kb?q=",
    "/openapi.json"
)

$snapshot = @{}
foreach ($path in $paths) {
    $url = "$Base$path"
    try {
        $snapshot[$path] = Invoke-RestMethod -Uri $url -TimeoutSec 15
    } catch {
        Write-Warning "Falhou: $path"
    }
}

$outFile = Join-Path $OutDir "api-snapshot.json"
$snapshot | ConvertTo-Json -Depth 20 | Set-Content -Path $outFile -Encoding UTF8
Write-Host "Gravado: $outFile ($($snapshot.Keys.Count) rotas)"
