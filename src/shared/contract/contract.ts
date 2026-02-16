export type Lang = 'fr' | 'de';

export type TermCategory = 'verb' | 'noun' | 'expression' | 'adjective' | 'other';

export type Genus = 'm' | 'f' | 'n' | 'pl' | 'mpl' | 'fpl' | 'npl' | 'm/f';

export interface GroupRow {
  id: number;
  name: string;      // display label
  date?: string;     // ISO "2025-09-10" recommended
}

export interface UnitRow {
  id: number;
  group_id: number;
  name: string;      // display label
  date?: string;     // ISO "2025-09-10" recommended
  order?: number;    // optional explicit ordering inside group
  tags?: string[];   // optional
}

export interface TermRow {
  id: number;
  lang: Lang;
  category?: TermCategory;
  term_text: string;
  genus?: Genus;               // only meaningful if category === 'noun'
  needsVowelArticle?: boolean;  // only meaningful if lang === 'fr' && category === 'noun'
  ref?: string;
  unitId?: number;              // introduced in
  tags?: string[];
  has_image?: boolean;
  has_audio: boolean;
}

export interface TermLinkRow {
  fr_id: number;
  de_id: number;
  priority?: number;
}

export interface SentenceRow {
  id: number;
  unitId: number;
  fr: string;     // template string with [] and {surface|#id}
  de: string;
  note?: string;
  has_audio_fr?: boolean;
  has_audio_de?: boolean;
  has_image?: boolean;
}

export interface AuthoringDB {
  groups: GroupRow[];
  units: UnitRow[];
  terms: TermRow[];
  termLinks: TermLinkRow[];
  sentences: SentenceRow[];
}
