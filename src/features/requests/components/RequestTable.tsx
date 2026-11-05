import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import type { RequestLogRecord } from '@/types/requestLog';
import { clientKeyDisplayName } from '../logic';
import { formatDuration, formatRequestTime, formatTokens } from '../format';
import styles from '../RequestsPage.module.scss';

interface RequestTableProps {
  /** The page of records to show, newest first. */
  records: readonly RequestLogRecord[];
  /** Matching records in total, including those not shown yet. */
  total: number;
  keyNames: Readonly<Record<string, string>>;
  selectedId: string | null;
  onSelect: (record: RequestLogRecord) => void;
  onShowMore: () => void;
}

export function RequestTable({
  records,
  total,
  keyNames,
  selectedId,
  onSelect,
  onShowMore,
}: RequestTableProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{t('requests.table_caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('requests.col_time')}</th>
            <th scope="col">{t('requests.col_status')}</th>
            <th scope="col">{t('requests.col_model')}</th>
            <th scope="col">{t('requests.col_key')}</th>
            <th scope="col">{t('requests.col_credential')}</th>
            <th scope="col" className={styles.num}>
              {t('requests.col_input')}
            </th>
            <th scope="col" className={styles.num}>
              {t('requests.col_output')}
            </th>
            <th scope="col" className={styles.num}>
              {t('requests.col_cache_read')}
            </th>
            <th scope="col" className={styles.num}>
              {t('requests.col_cache_write')}
            </th>
            <th scope="col" className={styles.num}>
              {t('requests.col_latency')}
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.id}
              className={styles.row}
              data-selected={selectedId === record.id ? '' : undefined}
              onClick={() => onSelect(record)}
            >
              <td>
                <button
                  type="button"
                  className={styles.timeButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(record);
                  }}
                  aria-label={t('requests.view_details', {
                    model: record.model || t('requests.unknown'),
                  })}
                >
                  {formatRequestTime(record.timestamp, i18n.language)}
                </button>
              </td>
              <td>
                <span className={`badge ${record.failed ? 'badge-danger' : 'badge-success'}`}>
                  {record.statusCode}
                </span>
              </td>
              <td className={styles.modelCell}>
                <span className={styles.primary} title={record.model}>
                  {record.model || t('requests.unknown')}
                </span>
                {record.provider && (
                  <span className={styles.secondary}>
                    {record.provider}
                    {record.stream ? ` · ${t('requests.stream')}` : ''}
                  </span>
                )}
              </td>
              <td className={styles.mono}>
                {record.clientKeyId ? clientKeyDisplayName(record, keyNames) : '—'}
              </td>
              <td className={styles.credentialCell} title={record.credentialLabel}>
                {record.credentialLabel || '—'}
              </td>
              <td className={styles.num}>{formatTokens(record.tokens.input)}</td>
              <td className={styles.num}>{formatTokens(record.tokens.output)}</td>
              <td className={styles.num}>{formatTokens(record.tokens.cacheRead)}</td>
              <td className={styles.num}>{formatTokens(record.tokens.cacheCreation)}</td>
              <td className={styles.num}>{formatDuration(record.latencyMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.footer}>
        <span>
          {t('requests.showing', {
            shown: records.length.toLocaleString(),
            total: total.toLocaleString(),
          })}
        </span>
        {records.length < total && (
          <Button variant="secondary" size="sm" onClick={onShowMore}>
            {t('requests.show_more')}
          </Button>
        )}
      </div>
    </div>
  );
}
