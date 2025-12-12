export type HeadLanguage = 'fr' | 'de';

export interface PracticeCard {
  id: string;
  headLanguage: HeadLanguage;

  frenchPrimary: string;
  frenchSecondary?: string;
  germanPrimary: string;
  germanSecondary?: string;

  meta?: {
    category?: string;
    lesson?: number;
    fr_genus?: string;
    de_genus?: string;
    fr_needs_vowel_article?: boolean;
  };

  frontLanguage?: 'french' | 'german';
}
