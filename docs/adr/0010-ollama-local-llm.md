# ADR 0010 — Ollama local comme alternative à Claude

**Date :** 2026-05-23  
**Statut :** Accepté

## Contexte

L'extraction IA (Sprint 3) dépend de l'API Anthropic (Claude), ce qui impose :
1. Une clé API obligatoire — impossible de développer sans
2. Un coût par facture (~$0.001 avec cache)
3. Une latence réseau
4. Pas de fonctionnement offline

Pour le développement local et les démos, on veut un fallback gratuit et sans dépendance réseau.

## Options

| Option | Coût | Tool use | Prompt caching | Setup |
|--------|------|----------|---------------|-------|
| Anthropic (Claude) | $0.001/facture | ✅ | ✅ | Clé API |
| Ollama (local) | 0 | ❌ (JSON mode) | ❌ | `ollama pull qwen2.5:3b` |
| OpenAI | ~$0.002/facture | ✅ | ❌ | Clé API |

## Décision

**Ollama** comme provider local, avec `AI_PROVIDER=ollama` dans `.env`.

Architecture :
```
AI_PROVIDER env var
     ↓
extractor-factory.ts → getExtractor()
     ↓
  ┌──────────────┬──────────────────┐
  │ anthropic    │ ollama           │
  │ Claude API   │ Ollama local     │
  │ tool_use     │ format: "json"   │
  │ prompt cache │ pas de cache     │
  │ coût > 0     │ coût = 0         │
  └──────────────┴──────────────────┘
```

L'interface `IInvoiceExtractor` garantit que les deux implémentations sont interchangeables.

## Modèle recommandé

`qwen2.5:3b` (~2 GB, < 5 s/facture sur CPU récent, < 1 s sur GPU).

La qualité d'extraction est inférieure à Claude (pas de tool_use, pas de cache, modèle plus petit), mais suffisante pour le développement.

## Conséquences

- `.env` : `AI_PROVIDER=ollama` + `OLLAMA_MODEL=qwen2.5:3b` (plus besoin de `ANTHROPIC_API_KEY`)
- Le pipeline est inchangé : `getExtractor().extract()` → même interface
- Tests : mockent la factory, pas l'implémentation
- Logs : `ai.factory.using_ollama` vs `ai.factory.using_anthropic`

```bash
# Pour switcher en local :
ollama pull qwen2.5:3b
echo "AI_PROVIDER=ollama" >> .env
npm run dev
```
