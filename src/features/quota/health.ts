/**
 * One-word health for a credential's quota, used by the overview strip, the row
 * badge and the health filter.
 *
 * Reads remaining capacity independently of reset scheduling: a known exhausted
 * limit must stay exhausted even if its reset time is missing. No new requests.
 */

import { isRecord } from '@/utils/helpers';
import { QUOTA_PROGRESS_MEDIUM_THRESHOLD } from './components/QuotaMeter';
import type { QuotaProviderType } from './providers/types';

export type QuotaHealth = 'idle' | 'loading' | 'error' | 'exhausted' | 'low' | 'ok';

/** States that need the user's attention, most severe first. */
export const QUOTA_ATTENTION_HEALTH: readonly QuotaHealth[] = ['exhausted', 'error', 'low'];

export interface QuotaHealthSummary {
  health: QuotaHealth;
  /** Lowest remaining percent across the credential's limits; null when unknown. */
  minRemaining: number | null;
}

const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const remainingFromUsed = (value: unknown) => (finite(value) ? 100 - value : null);

function remainingLimits(provider: QuotaProviderType, quota: Record<string, unknown>): number[] {
  let values: unknown[];
  switch (provider) {
    case 'claude':
    case 'codex':
      values = records(quota.windows).map((window) => remainingFromUsed(window.usedPercent));
      break;
    case 'devin':
      values = records(quota.windows).map((window) => window.remainingPercent);
      break;
    case 'antigravity':
    case 'plugin':
      values = records(quota.groups)
        .flatMap((group) => records(group.buckets))
        .map((bucket) =>
          finite(bucket.remainingFraction) ? bucket.remainingFraction * 100 : null
        );
      break;
    case 'kimi':
      values = records(quota.rows).map((row) =>
        finite(row.limit) && row.limit > 0 && finite(row.used)
          ? ((row.limit - row.used) / row.limit) * 100
          : null
      );
      break;
    case 'meta':
      values = records(isRecord(quota.data) ? quota.data.windows : undefined).map((window) =>
        remainingFromUsed(window.usedPercent)
      );
      break;
    case 'xai':
      // Product contributions are not independent limits, and monthly spending
      // is not a rate-limit window. Use only the shared weekly quota.
      values =
        isRecord(quota.billing) && quota.billing.periodType === 'weekly'
          ? [remainingFromUsed(quota.billing.usagePercent)]
          : [];
      break;
  }
  return values.filter(finite).map((value) => Math.max(0, Math.min(100, value)));
}

export function resolveQuotaHealth(
  provider: QuotaProviderType,
  quota: { status?: string } | undefined
): QuotaHealthSummary {
  const status = quota?.status;
  if (!quota || !status || status === 'idle') return { health: 'idle', minRemaining: null };
  if (status === 'loading') return { health: 'loading', minRemaining: null };
  if (status === 'error') return { health: 'error', minRemaining: null };
  if (status !== 'success') return { health: 'idle', minRemaining: null };

  const limits = remainingLimits(provider, quota);
  if (limits.length === 0) return { health: 'ok', minRemaining: null };

  const minRemaining = Math.min(...limits);
  if (minRemaining <= 0) return { health: 'exhausted', minRemaining };
  if (minRemaining < QUOTA_PROGRESS_MEDIUM_THRESHOLD) return { health: 'low', minRemaining };
  return { health: 'ok', minRemaining };
}

export type QuotaHealthCounts = Record<QuotaHealth, number>;

export function countQuotaHealth(healths: readonly QuotaHealth[]): QuotaHealthCounts {
  const counts: QuotaHealthCounts = { idle: 0, loading: 0, error: 0, exhausted: 0, low: 0, ok: 0 };
  healths.forEach((health) => {
    counts[health] += 1;
  });
  return counts;
}
