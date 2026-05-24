// Module declarations for libs without @types packages.
// Keep this file at the root of a directory included in tsconfig's "include".

declare module 'mustache' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Mustache {
    function render(
      template: string,
      view: Record<string, unknown>,
      partials?: Record<string, string>,
      tags?: [string, string],
    ): string;
    function escape(value: string): string;
  }
  export default Mustache;
}

declare module 'libxmljs2' {
  export function parseXml(xml: string): {
    validate(xsd: ReturnType<typeof parseXml>): boolean;
    validationErrors: Array<{ line?: number; column?: number; message: string }>;
    toString(): string;
  };
  export function parseXmlString(xml: string): ReturnType<typeof parseXml>;
}

declare module 'pdfkit' {
  import type { Readable } from 'stream';

  interface PDFKitOptions {
    margin?: number;
    size?: string | [number, number];
    layout?: 'portrait' | 'landscape';
    info?: Record<string, string>;
    [key: string]: unknown;
  }

  class PDFDocument extends Readable {
    constructor(options?: PDFKitOptions);

    on(event: string, callback: (...args: unknown[]) => void): this;

    // Text helpers
    fontSize(size: number): this;
    font(name: string): this;
    fillColor(color: string): this;
    text(text: string, options?: Record<string, unknown>): this;
    text(text: string, x: number, y: number, options?: Record<string, unknown>): this;
    moveDown(lines?: number): this;
    currentLineHeight(): number;

    // Position
    y: number;

    // Drawing
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(): this;

    end(): void;
  }

  export = PDFDocument;
}
