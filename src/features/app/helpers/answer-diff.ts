export type TokenKind = 'ok' | 'soft' | 'wrong' | 'missing';

export interface OverlayToken {
  isWord: boolean;
  text: string;           // Original-Text aus der Antwort (oder whitespace/punct)
  kind?: TokenKind;       // nur relevant wenn isWord=true (oder missing-marker)
  expectedHint?: string;  // was korrekt gewesen wäre (Badge-Inhalt)
}

export interface DisplayToken {
  isWord: boolean;
  text: string;                // was im Overlay angezeigt wird (Antwort-Text)
  kind?: TokenKind;
  badge?: string;              // Badge über diesem Block
  badgeColor?: 'green';
}

type RawToken = { text: string; isWord: boolean };

/** Split: Wörter / Whitespace / Rest (Punctuation etc.) getrennt */
export function tokenizeWords(text: string): RawToken[] {
  const input = text ?? '';

  // Word = letters+marks, optional apostrophe/hyphen inside word
  const re = /([\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*)|(\s+)|([^\s\p{L}\p{M}]+)/gu;

  const tokens: RawToken[] = [];
  let match: RegExpExecArray | null;

  while ((match = re.exec(input))) {
    const word = match[1];
    const whitespace = match[2];
    const other = match[3];

    if (word) tokens.push({ text: word, isWord: true });
    else if (whitespace) tokens.push({ text: whitespace, isWord: false });
    else if (other) tokens.push({ text: other, isWord: false });
  }

  return tokens;
}

function normalizeWordForCompare(word: string): string {
  return (word ?? '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

type EditOp = 'equal' | 'replace' | 'insert' | 'delete';

interface WordEdit {
  op: EditOp;
  expected?: string; // expected word
  answer?: string;   // answer word
}

/** Levenshtein-basiertes Edit-Script auf Wortlisten */
function diffWordLists(expectedWords: string[], answerWords: string[]): WordEdit[] {
  const expLen = expectedWords.length;
  const ansLen = answerWords.length;

  const cost: number[][] = Array.from({ length: expLen + 1 }, () => Array(ansLen + 1).fill(0));
  const back: EditOp[][] = Array.from({ length: expLen + 1 }, () => Array(ansLen + 1).fill('equal'));

  for (let i = 1; i <= expLen; i++) {
    cost[i][0] = i;
    back[i][0] = 'delete';
  }
  for (let j = 1; j <= ansLen; j++) {
    cost[0][j] = j;
    back[0][j] = 'insert';
  }

  for (let i = 1; i <= expLen; i++) {
    for (let j = 1; j <= ansLen; j++) {
      const expected = expectedWords[i - 1];
      const answer = answerWords[j - 1];

      const equalAfterNormalize =
        normalizeWordForCompare(expected) === normalizeWordForCompare(answer);

      const del = cost[i - 1][j] + 1;
      const ins = cost[i][j - 1] + 1;
      const rep = cost[i - 1][j - 1] + (equalAfterNormalize ? 0 : 1);

      const best = Math.min(del, ins, rep);
      cost[i][j] = best;

      if (best === rep) back[i][j] = equalAfterNormalize ? 'equal' : 'replace';
      else if (best === del) back[i][j] = 'delete';
      else back[i][j] = 'insert';
    }
  }

  const edits: WordEdit[] = [];
  let i = expLen, j = ansLen;

  while (i > 0 || j > 0) {
    const op = back[i][j];

    if (op === 'equal') {
      edits.push({ op, expected: expectedWords[i - 1], answer: answerWords[j - 1] });
      i--; j--;
    } else if (op === 'replace') {
      edits.push({ op, expected: expectedWords[i - 1], answer: answerWords[j - 1] });
      i--; j--;
    } else if (op === 'delete') {
      edits.push({ op, expected: expectedWords[i - 1] });
      i--;
    } else {
      edits.push({ op, answer: answerWords[j - 1] });
      j--;
    }
  }

  edits.reverse();
  return edits;
}

/**
 * Erstellt Overlay-Tokens in der Reihenfolge der *Antwort* (damit das Overlay exakt drüber passt).
 * - ok: exakt gleich
 * - soft: nur Case/Akzent anders (fold gleich, aber raw ungleich)
 * - wrong: falsches Wort (expected kann gesetzt sein)
 * - missing: fehlende expected Wörter (text leer; wird als Marker gerendert)
 *
 * WICHTIG: deletes werden NICHT sofort als missing-Token ausgegeben,
 * sondern gesammelt (pendingMissing) und an den nächsten Badge gehängt.
 * Dadurch vermeidest du "La" als separates Badge am Zeilenanfang.
 */
export function buildWordOverlayTokens(expectedRaw: string, answerRaw: string): OverlayToken[] {
  const expectedTokens = tokenizeWords(expectedRaw);
  const answerTokens = tokenizeWords(answerRaw);

  const expectedWords = expectedTokens.filter(t => t.isWord).map(t => t.text);
  const answerWords = answerTokens.filter(t => t.isWord).map(t => t.text);

  const edits = diffWordLists(expectedWords, answerWords);

  const overlay: OverlayToken[] = [];
  let editPos = 0;

  // deletes werden gesammelt und als EIN missing-marker ausgegeben
  const pendingMissingWords: string[] = [];

  const collectDeletes = () => {
    while (editPos < edits.length && edits[editPos].op === 'delete') {
      const missing = edits[editPos].expected;
      if (missing) {
        pendingMissingWords.push(missing);
      }
      editPos++;
    }
  };

  const emitMissingMarkerIfNeeded = () => {
    if (!pendingMissingWords.length) return;

    overlay.push({
      isWord: true,
      kind: 'missing',
      text: '', // zero-width marker
      expectedHint: pendingMissingWords.join(' ').trim() || undefined,
    });

    pendingMissingWords.length = 0;
  };

  const nextNonDeleteEdit = (): WordEdit | undefined => {
    collectDeletes();
    emitMissingMarkerIfNeeded();
    return edits[editPos++];
  };

  for (const token of answerTokens) {
    // whitespace/punctuation: einfach übernehmen (Layout bleibt stabil)
    if (!token.isWord) {
      overlay.push({ isWord: false, text: token.text });
      continue;
    }

    const edit = nextNonDeleteEdit();

    // Antwort hat mehr Wörter als expected
    if (!edit) {
      overlay.push({ isWord: true, text: token.text, kind: 'wrong' });
      continue;
    }

    if (edit.op === 'equal') {
      const expected = edit.expected ?? '';
      const answer = edit.answer ?? '';
      const exactlyEqual = expected === answer;

      overlay.push({
        isWord: true,
        text: token.text,
        kind: exactlyEqual ? 'ok' : 'soft',
        expectedHint: exactlyEqual ? undefined : expected, // soft kann Badge zeigen
      });
      continue;
    }

    if (edit.op === 'replace') {
      overlay.push({
        isWord: true,
        text: token.text,
        kind: 'wrong',
        expectedHint: edit.expected,
      });
      continue;
    }

    if (edit.op === 'insert') {
      overlay.push({ isWord: true, text: token.text, kind: 'wrong' });
      continue;
    }

    // delete wird vorher schon rausgezogen – fallback:
    overlay.push({ isWord: true, text: token.text, kind: 'wrong' });
  }

  // remaining deletes after the last answer word
  collectDeletes();
  emitMissingMarkerIfNeeded();

  return overlay;
}

/**
 * Fasst aufeinanderfolgende falsche Wörter zu einem Block zusammen,
 * damit nicht viele grüne Badges übereinander liegen.
 *
 * - Wrong-Run: beginnt bei isWord && kind==='wrong'
 * - Whitespace zwischen wrong-Wörtern wird in den Block gezogen
 * - Badge-Text = concatenation aller vorhandenen expected-Fragmente (inkl. pendingMissing-Phrasen)
 * - Missing-Token wird zu einem "Marker" mit Badge (eine Phrase)
 */
export function collapseOverlayRuns(tokens: OverlayToken[]): DisplayToken[] {
  const display: DisplayToken[] = [];

  const isWhitespaceToken = (token: OverlayToken) =>
    !token.isWord && /^\s+$/.test(token.text ?? '');

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (!token.isWord) {
      display.push({ isWord: false, text: token.text });
      continue;
    }

    if (token.kind === 'missing') {
      display.push({
        isWord: true,
        text: '',
        kind: 'missing',
        badge: token.expectedHint,
        badgeColor: 'green',
      });
      continue;
    }

    if (token.kind !== 'wrong') {
      display.push({
        isWord: true,
        text: token.text,
        kind: token.kind,
        badge: token.kind === 'soft' ? token.expectedHint : undefined,
        badgeColor: token.kind === 'soft' && token.expectedHint ? 'green' : undefined,
      });
      continue;
    }

    // WRONG RUN: merge "wrong (space wrong)*" into one display token
    let mergedText = token.text;
    const expectedHints: string[] = [];
    if (token.expectedHint) {
      expectedHints.push(token.expectedHint);
    }

    while (true) {
      const maybeSpace = tokens[i + 1];
      const maybeNextWrong = tokens[i + 2];

      const canMerge =
        maybeSpace &&
        maybeNextWrong &&
        isWhitespaceToken(maybeSpace) &&
        maybeNextWrong.isWord &&
        maybeNextWrong.kind === 'wrong';

      if (!canMerge) {
        break;
      }

      mergedText += maybeSpace.text + maybeNextWrong.text;
      if (maybeNextWrong.expectedHint) {
        expectedHints.push(maybeNextWrong.expectedHint);
      }

      i += 2;
    }

    display.push({
      isWord: true,
      text: mergedText,
      kind: 'wrong',
      badge: expectedHints.length ? expectedHints.join(' ') : undefined,
      badgeColor: expectedHints.length ? 'green' : undefined,
    });
  }

  return display;
}
