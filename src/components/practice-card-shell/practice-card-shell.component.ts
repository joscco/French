import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import gsap from 'gsap';

type NavDir = 'next' | 'prev';

@Component({
  selector: 'app-practice-card-shell',
  standalone: true,
  imports: [CommonModule, MatIconModule, IconButtonComponent],
  templateUrl: './practice-card-shell.component.html',
})
export class PracticeCardShellComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) index = 0;
  @Input({ required: true }) length = 0;

  @Input() showShuffle = true;
  @Input() hint?: string;

  /** optional: wenn du Swipe nur auf den Card-Bereich willst */
  @Input() swipeOnCardOnly = true;

  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();
  @Output() shuffle = new EventEmitter<void>();

  /** optional: nach außen (falls du es irgendwo brauchst) */
  readonly direction = signal<NavDir>('next');

  @ViewChild('cardHost', { static: true }) cardHost!: ElementRef<HTMLElement>;

  readonly isTouchScreen =
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    // @ts-ignore
    (navigator.msMaxTouchPoints ?? 0) > 0;

  private animating = false;

  // touch tracking
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private touchActive = false;

  ngAfterViewInit(): void {
    const el = this.cardHost?.nativeElement;
    if (!el) return;

    // initial state
    gsap.set(el, { x: 0, opacity: 1 });

    // swipe listeners
    el.addEventListener('touchstart', this.onTouchStart, { passive: true });
    el.addEventListener('touchmove', this.onTouchMove, { passive: true });
    el.addEventListener('touchend', this.onTouchEnd);
  }

  ngOnDestroy(): void {
    const el = this.cardHost?.nativeElement;
    if (!el) return;

    gsap.killTweensOf(el);

    el.removeEventListener('touchstart', this.onTouchStart);
    el.removeEventListener('touchmove', this.onTouchMove);
    el.removeEventListener('touchend', this.onTouchEnd);
  }

  // -------------------------
  // keyboard navigation
  // -------------------------

  @HostListener('document:keydown', ['$event'])
  onDocKeydown(ev: KeyboardEvent) {
    if (this.length <= 1) return;

    const t = ev.target as HTMLElement | null;
    const inTypingField = !!t?.closest('textarea, input, [contenteditable="true"]');
    if (inTypingField) return;

    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      this.triggerPrev();
      return;
    }

    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      this.triggerNext();
      return;
    }
  }

  // -------------------------
  // public triggers (buttons / parent)
  // -------------------------

  triggerPrev() {
    if (this.length <= 1) return;
    this.direction.set('prev');
    this.animateSwapAndEmit('prev', () => this.prev.emit());
  }

  triggerNext() {
    if (this.length <= 1) return;
    this.direction.set('next');
    this.animateSwapAndEmit('next', () => this.next.emit());
  }

  triggerShuffle() {
    if (this.length <= 1) return;
    // shuffle fühlt sich wie “next” an (subjektiv nicer)
    this.direction.set('next');
    this.animateSwapAndEmit('next', () => this.shuffle.emit());
  }

  // -------------------------
  // animation
  // -------------------------

  private animateSwapAndEmit(dir: NavDir, emitFn: () => void) {
    const el = this.cardHost?.nativeElement;
    if (!el) {
      emitFn();
      return;
    }

    if (this.animating) return;
    this.animating = true;

    gsap.killTweensOf(el);

    const outX = dir === 'next' ? '-100%' : '100%';
    const inFromX = dir === 'next' ? '100%' : '-100%';

    gsap.to(el, {
      x: outX,
      opacity: 0,
      duration: 0.28,
      ease: 'power2.in',
      onComplete: () => {
        // 1) emit -> parent wechselt content/index
        emitFn();

        // 2) sofort auf Startposition fürs rein-sliden
        gsap.set(el, { x: inFromX });

        // 3) warten bis Angular DOM updated hat, dann rein animieren
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            gsap.to(el, {
              x: 0,
              opacity: 1,
              duration: 0.32,
              ease: 'power2.out',
              onComplete: () => {
                this.animating = false;
              },
            });
          });
        });
      },
    });
  }

  // -------------------------
  // swipe handling
  // -------------------------

  private onTouchStart = (e: TouchEvent) => {
    if (!this.isTouchScreen) return;
    if (this.length <= 1) return;
    if (e.touches.length !== 1) return;

    // optional: swipe only on card area (we only attached to cardHost anyway)
    if (this.swipeOnCardOnly) {
      // ok
    }

    this.touchActive = true;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    this.touchEndX = this.touchStartX;
    this.touchEndY = this.touchStartY;
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.touchActive || e.touches.length !== 1) return;
    this.touchEndX = e.touches[0].clientX;
    this.touchEndY = e.touches[0].clientY;
  };

  private onTouchEnd = () => {
    if (!this.touchActive) return;
    this.touchActive = false;

    const dx = this.touchEndX - this.touchStartX;
    const dy = this.touchEndY - this.touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const minDist = 40;

    // horizontal swipe only
    if (absDx > absDy && absDx > minDist) {
      if (dx < 0) this.triggerNext();
      else this.triggerPrev();
    }

    this.touchStartX = this.touchStartY = this.touchEndX = this.touchEndY = 0;
  };
}
