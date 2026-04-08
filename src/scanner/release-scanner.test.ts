import { describe, expect, it } from 'vitest';

import type { GitHubRepositoryClient } from '../github/github-repository-client.js';
import type { EmailNotifier } from '../notifier/email-notifier.js';
import type {
  Subscription,
  SubscriptionRepository,
  TrackedRepository,
} from '../subscriptions/subscription-repository.js';
import { ReleaseScanner, type LoggerLike } from './release-scanner.js';

class FakeRepository implements SubscriptionRepository {
  public tracked: TrackedRepository[] = [];
  public readonly updatedTags: Array<{ repository: string; tag: string }> = [];

  public async upsertPending(data: {
    email: string;
    repository: string;
    confirmToken: string;
    unsubscribeToken: string;
  }): Promise<Subscription> {
    void data;
    throw new Error('not needed for this test');
  }

  public async findByConfirmToken(token: string): Promise<Subscription | null> {
    void token;
    throw new Error('not needed for this test');
  }

  public async findByUnsubscribeToken(
    token: string
  ): Promise<Subscription | null> {
    void token;
    throw new Error('not needed for this test');
  }

  public async save(subscription: Subscription): Promise<void> {
    void subscription;
    throw new Error('not needed for this test');
  }

  public async listActiveByEmail(email: string): Promise<string[]> {
    void email;
    throw new Error('not needed for this test');
  }

  public async listTrackedRepositories(): Promise<TrackedRepository[]> {
    return this.tracked;
  }

  public async updateLastSeenTag(repository: string, tag: string): Promise<void> {
    this.updatedTags.push({ repository, tag });
  }
}

class FakeGitHubClient implements GitHubRepositoryClient {
  constructor(
    private readonly releaseByRepo: Record<
      string,
      { tagName: string; htmlUrl: string } | null
    >
  ) {}

  public async repositoryExists(repository: string): Promise<boolean> {
    void repository;
    return true;
  }

  public async getLatestRelease(
    repository: string
  ): Promise<{ tagName: string; htmlUrl: string } | null> {
    return this.releaseByRepo[repository] ?? null;
  }
}

class FakeNotifier implements EmailNotifier {
  public readonly sent: Array<{
    to: string;
    repository: string;
    tagName: string;
    releaseUrl: string;
  }> = [];

  public async sendNewReleaseEmail(input: {
    to: string;
    repository: string;
    tagName: string;
    releaseUrl: string;
  }): Promise<void> {
    this.sent.push(input);
  }
}

class FakeLogger implements LoggerLike {
  public info(meta: object, message: string): void {
    void meta;
    void message;
  }
  public warn(meta: object, message: string): void {
    void meta;
    void message;
  }
  public error(meta: object, message: string): void {
    void meta;
    void message;
  }
}

describe('ReleaseScanner', () => {
  it('initializes last_seen_tag without sending emails', async () => {
    const repository = new FakeRepository();
    repository.tracked = [
      {
        repository: 'golang/go',
        lastSeenTag: null,
        subscriberEmails: ['a@example.com', 'b@example.com'],
      },
    ];
    const gitHub = new FakeGitHubClient({
      'golang/go': { tagName: 'v1.0.0', htmlUrl: 'https://example.com/r/1' },
    });
    const notifier = new FakeNotifier();
    const scanner = new ReleaseScanner(
      repository,
      gitHub,
      notifier,
      new FakeLogger()
    );

    await scanner.runOnce();

    expect(repository.updatedTags).toEqual([
      { repository: 'golang/go', tag: 'v1.0.0' },
    ]);
    expect(notifier.sent).toEqual([]);
  });

  it('sends email when new release tag appears', async () => {
    const repository = new FakeRepository();
    repository.tracked = [
      {
        repository: 'golang/go',
        lastSeenTag: 'v1.0.0',
        subscriberEmails: ['a@example.com', 'b@example.com'],
      },
    ];
    const gitHub = new FakeGitHubClient({
      'golang/go': { tagName: 'v1.1.0', htmlUrl: 'https://example.com/r/2' },
    });
    const notifier = new FakeNotifier();
    const scanner = new ReleaseScanner(
      repository,
      gitHub,
      notifier,
      new FakeLogger()
    );

    await scanner.runOnce();

    expect(repository.updatedTags).toEqual([
      { repository: 'golang/go', tag: 'v1.1.0' },
    ]);
    expect(notifier.sent).toHaveLength(2);
    expect(notifier.sent[0]?.tagName).toBe('v1.1.0');
  });

  it('does nothing when release tag is unchanged', async () => {
    const repository = new FakeRepository();
    repository.tracked = [
      {
        repository: 'golang/go',
        lastSeenTag: 'v1.0.0',
        subscriberEmails: ['a@example.com'],
      },
    ];
    const gitHub = new FakeGitHubClient({
      'golang/go': { tagName: 'v1.0.0', htmlUrl: 'https://example.com/r/1' },
    });
    const notifier = new FakeNotifier();
    const scanner = new ReleaseScanner(
      repository,
      gitHub,
      notifier,
      new FakeLogger()
    );

    await scanner.runOnce();

    expect(repository.updatedTags).toEqual([]);
    expect(notifier.sent).toEqual([]);
  });
});
