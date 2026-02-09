import {Injectable} from '@angular/core';
import {jsPDF} from 'jspdf';
import autoTable, {CellInput, HookData} from 'jspdf-autotable';
import {LessonOption} from '../models/lesson-option';
import {beautifyGenus, withFrenchArticle, withGermanArticle} from '../helpers/utils';
import {WordCard} from '../models/word-card';
import {Genus} from '../models/editor-model';

@Injectable({providedIn: 'root'})
export class ExportPdfService {
  exportVocab(cards: WordCard[], selected: LessonOption): void {
    if (!cards || cards.length === 0) return;

    const sorted = [...cards].sort((a, b) =>
      (a.frenchPrimary || '').localeCompare(b.frenchPrimary || '', 'fr', {sensitivity: 'base'})
    );

    const title = `Vokabelliste${selected.id === 'all' ? '' : ' – ' + selected.label}`;

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
      const fr = withFrenchArticle(c.frenchPrimary, c.meta?.fr_genus, !!c.meta?.fr_needs_vowel_article);
      const de = withGermanArticle(c.germanPrimary, c.meta?.de_genus);

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
}
