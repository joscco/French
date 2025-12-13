import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {Language} from '../../models/types';
import {beautifyGenus, getArticle} from '../../helpers/utils';

@Component({
  selector: 'app-card-face',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card-face.component.html'
})
export class CardFaceComponent {
  @Input() primary = '';
  @Input() secondary = '';
  @Input() genus?: string;
  @Input() language: Language = 'french';
  @Input() needsVowelArticle = false;
  protected readonly getArticle = getArticle;
  protected readonly beautifyGenus = beautifyGenus;
}
