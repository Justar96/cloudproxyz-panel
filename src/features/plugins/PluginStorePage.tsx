import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import {
  IconAlertTriangle,
  IconDownload,
  IconExternalLink,
  IconGithub,
  IconPlug,
  IconRefreshCw,
  IconSearch,
  IconSettings,
  IconShield,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { pluginStoreApi } from '@/services/api';
import { useAuthStore, useConfigStore, useNotificationStore } from '@/stores';
import { getErrorMessage, isRecord } from '@/utils/helpers';
import type { PluginStoreEntry, PluginStoreResponse } from '@/types';
import {
  buildRepositoryURL,
  isDefaultPluginStoreSource,
  isOfficialPlugin,
  notifyPluginResourcesChanged,
  resolvePluginAssetURL,
} from './pluginResources';
import { PluginInstallGateModal } from './components/PluginInstallGateModal';
import {
  PluginCallout,
  PluginLogo,
  PluginRuntimeSummary,
  StatusDot,
} from './components/PluginPageParts';
import {
  buildGitHubReleasesPageURL,
  fetchPluginReleaseVersions,
  isValidManualReleaseTag,
  supportsPluginVersionSelection,
  type PluginReleaseVersion,
} from './pluginReleaseVersions';
import { waitForPluginStoreState } from './pluginPolling';
import styles from './PluginStorePage.module.scss';

type StoreStatusFilter = 'all' | 'installed' | 'notInstalled' | 'updates';
type InstallVersionMode = 'latest' | 'release' | 'manual';

interface StoreLoadError {
  kind: 'unsupported' | 'registry' | 'generic';
  message: string;
}

const getErrorStatus = (error: unknown): number | undefined =>
  isRecord(error) && typeof error.status === 'number' ? error.status : undefined;

const getErrorDetailMessage = (error: unknown): string => {
  if (!isRecord(error) || !isRecord(error.details)) return '';
  const message = error.details.message;
  return typeof message === 'string' ? message.trim() : '';
};

const DESCRIPTION_COLLAPSED_LINES = 2;

const getStoreEntryTitle = (entry: PluginStoreEntry) => entry.name || entry.id;
const getStoreEntryKey = (entry: PluginStoreEntry) => entry.storeId || entry.id;
const getDescriptionDOMID = (entryKey: string) =>
  `plugin-store-desc-${encodeURIComponent(entryKey)}`;
const normalizePluginVersion = (version: string) => version.trim().replace(/^v/i, '');
const formatPluginVersion = (version: string) => {
  const trimmed = version.trim();
  if (!trimmed) return '';
  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`;
};
const pluginVersionMatches = (left: string, right: string) =>
  normalizePluginVersion(left) === normalizePluginVersion(right);
const formatInstallType = (installType: string) =>
  installType
    .trim()
    .split('-')
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(' ');
const releaseVersionsCache = new Map<string, PluginReleaseVersion[]>();

const formatReleaseDate = (value: string, locale: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

interface PluginInstallOptionsModalProps {
  entry: PluginStoreEntry | null;
  isUpdate: boolean;
  version: string;
  installing: boolean;
  onVersionChange: (version: string) => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

function PluginInstallOptionsModal({
  entry,
  isUpdate,
  version,
  installing,
  onVersionChange,
  onClose,
  onConfirm,
}: PluginInstallOptionsModalProps) {
  const { i18n, t } = useTranslation();
  const [versionMode, setVersionMode] = useState<InstallVersionMode>('latest');
  const [showPrerelease, setShowPrerelease] = useState(false);
  const [releaseVersions, setReleaseVersions] = useState<PluginReleaseVersion[]>([]);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [releaseError, setReleaseError] = useState('');
  const [loadedReleaseKey, setLoadedReleaseKey] = useState('');

  const entryKey = entry ? getStoreEntryKey(entry) : '';
  const entryRepository = entry?.repository ?? '';
  const supportsVersionSelection = entry
    ? supportsPluginVersionSelection(entry.installType)
    : false;
  const releasePageURL =
    entry && supportsVersionSelection ? buildGitHubReleasesPageURL(entry.repository) : '';
  const releaseCacheKey = entryKey
    ? `${entryKey}|${entryRepository.trim()}|${entry?.installType.trim().toLowerCase() ?? ''}`
    : '';

  if (releaseCacheKey !== loadedReleaseKey) {
    const cached = releaseCacheKey ? releaseVersionsCache.get(releaseCacheKey) : undefined;
    setLoadedReleaseKey(releaseCacheKey);
    setVersionMode('latest');
    setShowPrerelease(false);
    setReleaseVersions(cached ?? []);
    setReleaseError(
      entryKey && supportsVersionSelection && !releasePageURL
        ? t('plugin_store.install_version_non_github')
        : ''
    );
    setReleaseLoading(Boolean(entryKey && supportsVersionSelection && releasePageURL && !cached));
  }

  useEffect(() => {
    if (!entryKey || !supportsVersionSelection || !releasePageURL) return;

    if (releaseVersionsCache.has(releaseCacheKey)) return;

    let active = true;

    fetchPluginReleaseVersions(entryRepository)
      .then((releases) => {
        if (!active) return;
        releaseVersionsCache.set(releaseCacheKey, releases);
        setReleaseVersions(releases);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setReleaseError(getErrorMessage(err, t('plugin_store.install_versions_load_failed')));
      })
      .finally(() => {
        if (!active) return;
        setReleaseLoading(false);
      });

    return () => {
      active = false;
    };
  }, [entryKey, entryRepository, releaseCacheKey, releasePageURL, supportsVersionSelection, t]);

  const stableReleaseVersions = useMemo(
    () => releaseVersions.filter((release) => !release.prerelease),
    [releaseVersions]
  );
  const visibleReleaseVersions = useMemo(
    () =>
      showPrerelease ? releaseVersions : releaseVersions.filter((release) => !release.prerelease),
    [releaseVersions, showPrerelease]
  );
  const latestRelease = stableReleaseVersions[0] ?? releaseVersions[0] ?? null;
  const releaseOptions = useMemo(
    () =>
      visibleReleaseVersions.map((release) => {
        const releaseTitle =
          release.name && release.name !== release.tagName
            ? `${release.tagName} - ${release.name}`
            : release.tagName;
        const releaseDate = formatReleaseDate(release.publishedAt, i18n.language);
        const labelParts = [
          releaseTitle,
          releaseDate,
          release.prerelease ? t('plugin_store.install_version_prerelease_badge') : '',
          release.assetNames.length > 0
            ? t('plugin_store.install_version_assets_count', {
                count: release.assetNames.length,
              })
            : '',
        ].filter(Boolean);
        return {
          value: release.tagName,
          label: labelParts.join(' · '),
        };
      }),
    [i18n.language, t, visibleReleaseVersions]
  );

  useEffect(() => {
    if (!supportsVersionSelection || versionMode !== 'release') return;
    if (visibleReleaseVersions.length === 0) {
      if (version) onVersionChange('');
      return;
    }
    if (visibleReleaseVersions.some((release) => release.tagName === version)) return;
    onVersionChange(visibleReleaseVersions[0].tagName);
  }, [onVersionChange, supportsVersionSelection, version, versionMode, visibleReleaseVersions]);

  if (!entry) return null;

  const title = isUpdate
    ? t('plugin_store.update_confirm_title')
    : t('plugin_store.install_confirm_title');
  const requestedVersion =
    !supportsVersionSelection || versionMode === 'latest' ? '' : version.trim();
  const displayVersion = requestedVersion || entry.version;
  const target = displayVersion
    ? `${getStoreEntryTitle(entry)} ${formatPluginVersion(displayVersion)}`
    : getStoreEntryTitle(entry);
  const message = isUpdate
    ? t('plugin_store.update_confirm_message', { target })
    : t('plugin_store.install_confirm_message', { target });
  const latestVersionLabel = entry.version
    ? formatPluginVersion(entry.version)
    : latestRelease
      ? formatPluginVersion(latestRelease.tagName)
      : t('plugin_store.install_version_latest');
  const hasPrereleaseVersions = releaseVersions.some((release) => release.prerelease);
  const releaseModeDisabled = installing || (releaseLoading && releaseVersions.length === 0);
  const manualVersionInvalid =
    supportsVersionSelection &&
    versionMode === 'manual' &&
    Boolean(version.trim()) &&
    !isValidManualReleaseTag(version);
  const currentVersionSelected =
    Boolean(requestedVersion) &&
    Boolean(entry.installedVersion) &&
    pluginVersionMatches(entry.installedVersion, requestedVersion);
  const confirmDisabled =
    (supportsVersionSelection && versionMode === 'release' && !requestedVersion) ||
    (supportsVersionSelection && versionMode === 'manual' && !isValidManualReleaseTag(version)) ||
    currentVersionSelected;

  const versionModeOptions: Array<{
    mode: InstallVersionMode;
    label: string;
    hint: string;
    disabled: boolean;
  }> = [
    {
      mode: 'latest',
      label: t('plugin_store.install_version_latest_mode'),
      hint: t('plugin_store.install_version_latest_hint', { version: latestVersionLabel }),
      disabled: installing,
    },
    ...(supportsVersionSelection
      ? [
          {
            mode: 'release' as const,
            label: t('plugin_store.install_version_release_mode'),
            hint: releaseLoading
              ? t('plugin_store.install_versions_loading')
              : t('plugin_store.install_version_release_hint'),
            disabled: releaseModeDisabled,
          },
          {
            mode: 'manual' as const,
            label: t('plugin_store.install_version_manual_mode'),
            hint: t('plugin_store.install_version_manual_hint'),
            disabled: installing,
          },
        ]
      : []),
  ];

  const handleVersionModeChange = (nextMode: InstallVersionMode) => {
    if (installing) return;
    if (!supportsVersionSelection && nextMode !== 'latest') return;
    setVersionMode(nextMode);
    if (nextMode === 'latest') {
      onVersionChange('');
      return;
    }
    if (nextMode === 'release') {
      onVersionChange(visibleReleaseVersions[0]?.tagName ?? '');
      return;
    }
    onVersionChange('');
  };

  const handleClose = () => {
    if (installing) return;
    onClose();
  };

  return (
    <Modal open={Boolean(entry)} onClose={handleClose} title={title} closeDisabled={installing}>
      <div className={styles.installOptions}>
        <p className={styles.installMessage}>{message}</p>
        <div className={styles.installVersionField}>
          <span className={styles.installVersionLabel} id="plugin-store-install-version-mode">
            {t('plugin_store.install_version_label')}
          </span>
          <div
            className={`option-group ${styles.installVersionModes}`}
            role="radiogroup"
            aria-labelledby="plugin-store-install-version-mode"
          >
            {versionModeOptions.map((option) => (
              <label
                key={option.mode}
                className={`option-row ${styles.installVersionMode} ${
                  versionMode === option.mode ? 'selected' : ''
                } ${option.disabled ? styles.installVersionModeDisabled : ''}`}
              >
                <input
                  type="radio"
                  className={styles.visuallyHiddenRadio}
                  name="plugin-store-install-version-mode"
                  checked={versionMode === option.mode}
                  onChange={() => handleVersionModeChange(option.mode)}
                  disabled={option.disabled}
                />
                <span className="option-radio" aria-hidden="true" />
                <span className="option-label">
                  {option.label}
                  <span className="option-description">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>

          {supportsVersionSelection && versionMode === 'release' ? (
            <div className={styles.installVersionPanel}>
              {releaseError ? (
                <p className={styles.installVersionWarning}>
                  {t('plugin_store.install_versions_load_failed')}: {releaseError}
                </p>
              ) : null}
              {!releaseLoading && !releaseError && releaseVersions.length === 0 ? (
                <p className={styles.installVersionHint}>
                  {t('plugin_store.install_versions_empty')}
                </p>
              ) : null}
              {!releaseLoading &&
              !releaseError &&
              releaseVersions.length > 0 &&
              visibleReleaseVersions.length === 0 ? (
                <p className={styles.installVersionHint}>
                  {t('plugin_store.install_versions_only_prerelease')}
                </p>
              ) : null}
              <Select
                value={version}
                options={releaseOptions}
                onChange={onVersionChange}
                placeholder={t('plugin_store.install_version_release_placeholder')}
                disabled={installing || releaseLoading || releaseOptions.length === 0}
                ariaLabel={t('plugin_store.install_version_release_select')}
              />
              {hasPrereleaseVersions ? (
                <label className={styles.installVersionCheckbox}>
                  <input
                    type="checkbox"
                    checked={showPrerelease}
                    onChange={(event) => setShowPrerelease(event.target.checked)}
                    disabled={installing}
                  />
                  <span>{t('plugin_store.install_version_show_prerelease')}</span>
                </label>
              ) : null}
            </div>
          ) : null}

          {supportsVersionSelection && versionMode === 'manual' ? (
            <div className={styles.installVersionPanel}>
              <Input
                id="plugin-store-install-version"
                value={version}
                onChange={(event) => onVersionChange(event.target.value)}
                placeholder={t('plugin_store.install_version_manual_placeholder')}
                disabled={installing}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={manualVersionInvalid}
              />
              {manualVersionInvalid ? (
                <p className={styles.installVersionWarning}>
                  {t('plugin_store.install_version_manual_error')}
                </p>
              ) : null}
            </div>
          ) : null}

          {currentVersionSelected ? (
            <p className={styles.installVersionWarning}>
              {t('plugin_store.install_version_current_selected', {
                version: formatPluginVersion(entry.installedVersion),
              })}
            </p>
          ) : null}

          {supportsVersionSelection && releasePageURL ? (
            <a
              className={styles.installReleaseLink}
              href={releasePageURL}
              target="_blank"
              rel="noreferrer"
            >
              {t('plugin_store.install_version_releases_link')}
              <IconExternalLink size={12} />
            </a>
          ) : null}
        </div>
        <div className={styles.installDialogActions}>
          <Button variant="ghost" onClick={handleClose} disabled={installing}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={isOfficialPlugin(entry) ? 'primary' : 'danger'}
            onClick={onConfirm}
            disabled={confirmDisabled}
            loading={installing}
          >
            {isUpdate ? t('plugin_store.update') : t('plugin_store.install')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function PluginStorePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const clearConfigCache = useConfigStore((state) => state.clearCache);
  const showNotification = useNotificationStore((state) => state.showNotification);

  const [data, setData] = useState<PluginStoreResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<StoreLoadError | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StoreStatusFilter>('all');
  const [installingKey, setInstallingKey] = useState('');
  const [restartRequiredKeys, setRestartRequiredKeys] = useState<string[]>([]);
  const [expandedDescriptionKeys, setExpandedDescriptionKeys] = useState<string[]>([]);
  const [overflowingDescriptionKeys, setOverflowingDescriptionKeys] = useState<string[]>([]);
  const descriptionRefs = useRef<Record<string, HTMLParagraphElement | null>>({});

  // Multi-step install gauntlet, shown only for non-official (third-party) plugins.
  const [gateOpen, setGateOpen] = useState(false);
  const [gateEntry, setGateEntry] = useState<PluginStoreEntry | null>(null);
  const [gateIsUpdate, setGateIsUpdate] = useState(false);
  const [gateRequestedVersion, setGateRequestedVersion] = useState('');

  const [installOptionsEntry, setInstallOptionsEntry] = useState<PluginStoreEntry | null>(null);
  const [installOptionsIsUpdate, setInstallOptionsIsUpdate] = useState(false);
  const [installVersion, setInstallVersion] = useState('');

  const connected = connectionStatus === 'connected';

  const loadStore = useCallback(async () => {
    if (!connected) {
      setLoading(false);
      setError({ kind: 'generic', message: t('notification.connection_required') });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const store = await pluginStoreApi.list();
      setData(store);
    } catch (err: unknown) {
      const status = getErrorStatus(err);
      if (status === 404) {
        setError({ kind: 'unsupported', message: t('plugin_store.unsupported_backend') });
      } else if (status === 502) {
        const detail = getErrorDetailMessage(err);
        setError({
          kind: 'registry',
          message: detail
            ? `${t('plugin_store.registry_failed')}: ${detail}`
            : t('plugin_store.registry_failed'),
        });
      } else {
        setError({
          kind: 'generic',
          message: getErrorMessage(err, t('plugin_store.load_failed')),
        });
      }
    } finally {
      setLoading(false);
    }
  }, [connected, t]);

  useHeaderRefresh(loadStore, connected);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const stats = useMemo(() => {
    const plugins = data?.plugins ?? [];
    const installed = plugins.filter((plugin) => plugin.installed).length;
    return {
      total: plugins.length,
      installed,
      notInstalled: plugins.length - installed,
      updates: plugins.filter((plugin) => plugin.installed && plugin.updateAvailable).length,
    };
  }, [data?.plugins]);

  const visiblePlugins = useMemo(() => {
    const plugins = data?.plugins ?? [];
    const byStatus = plugins.filter((plugin) => {
      if (statusFilter === 'installed') return plugin.installed;
      if (statusFilter === 'notInstalled') return !plugin.installed;
      if (statusFilter === 'updates') return plugin.installed && plugin.updateAvailable;
      return true;
    });

    const query = filter.trim().toLowerCase();
    if (!query) return byStatus;

    return byStatus.filter((plugin) => {
      const haystack = [
        plugin.id,
        plugin.name,
        plugin.description,
        plugin.author,
        plugin.repository,
        plugin.sourceName,
        plugin.sourceUrl,
        plugin.license,
        ...plugin.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [data?.plugins, filter, statusFilter]);

  const statusFilters: Array<{ key: StoreStatusFilter; label: string; count: number }> = [
    { key: 'all', label: t('plugin_store.filter_all'), count: stats.total },
    { key: 'installed', label: t('plugin_store.filter_installed'), count: stats.installed },
    {
      key: 'notInstalled',
      label: t('plugin_store.filter_not_installed'),
      count: stats.notInstalled,
    },
    { key: 'updates', label: t('plugin_store.filter_updates'), count: stats.updates },
  ];

  const restartNames = restartRequiredKeys.map((key) => {
    const entry = data?.plugins.find((plugin) => getStoreEntryKey(plugin) === key);
    return entry ? getStoreEntryTitle(entry) : key;
  });

  const hasActiveFilters = Boolean(filter.trim()) || statusFilter !== 'all';

  const expandedDescriptionKeySet = useMemo(
    () => new Set(expandedDescriptionKeys),
    [expandedDescriptionKeys]
  );
  const overflowingDescriptionKeySet = useMemo(
    () => new Set(overflowingDescriptionKeys),
    [overflowingDescriptionKeys]
  );

  const registerDescriptionRef = useCallback((id: string, node: HTMLParagraphElement | null) => {
    if (node) {
      descriptionRefs.current[id] = node;
    } else {
      delete descriptionRefs.current[id];
    }
  }, []);

  const measureDescriptionOverflow = useCallback(() => {
    const nextIDs = Object.entries(descriptionRefs.current)
      .filter(([, node]) => {
        if (!node) return false;
        const computed = window.getComputedStyle(node);
        const lineHeight = Number.parseFloat(computed.lineHeight);
        if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
          return node.scrollHeight > node.clientHeight + 1;
        }
        return node.scrollHeight > lineHeight * DESCRIPTION_COLLAPSED_LINES + 1;
      })
      .map(([id]) => id);

    setOverflowingDescriptionKeys((current) => {
      if (current.length === nextIDs.length && current.every((id) => nextIDs.includes(id))) {
        return current;
      }
      return nextIDs;
    });
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(measureDescriptionOverflow);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [measureDescriptionOverflow, visiblePlugins]);

  useEffect(() => {
    const handleResize = () => {
      window.requestAnimationFrame(measureDescriptionOverflow);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [measureDescriptionOverflow]);

  const toggleDescription = useCallback((id: string) => {
    setExpandedDescriptionKeys((current) =>
      current.includes(id) ? current.filter((currentID) => currentID !== id) : [...current, id]
    );
  }, []);

  const runInstall = useCallback(
    async (entry: PluginStoreEntry, isUpdate: boolean, requestedVersion = '') => {
      const entryKey = getStoreEntryKey(entry);
      const failedKey = isUpdate ? 'plugin_store.update_failed' : 'plugin_store.install_failed';
      const version = requestedVersion.trim();
      setInstallingKey(entryKey);
      try {
        const result = await pluginStoreApi.install(entry.id, {
          sourceId: entry.sourceId || undefined,
          version: version || undefined,
        });
        clearConfigCache();
        const sourceId = result.sourceId || entry.sourceId;
        const installedState = await waitForPluginStoreState(
          entry.id,
          sourceId,
          (plugin) =>
            plugin.installed &&
            plugin.configured &&
            (!version || pluginVersionMatches(plugin.installedVersion, version))
        );
        setData(installedState.response);
        if (
          installedState.timedOut ||
          !installedState.plugin?.installed ||
          !installedState.plugin.configured
        ) {
          showNotification(t('plugin_store.status_pending'), 'warning');
          return;
        }

        if (result.restartRequired) {
          setRestartRequiredKeys((current) =>
            current.includes(entryKey) ? current : [...current, entryKey]
          );
          showNotification(
            isUpdate ? t('plugin_store.update_success') : t('plugin_store.install_success'),
            'success'
          );
          showNotification(t('plugin_store.restart_required_notice'), 'warning');
          return;
        }

        if (!installedState.response.pluginsEnabled) {
          showNotification(
            isUpdate ? t('plugin_store.update_success') : t('plugin_store.install_success'),
            'success'
          );
          showNotification(t('plugin_store.global_disabled_hint'), 'warning');
          return;
        }

        if (installedState.plugin.enabled) {
          const registeredState = await waitForPluginStoreState(
            entry.id,
            sourceId,
            (plugin) => plugin.registered && plugin.effectiveEnabled
          );
          setData(registeredState.response);
          if (
            registeredState.timedOut ||
            !registeredState.plugin?.registered ||
            !registeredState.plugin.effectiveEnabled
          ) {
            showNotification(t('plugin_store.registration_pending'), 'warning');
            return;
          }
          notifyPluginResourcesChanged();
        }

        showNotification(
          isUpdate ? t('plugin_store.update_success') : t('plugin_store.install_success'),
          'success'
        );
      } catch (err: unknown) {
        showNotification(`${t(failedKey)}: ${getErrorMessage(err, t(failedKey))}`, 'error');
        throw err;
      } finally {
        setInstallingKey('');
      }
    },
    [clearConfigCache, showNotification, t]
  );

  const handleInstall = (entry: PluginStoreEntry) => {
    const isUpdate = entry.installed && entry.updateAvailable;
    setInstallOptionsEntry(entry);
    setInstallOptionsIsUpdate(isUpdate);
    setInstallVersion('');
  };

  const handleInstallOptionsClose = useCallback(() => {
    if (installingKey) return;
    setInstallOptionsEntry(null);
    setInstallVersion('');
  }, [installingKey]);

  const handleInstallOptionsConfirm = useCallback(async () => {
    if (!installOptionsEntry) return;
    const requestedVersion = installVersion.trim();

    // Third-party plugins must clear the multi-step confirmation gauntlet first.
    if (!isOfficialPlugin(installOptionsEntry)) {
      setGateEntry(installOptionsEntry);
      setGateIsUpdate(installOptionsIsUpdate);
      setGateRequestedVersion(requestedVersion);
      setGateOpen(true);
      setInstallOptionsEntry(null);
      setInstallVersion('');
      return;
    }

    try {
      await runInstall(installOptionsEntry, installOptionsIsUpdate, requestedVersion);
      setInstallOptionsEntry(null);
      setInstallVersion('');
    } catch {
      // runInstall already surfaced a notification; keep the modal available for correction.
    }
  }, [installOptionsEntry, installOptionsIsUpdate, installVersion, runInstall]);

  const handleGateConfirm = useCallback(async () => {
    if (!gateEntry) return;
    await runInstall(gateEntry, gateIsUpdate, gateRequestedVersion);
    setGateOpen(false);
    setGateRequestedVersion('');
  }, [gateEntry, gateIsUpdate, gateRequestedVersion, runInstall]);

  const handleGateClose = useCallback(() => {
    setGateOpen(false);
    setGateRequestedVersion('');
  }, []);

  const renderCard = (entry: PluginStoreEntry) => {
    const entryKey = getStoreEntryKey(entry);
    const logo = resolvePluginAssetURL(entry.logo, apiBase);
    const repositoryURL = buildRepositoryURL(entry.repository);
    const homepageURL = /^https?:\/\//i.test(entry.homepage) ? entry.homepage : '';
    const isUpdate = entry.installed && entry.updateAvailable;
    const isOfficial = isOfficialPlugin(entry);
    const versionText =
      isUpdate && entry.installedVersion && entry.version
        ? t('plugin_store.version_arrow', { from: entry.installedVersion, to: entry.version })
        : entry.installed && entry.installedVersion
          ? `v${entry.installedVersion}`
          : entry.version
            ? `v${entry.version}`
            : '';
    const sourceName = isDefaultPluginStoreSource(entry)
      ? t('plugin_store.cli_proxy_api_source')
      : entry.sourceName;
    const sourceText = sourceName ? t('plugin_store.source_name', { source: sourceName }) : '';
    const isInstalling = installingKey === entryKey;
    const hasPendingInstall = Boolean(installingKey);
    const missingAuth = entry.authRequired && !entry.authConfigured;
    const isDescriptionExpanded = expandedDescriptionKeySet.has(entryKey);
    const isDescriptionOverflowing = overflowingDescriptionKeySet.has(entryKey);
    const descriptionID = getDescriptionDOMID(entryKey);
    const installTypeText = entry.installType ? formatInstallType(entry.installType) : '';
    const platformText =
      entry.platforms.length > 0
        ? t('plugin_store.platforms', {
            platforms: entry.platforms
              .map((platform) => `${platform.goos}/${platform.goarch}`)
              .join(', '),
          })
        : '';
    const detailItems = [
      sourceText,
      entry.license,
      installTypeText ? t('plugin_store.install_type', { type: installTypeText }) : '',
      platformText,
    ].filter(Boolean);
    const actionDisabled = !connected || missingAuth || (hasPendingInstall && !isInstalling);
    const actionTitle = missingAuth ? t('plugin_store.auth_required_hint') : undefined;

    return (
      <li key={entryKey} className={styles.card}>
        <div className={styles.cardHeader}>
          <PluginLogo src={logo} />
          <div className={styles.cardTitleBlock}>
            <h2 className={styles.cardTitle}>{getStoreEntryTitle(entry)}</h2>
            <div className={styles.cardByline}>
              {entry.author ? <span>{entry.author}</span> : null}
              {versionText ? <span className={styles.cardVersion}>{versionText}</span> : null}
            </div>
          </div>
          {isUpdate ? (
            <span className={`badge badge-warning ${styles.cardState}`}>
              {t('plugin_store.badge_update')}
            </span>
          ) : entry.installed ? (
            <span className={`badge ${styles.cardState}`}>{t('plugin_store.badge_installed')}</span>
          ) : null}
        </div>

        {entry.description ? (
          <div className={styles.cardDescBlock}>
            <p
              id={descriptionID}
              ref={(node) => registerDescriptionRef(entryKey, node)}
              className={`${styles.cardDesc} ${
                isDescriptionExpanded ? styles.cardDescExpanded : ''
              }`}
            >
              {entry.description}
            </p>
            {isDescriptionOverflowing ? (
              <button
                type="button"
                className={styles.cardDescToggle}
                onClick={() => toggleDescription(entryKey)}
                aria-expanded={isDescriptionExpanded}
                aria-controls={descriptionID}
              >
                {t(
                  isDescriptionExpanded
                    ? 'plugin_store.description_show_less'
                    : 'plugin_store.description_show_more'
                )}
              </button>
            ) : null}
          </div>
        ) : null}

        {!isOfficial || entry.authRequired || (entry.installed && entry.effectiveEnabled) ? (
          <div className={styles.cardFlags}>
            {entry.installed && entry.effectiveEnabled ? (
              <span className={styles.flag}>
                <StatusDot tone="success" />
                {t('plugin_store.badge_effective')}
              </span>
            ) : null}
            {entry.authRequired ? (
              <span className={styles.flag}>
                <StatusDot tone={entry.authConfigured ? 'success' : 'attention'} />
                {entry.authConfigured
                  ? t('plugin_store.auth_configured')
                  : t('plugin_store.auth_required')}
              </span>
            ) : null}
            {!isOfficial ? (
              <span className={styles.flag}>
                <IconAlertTriangle size={12} />
                {t('plugin_store.badge_untrusted')}
              </span>
            ) : null}
          </div>
        ) : null}

        {detailItems.length > 0 ? (
          <div className={styles.cardMeta}>
            {detailItems.map((item, index) => (
              <span key={`${entryKey}-meta-${index}`}>{item}</span>
            ))}
          </div>
        ) : null}

        {entry.tags.length > 0 ? (
          <ul
            className={styles.tagRow}
            aria-label={t('plugin_store.tags_label', { defaultValue: 'Tags' })}
          >
            {entry.tags.map((tag) => (
              <li key={`${entryKey}-tag-${tag}`} className={styles.tag}>
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <div className={styles.cardFooter}>
          <div className={styles.cardActions}>
            {!entry.installed ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleInstall(entry)}
                disabled={actionDisabled}
                loading={isInstalling}
                title={actionTitle}
              >
                <IconDownload size={14} />
                {t('plugin_store.install')}
              </Button>
            ) : (
              <>
                {entry.updateAvailable ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleInstall(entry)}
                    disabled={actionDisabled}
                    loading={isInstalling}
                    title={actionTitle}
                  >
                    <IconRefreshCw size={14} />
                    {t('plugin_store.update')}
                  </Button>
                ) : null}
                <Button variant="ghost" size="sm" onClick={() => navigate('/plugins')}>
                  <IconSettings size={14} />
                  {t('plugin_store.manage')}
                </Button>
              </>
            )}
          </div>
          <div className={styles.cardLinks}>
            {repositoryURL ? (
              <a
                className={styles.iconLink}
                href={repositoryURL}
                target="_blank"
                rel="noreferrer"
                title={t('plugin_store.open_repository')}
                aria-label={t('plugin_store.open_repository')}
              >
                <IconGithub size={16} />
              </a>
            ) : null}
            {homepageURL ? (
              <a
                className={styles.iconLink}
                href={homepageURL}
                target="_blank"
                rel="noreferrer"
                title={t('plugin_store.open_homepage')}
                aria-label={t('plugin_store.open_homepage')}
              >
                <IconExternalLink size={16} />
              </a>
            ) : null}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className={`page ${styles.page}`}>
      <header className="page-header">
        <div className="page-heading">
          <h1 className="page-title">{t('plugin_store.title')}</h1>
          <p className="page-subtitle">{t('plugin_store.description')}</p>
        </div>
        <div className="page-actions">
          <Button variant="secondary" onClick={() => navigate('/plugins')}>
            <IconPlug size={16} />
            {t('plugin_store.view_installed', { defaultValue: 'Installed plugins' })}
          </Button>
        </div>
      </header>

      {error ? (
        <PluginCallout
          tone="danger"
          role="alert"
          icon={<IconAlertTriangle size={16} />}
          action={
            error.kind !== 'unsupported' ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={loadStore}
                disabled={loading}
                loading={loading}
              >
                {t('plugin_store.retry')}
              </Button>
            ) : undefined
          }
        >
          {error.message}
        </PluginCallout>
      ) : null}

      {data?.sourceErrors.length ? (
        <PluginCallout
          tone="attention"
          icon={<IconAlertTriangle size={16} />}
          title={t('plugin_store.source_errors_title')}
        >
          <ul className={styles.sourceErrorList}>
            {data.sourceErrors.map((sourceError, index) => {
              const sourceLabel =
                sourceError.sourceName || sourceError.sourceUrl || sourceError.sourceId;
              return (
                <li key={`${sourceError.sourceId}-${sourceError.sourceUrl}-${index}`}>
                  <span>{sourceLabel}</span>
                  {sourceError.message ? <small>{sourceError.message}</small> : null}
                </li>
              );
            })}
          </ul>
        </PluginCallout>
      ) : null}

      {data && !data.pluginsEnabled ? (
        <PluginCallout tone="attention" icon={<IconAlertTriangle size={16} />}>
          {t('plugin_store.global_disabled_hint')}
        </PluginCallout>
      ) : null}

      {restartNames.length > 0 ? (
        <PluginCallout tone="attention" role="status" icon={<IconRefreshCw size={16} />}>
          {t('plugin_store.restart_required_banner', { plugins: restartNames.join(', ') })}
        </PluginCallout>
      ) : null}

      {data ? (
        <PluginRuntimeSummary
          statusLabel={t('plugin_store.global_status')}
          enabled={data.pluginsEnabled}
          enabledLabel={t('plugin_store.global_enabled')}
          disabledLabel={t('plugin_store.global_disabled')}
          items={[
            {
              label: t('plugin_store.plugins_dir'),
              value: data.pluginsDir || 'plugins',
              title: data.pluginsDir || 'plugins',
              mono: true,
            },
            { label: t('plugin_store.stat_available'), value: stats.total },
            { label: t('plugin_store.filter_installed'), value: stats.installed },
            { label: t('plugin_store.filter_updates'), value: stats.updates },
          ]}
        />
      ) : null}

      <PluginCallout
        tone="neutral"
        role="note"
        icon={<IconShield size={16} />}
        title={t('plugin_store.security_banner_title')}
      >
        {t('plugin_store.security_banner_text')}
      </PluginCallout>

      <section className={styles.catalog} aria-busy={loading}>
        <div className={`on-canvas ${styles.toolbar}`}>
          <Input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t('plugin_store.search_placeholder')}
            aria-label={t('plugin_store.search_label')}
            rightElement={<IconSearch size={16} />}
          />
          <div
            className={`segmented ${styles.filterSegments}`}
            role="group"
            aria-label={t('plugin_store.filter_label')}
          >
            {statusFilters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`segmented-item ${statusFilter === item.key ? 'active' : ''}`}
                onClick={() => setStatusFilter(item.key)}
                aria-pressed={statusFilter === item.key}
              >
                {item.label}
                <span className={styles.filterCount}>{item.count}</span>
              </button>
            ))}
          </div>
        </div>

        {loading && !data ? (
          <ul className={styles.cardGrid} aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <li key={index} className={styles.skeletonCard}>
                <div className={styles.skeletonHeader}>
                  <div className={styles.skeletonAvatar} />
                  <div className={styles.skeletonText}>
                    <div className={styles.skeletonLine} />
                    <div className={styles.skeletonLine} />
                  </div>
                </div>
                <div className={styles.skeletonBody} />
              </li>
            ))}
          </ul>
        ) : visiblePlugins.length === 0 ? (
          !error ? (
            <div className="on-canvas">
              {stats.total === 0 ? (
                <EmptyState
                  title={t('plugin_store.no_plugins')}
                  description={t('plugin_store.no_plugins_desc')}
                  action={
                    <Button variant="secondary" size="sm" onClick={loadStore} disabled={!connected}>
                      <IconRefreshCw size={16} />
                      {t('plugin_store.refresh')}
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title={t('plugin_store.no_matches')}
                  description={t('plugin_store.no_matches_desc')}
                  action={
                    hasActiveFilters ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setFilter('');
                          setStatusFilter('all');
                        }}
                      >
                        {t('plugin_store.clear_filters')}
                      </Button>
                    ) : undefined
                  }
                />
              )}
            </div>
          ) : null
        ) : (
          <ul className={styles.cardGrid}>{visiblePlugins.map((entry) => renderCard(entry))}</ul>
        )}
      </section>

      <PluginInstallGateModal
        open={gateOpen}
        entry={gateEntry}
        isUpdate={gateIsUpdate}
        installing={gateEntry ? installingKey === getStoreEntryKey(gateEntry) : false}
        onClose={handleGateClose}
        onConfirm={handleGateConfirm}
      />
      <PluginInstallOptionsModal
        entry={installOptionsEntry}
        isUpdate={installOptionsIsUpdate}
        version={installVersion}
        installing={
          installOptionsEntry ? installingKey === getStoreEntryKey(installOptionsEntry) : false
        }
        onVersionChange={setInstallVersion}
        onClose={handleInstallOptionsClose}
        onConfirm={handleInstallOptionsConfirm}
      />
    </div>
  );
}
