import {Injectable, signal} from '@angular/core';
import {FrenchTerm} from '../models/french-term';
import {parseCSV} from '../helpers/csv-utils';

@Injectable({ providedIn: 'root' })
export class FrenchTermService {
  private readonly _terms = signal<FrenchTerm[]>([]);
  readonly terms = this._terms.asReadonly();
  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    try {
      const res = await fetch('data/french-terms.csv');
      if (!res.ok) {
        throw new Error('Fehler beim Laden `french-terms.csv`');
      }

      const records = parseCSV(await res.text());
      const all: FrenchTerm[] = records.map(r => ({
        id: Number(r['id']),
        lesson: Number(r['lesson']),
        category: (r['category'] || '').trim(),
        term: (r['term'] || '').trim(),
        genus: (r['genus'] || '').trim() || undefined,
        needsVowelArticle: (r['needs_vowel_article'] || '').trim().toLowerCase() === 'true',
      })).filter(t => !!t.id && !!t.term);

      this._terms.set(all);
    } catch (e) {
      console.error('French terms load failed', e);
      this._terms.set([]);
    }
  }
}
