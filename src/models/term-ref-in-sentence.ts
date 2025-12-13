import {Language} from './types';

export interface TermRefInSentence {
  lang: Language;
  key: string;
  label?: string; // Representative how the term appears in a specific context
}
