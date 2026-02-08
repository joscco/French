// ... imports bleiben gleich
import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStore } from '../../services/editor-store.service';
import { Term, TermCategory } from '../../models/editor-model';

@Component({
  standalone: true,
  selector: 'app-term-editor',
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="term() as t; else empty" class="rounded-2xl border border-slate-200 bg-white p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            Term #{{ t.id }}
          </div>
          <div class="mt-1 text-lg font-black text-slate-900">
            {{ t.display }}
          </div>
          <div class="mt-1 text-sm text-slate-600">
            {{ t.lang.toUpperCase() }}
          </div>
        </div>
      </div>

      <div class="mt-4 space-y-3">
        <label class="block">
          <div class="mb-1 text-xs font-semibold text-slate-600">Display</div>
          <input
            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            [ngModel]="t.display"
            (ngModelChange)="commit({ display: $event })"
          />
        </label>

        <label class="block">
          <div class="mb-1 text-xs font-semibold text-slate-600">Lemma (optional)</div>
          <input
            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            [ngModel]="t.lemma ?? ''"
            (ngModelChange)="commit({ lemma: ($event || '').trim() ? $event : undefined })"
          />
        </label>

        <label class="block">
          <div class="mb-1 text-xs font-semibold text-slate-600">Category</div>
          <select
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
            [ngModel]="t.category ?? ''"
            (ngModelChange)="onCategoryChange($event)"
          >
            <option value="">(none)</option>
            <option *ngFor="let c of categories" [value]="c">{{ categoryLabel[c] }}</option>
          </select>
        </label>

        <!-- ✅ Genus: only for nouns -->
        <label class="block">
          <div class="mb-1 text-xs font-semibold text-slate-600">
            Gender (only for nouns)
          </div>

          <input
            class="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-slate-400"
            [ngClass]="isNoun(t) ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100 text-slate-400'"
            [disabled]="!isNoun(t)"
            [ngModel]="t.genus ?? ''"
            (ngModelChange)="commit({ genus: ($event || '').trim() ? $event : undefined })"
            placeholder="m / f / n …"
          />

          <div *ngIf="!isNoun(t)" class="mt-1 text-xs text-slate-500">
            Set category to <span class="font-semibold">Noun</span> to edit gender.
          </div>
        </label>

        <div *ngIf="t.lang === 'fr'"
             class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div>
            <div class="text-sm font-semibold text-slate-900">needsVowelArticle</div>
            <div class="text-xs text-slate-600">
              l’ … statt le/la … (Heuristik verfügbar)
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold hover:bg-slate-50"
              (click)="autoGuessVowel(t.display)"
            >
              Auto
            </button>

            <input
              type="checkbox"
              class="h-4 w-4"
              [ngModel]="t.needsVowelArticle ?? false"
              (ngModelChange)="commit({ needsVowelArticle: $event })"
            />
          </div>
        </div>
      </div>
    </div>

    <ng-template #empty>
      <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
        Click an annotation (or a highlighted word) to edit the linked term here.
      </div>
    </ng-template>
  `,
})
export class TermEditorComponent {
  private readonly store = inject(EditorStore);
  termId = input<number | null>(null);

  // keep internal values (FR) but show EN labels
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
    if (id == null) return null;
    return this.store.terms().find((t) => t.id === id) ?? null;
  });

  isNoun(t: Term): boolean {
    return (t.category ?? '') === 'nom';
  }

  onCategoryChange(value: string) {
    const cat = (value || undefined) as TermCategory | undefined;

    // ✅ if category changes away from noun, clear genus to keep data clean
    if (cat !== 'nom') {
      this.commit({ category: cat, genus: undefined });
      return;
    }

    this.commit({ category: cat });
  }

  commit(patch: Partial<Term>) {
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
}
