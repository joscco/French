import { Component, computed, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { EditorStore } from '../../services/editor-store.service';
import { BilingualSentence, SentenceAnnotation, Term } from '../../models/editor-model';
import { TermPickerComponent } from './term-picker.component';
import {Language} from '../../models/types';

type SelectionState =
  | null
  | {
  start: number;
  end: number;
  surface: string;
};

type Segment = {
  text: string;
  ann?: SentenceAnnotation;
  isSelected?: boolean;
};

@Component({
  standalone: true,
  selector: 'app-sentence-side-editor',
  imports: [CommonModule, FormsModule, TermPickerComponent],
  template: `
    <div class="side-editor-root relative overflow-visible rounded-2xl border border-slate-200 bg-white p-3">
      <div class="mb-2 flex items-center justify-between">
        <div class="text-sm font-extrabold text-slate-900">
          {{ lang().toUpperCase() }} Representative
        </div>

        <button
          type="button"
          class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
          (click)="clearSelection()"
        >
          Clear selection
        </button>
      </div>

      <textarea
        class="w-full min-h-[140px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none focus:border-slate-400"
        [ngModel]="repText()"
        (ngModelChange)="setRepText($event)"
        (mouseup)="onMouseUp($event)"
        (keyup)="onMouseUp($event)"
        placeholder="Representative sentence…"
      ></textarea>

      <!-- Overlay -->
      <div
        *ngIf="selection() as sel"
        class="absolute z-50 w-[520px] max-w-[92vw] pointer-events-auto"
        [style.left.px]="overlayPos().x"
        [style.top.px]="overlayPos().y"
      >
        <div class="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl">
          <div class="mb-2 flex items-center justify-between gap-2">
            <div class="truncate text-sm font-semibold text-slate-900">
              Markiert:
              <span class="rounded-md bg-sky-100 px-2 py-0.5">{{ sel.surface }}</span>
            </div>

            <button
              type="button"
              class="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
              (click)="selection.set(null)"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <app-term-picker [lang]="lang()" (choose)="onTermChosen($event)"></app-term-picker>
        </div>
      </div>

      <!-- Preview with highlights -->
      <div class="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div class="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
          Preview (highlighted)
        </div>

        <div class="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
          <ng-container *ngFor="let seg of segments()">
            <!-- normal text -->
            <span *ngIf="!seg.ann && !seg.isSelected">{{ seg.text }}</span>

            <!-- selected (live) but not annotated -->
            <span
              *ngIf="!seg.ann && seg.isSelected"
              class="rounded-md border border-sky-200 bg-sky-100 px-0.5 py-0.5"
            >
              {{ seg.text }}
            </span>

            <!-- annotated (clickable) -->
            <button
              *ngIf="seg.ann"
              type="button"
              class="inline rounded-md border px-0.5 py-0.5 align-baseline transition"
              [ngClass]="annClass(seg.ann.termId, !!seg.isSelected)"
              (click)="onClickAnnotated(seg.ann)"
              [title]="'term #' + seg.ann.termId"
            >
              {{ seg.text }}
            </button>
          </ng-container>
        </div>

        <div *ngIf="hasOverlap()" class="mt-2 text-xs font-semibold text-amber-700">
          ⚠️ Overlapping annotations detected. (Works, but can be confusing.)
        </div>
      </div>

      <!-- Annotation list -->
      <div class="mt-3">
        <div class="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
          Annotations
        </div>

        <div class="space-y-2" *ngIf="annotationsSorted().length > 0; else empty">
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left"
            *ngFor="let a of annotationsSorted()"
            [ngClass]="
              a.termId === selectedTermId()
                ? 'border-slate-400 bg-slate-50'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            "
            (click)="selection.set(null); editTerm.emit(a.termId)"
          >
            <span class="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
              {{ a.surface || sliceSurface(a) }}
            </span>
            <span class="text-xs text-slate-500">→ term #{{ a.termId }}</span>

            <span class="flex-1"></span>

            <span class="text-xs text-slate-400">
              [{{ a.range.start }}..{{ a.range.end }}]
            </span>

            <button
              type="button"
              class="ml-2 rounded-lg px-2 py-1 text-slate-400 hover:bg-white hover:text-slate-700"
              (click)="remove(a.id); $event.stopPropagation()"
              aria-label="Remove annotation"
              title="Remove"
            >
              ✕
            </button>
          </button>
        </div>

        <ng-template #empty>
          <div class="text-xs text-slate-500">
            Mark text above to link it to a term.
          </div>
        </ng-template>
      </div>
    </div>
  `,
})
export class SentenceSideEditorComponent {
  private readonly store = inject(EditorStore);

  // ✅ signal-based inputs
  sentence = input.required<BilingualSentence>();
  lang = input.required<Language>();
  selectedTermId = input<number | null>(null);

  // ✅ signal-based output
  editTerm = output<number>();

  // local state as signals
  selection = signal<SelectionState>(null);
  overlay = signal<{ x: number; y: number }>({ x: 12, y: 12 });

  private side = computed(() => (this.lang() === 'french' ? this.sentence().fr : this.sentence().de));

  repText = computed(() => this.side().representative.text ?? '');

  annotationsSorted = computed((): SentenceAnnotation[] => {
    const anns = this.side().representative.annotations ?? [];
    return [...anns].sort((a, b) => a.range.start - b.range.start);
  });

  overlayPos = computed(() => this.overlay());

  hasOverlap = computed((): boolean => {
    const anns = this.annotationsSorted();
    for (let i = 1; i < anns.length; i++) {
      const prev = anns[i - 1];
      const cur = anns[i];
      if (cur.range.start < prev.range.end) return true;
    }
    return false;
  });

  segments = computed((): Segment[] => {
    const text = this.repText();
    const anns = this.annotationsSorted();

    const len = text.length;
    const sel = this.selection();

    const cuts = new Set<number>([0, len]);
    for (const a of anns) {
      cuts.add(clamp(a.range.start, 0, len));
      cuts.add(clamp(a.range.end, 0, len));
    }
    if (sel) {
      cuts.add(clamp(sel.start, 0, len));
      cuts.add(clamp(sel.end, 0, len));
    }

    const points = [...cuts].sort((a, b) => a - b);
    const segs: Segment[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      if (end <= start) continue;

      const chunk = text.slice(start, end);

      // annotated chunk? (first match wins)
      const ann = anns.find(a => start >= a.range.start && end <= a.range.end);
      const isSelected = !!sel && start >= sel.start && end <= sel.end;

      segs.push({ text: chunk, ann, isSelected });
    }

    return segs;
  });

  setRepText(text: string) {
    const s = this.sentence();
    const lang = this.lang();

    this.store.updateSentenceSideText(s.id, lang, text);
    this.selection.set(null);
  }

  remove(annId: number) {
    const s = this.sentence();
    this.store.removeAnnotation(s.id, this.lang(), annId);
  }

  sliceSurface(a: SentenceAnnotation): string {
    const t = this.repText();
    return t.slice(a.range.start, a.range.end);
  }

  clearSelection() {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    this.selection.set(null);
  }

  onMouseUp(ev: MouseEvent | KeyboardEvent) {
    const ta = ev.target as HTMLTextAreaElement | null;
    if (!ta || ta.tagName !== 'TEXTAREA') return;

    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (end <= start) {
      this.selection.set(null);
      return;
    }

    const surface = ta.value.slice(start, end);
    this.selection.set({ start, end, surface });

    const editorEl = ta.closest('.side-editor-root') as HTMLElement | null;
    const editorRect = (editorEl ?? ta.parentElement!)?.getBoundingClientRect();
    const taRect = ta.getBoundingClientRect();

    const mouseX = ev instanceof MouseEvent ? ev.clientX : taRect.left + 20;
    const mouseY = ev instanceof MouseEvent ? ev.clientY : taRect.top + 20;

    const x = Math.max(8, mouseX - editorRect.left);
    const y = Math.max(8, mouseY - editorRect.top) + 18;

    this.overlay.set({ x, y });
  }

  onTermChosen(term: Term) {
    const sel = this.selection();
    if (!sel) return;

    const s = this.sentence();
    const lang = this.lang();

    this.store.addAnnotation(s.id, lang, {
      termId: term.id,
      range: { start: sel.start, end: sel.end },
      surface: sel.surface,
    });

    // ✅ open term editor immediately
    this.editTerm.emit(term.id);

    this.selection.set(null);
    this.clearSelection();
  }

  onClickAnnotated(a: SentenceAnnotation) {
    this.selection.set(null);
    this.editTerm.emit(a.termId);
  }

  annClass(termId: number, alsoSelected: boolean) {
    const isSelectedTerm = this.selectedTermId() === termId;
    return [
      'border-amber-200 bg-amber-100 hover:bg-amber-200',
      isSelectedTerm ? 'ring-2 ring-slate-400' : '',
      alsoSelected ? 'ring-2 ring-sky-300' : '',
    ].join(' ');
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
