# SubTrack — Modern Subscription Manager & Expense Analytics

A polished, production-ready full-stack Subscription Manager web application designed to track recurring services, predict upcoming renewal expenses, visualize cash flow, detect cost optimizations, and manage subscriptions with ease.

---

## ✨ Features

- **Full Subscription Management**:
  - Add, edit, delete, pause/resume, and renew subscriptions.
  - Track **service name**, **logo / accent color**, **category**, **price**, **currency**, **billing cycle** (weekly, monthly, quarterly, semi-annual, yearly, lifetime), **payment method** (Credit Card, Debit Card, PayPal, Apple Pay, Google Pay, Bank Transfer, Crypto, Other), **start date**, **next billing date**, **status** (Active, Paused, Free Trial, Cancelled), **notes**, **website**, and **direct cancellation URL**.
  - **Quick Popular Presets**: Instant 1-click templates for Netflix, Spotify, ChatGPT Plus, GitHub Copilot, Amazon Prime, Figma, Notion, iCloud+, Disney+, Adobe Creative Cloud, Vercel, Xbox Game Pass, and more.

- **Automated Financial Calculations**:
  - Normalized **Monthly Equivalent** and **Yearly Projected** spending across all cycles.
  - Multi-currency support (USD, EUR, GBP, CAD, AUD, JPY, KHR) with real-time conversion and customizable primary currency.
  - Average monthly spend per service.
  - Upcoming renewals count & total bill amounts for the next 7 days and next 30 days.

- **Intelligent Recurring-Cost Insights**:
  - **Free Trial Alerts**: Highlights expiring trials to avoid unwanted recurring charges.
  - **Annual Discount Detector**: Identifies high-value monthly subscriptions that could save ~16% by switching to annual billing.
  - **Active Pause Savings**: Computes monthly and yearly money saved from paused subscriptions.
  - **Top Expense Drivers**: pinpoints services taking the largest portion of your monthly budget.

- **Interactive Visual Dashboard**:
  - **12-Month Expense Forecast**: Area chart projecting upcoming cash commitments considering diverse renewal cycles.
  - **Category Allocation Doughnut Chart**: Interactive breakdown of budget distribution by category.
  - **Upcoming Renewal Timeline**: Chronological countdown timeline with 1-click "Mark Renewed" action and celebratory confetti!

- **Multi-View Subscriptions Explorer**:
  - **Grid Cards View & Compact Table View**.
  - Real-time search by service name, notes, category, or website.
  - Category filter pills, status filter tabs (Active, Paused, Free Trial, Cancelled), billing cycle dropdown, and sort controls.
  - Quick inline actions: Mark Renewed, Pause/Resume, Direct Website link, Edit, Delete.

- **Interactive Renewal Calendar**:
  - Full monthly calendar grid showing exact renewal dates, service chips, and price sums.
  - Day inspection drawer to review scheduled bills for any selected date.
  - Monthly renewal total calculation.

- **Deep-Dive Analytics & Reports**:
  - Category bar charts and detailed performance tables with budget percentages.
  - Payment method distribution progress bars.
  - Comprehensive spending summaries.

- **Data Portability & Backups**:
  - Export all subscriptions to **CSV** (spreadsheet-ready) or **JSON**.
  - Import subscriptions via CSV file upload with template downloader.

- **Authentication & Multi-Tenant Security**:
  - Secure registration and login with bcrypt password hashing and JWT authorization tokens.
  - Strict user isolation in SQLite database with foreign keys and indexes.
  - **1-Click Demo Account**: Instant test-drive with 10 realistic sample subscriptions.

- **Modern UX & Accessibility**:
  - Dark Mode and Light Mode with system preference detection and anti-flash state.
  - Custom responsive layout optimized for mobile, tablet, and desktop.
  - Modern icons powered by `@veasnawt/vicons`.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Recharts, `@veasnawt/vicons`, Canvas Confetti, Date-fns.
- **Backend**: Node.js, Express 5, TypeScript (`tsx`), Zod validation, JSON Web Tokens (JWT), Bcrypt.js.
- **Database**: SQLite with `better-sqlite3` in WAL (Write-Ahead Logging) mode.
- **Build Tooling**: Vite 8, `@tailwindcss/vite`, Concurrently.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start in Development Mode (Client + API Server)
```bash
npm run dev
```
- Frontend runs at: `http://localhost:3000` (with automatic `/api` proxy)
- Backend API runs at: `http://localhost:5000`

### 3. Production Build & Start
```bash
npm run build
npm start
```
- Serves both API and optimized static assets at `http://localhost:5000`

---

## 🔑 Demo Account Credentials

- **Email**: `demo@subtrack.app`
- **Password**: `demo1234`
*(Or simply click **⚡ Explore Demo Account** on the login screen for instant 1-click access!)*

---

## ☁️ Deploying to Vercel

The project is pre-configured with [`vercel.json`](./vercel.json) and [`api/index.ts`](./api/index.ts) for Vercel deployment:

### Deploy using the Vercel CLI:
```bash
npx vercel
```
Or push to GitHub and import the repository on [vercel.com](https://vercel.com).

> [!NOTE]
> **Database Persistence on Vercel**:
> Vercel Serverless Functions have an ephemeral `/tmp` filesystem. The app will automatically initialize SQLite in `/tmp` for demo and session usage.
>
> For **permanent production persistence**:
> 1. **Turso (libSQL)**: Serverless SQLite over HTTP (recommended for Vercel — free tier includes 9GB storage).
> 2. **Neon / Supabase / Vercel Postgres**: Connect via standard connection string.
> 3. **Railway / Render / Fly.io**: If you prefer keeping the local SQLite file (`subscriptions.db`) without external cloud databases, deploy to Railway or Render with a persistent volume attached.

