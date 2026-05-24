import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Supplier, SupplierInput } from '../models/supplier';

const API = 'http://localhost:3000/api/v1/suppliers';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private http = inject(HttpClient);

  list(): Observable<Supplier[]> {
    return this.http
      .get<{ data: Supplier[]; total: number }>(API)
      .pipe(map((r) => r.data));
  }

  get(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${API}/${id}`);
  }

  create(input: SupplierInput): Observable<Supplier> {
    return this.http.post<Supplier>(API, input);
  }

  update(id: number, input: SupplierInput): Observable<Supplier> {
    return this.http.put<Supplier>(`${API}/${id}`, input);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`);
  }
}
