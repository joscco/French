import {Injectable, signal} from '@angular/core';
import {TranslationLink} from '../models/translation-link';
import {parseCSV} from '../helpers/csv-utils';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly _links = signal<TranslationLink[]>([]);
  readonly links = this._links.asReadonly();
  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    try {
      const res = await fetch('data/translation-links.csv');
      if (!res.ok) {
        throw new Error('Fehler beim Laden `public/data/translation-links.csv`');
      }

      const records = parseCSV(await res.text());
      const all: TranslationLink[] = records.map(r => ({
        frenchId: Number(r['fr']),
        germanId: Number(r['de']),
      })).filter(l => !!l.frenchId && !!l.germanId);

      this._links.set(all);
    } catch (e) {
      console.error('Translation links load failed', e);
      this._links.set([]);
    }
  }
}
