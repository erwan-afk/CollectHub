<h1 align="center">Invoice Platform — Terrain d'entraînement Node.js / Angular</h1>

<p align="center">
  <em>Plateforme full-stack de traitement de factures construite comme préparation à un poste <strong>80 % Node.js / 20 % Angular</strong> chez <a href="https://www.getyooz.com/">Yooz</a> (PDP, e-invoicing, IA d'extraction, workflows).</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Express_4-339933?style=flat-square&logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript" alt="TS strict" />
  <img src="https://img.shields.io/badge/PostgreSQL-Drizzle-336791?style=flat-square&logo=postgresql" alt="PG" />
  <img src="https://img.shields.io/badge/Redis-BullMQ-DC382D?style=flat-square&logo=redis" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Socket.io-realtime-010101?style=flat-square&logo=socket.io" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Anthropic-Claude-D97757?style=flat-square&logo=anthropic" alt="Claude" />
  <img src="https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular" alt="Angular 21" />
  <img src="https://img.shields.io/badge/Vitest-tests-6E9F18?style=flat-square&logo=vitest" alt="Vitest" />
  <img src="https://img.shields.io/badge/Factur--X-EN_16931-0F62FE?style=flat-square" alt="Factur-X" />
</p>

---

## 🎯 Pourquoi ce projet

Ce repo est un **terrain d'entraînement orienté entretien** : chaque sprint implémente une brique typique d'un éditeur fintech / PDP (Plateforme de Dématérialisation Partenaire). L'objectif n'est pas de livrer un produit, mais de **construire et savoir défendre** des choix d'architecture : auth, async, IA, e-invoicing réglementaire.

Principes appliqués :

- **Build-from-scratch d'abord, lib éprouvée ensuite** (mini state-machine maison avant XState, mini queue avant BullMQ…)
- **ADR systématiques** dans [`docs/adr/`](./docs/adr/) — 12 décisions argumentées, alternatives écartées, conséquences
- **`LEARNINGS.md`** vivant — 5 à 10 lignes par sprint sur les pièges rencontrés (matière à STAR en entretien)
- **TypeScript strict des deux côtés**, Zod sur toutes les entrées, multi-tenant enforced **à la signature des fonctions**

📚 **Entrée recruteur complète** → [`docs/README.md`](./docs/README.md)

---

## 🧱 Ce qui a été construit

| Domaine | Implémenté |
|---|---|
| **Auth & sécurité** | JWT access + refresh, rotation des refresh tokens, double hash SHA-256, HMAC-SHA256 sur webhooks (pattern GitHub/Stripe) |
| **Multi-tenant** | Isolation par `organization_id` dès la signature des queries (`orgId` 1ᵉʳ paramètre), rooms Socket.io `org:{id}` |
| **Async & temps réel** | BullMQ + Redis, workers séparés (OCR / email / webhooks / IA), dead-letter queue, Socket.io sur HTTP server, `202 Accepted` + push WS |
| **Extraction IA** | Pipeline hybride **regex → LLM** (≈ 60 % court-circuit gratuit), Claude tool use (structured output garanti), **prompt caching > 80 % hit rate** (coût ÷ 5) |
| **Agent IA** | Tool use multi-step, RAG pgvector, streaming SSE, evals automatisées |
| **Détection de fraude** | Heuristiques IBAN/SIREN + z-score sur montants, `Promise.allSettled` pour tolérance partielle |
| **E-invoicing Factur-X** | PDF/A-3 + XML CII conforme EN 16931, validation XSD + Schematron manuscrit, tests round-trip 8/8 |
| **Frontend Angular 21** | Standalone components, signals, control flow `@if`/`@for`, Material 3, Tailwind 4, timeline cycle de vie facture |
| **Observabilité** | Winston structuré + `AsyncLocalStorage` pour propager `requestId` à travers les `await` sans passing manuel |
| **Qualité** | Vitest des deux côtés, mocks `vi.hoisted()`, migrations Drizzle versionnées |

---

## 🗺️ Roadmap — 5 sprints

| Sprint | Thème | Compétences | Statut |
|---|---|---|---|
| [1](./docs/roadmap/sprint-1-fondations.md) | Fondations | Auth, multi-tenant, Drizzle, Winston, tests | ✅ |
| [2](./docs/roadmap/sprint-2-async-pipeline.md) | Pipeline asynchrone | BullMQ, Redis, Socket.io, webhooks HMAC | ✅ |
| [3](./docs/roadmap/sprint-3-ai-extraction.md) | IA d'extraction | Claude tool use, prompt caching, fraude | ✅ |
| [4](./docs/roadmap/sprint-4-agentic-ai.md) | Agent IA conversationnel | Multi-step tool use, RAG pgvector, SSE | ✅ |
| [5](./docs/roadmap/sprint-5-facturx.md) | Factur-X / e-invoicing | PDF/A-3, XML CII, EN 16931, UBL Peppol | ✅ |

---

## 💡 Chiffres argumentables en entretien

- **Prompt caching Anthropic** : > 80 % hit rate → **coût par facture passé de ~$0.004 à ~$0.001** (÷ 5)
- **Pipeline hybride regex/LLM** : ~60 % des factures traitées **sans appel LLM** → économie 50-70 %
- **Tests Factur-X round-trip** : 8/8 (génération → parse → validation EN 16931 → re-génération identique)
- **Multi-tenant** : isolation enforced **au niveau type**, pas seulement WHERE — impossible d'oublier `orgId`

Détail des anecdotes STAR dans [`docs/LEARNINGS.md`](./docs/LEARNINGS.md).

---

## 🏗️ Architecture

```
Angular 21 (4200)
    ↕ HTTP REST + WebSocket
Express 4 + TypeScript (3000)
    ↕ SQL (Drizzle)
PostgreSQL (Neon serverless, 5432)
    ↕ jobs
Redis / BullMQ (6379)
    ↕
Workers séparés : OCR · Email · Webhooks · IA
```

Le backend tourne en **deux processus** :

```bash
cd backend && npm run dev       # API Express + Socket.io
cd backend && npm run worker    # Consommateurs BullMQ
```

Structure :

```
.
├── src/                 # Frontend Angular 21
├── backend/src/
│   ├── routes/          # 1 fichier = 1 domaine (auth, invoices, ai, einvoicing…)
│   ├── services/        # Logique métier (jamais dans les routes)
│   ├── db/              # Queries SQL (jamais inline dans une route)
│   ├── middleware/      # 8 middlewares globaux
│   └── workers/         # Processus BullMQ séparés
├── docs/
│   ├── guides/          # 5 guides d'onboarding détaillés
│   ├── roadmap/         # Spec sprint par sprint
│   ├── adr/             # 12 décisions techniques argumentées
│   └── LEARNINGS.md     # Anecdotes STAR
└── scripts/             # Seed, check-facturx, round-trip…
```

---

## 🚀 Stack technique

**Backend** — Node.js · Express 4 · TypeScript strict · PostgreSQL (Neon) · Drizzle ORM · Redis + BullMQ · Socket.io · Zod · Winston · Anthropic SDK (Claude) · pdf-parse · tesseract.js · pdfkit · libxmljs2 · Vitest

**Frontend** — Angular 21 (standalone + signals + control flow) · Angular Material 3 · Tailwind CSS 4 · RxJS · Vitest

**Outillage** — Drizzle Kit (migrations) · Bull Board · Docker Compose (Postgres + pgAdmin) · ESLint + Prettier

---

## 📦 Démarrage

### Prérequis

- Node.js ≥ 18
- Docker (Postgres + Redis locaux) ou un compte [Neon](https://neon.tech/)
- Une clé API Anthropic (sprint 3+) — optionnel : Ollama local

### Installation

```bash
# Dépendances
npm install
cd backend && npm install && cd ..

# Infra locale
docker compose up -d            # Postgres + pgAdmin (+ Redis)

# .env (racine et backend/.env) — voir backend/.env.example
cp backend/.env.example backend/.env

# Migrations + seed
cd backend && npm run db:migrate && npm run db:seed && cd ..
```

### Lancement

```bash
# Terminal 1 — API
cd backend && npm run dev

# Terminal 2 — Workers BullMQ
cd backend && npm run worker

# Terminal 3 — Front
npm start
```

→ Ouvrir **http://localhost:4200/**

---

## 🛠️ Commandes utiles

| Commande | Description |
|---|---|
| `npm start` | Dev server Angular |
| `npm run build` | Build front production |
| `npm test` | Tests Vitest front |
| `cd backend && npm run dev` | API Express + Socket.io |
| `cd backend && npm run worker` | Workers BullMQ |
| `cd backend && npm test` | Tests Vitest backend |
| `cd backend && npm run db:migrate` | Applique les migrations Drizzle |
| `cd backend && npm run db:seed` | Seed de démo |
| `node scripts/check-facturx.ts <file.pdf>` | Validation Factur-X EN 16931 |
| `docker compose up -d` | Postgres + pgAdmin |

---

## 📚 Documentation

Tout est dans [`docs/`](./docs/) :

- **[docs/README.md](./docs/README.md)** — entrée recruteur (TL;DR + parcours suggéré)
- **[docs/guides/](./docs/guides/)** — 5 guides détaillés (overview, backend, features, frontend, data flows, glossaire)
- **[docs/roadmap/](./docs/roadmap/)** — spec sprint par sprint
- **[docs/adr/](./docs/adr/)** — 12 décisions techniques argumentées
- **[docs/LEARNINGS.md](./docs/LEARNINGS.md)** — pièges rencontrés + solutions (matière STAR)

---

## 📄 Licence

Projet personnel d'entraînement — usage non commercial.

<p align="center"><em>Stack & décisions documentées sprint par sprint pour servir de support d'entretien.</em></p>
