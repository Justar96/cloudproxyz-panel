/**
 * 额度卡：每个订阅凭证一张独立卡片。
 *
 * 头部（身份 + 刷新）→ 摘要（最紧额度剩余 % + 健康徽章）→ body（套餐 / 水位条）→
 * footer（重置类次要动作）。四态：
 * - idle：说明 + 「加载额度」按钮（上游直连有速率考虑，不自动拉取）；
 * - loading：双幽灵行骨架（aria-busy，文字等价视觉隐藏）；
 * - error：失败说明 + 就地「重试」；
 * - success：provider Body（穿 QuotaBody.module.scss 全页外衣）。
 */

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import type { ResolvedTheme } from '@/types';
import { resolveQuotaErrorMessage } from '@/utils/quota';
import { getQuotaDisplayName } from '@/utils/quota/identity';
import { getAuthFileIcon, getTypeLabel } from '@/features/authFiles/constants';
import { bindQuotaClasses } from '../types';
import { getQuotaProviderIcon } from '../providerIcons';
import { QUOTA_ADAPTERS, type QuotaCardState } from '../providers';
import { isQuotaRefreshDisabled, type QuotaFileEntry } from '../logic';
import type { QuotaHealth } from '../health';
import { useClaudeResetGrants } from '../providers/claude/ClaudeResetGrants';
import { ClaudeResetGrantDetails } from '../providers/claude/ClaudeResetGrantDetails';
import bodyStyles from './QuotaBody.module.scss';
import styles from './QuotaCard.module.scss';

/** 额度页全页外衣：QuotaBody 模块绑定成类型化契约（缺键在模块初始化即抛）。 */
const quotaClasses = bindQuotaClasses(bodyStyles, 'QuotaBody.module.scss');

export type QuotaCardProps = {
  entry: QuotaFileEntry;
  quota?: QuotaCardState;
  resolvedTheme: ResolvedTheme;
  canRefresh: boolean;
  resetting: boolean;
  /** One-word status for the badge; derived from the same quota state. */
  health: QuotaHealth;
  /** Lowest remaining percent across this credential's limits; null when unknown. */
  minRemaining?: number | null;
  /** Print the provider under the name; off when the surrounding UI already names it. */
  showProvider?: boolean;
  onRefresh: () => void;
  onReset: () => void;
};

export function QuotaCard(props: QuotaCardProps) {
  const {
    entry,
    quota,
    resolvedTheme,
    canRefresh,
    resetting,
    health,
    minRemaining = null,
    showProvider = true,
    onRefresh,
    onReset,
  } = props;
  const { t } = useTranslation();
  const adapter = QUOTA_ADAPTERS[entry.type];
  const file = entry.file;
  const displayName = getQuotaDisplayName(file);

  const status = quota?.status ?? 'idle';
  const loading = status === 'loading';
  const claudeReset = useClaudeResetGrants(
    file,
    entry.type === 'claude' && status !== 'idle',
    !canRefresh || loading || resetting,
    quota,
    onRefresh
  );
  const providerType =
    entry.type === 'plugin'
      ? String(file.quotaProvider ?? file.provider ?? file.type ?? 'plugin')
      : entry.type;
  const iconSrc =
    entry.type === 'plugin'
      ? getAuthFileIcon(providerType, resolvedTheme)
      : getQuotaProviderIcon(entry.type, resolvedTheme);
  const typeLabel = getTypeLabel(t, providerType);
  const errorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );
  const showReset =
    status === 'success' &&
    Boolean(adapter.resetQuota) &&
    quota !== undefined &&
    Boolean(adapter.canResetQuota?.(quota));

  const headline =
    status === 'success' && minRemaining !== null
      ? Math.round(Math.max(0, Math.min(100, minRemaining)))
      : null;
  const refreshDisabled = isQuotaRefreshDisabled(
    canRefresh,
    loading,
    resetting || claudeReset.busy
  );
  const hasFooter = status !== 'idle' && (entry.type === 'claude' || showReset);

  return (
    <article className={styles.card} data-health={health}>
      <header className={styles.head}>
        <div className={styles.identity}>
          <span className={styles.iconWrap} title={typeLabel}>
            {iconSrc ? (
              <img src={iconSrc} alt="" className={styles.icon} />
            ) : (
              <span className={styles.iconFallback}>{typeLabel.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
          <span className={styles.identityText}>
            <span className={styles.fileName} title={displayName}>
              {displayName}
            </span>
            {showProvider && <span className={styles.typeLabel}>{typeLabel}</span>}
          </span>
        </div>
        {status !== 'idle' && (
          <Button
            variant="ghost"
            size="sm"
            className={`${styles.action} ${styles.iconAction}`}
            onClick={onRefresh}
            disabled={refreshDisabled}
            title={t('auth_files.quota_refresh_hint')}
            aria-label={t('auth_files.quota_refresh_single')}
          >
            <IconRefreshCw
              size={16}
              aria-hidden="true"
              className={loading ? styles.spinning : undefined}
            />
          </Button>
        )}
      </header>

      {status === 'idle' ? (
        <div className={styles.idlePanel}>
          <p className={styles.idleHint}>{t('quota_management.not_loaded_desc')}</p>
          <Button variant="secondary" size="sm" onClick={onRefresh} disabled={!canRefresh}>
            {t('quota_management.load_quota')}
          </Button>
        </div>
      ) : (
        <>
          <div className={styles.summary}>
            {headline !== null && (
              <div className={styles.headline}>
                <span className={styles.headlineValue}>
                  {headline}
                  <span className={styles.headlineUnit}>%</span>
                </span>
                <span className={styles.headlineHint}>{t('quota_management.headline_hint')}</span>
              </div>
            )}
            <span className={styles.health} data-health={health}>
              <span className={styles.healthDot} aria-hidden="true" />
              {t(`quota_management.health_${health}`)}
            </span>
          </div>

          <div className={styles.body}>
            {loading ? (
              <div className={styles.skeleton} aria-busy="true">
                <span className={styles.srOnly}>{t(`${adapter.i18nPrefix}.loading`)}</span>
                {[0, 1].map((row) => (
                  <div key={row} className={styles.skeletonRow} aria-hidden="true">
                    <span className={styles.skeletonLabel} />
                    <span className={styles.skeletonTrack} />
                  </div>
                ))}
              </div>
            ) : status === 'error' ? (
              <div className={styles.errorPanel} role="alert">
                <p className={styles.errorText}>
                  {t(`${adapter.i18nPrefix}.load_failed`, { message: errorMessage })}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={onRefresh}
                  disabled={refreshDisabled}
                >
                  {t('quota_management.retry')}
                </Button>
              </div>
            ) : quota ? (
              <adapter.Body quota={quota} classes={quotaClasses} />
            ) : null}
            {entry.type === 'claude' && status === 'success' && (
              <>
                <ClaudeResetGrantDetails grants={claudeReset.grants} classes={quotaClasses} />
                {claudeReset.message && (
                  <div role="status" className={quotaClasses.codexResetCreditsError}>
                    {t(`claude_reset.${claudeReset.message}`)}
                  </div>
                )}
              </>
            )}
          </div>

          {hasFooter && (
            <footer className={styles.footer}>
              {entry.type === 'claude' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.action}
                  disabled={claudeReset.blocked}
                  onClick={claudeReset.confirm}
                  title={t(`claude_reset.${claudeReset.buttonLabel}`)}
                >
                  <IconRefreshCw
                    size={14}
                    aria-hidden="true"
                    className={claudeReset.busy ? styles.spinning : undefined}
                  />
                  {t(`claude_reset.${claudeReset.buttonLabel}`)}
                </Button>
              )}
              {showReset && (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.action}
                  onClick={onReset}
                  disabled={!canRefresh || loading || resetting}
                  title={t('codex_quota.reset_button')}
                >
                  <IconRefreshCw
                    size={14}
                    aria-hidden="true"
                    className={resetting ? styles.spinning : undefined}
                  />
                  {t('codex_quota.reset_button')}
                </Button>
              )}
              {entry.type === 'claude' && status === 'success' && claudeReset.count !== null && (
                <span className={styles.footerMeta}>
                  {t('claude_reset.remaining')}
                  <span className={styles.footerMetaValue}>{claudeReset.count}</span>
                </span>
              )}
            </footer>
          )}
        </>
      )}
    </article>
  );
}
