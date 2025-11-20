import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {Language} from '../../../practice/practice.component';

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

  public getArticle(): string {
    if (this.language === 'german') {
      switch (this.genus) {
        case 'm.':
          return 'der';
        case 'f.':
          return 'die';
        case 'n.':
          return 'das';
        case 'm. pl.':
        case 'f. pl.':
        case 'n. pl.':
          return 'die';
        case 'm./f.':
          return 'der/die';
        default:
          return '';
      }
    }
    if (this.language === 'french') {
      if (this.needsVowelArticle) {
        return 'l\'';
      }
      switch (this.genus) {
        case 'm.':
          return 'le';
        case 'f.':
          return 'la';
        case 'm. pl.':
          return 'les';
        case 'f. pl.':
          return 'les';
        case 'm./f.':
          return 'le/la';
        default:
          return '';
      }
    }
    return '';
  }
}
