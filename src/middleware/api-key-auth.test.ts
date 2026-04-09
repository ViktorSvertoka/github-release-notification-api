import { describe, expect, it, vi } from 'vitest';

import { createApiKeyAuthMiddleware } from './api-key-auth.js';

interface MockRequest {
  method: string;
  path: string;
  header(name: string): string | undefined;
}

interface MockResponse {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
}

function makeReq(input: {
  method: string;
  path: string;
  headers?: Record<string, string | undefined>;
}): MockRequest {
  const headers = Object.fromEntries(
    Object.entries(input.headers ?? {}).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );

  return {
    method: input.method,
    path: input.path,
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  };
}

function makeRes(): MockResponse {
  const res: MockResponse = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('createApiKeyAuthMiddleware', () => {
  it('allows request when API key is not configured', () => {
    const middleware = createApiKeyAuthMiddleware(undefined);
    const req = makeReq({ method: 'POST', path: '/subscribe' });
    const res = makeRes();
    const next = vi.fn();

    middleware(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 for protected route without API key header', () => {
    const middleware = createApiKeyAuthMiddleware('secret');
    const req = makeReq({ method: 'POST', path: '/subscribe' });
    const res = makeRes();
    const next = vi.fn();

    middleware(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Unauthorized. Invalid API key.',
    });
  });

  it('returns 401 for protected route with wrong API key', () => {
    const middleware = createApiKeyAuthMiddleware('secret');
    const req = makeReq({
      method: 'GET',
      path: '/subscriptions',
      headers: { 'x-api-key': 'wrong' },
    });
    const res = makeRes();
    const next = vi.fn();

    middleware(req as never, res as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('allows protected route with correct API key', () => {
    const middleware = createApiKeyAuthMiddleware('secret');
    const req = makeReq({
      method: 'GET',
      path: '/subscriptions',
      headers: { 'x-api-key': 'secret' },
    });
    const res = makeRes();
    const next = vi.fn();

    middleware(req as never, res as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows token confirmation/unsubscribe routes without API key', () => {
    const middleware = createApiKeyAuthMiddleware('secret');
    const next = vi.fn();

    middleware(
      makeReq({ method: 'GET', path: '/confirm/abc' }) as never,
      makeRes() as never,
      next
    );
    middleware(
      makeReq({ method: 'GET', path: '/unsubscribe/abc' }) as never,
      makeRes() as never,
      next
    );

    expect(next).toHaveBeenCalledTimes(2);
  });
});
