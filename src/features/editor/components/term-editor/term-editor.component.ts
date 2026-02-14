import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { EditorStore} from '../../services/editor-store.service'; // <- anpassen, falls Pfad anders
import {TermCategory, Genus, TermRow} from '../../../../shared/contract/contract'; // <- oder aus deinem store/contract
import { beautifyGenus, getArticle } from '../../../app/helpers/utils';     // <- getArticle wirklich exportieren

@Component({
  standalone: true,
  selector: 'app-term-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './term-editor.component.html',
})
export class TermEditorComponent {
  private readonly store = inject(EditorStore);

  termId = input<number | null>(null);

  categories: TermCategory[] = ['verb', 'noun', 'expression', 'adjective', 'other'];

  categoryLabel: Record<TermCategory, string> = {
    verb: 'Verb',
    noun: 'Noun',
    expression: 'Expression',
    adjective: 'Adjective',
    other: 'Other',
  };

  // wenn du mehr Genus-Varianten brauchst, hier ergänzen
  genusOptions: Array<{ value: Genus; label: string }> = [
    { value: 'm', label: 'Masculine (m)' },
    { value: 'f', label: 'Feminine (f)' },
    { value: 'n', label: 'Neuter (n)' },
    { value: 'mpl', label: 'Plural masc. (mpl)' },
    { value: 'fpl', label: 'Plural fem. (fpl)' },
    // falls du das nutzt:
    // { value: 'npl', label: 'Plural neut. (npl)' },
  ];

  term = computed((): TermRow | null => {
    const id = this.termId();
    if (id == null) return null;
    return this.store.terms().find(t => t.id === id) ?? null;
  });

  isNoun(term: TermRow): boolean {
    return (term.category ?? '') === 'noun';
  }

  onCategoryChange(value: string) {
    const category = (value || undefined) as TermCategory | undefined;

    // wenn weg von noun -> genus leeren
    if (category !== 'noun') {
      this.commit({ category, genus: undefined });
      return;
    }
    this.commit({ category });
  }

  commit(patch: Partial<TermRow>) {
    const id = this.termId();
    if (id == null) return;
    this.store.updateTerm(id, patch);
  }

  autoGuessVowel(display: string) {
    const s = (display || '').trim().toLowerCase();
    const first = s[0];
    const guess = !!first && 'aeiouyh'.includes(first);
    this.commit({ needsVowelArticle: guess });
  }

  protected readonly beautifyGenus = beautifyGenus;
  protected readonly getArticle = getArticle;
}
