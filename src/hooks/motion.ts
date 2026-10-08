/**
 * Shared motion helpers. Decorative entrance cascades and count-ups were removed: the app keeps
 * only micro feedback (press, popover, spinner), so pages render settled on first paint.
 */

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
