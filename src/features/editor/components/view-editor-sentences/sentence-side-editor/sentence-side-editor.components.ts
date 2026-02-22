import { Component, computed, effect, HostListener, inject, input, output, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TermPickerComponent } from '../term-picker/term-picker.component';
import { MatIcon } from '@angular/material/icon';
import {
  parseSentenceMarkup,
  PreviewSeg,
  previewSegments,
  replaceFirstExact,
  representativeText
} from '../../../helpers/sentence-markup';
import { EditorStore } from '../../../services/editor-store.service';
import { TTSService } from '../../../services/tts.service';
import { Lang, TermRow } from '../../../../../shared/contract/contract';

type OverlayPosition = { x: number; y: number };

@Component({
  standalone: true,
  selector: 'app-sentence-side-editor',
  imports: [CommonModule, FormsModule, TermPickerComponent, MatIcon],
  templateUrl: './sentence-side-editor.component.html',
})
export class SentenceSideEditorComponent implements OnDestroy {
  private readonly store = inject(EditorStore);
  private readonly ttsService = inject(TTSService);

  sentenceId = input.required<number>();
  lang = input.required<Lang>();
  selectedTermId = input<number | null>(null);

  editTerm = output<number>();

  // Overlay state
  overlayOpen = signal(false);
  overlayPos = signal<OverlayPosition>({ x: 12, y: 12 });

  pendingAnnRaw = signal<string | null>(null);     // e.g. "{pomme}"
  pendingSurface = signal<string | null>(null);    // e.g. "pomme"

  // Audio state
  private audioElement: HTMLAudioElement | null = null;
  isPlaying = signal(false);
  isGenerating = signal(false);
  generateError = signal<string | null>(null);

  hasAudio = computed(() => this.store.hasSentenceAudio(this.lang() as any, this.sentenceId()));

  // TTS Server URL für Audio-Dateien (umgeht Angular's File-Watcher)
  private readonly TTS_SERVER_URL = 'http://localhost:3001';

  // Derived
  sentence = computed(() => {
    const selectedSentenceId = this.sentenceId();
    return this.store.sentences().find((sentenceRow) => sentenceRow.id === selectedSentenceId) ?? null;
  });

  rawText = computed(() => {
    const currentSentence = this.sentence();
    if (!currentSentence) {
      return '';
    }

    return this.lang() === 'fr' ? currentSentence.fr : currentSentence.de;
  });

  ast = computed(() => parseSentenceMarkup(this.rawText()));
  rep = computed(() => representativeText(this.ast()));
  segs = computed(() => previewSegments(this.ast()));

  // Audio filename (for both French and German sentences)
  audioFilename = computed(() => {
    const lang = this.lang();
    const id = this.sentenceId();
    return `${lang}${id}.mp3`;
  });

  // Audio path - im Editor immer TTS-Server verwenden (umgeht Angular's File-Watcher)
  private getAudioPath(): string {
    const filename = this.audioFilename();
    // Im Editor immer TTS-Server verwenden
    return `${this.TTS_SERVER_URL}/sounds/${filename}`;
  }

  ngOnDestroy() {
    this.stopAudio();
  }

  playAudio() {
    if (!this.hasAudio()) {
      return;
    }

    const path = this.getAudioPath();
    if (!path) {
      return;
    }

    // Stop any currently playing audio
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
    this.isGenerating.set(true);
    this.generateError.set(null);

    const result = await this.ttsService.generateSentenceAudio(
      this.sentenceId(),
      this.lang()
    );

    this.isGenerating.set(false);

    if (result.success) {
      this.store.markSentenceAudioGenerated(this.lang() as any, this.sentenceId());
      setTimeout(() => this.playAudio(), 100);
    } else {
      this.generateError.set(result.error ?? 'Unbekannter Fehler');
    }
  }

  get ttsServerAvailable() {
    return this.ttsService.serverAvailable();
  }

  // =========================================================
  // Global listeners
  // =========================================================

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(keyboardEvent: KeyboardEvent) {
    if (keyboardEvent.key === 'Escape') {
      this.closeOverlay();
    }
  }

  // =========================================================
  // Editing sentence text
  // =========================================================

  setText(nextText: string) {
    const currentSentence = this.sentence();
    if (!currentSentence) {
      return;
    }

    this.store.updateSentenceText(currentSentence.id, this.lang(), nextText);
    this.closeOverlay();
  }

  // =========================================================
  // Preview interactions
  // =========================================================

  onClickAnn(annotationSegment: Extract<PreviewSeg, { kind: 'ann' }>, clickEvent: MouseEvent) {
    clickEvent.stopPropagation();

    if (annotationSegment.termId) {
      this.editTerm.emit(annotationSegment.termId);
      return;
    }

    // Unresolved -> open picker overlay
    this.pendingAnnRaw.set(annotationSegment.raw);
    this.pendingSurface.set(annotationSegment.surface);

    this.openOverlayAtClick(clickEvent);
  }

  onPickTerm(selectedTerm: TermRow) {
    const pendingRaw = this.pendingAnnRaw();
    const pendingSurface = this.pendingSurface();

    if (!pendingRaw || !pendingSurface) {
      return;
    }

    const currentSentence = this.sentence();
    if (!currentSentence) {
      return;
    }

    // Replace first exact "{surface}" with "{surface|#id}"
    const replacement = `{${pendingSurface}|#${selectedTerm.id}}`;
    const updatedText = replaceFirstExact(this.rawText(), pendingRaw, replacement);

    this.store.updateSentenceText(currentSentence.id, this.lang(), updatedText);
    this.editTerm.emit(selectedTerm.id);
    this.closeOverlay();
  }

  // =========================================================
  // Overlay positioning (viewport / fixed)
  // =========================================================

  private openOverlayAtClick(clickEvent: MouseEvent) {
    const anchorElement = clickEvent.currentTarget as HTMLElement | null;

    // Panel sizing assumptions (match your HTML)
    const panelWidthPx = 520;
    const estimatedPanelHeightPx = 520; // rough estimate; the HTML also has max-height as fallback
    const viewportPaddingPx = 12;

    // Default position: near click
    let proposedLeftPx = Math.round(clickEvent.clientX);
    let proposedTopPx = Math.round(clickEvent.clientY + 12);

    // Better: anchor to element rect if possible
    if (anchorElement) {
      const anchorRect = anchorElement.getBoundingClientRect();
      proposedLeftPx = Math.round(anchorRect.left);
      proposedTopPx = Math.round(anchorRect.bottom + 8);
    }

    // Clamp horizontally: ensure panel stays within viewport with padding on both sides
    const minLeftPx = viewportPaddingPx;
    const maxLeftPx = window.innerWidth - panelWidthPx - viewportPaddingPx;
    const clampedLeftPx = Math.max(minLeftPx, Math.min(proposedLeftPx, maxLeftPx));

    // Clamp vertically: ensure panel stays within viewport with padding on both sides
    const minTopPx = viewportPaddingPx;
    const maxTopPx = window.innerHeight - estimatedPanelHeightPx - viewportPaddingPx;
    const clampedTopPx = Math.max(minTopPx, Math.min(proposedTopPx, maxTopPx));

    this.overlayPos.set({ x: clampedLeftPx, y: clampedTopPx });
    this.overlayOpen.set(true);
  }

  closeOverlay() {
    this.overlayOpen.set(false);
    this.pendingAnnRaw.set(null);
    this.pendingSurface.set(null);
  }

  // =========================================================
  // Styling
  // =========================================================

  annClass(termId?: number) {
    const selectedId = this.selectedTermId();
    const isSelected = !!termId && selectedId === termId;

    const baseClass = termId
      ? 'border-amber-200 bg-amber-100 hover:bg-amber-200'
      : 'border-sky-200 bg-sky-100 hover:bg-sky-200';

    const selectedClass = isSelected ? 'ring-2 ring-slate-400/40' : '';

    return [baseClass, selectedClass].join(' ');
  }
}
