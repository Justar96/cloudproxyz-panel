import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { normalizeClaudeUsageSnapshot } from '@/services/api/claudeUsage';
import { ClaudeQuotaBody } from '@/features/quota/providers/claude/ClaudeQuotaBody';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import { EXPIRY_DATE_TIME_FORMAT, formatDateTimeValue } from '@/utils/format';
import type { ClaudeQuotaState } from '@/types';
import fixture from './fixtures/claude-oauth-usage.json';

const translations = i18n.cloneInstance({ lng: 'en' });
const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'ui-polish-test'
);
const snapshot = normalizeClaudeUsageSnapshot(fixture)!;
const observedAt = '2026-10-10T00:00:00Z';
const withI18n = (element: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(I18nextProvider, { i18n: translations }, element));
const css = (path: string) => readFileSync(path, 'utf8');

describe('Claude dollar balances', () => {
  test('name known balances and keep the raw upstream key available', () => {
    const quota: ClaudeQuotaState = {
      status: 'success',
      windows: [],
      extraUsage: null,
      dollarWindows: [
        ...snapshot.dollarWindows,
        { ...snapshot.dollarWindows[1], key: 'future_upstream_key' },
      ],
      observedAt,
    };
    const markup = withI18n(createElement(ClaudeQuotaBody, { quota, classes }));
    expect(markup).toContain('title="iguana_necktie">Cloud session credits<');
    expect(markup).toContain('title="additional_credit_balance">Additional credit balance<');
    // Unknown keys are never guessed into a different balance.
    expect(markup).toContain('title="future_upstream_key">future_upstream_key<');
  });

  test('translate the additional balance label in every locale', async () => {
    for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko']) {
      const json = await Bun.file(`src/i18n/locales/${locale}.json`).json();
      expect(typeof json.claude_quota.additional_credit_balance).toBe('string');
      expect(json.claude_quota.additional_credit_balance.length).toBeGreaterThan(0);
    }
  });

  test('lay out meter-less rows on their own lines in the full-page host', () => {
    const styles = css('src/features/quota/components/QuotaBody.module.scss');
    const rule = styles.slice(styles.indexOf('.quotaRow:not(:has(.quotaBar))'));
    expect(rule).toMatch(/> \.quotaRowHeader \{[^}]*display: flex;[^}]*flex: 0 0 100%;/);
    expect(rule).toMatch(/> \.quotaRowHeader > \.quotaMeta \{[^}]*order: 2;/);
    expect(rule).toMatch(/> \.quotaAmount \{[^}]*order: 3;[^}]*flex: 0 0 100%;/);
  });
});

describe('stale Claude quota card', () => {
  // QuotaCard binds a CSS module at import time, which bun test cannot evaluate; check the source.
  test('reports a failed refresh over retained data once, with time and reason', () => {
    const card = css('src/features/quota/components/QuotaCard.tsx');
    expect(card).toContain("const staleError = retainedClaudeUsage && status === 'error';");
    expect(card).toContain("? t('claude_quota.stale_snapshot', { time: staleSince })");
    expect(card).toContain('{staleError && <p className={styles.errorDetail}>{errorMessage}</p>}');
    // The body's own stale note is suppressed while the panel already says it.
    expect(card).toContain(
      'quota={staleError ? ({ ...quota, stale: false } as QuotaCardState) : quota}'
    );
    expect(css('src/features/quota/components/QuotaCard.module.scss')).toContain('.errorDetail {');
  });

  test('the body omits its stale note when the host suppresses it', () => {
    const quota: ClaudeQuotaState = {
      status: 'error',
      windows: [],
      extraUsage: snapshot.extraUsage,
      dollarWindows: snapshot.dollarWindows,
      observedAt,
    };
    const stale = withI18n(
      createElement(ClaudeQuotaBody, { quota: { ...quota, stale: true }, classes })
    );
    const settled = withI18n(
      createElement(ClaudeQuotaBody, { quota: { ...quota, stale: false }, classes })
    );
    expect(stale).toContain('Refresh failed');
    expect(settled).not.toContain('Refresh failed');
    expect(settled).toContain('Cloud session credits');
  });
});

describe('shared motion primitives', () => {
  test('modals scale from their centre and exits decelerate', () => {
    const styles = css('src/styles/components.scss');
    const modal = styles.slice(
      styles.indexOf('.modal {'),
      styles.indexOf('@keyframes modal-scale-in')
    );
    expect(modal).toContain('transform-origin: center;');
    expect(styles).not.toMatch(/\bease-in\b(?!-out)/);
  });

  test('the floating close button has no hover scale and gates hover to fine pointers', () => {
    const styles = css('src/styles/components.scss');
    const close = styles.slice(
      styles.indexOf('.modal-close-floating {'),
      styles.indexOf('.modal-header {')
    );
    expect(close).not.toContain('scale(1.1)');
    expect(close).toContain('@media (hover: hover) and (pointer: fine)');
    expect(close).toContain('@media (prefers-reduced-motion: reduce)');
  });

  test('sheet exits use a decelerating curve', () => {
    const styles = css('src/components/ui/Sheet/Sheet.module.scss');
    expect(styles).not.toContain('cubic-bezier(0.32, 0, 0.67, 0)');
    expect(styles).not.toContain('cubic-bezier(0.4, 0, 0.2, 1)');
  });

  test('no shared surface transitions every property', () => {
    for (const path of [
      'src/components/modelAlias/ModelMappingDiagram.module.scss',
      'src/styles/components.scss',
    ]) {
      expect(css(path)).not.toMatch(/transition:\s*all\b/);
    }
  });

  test('OAuth tiles press like Felt buttons and settle under reduced motion', () => {
    for (const [path, target] of [
      ['src/features/oauth/components/ProviderTile.module.scss', '.main:active'],
      ['src/features/oauth/components/SponsorCard.module.scss', '.siteMain:active'],
    ]) {
      const styles = css(path);
      expect(styles).toContain(`&:has(${target}) {\n    translate: 0 1px;`);
      const reduced = styles.slice(styles.indexOf('@media (prefers-reduced-motion: reduce)'));
      expect(reduced).toContain('translate: none;');
    }
  });
});

describe('expiry formatting', () => {
  test('drops seconds for far-off deadlines', () => {
    const value = '2026-11-11T09:08:52Z';
    expect(formatDateTimeValue(value, 'en-US')).toContain(':52');
    expect(formatDateTimeValue(value, 'en-US', EXPIRY_DATE_TIME_FORMAT)).not.toContain(':52');
    expect(formatDateTimeValue('not a date', 'en-US', EXPIRY_DATE_TIME_FORMAT)).toBe('');
  });
});
