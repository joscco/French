import { Genus, Lang, TermLinkRow, TermRow } from '../../../shared/contract/contract';
import { WordCard } from '../models/word-card';

export function reverseLanguage(lang: Lang): Lang {
  return lang === 'fr' ? 'de' : 'fr';
}

// ---------- Genus / Artikel ----------

export function beautifyGenus(genus?: Genus): string {
  if (!genus) {
    return '';
  }

  switch (genus) {
    case 'm': return 'm.';
    case 'f': return 'f.';
    case 'n': return 'n.';
    case 'pl': return 'pl.';
    case 'mpl': return 'm.pl.';
    case 'fpl': return 'f.pl.';
    case 'npl': return 'n.pl.';
    case 'm/f': return 'm./f.';
    default: return '';
  }
}

export function getArticle(language: Lang, genus?: Genus, needsFrenchVowelArticle = false): string {
  if (!genus) {
    return '?';
  }

  if (language === 'de') {
    switch (genus) {
      case 'm': return 'der';
      case 'f': return 'die';
      case 'n': return 'das';
      case 'pl':
      case 'mpl':
      case 'fpl':
      case 'npl':
        return 'die';
      case 'm/f':
        return 'der/die';
      default:
        return '';
    }
  }

  // fr
  if (needsFrenchVowelArticle) {
    return "l'";
  }
  switch (genus) {
    case 'm': return 'le';
    case 'f': return 'la';
    case 'pl':
    case 'mpl':
    case 'fpl':
    case 'npl':
      return 'les';
    case 'm/f':
      return 'le/la';
    default:
      return '';
  }
}

/**
 * Für UI-Output: setzt Artikel nur, wenn genus vorhanden ist.
 * - FR: beachtet needsVowelArticle ausschließlich über Flag
 * - DE: plural -> "die"
 */
export function withArticle(display: string, lang: Lang, genus?: Genus, needsVowelArticle?: boolean): string {
  const word = (display ?? '').trim();
  if (!word) {
    return word;
  }
  if (!genus) {
    return word;
  }

  if (lang === 'fr') {
    const article = getArticle('fr', genus, !!needsVowelArticle);
    if (!article) {
      return word;
    }
    if (article === "l'") {
      return `${article}${word}`; // kein Leerzeichen
    }
    return `${article} ${word}`;
  }

  const article = getArticle('de', genus, false);
  if (!article) {
    return word;
  }
  return `${article} ${word}`;
}

// ---------- Indizes ----------

export function indexById<T extends { id: number }>(items: T[]): Map<number, T> {
  const itemMap = new Map<number, T>();
  for (const item of items) {
    itemMap.set(item.id, item);
  }
  return itemMap;
}

// ---------- TermLinks (ID-basiert) ----------

/**
 * Baut schnelle Indizes aus der flachen term_links.csv:
 * - fr_id -> [{de_id, priority}]
 * - de_id -> [{fr_id, priority}]
 */
export function buildTermLinkIndex(links: TermLinkRow[]) {
  const linksByFrenchId = new Map<number, TermLinkRow[]>();
  const linksByGermanId = new Map<number, TermLinkRow[]>();

  for (const link of links) {
    (linksByFrenchId.get(link.fr_id) ?? linksByFrenchId.set(link.fr_id, []).get(link.fr_id)!).push(link);
    (linksByGermanId.get(link.de_id) ?? linksByGermanId.set(link.de_id, []).get(link.de_id)!).push(link);
  }

  const sortByPriority = (a: TermLinkRow, b: TermLinkRow) =>
    (a.priority ?? 999) - (b.priority ?? 999);

  for (const linkArray of linksByFrenchId.values()) {
    linkArray.sort(sortByPriority);
  }
  for (const linkArray of linksByGermanId.values()) {
    linkArray.sort(sortByPriority);
  }

  return { byFr: linksByFrenchId, byDe: linksByGermanId };
}

/**
 * Liefert die verlinkten IDs auf der Gegenseite.
 * Erwartet: links sind nach priority sortiert (siehe buildTermLinkIndex oder TermLinksService).
 */
export function getLinkedIds(
  lang: Lang,
  id: number | null | undefined,
  linksByFrenchId: Map<number, TermLinkRow[]>,
  linksByGermanId: Map<number, TermLinkRow[]>,
): number[] {
  if (id == null) {
    return [];
  }
  if (lang === 'fr') {
    return (linksByFrenchId.get(id) ?? []).map(link => link.de_id);
  }
  return (linksByGermanId.get(id) ?? []).map(link => link.fr_id);
}

// ---------- WordCards ----------

/**
 * Baut Karten im Modus:
 * - 'fr-de': Vorderseite FR, Rückseite DE
 * - 'de-fr': Vorderseite DE, Rückseite FR
 *
 * Regeln:
 * - “head” wird aus der passenden Sprache gewählt
 * - best translation = erster Link (prio-sortiert)
 * - nur Terms berücksichtigen, die in allowedIds drin sind (wenn Set nicht leer)
 */
export function buildWordCards(
  mode: 'fr-de' | 'de-fr',
  allTerms: TermRow[],
  links: TermLinkRow[],
  allowedIds?: Set<number>,
  options?: { withArticles?: boolean },
): WordCard[] {
  const includeArticles = options?.withArticles ?? false;

  const { byFr: linksByFrenchId, byDe: linksByGermanId } = buildTermLinkIndex(links);
  const termsById = indexById(allTerms);

  const relevantTerms =
    !allowedIds || allowedIds.size === 0
      ? allTerms
      : allTerms.filter(term => allowedIds.has(term.id));

  const cards: WordCard[] = [];

  for (const term of relevantTerms) {
    const headLanguage: Lang = mode === 'fr-de' ? 'fr' : 'de';

    // Best translation (prio 1) auf Gegenseite
    const linkedIds = getLinkedIds(term.lang, term.id, linksByFrenchId, linksByGermanId);
    const bestTranslation = linkedIds.map(id => termsById.get(id)).find(Boolean);

    if (!bestTranslation) {
      continue;
    }

    // Head wählen: entweder term selbst, wenn Sprache passt, sonst bestTranslation
    const headTerm = (term.lang === headLanguage) ? term : bestTranslation;
    const otherTerm = headTerm.id === term.id ? bestTranslation : term;

    const frenchText = includeArticles
      ? withArticle(headTerm.lang === 'fr' ? headTerm.display : otherTerm.display, 'fr', headTerm.lang === 'fr' ? headTerm.genus : otherTerm.genus, headTerm.lang === 'fr' ? headTerm.needsVowelArticle : otherTerm.needsVowelArticle)
      : (headTerm.lang === 'fr' ? headTerm.display : otherTerm.display);

    const germanText = includeArticles
      ? withArticle(headTerm.lang === 'de' ? headTerm.display : otherTerm.display, 'de', headTerm.lang === 'de' ? headTerm.genus : otherTerm.genus, undefined)
      : (headTerm.lang === 'de' ? headTerm.display : otherTerm.display);

    cards.push({
      id: headTerm.id,
      headLanguage: headTerm.lang,
      frenchPrimary: frenchText,
      germanPrimary: germanText,
    });
  }

  // optional: stabil sortieren
  cards.sort((a, b) => a.id - b.id);
  return cards;
}
