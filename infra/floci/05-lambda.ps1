<#
.SYNOPSIS
  Step 05 - Zip the Express API with "npm run zip" and deploy it as a Lambda
  function (Lab 7, Parts 4 and 5). Replaces Vercel serverless in production.
  Owner: Remas (cloud deployment lead)

  Settings (same style as Lab 7):
    Name     carpool-api
    Runtime  Node.js 24 (nodejs24.x)
    Handler  lambda.handler
    Role     carpool-lambda-role
    Code     backend/lambda.zip
    Env      SECRET_ID = carpool/config   (DATABASE_URL and JWT_SECRET are read from Secrets Manager)
    Timeout  10 seconds
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "5a. Building backend/lambda.zip (npm run zip)"
Push-Location $BACKEND
try {
    $ErrorActionPreference = "Continue"
    npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
    if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH -Force }
    npm run zip
    if ($LASTEXITCODE -ne 0) { throw "npm run zip failed." }
} finally {
    $ErrorActionPreference = "Stop"
    Pop-Location
}
$zipSize = [math]::Round((Get-Item $ZIP_PATH).Length / 1MB, 2)
Write-Host "Lambda zip created: $ZIP_PATH ($zipSize MB)" -ForegroundColor Green

Write-Step "5b. Deploying Lambda function"
$envFile = New-JsonFile "lambda-env" @{
    Variables = @{
        SECRET_ID    = $SECRET_NAME
        FRONTEND_URL = $WEBSITE_URL
        NODE_OPTIONS = "--dns-result-order=ipv4first"
    }
}

$existing = Get-AwsJson lambda get-function --function-name $LAMBDA_NAME
if ($existing) {
    aws lambda update-function-code --function-name $LAMBDA_NAME --zip-file "fileb://$ZIP_PATH" | Out-Null
    Assert-AwsOk "Updating Lambda code"
    aws lambda wait function-updated-v2 --function-name $LAMBDA_NAME | Out-Null
    aws lambda update-function-configuration `
        --function-name $LAMBDA_NAME `
        --runtime nodejs24.x `
        --role $ROLE_ARN `
        --environment $envFile `
        --timeout 10 `
        --memory-size 512 | Out-Null
    Assert-AwsOk "Updating Lambda configuration"
    Write-Host "Lambda function updated."
} else {
    aws lambda create-function `
        --function-name $LAMBDA_NAME `
        --runtime nodejs24.x `
        --handler lambda.handler `
        --role $ROLE_ARN `
        --zip-file "fileb://$ZIP_PATH" `
        --timeout 10 `
        --memory-size 512 `
        --environment $envFile | Out-Null
    Assert-AwsOk "Creating Lambda function"
    Write-Host "Lambda function created."
}

$active = $false
for ($i = 0; $i -lt 30; $i++) {
    $fnJson = Get-AwsJson lambda get-function --function-name $LAMBDA_NAME
    if ($fnJson -and $fnJson.Configuration.State -eq "Active") { $active = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $active) { throw "Lambda function did not become Active." }
Write-Host "Lambda function is active." -ForegroundColor Green
