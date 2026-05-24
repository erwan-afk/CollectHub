/**
 * Point d'entrée du worker.
 *
 * Démarrer avec : npm run worker
 * Ce processus est indépendant du serveur HTTP Express.
 *
 * En production, on peut lancer plusieurs instances pour paralléliser.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import './ocr.worker';
import './webhook.worker';
import './email.worker';

console.log('[worker] All workers started');
