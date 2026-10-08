/**
 * One-word health for a credential's quota, used by the overview strip, the row
 * badge and the health filter.
 *
 * Reads limits through `buildTimelineLane`, which already normalises the five
 * provider shapes (percent used, fraction remaining, raw counts) into
 * "percent remaining". No new requests: only the quota state already loaded.
 */

import { buildTimelineLane } from './quotaTimelineModel';
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

export function resolveQuotaHealth(
  provider: QuotaProviderType,
  quota: { status?: string } | undefined
): QuotaHealthSummary {
  const status = quota?.status;
  if (!quota || !status || status === 'idle') return { health: 'idle', minRemaining: null };
  if (status === 'loading') return { health: 'loading', minRemaining: null };
  if (status === 'error') return { health: 'error', minRemaining: null };
  if (status !== 'success') return { health: 'idle', minRemaining: null };

  const { limits } = buildTimelineLane({ name: '', displayName: '', provider, quota });
  if (limits.length === 0) return { health: 'ok', minRemaining: null };

  const minRemaining = Math.min(...limits.map((limit) => limit.remaining));
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
