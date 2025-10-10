import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable, { CellInput } from 'jspdf-autotable';
import { PracticeCard } from '../practice/practice.component';
import { LessonOption } from '../lesson-selector/lesson-selector.component';

@Injectable({ providedIn: 'root' })
export class ExportPdfService {
  exportVocab(cards: PracticeCard[], selected: LessonOption): void {
    if (!cards || cards.length === 0) return;

    // Nach französischem Begriff alphabetisch sortieren (case-insensitive, fr-Locale)
    const sorted = [...cards].sort((a, b) =>
      (a.frenchPrimary || '').localeCompare(b.frenchPrimary || '', 'fr', { sensitivity: 'base' })
    );

    const title = `Vokabelliste${selected === 'Alle' ? '' : ' – ' + selected}`;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const marginLeft = 40;
    const startY = 40;

    doc.setFontSize(14);
    doc.text(title, marginLeft, startY);

    // Tabelle: 3 Spalten: Lektion | Französisch | Deutsch
    const body: CellInput[][] = [];

    for (const c of sorted) {
      const lesson = typeof c.meta?.lesson === 'number' ? String(c.meta.lesson) : '';
      const fr = this.withFrenchArticle(c.frenchPrimary, c.meta?.fr_genus, !!c.meta?.fr_needs_vowel_article);
      const de = this.withGermanArticle(c.germanPrimary, c.meta?.de_genus);
      const category = (c.meta?.category ?? '').trim();

      // Hauptzeile (fett)
      body.push([
        { content: lesson, styles: { fontStyle: 'bold' } },
        { content: fr, styles: { fontStyle: 'bold' } },
        { content: de, styles: { fontStyle: 'bold' } },
      ]);

      // Zweite Zeile: Beispiele (grau/kleiner/kursiv) und optional Kategorie klein in FR-Spalte
      const frEx = (c.frenchSecondary ?? '').trim();
      const deEx = (c.germanSecondary ?? '').trim();
      const frExtraParts: string[] = [];
      if (frEx) frExtraParts.push(frEx);
      if (category) frExtraParts.push(`(${category})`);
      const frExtra = frExtraParts.join('\n');

      if (frExtra || deEx) {
        const subtle = { fontSize: 9, textColor: [120, 120, 120] as any, fontStyle: 'italic' as const };
        body.push([
          { content: '', styles: subtle },
          { content: frExtra, styles: subtle },
          { content: deEx, styles: subtle },
        ]);
      }
    }

    autoTable(doc, {
      head: [[ 'Lektion', 'Französisch', 'Deutsch' ]],
      body,
      startY: startY + 20,
      styles: { fontSize: 10, cellPadding: 6, overflow: 'linebreak' },
      headStyles: { fillColor: [25, 118, 210], textColor: 255 },
      bodyStyles: { valign: 'top' },
      columnStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 260 }, 2: { cellWidth: 260 } },
      margin: { left: marginLeft, right: marginLeft },
      didParseCell: (data) => {
        // "kleine Spalte" für Lektion: kleinere Schrift in Datenzeilen
        if (data.section === 'body' && data.column.index === 0) {
          data.cell.styles.fontSize = 9;
          data.cell.styles.textColor = [80, 80, 80];
        }
      },
    } as any);

    const safeSel = selected === 'Alle' ? 'alle' : selected.replace(/\s+/g, '_').toLowerCase();
    const filename = `vokabelliste_${safeSel}.pdf`;
    doc.save(filename);
  }

  private withFrenchArticle(word: string, genus?: string, needsVowelArticle?: boolean): string {
    const w = (word || '').trim();
    if (!w) return w;
    const g = (genus || '').toLowerCase();
    if (!g) return w; // kein Artikel für verbe/adjectif etc.

    const isPlural = g.includes('pl');
    const isMasc = g.includes('m');
    const isFem = g.includes('f');

    if (isPlural) return `les ${w}`;

    // Nur auf den Flag fr_needs_vowel_article achten (kein Heuristik-Check des ersten Buchstabens)
    if (needsVowelArticle) return `l'${w}`;

    if (isMasc) return `le ${w}`;
    if (isFem) return `la ${w}`;
    return w;
  }

  private withGermanArticle(word: string, genus?: string): string {
    const w = (word || '').trim();
    if (!w) return w;
    const g = (genus || '').toLowerCase();
    if (!g) return w;

    const isPlural = g.includes('pl');
    const isMasc = g.includes('m') && !isPlural;
    const isFem = g.includes('f') && !isPlural;
    const isNeut = g.includes('n') && !isPlural;

    if (isPlural) return `die ${w}`;
    if (isMasc) return `der ${w}`;
    if (isFem) return `die ${w}`;
    if (isNeut) return `das ${w}`;
    return w;
  }
}
