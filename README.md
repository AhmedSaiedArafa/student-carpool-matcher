# Student Carpool Matcher

Cloud-based ride-sharing platform for university students. Drivers publish recurring trips, riders discover compatible rides by location and schedule, request seats, and review completed journeys.

## Team

- **Remas** — Ride Management (publish, edit, pause/resume, cancel rides; manage requests and passengers)
- **Ahmed** — Matching & Requests (discover rides, request seats, waitlist, notifications)
- **Youssef** — History & Reliability (trip history, two-way ratings, badges, attendance)

## Tech Stack

- **Frontend:** HTML, CSS, vanilla JavaScript → Cloudflare Pages
- **Backend:** Node.js + Express REST API (modular monolith) → AWS Lambda + API Gateway (via Floci)
- **Database:** Neon PostgreSQL with parameterized SQL and transactions
- **Auth:** bcrypt password hashing + JWT tokens
- **Geo:** OpenRouteService for geocoding (with coordinate fallback)

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL (or Neon account)
- OpenRouteService API key (optional)

### 1. Clone and install

```bash
git clone <repo-url>
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

The entire stack deploys locally using **Floci** (LocalStack), emulating S3, Lambda, API Gateway, RDS, Secrets Manager, and CloudWatch on `localhost:4566`.

### Prerequisites

- Docker Desktop (running)
- AWS CLI v2
- Node.js 20+

### Deploy everything

```powershell
.\infra\floci\deploy.ps1
```

This provisions RDS PostgreSQL, stores secrets, builds and deploys the Lambda, sets up API Gateway with CORS, hosts the frontend on S3, runs migrations and seed, and creates an EventBridge scheduler for expiry cleanup.

### Tear down everything

```powershell
.\infra\floci\destroy.ps1
```

See [infra/floci/README.md](infra/floci/README.md) for full details, URLs, and architecture diagram.

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
| PATCH | /api/trips/:id/complete | Complete trip | Driver |
| POST | /api/trips/:id/ratings | Rate | Participant |
| GET | /api/users/:id/reliability | Reliability | Auth |
| GET | /api/users/:id/badges | Badges | Auth |
| GET | /api/notifications | Notifications | Auth |
| PATCH | /api/notifications/:id/read | Mark read | Auth |
| PATCH | /api/notifications/read-all | Mark all read | Auth |

## Assumptions

1. **Email verification**: The register endpoint returns a verification token. In production, this would be sent via email. For demo/testing, seed data has `email_verified = true`. The `.edu` domain check accepts `.edu`, `.ac`, and `.edu.*` patterns.
2. **Trip instances**: When a ride template is created, 4 weeks of trip instances are auto-generated. In production, a cron job would generate new instances weekly.
3. **Waitlist offer window**: 30 minutes to accept a freed seat before it's offered to the next person.
4. **Stale request expiry**: Pending requests auto-expire after 48 hours (would need a cron job in production).
5. **Coordinates**: The search uses latitude/longitude directly. In production, the OpenRouteService geocoder converts addresses to coordinates.
6. **No real email sending**: Email verification flow exists in the API but no email provider is integrated.
7. **Cloudflare Turnstile**: Not implemented — marked as optional in the spec.
8. **docs/design/**: Directory preserved but was empty; frontend was designed from scratch following the specified structure.

## Project Structure

```
├── README.md
├── .gitignore
├── docs/design/
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js
│   ├── lambda.js
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
│       │   └── migrations/001_init.sql
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
│               └── validation.js
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
    │   ├── rate.html
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
                ├── rate.js
                ├── profile.js
                └── notifications.js
```
