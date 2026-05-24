/**
 * PDF/A-3b builder — Sprint 5
 *
 * Strategy: raw PDF byte injection. pdf-lib corrupts pdfkit output on save,
 * so we edit the PDF source directly — inject the XML attachment, XMP metadata,
 * OutputIntent, and update the cross-reference table.
 */
import PDFDocument from 'pdfkit';
import type { Invoice } from '../../types/invoice';

export async function buildPdfA3(invoice: Invoice, ciiXml: string): Promise<Buffer> {
  const visualPdf = await renderVisualPdf(invoice);
  return injectFacturXObjects(visualPdf, ciiXml, invoice);
}

// ─── Step 1: Visual PDF via pdfkit ────────────────────────────────────────────

function renderVisualPdf(invoice: Invoice): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    doc.on('data', (c: unknown) => {
      chunks.push(c as Buffer);
    });
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text('FACTURE', { align: 'right' });
    doc.fontSize(10).font('Helvetica').moveDown(0.5);

    doc.text(`N° ${invoice.invoiceNumber ?? '—'}`, { align: 'right' });
    if (invoice.issueDate) doc.text(`Date : ${fmtDate(invoice.issueDate)}`, { align: 'right' });
    if (invoice.dueDate) doc.text(`Échéance : ${fmtDate(invoice.dueDate)}`, { align: 'right' });
    doc.moveDown(1);

    if (invoice.supplier) {
      const s = invoice.supplier;
      doc.font('Helvetica-Bold').text('Émetteur').font('Helvetica');
      doc.text(s.name);
      if (s.siret) doc.text(`SIRET : ${s.siret}`);
      if (s.vatNumber) doc.text(`TVA : ${s.vatNumber}`);
      if (s.address) doc.text(s.address);
      if (s.iban) doc.text(`IBAN : ${s.iban}`);
    }
    doc.moveDown(1.5);

    doc.font('Helvetica-Bold');
    const colX = [50, 270, 340, 420, 490];
    doc.text('Description', colX[0], doc.y, { width: 200, continued: false });
    const headerY = doc.y - doc.currentLineHeight();
    doc.text('Qté', colX[1], headerY, { width: 60 });
    doc.text('P.U. HT', colX[2], headerY, { width: 70 });
    doc.text('Total HT', colX[3], headerY, { width: 80 });

    const lineH = doc.currentLineHeight() + 4;
    let y = headerY + lineH;
    doc.font('Helvetica');

    for (const line of invoice.lines) {
      doc.text(line.description, colX[0], y, { width: 200, continued: false });
      doc.text(String(Number(line.quantity)), colX[1], y, { width: 60 });
      doc.text(fmtEur(Number(line.unitPrice)), colX[2], y, { width: 70 });
      doc.text(fmtEur(Number(line.total)), colX[3], y, { width: 80 });
      y += lineH;
    }

    y += 10;
    doc.moveTo(350, y).lineTo(545, y).stroke();
    y += 8;

    for (const [label, val] of [
      ['Sous-total HT', invoice.amountHt],
      ['TVA', invoice.amountTva],
      ['Total TTC', invoice.amountTtc],
    ] as [string, number | null][]) {
      if (val == null) continue;
      doc.text(label, 350, y, { width: 140, align: 'left' });
      doc.text(fmtEur(val) + ' ' + (invoice.currency ?? 'EUR'), 490, y, {
        width: 80,
        align: 'right',
      });
      y += lineH;
    }

    doc
      .fontSize(7)
      .fillColor('#888888')
      .text('Document généré par le système Factur-X — Profil EN 16931', 50, 780, {
        align: 'center',
        width: 495,
      });

    doc.end();
  });
}

// ─── Step 2: Inject Factur-X PDF objects ──────────────────────────────────────

function injectFacturXObjects(pdfBuffer: Buffer, ciiXml: string, invoice: Invoice): Buffer {
  const pdf = pdfBuffer.toString('latin1');

  // Locate catalog and insert entries before closing >>
  const cat = findDict(pdf, '/Type /Catalog');
  const beforeEnd = pdf.slice(0, cat.end);
  const afterEnd = pdf.slice(cat.end);

  const insertion =
    '/Metadata 1003 0 R\n' +
    '/OutputIntents [ 1004 0 R ]\n' +
    '/AF [ 1001 0 R ]\n' +
    '/Names << /EmbeddedFiles 1002 0 R >>\n';

  const newPdf = beforeEnd + insertion + afterEnd;

  // Strip %%EOF
  const eofIdx = newPdf.lastIndexOf('%%EOF');
  const body = newPdf.slice(0, eofIdx);
  const baseLen = Buffer.from(body, 'latin1').length;

  // Build new objects
  const xmlBytes = Buffer.from(ciiXml, 'utf-8');
  const xmpBytes = Buffer.from(buildXmp(invoice), 'utf-8');
  const now = new Date();

  let off = baseLen;

  const o1000 = streamObj(1000, xmlBytes, {
    Type: '/EmbeddedFile',
    Subtype: '/text#2Fxml',
    Params: `<< /Size ${xmlBytes.length} /ModDate (${pdfDate(now)}) >>`,
  });
  off += bufLen(o1000);

  const o1001 = `${1001} 0 obj\n<< /Type /Filespec /F (factur-x.xml) /UF (factur-x.xml)\n   /EF << /F 1000 0 R /UF 1000 0 R >>\n   /AFRelationship /Source\n   /Desc (Factur-X XML invoice data)\n>>\nendobj\n`;
  off += bufLen(o1001);

  const o1002 = `${1002} 0 obj\n<< /Names [ (factur-x.xml) 1001 0 R ] >>\nendobj\n`;
  off += bufLen(o1002);

  const o1003 = streamObj(1003, xmpBytes, { Type: '/Metadata', Subtype: '/XML' });
  off += bufLen(o1003);

  const o1004 = `${1004} 0 obj\n<< /Type /OutputIntent /S /GTS_PDFA1\n   /OutputConditionIdentifier (sRGB IEC61966-2.1)\n>>\nendobj\n`;
  off += bufLen(o1004);

  // Offsets for xref (cumulative from baseLen)
  const cumul = (arr: string[], i: number) =>
    baseLen + arr.slice(0, i).reduce((s, x) => s + bufLen(x), 0);
  const objs = [o1000, o1001, o1002, o1003, o1004];
  const offsets = [1000, 1001, 1002, 1003, 1004].map((_, i) => cumul(objs, i));

  const xref =
    `xref\n` +
    `0 1\n0000000000 65535 f \r\n` +
    `1000 5\n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \r`).join('') +
    `trailer\n<< /Size 1005 /Root ${cat.ref} >>\n` +
    `startxref\n${baseLen}\n%%EOF\n`;

  return Buffer.from(body + o1000 + o1001 + o1002 + o1003 + o1004 + xref, 'latin1');
}

// ─── PDF helpers ──────────────────────────────────────────────────────────────

function findDict(pdf: string, key: string): { start: number; end: number; ref: string } {
  const idx = pdf.indexOf(key);
  if (idx === -1) throw new Error(`Cannot find ${key}`);

  // Backtrack to find the object reference like "5 0 obj"
  const before = pdf.slice(0, idx);
  const objMatch = before.match(/(\d+ \d+ obj)\s*<<[^>]*$/);
  const ref = objMatch ? objMatch[1] : '1 0 R';

  let depth = 0;
  let end = idx;
  for (let i = idx; i < pdf.length; i++) {
    if (pdf[i] === '<' && pdf[i + 1] === '<') {
      depth++;
      i++;
    } else if (pdf[i] === '>' && pdf[i + 1] === '>') {
      depth--;
      i++;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return { start: idx, end, ref };
}

function streamObj(num: number, data: Buffer, dict: Record<string, string>): string {
  let d = '';
  for (const [k, v] of Object.entries(dict)) d += `/${k} ${v}\n`;
  return `${num} 0 obj\n<< /Length ${data.length}\n${d}>>\nstream\n${data.toString('latin1')}\nendstream\nendobj\n`;
}

function bufLen(s: string): number {
  return Buffer.from(s, 'latin1').length;
}

function buildXmp(invoice: Invoice): string {
  const now = new Date().toISOString();
  const title = xml(`Facture ${invoice.invoiceNumber ?? invoice.id}`);
  const creator = xml(invoice.supplier?.name ?? 'Unknown');
  return (
    `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n` +
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">\n` +
    `  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n` +
    `    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">\n` +
    `      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title>\n` +
    `      <dc:creator><rdf:Seq><rdf:li>${creator}</rdf:li></rdf:Seq></dc:creator>\n` +
    `    </rdf:Description>\n` +
    `    <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">\n` +
    `      <xmp:CreateDate>${now}</xmp:CreateDate>\n` +
    `      <xmp:ModifyDate>${now}</xmp:ModifyDate>\n` +
    `      <xmp:CreatorTool>Factur-X Generator Sprint 5</xmp:CreatorTool>\n` +
    `    </rdf:Description>\n` +
    `    <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">\n` +
    `      <pdfaid:part>3</pdfaid:part>\n` +
    `      <pdfaid:conformance>B</pdfaid:conformance>\n` +
    `    </rdf:Description>\n` +
    `  </rdf:RDF>\n` +
    `</x:xmpmeta>\n` +
    `<?xpacket end="w"?>\n`
  );
}

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtDate(d: string | Date | null): string {
  if (!d) return '—';
  const iso = d instanceof Date ? d.toISOString() : d;
  return iso.slice(0, 10).split('-').reverse().join('/');
}

function fmtEur(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €';
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}+00'00'`;
}

function xml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
