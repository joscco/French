import {
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import gsap from 'gsap';

import { Sentence } from '../../../models/sentence';
import { PracticeMode } from '../../../models/types';
import { normalizeForCheck } from '../../../helpers/normalize';
import {
  buildWordOverlayTokens,
  collapseOverlayRuns,
  DisplayToken,
} from '../../../helpers/answer-diff';

import { TermLookupService, TermTooltipVm } from '../../../services/term-lookup.service';
import { TermRefInSentence } from '../../../models/term-ref-in-sentence';
import { buildPromptSegments, PromptSegment } from '../../../helpers/prompt-markup';

import { TermTooltipOverlayComponent } from '../term-tooltip-overlay/term-tooltip-overlay.component';
import { PromptMarkupComponent } from '../prompt-markup/prompt-markup.component';
import { PracticeCardShellComponent } from '../../shared/practice-card-shell/practice-card-shell.component';
import { IconButtonComponent } from '../../shared/icon-button/icon-button.component';

type NavDir = 'next' | 'prev';

@Component({
  selector: 'app-sentence-practice',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PromptMarkupComponent,
    TermTooltipOverlayComponent,
    PracticeCardShellComponent,
    IconButtonComponent,
  ],
  templateUrl: './sentence-practice.component.html',
})
export class SentencePracticeComponent {
  sentences = input<Sentence[]>([]);
  mode = input<PracticeMode>('de-fr');

  private readonly termLookup = inject(TermLookupService);

  readonly oriented = signal<Sentence[]>([]);
  readonly index = signal(0);
  readonly navDirection = signal<NavDir>('next');

  readonly answer = signal('');
  readonly isChecked = signal(false);
  readonly isCorrect = signal(false);

  readonly displayTokens = signal<DisplayToken[]>([]);
  readonly promptSegments = signal<PromptSegment[]>([]);

  readonly current = computed<Sentence | undefined>(() => {
    const list = this.oriented();
    const i = this.index();
    return list[i] ?? list[0];
  });

  readonly promptText = computed(() => {
    const cur = this.current();
    if (!cur) return '';
    return this.mode() === 'de-fr' ? cur.de : cur.fr;
  });

  readonly expectedText = computed(() => {
    const cur = this.current();
    if (!cur) return '';
    return this.mode() === 'de-fr' ? cur.fr : cur.de;
  });

  readonly promptRefs = computed<TermRefInSentence[]>(() => {
    const cur = this.current();
    const refs = cur?.refs ?? [];
    const lang: TermRefInSentence['lang'] = this.mode() === 'de-fr' ? 'german' : 'french';
    return refs.filter(r => r.lang === lang);
  });

  get answerModel(): string {
    return this.answer();
  }
  set answerModel(v: string) {
    this.answer.set(v);
  }

  // -----------------------
  // tooltip state
  // -----------------------
  readonly tooltipPinned = signal(false);
  readonly tooltipOpen = signal(false);
  readonly tooltipVm = signal<TermTooltipVm | undefined>(undefined);
  readonly tooltipX = signal(0);
  readonly tooltipY = signal(0);
  readonly tooltipAnchorRef = signal<TermRefInSentence | undefined>(undefined);

  readonly activeRefKey = computed(() => {
    const r = this.tooltipAnchorRef();
    return r ? `${r.lang}:${r.key}` : undefined;
  });

  private closeTimer: number | null = null;

  readonly isPlaying = signal(false);
  private audio?: HTMLAudioElement;
  private autoPlayedForCheck = signal(false);

  @ViewChild('overlayLayer') overlayLayer?: ElementRef<HTMLElement>;
  @ViewChild('editLayer') editLayer?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('footerCheck') footerCheck?: ElementRef<HTMLElement>;
  @ViewChild('footerBar') footerBar?: ElementRef<HTMLElement>;
  @ViewChild('swapHost') swapHost?: ElementRef<HTMLElement>;

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
      const list = this.sentences() ?? [];
      this.oriented.set([...list]);
      this.index.set(0);
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

  // =========================================================
  // Animations: check / edit again
  // =========================================================

  checkAnimated() {
    if (!this.current()) return;

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

      gsap.set(overlay, { opacity: 0 });
      gsap.set(bar, { opacity: 0 });
      gsap.set(check, { opacity: 1 });

      gsap.timeline()
        .to(edit,   { opacity: 0, duration: 0.2, ease: 'power2.out' }, 0)
        .to(overlay,{ opacity: 1, duration: 0.2, ease: 'power2.out' }, 0)
        .to(check,  { opacity: 0, duration: 0.2, ease: 'power2.out' }, 0)
        .to(bar,    { opacity: 1, duration: 0.2, ease: 'power2.out' }, 0);
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
        requestAnimationFrame(() => gsap.set(edit, { opacity: 1 }));
      },
    })
      .to(overlay, { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0)
      .to(bar,     { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0)
      .to(check,   { opacity: 1, duration: 0.18, ease: 'power2.in' }, 0)
      .to(edit,    { opacity: 1, duration: 0.2, ease: 'power2.out' }, 0);
  }

  // =========================================================
  // Check / edit / reset
  // =========================================================

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
      gsap.set(overlay, { opacity: 0, y: 0 });
      gsap.set(edit, { opacity: 1 });
      gsap.set(check, { opacity: 1, y: 0 });
      gsap.set(bar, { opacity: 0, y: 0 });
    });
  }

  // =========================================================
  // Navigation
  // =========================================================

  prev() {
    const list = this.oriented();
    if (!list.length) return;
    this.navDirection.set('prev');
    this.index.update(i => (i - 1 + list.length) % list.length);
    this.resetForNext();
  }

  next() {
    const list = this.oriented();
    if (!list.length) return;
    this.navDirection.set('next');
    this.index.update(i => (i + 1) % list.length);
    this.resetForNext();
  }

  shuffleSentences() {
    const arr = [...this.oriented()];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.navDirection.set('next');
    this.oriented.set(arr);
    this.index.set(0);
    this.resetForNext();
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
    const a = anchorEl.getBoundingClientRect();
    const hostEl = this.swapHost?.nativeElement;
    const host = hostEl?.getBoundingClientRect();

    if (!host) return;

    // lokal im swapHost-Koordinatensystem
    this.tooltipX.set(a.left + a.width / 2 - host.left);
    this.tooltipY.set(a.top - host.top);
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

  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(ev: PointerEvent) {
    if (!this.tooltipOpen()) return;
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    if (target.closest('[data-tooltip]')) return;
    if (target.closest('[data-term]')) return;
    this.closeTooltip(true);
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

      if (this.isCorrect()){
        this.next();
      } else {
        this.editAgainAnimated();
      }
    }

    const target = ev.target as HTMLElement | null;
    if (target?.closest('textarea')) return;

    if (ev.key === 'ArrowLeft') {
      ev.preventDefault();
      this.prev();
    }
    if (ev.key === 'ArrowRight') {
      ev.preventDefault();
      this.next();
    }
  }

  // =========================================================
  // Audio
  // =========================================================

  private sentenceAudioSrc(): string | undefined {
    const id = this.current()?.id;
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
}
