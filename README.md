# French Repository

[Live-Demo](https://joscco.github.io/French)

## Beschreibung
- Ein Vokabeltrainer-Tool für den Französischunterricht.

## Features
- Datenquelle: words.csv (Semikolon-getrennt, UTF-8, mit Headern)
- Lektion-Filter: Auswahl „Alle" oder „Lektion n" aus den CSV-Daten
- Übungsmodi: FR→DE, DE→FR, gemischt
- Flashcards: Karte wenden und per Navigation durch die Karten gehen
- PDF-Export: aktuell gefilterte Vokabeln als PDF-Tabelle herunterladen
  - Artikel (FR: le/la/les, l' via Flag fr_needs_vowel_article; DE: der/die/das/die Pl.)
  - Layout: 3 Spalten (Lektion | Französisch | Deutsch)
  - Zeilen: Hauptbegriffe fett; Beispielsätze klein, grau, kursiv darunter
  - Kategorie: klein/unauffällig in Klammern unter dem FR-Begriff (in der zweiten Zeile)
  - Sortierung: alphabetisch nach dem französischen Begriff

## Technik
- Angular 20, RxJS
- Tailwind CSS
- Angular Material (Tooltip, Icons)
- jsPDF + jspdf-autotable

## Lokale Entwicklung

### App starten
```bash
npm install
npm start
```
- Läuft standardmäßig unter http://localhost:4200

### Editor mit TTS-Funktionalität

Der Editor (`/editor`) ermöglicht das Bearbeiten von Sätzen und Termen. Für die **Audio-Generierung** muss ein lokaler TTS-Server laufen:

#### 1. TTS-Server starten (in separatem Terminal)
```bash
./generators/generate-tts/start_tts_server.sh
```

Das Skript:
- Setzt automatisch `GOOGLE_APPLICATION_CREDENTIALS` (falls `keys/google-tts-service-account.json` existiert)
- Erstellt/aktiviert die Python Virtual Environment
- Installiert Dependencies
- Startet den Server auf `http://localhost:3001`

#### 2. Editor öffnen
- Navigiere zu http://localhost:4200/editor
- Bei Sätzen/Termen ohne Audio erscheint ein 🎙️-Button
- Klick auf 🎙️ generiert das Audio und spielt es automatisch ab

#### Audio-Dateien
- Sätze: `public/sounds/{lang}{id}.mp3` (z.B. `fr1.mp3`, `de1.mp3`)
- Terme: `public/sounds/term_{lang}{id}.mp3` (z.B. `term_fr1.mp3`, `term_de1.mp3`)

### Batch-Generierung von Audio

Falls viele Audio-Dateien auf einmal benötigt werden:

```bash
# Französische Sätze 1-100
./generators/generate-tts/generate_tts.sh sentences --ids 1-100 --lang fr

# Deutsche Sätze 1-100
./generators/generate-tts/generate_tts.sh sentences --ids 1-100 --lang de

# Beide Sprachen
./generators/generate-tts/generate_tts.sh sentences --ids 1-100 --lang both

# Terme 1-50
./generators/generate-tts/generate_tts.sh terms --ids 1-50
```

## Build
```bash
npm run build
```
- Ausgabepfad: dist/

## Datenformat (CSV)
- Erwartete Header: lesson;id;category;fr_word;fr_genus;fr_needs_vowel_article;fr_sentence;de_word;de_genus;de_sentence
- Semikolon als Trennzeichen; Anführungszeichen für Felder mit Trennzeichen/Zeilenumbrüchen
