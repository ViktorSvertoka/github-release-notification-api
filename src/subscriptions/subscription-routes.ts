import type { Express } from 'express';

import type { SubscriptionService } from './subscription-service.js';

export function registerSubscriptionRoutes(
  app: Express,
  service: SubscriptionService
): void {
  app.post('/api/subscribe', async (req, res, next) => {
    try {
      const payload = await service.subscribe({
        email: req.body?.email,
        repository: req.body?.repository,
      });
      res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/confirm/:token', async (req, res, next) => {
    try {
      const payload = await service.confirm(req.params.token);
      res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/unsubscribe/:token', async (req, res, next) => {
    try {
      const payload = await service.unsubscribe(req.params.token);
      res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/subscriptions', async (req, res, next) => {
    try {
      const email = req.query.email;
      const payload = await service.listByEmail(
        typeof email === 'string' ? email : ''
      );
      res.status(200).json(payload);
    } catch (error) {
      next(error);
    }
  });
}
