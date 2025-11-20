import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import { LessonSelectorComponent} from '../lesson-selector/lesson-selector.component';
import {ModeSelectorComponent, PracticeMode} from '../mode-selector/mode-selector.component';
import {PracticeCard, PracticeComponent} from '../practice/practice.component';
import {VocabService} from './vocab.service';
import {ExportPdfService} from './export-pdf.service';
import {IconButtonComponent} from './icon-button/icon-button.component';
import {TerminService} from './termin.service';
import {LessonOption} from '../lesson-option';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LessonSelectorComponent, ModeSelectorComponent, PracticeComponent, IconButtonComponent, IconButtonComponent],
  templateUrl: './app.html',
  host: {'class': 'h-full'},
})
export class AppComponent {
  private vocab = inject(VocabService);
  private pdf = inject(ExportPdfService);
  private termine = inject(TerminService);

  loading = signal(true);
  selectedLessons = signal<LessonOption>({ id: 'all', label: 'Alle' });
  mode = signal<PracticeMode>('de-fr');

  lessons = computed<LessonOption[]>(() => {
    const rows = this.vocab.rows();
    const termineByLesson = this.termine.byLesson();
    const lessonNumbers = Array.from(new Set(rows.map(r => r.lesson))).sort((a, b) => a - b);

    const allOption: LessonOption = { id: 'all', label: 'Alle' };

    const lessonOptions: LessonOption[] = lessonNumbers.map(lesson => {
      const meta = termineByLesson[lesson];
      const baseLabel = `Lektion ${lesson}`;
      return {
        id: lesson,
        lesson,
        date: meta?.date,
        label: `${baseLabel} - ${meta?.date}`,
      };
    });
    return [allOption, ...lessonOptions];
  });

  practiceCards = computed<PracticeCard[]>(() => {
    const rows = this.vocab.rows();
    const sel = this.selectedLessons();
    const cards = rows
      .filter(row => sel.id === 'all' ? true : row.lesson === sel.lesson)
      .map<PracticeCard>(r => ({
        id: r.id,
        frenchPrimary: r.fr_word,
        frenchSecondary: r.fr_sentence ?? '',
        germanPrimary: r.de_word,
        germanSecondary: r.de_sentence ?? '',
        meta: {
          id: r.id,
          category: r.category,
          fr_genus: r.fr_genus,
          de_genus: r.de_genus,
          fr_needs_vowel_article: r.fr_needs_vowel_article,
          lesson: r.lesson
        }
      }));
    return cards;
  });

  constructor() {
    this.vocab
      .loadAll()
      .finally(() => this.loading.set(false));
    this.termine
      .loadAll();
  }

  onLessonsChange(event: any) {
    const selectedLesson: LessonOption = event;
    this.selectedLessons.set(selectedLesson);
  }

  exportPdf() {
    const cards = this.practiceCards();
    if (!cards || cards.length === 0) {
      return;
    }
    this.pdf.exportVocab(cards, this.selectedLessons());
  }
}
