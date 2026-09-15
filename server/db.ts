import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

interface Store {
  users: any[];
  categories: any[];
  subscriptions: any[];
  payment_history: any[];
}

export function createUniversalJsDb(storageFile?: string) {
  const store: Store = {
    users: [],
    categories: [],
    subscriptions: [],
    payment_history: [],
  };

  function save() {
    if (storageFile) {
      try {
        fs.writeFileSync(storageFile, JSON.stringify(store, null, 2), 'utf8');
      } catch (e) {}
    }
  }

  function load() {
    if (storageFile && fs.existsSync(storageFile)) {
      try {
        const raw = fs.readFileSync(storageFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.users) store.users = parsed.users;
        if (parsed.categories) store.categories = parsed.categories;
        if (parsed.subscriptions) store.subscriptions = parsed.subscriptions;
        if (parsed.payment_history) store.payment_history = parsed.payment_history;
      } catch (e) {}
    }
  }

  load();

  return {
    pragma: () => {},
    exec: () => {},
    transaction: (fn: any) => (...args: any[]) => fn(...args),
    prepare: (sql: string) => {
      const cleanSql = sql.trim().replace(/\s+/g, ' ');

      return {
        get: (...params: any[]) => {
          const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;

          if (cleanSql.includes('FROM users WHERE email = ?')) {
            const email = String(args[0]).toLowerCase().trim();
            const user = store.users.find(u => u.email.toLowerCase().trim() === email);
            if (!user) return undefined;
            if (cleanSql.includes('SELECT id FROM users')) return { id: user.id };
            return { ...user };
          }

          if (cleanSql.includes('FROM users WHERE id = ?')) {
            const id = args[0];
            const user = store.users.find(u => u.id === id);
            return user ? { ...user } : undefined;
          }

          if (cleanSql.includes('COUNT(*) as count FROM subscriptions WHERE user_id = ?')) {
            const userId = args[0];
            const count = store.subscriptions.filter(s => s.user_id === userId).length;
            return { count };
          }

          if (cleanSql.includes('FROM subscriptions WHERE id = ? AND user_id = ?')) {
            const [id, userId] = args;
            const sub = store.subscriptions.find(s => s.id === id && s.user_id === userId);
            return sub ? { ...sub } : undefined;
          }

          if (cleanSql.includes('FROM subscriptions WHERE id = ?')) {
            const id = args[0];
            const sub = store.subscriptions.find(s => s.id === id);
            return sub ? { ...sub } : undefined;
          }

          if (cleanSql.includes('FROM categories WHERE id = ?')) {
            const id = args[0];
            const cat = store.categories.find(c => c.id === id);
            return cat ? { ...cat } : undefined;
          }

          return undefined;
        },

        all: (...params: any[]) => {
          const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;

          if (cleanSql.includes('FROM payment_history WHERE subscription_id = ?')) {
            const subId = args[0];
            return store.payment_history
              .filter(p => p.subscription_id === subId)
              .sort((a, b) => new Date(b.billing_date).getTime() - new Date(a.billing_date).getTime());
          }

          if (cleanSql.includes('FROM categories WHERE user_id = ?')) {
            const userId = args[0];
            return store.categories.filter(c => c.user_id === userId);
          }

          if (cleanSql.includes('FROM subscriptions WHERE user_id = ?')) {
            const userId = args[0];
            let list = store.subscriptions.filter(s => s.user_id === userId);

            let paramIdx = 1;
            if (cleanSql.includes('(name LIKE ? OR notes LIKE ? OR website LIKE ?)')) {
              const term = String(args[paramIdx]).replace(/%/g, '').toLowerCase();
              paramIdx += 3;
              list = list.filter(s =>
                s.name.toLowerCase().includes(term) ||
                (s.notes || '').toLowerCase().includes(term) ||
                (s.website || '').toLowerCase().includes(term)
              );
            }

            if (cleanSql.includes('AND category = ?')) {
              const cat = args[paramIdx++];
              list = list.filter(s => s.category === cat);
            }

            if (cleanSql.includes('AND status = ?')) {
              const stat = args[paramIdx++];
              list = list.filter(s => s.status === stat);
            }

            if (cleanSql.includes('AND billing_cycle = ?')) {
              const cycle = args[paramIdx++];
              list = list.filter(s => s.billing_cycle === cycle);
            }

            if (cleanSql.includes('AND payment_method = ?')) {
              const pm = args[paramIdx++];
              list = list.filter(s => s.payment_method === pm);
            }

            const isDesc = cleanSql.includes('DESC');
            if (cleanSql.includes('ORDER BY price')) {
              list.sort((a, b) => (isDesc ? b.price - a.price : a.price - b.price));
            } else if (cleanSql.includes('ORDER BY name')) {
              list.sort((a, b) => (isDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)));
            } else if (cleanSql.includes('ORDER BY start_date')) {
              list.sort((a, b) => {
                const diff = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
                return isDesc ? -diff : diff;
              });
            } else {
              list.sort((a, b) => {
                const diff = new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime();
                return isDesc ? -diff : diff;
              });
            }

            return list.map(s => ({ ...s }));
          }

          return [];
        },

        run: (...params: any[]) => {
          let changes = 0;

          if (cleanSql.includes('INSERT INTO users')) {
            const [id, name, email, password_hash, currency, theme = 'system'] = params;
            store.users.push({
              id,
              name,
              email: email.toLowerCase().trim(),
              password_hash,
              currency,
              theme,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
            changes = 1;
            save();
            return { changes };
          }

          if (cleanSql.includes('UPDATE users SET')) {
            const userId = params[params.length - 1];
            const user = store.users.find(u => u.id === userId);
            if (user) {
              if (cleanSql.includes('name = ?')) {
                const nameIdx = cleanSql.split('?').findIndex(part => part.includes('name ='));
                if (nameIdx >= 0) user.name = params[nameIdx];
              }
              if (cleanSql.includes('currency = ?')) {
                const currIdx = cleanSql.split('?').findIndex(part => part.includes('currency ='));
                if (currIdx >= 0) user.currency = params[currIdx];
              }
              if (cleanSql.includes('theme = ?')) {
                const themeIdx = cleanSql.split('?').findIndex(part => part.includes('theme ='));
                if (themeIdx >= 0) user.theme = params[themeIdx];
              }
              user.updated_at = new Date().toISOString();
              changes = 1;
              save();
            }
            return { changes };
          }

          if (cleanSql.includes('INSERT INTO subscriptions')) {
            if (params.length === 1 && typeof params[0] === 'object') {
              const obj = params[0];
              const record = {
                id: obj.id || obj['@id'],
                user_id: obj.user_id || obj['@user_id'],
                name: obj.name || obj['@name'],
                category: obj.category || obj['@category'],
                price: Number(obj.price ?? obj['@price']),
                currency: obj.currency || obj['@currency'] || 'USD',
                billing_cycle: obj.billing_cycle || obj['@billing_cycle'],
                payment_method: obj.payment_method || obj['@payment_method'],
                start_date: obj.start_date || obj['@start_date'],
                next_billing_date: obj.next_billing_date || obj['@next_billing_date'],
                status: obj.status || obj['@status'] || 'active',
                notes: obj.notes || obj['@notes'] || '',
                website: obj.website || obj['@website'] || '',
                logo: obj.logo || obj['@logo'] || '',
                color: obj.color || obj['@color'] || '#4F46E5',
                reminder_days: Number(obj.reminder_days ?? obj['@reminder_days'] ?? 3),
                auto_renew: Number(obj.auto_renew ?? obj['@auto_renew'] ?? 1),
                cancellation_url: obj.cancellation_url || obj['@cancellation_url'] || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              store.subscriptions.push(record);
              changes = 1;
              save();
              return { changes };
            } else {
              const [
                id, user_id, name, category, price, currency, billing_cycle,
                payment_method, start_date, next_billing_date, status, notes,
                website, logo, color, reminder_days, auto_renew, cancellation_url
              ] = params;

              store.subscriptions.push({
                id,
                user_id,
                name,
                category,
                price: Number(price),
                currency,
                billing_cycle,
                payment_method,
                start_date,
                next_billing_date,
                status,
                notes: notes || '',
                website: website || '',
                logo: logo || '',
                color: color || '#4F46E5',
                reminder_days: Number(reminder_days ?? 3),
                auto_renew: Number(auto_renew ?? 1),
                cancellation_url: cancellation_url || '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
              changes = 1;
              save();
              return { changes };
            }
          }

          if (cleanSql.includes('UPDATE subscriptions SET')) {
            if (cleanSql.includes('next_billing_date = ?, status = \'active\'')) {
              const [nextBilling, subId] = params;
              const sub = store.subscriptions.find(s => s.id === subId);
              if (sub) {
                sub.next_billing_date = nextBilling;
                sub.status = 'active';
                sub.updated_at = new Date().toISOString();
                changes = 1;
                save();
              }
              return { changes };
            }

            if (cleanSql.includes('status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')) {
              const [status, subId, userId] = params;
              const sub = store.subscriptions.find(s => s.id === subId && s.user_id === userId);
              if (sub) {
                sub.status = status;
                sub.updated_at = new Date().toISOString();
                changes = 1;
                save();
              }
              return { changes };
            }

            const subId = params[params.length - 2];
            const userId = params[params.length - 1];
            const sub = store.subscriptions.find(s => s.id === subId && s.user_id === userId);
            if (sub) {
              const [
                name, category, price, currency, billing_cycle,
                payment_method, start_date, next_billing_date, status,
                notes, website, logo, color, reminder_days, auto_renew, cancellation_url
              ] = params;

              Object.assign(sub, {
                name,
                category,
                price: Number(price),
                currency,
                billing_cycle,
                payment_method,
                start_date,
                next_billing_date,
                status,
                notes: notes || '',
                website: website || '',
                logo: logo || '',
                color: color || '#4F46E5',
                reminder_days: Number(reminder_days ?? 3),
                auto_renew: Number(auto_renew ?? 1),
                cancellation_url: cancellation_url || '',
                updated_at: new Date().toISOString(),
              });
              changes = 1;
              save();
            }
            return { changes };
          }

          if (cleanSql.includes('DELETE FROM subscriptions WHERE id = ? AND user_id = ?')) {
            const [subId, userId] = params;
            const before = store.subscriptions.length;
            store.subscriptions = store.subscriptions.filter(s => !(s.id === subId && s.user_id === userId));
            store.payment_history = store.payment_history.filter(p => p.subscription_id !== subId);
            changes = before - store.subscriptions.length;
            save();
            return { changes };
          }

          if (cleanSql.includes('DELETE FROM subscriptions WHERE user_id = ?')) {
            const userId = params[0];
            const before = store.subscriptions.length;
            store.subscriptions = store.subscriptions.filter(s => s.user_id !== userId);
            changes = before - store.subscriptions.length;
            save();
            return { changes };
          }

          if (cleanSql.includes('INSERT INTO payment_history')) {
            const [id, user_id, subscription_id, amount, currency, billing_date, payment_method, status = 'paid'] = params;
            store.payment_history.push({
              id,
              user_id,
              subscription_id,
              amount: Number(amount),
              currency,
              billing_date,
              payment_method,
              status,
              created_at: new Date().toISOString(),
            });
            changes = 1;
            save();
            return { changes };
          }

          if (cleanSql.includes('INSERT INTO categories')) {
            const [id, user_id, name, icon, color] = params;
            store.categories.push({
              id,
              user_id,
              name,
              icon,
              color,
              created_at: new Date().toISOString(),
            });
            changes = 1;
            save();
            return { changes };
          }

          return { changes: 0 };
        },
      };
    },
  };
}

const storagePath = process.env.VERCEL
  ? path.join('/tmp', 'subtrack_db.json')
  : path.join(__dirname, 'data', 'subscriptions.json');

const dir = path.dirname(storagePath);
if (!fs.existsSync(dir)) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {}
}

export const db = createUniversalJsDb(storagePath);

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
      billing_cycle TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      start_date TEXT NOT NULL,
      next_billing_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      website TEXT,
      logo TEXT,
      color TEXT DEFAULT '#4F46E5',
      reminder_days INTEGER DEFAULT 3,
      auto_renew INTEGER DEFAULT 1,
      cancellation_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
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
      next_billing_date: addDays(today, 2),
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
      next_billing_date: addDays(today, 5),
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
      status: 'paused',
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
      status: 'trial',
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

  const insertMany = db.transaction((subs: any[]) => {
    for (const sub of subs) {
      stmt.run(sub);
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
