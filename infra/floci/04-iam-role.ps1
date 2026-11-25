<#
.SYNOPSIS
  Step 04 - Create the IAM role the Lambda function runs as, and a
  least-privilege policy that allows only what our code needs (Lab 7, Part 3).
  Owner: Youssef (security)

  Files:
    infra/iam/trust-policy.json          WHO may use the role (only Lambda)
    infra/iam/carpool-lambda-policy.json WHAT the role allows (read our secret, write logs)
#>
. "$PSScriptRoot\_settings.ps1"

Write-Step "4. Creating IAM role and least-privilege policy"
$trustFile  = "file://$IAM_DIR\trust-policy.json"
$policyFile = "file://$IAM_DIR\carpool-lambda-policy.json"

# 1. The role (the "badge")
$existingRole = Get-AwsJson iam get-role --role-name $ROLE_NAME
if ($existingRole) {
    Write-Host "Role '$ROLE_NAME' already exists."
} else {
    aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document $trustFile | Out-Null
    Assert-AwsOk "Creating IAM role"
    Write-Host "Role '$ROLE_NAME' created." -ForegroundColor Green
}

# 2. The policy (the "doors" the badge opens)
$existingPolicy = Get-AwsJson iam get-policy --policy-arn $POLICY_ARN
if ($existingPolicy) {
    Write-Host "Policy '$POLICY_NAME' already exists."
} else {
    aws iam create-policy --policy-name $POLICY_NAME --policy-document $policyFile | Out-Null
    Assert-AwsOk "Creating IAM policy"
    Write-Host "Policy '$POLICY_NAME' created." -ForegroundColor Green
}

# 3. Attach the policy to the role
aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn $POLICY_ARN | Out-Null
Assert-AwsOk "Attaching policy to role"
Write-Host "Policy '$POLICY_NAME' attached to role '$ROLE_NAME'." -ForegroundColor Green
Write-Host "Role ARN: $ROLE_ARN"
