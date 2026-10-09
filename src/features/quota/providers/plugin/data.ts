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
  const provider = String(
    file.quotaProvider ?? file['quota_provider'] ?? file.provider ?? file.type ?? ''
  ).trim();
  try {
    return await pluginQuotaApi.fetch(authIndex, provider);
  } catch (error) {
    if (error instanceof PluginQuotaUnavailableError) {
      error.message = t('plugin_quota.unavailable');
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
