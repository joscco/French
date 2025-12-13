import {TermRefInSentence} from './term-ref-in-sentence';

export interface Sentence {
  id: number;
  de: string;
  fr: string;
  lesson: number;

  refs?: TermRefInSentence[];
}
