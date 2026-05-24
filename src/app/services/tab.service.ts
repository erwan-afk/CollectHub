import { Injectable, inject, signal, computed } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

export interface AppTab {
  id: string;     // 'invoice-42'
  label: string;  // numéro de facture ou '#42'
  path: string;   // '/invoices/42/review'
}

@Injectable({ providedIn: 'root' })
export class TabService {
  private router = inject(Router);

  private _tabs = signal<AppTab[]>([]);
  readonly tabs = this._tabs.asReadonly();

  /** ID de l'onglet actif dérivé de l'URL courante */
  private currentPath = signal(this.router.url);
  readonly activeId = computed(() => {
    const path = this.currentPath();
    return this._tabs().find((t) => t.path === path)?.id ?? null;
  });

  constructor() {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e) => this.currentPath.set((e as NavigationEnd).urlAfterRedirects));
  }

  openTab(tab: AppTab): void {
    const exists = this._tabs().some((t) => t.id === tab.id);
    if (!exists) {
      this._tabs.update((list) => [...list, tab]);
    }
  }

  updateLabel(id: string, label: string): void {
    this._tabs.update((list) =>
      list.map((t) => (t.id === id ? { ...t, label } : t)),
    );
  }

  closeTab(id: string): void {
    const list = this._tabs();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return;

    const wasActive = this.activeId() === id;
    this._tabs.update((l) => l.filter((t) => t.id !== id));

    if (wasActive) {
      const remaining = this._tabs();
      // Aller à l'onglet adjacent, ou à la liste si plus rien
      const next = remaining[idx] ?? remaining[idx - 1];
      this.router.navigateByUrl(next ? next.path : '/invoices');
    }
  }
}
