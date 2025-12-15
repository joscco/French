import {
  AfterViewInit,
  Component, effect,
  ElementRef,
  EventEmitter,
  HostListener, input,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import gsap from 'gsap';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { LessonSelectorComponent } from '../lesson-selector/lesson-selector.component';
import { LessonOption } from '../../../models/lesson-option';
import { PracticeKind } from '../../../models/types';

@Component({
  selector: 'app-practice-panel',
  standalone: true,
  imports: [CommonModule, IconButtonComponent, LessonSelectorComponent],
  templateUrl: './practice-panel.component.html',
})
export class PracticePanelComponent implements AfterViewInit {
  // ---- inputs (state) ----
  practiceKind= input<PracticeKind>('sentence');
  lessons = input<LessonOption[]>([{ id: 'all', label: 'Alle' }]);
  selectedLesson = input<LessonOption | undefined>(undefined);

  open = input<boolean>(false)

  // ---- outputs (events) ----
  @Output() close = new EventEmitter<void>();
  @Output() practiceKindChange = new EventEmitter<PracticeKind>();
  @Output() lessonChange = new EventEmitter<LessonOption>();
  @Output() exportPdf = new EventEmitter<void>();

  @ViewChild('backdrop', { static: true }) backdrop!: ElementRef<HTMLDivElement>;
  @ViewChild('sheet', { static: true }) sheet!: ElementRef<HTMLDivElement>;

  private tl?: gsap.core.Timeline;

  constructor() {
    effect(() => {
      this.open() ? this.animateIn() : this.animateOut();
    });
  }

  ngAfterViewInit() {
    gsap.set(this.backdrop.nativeElement, { opacity: 0 });
    gsap.set(this.sheet.nativeElement, { yPercent: 100 });

    if (this.open()) {
      this.animateIn();
    }
  }

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.open()) {
      this.close.emit();
    }
  }

  onBackdropClick() {
    this.close.emit();
  }

  // UI handlers
  setPracticeKind(kind: PracticeKind) {
    if (kind !== this.practiceKind()) {
      this.practiceKindChange.emit(kind);
    }
  }

  onLessonSelected(lesson: LessonOption) {
    this.lessonChange.emit(lesson);
  }

  triggerExport() {
    this.exportPdf.emit();
  }

  // ---- GSAP ----
  private animateIn() {
    this.tl?.kill();
    gsap.killTweensOf([this.backdrop.nativeElement, this.sheet.nativeElement]);

    document.body.style.overflow = 'hidden';
    this.backdrop.nativeElement.classList.remove('pointer-events-none');

    this.tl = gsap.timeline()
      .to(this.backdrop.nativeElement, { opacity: 1, duration: 0.18, ease: 'power1.out' })
      .to(this.sheet.nativeElement, { yPercent: 0, duration: 0.32, ease: 'power3.out' }, '<');
  }

  private animateOut() {
    this.tl?.kill();
    gsap.killTweensOf([this.backdrop.nativeElement, this.sheet.nativeElement]);

    this.tl = gsap.timeline({
      onComplete: () => {
        this.backdrop.nativeElement.classList.add('pointer-events-none');
        document.body.style.overflow = '';
      },
    })
      .to(this.sheet.nativeElement, { yPercent: 100, duration: 0.22, ease: 'power2.in' })
      .to(this.backdrop.nativeElement, { opacity: 0, duration: 0.18, ease: 'power1.in' }, '<');
  }
}
