import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { confidenceLevel } from '../../models/invoice';

@Component({
  selector: 'app-confidence-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <ng-content></ng-content>
      <div
        class="absolute left-0 right-0 -bottom-0.5 h-0.5 rounded-full"
        [class]="barClass()"
        [title]="tooltip()"
      ></div>
      @if (showLabel() && level() !== 'none') {
      <span class="absolute -top-1.5 right-1 text-[9px] font-medium px-1 rounded" [class]="labelClass()">
        {{ pct() }}%
      </span>
      }
    </div>
  `,
})
export class ConfidenceField {
  confidence = input<number | undefined>(undefined);
  showLabel = input(true);

  level = computed(() => confidenceLevel(this.confidence()));
  pct = computed(() => Math.round((this.confidence() ?? 0) * 100));

  tooltip = computed(() => {
    const lvl = this.level();
    if (lvl === 'none') return 'Aucune valeur extraite';
    return `Confiance OCR : ${this.pct()}%`;
  });

  barClass = computed(() => {
    switch (this.level()) {
      case 'high': return 'bg-emerald-500';
      case 'medium': return 'bg-amber-500';
      case 'low': return 'bg-red-500';
      case 'none': return 'bg-transparent';
    }
  });

  labelClass = computed(() => {
    switch (this.level()) {
      case 'high': return 'bg-emerald-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-red-500 text-white';
      default: return 'hidden';
    }
  });
}
