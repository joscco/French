import {ChangeDetectionStrategy, Component, computed, EventEmitter, input, Output, ViewChild, ElementRef} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-scrubber',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scrubber.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrubberComponent {
  isTouchScreen = input(false);
  length = input(0);
  currentIndex = input(0);
  scrubPreview = input<{ active: boolean; idx: number; label: string } | undefined>(undefined);

  @Output() pointerDown = new EventEmitter<PointerEvent>();
  @Output() pointerMove = new EventEmitter<PointerEvent>();
  @Output() pointerUp = new EventEmitter<void | PointerEvent>();

  @ViewChild('scrubberEl', {static: false}) scrubberEl?: ElementRef<HTMLElement>;

  dots = computed(() => {
    const len = this.length();
    const current = this.currentIndex();
    const preview = this.scrubPreview();
    const activeIdx = preview?.active ? preview.idx : current;

    return Array.from({length: len}, (_, i) => {
      const distance = Math.abs(i - activeIdx);
      const opacity = this.getOpacityForDistance(distance);
      return {
        index: i,
        isActive: i === activeIdx,
        opacity
      };
    });
  });

  private getOpacityForDistance(distance: number): number {
    if (distance === 0) return 1;
    if (distance === 1) return 0.7;
    if (distance === 2) return 0.5;
    if (distance === 3) return 0.35;
    if (distance === 4) return 0.25;
    if (distance === 5) return 0.15;
    return 0.08;
  }
}
