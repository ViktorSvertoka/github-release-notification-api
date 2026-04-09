import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { pinoHttp } from 'pino-http';

import { createApiKeyAuthMiddleware } from './middleware/api-key-auth.js';
import { AppError } from './errors.js';
import { getMetricsContentType, getMetricsSnapshot, recordHttpRequest } from './metrics/metrics.js';
import { registerSubscriptionRoutes } from './subscriptions/subscription-routes.js';
import type { SubscriptionService } from './subscriptions/subscription-service.js';

interface CreateAppDependencies {
  subscriptionService: SubscriptionService;
  apiKey?: string;
}

export function createApp(dependencies: CreateAppDependencies) {
  const app = express();
  const publicDir = path.resolve(process.cwd(), 'public');

  app.use(
    pinoHttp({
      redact: ['req.headers.authorization', 'req.headers.x-api-key'],
    })
  );
  app.use(express.json());

  app.use((req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const elapsedNs = Number(process.hrtime.bigint() - startedAt);
      const durationSeconds = elapsedNs / 1_000_000_000;
      const route = normalizeRoute(req.baseUrl + req.path);
      recordHttpRequest({
        method: req.method,
        route,
        statusCode: res.statusCode,
        durationSeconds,
      });
    });
    next();
  });
  app.use(express.static(publicDir));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/metrics', async (_req, res) => {
    const snapshot = await getMetricsSnapshot();
    res.setHeader('Content-Type', getMetricsContentType());
    res.send(snapshot);
  });

  app.use('/api', createApiKeyAuthMiddleware(dependencies.apiKey));

  registerSubscriptionRoutes(app, dependencies.subscriptionService);

  const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
    void next;
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }

    res.status(500).json({ message: 'Internal server error.' });
  };

  app.use(errorHandler);

  return app;
}

function normalizeRoute(pathname: string): string {
  const fixedRoutes = new Set([
    '/',
    '/health',
    '/metrics',
    '/confirm',
    '/unsubscribe',
    '/api/subscribe',
    '/api/subscriptions',
  ]);

  if (fixedRoutes.has(pathname)) {
    return pathname;
  }

  if (/^\/api\/confirm\/[^/]+$/.test(pathname)) {
    return '/api/confirm/:token';
  }

  if (/^\/api\/unsubscribe\/[^/]+$/.test(pathname)) {
    return '/api/unsubscribe/:token';
  }

  if (/^\/confirm\/[^/]+$/.test(pathname)) {
    return '/confirm/:token';
  }

  if (/^\/unsubscribe\/[^/]+$/.test(pathname)) {
    return '/unsubscribe/:token';
  }

  return 'unmatched';
}
