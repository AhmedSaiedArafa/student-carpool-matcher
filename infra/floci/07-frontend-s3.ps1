<#
.SYNOPSIS
  Step 07 - Host the frontend as an S3 static website
  (replaces Cloudflare Pages in production).
  Owner: Remas (cloud deployment lead)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "7a. Setting up S3 website bucket"
aws s3api head-bucket --bucket $BUCKET | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Bucket '$BUCKET' already exists."
} else {
    aws s3api create-bucket --bucket $BUCKET | Out-Null
    Assert-AwsOk "Creating bucket"
    Write-Host "Bucket '$BUCKET' created."
}

$websiteConfig = @{
    IndexDocument = @{ Suffix = "index.html" }
    ErrorDocument = @{ Key = "index.html" }
}
aws s3api put-bucket-website --bucket $BUCKET --website-configuration (New-JsonFile "website" $websiteConfig) | Out-Null
Assert-AwsOk "Enabling website hosting"

# New buckets block public access by default, which rejects a public policy.
# Turn that off for this website bucket first.
$publicAccess = @{
    BlockPublicAcls       = $false
    IgnorePublicAcls      = $false
    BlockPublicPolicy     = $false
    RestrictPublicBuckets = $false
}
aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration (New-JsonFile "public-access" $publicAccess) | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Public access block not changed: $($script:AwsLastError.Trim())" -ForegroundColor Yellow
}

$bucketPolicy = @{
    Version   = "2012-10-17"
    Statement = @(@{
        Sid       = "PublicRead"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "arn:aws:s3:::${BUCKET}/*"
    })
}
aws s3api put-bucket-policy --bucket $BUCKET --policy (New-JsonFile "bucket-policy" $bucketPolicy) | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Public-read bucket policy set."
} else {
    # Not fatal in the local emulator: the site may still be readable without it.
    Write-Host "Bucket policy not applied: $($script:AwsLastError.Trim())" -ForegroundColor Yellow
}

Write-Step "7b. Uploading frontend to S3"
$API_URL = Get-ApiUrl

# Temporarily point config.js at the deployed API, upload, then restore it.
$configPath   = "$FRONTEND\assets\js\config.js"
$configBackup = "$PSScriptRoot\config.js.bak"
Copy-Item $configPath $configBackup -Force
try {
    # Add one line at the end that overrides API_URL (the original lines stay valid JavaScript).
    $configContent = Get-Content $configPath -Raw
    $configContent = $configContent.TrimEnd() + "`n`n// Added by 07-frontend-s3.ps1 for the Floci deployment`nCONFIG.API_URL = '${API_URL}/api';`n"
    [System.IO.File]::WriteAllText($configPath, $configContent)

    aws s3 sync $FRONTEND "s3://$BUCKET" --delete --exclude "node_modules/*" --exclude "package*.json" | Out-Null
    Assert-AwsOk "Uploading frontend"
    Write-Host "Frontend uploaded to S3." -ForegroundColor Green
} finally {
    Copy-Item $configBackup $configPath -Force
    Remove-Item $configBackup -Force
}

Write-Host "Website URL: $WEBSITE_URL" -ForegroundColor Green
