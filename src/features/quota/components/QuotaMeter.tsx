/**
 * 额度水位条（原 QuotaProgressBar 的类型化后继）。
 *
 * dataviz 语法：细轨道退居背景，填充按剩余量三档分类（≥70 High / ≥30 Medium / <30 Low），
 * 颜色由宿主外衣决定。percent === null 渲染空轨道 —— 未知不着色。
 * `data-level` 额外标出 exhausted（剩余 0，填充宽度为 0，宿主可给轨道着危险色）。
 * `index` 写入 `--meter-index`，供全页外衣做逐行入场级差；紧凑外衣不消费该变量。
 */

import type { CSSProperties } from 'react';
import type { QuotaClassMap } from '../types';

export const QUOTA_PROGRESS_HIGH_THRESHOLD = 70;
export const QUOTA_PROGRESS_MEDIUM_THRESHOLD = 30;

export interface QuotaMeterProps {
  percent: number | null;
  classes: QuotaClassMap;
  index?: number;
}

export function QuotaMeter({ percent, classes, index }: QuotaMeterProps) {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const normalized = percent === null ? null : clamp(percent, 0, 100);
  const fillClass =
    normalized === null
      ? classes.quotaBarFillMedium
      : normalized >= QUOTA_PROGRESS_HIGH_THRESHOLD
        ? classes.quotaBarFillHigh
        : normalized >= QUOTA_PROGRESS_MEDIUM_THRESHOLD
          ? classes.quotaBarFillMedium
          : classes.quotaBarFillLow;
  const widthPercent = Math.round((normalized ?? 0) * 100) / 100;
  const style: CSSProperties & { '--meter-index'?: number } = { width: `${widthPercent}%` };
  if (index !== undefined) {
    style['--meter-index'] = index;
  }

  const level =
    normalized === null
      ? 'unknown'
      : normalized <= 0
        ? 'exhausted'
        : normalized < QUOTA_PROGRESS_MEDIUM_THRESHOLD
          ? 'low'
          : 'ok';

  return (
    <div className={classes.quotaBar} data-level={level}>
      <div className={`${classes.quotaBarFill} ${fillClass}`} style={style} />
    </div>
  );
}
