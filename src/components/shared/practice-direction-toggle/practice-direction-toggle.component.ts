import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {PracticeMode} from '../../../models/types';

@Component({
  selector: 'app-practice-direction-toggle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './practice-direction-toggle.component.html',
})
export class PracticeDirectionToggleComponent {
  @Input() mode: PracticeMode = 'de-fr';
  @Output() modeChange = new EventEmitter<PracticeMode>();
}
