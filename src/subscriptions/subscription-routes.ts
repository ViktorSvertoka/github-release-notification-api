import type { Express } from 'express';

import { AppError } from '../errors.js';
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

  app.get('/confirm/:token', async (req, res) => {
    try {
      await service.confirm(req.params.token);
      res.status(200).type('html').send(
        renderFlowPage({
          title: 'Subscription Confirmed',
          message:
            'Your subscription is active now. You will receive release alerts only when a new tag is published.',
          kind: 'success',
        })
      );
    } catch (error) {
      const message =
        error instanceof AppError ? error.message : 'Internal server error.';
      res.status(200).type('html').send(
        renderFlowPage({
          title: 'Confirmation Failed',
          message,
          kind: 'error',
        })
      );
    }
  });

  app.get('/unsubscribe/:token', async (req, res) => {
    try {
      await service.unsubscribe(req.params.token);
      res.status(200).type('html').send(
        renderFlowPage({
          title: 'Unsubscribed',
          message:
            'You have been unsubscribed successfully. You can re-subscribe at any time from the main page.',
          kind: 'success',
        })
      );
    } catch (error) {
      const message =
        error instanceof AppError ? error.message : 'Internal server error.';
      res.status(200).type('html').send(
        renderFlowPage({
          title: 'Unsubscribe Failed',
          message,
          kind: 'error',
        })
      );
    }
  });
}

function renderFlowPage(input: {
  title: string;
  message: string;
  kind: 'success' | 'error';
}): string {
  const accent = input.kind === 'success' ? '#0f766e' : '#b42318';
  const badge = input.kind === 'success' ? 'Success' : 'Action Required';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(input.title)} - Release Radar</title>
    <style>
      :root {
        --bg-0: #f7f8fb;
        --bg-1: #eef1f7;
        --card: #ffffff;
        --line: #dce3ef;
        --ink: #0f1728;
        --ink-soft: #4a556b;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Manrope, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(700px 320px at 10% -5%, #dbeafe 0%, transparent 68%),
          radial-gradient(640px 310px at 95% 0%, #e0e7ff 0%, transparent 70%),
          linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 100%);
        display: grid;
        place-items: center;
        padding: 24px;
      }
      .card {
        width: min(720px, 100%);
        border: 1px solid var(--line);
        border-radius: 22px;
        background: var(--card);
        padding: 28px;
        box-shadow: 0 24px 70px rgba(10, 19, 38, 0.1);
      }
      .badge {
        display: inline-block;
        padding: 6px 11px;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      h1 {
        margin: 14px 0 10px;
        font-size: clamp(30px, 5vw, 48px);
        line-height: 0.95;
        letter-spacing: -0.03em;
      }
      p {
        margin: 0;
        font-size: 18px;
        line-height: 1.45;
        color: var(--ink-soft);
      }
      .status {
        margin-top: 18px;
        color: ${accent};
        font-weight: 700;
      }
      .back {
        display: inline-block;
        margin-top: 22px;
        text-decoration: none;
        color: #f8fafc;
        background: linear-gradient(140deg, #0f172a 0%, #1f2937 100%);
        border-radius: 12px;
        padding: 10px 14px;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <span class="badge">${badge}</span>
      <h1>${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.message)}</p>
      <p class="status">Release Radar • GitHub Release Alerts</p>
      <a class="back" href="/">Back to home</a>
    </main>
  </body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
