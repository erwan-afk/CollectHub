import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Correction,
  CorrectionInput,
  DashboardSummary,
  Invoice,
  InvoiceFilters,
  InvoiceStatus,
  InvoiceUpdate,
} from '../models/invoice';
import { Supplier } from '../models/supplier';

const API = 'http://localhost:3000/api/v1/invoices';

/** Réponse 202 du nouveau upload asynchrone */
export interface UploadResponse {
  invoiceId: number;
  status: 'PROCESSING';
}

/** Réponse 202 du nouveau reprocess asynchrone (Sprint 3) */
export interface ReprocessResponse {
  invoiceId: number;
  status: 'PROCESSING';
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private http = inject(HttpClient);

  list(filters: InvoiceFilters = {}): Observable<{ data: Invoice[]; total: number }> {
    let p = new HttpParams();
    if (filters.status) p = p.set('status', filters.status);
    if (filters.supplierId) p = p.set('supplierId', String(filters.supplierId));
    if (filters.dateFrom) p = p.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) p = p.set('dateTo', filters.dateTo);
    if (filters.amountMin !== undefined) p = p.set('amountMin', String(filters.amountMin));
    if (filters.amountMax !== undefined) p = p.set('amountMax', String(filters.amountMax));
    return this.http.get<{ data: Invoice[]; total: number }>(API, { params: p });
  }

  get(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${API}/${id}`);
  }

  upload(file: File): Observable<UploadResponse> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<UploadResponse>(`${API}/upload`, fd);
  }

  update(id: number, body: InvoiceUpdate): Observable<Invoice> {
    return this.http.put<Invoice>(`${API}/${id}`, body);
  }

  transition(id: number, to: InvoiceStatus, reason?: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${API}/${id}/transition`, { to, reason });
  }

  /** Sprint 3 : reprocess-ocr est maintenant asynchrone via la queue */
  reprocessOcr(id: number): Observable<ReprocessResponse> {
    return this.http.post<ReprocessResponse>(`${API}/${id}/reprocess-ocr`, {});
  }

  /** Sprint 3 : enregistre une correction utilisateur */
  saveCorrection(invoiceId: number, input: CorrectionInput): Observable<Correction> {
    return this.http.patch<Correction>(`${API}/${invoiceId}/corrections`, input);
  }

  /** Sprint 3 : liste les corrections d'une facture */
  getCorrections(invoiceId: number): Observable<Correction[]> {
    return this.http.get<Correction[]>(`${API}/${invoiceId}/corrections`);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`);
  }

  fileUrl(id: number): string {
    return `${API}/${id}/file`;
  }

  summary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${API}/dashboard/summary`);
  }

  exportCsvUrl(
    filters: { status?: InvoiceStatus; dateFrom?: string; dateTo?: string } = {},
  ): string {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    const qs = params.toString();
    return `${API}/export.csv${qs ? '?' + qs : ''}`;
  }
}
