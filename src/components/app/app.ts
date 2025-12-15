import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ExportPdfService} from '../../services/export-pdf.service';
import {LessonService} from '../../services/lesson.service';
import {LessonOption} from '../../models/lesson-option';
import {TranslationService} from '../../services/translation.service';
import {GermanTermService} from '../../services/german-term.service';
import {FrenchTermService} from '../../services/french-term.service';
import {WordService} from '../../services/word.service';
import {PracticeKind} from '../../models/types';
import {SentenceService} from '../../services/sentence.service';
import {IconButtonComponent} from '../shared/icon-button/icon-button.component';
import {
  PracticeDirectionToggleComponent
} from '../shared/practice-direction-toggle/practice-direction-toggle.component';
import {PracticePanelComponent} from '../shared/practice-panel/practice-panel.component';
import {PracticeRouteStateService} from '../../services/route-state.service';
import {PracticeHostComponent} from '../shared/practice-host/app-practice-host.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, IconButtonComponent, PracticeDirectionToggleComponent, PracticePanelComponent, PracticeHostComponent],
  templateUrl: './app.html',
  host: {'class': 'h-full'},
})
export class AppComponent {
  private pdf = inject(ExportPdfService);
  private frenchTermService = inject(FrenchTermService)
  private germanTermService = inject(GermanTermService)
  private translationService = inject(TranslationService)

  private practiceCardsService = inject(WordService);
  private lessonService = inject(LessonService);
  private sentenceService = inject(SentenceService);
  public routeStateService = inject(PracticeRouteStateService);

  panelOpen = signal(false);
  loading = signal(true);
  practiceKind = signal<PracticeKind>('sentence');
  selectedLessons = signal<LessonOption | undefined>(undefined);

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
      const baseLabel = `${lesson}`;
      return {
        id: lesson,
        lesson,
        date: meta?.date,
        label: meta?.date ? `${baseLabel} - ${meta.date}` : baseLabel,
      };
    });

    return [allOption, ...lessonOptions];
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
        this.practiceKind.set(this.routeStateService.kind());
        this.practiceMode.set(this.routeStateService.mode());

        const lessonId = this.routeStateService.lesson();
        const opts = this.lessons();
        const match =
          lessonId === 'all'
            ? opts.find(o => o.id === 'all')
            : opts.find(o => String(o.lesson) === lessonId);

        this.onLessonsChange(match ?? opts[0]);
      });
  }

  closePanel() {
    this.panelOpen.set(false);
  }

  togglePanel() {
    this.panelOpen.update(isShown => !isShown);
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

    const lessonParam = selectedLesson.id === 'all' ? 'all' : String(selectedLesson.lesson);
    this.routeStateService.patch({lesson: lessonParam, i: 0});
  }

  exportPdf() {
    const cards = this.practiceCardsService.words();
    const selected = this.selectedLessons();

    if (!cards?.length || !selected) {
      return;
    }

    this.pdf.exportVocab(cards, selected);
  }

  onPracticeKindChange($event: PracticeKind) {
    this.practiceKind.set($event);
    this.routeStateService.patch({kind: $event, i: 0});
    this.closePanel()
  }
}
