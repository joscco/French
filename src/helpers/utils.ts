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

export function indexBy<T extends {id: number}>(items: T[], getId: (t: T) => number): Record<number, T> {
  return items.reduce((acc, item) => {
    acc[getId(item)] = item;
    return acc;
  }, {} as Record<number, T>);
}

export function buildCardsFromFrench(
  frenchTerms: FrenchTerm[],
  germanTermById: Record<number, GermanTerm>,
  links: TranslationLink[]
): PracticeCard[] {
  const cards: PracticeCard[] = [];

  for (const fr of frenchTerms) {
    const linkedGerman = links
      .filter(l => l.frenchId === fr.id)
      .map(l => germanTermById[l.germanId])
      .filter(Boolean);

    // Wenn du willst, kannst du hier entscheiden:
    // - keine Links → Karte trotzdem, aber ohne Übersetzungen?
    // - oder solche Terms ignorieren
    if (!linkedGerman.length) {
      // optional: skip
      // continue;
    }

    const germanText = linkedGerman.map(g => g.term).join(', ');

    cards.push({
      id: `fr-${fr.id}`,
      headLanguage: 'fr',
      frenchPrimary: fr.term,
      frenchSecondary: '',
      germanPrimary: germanText,
      germanSecondary: '',

      meta: {
        lesson: fr.lesson,
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
  frenchTermById: Record<number, FrenchTerm>,
  links: TranslationLink[]
): PracticeCard[] {
  const cards: PracticeCard[] = [];

  for (const de of germanTerms) {
    const linkedFrench = links
      .filter(l => l.germanId === de.id)
      .map(l => frenchTermById[l.frenchId])
      .filter(Boolean);

    const frenchText = linkedFrench.map(f => f.term).join(', ');

    cards.push({
      id: `de-${de.id}`,
      headLanguage: 'de',
      frenchPrimary: frenchText,
      frenchSecondary: '',
      germanPrimary: de.term,
      germanSecondary: '',

      meta: {
        lesson: de.lesson,
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

