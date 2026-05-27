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

## 🧭 Aperçu

Plateforme de gestion du cycle de vie complet d'une facture fournisseur, de l'upload au reporting :

1. **Upload** — dépôt PDF, file BullMQ, réponse `202 Accepted` immédiate.
2. **Extraction** — pipeline hybride : OCR + regex rapide en première passe, fallback Claude pour les champs incertains.
3. **Contrôle** — détection de fraude (changement d'IBAN, SIREN inconnu, z-score sur montants).
4. **Validation** — revue humaine côté front, mise à jour temps réel via WebSocket.
5. **Émission** — génération de la facture sortante au format **Factur-X** (PDF/A-3 + XML CII), conforme EN 16931 / profil PDP.
6. **Distribution** — webhooks signés HMAC vers les systèmes tiers (comptabilité, ERP).

Le projet inclut également un **chat IA agentique** capable d'interroger les factures (tool use multi-step, RAG sur les pièces jointes, réponse en streaming SSE).

---

## ✨ Fonctionnalités

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

---

## 🧠 Concepts clés

### 🔄 Pipeline d'extraction hybride (regex → LLM)

L'extraction des champs d'une facture combine deux étapes en cascade pour optimiser coût et latence :

1. **Passe regex/OCR** — Tesseract.js (PDF scannés) ou `pdf-parse` (PDF natifs) produit le texte brut, puis des regex annotées extraient les champs courants (numéro de facture, montants HT/TTC/TVA, dates, SIREN, IBAN). Chaque champ reçoit un score de confiance.
2. **Fallback LLM** — si un champ critique est sous le seuil de confiance, **Claude** est appelé uniquement sur les zones incertaines. La sortie est forcée par **tool use** (`tool_choice: { type: "tool", name: "extract_invoice" }`) : le modèle est *contraint* d'appeler un outil dont le JSON Schema décrit la structure attendue. Plus de parsing de markdown, plus de JSON tronqué. **Zod** re-valide en sortie comme double filet.

Le **prompt caching Anthropic** (`cache_control: { type: "ephemeral" }`) marque le system prompt et le few-shot comme cacheables ; les appels suivants dans la fenêtre TTL relisent ces tokens au tarif "cache read" (10 % du prix normal).

Un extracteur alternatif basé sur **Ollama** (Llama 3, Mistral) est branchable via une interface `IInvoiceExtractor` + factory — utile pour les déploiements on-premise sans dépendance à une API externe.

---

### ⚡ Architecture asynchrone & temps réel

L'API ne fait jamais de travail lourd dans le cycle requête/réponse. L'upload d'une facture suit ce parcours :

```
POST /invoices/upload
  └─► persiste la facture en statut PROCESSING
  └─► enqueue un job BullMQ (queue "ocr")
  └─► répond 202 Accepted immédiatement
                                  │
                                  ▼
                       worker BullMQ (process séparé)
                          OCR → extraction → fraude
                                  │
                                  ▼
                       Socket.io.to("org:42").emit("invoice:updated", …)
                                  │
                                  ▼
                       Angular met à jour le state sans rechargement
```

Les **workers BullMQ** tournent dans un process distinct (`npm run worker`) avec concurrence configurable. Chaque queue (OCR, IA, webhooks, email) a son propre handler, ses propres `attempts` et son **dead-letter queue** : après N échecs, le job est déplacé dans une queue `*-failed` visible dans **Bull Board** et rejouable manuellement via un endpoint admin.

**Socket.io** est monté sur le `http.Server` natif (pas sur Express directement) pour partager le port. À l'authentification, chaque client rejoint la room `org:{organizationId}` — les workers émettent ensuite sur cette room et l'isolation tenant est garantie sans logique supplémentaire.

---

### 🏢 Isolation multi-tenant

Le multi-tenant est appliqué à **trois niveaux** :

- **Middleware** — `scope-to-org.ts` lit le JWT, peuple `req.orgId`, refuse toute requête sans organisation.
- **Signature de fonction** — toute query métier dans `db/*-queries.ts` accepte `orgId: number` en **premier paramètre**. Une fonction qui ne le prend pas est suspecte par convention et bloquée en review. Une fonction qui le prend mais l'oublie dans le `WHERE` ne compile pas la convention, mais la signature force le développeur à le passer.
- **Socket.io rooms** — chaque connexion rejoint `org:{id}` au handshake, et les émissions ciblent toujours une room. Aucun broadcast global.

Cette défense en profondeur évite la classe d'erreurs "TypeScript compile, mais l'isolation est cassée" — le cas le plus fréquent et le plus dangereux dans une plateforme multi-tenant.

---

### 🚨 Détection de fraude

Un score de risque 0–100 est calculé à chaque extraction par combinaison de plusieurs heuristiques exécutées **en parallèle** via `Promise.allSettled` (un check SQL qui échoue n'annule pas les autres) :

- **Changement d'IBAN** — comparaison avec l'IBAN historique du fournisseur (signal fort : poids 40).
- **SIREN inconnu** — fournisseur jamais vu pour cette organisation (poids 15).
- **Z-score sur le montant** — écart par rapport à la moyenne et l'écart-type des factures du même fournisseur. Demande au moins 3 factures historiques sinon retourne `null` plutôt qu'un faux positif (poids 25).
- **Domaine email suspect** — adresse de notification qui ne matche pas le domaine connu (poids 10).
- **Doublon potentiel** — même montant + même fournisseur + date proche (poids 10).

Au-delà du seuil (70 par défaut), la facture passe en revue manuelle obligatoire avec mise en évidence des signaux déclenchés.

---

### 🔐 Sécurité & authentification

- **JWT access + refresh** — l'access token (15 min) est en mémoire côté front, le refresh token (30 j) en `httpOnly` cookie.
- **Rotation systématique** — chaque appel à `/auth/refresh` invalide l'ancien refresh token et en émet un nouveau. Si un token volé est utilisé, l'utilisateur légitime verra sa session invalidée au prochain refresh → détection automatique du vol (pattern Auth0 / IETF).
- **Double hash en base** — les refresh tokens sont stockés en SHA-256 du token brut. Une compromission de la DB ne permet pas de rejouer les sessions.
- **HMAC-SHA256 sur webhooks sortants** — chaque payload est signé avec un secret par destinataire, header `X-Signature: sha256=<hex>`. Le secret est généré à la création du webhook et renvoyé une seule fois, jamais réexposé.
- **Rate limiting** par IP + par utilisateur authentifié, **Helmet** pour les headers HTTP, **timeout global** sur toutes les requêtes.

---

### 📄 Factur-X & conformité EN 16931

La génération de factures sortantes produit un fichier **Factur-X** — un PDF/A-3 contenant un XML CII (Cross Industry Invoice) embarqué. Le pipeline :

1. **Construction de l'invoice model** depuis la DB (entêtes, lignes, TVA, mentions légales).
2. **Sérialisation XML CII** selon le schéma UN/CEFACT, profil **EN 16931** (cœur fonctionnel attendu par la PDP française).
3. **Validation XSD** via `libxmljs2`.
4. **Validation Schematron** — règles métier (BR-*, BR-CO-*, BR-S-*) ré-implémentées à la main en TypeScript pour éviter une dépendance Java. Couverture du sous-ensemble nécessaire au profil EN 16931.
5. **Embarquement dans le PDF** avec **pdfkit** — le PDF est promu PDF/A-3 (métadonnées XMP, profil ICC, fichier attaché en pièce jointe avec relation `Alternative`).
6. **Mapping UBL Peppol** disponible pour les destinataires européens.

Tests **round-trip** : génération → re-parsing du XML → re-validation → comparaison structurelle. Le script `scripts/check-facturx.ts` valide n'importe quel PDF tiers contre cette pile.

---

### 💬 Agent IA conversationnel

Le chat n'est pas un simple wrapper LLM : c'est une **boucle d'agent** avec accès à des outils :

- `search_invoices(filters)` — interroge la DB avec scope orgId.
- `get_invoice_detail(id)` — détail d'une facture.
- `summarize_supplier(supplierId)` — historique + tendances.
- `rag_search(query)` — recherche sémantique pgvector sur les pièces jointes (les chunks de texte des PDF sont embeddés à l'extraction).

Claude orchestre les appels en **multi-step** (un tool peut en appeler d'autres avant de répondre), la réponse finale est **streamée en SSE** au front. Une suite d'**evals** mesure la qualité : exact-match sur des questions factuelles, LLM-as-judge sur les réponses ouvertes, vérification que l'agent ne fuit jamais de données entre organisations.

---

### 📊 Observabilité

`AsyncLocalStorage` crée un contexte par requête HTTP qui survit aux `await` et reste isolé entre requêtes concurrentes. Le `requestId` (généré par middleware) est lu par un formatter Winston custom qui l'ajoute à chaque log — **aucun passing manuel** à travers les couches. Un appel `logger.info(...)` au fond d'un service contient automatiquement le `requestId`, le `userId` et le `orgId` de la requête en cours.

---

## 🏗️ Architecture

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

---

## 🧰 Stack technique

**Backend** — Node.js · Express 4 · TypeScript strict · PostgreSQL (Neon serverless) · Drizzle ORM + Drizzle Kit · Redis + BullMQ · Socket.io · Zod · Winston · Anthropic SDK (Claude Sonnet/Haiku) · Ollama (LLM local) · pdf-parse · tesseract.js · pdfkit · libxmljs2

**Frontend** — Angular 21 (standalone components · signals · control flow `@if`/`@for`) · Angular Material 3 · Tailwind CSS 4 · RxJS

**Qualité & ops** — Vitest (back + front) · ESLint + Prettier · Bull Board · Docker Compose · migrations Drizzle versionnées

---

## 🚀 Démarrage

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

---

## ⌨️ Commandes

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

---

## 🔌 API REST (extrait)

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

---

## 📚 Documentation

L'ensemble de la documentation est dans [`docs/`](./docs/) :

- **[docs/README.md](./docs/README.md)** — index général
- **[docs/guides/](./docs/guides/)** — onboarding (overview, backend, features, frontend, data flows, glossaire)
- **[docs/roadmap/](./docs/roadmap/)** — spec par itération
- **[docs/adr/](./docs/adr/)** — décisions techniques (Drizzle, JWT, BullMQ, Schematron, Factur-X…)

---

## 📜 Licence

Projet personnel — usage non commercial.
