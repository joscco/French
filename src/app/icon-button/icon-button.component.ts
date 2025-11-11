import {Component, EventEmitter, Input, Output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIcon} from '@angular/material/icon';

@Component({
  selector: 'app-icon-button',
  standalone: true,
  imports: [CommonModule, MatIcon],
  templateUrl: './icon-button.component.html',
})
export class IconButtonComponent {
  @Input() iconName: string = '';
  @Output() onClick = new EventEmitter<void>();
}
