import { RateLimitError } from '../errors.js';
import type {
  GitHubRelease,
  GitHubRepositoryClient,
} from '../github/github-repository-client.js';
import type { EmailNotifier } from '../notifier/email-notifier.js';
import type { SubscriptionRepository } from '../subscriptions/subscription-repository.js';

export interface LoggerLike {
  info(meta: object, message: string): void;
  warn(meta: object, message: string): void;
  error(meta: object, message: string): void;
}

export class ReleaseScanner {
  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly gitHubClient: GitHubRepositoryClient,
    private readonly emailNotifier: EmailNotifier,
    private readonly logger: LoggerLike
  ) {}

  public async runOnce(): Promise<void> {
    const tracked = await this.subscriptionRepository.listTrackedRepositories();
    for (const item of tracked) {
      try {
        const release = await this.gitHubClient.getLatestRelease(item.repository);
        await this.handleRepositoryRelease(item, release);
      } catch (error) {
        if (error instanceof RateLimitError) {
          this.logger.warn(
            { repository: item.repository, error: error.message },
            'Release scan skipped due to GitHub rate limit'
          );
          continue;
        }

        this.logger.error(
          { repository: item.repository, error },
          'Release scan failed for repository'
        );
      }
    }
  }

  private async handleRepositoryRelease(
    item: {
      repository: string;
      lastSeenTag: string | null;
      subscriberEmails: string[];
    },
    release: GitHubRelease | null
  ): Promise<void> {
    if (!release) {
      return;
    }

    if (item.lastSeenTag === null) {
      await this.subscriptionRepository.updateLastSeenTag(
        item.repository,
        release.tagName
      );
      this.logger.info(
        { repository: item.repository, tag: release.tagName },
        'Initialized last seen tag'
      );
      return;
    }

    if (item.lastSeenTag === release.tagName) {
      return;
    }

    for (const email of item.subscriberEmails) {
      await this.emailNotifier.sendNewReleaseEmail({
        to: email,
        repository: item.repository,
        tagName: release.tagName,
        releaseUrl: release.htmlUrl,
      });
    }

    await this.subscriptionRepository.updateLastSeenTag(
      item.repository,
      release.tagName
    );
    this.logger.info(
      {
        repository: item.repository,
        tag: release.tagName,
        recipients: item.subscriberEmails.length,
      },
      'Sent release notifications'
    );
  }
}
