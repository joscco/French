import {Component, computed, input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {Genus, Lang} from '../../../../shared/contract/contract';
import {parseTermDisplayMarkup, TermDisplaySeg} from '../../../../shared/helpers/term-display-markup';
import {getArticle, beautifyGenus} from '../../helpers/utils';

@Component({
  selector: 'app-term-inline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './term-inline.component.html',
})
export class TermInlineComponent {
  text = input<string>('');
  lang = input<Lang>('fr');
  genus = input<Genus | undefined>();
  needsVowelArticle = input<boolean>(false);

  // optional meta line
  ref = input<string | undefined>(undefined);
  tags = input<string[] | undefined>(undefined);

  readonly segments = computed<TermDisplaySeg[]>(() => parseTermDisplayMarkup(this.text()));
  readonly hasTags = computed(() => (this.tags() ?? []).length > 0);

  protected readonly getArticle = getArticle;
  protected readonly beautifyGenus = beautifyGenus;

  readonly showGenusHint = computed(() =>
    this.needsVowelArticle() || this.genus() === 'mpl' || this.genus() === 'fpl'
  );
}
