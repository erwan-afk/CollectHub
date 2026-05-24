/**
 * SocketClientService — wraps socket.io-client.
 *
 * - Connexion lazy : se connecte uniquement quand `connect()` est appelé.
 * - Auth : envoie le JWT Bearer dans le handshake `auth.token`.
 * - Déconnexion propre via `disconnect()` (appelé dans ngOnDestroy ou logout).
 */
import { Injectable, inject } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';

const SERVER_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class SocketClientService {
  private auth = inject(AuthService);
  private socket: Socket | null = null;

  connect(): Socket {
    if (!this.socket) {
      // Crée l'instance une seule fois (autoConnect: false — on contrôle manuellement)
      // pour que les listeners enregistrés par InvoiceRealtimeService restent valides.
      this.socket = io(`${SERVER_URL}/invoices`, {
        auth: { token: this.auth.getToken() },
        transports: ['websocket'],
        autoConnect: false,
      });
    }

    if (!this.socket.connected) {
      // Met à jour le token avant chaque connexion (utile après login/logout)
      (this.socket.auth as Record<string, unknown>)['token'] = this.auth.getToken();
      this.socket.connect();
    }

    return this.socket;
  }

  disconnect(): void {
    this.socket?.disconnect();
    // On ne nullifie pas : les listeners restent pour la prochaine connexion
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}
