import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardSummary, InvoiceStatus, STATUS_LABELS } from '../../models/invoice';
import { InvoiceService } from '../../services/invoice-service';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-invoice-dashboard',
  standalone: true,
  imports: [CommonModule, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <header class="mb-6 flex items-end justify-between">
        <div>
          <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Dashboard factures</h1>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">
            Vue d'ensemble — répartition par statut, total mensuel, top fournisseurs
          </p>
        </div>
        <a
          [href]="exportUrl"
          download
          class="text-xs px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700
                  bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200
                  hover:bg-zinc-50 dark:hover:bg-zinc-700"
        >
          ⇩ Export CSV (validées)
        </a>
      </header>

      @if (summary(); as s) {
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          @for (st of statuses; track st) {
            <div
              class="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg"
            >
              <p class="text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {{ labels[st] }}
              </p>
              <p class="text-2xl font-semibold mt-1 tabular-nums" [class]="colorOf(st)">
                {{ s.countsByStatus[st] }}
              </p>
            </div>
          }
        </div>

        <div
          class="p-5 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border border-emerald-200 dark:border-emerald-800 rounded-xl mb-6"
        >
          <p class="text-xs text-emerald-700 dark:text-emerald-300 uppercase tracking-wide">
            Total TTC validé ce mois
          </p>
          <p class="text-3xl font-bold text-emerald-900 dark:text-emerald-100 mt-1 tabular-nums">
            {{ s.monthlyTtcValidated | number: '1.2-2' }} €
          </p>
        </div>

        <div
          class="p-5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl"
        >
          <h2
            class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-3"
          >
            Top fournisseurs (90 derniers jours, validées)
          </h2>
          @if (s.topSuppliers.length) {
            <ul class="divide-y divide-zinc-100 dark:divide-zinc-800">
              @for (t of s.topSuppliers; track t.supplierId) {
                <li class="flex items-center justify-between py-2 text-sm">
                  <span class="text-zinc-800 dark:text-zinc-200">{{ t.name }}</span>
                  <span class="flex items-center gap-4 tabular-nums">
                    <span class="text-[11px] text-zinc-500">{{ t.invoiceCount }} fact.</span>
                    <span class="font-semibold text-zinc-900 dark:text-zinc-100"
                      >{{ t.totalTtc | number: '1.2-2' }} €</span
                    >
                  </span>
                </li>
              }
            </ul>
          } @else {
            <p class="text-xs text-zinc-400">Aucune facture validée sur la période.</p>
          }
        </div>
      } @else {
        <app-spinner />
      }
    </div>
  `,
})
export class InvoiceDashboard implements OnInit {
  private svc = inject(InvoiceService);

  summary = signal<DashboardSummary | null>(null);
  loading = signal(true);
  statuses: InvoiceStatus[] = ['DRAFT', 'PENDING_VALIDATION', 'VALIDATED', 'REJECTED', 'ARCHIVED'];
  labels = STATUS_LABELS;
  exportUrl = this.svc.exportCsvUrl({ status: 'VALIDATED' });

  ngOnInit() {
    this.svc.summary().subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
    });
  }

  colorOf(s: InvoiceStatus): string {
    switch (s) {
      case 'DRAFT':
        return 'text-zinc-700 dark:text-zinc-300';
      case 'PENDING_VALIDATION':
        return 'text-amber-600 dark:text-amber-400';
      case 'VALIDATED':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'REJECTED':
        return 'text-red-600 dark:text-red-400';
      case 'ARCHIVED':
        return 'text-indigo-600 dark:text-indigo-400';
      case 'PROCESSING':
      default:
        return 'text-zinc-500 dark:text-zinc-400';
    }
  }
}
