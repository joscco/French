import { normalizeForCheck } from '../../app/helpers/normalize';

export function plainDisplay(rawText: string): string {
  // remove { ... } segments and normalize spaces
  return (rawText ?? '')
    .replace(/{[^}]*}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearchText(rawText: string): string {
  return normalizeForCheck(plainDisplay(rawText));
}
