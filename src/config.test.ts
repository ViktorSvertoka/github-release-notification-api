import { describe, expect, it } from 'vitest';

import { parseEnv } from './config.js';

describe('parseEnv', () => {
  it('uses defaults when vars are missing', () => {
    const parsed = parseEnv({});

    expect(parsed.NODE_ENV).toBe('development');
    expect(parsed.PORT).toBe(3000);
  });

  it('parses provided values', () => {
    const parsed = parseEnv({
      NODE_ENV: 'production',
      PORT: '8080',
    });

    expect(parsed.NODE_ENV).toBe('production');
    expect(parsed.PORT).toBe(8080);
  });
});
