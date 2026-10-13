import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolClient } from 'pg';
import { getPool, transaction } from './postgres';

const connection = new AsyncLocalStorage<PoolClient>();

// Compatibility for the app's fixed SQL statements. Every operation is async.
// Values remain bound parameters; identifiers refer only to Sub-Track tables.
export function bindSQL(sql: string, args: any[]) {
  const values: any[] = [];
  const named = args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0]);
  let position = 0;
  const text = sql.replace(/@([a-z_]+)|\?/g, (_, name) => {
    values.push(name && named ? args[0][name] : args[position++]);
    return `$${values.length}`;
  });
  return { text, values };
}

async function execute(sql: string, args: any[]) {
  const { text, values } = bindSQL(sql, args);
  const result = await (connection.getStore() ?? getPool()).query(text, values);
  // pg returns NUMERIC as text. The frontend and analytics expect numbers.
  for (const row of result.rows) {
    for (const key of ['price', 'amount', 'count']) {
      if (row[key] != null) row[key] = Number(row[key]);
    }
  }
  return result;
}

export const db = {
  prepare(sql: string) {
    return {
      async get(...args: any[]) { return (await execute(sql, args)).rows[0]; },
      async all(...args: any[]) { return (await execute(sql, args)).rows; },
      async run(...args: any[]) { return { changes: (await execute(sql, args)).rowCount ?? 0 }; },
    };
  },
  transaction<A extends any[], T>(fn: (...args: A) => Promise<T>) {
    return async (...args: A): Promise<T> => {
      if (connection.getStore()) return fn(...args);
      return transaction(client => connection.run(client, () => fn(...args)));
    };
  },
};

export async function initDatabase() {
  // Readiness check only. Schema changes are applied explicitly in Supabase.
  await getPool().query('SELECT id FROM public.subtrack_users LIMIT 0');
}

export async function seedSubscriptionsForUser(userId: string) {
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
    INSERT INTO public.subtrack_subscriptions (
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
    INSERT INTO public.subtrack_payment_history (id, user_id, subscription_id, amount, currency, billing_date, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
  `);

  const insertMany = db.transaction(async (subs: any[]) => {
    for (const sub of subs) {
      await stmt.run(sub);
      await historyStmt.run(
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

  await insertMany(sampleSubscriptions);
}
