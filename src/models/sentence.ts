import {TermRef} from './term-ref';

export interface Sentence {
  id: number;
  de: string;
  fr: string;
  lesson: number;

  refs?: TermRef[];
}
