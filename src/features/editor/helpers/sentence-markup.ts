// src/app/helpers/sentence-markup.ts
export type Node =
  | { kind: 'text'; value: string }
  | { kind: 'ann'; surface: string; termId?: number } // {pomme|#200} or {pomme}
  | { kind: 'alt'; options: Node[][] };               // [ ... | ... ] supports nesting

export function parseSentenceMarkup(input: string): Node[] {
  let i = 0;

  function parseAnnotation(): Node {
    let inner = '';
    while (i < input.length && input[i] !== '}') inner += input[i++];
    if (input[i] === '}') i++;

    const parts = inner.split('|').map(s => s.trim()).filter(Boolean);
    const surface = parts[0] ?? '';
    const idPart = parts[1] ?? '';
    const m = idPart.match(/^#(\d+)$/);
    return { kind: 'ann', surface, termId: m ? Number(m[1]) : undefined };
  }

  function parseAlternatives(): Node {
    const options: Node[][] = [];
    let current: Node[] = [];
    let buf = '';

    function flushText() {
      if (buf) current.push({ kind: 'text', value: buf });
      buf = '';
    }

    while (i < input.length) {
      const ch = input[i];

      if (ch === ']') {
        flushText();
        i++;
        options.push(current);
        return { kind: 'alt', options };
      }

      if (ch === '|') {
        flushText();
        i++;
        options.push(current);
        current = [];
        continue;
      }

      if (ch === '{') {
        flushText();
        i++;
        current.push(parseAnnotation());
        continue;
      }

      if (ch === '[') {
        flushText();
        i++;
        current.push(parseAlternatives());
        continue;
      }

      buf += ch;
      i++;
    }

    flushText();
    options.push(current);
    return { kind: 'alt', options };
  }

  const out: Node[] = [];
  let buf = '';

  function flush() {
    if (buf) out.push({ kind: 'text', value: buf });
    buf = '';
  }

  while (i < input.length) {
    const ch = input[i];

    if (ch === '{') {
      flush();
      i++;
      out.push(parseAnnotation());
      continue;
    }

    if (ch === '[') {
      flush();
      i++;
      out.push(parseAlternatives());
      continue;
    }

    buf += ch;
    i++;
  }

  flush();
  return out;
}

export function representativeText(nodes: Node[]): string {
  const rep = (ns: Node[]): string =>
    ns
      .map(n => {
        if (n.kind === 'text') return n.value;
        if (n.kind === 'ann') return n.surface;
        return rep(n.options[0] ?? []);
      })
      .join('');
  return rep(nodes);
}

/** build flat "segments" for clickable preview */
export type PreviewSeg =
  | { kind: 'text'; text: string }
  | { kind: 'altStart' }
  | { kind: 'altSep' }
  | { kind: 'altEnd' }
  | { kind: 'ann'; surface: string; termId?: number; raw: string };

export function previewSegments(nodes: Node[]): PreviewSeg[] {
  const segs: PreviewSeg[] = [];

  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.kind === 'text') {
        if (n.value) segs.push({ kind: 'text', text: n.value });
      } else if (n.kind === 'ann') {
        const raw = n.termId ? `{${n.surface}|#${n.termId}}` : `{${n.surface}}`;
        segs.push({ kind: 'ann', surface: n.surface, termId: n.termId, raw });
      } else {
        segs.push({ kind: 'altStart' });
        n.options.forEach((opt, idx) => {
          if (idx > 0) segs.push({ kind: 'altSep' });
          walk(opt);
        });
        segs.push({ kind: 'altEnd' });
      }
    }
  };

  walk(nodes);
  return segs;
}

export function replaceFirstExact(hay: string, needle: string, replacement: string): string {
  const idx = hay.indexOf(needle);
  if (idx < 0) return hay;
  return hay.slice(0, idx) + replacement + hay.slice(idx + needle.length);
}
