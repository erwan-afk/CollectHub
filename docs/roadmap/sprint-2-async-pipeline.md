# Sprint 2 — Pipeline asynchrone & temps réel

**Durée cible :** 2 semaines
**Skills travaillés :** Redis, queues, workers, WebSockets, webhooks sortants

## Objectif

Sortir l'OCR du request/response. Aujourd'hui un upload bloque la requête HTTP pendant que Tesseract tourne — inutilisable à l'échelle Yooz (milliers de docs/heure). À la fin du sprint, l'upload retourne immédiatement et le traitement se fait en arrière-plan avec progression temps réel côté UI.

## Livrables

### 1. BullMQ + Redis
- Ajouter Redis local (docker-compose ou install natif Windows via Memurai).
- Queue `ocr-processing` avec **BullMQ** (`@bull-board/express` pour le dashboard d'admin).
- Refactor `POST /invoices/upload` :
  - Sauve le fichier + insère la facture en statut `PROCESSING`.
  - Enqueue un job `{ invoiceId, filePath, orgId }`.
  - Retourne immédiatement `202 Accepted` avec l'`invoiceId`.
- Worker `backend/src/workers/ocr.worker.ts` :
  - Consomme le job, appelle `ocr.service.ts` existant.
  - Met à jour la facture (texte OCR, champs extraits, confidence).
  - Transitionne vers `PENDING_VALIDATION` ou `DRAFT` selon confiance.
- **Retry** : 3 essais avec backoff exponentiel (1s, 5s, 30s).
- **Dead-letter queue** : `ocr-failed` pour les jobs qui crashent définitivement, avec endpoint admin pour rejouer.

### 2. Monitoring queue
- Bull Board exposé sur `/admin/queues` (protégé par `requireRole('admin')`).
- Métriques exposées : nb jobs actifs, échoués, latence moyenne.

### 3. Socket.io — progression temps réel
- Serveur Socket.io monté sur le même HTTP server qu'Express.
- Auth socket via JWT (handshake).
- Namespace `/invoices`, rooms par `organizationId`.
- Le worker émet `invoice:status` (`{ invoiceId, status, progress, confidence }`) à chaque étape.
- Côté Angular : service `InvoiceRealtimeService` (RxJS Subject) consommé par `invoice-upload` et `invoice-list`.
- Le badge de statut se met à jour sans refresh.

### 4. Webhooks sortants
- Table `webhooks` : `id, org_id, url, secret, events[], active, created_at`.
- CRUD endpoints `/webhooks`.
- Service `WebhookDispatcher` :
  - Sur événement métier (`invoice.validated`, `invoice.rejected`), enqueue un job `webhook-delivery`.
  - Signature **HMAC SHA-256** dans le header `X-Yooz-Signature`.
  - Retry 5x avec backoff, log de chaque tentative dans `webhook_deliveries`.
- Endpoint `/webhooks/:id/deliveries` pour debug.

### 5. Notifications email
- **Nodemailer** + **Mailhog** local (docker-compose) pour les tests.
- Templates avec **Handlebars** ou MJML : invoice validated, invoice rejected, password reset.
- Trigger via la même queue (job `email-send`).

## Fichiers clés

**Nouveaux :**
- `backend/src/services/queue.ts` — instances BullMQ partagées
- `backend/src/workers/ocr.worker.ts`
- `backend/src/workers/webhook.worker.ts`
- `backend/src/workers/email.worker.ts`
- `backend/src/workers/index.ts` — entrypoint séparé (`npm run worker`)
- `backend/src/services/webhooks/dispatcher.ts`
- `backend/src/services/realtime/socket.ts`
- `backend/src/services/email/mailer.ts`
- `backend/src/db/webhook-schema.sql` (ou migration Drizzle)
- `src/app/services/invoice-realtime.ts`
- `src/app/services/socket-client.ts`

**À refactorer :**
- `backend/src/routes/invoices.ts` — upload devient asynchrone
- `backend/src/app.ts` — monter Socket.io
- `src/app/pages/invoice-upload/` — afficher la progression
- `src/app/pages/invoice-list/` — live updates

## Validation de fin de sprint

1. Upload de 50 PDF en parallèle → toutes les requêtes HTTP retournent en < 200 ms.
2. Les statuts se mettent à jour live dans le navigateur (deux onglets ouverts = sync).
3. Bull Board montre la file qui se vide progressivement.
4. Un webhook configuré reçoit une POST signée à chaque `invoice.validated`.
5. Un crash du worker ne perd aucun job (Redis persistant).
6. Mailhog reçoit les emails de notification.

## ADR à rédiger

- `docs/adr/0004-bullmq-vs-bee-queue.md`
- `docs/adr/0005-socketio-rooms-strategy.md`
- `docs/adr/0006-webhook-signature-and-retry-policy.md`
