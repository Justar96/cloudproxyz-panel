import type { RequestLogRecord } from '@/types/requestLog';

export type RequestStatusFilter = 'all' | 'success' | 'failed';

export interface RequestLogFilters {
  query: string;
  status: RequestStatusFilter;
  /** Exact client-facing model name; empty for every model. */
  model: string;
  /** Client API key fingerprint; empty for every key. */
  clientKeyId: string;
  provider: string;
}

export const EMPTY_REQUEST_FILTERS: RequestLogFilters = {
  query: '',
  status: 'all',
  model: '',
  clientKeyId: '',
  provider: '',
};

/** Merge newly collected records into a newest-first list, dropping duplicates and the oldest. */
export function mergeRequestRecords(
  existing: readonly RequestLogRecord[],
  incoming: readonly RequestLogRecord[],
  cap: number
): RequestLogRecord[] {
  if (!incoming.length) return existing.slice(0, cap);
  const seen = new Set<string>();
  const merged: RequestLogRecord[] = [];
  for (const record of [...incoming, ...existing]) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    merged.push(record);
  }
  merged.sort((a, b) => b.timestamp - a.timestamp);
  return merged.length > cap ? merged.slice(0, cap) : merged;
}

const matchesQuery = (record: RequestLogRecord, query: string, keyName: string): boolean =>
  [
    record.model,
    record.upstreamModel,
    record.responseModel,
    record.provider,
    record.credentialLabel,
    record.clientKeyLabel,
    keyName,
    record.requestId,
    record.endpoint,
    record.failBody,
    String(record.statusCode),
  ].some((value) => value.toLowerCase().includes(query));

export function filterRequestRecords(
  records: readonly RequestLogRecord[],
  filters: RequestLogFilters,
  keyNames: Readonly<Record<string, string>> = {}
): RequestLogRecord[] {
  const query = filters.query.trim().toLowerCase();
  return records.filter((record) => {
    if (filters.status === 'success' && record.failed) return false;
    if (filters.status === 'failed' && !record.failed) return false;
    if (filters.model && record.model !== filters.model) return false;
    if (filters.clientKeyId && record.clientKeyId !== filters.clientKeyId) return false;
    if (filters.provider && record.provider !== filters.provider) return false;
    return !query || matchesQuery(record, query, keyNames[record.clientKeyId] ?? '');
  });
}

export interface RequestLogSummary {
  requests: number;
  failed: number;
  /** 0–100, or null with no requests. */
  successRate: number | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  /** Mean latency in milliseconds, or null with no requests. */
  averageLatencyMs: number | null;
}

export function summarizeRequestRecords(records: readonly RequestLogRecord[]): RequestLogSummary {
  const summary: RequestLogSummary = {
    requests: records.length,
    failed: 0,
    successRate: null,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    totalTokens: 0,
    averageLatencyMs: null,
  };
  let latency = 0;
  for (const record of records) {
    if (record.failed) summary.failed += 1;
    summary.inputTokens += record.tokens.input;
    summary.outputTokens += record.tokens.output;
    summary.reasoningTokens += record.tokens.reasoning;
    summary.cacheReadTokens += record.tokens.cacheRead;
    summary.cacheCreationTokens += record.tokens.cacheCreation;
    summary.totalTokens += record.tokens.total;
    latency += record.latencyMs;
  }
  if (records.length) {
    summary.successRate = ((records.length - summary.failed) / records.length) * 100;
    summary.averageLatencyMs = latency / records.length;
  }
  return summary;
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

const byCountThenLabel = (a: FacetOption, b: FacetOption) =>
  b.count - a.count || a.label.localeCompare(b.label);

function facet(
  records: readonly RequestLogRecord[],
  pick: (record: RequestLogRecord) => [value: string, label: string] | null
): FacetOption[] {
  const options = new Map<string, FacetOption>();
  for (const record of records) {
    const picked = pick(record);
    if (!picked) continue;
    const [value, label] = picked;
    const option = options.get(value);
    if (option) option.count += 1;
    else options.set(value, { value, label, count: 1 });
  }
  return [...options.values()].sort(byCountThenLabel);
}

export function requestLogFacets(
  records: readonly RequestLogRecord[],
  keyNames: Readonly<Record<string, string>> = {}
) {
  return {
    models: facet(records, (record) => (record.model ? [record.model, record.model] : null)),
    providers: facet(records, (record) =>
      record.provider ? [record.provider, record.provider] : null
    ),
    clientKeys: facet(records, (record) =>
      record.clientKeyId ? [record.clientKeyId, clientKeyDisplayName(record, keyNames)] : null
    ),
  };
}

/** A saved key name when the user gave one on the API Keys page, else the masked key. */
export const clientKeyDisplayName = (
  record: Pick<RequestLogRecord, 'clientKeyId' | 'clientKeyLabel'>,
  keyNames: Readonly<Record<string, string>>
): string => keyNames[record.clientKeyId] || record.clientKeyLabel;

/** Records as CSV for export. Every field is already secret-free. */
export function requestRecordsToCsv(
  records: readonly RequestLogRecord[],
  keyNames: Readonly<Record<string, string>> = {}
): string {
  const header = [
    'time',
    'status',
    'model',
    'upstream_model',
    'provider',
    'client_key',
    'credential',
    'input_tokens',
    'output_tokens',
    'reasoning_tokens',
    'cache_read_tokens',
    'cache_creation_tokens',
    'total_tokens',
    'latency_ms',
    'ttft_ms',
    'stream',
    'endpoint',
    'request_id',
  ];
  const escape = (value: string | number | boolean) => {
    const text = String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const rows = records.map((record) =>
    [
      new Date(record.timestamp).toISOString(),
      record.statusCode,
      record.model,
      record.upstreamModel,
      record.provider,
      clientKeyDisplayName(record, keyNames),
      record.credentialLabel,
      record.tokens.input,
      record.tokens.output,
      record.tokens.reasoning,
      record.tokens.cacheRead,
      record.tokens.cacheCreation,
      record.tokens.total,
      record.latencyMs,
      record.ttftMs,
      record.stream,
      record.endpoint,
      record.requestId,
    ]
      .map(escape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
