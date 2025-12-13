import {Component, computed, effect, ElementRef, input, output, signal, viewChild,} from '@angular/core';
import {CommonModule} from '@angular/common';
import {gsap} from 'gsap';
import {TermRefInSentence} from '../../models/term-ref-in-sentence';
import {TermTooltipVm} from '../../services/term-lookup.service';
import {beautifyGenus, getArticle, reverseLanguage} from '../../helpers/utils';

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

  panelRectChange = output<DOMRect>();

  panel = viewChild<ElementRef<HTMLElement>>('panel');
  lastVm: TermTooltipVm | undefined;

  constructor() {
    effect(() => {
      this.lastVm = this.selectedVM() ? this.selectedVM() : this.lastVm;
    });

    let open = effect(() => {
      if (!this.open()) {
        return;
      }

      const el = this.panel()?.nativeElement;
      if (!el) {
        return;
      }

      gsap.killTweensOf(el)
      gsap.to(el, {
        autoAlpha: 1,
        scale: 1,
        duration: 0.14,
        ease: 'power2.out',
      });
    });

    let close = effect(() => {
      if (this.open()) {
        return;
      }

      const el = this.panel()?.nativeElement;
      if (!el) {
        return;
      }

      gsap.killTweensOf(el);
      gsap.to(el, {
        autoAlpha: 0,
        scale: 0.98,
        duration: 0.14,
        ease: 'power2.out',
      });
    });
  }

  protected readonly beautifyGenus = beautifyGenus;
  protected readonly getArticle = getArticle;
  protected readonly reverseLanguage = reverseLanguage;
}
