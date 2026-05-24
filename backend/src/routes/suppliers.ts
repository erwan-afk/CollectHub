import { Router, Request, Response, NextFunction } from 'express';
import * as q from '../db/invoice-queries';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { scopeToOrg } from '../middleware/scope-to-org';
import { SupplierBodySchema, SupplierIdParamSchema } from '../validation/invoice-schemas';
import { PaginationSchema } from '../validation/schemas';

const router = Router();
router.use(requireAuth, scopeToOrg);

router.get('/', validate(PaginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = res.locals.orgId as number;
    const { limit, offset } = req.query as unknown as { limit: number; offset: number };
    const [data, total] = await Promise.all([
      q.listSuppliers(orgId, limit, offset),
      q.countSuppliers(orgId),
    ]);
    res.json({ data, total, limit, offset });
  } catch (err) { next(err); }
});

router.get('/:id', validate(SupplierIdParamSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = res.locals.orgId as number;
    const { id } = req.params as unknown as { id: number };
    const supplier = await q.getSupplierById(id, orgId);
    if (!supplier) { res.status(404).json({ error: 'Supplier not found' }); return; }
    res.json(supplier);
  } catch (err) { next(err); }
});

router.post('/', validate(SupplierBodySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = res.locals.orgId as number;
    const supplier = await q.createSupplier(orgId, req.body);
    res.status(201).json(supplier);
  } catch (err) { next(err); }
});

router.put('/:id', validate(SupplierIdParamSchema, 'params'), validate(SupplierBodySchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = res.locals.orgId as number;
    const { id } = req.params as unknown as { id: number };
    const supplier = await q.updateSupplier(id, orgId, req.body);
    if (!supplier) { res.status(404).json({ error: 'Supplier not found' }); return; }
    res.json(supplier);
  } catch (err) { next(err); }
});

router.delete('/:id', validate(SupplierIdParamSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = res.locals.orgId as number;
    const { id } = req.params as unknown as { id: number };
    const deleted = await q.deleteSupplier(id, orgId);
    if (!deleted) { res.status(404).json({ error: 'Supplier not found' }); return; }
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
