import {Genus, Lang} from '../../../shared/contract/contract';

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
