export type Node =
  | { kind: 'text'; value: string }
  | { kind: 'ann'; surface: string; termId?: number } // {pomme|#200} or {pomme}
  | { kind: 'alt'; options: Node[][] };               // [ ... | ... ] supports nesting

export function parseSentenceMarkup(input: string): Node[] {
  let i = 0;

  function parseAnnotation(): Node {
    let inner = '';
    while (i < input.length && input[i] !== '}') {
      inner += input[i];
      i++;
    }
    if (input[i] === '}') {
      i++;
    }

    const parts = inner.split('|').map(s => s.trim()).filter(Boolean);
    const surface = parts[0] ?? '';
    const idPart = parts[1] ?? '';
    const match = idPart.match(/^#(\d+)$/);
    return { kind: 'ann', surface, termId: match ? Number(match[1]) : undefined };
  }

  function parseAlternatives(): Node {
    const options: Node[][] = [];
    let current: Node[] = [];
    let buffer = '';

    function flushText() {
      if (buffer) {
        current.push({ kind: 'text', value: buffer });
      }
      buffer = '';
    }

    while (i < input.length) {
      const char = input[i];

      if (char === ']') {
        flushText();
        i++;
        options.push(current);
        return { kind: 'alt', options };
      }

      if (char === '|') {
        flushText();
        i++;
        options.push(current);
        current = [];
        continue;
      }

      if (char === '{') {
        flushText();
        i++;
        current.push(parseAnnotation());
        continue;
      }

      if (char === '[') {
        flushText();
        i++;
        current.push(parseAlternatives());
        continue;
      }

      buffer += char;
      i++;
    }

    flushText();
    options.push(current);
    return { kind: 'alt', options };
  }

  const out: Node[] = [];
  let buffer = '';

  function flush() {
    if (buffer) {
      out.push({ kind: 'text', value: buffer });
    }
    buffer = '';
  }

  while (i < input.length) {
    const char = input[i];

    if (char === '{') {
      flush();
      i++;
      out.push(parseAnnotation());
      continue;
    }

    if (char === '[') {
      flush();
      i++;
      out.push(parseAlternatives());
      continue;
    }

    buffer += char;
    i++;
  }

  flush();
  return out;
}

export function representativeText(nodes: Node[]): string {
  const represent = (nodeList: Node[]): string =>
    nodeList
      .map(node => {
        if (node.kind === 'text') {
          return node.value;
        }
        if (node.kind === 'ann') {
          return node.surface;
        }
        return represent(node.options[0] ?? []);
      })
      .join('');
  return represent(nodes);
}

/** build flat "segments" for clickable preview */
export type PreviewSeg =
  | { kind: 'text'; text: string }
  | { kind: 'altStart' }
  | { kind: 'altSep' }
  | { kind: 'altEnd' }
  | { kind: 'ann'; surface: string; termId?: number; raw: string };

export function previewSegments(nodes: Node[]): PreviewSeg[] {
  const segments: PreviewSeg[] = [];

  const walk = (nodeList: Node[]) => {
    for (const node of nodeList) {
      if (node.kind === 'text') {
        if (node.value) {
          segments.push({ kind: 'text', text: node.value });
        }
      } else if (node.kind === 'ann') {
        const raw = node.termId ? `{${node.surface}|#${node.termId}}` : `{${node.surface}}`;
        segments.push({ kind: 'ann', surface: node.surface, termId: node.termId, raw });
      } else {
        segments.push({ kind: 'altStart' });
        node.options.forEach((option, index) => {
          if (index > 0) {
            segments.push({ kind: 'altSep' });
          }
          walk(option);
        });
        segments.push({ kind: 'altEnd' });
      }
    }
  };

  walk(nodes);
  return segments;
}

export function replaceFirstExact(haystack: string, needle: string, replacement: string): string {
  const index = haystack.indexOf(needle);
  if (index < 0) {
    return haystack;
  }
  return haystack.slice(0, index) + replacement + haystack.slice(index + needle.length);
}
