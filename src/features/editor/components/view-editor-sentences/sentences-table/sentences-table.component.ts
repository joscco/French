import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  output,
  signal,
  ViewChild,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SentenceRow, TermRow } from '../../../../../shared/contract/contract';
import { parseSentenceMarkup, representativeText } from '../../../helpers/sentence-markup';
import { EditorStore } from '../../../services/editor-store.service';
import { SentenceAudioButtonComponent } from '../../shared/audio-button/sentence-audio-button.component';

type AudioState = boolean;

type SentenceStats = {
  frRep: string;
  deRep: string;
  unlinkedCount: number;
  linkedCount: number;
  invalidLinkedCount: number;
  frAudio: AudioState;
  deAudio: AudioState;
};

@Component({
  standalone: true,
  selector: 'app-sentences-table',
  imports: [CommonModule, FormsModule, SentenceAudioButtonComponent],
  templateUrl: './sentences-table.component.html',
})
export class SentencePairsTableComponent {
  private readonly store = inject(EditorStore);

  // Inputs
  sentences = input.required<SentenceRow[]>();
  selectedSentenceId = input<number | null>(null);

  // Outputs
  selectSentence = output<number>();

  // UI
  query = signal('');
  onlyIssues = signal(false);
  onlyMissingAudio = signal(false);

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  private isInvalidTerm(termRow: TermRow | null | undefined): boolean {
    if (!termRow) {
      return true;
    }
    const categoryMissing = !(termRow.category ?? '').trim();
    const isNoun = (termRow.category ?? '') === 'noun';
    const genusMissing = isNoun && !(termRow.genus ?? '').trim();
    return categoryMissing || genusMissing;
  }

  private collectAnnotationTermIds(text: string): { linkedIds: number[]; unlinkedCount: number } {
    const ast = parseSentenceMarkup(text ?? '');
    let unlinkedCount = 0;
    const linkedIds: number[] = [];

    const walk = (nodes: any[]) => {
      for (const n of nodes) {
        if (!n) {
          continue;
        }
        if (n.kind === 'ann') {
          if (n.termId) {
            linkedIds.push(n.termId);
          } else {
            unlinkedCount += 1;
          }
        } else if (n.kind === 'alt') {
          for (const option of (n.options ?? [])) {
            walk(option);
          }
        }
      }
    };

    walk(ast as any[]);
    return { linkedIds, unlinkedCount };
  }

  private computeStats(sentence: SentenceRow): SentenceStats {
    const frAst = parseSentenceMarkup(sentence.fr ?? '');
    const deAst = parseSentenceMarkup(sentence.de ?? '');

    const frRep = representativeText(frAst);
    const deRep = representativeText(deAst);

    const frAnn = this.collectAnnotationTermIds(sentence.fr ?? '');
    const deAnn = this.collectAnnotationTermIds(sentence.de ?? '');

    const linkedIds = [...frAnn.linkedIds, ...deAnn.linkedIds];
    const linkedCount = linkedIds.length;
    const unlinkedCount = frAnn.unlinkedCount + deAnn.unlinkedCount;

    const termById = this.store.termById();
    let invalidLinkedCount = 0;
    for (const termId of linkedIds) {
      const term = termById.get(termId) ?? null;
      if (this.isInvalidTerm(term)) {
        invalidLinkedCount += 1;
      }
    }

    const frAudio = this.store.hasSentenceAudio('fr' as any, sentence.id);
    const deAudio = this.store.hasSentenceAudio('de' as any, sentence.id);

    return {
      frRep: frRep || '—',
      deRep: deRep || '—',
      unlinkedCount,
      linkedCount,
      invalidLinkedCount,
      frAudio,
      deAudio,
    };
  }

  // Filtered list + stats
  filteredRows = computed(() => {
    const searchQuery = (this.query() ?? '').trim().toLowerCase();
    const onlyShowIssues = this.onlyIssues();
    const onlyMissingAudio = this.onlyMissingAudio();

    let filteredSentences = this.sentences();

    if (searchQuery) {
      filteredSentences = filteredSentences.filter((sentence) => {
        const searchableText =
          `${sentence.fr ?? ''} ${sentence.de ?? ''} ${sentence.note ?? ''}`.toLowerCase();
        return searchableText.includes(searchQuery);
      });
    }

    // newest first (like your current list)
    filteredSentences = [...filteredSentences].sort((a, b) => b.id - a.id);

    let sentenceRows = filteredSentences.map((sentence) => ({
      sentence,
      stats: this.computeStats(sentence),
    }));

    if (onlyShowIssues) {
      sentenceRows = sentenceRows.filter((row) => {
        return (
          row.stats.unlinkedCount > 0 ||
          row.stats.invalidLinkedCount > 0 ||
          !row.stats.frAudio ||
          !row.stats.deAudio
        );
      });
    }

    if (onlyMissingAudio) {
      sentenceRows = sentenceRows.filter((row) => !row.stats.frAudio || !row.stats.deAudio);
    }

    return sentenceRows;
  });

  onRowClick(id: number) {
    this.selectSentence.emit(id);
  }

  // keyboard workflow (like your term table)
  private setSelectionByOffset(offset: number) {
    const list = this.filteredRows().map((r) => r.sentence);
    if (!list.length) {
      return;
    }

    const currentId = this.selectedSentenceId();
    const currentIndex = currentId == null ? -1 : list.findIndex((s) => s.id === currentId);

    const nextIndexUnclamped =
      currentIndex < 0 ? (offset > 0 ? 0 : list.length - 1) : currentIndex + offset;
    const nextIndex = Math.max(0, Math.min(list.length - 1, nextIndexUnclamped));

    const nextId = list[nextIndex]?.id ?? null;
    if (nextId != null) {
      this.selectSentence.emit(nextId);
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-sentence-row="${nextId}"]`) as HTMLElement | null;
        el?.scrollIntoView({ block: 'nearest' });
      });
    }
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(keyboardEvent: KeyboardEvent) {
    const target = keyboardEvent.target as HTMLElement | null;
    const isTyping =
      !!target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.getAttribute('contenteditable') === 'true');
    if (isTyping) {
      return;
    }

    if (keyboardEvent.key === 'ArrowDown') {
      keyboardEvent.preventDefault();
      this.setSelectionByOffset(+1);
      return;
    }

    if (keyboardEvent.key === 'ArrowUp') {
      keyboardEvent.preventDefault();
      this.setSelectionByOffset(-1);
      return;
    }

    if ((keyboardEvent.ctrlKey || keyboardEvent.metaKey) && keyboardEvent.key.toLowerCase() === 'f') {
      keyboardEvent.preventDefault();
      this.searchInput?.nativeElement?.focus();
      this.searchInput?.nativeElement?.select();
      return;
    }
  }
}
