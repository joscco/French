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
  @Output() onClick = new EventEmitter<Event | undefined>();

  @Input() tooltip?: string = '';
  @Input() enabled?: boolean = true;

  tooltipYHidden = -35;
  tooltipYVisible = -40;

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
    gsap.killTweensOf(el);
    gsap.fromTo(
      el,
      {opacity: 0, y: this.tooltipYHidden},
      {opacity: 1, y: this.tooltipYVisible, duration: 0.18, ease: 'power2.out'}
    );
  }

  private animateTooltipOut() {
    if (!this.tooltipEl || !this.tooltip) {
      return;
    }
    const el = this.tooltipEl.nativeElement;
    gsap.killTweensOf(el);
    gsap.to(el, {
      opacity: 0,
      y: this.tooltipYHidden,
      duration: 0.15,
      ease: 'power2.in'
    });
  }
}
