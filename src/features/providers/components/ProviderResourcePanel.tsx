import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconExternalLink, IconKey, IconPlus, IconSearch, IconX } from '@/components/ui/icons';
import type { ProviderRecentUsageMap } from '@/components/providers/utils';
import { PROVIDER_LOGOS } from '../brandLogos';
import { getKimiAffiliateUrl } from '../kimi';
import { APIKEY_FUN_AFFILIATE_URL, APIKEY_FUN_DASHBOARD_URL } from '../sponsor';
import { getSponsorProviderDefinition } from '../sponsorDefinitions';
import type { ProviderGroup, ProviderResource } from '../types';
import { ProviderLogo } from './ProviderLogo';
import { ProviderResourceTable } from './ProviderResourceTable';
import { ProviderResourceToolbar } from './ProviderResourceToolbar';
import type { ProviderSortBy, SortDir } from '../types';
import styles from './ProviderResourcePanel.module.scss';

export interface ProviderPanelControls {
  sortBy: ProviderSortBy;
  sortDir: SortDir;
  onSortBy: (value: ProviderSortBy) => void;
  onSortDir: (value: SortDir) => void;
  availableModels: ReadonlyArray<string>;
  selectedModels: ReadonlySet<string>;
  onSelectedModelsChange: (next: Set<string>) => void;
}

interface ProviderResourcePanelProps {
  group: ProviderGroup;
  filter: string;
  onFilterChange: (value: string) => void;
  filteredResources: ProviderResource[];
  selectedId: string | null;
  disableMutations?: boolean;
  usageByProvider?: ProviderRecentUsageMap;
  toolbarControls?: ProviderPanelControls;
  onView: (resource: ProviderResource) => void;
  onEdit: (resource: ProviderResource) => void;
  onDelete: (resource: ProviderResource) => void;
  onToggleDisabled?: (resource: ProviderResource, disabled: boolean) => void;
  onCreate: () => void;
}

export function ProviderResourcePanel({
  group,
  filter,
  onFilterChange,
  filteredResources,
  selectedId,
  disableMutations,
  usageByProvider,
  toolbarControls,
  onView,
  onEdit,
  onDelete,
  onToggleDisabled,
  onCreate,
}: ProviderResourcePanelProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const providerTitle = t(`providersPage.providerNames.${group.id}`);
  const hasProviderInfo = group.resources.length > 0;
  const totalCount = group.resources.length;
  const activeCount = group.resources.filter((r) => !r.disabled).length;
  const showSponsorRegistrationLink = group.id === 'apikeyFun' && !hasProviderInfo;
  const showSponsorDashboardLink = group.id === 'apikeyFun' && hasProviderInfo;
  const registrationUrl =
    group.id === 'kimi'
      ? getKimiAffiliateUrl(i18n.resolvedLanguage ?? i18n.language)
      : group.id === 'fennoAI' || group.id === 'qiniuCloud'
        ? getSponsorProviderDefinition(group.id).affiliateUrl
        : null;
  const registrationLabel = t(
    group.id === 'kimi' ? 'providersPage.sponsor.registerNow' : 'providersPage.sponsor.registerLink'
  );
  const isFilteredOut = hasProviderInfo && filteredResources.length === 0;

  const clearFilters = () => {
    onFilterChange('');
    toolbarControls?.onSelectedModelsChange(new Set());
  };

  const titleContent = (
    <>
      <h2 className={styles.title} id={titleId}>
        {providerTitle}
      </h2>
      {showSponsorDashboardLink ? (
        <IconExternalLink className={styles.titleExternalIcon} size={14} />
      ) : null}
    </>
  );

  const renderEmpty = () => {
    if (isFilteredOut) {
      return (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <IconSearch size={18} />
          </span>
          <div className={styles.emptyText}>
            <p className={styles.emptyTitle}>
              {t('providersPage.empty.noMatchTitle', { defaultValue: 'No matching resources' })}
            </p>
            <p className={styles.emptyDescription}>
              {t('providersPage.empty.noMatchDescription', {
                defaultValue: 'Try another search or clear the model filter.',
              })}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={clearFilters}>
            <IconX size={14} />
            {t('providersPage.empty.clearFilters', { defaultValue: 'Clear filters' })}
          </Button>
        </div>
      );
    }
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <IconKey size={18} />
        </span>
        <div className={styles.emptyText}>
          <p className={styles.emptyTitle}>
            {showSponsorRegistrationLink
              ? t('providersPage.sponsor.emptyRegisterHint')
              : t('providersPage.empty.title', {
                  provider: providerTitle,
                  defaultValue: 'No {{provider}} keys yet',
                })}
          </p>
          <p className={styles.emptyDescription}>
            {t('providersPage.empty.description', {
              defaultValue: 'Add an API key to start routing requests through this provider.',
            })}
          </p>
        </div>
        {showSponsorRegistrationLink ? (
          <a
            className="btn btn-secondary btn-sm"
            href={APIKEY_FUN_AFFILIATE_URL}
            target="_blank"
            rel="noreferrer"
          >
            <IconExternalLink size={14} />
            <span>{t('providersPage.sponsor.registerLink')}</span>
          </a>
        ) : (
          <Button variant="secondary" size="sm" onClick={onCreate}>
            <IconPlus size={14} />
            {t('providersPage.actions.new')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.header}>
        <div className={styles.identity}>
          <ProviderLogo logo={PROVIDER_LOGOS[group.id]} size="lg" />
          <div className={styles.identityText}>
            {showSponsorDashboardLink ? (
              <a
                className={`${styles.titleRow} ${styles.titleLink}`}
                href={APIKEY_FUN_DASHBOARD_URL}
                target="_blank"
                rel="noreferrer"
                title={t('providersPage.sponsor.dashboardLink')}
              >
                {titleContent}
              </a>
            ) : (
              <div className={styles.titleRow}>{titleContent}</div>
            )}
            <p className={styles.summary}>
              <span
                className={[styles.dot, activeCount > 0 ? styles.dotActive : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden="true"
              />
              {t('providersPage.categories.activeCount', {
                active: activeCount,
                total: totalCount,
              })}
            </p>
          </div>
        </div>
        {showSponsorDashboardLink ? (
          <a
            className="btn btn-ghost btn-sm"
            href={APIKEY_FUN_DASHBOARD_URL}
            target="_blank"
            rel="noreferrer"
          >
            <span>{t('providersPage.sponsor.dashboardLink')}</span>
            <IconExternalLink size={14} />
          </a>
        ) : registrationUrl ? (
          <a
            className="btn btn-secondary btn-sm"
            href={registrationUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span>{registrationLabel}</span>
            <IconExternalLink size={14} />
          </a>
        ) : null}
      </div>

      {registrationUrl && group.id === 'kimi' ? (
        <p className={styles.promo}>{t('providersPage.sponsor.kimiPromo')}</p>
      ) : null}

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon} aria-hidden="true">
            <IconSearch size={16} />
          </span>
          <input
            type="search"
            className={`input ${styles.searchInput}`}
            value={filter}
            onChange={(event) => onFilterChange(event.target.value)}
            placeholder={t('providersPage.table.filterPlaceholder')}
            aria-label={t('providersPage.table.searchLabel', { defaultValue: 'Search resources' })}
          />
        </div>
        {toolbarControls ? (
          <ProviderResourceToolbar
            key={group.id}
            sortBy={toolbarControls.sortBy}
            sortDir={toolbarControls.sortDir}
            onSortBy={toolbarControls.onSortBy}
            onSortDir={toolbarControls.onSortDir}
            availableModels={toolbarControls.availableModels}
            selectedModels={toolbarControls.selectedModels}
            onSelectedModelsChange={toolbarControls.onSelectedModelsChange}
          />
        ) : null}
      </div>

      {filteredResources.length === 0 ? (
        renderEmpty()
      ) : (
        <ProviderResourceTable
          resources={filteredResources}
          selectedId={selectedId}
          disableMutations={disableMutations}
          usageByProvider={usageByProvider}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleDisabled={onToggleDisabled}
        />
      )}
    </section>
  );
}
