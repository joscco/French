import {CommonModule} from '@angular/common';
import {Component, computed, ElementRef, HostListener, inject, signal, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {EditorStore} from '../../services/editor-store.service';
import {Lang, TermRow} from '../../../../shared/contract/contract';
import {TermEditorComponent} from '../term-editor/term-editor.component';
import {getArticle} from '../../../app/helpers/utils';
import {getSortableText, parseTermDisplayMarkup} from '../../../../shared/helpers/term-display-markup';
import {normalizeForCheck} from '../../../app/helpers/normalize';
import {MatIcon} from '@angular/material/icon';

type SortKey = 'id' | 'display' | 'count';

@Component({
  standalone: true,
  selector: 'app-all-terms-translations',
  imports: [CommonModule, FormsModule, TermEditorComponent, MatIcon],
  templateUrl: './terms-table.component.html',
})
export class TermsTableComponent {
  private readonly store = inject(EditorStore);

  // filters
  query = signal('');
  showMissingOnly = signal(false);
  languageFilter = signal<Lang | 'all'>('all');
  sortKey = signal<SortKey>('count');

  selectedTermId = signal<number | null>(null);

  isNoun(termRow: TermRow): boolean {
    return (termRow.category ?? '') === 'noun';
  }

  getTermArticle(termRow: TermRow): string {
    if (!this.isNoun(termRow) || !termRow.genus) {
      return '';
    }
    return getArticle(termRow.lang, termRow.genus, termRow.needsVowelArticle ?? false);
  }

  readonly terms = this.store.terms;

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  private normalizeSearchText(value: string): string {
    return normalizeForCheck(value);
  }

  getTranslationCount(termRow: TermRow): number {
    return this.store.getTranslationCount(termRow.id, termRow.lang);
  }

  isInvalidTerm(termRow: TermRow): boolean {
    const categoryMissing = !(termRow.category ?? '').trim();
    const isNoun = (termRow.category ?? '') === 'noun';
    const genusMissing = isNoun && !(termRow.genus ?? '').trim();
    return categoryMissing || genusMissing;
  }

  filteredTerms = computed(() => {
    const selectedLanguage = this.languageFilter();
    const normalizedQuery = this.normalizeSearchText(this.query());
    const missingOnly = this.showMissingOnly();

    let visibleTerms = this.terms();

    if (selectedLanguage !== 'all') {
      visibleTerms = visibleTerms.filter((termRow) => termRow.lang === selectedLanguage);
    }

    if (missingOnly) {
      visibleTerms = visibleTerms.filter((termRow) => this.getTranslationCount(termRow) === 0);
    }

    if (normalizedQuery.length > 0) {
      visibleTerms = visibleTerms.filter((termRow) => {
        const searchableText = this.normalizeSearchText(
          `${termRow.term_text} ${(termRow.tags ?? []).join(' ')}`
        );
        return searchableText.includes(normalizedQuery);
      });
    }

    const selectedSortKey = this.sortKey();
    return [...visibleTerms].sort((leftTermRow, rightTermRow) => {
      if (selectedSortKey === 'id') {
        return leftTermRow.id - rightTermRow.id;
      }
      if (selectedSortKey === 'display') {
        const leftSortText = getSortableText(leftTermRow.term_text);
        const rightSortText = getSortableText(rightTermRow.term_text);
        return leftSortText.localeCompare(rightSortText) || (leftTermRow.id - rightTermRow.id);
      }

      const leftCount = this.getTranslationCount(leftTermRow);
      const rightCount = this.getTranslationCount(rightTermRow);
      return (rightCount - leftCount) || (leftTermRow.id - rightTermRow.id);
    });
  });

  // 1) Toggle: click same row closes editor
  selectTerm(termId: number) {
    const currentSelectedTermId = this.selectedTermId();
    if (currentSelectedTermId === termId) {
      this.selectedTermId.set(null);
      return;
    }
    this.selectedTermId.set(termId);
  }

  private setSelectionByOffset(offset: number) {
    const list = this.filteredTerms();
    if (!list.length) {
      this.selectedTermId.set(null);
      return;
    }

    const currentId = this.selectedTermId();
    const currentIndex = currentId == null ? -1 : list.findIndex((termRow) => termRow.id === currentId);

    const nextIndexUnclamped = currentIndex < 0 ? (offset > 0 ? 0 : list.length - 1) : currentIndex + offset;
    const nextIndex = Math.max(0, Math.min(list.length - 1, nextIndexUnclamped));

    const nextId = list[nextIndex]?.id ?? null;
    this.selectedTermId.set(nextId);

    if (nextId != null) {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-term-row="${nextId}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: 'nearest' });
      });
    }
  }

  // 2) Keyboard workflow
  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(keyboardEvent: KeyboardEvent) {
    // don’t steal keys while typing
    const target = keyboardEvent.target as HTMLElement | null;
    const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true');
    if (isTyping) {
      return;
    }

    if (keyboardEvent.key === 'Escape') {
      this.selectedTermId.set(null);
      return;
    }

    if (keyboardEvent.key === 'ArrowDown') {
      keyboardEvent.preventDefault();
      this.setSelectionByOffset(+1);
      return;
    }

    if (keyboardEvent.key === 'ArrowUp') {
      keyboardEvent.preventDefault();
      this.setSelectionByOffset(-1);
      return;
    }

    if (keyboardEvent.key === 'Enter') {
      // Enter toggles: open first if none, close if open
      keyboardEvent.preventDefault();
      if (this.selectedTermId() != null) {
        this.selectedTermId.set(null);
      } else {
        this.setSelectionByOffset(+1);
      }
      return;
    }

    if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key.toLowerCase() === 'f') {
      // focus search instead of browser find if you want
      keyboardEvent.preventDefault();
      this.searchInput?.nativeElement?.focus();
      this.searchInput?.nativeElement?.select();
      return;
    }
  }

  protected readonly parseTermDisplayMarkup = parseTermDisplayMarkup;
}
