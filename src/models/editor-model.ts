export type Lang = 'fr' | 'de';

export type TermCategory = 'verbe' | 'nom' | 'expression' | 'adjectif' | 'autre';

export interface Term {
  id: number;
  lang: Lang;
  display: string;
  lemma?: string;
  category?: TermCategory;
  genus?: string;
  needsVowelArticle?: boolean;
  lessonIntroduced?: number;
  tags?: string[];
  media?: { image?: string; audio?: string };
  legacyKey?: string;
}

export interface TranslationLink {
  frTermId: number;
  deTermId: number;
  priority?: number;
}

export interface BilingualSentence {
  id: number;
  lesson: number;
  fr: SentenceSide;
  de: SentenceSide;
  meta?: { topic?: string; notes?: string };
}

export interface SentenceSide {
  template: SentenceTemplate;
  representative: SentenceRepresentative;
}

export interface SentenceTemplate {
  tokens: SentenceToken[];
  slots: TemplateSlot[];
}

export type SentenceToken =
  | { kind: 'text'; value: string }
  | { kind: 'slot'; slotId: number };

export interface TemplateSlot {
  id: number;
  label?: string;
  options: SlotOption[];
  selection?: 'one' | 'any';
}

export interface SlotOption {
  id: number;
  text: string;
  termIds?: number[]; // multiple terms possible
  weight?: number;
}

export interface SentenceRepresentative {
  text: string;
  annotations: SentenceAnnotation[];
  templatePicks?: Array<{ slotId: number; optionId: number }>;
  audio?: string;
  image?: string;
}

export interface SentenceAnnotation {
  id: number;
  termId: number;
  range: { start: number; end: number };
  surface?: string;
  label?: string;
}

export interface EditorDB {
  version: 1;
  nextIds: {
    term: number;
    sentence: number;
    annotation: number;
    slot: number;
    option: number;
  };
  terms: Term[];
  termLinks: TranslationLink[];
  sentences: BilingualSentence[];
}
