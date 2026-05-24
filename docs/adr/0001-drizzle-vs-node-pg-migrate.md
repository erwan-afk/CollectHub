# ADR 0001 — Drizzle ORM vs node-pg-migrate

**Date :** 2026-05-23
**Statut :** Accepté

## Contexte

Le projet exécutait le DDL manuellement via `fs.readFileSync` au démarrage (`initDatabase()`). Problèmes :
- Pas de versioning : impossible de rejouer une migration spécifique.
- Pas d'idempotence garantie : `IF NOT EXISTS` partout en workaround.
- Zéro type-safety entre les colonnes SQL et le code TypeScript.

Il fallait adopter un système de migrations. Deux candidats sérieux :

## Options évaluées

### Option A — node-pg-migrate
- Migrations en SQL ou JS, mature (~7 ans), largement utilisé en prod.
- Rollbacks natifs.
- **Problème** : schéma reste en SQL pur, aucun lien avec les types TypeScript.

### Option B — Drizzle ORM + drizzle-kit ✅
- Le schéma est défini en TypeScript (`schema.ts`) → source de vérité unique.
- `drizzle-kit generate` compare le schema TypeScript à la DB et génère le SQL diff.
- `drizzle-kit push` pour synchro rapide en dev (sans fichier de migration).
- Compatible Neon serverless (utilise `pg.Pool` via l'adaptateur `node-postgres`).
- Types inférés automatiquement (`$inferSelect`, `$inferInsert`) → fin des types manuels en double.
- Bonne réputation sur le CV 2025 (TypeScript-first, DX moderne).

## Décision

**Drizzle ORM** avec `drizzle-kit` pour la génération et l'application des migrations.

Workflow :
1. Modifier `src/db/schema.ts`
2. `npm run db:generate` → génère un fichier SQL dans `src/db/migrations/`
3. `npm run db:migrate` → applique les migrations pending
4. En dev rapide : `npm run db:push` (sans fichier de migration)

## Conséquences

- **Positif** : types auto-générés, source de vérité TypeScript, DX propre.
- **Négatif** : Drizzle ne supporte pas les index partiels (WHERE) dans la config table → ces index sont ajoutés en raw SQL directement dans le fichier de migration généré.
- **Négatif** : Pas de rollback automatique (contrairement à node-pg-migrate). Rollback = écrire une nouvelle migration inverse.
- Les requêtes existantes (`invoice-queries.ts`) utilisent encore `pg.Pool` directement — migration progressive vers l'API Drizzle (`db.select()`, `db.insert()`, etc.) au fil des sprints.
