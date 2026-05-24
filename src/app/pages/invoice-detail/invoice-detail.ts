import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Invoice,
  InvoiceLine,
  FacturXProfile,
  FACTURX_PROFILE_LABELS,
  LifecycleEvent,
  LifecycleStatus,
  LIFECYCLE_STATUS_LABELS,
} from '../../models/invoice';
import { InvoiceService } from '../../services/invoice-service';
import { InvoiceStatusBadge } from '../../components/invoice-status-badge/invoice-status-badge';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, InvoiceStatusBadge, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <!-- Loading -->
      @if (loading()) {
        <app-spinner />
      } @else if (invoice(); as inv) {
        <!-- Header -->
        <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <a routerLink="/invoices" class="text-xs text-blue-600 hover:underline">
              ← Retour à la liste
            </a>
            <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
              Facture {{ inv.invoiceNumber || '#' + inv.id }}
            </h1>
            <p class="text-xs text-zinc-500 dark:text-zinc-400">
              Créée le {{ inv.createdAt | date: 'dd/MM/yyyy' }}
              @if (inv.supplier) { · {{ inv.supplier.name }} }
            </p>
          </div>

          <div class="flex items-center gap-2">
            <app-invoice-status-badge [status]="inv.status" />

            <!-- Factur-X badge -->
            @if (inv.facturXProfile) {
              <span
                class="text-[10px] px-2 py-0.5 rounded-full font-medium"
                [class]="profileBadgeClass(inv.facturXProfile)"
              >
                {{ FACTURX_PROFILE_LABELS[inv.facturXProfile] }}
              </span>
            }

            <!-- Download buttons -->
            <div class="flex gap-1">
              <button
                class="text-xs px-3 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800
                        bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300
                        hover:bg-emerald-100 dark:hover:bg-emerald-900"
                (click)="downloadFacturX(inv.id)"
              >
                ⬇ Factur-X PDF
              </button>
              <a
                [href]="facturXXmlUrl()"
                class="text-xs px-2 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700
                        bg-white dark:bg-zinc-800 text-zinc-500 hover:text-zinc-700"
                title="Télécharger le XML CII (debug)"
              >
                XML
              </a>
            </div>
          </div>
        </header>

        <!-- Main grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- Left: invoice details -->
          <div class="md:col-span-2 space-y-5">
            <!-- Amounts card -->
            <section
              class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
            >
              <h2 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-3">
                Montants
              </h2>
              <div class="grid grid-cols-3 gap-4">
                <div>
                  <p class="text-[10px] text-zinc-400">HT</p>
                  <p class="text-lg font-semibold tabular-nums">
                    {{ inv.amountHt | number: '1.2-2' }} {{ inv.currency }}
                  </p>
                </div>
                <div>
                  <p class="text-[10px] text-zinc-400">TVA</p>
                  <p class="text-lg font-semibold tabular-nums">
                    {{ inv.amountTva | number: '1.2-2' }} {{ inv.currency }}
                  </p>
                </div>
                <div>
                  <p class="text-[10px] text-zinc-400">TTC</p>
                  <p class="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {{ inv.amountTtc | number: '1.2-2' }} {{ inv.currency }}
                  </p>
                </div>
              </div>
            </section>

            <!-- Lines table -->
            <section
              class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden"
            >
              <div class="p-3 border-b border-zinc-100 dark:border-zinc-800">
                <h2 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase">
                  Lignes ({{ inv.lines.length }})
                </h2>
              </div>
              @if (inv.lines.length) {
                <table class="w-full text-xs">
                  <thead class="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500">
                    <tr>
                      <th class="text-left px-3 py-2 w-8">#</th>
                      <th class="text-left px-3 py-2">Description</th>
                      <th class="text-right px-3 py-2">Qté</th>
                      <th class="text-right px-3 py-2">P.U. HT</th>
                      <th class="text-right px-3 py-2">Total HT</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of inv.lines; track line.id; let i = $index) {
                      <tr class="border-t border-zinc-50 dark:border-zinc-800/50">
                        <td class="px-3 py-2 text-zinc-400">{{ i + 1 }}</td>
                        <td class="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                          {{ line.description }}
                        </td>
                        <td class="px-3 py-2 text-right tabular-nums">{{ line.quantity }}</td>
                        <td class="px-3 py-2 text-right tabular-nums">
                          {{ line.unitPrice | number: '1.2-2' }}
                        </td>
                        <td class="px-3 py-2 text-right font-medium tabular-nums">
                          {{ line.total | number: '1.2-2' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <p class="p-4 text-xs text-zinc-400">Aucune ligne</p>
              }
            </section>

            <!-- Supplier info -->
            @if (inv.supplier) {
              <section
                class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
              >
                <h2 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">
                  Fournisseur
                </h2>
                <p class="text-sm font-medium">{{ inv.supplier.name }}</p>
                <div class="text-xs text-zinc-500 mt-1 space-y-0.5">
                  @if (inv.supplier.siret) { <p>SIRET : {{ inv.supplier.siret }}</p> }
                  @if (inv.supplier.vatNumber) { <p>TVA : {{ inv.supplier.vatNumber }}</p> }
                  @if (inv.supplier.iban) { <p>IBAN : {{ inv.supplier.iban }}</p> }
                </div>
              </section>
            }
          </div>

          <!-- Right sidebar: lifecycle + metadata -->
          <div class="space-y-5">
            <!-- Lifecycle timeline -->
            <section
              class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4"
            >
              <h2 class="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-3">
                Cycle de vie réglementaire
              </h2>

              @if (loadingLifecycle()) {
                <p class="text-xs text-zinc-400">Chargement…</p>
              } @else if (lifecycleEvents().length) {
                <div class="space-y-0">
                  @for (evt of lifecycleEvents(); track evt.id) {
                    <div class="flex gap-2 text-xs py-1.5 border-l-2 border-zinc-200 dark:border-zinc-700 pl-3">
                      <div class="flex-1">
                        <span [class]="lifecycleDotClass(evt.status)">{{ LIFECYCLE[evt.status] }}</span>
                        @if (evt.comment) {
                          <p class="text-zinc-400 mt-0.5">{{ evt.comment }}</p>
                        }
                      </div>
                      <time class="text-zinc-400 whitespace-nowrap">
                        {{ evt.occurredAt | date: 'dd/MM HH:mm' }}
                      </time>
                    </div>
                  }
                </div>
              } @else {
                <p class="text-xs text-zinc-400">Aucun événement de cycle de vie.</p>
                <p class="text-[10px] text-zinc-400 mt-1">
                  Les événements arrivent lorsqu'une PDP notifie le statut.
                </p>
              }

              <!-- Manual lifecycle trigger (dev mode) -->
              <div class="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <p class="text-[10px] text-zinc-400 mb-2">Simuler un événement (dev) :</p>
                <div class="flex flex-wrap gap-1">
                  @for (ls of allLifecycleStatuses; track ls) {
                    <button
                      class="text-[10px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700
                              hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      (click)="addLifecycleEvent(inv.id, ls)"
                    >
                      {{ LIFECYCLE[ls] }}
                    </button>
                  }
                </div>
              </div>
            </section>

            <!-- Meta -->
            <section
              class="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-xs"
            >
              <h2 class="font-semibold text-zinc-500 dark:text-zinc-400 uppercase mb-2">
                Métadonnées
              </h2>
              <dl class="space-y-1.5">
                <div class="flex justify-between">
                  <dt class="text-zinc-400">Fichier</dt>
                  <dd class="text-zinc-600 dark:text-zinc-300 font-mono text-[10px]">
                    {{ inv.fileMime || '—' }}
                  </dd>
                </div>
                <div class="flex justify-between">
                  <dt class="text-zinc-400">Devise</dt>
                  <dd>{{ inv.currency }}</dd>
                </div>
                @if (inv.issueDate) {
                  <div class="flex justify-between">
                    <dt class="text-zinc-400">Émission</dt>
                    <dd>{{ inv.issueDate }}</dd>
                  </div>
                }
                @if (inv.dueDate) {
                  <div class="flex justify-between">
                    <dt class="text-zinc-400">Échéance</dt>
                    <dd>{{ inv.dueDate }}</dd>
                  </div>
                }
                @if (inv.ocrConfidence) {
                  <div class="flex justify-between">
                    <dt class="text-zinc-400">Confiance OCR</dt>
                    <dd>
                      {{ avgConfidence(inv.ocrConfidence) | percent: '1.0-0' }}
                    </dd>
                  </div>
                }
              </dl>
            </section>
          </div>
        </div>
      } @else {
        <p class="text-sm text-zinc-500">Facture introuvable.</p>
      }
    </div>
  `,
})
export class InvoiceDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(InvoiceService);

  protected readonly FACTURX_PROFILE_LABELS = FACTURX_PROFILE_LABELS;
  protected readonly LIFECYCLE = LIFECYCLE_STATUS_LABELS;

  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly loading = signal(true);
  protected readonly lifecycleEvents = signal<LifecycleEvent[]>([]);
  protected readonly loadingLifecycle = signal(false);

  protected readonly allLifecycleStatuses: LifecycleStatus[] = [
    'DEPOSITED',
    'REFUSED',
    'MADE_AVAILABLE',
    'SETTLED',
  ];

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (isNaN(id)) {
      this.loading.set(false);
      return;
    }

    this.svc.get(id).subscribe({
      next: (inv) => {
        this.invoice.set(inv);
        this.loading.set(false);
        this.loadLifecycle(id);
      },
      error: () => this.loading.set(false),
    });
  }

  // ── Factur-X ────────────────────────────────────────────────────────────

  protected downloadFacturX(id: number): void {
    window.open(this.svc.facturXPdfUrl(id), '_blank');
  }

  protected facturXXmlUrl(): string {
    const inv = this.invoice();
    return inv ? this.svc.facturXXmlUrl(inv.id) : '';
  }

  protected profileBadgeClass(profile: FacturXProfile): string {
    switch (profile) {
      case 'EN16931':
        return 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300';
      case 'EXTENDED':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300';
      case 'BASIC':
        return 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300';
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500';
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  protected loadLifecycle(invoiceId: number): void {
    this.loadingLifecycle.set(true);
    this.svc.getLifecycle(invoiceId).subscribe({
      next: (r) => {
        this.lifecycleEvents.set(r.events);
        this.loadingLifecycle.set(false);
      },
      error: () => this.loadingLifecycle.set(false),
    });
  }

  protected addLifecycleEvent(invoiceId: number, status: LifecycleStatus): void {
    this.svc.addLifecycleEvent(invoiceId, status).subscribe({
      next: (evt) => {
        this.lifecycleEvents.update((list) => [...list, evt]);
      },
    });
  }

  protected lifecycleDotClass(status: LifecycleStatus): string {
    switch (status) {
      case 'DEPOSITED':
        return 'text-blue-600 dark:text-blue-400';
      case 'REFUSED':
        return 'text-red-600 dark:text-red-400';
      case 'MADE_AVAILABLE':
        return 'text-emerald-600 dark:text-emerald-400';
      case 'SETTLED':
        return 'text-purple-600 dark:text-purple-400';
      default:
        return 'text-zinc-500';
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  protected avgConfidence(
    map: Record<string, number | undefined>,
  ): number {
    const values = Object.values(map).filter(
      (v): v is number => typeof v === 'number',
    );
    if (!values.length) return 0;
    return values.reduce((s, v) => s + v, 0) / values.length;
  }
}
