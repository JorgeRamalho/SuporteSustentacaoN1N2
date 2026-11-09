# Sobe API (8010) e console estático (5500) se ainda não estiverem no ar.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
. (Join-Path $Root "scripts\config.ps1")
$Frontend = Join-Path $Root "frontend"
$ConsolePort = $SentinelaConsolePort

& (Join-Path $Root "scripts\garantir-api.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Push-Location $Frontend
if (-not (Test-Path "node_modules")) {
    npm install
}
$bundle = Join-Path $Frontend "live-dist\live-bundle.js"
$srcStamp = @(
    (Join-Path $Frontend "src\AuthScreen.jsx"),
    (Join-Path $Frontend "src\App.jsx"),
    (Join-Path $Frontend "src\access.js")
) | Where-Object { Test-Path $_ } | ForEach-Object { (Get-Item $_).LastWriteTimeUtc } | Measure-Object -Maximum | Select-Object -ExpandProperty Maximum
$bundleStamp = if (Test-Path $bundle) { (Get-Item $bundle).LastWriteTimeUtc } else { [datetime]::MinValue }
if (-not (Test-Path $bundle) -or $srcStamp -gt $bundleStamp) {
    Write-Host "Gerando frontend/live-dist (Live Server usa este bundle; não apenas src/) ..."
    npm run live:bundle
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        exit $LASTEXITCODE
    }
}

$listening = Get-NetTCPConnection -LocalPort $ConsolePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $listening) {
    Write-Host "Subindo console em $SentinelaConsoleUrl ..."
    Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "npm run live:serve") -WorkingDirectory $Frontend -WindowStyle Minimized
    $deadline = (Get-Date).AddSeconds(45)
    while ((Get-Date) -lt $deadline) {
        $listening = Get-NetTCPConnection -LocalPort $ConsolePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $listening) { break }
        Start-Sleep -Milliseconds 400
    }
    if ($null -eq $listening) {
        Write-Host "O console não subiu na porta $ConsolePort. Rode npm start na raiz do projeto."
        Pop-Location
        exit 1
    }
} else {
    Write-Host "Console já ativo na porta $ConsolePort"
}

Pop-Location
Write-Host "Sentinela pronto: $SentinelaConsoleUrl"
exit 0
