#!/usr/bin/env bash
# Deploy the carpool-expiry Lambda and EventBridge rule to Floci.
# Run from the project folder in Git Bash:  bash infra/floci/deploy-expiry.sh
# Requires: deploy-backend.sh has already run (creates lambda.zip, IAM role, env file).
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-floci}"
export MSYS_NO_PATHCONV=1

if ! aws configure get endpoint_url --profile floci >/dev/null 2>&1; then
  aws configure set aws_access_key_id test --profile floci
  aws configure set aws_secret_access_key test --profile floci
  aws configure set region us-east-1 --profile floci
  aws configure set endpoint_url http://localhost:4566 --profile floci
fi

REGION=us-east-1
ACCOUNT=000000000000
ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/carpool-lambda-role"
FUNCTION=carpool-expiry
RULE_NAME=carpool-expiry-every-15-min

mkdir -p out
step() { printf '\n=== %s ===\n' "$1"; }

step "Part 1: Create or update Lambda $FUNCTION"
if aws lambda get-function --function-name "$FUNCTION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FUNCTION" --zip-file fileb://backend/lambda.zip >/dev/null
  aws lambda wait function-updated-v2 --function-name "$FUNCTION" || true
  aws lambda update-function-configuration --function-name "$FUNCTION" \
    --runtime nodejs24.x --role "$ROLE_ARN" --timeout 30 --memory-size 512 \
    --handler expiry.handler --environment file://out/lambda-env.json >/dev/null
  echo "Function $FUNCTION updated."
else
  aws lambda create-function --function-name "$FUNCTION" \
    --runtime nodejs24.x --handler expiry.handler --role "$ROLE_ARN" \
    --zip-file fileb://backend/lambda.zip --timeout 30 --memory-size 512 \
    --environment file://out/lambda-env.json >/dev/null
  echo "Function $FUNCTION created."
fi
until [ "$(aws lambda get-function --function-name "$FUNCTION" --query 'Configuration.State' --output text)" = "Active" ]; do sleep 2; done
echo "Function $FUNCTION is Active."

step "Part 2: EventBridge rule $RULE_NAME"
RULE_ARN=$(aws events put-rule --name "$RULE_NAME" \
  --schedule-expression "rate(15 minutes)" \
  --state ENABLED \
  --query 'RuleArn' --output text)
echo "Rule ARN: $RULE_ARN"

FUNCTION_ARN="arn:aws:lambda:${REGION}:${ACCOUNT}:function:${FUNCTION}"

aws lambda add-permission --function-name "$FUNCTION" \
  --statement-id "${RULE_NAME}-invoke" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "$RULE_ARN" 2>/dev/null || echo "Permission already exists."

aws events put-targets --rule "$RULE_NAME" \
  --targets "Id=1,Arn=$FUNCTION_ARN" >/dev/null
echo "Target set: $FUNCTION_ARN"

step "Part 3: Manual test invocation"
aws lambda invoke --function-name "$FUNCTION" \
  --payload '{"source":"manual-test"}' \
  --cli-binary-format raw-in-base64-out \
  out/expiry-result.json >/dev/null
echo "Result:"
cat out/expiry-result.json
echo ""

step "Part 4: Verification"
echo "--- Rule ---"
aws events describe-rule --name "$RULE_NAME" --output table
echo ""
echo "--- Targets ---"
aws events list-targets-by-rule --rule "$RULE_NAME" --output table
echo ""
echo "EventBridge expiry deployed."
