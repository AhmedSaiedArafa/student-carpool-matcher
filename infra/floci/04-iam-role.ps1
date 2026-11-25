<#
.SYNOPSIS
  Step 04 - Create the IAM role the Lambda function runs as.
  Owner: Youssef (security)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "4. Creating IAM role for Lambda"
$trustPolicy = @{
    Version   = "2012-10-17"
    Statement = @(@{
        Effect    = "Allow"
        Principal = @{ Service = "lambda.amazonaws.com" }
        Action    = "sts:AssumeRole"
    })
}

$existing = Get-AwsJson iam get-role --role-name $ROLE_NAME
if ($existing) {
    Write-Host "IAM role '$ROLE_NAME' already exists, continuing."
} else {
    aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document (New-JsonFile "trust-policy" $trustPolicy) | Out-Null
    Assert-AwsOk "Creating IAM role"
    Write-Host "IAM role '$ROLE_NAME' created." -ForegroundColor Green
}

# Least privilege: the function only needs to write its own logs.
aws iam attach-role-policy `
    --role-name $ROLE_NAME `
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Attached AWSLambdaBasicExecutionRole (CloudWatch Logs only)."
} else {
    Write-Host "Policy attach skipped: $($script:AwsLastError.Trim())" -ForegroundColor Yellow
}

Write-Host "Role ARN: $ROLE_ARN"
