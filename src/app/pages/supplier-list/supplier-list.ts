import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Supplier, SupplierInput } from '../../models/supplier';
import { SupplierService } from '../../services/supplier-service';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [CommonModule, FormsModule, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <header class="mb-4">
        <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Fournisseurs</h1>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">{{ suppliers().length }} entrée(s)</p>
      </header>

      <section
        class="mb-6 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg"
      >
        <h2 class="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-3">
          Nouveau fournisseur
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input class="input" placeholder="Nom *" [(ngModel)]="draft.name" />
          <input
            class="input"
            placeholder="SIREN (9) ou SIRET (14)"
            [(ngModel)]="draft.siret"
            maxlength="14"
          />
          <input class="input" placeholder="N° TVA" [(ngModel)]="draft.vatNumber" />
          <input class="input" placeholder="IBAN" [(ngModel)]="draft.iban" />
          <button class="btn-primary text-xs" (click)="create()" [disabled]="!draft.name.trim()">
            Ajouter
          </button>
        </div>
        @if (error()) {
          <p class="mt-2 text-xs text-red-600">{{ error() }}</p>
        }
      </section>

      @if (loading()) {
        <app-spinner />
      } @else {
        <div
          class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
        >
          <table class="w-full text-xs">
            <thead class="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th class="text-left px-3 py-2">Nom</th>
                <th class="text-left px-3 py-2">SIRET</th>
                <th class="text-left px-3 py-2">TVA</th>
                <th class="text-left px-3 py-2">IBAN</th>
                <th class="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (s of suppliers(); track s.id) {
                <tr class="border-t border-zinc-100 dark:border-zinc-800">
                  <td class="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                    {{ s.name }}
                  </td>
                  <td class="px-3 py-2 text-zinc-600 dark:text-zinc-400 font-mono">
                    {{ s.siret || '—' }}
                  </td>
                  <td class="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {{ s.vatNumber || '—' }}
                  </td>
                  <td class="px-3 py-2 text-zinc-600 dark:text-zinc-400 font-mono">
                    {{ s.iban || '—' }}
                  </td>
                  <td class="px-3 py-2 text-right">
                    <button class="text-red-600 hover:underline" (click)="remove(s)">
                      Supprimer
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="px-3 py-8 text-center text-zinc-400">Aucun fournisseur</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @reference "tailwindcss";
      .btn-primary {
        @apply px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium
             disabled:opacity-50 disabled:cursor-not-allowed;
      }
    `,
  ],
})
export class SupplierList implements OnInit {
  private svc = inject(SupplierService);

  suppliers = signal<Supplier[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  draft: SupplierInput = { name: '', siret: null, vatNumber: null, iban: null, address: null };

  ngOnInit() {
    this.load();
  }

  load() {
    this.svc.list().subscribe({
      next: (data) => {
        this.suppliers.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Erreur de chargement');
        this.loading.set(false);
      },
    });
  }

  create() {
    this.error.set(null);
    const body: SupplierInput = {
      name: this.draft.name.trim(),
      siret: this.draft.siret?.toString().replace(/\s/g, '') || null,
      vatNumber: this.draft.vatNumber || null,
      iban: this.draft.iban || null,
      address: this.draft.address || null,
    };
    this.svc.create(body).subscribe({
      next: (s) => {
        this.suppliers.update((arr) => [...arr, s].sort((a, b) => a.name.localeCompare(b.name)));
        this.draft = { name: '', siret: null, vatNumber: null, iban: null, address: null };
      },
      error: (e) => {
        const msg = e?.error?.details
          ? Object.entries(e.error.details)
              .map(([field, errs]) => `${field}: ${(errs as string[]).join(', ')}`)
              .join('; ')
          : (e?.error?.error ?? 'Erreur de création');
        this.error.set(msg);
      },
    });
  }

  remove(s: Supplier) {
    if (!confirm(`Supprimer ${s.name} ?`)) return;
    this.svc.delete(s.id).subscribe({
      next: () => this.suppliers.update((arr) => arr.filter((x) => x.id !== s.id)),
    });
  }
}
