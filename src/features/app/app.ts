import {Component, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {UnitsService} from '../../services/units.service';
import {GroupsService} from '../../services/groups.service';
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
  private readonly pdf = inject(ExportPdfService);
  private readonly termsService = inject(TermsService);
  private readonly translationService = inject(TermLinksService);
  private readonly groupsService = inject(GroupsService);
  private readonly unitsService = inject(UnitsService);
  private readonly sentenceService = inject(SentencesService);
  private readonly allowedTerms = inject(AllowedTermsService);
  private readonly practiceCardsService = inject(WordService);
  public readonly routeStateService = inject(PracticeRouteStateService);

  panelOpen = signal(false);
  loading = signal(true);
  practiceKind = signal<PracticeKind>('sentence');
  selectedLesson = signal<LessonOption | undefined>(undefined);

  practiceMode = this.practiceCardsService.mode;

  constructor() {
    Promise.all([
      this.groupsService.loadAll(),
      this.unitsService.loadAll(),
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

        // Initiale Auswahl basierend auf URL-Parametern (ohne Index zu resetten)
        const routeGroupId = this.routeStateService.groupId();
        const routeUnitId = this.routeStateService.unitId();

        if (routeUnitId !== null) {
          const unit = this.unitsService.units().find(u => u.id === routeUnitId);
          if (unit) {
            this.applyLessonSelection({
              type: 'unit',
              id: unit.id,
              groupId: unit.group_id,
              unitId: unit.id,
              label: unit.name,
              date: unit.date,
            }, false);
          }
        } else if (routeGroupId !== null) {
          const group = this.groupsService.groups().find(g => g.id === routeGroupId);
          if (group) {
            this.applyLessonSelection({
              type: 'group',
              id: group.id,
              groupId: group.id,
              label: group.name,
              date: group.date,
            }, false);
          }
        } else {
          this.applyLessonSelection({ type: 'all', id: 'all', label: 'Alle' }, false);
        }
      });
  }

  closePanel() {
    this.panelOpen.set(false);
  }

  togglePanel() {
    this.panelOpen.update(isShown => !isShown);
  }

  onLessonChange(selected: LessonOption) {
    this.applyLessonSelection(selected, true);
  }

  private applyLessonSelection(selected: LessonOption, resetIndex: boolean) {
    this.selectedLesson.set(selected);

    if (selected.type === 'all') {
      this.allowedTerms.selectedUnitIds.set('all');
      if (resetIndex) {
        this.routeStateService.patch({ group: 'all', unit: 'all', i: 0 });
      }
    } else if (selected.type === 'group') {
      const groupUnits = this.unitsService.units()
        .filter(unit => unit.group_id === selected.groupId)
        .map(unit => unit.id);
      this.allowedTerms.selectedUnitIds.set(groupUnits);
      if (resetIndex) {
        this.routeStateService.patch({ group: String(selected.groupId), unit: 'all', i: 0 });
      }
    } else if (selected.type === 'unit') {
      this.allowedTerms.selectedUnitIds.set([selected.unitId!]);
      if (resetIndex) {
        this.routeStateService.patch({ group: 'all', unit: String(selected.unitId), i: 0 });
      }
    }
  }

  exportPdf() {
    const cards = this.practiceCardsService.words();
    const selected = this.selectedLesson();

    if (!cards?.length || !selected) {
      return;
    }

    this.pdf.exportVocab(cards, selected);
  }

  onPracticeKindChange($event: PracticeKind) {
    this.practiceKind.set($event);
    this.routeStateService.patch({kind: $event, i: 0});
    this.closePanel();
  }

  onPracticeModeChange($event: PracticeMode) {
    this.practiceMode.set($event);
    this.routeStateService.patch({mode: $event, i: 0});
  }
}
