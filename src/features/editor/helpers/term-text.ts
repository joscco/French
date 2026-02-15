export function plainDisplay(rawText: string): string {
  // remove { ... } segments and normalize spaces
  return (rawText ?? '')
    .replace(/\{[^}]*\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSearchText(rawText: string): string {

  return plainDisplay(rawText)
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase();

}
