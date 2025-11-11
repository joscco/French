import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIcon } from '@angular/material/icon';

export type LessonOption = 'Alle' | `Lektion ${number}`;

@Component({
  selector: 'app-lesson-selector',
  standalone: true,
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, MatTooltipModule],
  templateUrl: './lesson-selector.component.html'
})
export class LessonSelectorComponent {
  @Input()
  public lessons: LessonOption[] = ['Alle'];
  @Input()
  public selected: LessonOption = 'Alle';
  @Output()
  public selectedChange = new EventEmitter<LessonOption>();
}
