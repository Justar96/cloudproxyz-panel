import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconSearch, IconSlidersHorizontal, IconTrash2 } from '@/components/ui/icons';
import { MAX_CARD_PAGE_SIZE, MIN_CARD_PAGE_SIZE } from '@/features/authFiles/constants';
import type { AuthFilesSortMode, AuthFilesStatusFilterMode } from '@/features/authFiles/uiState';
import styles from './AuthFilesToolbar.module.scss';

export type AuthFilesToolbarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilterMode: AuthFilesStatusFilterMode;
  statusFilterOptions: Array<{ value: AuthFilesStatusFilterMode; label: string }>;
  onStatusFilterChange: (mode: AuthFilesStatusFilterMode) => void;
  sortMode: AuthFilesSortMode;
  sortOptions: Array<{ value: string; label: string }>;
  onSortModeChange: (value: string) => void;
  pageSizeInput: string;
  onPageSizeInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPageSizeCommit: (rawValue: string) => void;
  compactMode: boolean;
  onCompactModeChange: (value: boolean) => void;
  deleteLabel: string;
  deleteDisabled: boolean;
  deleteLoading: boolean;
  onDelete: () => void;
};

/**
 * One toolbar row: search · status segmented control · sort · display options.
 * The scoped "Delete all / filtered" action is a quiet danger-text button pushed to the end,
 * next to the filters that define its scope.
 */
export function AuthFilesToolbar(props: AuthFilesToolbarProps) {
  const {
    search,
    onSearchChange,
    statusFilterMode,
    statusFilterOptions,
    onStatusFilterChange,
    sortMode,
    sortOptions,
    onSortModeChange,
    pageSizeInput,
    onPageSizeInputChange,
    onPageSizeCommit,
    compactMode,
    onCompactModeChange,
    deleteLabel,
    deleteDisabled,
    deleteLoading,
    onDelete,
  } = props;
  const { t } = useTranslation();
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);
  const displaySettingsRef = useRef<HTMLDivElement>(null);
  const statusGroupRef = useRef<HTMLDivElement>(null);

  // Radio-group keyboard model: arrows move the selection, Home/End jump to the ends.
  const handleStatusKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const index = statusFilterOptions.findIndex((option) => option.value === statusFilterMode);
    const last = statusFilterOptions.length - 1;
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = index >= last ? 0 : index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = index <= 0 ? last : index - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next < 0) return;
    event.preventDefault();
    onStatusFilterChange(statusFilterOptions[next].value);
    const buttons = statusGroupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    buttons?.[next]?.focus();
  };

  useEffect(() => {
    if (!displaySettingsOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!displaySettingsRef.current?.contains(event.target as Node)) {
        setDisplaySettingsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDisplaySettingsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [displaySettingsOpen]);

  return (
    <div className={`on-canvas ${styles.toolbar}`}>
      <div className={styles.search}>
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t('auth_files.search_placeholder_short', {
            defaultValue: 'Search credentials',
          })}
          title={t('auth_files.search_placeholder')}
          aria-label={t('auth_files.search_label')}
          rightElement={<IconSearch className={styles.searchIcon} size={16} />}
        />
      </div>

      <div
        ref={statusGroupRef}
        className={`segmented ${styles.statusFilter}`}
        role="radiogroup"
        aria-label={t('auth_files.problem_filter_label')}
        onKeyDown={handleStatusKeyDown}
      >
        {statusFilterOptions.map((option) => {
          const isActive = statusFilterMode === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              className={`segmented-item ${isActive ? 'active' : ''}`}
              onClick={() => onStatusFilterChange(option.value)}
            >
              {option.value === 'problem' && (
                <span className={styles.problemDot} aria-hidden="true" />
              )}
              {option.label}
            </button>
          );
        })}
      </div>

      <div className={styles.sort}>
        <Select
          value={sortMode}
          options={sortOptions}
          onChange={onSortModeChange}
          ariaLabel={t('auth_files.sort_label')}
          size="sm"
        />
      </div>

      <div className={styles.display} ref={displaySettingsRef}>
        <button
          type="button"
          className={`${styles.displayButton} ${displaySettingsOpen ? styles.displayButtonActive : ''}`}
          aria-expanded={displaySettingsOpen}
          aria-controls="auth-files-display-settings"
          title={t('auth_files.display_options_label')}
          onClick={() => setDisplaySettingsOpen((open) => !open)}
        >
          <IconSlidersHorizontal size={16} />
          <span className={styles.displayLabel}>{t('auth_files.display_options_label')}</span>
        </button>

        {displaySettingsOpen && (
          <div id="auth-files-display-settings" className={styles.popover}>
            <div className={styles.popoverRow}>
              <label htmlFor="auth-files-page-size">{t('auth_files.page_size_label')}</label>
              <input
                id="auth-files-page-size"
                className={styles.pageSizeInput}
                type="number"
                min={MIN_CARD_PAGE_SIZE}
                max={MAX_CARD_PAGE_SIZE}
                step={1}
                value={pageSizeInput}
                onChange={onPageSizeInputChange}
                onBlur={(e) => onPageSizeCommit(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
            <div className={styles.popoverRow}>
              <span>{t('auth_files.compact_mode_label')}</span>
              <ToggleSwitch
                checked={compactMode}
                onChange={onCompactModeChange}
                ariaLabel={t('auth_files.compact_mode_label')}
              />
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className={styles.deleteAction}
        onClick={onDelete}
        disabled={deleteDisabled}
      >
        {deleteLoading ? <LoadingSpinner size={14} /> : <IconTrash2 size={16} />}
        {deleteLabel}
      </button>
    </div>
  );
}
