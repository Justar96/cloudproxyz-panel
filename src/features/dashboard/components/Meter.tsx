import { toneForSuccessRate, type MeterTone } from '../utils';
import styles from './Meter.module.scss';

/** 健康时用中性石墨；只有需要处理时才上状态色（数值文本始终可见） */
const TONE_COLORS: Record<MeterTone, string> = {
  good: 'var(--viz-neutral)',
  warning: 'var(--viz-warning)',
  critical: 'var(--viz-failure)',
  idle: 'var(--text-disabled)',
};

interface MeterProps {
  /** 0–100；null 表示窗口内无请求 */
  value: number | null;
  tone?: MeterTone;
  ariaLabel: string;
  className?: string;
}

/**
 * 细条计量器：健康时为中性石墨，降级/失败时换成状态色。
 */
export function Meter({ value, tone, ariaLabel, className }: MeterProps) {
  const resolvedTone = tone ?? toneForSuccessRate(value);
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));

  return (
    <div
      className={[styles.track, className].filter(Boolean).join(' ')}
      style={{ '--meter-fill': TONE_COLORS[resolvedTone] } as React.CSSProperties}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(clamped)}
      aria-label={ariaLabel}
    >
      <div className={styles.fill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
