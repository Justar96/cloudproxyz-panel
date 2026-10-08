import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/Select';
import { PROVIDER_LOGOS } from '../brandLogos';
import type { ProviderBrand, ProviderGroup } from '../types';
import { ProviderLogo } from './ProviderLogo';
import styles from './ProviderCategoryList.module.scss';

interface ProviderCategoryListProps {
  groups: ProviderGroup[];
  activeBrand: ProviderBrand;
  onSelect: (brand: ProviderBrand) => void;
}

const QUICK_FILL_BRAND_ORDER: readonly ProviderBrand[] = ['fennoAI', 'qiniuCloud'];

const QUICK_FILL_BRANDS: ReadonlySet<ProviderBrand> = new Set(QUICK_FILL_BRAND_ORDER);

export function ProviderCategoryList({ groups, activeBrand, onSelect }: ProviderCategoryListProps) {
  const { t } = useTranslation();
  const providersLabelId = useId();
  const quickFillLabelId = useId();

  const quickFillGroups = groups
    .filter((g) => QUICK_FILL_BRANDS.has(g.id))
    .sort(
      (left, right) =>
        QUICK_FILL_BRAND_ORDER.indexOf(left.id) - QUICK_FILL_BRAND_ORDER.indexOf(right.id)
    );
  const providerGroups = groups.filter((g) => !QUICK_FILL_BRANDS.has(g.id));

  const selectOptions = useMemo(
    () =>
      [...providerGroups, ...quickFillGroups].map((group) => ({
        value: group.id,
        label: `${t(`providersPage.providerNames.${group.id}`)} · ${t(
          'providersPage.categories.activeCount',
          {
            active: group.resources.filter((r) => !r.disabled).length,
            total: group.resources.length,
          }
        )}`,
      })),
    [providerGroups, quickFillGroups, t]
  );

  const renderGroups = (items: ProviderGroup[], labelId: string) => (
    <ul className={styles.list} aria-labelledby={labelId}>
      {items.map((group) => {
        const active = group.id === activeBrand;
        const total = group.resources.length;
        const activeCount = group.resources.filter((r) => !r.disabled).length;
        const hasDisabled = activeCount < total;
        const activeCountLabel = t('providersPage.categories.activeCount', {
          active: activeCount,
          total,
        });

        return (
          <li key={group.id}>
            <button
              type="button"
              className={[styles.item, active ? styles.active : ''].filter(Boolean).join(' ')}
              onClick={() => onSelect(group.id)}
              aria-current={active ? 'page' : undefined}
              title={activeCountLabel}
            >
              <ProviderLogo logo={PROVIDER_LOGOS[group.id]} size="sm" />
              <span className={styles.itemTitle}>
                {t(`providersPage.providerNames.${group.id}`)}
              </span>
              <span className={styles.srOnly}>{activeCountLabel}</span>
              {hasDisabled ? <span className={styles.attentionDot} aria-hidden="true" /> : null}
              <span className={styles.count} aria-hidden="true">
                {total}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <div className={`${styles.mobilePicker} on-canvas`}>
        <Select
          value={activeBrand}
          options={selectOptions}
          onChange={(value) => onSelect(value as ProviderBrand)}
          ariaLabel={t('providersPage.categories.title')}
          fullWidth
        />
      </div>
      <nav className={styles.nav} aria-label={t('providersPage.categories.title')}>
        <div className={styles.group}>
          <p className={styles.groupLabel} id={providersLabelId}>
            {t('providersPage.categories.title')}
          </p>
          {renderGroups(providerGroups, providersLabelId)}
        </div>
        {quickFillGroups.length > 0 && (
          <div className={styles.group}>
            <p className={styles.groupLabel} id={quickFillLabelId}>
              {t('providersPage.categories.quickFill')}
            </p>
            {renderGroups(quickFillGroups, quickFillLabelId)}
          </div>
        )}
      </nav>
    </>
  );
}
