import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ModeToggleButtonComponent} from '../mode-toggle-button/mode-toggle-button.component';
import {PracticeMode} from '../../../models/types';

@Component({
  selector: 'app-mode-selector',
  standalone: true,
  imports: [CommonModule, ModeToggleButtonComponent],
  templateUrl: './mode-selector.component.html'
})
export class ModeSelectorComponent {
  @Input() mode: PracticeMode = 'de-fr';
  @Output() modeChange = new EventEmitter<PracticeMode>();


  setMode(m: PracticeMode) {
    if (m !== this.mode) {
      this.mode = m;
      this.modeChange.emit(this.mode);
    }
  }
}
