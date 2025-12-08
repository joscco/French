import {Component, Input, ViewChild, ElementRef, OnChanges, SimpleChanges, OnDestroy, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {CardFaceComponent} from './card-face/card-face.component';
import {LangIndicatorComponent} from '../../lang-indicator/lang-indicator.component';
import gsap from 'gsap';
import {Language, reverseLanguage} from '../../practice/practice.component';

@Component({
  selector: 'app-flashcard-card',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, CardFaceComponent, LangIndicatorComponent],
  templateUrl: './flashcard-card.component.html'
})
export class FlashcardCardComponent implements OnChanges, OnDestroy {
  @Input() meta?: Record<string, any>;
  @Input() frenchPrimary = '';
  @Input() frenchSecondary = '';
  @Input() germanPrimary = '';
  @Input() germanSecondary = '';
  @Input() frontLang: Language = 'french';
  @Input() flipped = false; // welches Face ist sichtbar
  @Input() flipDirection = 'up';
  @Input() hovered = false; // für Opacity der Flip-Hilfe
  @Input() interactive = true; // Cursor/Pointer
  @Input() isTouchscreen!: boolean;

  @ViewChild('faceContainer', {static: false}) faceContainer?: ElementRef<HTMLDivElement>;
  public animating = false;
  public currentFace: Language = 'french';

  isSpeaking = signal(false);
  private audio?: HTMLAudioElement;

  ngOnChanges(changes: SimpleChanges) {
    const nextFace = this.getNextFace();

    // Bei Kartenwechsel: Audio stoppen und Face direkt setzen
    if (changes['frenchPrimary']) {
      this.stopSpeaking();
      this.currentFace = nextFace;
      return;
    }

    // Face-Wechsel animieren
    if (nextFace !== this.currentFace) {
      this.animateFlip();
    }
  }

  ngOnDestroy() {
    this.stopSpeaking();
  }

  private getNextFace() {
    return this.flipped ? reverseLanguage(this.frontLang) : this.frontLang;
  }

  animateFlip() {
    if (!this.faceContainer) {
      this.currentFace = this.flipped ? this.frontLang : this.frontLang;
      return;
    }
    this.animating = true;
    const el = this.faceContainer.nativeElement;
    // Altes Face nach oben and opacity 0
    gsap.to(el, {
      y: this.flipDirection === 'up' ? -40 : 40,
      opacity: 0,
      duration: 0.25,
      onComplete: () => {
        // Face wechseln
        this.currentFace = this.getNextFace();
        // Wenn nicht französisch sichtbar, Audio stoppen
        if (this.currentFace !== 'french' && this.isSpeaking()) {
          this.stopSpeaking();
        }
        // Neues Face von unten and opacity 0 auf 1
        gsap.fromTo(
          el,
          {y: this.flipDirection === 'up' ? 40 : -40, opacity: 0},
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

  private visibleLanguage(): Language {
    return this.currentFace;
  }

  canSpeak(): boolean {
    // Nur auf französischer Seite und wenn eine ID vorhanden ist
    return this.visibleLanguage() === 'french' && !!this.meta?.['id'];
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
    const id = this.meta?.['id'];
    const src = new URL(`sounds/fr${id}.mp3`, document.baseURI).toString();

    // Vorherige stoppen und persistenten Audio-Player verwenden
    this.stopSpeaking();
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'none';
      this.audio.onended = () => this.stopSpeaking();
      this.audio.onerror = (e) => {
        console.error('Audio-Fehler beim Laden/Abspielen', { src: this?.audio?.src, event: e });
        this.stopSpeaking();
      };
    }

    try {
      this.audio.src = src;
      // iOS benötigt häufig ein explizites load() vor play()
      this.audio.load();
      this.isSpeaking.set(true);
      const p = this.audio.play();
      if (p && typeof p.then === 'function') {
        p.catch((err) => {
          console.error('Audio play() abgelehnt/fehlgeschlagen', { src, err });
          this.stopSpeaking();
        });
      }
    } catch (err) {
      console.error('Audio-Ausnahme beim Start', { src, err });
      this.stopSpeaking();
    }
  }

  private stopSpeaking() {
    try {
      if (this.audio) {
        this.audio.pause();
        this.audio.currentTime = 0;
        // Quelle nicht komplett leeren, um User-Gesten-Freigabe nicht zu verlieren
      }
    } finally {
      this.isSpeaking.set(false);
    }
  }
}
