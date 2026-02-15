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

## TTS Audio generieren

### Server-Modus (für Editor-Integration)

Startet einen lokalen HTTP-Server, der vom Editor genutzt wird:

```bash
./generators/generate-tts/start_tts_server.sh
```

Das Skript:
- Setzt automatisch `GOOGLE_APPLICATION_CREDENTIALS` (falls `keys/google-tts-service-account.json` existiert)
- Erstellt/aktiviert die Python Virtual Environment
- Installiert Dependencies
- Startet den Server auf `http://localhost:3001`

Im Editor erscheint dann ein 🎙️-Button zum Generieren von Audio.

### Batch-Generierung für Sätze

```bash
# Französische Sätze
./generators/generate-tts/generate_tts.sh sentences --ids 1-10 --lang fr

# Deutsche Sätze
./generators/generate-tts/generate_tts.sh sentences --ids 1-10 --lang de

# Beide Sprachen
./generators/generate-tts/generate_tts.sh sentences --ids 1-10 --lang both
```

### Batch-Generierung für Terme

```bash
# Alle Terme im ID-Bereich (Sprache aus CSV)
./generators/generate-tts/generate_tts.sh terms --ids 1-50

# Nur französische Terme
./generators/generate-tts/generate_tts.sh terms --ids 1-50 --lang fr

# Nur deutsche Terme
./generators/generate-tts/generate_tts.sh terms --ids 1-50 --lang de
```

### Ausgabe-Dateien

- Sätze: `public/sounds/{lang}{id}.mp3` (z.B. `fr1.mp3`, `de1.mp3`)
- Terme: `public/sounds/term_{lang}{id}.mp3` (z.B. `term_fr1.mp3`, `term_de1.mp3`)

