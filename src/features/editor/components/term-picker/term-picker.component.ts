import {Component, computed, inject, signal, input, output, effect} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {Lang, TermCategory, TermRow} from '../../../../shared/contract/contract';
import {EditorStore} from '../../services/editor-store.service';

@Component({
  standalone: true,
  selector: 'app-term-picker',
  imports: [FormsModule],
  templateUrl: './term-picker.component.html',
})
export class TermPickerComponent {
  private readonly store = inject(EditorStore);

  lang = input.required<Lang>();
  suggestedDisplay = input<string | null>(null);
  choose = output<TermRow>();

  query = signal('');
  category = signal<'' | TermCategory>('');
  newCategory = signal<'' | TermCategory>('');
  searchQuery = signal('');
  quickCreateDisplay = signal('');

  categories: TermCategory[] = ['verb', 'noun', 'expression', 'adjective', 'other'];

  constructor() {
    effect(() => {
      const suggestedValue = (this.suggestedDisplay() ?? '').trim();
      const currentValue = (this.quickCreateDisplay() ?? '').trim();

      if ((suggestedValue.length > 0) && (currentValue.length === 0)) {
        this.quickCreateDisplay.set(suggestedValue);
      }

      // Optional: auch das Suchfeld vorbefüllen
      const currentSearchQuery = (this.searchQuery() ?? '').trim();
      if ((suggestedValue.length > 0) && (currentSearchQuery.length === 0)) {
        this.searchQuery.set(suggestedValue);
      }
    });
  }

  excludeIds = input<number[] | null>(null);

  results = computed(() => {
    const baseResults = this.store.searchTerms(this.lang(), this.query());
    const selectedCategory = this.category();
    const excludedIds = new Set<number>(this.excludeIds() ?? []);

    let visibleResults = baseResults;

    if (selectedCategory) {
      visibleResults = visibleResults.filter((termRow) => termRow.category === selectedCategory);
    }

    visibleResults = visibleResults.filter((termRow) => !excludedIds.has(termRow.id));

    return visibleResults;
  });

  create() {
    const display = this.quickCreateDisplay().trim();
    if (!display) return;

    const term = this.store.createTerm({
      lang: this.lang(),
      display,
      category: (this.newCategory() || undefined) as any,
    });

    this.choose.emit(term);
    this.quickCreateDisplay.set('');
    this.newCategory.set('');
    this.query.set('');
  }
}
