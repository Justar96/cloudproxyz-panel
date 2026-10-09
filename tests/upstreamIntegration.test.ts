import { describe, expect, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AxiosError, type AxiosResponse } from 'axios';
import { apiClient } from '@/services/api/client';
import { pluginsApi } from '@/services/api/plugins';
import {
  normalizePluginQuota,
  pluginQuotaApi,
  PluginQuotaUnavailableError,
} from '@/services/api/pluginQuota';
import { vertexApi } from '@/services/api/vertex';
import {
  FieldAnchor,
  SettingCell,
  TextSetting,
  ToggleSetting,
} from '@/features/config/components/fields/FieldPrimitives';
import { ConfigFieldStateContext } from '@/features/config/components/fields/fieldState';
import { resolveQuotaHealth } from '@/features/quota/health';

const plugin = {
  id: 'vendor/plugin',
  path: '',
  configured: true,
  registered: true,
  enabled: true,
  effectiveEnabled: true,
  supportsOAuth: false,
  supportsQuota: true,
  quotaProvider: 'kiro',
  logo: '',
  configFields: [],
  menus: [],
  metadata: null,
};

describe('upstream v8 plugin quota integration', () => {
  test('normalizes backend quota capabilities at the API boundary', async () => {
    const get = spyOn(apiClient, 'get').mockResolvedValue({
      plugins: [
        {
          id: 'kiro',
          supports_quota: true,
          quota_provider: ' kiro ',
          effective_enabled: true,
        },
      ],
    });
    try {
      const result = await pluginsApi.list();
      expect(result.plugins[0]?.supportsQuota).toBe(true);
      expect(result.plugins[0]?.quotaProvider).toBe('kiro');
    } finally {
      get.mockRestore();
    }
  });

  test('uses the declared plugin ID, encoded as one v8 route segment', async () => {
    const list = spyOn(pluginsApi, 'list').mockResolvedValue({
      pluginsEnabled: true,
      pluginsDir: '',
      plugins: [plugin],
    });
    const post = spyOn(apiClient, 'post').mockResolvedValue({ summary: [] });
    try {
      await pluginQuotaApi.fetch('7', 'KIRO');
      expect(post.mock.calls).toEqual([['/plugins/vendor%2Fplugin/quota', { auth_index: '7' }]]);
    } finally {
      list.mockRestore();
      post.mockRestore();
    }
  });

  test('does not guess a route for absent, disabled, or unrelated plugins', async () => {
    const list = spyOn(pluginsApi, 'list');
    const post = spyOn(apiClient, 'post');
    try {
      for (const plugins of [
        [],
        [{ ...plugin, effectiveEnabled: false }],
        [{ ...plugin, supportsQuota: false }],
        [{ ...plugin, quotaProvider: 'other' }],
      ]) {
        list.mockResolvedValue({ pluginsEnabled: true, pluginsDir: '', plugins });
        await expect(pluginQuotaApi.fetch('7', 'kiro')).rejects.toBeInstanceOf(
          PluginQuotaUnavailableError
        );
      }
      expect(post).not.toHaveBeenCalled();
    } finally {
      list.mockRestore();
      post.mockRestore();
    }
  });

  test('never sends the dependent quota request through a changed connection', async () => {
    const revision = apiClient.getConnectionRevision();
    const getRevision = spyOn(apiClient, 'getConnectionRevision').mockReturnValue(revision);
    const list = spyOn(pluginsApi, 'list').mockImplementation(async () => {
      getRevision.mockReturnValue(revision + 1);
      return { pluginsEnabled: true, pluginsDir: '', plugins: [plugin] };
    });
    const post = spyOn(apiClient, 'post');
    try {
      await expect(pluginQuotaApi.fetch('7', 'kiro')).rejects.toHaveProperty('name', 'AbortError');
      expect(post).not.toHaveBeenCalled();
    } finally {
      list.mockRestore();
      post.mockRestore();
      getRevision.mockRestore();
    }
  });

  test('ignores malformed optional values and duplicate summary identities', () => {
    expect(normalizePluginQuota(null)).toEqual({ groups: [], subscription: null, summary: [] });
    const data = normalizePluginQuota({
      subscription: false,
      groups: [
        null,
        42,
        { buckets: [null, 'invalid', { remainingFraction: 0, window: 'weekly' }] },
      ],
      summary: [
        null,
        false,
        42,
        { key: 'balance', label: 'Balance', value: 0 },
        { key: 'balance', label: 'Duplicate', value: 4 },
      ],
    });
    expect(data.groups[0]?.buckets).toHaveLength(1);
    expect(data.summary).toHaveLength(1);
    expect(data.summary[0]?.value).toBe(0);
    expect(resolveQuotaHealth('plugin', { status: 'success', ...data })).toEqual({
      health: 'exhausted',
      minRemaining: 0,
    });
  });
});

describe('merged config dirty markers', () => {
  test('preserves visible localized modified markers for rows, cells and blocks', () => {
    const rows = [
      createElement(TextSetting, {
        fieldId: 'port',
        label: 'Port',
        value: '9000',
        onChange: () => {},
      }),
      createElement(ToggleSetting, {
        fieldId: 'port',
        label: 'Enabled',
        checked: true,
        onChange: () => {},
      }),
      createElement(SettingCell, { fieldId: 'port', children: 'Editor' }),
      createElement(FieldAnchor, { fieldId: 'port', children: 'Payload' }),
    ];
    for (const row of rows) {
      const render = (dirty: boolean) =>
        renderToStaticMarkup(
          createElement(
            ConfigFieldStateContext.Provider,
            {
              value: { dirtyFieldIds: new Set(dirty ? ['port'] : []), modifiedLabel: '수정됨' },
            },
            row
          )
        );
      expect(render(true)).toContain('data-dirty="true"');
      expect(render(true)).toContain('수정됨');
      expect(render(false)).not.toContain('data-dirty');
      expect(render(false)).not.toContain('수정됨');
    }
  });
});

describe('management session isolation', () => {
  for (const status of [200, 401]) {
    test(`drops old responses and header/auth events across ABA switches (${status})`, async () => {
      const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
      const events: string[] = [];
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: { dispatchEvent: (event: Event) => events.push(event.type) },
      });
      let deliver!: () => void;
      let sentBase = '';
      apiClient.setConfig({ apiBase: 'https://old.example.test', managementKey: 'fixture-old' });
      try {
        const request = apiClient.get('/plugins', {
          adapter: (config) =>
            new Promise<AxiosResponse>((resolve, reject) => {
              sentBase = config.baseURL ?? '';
              deliver = () => {
                const response: AxiosResponse = {
                  config,
                  data: {},
                  status,
                  statusText: String(status),
                  headers: { 'X-CPA-Version': 'old', 'X-CPA-Support-Plugin': 'true' },
                };
                if (status === 401)
                  reject(
                    new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, response)
                  );
                else resolve(response);
              };
            }),
        });
        // No await: even an immediate switch must not send through the new connection.
        apiClient.setConfig({ apiBase: 'https://new.example.test', managementKey: 'fixture-new' });
        apiClient.setConfig({ apiBase: 'https://old.example.test', managementKey: 'fixture-old' });
        expect(sentBase).toBe('https://old.example.test/v8/management');
        deliver();
        await expect(request).rejects.toHaveProperty('code', 'ERR_CANCELED');
        expect(events).toEqual([]);
      } finally {
        apiClient.setConfig({ apiBase: '', managementKey: '' });
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else Reflect.deleteProperty(globalThis, 'window');
      }
    });
  }

  test('Vertex imports forward cancellation without changing the v8 contract', async () => {
    const post = spyOn(apiClient, 'postForm').mockResolvedValue({ status: 'ok' });
    const controller = new AbortController();
    try {
      await vertexApi.importCredential(
        new File(['{}'], 'fixture.json'),
        'us-central1',
        controller.signal
      );
      const [url, form, config] = post.mock.calls[0];
      expect(url).toBe('/oauth/import?provider=vertex');
      expect(form.get('location')).toBe('us-central1');
      expect(config?.signal).toBe(controller.signal);
    } finally {
      post.mockRestore();
    }
  });
});
