#!/usr/bin/env bash
# Lab 7 style: deploy the Carpool Matcher backend to Floci with the AWS CLI.
# Run from the project folder in Git Bash:   bash infra/floci/deploy-backend.sh
#
# Parts (same order as Lab 7):
#   1 Start Floci            4 Zip the backend (npm run zip)
#   2 RDS database + tables  5 Create the Lambda function
#   3 Secret + IAM role      6 Test it with saved events (+ 7 logs)
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
DB_INSTANCE=carpool-db; DB_NAME=carpool; DB_USER=carpool; DB_PASS=carpool123
JWT_SECRET='floci-jwt-secret-at-least-32-characters-long!!'
SECRET_NAME=carpool/config
ROLE_NAME=carpool-lambda-role
POLICY_NAME=carpool-lambda-access
POLICY_ARN="arn:aws:iam::${ACCOUNT}:policy/${POLICY_NAME}"
ROLE_ARN="arn:aws:iam::${ACCOUNT}:role/${ROLE_NAME}"
FUNCTION=carpool-api
WEBSITE_URL="http://carpool-frontend.s3-website.localhost.localstack.cloud:4566"

mkdir -p out
step() { printf '\n=== %s ===\n' "$1"; }

step "Part 1: Start Floci"
docker compose -f infra/floci/docker-compose.yml up -d
for i in $(seq 1 30); do
  aws sts get-caller-identity --query Account --output text >/dev/null 2>&1 && break
  [ "$i" = 30 ] && { echo "Floci did not answer on http://localhost:4566"; exit 1; }
  sleep 2
done
echo "Floci is running. Account: $(aws sts get-caller-identity --query Account --output text)"
echo "Floci Dash: http://localhost:4566/_floci/ui"

step "Part 2: RDS PostgreSQL database"
if aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE" >/dev/null 2>&1; then
  echo "Database $DB_INSTANCE already exists."
else
  aws rds create-db-instance --db-instance-identifier "$DB_INSTANCE" \
    --db-instance-class db.t3.micro --engine postgres \
    --master-username "$DB_USER" --master-user-password "$DB_PASS" \
    --db-name "$DB_NAME" --allocated-storage 20 >/dev/null
  echo "Database $DB_INSTANCE requested."
fi
until [ "$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE" \
          --query 'DBInstances[0].DBInstanceStatus' --output text)" = "available" ]; do
  echo "  waiting for the database..."; sleep 3
done
DB_HOST=$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE" --query 'DBInstances[0].Endpoint.Address' --output text)
DB_PORT=$(aws rds describe-db-instances --db-instance-identifier "$DB_INSTANCE" --query 'DBInstances[0].Endpoint.Port' --output text)
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo "DATABASE_URL = $DATABASE_URL"

echo "Creating tables and demo data (inside Docker, where the database address works)..."
for script in src/db/migrate.js src/db/seed.js; do
  MSYS_NO_PATHCONV=1 docker run --rm --network container:floci \
    -e "DATABASE_URL=$DATABASE_URL" -v "$(pwd -W 2>/dev/null || pwd)/backend:/app" -w /app \
    node:20-alpine node "$script"
done

step "Part 3: Secret, IAM role and least-privilege policy"
printf '{"DATABASE_URL":"%s","JWT_SECRET":"%s"}' "$DATABASE_URL" "$JWT_SECRET" > out/secret.json
if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --secret-string file://out/secret.json >/dev/null
  echo "Secret $SECRET_NAME updated."
else
  aws secretsmanager create-secret --name "$SECRET_NAME" --secret-string file://out/secret.json >/dev/null
  echo "Secret $SECRET_NAME created."
fi

aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1 || \
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document file://infra/iam/trust-policy.json >/dev/null
aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1 || \
  aws iam create-policy --policy-name "$POLICY_NAME" \
    --policy-document file://infra/iam/carpool-lambda-policy.json >/dev/null
aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$POLICY_ARN"
echo "Role $ROLE_NAME has policy $POLICY_NAME attached."

step "Part 4: Zip the backend"
(cd backend && npm install --no-audit --no-fund && rm -f lambda.zip && npm run zip)

step "Part 5: Create or update the Lambda function"
cat > out/lambda-env.json <<EOF
{"Variables":{"SECRET_ID":"${SECRET_NAME}","FRONTEND_URL":"${WEBSITE_URL}","NODE_OPTIONS":"--dns-result-order=ipv4first"}}
EOF
if aws lambda get-function --function-name "$FUNCTION" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$FUNCTION" --zip-file fileb://backend/lambda.zip >/dev/null
  aws lambda wait function-updated-v2 --function-name "$FUNCTION" || true
  aws lambda update-function-configuration --function-name "$FUNCTION" \
    --runtime nodejs24.x --role "$ROLE_ARN" --timeout 10 --memory-size 512 \
    --environment file://out/lambda-env.json >/dev/null
  echo "Function $FUNCTION updated."
else
  aws lambda create-function --function-name "$FUNCTION" \
    --runtime nodejs24.x --handler lambda.handler --role "$ROLE_ARN" \
    --zip-file fileb://backend/lambda.zip --timeout 10 --memory-size 512 \
    --environment file://out/lambda-env.json >/dev/null
  echo "Function $FUNCTION created."
fi
until [ "$(aws lambda get-function --function-name "$FUNCTION" --query 'Configuration.State' --output text)" = "Active" ]; do sleep 2; done
echo "Function $FUNCTION is Active."

step "Part 6: Test with saved events"
bash infra/floci/test-events.sh

step "Part 7: Logs"
echo "aws logs tail /aws/lambda/$FUNCTION --since 30m --format short"
echo "Backend deployed. Next (Lab 8): bash infra/floci/deploy-frontend.sh"
