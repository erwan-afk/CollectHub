import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { scopeToOrg } from '../middleware/scope-to-org';
import { db } from '../db/database';
import { webhooks, webhookDeliveries } from '../db/schema';
import { AppError } from '../errors/AppError';

const router = Router();
router.use(requireAuth, scopeToOrg);

// ─── Schemas ──────────────────────────────────────────────────────────────────

const WebhookCreateSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).min(1),
});

const WebhookUpdateSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

// ─── GET /webhooks ────────────────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = res.locals.orgId as number;
    const rows = await db.select().from(webhooks).where(eq(webhooks.orgId, orgId));
    // Ne jamais exposer le secret dans la réponse
    res.json(rows.map(({ secret: _s, ...w }) => w));
  } catch (err) {
    next(err);
  }
});

// ─── POST /webhooks ───────────────────────────────────────────────────────────

router.post(
  '/',
  validate(WebhookCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const { url, events } = req.body as z.infer<typeof WebhookCreateSchema>;
      const secret = crypto.randomBytes(32).toString('hex');

      const [hook] = await db
        .insert(webhooks)
        .values({ orgId, url, secret, events })
        .returning();

      res.status(201).json({ ...hook, secret }); // secret renvoyé une seule fois à la création
    } catch (err) {
      next(err);
    }
  },
);

// ─── PATCH /webhooks/:id ──────────────────────────────────────────────────────

router.patch(
  '/:id',
  validate(IdParamSchema, 'params'),
  validate(WebhookUpdateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const id = (req.params as unknown as { id: number }).id;
      const body = req.body as z.infer<typeof WebhookUpdateSchema>;

      const updates: Partial<typeof webhooks.$inferInsert> = {};
      if (body.url !== undefined) updates.url = body.url;
      if (body.events !== undefined) updates.events = body.events;
      if (body.active !== undefined) updates.active = body.active ? 1 : 0;

      const [updated] = await db
        .update(webhooks)
        .set(updates)
        .where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)))
        .returning();

      if (!updated) throw new AppError(404, 'Webhook not found');
      const { secret: _s, ...safe } = updated;
      res.json(safe);
    } catch (err) {
      next(err);
    }
  },
);

// ─── DELETE /webhooks/:id ─────────────────────────────────────────────────────

router.delete(
  '/:id',
  validate(IdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const id = (req.params as unknown as { id: number }).id;

      const [deleted] = await db
        .delete(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)))
        .returning({ id: webhooks.id });

      if (!deleted) throw new AppError(404, 'Webhook not found');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /webhooks/:id/deliveries ─────────────────────────────────────────────

router.get(
  '/:id/deliveries',
  validate(IdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals.orgId as number;
      const id = (req.params as unknown as { id: number }).id;

      // Vérifie que le webhook appartient à l'org
      const [hook] = await db
        .select({ id: webhooks.id })
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.orgId, orgId)))
        .limit(1);

      if (!hook) throw new AppError(404, 'Webhook not found');

      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, id));

      res.json(deliveries);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
