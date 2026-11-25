<#
.SYNOPSIS
  Step 10 - Set up CloudWatch Logs for the API (logging and monitoring).
  Owner: Youssef (logging and monitoring)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "10. Configuring CloudWatch Logs"
$groups = Get-AwsJson logs describe-log-groups --log-group-name-prefix $LOG_GROUP
$exists = $groups -and (@($groups.logGroups | Where-Object { $_.logGroupName -eq $LOG_GROUP }).Count -gt 0)

if ($exists) {
    Write-Host "Log group '$LOG_GROUP' already exists."
} else {
    aws logs create-log-group --log-group-name $LOG_GROUP | Out-Null
    Assert-AwsOk "Creating log group"
    Write-Host "Log group '$LOG_GROUP' created."
}

aws logs put-retention-policy --log-group-name $LOG_GROUP --retention-in-days 7 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Log retention set to 7 days." -ForegroundColor Green
} else {
    Write-Host "Retention policy skipped: $($script:AwsLastError.Trim())" -ForegroundColor Yellow
}

Write-Host "View logs any time with: .\infra\floci\logs.ps1"
