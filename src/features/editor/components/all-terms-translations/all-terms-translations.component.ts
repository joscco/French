import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { EditorStore } from '../../services/editor-store.service';
import { Lang, TermRow } from '../../../../shared/contract/contract';
import { TermEditorComponent } from '../term-editor/term-editor.component';

type SortKey = 'id' | 'display' | 'count';

@Component({
  standalone: true,
  selector: 'app-all-terms-translations',
  imports: [CommonModule, FormsModule, TermEditorComponent],
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

  readonly terms = this.store.terms;

  private normalizeSearchText(value: string): string {
    return (value ?? '')
      .replace(/[\u2018\u2019]/g, "'")
      .trim()
      .toLowerCase();
  }

  reverseLanguage(termLanguage: Lang): Lang {
    return termLanguage === 'fr' ? 'de' : 'fr';
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
          `${termRow.display} ${termRow.lemma ?? ''} ${(termRow.tags ?? []).join(' ')}`
        );
        return searchableText.includes(normalizedQuery);
      });
    }

    const selectedSortKey = this.sortKey();
    return [...visibleTerms].sort((leftTerm, rightTerm) => {
      if (selectedSortKey === 'id') {
        return leftTerm.id - rightTerm.id;
      }
      if (selectedSortKey === 'display') {
        return (leftTerm.display ?? '').localeCompare(rightTerm.display ?? '') || (leftTerm.id - rightTerm.id);
      }

      const leftCount = this.getTranslationCount(leftTerm);
      const rightCount = this.getTranslationCount(rightTerm);
      return (rightCount - leftCount) || (leftTerm.id - rightTerm.id);
    });
  });

  isExpanded(termId: number): boolean {
    return this.expandedTermIds().has(termId);
  }

  toggleExpanded(termId: number) {
    const nextExpanded = new Set(this.expandedTermIds());
    if (nextExpanded.has(termId)) {
      nextExpanded.delete(termId);
    } else {
      nextExpanded.add(termId);
    }
    this.expandedTermIds.set(nextExpanded);
  }

  selectTerm(termId: number) {
    this.selectedTermId.set(termId);
  }

  selectLinkedTerm(linkedTermId: number) {
    this.selectedTermId.set(linkedTermId);
  }

  removeTranslation(baseTermRow: TermRow, linkedTermRow: TermRow) {
    this.store.removeLinkBetween(baseTermRow, linkedTermRow);
  }
}
