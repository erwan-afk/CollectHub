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
  FacturXImportResult,
  LifecycleEvent,
  LifecycleStatus,
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

  /** Sprint 5 : URL de téléchargement Factur-X PDF */
  facturXPdfUrl(id: number): string {
    return `${API}/${id}/facturx.pdf`;
  }

  /** Sprint 5 : URL de téléchargement Factur-X XML (debug) */
  facturXXmlUrl(id: number): string {
    return `${API}/${id}/facturx.xml`;
  }

  /** Sprint 5 : Import Factur-X (multipart PDF) */
  importFacturX(file: File): Observable<FacturXImportResult> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<FacturXImportResult>(`${API}/import/facturx`, fd);
  }

  /** Sprint 5 : Import UBL (multipart XML) */
  importUbl(file: File): Observable<FacturXImportResult> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<FacturXImportResult>(`${API}/import/ubl`, fd);
  }

  /** Sprint 5 : Cycle de vie — événements */
  getLifecycle(invoiceId: number): Observable<{ invoiceId: number; events: LifecycleEvent[] }> {
    return this.http.get<{ invoiceId: number; events: LifecycleEvent[] }>(
      `${API}/${invoiceId}/lifecycle`,
    );
  }

  /** Sprint 5 : Cycle de vie — enregistrer un événement */
  addLifecycleEvent(
    invoiceId: number,
    status: LifecycleStatus,
    comment?: string,
  ): Observable<LifecycleEvent> {
    return this.http.post<LifecycleEvent>(`${API}/${invoiceId}/lifecycle-event`, {
      status,
      comment,
    });
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
