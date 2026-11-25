<#
.SYNOPSIS
  Step 10 - Set up CloudWatch Logs for the API (logging and monitoring).
  Owner: Youssef (logging and monitoring)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "10. Configuring CloudWatch Logs"
try {
    aws logs create-log-group --log-group-name $LOG_GROUP 2>$null | Out-Null
    Write-Host "Log group '$LOG_GROUP' created."
} catch {
    Write-Host "Log group '$LOG_GROUP' already exists, continuing."
}

try {
    aws logs put-retention-policy --log-group-name $LOG_GROUP --retention-in-days 7 2>$null | Out-Null
    Write-Host "Log retention set to 7 days." -ForegroundColor Green
} catch {
    Write-Host "Retention policy skipped: $_" -ForegroundColor Yellow
}

Write-Host "View logs any time with: .\infra\floci\logs.ps1"
