import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Invoice, InvoiceStatus, STATUS_LABELS } from '../../models/invoice';
import { Supplier } from '../../models/supplier';
import { InvoiceService } from '../../services/invoice-service';
import { SupplierService } from '../../services/supplier-service';
import { InvoiceRealtimeService } from '../../services/invoice-realtime';
import { InvoiceStatusBadge } from '../../components/invoice-status-badge/invoice-status-badge';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, InvoiceStatusBadge, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <header class="mb-4">
        <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Factures</h1>
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
          {{ filtered().length }} / {{ invoices().length }}
        </p>
      </header>

      <section
        class="mb-4 p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg grid grid-cols-2 md:grid-cols-6 gap-2 text-xs"
      >
        <select class="input" [(ngModel)]="filterStatus">
          <option [ngValue]="null">Tous statuts</option>
          @for (s of allStatuses; track s) {
            <option [ngValue]="s">{{ statusLabels[s] }}</option>
          }
        </select>
        <select class="input" [(ngModel)]="filterSupplierId">
          <option [ngValue]="null">Tous fournisseurs</option>
          @for (s of suppliers(); track s.id) {
            <option [ngValue]="s.id">{{ s.name }}</option>
          }
        </select>
        <input class="input" type="date" [(ngModel)]="filterDateFrom" placeholder="Du" />
        <input class="input" type="date" [(ngModel)]="filterDateTo" placeholder="Au" />
        <input
          class="input"
          type="number"
          step="0.01"
          [(ngModel)]="filterAmountMin"
          placeholder="Min TTC"
        />
        <input
          class="input"
          type="number"
          step="0.01"
          [(ngModel)]="filterAmountMax"
          placeholder="Max TTC"
        />
      </section>

      <div
        class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
      >
        @if (loading()) {
          <app-spinner />
        } @else {
          <table class="w-full text-xs">
            <thead class="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th class="text-left px-3 py-2">N°</th>
                <th class="text-left px-3 py-2">Fournisseur</th>
                <th class="text-left px-3 py-2">Date</th>
                <th class="text-right px-3 py-2">TTC</th>
                <th class="text-left px-3 py-2">Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (inv of filtered(); track inv.id) {
                <tr
                  class="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 cursor-pointer"
                  [routerLink]="['/invoices', inv.id]"
                >
                  <td class="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-200">
                    {{ inv.invoiceNumber || '#' + inv.id }}
                  </td>
                  <td class="px-3 py-2 text-zinc-900 dark:text-zinc-100">
                    {{ inv.supplier?.name || '—' }}
                  </td>
                  <td class="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                    {{ inv.issueDate || '—' }}
                  </td>
                  <td class="px-3 py-2 text-right font-medium tabular-nums">
                    {{ inv.amountTtc !== null ? (inv.amountTtc | number: '1.2-2') + ' €' : '—' }}
                  </td>
                  <td class="px-3 py-2"><app-invoice-status-badge [status]="inv.status" /></td>
                  <td class="px-3 py-2 text-right">
                    <button
                      class="text-zinc-400 hover:text-red-600 px-2"
                      title="Supprimer"
                      (click)="onDelete($event, inv)"
                      [disabled]="deletingId() === inv.id"
                    >
                      {{ deletingId() === inv.id ? '…' : '🗑' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-3 py-8 text-center text-zinc-400">Aucune facture</td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
    </div>
  `,
})
export class InvoiceList implements OnInit, OnDestroy {
  private invSvc = inject(InvoiceService);
  private supSvc = inject(SupplierService);
  private rt = inject(InvoiceRealtimeService);

  invoices = signal<Invoice[]>([]);
  suppliers = signal<Supplier[]>([]);
  loading = signal(true);
  deletingId = signal<number | null>(null);

  private rtSub: Subscription | null = null;

  filterStatus: InvoiceStatus | null = null;
  filterSupplierId: number | null = null;
  filterDateFrom: string | null = null;
  filterDateTo: string | null = null;
  filterAmountMin: number | null = null;
  filterAmountMax: number | null = null;

  allStatuses: InvoiceStatus[] = [
    'DRAFT',
    'PENDING_VALIDATION',
    'VALIDATED',
    'REJECTED',
    'ARCHIVED',
  ];
  statusLabels = STATUS_LABELS;

  filtered = computed(() => {
    return this.invoices().filter((inv) => {
      if (this.filterStatus && inv.status !== this.filterStatus) return false;
      if (this.filterSupplierId && inv.supplierId !== this.filterSupplierId) return false;
      if (this.filterDateFrom && (!inv.issueDate || inv.issueDate < this.filterDateFrom))
        return false;
      if (this.filterDateTo && (!inv.issueDate || inv.issueDate > this.filterDateTo)) return false;
      if (this.filterAmountMin !== null && (inv.amountTtc ?? -Infinity) < this.filterAmountMin)
        return false;
      if (this.filterAmountMax !== null && (inv.amountTtc ?? Infinity) > this.filterAmountMax)
        return false;
      return true;
    });
  });

  ngOnInit() {
    this.invSvc.list().subscribe({
      next: (r) => {
        this.invoices.set(r.data);
        this.loading.set(false);
      },
    });
    this.supSvc.list().subscribe({ next: (s) => this.suppliers.set(s) });

    // Live updates via Socket.io — met à jour le statut sans rechargement
    this.rtSub = this.rt.status$.subscribe((event) => {
      this.invoices.update((list) =>
        list.map((inv) =>
          inv.id === event.invoiceId ? { ...inv, status: event.status as InvoiceStatus } : inv,
        ),
      );
    });
  }

  ngOnDestroy() {
    this.rtSub?.unsubscribe();
  }

  onDelete(event: Event, inv: Invoice) {
    event.stopPropagation();
    if (!confirm(`Supprimer la facture #${inv.id} ?`)) return;
    this.deletingId.set(inv.id);
    this.invSvc.delete(inv.id).subscribe({
      next: () => {
        this.invoices.update((list) => list.filter((i) => i.id !== inv.id));
        this.deletingId.set(null);
      },
      error: () => this.deletingId.set(null),
    });
  }
}
