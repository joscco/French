import {Component, Input, OnChanges, OnInit, signal, SimpleChanges, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatButtonModule} from '@angular/material/button';
import {FlashcardContainerComponent} from '../flashcard-container/flashcard-container.component';
import {MatIcon} from '@angular/material/icon';
import {IconButtonComponent} from '../icon-button/icon-button.component';
import {PracticeCard} from '../../models/practice-card';
import {PracticeMode} from '../../models/types';

@Component({
  selector: 'app-practice',
  standalone: true,
  imports: [CommonModule, MatButtonModule, FlashcardContainerComponent, FlashcardContainerComponent, MatIcon, IconButtonComponent],
  templateUrl: './practice.component.html'
})
export class PracticeComponent implements OnInit, OnChanges {
  @Input() cards: PracticeCard[] = [];
  @Input() mode: PracticeMode = 'fr-de';

  @ViewChild('fc') flashcard?: FlashcardContainerComponent;

  index = signal(0);
  oriented = signal<PracticeCard[]>([]);
  navDirection = signal<'next' | 'prev'>('next');

  isTouchScreen = false;

  constructor() {
    // Touchscreen-Erkennung
    this.isTouchScreen =
      (('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      // @ts-ignore
      (navigator.msMaxTouchPoints > 0));
  }

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
    this.flashcard?.resetFlip();
  }

  current(): PracticeCard {
    const a = this.oriented();
    const i = this.index();
    return a[Math.min(Math.max(0, i), Math.max(0, a.length - 1))] ?? {
      id: 'empty', frenchPrimary: '', germanPrimary: '', frontLanguage: 'fr', backLang: 'de'
    };
  }

  prev() {
    this.navDirection.set('prev');
    this.navigate(-1);
  }

  next() {
    this.navDirection.set('next');
    this.navigate(1);
  }

  private navigate(delta: 1 | -1) {
    this.index.update(i => {
      const len = this.oriented().length;
      if (len === 0) {
        return 0;
      }
      let next = (i + delta) % len;
      if (next < 0) {
        next += len;
      }
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
    this.flashcard?.resetFlip();
  }

  private orientCard(card: PracticeCard, mode: PracticeMode): PracticeCard {
    if (mode === 'fr-de') {
      return {...card, frontLanguage: 'french'};
    }
    if (mode === 'de-fr') {
      return {...card, frontLanguage: 'german'};
    }

    // mixed
    const frontLanguage = Math.random() < 0.5 ? 'french' : 'german';
    return {...card, frontLanguage: frontLanguage};
  }
}
