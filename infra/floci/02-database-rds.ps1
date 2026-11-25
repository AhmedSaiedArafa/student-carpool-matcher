<#
.SYNOPSIS
  Step 02 - Create the RDS PostgreSQL database (replaces Neon in production).
  Owner: Ahmed (database setup)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "2. Creating RDS PostgreSQL instance"
$existing = Get-AwsJson rds describe-db-instances --db-instance-identifier $DB_INSTANCE
if ($existing -and $existing.DBInstances) {
    Write-Host "RDS instance '$DB_INSTANCE' already exists, continuing."
} else {
    aws rds create-db-instance `
        --db-instance-identifier $DB_INSTANCE `
        --db-instance-class db.t3.micro `
        --engine postgres `
        --master-username $DB_USER `
        --master-user-password $DB_PASS `
        --db-name $DB_NAME `
        --allocated-storage 20 | Out-Null
    Assert-AwsOk "Creating RDS instance"
    Write-Host "RDS instance creation requested."
}

Write-Host "Waiting for RDS instance to be available..."
$rdsReady = $false
for ($i = 0; $i -lt 60; $i++) {
    $dbJson = Get-AwsJson rds describe-db-instances --db-instance-identifier $DB_INSTANCE
    $status = if ($dbJson) { $dbJson.DBInstances[0].DBInstanceStatus } else { "unknown" }
    if ($status -eq "available") {
        $address = $dbJson.DBInstances[0].Endpoint.Address
        $port    = $dbJson.DBInstances[0].Endpoint.Port
        Write-Host "RDS available at ${address}:${port}" -ForegroundColor Green
        $rdsReady = $true
        break
    }
    Write-Host "  Status: $status ..."
    Start-Sleep -Seconds 3
}
if (-not $rdsReady) { throw "RDS instance did not become available." }

Write-Host "DATABASE_URL = $(Get-DatabaseUrl)"
