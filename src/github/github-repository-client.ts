import { RateLimitError } from '../errors.js';
import type { GitHubCache } from '../cache/github-cache.js';

export interface GitHubRepositoryClient {
  repositoryExists(repository: string): Promise<boolean>;
}

export class HttpGitHubRepositoryClient implements GitHubRepositoryClient {
  private readonly token?: string;
  private readonly cache?: GitHubCache;

  constructor(token?: string, cache?: GitHubCache) {
    this.token = token;
    this.cache = cache;
  }

  public async repositoryExists(repository: string): Promise<boolean> {
    if (this.cache) {
      try {
        const cached = await this.cache.getRepositoryExists(repository);
        if (cached !== null) {
          return cached;
        }
      } catch {
        // Cache is optional. Continue with direct GitHub call.
      }
    }

    const url = `https://api.github.com/repos/${repository}`;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'github-release-notification-api',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { headers });
    if (response.status === 200) {
      if (this.cache) {
        try {
          await this.cache.setRepositoryExists(repository, true);
        } catch {
          // Cache is optional. Ignore write failures.
        }
      }
      return true;
    }

    if (response.status === 404) {
      if (this.cache) {
        try {
          await this.cache.setRepositoryExists(repository, false);
        } catch {
          // Cache is optional. Ignore write failures.
        }
      }
      return false;
    }

    if (response.status === 429) {
      throw new RateLimitError(
        'GitHub API rate limit exceeded. Try again later.'
      );
    }

    if (
      response.status === 403 &&
      response.headers.get('x-ratelimit-remaining') === '0'
    ) {
      throw new RateLimitError(
        'GitHub API rate limit exceeded. Try again later.'
      );
    }

    throw new Error(`GitHub API error: status ${response.status}`);
  }
}
