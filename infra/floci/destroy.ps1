<#
.SYNOPSIS
  Tear down CarpoolMatch from Floci: removes every resource the deploy steps created.
  Owner: Youssef
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "Destroying CarpoolMatch from Floci"

Write-Host "Removing EventBridge rule..."
try {
    aws events remove-targets --rule $RULE_NAME --ids "1" 2>$null | Out-Null
    aws events delete-rule --name $RULE_NAME 2>$null | Out-Null
    Write-Host "  EventBridge rule removed."
} catch { Write-Host "  EventBridge rule not found, skipping." }

Write-Host "Removing API Gateway..."
try {
    $apiId = Get-ApiId
    if ($apiId) {
        aws apigatewayv2 delete-api --api-id $apiId 2>$null | Out-Null
        Write-Host "  API $apiId deleted."
    } else { Write-Host "  API Gateway not found, skipping." }
} catch { Write-Host "  API Gateway not found, skipping." }

Write-Host "Removing Lambda function..."
try {
    aws lambda delete-function --function-name $LAMBDA_NAME 2>$null | Out-Null
    Write-Host "  Lambda function deleted."
} catch { Write-Host "  Lambda function not found, skipping." }

Write-Host "Removing CloudWatch log group..."
try {
    aws logs delete-log-group --log-group-name $LOG_GROUP 2>$null | Out-Null
    Write-Host "  Log group deleted."
} catch { Write-Host "  Log group not found, skipping." }

Write-Host "Removing IAM role and policy..."
aws iam detach-role-policy --role-name $ROLE_NAME --policy-arn $POLICY_ARN | Out-Null
aws iam detach-role-policy --role-name $ROLE_NAME `
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" | Out-Null
aws iam delete-policy --policy-arn $POLICY_ARN | Out-Null
aws iam delete-role --role-name $ROLE_NAME | Out-Null
Write-Host "  IAM role and policy removed (or were not there)."

Write-Host "Removing S3 bucket..."
try {
    aws s3 rm "s3://$BUCKET" --recursive 2>$null | Out-Null
    aws s3 rb "s3://$BUCKET" --force 2>$null | Out-Null
    Write-Host "  S3 bucket deleted."
} catch { Write-Host "  S3 bucket not found, skipping." }

Write-Host "Removing Secrets Manager secret..."
try {
    aws secretsmanager delete-secret --secret-id $SECRET_NAME --force-delete-without-recovery 2>$null | Out-Null
    Write-Host "  Secret deleted."
} catch { Write-Host "  Secret not found, skipping." }

Write-Host "Removing RDS instance..."
try {
    aws rds delete-db-instance --db-instance-identifier $DB_INSTANCE --skip-final-snapshot 2>$null | Out-Null
    Write-Host "  RDS instance deletion requested."
} catch { Write-Host "  RDS instance not found, skipping." }

if (Test-Path $ZIP_PATH) { Remove-Item $ZIP_PATH -Force }

Write-Host "Stopping Floci containers..."
docker compose -f "$PSScriptRoot\docker-compose.yml" down -v 2>$null

Write-Host "`n=== Teardown complete ===" -ForegroundColor Green
