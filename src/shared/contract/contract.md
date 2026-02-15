# Authoring Contract v1

Dieses Dokument definiert das Datenformat zwischen:

- Editor
- Application Runtime (Frontend)
- Import / Export Tools

**Format:** CSV mit `;` als Delimiter, UTF-8.

**Regel:** Alle Referenzen erfolgen __ausschließlich__ über numerische IDs.

---

## Inhaltsverzeichnis

1. [Tabellen-Übersicht](#tabellen-übersicht)
2. [groups.csv](#groupscsv)
3. [units.csv](#unitscsv)
4. [terms.csv](#termscsv)
5. [term_links.csv](#term_linkscsv)
6. [sentences.csv](#sentencescsv)
7. [Sentence Syntax](#sentence-syntax)

---

## Tabellen-Übersicht

### Aktive Tabellen

| Datei          | Beschreibung                          |
|----------------|---------------------------------------|
| groups.csv     | Übergeordnete Gruppen (Semester, etc.)|
| units.csv      | Logische Einheiten (Lektionen)        |
| terms.csv      | Begriffe beider Sprachen              |
| term_links.csv | Übersetzungsbeziehungen               |
| sentences.csv  | Sätze mit Annotationen                |

### Geplant (optional)

| Datei        | Beschreibung         |
|--------------|----------------------|
| media.csv    | Medienreferenzen     |

---

## groups.csv

Definiert übergeordnete Gruppen wie:

- Semester
- Bücher
- Freie Sammlungen

### Schema

```csv
id;name;date
```

### Felder

| Feld | Beschreibung     | Pflicht |
|------|------------------|---------|
| id   | Eindeutige ID    | ✓       |
| name | Anzeigename      | ✓       |
| date | Datum (ISO)      | –       |

### Beispiel

```csv
id;name;date
1;WiSe 2025;2025-09-10
2;SoSe 2026;2026-01-28
```

---

## units.csv

Definiert logische Einheiten innerhalb einer Gruppe:

- Lektionen
- Kapitel

### Schema

```csv
id;group_id;name;date;order
```

### Felder

| Feld     | Beschreibung                  | Pflicht |
|----------|-------------------------------|---------|
| id       | Eindeutige ID                 | ✓       |
| group_id | Referenz auf groups.csv       | ✓       |
| name     | Anzeigename                   | ✓       |
| date     | Datum (ISO-Format)            | –       |
| order    | Sortierreihenfolge in Gruppe  | –       |

### Beispiel

```csv
id;group_id;name;date;order
1;1;Lektion 1 | 10.09.;2025-09-10;1
2;1;Lektion 2 | 17.09.;2025-09-17;2
13;2;Lektion 1 | 28.01.;2026-01-28;1
```

---

## terms.csv

Alle Begriffe beider Sprachen.

### Schema

```csv
id;lang;display;lemma;category;genus;needs_vowel_article;unit_id;ref;tags
```

### Felder

| Feld                | Beschreibung                              | Pflicht | Werte                                                                  |
|---------------------|-------------------------------------------|---------|------------------------------------------------------------------------|
| id                  | Eindeutige ID                             | ✓       |                                                                        |
| lang                | Sprache                                   | ✓       | `fr` / `de`                                                            |
| display             | Anzeigeform                               | ✓       |                                                                        |
| lemma               | Grundform                                 | –       |                                                                        |
| category            | Wortart                                   | ✓       | `verb` / `noun` / `adjective` / `expression` / `other`                 |
| genus               | Geschlecht                                | –       | `m` / `f` / `n` / `pl` / `mpl` / `fpl` / `npl` / `m/f` |
| needs_vowel_article | Erfordert Vokal-Artikel (nur Französisch) | –       | `true` / `false`                                                       |
| unit_id             | Einführungseinheit                        | –       |                                                                        |
| ref                 | Externe Referenz                          | –       |                                                                        |
| tags                | Zusätzliche Tags                          | –       |                                                                        |

### Beispiel

```csv
id;lang;display;lemma;category;genus;needs_vowel_article;unit_id
701;fr;s'inscrire à qc.;s'inscrire;verb;;;1
702;fr;cours de français;;noun;m;false;1
801;de;sich anmelden;;verb;;;1
802;de;Französischkurs;;noun;m;;1
```

---

## term_links.csv

Übersetzungsbeziehungen zwischen Terms.

> **Hinweis:** m:n Beziehungen sind erlaubt.

### Schema

```csv
fr_id;de_id;priority
```

### Felder

| Feld     | Beschreibung                | Pflicht |
|----------|-----------------------------|---------|
| fr_id    | ID des französischen Terms  | ✓       |
| de_id    | ID des deutschen Terms      | ✓       |
| priority | Priorität der Übersetzung   | –       |

### Beispiel

```csv
fr_id;de_id;priority
701;801;1
702;802;1
```

---

## sentences.csv

Sätze mit Templates und Annotationen inline.

### Schema

```csv
id;unit_id;fr;de;note
```

### Felder

| Feld    | Beschreibung            | Pflicht |
|---------|-------------------------|---------|
| id      | Eindeutige ID           | ✓       |
| unit_id | Zugehörige Einheit      | ✓       |
| fr      | Französischer Satz      | ✓       |
| de      | Deutscher Satz          | ✓       |
| note    | Zusätzliche Anmerkungen | –       |

### Beispiel

```csv
id;unit_id;fr;de
1;1;Je vais {m'inscrire à|#701} un {cours de français|#702}.;Ich {melde mich an|#801} zu einem {Französischkurs|#802}.
```

---

## Sentence Syntax

Die Sentence Syntax ermöglicht Annotationen und Alternativen innerhalb von Sätzen.

### Annotation (Term-Referenz)

Verknüpft Textfragmente mit Term-IDs.

**Syntax:**

```
{surface|#termId}
```

**Beispiel:**

```
Je mange {une pomme|#123}.
```

**Unresolved (Editor-Modus):**

```
{une pomme}
```

### Template Alternatives

Definiert austauschbare Varianten.

**Syntax:**

```
[A|B|C]
```

**Beispiel:**

```
Je [mange|bouffe] {une pomme|#123}.
```

**Verschachtelung erlaubt:**

```
[Je mange une pomme|Je [bouffe|mange] une pomme]
```

### Default Representative

> **Regel:** Der **erste Eintrag** jeder Alternative wird als Standardform verwendet.

**Beispiel:**

```
[Je mange une pomme|Je bouffe une pomme].
```

**Representative:**

```
Je mange une pomme.
```
