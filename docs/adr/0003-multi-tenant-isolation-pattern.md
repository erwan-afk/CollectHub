# ADR 0003 — Pattern d'isolation multi-tenant

**Date :** 2026-05-23
**Statut :** Accepté

## Contexte

L'application sert plusieurs organisations (tenants). Un user de l'orga A ne doit jamais voir ni modifier les données de l'orga B, même s'il connaît un `id` valide.

Trois patterns courants :

| Pattern | Description | Risque |
|---|---|---|
| **Schema-per-tenant** | Un schéma Postgres par orga | Migration complexe, connexion pool épuisée à l'échelle |
| **DB-per-tenant** | Une DB Postgres par orga | Excessif pour notre échelle |
| **Row-level (colonne)** ✅ | `organization_id` sur chaque table | Simple, fonctionne à grande échelle avec un bon index |

## Décision

**Row-level tenancy** : chaque table métier (`suppliers`, `invoices`, `invoice_lines`, etc.) porte une colonne `organization_id NOT NULL`. Toutes les queries filtrent par cette colonne.

### Middleware `scopeToOrg`

Placé après `requireAuth`, il injecte `res.locals.orgId = req.user.organizationId`. Les routes lisent `res.locals.orgId` — une seule source de vérité, impossible d'oublier de la passer manuellement.

### Helper implicite : `orgId` en premier paramètre

Toutes les fonctions dans `invoice-queries.ts` reçoivent `orgId: number` comme **premier paramètre**. Convention délibérée : quand on lit la signature d'une fonction, on voit immédiatement si elle est tenant-aware. Un linter custom pourrait vérifier ce contrat à l'avenir.

### Défense en profondeur

Même si `scopeToOrg` était bypassé, les WHERE incluent toujours `AND organization_id = $N`. Une requête sans orgId valide ne retourne rien (pas d'erreur bruyante — pas d'info leak).

## Index

`CREATE INDEX idx_invoices_org ON invoices(organization_id)` et équivalent sur `suppliers` garantissent que le filtre n'est pas un full scan.

## Conséquences

- **Positif** : simple à auditer (grep `organization_id`), performant avec l'index, pas de changement d'architecture pour Neon serverless.
- **Négatif** : un oubli dans une nouvelle query ne compile pas (TypeScript force le paramètre) mais pourrait passer si on ajoute une fonction sans `orgId`.  → Convention à documenter dans CLAUDE.md : **toute query métier doit accepter `orgId`**.
- **À surveiller** : `invoice_lines` et `invoice_status_history` sont isolées *indirectement* (via la FK vers `invoices`). Un test d'isolation doit vérifier qu'on ne peut pas accéder à une ligne via un `invoice_id` d'une autre orga — couvert au Sprint 1 Étape 4 (tests).
