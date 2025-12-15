import {Component, computed, effect, inject, input, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PracticeRouteStateService} from '../../../services/route-state.service';
import {SentenceService} from '../../../services/sentence.service';
import {WordService} from '../../../services/word.service';
import {FlashcardCardComponent} from '../../view-words/flashcard/flashcard-card.component';
import {PracticeHostShellComponent} from '../practice-host-shell/practice-host-shell.component';
import {PracticeKind} from '../../../models/types';
import {LessonOption} from '../../../models/lesson-option';
import {WordCard} from '../../../models/word-card';
import {Sentence} from '../../../models/sentence';
import {SentenceCardComponent} from '../../view-sentences/sentence-card/sentence-card.component';

@Component({
  selector: 'app-practice-host',
  standalone: true,
  imports: [CommonModule, PracticeHostShellComponent, FlashcardCardComponent, SentenceCardComponent, PracticeHostShellComponent],
  templateUrl: 'app-practice-host.component.html',
})
export class PracticeHostComponent {
  private wordService = inject(WordService);
  private sentenceService = inject(SentenceService);
  private routeState = inject(PracticeRouteStateService);

  practiceKind = input<PracticeKind>('sentence');
  mode = this.wordService.mode;
  selectedLesson = signal<LessonOption | undefined>(undefined);

  index = signal<number>(0);
  vocabList = computed<WordCard[]>(() => this.wordService.words() ?? []);
  sentenceList = computed<Sentence[]>(() => {
    const selected = this.selectedLesson();
    const all = this.sentenceService.sentencesWithRefs();
    if (!selected || selected.id === 'all') return all;
    return all.filter(s => s.lesson === selected.lesson);
  });

  currentListLength = computed(() => this.practiceKind() === 'vocab'
    ? this.vocabList().length
    : this.sentenceList().length
  );

  currentVocab = computed(() => {
    const list = this.vocabList();
    const i = this.clamp(this.index(), list.length);
    return list[i];
  });

  currentSentence = computed(() => {
    const list = this.sentenceList();
    const i = this.clamp(this.index(), list.length);
    return list[i];
  });

  scrubLabelForIndex = (i: number) => {
    if (this.practiceKind() === 'vocab') {
      const c = this.vocabList()[i];
      const s = (this.mode() === 'fr-de' ? c?.frenchPrimary : c?.germanPrimary) ?? '';
      return (s.trim()[0] ?? `${i + 1}`);
    }
    return `${i + 1}`;
  };

  constructor() {
    // URL -> state (wenn Router fertig & Daten geladen sind)
    effect(() => {
      // mode/kind/lesson übernimmt weiter App, hier nur index:
      const i = this.routeState.index();
      const len = this.currentListLength();
      if (!len) {
        this.index.set(0);
        return;
      }
      this.index.set(this.clamp(i, len));
    });
  }

  onPreviewIndex(i: number) {
    this.index.set(this.clamp(i, this.currentListLength()));
  }

  onCommitIndex(i: number) {
    const next = this.clamp(i, this.currentListLength());
    this.index.set(next);
    this.routeState.patch({i: next});
  }

  onGoTo(i: number) {
    this.onCommitIndex(i);
  }

  shuffle() {
  }

  onNextRequested() {
    const len = this.currentListLength();
    if (!len) return;
    const next = (this.index() + 1) % len;
    this.onCommitIndex(next);
  }

  private clamp(i: number, len: number) {
    if (!len) return 0;
    return Math.max(0, Math.min(len - 1, i));
  }
}
