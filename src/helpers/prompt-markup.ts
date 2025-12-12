// helpers/prompt-markup.ts
import { TermRef } from '../models/term-ref';

export interface PromptSegment {
  text: string;
  ref?: TermRef; // gesetzt => markiertes Segment
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildPromptSegments(prompt: string, refs: TermRef[]): PromptSegment[] {
  const text = prompt ?? '';
  const usable = (refs ?? [])
    .map(r => ({ ref: r, phrase: (r.label ?? '').trim() }))
    .filter(x => x.phrase.length > 0);

  if (!text || !usable.length) {
    return [{ text }];
  }

  // Matches sammeln (alle Vorkommen), längere bevorzugen
  type Match = { start: number; end: number; ref: TermRef; phrase: string };
  const matches: Match[] = [];

  for (const u of usable) {
    // case-sensitive exact match – CSV phrase soll im Satz so vorkommen
    // (wenn du später “ignore case/accents” willst, sag Bescheid, dann folden wir)
    const re = new RegExp(escapeRegExp(u.phrase), 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        ref: u.ref,
        phrase: u.phrase,
      });
      // Schutz gegen Zero-Length (eigentlich unmöglich hier)
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  if (!matches.length) {
    return [{ text }];
  }

  // Sort: start asc, length desc (longest first bei gleichem start)
  matches.sort((a, b) => (a.start - b.start) || (b.end - b.start) - (a.end - a.start));

  // Greedy: nimm nur nicht-overlappende Matches
  const picked: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start < lastEnd) continue; // overlap
    picked.push(m);
    lastEnd = m.end;
  }

  // Segmente bauen
  const out: PromptSegment[] = [];
  let cursor = 0;

  for (const m of picked) {
    if (m.start > cursor) out.push({ text: text.slice(cursor, m.start) });
    out.push({ text: text.slice(m.start, m.end), ref: m.ref });
    cursor = m.end;
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor) });

  return out.filter(s => s.text.length > 0);
}
