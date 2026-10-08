import type { ReactNode } from 'react';
import { useState } from 'react';
import { IconPlug } from '@/components/ui/icons';
import styles from './PluginPageParts.module.scss';

export type PluginTone = 'success' | 'attention' | 'danger' | 'neutral';

const toneClass: Record<PluginTone, string> = {
  success: styles.toneSuccess,
  attention: styles.toneAttention,
  danger: styles.toneDanger,
  neutral: styles.toneNeutral,
};

/** Logo tile shared by installed rows and store cards; falls back to a plug glyph. */
export function PluginLogo({ src, size = 40 }: { src: string; size?: 40 | 48 }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <span className={`${styles.logo} ${size === 48 ? styles.logoLarge : ''}`} aria-hidden="true">
      {showImage ? (
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <IconPlug size={18} />
      )}
    </span>
  );
}

/** A status dot that always sits beside a text label, never alone. */
export function StatusDot({ tone }: { tone: PluginTone }) {
  return <span className={`${styles.dot} ${toneClass[tone]}`} aria-hidden="true" />;
}

interface RuntimeSummaryItem {
  label: string;
  value: ReactNode;
  mono?: boolean;
  title?: string;
}

/** One quiet card of runtime facts (global switch, directory, counts). */
export function PluginRuntimeSummary({
  statusLabel,
  enabled,
  enabledLabel,
  disabledLabel,
  items,
}: {
  statusLabel: string;
  enabled: boolean;
  enabledLabel: string;
  disabledLabel: string;
  items: RuntimeSummaryItem[];
}) {
  return (
    <dl className={styles.summary}>
      <div className={styles.summaryItem}>
        <dt>{statusLabel}</dt>
        <dd>
          <StatusDot tone={enabled ? 'success' : 'attention'} />
          {enabled ? enabledLabel : disabledLabel}
        </dd>
      </div>
      {items.map((item) => (
        <div key={item.label} className={styles.summaryItem}>
          <dt>{item.label}</dt>
          <dd className={item.mono ? styles.summaryMono : styles.summaryNumber} title={item.title}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Inline notice. Attention/danger tint only for real states; neutral for guidance. */
export function PluginCallout({
  tone,
  icon,
  title,
  children,
  action,
  role,
}: {
  tone: Exclude<PluginTone, 'success'>;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  role?: 'note' | 'alert' | 'status';
}) {
  const toneStyle =
    tone === 'danger'
      ? styles.calloutDanger
      : tone === 'attention'
        ? styles.calloutAttention
        : styles.calloutNeutral;

  return (
    <div className={`${styles.callout} ${toneStyle}`} role={role}>
      {icon ? <span className={styles.calloutIcon}>{icon}</span> : null}
      <div className={styles.calloutBody}>
        {title ? <div className={styles.calloutTitle}>{title}</div> : null}
        {children ? <div className={styles.calloutText}>{children}</div> : null}
      </div>
      {action ? <div className={styles.calloutAction}>{action}</div> : null}
    </div>
  );
}
