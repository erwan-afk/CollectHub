import { CollectionItem, CollectionItemRow } from './collection-item';

export interface Collection {
  id: number;
  title: string;
  items: CollectionItem[];
}

export interface CollectionRow {
  id: number;
  title: string;
  items: CollectionItemRow[] | null;
}
