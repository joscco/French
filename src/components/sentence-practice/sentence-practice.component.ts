import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import gsap from 'gsap';

import {Sentence} from '../../models/sentence';
import {PracticeMode} from '../../models/types';
import {normalizeForCheck} from '../../helpers/normalize';
import {
  buildWordOverlayTokens,
  collapseOverlayRuns,
  DisplayToken,
} from '../../helpers/answer-diff';

import {TermLookupService, TermTooltipVm} from '../../services/term-lookup.service';
import {TermRef} from '../../models/term-ref';
import {buildPromptSegments, PromptSegment} from '../../helpers/prompt-markup';

import {TermTooltipOverlayComponent} from '../term-tooltip-overlay/term-tooltip-overlay.component';
import {PromptMarkupComponent} from '../prompt-markup/prompt-markup.component';
import {PracticeCardShellComponent} from '../practice-card-shell/practice-card-shell.component';

@Component({
  selector: 'app-sentence-practice',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PromptMarkupComponent,
    TermTooltipOverlayComponent,
    PracticeCardShellComponent,
  ],
  templateUrl: './sentence-practice.component.html',
})
export class SentencePracticeComponent {
  sentences = input<Sentence[]>([]);
  mode = input<PracticeMode>('de-fr');

  private readonly termLookup = inject(TermLookupService);
  readonly textForRef = (ref: TermRef) => this.termLookup.getText(ref);

  readonly oriented = signal<Sentence[]>([]);
  readonly index = signal(0);
  readonly navDirection = signal<'next' | 'prev'>('next');

  readonly current = computed<Sentence | undefined>(() => {
    const list = this.oriented();
    const i = this.index();
    return list[i] ?? list[0];
  });

  readonly answer = signal('');
  readonly isChecked = signal(false);
  readonly isCorrect = signal(false);
  readonly displayTokens = signal<DisplayToken[]>([]);
  readonly promptSegments = signal<PromptSegment[]>([]);

  // tooltip state (unchanged)
  readonly tooltipPinned = signal(false);
  readonly tooltipOpen = signal(false);
  readonly tooltipVm = signal<TermTooltipVm | undefined>(undefined);
  readonly tooltipX = signal(0);
  readonly tooltipY = signal(0);
  readonly tooltipAnchorRef = signal<TermRef | undefined>(undefined);

  readonly activeRefKey = computed(() => {
    const r = this.tooltipAnchorRef();
    return r ? `${r.lang}:${r.key}` : undefined;
  });

  // audio (unchanged)
  readonly isPlaying = signal(false);
  private audio?: HTMLAudioElement;

  // ----- view refs for gsap
  @ViewChild('overlayLayer') overlayLayer?: ElementRef<HTMLElement>;
  @ViewChild('editLayer') editLayer?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('footerCheck') footerCheck?: ElementRef<HTMLElement>;
  @ViewChild('footerBar') footerBar?: ElementRef<HTMLElement>;
  @ViewChild('swapHost') swapHost?: ElementRef<HTMLElement>;

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

  readonly promptRefs = computed<TermRef[]>(() => {
    const cur = this.current();
    const refs = cur?.refs ?? [];
    const lang: TermRef['lang'] = this.mode() === 'de-fr' ? 'de' : 'fr';
    return refs.filter(r => r.lang === lang);
  });

  get answerModel(): string {
    return this.answer();
  }

  set answerModel(v: string) {
    this.answer.set(v);
  }

  constructor() {
    effect(() => {
      this.promptSegments.set(buildPromptSegments(this.promptText(), this.promptRefs()));
    });

    // compute diff only when checked
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

    effect(() => {
      const list = this.sentences() ?? [];
      this.oriented.set([...list]);
      this.index.set(0);
      this.resetForNext();
    });
  }

  // -----------------------
  // animations
  // -----------------------

  checkAnimated() {
    if (!this.current()) return;

    // state first (tokens are computed via effect)
    this.isChecked.set(true);

    // next frame: animate layers + footer
    requestAnimationFrame(() => {
      const overlay = this.overlayLayer?.nativeElement;
      const edit = this.editLayer?.nativeElement;
      const check = this.footerCheck?.nativeElement;
      const bar = this.footerBar?.nativeElement;
      if (!overlay || !edit || !check || !bar) return;

      gsap.killTweensOf([overlay, edit, check, bar]);

      gsap.set(overlay, {opacity: 0,});
      gsap.set(bar, {opacity: 0});
      gsap.set(check, {opacity: 1, scaleX: 1});

      gsap.timeline()
        // swap textarea -> overlay
        .to(edit, {opacity: 0, duration: 0.2, ease: 'power2.out'}, 0)
        .to(overlay, {opacity: 1, duration: 0.2, ease: 'power2.out'}, 0)
        .to(check, {opacity: 0, scaleX: 0.8, duration: 0.2, ease: 'power2.out'}, 0)
        .to(bar, {opacity: 1, duration: 0.2, ease: 'power2.out'}, 0);
    });
  }

  editAgainAnimated() {
    const overlay = this.overlayLayer?.nativeElement;
    const edit = this.editLayer?.nativeElement;
    const check = this.footerCheck?.nativeElement;
    const bar = this.footerBar?.nativeElement;

    if (!overlay || !edit || !check || !bar) {
      this.editAgain();
      return;
    }

    gsap.killTweensOf([overlay, edit, check, bar]);

    gsap.timeline({
      onComplete: () => {
        this.editAgain();
        // restore visibility to edit layer after state flip
        requestAnimationFrame(() => {
          gsap.set(edit, {opacity: 1});
        });
      },
    })
      // overlay out
      .to(overlay, {opacity: 0, duration: 0.2, ease: 'power2.in'}, 0)
      // footer: bar -> check
      .to(bar, {opacity: 0,  duration: 0.2, ease: 'power2.in'}, 0)
      .to(check, {opacity: 1, scaleX: 1, duration: 0.18, ease: 'power2.in'}, 0)
      // textarea back in (after state reset)
      .to(edit, {opacity: 1, duration: 0.2, ease: 'power2.out'}, 0);
  }

  // -----------------------
  // check / edit / reset
  // -----------------------

  private editAgain() {
    this.isChecked.set(false);
    this.isCorrect.set(false);
    this.displayTokens.set([]);
  }

  private resetForNext() {
    this.stopAudio();
    this.closeTooltip();

    this.answer.set('');
    this.isChecked.set(false);
    this.isCorrect.set(false);
    this.displayTokens.set([]);

    // defensiv: falls du in einem komischen UI state navigierst
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

  onTextareaKeydown(e: KeyboardEvent) {
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return;

    e.preventDefault();
    if (!this.isChecked()) {
      this.checkAnimated();
      return;
    }

    // Checked: wenn korrekt -> weiter, sonst -> zurück in edit
    if (this.isCorrect()) this.next();
    else this.editAgainAnimated();
  }

  // -----------------------
  // navigation (unchanged)
  // -----------------------
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

  // -----------------------
  // tooltip (unchanged)
  // -----------------------
  private openTooltipForRef(ref: TermRef, anchorEl: HTMLElement) {
    const anchor = anchorEl.getBoundingClientRect();
    const host = this.swapHost?.nativeElement.getBoundingClientRect();

    const x = anchor.left + anchor.width / 2 - (host?.left ?? 0);
    const y = anchor.top - (host?.top ?? 0);

    this.tooltipX.set(x);
    this.tooltipY.set(y);
    this.tooltipVm.set(this.termLookup.getTooltipVm(ref));
    this.tooltipAnchorRef.set(ref);
    this.tooltipOpen.set(true);
  }

  private openTooltipAt(ref: TermRef, x: number, y: number) {
    this.tooltipX.set(x);
    this.tooltipY.set(y);
    this.tooltipVm.set(this.termLookup.getTooltipVm(ref));
    this.tooltipAnchorRef.set(ref);
    this.tooltipOpen.set(true);
  }

  onPromptTermEnter(e: { ref: TermRef; el: HTMLElement }) {
    if (this.tooltipPinned()) return;
    this.openTooltipForRef(e.ref, e.el);
  }

  onPromptTermLeave() {
    if (this.tooltipPinned()) return;
    this.closeTooltip();
  }

  onPromptTermClick(e: { ref: TermRef; x: number; y: number }) {
    this.tooltipPinned.set(true);
    this.openTooltipAt(e.ref, e.x, e.y);
  }

  onTooltipTranslationClick(tr: TermRef) {
    this.tooltipPinned.set(true);
    this.openTooltipAt(tr, this.tooltipX(), this.tooltipY());
  }

  closeTooltip() {
    this.tooltipPinned.set(false);
    this.tooltipOpen.set(false);
    this.tooltipVm.set(undefined);
    this.tooltipAnchorRef.set(undefined);
  }

  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(ev: PointerEvent) {
    if (!this.tooltipOpen()) return;
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    if (target.closest('[data-tooltip]')) return;
    if (target.closest('[data-term]')) return;
    this.closeTooltip();
  }

  @HostListener('document:keydown', ['$event'])
  onDocKeydown(ev: KeyboardEvent) {
    if (ev.key === 'Escape') {
      this.closeTooltip();
      return;
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

  // -----------------------
  // audio (unchanged)
  // -----------------------
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
}
