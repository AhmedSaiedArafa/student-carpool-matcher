<#
.SYNOPSIS
  Shared settings and helpers for the Floci deployment scripts.
  Owner: Remas (cloud deployment lead)

  Every step script dot-sources this file:  . "$PSScriptRoot\_settings.ps1"
#>
$ErrorActionPreference = "Stop"

# ── AWS / Floci connection (fake credentials, local emulator only) ──
$env:AWS_ACCESS_KEY_ID     = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION    = "us-east-1"
$env:AWS_ENDPOINT_URL      = "http://localhost:4566"

$REGION      = "us-east-1"
$EP          = "http://localhost:4566"
$ACCOUNT_ID  = "000000000000"

# ── Resource names ──────────────────────────────────────────────────
$DB_INSTANCE = "carpool-db"
$DB_NAME     = "carpool"
$DB_USER     = "carpool"
$DB_PASS     = "carpool123"
$JWT_SECRET  = "floci-jwt-secret-at-least-32-characters-long!!"
$SECRET_NAME = "carpool/config"
$ROLE_NAME   = "carpool-lambda-role"
$POLICY_NAME = "carpool-lambda-access"
$LAMBDA_NAME = "carpool-api"
$API_NAME    = "carpool-http-api"
$BUCKET      = "carpool-frontend"
$RULE_NAME   = "carpool-expiry-scheduler"
$LOG_GROUP   = "/aws/lambda/$LAMBDA_NAME"

$ROLE_ARN    = "arn:aws:iam::${ACCOUNT_ID}:role/$ROLE_NAME"
$POLICY_ARN  = "arn:aws:iam::${ACCOUNT_ID}:policy/$POLICY_NAME"
$LAMBDA_ARN  = "arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:$LAMBDA_NAME"
$WEBSITE_URL = "http://${BUCKET}.s3-website.localhost.localstack.cloud:4566"

# ── Paths ───────────────────────────────────────────────────────────
$ROOT     = Resolve-Path "$PSScriptRoot\..\.."
$BACKEND  = "$ROOT\backend"
$FRONTEND = "$ROOT\frontend"
$IAM_DIR  = "$ROOT\infra\iam"
$ZIP_PATH = "$BACKEND\lambda.zip"   # built by "npm run zip" (same as Lab 7)

# ── aws wrapper: always talk to Floci ───────────────────────────────
# Calls the real aws.exe (not this function) to avoid infinite recursion.
# Error text goes into $script:AwsLastError instead of stopping the script,
# so each step can check $LASTEXITCODE and decide what to do.
$script:AwsExe = (Get-Command aws -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if (-not $script:AwsExe) { throw "AWS CLI not found. Install it with: winget install Amazon.AWSCLI" }
$script:AwsLastError = ""

function aws {
    $script:AwsLastError = ""
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        & $script:AwsExe --endpoint-url $EP --region $REGION @args 2>&1 | ForEach-Object {
            if ($_ -is [System.Management.Automation.ErrorRecord]) {
                $line = "$_"
                if ($line -and $line -ne "System.Management.Automation.RemoteException") { $script:AwsLastError += "$line`n" }
            } else { $_ }
        }
    } finally {
        $ErrorActionPreference = $previous
    }
}

# Stops the step with a clear message if the last aws call failed.
function Assert-AwsOk($what) {
    if ($LASTEXITCODE -ne 0) { throw "$what failed: $($script:AwsLastError.Trim())" }
}

# Windows PowerShell strips the quotes from JSON passed to aws.exe,
# so JSON is written to a temp file and passed as file://...
function New-JsonFile($name, $content) {
    if ($content -isnot [string]) { $content = ConvertTo-Json -InputObject $content -Depth 10 -Compress }
    $path = Join-Path $env:TEMP "carpool-$name.json"
    [System.IO.File]::WriteAllText($path, $content)
    return "file://$path"
}

# Runs an aws command and returns its JSON output as an object, or $null if it failed.
function Get-AwsJson {
    $raw = aws @args
    if ($LASTEXITCODE -ne 0 -or -not $raw) { return $null }
    return (($raw -join "`n") | ConvertFrom-Json)
}

function Write-Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }

# ── Helpers used by several steps ───────────────────────────────────
# Builds DATABASE_URL from the running RDS instance (step 02 must have run).
function Get-DatabaseUrl {
    $raw = aws rds describe-db-instances --db-instance-identifier $DB_INSTANCE
    if ($LASTEXITCODE -ne 0 -or -not $raw) { throw "RDS instance '$DB_INSTANCE' not found. Run 02-database-rds.ps1 first." }
    $dbJson = ($raw -join "`n") | ConvertFrom-Json
    if (-not $dbJson.DBInstances) { throw "RDS instance '$DB_INSTANCE' not found. Run 02-database-rds.ps1 first." }
    $address = $dbJson.DBInstances[0].Endpoint.Address
    $port    = $dbJson.DBInstances[0].Endpoint.Port
    return "postgresql://${DB_USER}:${DB_PASS}@${address}:${port}/${DB_NAME}"
}

# Finds the HTTP API id by name (step 06 must have run). Returns $null if missing.
function Get-ApiId {
    $raw = aws apigatewayv2 get-apis
    if ($LASTEXITCODE -ne 0 -or -not $raw) { return $null }
    $apisJson = ($raw -join "`n") | ConvertFrom-Json
    foreach ($a in $apisJson.Items) {
        if ($a.Name -eq $API_NAME) { return $a.ApiId }
    }
    return $null
}

function Get-ApiUrl {
    $apiId = Get-ApiId
    if (-not $apiId) { throw "API '$API_NAME' not found. Run 06-api-gateway.ps1 first." }
    # Floci's invoke URL for HTTP APIs with a $default stage
    return "http://${apiId}.execute-api.localhost.floci.io:4566"
}
