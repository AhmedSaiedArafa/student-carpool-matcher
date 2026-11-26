# Floci Local AWS Deployment

Simulate the full AWS deployment of CarpoolMatch locally using **Floci** (LocalStack) — a free local AWS emulator running on `http://localhost:4566`.

## Prerequisites

- **Docker Desktop** — running
- **AWS CLI v2** — installed and on PATH
- **Node.js 20+** — installed

## Service Mapping

| Production Service       | AWS Equivalent              | Floci Resource                       |
|--------------------------|-----------------------------|--------------------------------------|
| Cloudflare Pages         | S3 Static Website Hosting   | `carpool-frontend` bucket            |
| Backend API              | Lambda + API Gateway v2     | `carpool-api` function + HTTP API    |
| Neon PostgreSQL          | RDS PostgreSQL              | `carpool-db` RDS instance            |
| Environment Variables    | Secrets Manager             | `carpool/config` secret              |
| App Logs                 | CloudWatch Logs             | Automatic with Lambda                |
| Cron (expiry cleanup)    | EventBridge Scheduler       | `carpool-expiry-scheduler` rule      |

## Quick Start

```powershell
# Deploy everything (runs steps 01-10 in order)
.\infra\floci\deploy.ps1

# Check the deployed API and security rules
.\infra\floci\verify-deployment.ps1

# View the API logs (add -Follow to keep watching)
.\infra\floci\logs.ps1

# Tear down everything
.\infra\floci\destroy.ps1
```

Each step script can also be run on its own, e.g. `.\infra\floci\06-api-gateway.ps1`, as long as the steps before it have run.

## Lab 7 / Lab 8 style (Git Bash + AWS CLI)

The same deployment, done the way the labs teach it, is described step by step in
[LAB-GUIDE.md](LAB-GUIDE.md):

```bash
bash infra/floci/deploy-backend.sh    # RDS, secret, IAM role + least-privilege policy, npm run zip, Lambda (Node.js 24), saved events
bash infra/floci/deploy-frontend.sh   # API Gateway + S3 website
bash infra/floci/test-events.sh       # invoke the Lambda with backend/events/*.json
```

Policy files: `infra/iam/trust-policy.json` and `infra/iam/carpool-lambda-policy.json`.

## Scripts and Owners

| Script | AWS service | What it does | Owner |
|---|---|---|---|
| `_settings.ps1` | – | Shared names, endpoint, credentials and helpers used by every script | Remas |
| `docker-compose.yml` | – | Runs the emulator container on port 4566 | Remas |
| `deploy.ps1` | – | Runs all steps in order and prints the URLs | Remas |
| `01-start-floci.ps1` | – | Starts the emulator and waits until it is ready | Remas |
| `02-database-rds.ps1` | RDS PostgreSQL | Creates `carpool-db` and waits until it is available | Ahmed |
| `03-secrets.ps1` | Secrets Manager | Stores `DATABASE_URL` and `JWT_SECRET` in `carpool/config` | Ahmed |
| `04-iam-role.ps1` | IAM | Creates the Lambda role and attaches the least-privilege policy from `infra/iam/` | Youssef |
| `05-lambda.ps1` | Lambda | Zips the Express API and deploys `carpool-api` | Remas |
| `06-api-gateway.ps1` | API Gateway v2 | Creates the HTTP API, `/api/{proxy+}` route and CORS | Remas |
| `07-frontend-s3.ps1` | S3 | Creates the website bucket and uploads the frontend | Remas |
| `08-migrate-seed.ps1` | RDS | Creates the tables and demo data | Ahmed |
| `deploy-expiry.sh` | EventBridge + Lambda | EventBridge rule + Lambda `carpool-expiry` for stale request/offer expiry | Ahmed |
| `deploy-history-exports.sh` | S3 + IAM | Private S3 bucket `carpool-history-exports` + IAM policy update | Youssef |
| `10-cloudwatch-logs.ps1` | CloudWatch Logs | Creates the log group with 7-day retention | Youssef |
| `logs.ps1` | CloudWatch Logs | Shows the API logs | Youssef |
| `verify-deployment.ps1` | – | Tests health, login, 401 and 403/404 on the deployed API | Youssef |
| `destroy.ps1` | all | Removes every resource and stops the container | Youssef |

### Remas – compute, API and hosting
Starts the emulator, packages the Express app with `serverless-http` into a Lambda function, exposes it through an API Gateway HTTP API, and hosts the frontend on S3. `07-frontend-s3.ps1` temporarily writes the API Gateway URL into `config.js`, uploads the site, then restores the original file.

### Ahmed – data and scheduling
Creates the RDS PostgreSQL database that replaces Neon, stores the connection string and JWT secret in Secrets Manager, runs `migrate.js` and `seed.js` against RDS, and schedules the auto-expiry of stale requests and waitlist offers with EventBridge.

### Youssef – security, monitoring and verification
Creates a least-privilege IAM role for the Lambda, sets up CloudWatch Logs with retention, provides `logs.ps1` to read the logs, checks the deployment with `verify-deployment.ps1`, and removes everything with `destroy.ps1`.

## URLs (after deploy)

| Service        | URL                                                               |
|----------------|-------------------------------------------------------------------|
| Website        | `http://carpool-frontend.s3-website.localhost.localstack.cloud:4566` |
| API            | `http://localhost:4566/_aws/execute-api/<api-id>/api`             |
| Health Check   | `http://localhost:4566/_aws/execute-api/<api-id>/api/health`      |

## Test Credentials

| Email                      | Password      | Role   |
|----------------------------|---------------|--------|
| `driver1@university.edu`   | `Password123!`| Driver |
| `rider1@university.edu`    | `Password123!`| Rider  |

## Architecture

```
┌─────────────┐    ┌────────────────────────────┐    ┌───────────┐
│   Browser   │───▸│  S3 Static Website (4566)  │    │           │
│             │    │  carpool-frontend bucket    │    │  RDS      │
│             │    └────────────────────────────┘    │  Postgres │
│             │                                      │  carpool  │
│             │    ┌────────────────────────────┐    │           │
│             │───▸│  API Gateway v2 HTTP API   │───▸│           │
│             │    │  ANY /api/{proxy+}         │    │           │
│             │    │       ↓                    │    │           │
│             │    │  Lambda: carpool-api       │───▸│           │
│             │    │  (serverless-http+Express) │    │           │
│             │    └────────────────────────────┘    └───────────┘
│             │                                      ┌───────────┐
│             │    ┌────────────────────────────┐    │  Secrets  │
│             │    │  EventBridge Scheduler     │    │  Manager  │
│             │    │  rate(15 min) → Lambda     │    │  carpool/ │
│             │    └────────────────────────────┘    │  config   │
│             │                                      └───────────┘
└─────────────┘
       All services run inside Floci (LocalStack) on localhost:4566
```

## Teardown

`destroy.ps1` removes all resources (EventBridge, API Gateway, Lambda, log group, IAM role, S3, secret, RDS) and stops the Docker container with `docker compose down -v`.
