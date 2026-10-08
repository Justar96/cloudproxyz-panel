/**
 * Fleet-level summary above the list: how many credentials are healthy, running low,
 * exhausted or failing, and when the soonest one recovers.
 *
 * Status cells double as filters (aria-pressed); a cell with nothing in it is disabled.
 * Owns its own minute clock so the countdown ticks without re-rendering the page.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNow } from '@/hooks/useNow';
import { formatRelativeInstant } from '@/utils/quota';
import { getQuotaDisplayName } from '@/utils/quota/identity';
import type { QuotaHealth, QuotaHealthCounts } from '../health';
import { QUOTA_ATTENTION_HEALTH } from '../health';
import type { QuotaFileEntry } from '../logic';
import { nextRecoveryMs } from '../resetSchedule';
import styles from './QuotaOverview.module.scss';

export type QuotaHealthFilter = Exclude<QuotaHealth, 'loading'> | null;

const FILTER_CELLS: readonly Exclude<QuotaHealth, 'loading' | 'idle'>[] = [
  'ok',
  'low',
  'exhausted',
  'error',
];

export interface QuotaOverviewProps {
  entries: readonly QuotaFileEntry[];
  healthOf: (entry: QuotaFileEntry) => QuotaHealth;
  quotaOf: (entry: QuotaFileEntry) => unknown;
  counts: QuotaHealthCounts;
  filter: QuotaHealthFilter;
  onFilterChange: (next: QuotaHealthFilter) => void;
}

export function QuotaOverview({
  entries,
  healthOf,
  quotaOf,
  counts,
  filter,
  onFilterChange,
}: QuotaOverviewProps) {
  const { t, i18n } = useTranslation();
  const now = useNow(true);
  const total = entries.length;
  const notLoaded = counts.idle + counts.loading;
  const loaded = total - notLoaded;

  // Prefer the soonest recovery among credentials that need it; otherwise any.
  const next = useMemo(() => {
    let best: { ms: number; entry: QuotaFileEntry } | null = null;
    let bestAttention: { ms: number; entry: QuotaFileEntry } | null = null;
    entries.forEach((entry) => {
      const ms = nextRecoveryMs(entry.type, quotaOf(entry), now);
      if (ms === null) return;
      if (!best || ms < best.ms) best = { ms, entry };
      if (
        QUOTA_ATTENTION_HEALTH.includes(healthOf(entry)) &&
        (!bestAttention || ms < bestAttention.ms)
      ) {
        bestAttention = { ms, entry };
      }
    });
    return (bestAttention ?? best) as { ms: number; entry: QuotaFileEntry } | null;
  }, [entries, healthOf, quotaOf, now]);

  return (
    <section className={styles.overview} aria-label={t('quota_management.overview_label')}>
      <div className={styles.cell}>
        <span className={styles.label}>{t('quota_management.overview_credentials')}</span>
        <span className={styles.value}>{total}</span>
        <span className={styles.sub}>
          {notLoaded > 0
            ? t('quota_management.overview_not_loaded', { count: notLoaded })
            : t('quota_management.overview_loaded', { count: loaded })}
        </span>
      </div>

      {FILTER_CELLS.map((health) => {
        const count = counts[health];
        const active = filter === health;
        return (
          <button
            key={health}
            type="button"
            className={styles.cell}
            data-health={health}
            data-active={active || undefined}
            aria-pressed={active}
            disabled={count === 0 && !active}
            onClick={() => onFilterChange(active ? null : health)}
          >
            <span className={styles.label}>
              <span className={styles.dot} aria-hidden="true" />
              {t(`quota_management.health_${health}`)}
            </span>
            <span className={styles.value}>{count}</span>
            <span className={styles.sub}>
              {active
                ? t('quota_management.filter_showing')
                : count > 0
                  ? t('quota_management.filter_show')
                  : '\u00a0'}
            </span>
          </button>
        );
      })}

      <div className={styles.cell}>
        <span className={styles.label}>{t('quota_management.overview_next_recovery')}</span>
        <span className={`${styles.value} ${styles.valueText}`}>
          {next ? formatRelativeInstant(next.ms, now, i18n.resolvedLanguage) : '—'}
        </span>
        <span
          className={styles.sub}
          title={next ? getQuotaDisplayName(next.entry.file) : undefined}
        >
          {next ? getQuotaDisplayName(next.entry.file) : t('quota_management.overview_next_none')}
        </span>
      </div>
    </section>
  );
}
