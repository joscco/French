import {CommonModule} from '@angular/common';
import {Component, computed, HostListener, inject, input, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {EditorStore} from '../../services/editor-store.service';
import {Genus, Lang, TermCategory, TermRow} from '../../../../shared/contract/contract';
import {beautifyGenus, getArticle, reverseLanguage} from '../../../app/helpers/utils';
import {TermPickerComponent} from '../term-picker/term-picker.component';

type OverlayPosition = { x: number; y: number };

@Component({
  standalone: true,
  selector: 'app-term-editor',
  imports: [CommonModule, FormsModule, TermPickerComponent],
  templateUrl: './term-editor.component.html',
})
export class TermEditorComponent {
  private readonly store = inject(EditorStore);

  termId = input<number | null>(null);

  // --- UI state for translations overlay
  translationOverlayOpen = signal(false);
  translationOverlayPos = signal<OverlayPosition>({ x: 24, y: 24 });

  categories: TermCategory[] = ['verb', 'noun', 'expression', 'adjective', 'other'];

  categoryLabel: Record<TermCategory, string> = {
    verb: 'Verb',
    noun: 'Noun',
    expression: 'Expression',
    adjective: 'Adjective',
    other: 'Other',
  };

  genusOptions: Array<{ value: Genus; label: string }> = [
    { value: 'm', label: 'Masculine (m)' },
    { value: 'f', label: 'Feminine (f)' },
    { value: 'n', label: 'Neuter (n)' },
    { value: 'mpl', label: 'Plural masc. (mpl)' },
    { value: 'fpl', label: 'Plural fem. (fpl)' },
  ];

  term = computed((): TermRow | null => {
    const selectedTermId = this.termId();
    if (selectedTermId == null) {
      return null;
    }
    return this.store.terms().find((termRow) => termRow.id === selectedTermId) ?? null;
  });

  linkedTerms = computed((): TermRow[] => {
    const baseTermRow = this.term();
    if (!baseTermRow) {
      return [];
    }
    return this.store.getLinkedTerms(baseTermRow.id, baseTermRow.lang);
  });

  excludedTranslationIds = computed((): number[] => {
    const baseTermRow = this.term();
    if (!baseTermRow) {
      return [];
    }

    const alreadyLinked = this.store.getLinkedTermIds(baseTermRow.id, baseTermRow.lang);
    // exclude self too (paranoia)
    return [baseTermRow.id, ...alreadyLinked];
  });

  oppositeLanguage = computed<Lang | null>(() => {
    const baseTermRow = this.term();
    if (!baseTermRow) {
      return null;
    }
    return reverseLanguage(baseTermRow.lang);
  });

  isNoun(termRow: TermRow): boolean {
    return (termRow.category ?? '') === 'noun';
  }

  onCategoryChange(value: string) {
    const category = (value || undefined) as TermCategory | undefined;

    if (category !== 'noun') {
      this.commit({ category, genus: undefined });
      return;
    }

    this.commit({ category });
  }

  commit(patch: Partial<TermRow>) {
    const currentTermId = this.termId();
    if (currentTermId == null) {
      return;
    }
    this.store.updateTerm(currentTermId, patch);
  }

  autoGuessVowel(display: string) {
    const normalized = (display || '').trim().toLowerCase();
    const firstChar = normalized[0];
    const guess = !!firstChar && 'aeiouyh'.includes(firstChar);
    this.commit({ needsVowelArticle: guess });
  }

  openTranslationOverlay(anchorEvent: MouseEvent) {
    anchorEvent.stopPropagation();

    const panelWidthPx = 520;
    const estimatedPanelHeightPx = 520;
    const viewportPaddingPx = 12;

    let proposedLeftPx = Math.round(anchorEvent.clientX);
    let proposedTopPx = Math.round(anchorEvent.clientY + 12);

    const anchorElement = anchorEvent.currentTarget as HTMLElement | null;
    if (anchorElement) {
      const anchorRect = anchorElement.getBoundingClientRect();
      proposedLeftPx = Math.round(anchorRect.left);
      proposedTopPx = Math.round(anchorRect.bottom + 8);
    }

    const minLeftPx = viewportPaddingPx;
    const maxLeftPx = window.innerWidth - panelWidthPx - viewportPaddingPx;
    const clampedLeftPx = Math.max(minLeftPx, Math.min(proposedLeftPx, maxLeftPx));

    const minTopPx = viewportPaddingPx;
    const maxTopPx = window.innerHeight - estimatedPanelHeightPx - viewportPaddingPx;
    const clampedTopPx = Math.max(minTopPx, Math.min(proposedTopPx, maxTopPx));

    this.translationOverlayPos.set({ x: clampedLeftPx, y: clampedTopPx });
    this.translationOverlayOpen.set(true);
  }

  closeTranslationOverlay() {
    this.translationOverlayOpen.set(false);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(keyboardEvent: KeyboardEvent) {
    if (keyboardEvent.key === 'Escape') {
      this.closeTranslationOverlay();
    }
  }

  onChooseTranslation(selectedTermRow: TermRow) {
    const baseTermRow = this.term();
    if (!baseTermRow) {
      return;
    }

    if (baseTermRow.lang === selectedTermRow.lang) {
      return;
    }

    this.store.addLinkBetween(baseTermRow, selectedTermRow);
    this.closeTranslationOverlay();
  }

  removeTranslation(linkedTermRow: TermRow) {
    const baseTermRow = this.term();
    if (!baseTermRow) {
      return;
    }
    this.store.removeLinkBetween(baseTermRow, linkedTermRow);
  }

  protected readonly beautifyGenus = beautifyGenus;
  protected readonly getArticle = getArticle;
}
