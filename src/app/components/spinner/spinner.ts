import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center py-16">
      <div
        class="w-8 h-8 border-[3px] border-zinc-200 dark:border-zinc-700 border-t-indigo-500 rounded-full animate-spin"
      ></div>
    </div>
  `,
})
export class Spinner {}
