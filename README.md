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

## Scripts

- `npm run dev` - run API in watch mode
- `npm run build` - compile TypeScript to `dist/`
- `npm run start` - run compiled app
- `npm run lint` - run ESLint
- `npm run test` - run unit tests

## Quick start

```bash
npm install
npm run dev
```

## API contract

OpenAPI contract is available in [swagger.yaml](./swagger.yaml).

Healthcheck endpoint:

`GET /health`
