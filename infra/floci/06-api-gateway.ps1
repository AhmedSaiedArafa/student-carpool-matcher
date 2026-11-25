<#
.SYNOPSIS
  Step 06 - Create the API Gateway HTTP API that routes /api/* to the Lambda.
  Owner: Remas (cloud deployment lead)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "6. Creating API Gateway HTTP API"

$apiId = Get-ApiId
if (-not $apiId) {
    $apiJson = aws apigatewayv2 create-api `
        --name $API_NAME `
        --protocol-type HTTP `
        --cors-configuration "AllowOrigins=*,AllowMethods=GET,POST,PUT,PATCH,DELETE,OPTIONS,AllowHeaders=Content-Type,Authorization,MaxAge=3600" `
        2>$null | ConvertFrom-Json
    $apiId = $apiJson.ApiId
    Write-Host "API created: $apiId"
} else {
    Write-Host "API already exists: $apiId"
}

$integJson = aws apigatewayv2 create-integration `
    --api-id $apiId `
    --integration-type AWS_PROXY `
    --integration-uri $LAMBDA_ARN `
    --payload-format-version "2.0" `
    2>$null | ConvertFrom-Json
$integId = $integJson.IntegrationId

# Catch-all route for the whole REST API
aws apigatewayv2 create-route `
    --api-id $apiId `
    --route-key 'ANY /api/{proxy+}' `
    --target "integrations/$integId" 2>$null | Out-Null

# Explicit health check route
aws apigatewayv2 create-route `
    --api-id $apiId `
    --route-key 'GET /api/health' `
    --target "integrations/$integId" 2>$null | Out-Null

try {
    aws apigatewayv2 create-stage `
        --api-id $apiId `
        --stage-name '$default' `
        --auto-deploy 2>$null | Out-Null
} catch {}

Write-Host "API Gateway URL: $(Get-ApiUrl)" -ForegroundColor Green
