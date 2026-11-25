<#
.SYNOPSIS
  Step 01 - Start the Floci local AWS emulator with Docker.
  Owner: Remas
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "1. Starting Floci (docker compose)"
docker compose -f "$PSScriptRoot\docker-compose.yml" up -d
Start-Sleep -Seconds 5

Write-Host "Waiting for Floci to be ready..."
$retries = 0
while ($retries -lt 30) {
    try {
        $health = Invoke-RestMethod -Uri "$EP/_localstack/health" -TimeoutSec 3
        if ($health.services) {
            Write-Host "Floci is ready." -ForegroundColor Green
            break
        }
    } catch {}
    Start-Sleep -Seconds 2
    $retries++
}
if ($retries -ge 30) { throw "Floci did not start in time." }
