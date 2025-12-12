import {PracticeCard} from '../models/practice-card';
import {TranslationLink} from '../models/translation-link';
import {GermanTerm} from '../models/german-term';
import {FrenchTerm} from '../models/french-term';
import {Language} from '../models/types';

export function reverseLanguage(lang: Language): Language {
  return lang === 'french' ? 'german' : 'french';
}

export function beautifyGenus(genus?: string): string {
  if (!genus) {
    return '';
  }

  switch (genus) {
    case 'm':
      return 'm.';
    case 'f':
      return 'f.';
    case 'n':
      return 'n.';
    case 'pl':
      return 'pl.';
    case 'mpl':
      return 'm.pl.';
    case 'fpl':
      return 'f.pl.';
    case 'npl':
      return 'n.pl.';
    case 'm/f':
      return 'm./f.';
    default:
      return '';
  }
}

export function indexByKey<T extends { key: string }>(items: T[]): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of items) {
    out[item.key] = item;
  }
  return out;
}

function buildLinkIndex(links: TranslationLink[]) {
  const frToDe = new Map<string, string[]>();
  const deToFr = new Map<string, string[]>();

  for (const l of links) {
    const fr = (l as any).frKey ?? (l as any).fr; // falls du noch umstellst
    const de = (l as any).deKey ?? (l as any).de;

    if (!fr || !de) continue;

    (frToDe.get(fr) ?? frToDe.set(fr, []).get(fr)!).push(de);
    (deToFr.get(de) ?? deToFr.set(de, []).get(de)!).push(fr);
  }

  return { frToDe, deToFr };
}

export function buildCardsFromFrench(
  frenchTerms: FrenchTerm[],
  germanByKey: Record<string, GermanTerm>,
  links: TranslationLink[]
): PracticeCard[] {
  const { frToDe } = buildLinkIndex(links);

  const cards: PracticeCard[] = [];

  for (const fr of frenchTerms) {
    const deKeys = frToDe.get(fr.key) ?? [];
    const linkedGerman = deKeys.map(k => germanByKey[k]).filter(Boolean);

    const germanText = linkedGerman.map(g => g.term).join(', ');

    cards.push({
      id: `fr-${fr.key}`,
      headLanguage: 'fr',
      frenchPrimary: fr.term,
      frenchSecondary: '',
      germanPrimary: germanText,
      germanSecondary: '',
      meta: {
        // lesson: ??? -> nur sinnvoll, wenn du sie aus SentenceRefs herleitest
        category: fr.category,
        fr_genus: fr.genus,
        de_genus: linkedGerman[0]?.genus,
        fr_needs_vowel_article: !!fr.needsVowelArticle,
      },
      frontLanguage: 'french',
    });
  }

  return cards;
}


export function buildCardsFromGerman(
  germanTerms: GermanTerm[],
  frenchByKey: Record<string, FrenchTerm>,
  links: TranslationLink[]
): PracticeCard[] {
  const { deToFr } = buildLinkIndex(links);

  const cards: PracticeCard[] = [];

  for (const de of germanTerms) {
    const frKeys = deToFr.get(de.key) ?? [];
    const linkedFrench = frKeys.map(k => frenchByKey[k]).filter(Boolean);

    const frenchText = linkedFrench.map(f => f.term).join(', ');

    cards.push({
      id: `de-${de.key}`,
      headLanguage: 'de',
      frenchPrimary: frenchText,
      frenchSecondary: '',
      germanPrimary: de.term,
      germanSecondary: '',
      meta: {
        category: de.category,
        fr_genus: linkedFrench[0]?.genus,
        de_genus: de.genus,
        fr_needs_vowel_article: !!linkedFrench[0]?.needsVowelArticle,
      },
      frontLanguage: 'german',
    });
  }

  return cards;
}

