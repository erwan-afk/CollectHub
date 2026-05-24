import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface ComplexityItem {
  layer: string;
  detail: string;
  level: number; // 1=faible, 2=moyen, 3=élevé
}

interface HotspotItem {
  component: string;
  reason: string;
  level: 'high' | 'medium' | 'low';
}

@Component({
  selector: 'app-architecture',
  imports: [RouterLink],
  templateUrl: './architecture.html',
  styleUrl: './architecture.css',
})
export class Architecture {
  complexityItems: ComplexityItem[] = [
    { layer: 'Models', detail: '5 interfaces TS (Collection, Invoice, Supplier, Status, Confidence)', level: 2 },
    { layer: 'Components', detail: '6 composants standalone (card, upload, search-bar, pdf-preview, confidence-field, status-badge)', level: 2 },
    { layer: 'Pages', detail: '8 pages lazy-loaded (collections + invoices CRUD/review/upload/dashboard)', level: 3 },
    { layer: 'Services', detail: '3 services HTTP (Collection, Supplier, Invoice) avec signals', level: 2 },
    { layer: 'Routes (frontend)', detail: 'Lazy loading avec loadComponent', level: 1 },
    { layer: 'Routes (backend)', detail: '5 routeurs Express (collections, items, suppliers, invoices, health)', level: 3 },
    { layer: 'Middlewares', detail: '7 middlewares (error, rate-limit, timeout, log, upload, invoice-upload, validate)', level: 3 },
    { layer: 'Validation', detail: 'Schémas Zod pour chaque endpoint (CRUD + workflow + filtres)', level: 2 },
    { layer: 'DB', detail: 'Pool pg, 2 schémas SQL, 6 tables (collections, items, suppliers, invoices, lines, history)', level: 3 },
    { layer: 'OCR Pipeline', detail: 'pdf-parse + tesseract.js + parser regex FR + scoring de confiance', level: 3 },
    { layer: 'Workflow factures', detail: 'Machine à états DRAFT→PENDING→VALIDATED/REJECTED→ARCHIVED + audit', level: 3 },
    { layer: 'Scripts', detail: '4 scripts TS autonomes (seed, images)', level: 2 },
  ];

  hotspots: HotspotItem[] = [
    { component: 'collection-detail.ts', reason: 'Page principale : gère CRUD, filtrage, tri, modales de création/édition, signaux dérivés', level: 'high' },
    { component: 'collection-service.ts', reason: 'Point unique d\'entrée HTTP : gestion d\'erreur, signaux réactifs, toutes les opérations CRUD', level: 'high' },
    { component: 'errorHandler.ts', reason: 'Gestion de tous les cas d\'erreur (validation, conflit, not found, inconnue)', level: 'high' },
    { component: 'schemas.ts (Zod)', reason: 'Validation de tous les champs pour chaque endpoint, messages d\'erreur personnalisés', level: 'high' },
    { component: 'search-bar.ts', reason: 'Double binding (recherche + filtre), émission d\'événements, synchronisation avec l\'URL', level: 'medium' },
    { component: 'file-upload.ts', reason: 'Gestion du drag & drop, validation de type/taille, preview, FormData', level: 'medium' },
    { component: 'upload.ts (middleware)', reason: 'Configuration multer, filtrage par type MIME, nommage des fichiers', level: 'medium' },
    { component: 'queries.ts', reason: 'Requêtes SQL paramétrées pour toutes les opérations CRUD', level: 'medium' },
    { component: 'models/*.ts', reason: 'Pures interfaces, pas de logique métier', level: 'low' },
    { component: 'not-found.ts', reason: 'Page statique simple', level: 'low' },
    { component: 'health.ts', reason: 'Route triviale (renvoie { status: "ok" })', level: 'low' },
    { component: 'env.ts', reason: 'Simple mapping de process.env', level: 'low' },
    { component: 'ocr/field-parser.ts', reason: 'Parsing regex de patterns FR (Facture, HT/TVA/TTC, SIRET, IBAN) + scoring de confiance par champ + cross-check HT+TVA≈TTC', level: 'high' },
    { component: 'ocr/ocr.service.ts', reason: 'Orchestrateur OCR : dispatch PDF (pdf-parse) vs image (tesseract.js) + fallback fichier scanné', level: 'high' },
    { component: 'routes/invoices.ts', reason: 'Upload + OCR + CRUD + machine à états (TRANSITIONS map) + audit historique', level: 'high' },
    { component: 'invoice-review.ts', reason: 'Page de revue PDF/formulaire avec confiance par champ, transitions et historique', level: 'high' },
    { component: 'confidence-field.ts', reason: 'Composant qui affiche une bande colorée + % selon la confiance OCR', level: 'medium' },
  ];

  strengths: string[] = [
    'Standalone Components — pas de NgModules, chaque composant déclare ses propres dépendances',
    'Lazy Loading — chaque page est chargée à la demande (loadComponent)',
    'Zoneless + OnPush — détection de changement optimale, pas de zone.js',
    'Signals — état réactif granulaire sans RxJS (sauf pour les appels HTTP)',
    'Double backend — un backend Express complet (dev) + un backend Neon serverless (cloud)',
    'Middleware pattern — chaîne de middlewares Express bien découpée et testable',
    'Validation Zod — validation côté serveur avec des schémas déclaratifs',
    'Rate limiting + Helmet — sécurité de base intégrée',
    'PWA — Service Worker pour le support hors-ligne',
    'Docker Compose — environnement de dev reproductible (PostgreSQL + pgAdmin)',
    'Tests unitaires — Vitest sur le frontend ET le backend',
    'Module Invoice (type Yooz) — upload PDF/image, OCR (pdf-parse + tesseract.js), parsing regex FR, scoring de confiance par champ',
    'Page de revue OCR — aperçu PDF + formulaire prérempli + coloration de la confiance (vert/orange/rouge) côte à côte',
    'Workflow de validation — machine à états serveur (DRAFT → PENDING → VALIDATED/REJECTED → ARCHIVED) + table d\'audit',
    'Cross-check métier — HT + TVA ≈ TTC remonte la confiance (heuristique de cohérence)',
  ];

  levelLabel(level: number): string {
    switch (level) {
      case 1: return 'Faible';
      case 2: return 'Moyenne';
      case 3: return 'Élevée';
      default: return '';
    }
  }

  levelStars(level: number): string {
    return '⭐'.repeat(level) + '⚫'.repeat(3 - level);
  }
}
