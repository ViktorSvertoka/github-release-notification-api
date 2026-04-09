import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { pinoHttp } from 'pino-http';

import { createApiKeyAuthMiddleware } from './middleware/api-key-auth.js';
import { AppError } from './errors.js';
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
  app.use(express.static(publicDir));

  app.get('/', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
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
