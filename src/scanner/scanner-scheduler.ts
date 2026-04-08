import type { ReleaseScanner } from './release-scanner.js';

export interface ScannerScheduler {
  stop(): void;
}

export function startScannerScheduler(input: {
  scanner: ReleaseScanner;
  intervalSeconds: number;
  onError: (error: unknown) => void;
}): ScannerScheduler {
  const intervalMs = input.intervalSeconds * 1000;
  const timer = setInterval(() => {
    input.scanner.runOnce().catch(input.onError);
  }, intervalMs);
  timer.unref();

  // Run once immediately on startup.
  input.scanner.runOnce().catch(input.onError);

  return {
    stop() {
      clearInterval(timer);
    },
  };
}
