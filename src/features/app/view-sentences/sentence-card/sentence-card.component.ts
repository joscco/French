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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import gsap from 'gsap';

import { TermTooltipOverlayComponent } from '../term-tooltip-overlay/term-tooltip-overlay.component';
import { PromptMarkupComponent } from '../prompt-markup/prompt-markup.component';
import { IconButtonComponent } from '../../shared/icon-button/icon-button.component';
import { PracticeMode } from '../../models/types';
import { TermLookupService, TermTooltipVm } from '../../services/term-lookup.service';
import { PracticeRouteStateService } from '../../services/route-state.service';
import { buildWordOverlayTokens, collapseOverlayRuns, DisplayToken } from '../../helpers/answer-diff';
import { buildPromptSegments, PromptSegment } from '../../helpers/prompt-markup';
import { TermRefInSentence } from '../../models/term-ref-in-sentence';
import { normalizeForCheck } from '../../helpers/normalize';
import { SentenceVm } from '../../models/sentence-vm';

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
  sentence = input<SentenceVm | null>(null);
  mode = input<PracticeMode>('de-fr');

  @Output() nextRequested = new EventEmitter<void>();

  private readonly termLookup = inject(TermLookupService);
  private readonly routeStateService = inject(PracticeRouteStateService);

  readonly answer = signal('');
  readonly isChecked = signal(false);
  readonly isCorrect = signal(false);

  readonly displayTokens = signal<DisplayToken[]>([]);
  readonly promptSegments = signal<PromptSegment[]>([]);

  readonly promptText = computed(() => {
    const currentSentence = this.sentence();
    if (!currentSentence) {
      return '';
    }

    if (this.mode() === 'de-fr') {
      return currentSentence.de;
    }

    return currentSentence.fr;
  });

  readonly expectedRawMarkup = computed(() => {
    const currentSentence = this.sentence();
    if (!currentSentence) {
      return '';
    }

    if (this.mode() === 'de-fr') {
      return currentSentence.frRaw;
    }

    return currentSentence.deRaw;
  });

  // Fallback plain expected (used if markup expansion yields nothing)
  readonly expectedPlain = computed(() => {
    const currentSentence = this.sentence();
    if (!currentSentence) {
      return '';
    }

    if (this.mode() === 'de-fr') {
      return currentSentence.fr;
    }

    return currentSentence.de;
  });

  readonly promptRefs = computed<TermRefInSentence[]>(() => {
    const currentSentence = this.sentence();
    const refs = currentSentence?.refs ?? [];
    const promptLang: TermRefInSentence['lang'] = this.mode() === 'de-fr' ? 'de' : 'fr';
    return refs.filter((ref) => ref.lang === promptLang);
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

    // Check answer and build display tokens (NOW supports alternative representatives via [...] )
    effect(() => {
      if (!this.isChecked()) {
        return;
      }

      const answerRaw = (this.answer() ?? '').trim();
      const expectedMarkupRaw = this.expectedRawMarkup().trim();

      const expectedVariants = this.buildExpectedVariants(expectedMarkupRaw);
      const bestExpectedForOverlay = this.pickBestExpectedVariant(expectedVariants, answerRaw);

      const overlayTokens = buildWordOverlayTokens(bestExpectedForOverlay.trim(), answerRaw);
      this.displayTokens.set(collapseOverlayRuns(overlayTokens));

      const answerNormalized = normalizeForCheck(answerRaw);

      const isAnyVariantCorrect = expectedVariants.some((expectedText) => {
        const expectedNormalized = normalizeForCheck(expectedText);
        return expectedNormalized === answerNormalized;
      });

      this.isCorrect.set(isAnyVariantCorrect);
    });

    // reset when input sentences change
    effect(() => {
      this.sentence();
      this.mode();
      this.resetForNext();
    });

    effect(() => {
      const shouldAutoPlay =
        this.isChecked() &&
        this.isCorrect() &&
        this.mode() === 'de-fr';

      if (!shouldAutoPlay) {
        this.autoPlayedForCheck.set(false);
        return;
      }

      if (this.autoPlayedForCheck()) {
        return;
      }

      this.autoPlayedForCheck.set(true);
      this.playAudio();
    });
  }

  // =========================================================
  // Accept alternative representatives
  // =========================================================

  private buildExpectedVariants(expectedMarkupRaw: string): string[] {
    if (!expectedMarkupRaw) {
      const fallbackPlain = this.expectedPlain().trim();
      return fallbackPlain ? [fallbackPlain] : [''];
    }

    const maxVariants = 32;

    // 1) expand [...] alternatives
    const expandedWithAnnotations = expandBracketAlternatives(expectedMarkupRaw, maxVariants);

    // 2) strip {surface|#id} -> surface (and also {surface})
    const stripped = expandedWithAnnotations
      .map((variant) => stripAnnotationBraces(variant))
      .map((variant) => variant.trim())
      .filter((variant) => variant.length > 0);

    // Fallback if something went wrong
    if (stripped.length === 0) {
      const fallbackPlain = this.expectedPlain().trim();
      if (fallbackPlain) {
        return [fallbackPlain];
      }
      return [stripAnnotationBraces(expectedMarkupRaw).trim()];
    }

    // Deduplicate while preserving order
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const variant of stripped) {
      if (!seen.has(variant)) {
        seen.add(variant);
        unique.push(variant);
      }
    }

    return unique;
  }

  private pickBestExpectedVariant(expectedVariants: string[], answerRaw: string): string {
    if (!expectedVariants.length) {
      return '';
    }

    const answerNormalized = normalizeForCheck(answerRaw);

    let bestVariant = expectedVariants[0];
    let bestScore = -1;

    for (const candidateVariant of expectedVariants) {
      const candidateNormalized = normalizeForCheck(candidateVariant);
      const score = commonPrefixLength(candidateNormalized, answerNormalized);

      if (score > bestScore) {
        bestScore = score;
        bestVariant = candidateVariant;
      }
    }

    return bestVariant;
  }

  // =========================================================
  // ngModel
  // =========================================================

  get answerModel(): string {
    return this.answer();
  }

  set answerModel(value: string) {
    this.answer.set(value);
  }

  // =========================================================
  // Animations: check / edit again
  // =========================================================

  checkAnimated() {
    if (!this.sentence()) {
      return;
    }

    this.isChecked.set(true);

    requestAnimationFrame(() => {
      const overlayElement = this.overlayLayer?.nativeElement;
      const editElement = this.editLayer?.nativeElement;
      const checkElement = this.footerCheck?.nativeElement;
      const barElement = this.footerBar?.nativeElement;

      if (!overlayElement || !editElement || !checkElement || !barElement) {
        return;
      }

      gsap.killTweensOf([overlayElement, editElement, checkElement, barElement]);

      gsap.set(overlayElement, { opacity: 0 });
      gsap.set(barElement, { opacity: 0 });
      gsap.set(checkElement, { opacity: 1 });

      gsap.timeline()
        .to(editElement, { opacity: 0, duration: 0.2, ease: 'power2.out' }, 0)
        .to(overlayElement, { opacity: 1, duration: 0.2, ease: 'power2.out' }, 0)
        .to(checkElement, { opacity: 0, duration: 0.2, ease: 'power2.out' }, 0)
        .to(barElement, { opacity: 1, duration: 0.2, ease: 'power2.out' }, 0);
    });
  }

  editAgainAnimated() {
    const overlayElement = this.overlayLayer?.nativeElement;
    const editElement = this.editLayer?.nativeElement;
    const checkElement = this.footerCheck?.nativeElement;
    const barElement = this.footerBar?.nativeElement;

    if (!overlayElement || !editElement || !checkElement || !barElement) {
      this.editAgain();
      return;
    }

    gsap.killTweensOf([overlayElement, editElement, checkElement, barElement]);

    gsap.timeline({
      onComplete: () => {
        this.editAgain();
        requestAnimationFrame(() => gsap.set(editElement, { opacity: 1 }));
      },
    })
      .to(overlayElement, { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0)
      .to(barElement, { opacity: 0, duration: 0.2, ease: 'power2.in' }, 0)
      .to(checkElement, { opacity: 1, duration: 0.18, ease: 'power2.in' }, 0)
      .to(editElement, { opacity: 1, duration: 0.2, ease: 'power2.out' }, 0);
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
      const overlayElement = this.overlayLayer?.nativeElement;
      const editElement = this.editLayer?.nativeElement;
      const checkElement = this.footerCheck?.nativeElement;
      const barElement = this.footerBar?.nativeElement;

      if (!overlayElement || !editElement || !checkElement || !barElement) {
        return;
      }

      gsap.killTweensOf([overlayElement, editElement, checkElement, barElement]);
      gsap.set(overlayElement, { opacity: 0, y: 0 });
      gsap.set(editElement, { opacity: 1 });
      gsap.set(checkElement, { opacity: 1, y: 0 });
      gsap.set(barElement, { opacity: 0, y: 0 });
    });
  }

  // =========================================================
  // Keyboard
  // =========================================================

  @HostListener('document:keydown', ['$event'])
  onDocKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.closeTooltip(true);
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();

      if (!this.isChecked()) {
        this.checkAnimated();
        return;
      }

      if (this.isCorrect()) {
        this.nextRequested.emit();
        return;
      }

      this.editAgainAnimated();
    }
  }

  // =========================================================
  // Audio
  // =========================================================

  private sentenceAudioSrc(): string | undefined {
    const sentenceId = this.sentence()?.id;
    if (sentenceId === undefined || sentenceId === null) {
      return undefined;
    }
    return new URL(`sounds/fr${sentenceId}.mp3`, document.baseURI).toString();
  }

  private playAudio() {
    const src = this.sentenceAudioSrc();
    if (!src) {
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

      const playPromise = this.audio.play();
      if (playPromise && typeof (playPromise as any).then === 'function') {
        (playPromise as Promise<void>).catch(() => this.stopAudio());
      }
    } catch {
      this.stopAudio();
    }
  }

  togglePlay(event?: Event) {
    if (event) {
      event.stopPropagation();
    }

    const src = this.sentenceAudioSrc();
    if (!src) {
      return;
    }

    if (this.isPlaying()) {
      this.stopAudio();
      return;
    }

    this.playAudio();
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

  // =========================================================
  // Tooltip
  // =========================================================

  @HostListener('document:pointerdown', ['$event'])
  onDocPointerDown(event: PointerEvent) {
    if (!this.tooltipOpen()) {
      return;
    }

    const targetElement = event.target as HTMLElement | null;
    if (!targetElement) {
      return;
    }

    if (targetElement.closest('[data-tooltip]')) {
      return;
    }
    if (targetElement.closest('[data-term]')) {
      return;
    }

    this.closeTooltip(true);
  }

  readonly activeRefKey = computed(() => {
    const activeRef = this.tooltipAnchorRef();
    return activeRef ? `${activeRef.lang}#${activeRef.termId}` : undefined;
  });

  onTooltipPanelRect(panelRect: DOMRect) {
    const measuredWidth = Math.max(0, Math.round(panelRect.width));
    if (!measuredWidth) {
      return;
    }

    if (Math.abs(this.tooltipPanelW() - measuredWidth) > 2) {
      this.tooltipPanelW.set(measuredWidth);

      const anchorElement = this.lastAnchorEl;
      if (this.tooltipOpen() && anchorElement) {
        this.setTooltipPosition(anchorElement);
      }
    }
  }

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
      if (!this.tooltipPinned()) {
        this.closeTooltip();
      }
    }, delayMs);
  }

  private setTooltipPosition(anchorEl: HTMLElement) {
    this.lastAnchorEl = anchorEl;

    const anchorRect = anchorEl.getBoundingClientRect();
    const hostRect = this.swapHost?.nativeElement?.getBoundingClientRect();
    if (!hostRect) {
      return;
    }

    const padding = 10;

    const centerX = anchorRect.left + anchorRect.width / 2 - hostRect.left;

    const tooltipWidth = this.tooltipPanelW();
    const halfWidth = tooltipWidth / 2;

    const minX = padding + halfWidth;
    const maxX = hostRect.width - padding - halfWidth;

    const clampedX = Math.min(Math.max(centerX, minX), maxX);

    this.tooltipX.set(clampedX);
    this.tooltipBasisX.set('center');

    const localTop = anchorRect.top - hostRect.top;
    this.tooltipY.set(localTop);
  }

  private openTooltipForRef(ref: TermRefInSentence, anchorEl: HTMLElement) {
    this.cancelTooltipClose();
    this.setTooltipPosition(anchorEl);

    this.tooltipVm.set(this.termLookup.getTooltipVm(ref.termId));
    this.tooltipAnchorRef.set(ref);
    this.tooltipOpen.set(true);
  }

  onPromptTermEnter(event: { ref: TermRefInSentence; el: HTMLElement }) {
    if (this.tooltipPinned()) {
      return;
    }
    this.openTooltipForRef(event.ref, event.el);
  }

  onPromptTermLeave() {
    if (this.tooltipPinned()) {
      return;
    }
    this.scheduleTooltipClose(80);
  }

  onPromptTermClick(event: { ref: TermRefInSentence; el: HTMLElement }) {
    this.tooltipPinned.set(true);
    this.openTooltipForRef(event.ref, event.el);
  }

  closeTooltip(force = false) {
    this.cancelTooltipClose();
    this.tooltipPinned.set(false);

    this.tooltipOpen.set(false);
    this.tooltipVm.set(undefined);
    this.tooltipAnchorRef.set(undefined);

    if (force) {
      return;
    }
  }
}

// =========================================================
// Helpers: expand [...] alternatives & strip {surface|#id}
// =========================================================

function stripAnnotationBraces(text: string): string {
  // {surface|#123} -> surface
  // {surface}      -> surface
  return text.replace(/\{([^}|]+)(?:\|#[0-9]+)?\}/g, '$1');
}

function expandBracketAlternatives(text: string, maxVariants: number): string[] {
  const chunks = buildChunksFromMarkup(text);
  let variants: string[] = [''];

  for (const chunk of chunks) {
    const options = Array.isArray(chunk) ? chunk : [chunk];
    const nextVariants: string[] = [];

    for (const prefix of variants) {
      for (const option of options) {
        nextVariants.push(prefix + option);

        if (nextVariants.length >= maxVariants) {
          break;
        }
      }

      if (nextVariants.length >= maxVariants) {
        break;
      }
    }

    variants = nextVariants;

    if (variants.length >= maxVariants) {
      break;
    }
  }

  return variants;
}

function buildChunksFromMarkup(text: string): Array<string | string[]> {
  const chunks: Array<string | string[]> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const bracketStart = text.indexOf('[', cursor);

    if (bracketStart === -1) {
      chunks.push(text.slice(cursor));
      break;
    }

    if (bracketStart > cursor) {
      chunks.push(text.slice(cursor, bracketStart));
    }

    const bracketEnd = findMatchingBracket(text, bracketStart);
    if (bracketEnd === -1) {
      // unbalanced; treat rest as plain text
      chunks.push(text.slice(bracketStart));
      break;
    }

    const inner = text.slice(bracketStart + 1, bracketEnd);
    const options = splitTopLevelPipes(inner);

    chunks.push(options);

    cursor = bracketEnd + 1;
  }

  return chunks;
}

function findMatchingBracket(text: string, openIndex: number): number {
  let bracketDepth = 0;
  let curlyDepth = 0;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];

    if (char === '{') {
      curlyDepth += 1;
    } else if (char === '}') {
      curlyDepth = Math.max(0, curlyDepth - 1);
    }

    if (curlyDepth > 0) {
      continue;
    }

    if (char === '[') {
      bracketDepth += 1;
      continue;
    }

    if (char === ']') {
      bracketDepth -= 1;
      if (bracketDepth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitTopLevelPipes(text: string): string[] {
  const parts: string[] = [];

  let current = '';
  let curlyDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === '{') {
      curlyDepth += 1;
      current += char;
      continue;
    }

    if (char === '}') {
      curlyDepth = Math.max(0, curlyDepth - 1);
      current += char;
      continue;
    }

    if (char === '[') {
      bracketDepth += 1;
      current += char;
      continue;
    }

    if (char === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += char;
      continue;
    }

    const isTopLevelPipe = char === '|' && curlyDepth === 0 && bracketDepth === 0;

    if (isTopLevelPipe) {
      parts.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current);

  return parts.map((part) => part);
}

function commonPrefixLength(left: string, right: string): number {
  const max = Math.min(left.length, right.length);
  let index = 0;

  while (index < max) {
    if (left[index] !== right[index]) {
      break;
    }
    index += 1;
  }

  return index;
}
