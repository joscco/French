import {Injectable, signal} from '@angular/core';

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
    if (this.loaded) return;
    this.loaded = true;
    try {
      const res = await fetch(`words.csv`);
      if (!res.ok) throw new Error(`Fehler beim Laden ${res}`);
      const text = await res.text();
      const records = parseCSV(text);
      const all: VocabRow[] = [];
      for (const r of records) {
        // Header: id;category;genus;fr_word;fr_sentence;de_word;de_sentence  (Semikolon getrennt)
        const row: VocabRow = {
          lesson: r['lesson'] ? Number(r['lesson']) : 0,
          id: Number(r['id']),
          category: (r['category'] || '').trim(),
          fr_genus: (r['fr_genus'] || '').trim() || undefined,
          de_genus: (r['de_genus'] || '').trim() || undefined,
          fr_needs_vowel_article: r['fr_needs_vowel_article']?.trim().toLowerCase() === 'wahr',
          fr_word: (r['fr_word'] || '').trim(),
          fr_sentence: (r['fr_sentence'] || '').trim() || undefined,
          de_word: (r['de_word'] || '').trim(),
          de_sentence: (r['de_sentence'] || '').trim() || undefined,
        };
        if (!isNaN(row.id) && row.fr_word && row.de_word) {
          all.push(row);
        }
      }
      this._rows.set(all);
    } catch (e) {
      console.error('Laden fehlgeschlagen', e);
      this._rows.set([]);
    }
  }
}

// Parser für Semikolon-getrennte CSV mit Quotes ("...") und doppelten Quotes zum Escapen
function parseCSV(input: string): Record<string, string>[] {
  input = input.replace(/^\uFEFF/, '').trim();
  if (!input) return [];
  const lines = input.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = splitCSVLine(lines[0]);
  const out: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length === 1 && cols[0].trim() === '') continue;
    const rec: Record<string, string> = {};
    header.forEach((h, idx) => {
      rec[h.trim()] = cols[idx] ?? '';
    });
    out.push(rec);
  }
  return out;
}

const DELIM = ';';

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { // escaped quote
        cur += '"';
        i++; // skip next
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === DELIM && !inQuotes) {
      result.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  result.push(cur);
  return result.map(c => c.trim());
}
