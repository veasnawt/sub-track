// server/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// server/db.ts
import { AsyncLocalStorage } from "node:async_hooks";

// server/postgres.ts
import { Pool } from "pg";

// server/supabase-ca.ts
var SUPABASE_CA = "-----BEGIN CERTIFICATE-----\nMIIDxDCCAqygAwIBAgIUbLxMod62P2ktCiAkxnKJwtE9VPYwDQYJKoZIhvcNAQEL\nBQAwazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5l\ndyBDYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJh\nc2UgUm9vdCAyMDIxIENBMB4XDTIxMDQyODEwNTY1M1oXDTMxMDQyNjEwNTY1M1ow\nazELMAkGA1UEBhMCVVMxEDAOBgNVBAgMB0RlbHdhcmUxEzARBgNVBAcMCk5ldyBD\nYXN0bGUxFTATBgNVBAoMDFN1cGFiYXNlIEluYzEeMBwGA1UEAwwVU3VwYWJhc2Ug\nUm9vdCAyMDIxIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqQXW\nQyHOB+qR2GJobCq/CBmQ40G0oDmCC3mzVnn8sv4XNeWtE5XcEL0uVih7Jo4Dkx1Q\nDmGHBH1zDfgs2qXiLb6xpw/CKQPypZW1JssOTMIfQppNQ87K75Ya0p25Y3ePS2t2\nGtvHxNjUV6kjOZjEn2yWEcBdpOVCUYBVFBNMB4YBHkNRDa/+S4uywAoaTWnCJLUi\ncvTlHmMw6xSQQn1UfRQHk50DMCEJ7Cy1RxrZJrkXXRP3LqQL2ijJ6F4yMfh+Gyb4\nO4XajoVj/+R4GwywKYrrS8PrSNtwxr5StlQO8zIQUSMiq26wM8mgELFlS/32Uclt\nNaQ1xBRizkzpZct9DwIDAQABo2AwXjALBgNVHQ8EBAMCAQYwHQYDVR0OBBYEFKjX\nuXY32CztkhImng4yJNUtaUYsMB8GA1UdIwQYMBaAFKjXuXY32CztkhImng4yJNUt\naUYsMA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB8spzNn+4VU\ntVxbdMaX+39Z50sc7uATmus16jmmHjhIHz+l/9GlJ5KqAMOx26mPZgfzG7oneL2b\nVW+WgYUkTT3XEPFWnTp2RJwQao8/tYPXWEJDc0WVQHrpmnWOFKU/d3MqBgBm5y+6\njB81TU/RG2rVerPDWP+1MMcNNy0491CTL5XQZ7JfDJJ9CCmXSdtTl4uUQnSuv/Qx\nCea13BX2ZgJc7Au30vihLhub52De4P/4gonKsNHYdbWjg7OWKwNv/zitGDVDB9Y2\nCMTyZKG3XEu5Ghl1LEnI3QmEKsqaCLv12BnVjbkSeZsMnevJPs1Ye6TjjJwdik5P\no/bKiIz+Fq8=\n-----END CERTIFICATE-----\n";

// server/postgres.ts
var pool;
function connectionURL(input) {
  const url = new URL(input.trim());
  if (url.hostname === "db.hmluapddxfnimuqqmtpr.supabase.co") {
    url.hostname = "aws-0-ap-northeast-1.pooler.supabase.com";
    url.port = "6543";
    url.username = "postgres.hmluapddxfnimuqqmtpr";
  }
  for (const key2 of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key2);
  return url;
}
function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for persistent Sub-Track storage");
  }
  if (!pool) {
    const url = connectionURL(connectionString);
    console.info("Database connection target", {
      target: url.hostname === "aws-0-ap-northeast-1.pooler.supabase.com" ? "configured_supabase_pooler" : "other_host",
      expectedUser: url.username === "postgres.hmluapddxfnimuqqmtpr",
      expectedPort: url.port === "6543"
    });
    pool = new Pool({
      connectionString: url.toString(),
      ssl: { rejectUnauthorized: true, ca: SUPABASE_CA },
      max: 5,
      connectionTimeoutMillis: 1e4,
      idleTimeoutMillis: 3e4
    });
    pool.on("error", () => console.error("PostgreSQL connection unavailable"));
  }
  return pool;
}
async function transaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// server/db.ts
var connection = new AsyncLocalStorage();
function bindSQL(sql, args) {
  const values = [];
  const named = args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0]);
  let position = 0;
  const text = sql.replace(/@([a-z_]+)|\?/g, (_, name) => {
    values.push(name && named ? args[0][name] : args[position++]);
    return `$${values.length}`;
  });
  return { text, values };
}
async function execute(sql, args) {
  const { text, values } = bindSQL(sql, args);
  const result = await (connection.getStore() ?? getPool()).query(text, values);
  for (const row of result.rows) {
    for (const key2 of ["price", "amount", "count"]) {
      if (row[key2] != null) row[key2] = Number(row[key2]);
    }
  }
  return result;
}
var db = {
  prepare(sql) {
    return {
      async get(...args) {
        return (await execute(sql, args)).rows[0];
      },
      async all(...args) {
        return (await execute(sql, args)).rows;
      },
      async run(...args) {
        return { changes: (await execute(sql, args)).rowCount ?? 0 };
      }
    };
  },
  transaction(fn) {
    return async (...args) => {
      if (connection.getStore()) return fn(...args);
      return transaction((client) => connection.run(client, () => fn(...args)));
    };
  }
};
async function initDatabase() {
  await getPool().query("SELECT id FROM public.subtrack_users LIMIT 0");
}
async function seedSubscriptionsForUser(userId) {
  const today = /* @__PURE__ */ new Date();
  const formatDate = (date3) => date3.toISOString().split("T")[0];
  const addDays = (d2, days) => {
    const copy = new Date(d2);
    copy.setDate(copy.getDate() + days);
    return formatDate(copy);
  };
  const subMonths = (d2, months) => {
    const copy = new Date(d2);
    copy.setMonth(copy.getMonth() - months);
    return formatDate(copy);
  };
  const sampleSubscriptions = [
    {
      id: `sub-${userId}-1`,
      user_id: userId,
      name: "Netflix Premium",
      category: "Entertainment & Streaming",
      price: 22.99,
      currency: "USD",
      billing_cycle: "monthly",
      payment_method: "credit_card",
      start_date: subMonths(today, 14),
      next_billing_date: addDays(today, 2),
      status: "active",
      notes: "4K Ultra HD 4-screen family plan",
      website: "https://netflix.com",
      logo: "https://assets.nflxext.com/ffe/siteui/common/icons/nficon2023.ico",
      color: "#E50914",
      reminder_days: 3,
      auto_renew: 1,
      cancellation_url: "https://www.netflix.com/cancelplan"
    },
    {
      id: `sub-${userId}-2`,
      user_id: userId,
      name: "Spotify Family",
      category: "Music & Audio",
      price: 16.99,
      currency: "USD",
      billing_cycle: "monthly",
      payment_method: "paypal",
      start_date: subMonths(today, 24),
      next_billing_date: addDays(today, 5),
      status: "active",
      notes: "Shared with household members",
      website: "https://spotify.com",
      logo: "https://open.spotifycdn.com/cdn/images/favicon.0f31d2ea.ico",
      color: "#1DB954",
      reminder_days: 3,
      auto_renew: 1,
      cancellation_url: "https://www.spotify.com/account/subscription/"
    },
    {
      id: `sub-${userId}-3`,
      user_id: userId,
      name: "ChatGPT Plus",
      category: "Productivity & Work",
      price: 20,
      currency: "USD",
      billing_cycle: "monthly",
      payment_method: "credit_card",
      start_date: subMonths(today, 8),
      next_billing_date: addDays(today, 11),
      status: "active",
      notes: "GPT-4o, DALL-E, Advanced Data Analysis",
      website: "https://chatgpt.com",
      logo: "https://chatgpt.com/favicon.ico",
      color: "#10A37F",
      reminder_days: 2,
      auto_renew: 1,
      cancellation_url: "https://chatgpt.com/#settings"
    },
    {
      id: `sub-${userId}-4`,
      user_id: userId,
      name: "GitHub Copilot Individual",
      category: "Cloud & Developer Tools",
      price: 100,
      currency: "USD",
      billing_cycle: "yearly",
      payment_method: "credit_card",
      start_date: subMonths(today, 6),
      next_billing_date: addDays(today, 180),
      status: "active",
      notes: "Annual developer plan. Saves $20 compared to monthly.",
      website: "https://github.com/features/copilot",
      logo: "https://github.githubassets.com/favicons/favicon.png",
      color: "#24292F",
      reminder_days: 7,
      auto_renew: 1,
      cancellation_url: "https://github.com/settings/billing"
    },
    {
      id: `sub-${userId}-5`,
      user_id: userId,
      name: "Figma Professional",
      category: "Productivity & Work",
      price: 15,
      currency: "USD",
      billing_cycle: "monthly",
      payment_method: "credit_card",
      start_date: subMonths(today, 10),
      next_billing_date: addDays(today, 18),
      status: "active",
      notes: "UI/UX design workspace with team collaboration",
      website: "https://figma.com",
      logo: "https://static.figma.com/app/icon/1/favicon.ico",
      color: "#F24E1E",
      reminder_days: 3,
      auto_renew: 1,
      cancellation_url: "https://www.figma.com/settings"
    },
    {
      id: `sub-${userId}-6`,
      user_id: userId,
      name: "Amazon Prime",
      category: "Entertainment & Streaming",
      price: 139,
      currency: "USD",
      billing_cycle: "yearly",
      payment_method: "credit_card",
      start_date: subMonths(today, 11),
      next_billing_date: addDays(today, 28),
      status: "active",
      notes: "Free fast delivery, Prime Video, Prime Music",
      website: "https://amazon.com",
      logo: "https://www.amazon.com/favicon.ico",
      color: "#FF9900",
      reminder_days: 14,
      auto_renew: 1,
      cancellation_url: "https://www.amazon.com/mc/manage"
    },
    {
      id: `sub-${userId}-7`,
      user_id: userId,
      name: "iCloud+ 200GB",
      category: "Utilities & Software",
      price: 2.99,
      currency: "USD",
      billing_cycle: "monthly",
      payment_method: "apple_pay",
      start_date: subMonths(today, 30),
      next_billing_date: addDays(today, 7),
      status: "active",
      notes: "Photos backup and iCloud Private Relay",
      website: "https://apple.com/icloud",
      logo: "https://www.apple.com/favicon.ico",
      color: "#0071E3",
      reminder_days: 1,
      auto_renew: 1,
      cancellation_url: "https://support.apple.com/HT207594"
    },
    {
      id: `sub-${userId}-8`,
      user_id: userId,
      name: "Strava Summit",
      category: "Health & Fitness",
      price: 11.99,
      currency: "USD",
      billing_cycle: "monthly",
      payment_method: "apple_pay",
      start_date: subMonths(today, 4),
      next_billing_date: addDays(today, 15),
      status: "paused",
      notes: "Paused during recovery month",
      website: "https://strava.com",
      logo: "https://web-assets.strava.com/favicons/favicon.ico",
      color: "#FC4C02",
      reminder_days: 3,
      auto_renew: 0,
      cancellation_url: "https://www.strava.com/settings/subscription"
    },
    {
      id: `sub-${userId}-9`,
      user_id: userId,
      name: "Audible Premium Plus",
      category: "Education & Learning",
      price: 14.95,
      currency: "USD",
      billing_cycle: "monthly",
      payment_method: "credit_card",
      start_date: addDays(today, -20),
      next_billing_date: addDays(today, 10),
      status: "trial",
      notes: "30-day free trial. Decide whether to keep or cancel before day 30.",
      website: "https://audible.com",
      logo: "https://www.audible.com/favicon.ico",
      color: "#F8991C",
      reminder_days: 3,
      auto_renew: 1,
      cancellation_url: "https://www.audible.com/account/overview"
    },
    {
      id: `sub-${userId}-10`,
      user_id: userId,
      name: "NordVPN 2-Year",
      category: "Utilities & Software",
      price: 89,
      currency: "USD",
      billing_cycle: "yearly",
      payment_method: "crypto",
      start_date: subMonths(today, 2),
      next_billing_date: addDays(today, 305),
      status: "active",
      notes: "VPN and Threat Protection on up to 10 devices",
      website: "https://nordvpn.com",
      logo: "https://nordvpn.com/favicon.ico",
      color: "#4687FF",
      reminder_days: 7,
      auto_renew: 1,
      cancellation_url: "https://my.nordaccount.com/billing/"
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
  const insertMany = db.transaction(async (subs) => {
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

// server/routes/auth.ts
import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt2 from "jsonwebtoken";
import crypto from "crypto";

// server/middleware/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) throw new Error("JWT_SECRET must be set to at least 32 random characters");
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Authentication token required" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Invalid or expired session token" });
  }
}

// server/routes/auth.ts
var router = Router();
var RegisterSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  currency: z.string().default("USD"),
  seedSamples: z.boolean().optional().default(false)
});
var LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});
router.post("/register", async (req, res) => {
  try {
    const result = RegisterSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error.issues[0].message
      });
    }
    const { name, email, password, currency, seedSamples } = result.data;
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.prepare("SELECT id FROM public.subtrack_users WHERE email = ?").get(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists"
      });
    }
    const userId = crypto && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const passwordHash = bcrypt.hashSync(password, 10);
    await db.prepare(`
      INSERT INTO public.subtrack_users (id, name, email, password_hash, currency)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, name.trim(), normalizedEmail, passwordHash, currency.toUpperCase());
    if (seedSamples) {
      try {
        await seedSubscriptionsForUser(userId);
      } catch (seedErr) {
        console.warn("Sample subscription seeding non-fatal error:", seedErr);
      }
    }
    const userPayload = {
      userId,
      name: name.trim(),
      email: normalizedEmail,
      currency: currency.toUpperCase()
    };
    const token = jwt2.sign(userPayload, JWT_SECRET, { expiresIn: "30d" });
    return res.status(201).json({
      success: true,
      token,
      user: userPayload
    });
  } catch (err) {
    console.error("Registration failed", { code: err?.code });
    return res.status(500).json({
      success: false,
      error: "Registration failed. Please try again."
    });
  }
});
router.post("/login", async (req, res) => {
  try {
    const result = LoginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error.issues[0].message
      });
    }
    const { email, password } = result.data;
    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.prepare("SELECT * FROM public.subtrack_users WHERE email = ?").get(normalizedEmail);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      });
    }
    const passwordValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      });
    }
    const userPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency || "USD"
    };
    const token = jwt2.sign(userPayload, JWT_SECRET, { expiresIn: "30d" });
    return res.json({
      success: true,
      token,
      user: userPayload
    });
  } catch (err) {
    console.error("Login failed", { code: err?.code });
    return res.status(500).json({
      success: false,
      error: "Login failed. Please try again."
    });
  }
});
router.post("/demo", async (req, res) => {
  try {
    const demoEmail = "demo@subtrack.app";
    let demoUser = await db.prepare("SELECT * FROM public.subtrack_users WHERE email = ?").get(demoEmail);
    if (!demoUser) {
      const demoUserId = "demo-user-id-001";
      const passwordHash = bcrypt.hashSync("demo1234", 10);
      await db.prepare(`
        INSERT INTO public.subtrack_users (id, name, email, password_hash, currency, theme)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(demoUserId, "Alex Taylor", demoEmail, passwordHash, "USD", "system");
      try {
        await seedSubscriptionsForUser(demoUserId);
      } catch (seedErr) {
        console.warn("Demo subscription seeding non-fatal error:", seedErr);
      }
      demoUser = {
        id: demoUserId,
        name: "Alex Taylor",
        email: demoEmail,
        currency: "USD"
      };
    }
    const userPayload = {
      userId: demoUser.id,
      name: demoUser.name,
      email: demoUser.email,
      currency: demoUser.currency || "USD"
    };
    const token = jwt2.sign(userPayload, JWT_SECRET, { expiresIn: "30d" });
    return res.json({
      success: true,
      token,
      user: userPayload
    });
  } catch (err) {
    console.error("Demo login failed", { code: err?.code });
    return res.status(500).json({
      success: false,
      error: "Demo login failed. Please try again."
    });
  }
});
router.get("/me", authMiddleware, async (req, res) => {
  const user = await db.prepare("SELECT id, name, email, currency, theme, created_at FROM public.subtrack_users WHERE id = ?").get(req.user.userId);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found" });
  }
  return res.json({
    success: true,
    user: {
      userId: user.id,
      name: user.name,
      email: user.email,
      currency: user.currency,
      theme: user.theme,
      createdAt: user.created_at
    }
  });
});
router.put("/me", authMiddleware, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    currency: z.string().length(3).optional(),
    theme: z.enum(["light", "dark", "system"]).optional()
  });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ success: false, error: result.error.issues[0].message });
  }
  const { name, currency, theme } = result.data;
  const updates = [];
  const values = [];
  if (name !== void 0) {
    updates.push("name = ?");
    values.push(name.trim());
  }
  if (currency !== void 0) {
    updates.push("currency = ?");
    values.push(currency.toUpperCase());
  }
  if (theme !== void 0) {
    updates.push("theme = ?");
    values.push(theme);
  }
  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(req.user.userId);
    await db.prepare(`UPDATE public.subtrack_users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }
  const updatedUser = await db.prepare("SELECT id, name, email, currency, theme FROM public.subtrack_users WHERE id = ?").get(req.user.userId);
  return res.json({
    success: true,
    user: {
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      currency: updatedUser.currency,
      theme: updatedUser.theme
    }
  });
});
var auth_default = router;

// server/routes/gmail.ts
import { Router as Router2 } from "express";
import crypto4 from "node:crypto";
import { z as z3 } from "zod";

// server/subscription-import.ts
import crypto2 from "node:crypto";
import { z as z2 } from "zod";
var date = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, "Invalid date");
var ImportSchema = z2.object({
  name: z2.string().trim().min(1).max(200),
  category: z2.string().default("Other"),
  price: z2.coerce.number().finite().nonnegative(),
  currency: z2.enum(["USD", "KHR", "EUR", "GBP", "AUD", "CAD", "JPY", "THB", "VND", "SGD", "CNY", "INR"]).default("USD"),
  billing_cycle: z2.enum(["weekly", "monthly", "quarterly", "semi_annual", "yearly", "lifetime"]),
  start_date: date,
  next_billing_date: date,
  status: z2.enum(["active", "paused", "cancelled", "trial"]).default("active"),
  payment_method: z2.string().default("other"),
  notes: z2.string().max(4e3).default(""),
  website: z2.string().default(""),
  logo: z2.string().default(""),
  color: z2.string().default("#4F46E5"),
  reminder_days: z2.coerce.number().int().min(0).max(90).default(3),
  auto_renew: z2.union([z2.boolean(), z2.literal(0), z2.literal(1)]).default(false),
  cancellation_url: z2.string().default(""),
  source_id: z2.string().max(200).optional(),
  initial_payment: z2.object({ amount: z2.number().finite().nonnegative(), date, status: z2.enum(["paid", "failed"]).default("paid") }).optional()
});
async function importSubscription(userId, input) {
  const s = ImportSchema.parse(input);
  const id = s.source_id ? "sub-mail-" + crypto2.createHash("sha256").update(userId + "\0" + s.source_id).digest("hex") : "sub-" + crypto2.randomUUID();
  if (await db.prepare("SELECT id FROM public.subtrack_subscriptions WHERE id=? AND user_id=?").get(id, userId)) return { id, added: false };
  const added = await db.prepare(`INSERT INTO public.subtrack_subscriptions
    (id,user_id,name,category,price,currency,billing_cycle,payment_method,start_date,next_billing_date,status,notes,website,logo,color,reminder_days,auto_renew,cancellation_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING`).run(id, userId, s.name, s.category, s.price, s.currency, s.billing_cycle, s.payment_method, s.start_date, s.next_billing_date, s.status, s.notes, s.website, s.logo, s.color, s.reminder_days, Number(Boolean(s.auto_renew)), s.cancellation_url);
  if (added.changes && s.initial_payment) await db.prepare(`INSERT INTO public.subtrack_payment_history
    (id,user_id,subscription_id,amount,currency,billing_date,payment_method,status) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run(s.source_id?.startsWith("gmail:") ? "gmail-" + crypto2.createHash("sha256").update(userId + s.source_id.slice(6)).digest("hex") : "hist-" + id, userId, id, s.initial_payment.amount, s.currency, s.initial_payment.date, s.payment_method, s.initial_payment.status);
  return { id, added: added.changes > 0 };
}

// server/gmail/service.ts
import crypto3 from "node:crypto";

// server/gmail/schema.ts
var gmailSchema = `-- Additive, server-only Gmail integration. Does not alter any Pinly tables.
CREATE TABLE IF NOT EXISTS public.subtrack_gmail_connections (
 user_id text PRIMARY KEY REFERENCES public.subtrack_users(id) ON DELETE CASCADE,
 email text NOT NULL, refresh_cipher text NOT NULL, auto_sync boolean NOT NULL DEFAULT true,
 scan_page text, scan_from timestamptz, scan_started timestamptz,
 last_sync timestamptz, sync_until timestamptz, last_error text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.subtrack_gmail_states (
 hash text PRIMARY KEY, user_id text NOT NULL REFERENCES public.subtrack_users(id) ON DELETE CASCADE,
 nonce_hash text NOT NULL, verifier_cipher text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS public.subtrack_gmail_events (
 user_id text NOT NULL REFERENCES public.subtrack_users(id) ON DELETE CASCADE,
 message_id text NOT NULL, evidence text NOT NULL, source_url text NOT NULL,
 email_date timestamptz NOT NULL, state text NOT NULL DEFAULT 'pending',
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,message_id)
);
ALTER TABLE public.subtrack_gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtrack_gmail_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtrack_gmail_events ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.subtrack_gmail_senders (
 user_id text NOT NULL REFERENCES public.subtrack_users(id) ON DELETE CASCADE,
 sender_key text NOT NULL, name text NOT NULL, PRIMARY KEY(user_id,sender_key)
);
ALTER TABLE public.subtrack_gmail_senders ENABLE ROW LEVEL SECURITY;
`;

// server/gmail/parser.ts
import { createHash } from "node:crypto";
function messageText(payload) {
  function parts(p, type) {
    return (p.mimeType === type && p.body?.data ? [Buffer.from(p.body.data, "base64url").toString("utf8")] : []).concat(...(p.parts || []).map((x) => parts(x, type)));
  }
  let text = parts(payload, "text/plain").join(" ");
  if (!text) text = parts(payload, "text/html").join(" ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&");
  return text.replace(/\s+/g, " ").slice(0, 1e5);
}
var month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
var d = month + "\\s+\\d{1,2}(?:,?\\s+20\\d{2})?";
function date2(value, year) {
  const v = /* @__PURE__ */ new Date(value + (/20\d{2}/.test(value) ? "" : ", " + year) + " UTC");
  return Number.isNaN(v.valueOf()) ? void 0 : v.toISOString().slice(0, 10);
}
function parseEvidence(headers, text) {
  const from = headers.from || "", subject = headers.subject || "";
  const auth = headers["authentication-results"] || "";
  const sender = from.match(/(?:<|\b)([A-Z0-9._%+-]+@[A-Z0-9.-]+)/i)?.[1]?.toLowerCase() || "";
  const domain = sender.split("@")[1] || "";
  const verified = auth.includes("mx.google.com;") && /\bdkim=pass\b/.test(auth) && /\bdmarc=pass\b/.test(auth);
  const known = [["ElevenLabs Starter", "elevenlabs.io"], ["Meshy Pro", "meshy.ai"], ["Claude Pro", "anthropic.com"], ["ChatGPT Plus", "openai.com"], ["Telegram Premium", "apple.com"], ["Railway Pro", "railway.app"]];
  let entry = known.find(([, v]) => domain === v || domain.endsWith("." + v));
  if (domain === "stripe.com") {
    if (/receipt from Eleven Labs Inc\./i.test(subject + " " + text)) entry = ["ElevenLabs Starter", "stripe.com"];
    if (/receipt from Meshy/i.test(subject + " " + text)) entry = ["Meshy Pro", "stripe.com"];
  }
  if (/one.time|prepaid|extra usage|credit purchase|reset key/i.test(subject + " " + text)) return null;
  if (!/(receipt|invoice|subscri|renew|payment|paused|cancel)/i.test(subject)) return null;
  if (/(save \d|offer|discount|deal|newsletter)/i.test(subject) && !/receipt|invoice/i.test(subject)) return null;
  let name = entry?.[0] || "Unrecognized service";
  if (domain === "apple.com" && !/Telegram Premium/i.test(text)) name = "Apple subscription \u2014 review service";
  const trusted = Boolean(entry) && verified;
  const identity = { sender_key: createHash("sha256").update(sender).digest("hex"), requires_approval: domain === "stripe.com" };
  if (name === "Claude Pro" && /access.*(?:has been|is) paused/i.test(subject + " " + text)) return { ...identity, name, kind: "paused", status: "paused", summary: "Paid access paused; verify outstanding invoice.", trusted };
  if (name === "ChatGPT Plus" && /will not renew|won.t renew/i.test(text)) {
    const end = text.match(new RegExp("(?:current (?:billing )?period|access|end)[\\s\\S]{0,100}?(" + d + ")", "i"));
    return { ...identity, name, kind: "cancelled", status: "cancelled", next_billing_date: end ? date2(end[1]) : void 0, summary: "Nonrenewing; access may continue until the stated period end.", trusted };
  }
  if (/unsuccessful|declined|failed|past.due/i.test(subject)) return { ...identity, name, kind: "review", summary: "Payment failed; no payment recorded. Check access and retry status.", trusted };
  if (/receipt/i.test(subject) && ["ElevenLabs Starter", "Meshy Pro"].includes(name)) {
    const period = text.match(new RegExp("(" + d + ")\\s*[\u2013\u2014-]\\s*(" + d + ")", "i"));
    const year = period?.[2].match(/20\d{2}/)?.[0] || period?.[1].match(/20\d{2}/)?.[0];
    const start = period ? date2(period[1], year) : void 0, end = period ? date2(period[2], year) : void 0;
    const paid = text.match(new RegExp("Paid\\s+(" + d + ")", "i"));
    const paidDate = paid ? date2(paid[1], year) : void 0;
    const amount = text.match(/(?:amount paid|paid)\s*\$([\d,]+\.\d{2})/i)?.[1];
    const plan = name === "Meshy Pro" ? "Pro" : "Starter";
    const regular = text.match(new RegExp("\\b" + plan + "\\b[^$]{0,100}?\\$([\\d,]+\\.\\d{2})", "i"))?.[1];
    if (start && end && amount && regular && paidDate && end > start) return { ...identity, name, kind: "receipt", payment_date: paidDate, price: Number(regular.replace(/,/g, "")), amount: Number(amount.replace(/,/g, "")), start_date: start, next_billing_date: end, billing_cycle: "monthly", status: "active", summary: "Receipt parsed; billing-period end used as expected next billing date.", trusted };
  }
  return { ...identity, name, kind: "review", summary: "Billing email found. Verify service, recurring price, dates and current status before importing.", trusted };
}

// server/gmail/service.ts
function configured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.APP_URL);
}
function appURL() {
  const url = new URL(process.env.APP_URL);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("APP_URL must use HTTPS");
  return url.origin;
}
var hash = (s) => crypto3.createHash("sha256").update(s).digest("hex");
var key = crypto3.scryptSync(JWT_SECRET, "subtrack:gmail:tokens:v1", 32);
function encrypt(s) {
  const iv = crypto3.randomBytes(12), c = crypto3.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(s, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), data]).toString("base64url");
}
function decrypt(s) {
  const raw = Buffer.from(s, "base64url"), c = crypto3.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  c.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([c.update(raw.subarray(28)), c.final()]).toString("utf8");
}
var ready;
function ensureSchema() {
  if (!ready) ready = (async () => {
    await db.transaction(async () => {
      for (const sql of gmailSchema.split(";").filter((x) => x.trim())) await db.prepare(sql).run();
    })();
  })().catch((e) => {
    ready = void 0;
    throw e;
  });
  return ready;
}
async function googleJSON(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15e3) });
  const value = await response.json();
  if (!response.ok) {
    const e = new Error(response.status === 400 || response.status === 401 ? "Reconnect Gmail to restore access." : "Gmail request failed; try again later.");
    e.status = 502;
    throw e;
  }
  return value;
}
async function tokens(params) {
  return googleJSON("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ ...params, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }) });
}
async function gmail(path, access) {
  return googleJSON("https://gmail.googleapis.com/gmail/v1/users/me/" + path, { headers: { Authorization: "Bearer " + access } });
}
async function applyEvidence(userId, messageId, e) {
  const subscriptions = await db.prepare("SELECT * FROM public.subtrack_subscriptions WHERE user_id = ? AND name = ?").all(userId, e.name);
  if (subscriptions.length !== 1 || !e.trusted) return false;
  if (e.requires_approval && !await db.prepare("SELECT name FROM public.subtrack_gmail_senders WHERE user_id=? AND sender_key=? AND name=?").get(userId, e.sender_key, e.name)) return false;
  const s = subscriptions[0];
  if (e.kind === "receipt" && e.price !== void 0 && e.amount !== void 0 && e.start_date && e.payment_date && e.next_billing_date && e.billing_cycle === s.billing_cycle && e.next_billing_date >= s.next_billing_date && s.status === "active" && s.currency === "USD") {
    await db.prepare(`UPDATE public.subtrack_subscriptions SET price=?,next_billing_date=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?`).run(e.price, e.next_billing_date, s.id, userId);
    await db.prepare(`INSERT INTO public.subtrack_payment_history (id,user_id,subscription_id,amount,currency,billing_date,payment_method,status) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`).run("gmail-" + hash(userId + messageId), userId, s.id, e.amount, "USD", e.payment_date, s.payment_method, "paid");
    return true;
  }
  if (e.kind === "paused") {
    await db.prepare("UPDATE public.subtrack_subscriptions SET status='paused',updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(s.id, userId);
    return true;
  }
  return false;
}
async function syncUser(userId) {
  await ensureSchema();
  const now = /* @__PURE__ */ new Date();
  const deadline = Date.now() + 18e4;
  const conn = await db.prepare(`UPDATE public.subtrack_gmail_connections SET sync_until=? WHERE user_id=? AND (sync_until IS NULL OR sync_until < ?) RETURNING *`).get(new Date(now.valueOf() + 3e5).toISOString(), userId, now.toISOString());
  if (!conn) return { busy: true, found: 0, applied: 0 };
  let found = 0, applied = 0;
  try {
    const access = (await tokens({ grant_type: "refresh_token", refresh_token: decrypt(conn.refresh_cipher) })).access_token;
    const from = conn.scan_from ? new Date(conn.scan_from) : conn.last_sync ? new Date(new Date(conn.last_sync).valueOf() - 3 * 864e5) : new Date(now.valueOf() - 100 * 864e5);
    const query = "after:" + Math.floor(from.valueOf() / 1e3) + " -in:trash -in:spam (subject:receipt OR subject:invoice OR subject:subscription OR subject:renewal OR subject:cancel OR subject:payment OR subject:paused)";
    let page = conn.scan_page || "";
    let pages = 0;
    let incomplete = false;
    const scanStarted = conn.scan_started || now.toISOString();
    do {
      const list = await gmail("messages?" + new URLSearchParams({ q: query, maxResults: "50", ...page ? { pageToken: page } : {} }), access);
      const currentPage = page;
      for (const m of list.messages || []) {
        if (Date.now() > deadline) {
          incomplete = true;
          break;
        }
        if (await db.prepare("SELECT state FROM public.subtrack_gmail_events WHERE user_id=? AND message_id=?").get(userId, m.id)) continue;
        const msg = await gmail("messages/" + encodeURIComponent(m.id) + "?format=full", access);
        const headers = {};
        for (const h of msg.payload?.headers || []) if (headers[h.name.toLowerCase()] === void 0) headers[h.name.toLowerCase()] = h.value;
        const evidence = parseEvidence(headers, messageText(msg.payload));
        const emailDate = new Date(Number(msg.internalDate)).toISOString();
        await db.transaction(async () => {
          const claimed = await db.prepare("INSERT INTO public.subtrack_gmail_events (user_id,message_id,evidence,source_url,email_date,state) VALUES (?,?,?,?,?,?) ON CONFLICT(user_id,message_id) DO NOTHING").run(userId, m.id, JSON.stringify(evidence || {}), "https://mail.google.com/mail/u/0/#all/" + m.id, emailDate, evidence ? "pending" : "ignored");
          if (!claimed.changes || !evidence) return;
          found++;
          if (conn.auto_sync && conn.last_sync && new Date(emailDate) > new Date(conn.last_sync) && await applyEvidence(userId, m.id, evidence)) {
            await db.prepare("UPDATE public.subtrack_gmail_events SET state='applied' WHERE user_id=? AND message_id=?").run(userId, m.id);
            applied++;
          }
        })();
      }
      page = incomplete ? currentPage : list.nextPageToken || "";
      pages++;
      if (incomplete) break;
    } while (page && pages < 4);
    if (page || incomplete) await db.prepare("UPDATE public.subtrack_gmail_connections SET scan_page=?,scan_from=?,scan_started=?,last_error='More billing emails remain. Run Scan again to continue.' WHERE user_id=?").run(page, from.toISOString(), scanStarted, userId);
    else await db.prepare("UPDATE public.subtrack_gmail_connections SET last_sync=?,scan_page=NULL,scan_from=NULL,scan_started=NULL,last_error=NULL WHERE user_id=?").run(scanStarted, userId);
    return { found, applied, more: Boolean(page) || incomplete };
  } catch (e) {
    await db.prepare("UPDATE public.subtrack_gmail_connections SET last_error='Sync failed. Reconnect Gmail if it continues.' WHERE user_id=?").run(userId);
    throw e;
  } finally {
    await db.prepare("UPDATE public.subtrack_gmail_connections SET sync_until=NULL WHERE user_id=?").run(userId);
  }
}

// server/routes/gmail.ts
var router2 = Router2();
var scope = "https://www.googleapis.com/auth/gmail.readonly";
var callback = () => appURL() + "/api/gmail/callback";
function cookie(req, name) {
  return (req.headers.cookie || "").split(";").map((s) => s.trim()).find((s) => s.startsWith(name + "="))?.slice(name.length + 1) || "";
}
router2.get("/callback", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!configured()) return res.status(503).send("Gmail connection is not configured.");
  await ensureSchema();
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const nonce = cookie(req, "subtrack_gmail_nonce");
  if (!state || !nonce) return res.status(400).send("Connection expired. Start again from Settings.");
  const pending = await db.prepare("DELETE FROM public.subtrack_gmail_states WHERE hash=? AND nonce_hash=? AND expires_at>? RETURNING *").get(hash(state), hash(nonce), (/* @__PURE__ */ new Date()).toISOString());
  res.clearCookie("subtrack_gmail_nonce", { path: "/api/gmail/callback", secure: appURL().startsWith("https:"), sameSite: "lax" });
  if (!pending) return res.status(400).send("Connection expired. Start again from Settings.");
  if (req.query.error || typeof req.query.code !== "string") return res.redirect(appURL() + "/?gmail=declined");
  try {
    const token = await tokens({ grant_type: "authorization_code", code: req.query.code, redirect_uri: callback(), code_verifier: decrypt(pending.verifier_cipher) });
    if (!String(token.scope || "").split(" ").includes(scope) || !token.refresh_token) throw new Error("Missing Gmail permission.");
    const profile = await gmail("profile", token.access_token);
    const user = await db.prepare("SELECT email FROM public.subtrack_users WHERE id=?").get(pending.user_id);
    if (profile.emailAddress.toLowerCase() !== user.email.toLowerCase()) return res.redirect(appURL() + "/?gmail=account-mismatch");
    await db.prepare(`INSERT INTO public.subtrack_gmail_connections (user_id,email,refresh_cipher) VALUES (?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,refresh_cipher=EXCLUDED.refresh_cipher,last_error=NULL`).run(pending.user_id, profile.emailAddress, encrypt(token.refresh_token));
    return res.redirect(appURL() + "/?gmail=connected");
  } catch {
    return res.redirect(appURL() + "/?gmail=failed");
  }
});
router2.get("/cron", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.authorization || "";
  const expected = "Bearer " + secret;
  if (!secret || secret.length < 32 || supplied.length !== expected.length || !crypto4.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return res.status(401).json({ error: "Unauthorized" });
  if (!configured()) return res.json({ configured: false });
  await ensureSchema();
  const users = await db.prepare("SELECT user_id FROM public.subtrack_gmail_connections ORDER BY last_sync ASC NULLS FIRST LIMIT 10").all();
  const deadline = Date.now() + 24e4;
  let checked = 0, failed = 0;
  for (const u of users) {
    if (Date.now() > deadline - 18e4) break;
    try {
      await syncUser(u.user_id);
      checked++;
    } catch {
      failed++;
    }
  }
  return res.json({ checked, failed });
});
router2.use(authMiddleware);
router2.get("/status", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (!configured()) return res.json({ configured: false, connected: false, events: [] });
  await ensureSchema();
  const conn = await db.prepare("SELECT email,auto_sync,last_sync,last_error FROM public.subtrack_gmail_connections WHERE user_id=?").get(req.user.userId);
  const events = await db.prepare("SELECT message_id,evidence,source_url,email_date,state FROM public.subtrack_gmail_events WHERE user_id=? AND state IN ('pending','applied') ORDER BY email_date DESC LIMIT 100").all(req.user.userId);
  return res.json({ configured: true, connected: Boolean(conn), ...conn, events: events.map((e) => ({ ...e, evidence: JSON.parse(e.evidence) })) });
});
router2.use(async (_req, res, next) => {
  if (!configured()) return res.status(503).json({ error: "Gmail setup is not finished yet." });
  await ensureSchema();
  next();
});
router2.post("/connect", async (req, res) => {
  const state = crypto4.randomBytes(32).toString("base64url"), nonce = crypto4.randomBytes(32).toString("base64url"), verifier = crypto4.randomBytes(32).toString("base64url");
  await db.prepare("DELETE FROM public.subtrack_gmail_states WHERE expires_at<?").run((/* @__PURE__ */ new Date()).toISOString());
  await db.prepare("INSERT INTO public.subtrack_gmail_states(hash,user_id,nonce_hash,verifier_cipher,expires_at) VALUES(?,?,?,?,?)").run(hash(state), req.user.userId, hash(nonce), encrypt(verifier), new Date(Date.now() + 6e5).toISOString());
  res.cookie("subtrack_gmail_nonce", nonce, { httpOnly: true, secure: appURL().startsWith("https:"), sameSite: "lax", path: "/api/gmail/callback", maxAge: 6e5 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: callback(), response_type: "code", scope, access_type: "offline", prompt: "consent", state, code_challenge: crypto4.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", login_hint: req.user.email }).toString();
  res.json({ url: url.toString() });
});
router2.post("/sync", async (req, res) => res.json(await syncUser(req.user.userId)));
router2.put("/preferences", async (req, res) => {
  const parsed = z3.object({ auto_sync: z3.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid preference" });
  await db.prepare("UPDATE public.subtrack_gmail_connections SET auto_sync=? WHERE user_id=?").run(parsed.data.auto_sync, req.user.userId);
  return res.json({ success: true });
});
router2.post("/disconnect", async (req, res) => {
  const c = await db.prepare("SELECT refresh_cipher FROM public.subtrack_gmail_connections WHERE user_id=?").get(req.user.userId);
  if (c) try {
    await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: decrypt(c.refresh_cipher) }), signal: AbortSignal.timeout(1e4) });
  } catch {
  }
  await db.transaction(async () => {
    await db.prepare("DELETE FROM public.subtrack_gmail_connections WHERE user_id=?").run(req.user.userId);
    await db.prepare("DELETE FROM public.subtrack_gmail_states WHERE user_id=?").run(req.user.userId);
  })();
  return res.json({ success: true });
});
router2.post("/events/:id/dismiss", async (req, res) => {
  await db.prepare("UPDATE public.subtrack_gmail_events SET state='dismissed' WHERE user_id=? AND message_id=? AND state='pending'").run(req.user.userId, req.params.id);
  return res.json({ success: true });
});
router2.post("/events/:id/approve", async (req, res) => {
  const parsed = ImportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  let done = false;
  await db.transaction(async () => {
    const e = await db.prepare("SELECT * FROM public.subtrack_gmail_events WHERE user_id=? AND message_id=? AND state='pending' FOR UPDATE").get(req.user.userId, req.params.id);
    if (!e) return;
    const s = parsed.data;
    const evidence = JSON.parse(e.evidence);
    if (evidence.trusted && evidence.sender_key) await db.prepare("INSERT INTO public.subtrack_gmail_senders(user_id,sender_key,name) VALUES(?,?,?) ON CONFLICT(user_id,sender_key) DO UPDATE SET name=EXCLUDED.name").run(req.user.userId, evidence.sender_key, s.name);
    const matching = await db.prepare("SELECT id FROM public.subtrack_subscriptions WHERE user_id=? AND name=?").all(req.user.userId, s.name);
    if (matching.length > 1) throw new Error("Resolve duplicate services before approving.");
    if (matching.length === 1) {
      await db.prepare("UPDATE public.subtrack_subscriptions SET price=?,billing_cycle=?,next_billing_date=?,status=?,auto_renew=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").run(s.price, s.billing_cycle, s.next_billing_date, s.status, Number(Boolean(s.auto_renew)), s.notes, matching[0].id, req.user.userId);
      if (s.initial_payment) await db.prepare("INSERT INTO public.subtrack_payment_history(id,user_id,subscription_id,amount,currency,billing_date,payment_method,status) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").run("gmail-" + hash(req.user.userId + req.params.id), req.user.userId, matching[0].id, s.initial_payment.amount, s.currency, s.initial_payment.date, s.payment_method, s.initial_payment.status);
    } else await importSubscription(req.user.userId, { ...s, source_id: "gmail:" + req.params.id, notes: s.notes + "\nSource: " + e.source_url });
    await db.prepare("UPDATE public.subtrack_gmail_events SET state='applied' WHERE user_id=? AND message_id=?").run(req.user.userId, req.params.id);
    done = true;
  })();
  return res.status(done ? 200 : 404).json({ success: done });
});
var gmail_default = router2;

// server/routes/subscriptions.ts
import { Router as Router3 } from "express";
import { z as z4 } from "zod";
import crypto5 from "crypto";

// server/currency.ts
var EXCHANGE_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 154,
  KHR: 4050
};
function convertCurrency(amount, fromCurrency, toCurrency = "USD") {
  if (fromCurrency === toCurrency) return amount;
  const rateFrom = EXCHANGE_RATES[fromCurrency.toUpperCase()] || 1;
  const rateTo = EXCHANGE_RATES[toCurrency.toUpperCase()] || 1;
  const inUSD = amount / rateFrom;
  const inTarget = inUSD * rateTo;
  return Math.round(inTarget * 100) / 100;
}
function calculateMonthlyEquivalent(price, billingCycle, fromCurrency = "USD", toCurrency = "USD") {
  const convertedPrice = convertCurrency(price, fromCurrency, toCurrency);
  switch (billingCycle.toLowerCase()) {
    case "weekly":
      return Math.round(convertedPrice * 4.3333 * 100) / 100;
    case "monthly":
      return Math.round(convertedPrice * 100) / 100;
    case "quarterly":
      return Math.round(convertedPrice / 3 * 100) / 100;
    case "semi_annual":
      return Math.round(convertedPrice / 6 * 100) / 100;
    case "yearly":
      return Math.round(convertedPrice / 12 * 100) / 100;
    case "lifetime":
      return 0;
    // one-time fee
    default:
      return Math.round(convertedPrice * 100) / 100;
  }
}
function calculateYearlyEquivalent(price, billingCycle, fromCurrency = "USD", toCurrency = "USD") {
  const monthly = calculateMonthlyEquivalent(price, billingCycle, fromCurrency, toCurrency);
  return Math.round(monthly * 12 * 100) / 100;
}

// server/routes/subscriptions.ts
var router3 = Router3();
router3.use(authMiddleware);
var SubscriptionSchema = z4.object({
  name: z4.string().min(1, "Service name is required"),
  category: z4.string().min(1, "Category is required"),
  price: z4.preprocess(
    (val) => typeof val === "string" ? parseFloat(val) : val,
    z4.number().positive("Price must be greater than 0")
  ),
  currency: z4.string().default("USD"),
  billing_cycle: z4.enum(["weekly", "monthly", "quarterly", "semi_annual", "yearly", "lifetime"]),
  payment_method: z4.string().default("credit_card"),
  start_date: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  next_billing_date: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Next billing date must be YYYY-MM-DD"),
  status: z4.enum(["active", "paused", "cancelled", "trial"]).default("active"),
  notes: z4.string().optional().default(""),
  website: z4.string().optional().default(""),
  logo: z4.string().optional().default(""),
  color: z4.string().optional().default("#4F46E5"),
  reminder_days: z4.preprocess(
    (val) => typeof val === "string" ? parseInt(val, 10) : val,
    z4.number().int().min(0).max(90).default(3)
  ),
  auto_renew: z4.preprocess(
    (val) => typeof val === "boolean" ? val ? 1 : 0 : typeof val === "string" ? val === "true" || val === "1" ? 1 : 0 : typeof val === "number" ? val : 1,
    z4.number().int().min(0).max(1).default(1)
  ),
  cancellation_url: z4.string().optional().default("")
});
function calculateDaysDifference(targetDateStr) {
  const target = /* @__PURE__ */ new Date(targetDateStr + "T00:00:00");
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
}
function advanceBillingDate(currentDateStr, cycle) {
  const date3 = /* @__PURE__ */ new Date(currentDateStr + "T00:00:00");
  switch (cycle.toLowerCase()) {
    case "weekly":
      date3.setDate(date3.getDate() + 7);
      break;
    case "monthly":
      date3.setMonth(date3.getMonth() + 1);
      break;
    case "quarterly":
      date3.setMonth(date3.getMonth() + 3);
      break;
    case "semi_annual":
      date3.setMonth(date3.getMonth() + 6);
      break;
    case "yearly":
      date3.setFullYear(date3.getFullYear() + 1);
      break;
    case "lifetime":
      break;
    default:
      date3.setMonth(date3.getMonth() + 1);
      break;
  }
  return date3.toISOString().split("T")[0];
}
router3.get("/", async (req, res) => {
  const userId = req.user.userId;
  const userCurrency = req.user.currency || "USD";
  const { search, category, status, billing_cycle, payment_method, sort_by = "next_billing_date", sort_order = "asc" } = req.query;
  let query = `SELECT * FROM public.subtrack_subscriptions WHERE user_id = ?`;
  const params = [userId];
  if (search && typeof search === "string" && search.trim() !== "") {
    query += ` AND (name LIKE ? OR notes LIKE ? OR website LIKE ?)`;
    const searchPattern = `%${search.trim()}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }
  if (category && typeof category === "string" && category !== "all") {
    query += ` AND category = ?`;
    params.push(category);
  }
  if (status && typeof status === "string" && status !== "all") {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (billing_cycle && typeof billing_cycle === "string" && billing_cycle !== "all") {
    query += ` AND billing_cycle = ?`;
    params.push(billing_cycle);
  }
  if (payment_method && typeof payment_method === "string" && payment_method !== "all") {
    query += ` AND payment_method = ?`;
    params.push(payment_method);
  }
  const validSortCols = {
    next_billing_date: "next_billing_date",
    price: "price",
    name: "name",
    start_date: "start_date",
    created_at: "created_at"
  };
  const sortCol = validSortCols[sort_by] || "next_billing_date";
  const direction = sort_order.toLowerCase() === "desc" ? "DESC" : "ASC";
  query += ` ORDER BY ${sortCol} ${direction}`;
  const rows = await db.prepare(query).all(...params);
  const subscriptions = rows.map((sub) => {
    const daysUntil = calculateDaysDifference(sub.next_billing_date);
    const monthlyEq = calculateMonthlyEquivalent(sub.price, sub.billing_cycle, sub.currency, userCurrency);
    const yearlyEq = calculateYearlyEquivalent(sub.price, sub.billing_cycle, sub.currency, userCurrency);
    return {
      ...sub,
      auto_renew: Boolean(sub.auto_renew),
      days_until_renewal: daysUntil,
      is_renewing_soon: sub.status === "active" && daysUntil >= 0 && daysUntil <= (sub.reminder_days || 7),
      is_overdue: sub.status === "active" && daysUntil < 0,
      monthly_equivalent: monthlyEq,
      yearly_equivalent: yearlyEq
    };
  });
  return res.json({
    success: true,
    data: subscriptions,
    count: subscriptions.length
  });
});
router3.get("/:id", async (req, res) => {
  const userId = req.user.userId;
  const sub = await db.prepare("SELECT * FROM public.subtrack_subscriptions WHERE id = ? AND user_id = ?").get(req.params.id, userId);
  if (!sub) {
    return res.status(404).json({ success: false, error: "Subscription not found" });
  }
  const history = await db.prepare("SELECT * FROM public.subtrack_payment_history WHERE subscription_id = ? ORDER BY billing_date DESC").all(sub.id);
  return res.json({
    success: true,
    data: {
      ...sub,
      auto_renew: Boolean(sub.auto_renew),
      history
    }
  });
});
router3.post("/", async (req, res) => {
  const userId = req.user.userId;
  const parseResult = SubscriptionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: parseResult.error.issues[0].message
    });
  }
  const data = parseResult.data;
  const subId = `sub-${crypto5.randomUUID()}`;
  await db.transaction(async () => {
    await db.prepare(`
    INSERT INTO public.subtrack_subscriptions (
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
      data.notes || "",
      data.website || "",
      data.logo || "",
      data.color || "#4F46E5",
      data.reminder_days,
      data.auto_renew,
      data.cancellation_url || ""
    );
    await db.prepare(`
    INSERT INTO public.subtrack_payment_history (id, user_id, subscription_id, amount, currency, billing_date, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
  `).run(
      `hist-${crypto5.randomUUID()}`,
      userId,
      subId,
      data.price,
      data.currency.toUpperCase(),
      data.start_date,
      data.payment_method
    );
  })();
  const created = await db.prepare("SELECT * FROM public.subtrack_subscriptions WHERE id = ?").get(subId);
  return res.status(201).json({
    success: true,
    data: created,
    message: "Subscription added successfully"
  });
});
router3.put("/:id", async (req, res) => {
  const userId = req.user.userId;
  const subId = req.params.id;
  const existing = await db.prepare("SELECT * FROM public.subtrack_subscriptions WHERE id = ? AND user_id = ?").get(subId, userId);
  if (!existing) {
    return res.status(404).json({ success: false, error: "Subscription not found" });
  }
  const parseResult = SubscriptionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: parseResult.error.issues[0].message
    });
  }
  const data = parseResult.data;
  await db.prepare(`
    UPDATE public.subtrack_subscriptions SET
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
    data.notes || "",
    data.website || "",
    data.logo || "",
    data.color || "#4F46E5",
    data.reminder_days,
    data.auto_renew,
    data.cancellation_url || "",
    subId,
    userId
  );
  const updated = await db.prepare("SELECT * FROM public.subtrack_subscriptions WHERE id = ?").get(subId);
  return res.json({
    success: true,
    data: updated,
    message: "Subscription updated successfully"
  });
});
router3.delete("/:id", async (req, res) => {
  const userId = req.user.userId;
  const subId = req.params.id;
  const result = await db.prepare("DELETE FROM public.subtrack_subscriptions WHERE id = ? AND user_id = ?").run(subId, userId);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: "Subscription not found" });
  }
  return res.json({
    success: true,
    message: "Subscription removed successfully"
  });
});
router3.post("/:id/renew", async (req, res) => {
  const userId = req.user.userId;
  const subId = req.params.id;
  const nextBilling = await db.transaction(async () => {
    const sub = await db.prepare("SELECT * FROM public.subtrack_subscriptions WHERE id = ? AND user_id = ? FOR UPDATE").get(subId, userId);
    if (!sub) {
      return void 0;
    }
    const nextBilling2 = advanceBillingDate(sub.next_billing_date, sub.billing_cycle);
    await db.prepare(`
    INSERT INTO public.subtrack_payment_history (id, user_id, subscription_id, amount, currency, billing_date, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
  `).run(
      `hist-${crypto5.randomUUID()}`,
      userId,
      subId,
      sub.price,
      sub.currency,
      sub.next_billing_date,
      sub.payment_method
    );
    await db.prepare(`
    UPDATE public.subtrack_subscriptions SET
      next_billing_date = ?,
      status = 'active',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextBilling2, subId);
    return nextBilling2;
  })();
  if (nextBilling === void 0) return res.status(404).json({ success: false, error: "Subscription not found" });
  const updated = await db.prepare("SELECT * FROM public.subtrack_subscriptions WHERE id = ?").get(subId);
  return res.json({
    success: true,
    data: updated,
    message: `Renewed successfully! Next billing scheduled for ${nextBilling}`
  });
});
router3.post("/:id/toggle-status", async (req, res) => {
  const userId = req.user.userId;
  const subId = req.params.id;
  const { status } = req.body;
  const validStatuses = ["active", "paused", "cancelled", "trial"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid status" });
  }
  const result = await db.prepare(`
    UPDATE public.subtrack_subscriptions SET
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(status, subId, userId);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: "Subscription not found" });
  }
  const updated = await db.prepare("SELECT * FROM public.subtrack_subscriptions WHERE id = ?").get(subId);
  return res.json({
    success: true,
    data: updated,
    message: `Subscription status set to ${status}`
  });
});
router3.post("/reset-seed", async (req, res) => {
  const userId = req.user.userId;
  await db.transaction(async () => {
    await db.prepare("DELETE FROM public.subtrack_subscriptions WHERE user_id = ?").run(userId);
    await seedSubscriptionsForUser(userId);
  })();
  return res.json({
    success: true,
    message: "Sample subscriptions re-seeded successfully"
  });
});
router3.post("/import", async (req, res) => {
  const userId = req.user.userId;
  const { subscriptions: items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: "No subscriptions provided for import" });
  }
  const parsed = z4.array(ImportSchema).max(500).safeParse(items);
  if (!parsed.success) return res.status(400).json({ success: false, error: parsed.error.issues[0].message });
  let importedCount = 0;
  await db.transaction(async () => {
    for (const item of parsed.data) if ((await importSubscription(userId, item)).added) importedCount++;
  })();
  return res.json({
    success: true,
    importedCount,
    message: `Successfully imported ${importedCount} subscription(s)`
  });
});
var subscriptions_default = router3;

// server/routes/analytics.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.use(authMiddleware);
function calculateDaysDifference2(targetDateStr) {
  const target = /* @__PURE__ */ new Date(targetDateStr + "T00:00:00");
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
}
router4.get("/summary", async (req, res) => {
  const userId = req.user.userId;
  const targetCurrency = req.user.currency || "USD";
  const subscriptions = await db.prepare("SELECT * FROM public.subtrack_subscriptions WHERE user_id = ?").all(userId);
  let totalMonthlySpend = 0;
  let totalYearlySpend = 0;
  let activeCount = 0;
  let pausedCount = 0;
  let cancelledCount = 0;
  let trialCount = 0;
  let renewalsNext7DaysCount = 0;
  let renewalsNext7DaysAmount = 0;
  let renewalsNext30DaysCount = 0;
  let renewalsNext30DaysAmount = 0;
  let pausedMonthlySavings = 0;
  const categoryMap = {};
  const cycleMap = {};
  const paymentMap = {};
  let highestExpenseSub = null;
  let maxMonthlyCost = 0;
  const upcomingRenewals = [];
  const trialAlerts = [];
  for (const sub of subscriptions) {
    const monthlyEq = calculateMonthlyEquivalent(sub.price, sub.billing_cycle, sub.currency, targetCurrency);
    const yearlyEq = calculateYearlyEquivalent(sub.price, sub.billing_cycle, sub.currency, targetCurrency);
    const daysUntil = calculateDaysDifference2(sub.next_billing_date);
    const convertedActualPrice = convertCurrency(sub.price, sub.currency, targetCurrency);
    if (sub.status === "active" || sub.status === "trial") {
      totalMonthlySpend += monthlyEq;
      totalYearlySpend += yearlyEq;
      activeCount++;
      if (monthlyEq > maxMonthlyCost) {
        maxMonthlyCost = monthlyEq;
        highestExpenseSub = {
          id: sub.id,
          name: sub.name,
          category: sub.category,
          monthly_cost: monthlyEq,
          currency: targetCurrency,
          color: sub.color,
          logo: sub.logo
        };
      }
      if (daysUntil >= 0 && daysUntil <= 7) {
        renewalsNext7DaysCount++;
        renewalsNext7DaysAmount += convertedActualPrice;
      }
      if (daysUntil >= 0 && daysUntil <= 30) {
        renewalsNext30DaysCount++;
        renewalsNext30DaysAmount += convertedActualPrice;
      }
      if (daysUntil >= 0) {
        upcomingRenewals.push({
          id: sub.id,
          name: sub.name,
          category: sub.category,
          price: sub.price,
          currency: sub.currency,
          converted_price: convertedActualPrice,
          target_currency: targetCurrency,
          billing_cycle: sub.billing_cycle,
          next_billing_date: sub.next_billing_date,
          days_until: daysUntil,
          color: sub.color,
          logo: sub.logo,
          status: sub.status,
          auto_renew: Boolean(sub.auto_renew)
        });
      }
      if (!categoryMap[sub.category]) {
        categoryMap[sub.category] = {
          name: sub.category,
          monthly: 0,
          count: 0,
          color: sub.color || "#6366F1"
        };
      }
      categoryMap[sub.category].monthly += monthlyEq;
      categoryMap[sub.category].count += 1;
      if (!cycleMap[sub.billing_cycle]) {
        cycleMap[sub.billing_cycle] = {
          cycle: sub.billing_cycle,
          monthly: 0,
          count: 0
        };
      }
      cycleMap[sub.billing_cycle].monthly += monthlyEq;
      cycleMap[sub.billing_cycle].count += 1;
      if (!paymentMap[sub.payment_method]) {
        paymentMap[sub.payment_method] = {
          method: sub.payment_method,
          monthly: 0,
          count: 0
        };
      }
      paymentMap[sub.payment_method].monthly += monthlyEq;
      paymentMap[sub.payment_method].count += 1;
    }
    if (sub.status === "paused") {
      pausedCount++;
      pausedMonthlySavings += monthlyEq;
    } else if (sub.status === "cancelled") {
      cancelledCount++;
    } else if (sub.status === "trial") {
      trialCount++;
      trialAlerts.push({
        id: sub.id,
        name: sub.name,
        days_until: daysUntil,
        end_date: sub.next_billing_date,
        price: sub.price,
        currency: sub.currency
      });
    }
  }
  upcomingRenewals.sort((a, b) => a.days_until - b.days_until);
  const categoryBreakdown = Object.values(categoryMap).map((cat) => ({
    name: cat.name,
    monthly: Math.round(cat.monthly * 100) / 100,
    yearly: Math.round(cat.monthly * 12 * 100) / 100,
    count: cat.count,
    percentage: totalMonthlySpend > 0 ? Math.round(cat.monthly / totalMonthlySpend * 1e3) / 10 : 0,
    color: cat.color
  })).sort((a, b) => b.monthly - a.monthly);
  const cycleBreakdown = Object.values(cycleMap).map((c) => ({
    cycle: c.cycle,
    monthly: Math.round(c.monthly * 100) / 100,
    count: c.count,
    percentage: totalMonthlySpend > 0 ? Math.round(c.monthly / totalMonthlySpend * 1e3) / 10 : 0
  }));
  const paymentBreakdown = Object.values(paymentMap).map((p) => ({
    method: p.method,
    monthly: Math.round(p.monthly * 100) / 100,
    count: p.count,
    percentage: totalMonthlySpend > 0 ? Math.round(p.monthly / totalMonthlySpend * 1e3) / 10 : 0
  }));
  const insights = [];
  if (highestExpenseSub && totalMonthlySpend > 0) {
    const pct = Math.round(highestExpenseSub.monthly_cost / totalMonthlySpend * 100);
    insights.push({
      type: "top_expense",
      title: "Top Expense Driver",
      message: `${highestExpenseSub.name} accounts for ${pct}% of your monthly subscription spending (${targetCurrency} ${highestExpenseSub.monthly_cost.toFixed(2)}/mo).`,
      impact: "warning",
      subId: highestExpenseSub.id
    });
  }
  const monthlySubs = subscriptions.filter((s) => s.status === "active" && s.billing_cycle === "monthly" && s.price >= 10);
  if (monthlySubs.length > 0) {
    const monthlySum = monthlySubs.reduce((acc, s) => acc + calculateMonthlyEquivalent(s.price, s.billing_cycle, s.currency, targetCurrency), 0);
    const potentialAnnualSavings = Math.round(monthlySum * 12 * 0.16 * 100) / 100;
    insights.push({
      type: "annual_discount",
      title: "Annual Billing Optimization",
      message: `You have ${monthlySubs.length} monthly subscriptions over ${targetCurrency} 10. Switching to annual plans could save you approximately ${targetCurrency} ${potentialAnnualSavings.toFixed(2)}/year.`,
      impact: "opportunity",
      savings: potentialAnnualSavings
    });
  }
  if (pausedMonthlySavings > 0) {
    insights.push({
      type: "paused_savings",
      title: "Active Pause Savings",
      message: `You are currently saving ${targetCurrency} ${pausedMonthlySavings.toFixed(2)}/mo (${targetCurrency} ${(pausedMonthlySavings * 12).toFixed(2)}/yr) from ${pausedCount} paused subscription(s).`,
      impact: "success",
      savings: pausedMonthlySavings * 12
    });
  }
  if (trialAlerts.length > 0) {
    for (const trial of trialAlerts) {
      insights.push({
        type: "trial_ending",
        title: "Free Trial Ending Soon",
        message: `${trial.name} trial ends in ${trial.days_until} day(s). Cancel before ${trial.end_date} to avoid being charged ${trial.currency} ${trial.price}.`,
        impact: "urgent",
        subId: trial.id
      });
    }
  }
  const today = /* @__PURE__ */ new Date();
  const monthlyForecast = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (let i = 0; i < 12; i++) {
    const forecastDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthLabel = `${monthNames[forecastDate.getMonth()]} ${forecastDate.getFullYear().toString().slice(2)}`;
    let monthSpend = 0;
    for (const sub of subscriptions) {
      if (sub.status !== "active") continue;
      const convertedPrice = convertCurrency(sub.price, sub.currency, targetCurrency);
      if (sub.billing_cycle === "monthly") {
        monthSpend += convertedPrice;
      } else if (sub.billing_cycle === "weekly") {
        monthSpend += convertedPrice * 4.333;
      } else if (sub.billing_cycle === "quarterly") {
        const subDate = /* @__PURE__ */ new Date(sub.next_billing_date + "T00:00:00");
        if ((forecastDate.getMonth() - subDate.getMonth()) % 3 === 0) {
          monthSpend += convertedPrice;
        }
      } else if (sub.billing_cycle === "semi_annual") {
        const subDate = /* @__PURE__ */ new Date(sub.next_billing_date + "T00:00:00");
        if ((forecastDate.getMonth() - subDate.getMonth()) % 6 === 0) {
          monthSpend += convertedPrice;
        }
      } else if (sub.billing_cycle === "yearly") {
        const subDate = /* @__PURE__ */ new Date(sub.next_billing_date + "T00:00:00");
        if (forecastDate.getMonth() === subDate.getMonth()) {
          monthSpend += convertedPrice;
        }
      }
    }
    monthlyForecast.push({
      month: monthLabel,
      amount: Math.round(monthSpend * 100) / 100
    });
  }
  const averageMonthlySpend = activeCount > 0 ? Math.round(totalMonthlySpend / activeCount * 100) / 100 : 0;
  return res.json({
    success: true,
    data: {
      currency: targetCurrency,
      total_monthly_spend: Math.round(totalMonthlySpend * 100) / 100,
      total_yearly_spend: Math.round(totalYearlySpend * 100) / 100,
      average_monthly_spend: averageMonthlySpend,
      active_count: activeCount,
      paused_count: pausedCount,
      cancelled_count: cancelledCount,
      trial_count: trialCount,
      total_count: subscriptions.length,
      renewals_next_7_days: {
        count: renewalsNext7DaysCount,
        amount: Math.round(renewalsNext7DaysAmount * 100) / 100
      },
      renewals_next_30_days: {
        count: renewalsNext30DaysCount,
        amount: Math.round(renewalsNext30DaysAmount * 100) / 100
      },
      category_breakdown: categoryBreakdown,
      billing_cycle_breakdown: cycleBreakdown,
      payment_method_breakdown: paymentBreakdown,
      upcoming_renewals: upcomingRenewals.slice(0, 10),
      all_upcoming_renewals: upcomingRenewals,
      insights,
      monthly_forecast: monthlyForecast
    }
  });
});
var analytics_default = router4;

// server/routes/categories.ts
import { Router as Router5 } from "express";

// src/lib/categories.ts
var DEFAULT_CATEGORIES = [
  { name: "Entertainment & Streaming", icon: "Video", color: "#EF4444" },
  { name: "Productivity & Work", icon: "Document", color: "#3B82F6" },
  { name: "Cloud & Developer Tools", icon: "Code", color: "#10B981" },
  { name: "Music & Audio", icon: "Music", color: "#8B5CF6" },
  { name: "Utilities & Software", icon: "Settings", color: "#64748B" },
  { name: "Health & Fitness", icon: "Favorite", color: "#EC4899" },
  { name: "Finance & Banking", icon: "PieChart", color: "#F59E0B" },
  { name: "Gaming", icon: "Game", color: "#06B6D4" },
  { name: "Education & Learning", icon: "School", color: "#14B8A6" },
  { name: "Other", icon: "Tag", color: "#94A3B8" }
];

// server/routes/categories.ts
import crypto6 from "crypto";
var router5 = Router5();
router5.use(authMiddleware);
router5.get("/", async (req, res) => {
  const userId = req.user.userId;
  const userCategories = await db.prepare("SELECT * FROM public.subtrack_categories WHERE user_id = ?").all(userId);
  const allCategories = [
    ...DEFAULT_CATEGORIES.map((c) => ({ id: `sys-${c.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`, ...c, is_system: true })),
    ...userCategories.map((c) => ({ ...c, is_system: false }))
  ];
  return res.json({
    success: true,
    data: allCategories
  });
});
router5.post("/", async (req, res) => {
  const userId = req.user.userId;
  const { name, icon = "Tag", color = "#6366F1" } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: "Category name is required" });
  }
  const catId = `cat-${crypto6.randomUUID()}`;
  await db.prepare(`
    INSERT INTO public.subtrack_categories (id, user_id, name, icon, color)
    VALUES (?, ?, ?, ?, ?)
  `).run(catId, userId, name.trim(), icon, color);
  const created = await db.prepare("SELECT * FROM public.subtrack_categories WHERE id = ?").get(catId);
  return res.status(201).json({
    success: true,
    data: created
  });
});
var categories_default = router5;

// server/index.ts
dotenv.config();
var app = express();
app.use(cors());
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
    req._body = true;
  } else if (typeof req.body === "string" && req.body.length > 0) {
    try {
      req.body = JSON.parse(req.body);
      req._body = true;
    } catch (e) {
    }
  }
  next();
});
app.use(express.json());
app.use((req, res, next) => {
  if (req.query && req.query.match) {
    const subpath = Array.isArray(req.query.match) ? req.query.match.join("/") : String(req.query.match);
    if (subpath) {
      const qIndex = req.url.indexOf("?");
      const search = qIndex !== -1 ? req.url.substring(qIndex) : "";
      req.url = `/api/${subpath}${search}`;
    }
  } else {
    const matched = req.headers["x-matched-path"] || req.headers["x-now-route-matches"] || req.headers["x-forwarded-uri"];
    if (matched && matched.startsWith("/api") && (req.url === "/api" || req.url === "/" || req.url === "")) {
      req.url = matched;
    }
  }
  next();
});
app.get(["/api/health", "/health", "/api", "/api/"], async (_req, res) => {
  try {
    await initDatabase();
    res.json({ status: "ok", service: "SubTrack API", storage: "postgresql" });
  } catch {
    res.status(503).json({ status: "unavailable", service: "SubTrack API", storage: "postgresql" });
  }
});
app.use("/api/auth", auth_default);
app.use("/auth", auth_default);
app.use("/api/subscriptions", subscriptions_default);
app.use("/subscriptions", subscriptions_default);
app.use("/api/analytics", analytics_default);
app.use("/analytics", analytics_default);
app.use("/api/categories", categories_default);
app.use("/categories", categories_default);
app.use("/api/gmail", gmail_default);
app.use("/gmail", gmail_default);
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Endpoint ${req.path} not found` });
});
app.use((err, req, res, next) => {
  console.error("Unhandled server error", { code: err?.code });
  if (!res.headersSent) {
    res.status(err?.status || err?.statusCode || 500).json({
      success: false,
      error: "Internal Server Error"
    });
  }
});
var index_default = app;
export {
  index_default as default
};
