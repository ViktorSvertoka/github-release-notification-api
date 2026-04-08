import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'pending',
  'active',
  'unsubscribed',
]);

export const repositoriesTable = pgTable('repositories', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull().unique(),
  lastSeenTag: text('last_seen_tag'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const subscriptionsTable = pgTable(
  'subscriptions',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull(),
    repositoryId: integer('repository_id')
      .notNull()
      .references(() => repositoriesTable.id, { onDelete: 'cascade' }),
    status: subscriptionStatusEnum('status').notNull(),
    confirmToken: text('confirm_token').notNull().unique(),
    unsubscribeToken: text('unsubscribe_token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    emailRepositoryUnique: unique('subscriptions_email_repository_unique').on(
      table.email,
      table.repositoryId
    ),
  })
);

export const notificationDeliveriesTable = pgTable(
  'notification_deliveries',
  {
    id: serial('id').primaryKey(),
    repositoryId: integer('repository_id')
      .notNull()
      .references(() => repositoriesTable.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  table => ({
    repoTagEmailUnique: unique(
      'notification_deliveries_repository_tag_email_unique'
    ).on(table.repositoryId, table.tag, table.email),
  })
);
