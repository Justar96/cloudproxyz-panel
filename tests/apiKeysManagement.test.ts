import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { apiKeysApi } from '@/services/api/apiKeys';
import { apiClient } from '@/services/api/client';
import { parseApiKeyDraft, validateApiKeyDraft } from '@/features/config/apiKeyDraft';
import { ApiKeysCardEditor } from '@/features/config/components/blocks/ApiKeysCardEditor';
import en from '@/i18n/locales/en.json';

afterEach(() => {
  apiClient.setConfig({ apiBase: '', managementKey: '' });
});

describe('API key management', () => {
  test('normalizes draft entries and rejects duplicates without changing key case', () => {
    const keys = parseApiKeyDraft('  sk-app-a \n\n sk-app-b\n\tsk-app-a  ');
    expect(keys).toEqual(['sk-app-a', 'sk-app-b', 'sk-app-a']);
    expect(validateApiKeyDraft(keys)).toBe('duplicate');
    expect(validateApiKeyDraft(['sk-App', 'sk-app'])).toBeNull();
    expect(validateApiKeyDraft([])).toBeNull();
    for (const invalid of ['', 'has space', 'has\ttab', 'non-ascii-密钥']) {
      expect(validateApiKeyDraft([invalid])).toBe('invalid');
    }
  });

  test('preserves server changes and only writes a draft based on the current list', async () => {
    let stored = ['fixture-a', 'fixture-b'];
    const get = spyOn(apiClient, 'get').mockImplementation(async () => [...stored]);
    const put = spyOn(apiClient, 'put').mockImplementation(async (_path, value) => {
      stored = [...(value as string[])];
      return {};
    });
    try {
      const original = await apiKeysApi.list();
      stored.push('fixture-another-editor');
      expect(await apiKeysApi.replaceIfUnchanged(original, ['fixture-new'])).toBe(false);
      expect(stored).toEqual(['fixture-a', 'fixture-b', 'fixture-another-editor']);
      expect(put).not.toHaveBeenCalled();
      expect(await apiKeysApi.replaceIfUnchanged([...stored], ['fixture-new'])).toBe(true);
      expect(stored).toEqual(['fixture-new']);
    } finally {
      get.mockRestore();
      put.mockRestore();
    }
  });

  test('aborts a save after switching connections, including switching back', async () => {
    const first = { apiBase: 'https://first.invalid', managementKey: 'fixture-management' };
    apiClient.setConfig(first);
    const get = spyOn(apiClient, 'get').mockImplementation(async () => {
      apiClient.setConfig({ apiBase: 'https://second.invalid', managementKey: 'fixture-other' });
      apiClient.setConfig(first);
      return ['fixture-original'];
    });
    const put = spyOn(apiClient, 'put').mockResolvedValue({});
    try {
      await expect(
        apiKeysApi.replaceIfUnchanged(['fixture-original'], ['fixture-new'])
      ).rejects.toMatchObject({ name: 'AbortError' });
      expect(put).not.toHaveBeenCalled();
    } finally {
      get.mockRestore();
      put.mockRestore();
    }
  });

  test('keeps secrets out of list markup and names key actions for assistive technology', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(ApiKeysCardEditor, {
          value: 'sk-fixture-private-credential',
          onChange: () => {},
        })
      )
    );
    expect(markup).not.toContain('sk-fixture-private-credential');
    expect(markup).toContain('aria-label="Copy: API Key"');
    expect(markup).toContain('aria-label="Edit: API Key"');
    expect(markup).toContain('aria-label="Delete: API Key"');
    expect(markup).toContain('type="search"');
    expect(markup).not.toContain('config_management.');
  });
});
