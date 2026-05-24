export interface CorrectionExample {
  field: string;
  rawTextSnippet: string;
  aiValue: string;
  correctedValue: string;
}

/**
 * Construit le bloc few-shot à injecter dans le user message.
 * Les corrections passées d'un supplier améliorent les extractions futures.
 */
export function buildFewShotBlock(corrections: CorrectionExample[]): string {
  if (!corrections.length) return '';

  const lines = corrections
    .map(
      (c) =>
        `- Champ "${c.field}" : dans le texte "${c.rawTextSnippet}", j'avais extrait "${c.aiValue}" mais la valeur correcte est "${c.correctedValue}"`,
    )
    .join('\n');

  return `\n\n## Corrections passées pour ce fournisseur\nCes exemples t'aideront à mieux extraire les champs spécifiques à ce fournisseur :\n${lines}\n`;
}
