import { Injectable, computed, signal, inject } from '@angular/core';
import { SentencesService } from '../../../services/sentence.service';

@Injectable({ providedIn: 'root' })
export class AllowedTermsService {
  private sentences = inject(SentencesService);

  // z.B. selected unit ids (vormals lessons)
  selectedUnitIds = signal<number[] | 'all'>([]);

  readonly allowedTermIds = computed(() => {
    const sel = this.selectedUnitIds();
    const all = this.sentences.sentences();

    const relevant = (() => {
      if (sel === 'all') return all;
      if (Array.isArray(sel) && sel.length === 0) return all;

      const wanted = new Set(sel as number[]);
      return all.filter(s => wanted.has(s.unitId));
    })();

    const ids = new Set<number>();
    for (const s of relevant) {
      for (const id of extractTermIdsFromMarkup(s.fr)) ids.add(id);
      for (const id of extractTermIdsFromMarkup(s.de)) ids.add(id);
    }
    return ids;
  });
}

export function extractTermIdsFromMarkup(text: string): number[] {
  const stringValue = String(text ?? '');
  const ids: number[] = [];
  const regex = /#(\d+)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(stringValue)) !== null) {
    const id = Number(match[1]);
    if (Number.isFinite(id) && id > 0) {
      ids.push(id);
    }
  }
  return ids;
}
