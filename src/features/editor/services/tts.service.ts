import { Injectable, signal } from '@angular/core';

const TTS_SERVER_URL = 'http://localhost:3001';

export type TTSResult = {
  success: boolean;
  path?: string;
  error?: string;
};

@Injectable({
  providedIn: 'root',
})
export class TTSService {

  serverAvailable = signal<boolean | null>(null);

  constructor() {
    this.checkServerHealth();
  }

  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${TTS_SERVER_URL}/health`, {
        method: 'GET',
      });
      const available = response.ok;
      this.serverAvailable.set(available);
      return available;
    } catch {
      this.serverAvailable.set(false);
      return false;
    }
  }

  async generateSentenceAudio(sentenceId: number, lang: 'fr' | 'de'): Promise<TTSResult> {
    try {
      const response = await fetch(
        `${TTS_SERVER_URL}/generate/sentence?id=${sentenceId}&lang=${lang}`
      );
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'TTS Server nicht erreichbar. Starte den Server mit: python tts_generate.py server',
      };
    }
  }

  async generateTermAudio(termId: number): Promise<TTSResult> {
    try {
      const response = await fetch(
        `${TTS_SERVER_URL}/generate/term?id=${termId}`
      );
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'TTS Server nicht erreichbar. Starte den Server mit: python tts_generate.py server',
      };
    }
  }

  async saveCSV(filename: string, content: string): Promise<TTSResult> {
    try {
      const response = await fetch(`${TTS_SERVER_URL}/save/csv`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename, content }),
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Server nicht erreichbar. Starte den Server mit: ./generators/generate-tts/start_tts_server.sh',
      };
    }
  }
}

