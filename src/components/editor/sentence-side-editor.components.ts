import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EditorStore } from '../../services/editor-store.service';
import { Lang, BilingualSentence, SentenceAnnotation, Term } from '../../models/editor-model';
import { TermPickerComponent } from './term-picker.component';

type PopoverState =
  | null
  | { x: number; y: number; start: number; end: number; surface: string };

type Segment =
  | { kind: 'text'; text: string }
  | { kind: 'ann'; text: string; ann: SentenceAnnotation };

@Component({
  standalone: true,
  selector: 'app-sentence-side-editor',
  imports: [CommonModule, FormsModule, TermPickerComponent],
  template: `
    <div class="relative rounded-2xl border border-slate-200 bg-white p-3">
      <div class="mb-2 flex items-center justify-between">
        <div class="text-sm font-extrabold text-slate-900">
          {{ lang.toUpperCase() }} Representative
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

      <!-- Preview with highlights -->
      <div class="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div class="mb-2 text-xs font-extrabold uppercase tracking-wide text-slate-500">
          Preview (highlighted)
        </div>

        <div class="whitespace-pre-wrap text-sm leading-relaxed text-slate-900">
          <ng-container *ngFor="let seg of segments()">
            <span *ngIf="seg.kind === 'text'">{{ seg.text }}</span>

            <button
              *ngIf="seg.kind === 'ann'"
              type="button"
              class="inline rounded-md border px-1.5 py-0.5 align-baseline transition"
              [ngClass]="annClass(seg.ann.termId)"
              (click)="onClickAnnotated(seg.ann)"
              [title]="'term #' + seg.ann.termId"
            >
              {{ seg.text }}
            </button>
          </ng-container>
        </div>

        <div *ngIf="hasOverlap()" class="mt-2 text-xs font-semibold text-amber-700">
          ⚠️ Note: Overlapping annotations detected. (Works, but can be confusing.)
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
            [ngClass]="a.termId === selectedTermId ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-white hover:bg-slate-50'"
            (click)="editTerm.emit(a.termId)"
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

      <!-- Popover -->
      <div *ngIf="popover() as p" class="absolute z-20" [style.left.px]="p.x" [style.top.px]="p.y">
        <div class="mb-2 flex items-center justify-between">
          <div class="max-w-[380px] truncate text-xs font-semibold text-slate-800">
            “{{ p.surface }}”
          </div>
          <button
            type="button"
            class="ml-2 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            (click)="popover.set(null)"
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        <app-term-picker [lang]="lang" (choose)="onTermChosen($event)"></app-term-picker>
      </div>
    </div>
  `,
})
export class SentenceSideEditorComponent {
  @Input({ required: true }) sentence!: BilingualSentence;
  @Input({ required: true }) lang!: Lang;
  @Input() selectedTermId: number | null = null;

  @Output() editTerm = new EventEmitter<number>();

  popover = signal<PopoverState>(null);

  constructor(private store: EditorStore) {}

  private side() {
    return this.lang === 'fr' ? this.sentence.fr : this.sentence.de;
  }

  repText() {
    return this.side().representative.text;
  }

  setRepText(text: string) {
    this.store.updateSentenceSideText(this.sentence.id, this.lang, text);
  }

  annotationsSorted(): SentenceAnnotation[] {
    const anns = this.side().representative.annotations ?? [];
    return [...anns].sort((a, b) => a.range.start - b.range.start);
  }

  remove(annId: number) {
    this.store.removeAnnotation(this.sentence.id, this.lang, annId);
  }

  sliceSurface(a: SentenceAnnotation): string {
    const t = this.repText();
    return t.slice(a.range.start, a.range.end);
  }

  onClickAnnotated(a: SentenceAnnotation) {
    this.editTerm.emit(a.termId);
  }

  annClass(termId: number) {
    const isSelected = this.selectedTermId === termId;
    // marked segments: yellow-ish background; selected adds ring
    return [
      'border-amber-200 bg-amber-100 hover:bg-amber-200',
      isSelected ? 'ring-2 ring-slate-400' : 'ring-0',
    ].join(' ');
  }

  // Build segments for preview (text + annotation spans)
  segments(): Segment[] {
    const text = this.repText() ?? '';
    const anns = this.annotationsSorted();

    if (!text) return [{ kind: 'text', text: '' }];

    // Clamp & sort
    const safe = anns
      .map(a => ({
        ...a,
        range: {
          start: Math.max(0, Math.min(a.range.start, text.length)),
          end: Math.max(0, Math.min(a.range.end, text.length)),
        },
      }))
      .filter(a => a.range.end > a.range.start)
      .sort((a, b) => a.range.start - b.range.start);

    const out: Segment[] = [];
    let i = 0;

    for (const a of safe) {
      if (a.range.start > i) {
        out.push({ kind: 'text', text: text.slice(i, a.range.start) });
      }
      out.push({ kind: 'ann', text: text.slice(a.range.start, a.range.end), ann: a });
      i = Math.max(i, a.range.end);
    }

    if (i < text.length) out.push({ kind: 'text', text: text.slice(i) });
    return out;
  }

  hasOverlap(): boolean {
    const anns = this.annotationsSorted();
    for (let i = 1; i < anns.length; i++) {
      const prev = anns[i - 1];
      const cur = anns[i];
      if (cur.range.start < prev.range.end) return true;
    }
    return false;
  }

  clearSelection() {
    const sel = window.getSelection();
    sel?.removeAllRanges();
    this.popover.set(null);
  }

  onMouseUp(ev: MouseEvent | KeyboardEvent) {
    const ta = ev.target as HTMLTextAreaElement | null;
    if (!ta || ta.tagName !== 'TEXTAREA') return;

    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (end <= start) {
      this.popover.set(null);
      return;
    }

    const surface = ta.value.slice(start, end);
    const rect = ta.getBoundingClientRect();

    const mouseX = ev instanceof MouseEvent ? ev.clientX : rect.left + 24;
    const mouseY = ev instanceof MouseEvent ? ev.clientY : rect.top + 24;

    const x = Math.max(8, mouseX - rect.left) + 8;
    const y = Math.max(8, mouseY - rect.top) + 10;

    this.popover.set({ x, y, start, end, surface });
  }

  onTermChosen(term: Term) {
    const p = this.popover();
    if (!p) return;

    this.store.addAnnotation(this.sentence.id, this.lang, {
      termId: term.id,
      range: { start: p.start, end: p.end },
      surface: p.surface,
    });

    // Immediately open term editor on selection:
    this.editTerm.emit(term.id);

    this.popover.set(null);
    this.clearSelection();
  }
}
