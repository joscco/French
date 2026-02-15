import { Injectable, signal, computed } from '@angular/core';
import { TermLinkRow } from '../shared/contract/contract';
import {parseCSV, toNum} from '../features/editor/helpers/csv-utils';

@Injectable({ providedIn: 'root' })
export class TermLinksService {
  private readonly _links = signal<TermLinkRow[]>([]);
  readonly links = this._links.asReadonly();

  readonly byFrId = computed(() => {
    const linksByFrenchId = new Map<number, TermLinkRow[]>();
    for (const link of this._links()) {
      const linkArray = linksByFrenchId.get(link.fr_id) ?? [];
      linkArray.push(link);
      linksByFrenchId.set(link.fr_id, linkArray);
    }
    for (const [, linkArray] of linksByFrenchId) {
      linkArray.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    }
    return linksByFrenchId;
  });

  readonly byDeId = computed(() => {
    const linksByGermanId = new Map<number, TermLinkRow[]>();
    for (const link of this._links()) {
      const linkArray = linksByGermanId.get(link.de_id) ?? [];
      linkArray.push(link);
      linksByGermanId.set(link.de_id, linkArray);
    }
    for (const [, linkArray] of linksByGermanId) {
      linkArray.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
    }
    return linksByGermanId;
  });

  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    const response = await fetch('data/term_links.csv');
    if (!response.ok) {
      throw new Error('Failed to load term_links.csv');
    }

    const csvRows = parseCSV(await response.text());
    const parsedLinks: TermLinkRow[] = [];

    for (const row of csvRows) {
      const frenchId = toNum(row['fr_id']);
      const germanId = toNum(row['de_id']);
      if (!frenchId || !germanId) {
        continue;
      }
      const priority = toNum(row['priority']) ?? undefined;
      parsedLinks.push({ fr_id: frenchId, de_id: germanId, priority });
    }

    this._links.set(parsedLinks);
  }

  getLinkedIds(lang: 'fr' | 'de', id: number | null | undefined): number[] {
    if (id == null) {
      return [];
    }

    if (lang === 'fr') {
      // fr_id -> de_id[]
      return (this.byFrId().get(id) ?? []).map(l => l.de_id);
    }

    // de_id -> fr_id[]
    return (this.byDeId().get(id) ?? []).map(l => l.fr_id);
  }
}
