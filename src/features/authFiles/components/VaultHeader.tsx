import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { IconRefreshCw, IconUpload } from '@/components/ui/icons';
import styles from './VaultHeader.module.scss';

export type VaultHeaderProps = {
  totalCount: number;
  activeCount: number;
  problemCount: number;
  loading: boolean;
  uploading: boolean;
  disableControls: boolean;
  onUpload: () => void;
  refreshingCredentials?: boolean;
  credentialRefreshDisabled?: boolean;
  onRefreshCredentials?: () => void;
};

/**
 * Page header: title, a plain-language count line and the page actions.
 * "Upload file" is the single primary action. List reloads use the shell's global refresh
 * (wired through useHeaderRefresh), so the header only carries the server-side credential refresh.
 */
export function VaultHeader(props: VaultHeaderProps) {
  const {
    totalCount,
    activeCount,
    problemCount,
    loading,
    uploading,
    disableControls,
    onUpload,
    refreshingCredentials = false,
    credentialRefreshDisabled = false,
    onRefreshCredentials,
  } = props;
  const { t } = useTranslation();

  return (
    <header className="page-header">
      <div className="page-heading">
        <h1 className="page-title">{t('auth_files.title_section')}</h1>
        <p className={`page-subtitle ${styles.meta}`}>
          <span>{t('auth_files.meta_total', { count: totalCount })}</span>
          <span className={styles.metaDot} aria-hidden="true">
            ·
          </span>
          <span className={styles.metaItem}>
            {activeCount > 0 && <span className={styles.dotSuccess} aria-hidden="true" />}
            {t('auth_files.meta_active', { count: activeCount })}
          </span>
          {problemCount > 0 && (
            <>
              <span className={styles.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={`${styles.metaItem} ${styles.metaProblem}`}>
                <span className={styles.dotDanger} aria-hidden="true" />
                {t('auth_files.meta_problem', { count: problemCount })}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="page-actions">
        {onRefreshCredentials && (
          <Button
            variant="secondary"
            onClick={onRefreshCredentials}
            disabled={
              disableControls || loading || refreshingCredentials || credentialRefreshDisabled
            }
          >
            {refreshingCredentials ? <LoadingSpinner size={14} /> : <IconRefreshCw size={16} />}
            {t('auth_files.refresh_all_button')}
          </Button>
        )}
        <Button onClick={onUpload} disabled={disableControls || uploading}>
          {uploading ? <LoadingSpinner size={14} /> : <IconUpload size={16} />}
          {t('auth_files.upload_button')}
        </Button>
      </div>
    </header>
  );
}
