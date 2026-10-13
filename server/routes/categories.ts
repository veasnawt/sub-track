import { Router } from 'express';
import { db } from '../db';
import { DEFAULT_CATEGORIES } from '../../src/lib/categories';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const userCategories = await db.prepare('SELECT * FROM public.subtrack_categories WHERE user_id = ?').all(userId) as any[];

  // Merge default categories with user categories
  const allCategories = [
    ...DEFAULT_CATEGORIES.map(c => ({ id: `sys-${c.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`, ...c, is_system: true })),
    ...userCategories.map(c => ({ ...c, is_system: false })),
  ];

  return res.json({
    success: true,
    data: allCategories,
  });
});

router.post('/', async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const { name, icon = 'Tag', color = '#6366F1' } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Category name is required' });
  }

  const catId = `cat-${crypto.randomUUID()}`;
  await db.prepare(`
    INSERT INTO public.subtrack_categories (id, user_id, name, icon, color)
    VALUES (?, ?, ?, ?, ?)
  `).run(catId, userId, name.trim(), icon, color);

  const created = await db.prepare('SELECT * FROM public.subtrack_categories WHERE id = ?').get(catId);

  return res.status(201).json({
    success: true,
    data: created,
  });
});

export default router;
