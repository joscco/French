import { CommonModule } from '@angular/common';
import { Component, computed, HostListener, inject, input, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatIcon } from '@angular/material/icon';
import { EditorStore } from '../../../services/editor-store.service';
import { TTSService } from '../../../services/tts.service';
import { TermPickerComponent } from '../../view-editor-sentences/term-picker/term-picker.component';
import { parseTermDisplayMarkup, TermDisplaySeg } from '../../../../../shared/helpers/term-display-markup';
import { Genus, Lang, TermCategory, TermRow } from '../../../../../shared/contract/contract';
import { getArticle, reverseLanguage } from '../../../../app/helpers/utils';

type OverlayPosition = { x: number; y: number };

@Component({
  standalone: true,
  selector: 'app-term-editor',
  imports: [CommonModule, FormsModule, TermPickerComponent, MatIcon],
  templateUrl: './term-editor.component.html',
})
export class TermEditorComponent implements OnDestroy {

  private readonly editorStore = inject(EditorStore);
  private readonly ttsService = inject(TTSService);

  termId = input<number | null>(null);

  translationOverlayOpen = signal(false);
  translationOverlayPosition = signal<OverlayPosition>({ x: 24, y: 24 });

  // Audio state
  private audioElement: HTMLAudioElement | null = null;
  isPlaying = signal(false);
  isGenerating = signal(false);
  generateError = signal<string | null>(null);

  // TTS Server URL für Audio-Dateien (umgeht Angular's File-Watcher)
  private readonly TTS_SERVER_URL = 'http://localhost:3001';

  // Audio state for linked terms
  private linkedAudioElement: HTMLAudioElement | null = null;
  linkedTermPlaying = signal<number | null>(null);
  linkedTermGenerating = signal<number | null>(null);

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
    de: ['m', 'f', 'n', 'mpl', 'fpl', 'npl'],
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
    return this.editorStore.terms().find((termRow) => termRow.id === selectedTermId) ?? null;
  });

  readonly displaySegments = computed<TermDisplaySeg[]>(() => {
    const termRow = this.selectedTerm();
    if (!termRow) {
      return [];
    }
    return parseTermDisplayMarkup(termRow.term_text);
  });

  // Single source of truth: CSV flag via store
  readonly hasAudio = computed((): boolean => {
    const term = this.selectedTerm();
    if (!term) {
      return false;
    }
    return this.editorStore.hasTermAudio(term.lang as any, term.id);
  });

  // Audio filename for terms: term_{lang}{id}.mp3
  readonly audioFilename = computed(() => {
    const term = this.selectedTerm();
    if (!term) {
      return null;
    }
    return `term_${term.lang}${term.id}.mp3`;
  });

  private getAudioPath(): string | null {
    const filename = this.audioFilename();
    if (!filename) {
      return null;
    }
    return `${this.TTS_SERVER_URL}/sounds/${filename}`;
  }

  ngOnDestroy() {
    this.stopAudio();
    this.stopLinkedTermAudio();
  }

  private canPlaySelected(): boolean {
    return this.hasAudio();
  }

  playAudio() {
    if (!this.canPlaySelected()) {
      return;
    }

    const path = this.getAudioPath();
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
    const term = this.selectedTerm();
    if (currentTermId == null || !term) {
      return;
    }

    this.isGenerating.set(true);
    this.generateError.set(null);

    const result = await this.ttsService.generateTermAudio(currentTermId);

    this.isGenerating.set(false);

    if (result.success) {
      this.editorStore.markTermAudioGenerated(term.lang as any, currentTermId);
      setTimeout(() => this.playAudio(), 100);
    } else {
      this.generateError.set(result.error ?? 'Unbekannter Fehler');
    }
  }

  get ttsServerAvailable() {
    return this.ttsService.serverAvailable();
  }

  getLinkedTermAudioPath(termId: number, lang: string): string {
    const filename = `term_${lang}${termId}.mp3`;
    return `${this.TTS_SERVER_URL}/sounds/${filename}`;
  }

  isLinkedTermAudioExists(termId: number): boolean {
    const term = this.editorStore.termById().get(termId) ?? null;
    if (!term) {
      return false;
    }
    return this.editorStore.hasTermAudio(term.lang as any, term.id);
  }

  isLinkedTermPlaying(termId: number): boolean {
    return this.linkedTermPlaying() === termId;
  }

  isLinkedTermGenerating(termId: number): boolean {
    return this.linkedTermGenerating() === termId;
  }

  playLinkedTermAudio(termId: number, lang: string) {
    if (!this.isLinkedTermAudioExists(termId)) {
      return;
    }

    this.stopLinkedTermAudio();

    const path = this.getLinkedTermAudioPath(termId, lang);
    this.linkedAudioElement = new Audio(path);
    this.linkedAudioElement.onplay = () => this.linkedTermPlaying.set(termId);
    this.linkedAudioElement.onended = () => this.linkedTermPlaying.set(null);
    this.linkedAudioElement.onpause = () => this.linkedTermPlaying.set(null);
    this.linkedAudioElement.onerror = () => {
      this.linkedTermPlaying.set(null);
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
      this.editorStore.markTermAudioGenerated(lang as any, termId);
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
    return this.linkedTerms().map((linkedTerm) => ({
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

    const alreadyLinkedTermIds = this.editorStore.getLinkedTermIds(termRow.id, termRow.lang);
    return [termRow.id, ...alreadyLinkedTermIds];
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

  readonly tagsDisplay = computed(() => {
    const termRow = this.selectedTerm();
    if (!termRow?.tags) {
      return '';
    }
    return termRow.tags.join(', ');
  });

  updateTerm(patch: Partial<TermRow>) {
    const selectedTermId = this.termId();
    if (selectedTermId == null) {
      return;
    }
    this.editorStore.updateTerm(selectedTermId, patch);
  }

  onTagsChanged(value: string) {
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    this.updateTerm({ tags: tags.length > 0 ? tags : undefined });
  }

  removeTag(tagToRemove: string) {
    const termRow = this.selectedTerm();
    if (!termRow?.tags) {
      return;
    }
    const newTags = termRow.tags.filter((tag) => tag !== tagToRemove);
    this.updateTerm({ tags: newTags.length > 0 ? newTags : undefined });
  }

  onCategoryChanged(newCategory: string) {
    const normalizedCategory = (newCategory || undefined) as TermCategory | undefined;

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
    const normalizedDisplay = (displayValue ?? '').trim().toLowerCase();
    const firstCharacter = normalizedDisplay[0];
    const beginsWithVowel = !!firstCharacter && 'aeiouyh'.includes(firstCharacter);

    this.updateTerm({
      needsVowelArticle: beginsWithVowel,
    });
  }

  openTranslationOverlay(mouseEvent: MouseEvent) {
    mouseEvent.stopPropagation();

    const panelWidth = 520;
    const panelHeight = 520;
    const padding = 12;

    const anchorRect = (mouseEvent.currentTarget as HTMLElement).getBoundingClientRect();

    const targetLeft = Math.max(
      padding,
      Math.min(anchorRect.left, window.innerWidth - panelWidth - padding),
    );

    const targetTop = Math.max(
      padding,
      Math.min(anchorRect.bottom + 8, window.innerHeight - panelHeight - padding),
    );

    this.translationOverlayPosition.set({ x: targetLeft, y: targetTop });
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

    this.editorStore.addLinkBetween(baseTermRow, selectedTermRow);
    this.closeTranslationOverlay();
  }

  removeTranslation(linkedTermRow: TermRow) {
    const baseTermRow = this.selectedTerm();
    if (!baseTermRow) {
      return;
    }
    this.editorStore.removeLinkBetween(baseTermRow, linkedTermRow);
  }

  @HostListener('document:keydown', ['$event'])
  onEscapeKeyPressed(keyboardEvent: KeyboardEvent) {
    if (keyboardEvent.key === 'Escape') {
      this.closeTranslationOverlay();
    }
  }

  protected readonly getArticle = getArticle;
}
