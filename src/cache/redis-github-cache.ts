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

  public async getLatestRelease(
    repository: string
  ): Promise<{ tagName: string; htmlUrl: string } | null | undefined> {
    const value = await this.redis.get(this.latestReleaseKey(repository));
    if (value === null) {
      return undefined;
    }

    if (value === 'none') {
      return null;
    }

    try {
      const parsed = JSON.parse(value) as { tagName: string; htmlUrl: string };
      return parsed;
    } catch {
      return null;
    }
  }

  public async setLatestRelease(
    repository: string,
    release: { tagName: string; htmlUrl: string } | null
  ): Promise<void> {
    if (!release) {
      await this.redis.set(
        this.latestReleaseKey(repository),
        'none',
        'EX',
        this.ttlSeconds
      );
      return;
    }

    await this.redis.set(
      this.latestReleaseKey(repository),
      JSON.stringify(release),
      'EX',
      this.ttlSeconds
    );
  }

  private key(repository: string): string {
    return `gh:repo-exists:${repository.toLowerCase()}`;
  }

  private latestReleaseKey(repository: string): string {
    return `gh:latest-release:${repository.toLowerCase()}`;
  }
}
