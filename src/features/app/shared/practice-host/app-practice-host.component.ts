import {Component, computed, effect, inject, input, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {WordCardComponent} from '../../view-words/word-cart/word-card.component';
import {PracticeHostShellComponent} from '../practice-host-shell/practice-host-shell.component';
import {SentenceCardComponent} from '../../view-sentences/sentence-card/sentence-card.component';
import {WordService} from '../../services/word.service';
import {PracticeRouteStateService} from '../../services/route-state.service';
import {PracticeKind} from '../../models/types';
import {LessonOption} from '../../models/lesson-option';
import {WordCard} from '../../models/word-card';
import {SentencesService} from '../../../../services/sentence.service';
import {SentenceRow} from '../../../../shared/contract/contract';
import {extractTermRefs} from '../../helpers/extract-term-refs';
import {SentenceVm} from '../../models/sentence-vm';
import {parseSentenceMarkup, representativeText} from '../../../editor/helpers/sentence-markup';

@Component({
  selector: 'app-practice-host',
  standalone: true,
  imports: [CommonModule, PracticeHostShellComponent, WordCardComponent, SentenceCardComponent, PracticeHostShellComponent],
  templateUrl: 'app-practice-host.component.html',
})
export class PracticeHostComponent {
  private readonly wordService = inject(WordService);
  private readonly sentenceService = inject(SentencesService);
  private readonly routeState = inject(PracticeRouteStateService);

  practiceKind = input<PracticeKind>('sentence');
  mode = this.wordService.mode;
  selectedLesson = signal<LessonOption | undefined>(undefined);

  index = signal<number>(0);

  vocabList = computed<WordCard[]>(() => this.wordService.words() ?? []);

  sentenceList = computed<SentenceVm[]>(() => {
    const selectedLesson = this.selectedLesson();
    const allSentenceRows = this.sentenceService.sentences(); // SentenceRow[]

    const selectedUnitId = this.resolveSelectedUnitId(selectedLesson);

    const filteredSentenceRows =
      selectedUnitId === null
        ? allSentenceRows
        : allSentenceRows.filter((sentenceRow) => {
          return sentenceRow.unitId === selectedUnitId;
        });

    return filteredSentenceRows.map((sentenceRow) => this.buildSentenceVm(sentenceRow));
  });

  currentListLength = computed(() => {
    if (this.practiceKind() === 'vocab') {
      return this.vocabList().length;
    }
    return this.sentenceList().length;
  });

  currentVocab = computed(() => {
    const vocabCards = this.vocabList();
    const clampedIndex = this.clamp(this.index(), vocabCards.length);
    return vocabCards[clampedIndex];
  });

  currentSentence = computed(() => {
    const sentences = this.sentenceList();
    const clampedIndex = this.clamp(this.index(), sentences.length);
    return sentences[clampedIndex];
  });

  scrubLabelForIndex = (index: number) => {
    if (this.practiceKind() === 'vocab') {
      const wordCard = this.vocabList()[index];
      const primaryString = (this.mode() === 'fr-de' ? wordCard?.frenchPrimary : wordCard?.germanPrimary) ?? '';
      return (primaryString.trim()[0] ?? `${index + 1}`);
    }
    return `${index + 1}`;
  };

  constructor() {
    effect(() => {
      const routeIndex = this.routeState.index();
      const listLength = this.currentListLength();

      if (!listLength) {
        this.index.set(0);
        return;
      }

      this.index.set(this.clamp(routeIndex, listLength));
    });
  }

  onCommitIndex(index: number) {
    const nextIndex = this.clamp(index, this.currentListLength());
    this.index.set(nextIndex);
    this.routeState.patch({i: nextIndex});
  }

  onNextRequested() {
    const listLength = this.currentListLength();
    if (!listLength) {
      return;
    }

    const nextIndex = (this.index() + 1) % listLength;
    this.onCommitIndex(nextIndex);
  }

  shuffle() {

  }

  private clamp(index: number, listLength: number) {
    if (!listLength) {
      return 0;
    }
    return Math.max(0, Math.min(listLength - 1, index));
  }

  private resolveSelectedUnitId(selectedLesson: LessonOption | undefined): number | null {
    if (!selectedLesson || selectedLesson.id === 'all') {
      return null;
    }

    // Dein Editor/SentenceRow arbeitet mit unitId.
    // Wenn LessonOption.lesson die unitId ist, passt das direkt:
    if (typeof selectedLesson.lesson === 'number') {
      return selectedLesson.lesson;
    }

    // Fallback: falls id numerisch ist
    const parsedFromId = Number(selectedLesson.id);
    if (Number.isFinite(parsedFromId)) {
      return parsedFromId;
    }

    return null;
  }

  private buildSentenceVm(sentenceRow: SentenceRow): SentenceVm {
    const frenchRaw = sentenceRow.fr ?? '';
    const germanRaw = sentenceRow.de ?? '';

    const frenchPlain = representativeText(parseSentenceMarkup(frenchRaw));
    const germanPlain = representativeText(parseSentenceMarkup(germanRaw));

    return {
      id: sentenceRow.id,
      unitId: sentenceRow.unitId,

      frRaw: frenchRaw,
      deRaw: germanRaw,

      fr: frenchPlain,
      de: germanPlain,

      refs: [
        ...extractTermRefs(frenchRaw, 'fr'),
        ...extractTermRefs(germanRaw, 'de'),
      ],
    };
  }
}
