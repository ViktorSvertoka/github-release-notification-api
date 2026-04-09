import { RateLimitError } from '../errors.js';
import type {
  GitHubRelease,
  GitHubRepositoryClient,
} from '../github/github-repository-client.js';
import { recordScannerRun } from '../metrics/metrics.js';
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
    let outcome: 'success' | 'partial_failure' | 'rate_limited' = 'success';
    try {
      const tracked = await this.subscriptionRepository.listTrackedRepositories();
      let hasFailures = false;

      for (const item of tracked) {
        try {
          const release = await this.gitHubClient.getLatestRelease(item.repository);
          const hadDeliveryFailure = await this.handleRepositoryRelease(
            item,
            release
          );
          if (hadDeliveryFailure) {
            hasFailures = true;
          }
        } catch (error) {
          if (error instanceof RateLimitError) {
            this.logger.warn(
              { repository: item.repository, error: error.message },
              'Release scan skipped due to GitHub rate limit'
            );
            outcome = 'rate_limited';
            return;
          }

          hasFailures = true;
          this.logger.error(
            { repository: item.repository, error },
            'Release scan failed for repository'
          );
        }
      }

      if (hasFailures) {
        outcome = 'partial_failure';
      }
    } catch (error) {
      outcome = 'partial_failure';
      throw error;
    } finally {
      recordScannerRun(outcome);
    }
  }

  private async handleRepositoryRelease(
    item: {
      repository: string;
      lastSeenTag: string | null;
      subscriberEmails: string[];
    },
    release: GitHubRelease | null
  ): Promise<boolean> {
    if (!release) {
      return false;
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
      return false;
    }

    if (item.lastSeenTag === release.tagName) {
      return false;
    }

    const deliveredEmails = new Set(
      await this.subscriptionRepository.listDeliveredEmailsForTag(
        item.repository,
        release.tagName
      )
    );

    const pendingRecipients = item.subscriberEmails.filter(
      email => !deliveredEmails.has(email)
    );

    for (const email of pendingRecipients) {
      try {
        await this.emailNotifier.sendNewReleaseEmail({
          to: email,
          repository: item.repository,
          tagName: release.tagName,
          releaseUrl: release.htmlUrl,
        });
        await this.subscriptionRepository.markNotificationDelivered({
          repository: item.repository,
          tag: release.tagName,
          email,
        });
      } catch (error) {
        this.logger.error(
          { repository: item.repository, tag: release.tagName, email, error },
          'Failed to send release notification'
        );
      }
    }

    const deliveredAfter = new Set(
      await this.subscriptionRepository.listDeliveredEmailsForTag(
        item.repository,
        release.tagName
      )
    );
    const allDelivered = item.subscriberEmails.every(email =>
      deliveredAfter.has(email)
    );
    if (!allDelivered) {
      this.logger.warn(
        {
          repository: item.repository,
          tag: release.tagName,
          delivered: deliveredAfter.size,
          total: item.subscriberEmails.length,
        },
        'Release notifications partially delivered; will retry next scan'
      );
      return true;
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
    return false;
  }
}
