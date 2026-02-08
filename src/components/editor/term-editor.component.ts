import { Component, Input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStore } from '../../services/editor-store.service';
import { Term, TermCategory } from '../../models/editor-model';

@Component({
  standalone: true,
  selector: 'app-term-editor',
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="term() as t; else empty"
         class="rounded-2xl border border-slate-200 bg-white p-4">
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
            (ngModelChange)="commit({ category: $event || undefined })"
          >
            <option value="">(none)</option>
            <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
          </select>
        </label>

        <label class="block">
          <div class="mb-1 text-xs font-semibold text-slate-600">Genus (optional)</div>
          <input
            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            [ngModel]="t.genus ?? ''"
            (ngModelChange)="commit({ genus: ($event || '').trim() ? $event : undefined })"
            placeholder="m / f / n …"
          />
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

  @Input() termId: number | null = null;

  categories: TermCategory[] = ['verbe', 'nom', 'expression', 'adjectif', 'autre'];

  term = computed((): Term | null => {
    const id = this.termId;
    if (id == null) return null;
    return this.store.terms().find((t: Term) => t.id === id) ?? null;
  });

  commit(patch: Partial<Term>) {
    if (this.termId == null) return;
    this.store.updateTerm(this.termId, patch);
  }

  autoGuessVowel(display: string) {
    const s = (display || '').trim().toLowerCase();
    const first = s[0];
    const guess = !!first && 'aeiouyh'.includes(first);
    this.commit({ needsVowelArticle: guess });
  }
}
