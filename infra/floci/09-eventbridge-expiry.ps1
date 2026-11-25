<#
.SYNOPSIS
  Step 09 - Schedule the auto-expiry of stale requests and waitlist offers
  every 15 minutes with EventBridge (part of Matching & Requests).
  Owner: Ahmed
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "9. Setting up EventBridge schedule for request expiry"
aws events put-rule `
    --name $RULE_NAME `
    --schedule-expression "rate(15 minutes)" `
    --state ENABLED | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "EventBridge setup skipped: $($script:AwsLastError.Trim())" -ForegroundColor Yellow
    return
}

$eventInput = ConvertTo-Json -Compress -InputObject @{ httpMethod = "POST"; path = "/api/admin/run-expiry" }
$targets = @(@{ Id = "1"; Arn = $LAMBDA_ARN; Input = $eventInput })
aws events put-targets --rule $RULE_NAME --targets (New-JsonFile "targets" $targets) | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "EventBridge rule created: every 15 minutes -> POST /api/admin/run-expiry" -ForegroundColor Green
} else {
    Write-Host "EventBridge target skipped: $($script:AwsLastError.Trim())" -ForegroundColor Yellow
}
