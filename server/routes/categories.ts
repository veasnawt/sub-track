import { Router } from 'express';
import { db, DEFAULT_CATEGORIES } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();
router.use(authMiddleware);

router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const userCategories = db.prepare('SELECT * FROM categories WHERE user_id = ?').all(userId) as any[];

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

router.post('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const { name, icon = 'Tag', color = '#6366F1' } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'Category name is required' });
  }

  const catId = `cat-${crypto.randomUUID()}`;
  db.prepare(`
    INSERT INTO categories (id, user_id, name, icon, color)
    VALUES (?, ?, ?, ?, ?)
  `).run(catId, userId, name.trim(), icon, color);

  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(catId);

  return res.status(201).json({
    success: true,
    data: created,
  });
});

export default router;
