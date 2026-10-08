import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { ConfigTabs } from '@/features/config/components/ConfigTabs';

const noop = () => {};

describe('ConfigTabs accessibility', () => {
  test('announces validation errors and unsaved changes in the tab name', () => {
    const markup = renderToStaticMarkup(
      createElement(ConfigTabs, {
        active: 'common',
        errorCounts: { streaming: 2 },
        dirtyTabs: new Set(['streaming']),
        onChange: noop,
      })
    );
    const accessibleLabel = [
      i18n.t('config_management.visual.sections.streaming.title'),
      i18n.t('config_management.meta_errors', { count: 2 }),
      i18n.t('config_management.status_dirty_short'),
    ].join(', ');

    expect(markup).toContain(`aria-label="${accessibleLabel}"`);
  });
});

describe('ConfigTabs navigation', () => {
  test('renders a vertical tablist plus a compact select fallback', () => {
    const markup = renderToStaticMarkup(
      createElement(ConfigTabs, {
        active: 'network',
        errorCounts: {},
        dirtyTabs: new Set(),
        onChange: noop,
      })
    );
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('aria-orientation="vertical"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain(i18n.t('config_management.visual.sections.network.title'));
  });
});
