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

  test('does not require reset times to recognize exhausted limits', () => {
    for (const provider of ['codex', 'claude'] as const) {
      expect(
        resolveQuotaHealth(provider, { status: 'success', windows: [{ usedPercent: 100 }] }).health
      ).toBe('exhausted');
    }
    expect(
      resolveQuotaHealth('kimi', { status: 'success', rows: [{ limit: 100, used: 100 }] }).health
    ).toBe('exhausted');
    expect(
      resolveQuotaHealth('devin', { status: 'success', windows: [{ remainingPercent: 0 }] }).health
    ).toBe('exhausted');
    expect(
      resolveQuotaHealth('meta', { status: 'success', data: { windows: [{ usedPercent: 100 }] } })
        .health
    ).toBe('exhausted');
    for (const provider of ['antigravity', 'plugin'] as const) {
      const quota = { status: 'success', groups: [{ buckets: [{ remainingFraction: 0.004 }] }] };
      expect(resolveQuotaHealth(provider, quota)).toEqual({ health: 'low', minRemaining: 0.4 });
    }
  });

  test('uses xAI shared usage, never per-product contributions or monthly spending', () => {
    const weekly = {
      status: 'success',
      billing: {
        periodType: 'weekly',
        usagePercent: 100,
        productUsage: [
          { product: 'chat', usagePercent: 40 },
          { product: 'code', usagePercent: 60 },
        ],
      },
    };
    expect(resolveQuotaHealth('xai', weekly)).toEqual({ health: 'exhausted', minRemaining: 0 });
    expect(
      resolveQuotaHealth('xai', {
        ...weekly,
        billing: { ...weekly.billing, periodType: 'monthly' },
      })
    ).toEqual({ health: 'ok', minRemaining: null });
  });

  test('ignores non-finite values and clamps malformed percentages', () => {
    expect(
      resolveQuotaHealth('codex', { status: 'success', windows: [{ usedPercent: Number.NaN }] })
    ).toEqual({ health: 'ok', minRemaining: null });
    expect(resolveQuotaHealth('codex', codex([120])).minRemaining).toBe(0);
    expect(resolveQuotaHealth('codex', codex([-10])).minRemaining).toBe(100);
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
