import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db, seedSubscriptionsForUser } from '../db';
import { authMiddleware, AuthenticatedRequest, JWT_SECRET } from '../middleware/auth';

const router = Router();

const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  currency: z.string().default('USD'),
  seedSamples: z.boolean().optional().default(true),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', (req, res) => {
  try {
    const result = RegisterSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error.issues[0].message,
      });
    }

    const { name, email, password, currency, seedSamples } = result.data;
    const normalizedEmail = email.toLowerCase().trim();

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email already exists',
      });
    }

    const userId = (crypto && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, currency)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, name.trim(), normalizedEmail, passwordHash, currency.toUpperCase());

    if (seedSamples) {
      try {
        seedSubscriptionsForUser(userId);
      } catch (seedErr) {
        console.warn('Sample subscription seeding non-fatal error:', seedErr);
      }
    }

    const userPayload = {
      userId,
      name: name.trim(),
      email: normalizedEmail,
      currency: currency.toUpperCase(),
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });

    return res.status(201).json({
      success: true,
      token,
      user: userPayload,
    });
  } catch (err: any) {
    console.error('Registration unhandled error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Registration failed. Please try again.',
    });
  }
});

router.post('/login', (req, res) => {
  try {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error.issues[0].message,
      });
    }

    const { email, password } = result.data;
    const normalizedEmail = email.toLowerCase().trim();

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail) as any;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    const userPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency || 'USD',
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      success: true,
      token,
      user: userPayload,
    });
  } catch (err: any) {
    console.error('Login unhandled error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Login failed. Please try again.',
    });
  }
});

router.post('/demo', (req, res) => {
  try {
    const demoEmail = 'demo@subtrack.app';
    let demoUser = db.prepare('SELECT * FROM users WHERE email = ?').get(demoEmail) as any;

    if (!demoUser) {
      const demoUserId = 'demo-user-id-001';
      const passwordHash = bcrypt.hashSync('demo1234', 10);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, currency, theme)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(demoUserId, 'Alex Taylor', demoEmail, passwordHash, 'USD', 'system');
      try {
        seedSubscriptionsForUser(demoUserId);
      } catch (seedErr) {
        console.warn('Demo subscription seeding non-fatal error:', seedErr);
      }
      demoUser = {
        id: demoUserId,
        name: 'Alex Taylor',
        email: demoEmail,
        currency: 'USD',
      };
    }

    const userPayload = {
      userId: demoUser.id,
      name: demoUser.name,
      email: demoUser.email,
      currency: demoUser.currency || 'USD',
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });

    return res.json({
      success: true,
      token,
      user: userPayload,
    });
  } catch (err: any) {
    console.error('Demo auth unhandled error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Demo login failed. Please try again.',
    });
  }
});

router.get('/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  const user = db.prepare('SELECT id, name, email, currency, theme, created_at FROM users WHERE id = ?').get(req.user!.userId) as any;
  if (!user) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }

  return res.json({
    success: true,
    user: {
      userId: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency,
      theme: user.theme,
      createdAt: user.created_at,
    },
  });
});

router.put('/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    currency: z.string().length(3).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
  });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }

  const { name, currency, theme } = result.data;
  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name.trim());
  }
  if (currency !== undefined) {
    updates.push('currency = ?');
    values.push(currency.toUpperCase());
  }
  if (theme !== undefined) {
    updates.push('theme = ?');
    values.push(theme);
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user!.userId);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  }

  const updatedUser = db.prepare('SELECT id, name, email, currency, theme FROM users WHERE id = ?').get(req.user!.userId) as any;

  return res.json({
    success: true,
    user: {
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      currency: updatedUser.currency,
      theme: updatedUser.theme,
    },
  });
});

export default router;
