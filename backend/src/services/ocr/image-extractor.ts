export interface ImageOcrResult {
  text: string;
  confidence: number;
}

let workerPromise: Promise<unknown> | null = null;

async function getWorker(): Promise<unknown | null> {
  if (workerPromise) return workerPromise;
  try {
    const { createWorker } = await import('tesseract.js');
    workerPromise = (async () => {
      const w = await createWorker('fra');
      return w;
    })();
    return workerPromise;
  } catch {
    return null;
  }
}

export async function extractImageText(filePath: string): Promise<ImageOcrResult> {
  const w = await getWorker();
  if (!w) return { text: '', confidence: 0 };
  try {
    const worker = w as { recognize: (p: string) => Promise<{ data: { text: string; confidence: number } }> };
    const { data } = await worker.recognize(filePath);
    return {
      text: (data.text ?? '').replace(/\r/g, ''),
      confidence: Math.max(0, Math.min(1, (data.confidence ?? 0) / 100)),
    };
  } catch {
    return { text: '', confidence: 0 };
  }
}
