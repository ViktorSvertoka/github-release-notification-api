import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { Env } from '../config.js';
import type * as schema from './schema.js';
import * as dbSchema from './schema.js';

export type AppDatabase = NodePgDatabase<typeof schema>;

export function createDbClient(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const pool = new Pool({
    connectionString: env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema: dbSchema });
  return { db, pool };
}
