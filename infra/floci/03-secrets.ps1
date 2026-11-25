<#
.SYNOPSIS
  Step 03 - Store DATABASE_URL and JWT_SECRET in Secrets Manager
  (replaces .env / provider environment variables).
  Owner: Ahmed (database + configuration)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "3. Storing secrets in Secrets Manager"
$secretFile = New-JsonFile "secret" @{ DATABASE_URL = (Get-DatabaseUrl); JWT_SECRET = $JWT_SECRET }

$existing = Get-AwsJson secretsmanager describe-secret --secret-id $SECRET_NAME
if ($existing) {
    aws secretsmanager put-secret-value --secret-id $SECRET_NAME --secret-string $secretFile | Out-Null
    Assert-AwsOk "Updating secret"
    Write-Host "Secret '$SECRET_NAME' updated." -ForegroundColor Green
} else {
    aws secretsmanager create-secret --name $SECRET_NAME --secret-string $secretFile | Out-Null
    Assert-AwsOk "Creating secret"
    Write-Host "Secret '$SECRET_NAME' created." -ForegroundColor Green
}
