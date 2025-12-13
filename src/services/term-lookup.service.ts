// term-lookup.service.ts
import {Injectable} from '@angular/core';
import {FrenchTermService} from './french-term.service';
import {GermanTermService} from './german-term.service';
import {TranslationService} from './translation.service';
import {TermRefInSentence} from '../models/term-ref-in-sentence';
import {Language} from '../models/types';
import {FrenchTerm} from '../models/french-term';
import {GermanTerm} from '../models/german-term';

export interface TermTooltipVm {
  title: string;
  lang: Language;
  genus?: string;
  category?: string;
  needsVowelArticle: boolean;
  translations: (FrenchTerm | GermanTerm)[];
}

@Injectable({providedIn: 'root'})
export class TermLookupService {
  constructor(
    private frenchTermService: FrenchTermService,
    private germanTermService: GermanTermService,
    private translations: TranslationService
  ) {
  }

  getTooltipVm(ref: TermRefInSentence): TermTooltipVm {
    const t = this.getTerm(ref);
    const title = t?.term ?? `${ref.lang}:${ref.key}`;

    const genus = (t as any)?.genus ? `${(t as any).genus}` : '';
    const category = (t as any)?.category ? `${(t as any).category}` : '';
    const needsVowelArticle = ref.lang === 'french' && (t as any)?.needsVowelArticle === true;

    return {
      title,
      lang: ref.lang,
      genus,
      category,
      needsVowelArticle,
      translations: this.getTranslations(ref),
    };
  }

  private getTranslations(ref: TermRefInSentence): (FrenchTerm | GermanTerm)[] {
    if (ref.lang === 'french') {
      return this.translations.getGermanKeys(ref.key)
        .map(key => this.germanTermService.getByKey(key))
        .filter(t => !!t);
    }
    return this.translations.getFrenchKeys(ref.key)
      .map(key => this.frenchTermService.getByKey(key))
      .filter((t => !!t));
  }

  private getTerm(ref: TermRefInSentence): FrenchTerm | GermanTerm | undefined {
    return ref.lang === 'french'
      ? this.frenchTermService.getByKey(ref.key)
      : this.germanTermService.getByKey(ref.key);
  }
}
