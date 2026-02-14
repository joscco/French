import {Lang} from '../../../shared/contract/contract';

export interface TermRefInSentence {
  lang: Lang;          // 'fr' | 'de'
  termId: number;      // ✅ neu: die Referenz ist jetzt die ID
  label?: string;      // optional: Surface/Anzeige im Satz
}
