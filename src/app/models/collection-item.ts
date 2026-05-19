export const Rarities = {
  Legendary: 'Legendary',
  Rare: 'Rare',
  Uncommon: 'Uncommon',
  Common: 'Common',
} as const;
export type Rarity = (typeof Rarities)[keyof typeof Rarities];

export class CollectionItem {
  id = -1;
  name = '';
  description = '';
  image = '';
  rarity: Rarity = 'Legendary';
  price = 0;

  copy(): CollectionItem {
    return Object.assign(new CollectionItem(), this);
  }
}
