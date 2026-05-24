/**
 * Génère des factures PDF de test pour valider le pipeline upload → OCR → Socket.io.
 *
 *   npx ts-node --transpile-only scripts/generate-test-invoices.ts
 *
 * Les fichiers sont créés dans backend/test-invoices/.
 */
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';

const OUT = path.join(__dirname, '../test-invoices');
fs.mkdirSync(OUT, { recursive: true });

interface Line { qty: number; desc: string; unitPrice: number; }
interface Spec {
  file: string;
  supplier: string;
  address?: string;
  siret?: string;
  iban?: string;
  invoiceNumber?: string;
  issueDate?: string;
  dueDate?: string;
  lines: Line[];
  tvaRate?: number;
  note?: string;
}

function money(n: number) { return n.toFixed(2).replace('.', ',') + ' €'; }

function render(spec: Spec): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const out = fs.createWriteStream(path.join(OUT, spec.file));
    doc.pipe(out);

    const pageW = doc.page.width - 100;

    // ── En-tête fournisseur ──────────────────────────────────────────────────
    doc.fontSize(16).font('Helvetica-Bold').text(spec.supplier);
    doc.fontSize(9).font('Helvetica');
    if (spec.address) doc.text(spec.address);
    if (spec.siret) doc.text(`SIRET : ${spec.siret}`);
    if (spec.iban) doc.text(`IBAN : ${spec.iban}`);

    // ── Titre FACTURE ────────────────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold')
      .text('FACTURE', 0, 50, { align: 'right', width: doc.page.width - 50 });

    doc.moveDown(2);

    // ── Infos facture ────────────────────────────────────────────────────────
    doc.fontSize(10).font('Helvetica');
    const infoLabelX = 50;
    const infoValueX = 180;
    let infoY = doc.y;
    if (spec.invoiceNumber) {
      doc.text("N° facture :",     infoLabelX, infoY, { width: 125 });
      doc.text(spec.invoiceNumber, infoValueX, infoY, { width: 200 });
      infoY += 16;
    }
    if (spec.issueDate) {
      doc.text("Date d'émission :", infoLabelX, infoY, { width: 125 });
      doc.text(spec.issueDate,      infoValueX, infoY, { width: 200 });
      infoY += 16;
    }
    if (spec.dueDate) {
      doc.text("Date d'échéance :", infoLabelX, infoY, { width: 125 });
      doc.text(spec.dueDate,        infoValueX, infoY, { width: 200 });
      infoY += 16;
    }
    doc.y = infoY;

    doc.moveDown(1.5);

    // ── Tableau lignes ───────────────────────────────────────────────────────
    // Colonnes : x absolus pour éviter le décalage du continued: true
    const col = {
      desc:  { x: 50,  w: 280 },
      qty:   { x: 330, w: 40  },
      pu:    { x: 370, w: 90  },
      total: { x: 460, w: 85  },
    };

    let y = doc.y;

    // En-tête tableau
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Description',  col.desc.x,  y, { width: col.desc.w });
    doc.text('Qté',          col.qty.x,   y, { width: col.qty.w,   align: 'right' });
    doc.text('PU HT',        col.pu.x,    y, { width: col.pu.w,    align: 'right' });
    doc.text('Total HT',     col.total.x, y, { width: col.total.w, align: 'right' });
    y += 16;
    doc.moveTo(50, y).lineTo(545, y).stroke();
    y += 6;

    // Lignes
    doc.font('Helvetica').fontSize(9);
    let totalHt = 0;
    for (const l of spec.lines) {
      const total = l.qty * l.unitPrice;
      totalHt += total;
      doc.text(l.desc,              col.desc.x,  y, { width: col.desc.w });
      doc.text(String(l.qty),       col.qty.x,   y, { width: col.qty.w,   align: 'right' });
      doc.text(money(l.unitPrice),  col.pu.x,    y, { width: col.pu.w,    align: 'right' });
      doc.text(money(total),        col.total.x, y, { width: col.total.w, align: 'right' });
      y += 16;
    }

    doc.moveTo(50, y).lineTo(545, y).stroke();
    y += 12;

    // ── Totaux ───────────────────────────────────────────────────────────────
    const tvaRate = spec.tvaRate ?? 0.20;
    const tva = Math.round(totalHt * tvaRate * 100) / 100;
    const ttc = totalHt + tva;

    const labelX = 350;
    const valueX = 460;
    const valueW = 85;

    doc.font('Helvetica').fontSize(10);
    doc.text('Montant HT :',           labelX, y, { width: 105 });
    doc.text(money(totalHt),           valueX, y, { width: valueW, align: 'right' });
    y += 16;

    if (tvaRate > 0) {
      doc.text(`TVA (${tvaRate * 100}%) :`, labelX, y, { width: 105 });
      doc.text(money(tva),               valueX, y, { width: valueW, align: 'right' });
      y += 16;
    } else {
      doc.fontSize(8).text('TVA non applicable (art. 293B CGI)', 50, y);
      y += 14;
      doc.fontSize(10);
    }

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Total TTC :',            labelX, y, { width: 105 });
    doc.text(money(ttc),               valueX, y, { width: valueW, align: 'right' });
    y += 20;
    doc.y = y;

    // ── Note ─────────────────────────────────────────────────────────────────
    if (spec.note) {
      doc.moveDown(2);
      doc.font('Helvetica').fontSize(8).fillColor('grey').text(spec.note);
    }

    doc.end();
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

async function main() {
  const invoices: Spec[] = [
    // 1. Facture complète avec toutes les infos — doit → PENDING_VALIDATION
    {
      file: '01-facture-complete.pdf',
      supplier: 'ACME Services SARL',
      address: '12 rue de la Paix, 75001 Paris',
      siret: '38012986607000',
      iban: 'FR7630006000011234567890189',
      invoiceNumber: 'F-2026-0042',
      issueDate: '15/03/2026',
      dueDate: '15/04/2026',
      lines: [
        { qty: 5, desc: 'Jours de conseil en transformation digitale', unitPrice: 800 },
        { qty: 1, desc: 'Frais de déplacement', unitPrice: 230 },
      ],
    },

    // 2. Auto-entrepreneur sans TVA — doit extraire SIRET, pas de TVA
    {
      file: '02-auto-entrepreneur.pdf',
      supplier: 'Jean Dupont Consulting',
      address: '8 allée des Lilas, 69003 Lyon',
      siret: '79412345600015',
      invoiceNumber: 'JD-2026-007',
      issueDate: '02/02/2026',
      dueDate: '02/03/2026',
      lines: [
        { qty: 3, desc: 'Audit technique infrastructure cloud', unitPrice: 150 },
      ],
      tvaRate: 0,
      note: 'TVA non applicable — article 293 B du CGI',
    },

    // 3. Facture multi-lignes — test de l'extraction des lignes
    {
      file: '03-multi-lignes.pdf',
      supplier: 'Studio Beta SAS',
      address: '42 avenue Victor Hugo, 33000 Bordeaux',
      siret: '50412385600022',
      iban: 'FR7614508059405678912345R02',
      invoiceNumber: 'SB-2026-019',
      issueDate: '10/04/2026',
      dueDate: '10/05/2026',
      lines: [
        { qty: 3, desc: 'Prestation conseil UX/UI', unitPrice: 250 },
        { qty: 12, desc: 'Heures de développement Angular', unitPrice: 85 },
        { qty: 8, desc: 'Heures de développement Node.js', unitPrice: 90 },
        { qty: 1, desc: 'Licence outils design (Figma Pro)', unitPrice: 144 },
        { qty: 1, desc: 'Frais de déplacement client', unitPrice: 87 },
      ],
    },

    // 4. Facture avec montants élevés — test des gros montants
    {
      file: '04-grosse-facture.pdf',
      supplier: 'Enterprise Solutions SA',
      address: '15 place de la République, 75011 Paris',
      siret: '44305543900077',
      iban: 'FR7610096000302489995555A12',
      invoiceNumber: 'ES-2026-1337',
      issueDate: '01/04/2026',
      dueDate: '30/04/2026',
      lines: [
        { qty: 1, desc: 'Licence logiciel ERP (annuelle)', unitPrice: 18000 },
        { qty: 20, desc: 'Jours d\'intégration et paramétrage', unitPrice: 1200 },
        { qty: 5, desc: 'Jours de formation utilisateurs', unitPrice: 950 },
      ],
    },

    // 5. Facture minimaliste — peu d'infos, doit → DRAFT (confidence faible)
    {
      file: '05-facture-minimale.pdf',
      supplier: 'Prestataire Anonyme',
      invoiceNumber: 'PA-001',
      issueDate: '20/03/2026',
      lines: [
        { qty: 1, desc: 'Prestation', unitPrice: 500 },
      ],
      tvaRate: 0.20,
    },
  ];

  for (const spec of invoices) {
    await render(spec);
    console.log(`✓ ${spec.file}`);
  }

  console.log(`\n${invoices.length} factures générées dans backend/test-invoices/`);
  console.log('Upload via : http://localhost:4200/invoices/upload');
}

main().catch((e) => { console.error(e); process.exit(1); });
