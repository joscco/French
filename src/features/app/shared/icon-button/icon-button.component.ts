import {Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIcon} from '@angular/material/icon';
import gsap from 'gsap';

@Component({
  selector: 'app-icon-button',
  standalone: true,
  imports: [CommonModule, MatIcon],
  templateUrl: './icon-button.component.html',
})
export class IconButtonComponent {
  @Input() iconName: string = '';
  @Input() tooltip?: string = '';
  @Input() enabled?: boolean = true;
  @Input() tooltipPosition?: 'top' | 'bottom' = 'top';
  @Input() label?: string;
  @Input() chevron?: boolean = false;
  @Input() size: 'sm' | 'md' = 'md';

  @Output() onClick = new EventEmitter<Event | undefined>();

  tooltipYHiddenTop = -25;
  tooltipYVisibleTop = -30;
  tooltipYHiddenBottom = 25;
  tooltipYVisibleBottom = 30;

  @ViewChild('tooltipEl') tooltipEl?: ElementRef<HTMLSpanElement>;

  @HostListener('mouseenter') onMouseEnter() {
    queueMicrotask(() => this.animateTooltipIn());
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.animateTooltipOut();
  }

  @HostListener('focus') onFocus() {
    queueMicrotask(() => this.animateTooltipIn());
  }

  @HostListener('blur') onBlur() {
    this.animateTooltipOut();
  }

  private animateTooltipIn() {
    if (!this.tooltipEl || !this.tooltip) {
      return;
    }
    const el = this.tooltipEl.nativeElement;
    const isTop = this.tooltipPosition === 'top';
    const tooltipYHidden = isTop ? this.tooltipYHiddenTop : this.tooltipYHiddenBottom;
    const tooltipYVisible = isTop ? this.tooltipYVisibleTop : this.tooltipYVisibleBottom;
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      {opacity: 0, y: tooltipYHidden},
      {opacity: 1, y: tooltipYVisible, duration: 0.18, ease: 'power2.out'}
    );
  }

  private animateTooltipOut() {
    if (!this.tooltipEl || !this.tooltip) {
      return;
    }
    const el = this.tooltipEl.nativeElement;
    const isTop = this.tooltipPosition === 'top';
    const tooltipYHidden = isTop ? this.tooltipYHiddenTop : this.tooltipYHiddenBottom;
    gsap.killTweensOf(el);
    gsap.to(el, {
      opacity: 0,
      y: tooltipYHidden,
      duration: 0.15,
      ease: 'power2.in'
    });
  }
}
