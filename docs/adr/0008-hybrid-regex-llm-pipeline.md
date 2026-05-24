# ADR 0008 — Pipeline hybride regex + LLM

**Date :** 2026-05-23  
**Statut :** Accepté

## Contexte

Deux extrêmes possibles :
- **100% regex** (`field-parser.ts`) : gratuit, instantané, mais fragile sur formats non-standards
- **100% LLM** : robuste, mais ~$0.001 par facture même pour les factures simples

## Décision

Pipeline hybride en deux passes :

```
OCR text
   ↓
[Regex pass]  → si champs critiques confidence > 0.8 → DONE (gratuit, < 1 ms)
   ↓ sinon
[LLM pass]    → Claude extrait les champs manquants/incertains
   ↓
[Merge]       → on garde la valeur avec le meilleur score
```

**Champs critiques** : `invoice_number`, `issue_date`, `amount_ht`, `amount_ttc`  
**Seuil regex** : 0.8 de confiance (ajustable)

## Estimation d'économies

Sur un corpus de factures typiques :
- ~60% "regex only" (formats standards) → 0 coût LLM
- ~30% "llm fallback" (quelques champs manquants) → coût réduit (moins de tokens)
- ~10% "llm full" (OCR très dégradé) → coût plein

Économie estimée vs 100% LLM : ~50-70%.

## Log de décision

Chaque facture loggue son `pipelineMode` (`regex_only` | `llm_fallback` | `llm_full`).
Cela permet d'analyser la répartition réelle et d'ajuster le seuil.

## Conséquences

- `field-parser.ts` est conservé (valeur de référence + fallback rapide)
- `ocr.service.ts` devient un pure text extractor (séparation des responsabilités)
- Le worker appelle `runExtractionPipeline()` au lieu de `parseFields()` directement
