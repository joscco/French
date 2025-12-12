// term-lookup.service.ts
import { Injectable } from '@angular/core';
import { FrenchTermService } from './french-term.service';
import { GermanTermService } from './german-term.service';
import { TranslationService } from './translation.service';
import { TermRef } from '../models/term-ref';

export interface TermTooltipVm {
  title: string;              // Grundform
  subtitle?: string;          // z.B. Kategorie/Genus
  lang: 'fr' | 'de';
  translations: TermRef[];    // klickbare Gegen-Links
}

@Injectable({ providedIn: 'root' })
export class TermLookupService {
  constructor(
    private frenchTermService: FrenchTermService,
    private germanTermService: GermanTermService,
    private translations: TranslationService
  ) {}

  getText(ref: TermRef): string {
    // im Text wollen wir die Satz-Phrase markieren
    if (ref.label) return ref.label;

    const t = this.getTerm(ref);
    return t?.term ?? `${ref.lang}:${ref.id}`;
  }

  getTooltipVm(ref: TermRef): TermTooltipVm {
    const t = this.getTerm(ref);
    const title = t?.term ?? `${ref.lang}:${ref.id}`;

    const genus = (t as any)?.genus ? `${(t as any).genus}` : '';
    const cat = t?.category ? `${t.category}` : '';
    const subtitle = [genus, cat].filter(Boolean).join(' · ') || undefined;

    return {
      title,
      subtitle,
      lang: ref.lang,
      translations: this.getTranslations(ref),
    };
  }

  private getTranslations(ref: TermRef): TermRef[] {
    const links = this.translations.links();

    if (ref.lang === 'fr') {
      const germanIds = links.filter(l => l.frenchId === ref.id).map(l => l.germanId);
      return germanIds.map(id => ({ lang: 'de', id }));
    } else {
      const frenchIds = links.filter(l => l.germanId === ref.id).map(l => l.frenchId);
      return frenchIds.map(id => ({ lang: 'fr', id }));
    }
  }

  private getTerm(ref: TermRef): { term: string; category?: string } | undefined {
    if (ref.lang === 'fr') {
      return this.frenchTermService.terms().find(t => t.id === ref.id);
    }
    return this.germanTermService.terms().find(t => t.id === ref.id);
  }
}
