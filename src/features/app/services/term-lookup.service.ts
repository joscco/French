import { Injectable, inject } from '@angular/core';
import {Genus, Lang, TermRow} from '../../../shared/contract/contract';
import { TermsService } from '../../../services/terms.service';
import { TermLinksService } from '../../../services/termLinks.service';

export interface TermTooltipVm {
  title: string;
  lang: Lang;
  genus?: Genus;
  category?: string;
  needsVowelArticle: boolean;
  translations: TermRow[];
}

@Injectable({ providedIn: 'root' })
export class TermLookupService {
  private terms = inject(TermsService);
  private links = inject(TermLinksService);

  getTooltipVm(termId: number): TermTooltipVm {
    const term = this.terms.getById(termId);

    if (!term) {
      return {
        title: `#${termId}`,
        lang: 'fr',
        needsVowelArticle: false,
        translations: [],
      };
    }

    const linkedIds = this.links.getLinkedIds(term.lang, term.id);

    const targetLang: Lang = term.lang === 'fr' ? 'de' : 'fr';

    const translations = linkedIds
      .map(id => this.terms.getById(id))
      .filter((row): row is TermRow => !!row)
      .filter(row => row.lang === targetLang);

    return {
      title: term.term_text,
      lang: term.lang,
      genus: term.genus,
      category: term.category,
      needsVowelArticle: term.lang === 'fr' && term.needsVowelArticle === true,
      translations,
    };
  }
}
