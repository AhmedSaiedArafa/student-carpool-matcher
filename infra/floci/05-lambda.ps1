<#
.SYNOPSIS
  Step 05 - Package the Express API and deploy it as a Lambda function
  (replaces Vercel serverless in production).
  Owner: Remas (cloud deployment lead)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "5a. Building Lambda zip"
Push-Location $BACKEND
if (-not (Test-Path "node_modules\serverless-http")) {
    # --no-save keeps package.json unchanged
    $ErrorActionPreference = "Continue"
    npm install --no-save serverless-http
    $ErrorActionPreference = "Stop"
}
Pop-Location

if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH -Force }

Push-Location $BACKEND
$entries = @("lambda.js", "server.js", "package.json", "src", "api", "node_modules")
tar -acf $ZIP_PATH $entries 2>$null
Pop-Location

if (-not (Test-Path $ZIP_PATH)) { throw "Could not create $ZIP_PATH" }
$zipSize = [math]::Round((Get-Item $ZIP_PATH).Length / 1MB, 2)
Write-Host "Lambda zip created: $ZIP_PATH ($zipSize MB)" -ForegroundColor Green

Write-Step "5b. Deploying Lambda function"
$envFile = New-JsonFile "lambda-env" @{
    Variables = @{
        DATABASE_URL = (Get-DatabaseUrl)
        JWT_SECRET   = $JWT_SECRET
        FRONTEND_URL = $WEBSITE_URL
        NODE_OPTIONS = "--dns-result-order=ipv4first"
    }
}

$existing = Get-AwsJson lambda get-function --function-name $LAMBDA_NAME
if ($existing) {
    aws lambda update-function-code --function-name $LAMBDA_NAME --zip-file "fileb://$ZIP_PATH" | Out-Null
    Assert-AwsOk "Updating Lambda code"
    Start-Sleep -Seconds 2
    aws lambda update-function-configuration `
        --function-name $LAMBDA_NAME `
        --environment $envFile `
        --timeout 30 `
        --memory-size 512 | Out-Null
    Assert-AwsOk "Updating Lambda configuration"
    Write-Host "Lambda function updated."
} else {
    aws lambda create-function `
        --function-name $LAMBDA_NAME `
        --runtime nodejs20.x `
        --handler lambda.handler `
        --role $ROLE_ARN `
        --zip-file "fileb://$ZIP_PATH" `
        --timeout 30 `
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
