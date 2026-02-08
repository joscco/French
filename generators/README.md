# Generatoren

## Übersicht

Dieses Verzeichnis enthält Skripte zur Generierung von Vokabular-Daten und Audio-Dateien. Die Shell-Skripte in den jeweiligen Ordnern sind der zentrale Einstiegspunkt.

## Funktionsweise

Jedes Shell-Skript:
1. Erstellt automatisch eine Python Virtual Environment (`.venv-*`)
2. Installiert die benötigten Dependencies aus der jeweiligen `requirements-*.txt`
3. Führt das entsprechende Python-Skript aus

## Vokabular generieren

```bash
generators/generate-vocabulary/generate_vocabulary.sh
```

## Stimmen zu Sätzen 1-10 generieren

```bash
generators/generate-tts/generate_tts.sh --ids 1-10
generators/generate-tts/generate_tts.sh --ids 1
generators/generate-tts/generate_tts.sh --ids 1,3,10
```
