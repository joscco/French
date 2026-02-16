import {parseCSV, toBool, toCSV, toNum} from '../helpers/csv-utils';
import {computed, Injectable, signal} from '@angular/core';
import {GroupRow, Lang, SentenceRow, TermLinkRow, TermRow, UnitRow} from '../../../shared/contract/contract';
import {normalizeForCheck} from '../../app/helpers/normalize';

const TTS_SERVER_URL = 'http://localhost:3001';

@Injectable({ providedIn: 'root' })
export class EditorStore {
  readonly groups = signal<GroupRow[]>([]);
  readonly units = signal<UnitRow[]>([]);
  readonly terms = signal<TermRow[]>([]);
  readonly links = signal<TermLinkRow[]>([]);
  readonly sentences = signal<SentenceRow[]>([]);

  readonly termById = computed(() => {
    const termMap = new Map<number, TermRow>();
    for (const term of this.terms()) {
      termMap.set(term.id, term);
    }
    return termMap;
  });

  readonly unitById = computed(() => {
    const unitMap = new Map<number, UnitRow>();
    for (const unit of this.units()) {
      unitMap.set(unit.id, unit);
    }
    return unitMap;
  });

  async loadAll(): Promise<void> {
    // Versuche zuerst vom TTS-Server zu laden (verhindert Hot-Reload bei Speichern)
    const ttsServerAvailable = await this.checkTTSServer();

    if (ttsServerAvailable) {
      console.log('[EditorStore] Loading from TTS server...');
      await this.loadFromTTSServer();
    } else {
      console.log('[EditorStore] TTS server not available, loading from Angular...');
      await this.loadFromAngular();
    }
  }

  private async checkTTSServer(): Promise<boolean> {
    try {
      const response = await fetch(`${TTS_SERVER_URL}/health`, { method: 'GET' });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async loadFromTTSServer(): Promise<void> {
    const [groupResponse, unitsResponse, termsResponse, linksResponse, sentencesResponse] = await Promise.all([
      fetch(`${TTS_SERVER_URL}/data/groups.csv`),
      fetch(`${TTS_SERVER_URL}/data/units.csv`),
      fetch(`${TTS_SERVER_URL}/data/terms.csv`),
      fetch(`${TTS_SERVER_URL}/data/term_links.csv`),
      fetch(`${TTS_SERVER_URL}/data/sentences.csv`),
    ]);

    if (!groupResponse.ok || !unitsResponse.ok || !termsResponse.ok || !linksResponse.ok || !sentencesResponse.ok) {
      throw new Error('Failed to load CSVs from TTS server');
    }

    this.groups.set(this.parseGroups(await groupResponse.text()));
    this.units.set(this.parseUnits(await unitsResponse.text()));
    this.terms.set(this.parseTerms(await termsResponse.text()));
    this.links.set(this.parseLinks(await linksResponse.text()));
    this.sentences.set(this.parseSentences(await sentencesResponse.text()));
  }

  private async loadFromAngular(): Promise<void> {
    const [groupResponse, unitsResponse, termsResponse, linksResponse, sentencesResponse] = await Promise.all([
      fetch('data/groups.csv'),
      fetch('data/units.csv'),
      fetch('data/terms.csv'),
      fetch('data/term_links.csv'),
      fetch('data/sentences.csv'),
    ]);

    if (!groupResponse.ok) {
      throw new Error('Failed to load groups.csv');
    }
    if (!unitsResponse.ok) {
      throw new Error('Failed to load units.csv');
    }
    if (!termsResponse.ok) {
      throw new Error('Failed to load terms.csv');
    }
    if (!linksResponse.ok) {
      throw new Error('Failed to load term_links.csv');
    }
    if (!sentencesResponse.ok) {
      throw new Error('Failed to load sentences.csv');
    }

    this.groups.set(this.parseGroups(await groupResponse.text()));
    this.units.set(this.parseUnits(await unitsResponse.text()));
    this.terms.set(this.parseTerms(await termsResponse.text()));
    this.links.set(this.parseLinks(await linksResponse.text()));
    this.sentences.set(this.parseSentences(await sentencesResponse.text()));
  }


  private parseGroups(csv: string): GroupRow[] {
    const csvRows = parseCSV(csv);
    const parsedGroups: GroupRow[] = [];
    for (const row of csvRows) {
      const id = toNum(row['id']);
      if (!id) {
        continue;
      }
      const name = (row['name'] || '').trim();
      if (!name) {
        continue;
      }
      parsedGroups.push({
        id,
        name,
        date: (row['date'] || '').trim() || undefined,
      });
    }
    parsedGroups.sort((a, b) => a.id - b.id);
    return parsedGroups;
  }

  private parseUnits(csv: string): UnitRow[] {
    const csvRows = parseCSV(csv);
    const parsedUnits: UnitRow[] = [];
    for (const row of csvRows) {
      const id = toNum(row['id']);
      if (!id) {
        continue;
      }
      const group_id = toNum(row['group_id']);
      const name = (row['name'] || '').trim();
      if (!group_id || !name) {
        continue;
      }
      parsedUnits.push({
        id,
        group_id,
        name,
        date: (row['date'] || '').trim() || undefined,
        order: toNum(row['order']) ?? undefined,
      });
    }
    parsedUnits.sort((a, b) => (a.group_id - b.group_id) || (a.order ?? 9999) - (b.order ?? 9999) || a.id - b.id);
    return parsedUnits;
  }

  private parseTerms(csv: string): TermRow[] {

    const csvRows = parseCSV(csv);
    const parsedTerms: TermRow[] = [];

    for (const row of csvRows) {

      const id = toNum(row['id']);
      const lang = (row['lang'] || '').trim() as Lang;
      const term_text = (row['term_text'] || '').trim();
      if (!id || (lang !== 'fr' && lang !== 'de') || !term_text) {
        continue;
      }
      const tagsRaw = (row['tags'] || '').trim();
      const tags = tagsRaw
        ? tagsRaw.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0)
        : undefined;
      const has_audio = row['has_audio'] === 'true';
      parsedTerms.push({
        id,
        lang,
        term_text,
        // lemma removed
        category: (row['category'] || '').trim() as any || undefined,
        genus: (row['genus'] || '').trim() as any || undefined,
        needsVowelArticle: toBool(row['needs_vowel_article']),
        unitId: toNum(row['unit_id']) ?? undefined,
        ref: (row['ref'] || '').trim() || undefined,
        tags,
        has_audio,
      } as any);
    }
    parsedTerms.sort((a, b) => a.id - b.id);
    return parsedTerms;

  }

  private parseLinks(csv: string): TermLinkRow[] {
    const csvRows = parseCSV(csv);
    const parsedLinks: TermLinkRow[] = [];
    for (const row of csvRows) {
      const frenchId = toNum(row['fr_id']);
      const germanId = toNum(row['de_id']);
      if (!frenchId || !germanId) {
        continue;
      }
      parsedLinks.push({ fr_id: frenchId, de_id: germanId, priority: toNum(row['priority']) ?? undefined });
    }
    parsedLinks.sort((a, b) => (a.fr_id - b.fr_id) || (a.de_id - b.de_id));
    return parsedLinks;
  }

  private parseSentences(csv: string): SentenceRow[] {
    const csvRows = parseCSV(csv);
    const parsedSentences: SentenceRow[] = [];
    for (const row of csvRows) {
      const id = toNum(row['id']);
      const unitId = toNum(row['unit_id']);
      const fr = (row['fr'] || '').trim();
      const de = (row['de'] || '').trim();
      if (!id || !unitId || !fr || !de) {
        continue;
      }
      // NEU: has_audio_fr und has_audio_de
      const has_audio_fr = row['has_audio_fr'] === 'true';
      const has_audio_de = row['has_audio_de'] === 'true';
      parsedSentences.push({ id, unitId, fr, de, note: (row['note'] || '').trim() || undefined, has_audio_fr, has_audio_de });
    }
    parsedSentences.sort((a, b) => a.id - b.id);
    return parsedSentences;
  }

  // --- editing: sentences ---
  updateSentenceText(sentenceId: number, lang: Lang, text: string) {
    const currentSentences = this.sentences();
    this.sentences.set(
      currentSentences.map(sentence => {
        if (sentence.id !== sentenceId) {
          return sentence;
        }
        return lang === 'fr' ? { ...sentence, fr: text } : { ...sentence, de: text };
      }),
    );
  }

  updateTerm(id: number, patch: Partial<TermRow>) {
    const currentTerms = this.terms();
    this.terms.set(currentTerms.map(term => (term.id === id ? { ...term, ...patch } : term)));
  }

  createTerm(partial: Omit<TermRow, 'id'>): TermRow {
    const nextId = Math.max(0, ...this.terms().map(term => term.id)) + 1;
    const newTerm: TermRow = { id: nextId, ...partial };
    this.terms.set([...this.terms(), newTerm].sort((a, b) => a.id - b.id));
    return newTerm;
  }


  searchTerms(lang: Lang, query: string, limit = 50): TermRow[] {
    const searchTerm = normalizeForCheck(query);
    const languageTerms = this.terms().filter((termRow) => termRow.lang === lang);
    if (!searchTerm) {
      return languageTerms.slice(0, limit);
    }
    const scoredTerms = languageTerms
      .map((termRow) => {
        const tagsText = termRow.tags?.join(' ') ?? '';
        const searchableText = `${normalizeForCheck(termRow.term_text)} ${normalizeForCheck(tagsText)}`.trim();
        const score =
          searchableText === searchTerm ? 100 :
            searchableText.startsWith(searchTerm) ? 80 :
              searchableText.includes(searchTerm) ? 60 : 0;
        return { termRow, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.termRow.id - b.termRow.id);
    return scoredTerms.slice(0, limit).map((entry) => entry.termRow);
  }

  addLink(frenchId: number, germanId: number, priority?: number) {
    const exists = this.links().some(link => link.fr_id === frenchId && link.de_id === germanId);
    if (exists) {
      return;
    }
    this.links.set([...this.links(), { fr_id: frenchId, de_id: germanId, priority }].sort((a, b) => (a.fr_id - b.fr_id) || (a.de_id - b.de_id)));
  }

  removeLink(frenchId: number, germanId: number) {
    this.links.set(this.links().filter(link => !(link.fr_id === frenchId && link.de_id === germanId)));
  }

  readonly linksByFrenchId = computed(() => {
    const linksForFrenchId = new Map<number, TermLinkRow[]>();

    for (const linkRow of this.links()) {
      const existingLinks = linksForFrenchId.get(linkRow.fr_id);
      if (!existingLinks) {
        linksForFrenchId.set(linkRow.fr_id, [linkRow]);
      } else {
        existingLinks.push(linkRow);
      }
    }

    // stable sort by priority then id
    for (const [frenchId, linkRows] of linksForFrenchId.entries()) {
      linkRows.sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999) || a.de_id - b.de_id);
      linksForFrenchId.set(frenchId, linkRows);
    }

    return linksForFrenchId;
  });

  readonly linksByGermanId = computed(() => {
    const linksForGermanId = new Map<number, TermLinkRow[]>();

    for (const linkRow of this.links()) {
      const existingLinks = linksForGermanId.get(linkRow.de_id);
      if (!existingLinks) {
        linksForGermanId.set(linkRow.de_id, [linkRow]);
      } else {
        existingLinks.push(linkRow);
      }
    }

    for (const [germanId, linkRows] of linksForGermanId.entries()) {
      linkRows.sort((a, b) => (a.priority ?? 9999) - (b.priority ?? 9999) || a.fr_id - b.fr_id);
      linksForGermanId.set(germanId, linkRows);
    }

    return linksForGermanId;
  });

  getLinkedTermIds(termId: number, termLanguage: Lang): number[] {
    if (termLanguage === 'fr') {
      const linkRows = this.linksByFrenchId().get(termId) ?? [];
      return linkRows.map((row) => row.de_id);
    }

    const linkRows = this.linksByGermanId().get(termId) ?? [];
    return linkRows.map((row) => row.fr_id);
  }

  getLinkedTerms(termId: number, termLanguage: Lang): TermRow[] {
    const termMap = this.termById();
    const linkedTermIds = this.getLinkedTermIds(termId, termLanguage);

    const linkedTerms: TermRow[] = [];
    for (const linkedTermId of linkedTermIds) {
      const linkedTermRow = termMap.get(linkedTermId);
      if (linkedTermRow) {
        linkedTerms.push(linkedTermRow);
      }
    }

    // prefer stable order (priority already applied at id list level)
    return linkedTerms;
  }

  getTranslationCount(termId: number, termLanguage: Lang): number {
    return this.getLinkedTermIds(termId, termLanguage).length;
  }

  hasLinkBetween(frenchId: number, germanId: number): boolean {
    return this.links().some((linkRow) => linkRow.fr_id === frenchId && linkRow.de_id === germanId);
  }

  /**
   * Adds a link regardless of which side is currently selected.
   * You pass two term rows (any order), we normalize to fr_id/de_id.
   */
  addLinkBetween(termA: TermRow, termB: TermRow, priority?: number) {
    if (termA.lang === termB.lang) {
      return; // invalid: must be cross-language
    }

    const frenchTerm = (termA.lang === 'fr') ? termA : termB;
    const germanTerm = (termA.lang === 'de') ? termA : termB;

    if (this.hasLinkBetween(frenchTerm.id, germanTerm.id)) {
      return;
    }

    this.addLink(frenchTerm.id, germanTerm.id, priority);
  }

  removeLinkBetween(termA: TermRow, termB: TermRow) {
    if (termA.lang === termB.lang) {
      return;
    }

    const frenchTerm = (termA.lang === 'fr') ? termA : termB;
    const germanTerm = (termA.lang === 'de') ? termA : termB;

    this.removeLink(frenchTerm.id, germanTerm.id);
  }

  exportCSVs(): Record<string, string> {
    const groupsCsv = toCSV(
      this.groups().map(group => ({
        id: group.id,
        name: group.name,
        date: group.date ?? '',
      })),
      ['id', 'name', 'date'],
    );

    const unitsCsv = toCSV(
      this.units().map(unit => ({
        id: unit.id,
        group_id: unit.group_id,
        name: unit.name,
        date: unit.date ?? '',
        order: unit.order ?? '',
      })),
      ['id', 'group_id', 'name', 'date', 'order'],
    );

    const termsCsv = toCSV(
      this.terms().map((termRow: any) => ({
        id: termRow.id,
        lang: termRow.lang,
        term_text: termRow.term_text, // includes {…}
        category: termRow.category ?? '',
        genus: termRow.genus ?? '',
        needs_vowel_article: termRow.needsVowelArticle ?? '',
        unit_id: termRow.unitId ?? '',
        ref: termRow.ref ?? '',
        tags: termRow.tags?.join(',') ?? '',
        has_audio: termRow.has_audio ? 'true' : 'false',
      })),
      ['id','lang','term_text','category','genus','needs_vowel_article','unit_id','ref','tags','has_audio'],
    );

    const linksCsv = toCSV(
      this.links().map(link => ({
        fr_id: link.fr_id,
        de_id: link.de_id,
        priority: link.priority ?? '',
      })),
      ['fr_id','de_id','priority'],
    );

    const sentencesCsv = toCSV(
      this.sentences().map((sentence: any) => ({
        id: sentence.id,
        unit_id: sentence.unitId,
        fr: sentence.fr,
        de: sentence.de,
        note: sentence.note ?? '',
        has_audio_fr: sentence.has_audio_fr ? 'true' : 'false',
        has_audio_de: sentence.has_audio_de ? 'true' : 'false',
      })),
      ['id','unit_id','fr','de','note','has_audio_fr','has_audio_de'],
    );

    return {
      'groups.csv': groupsCsv,
      'units.csv': unitsCsv,
      'terms.csv': termsCsv,
      'term_links.csv': linksCsv,
      'sentences.csv': sentencesCsv,
    };
  }
}
