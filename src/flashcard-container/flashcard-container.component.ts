import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  signal,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {FlashcardCardComponent} from './flashcard/flashcard-card.component';
import gsap from 'gsap';
import {Language} from '../practice/practice.component';

@Component({
  selector: 'app-flashcard-container',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule, FlashcardCardComponent],
  templateUrl: './flashcard-container.component.html',
})
export class FlashcardContainerComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() meta: Record<string, any> = {};
  @Input() frenchPrimary = '';
  @Input() frenchExampleSentence = '';
  @Input() germanPrimary = '';
  @Input() germanExampleSentence = '';
  @Input() frontLang: Language = 'french';
  @Input() direction: 'next' | 'prev' = 'next';
  @Input() isTouchScreen = false;

  @ViewChild('cardRef', {static: true}) cardRef!: ElementRef<HTMLDivElement>;

  @Output() next = new EventEmitter<void>();
  @Output() prev = new EventEmitter<void>();

  flipped = signal<{ direction: 'up' | 'down', value: boolean }>({value: false, direction: 'up'});
  hovered = signal(false);

  // Touch-Tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private touchActive = false;

  // Interne Daten für die angezeigte Karte
  private currentMeta: Record<string, any> = {};
  private currentFrenchPrimary = '';
  private currentFrenchExampleSentence = '';
  private currentGermanPrimary = '';
  private currentGermanExampleSentence = '';
  private currentFrontLang: Language = 'french';

  // Getter für Template
  getMeta() {
    return this.currentMeta;
  }

  getFrenchPrimary() {
    return this.currentFrenchPrimary;
  }

  getFrenchExampleSentence() {
    return this.currentFrenchExampleSentence;
  }

  getGermanPrimary() {
    return this.currentGermanPrimary;
  }

  getGermanExampleSentence() {
    return this.currentGermanExampleSentence;
  }

  getFrontLang() {
    return this.currentFrontLang;
  }

  isFlipped(): boolean {
    return this.flipped().value;
  }

  isHovered(): boolean {
    return this.hovered();
  }

  ngOnInit() {
    this.setCurrentCardData();
  }

  ngAfterViewInit() {
    if (this.cardRef) {
      gsap.set(this.cardRef.nativeElement, {x: 0, opacity: 1});
      this.initTouchEvents();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    const watched = ['frenchPrimary', 'germanPrimary'];
    const relevant = watched.some(k => k in changes && !changes[k]!.firstChange);
    if (relevant) {
      this.animateCardSwap();
    } else {
      this.setCurrentCardData();
    }
  }

  ngOnDestroy() {
    if (this.cardRef) {
      gsap.killTweensOf(this.cardRef.nativeElement);
      this.removeTouchEvents();
    }
  }

  private initTouchEvents() {
    // Touch-Events registrieren
    const el = this.cardRef.nativeElement;
    el.addEventListener('touchstart', this.onTouchStart, {passive: true});
    el.addEventListener('touchmove', this.onTouchMove, {passive: true});
    el.addEventListener('touchend', this.onTouchEnd);
  }

  private removeTouchEvents() {
    // Touch-Events entfernen
    const el = this.cardRef.nativeElement;
    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove', this.onTouchMove);
    el.removeEventListener('touchend', this.onTouchEnd);
  }

  private setCurrentCardData() {
    this.currentMeta = {...this.meta};
    this.currentFrenchPrimary = this.frenchPrimary;
    this.currentFrenchExampleSentence = this.frenchExampleSentence;
    this.currentGermanPrimary = this.germanPrimary;
    this.currentGermanExampleSentence = this.germanExampleSentence;
    this.currentFrontLang = this.frontLang;
    this.resetFlip();
  }

  private animateCardSwap() {
    const el = this.cardRef?.nativeElement;
    if (!el) {
      this.setCurrentCardData();
      return;
    }

    // Bestehende Tweens stoppen
    gsap.killTweensOf(el);

    const outX = this.direction === 'next' ? '-100%' : '100%';
    const inFromX = this.direction === 'next' ? '100%' : '-100%';

    // Raus-Animation
    gsap.to(el, {
      x: outX,
      opacity: 0,
      duration: 0.28,
      ease: 'power2.in',
      onComplete: () => {
        // Sofort an die Startposition der Rein-Animation setzen
        gsap.set(el, {x: inFromX});
        // Daten wechseln
        this.setCurrentCardData();
        // Rein-Animation
        gsap.to(el, {x: 0, opacity: 1, duration: 0.32, ease: 'power2.out'});
      }
    });
  }

  toggle(direction: 'up' | 'down') {
    this.flipped.update(v => ({value: !v.value, direction: direction}));
  }

  toggleOnClick() {
    if (this.isTouchScreen) return; // kein Klick auf Touchscreens
    this.toggle('up');
  }

  hoverOn() {
    this.hovered.set(true);
  }

  hoverOff() {
    this.hovered.set(false);
  }

  resetFlip() {
    this.flipped.set({value: false, direction: 'up'});
  }
  // Touch-Handler als Arrow-Functions, damit this korrekt ist

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    this.touchActive = true;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    // Initiale End-Position auch auf Start-Position setzen, falls kein Move erfolgt
    this.touchEndX = this.touchStartX;
    this.touchEndY = this.touchStartY;
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.touchActive || e.touches.length !== 1) return;
    this.touchEndX = e.touches[0].clientX;
    this.touchEndY = e.touches[0].clientY;
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (!this.touchActive) return;
    this.touchActive = false;
    const dx = this.touchEndX - this.touchStartX;
    const dy = this.touchEndY - this.touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    console.log('dx', dx, absDx, absDy);
    const minDist = 40; // Mindestdistanz für Swipe
    if (absDx > absDy && absDx > minDist) {
      // Horizontaler Swipe
      if (dx < 0) {
        this.next.emit(); // Swipe links
      } else {
        this.prev.emit(); // Swipe rechts
      }
    } else if (absDy > absDx && absDy > minDist) {
      // Vertikaler Swipe
      if (dy < 0) {
        this.toggle('up'); // Swipe hoch
      } else {
        this.toggle('down'); // Swipe runter
      }
    }
    // Reset
    this.touchStartX = this.touchStartY = this.touchEndX = this.touchEndY = 0;
  };
}
