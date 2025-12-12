// term-lookup.service.ts
import { Injectable } from '@angular/core';
import { FrenchTermService } from './french-term.service';
import { GermanTermService } from './german-term.service';
import { TranslationService } from './translation.service';
import { TermRef } from '../models/term-ref';

export interface TermTooltipVm {
  title: string;
  subtitle?: string;
  lang: 'fr' | 'de';
  translations: TermRef[];
}

@Injectable({ providedIn: 'root' })
export class TermLookupService {
  constructor(
    private frenchTermService: FrenchTermService,
    private germanTermService: GermanTermService,
    private translations: TranslationService
  ) {}

  getText(ref: TermRef): string {
    if (ref.label) return ref.label;
    const t = this.getTerm(ref);
    return t?.term ?? `${ref.lang}:${ref.key}`;
  }

  getTooltipVm(ref: TermRef): TermTooltipVm {
    const t = this.getTerm(ref);
    const title = t?.term ?? `${ref.lang}:${ref.key}`;

    const genus = (t as any)?.genus ? `${(t as any).genus}` : '';
    const cat = (t as any)?.category ? `${(t as any).category}` : '';
    const subtitle = [genus, cat].filter(Boolean).join(' · ') || undefined;

    return {
      title,
      subtitle,
      lang: ref.lang,
      translations: this.getTranslations(ref),
    };
  }

  private getTranslations(ref: TermRef): TermRef[] {
    if (ref.lang === 'fr') {
      return this.translations.getGermanKeys(ref.key).map(key => ({ lang: 'de', key }));
    }
    return this.translations.getFrenchKeys(ref.key).map(key => ({ lang: 'fr', key }));
  }

  private getTerm(ref: TermRef): { term: string; category?: string } | undefined {
    return ref.lang === 'fr'
      ? this.frenchTermService.getByKey(ref.key)
      : this.germanTermService.getByKey(ref.key);
  }
}
