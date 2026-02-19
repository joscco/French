# FrenchCourse – Vokabel- und Satztrainer

[Live-Demo](https://joscco.github.io/French)

## Übersicht
Ein flexibles Tool für den Französischunterricht: Vokabeln, Sätze, Audio, Editieren, Export und mehr.

## Features
- **CSV-basierte Datenhaltung**: terms.csv, sentences.csv, units.csv, groups.csv, ...
- **Filter**: Nach Gruppe, Unit, Sprache, Audio-Status, uvm. ("All"-Optionen überall)
- **Editor**: Sätze und Terme bearbeiten, anlegen, löschen, mit Material Icons und Audio-Status
- **Audio**: TTS-Integration (Google), Statusspalten in CSV, Batch- und Einzelgenerierung, Statusanzeige
- **Navigation**: Pfeiltasten & ASDW, Enter, Escape, uvm. für schnelle Bearbeitung
- **Material Icons**: Für Aktionen, Status, Navigation, Download, etc.
- **PDF-Export**: Gefilterte Vokabeln/Sätze als PDF (jsPDF)
- **Statisches Deployment**: z.B. GitHub Pages

## Technik
- Angular 20, RxJS, Signals
- Tailwind CSS
- Angular Material (Icons, Tooltip, Inputs)
- jsPDF + jspdf-autotable
- Python (TTS-Server, Google Cloud)

## Lokale Entwicklung

### App starten
```bash
npm install
npm start
```
- Läuft unter http://localhost:4200

### Editor & TTS
- Editor unter http://localhost:4200/editor
- Sätze und Terme editieren, Audio generieren, Status prüfen
- Filter für Gruppen, Units, Sprache, Audio-Status, uvm.
- Material Icons für Aktionen und Status

#### TTS-Server starten
```bash
./generators/generate-tts/start_tts_server.sh
```
- Setzt GOOGLE_APPLICATION_CREDENTIALS automatisch
- Erstellt/aktiviert Python venv, installiert Dependencies
- Startet Server auf http://localhost:3001

#### Audio-Generierung
- Einzelgenerierung im Editor (🎙️-Button)
- Batch-Generierung:
```bash
./generators/generate-tts/generate_tts.sh sentences --ids 1-100 --lang fr
./generators/generate-tts/generate_tts.sh sentences --ids 1-100 --lang de
./generators/generate-tts/generate_tts.sh sentences --ids 1-100 --lang both
./generators/generate-tts/generate_tts.sh terms --ids 1-50
```
- Audio-Dateien: public/sounds/{lang}{id}.mp3, public/sounds/term_{lang}{id}.mp3
- Statusspalten in CSV werden automatisch aktualisiert

## Build & Deployment
```bash
npm run build
```
- Output: dist/
- Statisches Deployment möglich (z.B. GitHub Pages)

## Datenformate
- **terms.csv**: id, lang, term_text, category, genus, needs_vowel_article, unitId, group_id, tags, has_audio, ...
- **sentences.csv**: id, unitId, fr, de, note, has_audio_fr, has_audio_de, ...
- **units.csv**: id, group_id, name, ...
- **groups.csv**: id, name, ...
- Semikolon als Trennzeichen, UTF-8, Headerzeile

## Shortcuts & Bedienung
- Navigation: Pfeiltasten, ASDW, Enter, Escape
- Filter: Sprache, Gruppe, Unit, Audio-Status, Textsuche
- Aktionen: Material Icons für Edit, Audio, Download, etc.

## Hinweise
- Editor und App sind für statisches Hosting optimiert
- Audio-Status wird beim Speichern automatisch geprüft
- Bei Problemen mit Tooltips/Overlays: stacking context beachten (siehe Code-Kommentare)

---

Fragen, Feedback oder PRs willkommen!
