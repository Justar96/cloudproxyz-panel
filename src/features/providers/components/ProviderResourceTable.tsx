import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconEye, IconPencil, IconTrash2 } from '@/components/ui/icons';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { ProviderStatusBar } from '@/components/providers/ProviderStatusBar';
import {
  getOpenAIProviderRecentStatusData,
  getOpenAIProviderTotalStats,
  getProviderRecentStatusData,
  getProviderTotalStats,
  getProviderUsageKey,
  type ProviderRecentUsageMap,
} from '@/components/providers/utils';
import type { OpenAIProviderConfig } from '@/types';
import type { StatusBarData } from '@/utils/recentRequests';
import type { ProviderResource } from '../types';
import { isMultiProtocolSponsorBrand } from '../sponsorDefinitions';
import styles from './ProviderResourceTable.module.scss';
import statusBarStyles from './providerStatusBar.module.scss';

interface ProviderResourceTableProps {
  resources: ProviderResource[];
  selectedId?: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
}

const isSponsorResource = (resource: ProviderResource): boolean =>
  isMultiProtocolSponsorBrand(resource.brand);

const resolveStatusBarData = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): StatusBarData => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderRecentStatusData(resource.raw as OpenAIProviderConfig, usageByProvider);
  }
  return getProviderRecentStatusData(
    usageByProvider,
    getProviderUsageKey(resource.brand),
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

const resolveTotalStats = (
  resource: ProviderResource,
  usageByProvider: ProviderRecentUsageMap
): { success: number; failure: number } => {
  if (resource.brand === 'openaiCompatibility') {
    return getOpenAIProviderTotalStats(resource.raw as OpenAIProviderConfig, usageByProvider);
  }
  return getProviderTotalStats(
    usageByProvider,
    getProviderUsageKey(resource.brand),
    resource.apiKey ?? undefined,
    resource.baseUrl ?? undefined
  );
};

export function ProviderResourceTable({
  resources,
  selectedId,
  disableMutations,
  usageByProvider,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
}: ProviderResourceTableProps) {
  const { t } = useTranslation();

  const renderMetric = (key: string, label: string, value: number) => (
    <span key={key} className={styles.metric}>
      <span className={styles.metricValue}>{value}</span>
      <span className={styles.metricLabel}>{label}</span>
    </span>
  );

  const renderFlagTag = (key: string, label: string) => (
    <span key={key} className={styles.flagTag}>
      {label}
    </span>
  );

  const renderProtocolSummary = (r: ProviderResource) =>
    (r.flags.protocols ?? [])
      .map((protocol) => t(`providersPage.sponsor.protocols.${protocol}`))
      .join(' / ');

  const renderModelsSummary = (r: ProviderResource) => {
    const items: ReactNode[] = [];
    if (isSponsorResource(r)) {
      (r.flags.protocols ?? []).forEach((protocol) => {
        items.push(renderFlagTag(protocol, t(`providersPage.sponsor.protocols.${protocol}`)));
      });
      return <div className={styles.metricsCell}>{items}</div>;
    }
    if (r.brand === 'openaiCompatibility') {
      items.push(
        renderMetric('models', t('providersPage.table.metrics.models'), r.modelCount),
        renderMetric('keys', t('providersPage.table.metrics.keys'), r.apiKeyEntryCount),
        renderMetric('headers', t('providersPage.table.metrics.headers'), r.headerCount)
      );
    } else {
      items.push(
        renderMetric('models', t('providersPage.table.metrics.models'), r.modelCount),
        renderMetric('headers', t('providersPage.table.metrics.headers'), r.headerCount)
      );
      if ((r.brand === 'codex' || r.brand === 'xai') && r.flags.websockets) {
        items.push(renderFlagTag('ws', t('providersPage.table.websocketsTag')));
      }
      if (r.brand === 'claude' && r.flags.cloakEnabled) {
        items.push(renderFlagTag('cloak', t('providersPage.table.cloakTag')));
      }
      if (r.brand === 'claude' && r.flags.claudeCodeCliProfile) {
        items.push(renderFlagTag('cli-profile', t('providersPage.table.cliProfileTag')));
      }
    }
    return <div className={styles.metricsCell}>{items}</div>;
  };

  const renderStatus = (r: ProviderResource) => (
    <span className={styles.statusLabel}>
      <span
        className={`${styles.statusDot} ${r.disabled ? styles.statusDotAttention : styles.statusDotSuccess}`}
        aria-hidden="true"
      />
      {r.disabled ? t('providersPage.status.disabled') : t('providersPage.status.active')}
    </span>
  );

  const renderBaseUrl = (r: ProviderResource) => {
    if (isSponsorResource(r)) {
      return <span className={styles.baseUrl}>{renderProtocolSummary(r)}</span>;
    }
    if (r.brand === 'claude' && !r.baseUrl) {
      return (
        <span className={styles.baseUrl}>
          https://api.anthropic.com {t('providersPage.status.defaultSuffix')}
        </span>
      );
    }
    return (
      <span className={`${styles.baseUrl} ${r.baseUrl ? '' : styles.muted}`.trim()}>
        {r.baseUrl ?? t('providersPage.status.notSet')}
      </span>
    );
  };

  const renderPrimary = (r: ProviderResource) => {
    let name: ReactNode;
    let sub: ReactNode;
    if (isSponsorResource(r)) {
      name = <span className={styles.primaryName}>{r.name ?? r.identifier}</span>;
      sub = r.apiKeyPreview ?? t('providersPage.status.notConfigured');
    } else if (r.brand === 'openaiCompatibility') {
      const extra = r.apiKeyEntryCount > 1 ? ` · +${r.apiKeyEntryCount - 1}` : '';
      name = <span className={styles.primaryName}>{r.name ?? r.identifier}</span>;
      sub = (r.apiKeyPreview ?? '—') + extra;
    } else {
      name = (
        <span className={`${styles.primaryName} ${styles.primaryKey}`}>
          {r.apiKeyPreview ?? '—'}
        </span>
      );
      sub = r.authIndex ? `auth: ${r.authIndex}` : null;
    }
    return (
      <div className={styles.primaryCell}>
        <div className={styles.primaryLine}>
          {name}
          {r.prefix ? (
            <span className={styles.chip}>
              <span className={styles.chipLabel}>{t('providersPage.table.prefix')}</span>
              {r.prefix}
            </span>
          ) : null}
        </div>
        {renderBaseUrl(r)}
        {sub ? <span className={styles.primarySub}>{sub}</span> : null}
      </div>
    );
  };

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead className={styles.head}>
          <tr>
            <th scope="col" className={styles.colKey}>
              {t('providersPage.table.key')}
            </th>
            <th scope="col" className={styles.colModels}>
              {t('providersPage.table.models')}
            </th>
            <th scope="col" className={styles.colStatus}>
              {t('providersPage.table.status')}
            </th>
            <th scope="col" className={styles.colActions}>
              <span className={styles.srOnly}>{t('providersPage.table.actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const selected = resource.id === selectedId;
            return (
              <tr
                key={resource.id}
                className={[
                  styles.row,
                  selected ? styles.rowSelected : '',
                  resource.disabled ? styles.rowDisabled : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <td className={styles.cellKey}>{renderPrimary(resource)}</td>
                <td className={styles.cellModels}>{renderModelsSummary(resource)}</td>
                <td className={styles.cellStatus}>
                  <div className={styles.statusCell}>
                    {renderStatus(resource)}
                    {usageByProvider && !isSponsorResource(resource) ? (
                      <>
                        {(() => {
                          const stats = resolveTotalStats(resource, usageByProvider);
                          return (
                            <span className={styles.stats}>
                              <span className={styles.stat}>
                                {t('stats.success')}{' '}
                                <span className={styles.statValue}>{stats.success}</span>
                              </span>
                              <span
                                className={[
                                  styles.stat,
                                  stats.failure > 0 ? styles.statFailure : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                              >
                                {t('stats.failure')}{' '}
                                <span className={styles.statValue}>{stats.failure}</span>
                              </span>
                            </span>
                          );
                        })()}
                        <div className={styles.statusBarWrap}>
                          <ProviderStatusBar
                            statusData={resolveStatusBarData(resource, usageByProvider)}
                            styles={statusBarStyles}
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </td>
                <td className={styles.cellActions}>
                  <div className={styles.actions}>
                    {onToggleDisabled ? (
                      <span className={styles.toggleWrap} onClick={(e) => e.stopPropagation()}>
                        <ToggleSwitch
                          checked={!resource.disabled}
                          disabled={disableMutations}
                          onChange={(value) => onToggleDisabled(resource, !value)}
                          ariaLabel={
                            resource.disabled
                              ? t('providersPage.actions.enable')
                              : t('providersPage.actions.disable')
                          }
                        />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={t('providersPage.actions.view')}
                      title={t('providersPage.actions.view')}
                      onClick={(e) => {
                        e.stopPropagation();
                        onView(resource);
                      }}
                    >
                      <IconEye size={16} />
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      aria-label={t('providersPage.actions.edit')}
                      title={t('providersPage.actions.edit')}
                      disabled={disableMutations}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(resource);
                      }}
                    >
                      <IconPencil size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                      aria-label={t('providersPage.actions.delete')}
                      title={t('providersPage.actions.delete')}
                      disabled={disableMutations}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(resource);
                      }}
                    >
                      <IconTrash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
