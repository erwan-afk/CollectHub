/**
 * AsyncLocalStorage pour propager le contexte de requête (requestId, etc.)
 * à travers tous les appels async sans passer le contexte manuellement.
 *
 * Pourquoi AsyncLocalStorage ?
 * Node.js exécute les requêtes de façon concurrente sur le même thread.
 * AsyncLocalStorage crée une "poche" de contexte qui survit aux await
 * et aux callbacks, mais reste isolée entre requêtes concurrentes.
 * C'est le mécanisme sous-jacent de Pino, OpenTelemetry, etc.
 */
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
}

export const asyncContext = new AsyncLocalStorage<RequestContext>();
