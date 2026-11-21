import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { IconKey, IconRefreshCw } from '@/components/ui/icons';
import { usePageTransitionLayer } from '@/components/common/PageTransitionLayer';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { apiKeysApi } from '@/services/api/apiKeys';
import { guardConfigConnection } from '@/services/api/configValue';
import { useAuthStore, useConfigStore, useNotificationStore } from '@/stores';
import { apiKeyNameFingerprint } from './apiKeyNames';
import { parseApiKeyDraft, validateApiKeyDraft } from './apiKeyDraft';
import { ApiKeysCardEditor } from './components/blocks/ApiKeysCardEditor';
import { FloatingSaveBar } from './components/FloatingSaveBar';
import styles from './ApiKeysPage.module.scss';

export function ApiKeysPage() {
  const { apiBase, managementKey, connectionStatus } = useAuthStore();
  const scope = apiKeyNameFingerprint(apiBase, managementKey);
  return <ScopedApiKeysPage key={scope} connected={connectionStatus === 'connected'} />;
}

function ScopedApiKeysPage({ connected }: { connected: boolean }) {
  const { t } = useTranslation();
  const layer = usePageTransitionLayer();
  const active = layer ? layer.isCurrentLayer : true;
  const { showConfirmation, showNotification } = useNotificationStore();
  const [saved, setSaved] = useState<string[] | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const mounted = useRef(true);
  const dirty = saved !== null && draft !== saved.join('\n');

  const load = useCallback(async () => {
    if (!mounted.current) return;
    const id = ++request.current;
    const assertConnection = guardConfigConnection();
    setLoading(true);
    setError('');
    try {
      const config = await useConfigStore.getState().fetchConfig(true);
      assertConnection();
      if (id !== request.current) return;
      const keys = config.apiKeys ?? [];
      setSaved(keys);
      setDraft(keys.join('\n'));
    } catch (cause) {
      if (id !== request.current || (cause instanceof Error && cause.name === 'AbortError')) return;
      setError('api_keys_page.load_failed');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, []);

  useEffect(() => {
    if (connected) void load();
    return () => {
      request.current += 1;
    };
  }, [connected, load]);

  useUnsavedChangesGuard({
    enabled: active,
    shouldBlock: dirty || saving,
    dialog: {
      title: t('common.unsaved_changes_title'),
      message: t('common.unsaved_changes_message'),
      confirmText: t('common.leave'),
      cancelText: t('common.stay'),
    },
  });

  useEffect(() => {
    if (!dirty || !active) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [active, dirty]);

  const refresh = useCallback(() => {
    if (!connected || loading || saving) return;
    if (dirty) {
      showConfirmation({
        title: t('common.unsaved_changes_title'),
        message: t('api_keys_page.reload_confirm'),
        confirmText: t('common.refresh'),
        onConfirm: load,
      });
    } else void load();
  }, [connected, dirty, load, loading, saving, showConfirmation, t]);
  useHeaderRefresh(refresh, active);

  const save = async () => {
    if (!mounted.current || !saved || !dirty || !connected || saving || loading) return;
    const next = parseApiKeyDraft(draft);
    const validation = validateApiKeyDraft(next);
    if (validation) {
      setError(`config_management.visual.api_keys.error_${validation}`);
      return;
    }
    const id = ++request.current;
    const assertConnection = guardConfigConnection();
    setSaving(true);
    setError('');
    try {
      const replaced = await apiKeysApi.replaceIfUnchanged(saved, next);
      assertConnection();
      if (id !== request.current) return;
      if (!replaced) {
        setError('api_keys_page.conflict');
        return;
      }
      useConfigStore.getState().updateConfigValue('api-keys', next);
      setSaved(next);
      setDraft(next.join('\n'));
      showNotification(t('api_keys_page.saved'), 'success');
    } catch (cause) {
      if (id !== request.current || (cause instanceof Error && cause.name === 'AbortError')) return;
      setError('api_keys_page.save_failed');
    } finally {
      if (id === request.current) setSaving(false);
    }
  };

  const requestSave = () => {
    if (parseApiKeyDraft(draft).length === 0) {
      showConfirmation({
        title: t('api_keys_page.remove_all_title'),
        message: t('api_keys_page.remove_all_message'),
        variant: 'danger',
        confirmText: t('common.save'),
        onConfirm: save,
      });
    } else void save();
  };

  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.glyph} aria-hidden="true">
            <IconKey size={20} />
          </span>
          <div>
            <h1>{t('nav.api_keys')}</h1>
            <p>{t('api_keys_page.description')}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={refresh} disabled={!connected || loading || saving}>
          <IconRefreshCw size={16} aria-hidden="true" /> {t('common.refresh')}
        </Button>
      </header>

      {error && (
        <div className="error-box" role="alert">
          {t(error)}
        </div>
      )}

      <section className={styles.panel} aria-busy={loading}>
        {loading ? (
          <Skeleton height={192} />
        ) : saved !== null ? (
          <ApiKeysCardEditor
            value={draft}
            onChange={(value) => {
              setDraft(value);
              setError('');
            }}
            disabled={!connected || saving}
          />
        ) : (
          <Button variant="secondary" onClick={() => void load()} disabled={!connected}>
            {t('common.refresh')}
          </Button>
        )}
      </section>

      <p className={styles.note}>{t('api_keys_page.names_note')}</p>

      <FloatingSaveBar
        className={styles.saveBar}
        visible={dirty && active}
        statusText={t('api_keys_page.unsaved')}
        statusTone={saving ? 'busy' : error ? 'error' : 'warning'}
        saving={saving}
        saveDisabled={!connected || loading || saving}
        discardDisabled={saving || loading}
        onSave={requestSave}
        onDiscard={() => {
          setDraft(saved?.join('\n') ?? '');
          setError('');
        }}
      />
    </div>
  );
}
