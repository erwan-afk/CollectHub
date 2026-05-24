import { Router, Request, Response, NextFunction } from 'express';
import * as queries from '../db/queries';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { CollectionBodySchema, IdParamSchema, PaginationSchema } from '../validation/schemas';

const router = Router();

// Toutes les routes nécessitent un JWT valide (principe zero-trust).
// Pas de scopeToOrg ici : la table collections est un héritage du
// prototype Collection Manager et n'a pas de colonne organization_id.
router.use(requireAuth);

router.get(
  '/',
  validate(PaginationSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { limit, offset } = req.query as unknown as { limit: number; offset: number };
      const [data, total] = await Promise.all([
        queries.getAllCollections(limit, offset),
        queries.getCollectionsCount(),
      ]);
      res.json({ data, total, limit, offset });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/:id',
  validate(IdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const collection = await queries.getCollectionById(id);
      if (!collection) {
        res.status(404).json({ error: 'Collection not found' });
        return;
      }
      res.json(collection);
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  validate(CollectionBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title } = req.body as { title: string };
      const collection = await queries.createCollection(title);
      res.status(201).json(collection);
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/:id',
  validate(IdParamSchema, 'params'),
  validate(CollectionBodySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const { title } = req.body as { title: string };
      const collection = await queries.updateCollection(id, title);
      if (!collection) {
        res.status(404).json({ error: 'Collection not found' });
        return;
      }
      res.json(collection);
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  validate(IdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as unknown as { id: number };
      const deleted = await queries.deleteCollection(id);
      if (!deleted) {
        res.status(404).json({ error: 'Collection not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
