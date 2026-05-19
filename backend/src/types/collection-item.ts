export type Rarity = 'Legendary' | 'Rare' | 'Uncommon' | 'Common';

export interface CollectionItem {
  id: number;
  name: string;
  description: string;
  image: string;
  rarity: Rarity;
  price: number;
}

export interface CollectionItemRow {
  id: number;
  name: string;
  description: string;
  image: string;
  rarity: Rarity;
  price: number;
}
