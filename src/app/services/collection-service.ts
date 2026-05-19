import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { Collection } from '../models/collection';
import { CollectionItem } from '../models/collection-item';

const API = 'http://localhost:3000/api/v1';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private http = inject(HttpClient);

  getAll(): Observable<Collection[]> {
    return this.http.get<{ data: any[]; total: number; limit: number; offset: number }>(`${API}/collections`).pipe(
      map(({ data: rows }) =>
        rows.map((r) => {
          const c = Object.assign(new Collection(), { id: r.id, title: r.title });
          c.items = (r.items || []).map((i: any) =>
            Object.assign(new CollectionItem(), {
              id: i.id,
              name: i.name,
              description: i.description,
              image: i.image,
              rarity: i.rarity,
              price: Number(i.price),
            }),
          );
          return c;
        }),
      ),
    );
  }

  get(collectionId: number): Observable<Collection | null> {
    return this.http.get<any>(`${API}/collections/${collectionId}`).pipe(
      map((r) => {
        if (!r) return null;
        const c = Object.assign(new Collection(), { id: r.id, title: r.title });
        c.items = (r.items || []).map((i: any) =>
          Object.assign(new CollectionItem(), {
            id: i.id,
            name: i.name,
            description: i.description,
            image: i.image,
            rarity: i.rarity,
            price: Number(i.price),
          }),
        );
        return c;
      }),
    );
  }

  add(collection: Omit<Collection, 'id' | 'items'>): Observable<Collection> {
    return this.http.post<any>(`${API}/collections`, { title: collection.title }).pipe(
      map((r) => {
        const c = Object.assign(new Collection(), { id: r.id, title: r.title });
        c.items = [];
        return c;
      }),
    );
  }

  update(collection: Omit<Collection, 'items'>): Observable<Collection | null> {
    return this.http
      .put<any>(`${API}/collections/${collection.id}`, { title: collection.title })
      .pipe(
        map((r) => {
          if (!r) return null;
          return Object.assign(new Collection(), { id: r.id, title: r.title });
        }),
      );
  }

  delete(collectionId: number): Observable<void> {
    return this.http.delete<void>(`${API}/collections/${collectionId}`);
  }

  addItem(collection: Collection, item: CollectionItem): Observable<CollectionItem> {
    return this.http
      .post<any>(`${API}/collections/${collection.id}/items`, {
        name: item.name,
        description: item.description,
        image: item.image,
        rarity: item.rarity,
        price: item.price,
      })
      .pipe(
        map((r) =>
          Object.assign(new CollectionItem(), {
            id: r.id,
            name: r.name,
            description: r.description,
            image: r.image,
            rarity: r.rarity,
            price: Number(r.price),
          }),
        ),
      );
  }

  updateItem(collection: Collection, item: CollectionItem): Observable<CollectionItem | null> {
    return this.http
      .put<any>(`${API}/collections/${collection.id}/items/${item.id}`, {
        name: item.name,
        description: item.description,
        image: item.image,
        rarity: item.rarity,
        price: item.price,
      })
      .pipe(
        map((r) => {
          if (!r) return null;
          return Object.assign(new CollectionItem(), {
            id: r.id,
            name: r.name,
            description: r.description,
            image: r.image,
            rarity: r.rarity,
            price: Number(r.price),
          });
        }),
      );
  }

  deleteItem(collectionId: number, itemId: number): Observable<void> {
    return this.http.delete<void>(`${API}/collections/${collectionId}/items/${itemId}`);
  }
}
