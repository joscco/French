export interface NormalizeOptions {
  ignoreCase?: boolean;
  ignoreAccents?: boolean;
  normalizeWhitespace?: boolean;
  normalizeQuotes?: boolean;
  normalizePunctuationSpacing?: boolean;
}

export function normalizeForCheck(input: string, opt: NormalizeOptions = {}): string {
  let s = (input ?? '').trim();

  if (opt.normalizeQuotes ?? true) {
    s = s
      .replace(/[’‘]/g, "'")
      .replace(/[“”]/g, '"');
  }

  if (opt.normalizeWhitespace ?? true) {
    s = s.replace(/\s+/g, ' ');
  }

  if (opt.normalizePunctuationSpacing ?? true) {
    // z.B. "Bonjour ,  ça va ?" -> "Bonjour, ça va?"
    s = s
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])([^\s])/g, '$1 $2');
  }

  if (opt.ignoreAccents ?? true) {
    // Unicode diacritics entfernen
    s = s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  }

  if (opt.ignoreCase ?? true) {
    s = s.toLowerCase();
  }

  return s;
}
