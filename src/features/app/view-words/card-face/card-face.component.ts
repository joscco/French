import {Component, computed, input} from '@angular/core';
import { CommonModule } from '@angular/common';
import {Genus, Lang} from '../../../../shared/contract/contract';
import {beautifyGenus, getArticle} from '../../helpers/utils';
import {parseTermDisplayMarkup, TermDisplaySeg} from '../../../editor/helpers/term-display-markup';

@Component({
  selector: 'app-card-face',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './card-face.component.html'
})
export class CardFaceComponent {
  readonly primary = input('');
  readonly secondary = input('');
  readonly genus = input<Genus | undefined>();
  readonly language = input<Lang>('fr');
  readonly needsVowelArticle = input(false);
  readonly tags = input<string[] | undefined>();

  readonly primarySegments = computed<TermDisplaySeg[]>(() =>
    parseTermDisplayMarkup(this.primary())
  );

  readonly secondarySegments = computed<TermDisplaySeg[]>(() =>
    parseTermDisplayMarkup(this.secondary())
  );

  readonly hasSecondary = computed(() => this.secondary().length > 0);
  readonly hasTags = computed(() => (this.tags() ?? []).length > 0);

  protected readonly getArticle = getArticle;
  protected readonly beautifyGenus = beautifyGenus;
}
