/**
 * Génère les PDF de test pour le pipeline OCR.
 *   $ npx ts-node src/services/ocr/__tests__/fixtures/generate-fixtures.ts
 *
 * Les PDF sortis sont versionnés (binaire) à côté des tests.
 */
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

const OUT = __dirname;

interface InvoiceSpec {
  file: string;
  supplierName: string;
  siret?: string;
  iban?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  ht?: number;
  tva?: number;
  ttc?: number;
  lines?: Array<{ qty: number; description: string; unitPrice: number }>;
}

function renderInvoice(spec: InvoiceSpec): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const out = fs.createWriteStream(path.join(OUT, spec.file));
    doc.pipe(out);

    doc.fontSize(20).text(spec.supplierName, { align: 'left' });
    if (spec.siret) doc.fontSize(9).text(`SIRET : ${spec.siret}`);
    if (spec.iban) doc.fontSize(9).text(`IBAN : ${spec.iban}`);
    doc.moveDown();

    doc.fontSize(16).text('FACTURE', { align: 'right' });
    doc.moveDown();

    doc.fontSize(11);
    if (spec.invoiceNumber) doc.text(`N° facture : ${spec.invoiceNumber}`);
    if (spec.issueDate) doc.text(`Date émission : ${spec.issueDate}`);
    if (spec.dueDate) doc.text(`Date échéance : ${spec.dueDate}`);
    doc.moveDown(2);

    if (spec.lines && spec.lines.length) {
      for (const l of spec.lines) {
        const total = l.qty * l.unitPrice;
        doc.text(
          `${l.qty} x ${l.description} @ ${l.unitPrice.toFixed(2).replace('.', ',')} = ${total.toFixed(2).replace('.', ',')} €`,
        );
      }
      doc.moveDown();
    } else {
      doc.text('Désignation : prestation de service mensuelle');
      doc.moveDown();
    }

    if (spec.ht !== undefined) doc.text(`Montant HT : ${spec.ht.toFixed(2).replace('.', ',')} €`);
    if (spec.tva !== undefined) doc.text(`TVA (20%) : ${spec.tva.toFixed(2).replace('.', ',')} €`);
    if (spec.ttc !== undefined) doc.fontSize(13).text(`Total TTC : ${spec.ttc.toFixed(2).replace('.', ',')} €`);

    doc.end();
    out.on('finish', () => resolve());
    out.on('error', reject);
  });
}

async function main() {
  await renderInvoice({
    file: 'invoice-coherent.pdf',
    supplierName: 'ACME Services SARL',
    siret: '38012986607000',
    iban: 'FR7630006000011234567890189',
    invoiceNumber: 'F-2025-0042',
    issueDate: '15/03/2025',
    dueDate: '15/04/2025',
    ht: 1000,
    tva: 200,
    ttc: 1200,
  });

  await renderInvoice({
    file: 'invoice-no-tva.pdf',
    supplierName: 'Auto-Entreprise Dupont',
    siret: '79412345600015',
    invoiceNumber: 'AE-2025-7',
    issueDate: '02/02/2025',
    ttc: 450,
  });

  await renderInvoice({
    file: 'invoice-with-lines.pdf',
    supplierName: 'Studio Beta',
    siret: '50412385600022',
    invoiceNumber: 'SB-2025-019',
    issueDate: '10/04/2025',
    lines: [
      { qty: 3, description: 'Prestation conseil', unitPrice: 250 },
      { qty: 10, description: 'Heures de développement', unitPrice: 80 },
      { qty: 1, description: 'Frais de déplacement', unitPrice: 120 },
    ],
    ht: 1670,
    tva: 334,
    ttc: 2004,
  });

  // Fichier corrompu : on écrit du texte qui n'est pas un PDF valide.
  fs.writeFileSync(path.join(OUT, 'invoice-corrupt.pdf'), 'not a real pdf content');

  console.log('Fixtures générées dans', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
