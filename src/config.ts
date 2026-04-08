import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  GITHUB_TOKEN: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().email().optional(),
  API_KEY: z.string().min(1).optional(),
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
