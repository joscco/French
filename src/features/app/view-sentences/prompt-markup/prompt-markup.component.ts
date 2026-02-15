import {Component, computed, input, output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {PromptSegment} from '../../helpers/prompt-markup';
import {TermRefInSentence} from '../../models/term-ref-in-sentence';

@Component({
  selector: 'app-prompt-markup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prompt-markup.component.html',
})
export class PromptMarkupComponent {
  segments = input<PromptSegment[]>([]);
  fallbackText = input<string | undefined>('');
  activeRefKey = input<string | undefined>(undefined);

  termEnter = output<{ ref: TermRefInSentence; el: HTMLElement }>();
  termLeave = output<void>();
  termClick = output<{ ref: TermRefInSentence; el: HTMLElement }>();

  readonly mergedSegments = computed(() => {
    return mergeTrailingPunctuation(this.segments() ?? []);
  });

  private lastTermElement?: HTMLElement;
  private lastSegmentIndex?: number;

  refKey(ref?: TermRefInSentence): string | undefined {
    if (!ref) {
      return undefined;
    }
    return `${ref.lang}#${ref.termId}`;
  }

  private findTermElementFromEventTarget(target: EventTarget | null): HTMLElement | null {
    const targetElement = target as HTMLElement | null;
    if (!targetElement) {
      return null;
    }
    return (targetElement.closest?.('[data-term]') as HTMLElement | null) ?? null;
  }

  private getRefForTermElement(termElement: HTMLElement): { ref: TermRefInSentence; idx: number } | null {
    const segmentIndexString = termElement.getAttribute('data-seg-idx');
    if (!segmentIndexString) {
      return null;
    }

    const segmentIndex = Number(segmentIndexString);
    if (!Number.isFinite(segmentIndex)) {
      return null;
    }

    const mergedSegments = this.mergedSegments() ?? [];
    const segment = mergedSegments[segmentIndex];

    if (!segment?.ref) {
      return null;
    }

    return { ref: segment.ref, idx: segmentIndex };
  }

  onPointerMove(pointerEvent: PointerEvent) {
    const termElement = this.findTermElementFromEventTarget(pointerEvent.target);
    if (!termElement) {
      if (this.lastTermElement) {
        this.lastTermElement = undefined;
        this.lastSegmentIndex = undefined;
        this.termLeave.emit();
      }
      return;
    }

    const termInfo = this.getRefForTermElement(termElement);
    if (!termInfo) {
      return;
    }

    if (this.lastTermElement === termElement && this.lastSegmentIndex === termInfo.idx) {
      return;
    }

    this.lastTermElement = termElement;
    this.lastSegmentIndex = termInfo.idx;
    this.termEnter.emit({ ref: termInfo.ref, el: termElement });
  }

  onPointerLeave() {
    if (!this.lastTermElement) {
      return;
    }
    this.lastTermElement = undefined;
    this.lastSegmentIndex = undefined;
    this.termLeave.emit();
  }

  onClick(mouseEvent: MouseEvent) {
    const termElement = this.findTermElementFromEventTarget(mouseEvent.target);
    if (!termElement) {
      return;
    }

    const termInfo = this.getRefForTermElement(termElement);
    if (!termInfo) {
      return;
    }

    mouseEvent.preventDefault();
    mouseEvent.stopPropagation();
    this.termClick.emit({ ref: termInfo.ref, el: termElement });
  }
}

type Seg = { text: string; ref?: TermRefInSentence };

const ATTACH_TO_PREVIOUS = /^[\.,!?;:]+$|^[)\]\}»”’]+$/;

function mergeTrailingPunctuation(segments: Seg[]): Seg[] {
  const merged: Seg[] = [];

  for (const segment of segments) {
    const isPunctuation = !segment.ref && ATTACH_TO_PREVIOUS.test(segment.text);

    if (isPunctuation && merged.length) {
      const previous = merged[merged.length - 1];
      merged[merged.length - 1] = { ...previous, text: previous.text + segment.text };
      continue;
    }

    merged.push(segment);
  }

  return merged;
}
