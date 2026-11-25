<#
.SYNOPSIS
  Step 06 - Create the API Gateway HTTP API that routes /api/* to the Lambda.
  Owner: Remas (cloud deployment lead)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "6. Creating API Gateway HTTP API"

$apiId = Get-ApiId
if ($apiId) {
    Write-Host "API already exists: $apiId"
} else {
    $apiJson = Get-AwsJson apigatewayv2 create-api `
        --name $API_NAME `
        --protocol-type HTTP `
        --cors-configuration "AllowOrigins=*,AllowMethods=GET,POST,PUT,PATCH,DELETE,OPTIONS,AllowHeaders=Content-Type,Authorization,MaxAge=3600"
    if (-not $apiJson) { throw "Creating API failed: $($script:AwsLastError.Trim())" }
    $apiId = $apiJson.ApiId
    Write-Host "API created: $apiId"
}

# Reuse the Lambda integration if it already exists
$integId = $null
$integrations = Get-AwsJson apigatewayv2 get-integrations --api-id $apiId
if ($integrations) {
    foreach ($it in $integrations.Items) { if ($it.IntegrationUri -eq $LAMBDA_ARN) { $integId = $it.IntegrationId; break } }
}
if (-not $integId) {
    $integJson = Get-AwsJson apigatewayv2 create-integration `
        --api-id $apiId `
        --integration-type AWS_PROXY `
        --integration-uri $LAMBDA_ARN `
        --payload-format-version "2.0"
    if (-not $integJson) { throw "Creating Lambda integration failed: $($script:AwsLastError.Trim())" }
    $integId = $integJson.IntegrationId
}
Write-Host "Lambda integration: $integId"

# Create the routes only if they are missing
$existingRoutes = @()
$routes = Get-AwsJson apigatewayv2 get-routes --api-id $apiId
if ($routes) { $existingRoutes = @($routes.Items | ForEach-Object { $_.RouteKey }) }

foreach ($routeKey in @('ANY /api/{proxy+}', 'GET /api/health')) {
    if ($existingRoutes -contains $routeKey) {
        Write-Host "Route '$routeKey' already exists."
    } else {
        aws apigatewayv2 create-route --api-id $apiId --route-key $routeKey --target "integrations/$integId" | Out-Null
        Assert-AwsOk "Creating route '$routeKey'"
        Write-Host "Route '$routeKey' created."
    }
}

$stages = Get-AwsJson apigatewayv2 get-stages --api-id $apiId
$hasDefault = $stages -and (@($stages.Items | Where-Object { $_.StageName -eq '$default' }).Count -gt 0)
if (-not $hasDefault) {
    aws apigatewayv2 create-stage --api-id $apiId --stage-name '$default' --auto-deploy | Out-Null
    Assert-AwsOk "Creating `$default stage"
}

Write-Host "API Gateway URL: $(Get-ApiUrl)" -ForegroundColor Green
