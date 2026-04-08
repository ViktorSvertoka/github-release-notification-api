import pino from 'pino';

import { createApp } from './app.js';
import { RedisGitHubCache } from './cache/redis-github-cache.js';
import { loadRuntimeEnv } from './config.js';
import { createDbClient } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { HttpGitHubRepositoryClient } from './github/github-repository-client.js';
import {
  NoopEmailNotifier,
  SmtpEmailNotifier,
} from './notifier/email-notifier.js';
import { ReleaseScanner } from './scanner/release-scanner.js';
import { startScannerScheduler } from './scanner/scanner-scheduler.js';
import { PostgresSubscriptionRepository } from './subscriptions/subscription-repository.js';
import { SubscriptionService } from './subscriptions/subscription-service.js';

async function bootstrap(): Promise<void> {
  const env = loadRuntimeEnv();
  const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  });

  const { db, pool } = createDbClient(env);
  await runMigrations(db);

  const subscriptionRepository = new PostgresSubscriptionRepository(db);
  const gitHubCache = env.REDIS_URL
    ? new RedisGitHubCache(env.REDIS_URL, env.CACHE_TTL_SECONDS)
    : undefined;
  const gitHubClient = new HttpGitHubRepositoryClient(
    env.GITHUB_TOKEN,
    gitHubCache
  );
  const subscriptionService = new SubscriptionService(
    subscriptionRepository,
    gitHubClient
  );
  const emailNotifier =
    env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM
      ? new SmtpEmailNotifier(env)
      : new NoopEmailNotifier();
  const releaseScanner = new ReleaseScanner(
    subscriptionRepository,
    gitHubClient,
    emailNotifier,
    logger
  );
  const scannerScheduler = startScannerScheduler({
    scanner: releaseScanner,
    intervalSeconds: env.SCAN_INTERVAL_SECONDS,
    onError: error => {
      logger.error({ error }, 'Release scanner iteration failed');
    },
  });

  const app = createApp({ subscriptionService });
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, scanIntervalSeconds: env.SCAN_INTERVAL_SECONDS },
      'Server started'
    );
  });

  let isShuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown started');
    await scannerScheduler.stop();

    await new Promise<void>((resolve, reject) => {
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await pool.end();
    logger.info('Graceful shutdown completed');
    process.exit(0);
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT').catch(error => {
      logger.error({ error }, 'Graceful shutdown failed');
      process.exit(1);
    });
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch(error => {
      logger.error({ error }, 'Graceful shutdown failed');
      process.exit(1);
    });
  });
}

bootstrap().catch(error => {
  console.error(error);
  process.exit(1);
});
