// Secondary text on the dashboard, system, logs and plugins pages and the main layout:
// definitions live in InfoTips after their labels, restating subtitles and descriptions are
// gone, and warnings / destructive-action notes stay visible. Static markup and source
// contracts only; hover, focus and tap behaviour and the visual layout need a browser.

import { afterAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../src/i18n/index';
import { DashboardPage } from '../src/features/dashboard/DashboardPage';
import { SystemPage } from '../src/pages/SystemPage';

// Injected by Vite at build time; the system page reads it during render.
(globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ = '0.0.0-test';

const initialLanguage = i18n.language;
afterAll(async () => {
  await i18n.changeLanguage(initialLanguage);
});

const renderPage = (component: () => ReturnType<typeof createElement> | null) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(component)));
const infoTipNames = (html: string) =>
  (html.match(/<button\b[^>]*data-info-tip=""[^>]*>/g) ?? []).map(
    (tag) => tag.match(/aria-label="([^"]*)"/)?.[1]
  );
const read = (path: string) => readFileSync(path, 'utf8');

const stripSvg = (html: string) => html.replace(/<svg\b[\s\S]*?<\/svg>/g, '<svg/>');

describe('dashboard', () => {
  test('renders CloudProxyz KPI strip and shortcuts without redundant card descriptions', async () => {
    await i18n.changeLanguage('en');
    const html = renderPage(DashboardPage);
    expect(html).toContain(i18n.t('dashboard.stat_provider_keys'));
    expect(html).toContain(i18n.t('dashboard.stat_models'));
    expect(html).not.toContain(i18n.t('dashboard.cta_providers_desc', { defaultValue: '__none__' }));
  });
});

describe('system page', () => {
  test('the models card explains its two buttons in an InfoTip and a tooltip', async () => {
    await i18n.changeLanguage('en');
    const html = renderPage(SystemPage);
    expect(infoTipNames(html)).toEqual([
      `More information about ${i18n.t('system_info.models_title')}`,
    ]);
    expect(html).toContain(`hidden="">${i18n.t('system_info.models_desc')}</span>`);
    // No native titles on the two model buttons: the catalog hint moved into a Tooltip.
    const actions = html.slice(
      html.indexOf(i18n.t('system_info.models_title')),
      html.indexOf(i18n.t('system_info.models_catalog_refresh_button'))
    );
    expect(actions).not.toMatch(/<button[^>]*title=/);
    expect(html).not.toContain(`title="${i18n.t('system_info.models_catalog_refresh_hint')}"`);
    expect(read('src/pages/SystemPage.tsx')).toMatch(
      /<Tooltip content=\{t\('system_info\.models_catalog_refresh_hint'\)\}>\s*<Button/
    );
  });

  test('the destructive clear-login note stays visible', async () => {
    await i18n.changeLanguage('en');
    const html = stripSvg(renderPage(SystemPage));
    expect(html).toMatch(new RegExp(`<p[^>]*>${i18n.t('system_info.clear_login_desc')}</p>`));
  });
});

describe('logs page', () => {
  const source = read('src/features/logs/LogsPage.tsx');

  test('keeps error-log description and request-log caveat visible', () => {
    expect(source).toContain("t('logs.error_logs_description')");
    expect(source).toContain("t('logs.error_logs_request_log_enabled')");
  });
});

describe('plugins page and install flow', () => {
  test('the page header is the title alone; warnings stay', () => {
    const page = read('src/features/plugins/PluginsPage.tsx');
    // Only the h1 in the header.
    expect(page).toMatch(
      /<header className=\{styles\.header\}>\s*<h1[^>]*>[^<]*<\/h1>\s*<\/header>/
    );
    expect(page).toContain("t('plugin_management.global_disabled_hint')");
    expect(read('src/features/plugins/components/PluginStoreView.tsx')).toContain(
      "t('plugin_store.security_banner_text')"
    );
  });

  test('install-version options keep only the explanations that change the choice', () => {
    const modal = read('src/features/plugins/components/PluginInstallOptionsModal.tsx');
    // "Choose release" only shows a second line while releases are loading.
    expect(modal).toMatch(
      /'release',\s*t\('plugin_store\.install_version_release_mode'\),[\s\S]*?releaseLoading \? t\('plugin_store\.install_versions_loading'\) : null,/
    );
    expect(modal).toContain("t('plugin_store.install_version_latest_hint'");
    expect(modal).toContain("t('plugin_store.install_version_manual_hint')");
  });

  test('the trust gate keeps every risk statement', () => {
    const gate = read('src/features/plugins/components/PluginInstallGateModal.tsx');
    for (const key of [
      'gate_warning',
      'gate_effect_runs_code',
      'gate_effect_no_review',
      'gate_effect_restart',
      'gate_untrusted_alert',
      'gate_step3_prompt',
    ]) {
      expect(gate).toContain(`t('plugin_store.${key}'`);
    }
    // Step 3 is the prompt, the input and the button; nothing restates the prompt below it.
    expect(gate).toMatch(
      /aria-label=\{t\('plugin_store\.gate_step3_prompt', \{ token \}\)\}\s*\/>\s*<\/div>/
    );
  });
});

describe('main layout', () => {
  test('the sidebar brand renders the CloudProxyz mark without a subtitle', () => {
    const layout = read('src/components/layout/MainLayout.tsx');
    expect(layout).not.toContain('sidebar.subtitle');
    expect(layout).toContain('workspace-mark');
  });
});
