# Code Ownership and Push Plan

Every file in this repository belongs to exactly one team member, who pushes it from their own GitHub account.
The final `main` branch must be identical to the reference copy of the project.

## Summary

| Member | Role | Files |
|---|---|---|
| Remas | Ride Management, auth, backend skeleton, Floci compute/API/hosting | 43 |
| Ahmed | Matching & Requests, database, Floci data and scheduling | 28 |
| Youssef | History & Reliability, repo, errors, tests, Floci security/monitoring | 26 |

## Push order

Each step is merged into `main` (via pull request) before the next one starts. The app only runs once all steps are merged.

| Step | Member | Branch | Commit message |
|---|---|---|---|
| 1 | Youssef | `main` | Set up repository: .gitignore, README and ownership list |
| 2 | Ahmed | `feature/database-ahmed` | Add PostgreSQL schema, migration runner, seed data and env example |
| 3 | Remas | `feature/ride-management-remas` | Add Express skeleton, config, auth middleware and auth module |
| 4 | Remas | `feature/ride-management-remas` | Add ride management: recurring rides, trips, request decisions, dashboard |
| 5 | Ahmed | `feature/matching-requests-ahmed` | Add matching, seat requests, waitlist and notifications |
| 6 | Youssef | `feature/history-ratings-youssef` | Add history, two-way ratings, reliability, error handling and tests |
| 7 | Remas | `feature/frontend-remas` | Add frontend base (styles, API client, auth, UI helpers) and driver pages |
| 8 | Ahmed | `feature/frontend-ahmed` | Add home, login, search, requests and notifications pages |
| 9 | Youssef | `feature/frontend-youssef` | Add register, history and profile pages, layout and page styles |
| 10 | Remas | `feature/floci-remas` | Add Floci deployment: settings, emulator, Lambda, API Gateway, S3 hosting |
| 11 | Ahmed | `feature/floci-ahmed` | Add Floci deployment: RDS, Secrets Manager, migrations, EventBridge expiry |
| 12 | Youssef | `feature/floci-youssef` | Add Floci deployment: IAM role, CloudWatch logs, verification, teardown, docs |

## Step 1 – Youssef

Branch: `main`  
Commit: Set up repository: .gitignore, README and ownership list

- `.gitignore`
- `OWNERSHIP.md`
- `README.md`

## Step 2 – Ahmed

Branch: `feature/database-ahmed`  
Commit: Add PostgreSQL schema, migration runner, seed data and env example

- `backend/.env.example`
- `backend/src/db/index.js`
- `backend/src/db/migrate.js`
- `backend/src/db/migrations/001_init.sql`
- `backend/src/db/seed.js`

## Step 3 – Remas

Branch: `feature/ride-management-remas`  
Commit: Add Express skeleton, config, auth middleware and auth module

- `backend/api/auth.js`
- `backend/api/index.js`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/server.js`
- `backend/src/app.js`
- `backend/src/config/env.js`
- `backend/src/middleware/auth.js`
- `backend/src/middleware/validate.js`
- `backend/src/modules/auth/controller.js`
- `backend/src/modules/auth/repository.js`
- `backend/src/modules/auth/routes.js`
- `backend/src/modules/auth/service.js`
- `backend/src/modules/auth/validation.js`
- `backend/src/routes.js`

## Step 4 – Remas

Branch: `feature/ride-management-remas`  
Commit: Add ride management: recurring rides, trips, request decisions, dashboard

- `backend/api/rides.js`
- `backend/api/trips.js`
- `backend/lambda.js`
- `backend/src/modules/rides/controller.js`
- `backend/src/modules/rides/repository.js`
- `backend/src/modules/rides/routes.js`
- `backend/src/modules/rides/service.js`
- `backend/src/modules/rides/validation.js`

## Step 5 – Ahmed

Branch: `feature/matching-requests-ahmed`  
Commit: Add matching, seat requests, waitlist and notifications

- `backend/api/matching.js`
- `backend/src/modules/matching/controller.js`
- `backend/src/modules/matching/notificationService.js`
- `backend/src/modules/matching/repository.js`
- `backend/src/modules/matching/routes.js`
- `backend/src/modules/matching/service.js`
- `backend/src/modules/matching/validation.js`
- `backend/src/utils/geo.js`

## Step 6 – Youssef

Branch: `feature/history-ratings-youssef`  
Commit: Add history, two-way ratings, reliability, error handling and tests

- `backend/api/history.js`
- `backend/src/middleware/errorHandler.js`
- `backend/src/modules/history/controller.js`
- `backend/src/modules/history/repository.js`
- `backend/src/modules/history/routes.js`
- `backend/src/modules/history/service.js`
- `backend/src/utils/AppError.js`
- `backend/tests/integration.test.js`

## Step 7 – Remas

Branch: `feature/frontend-remas`  
Commit: Add frontend base (styles, API client, auth, UI helpers) and driver pages

- `frontend/assets/css/base.css`
- `frontend/assets/js/api.js`
- `frontend/assets/js/auth.js`
- `frontend/assets/js/config.js`
- `frontend/assets/js/pages/dashboard.js`
- `frontend/assets/js/pages/my-rides.js`
- `frontend/assets/js/pages/publish-ride.js`
- `frontend/assets/js/pages/trip-detail.js`
- `frontend/assets/js/ui.js`
- `frontend/pages/dashboard.html`
- `frontend/pages/my-rides.html`
- `frontend/pages/publish-ride.html`
- `frontend/pages/trip-detail.html`

## Step 8 – Ahmed

Branch: `feature/frontend-ahmed`  
Commit: Add home, login, search, requests and notifications pages

- `frontend/assets/css/components.css`
- `frontend/assets/js/location-picker.js`
- `frontend/assets/js/pages/login.js`
- `frontend/assets/js/pages/my-requests.js`
- `frontend/assets/js/pages/notifications.js`
- `frontend/assets/js/pages/search.js`
- `frontend/index.html`
- `frontend/pages/login.html`
- `frontend/pages/my-requests.html`
- `frontend/pages/notifications.html`
- `frontend/pages/search.html`

## Step 9 – Youssef

Branch: `feature/frontend-youssef`  
Commit: Add register, history and profile pages, layout and page styles

- `frontend/assets/css/layout.css`
- `frontend/assets/css/pages.css`
- `frontend/assets/js/pages/history.js`
- `frontend/assets/js/pages/profile.js`
- `frontend/assets/js/pages/register.js`
- `frontend/package.json`
- `frontend/pages/history.html`
- `frontend/pages/profile.html`
- `frontend/pages/register.html`

## Step 10 – Remas

Branch: `feature/floci-remas`  
Commit: Add Floci deployment: settings, emulator, Lambda, API Gateway, S3 hosting

- `infra/floci/01-start-floci.ps1`
- `infra/floci/05-lambda.ps1`
- `infra/floci/06-api-gateway.ps1`
- `infra/floci/07-frontend-s3.ps1`
- `infra/floci/_settings.ps1`
- `infra/floci/deploy.ps1`
- `infra/floci/docker-compose.yml`

## Step 11 – Ahmed

Branch: `feature/floci-ahmed`  
Commit: Add Floci deployment: RDS, Secrets Manager, migrations, EventBridge expiry

- `infra/floci/02-database-rds.ps1`
- `infra/floci/03-secrets.ps1`
- `infra/floci/08-migrate-seed.ps1`
- `infra/floci/09-eventbridge-expiry.ps1`

## Step 12 – Youssef

Branch: `feature/floci-youssef`  
Commit: Add Floci deployment: IAM role, CloudWatch logs, verification, teardown, docs

- `infra/floci/04-iam-role.ps1`
- `infra/floci/10-cloudwatch-logs.ps1`
- `infra/floci/README.md`
- `infra/floci/destroy.ps1`
- `infra/floci/logs.ps1`
- `infra/floci/verify-deployment.ps1`
