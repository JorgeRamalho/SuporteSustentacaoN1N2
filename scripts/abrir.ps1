# Atalho manual: garante ambiente e abre o navegador.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $Root "scripts\config.ps1")

& (Join-Path $Root "scripts\garantir-ambiente.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$url = $SentinelaConsoleUrl
Write-Host "Abrindo $url"
Start-Process $url
