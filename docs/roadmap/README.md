# Roadmap — Préparation poste Node.js / Angular (Yooz)

Ce dossier contient le plan d'entraînement pour transformer le projet `Collection Manager` en terrain de jeu backend-lourd, aligné sur le domaine Yooz (PDP, facturation électronique, IA d'extraction, workflows, paiements, ERP).

Cible : poste 80% Node.js back / 20% Angular front.

## Sprints actifs

1. [Sprint 1 — Fondations professionnelles](./sprint-1-fondations.md) — Auth, multi-tenant, migrations, tests, logging
2. [Sprint 2 — Pipeline asynchrone & temps réel](./sprint-2-async-pipeline.md) — BullMQ, Redis, Socket.io, webhooks
3. [Sprint 3 — IA d'extraction](./sprint-3-ai-extraction.md) — Claude API, prompt caching, fraude, smart split
4. [Sprint 4 — Agent IA conversationnel](./sprint-4-agentic-ai.md) — tool use multi-step, RAG pgvector, streaming SSE, evals
5. [Sprint 5 — Factur-X / e-invoicing](./sprint-5-facturx.md) — PDF/A-3, XML CII, UBL Peppol, validation EN 16931, conformité PDP

## Principes

- **Chaque sprint** = 1 brique back complexe + tests + petit ajout front pour la démo.
- **Build-from-scratch d'abord, lib éprouvée ensuite** quand le concept est compris.
- **Toujours mesurer** : logs structurés + métriques dès le départ.
- **ADR courts** dans `docs/adr/` pour capitaliser les décisions techniques (précieux en entretien).
- **`LEARNINGS.md` à la racine** : 5–10 lignes par sprint sur les pièges rencontrés → réservoir de réponses STAR.

## État actuel du projet (snapshot)

- ✅ OCR basique (regex), CRUD invoices/suppliers, state machine 5 états, Zod, rate-limit, Winston, indexes PG
- ❌ Aucune auth, aucun multi-tenant, aucun job async, aucun WebSocket, aucun moteur BPMN, aucune IA, aucun format e-invoicing, aucun paiement, aucun connecteur ERP, aucun test, aucun Docker/CI
