import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  IconBot,
  IconChevronLeft,
  IconFileText,
  IconSidebarConfig,
  IconSidebarLogs,
  IconSidebarQuota,
  IconSidebarSystem,
} from '@/components/ui/icons';
import { useAuthStore } from '@/stores';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { formatCompactNumber, formatDateValue, formatPercent } from '@/utils/format';
import { useDashboardOverview } from './hooks/useDashboardOverview';
import { Meter } from './components/Meter';
import { Sparkline } from './components/Sparkline';
import { ThroughputChart } from './components/ThroughputChart';
import { providerLabel, splitWindowMinutes, toneForSuccessRate } from './utils';
import styles from './dashboard.module.scss';

const DASH = '—';

type StatusTone = 'success' | 'attention' | 'danger' | 'neutral';

/** 大数字：六位以内用千分位，再往上压缩，避免撑破 KPI 单元格 */
const formatHeadline = (value: number): string =>
  value < 100_000 ? value.toLocaleString() : formatCompactNumber(value);

/** 状态点：颜色只是辅助通道，旁边总有文字标签 */
function StatusDot({ tone }: { tone: StatusTone }) {
  return <span className={styles.dot} data-tone={tone} aria-hidden="true" />;
}

/** 图标库没有右箭头，镜像左箭头（RTL 下由 CSS 再翻回） */
function Chevron() {
  return <IconChevronLeft size={14} className={styles.chevron} aria-hidden="true" />;
}

interface KpiCell {
  key: string;
  label: string;
  value: string;
  meta: ReactNode;
}

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const serverVersion = useAuthStore((state) => state.serverVersion);
  const serverBuildDate = useAuthStore((state) => state.serverBuildDate);

  const { connectionStatus, connected, config, counts, traffic, providers, credentials, refresh } =
    useDashboardOverview();

  useHeaderRefresh(refresh, connected);

  const windowLabel = useMemo(() => {
    if (traffic.windowMinutes <= 0) return DASH;
    const { hours, minutes } = splitWindowMinutes(traffic.windowMinutes);
    if (hours === 0) return t('dashboard.window_m', { minutes });
    if (minutes === 0) return t('dashboard.window_h', { hours });
    return t('dashboard.window_hm', { hours, minutes });
  }, [traffic.windowMinutes, t]);
  const hasWindow = traffic.windowMinutes > 0;

  const routingStrategy = useMemo(() => {
    const raw = config?.routingStrategy?.trim() ?? '';
    if (!raw) return DASH;
    if (raw === 'round-robin') return t('basic_settings.routing_strategy_round_robin');
    if (raw === 'weighted-round-robin') {
      return t('basic_settings.routing_strategy_weighted_round_robin');
    }
    if (raw === 'fill-first') return t('basic_settings.routing_strategy_fill_first');
    return raw;
  }, [config?.routingStrategy, t]);

  const unknownProviderLabel = t('dashboard.provider_unknown');
  const successRateTone = toneForSuccessRate(traffic.successRate);

  /* ---------- 页头状态 ---------- */
  const connectionTone: StatusTone =
    connectionStatus === 'connected'
      ? 'success'
      : connectionStatus === 'connecting'
        ? 'attention'
        : 'danger';
  const connectionLabel = t(
    connectionStatus === 'connected'
      ? 'common.connected'
      : connectionStatus === 'connecting'
        ? 'common.connecting'
        : 'common.disconnected'
  );
  const versionLabel = useMemo(() => {
    const raw = serverVersion?.trim().replace(/^[vV]+/, '') ?? '';
    if (!raw) return null;
    // 只给数字版本号加 v 前缀，避免出现 "vdev"
    return /^\d/.test(raw) ? `v${raw}` : raw;
  }, [serverVersion]);

  let statusSentence: string;
  if (!connected) {
    statusSentence =
      connectionStatus === 'connecting'
        ? t('dashboard.status_connecting', { defaultValue: 'Connecting to the server…' })
        : t('dashboard.status_offline', { defaultValue: 'Not connected to the server.' });
  } else if (traffic.total === 0 || traffic.successRate === null) {
    statusSentence = t('dashboard.status_idle', {
      defaultValue: 'No requests in the current window.',
    });
  } else if (successRateTone === 'critical') {
    statusSentence = t('dashboard.status_failing', {
      defaultValue: 'Many requests are failing. Check providers and logs.',
    });
  } else if (successRateTone === 'warning') {
    statusSentence = t('dashboard.status_degraded', {
      defaultValue: 'Some requests are failing. Check providers and logs.',
    });
  } else {
    statusSentence = t('dashboard.status_healthy', {
      defaultValue: 'Requests are succeeding over the last {{window}}.',
      window: windowLabel,
    });
  }

  /* ---------- KPI ---------- */
  const rateNeedsAttention = successRateTone === 'critical' || successRateTone === 'warning';
  const successMeta: ReactNode = rateNeedsAttention ? (
    <span className={styles.metaStatus}>
      <StatusDot tone={successRateTone === 'critical' ? 'danger' : 'attention'} />
      <span className={successRateTone === 'critical' ? styles.textDanger : styles.textAttention}>
        {successRateTone === 'critical'
          ? t('dashboard.rate_failing', { defaultValue: 'Failing' })
          : t('dashboard.rate_degraded', { defaultValue: 'Degraded' })}
      </span>
    </span>
  ) : traffic.total > 0 ? (
    t('dashboard.stat_success_hint', { total: traffic.total.toLocaleString() })
  ) : (
    t('status_bar.no_requests')
  );

  const notServing = credentials ? credentials.disabled + credentials.unavailable : 0;
  const credentialsHint = credentials
    ? t('dashboard.stat_credentials_hint', { active: credentials.active, disabled: notServing })
    : t('dashboard.stat_credentials_empty');
  const credentialsMeta: ReactNode =
    notServing > 0 ? (
      <span className={styles.metaStatus}>
        <StatusDot tone="attention" />
        <span className={styles.textAttention}>{credentialsHint}</span>
      </span>
    ) : (
      credentialsHint
    );

  const kpiCells: KpiCell[] = [
    {
      key: 'requests',
      label: t('dashboard.kpi_requests', { defaultValue: 'Requests' }),
      value: connected ? formatHeadline(traffic.total) : DASH,
      meta: hasWindow
        ? t('dashboard.kpi_window', { defaultValue: 'Last {{window}}', window: windowLabel })
        : t('dashboard.kpi_no_window', { defaultValue: 'No traffic yet' }),
    },
    {
      key: 'success',
      label: t('dashboard.success_rate'),
      value: traffic.successRate === null ? DASH : formatPercent(traffic.successRate),
      meta: successMeta,
    },
    {
      key: 'credentials',
      label: t('dashboard.stat_credentials'),
      value: credentials ? credentials.total.toLocaleString() : DASH,
      meta: credentialsMeta,
    },
    {
      key: 'providerKeys',
      label: t('dashboard.stat_provider_keys'),
      value: counts.providerKeys === null ? DASH : counts.providerKeys.toLocaleString(),
      meta: t('dashboard.stat_provider_keys_hint'),
    },
    {
      key: 'models',
      label: t('dashboard.stat_models'),
      value: counts.models === null ? DASH : counts.models.toLocaleString(),
      meta: t('dashboard.stat_models_hint'),
    },
  ];

  /* ---------- 运行时 ---------- */
  const runtimeRows: Array<{ label: string; value: string; mono?: boolean }> = [
    { label: t('dashboard.runtime_routing'), value: routingStrategy },
    { label: t('dashboard.runtime_retry'), value: String(config?.requestRetry ?? 0) },
    {
      label: t('dashboard.runtime_management_keys'),
      value: counts.managementKeys === null ? DASH : String(counts.managementKeys),
    },
    { label: t('dashboard.runtime_version'), value: serverVersion?.trim() || DASH },
    {
      label: t('dashboard.runtime_build'),
      value: formatDateValue(serverBuildDate, i18n.language) || DASH,
    },
    { label: t('dashboard.runtime_proxy'), value: config?.proxyUrl?.trim() || DASH, mono: true },
  ];

  const runtimeToggles = config
    ? [
        { label: t('dashboard.runtime_debug'), on: Boolean(config.debug) },
        { label: t('dashboard.runtime_file_logging'), on: Boolean(config.loggingToFile) },
        { label: t('dashboard.runtime_request_log'), on: Boolean(config.requestLog) },
        { label: t('dashboard.runtime_ws_auth'), on: Boolean(config.wsAuth) },
        { label: t('dashboard.runtime_model_prefix'), on: Boolean(config.forceModelPrefix) },
      ]
    : [];

  const shortcuts = [
    {
      to: '/auth-files',
      icon: <IconFileText size={16} />,
      title: t('nav.auth_files'),
      description: t('dashboard.cta_auth_files_desc'),
    },
    {
      to: '/quota',
      icon: <IconSidebarQuota size={16} />,
      title: t('nav.quota_management'),
      description: t('dashboard.cta_quota_desc'),
    },
    {
      to: '/config',
      icon: <IconSidebarConfig size={16} />,
      title: t('nav.config_management'),
      description: t('dashboard.cta_config_desc'),
    },
    {
      to: '/ai-providers',
      icon: <IconBot size={16} />,
      title: t('nav.ai_providers'),
      description: t('dashboard.cta_providers_desc'),
    },
    {
      to: '/logs',
      icon: <IconSidebarLogs size={16} />,
      title: t('nav.logs'),
      description: t('dashboard.cta_logs_desc'),
    },
    {
      to: '/system',
      icon: <IconSidebarSystem size={16} />,
      title: t('nav.system_info'),
      description: t('dashboard.cta_system_desc'),
    },
  ];

  return (
    <div className={`page ${styles.dashboard}`}>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">{t('nav.dashboard')}</h1>
          <p className={`page-subtitle ${styles.statusLine}`}>
            <span className={styles.connection}>
              <StatusDot tone={connectionTone} />
              <span className={styles.connectionLabel}>{connectionLabel}</span>
            </span>
            {versionLabel && (
              <>
                <span className={styles.sep} aria-hidden="true">
                  ·
                </span>
                <span className={styles.version}>{versionLabel}</span>
              </>
            )}
            <span className={`${styles.sep} ${styles.sepBeforeSentence}`} aria-hidden="true">
              ·
            </span>
            <span className={styles.statusSentence}>{statusSentence}</span>
          </p>
        </div>
        <div className="page-actions">
          <Link to="/logs" className="btn btn-secondary">
            {t('dashboard.cta_inspect_logs')}
          </Link>
          <Link to="/ai-providers" className="btn btn-primary">
            {t('dashboard.cta_manage_providers')}
          </Link>
        </div>
      </header>

      {/* ---------- KPI strip ---------- */}
      <section className={styles.kpiStrip} aria-label={t('dashboard.stats_aria')}>
        <dl className={styles.kpiList}>
          {kpiCells.map((cell) => (
            <div key={cell.key} className={styles.kpiCell}>
              <dt className={styles.kpiLabel}>{cell.label}</dt>
              <dd className={styles.kpiValue}>{cell.value}</dd>
              <dd className={styles.kpiMeta}>{cell.meta}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- Traffic ---------- */}
      <section className={styles.card} aria-labelledby="dashboard-traffic-title">
        <header className={styles.cardHeader}>
          <div className={styles.cardHeading}>
            <h2 id="dashboard-traffic-title" className={styles.cardTitle}>
              {t('dashboard.traffic_heading', { defaultValue: 'Requests over time' })}
            </h2>
            {hasWindow && traffic.total > 0 && (
              <p className={styles.cardDescription}>
                {t('dashboard.traffic_caption', {
                  defaultValue: 'Successes and failures per 10-minute bucket, last {{window}}.',
                  window: windowLabel,
                })}
              </p>
            )}
          </div>
        </header>
        <ThroughputChart traffic={traffic} />
      </section>

      <div className={styles.grid}>
        {/* ---------- Providers ---------- */}
        <section
          className={`${styles.card} ${styles.spanWide}`}
          aria-labelledby="dashboard-fleet-title"
        >
          <header className={styles.cardHeader}>
            <div className={styles.cardHeading}>
              <h2 id="dashboard-fleet-title" className={styles.cardTitle}>
                {t('dashboard.fleet_heading', { defaultValue: 'Traffic by provider' })}
              </h2>
              <p className={styles.cardDescription}>{t('dashboard.fleet_description')}</p>
            </div>
          </header>
          {providers.length === 0 ? (
            <p className={styles.emptyNote}>{t('dashboard.fleet_empty')}</p>
          ) : (
            <ul className={styles.fleetList}>
              {providers.map((provider) => {
                const name = providerLabel(provider.id, unknownProviderLabel);
                return (
                  <li key={provider.id} className={styles.fleetRow}>
                    <div className={styles.fleetIdentity}>
                      <span className={styles.fleetName}>{name}</span>
                      <span className={styles.fleetMeta}>
                        {t('dashboard.fleet_credentials', { value: provider.credentials })}
                      </span>
                    </div>
                    <Sparkline
                      points={provider.buckets.map((bucket) => bucket.success + bucket.failed)}
                      ariaLabel={t('dashboard.fleet_spark_label', { provider: name })}
                      className={styles.fleetSpark}
                    />
                    <div className={styles.fleetNumbers}>
                      <span className={styles.fleetTotal}>{provider.total.toLocaleString()}</span>
                      <span className={styles.fleetTotalLabel}>
                        {t('dashboard.fleet_requests')}
                      </span>
                    </div>
                    <div className={styles.fleetRate}>
                      <span className={styles.fleetRateValue}>
                        {provider.successRate === null ? DASH : formatPercent(provider.successRate)}
                      </span>
                      <Meter
                        value={provider.successRate}
                        ariaLabel={t('dashboard.success_rate')}
                        className={styles.fleetMeter}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ---------- Credential health ---------- */}
        <section className={styles.card} aria-labelledby="dashboard-health-title">
          <header className={styles.cardHeader}>
            <h2 id="dashboard-health-title" className={styles.cardTitle}>
              {t('dashboard.health_title')}
            </h2>
            <Link to="/auth-files" className={styles.cardLink}>
              {t('dashboard.health_link')}
              <Chevron />
            </Link>
          </header>
          {!credentials || credentials.total === 0 ? (
            <p className={styles.emptyNote}>{t('dashboard.health_empty')}</p>
          ) : (
            <>
              <div className={styles.healthBar} aria-hidden="true">
                {credentials.active > 0 && (
                  <span
                    className={styles.healthSegment}
                    data-tone="success"
                    style={{ flexGrow: credentials.active }}
                  />
                )}
                {credentials.unavailable > 0 && (
                  <span
                    className={styles.healthSegment}
                    data-tone="attention"
                    style={{ flexGrow: credentials.unavailable }}
                  />
                )}
                {credentials.disabled > 0 && (
                  <span
                    className={styles.healthSegment}
                    data-tone="neutral"
                    style={{ flexGrow: credentials.disabled }}
                  />
                )}
              </div>
              <dl className={styles.rows}>
                <div className={styles.row}>
                  <dt className={styles.rowLabel}>
                    <StatusDot tone="success" />
                    {t('dashboard.health_active')}
                  </dt>
                  <dd className={styles.rowValue}>{credentials.active.toLocaleString()}</dd>
                </div>
                <div className={styles.row}>
                  <dt className={styles.rowLabel}>
                    <StatusDot tone={credentials.unavailable > 0 ? 'attention' : 'neutral'} />
                    {t('dashboard.health_unavailable')}
                  </dt>
                  <dd className={styles.rowValue}>{credentials.unavailable.toLocaleString()}</dd>
                </div>
                <div className={styles.row}>
                  <dt className={styles.rowLabel}>
                    <StatusDot tone="neutral" />
                    {t('dashboard.health_disabled')}
                  </dt>
                  <dd className={styles.rowValue}>{credentials.disabled.toLocaleString()}</dd>
                </div>
              </dl>
              {credentials.byType.length > 0 && (
                <div className={styles.typeBreakdown}>
                  <h3 className={styles.subTitle}>{t('dashboard.health_by_type')}</h3>
                  <ul className={styles.chipList}>
                    {credentials.byType.map((entry) => (
                      <li key={entry.type} className={styles.chip}>
                        {providerLabel(entry.type, unknownProviderLabel)}
                        <span className={styles.chipCount}>{entry.count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {/* ---------- Runtime ---------- */}
        <section
          className={`${styles.card} ${styles.spanWide}`}
          aria-labelledby="dashboard-runtime-title"
        >
          <header className={styles.cardHeader}>
            <h2 id="dashboard-runtime-title" className={styles.cardTitle}>
              {t('dashboard.runtime_title')}
            </h2>
            <Link to="/config" className={styles.cardLink}>
              {t('dashboard.runtime_link')}
              <Chevron />
            </Link>
          </header>
          <div className={styles.runtimeColumns}>
            <dl className={styles.rows}>
              {runtimeRows.map((row) => (
                <div key={row.label} className={styles.row}>
                  <dt className={styles.rowLabel}>{row.label}</dt>
                  <dd
                    className={`${styles.rowValue} ${row.mono && row.value !== DASH ? styles.rowMono : ''}`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            {runtimeToggles.length > 0 && (
              <dl className={styles.rows}>
                {runtimeToggles.map((toggle) => (
                  <div key={toggle.label} className={styles.row}>
                    <dt className={styles.rowLabel}>{toggle.label}</dt>
                    <dd className={styles.rowValue}>
                      <span className={styles.toggleState} data-on={toggle.on || undefined}>
                        {toggle.on ? t('common.yes') : t('common.no')}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </section>

        {/* ---------- Shortcuts ---------- */}
        <nav className={styles.card} aria-labelledby="dashboard-shortcuts-title">
          <header className={styles.cardHeader}>
            <h2 id="dashboard-shortcuts-title" className={styles.cardTitle}>
              {t('dashboard.shortcuts_title', { defaultValue: 'Shortcuts' })}
            </h2>
          </header>
          <ul className={styles.shortcutList}>
            {shortcuts.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={styles.shortcut}>
                  <span className={styles.shortcutIcon} aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={styles.shortcutText}>
                    <span className={styles.shortcutTitle}>{item.title}</span>
                    <span className={styles.shortcutDescription}>{item.description}</span>
                  </span>
                  <Chevron />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
