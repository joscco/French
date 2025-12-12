import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';

import { Sentence } from '../../models/sentence';
import { PracticeMode } from '../../models/types';
import { normalizeForCheck } from '../../helpers/normalize';
import { buildWordOverlayTokens, collapseOverlayRuns, DisplayToken } from '../../helpers/answer-diff';

import { TermLookupService, TermTooltipVm } from '../../services/term-lookup.service';
import { TermRef } from '../../models/term-ref';
import { buildPromptSegments, PromptSegment } from '../../helpers/prompt-markup';

import { gsap } from 'gsap';

@Component({
  selector: 'app-sentence-practice',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule],
  templateUrl: './sentence-practice.component.html'
})
export class SentencePracticeComponent {
  // ✅ Input Signals
  sentences = input<Sentence[]>([]);
  mode = input<PracticeMode>('de-fr');

  // services
  termLookup = inject(TermLookupService);

  // Tooltip panel ref (exists only while tooltipVisible() is true)
  tooltipPanel = viewChild<ElementRef<HTMLElement>>('tooltipPanel');

  // state
  index = signal(0);
  answer = signal('');
  isChecked = signal(false);
  isCorrect = signal(false);
  displayTokens = signal<DisplayToken[]>([]);
  promptSegments = signal<PromptSegment[]>([]);

  // tooltip state
  hoverCloseTimer?: number;

  tooltipPinned = signal(false);

  // IMPORTANT: render != open (damit close-Animation möglich ist)
  tooltipVisible = signal(false); // steuert @if im Template
  tooltipVm = signal<TermTooltipVm | undefined>(undefined);
  tooltipX = signal(0);
  tooltipY = signal(0);

  // für "Ref-Gruppe aktiv" (Split refs)
  tooltipAnchorRef = signal<TermRef | undefined>(undefined);

  // audio
  isPlaying = signal(false);
  private audio?: HTMLAudioElement;

  current = computed<Sentence | undefined>(() => {
    const list = this.sentences();
    const i = this.index();
    return list[i] ?? list[0];
  });

  promptLang = computed<TermRef['lang']>(() => (this.mode() === 'de-fr' ? 'de' : 'fr'));

  promptText = computed(() => {
    const cur = this.current();
    if (!cur) return '';
    return this.mode() === 'de-fr' ? cur.de : cur.fr;
  });

  expectedText = computed(() => {
    const cur = this.current();
    if (!cur) return '';
    return this.mode() === 'de-fr' ? cur.fr : cur.de;
  });

  promptRefs = computed<TermRef[]>(() => {
    const cur = this.current();
    const refs = cur?.refs ?? [];
    const lang = this.promptLang();
    return refs.filter(r => r.lang === lang);
  });

  // bridge für ngModel
  get answerModel(): string {
    return this.answer();
  }
  set answerModel(v: string) {
    this.answer.set(v);
  }

  constructor() {
    // Prompt-Markup immer aktuell halten
    effect(() => {
      const prompt = this.promptText();
      const refs = this.promptRefs();
      this.promptSegments.set(buildPromptSegments(prompt, refs));
    });

    // Overlay + correctness nur updaten, wenn checked
    effect(() => {
      if (!this.isChecked()) return;

      const expectedRaw = this.expectedText().trim();
      const answerRaw = (this.answer() ?? '').trim();

      const rawTokens = buildWordOverlayTokens(expectedRaw, answerRaw);
      this.displayTokens.set(collapseOverlayRuns(rawTokens));

      const expectedNorm = normalizeForCheck(expectedRaw, {
        ignoreAccents: true,
        ignoreCase: true,
        normalizeWhitespace: true,
        normalizeQuotes: true,
        normalizePunctuationSpacing: true,
      });
      const answerNorm = normalizeForCheck(answerRaw, {
        ignoreAccents: true,
        ignoreCase: true,
        normalizeWhitespace: true,
        normalizeQuotes: true,
        normalizePunctuationSpacing: true,
      });

      this.isCorrect.set(expectedNorm === answerNorm);
    });
  }

  // ---------- helpers: ref-key (für Split-Reihen) ----------
  private refKey(ref: TermRef | undefined): string | undefined {
    if (!ref) return undefined;
    return `${ref.lang}:${ref.id}`;
  }

  isRefActive(ref: TermRef | undefined): boolean {
    // Wenn Tooltip sichtbar ist, gilt AnchorRef als "aktive" Referenzgruppe
    return !!ref && this.tooltipVisible() && this.refKey(ref) === this.refKey(this.tooltipAnchorRef());
  }

  // ---------- tooltip animation ----------
  private animateTooltipIn() {
    afterNextRender(() => {
      const el = this.tooltipPanel()?.nativeElement;
      if (!el) return;

      gsap.killTweensOf(el);
      gsap.set(el, { opacity: 0, scale: 0.96, transformOrigin: '50% 100%' });
      gsap.to(el, { opacity: 1, scale: 1, duration: 0.14, ease: 'power2.out' });
    });
  }

  private animateTooltipOut(onDone: () => void) {
    const el = this.tooltipPanel()?.nativeElement;
    if (!el) {
      onDone();
      return;
    }

    gsap.killTweensOf(el);
    gsap.to(el, {
      opacity: 0,
      scale: 0.96,
      duration: 0.12,
      ease: 'power2.out',
      onComplete: onDone,
    });
  }

  // ---------- tooltip open/close ----------
  openTooltipForRef(ref: TermRef, anchorEl: HTMLElement) {
    const rect = anchorEl.getBoundingClientRect();
    this.tooltipX.set(rect.left + rect.width / 2);
    this.tooltipY.set(rect.top);

    this.tooltipVm.set(this.termLookup.getTooltipVm(ref));
    this.tooltipAnchorRef.set(ref);

    if (!this.tooltipVisible()) {
      this.tooltipVisible.set(true);
      this.animateTooltipIn();
    } else {
      // already visible: just retarget (no big animation needed)
      // optional: tiny "pop" if you want:
      // this.animateTooltipIn();
    }
  }

  openTooltipAt(ref: TermRef, x: number, y: number) {
    this.tooltipX.set(x);
    this.tooltipY.set(y);

    this.tooltipVm.set(this.termLookup.getTooltipVm(ref));
    this.tooltipAnchorRef.set(ref);

    if (!this.tooltipVisible()) {
      this.tooltipVisible.set(true);
      this.animateTooltipIn();
    } else {
      // already visible: update content
    }
  }

  onTermEnter(_ev: MouseEvent, ref: TermRef, el: HTMLElement) {
    if (this.tooltipPinned()) {
      return;
    }
    this.cancelHoverClose();
    this.openTooltipForRef(ref, el);
  }

  onTermLeave() {
    if (this.tooltipPinned()) {
      return;
    }
    this.scheduleHoverClose();
  }

  onTooltipEnter() {
    this.cancelHoverClose();
  }

  onTooltipLeave() {
    if (this.tooltipPinned()) return;
    this.scheduleHoverClose();
  }

  onTermClick(ev: MouseEvent, ref: TermRef) {
    ev.preventDefault();
    ev.stopPropagation();
    this.tooltipPinned.set(true);
    this.cancelHoverClose();
    this.openTooltipAt(ref, ev.clientX, ev.clientY);
  }

  closeTooltip(animated = true) {
    this.cancelHoverClose();
    this.tooltipPinned.set(false);

    const done = () => {
      this.tooltipVisible.set(false);
      this.tooltipVm.set(undefined);
      this.tooltipAnchorRef.set(undefined);
    };

    if (!this.tooltipVisible()) {
      return;
    }

    if (!animated) {
      done();
      return;
    }

    this.animateTooltipOut(done);
  }

  private scheduleHoverClose() {
    this.cancelHoverClose();
    this.hoverCloseTimer = window.setTimeout(() => {
      if (!this.tooltipPinned()) {
        this.closeTooltip(true);
      }
    }, 120);
  }

  private cancelHoverClose() {
    if (this.hoverCloseTimer) {
      window.clearTimeout(this.hoverCloseTimer);
      this.hoverCloseTimer = undefined;
    }
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(ev: PointerEvent) {
    if (!this.tooltipVisible()) {
      return;
    }

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
    }
  }

  // ---------- audio ----------
  canPlay(): boolean {
    return !!this.current()?.id;
  }

  private sentenceAudioSrc(): string | undefined {
    const id = this.current()?.id;
    if (id === undefined || id === null) return undefined;
    return new URL(`sounds/fr${id}.mp3`, document.baseURI).toString();
  }

  togglePlay(ev?: Event) {
    ev?.stopPropagation();
    const src = this.sentenceAudioSrc();
    if (!src) return;

    if (this.isPlaying()) {
      this.stopAudio();
      return;
    }

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

  // ---------- actions ----------
  check() {
    if (!this.current()) return;
    this.isChecked.set(true);

    queueMicrotask(() => {
      if (!this.isCorrect()) this.togglePlay();
    });
  }

  editAgain() {
    this.isChecked.set(false);
    this.isCorrect.set(false);
    this.displayTokens.set([]);
  }

  prev() {
    const list = this.sentences();
    if (!list.length) return;
    this.index.update(i => (i - 1 + list.length) % list.length);
    this.resetForNext();
  }

  next() {
    const list = this.sentences();
    if (!list.length) return;
    this.index.update(i => (i + 1) % list.length);
    this.resetForNext();
  }

  private resetForNext() {
    this.stopAudio();
    this.closeTooltip(false);
    this.answer.set('');
    this.isChecked.set(false);
    this.isCorrect.set(false);
    this.displayTokens.set([]);
  }

  onTextareaKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return;
    e.preventDefault();

    if (!this.isChecked()) this.check();
    else this.next();
  }
}
