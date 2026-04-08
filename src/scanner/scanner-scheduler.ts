export interface ScannerRunner {
  runOnce(): Promise<void>;
}

export interface ScannerScheduler {
  stop(): Promise<void>;
}

export function startScannerScheduler(input: {
  scanner: ScannerRunner;
  intervalSeconds: number;
  onError: (error: unknown) => void;
}): ScannerScheduler {
  const intervalMs = input.intervalSeconds * 1000;
  let currentRun: Promise<void> | null = null;
  let stopping = false;

  const runIfIdle = (): void => {
    if (stopping || currentRun) {
      return;
    }

    currentRun = input.scanner
      .runOnce()
      .catch(input.onError)
      .finally(() => {
        currentRun = null;
      });
  };

  const timer = setInterval(() => {
    runIfIdle();
  }, intervalMs);
  timer.unref();

  // Run once immediately on startup.
  runIfIdle();

  return {
    async stop() {
      stopping = true;
      clearInterval(timer);
      if (currentRun) {
        await currentRun;
      }
    },
  };
}
