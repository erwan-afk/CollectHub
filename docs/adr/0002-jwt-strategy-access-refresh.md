# ADR 0002 — Stratégie JWT : access token + refresh token

**Date :** 2026-05-23
**Statut :** Accepté

## Contexte

L'API doit authentifier les requêtes d'une SPA Angular sans session serveur (stateless). Deux questions clés :
1. Où stocker les tokens côté client ?
2. Comment gérer l'expiration sans obliger l'utilisateur à se reconnecter toutes les 15 minutes ?

## Décision

**Deux tokens avec des durées de vie différentes :**

| Token | Durée | Stockage côté client | Transport |
|---|---|---|---|
| Access token | 15 min | Mémoire JS (variable) | `Authorization: Bearer` header |
| Refresh token | 7 jours | httpOnly cookie (inaccessible au JS) | Cookie automatique |

**Pourquoi ce split :**
- L'access token en mémoire JS disparaît au rechargement de page → le refresh token en cookie permet de le régénérer sans redemander le mot de passe.
- Le cookie httpOnly bloque les attaques XSS : même si un script malveillant tourne sur la page, il ne peut pas lire le refresh token.
- `sameSite: strict` bloque les attaques CSRF.

## Rotation des refresh tokens

Le refresh token est **à usage unique** : à chaque appel à `/auth/refresh`, l'ancien token est supprimé et un nouveau est émis (stocké en DB par son hash SHA-256). Bénéfices :
- Détection de réutilisation possible (si un token est rejouée après rotation, l'ancien est déjà invalide → alerte possible en Sprint 2).
- Révocation propre à `/auth/logout`.

## Stockage en DB

Les refresh tokens sont stockés dans la table `refresh_tokens` (hash SHA-256, pas le token brut). Comparé au stateless pur :
- **Avantage** : révocation possible, auditabilité.
- **Inconvénient** : une requête DB à chaque refresh (tolérable : appel rare, toutes les 15 min max).

En Sprint 2, quand Redis arrive, on peut migrer vers un store Redis pour les invalidations à chaud.

## Conséquences

- Le frontend Angular doit appeler `POST /auth/refresh` au démarrage (ou quand il reçoit un 401) pour obtenir un access token frais.
- La route `/auth/logout` révoque le refresh token en DB ET efface le cookie.
- Les routes protégées lisent le token depuis `Authorization: Bearer`, pas depuis un cookie.
