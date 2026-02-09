import { Injectable, signal, computed } from '@angular/core';
import {BilingualSentence, EditorDB,  SentenceAnnotation, SentenceTemplate, Term} from '../models/editor-model';
import {Language} from '../models/types';

const LS_KEY = 'fr-editor-db-v1';

function defaultDB(): EditorDB {
  return {
    version: 1,
    nextIds: { term: 1, sentence: 1, annotation: 1, slot: 1, option: 1 },
    terms: [],
    termLinks: [],
    sentences: [],
  };
}

@Injectable({ providedIn: 'root' })
export class EditorStore {
  readonly db = signal<EditorDB>(load());

  readonly terms = computed(() => this.db().terms);
  readonly sentences = computed(() => this.db().sentences);

  persistToLocalStorage(enabled: boolean) {
    if (!enabled) return;
    // basic: call in effects in component
  }

  saveToLS() {
    localStorage.setItem(LS_KEY, JSON.stringify(this.db()));
  }

  importJSON(json: string) {
    const parsed = JSON.parse(json) as EditorDB;
    if (!parsed || parsed.version !== 1) throw new Error('Unsupported DB version');
    this.db.set(parsed);
    this.saveToLS();
  }

  exportJSON(): string {
    return JSON.stringify(this.db(), null, 2);
  }

  // ---------- IDs ----------
  private nextId(kind: keyof EditorDB['nextIds']): number {
    const db = this.db();
    const id = db.nextIds[kind];
    this.db.set({
      ...db,
      nextIds: { ...db.nextIds, [kind]: id + 1 },
    });
    return id;
  }

  // ---------- Terms ----------
  createTerm(partial: Omit<Term, 'id'>): Term {
    const term: Term = { id: this.nextId('term'), ...partial };
    const db = this.db();
    this.db.set({ ...db, terms: [...db.terms, term] });
    return term;
  }

  updateTerm(id: number, patch: Partial<Term>) {
    const db = this.db();
    this.db.set({
      ...db,
      terms: db.terms.map(t => (t.id === id ? { ...t, ...patch } : t)),
    });
  }

  searchTerms(lang: Language, q: string): Term[] {
    const s = q.trim().toLowerCase();
    if (!s) return this.db().terms.filter(t => t.lang === lang).slice(0, 50);
    return this.db().terms
      .filter(t => t.lang === lang)
      .map(t => {
        const hay = `${t.display} ${t.lemma ?? ''} ${(t.tags ?? []).join(' ')}`.toLowerCase();
        const score =
          hay === s ? 100 :
            hay.startsWith(s) ? 80 :
              hay.includes(s) ? 60 : 0;
        return { t, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map(x => x.t);
  }

  // ---------- Sentences ----------
  createBilingualSentence(lesson: number): BilingualSentence {
    const id = this.nextId('sentence');
    const emptyTemplate: SentenceTemplate = {
      text: '',
      tokens: [{ kind: 'text', value: '' }],
      slots: [],
    };
    const s: BilingualSentence = {
      id,
      lesson,
      fr: { template: structuredClone(emptyTemplate), representative: { text: '', annotations: [] } },
      de: { template: structuredClone(emptyTemplate), representative: { text: '', annotations: [] } },
    };
    const db = this.db();
    this.db.set({ ...db, sentences: [...db.sentences, s] });
    return s;
  }

  updateSentence(id: number, patch: Partial<BilingualSentence>) {
    const db = this.db();
    this.db.set({ ...db, sentences: db.sentences.map(s => (s.id === id ? { ...s, ...patch } : s)) });
  }

  updateSentenceSideText(sentenceId: number, lang: Language, text: string) {
    const db = this.db();
    this.db.set({
      ...db,
      sentences: db.sentences.map(s => {
        if (s.id !== sentenceId) return s;
        const side = lang === 'french' ? s.fr : s.de;
        const nextSide = { ...side, representative: { ...side.representative, text } };
        return lang === 'french' ? { ...s, fr: nextSide } : { ...s, de: nextSide };
      }),
    });
  }

  addAnnotation(sentenceId: number, lang: Language, ann: Omit<SentenceAnnotation, 'id'>) {
    const id = this.nextId('annotation');
    const db = this.db();
    this.db.set({
      ...db,
      sentences: db.sentences.map(s => {
        if (s.id !== sentenceId) return s;
        const side = lang === 'french' ? s.fr : s.de;
        const rep = side.representative;
        const nextRep = { ...rep, annotations: [...rep.annotations, { id, ...ann }] };
        const nextSide = { ...side, representative: nextRep };
        return lang === 'french' ? { ...s, fr: nextSide } : { ...s, de: nextSide };
      }),
    });
  }

  removeAnnotation(sentenceId: number, lang: Language, annId: number) {
    const db = this.db();
    this.db.set({
      ...db,
      sentences: db.sentences.map(s => {
        if (s.id !== sentenceId) return s;
        const side = lang === 'french' ? s.fr : s.de;
        const rep = side.representative;
        const nextRep = { ...rep, annotations: rep.annotations.filter(a => a.id !== annId) };
        const nextSide = { ...side, representative: nextRep };
        return lang === 'french' ? { ...s, fr: nextSide } : { ...s, de: nextSide };
      }),
    });
  }

  updateSentenceTemplateText(sentenceId: number, lang: Language, text: string) {
    const db = this.db();
    this.db.set({
      ...db,
      sentences: db.sentences.map((s) => {
        if (s.id !== sentenceId) return s;

        if (lang === 'french') {
          return {
            ...s,
            fr: {
              ...s.fr,
              template: { ...s.fr.template, text },
            },
          };
        }

        return {
          ...s,
          de: {
            ...s.de,
            template: { ...s.de.template, text },
          },
        };
      }),
    });
  }

}

function load(): EditorDB {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultDB();
    const parsed = JSON.parse(raw) as EditorDB;
    if (parsed.version !== 1) return defaultDB();
    return parsed;
  } catch {
    return defaultDB();
  }
}
