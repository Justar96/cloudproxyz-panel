import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export interface SidebarNavIndicator {
  /** Inline geometry for the traveling active background; null until the active row is measured. */
  style: CSSProperties | null;
  /** Slide only when the active row changes, never on resize or collapse. */
  animate: boolean;
  /** Content is hidden above / below the scroll viewport. */
  fadeStart: boolean;
  fadeEnd: boolean;
}

const ACTIVE_SELECTOR = 'a.nav-item[aria-current="page"]';

/**
 * Measures the current page's nav row so one shared background can travel between rows,
 * and tracks the scroll edges of the nav viewport for its fade mask.
 *
 * `activeKey` is whatever identifies the active row (the pathname); `layoutKey` covers
 * changes that move rows without changing the active one (collapse, drawers, labels).
 */
export function useSidebarNavIndicator<T extends HTMLElement>(
  activeKey: string,
  layoutKey: string
) {
  const containerRef = useRef<T>(null);
  const lastActiveKeyRef = useRef<string | null>(null);
  const [indicator, setIndicator] = useState<SidebarNavIndicator>({
    style: null,
    animate: false,
    fadeStart: false,
    fadeEnd: false,
  });

  const measure = useCallback((animate: boolean) => {
    const container = containerRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>(ACTIVE_SELECTOR);
    const fadeStart = container.scrollTop > 1;
    const fadeEnd = container.scrollTop + container.clientHeight < container.scrollHeight - 1;
    let style: CSSProperties | null = null;
    if (active) {
      const box = container.getBoundingClientRect();
      const row = active.getBoundingClientRect();
      style = {
        width: row.width,
        height: row.height,
        transform: `translate(${row.left - box.left + container.scrollLeft}px, ${
          row.top - box.top + container.scrollTop
        }px)`,
      };
    }
    setIndicator((prev) => {
      const same =
        prev.fadeStart === fadeStart &&
        prev.fadeEnd === fadeEnd &&
        prev.animate === animate &&
        JSON.stringify(prev.style) === JSON.stringify(style);
      return same ? prev : { style, animate: animate && prev.style !== null, fadeStart, fadeEnd };
    });
  }, []);

  useLayoutEffect(() => {
    const changedRow = lastActiveKeyRef.current !== null && lastActiveKeyRef.current !== activeKey;
    lastActiveKeyRef.current = activeKey;
    measure(changedRow);
  }, [activeKey, layoutKey, measure]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const remeasure = () => measure(false);
    container.addEventListener('scroll', remeasure, { passive: true });
    // The rail animates its width when collapsing; track it so the background follows without sliding.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(remeasure);
    observer?.observe(container);
    if (container.firstElementChild) observer?.observe(container.firstElementChild);
    return () => {
      container.removeEventListener('scroll', remeasure);
      observer?.disconnect();
    };
  }, [measure]);

  return { containerRef, indicator };
}
