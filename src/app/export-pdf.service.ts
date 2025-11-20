import {Injectable} from '@angular/core';
import {jsPDF} from 'jspdf';
import autoTable, {CellInput, HookData} from 'jspdf-autotable';
import {PracticeCard} from '../practice/practice.component';
import {LessonOption} from '../lesson-option';

@Injectable({providedIn: 'root'})
export class ExportPdfService {
  exportVocab(cards: PracticeCard[], selected: LessonOption): void {
    if (!cards || cards.length === 0) return;

    const sorted = [...cards].sort((a, b) =>
      (a.frenchPrimary || '').localeCompare(b.frenchPrimary || '', 'fr', {sensitivity: 'base'})
    );

    const title = `Vokabelliste${selected.id === 'all' ? '' : ' – ' + selected}`;

    const doc = new jsPDF({orientation: 'portrait', unit: 'pt', format: 'a4'});
    const marginLeft = 40;
    const startY = 40;

    doc.setFontSize(12);
    doc.text(title, marginLeft, startY);

    // Tabelle: 3 Spalten: Lektion | Französisch | Deutsch
    const body: CellInput[][] = [];

    for (const c of sorted) {
      const category = (c.meta?.category ?? '').trim();
      const shortCat = category.length > 5 ? category.substring(0, 3) + '.' : category;
      const fr = this.withFrenchArticle(c.frenchPrimary, c.meta?.fr_genus, !!c.meta?.fr_needs_vowel_article);
      const de = this.withGermanArticle(c.germanPrimary, c.meta?.de_genus);

      // Hauptzeile (fett)
      body.push([
        {content: shortCat, styles: {fontStyle: 'italic', fontSize: 9}},
        {content: fr, styles: {fontStyle: 'bold'}},
        {content: de, styles: {fontStyle: 'bold'}},
      ]);

      // Zweite Zeile: Beispiele (grau/kleiner/kursiv) und optional Kategorie klein in FR-Spalte
      const frEx = (c.frenchSecondary ?? '').trim();
      const deEx = (c.germanSecondary ?? '').trim();

      if (frEx || deEx) {
        const subtle = {fontSize: 9, textColor: [120, 120, 120] as any, fontStyle: 'italic' as const};
        body.push([
          {content: '', styles: subtle},
          {content: frEx, styles: subtle},
          {content: deEx, styles: subtle},
        ]);
      }
    }

    autoTable(doc, {
      head: [['Typ', 'Französisch', 'Deutsch']],
      body,
      startY: startY + 20,
      styles: {fontSize: 10, cellPadding: 6, overflow: 'linebreak'},
      headStyles: {fillColor: [25, 118, 210], textColor: 255},
      bodyStyles: {valign: 'top'},
      columnStyles: {0: {cellWidth: 50}, 1: {cellWidth: 235}, 2: {cellWidth: 235}},
      margin: {left: marginLeft, right: marginLeft},
      didDrawPage: (data: HookData) => {
        // Seitenzahl unten mittig
        const page = doc.getCurrentPageInfo().pageNumber;
        const pageText = `Seite ${page}`;
        doc.setFontSize(10);
        const textWidth = doc.getTextWidth(pageText);
        const x = (doc.internal.pageSize.getWidth() - textWidth) / 2;
        const y = doc.internal.pageSize.getHeight() - 20;
        doc.text(pageText, x, y);
      }
    } as any);

    const safeSel = selected.id === 'all' ? 'alle' : selected.id;
    const filename = `vokabelliste_${safeSel}.pdf`;
    doc.save(filename);
  }

  private withFrenchArticle(word: string, genus?: string, needsVowelArticle?: boolean): string {
    const frenchWord = (word || '').trim();
    if (!frenchWord) {
      return frenchWord;
    }
    const frenchGender = (genus || '').toLowerCase();
    if (!frenchGender) return frenchWord; // kein Artikel für verbe/adjectif etc.

    const isPlural = frenchGender.includes('pl');
    const isMasc = frenchGender.includes('m');
    const isFem = frenchGender.includes('f');

    if (isPlural) {
      return `les ${frenchWord} (${genus})`;
    }

    // Nur auf den Flag fr_needs_vowel_article achten (kein Heuristik-Check des ersten Buchstabens)
    if (needsVowelArticle) return `l'${frenchWord} (${genus})`;

    if (isMasc) {
      return `le ${frenchWord}`;
    }
    if (isFem) {
      return `la ${frenchWord}`;
    }
    return frenchWord;
  }

  private withGermanArticle(word: string, genus?: string): string {
    const germanWord = (word || '').trim();
    if (!germanWord) {
      return germanWord;
    }
    const germanGender = (genus || '').toLowerCase();
    if (!germanGender) {
      return germanWord;
    }

    const isPlural = germanGender.includes('pl');
    const isMasc = germanGender.includes('m') && !isPlural;
    const isFem = germanGender.includes('f') && !isPlural;
    const isNeut = germanGender.includes('n') && !isPlural;

    if (isPlural) {
      return `die ${germanWord}`;
    }
    if (isMasc) {
      return `der ${germanWord}`;
    }
    if (isFem) {
      return `die ${germanWord}`;
    }
    if (isNeut) {
      return `das ${germanWord}`;
    }
    return germanWord;
  }
}
