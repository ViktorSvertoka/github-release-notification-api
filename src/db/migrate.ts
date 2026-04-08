import { migrate } from 'drizzle-orm/node-postgres/migrator';

import type { Env } from '../config.js';
import { loadRuntimeEnv } from '../config.js';
import { createDbClient, type AppDatabase } from './client.js';

export async function runMigrations(db: AppDatabase): Promise<void> {
  await migrate(db, {
    migrationsFolder: './drizzle',
  });
}

export async function runStandaloneMigrations(envOverride?: Env): Promise<void> {
  const env = envOverride ?? loadRuntimeEnv();
  const { db, pool } = createDbClient(env);
  try {
    await runMigrations(db);
  } finally {
    await pool.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runStandaloneMigrations().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
