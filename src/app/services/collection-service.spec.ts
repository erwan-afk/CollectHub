import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CollectionService } from './collection-service';
import { Collection } from '../models/collection';
import { CollectionItem } from '../models/collection-item';

const API = 'http://localhost:3000/api';

describe('CollectionService', () => {
  let service: CollectionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CollectionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should fetch all collections', () => {
    const mock = [{ id: 1, title: 'F1', items: [] }];
    let result: Collection[] = [];

    service.getAll().subscribe((data) => (result = data));
    const req = httpMock.expectOne(`${API}/collections`);
    req.flush(mock);

    expect(result.length).toBe(1);
    expect(result[0].title).toBe('F1');
  });

  it('should get a collection by id', () => {
    const mock = {
      id: 1,
      title: 'F1',
      items: [
        { id: 1, name: 'F2004', description: '', image: '', rarity: 'Legendary', price: 580 },
      ],
    };
    let result: Collection | null = null;

    service.get(1).subscribe((data) => (result = data));
    httpMock.expectOne(`${API}/collections/1`).flush(mock);

    expect(result).toBeTruthy();
    expect(result!.title).toBe('F1');
    expect(result!.items.length).toBe(1);
  });

  it('should add a collection', () => {
    const mock = { id: 10, title: 'New' };
    let result: Collection | null = null;

    const c = new Collection();
    c.title = 'New';
    service.add(c).subscribe((data) => (result = data));

    const req = httpMock.expectOne(`${API}/collections`);
    expect(req.request.body.title).toBe('New');
    req.flush(mock);

    expect(result!.id).toBe(10);
    expect(result!.title).toBe('New');
  });

  it('should update a collection', () => {
    const mock = { id: 1, title: 'Updated' };
    let result: Collection | null = null;

    const c = new Collection();
    c.id = 1;
    c.title = 'Updated';
    service.update(c).subscribe((data) => (result = data));

    const req = httpMock.expectOne(`${API}/collections/1`);
    expect(req.request.body.title).toBe('Updated');
    req.flush(mock);

    expect(result!.title).toBe('Updated');
  });

  it('should delete a collection', () => {
    let completed = false;
    service.delete(1).subscribe({ complete: () => (completed = true) });
    httpMock
      .expectOne(`${API}/collections/1`)
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(completed).toBe(true);
  });

  it('should add an item', () => {
    const mock = { id: 5, name: 'Test', description: '', image: '', rarity: 'Common', price: 100 };
    let result: CollectionItem | null = null;

    const c = new Collection();
    c.id = 1;
    const item = new CollectionItem();
    item.name = 'Test';
    item.rarity = 'Common';
    item.price = 100;

    service.addItem(c, item).subscribe((data) => (result = data));
    const req = httpMock.expectOne(`${API}/collections/1/items`);
    req.flush(mock);

    expect(result!.name).toBe('Test');
    expect(result!.price).toBe(100);
  });

  it('should update an item', () => {
    const mock = { id: 5, name: 'Updated', description: '', image: '', rarity: 'Rare', price: 200 };
    let result: CollectionItem | null = null;

    const c = new Collection();
    c.id = 1;
    const item = new CollectionItem();
    item.id = 5;
    item.name = 'Updated';
    item.rarity = 'Rare';
    item.price = 200;

    service.updateItem(c, item).subscribe((data) => (result = data));
    const req = httpMock.expectOne(`${API}/collections/1/items/5`);
    req.flush(mock);

    expect(result!.name).toBe('Updated');
    expect(result!.rarity).toBe('Rare');
  });

  it('should delete an item', () => {
    let completed = false;
    service.deleteItem(1, 5).subscribe({ complete: () => (completed = true) });
    httpMock
      .expectOne(`${API}/collections/1/items/5`)
      .flush(null, { status: 204, statusText: 'No Content' });
    expect(completed).toBe(true);
  });
});
