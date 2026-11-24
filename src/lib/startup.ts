/**
 * Cold-start timing (PRD F23 AC: "cold start to interactive Today < 2 s").
 * The clock starts when this module is first imported (app/_layout, early in
 * JS start-up) and stops the first time Today has its plan on screen. More
 * shows the result so it can be checked on the phone. Native launch before JS
 * runs is not included.
 */
const jsStart = Date.now();
let todayReadyMs: number | null = null;

/** Called once by Today when its plan is on screen; later calls are ignored. */
export function markTodayReady(at: number): void {
  if (todayReadyMs === null) todayReadyMs = Math.max(0, at - jsStart);
}

/** Milliseconds from JS start to an interactive Today, or null before that. */
export const startupMs = (): number | null => todayReadyMs;

/** Tests only. */
export function resetStartup(): void {
  todayReadyMs = null;
}
