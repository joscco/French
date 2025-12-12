import {Component, computed, effect, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {LessonSelectorComponent} from '../lesson-selector/lesson-selector.component';
import {ModeSelectorComponent} from '../mode-selector/mode-selector.component';
import {PracticeComponent} from '../practice/practice.component';
import {ExportPdfService} from '../../services/export-pdf.service';
import {IconButtonComponent} from '../icon-button/icon-button.component';
import {LessonService} from '../../services/lesson.service';
import {LessonOption} from '../../models/lesson-option';
import {TranslationService} from '../../services/translation.service';
import {GermanTermService} from '../../services/german-term.service';
import {FrenchTermService} from '../../services/french-term.service';
import {PracticeCardService} from '../../services/practice-card.service';
import {PracticeKind, PracticeMode} from '../../models/types';
import {SentenceService} from '../../services/sentence.service';
import {SentencePracticeComponent} from '../sentence-practice/sentence-practice.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, LessonSelectorComponent, ModeSelectorComponent, PracticeComponent, IconButtonComponent, IconButtonComponent, SentencePracticeComponent],
  templateUrl: './app.html',
  host: {'class': 'h-full'},
})
export class AppComponent {
  private pdf = inject(ExportPdfService);
  private frenchTermService = inject(FrenchTermService)
  private germanTermService = inject(GermanTermService)
  private translationService = inject(TranslationService)

  private practiceCardsService = inject(PracticeCardService);
  private lessonService = inject(LessonService);
  private sentenceService = inject(SentenceService);

  loading = signal(true);
  practiceKind = signal<PracticeKind>('sentence');
  practiceMode = this.practiceCardsService.mode;

  lessons = computed<LessonOption[]>(() => {
    const termineByLesson = this.lessonService.byLesson();
    const lessonNumbers = Object.keys(termineByLesson)
      .map((k) => Number(k))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    const allOption: LessonOption = {id: 'all', label: 'Alle'};

    const lessonOptions: LessonOption[] = lessonNumbers.map((lesson) => {
      const meta = termineByLesson[lesson];
      const baseLabel = `Lektion ${lesson}`;
      return {
        id: lesson,
        lesson,
        date: meta?.date,
        label: meta?.date ? `${baseLabel} - ${meta.date}` : baseLabel,
      };
    });

    return [allOption, ...lessonOptions];
  });

  selectedLessons = signal<LessonOption | undefined>(undefined);
  practiceCards = this.practiceCardsService.cards;

  sentences = computed(() => {
    const all = this.sentenceService.sentencesWithRefs();
    const sel = this.selectedLessons();

    if (!sel || sel.id === 'all') {
      return all;
    }
    return all.filter(s => s.lesson === sel.lesson);
  });

  constructor() {
    Promise.all([
      this.lessonService.loadAll(),
      this.frenchTermService.loadAll(),
      this.germanTermService.loadAll(),
      this.translationService.loadAll(),
      this.sentenceService.loadAll()
    ]).catch((err) => {
      console.error('Fehler beim Laden der Daten', err);
    })
      .finally(() => {
        this.loading.set(false);
        const lessons = this.lessons();
        this.onLessonsChange(lessons[0]);
      });
  }

  onLessonsChange(selectedLesson: LessonOption) {
    this.selectedLessons.set(selectedLesson);

    if (selectedLesson.id === 'all') {
      this.practiceCardsService.selectedLessons.set('all');
    } else if (typeof selectedLesson.lesson === 'number') {
      this.practiceCardsService.selectedLessons.set([selectedLesson.lesson]);
    } else {
      this.practiceCardsService.selectedLessons.set([]);
    }
  }

  exportPdf() {
    const cards = this.practiceCards();
    const selected = this.selectedLessons();

    if (!cards?.length || !selected) {
      return;
    }

    this.pdf.exportVocab(cards, selected);
  }
}
