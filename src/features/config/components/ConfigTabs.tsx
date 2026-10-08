import { useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import {
  CONFIG_TAB_ICONS,
  CONFIG_TAB_IDS,
  configPanelDomId,
  configTabDomId,
  type ConfigTabId,
} from '../constants';
import styles from './ConfigTabs.module.scss';

export type ConfigTabsProps = {
  active: ConfigTabId;
  /** 每 tab 校验错误数（uiState.countSectionErrors 的产物），>0 显示失败色徽章。 */
  errorCounts: Partial<Record<ConfigTabId, number>>;
  /** 有待保存修改的 tabs（uiState.resolveDirtyTabs 的产物），显示琥珀脏点。 */
  dirtyTabs: ReadonlySet<ConfigTabId>;
  disabled?: boolean;
  onChange: (id: ConfigTabId) => void;
};

/**
 * 分区导航：宽屏是吸顶的竖向分区列表（Felt 侧栏语汇，激活 = --bg-active），
 * 窄容器下换成 Select。仍是 tablist/tab 语义：图标 + 标签 + 错误徽章 + 脏点。
 * 「常用」是首项；切换是高频操作，零动画。
 */
export function ConfigTabs({
  active,
  errorCounts,
  dirtyTabs,
  disabled = false,
  onChange,
}: ConfigTabsProps) {
  const { t } = useTranslation();
  const buttonRefs = useRef<Partial<Record<ConfigTabId, HTMLButtonElement | null>>>({});

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const count = CONFIG_TAB_IDS.length;
    const currentIndex = CONFIG_TAB_IDS.indexOf(active);
    let nextIndex = -1;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % count;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + count) % count;
    } else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = count - 1;
    if (nextIndex < 0) return;
    event.preventDefault();
    const nextId = CONFIG_TAB_IDS[nextIndex];
    onChange(nextId);
    buttonRefs.current[nextId]?.focus();
  };

  const describeTab = (id: ConfigTabId) => {
    const errorCount = errorCounts[id] ?? 0;
    const isDirty = dirtyTabs.has(id);
    const tabLabel = t(`config_management.visual.sections.${id}.title`);
    const accessibleLabel = [
      tabLabel,
      errorCount > 0 ? t('config_management.meta_errors', { count: errorCount }) : null,
      isDirty ? t('config_management.status_dirty_short') : null,
    ]
      .filter(Boolean)
      .join(', ');
    return { errorCount, isDirty, tabLabel, accessibleLabel };
  };

  const selectOptions = CONFIG_TAB_IDS.map((id) => {
    const { tabLabel, errorCount, isDirty } = describeTab(id);
    const suffix = [
      errorCount > 0 ? t('config_management.meta_errors', { count: errorCount }) : null,
      isDirty ? t('config_management.status_dirty_short') : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return { value: id, label: suffix ? `${tabLabel} · ${suffix}` : tabLabel };
  });

  return (
    <>
      <div
        className={styles.tabs}
        role="tablist"
        aria-orientation="vertical"
        aria-label={t('config_management.title')}
      >
        {CONFIG_TAB_IDS.map((id) => {
          const Icon = CONFIG_TAB_ICONS[id];
          const isActive = active === id;
          const { errorCount, isDirty, tabLabel, accessibleLabel } = describeTab(id);

          return (
            <button
              key={id}
              ref={(node) => {
                buttonRefs.current[id] = node;
              }}
              type="button"
              role="tab"
              id={configTabDomId(id)}
              aria-selected={isActive}
              aria-controls={configPanelDomId(id)}
              aria-label={accessibleLabel}
              tabIndex={isActive ? 0 : -1}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              disabled={disabled}
              onClick={() => onChange(id)}
              onKeyDown={handleKeyDown}
            >
              <span className={styles.tabGlyph} aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className={styles.tabLabel}>{tabLabel}</span>
              {errorCount > 0 ? (
                <span className={styles.tabBadge} aria-hidden="true">
                  {errorCount}
                </span>
              ) : null}
              {isDirty ? <span className={styles.tabDirtyDot} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      <div className={styles.compact}>
        <Select
          value={active}
          options={selectOptions}
          onChange={(value) => onChange(value as ConfigTabId)}
          disabled={disabled}
          ariaLabel={t('config_management.title')}
          fullWidth
        />
      </div>
    </>
  );
}
