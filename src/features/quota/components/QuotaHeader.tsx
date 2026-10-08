import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import styles from './QuotaHeader.module.scss';

export type QuotaHeaderProps = {
  refreshing: boolean;
  disableControls: boolean;
  onRefreshAll: () => void;
};

/**
 * 额度页头部：h1 + 一句说明 + 「刷新全部」主按钮。计数与健康状态在下方的概览条里。
 */
export function QuotaHeader({ refreshing, disableControls, onRefreshAll }: QuotaHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="page-header">
      <div className="page-heading">
        <h1 className="page-title">{t('quota_management.title')}</h1>
        <p className="page-subtitle">{t('quota_management.subtitle')}</p>
      </div>
      <div className="page-actions">
        <Button onClick={onRefreshAll} disabled={disableControls || refreshing}>
          <IconRefreshCw
            size={16}
            aria-hidden="true"
            className={refreshing ? styles.spinning : undefined}
          />
          {t('quota_management.refresh_all_credentials')}
        </Button>
      </div>
    </header>
  );
}
