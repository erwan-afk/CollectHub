<h1 align="center">Invoice Platform</h1>

<p align="center">
  <em>Plateforme full-stack de traitement et dématérialisation de factures — OCR, extraction IA, détection de fraude, e-invoicing Factur-X conforme EN 16931.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Express_4-339933?style=flat-square&logo=node.js" alt="Node" />
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript" alt="TS strict" />
  <img src="https://img.shields.io/badge/PostgreSQL-Drizzle-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-BullMQ-DC382D?style=flat-square&logo=redis" alt="BullMQ" />
  <img src="https://img.shields.io/badge/Socket.io-realtime-010101?style=flat-square&logo=socket.io" alt="Socket.io" />
  <img src="https://img.shields.io/badge/Anthropic-Claude-D97757?style=flat-square&logo=anthropic" alt="Claude" />
  <img src="https://img.shields.io/badge/Angular-21-DD0031?style=flat-square&logo=angular" alt="Angular 21" />
  <img src="https://img.shields.io/badge/Factur--X-EN_16931-0F62FE?style=flat-square" alt="Factur-X" />
</p>

---

## Aperçu

Plateforme de gestion du cycle de vie complet d'une facture fournisseur, de l'upload au reporting :

1. **Upload** — dépôt PDF, file BullMQ, réponse `202 Accepted` immédiate.
2. **Extraction** — pipeline hybride : OCR + regex rapide en première passe, fallback Claude pour les champs incertains.
3. **Contrôle** — détection de fraude (changement d'IBAN, SIREN inconnu, z-score sur montants).
4. **Validation** — revue humaine côté front, mise à jour temps réel via WebSocket.
5. **Émission** — génération de la facture sortante au format **Factur-X** (PDF/A-3 + XML CII), conforme EN 16931 / profil PDP.
6. **Distribution** — webhooks signés HMAC vers les systèmes tiers (comptabilité, ERP).

Le projet inclut également un **chat IA agentique** capable d'interroger les factures (tool use multi-step, RAG sur les pièces jointes, réponse en streaming SSE).

## Fonctionnalités

| Domaine | Fonctionnalités |
|---|---|
| **Authentification** | Inscription / login, JWT access + refresh, rotation des refresh tokens, rôles (`admin`, `member`) |
| **Multi-tenant** | Organisations isolées, scope automatique des requêtes au niveau du middleware, rooms WebSocket par tenant |
| **Factures entrantes** | Upload PDF, traitement asynchrone (BullMQ), OCR (Tesseract.js + pdf-parse), extraction de champs (montants, TVA, SIREN, IBAN, dates) |
| **Extraction IA** | Pipeline hybride regex → LLM, prompt caching Anthropic, structured output via tool use, fallback Ollama local |
| **Détection de fraude** | Heuristiques IBAN/SIREN, z-score statistique sur historique fournisseur, score 0–100 |
| **Workflow** | State machine 5 états (`PROCESSING` → `EXTRACTED` → `REVIEWING` → `APPROVED` / `REJECTED`), historique d'événements |
| **Temps réel** | Socket.io, push des changements de statut au front, indicateur de progression d'upload |
| **E-invoicing** | Génération Factur-X (PDF/A-3 + XML CII), validation XSD + Schematron, profils EN 16931, mapping UBL Peppol |
| **Intégrations** | Webhooks sortants signés HMAC-SHA256 (pattern GitHub/Stripe), DLQ avec replay manuel |
| **Chat agentique** | Conversation sur le corpus de factures, tool use multi-step, RAG pgvector, streaming SSE, evals automatisées |
| **Observabilité** | Logs structurés (Winston) avec `requestId` propagé via `AsyncLocalStorage`, Bull Board, healthchecks |

## Architecture

```
┌─────────────────────┐      HTTP REST + WebSocket      ┌──────────────────────┐
│   Angular 21 (4200) │ ──────────────────────────────► │  Express 4 (3000)    │
│   Material 3 + TW4  │ ◄────────── push WS ──────────  │  Socket.io           │
└─────────────────────┘                                 └──────────┬───────────┘
                                                                   │ Drizzle ORM
                                                                   ▼
                                                        ┌──────────────────────┐
                              jobs                      │  PostgreSQL (Neon)   │
        ┌──────────────────────────────────────────┐    │  + pgvector          │
        │                                          │    └──────────────────────┘
        ▼                                          │
┌─────────────────────┐    ┌─────────────────────┐ │
│  Workers BullMQ     │◄───┤  Redis (6379)       │◄┘
│  ─ OCR              │    └─────────────────────┘
│  ─ AI extraction    │
│  ─ Webhooks signés  │
│  ─ Email / DLQ      │
└─────────────────────┘
```

Le backend tourne en **deux processus séparés** : l'API Express (HTTP + WebSocket) et les workers BullMQ qui consomment les queues en parallèle avec une concurrence configurable.

### Structure du repo

```
.
├── src/                          # Frontend Angular 21
│   └── app/{components,pages,services,models}
├── backend/src/
│   ├── routes/                   # 1 fichier = 1 domaine HTTP
│   ├── services/                 # Logique métier
│   ├── db/                       # Schémas + queries Drizzle
│   ├── workers/                  # Consommateurs BullMQ
│   ├── middleware/               # Auth, rate-limit, logging, errors…
│   └── validation/               # Schémas Zod
├── docs/
│   ├── README.md                 # Index documentation
│   ├── guides/                   # Onboarding détaillé
│   ├── roadmap/                  # Spec sprint par sprint
│   └── adr/                      # Décisions techniques argumentées
├── scripts/                      # Seed, check-facturx, round-trip…
└── docker-compose.yml            # Postgres + pgAdmin
```

## Stack technique

**Backend** — Node.js · Express 4 · TypeScript strict · PostgreSQL (Neon serverless) · Drizzle ORM + Drizzle Kit · Redis + BullMQ · Socket.io · Zod · Winston · Anthropic SDK (Claude Sonnet/Haiku) · Ollama (LLM local) · pdf-parse · tesseract.js · pdfkit · libxmljs2

**Frontend** — Angular 21 (standalone components · signals · control flow `@if`/`@for`) · Angular Material 3 · Tailwind CSS 4 · RxJS

**Qualité & ops** — Vitest (back + front) · ESLint + Prettier · Bull Board · Docker Compose · migrations Drizzle versionnées

## Démarrage

### Prérequis

- Node.js ≥ 18
- Docker (Postgres + Redis locaux) **ou** un compte [Neon](https://neon.tech/) + une instance Redis
- Une clé API Anthropic (optionnel — l'extracteur Ollama local peut prendre le relais)

### Installation

```bash
# Dépendances
npm install
cd backend && npm install && cd ..

# Infra locale
docker compose up -d

# Configuration
cp backend/.env.example backend/.env   # éditer DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY…

# Schéma + données de démo
cd backend && npm run db:migrate && npm run db:seed && cd ..
```

### Lancement

```bash
# Terminal 1 — API
cd backend && npm run dev

# Terminal 2 — Workers BullMQ
cd backend && npm run worker

# Terminal 3 — Frontend
npm start
```

Ouvrir **http://localhost:4200/**.

## Commandes

| Commande | Description |
|---|---|
| `npm start` | Dev server Angular |
| `npm run build` | Build production front |
| `npm test` | Tests Vitest front |
| `cd backend && npm run dev` | API Express + Socket.io |
| `cd backend && npm run worker` | Workers BullMQ |
| `cd backend && npm test` | Tests Vitest backend |
| `cd backend && npm run db:migrate` | Applique les migrations Drizzle |
| `cd backend && npm run db:seed` | Seed des données de démo |
| `node scripts/check-facturx.ts <file.pdf>` | Valide un Factur-X (XSD + Schematron + EN 16931) |
| `docker compose up -d` | Démarre Postgres + pgAdmin |

## API REST (extrait)

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` · `/login` · `/refresh` | Auth JWT |
| `GET` `POST` | `/api/v1/invoices` | Liste / upload de factures |
| `GET` | `/api/v1/invoices/:id` | Détail + historique d'événements |
| `POST` | `/api/v1/invoices/:id/approve` · `/reject` | Workflow de validation |
| `POST` | `/api/v1/einvoicing/factur-x` | Génération Factur-X (PDF/A-3 + XML CII) |
| `POST` | `/api/v1/ai/chat` | Chat agentique (SSE streaming) |
| `GET` `POST` | `/api/v1/webhooks` | Endpoints sortants signés HMAC |
| `GET` | `/health` · `/admin/queues` | Healthcheck + Bull Board (rôle admin) |

## Documentation

L'ensemble de la documentation est dans [`docs/`](./docs/) :

- **[docs/README.md](./docs/README.md)** — index général
- **[docs/guides/](./docs/guides/)** — onboarding (overview, backend, features, frontend, data flows, glossaire)
- **[docs/roadmap/](./docs/roadmap/)** — spec par itération
- **[docs/adr/](./docs/adr/)** — décisions techniques (Drizzle, JWT, BullMQ, Schematron, Factur-X…)

## Licence

Projet personnel — usage non commercial.
