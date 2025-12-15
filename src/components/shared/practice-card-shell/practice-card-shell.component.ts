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
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import gsap from 'gsap';

type NavDir = 'next' | 'prev';
type Anim = 'slide' | 'fade' | 'none';

@Component({
  selector: 'app-practice-card-shell',
  standalone: true,
  imports: [CommonModule, MatIconModule, IconButtonComponent],
  templateUrl: './practice-card-shell.component.html',
})
export class PracticeCardShellComponent implements AfterViewInit, OnDestroy {
  index = input<number>(0);
  length = input<number>(0);

  @Input() showShuffle = true;
  @Input() showScrubber = true;
  @Input() canSwipe = true;
  @Input() animation: Anim = 'slide';
  @Input() scrubLabelForIndex?: (idx: number) => string;

  @Output() shuffle = new EventEmitter<void>();
  @Output() prev = new EventEmitter<void>();
  @Output() next = new EventEmitter<void>();

  /** Parent soll sofort index setzen (und ggf. URL patchen) */
  @Output() goTo = new EventEmitter<number>();

  /** live scrub: Parent soll sofort index setzen (ohne URL patch) */
  @Output() previewIndex = new EventEmitter<number>();

  /** scrub commit: Parent patcht URL (und setzt index) */
  @Output() commitIndex = new EventEmitter<number>();

  readonly counterText = computed(() => `${this.index() + 1} / ${this.length()}`);

  @ViewChild('cardHost', { static: true }) cardHost!: ElementRef<HTMLElement>;
  @ViewChild('slideLayer', { static: true }) slideLayer!: ElementRef<HTMLElement>;
  @ViewChild('scrubberEl', { static: false }) scrubberEl?: ElementRef<HTMLElement>;

  // scrub
  private scrubbing = signal(false);
  readonly scrubPreview = signal<{ active: boolean; idx: number; label: string }>({
    active: false,
    idx: 0,
    label: '',
  });

  // swipe
  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;

  readonly isTouchScreen =
    'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

  // ghost housekeeping
  private ghostEl?: HTMLElement;

  ngAfterViewInit(): void {
    const host = this.cardHost.nativeElement;
    host.addEventListener('touchstart', this.onTouchStart, { passive: true });
    host.addEventListener('touchmove', this.onTouchMove, { passive: true });
    host.addEventListener('touchend', this.onTouchEnd);

    gsap.set(this.slideLayer.nativeElement, { x: 0, opacity: 1 });
  }

  ngOnDestroy(): void {
    const host = this.cardHost.nativeElement;
    host.removeEventListener('touchstart', this.onTouchStart);
    host.removeEventListener('touchmove', this.onTouchMove);
    host.removeEventListener('touchend', this.onTouchEnd);

    gsap.killTweensOf(this.slideLayer.nativeElement);
    this.cleanupGhost();
  }

  // -------------------------
  // keyboard
  // -------------------------
  @HostListener('document:keydown', ['$event'])
  onDocKeydown(ev: KeyboardEvent) {
    if (this.length() <= 1) return;

    const t = ev.target as HTMLElement | null;
    if (t?.closest('textarea, input, [contenteditable="true"]')) return;

    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      this.requestStep(-1);
    }
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      this.requestStep(+1);
    }
  }

  // -------------------------
  // buttons
  // -------------------------
  triggerPrev() { this.requestStep(-1); }
  triggerNext() { this.requestStep(+1); }

  triggerShuffle() {
    if (this.length() <= 1) return;
    // “shuffle” ist semantisch wie "next" – looks fine
    this.animateInstantSwap('next', () => this.shuffle.emit());
  }

  // -------------------------
  // NAV: sofort state + animation nachziehen
  // -------------------------
  private requestStep(d: -1 | 1) {
    if (this.length() <= 1) return;

    const from = this.index();
    const to = this.clamp(from + d);
    if (to === from) return;

    const dir: NavDir = d === 1 ? 'next' : 'prev';

    // ✅ State sofort!
    this.goTo.emit(to);
    dir === 'next' ? this.next.emit() : this.prev.emit();

    // ✅ Animation zieht nach (Ghost OUT + new IN)
    this.animateAfterSwap(dir);
  }

  private animateAfterSwap(dir: NavDir) {
    if (this.animation === 'none') return;

    // kill & cleanup
    gsap.killTweensOf(this.slideLayer.nativeElement);
    this.cleanupGhost();

    const host = this.cardHost.nativeElement;
    const layer = this.slideLayer.nativeElement;
    const width = layer.offsetWidth || host.offsetWidth;

    // Ghost = Snapshot der “alten” Karte (inkl. Rahmen!)
    const ghost = layer.cloneNode(true) as HTMLElement;
    ghost.style.position = 'absolute';
    ghost.style.inset = '0';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '20';
    // scrubber aus ghost entfernen (sonst sieht man doppelt)
    ghost.querySelector('[data-scrubber]')?.remove();

    host.appendChild(ghost);
    this.ghostEl = ghost;

    if (this.animation === 'fade') {
      gsap.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.26, ease: 'power2.out' });
      gsap.to(ghost, {
        opacity: 0,
        duration: 0.20,
        ease: 'power2.in',
        onComplete: () => this.cleanupGhost(),
      });
      return;
    }

    // slide
    const outX = dir === 'next' ? -width : width;
    const inFromX = dir === 'next' ? width : -width;

    // Neues rein
    gsap.fromTo(
      layer,
      { x: inFromX, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.30, ease: 'power2.out' }
    );

    // Altes raus (ghost)
    gsap.to(ghost, {
      x: outX,
      opacity: 0,
      duration: 0.24,
      ease: 'power2.in',
      onComplete: () => this.cleanupGhost(),
    });
  }

  private animateInstantSwap(dir: NavDir, swapFn: () => void) {
    // für Shuffle/Commit: swap sofort + dann gleiche Animation
    swapFn();
    this.animateAfterSwap(dir);
  }

  private cleanupGhost() {
    if (this.ghostEl?.parentElement) this.ghostEl.parentElement.removeChild(this.ghostEl);
    this.ghostEl = undefined;
  }

  private clamp(i: number) {
    const len = this.length();
    if (!len) return 0;
    return Math.max(0, Math.min(len - 1, i));
  }

  // -------------------------
  // swipe
  // -------------------------
  private onTouchStart = (e: TouchEvent) => {
    if (!this.canSwipe || !this.isTouchScreen || this.length() <= 1) return;
    if (e.touches.length !== 1) return;

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

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) this.requestStep(+1);
      else this.requestStep(-1);
    }
  };

  // -------------------------
  // scrubber
  // -------------------------
  onScrubDown(ev: PointerEvent) {
    if (!this.showScrubber || this.length() <= 1) return;
    this.scrubbing.set(true);
    this.updateScrub(ev, true);
    (ev.target as HTMLElement)?.setPointerCapture?.(ev.pointerId);
  }

  onScrubMove(ev: PointerEvent) {
    if (!this.scrubbing()) return;
    this.updateScrub(ev, true);
  }

  onScrubUp() {
    if (!this.scrubbing()) return;
    this.scrubbing.set(false);

    const s = this.scrubPreview();
    this.scrubPreview.set({ ...s, active: false });

    const from = this.index();
    const to = this.clamp(s.idx);
    if (to === from) return;

    const dir: NavDir = to > from ? 'next' : 'prev';

    // ✅ commit sofort (Parent setzt index + patched URL)
    this.animateInstantSwap(dir, () => this.commitIndex.emit(to));
  }

  private updateScrub(ev: PointerEvent, active: boolean) {
    const el = this.scrubberEl?.nativeElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const y = ev.clientY - rect.top;
    const t = Math.max(0, Math.min(1, y / rect.height));
    const idx = this.clamp(Math.floor(t * (this.length() - 1)));
    const label = this.scrubLabelForIndex?.(idx) ?? `${idx + 1}`;

    this.scrubPreview.set({ active, idx, label });
    this.previewIndex.emit(idx); // LIVE, ohne Animation
  }
}
