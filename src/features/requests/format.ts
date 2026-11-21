import { formatCompactNumber } from '@/utils/format';

export const formatTokens = (value: number): string =>
  value >= 10_000 ? formatCompactNumber(value) : value.toLocaleString();

export const formatDuration = (ms: number): string => {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
};

/** Time of day for records from today; date and time otherwise. */
export const formatRequestTime = (timestamp: number, locale: string, now = Date.now()): string => {
  const date = new Date(timestamp);
  const sameDay = new Date(now).toDateString() === date.toDateString();
  return date.toLocaleString(locale, {
    ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};
