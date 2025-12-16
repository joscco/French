import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewChild, ElementRef} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({
  selector: 'app-scrubber',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scrubber.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrubberComponent {
  @Input() isTouchScreen = false;
  @Input() length = 0;
  @Input() thumbTopPct = 0; // number 0..100
  @Input() hotspotMask = '';
  @Input() scrubPreview?: { active: boolean; idx: number; label: string };

  @Output() pointerDown = new EventEmitter<PointerEvent>();
  @Output() pointerMove = new EventEmitter<PointerEvent>();
  @Output() pointerUp = new EventEmitter<void | PointerEvent>();

  @ViewChild('scrubberEl', {static: false}) scrubberEl?: ElementRef<HTMLElement>;
}
