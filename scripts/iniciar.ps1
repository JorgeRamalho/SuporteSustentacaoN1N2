# Fluxo recomendado no Windows: API + verificação do bundle Live Server.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $Root "scripts\config.ps1")

& (Join-Path $Root "scripts\garantir-ambiente.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Abra: $SentinelaConsoleUrl"
Write-Host "Documentação da API: http://127.0.0.1:8010/docs"
