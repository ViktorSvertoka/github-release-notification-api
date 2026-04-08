import pino from 'pino';

import { createApp } from './app.js';
import { RedisGitHubCache } from './cache/redis-github-cache.js';
import { loadRuntimeEnv } from './config.js';
import { createDbClient } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { HttpGitHubRepositoryClient } from './github/github-repository-client.js';
import { PostgresSubscriptionRepository } from './subscriptions/subscription-repository.js';
import { SubscriptionService } from './subscriptions/subscription-service.js';

async function bootstrap(): Promise<void> {
  const env = loadRuntimeEnv();

  const { db } = createDbClient(env);
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

  const logger = pino({
    level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  });

  const app = createApp({ subscriptionService });
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Server started');
  });
}

bootstrap().catch(error => {
  console.error(error);
  process.exit(1);
});
