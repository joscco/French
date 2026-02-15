import {Component, computed, effect, inject, input, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {WordCardComponent} from '../../view-words/word-card/word-card.component';
import {PracticeHostShellComponent} from '../practice-host-shell/practice-host-shell.component';
import {SentenceCardComponent} from '../../view-sentences/sentence-card/sentence-card.component';
import {WordService} from '../../services/word.service';
import {PracticeRouteStateService} from '../../services/route-state.service';
import {PracticeKind} from '../../models/types';
import {LessonOption} from '../../models/lesson-option';
import {WordCard} from '../../models/word-card';
import {SentencesService} from '../../../../services/sentence.service';
import {UnitsService} from '../../../../services/units.service';
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
  private readonly unitsService = inject(UnitsService);
  private readonly routeState = inject(PracticeRouteStateService);

  practiceKind = input<PracticeKind>('sentence');
  selectedLesson = input<LessonOption | undefined>(undefined);
  mode = this.wordService.mode;

  index = signal<number>(0);
  private initialIndexApplied = signal(false);
  private shuffledIndices = signal<number[] | null>(null);

  private baseVocabList = computed<WordCard[]>(() => this.wordService.words() ?? []);

  private baseSentenceList = computed<SentenceVm[]>(() => {
    const selected = this.selectedLesson();
    const allSentenceRows = this.sentenceService.sentences();

    const allowedUnitIds = this.resolveAllowedUnitIds(selected);

    const filteredSentenceRows =
      allowedUnitIds === null
        ? allSentenceRows
        : allSentenceRows.filter((sentenceRow) => allowedUnitIds.includes(sentenceRow.unitId));

    return filteredSentenceRows.map((sentenceRow) => this.buildSentenceVm(sentenceRow));
  });

  vocabList = computed<WordCard[]>(() => this.applyShuffleOrder(this.baseVocabList()));

  sentenceList = computed<SentenceVm[]>(() => this.applyShuffleOrder(this.baseSentenceList()));

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
    // Initiales Setzen des Index aus der URL (einmalig, wenn Liste geladen)
    effect(() => {
      const listLength = this.currentListLength();
      const routeIndex = this.routeState.index();

      // Warte bis die Liste geladen ist
      if (listLength === 0) {
        return;
      }

      // Nur einmal beim initialen Laden anwenden
      if (!this.initialIndexApplied()) {
        this.initialIndexApplied.set(true);
        this.index.set(this.clamp(routeIndex, listLength));
      }
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
    const listLength = this.currentListLength();
    if (listLength === 0) {
      return;
    }

    const indices = Array.from({length: listLength}, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    this.shuffledIndices.set(indices);
    this.index.set(0);
    this.routeState.patch({i: 0});
  }

  unshuffle() {
    this.shuffledIndices.set(null);
    this.index.set(0);
    this.routeState.patch({i: 0});
  }

  isShuffled = computed(() => this.shuffledIndices() !== null);

  private applyShuffleOrder<T>(list: T[]): T[] {
    const indices = this.shuffledIndices();
    if (!indices || indices.length !== list.length) {
      return list;
    }
    return indices.map(i => list[i]);
  }

  private clamp(index: number, listLength: number) {
    if (!listLength) {
      return 0;
    }
    return Math.max(0, Math.min(listLength - 1, index));
  }

  private resolveAllowedUnitIds(selected: LessonOption | undefined): number[] | null {
    if (!selected || selected.type === 'all') {
      return null;
    }

    if (selected.type === 'unit' && selected.unitId != null) {
      return [selected.unitId];
    }

    if (selected.type === 'group' && selected.groupId != null) {
      return this.unitsService.units()
        .filter(unit => unit.group_id === selected.groupId)
        .map(unit => unit.id);
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
