import {Component, computed, input, output} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TermRef} from '../../models/term-ref';
import {PromptSegment} from '../../helpers/prompt-markup';

@Component({
  selector: 'app-prompt-markup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prompt-markup.component.html',
})
export class PromptMarkupComponent {
  segments = input<PromptSegment[]>([]);
  readonly mergedSegments = computed(() =>
    mergeTrailingPunctuation(this.segments() ?? [])
  );

  fallbackText = input<string>('');
  activeRefKey = input<string | undefined>(undefined);

  termEnter = output<{ ref: TermRef; el: HTMLElement }>();
  termLeave = output<void>();
  termClick = output<{ ref: TermRef; el: HTMLElement }>();

  private lastTermEl?: HTMLElement;
  private lastIdx?: number;

  refKey(ref?: TermRef) {
    return ref ? `${ref.lang}:${ref.key}` : undefined;
  }

  private findTermElFromEventTarget(target: EventTarget | null): HTMLElement | null {
    const el = target as HTMLElement | null;
    if (!el) return null;
    return el.closest?.('[data-term]') as HTMLElement | null;
  }

  private getRefForTermEl(termEl: HTMLElement): { ref: TermRef; idx: number } | null {
    const idxStr = termEl.getAttribute('data-seg-idx');
    if (!idxStr) return null;

    const idx = Number(idxStr);
    if (!Number.isFinite(idx)) return null;

    const seg = (this.segments() ?? [])[idx];
    if (!seg?.ref) return null;

    return { ref: seg.ref, idx };
  }

  onPointerMove(ev: PointerEvent) {
    const termEl = this.findTermElFromEventTarget(ev.target);
    if (!termEl) {
      // pointer currently over non-term text
      if (this.lastTermEl) {
        this.lastTermEl = undefined;
        this.lastIdx = undefined;
        this.termLeave.emit();
      }
      return;
    }

    // still same element? do nothing
    const info = this.getRefForTermEl(termEl);
    if (!info) return;

    if (this.lastTermEl === termEl && this.lastIdx === info.idx) return;

    // switched term
    this.lastTermEl = termEl;
    this.lastIdx = info.idx;
    this.termEnter.emit({ ref: info.ref, el: termEl });
  }

  onPointerLeave() {
    if (!this.lastTermEl) return;
    this.lastTermEl = undefined;
    this.lastIdx = undefined;
    this.termLeave.emit();
  }

  onClick(ev: MouseEvent) {
    const termEl = this.findTermElFromEventTarget(ev.target);
    if (!termEl) return;

    const info = this.getRefForTermEl(termEl);
    if (!info) return;

    ev.preventDefault();
    ev.stopPropagation();
    this.termClick.emit({ ref: info.ref, el: termEl });
  }
}

type Seg = { text: string; ref?: TermRef };

const ATTACH_TO_PREV = /^[\.,!?;:]+$|^[)\]\}»”’]+$/; // Punkt/Komma/… + schließende Klammern/Quotes

function mergeTrailingPunctuation(segs: Seg[]): Seg[] {
  const out: Seg[] = [];

  for (const seg of segs) {
    const isPunct = !seg.ref && ATTACH_TO_PREV.test(seg.text);

    if (isPunct && out.length) {
      const prev = out[out.length - 1];
      // Punkt an vorheriges Segment kleben (egal ob prev ref hat oder nicht)
      out[out.length - 1] = { ...prev, text: prev.text + seg.text };
      continue;
    }

    out.push(seg);
  }

  return out;
}
