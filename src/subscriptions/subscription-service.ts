import crypto from 'node:crypto';

import { z } from 'zod';

import {
  NotFoundError,
  RateLimitError,
  ValidationError,
} from '../errors.js';
import type { GitHubRepositoryClient } from '../github/github-repository-client.js';
import type { SubscriptionRepository } from './subscription-repository.js';

const subscribeInputSchema = z.object({
  email: z.email(),
  repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
});

const emailSchema = z.email();

export class SubscriptionService {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly gitHubClient: GitHubRepositoryClient
  ) {}

  public async subscribe(input: {
    email: string;
    repository: string;
  }): Promise<{ message: string }> {
    const parsed = subscribeInputSchema.safeParse({
      email: input.email,
      repository: input.repository,
    });
    if (!parsed.success) {
      throw new ValidationError(
        'Invalid repository format. Expected owner/repo.'
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const repository = parsed.data.repository;

    let exists: boolean;
    try {
      exists = await this.gitHubClient.repositoryExists(repository);
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }

      throw new Error('Failed to validate repository via GitHub API.', {
        cause: error,
      });
    }

    if (!exists) {
      throw new NotFoundError('Repository not found.');
    }

    this.repository.upsertPending({
      email: normalizedEmail,
      repository,
      confirmToken: this.generateToken(),
      unsubscribeToken: this.generateToken(),
    });

    return {
      message: 'Confirmation email sent. Please check your inbox.',
    };
  }

  public async confirm(token: string): Promise<{ message: string }> {
    if (!token.trim()) {
      throw new ValidationError('Invalid or expired token.');
    }

    const subscription = await this.repository.findByConfirmToken(token);
    if (!subscription) {
      throw new NotFoundError('Subscription token not found.');
    }

    if (subscription.status !== 'pending') {
      throw new ValidationError('Invalid or expired token.');
    }

    subscription.status = 'active';
    await this.repository.save(subscription);

    return { message: 'Subscription confirmed successfully.' };
  }

  public async unsubscribe(token: string): Promise<{ message: string }> {
    if (!token.trim()) {
      throw new ValidationError('Invalid or expired token.');
    }

    const subscription = await this.repository.findByUnsubscribeToken(token);
    if (!subscription) {
      throw new NotFoundError('Subscription token not found.');
    }

    if (subscription.status === 'unsubscribed') {
      throw new ValidationError('Invalid or expired token.');
    }

    subscription.status = 'unsubscribed';
    await this.repository.save(subscription);

    return { message: 'Unsubscribed successfully.' };
  }

  public async listByEmail(email: string): Promise<{
    email: string;
    subscriptions: string[];
  }> {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      throw new ValidationError('Invalid email.');
    }

    const normalizedEmail = parsed.data.toLowerCase();
    return {
      email: normalizedEmail,
      subscriptions: await this.repository.listActiveByEmail(normalizedEmail),
    };
  }

  private generateToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }
}
