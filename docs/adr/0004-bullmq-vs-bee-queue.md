# ADR 0004 — BullMQ pour le pipeline asynchrone OCR

**Date :** 2026-05-23
**Statut :** Accepté
**Contexte :** Sprint 2 — sortir l'OCR du request/response HTTP

## Décision

Utiliser **BullMQ** (basé sur Redis) comme moteur de queue pour le traitement
OCR asynchrone, les webhooks sortants et les emails.

## Alternatives considérées

| Solution | Avantages | Inconvénients | Verdict |
|---|---|---|---|
| **BullMQ** (choisi) | Leader Node.js (80M+ downloads/semaine), dashboard Bull Board, retry natif, DLQ, stalled jobs recovery, TypeScript-first | Dépendance Redis obligatoire | ✅ Retenu |
| **Bee-Queue** | Plus léger, moins de dépendances | Moins maintenu, pas de Bull Board, DLQ à coder soi-même | ❌ |
| **RabbitMQ + amqplib** | Très robuste, standard entreprise | Ops lourd (Erlang), plus complexe à dockeriser en dev | ❌ |
| **PG-based (SKIP LOCKED)** | Zéro dépendance infra supplémentaire | Pas de retry natif, pas de dashboard, pas de stalled job recovery | ❌ |

## Pourquoi BullMQ ?

1. **Redis est déjà dans la stack cible Yooz** : Redis est cité dans la roadmap
   pour le cache, les sessions et Socket.io. BullMQ s'appuie dessus sans infra
   supplémentaire.
2. **DX (Developer Experience)** : Bull Board donne un dashboard visuel des jobs
   (actifs, complétés, échoués), crucial pour debugger en dev et en prod.
3. **Fiabilité** : Retry avec backoff exponentiel, dead-letter queue automatique,
   stalled jobs recovery (si un worker crashe en plein traitement).
4. **Adoption** : Utilisé par des entreprises comme Algolia, GitGuardian, Doctolib.

## Architecture

```
POST /invoices/upload
  └─> Sauve fichier + crée facture (status=PROCESSING)
  └─> Enqueue job BullMQ { invoiceId, filePath, orgId }
  └─> Retourne 202 Accepted immédiatement

Worker (processus séparé, `npm run worker`)
  └─> Consomme la queue ocr-processing
  └─> OCR (Tesseract/Claude)
  └─> UPDATE facture + transition vers DRAFT ou PENDING_VALIDATION
  └─> Si échec final → DLQ ocr-failed (admin peut rejouer)
```

## Risques et mitigations

- **Redis devient SPOF** → Mitigé par AOF (append-only file) activé dans
  docker-compose, et par la possibilité de Redis Sentinel/Cluster en prod.
- **Dépendance à BullMQ v5+** → API stable depuis v3, migration documentée.

## Conséquences

- `docker-compose up` devient obligatoire en dev (Redis + Mailhog).
- Le worker est un processus séparé (scalable horizontalement).
- Le statut `PROCESSING` est ajouté à la state machine des factures.
