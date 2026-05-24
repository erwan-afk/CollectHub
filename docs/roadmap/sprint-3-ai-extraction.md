# Sprint 3 — IA d'extraction

**Durée cible :** 2 semaines
**Skills travaillés :** LLM, prompt engineering, structured outputs, prompt caching, détection de fraude

> **Sprint le plus différenciant pour Yooz.** Le pitch produit Yooz parle de "meilleure combinaison sur le marché de l'IA, du Machine Learning et du Big Data", de "détection de fraude" et de "auto-suggestion / auto-apprentissage". Ce sprint te donne un argument direct en entretien.

## Objectif

Remplacer l'extraction regex (`backend/src/services/ocr/field-parser.ts`) par une vraie pipeline IA hybride : regex rapide d'abord, LLM en fallback intelligent, mémoire des corrections utilisateur, détection d'anomalies.

## Livrables

### 1. Intégration Claude API
- SDK officiel : `@anthropic-ai/sdk`.
- Modèle par défaut : **`claude-haiku-4-5-20251001`** (coût/latence optimal pour ce volume).
- Service `backend/src/services/ai/extractor.service.ts` :
  - Input : texte OCR brut + supplier_id éventuel.
  - Output : `Invoice` typé strict (Zod schema).
  - Utilise **tool use** (`tool_choice: { type: "tool", name: "extract_invoice" }`) pour forcer la sortie JSON structurée.
- Variables d'env : `ANTHROPIC_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`.

### 2. Prompt caching
- System prompt long et stable (~2000 tokens d'instructions + exemples) → marqué `cache_control: { type: "ephemeral" }`.
- Mesurer le `cache_read_input_tokens` dans les réponses → logger le hit rate.
- **Argument entretien direct** : "j'ai mis en place du prompt caching, on lit X% des tokens depuis le cache, ça divise le coût par Y".

### 3. Pipeline hybride
Architecture du nouveau `services/ai/pipeline.ts` :

```
OCR text
   ↓
[Regex pass]  → si tous les champs avec confiance > 0.8 → DONE (gratuit, instantané)
   ↓ sinon
[LLM pass]    → Claude extrait les champs manquants/incertains
   ↓
[Merge]       → fusion regex + LLM avec score combiné
   ↓
Invoice typée
```

Logger les décisions (`regex_only`, `llm_fallback`, `llm_full`) pour analyse de coût.

### 4. Auto-apprentissage par supplier
- Table `extraction_corrections` : `id, supplier_id, field, raw_text_snippet, ai_value, corrected_value, created_at`.
- Quand un user corrige un champ dans la page review, on l'enregistre.
- Au prochain appel LLM **pour le même supplier**, on injecte les 3-5 dernières corrections comme few-shot examples dans le user prompt.
- Effet : le système "apprend" les formats spécifiques de chaque fournisseur (numéros de facture custom, libellés, etc.).

### 5. Détection de fraude
Service `backend/src/services/fraud/risk-scorer.ts`. Heuristiques :
- **Montant aberrant** : > 3 écarts-types vs historique du supplier (90 derniers jours).
- **IBAN changé** : IBAN ≠ dernier IBAN connu pour ce supplier → flag rouge.
- **Doublon proche** : même supplier + même montant + même mois → flag jaune.
- **Numéro non-séquentiel** : grand saut vs derniers numéros connus pour ce supplier.
- **Date incohérente** : date d'émission future ou > 1 an.

Sortie : `{ score: 0-100, flags: string[] }` stocké dans `invoices.risk_assessment` (JSONB). Si score > 70 → notification + workflow d'approbation forcé (préparé pour le sprint 4).

### 6. YoozSmartSplit-like
Endpoint `POST /invoices/split` :
- Input : un PDF multi-pages contenant plusieurs factures.
- Algo de détection des séparateurs :
  - Page blanche.
  - Apparition de "FACTURE N°" / "INVOICE #" / "FACTURE Nº".
  - Changement de SIRET émetteur entre deux pages.
  - Changement net de mise en page (densité texte, position du logo).
- Output : N PDFs séparés, chacun crée une `Invoice` qui part dans la queue OCR du sprint 2.

Lib utile : `pdf-lib` pour le découpage, le texte par page vient déjà de `pdf-parse`.

## Fichiers clés

**Nouveaux :**
- `backend/src/services/ai/extractor.service.ts`
- `backend/src/services/ai/pipeline.ts`
- `backend/src/services/ai/prompts/system.ts` — long system prompt cacheable
- `backend/src/services/ai/prompts/few-shot.ts` — injection des corrections
- `backend/src/services/ai/tools.ts` — définition du tool `extract_invoice` avec Zod
- `backend/src/services/fraud/risk-scorer.ts`
- `backend/src/services/ocr/pdf-splitter.ts`
- `backend/src/db/extraction-corrections-schema.sql` (ou migration Drizzle)
- `backend/tests/services/ai/extractor.test.ts` — tests avec mocks SDK

**À refactorer :**
- `backend/src/workers/ocr.worker.ts` (sprint 2) — appelle désormais le pipeline hybride au lieu de `field-parser.ts` directement.
- `backend/src/services/ocr/ocr.service.ts` — devient pur extracteur de **texte**, plus de parsing de champs.
- `src/app/pages/invoice-review/` — afficher les flags de fraude + champ "corriger" qui enregistre dans `extraction_corrections`.

## Validation de fin de sprint

1. Sur un set de 20 factures variées (différents fournisseurs, formats), le pipeline extrait correctement > 90% des champs critiques (numéro, date, montants, SIRET).
2. Le hit rate du prompt cache est > 80% après 10 appels (log à montrer).
3. Une correction utilisateur sur le supplier X améliore mesurablement les extractions suivantes pour le même supplier.
4. Un PDF avec un IBAN modifié déclenche un flag rouge automatique.
5. Un PDF multi-factures (au moins 3) est correctement découpé via `/invoices/split`.
6. Le coût par facture est mesuré et documenté (ex : "0.003€/facture en moyenne").

## ADR à rédiger

- `docs/adr/0007-claude-haiku-vs-sonnet-cost-benchmark.md`
- `docs/adr/0008-hybrid-regex-llm-pipeline.md`
- `docs/adr/0009-fraud-heuristics-v1.md`

## Notes coût

Estimer le budget : 1000 factures × ~3000 tokens input × ~500 tokens output sur Haiku 4.5 → quelques euros. Avec prompt caching, encore moins. Garder un compteur dans `extraction_corrections.cost_usd` pour pouvoir parler chiffres en entretien.
