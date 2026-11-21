import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import i18n from '../src/i18n/index';
import { apiClient } from '../src/services/api/client';
import {
  normalizeUsageRecord,
  readUsageQueueSettings,
  usageQueueApi,
} from '../src/services/api/usageQueue';
import { apiKeyNameFingerprint } from '../src/features/config/apiKeyNames';
import {
  EMPTY_REQUEST_FILTERS,
  clientKeyDisplayName,
  filterRequestRecords,
  mergeRequestRecords,
  requestLogFacets,
  requestRecordsToCsv,
  summarizeRequestRecords,
} from '../src/features/requests/logic';
import { RequestsPage } from '../src/features/requests/RequestsPage';
import { RequestTable } from '../src/features/requests/components/RequestTable';
import { useRequestLogStore } from '../src/stores/useRequestLogStore';
import { useAuthStore } from '../src/stores/useAuthStore';
import type { Config } from '../src/types';
import type { RequestLogRecord } from '../src/types/requestLog';

const API_BASE = 'https://proxy.example.com';
const CLIENT_KEY = 'sk-client-secret-1234567890';
const UPSTREAM_KEY = 'sk-upstream-secret-abcdefgh';

/** A record as GET /observability/usage/queue returns it (CLIProxyAPI v8.0.56). */
const rawRecord = (overrides: Record<string, unknown> = {}) => ({
  timestamp: '2026-11-05T08:00:00.123Z',
  latency_ms: 1530,
  ttft_ms: 420,
  source: UPSTREAM_KEY,
  auth_index: 'd596980cfaa13ddd',
  client_ip: '10.0.0.2',
  resolved_client_ip: '203.0.113.9',
  x_forwarded_for: '203.0.113.9',
  user_agent: 'claude-cli/2.1',
  tokens: {
    input_tokens: 1200,
    output_tokens: 300,
    reasoning_tokens: 40,
    cached_tokens: 0,
    cache_read_tokens: 800,
    cache_read_tokens_present: true,
    cache_creation_tokens: 150,
    cache_creation_5m_tokens: 150,
    total_tokens: 2450,
  },
  failed: false,
  generate: true,
  stream: true,
  fail: { status_code: 200, body: '' },
  response_headers: { 'Set-Cookie': ['secret'] },
  accounting_version: 3,
  provider: 'claude',
  executor_type: 'claude',
  model: 'claude-sonnet-4-5-20250929',
  alias: 'claude-sonnet-4-5',
  endpoint: '/v1/messages',
  auth_type: 'apikey',
  api_key: CLIENT_KEY,
  is_native_key: true,
  request_id: 'req-1',
  execution_id: 'exec-1',
  session_id: 'b3f1c2d4-0000-4000-8000-000000000001',
  reasoning_effort: 'high',
  service_tier: '',
  ...overrides,
});

const record = (overrides: Partial<RequestLogRecord> = {}): RequestLogRecord => ({
  ...normalizeUsageRecord(rawRecord(), API_BASE)!,
  ...overrides,
});

describe('usage queue normalization', () => {
  test('maps the v8 record onto the request log shape', () => {
    const result = normalizeUsageRecord(rawRecord(), API_BASE);
    expect(result).toMatchObject({
      id: 'exec-1',
      timestamp: Date.parse('2026-11-05T08:00:00.123Z'),
      latencyMs: 1530,
      ttftMs: 420,
      failed: false,
      statusCode: 200,
      stream: true,
      model: 'claude-sonnet-4-5',
      upstreamModel: 'claude-sonnet-4-5-20250929',
      provider: 'claude',
      endpoint: '/v1/messages',
      authType: 'apikey',
      authIndex: 'd596980cfaa13ddd',
      requestId: 'req-1',
      clientIp: '203.0.113.9',
      tokens: {
        input: 1200,
        output: 300,
        reasoning: 40,
        total: 2450,
        cacheRead: 800,
        cacheCreation: 150,
        cacheCreation5m: 150,
        cacheCreation1h: null,
      },
    });
  });

  test('never keeps a client or upstream key in plain text', () => {
    const result = normalizeUsageRecord(rawRecord(), API_BASE)!;
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(CLIENT_KEY);
    expect(serialized).not.toContain(UPSTREAM_KEY);
    expect(serialized).not.toContain('Set-Cookie');
    expect(result.clientKeyLabel).toBe('sk******90');
    expect(result.credentialLabel).toBe('sk******gh');
    // Same fingerprint as the API Keys page, so saved key names resolve.
    expect(result.clientKeyId).toBe(apiKeyNameFingerprint(API_BASE, CLIENT_KEY));
  });

  test('masks every source that could be a key', () => {
    for (const authType of ['apikey', 'api_key', '', 'unknown']) {
      const result = normalizeUsageRecord(rawRecord({ auth_type: authType }), API_BASE)!;
      expect(result.credentialLabel).toBe('sk******gh');
    }
    const clientFallback = normalizeUsageRecord(
      rawRecord({ auth_type: 'oauth', source: CLIENT_KEY }),
      API_BASE
    )!;
    expect(clientFallback.credentialLabel).toBe('sk******90');
  });

  test('keeps OAuth identities readable and drops the backend "unknown" placeholder', () => {
    const result = normalizeUsageRecord(
      rawRecord({ auth_type: 'oauth', source: 'dev@example.com', provider: 'unknown', alias: '' }),
      API_BASE
    )!;
    expect(result.credentialLabel).toBe('dev@example.com');
    expect(result.provider).toBe('');
    expect(result.model).toBe('claude-sonnet-4-5-20250929');
  });

  test('keeps failure details and defaults a missing status', () => {
    const result = normalizeUsageRecord(
      rawRecord({ failed: true, fail: { status_code: 0, body: ' rate limited ', code: 'rate' } }),
      API_BASE
    )!;
    expect(result).toMatchObject({
      failed: true,
      statusCode: 500,
      failBody: 'rate limited',
      failCode: 'rate',
    });
  });

  test('rejects control payloads and records without a timestamp', () => {
    expect(normalizeUsageRecord({ refresh: true }, API_BASE)).toBeNull();
    expect(normalizeUsageRecord({ support_refresh: true }, API_BASE)).toBeNull();
    expect(normalizeUsageRecord('nope', API_BASE)).toBeNull();
  });

  test('derives a stable id when the execution id is missing', () => {
    const first = normalizeUsageRecord(rawRecord({ execution_id: '' }), API_BASE)!;
    const second = normalizeUsageRecord(rawRecord({ execution_id: '' }), API_BASE)!;
    expect(first.id).toMatch(/^[a-f0-9]{32}$/);
    expect(first.id).toBe(second.id);
  });
});

describe('usage queue API', () => {
  const restores: Array<{ mockRestore: () => void }> = [];
  afterEach(() => restores.splice(0).forEach((spy) => spy.mockRestore()));

  test('pops a batch from the v8 endpoint and counts control payloads as received', async () => {
    const get = spyOn(apiClient, 'get').mockResolvedValue([rawRecord(), { refresh: true }]);
    restores.push(get);
    const result = await usageQueueApi.pop(API_BASE, 50);
    expect(get).toHaveBeenCalledWith('/observability/usage/queue', {
      params: { count: 50 },
      timeout: 15000,
    });
    expect(result.received).toBe(2);
    expect(result.records.map((item) => item.id)).toEqual(['exec-1']);
  });

  test('reads queue settings from the v8 configuration', () => {
    const config = (usage: Record<string, unknown>) =>
      ({ raw: { observability: { usage } } }) as Config;
    expect(readUsageQueueSettings(null)).toBeNull();
    expect(readUsageQueueSettings(config({}))).toEqual({
      statisticsEnabled: false,
      retentionSeconds: 60,
    });
    expect(
      readUsageQueueSettings(
        config({ 'usage-statistics-enabled': true, 'redis-usage-queue-retention-seconds': 9000 })
      )
    ).toEqual({ statisticsEnabled: true, retentionSeconds: 3600 });
  });
});

describe('request log logic', () => {
  const a = record({ id: 'a', timestamp: 1000 });
  const b = record({ id: 'b', timestamp: 3000, failed: true, statusCode: 429, model: 'gpt-5' });
  const c = record({ id: 'c', timestamp: 2000, provider: 'codex', clientKeyId: 'other' });

  test('merges newest first, drops duplicates and caps the oldest', () => {
    const merged = mergeRequestRecords([a], [b, c, { ...a, latencyMs: 1 }], 10);
    expect(merged.map((item) => item.id)).toEqual(['b', 'c', 'a']);
    // The freshly collected copy wins over the stored one.
    expect(merged[2].latencyMs).toBe(1);
    expect(mergeRequestRecords([a], [b, c], 2).map((item) => item.id)).toEqual(['b', 'c']);
  });

  test('filters by status, model, key, provider and free text', () => {
    const all = [b, c, a];
    expect(filterRequestRecords(all, { ...EMPTY_REQUEST_FILTERS, status: 'failed' })).toEqual([b]);
    expect(filterRequestRecords(all, { ...EMPTY_REQUEST_FILTERS, model: 'gpt-5' })).toEqual([b]);
    expect(filterRequestRecords(all, { ...EMPTY_REQUEST_FILTERS, provider: 'codex' })).toEqual([c]);
    expect(filterRequestRecords(all, { ...EMPTY_REQUEST_FILTERS, clientKeyId: 'other' })).toEqual([
      c,
    ]);
    expect(filterRequestRecords(all, { ...EMPTY_REQUEST_FILTERS, query: '429' })).toEqual([b]);
    expect(
      filterRequestRecords(
        all,
        { ...EMPTY_REQUEST_FILTERS, query: 'ci team' },
        { other: 'CI team' }
      )
    ).toEqual([c]);
  });

  test('summarizes tokens, cache use, success rate and latency', () => {
    const summary = summarizeRequestRecords([a, b]);
    expect(summary).toMatchObject({
      requests: 2,
      failed: 1,
      successRate: 50,
      inputTokens: 2400,
      outputTokens: 600,
      cacheReadTokens: 1600,
      cacheCreationTokens: 300,
      averageLatencyMs: 1530,
    });
    expect(summarizeRequestRecords([]).successRate).toBeNull();
  });

  test('names keys saved on the API Keys page and falls back to the masked key', () => {
    const names = { [a.clientKeyId]: 'Laptop' };
    expect(clientKeyDisplayName(a, names)).toBe('Laptop');
    expect(clientKeyDisplayName(a, {})).toBe('sk******90');
    const facets = requestLogFacets([a, b, c], names);
    expect(facets.clientKeys[0]).toEqual({ value: a.clientKeyId, label: 'Laptop', count: 2 });
    expect(facets.models.map((option) => option.value)).toEqual(['claude-sonnet-4-5', 'gpt-5']);
  });

  test('exports CSV with quoting and without secrets', () => {
    const csv = requestRecordsToCsv([record({ failBody: 'x', endpoint: '/v1/a,b' })]);
    const [header, row] = csv.split('\n');
    expect(header.startsWith('time,status,model')).toBe(true);
    expect(row).toContain('"/v1/a,b"');
    expect(csv).not.toContain(CLIENT_KEY);
    expect(csv).not.toContain(UPSTREAM_KEY);
  });
});

describe('requests page', () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
  });
  afterEach(() => {
    useRequestLogStore.setState({ records: [], collecting: false, hydrated: false });
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  const render = () =>
    renderToStaticMarkup(createElement(MemoryRouter, null, createElement(RequestsPage)));

  test('signing out forgets collected records; signing in does not', async () => {
    useRequestLogStore.setState({ scope: 'scope-a', records: [record()], hydrated: true });
    const login = useAuthStore
      .getState()
      .login({ apiBase: 'http://127.0.0.1:1', managementKey: 'k', rememberPassword: false })
      .catch(() => undefined);
    expect(useRequestLogStore.getState().records).toHaveLength(1);
    await login;
    useAuthStore.getState().logout();
    expect(useRequestLogStore.getState()).toMatchObject({ scope: null, records: [] });
  });

  test('explains the destructive queue read while collection is off', async () => {
    await i18n.changeLanguage('en');
    useAuthStore.setState({ apiBase: API_BASE, connectionStatus: 'connected' });
    const html = render();
    expect(html).toContain('Collection is off');
    expect(html).toContain('reading removes them');
    expect(html).toContain('No requests recorded yet');
  });

  test('lists records with masked keys, tokens and cache columns', async () => {
    await i18n.changeLanguage('en');
    const html = renderToStaticMarkup(
      createElement(RequestTable, {
        records: [record()],
        total: 3,
        keyNames: {},
        selectedId: null,
        onSelect: () => undefined,
        onShowMore: () => undefined,
      })
    );
    expect(html).toContain('claude-sonnet-4-5');
    expect(html).toContain('sk******90');
    expect(html).toContain('sk******gh');
    expect(html).toContain('Cache read');
    expect(html).toContain('1,200');
    expect(html).toContain('1.53 s');
    expect(html).toContain('View details for claude-sonnet-4-5');
    expect(html).toContain('Showing 1 of 3');
    expect(html).toContain('Show more');
    expect(html).not.toContain(CLIENT_KEY);
    expect(html).not.toContain(UPSTREAM_KEY);
  });
});
