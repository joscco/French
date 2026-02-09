import {computed, Injectable, signal} from '@angular/core';
import {GermanTerm} from '../models/german-term';
import {parseCSV} from '../helpers/csv-utils';
import {Genus} from '../models/editor-model';

@Injectable({providedIn: 'root'})
export class GermanTermService {
  private readonly _byKey = signal<Record<string, GermanTerm>>({});
  readonly byKey = this._byKey.asReadonly();
  readonly terms = computed(() => Object.values(this._byKey()));

  async loadAll(): Promise<void> {

    const res = await fetch('data/generated/terms-de.csv');
    const records = parseCSV(await res.text());

    const map: Record<string, GermanTerm> = {};
    for (const r of records) {
      const key = (r['key'] || '').trim();
      const term = (r['term'] || '').trim();
      if (!key || !term) continue;

      map[key] = {
        key,
        term,
        category: (r['category'] || '').trim(),
        genus: (r['genus'] || '').trim() as Genus || undefined,
      };
    }
    this._byKey.set(map);
  }

  getByKey(key: string): GermanTerm | undefined {
    return this.byKey()[key];
  }

}
