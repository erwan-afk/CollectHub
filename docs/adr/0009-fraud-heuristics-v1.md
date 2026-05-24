# ADR 0009 — Heuristiques de fraude v1

**Date :** 2026-05-23  
**Statut :** Accepté

## Contexte

Yooz mentionne la "détection de fraude" comme feature produit différenciante. On implémente
une première version basée sur des heuristiques statistiques, sans ML (sprint 3), avec une
architecture qui permettra d'ajouter un modèle ML en sprint 4+.

## Heuristiques retenues

| Heuristique | Score | Sévérité | Justification |
|-------------|-------|----------|---------------|
| IBAN changé | +50 | Rouge | Principal vecteur de fraude BECS (Business Email Compromise) |
| Montant aberrant (z > 3σ, 90j) | +20 | Orange | Factures gonflées, arnaques aux fournisseurs |
| Doublon proche (même montant+mois) | +20 | Orange | Double facturation accidentelle ou intentionnelle |
| N° non-séquentiel (saut > 100) | +20 | Orange | Falsification de numéro |
| Date incohérente (future ou > 1 an) | +20 | Jaune | Erreur ou antidatage |

**Score total : 0–100.** Seuil d'alerte : 70.

## Limitations v1

- Pas de ML → faux positifs possibles pour les nouveaux fournisseurs (peu d'historique)
- Z-score requiert au moins 3 factures historiques pour être fiable
- IBAN : compare avec le IBAN en base suppliers, pas avec l'historique des factures

## Architecture

Le scorer est un service pur (`risk-scorer.ts`) sans état, appelable indépendamment.
Le résultat `{ score, flags }` est stocké en JSONB dans `invoices.risk_assessment`.

En sprint 4 : si `score > 70` → workflow d'approbation forcé + notification temps réel via Socket.io.

## Conséquences

- Tous les flags sont des chaînes lisibles par un humain → pas de code d'erreur opaque
- `scoreRisk()` est idempotent → peut être rejoué sans effet de bord
- Facile d'ajouter une heuristique : ajouter une fonction `check*` et l'inclure dans `Promise.allSettled`
