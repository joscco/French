export type TermDisplaySeg =
  | { kind: 'text'; text: string }
  | { kind: 'hint'; text: string; raw: string }; // raw includes braces, e.g. "{qc.}"

export function parseTermDisplayMarkup(input: string): TermDisplaySeg[] {

  const segments: TermDisplaySeg[] = [];
  let index = 0;
  let textBuffer = '';

  function flushText() {

    if (textBuffer.length > 0) {
      segments.push({ kind: 'text', text: textBuffer });
      textBuffer = '';
    }

  }

  function readEscapedOrLiteralChar(): string {

    const currentChar = input[index];

    if (currentChar === '\\' && (index + 1) < input.length) {

      const nextChar = input[index + 1];

      if (nextChar === '{' || nextChar === '}' || nextChar === '\\') {
        index += 2;
        return nextChar;
      }

    }

    index += 1;
    return currentChar;

  }

  while (index < input.length) {

    const currentChar = input[index];

    if (currentChar === '{') {

      flushText();

      const rawStartIndex = index;
      index += 1; // consume "{"

      let hintText = '';

      while (index < input.length) {

        const innerChar = input[index];

        if (innerChar === '}') {

          index += 1; // consume "}"
          const raw = input.slice(rawStartIndex, index);

          segments.push({
            kind: 'hint',
            text: hintText,
            raw,
          });

          hintText = '';
          break;

        }

        hintText += readEscapedOrLiteralChar();

      }

      // unmatched "{...": treat as literal text
      if (hintText.length > 0) {
        textBuffer += '{' + hintText;
      }

      continue;

    }

    textBuffer += readEscapedOrLiteralChar();

  }

  flushText();
  return segments;

}


export function getSortableText(termText: string): string {
  const segments = parseTermDisplayMarkup(termText ?? '');
  return segments
    .filter(seg => seg.kind === 'text')
    .map(seg => seg.text)
    .join('')
    .trim()
    .toLowerCase();
}
