import { Injectable, signal } from '@angular/core';
import { parseCSV } from '../helpers/csv-utils';
import { TermRefInSentence } from '../models/term-ref-in-sentence';

type BySentenceId = Record<number, TermRefInSentence[]>;
type SentenceLessonMap = Record<number, number>;

@Injectable({ providedIn: 'root' })
export class SentenceRefService {
  private readonly _bySentenceId = signal<BySentenceId>({});
  readonly bySentenceId = this._bySentenceId.asReadonly();

  private readonly _lessonBySentenceId = signal<SentenceLessonMap>({});
  readonly lessonBySentenceId = this._lessonBySentenceId.asReadonly();

  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;

    try {
      const [refsRes, sentRes] = await Promise.all([
        fetch('data/generated/sentence-refs.csv'),
        fetch('data/generated/sentences.csv'),
      ]);

      if (!refsRes.ok) throw new Error('Fehler beim Laden `sentence-refs.csv`');
      if (!sentRes.ok) throw new Error('Fehler beim Laden `sentences.csv`');

      // 1) sentenceId -> lesson
      const sentRecords = parseCSV(await sentRes.text());
      const lessonMap: SentenceLessonMap = {};
      for (const r of sentRecords) {
        const id = Number(r['id']);
        const lesson = Number(r['lesson']);
        if (!id || !lesson) continue;
        lessonMap[id] = lesson;
      }
      this._lessonBySentenceId.set(lessonMap);

      // 2) sentenceId -> refs[]
      const refRecords = parseCSV(await refsRes.text());
      const map: BySentenceId = {};

      for (const r of refRecords) {
        const sid = Number(r['sentence_id']);
        const lang = (r['term_language'] || '').trim() as 'fr' | 'de';
        const key = (r['term_key'] || '').trim();
        const phrase = (r['phrase'] || '').trim();

        if (!sid || (lang !== 'fr' && lang !== 'de') || !key) continue;

        (map[sid] ??= []).push({
          lang : lang === 'fr' ? 'french' : 'german',
          key,
          label: phrase || undefined,
        });
      }

      this._bySentenceId.set(map);
    } catch (e) {
      console.error('Sentence refs load failed', e);
      this._bySentenceId.set({});
      this._lessonBySentenceId.set({});
    }
  }

  allowedTermKeysForLessons(lessons: number[]): { fr: Set<string>; de: Set<string> } {
    const lessonSet = new Set(lessons);
    const byId = this._bySentenceId();
    const lessonBySid = this._lessonBySentenceId();

    const fr = new Set<string>();
    const de = new Set<string>();

    for (const [sidStr, refs] of Object.entries(byId)) {
      const sid = Number(sidStr);
      const lesson = lessonBySid[sid];
      if (!lesson || !lessonSet.has(lesson)) continue;

      for (const ref of refs) {
        // only works if refs actually have keys (optional)
        if (!ref.key) continue;
        (ref.lang === 'french' ? fr : de).add(ref.key);
      }
    }

    return { fr, de };
  }
}
