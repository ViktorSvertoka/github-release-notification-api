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
- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

## Production deployment target

This project is prepared for:

- API container on Render
- PostgreSQL on Neon
- Redis on Upstash

`render.yaml` is included as a base Render blueprint.

## Environment variables

See [.env.example](./.env.example) for the full list.

Core variables:

- `NODE_ENV`
- `PORT`
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

## API contract

OpenAPI contract is available in [swagger.yaml](./swagger.yaml).

## Subscription page

- `GET /` serves a responsive HTML subscription page
- the page submits to `POST /api/subscribe`

Healthcheck endpoint:

`GET /health`
