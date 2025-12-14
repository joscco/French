import {Component, effect, ElementRef, input, output, viewChild,} from '@angular/core';
import {CommonModule} from '@angular/common';
import {gsap} from 'gsap';
import {TermTooltipVm} from '../../../services/term-lookup.service';
import {getArticle, reverseLanguage} from '../../../helpers/utils';
import {Language} from '../../../models/types';
import {FrenchTerm} from '../../../models/french-term';
import {GermanTerm} from '../../../models/german-term';

@Component({
  selector: 'app-term-tooltip-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './term-tooltip-overlay.component.html',
})
export class TermTooltipOverlayComponent {
  open = input(false);
  selectedVM = input<TermTooltipVm | undefined>(undefined);
  x = input(0);
  y = input(0);
  basisX = input<'left' | 'center' | 'right'>('center');
  panelRectChange = output<DOMRect>();
  panel = viewChild<ElementRef<HTMLElement>>('panel');
  lastVm: TermTooltipVm | undefined;

  constructor() {
    effect(() => {
      this.lastVm = this.selectedVM() ? this.selectedVM() : this.lastVm;
    });

    effect(() => {
      if (!this.open()) return;
      const el = this.panel()?.nativeElement;
      if (!el) return;

      // nach Layout messen
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        this.panelRectChange.emit(r);
      });
    })

    let open = effect(() => {
      const el = this.panel()?.nativeElement;
      if (!el) return;

      gsap.killTweensOf(el);
      gsap.to(el, {
        autoAlpha: this.open() ? 1 : 0,
        scale: this.open() ? 1 : 0.98,
        duration: 0.14,
        ease: 'power2.out',
      });
    });
  }

  protected getArticleFromTerm(language: Language, term: FrenchTerm | GermanTerm): string {
    if (language === 'german') {
      return getArticle('german', term.genus!, false);
    }
    return getArticle('french', term.genus!, (term as FrenchTerm).needsVowelArticle!);
  }

  protected readonly reverseLanguage = reverseLanguage;
  protected readonly getArticle = getArticle;
}
