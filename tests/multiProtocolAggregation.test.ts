import { describe, expect, test } from 'bun:test';
import { getMultiProtocolAggregationConflict } from '../src/features/providers/multiProtocolDefinitions';
import type { MultiProtocolProviderRaw } from '../src/features/providers/types';

const emptyRaw = (): MultiProtocolProviderRaw => ({
  openai: [],
  claude: [],
  codex: [],
  gemini: [],
});

describe('multiProtocol aggregation safety', () => {
  test('detects multiple configs for one protocol', () => {
    const raw = emptyRaw();
    raw.codex = [
      { index: 0, config: { apiKey: 'first' } },
      { index: 1, config: { apiKey: 'second' } },
    ];

    expect(getMultiProtocolAggregationConflict(raw)).toBe('multiple-configs');
  });

  test('detects multiple OpenAI API keys in one config', () => {
    const raw = emptyRaw();
    raw.openai = [
      {
        index: 0,
        config: {
          name: 'Kimi',
          baseUrl: 'https://example.com/v1',
          apiKeyEntries: [{ apiKey: 'first' }, { apiKey: 'second' }],
        },
      },
    ];

    expect(getMultiProtocolAggregationConflict(raw)).toBe('multiple-openai-keys');
  });

  test('allows the supported one-config-per-protocol shape', () => {
    const raw = emptyRaw();
    raw.codex = [{ index: 0, config: { apiKey: 'codex' } }];
    raw.openai = [
      {
        index: 0,
        config: {
          name: 'Kimi',
          baseUrl: 'https://example.com/v1',
          apiKeyEntries: [{ apiKey: 'openai' }],
        },
      },
    ];

    expect(getMultiProtocolAggregationConflict(raw)).toBeNull();
  });
});
