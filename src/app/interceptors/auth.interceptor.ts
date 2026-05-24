import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Intercepteur fonctionnel (Angular 17+ standalone style).
 *
 * 1. Attache `Authorization: Bearer <token>` à toutes les requêtes
 *    sauf /auth (login, register, refresh).
 * 2. Sur 401, tente un refresh token. Si le refresh échoue,
 *    redirige vers /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Pas de token sur les endpoints d'auth eux-mêmes
  if (req.url.includes('/api/v1/auth')) {
    return next(req);
  }

  const token = auth.getToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      // 401 = token expiré → tentative de refresh (une seule, déduplication dans AuthService)
      if (err.status === 401 && token) {
        return auth.refresh().pipe(
          switchMap((res) => {
            if (!res) {
              // refresh() a déjà nettoyé le token ; on redirige une seule fois
              router.navigate(['/login']);
              return throwError(() => err);
            }
            return next(req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }));
          }),
        );
      }
      // Pas de token en mémoire et 401 → forcer la déconnexion proprement
      if (err.status === 401) {
        router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
