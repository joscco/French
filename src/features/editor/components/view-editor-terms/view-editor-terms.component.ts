import {CommonModule} from '@angular/common';
import {Component, computed, ElementRef, HostListener, inject, signal, ViewChild} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {EditorStore} from '../../services/editor-store.service';
import {Lang, TermRow} from '../../../../shared/contract/contract';
import {getArticle} from '../../../app/helpers/utils';
import {getSortableText, parseTermDisplayMarkup} from '../../../../shared/helpers/term-display-markup';
import {normalizeForCheck} from '../../../app/helpers/normalize';
import {MatIcon} from '@angular/material/icon';
import {TermEditorComponent} from '../shared/term-editor/term-editor.component';

type SortKey = 'id' | 'display' | 'count';

@Component({
  standalone: true,
  selector: 'app-all-terms-translations',
  imports: [CommonModule, FormsModule, TermEditorComponent, MatIcon],
  templateUrl: './view-editor-terms.component.html',
})
export class ViewEditorTermsComponent {
  private readonly store = inject(EditorStore);

  // filters
  query = signal('');
  showMissingTranslationOnly = signal(false);
  showMissingAudioOnly = signal(false);
  showIncompleteOnly = signal(false);
  languageFilter = signal<Lang | 'all'>('all');
  sortKey = signal<SortKey>('display');

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
    const missingOnly = this.showMissingTranslationOnly();
    const missingAudioOnly = this.showMissingAudioOnly();
    const incompleteOnly = this.showIncompleteOnly();

    let visibleTerms = this.terms();

    if (selectedLanguage !== 'all') {
      visibleTerms = visibleTerms.filter((termRow) => termRow.lang === selectedLanguage);
    }

    if (missingOnly) {
      visibleTerms = visibleTerms.filter((termRow) => this.getTranslationCount(termRow) === 0);
    }

    if (missingAudioOnly) {
      visibleTerms = visibleTerms.filter((termRow) => !termRow.has_audio);
    }

    if (incompleteOnly) {
      visibleTerms = visibleTerms.filter((termRow) => this.isInvalidTerm(termRow));
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

    // Pfeiltasten und ASDW
    if (keyboardEvent.key === 'ArrowDown' || keyboardEvent.key.toLowerCase() === 's') {
      keyboardEvent.preventDefault();
      this.setSelectionByOffset(+1);
      return;
    }

    if (keyboardEvent.key === 'ArrowUp' || keyboardEvent.key.toLowerCase() === 'w') {
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

  // Multiselect für Term-Merge
  selectedTermIds = signal<Set<number>>(new Set());

  toggleTermSelection(termId: number) {
    const set = new Set(this.selectedTermIds());
    if (set.has(termId)) {
      set.delete(termId);
    } else {
      set.add(termId);
    }
    this.selectedTermIds.set(set);
  }

  clearTermSelection() {
    this.selectedTermIds.set(new Set());
  }

  async mergeSelectedTerms() {
    const ids = Array.from(this.selectedTermIds());
    if (ids.length < 2) return;
    if (!confirm(`Merge ${ids.length} terms? This cannot be undone.`)) return;
    const response = await fetch('http://localhost:3001/merge/terms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term_ids: ids }),
    });
    if (response.ok) {
      await this.store.loadAll();
      this.clearTermSelection();
      alert('Terms merged!');
    } else {
      alert('Merge failed: ' + (await response.text()));
    }
  }

  areAllFilteredTermsSelected(): boolean {
    const filtered = this.filteredTerms();
    if (filtered.length === 0) return false;
    const selected = this.selectedTermIds();
    return filtered.every(term => selected.has(term.id));
  }

  toggleSelectAllFilteredTerms(checked: boolean) {
    if (checked) {
      const set = new Set(this.filteredTerms().map(term => term.id));
      this.selectedTermIds.set(set);
    } else {
      this.selectedTermIds.set(new Set());
    }
  }

  handleSelectAllCheckboxChange(event: Event) {
    const checked = (event.target && (event.target as HTMLInputElement).checked) || false;
    this.toggleSelectAllFilteredTerms(checked);
  }

  protected readonly parseTermDisplayMarkup = parseTermDisplayMarkup;
}
