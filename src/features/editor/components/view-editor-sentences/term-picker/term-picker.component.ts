import {Component, computed, effect, inject, input, output, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {Lang, TermCategory, TermRow} from '../../../../../shared/contract/contract';
import {EditorStore} from '../../../services/editor-store.service';

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
  excludeIds = input<number[] | null>(null);
  choose = output<TermRow>();

  // Search
  query = signal('');
  category = signal<'' | TermCategory>('');

  // Quick create
  newCategory = signal<'' | TermCategory>('');
  quickCreateDisplay = signal('');

  // “Don’t fight the user” flags
  private lastAppliedSuggestion = signal<string>('');
  private isSearchDirty = signal(false);
  private isQuickCreateDirty = signal(false);

  categories: TermCategory[] = ['verb', 'noun', 'expression', 'adjective', 'other'];

  constructor() {
    effect(() => {
      const suggestedValue = (this.suggestedDisplay() ?? '').trim();
      if (!suggestedValue) {
        return;
      }

      // only apply once per suggestion value (prevents re-filling after user cleared)
      if (this.lastAppliedSuggestion() === suggestedValue) {
        return;
      }
      this.lastAppliedSuggestion.set(suggestedValue);

      if (!this.isQuickCreateDirty() && !(this.quickCreateDisplay() ?? '').trim()) {
        this.quickCreateDisplay.set(suggestedValue);
      }
    });
  }

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

  onQueryChange(value: string) {
    this.isSearchDirty.set(true);
    this.query.set(value);
  }

  onQuickCreateDisplayChange(value: string) {
    this.isQuickCreateDirty.set(true);
    this.quickCreateDisplay.set(value);
  }

  create() {
    const termText = this.quickCreateDisplay().trim();
    if (!termText) {
      return;
    }

    const term = this.store.createTerm({
      lang: this.lang(),
      term_text: termText,
      category: (this.newCategory() || undefined) as any,
      has_audio: false,
    });

    this.choose.emit(term);

    // reset create state
    this.quickCreateDisplay.set('');
    this.newCategory.set('');

    // keep search query by default (nice for batch work),
    // but allow suggestion to apply again next time if a new suggestedDisplay comes in
    this.isQuickCreateDirty.set(false);

    // optional: if you prefer also resetting search:
    // this.query.set('');
    // this.isSearchDirty.set(false);
  }
}
