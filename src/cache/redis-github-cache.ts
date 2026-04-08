import { Redis } from 'ioredis';

import type { GitHubCache } from './github-cache.js';

export class RedisGitHubCache implements GitHubCache {
  private readonly redis: Redis;
  private readonly ttlSeconds: number;

  constructor(redisUrl: string, ttlSeconds: number) {
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    this.ttlSeconds = ttlSeconds;
  }

  public async getRepositoryExists(
    repository: string
  ): Promise<boolean | null> {
    const value = await this.redis.get(this.key(repository));
    if (value === null) {
      return null;
    }

    return value === '1';
  }

  public async setRepositoryExists(
    repository: string,
    exists: boolean
  ): Promise<void> {
    await this.redis.set(
      this.key(repository),
      exists ? '1' : '0',
      'EX',
      this.ttlSeconds
    );
  }

  private key(repository: string): string {
    return `gh:repo-exists:${repository.toLowerCase()}`;
  }
}
