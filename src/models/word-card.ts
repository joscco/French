import {Genus} from './editor-model';

export type HeadLanguage = 'fr' | 'de';

export interface WordCard {
  id: string;
  headLanguage: HeadLanguage;

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

  frontLanguage?: 'french' | 'german';
}
