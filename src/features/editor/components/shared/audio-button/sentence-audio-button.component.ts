import { Component, Input, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { TTSService } from '../../../services/tts.service';
import { Lang } from '../../../../../shared/contract/contract';
import { EditorStore } from '../../../services/editor-store.service';

@Component({
  selector: 'app-sentence-audio-button',
  standalone: true,
  imports: [CommonModule, MatIcon],
  templateUrl: './sentence-audio-button.component.html',
})
export class SentenceAudioButtonComponent {
  @Input() sentenceId!: number;
  @Input() lang!: Lang;

  private readonly ttsService = inject(TTSService);
  private readonly editorStore = inject(EditorStore);

  private readonly TTS_SERVER_URL = 'http://localhost:3001';

  isPlaying = signal(false);
  isGenerating = signal(false);
  generateError = signal<string | null>(null);

  private audioElement: HTMLAudioElement | null = null;

  readonly hasAudio = computed(() => {
    return this.editorStore.hasSentenceAudio(this.lang as any, this.sentenceId);
  });

  private getAudioPath(): string {
    return `${this.TTS_SERVER_URL}/sounds/${this.lang}${this.sentenceId}.mp3`;
  }

  private canPlay(): boolean {
    return this.hasAudio();
  }

  playAudio() {
    if (!this.canPlay()) {
      return;
    }

    const path = this.getAudioPath();
    this.stopAudio();

    this.audioElement = new Audio(path);
    this.audioElement.onplay = () => this.isPlaying.set(true);
    this.audioElement.onended = () => this.isPlaying.set(false);
    this.audioElement.onpause = () => this.isPlaying.set(false);
    this.audioElement.onerror = () => {
      this.isPlaying.set(false);
    };

    this.audioElement.play().catch(() => this.isPlaying.set(false));
  }

  stopAudio() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
    }
    this.isPlaying.set(false);
  }

  toggleAudio() {
    if (this.isPlaying()) {
      this.stopAudio();
    } else {
      this.playAudio();
    }
  }

  async generateAudio() {
    this.isGenerating.set(true);
    this.generateError.set(null);

    const result = await this.ttsService.generateSentenceAudio(this.sentenceId, this.lang);

    this.isGenerating.set(false);

    if (result.success) {
      this.editorStore.markSentenceAudioGenerated(this.lang as any, this.sentenceId);
      setTimeout(() => this.playAudio(), 100);
    } else {
      this.generateError.set(result.error ?? 'Unbekannter Fehler');
    }
  }

  get ttsServerAvailable() {
    return this.ttsService.serverAvailable();
  }
}
