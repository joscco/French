# French Repository

[Live-Demo](https://joscco.github.io/French)

## Beschreibung
- Ein Vokabeltrainer-Tool für den Französischunterricht.

## Features
- Datenquelle: words.csv (Semikolon-getrennt, UTF-8, mit Headern)
- Lektion-Filter: Auswahl „Alle“ oder „Lektion n“ aus den CSV-Daten
- Übungsmodi: FR→DE, DE→FR, gemischt
- Flashcards: Karte wenden und per Navigation durch die Karten gehen
- PDF-Export: aktuell gefilterte Vokabeln als PDF-Tabelle herunterladen
  - Artikel (FR: le/la/les, l’ via Flag fr_needs_vowel_article; DE: der/die/das/die Pl.)
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
```bash
npm install
npm start
```
- Läuft standardmäßig unter http://localhost:4200

## Build
```bash
npm run build
```
- Ausgabepfad: dist/

## Datenformat (CSV)
- Erwartete Header: lesson;id;category;fr_word;fr_genus;fr_needs_vowel_article;fr_sentence;de_word;de_genus;de_sentence
- Semikolon als Trennzeichen; Anführungszeichen für Felder mit Trennzeichen/Zeilenumbrüchen
