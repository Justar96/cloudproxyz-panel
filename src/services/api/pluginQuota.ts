import type { AntigravityQuotaSubscription, PluginQuotaMetric, PluginQuotaState } from '@/types';
import { buildAntigravityQuotaGroups } from '@/utils/quota/builders';
import { isRecord } from '@/utils/helpers';
import { apiClient } from './client';
import { guardConfigConnection } from './configValue';
import { pluginsApi } from './plugins';

export type PluginQuotaData = Pick<PluginQuotaState, 'groups' | 'subscription' | 'summary'>;

export class PluginQuotaUnavailableError extends Error {
  constructor() {
    super('No enabled v8 plugin quota provider is available for this credential.');
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

export const pluginQuotaApi = {
  async fetch(authIndex: string, provider: string): Promise<PluginQuotaData> {
    // v8 exposes plugin-ID quota routes, not the legacy /quota/fetch route.
    // Declarative probes alone have no v8 endpoint; never invent one or fall back to v0.
    const normalizedProvider = provider.trim().toLowerCase();
    if (!normalizedProvider) throw new PluginQuotaUnavailableError();
    const assertConnection = guardConfigConnection();
    const { plugins } = await pluginsApi.list();
    assertConnection();
    const plugin = plugins.find(
      (entry) =>
        entry.effectiveEnabled &&
        entry.supportsQuota &&
        entry.quotaProvider?.toLowerCase() === normalizedProvider
    );
    if (!plugin) throw new PluginQuotaUnavailableError();
    const payload = await apiClient.post(`/plugins/${encodeURIComponent(plugin.id)}/quota`, {
      auth_index: authIndex,
    });
    assertConnection();
    return normalizePluginQuota(payload);
  },
};
