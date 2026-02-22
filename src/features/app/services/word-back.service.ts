import {computed, inject, Injectable} from '@angular/core';
import {Lang, SentenceRow, TermRow} from '../../../shared/contract/contract';
import {SentencesService} from '../../../services/sentence.service';
import {TermLinksService} from '../../../services/termLinks.service';
import {TermsService} from '../../../services/terms.service';
import {parseSentenceMarkup, representativeText} from '../../editor/helpers/sentence-markup';
import {WordCardBackVm} from '../models/word-card';

// standalone helper (wie bei dir in AllowedTermsService)
function extractTermIdsFromMarkup(text: string): number[] {
  const stringValue = String(text ?? '');
  const ids: number[] = [];
  const regex = /#(\d+)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(stringValue)) !== null) {
    const id = Number(match[1]);
    if (Number.isFinite(id) && id > 0) {
      ids.push(id);
    }
  }
  return ids;
}

type Example = {
  sentenceId: number;
  unitId: number;
  headText: string;
  translationText: string;
};

@Injectable({providedIn: 'root'})
export class WordCardBackService {
  private readonly termsService = inject(TermsService);
  private readonly linksService = inject(TermLinksService);
  private readonly sentencesService = inject(SentencesService);

  // Cache sentenceId -> referenced term IDs
  private readonly sentenceTermIds = computed(() => {
    const map = new Map<number, { fr: number[]; de: number[] }>();
    for (const sentence of this.sentencesService.sentences()) {
      map.set(sentence.id, {
        fr: extractTermIdsFromMarkup(sentence.fr),
        de: extractTermIdsFromMarkup(sentence.de),
      });
    }
    return map;
  });

  buildForHeadTerm(headTermId: number | null | undefined, headLang: Lang): WordCardBackVm | undefined {
    if (headTermId == null) {
      return undefined;
    }

    const headTerm = this.termsService.getById(headTermId);
    if (!headTerm) {
      return undefined;
    }
    if (headTerm.lang !== headLang) {
      // Safety: wir erwarten konsistente Übergabe
      return undefined;
    }

    const translationLang: Lang = headLang === 'fr' ? 'de' : 'fr';

    // priority-sortiert kommt schon aus TermLinksService
    const translationIds = this.linksService.getLinkedIds(headLang, headTermId);

    const translationTerms: TermRow[] = translationIds
      .map((id) => this.termsService.getById(id))
      .filter((t): t is TermRow => !!t)
      .filter((t) => t.lang === translationLang);

    const candidates = this.findSentencesContaining(headLang, headTermId);

    const translations = translationTerms.map((term) => {
      const example =
        this.pickExampleMatchingTranslation(candidates, translationLang, term.id) ??
        this.pickBestFallbackExample(candidates, headLang, translationLang);

      return { term, example };
    });

    return {
      headTerm,
      headLang,
      translationLang,
      translations,
    };
  }

  private findSentencesContaining(lang: Lang, termId: number): SentenceRow[] {
    const idsMap = this.sentenceTermIds();
    const all = this.sentencesService.sentences();

    const key = lang === 'fr' ? 'fr' : 'de';
    const result: SentenceRow[] = [];

    for (const sentence of all) {
      const ids = idsMap.get(sentence.id);
      if (!ids) {
        continue;
      }
      if (ids[key].includes(termId)) {
        result.push(sentence);
      }
    }
    return result;
  }

  private pickExampleMatchingTranslation(
    candidates: SentenceRow[],
    translationLang: Lang,
    translationTermId: number
  ): Example | undefined {
    if (candidates.length === 0) {
      return undefined;
    }

    const idsMap = this.sentenceTermIds();
    const key = translationLang === 'fr' ? 'fr' : 'de';

    for (const sentence of candidates) {
      const ids = idsMap.get(sentence.id);
      if (!ids) {
        continue;
      }
      if (ids[key].includes(translationTermId)) {
        return this.toExample(sentence, translationLang);
      }
    }

    return undefined;
  }

  private pickBestFallbackExample(candidates: SentenceRow[], headLang: Lang, translationLang: Lang): Example | undefined {
    if (candidates.length === 0) {
      return undefined;
    }

    // kurze Sätze bevorzugen
    const sorted = [...candidates].sort((a, b) => {
      const aLen = (a.fr?.length ?? 0) + (a.de?.length ?? 0);
      const bLen = (b.fr?.length ?? 0) + (b.de?.length ?? 0);
      return aLen - bLen;
    });

    return this.toExample(sorted[0], translationLang);
  }

  private toExample(sentence: SentenceRow, translationLang: Lang): Example {
    const frText = representativeText(parseSentenceMarkup(sentence.fr ?? ''));
    const deText = representativeText(parseSentenceMarkup(sentence.de ?? ''));

    // headText ist immer die “Vorderseiten-Sprache”
    if (translationLang === 'de') {
      return { sentenceId: sentence.id, unitId: sentence.unitId, headText: frText, translationText: deText };
    }
    return { sentenceId: sentence.id, unitId: sentence.unitId, headText: deText, translationText: frText };
  }
}
