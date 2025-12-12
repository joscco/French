import {Injectable, signal, computed, inject} from '@angular/core';
import {Sentence} from '../models/sentence';
import {parseCSV} from '../helpers/csv-utils';
import {SentenceRefService} from './sentence-ref.service';

@Injectable({ providedIn: 'root' })
export class SentenceService {
  private refs = inject(SentenceRefService);

  private readonly _sentences = signal<Sentence[]>([]);
  readonly sentences = this._sentences.asReadonly();

  readonly sentencesWithRefs = computed<Sentence[]>(() => {
    const base = this._sentences();
    const byId = this.refs.bySentenceId();

    // refs nur “dranhängen”, wenn vorhanden
    return base.map(s => ({
      ...s,
      refs: byId[s.id] ?? [],
    }));
  });

  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      // parallel laden
      const [sentRes] = await Promise.all([
        fetch('data/sentences.csv'),
        this.refs.loadAll(),
      ]);

      if (!sentRes.ok) throw new Error('Fehler beim Laden `sentences.csv`');

      const records = parseCSV(await sentRes.text());
      const all: Sentence[] = records.map(r => ({
        id: Number(r['id']),
        lesson: Number(r['lesson']),
        fr: (r['fr'] || '').trim(),
        de: (r['de'] || '').trim(),
      })).filter(s => !!s.id && !!s.fr && !!s.de);

      this._sentences.set(all);
    } catch (e) {
      console.error('Sentences load failed', e);
      this._sentences.set([]);
    }
  }
}
