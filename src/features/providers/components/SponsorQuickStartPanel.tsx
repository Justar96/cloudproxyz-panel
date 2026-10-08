import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useNotificationStore } from '@/stores';
import { Button } from '@/components/ui/Button';
import {
  IconCheckCircle2,
  IconExternalLink,
  IconKey,
  IconLoader2,
  IconPlus,
} from '@/components/ui/icons';
import { PROVIDER_LOGOS } from '../brandLogos';
import { APIKEY_FUN_AFFILIATE_URL, APIKEY_FUN_DASHBOARD_URL } from '../sponsor';
import { isSponsorPartialMutationError } from '../sponsorMutationRecovery';
import type { ProviderEntryFormInput, ProviderResource } from '../types';
import type { UseProviderWorkbenchResult } from '../useProviderWorkbench';
import { SponsorProviderForm } from '../sheets/forms/SponsorProviderForm';
import { ProviderLogo } from './ProviderLogo';
import styles from './SponsorQuickStartPanel.module.scss';

interface SponsorQuickStartPanelProps {
  resource: ProviderResource | null;
  workbench: UseProviderWorkbenchResult;
  mutationDisabled?: boolean;
}

export function SponsorQuickStartPanel({
  resource,
  workbench,
  mutationDisabled = false,
}: SponsorQuickStartPanelProps) {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const formId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const formMutating = submitting || mutationDisabled || workbench.mutating;
  const mode = resource ? 'edit' : 'create';
  const submitDisabled = formMutating || (mode === 'edit' && !isDirty);
  const logo = PROVIDER_LOGOS.apikeyFun;

  useUnsavedChangesGuard({
    shouldBlock: isDirty && !submitting,
    dialog: {
      title: t('providersPage.unsavedChanges.title'),
      message: t('providersPage.unsavedChanges.message'),
      confirmText: t('providersPage.unsavedChanges.discard'),
      cancelText: t('providersPage.unsavedChanges.keepEditing'),
      variant: 'danger',
    },
  });

  const handleSubmit = async (input: ProviderEntryFormInput) => {
    if (mutationDisabled) return;
    setSubmitting(true);
    try {
      if (resource) {
        await workbench.updateProvider(resource, input);
        showNotification(t('providersPage.toast.updated'), 'success');
      } else {
        await workbench.createProvider('apikeyFun', input);
        showNotification(t('providersPage.toast.created'), 'success');
        setShowCreateForm(false);
      }
      setIsDirty(false);
      setFormVersion((current) => current + 1);
    } catch (err) {
      if (isSponsorPartialMutationError(err)) {
        showNotification(t('providersPage.sponsor.partialMutationWarning'), 'warning');
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      showNotification(
        `${t(resource ? 'notification.update_failed' : 'notification.add_failed')}: ${msg}`,
        'error'
      );
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        <ProviderLogo logo={logo} size="lg" />
        <h2 className={styles.title}>{t('providersPage.providerNames.apikeyFun')}</h2>
      </div>
      {resource || showCreateForm ? (
        <a
          className="btn btn-ghost btn-sm"
          href={resource ? APIKEY_FUN_DASHBOARD_URL : APIKEY_FUN_AFFILIATE_URL}
          target="_blank"
          rel="noreferrer"
        >
          <span>
            {resource
              ? t('providersPage.sponsor.dashboardLink')
              : t('providersPage.sponsor.registerLink')}
          </span>
          <IconExternalLink size={14} />
        </a>
      ) : null}
    </div>
  );

  if (!resource && !showCreateForm) {
    return (
      <section className={styles.panel}>
        {header}

        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <IconKey size={18} />
          </span>
          <div className={styles.emptyText}>
            <p className={styles.emptyTitle}>{t('providersPage.sponsor.emptyRegisterHint')}</p>
            <p className={styles.emptyDescription}>
              {t('providersPage.sponsor.emptyDescription', {
                defaultValue: 'Add your APIKEY.FUN key here, or register for an account first.',
              })}
            </p>
          </div>
          <div className={styles.emptyActions}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateForm(true)}
              disabled={formMutating}
            >
              <IconPlus size={14} />
              {t('providersPage.actions.new')}
            </Button>
            <a
              className="btn btn-secondary btn-sm"
              href={APIKEY_FUN_AFFILIATE_URL}
              target="_blank"
              rel="noreferrer"
            >
              <span>{t('providersPage.sponsor.registerNow')}</span>
              <IconExternalLink size={14} />
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      {header}

      <SponsorProviderForm
        key={`${mode}:${resource?.id ?? 'new'}:${formVersion}`}
        resource={resource}
        mode={mode}
        mutating={formMutating}
        formId={formId}
        variant="quickStart"
        onSubmit={handleSubmit}
        onDirtyChange={setIsDirty}
      />

      <div className={styles.footer}>
        {!resource ? (
          <Button
            variant="ghost"
            onClick={() => {
              setShowCreateForm(false);
              setIsDirty(false);
              setFormVersion((current) => current + 1);
            }}
            disabled={submitting}
          >
            {t('providersPage.actions.cancel')}
          </Button>
        ) : null}
        <Button type="submit" form={formId} variant="primary" disabled={submitDisabled}>
          {submitting ? (
            <IconLoader2 className={styles.spin} size={16} />
          ) : mode === 'create' ? (
            <IconPlus size={16} />
          ) : (
            <IconCheckCircle2 size={16} />
          )}
          {mode === 'create' ? t('providersPage.actions.create') : t('providersPage.actions.save')}
        </Button>
      </div>
    </section>
  );
}
