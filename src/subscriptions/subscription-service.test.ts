import { describe, expect, it } from 'vitest';

import {
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../errors.js';
import type { GitHubRepositoryClient } from '../github/github-repository-client.js';
import type { EmailNotifier } from '../notifier/email-notifier.js';
import { InMemorySubscriptionRepository } from './subscription-repository.js';
import { SubscriptionService } from './subscription-service.js';

class FakeGitHubClient implements GitHubRepositoryClient {
  constructor(
    private readonly mode: 'exists' | 'missing' | 'rate-limit' | 'error'
  ) {}

  public async repositoryExists(): Promise<boolean> {
    if (this.mode === 'missing') {
      return false;
    }

    if (this.mode === 'rate-limit') {
      throw new RateLimitError('GitHub API rate limit exceeded. Try again later.');
    }

    if (this.mode === 'error') {
      throw new Error('unexpected upstream error');
    }

    return true;
  }

  public async getLatestRelease(): Promise<{ tagName: string; htmlUrl: string } | null> {
    return null;
  }
}

class FakeEmailNotifier implements EmailNotifier {
  public confirmationCalls: Array<{
    to: string;
    repository: string;
    confirmUrl: string;
    unsubscribeUrl: string;
  }> = [];

  public async sendSubscriptionConfirmationEmail(input: {
    to: string;
    repository: string;
    confirmUrl: string;
    unsubscribeUrl: string;
  }): Promise<void> {
    this.confirmationCalls.push(input);
  }

  public async sendNewReleaseEmail(input: {
    to: string;
    repository: string;
    tagName: string;
    releaseUrl: string;
  }): Promise<void> {
    void input;
    // Not used in this suite.
  }
}

function setup(mode: 'exists' | 'missing' | 'rate-limit' | 'error') {
  const repository = new InMemorySubscriptionRepository();
  const gitHubClient = new FakeGitHubClient(mode);
  const emailNotifier = new FakeEmailNotifier();
  const service = new SubscriptionService(
    repository,
    gitHubClient,
    emailNotifier,
    'http://localhost:3000'
  );
  return { service, repository, emailNotifier };
}

describe('SubscriptionService', () => {
  it('subscribes with valid payload', async () => {
    const { service, emailNotifier } = setup('exists');

    const response = await service.subscribe({
      email: 'User@Example.com',
      repository: 'golang/go',
    });

    expect(response).toEqual({
      message: 'Confirmation email sent. Please check your inbox.',
    });
    expect(emailNotifier.confirmationCalls).toHaveLength(1);
    expect(emailNotifier.confirmationCalls[0]?.confirmUrl).toContain(
      '/api/confirm/'
    );
    expect(emailNotifier.confirmationCalls[0]?.unsubscribeUrl).toContain(
      '/api/unsubscribe/'
    );
  });

  it('throws 400 for invalid repository format', async () => {
    const { service } = setup('exists');

    await expect(
      service.subscribe({
        email: 'user@example.com',
        repository: 'invalid-format',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws 404 when repository does not exist', async () => {
    const { service } = setup('missing');

    await expect(
      service.subscribe({
        email: 'user@example.com',
        repository: 'missing/repo',
      })
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws 429 when GitHub rate limit is exceeded', async () => {
    const { service } = setup('rate-limit');

    await expect(
      service.subscribe({
        email: 'user@example.com',
        repository: 'golang/go',
      })
    ).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws generic error for unexpected GitHub client failure', async () => {
    const { service } = setup('error');

    await expect(
      service.subscribe({
        email: 'user@example.com',
        repository: 'golang/go',
      })
    ).rejects.toThrow('Failed to validate repository via GitHub API.');
  });

  it('confirms pending token', async () => {
    const { service, repository } = setup('exists');
    await repository.upsertPending({
      email: 'user@example.com',
      repository: 'golang/go',
      confirmToken: 'confirm-token',
      unsubscribeToken: 'unsubscribe-token',
    });

    const response = await service.confirm('confirm-token');

    expect(response).toEqual({ message: 'Subscription confirmed successfully.' });
    expect((await service.listByEmail('user@example.com')).subscriptions).toEqual([
      'golang/go',
    ]);
  });

  it('unsubscribes active subscription by token', async () => {
    const { service, repository } = setup('exists');
    const subscription = await repository.upsertPending({
      email: 'user@example.com',
      repository: 'golang/go',
      confirmToken: 'confirm-token',
      unsubscribeToken: 'unsubscribe-token',
    });
    subscription.status = 'active';
    await repository.save(subscription);

    const response = await service.unsubscribe('unsubscribe-token');

    expect(response).toEqual({ message: 'Unsubscribed successfully.' });
    expect((await service.listByEmail('user@example.com')).subscriptions).toEqual(
      []
    );
  });

  it('returns only active subscriptions for an email', async () => {
    const { service, repository } = setup('exists');

    const active = await repository.upsertPending({
      email: 'user@example.com',
      repository: 'golang/go',
      confirmToken: 'confirm-token',
      unsubscribeToken: 'unsubscribe-token',
    });
    active.status = 'active';
    await repository.save(active);

    await repository.upsertPending({
      email: 'user@example.com',
      repository: 'nodejs/node',
      confirmToken: 'confirm-token-2',
      unsubscribeToken: 'unsubscribe-token-2',
    });

    await expect(service.listByEmail('user@example.com')).resolves.toEqual({
      email: 'user@example.com',
      subscriptions: ['golang/go'],
    });
  });

  it('throws 400 for invalid email in list operation', async () => {
    const { service } = setup('exists');
    await expect(service.listByEmail('bad')).rejects.toThrow(ValidationError);
  });

  it('reuses existing subscription row and still returns success', async () => {
    const { service } = setup('exists');

    const first = await service.subscribe({
      email: 'user@example.com',
      repository: 'golang/go',
    });
    const second = await service.subscribe({
      email: 'user@example.com',
      repository: 'golang/go',
    });

    expect(first.message).toBe('Confirmation email sent. Please check your inbox.');
    expect(second.message).toBe('Confirmation email sent. Please check your inbox.');
  });
});
