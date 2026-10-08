import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconLoader2, IconPlus, IconRefreshCw } from '@/components/ui/icons';
import styles from './ProviderHeaderCard.module.scss';

interface ProviderHeaderCardProps {
  title?: string;
  subtitle?: string;
  totalActive: number;
  totalResources: number;
  providerFamilies: number;
  updatedAtLabel: string;
  isFetching?: boolean;
  isNewDisabled?: boolean;
  showNewAction?: boolean;
  showSummary?: boolean;
  newLabel?: string;
  onRefresh: () => void;
  onNew: () => void;
}

export function ProviderHeaderCard({
  title,
  subtitle,
  totalActive,
  totalResources,
  providerFamilies,
  updatedAtLabel,
  isFetching = false,
  isNewDisabled = false,
  showNewAction = true,
  showSummary = true,
  newLabel,
  onRefresh,
  onNew,
}: ProviderHeaderCardProps) {
  const { t } = useTranslation();
  const refreshLabel = isFetching
    ? t('providersPage.actions.syncing')
    : t('providersPage.actions.refresh');

  return (
    <header className="page-header">
      <div className="page-heading">
        <h1 className="page-title">{title ?? t('providersPage.header.title')}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        {showSummary ? (
          <p className={styles.meta}>
            <span className={styles.metaItem}>
              <span
                className={[styles.dot, totalActive > 0 ? styles.dotActive : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              />
              {t('providersPage.header.activeResources', {
                active: totalActive,
                total: totalResources,
              })}
            </span>
            <span className={styles.metaItem}>
              {t('providersPage.header.providerFamilies', { count: providerFamilies })}
            </span>
            <span className={styles.metaItem}>
              {t('providersPage.header.updatedAt', { time: updatedAtLabel })}
            </span>
          </p>
        ) : null}
      </div>
      <div className="page-actions">
        <Button
          variant={showNewAction ? 'ghost' : 'secondary'}
          onClick={onRefresh}
          disabled={isFetching}
          aria-label={refreshLabel}
        >
          <span className={`${styles.btnIcon} ${isFetching ? styles.spin : ''}`.trim()}>
            {isFetching ? <IconLoader2 size={16} /> : <IconRefreshCw size={16} />}
          </span>
          {refreshLabel}
        </Button>
        {showNewAction ? (
          <Button variant="primary" onClick={onNew} disabled={isNewDisabled}>
            <IconPlus size={16} />
            {newLabel ?? t('providersPage.actions.new')}
          </Button>
        ) : null}
      </div>
    </header>
  );
}
