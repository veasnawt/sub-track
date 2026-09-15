import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

// Ensure data directory exists. On Vercel, serverless functions can only write to /tmp.
const dataDir = process.env.VERCEL
  ? path.join('/tmp', 'data')
  : path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'subscriptions.db');
export const db = new Database(dbPath);

// Enable WAL mode for better concurrency and performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      currency TEXT DEFAULT 'USD',
      theme TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      icon TEXT,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      billing_cycle TEXT NOT NULL, -- 'weekly', 'monthly', 'quarterly', 'semi_annual', 'yearly', 'lifetime'
      payment_method TEXT NOT NULL, -- 'credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer', 'crypto', 'other'
      start_date TEXT NOT NULL,
      next_billing_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'cancelled', 'trial'
      notes TEXT,
      website TEXT,
      logo TEXT,
      color TEXT DEFAULT '#4F46E5',
      reminder_days INTEGER DEFAULT 3,
      auto_renew INTEGER DEFAULT 1,
      cancellation_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS payment_history (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subscription_id TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      billing_date TEXT NOT NULL,
      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'paid',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subs_next_billing ON subscriptions(next_billing_date);
    CREATE INDEX IF NOT EXISTS idx_history_sub ON payment_history(subscription_id);
  `);

  seedDemoUser();
}

export const DEFAULT_CATEGORIES = [
  { name: 'Entertainment & Streaming', icon: 'Video', color: '#EF4444' },
  { name: 'Productivity & Work', icon: 'Document', color: '#3B82F6' },
  { name: 'Cloud & Developer Tools', icon: 'Code', color: '#10B981' },
  { name: 'Music & Audio', icon: 'Music', color: '#8B5CF6' },
  { name: 'Utilities & Software', icon: 'Settings', color: '#64748B' },
  { name: 'Health & Fitness', icon: 'Favorite', color: '#EC4899' },
  { name: 'Finance & Banking', icon: 'PieChart', color: '#F59E0B' },
  { name: 'Gaming', icon: 'Game', color: '#06B6D4' },
  { name: 'Education & Learning', icon: 'School', color: '#14B8A6' },
  { name: 'Other', icon: 'Tag', color: '#94A3B8' },
];

export function seedDemoUser() {
  const existingDemo = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@subtrack.app') as { id: string } | undefined;
  
  const demoUserId = existingDemo ? existingDemo.id : 'demo-user-id-001';

  if (!existingDemo) {
    const passwordHash = bcrypt.hashSync('demo1234', 10);
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, currency, theme)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(demoUserId, 'Alex Taylor', 'demo@subtrack.app', passwordHash, 'USD', 'system');
  }

  // Seed subscriptions if user has none
  const count = (db.prepare('SELECT COUNT(*) as count FROM subscriptions WHERE user_id = ?').get(demoUserId) as { count: number }).count;
  if (count === 0) {
    seedSubscriptionsForUser(demoUserId);
  }
}

export function seedSubscriptionsForUser(userId: string) {
  const today = new Date();
  
  const formatDate = (date: Date) => date.toISOString().split('T')[0];
  const addDays = (d: Date, days: number) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return formatDate(copy);
  };
  const subMonths = (d: Date, months: number) => {
    const copy = new Date(d);
    copy.setMonth(copy.getMonth() - months);
    return formatDate(copy);
  };

  const sampleSubscriptions = [
    {
      id: `sub-${userId}-1`,
      user_id: userId,
      name: 'Netflix Premium',
      category: 'Entertainment & Streaming',
      price: 22.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      payment_method: 'credit_card',
      start_date: subMonths(today, 14),
      next_billing_date: addDays(today, 2), // Renewing soon!
      status: 'active',
      notes: '4K Ultra HD 4-screen family plan',
      website: 'https://netflix.com',
      logo: 'https://assets.nflxext.com/ffe/siteui/common/icons/nficon2023.ico',
      color: '#E50914',
      reminder_days: 3,
      auto_renew: 1,
      cancellation_url: 'https://www.netflix.com/cancelplan',
    },
    {
      id: `sub-${userId}-2`,
      user_id: userId,
      name: 'Spotify Family',
      category: 'Music & Audio',
      price: 16.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      payment_method: 'paypal',
      start_date: subMonths(today, 24),
      next_billing_date: addDays(today, 5), // Renewing soon!
      status: 'active',
      notes: 'Shared with household members',
      website: 'https://spotify.com',
      logo: 'https://open.spotifycdn.com/cdn/images/favicon.0f31d2ea.ico',
      color: '#1DB954',
      reminder_days: 3,
      auto_renew: 1,
      cancellation_url: 'https://www.spotify.com/account/subscription/',
    },
    {
      id: `sub-${userId}-3`,
      user_id: userId,
      name: 'ChatGPT Plus',
      category: 'Productivity & Work',
      price: 20.00,
      currency: 'USD',
      billing_cycle: 'monthly',
      payment_method: 'credit_card',
      start_date: subMonths(today, 8),
      next_billing_date: addDays(today, 11),
      status: 'active',
      notes: 'GPT-4o, DALL-E, Advanced Data Analysis',
      website: 'https://chatgpt.com',
      logo: 'https://chatgpt.com/favicon.ico',
      color: '#10A37F',
      reminder_days: 2,
      auto_renew: 1,
      cancellation_url: 'https://chatgpt.com/#settings',
    },
    {
      id: `sub-${userId}-4`,
      user_id: userId,
      name: 'GitHub Copilot Individual',
      category: 'Cloud & Developer Tools',
      price: 100.00,
      currency: 'USD',
      billing_cycle: 'yearly',
      payment_method: 'credit_card',
      start_date: subMonths(today, 6),
      next_billing_date: addDays(today, 180),
      status: 'active',
      notes: 'Annual developer plan. Saves $20 compared to monthly.',
      website: 'https://github.com/features/copilot',
      logo: 'https://github.githubassets.com/favicons/favicon.png',
      color: '#24292F',
      reminder_days: 7,
      auto_renew: 1,
      cancellation_url: 'https://github.com/settings/billing',
    },
    {
      id: `sub-${userId}-5`,
      user_id: userId,
      name: 'Figma Professional',
      category: 'Productivity & Work',
      price: 15.00,
      currency: 'USD',
      billing_cycle: 'monthly',
      payment_method: 'credit_card',
      start_date: subMonths(today, 10),
      next_billing_date: addDays(today, 18),
      status: 'active',
      notes: 'UI/UX design workspace with team collaboration',
      website: 'https://figma.com',
      logo: 'https://static.figma.com/app/icon/1/favicon.ico',
      color: '#F24E1E',
      reminder_days: 3,
      auto_renew: 1,
      cancellation_url: 'https://www.figma.com/settings',
    },
    {
      id: `sub-${userId}-6`,
      user_id: userId,
      name: 'Amazon Prime',
      category: 'Entertainment & Streaming',
      price: 139.00,
      currency: 'USD',
      billing_cycle: 'yearly',
      payment_method: 'credit_card',
      start_date: subMonths(today, 11),
      next_billing_date: addDays(today, 28),
      status: 'active',
      notes: 'Free fast delivery, Prime Video, Prime Music',
      website: 'https://amazon.com',
      logo: 'https://www.amazon.com/favicon.ico',
      color: '#FF9900',
      reminder_days: 14,
      auto_renew: 1,
      cancellation_url: 'https://www.amazon.com/mc/manage',
    },
    {
      id: `sub-${userId}-7`,
      user_id: userId,
      name: 'iCloud+ 200GB',
      category: 'Utilities & Software',
      price: 2.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      payment_method: 'apple_pay',
      start_date: subMonths(today, 30),
      next_billing_date: addDays(today, 7),
      status: 'active',
      notes: 'Photos backup and iCloud Private Relay',
      website: 'https://apple.com/icloud',
      logo: 'https://www.apple.com/favicon.ico',
      color: '#0071E3',
      reminder_days: 1,
      auto_renew: 1,
      cancellation_url: 'https://support.apple.com/HT207594',
    },
    {
      id: `sub-${userId}-8`,
      user_id: userId,
      name: 'Strava Summit',
      category: 'Health & Fitness',
      price: 11.99,
      currency: 'USD',
      billing_cycle: 'monthly',
      payment_method: 'apple_pay',
      start_date: subMonths(today, 4),
      next_billing_date: addDays(today, 15),
      status: 'paused', // Demonstrates paused status
      notes: 'Paused during recovery month',
      website: 'https://strava.com',
      logo: 'https://web-assets.strava.com/favicons/favicon.ico',
      color: '#FC4C02',
      reminder_days: 3,
      auto_renew: 0,
      cancellation_url: 'https://www.strava.com/settings/subscription',
    },
    {
      id: `sub-${userId}-9`,
      user_id: userId,
      name: 'Audible Premium Plus',
      category: 'Education & Learning',
      price: 14.95,
      currency: 'USD',
      billing_cycle: 'monthly',
      payment_method: 'credit_card',
      start_date: addDays(today, -20),
      next_billing_date: addDays(today, 10),
      status: 'trial', // Free trial expiring soon!
      notes: '30-day free trial. Decide whether to keep or cancel before day 30.',
      website: 'https://audible.com',
      logo: 'https://www.audible.com/favicon.ico',
      color: '#F8991C',
      reminder_days: 3,
      auto_renew: 1,
      cancellation_url: 'https://www.audible.com/account/overview',
    },
    {
      id: `sub-${userId}-10`,
      user_id: userId,
      name: 'NordVPN 2-Year',
      category: 'Utilities & Software',
      price: 89.00,
      currency: 'USD',
      billing_cycle: 'yearly',
      payment_method: 'crypto',
      start_date: subMonths(today, 2),
      next_billing_date: addDays(today, 305),
      status: 'active',
      notes: 'VPN and Threat Protection on up to 10 devices',
      website: 'https://nordvpn.com',
      logo: 'https://nordvpn.com/favicon.ico',
      color: '#4687FF',
      reminder_days: 7,
      auto_renew: 1,
      cancellation_url: 'https://my.nordaccount.com/billing/',
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO subscriptions (
      id, user_id, name, category, price, currency, billing_cycle,
      payment_method, start_date, next_billing_date, status, notes,
      website, logo, color, reminder_days, auto_renew, cancellation_url
    ) VALUES (
      @id, @user_id, @name, @category, @price, @currency, @billing_cycle,
      @payment_method, @start_date, @next_billing_date, @status, @notes,
      @website, @logo, @color, @reminder_days, @auto_renew, @cancellation_url
    )
  `);

  const historyStmt = db.prepare(`
    INSERT INTO payment_history (id, user_id, subscription_id, amount, currency, billing_date, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
  `);

  const insertMany = db.transaction((subs) => {
    for (const sub of subs) {
      stmt.run(sub);
      // Seed an initial payment history record
      historyStmt.run(
        `hist-${sub.id}-1`,
        userId,
        sub.id,
        sub.price,
        sub.currency,
        sub.start_date,
        sub.payment_method
      );
    }
  });

  insertMany(sampleSubscriptions);
}
