import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'collection',
    pathMatch: 'full',
  },
  {
    path: 'collection',
    loadComponent: () =>
      import('./pages/collection-detail/collection-detail').then((m) => m.CollectionDetail),
  },
  {
    path: 'collection/:collectionId',
    loadComponent: () =>
      import('./pages/collection-detail/collection-detail').then((m) => m.CollectionDetail),
  },
  {
    path: 'collection/:collectionId/item',
    loadComponent: () =>
      import('./pages/collection-item-detail/collection-item-detail').then(
        (m) => m.CollectionItemDetail,
      ),
  },
  {
    path: 'collection/:collectionId/item/:itemId',
    loadComponent: () =>
      import('./pages/collection-item-detail/collection-item-detail').then(
        (m) => m.CollectionItemDetail,
      ),
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
