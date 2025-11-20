import {Injectable, signal} from '@angular/core';
import Papa from 'papaparse';

export interface VocabRow {
  lesson: number; // lesson number
  id: number;
  category: string;
  fr_genus?: string;
  de_genus?: string;
  fr_needs_vowel_article: boolean;
  fr_word: string;
  fr_sentence?: string;
  de_word: string;
  de_sentence?: string;
}

@Injectable({providedIn: 'root'})
export class VocabService {
  private _rows = signal<VocabRow[]>([]);
  rows = this._rows.asReadonly();
  private loaded = false;

  async loadAll(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    try {
      const wordFile = await fetch(`words.csv`);
      const lessonFile = await fetch(`termine.csv`);
      if (!wordFile.ok || !lessonFile.ok) {
        throw new Error(`Fehler beim Laden ${wordFile} oder ${lessonFile}`);
      }
      const records = this.parseCSV(await wordFile.text());
      const all: VocabRow[] = [];
      for (const record of records) {
        // Header: id;category;genus;fr_word;fr_sentence;de_word;de_sentence  (Semikolon getrennt)
        const row: VocabRow = {
          lesson: record['lesson'] ? Number(record['lesson']) : 0,
          id: Number(record['id']),
          category: (record['category'] || '').trim(),
          fr_genus: (record['fr_genus'] || '').trim() || undefined,
          de_genus: (record['de_genus'] || '').trim() || undefined,
          fr_needs_vowel_article: record['fr_needs_vowel_article']?.trim().toLowerCase() === 'true',
          fr_word: (record['fr_word'] || '').trim(),
          fr_sentence: (record['fr_sentence'] || '').trim() || undefined,
          de_word: (record['de_word'] || '').trim(),
          de_sentence: (record['de_sentence'] || '').trim() || undefined,
        };
        if (!isNaN(row.id) && row.fr_word && row.de_word) {
          all.push(row);
        }
      }
      this._rows.set(all);
    } catch (err) {
      console.error('Laden fehlgeschlagen', err);
      this._rows.set([]);
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
      console.warn('CSV parse errors', res.errors);
    }

    return (res.data || []).map((row: any) => {
      const rec: Record<string, string> = {};
      Object.entries(row).forEach(([key, value]) => {
        rec[key.trim()] = (value ?? '').toString().trim();
      });
      return rec;
    });
  }
}
