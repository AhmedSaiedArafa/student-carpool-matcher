#!/usr/bin/env bash
# Deploy the S3 bucket for trip-history CSV exports and update the IAM policy.
# Run from the project folder in Git Bash:  bash infra/floci/deploy-history-exports.sh
# Requires: deploy-backend.sh has already run (creates IAM policy).
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-floci}"
export MSYS_NO_PATHCONV=1

if ! aws configure get endpoint_url --profile floci >/dev/null 2>&1; then
  aws configure set aws_access_key_id test --profile floci
  aws configure set aws_secret_access_key test --profile floci
  aws configure set region us-east-1 --profile floci
  aws configure set endpoint_url http://localhost:4566 --profile floci
fi

ACCOUNT=000000000000
BUCKET=carpool-history-exports
POLICY_NAME=carpool-lambda-access
POLICY_ARN="arn:aws:iam::${ACCOUNT}:policy/${POLICY_NAME}"

step() { printf '\n=== %s ===\n' "$1"; }

step "Part 1: S3 bucket $BUCKET"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket $BUCKET already exists."
else
  aws s3api create-bucket --bucket "$BUCKET" >/dev/null
  echo "Bucket $BUCKET created."
fi

aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  'BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true' 2>/dev/null
echo "Public access blocked."

aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' 2>/dev/null \
  && echo "Default AES256 encryption enabled." \
  || echo "Default encryption not supported on this emulator — skipping."

step "Part 2: Update IAM policy with S3 statements"
VERSIONS=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" \
  --query "Versions[?IsDefaultVersion==\`false\`].VersionId" --output text)
COUNT=$(echo "$VERSIONS" | wc -w)
if [ "$COUNT" -ge 4 ]; then
  OLDEST=$(echo "$VERSIONS" | tr '\t' '\n' | tail -1)
  aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$OLDEST"
  echo "Deleted oldest non-default policy version $OLDEST."
fi

aws iam create-policy-version --policy-arn "$POLICY_ARN" \
  --policy-document file://infra/iam/carpool-lambda-policy.json \
  --set-as-default >/dev/null
echo "Policy updated with S3 statements."

step "Part 3: Verification"
echo "--- Public Access Block ---"
aws s3api get-public-access-block --bucket "$BUCKET" --output table 2>/dev/null || echo "(not available)"
echo ""
echo "--- Policy Statement Sids ---"
aws iam get-policy-version --policy-arn "$POLICY_ARN" \
  --version-id "$(aws iam get-policy --policy-arn "$POLICY_ARN" --query 'Policy.DefaultVersionId' --output text)" \
  --query 'PolicyVersion.Document.Statement[].Sid' --output table
echo ""
echo "History exports bucket deployed."
