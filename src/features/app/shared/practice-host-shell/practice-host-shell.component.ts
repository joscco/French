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
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {IconButtonComponent} from '../icon-button/icon-button.component';
import gsap from 'gsap';
import {ScrubberComponent} from '../scrubber/scrubber.component';

type NavDir = 'next' | 'prev';
type Anim = 'slide' | 'fade' | 'none';

@Component({
  selector: 'app-practice-host-shell',
  standalone: true,
  imports: [CommonModule, MatIconModule, IconButtonComponent, ScrubberComponent],
  templateUrl: './practice-host-shell.component.html',
})
export class PracticeHostShellComponent implements AfterViewInit, OnDestroy {
  index = input<number>(0);
  length = input<number>(0);

  @Input() showScrubber = true;
  @Input() canSwipe = true;
  @Input() animation: Anim = 'slide';
  @Input() scrubLabelForIndex?: (idx: number) => string;

  @Output() shuffle = new EventEmitter<void>();
  @Output() unshuffle = new EventEmitter<void>();
  @Output() commitIndex = new EventEmitter<number>();

  readonly counterText = computed(() => `${this.index() + 1} / ${this.length()}`);

  readonly thumbTopPct = computed(() => {
    const len = this.length();
    if (len <= 1) {
      return 0;
    }
    return (this.index() / (len - 1)) * 100;
  });

  readonly hotspotTopPct = computed(() => {
    const len = this.length();
    if (len <= 1) {
      return 0;
    }
    const idx = this.scrubPreview().active ? this.scrubPreview().idx : this.index();
    return (idx / (len - 1)) * 100;
  });

  readonly hotspotMask = computed(() => {
    const topPct = this.hotspotTopPct();
    return `radial-gradient(circle 70px at 50% ${topPct}%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 72%)`;
  });

  @ViewChild('cardHost', {static: true}) cardHost!: ElementRef<HTMLElement>;
  @ViewChild('slideLayer', {static: true}) slideLayer!: ElementRef<HTMLElement>;
  @ViewChild(ScrubberComponent, {static: false}) scrubberComponent?: ScrubberComponent;

  private scrubbing = signal(false);
  readonly scrubPreview = signal<{ active: boolean; idx: number; label: string }>({
    active: false,
    idx: 0,
    label: '',
  });

  private touchActive = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchEndX = 0;
  private touchEndY = 0;
  private offsetWidth = 50; // für slide animation

  readonly isTouchScreen =
    'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;

  // ghost housekeeping
  private ghostEl?: HTMLElement;
  private tl?: gsap.core.Timeline;

  ngAfterViewInit(): void {
    const host = this.cardHost.nativeElement;

    host.addEventListener('touchstart', this.onTouchStart, {passive: true});
    host.addEventListener('touchmove', this.onTouchMove, {passive: true});
    host.addEventListener('touchend', this.onTouchEnd);

    gsap.set(this.slideLayer.nativeElement, {
      x: 0,
      opacity: 1,
      willChange: 'transform, opacity',
      transformOrigin: '50% 50%',
    });
  }

  ngOnDestroy(): void {
    const host = this.cardHost.nativeElement;
    host.removeEventListener('touchstart', this.onTouchStart);
    host.removeEventListener('touchmove', this.onTouchMove);
    host.removeEventListener('touchend', this.onTouchEnd);

    gsap.killTweensOf(this.slideLayer.nativeElement);
    this.cleanupGhost();
  }

  @HostListener('document:keydown', ['$event'])
  onDocKeydown(ev: KeyboardEvent) {
    if (this.length() <= 1) {
      return;
    }

    const target = ev.target as HTMLElement | null;
    if (target?.closest('textarea, input, [contenteditable="true"]')) {
      return;
    }

    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      this.requestStep(-1);
    }
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      this.requestStep(+1);
    }
  }

  triggerPrev() {
    this.requestStep(-1);
  }

  triggerNext() {
    this.requestStep(+1);
  }

  triggerShuffle() {
    if (this.length() <= 1) {
      return;
    }

    this.animateSequential('next', () => this.shuffle.emit());
  }

  triggerUnshuffle() {
    if (this.length() <= 1) {
      return;
    }

    this.animateSequential('prev', () => this.unshuffle.emit());
  }

  private requestStep(d: -1 | 1) {
    if (this.length() <= 1) {
      return;
    }

    const from = this.index();
    const to = this.clamp(from + d);
    if (to === from) {
      return;
    }

    const dir: NavDir = d === 1 ? 'next' : 'prev';

    this.commitIndex.emit(to);

    this.animateSequential(dir, () => {
      this.commitIndex.emit(to);
    });
  }

  private animateSequential(dir: NavDir, swapFn: () => void) {
    if (this.animation === 'none') {
      swapFn();
      return;
    }

    const host = this.cardHost.nativeElement;
    const layer = this.slideLayer.nativeElement;

    this.tl?.kill();
    this.tl = undefined;

    gsap.killTweensOf(layer);
    gsap.set(layer, { x: 0, opacity: 1 }); // wichtig beim schnellen Spammen

    this.cleanupGhost();

    const ghost = layer.cloneNode(true) as HTMLElement;
    ghost.style.position = 'absolute';
    ghost.style.inset = '0';
    ghost.style.pointerEvents = 'none';
    ghost.style.zIndex = '20';
    ghost.style.willChange = 'transform, opacity';
    ghost.querySelector('[data-scrubber]')?.remove();

    host.appendChild(ghost);
    this.ghostEl = ghost;

    swapFn();

    const inFromX =
      this.animation === 'slide'
        ? (dir === 'next' ? this.offsetWidth : -this.offsetWidth)
        : 0;

    gsap.set(layer, { opacity: 0, x: inFromX });

    const outX =
      this.animation === 'slide'
        ? (dir === 'next' ? -this.offsetWidth : this.offsetWidth)
        : 0;

    this.tl = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        this.cleanupGhost();
        this.tl = undefined;
      },
    });

    this.tl.to(ghost, {
      x: outX,
      opacity: 0,
      duration: 0.22,
      ease: 'power2.in',
    });

    this.tl.to(layer, {
      x: 0,
      opacity: 1,
      duration: 0.28,
      ease: 'power2.out',
    }, '>-0.01');
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

  onScrubDown(ev: PointerEvent) {
    if (!this.showScrubber || this.length() <= 1) return;
    ev.preventDefault();
    this.scrubbing.set(true);
    this.updateScrub(ev, true);

    // wichtig: capture auf dem scrubber selbst, nicht auf ev.target (kann child sein)
    this.scrubberComponent?.scrubberEl?.nativeElement.setPointerCapture?.(ev.pointerId);
  }

  onScrubMove(ev: PointerEvent) {
    if (!this.scrubbing()) {
      return;
    }
    ev.preventDefault();
    this.updateScrub(ev, true);
  }

  onScrubUp() {
    if (!this.scrubbing()) {
      return;
    }
    this.scrubbing.set(false);

    const preview = this.scrubPreview();
    this.scrubPreview.set({ ...preview, active: false });

    const fromIndex = this.index();
    const toIndex = this.clamp(preview.idx);
    if (toIndex === fromIndex) {
      return;
    }

    const direction: NavDir = toIndex > fromIndex ? 'next' : 'prev';

    this.animateSequential(direction, () => this.commitIndex.emit(toIndex));
  }

  private updateScrub(ev: PointerEvent, active: boolean) {
    const element = this.scrubberComponent?.scrubberEl?.nativeElement;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const yPosition = ev.clientY - rect.top;
    const ratio = Math.max(0, Math.min(1, yPosition / rect.height));
    const index = this.clamp(Math.floor(ratio * (this.length() - 1)));
    const label = this.scrubLabelForIndex?.(index) ?? `${index + 1}`;

    if (this.scrubPreview().idx === index && this.scrubPreview().active === active) {
      return;
    }

    this.scrubPreview.set({active, idx: index, label});
    this.commitIndex.emit(index);
  }
}
