import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {Genus, Lang} from '../../../../shared/contract/contract';
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
  @Input() genus?: Genus;
  @Input() language: Lang = 'fr';
  @Input() needsVowelArticle = false;
  protected readonly getArticle = getArticle;
  protected readonly beautifyGenus = beautifyGenus;
}
