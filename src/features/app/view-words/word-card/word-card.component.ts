import {
  Component,
  computed,
  effect,
  ElementRef,
  input,
  OnDestroy,
  signal,
  ViewChild
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import gsap from 'gsap';
import {reverseLanguage} from '../../helpers/utils';
import {Lang} from '../../../../shared/contract/contract';
import {LangIndicatorComponent} from '../../shared/lang-indicator/lang-indicator.component';
import {CardFaceComponent} from '../card-face/card-face.component';
import {WordCardBackVm} from '../../models/word-card';
import {TermInlineComponent} from '../term-inline/term-inline.component';

@Component({
  selector: 'app-word-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, LangIndicatorComponent, CardFaceComponent, TermInlineComponent],
  templateUrl: './word-card.component.html'
})
export class WordCardComponent implements OnDestroy {
  meta = input<Record<string, any>>();
  frenchPrimary = input('');
  frenchSecondary = input('');
  germanPrimary = input('');
  germanSecondary = input('');
  flipDirection = input('up');
  isTouchscreen = input<boolean>(false);

  frenchTermId = input<number | undefined>();
  germanTermId = input<number | undefined>();

  backVm = input<WordCardBackVm | undefined>(undefined);

  frontLang = input<Lang>('fr');
  flipped = signal(false);
  isSpeaking = signal(false);

  frenchAudioExists = signal<boolean>(false);
  germanAudioExists = signal<boolean>(false);

  public readonly currentLanguage = computed<Lang>(() =>
    this.flipped() ? reverseLanguage(this.frontLang()) : this.frontLang()
  );

  readonly headPrimary = computed(() => this.frontLang() === 'fr' ? this.frenchPrimary() : this.germanPrimary());
  readonly headSecondary = computed(() => this.frontLang() === 'fr' ? this.frenchSecondary() : this.germanSecondary());

  @ViewChild('headBlock', {static: false}) headBlock?: ElementRef<HTMLDivElement>;
  @ViewChild('detailsBlock', {static: false}) detailsBlock?: ElementRef<HTMLDivElement>;
  @ViewChild('detailsWrap', {static: false}) detailsWrap?: ElementRef<HTMLDivElement>;

  public animating = false;
  private audio?: HTMLAudioElement;
  private tl?: gsap.core.Timeline;

  constructor() {
    // Reset when inputs change
    effect(() => {
      this.frenchPrimary();
      this.germanPrimary();
      this.frontLang();

      this.stopSpeaking();
      this.flipped.set(false);

      // Reset animation state immediately (no flicker)
      queueMicrotask(() => this.resetToFrontVisualState());
    });

    // Check audio existence when term IDs change
    effect(() => {
      const frId = this.frenchTermId();
      if (frId !== undefined) {
        this.checkAudioExists('fr', frId);
      } else {
        this.frenchAudioExists.set(false);
      }
    });

    effect(() => {
      const deId = this.germanTermId();
      if (deId !== undefined) {
        this.checkAudioExists('de', deId);
      } else {
        this.germanAudioExists.set(false);
      }
    });
  }

  private resetToFrontVisualState() {
    if (!this.headBlock || !this.detailsBlock || !this.detailsWrap) {
      return;
    }

    this.tl?.kill();
    this.tl = undefined;

    // GPU friendly
    gsap.set(this.headBlock.nativeElement, { y: 0, scale: 1, force3D: true, transformOrigin: '50% 50%' });

    // Details initial: unsichtbar + Wrapper Höhe 0
    gsap.set(this.detailsBlock.nativeElement, { opacity: 0, y: 8, force3D: true, pointerEvents: 'none' });
    gsap.set(this.detailsWrap.nativeElement, { height: 0 });

    this.animating = false;
  }

  private animateFlip(toBack: boolean) {
    if (!this.headBlock || !this.detailsBlock || !this.detailsWrap) {
      return;
    }

    this.animating = true;
    this.tl?.kill();
    this.tl = undefined;

    const headEl = this.headBlock.nativeElement;
    const detailsEl = this.detailsBlock.nativeElement;
    const wrapEl = this.detailsWrap.nativeElement;

    // kill running tweens hard, verhindert “wobble” beim schnellen klicken
    gsap.killTweensOf([headEl, detailsEl, wrapEl]);

    // Höhe für expand: erst auf auto messen (GSAP kann "auto" animieren)
    // Wir animieren wrapper-height, nicht layout-classes.
    this.tl = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        this.animating = false;
        this.tl = undefined;

        // Wenn offen, Height auf "auto" lassen, damit content/scroll später (Bilder) sauber wächst
        if (toBack) {
          gsap.set(wrapEl, { height: 'auto' });
        }
      },
    });

    if (toBack) {
      // Setze Height erst auf aktuellen Wert (0), dann to "auto"
      gsap.set(wrapEl, { height: wrapEl.offsetHeight }); // stabiler Startwert

      this.tl
        .to(headEl, { y: -10, duration: 0.26, ease: 'power3.out' }, 0)
        .to(wrapEl, { height: 'auto', duration: 0.30, ease: 'power2.out' }, 0.02)
        .to(detailsEl, { opacity: 1, y: -10, duration: 0.24, ease: 'power2.out' }, 0.08)
        .set(detailsEl, { pointerEvents: 'auto' }, 0.08);
    } else {
      // Beim Schließen: Height von auto -> 0
      // Erst fixen auf px, damit "auto" nicht springt
      gsap.set(wrapEl, { height: wrapEl.offsetHeight });

      this.tl
        .set(detailsEl, { pointerEvents: 'none' }, 0)
        .to(detailsEl, { opacity: 0, y: 10, duration: 0.18, ease: 'power2.in' }, 0)
        .to(wrapEl, { height: 0, duration: 0.26, ease: 'power2.inOut' }, 0.02)
        .to(headEl, { y: 0, duration: 0.24, ease: 'power3.out' }, 0.06);
    }
  }

  private async checkAudioExists(lang: Lang, termId: number) {
    const src = `sounds/term_${lang}${termId}.mp3`;
    try {
      const response = await fetch(src, { method: 'HEAD' });
      if (lang === 'fr') {
        this.frenchAudioExists.set(response.ok);
      } else {
        this.germanAudioExists.set(response.ok);
      }
    } catch {
      if (lang === 'fr') {
        this.frenchAudioExists.set(false);
      } else {
        this.germanAudioExists.set(false);
      }
    }
  }

  ngOnDestroy() {
    this.stopSpeaking();
    this.tl?.kill();
  }

  onCardClick() {
    const toBack = !this.flipped();
    this.flipped.set(toBack);
    this.animateFlip(toBack);
  }

  canSpeak(): boolean {
    const lang = this.currentLanguage();
    return lang === 'fr' ? this.frenchAudioExists() : this.germanAudioExists();
  }

  toggleSpeak(ev: Event) {
    ev.stopPropagation();
    if (this.isSpeaking()) {
      this.stopSpeaking();
    } else {
      this.startSpeaking();
    }
  }

  private startSpeaking() {
    if (!this.canSpeak()) {
      return;
    }

    const lang = this.currentLanguage();
    const termId = lang === 'fr' ? this.frenchTermId() : this.germanTermId();
    const src = new URL(`sounds/term_${lang}${termId}.mp3`, document.baseURI).toString();

    this.stopSpeaking();

    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'none';
      this.audio.onended = () => this.stopSpeaking();
      this.audio.onerror = (e) => {
        console.error('Audio-Fehler beim Laden/Abspielen', {src: this?.audio?.src, event: e});
        this.stopSpeaking();
      };
    }

    try {
      this.audio.src = src;
      this.audio.load();
      this.isSpeaking.set(true);

      const playPromise = this.audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch((err) => {
          console.error('Audio play() abgelehnt/fehlgeschlagen', {src, err});
          this.stopSpeaking();
        });
      }
    } catch (err) {
      console.error('Audio-Ausnahme beim Start', {src, err});
      this.stopSpeaking();
    }
  }

  private stopSpeaking() {
    try {
      if (this.audio) {
        this.audio.pause();
        this.audio.currentTime = 0;
      }
    } finally {
      this.isSpeaking.set(false);
    }
  }
}
