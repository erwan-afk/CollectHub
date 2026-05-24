# Sprint 1 — Fondations professionnelles

**Durée cible :** 1 semaine
**Skills travaillés :** architecture, sécurité, tests, migrations

## Objectif

Faire ressembler le repo à un projet d'entreprise. Aujourd'hui c'est un prototype : pas d'auth, pas de tests, schéma SQL exécuté à la main. À la fin du sprint, le repo doit pouvoir passer une revue de code "sérieuse".

## Livrables

### 1. Authentification JWT + RBAC
- Table `users` (id, email, password_hash, role, organization_id, created_at).
- `bcrypt` pour le hash (cost 12).
- Endpoints : `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me`.
- Access token court (15 min) + refresh token long (7 j) en httpOnly cookie.
- Middleware `requireAuth` qui valide le JWT et hydrate `req.user`.
- Middleware `requireRole('admin' | 'accountant' | 'viewer')`.

### 2. Multi-tenant
- Colonne `organization_id` sur `suppliers`, `invoices`, `invoice_lines`, `invoice_status_history`.
- Middleware `scopeToOrg` qui injecte le tenant dans `res.locals`.
- Refactor de `backend/src/db/invoice-queries.ts` : **toutes** les requêtes filtrent par `organization_id`. Pas d'oubli possible → helper `withOrg(query, orgId)`.
- Test : un user de l'orga A ne doit jamais voir les factures de l'orga B (test d'isolation explicite).

### 3. Migrations versionnées
- Remplacer l'exécution manuelle de `invoice-schema.sql` par **Drizzle ORM** (recommandé : moderne, TypeScript-first, bon pour le CV) ou **node-pg-migrate**.
- Migrations dans `backend/src/db/migrations/`.
- Script npm : `npm run db:migrate`, `npm run db:rollback`, `npm run db:seed`.
- Seed minimal : 1 orga, 1 admin, 2 suppliers de démo.

### 4. Tests Vitest
- Couverture cible : **70%** sur `services/ocr/*` et `db/invoice-queries.ts`.
- Stratégie DB : `pg-mem` (rapide, en mémoire) ou **Testcontainers** (réaliste, conteneur Postgres jetable).
- Tests d'auth, tests d'isolation multi-tenant, tests des transitions d'état facture.
- Script : `npm test`, `npm run test:coverage`.

### 5. Logging structuré + correlation IDs
- Middleware `requestId` : génère un UUID, le met dans `req.id` et le header `X-Request-Id` de la réponse.
- Adapter Winston (ou switcher vers **Pino**, plus rapide) pour logger en JSON avec le `requestId` à chaque ligne.
- Logger les events métier : `auth.login`, `invoice.uploaded`, `invoice.transitioned`.

## Fichiers clés

**Nouveaux :**
- `backend/src/middleware/auth.ts`
- `backend/src/middleware/scope-to-org.ts`
- `backend/src/middleware/request-id.ts`
- `backend/src/routes/auth.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/db/migrations/` (dossier)
- `backend/src/db/schema.ts` (si Drizzle)
- `backend/tests/` (dossier)

**À refactorer :**
- `backend/src/db/invoice-queries.ts` — ajouter scoping org partout
- `backend/src/db/database.ts` — exposer le client Drizzle
- `backend/src/app.ts` — câbler les nouveaux middlewares
- Toutes les routes — ajouter `requireAuth`

## Validation de fin de sprint

1. `npm test` passe avec couverture > 60%.
2. Un appel `GET /invoices` sans JWT retourne 401.
3. Un user de l'orga A ne peut pas lire/modifier une facture de l'orga B (test automatisé).
4. `npm run db:migrate` recrée un schéma propre à partir de zéro.
5. Les logs en JSON contiennent un `requestId` traçable bout-en-bout.

## ADR à rédiger

- `docs/adr/0001-drizzle-vs-node-pg-migrate.md`
- `docs/adr/0002-jwt-strategy-access-refresh.md`
- `docs/adr/0003-multi-tenant-isolation-pattern.md`
