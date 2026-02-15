import {TermRefInSentence} from '../models/term-ref-in-sentence';
import {Lang} from '../../../shared/contract/contract';

const REF_RE = /\{([^|{}]+?)\|\s*#(\d+)\s*}/g;

export function extractTermRefs(text: string, lang: Lang): TermRefInSentence[] {
  const refs: TermRefInSentence[] = [];
  for (const match of text.matchAll(REF_RE)) {
    const label = (match[1] ?? '').trim();
    const termId = Number(match[2]);
    if (!termId || Number.isNaN(termId)) {
      continue;
    }
    refs.push({ lang, termId, label: label || undefined });
  }
  return refs;
}
