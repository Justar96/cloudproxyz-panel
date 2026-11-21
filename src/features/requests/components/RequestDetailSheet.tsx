import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/ui/Sheet';
import type { RequestLogRecord } from '@/types/requestLog';
import { formatDuration } from '../format';
import styles from '../RequestsPage.module.scss';

interface RequestDetailSheetProps {
  record: RequestLogRecord | null;
  /** Saved name or masked label of the client key. */
  keyName: string;
  onClose: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === '' || children === false || children === null || children === undefined)
    return null;
  return (
    <div className={styles.detailRow}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function RequestDetailSheet({ record, keyName, onClose }: RequestDetailSheetProps) {
  const { t, i18n } = useTranslation();
  // Keep the last record so the sheet's content stays put while it animates closed.
  const [last, setLast] = useState({ record, keyName });
  if (record && (record !== last.record || keyName !== last.keyName)) {
    setLast({ record, keyName });
  }
  const shown = record ?? last.record;
  const shownKeyName = record ? keyName : last.keyName;
  const tokens = shown?.tokens;
  const count = (value: number | null | undefined) =>
    value === null || value === undefined ? '' : value.toLocaleString();

  return (
    <Sheet
      open={Boolean(record)}
      onClose={onClose}
      size="md"
      eyebrow={t('requests.detail_eyebrow')}
      title={shown?.model || t('requests.unknown')}
      description={
        shown
          ? new Date(shown.timestamp).toLocaleString(i18n.language, {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })
          : undefined
      }
    >
      {shown && tokens && (
        <div className={styles.detail}>
          <section>
            <h3 className={styles.detailHeading}>{t('requests.detail_request')}</h3>
            <dl className={styles.detailList}>
              <Row label={t('requests.col_status')}>
                <span className={`badge ${shown.failed ? 'badge-danger' : 'badge-success'}`}>
                  {shown.statusCode}
                </span>
              </Row>
              <Row label={t('requests.detail_model')}>{shown.model}</Row>
              <Row label={t('requests.detail_upstream_model')}>
                {shown.upstreamModel !== shown.model ? shown.upstreamModel : ''}
              </Row>
              <Row label={t('requests.detail_response_model')}>{shown.responseModel}</Row>
              <Row label={t('requests.detail_provider')}>{shown.provider}</Row>
              <Row label={t('requests.detail_endpoint')}>
                {shown.endpoint && <span className={styles.mono}>{shown.endpoint}</span>}
              </Row>
              <Row label={t('requests.detail_mode')}>
                {shown.stream ? t('requests.stream') : t('requests.non_stream')}
              </Row>
              <Row label={t('requests.detail_reasoning')}>{shown.reasoningEffort}</Row>
              <Row label={t('requests.detail_service_tier')}>{shown.serviceTier}</Row>
              <Row label={t('requests.col_latency')}>{formatDuration(shown.latencyMs)}</Row>
              <Row label={t('requests.detail_ttft')}>
                {shown.ttftMs > 0 ? formatDuration(shown.ttftMs) : ''}
              </Row>
            </dl>
          </section>

          <section>
            <h3 className={styles.detailHeading}>{t('requests.detail_tokens')}</h3>
            <dl className={styles.detailList}>
              <Row label={t('requests.col_input')}>{count(tokens.input)}</Row>
              <Row label={t('requests.col_output')}>{count(tokens.output)}</Row>
              <Row label={t('requests.detail_reasoning_tokens')}>{count(tokens.reasoning)}</Row>
              <Row label={t('requests.col_cache_read')}>{count(tokens.cacheRead)}</Row>
              <Row label={t('requests.col_cache_write')}>{count(tokens.cacheCreation)}</Row>
              <Row label={t('requests.detail_cache_write_5m')}>{count(tokens.cacheCreation5m)}</Row>
              <Row label={t('requests.detail_cache_write_1h')}>{count(tokens.cacheCreation1h)}</Row>
              <Row label={t('requests.detail_total_tokens')}>{count(tokens.total)}</Row>
            </dl>
          </section>

          <section>
            <h3 className={styles.detailHeading}>{t('requests.detail_identity')}</h3>
            <dl className={styles.detailList}>
              <Row label={t('requests.col_key')}>
                {shown.clientKeyId ? (
                  <span className={styles.mono}>
                    {shownKeyName}
                    {shownKeyName !== shown.clientKeyLabel ? ` (${shown.clientKeyLabel})` : ''}
                  </span>
                ) : (
                  ''
                )}
              </Row>
              <Row label={t('requests.col_credential')}>{shown.credentialLabel}</Row>
              <Row label={t('requests.detail_auth_type')}>{shown.authType}</Row>
              <Row label={t('requests.detail_auth_index')}>
                {shown.authIndex && <span className={styles.mono}>{shown.authIndex}</span>}
              </Row>
              <Row label={t('requests.detail_request_id')}>
                {shown.requestId && <span className={styles.mono}>{shown.requestId}</span>}
              </Row>
              <Row label={t('requests.detail_session_id')}>
                {shown.sessionId && <span className={styles.mono}>{shown.sessionId}</span>}
              </Row>
              <Row label={t('requests.detail_client_ip')}>{shown.clientIp}</Row>
              <Row label={t('requests.detail_user_agent')}>{shown.userAgent}</Row>
            </dl>
          </section>

          {shown.failed && (shown.failBody || shown.failCode) && (
            <section>
              <h3 className={styles.detailHeading}>{t('requests.detail_error')}</h3>
              {shown.failCode && <p className={styles.mono}>{shown.failCode}</p>}
              {shown.failBody && <pre className={styles.errorBody}>{shown.failBody}</pre>}
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}
