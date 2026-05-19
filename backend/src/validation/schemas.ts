import { z } from 'zod';

export const CollectionBodySchema = z.object({
  title: z.string().trim().min(1, 'title is required').max(255),
});

export const ItemBodySchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(255),
  description: z.string().trim().max(2000).default(''),
  rarity: z.enum(['Legendary', 'Rare', 'Uncommon', 'Common']).default('Legendary'),
  price: z.coerce.number().nonnegative('price must be >= 0').finite(),
  image: z.string().max(512).default(''),
});

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive('id must be a positive integer'),
});

export const ItemParamSchema = z.object({
  collectionId: z.coerce.number().int().positive('collectionId must be a positive integer'),
  itemId: z.coerce.number().int().positive('itemId must be a positive integer'),
});

export const ReorderBodySchema = z.object({
  itemIds: z.array(z.number().int().positive()).min(1),
});
