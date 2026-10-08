import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getAuthFileIcon,
  getThemeSurfaceIconBackground,
  getTypeLabel,
  isThemeSurfaceIconProvider,
  type ResolvedTheme,
} from '@/features/authFiles/constants';
import { scrollProviderTabs } from './providerTabsWheel';
import styles from './ProviderTabs.module.scss';

export type ProviderTabsProps = {
  types: string[];
  counts: Record<string, number>;
  active: string;
  resolvedTheme: ResolvedTheme;
  onChange: (type: string) => void;
  /** Accessible name for the group; defaults to the generic "All" filter label. */
  ariaLabel?: string;
  /** Icon source override; a custom icon is drawn bare, without the theme-surface tile. */
  getIcon?: (type: string, resolvedTheme: ResolvedTheme) => string | null;
};

type OverflowEdges = { start: boolean; end: boolean };

/**
 * Provider filter: a horizontally scrolling segmented track (wheel and touch scroll).
 * Brand colour stays inside the logos; the selected segment uses the neutral selected fill.
 */
export function ProviderTabs({
  types,
  counts,
  active,
  resolvedTheme,
  onChange,
  ariaLabel,
  getIcon,
}: ProviderTabsProps) {
  const { t } = useTranslation();
  const tabsRef = useRef<HTMLDivElement>(null);
  // The scrollbar is hidden, so a fade on each clipped edge is the cue that more tabs exist.
  const [edges, setEdges] = useState<OverflowEdges>({ start: false, end: false });

  useEffect(() => {
    const strip = tabsRef.current;
    if (!strip) return;
    const onWheel = (event: WheelEvent) => scrollProviderTabs(strip, event);
    // React delegates wheel events passively; use a local listener to prevent page scrolling.
    strip.addEventListener('wheel', onWheel, { passive: false });

    const measure = () => {
      const maxScroll = strip.scrollWidth - strip.clientWidth;
      const offset = Math.abs(strip.scrollLeft);
      const next = { start: offset > 1, end: maxScroll - offset > 1 };
      setEdges((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    measure();
    strip.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(strip);
    return () => {
      strip.removeEventListener('wheel', onWheel);
      strip.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, [types.length]);

  return (
    <div
      ref={tabsRef}
      className={`on-canvas ${styles.tabs}`}
      role="group"
      aria-label={ariaLabel ?? t('auth_files.filter_all')}
      data-fade-start={edges.start || undefined}
      data-fade-end={edges.end || undefined}
    >
      {types.map((type) => {
        const isActive = active === type;
        const label = type === 'all' ? t('auth_files.filter_all') : getTypeLabel(t, type);
        const iconSrc = type === 'all' ? null : (getIcon ?? getAuthFileIcon)(type, resolvedTheme);

        return (
          <button
            key={type}
            type="button"
            className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
            aria-pressed={isActive}
            onClick={() => onChange(type)}
          >
            {type !== 'all' && (
              <span
                className={styles.tabIconWrap}
                style={
                  // 与 AI 提供商界面一致：Kimi 图标底座随主题切换颜色
                  !getIcon && isThemeSurfaceIconProvider(type)
                    ? { background: getThemeSurfaceIconBackground(resolvedTheme) }
                    : undefined
                }
              >
                {iconSrc ? (
                  <img src={iconSrc} alt="" className={styles.tabIcon} />
                ) : (
                  <span className={styles.tabIconFallback}>{label.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
            )}
            <span className={styles.tabLabel}>{label}</span>
            <span className={styles.tabCount}>{counts[type] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}
