import {Component, computed, inject, signal} from '@angular/core';
import {NgClass} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {TermEditorComponent} from '../term-editor/term-editor.component';
import {SentenceSideEditorComponent} from '../sentence-side-editor/sentence-side-editor.components';
import {EditorStore} from '../../services/editor-store.service';
import {SentenceRow} from '../../../../shared/contract/contract';
import {downloadTextFile} from '../../helpers/download';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

@Component({
  standalone: true,
  selector: 'app-bilingual-sentence-editor',
  imports: [NgClass, FormsModule, SentenceSideEditorComponent, TermEditorComponent],
  templateUrl: './bilingual-sentence-editor.component.html',
})
export class BilingualSentenceEditorComponent {
  private readonly store = inject(EditorStore);

  // -------------------------
  // Load state
  // -------------------------
  state = signal<LoadState>('idle');
  error = signal<string | null>(null);

  // -------------------------
  // UI state
  // -------------------------
  filter = signal('');
  selectedUnitId = signal<number | 'all'>('all');

  selectedSentenceId = signal<number | null>(null);
  selectedTermId = signal<number | null>(null);

  // Create form
  newSentenceUnitId = signal<number | null>(null);

  // -------------------------
  // Data from store
  // -------------------------
  units = this.store.units;
  sentences = this.store.sentences;

  // -------------------------
  // Derived
  // -------------------------
  unitOptions = computed(() => {
    const all: Array<{ id: number | 'all'; label: string }> = [
      { id: 'all', label: 'All units' },
    ];

    const u = this.units();
    for (const unit of u) {
      // label: "WiSe 2025 · 10.09.2025"
      const name = unit.name?.trim() || `Unit ${unit.id}`;
      const group = unit.group?.trim() || '';
      const label = group ? `${group} · ${name}` : name;
      all.push({ id: unit.id, label });
    }
    return all;
  });

  private normalize(s: string) {
    return (s ?? '')
      .replaceAll('’', "'")
      .trim()
      .toLowerCase();
  }

  filteredSentences = computed((): SentenceRow[] => {
    const q = this.normalize(this.filter());
    const unitSel = this.selectedUnitId();

    let list = this.sentences();

    if (unitSel !== 'all') {
      list = list.filter(s => s.unitId === unitSel);
    }

    // newest first in list (nice for editing)
    const sorted = [...list].sort((a, b) => b.id - a.id);

    if (!q) return sorted;

    return sorted.filter(s => {
      const hay = this.normalize(`${s.fr} ${s.de} ${s.note ?? ''}`);
      return hay.includes(q);
    });
  });

  selectedSentence = computed(() => {
    const id = this.selectedSentenceId();
    if (id == null) return null;
    return this.sentences().find(s => s.id === id) ?? null;
  });

  // Keep selection stable even when filtering changes
  private ensureSelectionIsValid() {
    const cur = this.selectedSentenceId();
    if (cur == null) return;

    const stillExists = this.sentences().some(s => s.id === cur);
    if (!stillExists) this.selectedSentenceId.set(null);
  }

  // -------------------------
  // Lifecycle-ish
  // -------------------------
  constructor() {
    this.load();
  }

  async load() {
    if (this.state() === 'loading') return;
    this.state.set('loading');
    this.error.set(null);

    try {
      await this.store.loadAll();
      this.state.set('ready');

      // sensible defaults for create form
      const firstUnit = this.units()[0]?.id ?? null;
      this.newSentenceUnitId.set(firstUnit);

      // auto-select first sentence (newest) if none selected
      if (this.selectedSentenceId() == null) {
        const first = this.filteredSentences()[0];
        if (first) this.selectedSentenceId.set(first.id);
      } else {
        this.ensureSelectionIsValid();
      }
    } catch (e: any) {
      this.state.set('error');
      this.error.set(String(e?.message ?? e));
    }
  }

  // -------------------------
  // Actions
  // -------------------------
  selectSentence(id: number) {
    this.selectedSentenceId.set(id);
  }

  onEditTerm(termId: number) {
    this.selectedTermId.set(termId);
  }

  clearSelectedTerm() {
    this.selectedTermId.set(null);
  }

  changeUnitFilter(value: string) {
    const v = (value ?? '').trim();
    if (v === 'all') {
      this.selectedUnitId.set('all');
    } else {
      const num = Number(v);
      this.selectedUnitId.set(Number.isFinite(num) ? num : 'all');
    }

    // if current selection isn't in filtered list, pick the first visible
    const sel = this.selectedSentenceId();
    const visible = this.filteredSentences();
    if (!visible.length) {
      this.selectedSentenceId.set(null);
      return;
    }
    if (sel == null || !visible.some(s => s.id === sel)) {
      this.selectedSentenceId.set(visible[0].id);
    }
  }

  createSentence() {
    // NOTE: your store currently doesn't have createSentence(),
    // so we create it locally by extending sentences signal.
    // This does NOT touch terms/links; only adds a sentence row.
    const unitId = this.newSentenceUnitId();
    if (!unitId) return;

    const nextId = Math.max(0, ...this.sentences().map(s => s.id)) + 1;

    const newSentence: SentenceRow = {
      id: nextId,
      unitId,
      fr: '',
      de: '',
      note: undefined,
    };

    this.store.sentences.set([newSentence, ...this.sentences()].sort((a, b) => a.id - b.id));
    this.selectedSentenceId.set(newSentence.id);
    this.filter.set('');
    this.selectedUnitId.set(unitId);
  }

  saveAsCSVs() {
    const exportedFiles = this.store.exportCSVs();
    for (const [fileName, fileContent] of Object.entries(exportedFiles)) {
      downloadTextFile(fileName, fileContent);
    }
  }

  // convenience for template
  unitLabel(unitId: number): string {
    const u = this.store.unitById().get(unitId);
    if (!u) return `Unit ${unitId}`;
    const group = u.group?.trim();
    const name = u.name?.trim();
    return group ? `${group} · ${name}` : `${name}`;
  }

  protected readonly Number = Number;
}
