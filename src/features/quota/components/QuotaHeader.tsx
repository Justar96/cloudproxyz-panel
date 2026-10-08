import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import { useCountUp } from '@/hooks/motion';
import styles from './QuotaHeader.module.scss';

export type QuotaHeaderProps = {
  totalCount: number;
  loadedCount: number;
  attentionCount: number;
  refreshing: boolean;
  disableControls: boolean;
  onRefreshAll: () => void;
};

/**
 * 额度页头部：h1 + 一行中性计数副标题 + 「刷新全部」主按钮。
 * 只有「需关注」（额度读取失败）带状态色：attention 圆点 + 文字，不单靠颜色。
 *
 * 入场：三处 `data-reveal` 交给页面壳的 useRevealGroup 统一编排
 * （标题 0ms → meta 70ms → 动作 140ms → 工具栏 210ms）。
 */
export function QuotaHeader(props: QuotaHeaderProps) {
  const { totalCount, loadedCount, attentionCount, refreshing, disableControls, onRefreshAll } =
    props;
  const { t } = useTranslation();
  // 批量结果陆续落地时，「已加载」是页面上唯一滚动的数字
  const displayLoadedCount = useCountUp(loadedCount);

  return (
    <header className="page-header">
      <div className="page-heading">
        <h1 className="page-title" data-reveal>
          {t('quota_management.title')}
        </h1>
        <p className={`page-subtitle ${styles.meta}`} data-reveal>
          <span>{t('quota_management.meta_credentials', { count: totalCount })}</span>
          <span className={styles.metaDot} aria-hidden="true">
            ·
          </span>
          <span>{t('quota_management.meta_loaded', { count: displayLoadedCount })}</span>
          {attentionCount > 0 && (
            <>
              <span className={styles.metaDot} aria-hidden="true">
                ·
              </span>
              <span className={styles.metaAttention}>
                <span className={styles.attentionDot} aria-hidden="true" />
                {t('quota_management.meta_attention', { count: attentionCount })}
              </span>
            </>
          )}
        </p>
      </div>
      <div className="page-actions" data-reveal>
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
