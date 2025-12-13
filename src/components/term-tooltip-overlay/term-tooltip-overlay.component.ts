import {
  Component,
  ElementRef,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TermRef } from '../../models/term-ref';
import { TermTooltipVm } from '../../services/term-lookup.service';
import { gsap } from 'gsap';

@Component({
  selector: 'app-term-tooltip-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './term-tooltip-overlay.component.html',
})
export class TermTooltipOverlayComponent {
  // desired state from parent
  open = input(false);
  vm = input<TermTooltipVm | undefined>(undefined);
  x = input(0);
  y = input(0);

  // events
  closeRequest = output<void>();
  tooltipEnter = output<void>();
  tooltipLeave = output<void>();
  textForRef = input<(ref: TermRef) => string>( (r: any) => `${r.lang}:${r.id}`);

  // ✅ NEW: report panel rect for hover-zone logic in parent
  panelRectChange = output<DOMRect>();

  // internal render state so we can animate OUT before removing from DOM
  private rendered = signal(false);

  // panel ref
  panel = viewChild<ElementRef<HTMLElement>>('panel');

  shouldRender = computed(() => this.rendered());

  private destroyRef = inject(DestroyRef);
  private ro?: ResizeObserver;

  constructor() {
    // open => render + animate in + start measuring
    effect(() => {
      if (!this.open()) return;

      if (!this.rendered()) this.rendered.set(true);

      afterNextRender(() => {
        const el = this.panel()?.nativeElement;
        if (!el) return;

        // measure once
        this.panelRectChange.emit(el.getBoundingClientRect());

        // keep measuring (GSAP scale affects rect)
        this.ro?.disconnect();
        this.ro = new ResizeObserver(() => {
          this.panelRectChange.emit(el.getBoundingClientRect());
        });
        this.ro.observe(el);

        // cleanup on destroy
        this.destroyRef.onDestroy(() => {
          this.ro?.disconnect();
          this.ro = undefined;
        });

        // animate in
        gsap.killTweensOf(el);
        gsap.set(el, { opacity: 0, scale: 0.96, transformOrigin: '50% 100%' });
        gsap.to(el, { opacity: 1, scale: 1, duration: 0.2, ease: 'power2.out' });
      });
    });

    // close => animate out, then unrender
    effect(() => {
      if (this.open()) return;
      if (!this.rendered()) return;

      const el = this.panel()?.nativeElement;
      if (!el) {
        this.rendered.set(false);
        return;
      }

      gsap.killTweensOf(el);
      gsap.to(el, {
        opacity: 0,
        scale: 0.96,
        duration: 0.2,
        ease: 'power2.out',
        onComplete: () => this.rendered.set(false),
      });
    });
  }
}
