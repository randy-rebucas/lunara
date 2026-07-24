import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportPdf(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
  title?: string,
) {
  const doc = new jsPDF();

  if (title) {
    doc.setFontSize(14);
    doc.text(title, 14, 16);
  }

  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((v) => String(v ?? ''))),
    startY: title ? 22 : 12,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [79, 70, 229] },
  });

  doc.save(filename);
}
