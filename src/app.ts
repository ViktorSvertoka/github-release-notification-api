import express from 'express';
import { pinoHttp } from 'pino-http';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(
    pinoHttp({
      redact: ['req.headers.authorization', 'req.headers.x-api-key'],
    })
  );

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  return app;
}
