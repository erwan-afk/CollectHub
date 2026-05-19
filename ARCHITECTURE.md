# 🌳 Arborescence & Complexité du Projet — Collection Manager

> **Objectif :** Comprendre en un coup d'œil l'organisation du code, la circulation des données, et les choix architecturaux.

---

## 📁 Arborescence complète

```
angular-project/                        # Racine du projet monorepo
│
├── 📄 angular.json                     # Configuration du CLI Angular (build, serve, test, lint)
├── 📄 package.json                     # Dépendances & scripts du frontend (Angular 21)
├── 📄 tsconfig.json                    # TypeScript racine (référence tsconfig.app + tsconfig.spec)
├── 📄 tsconfig.app.json                # Configuration TS pour le build applicatif
├── 📄 tsconfig.spec.json               # Configuration TS pour les tests (Vitest)
├── 📄 eslint.config.js                 # Règles ESLint (frontend)
├── 📄 docker-compose.yml               # PostgreSQL 16 + pgAdmin (dev local)
├── 📄 .postcssrc.json                  # PostCSS / Tailwind CSS v4
├── 📄 .prettierrc                      # Formatage de code
├── 📄 .editorconfig                    # Configuration d'éditeur
├── 📄 .gitignore                       # Fichiers exclus de Git
├── 📄 .env                             # Variables d'environnement (DB, etc.)
├── 📄 README.md                        # Documentation principale
├── 📄 ARCHITECTURE.md                  # CE FICHIER — analyse de l'arborescence
│
├── 📂 public/                          # Assets statiques servis tels quels
│   ├── 📄 favicon.ico                  # Icône du site
│   ├── 📄 manifest.webmanifest         # PWA manifest
│   └── 📂 img/                         # Images de démo (16 voitures de course)
│       ├── f1_ferrari_f2004.jpg
│       ├── f1_lotus_79.jpg
│       ├── f1_mclaren_mp44.jpg
│       ├── f1_red_bull_rb19.jpg
│       ├── f1_williams_fw14b.jpg
│       ├── gt3_mclaren_720s.jpg
│       ├── gt3_mercedes_amg.jpg
│       ├── gt3_porsche_911.jpg
│       ├── lmp1_audi_r18.jpg
│       ├── lmp1_porsche_919.jpg
│       ├── lmp1_toyota_lemans.jpg
│       ├── lmp2_oreca_sebring.jpg
│       ├── rally_ford_puma.jpg
│       ├── rally_lancia_delta.jpg
│       ├── rally_subaru.jpg
│       └── rally_toyota_yaris.jpg
│
├── 📂 src/                             # 🔥 FRONTEND — Application Angular 21
│   ├── 📄 index.html                   # Point d'entrée HTML (shell SPA)
│   ├── 📄 main.ts                      # Bootstrap de l'application Angular
│   ├── 📄 material-theme.scss          # Thème Material Design 3 (Material You)
│   ├── 📄 styles.css                   # Styles globaux + directives Tailwind v4
│   │
│   └── 📂 app/                         # Code source de l'application
│       ├── 📄 app.config.ts            # Configuration standalone (providers, routes)
│       ├── 📄 app.routes.ts            # Définition des routes (lazy loading)
│       ├── 📄 app.ts                   # Composant racine (AppComponent)
│       ├── 📄 app.html                 # Template racine (sidenav + router-outlet)
│       ├── 📄 app.css                  # Styles racine
│       ├── 📄 app.spec.ts              # Test unitaire du composant racine
│       │
│       ├── 📂 models/                  # 🧠 Modèles de données (TypeScript interfaces)
│       │   ├── collection.ts           # Interface Collection + CreateCollectionDto
│       │   └── collection-item.ts      # Interface CollectionItem + enum Rarity
│       │
│       ├── 📂 services/                # 🌐 Services métier (communication API)
│       │   ├── collection-service.ts   # Service CRUD (HTTP calls → Express/Neon)
│       │   └── collection-service.spec.ts  # Tests du service
│       │
│       ├── 📂 components/              # 🧩 Composants réutilisables (dumb components)
│       │   ├── 📂 collection-item-card/
│       │   │   ├── collection-item-card.ts     # Logique (standalone, OnPush, signals)
│       │   │   ├── collection-item-card.html   # Template (Material Card)
│       │   │   ├── collection-item-card.css    # Styles locaux
│       │   │   └── collection-item-card.spec.ts # Tests unitaires
│       │   │
│       │   ├── 📂 file-upload/
│       │   │   ├── file-upload.ts      # Drag & drop upload (FormData)
│       │   │   └── file-upload.html    # Template (zone de drop + aperçu)
│       │   │
│       │   └── 📂 search-bar/
│       │       ├── search-bar.ts       # Barre de recherche + filtre rareté
│       │       ├── search-bar.html     # Template (input + select)
│       │       ├── search-bar.css      # Styles
│       │       └── search-bar.spec.ts  # Tests
│       │
│       └── 📂 pages/                   # 📄 Pages (lazy-loaded, smart components)
│           ├── 📂 collection-detail/
│           │   ├── collection-detail.ts       # Page liste d'une collection
│           │   ├── collection-detail.html     # Template (grille de cards)
│           │   ├── collection-detail.css      # Styles
│           │   └── collection-detail.spec.ts  # Tests
│           │
│           ├── 📂 collection-item-detail/
│           │   ├── collection-item-detail.ts  # Page détail/édition d'un item
│           │   ├── collection-item-detail.html
│           │   ├── collection-item-detail.css
│           │   └── collection-item-detail.spec.ts
│           │
│           └── 📂 not-found/
│               ├── not-found.ts        # Page 404
│               ├── not-found.html
│               ├── not-found.css
│               └── not-found.spec.ts
│
├── 📂 backend/                         # 🔥 BACKEND — API Express (TypeScript)
│   ├── 📄 package.json                 # Dépendances backend (Express, pg, Zod, Winston…)
│   ├── 📄 tsconfig.json                # Configuration TypeScript backend
│   ├── 📄 vitest.config.ts             # Configuration Vitest pour les tests backend
│   │
│   ├── 📂 src/                         # Code source backend
│   │   ├── 📄 app.ts                   # Création de l'app Express (middlewares + routes)
│   │   ├── 📄 server.ts                # Point d'entrée : démarrage du serveur HTTP
│   │   │
│   │   ├── 📂 config/                  # Configuration
│   │   │   ├── env.ts                  # Variables d'environnement typées (PORT, DATABASE_URL…)
│   │   │   └── logger.ts               # Logger Winston (format + niveaux)
│   │   │
│   │   ├── 📂 db/                      # Base de données
│   │   │   ├── database.ts             # Pool de connexion PostgreSQL (pg)
│   │   │   ├── queries.ts              # Requêtes SQL paramétrées (CRUD collections/items)
│   │   │   └── schema.sql              # Script DDL (création tables, index, contraintes)
│   │   │
│   │   ├── 📂 types/                   # Types partagés backend
│   │   │   ├── collection.ts           # Type Collection (DB row)
│   │   │   └── collection-item.ts      # Type CollectionItem (DB row)
│   │   │
│   │   ├── 📂 validation/              # Validation des entrées
│   │   │   └── schemas.ts              # Schémas Zod (createCollection, updateItem…)
│   │   │
│   │   ├── 📂 middleware/              # 🛡️ Middlewares Express
│   │   │   ├── errorHandler.ts         # Gestion globale des erreurs (AppError → JSON)
│   │   │   ├── rateLimiter.ts          # Rate limiting par IP (express-rate-limit)
│   │   │   ├── requestLogger.ts        # Logging HTTP (méthode, URL, durée, statut)
│   │   │   ├── timeout.ts              # Timeout des requêtes (30s par défaut)
│   │   │   ├── upload.ts               # Upload d'images (multer → disque)
│   │   │   └── validate.ts             # Middleware de validation Zod (body + params)
│   │   │
│   │   ├── 📂 routes/                  # 🛣️ Routes API REST
│   │   │   ├── collections.ts          # /api/v1/collections (CRUD)
│   │   │   ├── items.ts                # /api/v1/collections/:cid/items (CRUD)
│   │   │   ├── health.ts               # /health (healthcheck)
│   │   │   └── 📂 __tests__/
│   │   │       └── collections.test.ts # Tests d'intégration routes (supertest)
│   │   │
│   │   └── 📂 errors/                  # Classes d'erreur personnalisées
│   │       └── AppError.ts             # NotFoundError, ValidationError, ConflictError…
│   │
│   └── 📂 dist/                        # Build JavaScript compilé (tsc → dist/)
│
├── 📂 server/                          # 🔥 SERVEUR LÉGER — API Neon serverless
│   └── 📄 index.ts                     # API REST alternative avec @neondatabase/serverless
│
├── 📂 scripts/                         # 🛠️ Scripts utilitaires
│   ├── seed-neon.ts                    # Seed la DB (insère collections + items de test)
│   ├── seed-neon.sql                   # Script SQL pur alternatif
│   ├── check-images.ts                 # Vérifie la cohérence des images référencées
│   └── update-images.ts                # Met à jour les chemins d'images dans la DB
│
├── 📂 .angular/                        # Cache Angular CLI (généré, ignoré par Git)
├── 📂 .claude/                         # Configuration Claude (settings.local.json)
├── 📂 .vscode/                         # Configuration VS Code (extensions, launch, tasks)
├── 📂 dist/                            # Build de production du frontend (ng build)
└── 📂 node_modules/                    # Dépendances frontend (ignoré par Git)
```

---

## 🔬 Analyse de la complexité

### 1. Structure globale

| Métrique | Valeur |
|---|---|
| **Type d'architecture** | Monorepo full-stack (frontend + backend + scripts) |
| **Langages** | TypeScript (frontend + backend), SQL, HTML, SCSS/CSS |
| **Frameworks** | Angular 21, Express 5, Material Design 3, Tailwind v4 |
| **Bases de données** | PostgreSQL (locale via Docker + cloud via Neon) |
| **Nombre de dossiers** | ~35 (hors node_modules, dist, .angular) |
| **Nombre de fichiers source** | ~65 (hors node_modules, dist, lockfiles) |
| **Nombre de tests** | ~10 fichiers de spec |

### 2. Flux de données

```
┌─────────────────────────────────────────────────────────────────┐
│                        NAVIGATEUR                                │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────────────┐   │
│  │  PWA      │    │  Angular │    │  Material 3 + Tailwind   │   │
│  │  offline  │◄───│  21      │◄───│  (UI / Design System)    │   │
│  └──────────┘    └────┬─────┘    └──────────────────────────┘   │
│                       │                                          │
│              ┌────────▼────────┐                                 │
│              │  Services       │  HttpClient                     │
│              │  (collection-   │────────────┐                    │
│              │   service.ts)   │            │                    │
│              └─────────────────┘            │                    │
└─────────────────────────────────────────────┼────────────────────┘
                                              │
                    ┌─────────────────────────▼──────────────────┐
                    │              BACKEND (au choix)              │
                    │                                             │
                    │  ┌────────────────────┐  ┌───────────────┐  │
                    │  │  Express 5 (complet)│  │  Neon Server-  │  │
                    │  │  backend/src/       │  │  less (léger)  │  │
                    │  │                     │  │  server/       │  │
                    │  │  • 6 middlewares    │  │  index.ts      │  │
                    │  │  • Zod validation   │  │                │  │
                    │  │  • Winston logger   │  │                │  │
                    │  │  • Rate limiting    │  │                │  │
                    │  └─────────┬───────────┘  └───────┬─────────┘  │
                    │            │                      │           │
                    │            ▼                      ▼           │
                    │  ┌───────────────────────────────────────┐    │
                    │  │           PostgreSQL                  │    │
                    │  │  • Docker local (port 5432)           │    │
                    │  │  • Neon cloud (serverless)            │    │
                    │  │  • Tables: collections, items         │    │
                    │  └───────────────────────────────────────┘    │
                    └──────────────────────────────────────────────┘
```

### 3. Complexité cyclomatique — par couche

| Couche | Détail | Complexité |
|---|---|---|
| **Models** | 2 interfaces TypeScript + 1 enum Rarity | ⭐ Faible |
| **Components** | 3 composants standalone (card, upload, search-bar) | ⭐⭐ Moyenne |
| **Pages** | 3 pages lazy-loaded avec Material dialogs | ⭐⭐⭐ Moyenne-Élevée |
| **Services** | 1 service HTTP avec CRUD + signals | ⭐⭐ Moyenne |
| **Routes (frontend)** | Lazy loading avec `loadComponent` | ⭐ Faible |
| **Routes (backend)** | 3 routeurs Express + tests intégration | ⭐⭐ Moyenne |
| **Middlewares** | 6 middlewares chaînés (error, rate-limit, timeout, log, upload, validate) | ⭐⭐⭐ Moyenne-Élevée |
| **Validation** | Schémas Zod pour chaque endpoint | ⭐⭐ Moyenne |
| **DB** | Pool pg, requêtes paramétrées, schema.sql | ⭐⭐ Moyenne |
| **Scripts** | 4 scripts TS autonomes (seed, images) | ⭐⭐ Moyenne |

### 4. Dépendances inter-couches

```
src/app/pages/*  ──dépend de──▶  src/app/components/*
      │                                  │
      │                                  ▼
      │                         src/app/services/*
      │                                  │
      │                                  ▼
      │                         src/app/models/*
      │
      ▼ (HTTP)
backend/src/routes/*  ──utilise──▶  backend/src/validation/*
      │                                  │
      │                                  ▼
      │                         backend/src/types/*
      │
      ▼
backend/src/db/*  ──utilise──▶  PostgreSQL
```

### 5. Points de complexité notables

#### 🔴 Complexité élevée

| Composant | Raison |
|---|---|
| **collection-detail.ts** | Page principale : gère CRUD, filtrage, tri, modales de création/édition, signaux dérivés |
| **collection-service.ts** | Point unique d'entrée HTTP : gestion d'erreur, signaux réactifs, toutes les opérations CRUD |
| **errorHandler.ts** | Gestion de tous les cas d'erreur (validation, conflit, not found, inconnue) |
| **schemas.ts (Zod)** | Validation de tous les champs pour chaque endpoint, messages d'erreur personnalisés |

#### 🟡 Complexité moyenne

| Composant | Raison |
|---|---|
| **search-bar.ts** | Double binding (recherche + filtre), émission d'événements, synchronisation avec l'URL |
| **file-upload.ts** | Gestion du drag & drop, validation de type/taille, preview, FormData |
| **upload.ts (middleware)** | Configuration multer, filtrage par type MIME, nommage des fichiers |
| **queries.ts** | Requêtes SQL paramétrées pour toutes les opérations CRUD |

#### 🟢 Complexité faible

| Composant | Raison |
|---|---|
| **models/*.ts** | Pures interfaces, pas de logique métier |
| **not-found.ts** | Page statique simple |
| **health.ts** | Route triviale (renvoie `{ status: "ok" }`) |
| **env.ts** | Simple mapping de `process.env` |

### 6. Points forts architecturaux

✅ **Standalone Components** — pas de NgModules, chaque composant déclare ses propres dépendances  
✅ **Lazy Loading** — chaque page est chargée à la demande (`loadComponent`)  
✅ **Zoneless + OnPush** — détection de changement optimale, pas de zone.js  
✅ **Signals** — état réactif granulaire sans RxJS (sauf pour les appels HTTP)  
✅ **Double backend** — un backend Express complet (dev) + un backend Neon serverless (cloud)  
✅ **Middleware pattern** — chaîne de middlewares Express bien découpée et testable  
✅ **Validation Zod** — validation côté serveur avec des schémas déclaratifs  
✅ **Rate limiting + Helmet** — sécurité de base intégrée  
✅ **PWA** — Service Worker pour le support hors-ligne  
✅ **Docker Compose** — environnement de dev reproductible (PostgreSQL + pgAdmin)  
✅ **Tests unitaires** — Vitest sur le frontend ET le backend  

---

## 🧭 Résumé

> Le projet **Collection Manager** est une application full-stack **moderne** et **bien architecturée** qui respecte les bonnes pratiques Angular (standalone, lazy loading, signals, OnPush) et Express (middleware, validation, sécurité).

- **Frontend :** 3 pages, 3 composants, 1 service, 2 modèles
- **Backend Express :** 3 routes, 6 middlewares, validation Zod, PostgreSQL
- **Backend Neon :** 1 fichier serverless (alternative légère)
- **Scripts :** 4 utilitaires (seed, images)
- **Total :** ~65 fichiers source pour une application CRUD complète avec upload d'images, recherche, tri, et PWA

---

<p align="center">
  <em>Généré automatiquement par analyse du projet — ${new Date().toISOString().split('T')[0]}</em>
</p>
