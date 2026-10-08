import { useTranslation } from 'react-i18next';
import type { ConfigEditorMode } from '../constants';
import styles from './ModeSwitch.module.scss';

export type ModeSwitchProps = {
  mode: ConfigEditorMode;
  disabled?: boolean;
  onChange: (mode: ConfigEditorMode) => void;
};

/**
 * 可视化 / 源码切换（全局 .segmented）。源码模式是整份文档的另一种表示（不是第 9 个分区），
 * 所以它不进分区导航，常驻页头动作区。
 */
export function ModeSwitch({ mode, disabled = false, onChange }: ModeSwitchProps) {
  const { t } = useTranslation();

  return (
    <div
      className={`segmented ${styles.segmented}`}
      role="group"
      aria-label={t('config_management.mode.label')}
    >
      <button
        type="button"
        className={`segmented-item ${styles.segment} ${mode === 'visual' ? 'active' : ''}`}
        aria-pressed={mode === 'visual'}
        disabled={disabled}
        onClick={() => onChange('visual')}
      >
        {t('config_management.mode.visual')}
      </button>
      <button
        type="button"
        className={`segmented-item ${styles.segment} ${mode === 'source' ? 'active' : ''}`}
        aria-pressed={mode === 'source'}
        disabled={disabled}
        onClick={() => onChange('source')}
      >
        {t('config_management.mode.source')}
      </button>
    </div>
  );
}
