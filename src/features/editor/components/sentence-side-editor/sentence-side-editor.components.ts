import { Component, computed, HostListener, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TermPickerComponent } from '../term-picker/term-picker.component';
import { EditorStore } from '../../services/editor-store.service';
import { Lang, TermRow } from '../../../../shared/contract/contract';
import {
  parseSentenceMarkup,
  PreviewSeg,
  previewSegments,
  replaceFirstExact,
  representativeText,
} from '../../helpers/sentence-markup';

type OverlayPosition = { x: number; y: number };

@Component({
  standalone: true,
  selector: 'app-sentence-side-editor',
  imports: [CommonModule, FormsModule, TermPickerComponent],
  templateUrl: './sentence-side-editor.component.html',
})
export class SentenceSideEditorComponent {
  private readonly store = inject(EditorStore);

  sentenceId = input.required<number>();
  lang = input.required<Lang>();
  selectedTermId = input<number | null>(null);

  editTerm = output<number>();

  // Overlay state
  overlayOpen = signal(false);
  overlayPos = signal<OverlayPosition>({ x: 12, y: 12 });

  pendingAnnRaw = signal<string | null>(null);     // e.g. "{pomme}"
  pendingSurface = signal<string | null>(null);    // e.g. "pomme"

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
    const estimatedPanelHeightPx = 480; // rough estimate; the HTML also has max-height as fallback
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
