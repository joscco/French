import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Term, TermCategory} from '../../models/editor-model';
import {EditorStore} from '../../services/editor-store.service';
import {Language} from '../../models/types';

@Component({
  standalone: true,
  selector: 'app-term-picker',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="w-[420px] max-w-[90vw] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
      <div class="flex gap-2">
        <input
          [(ngModel)]="query"
          class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          placeholder="Search terms…"
        />
        <select
          [(ngModel)]="category"
          class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
        >
          <option value="">(any)</option>
          <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
        </select>
      </div>

      <div class="mt-3 max-h-64 space-y-2 overflow-auto">
        <button
          type="button"
          class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
          *ngFor="let t of results()"
          (click)="choose.emit(t)"
        >
          <div class="text-sm font-semibold text-slate-900">{{ t.display }}</div>
          <div class="text-xs text-slate-500">#{{ t.id }} · {{ t.category || '—' }}</div>
        </button>
      </div>

      <div class="my-3 h-px bg-slate-200"></div>

      <div class="space-y-2">
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick create</div>
        <input
          [(ngModel)]="newDisplay"
          class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          placeholder="e.g. manger qc."
        />
        <div class="flex gap-2">
          <select
            [(ngModel)]="newCategory"
            class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400"
          >
            <option value="">(guess/empty)</option>
            <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
          </select>
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            (click)="create()"
            [disabled]="!newDisplay.trim()"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  `,
})
export class TermPickerComponent {
  @Input({ required: true }) lang!: Language;
  @Output() choose = new EventEmitter<Term>();

  query = '';
  category: '' | TermCategory = '';
  newDisplay = '';
  newCategory: '' | TermCategory = '';

  categories: TermCategory[] = ['verbe', 'nom', 'expression', 'adjectif', 'autre'];

  results = computed(() => {
    const base = this.store.searchTerms(this.lang, this.query);
    return this.category ? base.filter(t => t.category === this.category) : base;
  });

  constructor(private store: EditorStore) {}

  create() {
    const display = this.newDisplay.trim();
    if (!display) {
      return;
    }

    const term = this.store.createTerm({
      lang: this.lang,
      display,
      category: this.newCategory || undefined,
    });

    this.choose.emit(term);
    this.newDisplay = '';
    this.newCategory = '';
    this.query = '';
  }
}
