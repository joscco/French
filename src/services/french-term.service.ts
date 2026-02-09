import {FrenchTerm} from '../models/french-term';
import {computed, Injectable, signal} from '@angular/core';
import {parseCSV} from '../helpers/csv-utils';
import {Genus} from '../models/editor-model';

@Injectable({ providedIn: 'root' })
export class FrenchTermService {
  private readonly _byKey = signal<Record<string, FrenchTerm>>({});
  readonly byKey = this._byKey.asReadonly();
  readonly terms = computed(() => Object.values(this._byKey()));

  async loadAll(): Promise<void> {
    const res = await fetch('data/generated/terms-fr.csv');
    const records = parseCSV(await res.text());

    const map: Record<string, FrenchTerm> = {};
    for (const r of records) {
      const key = (r['key'] || '').trim();
      const term = (r['term'] || '').trim();
      if (!key || !term) continue;

      map[key] = {
        key,
        term,
        category: (r['category'] || '').trim(),
        genus: (r['genus'] || '').trim() as Genus || undefined,
        needsVowelArticle: (r['needs_vowel_article'] || '').trim().toLowerCase() === 'true',
      };
    }
    this._byKey.set(map);
  }

  getByKey(key: string): FrenchTerm | undefined {
    return this._byKey()[key];
  }
}
