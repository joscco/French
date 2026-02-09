import {WordCard} from '../models/word-card';
import {TranslationLink} from '../models/translation-link';
import {GermanTerm} from '../models/german-term';
import {FrenchTerm} from '../models/french-term';
import {Language} from '../models/types';
import {Genus} from '../models/editor-model';

export function reverseLanguage(lang: Language): Language {
  return lang === 'french' ? 'german' : 'french';
}

export function beautifyGenus(genus?: Genus): string {
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

export function withFrenchArticle(word: string, genus?: Genus, needsVowelArticle?: boolean): string {
  const frenchWord = (word || '').trim();
  if (!frenchWord) {
    return frenchWord;
  }
  const frenchGender = (genus || '').toLowerCase();
  if (!frenchGender) {
    return frenchWord;
  } // kein Artikel für verbe/adjectif etc.

  const isPlural = frenchGender.includes('pl');
  const isMasc = frenchGender.includes('m');
  const isFem = frenchGender.includes('f');

  if (isPlural) {
    return `les ${frenchWord} (${beautifyGenus(genus)})`;
  }

  // Nur auf den Flag fr_needs_vowel_article achten (kein Heuristik-Check des ersten Buchstabens)
  if (needsVowelArticle) {
    return `l'${frenchWord} (${beautifyGenus(genus)})`;
  }

  if (isMasc) {
    return `le ${frenchWord}`;
  }
  if (isFem) {
    return `la ${frenchWord}`;
  }
  return frenchWord;
}

export function withGermanArticle(word: string, genus?: string): string {
  const germanWord = (word || '').trim();
  if (!germanWord) {
    return germanWord;
  }
  const germanGender = (genus || '').toLowerCase();
  if (!germanGender) {
    return germanWord;
  }

  const isPlural = germanGender.includes('pl');
  const isMasc = germanGender.includes('m') && !isPlural;
  const isFem = germanGender.includes('f') && !isPlural;
  const isNeut = germanGender.includes('n') && !isPlural;

  if (isPlural) {
    return `die ${germanWord}`;
  }
  if (isMasc) {
    return `der ${germanWord}`;
  }
  if (isFem) {
    return `die ${germanWord}`;
  }
  if (isNeut) {
    return `das ${germanWord}`;
  }
  return germanWord;
}


export function getArticle(language: Language, genus: Genus, needsFrenchVowelArticle: boolean): string {
  if (language === 'german') {
    switch (genus) {
      case 'm':
        return 'der';
      case 'f':
        return 'die';
      case 'n':
        return 'das';
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
  if (language === 'french') {
    if (needsFrenchVowelArticle) {
      return 'l\'';
    }
    switch (genus) {
      case 'm':
        return 'le';
      case 'f':
        return 'la';
      case 'mpl':
        return 'les';
      case 'fpl':
        return 'les';
      case 'm/f':
        return 'le/la';
      default:
        return '';
    }
  }
  return '';
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
): WordCard[] {
  const { frToDe } = buildLinkIndex(links);

  const cards: WordCard[] = [];

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
): WordCard[] {
  const { deToFr } = buildLinkIndex(links);

  const cards: WordCard[] = [];

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

