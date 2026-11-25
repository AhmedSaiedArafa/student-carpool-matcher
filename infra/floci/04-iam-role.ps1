<#
.SYNOPSIS
  Step 04 - Create the IAM role the Lambda function runs as.
  Owner: Youssef (security)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "4. Creating IAM role for Lambda"
$trustPolicy = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

try {
    aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document $trustPolicy | Out-Null
    Write-Host "IAM role '$ROLE_NAME' created." -ForegroundColor Green
} catch {
    Write-Host "IAM role '$ROLE_NAME' already exists, continuing."
}

# Least privilege: the function only needs to write its own logs.
try {
    aws iam attach-role-policy `
        --role-name $ROLE_NAME `
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" | Out-Null
    Write-Host "Attached AWSLambdaBasicExecutionRole (CloudWatch Logs only)."
} catch {
    Write-Host "Policy attach skipped: $_" -ForegroundColor Yellow
}

Write-Host "Role ARN: $ROLE_ARN"
