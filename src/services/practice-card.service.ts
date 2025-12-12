import {computed, inject, Injectable, signal, effect} from '@angular/core';
import {GermanTermService} from './german-term.service';
import {FrenchTermService} from './french-term.service';
import {TranslationService} from './translation.service';
import {PracticeCard} from '../models/practice-card';
import {buildCardsFromFrench, buildCardsFromGerman, indexBy} from '../helpers/utils';
import {PracticeMode} from '../models/types';

@Injectable({ providedIn: 'root' })
export class PracticeCardService {
  private frenchTerms = inject(FrenchTermService);
  private germanTerms = inject(GermanTermService);
  private translations = inject(TranslationService);

  readonly mode = signal<PracticeMode>('de-fr');
  readonly selectedLessons = signal<number[] | 'all'>([]);

  readonly cards = computed<PracticeCard[]>(() => {
    const mode = this.mode();
    const fr = this.filterByLesson(this.frenchTerms.terms());
    const de = this.filterByLesson(this.germanTerms.terms());
    const links = this.translations.links();

    const frById = indexBy(fr, t => t.id);
    const deById = indexBy(de, t => t.id);

    if (mode === 'fr-de') {
      return buildCardsFromFrench(fr, deById, links);
    }
    if (mode === 'de-fr') {
      return buildCardsFromGerman(de, frById, links);
    }
    return [];
  });

  private filterByLesson<T extends { lesson: number }>(items: T[]): T[] {
    const sel = this.selectedLessons();
    if (sel === 'all' || !sel.length) return items;
    return items.filter(i => sel.includes(i.lesson));
  }
}
