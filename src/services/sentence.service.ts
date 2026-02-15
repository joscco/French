import {Injectable, signal} from '@angular/core';
import {SentenceRow} from '../shared/contract/contract';
import {parseCSV, toNum} from '../features/editor/helpers/csv-utils';

@Injectable({ providedIn: 'root' })
export class SentencesService {
  private readonly _sentences = signal<SentenceRow[]>([]);
  readonly sentences = this._sentences.asReadonly();

  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    const response = await fetch('data/sentences.csv');
    if (!response.ok) {
      throw new Error('Failed to load sentences.csv');
    }

    const csvRows = parseCSV(await response.text());
    const parsedSentences: SentenceRow[] = [];

    for (const row of csvRows) {
      const id = toNum(row['id']);
      const unitId = toNum(row['unit_id']);
      const fr = (row['fr'] || '').trim();
      const de = (row['de'] || '').trim();
      if (!id || !unitId || !fr || !de) {
        continue;
      }

      parsedSentences.push({
        id,
        unitId,
        fr,
        de,
        note: (row['note'] || '').trim() || undefined,
      });
    }

    parsedSentences.sort((a, b) => a.id - b.id);
    this._sentences.set(parsedSentences);
  }
}
