import { computed, inject, Injectable, signal } from '@angular/core';
import { GermanTermService } from './german-term.service';
import { FrenchTermService } from './french-term.service';
import { TranslationService } from './translation.service';
import { SentenceRefService } from './sentence-ref.service';
import { WordCard } from '../models/word-card';
import { buildCardsFromFrench, buildCardsFromGerman, indexByKey } from '../helpers/utils';
import { PracticeMode } from '../models/types';

@Injectable({ providedIn: 'root' })
export class WordService {
  private frenchTerms = inject(FrenchTermService);
  private germanTerms = inject(GermanTermService);
  private translations = inject(TranslationService);
  private refs = inject(SentenceRefService);

  readonly mode = signal<PracticeMode>('de-fr');
  readonly selectedLessons = signal<number[] | 'all'>([]);

  readonly words = computed<WordCard[]>(() => {
    const mode = this.mode();
    const sel = this.selectedLessons();

    const frAll = this.frenchTerms.terms();
    const deAll = this.germanTerms.terms();
    const links = this.translations.links();

    const allowed =
      sel === 'all' || (Array.isArray(sel) && sel.length === 0)
        ? null
        : this.refs.allowedTermKeysForLessons(sel as number[]);

    const fr = allowed ? frAll.filter(t => allowed.fr.has(t.key)) : frAll;
    const de = allowed ? deAll.filter(t => allowed.de.has(t.key)) : deAll;

    const frByKey = indexByKey(fr);
    const deByKey = indexByKey(de);

    if (mode === 'fr-de') return buildCardsFromFrench(fr, deByKey, links);
    if (mode === 'de-fr') return buildCardsFromGerman(de, frByKey, links);
    return [];
  });
}
