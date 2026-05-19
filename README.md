
<h1 align="center">
  📦 Collection Manager
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/Angular-21-red?style=flat-square&logo=angular" alt="Angular 21" />
  <img src="https://img.shields.io/badge/Material_3-M3-purple?style=flat-square&logo=material-design" alt="Material 3" />
  <img src="https://img.shields.io/badge/Tailwind-v4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind v4" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-Express-green?style=flat-square&logo=express" alt="Express" />
  <img src="https://img.shields.io/badge/DB-PostgreSQL-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Docker-🐳-2496ED?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/PWA-ready-5A0FC8?style=flat-square&logo=pwa" alt="PWA" />
</p>

<p align="center">
  Une application full-stack de gestion de collections d'objets (pièces, timbres, figurines, cartes…)<br/>
  construite avec <strong>Angular 21</strong>, <strong>Material Design 3</strong> et un backend <strong>Express + PostgreSQL</strong>.
</p>

---

## ✨ Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| 📋 **Collections** | Création, édition, suppression de collections |
| 🃏 **Items** | Ajout d'objets avec nom, description, rareté, prix et image |
| 🔍 **Recherche & filtre** | Recherche textuelle + filtrage par rareté |
| ⬆️⬇️ **Tri** | Tri par nom, rareté ou prix (ascendant / descendant) |
| 🖼️ **Upload d'images** | Glisser-déposer ou sélection de fichier |
| 🌓 **Dark mode** | Mode sombre automatique (Material You) |
| 📱 **Responsive** | Design mobile-first |
| ⚡ **Zoneless** | Performances optimales avec le mode zoneless + `OnPush` |
| 📴 **PWA** | Progressive Web App avec support hors-ligne |
| 🗄️ **API REST** | Backend Express typé avec PostgreSQL |

---

## 🏗️ Architecture

```
angular-project/
├── src/                            # Frontend Angular 21
│   ├── app/
│   │   ├── components/             # Composants réutilisables
│   │   │   ├── collection-item-card/   → Carte d'affichage d'un item
│   │   │   ├── file-upload/            → Composant d'upload par drag & drop
│   │   │   └── search-bar/             → Barre de recherche + filtre
│   │   ├── models/                 # Modèles de données
│   │   │   ├── collection.ts           → Modèle Collection
│   │   │   └── collection-item.ts      → Modèle CollectionItem + Raretés
│   │   ├── pages/                  # Pages (lazy-loaded)
│   │   │   ├── collection-detail/      → Vue liste d'une collection
│   │   │   ├── collection-item-detail/ → Vue détail / édition d'un item
│   │   │   └── not-found/              → Page 404
│   │   └── services/               # Services métier
│   │       └── collection-service.ts   → Service CRUD (HTTP → API)
│   ├── material-theme.scss         # Thème Material 3 personnalisé
│   └── styles.css                  # Styles globaux + Tailwind v4
│
├── server/                         # Serveur API léger (Neon serverless)
│   └── index.ts                    # API REST avec Neon DB
│
├── backend/                        # Backend Express complet
│   └── src/
│       ├── routes/                 # Routes modulaires
│       │   ├── collections.ts          → CRUD collections
│       │   ├── items.ts                → CRUD items
│       │   └── health.ts               → Healthcheck
│       ├── middleware/             # Middlewares
│       │   ├── rateLimiter.ts          → Rate limiting
│       │   ├── timeout.ts              → Timeout des requêtes
│       │   ├── requestLogger.ts        → Logging HTTP
│       │   └── errorHandler.ts         → Gestion globale des erreurs
│       ├── validation/             # Validation Zod
│       └── db/                     # Connexion & requêtes DB
│
├── scripts/                        # Scripts utilitaires
│   ├── seed-neon.ts                # Seed de la DB Neon
│   ├── seed-neon.sql               # Script SQL de création de tables
│   ├── check-images.ts             # Vérification des images
│   └── update-images.ts            # Mise à jour des images
│
├── docker-compose.yml              # PostgreSQL + pgAdmin (dev local)
└── public/                         # Assets statiques (images)
```

---

## 🚀 Stack technique

### Frontend

| Technologie | Usage |
|---|---|
| **[Angular 21](https://angular.dev/)** | Framework (standalone components, signals) |
| **[Angular Material 3](https://material.angular.io/)** | Design system Material You |
| **[Tailwind CSS v4](https://tailwindcss.com/)** | Styles utilitaires |
| **[Vitest](https://vitest.dev/)** | Tests unitaires |
| **[ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)** | Linting & formatage |

### Backend

| Technologie | Usage |
|---|---|
| **[Express 5](https://expressjs.com/)** | Serveur HTTP REST |
| **[PostgreSQL](https://www.postgresql.org/)** | Base de données relationnelle |
| **[Neon](https://neon.tech/)** | PostgreSQL serverless (cloud) |
| **[Zod](https://zod.dev/)** | Validation des données |
| **[Helmet](https://helmetjs.github.io/)** | Sécurité HTTP |
| **[Winston](https://github.com/winstonjs/winston)** | Logging |

---

## 📦 Installation

### Prérequis

- **Node.js** ≥ 18
- **Docker** (optionnel, pour la DB locale)
- Un compte **[Neon](https://neon.tech/)** (optionnel, pour la DB cloud)

### 1. Cloner et installer les dépendances

```bash
# Frontend
npm install

# Backend
cd backend && npm install && cd ..
```

### 2. Lancer la base de données locale (Docker)

```bash
docker compose up -d
```

Cela démarre :
- **PostgreSQL 16** sur `localhost:5432`
- **pgAdmin 4** sur http://localhost:5050

### 3. Configurer les variables d'environnement

Créer un fichier `.env` à la racine :

```env
# Base de données (locale ou Neon)
DATABASE_URL=postgresql://user:password@localhost:5432/collections

# Docker
DB_USER=user
DB_PASSWORD=password
DB_NAME=collections
```

### 4. Initialiser la base de données

```bash
npm run db:seed
```

### 5. Lancer l'application

```bash
# Terminal 1 — Serveur API
npm run server          # API légère (Neon)
# ou
cd backend && npm run dev   # API Express complète

# Terminal 2 — Frontend
npm start
```

Puis ouvrir **http://localhost:4200/**

---

## 🛠️ Commandes disponibles

| Commande | Description |
|---|---|
| `npm start` | Lance le serveur de développement Angular |
| `npm run build` | Build de production |
| `npm run watch` | Build en mode watch (dev) |
| `npm test` | Lance les tests unitaires (Vitest) |
| `npm run lint` | Vérification ESLint + Prettier |
| `npm run server` | Lance l'API légère (Neon serverless) |
| `npm run db:seed` | Seed la base de données |
| `cd backend && npm run dev` | Lance le backend Express complet |
| `cd backend && npm run build` | Compile le backend TypeScript |
| `cd backend && npm test` | Tests unitaires backend |
| `docker compose up -d` | Démarre PostgreSQL + pgAdmin |
| `docker compose down` | Arrête les conteneurs |

---

## 🔌 API REST

L'API expose les endpoints suivants :

### Collections

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/collections` | Liste toutes les collections |
| `GET` | `/api/v1/collections/:id` | Détail d'une collection |
| `POST` | `/api/v1/collections` | Crée une collection |
| `PUT` | `/api/v1/collections/:id` | Modifie une collection |
| `DELETE` | `/api/v1/collections/:id` | Supprime une collection |

### Items

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/collections/:cid/items` | Ajoute un item |
| `PUT` | `/api/v1/collections/:cid/items/:iid` | Modifie un item |
| `DELETE` | `/api/v1/collections/:cid/items/:iid` | Supprime un item |

### Divers

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Healthcheck |
| `GET` | `/img/*` | Fichiers statiques (images) |

---

## 🎨 Design System

L'application utilise **Material Design 3** (Material You) avec un thème personnalisé via `material-theme.scss` :

- 🌗 **Mode sombre automatique** — basé sur `prefers-color-scheme`
- 🎨 **Couleurs dynamiques** — palette générée automatiquement
- 🧩 **Composants Material** — cards, chips, dialogs, form fields, toolbar, sidenav

---

## 📄 Licence

Ce projet est un projet personnel de démonstration.

---

<p align="center">
  Fait avec ❤️ en Angular 21
</p>
