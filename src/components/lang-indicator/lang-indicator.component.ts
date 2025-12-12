import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import {Language} from '../../models/types';

@Component({
  selector: 'app-lang-indicator',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './lang-indicator.component.html'
})
export class LangIndicatorComponent {
  @Input() lang: Language = 'french';
}

