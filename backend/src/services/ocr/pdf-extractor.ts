import * as fs from 'fs';

type PdfParseCtor = new (opts: { data: Uint8Array }) => {
  getText(): Promise<{ text: string }>;
  destroy(): Promise<void>;
};

let PDFParseClass: PdfParseCtor | null = null;

async function loadPdfParse(): Promise<PdfParseCtor | null> {
  if (PDFParseClass) return PDFParseClass;
  try {
    // pdf-parse@2.x : classe PDFParse exportée depuis le point d'entrée.
    // require() pour rester compatible avec ts-node CommonJS.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('pdf-parse');
    PDFParseClass = (mod.PDFParse ?? mod.default?.PDFParse ?? null) as PdfParseCtor | null;
    return PDFParseClass;
  } catch {
    return null;
  }
}

export async function extractPdfText(filePath: string): Promise<string> {
  const Ctor = await loadPdfParse();
  if (!Ctor) return '';
  let parser: InstanceType<PdfParseCtor> | null = null;
  try {
    const buf = fs.readFileSync(filePath);
    parser = new Ctor({ data: new Uint8Array(buf) });
    const result = await parser.getText();
    return (result.text ?? '').replace(/\r/g, '');
  } catch {
    return '';
  } finally {
    if (parser) {
      try { await parser.destroy(); } catch { /* ignore */ }
    }
  }
}
