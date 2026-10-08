import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconRefreshCw } from '@/components/ui/icons';
import type { HeaderMetaSegment } from '../uiState';
import styles from './ConfigHeader.module.scss';

export type ConfigHeaderProps = {
  /** 副标题状态行的段落序列（uiState.buildHeaderMeta 的产物）。 */
  meta: HeaderMetaSegment[];
  reloadDisabled: boolean;
  reloading: boolean;
  onReload: () => void;
  /** 页头动作区的额外控件（可视化/源码切换）。 */
  extraActions?: ReactNode;
};

/**
 * 配置面板页头：h1 + 状态副标题（字段数 · 同步/未保存/错误）+ 动作区（模式切换、重载）。
 * 保存动作不在页头常驻 —— 由 FloatingSaveBar 在 dirty 时承载。
 */
export function ConfigHeader({
  meta,
  reloadDisabled,
  reloading,
  onReload,
  extraActions,
}: ConfigHeaderProps) {
  const { t } = useTranslation();
  const toneClass: Record<HeaderMetaSegment['tone'], string> = {
    muted: styles.metaMuted,
    warning: styles.metaWarning,
    error: styles.metaError,
    ok: styles.metaOk,
  };

  return (
    <header className="page-header">
      <div className="page-heading">
        <h1 className="page-title" data-reveal>
          {t('config_management.title')}
        </h1>
        <p className={`page-subtitle ${styles.meta}`} data-reveal>
          {meta.map((segment, index) => (
            <Fragment key={segment.key}>
              {index > 0 ? (
                <span className={styles.metaSeparator} aria-hidden="true">
                  ·
                </span>
              ) : null}
              <span className={`${styles.metaSegment} ${toneClass[segment.tone]}`}>
                {segment.count !== undefined
                  ? t(segment.labelKey, { count: segment.count })
                  : t(segment.labelKey)}
              </span>
            </Fragment>
          ))}
        </p>
      </div>
      <div className="page-actions" data-reveal>
        {extraActions}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onReload}
          disabled={reloadDisabled}
        >
          <IconRefreshCw size={16} className={reloading ? styles.spinning : undefined} />
          <span>{t('config_management.reload')}</span>
        </button>
      </div>
    </header>
  );
}
