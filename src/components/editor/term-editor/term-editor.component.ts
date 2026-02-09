import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStore } from '../../../services/editor-store.service';
import { Term, TermCategory } from '../../../models/editor-model';
import {beautifyGenus, getArticle} from '../../../helpers/utils';

@Component({
  standalone: true,
  selector: 'app-term-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './term-editor.component.html',
})
export class TermEditorComponent {
  private readonly store = inject(EditorStore);
  termId = input<number | null>(null);

  categories: TermCategory[] = ['verbe', 'nom', 'expression', 'adjectif', 'autre'];

  categoryLabel: Record<TermCategory, string> = {
    verbe: 'Verb',
    nom: 'Noun',
    expression: 'Expression',
    adjectif: 'Adjective',
    autre: 'Other',
  };

  term = computed((): Term | null => {
    const id = this.termId();
    if (id == null) {
      return null;
    }
    return this.store.terms().find((term) => term.id === id) ?? null;
  });

  isNoun(term: Term): boolean {
    return (term.category ?? '') === 'nom';
  }

  onCategoryChange(value: string) {
    const category = (value || undefined) as TermCategory | undefined;

    // ✅ if category changes away from noun, clear genus to keep data clean
    if (category !== 'nom') {
      this.commit({ category: category, genus: undefined });
      return;
    }

    this.commit({ category: category });
  }

  commit(patch: Partial<Term>) {
    const id = this.termId();
    if (id == null) {
      return;
    }
    this.store.updateTerm(id, patch);
  }

  autoGuessVowel(display: string) {
    const normalizedDisplay = (display || '').trim().toLowerCase();
    const firstChar = normalizedDisplay[0];
    const needsVowelArticle = !!firstChar && 'aeiouyh'.includes(firstChar);
    this.commit({ needsVowelArticle: needsVowelArticle });
  }

  protected readonly beautifyGender = beautifyGenus;
  protected readonly getArticle = getArticle;
}
