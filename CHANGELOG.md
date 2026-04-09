# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.2] - 2026-04-09

### Added

- README visual showcase with screenshots for implemented features:
  - home page
  - confirmation email
  - confirm/unsubscribe browser flow
  - Render deployment
  - Neon database
  - Upstash Redis cache
  - Prometheus metrics
  - GitHub Actions CI

### Changed

- New release notification emails now use branded HTML template with:
  - repository and tag highlights
  - `View release` CTA button
  - fallback direct URL link

## [1.0.1] - 2026-04-09

### Added

- Repository governance and trust files:
  - `CODE_OF_CONDUCT.md`
  - `SECURITY.md`
  - `LICENSE.txt`
- Extended README "Main Features" section with visual walkthrough placeholders
  for:
  - home page
  - confirmation email
  - confirm/unsubscribe browser flow
  - Render deployment
  - Neon database
  - Upstash Redis cache
  - Prometheus metrics
  - GitHub Actions CI

### Changed

- Clarified README deployment/testing flow to use browser UX routes:
  - `GET /confirm/{token}`
  - `GET /unsubscribe/{token}`
- Added explicit "REST contract vs UX routes" section to avoid ambiguity:
  - `/api/*` routes remain OpenAPI contract endpoints
  - `/confirm/*` and `/unsubscribe/*` are browser UX wrappers
- Documented API key behavior with UX route visibility note.

## [1.0.0] - 2026-04-09

### Added

- Initial backend setup with `Node.js + TypeScript + Express`
- Healthcheck endpoint: `GET /health`
- OpenAPI contract (`swagger.yaml`) for:
  - `POST /api/subscribe`
  - `GET /api/confirm/{token}`
  - `GET /api/unsubscribe/{token}`
  - `GET /api/subscriptions?email={email}`
- CI pipeline (GitHub Actions) with lint and unit tests on push/PR
- PostgreSQL persistence with Drizzle ORM
- Startup DB migrations
- Dockerized stack:
  - multi-stage `Dockerfile`
  - `docker-compose.yml` (API + PostgreSQL + Redis)
- Redis cache for GitHub API calls with TTL (default 600s)
- Monolith release scanner with scheduler (`SCAN_INTERVAL_SECONDS`)
- SMTP notifier + Noop fallback
- Responsive subscription page at `GET /`
- Optional API key authentication for `/api/*`
- Prometheus metrics endpoint `GET /metrics` with:
  - HTTP requests count/duration
  - scanner runs
  - email notification outcomes
  - GitHub rate-limit errors
- Optional gRPC interface:
  - `Subscribe`
  - `Confirm`
  - `Unsubscribe`
  - `ListSubscriptions`
- UX wrapper routes for browser flow:
  - `GET /confirm/:token`
  - `GET /unsubscribe/:token`
- HTML confirmation email template with CTA actions

### Changed

- Subscription flow moved from in-memory storage to DB-backed repository
- Scanner/notifier flow hardened for idempotent deliveries and retry-safe
  behavior
- Confirmation email links now target UX routes (`/confirm/*`, `/unsubscribe/*`)
  while keeping `/api/*` contract endpoints unchanged
- Route normalization improved for metrics cardinality safety
- Server bind updated to `0.0.0.0` for Render compatibility

### Fixed

- Graceful scanner shutdown and non-overlapping run handling
- Cache malformed payload handling as cache miss
- Correct HTTP status propagation for UX confirm/unsubscribe pages
- SMTP send behavior stabilized with transport-level timeout configuration
- Deploy startup reliability issues (port binding for Render)
