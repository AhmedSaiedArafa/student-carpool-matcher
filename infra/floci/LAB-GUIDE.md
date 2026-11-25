# Deploying Carpool Matcher on Floci – Lab 7 / Lab 8 style

This guide deploys the project the same way Lab 7 (Lambda + IAM + CloudWatch) and
Lab 8 (API Gateway + website) do: every resource can be created **Way A** in Floci Dash
or **Way B** with AWS CLI commands in Git Bash. The scripts below run Way B for you.

| Lab 7 / 8 | Carpool Matcher |
|---|---|
| DynamoDB table `CloudIssues` | RDS PostgreSQL `carpool-db` (our data is relational and needs transactions to prevent overbooking) |
| `seed-item.json` | `migrate.js` + `seed.js` (tables and demo data) |
| IAM role `cloud-issue-api-role` | IAM role `carpool-lambda-role` – `infra/iam/trust-policy.json` |
| Policy `issues-table-access` | Policy `carpool-lambda-access` – `infra/iam/carpool-lambda-policy.json` |
| Lambda `cloud-issue-api`, Node.js 24, `lambda.handler` | Lambda `carpool-api`, Node.js 24, `lambda.handler` |
| `DYNAMODB_TABLE = CloudIssues` | `SECRET_ID = carpool/config` (DATABASE_URL and JWT_SECRET come from Secrets Manager) |
| `npm run zip` → `backend/lambda.zip` | same |
| Saved events in `backend/events/` | same (5 events) |
| CloudWatch log group `/aws/lambda/cloud-issue-api` | `/aws/lambda/carpool-api` |
| Lab 8: API Gateway + website | API Gateway `carpool-http-api` + S3 website `carpool-frontend` |

## Before you start
- Docker Desktop shows **Engine running**.
- Git Bash and the AWS CLI are installed (`aws --version`).
- Open the project folder in Git Bash (right-click the folder → **Open Git Bash here**).

## One command each
```bash
bash infra/floci/deploy-backend.sh    # Lab 7: Parts 1-7
bash infra/floci/deploy-frontend.sh   # Lab 8: API Gateway + website
bash infra/floci/test-events.sh       # re-run the saved events any time
```
The scripts create the `floci` AWS profile if it does not exist yet.

---

## Part 1 – Start Floci and open Floci Dash
```bash
docker compose -f infra/floci/docker-compose.yml up -d
export AWS_PROFILE=floci
aws sts get-caller-identity --query Account --output text      # 000000000000
```
Open **http://localhost:4566/_floci/ui** (the first time, wait up to a minute).

✓ Checkpoint: Git Bash prints `000000000000`; Floci Dash shows **Connected**, region **us-east-1**.

## Part 2 – Create the database (instead of the DynamoDB table)
**Way A (Floci Dash):** RDS → Create database → engine PostgreSQL, identifier `carpool-db`,
master user `carpool`, password `carpool123`, database name `carpool`.

**Way B (Git Bash):**
```bash
aws rds create-db-instance --db-instance-identifier carpool-db \
  --db-instance-class db.t3.micro --engine postgres \
  --master-username carpool --master-user-password carpool123 \
  --db-name carpool --allocated-storage 20
aws rds describe-db-instances --db-instance-identifier carpool-db \
  --query "DBInstances[0].[DBInstanceStatus,Endpoint.Address,Endpoint.Port]" --output text
```
Create the tables and demo data (the database address only works inside Docker):
```bash
DATABASE_URL="postgresql://carpool:carpool123@<address>:<port>/carpool"
MSYS_NO_PATHCONV=1 docker run --rm --network container:floci -e DATABASE_URL="$DATABASE_URL" \
  -v "$(pwd -W)/backend:/app" -w /app node:20-alpine node src/db/migrate.js
MSYS_NO_PATHCONV=1 docker run --rm --network container:floci -e DATABASE_URL="$DATABASE_URL" \
  -v "$(pwd -W)/backend:/app" -w /app node:20-alpine node src/db/seed.js
```
✓ Checkpoint: `carpool-db` is **available**; migrate and seed print "complete".

## Part 3 – Secret, IAM role and least-privilege policy
The Lambda reads `DATABASE_URL` and `JWT_SECRET` from Secrets Manager, so no secret is
written in the function settings.

```bash
printf '{"DATABASE_URL":"%s","JWT_SECRET":"%s"}' "$DATABASE_URL" "a-long-random-secret" > out/secret.json
aws secretsmanager create-secret --name carpool/config --secret-string file://out/secret.json

aws iam create-role --role-name carpool-lambda-role \
  --assume-role-policy-document file://infra/iam/trust-policy.json
aws iam create-policy --policy-name carpool-lambda-access \
  --policy-document file://infra/iam/carpool-lambda-policy.json
aws iam attach-role-policy --role-name carpool-lambda-role \
  --policy-arn arn:aws:iam::000000000000:policy/carpool-lambda-access
```
**Way A:** IAM → Roles → Create role (paste `trust-policy.json`), IAM → Policies → Create
policy (paste `carpool-lambda-policy.json`), then attach the policy to the role.

The policy allows only two things:
1. `secretsmanager:GetSecretValue` on **our** secret `carpool/config`
2. writing the function's own CloudWatch logs

It cannot read other secrets, delete anything or touch other services (least privilege).
The database itself is protected by its own user and password, not by IAM.

> Floci stores permissions but does not check them by default. Real AWS always checks
> them, so a missing permission there gives `AccessDeniedException`.

✓ Checkpoint: role `carpool-lambda-role` exists with policy `carpool-lambda-access` attached.

## Part 4 – Zip the backend
```bash
cd backend && npm install && npm run zip && cd ..
```
`backend/lambda.js` runs the **same Express app** as `server.js`: serverless-http turns the
Lambda event into an Express request and the response back into the Lambda answer.

## Part 5 – Create the Lambda function
**Way A:** Lambda → Create function: name `carpool-api`, runtime **Node.js 24.x**, handler
`lambda.handler`, role `carpool-lambda-role`, upload `backend/lambda.zip`, environment
variable `SECRET_ID = carpool/config`, timeout **10 seconds**.

**Way B:**
```bash
printf '{"Variables":{"SECRET_ID":"carpool/config","NODE_OPTIONS":"--dns-result-order=ipv4first"}}' > out/lambda-env.json
aws lambda create-function --function-name carpool-api \
  --runtime nodejs24.x --handler lambda.handler \
  --role arn:aws:iam::000000000000:role/carpool-lambda-role \
  --zip-file fileb://backend/lambda.zip --timeout 10 \
  --environment file://out/lambda-env.json
```
✓ Checkpoint: `carpool-api` is **Active**.

## Part 6 – Test with saved events
```bash
aws lambda invoke --function-name carpool-api \
  --payload file://backend/events/2-login.json \
  --cli-binary-format raw-in-base64-out out/result.json
cat out/result.json
```
Or all at once: `bash infra/floci/test-events.sh`

| Event | Request | Expected |
|---|---|---|
| 1-health | GET /api/health | 200 |
| 2-login | POST /api/auth/login (seeded driver) | 200 + token |
| 3-login-invalid | POST /api/auth/login with a bad email | 400 |
| 4-no-token | GET /api/requests/mine without a token | 401 |
| 5-unknown-route | GET /api/does-not-exist | 404 |

**Way A:** Lambda → `carpool-api` → Invoke/Test, paste an event file.

## Part 7 – Logs and data
```bash
aws logs tail /aws/lambda/carpool-api --since 30m --format short
```
**Way A:** CloudWatch Logs → `/aws/lambda/carpool-api` → newest stream. You should see
`Configuration loaded from secret carpool/config` once per cold start.

## Part 8 (Lab 8) – API Gateway and the website
```bash
bash infra/floci/deploy-frontend.sh
```
It creates the HTTP API `carpool-http-api` (route `ANY /api/{proxy+}` → Lambda), hosts the
frontend in the S3 bucket `carpool-frontend`, and points the website's `config.js` at the
API. Open the printed **Website** URL and log in with `driver1@university.edu` / `Password123!`.

## Updating after a code change
```bash
cd backend && npm run zip && cd ..
aws lambda update-function-code --function-name carpool-api --zip-file fileb://backend/lambda.zip
bash infra/floci/deploy-frontend.sh     # only if the frontend changed
```

## Clean up
In PowerShell: `.\infra\floci\destroy.ps1`

## If something fails
- **Lambda answers 500 or "Task timed out":** run `aws logs tail /aws/lambda/carpool-api --since 10m`.
  If the log shows it cannot read the secret, add `DATABASE_URL` and `JWT_SECRET` to the
  function's environment variables instead (they take priority over the secret).
- **Website says "Failed to fetch":** open the Health URL from `deploy-frontend.sh` in the browser.
- **Geocoding:** `ORS_API_KEY` in `.env` is optional. When set, the backend uses OpenRouteService for geocoding; otherwise it falls back to Nominatim (no key needed).
