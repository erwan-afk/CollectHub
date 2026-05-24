import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';

/**
 * Affiche un PDF ou une image via blob URL.
 *
 * On fetch le document via HttpClient pour que l'interceptor JWT
 * ajoute le token Bearer (une iframe classique ne peut pas le faire).
 * Le blob est converti en object URL, affiché dans l'iframe/img.
 */
@Component({
  selector: 'app-pdf-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (blobUrl()) {
      @if (isPdf()) {
        <iframe
          [src]="safeUrl()"
          class="w-full h-full border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white"
          title="Aperçu du document"
        ></iframe>
      } @else {
        <img
          [src]="blobUrl()"
          class="w-full h-full object-contain rounded-lg bg-white border border-zinc-200 dark:border-zinc-800"
          alt="Document"
        />
      }
    } @else if (error()) {
      <div class="flex items-center justify-center h-full text-red-400 text-xs">
        {{ error() }}
      </div>
    } @else {
      <div class="flex items-center justify-center h-full text-zinc-400 text-xs">Chargement…</div>
    }
  `,
})
export class PdfPreview {
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  url = input<string | null>(null);
  mime = input<string | null>(null);

  blobUrl = signal<string | null>(null);
  error = signal<string | null>(null);

  // Garde une référence à l'ancienne blob URL en dehors du signal
  // pour pouvoir la révoquer sans lire blobUrl() dans l'effet.
  private prevBlobUrl: string | null = null;

  isPdf = computed(() => {
    const m = this.mime();
    const u = this.url() ?? '';
    return m === 'application/pdf' || u.toLowerCase().endsWith('.pdf') || u.includes('/file');
  });

  safeUrl = computed<SafeResourceUrl | null>(() => {
    const u = this.blobUrl();
    return u ? this.sanitizer.bypassSecurityTrustResourceUrl(u) : null;
  });

  constructor() {
    // L'effet ne dépend QUE de url() — il ne lit ni n'écrit blobUrl().
    effect(() => {
      const u = this.url();
      if (!u) {
        this.revokePrev();
        untracked(() => {
          this.blobUrl.set(null);
          this.error.set(null);
        });
        return;
      }

      this.revokePrev();
      untracked(() => this.error.set(null));

      this.http.get(u, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          const objectUrl = URL.createObjectURL(blob);
          this.prevBlobUrl = objectUrl;
          // untracked : on ne veut pas que l'écriture dans blobUrl
          // redéclenche cet effet.
          untracked(() => this.blobUrl.set(objectUrl));
        },
        error: (err) => {
          untracked(() =>
            this.error.set(
              err?.status === 401
                ? 'Authentification requise'
                : err?.status === 404
                  ? 'Document introuvable'
                  : 'Erreur de chargement',
            ),
          );
        },
      });
    });
  }

  private revokePrev(): void {
    if (this.prevBlobUrl) {
      URL.revokeObjectURL(this.prevBlobUrl);
      this.prevBlobUrl = null;
    }
  }
}
