import { markTodayReady, resetStartup, startupMs } from '../startup';

describe('cold-start clock (F23)', () => {
  it('records the first Today-ready time only', () => {
    resetStartup();
    expect(startupMs()).toBeNull();
    const t0 = Date.now();
    markTodayReady(t0 + 50_000);
    const first = startupMs();
    expect(first).not.toBeNull();
    markTodayReady(t0 + 90_000);
    expect(startupMs()).toBe(first);
  });
});
