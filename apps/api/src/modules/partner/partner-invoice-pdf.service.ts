import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface InvoiceOrderRow {
  orderId: string;
  completedAt?: string;
  amount: number;
  commissionDue: number;
  paymentMethod?: string | null;
}

export interface InvoicePdfData {
  invoiceNumber: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate?: Date;
  totalCollected: number;
  commissionDue: number;
  riderCostDue: number;
  subscriptionFeeDue: number;
  creditApplied: number;
  amountDue: number;
  status: 'pending' | 'paid' | 'void';
}

function formatPeso(n: number): string {
  return `PHP ${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d?: Date): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** Builds the PDF for a partner invoice — used both for the auto-emailed copy at invoice-creation
 * time and for on-demand download/preview (partner-web, admin-web). Regenerated on demand rather
 * than stored, since it's cheap and fully deterministic from the invoice + order data. */
@Injectable()
export class PartnerInvoicePdfService {
  async build(
    invoice: InvoicePdfData,
    partner: { name: string; email?: string },
    orders: InvoiceOrderRow[],
  ): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    doc.fontSize(20).text('Lunara', { continued: false });
    doc.fontSize(10).fillColor('#666').text('Laundry Platform — Partner Invoice');
    doc.moveDown(1.5);

    doc.fillColor('#000').fontSize(14).text(`Invoice ${invoice.invoiceNumber}`);
    doc.fontSize(10).fillColor('#333');
    doc.text(`Billed to: ${partner.name}${partner.email ? ` (${partner.email})` : ''}`);
    doc.text(`Period: ${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`);
    if (invoice.dueDate) doc.text(`Due date: ${formatDate(invoice.dueDate)}`);
    doc.text(`Status: ${invoice.status.toUpperCase()}`);
    doc.moveDown(1);

    doc.fontSize(12).fillColor('#000').text('Orders this period');
    doc.moveDown(0.3);
    const tableTop = doc.y;
    const col = { date: 50, order: 150, method: 280, amount: 360, commission: 460 };
    doc.fontSize(9).fillColor('#666');
    doc.text('Date', col.date, tableTop);
    doc.text('Order', col.order, tableTop);
    doc.text('Payment', col.method, tableTop);
    doc.text('Collected', col.amount, tableTop, { width: 90, align: 'right' });
    doc.text('Commission', col.commission, tableTop, { width: 90, align: 'right' });
    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).strokeColor('#ddd').stroke();

    let y = tableTop + 20;
    doc.fontSize(9).fillColor('#000');
    for (const row of orders) {
      if (y > 760) {
        doc.addPage();
        y = 50;
      }
      doc.text(row.completedAt ? formatDate(new Date(row.completedAt)) : '—', col.date, y);
      doc.text(row.orderId.slice(-8).toUpperCase(), col.order, y);
      doc.text(row.paymentMethod ?? '—', col.method, y);
      doc.text(formatPeso(row.amount), col.amount, y, { width: 90, align: 'right' });
      doc.text(formatPeso(row.commissionDue), col.commission, y, { width: 90, align: 'right' });
      y += 16;
    }

    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 12;

    const totalsLine = (label: string, value: string, bold = false) => {
      doc.fontSize(bold ? 11 : 10).fillColor('#000');
      if (bold) doc.font('Helvetica-Bold');
      doc.text(label, 340, y, { width: 110, align: 'left' });
      doc.text(value, col.commission, y, { width: 90, align: 'right' });
      if (bold) doc.font('Helvetica');
      y += 16;
    };
    totalsLine('Total collected (info only)', formatPeso(invoice.totalCollected));
    totalsLine('Commission due', formatPeso(invoice.commissionDue));
    if (invoice.riderCostDue > 0) totalsLine('Rider cost fronted', formatPeso(invoice.riderCostDue));
    if (invoice.subscriptionFeeDue > 0) totalsLine('Subscription fee', formatPeso(invoice.subscriptionFeeDue));
    if (invoice.creditApplied > 0) totalsLine('Credit applied', `-${formatPeso(invoice.creditApplied)}`);
    totalsLine('Amount due', formatPeso(invoice.amountDue), true);

    y += 20;
    doc.fontSize(9).fillColor('#666').text(
      'Please settle this invoice via your usual payment channel (bank transfer/GCash). ' +
        'Lunara will mark it paid once payment is received.',
      50,
      y,
      { width: 495 },
    );

    doc.end();
    return done;
  }
}
