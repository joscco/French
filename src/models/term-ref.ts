export interface TermRef {
  lang: 'fr' | 'de';
  key: string;        // z.B. "s'inscrire" oder "Wandern|nom"
  label?: string;     // phrase aus dem Satz (surface oder "…"-join)
}
