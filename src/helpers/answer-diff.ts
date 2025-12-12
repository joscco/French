export type TokenKind = 'ok' | 'soft' | 'wrong' | 'missing';

export interface WordToken {
  isWord: boolean;
  text: string;          // User-Text (oder Whitespace/Punct)
  kind?: TokenKind;      // nur relevant, wenn isWord=true oder missing-marker
  expected?: string;     // korrektes Wort / Phrase (wenn bekannt)
}

export interface DisplayToken {
  isWord: boolean;
  text: string;          // was im Text angezeigt wird (User-Text)
  kind?: TokenKind;      // für Highlight
  badge?: string;        // wenn gesetzt: EIN Badge über diesem Block
  badgeColor?: 'green';
}

/** Tokenizer: Wörter + Leerzeichen + Satzzeichen getrennt, damit Layout stabil bleibt */
export function tokenizeWords(s: string): { text: string; isWord: boolean }[] {
  const input = s ?? '';
  // Word = Buchstaben inkl. Akzent + Apostroph + Bindestrich; Rest separat
  const re = /([\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*)|(\s+)|([^\s\p{L}\p{M}]+)/gu;

  const out: { text: string; isWord: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    const word = m[1];
    const space = m[2];
    const punct = m[3];
    if (word) out.push({ text: word, isWord: true });
    else if (space) out.push({ text: space, isWord: false });
    else if (punct) out.push({ text: punct, isWord: false });
  }
  return out;
}

function foldWord(w: string): string {
  return (w ?? '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

type Op = 'equal' | 'replace' | 'insert' | 'delete';

interface Edit {
  op: Op;
  a?: string; // expected word
  b?: string; // answer word
}

/** Levenshtein-basiertes Word-Edit-Script */
function diffWords(expectedWords: string[], answerWords: string[]): Edit[] {
  const n = expectedWords.length;
  const m = answerWords.length;

  // dp[i][j] = minimaler Edit-Cost für expected[0..i) -> answer[0..j)
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  const bt: Op[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill('equal'));

  for (let i = 1; i <= n; i++) {
    dp[i][0] = i;
    bt[i][0] = 'delete';
  }
  for (let j = 1; j <= m; j++) {
    dp[0][j] = j;
    bt[0][j] = 'insert';
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const a = expectedWords[i - 1];
      const b = answerWords[j - 1];

      const isEqFold = foldWord(a) === foldWord(b);

      const costDel = dp[i - 1][j] + 1;
      const costIns = dp[i][j - 1] + 1;
      const costRep = dp[i - 1][j - 1] + (isEqFold ? 0 : 1);

      const best = Math.min(costDel, costIns, costRep);
      dp[i][j] = best;

      if (best === costRep) bt[i][j] = isEqFold ? 'equal' : 'replace';
      else if (best === costDel) bt[i][j] = 'delete';
      else bt[i][j] = 'insert';
    }
  }

  // Backtrace
  const edits: Edit[] = [];
  let i = n, j = m;

  while (i > 0 || j > 0) {
    const op = bt[i][j];

    if (op === 'equal') {
      edits.push({ op: 'equal', a: expectedWords[i - 1], b: answerWords[j - 1] });
      i--; j--;
    } else if (op === 'replace') {
      edits.push({ op: 'replace', a: expectedWords[i - 1], b: answerWords[j - 1] });
      i--; j--;
    } else if (op === 'delete') {
      edits.push({ op: 'delete', a: expectedWords[i - 1] });
      i--;
    } else { // insert
      edits.push({ op: 'insert', b: answerWords[j - 1] });
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
export function buildWordOverlayTokens(expectedRaw: string, answerRaw: string): WordToken[] {
  const expectedTokens = tokenizeWords(expectedRaw);
  const answerTokens = tokenizeWords(answerRaw);

  const expectedWords = expectedTokens.filter(t => t.isWord).map(t => t.text);
  const answerWords = answerTokens.filter(t => t.isWord).map(t => t.text);

  const edits = diffWords(expectedWords, answerWords);

  const out: WordToken[] = [];
  let editIndex = 0;

  const pendingMissing: string[] = [];

  const pullDeletesIntoPending = () => {
    while (editIndex < edits.length && edits[editIndex].op === 'delete') {
      const a = edits[editIndex].a;
      if (a) pendingMissing.push(a);
      editIndex++;
    }
  };

  const consumeWordEdit = (): Edit | undefined => {
    pullDeletesIntoPending();
    return edits[editIndex++];
  };

  const withPending = (expected?: string) => {
    if (!pendingMissing.length) return expected;
    const prefix = pendingMissing.join(' ');
    pendingMissing.length = 0;
    return expected ? `${prefix} ${expected}` : prefix;
  };

  for (const t of answerTokens) {
    if (!t.isWord) {
      out.push({ isWord: false, text: t.text });
      continue;
    }

    const e = consumeWordEdit();

    if (!e) {
      // Antwort hat mehr Wörter als expected (insert-run am Ende)
      out.push({ isWord: true, text: t.text, kind: 'wrong', expected: withPending(undefined) });
      continue;
    }

    if (e.op === 'equal') {
      const a = e.a ?? '';
      const b = e.b ?? '';
      const isExact = a === b;                 // raw exakt gleich?
      const kind: TokenKind = isExact ? 'ok' : 'soft';

      out.push({
        isWord: true,
        text: t.text,
        kind,
        expected: kind === 'soft' ? withPending(a) : withPending(undefined),
      });
      continue;
    }

    if (e.op === 'replace') {
      out.push({ isWord: true, text: t.text, kind: 'wrong', expected: withPending(e.a) });
      continue;
    }

    if (e.op === 'insert') {
      out.push({ isWord: true, text: t.text, kind: 'wrong', expected: withPending(undefined) });
      continue;
    }

    // delete wird von pullDeletesIntoPending() vorher abgefangen
    out.push({ isWord: true, text: t.text, kind: 'wrong', expected: withPending(undefined) });
  }

  // Falls am Ende noch deletes übrig sind: EIN missing-Token ans Ende (Badge = ganze Phrase)
  pullDeletesIntoPending();
  if (pendingMissing.length) {
    out.push({
      isWord: true,
      kind: 'missing',
      text: '',
      expected: pendingMissing.join(' ').trim() || undefined
    });
    pendingMissing.length = 0;
  }

  return out;
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
export function collapseOverlayRuns(tokens: WordToken[]): DisplayToken[] {
  const out: DisplayToken[] = [];

  const isSpace = (t: WordToken) => !t.isWord && /^\s+$/.test(t.text ?? '');

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];

    // Non-word: direkt durch
    if (!t.isWord) {
      out.push({ isWord: false, text: t.text });
      continue;
    }

    // Missing: als Marker-Token (kein Text, nur Badge)
    if (t.kind === 'missing') {
      out.push({
        isWord: true,
        text: '',
        kind: 'missing',
        badge: t.expected,
        badgeColor: 'green',
      });
      continue;
    }

    // ok/soft: direkt durch (optional: soft kann expected als Badge haben)
    if (t.kind !== 'wrong') {
      out.push({
        isWord: true,
        text: t.text,
        kind: t.kind,
        badge: t.kind === 'soft' ? t.expected : undefined,
        badgeColor: t.kind === 'soft' && t.expected ? 'green' : undefined
      });
      continue;
    }

    // WRONG-RUN starten
    let runText = t.text;
    const runExpected: string[] = [];
    if (t.expected) runExpected.push(t.expected);

    // Wir ziehen: (spaces + next wrong word)+ in den Run
    while (true) {
      const spaceTok = tokens[i + 1];
      const nextTok = tokens[i + 2];

      if (spaceTok && nextTok && isSpace(spaceTok) && nextTok.isWord && nextTok.kind === 'wrong') {
        runText += spaceTok.text + nextTok.text;
        if (nextTok.expected) runExpected.push(nextTok.expected);
        i += 2;
        continue;
      }
      break;
    }

    out.push({
      isWord: true,
      text: runText,
      kind: 'wrong',
      badge: runExpected.length ? runExpected.join(' ') : undefined,
      badgeColor: runExpected.length ? 'green' : undefined
    });
  }

  return out;
}
