import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'invoices', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'collection',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/collection-detail/collection-detail').then((m) => m.CollectionDetail),
  },
  {
    path: 'collection/:collectionId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/collection-detail/collection-detail').then((m) => m.CollectionDetail),
  },
  {
    path: 'collection/:collectionId/item',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/collection-item-detail/collection-item-detail').then(
        (m) => m.CollectionItemDetail,
      ),
  },
  {
    path: 'collection/:collectionId/item/:itemId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/collection-item-detail/collection-item-detail').then(
        (m) => m.CollectionItemDetail,
      ),
  },
  {
    path: 'architecture',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/architecture/architecture').then((m) => m.Architecture),
  },
  {
    path: 'suppliers',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/supplier-list/supplier-list').then((m) => m.SupplierList),
  },
  {
    path: 'invoices',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/invoice-list/invoice-list').then((m) => m.InvoiceList),
  },
  {
    path: 'invoices/upload',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/invoice-upload/invoice-upload').then((m) => m.InvoiceUpload),
  },
  {
    path: 'invoices/dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/invoice-dashboard/invoice-dashboard').then((m) => m.InvoiceDashboard),
  },
  {
    path: 'invoices/:id/review',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/invoice-review/invoice-review').then((m) => m.InvoiceReview),
  },
  {
    path: 'ai-chat',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/ai-chat/ai-chat').then((m) => m.AiChat),
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
