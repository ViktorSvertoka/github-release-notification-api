import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const optionalString = z.preprocess(
  value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().min(1).optional()
);

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  GITHUB_TOKEN: optionalString,
  DATABASE_URL: z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().url().optional()
  ),
  REDIS_URL: z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().url().optional()
  ),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  SCAN_INTERVAL_SECONDS: z.coerce.number().int().positive().default(300),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: z.preprocess(
    value => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().email().optional()
  ),
  API_KEY: optionalString,
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined>): Env {
  const parsed = envSchema.parse(input);

  if (parsed.NODE_ENV !== 'test' && !parsed.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  return parsed;
}

export function loadRuntimeEnv(): Env {
  loadEnv();
  return parseEnv(process.env);
}
