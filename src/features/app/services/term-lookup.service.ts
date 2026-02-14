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
    const t = this.terms.getById(termId);

    // graceful fallback wenn term fehlt
    if (!t) {
      return {
        title: `#${termId}`,
        lang: 'fr',
        needsVowelArticle: false,
        translations: [],
      };
    }

    const linkedIds = this.links.getLinkedIds(t.lang, t.id);

    // Optional: wirklich nur "Gegensprache" zeigen
    const targetLang: Lang = t.lang === 'fr' ? 'de' : 'fr';

    const translations = linkedIds
      .map(id => this.terms.getById(id))
      .filter((x): x is TermRow => !!x)
      .filter(x => x.lang === targetLang);

    return {
      title: t.display,
      lang: t.lang,
      genus: t.genus,
      category: t.category,
      needsVowelArticle: t.lang === 'fr' && t.needsVowelArticle === true,
      translations,
    };
  }
}
