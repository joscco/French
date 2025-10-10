import {Component, Input, ViewChild, ElementRef, OnChanges, SimpleChanges, OnInit, OnDestroy, signal} from '@angular/core';
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
export class FlashcardCardComponent implements OnInit, OnChanges, OnDestroy {
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

  // Speech
  private voices: SpeechSynthesisVoice[] = [];
  private utter?: SpeechSynthesisUtterance;
  isSpeaking = signal(false);

  ngOnInit() {
    this.initVoices();
  }

  ngOnChanges(changes: SimpleChanges) {
    const nextFace = this.getNextFace();

    // Bei Kartenwechsel: Sprechen stoppen und Face direkt setzen
    if (changes['frenchPrimary']) {
      this.stopSpeaking();
      this.currentFace = nextFace;
      return;
    }

    // Face-Wechsel animieren
    if (nextFace !== this.currentFace) {
      this.stopSpeaking();
      this.animateFlip();
    }
  }

  ngOnDestroy() {
    this.stopSpeaking();
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (synth) synth.onvoiceschanged = null as any;
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

  private initVoices() {
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) return;
    const load = () => { this.voices = synth.getVoices() || []; };
    load();
    synth.onvoiceschanged = () => load();
  }

  private pickVoiceFor(lang: Language): SpeechSynthesisVoice | undefined {
    const locale = lang === 'french' ? 'fr' : 'de';
    return this.voices.find(v => v.lang?.toLowerCase().startsWith(locale + '-'))
        || this.voices.find(v => v.lang?.toLowerCase().startsWith(locale));
  }

  private visibleLanguage(): Language {
    return this.currentFace;
  }

  private getSpeakText(): string | null {
    const lang = this.visibleLanguage();
    const fr = (this.frenchSecondary || this.frenchPrimary || '').trim();
    const de = (this.germanSecondary || this.germanPrimary || '').trim();
    if (lang === 'french') return fr || null;
    return de || null;
  }

  canSpeak(): boolean {
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) return false;
    const text = this.getSpeakText();
    return !!text && text.trim().length > 0;
  }

  toggleSpeak(ev: MouseEvent) {
    ev.stopPropagation();
    if (this.isSpeaking()) {
      this.stopSpeaking();
    } else {
      this.startSpeaking();
    }
  }

  private startSpeaking() {
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) return;
    const text = this.getSpeakText();
    if (!text) return;

    // Vorherige stoppen
    this.stopSpeaking();

    const lang = this.visibleLanguage();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'french' ? 'fr-FR' : 'de-DE';
    const voice = this.pickVoiceFor(lang);
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => this.isSpeaking.set(false);
    u.onerror = () => this.isSpeaking.set(false);

    this.utter = u;
    this.isSpeaking.set(true);
    synth.speak(u);
  }

  private stopSpeaking() {
    const synth = (window as any).speechSynthesis as SpeechSynthesis | undefined;
    if (!synth) return;
    try {
      synth.cancel();
    } finally {
      this.isSpeaking.set(false);
      this.utter = undefined;
    }
  }
}
