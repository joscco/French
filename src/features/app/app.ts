import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {UnitsService} from '../../services/units.service';
import {TermLinksService} from '../../services/termLinks.service';
import {TermsService} from '../../services/terms.service';
import {IconButtonComponent} from './shared/icon-button/icon-button.component';
import {PracticeDirectionToggleComponent} from './shared/practice-direction-toggle/practice-direction-toggle.component';
import {ExportPdfService} from './services/export-pdf.service';
import {WordService} from './services/word.service';
import {PracticeRouteStateService} from './services/route-state.service';
import {PracticeKind, PracticeMode} from './models/types';
import {LessonOption} from './models/lesson-option';
import {PracticePanelComponent} from './shared/practice-panel/practice-panel.component';
import {PracticeHostComponent} from './shared/practice-host/app-practice-host.component';
import {SentencesService} from '../../services/sentence.service';
import {AllowedTermsService} from './services/sentence-ref.service';

@Component({
  selector: 'app',
  standalone: true,
  imports: [CommonModule, IconButtonComponent, PracticeDirectionToggleComponent, PracticePanelComponent, PracticeHostComponent],
  templateUrl: './app.html',
  host: {'class': 'w-full h-full max-h-[800px] flex items-center justify-center'},
})
export class AppComponent {
  private pdf = inject(ExportPdfService);
  private termsService = inject(TermsService)
  private translationService = inject(TermLinksService)

  private allowedTerms = inject(AllowedTermsService);
  private practiceCardsService = inject(WordService);
  private lessonService = inject(UnitsService);
  private sentenceService = inject(SentencesService);
  public routeStateService = inject(PracticeRouteStateService);

  panelOpen = signal(false);
  loading = signal(true);
  practiceKind = signal<PracticeKind>('sentence');
  selectedLessons = signal<LessonOption | undefined>(undefined);

  practiceMode = this.practiceCardsService.mode;

  lessons = computed<LessonOption[]>(() => {
    const units = this.lessonService.units(); // UnitRow[]
    const allOption: LessonOption = { id: 'all', label: 'Alle' };

    const lessonOptions: LessonOption[] = [...units]
      .sort((a, b) => a.id - b.id)
      .map(u => ({
        id: u.id,
        lesson: u.id,                  // wenn du LessonOption so beibehalten willst
        date: u.name,                  // oder u.date, je nach UnitRow
        label: `${u.id} - ${u.name}`,   // + optional group
      }));

    return [allOption, ...lessonOptions];
  });

  constructor() {
    Promise.all([
      this.lessonService.loadAll(),
      this.termsService.loadAll(),
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
      this.allowedTerms.selectedUnitIds.set('all');
    } else if (typeof selectedLesson.lesson === 'number') {
      this.allowedTerms.selectedUnitIds.set([selectedLesson.lesson]);
    } else {
      this.allowedTerms.selectedUnitIds.set([]);
    }

    const lessonParam = selectedLesson.id === 'all' ? 'all' : String(selectedLesson.lesson);
    this.routeStateService.patch({ lesson: lessonParam, i: 0 });
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

  onPracticeModeChange($event: PracticeMode) {
    this.practiceMode.set($event);
    this.routeStateService.patch({mode: $event, i: 0})
  }
}
