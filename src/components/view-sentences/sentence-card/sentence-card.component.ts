import {
  Component,
  computed,
  effect,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  input,
  Output,
  signal,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import gsap from 'gsap';

import {Sentence} from '../../../models/sentence';
import {PracticeMode} from '../../../models/types';
import {normalizeForCheck} from '../../../helpers/normalize';
import {buildWordOverlayTokens, collapseOverlayRuns, DisplayToken,} from '../../../helpers/answer-diff';

import {TermLookupService, TermTooltipVm} from '../../../services/term-lookup.service';
import {TermRefInSentence} from '../../../models/term-ref-in-sentence';
import {buildPromptSegments, PromptSegment} from '../../../helpers/prompt-markup';

import {TermTooltipOverlayComponent} from '../term-tooltip-overlay/term-tooltip-overlay.component';
import {PromptMarkupComponent} from '../prompt-markup/prompt-markup.component';
import {IconButtonComponent} from '../../shared/icon-button/icon-button.component';
import {PracticeRouteStateService} from '../../../services/route-state.service';

@Component({
  selector: 'app-sentence-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PromptMarkupComponent,
    TermTooltipOverlayComponent,
    IconButtonComponent,
  ],
  templateUrl: './sentence-card.component.html',
})
export class SentenceCardComponent {
  sentence = input<Sentence | null>(null);
  mode = input<PracticeMode>('de-fr');

  @Output() nextRequested = new EventEmitter<void>();

  private readonly termLookup = inject(TermLookupService);
  private routeStateService = inject(PracticeRouteStateService);

  readonly answer = signal('');
  readonly isChecked = signal(false);
  readonly isCorrect = signal(false);

  readonly displayTokens = signal<DisplayToken[]>([]);
  readonly promptSegments = signal<PromptSegment[]>([]);

  readonly promptText = computed(() => {
    const cur = this.sentence();
    if (!cur) return '';
    return this.mode() === 'de-fr' ? cur.de : cur.fr;
  });

  readonly expectedText = computed(() => {
    const cur = this.sentence();
    if (!cur) return '';
    return this.mode() === 'de-fr' ? cur.fr : cur.de;
  });

  readonly promptRefs = computed<TermRefInSentence[]>(() => {
    const cur = this.sentence();
    const refs = cur?.refs ?? [];
    const lang: TermRefInSentence['lang'] = this.mode() === 'de-fr' ? 'german' : 'french';
    return refs.filter(r => r.lang === lang);
  });

  @ViewChild('overlayLayer') overlayLayer?: ElementRef<HTMLElement>;
  @ViewChild('editLayer') editLayer?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('footerCheck') footerCheck?: ElementRef<HTMLElement>;
  @ViewChild('footerBar') footerBar?: ElementRef<HTMLElement>;
  @ViewChild('swapHost') swapHost?: ElementRef<HTMLElement>;

  readonly tooltipPinned = signal(false);
  readonly tooltipOpen = signal(false);
  readonly tooltipBasisX = signal<'left' | 'center' | 'right'>('center');
  readonly tooltipPanelW = signal<number>(260);
  readonly tooltipVm = signal<TermTooltipVm | undefined>(undefined);
  readonly tooltipX = signal(0);
  readonly tooltipY = signal(0);
  readonly tooltipAnchorRef = signal<TermRefInSentence | undefined>(undefined);

  private lastAnchorEl: HTMLElement | null = null;
  private closeTimer: number | null = null;

  readonly isPlaying = signal(false);
  private audio?: HTMLAudioElement;
  private autoPlayedForCheck = signal(false);

  constructor() {
    effect(() => {
      this.promptSegments.set(buildPromptSegments(this.promptText(), this.promptRefs()));
    });

    // Check answer and build display tokens
    effect(() => {
      if (!this.isChecked()) return;

      const expectedRaw = this.expectedText().trim();
      const answerRaw = (this.answer() ?? '').trim();

      const rawTokens = buildWordOverlayTokens(expectedRaw, answerRaw);
      this.displayTokens.set(collapseOverlayRuns(rawTokens));

      const expectedNorm = normalizeForCheck(expectedRaw);
      const answerNorm = normalizeForCheck(answerRaw);

      this.isCorrect.set(expectedNorm === answerNorm);
    });

    // reset when input sentences change
    effect(() => {
      this.sentence(); this.mode();
      this.resetForNext();
    });

    effect(() => {
      const shouldAutoPlay = this.isChecked() && this.isCorrect() && this.mode() === 'de-fr';

      if (!shouldAutoPlay) {
        this.autoPlayedForCheck.set(false); // reset wenn nicht mehr in dem Zustand
        return;
      }

      if (this.autoPlayedForCheck()) return;

      this.autoPlayedForCheck.set(true);
      this.playAudio(); // nicht toggle!
    });
  }

  get answerModel(): string {
    return this.answer();
  }

  set answerModel(v: string) {
    this.answer.set(v);
  }

  checkAnimated() {
    if (!this.sentence()) return;

    // state first (tokens are computed by effect)
    this.isChecked.set(true);

    // next frame: animate layers + footer
    requestAnimationFrame(() => {
      const overlay = this.overlayLayer?.nativeElement;
      const edit = this.editLayer?.nativeElement;
      const check = this.footerCheck?.nativeElement;
      const bar = this.footerBar?.nativeElement;
      if (!overlay || !edit || !check || !bar) return;

      gsap.killTweensOf([overlay, edit, check, bar]);

      gsap.set(overlay, {opacity: 0});
      gsap.set(bar, {opacity: 0});
      gsap.set(check, {opacity: 1});

      gsap.timeline()
        .to(edit, {opacity: 0, duration: 0.2, ease: 'power2.out'}, 0)
        .to(overlay, {opacity: 1, duration: 0.2, ease: 'power2.out'}, 0)
        .to(check, {opacity: 0, duration: 0.2, ease: 'power2.out'}, 0)
        .to(bar, {opacity: 1, duration: 0.2, ease: 'power2.out'}, 0);
    });
  }

  editAgainAnimated() {
    const overlay = this.overlayLayer?.nativeElement;
    const edit = this.editLayer?.nativeElement;
    const check = this.footerCheck?.nativeElement;
    const bar = this.footerBar?.nativeElement;

    // fallback if view refs not ready
    if (!overlay || !edit || !check || !bar) {
      this.editAgain();
      return;
    }

    gsap.killTweensOf([overlay, edit, check, bar]);

    gsap.timeline({
      onComplete: () => {
        this.editAgain();
        requestAnimationFrame(() => gsap.set(edit, {opacity: 1}));
      },
    })
      .to(overlay, {opacity: 0, duration: 0.2, ease: 'power2.in'}, 0)
      .to(bar, {opacity: 0, duration: 0.2, ease: 'power2.in'}, 0)
      .to(check, {opacity: 1, duration: 0.18, ease: 'power2.in'}, 0)
      .to(edit, {opacity: 1, duration: 0.2, ease: 'power2.out'}, 0);
  }

  private editAgain() {
    this.isChecked.set(false);
    this.isCorrect.set(false);
    this.displayTokens.set([]);
  }

  private resetForNext() {
    this.stopAudio();
    this.closeTooltip(true);

    this.answer.set('');
    this.isChecked.set(false);
    this.isCorrect.set(false);
    this.displayTokens.set([]);

    requestAnimationFrame(() => {
      const overlay = this.overlayLayer?.nativeElement;
      const edit = this.editLayer?.nativeElement;
      const check = this.footerCheck?.nativeElement;
      const bar = this.footerBar?.nativeElement;
      if (!overlay || !edit || !check || !bar) return;

      gsap.killTweensOf([overlay, edit, check, bar]);
      gsap.set(overlay, {opacity: 0, y: 0});
      gsap.set(edit, {opacity: 1});
      gsap.set(check, {opacity: 1, y: 0});
      gsap.set(bar, {opacity: 0, y: 0});
    });
  }

  @HostListener('document:keydown', ['$event'])
  onDocKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      this.closeTooltip(true);
      return;
    }

    if (ev.key == 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      if (!this.isChecked()) {
        return this.checkAnimated();
      }

      if (this.isCorrect()) {
        this.nextRequested.emit();
      } else {
        this.editAgainAnimated();
      }
    }
  }

  private sentenceAudioSrc(): string | undefined {
    const id = this.sentence()?.id;
    if (id === undefined || id === null) return undefined;
    return new URL(`sounds/fr${id}.mp3`, document.baseURI).toString();
  }

  private playAudio() {
    const src = this.sentenceAudioSrc();
    if (!src) return;

    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'none';
      this.audio.onended = () => this.stopAudio();
      this.audio.onerror = () => this.stopAudio();
    }

    try {
      this.audio.src = src;
      this.audio.load();
      this.isPlaying.set(true);

      const p = this.audio.play();
      if (p && typeof (p as any).then === 'function') {
        (p as Promise<void>).catch(() => this.stopAudio());
      }
    } catch {
      this.stopAudio();
    }
  }

  togglePlay(ev?: Event) {
    ev?.stopPropagation();
    const src = this.sentenceAudioSrc();
    if (!src) return;

    if (this.isPlaying()) {
      return this.stopAudio();
    } else {
      this.playAudio();
    }
  }

  private stopAudio() {
    try {
      if (this.audio) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
    } finally {
      this.isPlaying.set(false);
    }
  }


  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(ev: PointerEvent) {
    if (!this.tooltipOpen()) return;
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    if (target.closest('[data-tooltip]')) return;
    if (target.closest('[data-term]')) return;
    this.closeTooltip(true);
  }
  readonly activeRefKey = computed(() => {
    const r = this.tooltipAnchorRef();
    return r ? `${r.lang}:${r.key}` : undefined;
  });

  // =========================================================
  // Animations: check / edit again
  // =========================================================
  onTooltipPanelRect(r: DOMRect) {
    const w = Math.max(0, Math.round(r.width));
    if (!w) return;

    // nur updaten, wenn sinnvoll anders (verhindert jitter)
    if (Math.abs(this.tooltipPanelW() - w) > 2) {
      this.tooltipPanelW.set(w);

      // Wenn Tooltip offen ist: Position nochmal clamped neu berechnen
      const anchor = this.lastAnchorEl;
      if (this.tooltipOpen() && anchor) {
        this.setTooltipPosition(anchor);
      }
    }
  }

  // =========================================================
  // Tooltip
  // =========================================================

  private cancelTooltipClose() {
    if (this.closeTimer !== null) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  private scheduleTooltipClose(delayMs = 80) {
    this.cancelTooltipClose();
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = null;
      if (!this.tooltipPinned()) this.closeTooltip();
    }, delayMs);
  }

  private setTooltipPosition(anchorEl: HTMLElement) {
    this.lastAnchorEl = anchorEl;

    const anchorWord = anchorEl.getBoundingClientRect();
    const hostArea = this.swapHost?.nativeElement?.getBoundingClientRect();
    if (!hostArea) return;

    const padding = 10;

    // X: center über Wort (lokal in swapHost)
    const centerX = anchorWord.left + anchorWord.width / 2 - hostArea.left;

    // clamp damit Tooltip nicht über Host hinausragt
    const tooltipW = this.tooltipPanelW();
    const half = tooltipW / 2;

    const minX = padding + half;
    const maxX = hostArea.width - padding - half;

    const clampedX = Math.min(Math.max(centerX, minX), maxX);

    this.tooltipX.set(clampedX);
    this.tooltipBasisX.set('center');

    // Y: über dem Wort (lokal)
    const yTop = anchorWord.top - hostArea.top;
    this.tooltipY.set(yTop);
  }

  private openTooltipForRef(ref: TermRefInSentence, anchorEl: HTMLElement) {
    this.cancelTooltipClose();
    this.setTooltipPosition(anchorEl);

    this.tooltipVm.set(this.termLookup.getTooltipVm(ref));
    this.tooltipAnchorRef.set(ref);
    this.tooltipOpen.set(true);
  }

  onPromptTermEnter(e: { ref: TermRefInSentence; el: HTMLElement }) {
    if (this.tooltipPinned()) return;
    this.openTooltipForRef(e.ref, e.el);
  }

  onPromptTermLeave() {
    if (this.tooltipPinned()) return;
    // Delay close to avoid flicker when moving A -> B
    this.scheduleTooltipClose(80);
  }

  onPromptTermClick(e: { ref: TermRefInSentence; el: HTMLElement }) {
    this.tooltipPinned.set(true);
    this.openTooltipForRef(e.ref, e.el);
  }

  closeTooltip(force = false) {
    this.cancelTooltipClose();
    this.tooltipPinned.set(false);

    if (force) {
      // immediate state reset (e.g. when changing sentence)
      this.tooltipOpen.set(false);
      this.tooltipVm.set(undefined);
      this.tooltipAnchorRef.set(undefined);
      return;
    }

    this.tooltipOpen.set(false);
    this.tooltipVm.set(undefined);
    this.tooltipAnchorRef.set(undefined);
  }

  // =========================================================
  // Global listeners
  // =========================================================



  // =========================================================
  // Audio
  // =========================================================


}
