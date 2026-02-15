import { TermRefInSentence } from '../models/term-ref-in-sentence';

export interface PromptSegment {
  text: string;
  ref?: TermRefInSentence; // gesetzt => markiertes Segment
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Baut eine Regex, die die Phrase nur matcht, wenn links/rechts KEIN Buchstabe ist.
 * Dadurch wird z.B. "an" nicht in "Französischkurs" gematcht.
 */
function makeBoundedRe(phrase: string): RegExp {
  const escapedPhrase = escapeRegExp(phrase);
  // Boundary: links/rechts darf kein Unicode-Letter/Mark sein
  return new RegExp(`(?<![\\p{L}\\p{M}])${escapedPhrase}(?![\\p{L}\\p{M}])`, 'gu');
}

function splitPhraseParts(phrase: string): string[] {
  return phrase
    .split(/\s*(?:\.{3}|…)\s*/g)
    .map(part => part.trim())
    .filter(Boolean);
}

type Match = { start: number; end: number; ref: TermRefInSentence; phrase: string };

/**
 * Findet eine "Kette" von Parts im Text:
 * part1 irgendwo, dann part2 NACH part1, usw.
 * Ergebnis: einzelne Matches je Part (damit alle Teile highlightbar sind)
 */
function findChainedPartMatches(text: string, parts: string[], ref: TermRefInSentence): Match[] {
  if (!parts.length) {
    return [];
  }

  const matches: Match[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const firstRegex = makeBoundedRe(parts[0]);
    firstRegex.lastIndex = cursor;
    const firstMatch = firstRegex.exec(text);
    if (!firstMatch) {
      break;
    }

    const chain: Match[] = [];
    chain.push({
      start: firstMatch.index,
      end: firstMatch.index + firstMatch[0].length,
      ref,
      phrase: parts[0],
    });

    let isComplete = true;
    let chainCursor = chain[0].end;

    for (let partIndex = 1; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex];
      const regex = makeBoundedRe(part);
      regex.lastIndex = chainCursor;
      const partMatch = regex.exec(text);
      if (!partMatch) {
        isComplete = false;
        break;
      }
      chain.push({
        start: partMatch.index,
        end: partMatch.index + partMatch[0].length,
        ref,
        phrase: part,
      });
      chainCursor = chain[chain.length - 1].end;
    }

    if (isComplete) {
      matches.push(...chain);
      cursor = chainCursor;
    } else {
      cursor = chain[0].end;
    }
  }

  return matches;
}

export function buildPromptSegments(prompt: string, refs: TermRefInSentence[]): PromptSegment[] {
  const text = prompt ?? '';
  const usableRefs = (refs ?? [])
    .map(ref => ({ ref, phrase: (ref.label ?? '').trim() }))
    .filter(item => item.phrase.length > 0);

  if (!text || !usableRefs.length) {
    return [{ text }];
  }

  const matches: Match[] = [];

  for (const usableRef of usableRefs) {
    const parts = splitPhraseParts(usableRef.phrase);

    if (parts.length > 1) {
      matches.push(...findChainedPartMatches(text, parts, usableRef.ref));
      continue;
    }

    const phrase = parts[0];
    const regex = makeBoundedRe(phrase);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text))) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        ref: usableRef.ref,
        phrase,
      });
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  }

  if (!matches.length) {
    return [{ text }];
  }

  matches.sort((a, b) => (a.start - b.start) || (b.end - b.start) - (a.end - a.start));

  const pickedMatches: Match[] = [];
  let lastEnd = -1;
  for (const match of matches) {
    if (match.start < lastEnd) {
      continue;
    }
    pickedMatches.push(match);
    lastEnd = match.end;
  }

  const segments: PromptSegment[] = [];
  let cursor = 0;

  for (const match of pickedMatches) {
    if (match.start > cursor) {
      segments.push({ text: text.slice(cursor, match.start) });
    }
    segments.push({ text: text.slice(match.start, match.end), ref: match.ref });
    cursor = match.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments.filter(segment => segment.text.length > 0);
}
