import type { TFunction } from 'i18next';
import type { AuthFileItem, PluginQuotaState } from '@/types';
import {
  pluginQuotaApi,
  PluginQuotaUnavailableError,
  type PluginQuotaData,
} from '@/services/api/pluginQuota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import { isDisabledAuthFile, isPluginQuotaFile } from '@/utils/quota';
import type { QuotaProviderData } from '../types';

export const fetchPluginQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<PluginQuotaData> => {
  const authIndex = normalizeAuthIndex(file.authIndex ?? file['auth_index']);
  if (!authIndex) throw new Error(t('plugin_quota.missing_auth_index'));
  // New v8 credentials carry the host's authoritative selection, including multi-provider
  // plugins and healthy alternatives. Do not re-resolve it against a stale plugin list.
  const pluginId = String(file.quotaPluginId ?? file['quota_plugin_id'] ?? '').trim();
  const provider = String(file.quotaProvider ?? file['quota_provider'] ?? '').trim();
  try {
    return await pluginQuotaApi.fetch(authIndex, { pluginId, provider });
  } catch (error) {
    if (error instanceof PluginQuotaUnavailableError) {
      error.message =
        error.reason === 'probe_unsupported'
          ? t('plugin_quota.probe_unsupported')
          : t('plugin_quota.plugin_not_found', { provider: error.provider });
    }
    throw error;
  }
};

export const PLUGIN_CONFIG: QuotaProviderData<PluginQuotaState, PluginQuotaData> = {
  type: 'plugin',
  i18nPrefix: 'plugin_quota',
  filterFn: (file) => isPluginQuotaFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchPluginQuota,
  storeSelector: (state) => state.pluginQuota,
  storeSetter: 'setPluginQuota',
  buildLoadingState: () => ({ status: 'loading', groups: [], subscription: null, summary: [] }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (error, errorStatus) => ({
    status: 'error',
    groups: [],
    subscription: null,
    summary: [],
    error,
    errorStatus,
  }),
};
