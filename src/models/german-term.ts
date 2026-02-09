import {Genus} from './editor-model';

export interface GermanTerm {
  key: string;
  category: string;
  term: string;
  genus?: Genus;
}
