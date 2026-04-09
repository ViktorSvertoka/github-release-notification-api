import type { NextFunction, Request, Response } from 'express';

export function createApiKeyAuthMiddleware(apiKey?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!apiKey) {
      next();
      return;
    }

    const isPublicTokenRoute =
      req.method === 'GET' &&
      (/^\/confirm\/[^/]+$/.test(req.path) ||
        /^\/unsubscribe\/[^/]+$/.test(req.path));

    if (isPublicTokenRoute) {
      next();
      return;
    }

    const headerApiKey = req.header('x-api-key');
    if (headerApiKey !== apiKey) {
      res.status(401).json({ message: 'Unauthorized. Invalid API key.' });
      return;
    }

    next();
  };
}
