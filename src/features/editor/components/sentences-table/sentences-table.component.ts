import { Component, inject, computed, signal } from '@angular/core';
import { EditorStore } from '../../services/editor-store.service';
import { SentenceRow } from '../../../../shared/contract/contract';
import {TermEditorComponent} from '../term-editor/term-editor.component';
import {SentencePairsTableComponent} from '../sentences-sub-table/sentences-sub-table.component';
import {FormsModule} from '@angular/forms';
import {SentenceSideEditorComponent} from '../sentence-side-editor/sentence-side-editor.components';

@Component({
  selector: 'app-sentences-view',
  templateUrl: './sentences-table.component.html',
  imports: [
    TermEditorComponent,
    SentencePairsTableComponent,
    FormsModule,
    SentenceSideEditorComponent
  ],
})
export class SentencesTableComponent {
  private readonly store = inject(EditorStore);

  // Lokale States für Filter und Auswahl
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
      options.push({ id: group.id, label: group.name?.trim() || `Group ${group.id}` });
    }
    return options;
  });

  unitOptions = computed(() => {
    const selectedGroupId = this.selectedGroupId();
    const options: Array<{ id: number; label: string }> = [];
    const allUnitsInGroup = this.units().filter(unit => unit.group_id === selectedGroupId);
    for (const unit of allUnitsInGroup) {
      const name = unit.name?.trim() || `Unit ${unit.id}`;
      options.push({ id: unit.id, label: name });
    }
    return options;
  });

  state = signal<'idle' | 'loading' | 'ready' | 'error'>('ready');

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

  unitLabel(unitId: number): string {
    const unit = this.store.unitById().get(unitId);
    if (!unit) {
      return `Unit ${unitId}`;
    }
    return unit.name?.trim();
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

  selectSentence(id: number) {
    this.selectedSentenceId.set(id);
  }

  onEditTerm(termId: number) {
    this.selectedTermId.set(termId);
  }

  clearSelectedTerm() {
    this.selectedTermId.set(null);
  }

  private normalize(text: string): string {
    return (text ?? '').replace(/[\u2018\u2019]/g, "'").trim().toLowerCase();
  }
}
