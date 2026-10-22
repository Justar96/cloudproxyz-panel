import type {
  AntigravityQuotaSubscription,
  PluginListEntry,
  PluginQuotaMetric,
  PluginQuotaState,
} from '@/types';
import { buildAntigravityQuotaGroups } from '@/utils/quota/builders';
import { isRecord } from '@/utils/helpers';
import { apiClient } from './client';
import { guardConfigConnection } from './configValue';
import { pluginsApi } from './plugins';

export type PluginQuotaData = Pick<PluginQuotaState, 'groups' | 'subscription' | 'summary'>;

/**
 * `probe_unsupported`: the credential only advertises a declarative probe, which has no v8 route.
 * `plugin_not_found`: no registered quota plugin matches the credential's quota provider.
 */
export type PluginQuotaUnavailableReason = 'probe_unsupported' | 'plugin_not_found';

export class PluginQuotaUnavailableError extends Error {
  constructor(
    readonly reason: PluginQuotaUnavailableReason,
    readonly provider = ''
  ) {
    super('No v8 plugin quota provider is available for this credential.');
    this.name = 'PluginQuotaUnavailableError';
  }
}

export function normalizePluginQuotaSummary(summary: unknown): PluginQuotaMetric[] {
  if (!Array.isArray(summary)) return [];
  const seen = new Set<string>();
  return summary.flatMap((metric) => {
    if (!isRecord(metric)) return [];
    const key = typeof metric.key === 'string' ? metric.key.trim() : '';
    const label = typeof metric.label === 'string' ? metric.label.trim() : '';
    if (
      !key ||
      !label ||
      seen.has(key) ||
      typeof metric.value !== 'number' ||
      !Number.isFinite(metric.value)
    ) {
      return [];
    }
    seen.add(key);
    const format =
      metric.format === 'currency' || metric.format === 'number' ? metric.format : undefined;
    const unit =
      typeof metric.unit === 'string' && metric.unit.trim() ? metric.unit.trim() : undefined;
    const currency =
      format === 'currency' &&
      typeof metric.currency === 'string' &&
      /^[A-Z]{3}$/.test(metric.currency)
        ? metric.currency
        : undefined;
    return [{ key, label, value: metric.value, unit, format, currency }];
  });
}

function normalizeSubscription(subscription: unknown): AntigravityQuotaSubscription | null {
  if (!isRecord(subscription)) return null;
  const text = (field: unknown) =>
    typeof field === 'string' && field.trim() ? field.trim() : null;
  return {
    plan: text(subscription.plan),
    tierName: text(subscription.tierName),
    tierId: text(subscription.tierId),
  };
}

export function normalizePluginQuota(payload: unknown): PluginQuotaData {
  const source = isRecord(payload) ? payload : {};
  return {
    groups: buildAntigravityQuotaGroups(source),
    subscription: normalizeSubscription(source.subscription),
    summary: normalizePluginQuotaSummary(source.summary),
  };
}

const normalizeProviderId = (value: unknown) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

/**
 * Compatibility heuristic for older v8 credentials without `quota_plugin_id`.
 * Prefer a quota identifier, plugin ID, then OAuth provider match. A plugin matched only through
 * DescribeQuota's supported providers is not exposed by /plugins, so fall back to the sole quota
 * plugin when exactly one is registered.
 */
export function resolveQuotaPluginId(
  plugins: readonly PluginListEntry[],
  provider: string
): string | null {
  const target = normalizeProviderId(provider);
  if (!target) return null;
  const candidates = plugins.filter((plugin) => plugin.registered && plugin.supportsQuota);
  const match =
    candidates.find((plugin) => normalizeProviderId(plugin.quotaProvider) === target) ??
    candidates.find((plugin) => normalizeProviderId(plugin.id) === target) ??
    candidates.find((plugin) => normalizeProviderId(plugin.oauthProvider) === target) ??
    (candidates.length === 1 ? candidates[0] : undefined);
  return match?.id ?? null;
}

const PLUGIN_LIST_TTL_MS = 30_000;
let pluginListCache: {
  revision: number;
  expiresAt: number;
  promise: Promise<PluginListEntry[]>;
} | null = null;

/** Refresh-all fans out per credential; share one plugin list per connection. */
function loadQuotaPlugins(): Promise<PluginListEntry[]> {
  const revision = apiClient.getConnectionRevision();
  const now = Date.now();
  if (pluginListCache && pluginListCache.revision === revision && pluginListCache.expiresAt > now) {
    return pluginListCache.promise;
  }
  const promise = pluginsApi.list().then((response) => response.plugins);
  const entry = { revision, expiresAt: now + PLUGIN_LIST_TTL_MS, promise };
  pluginListCache = entry;
  promise.catch(() => {
    if (pluginListCache === entry) pluginListCache = null;
  });
  return promise;
}

export function resetPluginQuotaRouteCache(): void {
  pluginListCache = null;
}

export type PluginQuotaTarget = {
  /** Backend-selected quota plugin; authoritative when present. */
  pluginId?: string;
  /** Credential quota provider, used only to resolve a plugin for older v8 servers. */
  provider?: string;
};

export const pluginQuotaApi = {
  async fetch(authIndex: string, target: PluginQuotaTarget): Promise<PluginQuotaData> {
    // v8 exposes plugin-ID quota routes, not the legacy /quota/fetch route.
    // Declarative probes alone have no v8 endpoint; never invent one or fall back to v0.
    const assertConnection = guardConfigConnection();
    let pluginId = target.pluginId?.trim() ?? '';
    if (!pluginId) {
      const provider = target.provider?.trim() ?? '';
      if (!provider) throw new PluginQuotaUnavailableError('probe_unsupported');
      const plugins = await loadQuotaPlugins();
      assertConnection();
      pluginId = resolveQuotaPluginId(plugins, provider) ?? '';
      if (!pluginId) throw new PluginQuotaUnavailableError('plugin_not_found', provider);
    }
    const payload = await apiClient.post(`/plugins/${encodeURIComponent(pluginId)}/quota`, {
      auth_index: authIndex,
    });
    assertConnection();
    return normalizePluginQuota(payload);
  },
};
