import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { InvoiceService } from '../../services/invoice-service';
import { InvoiceRealtimeService } from '../../services/invoice-realtime';

type LogType = 'info' | 'success' | 'error' | 'warning' | 'progress' | 'spin';
type TaskPhase = 'uploading' | 'ocr' | 'done' | 'error' | 'duplicate';

interface LogEntry {
  time: string;
  text: string;
  type: LogType;
  progress?: number;
  invoiceId?: number;
  duplicateId?: number;
  duplicateNumber?: string | null;
}

interface UploadTask {
  id: string;
  filename: string;
  phase: TaskPhase;
  logs: LogEntry[];
  invoiceId?: number;
  sub?: Subscription;
}

let _seq = 0;
function uid() { return `t-${++_seq}`; }
function now() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

@Component({
  selector: 'app-invoice-upload',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-2xl mx-auto">
      <header class="mb-4 flex items-center justify-between">
        <div>
          <h1 class="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Importer des factures</h1>
          <p class="text-xs text-zinc-500 dark:text-zinc-400">PDF ou image — extraction automatique</p>
        </div>
        <a routerLink="/invoices" class="text-xs text-indigo-600 hover:underline">← Liste</a>
      </header>

      <!-- Drop zone -->
      <div
        class="border-2 border-dashed rounded-xl p-8 text-center transition-colors"
        [class.border-indigo-400]="dragging()"
        [class.bg-indigo-50]="dragging()"
        [class.dark:bg-indigo-950]="dragging()"
        [class.border-zinc-300]="!dragging()"
        [class.dark:border-zinc-700]="!dragging()"
        (dragover)="onDragOver($event)"
        (dragleave)="dragging.set(false)"
        (drop)="onDrop($event)"
      >
        <p class="text-sm text-zinc-600 dark:text-zinc-300 mb-3">Glissez un ou plusieurs fichiers ici</p>
        <label class="btn-primary text-xs cursor-pointer">
          Parcourir
          <input type="file" hidden accept="application/pdf,image/*" multiple (change)="onChange($event)" />
        </label>
        <p class="mt-2 text-[10px] text-zinc-400">PDF, PNG, JPG — 15 Mo max par fichier</p>
      </div>

      <!-- Timeline -->
      @if (tasks().length > 0) {
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {{ doneCount() + errorCount() }} / {{ tasks().length }} traité(e)s
            </span>
            @if (doneCount() + errorCount() === tasks().length) {
              <button class="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" (click)="clearAll()">
                Tout effacer
              </button>
            }
          </div>

          <div class="space-y-5">
            @for (task of tasks(); track task.id) {
              <div class="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">

                <!-- En-tête fichier -->
                <div class="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  <svg class="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                  <span class="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate flex-1">{{ task.filename }}</span>
                  <!-- Badge phase -->
                  @switch (task.phase) {
                    @case ('uploading') {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-700 text-zinc-500">envoi</span>
                    }
                    @case ('ocr') {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300">OCR</span>
                    }
                    @case ('done') {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300">terminé</span>
                    }
                    @case ('error') {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300">erreur</span>
                    }
                    @case ('duplicate') {
                      <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-300">doublon</span>
                    }
                  }
                </div>

                <!-- Log entries -->
                <div class="px-4 py-2 space-y-0 font-mono">
                  @for (entry of task.logs; track $index; let last = $last) {
                    <div class="flex items-start gap-3 py-1.5"
                         [class.border-b]="!last"
                         [class.border-zinc-50]="!last"
                         [class.dark:border-zinc-800]="!last">

                      <!-- Timestamp -->
                      <span class="text-[10px] text-zinc-300 dark:text-zinc-600 flex-shrink-0 pt-px tabular-nums">{{ entry.time }}</span>

                      <!-- Icône -->
                      <span class="flex-shrink-0 pt-px">
                        @switch (entry.type) {
                          @case ('spin') {
                            <span class="inline-block w-3 h-3 border border-zinc-400 border-t-transparent rounded-full animate-spin"></span>
                          }
                          @case ('success') {
                            <svg class="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                          }
                          @case ('error') {
                            <svg class="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                          }
                          @case ('warning') {
                            <svg class="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01"/></svg>
                          }
                          @case ('progress') {
                            <svg class="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                          }
                          @default {
                            <svg class="w-3 h-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/></svg>
                          }
                        }
                      </span>

                      <!-- Texte + barre de progression si besoin -->
                      <div class="flex-1 min-w-0">
                        <span class="text-[11px] text-zinc-600 dark:text-zinc-300">{{ entry.text }}</span>

                        @if (entry.progress !== undefined) {
                          <div class="mt-1 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-0.5">
                            <div
                              class="bg-indigo-500 h-0.5 rounded-full transition-all duration-500"
                              [style.width.%]="entry.progress"
                            ></div>
                          </div>
                        }

                        @if (entry.invoiceId) {
                          <a [routerLink]="['/invoices', entry.invoiceId, 'review']"
                             class="text-[11px] text-indigo-600 hover:underline ml-2">
                            Ouvrir →
                          </a>
                        }

                        @if (entry.duplicateId) {
                          <a [routerLink]="['/invoices', entry.duplicateId, 'review']"
                             class="text-[11px] text-indigo-600 hover:underline ml-2">
                            Voir #{{ entry.duplicateId }}{{ entry.duplicateNumber ? ' — ' + entry.duplicateNumber : '' }} →
                          </a>
                        }
                      </div>
                    </div>
                  }
                </div>

              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    @reference "tailwindcss";
    .btn-primary { @apply px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-medium; }
  `],
})
export class InvoiceUpload implements OnDestroy {
  private svc = inject(InvoiceService);
  private rt = inject(InvoiceRealtimeService);

  dragging = signal(false);
  tasks = signal<UploadTask[]>([]);

  doneCount = computed(() => this.tasks().filter((t) => t.phase === 'done').length);
  errorCount = computed(() => this.tasks().filter((t) => t.phase === 'error' || t.phase === 'duplicate').length);

  ngOnDestroy() {
    this.tasks().forEach((t) => t.sub?.unsubscribe());
  }

  onDragOver(e: DragEvent) { e.preventDefault(); this.dragging.set(true); }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);
    Array.from(e.dataTransfer?.files ?? []).forEach((f) => this.enqueue(f));
  }

  onChange(e: Event) {
    Array.from((e.target as HTMLInputElement).files ?? []).forEach((f) => this.enqueue(f));
    (e.target as HTMLInputElement).value = '';
  }

  clearAll() {
    this.tasks().forEach((t) => t.sub?.unsubscribe());
    this.tasks.set([]);
  }

  private enqueue(file: File) {
    const task: UploadTask = {
      id: uid(),
      filename: file.name,
      phase: 'uploading',
      logs: [{ time: now(), type: 'spin', text: `Envoi du fichier (${this.formatSize(file.size)})…` }],
    };
    this.tasks.update((list) => [task, ...list]);
    this.startUpload(task.id, file);
  }

  private addLog(id: string, entry: Omit<LogEntry, 'time'>) {
    this.tasks.update((list) =>
      list.map((t) =>
        t.id === id
          ? { ...t, logs: [...t.logs, { time: now(), ...entry }] }
          : t,
      ),
    );
  }

  private updateLastLog(id: string, patch: Partial<LogEntry>) {
    this.tasks.update((list) =>
      list.map((t) => {
        if (t.id !== id) return t;
        const logs = [...t.logs];
        logs[logs.length - 1] = { ...logs[logs.length - 1], ...patch };
        return { ...t, logs };
      }),
    );
  }

  private setPhase(id: string, phase: TaskPhase, extra?: Partial<UploadTask>) {
    this.tasks.update((list) =>
      list.map((t) => (t.id === id ? { ...t, phase, ...extra } : t)),
    );
  }

  private startUpload(id: string, file: File) {
    this.svc.upload(file).subscribe({
      next: ({ invoiceId }) => {
        this.updateLastLog(id, { type: 'success', text: `Fichier reçu — facture #${invoiceId} créée` });
        this.addLog(id, { type: 'info', text: 'En attente d\'un worker OCR…' });
        this.setPhase(id, 'ocr', { invoiceId });

        const sub = this.rt.statusFor$(invoiceId).subscribe((event) => {
          if (event.progress === 10) {
            this.updateLastLog(id, { type: 'spin', text: 'Worker OCR assigné — lecture du document…' });
          } else if (event.progress === 50) {
            this.updateLastLog(id, { type: 'progress', text: 'Extraction des champs en cours…', progress: 50 });
          } else if (event.progress === 100) {
            sub.unsubscribe();
            this.updateLastLog(id, { type: 'success', text: 'Extraction terminée', progress: undefined });
            this.addLog(id, {
              type: 'success',
              text: `Source : ${event.source ?? 'inconnu'} · Confiance : ${event.confidence !== undefined ? Math.round(event.confidence * 100) + '%' : '—'}`,
              invoiceId,
            });
            this.setPhase(id, 'done', { invoiceId });
          }
        });

        this.tasks.update((list) =>
          list.map((t) => (t.id === id ? { ...t, sub } : t)),
        );
      },
      error: (e) => {
        if (e?.status === 409 && e?.error?.existing?.id) {
          this.updateLastLog(id, { type: 'warning', text: 'Fichier déjà importé' });
          this.addLog(id, {
            type: 'warning',
            text: 'Doublon détecté',
            duplicateId: e.error.existing.id,
            duplicateNumber: e.error.existing.invoiceNumber ?? null,
          });
          this.setPhase(id, 'duplicate');
        } else {
          this.updateLastLog(id, { type: 'error', text: e?.error?.error ?? 'Erreur lors de l\'upload' });
          this.setPhase(id, 'error');
        }
      },
    });
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
  }
}
