import {Genus, Lang} from '../../../shared/contract/contract';

export interface WordCard {
  id: number;
  headLanguage: Lang;

  frenchPrimary: string;
  frenchSecondary?: string;
  germanPrimary: string;
  germanSecondary?: string;

  meta?: {
    category?: string;
    lesson?: number;
    fr_genus?: Genus;
    de_genus?: Genus;
    fr_needs_vowel_article?: boolean;
  };

  frontLanguage?: Lang;
}
