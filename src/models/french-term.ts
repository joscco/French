import {Genus} from './editor-model';

export interface FrenchTerm {
  key: string;
  category: string;
  term: string;
  genus?: Genus;
  needsVowelArticle?: boolean;
}
