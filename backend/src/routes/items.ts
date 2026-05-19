import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as queries from '../db/queries';
import { upload } from '../middleware/upload';
import { uploadLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { ItemBodySchema, ItemParamSchema } from '../validation/schemas';

const router = Router({ mergeParams: true });

router.post('/', validate(ItemBodySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionId = Number(req.params['collectionId']);
    const { name, description, rarity, price, image } = req.body as {
      name: string; description: string; rarity: 'Legendary' | 'Rare' | 'Uncommon' | 'Common'; price: number; image: string;
    };
    const item = await queries.createItem(collectionId, { name, description, image, rarity, price });
    if (!item) { res.status(404).json({ error: 'Collection not found' }); return; }
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.put('/:itemId', validate(ItemParamSchema, 'params'), validate(ItemBodySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionId = Number(req.params['collectionId']);
    const itemId = Number(req.params['itemId']);
    const { name, description, image, rarity, price } = req.body as {
      name: string; description: string; image: string; rarity: 'Legendary' | 'Rare' | 'Uncommon' | 'Common'; price: number;
    };
    const item = await queries.updateItem(collectionId, itemId, { name, description, image, rarity, price });
    if (!item) { res.status(404).json({ error: 'Item not found' }); return; }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete('/:itemId', validate(ItemParamSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const collectionId = Number(req.params['collectionId']);
    const itemId = Number(req.params['itemId']);
    const deleted = await queries.deleteItem(collectionId, itemId);
    if (!deleted) { res.status(404).json({ error: 'Item not found' }); return; }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.post(
  '/:itemId/image',
  uploadLimiter,
  upload.single('image'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const collectionId = Number(req.params['collectionId']);
      const itemId = Number(req.params['itemId']);

      if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

      const existing = await queries.getCollectionById(collectionId);
      const item = existing?.items.find((i) => i.id === itemId);
      if (!item) { res.status(404).json({ error: 'Item not found' }); return; }

      const updated = await queries.updateItem(collectionId, itemId, {
        ...item,
        image: `img/${req.file.filename}`,
      });
      res.json(updated);
    } catch (err) {
      if (err instanceof multer.MulterError) {
        res.status(400).json({ error: err.message });
        return;
      }
      next(err);
    }
  },
);

export default router;
