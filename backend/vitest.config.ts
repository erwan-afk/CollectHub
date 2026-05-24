import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/services/ocr/**', 'src/db/invoice-queries.ts'],
      exclude: ['src/services/ocr/__tests__/fixtures/**'],
      reporter: ['text', 'lcov'],
      // Cible roadmap : 70% sur OCR + invoice-queries (auth.service testé via HTTP)
      thresholds: { lines: 70 },
    },
  },
});
