import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import {LessonOption} from '../../models/lesson-option';

@Component({
  selector: 'app-lesson-selector',
  standalone: true,
  imports: [CommonModule, MatSelectModule, MatFormFieldModule, MatTooltipModule, FormsModule],
  templateUrl: './lesson-selector.component.html'
})
export class LessonSelectorComponent {
  @Input()
  public lessons: LessonOption[] = [{ id: 'all', label: 'Alle' }];

  @Input()
  public selected: LessonOption | undefined = undefined;

  @Output()
  public selectedChange = new EventEmitter<LessonOption>();

  onSelectedChange(rawValue: string) {
    const id = rawValue === 'all' ? 'all' : Number(rawValue);

    const selectedLesson =
      this.lessons.find(l => l.id === id) ?? { id: 'all', label: 'Alle' };

    this.selectedChange.emit(selectedLesson);
  }
}
