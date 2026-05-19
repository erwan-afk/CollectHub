import { CollectionItem } from './collection-item';

export class Collection {
  id = -1;
  title: string = 'My Collection';
  items: CollectionItem[] = [];

  copy(): Collection {
    const copy = Object.assign(new Collection(), this);
    copy.items = this.items.map((item) => item.copy());
    return copy;
  }
}
