import { Component, inject, computed, signal, HostListener } from '@angular/core';
import { EditorStore } from '../../services/editor-store.service';
import { SentenceRow } from '../../../../shared/contract/contract';
import {FormsModule} from '@angular/forms';
import {SentenceSideEditorComponent} from './sentence-side-editor/sentence-side-editor.components';
import {SentencePairsTableComponent} from './sentences-table/sentences-table.component';
import {TermEditorComponent} from '../shared/term-editor/term-editor.component';

@Component({
  selector: 'app-sentences-view',
  templateUrl: './view-editor-sentences.component.html',
  imports: [
    TermEditorComponent,
    SentencePairsTableComponent,
    FormsModule,
    SentenceSideEditorComponent
  ],
})
export class ViewEditorSentencesComponent {
  private readonly store = inject(EditorStore);

  // Lokale States für Filter und Auswahl
  filter = signal('');
  selectedGroupId = signal<number>(-1);
  selectedUnitId = signal<number>(-1);
  selectedSentenceId = signal<number | null>(null);
  selectedTermId = signal<number | null>(null);

  groups = this.store.groups;
  units = this.store.units;
  sentences = this.store.sentences;

  groupOptions = computed(() => {
    const options: Array<{ id: number; label: string }> = [{ id: -1, label: 'All' }];
    const allGroups = this.groups();
    for (const group of allGroups) {
      options.push({ id: group.id, label: group.name?.trim() || `Group ${group.id}` });
    }
    return options;
  });

  unitOptions = computed(() => {
    const selectedGroupId = this.selectedGroupId();
    const options: Array<{ id: number; label: string }> = [{ id: -1, label: 'All' }];
    const allUnitsInGroup = selectedGroupId === -1
      ? this.units()
      : this.units().filter(unit => unit.group_id === selectedGroupId);
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
    // Filterlogik: Wenn Group gesetzt ist und Unit auf 'All', dann alle Sätze der Gruppe anzeigen
    const selectedGroup = this.selectedGroupId();
    if (selectedGroup !== -1 && (selectedUnit === -1 || selectedUnit == null)) {
      sentenceList = sentenceList.filter(sentence => {
        const unit = this.units().find(u => u.id === sentence.unitId);
        return unit && unit.group_id === selectedGroup;
      });
    } else if (selectedUnit !== -1) {
      sentenceList = sentenceList.filter(sentence => sentence.unitId === selectedUnit);
    }
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
      this.selectedUnitId.set(-1);
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

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(keyboardEvent: KeyboardEvent) {
    const target = keyboardEvent.target as HTMLElement | null;
    const isTyping = !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.getAttribute('contenteditable') === 'true');
    if (isTyping) {
      return;
    }

    if (keyboardEvent.key === 'Escape') {
      this.selectedSentenceId.set(null);
      return;
    }

    if (keyboardEvent.key === 'ArrowDown' || keyboardEvent.key.toLowerCase() === 's') {
      keyboardEvent.preventDefault();
      this.setSelectionByOffset(+1);
      return;
    }

    if (keyboardEvent.key === 'ArrowUp' || keyboardEvent.key.toLowerCase() === 'w') {
      keyboardEvent.preventDefault();
      this.setSelectionByOffset(-1);
      return;
    }

    if (keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
      if (this.selectedSentenceId() != null) {
        this.selectedSentenceId.set(null);
      } else {
        this.setSelectionByOffset(+1);
      }
      return;
    }
  }

  private setSelectionByOffset(offset: number) {
    const list = this.filteredSentences();
    if (!list.length) {
      this.selectedSentenceId.set(null);
      return;
    }
    const currentId = this.selectedSentenceId();
    const currentIndex = currentId == null ? -1 : list.findIndex((row) => row.id === currentId);
    const nextIndexUnclamped = currentIndex < 0 ? (offset > 0 ? 0 : list.length - 1) : currentIndex + offset;
    const nextIndex = Math.max(0, Math.min(list.length - 1, nextIndexUnclamped));
    const nextId = list[nextIndex]?.id ?? null;
    this.selectedSentenceId.set(nextId);
    if (nextId != null) {
      // Scroll into view logic if needed
    }
  }
}
