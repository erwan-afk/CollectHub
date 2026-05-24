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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Invoice, InvoiceStatus, STATUS_LABELS, confidenceLevel } from '../../models/invoice';
import { Supplier } from '../../models/supplier';
import { InvoiceService } from '../../services/invoice-service';
import { SupplierService } from '../../services/supplier-service';
import { InvoiceRealtimeService, type InvoiceStatusEvent } from '../../services/invoice-realtime';
import { TabService } from '../../services/tab.service';
import { ConfidenceField } from '../../components/confidence-field/confidence-field';
import { InvoiceStatusBadge } from '../../components/invoice-status-badge/invoice-status-badge';
import { PdfPreview } from '../../components/pdf-preview/pdf-preview';
import { Spinner } from '../../components/spinner/spinner';

@Component({
  selector: 'app-invoice-review',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ConfidenceField,
    InvoiceStatusBadge,
    PdfPreview,
    Spinner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-[calc(100vh-3rem)] flex flex-col">
      @if (invoice(); as inv) {
        <header
          class="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900"
        >
          <div class="flex items-center gap-3">
            <a routerLink="/invoices" class="text-xs text-indigo-600 hover:underline">← Liste</a>
            <h1 class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Facture #{{ inv.id }}
              @if (inv.invoiceNumber) {
                <span class="text-zinc-400 font-normal">— {{ inv.invoiceNumber }}</span>
              }
            </h1>
            <app-invoice-status-badge [status]="inv.status" />
          </div>
          <div class="flex items-center gap-2">
            <button
              class="btn-ghost"
              (click)="reprocess()"
              [disabled]="reprocessing()"
              title="Re-lancer l'OCR sur ce fichier"
            >
              {{ reprocessing() ? 'OCR…' : '↻ OCR' }}
            </button>
            <button class="btn-ghost" (click)="save()" [disabled]="saving()">
              {{ saving() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
            @for (action of availableTransitions(); track action.to) {
              <button class="btn-ghost" [class]="action.btnClass" (click)="transition(action.to)">
                {{ action.label }}
              </button>
            }
            <button
              class="btn-ghost !text-red-600 !border-red-200 hover:!bg-red-50 dark:hover:!bg-red-950"
              (click)="remove()"
              [disabled]="deleting()"
            >
              {{ deleting() ? 'Suppression…' : 'Supprimer' }}
            </button>
          </div>
        </header>

        @if (supplierBanner(); as b) {
          <div
            class="px-6 py-2 border-b text-xs flex items-center justify-between"
            [class.bg-emerald-50]="b.kind === 'matched'"
            [class.dark:bg-emerald-950]="b.kind === 'matched'"
            [class.text-emerald-800]="b.kind === 'matched'"
            [class.dark:text-emerald-200]="b.kind === 'matched'"
            [class.border-emerald-200]="b.kind === 'matched'"
            [class.dark:border-emerald-900]="b.kind === 'matched'"
            [class.bg-amber-50]="b.kind === 'suggestion'"
            [class.dark:bg-amber-950]="b.kind === 'suggestion'"
            [class.text-amber-900]="b.kind === 'suggestion'"
            [class.dark:text-amber-200]="b.kind === 'suggestion'"
            [class.border-amber-200]="b.kind === 'suggestion'"
            [class.dark:border-amber-900]="b.kind === 'suggestion'"
          >
            <span>
              @if (b.kind === 'matched') {
                ✓ Fournisseur reconnu automatiquement : <strong>{{ b.supplierName }}</strong>
                <span class="opacity-70">(via {{ b.matchedBy }})</span>
              } @else {
                ⚠ Fournisseur inconnu — identifiant détecté :
                @if (b.siret) {
                  <span class="font-mono">SIRET {{ b.siret }}</span>
                }
                @if (b.iban) {
                  <span class="font-mono">IBAN {{ b.iban }}</span>
                }
              }
            </span>
            @if (b.kind === 'suggestion') {
              <span class="flex items-center gap-2">
                <input
                  class="input"
                  placeholder="Nom du fournisseur"
                  [(ngModel)]="newSupplierName"
                />
                <button
                  class="btn-ghost"
                  (click)="createSupplierFromSuggestion()"
                  [disabled]="creatingSupplier()"
                >
                  {{ creatingSupplier() ? 'Création…' : 'Créer & lier' }}
                </button>
                <button
                  class="text-zinc-500 hover:text-zinc-900"
                  (click)="dismissSuggestion()"
                  title="Ignorer"
                >
                  ×
                </button>
              </span>
            }
          </div>
        }

        <!-- Sprint 3 : Panneau de détection de fraude -->
        @if (inv.riskAssessment; as risk) {
          <div
            class="px-6 py-2 border-b text-xs flex flex-col gap-1"
            [class.bg-red-50]="risk.score >= 70"
            [class.dark:bg-red-950]="risk.score >= 70"
            [class.text-red-800]="risk.score >= 70"
            [class.dark:text-red-200]="risk.score >= 70"
            [class.border-red-200]="risk.score >= 70"
            [class.dark:border-red-900]="risk.score >= 70"
            [class.bg-amber-50]="risk.score >= 30 && risk.score < 70"
            [class.dark:bg-amber-950]="risk.score >= 30 && risk.score < 70"
            [class.text-amber-800]="risk.score >= 30 && risk.score < 70"
            [class.dark:text-amber-200]="risk.score >= 30 && risk.score < 70"
            [class.border-amber-200]="risk.score >= 30 && risk.score < 70"
            [class.dark:border-amber-900]="risk.score >= 30 && risk.score < 70"
            [class.bg-emerald-50]="risk.score < 30"
            [class.dark:bg-emerald-950]="risk.score < 30"
            [class.text-emerald-800]="risk.score < 30"
            [class.dark:text-emerald-200]="risk.score < 30"
            [class.border-emerald-200]="risk.score < 30"
            [class.dark:border-emerald-900]="risk.score < 30"
          >
            <div class="flex items-center gap-2 font-semibold">
              <span>🛡️ Score fraude : {{ risk.score }}/100</span>
              @if (risk.score >= 70) {
                <span class="text-red-700 dark:text-red-300 font-bold">⚠ Alerte critique</span>
              } @else if (risk.score >= 30) {
                <span class="text-amber-700 dark:text-amber-300">⚠ Attention</span>
              } @else {
                <span class="text-emerald-700 dark:text-emerald-300">✓ Risque faible</span>
              }
            </div>
            @if (risk.flags.length) {
              <ul class="space-y-0.5 opacity-80">
                @for (flag of risk.flags; track $index) {
                  <li class="font-mono text-[10px]">• {{ flag }}</li>
                }
              </ul>
            }
          </div>
        }

        <div class="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden">
          <div class="p-4 bg-zinc-100 dark:bg-zinc-950 overflow-auto">
            <app-pdf-preview
              [url]="fileUrl()"
              [mime]="inv.fileMime"
              class="block w-full h-full min-h-[600px]"
            />
          </div>

          <div class="p-6 overflow-auto bg-white dark:bg-zinc-900">
            <h2
              class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mb-3"
            >
              Champs extraits
            </h2>

            <div class="grid grid-cols-2 gap-3 mb-5">
              <label class="block">
                <span class="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Numéro de facture
                  <button
                    class="ml-1 text-indigo-500 hover:text-indigo-700 text-[10px]"
                    (click)="startCorrection('invoice_number', form.invoiceNumber ?? '')"
                    title="Corriger la valeur"
                  >
                    ✎
                  </button>
                </span>
                <app-confidence-field [confidence]="conf().invoice_number">
                  <input class="input w-full" [(ngModel)]="form.invoiceNumber" />
                </app-confidence-field>
              </label>

              <label class="block">
                <span class="text-[10px] text-zinc-500 dark:text-zinc-400">Fournisseur</span>
                <select class="input w-full" [(ngModel)]="form.supplierId">
                  <option [ngValue]="null">— Aucun —</option>
                  @for (s of suppliers(); track s.id) {
                    <option [ngValue]="s.id">{{ s.name }}</option>
                  }
                </select>
              </label>

              <label class="block">
                <span class="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Date d'émission
                  <button
                    class="ml-1 text-indigo-500 hover:text-indigo-700 text-[10px]"
                    (click)="startCorrection('issue_date', form.issueDate ?? '')"
                    title="Corriger"
                  >
                    ✎
                  </button>
                </span>
                <app-confidence-field [confidence]="conf().issue_date">
                  <input type="date" class="input w-full" [(ngModel)]="form.issueDate" />
                </app-confidence-field>
              </label>

              <label class="block">
                <span class="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Échéance
                  <button
                    class="ml-1 text-indigo-500 hover:text-indigo-700 text-[10px]"
                    (click)="startCorrection('due_date', form.dueDate ?? '')"
                    title="Corriger"
                  >
                    ✎
                  </button>
                </span>
                <app-confidence-field [confidence]="conf().due_date">
                  <input type="date" class="input w-full" [(ngModel)]="form.dueDate" />
                </app-confidence-field>
              </label>

              <label class="block">
                <span class="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Montant HT (€)
                  <button
                    class="ml-1 text-indigo-500 hover:text-indigo-700 text-[10px]"
                    (click)="
                      startCorrection(
                        'amount_ht',
                        form.amountHt != null ? form.amountHt.toString() : ''
                      )
                    "
                    title="Corriger"
                  >
                    ✎
                  </button>
                </span>
                <app-confidence-field [confidence]="conf().amount_ht">
                  <input
                    type="number"
                    step="0.01"
                    class="input w-full"
                    [(ngModel)]="form.amountHt"
                  />
                </app-confidence-field>
              </label>

              <label class="block">
                <span class="text-[10px] text-zinc-500 dark:text-zinc-400">
                  TVA (€)
                  <button
                    class="ml-1 text-indigo-500 hover:text-indigo-700 text-[10px]"
                    (click)="
                      startCorrection(
                        'amount_tva',
                        form.amountTva != null ? form.amountTva.toString() : ''
                      )
                    "
                    title="Corriger"
                  >
                    ✎
                  </button>
                </span>
                <app-confidence-field [confidence]="conf().amount_tva">
                  <input
                    type="number"
                    step="0.01"
                    class="input w-full"
                    [(ngModel)]="form.amountTva"
                  />
                </app-confidence-field>
              </label>

              <label class="block col-span-2">
                <span class="text-[10px] text-zinc-500 dark:text-zinc-400">
                  Total TTC (€)
                  <button
                    class="ml-1 text-indigo-500 hover:text-indigo-700 text-[10px]"
                    (click)="
                      startCorrection(
                        'amount_ttc',
                        form.amountTtc != null ? form.amountTtc.toString() : ''
                      )
                    "
                    title="Corriger"
                  >
                    ✎
                  </button>
                </span>
                <app-confidence-field [confidence]="conf().amount_ttc">
                  <input
                    type="number"
                    step="0.01"
                    class="input w-full text-base font-semibold"
                    [(ngModel)]="form.amountTtc"
                  />
                </app-confidence-field>
              </label>
            </div>

            @if (sumMismatch()) {
              <p class="text-[10px] text-amber-600 dark:text-amber-400 mb-4">
                ⚠ HT + TVA = {{ (form.amountHt! + form.amountTva!).toFixed(2) }} ≠ TTC ({{
                  form.amountTtc?.toFixed(2)
                }})
              </p>
            }

            @if (saveMsg()) {
              <p
                class="text-[11px] mb-3"
                [class.text-emerald-600]="!saveError()"
                [class.text-red-600]="saveError()"
              >
                {{ saveMsg() }}
              </p>
            }

            <!-- Sprint 3 : Formulaire de correction inline -->
            @if (editingField(); as ef) {
              <div
                class="mb-4 p-3 border border-indigo-200 dark:border-indigo-800 rounded-md bg-indigo-50 dark:bg-indigo-950/30"
              >
                <h4 class="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 mb-2">
                  Correction : {{ fieldLabel(ef) }}
                </h4>
                <div class="flex flex-col gap-2">
                  <div>
                    <span class="text-[10px] text-zinc-500">Valeur extraite</span>
                    <input
                      class="input w-full text-[11px] bg-white dark:bg-zinc-800"
                      [value]="editingAiValue()"
                      readonly
                    />
                  </div>
                  <div>
                    <span class="text-[10px] text-zinc-500">Valeur corrigée</span>
                    <input
                      class="input w-full text-[11px]"
                      [(ngModel)]="correctingValue"
                      placeholder="Saisir la valeur correcte…"
                      (keydown.enter)="submitCorrection()"
                    />
                  </div>
                  <div class="flex gap-2">
                    <button
                      class="px-3 py-1 text-[11px] rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                      (click)="submitCorrection()"
                      [disabled]="correcting() || !correctingValue.trim()"
                    >
                      {{ correcting() ? 'Enregistrement…' : 'Enregistrer la correction' }}
                    </button>
                    <button
                      class="px-3 py-1 text-[11px] rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      (click)="cancelCorrection()"
                    >
                      Annuler
                    </button>
                  </div>
                  @if (correctionMsg()) {
                    <p
                      class="text-[10px]"
                      [class.text-emerald-600]="!correctionError()"
                      [class.text-red-600]="correctionError()"
                    >
                      {{ correctionMsg() }}
                    </p>
                  }
                </div>
              </div>
            }

            <!-- Sprint 3 : Statut temps réel via WebSocket -->
            @if (liveStatus(); as ls) {
              <div
                class="mb-4 px-3 py-1.5 border border-blue-200 dark:border-blue-800 rounded-md bg-blue-50 dark:bg-blue-950/30 text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2"
              >
                <span class="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                <span
                  >Statut live : <strong>{{ ls.status }}</strong> — {{ ls.progress }}%
                  @if (ls.pipelineMode) {
                    <span class="opacity-70">(mode: {{ ls.pipelineMode }})</span>
                  }
                  @if (ls.riskScore !== undefined) {
                    <span class="opacity-70">| risque: {{ ls.riskScore }}/100</span>
                  }
                </span>
              </div>
            }

            @if (inv.lines.length) {
              <h3
                class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mt-2 mb-2"
              >
                Lignes ({{ inv.lines.length }})
              </h3>
              <div
                class="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden mb-4"
              >
                <table class="w-full text-[11px]">
                  <thead class="bg-zinc-50 dark:bg-zinc-800/60 text-zinc-500">
                    <tr>
                      <th class="px-2 py-1 text-left">Désignation</th>
                      <th class="px-2 py-1 text-right">Qté</th>
                      <th class="px-2 py-1 text-right">PU</th>
                      <th class="px-2 py-1 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-zinc-100 dark:divide-zinc-800">
                    @for (l of inv.lines; track $index) {
                      <tr>
                        <td class="px-2 py-1 text-zinc-800 dark:text-zinc-200">
                          {{ l.description }}
                        </td>
                        <td class="px-2 py-1 text-right tabular-nums">{{ l.quantity }}</td>
                        <td class="px-2 py-1 text-right tabular-nums">
                          {{ l.unitPrice | number: '1.2-2' }}
                        </td>
                        <td class="px-2 py-1 text-right tabular-nums font-medium">
                          {{ l.total | number: '1.2-2' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            @if (inv.history?.length) {
              <h3
                class="text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide mt-6 mb-2"
              >
                Historique
              </h3>
              <ul class="space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                @for (h of inv.history; track h.id) {
                  <li>
                    <span class="font-mono text-zinc-400">{{ h.createdAt | date: 'short' }}</span> —
                    {{ h.fromStatus ? statusLabel(h.fromStatus) + ' → ' : ''
                    }}{{ statusLabel(h.toStatus) }}
                    <span class="text-zinc-400">par {{ h.actor }}</span>
                    @if (h.reason) {
                      <em class="text-zinc-500">— {{ h.reason }}</em>
                    }
                  </li>
                }
              </ul>
            }
          </div>
        </div>
      } @else {
        @if (loading()) {
          <div class="flex items-center justify-center h-full"><app-spinner /></div>
        } @else {
          <div class="flex items-center justify-center h-full text-zinc-400 text-sm">
            Facture introuvable
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      @reference "tailwindcss";
      .btn-ghost {
        @apply px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 dark:border-zinc-700
             bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200
             hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50;
      }
    `,
  ],
})
export class InvoiceReview implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private invSvc = inject(InvoiceService);
  private supSvc = inject(SupplierService);
  private rtSvc = inject(InvoiceRealtimeService);
  private tabs = inject(TabService);
  private routeSub?: Subscription;
  private rtSub?: Subscription;

  invoice = signal<Invoice | null>(null);
  suppliers = signal<Supplier[]>([]);
  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);
  reprocessing = signal(false);
  saveMsg = signal<string | null>(null);
  saveError = signal(false);

  matchedSupplier = signal<{ supplier: Supplier; matchedBy: 'siret' | 'iban' } | null>(null);
  suggestion = signal<{ siret: string | null; iban: string | null } | null>(null);
  newSupplierName = '';
  creatingSupplier = signal(false);

  // Sprint 3 : Correction de champ
  editingField = signal<string | null>(null);
  editingAiValue = signal('');
  correctingValue = '';
  correcting = signal(false);
  correctionMsg = signal<string | null>(null);
  correctionError = signal(false);

  // Sprint 3 : Statut temps réel WebSocket
  liveStatus = signal<InvoiceStatusEvent | null>(null);

  supplierBanner = computed(() => {
    const m = this.matchedSupplier();
    if (m)
      return { kind: 'matched' as const, supplierName: m.supplier.name, matchedBy: m.matchedBy };
    const s = this.suggestion();
    if (s && (s.siret || s.iban))
      return { kind: 'suggestion' as const, siret: s.siret, iban: s.iban };
    return null;
  });

  form = {
    supplierId: null as number | null,
    invoiceNumber: '' as string | null,
    issueDate: null as string | null,
    dueDate: null as string | null,
    amountHt: null as number | null,
    amountTva: null as number | null,
    amountTtc: null as number | null,
  };

  conf = computed(() => this.invoice()?.ocrConfidence ?? {});

  fileUrl = computed(() => {
    const inv = this.invoice();
    return inv ? this.invSvc.fileUrl(inv.id) : null;
  });

  sumMismatch = computed(() => {
    const f = this.form;
    if (f.amountHt === null || f.amountTva === null || f.amountTtc === null) return false;
    return Math.abs(f.amountHt + f.amountTva - f.amountTtc) > 0.05;
  });

  availableTransitions = computed(() => {
    const inv = this.invoice();
    if (!inv) return [];
    const all: Record<InvoiceStatus, { to: InvoiceStatus; label: string; btnClass: string }[]> = {
      DRAFT: [
        {
          to: 'PENDING_VALIDATION',
          label: 'Soumettre',
          btnClass: '!bg-amber-500 !text-white !border-amber-500',
        },
      ],
      PENDING_VALIDATION: [
        {
          to: 'VALIDATED',
          label: 'Valider',
          btnClass: '!bg-emerald-600 !text-white !border-emerald-600',
        },
        { to: 'REJECTED', label: 'Rejeter', btnClass: '!bg-red-600 !text-white !border-red-600' },
      ],
      VALIDATED: [
        {
          to: 'ARCHIVED',
          label: 'Archiver',
          btnClass: '!bg-indigo-600 !text-white !border-indigo-600',
        },
      ],
      REJECTED: [{ to: 'DRAFT', label: 'Repasser en brouillon', btnClass: '' }],
      ARCHIVED: [],
      PROCESSING: [],
    };
    return all[inv.status];
  });

  ngOnInit() {
    this.supSvc.list().subscribe({ next: (s) => this.suppliers.set(s) });

    // paramMap est un Observable : se redéclenche quand on switche d'onglet
    // sans détruire le composant (réutilisation par Angular).
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      this.loading.set(true);
      this.invoice.set(null);

      this.tabs.openTab({ id: `invoice-${id}`, label: `#${id}`, path: `/invoices/${id}/review` });

      const nav =
        this.router.getCurrentNavigation()?.extras?.state ??
        (history.state as { supplierMatch?: unknown; supplierSuggestion?: unknown } | null);
      if (nav) {
        const match =
          (nav as { supplierMatch?: { supplier: Supplier; matchedBy: 'siret' | 'iban' } | null })
            .supplierMatch ?? null;
        const sugg =
          (nav as { supplierSuggestion?: { siret: string | null; iban: string | null } | null })
            .supplierSuggestion ?? null;
        this.matchedSupplier.set(match);
        this.suggestion.set(sugg);
      }

      this.invSvc.get(id).subscribe({
        next: (inv) => {
          this.loading.set(false);
          this.setInvoice(inv);
          this.tabs.updateLabel(`invoice-${id}`, inv.invoiceNumber ?? `#${id}`);

          // Sprint 3 : souscrire aux màj temps réel de cette facture
          this.rtSub = this.rtSvc.statusFor$(id).subscribe((event) => {
            this.liveStatus.set(event);
            // Si le traitement est terminé, recharger la facture
            if (event.progress === 100 && event.status !== 'PROCESSING') {
              this.invSvc.get(id).subscribe({
                next: (fresh) => this.setInvoice(fresh),
              });
            }
          });
        },
        error: () => this.loading.set(false),
      });
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
    this.rtSub?.unsubscribe();
  }

  createSupplierFromSuggestion() {
    const inv = this.invoice();
    const sugg = this.suggestion();
    if (!inv || !sugg) return;
    const name = this.newSupplierName.trim();
    if (!name) {
      this.saveError.set(true);
      this.saveMsg.set('Renseigner un nom de fournisseur');
      return;
    }
    this.creatingSupplier.set(true);
    this.supSvc
      .create({ name, siret: sugg.siret, iban: sugg.iban, vatNumber: null, address: null })
      .subscribe({
        next: (s) => {
          this.suppliers.update((list) =>
            [...list, s].sort((a, b) => a.name.localeCompare(b.name)),
          );
          this.form.supplierId = s.id;
          this.invSvc
            .update(inv.id, {
              supplierId: s.id,
              invoiceNumber: this.form.invoiceNumber,
              issueDate: this.form.issueDate,
              dueDate: this.form.dueDate,
              amountHt: this.form.amountHt,
              amountTva: this.form.amountTva,
              amountTtc: this.form.amountTtc,
              currency: 'EUR',
            })
            .subscribe({
              next: (updated) => {
                this.creatingSupplier.set(false);
                this.setInvoice(updated);
                this.matchedSupplier.set({ supplier: s, matchedBy: sugg.siret ? 'siret' : 'iban' });
                this.suggestion.set(null);
                this.saveError.set(false);
                this.saveMsg.set('Fournisseur créé et lié');
                setTimeout(() => this.saveMsg.set(null), 1800);
              },
              error: () => {
                this.creatingSupplier.set(false);
                this.saveError.set(true);
                this.saveMsg.set('Fournisseur créé mais liaison impossible');
              },
            });
        },
        error: (e) => {
          this.creatingSupplier.set(false);
          this.saveError.set(true);
          this.saveMsg.set(e?.error?.error ?? 'Création du fournisseur impossible');
        },
      });
  }

  dismissSuggestion() {
    this.suggestion.set(null);
  }

  reprocess() {
    const inv = this.invoice();
    if (!inv) return;
    this.reprocessing.set(true);
    this.saveMsg.set(null);
    // Sprint 3 : reprocess-ocr est asynchrone via la queue → on reçoit juste un acquittement
    // Les màj arriveront via WebSocket (liveStatus)
    this.invSvc.reprocessOcr(inv.id).subscribe({
      next: () => {
        this.reprocessing.set(false);
        this.saveError.set(false);
        this.saveMsg.set('OCR relancé — mise à jour en cours…');
        this.liveStatus.set(null); // reset pour afficher la progression
        setTimeout(() => this.saveMsg.set(null), 3000);
      },
      error: (e) => {
        this.reprocessing.set(false);
        this.saveError.set(true);
        this.saveMsg.set(e?.error?.error ?? 'Re-traitement impossible');
      },
    });
  }

  remove() {
    const inv = this.invoice();
    if (!inv) return;
    const label = inv.invoiceNumber ? `« ${inv.invoiceNumber} »` : `#${inv.id}`;
    if (!confirm(`Supprimer la facture ${label} ? Cette action est irréversible.`)) return;
    this.deleting.set(true);
    this.invSvc.delete(inv.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.router.navigate(['/invoices']);
      },
      error: () => {
        this.deleting.set(false);
        this.saveError.set(true);
        this.saveMsg.set('Suppression impossible');
      },
    });
  }

  private setInvoice(inv: Invoice) {
    this.invoice.set(inv);
    this.form = {
      supplierId: inv.supplierId,
      invoiceNumber: inv.invoiceNumber,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      amountHt: inv.amountHt,
      amountTva: inv.amountTva,
      amountTtc: inv.amountTtc,
    };
  }

  save() {
    const inv = this.invoice();
    if (!inv) return;
    this.saving.set(true);
    this.saveMsg.set(null);
    this.invSvc
      .update(inv.id, {
        supplierId: this.form.supplierId,
        invoiceNumber: this.form.invoiceNumber,
        issueDate: this.form.issueDate,
        dueDate: this.form.dueDate,
        amountHt: this.form.amountHt,
        amountTva: this.form.amountTva,
        amountTtc: this.form.amountTtc,
        currency: 'EUR',
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.setInvoice(updated);
          this.saveError.set(false);
          this.saveMsg.set('Enregistré');
          setTimeout(() => this.saveMsg.set(null), 1500);
        },
        error: () => {
          this.saving.set(false);
          this.saveError.set(true);
          this.saveMsg.set('Erreur d’enregistrement');
        },
      });
  }

  transition(to: InvoiceStatus) {
    const inv = this.invoice();
    if (!inv) return;
    let reason: string | undefined;
    if (to === 'REJECTED') {
      reason = prompt('Motif de rejet ?') || undefined;
    }
    this.invSvc.transition(inv.id, to, reason).subscribe({
      next: (updated) => this.setInvoice(updated),
      error: (e) => {
        this.saveError.set(true);
        this.saveMsg.set(e?.error?.error ?? 'Transition refusée');
      },
    });
  }

  statusLabel(s: InvoiceStatus) {
    return STATUS_LABELS[s];
  }
  confLevel = confidenceLevel;

  // ─── Sprint 3 : Correction de champs extraits ────────────────────────────

  private readonly FIELD_LABELS: Record<string, string> = {
    invoice_number: 'Numéro de facture',
    issue_date: "Date d'émission",
    due_date: 'Échéance',
    amount_ht: 'Montant HT',
    amount_tva: 'TVA',
    amount_ttc: 'Total TTC',
  };

  fieldLabel(field: string): string {
    return this.FIELD_LABELS[field] ?? field;
  }

  startCorrection(field: string, currentValue: string): void {
    this.editingField.set(field);
    this.editingAiValue.set(currentValue);
    this.correctingValue = '';
    this.correctionMsg.set(null);
    this.correctionError.set(false);
  }

  cancelCorrection(): void {
    this.editingField.set(null);
    this.correctingValue = '';
  }

  submitCorrection(): void {
    const inv = this.invoice();
    const field = this.editingField();
    if (!inv || !field || !this.correctingValue.trim()) return;

    this.correcting.set(true);
    this.correctionMsg.set(null);

    this.invSvc
      .saveCorrection(inv.id, {
        field,
        rawTextSnippet: '',
        aiValue: this.editingAiValue(),
        correctedValue: this.correctingValue.trim(),
      })
      .subscribe({
        next: () => {
          this.correcting.set(false);
          this.correctionError.set(false);
          this.correctionMsg.set('Correction enregistrée ✓');
          this.editingField.set(null);
          this.correctingValue = '';
          setTimeout(() => this.correctionMsg.set(null), 2000);
        },
        error: (e) => {
          this.correcting.set(false);
          this.correctionError.set(true);
          this.correctionMsg.set(e?.error?.error ?? 'Erreur lors de la correction');
        },
      });
  }
}
