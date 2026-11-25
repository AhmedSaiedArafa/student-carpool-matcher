#!/usr/bin/env bash
# Lab 8 style: give the Lambda a web address with API Gateway, and host the
# website on S3 so it calls that address.
# Run from the project folder in Git Bash (after deploy-backend.sh):
#   bash infra/floci/deploy-frontend.sh
set -euo pipefail

export AWS_PROFILE="${AWS_PROFILE:-floci}"

# Use the "floci" AWS profile from the Quick Installation Guide (create it if missing).
if ! aws configure get endpoint_url --profile floci >/dev/null 2>&1; then
  aws configure set aws_access_key_id test --profile floci
  aws configure set aws_secret_access_key test --profile floci
  aws configure set region us-east-1 --profile floci
  aws configure set endpoint_url http://localhost:4566 --profile floci
  echo "Created the AWS profile 'floci' (endpoint http://localhost:4566)."
fi
REGION=us-east-1
ACCOUNT=000000000000
FUNCTION=carpool-api
LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT}:function:${FUNCTION}"
API_NAME=carpool-http-api
BUCKET=carpool-frontend
WEBSITE_URL="http://${BUCKET}.s3-website.localhost.localstack.cloud:4566"
mkdir -p out
step() { printf '\n=== %s ===\n' "$1"; }

step "API Gateway HTTP API"
API_ID=$(aws apigatewayv2 get-apis --query "Items[?Name=='${API_NAME}'].ApiId | [0]" --output text)
if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  API_ID=$(aws apigatewayv2 create-api --name "$API_NAME" --protocol-type HTTP \
    --cors-configuration "AllowOrigins=*,AllowMethods=GET,POST,PUT,PATCH,DELETE,OPTIONS,AllowHeaders=Content-Type,Authorization" \
    --query ApiId --output text)
  echo "API created: $API_ID"
else
  echo "API already exists: $API_ID"
fi

INTEG_ID=$(aws apigatewayv2 get-integrations --api-id "$API_ID" --query "Items[0].IntegrationId" --output text)
if [ -z "$INTEG_ID" ] || [ "$INTEG_ID" = "None" ]; then
  INTEG_ID=$(aws apigatewayv2 create-integration --api-id "$API_ID" --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" --payload-format-version 2.0 --query IntegrationId --output text)
fi
for ROUTE in 'ANY /api/{proxy+}' 'GET /api/health'; do
  EXISTS=$(aws apigatewayv2 get-routes --api-id "$API_ID" --query "Items[?RouteKey=='${ROUTE}'].RouteId | [0]" --output text)
  if [ -z "$EXISTS" ] || [ "$EXISTS" = "None" ]; then
    aws apigatewayv2 create-route --api-id "$API_ID" --route-key "$ROUTE" --target "integrations/$INTEG_ID" >/dev/null
    echo "Route '$ROUTE' created."
  fi
done
aws apigatewayv2 create-stage --api-id "$API_ID" --stage-name '$default' --auto-deploy >/dev/null 2>&1 || true
API_URL="http://${API_ID}.execute-api.localhost.floci.io:4566"
echo "API URL: $API_URL/api"

step "S3 website"
aws s3api head-bucket --bucket "$BUCKET" >/dev/null 2>&1 || aws s3api create-bucket --bucket "$BUCKET" >/dev/null
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
  BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false || true
aws s3 website "s3://$BUCKET" --index-document index.html --error-document index.html
cat > out/bucket-policy.json <<EOF
{"Version":"2012-10-17","Statement":[{"Sid":"PublicRead","Effect":"Allow","Principal":"*","Action":"s3:GetObject","Resource":"arn:aws:s3:::${BUCKET}/*"}]}
EOF
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file://out/bucket-policy.json || echo "(bucket policy not applied, continuing)"

# Upload a copy of the frontend whose config.js points at API Gateway.
rm -rf out/site && cp -r frontend out/site && rm -rf out/site/node_modules out/site/package*.json
printf "\n// Added by deploy-frontend.sh\nCONFIG.API_URL = '%s/api';\n" "$API_URL" >> out/site/assets/js/config.js
aws s3 sync out/site "s3://$BUCKET" --delete >/dev/null
echo "Website uploaded."

step "Done"
echo "Website : $WEBSITE_URL"
echo "API     : $API_URL/api"
echo "Health  : $API_URL/api/health"
echo "Login   : driver1@university.edu / Password123!"
