export function normalizeForCheck(input: string): string {
  let s = (input ?? '').trim();

  // Normalize quotes
  // "l’amour" == "l'amour", „Bonjour“ == "Bonjour"
  s = s
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"');

  // Ignore punctuation
  // "Bonjour." == "Bonjour", "Salut, ça va ?" == "Salut ca va"
  s = s.replace(/\p{P}+/gu, ' ');

  // Normalize whitespace
  // "Bonjour   ça   va" == "Bonjour ça va"
  s = s.replace(/\s+/g, ' ');

  // Normalize punctuation spacing
  // "Bonjour ,ça va ?" == "Bonjour, ça va?"
  s = s
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])([^\s])/g, '$1 $2');

  // Ignore accents
  // "français" == "francais", "ça" == "ca"
  s = s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

  // Ignore case
  // "Bonjour" == "bonjour"
  s = s.toLowerCase();

  return s.trim();
}
