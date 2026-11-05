import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { IconCheck, IconEye, IconEyeOff, IconPlus, IconSearch } from '@/components/ui/icons';
import { useAuthStore, useNotificationStore } from '@/stores';
import { apiKeyNameFingerprint, readApiKeyNames, saveApiKeyName } from '../../apiKeyNames';
import { copyToClipboard } from '@/utils/clipboard';
import { parseApiKeyDraft, validateApiKeyDraft } from '../../apiKeyDraft';
import { generateSecureApiKey } from '@/utils/apiKey';
import { maskApiKey } from '@/utils/format';
import { ApiKeyStrengthMeter } from './ApiKeyStrengthMeter';
import styles from './Blocks.module.scss';

interface ApiKeysCardEditorProps {
  value: string;
  disabled?: boolean;
  onChange: (nextValue: string) => void;
}

export const ApiKeysCardEditor = memo(function ApiKeysCardEditor(props: ApiKeysCardEditorProps) {
  const apiBase = useAuthStore((state) => state.apiBase);
  const managementKey = useAuthStore((state) => state.managementKey);
  const scope = apiKeyNameFingerprint(apiBase, managementKey);
  return <ScopedApiKeysCardEditor key={scope} {...props} apiBase={apiBase} />;
});

function ScopedApiKeysCardEditor({
  value,
  disabled,
  onChange,
  apiBase,
}: ApiKeysCardEditorProps & { apiBase: string }) {
  const [names, setNames] = useState(() => readApiKeyNames(apiBase));
  const [nameValue, setNameValue] = useState('');
  const [search, setSearch] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { t } = useTranslation();
  const { showNotification, showConfirmation } = useNotificationStore();
  const apiKeys = useMemo(() => parseApiKeyDraft(value), [value]);
  const latestKeys = useRef(apiKeys);
  const mounted = useRef(true);
  useEffect(() => {
    latestKeys.current = apiKeys;
  }, [apiKeys]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const nameFingerprints = useMemo(
    () => apiKeys.map((key) => apiKeyNameFingerprint(apiBase, key)),
    [apiBase, apiKeys]
  );
  useEffect(() => {
    if (copiedKey === null) return;
    const timer = window.setTimeout(() => setCopiedKey(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copiedKey]);

  const matchingKeys = apiKeys
    .map((key, index) => ({
      key,
      index,
      name: names[nameFingerprints[index]] ?? t('config_management.visual.api_keys.input_label'),
    }))
    .filter(({ key, name }) =>
      `${name} ${key}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    );

  const apiKeyInputId = useId();
  const formId = `${apiKeyInputId}-form`;
  const nameInputId = useId();
  const nameHintId = `${nameInputId}-hint`;
  const apiKeyHintId = `${apiKeyInputId}-hint`;
  const apiKeyErrorId = `${apiKeyInputId}-error`;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingApiKey, setEditingApiKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [formError, setFormError] = useState('');

  const openAddModal = () => {
    setNameValue('');
    setEditingApiKey(null);
    setShowKey(false);
    setInputValue('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (apiKey: string) => {
    const editingIndex = apiKeys.indexOf(apiKey);
    const latestNames = readApiKeyNames(apiBase);
    setNames(latestNames);
    setNameValue(latestNames[nameFingerprints[editingIndex]] ?? '');
    setEditingApiKey(apiKey);
    setShowKey(false);
    setInputValue(apiKeys[editingIndex] ?? '');
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setInputValue('');
    setEditingApiKey(null);
    setShowKey(false);
    setFormError('');
  };

  const updateApiKeys = (nextKeys: string[]) => {
    onChange(nextKeys.join('\n'));
  };

  const handleDelete = (apiKey: string, name: string) => {
    showConfirmation({
      title: t('config_management.visual.api_keys.delete_title'),
      message: t('config_management.visual.api_keys.delete_confirm', { name }),
      variant: 'danger',
      confirmText: t('common.delete'),
      onConfirm: () => {
        if (mounted.current) updateApiKeys(latestKeys.current.filter((key) => key !== apiKey));
      },
    });
  };

  const handleSave = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setFormError(t('config_management.visual.api_keys.error_empty'));
      return;
    }
    const editingIndex = editingApiKey === null ? -1 : apiKeys.indexOf(editingApiKey);
    if (editingApiKey !== null && editingIndex < 0) {
      setFormError(t('config_management.visual.api_keys.error_missing'));
      return;
    }
    const nextKeys =
      editingApiKey === null
        ? [...apiKeys, trimmed]
        : apiKeys.map((key, idx) => (idx === editingIndex ? trimmed : key));
    const validation = validateApiKeyDraft(nextKeys);
    if (validation) {
      setFormError(t(`config_management.visual.api_keys.error_${validation}`));
      return;
    }
    if (!saveApiKeyName(apiBase, trimmed, nameValue)) {
      setFormError(t('config_management.visual.api_keys.name_save_error'));
      return;
    }
    setNames(readApiKeyNames(apiBase));
    // Retain old fingerprints: configuration edits can still be discarded or fail to save.
    if (nextKeys.join('\n') !== apiKeys.join('\n')) updateApiKeys(nextKeys);
    setSearch('');
    closeModal();
  };

  const handleCopy = async (apiKey: string) => {
    const copied = await copyToClipboard(apiKey);
    if (copied) setCopiedKey(apiKey);
    else showNotification(t('notification.copy_failed'), 'error');
  };

  const handleGenerate = () => {
    setInputValue(generateSecureApiKey());
    setFormError('');
  };

  return (
    <div className={styles.apiKeys}>
      <div className={styles.apiKeysHeader}>
        <div className={styles.apiKeysCopy}>
          <span className={styles.apiKeysTitle}>
            {t('config_management.visual.api_keys.label')}
            <span className={styles.apiKeyCount}>{apiKeys.length}</span>
          </span>
          <span className={styles.apiKeysHint}>{t('config_management.visual.api_keys.hint')}</span>
        </div>
        <Button size="sm" onClick={openAddModal} disabled={disabled}>
          <IconPlus size={14} aria-hidden="true" /> {t('config_management.visual.api_keys.add')}
        </Button>
      </div>

      {apiKeys.length > 0 && (
        <div className={styles.apiKeySearch}>
          <IconSearch size={16} aria-hidden="true" />
          <input
            type="search"
            className="input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('config_management.visual.api_keys.search')}
            aria-label={t('config_management.visual.api_keys.search')}
          />
        </div>
      )}

      {apiKeys.length === 0 ? (
        <div className={styles.emptyState}>{t('config_management.visual.api_keys.empty')}</div>
      ) : matchingKeys.length === 0 ? (
        <div className={styles.emptyState} role="status">
          {t('config_management.visual.api_keys.no_matches')}
          <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
            {t('config_management.visual.api_keys.clear_search')}
          </Button>
        </div>
      ) : (
        <ol className={styles.apiKeyList}>
          {matchingKeys.map(({ key, index, name }) => (
            <li key={`${nameFingerprints[index]}-${index}`} className={styles.apiKeyRow}>
              <span className={styles.apiKeyIndex}>#{index + 1}</span>
              <span className={styles.apiKeyMeta}>
                <span className={styles.apiKeyName}>{name}</span>
                <span className={styles.apiKeyValue}>{maskApiKey(String(key || ''))}</span>
              </span>
              <span className={styles.apiKeyActions}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(key)}
                  aria-label={`${t(copiedKey === key ? 'config_management.visual.api_keys.copied' : 'common.copy')}: ${name}`}
                  aria-live="polite"
                >
                  {copiedKey === key ? (
                    <>
                      <IconCheck size={14} aria-hidden="true" />{' '}
                      {t('config_management.visual.api_keys.copied')}
                    </>
                  ) : (
                    t('common.copy')
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEditModal(key)}
                  aria-label={`${t('common.edit')}: ${name}`}
                  disabled={disabled}
                >
                  {t('config_management.visual.common.edit')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.apiKeyDelete}
                  onClick={() => handleDelete(key, name)}
                  aria-label={`${t('common.delete')}: ${name}`}
                  disabled={disabled}
                >
                  {t('config_management.visual.common.delete')}
                </Button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={
          editingApiKey !== null
            ? t('config_management.visual.api_keys.edit_title')
            : t('config_management.visual.api_keys.add_title')
        }
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={disabled}>
              {t('config_management.visual.common.cancel')}
            </Button>
            <Button type="submit" form={formId} disabled={disabled}>
              {editingApiKey !== null
                ? t('config_management.visual.common.update')
                : t('config_management.visual.common.add')}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            handleSave();
          }}
        >
          <div className="form-group">
            <label htmlFor={nameInputId}>{t('config_management.visual.api_keys.name_label')}</label>
            <input
              id={nameInputId}
              className="input"
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
              placeholder={t('config_management.visual.api_keys.name_placeholder')}
              aria-describedby={nameHintId}
              disabled={disabled}
            />
            <div id={nameHintId} className="hint">
              {t('config_management.visual.api_keys.name_hint')}
            </div>
          </div>
          <div className="form-group">
            <label htmlFor={apiKeyInputId}>
              {t('config_management.visual.api_keys.input_label')}
            </label>
            <div className={styles.apiKeyModalInputRow}>
              <input
                id={apiKeyInputId}
                className="input"
                type={showKey ? 'text' : 'password'}
                autoComplete="new-password"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t('config_management.visual.api_keys.input_placeholder')}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setFormError('');
                }}
                disabled={disabled}
                aria-describedby={formError ? `${apiKeyErrorId} ${apiKeyHintId}` : apiKeyHintId}
                aria-invalid={Boolean(formError)}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowKey((value) => !value)}
                disabled={disabled}
                aria-label={t(
                  showKey ? 'providersPage.form.hideApiKey' : 'providersPage.form.showApiKey'
                )}
                aria-pressed={showKey}
              >
                {showKey ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleGenerate}
                disabled={disabled}
              >
                {t('config_management.visual.api_keys.generate')}
              </Button>
            </div>
            <ApiKeyStrengthMeter value={inputValue} />
            <div id={apiKeyHintId} className="hint">
              {t('config_management.visual.api_keys.input_hint')}
            </div>
            {formError && (
              <div id={apiKeyErrorId} className="error-box" role="alert">
                {formError}
              </div>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}
