import { Injectable, computed, inject, signal } from '@angular/core';
import { TermsService } from '../../../services/terms.service';
import { TermLinksService } from '../../../services/termLinks.service';
import { AllowedTermsService } from './sentence-ref.service';
import { WordCard } from '../models/word-card';
import { TermRow, Lang } from '../../../shared/contract/contract';

export type PracticeMode = 'fr-de' | 'de-fr';

@Injectable({ providedIn: 'root' })
export class WordService {
  private termsService = inject(TermsService);
  private linksService = inject(TermLinksService);
  private allowedTermsService = inject(AllowedTermsService);

  readonly mode = signal<PracticeMode>('de-fr');

  readonly words = computed<WordCard[]>(() => {
    const currentMode = this.mode();
    const allowedIds = this.allowedTermsService.allowedTermIds();

    const allTerms = this.termsService.terms();
    const filteredTerms = allowedIds.size === 0 ? allTerms : allTerms.filter(term => allowedIds.has(term.id));

    const termsById = this.termsService.byId();

    const frontLanguage: Lang = currentMode === 'fr-de' ? 'fr' : 'de';
    const backLanguage: Lang = frontLanguage === 'fr' ? 'de' : 'fr';

    const cards: WordCard[] = [];

    for (const term of filteredTerms) {
      if (term.lang !== frontLanguage) {
        continue;
      }

      const linkedIds = this.linksService.getLinkedIds(term.lang, term.id);
      const bestTranslation = linkedIds
        .map(id => termsById.get(id))
        .find((t): t is TermRow => !!t);

      if (!bestTranslation) {
        continue;
      }

      if (bestTranslation.lang !== backLanguage) {
        continue;
      }

      const frenchTerm = frontLanguage === 'fr' ? term : bestTranslation;
      const germanTerm = frontLanguage === 'de' ? term : bestTranslation;

      cards.push({
        id: term.id,
        headLanguage: term.lang,
        frenchPrimary: frenchTerm.term_text,
        germanPrimary: germanTerm.term_text,
        frenchSecondary: undefined,
        germanSecondary: undefined,
        meta: {
          category: term.category,
          fr_genus: frenchTerm.genus,
          de_genus: germanTerm.genus,
          fr_needs_vowel_article: frenchTerm.needsVowelArticle ?? false,
        },
        frontLanguage,
      });
    }

    const collator = new Intl.Collator(frontLanguage === 'fr' ? 'fr' : 'de', { sensitivity: 'base' });
    cards.sort((a, b) => {
      const keyA = frontLanguage === 'fr' ? a.frenchPrimary : a.germanPrimary;
      const keyB = frontLanguage === 'fr' ? b.frenchPrimary : b.germanPrimary;
      return collator.compare(keyA, keyB) || a.id - b.id;
    });

    return cards;
  });
}
