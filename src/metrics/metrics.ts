import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

const registry = new Registry();
collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new Counter({
  name: 'app_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

const httpRequestDurationSeconds = new Histogram({
  name: 'app_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [registry],
});

const scannerRunsTotal = new Counter({
  name: 'app_scanner_runs_total',
  help: 'Total number of release scanner runs',
  labelNames: ['result'] as const,
  registers: [registry],
});

const emailsTotal = new Counter({
  name: 'app_email_notifications_total',
  help: 'Total number of email notification attempts',
  labelNames: ['type', 'result'] as const,
  registers: [registry],
});

const githubRateLimitErrorsTotal = new Counter({
  name: 'app_github_rate_limit_errors_total',
  help: 'Total number of GitHub API rate limit errors',
  labelNames: ['operation'] as const,
  registers: [registry],
});

export function recordHttpRequest(input: {
  method: string;
  route: string;
  statusCode: number;
  durationSeconds: number;
}): void {
  const labels = {
    method: input.method,
    route: input.route,
    status_code: String(input.statusCode),
  };
  httpRequestsTotal.inc(labels);
  httpRequestDurationSeconds.observe(labels, input.durationSeconds);
}

export function recordScannerRun(result: 'success' | 'partial_failure' | 'rate_limited'): void {
  scannerRunsTotal.inc({ result });
}

export function recordEmailNotification(input: {
  type: 'confirmation' | 'release';
  result: 'success' | 'failed' | 'skipped';
}): void {
  emailsTotal.inc({ type: input.type, result: input.result });
}

export function recordGitHubRateLimitError(operation: 'repository_exists' | 'latest_release'): void {
  githubRateLimitErrorsTotal.inc({ operation });
}

export function getMetricsContentType(): string {
  return registry.contentType;
}

export async function getMetricsSnapshot(): Promise<string> {
  return registry.metrics();
}
