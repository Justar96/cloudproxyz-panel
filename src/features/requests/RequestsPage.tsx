import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconDownload, IconSearch, IconTrash2 } from '@/components/ui/icons';
import { readApiKeyNames } from '@/features/config/apiKeyNames';
import { readUsageQueueSettings } from '@/services/api/usageQueue';
import { useAuthStore, useConfigStore, useNotificationStore, useRequestLogStore } from '@/stores';
import type { RequestLogRecord } from '@/types/requestLog';
import { downloadBlob } from '@/utils/download';
import {
  EMPTY_REQUEST_FILTERS,
  clientKeyDisplayName,
  filterRequestRecords,
  requestLogFacets,
  requestRecordsToCsv,
  summarizeRequestRecords,
  type RequestLogFilters,
  type RequestStatusFilter,
} from './logic';
import { formatDuration, formatTokens } from './format';
import { RequestDetailSheet } from './components/RequestDetailSheet';
import { RequestTable } from './components/RequestTable';
import styles from './RequestsPage.module.scss';

const PAGE_SIZE = 100;

export function RequestsPage() {
  const { t } = useTranslation();
  const apiBase = useAuthStore((state) => state.apiBase);
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const showNotification = useNotificationStore((state) => state.showNotification);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const records = useRequestLogStore((state) => state.records);
  const hydrated = useRequestLogStore((state) => state.hydrated);
  const collecting = useRequestLogStore((state) => state.collecting);
  const lastError = useRequestLogStore((state) => state.lastError);
  const setCollecting = useRequestLogStore((state) => state.setCollecting);
  const clear = useRequestLogStore((state) => state.clear);

  const [filters, setFilters] = useState<RequestLogFilters>(EMPTY_REQUEST_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<RequestLogRecord | null>(null);
  const deferredFilters = useDeferredValue(filters);

  useEffect(() => {
    void fetchConfig().catch(() => undefined);
  }, [fetchConfig]);

  // Names given to client keys on the API Keys page.
  const keyNames = useMemo(() => readApiKeyNames(apiBase), [apiBase]);
  const queueSettings = readUsageQueueSettings(config);
  const facets = useMemo(() => requestLogFacets(records, keyNames), [records, keyNames]);
  const filtered = useMemo(
    () => filterRequestRecords(records, deferredFilters, keyNames),
    [records, deferredFilters, keyNames]
  );
  const summary = useMemo(() => summarizeRequestRecords(filtered), [filtered]);
  const visible = filtered.slice(0, visibleCount);
  const disconnected = connectionStatus !== 'connected';

  const updateFilters = (patch: Partial<RequestLogFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setVisibleCount(PAGE_SIZE);
  };

  const allOption = (label: string) => ({ value: '', label });
  const statusOptions: { value: RequestStatusFilter; label: string }[] = [
    { value: 'all', label: t('requests.status_all') },
    { value: 'success', label: t('requests.status_success') },
    { value: 'failed', label: t('requests.status_failed') },
  ];

  const handleExport = () => {
    const csv = requestRecordsToCsv(filtered, keyNames);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlob({
      filename: `requests-${stamp}.csv`,
      blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
    });
  };

  const handleClear = () => {
    showConfirmation({
      title: t('requests.clear_title'),
      message: t('requests.clear_message'),
      confirmText: t('requests.clear_confirm'),
      variant: 'danger',
      onConfirm: async () => {
        await clear();
        setSelected(null);
        showNotification(t('requests.cleared'), 'success');
      },
    });
  };

  const summaryCells = [
    { label: t('requests.summary_requests'), value: summary.requests.toLocaleString() },
    {
      label: t('requests.summary_success_rate'),
      value: summary.successRate === null ? '—' : `${summary.successRate.toFixed(1)}%`,
    },
    { label: t('requests.summary_input'), value: formatTokens(summary.inputTokens) },
    { label: t('requests.summary_output'), value: formatTokens(summary.outputTokens) },
    { label: t('requests.summary_cache_read'), value: formatTokens(summary.cacheReadTokens) },
    {
      label: t('requests.summary_cache_write'),
      value: formatTokens(summary.cacheCreationTokens),
    },
    {
      label: t('requests.summary_latency'),
      value: summary.averageLatencyMs === null ? '—' : formatDuration(summary.averageLatencyMs),
    },
  ];

  return (
    <div className={styles.page}>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">{t('requests.title')}</h1>
          <p className="page-subtitle">{t('requests.subtitle')}</p>
        </div>
        <div className={`page-actions ${styles.actions}`}>
          <ToggleSwitch
            checked={collecting}
            onChange={setCollecting}
            disabled={disconnected}
            label={t('requests.collect_label')}
            labelPosition="left"
          />
          <Button variant="secondary" onClick={handleExport} disabled={!filtered.length}>
            <IconDownload size={16} aria-hidden="true" />
            {t('requests.export_csv')}
          </Button>
          <Button variant="ghost" onClick={handleClear} disabled={!records.length}>
            <IconTrash2 size={16} aria-hidden="true" />
            {t('requests.clear')}
          </Button>
        </div>
      </header>

      {!collecting && (
        <div className={styles.notice} role="note">
          <p className={styles.noticeTitle}>{t('requests.off_title')}</p>
          <p>{t('requests.off_desc')}</p>
        </div>
      )}
      {collecting && queueSettings && !queueSettings.statisticsEnabled && (
        <div className={styles.notice} data-tone="warning" role="status">
          <p className={styles.noticeTitle}>{t('requests.stats_off_title')}</p>
          <p>
            {t('requests.stats_off_desc')} <Link to="/config">{t('requests.open_config')}</Link>
          </p>
        </div>
      )}
      {collecting && lastError && (
        <div className={styles.notice} data-tone="danger" role="alert">
          <p className={styles.noticeTitle}>{t('requests.poll_failed')}</p>
          <p>{lastError}</p>
        </div>
      )}

      <section className={styles.summary} aria-label={t('requests.summary_label')}>
        {summaryCells.map((cell) => (
          <div key={cell.label} className={styles.summaryCell}>
            <span className="stat-label">{cell.label}</span>
            <span className={styles.summaryValue}>{cell.value}</span>
          </div>
        ))}
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Input
              type="search"
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
              placeholder={t('requests.search_placeholder')}
              aria-label={t('requests.search_label')}
              rightElement={<IconSearch size={16} aria-hidden="true" />}
            />
          </div>
          <Select
            value={filters.status}
            options={statusOptions}
            onChange={(value) => updateFilters({ status: value as RequestStatusFilter })}
            ariaLabel={t('requests.filter_status')}
            fullWidth={false}
          />
          <Select
            value={filters.model}
            options={[
              allOption(t('requests.all_models')),
              ...facets.models.map(({ value, label }) => ({ value, label })),
            ]}
            onChange={(model) => updateFilters({ model })}
            ariaLabel={t('requests.filter_model')}
            fullWidth={false}
          />
          <Select
            value={filters.clientKeyId}
            options={[
              allOption(t('requests.all_keys')),
              ...facets.clientKeys.map(({ value, label }) => ({ value, label })),
            ]}
            onChange={(clientKeyId) => updateFilters({ clientKeyId })}
            ariaLabel={t('requests.filter_key')}
            fullWidth={false}
          />
          <Select
            value={filters.provider}
            options={[
              allOption(t('requests.all_providers')),
              ...facets.providers.map(({ value, label }) => ({ value, label })),
            ]}
            onChange={(provider) => updateFilters({ provider })}
            ariaLabel={t('requests.filter_provider')}
            fullWidth={false}
          />
        </div>

        {!filtered.length ? (
          <EmptyState
            title={
              records.length
                ? t('requests.no_matches')
                : hydrated && collecting
                  ? t('requests.waiting_title')
                  : t('requests.empty_title')
            }
            description={
              records.length
                ? t('requests.no_matches_desc')
                : collecting
                  ? t('requests.waiting_desc', {
                      seconds: queueSettings?.retentionSeconds ?? 60,
                    })
                  : t('requests.empty_desc')
            }
            action={
              records.length ? (
                <Button variant="secondary" onClick={() => updateFilters(EMPTY_REQUEST_FILTERS)}>
                  {t('requests.clear_filters')}
                </Button>
              ) : undefined
            }
          />
        ) : (
          <RequestTable
            records={visible}
            total={filtered.length}
            keyNames={keyNames}
            selectedId={selected?.id ?? null}
            onSelect={setSelected}
            onShowMore={() => setVisibleCount((count) => count + PAGE_SIZE)}
          />
        )}
      </section>

      <RequestDetailSheet
        record={selected}
        keyName={selected ? clientKeyDisplayName(selected, keyNames) : ''}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
