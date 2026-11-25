<#
.SYNOPSIS
  Step 08 - Create the tables and demo data in the RDS database.
  Owner: Ahmed (database setup)

  The RDS address (for example 172.18.0.2) only exists inside Docker,
  so migrate.js and seed.js run in a small Node container that shares
  the Floci container's network.
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "8. Running migrations and seed"
$DATABASE_URL = Get-DatabaseUrl

foreach ($jsFile in @("src/db/migrate.js", "src/db/seed.js")) {
    Write-Host "Running $jsFile ..."
    docker run --rm `
        --network container:floci `
        -e "DATABASE_URL=$DATABASE_URL" `
        -e "JWT_SECRET=$JWT_SECRET" `
        -v "${BACKEND}:/app" `
        -w /app `
        node:20-alpine node $jsFile
    if ($LASTEXITCODE -ne 0) { throw "$jsFile failed (see the error above)." }
}
Write-Host "Migrations and seed complete." -ForegroundColor Green
