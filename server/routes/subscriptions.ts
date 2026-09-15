import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { db, seedSubscriptionsForUser } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { calculateMonthlyEquivalent, calculateYearlyEquivalent } from '../currency';

const router = Router();
router.use(authMiddleware);

const SubscriptionSchema = z.object({
  name: z.string().min(1, 'Service name is required'),
  category: z.string().min(1, 'Category is required'),
  price: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val) : val),
    z.number().positive('Price must be greater than 0')
  ),
  currency: z.string().default('USD'),
  billing_cycle: z.enum(['weekly', 'monthly', 'quarterly', 'semi_annual', 'yearly', 'lifetime']),
  payment_method: z.string().default('credit_card'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
  next_billing_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Next billing date must be YYYY-MM-DD'),
  status: z.enum(['active', 'paused', 'cancelled', 'trial']).default('active'),
  notes: z.string().optional().default(''),
  website: z.string().optional().default(''),
  logo: z.string().optional().default(''),
  color: z.string().optional().default('#4F46E5'),
  reminder_days: z.preprocess(
    (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
    z.number().int().min(0).max(90).default(3)
  ),
  auto_renew: z.preprocess(
    (val) => (typeof val === 'boolean' ? (val ? 1 : 0) : typeof val === 'string' ? (val === 'true' || val === '1' ? 1 : 0) : typeof val === 'number' ? val : 1),
    z.number().int().min(0).max(1).default(1)
  ),
  cancellation_url: z.string().optional().default(''),
});

function calculateDaysDifference(targetDateStr: string): number {
  const target = new Date(targetDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function advanceBillingDate(currentDateStr: string, cycle: string): string {
  const date = new Date(currentDateStr + 'T00:00:00');
  switch (cycle.toLowerCase()) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'semi_annual':
      date.setMonth(date.getMonth() + 6);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    case 'lifetime':
      // no advance
      break;
    default:
      date.setMonth(date.getMonth() + 1);
      break;
  }
  return date.toISOString().split('T')[0];
}

// GET /api/subscriptions
router.get('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const userCurrency = req.user!.currency || 'USD';
  const { search, category, status, billing_cycle, payment_method, sort_by = 'next_billing_date', sort_order = 'asc' } = req.query;

  let query = `SELECT * FROM subscriptions WHERE user_id = ?`;
  const params: any[] = [userId];

  if (search && typeof search === 'string' && search.trim() !== '') {
    query += ` AND (name LIKE ? OR notes LIKE ? OR website LIKE ?)`;
    const searchPattern = `%${search.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (category && typeof category === 'string' && category !== 'all') {
    query += ` AND category = ?`;
    params.push(category);
  }

  if (status && typeof status === 'string' && status !== 'all') {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (billing_cycle && typeof billing_cycle === 'string' && billing_cycle !== 'all') {
    query += ` AND billing_cycle = ?`;
    params.push(billing_cycle);
  }

  if (payment_method && typeof payment_method === 'string' && payment_method !== 'all') {
    query += ` AND payment_method = ?`;
    params.push(payment_method);
  }

  const validSortCols: Record<string, string> = {
    next_billing_date: 'next_billing_date',
    price: 'price',
    name: 'name',
    start_date: 'start_date',
    created_at: 'created_at',
  };
  const sortCol = validSortCols[sort_by as string] || 'next_billing_date';
  const direction = (sort_order as string).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  query += ` ORDER BY ${sortCol} ${direction}`;

  const rows = db.prepare(query).all(...params) as any[];

  const subscriptions = rows.map((sub) => {
    const daysUntil = calculateDaysDifference(sub.next_billing_date);
    const monthlyEq = calculateMonthlyEquivalent(sub.price, sub.billing_cycle, sub.currency, userCurrency);
    const yearlyEq = calculateYearlyEquivalent(sub.price, sub.billing_cycle, sub.currency, userCurrency);

    return {
      ...sub,
      auto_renew: Boolean(sub.auto_renew),
      days_until_renewal: daysUntil,
      is_renewing_soon: sub.status === 'active' && daysUntil >= 0 && daysUntil <= (sub.reminder_days || 7),
      is_overdue: sub.status === 'active' && daysUntil < 0,
      monthly_equivalent: monthlyEq,
      yearly_equivalent: yearlyEq,
    };
  });

  return res.json({
    success: true,
    data: subscriptions,
    count: subscriptions.length,
  });
});

// GET /api/subscriptions/:id
router.get('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?').get(req.params.id, userId) as any;

  if (!sub) {
    return res.status(404).json({ success: false, error: 'Subscription not found' });
  }

  const history = db.prepare('SELECT * FROM payment_history WHERE subscription_id = ? ORDER BY billing_date DESC').all(sub.id);

  return res.json({
    success: true,
    data: {
      ...sub,
      auto_renew: Boolean(sub.auto_renew),
      history,
    },
  });
});

// POST /api/subscriptions
router.post('/', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const parseResult = SubscriptionSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: parseResult.error.issues[0].message,
    });
  }

  const data = parseResult.data;
  const subId = `sub-${crypto.randomUUID()}`;

  db.prepare(`
    INSERT INTO subscriptions (
      id, user_id, name, category, price, currency, billing_cycle,
      payment_method, start_date, next_billing_date, status, notes,
      website, logo, color, reminder_days, auto_renew, cancellation_url
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `).run(
    subId,
    userId,
    data.name.trim(),
    data.category,
    data.price,
    data.currency.toUpperCase(),
    data.billing_cycle,
    data.payment_method,
    data.start_date,
    data.next_billing_date,
    data.status,
    data.notes || '',
    data.website || '',
    data.logo || '',
    data.color || '#4F46E5',
    data.reminder_days,
    data.auto_renew,
    data.cancellation_url || ''
  );

  // Add initial payment history entry
  db.prepare(`
    INSERT INTO payment_history (id, user_id, subscription_id, amount, currency, billing_date, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
  `).run(
    `hist-${crypto.randomUUID()}`,
    userId,
    subId,
    data.price,
    data.currency.toUpperCase(),
    data.start_date,
    data.payment_method
  );

  const created = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);

  return res.status(201).json({
    success: true,
    data: created,
    message: 'Subscription added successfully',
  });
});

// PUT /api/subscriptions/:id
router.put('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const subId = req.params.id;

  const existing = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?').get(subId, userId);
  if (!existing) {
    return res.status(404).json({ success: false, error: 'Subscription not found' });
  }

  const parseResult = SubscriptionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: parseResult.error.issues[0].message,
    });
  }

  const data = parseResult.data;

  db.prepare(`
    UPDATE subscriptions SET
      name = ?,
      category = ?,
      price = ?,
      currency = ?,
      billing_cycle = ?,
      payment_method = ?,
      start_date = ?,
      next_billing_date = ?,
      status = ?,
      notes = ?,
      website = ?,
      logo = ?,
      color = ?,
      reminder_days = ?,
      auto_renew = ?,
      cancellation_url = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    data.name.trim(),
    data.category,
    data.price,
    data.currency.toUpperCase(),
    data.billing_cycle,
    data.payment_method,
    data.start_date,
    data.next_billing_date,
    data.status,
    data.notes || '',
    data.website || '',
    data.logo || '',
    data.color || '#4F46E5',
    data.reminder_days,
    data.auto_renew,
    data.cancellation_url || '',
    subId,
    userId
  );

  const updated = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);

  return res.json({
    success: true,
    data: updated,
    message: 'Subscription updated successfully',
  });
});

// DELETE /api/subscriptions/:id
router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const subId = req.params.id;

  const result = db.prepare('DELETE FROM subscriptions WHERE id = ? AND user_id = ?').run(subId, userId);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'Subscription not found' });
  }

  return res.json({
    success: true,
    message: 'Subscription removed successfully',
  });
});

// POST /api/subscriptions/:id/renew - Marks as paid/renewed and advances billing date!
router.post('/:id/renew', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const subId = req.params.id;

  const sub = db.prepare('SELECT * FROM subscriptions WHERE id = ? AND user_id = ?').get(subId, userId) as any;
  if (!sub) {
    return res.status(404).json({ success: false, error: 'Subscription not found' });
  }

  const nextBilling = advanceBillingDate(sub.next_billing_date, sub.billing_cycle);

  // Record payment in payment_history
  db.prepare(`
    INSERT INTO payment_history (id, user_id, subscription_id, amount, currency, billing_date, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
  `).run(
    `hist-${crypto.randomUUID()}`,
    userId,
    subId,
    sub.price,
    sub.currency,
    sub.next_billing_date,
    sub.payment_method
  );

  // Update next billing date and ensure status is active
  db.prepare(`
    UPDATE subscriptions SET
      next_billing_date = ?,
      status = 'active',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextBilling, subId);

  const updated = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);

  return res.json({
    success: true,
    data: updated,
    message: `Renewed successfully! Next billing scheduled for ${nextBilling}`,
  });
});

// POST /api/subscriptions/:id/toggle-status
router.post('/:id/toggle-status', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const subId = req.params.id;
  const { status } = req.body;

  const validStatuses = ['active', 'paused', 'cancelled', 'trial'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }

  const result = db.prepare(`
    UPDATE subscriptions SET
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(status, subId, userId);

  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: 'Subscription not found' });
  }

  const updated = db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId);

  return res.json({
    success: true,
    data: updated,
    message: `Subscription status set to ${status}`,
  });
});

// POST /api/subscriptions/reset-seed
router.post('/reset-seed', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId);
  seedSubscriptionsForUser(userId);

  return res.json({
    success: true,
    message: 'Sample subscriptions re-seeded successfully',
  });
});

// POST /api/subscriptions/import (CSV / JSON bulk import)
router.post('/import', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const { subscriptions: items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'No subscriptions provided for import' });
  }

  let importedCount = 0;
  const insertStmt = db.prepare(`
    INSERT INTO subscriptions (
      id, user_id, name, category, price, currency, billing_cycle,
      payment_method, start_date, next_billing_date, status, notes,
      website, logo, color, reminder_days, auto_renew, cancellation_url
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  const tx = db.transaction((subs: any[]) => {
    for (const item of subs) {
      if (!item.name || !item.price) continue;
      const subId = `sub-${crypto.randomUUID()}`;
      insertStmt.run(
        subId,
        userId,
        String(item.name).trim(),
        item.category || 'Other',
        Number(item.price) || 0,
        (item.currency || 'USD').toUpperCase(),
        item.billing_cycle || 'monthly',
        item.payment_method || 'credit_card',
        item.start_date || new Date().toISOString().split('T')[0],
        item.next_billing_date || new Date().toISOString().split('T')[0],
        item.status || 'active',
        item.notes || '',
        item.website || '',
        item.logo || '',
        item.color || '#4F46E5',
        Number(item.reminder_days) || 3,
        item.auto_renew !== undefined ? Number(Boolean(item.auto_renew)) : 1,
        item.cancellation_url || ''
      );
      importedCount++;
    }
  });

  tx(items);

  return res.json({
    success: true,
    importedCount,
    message: `Successfully imported ${importedCount} subscription(s)`,
  });
});

export default router;
