import { useTranslation } from 'react-i18next';
import styles from './OAuthHeader.module.scss';

export interface OAuthHeaderProps {
  providerCount: number;
  waitingCount: number;
  addedCount: number;
}

/**
 * Shared page heading with provider, waiting and added counts.
 * Status is conveyed through localized text and static dots, not pulse loops.
 */
export function OAuthHeader({ providerCount, waitingCount, addedCount }: OAuthHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="page-header">
      <div className="page-heading">
        <h1 className="page-title">{t('nav.oauth', { defaultValue: 'OAuth' })}</h1>
        <p className={`page-subtitle ${styles.meta}`}>
          <span>{t('auth_login.meta_providers', { count: providerCount })}</span>
          {waitingCount > 0 && (
            <>
              <span className={styles.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.metaWaiting}>
                <span className={styles.pulse} aria-hidden="true" />
                {t('auth_login.meta_waiting', { count: waitingCount })}
              </span>
            </>
          )}
          {addedCount > 0 && (
            <>
              <span className={styles.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.metaAdded}>
                {t('auth_login.meta_added', { count: addedCount })}
              </span>
            </>
          )}
        </p>
      </div>
    </header>
  );
}
