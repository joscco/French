import {TermRefInSentence} from './term-ref-in-sentence';

export interface SentenceVm {
  id: number;
  unitId: number;

  frRaw: string;
  deRaw: string;

  fr: string; // plain/representative
  de: string; // plain/representative

  refs: TermRefInSentence[];
}
