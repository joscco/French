import {CommonModule} from '@angular/common';
import {Component, computed, HostListener, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {EditorStore} from '../../services/editor-store.service';
import {Lang, TermRow} from '../../../../shared/contract/contract';
import {TermPickerComponent} from '../term-picker/term-picker.component';
import {TermEditorComponent} from '../term-editor/term-editor.component';

type OverlayPosition = { x: number; y: number };

type SortKey = 'id' | 'display' | 'count';

@Component({
  standalone: true,
  selector: 'app-all-terms-translations',
  imports: [CommonModule, FormsModule, TermPickerComponent, TermEditorComponent],
  templateUrl: './all-terms-translations.component.html',
})
export class AllTermsTranslationsComponent {
  private readonly store = inject(EditorStore);

  // filters
  query = signal('');
  showMissingOnly = signal(false);
  languageFilter = signal<Lang | 'all'>('all');
  sortKey = signal<SortKey>('count');

  // selection / expand
  selectedTermId = signal<number | null>(null);
  expandedTermIds = signal<Set<number>>(new Set<number>());

  // overlay add-translation
  overlayOpen = signal(false);
  overlayPos = signal<OverlayPosition>({ x: 24, y: 24 });
  overlayBaseTermId = signal<number | null>(null);

  readonly terms = this.store.terms;
  readonly termById = this.store.termById;

  private normalizeSearchText(value: string): string {
    return (value ?? '')
      .replace(/[\u2018\u2019]/g, "'")
      .trim()
      .toLowerCase();
  }

  reverseLanguage(termLanguage: Lang): Lang {
    return (termLanguage === 'fr') ? 'de' : 'fr';
  }

  getTranslationCount(termRow: TermRow): number {
    return this.store.getTranslationCount(termRow.id, termRow.lang);
  }

  getLinkedTerms(termRow: TermRow): TermRow[] {
    return this.store.getLinkedTerms(termRow.id, termRow.lang);
  }

  filteredTerms = computed(() => {
    const selectedLanguage = this.languageFilter();
    const normalizedQuery = this.normalizeSearchText(this.query());
    const missingOnly = this.showMissingOnly();

    const allTerms = this.terms();

    let visibleTerms = allTerms;

    if (selectedLanguage !== 'all') {
      visibleTerms = visibleTerms.filter((termRow) => termRow.lang === selectedLanguage);
    }

    if (missingOnly) {
      visibleTerms = visibleTerms.filter((termRow) => this.getTranslationCount(termRow) === 0);
    }

    if (normalizedQuery.length > 0) {
      visibleTerms = visibleTerms.filter((termRow) => {
        const searchableText = this.normalizeSearchText(
          `${termRow.display} ${termRow.lemma ?? ''} ${(termRow.tags ?? []).join(' ')}`
        );
        return searchableText.includes(normalizedQuery);
      });
    }

    const sortKey = this.sortKey();
    const sortedTerms = [...visibleTerms].sort((leftTerm, rightTerm) => {
      if (sortKey === 'id') {
        return leftTerm.id - rightTerm.id;
      }
      if (sortKey === 'display') {
        return (leftTerm.display ?? '').localeCompare(rightTerm.display ?? '') || (leftTerm.id - rightTerm.id);
      }

      // count desc
      const leftCount = this.getTranslationCount(leftTerm);
      const rightCount = this.getTranslationCount(rightTerm);
      return (rightCount - leftCount) || (leftTerm.id - rightTerm.id);
    });

    return sortedTerms;
  });

  isExpanded(termId: number): boolean {
    return this.expandedTermIds().has(termId);
  }

  toggleExpanded(termId: number) {
    const currentSet = new Set(this.expandedTermIds());
    if (currentSet.has(termId)) {
      currentSet.delete(termId);
    } else {
      currentSet.add(termId);
    }
    this.expandedTermIds.set(currentSet);
  }

  selectTerm(termId: number) {
    this.selectedTermId.set(termId);
  }


  openAddOverlay(anchorEvent: MouseEvent, baseTermId: number) {
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

    this.overlayPos.set({ x: clampedLeftPx, y: clampedTopPx });
    this.overlayBaseTermId.set(baseTermId);
    this.overlayOpen.set(true);
  }

  closeOverlay() {
    this.overlayOpen.set(false);
    this.overlayBaseTermId.set(null);
  }

  selectLinkedTerm(linkedTermId: number) {
    this.selectedTermId.set(linkedTermId);
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(keyboardEvent: KeyboardEvent) {
    if (keyboardEvent.key === 'Escape') {
      this.closeOverlay();
    }
  }

  onChooseTranslation(chosenTerm: TermRow) {
    const baseTermId = this.overlayBaseTermId();
    if (baseTermId == null) {
      return;
    }

    const baseTermRow = this.termById().get(baseTermId);
    if (!baseTermRow) {
      return;
    }

    // enforce cross-language
    if (baseTermRow.lang === chosenTerm.lang) {
      return;
    }

    this.store.addLinkBetween(baseTermRow, chosenTerm);
    this.selectTerm(baseTermRow.id);
    this.toggleExpanded(baseTermRow.id);
    this.closeOverlay();
  }

  removeTranslation(baseTermRow: TermRow, linkedTermRow: TermRow) {
    this.store.removeLinkBetween(baseTermRow, linkedTermRow);
  }
}
