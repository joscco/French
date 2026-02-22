import {Component, ViewChild, computed, inject, signal} from '@angular/core';
import {NgClass} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {MatIcon} from '@angular/material/icon';
import {ViewEditorSentencesComponent} from './view-editor-sentences/view-editor-sentences.component';
import {ViewEditorTermsComponent} from './view-editor-terms/view-editor-terms.component';
import {EditorStore} from '../services/editor-store.service';
import {ExportService} from '../services/export.service';
import {TTSService} from '../services/tts.service';
import {SentenceRow} from '../../../shared/contract/contract';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'saving' | 'success' | 'error';

@Component({
  standalone: true,
  selector: 'app-bilingual-sentence-editor',
  imports: [
    NgClass,
    FormsModule,
    MatIcon,
    ViewEditorTermsComponent,
    ViewEditorSentencesComponent,
  ],
  templateUrl: './editor.component.html',
  host: { class: 'w-full h-full flex items-center justify-center' },
})
export class EditorComponent {
  private readonly store = inject(EditorStore);
  private readonly exportService = inject(ExportService);
  private readonly ttsService = inject(TTSService);

  state = signal<LoadState>('idle');
  error = signal<string | null>(null);

  saveState = signal<SaveState>('idle');
  saveError = signal<string | null>(null);

  filter = signal('');
  selectedUnitId = signal<number | null>(null);
  selectedSentenceId = signal<number | null>(null);

  groups = this.store.groups;
  units = this.store.units;
  sentences = this.store.sentences;

  viewMode = signal<'sentences' | 'terms'>('sentences');

  setViewMode(mode: 'sentences' | 'terms') {
    this.viewMode.set(mode);
  }

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

  saveAsCSVs() {
    const exportedFiles = this.store.exportCSVs();
    this.exportService.exportAll(exportedFiles);
  }

  async saveDirectly() {
    if (this.saveState() === 'saving') {
      return;
    }

    this.saveState.set('saving');
    this.saveError.set(null);

    const exportedFiles = this.store.exportCSVs();

    for (const [filename, content] of Object.entries(exportedFiles)) {
      const result = await this.ttsService.saveCSV(filename, content);
      if (!result.success) {
        this.saveState.set('error');
        this.saveError.set(result.error || `Fehler beim Speichern von ${filename}`);
        return;
      }
    }

    this.saveState.set('success');

    setTimeout(() => {
      if (this.saveState() === 'success') {
        this.saveState.set('idle');
        this.load();
      }
    }, 2000);
  }

  get serverAvailable() {
    return this.ttsService.serverAvailable();
  }

  @ViewChild('termsComp') termsComponentRef!: ViewEditorTermsComponent;

  get selectedTermIds() {
    return this.termsComponentRef?.selectedTermIds() ?? new Set();
  }
  get canMergeTerms() {
    return this.selectedTermIds.size > 1;
  }
  mergeSelectedTerms() {
    this.termsComponentRef?.mergeSelectedTerms();
  }

  protected readonly Number = Number;
}
