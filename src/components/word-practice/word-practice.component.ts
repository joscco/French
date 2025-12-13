import {
  Component,
  computed,
  Input,
  OnChanges,
  OnInit,
  signal,
  SimpleChanges,
  TemplateRef,
  ViewChild
} from '@angular/core';
import {CommonModule} from '@angular/common';

import {PracticeCard} from '../../models/practice-card';
import {PracticeMode} from '../../models/types';

import {PracticeCardShellComponent} from '../practice-card-shell/practice-card-shell.component';
import {FlashcardCardComponent} from '../flashcard/flashcard-card.component';

@Component({
  selector: 'app-word-practice',
  standalone: true,
  imports: [
    CommonModule,
    PracticeCardShellComponent,
    FlashcardCardComponent,
  ],
  templateUrl: './word-practice.component.html',
})
export class WordPracticeComponent implements OnInit, OnChanges {
  @Input() cards: PracticeCard[] = [];
  @Input() mode: PracticeMode = 'fr-de';

  @ViewChild('cardTpl', { static: true }) cardTpl!: TemplateRef<any>;
  @ViewChild(PracticeCardShellComponent) shell?: PracticeCardShellComponent;

  index = signal(0);
  oriented = signal<PracticeCard[]>([]);

  current = computed(() => {
    const a = this.oriented();
    const i = this.index();
    return a[Math.min(Math.max(0, i), Math.max(0, a.length - 1))];
  });

  isTouchScreen =
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    // @ts-ignore
    (navigator.msMaxTouchPoints ?? 0) > 0;

  ngOnInit() {
    this.index.set(0);
    this.prepareAndOrientCards();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cards'] || changes['mode']) {
      this.prepareAndOrientCards();
    }
  }

  prepareAndOrientCards() {
    const arr = [...this.cards];
    const oriented = arr.map(c => this.orientCard(c, this.mode));
    this.oriented.set(oriented);
    this.index.set(0);
  }

  prev() {
    this.navigate(-1);
  }

  next() {
    this.navigate(1);
  }

  private navigate(delta: 1 | -1) {
    this.index.update(i => {
      const len = this.oriented().length;
      if (len === 0) return 0;
      let next = (i + delta) % len;
      if (next < 0) next += len;
      return next;
    });
  }

  shuffleCards() {
    const arr = [...this.oriented()];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.oriented.set(arr);
    this.index.set(0);
  }

  private orientCard(card: PracticeCard, mode: PracticeMode): PracticeCard {
    if (mode === 'fr-de') return { ...card, frontLanguage: 'french' };
    if (mode === 'de-fr') return { ...card, frontLanguage: 'german' };
    return { ...card, frontLanguage: Math.random() < 0.5 ? 'french' : 'german' };
  }
}
