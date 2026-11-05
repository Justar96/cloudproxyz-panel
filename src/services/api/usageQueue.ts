/**
 * Usage queue: one record per proxied request (`GET /observability/usage/queue`).
 *
 * Reading the queue removes the records it returns. Every record carries the client API key and,
 * for API-key credentials, the upstream key in plain text; both are masked and fingerprinted here
 * so that nothing downstream ever holds a secret.
 */

import type { Config } from '@/types';
import type { RequestLogRecord } from '@/types/requestLog';
import { apiKeyNameFingerprint } from '@/features/config/apiKeyNames';
import { maskApiKey } from '@/utils/format';
import { isRecord } from '@/utils/helpers';
import { apiClient } from './client';

/** Largest batch requested per read; the backend accepts any positive count. */
export const USAGE_QUEUE_BATCH = 200;
const USAGE_QUEUE_TIMEOUT_MS = 15 * 1000;
const FAIL_BODY_LIMIT = 2000;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const count = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;

const optionalCount = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : null;

const parseTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

/** `unknown` is the backend's placeholder for a missing value. */
const known = (value: unknown): string => {
  const result = text(value);
  return result.toLowerCase() === 'unknown' ? '' : result;
};

/**
 * The backend reports the credential's identity as `source`: an email or project for OAuth,
 * but the upstream key itself for API-key credentials (auth type `apikey`), and the client key
 * when no credential was resolved. Only plainly non-secret identities are kept readable.
 */
const credentialLabel = (authType: string, source: string, clientKey: string): string => {
  if (!source) return '';
  if (source === clientKey) return maskApiKey(source);
  if (source.includes('@')) return source;
  return authType.toLowerCase() === 'oauth' ? source : maskApiKey(source);
};

const fallbackId = (raw: Record<string, unknown>, timestamp: number): string =>
  apiKeyNameFingerprint(
    'usage-record',
    JSON.stringify([timestamp, raw.request_id, raw.auth_index, raw.model, raw.latency_ms])
  ).slice(0, 32);

/**
 * Normalize one queue record. Returns null for anything that is not a usage record
 * (the queue can also carry control payloads such as `{"refresh":true}`).
 */
export function normalizeUsageRecord(raw: unknown, apiBase: string): RequestLogRecord | null {
  if (!isRecord(raw)) return null;
  const timestamp = parseTimestamp(raw.timestamp);
  if (timestamp === null) return null;

  const tokens = isRecord(raw.tokens) ? raw.tokens : {};
  const fail = isRecord(raw.fail) ? raw.fail : {};
  const failed = raw.failed === true;
  const clientKey = text(raw.api_key);
  const authType = known(raw.auth_type);
  const alias = known(raw.alias);
  const model = known(raw.model);
  const responseModel = text(raw.response_model);
  const input = count(tokens.input_tokens);
  const output = count(tokens.output_tokens);
  const reasoning = count(tokens.reasoning_tokens);
  const statusCode = count(fail.status_code);

  return {
    id: text(raw.execution_id) || fallbackId(raw, timestamp),
    timestamp,
    latencyMs: count(raw.latency_ms),
    ttftMs: count(raw.ttft_ms),
    failed,
    statusCode: statusCode || (failed ? 500 : 200),
    failBody: failed ? text(fail.body).slice(0, FAIL_BODY_LIMIT) : '',
    failCode: failed ? text(fail.code) : '',
    stream: raw.stream === true,
    model: alias || model,
    upstreamModel: model,
    responseModel: responseModel && responseModel !== model ? responseModel : '',
    provider: known(raw.provider),
    endpoint: text(raw.endpoint),
    reasoningEffort: text(raw.reasoning_effort),
    serviceTier: text(raw.service_tier),
    clientKeyLabel: clientKey ? maskApiKey(clientKey) : '',
    clientKeyId: clientKey ? apiKeyNameFingerprint(apiBase, clientKey) : '',
    authType,
    authIndex: text(raw.auth_index),
    credentialLabel: credentialLabel(authType, text(raw.source), clientKey),
    requestId: text(raw.request_id),
    sessionId: text(raw.session_id),
    clientIp: text(raw.resolved_client_ip) || text(raw.client_ip),
    userAgent: text(raw.user_agent),
    tokens: {
      input,
      output,
      reasoning,
      total: count(tokens.total_tokens) || input + output,
      cacheRead: count(tokens.cache_read_tokens) || count(tokens.cached_tokens),
      cacheCreation: count(tokens.cache_creation_tokens),
      cacheCreation5m: optionalCount(tokens.cache_creation_5m_tokens),
      cacheCreation1h: optionalCount(tokens.cache_creation_1h_tokens),
    },
  };
}

export interface UsageQueueSettings {
  /** `observability.usage.usage-statistics-enabled`; the backend records nothing when false. */
  statisticsEnabled: boolean;
  /** Seconds an unread record survives on the backend (default 60, maximum 3600). */
  retentionSeconds: number;
}

const DEFAULT_RETENTION_SECONDS = 60;

export function readUsageQueueSettings(config: Config | null): UsageQueueSettings | null {
  const raw = config?.raw;
  if (!isRecord(raw)) return null;
  const observability = isRecord(raw.observability) ? raw.observability : {};
  const usage = isRecord(observability.usage) ? observability.usage : {};
  const retention = usage['redis-usage-queue-retention-seconds'];
  return {
    statisticsEnabled: usage['usage-statistics-enabled'] === true,
    retentionSeconds:
      typeof retention === 'number' && retention > 0
        ? Math.min(Math.round(retention), 3600)
        : DEFAULT_RETENTION_SECONDS,
  };
}

export const usageQueueApi = {
  /**
   * Remove up to `limit` of the oldest queued items. `received` counts every item the backend
   * returned, including control payloads, so callers can tell whether the queue is drained.
   */
  async pop(
    apiBase: string,
    limit = USAGE_QUEUE_BATCH
  ): Promise<{ records: RequestLogRecord[]; received: number }> {
    const data = await apiClient.get<unknown>('/observability/usage/queue', {
      params: { count: limit },
      timeout: USAGE_QUEUE_TIMEOUT_MS,
    });
    if (!Array.isArray(data)) return { records: [], received: 0 };
    const records = data.flatMap((item) => {
      const record = normalizeUsageRecord(item, apiBase);
      return record ? [record] : [];
    });
    return { records, received: data.length };
  },
};
