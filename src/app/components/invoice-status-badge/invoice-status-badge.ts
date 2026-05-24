import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { InvoiceStatus, STATUS_LABELS } from '../../models/invoice';

@Component({
  selector: 'app-invoice-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
      [class]="classes()"
    >
      <span class="w-1.5 h-1.5 rounded-full" [class]="dotClass()"></span>
      {{ label() }}
    </span>
  `,
})
export class InvoiceStatusBadge {
  status = input.required<InvoiceStatus>();

  label = computed(() => STATUS_LABELS[this.status()]);

  classes = computed(() => {
    switch (this.status()) {
      case 'DRAFT':
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
      case 'PENDING_VALIDATION':
        return 'bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'VALIDATED':
        return 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'REJECTED':
        return 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
      case 'ARCHIVED':
        return 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
      case 'PROCESSING':
      default:
        return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700';
    }
  });

  dotClass = computed(() => {
    switch (this.status()) {
      case 'DRAFT': return 'bg-zinc-400';
      case 'PENDING_VALIDATION': return 'bg-amber-500';
      case 'VALIDATED': return 'bg-emerald-500';
      case 'REJECTED': return 'bg-red-500';
      case 'ARCHIVED': return 'bg-indigo-500';
      case 'PROCESSING':
      default: return 'bg-zinc-300 animate-pulse';
    }
  });
}
