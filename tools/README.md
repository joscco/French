# Daten- und Audio-Tools

## Übersicht

Dieses Verzeichnis enthält Skripte zur Verwaltung und Generierung von Vokabular-Daten und Audio-Dateien (TTS). Die Shell-Skripte sind der zentrale Einstiegspunkt für Server, Batch-Generierung und Datenpflege.

## Funktionsweise

Jedes Shell-Skript:
1. Erstellt automatisch eine Python Virtual Environment (`.venv-*`)
2. Installiert die benötigten Dependencies aus der jeweiligen `requirements-*.txt`
3. Führt das entsprechende Python-Modul aus

## Daten- und Audio-Server starten

```bash
./tools/data_server/start_server.sh
```

Das Skript:
- Setzt automatisch `GOOGLE_APPLICATION_CREDENTIALS` (falls `keys/google-tts-service-account.json` existiert)
- Erstellt/aktiviert die Python Virtual Environment
- Installiert Dependencies
- Startet den Server auf `http://localhost:3001`

Im Editor erscheint dann ein 🎙️-Button zum Generieren von Audio.

## Batch-Generierung für Sätze

```bash
# Französische Sätze
./tools/data_server/batch_generate_tts.sh sentences --ids 1-10 --lang fr

# Deutsche Sätze
./tools/data_server/batch_generate_tts.sh sentences --ids 1-10 --lang de

# Beide Sprachen
./tools/data_server/batch_generate_tts.sh sentences --ids 1-10 --lang both
```

## Batch-Generierung für Terme

```bash
# Alle Terme im ID-Bereich (Sprache aus CSV)
./tools/data_server/batch_generate_tts.sh terms --ids 1-50

# Nur französische Terme
./tools/data_server/batch_generate_tts.sh terms --ids 1-50 --lang fr

# Nur deutsche Terme
./tools/data_server/batch_generate_tts.sh terms --ids 1-50 --lang de
```

## Ausgabe-Dateien

- Sätze: `public/sounds/{lang}{id}.mp3` (z.B. `fr1.mp3`, `de1.mp3`)
- Terme: `public/sounds/term_{lang}{id}.mp3` (z.B. `term_fr1.mp3`, `term_de1.mp3`)

## Hinweise
- Die Python-Module liegen unter `tools/data_server/python/`
- Die Skripte funktionieren nur als Modul-Aufruf (z.B. `python -m tools.data_server.python.tts_generate ...`)
- Die Datenverwaltung kann bei Bedarf erweitert werden (z.B. Index-Generierung, CSV-Validierung)
