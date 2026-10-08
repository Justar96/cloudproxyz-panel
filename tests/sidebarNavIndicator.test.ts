import { expect, test } from 'bun:test';

test('sidebar active row uses one traveling indicator that respects reduced motion', async () => {
  const layout = await Bun.file('src/components/layout/MainLayout.tsx').text();
  const hook = await Bun.file('src/components/layout/useSidebarNavIndicator.ts').text();
  const styles = await Bun.file('src/styles/layout.scss').text();

  expect(layout).toContain('useSidebarNavIndicator<HTMLElement>(location.pathname, navLayoutKey)');
  expect(layout).toContain('className="nav-indicator"');
  expect(layout).toContain('aria-hidden="true"');
  // NavLink marks the current row; the indicator follows it rather than a class name.
  expect(hook).toContain('a.nav-item[aria-current="page"]');

  const indicator = styles.slice(styles.indexOf('.nav-indicator {'));
  expect(indicator).toContain('&[data-animate]');
  expect(indicator).toContain('prefers-reduced-motion: reduce');
  // Until measured, the row keeps its own background so nothing flashes empty.
  expect(styles).toContain('.nav-section.has-indicator &.active');
});
