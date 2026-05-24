/**
 * InvoiceRealtimeService — écoute les événements `invoice:status` du serveur Socket.io
 * et les redistribue en RxJS pour que les composants s'y abonnent.
 *
 * Usage :
 *   // Dans un composant
 *   this.rt.status$.subscribe(e => ...);
 *
 *   // Pour suivre une facture spécifique
 *   this.rt.statusFor$(invoiceId).subscribe(e => ...);
 */
import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, Observable, filter } from 'rxjs';
import { SocketClientService } from './socket-client';

export interface InvoiceStatusEvent {
  invoiceId: number;
  status: string;
  progress: number;
  confidence?: number;
  source?: string;
  pipelineMode?: string;
  riskScore?: number;
}

@Injectable({ providedIn: 'root' })
export class InvoiceRealtimeService implements OnDestroy {
  private socketClient = inject(SocketClientService);
  private statusSubject = new Subject<InvoiceStatusEvent>();

  /** Flux de tous les événements de statut reçus du serveur */
  readonly status$ = this.statusSubject.asObservable();

  constructor() {
    this.connect();
  }

  private connect(): void {
    const socket = this.socketClient.connect();

    socket.on('invoice:status', (event: InvoiceStatusEvent) => {
      this.statusSubject.next(event);
    });

    socket.on('connect_error', (err) => {
      console.warn('[InvoiceRealtime] connect_error:', err.message);
    });
  }

  /** Observable filtré sur une facture spécifique */
  statusFor$(invoiceId: number): Observable<InvoiceStatusEvent> {
    // S'assure que le socket est connecté avec le token courant avant d'écouter
    this.socketClient.connect();
    return this.status$.pipe(filter((e) => e.invoiceId === invoiceId));
  }

  ngOnDestroy(): void {
    this.statusSubject.complete();
    this.socketClient.disconnect();
  }
}
