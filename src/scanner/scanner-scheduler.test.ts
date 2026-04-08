import { describe, expect, it } from 'vitest';

import { startScannerScheduler } from './scanner-scheduler.js';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

describe('startScannerScheduler', () => {
  it('does not overlap scanner runs', async () => {
    let running = 0;
    let maxRunning = 0;
    let runs = 0;

    const scheduler = startScannerScheduler({
      scanner: {
        async runOnce() {
          runs += 1;
          running += 1;
          maxRunning = Math.max(maxRunning, running);
          await sleep(80);
          running -= 1;
        },
      },
      intervalSeconds: 0.02,
      onError() {},
    });

    await sleep(230);
    await scheduler.stop();

    expect(maxRunning).toBe(1);
    expect(runs).toBeGreaterThan(0);
  });

  it('waits for active run during stop', async () => {
    let completed = false;

    const scheduler = startScannerScheduler({
      scanner: {
        async runOnce() {
          await sleep(80);
          completed = true;
        },
      },
      intervalSeconds: 1,
      onError() {},
    });

    await sleep(10);
    await scheduler.stop();

    expect(completed).toBe(true);
  });
});
