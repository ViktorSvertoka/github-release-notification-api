# GitHub Release Notification API

Monolith service on `Node.js + TypeScript` for GitHub release email
subscriptions.

## Tech stack

- Node.js
- Express
- TypeScript
- ESLint + Prettier
- Vitest
- Pino logger
- Docker + Docker Compose
- PostgreSQL (local in Docker, Neon for production)
- Redis (local in Docker, Upstash for production)

## Scripts

- `npm run dev` - run API in watch mode
- `npm run build` - compile TypeScript to `dist/`
- `npm run start` - run compiled app
- `npm run lint` - run ESLint
- `npm run lint:fix` - run ESLint with auto-fixes
- `npm run format` - run Prettier
- `npm run test` - run unit tests
- `npm run db:generate` - generate Drizzle migrations
- `npm run db:migrate` - apply migrations

## Local run (without Docker)

```bash
cp .env.example .env
npm install
npm run dev
```

## Local run (Docker)

```bash
docker compose up --build
```

This starts:

- API on `http://localhost:3000`
- gRPC on `localhost:50051`
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

## Production deployment target

This project is prepared for:

- API container on Render
- PostgreSQL on Neon
- Redis on Upstash

`render.yaml` is included as a base Render blueprint.

## Deploy End-to-End (Render + Neon + Upstash)

### 1. Prepare managed services

- Create Neon project and database, copy connection string.
- Create Upstash Redis database, copy TCP connection string.
  - Use TCP URI format for this app: `rediss://default:<token>@<host>:6379`
- Prepare SMTP credentials (for example Mailtrap/SendGrid/Resend SMTP) to test
  confirmation/release emails in production.

### 2. Create Render Web Service

- Push repository to GitHub.
- In Render: `New` -> `Blueprint` -> select this repository.
- Render will read [render.yaml](./render.yaml) and create one Docker web service.

### 3. Set production environment variables in Render

Required:

- `NODE_ENV=production`
- `APP_BASE_URL=https://<your-render-service>.onrender.com`
- `DATABASE_URL=<Neon connection string with sslmode=require>`
- `REDIS_URL=<Upstash TCP rediss URL>`
- `SMTP_HOST=<smtp host>`
- `SMTP_PORT=587`
- `SMTP_USER=<smtp user>`
- `SMTP_PASS=<smtp password>`
- `SMTP_FROM=<verified sender>`

Recommended:

- `GITHUB_TOKEN=<github token>` (higher rate limit)
- `SCAN_INTERVAL_SECONDS=300`
- `CACHE_TTL_SECONDS=600`
- `API_KEY=<token>` (if you want protected `/api/*` endpoints)

### 4. Verify deployment

- Open `https://<your-render-service>.onrender.com/health` -> expect
  `{"status":"ok"}`.
- Open `https://<your-render-service>.onrender.com/metrics` -> expect Prometheus
  metrics output.

### 5. Verify real flow in production

1. Submit subscription from HTML page `GET /` or API:

```bash
curl -X POST "https://<your-render-service>.onrender.com/api/subscribe" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","repository":"golang/go"}'
```

2. Open confirmation email from your SMTP inbox and click:
   `GET /api/confirm/{token}`.
3. Wait for scanner interval (or temporarily set `SCAN_INTERVAL_SECONDS=60` in
   Render for faster test).
4. Publish/check a repository with a new release tag and verify release email
   is delivered.
5. Click `GET /api/unsubscribe/{token}` and confirm notifications stop.

## Environment variables

See [.env.example](./.env.example) for the full list.

Core variables:

- `NODE_ENV`
- `PORT`
- `GRPC_PORT`
- `APP_BASE_URL`
- `GITHUB_TOKEN`
- `DATABASE_URL`
- `REDIS_URL`
- `CACHE_TTL_SECONDS`
- `SCAN_INTERVAL_SECONDS`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `API_KEY`

## Database and migrations

- PostgreSQL schema is defined in `src/db/schema.ts`
- SQL migrations are stored in `drizzle/`
- Migrations are executed automatically on service startup

## Redis cache

- GitHub repository existence checks are cached in Redis
- Default TTL is `600` seconds (`CACHE_TTL_SECONDS`)
- Cache key format: `gh:repo-exists:{owner}/{repo}`

## Scanner and notifier

- Release scanner runs every `SCAN_INTERVAL_SECONDS` (default `300`)
- Scanner checks latest release for tracked repositories with active subscriptions
- New tag detection logic:
  - if `last_seen_tag` is empty, scanner initializes it and does not send email
  - if latest tag differs from `last_seen_tag`, scanner sends email to active subscribers and updates `last_seen_tag`
- SMTP notifier is enabled only when all required SMTP variables are provided
- `POST /api/subscribe` sends a confirmation email with links to:
  - `GET /api/confirm/{token}`
  - `GET /api/unsubscribe/{token}`

## API key auth (optional)

- Set `API_KEY` to enable API key protection for `/api/*`
- Send token via `x-api-key` request header
- Public exceptions (no API key required):
  - `GET /api/confirm/{token}`
  - `GET /api/unsubscribe/{token}`

## Prometheus metrics

- `GET /metrics` exposes Prometheus metrics
- Includes:
  - HTTP requests count (`app_http_requests_total`)
  - HTTP request duration (`app_http_request_duration_seconds`)
  - Scanner runs (`app_scanner_runs_total`)
  - Email notifications (`app_email_notifications_total`)
  - GitHub rate-limit errors (`app_github_rate_limit_errors_total`)

## API contract

OpenAPI contract is available in [swagger.yaml](./swagger.yaml).

## gRPC interface (optional extra)

- Proto file: [proto/release_notification.proto](./proto/release_notification.proto)
- gRPC server runs in the same monolith process as REST API.
- Default port: `50051` (`GRPC_PORT` env var).
- Implemented RPC methods:
  - `Subscribe`
  - `Confirm`
  - `Unsubscribe`
  - `ListSubscriptions`

Quick local check with `grpcurl`:

```bash
grpcurl -plaintext \
  -d '{"email":"you@example.com","repository":"golang/go"}' \
  localhost:50051 release_notification.v1.SubscriptionService/Subscribe
```

## Subscription page

- `GET /` serves a responsive HTML subscription page
- the page submits to `POST /api/subscribe`

Healthcheck endpoint:

`GET /health`
