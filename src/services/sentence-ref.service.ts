// sentence-ref.service.ts
import { Injectable, signal } from '@angular/core';
import { SentenceRefRow } from '../models/sentence-ref-row';
import { parseCSV } from '../helpers/csv-utils';
import { TermRef } from '../models/term-ref';

@Injectable({ providedIn: 'root' })
export class SentenceRefService {
  private readonly _rows = signal<SentenceRefRow[]>([]);
  readonly rows = this._rows.asReadonly();

  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const res = await fetch('data/sentence-refs.csv');
      if (!res.ok) throw new Error('Fehler beim Laden `sentence-refs.csv`');

      const records = parseCSV(await res.text());
      const all: SentenceRefRow[] = records
        .map(r => ({
          id: Number(r['id']),
          sentenceId: Number(r['sentence_id']),
          termLanguage: (r['term_language'] || '').trim() as any,
          termId: Number(r['term_id']),
          phrase: (r['phrase'] || '').trim() || undefined,
        }))
        .filter(
          x =>
            !!x.id &&
            !!x.sentenceId &&
            (x.termLanguage === 'fr' || x.termLanguage === 'de') &&
            !!x.termId
        );

      this._rows.set(all);
    } catch (e) {
      console.error('Sentence refs load failed', e);
      this._rows.set([]);
    }
  }

  /** Map: sentenceId -> TermRef[] */
  bySentenceId(): Record<number, TermRef[]> {
    const map: Record<number, TermRef[]> = {};
    for (const r of this._rows()) {
      (map[r.sentenceId] ??= []).push({
        lang: r.termLanguage,
        id: r.termId,
        label: r.phrase,
      });
    }
    return map;
  }
}
