/**
 * OCR Service — extracteur de texte brut uniquement.
 * Sprint 3 : le parsing des champs est délégué au pipeline hybride (services/ai/pipeline.ts).
 */
import { extractPdfText } from './pdf-extractor';
import { extractImageText } from './image-extractor';

export type OcrSource = 'pdf-text' | 'image-ocr' | 'empty';

export interface TextExtractionResult {
  rawText: string;
  ocrConfidence: number;
  source: OcrSource;
}

export async function extractTextFromFile(
  filePath: string,
  mime: string,
): Promise<TextExtractionResult> {
  if (mime === 'application/pdf') {
    const text = await extractPdfText(filePath);
    if (text.trim().length < 50) {
      return { rawText: text, ocrConfidence: 0, source: 'empty' };
    }
    return { rawText: text, ocrConfidence: 1, source: 'pdf-text' };
  }

  if (mime.startsWith('image/')) {
    const { text, confidence } = await extractImageText(filePath);
    if (!text || text.trim().length < 10) {
      return { rawText: text ?? '', ocrConfidence: 0, source: 'empty' };
    }
    return { rawText: text, ocrConfidence: confidence, source: 'image-ocr' };
  }

  return { rawText: '', ocrConfidence: 0, source: 'empty' };
}
