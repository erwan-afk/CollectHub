import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div
        class="w-full max-w-sm p-6 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm"
      >
        <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          Collection Manager
        </h1>
        <p class="text-xs text-zinc-500 dark:text-zinc-400 mb-6">
          Connectez-vous pour accéder à vos factures
        </p>

        <div class="space-y-3">
          <input
            class="input w-full"
            type="email"
            placeholder="Email"
            [(ngModel)]="email"
            (keyup.enter)="submit()"
          />
          <input
            class="input w-full"
            type="password"
            placeholder="Mot de passe"
            [(ngModel)]="password"
            (keyup.enter)="submit()"
          />
        </div>

        @if (error()) {
          <p class="mt-3 text-xs text-red-600 dark:text-red-400">{{ error() }}</p>
        }

        <button
          class="btn-primary w-full mt-4"
          [disabled]="loading() || !email.trim() || !password"
          (click)="submit()"
        >
          @if (loading()) {
            Connexion...
          } @else {
            Se connecter
          }
        </button>

        <p class="mt-4 text-center text-[11px] text-zinc-400">
          Demo : admin&#64;demo.com / Admin1234!
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      @reference "tailwindcss";
      .input {
        @apply px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800
               text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400
               focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent;
      }
      .btn-primary {
        @apply px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors;
      }
    `,
  ],
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor() {
    // Déjà connecté → redirection
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/invoices']);
    }
  }

  submit() {
    if (!this.email.trim() || !this.password) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/invoices']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'Erreur de connexion');
      },
    });
  }
}
