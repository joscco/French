from pathlib import Path
import os

# Finde das Projekt-Root-Verzeichnis (enthält angular.json)
def find_project_root():
    current = Path(__file__).resolve().parent
    for _ in range(10):
        if (current / "angular.json").exists():
            return current
        parent = current.parent
        if parent == current:
            break
        current = parent
    return Path.cwd()

PROJECT_ROOT = find_project_root()
SENTENCES_CSV_PATH = PROJECT_ROOT / "public/data/sentences.csv"
TERMS_CSV_PATH = PROJECT_ROOT / "public/data/terms.csv"
OUTPUT_BASE = PROJECT_ROOT / "public/sounds"

TTS_VOICES = {
    "fr": os.getenv("TTS_VOICE_FR", "fr-FR-Chirp3-HD-Enceladus"),
    "de": os.getenv("TTS_VOICE_DE", "de-DE-Chirp3-HD-Enceladus"),
}
TTS_SAMPLE_RATE = int(os.getenv("TTS_SAMPLE_RATE", "24000"))

# Zentrale Konfiguration für TTS, Pfade, Defaults

TTS_AUDIO_DIR = '../../public/sounds/'
TTS_CSV_PATH = '../../public/data/terms.csv'
# TODO: Weitere Konfigurationswerte
