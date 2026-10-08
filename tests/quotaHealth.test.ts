import { describe, expect, test } from 'bun:test';
import { countQuotaHealth, resolveQuotaHealth } from '../src/features/quota/health';

const now = Date.now();
const codex = (used: number[]) => ({
  status: 'success',
  windows: used.map((usedPercent, index) => ({
    id: index === 0 ? 'five-hour' : 'weekly',
    label: `w${index}`,
    usedPercent,
    resetAtMs: now + (index + 1) * 3_600_000,
    periodHours: index === 0 ? 5 : 168,
  })),
});

describe('quota health', () => {
  test('maps request states before reading limits', () => {
    expect(resolveQuotaHealth('codex', undefined).health).toBe('idle');
    expect(resolveQuotaHealth('codex', { status: 'idle' }).health).toBe('idle');
    expect(resolveQuotaHealth('codex', { status: 'loading' }).health).toBe('loading');
    expect(resolveQuotaHealth('codex', { status: 'error' }).health).toBe('error');
  });

  test('uses the lowest remaining limit', () => {
    expect(resolveQuotaHealth('codex', codex([10, 20]))).toEqual({
      health: 'ok',
      minRemaining: 80,
    });
    expect(resolveQuotaHealth('codex', codex([82, 34])).health).toBe('low');
    expect(resolveQuotaHealth('codex', codex([100, 12])).health).toBe('exhausted');
  });

  test('a loaded credential without limits counts as healthy, not unknown', () => {
    expect(resolveQuotaHealth('codex', { status: 'success', windows: [] })).toEqual({
      health: 'ok',
      minRemaining: null,
    });
  });

  test('counts every state', () => {
    expect(countQuotaHealth(['ok', 'ok', 'low', 'error', 'idle'])).toEqual({
      idle: 1,
      loading: 0,
      error: 1,
      exhausted: 0,
      low: 1,
      ok: 2,
    });
  });
});
