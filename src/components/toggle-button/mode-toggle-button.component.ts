import {Component, EventEmitter, Input, Output} from '@angular/core';

@Component({
  selector: 'app-mode-toggle-button',
  templateUrl: './mode-toggle-button.component.html',
  imports: [],
  standalone: true
})
export class ModeToggleButtonComponent {
  @Input() active = false;
  @Input() ariaLabel = '';
  @Input() title = '';
  @Output() onClick = new EventEmitter<void>();

  groupHovered = false;
}

