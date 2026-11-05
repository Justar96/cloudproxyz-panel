import { isValidApiKeyCharset } from '@/utils/validation';

export function parseApiKeyDraft(value: string): string[] {
  return value
    .split('\n')
    .map((key) => key.trim())
    .filter(Boolean);
}

export function validateApiKeyDraft(keys: string[]): 'invalid' | 'duplicate' | null {
  if (keys.some((key) => !isValidApiKeyCharset(key))) return 'invalid';
  if (new Set(keys).size !== keys.length) return 'duplicate';
  return null;
}
