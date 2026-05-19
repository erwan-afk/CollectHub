import { Router } from 'express';
import { pool } from '../db/database';
import { logger } from '../config/logger';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Health check failed', { error: err });
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

export default router;
