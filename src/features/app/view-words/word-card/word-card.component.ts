import {
  Component, computed,
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
import {CardFaceComponent} from '../card-face/card-face.component';
import {LangIndicatorComponent} from '../../shared/lang-indicator/lang-indicator.component';
import gsap from 'gsap';
import {reverseLanguage} from '../../helpers/utils';
import {Lang} from '../../../../shared/contract/contract';

@Component({
  selector: 'app-word-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, CardFaceComponent, LangIndicatorComponent],
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

  // Term-IDs für Audio-Wiedergabe
  frenchTermId = input<number | undefined>();
  germanTermId = input<number | undefined>();

  frontLang = input<Lang>('fr');
  flipped = signal(false);
  isSpeaking = signal(false);

  // Audio-Existenz-Status
  frenchAudioExists = signal<boolean>(false);
  germanAudioExists = signal<boolean>(false);

  public readonly currentLanguage = computed<Lang>(() =>
    this.flipped() ? reverseLanguage(this.frontLang()) : this.frontLang()
  );
  renderLanguage = signal<Lang>(this.frontLang());

  @ViewChild('faceContainer', {static: false}) faceContainer?: ElementRef<HTMLDivElement>;
  public animating = false;
  private audio?: HTMLAudioElement;

  constructor() {
    // Reset when input changes
    effect(() => {
      // Track these signals
      this.frenchPrimary();
      this.germanPrimary();

      this.stopSpeaking();
      this.flipped.set(false);
      this.renderLanguage.set(this.frontLang());
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
  }

  onCardClick() {
    this.flipped.update(v => !v);
    this.animateFlip();
  }

  animateFlip() {
    if (!this.faceContainer) {
      return;
    }

    this.animating = true;
    const el = this.faceContainer.nativeElement;
    gsap.to(el, {
      y: this.flipDirection() === 'up' ? -40 : 40,
      opacity: 0,
      duration: 0.25,
      onComplete: () => {
        this.renderLanguage.set(this.currentLanguage());
        if (this.renderLanguage() !== 'fr' && this.isSpeaking()) {
          this.stopSpeaking();
        }
        gsap.fromTo(
          el,
          {y: this.flipDirection() === 'up' ? 40 : -40, opacity: 0},
          {
            y: 0,
            opacity: 1,
            duration: 0.25,
            onComplete: () => {
              this.animating = false;
            }
          }
        );
      }
    });
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
