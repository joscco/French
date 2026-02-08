import { Component, computed, effect, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStore } from '../../services/editor-store.service';
import { BilingualSentence } from '../../models/editor-model';
import { TermEditorComponent } from './term-editor.component';
import {SentenceSideEditorComponent} from './sentence-side-editor.components';

@Component({
  standalone: true,
  selector: 'app-bilingual-sentence-editor',
  imports: [CommonModule, FormsModule, SentenceSideEditorComponent, TermEditorComponent],
  template: `
    <div class="flex h-full flex-col gap-3">
      <!-- Topbar (unchanged) -->
      <div class="flex flex-wrap items-center gap-2">
        <button type="button"
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                (click)="newSentence()">
          + New bilingual sentence
        </button>

        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold text-slate-600">Lesson</span>
          <input type="number"
                 class="w-24 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                 [(ngModel)]="lesson"/>
        </div>

        <div class="flex-1"></div>

        <button type="button"
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                (click)="download()">
          Export JSON
        </button>

        <input
          class="text-sm text-slate-600 file:mr-3 file:rounded-xl file:border file:border-slate-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-900 hover:file:bg-slate-50"
          type="file" accept="application/json"
          (change)="upload($event)" />

        <button type="button"
                class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                (click)="save()">
          Save (LocalStorage)
        </button>
      </div>

      <!-- Body -->
      <div class="grid min-h-0 flex-1 grid-cols-[360px_1fr_360px] gap-3">
        <!-- List -->
        <div class="flex min-h-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <input
            class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
            [(ngModel)]="filter"
            placeholder="Search (FR/DE)…"
          />

          <div class="min-h-0 space-y-2 overflow-auto pr-1">
            <button type="button"
                    class="w-full rounded-2xl border px-3 py-2 text-left transition hover:bg-slate-50"
                    [ngClass]="selectedId() === s.id ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white'"
                    *ngFor="let s of filtered()"
                    (click)="selectedId.set(s.id); selectedTermId.set(null)">
              <div class="flex items-center justify-between gap-2">
                <div class="text-sm font-extrabold text-slate-900">#{{ s.id }} · Lesson {{ s.lesson }}</div>
                <div class="text-xs text-slate-500">
                  {{ (s.fr.representative.annotations.length) + (s.de.representative.annotations.length) }} marks
                </div>
              </div>
              <div class="truncate text-xs text-slate-600">{{ preview(s.fr.representative.text) }}</div>
              <div class="truncate text-xs text-slate-600">{{ preview(s.de.representative.text) }}</div>
            </button>
          </div>
        </div>

        <!-- Detail -->
        <div *ngIf="selected() as s; else empty"
             class="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white p-3">
          <div class="mb-3 flex items-baseline justify-between">
            <div class="text-lg font-black text-slate-900">Sentence #{{ s.id }}</div>
            <div class="text-sm text-slate-600">Lesson {{ s.lesson }}</div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <app-sentence-side-editor
              [sentence]="s"
              lang="fr"
              [selectedTermId]="selectedTermId()"
              (editTerm)="selectedTermId.set($event)"
            ></app-sentence-side-editor>

            <app-sentence-side-editor
              [sentence]="s"
              lang="de"
              [selectedTermId]="selectedTermId()"
              (editTerm)="selectedTermId.set($event)"
            ></app-sentence-side-editor>
          </div>

          <div class="mt-4 border-t border-slate-200 pt-4">
            <div class="text-sm font-extrabold text-slate-900">Templates (MVP placeholder)</div>
            <div class="mt-1 text-sm text-slate-600">
              Nächster Schritt: DSL Parser + Slot UI.
            </div>
          </div>
        </div>

        <ng-template #empty>
          <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
            Select a sentence on the left, or create a new one.
          </div>
        </ng-template>

        <!-- Term editor -->
        <div class="min-h-0 overflow-auto">
          <app-term-editor [termId]="selectedTermId()"></app-term-editor>
        </div>
      </div>
    </div>
  `,
})
export class BilingualSentenceEditorComponent {
  private readonly store = inject(EditorStore);

  filter = '';
  lesson = 1;

  selectedId = signal<number | null>(null);
  selectedTermId = signal<number | null>(null);

  readonly sentences = this.store.sentences;

  readonly filtered = computed((): BilingualSentence[] => {
    const q = this.filter.trim().toLowerCase();
    const all = this.sentences();
    const sorted = [...all].sort((a, b) => b.id - a.id);

    if (!q) return sorted;

    return sorted.filter((s: BilingualSentence) =>
      (s.fr.representative.text + ' ' + s.de.representative.text).toLowerCase().includes(q),
    );
  });

  readonly selected = computed((): BilingualSentence | null => {
    const id = this.selectedId();
    if (id == null) return null;
    return this.sentences().find((s: BilingualSentence) => s.id === id) ?? null;
  });

  constructor() {
    effect(() => {
      this.store.db();
      this.store.saveToLS();
    });
  }

  newSentence() {
    const s = this.store.createBilingualSentence(this.lesson);
    this.selectedId.set(s.id);
    this.selectedTermId.set(null);
  }

  preview(s: string) {
    const t = (s || '').trim();
    return t.length > 80 ? t.slice(0, 80) + '…' : t;
  }

  download() {
    const blob = new Blob([this.store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fr-editor-db.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  upload(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((txt: string) => this.store.importJSON(txt));
    input.value = '';
  }

  save() {
    this.store.saveToLS();
  }
}
