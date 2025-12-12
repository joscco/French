export interface SentenceRefRow {
  id: number; // row-id
  sentenceId: number;
  termLanguage: 'fr' | 'de';
  termId: number;
  phrase?: string;
}
