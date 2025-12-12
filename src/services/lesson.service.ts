import {Injectable, signal} from '@angular/core';
import Papa from 'papaparse';
import {Lesson} from '../models/lesson';

@Injectable({providedIn: 'root'})
export class LessonService {
  private readonly _entries = signal<Lesson[]>([]);
  readonly entries = this._entries.asReadonly();
  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    try {
      const lessonFile = await fetch(`data/lessons.csv`);
      if (!lessonFile.ok) {
        throw new Error(`Fehler beim Laden \`public/data/lessons.csv\``);
      }

      const records = this.parseCSV(await lessonFile.text());
      const all: Lesson[] = [];

      for (const record of records) {
        const lesson = record['lesson'] ? Number(record['lesson']) : 0;
        if (!lesson || Number.isNaN(lesson)) {
          continue;
        }

        const entry: Lesson = {
          lesson,
          date: (record['date'] || '').trim() || undefined,
          topic: (record['topic'] || '').trim() || undefined,
        };

        all.push(entry);
      }

      this._entries.set(all);
    } catch (err) {
      console.error('Laden der Termine fehlgeschlagen', err);
      this._entries.set([]);
    }
  }

  private parseCSV(input: string): Record<string, string>[] {
    const cleaned = input.replace(/^\uFEFF/, '');
    const res = Papa.parse<Record<string, string>>(cleaned, {
      delimiter: ';',
      header: true,
      skipEmptyLines: true,
      quoteChar: '"',
    });

    if (res.errors && res.errors.length) {
      console.warn('CSV parse errors (termine)', res.errors);
    }

    return (res.data || []).map((row: any) => {
      const rec: Record<string, string> = {};
      Object.entries(row).forEach(([key, value]) => {
        rec[key.trim()] = (value ?? '').toString().trim();
      });
      return rec;
    });
  }

  /** Liefert eine Map: lesson \-> { date, topic } */
  byLesson(): Record<number, { date?: string; topic?: string }> {
    const result: Record<number, { date?: string; topic?: string }> = {};
    for (const e of this._entries()) {
      result[e.lesson] = { date: e.date, topic: e.topic };
    }
    return result;
  }
}
