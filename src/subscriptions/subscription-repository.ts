import { and, eq } from 'drizzle-orm';
import type { AppDatabase } from '../db/client.js';
import {
  notificationDeliveriesTable,
  repositoriesTable,
  subscriptionsTable,
  type subscriptionStatusEnum,
} from '../db/schema.js';

export type SubscriptionStatus = (typeof subscriptionStatusEnum.enumValues)[number];

export interface Subscription {
  email: string;
  repository: string;
  status: SubscriptionStatus;
  confirmToken: string;
  unsubscribeToken: string;
}

export interface TrackedRepository {
  repository: string;
  lastSeenTag: string | null;
  subscriberEmails: string[];
}

export interface SubscriptionRepository {
  upsertPending(data: {
    email: string;
    repository: string;
    confirmToken: string;
    unsubscribeToken: string;
  }): Promise<Subscription>;
  findByConfirmToken(token: string): Promise<Subscription | null>;
  findByUnsubscribeToken(token: string): Promise<Subscription | null>;
  save(subscription: Subscription): Promise<void>;
  listActiveByEmail(email: string): Promise<string[]>;
  listTrackedRepositories(): Promise<TrackedRepository[]>;
  updateLastSeenTag(repository: string, tag: string): Promise<void>;
  listDeliveredEmailsForTag(repository: string, tag: string): Promise<string[]>;
  markNotificationDelivered(input: {
    repository: string;
    tag: string;
    email: string;
  }): Promise<void>;
}

export class PostgresSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: AppDatabase) {}

  public async upsertPending(data: {
    email: string;
    repository: string;
    confirmToken: string;
    unsubscribeToken: string;
  }): Promise<Subscription> {
    return this.db.transaction(async tx => {
      const [repository] = await tx
        .insert(repositoriesTable)
        .values({
          fullName: data.repository,
        })
        .onConflictDoUpdate({
          target: repositoriesTable.fullName,
          set: {
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!repository) {
        throw new Error('Failed to upsert repository.');
      }

      const [subscription] = await tx
        .insert(subscriptionsTable)
        .values({
          email: data.email,
          repositoryId: repository.id,
          status: 'pending',
          confirmToken: data.confirmToken,
          unsubscribeToken: data.unsubscribeToken,
        })
        .onConflictDoUpdate({
          target: [subscriptionsTable.email, subscriptionsTable.repositoryId],
          set: {
            status: 'pending',
            confirmToken: data.confirmToken,
            unsubscribeToken: data.unsubscribeToken,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!subscription) {
        throw new Error('Failed to upsert subscription.');
      }

      return this.mapToDomain({
        email: subscription.email,
        repository: data.repository,
        status: subscription.status,
        confirmToken: subscription.confirmToken,
        unsubscribeToken: subscription.unsubscribeToken,
      });
    });
  }

  public async findByConfirmToken(token: string): Promise<Subscription | null> {
    const [row] = await this.db
      .select({
        email: subscriptionsTable.email,
        repository: repositoriesTable.fullName,
        status: subscriptionsTable.status,
        confirmToken: subscriptionsTable.confirmToken,
        unsubscribeToken: subscriptionsTable.unsubscribeToken,
      })
      .from(subscriptionsTable)
      .innerJoin(
        repositoriesTable,
        eq(subscriptionsTable.repositoryId, repositoriesTable.id)
      )
      .where(eq(subscriptionsTable.confirmToken, token))
      .limit(1);

    return row ? this.mapToDomain(row) : null;
  }

  public async findByUnsubscribeToken(token: string): Promise<Subscription | null> {
    const [row] = await this.db
      .select({
        email: subscriptionsTable.email,
        repository: repositoriesTable.fullName,
        status: subscriptionsTable.status,
        confirmToken: subscriptionsTable.confirmToken,
        unsubscribeToken: subscriptionsTable.unsubscribeToken,
      })
      .from(subscriptionsTable)
      .innerJoin(
        repositoriesTable,
        eq(subscriptionsTable.repositoryId, repositoriesTable.id)
      )
      .where(eq(subscriptionsTable.unsubscribeToken, token))
      .limit(1);

    return row ? this.mapToDomain(row) : null;
  }

  public async save(subscription: Subscription): Promise<void> {
    const [repository] = await this.db
      .select({ id: repositoriesTable.id })
      .from(repositoriesTable)
      .where(eq(repositoriesTable.fullName, subscription.repository))
      .limit(1);

    if (!repository) {
      throw new Error('Repository not found for subscription save.');
    }

    await this.db
      .update(subscriptionsTable)
      .set({
        status: subscription.status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptionsTable.email, subscription.email),
          eq(subscriptionsTable.repositoryId, repository.id)
        )
      );
  }

  public async listActiveByEmail(email: string): Promise<string[]> {
    const rows = await this.db
      .select({
        repository: repositoriesTable.fullName,
      })
      .from(subscriptionsTable)
      .innerJoin(
        repositoriesTable,
        eq(subscriptionsTable.repositoryId, repositoriesTable.id)
      )
      .where(
        and(
          eq(subscriptionsTable.email, email),
          eq(subscriptionsTable.status, 'active')
        )
      );

    return rows.map(row => row.repository);
  }

  public async listTrackedRepositories(): Promise<TrackedRepository[]> {
    const rows = await this.db
      .select({
        repository: repositoriesTable.fullName,
        lastSeenTag: repositoriesTable.lastSeenTag,
        email: subscriptionsTable.email,
      })
      .from(subscriptionsTable)
      .innerJoin(
        repositoriesTable,
        eq(subscriptionsTable.repositoryId, repositoriesTable.id)
      )
      .where(eq(subscriptionsTable.status, 'active'));

    const grouped = new Map<string, TrackedRepository>();
    for (const row of rows) {
      const existing = grouped.get(row.repository);
      if (existing) {
        existing.subscriberEmails.push(row.email);
        continue;
      }

      grouped.set(row.repository, {
        repository: row.repository,
        lastSeenTag: row.lastSeenTag,
        subscriberEmails: [row.email],
      });
    }

    return [...grouped.values()];
  }

  public async updateLastSeenTag(repository: string, tag: string): Promise<void> {
    await this.db
      .update(repositoriesTable)
      .set({
        lastSeenTag: tag,
        updatedAt: new Date(),
      })
      .where(eq(repositoriesTable.fullName, repository));
  }

  public async listDeliveredEmailsForTag(
    repository: string,
    tag: string
  ): Promise<string[]> {
    const [repo] = await this.db
      .select({ id: repositoriesTable.id })
      .from(repositoriesTable)
      .where(eq(repositoriesTable.fullName, repository))
      .limit(1);

    if (!repo) {
      return [];
    }

    const rows = await this.db
      .select({ email: notificationDeliveriesTable.email })
      .from(notificationDeliveriesTable)
      .where(
        and(
          eq(notificationDeliveriesTable.repositoryId, repo.id),
          eq(notificationDeliveriesTable.tag, tag)
        )
      );
    return rows.map(row => row.email);
  }

  public async markNotificationDelivered(input: {
    repository: string;
    tag: string;
    email: string;
  }): Promise<void> {
    const [repo] = await this.db
      .select({ id: repositoriesTable.id })
      .from(repositoriesTable)
      .where(eq(repositoriesTable.fullName, input.repository))
      .limit(1);

    if (!repo) {
      throw new Error('Repository not found for notification delivery mark.');
    }

    await this.db
      .insert(notificationDeliveriesTable)
      .values({
        repositoryId: repo.id,
        tag: input.tag,
        email: input.email,
      })
      .onConflictDoNothing();
  }

  private mapToDomain(subscription: Subscription): Subscription {
    return {
      email: subscription.email,
      repository: subscription.repository,
      status: subscription.status,
      confirmToken: subscription.confirmToken,
      unsubscribeToken: subscription.unsubscribeToken,
    };
  }
}

export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly byEmailRepo = new Map<string, Subscription>();
  private readonly byConfirmToken = new Map<string, string>();
  private readonly byUnsubscribeToken = new Map<string, string>();
  private readonly lastSeenByRepository = new Map<string, string | null>();
  private readonly deliveriesByRepoTag = new Map<string, Set<string>>();

  public async upsertPending(data: {
    email: string;
    repository: string;
    confirmToken: string;
    unsubscribeToken: string;
  }): Promise<Subscription> {
    const key = this.toKey(data.email, data.repository);
    const prev = this.byEmailRepo.get(key);

    if (prev) {
      this.byConfirmToken.delete(prev.confirmToken);
      this.byUnsubscribeToken.delete(prev.unsubscribeToken);
    }

    const next: Subscription = {
      email: data.email,
      repository: data.repository,
      status: 'pending',
      confirmToken: data.confirmToken,
      unsubscribeToken: data.unsubscribeToken,
    };
    this.byEmailRepo.set(key, next);
    this.byConfirmToken.set(next.confirmToken, key);
    this.byUnsubscribeToken.set(next.unsubscribeToken, key);
    if (!this.lastSeenByRepository.has(data.repository)) {
      this.lastSeenByRepository.set(data.repository, null);
    }
    return next;
  }

  public async findByConfirmToken(token: string): Promise<Subscription | null> {
    const key = this.byConfirmToken.get(token);
    if (!key) {
      return null;
    }

    return this.byEmailRepo.get(key) ?? null;
  }

  public async findByUnsubscribeToken(
    token: string
  ): Promise<Subscription | null> {
    const key = this.byUnsubscribeToken.get(token);
    if (!key) {
      return null;
    }

    return this.byEmailRepo.get(key) ?? null;
  }

  public async save(subscription: Subscription): Promise<void> {
    const key = this.toKey(subscription.email, subscription.repository);
    this.byEmailRepo.set(key, subscription);
  }

  public async listActiveByEmail(email: string): Promise<string[]> {
    const normalizedEmail = email.toLowerCase();
    const repositories: string[] = [];

    for (const subscription of this.byEmailRepo.values()) {
      if (
        subscription.email === normalizedEmail &&
        subscription.status === 'active'
      ) {
        repositories.push(subscription.repository);
      }
    }

    return repositories;
  }

  public async listTrackedRepositories(): Promise<TrackedRepository[]> {
    const grouped = new Map<string, TrackedRepository>();

    for (const subscription of this.byEmailRepo.values()) {
      if (subscription.status !== 'active') {
        continue;
      }

      const existing = grouped.get(subscription.repository);
      if (existing) {
        existing.subscriberEmails.push(subscription.email);
        continue;
      }

      grouped.set(subscription.repository, {
        repository: subscription.repository,
        lastSeenTag:
          this.lastSeenByRepository.get(subscription.repository) ?? null,
        subscriberEmails: [subscription.email],
      });
    }

    return [...grouped.values()];
  }

  public async updateLastSeenTag(repository: string, tag: string): Promise<void> {
    this.lastSeenByRepository.set(repository, tag);
  }

  public async listDeliveredEmailsForTag(
    repository: string,
    tag: string
  ): Promise<string[]> {
    const key = this.repoTagKey(repository, tag);
    return [...(this.deliveriesByRepoTag.get(key) ?? new Set<string>())];
  }

  public async markNotificationDelivered(input: {
    repository: string;
    tag: string;
    email: string;
  }): Promise<void> {
    const key = this.repoTagKey(input.repository, input.tag);
    const deliveries = this.deliveriesByRepoTag.get(key) ?? new Set<string>();
    deliveries.add(input.email.toLowerCase());
    this.deliveriesByRepoTag.set(key, deliveries);
  }

  private toKey(email: string, repository: string): string {
    return `${email.toLowerCase()}::${repository.toLowerCase()}`;
  }

  private repoTagKey(repository: string, tag: string): string {
    return `${repository.toLowerCase()}::${tag}`;
  }
}
