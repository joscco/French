import { TermRefInSentence } from '../models/term-ref-in-sentence';

export interface PromptSegment {
  text: string;
  ref?: TermRefInSentence; // gesetzt => markiertes Segment
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Baut eine Regex, die die Phrase nur matcht, wenn links/rechts KEIN Buchstabe ist.
 * Dadurch wird z.B. "an" nicht in "Französischkurs" gematcht.
 */
function makeBoundedRe(phrase: string): RegExp {
  const p = escapeRegExp(phrase);
  // Boundary: links/rechts darf kein Unicode-Letter/Mark sein
  return new RegExp(`(?<![\\p{L}\\p{M}])${p}(?![\\p{L}\\p{M}])`, 'gu');
}

function splitPhraseParts(phrase: string): string[] {
  // unterstützt "..." und "…"
  // Beispiel: "melde mich ... an" => ["melde mich", "an"]
  // trim + leere Teile raus
  return phrase
    .split(/\s*(?:\.{3}|…)\s*/g)
    .map(p => p.trim())
    .filter(Boolean);
}

type Match = { start: number; end: number; ref: TermRefInSentence; phrase: string };

/**
 * Findet eine "Kette" von Parts im Text:
 * part1 irgendwo, dann part2 NACH part1, usw.
 * Ergebnis: einzelne Matches je Part (damit alle Teile highlightbar sind)
 */
function findChainedPartMatches(text: string, parts: string[], ref: TermRefInSentence): Match[] {
  if (!parts.length) return [];

  const out: Match[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    // 1) ersten Part ab cursor suchen (bounded)
    const firstRe = makeBoundedRe(parts[0]);
    firstRe.lastIndex = cursor;
    const m1 = firstRe.exec(text);
    if (!m1) break;

    const chain: Match[] = [];
    chain.push({
      start: m1.index,
      end: m1.index + m1[0].length,
      ref,
      phrase: parts[0],
    });

    // 2) restliche Parts der Reihe nach hinterher suchen (bounded)
    let ok = true;
    let chainCursor = chain[0].end;

    for (let pi = 1; pi < parts.length; pi++) {
      const p = parts[pi];
      const re = makeBoundedRe(p);
      re.lastIndex = chainCursor;
      const mi = re.exec(text);
      if (!mi) {
        ok = false;
        break;
      }
      chain.push({
        start: mi.index,
        end: mi.index + mi[0].length,
        ref,
        phrase: p,
      });
      chainCursor = chain[chain.length - 1].end;
    }

    if (ok) {
      out.push(...chain);
      // nächste Kette erst NACH dem letzten Part suchen
      cursor = chainCursor;
    } else {
      // wenn keine vollständige Kette: nach dem gefundenen ersten Part weiter
      cursor = chain[0].end;
    }
  }

  return out;
}

export function buildPromptSegments(prompt: string, refs: TermRefInSentence[]): PromptSegment[] {
  const text = prompt ?? '';
  const usable = (refs ?? [])
    .map(r => ({ ref: r, phrase: (r.label ?? '').trim() }))
    .filter(x => x.phrase.length > 0);

  if (!text || !usable.length) {
    return [{ text }];
  }

  const matches: Match[] = [];

  for (const u of usable) {
    const parts = splitPhraseParts(u.phrase);

    // Split-Ref (…/...) => Ketten-Matching
    if (parts.length > 1) {
      matches.push(...findChainedPartMatches(text, parts, u.ref));
      continue;
    }

    // Normal: alle Vorkommen (bounded)
    const phrase = parts[0]; // nur ein Teil
    const re = makeBoundedRe(phrase);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        ref: u.ref,
        phrase,
      });
      // Schutz gegen Zero-Length (eigentlich unmöglich hier)
      if (m.index === re.lastIndex) re.lastIndex++;
    }
  }

  if (!matches.length) {
    return [{ text }];
  }

  // Sort: start asc, length desc
  matches.sort((a, b) => (a.start - b.start) || (b.end - b.start) - (a.end - a.start));

  // Greedy: nimm nur nicht-overlappende Matches
  const picked: Match[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start < lastEnd) continue;
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
