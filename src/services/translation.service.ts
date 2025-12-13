// translation.service.ts
import { Injectable, signal } from '@angular/core';
import { parseCSV } from '../helpers/csv-utils';

export interface TranslationLink {
  fr: string;
  de: string;
  priority?: number;
}

function norm(s: unknown): string {
  return String(s ?? '').replaceAll('’', "'").trim();
}

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly _links = signal<TranslationLink[]>([]);
  readonly links = this._links.asReadonly();
  private loaded = false;

  // ✅ schnelle Indizes
  private byFr = new Map<string, TranslationLink[]>();
  private byDe = new Map<string, TranslationLink[]>();

  async loadAll(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const res = await fetch('data/translation-links.csv');
      if (!res.ok) throw new Error('Fehler beim Laden `public/data/translation-links.csv`');

      const records = parseCSV(await res.text());

      const all: TranslationLink[] = records
        .map(r => {
          const fr = norm(r['fr']);
          const de = norm(r['de']);
          const prioRaw = norm(r['priority']);
          const priority = prioRaw ? Number(prioRaw) : undefined;
          return { fr, de, priority };
        })
        .filter(l => !!l.fr && !!l.de);

      this._links.set(all);
      this.rebuildIndex(all);
    } catch (e) {
      console.error('Translation links load failed', e);
      this._links.set([]);
      this.rebuildIndex([]);
    }
  }

  private rebuildIndex(all: TranslationLink[]) {
    this.byFr.clear();
    this.byDe.clear();

    for (const l of all) {
      const fr = norm(l.fr);
      const de = norm(l.de);

      (this.byFr.get(fr) ?? this.byFr.set(fr, []).get(fr)!).push(l);
      (this.byDe.get(de) ?? this.byDe.set(de, []).get(de)!).push(l);
    }

    // optional: priority sort
    const sortFn = (a: TranslationLink, b: TranslationLink) =>
      (a.priority ?? 999) - (b.priority ?? 999);

    for (const [k, arr] of this.byFr) {
      arr.sort(sortFn);
    }
    for (const [k, arr] of this.byDe) {
      arr.sort(sortFn);
    }
  }

  getGermanKeys(frKey: string): string[] {
    return (this.byFr.get(norm(frKey)) ?? []).map(l => l.de);
  }

  getFrenchKeys(deKey: string): string[] {
    return (this.byDe.get(norm(deKey)) ?? []).map(l => l.fr);
  }
}
