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
    npm install --no-save serverless-http 2>&1 | Select-Object -Last 3
}
Pop-Location

if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH -Force }

Push-Location $BACKEND
$entries = @("lambda.js", "server.js", "package.json", "src", "api", "node_modules")
tar -acf $ZIP_PATH $entries 2>$null
Pop-Location

$zipSize = [math]::Round((Get-Item $ZIP_PATH).Length / 1MB, 2)
Write-Host "Lambda zip created: $ZIP_PATH ($zipSize MB)" -ForegroundColor Green

Write-Step "5b. Deploying Lambda function"
$DATABASE_URL = Get-DatabaseUrl

$lambdaExists = $false
try {
    aws lambda get-function --function-name $LAMBDA_NAME 2>$null | Out-Null
    $lambdaExists = $true
} catch {}

$lambdaEnv = @{
    Variables = @{
        DATABASE_URL = $DATABASE_URL
        JWT_SECRET   = $JWT_SECRET
        FRONTEND_URL = $WEBSITE_URL
        NODE_OPTIONS = "--dns-result-order=ipv4first"
    }
} | ConvertTo-Json -Compress

if ($lambdaExists) {
    aws lambda update-function-code --function-name $LAMBDA_NAME --zip-file "fileb://$ZIP_PATH" | Out-Null
    Start-Sleep -Seconds 2
    aws lambda update-function-configuration `
        --function-name $LAMBDA_NAME `
        --environment $lambdaEnv `
        --timeout 30 `
        --memory-size 512 | Out-Null
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
        --environment $lambdaEnv | Out-Null
    Write-Host "Lambda function created."
}

for ($i = 0; $i -lt 20; $i++) {
    $fnJson = aws lambda get-function --function-name $LAMBDA_NAME 2>$null | ConvertFrom-Json
    if ($fnJson.Configuration.State -eq "Active") { break }
    Start-Sleep -Seconds 2
}
Write-Host "Lambda function is active." -ForegroundColor Green
