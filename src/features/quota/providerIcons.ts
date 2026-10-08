/**
 * Quota page provider marks, drawn bare (no tile behind them).
 *
 * Sourced from thesvg.org (MIT, https://github.com/glincker/thesvg) and vendored
 * under assets/icons/thesvg so the single-file build stays self-contained.
 * Providers thesvg.org doesn't carry (Devin) fall back to the shared auth-file icon.
 */

import iconAntigravity from '@/assets/icons/thesvg/antigravity.svg';
import iconClaude from '@/assets/icons/thesvg/claude.svg';
import iconCodexDark from '@/assets/icons/thesvg/codex-dark.svg';
import iconCodexLight from '@/assets/icons/thesvg/codex-light.svg';
import iconGrokDark from '@/assets/icons/thesvg/grok-dark.svg';
import iconGrokLight from '@/assets/icons/thesvg/grok-light.svg';
import iconKimiDark from '@/assets/icons/thesvg/kimi-dark.svg';
import iconKimiLight from '@/assets/icons/thesvg/kimi-light.svg';
import iconMeta from '@/assets/icons/thesvg/meta.svg';
import type { ResolvedTheme } from '@/types';
import { getAuthFileIcon } from '@/features/authFiles/constants';
import type { QuotaProviderType } from './providers/types';

type ThemedIcon = string | { light: string; dark: string };

const QUOTA_PROVIDER_ICONS: Partial<Record<QuotaProviderType, ThemedIcon>> = {
  antigravity: iconAntigravity,
  claude: iconClaude,
  codex: { light: iconCodexLight, dark: iconCodexDark },
  kimi: { light: iconKimiLight, dark: iconKimiDark },
  meta: iconMeta,
  xai: { light: iconGrokLight, dark: iconGrokDark },
};

export function getQuotaProviderIcon(
  type: QuotaProviderType,
  resolvedTheme: ResolvedTheme
): string | null {
  const icon = QUOTA_PROVIDER_ICONS[type];
  if (!icon) return getAuthFileIcon(type, resolvedTheme);
  if (typeof icon === 'string') return icon;
  return resolvedTheme === 'dark' ? icon.dark : icon.light;
}
