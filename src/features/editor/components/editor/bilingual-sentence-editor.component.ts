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

  state = signal<LoadState>('idle');
  error = signal<string | null>(null);

  filter = signal('');
  selectedGroupId = signal<number>(1);
  selectedUnitId = signal<number | null>(null);
  selectedSentenceId = signal<number | null>(null);
  selectedTermId = signal<number | null>(null);

  groups = this.store.groups;
  units = this.store.units;
  sentences = this.store.sentences;

  groupOptions = computed(() => {
    const options: Array<{ id: number; label: string }> = [];

    const allGroups = this.groups();
    for (const group of allGroups) {
      options.push({id: group.id, label: group.name?.trim() || `Group ${group.id}`});
    }
    return options;
  });

  unitOptions = computed(() => {
    const selectedGroupId = this.selectedGroupId();
    const options: Array<{ id: number; label: string }> = [];

    const allUnitsInGroup = this.units().filter(unit => {
      return unit.group_id === selectedGroupId;
    });

    for (const unit of allUnitsInGroup) {
      const name = unit.name?.trim() || `Unit ${unit.id}`;
      options.push({id: unit.id, label: name});
    }
    return options;
  });

  private normalize(text: string): string {
    return (text ?? '')
      .replace(/[\u2018\u2019]/g, "'")
      .trim()
      .toLowerCase();
  }

  filteredSentences = computed((): SentenceRow[] => {
    const searchQuery = this.normalize(this.filter());
    const selectedUnit = this.selectedUnitId();

    let sentenceList = this.sentences();
    sentenceList = sentenceList.filter(sentence => sentence.unitId === selectedUnit);

    const sortedSentences = [...sentenceList].sort((a, b) => b.id - a.id);

    if (!searchQuery) {
      return sortedSentences;
    }

    return sortedSentences.filter(sentence => {
      const searchableText = this.normalize(`${sentence.fr} ${sentence.de} ${sentence.note ?? ''}`);
      return searchableText.includes(searchQuery);
    });
  });

  selectedSentence = computed(() => {
    const sentenceId = this.selectedSentenceId();
    if (sentenceId == null) {
      return null;
    }
    return this.sentences().find(sentence => sentence.id === sentenceId) ?? null;
  });

  private ensureSelectionIsValid() {
    const currentId = this.selectedSentenceId();
    if (currentId == null) {
      return;
    }

    const stillExists = this.sentences().some(sentence => sentence.id === currentId);
    if (!stillExists) {
      this.selectedSentenceId.set(null);
    }
  }

  // -------------------------
  // Lifecycle-ish
  // -------------------------
  constructor() {
    this.load();
  }

  async load() {
    if (this.state() === 'loading') {
      return;
    }
    this.state.set('loading');
    this.error.set(null);

    try {
      await this.store.loadAll();
      this.state.set('ready');

      const firstUnit = this.units()[0]?.id ?? null;
      this.selectedUnitId.set(firstUnit);

      if (this.selectedSentenceId() == null) {
        const firstSentence = this.filteredSentences()[0];
        if (firstSentence) {
          this.selectedSentenceId.set(firstSentence.id);
        }
      } else {
        this.ensureSelectionIsValid();
      }
    } catch (error: any) {
      this.state.set('error');
      this.error.set(String(error?.message ?? error));
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

  changeGroupFilter(id: number) {
    const numericValue = Number(id);
    this.selectedGroupId.set(numericValue);

    this.selectFirstPossibleUnitId();
    this.selectFirstPossibleSentence();
  }

  changeUnitFilter(id: number) {
    const numericValue = Number(id);
    this.selectedUnitId.set(numericValue);

    this.selectFirstPossibleSentence();
  }

  private selectFirstPossibleUnitId() {
    const currentSelection = this.selectedUnitId();
    const visibleUnits = this.unitOptions();
    if (!visibleUnits.length) {
      this.selectedUnitId.set(null);
      return;
    }
    if (currentSelection == null || !visibleUnits.some(unit => unit.id === currentSelection)) {
      this.selectedUnitId.set(visibleUnits[0].id);
    }
  }

  private selectFirstPossibleSentence() {
    const currentSelection = this.selectedSentenceId();
    const visibleSentences = this.filteredSentences();
    if (!visibleSentences.length) {
      this.selectedSentenceId.set(null);
      return;
    }
    if (currentSelection == null || !visibleSentences.some(sentence => sentence.id === currentSelection)) {
      this.selectedSentenceId.set(visibleSentences[0].id);
    }
  }

  createSentence() {
    const unitId = this.selectedUnitId();
    if (!unitId) {
      return;
    }

    const nextId = Math.max(0, ...this.sentences().map(sentence => sentence.id)) + 1;

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
    const unit = this.store.unitById().get(unitId);
    if (!unit) {
      return `Unit ${unitId}`;
    }
    return unit.name?.trim();
  }

  protected readonly Number = Number;
}
