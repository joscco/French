import {Injectable, signal} from '@angular/core';
import {GermanTerm} from '../models/german-term';
import {parseCSV} from '../helpers/csv-utils';

@Injectable({ providedIn: 'root' })
export class GermanTermService {
  private readonly _terms = signal<GermanTerm[]>([]);
  readonly terms = this._terms.asReadonly();
  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    try {
      const res = await fetch('data/german-terms.csv');
      if (!res.ok) {
        throw new Error('Fehler beim Laden `german-terms.csv`');
      }

      const records = parseCSV(await res.text());
      const all: GermanTerm[] = records.map(r => ({
        id: Number(r['id']),
        lesson: Number(r['lesson']),
        category: (r['category'] || '').trim(),
        term: (r['term'] || '').trim(),
        genus: (r['genus'] || '').trim() || undefined,
      })).filter(t => !!t.id && !!t.term);

      this._terms.set(all);
    } catch (e) {
      console.error('German terms load failed', e);
      this._terms.set([]);
    }
  }
}
