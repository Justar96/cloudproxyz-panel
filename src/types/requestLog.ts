/**
 * One proxied request as reported by the backend usage queue
 * (`GET /observability/usage/queue`), normalized for the Requests page.
 *
 * Secrets never reach this shape: the client API key and an API-key credential source are
 * reduced to a masked label plus a one-way fingerprint before anything is stored.
 */
export interface RequestLogTokens {
  input: number;
  output: number;
  reasoning: number;
  total: number;
  /** Tokens served from the provider's prompt cache (cache read). */
  cacheRead: number;
  /** Tokens written into the provider's prompt cache. */
  cacheCreation: number;
  cacheCreation5m: number | null;
  cacheCreation1h: number | null;
}

export interface RequestLogRecord {
  /** Stable id: the backend execution id, or a fingerprint of the record when absent. */
  id: string;
  /** Milliseconds since the epoch. */
  timestamp: number;
  latencyMs: number;
  ttftMs: number;
  failed: boolean;
  statusCode: number;
  /** Upstream error body (truncated); empty on success. */
  failBody: string;
  failCode: string;
  stream: boolean;

  /** Model requested by the client (alias). */
  model: string;
  /** Upstream model the request was routed to. */
  upstreamModel: string;
  /** Model reported by the upstream response, when it differs. */
  responseModel: string;
  provider: string;
  endpoint: string;
  reasoningEffort: string;
  serviceTier: string;

  /** Masked client API key, e.g. `sk**********3c`; empty when the request had none. */
  clientKeyLabel: string;
  /** One-way fingerprint of the client API key, used for grouping and filtering. */
  clientKeyId: string;

  authType: string;
  authIndex: string;
  /** Credential that served the request: an email/project, or a masked upstream key. */
  credentialLabel: string;

  requestId: string;
  sessionId: string;
  clientIp: string;
  userAgent: string;

  tokens: RequestLogTokens;
}
