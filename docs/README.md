# Documentation — Projet d'entraînement Node.js / Angular (cible Yooz)

> Terrain d'entraînement backend-lourd construit pour préparer un poste **80 % Node.js / 20 % Angular** chez **Yooz** (PDP, facturation électronique, IA d'extraction, workflows, paiements, ERP).

Ce dossier est l'**entrée recruteur** : guides d'architecture, décisions techniques (ADR), roadmap sprint par sprint, et carnet d'apprentissages (anecdotes STAR pour entretien).

---

## TL;DR — Ce que ce projet démontre

| Domaine | Ce qui a été construit |
|---|---|
| **Backend Node.js** | Express 4 + TypeScript strict, architecture en couches (routes / services / queries), Zod sur toutes les entrées, Winston + AsyncLocalStorage pour le requestId contextuel |
| **Auth & sécurité** | JWT access + refresh, rotation des refresh tokens, double hash SHA-256 en base, HMAC-SHA256 sur webhooks sortants (pattern GitHub/Stripe) |
| **Multi-tenant** | Isolation par `organization_id` dès la signature des fonctions de query (1ᵉʳ paramètre `orgId`) + rooms Socket.io par org |
| **Async & temps réel** | BullMQ + Redis, workers séparés (OCR / email / webhooks / IA), dead-letter queue, Socket.io monté sur le HTTP server, `202 Accepted` + push WebSocket |
| **IA d'extraction** | Pipeline hybride **regex → LLM** (≈ 60 % court-circuit gratuit), Claude tool use pour structured output garanti, **prompt caching > 80 % hit rate** (coût ÷ 5), Zod en double filet |
| **Agentic AI** | Tool use multi-step, RAG pgvector, streaming SSE, evals |
| **E-invoicing** | Factur-X (PDF/A-3 + XML CII), validation EN 16931 + Schematron manuscrit, conformité PDP — `scripts/check-facturx` CLI |
| **Détection de fraude** | Heuristiques IBAN/SIREN + z-score sur montants, `Promise.allSettled` pour parallélisme tolérant aux pannes |
| **Frontend Angular 21** | Standalone components, signals, control flow `@if`/`@for`, Angular Material + Tailwind 4, timeline de cycle de vie de facture |
| **Qualité** | Vitest des deux côtés (mocks via `vi.hoisted()`), tests round-trip Factur-X (8/8), migrations Drizzle, ADR systématiques |

---

## Démarrage rapide

```bash
# Backend
cd backend && npm install && npm run dev          # API Express + Socket.io
cd backend && npm run worker                      # Workers BullMQ

# Frontend
npm install && npm start                          # Angular sur :4200

# Tests
cd backend && npm test                            # Vitest backend
npm test                                          # Vitest front
```

Architecture en un schéma :

```
Angular (4200)  ↕ HTTP REST + WebSocket
Express (3000)  ↕ SQL
PostgreSQL (5432)  ↕ jobs
Redis / BullMQ (6379)
```

---

## Parcours suggéré pour un recruteur

1. **[guides/00-project-overview.md](./guides/00-project-overview.md)** — vue d'ensemble (5 min)
2. **[guides/01-backend-architecture.md](./guides/01-backend-architecture.md)** — couches, middlewares, conventions
3. **[guides/02-features-deep-dive.md](./guides/02-features-deep-dive.md)** — chaque feature détaillée
4. **[guides/04-data-flows.md](./guides/04-data-flows.md)** — flux bout en bout (upload → OCR → IA → fraude → webhook)
5. **[adr/](./adr/)** — décisions techniques argumentées
6. **[LEARNINGS.md](./LEARNINGS.md)** — pièges rencontrés (matière à STAR en entretien)

---

## Roadmap — 5 sprints, 5 briques métier Yooz

Chaque sprint = **1 brique backend complexe + tests + petit ajout front pour la démo**.

| Sprint | Thème | Compétence visée | Statut |
|---|---|---|---|
| [1](./roadmap/sprint-1-fondations.md) | Auth + multi-tenant + migrations Drizzle | Fondations backend | ✅ |
| [2](./roadmap/sprint-2-async-pipeline.md) | BullMQ + Socket.io + webhooks HMAC | Async, temps réel, intégrations | ✅ |
| [3](./roadmap/sprint-3-ai-extraction.md) | Claude API + OCR + fraude | IA d'extraction | ✅ |
| [4](./roadmap/sprint-4-agentic-ai.md) | Tool use multi-step + RAG pgvector + SSE | Agent IA conversationnel | ✅ |
| [5](./roadmap/sprint-5-facturx.md) | PDF/A-3 + XML CII + EN 16931 + UBL Peppol | E-invoicing réglementaire (cœur PDP) | ✅ |

Détail des principes dans [roadmap/README.md](./roadmap/README.md).

---

## Décisions techniques (ADR)

12 ADR courts et argumentés — chacun documente le **pourquoi**, les alternatives écartées, et les conséquences :

- **Persistance** — [0001 Drizzle vs node-pg-migrate](./adr/0001-drizzle-vs-node-pg-migrate.md)
- **Sécurité** — [0002 JWT access + refresh](./adr/0002-jwt-strategy-access-refresh.md) · [0003 Multi-tenant isolation](./adr/0003-multi-tenant-isolation-pattern.md)
- **Async** — [0004 BullMQ vs Bee-Queue](./adr/0004-bullmq-vs-bee-queue.md)
- **IA** — [0007 Haiku vs Sonnet (benchmark coût)](./adr/0007-claude-haiku-vs-sonnet-cost-benchmark.md) · [0008 Pipeline hybride regex/LLM](./adr/0008-hybrid-regex-llm-pipeline.md) · [0009 Heuristiques fraude v1](./adr/0009-fraud-heuristics-v1.md) · [0010 Ollama local LLM](./adr/0010-ollama-local-llm.md)
- **E-invoicing** — [0016 PDF/A-3 from scratch vs lib](./adr/0016-pdf-a3-build-from-scratch-vs-lib.md) · [0017 libxmljs2 vs xsd-schema-validator](./adr/0017-libxmljs2-vs-xsd-schema-validator.md) · [0018 EN 16931 profil par défaut](./adr/0018-en16931-profile-default.md) · [0019 Schematron sous-ensemble manuscrit](./adr/0019-schematron-handwritten-subset.md)

---

## Quelques chiffres argumentables en entretien

- **Prompt caching Anthropic** : > 80 % hit rate après ~10 appels → **coût par facture passé de ~$0.004 à ~$0.001** (÷ 5).
- **Pipeline hybride regex/LLM** : ~**60 % des factures** traitées sans appel LLM (regex confidence > 0.8) → économie réelle de **50-70 %** vs 100 % LLM.
- **Tests Factur-X round-trip** : **8/8** (génération → parsing → validation EN 16931 → re-génération identique).
- **Multi-tenant** : isolation enforced **à la signature de fonction** (`orgId` en 1ᵉʳ paramètre), pas seulement par WHERE — impossible d'oublier.

---

## Anecdotes STAR — voir [LEARNINGS.md](./LEARNINGS.md)

Sélection :

- **Zod `.optional().transform()`** perd l'optionalité → diagnostic + solution `z.preprocess()`
- **`vi.hoisted()`** indispensable pour partager des mocks entre `vi.mock()` factories
- **Rotation refresh token** : un token volé invalide la chaîne entière → détection automatique
- **AsyncLocalStorage** pour propager `requestId` à travers les `await` sans passing manuel
- **Socket.io rooms** `org:{id}` pour l'isolation multi-tenant temps réel
- **Tool use Anthropic** = structured output garanti, sans prompt-engineering JSON
- **Schematron manuscrit** au lieu d'un moteur complet : 100 lignes vs dépendance Java

---

## Stack résumée

**Backend** — Node.js · Express 4 · TypeScript strict · PostgreSQL (Neon serverless) · Drizzle ORM · Redis + BullMQ · Socket.io · Zod · Winston · Anthropic SDK · pdf-parse · tesseract.js · pdfkit · libxmljs2 · Vitest

**Frontend** — Angular 21 (standalone + signals + control flow) · Angular Material · Tailwind CSS 4 · RxJS · Vitest

**Pratiques** — TypeScript strict des deux côtés, Zod sur toutes les entrées, ADR systématiques, LEARNINGS.md vivant, multi-tenant enforced au niveau type, tests sur services critiques (auth, extraction IA, Factur-X round-trip).
