<#
.SYNOPSIS
  Step 07 - Host the frontend as an S3 static website
  (replaces Cloudflare Pages in production).
  Owner: Remas (cloud deployment lead)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "7a. Setting up S3 website bucket"
try { aws s3 mb "s3://$BUCKET" 2>$null | Out-Null } catch {}

aws s3api put-bucket-website --bucket $BUCKET --website-configuration '{
  "IndexDocument": {"Suffix": "index.html"},
  "ErrorDocument": {"Key": "index.html"}
}' 2>$null

$bucketPolicy = @{
    Version = "2012-10-17"
    Statement = @(@{
        Sid = "PublicRead"
        Effect = "Allow"
        Principal = "*"
        Action = "s3:GetObject"
        Resource = "arn:aws:s3:::${BUCKET}/*"
    })
} | ConvertTo-Json -Depth 5 -Compress

aws s3api put-bucket-policy --bucket $BUCKET --policy $bucketPolicy 2>$null

Write-Step "7b. Uploading frontend to S3"
$API_URL = Get-ApiUrl

# Temporarily point config.js at the deployed API, upload, then restore it.
$configPath   = "$FRONTEND\assets\js\config.js"
$configBackup = "$PSScriptRoot\config.js.bak"
Copy-Item $configPath $configBackup -Force
try {
    $configContent = Get-Content $configPath -Raw
    $configContent = $configContent -replace "API_URL:.*", "API_URL: '${API_URL}/api',"
    Set-Content $configPath $configContent -Encoding utf8

    aws s3 sync $FRONTEND "s3://$BUCKET" --delete 2>$null | Out-Null
    Write-Host "Frontend uploaded to S3." -ForegroundColor Green
} finally {
    Copy-Item $configBackup $configPath -Force
    Remove-Item $configBackup -Force
}

Write-Host "Website URL: $WEBSITE_URL" -ForegroundColor Green
