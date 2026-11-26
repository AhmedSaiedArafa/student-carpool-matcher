# Student Carpool Matcher

Cloud-based ride-sharing platform for university students. Drivers publish recurring trips, riders discover compatible rides by location and schedule, request seats, and review completed journeys.

## Team

- **Remas** — Ride Management (publish, edit, pause/resume, cancel rides; manage requests and passengers)
- **Ahmed** — Matching & Requests (discover rides, request seats, waitlist, notifications)
- **Youssef** — History & Reliability (trip history, two-way ratings, badges, attendance)

## Tech Stack

- **Frontend:** HTML, CSS, vanilla JavaScript, Leaflet + OpenStreetMap → hosted as an **S3 static website**
- **Backend:** Node.js + Express REST API (modular monolith: auth, rides, matching, history) → **AWS Lambda** (nodejs24.x) behind **API Gateway v2 HTTP API**
- **Database:** **Amazon RDS PostgreSQL 16** with parameterized SQL and transactions
- **Secrets:** **AWS Secrets Manager** (`carpool/config` holds `DATABASE_URL` and `JWT_SECRET`, loaded by the Lambda on cold start)
- **Security:** least-privilege **IAM** role `carpool-lambda-role`, bcrypt password hashing, JWT tokens
- **Scheduled jobs:** **Amazon EventBridge** rule `carpool-expiry-every-15-min` triggers a second **Lambda** (`carpool-expiry`) to expire stale requests/offers and re-offer freed seats
- **Object storage:** **Amazon S3** bucket `carpool-history-exports` stores trip-history CSV exports per user, with public-access blocked and AES-256 default encryption
- **Monitoring:** **CloudWatch Logs** (`/aws/lambda/carpool-api`, `/aws/lambda/carpool-expiry`)
- **Geo:** backend `/api/geocode` uses OpenRouteService when `ORS_API_KEY` is set, otherwise Nominatim (OpenStreetMap), limited to Egypt
- **Cloud environment:** all AWS services run on **Floci**, a local AWS emulator (`localhost:4566`), as in Lab 7

## Live URLs (Floci)

| What | URL |
|---|---|
| Website | http://carpool-frontend.s3-website.localhost.localstack.cloud:4566 |
| API | http://f1a3e18c52.execute-api.localhost.floci.io:4566/api |
| Health check | http://f1a3e18c52.execute-api.localhost.floci.io:4566/api/health |
| Floci Dash | http://localhost:4566/_floci/ui |

> The API id (`f1a3e18c52`) is created on first deploy and may differ on another machine; `deploy-frontend.sh` prints the current one.

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (local) for running without Floci
- OpenRouteService API key (optional)

### 1. Clone and install

```bash
git clone https://github.com/AhmedSaiedArafa/student-carpool-matcher.git
cd student-carpool-matcher
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values:
# DATABASE_URL=postgresql://user:password@host:5432/carpool
# JWT_SECRET=your-secret-key-at-least-32-chars
# ORS_API_KEY=your-openrouteservice-key (optional)
# FRONTEND_URL=http://localhost:5500
```

### 3. Run migrations and seed

```bash
npm run migrate
npm run seed
```

### 4. Start the backend (port 3000)

```bash
npm run dev
```

### 5. Start the frontend (port 5500)

Using VS Code Live Server or any static server:

```bash
cd frontend
npx serve -l 5500
# Or use VS Code Live Server extension on port 5500
```

### 6. Demo accounts (from seed)

| Email | Password | Role |
|---|---|---|
| driver1@university.edu | Password123! | Driver |
| driver2@university.edu | Password123! | Driver |
| rider1@university.edu | Password123! | Rider |
| rider2@university.edu | Password123! | Rider |

## Running Tests

```bash
cd backend
npm test
```

Tests require a running database. They cover the full integration path: register → login → create ride → search → request → approve → complete → rate, plus security and overbooking prevention.

## Deploy (Floci / Local AWS)

The whole stack is deployed to **Floci**, which emulates S3, Lambda, API Gateway, RDS, Secrets Manager, IAM and CloudWatch on `localhost:4566`.

### Prerequisites

- Docker Desktop (running)
- AWS CLI v2 with a `floci` profile (the scripts create it if missing)
- Git Bash (Windows) or any bash shell
- Node.js 20+

### Deploy

Run from the project folder in Git Bash:

```bash
export AWS_PROFILE=floci
export MSYS_NO_PATHCONV=1          # Git Bash only: stops path conversion of /aws/... names
docker compose -f infra/floci/docker-compose.yml up -d   # start Floci
bash infra/floci/deploy-backend.sh          # RDS, secret, IAM role + policy, Lambda, migrations, seed
bash infra/floci/deploy-expiry.sh           # EventBridge rule + carpool-expiry Lambda
bash infra/floci/deploy-history-exports.sh  # S3 bucket + IAM policy update for CSV exports
bash infra/floci/deploy-frontend.sh         # API Gateway HTTP API + S3 website
bash infra/floci/test-events.sh             # 7 Lambda test events
bash infra/floci/report-tests.sh            # 56 API tests through API Gateway -> out/report-tests.md
```

`deploy-backend.sh` re-seeds the database, so log out and log in again after each backend deploy.

The PowerShell scripts in `infra/floci/*.ps1` are an older alternative; the bash scripts above are the ones used for the final deployment.

### Logs

```bash
aws logs tail /aws/lambda/carpool-api --since 10m
```

## API Endpoints

| Method | Endpoint | Purpose | Role |
|---|---|---|---|
| POST | /api/auth/register | Create account | Public |
| POST | /api/auth/login | Login | Public |
| GET | /api/auth/verify/:token | Verify email | Public |
| GET | /api/auth/profile | Get own profile | Auth |
| POST | /api/rides | Create ride template | Driver |
| GET | /api/rides/mine | List own rides | Driver |
| PATCH | /api/rides/:id | Edit ride | Owner |
| PATCH | /api/rides/:id/status | Pause/resume/cancel | Owner |
| GET | /api/trips/:id | Trip details | Auth |
| GET | /api/trips/:id/requests | View requests | Owner |
| GET | /api/trips/:id/passengers | Passenger list | Owner |
| PATCH | /api/trips/:id/status | Cancel trip | Owner |
| PATCH | /api/requests/:id/decision | Accept/reject | Owner |
| GET | /api/drivers/dashboard | Dashboard | Driver |
| GET | /api/matches | Search rides | Rider |
| POST | /api/trips/:id/requests | Request seat | Rider |
| DELETE | /api/requests/:id | Withdraw request | Owner |
| GET | /api/requests/mine | My requests | Rider |
| POST | /api/trips/:id/waitlist | Join waitlist | Rider |
| DELETE | /api/waitlist/:id | Leave waitlist | Owner |
| POST | /api/waitlist/:id/accept | Accept offer | Owner |
| GET | /api/history | Trip history | Auth |
| POST | /api/history/export | Export history to S3 as CSV | Auth |
| GET | /api/history/exports | List saved CSV exports | Auth |
| PATCH | /api/trips/:id/complete | Complete trip | Driver |
| POST | /api/trips/:id/ratings | Rate | Participant |
| GET | /api/users/:id/reliability | Reliability | Auth |
| GET | /api/users/:id/badges | Badges | Auth |
| GET | /api/notifications | Notifications | Auth |
| PATCH | /api/notifications/:id/read | Mark read | Auth |
| PATCH | /api/notifications/read-all | Mark all read | Auth |
| GET | /api/geocode?q= | Place search (external API) | Public |
| GET | /api/geocode/reverse | Coordinates → address | Public |
| GET | /api/stats | Home page statistics | Public |
| GET | /api/health | Health check | Public |

## Assumptions

1. **Email verification**: The register endpoint returns a verification token. In production, this would be sent via email. For demo/testing, seed data has `email_verified = true`. The `.edu` domain check accepts `.edu`, `.ac`, and `.edu.*` patterns.
2. **Trip instances**: When a ride template is created, 4 weeks of trip instances are auto-generated. In production, a cron job would generate new instances weekly.
3. **Waitlist offer window**: 30 minutes to accept a freed seat before it's offered to the next person.
4. **Stale request expiry**: Pending requests and unanswered seat offers auto-expire after 48 hours. On Floci, EventBridge runs the expiry Lambda every 15 minutes; in production the schedule can be tuned without code changes.
5. **Coordinates**: The search uses latitude/longitude. Place names are converted to coordinates by the backend geocoder (OpenRouteService or Nominatim), limited to Egypt.
6. **No real email sending**: Email verification flow exists in the API but no email provider is integrated.
7. **Cloudflare Turnstile**: Not implemented — marked as optional in the spec.
8. **Demo secret**: the JWT secret in `deploy-backend.sh` is a demo value for the local emulator only; a real deployment would generate it and keep it only in Secrets Manager.

## Project Structure

```
├── README.md
├── .gitignore
├── infra/
│   ├── floci/   (deploy, test and Lab scripts — includes deploy-expiry.sh, deploy-history-exports.sh)
│   └── iam/     (trust policy + least-privilege policy)
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js
│   ├── lambda.js
│   ├── expiry.js
│   ├── api/index.js
│   ├── tests/integration.test.js
│   └── src/
│       ├── app.js
│       ├── routes.js
│       ├── config/env.js
│       ├── db/
│       │   ├── index.js
│       │   ├── migrate.js
│       │   ├── seed.js
│       │   └── migrations/001_init.sql, 002_offered_fare.sql, 003_ride_schedule.sql
│       ├── middleware/
│       │   ├── auth.js
│       │   ├── validate.js
│       │   └── errorHandler.js
│       ├── utils/
│       │   ├── AppError.js
│       │   └── geo.js
│       └── modules/
│           ├── auth/
│           │   ├── routes.js
│           │   ├── controller.js
│           │   ├── service.js
│           │   ├── repository.js
│           │   └── validation.js
│           ├── rides/
│           │   ├── routes.js
│           │   ├── controller.js
│           │   ├── service.js
│           │   ├── repository.js
│           │   └── validation.js
│           ├── matching/
│           │   ├── routes.js
│           │   ├── controller.js
│           │   ├── service.js
│           │   ├── repository.js
│           │   ├── validation.js
│           │   └── notificationService.js
│           └── history/
│               ├── routes.js
│               ├── controller.js
│               ├── service.js
│               ├── repository.js
│               ├── validation.js
│               └── exportStorage.js
└── frontend/
    ├── index.html
    ├── pages/
    │   ├── login.html
    │   ├── register.html
    │   ├── search.html
    │   ├── dashboard.html
    │   ├── publish-ride.html
    │   ├── my-rides.html
    │   ├── my-requests.html
    │   ├── trip-detail.html
    │   ├── history.html
    │   ├── profile.html
    │   └── notifications.html
    └── assets/
        ├── css/
        │   ├── base.css
        │   ├── components.css
        │   ├── layout.css
        │   └── pages.css
        └── js/
            ├── config.js
            ├── api.js
            ├── auth.js
            ├── ui.js
            ├── location-picker.js
            └── pages/
                ├── login.js
                ├── register.js
                ├── search.js
                ├── dashboard.js
                ├── publish-ride.js
                ├── my-rides.js
                ├── my-requests.js
                ├── trip-detail.js
                ├── history.js
                ├── profile.js
                └── notifications.js
```