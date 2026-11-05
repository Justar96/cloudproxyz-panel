import {
  KIMI_BASE_URL_OPTIONS,
  KIMI_DISPLAY_NAME,
  KIMI_PROTOCOL_LABELS,
  KIMI_PROVIDER_NAME,
  getKimiProtocolUrls,
  resolveKimiBaseUrl,
} from './kimi';
import type {
  ProviderBrand,
  ProviderProtocol,
  MultiProtocolProviderBrand,
  MultiProtocolProviderRaw,
} from './types';

export interface ProviderProtocolUrls {
  anthropic: string;
  openai: string;
  codex: string;
  gemini: string;
}

export interface MultiProtocolBaseUrlOption {
  id: string;
  descriptionKey?: string;
  baseUrl: string;
  openaiBaseUrl: string;
  codexBaseUrl: string;
  anthropicBaseUrl: string;
  geminiBaseUrl: string;
}

export interface MultiProtocolProviderDefinition {
  brand: MultiProtocolProviderBrand;
  displayName: string;
  providerName: string;
  protocols: readonly ProviderProtocol[];
  protocolLabels: readonly string[];
  defaultProtocol: ProviderProtocol;
  baseUrlOptions: readonly MultiProtocolBaseUrlOption[];
  resolveBaseUrl: (value: string | undefined | null) => string;
  getProtocolUrls: (value: string | undefined | null) => ProviderProtocolUrls;
}

const MULTI_PROTOCOL_DEFINITIONS: Record<
  MultiProtocolProviderBrand,
  MultiProtocolProviderDefinition
> = {
  kimi: {
    brand: 'kimi',
    displayName: KIMI_DISPLAY_NAME,
    providerName: KIMI_PROVIDER_NAME,
    protocols: ['openai', 'claude', 'codex'],
    protocolLabels: KIMI_PROTOCOL_LABELS,
    defaultProtocol: 'openai',
    baseUrlOptions: KIMI_BASE_URL_OPTIONS,
    resolveBaseUrl: resolveKimiBaseUrl,
    getProtocolUrls: getKimiProtocolUrls,
  },
};

export const isMultiProtocolBrand = (brand: ProviderBrand): brand is MultiProtocolProviderBrand =>
  brand === 'kimi';

export type MultiProtocolAggregationConflict = 'multiple-configs' | 'multiple-openai-keys';

export const getMultiProtocolAggregationConflict = (
  raw: MultiProtocolProviderRaw | null | undefined
): MultiProtocolAggregationConflict | null => {
  if (!raw) return null;
  if (
    raw.openai.length > 1 ||
    raw.claude.length > 1 ||
    raw.codex.length > 1 ||
    raw.gemini.length > 1
  ) {
    return 'multiple-configs';
  }

  const openAIKeyCount = raw.openai.reduce(
    (count, item) =>
      count + (item.config.apiKeyEntries ?? []).filter((entry) => entry.apiKey?.trim()).length,
    0
  );
  return openAIKeyCount > 1 ? 'multiple-openai-keys' : null;
};

export const getMultiProtocolProviderDefinition = (
  brand: MultiProtocolProviderBrand
): MultiProtocolProviderDefinition => MULTI_PROTOCOL_DEFINITIONS[brand];

export const providerProtocolI18nKey = (
  protocol: ProviderProtocol
): 'openai' | 'codexResponses' | 'anthropic' | 'gemini' => {
  if (protocol === 'claude') return 'anthropic';
  if (protocol === 'codex') return 'codexResponses';
  return protocol;
};

export const providerProtocolModelI18nKey = (
  protocol: ProviderProtocol
): 'openai' | 'codex' | 'anthropic' | 'gemini' => {
  if (protocol === 'claude') return 'anthropic';
  return protocol;
};

export const discoveryBrandForProviderProtocol = (protocol: ProviderProtocol): ProviderBrand =>
  protocol === 'openai' ? 'openaiCompatibility' : protocol;

export const providerProtocolUrl = (
  urls: ProviderProtocolUrls,
  protocol: ProviderProtocol
): string => {
  if (protocol === 'claude') return urls.anthropic;
  if (protocol === 'codex') return urls.codex;
  if (protocol === 'gemini') return urls.gemini;
  return urls.openai;
};
