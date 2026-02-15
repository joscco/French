import {CommonModule} from '@angular/common';
import {Component, computed, effect, HostListener, inject, input, OnDestroy, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {EditorStore} from '../../services/editor-store.service';
import {TTSService} from '../../services/tts.service';
import {Genus, Lang, TermCategory, TermRow} from '../../../../shared/contract/contract';
import {beautifyGenus, getArticle, reverseLanguage} from '../../../app/helpers/utils';
import {TermPickerComponent} from '../term-picker/term-picker.component';
import {parseTermDisplayMarkup, TermDisplaySeg} from '../../helpers/term-display-markup';

type OverlayPosition = { x: number; y: number };

@Component({
  standalone: true,
  selector: 'app-term-editor',
  imports: [CommonModule, FormsModule, TermPickerComponent],
  templateUrl: './term-editor.component.html',
})
export class TermEditorComponent implements OnDestroy {

  private readonly editorStore = inject(EditorStore);
  private readonly ttsService = inject(TTSService);

  termId = input<number | null>(null);

  translationOverlayOpen = signal(false);
  translationOverlayPosition = signal<OverlayPosition>({x: 24, y: 24});

  // Audio state
  private audioElement: HTMLAudioElement | null = null;
  audioExists = signal<boolean | null>(null);
  isPlaying = signal(false);
  isGenerating = signal(false);
  generateError = signal<string | null>(null);

  // Audio state for linked terms
  private linkedAudioElement: HTMLAudioElement | null = null;
  linkedTermAudioExists = signal<Map<number, boolean>>(new Map());
  linkedTermPlaying = signal<number | null>(null);
  linkedTermGenerating = signal<number | null>(null);

  readonly displaySegments = computed<TermDisplaySeg[]>(() => {

    const termRow = this.selectedTerm();
    if (!termRow) {
      return [];
    }

    return parseTermDisplayMarkup(termRow.term_text);
  });

  categories: TermCategory[] = [
    'verb',
    'noun',
    'expression',
    'adjective',
    'other',
  ];

  categoryLabel: Record<TermCategory, string> = {
    verb: 'Verb',
    noun: 'Noun',
    expression: 'Expression',
    adjective: 'Adjective',
    other: 'Other',
  };

  readonly genusOptionsByLanguage: Record<Lang, Genus[]> = {
    fr: ['m', 'f', 'mpl', 'fpl'], // no neuter in French
    de: ['m', 'f', 'n', 'mpl', 'fpl'],
  };

  readonly genusLabel: Record<Genus, string> = {
    m: 'Masculine',
    f: 'Feminine',
    n: 'Neuter',
    mpl: 'Plural masculine',
    fpl: 'Plural feminine',
    pl: 'Plural (genderless)',
    npl: 'Plural neuter',
    'm/f': 'Masculine or feminine',
  };

  readonly selectedTerm = computed((): TermRow | null => {

    const selectedTermId = this.termId();

    if (selectedTermId == null) {
      return null;
    }

    return this.editorStore.terms().find(
      (termRow) => termRow.id === selectedTermId
    ) ?? null;

  });

  // Audio path for terms: sounds/term_{lang}{id}.mp3
  readonly audioPath = computed(() => {
    const term = this.selectedTerm();
    if (!term) {
      return null;
    }
    return `sounds/term_${term.lang}${term.id}.mp3`;
  });

  constructor() {
    // Reactive effect: check audio existence whenever termId changes
    effect(() => {
      this.termId(); // Track termId changes

      // Reset state
      this.audioExists.set(null);
      this.stopAudio();

      // Check audio existence
      this.checkAudioExists();
    });

    // Reactive effect: check linked terms audio existence
    effect(() => {
      const linked = this.linkedTerms();
      for (const term of linked) {
        if (this.isLinkedTermAudioExists(term.id) === null) {
          this.checkLinkedTermAudioExists(term.id, term.lang);
        }
      }
    });
  }

  ngOnDestroy() {
    this.stopAudio();
  }

  private async checkAudioExists() {
    const path = this.audioPath();
    if (!path) {
      this.audioExists.set(false);
      return;
    }

    try {
      const response = await fetch(path, { method: 'HEAD' });
      this.audioExists.set(response.ok);
    } catch {
      this.audioExists.set(false);
    }
  }

  playAudio() {
    const path = this.audioPath();
    if (!path) {
      return;
    }

    this.stopAudio();

    this.audioElement = new Audio(path);
    this.audioElement.onplay = () => this.isPlaying.set(true);
    this.audioElement.onended = () => this.isPlaying.set(false);
    this.audioElement.onpause = () => this.isPlaying.set(false);
    this.audioElement.onerror = () => {
      this.isPlaying.set(false);
      this.audioExists.set(false);
    };

    this.audioElement.play().catch(() => {
      this.isPlaying.set(false);
    });
  }

  stopAudio() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
    this.isPlaying.set(false);
  }

  toggleAudio() {
    if (this.isPlaying()) {
      this.stopAudio();
    } else {
      this.playAudio();
    }
  }

  async generateAudio() {
    const currentTermId = this.termId();
    if (currentTermId == null) {
      return;
    }

    this.isGenerating.set(true);
    this.generateError.set(null);

    const result = await this.ttsService.generateTermAudio(currentTermId);

    this.isGenerating.set(false);

    if (result.success) {
      this.audioExists.set(true);
      // Auto-play after generation
      setTimeout(() => this.playAudio(), 100);
    } else {
      this.generateError.set(result.error ?? 'Unbekannter Fehler');
    }
  }

  get ttsServerAvailable() {
    return this.ttsService.serverAvailable();
  }

  // =========================================================
  // Linked Term Audio
  // =========================================================

  getLinkedTermAudioPath(termId: number, lang: string): string {
    return `sounds/term_${lang}${termId}.mp3`;
  }

  async checkLinkedTermAudioExists(termId: number, lang: string): Promise<boolean> {
    const path = this.getLinkedTermAudioPath(termId, lang);
    try {
      const response = await fetch(path, { method: 'HEAD' });
      const exists = response.ok;
      this.linkedTermAudioExists.update(map => {
        const newMap = new Map(map);
        newMap.set(termId, exists);
        return newMap;
      });
      return exists;
    } catch {
      this.linkedTermAudioExists.update(map => {
        const newMap = new Map(map);
        newMap.set(termId, false);
        return newMap;
      });
      return false;
    }
  }

  isLinkedTermAudioExists(termId: number): boolean | null {
    return this.linkedTermAudioExists().get(termId) ?? null;
  }

  isLinkedTermPlaying(termId: number): boolean {
    return this.linkedTermPlaying() === termId;
  }

  isLinkedTermGenerating(termId: number): boolean {
    return this.linkedTermGenerating() === termId;
  }

  playLinkedTermAudio(termId: number, lang: string) {
    this.stopLinkedTermAudio();

    const path = this.getLinkedTermAudioPath(termId, lang);
    this.linkedAudioElement = new Audio(path);
    this.linkedAudioElement.onplay = () => this.linkedTermPlaying.set(termId);
    this.linkedAudioElement.onended = () => this.linkedTermPlaying.set(null);
    this.linkedAudioElement.onpause = () => this.linkedTermPlaying.set(null);
    this.linkedAudioElement.onerror = () => {
      this.linkedTermPlaying.set(null);
      this.linkedTermAudioExists.update(map => {
        const newMap = new Map(map);
        newMap.set(termId, false);
        return newMap;
      });
    };

    this.linkedAudioElement.play().catch(() => {
      this.linkedTermPlaying.set(null);
    });
  }

  stopLinkedTermAudio() {
    if (this.linkedAudioElement) {
      this.linkedAudioElement.pause();
      this.linkedAudioElement.currentTime = 0;
      this.linkedAudioElement = null;
    }
    this.linkedTermPlaying.set(null);
  }

  toggleLinkedTermAudio(termId: number, lang: string) {
    if (this.isLinkedTermPlaying(termId)) {
      this.stopLinkedTermAudio();
    } else {
      this.playLinkedTermAudio(termId, lang);
    }
  }

  async generateLinkedTermAudio(termId: number, lang: string) {
    this.linkedTermGenerating.set(termId);

    const result = await this.ttsService.generateTermAudio(termId);

    this.linkedTermGenerating.set(null);

    if (result.success) {
      this.linkedTermAudioExists.update(map => {
        const newMap = new Map(map);
        newMap.set(termId, true);
        return newMap;
      });
      // Auto-play after generation
      setTimeout(() => this.playLinkedTermAudio(termId, lang), 100);
    }
  }

  readonly isNoun = computed((): boolean => {

    const termRow = this.selectedTerm();

    return (termRow?.category ?? '') === 'noun';

  });

  readonly availableGenusOptions = computed(() => {

    const termRow = this.selectedTerm();

    if (!termRow || !this.isNoun()) {
      return [];
    }

    return this.genusOptionsByLanguage[termRow.lang];

  });

  readonly linkedTerms = computed(() => {

    const termRow = this.selectedTerm();

    if (!termRow) {
      return [];
    }

    return this.editorStore.getLinkedTerms(termRow.id, termRow.lang);

  });

  readonly linkedTermsWithSegments = computed(() => {

    return this.linkedTerms().map(linkedTerm => ({
      ...linkedTerm,
      segments: parseTermDisplayMarkup(linkedTerm.term_text),
      isNoun: linkedTerm.category === 'noun',
      article: linkedTerm.category === 'noun'
        ? getArticle(linkedTerm.lang, linkedTerm.genus, linkedTerm.needsVowelArticle ?? false)
        : null,
    }));

  });

  readonly excludedTranslationIds = computed(() => {

    const termRow = this.selectedTerm();

    if (!termRow) {
      return [];
    }

    const alreadyLinkedTermIds = this.editorStore.getLinkedTermIds(
      termRow.id,
      termRow.lang,
    );

    return [
      termRow.id,
      ...alreadyLinkedTermIds,
    ];

  });

  readonly oppositeLanguage = computed<Lang | null>(() => {

    const termRow = this.selectedTerm();

    if (!termRow) {
      return null;
    }

    return reverseLanguage(termRow.lang);

  });

  readonly isCategoryMissing = computed(() => {

    const termRow = this.selectedTerm();

    return !(termRow?.category ?? '').trim();

  });

  readonly isGenusMissing = computed(() => {

    const termRow = this.selectedTerm();

    if (!termRow) {
      return false;
    }

    if (termRow.category !== 'noun') {
      return false;
    }

    return !(termRow.genus ?? '').trim();

  });

  readonly isTermInvalid = computed(() => {

    return this.isCategoryMissing() || this.isGenusMissing();

  });

  updateTerm(patch: Partial<TermRow>) {

    const selectedTermId = this.termId();

    if (selectedTermId == null) {
      return;
    }

    this.editorStore.updateTerm(selectedTermId, patch);

  }

  onCategoryChanged(newCategory: string) {

    const normalizedCategory =
      (newCategory || undefined) as TermCategory | undefined;

    if (normalizedCategory !== 'noun') {

      this.updateTerm({
        category: normalizedCategory,
        genus: undefined,
      });

      return;

    }

    this.updateTerm({
      category: normalizedCategory,
    });

  }

  autoDetectVowel(displayValue: string) {

    const normalizedDisplay =
      (displayValue ?? '').trim().toLowerCase();

    const firstCharacter = normalizedDisplay[0];

    const beginsWithVowel =
      !!firstCharacter && 'aeiouyh'.includes(firstCharacter);

    this.updateTerm({
      needsVowelArticle: beginsWithVowel,
    });

  }

  openTranslationOverlay(mouseEvent: MouseEvent) {

    mouseEvent.stopPropagation();

    const panelWidth = 520;
    const panelHeight = 520;
    const padding = 12;

    const anchorRect =
      (mouseEvent.currentTarget as HTMLElement).getBoundingClientRect();

    const targetLeft =
      Math.max(
        padding,
        Math.min(
          anchorRect.left,
          window.innerWidth - panelWidth - padding,
        ),
      );

    const targetTop =
      Math.max(
        padding,
        Math.min(
          anchorRect.bottom + 8,
          window.innerHeight - panelHeight - padding,
        ),
      );

    this.translationOverlayPosition.set({
      x: targetLeft,
      y: targetTop,
    });

    this.translationOverlayOpen.set(true);

  }

  closeTranslationOverlay() {

    this.translationOverlayOpen.set(false);

  }

  onTranslationChosen(selectedTermRow: TermRow) {

    const baseTermRow = this.selectedTerm();

    if (!baseTermRow) {
      return;
    }

    if (baseTermRow.lang === selectedTermRow.lang) {
      return;
    }

    this.editorStore.addLinkBetween(
      baseTermRow,
      selectedTermRow,
    );

    this.closeTranslationOverlay();

  }

  removeTranslation(linkedTermRow: TermRow) {

    const baseTermRow = this.selectedTerm();

    if (!baseTermRow) {
      return;
    }

    this.editorStore.removeLinkBetween(
      baseTermRow,
      linkedTermRow,
    );

  }

  @HostListener('document:keydown', ['$event'])
  onEscapeKeyPressed(keyboardEvent: KeyboardEvent) {

    if (keyboardEvent.key === 'Escape') {
      this.closeTranslationOverlay();
    }

  }

  protected readonly beautifyGenus = beautifyGenus;
  protected readonly getArticle = getArticle;

}
