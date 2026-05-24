import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, shareReplay } from 'rxjs';
import type { AuthResponse, LoginRequest, MeResponse, RegisterRequest, User } from '../models/auth';

const API = 'http://localhost:3000/api/v1/auth';
const TOKEN_KEY = 'access_token';
const USER_KEY = 'current_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  /** Signal réactif pour l'état connecté — utilisable partout dans l'app */
  readonly currentUser = signal<User | null>(this.loadUser());
  readonly isAuthenticated = computed(() => !!this.currentUser() && !!this.getToken());

  // ─── Token access ─────────────────────────────────────────────────────────

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  private clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  private loadUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }

  private setUser(user: User): void {
    this.currentUser.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  private clearUser(): void {
    this.currentUser.set(null);
    localStorage.removeItem(USER_KEY);
  }

  // ─── Auth endpoints ───────────────────────────────────────────────────────

  login(req: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API}/login`, req, { withCredentials: true }).pipe(
      tap((res) => {
        this.setToken(res.accessToken);
        this.setUser(res.user);
      }),
    );
  }

  register(req: RegisterRequest): Observable<{ user: User }> {
    return this.http.post<{ user: User }>(`${API}/register`, req);
  }

  // Shared observable pour dédupliquer les appels refresh() concurrent
  private refreshInProgress$: Observable<{ accessToken: string } | null> | null = null;

  /** Appelé par l'interceptor quand le token expire */
  refresh(): Observable<{ accessToken: string } | null> {
    if (this.refreshInProgress$) return this.refreshInProgress$;

    this.refreshInProgress$ = this.http
      .post<{ accessToken: string }>(`${API}/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((res) => {
          this.setToken(res.accessToken);
          this.refreshInProgress$ = null;
        }),
        catchError(() => {
          // Ne pas appeler this.logout() ici : c'est un Observable non souscrit,
          // les side-effects (clearToken, clearUser) ne s'exécuteraient jamais.
          this.clearToken();
          this.clearUser();
          this.refreshInProgress$ = null;
          return of(null);
        }),
        shareReplay(1),
      );

    return this.refreshInProgress$;
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${API}/me`).pipe(
      tap((res) => this.setUser(res.user)),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${API}/logout`, {}, { withCredentials: true }).pipe(
      tap(() => {
        this.clearToken();
        this.clearUser();
      }),
      catchError(() => {
        // Même en cas d'erreur, on nettoie côté client
        this.clearToken();
        this.clearUser();
        return of(undefined);
      }),
    );
  }
}
