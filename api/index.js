// server/index.ts
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

// server/db.ts
import path from "path";
import fs from "fs";
import bcrypt from "bcryptjs";
function createUniversalJsDb(storageFile) {
  const store = {
    users: [],
    categories: [],
    subscriptions: [],
    payment_history: []
  };
  function save() {
    if (storageFile) {
      try {
        fs.writeFileSync(storageFile, JSON.stringify(store, null, 2), "utf8");
      } catch (e) {
      }
    }
  }
  function load() {
    if (storageFile && fs.existsSync(storageFile)) {
      try {
        const raw = fs.readFileSync(storageFile, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed.users) store.users = parsed.users;
        if (parsed.categories) store.categories = parsed.categories;
        if (parsed.subscriptions) store.subscriptions = parsed.subscriptions;
        if (parsed.payment_history) store.payment_history = parsed.payment_history;
      } catch (e) {
      }
    }
  }
  load();
  return {
    pragma: () => {
    },
    exec: () => {
    },
    transaction: (fn) => (...args) => fn(...args),
    prepare: (sql) => {
      const cleanSql = sql.trim().replace(/\s+/g, " ");
      return {
        get: (...params) => {
          const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          if (cleanSql.includes("FROM users WHERE email = ?")) {
            const email = String(args[0]).toLowerCase().trim();
            const user = store.users.find((u) => u.email.toLowerCase().trim() === email);
            if (!user) return void 0;
            if (cleanSql.includes("SELECT id FROM users")) return { id: user.id };
            return { ...user };
          }
          if (cleanSql.includes("FROM users WHERE id = ?")) {
            const id = args[0];
            const user = store.users.find((u) => u.id === id);
            return user ? { ...user } : void 0;
          }
          if (cleanSql.includes("COUNT(*) as count FROM subscriptions WHERE user_id = ?")) {
            const userId = args[0];
            const count = store.subscriptions.filter((s) => s.user_id === userId).length;
            return { count };
          }
          if (cleanSql.includes("FROM subscriptions WHERE id = ? AND user_id = ?")) {
            const [id, userId] = args;
            const sub = store.subscriptions.find((s) => s.id === id && s.user_id === userId);
            return sub ? { ...sub } : void 0;
          }
          if (cleanSql.includes("FROM subscriptions WHERE id = ?")) {
            const id = args[0];
            const sub = store.subscriptions.find((s) => s.id === id);
            return sub ? { ...sub } : void 0;
          }
          if (cleanSql.includes("FROM categories WHERE id = ?")) {
            const id = args[0];
            const cat = store.categories.find((c) => c.id === id);
            return cat ? { ...cat } : void 0;
          }
          return void 0;
        },
        all: (...params) => {
          const args = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
          if (cleanSql.includes("FROM payment_history WHERE subscription_id = ?")) {
            const subId = args[0];
            return store.payment_history.filter((p) => p.subscription_id === subId).sort((a, b) => new Date(b.billing_date).getTime() - new Date(a.billing_date).getTime());
          }
          if (cleanSql.includes("FROM categories WHERE user_id = ?")) {
            const userId = args[0];
            return store.categories.filter((c) => c.user_id === userId);
          }
          if (cleanSql.includes("FROM subscriptions WHERE user_id = ?")) {
            const userId = args[0];
            let list = store.subscriptions.filter((s) => s.user_id === userId);
            let paramIdx = 1;
            if (cleanSql.includes("(name LIKE ? OR notes LIKE ? OR website LIKE ?)")) {
              const term = String(args[paramIdx]).replace(/%/g, "").toLowerCase();
              paramIdx += 3;
              list = list.filter(
                (s) => s.name.toLowerCase().includes(term) || (s.notes || "").toLowerCase().includes(term) || (s.website || "").toLowerCase().includes(term)
              );
            }
            if (cleanSql.includes("AND category = ?")) {
              const cat = args[paramIdx++];
              list = list.filter((s) => s.category === cat);
            }
            if (cleanSql.includes("AND status = ?")) {
              const stat = args[paramIdx++];
              list = list.filter((s) => s.status === stat);
            }
            if (cleanSql.includes("AND billing_cycle = ?")) {
              const cycle = args[paramIdx++];
              list = list.filter((s) => s.billing_cycle === cycle);
            }
            if (cleanSql.includes("AND payment_method = ?")) {
              const pm = args[paramIdx++];
              list = list.filter((s) => s.payment_method === pm);
            }
            const isDesc = cleanSql.includes("DESC");
            if (cleanSql.includes("ORDER BY price")) {
              list.sort((a, b) => isDesc ? b.price - a.price : a.price - b.price);
            } else if (cleanSql.includes("ORDER BY name")) {
              list.sort((a, b) => isDesc ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name));
            } else if (cleanSql.includes("ORDER BY start_date")) {
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
            return list.map((s) => ({ ...s }));
          }
          return [];
        },
        run: (...params) => {
          let changes = 0;
          if (cleanSql.includes("INSERT INTO users")) {
            const [id, name, email, password_hash, currency, theme = "system"] = params;
            store.users.push({
              id,
              name,
              email: email.toLowerCase().trim(),
              password_hash,
              currency,
              theme,
              created_at: (/* @__PURE__ */ new Date()).toISOString(),
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            });
            changes = 1;
            save();
            return { changes };
          }
          if (cleanSql.includes("UPDATE users SET")) {
            const userId = params[params.length - 1];
            const user = store.users.find((u) => u.id === userId);
            if (user) {
              if (cleanSql.includes("name = ?")) {
                const nameIdx = cleanSql.split("?").findIndex((part) => part.includes("name ="));
                if (nameIdx >= 0) user.name = params[nameIdx];
              }
              if (cleanSql.includes("currency = ?")) {
                const currIdx = cleanSql.split("?").findIndex((part) => part.includes("currency ="));
                if (currIdx >= 0) user.currency = params[currIdx];
              }
              if (cleanSql.includes("theme = ?")) {
                const themeIdx = cleanSql.split("?").findIndex((part) => part.includes("theme ="));
                if (themeIdx >= 0) user.theme = params[themeIdx];
              }
              user.updated_at = (/* @__PURE__ */ new Date()).toISOString();
              changes = 1;
              save();
            }
            return { changes };
          }
          if (cleanSql.includes("INSERT INTO subscriptions")) {
            if (params.length === 1 && typeof params[0] === "object") {
              const obj = params[0];
              const record = {
                id: obj.id || obj["@id"],
                user_id: obj.user_id || obj["@user_id"],
                name: obj.name || obj["@name"],
                category: obj.category || obj["@category"],
                price: Number(obj.price ?? obj["@price"]),
                currency: obj.currency || obj["@currency"] || "USD",
                billing_cycle: obj.billing_cycle || obj["@billing_cycle"],
                payment_method: obj.payment_method || obj["@payment_method"],
                start_date: obj.start_date || obj["@start_date"],
                next_billing_date: obj.next_billing_date || obj["@next_billing_date"],
                status: obj.status || obj["@status"] || "active",
                notes: obj.notes || obj["@notes"] || "",
                website: obj.website || obj["@website"] || "",
                logo: obj.logo || obj["@logo"] || "",
                color: obj.color || obj["@color"] || "#4F46E5",
                reminder_days: Number(obj.reminder_days ?? obj["@reminder_days"] ?? 3),
                auto_renew: Number(obj.auto_renew ?? obj["@auto_renew"] ?? 1),
                cancellation_url: obj.cancellation_url || obj["@cancellation_url"] || "",
                created_at: (/* @__PURE__ */ new Date()).toISOString(),
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              };
              store.subscriptions.push(record);
              changes = 1;
              save();
              return { changes };
            } else {
              const [
                id,
                user_id,
                name,
                category,
                price,
                currency,
                billing_cycle,
                payment_method,
                start_date,
                next_billing_date,
                status,
                notes,
                website,
                logo,
                color,
                reminder_days,
                auto_renew,
                cancellation_url
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
                notes: notes || "",
                website: website || "",
                logo: logo || "",
                color: color || "#4F46E5",
                reminder_days: Number(reminder_days ?? 3),
                auto_renew: Number(auto_renew ?? 1),
                cancellation_url: cancellation_url || "",
                created_at: (/* @__PURE__ */ new Date()).toISOString(),
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              });
              changes = 1;
              save();
              return { changes };
            }
          }
          if (cleanSql.includes("UPDATE subscriptions SET")) {
            if (cleanSql.includes("next_billing_date = ?, status = 'active'")) {
              const [nextBilling, subId2] = params;
              const sub2 = store.subscriptions.find((s) => s.id === subId2);
              if (sub2) {
                sub2.next_billing_date = nextBilling;
                sub2.status = "active";
                sub2.updated_at = (/* @__PURE__ */ new Date()).toISOString();
                changes = 1;
                save();
              }
              return { changes };
            }
            if (cleanSql.includes("status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?")) {
              const [status, subId2, userId2] = params;
              const sub2 = store.subscriptions.find((s) => s.id === subId2 && s.user_id === userId2);
              if (sub2) {
                sub2.status = status;
                sub2.updated_at = (/* @__PURE__ */ new Date()).toISOString();
                changes = 1;
                save();
              }
              return { changes };
            }
            const subId = params[params.length - 2];
            const userId = params[params.length - 1];
            const sub = store.subscriptions.find((s) => s.id === subId && s.user_id === userId);
            if (sub) {
              const [
                name,
                category,
                price,
                currency,
                billing_cycle,
                payment_method,
                start_date,
                next_billing_date,
                status,
                notes,
                website,
                logo,
                color,
                reminder_days,
                auto_renew,
                cancellation_url
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
                notes: notes || "",
                website: website || "",
                logo: logo || "",
                color: color || "#4F46E5",
                reminder_days: Number(reminder_days ?? 3),
                auto_renew: Number(auto_renew ?? 1),
                cancellation_url: cancellation_url || "",
                updated_at: (/* @__PURE__ */ new Date()).toISOString()
              });
              changes = 1;
              save();
            }
            return { changes };
          }
          if (cleanSql.includes("DELETE FROM subscriptions WHERE id = ? AND user_id = ?")) {
            const [subId, userId] = params;
            const before = store.subscriptions.length;
            store.subscriptions = store.subscriptions.filter((s) => !(s.id === subId && s.user_id === userId));
            store.payment_history = store.payment_history.filter((p) => p.subscription_id !== subId);
            changes = before - store.subscriptions.length;
            save();
            return { changes };
          }
          if (cleanSql.includes("DELETE FROM subscriptions WHERE user_id = ?")) {
            const userId = params[0];
            const before = store.subscriptions.length;
            store.subscriptions = store.subscriptions.filter((s) => s.user_id !== userId);
            changes = before - store.subscriptions.length;
            save();
            return { changes };
          }
          if (cleanSql.includes("INSERT INTO payment_history")) {
            const [id, user_id, subscription_id, amount, currency, billing_date, payment_method, status = "paid"] = params;
            store.payment_history.push({
              id,
              user_id,
              subscription_id,
              amount: Number(amount),
              currency,
              billing_date,
              payment_method,
              status,
              created_at: (/* @__PURE__ */ new Date()).toISOString()
            });
            changes = 1;
            save();
            return { changes };
          }
          if (cleanSql.includes("INSERT INTO categories")) {
            const [id, user_id, name, icon, color] = params;
            store.categories.push({
              id,
              user_id,
              name,
              icon,
              color,
              created_at: (/* @__PURE__ */ new Date()).toISOString()
            });
            changes = 1;
            save();
            return { changes };
          }
          return { changes: 0 };
        }
      };
    }
  };
}
var storagePath;
try {
  const tmpDir = "/tmp";
  if (fs.existsSync(tmpDir)) {
    storagePath = path.join(tmpDir, "subtrack_db.json");
  } else {
    const dataDir = path.join(process.cwd(), "server", "data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {
      }
    }
    storagePath = path.join(dataDir, "subscriptions.json");
  }
} catch (e) {
  storagePath = void 0;
}
var db = createUniversalJsDb(storagePath);
function initDatabase() {
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
function seedDemoUser() {
  try {
    const existingDemo = db.prepare("SELECT id FROM users WHERE email = ?").get("demo@subtrack.app");
    const demoUserId = existingDemo ? existingDemo.id : "demo-user-id-001";
    if (!existingDemo) {
      const passwordHash = bcrypt.hashSync("demo1234", 10);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, currency, theme)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(demoUserId, "Alex Taylor", "demo@subtrack.app", passwordHash, "USD", "system");
    }
    const count = db.prepare("SELECT COUNT(*) as count FROM subscriptions WHERE user_id = ?").get(demoUserId)?.count || 0;
    if (count === 0) {
      seedSubscriptionsForUser(demoUserId);
    }
  } catch (err) {
    console.warn("seedDemoUser non-fatal error:", err);
  }
}
function seedSubscriptionsForUser(userId) {
  const today = /* @__PURE__ */ new Date();
  const formatDate = (date) => date.toISOString().split("T")[0];
  const addDays = (d, days) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return formatDate(copy);
  };
  const subMonths = (d, months) => {
    const copy = new Date(d);
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
  try {
    insertMany(sampleSubscriptions);
  } catch (err) {
    console.warn("seedSubscriptionsForUser non-fatal error:", err);
  }
}

// server/routes/auth.ts
import { Router } from "express";
import { z } from "zod";
import bcrypt2 from "bcryptjs";
import jwt2 from "jsonwebtoken";
import crypto from "crypto";

// server/middleware/auth.ts
import jwt from "jsonwebtoken";
var JWT_SECRET = process.env.JWT_SECRET || "subtrack-super-secure-key-2026-prod";
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
  seedSamples: z.boolean().optional().default(true)
});
var LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});
router.post("/register", (req, res) => {
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
    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists"
      });
    }
    const userId = crypto && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const passwordHash = bcrypt2.hashSync(password, 10);
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, currency)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, name.trim(), normalizedEmail, passwordHash, currency.toUpperCase());
    if (seedSamples) {
      try {
        seedSubscriptionsForUser(userId);
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
    console.error("Registration unhandled error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Registration failed. Please try again."
    });
  }
});
router.post("/login", (req, res) => {
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
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password"
      });
    }
    const passwordValid = bcrypt2.compareSync(password, user.password_hash);
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
    console.error("Login unhandled error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Login failed. Please try again."
    });
  }
});
router.post("/demo", (req, res) => {
  try {
    const demoEmail = "demo@subtrack.app";
    let demoUser = db.prepare("SELECT * FROM users WHERE email = ?").get(demoEmail);
    if (!demoUser) {
      const demoUserId = "demo-user-id-001";
      const passwordHash = bcrypt2.hashSync("demo1234", 10);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, currency, theme)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(demoUserId, "Alex Taylor", demoEmail, passwordHash, "USD", "system");
      try {
        seedSubscriptionsForUser(demoUserId);
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
    console.error("Demo auth unhandled error:", err);
    return res.status(500).json({
      success: false,
      error: err?.message || "Demo login failed. Please try again."
    });
  }
});
router.get("/me", authMiddleware, (req, res) => {
  const user = db.prepare("SELECT id, name, email, currency, theme, created_at FROM users WHERE id = ?").get(req.user.userId);
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
router.put("/me", authMiddleware, (req, res) => {
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
    db.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).run(...values);
  }
  const updatedUser = db.prepare("SELECT id, name, email, currency, theme FROM users WHERE id = ?").get(req.user.userId);
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

// server/routes/subscriptions.ts
import { Router as Router2 } from "express";
import { z as z2 } from "zod";
import crypto2 from "crypto";

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
var router2 = Router2();
router2.use(authMiddleware);
var SubscriptionSchema = z2.object({
  name: z2.string().min(1, "Service name is required"),
  category: z2.string().min(1, "Category is required"),
  price: z2.preprocess(
    (val) => typeof val === "string" ? parseFloat(val) : val,
    z2.number().positive("Price must be greater than 0")
  ),
  currency: z2.string().default("USD"),
  billing_cycle: z2.enum(["weekly", "monthly", "quarterly", "semi_annual", "yearly", "lifetime"]),
  payment_method: z2.string().default("credit_card"),
  start_date: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  next_billing_date: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Next billing date must be YYYY-MM-DD"),
  status: z2.enum(["active", "paused", "cancelled", "trial"]).default("active"),
  notes: z2.string().optional().default(""),
  website: z2.string().optional().default(""),
  logo: z2.string().optional().default(""),
  color: z2.string().optional().default("#4F46E5"),
  reminder_days: z2.preprocess(
    (val) => typeof val === "string" ? parseInt(val, 10) : val,
    z2.number().int().min(0).max(90).default(3)
  ),
  auto_renew: z2.preprocess(
    (val) => typeof val === "boolean" ? val ? 1 : 0 : typeof val === "string" ? val === "true" || val === "1" ? 1 : 0 : typeof val === "number" ? val : 1,
    z2.number().int().min(0).max(1).default(1)
  ),
  cancellation_url: z2.string().optional().default("")
});
function calculateDaysDifference(targetDateStr) {
  const target = /* @__PURE__ */ new Date(targetDateStr + "T00:00:00");
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
}
function advanceBillingDate(currentDateStr, cycle) {
  const date = /* @__PURE__ */ new Date(currentDateStr + "T00:00:00");
  switch (cycle.toLowerCase()) {
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "quarterly":
      date.setMonth(date.getMonth() + 3);
      break;
    case "semi_annual":
      date.setMonth(date.getMonth() + 6);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    case "lifetime":
      break;
    default:
      date.setMonth(date.getMonth() + 1);
      break;
  }
  return date.toISOString().split("T")[0];
}
router2.get("/", (req, res) => {
  const userId = req.user.userId;
  const userCurrency = req.user.currency || "USD";
  const { search, category, status, billing_cycle, payment_method, sort_by = "next_billing_date", sort_order = "asc" } = req.query;
  let query = `SELECT * FROM subscriptions WHERE user_id = ?`;
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
  const rows = db.prepare(query).all(...params);
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
router2.get("/:id", (req, res) => {
  const userId = req.user.userId;
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ? AND user_id = ?").get(req.params.id, userId);
  if (!sub) {
    return res.status(404).json({ success: false, error: "Subscription not found" });
  }
  const history = db.prepare("SELECT * FROM payment_history WHERE subscription_id = ? ORDER BY billing_date DESC").all(sub.id);
  return res.json({
    success: true,
    data: {
      ...sub,
      auto_renew: Boolean(sub.auto_renew),
      history
    }
  });
});
router2.post("/", (req, res) => {
  const userId = req.user.userId;
  const parseResult = SubscriptionSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: parseResult.error.issues[0].message
    });
  }
  const data = parseResult.data;
  const subId = `sub-${crypto2.randomUUID()}`;
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
    data.notes || "",
    data.website || "",
    data.logo || "",
    data.color || "#4F46E5",
    data.reminder_days,
    data.auto_renew,
    data.cancellation_url || ""
  );
  db.prepare(`
    INSERT INTO payment_history (id, user_id, subscription_id, amount, currency, billing_date, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
  `).run(
    `hist-${crypto2.randomUUID()}`,
    userId,
    subId,
    data.price,
    data.currency.toUpperCase(),
    data.start_date,
    data.payment_method
  );
  const created = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subId);
  return res.status(201).json({
    success: true,
    data: created,
    message: "Subscription added successfully"
  });
});
router2.put("/:id", (req, res) => {
  const userId = req.user.userId;
  const subId = req.params.id;
  const existing = db.prepare("SELECT * FROM subscriptions WHERE id = ? AND user_id = ?").get(subId, userId);
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
  const updated = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subId);
  return res.json({
    success: true,
    data: updated,
    message: "Subscription updated successfully"
  });
});
router2.delete("/:id", (req, res) => {
  const userId = req.user.userId;
  const subId = req.params.id;
  const result = db.prepare("DELETE FROM subscriptions WHERE id = ? AND user_id = ?").run(subId, userId);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: "Subscription not found" });
  }
  return res.json({
    success: true,
    message: "Subscription removed successfully"
  });
});
router2.post("/:id/renew", (req, res) => {
  const userId = req.user.userId;
  const subId = req.params.id;
  const sub = db.prepare("SELECT * FROM subscriptions WHERE id = ? AND user_id = ?").get(subId, userId);
  if (!sub) {
    return res.status(404).json({ success: false, error: "Subscription not found" });
  }
  const nextBilling = advanceBillingDate(sub.next_billing_date, sub.billing_cycle);
  db.prepare(`
    INSERT INTO payment_history (id, user_id, subscription_id, amount, currency, billing_date, payment_method, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'paid')
  `).run(
    `hist-${crypto2.randomUUID()}`,
    userId,
    subId,
    sub.price,
    sub.currency,
    sub.next_billing_date,
    sub.payment_method
  );
  db.prepare(`
    UPDATE subscriptions SET
      next_billing_date = ?,
      status = 'active',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextBilling, subId);
  const updated = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subId);
  return res.json({
    success: true,
    data: updated,
    message: `Renewed successfully! Next billing scheduled for ${nextBilling}`
  });
});
router2.post("/:id/toggle-status", (req, res) => {
  const userId = req.user.userId;
  const subId = req.params.id;
  const { status } = req.body;
  const validStatuses = ["active", "paused", "cancelled", "trial"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: "Invalid status" });
  }
  const result = db.prepare(`
    UPDATE subscriptions SET
      status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(status, subId, userId);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, error: "Subscription not found" });
  }
  const updated = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subId);
  return res.json({
    success: true,
    data: updated,
    message: `Subscription status set to ${status}`
  });
});
router2.post("/reset-seed", (req, res) => {
  const userId = req.user.userId;
  db.prepare("DELETE FROM subscriptions WHERE user_id = ?").run(userId);
  seedSubscriptionsForUser(userId);
  return res.json({
    success: true,
    message: "Sample subscriptions re-seeded successfully"
  });
});
router2.post("/import", (req, res) => {
  const userId = req.user.userId;
  const { subscriptions: items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: "No subscriptions provided for import" });
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
  const tx = db.transaction((subs) => {
    for (const item of subs) {
      if (!item.name || !item.price) continue;
      const subId = `sub-${crypto2.randomUUID()}`;
      insertStmt.run(
        subId,
        userId,
        String(item.name).trim(),
        item.category || "Other",
        Number(item.price) || 0,
        (item.currency || "USD").toUpperCase(),
        item.billing_cycle || "monthly",
        item.payment_method || "credit_card",
        item.start_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        item.next_billing_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        item.status || "active",
        item.notes || "",
        item.website || "",
        item.logo || "",
        item.color || "#4F46E5",
        Number(item.reminder_days) || 3,
        item.auto_renew !== void 0 ? Number(Boolean(item.auto_renew)) : 1,
        item.cancellation_url || ""
      );
      importedCount++;
    }
  });
  tx(items);
  return res.json({
    success: true,
    importedCount,
    message: `Successfully imported ${importedCount} subscription(s)`
  });
});
var subscriptions_default = router2;

// server/routes/analytics.ts
import { Router as Router3 } from "express";
var router3 = Router3();
router3.use(authMiddleware);
function calculateDaysDifference2(targetDateStr) {
  const target = /* @__PURE__ */ new Date(targetDateStr + "T00:00:00");
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
}
router3.get("/summary", (req, res) => {
  const userId = req.user.userId;
  const targetCurrency = req.user.currency || "USD";
  const subscriptions = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").all(userId);
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
var analytics_default = router3;

// server/routes/categories.ts
import { Router as Router4 } from "express";
import crypto3 from "crypto";
var router4 = Router4();
router4.use(authMiddleware);
router4.get("/", (req, res) => {
  const userId = req.user.userId;
  const userCategories = db.prepare("SELECT * FROM categories WHERE user_id = ?").all(userId);
  const allCategories = [
    ...DEFAULT_CATEGORIES.map((c) => ({ id: `sys-${c.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`, ...c, is_system: true })),
    ...userCategories.map((c) => ({ ...c, is_system: false }))
  ];
  return res.json({
    success: true,
    data: allCategories
  });
});
router4.post("/", (req, res) => {
  const userId = req.user.userId;
  const { name, icon = "Tag", color = "#6366F1" } = req.body;
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return res.status(400).json({ success: false, error: "Category name is required" });
  }
  const catId = `cat-${crypto3.randomUUID()}`;
  db.prepare(`
    INSERT INTO categories (id, user_id, name, icon, color)
    VALUES (?, ?, ?, ?, ?)
  `).run(catId, userId, name.trim(), icon, color);
  const created = db.prepare("SELECT * FROM categories WHERE id = ?").get(catId);
  return res.status(201).json({
    success: true,
    data: created
  });
});
var categories_default = router4;

// server/index.ts
dotenv.config();
var app = express();
try {
  initDatabase();
} catch (err) {
  console.error("Database initialization warning:", err);
}
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
app.get(["/api/health", "/health", "/api", "/api/"], (req, res) => {
  res.json({ status: "ok", service: "SubTrack API", time: (/* @__PURE__ */ new Date()).toISOString() });
});
app.use("/api/auth", auth_default);
app.use("/auth", auth_default);
app.use("/api/subscriptions", subscriptions_default);
app.use("/subscriptions", subscriptions_default);
app.use("/api/analytics", analytics_default);
app.use("/analytics", analytics_default);
app.use("/api/categories", categories_default);
app.use("/categories", categories_default);
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Endpoint ${req.path} not found` });
});
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  if (!res.headersSent) {
    res.status(err?.status || err?.statusCode || 500).json({
      success: false,
      error: err?.message || "Internal Server Error"
    });
  }
});
var index_default = app;
export {
  index_default as default
};
