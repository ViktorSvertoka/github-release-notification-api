import { describe, expect, it } from 'vitest';

import { parseEnv } from './config.js';

describe('parseEnv', () => {
  it('uses defaults when vars are missing in test env', () => {
    const parsed = parseEnv({
      NODE_ENV: 'test',
    });

    expect(parsed.NODE_ENV).toBe('test');
    expect(parsed.PORT).toBe(3000);
  });

  it('parses provided values', () => {
    const parsed = parseEnv({
      NODE_ENV: 'production',
      PORT: '8080',
      APP_BASE_URL: 'https://example.com',
      DATABASE_URL:
        'postgresql://postgres:postgres@localhost:5432/release_notifications?sslmode=disable',
    });

    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.PORT).toBe(8080);
  });

  it('throws when DATABASE_URL is missing outside test env', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'development',
      })
    ).toThrow('DATABASE_URL is required.');
  });

  it('throws when APP_BASE_URL is missing in production', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL:
          'postgresql://postgres:postgres@localhost:5432/release_notifications?sslmode=disable',
      })
    ).toThrow('APP_BASE_URL is required in production.');
  });
});
