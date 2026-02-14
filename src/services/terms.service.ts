import {computed, Injectable, signal} from '@angular/core';
import {Lang, TermRow} from '../shared/contract/contract';
import {parseCSV, toBool, toNum} from '../features/editor/helpers/csv-utils';

@Injectable({ providedIn: 'root' })
export class TermsService {
  private readonly _terms = signal<TermRow[]>([]);
  readonly terms = this._terms.asReadonly();

  readonly byId = computed(() => {
    const termMap = new Map<number, TermRow>();
    for (const term of this._terms()) {
      termMap.set(term.id, term);
    }
    return termMap;
  });

  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    const response = await fetch('data/terms.csv');
    if (!response.ok) {
      throw new Error('Failed to load terms.csv');
    }

    const csvRows = parseCSV(await response.text());
    const parsedTerms: TermRow[] = [];

    for (const row of csvRows) {
      const id = toNum(row['id']);
      const lang = (row['lang'] || '').trim() as Lang;
      const display = (row['display'] || '').trim();
      if (!id || (lang !== 'fr' && lang !== 'de') || !display) {
        continue;
      }

      const tagsRaw = (row['tags'] || '').trim();
      const tags = tagsRaw
        ? tagsRaw.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
        : undefined;

      parsedTerms.push({
        id,
        lang,
        display,
        lemma: (row['lemma'] || '').trim() || undefined,
        category: (row['category'] || '').trim() as any || undefined,
        genus: (row['genus'] || '').trim() as any || undefined,
        needsVowelArticle: toBool(row['needs_vowel_article']),
        unitId: toNum(row['unit_id']) ?? undefined,
        ref: (row['ref'] || '').trim() || undefined,
        tags,
      });
    }

    parsedTerms.sort((a, b) => a.id - b.id);
    this._terms.set(parsedTerms);
  }

  search(lang: Lang, query: string, limit = 50): TermRow[] {
    const searchTerm = query.trim().toLowerCase();
    const filteredTerms = this._terms().filter(term => term.lang === lang);

    if (!searchTerm) {
      return filteredTerms.slice(0, limit);
    }

    const scoredTerms = filteredTerms.map(term => {
      const tagsString = term.tags?.join(' ') ?? '';
      const searchableText = `${term.display} ${term.lemma ?? ''} ${tagsString}`.toLowerCase();
      const score =
        searchableText === searchTerm ? 100 :
          searchableText.startsWith(searchTerm) ? 80 :
            searchableText.includes(searchTerm) ? 60 : 0;
      return { term, score };
    }).filter(entry => entry.score > 0);

    scoredTerms.sort((a, b) => b.score - a.score || a.term.id - b.term.id);
    return scoredTerms.slice(0, limit).map(entry => entry.term);
  }

  getById(id: number | null | undefined): TermRow | undefined {
    if (id == null) {
      return undefined;
    }
    return this.byId().get(id);
  }
}
