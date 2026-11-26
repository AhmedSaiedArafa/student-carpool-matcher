<#
.SYNOPSIS
  Deploy CarpoolMatch to Floci: runs every step script in order and stops on the first error.
  Owner: Remas (cloud deployment lead)

  Steps and owners:
    01 Start Floci ............ Remas
    02 RDS PostgreSQL ......... Ahmed
    03 Secrets Manager ........ Ahmed
    04 IAM role ............... Youssef
    05 Lambda ................. Remas
    06 API Gateway ............ Remas
    07 S3 frontend ............ Remas
    08 Migrations + seed ...... Ahmed
    09 EventBridge expiry ..... Ahmed
    10 CloudWatch Logs ........ Youssef
#>
. "$PSScriptRoot\_settings.ps1"

$steps = @(
    "01-start-floci.ps1",
    "02-database-rds.ps1",
    "03-secrets.ps1",
    "04-iam-role.ps1",
    "05-lambda.ps1",
    "06-api-gateway.ps1",
    "07-frontend-s3.ps1",
    "08-migrate-seed.ps1",
    "10-cloudwatch-logs.ps1"
)

# Each step throws on a real error, which stops the whole deployment here.
foreach ($step in $steps) {
    & "$PSScriptRoot\$step"
}

$API_URL = Get-ApiUrl

Write-Host "`n"
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Website URL : $WEBSITE_URL" -ForegroundColor Yellow
Write-Host "  API URL     : ${API_URL}/api" -ForegroundColor Yellow
Write-Host "  Health Check: ${API_URL}/api/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Database    : $(Get-DatabaseUrl)" -ForegroundColor Gray
Write-Host ""
Write-Host "  Test users  : driver1@university.edu / Password123!" -ForegroundColor Gray
Write-Host "                rider1@university.edu  / Password123!" -ForegroundColor Gray
Write-Host ""
Write-Host "  Check it    : .\infra\floci\verify-deployment.ps1" -ForegroundColor Gray
Write-Host "  View logs   : .\infra\floci\logs.ps1" -ForegroundColor Gray
Write-Host "=============================================" -ForegroundColor Green
