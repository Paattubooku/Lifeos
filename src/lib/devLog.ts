/**
 * Development-only diagnostics, printed in the Metro terminal (never in
 * production builds or tests). Used to trace iPhone-only keyboard problems:
 * a text box that is built again on every key means its screen is rebuilt.
 */
export function devLog(message: string): void {
  if (__DEV__ && process.env.JEST_WORKER_ID === undefined) console.log(`[LifeOS] ${message}`);
}
