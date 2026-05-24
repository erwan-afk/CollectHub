# ADR 0007 — Choix du modèle : Haiku 4.5 vs Sonnet

**Date :** 2026-05-23  
**Statut :** Accepté

## Contexte

Le sprint 3 requiert un LLM pour l'extraction de champs de factures. Deux candidats :
- `claude-haiku-4-5-20251001` : modèle rapide, coût bas
- `claude-sonnet-4-6` : modèle plus capable, coût ~10× supérieur

## Benchmark (estimations sur 1000 factures)

| Modèle | Input $/M | Output $/M | Cache read $/M | Coût/facture (sans cache) | Coût/facture (80% cache) |
|--------|-----------|------------|----------------|--------------------------|--------------------------|
| Haiku 4.5 | $0.80 | $4.00 | $0.08 | ~$0.004 | ~$0.001 |
| Sonnet 4.6 | $3.00 | $15.00 | $0.30 | ~$0.015 | ~$0.004 |

Hypothèses : ~3000 tokens input, ~300 tokens output par facture.

## Décision

**Haiku 4.5** pour la production. Raisons :
1. Extraction structurée via tool use → la complexité de raisonnement n'est pas le facteur limitant
2. Le prompt caching couvre ~80% des tokens input (system prompt stable) → coût réel ~$0.001/facture
3. Latence Haiku (~1-2 s) vs Sonnet (~4-8 s) : critique pour UX upload

Sonnet reste disponible via `AI_MODEL=claude-sonnet-4-6` pour les cas edge (factures très dégradées).

## Conséquences

- `AI_MODEL` configurable via env → facile de tester Sonnet sur un subset
- Logger `cacheHitRate` par appel pour mesurer l'efficacité réelle du cache
- Budget estimé : 1000 factures/mois ≈ 1-2 € avec Haiku + cache
