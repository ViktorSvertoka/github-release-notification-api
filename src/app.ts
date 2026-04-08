import express, { type ErrorRequestHandler } from 'express';
import { pinoHttp } from 'pino-http';

import { AppError } from './errors.js';
import { registerSubscriptionRoutes } from './subscriptions/subscription-routes.js';
import type { SubscriptionService } from './subscriptions/subscription-service.js';

interface CreateAppDependencies {
  subscriptionService: SubscriptionService;
}

export function createApp(dependencies: CreateAppDependencies) {
  const app = express();

  app.use(
    pinoHttp({
      redact: ['req.headers.authorization', 'req.headers.x-api-key'],
    })
  );
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

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
