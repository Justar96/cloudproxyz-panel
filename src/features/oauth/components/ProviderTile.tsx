import { useId } from 'react';
import { IconExternalLink, IconPlus } from '@/components/ui/icons';
import type { ProviderFlowState } from '../hooks/useOAuthFlows';
import { BrandGlyph } from './BrandGlyph';
import styles from './ProviderTile.module.scss';

export interface ProviderTileProps {
  label: string;
  caption: string;
  icon: string;
  status?: ProviderFlowState['status'];
  statusLabel?: string;
  /** Featured provider: larger card with a separate registration action. */
  sponsor?: { url: string; label: string };
  onOpen: () => void;
}

/**
 * 提供商磁贴：整块可点（stretched button），点击即开始登录并打开授权对话框。
 * 副行平时说明登录方式，登录进行中改为实时状态 —— 对话框关着也能看到后台进度。
 * 赞助商变体的注册药丸是独立的第二个可聚焦目标，浮在 stretched 层之上。
 */
export function ProviderTile({
  label,
  caption,
  icon,
  status,
  statusLabel,
  sponsor,
  onOpen,
}: ProviderTileProps) {
  const captionId = useId();

  return (
    <div
      className={sponsor ? `${styles.tile} ${styles.sponsor}` : styles.tile}
      data-status={status ?? 'idle'}
    >
      <span className={styles.glyph}>
        <BrandGlyph src={icon} size={sponsor ? 40 : 20} className={styles.glyphImage} />
      </span>
      <span className={styles.text}>
        <button
          type="button"
          className={styles.main}
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-describedby={captionId}
        >
          {label}
        </button>
        <span className={styles.caption} id={captionId}>
          {status && statusLabel ? (
            <span className={styles.status}>
              <span className={styles.statusDot} aria-hidden="true" />
              {statusLabel}
            </span>
          ) : (
            <span className={styles.captionText}>{caption}</span>
          )}
        </span>
      </span>
      {sponsor && (
        <a
          className={styles.sponsorLink}
          href={sponsor.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {sponsor.label}
          <IconExternalLink size={12} aria-hidden="true" />
        </a>
      )}
      <span className={styles.trail} aria-hidden="true">
        <IconPlus size={15} />
      </span>
    </div>
  );
}
